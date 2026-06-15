# Plain SPH Condensed Pressure Partition

Date: 2026-06-15 AKDT

Status: done for the pressure/gas participant bug; renderer surface-envelope
follow-up remains open.

## Completed

- Added explicit SPH pressure/density/PBF participation to
  `createSphPhaseCarrier()`.
- Wired `createSphPhaseDemo()` so only thermodynamic liquid particles
  participate in condensed SPH pressure.
- Prevented solids and gas reaction products from acting as liquid pressure
  mass while preserving them as particles/ledger evidence.
- Added atomic guards for Fe/H2O solid-liquid contact and room-temperature
  Na/H2O reaction products.
- Updated Na/H2O visual matrix rows to use `293.15 K` and `blob=1`.

## Evidence

- `npm run test:physics-atomics`: `10` pass, `1` expected opt-in skip.
- Targeted visual matrix:
  `codex-sph-reaction-roomtemp-blob1-20260615`.
- The targeted Na/H2O public-default row no longer hits the old reaction speed
  clamp: `maxSpeedObservedMPerS=0.5410316601618764`,
  `maxPressureImpulseNSeconds=0`, H2O visible surface count `1 -> 1`.

## Follow-Up

- The same visual row still reports Na solid
  `visible-surface-expanded-beyond-particle-bounds` by about `0.102 m` after
  support-radius tolerance. Keep that in renderer/probe visual-trust work.
