# WebGPU-Ocean-Style MLS-MPM Simulator Plan

Date: 2026-06-12 AKDT

## References

- Website/demo: https://webgpu-ocean.netlify.app/
- GitHub: https://github.com/matsuoka-601/WebGPU-Ocean

The WebGPU-Ocean reference is a real-time browser fluid simulation using
WebGPU. Its README describes an MLS-MPM path that can run roughly 100k
particles on integrated graphics and roughly 300k particles on stronger GPUs,
with P2G implemented through `atomicAdd`. It also includes an SPH mode with
GPU fixed-radius neighbor search and uses screen-space fluid rendering.

## Purpose

Implement a higher-performance ULG MLS-MPM simulator inspired by
WebGPU-Ocean's hot-loop architecture, while preserving ULG's core rule:
material behavior, phase behavior, reaction behavior, optics, pressure, and
thermodynamics must resolve from lower-level derived closures or valid cached
derivations.

This is not a renderer-only task and not a material-specific demo patch. The
target is a reusable WebGPU-resident simulator path that can carry ULG's
multi-material, phase-changing, reacting macro-particles at interactive rates.

## Current ULG Bottleneck

ULG already has pieces of a resident MLS-MPM pipeline:

- packed SPH/thermal and MLS-MPM mechanics particle buffers;
- P2G, grid update, and G2P WebGPU kernels with CPU parity paths;
- repeated resident-step ping-pong;
- no-full-readback modes for parts of the pipeline;
- compact resident summaries;
- product-event/product-mass sidecars;
- pressure-interface force rows;
- WebGPU render-field and surface-vertex prototypes.

The system is still not Ocean-style fast because:

- the current P2G path is still too gather-heavy for large particle counts;
- many paths still keep CPU parity/readback or CPU mesh extraction close to the
  live loop;
- CPU `MarchingCubes` remains the visible fallback;
- closure derivation and table construction still run through heavy JavaScript
  or worker paths;
- product gases, steam, wall heat, and phase states are not yet fully resident
  dynamics;
- draw buffers are not yet fed to a fully GPU-resident Three/WebGPU render path.

## Architecture Target

The target hot loop should be:

1. CPU validates scenario, closures, schemas, provenance, cache keys, and UI
   controls outside the frame loop.
2. CPU uploads compact closure tables, wall constants, particle buffers, gas
   state, material tables, and render tables once or when inputs change.
3. WebGPU kernels own the repeated frame loop:
   - particle-to-grid;
   - grid update;
   - pressure/gas/wall force application;
   - grid-to-particle;
   - thermal/phase update;
   - reaction/product sidecar update;
   - compact diagnostics;
   - render-field/surface generation;
   - draw metadata.
4. CPU reads back only compact diagnostics at a throttled cadence.
5. Renderer consumes GPU buffers directly or through a minimal no-full-readback
   bridge.

## Implementation Phases

### Phase 1 - Ocean Reference Audit

- Locally inspect WebGPU-Ocean's MLS-MPM source once network/local clone is
  available.
- Extract its actual buffer layouts, dispatch order, workgroup sizes,
  fixed-point scaling, `atomicAdd` usage, prefix/sort helpers, and render path.
- Record which parts map cleanly to ULG and which conflict with ULG's
  multi-material/closure requirements.
- Do not import TypeScript/React architecture into ULG. ULG remains vanilla JS,
  ES modules, Three.js, and WGSL.

Completion gate:

- A short audit note in `plan/log.md` lists the Ocean kernels/files inspected
  and the ULG mapping decisions.

### Phase 2 - Scatter/Tiled P2G Prototype

- Add a new optional MLS-MPM P2G backend that scatters from particles to grid
  nodes instead of launching one invocation per grid node that loops particles.
- Use fixed-point integer accumulation where WebGPU float atomics are not
  portable enough.
- Accumulate at least:
  - mass;
  - momentum;
  - stress/affine terms;
  - product-event mass/velocity/EOS contributions.
- Keep CPU reference and current gather kernel as parity/fallback paths.
- Add grid-dimension scaling tests so larger boxes increase grid cells, not
  blob radius.

Completion gate:

- Scatter/tiled P2G matches CPU reference within tolerance for single material,
  multi-material, and product-event cases.
- It outperforms the current gather-heavy P2G at medium/high particle counts.

### Phase 3 - Resident Grid/Neighbor Structures

