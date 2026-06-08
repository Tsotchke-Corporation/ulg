# Claude Handoff - ULG / PeerCompute Core Technology

Date: 2026-06-08 AKDT

## Operating Rules

- Keep all commits local. Do not push to origin.
- Read `/home/cos/projects/AGENTS.md` and repo-local instructions before work.
- Address the user as "big dog" in user-facing messages.
- Use Infinite Context Coder frequently to avoid broad rereads:
  - `/home/cos/projects/infinite_context_coder/.venv/bin/python /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness`
  - same for `peercompute`
- Do not log or echo any remote passwords.
- Stay on the core ULG technology path. Do not pivot into demo-only SPH/material/phase features. Treat material/EOS/SPH/phase behavior as downstream evidence that must emerge from closure, field, carrier, validation, and provenance contracts.

## Current Local State

### ULG

- Repo: `/home/cos/projects/ulg`
- Branch: `main`
- Latest local commit: `09f824e Add closure refresh request evidence`
- Prior local commits from this run:
  - `b549722 Add closure table WGSL ABI descriptors`
  - `15749f0 Surface closure table WGSL descriptors in oscillator artifacts`
- ICC refreshed at `09f824ee40792a98bcc502f7cf7b0477650cc238`.
- Expected dirty/untracked state after this handoff:
  - pre-existing `D agents.md`
  - pre-existing `?? Agents.md`
  - pre-existing `?? plan/claude-audit.md`
  - pre-existing `?? plan/ulg-runtime-plan.md`
  - new handoff file `?? plans/claudehandoff.md`
- Do not stage or revert the pre-existing `agents.md`/`Agents.md` state unless the user explicitly asks.

### PeerCompute

- Repo: `/home/cos/projects/peercompute`
- Branch: `multi-scale-physics-sim`
- Latest local commit: `e736ce68 Project ULG closure descriptor refresh evidence`
- Prior relevant local commit: `71364f5 Propagate ULG field closure sample summaries`
- Repo was clean after commit and ahead of origin locally.
- ICC refreshed at `e736ce689f9efa085f685208fa2a44e323d55c3a`.

## Live Servers

- ULG Vite is expected on `0.0.0.0:5173`, reachable on VPN at `http://100.86.83.35:5173/`.
- PeerCompute Multiscale Vite is expected on `0.0.0.0:5185`, reachable on VPN at `https://100.86.83.35:5185/?scenario=magnetar`.
- If either server is down, restart on `0.0.0.0`, not localhost-only.

## What Was Just Completed

### ULG `09f824e`

- Added `peercompute.ulg.closure-refresh-request.v0` to field-closure sample summaries.
- Out-of-range observed scalar fields now produce:
  - `closureRefreshRecommended`
  - `closureInvalidationRecommended`
  - `closureRefreshReason`
  - `closureRefreshRegistryAction`
  - out-of-range input bounds
- Added `ClosureRegistry.applyRefreshRequest()` so a refresh request can invalidate a cached closure only when recommended.
- Projected compact refresh fields through ULG artifact summaries and live artifact row.
- Fixed WebGPU carrier deltas to include `fieldClosureSampleSummary`, matching CPU-reference deltas.
- Validation passed:
  - syntax checks
  - focused field/carrier/WebGPU tests `16/16`
  - `npm test` `56/56`
  - `npm run build`
  - `npm run test:e2e` `2/2`
  - `npm run status:live -- --bridge`
  - `git diff --check`

### PeerCompute `e736ce68`

- Added PeerCompute projection of ULG closure table WGSL descriptors from:
  - `artifact.tableDescriptor.wgslTableDescriptor`
  - `artifact.execution.wgslTableDescriptor`
- Added PeerCompute projection of ULG closure refresh request fields from simulation `fieldClosureSampleSummary`.
- Threaded refresh fields through:
  - `summarizeUlgArtifact()`
  - `createUlgSimulationArtifactSummary()`
  - `applyUlgSimulationArtifact()` diagnostics
  - Multiscale packet aggregate state
  - `createUlgSpecContractReport()` bridge/handoff evidence
- Rebuilt `docs/multiscale`.
- Validation passed:
  - syntax checks
  - `node --test peercompute/tests/unit/serviceOrchestration.test.js` `30/30`
  - focused Multiscale ULG simulation artifact test
  - full `node --test demos/multiscale/tests/multiscaleModel.test.mjs` `201/201`
  - `npm --prefix demos/multiscale run build`
  - `ULG_HANDOFF_URL=http://127.0.0.1:5173/ npm --prefix demos/multiscale run test:ulg-handoff`
  - `git diff --check`

## Important Current Limitations

- ULG can recommend invalidation from field-closure out-of-range evidence, but it does not yet rederive or refresh a production closure automatically.
- The default ULG-to-PeerCompute live handoff still carries MoonLab and Eshkol artifacts. ULG runtime closure artifacts with `wgslTableDescriptor` are preserved when included, but not part of the default two-artifact handoff.
- Material properties, EOS behavior, SPH dynamics, phase changes, calibrated scientific runtime, and full-physics validation are still false/blocked by design.

## Recommended Next Work

1. Add an end-to-end ULG closure refresh path:
   - Trigger `ClosureRegistry.applyRefreshRequest()` from a supervised runtime path when field sampling leaves a closure domain.
   - Emit an explicit invalidated-closure event/artifact.
   - Keep this as closure/provenance evidence only; do not claim material/EOS/SPH/phase validation.

2. Add a PeerCompute/Multiscale out-of-range refresh fixture:
   - Feed a ULG simulation artifact whose final `fieldClosureSampleSummary` has `closureRefreshRequest.status = "refresh-recommended"`.
   - Assert refresh/invalidation fields propagate through summary, diagnostics, packet aggregate, bridge contracts, and handoff contracts.

3. Decide how ULG runtime artifacts enter handoffs:
   - Current default live handoff filters to MoonLab/Eshkol.
   - Add an explicit opt-in handoff mode for ULG runtime closure/simulation artifacts if the next demo needs PeerCompute to inspect `tableDescriptor.wgslTableDescriptor`.

4. Continue core substrate toward first-principles material support:
   - closure validity / provenance
   - field observers and field-closure sampling
   - topology / edge messages / invariants
   - production closure execution boundaries
   - only then add material/EOS/SPH/phase evidence.

## Quick Verification Commands

ULG:

```bash
cd /home/cos/projects/ulg
npm test
npm run build
npm run test:e2e
npm run status:live -- --bridge
git diff --check
```

PeerCompute:

```bash
cd /home/cos/projects/peercompute
node --test peercompute/tests/unit/serviceOrchestration.test.js
node --test demos/multiscale/tests/multiscaleModel.test.mjs
npm --prefix demos/multiscale run build
ULG_HANDOFF_URL=http://127.0.0.1:5173/ npm --prefix demos/multiscale run test:ulg-handoff
git diff --check
```

ICC refresh:

```bash
EMSDK_QUIET=1 /home/cos/projects/infinite_context_coder/.venv/bin/python /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo ulg --check-staleness
EMSDK_QUIET=1 /home/cos/projects/infinite_context_coder/.venv/bin/python /home/cos/projects/infinite_context_coder/scripts/codebase_tool.py status --repo peercompute --check-staleness
```

## Suggested Commit Discipline

- Keep changes small and local.
- Commit ULG and PeerCompute separately.
- Include docs/generated `docs/multiscale` only when `npm --prefix demos/multiscale run build` intentionally regenerates it.
- Never push unless the user explicitly changes the instruction.
