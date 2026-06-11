# Implementation Status

Updated: 2026-06-10 23:10 AKDT

## Done

- Read `agents.md`, `/home/cos/projects/AGENTS.md`, and the ULG v0.5 PDF.
- Added the strict first-principles material-property provenance gate and then
  replaced the production/default Fe, H2O, air, H2, O2, element, and product
  closure paths with a generic derivation pipeline. The production path now
  parses formulas, derives element closures from atomic DFT/jellium or
  atomic-density packing, derives compound closures from formula geometry,
  molecular HF/atomic DFT/statistical mechanics, and rejects reference or
  reduced material-property provenance by default.
- Implemented a generalized scalar-relativistic interband optical response for
  element closures. Metals now combine the derived Drude free-electron plasma
  response with Koelling-Harmon Kohn-Sham dipole-allowed localized d/f
  transitions, target-vacancy oscillator weights, electron-gas broadening, and
  CIE/sRGB integration. Gold now emerges gold-tinted from oscillator data
  rather than a per-element color patch; p-block simple metals stay on the
  Drude path when no localized d/f oscillator is resolved. Renderer metal
  opacity uses the same Drude-Lorentz complex dielectric response and can reuse
  precomputed closure oscillators. `opticalInterbandOscillators` is tracked in
  the material-property provenance ledger.
- Added human-readable element names and a MoonLab-style periodic-table picker
  to the SPH phase demo material controls. The dropdown now lists labels such as
  `Gold (Au, Z=79) - derived element`, while Fe keeps the existing `fe` runtime
  key for URL/simulation compatibility. The picker is vanilla DOM, shares the
  same material option source as the dropdown, filters unavailable noble-gas
  closures, and preserves the strict derived-closure material path.
- Added the first GPU-resident optical/PBR bridge. `ulg-gpu-abi` now declares
  stable `peercompute.ulg.optical-gpu-table.v0` and
  `peercompute.ulg.optical-gpu-buffer-set.v0` row layouts for packed material
  records and spectral samples, plus `peercompute.ulg.optical-gpu-lookup.v0`
  query/output rows and an `opticalLookupWgsl` compute kernel.
  `opticalGpuBuffers.js` packs cached `opticalRenderParams()` results into
  typed arrays/uploadable WebGPU storage buffers, samples those resident records
  by material/phase id through CPU parity or WebGPU dispatch, and the SPH
  renderer now exposes the packed table for each visible material/phase batch
  plus lookup rows for the active surface batches. The live SPH overlay now
  schedules optional browser WebGPU lookup execution with CPU parity, cached
  device acquisition, stale-generation rejection, and CPU fallback. The visible
  renderer decodes the accepted lookup rows into draw-state metadata and applies
  those rows to the corresponding Three.js `MeshPhysicalMaterial` surfaces. This
  is still an interim display layer, not a WebGPU renderer. Optical material ids
  are stable across table rebuilds: elements use atomic number and compounds use
  deterministic f32-exact hashed ids.
- Added the first SPH GPU particle-buffer ABI/runtime packer. `ulg-gpu-abi`
  now declares `peercompute.ulg.sph-gpu-particle-buffer.v0` and
  `peercompute.ulg.sph-gpu-particle-buffer-set.v0` with f32x4-aligned state
  and thermo rows. `sphGpuBuffers.js` packs CPU-authoritative particles into
  WebGPU-ready storage buffers, deriving temperature and phase fractions from
  closure internal energy, sharing optical material ids and phase ids, and
  keeping scientific/SPH/phase validation false. The live SPH overlay now builds
  the packed snapshot after every particle sync, exposes it through the scene,
  and optionally uploads it to a cached browser WebGPU device. This is residency
  plumbing, not a GPU SPH mechanics solver.
- Added the first MLS-MPM mechanics-state GPU buffer ABI/runtime packer:
  `peercompute.ulg.mls-mpm-gpu-particle-buffer.v0` and buffer-set schema. It
  packs deformation gradient `F`, affine velocity field `C`, volume ratio `J`,
  rest particle volume, solid flag, and status into f32x4-aligned rows, with
  upload/destroy helpers. The live SPH overlay now builds this packed mechanics
  snapshot after each particle sync, exposes it through the scene, and uploads
  it to the cached browser WebGPU device beside the SPH thermodynamic/state
  snapshot. This makes the current CPU mechanics state resident in WebGPU
  storage buffers but does not execute P2G/grid/G2P on WebGPU yet.
- Restored the SPH phase demo to running by default under strict provenance:
  the ice block starts solid at -40 F, the drop block starts molten from its
  own derived liquidus plus superheat, the preflight uses attached closures
  instead of reference fixtures, and room-temperature Na + H2O can react into
  a derived NaOH product closure when initialized in contact.
- Spawned sidecar agents for MoonLab, Eshkol, peercompute, and ICC/swarm.
- Used ICC repo registry/status and architecture summaries for MoonLab and peercompute.
- Added a vanilla Vite/three.js ULG app.
- Added shared ULG GPU ABI descriptors and JSON schemas.
- Added PeerCompute-style service registry, child-worker leases, GPU broker,
  artifact cache, worker supervisor, dummy Eshkol/MoonLab service workers, and
  browser telemetry.
- Added Phase 1 ULG carrier-runtime foundations: `ClosureRegistry`,
  table-interpolation closure handles, CPU-reference two-particle carrier
  runtime, invariant drift reports, a `peercompute.ulg.simulation-artifact.v0`
  schema/builder, and a first-class `ulg-runtime` service contract.
- Added `window.__ulgDemo.runOscillatorDemo()` and a supervised
  `src/services/ulgRuntime.worker.js` path that consumes a cached toy closure
  and emits a simulation artifact while keeping scientific/full-physics flags
  false.
- Added Phase 2 optional WebGPU carrier-runtime plumbing: a WGSL toy
  two-particle carrier step, WebGPU execution path guarded by CPU-reference
  parity, worker-local device-loss fallback reporting, GPU broker device-loss
  lease marking, and compact simulation WebGPU summary/UI fields. This remains
  a toy carrier runtime and does not claim SPH/material/full-physics
  validation.
- Added ABI-level closure-table WGSL descriptor emission:
  `createClosureTableDescriptor()` now includes a
  `peercompute.ulg.closure-table-wgsl-descriptor.v0` contract for deterministic
  f32x4 `ClosureTableSample` rows, and `createClosureTableSampleBuffer()`
  encodes closure samples for the carrier WebGPU path. This is a table-layout
  runtime contract, not a general LLVM-to-WGSL compiler or calibrated material
  validation.
- Surfaced that descriptor through the oscillator closure artifact cached by
  `runOscillatorDemo()`, so browser/runtime inspection can verify the
  `ClosureTableSample` row contract on a concrete closure artifact before any
  production WGSL compiler path exists.
- Added Phase 3A carrier topology primitives: normalized particle state,
  deterministic spatial hashes, radius-limited neighbor pairs, and
  closure-sampled edge messages with antisymmetric force conservation summaries.
  This is first-principles locality/operator substrate for future
  field/material/EOS work, not an SPH demo or phase-change validation.
- Wired the CPU-reference two-body carrier force path through the Phase 3A
  topology/edge-message primitives so compact deltas now carry
  `peercompute.ulg.edge-message-summary.v0` conservation evidence.
- Added Phase 3A field-observer primitives over neighbor graphs with
  compact-support scalar smoothing summaries and explicit no-SPH/no-material/
  no-phase-change validation scope.
- Surfaced Phase 3A edge-message conservation summaries through simulation
  artifact summaries, browser artifact rows, and oscillator e2e coverage.
- Surfaced Phase 3A field-observer summaries through CPU/WebGPU carrier compact
  deltas, simulation artifact summaries, browser artifact rows, and oscillator
  e2e coverage as `field:pass` operator telemetry. The observed scalar fields
  include mass but are not interpreted as density, EOS, material properties,
  SPH dynamics, or phase-change validation.
- Added Phase 3A field-closure sample descriptors over observed scalar fields.
  Carrier deltas now include `peercompute.ulg.field-closure-sample-summary.v0`
  by sampling the toy closure over the observed `closureAxisR` field, and
  artifact summaries expose compact `simulationFieldClosureSample*` fields,
  including input, sampled-output, and derivative bounds. This is closure-field
  interpolation/operator evidence only, not material properties, EOS, SPH
  dynamics, phase-change validation, or calibrated scientific runtime.
- Added a closure refresh-request decision object to field-closure sample
  summaries. Out-of-range observed scalar fields now produce
  `peercompute.ulg.closure-refresh-request.v0` with an explicit
  `invalidate-and-rerun-closure-derive` registry action, and
  `ClosureRegistry.applyRefreshRequest()` can invalidate the cached closure
  without promoting the evidence to material, EOS, SPH, phase-change, or
  scientific validation.
