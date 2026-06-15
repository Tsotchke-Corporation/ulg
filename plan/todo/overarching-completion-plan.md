# Overarching Remaining Todo Completion Plan

Date: 2026-06-12 AKDT

## Purpose

Unify the remaining active todo files and unchecked top-level plan items into
one implementation order. The goal is to finish the core technology path without
material-specific patches, while keeping the demo usable, measurable, and honest
about validation.

2026-06-12 realignment: the active ordering now starts with authority and state
ownership. The physics-law todo files stay active; this reorganizes where the
laws run, who owns state mutation, and how WebGPU/CPU/WASM workers are managed.

Active inputs examined:

- `plan/todo/README.md`
- `plan/todo/peercompute-law-graph-authority-plan.md`
- `plan/todo/resident-state-authority-contract-plan.md`
- `plan/todo/gpu-resident-lanes-and-warm-services-plan.md`
- `plan/todo/physics-loop-authority-diagrams.md`
- `plan/todo/cold-start-cache-performance-plan.md`
- `plan/todo/reaction-stoichiometry-energetics-plan.md`
- `plan/todo/sedenion-reaction-scoping-plan.md`
- `plan/todo/phase-resolved-steam-optics-plan.md`
- `plan/todo/webgpu-material-property-resolvers-plan.md`
- `plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md`
- `plan/todo/perf-upgrade.md`
- `plan/todo/sphphasedemo.md`
- `plan/todo/frontier-todo.md`
- unchecked ULG, PeerCompute, Eshkol, MoonLab, and tooling items in
  `plan/plan.md`

## Active Priority Order

Use this order unless the user redirects:

1. Establish PeerCompute law graph authority and the ULG resident state
   authority contract.
2. Fix resident-loop ownership bugs: no-op law overwrites, render/physics
   coupling, buffer lifetime, and stale CPU mirrors.
3. Finish reaction/product/gas pressure coupling through the general balanced
   closure path, with sedenion/Fano reaction scope used only as a symbolic
   prefilter for expensive lower-level derivation.
4. Finish steam/water/phase/optics and the iron-on-ice controls.
5. Move the hot loop to ComputeManager-compatible GPU resident lanes with
   resident particle/grid/gas/product/phase/surface buffers and declared copy
   budgets.
6. Move material and closure resolvers into CPU/WASM/WebGPU workers with
   content-addressed provenance and strict validation flags.
7. Add frontier laws as law graph nodes: radiation, nuclear, Cherenkov,
   gravity, MHD/PIC, quantum response, relativistic, and astrophysical paths.
8. Integrate PeerCompute, Eshkol, and MoonLab service hosts under the same law
   graph, worker lease, warm-residency, artifact cache, and admission model.
9. Polish cold-start persistence and timing after schemas stabilize.
10. Run final validation, profiling, overclaim checks, and packaging.
11. Stand up the full local distributed PeerCompute network stack after the
    above contracts stabilize: WSS relay plus STUN/TURN/ICE configuration for
    multi-window and multi-computer acceptance testing.

See `plan/todo/README.md` for the routing index and cache/scale rules.

## Ordering Rules

1. Keep physics laws first-class. The reorg changes authority and scheduling;
   it does not prune laws.
2. Keep PeerCompute as the orchestration authority. ULG should not grow a
   parallel distributed scheduler.
3. After every resident stage, exactly one producer is authoritative for each
   mutable state family.
4. Physics cadence must not depend on render cadence.
5. Law workers should be ComputeManager-compatible CPU/WASM/WebGPU tasks with
   declared read/write families, leases, validation gates, and compact deltas.
6. Hot GPU mutation chains should stay on ComputeManager-owned resident lanes
   until explicit domain partitioning exists.
7. Keep heavy Eshkol/MoonLab services warm when latency matters, but treat warm
   state as cache/readiness state rather than authority.
8. Keep cache schemas, provenance, invalidation, worker boundaries, and visible
   CPU/WebGPU warnings correct, but defer cold/warm timing polish until core
   physics schemas stop moving.
