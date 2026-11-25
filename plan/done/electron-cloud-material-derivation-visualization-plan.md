# Electron Cloud Material Derivation Visualization Plan

Date: 2026-06-18 AKDT

## Purpose

Add a focused future roadmap for a lower-level visualization layer that lets
users watch material-property derivation at electron, orbital-cloud, charge
density, bonding, polytope-discovery, sample-set, and response-fit scales.

The layer is a diagnostic and teaching surface for the same derivation chain
described by the material property bank, algorithm-derived material property,
WebGPU resolver, and material polytope/property-fit plans. It must not create a
new authority path for material constants. Every visualized frame, sample,
cloud, bond, polytope, or fitted curve must point back to a source closure,
accepted cache artifact, generator fingerprint, validity domain, units, and
validation status.

## Current Feasibility From Local Context

This is feasible as a staged demo layer, but it should start as replay and
inspection before becoming live heavy compute:

- Atomic electron-density data already has a local anchor in
  `src/runtime/electronicStructure/radialKohnSham.js`. `solveAtom()` can return
  orbital energies, occupancies, integrated electron count, scalar-relativistic
  variants, spin-polarized variants, and radial density when requested.
- Molecular bonding data already has a local anchor in
  `src/runtime/electronicStructure/molecularHartreeFock.js`. RHF exposes basis
  functions, orbital coefficients, orbital energies, density matrix, and
  population analysis for Mulliken partial charges and Mayer bond orders.
- Material authority already has a boundary in
  `src/runtime/material/MaterialRegistry.js`, which samples properties through
  closure validity and returns out-of-domain refresh requests instead of silent
  extrapolation.
- Warm material inputs already have schema/provenance shape in
  `src/runtime/material/materialPropertyBank.js` and
  `data/material-properties/elements.json`.
- The ULG demo already has Three.js rendering, Marching Cubes surfaces, optical
  table lookup, WebGPU-resident SPH/MLS-MPM buffers, compact summaries, and
  diagnostic render modes in `src/visualization/sphPhaseScene.js` and
  `src/visualization/sphPhaseDemoMount.js`.
- The polytope/property-fit plan already defines the correct downstream shape:
  accepted domains, deterministic first-principles samples, response fits,
  residual gates, status strings, stale-record rejection, and no extrapolation
  outside accepted envelopes.

The first implementation should therefore be a provenance-backed visualization
artifact pipeline plus a demo inspector, not a full in-frame quantum solver.

## Scope

Visualize the derivation chain behind selected material rows:

- electron orbital clouds and radial density for atoms;
- molecular charge density, partial charges, and bond-order discovery;
- bonding or reaction-coordinate sweeps that expose where a compound/material
  closure came from;
- polytope discovery over material state axes such as phase, temperature,
  pressure, structure, wavelength range, solver family, and output row family;
- sampled first-principles property data inside accepted polytopes;
- curve-fit or table-interpolation closures with residual and validity
  overlays;
- the final reduced algorithm rows consumed by SPH, MLS-MPM, thermal, optical,
  EOS, reaction, and rendering paths.

Out of scope for this planning slice:

- no source edits or schema implementation;
- no promise that electron-cloud visuals are scientifically complete for all
  elements, periodic solids, correlated systems, or excited states;
- no renderer-only material constants;
- no live main-thread SCF, HF, molecular dynamics, or fit generation during an
  interactive simulation frame;
- no hidden extrapolation when a material/input state leaves a closure,
  polytope, or fitted envelope.

## Simulations And Derivation Replays To Visualize

### Atomic Orbital Clouds

Show the atomic closure resolving an element:

- electron configuration and occupied subshells;
- Kohn-Sham SCF iteration progress, residual, integrated electron count, and
  orbital energy convergence;
- radial electron density as a line plot and as a reconstructed spherical
  volumetric cloud;