- Closed the end-to-end closure refresh path (recommended-work item 1). A
  supervised carrier run that leaves the closure's sampled validity domain now
  halts cleanly (keeping prior deltas), emits a
  `carrier-runtime-closure-domain-exit` refresh request on the simulation
  artifact (`validity.status: closure-domain-exited`, `validation: warn`),
  and `runOscillatorDemo()` consumes it via
  `applyClosureRefreshFromSimulation()` to call
  `ClosureRegistry.applyRefreshRequest()`, emit the `closure-invalidated` event,
  and cache an explicit `peercompute.ulg.closure-invalidation-artifact.v0`
  evidence artifact. Still recommendation-only: no production closure is yet
  rederived, and no material/EOS/SPH/phase/scientific validation is claimed.
  Verified `npm test` (`60/60`), `npm run build`, `npm run test:e2e` (`2/2`), and
  `git diff --check`; ULG `status:live` healthy (PeerCompute 5185 down so the
  bridge ack was not re-confirmed, envelope untouched).
- Added an opt-in ULG runtime handoff (recommended-work item 3).
  `createPeerComputeUlgRuntimeHandoff()` / exported
  `createUlgRuntimeHandoff(artifactCache, options)` include only
  `ulg-runtime`/`ulg-runtime-fixture` closure + simulation (+ invalidation)
  artifacts, surface `tableDescriptor.wgslTableDescriptor` on each entry for
  PeerCompute inspection, and add MoonLab/Eshkol ancestors only when
  `includeAncestors` is set; the default handoff/bridge path is untouched.
  `inferArtifactKind` now classifies the closure-invalidation artifact distinctly.
- Closed limitation #1 with an opt-in closure rederivation loop (recommended-work
  item 4). After a recommended invalidation,
  `applyClosureRefreshFromSimulation({ rederiveClosure })` re-derives a refreshed
  closure (`rederiveToyOscillatorClosure` infers the harmonic constants and
  expands the validity domain to cover the offending input), `store()`s it in the
  registry, and emits a `peercompute.ulg.closure-rederivation-artifact.v0`
  evidence artifact (old→new lineage). The re-derived closure resolves in-range
  at the point that previously left the domain. Opt-in via `rederiveOnRefresh`;
  the re-derived closure is a toy reference and asserts no
  material/EOS/SPH/phase/scientific validation. Verified `npm test` (`64/64`),
  `npm run build`, `npm run test:e2e` (`2/2`), `git diff --check`, and the live
  two-server ULG→Multiscale handoff smoke (default 2-artifact handoff intact).
- Started the SPH phase demo on the core-physics path with the thermodynamic
  energy-feasibility preflight (the plan's "Immediate Next Slice"; demo plan P0
  done, P1 partially). Added tagged reference material fixtures (H2O/Fe/air, all
  `closureBacked: false`), a piecewise specific-internal-energy model with latent
  heats, `createSphPhaseScenario`/`computeThermodynamicPreflight`
  (`src/runtime/thermoPreflight.js`), and a `thermodynamic-preflight.v0` ABI
  artifact builder with overclaim guards. Geometry: 1 m ice cube + iron cube at
  1/8 the ice volume (0.5 m edge) in a 10 m sealed box of -40 F air, with six
  infinite fixed-temperature reservoir walls. The preflight computes masses
  (iron 875 kg, ice 917 kg, air ~1512 kg), the ~864 MJ exported to the cold
  walls, the energy-conserving adiabatic equilibrium (~352.6 K), transient
  phase-excursion energetics (iron can melt but not boil all the ice), and the
  cold-iron+ice feasibility verdict: feasible with cold infinite reservoirs,
  correctly INFEASIBLE for an adiabatic box or walls at/above freezing. Verified
  `npm test` (`70/70`) and `npm run build`. Material/EOS/SPH/phase remain
  blocked; the reference constants are replaced by MoonLab/Eshkol material
  closures in demo plan P2.
- Built the SPH phase demo closure pipeline + thermodynamic core (demo plan
  P1/P2/P3), all evidence-only. P1: `eshkol.ulg.*-closure.v0` builders
  (`createMaterialClosureArtifact`) with a single overclaim guard
  (`assertNoOverclaim`) that rejects any validation flag without evidence refs,
  plus wall-temperature-boundary (six-face guard), particle-resolution
  (mass-invariant guard), phase-equilibrium, and conservation-report builders.
  P2: H2O/Fe/air reference-fixture material closures storable in ClosureRegistry
  with provenance to the pending MoonLab microphysics references, and a
  `MaterialRegistry` whose `sampleProperty` goes through ClosureRegistry and
  emits the closure-refresh request on a domain exit instead of extrapolating.
  P3: a thermodynamic core (specific internal energy <-> temperature, phase
  equilibrium via lever rule over latent plateaus) and a closure-backed preflight
  that re-derives the energy budget through the registry and is verified
  consistent with the reference-constant preflight. Verified `npm test`
  (`83/83`) and `npm run build`. Material/EOS/SPH/phase validation stay false
  until MoonLab/Eshkol produce and validate the cited microphysics references;
  next is the P4 conservative SPH carrier consuming `equilibriumFromSpecificEnergy`.
- Stood up the conservative SPH carrier (demo plan P4), CPU reference and
  evidence-only. `src/runtime/sph/` adds a cubic-spline kernel + symmetric
  momentum/thermal-energy SPH operators with Monaghan artificial viscosity, SPH
  particle state, conservation diagnostics, and a leapfrog phase carrier whose
  per-particle phase emerges from specific internal energy via the P3
  `equilibriumFromSpecificEnergy` solver, plus a `sph-phase-simulation-artifact.v0`
  builder. Verified momentum is conserved to round-off, total energy is conserved
  (<1% drift inviscid) with exact mass, and phase classification works
  (`npm test` `88/88`). Deferred to later slices: multi-material contact, Tait/
  condensed EOS, six fixed-temperature wall heat flux (P5), spatial-hash neighbor
  acceleration (P7). sph/phase/material/scientific validation stay false until the
  cited MoonLab/Eshkol microphysics references exist and validate.
- Produced the first real MoonLab ab-initio microphysics references and wired them
  into the material-closure pipeline. A driver
  (`tools/moonlab-microphysics/h2_h2o_microphysics.c`) links MoonLab's
  `libquantumsim.so`, has MoonLab construct the molecular qubit Hamiltonian
  (Jordan-Wigner), and exact-diagonalizes it. The H2 dissociation curve has its
  minimum at the experimental bond length (0.7414 A), is within ~4.9 mHa of the
  FCI reference, and gives a ~3.87 eV bond energy; the H2O 8-qubit model
  Hamiltonian is exactly diagonalized (model-only, not quantitative). Added
  `moonlab.ulg.microphysics-reference.v0` artifacts (`microphysicsReferences.js`),
  a committed deterministic dataset, and updated the H2O material closure to cite
  the produced reference (status produced) — without flipping materialValidation,
  which stays false because the reference is model-quality. Fe and air microphysics
  remain pending. Verified `npm test` (`92/92`). The microphysics chain is real;
  un-blocking material/EOS/scientific validation needs a quantitative basis (and Fe
  is a much harder solid-state problem) plus Eshkol-side closure compilation.
- Stood up a new ULG SPH phase demo (MLS-MPM render style; lives in ULG, not
  Multiscale). `src/runtime/sphPhaseDemo.js` builds the ice-on-molten-iron
  particle cloud from the material closures, runs the preflight, and steps the
  CPU-reference carrier (sealed-box reflection + display speed clamp). The
  three.js renderer (`sphPhaseScene.js`) + overlay UI (`sphPhaseDemoMount.js`,
  six wall-temperature inputs + status rows) are wired into `main.js` via an
  "SPH Phase" button and `window.__ulgDemo.runSphPhaseDemo*`. Particle colour is
  closure-backed where physics allows: `src/runtime/material/radiationClosure.js`
  derives the incandescent glow from Planck's law (blackbody -> CIE 1931 -> sRGB;
  molten iron renders orange), and intrinsic/reflective colour is a flagged
  placeholder pending the optical closure + MoonLab optical-response microphysics.
  The demo-tuned colormap was removed. Verified `npm test` (`99/99`),
  `npm run build`, and a headless browser check (overlay opens, preflight
  feasible, 280 particles, no errors). sph/phase/material/optical/scientific
  validation stay false; P5 (condensed EOS, multi-material contact, wall heat
  flux, conduction) is the next physics slice.
