# Cosmic-to-Quantum Continuous Zoom PeerCompute Demo Plan

Date: 2026-11-22 AKST  
Status: Planned TODO (sequenced after ULG simulation-module registration + resident-buffer lease handoff and provenance-backed quantum visualization artifacts)

## Vision

Build a standalone PeerCompute WebGPU demo — separate from the laboratory SPH demo (`sphPhaseDemoMount.js`), yet sharing the exact same `ulg-runtime`, `residentBufferLease`, `SchroederScaleAtlas`, and Triad A4/A6 authority substrate — that supports a **continuous logarithmic zoom across 38+ orders of magnitude**, with clean headroom to observable-universe / supergalactic scales:

1. **Quantum / Schrödinger Material-Property Scale (`10^-11 m` – `10^-9 m`)**:
   - Interactive volumetric orbital clouds, radial electron density `4π r² ρ(r)`, spin-orbit fine-structure splittings (`j = l ± 1/2`), PBE GGA vs LDA density differences (`src/runtime/electronicStructure/radialKohnSham.js`), molecular charge densities `ρ(r)` and Mayer bond orders (`src/runtime/electronicStructure/molecularHartreeFock.js` `6-31G(d)` + UMP2 + CI-NEB reaction paths), and live Eshkol A4 Chebyshev/polytope response envelopes (`src/runtime/material/eshkolTriadClosures.js`, `src/runtime/material/eshkolHigherOrderLawCompiler.js`).
   - Follows all provenance rules in `plan/todo/electron-cloud-material-derivation-visualization-plan.md`: zero renderer-only constants, explicit `validation.scientificValidation` flags, no main-thread SCF stalls, every visualized cloud/bond/envelope linked to its closure fingerprint and validity domain.
2. **Continuum / Mesoscale Bridge (`10^-6 m` – `10^2 m`)**:
   - Seamless handoff into ULG's N-level Schroeder SPH/MLS-MPM + coherent-solid (`G3`/`A5`) domain where the Schrödinger-derived closures (`elementClosures.js` QHA bulk properties, Triad A4 Helmholtz/Solid/Transport tables, exact `2^-149` mass & `Σ(U − S)` conservation ledgers) govern live macroscopic matter.
3. **Planetary / Stellar / Galactic N-Body Scale (`10^6 m` – `10^21 m`)**:
   - Integrates the Eshkol-authored WebGPU N-body Barnes–Hut engine from sibling repository `../eshkols-in-space` (`physics/nbody.esk`, `src/compute/runtime.js`, `integration/ulg.mjs`, up to 2,000,000 resident bodies on one WebGPU device with sticky mergers and Barnes–Hut octree gravity) through ULG's `simulation.step` capsule and shared-device `residentBufferLease`.
4. **Supergalactic / Observable Universe Headroom (`10^22 m` – `10^27 m`, ~93 Gly)**:
   - Designed from day one around ULG's floating-origin `SchroederScaleAtlas` (`src/runtime/sph/schroederSpatialScaleAtlasRuntime.js` + `src/runtime/sph/schroederSpatialScaleAtlasMultipoleGpu.js`, already verified to `41.54 OOM` on Vulkan WebGPU with `~2e-8` multipole momentum/radiation balance).
   - Leaves explicit chart slots and comoving-coordinate metadata (`scaleFactor a(t)`, Hubble parameter `H(a)`, dark-matter/baryon filament Barnes–Hut multipole moments, representative-particle mass scaling) so galaxy clusters, supergalactic filaments (Laniakea ~`5e24 m`), and observable-universe cosmological volumes (~`8.8e26 m`) extend naturally without precision loss or coordinate-system rewrites.

## Scale-Atlas Chart Ladder (~38–42 OOM)

| Regime | Physical Scale | Chart Extent `L_c` | Primary Law / Module | Coupling Across Neighboring Charts |
| --- | --- | --- | --- | --- |
| Atomic / Orbital | `10^-11 – 10^-10 m` | `10^-10 m` | `radialKohnSham` (PBE + KH + SO) | Feeds atomic radii, screening, optical/interband closures |
| Molecular / Lattice | `10^-10 – 10^-8 m` | `10^-8 m` | `molecularHartreeFock` (`6-31G(d)`, UMP2, CI-NEB) + QHA | Feeds `elementClosures`, Triad A4 envelopes, reaction energetics |
| Lab Continuum / Solids | `10^-3 – 10^1 m` | `10^0 m` | ULG N-level Schroeder MLS-MPM + Coherent Solids | Exact `2^-149` mass/energy ledger + `bulkCoarsen` representative particles |
| Planetary / Orbital | `10^6 – 10^12 m` | `10^10 m` | Coherent-solid body frames + direct/multipole gravity | Cross-chart multipole gravity & radiative transfer (`runSchroederScaleAtlasMultipoleWebGpu`) |
| Galactic N-Body | `10^16 – 10^21 m` | `10^21 m` | `eshkols-in-space` WebGPU Barnes–Hut N-body module | Shared-device `residentBufferLease` + `simulation.step` capsule |
| Supergalactic / Cosmic | `10^22 – 10^27 m` | `10^27 m` | Comoving cosmological N-body / multipole filament chart | Floating-origin relative coordinates `Δx_chart`, comoving scale factor `a(t)` |