- optional spin-channel density difference for LSDA paths;
- scalar-relativistic/KH orbital shifts where the optical closure consumes
  interband transitions;
- containment radii and valence/bonding electron counts that feed jellium,
  radial-packing, cohesion, density, plasma frequency, and optical rows.

Display rule: a spherical cloud reconstructed from radial density must be
labeled and keyed as a radial atomic-density reconstruction. It should not be
presented as a full anisotropic molecular orbital unless the artifact carries
the basis/orbital samples needed for that claim.

### Molecular Charge Density And Bonding

Show the molecular closure resolving a formula or product:

- formula parse and canonical atom-vector hash;
- generated or optimized geometry;
- RHF/UHF/MP2 or all-element approximate method chosen, with method status;
- orbital energy ladder and HOMO/LUMO gap;
- density-matrix-derived charge density sampled onto a 3D grid;
- Mulliken partial charges per atom;
- Mayer bond orders as edge thickness/opacity in the molecular view;
- bonding curves or Born-Oppenheimer optimization traces for small molecules;
- vibrational frequency and thermal correction markers when thermochemistry
  uses them.

Display rule: approximate geometry, minimal basis, fallback all-element
solver, or unvalidated scientific status must be visible in diagnostics.

### Bonding And Polytope Discovery

Show how a material domain is accepted, split, or blocked:

- candidate polytope axes and bounds;
- phase/structure partitions;
- sample candidates over temperature, pressure, density, strain, wavelength,
  formula/mixture vector, and solver row family;
- validity exits from source closures;
- domain splits caused by phase transitions, residual spikes, incompatible
  property coverage, or missing provenance;
- accepted domains joined to material keys, property-bank rows, and closure
  refs.

Display rule: polytope visuals are domain diagnostics. They must report
`accepted`, `split`, `blocked-missing-closure`, `out-of-domain`,
`cache-stale`, or equivalent status instead of making a smooth surface look
valid everywhere.

### Sampled First-Principles Property Data

Show the sample pipeline inside an accepted domain:

- sampling strategy: sparse grid, simplex refinement, Chebyshev nodes,
  Latin-hypercube candidates, or boundary stress points;
- source closure evaluated at each point;
- units and normalized axes;
- EOS, phase, mechanics, transport, optical, radiation, reaction, and render
  row outputs;
- deterministic hashes for inputs, methods, closure refs, and generator;
- failed samples and reason codes.

Display rule: warm JSON bank inputs may appear as seeds or cache hits, but the
view must distinguish `precomputed-json-bank`, `first-principles-derived`,
`reduced-estimate`, and `reference-fallback` evidence.

### Curve-Fit And Closure Evaluation

Show how fitted closures are accepted and consumed:

- fit family: piecewise affine/simplex, Chebyshev/tensor polynomial,
  sparse-grid interpolation, constrained monotonic fit, or other compact
  runtime evaluator;
- coefficients or control points in a compact visual form;
- train, validation, boundary, and withheld stress samples;
- residual heatmap, max/mean residual, sign/monotonicity checks, conservation
  checks, and failure regions;
- accepted runtime envelope versus blocked extrapolation region;
- final packed row family for MLS-MPM, SPH, thermal, optical, EOS, reaction,
  surface extraction, or rendering.

Display rule: the demo should animate a fit hit as a cache/evaluator hit, not
as a rerun of the source closure. If the input leaves the envelope, the visual
path should show refresh/invalidate behavior.

## ULG Demo Presentation

Add this as an opt-in inspector inside the existing SPH phase demo, not as a
replacement for the main material simulation.

Expected user flow:

1. User selects a material, compound, product, phase, or rendered surface in
   the main ULG demo.
2. A lower-level derivation inspector opens beside or below the main viewport.
3. The inspector shows a timeline of derivation stages:
   `formula/element -> electronic structure -> molecular/bonding -> material
   closure -> polytope -> samples -> fit -> packed runtime row`.