- Replaced the broken/placeholder material closures with first-principles
  derivations (`statisticalMechanics.js`, `opticalClosure.js`). Heat capacity:
  air from equipartition over molecular degrees of freedom (cv≈715, matching
  measured air <1%), solid iron from the Debye model with θ_D derived from sound
  speed + atomic density (cv(233K)≈368 rising to Dulong–Petit) — integrated into
  the thermo core (per-phase constant-cp or Debye energy + energy→temperature
  inversion). Optics: intrinsic colour derived from Drude free-electron
  reflectance (iron → warm grey), Beer–Lambert O–H overtone absorption (water/ice
  → blue), and Rayleigh (air → near-transparent), integrated over CIE 1931 → sRGB;
  the SPH demo's particle colour is now fully closure-backed (Planck radiation
  glow + optical intrinsic colour, no demo-tuned/placeholder colours). All
  closureBacked but model-derived, not measured-validated, so
  material/EOS/optical/scientific validation stay false. Still reference fixtures
  (flagged): latent heats, melting/boiling points, liquid + ice heat capacities,
  condensed densities. Verified `npm test` (`107/107`), `npm run build`, headless
  render (ice blue, iron orange glow).
- Added enforceable material-property provenance. Each H2O/Fe/air/H2/O2 closure
  now carries a per-property ledger and `materialDerivation` summary; registry
  samples return provenance for the sampled property. H2/O2 gas density is now
  ideal-gas-law derived instead of tabulated. H2O/Fe condensed properties remain
  explicitly reference-blocked, not falsely marked first-principles. Element and
  product-compound closures also carry provenance; product closures no longer
  invent fallback density/bulk constants. Reaction discovery now consumes
  material closure metadata for molar mass, phase gates, density, and stiffness.
  Verified `npm test` (`43/43`), `npm run build`, and focused SPH Playwright
  (`2/2`), including `tests/materialPropertyProvenance.test.mjs`.
- Added the first all-element molecular/reaction solver rung beyond the
  STO-3G H-Ar basis wall. Heavy-element reactions now switch the whole reaction
  energy baseline to `atomic-kohn-sham-tight-binding-v0`, derived from atomic
  Kohn-Sham radial densities, orbital binding scales, containment radii, and a
  universal pair Hamiltonian. `discoverReactions('fe','o2')` now derives FeO,
  `discoverReactions('fe','h2o')` derives FeOH, and both product closures pass
  the strict no-reference/no-reduced provenance gate. Generic compound material
  derivation also uses the all-element molecular atomization path when RHF/STO-3G
  cannot cover the formula. This is evidence-level, not calibrated
  thermochemistry; validation flags remain false. Verified `npm test` (`44/44`),
  `npm run build`, `npm run test:e2e -- --grep "SPH phase demo"` (`2/2`), and
  `git diff --check`.
- Replaced hard-coded render opacity/transmission defaults with derived optical
  depth. Conductors now derive opacity/transmission from Drude complex index and
  skin-depth absorption using the material closure's conduction-electron
  density, so selectable metals such as Au no longer fall through to the generic
  translucent renderer. Water/ice/steam opacity now comes from Beer-Lambert
  O-H-overtone optical depth; pure steam is nearly invisible unless a future
  condensation/nucleation droplet closure derives scattering. Missing optical
  inputs return a blocked render contract instead of fake opacity. This is still
  CPU-reference JS; the same closure-input/optical-output contract needs to be
  moved into WebGPU/WGSL buffers next. Verified `npm test` (`44/44`),
  `npm run build`, focused SPH Playwright (`2/2`), and `git diff --check`.
- Promoted the material provenance contract to strict runtime enforcement.
  `MaterialRegistry`, reaction discovery, generated element/product closures,
  SPH demo construction, and SPH preflight now reject reference or reduced
  material properties by default. Fixture behavior is still available only via
  explicit test/demo opt-ins (`requireFirstPrinciples: false`,
  `allowFixtureMaterialProperties`, `allowReducedProductProperties`). The live
  SPH overlay now reports missing first-principles Fe/H2O/Na/product closures as
  blockers instead of rendering a fake reference-material sim. Verified
  `npm test` (`43/43`), `npm run build`, and focused SPH Playwright (`2/2`).
- Added unit tests and Playwright smoke coverage.
- Verified `npm test`, `npm run build`, and `npm run test:e2e`.
- Verified the carrier-runtime slice with syntax checks, focused
  ClosureRegistry/carrier/ABI tests, `npm test` (`27/27`), `npm run build`,
  `npm run test:e2e` (`2/2`), and `npm run status:live -- --bridge`.
- Verified the WebGPU carrier-runtime slice with syntax checks, focused
  WebGPU/broker/supervisor/carrier/ABI tests, `npm test` (`36/36`),
  `npm run build`, `npm run test:e2e` (`2/2`),
  `npm run status:live -- --bridge`, and `git diff --check`.
- Verified the topology primitive slice with syntax checks, focused
  carrier/spatialHash/edgeMessages/WebGPU parity tests (`17/17`), and `npm test`
  (`44/44`), `npm run build`, `npm run test:e2e` (`2/2`), and
  `git diff --check`.
- Verified the field-observer primitive slice with syntax checks, focused
  observer/topology tests (`12/12`), `npm test` (`49/49`), `npm run build`,
  `npm run test:e2e` (`2/2`), and `git diff --check`.
- Verified the closure-table WGSL descriptor slice with syntax checks, focused
  ABI/WebGPU/carrier tests (`14/14`), `npm test` (`54/54`), `npm run build`,
  `npm run test:e2e` (`2/2`), `npm run status:live -- --bridge`, and
  `git diff --check`.
- Verified the oscillator closure-artifact descriptor surface with syntax
  checks, focused ABI/WebGPU/carrier tests (`14/14`), `npm test` (`54/54`),
  `npm run build`, full Playwright e2e (`2/2`), `npm run status:live --
  --bridge`, and `git diff --check`.
- Verified the closure refresh-request slice with syntax checks and focused
  field/carrier/WebGPU tests (`16/16`), `npm test` (`56/56`),
  `npm run build`, full Playwright e2e (`2/2`), `npm run status:live --
  --bridge`, and `git diff --check`.
- Verified the edge-summary surface with syntax checks, focused
  carrier/edge/observer/spatial tests (`15/15`), `npm test` (`49/49`),
  `npm run build`, `npm run test:e2e` (`2/2`), and `git diff --check`.
- Verified the field-observer carrier surface with syntax checks, focused
  carrier/observer/WebGPU tests (`15/15`), `npm test` (`49/49`),
  `npm run build`, and `npm run test:e2e` (`2/2`).
- Verified the field-closure sample surface with syntax checks, focused
  carrier/observer/WebGPU/field-closure tests (`19/19`), `npm test` (`53/53`),
  `npm run build`, `npm run test:e2e` (`2/2`), and
  `npm run status:live -- --bridge`.
- Added `@ulg/gpu-abi/service-contract` builders for Eshkol/MoonLab service
  manifests and task capsules.
- Added cross-repo adapter README and static Eshkol/MoonLab manifest/task
  fixtures under `ulg-gpu-abi/examples/`.
- Refactored the demo runtime to consume the shared service contract builders
  instead of maintaining private manifest/task construction.
- Confirmed no copied `peercompute/` source subtree remains in the ULG checkout;
  PeerCompute-owned service orchestration stays in `/home/cos/projects/peercompute`.
- Verified `npm test`, `npm run build`, and `npm run test:e2e` after the contract
  refactor.
- MoonLab sidecar completed: useful surfaces identified, but JS unit regressions,
  missing WASM dist packaging, and real browser WebGPU parity remain blockers.
- peercompute sidecar completed: current Multiscale/remote-placement tests and
  build pass; reusable targets are `ComputeManager`, `NodeKernel`, `SolverRegistry`,
  relay tooling, NetViz telemetry, and Multiscale ULG schemas.
- ICC/swarm sidecar completed: ICC has MoonLab/peercompute indexes; refreshes need
  parser installation; swarm should be used lightly until a ULG profile exists.
- Eshkol sidecar completed: the compiler can build and emit WASM hello output,
  but browser WebGPU/WGSL support does not exist yet and the service path should
  avoid JIT until the observed derivative hang is understood.
- Added the Eshkol-side `scripts/emit_ulg_closure_artifact.py` helper on the
  `ulg` branch. It compiles `.esk` through `eshkol-run --wasm` or inspects an
  existing `.wasm`, parses WASM imports/exports, and emits a ULG v0.5
  service-worker-safe closure artifact JSON file.
- Added Eshkol CTest coverage for the helper and verified the generated artifact
  against the ULG closure artifact schema.
- MoonLab `ulg` branch now has local commit `2461d15` fixing core JS/WASM
  readiness blockers: unit regressions, WASM dist packaging, Emscripten runtime
  readiness, JS/WASM ABI issues, integration-test bit ordering, and documented
  pure-state purity behavior.
