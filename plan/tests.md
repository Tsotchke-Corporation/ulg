# ULG Test Plan

## Current Focused Result - 2026-06-12 15:53 AKDT

Created the repo-root todo handoff file `todo-handoff-6-12.md` with current
todo status, known blockers, validation notes, and recommended next work order.

Verified commands:

- `sed -n '1,260p' todo-handoff-6-12.md`
  - Passed.
  - Confirmed the file contains the current snapshot, completed work,
    remaining gaps, active todo order, known problems, useful commands, and next
    recommended slice.
- `wc -l todo-handoff-6-12.md`
  - Passed.
  - Reported `300` lines.
- `ss -ltnp 'sport = :5173'`
  - Passed.
  - Confirmed the Vite listener is on `0.0.0.0:5173`.
- `npm run icc:update`
  - Passed.
  - Reported `208` indexed files and `882` memory chunks after
    `todo-handoff-6-12.md` was added.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:47 AKDT

Created a user Codex skill for Infinite Context Coder at
`/home/cos/.codex/skills/icc/SKILL.md`.

Verified commands:

- `python3` frontmatter/body validation for
  `/home/cos/.codex/skills/icc/SKILL.md`
  - Passed.
  - Confirmed `name: icc`, a description mentioning Infinite Context Coder,
    and the `codebase_tool.py` command path.
- `find /home/cos/.codex/skills/icc -maxdepth 2 -type f -printf '%p\n'`
  - Passed.
  - Confirmed `/home/cos/.codex/skills/icc/SKILL.md` exists.
- `npm run icc:update`
  - Passed.
  - Reported `207` indexed files and `879` memory chunks after the plan/log
    updates.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:42 AKDT

ULG ICC artifacts were reinitialized from scratch to verify whether JavaScript
symbol/chunk detection improved after the `.icc` policy rewrite.

Verified commands:

- `mv /home/cos/projects/infinite_context_coder/artifacts/repos/ulg /home/cos/projects/infinite_context_coder/artifacts/repos/ulg.reinit-20260612-154227`
  - Passed.
  - Preserved the previous generated ICC artifacts instead of deleting them.
- `npm run icc:update`
  - Passed.
  - Re-created ULG ICC artifacts from scratch.
  - Reported `207` indexed files and `878` memory chunks.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index-quality --repo ulg --min-lines 200 --limit 30`
  - Passed.
  - Still reported `.mjs` files as `text` with no symbols and
    `ulg-gpu-abi/src/wgsl.js` as a large JavaScript blind spot.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py find-symbol --repo ulg --symbol runMlsMpmResidentStepWithOptionalWebGpu --exact --limit 5`
  - Passed with `0` matches.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py pack-symbols --repo ulg --task "resident MLS-MPM pressure force rows GPU buffer lifetime reset path" --top-k 5 --format markdown`
  - Failed as expected with `No symbols matched the task`.
- Raw index inspection with `jq`
  - Confirmed `.js` files do receive some symbol names.
  - Confirmed `.mjs` files remain classified as `text` with zero symbols.
  - Confirmed chunk search can still find relevant `.js` and `.mjs` content.

## Current Focused Result - 2026-06-12 15:39 AKDT

ULG's repo-local `.icc/` policy files now describe ULG directly instead of
carrying copied sibling-repo wording.

Verified commands:

- `rg -n "eshkol|Eshkol|/home/cos/projects/eshkol|peercompute|PeerCompute|moonlab|MoonLab" .icc/README.md .icc/assistant-goals.yaml .icc/completion-oracles.yaml .icc/production-audit.yaml .icc/ulg_doc_intel.md .icc/modularity-justifications.json`
  - Passed with no matches.
- `python3` JSON parse check for `.icc/modularity-justifications.json` and
  `.icc/ulg_status.json`
  - Passed.
- `python3` YAML parse check for `.icc/assistant-goals.yaml`,
  `.icc/completion-oracles.yaml`, and `.icc/production-audit.yaml`
  - Passed.
- `ruby` YAML parse check for `.icc/assistant-goals.yaml`,
  `.icc/completion-oracles.yaml`, and `.icc/production-audit.yaml`
  - Passed.
- `npm run icc:update`
  - Passed.
  - Reported `207` indexed files and `878` memory chunks.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false`.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:31 AKDT

ULG now has a repo-local `.icc/` configuration and refresh path aligned to the
documented ICC CLI artifact workflow.

Verified commands:

- `npm run icc:update`
  - Passed.
  - Registered ULG with generated/staged output skipped:
    `.git`, `coverage`, `dist`, `docs`, `node_modules`, `playwright-report`,
    `public`, and `test-results`.
  - Refreshed ICC index for repo `ulg`.
  - Refreshed ICC memory for repo `ulg`.
  - Captured ICC status into `.icc/ulg_status.json`.
  - Captured ICC architecture summary into `.icc/ulg_arch_summary.md`.
  - Reported `207` indexed files and `878` memory chunks.
- `EMSDK_QUIET=1 python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - Passed.
  - Reported `is_stale: false` for the current ULG `HEAD`.
- `node --check scripts/update-icc.mjs`
  - Passed.
- `node -e "JSON.parse(require('fs').readFileSync('.icc/ulg_status.json','utf8')); JSON.parse(require('fs').readFileSync('.icc/modularity-justifications.json','utf8')); console.log('json ok')"`
  - Passed.
- `git diff --check`
  - Passed.

## Current Focused Result - 2026-06-12 15:18 AKDT

Resident MLS-MPM reset-path physics continuity is passing. The reset path no
longer collapses continued GPU-resident substeps to zero active grid nodes after
the first moving substep.

Verified commands:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `15/15`.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridUpdateGpuKernel.test.mjs`
  - Passed, `25/25`.
- Custom inline Chromium/WebGPU probe against `https://127.0.0.1:5173/`
  - Passed.
  - After Reset, the continued resident sequence reported active grid nodes
    `[257, 264, 273, 262]`, max displacement
    `[0.1292028725, 0.1061157286, 0.1003902778, 0.1079893708]` meters, and no
    destroyed pressure-force WebGPU buffer warnings.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about 2.2 minutes.

## Local Unit Tests

Command: `npm test`

Current focused result on 2026-06-11 23:54 AKDT: pass after expanding resident
product-event rows with closure-derived mechanics/EOS metadata. Product-event
rows now preserve the original render fields and add velocity, support volume,
bulk/shear/Lame constants, sound speed, EOS model id, solid flag, and mechanics
status. P2G consumes event velocity and local EOS pressure when those fields are
present.

Verified suites:

- `node --check ulg-gpu-abi/src/wgsl.js && node --check ulg-gpu-abi/src/index.js && node --check src/runtime/sph/sphGridGpuKernel.js && node --check src/runtime/sph/sphReactionGpuSummary.js && node --check tests/abi.test.mjs && node --check tests/sphGridGpuKernel.test.mjs && node --check tests/sphReactionGpuSummary.test.mjs`
  passed.
- `node --test tests/abi.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs`
  passed `47/47`.
- Broader focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphGridGpuKernel.test.mjs`
  passed `89/89`.
- `git diff --check` passed.

Previous focused result on 2026-06-11 23:43 AKDT: pass after adding the first
resident product-mass P2G sidecar consumption slice. The P2G CPU reference and
WebGPU binding contract now accept `peercompute.ulg.sph-resident-product-mass.v0`,
bind product-event rows as read-only storage, deposit only positive
`unplacedMassKg` into grid mass, and carry prior resident product mass into the
next repeated resident step before cleanup.

Verified suites:

- `node --check src/runtime/sph/sphGridGpuKernel.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check tests/sphGridGpuKernel.test.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/abi.test.mjs && node --check ulg-gpu-abi/src/wgsl.js`
  passed.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/abi.test.mjs`
  passed `39/39`.
- Broader focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphGridGpuKernel.test.mjs`
  passed `88/88`.
- `git diff --check` passed.
- Infinite Context Coder refreshed after this slice:
  `index --repo ulg` indexed 237 files / 120,191 lines, and
  `build-memory --repo ulg` wrote 1,015 chunks.

Previous focused result on 2026-06-11 23:28 AKDT: pass after adding the
resident product-mass handle. Reaction results and resident MLS-MPM steps now
expose `peercompute.ulg.sph-resident-product-mass.v0`, including retained
product-event buffer metadata, unplaced-mass consumption policy, blocked
EOS/force coupling status, sequence-summary preservation, and guarded
destruction.

Verified suites:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphReactionGpuKernel.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/visualization/sphPhaseScene.js`
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs`
  passed `59/59`.
- Combined focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  passed `76/76`.
- `git diff --check` passed.

Note: `node --test tests/demo.e2e.mjs` was attempted once and failed because
that file is a Playwright test file; it must be run via the Playwright runner,
not Node's test runner.

Previous focused result on 2026-06-11 23:27 AKDT: pass after adding the compact
product-event/product-inventory pressure bridge. Resident gas pressure still
prefers the per-species gas ledger, and now falls back to gas product-event rows
or compact product-inventory rows without full particle readback.

Verified suites:

- `node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/sphPhaseDemo.test.mjs`
- `node --test tests/sphPhaseDemo.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  passed `31/31`.
- Combined focused suite:
  `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  passed `76/76`.
- `git diff --check` passed.
- Infinite Context Coder refreshed after this slice:
  `index --repo ulg` indexed 237 files / 119,369 lines, and
  `build-memory --repo ulg` wrote 1,010 chunks.

Previous focused result on 2026-06-11 23:12 AKDT: pass after adding resident
product-event render-field consumption. The ABI includes a product-event row,
verification readback is optional, normal resident runs
retain the product-event buffer on GPU, the render-field shader binds that
buffer, and unplaced product-event mass can render as generic material/phase
surface volume.

Verified suites:

- `node --check src/visualization/sphPhaseScene.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js`
- `node --check tests/sphPhaseRenderer.test.mjs && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs && node --check tests/sphReactionGpuSummary.test.mjs`
- `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs`
  passed `63/63`.

Previous focused result on 2026-06-11 22:56 AKDT: pass after adding
GPU-resident sparse product-event staging for no-full-readback reaction steps.
Verification readback is optional, normal resident runs retain the product-event
buffer on GPU, and resident diagnostics/overlay rows report product-event
capacity, active rows, buffer bytes, readback bytes, and retention. Focused
ABI/reaction/resident coverage passed `44/44`.

Previous focused result on 2026-06-11 21:55 AKDT: pass after adding the
resident WebGPU reaction compact summary, compact gas/product ledger totals,
per-gas-species resident compact ledger rows, resident sealed-box pressure
plumbing, and sequence-summary preservation. The aggregate summary is a
128-byte f32x4 compact readback, each gas product has a 32-byte f32x4 compact
species row, and normal no-full resident runs still avoid particle-array
readback.

Verified suites:

- `node --check src/runtime/sph/sphReactionGpuSummary.js`
- `node --check src/runtime/sph/sphReactionGpuKernel.js`
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
- `node --check src/runtime/sphPhaseDemo.js`
- `node --check src/visualization/sphPhaseDemoMount.js`
- `node --check src/visualization/sphPhaseScene.js`
- `node --test tests/sphMlsMpmGpuStep.test.mjs` passed `10/10`.
- `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  passed `49/49`.
- `node --test tests/opticalClosure.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphPhaseDemo.test.mjs`
  passed `53/53`.

Previous full-suite result: fail, 359/360 tests on 2026-06-11 after adding the
material resolver manifest scaffold. `node --test
tests/materialResolverManifest.test.mjs` passed `4/4`, and those tests also
passed inside `npm test`. The full suite's single failure was the dirty-tree ABI
expectation in `tests/abi.test.mjs` for `SPH GPU render field ABI exposes
material-phase surface fields`: the current row layout reports
`opticalStateId:f32` where the test still expected `pad0:f32`.

Focused current result on 2026-06-11: pass for the material resolver manifest
scaffold. Verified suites:

- `node --check src/runtime/material/materialResolverManifest.js` passed.
- `node --check tests/materialResolverManifest.test.mjs` passed.
- `node --test tests/materialResolverManifest.test.mjs` passed `4/4`.

Prior full-suite result: pass, 343/343 tests on 2026-06-11 after moving SPH
static table/GPU-warmup cache serialization into the supervised `ulg-runtime`
worker and then wiring warm scene sync to consume rehydrated static table cache
bundles. Static table cache records live in a separate localStorage family so
reaction cold-cache lookups do not parse the large table payload. Focused SPH
browser coverage passed 3/3 against `https://127.0.0.1:5173/`, including the
worker-backed `sph.static-table-cache` write path, a reset/rebuild that reports
`static-table-cache-bundle-hit` in `setParticles()`, and the room-temperature Na
+ H2O path with H2 pressure diagnostics. `npm run build` passed with the
existing Vite large-chunk warning, `npm run build:pages` regenerated the GitHub
Pages artifact in `docs/`, and `git diff --check` passed.

Previous focused result on 2026-06-11: pass after the worker-backed static table
cache and warm scene-consumption slices. Verified suites:

- `node --test tests/sphColdStartCache.test.mjs tests/contract-fixtures.test.mjs`
  passed `7/7`.
- `node --test tests/sphColdStartCache.test.mjs tests/sphPhaseRenderer.test.mjs`
  passed `12/12`.
- `node --test tests/sphPhaseDemo.test.mjs` passed `7/7`.
- `node --test tests/reactiveChemistry.test.mjs` passed `7/7`.
- `node --test tests/reactionDiscovery.test.mjs` passed `8/8`.
- `node --test tests/contract-fixtures.test.mjs tests/sphPhaseRenderer.test.mjs tests/chemistryReactionCandidates.test.mjs`
  passed `16/16`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 npx playwright test --config tests/playwright.config.mjs -g "SPH phase demo"`
  passed `3/3` after the static table cache worker slice.

This focused slice adds resident/worker/scene timing rows, partial material
cache reuse, static thermal/optical/reaction table cache records, `ulg-runtime`
pre-spawn, balanced Na/H2O -> NaOH + H2 CPU reference conversion, stale
reaction-record rejection, sealed-gas pressure diagnostics, and a worker-backed
static table cache coordinator that serializes/rehydrates typed-array cache
payloads off the UI path, and warm scene sync can restore thermal, graph,
phase-response, optical/PBR, and reaction tables from the static cache when
their generator/hash guards pass.

Prior milestone: pass, 328/328 tests on 2026-06-11 after adding explicit
transparent-surface render-order/depth-write policy for the SPH phase renderer.
Focused renderer coverage passed 7/7, focused HTTPS Chromium e2e for the SPH
phase demo passed 1/1 against `https://127.0.0.1:5173/`, `npm run build`
passed with the existing Vite large-chunk warning, and `npm run build:pages`
regenerated the GitHub Pages artifact in `docs/`.

Prior milestone: pass, 327/327 tests on 2026-06-11 after adding resident render
readback cadence/profiling telemetry and disabling the standalone MLS-MPM
mechanics prediction parity readback in the default SPH demo hot loop. Focused
HTTPS Chromium e2e for the SPH phase demo passed 1/1 against
`https://127.0.0.1:5173/`, `npm run build` passed with the existing Vite
large-chunk warning, and `npm run build:pages` regenerated the GitHub Pages
artifact in `docs/`.

Prior milestone: pass, 327/327 tests on 2026-06-11 after extending the resident
MLS-MPM compact GPU summary to include retained thermo-buffer phase masses and
temperature diagnostics. Focused ABI/thermal/reaction/resident coverage passed
40/40, focused HTTPS Chromium e2e for the SPH phase demo passed 1/1 against
`https://127.0.0.1:5173/`, `npm run build` passed with the existing Vite
large-chunk warning, and `npm run build:pages` regenerated the GitHub Pages
artifact in `docs/`.

Prior milestone: pass, 327/327 tests on 2026-06-11 after adding the persistent
SPH thermal response/graph WebGPU upload set and wiring it into resident
thermal plus reaction stages. Focused ABI/thermal/reaction/resident coverage
passed 40/40, focused HTTPS Chromium e2e for the SPH phase demo passed 1/1
against `https://127.0.0.1:5173/`, and `npm run build` passed with the existing
Vite large-chunk warning.

Prior milestone: pass, 326/326 tests on 2026-06-11 after migrating the SPH
reaction product phase reset to the shared thermal phase-response table and
thermal graph bank. Earlier milestone: pass, 134/134 tests on 2026-06-09 after
taking Kohn–Sham DFT all the way to the iron atom (multi-shell Aufbau +
tridiagonal eigensolver). Earlier still: 132/132 after the minimal radial KS-LDA
solver validated on helium.

- Kohn–Sham DFT coverage on 2026-06-09: `node --test tests/radialKohnSham.test.mjs`
  passed `3/3` — the radial KS-LDA solver reproduces helium's total energy
  (−2.823 Ha vs the LDA reference ~−2.83) and 1s orbital energy (−0.563 vs ~−0.57)
  within ~0.3%, a more-charged He-like ion is more tightly bound, and the SCF is
  deterministic.
- Multi-shell / iron KS-LDA coverage on 2026-06-09:
  `node --test tests/atomicKohnSham.test.mjs` passed `2/2` — beryllium
  (−14.41 Ha) and neon (−127.9 Ha) totals match the LDA references with exact
  electron counts, and the all-electron iron atom (Z=26, [Ar]4s²3d⁶) solves to
  exactly 26 electrons, total ~−1258 Ha (non-relativistic, near the LDA reference
  ~−1261), the full 1s..4s,3d shell structure all bound, and 3d below 4s (the
  correct LDA atomic ordering).

- ABI descriptor construction and complex64 round trip.
- JSON schema validation for service manifests, task capsules, closure artifacts,
  quantum response artifacts, simulation artifacts, and tolerance reports.
- Static Eshkol/MoonLab adapter fixtures validate against the shared schemas.
- Service contract builders reproduce the published manifest defaults and emit a
  schema-compatible default MoonLab task capsule.
- MoonLab service asset specs resolve `locateFile("moonlab.wasm")` to the
  `/service-assets/moonlab/moonlab.wasm` convention.
- MoonLab service asset specs declare optional
  `/service-assets/moonlab/magnetar-reference-contracts.json` reference-contract
  JSON while keeping only loader/WASM assets required.
- Eshkol closure-bundle service asset specs resolve manually staged artifact
  JSON, WASM, DOM-free host-import JavaScript, schema snapshot, and bundle
  manifest URLs.
- Service asset probes classify ready, missing, and wrong-MIME loader/WASM
  responses.
- Service asset probes report a missing optional MoonLab reference-contract JSON
  without changing required loader/WASM readiness.
- `npm run stage:service-assets -- --dry-run --json` reports the MoonLab and
  Eshkol source/target plan without mutating the ignored service-asset tree.
