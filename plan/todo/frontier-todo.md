# First-principles stack — shortfalls & TODO

Status of the electronic-structure → chemistry → materials stack, and what's left to make it
quantitative. Everything below is honestly flagged in code (validation = false) where not validated.

## Atomic DFT (radialKohnSham) — solid
- LDA Kohn–Sham for all elements, log grid (~0.3% total energies He→U). Good.
- Koelling–Harmon scalar-relativistic SCF: exact Dirac for s-states; **spin–orbit omitted** (scalar
  approximation) → heavy p/d/f shells recover less than full Dirac.
- LSDA spin works (Fe moment 4 μB).
- TODO: GGA/PBE to pass the LDA ~0.3% / self-interaction ceiling; LDA+U or full DFT for the
  quantitative bulk of transition metals.

## Molecular HF (molecularHartreeFock) — built, qualitative-to-good
- RHF/UHF/MP2, geometry opt, population analysis, vibrations, BOMD all validated for the basis.
- **Minimal STO-3G basis** and **only H, He, C, N, O** parameterized → qualitative energetics;
  atomization/vibrational frequencies run ~20–40% off. TODO: add 6-31G(d)/larger; add more elements
  (at least through Ne/Ar, then metals via ECPs).
- **No correlation in atomization** (RHF/UHF underbind). MP2 is closed-shell only. TODO: **UMP2**
  for consistent, MP2-quality atomization energies (the number the bulk closures want).
- **RHF fails for multiply-bonded dissociation** (N2 minimum mislocated) — single-determinant
  limitation. TODO: CASSCF / spin-projected UHF for bond breaking.
- Forces/Hessian are **numerical** (finite-difference) → slow for MD/optimization of bigger systems.
  TODO: analytic gradients.
- **No reaction-barrier / transition-state search** yet (only endpoint reaction energies). TODO:
  NEB or dimer method for activation energies / minimum-energy paths.

## Bulk element closures (elementClosures) — general but rough
- One jellium + Ashcroft-empty-core model for all elements: bulk modulus / Debye in the right range
  for simple sp-metals; **densities low ~2–3×**; polyvalent/transition/covalent/noble out of model.
- Empty-core radius from the atomic-DFT core charge **overestimates** the true Ashcroft rc.
- **Melting / cohesive energy / latent heats return null** — need the atomization reference
  (now available molecularly via atomizationEnergyHa) + finite-T free energies (phonon/QHA).
- TODO: real periodic DFT (plane-wave or LCAO + k-points) for quantitative bulk; couple the molecular
  atomization + vibrational thermo into the closures for molecular materials (water, air gases).

## Demo (sphPhaseDemo) — the immediate work
- ~~Timescale decoupled ~67×~~ DONE (2026-07-06 audit): one shared simulation clock — each
  driver.step advances mechanics by `mechanicalSubsteps * carrierDt` and the thermal step by the
  SAME `dtStepS` (sphPhaseDemo.js ~3616/3884/3975); conduction/wall coefficients remain
  elevated-but-labelled for a watchable demo.
- **Gas heat capacity**: banked harmonic vibrations now feed the derivation (23c1d7d) — offline
  generator + molecular-vibrations.json + Einstein Cp in gasHeatCapacityForFormula, honest model
  tags, method v1 cache bump. H2O closed (Cp 33.26 vs 33.6 measured at 298 K); CO2 pending under
  the new optimizer trust radius (its 667 cm⁻¹ bends are the real payoff: Cp 37.1 vs 29.1
  equipartition); diatomics stay equipartition (exact at ambient; RHF multiple-bond minima are
  the documented single-determinant failure). Remaining: runtime Cp(T) consumption in the demo
  thermal step (gasVibrationsCm1 is exposed in the property record for exactly this).
- ~~Performance: per-pair allocations in the O(N²) loops~~ DONE (2026-07-07 audit): the
  momentum/density loops (sphOperators.js) and thermal conduction (thermalPhase.js) are already
  inlined scalar math with no per-pair allocation. Remaining: a cell/neighbour list would take
  O(N²)→O(N), but the CPU carrier is now only the `mech=sph` opt-out reference (MLS-MPM resident
  GPU is the default integrator since d8dcbc0), so this is deprioritized behind the GPU plans
  (`plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`,
  `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`).
- Multi-material EOS is weakly-compressible (sound speeds ~180 m/s), not the true stiff EOS —
  reduced reference, sphValidation stays false.
