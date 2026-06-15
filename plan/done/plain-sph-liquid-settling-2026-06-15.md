# Plain SPH Liquid Settling - 2026-06-15

Status: done for the CPU-SPH mounted/browser reference lane.

Summary:

- Fixed finite-volume floor contact so gravity half-kicks do not reintroduce
  into-wall velocity at rest/contact.
- Added explicit law-gated plain-SPH liquid viscosity behavior: wall damping
  near the floor plus same-material velocity diffusion.
- Added atomic coverage for wall-contact velocity cancellation and opt-in
  long-horizon plain-SPH liquid merge/settle acceptance.

Validation:

- PASS: `node --check src/runtime/sph/sphPhaseCarrier.js`.
- PASS: `node --check src/runtime/sphPhaseDemo.js`.
- PASS: `node --check tests/physicsBehaviorInvariants.test.mjs`.
- PASS: `npm run test:physics-atomics` (`11` pass, `2` expected long skips).
- PASS: `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic`
  (`13/13`).
- PASS: visual matrix `codex-cpu-sph-liquid-viscosity-short-20260615`.
- PASS: long browser probe
  `codex-cpu-sph-h2o-long-after-sph-viscosity-20260615`, status `good`, one
  visible H2O surface throughout, no visual issues, final drop speed about
  `0.246 m/s`, ten frames in
  `/tmp/ulg-frame-check/cpu-sph-h2o-long-after-sph-viscosity-20260615`.

Remaining:

- This closes the CPU-SPH reference-lane settling regression only. MLS-MPM
  fragmentation, broader free-surface quality, mounted ice/solid visual trust,
  z-buffer/draw-order, focus-resume flashing, and ComputeManager/GPUHub WebGPU
  law-stage migration remain open.