- Verified `bindings/javascript/packages/core/dist/moonlab.js` and
  `moonlab.wasm` exist after the MoonLab core build.
- PeerCompute `multi-scale-physics-sim` branch now has local commit `975c23e1`
  adding reusable service orchestration primitives: `ComputeServiceRegistry`,
  `ChildWorkerLeaseManager`, `WorkerSupervisor`, and
  `ComputeManagerServiceAdapter`.
- PeerCompute service orchestration tests passed headlessly and the package is
  exported through the public peercompute index.
- Added the browser-facing `public/service-assets/` convention for copied
  MoonLab/Eshkol artifacts without copying sibling repo source.
- Added MoonLab service asset manifest helpers and worker-side probes for
  `moonlab.js`, `moonlab.wasm`, expected WASM MIME, and
  `locateFile("moonlab.wasm")` resolution.
- Added service telemetry for asset probe status and a browser worker smoke that
  consumes the published MoonLab service manifest/task fixtures.
- Verified `npm test`, `npm run build`, `npm run test:e2e`, and
  `git diff --check` after the asset-probe slice.
- Copied generated MoonLab core artifacts into the ignored local runtime
  directory `public/service-assets/moonlab/`. The live browser worker now reports
  MoonLab asset probe status `ready`, with JS served as `text/javascript` and
  WASM served as `application/wasm`.
- MoonLab `ulg` branch now has local commit `5ce415f` exporting
  `quantum_state_create`/`quantum_state_destroy` to the core WASM runtime so
  browser workers can allocate/free states without knowing the C struct layout.
- Added tracked ULG classic child worker
  `public/workers/moonlab-core-probe.worker.js`. When MoonLab assets are ready,
  the supervised root service leases that worker, instantiates `MoonlabModule`
  with `locateFile`, creates a Bell `phi_plus` state in the real WASM module,
  and records `[0.5, 0, 0, 0.5]` basis probabilities in the MoonLab artifact.
- Verified the live VPN demo at `http://100.86.83.35:5173/` reports MoonLab
  `method = moonlab-wasm-bell-phi-plus-probe`, `coreProbe = ready`, and
  `validation = pass`.
- Extended the MoonLab task artifact with
  `peercompute.ulg.quantum-response-descriptor.v0` and
  `peercompute.ulg.quantum-response-parity.v0`, including a passing
  `moonlab-wasm-core` comparison against the analytic Bell `phi_plus`
  probability vector and an explicit unsupported `moonlab-webgpu` parity entry.
- Extended the same supervised MoonLab core probe with
  `peercompute.ulg.magnetar-dipole-ising-calibration.v0`. The browser worker
  now uses MoonLab WASM Ising exports to evaluate the normalized magnetar dipole
  calibration handoff, records eight bitstring energies, reports ground state
  `000`, and passes JavaScript reference parity with `maxEnergyDelta = 0`.
- Added `peercompute.ulg.artifact-summary.v0` telemetry summaries to the local
  artifact cache. Browser telemetry now exposes quantum-response descriptor
  readiness, parity status, unsupported parity modes, and MoonLab magnetar
  calibration readiness without requiring consumers to fetch the full artifact
  body.
- Added an Eshkol closure-bundle service asset convention and readiness probe
  for bundles exported by `scripts/export_ulg_closure_bundle.py`. The current
  live demo can report the ignored local `hello` bundle as ready when copied
  under `public/service-assets/eshkol/closures/hello/`.
- Updated the supervised Eshkol worker to return the staged closure bundle
  artifact when the bundle is ready, with dummy closure output kept as the
  missing-asset fallback.
- Extended compact artifact-summary telemetry with Eshkol closure-bundle fields:
  closure kind, module URL/hash, service-worker safety, dynamic-code flags,
  bundle manifest metadata, and `closureReady`.
- Extended compact artifact-summary telemetry with Eshkol closure execution
  handoff metadata: entry export/signature, start-section state, import/export
  counts, WASM metadata counts, and DOM-free host-import bundle metadata.
- Preserved `ulg_bundle_manifest.json.hostImports` through the supervised
  Eshkol worker artifact runtime and rendered `entry`, `imports`, and host
  factory details in the live artifact list.
- Verified `npm test`, `npm run build`, `npm run test:e2e`, and a live
  `http://100.86.83.35:5173/` artifact-cache probe after the Eshkol closure
  metadata telemetry update.
- Added `window.__ulgDemo.createPeerComputeHandoff()` to export the current ULG
  browser artifact cache as `peercompute.ulg.demo-handoff.v0`, including full
  artifact bodies, compact summaries, refs, and same-origin transferred Eshkol
  closure WASM bytes.
- Verified a live ULG-to-PeerCompute/Multiscale handoff: ULG exported four
  artifacts, transferred the 33,907-byte Eshkol `hello.wasm`, Multiscale ingested
  the MoonLab magnetar calibration and Eshkol closure bundle, executed
  `main(0, 0)` with result `0`, and kept `scenarioScientificReady: false` with
  only the expected scientific validation blockers.
- Added compact Eshkol closure output-semantics summary fields to ULG artifact
  telemetry and the browser handoff packet. The summary carries the deterministic
  `main(0, 0)` smoke-fixture expectation, stdout SHA-256/byte length, and
  `scientificValidation: false`.
- Added MoonLab magnetar dipole Ising reference/tolerance contract fields to the
  live ULG artifact, compact telemetry, and handoff packet. The summary now
  carries the MoonLab reference schema, contract hash, normalized energy units,
  ground-state reference energy, energy tolerance, observed energy delta, and
  pass status.
- Added plural `outputs.references[]` propagation for MoonLab reference/tolerance
  contracts while preserving the legacy `outputs.reference` alias. Compact
  artifact-summary telemetry now counts ready output references and the browser
  handoff packet carries the plural reference list.
- Updated the live ULG MoonLab core probe to mirror MoonLab's four-entry
  calibrated magnetosphere MHD, PIC kinetic plasma, radiation transport, and
  relativistic correction inventory in raw `outputs.references[]`. Compact
  telemetry now reports calibrated inventory counts separately while preserving
  the singular ready dipole-Ising reference as `outputs.reference`.
- Promoted the first calibrated-family entry to a scoped analytic
  `magnetosphere-mhd` dipole-field reference with solver id, field maps,
  tolerances, observed deltas, pass validation, and SHA-256 contract/unit hashes.
  PIC, radiation, relativity, and full MHD/force-free coverage remain blocked.
- Aligned the analytic reference's observed-delta keys with its tolerance keys
  and verified the live ULG-to-Multiscale VPN bridge counts it as one ready
  calibrated/scientific reference while keeping full magnetar scientific
  readiness blocked.
- Added optional MoonLab `magnetar-reference-contracts.json` service asset
  support. The service asset probe fetches and reports the optional JSON, but
  only loader/WASM assets are required for MoonLab readiness.
- Updated the supervised MoonLab core probe to load optional supplied calibrated
  reference contracts, merge only contracts that pass readiness validation, and
  treat missing Vite HTML fallback for the optional JSON as a non-blocking
  missing reference asset.
- Staged the MoonLab reduced calibrated reference-contract suite in the ignored
  manual service-asset directory and hardened the core probe loader to accept
  array, suite `references[]`, and full-artifact `outputs.references[]` JSON
  shapes.
- Verified the live ULG handoff at `http://100.86.83.35:5173/` now carries two
  artifacts: MoonLab with `outputReferenceReadyCount = 5` and
  `magnetarCalibratedReferenceReadyCount = 4`, plus Eshkol with
  `closureReady = true` and `33907` transferred WASM bytes.
- Verified the live PeerCompute magnetar page at
  `https://100.86.83.35:5185/?scenario=magnetar` accepts the ULG handoff as
  `handoff-ready` with `2/2` required handoffs ready and
  `scientific-tolerance-suite-ready`. The remaining scientific blocker is
  `proxy-runtime-not-scientific`.
- Added `npm run stage:service-assets` to refresh ignored MoonLab and Eshkol
  browser assets from sibling repos. The command copies MoonLab JS/WASM,
  generates the normalized MoonLab reference suite, and regenerates the Eshkol
  `hello` closure bundle with deterministic smoke output-semantics metadata.
- Added optional `--created-at` / `ULG_STAGE_CREATED_AT` pass-through for Eshkol
  bundle exports when byte-stable closure artifact and manifest timestamps are
  needed.
- Recorded sidecar completions: Eshkol commit `f942f31` adds reproducible ULG
  closure bundle timestamps, and PeerCompute commit `c0610ca7` hardens the
  magnetar scientific runtime evidence gate.
- Re-verified the live VPN ULG-to-PeerCompute handoff after the stricter
  PeerCompute gate: handoff and tolerance suite remain ready, runtime evidence
  remains five proxy-only entries, and scientific readiness remains correctly
  blocked by `proxy-runtime-not-scientific`.