4. The user scrubs or plays the derivation replay while the main simulation
   remains paused or continues with throttled diagnostics.
5. Stage badges show whether each artifact is `first-principles-derived`,
   `webgpu-derived`, `worker-cpu-derived`, `cache-hit`, `warm-input`,
   `reference-fallback-visible`, `blocked`, or `stale`.
6. The final panel links the visualized derivation to the material/phase row
   currently consumed by the SPH, MLS-MPM, optical, thermal, reaction, gas, or
   surface renderer path.

Visual layout:

- micro-scale viewport: orbital cloud, molecular density, bond graph, or
  polytope/sample/fit scene;
- derivation timeline: SCF/HF iterations, sample points, split events,
  residual gates, cache hits;
- property-row table: material key, phase/structure, units, validity domain,
  source closure refs, generator hash, row schema, and consumer;
- overlay bridge: selected macro particle/surface in the main scene highlights
  the exact material row whose derivation is being replayed.

Scale rule: electron/orbital scenes use their own coordinate frame and scale
legend. They should not be drawn into the meter-scale SPH/MLS-MPM scene except
as a clearly marked inset or inspector.

## Data And Contract Requirements

### Artifact Families

Introduce future schema families parallel to the material bank and polytope
plans:

- `peercompute.ulg.electronic-structure-replay.v0`
- `peercompute.ulg.atomic-radial-density-sample.v0`
- `peercompute.ulg.orbital-cloud-grid.v0`
- `peercompute.ulg.molecular-charge-density-grid.v0`
- `peercompute.ulg.bond-discovery-trace.v0`
- `peercompute.ulg.material-polytope-discovery-trace.v0`
- `peercompute.ulg.first-principles-property-sample-trace.v0`
- `peercompute.ulg.material-response-fit-replay.v0`
- `peercompute.ulg.material-derivation-visualization-bundle.v0`

Every artifact must include:

- schema and schemaVersion;
- material key, formula, atomic number, charge/spin, phase, structure, and
  state axes where applicable;
- source closure refs, input hashes, method hashes, generator fingerprint, and
  source file or module family;
- units, coordinate frame, axis transforms, normalization, and sampling
  resolution;
- validity domain or polytope id;
- validation status, strict-mode status, stale reason, and fallback policy;
- compact summary for UI listing without loading dense buffers;
- dense payload handles for orbital/density/volume grids, not inline megabyte
  JSON blobs in hot UI state;
- invalidation keys matching material property bank, polytope, sample, fit,
  solver ABI, and renderer row versions.

### Atomic Density Contract

Atomic density records should carry:

- element symbol and atomic number;
- solver family: Kohn-Sham LDA, LSDA, KH scalar-relativistic, or fallback;
- grid definition in Bohr and optional derived meter-scale display transform;
- total radial density and optional spin-up/spin-down radial density;
- orbital labels, occupancies, energies, and optional radial orbital samples;
- integrated electron count and residual/convergence summary;
- containment radii used by element closure derivation.

### Molecular Cloud Contract

Molecular density records should carry:

- canonical formula, atom-vector hash, charge, multiplicity, and geometry;
- basis family, basis function descriptors, density matrix or sampled grid;
- orbital energies and optional orbital coefficient payload handles;
- population-analysis outputs: partial charges and bond orders;
- method status: RHF, UHF, MP2, all-element approximate fallback, or blocked;
- grid resolution, bounding box, isovalue policy, and units.

### Polytope/Sample/Fit Linkage

Visualization bundles must link to the existing planned records:

- material property bank record when used as warm input;
- material polytope record for accepted domain geometry;
- first-principles sample-set record for evaluated closure points;
- response-fit record for fitted runtime evaluator;
- packed runtime row record for MLS-MPM, SPH, thermal, optical, EOS, reaction,
  surface, or rendering consumers.

This preserves the planned source-of-truth hierarchy: lower-level closure graph
or accepted cache artifact first, visual replay second, renderer third.

