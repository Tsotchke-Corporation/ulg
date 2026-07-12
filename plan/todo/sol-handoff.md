# SOL Refactor Handoff

Date: 2026-07-12 12:08 AKDT

Branch: `gpu-resident-physics-refactor`

HEAD at pause: `b4d1a38` (`Add GPU timestamp attribution and sparse planning contracts`)

Status: feature work paused at the user's request. The checkout was stabilized
and documented, but the refactor is not complete and the current worktree is
not a commit-ready clean point.

## Read This First

The immediate trajectory changed on 2026-07-12. Do not resume broad refactor
work from the middle of this tree. Establish a fresh visual and performance
baseline first, then take one independently reversible slice at a time.

The following constraints remain authoritative:

- do not add a CPU mirror/reference solver to the production acceptance path;
- do not reintroduce readback/reupload into the normal hot loop;
- do not implement scenario-, material-, element-, or reaction-pair patches;
- keep accepted mutations under ComputeManager/GPUHub/StateManager authority;
- keep native WebGPU surfaces as the production visual acceptance route;
- do not enable the new mutation-certificate lane until native GPU fail-close
  evidence exists;
- do not trust an old Vite process or an HMR-tainted browser capture.

The detailed branch plans contain stale progress statements. This handoff is
the current routing document until `plan/plan.md`, `plan/tests.md`,
`plan/STATUS.md`, `plan/implementation-status.md`, the branch README, and
`plan/todo/sol-critic.md` are reconciled from the evidence below.

## Stabilization At Handoff

The following cleanup was performed after stopping the active refactor slice:

- interrupted further mutation-certificate integration before any physics
  writer or fused hot-loop call site was changed;
- retained the certificate lane only as default-off infrastructure;
- terminated five stale ULG Vite trees, aged roughly three to eight days,
  including one rooted in a deleted Claude worktree;
- started one fresh Vite 8.0.16 server on `127.0.0.1:5320`, loaded the main
  application and mounted SPH screen, then shut the server down;
- added `/* @vite-ignore */` to the intentional runtime service-module import
  in `src/services/dummyService.worker.js`, removing the misleading Vite
  import-analysis warning without changing runtime resolution;
- updated `tests/sphKernelTimestampHooks.test.mjs` to require both current
  reaction passes, `reactionStepPropose` and `reactionStepResolve`, instead of
  the removed monolithic `reactionStep` source shape.

Fresh browser smoke evidence:

- main app: zero console errors, page errors, failed requests, or HTTP errors;
- mounted SPH screen: zero console errors, page errors, failed requests, or
  HTTP errors;
- title `ULG Triad`, WebGPU ready, one main app canvas and two canvases after
  the SPH screen mounts;
- screenshot: `/tmp/ulg-handoff-sph-smoke.png`.

The screenshot is **not** a surface-rendering acceptance artifact. It was
captured while material/reaction closure derivation was still active, before a
scenario produced a native surface frame. It only proves that the mounted
screen loads cleanly on a fresh server.

Validation at the pause point:

- focused lane/ABI/layout/renderer/optics suite: `252/252` passed;
- certificate lane suite alone: `17/17` passed;
- timestamp-hook test after the stale assertion repair: `3/3` passed;
- `npm run build`: passed with Vite 8.0.16, 187 modules transformed;
- full `npm test`: `1471` tests, `1468` passed, `0` failed, `3` skipped,
  duration `279162.421954 ms` under Node `v24.17.0`;
- no test Vite server was intentionally left running.

The production build still reports two nonfatal packaging warnings: the
Schroeder hierarchy is both statically and dynamically imported, and the main
bundle is larger than 500 kB. These are real cleanup targets, not runtime
validation failures.

The full-suite log is
`/tmp/ulg-npm-test-stabilization-patched-20260712.log`. The three skipped tests
are the existing opt-in long-horizon liquid acceptance gates; they require
`ULG_RUN_LONG_LIQUID_ATOMIC=1` and were not part of this basic stabilization
pass.

## Repository State

The branch has a very large uncommitted worktree. Before stabilization edits,
`git status --short` reported 181 modified/untracked paths; the final handoff
state reports 184. Do not use `git reset --hard`, checkout the tree away, or
assume every dirty path belongs to one coherent slice. The branch is ahead of
its remote, but the accepted work described here has not been captured in a
new ULG commit.

Important branch facts:

- ULG HEAD: `b4d1a38`;
- remote branch tip visible locally: `origin/gpu-resident-physics-refactor` at
  `23f4d9f`;
- sibling `/home/cos/projects/webgpu-marching-cubes` dependency is locally
  committed at `a154b33` (`Add batched native surface extraction`);