- Updated the ULG staging command to generate MoonLab's normalized calibrated
  reference suite through MoonLab's `pnpm ulg:artifact -- --normalize-references`
  path instead of raw-copying reference JSON. The staged browser asset now has
  schema `moonlab.magnetar.normalized-reference-suite.v0`, status
  `reference-contract-suite-ready`, and four ready calibrated families.
- Replaced the staged Eshkol `hello` smoke bundle in ULG with Eshkol's
  `magnetar-closure` descriptor fixture. The ULG service manifest now targets
  `/service-assets/eshkol/closures/magnetar-closure/`, staging exports
  `magnetar-closure.wasm`, and artifact summaries expose
  `closureDescriptorReady` separately from smoke `closureOutputSemanticsReady`.
- Re-verified the live VPN ULG-to-PeerCompute handoff after normalized-suite
  staging and Eshkol magnetar descriptor staging: ULG exported MoonLab `5/5`
  ready output references and Eshkol `53066` transferred WASM bytes for the
  `magnetar-closure` descriptor fixture; PeerCompute reported `handoff-ready`,
  `scientific-tolerance-suite-ready`, descriptor probe ready, no host-runtime or
  output-semantics execution claim for the descriptor path, and only the intended
  `proxy-runtime-not-scientific` scientific blocker.
- Integrated and committed the PeerCompute descriptor-closure acceptance sidecar
  locally as commit `2f694522`. Descriptor-ready Eshkol closure fixtures now
  clear closure packaging/probe prerequisites with or without transferred WASM
  bytes, preserve those bytes in the transfer manifest, and do not clear
  scientific readiness.
- Added and committed PeerCompute reduced calibrated runtime evidence locally:
  commit `d0dbe1f5` validates the four solver-family runtime entries against
  MoonLab calibrated references, and commit `df4ea25a` derives the fifth
  cross-family conservation/coupling validation from packet telemetry.
- Verified the live VPN ULG-to-PeerCompute path now reaches reduced calibrated
  magnetar runtime readiness: ULG exports the MoonLab reference suite and
  Eshkol descriptor handoff, PeerCompute reports `runtime-evidence-ready`,
  `validatedCount = 5`, `scientific-runtime-ready`,
  `scenarioScientificReady = true`, and no blockers after
  `refreshScenarioCalibratedRuntimeEvidence()`.
- Added and committed PeerCompute durable handoff service-envelope support
  locally as commit `fbcc4f17`. `peercompute.ulg.handoff-service-envelope.v0`
  wraps the ULG demo handoff with content-addressed artifact refs, transfer
  manifest, relay-safe counts, source/provenance metadata, and blockers; the
  live VPN bridge reports envelope ready with two relay-safe/content-addressed
  artifacts and no blockers.
- Added and committed PeerCompute materialized dispatch artifact payload support
  locally as commit `697f8d8b`. Registered service-host dispatch tasks now carry
  `peercompute.ulg.handoff-dispatch-artifact-payload.v0` with normalized artifact
  bodies/summaries and transferred Eshkol WASM bytes while dispatch plans remain
  ref-based.
- Added and committed PeerCompute dispatch service adapters locally as commit
  `4d45714b`. `UlgDispatchServiceHost` and MoonLab/Eshkol manifest helpers now
  validate and cache materialized dispatch payloads through `WorkerSupervisor`
  without relying on private fixture service hosts.
- Added and committed Multiscale dispatch adapter worker execution locally as
  PeerCompute commit `c198326c`. The live `5185` API now runs ULG handoffs
  through browser MoonLab/Eshkol adapter Workers and caches nested dispatch
  acceptance artifacts.
- Added and committed PeerCompute dispatch adapter probe logic locally as commit
  `0eae0a68`. The live Eshkol adapter Worker now compiles the transferred
  `53066`-byte descriptor WASM module and records `33` imports, `1` export, and
  `main` export availability without clearing scientific validation.
- Added and committed PeerCompute descriptor-aware Eshkol dispatch probes
  locally as commit `7cae7660`. Descriptor-ready closures can now dispatch as
  metadata-only `eshkol.ulg.closure.descriptor-bind` tasks without transferred
  WASM bytes, while closure-artifact ingest still compiles complete modules and
  records descriptor contract readiness.
- Added and committed PeerCompute Eshkol host-runtime dry probes locally as
  commit `b00ac043`. The live Eshkol adapter Worker now dry-instantiates the
  `53066`-byte descriptor WASM module with inert host-import stubs, confirms the
  `main` export is available, records `30` function stubs plus memory/global/table
  stubs, and keeps `mainInvoked = false` and `scientificExecution = false`.
- Added and committed PeerCompute gated Eshkol smoke runtime execution locally as
  commit `8259ecb6`. The adapter now invokes `main` only after an explicit
  `eshkol.ulg.closure-output-semantics.v0` smoke preflight passes; the live
  magnetar descriptor handoff remains dry-only, while a browser smoke fixture
  executes `main`, returns `0`, validates output semantics, and still reports
  `scientificExecution = false`.
- Added a separate ULG browser handoff API,
  `window.__ulgDemo.createPeerComputeEshkolSmokeHandoff()`, that keeps the
  default Eshkol service on the magnetar descriptor fixture while exporting the
  staged `hello` closure bundle plus the current MoonLab artifact as a real
  `peercompute.ulg.demo-handoff.v0` smoke packet. The packet carries the
  `33,907`-byte `hello.wasm`, merged bundle manifest/DOM-free host-import
  metadata, and explicit non-scientific output semantics.
- Verified the live ULG-to-PeerCompute smoke handoff on the VPN: ULG `5173`
  exports exactly two artifacts, PeerCompute Multiscale `5185` dispatches both
  through adapter Workers, Eshkol reports
  `host-runtime-output-semantics-validated`, invokes `main`, returns `0`,
  validates stdout hash
  `sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d`,
  and keeps `scientificExecution = false`.
- Added and committed Eshkol magnetar descriptor binding metadata locally as
  commit `31cbbfc`. The staged Eshkol `magnetar-closure` artifact now carries
  `eshkol.ulg.magnetar-closure-descriptor-binding.v0`, names the durable
  PeerCompute envelope schema, binds to the MoonLab normalized reference suite
  hash `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  declares four MoonLab closure-surface samples, and keeps runtime/derivatives
  declared-not-executed/computed with `scientificValidation = false`.
- Added Eshkol reduced interpolation-table fixture evidence to the staged
  magnetar descriptor handoff. The browser-served `magnetar-closure` artifact
  now exposes `eshkol.ulg.magnetar-closure-interpolation-table.v0`,
  `status = computed-fixture`, four MoonLab-aligned sample ids, sample payload
  hash `sha256:82ca16463d7ffe1d170adb266be61c3959b22a6c352751e99f0f510738a14165`,
  and `scientificValidation = false`; ULG artifact summaries surface the same
  table status/count/hash for PeerCompute consumers.
- Added Eshkol magnetar runtime-smoke output semantics to the default staged
  descriptor artifact. The browser handoff now marks
  `closureOutputSemanticsReady = true` for `magnetar-closure`, with expected
  `main(0, 0) -> 0`, stdout hash
  `sha256:34a23605b7cacbeb83ef3391ae049c0bbcf38651b552eb9630eeca2165ca5768`,
  byte length `23`, and `scientificValidation = false`.
- Added and committed PeerCompute's first envelope-backed service host locally
  as commit `2776682d`. `UlgHandoffServiceHost` runs under
  `WorkerSupervisor`, accepts raw ULG demo handoff tasks, normalizes them to
  durable handoff envelopes, emits `peercompute.ulg.handoff-service-result.v0`,
  and stores the envelope artifact through the supervisor artifact cache.
- Added and committed PeerCompute's first envelope-backed service dispatch plan
  locally as commit `22feae0b`. Durable handoff envelopes now produce
  `peercompute.ulg.handoff-service-dispatch-plan.v0`, map MoonLab
  quantum-response refs to `moonlab.ulg.quantum-response.ingest`, map Eshkol
  closure refs to `eshkol.ulg.closure-artifact.ingest` or descriptor-bind tasks,
  and can optionally execute those dispatches through an injected service
  executor while preserving relay-safe/content-addressed/WASM-transfer metadata.
- Added and committed PeerCompute's registry-backed dispatch executor locally as
  commit `ae67d31e`. `createUlgHandoffSupervisorServiceExecutor()` submits
  dispatch tasks to registered MoonLab/Eshkol services through
  `WorkerSupervisor`, preserves nested service results in the handoff dispatch
  result, and proves fixture service hosts can execute behind the durable
  envelope boundary.
- Added and committed PeerCompute's Multiscale live dispatch-plan API locally as
  commit `fa33b97f`. `applyUlgDemoHandoffForScenario()` now returns
  `serviceDispatchPlan`, and
  `window.__multiscaleDemo.createUlgHandoffServiceDispatchPlan()` exposes the
  derived MoonLab/Eshkol service tasks for live VPN inspection.
- Hardened ULG artifact refs so `ArtifactCache` emits `sha256:` artifact URIs
  even on the non-secure HTTP VPN demo where `crypto.subtle` is unavailable.
  Live Multiscale dispatch plans now report `digestAddressed = true` for both
  MoonLab and Eshkol refs.
- Added end-to-end `ulg.magnetar.fidelity-runtime-scope.v0` propagation through
  ULG. MoonLab calibrated reference summaries and Eshkol descriptor-binding
  summaries now preserve fidelity/runtime scope metadata with
  `fullFidelityMagnetarSimulation = false` and `fullPhysicsValidation = false`.
- Hardened `npm run stage:service-assets` so ignored MoonLab/Eshkol browser
  assets fail staging when fidelity/runtime scope metadata is missing or
  overclaims full-fidelity/full-physics validation.
- Verified the strict live ULG-to-PeerCompute probe from `5173` to `5185`:
  ULG exported two scoped artifacts, PeerCompute returned
  `runtime-evidence-ready`, `validatedCount = 5`, `proxyOnlyCount = 0`,
  `missingCount = 0`, `scientificReady = true`, no blockers, tolerance-scope
  readiness for `pic-kinetic-plasma`, and explicit non-full-fidelity runtime
  scope flags.
- Recorded the next sidecar/local commits: Eshkol commit `6188573` adds
  `eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0` to the magnetar
  descriptor fixture, PeerCompute commit `d5acd481` validates and summarizes
  that contract in dispatch adapter probes, and MoonLab commit `bf5d1d1`
  documents the remaining browser WebGPU complex64 parity blocker.
- Added ULG compact artifact-summary and staging guards for Eshkol tensor
  runtime contracts. ULG reports `closureTensorRuntimeContractReady = true`
  only when the contract schema, hash, tensor ids, interpolation-table binding,
  sample-shape validation, and non-scientific/full-physics flags line up.
- Verified the live ULG-to-PeerCompute path at `http://127.0.0.1:5173/` and
  `https://127.0.0.1:5185/?scenario=magnetar`: ULG and PeerCompute both report
  the tensor runtime contract ready, PeerCompute dispatch adapters are ready,
  calibrated runtime evidence remains `runtime-evidence-ready` with
  `validatedCount = 5`, and blocker count remains `0`.