## Why This Is Sequenced After Core Prerequisites (Integration Order)

Integrating this demo cleanly without duplicating schedulers or faking cross-scale handoffs requires two high-leverage ULG integrations first:

### Prerequisite 1 — Simulation-Module Registry & Resident-Buffer Lease Handoff (Highest-Leverage ULG Integration)
Directly addresses `../eshkols-in-space/plan/refs/ulg.md` and `plan/todo/overarching-completion-plan.md` items 1, 8, and 9:
- Add a method-keyed simulation-module registration point to `src/services/ulgRuntime.worker.js` so PeerCompute/Eshkol modules (e.g. `{ model: 'nbody-gravity', version: 1 }`, `{ model: 'quantum-material-atlas', version: 1 }`, `{ model: 'cosmology-comoving-nbody', version: 1 }`) register their WGSL kernel, parameter schema, buffer layout, and step entry point against `simulation.step`.
- Expose host-issued `residentBufferLease` handles (`src/runtime/residentBufferLease.js`) with step generation, layout descriptor, read/write ownership, and portable checkpoint recovery so external GPU modules borrow resident buffers on the same `GPUDevice` with zero host readback and fail-closed rejection of stale handles on reset.

### Prerequisite 2 — Provenance-Backed Schrödinger Material-Derivation Artifact Pipeline
Implements the first executable slice of `plan/todo/electron-cloud-material-derivation-visualization-plan.md`:
- Emit compact, worker-generated, provenance-stamped 3D density/orbital/bond/polytope visualization artifacts from `radialKohnSham.js` (PBE + KH + spin-orbit), `molecularHartreeFock.js` (`6-31G(d)` / UMP2 / analytic gradients / CI-NEB), `elementClosures.js` (QHA), and `eshkolTriadClosures.js` (A4 Chebyshev envelopes + validity boxes).
- Consume those artifacts as WebGPU 3D textures / instanced bond-and-polytope meshes with visible validation status (`scientificValidation: false` where unvalidated, exact generator hash, domain bounds).

### Prerequisite 3 — Continuous Logarithmic Camera & Scale-Atlas Portal Transition
- Separate PeerCompute demo entry point (e.g. `src/demos/cosmicQuantumZoomDemo.js` + dedicated route/launcher, leaving `sphPhaseDemoMount.js` untouched).
- Logarithmic camera depth coordinate `s = log10(viewSpanM) ∈ [-11, +27]` anchored to the active `SchroederScaleAtlas` chart origin (eliminating Float32 jitter across 38+ OOM by transforming every rendered chart into camera-relative floating-origin coordinates).
- Cross-fade / portal LOD between adjacent scale charts driven by `createDynamicSchroederScaleAtlasRuntime` chart residency:
  - Zooming into a star/planet/material sample transitions continuously down through continuum matter into lattice/molecular orbitals and atomic electron shells whose live closures back the macroscopic body's properties.
  - Zooming out transitions continuously from planetary/stellar gravity into the 2M-body `eshkols-in-space` galactic disk/cluster simulation, and onward into supergalactic clusters and an observable-universe comoving chart (`10^27 m`).

## Verification Criteria (When Executed)

- **Zero scheduler duplication**: all active scale charts dispatch through PeerCompute `ComputeManager` + `ulg-runtime` capsules + `residentBufferLease` on a single `GPUDevice`.
- **Precision across 38+ OOM**: camera-relative floating-origin transforms keep sub-pixel stability at both `10^-11 m` (Bohr orbital) and `10^27 m` (observable universe) with no Float32 Z-fighting or NaN matrices.
- **Honest physics provenance**: every Schrödinger orbital cloud, molecular bond, A4 response envelope, SPH continuum region, Barnes–Hut galaxy, and comoving cosmological chart surfaces its active solver, residual/conservation receipt, and `scientificValidation` flag.
- **Native Vulkan WebGPU + headed Chrome visual sweep**: verify smooth continuous zoom traversal across all scale regimes on real Vulkan WebGPU with zero console/validation errors and inspected PNG checkpoints at atomic, molecular, continuum, galactic, and supergalactic zoom stops.
