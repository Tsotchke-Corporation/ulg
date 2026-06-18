# Reaction Product Visual Contract - 2026-06-17

## Completed Slice

Na/H2O CPU/plain-SPH reaction products are now asserted by the visual matrix
and shown in the overlay status. The bug report looked like "reactions do not
work" because the UI displayed initial drop/base role counts after particles
mutated, and the visual matrix accepted a bounded row without requiring product
formation.

## Changes

- `stepDemoForVisualTest()` now returns cumulative reaction events, compact
  reaction-ledger data, phase mass summary, and current particles by material.
- The overlay status now reports current material particle counts from live
  particles instead of static drop/base counts.
- The long-horizon probe and visual matrix now record
  `maxReactionEventsTotal` and `finalParticlesByMaterial`.
- `reaction-product-na-h2o` now requires `naoh` and `h2` to be present, `Na` to
  be absent, and at least one reaction event.

## Evidence

- Syntax checks passed for the touched JS/MJS files.
- `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` passed
  `14/14`.
- `codex-reaction-panel-contract-rerun-20260617` passed with `failedCount=0`,
  `maxReactionEventsTotal=8`, final particles `{h2o:125, naoh:8, h2:8}`, empty
  visual issues, and two frame artifacts.

## Still Open

- Gas/product optics are still subtle; invisible vapor should not be treated as
  no reaction when ledger and inventory prove products exist.
- Resident/WebGPU reaction-ledger placement and gas/product worker continuation
  remain part of the PeerCompute architecture lane.
- Live fluid-flow perception remains open. Short visual rows still under-sample
  simulated time, so the next behavior harness needs dense flow sequences over
  enough simulated time to make motion or stalling unambiguous.