- Added a direct browser launch bridge in ULG. The `Launch Magnetar` control
  opens PeerCompute Multiscale at `/?scenario=magnetar`, sends the existing ULG
  handoff over `postMessage`, retries during popup load, and stops once the
  Multiscale page acknowledges the import.
- Verified the direct live bridge from `http://127.0.0.1:5173/` to
  `https://127.0.0.1:5185/?scenario=magnetar`: ULG status
  `handoff ready / blockers 0`, Multiscale `handoff-ready`, blocker count `0`,
  `simulationStatus = scientific-ready`, and the magnetar proxy visual visible
  on the solar layer.
- Updated `npm run stage:service-assets` to call MoonLab normalized reference
  suite generation with `--canonical`.
- Aligned the Eshkol descriptor binding to the canonical MoonLab suite bytes
  ULG serves:
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`.
- Verified staged Eshkol provenance now carries source hash
  `sha256:73f2a89ffe3434d995ffe1174185462cf0c2edb653fbe4d1286342b788763052`,
  WASM hash
  `sha256:38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`,
  and the `magnetar_closure.ulg-metadata.json` source marker path.
- Re-verified the direct live ULG-to-Multiscale bridge after canonical staging:
  ULG status `handoff ready / blockers 0`, Multiscale `handoff-ready`, blocker
  count `0`, `simulationStatus = scientific-ready`, and the magnetar proxy
  visible on the solar layer.
- Recorded the next sidecar/local commits: PeerCompute `7fc6b7a3` hardens
  descriptor-aware table binding, PeerCompute `4d90f3b6` adds handler-backed
  ULG dispatch adapters, Eshkol `ca617e6` accepts language-level
  `define-ulg-closure` metadata forms, and MoonLab `ff6727a` adds
  `moonlab.webgpu.complex64-parity-scope.v0` reduced-fixture parity evidence.
- Refreshed ignored ULG service assets after the Eshkol/MoonLab commits.
  Staged artifacts still bind to MoonLab suite
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  Eshkol source
  `sha256:73f2a89ffe3434d995ffe1174185462cf0c2edb653fbe4d1286342b788763052`,
  and Eshkol WASM
  `sha256:38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`.
- Re-verified the refreshed direct live ULG-to-Multiscale bridge after the
  sidecar commits: `npm test` passed `20/20`, `npm run test:e2e` passed `1/1`,
  and PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff` reported
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and the visible magnetar proxy on the solar layer.
- Added optional MoonLab `webgpu-complex64-parity-scope.json` service-asset
  staging. The ULG staging command now generates and validates MoonLab's
  `moonlab.webgpu.complex64-parity-scope.v0` reduced-fixture no-backend
  evidence while keeping the MoonLab loader/WASM assets as the only required
  runtime readiness assets.
- Verified the new parity-scope staging guard: `npm run stage:service-assets`
  generated parity-scope hash
  `sha256:8c10f99aaa0dc0f13c6bb3242befbe65bf8ff2d5acad610829017fb548dc83bc`,
  kept the MoonLab suite hash
  `sha256:7d4e6372e49689d2202914e210af84d19d776dc6fbc5b7e08b19cbedfb71b455`,
  kept the Eshkol WASM hash
  `sha256:38902bb4b3f5ed8abf513a4d739ff9ca99727696df271c3ff17127575785b947`,
  and preserved false full-fidelity/full-physics/WebGPU-executed claims.
- Re-verified the ULG checkpoint after parity-scope staging: `npm test` passed
  `20/20`, `npm run build` passed with the existing large-chunk warning,
  `npm run test:e2e` passed `1/1`, and PeerCompute
  `npm --prefix demos/multiscale run test:ulg-handoff` still reported
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, visible magnetar proxy, and the expected
  canonical/source/WASM hashes.
- Wired the optional MoonLab WebGPU complex64 parity-scope asset into the live
  ULG MoonLab worker artifact, compact artifact summaries, browser handoff
  packet, and artifact list UI. The artifact remains explicitly no-backend:
  `backendAvailable = false`, `webgpuParity.executed = false`,
  `webgpuParity.passed = false`, `fullFidelityMagnetarSimulation = false`, and
  `fullPhysicsValidation = false`.
- Verified the live VPN demo after parity-scope runtime wiring:
  `http://100.86.83.35:5173/` reports
  `moonlab.webgpu.complex64-parity-scope.v0` ready in the MoonLab handoff,
  shows `webgpu:no-backend` in the artifact list, and PeerCompute
  `npm --prefix demos/multiscale run test:ulg-handoff` still reports
  `handoff-ready`, blocker count `0`, `simulationStatus = scientific-ready`,
  bridge ack `handoff-ready`, and visible magnetar proxy.
- Integrated the PeerCompute parity-scope consumer sidecar locally as commit
  `c0a6d1af`. Multiscale and the handler-backed dispatch summaries now surface
  MoonLab WebGPU complex64 parity-scope evidence while preserving
  `backendAvailable = false`, `webgpuParityExecuted = false`,
  `webgpuParityPassed = false`, `fullFidelityMagnetarSimulation = false`, and
  `fullPhysicsValidation = false`, and without relaxing the scientific runtime
  gate.
- Integrated the PeerCompute relay-smoke checkpoint locally as commit
  `1e384104`. VPN coturn/backend dry-runs passed, and focused Hyperborea
  runtime P2P smoke started an isolated Go relay, connected headless browser
  peers, and exited with `Runtime P2P tests passed`.
- Integrated Eshkol's production-handler boundary sidecar commit `f06973c` into
  ULG staging, compact artifact summaries, browser handoff packets, and the
  artifact list UI. ULG now reports
  `closureProductionHandlerBoundaryDeclared = true` only when the boundary
  remains explicitly non-executable: `handlerReady = false`,
  `runtimeExecution = false`, `derivativeStatus = declared-not-computed`,
  `scientificValidation = false`, `fullPhysicsValidation = false`, and
  `fullFidelityMagnetarSimulation = false`.
