# Fable Handoff: SS Branch

Date: 2026-07-02
Branch: `SS`
Repo: `/home/cos/projects/ulg`
Status: moot historical handoff. Its checkpoint was superseded first by the
July 2 Fable plan and now by
`plan/done/SS/shared-spatial-authority-refactor-plan.md`.

This handoff is for taking over the Schroeder Simulation work without relying on
the chat history. The current branch is not at a clean stopping point. There is a
stable committed checkpoint, followed by one dirty runtime-policy slice that has
syntax and focused integration coverage but still needs browser proof before it
should be committed.

## Current Git State

Stable checkpoint:

```bash
git rev-parse --short HEAD
# afa0e60

git log --oneline -8
# afa0e60 Prove SS adopted storage browser materialization
# b02e50e Hook SS adopted storage into scene scheduling
# 3ca8c0f Hook SS adopted storage resolver into resident host
# 4263b6e Bind SS adopted storage local resolver
# dfe40d9 Schedule SS adopted storage continuations
# 0ed095d Add SS adopted storage continuation planner
# 385d62b Publish SS adopted storage descriptors
# 5fb37f5 Add SS adopted storage continuation descriptors
```

Dirty files at handoff time:

```text
src/runtime/peercomputeBrowserResidentHost.js
src/visualization/sphPhaseDemoMount.js
src/visualization/sphPhaseScene.js
tests/demo.e2e.mjs
tests/peercomputeComputeManagerIntegration.test.mjs
```

Approximate dirty diff size:

```text
5 files changed, 1111 insertions(+), 10 deletions(-)
```

Do not assume the dirty slice is ready to commit. It is intentionally documented
below so it can be reviewed, finished, or backed out selectively.

## Server State