9. Make schemas, cache keys, validity domains, and provenance stable before
   persisting artifacts.
10. Move runtime hot-loop work to WebGPU before moving full electronic-structure
   solvers to WebGPU.
11. Incorporate WebGPU-Ocean lessons in the hot-loop phase: fixed-point atomic
   scatter where needed, GPU-side grid/neighbor structures, and fluid surface
   rendering, including a WebGPU marching-cubes path.
12. Treat every cached value as derived evidence with invalidation, never as a
    hand-authored material constant.

## Phase 0 - Baseline And Plan Hygiene

Purpose: start from a reproducible local state before touching more runtime
code.

Work:

- Keep all commits local; do not push.
- Keep the HTTPS Vite demo available on `0.0.0.0:5173` for VPN inspection.
- Record current dirty-tree intent and avoid reverting unrelated existing
  changes.
- Run a baseline smoke set before implementation slices:
  - `git diff --check`;
  - focused SPH renderer/reaction/thermal tests;
  - focused HTTPS Playwright SPH demo smoke when the server is running.
- Add a short status banner or doc note when any major todo is blocked by a
  sibling repo.

Completion gate:

- Current active todos are represented in this plan and top-level trackers.
- Baseline tests are known before code work resumes.

## Phase 1 - Cache Correctness And UI Control

Current status on 2026-06-11 17:02 AKDT:

- The first two cold-start slices are implemented and validated. Material
  closures, reaction discovery, product reuse, balanced reaction records,
  static table records, and GPU warmup signatures are persisted with generator
  guards.
- Static table/GPU-warmup cache serialization now runs through a supervised
  `ulg-runtime` `sph.static-table-cache` worker task and uses a separate
  localStorage family so reaction cold-cache lookup avoids parsing large table
  payloads.
- Remaining Phase 1 blockers: consume rehydrated table records in the scene and
  WebGPU upload paths, move material/reaction cache parsing farther out of the
  UI thread, add stale-record browser probes, and record cold/warm/clear-cache
  timing deltas.

Updated status on 2026-06-11 17:19 AKDT:

- Scene table consumption is partially implemented. Warm `setParticles()` can
  consume rehydrated static cache bundles for thermal, graph, phase-response,
  optical/PBR, and reaction tables and the browser test verifies a warm
  `static-table-cache-bundle-hit`.
- Remaining Phase 1 blockers narrow to worker-preloaded static bundle
  rehydration, material/reaction cache parsing off the UI thread, stale-record
  browser probes, and measured cold/warm/clear-cache deltas.

Primary plans:

- `plan/todo/cold-start-cache-performance-plan.md`
- `plan/todo/perf-upgrade.md` cache/warning sections

Why limited now:

- `plan/done/reprioritize-cold-start-work-2026-06-11.md` moved cold-start
  timing polish toward the end; cache correctness remains active.
- Reaction, product, thermal, optical, and static-table caches still need
  correct schemas, provenance, invalidation, and worker boundaries because later
  reaction, steam, and material-resolver work will reuse them.
- Timing polish, stale-record browser probes, and GPU warmup persistence should
  wait until reaction, pressure, steam, hot-loop, and material resolver schemas
  are stable.

Work:

- Keep the cache coordinator, localStorage keys, generator fingerprints,
  product/reaction records, static table rows, and clear-cache UI correct.
- Keep material/reaction closure cache keys independent of particle count.
- Treat particle-count-driven static table changes as explicit physics-table
  invalidation only when they alter derived inputs such as reaction contact
  radius.
- Keep CPU closure warnings and worker/off-main-thread boundaries visible.
- Defer stale-record browser timing probes and GPU warmup persistence polish.

Completion gate:

- First-slice status on 2026-06-11: material-property-backed
  `discoverReactions()` now memoizes by provenance hash, persisted
  reaction/product cold-start records are written/reused, worker-first SPH
  startup exposes cache/timing diagnostics, low-FPS CPU derivation emits a
  warning banner without auto-pausing playback, and cached interactive Step/Play
  remains available.