- Integrated MoonLab's browser WebGPU probability-kernel probe sidecar commit
  `17765f4` into ULG staging and summaries. The staged parity-scope artifact now
  exposes `moonlab.webgpu.complex64-probability-kernel-probe.v0` for
  `compute_probabilities`, while ULG preserves
  `executed = false`, `passed = false`, empty native operation coverage, and the
  `native-webgpu-operation-coverage-not-yet-recorded` blocker.
- Verified the live VPN ULG demo at `http://100.86.83.35:5173/` after the
  boundary/probe checkpoint: two artifacts exported, Eshkol boundary declared
  with handler/runtime execution still false, MoonLab WebGPU probability-kernel
  probe declared but unexecuted, and the handoff packet preserved the same
  flags.
- Integrated the PeerCompute production-handler boundary consumer sidecar
  locally as commit `cd85fd9e`. Multiscale ingestion, dispatch-adapter probes,
  supervisor summaries, and browser UI now surface Eshkol
  `eshkol.ulg.production-handler-boundary.v0` while preserving
  `handlerReady = false`, `runtimeExecution = false`,
  `scientificValidation = false`, `fullPhysicsValidation = false`, and
  `fullFidelityMagnetarSimulation = false`.
- Re-ran PeerCompute `npm --prefix demos/multiscale run test:ulg-handoff`
  after `cd85fd9e`: ULG handoff was ready with blockers `0`, Multiscale was
  `handoff-ready`, `simulationStatus = scientific-ready`, and
  `magnetarVisible = true`.
- Improved ULG's launch-status line so Multiscale browser acks preserve the
  existing `handoff ready / blockers 0` prefix and append scenario/readiness
  evidence. The live bridge now reports
  `handoff ready / blockers 0 / scenario magnetar / scientific ready / 2 artifacts`
  while Multiscale still reports `magnetarVisible = true`.
- Added `npm run status:live` as a reusable live VPN status probe. Default mode
  reports service/artifact readiness and current MoonLab/Eshkol boundary flags;
  `npm run status:live -- --bridge` also posts the handoff to Multiscale and
  reports the browser ack.
- Integrated MoonLab's hadamard native-operation probe sidecar commit `69c5f47`
  into ULG staging, compact summaries, UI, handoffs, and live status. ULG now
  reports `moonlab.webgpu.complex64-native-operation-probe.v0` with `hadamard`
  declared, but preserves `executed = false`, `passed = false`,
  `covered = false`, and blocker `native-operation-probe-not-executed`.
- Integrated Eshkol's smoke tensor layout sidecar commit `6146520` into ULG
  staging, compact summaries, UI, handoffs, and live status. ULG now validates
  the f64 linear-memory binding at byte range `131072..131240`, reports
  `closureTensorLinearMemoryBindingReady = true`, and keeps
  `entryExportConsumesOffsets = false`, `handlerReady = false`, and
  `runtimeExecution = false`.
- Integrated PeerCompute's relay-backed ULG handoff smoke sidecar commit
  `ab88a62c`. The new PeerCompute smoke starts a dynamic relay, generates
  STUN/TURN ICE config, connects two Multiscale browser peers in a relay room,
  imports the live ULG handoff via `postMessage`, and verifies handoff,
  service-envelope, relay-safe artifact, and dispatch-plan readiness without
  relaxing runtime or scientific gates.
- Integrated MoonLab's `pauli_x` native-operation probe sidecar commit
  `dc43106` into ULG staging, compact summaries, UI, handoffs, and live status.
  ULG now reports both `hadamard` and `pauli_x` native probes as declared but
  unexecuted/uncovered in the no-adapter environment.
- Integrated Eshkol's tensor-offset ABI blocker sidecar commit `ad878d0`. ULG
  now validates and summarizes `eshkol.ulg.tensor-entry-export-offset-probe.v0`:
  `main(i32,i32)->i32` can be called with declared offsets, but stdout is
  invariant and `changedBytesInDeclaredTensorRange = 0`, so tensor closure ABI
  execution remains blocked.
- Recorded PeerCompute relay dispatch diagnostic sidecar commit `16fe9296`.
  Adapter-enabled relay handoff smoke no longer fails as an unstructured
  Playwright crash; it records `dispatchAdapterStatus =
  dispatch-adapter-popup-context-reset`, proves stages reach
  `dispatch-plan-created` and first MoonLab `dispatch-start`, and keeps
  `runtimeGateRelaxed = false` plus `scientificGateRelaxed = false`.
- Hardened ULG's MoonLab native-operation summary path for future operations.
  Artifact summaries now expose generic declared/blocked native operation lists
  and the UI/live-status script render `operationResults[]`, while compatibility
  fields for `hadamard` and `pauli_x` remain intact.
- Integrated MoonLab's `pauli_z` native-operation probe sidecar commit
  `e9bc324` into ULG staging, summaries, UI, handoffs, and live status. ULG now
  requires `hadamard`, `pauli_x`, and `pauli_z` native probes to remain
  declared but unexecuted/uncovered unless real browser WebGPU evidence exists.
- Registered and indexed Eshkol in Infinite Context Coder. ICC now has
  `eshkol`, `ulg`, `moonlab`, and `peercompute` registered; the Eshkol memory
  artifact was built with tree-sitter available at Eshkol head `ad878d0`.
- Hardened ULG MoonLab staging so every `browserNativeOperationProbe`
  `operationResults[]` entry must remain blocked/unexecuted/uncovered in the
  no-adapter environment, not only the currently required operation names.
- Refreshed the ICC ULG index and memory at local ULG commit `f620e85`, so the
  coordinator repo's latest staging and live-status code is available in
  persistent codebase memory.
- Added ULG target-operation visibility for MoonLab native WebGPU probes. The
  live status now reports target operations `hadamard`, `pauli_x`, `pauli_z`,
  and `cnot`.
- Recorded PeerCompute relay dispatch fix sidecar commit `631b202`. The
  relay-served popup dispatch adapter now reaches `dispatch-adapters-ready` with
  two accepted dispatches and no relaxed runtime/scientific gates.
- Integrated MoonLab's `cnot` native-operation probe sidecar commit `fbc2ddf`
  into ULG staging, summaries, UI, handoffs, and live status. The current live
  handoff reports no missing native-operation target declarations, while all
  four operations remain blocked/unexecuted/uncovered.
- Integrated Eshkol's tensor-offset runtime-smoke sidecar commit `a13745e` into
  ULG staging, summaries, browser e2e, and live handoff status. The staged
  magnetar closure now reports source hash
  `sha256:630b20dd243be58f8e53631e934d09298696fe7e7ea84b15e7d7b89d18809b69`,
  WASM hash
  `sha256:e0a3c7d280678a8c1e40865daeab6601dc8a6a64cfa5b29b7b6bfcaddc86c5aa`,
  byte length `169528`, tensor contract hash
  `sha256:2289b8c8068f1a033cda20f09f30a33f2e41588b8ee2ccd1143100f2fe87dd64`,
  `entryExportConsumesOffsets = true`, and
  `changedBytesInDeclaredTensorRange = 64` while keeping scientific/full
  physics validation false.
- Recorded PeerCompute sidecar commit `dc497229`, which refreshed Multiscale
  browser and relay handoff smoke expectations for the same Eshkol deterministic
  tensor-offset runtime-smoke artifact without pushing.
- Added live/demo visibility for the current Eshkol runtime-smoke evidence and
  production blockers. The artifact row now shows
  `tensor-probe:runtime-smoke-passed:offsets-consumed:64b` and
  `handler:production-handler-runtime-smoke-executed:1-blockers`;
  `npm run status:live -- --bridge`
  prints the exact blocker list, expected entry args, stdout hash, output tensor
  production flag, and production validation flags.
- Integrated Eshkol production-candidate host-import commit `8ce5ca4` into ULG
  staging, summaries, UI, and live status. ULG now requires the production
  boundary to declare `runtimeScope = production-candidate-host-imports`,
  `implementationStatus = production-candidate-runtime-imports-present`,
  production candidate status
  `production-candidate-runtime-imports-implemented`,
  `runtimeSmokeStubsAllowed = false`, f64 tensor-memory imports, `23` required
  non-stub imports, and readiness requirements for non-stub imports, validated
  tensor memory imports, and full physics validation.
- Integrated Eshkol production dispatch preflight metadata into ULG staging,
  compact summaries, browser handoffs, e2e checks, and live status. ULG now
  requires `eshkol.ulg.production-handler-dispatch-preflight.v0`, rejects
  deterministic runtime-smoke stubs for production dispatch, tracks eight
  required checks, and preserves the three production blockers while keeping
  `handlerReady`, runtime execution, and full physics validation false.