The app has been run VPN-visible with HTTPS and HTTP:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
npm run dev -- --host 0.0.0.0 --port 5174
```

Expected quick checks:

```bash
curl -skI https://127.0.0.1:5173
curl -I http://127.0.0.1:5174
```

The user explicitly wants HTTPS on `0.0.0.0` for the VPN. Keep that constraint
unless they change it.

## What Is Committed

Commit `afa0e60` is the last known good checkpoint. It completed the first
browser proof that SS adopted particle storage can be materialized into the
mounted scene path.

Committed capabilities in that checkpoint:

- `refreshMlsMpmResidentSteps` accepts explicit SS particle-storage admissions
  and a free-list descriptor.
- Those inputs are threaded into `runSchroederSameLevelMechanicsWebGpu`.
- The ABI has a portable materialization seed schema:
  `ULG_SCHROEDER_ADOPTED_PARTICLE_STORAGE_PORTABLE_MATERIALIZATION_SEED_SCHEMA`.
- Cross-peer continuation planning requires a valid portable seed rather than
  accepting arbitrary objects.
- No-full-readback P2G/G2P reports accept the `webgpu-executed-no-full-readback`
  fence status.
- A targeted Playwright proof exists for mounted materialized storage.

Validation that passed before `afa0e60`:

```bash
node --check src/runtime/peercomputeBrowserResidentHost.js
node --check src/visualization/sphPhaseScene.js
node --check src/visualization/sphPhaseDemoMount.js
node --check tests/demo.e2e.mjs
node --test tests/peercomputeComputeManagerIntegration.test.mjs
node --test tests/nativeSurfaceHarness.test.mjs
node --test tests/sphMlsMpmGpuStep.test.mjs
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted Schroeder materialized storage"
npm test
git diff --check
```

Results at that point:

- `peercomputeComputeManagerIntegration`: 18/18 passed
- `nativeSurfaceHarness`: 15/15 passed
- `sphMlsMpmGpuStep`: 85/85 passed
- targeted Playwright proof: 1 passed
- `npm test`: 947/950 passed, 3 skipped
- `git diff --check`: clean

ICC was refreshed after the checkpoint:

```text
indexedFiles=370
memoryChunks=2721
```

## What Is Dirty Now

The dirty slice promotes SS adopted storage materialization from an explicit
test-injected path into runtime policy that can be configured through the mounted
demo and PeerCompute host policy.

### Runtime Host

File:

```text
src/runtime/peercomputeBrowserResidentHost.js
```

Dirty additions:

- Admission schema imports for:
  - `ULG_SCHROEDER_PHASE_VOLUME_SPLIT_MERGE_ADMISSION_SCHEMA`
  - `ULG_SCHROEDER_PARTICLE_STORAGE_ALLOCATOR_ADMISSION_SCHEMA`
  - `ULG_SCHROEDER_PARTICLE_STORAGE_SLOT_ASSIGNMENT_ADMISSION_SCHEMA`
  - `ULG_SCHROEDER_PARTICLE_STORAGE_MATERIALIZATION_ADMISSION_SCHEMA`
- Hot-buffer publication schemas and scopes for those four admissions.
- Helper functions for target-family publication and finite integer extraction.
- Exported publisher functions:
  - `publishUlgSchroederPhaseVolumeSplitMergeAdmission`
  - `publishUlgSchroederParticleStorageAllocatorAdmission`
  - `publishUlgSchroederParticleStorageSlotAssignmentAdmission`
  - `publishUlgSchroederParticleStorageMaterializationAdmission`
- Host wrapper methods:
  - `publishSchroederPhaseVolumeSplitMergeAdmission`
  - `publishSchroederParticleStorageAllocatorAdmission`
  - `publishSchroederParticleStorageSlotAssignmentAdmission`
  - `publishSchroederParticleStorageMaterializationAdmission`
- Resident authority summary booleans for all four publication methods.

Intent:

The resident host should be able to publish the required SS storage admissions as
normal peercompute hot-buffer descriptors, instead of requiring each browser test
or call site to inject the descriptor objects manually.

### Scene Scheduling

File:

```text
src/visualization/sphPhaseScene.js
```

Dirty additions:

- Imports for:
  - `SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES`
  - `createSchroederParticleStorageFreeListPlan`
  - `runSchroederSameLevelMechanicsWebGpu`
- New `refreshMlsMpmResidentSteps` options:
  - `schroederEnableParticleStorageMaterialization`
  - `schroederParticleStorageAdmissionRowBudget`
  - `schroederParticleStorageRequiredCapacity`
  - `schroederParticleStorageCapacityMargin`
  - `schroederParticleStorageFreeListSlotCapacity`
  - `schroederParticleStorageFreeListAvailableSlotCount`
  - `schroederParticleStorageFreeListMaxSlotsPerRow`
- Policy resolution from explicit options or host policy.
- Runtime publication of four admissions when policy is enabled and explicit
  descriptors were not provided.
- Free-list descriptor creation through
  `createSchroederParticleStorageFreeListPlan`.
- Resident execution telemetry now exposes policy, publication status, source
  hot-buffer keys, free-list readiness, capacity, and available slots.
- The resident step signature includes
  `schroederParticleStorageMaterializationPolicyEnabled`.

Intent:

Mounted demos should be able to turn on SS particle-storage materialization using
runtime config and still route through the same PeerCompute-style descriptor
contracts as the tests.

### Demo Mount

File:

```text
src/visualization/sphPhaseDemoMount.js
```

Dirty additions:

- URL/runtime config keys:
  - `schroederParticleStorageMaterialization`
  - `ssParticleStorageMaterialization`
  - `schroederParticleStorageRowBudget`
  - `schroederParticleStorageRequiredCapacity`
  - `schroederParticleStorageCapacityMargin`
  - `schroederParticleStorageFreeListSlotCapacity`
  - `schroederParticleStorageFreeListAvailableSlotCount`
  - `schroederParticleStorageFreeListMaxSlotsPerRow`
- Those values are parsed into initial Schroeder config, scheduled into resident
  execution options, included in the resident scheduling signature, and persisted
  back into the hash URL.

Intent:

The runtime policy should be configurable by URL and by
`runtime.peercomputeSchroederSimulationPolicy`, because PeerCompute use cases
need to choose the policy per workload.

### Tests

File:

```text
tests/peercomputeComputeManagerIntegration.test.mjs
```

Dirty additions:

- ABI and host imports for all four new admission publication contracts.
- Existing resident-host integration coverage now checks readiness booleans.
- Publication assertions verify hot-buffer/warm-delta status, target families,
  capacity, row budgets, and descriptor fields for:
  - phase volume split/merge admission
  - particle storage allocator admission
  - slot assignment admission
  - materialization admission

File:

```text
tests/demo.e2e.mjs
```

Dirty addition:

- Playwright test:

```text
SPH phase mounted SS storage policy materializes adopted storage and feeds stage workers
```

Target URL:

```text
/?drop=h2o&base=h2o&dropt=500&baset=500&iceh=0&ironh=1&dropn=2&basen=2&boxx=4&boxy=4&boxz=4&mech=mlsmpm&residentAuto=1&residentWorkers=1&residentStageWorkers=1&residentFuseSequence=1&ss=1&schroederParticleStorageMaterialization=1&schroederParticleStorageRowBudget=32&schroederParticleStorageCapacityMargin=32&visualCapture=1
```

The test waits for:

- resident final-step adoption status:
  `schroeder-particle-storage-adopted`
- mounted stage worker lane status:
  `worker-stage-lane-published`

It asserts:

- policy enabled
- all four admission publications succeed
- free list is ready
- materialization and adoption happen
- adopted descriptor publication is accepted
- local resolver is ready
- hot record remains descriptor-only
- stage worker lane consumes adopted storage
- same-device schedule is used
- raw GPUBuffer transfer is false
- stage order is `p2g`, `gridUpdate`, `g2p`

## Dirty Slice Validation

Already passed after dirty edits:

```bash
node --check src/runtime/peercomputeBrowserResidentHost.js
node --check src/visualization/sphPhaseScene.js
node --check src/visualization/sphPhaseDemoMount.js
node --check tests/peercomputeComputeManagerIntegration.test.mjs
node --check tests/demo.e2e.mjs
node --test tests/peercomputeComputeManagerIntegration.test.mjs
```

Latest focused integration command output showed:

```text
tests 1
pass 1
fail 0
```

Not yet validated:

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted SS storage policy"
git diff --check
npm test
npm run icc:update
```

