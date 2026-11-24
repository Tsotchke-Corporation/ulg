# Dynamic Multi-Level Schroeder Hierarchy & Hardware-Budgeted LOD Design

## Architectural Intent

A fixed-depth hierarchy (such as a static 2-level or static 3-level room-air chain) is only an intermediate milestone. As phenomena evolve across space and scale — e.g., boiling droplets expanding into steam plumes, shock waves propagating into ambient air, or planetary/molecular multi-chart simulations spanning 40+ orders of magnitude — the Schroeder spatial hierarchy must **dynamically refine or coarsen** active levels and spatial detail according to both:

1. **Physical Demand (Local Activity & Gradients)**
   - Local density/volume migration ($V_0 J$ crossing dyadic scale thresholds $2^{3L}$),
   - High thermal/pressure/velocity/reaction gradients or multi-phase interfaces requiring fine resolution,
   - Quiescent homogeneous bulk regions that can coarsen safely without losing conservation.
2. **Hardware Capability & Live Frame/Step Budget**
   - Available GPU storage/binding limits (`maxBufferSize`, `maxStorageBufferBindingSize`, `maxStorageBuffersPerShaderStage`),
   - Observed step wall-time vs target visual sync cadence (e.g., maintaining responsive Sync Hz while gracefully coarsening non-critical far-field levels under load and refining when headroom exists).

## Core Invariants Preserved Across Dynamic Level Changes

Every GPU runtime, cache, pool, and ABI built for N-level chains and the 40-OOM Dyadic Scale-Chart Atlas MUST satisfy:

1. **Zero Static Level-Count Assumptions**:
   - Pipelines use O(1) storage bindings independent of active level count $N \in [1, 16]$ per contiguous chart and independent of active chart count in the 40-OOM atlas ($L \in [-64, +96]$).
   - Shader/pipeline caches key purely on `(unwrapWebGpuCacheDevice(device), staticVariant)`, never baking fixed level counts into WGSL.
   - Buffer/arena pools key on `(device, activeLevelSignature)` with bounded LRU eviction so coarsening/refining active level sets or grid capacities seamlessly reuses or evicts GPU arenas without memory leaks or scene teardown.
2. **Exact Conservation Across Coarsen/Refine Transitions**:
   - Mass, linear momentum, angular momentum (via exact parallel-axis shift on double-float origin rebasing), and total energy remain conserved to `2^-149` / exact ledger authority whenever particles migrate across dyadic levels or scale charts.
3. **Dynamic Controller Boundary**:
   - Level-set refinement/coarsening decisions occur only at committed schedule/epoch boundaries using compact GPU activity receipts (zero full-particle readback) and hysteresis bands so active level counts never thrash frame-to-frame.

## Material-Volume Adaptive Carrier Refinement (Free-Surface Clumping & Sinking-Body Resolution — Logged 2026-11-23)

Observed continuum failure modes at uniform coarse parcel spacing (`~5–8 mm` water parcels in decimeter boxes):
1. **Free-surface "gnocchi" clumping:** Unbounded/elevated Tait tensile floor (`max(pressure, -0.05 * stiffness)` in `ulg-gpu-abi/src/wgsl.js:11095` & `src/runtime/sph/multiMaterialEos.js:82`) produces artificial bulk negative cohesion (tens of kPa–MPa), pulling MLS-MPM liquid parcels into discrete clumps that marching-cubes renders as lumpy blobs. Fix: replace the artificial bulk tensile floor with physical cavitation (`P >= P_vap(T)` / `0` gauge) paired with divergence-free implicit pressure (`sphImplicitPressureGpu.js`) and surface-curvature-only surface tension.
2. **Heavy-body jamming (dense objects unable to displace coarse fluid parcels):** When parcel size and single-level MLS-MPM grid spacing `dx` are large relative to a sinking body, the 3×3×3 quadratic B-spline stencil locks the body and underlying fluid together and prevents thin fluid layers from shearing around the body's flanks.
3. **General first-principles Dynamic Material-Volume LOD solution (Gate 3):**
   - Add a GPU spare-lineage pool (analogous to reaction product pools) so fixed-stride phase-carrier v2 supports live `1 -> 8` carrier splits and `8 -> 1` bulk merges without breaking lineage addressing.
   - Drive **refinement** (`2×` finer SS level + split carriers) purely from physical observables: solid-fluid / multi-material interfaces, high velocity shear (`‖∇v‖`), and large local density/pressure ratios around moving dense bodies.
   - Drive **coarsening** (`2×` coarser SS level + bulk merge) in quiescent homogeneous interiors (`low ‖∇v‖`, `low ‖∇T‖`, single phase, away from interfaces), preserving exact `2^-149` mass, momentum, and `Σ(U − S)` internal energy while keeping total particle count & GPU budget bounded.
