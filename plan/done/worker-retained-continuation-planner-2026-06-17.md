# Worker-Retained Continuation Planner - 2026-06-17

## What Changed

- Added `peercompute.ulg.worker-retained-continuation-plan.v0`.
- Added `planWorkerRetainedContinuationFromAccessContract()` and exposed it as
  `host.planWorkerRetainedContinuation()`.
- The planner resolves a Worker-retained publication or hot-buffer record,
  validates the access contract, checks required output families, confirms
  same-Worker retained-ref consumer mode, confirms retained refs exist, and
  confirms a local Worker runner is available.
- The mechanics stage-chain Worker context can now receive this continuation
  plan and derives retained G2P input from it. The old boolean override remains
  for compatibility.

## Validation

- PASS: syntax checks for `peercomputeBrowserResidentHost.js`,
  `sphMlsMpmGpuStep.js`, and the PeerCompute integration test.
- PASS: focused PeerCompute integration passed `16/16`.
- PASS: `npm run test:physics-atomics` passed `11` checks with `3` expected
  opt-in skips.
- PASS: short visual matrix
  `codex-worker-retained-continuation-plan-20260617` passed three
  representative rows with `failedCount=0` and empty issue counts.

## Remaining

- This is mechanics continuation planning, not full law-graph placement.
- Next work should combine continuation plans with state-family read/write
  conflict checks and Worker/lane/device placement across all promoted law
  families.
