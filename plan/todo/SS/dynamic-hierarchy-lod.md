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