- Second-slice status on 2026-06-11 16:34 AKDT: partial material cache hits are
  consumed, missing runtime materials are individually derived, deterministic
  thermal/optical/reaction table rows and GPU warmup signatures are written to
  the cold-start cache, `ulg-runtime` is pre-spawned, and resident/worker/scene
  timing spans are visible in the overlay.
- Updated status on 2026-06-11 22:30 AKDT: worker static-table coverage now
  ignores particle count alone but rejects stale reaction-table bundles when
  the derived contact radius changes.
- Deferred gate: warm/cold timing deltas, stale-record browser probes, and GPU
  warmup persistence are postponed until after reaction, pressure, steam,
  hot-loop, and WebGPU material resolver contracts stabilize.

## Phase 2 - Balanced Reaction Closure Contract

Primary plans:

- `plan/todo/reaction-stoichiometry-energetics-plan.md`
- `plan/todo/cold-start-cache-performance-plan.md`
- reaction sections of `plan/todo/webgpu-material-property-resolvers-plan.md`

Why second:

- Chemistry is currently the most visible correctness gap.
- Gas byproducts and pressure cannot be honest until the runtime consumes full
  stoichiometry instead of one product key.

Work:

- Add `peercompute.ulg.reaction-closure.v0` or equivalent balanced reaction ABI:
  headers, reactant terms, product terms, gas routing, heat/free-energy, status,
  and validity rows.
- Preserve `candidate.reactants[]` and `candidate.products[]` through
  `discoverReactions()` and the SPH adapter.
- Add strict-mode rejection for
  `provisional-heuristic-not-scientifically-validated` executable reactions.
- Add staged energetics status:
  - valid lower-level free-energy result;
  - needs refined thermochemistry;
  - blocked/no-derived-reaction.
- Add CPU reference stoichiometric extent, product inventory, energy ledger, and
  gas byproduct ledger.
- Cache reaction closures with product closure hashes and strict/exploratory
  status.

Completion gate:

- Na/Li/Cs + H2O all follow one general path and produce hydroxide plus H2.
- Na + Cl2, Mg + Cl2, and Al + O2 balance coefficients and conserve atoms.
- Strict runtime never executes provisional energetics as if validated.
- CPU reference conserves atoms, mass, charge, and energy within declared
  tolerances.

Current partial status on 2026-06-11 21:08 AKDT: CPU reference Na + H2O now
preserves balanced product terms and produces NaOH plus H2, with H2 partial
pressure reported in the sealed gas diagnostic. The resident reaction table and
WGSL fixed-buffer path now consume packed reactant/product term rows, compute
limiting extent, preserve excess reactant mass, and emit product slots from the
balanced closure rows. CPU resident output records visible and unplaced
product/gas inventory in a reaction ledger. Remaining: GPU-visible gas/product
ledger buffers, compact pressure summaries without full readback, stricter
charge/atom ledger parity in the resident path, and dynamic or
inventory-backed product append.

Updated partial status on 2026-06-11 21:40 AKDT: the first resident GPU
gas/product ledger slice is now implemented as a compact no-full-readback
summary. It reports canonical reaction events, consumed mass, visible/unplaced
product inventory, gas mass/moles, reaction heat, and residuals, and the demo
can compute sealed-box pressure from that resident summary for a single gas
species without scanning stale CPU particles. Remaining reaction/gas work is
per-species multi-gas resident ledger buffers, dynamic append or inventory-backed
product storage, stricter atom/charge parity, and pressure feedback into
forces/walls.

Updated partial status on 2026-06-11 21:55 AKDT: per-species multi-gas resident
ledger rows are now implemented as a separate compact WebGPU pass. Resident
pressure now consumes material-keyed gas species mass/moles from those rows
before falling back to aggregate summaries. Remaining reaction/gas work is
dynamic append or inventory-backed product storage, stricter atom/charge parity,
and pressure feedback into forces/walls.