## WebGPU And Rendering Implications

### Rendering Path

Use the existing Three.js/WebGPU split pragmatically:

- CPU/worker produces small metadata, stage timeline, and compact summaries.
- Dense atomic/molecular grids are uploaded as GPU buffers or 3D textures when
  available, with CPU fallback thumbnails for unsupported WebGPU.
- Atomic radial density can be reconstructed as a spherical volume or shell
  mesh in a lightweight shader before full molecular grid sampling exists.
- Molecular charge density should use a sampled 3D scalar field, rendered by
  raymarching, iso-surface extraction, or sparse point/sprite volume depending
  on device limits.
- Bond graphs can be instanced cylinders/lines over the molecular geometry,
  weighted by bond-order artifacts.
- Polytope/sample/fit scenes can use lower-dimensional projections, parallel
  coordinates, simplex/cell outlines, sample points, and residual heatmaps.

### Compute Path

Do not run expensive derivation on the main render thread:

- first versions replay stored or worker-produced artifacts;
- SCF/HF/sample/fit progress is evented into visualization records;
- WebGPU compute for dense field sampling can arrive after CPU reference
  artifacts and parity tests exist;
- hidden main-thread closure work during a running demo should be treated as a
  bug, matching the WebGPU resolver plan;
- worker or PeerCompute fallback should be visible as `worker-cpu-derived` or
  `peercompute-derived`, not hidden behind a smooth animation.

### Residency And Memory

- Keep dense grids out of regular StateManager/UI JSON. Store handles,
  content hashes, dimensions, and validity metadata in hot state.
- Throttle readback to compact summaries: residual extrema, electron count,
  sample status counts, fit residual bounds, and bounding boxes.
- Use LOD tiers for mobile: radial line plot, low-res volume, high-res volume,
  and full molecular density should be separate capabilities.
- Cap density-grid dimensions per device limit and expose downsample reason.
- Reuse existing material/optical/render diagnostics so unsupported WebGPU,
  CPU fallback, stale cache, and strict-mode blockers are visible.

## Risks

- Scientific overclaim: radial atomic clouds, HF/STO-3G molecular density, and
  fitted response functions can look authoritative even when the method is an
  approximation or unvalidated for the scenario.
- Authority inversion: renderer-friendly clouds or fitted curves could be
  mistaken for source material properties unless every view carries closure
  refs and validation status.
- Performance: live SCF/HF, dense volume sampling, and fit generation can stall
  the demo if they run on the main thread or read back dense buffers.
- Memory: 3D density grids and per-frame replay traces can exceed mobile and
  integrated GPU limits without LOD and handle-based storage.
- Scale confusion: electron-scale coordinates and meter-scale SPH/MLS-MPM
  coordinates are physically different views and must not be merged without a
  clear inset/legend.
- Polytope trust: smooth visuals can hide invalid regions, phase boundaries,
  missing closure families, or high residuals.
- Provenance drift: visual replay artifacts must become stale when closure
  code, generator fingerprints, property bank schema, polytope geometry, sample
  plan, fit evaluator, solver ABI, or renderer row layout changes.

## Todo Sequence

### Phase 0 - Inventory And Naming

- Audit atomic, molecular, material registry, property bank, polytope, fit,
  optical, and demo-renderer artifacts for reusable fields.
- Pick final schema names for electronic replay, orbital cloud, molecular
  density, bond trace, polytope trace, sample trace, fit replay, and bundle
  artifacts.
- Define status strings shared with the material polytope/property-fit plan:
  `first-principles-derived`, `precomputed-json-bank`, `warm-input`,
  `sampled`, `fit-hit`, `cache-stale`, `out-of-domain`,
  `blocked-missing-closure`, `reference-fallback-visible`,
  `worker-cpu-derived`, and `webgpu-derived`.

