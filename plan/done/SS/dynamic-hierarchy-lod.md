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

## Material-Volume Adaptive Carrier Refinement (Free-Surface Clumping & Sinking-Body Resolution — Logged 2026-11-23; Core GPU Pipeline Landed 2026-11-24)

Observed continuum failure modes at uniform coarse parcel spacing (`~5–8 mm` water parcels in decimeter boxes):
1. **Free-surface "gnocchi" clumping — FIXED & VERIFIED 2026-11-24:** Replaced the artificial bulk Tait tensile floor (`-0.05 * stiffness` in `ulg-gpu-abi/src/wgsl.js`, `src/runtime/sph/multiMaterialEos.js`, `src/runtime/sph/sphGridGpuKernel.js`, and `src/runtime/sph/sphImplicitPressureGpu.js`) with physical zero-gauge cavitation (`P_gauge >= 0`, `dp/drho = 0` for `ratio < 0.9999`) paired with divergence-free implicit pressure (`sphImplicitPressureGpu.js`). Verified on Vulkan (`tests/schroederLiquidMaterialVolumeLod.native.test.mjs`, `tests/sphImplicitPressureGpu.native.test.mjs`, live `water-realtime` & `iron-ice-quench` `gpuprobe.sh`).
2. **Heavy-body jamming (dense objects unable to displace coarse fluid parcels):** When parcel size and single-level MLS-MPM grid spacing `dx` are large relative to a sinking body, the 3×3×3 quadratic B-spline stencil locks the body and underlying fluid together and prevents thin fluid layers from shearing around the body's flanks.
3. **General first-principles Dynamic Material-Volume LOD solution — CORE GPU PIPELINE LANDED & VERIFIED 2026-11-24:**
   - Generalized ULG's canonical GPU split-spare lineage materializer (`src/runtime/sph/schroederPhaseSlotMaterializationGpu.js`) and exact 9-limb `2^-149` mass & `Σ(U − S)` energy ledger (`src/runtime/sph/schroederPhaseSlotLedgerGpu.js`) from gas-only (`lane 2`) to **both liquid (`lane 1`) and gas (`lane 2`)** live `1 -> 8` splits and `8 -> 1` bulk merges with strict cross-phase isolation.
   - Generalized `schroederPhaseVolumeTargetAggregateWgsl` and `schroederPhaseVolumeMigrationWgsl` (`flags & 2u`, `enableLiquidPhaseSlotRefinement`) to drive liquid `1 -> 8` refinement directly from canonical SS `mechanicsFieldView` solid-liquid, multi-material, and gas/free-surface interfaces (zero private spatial grids) and `8 -> 1` bulk coarsening in quiescent homogeneous interiors (`-materialId` disjoint aggregate key), preserving bit-exact `2^-149` mass, momentum, and `Σ(U − S)` internal energy while reclaiming all spare lineages.
   - Remaining optional promotion: enable `enableLiquidPhaseSlotRefinement` + spare reserve defaults on Studio sinking-body presets after tuning spare-pool sizing vs Section 3 GPU budgets.