- Integrated Eshkol computed production dispatch preflight evidence into ULG
  staging, compact summaries, browser handoffs, e2e checks, and live status.
  This earlier slice reported the source artifact's `8/5/3` evidence split:
  module hash, entry signature, non-stub host imports, f64 tensor binding, and
  smoke-stub rejection passed; handler readiness, runtime execution, and
  full-physics validation remained blocked. The declared production handler
  contract slice below supersedes that count with `10/7/3`, and the
  production-candidate handler/runtime evidence slice supersedes it again with
  `10/9/1`.
- Integrated Eshkol's declared production handler contract into ULG staging,
  compact summaries, browser handoffs, e2e checks, and live status. The staged
  closure now exposes `eshkol.ulg.production-handler-contract.v0` with
  `main(i32, i32) -> i32`, linear-memory offset arguments, validated input and
  output tensor ids, eight required evidence items, and the current production
  blockers. That slice recorded production dispatch preflight `10/7/3` while
  preserving full physics validation false.
- Integrated Eshkol's production-candidate handler implementation/runtime
  execution evidence into ULG staging, compact summaries, browser handoffs, e2e
  checks, and live status. The staged closure now exposes
  `eshkol.ulg.production-handler-implementation.v0` and
  `eshkol.ulg.production-handler-runtime-execution.v0`, marks
  `handlerReady = true` and `runtimeExecution = true` for the deterministic
  tensor ABI smoke scope, and advances production dispatch preflight to
  `10/9/1` while keeping `fullPhysicsValidation = false`.
- Integrated Eshkol's
  `eshkol.ulg.full-physics-validation-requirements.v0` into ULG staging,
  compact summaries, browser handoffs, e2e checks, and live status. ULG now
  preserves the declared-not-run requirements for magnetosphere MHD, PIC kinetic
  plasma, radiation transport, relativistic correction, and cross-family
  conservation coupling evidence, including required reference/tolerance/runtime
  output/evidence hashes, while keeping `fullPhysicsValidation = false` and the
  production preflight split at `10/9/1`.
- Integrated MoonLab backend-preflight sidecar commit `4e91165` into ULG
  staging, summaries, UI, e2e coverage, and live status. The staged
  `moonlab.webgpu.complex64-parity-scope.v0` artifact now requires
  `moonlab.webgpu.complex64-browser-backend-preflight.v0` with
  `stage = navigator-gpu-unavailable`, `navigatorGpuAvailable = false`,
  `adapterAvailable = false`, and `deviceAcquired = false` in this runtime.
- Integrated MoonLab browser WebGPU parity sidecar commit `2dd3802` into ULG
  staging, the MoonLab core-probe worker, compact summaries, visible artifact
  rows, handoff artifacts, and e2e coverage. ULG now requires the staged
  `moonlab.webgpu.complex64-parity-scope.v0` artifact to report
  `scope-ready-backend-detected`, `device-acquired`, executed/passing reduced
  browser probes for `compute_probabilities`, `hadamard`, `pauli_x`, `pauli_z`,
  and `cnot`, zero blockers, and explicit no-full-fidelity/no-full-physics
  flags.
- Recorded PeerCompute tensor-runtime candidate sidecar commit `b5b0dcec` and
  reverified Multiscale browser and relay-dispatch ULG handoffs with the latest
  staged MoonLab/Eshkol artifacts. Both handoff paths reported
  `handoff-ready`, `simulationStatus = scientific-ready`, and
  `magnetarVisible = true` for the browser smoke.
- Integrated Eshkol compiler-level `define-ulg-closure` metadata support commit
  `99e8115` with ULG service-worker import glue: Eshkol closure bundle specs now
  declare `eshkol-host-imports.js`, service asset probes fetch it as JavaScript,
  the supervised Eshkol worker imports the DOM-free factory and verifies
  `createEshkolHostImportObject` plus tensor-memory binding readiness, and
  compact artifact summaries expose the factory status, production-host
  candidate requirements, runtime scope, implementation status, and required
  non-stub import count without invoking the production handler.

## Latest Validation

- PASS: `node --check src/runtime/material/opticalClosure.js`
- PASS: `node --check src/runtime/material/elementClosures.js`
- PASS: `node --check src/runtime/material/propertyProvenance.js`
- PASS: `node --test tests/opticalClosure.test.mjs tests/elementClosures.test.mjs tests/materialPropertyProvenance.test.mjs tests/sphPhaseDemo.test.mjs`
- PASS: `npm test` (`44/44`)
- PASS: `npm run build` (Vite large-chunk warning only)
- PASS: `npm run test:e2e -- -g "SPH phase demo"` (`2/2`)
- PASS: `git diff --check`
- PASS: live Vite listener confirmed on `0.0.0.0:5173`; `curl -I http://127.0.0.1:5173` returned `200 OK`.

## Not Yet Claimed

- This is a CPU-reference scalar-relativistic atomic interband closure, not yet
  a WebGPU-resident periodic band-structure/BZ integration solver.
- Optical validation remains evidence-only; no measured optical constants or
  calibrated scientific validation are claimed.

## In Progress

- Keep Vite live for inspection.
- Keep using `npm run stage:service-assets` after MoonLab/Eshkol rebuilds so the
  ignored live asset tree does not drift from sibling source outputs.
- Replace the fixture MoonLab/Eshkol service hosts with production adapters that
  plug concrete MoonLab/Eshkol runtime handlers into PeerCompute's new
  handler-backed dispatch host.
- Keep both ULG handoff paths available: magnetar descriptor for descriptor
  binding/table-fixture/runtime-smoke evidence, and `hello` smoke as the smaller
  gated runtime execution proof.
- Keep the new direct launch bridge and the manual copy/paste path in sync
  until the Multiscale receiver has formal UI-test coverage.
- Keep the MoonLab canonical body digest and ULG-served file digest distinct:
  MoonLab's pinned `canonicalJson()` hash excludes the trailing newline, while
  ULG's cross-repo handoff hash covers the served file bytes.
- Keep the relay-served dispatch adapter reset as an explicit blocker until the
  popup path reaches `dispatch-complete` without context destruction.

## Next

- Replace the reduced calibrated reference/runtime contracts with higher
  fidelity PIC, radiation, relativity, MHD/force-free, and eventually GRMHD
  validation artifacts.
- Add real peercompute service-hosting modules or adapters based on the working
  ULG demo contract.
- Update PeerCompute's receiver-side MoonLab WebGPU expectations so
  `scope-ready-backend-detected` reduced browser evidence is accepted without
  being interpreted as full MoonLab runtime or full magnetar physics readiness.
- Commit the PeerCompute receiver-side production dispatch preflight propagation
  once focused service orchestration, Multiscale, ULG handoff, and build checks
  are green.
- Wire real ULG/Eshkol/MoonLab worker services into the PeerCompute supervisor
  and then run the full peercompute relay-backed local stack.

## 2026-06-10 Update - GPU PBR Closure Slice And Renderer Fix

Completed:

- Refreshed Infinite Context Coder for ULG. ICC status is current at git head
  `5ebf3d10d64b705d4178e23ad72b08fb24de6cbf`; memory now covers 190 files and
  627 chunks.
- Updated `plan/sphphasedemo.md` and `plan/perf-upgrade.md` with the honest
  GPU-resident optical/PBR target and added nuclear/isotope closure requirements
  for radioactive decay, fission, fusion, activation, and ionizing-radiation
  transport.
- Extended `opticalRenderParams()` with cached closure-owned render records:
  `baseColorSrgb`, `renderModel`, `vertexColorPolicy`, spectral samples, and a
  PBR subrecord derived from the optical spectrum.
- Changed the SPH renderer path to pass per-particle material/phase/render-key
  descriptors instead of renderer-side phase guesses.
- Changed Three.js surface materials to use closure-derived PBR colors, disable
  vertex colors unless the optical closure explicitly permits diagnostic vertex
  color, add PMREM environment lighting, ACES tone mapping, sRGB output, and
  correct sRGB-to-linear handoff for base color, attenuation, and emissive glow.
- Fixed and regression-tested the material-selector rendering issue where mixed
  selected elements could collapse visually/structurally to one material.

Latest validation:

- PASS: `node --check src/visualization/sphPhaseScene.js`
- PASS: `node --test tests/sphPhaseRenderer.test.mjs tests/opticalClosure.test.mjs tests/sphPhaseDemo.test.mjs` (`17/17`)
- PASS: browser visual probe against `https://127.0.0.1:5173/` with
  `drop=Au&base=Na`; both `Na` and `Au` surfaces were visible with particle
  counts `125` and `27`.
- Screenshot evidence: `/tmp/ulg-au-na-sph.png`.

Not claimed:

- Full WebGPU-resident optical closure derivation is not complete yet. This
  slice builds the generalized closure/PBR record and renderer consumption path.
- Full periodic band/BZ optical response, general molecular excited-state
  optical response, and nuclear fission/fusion/decay solvers remain planned
  closure families, not completed runtime kernels.