- ICC was refreshed after the handoff documentation settled: 527 files and
  3,881 memory chunks were indexed, with status and architecture artifacts
  written under `.icc/`.

No local ULG checkpoint commit was created because the fresh full visual
matrix, native certificate proof, and complete document reconciliation were
not all complete. That is intentional.

## Accepted Evidence

### Native surfaces and optics

Implemented behavior in the current tree includes one native presentation
owner, zero production `THREE.Points` fallback in native mode, opaque
unblended depth-writing PBR, generation-matched packed normals, a restored
native background pass, and spectral refraction admitted from quantum optical
provenance.

Accepted manufactured evidence:

- `/tmp/ulg-marching-cubes-packed-normal-probe.json`: `38/38` checks passed;
- `/tmp/ulg-native-refraction-science-probe.json`: `52/52` checks passed,
  including production shader compilation, one-submit execution, RGB
  dispersion, Beer-Lambert response, projection/DPR/resize checks, and
  fail-closed invalid rear geometry;
- `/tmp/ulg-native-surface-concurrent-profile-20260712.json`: warm batched
  native extraction evidence with no reported WebGPU errors.

Do not close `SURF-4`, `OPTICS-0`, or `OPTICS-1` solely from manufactured
evidence. The post-refactor standard scenario matrix has not been rerun and
visually inspected. The last complete seven-scenario matrix is from July 10
and predates later rendering changes.

### Gas-cell EOS and pressure residency

Accepted artifacts:

- `/tmp/ulg-sph-spatial-gas-cell-eos-gpu-stable-horizon-native-20260712.json`:
  `16/16` checks passed;
- `/tmp/ulg-mounted-gas-stable-horizon-fenced-fresh-vite-4x16-20260712.json`:
  `17/17` checks passed across four 16-substep schedules.

The mounted artifact proves an exact GPU-authored product prefix, stable
geometric physical-lane capacity, strict device/lane/state/source identity,
StateManager-admitted pressure consumption, shared-fence retirement, zero
normal-loop readback, zero browser/WebGPU errors, and a lane cache hit.

Remaining measured gas churn is `3` bind groups created and `3` reused per
generation. The misses are source-side product-arena bindings:

- `exact-prepare`: changing metadata and indirect buffers;
- `exact-group`: changing product row buffer;
- `reduce`: changing product row buffer.

A scheduler-owned, memory-budgeted stable product-arena horizon would remove
48 bind-group creations on the measured fourth schedule and avoid about
1.39 MB of allocation plus about 1.04 MB of history copy. It must be derived
from lane/memory policy, never from the `4x16` probe or a named scene.

### Sparse Schroeder and 300k capacity

Accepted artifacts:

- `/tmp/ulg-sph-fused-sparse-grid-actual-nodes.json`: status `pass`, 300,000
  particle capacity, 65,000 GPU-authored active nodes, capacity below the
  16,777,216-node dense grid, and no hot-state readback;
- `/tmp/ulg-schroeder-sparse-grid-actual-nodes.json`: status `pass` across the
  scale, overflow, mixed-source, stale-source, unsupported, and metamorphic
  cases;
- `/tmp/ulg-sph-fused-sparse-grid-overflow.json`: overflow fail-close evidence.

Actual-node sparse P2G/G2P integration is implemented. Keep `SS-0` open for
fresh cross-level conservation, mounted one-submission continuity, and the
full visual/performance matrix; do not reopen the already-proven dense-capacity
question without contrary evidence.

### Coherent solids

Accepted artifacts:

- `/tmp/ulg-coherent-solid-production-bridge.json`: `37/37` passed;
- `/tmp/ulg-coherent-solid-lifetime-proof-querycap.json`: `38/38` passed.

These cover ComputeManager/StateManager authority, persistent rest shape,
objective motion, compact invariant evidence, proxy ordering, momentum and
energy gates, workgroup/dispatch partition invariance, chart transition,
GPU-indirect visible composition, one submit per step, no hot-state readback,
and close-spaced visual continuity. `SOL-0` and `SOL-1` are supported by this
evidence, but the branch documentation still describes older `26`-check
status and needs reconciliation.

### Mutation-authored neighborhood certificate

This is the slice that was stopped when trajectory changed.

Files:

- `ulg-gpu-abi/src/residentNeighborhoodMutationCertificate.js`;
- `ulg-gpu-abi/src/residentNeighborhoodMutationCertificateWgsl.js`;
- `src/runtime/webgpuComputeLayout.js`;
- `src/runtime/sph/residentNeighborhoodGpuLane.js`;
- `tests/residentNeighborhoodMutationCertificate.test.mjs`;
- `tests/webgpuComputeLayout.test.mjs`;
- `tests/residentNeighborhoodGpuLane.test.mjs`.