- Add GPU-side spatial structures for remaining SPH-style local interactions:
  - cell hash or grid slot rows;
  - sorted particle indices or fixed-capacity bins;
  - prefix/offset rows;
  - compact overflow diagnostics.
- Use these structures only where ULG still needs pair/local interactions. Pure
  MLS-MPM stages should not reintroduce SPH neighbor cost.
- Keep product-event and gas-cell routing compatible with these structures.

Completion gate:

- Remaining local interaction kernels avoid CPU pair loops and avoid full
  particle readback.

### Phase 4 - Gas, Steam, Wall, And Product Dynamics

- Bind sealed-gas inventory, H2O vapor/droplet state, wall heat ledgers, and
  product-event sidecars into resident kernels.
- Replace diagnostic-only gas pressure with a gas-cell or pressure-gradient
  force path that can push material surfaces conservatively.
- Consume closure-derived EOS, phase, viscosity, and mechanics rows from GPU
  tables.
- Keep strict validation false until conservation and parity gates pass.

Completion gate:

- Product gases and H2O vapor/steam change pressure and forces through resident
  state, not through stale CPU particle scans.

### Phase 5 - GPU-Resident Surface Path

- Finish GPU surface generation:
  - scalar field build;
  - voxel classification;
  - prefix/compaction;
  - triangle/vertex emission;
  - per-surface draw metadata;
  - material/phase/optical ids;
  - indirect draw rows.
- Use WebGPU marching cubes for stable PBR material volumes.
- Evaluate screen-space fluid rendering, Ocean-style, for water/steam visuals
  where it is a better fit than mesh extraction.
- Integrate into Three.js/WebGPU properly. Do not use a custom canvas overlay
  as the long-term architecture.

Completion gate:

- Visible continuous volumes render without CPU `MarchingCubes` mesh extraction
  in the normal path.
- Transparent material depth/z-order behavior is explicitly tested.

### Phase 6 - Performance Harness

- Add a benchmark harness for:
  - 1k, 10k, 50k, 100k particle counts;
  - box sizes and grid resolutions;
  - single material;
  - H2O/Fe phase scenario;
  - reaction/product-event scenario;
  - gas/steam pressure scenario.
- Report:
  - render FPS;
  - physics FPS;
  - GPU dispatch time per stage;
  - readback bytes per frame;
  - active grid node count;
  - resident buffer sizes;
  - CPU long tasks;
  - cache hits/misses.
- Keep CPU parity tests opt-in for benchmarks; do not run full readback parity
  every frame.

Completion gate:

- Cached warm run reaches an agreed interactive target on the local GPU, and
  bottlenecks are stage-attributed rather than guessed.

## ULG-Specific Constraints

- Do not hard-code material properties to make the simulator fast.
- Do not script phase changes, steam, reactions, opacity, color, or pressure.
- Particle count changes resolution and convergence only; it must not change
  the derived material laws.
- Closure derivation may be cached, but cache records must carry provenance,
  generator fingerprints, validity domains, and invalidation guards.
- CPU/control-plane work is acceptable for validation and setup; it is not
  acceptable in the normal per-frame hot loop.
- Keep PeerCompute-compatible buffer/contract boundaries.
- Keep validation flags false until the specific physics claim is proven.

## Acceptance Tests

- P2G scatter/tiled kernel matches CPU reference on mass, momentum, stress, and
  pressure rows.
- Product-event mass, velocity, and EOS fields affect grid dynamics without
  full particle readback.
- Larger sealed boxes increase MLS-MPM grid dimensions at fixed grid spacing
  without enlarging isosurface blobs.
- Normal stepping avoids full particle/grid readback.
- Render and physics FPS counters are decoupled and accurate.
- WebGPU surface path renders continuous PBR material volumes without CPU mesh
  extraction.
- H2O liquid, pure vapor, condensed steam, molten Fe, and solid Fe use
  closure-derived optical/material rows.
- Gas pressure from reactions or vapor can push material through a validated
  force path.
- Device-loss and CPU fallback are visibly reported and do not claim GPU-ready
  status.

## First Implementation Slice

1. Audit WebGPU-Ocean source locally and record kernel/layout decisions.
2. Build a ULG scatter/tiled P2G experimental backend behind an explicit option.
3. Add CPU parity tests for the new backend on small cases.
4. Add a benchmark comparing current gather P2G vs scatter/tiled P2G.
5. Keep the current resident pipeline as fallback until the new backend passes
   parity and performance gates.