Updated partial status on 2026-06-11 22:56 AKDT: compact product-inventory,
atom/charge residual, strict reaction gate, pressure wall-load feedback, and
GPU-resident sparse product-event staging are implemented. Product events are
stored in a separate particle-major WebGPU buffer that can remain resident
without sparse readback and is lifetime-managed with the resident step. The
remaining Phase 2 gap is to make renderer/EOS/field kernels consume staged
product events as real spawned product volume rather than only as diagnostics.

Updated partial status on 2026-06-11 23:12 AKDT: renderer consumption is now
partially complete. The render-field kernel binds the retained product-event
buffer, splats only positive unplaced product mass, and the scene creates
generic product-inventory surface descriptors for event-only products. Remaining
Phase 2 gaps are EOS/pressure/field-kernel consumption of product-event mass
and validated pressure force coupling.

Updated partial status on 2026-06-11 23:27 AKDT: pressure diagnostics now
consume resident product mass through a prioritized compact path:
per-species gas ledger, product-event verification rows, then compact
product-inventory rows. This avoids full particle readback and keeps routing
generic. Remaining Phase 2 gaps are dynamic EOS/gas-cell/field-force
consumption of resident product mass and validated pressure force coupling.

Updated partial status on 2026-06-11 23:28 AKDT: an explicit
`peercompute.ulg.sph-resident-product-mass.v0` handle now carries retained
product-event buffers, row stride/counts, unplaced mass, gas mass, consumption
policy, EOS/force blocked status, and guarded destruction through reaction and
resident MLS-MPM outputs. Remaining Phase 2 gaps are actual kernel consumption
of that handle and validated pressure force coupling.

Updated partial status on 2026-06-11 23:43 AKDT: the resident product-mass
handle is now carried into the next resident step's P2G stage and consumed as
generic unplaced product-event mass by the CPU P2G reference and WebGPU P2G
binding contract. Cleanup preserves borrowed product-event buffers through the
borrowing step. Remaining Phase 2 gaps narrow to product mechanics/EOS fields,
gas-cell/pressure-gradient force coupling, and GPU append/compaction for
multiple generations of unplaced product events.

Updated partial status on 2026-06-11 23:54 AKDT: product mechanics/EOS fields
are now included in the product-event ABI and populated from closure-derived
product phase records. P2G consumes unplaced product velocity and local EOS
pressure when the event carries support volume and EOS metadata. Remaining
Phase 2 gaps narrow again to validated gas-cell/pressure-gradient force
coupling and GPU append/compaction for multi-generation unplaced product-event
buffers.

## Phase 3 - Sealed Gas, Pressure, And Steam Microphysics

Primary plans:

- `plan/todo/reaction-stoichiometry-energetics-plan.md`
- `plan/todo/phase-resolved-steam-optics-plan.md`
- `plan/todo/sphphasedemo.md`

Why third:

- Gas inventory and pressure are shared by reaction byproducts, water vapor,
  condensation, wall coupling, and the ice/iron demo.

Work:

- Add sealed-box gas species inventory for air, H2O vapor, H2, and later
  radioactive/nuclear gases.
- Compute total and partial pressure from moles, volume, temperature, and gas
  EOS/mixture closure.
- Feed pressure summaries into runtime diagnostics and, once stable, carrier
  forces/wall ledgers.
- Add H2O saturation/condensation/droplet summary from temperature, pressure,
  vapor mass, air mixture, and available condensed nuclei.
- Add phase/state/microstructure optical cache keys.
- Add visible steam scattering only when condensed droplets are derived; pure
  vapor remains nearly invisible.

Completion gate:

- Na/H2O gas byproduct increases H2 partial pressure through EOS, not a script.
- H2O liquid, ice, pure vapor, and condensed steam have distinct optical cache
  keys and diagnostics.