- `npm run stage:service-assets -- --moonlab-only` stages the MoonLab compact
  WebGPU parity handoff summary as reduced-scope evidence for the five covered
  operations: `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`, and
  `cnot`; it preserves `fullFidelityMagnetarSimulation = false` and
  `fullPhysicsValidation = false`.
- `npm run stage:service-assets -- --eshkol-only` stages the Eshkol
  production-candidate runtime probe as smoke-only evidence and keeps
  production handler/runtime/full-physics readiness blocked.
- `npm run stage:service-assets -- --eshkol-only --created-at ...` forwards a
  fixed timestamp to Eshkol helpers that support reproducible bundle metadata.
  It now also stages the declared
  `eshkol.ulg.production-handler-contract.v0` production handler contract,
  preserving the `main(i32, i32) -> i32` invocation ABI, tensor input/output
  ids, required evidence, and remaining production/full-physics blockers.
- `npm run stage:service-assets -- --eshkol-only --created-at ...` also stages
  `eshkol.ulg.full-physics-validation-requirements.v0`, preserving the five
  required runtime evidence families, required hash fields, and
  `full-physics-validation-not-run` blocker without marking the production
  handler scientifically validated.
- MoonLab service asset specs include the classic core probe worker URL and the
  manifest builder approves it for child-worker leasing.
- Registry resolution, child-worker lease limits, artifact cache behavior,
  artifact-summary telemetry behavior, and GPU fallback probe behavior.
- Child-worker leases preserve `classic` vs `module` worker type metadata.
- Artifact cache summaries preserve Eshkol closure entry signature,
  start-section, import/export, WASM metadata count, and DOM-free host-import
  bundle metadata.
- Artifact cache summaries preserve Eshkol host-import JavaScript asset status,
  service-worker import factory readiness, production-host candidate
  requirements schema/status, runtime scope, implementation status, and required
  non-stub import count.
- The browser demo handoff exporter returns `peercompute.ulg.demo-handoff.v0`
  records with full closure artifacts, compact summaries, refs, and transferred
  Eshkol WASM bytes.
- Artifact cache summaries preserve Eshkol closure output-semantics metadata for
  the deterministic smoke fixture, including schema, scope, entry export/args,
  expected result, stdout hash/length, and `scientificValidation: false`.
- Artifact cache summaries preserve MoonLab magnetar reference/tolerance
  metadata, including schema, role, contract hash, normalized energy units,
  ground-state bitstring/reference energy, energy tolerance, observed energy
  delta, and validation status.
- Artifact cache summaries de-duplicate legacy `outputs.reference` plus plural
  `outputs.references[]`, count ready output references, and can derive the
  MoonLab magnetar reference summary from the plural array when the calibration
  entry does not carry a singular reference.
- Artifact cache summaries preserve the four-entry MoonLab calibrated
  magnetosphere MHD, PIC kinetic plasma, radiation transport, and relativistic
  correction inventory with four ready/scientific-coverage calibrated entries
  when valid supplied contracts are present.
- Artifact cache summaries preserve Eshkol production dispatch preflight
  metadata, including schema `eshkol.ulg.production-handler-dispatch-preflight.v0`,
  `status = blocked`, `ready = false`, ten required production dispatch
  checks, the declared production handler contract, the production-candidate
  runtime probe, deterministic runtime-smoke stubs rejected for production
  dispatch, production-candidate handler implementation/runtime-execution
  evidence, and the computed `10/9/1` check split.
- Artifact cache summaries preserve Eshkol full-physics validation requirements,
  including `declared-not-run`, `ready = false`, five required runtime evidence
  families, four required hash fields, and the
  `full-physics-validation-not-run` blocker.
- `ClosureRegistry` stores table-interpolation closure artifacts in the
  content-addressed `ArtifactCache`, resolves by closure kind/input/method hash,
  reports in-range/out-of-range/miss validity, emits cache events, and
  invalidates stale closure refs.
- The Phase 1 closure handle samples `table-interpolation` closures for energy
  and `dEdr`, and the CPU-reference carrier runtime advances a two-particle
  oscillator with compact deltas plus invariant drift reports.
- The Phase 2 optional WebGPU carrier path exposes a WGSL compute entrypoint,
  returns CPU when WebGPU is not requested or unavailable, rejects parity drift,
  reports device-lost CPU fallback, and preserves the explicit
  `peercompute.ulg.carrier-webgpu-parity.v0` schema.
- The closure-table WGSL descriptor coverage verifies
  `peercompute.ulg.closure-table-wgsl-descriptor.v0`, deterministic f32x4
  `ClosureTableSample` row layout, explicit false validation flags, stable
  sample-buffer encoding, derivative inference for tables that omit
  derivatives, and rejection of full-physics validation overclaims.
- GPU broker and worker-supervisor coverage verifies device-loss pressure
  reporting, retryable CPU fallback lease marking, and worker-originated
  `gpu-device-lost` telemetry without relaxing task completion.
- Phase 3A topology primitive coverage verifies normalized particle state,
  deterministic spatial hashing, duplicate-free and symmetric neighbor-pair
  queries, closure sampling over graph edges, out-of-range edge reporting,
  antisymmetric pair-force conservation, and parity with the existing two-body
  carrier force convention. The CPU-reference carrier runtime now emits
  edge-message conservation summaries in compact deltas, and the oscillator e2e
  smoke verifies those summaries are visible in compact artifact telemetry and
  the live artifact row as `edge:pass`. These tests preserve explicit false
  scientific/full-physics flags.
- Phase 3A field-observer coverage verifies compact-support scalar observations
  over deterministic neighbor graphs and warning behavior when no contribution
  reaches a particle. It also verifies supplied graph validation,
  symmetric-pair canonicalization, recipient smoothing-length behavior,
  duplicate-position handling, and explicit empty-field rejection. The observer
  summaries preserve explicit false scientific/full-physics flags and do not
  claim SPH/material/EOS readiness.
- The ABI schema coverage now validates
  `peercompute.ulg.simulation-artifact.v0`, and service-contract tests lock the
  `ulg-runtime` service id, `simulation.step` task kind, capabilities, and
  default `simulation-delta` output artifact kind.
- Focused service-asset/orchestration coverage after the host-import import-glue
  slice:
  `node --test tests/orchestration.test.mjs tests/service-assets.test.mjs`
  passed `14/14`.
- Focused carrier-runtime coverage on 2026-06-08:
  `node --test tests/closureRegistry.test.mjs` passed `2/2`,
  `node --test tests/carrierRuntime.test.mjs` passed `2/2`, and
  `node --test tests/abi.test.mjs tests/contract-fixtures.test.mjs` passed
  `7/7`.
- Focused WebGPU carrier-runtime coverage on 2026-06-08:
  `node --test tests/webgpuCarrierKernel.test.mjs` passed `7/7`, and
  `node --test --test-name-pattern "GPU broker|WorkerSupervisor records gpu-device-lost" tests/orchestration.test.mjs`
  passed `3/3`.
- Focused closure-table WGSL descriptor coverage on 2026-06-08:
  syntax checks for `ulg-gpu-abi/src/index.js`, `ulg-gpu-abi/src/wgsl.js`,
  `src/runtime/webgpuCarrierKernel.js`, `tests/abi.test.mjs`, and
  `tests/webgpuCarrierKernel.test.mjs` passed; `node --test
  tests/abi.test.mjs tests/webgpuCarrierKernel.test.mjs
  tests/carrierRuntime.test.mjs` passed `14/14`; `npm test` passed `54/54`;
  `npm run build` passed with the existing large chunk warning; `npm run
  test:e2e` passed `2/2`; and `npm run status:live -- --bridge` preserved the
  default MoonLab/Eshkol two-artifact handoff and Multiscale bridge ack
  `handoff-ready`.
- Focused oscillator closure-artifact descriptor surface coverage on
  2026-06-08:
  syntax checks for `src/runtime/demoRuntime.js` and `tests/demo.e2e.mjs`
  passed; `node --test tests/abi.test.mjs tests/webgpuCarrierKernel.test.mjs
  tests/carrierRuntime.test.mjs` passed `14/14`; and `npm run test:e2e -- --grep
  "ULG oscillator demo"` passed `1/1` while verifying
  `tableDescriptor.wgslTableDescriptor` and `execution.wgslTableDescriptor`.
  The follow-up full regression passed `npm test` (`54/54`), `npm run build`,
  full Playwright e2e (`2/2`), `npm run status:live -- --bridge`, and
  `git diff --check`.
- Focused closure refresh-request coverage on 2026-06-08:
  syntax checks for `src/runtime/fieldClosureSamples.js`,
  `src/runtime/ClosureRegistry.js`, `src/runtime/artifactSummary.js`,
  `src/runtime/webgpuCarrierKernel.js`, `src/main.js`, and related tests passed;
  `node --test tests/fieldClosureSamples.test.mjs tests/carrierRuntime.test.mjs
  tests/webgpuCarrierKernel.test.mjs` passed `16/16`, including out-of-range
  field sampling, `ClosureRegistry.applyRefreshRequest()` invalidation, in-range
  no-op preservation, compact artifact summary fields, and CPU/WebGPU delta
  contract parity. The follow-up full regression passed `npm test` (`56/56`),
  `npm run build`, full Playwright e2e (`2/2`), `npm run status:live --
  --bridge`, and `git diff --check`.
- End-to-end closure refresh path coverage on 2026-06-08 (recommended-work
  item 1): `node --test tests/carrierRuntime.test.mjs` passed `5/5` (added:
  carrier run halts on a closure-domain exit and surfaces a
  `closure-refresh-request.v0` with status `refresh-recommended`,
  `sourceKind: carrier-runtime-closure-domain-exit`, and all
  scientific/material/EOS/SPH/phase flags false; an in-range run reports no
  domain exit). New `node --test tests/closureRefreshPath.test.mjs` passed `2/2`:
  a domain-exit simulation artifact drives
  `ClosureRegistry.applyRefreshRequest()` invalidation, emits a content-addressed
  `closure-invalidation-artifact.v0` (non-overclaiming, with simulation parent
  ref) and the `closure-invalidated` event, and a later resolve misses; an
  in-range simulation leaves the closure valid and emits no artifact. Full
  regression: `npm test` `60/60`, `npm run build`, `npm run test:e2e` `2/2`, and
  `git diff --check` clean. `npm run status:live -- --bridge` ULG live status
  healthy on 0.0.0.0:5173; bridge ack not re-confirmed because the PeerCompute
  Multiscale 5185 server was down in this environment (bridge/handoff envelope
  untouched by this change).
- Opt-in ULG runtime handoff coverage on 2026-06-08 (recommended-work item 3):
  new `node --test tests/ulgRuntimeHandoff.test.mjs` passed `2/2` —
  `createUlgRuntimeHandoff` includes only `ulg-runtime`/`ulg-runtime-fixture`
  artifacts, surfaces `wgslTableDescriptor` on the closure entry, classifies the
  `closure-invalidation` artifact distinctly, and pulls MoonLab/Eshkol ancestors
  only when `includeAncestors` is set. The default handoff/bridge path is
  unchanged.
- Closure rederivation loop coverage on 2026-06-08 (recommended-work item 4):
  `node --test tests/closureRefreshPath.test.mjs` passed `4/4` — domain exit →
  invalidate → opt-in rederive re-registers a closure whose expanded domain
  covers the offending input and resolves in-range there, emitting a
  content-addressed `closure-rederivation-artifact.v0` with old→new lineage and
  all scientific/material/EOS/SPH/phase flags false; plus a guard test that no
  rederivation occurs unless opted in. Full regression: `npm test` `64/64`,
  `npm run build`, `npm run test:e2e` `2/2`, `git diff --check` clean. The live
  two-server ULG→Multiscale handoff smoke was re-confirmed (exit 0, `handoff
  ready / blockers 0`, default 2-artifact handoff) with Multiscale on
  localhost:5185.
- SPH phase demo thermodynamic preflight coverage on 2026-06-08 (first physics
  slice): new `node --test tests/thermoPreflight.test.mjs` passed `6/6` —
  iron cube is 1/8 the ice volume (0.125 m^3, 875 kg) with ice 917 kg and air
  ~1512 kg; cold infinite reservoirs make cold solid iron + ice feasible with
  ~864 MJ exported to the walls (144 MJ/face) and the iron able to melt but not
  boil all the ice; an adiabatic sealed box reaches a ~352.6 K mixed equilibrium
  and is correctly reported INFEASIBLE (as are walls set >= freezing); and the
  preflight + its ABI artifact never overclaim (`closureBacked` and all
  scientific/material/EOS/SPH/phase flags false). Full regression: `npm test`
  `70/70`, `npm run build`, `git diff --check` clean.
- SPH phase demo P1/P2/P3 coverage on 2026-06-08: new
  `node --test tests/sphPhaseContracts.test.mjs` passed `6/6` (closure family
  schemas, the overclaim guard rejecting validation flags without evidence refs,
  six-face wall guard, resolution mass invariant, phase-equilibrium/conservation
  builders) and `node --test tests/materialThermo.test.mjs` passed `7/7`
  (reference closures non-overclaiming and citing pending microphysics; closure
  energy == reference energy; phase-equilibrium lever rule at the melt plateau;
  MaterialRegistry density/phase/energy sampling; out-of-domain sampling emits a
  refresh request; closure-backed preflight reproduces the reference path and
  blocks with a refresh request when iron starts above the Fe closure domain).
  Full regression: `npm test` `83/83`, `npm run build`, `git diff --check` clean.
- SPH phase demo P4 conservative carrier coverage on 2026-06-08: new
  `node --test tests/sphCarrier.test.mjs` passed `5/5` — cubic-spline kernel
  support, symmetric pressure forces conserving momentum to round-off, an
  inviscid run conserving total energy (<1% drift) and momentum (<1e-9) with
  exact mass, particle phase emerging from specific internal energy, and the SPH
  simulation artifact staying evidence-only. Full regression: `npm test`
  `88/88`, `npm run build`, `git diff --check` clean.