What is implemented:

- fixed 16-word/64-byte certificate slot and accumulator ABI;
- closed stage/flag sets and fail-closed nonfinite/new-source evidence;
- upward-rounded positive-f32 L1 displacement bounds;
- validated dynamic storage offsets and minimum binding sizes;
- single-use `prepareGeneration` -> caller-owned writer-pass finalization ->
  `finishGeneration` lifecycle with cancel/release paths;
- rejection of caller-fabricated `REFERENCE_CHECKPOINT` and `writerSeen`;
- initial real checkpoint topology `3 dispatches / 1 lane pass`;
- certified topology `4 dispatches / 1 following lane pass`;
- legacy radix-lane unit benchmark unchanged at `245` warm compute passes;
- pool capability segregation and bounded two-in-flight slot behavior.

What is **not** implemented or accepted:

- no G2P, separation, or reaction-product writer binds the certificate;
- no fused production call site enables the capability;
- no native WebGPU compilation/execution of the certificate proof WGSL;
- stale nonce, missing writer, nonfinite position, activation, authority rebase,
  and reversed-submission fail-close behavior lack real GPU evidence;
- cancellation after writer recording assumes the caller discards the encoder;
- no mounted or 300k A/B result;
- no measured reduction from the accepted mounted production baseline of
  `245 dispatches / 98 passes`. The default-off direct-lane arithmetic is
  `195 dispatches / 49 marginal lane passes` for an initial 49-generation
  batch (`3 + 48 * 4`), or `196 / 49` only when every generation has a real
  predecessor checkpoint.

Never manufacture predecessor continuity to claim the `196 / 49` continued-
batch topology.

The code is safe to retain only because the capability is default-off. Do not
enable it based on the `17/17` fake-device/source tests.

## Performance Read

The best current evidence does not support blaming marching cubes as the main
physics bottleneck:

- `/tmp/ulg-segmented-masked-gpu-timestamps-20260712.json` reports about
  `18.974 ms` GPU time across 16 measured substeps;
- its largest named spans were gas `5.366 ms`, reaction proposal `3.018 ms`,
  thermal `1.945 ms`, interface `1.883 ms`, and separation `1.686 ms`;
- warm native surface extraction in the concurrent profile was about `8.1 ms`
  for the measured batch with 199,728 triangles and no WebGPU errors;
- the accepted mounted gas run still records about `107.6 ms` of host command
  encoding and `245 dispatches / 98 passes` for repeated neighborhood evidence.

The highest-confidence remaining performance priorities are therefore:

1. reduce repeated neighborhood proof/encoding only after the default-off
   certificate has native fail-close evidence;
2. stabilize product-arena capacity through a general scheduler memory policy;
3. rerun 300k and full mounted profiles after each isolated change;
4. use GPU timestamps for kernel claims and keep host encoding, queue submit,
   queue fence, allocation, and compositor cadence separate.

Do not optimize from one host wall-clock number and do not hide allocation
churn by increasing arbitrary slot counts.

## Rejected Artifacts

Do not cite these as accepted results:

- `/tmp/ulg-mounted-gas-rollover-4x16-20260712.json`: rejected because the
  state-key rollover hypothesis was wrong and produced a cache miss;
- `/tmp/ulg-mounted-gas-stable-horizon-4x16-20260712.json`: rejected because
  the stable lane exposed output-slot exhaustion;
- `/tmp/ulg-mounted-gas-stable-horizon-fenced-4x16-20260712.json`: physics
  completed, but a six-hour Vite process produced 30 aborted HMR requests, so
  the browser evidence is contaminated.

The accepted replacement is the fresh-Vite `17/17` artifact named above.

## Known Open Risks

1. The post-refactor water-cycle, iron/ice, sodium/water, cesium/fluorine, and
   deterministic random-pair matrix has not been rerun or visually inspected.
2. The fresh mounted smoke did not reach a rendered surface frame.
3. The worktree is too broad to treat a passing focused suite as proof that all
   interactions are correct.
4. The mutation certificate is not a native or production proof.
5. Product-arena growth still causes measured allocation/copy/bind churn.
6. Current plan/status/README documents contradict newer evidence in several
   places; do not use checkbox state alone as truth.
7. `/tmp` artifacts are machine-local and ephemeral; preserve any evidence
   needed beyond this checkout before relying on it for long-term audit.
8. The mounted UI visibly labels a CPU closure derivation task during startup.
   This is not evidence of a CPU physics hot loop, but the next owner should
   verify it remains closure/reference work and never mutates resident state.