- Steam visibility tracks derived droplet mass/effective radius and path length.

## Phase 4 - Ice-On-Molten-Iron Scenario Preflight And Controls

Primary plans:

- `plan/todo/sphphasedemo.md`
- `plan/todo/frontier-todo.md` demo section

Why fourth:

- The macroscopic demo cannot honestly claim the expected final state until the
  energy budget, wall model, and particle resolution are explicit.

Work:

- Add `peercompute.ulg.thermodynamic-preflight.v0`.
- Add exact scenario config for a 10 m sealed box, 1 m H2O cube, 1 m Fe cube,
  air at 1 atm, and -40 F / 233.15 K initial ambient/walls.
- Add six wall-temperature sliders and persist Kelvin values.
- Add particle count controls for H2O, Fe, gas/cells, and total budget.
- Compute represented molecules/atoms per macro-particle.
- Add preflight enthalpy ledger:
  - Fe cooling/freezing;
  - H2O warming/melting/vaporizing;
  - gas heating;
  - six side heat export/import.
- Make insufficient-wall-cooling scenarios fail preflight rather than forcing a
  cold gray iron plus ice outcome.

Completion gate:

- The demo reports whether the requested final state is thermodynamically
  plausible under the selected wall temperatures.
- Particle count changes resolution/convergence diagnostics only, not material
  laws.
- Six wall heat ledgers are independently reported.

## Phase 5 - GPU-Resident Runtime Hot Loop

Primary plans:

- `plan/todo/perf-upgrade.md`
- `plan/todo/sphphasedemo.md`
- thermal/mechanics sections of
  `plan/todo/webgpu-material-property-resolvers-plan.md`

Why fifth:

- After CPU reference contracts are stable, performance depends on removing full
  readbacks and CPU hot-loop translation.
- This is where the WebGPU-Ocean lessons belong. They should not preempt the
  current reaction inventory/residual/pressure/steam contracts, but they should
  land before cold-start timing polish and before large WebGPU material solver
  migration.

Status on 2026-06-12 AKDT:

- PeerCompute now exposes a passive `GpuResidentLaneManager`, and ULG resident
  MLS-MPM/SPH steps can acquire/complete/reject compatible lane leases locally
  with copy budgets, retained-buffer refs, and queue-fence evidence.
  PeerCompute `ComputeManager` can also wrap declared inline GPU-lane tasks in
  those leases before local commit and block unsatisfied required fences. The
  remaining hot-loop architecture work is a real ComputeManager/GPUHub
  resident-lane task for the full pass DAG.

Work:

- Add compact GPU summary buffers for mass, momentum, energy, pressure, phase
  masses, active nodes, speed, displacement, and conservation residuals.
- Make no-full-readback the default resident mechanics mode once summaries
  exist.
- Promote repeated retained G2P output to visual/mechanical authority after
  repeated-step conservation checks.
- Persist and reuse uploaded thermal graph/phase-response buffers across
  resident steps.
- Ensure reaction product phase reset consumes the same thermal response table.
- Move wall heat ledgers, gas pressure, reaction execution, phase update, and
  render-field generation onto resident buffers.
- Replace the current O(grid nodes * particles) gather-heavy P2G path with a
  WebGPU scatter/tiled strategy. Evaluate fixed-point integer `atomicAdd`
  accumulation for browser-portable P2G mass/momentum/stress rows, following
  the WebGPU-Ocean/MLS-MPM pattern.
- Build GPU-side cell/grid/neighbor structures for any remaining SPH-style
  local interactions instead of CPU pair loops.
- Add WebGPU marching cubes for continuous material surfaces so field
  generation, prefix/compaction, triangle emission, normals, and draw buffers
  can stay GPU resident. Keep screen-space fluid rendering as a candidate for
  transparent fluids, but use marching cubes for material volumes that need
  stable PBR surfaces and depth sorting.
- Keep CPU parity/reference tests focused and opt-in rather than per-frame.

Completion gate:

- Normal stepping avoids full particle/grid readback.
- Physics FPS and render FPS are decoupled and visible.
- Compact summaries provide enough diagnostics to trust resident WebGPU state.
- Device-loss fallback is clear and does not claim GPU readiness.
- WebGPU marching cubes produces continuous SPH/MLS-MPM material surfaces
  without CPU mesh extraction.

## Phase 5B - Deferred Cold-Start Performance Polish

Primary plans:

- `plan/todo/cold-start-cache-performance-plan.md`
- `plan/todo/perf-upgrade.md` cache sections

Why after hot-loop work:

- Reaction, pressure, steam, hot-loop, and material resolver work keep changing
  ABI rows and cache key ingredients. Optimizing timing before those stabilize
  creates churn without moving the core physics forward.

Work:

- Measure cold/warm/clear deltas after schemas stabilize.
- Add stale-record browser probes.
- Persist and reuse any valid GPU warmup/upload artifacts that WebGPU allows.
- Keep clear-cache behavior scoped to ULG SPH cache families.

## Phase 6 - WebGPU Material Resolver Migration

Primary plans:

- `plan/todo/webgpu-material-property-resolvers-plan.md`
- `plan/todo/perf-upgrade.md`
- `plan/todo/frontier-todo.md`

Why sixth:

- Full lower-level derivation on WebGPU is large. The runtime should first
  consume GPU-resident closure tables correctly, then progressively move the
  expensive derivation kernels.

Work order:

1. Add resolver manifest and diagnostics:
   - resolver family;
   - CPU entrypoint;
   - GPU target schema;
   - cache key fields;
   - status: `webgpu-derived`, `webgpu-consumed`, `worker-cpu-derived`,
     `main-thread-cpu-derived`, or `cache-hit`.
2. Port existing numeric table consumers first:
   - optical Drude-Lorentz/CIE/opacity;
   - EOS/material table sampling;
   - thermal graph/phase-response construction or worker precompute with
     resident GPU consumption.
3. Compile validated closure graphs into flat GPU node/program rows.
4. Port atomic electronic-structure kernels:
   - radial Kohn-Sham/KH/LSDA grids;
   - tridiagonal eigensolvers;
   - Hartree/XC reductions;
   - SCF residual summaries.
5. Port molecular/compound kernels:
   - batched small-molecule HF/UHF/all-element solver;
   - geometry optimization;
   - vibrational/thermochemical reductions.
6. Keep PeerCompute CPU/WASM/native workers as the nonblocking fallback until
   each WebGPU solver has parity and performance evidence.

Completion gate:

- Relativistic/interband optical derivation is WebGPU-derived, not only
  WebGPU-consumed.
- Element/compound material properties can be generated through one manifest and
  cache/provenance interface.
- Hidden main-thread material derivation during the demo is treated as a bug.

## Phase 7 - Scientific Fidelity Frontier

Primary plans:

- `plan/todo/frontier-todo.md`
- high-fidelity sections of `plan/todo/sphphasedemo.md`
- solver sections of `plan/todo/webgpu-material-property-resolvers-plan.md`

Why seventh:

- These upgrades improve quantitative accuracy, but they should land after the
  cache, reaction, gas, and GPU runtime contracts are stable.

Work:

- Atomic DFT:
  - add GGA/PBE;
  - add LDA+U or equivalent treatment for transition-metal bulk behavior;
  - track spin-orbit/full-Dirac gap separately from current scalar
    relativistic KH.
- Molecular solvers:
  - extend basis beyond STO-3G and currently parameterized elements;
  - add UMP2 for open-shell/correlation-consistent atomization;
  - add analytic gradients;
  - add NEB/dimer transition-state search;
  - add CASSCF/spin-projected handling for bond breaking where needed.
- Bulk closures:
  - add periodic DFT / k-point / QHA path for quantitative element and solid
    closures;
  - improve molecular material thermochemistry from vibrations and finite-T
    free energies.