The targeted Playwright command was attempted twice but interrupted before a
result. Treat the new e2e proof as unverified.

## Recommended Resume Sequence

Start by confirming you are looking at the same state:

```bash
git status --short --branch
git log --oneline -8
git diff --stat
```

Re-check server availability:

```bash
curl -skI https://127.0.0.1:5173
curl -I http://127.0.0.1:5174
```

Run the cheap checks:

```bash
node --check src/runtime/peercomputeBrowserResidentHost.js
node --check src/visualization/sphPhaseScene.js
node --check src/visualization/sphPhaseDemoMount.js
node --check tests/peercomputeComputeManagerIntegration.test.mjs
node --check tests/demo.e2e.mjs
node --test tests/peercomputeComputeManagerIntegration.test.mjs
```

Then run the missing browser proof:

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 npx playwright test --config tests/playwright.config.mjs --grep "mounted SS storage policy"
```

If that passes, run:

```bash
git diff --check
npm test
npm run icc:update
```

If all of that passes, update the SS plan/log and commit the dirty slice. A
reasonable commit message would be:

```text
Promote SS adopted storage materialization policy
```

## If The Playwright Proof Fails

Do not paper over the e2e failure with more unit-only contracts. The value of the
dirty slice is proving that the mounted scene can enable policy-driven adopted
storage and route it into the stage-worker lane.

Things to inspect first:

- Whether `residentExecutionPolicy.schroederParticleStorageMaterializationPolicyEnabled`
  is true.
- Whether all four `...PublicationStatus` fields report published.
- Whether the free-list status is ready and capacity is nonzero.
- Whether final resident telemetry reports
  `schroeder-particle-storage-adopted`.
- Whether the stage worker lane sees the adopted storage resolver and reports
  `worker-stage-lane-published`.
- Whether the failure is just timing. Prefer better telemetry waits over longer
  blind sleeps.

If the host publication helper feels too broad, split it by admission type or
collapse repeated schema plumbing before committing. Do not let this grow into a
second framework.

## Next Architecture Slice After This One

If the dirty slice passes and is committed, the next real SS slice is portable
rematerialization on the target peer.

Current state:

- Commit `afa0e60` creates and validates a portable materialization seed.
- Cross-peer continuation planning treats a valid seed as replay evidence.
- The browser can prove mounted materialization on the same device.

Still missing:

- A target peer must use the portable seed to rebuild the needed particle storage
  descriptors and GPU buffers locally.
- Continuation should not rely on raw GPUBuffer transfer.
- The result should preserve the compute/state/presentation separation required
  by PeerCompute.

That slice is the bridge from "same-device adopted storage works" to "cross-peer
SS continuation is real."

## Bigger Direction

The user wants the SS branch to implement Schroeder Simulation:

- a hierarchical MPM grid
- a Schroeder tree as a scale-independent accelerator
- support for variable particle sizes through multilevel grid/tree nodes
- GPU-first execution
- minimal CPU mirror/readback ceremony
- PeerCompute-compatible separation of compute tasks, state, and presentation

The planned algorithmic direction is not just Barnes-Hut beside MLS-MPM. It is a
new hierarchical MPM/tree structure intended to handle particles and laws across
scales. A single water particle expanding into steam should move to a different
grid/tree level rather than forcing a 100x or 700x particle explosion just to
represent volume.

## What Not To Do

- Do not revert user or unrelated worktree changes.
- Do not commit the dirty slice until the mounted browser proof and
  `git diff --check` pass.
- Do not treat CPU mirror/readback as the long-term solution.
- Do not replace the PeerCompute architecture with a render-thread shortcut.
- Do not mark the global SS objective complete. This branch is still early in
  the algorithm transition.

## Mental Model

The immediate implementation is deliberately narrower than the full algorithm:

1. Make SS storage descriptors publishable as peercompute hot buffers.
2. Let runtime policy create those descriptors without test-only injection.
3. Prove the mounted browser path consumes adopted storage in the worker-stage
   lane.
4. Commit that as a checkpoint.
5. Then implement real target-peer rematerialization from portable seeds.
6. Then continue toward the GPU-first hierarchical Schroeder tree/MPM algorithm.

If you need to make a plan change, make it explicit in `plan/todo/SS/` before
continuing. Otherwise, keep checkpointing small, validated slices so the branch
can be backed up cleanly.