### Phase 1 - CPU Reference Replay Artifacts

- Add a reference artifact builder for atomic radial density from `solveAtom()`
  with `returnRadialDensity`.
- Add a reference artifact builder for small-molecule RHF density/bond traces
  using basis, density matrix, partial charges, and bond orders.
- Persist only compact example artifacts for H, O, Na, Fe, H2, O2, H2O, and
  current demo products until schema and validation settle.
- Add strict-mode guards that reject missing units, missing source refs, stale
  generator hashes, or unsupported method claims.

### Phase 2 - Demo Inspector Shell

- Add an opt-in derivation inspector to the SPH phase demo.
- Link selected macro material/phase/render rows to the visual bundle that
  explains their derivation.
- Implement atomic radial-density line plot plus spherical cloud preview.
- Implement molecular geometry plus bond-order graph preview.
- Show timeline, provenance, validity, cache status, and fallback badges before
  adding dense GPU volume rendering.

### Phase 3 - Polytope, Sample, And Fit Replays

- Visualize accepted material polytopes as projected domains with phase and
  structure partitions.
- Animate deterministic sample plans and mark failed/out-of-domain samples.
- Add residual heatmaps and boundary stress-point overlays for response fits.
- Link fit replay outputs to the packed runtime rows consumed by SPH, MLS-MPM,
  thermal, optical, EOS, reaction, surface extraction, and rendering.

### Phase 4 - Worker And WebGPU Field Sampling

- Move molecular grid sampling and orbital-cloud reconstruction to a worker
  first, with CPU parity tests.
- Add WebGPU compute samplers for dense basis-function/density-grid evaluation
  only after CPU artifacts are deterministic.
- Upload dense grids as GPU-resident resources and read back only compact
  summaries.
- Add mobile LOD and unsupported-WebGPU fallback diagnostics.

### Phase 5 - Live Derivation Progress

- Stream SCF/HF/sample/fit progress events into replay artifacts from worker or
  PeerCompute lanes.
- Animate convergence, bond optimization, polytope splitting, and fit residual
  improvement without blocking the active material simulation.
- Surface refresh/invalidation events when user inputs leave the accepted
  domain or a cache record becomes stale.

### Phase 6 - Persistence And Validation

- Persist accepted visualization bundles by content hash next to the material
  bank/polytope/sample/fit artifacts.
- Invalidate bundles on closure, generator, schema, sample-plan, fit,
  coordinate-frame, solver ABI, or renderer-row changes.
- Add unit tests for schema validation, stale rejection, strict-mode blocking,
  and artifact linkage.
- Add browser/e2e tests for inspector open/close, selected-material linkage,
  fallback badges, no hidden main-thread closure work, and mobile LOD.

## Completion Gates

- Selecting a material or product in the demo can open a derivation inspector
  that identifies the material row and its authority path.
- Atomic element rows can replay orbital-energy convergence and radial density
  with units, closure refs, integrated electron count, and cache status.
- Small compound rows can replay geometry, charge density, partial charges,
  bond orders, and method validity status.
- Polytope/sample/fit replays can show accepted domains, sample points,
  residual gates, and blocked extrapolation regions.
- The final reduced rows consumed by SPH, MLS-MPM, thermal, optical, EOS,
  reaction, surface, and rendering paths can be traced back to visualized
  samples/fits or to a visible fallback.
- Unsupported WebGPU, CPU-worker fallback, stale cache, missing provenance, and
  strict-mode blockers are visible in the inspector.
- Dense visual artifacts do not require full hot-loop readback and do not run
  heavy closure derivation on the main UI thread.

## Dependencies

- `plan/todo/material-property-json-bank-plan.md`
- `plan/todo/algorithm-derived-material-properties-plan.md`
- `plan/todo/webgpu-material-property-resolvers-plan.md`
- `plan/todo/material-polytope-registry-and-property-fit-plan.md`
- `plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`
- `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`