- Demo numerics:
  - unify mechanics and thermal clocks;
  - replace O(N^2) CPU pair loops with neighbor/cell lists where CPU reference
    remains;
  - upgrade gas Cp(T) from molecular thermochemistry;
  - improve stiff EOS beyond current weakly-compressible interactive mode.

Completion gate:

- Quantitative closure improvements produce new provenance and validation
  artifacts instead of silently changing material behavior.
- Old cache records invalidate when solver fidelity changes.

## Phase 8 - Nuclear, Radiation, And Cherenkov

Primary plans:

- nuclear/radiation sections of `plan/todo/sphphasedemo.md`
- `plan/todo/perf-upgrade.md`
- `plan/todo/webgpu-material-property-resolvers-plan.md`

Why eighth:

- Nuclear/radiation shares thermal, gas, optical, and cache infrastructure, but
  it should not block chemistry/phase-change correctness.

Work:

- Define isotope inventory and nuclear channel buffer ABI.
- Add decay/fission/fusion/radiation closure records with explicit validation
  blockers.
- Add energy deposition and daughter-product ledgers.
- Couple deposited energy into thermal, gas, chemistry, and optical buffers.
- Add Cherenkov source rows derived from particle speed, medium IOR, and
  spectral response.

Completion gate:

- Radioactive materials expose explicit isotope/radiation closure state.
- Cherenkov appears only when the derived particle/medium conditions permit it.
- All nuclear outputs remain blocked/unvalidated until benchmark evidence
  exists.

## Phase 9 - Cross-Repo Integration

Primary top-level todos:

- PeerCompute:
  - start from `ComputeManager`, `NodeKernel`, `SolverRegistry`, relay tooling,
    NetViz telemetry, and Multiscale ULG schemas;
  - replace demo-local scheduling/GPU/artifact substitutes with explicit
    service lifecycle, child-worker leases, GPU leases, cancellation trees,
    content-addressed artifacts, and provenance indexes;
  - extend Eshkol descriptor probing to controlled magnetar closure execution
    once the runtime contract is ready;
  - accept MoonLab's reduced WebGPU parity-scope evidence without overclaiming.
- Eshkol:
  - start from `eshkol-run --wasm`, `llvm_backend.h`, `llvm_codegen.cpp`, GPU
    memory/VM dispatch APIs, and web/GPU scripts;
  - keep JIT service paths disabled until the derivative/JIT hang is profiled.
- MoonLab:
  - add/finish browser WebGPU complex64 parity kernels where the current
    receiver still needs them;
  - preserve reduced-scope evidence boundaries.
- Tooling:
  - use swarm lightly for status/context only after a ULG-specific profile
    exists.

Ordering:

1. Stabilize ULG ABI/cache/reaction/gas contracts locally.
2. Update PeerCompute receiver/orchestration for those contracts.
3. Stage Eshkol/MoonLab artifacts that match the stable contract.
4. Run relay/browser smokes and keep full-physics claims blocked unless the
   evidence contract is actually satisfied.

Completion gate:

- ULG, PeerCompute, Eshkol, and MoonLab agree on artifact schemas, validation
  boundaries, and handoff status.
- No service owns networking/GPU scheduling outside PeerCompute leases.

## Phase 10 - Final Demo, Profiling, And Done Criteria

Purpose: turn the architecture into a demonstrable, measurable system.

Work:

- Run the ice-on-molten-iron scenario at multiple particle counts.
- Run Na/H2O, Li/H2O, Cs/H2O, and non-water reaction fixtures.
- Run vapor/steam optical fixtures.
- Run cold/warm/clear-cache startup probes.
- Profile CPU main thread, worker time, WebGPU dispatch time, readback time,
  memory pressure, and render frame time.
- Optimize only after correctness and provenance gates are passing.
- Build GitHub Pages/docs artifacts after stable demo slices.
- Move completed todo docs to `plan/done/` only when their acceptance tests pass.

Completion gate:

