# CPU-SPH Free-Surface Remediation - 2026-06-15

Status: done for the CPU-SPH reference lane.

Summary:

- Added a reduced free-surface relaxation closure to
  `src/runtime/sph/sphPhaseCarrier.js`.
- The closure acts on floor-supported liquid groups, computes their rest volume
  and current footprint, and gently relaxes lower/deeper liquid particles
  toward a volume-derived footprint target.
- `src/runtime/sphPhaseDemo.js` enables the closure for CPU-SPH when gravity,
  EOS, and pressure laws are active, with default alpha `5e-5` per carrier
  substep.
- CPU-SPH liquid wall damping default is now `0.30`.
- Added an opt-in density-gated hydrostatic pressure hook, but left it
  default-off after local sweeps showed direct hydrostatic pressure was either
  ineffective or caused spray-like low-resolution expansion.
- Extended the opt-in long liquid atomic to assert particle-space free-surface
  tallness and footprint in the 5m visual fixture.

Validation:

- PASS: `node --check src/runtime/sph/sphPhaseCarrier.js`.
- PASS: `node --check src/runtime/sphPhaseDemo.js`.
- PASS: `node --check tests/physicsBehaviorInvariants.test.mjs`.
- PASS: `git diff --check`.
- PASS: `npm run test:physics-atomics` (`11` pass, `2` expected long skips).
- PASS:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` (`13/13`).
- PASS: visual matrix `codex-cpu-sph-free-surface-fix-long-20260615` with
  `failedCount=0`, empty issue counts, one connected H2O surface, last
  tallness `0.5821`, last footprint fill `0.2960`, and eight frames.

Remaining:

- This is a CPU reference-lane reduced closure, not final multiscale fluid
  physics.
- MLS-MPM/WebGPU-resident liquid still needs equivalent free-surface behavior.
- Move this law/closure into the PeerCompute/ComputeManager law graph before
  treating it as distributed authority.