- MoonLab microphysics reference coverage on 2026-06-08: new
  `node --test tests/microphysics.test.mjs` passed `4/4` — the H2 dissociation
  curve (exact diagonalization of MoonLab's molecular Hamiltonian) yields an
  equilibrium bond length of 0.7414 A (experiment ~0.741) within ~4.9 mHa of the
  FCI reference and a ~3.87 eV bond energy; the H2 reference is
  produced-quantitative and the H2O reference produced-model-not-quantitative,
  both non-overclaiming; and the H2O material closure cites the produced
  reference (status produced) while materialValidation stays false (fe/air still
  pending). Full regression: `npm test` `92/92`, `npm run build`,
  `git diff --check` clean.
- ULG SPH phase demo coverage on 2026-06-08: `node --test
  tests/sphPhaseDemo.test.mjs` passed `3/3` (cold-ice-on-hot-iron initial build,
  phase/temperature from closure energy, preflight feasible + bounded stepping
  inside the sealed box) and `node --test tests/radiationClosure.test.mjs` passed
  `4/4` (blackbody colour follows the Planck locus — molten iron orange, blue
  rising to white; cold matter non-incandescent / flagged placeholder; radiation
  closure closureBacked but opticalValidation false). Full regression `npm test`
  `99/99`, `npm run build`. A headless browser check on `127.0.0.1:5173` confirmed
  the SPH Phase overlay opens, preflight-feasible, 280 particles, no console
  errors, iron glowing with the derived blackbody colour.
- First-principles material closure coverage on 2026-06-09: new
  `node --test tests/statisticalMechanics.test.mjs` passed `4/4` (air equipartition
  cv≈715/cp≈1002/γ≈1.40, Debye reaches Dulong–Petit at high T and falls below it
  at low T, iron θ_D≈470 K from sound speed + density, Debye dU/dT = cv) and
  `node --test tests/opticalClosure.test.mjs` passed `4/4` (flat reflectance →
  white/black, Drude metal high+flat reflectance, iron warm grey + water/ice blue
  + air near-transparent, optical closure non-overclaiming). The
  materialThermo/closure-backed-preflight tests were updated for the
  first-principles values (iron solid now Debye; closure-backed heat-to-walls
  ~845 MJ vs the constant-cp baseline 864 MJ, consistent on masses + feasibility).
  Full regression `npm test` `107/107`, `npm run build`, and a headless render
  check (ice blue, molten iron orange glow, no console errors).
- Material EOS + latent-heat coverage on 2026-06-09: new
  `node --test tests/materialEos.test.mjs` passed `7/7` — Grüneisen linear thermal
  expansion of iron 1.18e-5/K, ρ(T) drop toward melting (~7469 at 1800 K),
  Richards L_fus within ~10% for iron, Trouton underestimating water L_vap (flagged
  as associated-liquid, not faked), Clausius–Clapeyron boiling depression, the
  MaterialRegistry returning a temperature-dependent iron density, and the EOS
  closure non-overclaiming (eosValidation false). The closure-backed preflight
  test was updated: Debye + Richards corrections nearly cancel (~865 MJ vs the
  864 MJ baseline). Full regression `npm test` `114/114`, `npm run build`,
  `git diff --check` clean.
- General MD statistical-mechanics engine coverage on 2026-06-09: new
  `node --test tests/mdEngine.test.mjs` passed `3/3` — on a generic Lennard-Jones
  (argon-like) system the engine recovers equipartition (measured T tracks the
  thermostat), the ideal-gas law PV = N kB T at low density from the virial
  pressure (within 10%), and a monatomic heat capacity (3/2) N kB from dE/dT
  (within 15%) — all measured uniformly with the potential as the only
  per-material input, no analytic per-material model. Full regression `npm test`
  `117/117`, `npm run build`.
- Condensed-phase MD estimator coverage on 2026-06-09: new
  `node --test tests/mdCondensed.test.mjs` passed `3/3` — diffusion (MSD)
  distinguishes a cold LJ solid from a hot liquid; the EOS scan shows pressure
  rising under compression with a positive bulk modulus and density increasing
  with pressure; the melting scan shows potential energy + diffusion jumping
  across the transition. All measured uniformly from the one engine.
- Ab-initio → potential pipeline coverage on 2026-06-09: new
  `node --test tests/potentialFitting.test.mjs` passed `3/3` — the Morse fit to
  MoonLab's H2 dissociation curve recovers r_e = 0.7414 Å and D_e = 3.87 eV with
  zero force at r_e, the fitter round-trips a known Morse potential, and the
  fitted potential drives the MD engine as a bound pair. Full regression
  `npm test` `123/123`, `npm run build`.
- Periodic electronic-structure coverage on 2026-06-09: new
  `node --test tests/electronicStructure.test.mjs` passed `5/5` — the uniform
  electron gas reproduces the exact Thomas–Fermi kinetic and Dirac exchange and
  matches Ceperley–Alder QMC correlation within ~3% (r_s = 1, 2, 5); jellium
  cohesion derives sodium's equilibrium density (955 vs 971 kg/m^3) and bulk
  modulus (7.0 vs 6.3 GPa) from electronic structure with one pseudopotential
  radius; and a bare point ion overbinds (r_s ≈ 1.6), confirming the empty core is
  physically required. Full regression `npm test` `128/128`, `npm run build`.
- Focused Phase 3A topology primitive coverage on 2026-06-08:
  `node --test tests/carrierRuntime.test.mjs tests/spatialHash.test.mjs tests/edgeMessages.test.mjs tests/webgpuCarrierKernel.test.mjs`
  passed `17/17`.
- Focused Phase 3A field-observer coverage on 2026-06-08:
  `node --test tests/observers.test.mjs tests/spatialHash.test.mjs tests/edgeMessages.test.mjs`
  passed `12/12`.
- Focused Phase 3A field-observer carrier-surface coverage on 2026-06-08:
  `node --test tests/carrierRuntime.test.mjs tests/observers.test.mjs tests/webgpuCarrierKernel.test.mjs`
  passed `15/15`, `npm test` passed `49/49`, `npm run build` passed with the
  existing large chunk warning, and `npm run test:e2e` passed `2/2` with
  delta-level `peercompute.ulg.field-observer-summary.v0`, compact
  `simulationFieldObserver*` summary fields, and visible `field:pass`.
- Focused Phase 3A field-closure sample coverage on 2026-06-08:
  `node --test tests/fieldClosureSamples.test.mjs tests/carrierRuntime.test.mjs tests/observers.test.mjs tests/webgpuCarrierKernel.test.mjs`
  passed `19/19`, including standalone observed-field closure sampling,
  sampled-output bounds, out-of-range and null-field warning behavior, carrier
  delta summaries, WebGPU fallback delta summaries, and accepted WebGPU parity
  delta summaries. `npm test` passed `53/53`, `npm run build` passed with the
  existing large chunk warning, `npm run test:e2e` passed `2/2` with visible
  `closure-field:pass`, and `npm run status:live -- --bridge` preserved the
  default two-artifact MoonLab/Eshkol handoff and Multiscale bridge ack
  `handoff-ready`.

## Current Handoff Validation Summary

Validation run on 2026-06-07 after surfacing Eshkol's declared full-physics
validation requirements:

- `npm run stage:service-assets -- --eshkol-only --created-at
  2026-06-07T00:04:00-08:00`: passed and staged
  `eshkol.ulg.production-handler-contract.v0`,
  `eshkol.ulg.production-handler-implementation.v0`, and
  `eshkol.ulg.production-handler-runtime-execution.v0`, plus
  `eshkol.ulg.full-physics-validation-requirements.v0`.
- `node --test tests/orchestration.test.mjs --test-name-pattern "artifact
  cache summarizes Eshkol"`: passed, `7/7`.
- `npm test`: passed, `22/22`.
- `npm run build`: passed with the existing Vite large chunk warning.
- `npm run test:e2e`: passed, `1/1` Chromium test.
- `npm run status:live -- --bridge`: passed; live ULG on
  `http://100.86.83.35:5173/` reports
  `productionHandlerContractDeclared = true`,
  `productionHandlerContractInvocationArgumentMode = linear-memory-offsets`,
  `productionHandlerContractRequiredEvidenceCount = 8`,
  `fullPhysicsValidationRequirementsDeclared = true`,
  `fullPhysicsValidationRequiredRuntimeEvidenceCount = 5`, and production
  dispatch preflight counts `10/9/1`.

The MoonLab compact WebGPU parity handoff remains reduced-scope evidence for
five operations only. The Eshkol production-candidate runtime probe, handler
implementation, runtime execution, and full-physics requirements remain
deterministic tensor smoke / declared requirement evidence. Production dispatch
preflight records `10/9/1`; it does not promote scientific validation,
full-fidelity magnetar simulation, or full-physics validation.

## Carrier Runtime Validation Summary

Validation run on 2026-06-08 after adding the Phase 1 CPU-reference carrier
runtime:

- `node --check` passed for `ClosureRegistry.js`, `closureHandle.js`,
  `invariants.js`, `carrierRuntime.js`, `ulgRuntime.worker.js`,
  `demoRuntime.js`, `closureRegistry.test.mjs`, and `carrierRuntime.test.mjs`.
- `node --test tests/closureRegistry.test.mjs`: passed, `2/2`.
- `node --test tests/carrierRuntime.test.mjs`: passed, `2/2`.
- `node --test tests/abi.test.mjs tests/contract-fixtures.test.mjs`: passed,
  `7/7`.
- `npm test`: passed, `27/27`.
- `npm run build`: passed with the existing Vite large chunk warning and emitted
  bundled `ulgRuntime.worker`.
- `npm run test:e2e`: passed, `2/2`; the second browser smoke calls
  `window.__ulgDemo.runOscillatorDemo()`, verifies cached closure validity,
  `peercompute.ulg.simulation-artifact.v0`, CPU-reference execution, invariant
  pass status, 32 deltas, false scientific/full-physics flags, and visible
  `simulation:carrier-toy` telemetry.
- `npm run status:live -- --bridge`: passed against
  `http://100.86.83.35:5173/`, preserving the default two-artifact
  Eshkol/MoonLab magnetar handoff and `handoff-ready` Multiscale ack.

## Production Build

Command: `npm run build`

Current result: pass on 2026-06-08 after the carrier-runtime slice, with the
existing Vite large chunk warning.

## Browser Smoke

Command: `npm run test:e2e`

Current result: pass, 2/2 Chromium tests on 2026-06-08 after the
carrier-runtime slice.

- Load the Vite app through Playwright.
- Verify two supervised services register and run.
- Verify worker telemetry appears.
- Verify MoonLab service telemetry includes non-skipped asset probe status.
- Verify the published MoonLab service/task fixtures can be consumed by a browser
  worker and resolve the expected `locateFile` WASM URL.
- Runtime artifact readiness check on 2026-06-05: copied generated MoonLab core
  `moonlab.js` and `moonlab.wasm` into ignored `public/service-assets/moonlab/`;
  `curl -I` returned `text/javascript` for JS and `application/wasm` for WASM;
  a Playwright telemetry probe reported MoonLab `assetProbe.status = ready`.
- Runtime core probe check on 2026-06-05: with copied MoonLab assets present,
  Playwright verified the supervised MoonLab artifact method
  `moonlab-wasm-bell-phi-plus-probe`, `coreProbe.status = ready`, validation
  `pass`, and Bell `phi_plus` probabilities close to `[0.5, 0, 0, 0.5]`.
- Runtime parity artifact check on 2026-06-05: with copied MoonLab assets
  present, Playwright verifies
  `peercompute.ulg.quantum-response-descriptor.v0`,
  `peercompute.ulg.quantum-response-parity.v0`, a passing
  `moonlab-wasm-core` comparison, and an explicit unsupported `moonlab-webgpu`
  comparison for the still-missing browser WebGPU parity kernel.
- Live VPN check on 2026-06-05: `http://100.86.83.35:5173/` returned the same
  MoonLab artifact method, core probe status, validation status, and Bell
  probability vector through `window.__ulgDemo.artifactCache`.
- Runtime magnetar calibration check on 2026-06-05: with copied MoonLab assets
  present, Playwright verifies
  `peercompute.ulg.magnetar-dipole-ising-calibration.v0` under the MoonLab
  artifact's `calibrationArtifacts.magnetarDipoleIsing`, passing WASM-vs-JS
  Ising energy parity with `groundState.bitString = "000"`,
  `maxEnergyDelta = 0`, and `evaluatedBitstrings = 8`.
- Runtime magnetar reference check on 2026-06-06: with copied MoonLab assets
  present, Playwright verifies `outputs.reference` carries
  `moonlab.magnetar-dipole-ising-reference.v0`, role
  `peercompute-reference-tolerance-input`, contract hash
  `sha256:f85763af06f271c414d55e29884ee7b0d5738a4a7ec9351493964b98f8d4e1ec`,
  energy units `normalized-ising`, ground state `000`, reference energy
  `-1.6712962962963`, tolerance `1e-9`, zero observed energy delta, and passing
  reference validation.
- Runtime plural reference check on 2026-06-06: with copied MoonLab assets
  present, Playwright verifies `outputs.reference` still carries the ready
  dipole-Ising compatibility contract while `outputs.references[]` carries the
  calibrated family inventory.
- Runtime calibrated reference inventory check on 2026-06-06: with copied
  MoonLab assets present, Playwright verifies `outputs.references[]` carries the
  scoped analytic `magnetosphere-mhd` dipole-field reference plus staged reduced
  PIC kinetic plasma, radiation transport, and relativistic correction supplied
  contracts. All four calibrated entries report ready/scientific coverage when
  the optional JSON is present; the test still accepts blocked placeholders when
  the optional JSON is absent.
- Runtime optional MoonLab reference-contract asset check on 2026-06-06:
  Playwright verifies the MoonLab service asset probe reports
  `referenceContractModule` for
  `/service-assets/moonlab/magnetar-reference-contracts.json` as
  `required: false`; when the file is absent behind Vite's HTML fallback, the
  service remains `ready` and the core probe records optional
  `referenceContracts.status = "missing"`.
- Live VPN calibrated inventory check on 2026-06-06:
  `http://100.86.83.35:5173/` reported four raw
  `outputs.references[]` entries for magnetosphere MHD, PIC kinetic plasma,
  radiation transport, and relativistic correction, compact
  `outputReferenceCount = 5`, `outputReferenceReadyCount = 5`,
  `magnetarCalibratedReferenceCount = 4`, and four calibrated ready/scientific
  coverage entries.
- Live VPN ULG-to-PeerCompute magnetar handoff check on 2026-06-06:
  ULG exported two handoff artifacts: MoonLab with
  `outputReferenceReadyCount = 5` and
  `magnetarCalibratedReferenceReadyCount = 4`, and Eshkol with
  `closureReady = true`, `wasmByteLength = 33907`. PeerCompute accepted the
  handoff as `handoff-ready`, `2/2` required handoffs ready,
  `scientific-tolerance-suite-ready`, and then recorded five proxy-only runtime
  evidence entries with five SHA-256 evidence hashes, five proxy-validation
  passes, `observedCount = 5`, `proxyOnlyCount = 5`, `validatedCount = 0`, and
  the remaining blocker `proxy-runtime-not-scientific`.
- Live VPN stricter PeerCompute runtime-gate check on 2026-06-06:
  after local PeerCompute commit `c0610ca7`, a fresh browser probe still reports
  `handoff-ready`, `scientific-tolerance-suite-ready`, five proxy-validation
  passes, five SHA-256 runtime evidence hashes, `validatedCount = 0`, and
  scientific runtime gate blocker `proxy-runtime-not-scientific`.
- Service-asset staging command check on 2026-06-06:
  `npm run stage:service-assets` copied MoonLab `moonlab.js`, `moonlab.wasm`,
  generated the normalized `magnetar-reference-contracts.json` suite,
  regenerated the Eshkol `hello` closure bundle with
  `eshkol.ulg.closure-output-semantics.v0`, and `npm run test:e2e` stayed green
  afterward.
- Normalized MoonLab reference suite staging check on 2026-06-06:
  `npm run stage:service-assets -- --moonlab-only --dry-run --json`,
  `npm run stage:service-assets -- --moonlab-only`,
  `npm run stage:service-assets -- --dry-run --json`, and
  `npm run stage:service-assets` passed. The generated browser asset reports
  schema `moonlab.magnetar.normalized-reference-suite.v0`, status
  `reference-contract-suite-ready`, top-level `ready: true`, and four ready
  calibrated references.
- Live VPN normalized-suite and descriptor-closure handoff check on 2026-06-06:
  after generated-suite staging and Eshkol `magnetar-closure` descriptor
  staging, ULG exported MoonLab `outputReferenceReadyCount = 5`,
  `magnetarCalibratedReferenceReadyCount = 4`, and Eshkol
  `wasmByteLength = 53066`. PeerCompute accepted the handoff as `handoff-ready`,
  reported `scientific-tolerance-suite-ready`,
  `transferredWasmByteLength = 53066`, descriptor probe ready, no host-runtime or
  output-semantics execution claim for the descriptor path, five proxy-only
  runtime evidence entries after refresh, and the intended blocker
  `proxy-runtime-not-scientific`.
- Live VPN reduced calibrated runtime evidence check on 2026-06-06:
  after PeerCompute commits `d0dbe1f5` and `df4ea25a`,
  `window.__multiscaleDemo.refreshScenarioCalibratedRuntimeEvidence()` on
  `https://100.86.83.35:5185/?scenario=magnetar` reported
  `manifestEntryCount = 5`, `manifestScientificExecution = true`,
  `runtime-evidence-ready`, `scientificExecution = true`,
  `validatedCount = 5`, `missingCount = 0`, `proxyOnlyCount = 0`,
  `scientific-runtime-ready`, `scenarioScientificReady = true`, and no blockers
  after applying the live ULG handoff from `http://100.86.83.35:5173/`.
- Live VPN durable service-envelope check on 2026-06-06: after PeerCompute
  commit `fbcc4f17`, the live ULG handoff from
  `http://100.86.83.35:5173/` and PeerCompute
  `https://100.86.83.35:5185/?scenario=magnetar` returned
  `peercompute.ulg.handoff-service-envelope.v0` with `ready = true`,
  `status = service-envelope-ready`, `artifactCount = 2`,
  `relaySafeArtifactCount = 2`, `contentAddressedArtifactCount = 2`, no
  envelope blockers, Eshkol transferred WASM length `53066`, and the reduced
  calibrated runtime gate still at `runtime-evidence-ready`,
  `validatedCount = 5`, `scientific-runtime-ready`,
  `scenarioScientificReady = true`, and no blockers after awaited calibrated
  runtime refresh.
- Live VPN Eshkol descriptor-binding check on 2026-06-06: after Eshkol commit
  `31cbbfc` and `npm run stage:service-assets -- --eshkol-only`, the live ULG
  handoff preserved `eshkol.ulg.magnetar-closure-descriptor-binding.v0`, named
  `peercompute.ulg.handoff-service-envelope.v0`, carried MoonLab suite hash
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  reported four closure-surface sample ids, kept
  `descriptor-bound-not-executed` / `declared-not-executed`, preserved
  `scientificValidation = false`, and still gave PeerCompute
  `service-envelope-ready`, `runtime-evidence-ready`, `validatedCount = 5`,
  `scientific-runtime-ready`, `scenarioScientificReady = true`, and no blockers.
- PeerCompute envelope-backed service-host check on 2026-06-06: after commit
  `2776682d`, focused service-orchestration coverage passed `14/14`, proving
  `UlgHandoffServiceHost` can run under `WorkerSupervisor`, accept a raw ULG
  handoff task, emit `peercompute.ulg.handoff-service-result.v0`, and store the
  durable `peercompute.ulg.handoff-service-envelope.v0` artifact through the
  supervisor artifact cache.
- PeerCompute envelope-backed service-dispatch check on 2026-06-06: after
  commit `22feae0b`, `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `15/15`, proving
  durable ULG handoff envelopes derive
  `peercompute.ulg.handoff-service-dispatch-plan.v0`, map MoonLab and Eshkol
  artifact refs to concrete service tasks, preserve relay-safe/content-addressed
  refs and transferred Eshkol WASM metadata, optionally execute through an
  injected service executor, and cache dispatch plan/result metadata beside the
  envelope.
- Eshkol production dispatch preflight check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, `npm run test:e2e`, and
  `npm run status:live -- --bridge` passed. The live Eshkol status reports
  `productionDispatchPreflightStatus = blocked`,
  `productionDispatchPreflightReady = false`,
  required production runtime ABI
  `wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0`,
  rejected runtime scope `deterministic-runtime-smoke-stubs`, and current
  blocker `full-physics-validation-not-run`.
- Earlier Eshkol production dispatch preflight computed-evidence check on
  2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, `npm run test:e2e`, `git diff --check`, and
  `npm run status:live -- --bridge` passed. The live ULG status reports
  `productionDispatchPreflightCheckSummarySchema =
  eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0`,
  `productionDispatchPreflightTotalRequiredCheckCount = 8`,
  `productionDispatchPreflightPassedCheckCount = 4`, and
  `productionDispatchPreflightBlockedCheckCount = 4`. Passed checks are module
  hash, entry signature, f64 tensor memory binding, and production smoke-stub
  rejection; blocked checks are non-stub host imports, handler readiness,
  runtime execution, and full-physics validation. This count has since been
  superseded by later production-handler contract and runtime evidence slices.
  durable envelope.
- Magnetar fidelity/runtime scope gate on 2026-06-06:
  `npm run stage:service-assets`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed after adding
  `ulg.magnetar.fidelity-runtime-scope.v0` to MoonLab reference summaries and
  Eshkol descriptor-binding summaries. A strict live ULG `5173` to PeerCompute
  `5185` browser probe then reported `runtime-evidence-ready`,
  `validatedCount = 5`, `proxyOnlyCount = 0`, `missingCount = 0`,
  `scientificReady = true`, no blockers, tolerance-scope readiness for
  `pic-kinetic-plasma`, and explicit `fullFidelityMagnetarSimulation = false`
  plus `fullPhysicsValidation = false` in the calibrated runtime scope.
- PeerCompute registry-backed dispatch executor check on 2026-06-06: after
  commit `ae67d31e`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  `createUlgHandoffSupervisorServiceExecutor()` can submit dispatch tasks to
  registered `moonlab-ulg-fixture` and `eshkol-ulg-fixture` service hosts under
  the same `WorkerSupervisor`, preserve nested service task/result metadata,
  and still cache the parent durable envelope plus dispatch plan/result.
- PeerCompute materialized dispatch payload check on 2026-06-06: after commit
  `697f8d8b`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  supervisor-submitted dispatch tasks carry
  `peercompute.ulg.handoff-dispatch-artifact-payload.v0` with MoonLab
  quantum-response summaries and Eshkol closure bodies plus transferred WASM
  bytes for registered service adapters.
- PeerCompute dispatch service-adapter check on 2026-06-06: after commit
  `4d45714b`, full `node --test
  peercompute/tests/unit/serviceOrchestration.test.js` passed `16/16`, proving
  exported `UlgDispatchServiceHost` MoonLab/Eshkol adapters validate materialized
  dispatch payloads, request/release supervised child leases, emit typed dispatch
  service results/artifacts, and cache nested acceptance artifacts beside the
  parent durable handoff envelope.
- Live VPN Multiscale dispatch adapter-worker check on 2026-06-06: after
  PeerCompute commit `c198326c`, `window.__multiscaleDemo.runUlgDispatchServiceAdapterProbe(handoff)`
  on `https://100.86.83.35:5185/?scenario=magnetar` returned
  `peercompute.multiscale.ulg-dispatch-service-adapter-probe.v0`,
  `dispatch-adapters-ready`, `ready = true`, `dispatchCount = 2`,
  `executedDispatchCount = 2`, `acceptedDispatchCount = 2`,
  `failedDispatchCount = 0`, nested dispatch artifact refs for
  `moonlab-ulg-fixture` and `eshkol-ulg-fixture`, MoonLab
  `magnetarDipoleIsingReady = true`, Eshkol `wasmByteLength = 53066`, and no
  blockers.
- Live VPN dispatch adapter-probe check on 2026-06-06: after PeerCompute commit
  `0eae0a68`, the same adapter-worker probe returned MoonLab probe schema
  `peercompute.ulg.moonlab-dispatch-payload-probe.v0` with `probeStatus = pass`
  and Eshkol probe schema `peercompute.ulg.eshkol-dispatch-wasm-probe.v0` with
  `moduleCompiled = true`, `importCount = 33`, `exportCount = 1`,
  `hasEntryExport = true`, Eshkol `wasmByteLength = 53066`, and no blockers.
- Live VPN descriptor-contract adapter check on 2026-06-06: after PeerCompute
  commit `7cae7660`, the live ULG handoff still returned
  `dispatch-adapters-ready` with Eshkol `moduleCompiled = true`,
  `importCount = 33`, `exportCount = 1`, and descriptor contract status
  `descriptor-contract-ready`. A synthetic descriptor-only handoff through the
  same browser Worker API returned `eshkol.ulg.closure.descriptor-bind`,
  `hasTransferredWasmBytes = false`, probe mode
  `descriptor-contract-metadata-only`, `moduleCompiled = false`,
  tensor/table contract matches, MoonLab reference count `4`, runtime status
  `declared-not-executed`, and no blockers.
- Live VPN Eshkol host-runtime dry-probe check on 2026-06-06: after PeerCompute
  commit `b00ac043`, the live ULG handoff returned `dispatch-adapters-ready`
  with Eshkol `moduleCompiled = true`, `importCount = 33`, `exportCount = 1`,
  descriptor contract status `descriptor-contract-ready`, host-runtime probe
  status `host-runtime-dry-probe-ready`, `instantiated = true`, `30` function
  stubs plus memory/global/table stubs, `stubCallCount = 0`,
  `mainInvoked = false`, `scientificExecution = false`, and no blockers.
- Live VPN gated smoke-execution check on 2026-06-06: after PeerCompute commit
  `8259ecb6`, the live magnetar descriptor handoff still returned
  `dispatch-adapters-ready` with host-runtime dry probe ready and
  `hostRuntimeExecution = null`, `mainInvoked = false`, and
  `scientificExecution = false`. A synthetic smoke-output-semantics handoff
  returned `dispatch-adapters-ready`, host-runtime execution status
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `entryResult = 0`, output-semantics validation ready, and
  `scientificExecution = false`.
- Live VPN Multiscale dispatch-plan API check on 2026-06-06: after PeerCompute
  commit `fa33b97f`, a browser probe waited for ULG
  `artifactCache.list().length >= 2`, exported
  `peercompute.ulg.demo-handoff.v0` with `quantum-response` and `closure`
  artifacts plus Eshkol `wasmByteLength = 53066`, then verified
  `window.__multiscaleDemo.applyUlgDemoHandoffForScenario(handoff)` and direct
  `window.__multiscaleDemo.createUlgHandoffServiceDispatchPlan(handoff)` both
  returned `peercompute.ulg.handoff-service-dispatch-plan.v0`,
  `dispatch-ready`, `dispatchCount = 2`, `readyDispatchCount = 2`, service ids
  `moonlab-ulg-fixture` and `eshkol-ulg-fixture`, task kinds
  `moonlab.ulg.quantum-response.ingest` and
  `eshkol.ulg.closure-artifact.ingest`, Eshkol dispatch WASM byte length
  `53066`, and no dispatch blockers.
- Live VPN digest-addressed artifact-ref check on 2026-06-06: after hardening
  ULG `ArtifactCache`, `npm test` passed `18/18`, `npm run build` passed with
  the existing large chunk warning, `npm run test:e2e` passed `1/1`, and a live
  browser probe showed both exported handoff refs as
  `artifact://sha256:<64 hex>` with matching `artifactHash` values. The
  Multiscale dispatch plan stayed `dispatch-ready`, `dispatchCount = 2`,
  `readyDispatchCount = 2`, and reported `digestAddressed = true` for both
  MoonLab and Eshkol dispatches with no blockers.
- Artifact-summary telemetry check on 2026-06-05: Playwright verifies the
  MoonLab artifact telemetry record carries
  `peercompute.ulg.artifact-summary.v0`, magnetar readiness `true`, ground state
  `000`, `maxEnergyDelta = 0`, and `evaluatedBitstrings = 8` without fetching
  the full artifact body.
- MoonLab reference artifact-summary check on 2026-06-06: Playwright verifies
  `peercompute.ulg.artifact-summary.v0` exposes the same reference schema, hash,
  units, ground-state reference energy, tolerance, observed energy delta, and
  pass status without fetching the full artifact body.
- MoonLab plural reference artifact-summary check on 2026-06-06: Playwright
  verifies compact telemetry reports output reference count/ready count and a
  compact plural reference summary.
- Eshkol bundle asset check on 2026-06-05: when the ignored local `hello` bundle
  is copied under `public/service-assets/eshkol/closures/hello/`, Playwright
  verifies the Eshkol service asset probe sees artifact JSON, WASM, schema
  snapshot, and bundle manifest assets.
- Eshkol magnetar closure descriptor summary check on 2026-06-06:
  unit coverage verifies descriptor-only Eshkol artifacts expose
  `closureDescriptorReady = true`, schema
  `eshkol.ulg.magnetar-closure-descriptor.v0`, typed magnetar input/output ids,
  fixture checksum `50`, and guarded smoke `closureOutputSemanticsReady = true`
  while still
  staying service-worker-safe and dynamic-code-free.
- Eshkol magnetar closure browser handoff check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`,
  `npm run stage:service-assets -- --dry-run --json`,
  `npm run stage:service-assets`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed after switching the ULG Eshkol service manifest to
  `magnetar-closure`. The live 5173 handoff exports
  `closureKind = "magnetar-closure-descriptor-fixture"`,
  `closureDescriptorReady = true`, `closureOutputSemanticsReady = true`,
  `scientificValidation = false`, and `wasmByteLength = 53066`.
- Eshkol magnetar interpolation-table fixture check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, and `npm run test:e2e` passed after the staged descriptor
  gained `eshkol.ulg.magnetar-closure-interpolation-table.v0`,
  `status = computed-fixture`, `sampleCount = 4`, content hash
  `sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165`,
  and `scientificValidation = false`. A live `5173` to Multiscale `5185`
  adapter probe returned `dispatch-adapters-ready`, `acceptedDispatchCount = 2`,
  Eshkol descriptor probe `ready = true`, table status `computed-fixture`,
  no blockers, and service-summary table sample count `4`.
- Eshkol magnetar runtime-smoke check on 2026-06-06:
  `npm run stage:service-assets -- --eshkol-only`, `npm test`,
  `npm run build`, and `npm run test:e2e` passed after the default staged
  magnetar descriptor gained `eshkol.ulg.closure-output-semantics.v0` for
  `main(0, 0) -> 0`, stdout text `1048560\n10485441048528\n`, stdout hash
  `sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768`,
  byte length `23`, and `scientificValidation = false`. A live ULG `5173` to
  Multiscale `5185` dispatch probe returned
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `mainInvoked = true`, `entryResult = 0`, no output-semantics blockers, and
  `scientificExecution = false`.
- Eshkol closure artifact handoff check on 2026-06-05: Playwright verifies the
  ready Eshkol service returns the staged `wasm-reference` closure artifact,
  preserves `hello.wasm` as the relative module URL, marks it service-worker
  safe, and exposes closure artifact-summary validation status `pass`,
  `closureReady: true`, and bundle relative-URL preservation.
- Eshkol closure execution metadata check on 2026-06-05: Playwright verifies
  the closure artifact-summary telemetry reports `entryExport = "main"`,
  signature `i32,i32 -> i32`, no start section, import count `12`,
  runtime function import count `9`, WASM function/type counts `18/104`, and
  DOM-free host import factory `createEshkolHostImportObject`.
- Live VPN Eshkol bundle check on 2026-06-05: `http://100.86.83.35:5173/`
  reported Eshkol asset status `ready`, with `application/wasm` for the module
  and `application/json` for the artifact, schema, and bundle manifest. A live
  artifact-cache probe also reported closure kind `wasm-reference`, module URL
  `hello.wasm`, validation status `pass`, and bundle manifest
  `preserveRelativeUrls: true`.
- Live VPN Eshkol closure metadata check on 2026-06-05:
  `http://100.86.83.35:5173/` reported `entry:main`, `imports:12`, and
  `host:createEshkolHostImportObject` in the artifact list after
  `window.__ulgDemo.runSmoke()`.
- ULG handoff exporter check on 2026-06-05: Playwright verifies
  `window.__ulgDemo.createPeerComputeHandoff()` returns schema
  `peercompute.ulg.demo-handoff.v0`, preserves the Eshkol closure summary entry
  `main`, marks DOM-free host imports, and transfers `33,907` WASM bytes from
  `/service-assets/eshkol/closures/hello/hello.wasm`.
- ULG MoonLab reference handoff check on 2026-06-06: Playwright verifies
  `window.__ulgDemo.createPeerComputeHandoff()` preserves the MoonLab
  `outputs.references[]` list and compact output reference counts in the
  exported packet.
- Live ULG-to-Multiscale analytic reference check on 2026-06-06:
  `http://100.86.83.35:5173/` exported MoonLab and Eshkol artifacts to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale reported
  `transfer-manifest-ready`, tolerance ready `2/5`, calibrated reference ready
  `1/4`, calibrated scientific ready `1/4`, the `magnetosphere-mhd` entry ready
  with no blocker, and `scenarioScientificReady: false`.
- ULG output-semantics check on 2026-06-05: Playwright verifies the staged
  Eshkol closure artifact, compact artifact-summary telemetry, and demo handoff
  packet all carry `eshkol.ulg.closure-output-semantics.v0`,
  `semanticScope = "smoke-fixture"`, `scientificScope = "none"`,
  `scientificValidation = false`, `entryExport = "main"`, `entryArgs = [0, 0]`,
  `expectedEntryResult = 0`, stdout SHA-256
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  and byte length `16`.
- ULG separate Eshkol smoke handoff check on 2026-06-06: Playwright verifies
  `window.__ulgDemo.createPeerComputeEshkolSmokeHandoff()` returns
  `peercompute.ulg.demo-handoff.v0` with exactly MoonLab `quantum-response` and
  Eshkol `closure` artifacts, keeps the default magnetar descriptor handoff
  unchanged, carries `hello.wasm` with module SHA-256
  `sha256:1a4699680cc14ba3cefa78634c1d52425c4d4158e590aa2e3658d3c7cae9f79c`,
  transfers `33,907` WASM bytes, merges the DOM-free host-import bundle
  manifest, and marks output semantics ready with scientific validation false.
- Live ULG-to-PeerCompute smoke execution check on 2026-06-06:
  `http://100.86.83.35:5173/` exported the new smoke handoff to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale returned
  `dispatch-adapters-ready`, `acceptedDispatchCount = 2`,
  `host-runtime-output-semantics-validated`, `entryInvoked = true`,
  `entryResult = 0`, stdout SHA-256
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  stdout byte length `16`, no output-semantics blockers, and
  `scientificExecution = false`.
- Live ULG-to-Multiscale bridge check on 2026-06-05:
  `http://100.86.83.35:5173/` exported MoonLab and Eshkol artifacts to
  `https://100.86.83.35:5185/?scenario=magnetar`; Multiscale ingested the
  MoonLab magnetar calibration, executed the Eshkol closure from transferred
  bytes with `entryResult = 0`, reported output preview `1048560\n1048544\n`,
  set `scenarioHandoffReady` and `scenarioClosureHostRuntimeExecutionReady` to
  `true`, and kept `scenarioScientificReady` false.
- Live artifact-cache check on 2026-06-05: `http://100.86.83.35:5173/`
  returned Bell parity `pass` plus magnetar calibration `pass`, ground state
  `000`, `maxEnergyDelta = 0`, and `calibrationArtifactCount = 1` from
  `window.__ulgDemo.artifactCache`.
- Verify the three.js canvas is nonblank at desktop and mobile viewport sizes.
- Save screenshots into `test-results/`.

## Manual Stack Follow-up

- PeerCompute sidecar verified syntax, unit, Multiscale unit, Multiscale build,
  backend dry-run, and VPN coturn dry-run in `/home/cos/projects/peercompute`.
- PeerCompute service orchestration checks on 2026-06-05:
  `node --check` on new modules/tests/index passed,
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed 5/5,
  targeted ComputeManager/SolverRegistry integration gate passed 28/28,
  `npm --prefix peercompute run test:unit` passed 121/121, and
  `git diff --check` passed.
- Eshkol sidecar verified `cmake --build build --target eshkol-run -j2`,
  native hello compile/run, WASM hello emission, LLVM 21 build config, CUDA GPU
  enabled config, and RTX 3090 visibility. It also found no real WebGPU/WGSL
  implementation and one JIT derivative hang to avoid in the browser service path.
- Eshkol ULG artifact helper checks on 2026-06-05:
  `ctest --test-dir build -R 'ulg_closure_artifact_test|eshkol_run_profile_cli_test|execution_profile_test' --output-on-failure`
  passed 3/3; native hello compiled and ran; WASM hello emitted a valid
  `\0asm` module; generated `hello.ulg.json` validated against
  `ulg-gpu-abi/src/schemas/closure_artifact.schema.json`.
- MoonLab sidecar verified native unit binaries and `qsim_test`, while JS unit
  and integration tests need fixes before real MoonLab service integration.
- MoonLab core WASM readiness checks on 2026-06-05:
  `pnpm test:unit` passed 90/90, `pnpm --filter @moonlab/quantum-core build`
  passed, `pnpm test:integration` passed 41/41, `pnpm build:wasm` passed, and
  `git diff --check` passed. Full JS workspace `pnpm build` still fails outside
  core because `@moonlab/quantum-algorithms` lacks `src/index.ts`.
- MoonLab WASM allocation export checks on 2026-06-05:
  `pnpm --filter @moonlab/quantum-core build` passed, `pnpm --filter
  @moonlab/quantum-core test:unit` passed 93/93, and the rebuilt loader exposes
  `_quantum_state_create`/`_quantum_state_destroy`.
- Bring up the peercompute relay-backed local stack after the dummy ULG service
  smoke is stable.
- Reuse peercompute's existing runtime P2P smoke harness where possible.
- Add STUN/TURN/ICE/relay coverage once the service registry integration lands
  in peercompute proper.

## 2026-06-06 Tensor Runtime Contract Checks

- Eshkol:
  `python3 -m json.tool examples/magnetar_closure.ulg-metadata.json >/dev/null`
  and `python3 -m py_compile tests/toolchain/ulg_magnetar_closure_fixture_test.py`
  passed.
- Eshkol:
  `ctest --test-dir build -R '^ulg_magnetar_closure_fixture_test$' --output-on-failure`
  passed `1/1`.
- ULG:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG: `npm run stage:service-assets`, `npm test` (`19/19`),
  `npm run test:e2e` (`1/1`), and `npm run build` passed. Build still emits
  the existing large-chunk warning.
- PeerCompute:
  `node --check peercompute/src/peercompute/serviceOrchestration/UlgDispatchServiceAdapters.js`,
  `node --check peercompute/src/peercompute/serviceOrchestration/UlgHandoffServiceHost.js`,
  and `node --check peercompute/tests/unit/serviceOrchestration.test.js`
  passed.
- PeerCompute:
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed
  `22/22`.
- PeerCompute: `npm --prefix demos/multiscale run build` passed with the
  existing large-chunk warning.
- Strict live browser probe from `http://127.0.0.1:5173/` to
  `https://127.0.0.1:5185/?scenario=magnetar` passed: ULG and PeerCompute both
  reported the Eshkol tensor runtime contract ready, dispatch adapters returned
  `dispatch-adapters-ready`, calibrated runtime evidence returned
  `runtime-evidence-ready`, `validatedCount = 5`, and blocker count `0`.

## 2026-06-06 Sidecar Staging Refresh Checks

- ULG: `npm run stage:service-assets` should pass after MoonLab/Eshkol local
  rebuilds and should restage MoonLab JS/WASM, the canonical normalized
  MoonLab reference suite, and the Eshkol magnetar closure descriptor bundle.
- ULG: `npm run stage:service-assets -- --dry-run --json` should show MoonLab
  reference-suite normalization with `--canonical` and the Eshkol
  `export_ulg_closure_bundle.py` command for `magnetar_closure.esk`.
- ULG staged hash gate:
  `sha256sum public/service-assets/moonlab/magnetar-reference-contracts.json public/service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm`
  should report MoonLab suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455` and
  Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG staged descriptor gate: the staged Eshkol artifact should preserve source
  hash
  `sha256:73f2a89ffe3434d995ffe1174185462cf0c2edb653fbe4d1286342b788763052`,
  MoonLab suite binding
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  source metadata path `magnetar_closure.ulg-metadata.json`, tensor runtime
  status `declared-fixture-contract`, and false scientific/full-physics flags.
- ULG and live bridge: `npm test`, `npm run test:e2e`, and PeerCompute
  `npm --prefix demos/multiscale run test:ulg-handoff` should pass against the
  live `5173`/`5185` servers with `handoff-ready`, blocker count `0`, and the
  visible magnetar proxy on the solar layer.

## 2026-06-06 MoonLab WebGPU Parity-Scope Staging Checks

- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/ServiceAssetProbe.js`,
  `node --check ulg-gpu-abi/src/serviceContract.js`, and
  `node --check tests/service-assets.test.mjs` passed.
- ULG staging:
  `npm run stage:service-assets` passed and generated optional
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json`.
- ULG dry-run staging:
  `npm run stage:service-assets -- --dry-run --json` passed and listed the
  MoonLab WebGPU complex64 parity-scope generation command.
- ULG staged parity-scope gate:
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json` reports
  schema `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-unavailable`, `contractReady = true`,
  `contractValidation.valid = true`, `reducedFixtureOnly = true`,
  `backendAvailable = false`, `webgpuParity.executed = false`,
  `webgpuParity.passed = false`, `complex64Preflight.passed = true`, and the
  blocker `browser-webgpu-kernel-parity-not-executed`.
- ULG staged hashes:
  parity scope
  `8c10f99aaa0dc0f13c6bb3242befbe65bf8ff2d5acad610829017fb548dc83bc`,
  MoonLab suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  and Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed
  against live ULG `5173` and Multiscale `5185` with `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, bridge ack
  `handoff-ready`, visible magnetar proxy, and expected canonical/source/WASM
  hashes.

## 2026-06-06 MoonLab WebGPU Parity-Scope Runtime Handoff Checks

- ULG syntax:
  `node --check public/workers/moonlab-core-probe.worker.js`,
  `node --check src/services/dummyService.worker.js`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check src/main.js`, `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live ULG runtime:
  Playwright against `http://100.86.83.35:5173/` reported MoonLab parity-scope
  schema `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-unavailable`, `backendAvailable = false`,
  `webgpuParity.executed = false`, `webgpuParity.passed = false`,
  `complex64Preflight.passed = true`, false full-fidelity/full-physics flags,
  and blocker `browser-webgpu-kernel-parity-not-executed` in both telemetry and
  handoff artifact.
- Live ULG UI:
  the MoonLab artifact list line includes `webgpu:no-backend` beside
  `validation:pass`, `parity:pass`, `magnetar:000`, and `refs:5/5`.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed
  against live ULG `5173` and Multiscale `5185` with `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, bridge ack
  `handoff-ready`, and visible magnetar proxy.

## 2026-06-06 PeerCompute Parity-Scope Consumer Checks

- PeerCompute service orchestration:
  `node --test peercompute/tests/unit/serviceOrchestration.test.js` passed
  `24/24`.
- PeerCompute Multiscale:
  `npm --prefix demos/multiscale test` passed `196/196`.
- PeerCompute Multiscale build:
  `npm --prefix demos/multiscale run build` passed with the existing
  large-chunk warning.
- Live bridge:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and visible magnetar proxy.
- Listener check:
  Vite servers remained bound on `0.0.0.0:5173` and `0.0.0.0:5185`.

## 2026-06-06 PeerCompute Relay Smoke Checks

- VPN coturn dry-run:
  `bash scripts/dev-vpn-coturn.sh --dry-run` selected VPN host
  `100.86.83.35`, `RELAY_LISTEN_HOST=0.0.0.0`, dynamic relay port, and TURN
  host `100.86.83.35:3478`.
- Backend dry-run:
  `npm run backend:dry-run` reported relay plus coturn launch commands without
  starting services.
- Focused runtime P2P smoke:
  PeerCompute
  `RUNTIME_P2P_DEMOS=hyperborea DEMO_PORT=4191 RELAY_CONFIG_TIMEOUT_MS=15000 DEMO_TIMEOUT_MS=45000 node demos/tests/runtime-p2p.mjs`
  started the Go relay on a dynamic localhost port, wrote Hyperborea relay
  config, connected headless browser peers, disconnected cleanly, and printed
  `Runtime P2P tests passed`.

## 2026-06-06 Eshkol Handler Boundary and MoonLab Probe Checks

- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- MoonLab WASM rebuild:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` recreated
  `dist/moonlab.js` and `dist/moonlab.wasm` after MoonLab's TypeScript build
  cleaned the browser loader.
- ULG staging:
  `npm run stage:service-assets` passed after stricter validation for Eshkol
  `eshkol.ulg.production-handler-boundary.v0` metadata and MoonLab
  `moonlab.webgpu.complex64-probability-kernel-probe.v0` metadata.
- Staged artifact hashes:
  MoonLab parity scope
  `27b87fcdbd13574df63d83d4fe6aac5a31a740a0f77879c3e70a1a097c27c0bb`,
  MoonLab reference suite
  `7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`,
  and Eshkol artifact JSON
  `9532159bae058a193fc982113cca781e82182740e82e3f0b5ddbafe8b346b4c1`.
- ULG regression:
  `npm test` passed `20/20`, `npm run build` passed with the existing
  large-chunk warning, and `npm run test:e2e` passed `1/1`.
- Live listener check:
  `ss -ltnp 'sport = :5173'` and `ss -ltnp 'sport = :5185'` showed the ULG and
  PeerCompute Multiscale Vite servers bound to `0.0.0.0`.
- Live ULG runtime:
  Playwright against `http://100.86.83.35:5173/` reported two handoff
  artifacts, Eshkol `closureProductionHandlerBoundaryDeclared = true` with
  `handlerReady = false` and `runtimeExecution = false`, and MoonLab
  `moonlabWebGpuProbabilityKernelProbeDeclared = true` for
  `compute_probabilities` with `executed = false`, `passed = false`, and the
  native-operation-coverage blocker preserved.

## 2026-06-06 PeerCompute Production Handler Boundary Consumer Checks

- PeerCompute focused service orchestration:
  sidecar verification reported
  `node --test peercompute/tests/unit/serviceOrchestration.test.js --test-name-pattern 'production handler boundary|descriptor-only Eshkol closures without WASM bytes'`
  passed `26/26`.
- PeerCompute focused Multiscale model:
  sidecar verification reported
  `node --test demos/multiscale/tests/multiscaleModel.test.mjs --test-name-pattern 'production handler boundary|descriptor-only Eshkol closure'`
  passed `197/197`.
- PeerCompute Multiscale build:
  sidecar verification reported `npm --prefix demos/multiscale run build`
  passed with the existing large-chunk warning.
- PeerCompute diff/worktree:
  sidecar verification reported `git diff --check` passed and the post-commit
  PeerCompute worktree was clean at local commit `cd85fd9e`.
- Coordinator live bridge:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed after
  `cd85fd9e`, reporting ULG `handoff ready / blockers 0`, Multiscale
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and `magnetarVisible = true`.

## 2026-06-06 ULG Launch Status Checks

- ULG syntax:
  `node --check src/runtime/handoffStatus.js`, `node --check src/main.js`, and
  `node --check tests/handoffStatus.test.mjs` passed.
- ULG unit tests:
  `npm test` passed `22/22`, including the handoff-status formatter preserving
  the `handoff ready / blockers 0` compatibility prefix while surfacing scenario
  and simulation readiness fields.
- ULG browser smoke:
  `npm run test:e2e` passed `1/1`.
- ULG production build:
  `npm run build` passed with the existing large-chunk warning.
- Live bridge:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed and
  reported ULG status
  `handoff ready / blockers 0 / scenario magnetar / scientific ready / 2 artifacts`,
  Multiscale `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, bridge ack `handoff-ready`, and
  `magnetarVisible = true`.

## 2026-06-06 ULG Live Status Script Checks

- Script syntax:
  `node --check scripts/live-status.mjs` passed.
- Default live status:
  `npm run status:live` passed against `http://100.86.83.35:5173/`, reporting
  two ready services, two handoff artifacts, MoonLab WebGPU parity scope ready,
  `compute_probabilities` probe declared but unexecuted, MoonLab calibrated
  reference ready count `4`, Eshkol descriptor/tensor runtime ready, and Eshkol
  production-handler boundary declared with handler/runtime execution false.
- Bridge live status:
  `npm run status:live -- --bridge` passed and reported Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 MoonLab Hadamard Probe and Eshkol Tensor Layout Checks

- MoonLab browser assets:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` rebuilt
  `dist/moonlab.js` and `dist/moonlab.wasm`.
- ULG syntax:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- ULG staging:
  `npm run stage:service-assets` passed with guards for MoonLab
  `moonlab.webgpu.complex64-native-operation-probe.v0` and Eshkol
  `eshkol.ulg.tensor-linear-memory-binding.v0`.
- Staged hashes:
  MoonLab WebGPU parity-scope JSON
  `7a4430a3ffa1a0a21807d36fefd1e465ecbad24ad7bfa725d7be4768fecd9f6b`,
  Eshkol magnetar closure artifact JSON
  `a7d77d237dcb9130030f1ea1a3357c0c30cf49932e5e6df978492e928d252841`,
  and Eshkol WASM
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG unit tests:
  `npm test` passed `22/22`.
- ULG production build:
  `npm run build` passed with the existing large-chunk warning.
- ULG browser smoke:
  `npm run test:e2e` passed `1/1`.
- Live status:
  `npm run status:live` reported MoonLab native-operation probe declared,
  hadamard declared with `executed = false`, `covered = false`, blocker
  `native-operation-probe-not-executed`, Eshkol tensor linear-memory binding
  ready, base offset `131072`, total byte length `168`, and handler/runtime
  execution false.
- Live bridge:
  `npm run status:live -- --bridge` passed and reported Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 PeerCompute Relay-Backed ULG Handoff Checks

- PeerCompute relay smoke syntax:
  sidecar verification reported
  `node --check demos/multiscale/tests/ulgRelayHandoffSmoke.mjs` passed.
- PeerCompute relay smoke:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-relay-handoff` passed. The smoke
  started a dynamic Go relay, generated STUN/TURN ICE config with
  `iceServerCount = 2`, `hasStun = true`, and `hasTurn = true`, connected two
  Multiscale browser peers in one relay room, imported the live ULG handoff via
  `ulg-post-message`, and verified `handoff-ready`,
  `service-envelope-ready`, `relaySafeArtifactCount = 2`, and `dispatch-ready`.
- PeerCompute live handoff regression:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-handoff` still passed against live
  ULG `5173` and Multiscale `5185`.
- PeerCompute cleanup:
  sidecar verification reported `git diff --check` passed, relay configs were
  preserved with no diff in `docs/multiscale/relay-config*.json`, and no
  test-owned `4196` server or relay process remained.

## 2026-06-06 MoonLab pauli_x Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported focused WebGPU parity tests passed `12/12`,
  MoonLab unit tests passed `116/116`, `pnpm build:ts` passed with the existing
  package export-order warning, CLI parity artifact generation passed, and
  `git diff --check` passed.
- MoonLab browser assets:
  `pnpm build:wasm` in
  `/home/cos/projects/moonlab/bindings/javascript/packages/core` rebuilt
  `dist/moonlab.js` and `dist/moonlab.wasm`.
- ULG staging:
  `npm run stage:service-assets` passed with `hadamard` and `pauli_x` native
  operation probes both declared but unexecuted/uncovered.
- Staged MoonLab parity-scope hash:
  `61d04ad9eb66aa7804b64e063e7653acb76f4b0683a5035136ecff1e9d0d2bb2`.

## 2026-06-06 Eshkol Tensor Offset ABI Blocker Checks

- Eshkol sidecar validation:
  sidecar verification reported `ulg_magnetar_closure_fixture_test.py`,
  `eshkol_host_imports_smoke_test.js`, `ulg_closure_artifact_test.py`, focused
  `ctest`, and `git diff --check` all passed.
- ULG staging:
  `npm run stage:service-assets` regenerated the Eshkol magnetar artifact with
  `eshkol.ulg.tensor-entry-export-offset-probe.v0` and tensor runtime contract
  hash `sha256:4d16bf10f236832da92974cd341bb40a533cb2fe7c7ceab67ff8f6758645c95f`.
- Offset ABI blocker:
  staged ULG artifact reports `entryExportConsumesOffsets = false`,
  `outputTensorsProducedByEntryExport = false`,
  `changedBytesInDeclaredTensorRange = 0`, and blocker
  `main-export-accepts-two-i32-runtime-args-but-does-not-read-or-write-host-managed-tensor-offsets`.

## 2026-06-06 PeerCompute Relay Dispatch Adapter Diagnostic Checks

- PeerCompute syntax/build:
  sidecar verification reported `node --check demos/multiscale/src/main.js`,
  `node --check demos/multiscale/tests/ulgRelayHandoffSmoke.mjs`, and
  `npm --prefix demos/multiscale run build` passed with the existing large-chunk
  warning.
- Default relay smoke:
  sidecar verification reported
  `npm --prefix demos/multiscale run test:ulg-relay-handoff` passed.
- Adapter-enabled relay diagnostic:
  sidecar verification reported
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 npm --prefix demos/multiscale run
  test:ulg-relay-handoff` now exits cleanly with structured diagnostic status
  `dispatchAdapterStatus = dispatch-adapter-popup-context-reset`, reaches
  `start`, `dispatch-plan-created`, and MoonLab `dispatch-start`, and records
  `runtimeGateRelaxed = false` plus `scientificGateRelaxed = false`.
- Strict failure mode:
  sidecar verification reported `ULG_RELAY_HANDOFF_REQUIRE_DISPATCH=1` is
  available to force this diagnostic blocker to fail while debugging adapter
  execution itself.
- Cleanup:
  sidecar verification reported relay config restore diff was empty for
  `docs/multiscale/relay-config*.json`, no test-owned `4196` listener or relay
  process remained, and `git diff --check` passed.
- Coordinator live status:
  `npm run status:live -- --bridge` on 2026-06-06 14:58:03 AKDT reported live
  ULG `5173` and Multiscale `5185` ready, with Multiscale ack
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  and artifact count `2`.

## 2026-06-06 ULG Generic Native Operation Summary Checks

- Syntax:
  `node --check src/runtime/artifactSummary.js`, `node --check src/main.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Unit tests:
  `npm test` passed `22/22`.
- Build and browser smoke:
  `npm run build` passed with the existing large-chunk warning, and
  `npm run test:e2e` passed `1/1`.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x"]`, Multiscale ack
  `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Summary guard:
  `tests/orchestration.test.mjs` now includes a blocked `pauli_z` fixture entry
  in `browserNativeOperationProbe.operationResults[]`, proving ULG preserves
  future declared native operations through generic declared/blocked operation
  lists while still requiring `hadamard` and `pauli_x` compatibility blockers.
- Current live artifact path:
  `tests/demo.e2e.mjs` still expects the staged live MoonLab artifact to report
  the current two declared blocked native operations: `hadamard` and `pauli_x`.

## 2026-06-06 MoonLab pauli_z Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported MoonLab local commit `e9bc324` passed
  `pnpm --dir bindings/javascript/packages/core build:ts`, focused
  `webgpu-complex64-parity.test.ts` with `13/13`, CLI parity artifact
  generation, `ulg-quantum-response-artifact.test.ts` with `14/14`,
  `pnpm --dir bindings/javascript/packages/core build:wasm`, and
  `git diff --check HEAD~1..HEAD`.
- ULG staging:
  `npm run stage:service-assets` passed after requiring `hadamard`, `pauli_x`,
  and `pauli_z` in the MoonLab native-operation probe.
- Staged MoonLab hashes:
  parity-scope JSON
  `5542be2ba09be9541666472a993c4c06e80ecb790cb57ec9cea3191aa3d02f27`,
  browser loader
  `4272298c649ad4141057cb7dc4ccc27dec5a8a79036ddf2a70a6dd76e84a7cfe`, and
  WASM
  `df924d4c907ace13caf58c6c15ba49bd97aadd351fce768bb936875d14475d78`.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x", "pauli_z"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x", "pauli_z"]`,
  Multiscale ack `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.

## 2026-06-06 ICC Eshkol Registration Checks

- Parser dependency handling:
  `make install-parsers` in `/home/cos/projects/infinite_context_coder` hit the
  Ubuntu PEP 668 externally-managed system-pip guard, so the same parser package
  check/install was run through ICC's existing `.venv`. The packages were
  already present: `tree-sitter`, `tree-sitter-cpp`, and `tree-sitter-c`.
- Registry:
  `.venv/bin/python scripts/codebase_tool.py register --name eshkol --path
  /home/cos/projects/eshkol ...` succeeded with skips for `.git`, `build`,
  `node_modules`, `dist`, `.venv`, `__pycache__`, `.pytest_cache`, and `site`.
- Index:
  `.venv/bin/python scripts/codebase_tool.py index --repo eshkol` indexed
  `1578` files, `451140` lines, and `14294` symbol records with
  `tree_sitter_available = true`.
- Memory:
  `.venv/bin/python scripts/codebase_tool.py build-memory --repo eshkol` wrote
  `/home/cos/projects/infinite_context_coder/artifacts/repos/eshkol/codebase_memory`
  with `21334` chunks and Eshkol git head
  `ad878d0ab182b238b85e2acb89b329b52566464a`.
- Architecture summary:
  `.venv/bin/python scripts/codebase_tool.py architecture-summary --repo eshkol
  --bundle --include-cheatsheet` succeeded and identified Eshkol integration
  surfaces including `exe/eshkol-server.cpp`,
  `inc/eshkol/bridge/qllm_bridge.h`, `inc/eshkol/core/eval_bridge.h`, and
  tensor/backend paths.

## 2026-06-06 ULG Native Operation Staging Overclaim Guard Checks

- Syntax:
  `node --check scripts/stage-service-assets.mjs` passed.
- MoonLab-only staging:
  `npm run stage:service-assets -- --moonlab-only` passed and regenerated the
  MoonLab loader, WASM, normalized reference suite, and WebGPU complex64 parity
  scope with `hadamard`, `pauli_x`, and `pauli_z` blocked/unexecuted/uncovered.
- Unit tests:
  `npm test` passed `22/22`.
- Diff check:
  `git diff --check` passed.
- Full staging note:
  full `npm run stage:service-assets` was not used for this guard checkpoint
  because the active Eshkol sidecar has uncommitted Eshkol edits that currently
  make the Eshkol bundle export report `@define-ulg-closure ... entryExport='main'`
  while generated artifact execution uses `scheme_main`.

## 2026-06-06 ICC ULG Refresh Checks

- ULG index:
  `.venv/bin/python scripts/codebase_tool.py index --repo ulg` in
  `/home/cos/projects/infinite_context_coder` indexed `63` files, `25557` lines,
  and reported `tree_sitter_available = true` at ULG git head
  `f620e85459f389afd16e9a72134049a8730417cd`.
- ULG memory:
  `.venv/bin/python scripts/codebase_tool.py build-memory --repo ulg` wrote
  `/home/cos/projects/infinite_context_coder/artifacts/repos/ulg/codebase_memory`
  with `224` chunks.
- ULG architecture summary:
  `.venv/bin/python scripts/codebase_tool.py architecture-summary --repo ulg
  --bundle --include-cheatsheet` succeeded and identified `src/runtime`,
  `src/services`, `src`, and `src/visualization` as public module roots.

## 2026-06-06 MoonLab Native Operation Target Visibility Checks

- Syntax:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`, and
  `node --check tests/demo.e2e.mjs` passed.
- Unit tests:
  `npm test` passed `22/22`.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationTargetOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`
  and `nativeOperationMissingTargetOperations = ["cnot"]`, while Multiscale
  ack stayed `handoff-ready` with blocker count `0` and
  `simulationStatus = scientific-ready`.

## 2026-06-06 PeerCompute Relay Dispatch Fix Checks

- PeerCompute sidecar validation:
  sidecar verification reported local PeerCompute commit `631b202` passed
  syntax checks for `demos/multiscale/src/main.js` and
  `demos/multiscale/tests/ulgRelayHandoffSmoke.mjs`, built
  `demos/multiscale` with the existing large-chunk warning, and passed both
  default and adapter-enabled relay handoff smokes.
- Adapter-enabled relay smoke:
  sidecar verification reported
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 npm --prefix demos/multiscale run
  test:ulg-relay-handoff` now passes with `dispatch-adapters-ready`,
  `acceptedDispatchCount = 2`, and scientific scope flags all `false`.
- Coordinator handoff regression:
  `npm --prefix demos/multiscale run test:ulg-handoff` passed after
  PeerCompute `631b202`, reporting `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, and `magnetarVisible = true`.

## 2026-06-06 MoonLab cnot Native Probe Handoff Checks

- MoonLab sidecar validation:
  sidecar verification reported local MoonLab commit `fbc2ddf` passed
  `pnpm --dir bindings/javascript/packages/core build:ts` with the existing
  export-order warning, focused `webgpu-complex64-parity.test.ts` with `14/14`,
  CLI parity artifact generation/inspection for blocked `cnot`,
  `ulg-quantum-response-artifact.test.ts` with `14/14`, `build:wasm`, and
  `git diff --check`.
- ULG MoonLab-only staging:
  `npm run stage:service-assets -- --moonlab-only` passed after requiring
  `hadamard`, `pauli_x`, `pauli_z`, and `cnot` native-operation declarations.
- Staged MoonLab hashes:
  parity-scope JSON
  `dc391fa82a5e384c2b419e78c4066a88d6fbb76255867fbebd5d3b6a6a4a42d0`,
  browser loader
  `4272298c649ad4141057cb7dc4ccc27dec5a8a79036ddf2a70a6dd76e84a7cfe`, and
  WASM
  `df924d4c907ace13caf58c6c15ba49bd97aadd351fce768bb936875d14475d78`.
- Eshkol asset consistency:
  after the failed full staging attempt from active Eshkol sidecar edits, the
  ignored ULG `magnetar-closure.wasm` was restored from committed Eshkol source
  bytes to `53066` bytes with hash
  `38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`, and
  `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported
  `nativeOperationDeclaredOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`,
  `nativeOperationBlockedOperations = ["hadamard", "pauli_x", "pauli_z", "cnot"]`,
  `nativeOperationMissingTargetOperations = []`, Multiscale ack
  `handoff-ready`, blocker count `0`, and
  `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.

## 2026-06-06 Eshkol Tensor Offset Runtime Smoke Handoff Checks

- Eshkol sidecar integration:
  local Eshkol commit `a13745e` exports a magnetar closure artifact whose
  top-level validation is `runtime-smoke` with validation mode
  `eshkol-deterministic-magnetar-tensor-abi-smoke`.
- Staged Eshkol artifact:
  source hash
  `sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69`,
  WASM hash
  `sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa`,
  WASM byte length `169528`, and tensor contract hash
  `sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64`.
- Tensor runtime evidence:
  ULG staging and summaries now require
  `runtimeStatus = deterministic-runtime-smoke-executed`,
  `executionClaim = deterministic-tensor-runtime-smoke-only`,
  `linearMemoryBinding.status = entry-export-runtime-smoke-passed`,
  `entryExportConsumesOffsets = true`, all declared tensors consumed by the
  entry export, offset probe `runtime-smoke-passed`, output tensors produced,
  `changedBytesInDeclaredTensorRange = 64`, and stdout invariant false.
- Production boundary:
  ULG requires the exact remaining blocker
  `full-physics-validation-not-run`; `handlerReady` and `runtimeExecution`
  are true for production-candidate runtime-smoke evidence, while
  `scientificValidation` and `fullPhysicsValidation` remain false.
- ULG validations:
  `node --check scripts/stage-service-assets.mjs`,
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm run stage:service-assets`,
  `npm test`, `npm run build`, and `npm run test:e2e` passed.
- Live status:
  `npm run status:live -- --bridge` reported Eshkol
  `tensorLinearMemoryEntryExportConsumesOffsets = true`,
  `tensorEntryExportOffsetProbeStatus = runtime-smoke-passed`,
  `tensorEntryExportChangedBytesInDeclaredTensorRange = 64`,
  `productionHandlerReady = true`, Multiscale ack `handoff-ready`, blocker
  count `0`, and `simulationStatus = scientific-ready`.
- Multiscale handoff:
  PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` passed with
  the new Eshkol source/WASM hashes, `wasmByteLength = 169528`,
  `magnetarVisible = true`, `magnetarLayer = solar`, and bridge ack
  `handoff-ready`.
- PeerCompute sidecar validation:
  local PeerCompute commit `dc497229` updated browser and relay handoff smoke
  expectations for the new Eshkol artifact and passed syntax checks,
  `npm --prefix demos/multiscale run test:ulg-handoff`,
  `npm --prefix demos/multiscale run test:ulg-relay-handoff`, relay config
  cleanup checks, and `git diff --check`.

## 2026-06-06 Eshkol Runtime Smoke Visibility Checks

- UI visibility:
  Playwright now asserts the visible artifact row includes
  `tensor-probe:runtime-smoke-passed:offsets-consumed:64b` and
  `handler:production-handler-runtime-smoke-executed:1-blockers`.
- Live status:
  `npm run status:live -- --bridge` now reports Eshkol
  `validationStatus = runtime-smoke`,
  `tensorRuntimeStatus = deterministic-runtime-smoke-executed`,
  `tensorEntryExportOutputTensorsProduced = true`, expected entry args
  `[131072, 131136]`, stdout hash
  `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
  `productionHandlerScientificValidation = false`,
  `productionHandlerFullPhysicsValidation = false`, and the exact three
  production blockers.
- Validation:
  `node --check scripts/live-status.mjs`, `node --check src/main.js`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.

## 2026-06-06 Eshkol Production Host Import Candidate Checks

- Eshkol sidecar validation:
  local Eshkol commit `b025f5d` added a
  `eshkol.ulg.production-host-import-candidate.v0` requirements block and
  passed focused host-import/fixture tests plus `eshkol-run` rebuild.
- ULG staging:
  `npm run stage:service-assets -- --eshkol-only` passed and regenerated the
  Eshkol magnetar closure bundle with `runtimeScope =
  production-candidate-host-imports`, `implementationStatus =
  production-candidate-runtime-imports-present`, production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, f64 tensor-memory imports
  `ulg_read_f64`/`ulg_write_f64`, `23` required non-stub imports, and the
  remaining two production boundary blockers.
- ULG validations:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check scripts/live-status.mjs`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.
- Live status:
  `npm run status:live -- --bridge` reported production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, required non-stub import count `23`,
  readiness requirements
  `production-magnetar-handler-implementation`, `non-stub-host-runtime-imports`,
  `validated-f64-tensor-memory-imports`, `full-physics-validation-pass`,
  preflight evidence counts `8/5/3`, Multiscale ack `handoff-ready`, and
  `simulationStatus = scientific-ready`.
- Full staging caveat:
  full `npm run stage:service-assets` was not used for this checkpoint because
  the active MoonLab sidecar temporarily removed or had not rebuilt
  `bindings/javascript/packages/core/dist/moonlab.js`; Eshkol-only staging was
  the relevant gate for this integration slice.

## 2026-06-06 MoonLab Browser Backend Preflight Checks

- MoonLab sidecar validation:
  local MoonLab commit `4e91165` added
  `moonlab.webgpu.complex64-browser-backend-preflight.v0` and passed TypeScript
  build, focused parity tests, CLI parity generation, required-backend failure
  behavior in the no-adapter runtime, quantum-response artifact tests, full core
  tests, WASM build, and `git diff --check`.
- ULG staging:
  `npm run stage:service-assets` passed and regenerated
  `webgpu-complex64-parity-scope.json` with
  `browserBackendPreflight.stage = navigator-gpu-unavailable`,
  `navigatorGpuAvailable = false`, `adapterAvailable = false`, and
  `deviceAcquired = false`.
- ULG validations:
  `node --check src/runtime/artifactSummary.js`,
  `node --check scripts/stage-service-assets.mjs`,
  `node --check scripts/live-status.mjs`, `node --check src/main.js`,
  `node --check tests/orchestration.test.mjs`,
  `node --check tests/demo.e2e.mjs`, `npm test`, `npm run build`,
  `npm run test:e2e`, and `npm run status:live -- --bridge` passed.
- Live status:
  `npm run status:live -- --bridge` reported MoonLab
  `browserBackendPreflightDeclared = true`,
  `browserBackendPreflightStage = navigator-gpu-unavailable`,
  `browserBackendPreflightNavigatorGpuAvailable = false`,
  `browserBackendPreflightAdapterAvailable = false`,
  `browserBackendPreflightDeviceAcquired = false`, Multiscale ack
  `handoff-ready`, and `simulationStatus = scientific-ready`.
- PeerCompute handoff:
  `npm --prefix /home/cos/projects/peercompute/demos/multiscale run test:ulg-handoff`
  passed with `magnetarVisible = true`, `magnetarLayer = solar`, bridge ack
  `handoff-ready`, and `simulationStatus = scientific-ready`.

## 2026-06-06 MoonLab Browser WebGPU Evidence ULG Checks

- ULG staging:
  `npm run stage:service-assets -- --moonlab-only` passed and regenerated
  `public/service-assets/moonlab/webgpu-complex64-parity-scope.json` through
  MoonLab's browser smoke harness with `--require-backend`.
- Staged parity-scope gate:
  the staged artifact reports schema
  `moonlab.webgpu.complex64-parity-scope.v0`, status
  `scope-ready-backend-detected`, `backendAvailable = true`,
  `requireBackend = true`, `browserBackendPreflight.stage = device-acquired`,
  `webgpuParity.executed = true`, `webgpuParity.passed = true`, zero blockers,
  `compute_probabilities` browser-kernel coverage, and native operation
  coverage for `hadamard`, `pauli_x`, `pauli_z`, and `cnot`.
- ULG syntax/regression:
  `node --check public/workers/moonlab-core-probe.worker.js`,
  `node --check src/runtime/artifactSummary.js`, `npm test`, and
  `npm run build` passed. Build retained the existing large-chunk warning.
- ULG browser e2e:
  first `npm run test:e2e` failed because the core-probe worker still rejected
  `backendAvailable = true` / executed browser parity as an overclaim. After
  updating that validator to require the successful reduced browser evidence
  and explicit no-full-physics flags, `npm run test:e2e` passed `1/1`.
- Live ULG runtime:
  Playwright against `http://127.0.0.1:5173/` showed the MoonLab artifact row
  containing `webgpu:backend`, `webgpu-preflight:device-acquired`,
  `wgsl:compute_probabilities-declared`, and covered native operations for
  `hadamard`, `pauli_x`, `pauli_z`, and `cnot`.
- PeerCompute relay-dispatch handoff:
  `ULG_RELAY_HANDOFF_RUN_DISPATCH=1 ULG_RELAY_HANDOFF_REQUIRE_DISPATCH=1 npm --prefix /home/cos/projects/peercompute/demos/multiscale run test:ulg-relay-handoff`
  passed with relay peers connected, `dispatchAdapterStatus =
  dispatch-adapters-ready`, `acceptedDispatchCount = 2`, ack `handoff-ready`,
  and `simulationStatus = scientific-ready`.

## 2026-06-11 H2O Transmissive Surface Visibility Regression

- Added `tests/sphPhaseRenderer.test.mjs` coverage that condensed transmissive
  H2O keeps mesh alpha coverage at `1` and disables depth write while vapor
  continues to use closure opacity.
- Extended `tests/demo.e2e.mjs` so the default SPH phase demo must expose a
  visible H2O surface with `renderAlpha = 1`, `material.opacity = 1`, and
  `material.transmission > 0.9` after the optical GPU lookup is applied.
- Manual Playwright probes against `https://127.0.0.1:5173/` verified default
  Fe/H2O and Na/H2O scenarios render continuous H2O volumes. Screenshots were
  saved to `/tmp/ulg-default-sph-h2o-alpha-fixed.png` and
  `/tmp/ulg-na-h2o-alpha-fixed.png`.
- Validation passed: syntax checks for touched files, `node --test
  tests/sphPhaseRenderer.test.mjs` (`6/6`), focused HTTPS Chromium e2e (`1/1`),
  `git diff --check`, `npm run build`, and full `npm test` (`309/309`).

## 2026-06-11 Generic Resident Render-Field Bridge

- Added ABI coverage for `peercompute.ulg.sph-gpu-render-field.v0` and
  `peercompute.ulg.sph-gpu-render-field-execution.v0`, including generic
  material/phase surface rows, field-cell rows, and WGSL binding checks.
- Added `tests/sphRenderGpuKernel.test.mjs` coverage for generic surface-table
  packing, CPU render-field splatting by material id + phase id, field splitting
  for the Three.js bridge, and optional WebGPU execution via injected runner.
- Updated the SPH browser e2e so a successful WebGPU resident branch must report
  `source = resident-gpu-render-field`, WebGPU render-field backend, nonzero
  field byte length, and visible field-backed surfaces.
- Validation passed: syntax checks for touched files, `node --test
  tests/abi.test.mjs tests/sphRenderGpuKernel.test.mjs` (`23/23`),
  `node --test tests/sphPhaseRenderer.test.mjs` (`6/6`), focused HTTPS
  Chromium e2e (`1/1`), manual Fe/H2O and Na/H2O browser probes, and
  `git diff --check`.

## 2026-06-11 Resident Render Buffer And Closure-Graph Perf Gates

Immediate render-buffer gate:

- `tests/sphRenderGpuKernel.test.mjs` should prove the optional WebGPU
  render-field path forwards a retained render-row GPU buffer to the injected
  runner and reports `renderFieldInputSource =
  resident-render-rows-buffer`.
- `tests/demo.e2e.mjs` should prove a successful WebGPU resident SPH branch
  reports retained render-row buffer telemetry and visible surfaces sourced from
  `resident-render-rows-buffer`.

Validation status:

- PASS: `node --test tests/sphRenderGpuKernel.test.mjs` (`7/7`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: full `npm test` (`313/313`).
- PASS: `npm run build` with the existing Vite large-chunk warning.

Flat closure-law graph gates for the next major performance slice:

- CPU compiler tests should build a deterministic flat node/edge/table buffer
  set from a representative closure graph and validate units, domains,
  provenance hashes, and dependency ordering.
- CPU reference and WebGPU evaluator tests should run the same EOS/phase,
  mechanics, optical, radiation, reaction, and nuclear fixture rows through the
  flat closure buffers and compare outputs within declared tolerances.
- Browser e2e should confirm normal runtime samples the flat closure graph from
  WebGPU buffers and only reads compact status/diagnostic summaries unless a
  domain exit or validation failure is reported.
- Regression tests should reject material-specific branches for individual demo
  substances when the same behavior can be expressed through derived closure
  rows.

Implemented first flat-graph gates:

- `tests/abi.test.mjs` now covers `peercompute.ulg.closure-law-graph.v0`, flat
  node/edge/sample/slot/status row layouts, descriptor stride metadata, and
  validation-flag overclaim rejection.
- `tests/closureLawGraph.test.mjs` covers strict CPU compilation from
  table-interpolation closures, rejection of unsorted table axes, CPU
  table-linear graph evaluation, domain-exit status/refresh reporting,
  optional WebGPU parity acceptance through an injected runner, and parity drift
  fallback.
- Manual Chromium/WebGPU probe against the live HTTPS Vite server executed
  `closureLawGraphEvalWgsl` with real WebGPU after enabling headless WebGPU
  flags and passed CPU/WebGPU parity exactly.

Validation status:

- PASS: `node --test tests/closureLawGraph.test.mjs tests/abi.test.mjs`
  (`24/24`).
- PASS: manual Chromium/WebGPU probe reported `backend = webgpu`,
  `webgpuStatus.status = webgpu-executed`, parity `pass`, `maxSlotAbs = 0`,
  and `maxStatusAbs = 0`.

Carrier graph bridge gates:

- `tests/webgpuCarrierKernel.test.mjs` now checks `carrierGraphStepWgsl`
  declares and consumes flat closure-law graph node/sample/slot/status buffers.
- Manual Chromium/WebGPU probe ran the existing optional carrier runtime through
  the graph-backed WebGPU kernel and passed CPU/WebGPU carrier parity.

Validation status:

- PASS: `node --test tests/webgpuCarrierKernel.test.mjs
  tests/closureLawGraph.test.mjs tests/abi.test.mjs` (`32/32`).
- PASS: manual Chromium/WebGPU carrier probe reported `backend = webgpu`,
  `webgpuStatus.status = webgpu-executed`, carrier parity `pass`,
  `closureLawGraph.backend = webgpu-resident-flat-graph`, and invariant status
  `pass`.

SPH thermal closure graph artifact gates:

- `tests/sphThermalGpuKernel.test.mjs` now verifies
  `buildSphThermalClosureGraphBuffers()` emits
  `peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0` from the derived
  thermal material table, preserves H2O/Fe/air material metadata, preserves
  source phase ids, and evaluates each emitted segment graph through the
  generic closure-law graph CPU evaluator to match
  `resolveThermalStateFromTable()`.
- `tests/demo.e2e.mjs` now verifies the browser SPH phase scene exposes the
  graph set beside the material table.

Validation status:

- PASS: `node --test tests/sphThermalGpuKernel.test.mjs` (`6/6`).
- PASS: `node --test tests/sphThermalGpuKernel.test.mjs
  tests/closureLawGraph.test.mjs tests/abi.test.mjs` (`30/30`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/`
  (`1/1`).
- PASS: full `npm test` (`323/323`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.

SPH thermal phase-response gates:

- `tests/abi.test.mjs` now locks the
  `peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0` and
  `peercompute.ulg.sph-gpu-thermal-phase-response-table.v0` schemas plus the
  f32x4-aligned response record/row layouts.
- `tests/closureLawGraph.test.mjs` now covers the generic `tableStep` graph op
  for explicit selector/categorical outputs.
- `tests/sphThermalGpuKernel.test.mjs` now verifies the packed thermal graph
  bank, builds the phase-response table, and proves graph temperature plus
  response-table phase/density/fraction outputs match the legacy thermal
  resolver for generated H2O/Fe/air segments, plateau midpoint behavior, and
  low/high clamp behavior.

Validation status:

- PASS: `node --test tests/abi.test.mjs tests/closureLawGraph.test.mjs
  tests/sphThermalGpuKernel.test.mjs` (`32/32`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/`
  (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`325/325`).

SPH thermal WebGPU response/graph binding gates:

- `tests/abi.test.mjs` now checks `sphThermalStepWgsl` binds
  `phase_response_records`, `phase_responses`, `thermal_graph_nodes`, and
  `thermal_graph_samples`, with output thermo at the shifted storage binding.
- `tests/demo.e2e.mjs` now confirms the live scene exposes the packed graph
  bank schema and the phase-response table schema/count.

Validation status:

- PASS: syntax checks for touched WGSL/runtime/scene/e2e files.
- PASS: `node --test tests/abi.test.mjs tests/sphThermalGpuKernel.test.mjs
  tests/closureLawGraph.test.mjs` (`32/32`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/`
  (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`325/325`).

SPH box/grid, worker rebuild, warnings/cache, and general reaction candidate gates:

- `tests/sphPhaseRenderer.test.mjs` now includes a regression proving a fixed
  particle cloud keeps the same continuous-surface radius when the simulation
  box doubles, while `createMlsMpmGridSpec()` grows the grid dimensions and node
  count at the same smoothing/grid spacing.
- `tests/contract-fixtures.test.mjs` now checks the `ulg-runtime`
  `sph.phase.rebuild` service contract and task capsule shape.
- `tests/chemistryReactionCandidates.test.mjs` covers lowercase/formula
  parsing, Li/Na/Cs water reactions through the same balanced family, Na/Cl and
  Na/Cl2 binary ionic candidates, and non-1:1 products such as MgCl2 and
  Al2O3 without claiming scientific validation.
- `tests/reactionDiscovery.test.mjs` now verifies the SPH adapter consumes the
  general candidate layer for lighter integration cases, carries balanced
  stoichiometry into reaction records, and updates Fe + H2O from the old FeOH
  reduced product to balanced Fe(OH)2.
- Browser probes against the live HTTPS Vite server verified a box X-size
  change from 5 m to 10 m submitted a supervised `sph.phase.rebuild` worker
  task, applied `peercompute-worker-packed-state`, and reported
  `mls grid : dims=30x18x18 nodes=9720 dx=0.400m`.

Validation status:

- PASS: `node --test tests/contract-fixtures.test.mjs
  tests/sphPhaseRenderer.test.mjs tests/chemistryReactionCandidates.test.mjs
  tests/reactiveChemistry.test.mjs` (`22/22`).
- PASS: `node --test tests/reactionDiscovery.test.mjs` (`7/7`, slow because it
  still derives product closures for integration evidence).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: manual HTTPS Chromium worker/grid probe: `sph.phase.rebuild` completed
  in `ulg-runtime`, status showed `peercompute-worker-packed-state`, closure
  cache hits, idle CPU closure task, and expanded MLS grid dimensions.
- PASS: syntax checks for touched runtime, worker, scene, mount, and test files.
- PASS: `npm run build` and `npm run build:pages`, both with the existing Vite
  large-chunk warning.
- PASS: `git diff --check`.

Additional local closure-cache invalidation gate:

- Browser probe seeded an old v1 material-name-only localStorage cache and then
  loaded the SPH demo. The runtime rejected it as `schema-mismatch`, reported
  `stale=1`, derived fresh values, and wrote v2 hash-keyed records with
  generator fingerprints, input hashes, and a material index.
- Focused SPH e2e now expects the v2 cache schema and a `ulg:*` generator
  fingerprint in the write result.

Validation status:

- PASS: manual HTTPS Chromium cache probe reported previous schema
  `peercompute.ulg.local-derived-closure-cache.v1`, write schema
  `peercompute.ulg.local-derived-closure-cache.v2`, generator fingerprint
  `ulg:653567f6`, and material index keys for H2O/Fe/air/H2/O2/FeOH2.
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: `npm run build` and `npm run build:pages` with the existing Vite
  large-chunk warning.
- PASS: `git diff --check`.

Reaction stoichiometry and energetics gates:

- ABI tests should lock a balanced reaction-closure schema with reactant term
  rows, product term rows, gas-product routing rows, validity rows, and
  provenance hashes.
- Candidate tests should prove Li/H2O, Na/H2O, and Cs/H2O are discovered through
  one general active-metal/water path and emit hydroxide plus H2 byproduct
  stoichiometry.
- Candidate tests should prove Na/Cl2, Mg/Cl2, and Al/O2 balance exact integer
  coefficients without material-specific scripts.
- Strict-mode tests should reject any executable reaction carrying
  `provisional-heuristic-not-scientifically-validated`; a bad fast energy sign
  must become `needs-refined-thermochemistry`, not a heuristic reaction.
- CPU runtime tests should consume macro-particle moles by limiting reactant and
  produce all products by coefficient while conserving atoms, charge, mass, and
  energy within declared tolerances.
- Gas byproduct tests should route H2 or vapor products into a gas inventory and
  derive sealed-box pressure from gas moles, volume, temperature, and EOS.
- WebGPU parity tests should compare resident reaction product masses, gas
  moles, heat, phase reset, and compact pressure summaries against the CPU
  reference without full particle readback.
- Browser e2e should verify cold reaction-closure derivation reports a visible
  worker/GPU task, cache hits avoid the multi-minute freeze on later runs, and
  stale reaction closures are ignored after generator changes.

Phase-resolved steam optics gates:

- Unit tests should prove H2O solid, liquid, gas, and condensed-droplet steam
  build distinct optical cache keys and optical GPU rows.
- Pure H2O vapor should remain high-transmission/low-opacity when no condensed
  droplet fraction is derived.
- Supersaturated vapor with a derived droplet fraction should increase
  scattering/extinction and render as a visible steam/cloud surface.
- Cache tests should reject optical rows when phase, temperature/pressure/density
  bucket, droplet summary, path length, or generator fingerprint changes.
- Browser e2e should expose optical mode diagnostics for liquid water, pure
  vapor, and condensed steam.

SPH cold-start/cache performance gates:

- Worker rebuild timing now records cache lookup, worker rebuild, clear-cache,
  and cached interactive-driver spans; remaining gates need finer subspans for
  material closure derivation, reaction discovery, product closure derivation,
  optical table construction, thermal graph packing, and GPU upload/warmup.
- Add tests that material closure cache hits are actually included in
  `sph.phase.rebuild` task options and consumed by the worker.
- Added tests that reaction discovery caches material-property-backed reactions
  by material/provenance hash instead of disabling the cache, including a
  persisted-record hit path.
- Browser e2e now verifies worker-first SPH startup exposes cold-cache status,
  persisted cold-start records, clear-cache UI presence, timing trace state, and
  cached Na/H2O stepping. Remaining gates still need explicit stale rejection
  and warm-reload delta assertions.
- Add tests for persisted thermal graph/phase-response, optical/PBR, static
  table, and GPU warmup metadata cache hits that skip deterministic
  reconstruction while preserving ABI/generator invalidation.
- Add browser e2e coverage for the SPH `clear cache` button: it must delete
  only ULG SPH cache families, reset in-memory cache signatures, report cleared
  counts, force a cold rebuild, and then allow a warm reload to repopulate
  cache hits.

WebGPU material-property resolver migration gates:

- Add a resolver-manifest test that enumerates every material-property resolver
  family, current CPU entrypoint, GPU target schema, cache key fields, and
  fallback status.
- Add optical tests proving relativistic/interband metal optics are
  `webgpu-derived`, not only `webgpu-consumed`, and match the CPU
  Drude-Lorentz/CIE reference within declared tolerance.
- Add thermal/mechanics/EOS tests proving phase-response, EOS, modulus,
  viscosity/transport, and mechanics reset rows can be resolved from
  GPU-resident material rows without main-thread CPU closure work.
- Add element/compound solver tests that compare WebGPU radial Kohn-Sham/KH
  and molecular closure outputs against CPU references for a small element and
  molecule suite.
- Add reaction tests proving balanced multi-product closure execution runs from
  resident WebGPU term tables, including gas byproducts and pressure summaries.
- Add radiation tests locking the isotope/channel/Cherenkov buffer schemas and
  requiring explicit validation blockers until the physics is benchmarked.
- Add browser e2e checks for warning banners when WebGPU is unavailable or any
  closure resolver falls back to CPU/main-thread work.

Overarching completion plan gates:

- Before starting each implementation phase in
  `plan/todo/overarching-completion-plan.md`, run or record the relevant
  baseline focused tests so regressions are attributable to the current phase.
- Each completed phase must update `plan/implementation-status.md`,
  `plan/log.md`, and the specific source todo file with concrete validation
  evidence before the overarching plan marks that phase done.
- Phase advancement requires that known validation blockers remain explicit;
  no phase may clear `scientificValidation` or `fullPhysicsValidation` by
  implication.
- Final completion requires cold/warm/clear-cache probes, reaction fixtures,
  steam/phase optical fixtures, GPU no-full-readback evidence, and profiler
  evidence for the demo hot loop.

Resident reaction term-table slice, 2026-06-11 21:08 AKDT:

- `node --check src/runtime/sph/sphReactionGpuKernel.js && node --check src/runtime/sph/sphColdStartCache.js && node --check ulg-gpu-abi/src/wgsl.js`
  - Passed.
- `node --test tests/sphReactionGpuKernel.test.mjs tests/sphColdStartCache.test.mjs tests/abi.test.mjs`
  - Passed, `30/30`.
  - Covers packed reaction table term rows, gas routing metadata, CPU resident
    fixed-buffer extent execution, excess-reactant preservation, unplaced gas
    product ledgers, static table cache rehydration, and WGSL ABI regex guards.
- `git diff --check`
  - Passed.

Browser WebGPU surface draw smoke,
2026-06-12 03:49 AKDT:

- `node --check ulg-gpu-abi/src/wgsl.js && node --check tests/abi.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/playwright.config.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `40/40`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Covers real Chromium WebGPU adapter/device acquisition, shader
    compilation/dispatch, compact vertex rows, draw rows, and parity against a
    tiny CPU fixture.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, using the normal browser config without unsafe WebGPU flags.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index --repo ulg`
  - Passed, `237` files indexed.
- `python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py build-memory --repo ulg`
  - Passed, `237` files / `1096` chunks.
- Infinite Context Coder refresh:
  - `python3 scripts/codebase_tool.py index --repo ulg` passed, `237` files.
  - `python3 scripts/codebase_tool.py build-memory --repo ulg` passed, `237`
    files / `1088` chunks.

Resident product-event merge coverage, 2026-06-12 00:22 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `11/11`.
  - Adds direct coverage for GPU copy concatenation of carried and newly emitted
    resident product-event buffers, cumulative generation metadata, carry-forward
    through `nextParticleUploads`, and destruction ownership.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `58/58`.
  - Rechecks resident product mass through repeated MLS-MPM steps, P2G product
    mass consumption, render-field consumption, phase-demo pressure summaries,
    and renderer surface behavior.
- `git diff --check`
  - Passed.

Resident gas-species pressure continuity, 2026-06-12 00:30 AKDT:

- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphReactionGpuSummary.test.mjs`
  - Passed, `33/33`.
  - Covers resident product-mass gas ledger merge, pressure summary preference
    for the merged handle, and reaction summary gas/product decoders.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuSummary.test.mjs`
  - Passed, `67/67`.
  - Rechecks P2G/render/phase pressure and renderer behavior after the pressure
    source update.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident overlay draw order checkpoint,
2026-06-12 08:33 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|transparent|vapor|steam"`
  - Passed, `15/15` renderer file tests executed.
  - Covers resident overlay ordering by render policy metadata, vapor
    visibility, transparent solid policy, and transparent render ordering.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- Full SPH e2e with `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1`
  - Timed out before resident readback status in headless Chromium, matching
    the prior full unsafe-WebGPU limitation. The focused offscreen WebGPU shader
    smoke remains the useful overlay evidence.

Resident overlay optical/PBR rows checkpoint,
2026-06-12 08:44 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical"`
  - Passed, `16/16` renderer file tests executed.
  - Covers resident overlay draw order and the shader-source guard that keeps
    closure-derived optical records bound into the overlay path.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `57/57`.
  - Covers renderer policy, surface draw metadata, compact draw rows, and ABI
    assumptions after the overlay optical binding change.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Browser-compiles and submits the raw WebGPU overlay with a bound optical
    GPU record buffer.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers the live demo exposing `closure-derived-optical-gpu-table` and the
    resident overlay optical record count in snapshots/status.

Resident overlay depth attachment checkpoint,
2026-06-12 08:55 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical|draw order"`
  - Passed, `16/16` renderer file tests executed.
  - Covers resident draw ordering, overlay pipeline classification, depth
    format export, and closure-derived optical shader binding.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Covers the resident overlay shader path with depth-enabled pipelines and a
    pixel-readback proof that far transparent and far opaque draws are occluded
    by a near opaque depth write.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers live bridge telemetry for `opaque-depth-write-transparent-depth-test`,
    `depth24plus`, and depth attachment readiness.

Resident overlay weighted blended OIT checkpoint,
2026-06-12 09:05 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical|draw order"`
  - Passed, `16/16` renderer file tests executed.
  - Covers OIT constants and shader entry-point guards alongside resident draw
    ordering and optical table binding.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Covers the resident overlay shader, OIT accumulation/composite pipeline
    submission, and the depth pixel-readback proof.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers the live default scene reporting `weighted-blended-oit`,
    `rgba16float`, `rgba8unorm`, OIT target readiness, and transparent draw
    count.

Resident overlay optical attenuation and IOR checkpoint,
2026-06-12 09:10 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical"`
  - Passed, `16/16` renderer file tests executed.
  - Covers shader-source guards for closure-derived attenuation, optical depth,
    scattering coefficient, and IOR/Fresnel fields.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Browser-compiles and submits the updated WGSL with the expanded optical
    struct and keeps the depth pixel-readback proof passing.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident overlay spectral rows checkpoint,
2026-06-12 09:16 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`,
  `tests/sphPhaseRenderer.test.mjs`, and `tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident overlay|optical"`
  - Passed, `16/16` renderer file tests executed.
  - Covers shader-source guards for spectral sample binding, wavelength tinting,
    and bounded spectral row traversal.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
  - Browser-compiles and submits the updated overlay shader with both optical
    material records and spectral sample storage buffers bound.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers live bridge telemetry for spectral sample count and stride matching
    the optical GPU table.
- `npm test`
  - Passed, `409/409`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/` with `docs/assets/pages-B89kFbUC.js`.
- `git diff --check`
  - Passed.
- Infinite Context Coder `index --repo ulg` and `build-memory --repo ulg`
  - Passed, `237` files indexed and `1104` memory chunks built.

GPU surface draw compaction checkpoint,
2026-06-12 03:28 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `40/40`.
  - Covers the new `sphRenderSurfaceDrawWgsl` ABI exposure, the real WebGPU
    builder path, compact vertex buffer draw-source contract, retained
    no-full-readback draw/vertex buffers, and CPU draw metadata parity wrappers.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `106/106`.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `curl -k -I --max-time 10 https://127.0.0.1:5173/`
  - Passed, HTTP `200`.
- `ss -ltnp | rg ':5173'`
  - Passed, Vite is listening on `0.0.0.0:5173`.
- Infinite Context Coder refresh:
  - `python3 scripts/codebase_tool.py index --repo ulg` passed, `237` files.
  - `python3 scripts/codebase_tool.py build-memory --repo ulg` passed, `236`
    files / `1028` chunks.
- `git diff --check`
  - Passed.

Deterministic surface-vertex emission checkpoint,
2026-06-12 03:06 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `36/36`.
  - Covers the new surface-vertex schemas, f32x4 row layout, WGSL fixed-slot
    emitter contract, CPU tetrahedralized render-field vertex emission,
    optional WebGPU parity wrapper, no-full-readback render-field buffer
    retention, and the `12/36` marching-cube cell reservation.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `102/102`.
- `npm test`
  - Passed, `403/403`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index --repo ulg`
  - Passed.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py build-memory --repo ulg`
  - Passed.

Surface draw metadata checkpoint,
2026-06-12 03:15 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `38/38`.
  - Covers the new surface-draw schemas, f32x4 row layout, CPU draw metadata
    bucketing from compact surface vertices, and optional WebGPU parity wrapper.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `104/104`.
- `npm test`
  - Passed, `405/405`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py index --repo ulg`
  - Passed.
- `PATH=/home/cos/projects/infinite_context_coder/.venv/bin:$PATH python3 /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py build-memory --repo ulg`
  - Passed.
- `git diff --check`
  - Passed.

Sealed-gas pressure-cell field contract, 2026-06-12 00:34 AKDT:

- `node --check src/runtime/sphPhaseDemo.js`
  - Passed.
- `node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs`
  - Passed, `14/14`.
  - Covers the uniform sealed-gas pressure-cell field, zero pressure gradient,
    explicit force-coupling prerequisites, and the surface-normal blocker.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuSummary.test.mjs`
  - Passed, `67/67`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `git diff --check`
  - Passed.
- `node --test tests/reactiveChemistry.test.mjs tests/reactionDiscovery.test.mjs tests/chemistryReactionCandidates.test.mjs tests/sphPhaseDemo.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphColdStartCache.test.mjs`
  - Passed, `54/54`.
  - Covers the broader CPU chemistry, reaction discovery, SPH demo, resident
    MLS-MPM handoff, static-cache, and resident reaction CPU reference paths.
- `npm run build:pages`
  - Passed; generated `docs/assets/pages-LrVu5lFx.js` and rewired
    `docs/index.html`, with the existing Vite large-chunk warning.
- `npm run build`
  - Passed, with the existing Vite large-chunk warning.
- `npm test`
  - Passed, `361/361`.
- `node --check tests/demo.e2e.mjs`
  - Passed after changing the derived-material SPH browser test to wait for the
    worker-produced preflight after a cache clear.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 npx playwright test --config tests/playwright.config.mjs -g "SPH phase demo"`
  - Passed, `4/4`, against the live HTTPS Vite server.

Remaining reaction test gates:

- Add strict gate tests that consume the compact atom/charge/mass residuals and
  reject executable reactions when residuals or energetics are outside declared
  tolerance.
- Add browser/WebGPU e2e that proves resident reaction term-table execution can
  run without full particle readback and expose those compact summaries.

Resident product inventory, atom residual, and cache coverage slice,
2026-06-11 22:30 AKDT:

- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/services/ulgRuntime.worker.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/abi.test.mjs && node --check tests/sphReactionGpuSummary.test.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/ulgRuntimeWorkerCacheCoverage.test.mjs`
  - Passed.
- `node --test tests/abi.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/ulgRuntimeWorkerCacheCoverage.test.mjs`
  - Passed, `33/33`.
  - Covers product-inventory readback, atom-residual decoder aggregation,
    atom-residual WebGPU command-stream wiring, resident repeated-step
    diagnostics, ABI/WGSL guards, and worker static-table coverage rejecting
    changed reaction contact radius while ignoring particle count alone.
- `node --test tests/sphColdStartCache.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed, `23/23`.
  - Covers static-table serialization/rehydration, resident reaction table
    packing, SPH demo pressure diagnostics, and baseline demo construction.

New performance/rendering gate added:

- Add WebGPU marching-cubes tests under the hot-loop phase. Required evidence:
  GPU field build, active-cell classification, prefix/compaction, triangle and
  normal emission, material/phase/optical ids, and no CPU mesh extraction during
  normal rendering.

Strict reaction gate and pressure feedback slice, 2026-06-11 22:38 AKDT:

- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/runtime/sphPhaseDemo.js && node --check src/runtime/sphPhaseViewState.js && node --check src/services/ulgRuntime.worker.js && node --check src/visualization/sphPhaseDemoMount.js && node --check tests/sphReactionGpuSummary.test.mjs && node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/sphPhaseDemo.test.mjs`
  - Passed.
- `node --test tests/sphReactionGpuSummary.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed, `27/27`.
  - Covers strict reaction gate pass/block behavior, resident diagnostics,
    baseline/resident gas pressure, per-wall pressure feedback, and strict-gate
    blocking of force coupling.
- `node --test tests/abi.test.mjs tests/sphReactionGpuKernel.test.mjs tests/sphColdStartCache.test.mjs tests/ulgRuntimeWorkerCacheCoverage.test.mjs`
  - Passed, `31/31`.
  - Rechecks ABI, resident reaction table packing, static-table cache
    rehydration, and worker cache coverage after the pressure/gate changes.

Rendered-blob flicker stabilization, 2026-06-12 00:14 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --check src/runtime/sph/sphMlsMpmGpuStep.js`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs`
  - Passed, `12/12`.
  - Covers render-field hysteresis and stable intra-layer render ordering.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `31/31`.
  - Rechecks compact render rows/fields, renderer batching/ordering, and the
    resident MLS-MPM handoff path while the resident product-mass merge work is
    in progress.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo opens collapsed"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- Browser visual probe against `https://127.0.0.1:5173/?drop=fe&base=h2o&dropt=1850&baset=233.15&dropn=3&basen=3&boxx=5&boxy=5&boxz=5`
  - Passed. Sampled 24 frames; visible marching-cubes surface count stayed
    stable at `2/2`; render orders were finite and stable.
  - Screenshot: `test-results/sph-blob-flicker-check.png`.
- `npm test`
  - Passed, `384/384`.
- `git diff --check`
  - Passed.

Phase-resolved H2O vapor optics and optical lookup ABI diagnostics,
2026-06-12 00:55 AKDT:

- `node --check src/runtime/material/opticalClosure.js && node --check src/runtime/material/opticalGpuBuffers.js && node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check ulg-gpu-abi/src/index.js && node --check ulg-gpu-abi/src/wgsl.js`
  - Passed.
- `node --test tests/opticalClosure.test.mjs`
  - Passed, `10/10`.
  - Covers H2O gas pure-vapor versus supersaturated condensed-droplet optical
    response, droplet-radius sensitivity, spectral scatter, and cache cloning.
- `node --test tests/opticalGpuBuffers.test.mjs`
  - Passed, `16/16`.
  - Covers optical-state-key table dedupe, optical-state-id lookup matching,
    appended optical-depth/scatter/absorption/state-id output rows, CPU/WebGPU
    WGSL stride guards, and parity behavior.
- `node --test tests/sphPhaseDemo.test.mjs`
  - Passed, `15/15`.
  - Covers sealed-box H2O vapor optical state derivation, pressure bucketing,
    condensation microphysics status, and no optical state on non-gas H2O
    descriptors.
- `node --test tests/abi.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `29/29`.
  - Covers the 16-float optical lookup ABI and renderer separation of clear
    vapor from condensed-droplet steam through closure-derived scatter/depth.
- `node --test tests/opticalClosure.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed, `62/62`.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphReactionGpuSummary.test.mjs tests/sphPhaseDemo.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `84/84`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `npm test`
  - Passed, `387/387`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Conservative pressure-interface force solver checkpoint,
2026-06-12 01:55 AKDT:

- `node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseDemo.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs tests/abi.test.mjs`
  - Passed, `34/34`.
  - Covers `peercompute.ulg.sph-pressure-interface-force-solver.v0`, the
    16-float force row layout, solver-ready-not-applied status, equal/opposite
    material/gas force rows, zero pairwise residuals, and blocked empty-input
    behavior.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `59/59`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, with live resident render diagnostics exposing the
    pressure-interface force solver artifact.
- `npm test`
  - Passed, `393/393`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Local interface elements and pressure-force preview checkpoint,
2026-06-12 01:18 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/sphPhaseDemo.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `56/56`.
  - Covers local interface element row layout, element row/object emission,
    aggregate area consistency, pressure/interface coupling, strict-gate
    override, and non-applied pressure-force previews.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, with resident render diagnostics exposing previewed
    interface element count and non-applied pressure-force preview status.
- `npm test`
  - Passed, `390/390`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Material-interface field and pressure/interface coupling checkpoint,
2026-06-12 01:09 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js && node --check tests/sphRenderGpuKernel.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `27/27`.
  - Covers `peercompute.ulg.sph-material-interface-field.v0`, threshold-crossing
    area/normal/centroid derivation from render fields, and ABI schema exposure.
- `node --check src/runtime/sphPhaseDemo.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseDemo.test.mjs && node --check tests/demo.e2e.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `55/55`.
  - Covers pressure/interface coupling readiness, strict-gate override, no force
    validation, resident render-field interface diagnostics, and existing
    renderer/ABI contracts.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, with live resident render-state diagnostics exposing
    material-interface and pressure/interface coupling readiness while force
    coupling remains blocked on the missing solver.
- `npm test`
  - Passed, `389/389`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Rendered blob flicker guard checkpoint, 2026-06-12 01:28 AKDT:

- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  - Passed, `22/22`.
  - Covers render-field hysteresis, stable render ordering, transparent
    depth-write handling, material identity separation, render-field splatting,
    and material-interface extraction.
- `git diff --check`
  - Passed.
- `npm test`
  - Passed, `390/390`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- tests/demo.e2e.mjs`
  - Partial: SPH/runtime-relevant browser coverage passed (`5/5` after the
    first smoke), including URL-param startup, clear cache, derived-material SPH,
    Na + H2O, and cached-closure oscillator.
  - Known unrelated failure: the legacy supervised service smoke timed out at
    `window.__ulgDemo.telemetry.services?.length === 2`.

GPU-shaped material-interface candidate buffer checkpoint,
2026-06-12 01:45 AKDT:

- `node --check ulg-gpu-abi/src/wgsl.js && node --check src/runtime/sph/sphRenderGpuKernel.js && node --check tests/abi.test.mjs && node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `30/30`.
  - Covers the candidate-field schemas, f32x4 candidate row layout, WGSL
    bindings, deterministic fixed cell-axis candidate rows, candidate-to-element
    compaction, optional WebGPU acceptance, and parity-failure fallback.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs tests/sphPhaseRenderer.test.mjs tests/abi.test.mjs`
  - Passed, `59/59`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `git diff --check`
  - Passed.
- `npm test`
  - Passed, `393/393`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Pressure-interface grid-force consumer and flicker path coverage checkpoint,
2026-06-12 02:12 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseRenderer.test.mjs && node --check src/runtime/sph/sphGridUpdateGpuKernel.js && node --check ulg-gpu-abi/src/wgsl.js`
  - Passed.
- `node --check tests/sphMlsMpmGpuStep.test.mjs && node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/abi.test.mjs`
  - Passed, `43/43`.
  - Covers the direct rendered-blob inactive-grace path, pressure-force row
    consumption by MLS-MPM grid update, optional WebGPU forwarding of retained
    pressure-force row buffers, and ABI exposure of the grid-update pressure
    force binding.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `95/95`.
- `npm test`
  - Passed, `396/396`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Resident pressure-interface force routing checkpoint,
2026-06-12 02:23 AKDT:

- `node --check src/runtime/sph/sphMlsMpmGpuStep.js && node --check src/visualization/sphPhaseScene.js && node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs`
  - Passed, `14/14`.
  - Covers pressure-interface solver rows reaching resident grid update and
    resident diagnostics reporting `pressure-interface-grid-force-consumer-applied`.
- `node --test tests/sphGridGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseDemo.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseRenderer.test.mjs tests/sphReactionGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `96/96`.
- `npm test`
  - Passed, `397/397`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Rendered-blob flicker confirmation and GPU marching-cube classification checkpoint,
2026-06-12 02:45 AKDT:

- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "hysteresis|grace"`
  - Passed, `13/13` in the renderer file.
  - Covers render-field threshold hysteresis and direct inactive-grace behavior
    for retaining the last valid mesh before hide/reset.
- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --check tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `34/34`.
  - Covers no-full-readback render-field buffer retention, CPU marching-cube
    voxel classification, optional WebGPU parity acceptance, resident
    no-readback marching-cube execution, and ABI/WGSL layout exposure.
- `npm test -- --test-name-pattern "SPH|sph|material|reaction|optical|thermal|MLS-MPM|render"`
  - Passed, `401/401`.
- `npm test`
  - Passed, `401/401`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident surface draw sidecar checkpoint,
2026-06-12 07:30 AKDT:

- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check src/visualization/sphPhaseDemoMount.js`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs tests/sphPhaseRenderer.test.mjs`
  - Passed, `53/53`.
  - Covers the retained WebGPU surface draw builder, ABI/WGSL layout exposure,
    and the existing flicker/hysteresis renderer guard while the live bridge is
    being wired.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Covers the live resident render path publishing
    `peercompute.ulg.sph-resident-surface-draw.v0`, retaining compact draw
    buffers without full draw readback, and exposing the `surface draw` overlay
    status line.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Browser-compiles and dispatches the surface draw WGSL in Chromium WebGPU.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.

Surface draw indirect and WebGPU overlay bridge checkpoint,
2026-06-12 08:05 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`, `tests/demo.e2e.mjs`,
  `src/runtime/sph/sphRenderGpuKernel.js`, `ulg-gpu-abi/src/wgsl.js`,
  `tests/sphRenderGpuKernel.test.mjs`, and `tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `40/40`.
  - Covers the u32 draw-indirect ABI row, CPU/WebGPU surface draw metadata
    emission, retained indirect buffer behavior, and WGSL binding exposure.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
  - Browser-compiles the resident surface draw shader, verifies compacted draw
    rows, and submits the raw-WebGPU overlay shader through an offscreen render
    target with `drawIndirect()`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
- `npm test`
  - Passed, `407/407`.
- `npm run build`
  - Passed.
- `npm run build:pages`
  - Passed and regenerated `docs/`.
- Full SPH e2e with `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1` timed out before
  resident readback status in headless Chromium and is not used as overlay
  evidence. The focused offscreen render-target smoke is the useful proof for
  the overlay shader plus indirect draw command path.

Vapor visibility from derived optics checkpoint,
2026-06-12 08:12 AKDT:

- `node --check src/visualization/sphPhaseScene.js && node --check tests/sphPhaseRenderer.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "vapor|steam|hysteresis|grace|transparent"`
  - Passed, `14/14` renderer file tests executed.
  - Covers optically thin pure vapor hiding, droplet steam visibility, liquid
    water remaining geometrically visible, render-field hysteresis, inactive
    grace-frame behavior, and transparent render ordering contracts.
- `node --test tests/sphPhaseRenderer.test.mjs tests/opticalClosure.test.mjs tests/opticalGpuBuffers.test.mjs tests/sphRenderGpuKernel.test.mjs tests/sphPhaseDemo.test.mjs`
  - Passed, `80/80`.
  - Covers derived vapor microphysics, optical GPU row packing/lookup, resident
    render row optical state, and SPH pressure-driven vapor state plumbing.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Resident draw transparency policy checkpoint,
2026-06-12 08:23 AKDT:

- Syntax checks for `src/visualization/sphPhaseScene.js`,
  `src/runtime/sph/sphRenderGpuKernel.js`, `ulg-gpu-abi/src/wgsl.js`,
  `tests/sphPhaseRenderer.test.mjs`, `tests/sphRenderGpuKernel.test.mjs`, and
  `tests/abi.test.mjs`
  - Passed.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs tests/abi.test.mjs`
  - Passed, `55/55`.
  - Covers transparent solid/glass-like render policy, explicit surface-table
    policy slots, CPU draw metadata preservation, and WGSL use of explicit
    transparency/depth policy.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH surface draw WebGPU shader"`
  - Passed, `1/1`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.

Manual headed SPH watch and WebGPU validation cleanup,
2026-06-12 10:20 AKDT:

- `node --check src/runtime/sph/sphGridGpuKernel.js && node --check tests/sphGridGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphGridGpuKernel.test.mjs --test-name-pattern "product-event row|P2G|resident product"`
  - Passed, `14/14`.
  - Covers the full-row placeholder for zero resident product-event storage
    bindings.
- `node --test tests/sphGridUpdateGpuKernel.test.mjs --test-name-pattern "pressure-force|grid update"`
  - Passed, `9/9`.
  - Covers the full-row placeholder for zero pressure-interface force storage
    bindings.
- `node --test tests/opticalGpuBuffers.test.mjs --test-name-pattern "spectral|upload"`
  - Passed, `17/17`.
  - Covers the full-row placeholder for empty optical spectral-sample storage
    bindings.
- `node --test tests/sphMlsMpmGpuStep.test.mjs tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident|overlay|retains|ping-pong|product|render"`
  - Passed, `31/31`.
  - Covers resident ping-pong, product-event merge, overlay retention, and
    renderer contracts after resident scheduling was serialized.
- Manual headed Chromium:
  - URL: `https://127.0.0.1:5173/?sph=1`
  - Evidence folder: `test-results/manual-sph-watch-running-serialized/`
  - Result: zero WebGPU warnings, no crash, one non-critical 404 resource error,
    resident backend `webgpu`, resident readback `actual=no-full-readback`,
    surface draw bridge `webgpu-storage-indirect-overlay`, render fps about 38,
    resident fps about 3.9 after 90 seconds of Play.

Resident pressure-force buffer and FPS cleanup,
2026-06-12 10:45 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check src/visualization/sphPhaseScene.js && node --check tests/demo.e2e.mjs`
  - Passed.
- `node --check src/runtime/sph/sphReactionGpuSummary.js && node --check tests/sphMlsMpmGpuStep.test.mjs`
  - Passed.
- `node --check tests/sphGridGpuKernel.test.mjs`
  - Passed.
- `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "pressure-interface|resident step routes|grid update"`
  - Passed, `14/14`.
  - Covers pressure-interface force rows flowing through the resident step into
    MLS-MPM grid update.
- `node --test tests/sphPhaseDemo.test.mjs --test-name-pattern "pressure interface|force preview|pressure feedback"`
  - Passed, `17/17`.
  - Covers sealed-gas pressure feedback, interface summaries, preview tractions,
    and solver force rows.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident|overlay|pressure|interface|render"`
  - Passed, `17/17`.
- `node --test tests/sphGridGpuKernel.test.mjs --test-name-pattern "resident product|P2G|product-event row"`
  - Passed, `14/14`.
  - Covers retained product-event mass, velocity, and EOS sidecar status in P2G.
- `node --test tests/sphReactionGpuSummary.test.mjs --test-name-pattern "product|summary|strict|gas|atom"`
  - Passed, `8/8`.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`.
  - Covers live browser summary fields for pressure force rows, resident render
    state, and the FPS banner path.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH resident overlay depth attachment|SPH surface draw WebGPU shader"`
  - Passed, `2/2`.
- `git diff --check`
  - Passed.
- `npm run build`
  - Passed with the existing Vite large-chunk warning.
- `npm run build:pages`
  - Passed with the existing Vite large-chunk warning and regenerated `docs/`.

Resident render no-full-readback publication checkpoint,
2026-06-12 11:58 AKDT:

- `node --check src/runtime/sph/sphRenderGpuKernel.js`
  - Passed.
- `node --check src/visualization/sphPhaseScene.js`
  - Passed.
- `node --check tests/sphRenderGpuKernel.test.mjs`
  - Passed.
- `node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "render row|render field|surface draw|no-full-readback|resident"`
  - Passed, `26/26`.
  - Covers resident render-row extraction without full CPU readback, retained
    render-row buffers, no-full render-field buffers, resident surface vertices,
    and surface draw buffers.
- `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "resident|overlay|render|pressure|interface|surface"`
  - Passed, `17/17`.
  - Covers resident overlay ordering/retention, render-field visibility, vapor
    visibility, pressure/interface renderer contracts, and surface batching.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, against the live HTTPS Vite server.
  - Browser coverage now expects `resident-gpu-render-field` with render rows in
    `no-full-readback`, zero render-row CPU readback bytes, hot-loop
    no-full-readback, retained resident surface table metadata, and resident
    surface-draw buffers.
- Manual inline Playwright probes were attempted to sample scalar status and
  screenshots over time, but both hung in headless Chromium/SwiftShader before
  producing app samples. The exact probe processes were stopped; no inline
  probe process remained afterward.
- `npm run build`
  - Passed with the existing Vite large-chunk warning.

Resident playback motion and Three fallback cadence,
2026-06-12 13:26 AKDT:

- `node --check src/visualization/sphPhaseDemoMount.js && node --check tests/demo.e2e.mjs`
  - Passed.
- `node --test tests/sphRenderGpuKernel.test.mjs --test-name-pattern "surface vertices orient|surface vertices compact|surface draw metadata buckets"`
  - Passed, `27/27`.
  - Reconfirms the corrected surface normal orientation and resident surface
    draw metadata while the visible path is using Three/MarchingCubes fallback.
- `git diff --check`
  - Passed.
- `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_WEB_SERVER_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npm run test:e2e -- --grep "SPH phase demo runs derived material properties"`
  - Passed, `1/1`, about 1.6 minutes.
  - Browser coverage now accepts the Three fallback contract:
    `renderFieldReadback=true`, render-state
    `normalHotLoopReadbackFree=false`, material-interface fields may be
    `material-interface-field-ready`, render-field input may include
    product-event buffers, and primary H2O optics are still checked through the
    rendered material state.
- `npm run build`
  - Passed with the existing Vite large-chunk warning.
- `npm run build:pages`
  - Passed with the existing Vite large-chunk warning and regenerated `docs/`.
- Manual inline Chromium/WebGPU probe against `https://127.0.0.1:5173/?sph=1`
  - Passed.
  - Evidence: `t20` built `pressureRows=152`; `t60` continued from
    `previous-gpu-resident-output` with `nextStep=4`, `nextTime=0.002`,
    `maxDx=0.09532373398542404`, `motionStatus=motion-proven`, and render
    cadence `reason=resident-motion-proven-visual-refresh`; `t90` reached
    `nextStep=6`, `nextTime=0.003`, `maxDx=0.13504351675510406`, and remained
    visible through `resident-gpu-render-field`.