- The demo can explain what it is deriving, what is cached, what is GPU
  resident, what remains CPU/worker, and what is scientifically unvalidated.
- The renderer does not fake material identity, phase, pressure, glow, steam, or
  nuclear effects.
- Performance bottlenecks are measured with profiler evidence before each major
  optimization.

## Phase 11 - Full Distributed PeerCompute Stack

Purpose: prove the runtime across real browser peers after the single-node
authority and worker-stage contracts are stable.

Work:

- Follow `plan/todo/distributed-peercompute-network-stack-plan.md`.
- Stand up this machine as the local WSS/STUN/TURN/ICE test environment.
- Connect three browser windows across two computers with explicit requester,
  responder, and observer roles.
- Prove distributed graph placement, StateManager sync, cache admission,
  remote state-seed hot-buffer refresh, and GPU-fence gated mutation.

Completion gate:

- Representative ULG visual scenarios pass with distributed execution enabled.
- No remote result can mutate authoritative state without NodeKernel/
  StateManager admission and matching GPU fence/lease evidence.

## Immediate Next Work Item

Continue Phase 2 before moving to Phase 3/5:

Status note, 2026-06-12: carried and newly emitted resident product-event
buffers now merge into a cumulative GPU-resident handle and carry forward
through `nextParticleUploads`. The handle also carries compact gas-species
ledger state and sealed-box pressure now prefers the merged resident ledger.
Pressure feedback exposes a one-cell uniform sealed-gas pressure field with
zero gradient and explicit force-coupling prerequisites. The first
phase-resolved H2O vapor optics slice is also complete: sealed-box H2O vapor
now gets a bucketed thermodynamic optical state, pure vapor remains optically
thin, supersaturated vapor derives droplet scattering, and optical GPU lookup
rows expose depth/scatter/absorption/state diagnostics. The remaining work is
local interface-element pressure force coupling plus moving vapor microphysics
and surface extraction fully GPU-resident. A first aggregate
`peercompute.ulg.sph-material-interface-field.v0` and
`peercompute.ulg.sph-pressure-interface-coupling.v0` checkpoint now reports
surface area/normal/centroid metadata and marks coupling ready for a solver,
and `peercompute.ulg.sph-pressure-interface-force-preview.v0` now emits
non-applied pressure traction diagnostics from local interface elements. At this
checkpoint force application was still blocked until a real conservative
pressure-force solver existed and passed parity/conservation tests.

Status note, 2026-06-12 10:45 AKDT: the first conservative pressure-interface
force solver and MLS-MPM grid consumer are now wired through the live resident
path. The scene uploads retained
`peercompute.ulg.sph-pressure-interface-force-rows-upload.v0` storage buffers
keyed by the solver signature and feeds them into grid update. Resident product
mass also reports the existing P2G/EOS sidecar status accurately. This does not
complete gas-cell/local pressure-gradient physics; it only moves the current
uniform sealed-gas interface force rows into the resident grid impulse path.

1. Extend pressure coupling from uniform interface force rows to resident
   gas-cell/local pressure-gradient fields, with conservation and convergence
   tests before treating it as validated dynamics.
2. Bind `peercompute.ulg.sph-resident-product-mass.v0` beyond P2G into
   gas-cell, phase, and field kernels so rendered spawned products also affect
   thermodynamics and forces.
3. Move phase-resolved steam/gas microphysics from the sealed-box descriptor
   bridge into resident per-cell/per-particle state and gate vapor surfaces
   from derived optical depth/scattering rather than render labels.
4. Start the WebGPU-Ocean hot-loop slice before cold-start timing polish:
   follow `plan/todo/webgpu-ocean-mlsmpm-simulator-plan.md` for fixed-point or
   tiled P2G scatter where useful, GPU cell/neighbor structures, resident
   gas/product/phase dynamics, and GPU-resident continuous surfaces.
5. Return to cold/warm/clear timing probes and GPU warmup persistence after
   reaction, pressure, steam, and hot-loop schemas stabilize.