## Safe Restart Order

### P0 - Establish visual truth without source edits

1. Confirm Node 24 and stop any stale ULG Vite processes.
2. Do not start a shared external Vite server for the standard matrix. With
   `ULG_PROBE_BASE_URL` unset, the harness owns seven fresh sequential servers
   on ports 6320-6326 and stops each one after its scenario.
3. Run the complete standard native WebGPU surface matrix with timestamp and
   close-spaced frame capture.
4. Inspect time-zero, early, middle, and final images for every scene.
5. Record surface-versus-points, smoothness, opaque PBR, background,
   flow/boiling/steam/cooling, emission decay, plume motion, reaction color,
   volume stability, blinking, and lattice artifacts.
6. Report failures without changing material pairs or demo presets.

Standard command:

```bash
env -u ULG_PROBE_BASE_URL \
  -u ULG_VISUAL_MATRIX_SCENARIOS \
  -u ULG_VISUAL_MATRIX_ALLOW_FAILURES \
  ULG_VISUAL_MATRIX_OUTPUT_DIR=/tmp/ulg-refactor-visual \
  ULG_VISUAL_MATRIX_BASE_PORT=6320 \
  ULG_VISUAL_MATRIX_RANDOM_SEED=0x7a11d2026 \
  ULG_VISUAL_MATRIX_RANDOM_PAIR_COUNT=3 \
  ULG_VISUAL_MATRIX_FRAME_EVERY=1 \
  ULG_VISUAL_MATRIX_FRAME_MAX=16 \
  ULG_PROBE_GPU_PROFILE=1 \
npm run test:sph-standard-visual
```

Leaving `ULG_VISUAL_MATRIX_RUN_ID` unset makes the harness generate a unique
timestamped run id. Never reuse an existing run id or frame directory for
acceptance; the harness creates directories but does not clear stale frames.

Expected named scenarios are water/water at 300 K with 400 K floor and 200 K
ceiling, molten iron/ice, sodium/water, cesium/fluorine, plus three deterministic
random pairs. The production renderer must be
`native-webgpu-surface-consumer`.

### P1 - Close native evidence gaps one at a time

Only after P0 has a trustworthy baseline:

1. create a native certificate ABI/proof probe with manufactured valid and
   fail-closed states;
2. integrate exactly one real position writer, rerun focused/native/mounted
   gates, and inspect the dispatch/pass delta;
3. stop and revert that isolated slice if surface behavior, authority, or
   timing regresses;
4. repeat for the next writer only after the prior writer is accepted;
5. implement the product-arena horizon as a separate memory-policy slice.

Do not combine certificate integration, arena growth policy, renderer changes,
and new laws in one patch.

### P2 - Revalidate scale and documentation

After each accepted slice:

- rerun the fused and Schroeder actual-node 300k probes;
- rerun coherent-solid production/lifetime probes;
- rerun the native refraction science probe;
- run focused tests, full `npm test`, `npm run build`, and `git diff --check`;
- run `npm run icc:update`;
- reconcile the stale plan/status/README files listed at the top;
- create a local commit only when all required validation has finished and the
  slice has a clear rollback boundary.

## Useful Commands

```bash
nvm use 24
node --test \
  tests/residentNeighborhoodMutationCertificate.test.mjs \
  tests/webgpuComputeLayout.test.mjs \
  tests/webgpuKernelAbi.test.mjs \
  tests/residentNeighborhoodGpuLane.test.mjs \
  tests/nativeSurfaceHarness.test.mjs \
  tests/nativeSurfaceResourceLifecycle.test.mjs \
  tests/sphMarchingCubesSurfaceAdapter.test.mjs \
  tests/sphPhaseRenderer.test.mjs \
  tests/opticalClosure.test.mjs \
  tests/opticalGpuBuffers.test.mjs \
  tests/nativeRefractionTransportWgsl.test.mjs
npm test
npm run build
git diff --check
npm run icc:update
```

For a fresh manual server smoke outside the matrix:

```bash
npm run dev -- --host 127.0.0.1 --port 5320
```

Shut it down when validation is complete. Do not reuse a days-old HMR process
for acceptance evidence.

## Handoff Decision

The tree is healthier than the visible regressions suggested: the focused
renderer/optics/lane suite and production build pass, a fresh Vite process is
browser-clean, gas/pressure residency has accepted mounted evidence, actual-
node sparsity works at 300k, and coherent solids have strong production
evidence. The main problem is confidence management, not a lack of landed
code: too many interacting changes accumulated before the fresh full visual
matrix and production performance gates were re-established.

Resume from evidence, not from the next unchecked optimization.
