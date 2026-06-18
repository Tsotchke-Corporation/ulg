# Implementation Status

Updated: 2026-06-17 ComputeManager GPU resident stage-placement preflight, GPU resident state-family conflict batching, worker-retained continuation planner, GPU resident stage dependency batches, worker-retained access contract metadata, resident render-field surface unclipping, transmissive H2O depth policy, resident MLS-MPM floor boundary free-surface fix, CPU-SPH free-surface remediation, free-surface shape gate, surface component visual metrics, render depth-order visual matrix gate, plain-SPH liquid settling, CPU liquid render-domain merge, plain-SPH no-force law isolation, product-event spatial ledger source preservation, mounted no-snapshot gas-cell import guard, mounted gas-cell EOS producer hot-loop opt-in, gas-cell EOS producer stage-chain pressure import wiring, resident gas-cell EOS producer stage, retained pressure/interface gas-cell source descriptor consumption, retained pressure/interface gas-cell field source descriptor, spatial gas-cell source provenance, gas-cell field admission publisher, spatial gas-cell EOS producer contract, pressure gas-cell retained-ref classification, scene gas-cell import host wiring, StateManager gas-cell field import publisher, admitted gas-cell field import descriptor, local gas-cell field consumption admission gate, retained local-gas-cell pressure publication gate, local gas-cell pressure field contract, pressure/local-gradient contract metadata, pressure/interface WebGPU-retained publication gate, scene pressure-row upload admission gate, transparent renderer depth-order pass, pressure/interface retained-buffer admission evidence, pressure/interface WebGPU force-row producer, pressure/interface same-frame grid admission, pressure/interface grid consumption admission gate, pressure/interface Worker publication admission, pressure/interface Worker stage DAG boundary, reaction/product Worker publication admission, reaction/product Worker stage DAG boundary, thermal/phase Worker publication admission, formal GPUHub thermal/phase stage DAG, browser Worker thermal/phase stage, worker-retained thermo input, worker-retained mechanics continuation input, admitted worker-retained mechanics publication path, worker WebGPU no-full retained-ref publication candidate, worker WebGPU mechanics stage-chain browser gate, mechanics resident-stage Worker module, GPUHub worker-ready runner seam, GPUHub worker policy evidence, GPUHub resident stage executor mechanics chain, browser same-lane WebGPU mechanics stage-chain validation, same-lane WebGPU-requested mechanics stage tasks, lane-executed ULG mechanics stage tasks, ULG mechanics stage-chain lane-plan evidence, PeerCompute lane stage-plan executor, resident sequence lane contract, mounted active-grid scene opt-in, active-grid resident mechanics slice, resident summary fence attribution, opt-in fused mechanics evidence, live same-device source auto-publication, CPU-SPH solid H2O gate, law-isolation visual matrix, direct-resident liquid settle gate, and live-device focus-change renderer follow-up

Latest checkpoint, 2026-06-17 AKDT: ULG mechanics stage placement preflight
now routes through NodeKernel when a real NodeKernel is supplied. The mechanics
stage-chain telemetry records `node-kernel-preflight` plus
`peercompute.nodekernel.gpu-resident-stage-placement-preflight.v0`, while
preserving the raw ComputeManager preflight batches and Worker policy evidence
inside the NodeKernel envelope. Direct/injected ComputeManager paths still use
`compute-manager-preflight`. Validation: ULG PeerCompute integration passed
`16/16`, physics atomics passed `11` with `3` expected opt-in skips, and visual
matrix `codex-nodekernel-stage-placement-preflight-20260617` passed `3/3` with
empty issue counts.

Previous checkpoint, 2026-06-17 AKDT: sibling PeerCompute now exposes
`NodeKernel.preflightGpuResidentLaneStagePlacement()` as the authority wrapper
around GPU resident stage placement preflight. Local and advisory distributed
resident stage placement can continue to local ComputeManager preflight with
NodeKernel metadata, while non-advisory distributed resident placement fails
closed until a remote resident-stage executor exists.

Previous checkpoint, 2026-06-17 AKDT: ComputeManager now exposes an advisory
GPU resident stage-placement preflight before executing a lane stage plan.
Sibling PeerCompute emits
`peercompute.compute.gpu-resident-lane-stage-placement-preflight.v0` from the
same dependency and state-family conflict planner used by actual execution.
ULG calls `preflightGpuResidentLaneStagePlacement()` before the mechanics
stage chain runs and records placement batches, max concurrent stage count,
conflict policy/deferrals, GPUHub executor sources, Worker residency statuses,
worker ready/fallback counts, and missing executor count in telemetry.
Validation: sibling PeerCompute lane tests passed `10/10`; ULG PeerCompute
integration passed `16/16`; `npm run test:physics-atomics` passed `11` with
`3` expected opt-in skips; short visual matrix
`codex-stage-placement-preflight-20260617` passed `3/3` with empty issue
counts and frame artifacts. This is a truthful placement audit surface, not a
claim that one ordered WebGPU queue runs kernels out of order or that remote
GPU buffers are local handles.

Previous checkpoint, 2026-06-17 AKDT: PeerCompute GPU resident ready batches now
respect declared state-family read/write conflicts. The lane manager defers a
ready stage when it would share a batch with another stage that writes a family
it reads/writes or reads a family it writes. Execution reports now include the
conflict policy and deferral records, and ULG mechanics stage-chain telemetry
exposes that evidence. Validation: sibling PeerCompute lane tests passed
`9/9`; ULG PeerCompute integration passed `16/16`; `npm run
test:physics-atomics` passed `11` with `3` expected opt-in skips; short visual
matrix `codex-state-family-conflict-batching-20260617` passed `3/3` with
empty issue counts. Current ULG P2G plus pressure/interface batching reports
zero conflict deferrals.

Previous checkpoint, 2026-06-17 AKDT: Worker-retained mechanics publications now
have an authority-host continuation planner. `host.planWorkerRetainedContinuation()`
resolves the StateManager hot-buffer record, reads
`peercompute.ulg.worker-retained-access-contract.v0`, checks required output
families, validates same-Worker retained-ref consumer mode, confirms retained
refs and a Worker runner are available, and emits
`peercompute.ulg.worker-retained-continuation-plan.v0`. The mechanics stage
chain can now consume that plan and record it in Worker context/telemetry; the
old boolean remains as a compatibility override. Validation: syntax checks
passed; focused ULG PeerCompute integration passed `16/16`; `npm run
test:physics-atomics` passed `11` with `3` expected opt-in skips; short visual
matrix `codex-worker-retained-continuation-plan-20260617` passed `3/3` with
empty issue counts.

Previous checkpoint, 2026-06-17 AKDT: ULG resident lane contracts now expose
explicit stage dependencies, and sibling PeerCompute's GPU resident lane
manager can execute dependency-ready batches while preserving sequential
fallback for older contracts. The ULG mechanics contract now records
`stageDependencyMode=explicit-stage-dependencies`; P2G and independent
pressure/interface work can share a ready batch, grid update waits for its
declared inputs, G2P waits for grid update, thermal/phase waits for G2P, and
reaction/product waits for thermal/phase or G2P. Validation: sibling
PeerCompute lane tests passed `8/8`; ULG PeerCompute integration passed
`16/16`; `npm run test:physics-atomics` passed `11` checks with `3` expected
opt-in skips; short visual matrix
`codex-stage-dependency-batches-20260617` passed `3/3` with empty issue counts.
This improves scheduler concurrency but is not full WebGPU parallelism:
same-queue commands still execute in order, and the hot path still needs
conflict-aware placement, same-Worker retained-ref continuations, and fewer
readbacks/fences.

Previous checkpoint, 2026-06-17 AKDT: Worker-retained law-family publications
now carry `peercompute.ulg.worker-retained-access-contract.v0`. Mechanics,
thermal/phase, pressure/interface, and reaction/product hot-buffer
publications now state whether their refs are main-thread same-device aliases
or Worker-private retained refs that must be consumed by a same-Worker/lane
continuation. Mechanics now has focused authority-host coverage matching the
existing pressure/reaction publication surfaces. Validation: syntax checks
passed; focused PeerCompute integration passed `16/16`; `npm run
test:physics-atomics` passed `11` checks with `3` expected opt-in skips; short
visual matrix `codex-worker-retained-contract-20260617` passed `3/3` with
empty issue counts and frame artifacts. WebGPU concurrency remains open:
ComputeManager has task-graph/Worker-lane surfaces, but ULG still synchronizes
too much around ordered queue fences/readbacks. The next architecture slice
should schedule same-Worker continuations from these contracts and overlap
independent law-family, closure, cache, and remote-peer work when state-family
read/write sets allow it.

Previous checkpoint, 2026-06-17 AKDT: resident render-field surfaces are no
longer hard-clipped to current particle bounds before display. That clamp was
meant as a stale-surface guard, but on current visible MLS-MPM render fields it
mutated MarchingCubes vertices and produced the blocky/cuboid H2O shape that
looked like non-merged water despite topology metrics showing one connected
surface. Current visible render fields now record
`surface-bounds-diagnostic-current-render-field` and keep particle-bounds
trust in the analyzer; stale retention still uses the bounds check, and the
container clamp remains active. The probe now includes resident render-field
cell size in the particle-bound surface envelope and fails if a visible
resident surface is ever vertex-clipped back to particle bounds. Validation:
`node --test tests/sphPhaseRenderer.test.mjs` passed `35/35`; resident MLS-MPM
H2O row `codex-mlsmpm-h2o-unclipped-renderfield-cellslack-20260617` passed
with empty issue counts, one H2O visible surface, one connected component,
`clipStatus=surface-bounds-diagnostic-current-render-field`, `clipCount=0`,
`renderFieldCellSizeM=0.1417`, `maxVisibleSurfaceOutsideParticleBoundsM=0`,
final tallness `0.488`, and footprint fill `0.356`.

Previous checkpoint, 2026-06-17 AKDT: H2O transmissive surface depth policy is
fixed in the default Three/MarchingCubes render path. Condensed water is now
rendered as depth-writing MeshPhysicalMaterial transmission (`transparent=false`,
`depthWrite=true`, stable depth-writing order), while vapor/true-alpha surfaces
remain non-depth-writing and depth-sortable. The optical GPU lookup refresh and
visual probe use the same contract. Validation: `node --test
tests/sphPhaseRenderer.test.mjs` passed `35/35`; short CPU-SPH H2O row
`codex-cpu-sph-h2o-depthwrite-short-2-20260617`, long CPU-SPH H2O row
`codex-cpu-sph-h2o-depthwrite-long-20260617`, and resident MLS-MPM H2O row
`codex-mlsmpm-h2o-depthwrite-merge-20260617` all passed with empty issue
counts. Both long rows report one H2O visible surface, one connected component,
and H2O metadata `transparent=false`, `depthWrite=true`, `depthTest=true`,
`renderLayer=transmissive-surface`, `renderOrderPolicy=stable-opaque-layer-order`.

Previous checkpoint, 2026-06-17 AKDT: resident MLS-MPM H2O/H2O split-path
free-surface spreading is fixed. The resident grid-update CPU/WGSL kernels now
match the monolithic CPU oracle's floor boundary semantics by keeping the first
interior floor row active; WebGPU grid-update cache keys were bumped, and a
resident split long-horizon free-surface gate now guards the regression.
Validation: grid-update unit suite, opt-in physics behavior suite `14/14`, and
visual matrix `codex-mlsmpm-free-surface-1s-floorfix-finalframe-20260617`
passed with final tallness `0.440`, footprint fill `0.182`, one connected H2O
surface, and no visual issues.

## Done

- ULG mechanics stage-chain telemetry now records ComputeManager-owned GPU
  resident stage-placement preflight evidence before stage execution. The
  preflight reuses PeerCompute's dependency-batch and state-family conflict
  planner, reports GPUHub Worker policy readiness/fallback, and proves current
  mechanics-only plus pressure/thermal/reaction chains have no missing
  executors while preserving truthful WebGPU concurrency limits.
- GPU resident ready batches now respect state-family read/write conflicts
  before parallel stage execution. PeerCompute records conflict deferrals, and
  ULG exposes the policy in mechanics stage-chain telemetry.
- Worker-retained mechanics outputs now produce a consumer-side continuation
  plan from admitted StateManager hot-buffer evidence. The plan validates the
  access contract before enabling same-Worker retained input, and the mechanics
  stage chain records the plan status/source in Worker context and telemetry.
- GPU resident lane stage plans now support explicit dependency batches through
  sibling PeerCompute's `GpuResidentLaneManager`, and ULG's MLS-MPM mechanics
  contract publishes a concrete law-stage DAG. This lets independent stage
  handlers such as P2G and pressure/interface overlap at the scheduler level
  before grid update consumes both. The execution report now records dependency
  mode, ready batches, and max concurrent stage count so future placement work
  can audit actual overlap instead of assuming it.
- Worker-retained law-family publications now expose an explicit access
  contract through StateManager hot records, warm deltas, and import
  descriptors. Worker-private mechanics/thermal/pressure/reaction refs are
  marked as non-main-thread-local and continuation-only, while same-device
  main-thread handles remain the only zero-copy local import path. This closes
  a scheduler ambiguity before further WebGPU worker promotion.
- Current resident render-field surfaces are no longer deformed by particle-
  bounds clipping. The renderer records the particle-bounds check as diagnostic
  metadata, still clamps to the container, and the visual probe now includes
  resident render-field cell size plus a regression issue for any future
  visible resident surface clipped to particle bounds. The post-patch MLS-MPM
  H2O row passes with one connected H2O surface and a plausible merged mound.
- Default Three/MarchingCubes rendering no longer treats condensed transmissive
  H2O as alpha-blended transparent geometry. This fixes the visible grid/wire
  draw-through artifact on water while preserving vapor/alpha sorting. CPU and
  resident H2O rows now pass post-patch visual checks with one connected H2O
  component and stable depth-writing transmissive metadata.
- Resident MLS-MPM H2O/H2O now passes the long free-surface spread gate in the
  split resident path used by the browser. The floor grid-update clamp no longer
  zeros the first interior row (`y == dx`), which was freezing tangential liquid
  flow and producing sticky/nested water shapes. CPU and WGSL resident kernels
  are aligned with the monolithic CPU oracle, and the grid-update pipeline cache
  keys are bumped to avoid stale shader reuse in long-lived browser sessions.
- CPU-SPH same-material H2O now passes the long free-surface shape gate in the
  browser. `createSphPhaseCarrier()` applies a small volume-derived
  free-surface relaxation closure for floor-supported liquid groups, and
  `createSphPhaseDemo()` defaults CPU-SPH liquid wall damping to `0.30` and the
  relaxation alpha to `5e-5`. The opt-in density-gated hydrostatic hook remains
  available but default-off after testing showed direct hydrostatic pressure
  was either ineffective or too explosive at this resolution. Validation passed
  fast atomics, opt-in long liquid atomics `13/13`, and visual matrix
  `codex-cpu-sph-free-surface-fix-long-20260615` with last H2O tallness
  `0.582` and footprint fill `0.296`. MLS-MPM/WebGPU free-surface behavior
  remains open.
- Long-horizon visual probes now report H2O liquid free-surface shape metrics:
  surface height, tallness ratio, and footprint fill ratio. The opt-in gate
  `ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1` classifies bad liquid shape with
  explicit `liquid-free-surface-*` issues, and visual matrix summaries preserve
  the gate thresholds. Focused run
  `codex-free-surface-gate-h2o-short-fixedsummary-20260615` intentionally
  failed both H2O rows with one connected surface but excessive tallness and
  insufficient footprint fill. This completes instrumentation/baseline
  diagnosis only; liquid mechanics/free-surface remediation remains P0.
- Long-horizon visual probes now report MarchingCubes connected-component
  metrics for visible surfaces. Short H2O baseline
  `codex-surface-components-h2o-baseline-20260615` and medium MLS-MPM probe
  `codex-mlsmpm-h2o-medium-components-20260615` showed the current MLS-MPM
  water issue is not disconnected components; the surface remains one connected
  mesh while the liquid body stays tall/blocky. Next work is free-surface
  shape/levelness metrics and the corresponding liquid mechanics fix.
- The visual matrix now fails on renderer depth/order policy regressions.
  Long-horizon probe samples include visible-surface render layer, object/base
  render order, render-order policy, material depth-write/depth-test, and
  container grid/wire policy. The analyzer reports
  `render-depth-order-visual-trust` for bad transparent sorting, bad opaque
  depth writes, or broken non-depth-writing overlays, and the matrix summary
  preserves the exact fields. Validation passed syntax checks, focused renderer
  coverage `35/35`, CPU-SPH H2O row
  `codex-render-depth-policy-cpu-sph-20260615`, and mixed Fe/H2O row
  `codex-render-depth-policy-solid-liquid-20260615`; fresh combined row
  `codex-render-depth-policy-two-row-refresh-20260615` also passed both rows
  with empty issue counts. Real-device focus flashing and pixel-level z-buffer
  probes remain open.
- Plain CPU-SPH same-material liquid settling now passes the long mounted
  browser acceptance probe. The carrier cancels gravity half-kicks at finite-
  volume wall contact and applies explicit viscosity-law liquid wall damping
  plus same-material velocity diffusion when the viscosity law group is enabled.
  Validation passed syntax checks, `npm run test:physics-atomics`,
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` (`13/13`),
  short visual matrix `codex-cpu-sph-liquid-viscosity-short-20260615`, and long
  browser probe `codex-cpu-sph-h2o-long-after-sph-viscosity-20260615` with one
  H2O surface, no visual issues, and final drop speed about `0.246 m/s`.
- CPU-rendered same-material liquid domains now merge before MarchingCubes,
  fixing the short-horizon nested/stacked H2O surface identity bug while
  preserving same-material solid domains as separate surfaces. The scene
  reports CPU MarchingCubes cell-size metadata, and the visual probe uses that
  cell size in particle-bound surface-envelope checks. Validation passed
  renderer tests `35/35`, targeted CPU-SPH H2O visual matrix
  `codex-cpu-liquid-merge-surface-short-cellslack-20260615` with H2O visible
  surface count `1 -> 1`, targeted public/default Na/H2O visual matrix
  `codex-default-na-h2o-plain-sph-blob1-20260615` with `mech=sph` and empty
  issues, and `npm run build:pages`. Long-horizon liquid/free-surface quality,
  z-buffer/draw-order, and focus-resume visual trust remain open.
- The full short-horizon visual sanity matrix is green after the plain-SPH
  pressure partition and CPU stale-surface fixes. Run
  `codex-full-after-sph-partition-and-stale-surface-20260615` passed all
  12 scenarios with empty issue counts and three captured frames per row.
- CPU-particle MarchingCubes surfaces now hide immediately when their
  material/phase batch is absent. This prevents consumed reactants from leaving
  stale meshes visible during reaction updates while preserving inactive grace
  for resident render-field gaps. The public-default Na/H2O visual row now
  passes with empty issue counts and five frame artifacts.
- Plain SPH/PBF now has an explicit condensed-liquid pressure participant
  predicate. Solids and gas products no longer enter density, pressure, or PBF
  projection as liquid mass. The new Fe/H2O solid-liquid and room-temperature
  Na/H2O reaction-product atomics pass, and the public-default Na/H2O visual
  row no longer hits the reaction speed clamp. The remaining targeted failure
  is a Na solid MarchingCubes surface-envelope residual, tracked under
  renderer/probe visual trust.
- Plain SPH/PBF law isolation now treats density projection as part of the
  EOS/incompressibility law family. When the EOS law group is disabled, the
  reference SPH lane sets `sphDensityProjectionIterations=0`, so no-force
  configurations do not move liquid particles through hidden projection
  corrections. The visual matrix `law-static-gravity-off-fe-h2o` scenario now
  disables EOS, pressure, viscosity, thermal, reactions, and surface tension in
  addition to gravity. Validation passed Node 24 syntax checks, physics
  atomics `8` with `1` expected opt-in skip, and visual matrix
  `codex-gravity-off-static-no-force-after-eos-gate-20260615` with zero speed,
  zero displacement, no issues, and five captured frames. This fixes the
  no-force SPH isolation bug only; liquid/free-surface quality and remaining
  full-matrix failures stay open.
- Resident product-mass handles now preserve compact product-event and product-
  inventory records when those records are available, and the preferred
  resident product-mass gas-ledger pressure path can derive a spatial gas
  species ledger from positioned resident product-event records. This enables
  the resident gas-cell EOS producer route for compact-record/reference
  product-event paths while leaving the no-full hot path fail-closed when only
  retained GPU product-event rows exist. The mounted Na/H2O browser gate now
  explicitly asserts the current blocker: product-event rows are retained but
  event records are absent, spatial ledger is blocked, producer request is
  blocked, and snapshot import remains disabled. Validation passed syntax
  checks, focused pressure coverage `30/30`, reaction-summary coverage `9/9`,
  mounted Na/H2O Playwright `1/1`, physics atomics `7` with `1` expected
  opt-in skip, and visual matrix
  `codex-product-event-spatial-ledger-source-20260615` `3/3` with inspected
  frames.
- Mounted pressure-interface refresh no longer publishes gas-cell imports from
  `gasPressureSummary` snapshots. The scene import helper keeps its default
  snapshot compatibility path for explicit callers, but mounted refresh passes
  `allowSummaryGasCellFieldImport=false`, so a hot-path import must be supplied
  as an admitted descriptor or produced by `gasCellEosProducer`. Snapshot
  candidates block with retained-ref and snapshot-readiness diagnostics instead
  of being published. Validation passed syntax checks, scene gas-cell coverage
  `33/33`, physics atomics `7` with `1` expected opt-in skip, browser
  authority-host Playwright `1/1`, and visual matrix
  `codex-mounted-no-snapshot-gas-import-20260615` `3/3` with inspected frames.
  Normal scenarios still need a ready spatial gas species ledger before the
  producer path is active everywhere, and the visible physics blockers remain
  open.
- Mounted resident pressure-interface refresh can now request the resident
  gas-cell EOS producer stage through the resident authority host when a ready
  spatial gas species ledger is available and no ready gas-cell import was
  supplied. The request path fails closed without a ready ledger or host
  submitter, carries source/state/cadence telemetry, records submitted task
  status, retained gas-pressure refs, retained source readiness, and spatial
  ledger cell count, and feeds ready producer output into the existing
  host-published gas-cell admission/import helper. The scene still does not
  schedule or mutate distributed state directly. Validation passed syntax
  checks, scene gas-cell coverage `32/32`, SPH gas/pressure coverage `45/45`,
  PeerCompute integration `15/15`, physics atomics `7` with `1` expected
  opt-in skip, browser authority-host Playwright `1/1`, and visual matrix
  `codex-mounted-gas-eos-hot-loop-20260615` `3/3` with inspected frames. This
  does not close MLS-MPM fragmentation, CPU-SPH stacked/blob behavior, ice/
  solid rigidity, volume pulsation/blinking, long-horizon liquid settling, or
  renderer z-buffer/focus trust.
- Wired the resident gas-cell EOS producer into the opt-in ComputeManager
  mechanics stage-chain before pressureInterface. The stage-chain contract can
  include `gasCellEosProducer`, run it after P2G, publish its retained
  gas-cell field through the resident authority host, pass the admitted import
  into pressureInterface, and keep full pressure feedback derivation on the
  normal gas-pressure summary path. The browser host now exposes a gas-cell EOS
  stage submitter and passes itself into `runMechanicsStageTaskChain()`, the
  resident worker avoids partial synthetic pressure feedback, and the scene
  import helper accepts producer result sources. Validation passed syntax
  checks, SPH stage coverage `45/45`, scene gas-cell coverage `30/30`,
  PeerCompute integration `15/15`, physics atomics `7` with `1` expected
  opt-in skip, browser authority-host Playwright `1/1`, and visual matrix
  `codex-gas-eos-stage-chain-live-wire-20260615` `3/3` with inspected frames.
  This is the formal stage-chain and helper path; mounted scene hot-loop opt-in
  and true WGSL EOS remain open.
- Added the resident gas-cell EOS producer stage surface. The new
  `peercompute.ulg.sph-gas-cell-eos-producer-stage-compute-task.v0` derives a
  structured local gas-cell pressure field from the spatial gas species ledger,
  packs the shared 12-float gas-pressure-cell ABI, uploads/retains that row
  buffer on a WebGPU lane when requested, and emits non-mutating stage
  evidence, a GPU fence report, retained `resident-gas-pressure-cells-buffer`
  refs, and a retained gas-cell field source descriptor for pressureInterface
  admission/import. The resident stage worker registers `gasCellEosProducer`.
  PeerCompute integration proves the EOS producer result can be admitted by the
  resident authority host, imported as a gas-cell field, and consumed by
  pressureInterface. Validation passed syntax checks, SPH stage coverage
  `44/44`, PeerCompute integration `15/15`, worker coverage `5/5`, physics
  atomics `7` with `1` expected opt-in skip, browser authority-host Playwright
  `1/1`, and visual matrix
  `codex-resident-gas-cell-eos-producer-20260615` `3/3` with inspected frames.
  The EOS math is still CPU-derived before WebGPU row upload; a real WGSL EOS
  shader remains future work.
- Pressure/interface gas-cell admission/import now consumes the retained
  gas-cell field source descriptor directly. The browser resident authority
  host can resolve
  `peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0` from
  the source object or admitted gas-cell field evidence, derive worker/local
  retained gas-pressure refs and row metadata from it, and preserve the
  descriptor in admission/import records, StateManager hot records, and warm
  deltas. Empty caller ref arrays no longer mask descriptor refs. Validation
  passed syntax checks, PeerCompute integration `14/14`, pressure stage
  coverage `43/43`, physics atomics `7` with `1` expected opt-in skip, browser
  authority-host Playwright `1/1`, and visual matrix
  `codex-retained-gas-cell-source-consumption-20260615` `3/3` with inspected
  frames. The import still needs a local gas-cell snapshot until the dedicated
  resident gas-cell EOS producer becomes a retained ComputeManager/GPUHub
  output.
- Added a retained gas-cell field source descriptor to the pressure/interface
  Worker publication path. Candidate, stage-chain summary, hot StateManager
  record, warm delta, and worker-retained import now expose
  `peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0` when
  a local-gradient pressure stage owns worker/local retained gas-cell buffer
  refs. This keeps the gas-cell field visible as a retained lane-owned source
  without claiming new hidden mutation authority. Validation passed syntax
  checks, PeerCompute integration `14/14`, pressure stage coverage `43/43`,
  physics atomics `7` with `1` expected opt-in skip, browser authority-host
  Playwright `1/1`, and visual matrix
  `codex-retained-gas-cell-field-source-20260615` `3/3` with inspected frames.
- Threaded spatial gas-cell source provenance through the local EOS path.
  Spatial gas species ledgers now carry retained product source refs into
  derived gas-cell pressure fields and pressure feedback summaries, while the
  generic `resident-product-mass-buffer` ref is only minted when an actual
  product-event buffer handle is retained. This preserves the distinction
  between source product buffers and pressure gas-cell buffers before the next
  ComputeManager/GPUHub retained source promotion. Validation passed syntax
  checks, gas/pressure coverage `29/29`, pressure stage coverage `43/43`,
  physics atomics `7` with `1` expected opt-in skip, and visual matrix
  `codex-spatial-gas-source-provenance-20260615` `3/3` with inspected frames.
  MLS-MPM fragmentation and CPU SPH stacked/blob behavior remain open.
- Added the StateManager-backed gas-cell field admission publisher. The
  resident authority host now publishes
  `peercompute.ulg.pressure-interface-gas-cell-field-admission-hot-buffer-publication.v0`
  records after validating a ready local gas-cell field and retained
  gas-pressure refs. The scene helper can request this host admission before
  publishing the gas-cell import, so caller-built admission evidence is no
  longer the only route. Missing retained refs or host authority still fail
  closed. Validation passed syntax checks, renderer/scene coverage `29/29`,
  PeerCompute integration `14/14`, physics atomics `7` with `1` expected
  opt-in skip, browser authority-host Playwright `1/1`, and visual matrix
  `codex-gas-cell-admission-publisher-20260615` `3/3` with inspected frames.
- Added the first spatial gas-cell EOS producer contract. Aggregate resident
  gas-species ledgers now remain explicitly limited to uniform sealed-box
  pressure and report the missing spatial ledger; they cannot fabricate local
  pressure gradients. A true spatial gas-species ledger can derive per-cell
  ideal-gas pressure and nearest-neighbor pressure gradients, and positioned
  gas product-event rows with `positionM` plus `supportVolumeM3` now produce a
  `peercompute.ulg.sph-spatial-gas-species-ledger.v0` source for that local
  EOS path. PressureInterface still treats these rows as oracle/local evidence
  until gas-cell field admission, retained refs, and StateManager publication
  are present. Validation passed syntax checks, gas/pressure coverage `29/29`,
  pressure stage coverage `43/43`, PeerCompute integration `14/14`, physics
  atomics `7` with `1` expected opt-in skip, browser authority-host Playwright
  `1/1`, and visual matrix
  `codex-spatial-gas-cell-eos-producer-20260615` `3/3` with two captured
  frames per scenario. Manual frame inspection found nonblank bounded frames;
  MLS-MPM fragmentation and CPU SPH stacked/blob behavior remain open.
- Fixed pressureInterface retained gas-cell ref classification and task
  retention declarations. PressureInterface stage tasks now add
  `resident-gas-pressure-cells-buffer` to GPU fence/lane retained refs when a
  local gas-cell field/import is present, and the resident Worker mirrors that
  retained-buffer declaration. Worker publication candidates now classify
  worker-generated refs like `result.gasPressureCellsBuffer` as gas-cell refs
  while keeping pressure force-row refs separate, so local-gradient WebGPU
  pressure stages can carry worker-retained gas-cell evidence through
  ComputeManager/GPUHub to NodeKernel/StateManager admission. Validation passed
  syntax checks, pressure stage coverage `43/43`, PeerCompute integration
  `14/14`, resident-stage Worker tests `4/4`, physics atomics `7` with `1`
  expected opt-in skip, browser PeerCompute resident authority-host Playwright
  `1/1`, and visual matrix
  `codex-pressure-gas-cell-retained-ref-wire-20260615` `3/3` with two captured
  frames per scenario. Manual frame inspection found final frames nonblank and
  bounded; MLS-MPM fragmentation and CPU SPH stacked/blob behavior remain open.
- Wired the scene/stage gas-cell import path through the resident authority
  host. `sphPhaseScene` now extracts ready local gas-cell pressure-gradient
  fields, gas-cell field-consumption admission, and retained gas-pressure refs
  from resident gas-pressure summaries, then calls
  `publishPressureInterfaceGasCellFieldImportSource()` on the resident
  authority host to obtain a StateManager-backed
  `peercompute.ulg.pressure-interface-gas-cell-field-import.v0` descriptor.
  Missing local gradients, admission, retained refs, or host publisher fail
  closed as scene telemetry. The mounted resident loop threads the resulting
  import/admission through resident mechanics scheduling, pressure-interface
  refresh, and render refresh state, and state summaries expose source
  hot-buffer keys, retained refs, admission status, and publication blockers.
  Validation passed syntax checks, scene/renderer coverage `28/28`, browser
  PeerCompute resident authority-host Playwright `1/1`, physics atomics `7`
  with `1` expected opt-in skip, PeerCompute integration `14/14`, and visual
  matrix `codex-scene-gas-cell-import-wire-20260615` `3/3` with two captured
  frames per scenario. Manual frame inspection found the final frames nonblank
  and bounded, with MLS-MPM fragmentation and CPU SPH stacked/blob behavior
  still open as physics behavior defects rather than accepted liquid results.
- Added the StateManager gas-cell field import publisher. The browser resident
  authority host now exposes
  `publishPressureInterfaceGasCellFieldImportSource()`, which validates
  admitted gas-cell field-consumption evidence, retained gas-cell refs, and a
  ready local gas-cell snapshot before storing a
  `peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0`
  hot record and warm delta. The returned
  `peercompute.ulg.pressure-interface-gas-cell-field-import.v0` descriptor is
  directly consumable by pressureInterface. Integration coverage proves invalid
  admission and missing retained refs are rejected, hot/warm records preserve
  the import, and the pressureInterface stage uses the returned import for
  local-gradient pressure rows. Validation passed syntax checks, PeerCompute
  integration `14/14`, physics atomics `7` with `1` expected opt-in skip, and
  visual matrix `codex-gas-cell-import-publisher-20260615` `3/3` with two
  captured frames per scenario. Manual frame inspection found final frames
  nonblank and bounded.
- Added the admitted gas-cell field import descriptor. PressureInterface can
  now consume
  `peercompute.ulg.pressure-interface-gas-cell-field-import.v0` when it is
  ready, carries admitted gas-cell field-consumption evidence, includes
  retained gas-cell refs, and provides a local gas-cell snapshot for the
  CPU/WebGPU oracle path. Invalid imports report precise blocked status and do
  not replace uniform sealed-gas pressure. Stage evidence, lane summaries, and
  Worker compact publication candidates expose import schema/status/source hot
  buffer metadata. The mechanics stage DAG now passes gas-cell import/admission
  fields through inline lane execution and Worker common context. Validation
  passed syntax checks, pressureInterface stage coverage `42/42`, Worker stage
  coverage `4/4`, PeerCompute integration `13/13`, physics atomics `7` with
  `1` expected opt-in skip, and visual matrix
  `codex-gas-cell-field-import-20260615` `3/3` with two captured frames per
  scenario. Manual frame inspection found final frames nonblank and bounded;
  MLS-MPM still shows the known short-horizon fragmentation.
- Added the local gas-cell field consumption admission gate. PressureInterface
  stage results, stage evidence, lane summaries, and Worker compact publication
  candidates now distinguish a local gas-cell field that is computable by the
  oracle from one that has been admitted for distributed consumption. Local
  pressure-gradient publication now requires
  `peercompute.ulg.pressure-interface-gas-cell-field-admission.v0` with
  `pressure-interface-gas-cell-field-consumption-approved`; retained gas-cell
  buffer refs alone are not enough. The browser authority host rejects
  local-gradient pressure publication without this admitted field-consumption
  evidence, and hot/warm StateManager records preserve the admission fields.
  Validation passed syntax checks, focused pressure-interface stage coverage
  `40/40`, PeerCompute host publication coverage `13/13`, WebGPU pressure
  producer coverage `3/3`, physics atomics `7` with `1` expected opt-in skip,
  and visual matrix `codex-gas-cell-field-admission-20260615` `3/3` with two
  captured frames per scenario. Manual frame inspection found final frames
  nonblank and bounded; MLS-MPM still shows the known short-horizon
  fragmentation.
- Added the retained local gas-cell pressure publication gate. The WebGPU
  pressure/interface producer can now retain its local gas-cell input buffer
  when it retains force rows; pressure stage lane summaries report gas-cell row
  count, stride, byte length, and retained-buffer status. The Worker compact
  publication candidate now fails closed for local-gradient pressure unless
  retained gas-cell refs are present, and the browser authority host rejects
  local-gradient pressure publication attempts without worker-retained
  gas-cell buffers. StateManager hot and warm records preserve gas-cell buffer
  refs and row metadata alongside pressure force-row refs. Validation passed
  syntax checks, WebGPU pressure producer `3/3`, PeerCompute publication
  `13/13`, resident pressure-stage coverage `38/38`, physics atomics `7` with
  `1` expected opt-in skip, browser authority-host Playwright `1/1`, and
  visual matrix `codex-pressure-gas-cell-publication-admission-20260615` `3/3`
  with two captured frames per scenario. Manual frame inspection confirmed all
  final frames were nonblank and bounded.
- Added the local gas-cell pressure field contract. The sealed-gas pressure
  summary can now carry a ready structured gas-cell field with per-cell
  pressure and pressure gradients. The CPU pressure/interface preview and
  solver sample nearest-cell pressure plus first-order gradient reconstruction
  at interface centroids, while preserving equal/opposite gas reaction force
  rows. The WebGPU pressure/interface producer packs those gas cells into a
  12-float row buffer, expands `PressureInterfaceParams` to 32 bytes, binds the
  local cell buffer at slot 3, and performs the same reconstruction in WGSL
  before writing the existing 16-float force-row ABI. Validation passed syntax
  checks, demo pressure/gas coverage `26/26`, WebGPU pressure producer `3/3`,
  WebGPU uniform-buffer ABI `1/1`, ABI coverage `17/17`, resident-step
  pressure/stage coverage `38/38`, physics atomics `7` with `1` expected
  opt-in long-horizon skip, browser authority-host Playwright `1/1`, and
  visual matrix `codex-pressure-local-gas-cell-field-20260615` `3/3` with two
  captured frames per scenario. Manual frame inspection confirmed all final
  frames were nonblank and bounded; MLS-MPM still shows the known short-horizon
  fragmentation.
- Added pressure/local-gradient contract metadata. The current
  pressure/interface law remains a uniform sealed-gas pressure traction law,
  but the gas-cell field, pressure-interface coupling, CPU force solver,
  WebGPU force-row producer, ComputeManager stage evidence, and lane summaries
  now expose the current resolution as
  `uniform-single-cell-sealed-gas` / `lumped-sealed-box` and explicitly mark
  local pressure-gradient coupling blocked until a resident gas-cell EOS
  gradient field exists. This keeps pressure laws intact while preventing the
  current uniform-force-row producer from being mistaken for validated local
  gas-cell pressure-gradient physics. Validation passed syntax checks, focused
  demo pressure/gas coverage `25/25`, WebGPU pressure producer `2/2`,
  resident-step pressure/stage coverage `38/38`, physics atomics `7` with `1`
  expected opt-in long-horizon skip, browser authority-host Playwright `1/1`,
  and visual matrix `codex-pressure-local-gradient-contract-20260615` `3/3`
  with two captured frames per scenario. Manual frame inspection confirmed
  the short captures were nonblank and bounded; MLS-MPM remains visually
  fragmented in the known short-horizon way.
- Added the pressure/interface WebGPU-retained publication gate. The
  pressure/interface Worker compact publication candidate now requires a
  WebGPU backend, no-full readback, worker-ready residency, non-mutating
  authority, and a retained GPU force-row buffer descriptor before it can be
  considered publication-ready. CPU-reference or cloneable force-row arrays
  now report blocked consumer/copy protocols instead of looking equivalent to
  same-worker retained buffers. The PeerCompute browser resident authority host
  also rejects pressure/interface publication attempts unless the candidate
  carries `worker-lane-gpu-buffer-retained` residency and
  `same-worker-lane-retained-buffer-ref` access. Validation passed syntax
  checks, PeerCompute/ULG integration `13/13`, resident-step pressure coverage
  `38/38`, focused browser authority-host Playwright `1/1`, physics atomics
  `7` with `1` expected opt-in long-horizon skip, and visual matrix
  `codex-pressure-publication-webgpu-retained-only-20260615` `3/3` with two
  captured frames per scenario.
- Added the scene pressure-row upload admission gate. The mounted
  `sphPhaseScene` no longer uploads CPU-side pressure/interface force rows into
  a scene-owned `GPUBuffer` unless the same
  `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`
  descriptor that grid update requires is approved and the solver is approved
  for grid application. Unadmitted pressure/interface candidates now remain
  telemetry-only, report candidate byte length and blocker status, and are
  excluded from mechanics/resident-step signatures so ComputeManager lane
  state keys do not drift from inadmissible scene-local data. Same-lane
  resident continuations also reuse the previous lane-owned state key, fixing
  browser continuation submissions after reset. Browser e2e diagnostics now
  expose compact-summary active-grid availability, pressure admission fields,
  and closure-derived transmissive H2O alpha/depth policy. Validation passed
  syntax checks, renderer pressure/depth unit coverage `27/27`, grid-update
  admission unit coverage `14/14`, resident-step pressure/admission unit
  coverage `38/38`, default derived-material browser Playwright `1/1`,
  browser PeerCompute resident authority-host Playwright `1/1`, physics
  atomics `7` with `1` expected opt-in long-horizon skip, and visual matrix
  `codex-scene-pressure-upload-admission-gate-20260615` `3/3` with two
  captured frames per scenario. Remaining physics risk: this gates the bad
  pressure-row scene upload path, but does not by itself prove long-horizon
  liquid settling or the live-device focus-change renderer symptom.
- Added the first transparent renderer depth-order pass. Transparent
  MarchingCubes surfaces now share their layer render order so Three.js can
  depth-sort overlapping transmissive/vapor/alpha meshes by camera position;
  opaque surfaces keep stable hash ordering. The diagnostic floor grid no
  longer writes depth, preventing it from contaminating later transparent
  draws. Browser authority-host coverage now checks visible transparent
  surfaces report `three-transparent-depth-sort-within-layer` and that the grid
  material has depth writes disabled. Validation passed syntax checks,
  renderer unit coverage `26/26`, focused browser authority-host Playwright
  `1/1`, physics atomics `7` with `1` expected skip, and visual matrix
  `codex-render-transparent-depth-order-20260615` `3/3` with two captured
  frames per scenario. Remaining renderer risk: reproduce the user's
  phone/focus flash-disappear path if it still occurs after this pass.
- Added retained-buffer pressure/interface admission evidence. The WebGPU grid
  update now requires the admitted
  `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`
  descriptor before applying pressure/interface force rows, even when the rows
  arrive as a same-lane retained `GPUBuffer`. Buffer-only no-full submissions
  are reported as submitted/unverified retained-buffer work instead of as a
  measured zero CPU impulse. Pressure/interface Worker publication descriptors
  now carry force-row stride, byte length, retained-buffer residency, and
  same-lane consumer protocol through StateManager hot records and warm deltas.
  Focused validation passed syntax checks, `git diff --check`,
  grid-update kernel unit `14/14`, resident-step unit `38/38`, resident-stage
  Worker unit `4/4`, PeerCompute/ULG integration `13/13`, physics atomics `7`
  with `1` expected skip, focused browser authority-host Playwright `1/1`, and
  visual matrix `codex-pressure-retained-buffer-admission-20260615` `3/3` with
  two captured frames per scenario.
- Added the first WebGPU-resident pressure/interface force-row producer. The
  new WGSL kernel packs material-interface element rows and writes the same
  16-float pressure force-row ABI as the CPU oracle. The pressure stage now
  uses this producer when `preferWebGpu=true` and a device is available,
  retains `forceRowsBuffer` for no-full Worker execution, and falls back to
  the CPU solver when WebGPU is unavailable. The resident Worker now hands the
  raw pressure row `GPUBuffer` from `pressureInterface` to `gridUpdate` on the
  same lane. Validation passed syntax checks, `git diff --check`, WebGPU
  producer unit `2/2`, WebGPU ABI guard `1/1`, resident-step units `38/38`,
  resident-stage Worker unit `4/4`, PeerCompute/ULG integration `13/13`,
  focused browser authority-host Playwright `1/1`, physics atomics `7` with
  `1` expected skip, and visual matrix
  `codex-pressure-interface-webgpu-producer-20260615` `3/3` with two captured
  frames per scenario.
- Added pressure/interface same-frame grid admission inside the
  ComputeManager/GPUHub stage-plan path. When `pressureInterface` immediately
  precedes `gridUpdate`, ULG now publishes the retained pressure force-row
  descriptor, creates
  `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`,
  and injects the approved pressure solver plus admission descriptor into the
  `gridUpdate` Worker context before the stage runs. The GPUHub worker wrapper
  now preserves retained refs inside the stage value handed to the next stage,
  so Worker-local pressure refs survive the PeerCompute lane-manager
  `currentValue` boundary. Validation passed syntax checks, `git diff
  --check`, full PeerCompute/ULG integration `13/13`, resident-stage Worker
  unit `4/4`, resident-step units `37/37`, focused browser authority-host
  Playwright `1/1`, physics atomics `7` with `1` expected skip, and visual
  matrix `codex-pressure-interface-same-frame-grid-admission-20260615` `3/3`
  with two captured frames per scenario.
- Added the pressure/interface grid consumption admission gate. Grid update now
  blocks direct pressure force rows unless the solver is explicitly approved
  and paired with
  `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`.
  CPU reference, optional WebGPU, resident-step diagnostics, and the
  grid-update stage task all report admission status, source hot-buffer key,
  force-row count, applied impulse, and impulse proof diagnostics. Validation
  passed syntax checks, `git diff --check`, resident-step units `37/37`, full
  PeerCompute/ULG integration `13/13`, focused browser authority-host
  Playwright `1/1`, physics atomics `7` with `1` expected skip, and visual
  matrix `codex-pressure-interface-grid-consumption-admission-20260615` `3/3`
  with two captured frames per scenario.
- Added pressure/interface Worker publication admission. The formal
  `pressureInterface` stage now builds a dedicated compact publication
  candidate for force-row output. The authority host exposes
  `publishWorkerRetainedPressureInterfaceStageOutput()`, stores a hot
  Worker-retained pressure descriptor, and commits an admitted warm delta under
  `ulg-worker-retained-pressure-interface-publications`. The admitted payload
  preserves retained pressure force-row refs and row counts while explicitly
  keeping `gridForceApplicationApproved=false`; approved grid-update
  consumption remains the next slice. Validation passed syntax checks,
  `git diff --check`, full PeerCompute/ULG integration `13/13`, focused
  browser authority-host Playwright `1/1`, physics atomics `7` with `1`
  expected skip, and visual matrix
  `codex-pressure-interface-publication-admission-20260615` `3/3` with two
  captured frames per scenario.
- Added the first pressure/interface Worker stage DAG boundary.
  `createSphPressureInterfaceStageComputeTask()` and
  `runSphPressureInterfaceStageComputeTask()` wrap the gas-pressure/material
  interface force-row solver as a non-mutating `pressureInterface` stage.
  The formal DAG can now run
  `p2g -> pressureInterface -> gridUpdate -> g2p -> thermalPhase -> reactionProduct`
  through GPUHub resident-stage executors; the resident Worker accepts
  `pressureInterface` and reports retained force-row refs. Grid force
  application remains explicitly unapproved until the next consumption slice.
  Validation so far passed syntax checks, pressure stage unit coverage
  `35/35`, Worker unit `4/4`, focused PeerCompute/ULG integration `12/12`,
  focused browser authority-host Playwright `1/1`, physics atomics `7` with
  `1` expected skip, and visual matrix
  `codex-pressure-interface-stage-dag-20260615` `3/3` with two captured frames
  per scenario.
- Added reaction/product Worker publication admission. The formal
  `reactionProduct` stage now builds a dedicated compact publication candidate
  from Worker-ready WebGPU no-full execution, retained product refs, and
  non-authoritative reaction/product evidence. The authority host exposes
  `publishWorkerRetainedReactionProductStageOutput()`, stores a hot
  Worker-retained descriptor, and commits an admitted warm delta under
  `ulg-worker-retained-reaction-product-publications` with output families for
  SPH particle state, thermo phase, MLS-MPM mechanics, and resident product
  mass. Validation passed syntax checks, `git diff --check`, full focused
  PeerCompute/ULG integration `12/12` twice, and resident-stage Worker unit
  `3/3`, focused browser authority-host Playwright `1/1`, physics atomics `7`
  with `1` expected skip, and visual matrix
  `codex-reaction-product-publication-admission-20260615` `3/3` with two
  captured frames per scenario.
- Added the first reaction/product Worker stage DAG boundary. ULG now exposes
  `createSphReactionProductStageComputeTask()` and
  `runSphReactionProductStageComputeTask()`, accepts no-full retained WebGPU
  reaction output without stale CPU parity, and lets the warm resident-stage
  Worker run `reactionProduct` after `thermalPhase` on the same
  ComputeManager/GPUHub lane. The injected PeerCompute gate proves
  `p2g -> gridUpdate -> g2p -> thermalPhase -> reactionProduct` through GPUHub
  resident-stage executors with all five stages `worker-ready`; the new stage
  remains non-authoritative until a StateManager admission slice exists.
  Validation passed syntax checks, `git diff --check`, reaction no-full unit
  `10/10`, Worker unit `3/3`, resident-step stage-task unit `34/34`, focused
  PeerCompute/ULG integration `11/11`, focused browser authority-host
  Playwright `1/1`, physics atomics `7` with `1` expected skip, and visual
  matrix `codex-reaction-product-stage-dag-20260614` `3/3` with two captured
  frames per scenario.
- Added thermal/phase Worker publication admission. The formal thermal stage
  now builds a dedicated retained-ref candidate for `sph-thermo-phase`, stores
  a StateManager hot record with the live Worker backend, and commits a warm
  delta under `ulg-worker-retained-thermal-phase-publications`. Validation
  passed syntax checks, `git diff --check`, focused PeerCompute/ULG integration
  `11/11`, resident-step unit `33/33`, focused browser authority-host
  Playwright `1/1`, physics atomics `7` with `1` expected skip, and visual
  matrix `codex-thermal-publication-admission-20260614` `3/3` with two
  captured frames per scenario.
- Added formal GPUHub thermal/phase stage DAG execution. When
  `includeThermalPhaseStage=true`, the ComputeManager/GPUHub stage-plan
  contract now executes `p2g -> gridUpdate -> g2p -> thermalPhase` on the same
  lane/state key. The browser authority-host gate no longer calls the thermal
  Worker directly; it requests thermal through `host.runMechanicsStageTaskChain()`.
  Validation passed syntax checks, `git diff --check`, focused PeerCompute/ULG
  integration `11/11`, resident-step unit `33/33`, focused browser
  authority-host Playwright `1/1`, physics atomics `7` with `1` expected skip,
  and visual matrix `codex-formal-thermal-stage-dag-20260614` `3/3` with two
  captured frames per scenario.
- Added live browser Worker thermal/phase stage execution. The focused
  authority-host gate now runs `thermalPhase` on the same warm Worker/lane
  after mechanics continuation, with cloneable scene thermal tables and
  no-full WebGPU thermal execution. The Worker consumes retained G2P state plus
  retained thermo, satisfies its queue fence, and adopts retained thermal
  `thermoBuffer` output. Thermal no-full acceptance now avoids stale CPU mirror
  parity. Validation passed syntax checks, `git diff --check`, thermal kernel
  `11/11`, Worker unit `2/2`, resident-step unit `33/33`, focused browser
  authority-host Playwright `1/1`, focused PeerCompute/ULG integration `11/11`,
  physics atomics `7` with `1` expected skip, and visual matrix
  `codex-browser-worker-thermal-phase-stage-20260614` `3/3` with two captured
  frames per scenario.
- Added Worker thermal/phase stage support. The checked-in resident-stage
  Worker now accepts `thermalPhase`, forwards retained state/thermo inputs into
  `runSphThermalPhaseStageComputeTask()`, and adopts emitted retained
  `thermoBuffer` output into the Worker lane record. Validation passed syntax
  checks, `git diff --check`, Worker unit `2/2`, resident-step unit `33/33`,
  focused PeerCompute/ULG integration `11/11`, focused browser authority-host
  Playwright `1/1`, physics atomics `7` with `1` expected skip, and visual
  matrix `codex-worker-thermal-phase-stage-support-20260614` `3/3` with two
  captured frames per scenario.
- Added the first ComputeManager thermal/phase stage-task boundary.
  `createSphThermalPhaseStageComputeTask()` and
  `runSphThermalPhaseStageComputeTask()` wrap the existing thermal step in a
  GPU-lane/fence-aware, commit-suppressed task that reads retained SPH
  state/thermo plus mechanics context, emits retained state/thermo outputs, and
  reports `thermalPhaseStageTaskAuthority.authoritativeStateMutation=false`.
  Validation passed syntax checks, `git diff --check`, resident-step unit
  `33/33`, focused PeerCompute/ULG integration `11/11`, physics atomics `7`
  with `1` expected skip, and visual matrix
  `codex-thermal-phase-stage-task-20260614` `3/3` with two captured frames per
  scenario.
- Added Worker-retained thermo input for the mechanics Worker lane. WebGPU
  P2G/G2P now borrow a lane-owned thermo buffer through `sphParticleUpload`
  instead of independently uploading thermo per stage. The Worker seeds that
  buffer once from the CPU mirror when no thermo source exists and exposes a
  generic adoption hook for future thermal/reaction `thermoBuffer` outputs.
  Browser validation asserts `applied-worker-retained-thermo-input` for P2G and
  G2P on both the first Worker no-full WebGPU chain and the retained
  continuation. Validation passed syntax checks, `git diff --check`, Worker
  unit `1/1`, focused PeerCompute/ULG integration `11/11`, focused browser
  authority-host Playwright `1/1`, physics atomics `7` with `1` expected skip,
  and visual matrix `codex-worker-retained-thermo-input-20260614` `3/3` with
  two captured frames per scenario.
- Added the first Worker-retained mechanics continuation input path. After an
  admitted no-full WebGPU Worker mechanics publication, the focused browser
  gate keeps the Worker runner warm and runs a second same-lane mechanics stage
  chain with `gpuHubResidentStageWorkerUseRetainedInput=true`. The Worker-side
  P2G stage reuses the prior G2P state/mechanics buffers from its lane record,
  reports `applied-worker-retained-g2p-input`, keeps P2G/grid-update/G2P on
  WebGPU with satisfied fences, and republishes a retained mechanics
  descriptor. Thermo is still uploaded from the CPU mirror into a retained
  Worker buffer, so thermo/thermal/phase residency is the next copy-avoidance
  target. Validation passed syntax checks, `git diff --check`, Worker unit
  `1/1`, focused PeerCompute/ULG integration `11/11`, and focused browser
  authority-host Playwright `1/1`, physics atomics `7` with `1` expected skip,
  and visual matrix `codex-worker-retained-continuation-20260614` `3/3` with
  two captured frames per scenario.
- Added the first admitted worker-retained mechanics publication path. The
  browser authority host now exposes
  `publishWorkerRetainedMechanicsStageOutput()`, which stores a StateManager
  hot record containing the live Worker backend and worker-local retained refs,
  then commits a serializable warm delta with
  `peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0`. The
  focused browser gate passes this publisher into the Worker stage-chain run,
  keeps the Worker warm after committed publication, and asserts the hot
  record, warm delta, and
  `peercompute.ulg.mechanics-worker-retained-buffer-import.v0` descriptor.
  Validation passed syntax checks, Worker unit `1/1`, focused PeerCompute/ULG
  integration `11/11`, `git diff --check`, and focused browser authority-host
  Playwright `1/1`, physics atomics `7` with `1` expected skip, and visual
  matrix `codex-worker-retained-publication-20260614` `3/3` with two captured
  frames per scenario.
- Promoted the real browser Worker WebGPU mechanics stage-chain gate to
  `no-full-readback`. The Worker now waits on its own WebGPU queue for no-full
  stage messages before returning, so P2G, grid-update, and G2P report
  satisfied per-stage fences without full particle arrays. The stage-chain
  summary now publishes
  `peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0`,
  including worker-retained refs, no-full readback modes, WebGPU backends, and
  worker-ready residency. Actual hot-state publication remains fail-closed as
  `blocked-authorized-worker-publication-required` until the worker-to-
  NodeKernel/StateManager compact publication protocol exists. Validation
  passed syntax checks, Worker unit `1/1`, focused PeerCompute/ULG integration
  `11/11`, `git diff --check`, focused browser authority-host Playwright
  `1/1`, physics atomics `7` with `1` expected skip, and visual matrix
  `codex-worker-no-full-retained-candidate-20260614` `3/3` with two captured
  frames per scenario.
- Validated real browser Worker WebGPU mechanics stage execution. The focused
  authority-host Playwright gate now creates
  `host.createUlgMechanicsResidentStageWorkerRunner()`, requests
  `preferWebGpu=true`, and asserts the Worker path reports `worker-ready`
  with `webgpu` backends for P2G, grid-update, and G2P. This proves browser
  Worker WebGPU availability for the mechanics stage chain, but it is still
  not final copy-free publication: compact summaries and StateManager/
  NodeKernel-authorized hot-state publication out of the worker-retained lane
  remain next. Validation passed syntax checks for `tests/demo.e2e.mjs` and
  `src/services/ulgMechanicsResidentStage.worker.js`, plus the focused browser
  authority-host Playwright gate `1/1`.
- Added the checked-in ULG mechanics resident-stage Worker module. The browser
  authority host now exposes `createUlgMechanicsResidentStageWorkerRunner()`
  using PeerCompute's resident-stage Worker bridge, and the focused browser
  gate runs P2G, grid-update, and G2P through the real Worker module with all
  three stages reporting `worker-ready`. The module retains raw stage outputs
  in a worker-local lane store and returns clone-safe values/summaries to the
  main thread. This is still the CPU/reference Worker path unless WebGPU is
  explicitly validated in-worker; worker-owned WebGPU device/buffer retention
  remains the next promotion. Validation passed syntax checks, worker unit
  `1/1`, focused cross-repo integration `11/11`, focused browser
  authority-host Playwright `1/1`, physics atomics `7` with `1` expected skip,
  and visual matrix `codex-ulg-mechanics-resident-stage-worker-module-20260614`
  `3/3` with two captured frames per scenario.
- Added the ULG-side worker-ready seam for mechanics stage-chain execution.
  `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()` now
  accepts a supplied GPUHub resident-stage worker runner/policy/module URL and
  wraps the runner so P2G, grid-update, and G2P returned worker values populate
  the normal stage-result evidence. Focused integration now proves a supplied
  backend reports `worker-ready` for all three stages while preserving
  `gpu-hub-resident-stage-executor` sources, backend summaries, and satisfied
  fences. Default browser/live behavior remains `blocked-worker-backend-missing`
  until the actual worker-owned WebGPU module exists. Validation passed syntax
  checks, focused cross-repo integration `11/11`, focused browser
  authority-host Playwright `1/1`, physics atomics `7` with `1` expected skip,
  and visual matrix `codex-gpuhub-worker-ready-runner-seam-20260614` `3/3`
  with two captured frames per scenario.
- Added ULG-facing worker-residency policy evidence for the mechanics stage
  chain. P2G, grid-update, and G2P GPUHub stage registrations now request
  dedicated worker residency while PeerCompute reports
  `peercompute.gpu.resident-stage-worker-policy.v0` per stage. Because no
  worker-owned WebGPU device/buffer backend exists yet, focused Node and
  browser gates assert the truthful fallback status
  `blocked-worker-backend-missing` for all three stages. The stage-chain
  evidence now exposes worker-residency objects, status maps, and requested
  worker-residency flags. Validation passed syntax checks, focused cross-repo
  integration `11/11`, focused browser authority-host Playwright `1/1`,
  physics atomics `7` with `1` expected skip, and visual matrix
  `codex-gpuhub-worker-policy-evidence-20260614` `3/3` with two captured
  frames per scenario.
- Routed ULG mechanics stage-chain execution through the PeerCompute/GPUHub
  resident stage executor registry. The helper registers P2G, grid-update, and
  G2P handlers on the ComputeManager-attached GPUHub, then runs
  `executeGpuResidentLaneStagePlan()` without direct stage callbacks so
  `GpuResidentLaneManager` resolves the stages via
  `gpu-hub-resident-stage-executor`. Direct browser authority-host
  construction now passes the same GPUHub into ComputeManager, and sibling
  PeerCompute now passes the NodeKernel-owned GPUHub into ComputeManager.
  Focused Node and browser gates prove all three mechanics stages use GPUHub
  executor sources while preserving WebGPU backends, `gpu-lane` residency,
  same parent lane/state keys, completed stage-plan execution, and satisfied
  fences. Validation passed syntax checks, focused cross-repo integration
  `11/11`, focused browser authority-host Playwright `1/1`, physics atomics
  `7` with `1` expected skip, and visual matrix
  `codex-gpuhub-stage-executor-chain-20260614` `3/3` with two captured frames
  per scenario. Newly reported major z-buffer/draw-order issues are noted as a
  deferred renderer blocker, not fixed in this slice.
- Added browser authority-host validation for the same-lane WebGPU mechanics
  stage chain. The focused Playwright test now calls
  `host.runMechanicsStageTaskChain()` with `preferWebGpu=true`,
  `useNativeTaskGraph=false`, a shared scene `deviceResult`, and explicit
  parent lane id/state key. It proves P2G, grid-update, and G2P report
  `webgpu` backend, `gpu-lane` residency, the same parent lane/state key,
  completed stage-plan execution, and satisfied fences. This validates
  browser inline ComputeManager authority, not yet separate GPUHub worker
  residency. Validation passed syntax, the focused browser authority-host
  test, physics atomics `7` with `1` expected skip, and visual matrix
  `codex-browser-same-lane-webgpu-stage-chain-20260614` `3/3` with two
  captured frames per scenario.
- Aligned WebGPU-requested mechanics child stage tasks to the parent
  ComputeManager lane executor. When the lane executor submits P2G,
  grid-update, and G2P with `preferWebGpu=true`, all three child task
  descriptors now use the parent lane id/state key, stay inline for WebGPU
  object safety, preserve supplied device context, and publish per-stage lane,
  backend, residency, and fence summaries on `mechanicsStageTaskChain`.
  Focused integration now proves all three child tasks are `gpu-lane`
  residents under the same parent lane and report satisfied fences. This is a
  lane-identity and authority invariant, not yet full browser GPUHub worker
  execution. Validation passed syntax checks, focused cross-repo integration
  `11/11`, physics atomics `7` with `1` expected skip, and visual matrix
  `codex-same-lane-stage-webgpu-request-20260614` `3/3` with two captured
  frames per scenario.
- Extended the ULG mechanics stage-plan path so the lane executor can submit
  the actual P2G, grid-update, and G2P ComputeManager stage tasks when the
  native task graph is disabled. Stage handlers run inside
  `executeGpuResidentLaneStagePlan()`, populate the stage-result cache, and
  the mechanics-only step consumes those lane-produced outputs without
  duplicate execution. This is still non-authoritative and default-off for
  state mutation, but it moves the mechanics stage-task chain behind the
  PeerCompute lane executor boundary instead of only annotating existing graph
  results. Validation passed syntax checks, focused cross-repo integration
  `11/11`, physics atomics `7` with `1` expected skip, and visual matrix
  `codex-mechanics-stage-task-lane-executor-20260614` `3/3` with two captured
  frames per scenario.
- Wired the existing ULG mechanics P2G -> grid-update -> G2P stage-chain
  helper to the PeerCompute GPU resident lane stage-plan boundary as
  non-authoritative evidence. The helper now builds
  `peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0`, acquires a
  `ComputeManager` GPU resident lane lease, runs
  `executeGpuResidentLaneStagePlan()` against the native CPU-oracle stage
  graph results, completes the lane fence, and records the stage-plan schema,
  contract schema, execution schema/status, completed stage count, execution
  order, and fence evidence on `mechanicsStageTaskChain` and the split-path
  summary. Validation passed syntax checks, focused cross-repo PeerCompute
  integration `11/11`, physics atomics `7` with `1` expected skip, and visual
  matrix `codex-mechanics-stage-lane-plan-20260614` `3/3` with two captured
  frames per scenario.
- Added the first PeerCompute-side resident lane stage-plan executor boundary
  for the ULG sequence contract. Sibling PeerCompute now preserves
  `residentSequenceLaneContract` through `ComputeManager` normalization,
  stores it on `GpuResidentLaneManager` leases, derives
  `peercompute.compute.gpu-resident-lane-stage-plan.v0`, exposes
  `executeGpuResidentLaneStagePlan()`/`executeStagePlan()` for supplied stage
  handlers, and returns the stage plan in the GPU lane execution envelope.
  ULG's cross-repo integration now asserts its
  `peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0` reaches that
  execution envelope with `defaultEnabled=false`. Validation passed
  PeerCompute lane manager `6/6`, core ComputeManager `2/2`, ComputeManager
  commit-delta `19/19`, ULG focused PeerCompute integration `11/11`, physics
  atomics `7` with `1` expected skip, and visual matrix
  `codex-lane-stage-plan-executor-20260614` `3/3` with two captured frames
  per scenario.
- Added a metadata-only resident sequence lane contract for ComputeManager/
  GPUHub promotion review. Resident steps tasks now carry
  `peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0` through the law
  graph node, WebGPU descriptor, GPU resident lane descriptor, task data,
  solver-registry input, compute-task result, and StateManager commit-delta
  payload. The contract declares the lane-owned mechanics P2G -> grid update
  -> G2P -> compact-summary pass DAG, retained buffers, read/write families,
  queue-fence policy, single-owner rules, and active-grid dispatch policy.
  It reports a runnable fused sequence only when the no-full/final-only fused
  sequence requirements are met, and it keeps `defaultEnabled=false` so no
  default behavior changes. Focused resident task tests passed `32/32`,
  focused PeerCompute/ULG GPU-lane integration passed `11/11`, physics
  atomics passed `7` with `1` expected skip, and visual matrix
  `codex-resident-sequence-lane-contract-20260614` passed `3/3` with two
  captured frames per scenario.
- Wired the mounted scene and browser probe to exercise the opt-in active-grid
  fused resident mechanics sequence. URLs can request
  `residentFuseSequence=1`, `residentActiveGrid=1`, and optional
  `residentActiveGridSafety=<cells>`; active-grid implies the fused sequence
  in the mounted scheduler. The scene resident signature, direct WebGPU path,
  and ComputeManager resident task options all carry the policy, and overlay
  status now reports both the requested policy and active-grid stage timing.
  The scene probe now preserves fused sequence stage timing in sampled metrics
  so analysis reports active-grid node counts. Evidence:
  `/tmp/ulg-history-probes/current-scene-active-grid-optin-frames-20260614.json`
  classified `good` with `16` no-full mounted scene substeps,
  `activeGridDispatch=2744/13824`, compact-summary `mapAsync` about
  `2.57 s`, J about `0.99999..1.00299`, max speed about `0.107 m/s`, pressure
  impulse `0`, and two captured frames in
  `/tmp/ulg-history-probes/scene-active-grid-frames-20260614`. This is a
  scene wiring/performance gate, not liquid-quality acceptance.
- Added an opt-in active-grid variant for the fused no-full resident mechanics
  sequence. The path is gated by `fuseNoFullResidentMechanicsActiveGrid` and
  `ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1`; it keeps the canonical full-grid
  buffer layout, maps active local node indices back to full grid rows, clears
  inactive grid rows before G2P can sample them, and falls back to full-grid
  dispatch when no trustworthy position bounds exist. Focused resident tests
  now cover the active path and prove it dispatches fewer P2G/grid-update
  workgroups for a one-particle fixture. Browser evidence:
  `/tmp/ulg-history-probes/current-fused-sequence-active-grid-mechanics-64-20260614.json`
  classified `good` with `activeNodeCount=2352/13824`, J about
  `0.99999..1.0214`, max speed about `0.299 m/s`, and compact-summary
  `mapAsync` about `3.02 s`. The matched full-grid fused sequence probe
  `/tmp/ulg-history-probes/current-fused-sequence-full-grid-mechanics-64-20260614.json`
  stayed `good` but waited about `13.44 s`, so active-grid dispatch is the
  confirmed hot-loop performance lever. A `2x64` active-grid probe
  `/tmp/ulg-history-probes/current-fused-sequence-active-grid-mechanics-2x64-20260614.json`
  stayed `good`; batch two used `boundsSource=resident-position-bounds`, so
  stale CPU mirrors do not drive active scoping after WebGPU owns the state.
  Validation also passed focused resident tests, `npm run test:physics-atomics`
  with `7` pass and `1` expected skip, targeted visual matrix
  `2026-06-15T02-16-21-304Z` with `failedCount=0`, and captured-frame visual
  matrix `2026-06-15T02-19-48-541Z` with `failedCount=0` and `3` frames each
  for H2O/H2O MLS-MPM and solid H2O CPU-SPH. Remaining work: keep the path
  opt-in until scene-paired resident validation, ComputeManager/GPU-lane
  ownership, and broader law-family interactions are wired.
- Threaded the active-grid request into the ComputeManager resident-steps task
  descriptor surface as metadata-only authority plumbing. Resident steps tasks
  now publish `peercompute.ulg.mls-mpm-active-grid-dispatch-policy.v0` on the
  law graph node, `webgpu` descriptor, GPU resident lane descriptor, task data,
  solver-registry input, and compute-task result. The policy distinguishes
  `requested` from `enabled`; it only enables active-grid when the fused
  resident sequence wrapper is also requested, and declares the no-full,
  final-only, trustworthy-bounds, clear-before-G2P, and full-grid-layout
  constraints needed for placement review. Focused resident task tests passed
  `32/32`.
- Added an opt-in fused no-full resident mechanics path that records P2G,
  grid-update, and G2P into one WebGPU command submission for a single
  substep. The first browser probe found and fixed the crash
  (`stateBufferByteLength`/`mechanicsBufferByteLength` local-name mismatch),
  then `/tmp/ulg-history-probes/current-fused-mechanics-64-20260614.json`
  classified `good` for the mechanics-only `64`-substep H2O/H2O direct-
  resident sanity gate. However, it did not improve the real bottleneck:
  the final compact-summary `mapAsync` still waited about `13.93 s`, while the
  fused mechanics CPU submission stage was only about `0.3 ms`. The fused path
  is therefore gated behind `fuseNoFullResidentMechanics` instead of becoming
  default. The default path was rechecked with
  `/tmp/ulg-history-probes/current-default-mechanics-64-after-fused-gate-20260614.json`
  and stayed `good`, with `fusedMechanics=0`, no issues, J about
  `0.99999..1.0214`, max speed about `0.299 m/s`, and compact-summary
  `mapAsync` about `13.52 s`. A follow-up opt-in sequence path then recorded
  all `64` mechanics-only substeps in one command submission and
  `/tmp/ulg-history-probes/current-fused-sequence-mechanics-64-20260614.json`
  still classified `good`, but compact-summary `mapAsync` still waited about
  `13.62 s` while sequence encode took only about `5.4 ms`. Current
  interpretation: command-submission count is not the dominant bottleneck. The
  P0 performance path is sparse/tiled/active-grid P2G and grid-update work
  under a ComputeManager/GPU-lane sequence, because the current gather kernels
  still do full-grid work every substep.
- Added compact-summary fence attribution telemetry and probe browser launch
  controls. Resident summary execution now reports internal setup/encode/
  submit/`mapAsync`/decode timings and the probe analysis reports
  compact-summary map-wait share separately from coarse compact-summary wall
  time. A `64`-substep direct-resident H2O/H2O probe shows about `14.49 s` of
  `mapAsync` wait for a `336` byte summary row; system Chrome/Vulkan stays
  about the same; thermal/reaction-off mechanics-only stays about `13.50 s`.
  Current interpretation: the summary readback fence is draining queued
  resident mechanics command buffers. The tested single-substep and
  multi-substep fused command paths are not enough, so remaining P0 is a
  sparse/tiled resident mechanics lane under ComputeManager/GPU authority that
  reduces full-grid gather work before optimizing command-submission cadence.
- Promoted the long-horizon H2O/H2O settle evidence from CPU/reference-only to
  direct-resident no-full telemetry. The
  `/tmp/ulg-history-probes/current-liquid-settle-direct-resident-nofull-2048-20260614.json`
  probe classified `good`: `2048` no-full direct-resident substeps reached
  about `1.024 s`, final drop max speed was about `0.1935 m/s`, support gap
  ended near `-0.1079 m`, J stayed around `0.9500..1.0490`, and pressure
  impulse stayed `0`. Remaining P0: the same batch took about `431.4 s`, with
  compact summary about `342.7 s`, and a browser scene/MarchingCubes visual
  settle gate still needs to run cheaply enough for routine validation.
- Clarified and revalidated the opt-in H2O/H2O long-horizon CPU/reference
  liquid acceptance gate. `npm run test:physics-liquid-atomic` now passes
  `8/8`; the 1.024 s CPU-driver fixture remains merged, keeps J around
  `1.046..1.049`, and damps final drop speed to about `0.196 m/s` against the
  `0.25 m/s` threshold. The test name and skip text now reflect that it is an
  opt-in acceptance gate, not a known-failing gate.
- Wired live mounted resident ComputeManager outputs to the same-device
  hot-buffer source publication surface. `sphPhaseDemoMount` now passes the
  active resident authority host into `refreshMlsMpmResidentSteps`, and the
  scene publishes only after ComputeManager ownership, accepted StateManager
  warm-delta admission, and real WebGPU SPH/MLS-MPM upload handles are present.
  The execution now reports `sameDeviceHotBufferSourcePublication` and
  `sameDeviceRetainedBufferImport`; the source record in StateManager hot
  storage owns the actual same-device handles. The retained import is also
  bridged onto the final G2P reconstruction metadata, so compact candidate
  builders can discover the live producer source without a hand-written
  descriptor. Validation passed: syntax checks, mounted remote-refresh unit
  `4/4`, focused browser authority-host and auto-scheduler gates `2 passed`,
  focused PeerCompute/ULG integration `11/11`, physics atomics `7` pass with
  `1` expected skip, `git diff --check`, and visual matrix
  `codex-live-source-g2p-bridge-20260614` with
  `failedCount=0` for five representative scenarios. Remaining architecture:
  feed these descriptors from admitted compact worker-stage outputs and keep
  cross-device retained refs metadata-only.
- Added a same-device hot-buffer source publication surface for compact
  candidate copy avoidance. The resident authority host now exposes
  `host.publishSameDeviceHotBufferSource()`, which stores local same-device
  SPH state, SPH thermo, and MLS-MPM mechanics upload handles in StateManager
  hot storage and returns a serializable same-device retained-buffer import
  descriptor. The host summary reports
  `residentSameDeviceHotBufferSourcePublicationReady`. The focused
  PeerCompute/ULG integration now feeds compact same-device candidates from a
  published source record rather than from a hand-written descriptor, and the
  retained import aliases that source with no new fake GPU buffers or writes.
  Validation passed: syntax checks, focused integration `11/11`, mounted
  remote-refresh unit `4/4`, physics atomics `7` pass with `1` expected
  skip, and visual matrix `codex-same-device-source-publication-20260614` with
  `failedCount=0` for five representative scenarios. Remaining lane work:
  wire live ComputeManager/GPUHub worker-stage outputs to call this publication
  surface automatically when they already own same-device handles.
- Added explicit law-isolation coverage to the recurring visual sanity matrix.
  New labels exercise the browser URL law toggles for mechanics-off static,
  gravity-off static, pressure-off H2O, EOS-off H2O, thermal-off hot H2O, and
  reactions-off Na/H2O. The matrix can now forward scenario-local max speed,
  J bounds, static, and future liquid merge/settle thresholds into
  `scripts/sph-long-horizon-probe.mjs`.
  Validation passed: `node --check scripts/sph-visual-sanity-matrix.mjs`;
  `node scripts/sph-visual-sanity-matrix.mjs --list`; `npm run
  test:physics-atomics` with `7` pass and `1` expected long-horizon skip; and
  visual matrix `codex-law-isolation-matrix-20260614` with `failedCount=0`
  and three captured frames for all six law-isolation scenarios. Remaining
  physics work: this is harness coverage, not completion of liquid H2O
  settling/free-surface behavior or the all-reactions Na/H2O timeout.
- Added a non-refreshable compact mechanics-stage seed candidate for no-full
  remote G2P outputs. Full-readback mechanics G2P arrays still produce the
  transitional `stateSeedPayload`, but retained/no-full mechanics output now
  returns
  `peercompute.ulg.remote-task-graph-sph-mls-mpm-mechanics-stage-compact-seed.v0`
  with particle count, step/time, output buffer byte evidence, state families,
  retained refs, GPU-fence status, `admissionRequired=true`, and
  `localRefreshRequired=true`. It deliberately sets `stateSeedPayload=null`
  and `refreshableByDefault=false`, so the current NodeKernel hot-buffer
  refresh path cannot accidentally treat compact remote buffers as local
  authority. The refresh seed selector also blocks fallback when a caller
  explicitly requests `preferMechanicsStageSeed` but only the compact
  no-full candidate exists. The ULG submit wrapper now records the compact
  candidate through `NodeKernel.commitRemoteTaskGraphCompactCandidate()` and
  still returns a blocked hot-buffer refresh with no local buffer refs until a
  retained-lane local refresh executor exists. PeerCompute now also exposes
  `NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()`, which
  reads the admitted compact-candidate record, requires a local compact refresh
  executor, and only completes with executor-returned local refs. Blocked or
  no-ref executor results now reject the local lane instead of completing it.
  Compact mechanics candidates now carry
  `peercompute.ulg.remote-task-graph-compact-local-refresh-contract.v0`, which
  records required source families/buffers, remote retained refs, and accepted
  materialization modes before local refresh can proceed.
  The first materialization mode now exists:
  `peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0` can carry
  validated compact SPH state, SPH thermo, and MLS-MPM mechanics rows; ULG can
  upload those rows directly into local hot buffers and store the handles only
  in StateManager hot storage.
  The first zero-copy local materialization mode now also exists:
  `peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0`
  aliases an explicit same-device StateManager hot-buffer record, returns the
  existing local retained refs, and creates no new GPU buffers or writes.
  Remote retained refs remain metadata-only unless such a local source record
  already owns the handles. Mechanics G2P stage results can now carry that
  same-device source descriptor into the compact mechanics candidate; the
  candidate marks the local refresh contract as
  `same-device-local-source-ready`, includes the source hot-buffer key in the
  compact hash, and can be imported without the executor caller manually
  attaching the descriptor.
  ULG exposes `refreshRemoteCompactCandidateHotBuffers()`, can opt into
  `attemptCompactCandidateRefresh`, and now has a default compact executor
  contract that reports `blocked-compact-candidate-local-source-required`
  unless an explicit local source seed is attached. Validation passed: syntax
  checks; PeerCompute NodeKernel unit `7/7`; focused remote seed graph
  integration `11/11`, including compact no-full candidate admission, blocked
  compact refresh, compact snapshot upload into local hot buffers, and
  same-device retained-buffer import plus source-descriptor propagation; mounted
  remote-refresh unit `4/4`; physics atomics `6` pass with `1` expected
  long-horizon skip; and visual matrices
  `codex-compact-snapshot-materialization-20260614` and
  `codex-same-device-retained-import-20260614`, and
  `codex-same-device-source-descriptor-20260614`, each with `failedCount=0`
  and five frames each for H2O/H2O MLS-MPM, H2O/H2O CPU-SPH, solid H2O
  CPU-SPH, Fe/H2O contact, and hot H2O phase change. Separate open blocker:
  the default Na/H2O reaction-product visual scenario still times out.
- Added a CPU-SPH solid H2O phase and support gate for the reported ice-flow
  regression.
  Cold H2O solid particles are excluded from liquid pressure/density
  projection and use solid-group wall clamping, so base/drop internal pair
  distances stay fixed. The carrier now also resolves solid group support
  contact, so a solid H2O drop resting on a solid H2O base does not keep
  falling through it. The
  new invariant `plain SPH/PBF reference keeps solid H2O from flowing like
  liquid water` and the newer `plain SPH/PBF reference keeps solid H2O
  supported under gravity` invariant are part of `npm run test:physics-atomics`,
  which now passes `7` with `1` expected long-horizon skip. The fixed mounted
  CPU-SPH probe holds support gap near `1.83e-7 m`, drop COM delta `0`, max
  drop speed `0`, and two H2O visible surfaces. The recurring visual matrix
  now includes `solid-h2o-cpu-sph` with expected H2O surface count `2` plus a
  static/support guard. Remaining physics work: liquid H2O settling/free-
  surface behavior is still separate and open.
- Added an optional mechanics-stage seed candidate to the ULG remote seed graph.
  The graph can now emit
  `state-seed -> mechanics-p2g -> mechanics-grid-update -> mechanics-g2p ->
  mechanics-stage-state-seed -> resident-steps -> post-stage-state-seed`.
  `runUlgRemoteSphMlsMpmMechanicsStageSeedGraphNode()` consumes the G2P result
  through PeerCompute `resultInputs`, requires full-readback G2P state and
  mechanics arrays, preserves original thermo/phase rows, and emits
  `peercompute.ulg.remote-task-graph-sph-mls-mpm-mechanics-stage-seed-node.v0`.
  Default refresh still prefers the post-stage seed; `preferMechanicsStageSeed:
  true` explicitly refreshes from the candidate and records
  `refreshSeedPayloadSource: remote-mechanics-stage-state-seed-node`.
  Validation passed: syntax checks, focused ULG graph integration `11/11`,
  mounted remote-refresh unit `4/4`, physics atomics `5` pass with `1`
  expected long-horizon skip, visual matrix
  `codex-remote-mechanics-stage-seed-sequence-20260614` with
  `failedCount=0` and three frames per representative scenario, and ULG
  `git diff --check` clean; `npm run icc:update` refreshed
  `indexedFiles=235` and `memoryChunks=1249`. Remaining architecture: replace
  the full-readback mechanics candidate with compact admitted stage outputs and
  retained GPU lane refs before making it the default authority path.
- Added an optional static mechanics stage chain to the ULG remote seed graph.
  `buildUlgSphMlsMpmRemoteSeedTaskGraph()` can now emit
  `state-seed -> mechanics-p2g -> mechanics-grid-update -> mechanics-g2p ->
  resident-steps -> post-stage-state-seed`. The mechanics nodes wrap the
  existing ComputeManager-owned P2G, grid update, and G2P stage tasks, inject
  completed upstream stage results through PeerCompute `resultInputs`, and keep
  commit deltas suppressed. When this chain is enabled, the resident stage
  depends on G2P completion. Validation passed:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "remote seed graph builder"`
  with `11/11`; mounted remote-refresh unit `4/4`; PeerCompute task-graph
  regression `19/19`; PeerCompute NodeKernel `7/7`; GPU lane `5/5`; physics
  atomics `5` pass with `1` expected long-horizon skip; visual matrix
  `codex-remote-mechanics-stage-chain-sequence-20260614` with
  `failedCount=0` and three frames per representative scenario; ULG and
  PeerCompute `git diff --check` clean; `npm run icc:update` refreshed
  `indexedFiles=235` and `memoryChunks=1248`. Remaining architecture: make
  the stage-chain output become the
  compact admitted seed/retained-lane handoff instead of using the
  transitional full-readback post-stage seed.
- Added a post-stage seed node after the remote resident compute stage. ULG's
  remote graph builder can now emit seed -> resident compute -> post-stage
  seed. The post-stage node receives the resident task result through
  PeerCompute `resultInputs`, refuses stale no-full-readback mirrors, derives a
  compact SPH/MLS-MPM state seed from full-readback next particle/mechanics
  state, and the ULG host refresh wrapper prefers that post-stage seed for
  NodeKernel warm-state commit after the remote cache artifact is admitted.
  Sibling PeerCompute `ComputeManager.submitTaskGraph()` now supports
  serializable downstream result inputs, and `NodeKernel.commitRemoteTaskGraphStateSeed()`
  accepts a validated seed override only after the existing remote import
  policy passes. Validation passed:
  `node --check src/runtime/peercomputeBrowserResidentHost.js`,
  `node --check tests/peercomputeComputeManagerIntegration.test.mjs`, and
  `node --test tests/peercomputeComputeManagerIntegration.test.mjs --test-name-pattern "remote seed graph builder"`
  with `11/11`; PeerCompute task-graph regression
  `node --test tests/unit/computeManager.commitDelta.test.js --test-name-pattern "task graph"`
  with `19/19`; mounted prelude unit `4/4`; PeerCompute NodeKernel `7/7`;
  GPU lane `5/5`; physics atomics `5` pass with `1` expected long-horizon
  skip; visual matrix `codex-remote-post-stage-seed-sequence-20260614` with
  `failedCount=0` and three frames per representative scenario; ULG and
  PeerCompute `git diff --check` clean; `npm run icc:update` refreshed
  `indexedFiles=235` and `memoryChunks=1245`. Remaining architecture: replace
  the transitional full-readback post-stage seed with actual remote
  P2G/grid/G2P/thermal/reaction/pressure/render WebGPU worker stages under
  ComputeManager/GPUHub lane authority.
- Added an optional evidence-only resident compute stage to ULG's remote seed
  graph builder. `buildUlgSphMlsMpmRemoteSeedTaskGraph()` can now emit the
  serializable state-seed node followed by
  `ulg-sph-mls-mpm-resident-steps`, which wraps
  `createMlsMpmResidentStepsComputeTask()` with commit deltas suppressed and
  explicit evidence-only GPU-fence requirements for CPU-reference fallback.
  A real responder `ComputeManager` now executes both nodes, preserves the
  graph-level state seed in the result/cache artifact, and the requester
  still refreshes local SPH/MLS-MPM hot buffers only after NodeKernel/
  StateManager admission/import. Validation passed: mounted prelude unit
  `4/4`; PeerCompute NodeKernel `7/7`; GPU lane `5/5`; PeerCompute
  ComputeManager state-seed regression `18/18`; physics atomics `5` pass with
  `1` expected long-horizon skip; visual matrix
  `codex-remote-resident-stage-sequence-20260614` with `failedCount=0` and
  three frames per representative scenario; ULG and PeerCompute
  `git diff --check` clean.
- Added a real ULG remote seed graph envelope and PeerCompute seed-artifact
  propagation. Sibling PeerCompute `ComputeManager.submitTaskGraph()` now
  preserves graph-level `stateSeedPayload` in the result and cache artifact, so
  real responder-side task graphs can seed local hot-buffer refresh instead of
  relying on fake responders that manually inject the payload. ULG now exports
  `buildUlgSphMlsMpmRemoteSeedTaskGraph()` and
  `runUlgRemoteSphMlsMpmStateSeedGraphNode()` from
  `src/runtime/peercomputeBrowserResidentHost.js`. The builder creates a
  cache-admission-aware SPH/MLS-MPM remote seed graph with state-family
  metadata, retained-buffer refs, GPU lane hints, and a serializable module
  task. The mounted remote-refresh prelude now uses this builder by default
  when raw `driver.demo.state.particles` are available, and skips graph
  creation when only packed worker view state exists. Validation passed:
  PeerCompute ComputeManager regression `18/18`, ULG PeerCompute integration
  `11/11` including the real responder ComputeManager seed-node path,
  mounted prelude unit `4/4`, PeerCompute NodeKernel `7/7`, GPU lane `5/5`,
  physics atomics `5` pass with `1` expected long-horizon skip, visual matrix
  `codex-remote-seed-graph-builder-sequence-20260614` with `failedCount=0`
  and three frames per representative scenario. Remaining: promote the
  current evidence-only resident-stage node into validated state-seed
  production and then replace the local CPU-reference fallback with actual
  remote resident law DAG stages and WebGPU worker placement.
- Added a default-off mounted resident remote-refresh prelude. The SPH phase
  mount API now accepts `enableRemoteResidentTaskGraphRefresh`,
  `remoteResidentTaskGraph`, `remoteResidentTaskGraphFactory`, and
  `remoteResidentTaskGraphRefreshOptions`. When enabled, the mounted resident
  scheduler calls the authority host's
  `submitTaskGraphWithRemoteSeedHotBufferRefresh()` before the local resident
  step and records compact telemetry on
  `overlay.__sphRemoteResidentTaskGraphRefresh`; when disabled, no graph
  factory or authority wrapper is invoked. This is an opt-in bridge into the
  remote-seed hot-buffer refresh path, not a claim that the full mounted
  resident pass DAG is remote yet. Validation passed:
  `node --check src/visualization/sphPhaseDemoMount.js`,
  `node --check tests/sphPhaseDemoMountRemoteRefresh.test.mjs`, and
  `node --test tests/sphPhaseDemoMountRemoteRefresh.test.mjs` with `4/4`;
  `tests/peercomputeComputeManagerIntegration.test.mjs` still reports `10/10`;
  PeerCompute NodeKernel focused unit `7/7`; GPU resident lane manager unit
  `5/5`; `npm run test:physics-atomics` still reports `5` pass and `1`
  expected opt-in long-horizon skip; visual matrix run
  `codex-mounted-remote-prelude-sequence-20260614` reports `failedCount=0`
  and three frames for all four representative scenarios; ULG and PeerCompute
  `git diff --check` are clean. Remaining: build the actual mounted resident
  law DAG as a remote task graph and place those stages on PeerCompute WebGPU
  workers under ComputeManager/GPUHub authority.
- Added ULG's concrete SPH/MLS-MPM remote-seed hot-buffer refresh executor.
  `createUlgSphMlsMpmHotBufferRefreshExecutor()` now produces a NodeKernel-
  compatible local refresh executor, and
  `refreshUlgSphMlsMpmHotBuffersFromRemoteSeed()` rebuilds real SPH state,
  SPH thermo, and MLS-MPM mechanics WebGPU buffers from
  `peercompute.ulg.remote-task-graph-sph-mls-mpm-state-seed.v0`. The actual
  WebGPU buffer handles are stored only in StateManager hot storage; the
  NodeKernel refresh result receives serializable local retained-buffer refs
  and byte/schema evidence. The browser resident authority host now exposes
  `refreshRemoteSeedHotBuffers()`, which commits an admitted remote seed if
  needed and invokes the local ULG executor through NodeKernel; host summaries
  now report refresh readiness. The host also exposes
  `submitTaskGraphWithRemoteSeedHotBufferRefresh()`, an opt-in NodeKernel graph
  submit wrapper that auto-refreshes local hot buffers only after the remote
  cache artifact is admitted/imported; the focused test also proves
  `reaction-products` is blocked by the default SPH/MLS-MPM state-family
  policy with zero GPU uploads. Validation passed: ULG syntax checks, the full
  `tests/peercomputeComputeManagerIntegration.test.mjs` file `10/10`,
  PeerCompute NodeKernel focused unit `7/7`, GPU resident lane manager unit
  `5/5`, physics atomics with the expected long-horizon skip, and visual
  matrix run `codex-auto-refresh-trigger-sequence-20260614` with
  `failedCount=0` and three frames per scenario. The mounted scheduler now has
  a default-off caller-supplied prelude for that wrapper; full remote resident
  pass-DAG placement remains open.
- Added NodeKernel local hot-buffer refresh from committed remote seeds in
  sibling PeerCompute.
  `NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()` now emits
  `peercompute.nodekernel.remote-task-graph-hot-buffer-refresh.v0`, reads the
  StateManager warm seed, acquires a local ComputeManager GPU resident lane
  lease, invokes a local refresh executor with the compact seed payload,
  completes a local fence, and can commit a refresh delta. Remote retained refs
  remain seed metadata; only executor-returned local refs are retained on the
  local lane. Validation passed: PeerCompute NodeKernel focused unit `7/7`,
  GPU resident lane manager unit `5/5`, remote compute regression `8/8`,
  ComputeManager task-graph cache regression `17/17`, ULG focused integration
  `7/7`, physics atomics with the expected long-horizon skip, and visual
  matrix run `codex-hot-buffer-refresh-sequence-20260614` with
  `failedCount=0` and three frames per scenario. Remaining: connect ULG's real
  SPH/MLS-MPM resident buffer rebuild to this refresh hook.
- Added NodeKernel remote-import warm-state seed commits in sibling
  PeerCompute. `NodeKernel.commitRemoteTaskGraphStateSeed()` now emits
  `peercompute.nodekernel.remote-task-graph-state-seed-authority.v0` and
  commits an allowed imported remote graph result into StateManager warm state
  as a CPU-friendly delta. It requires the ComputeManager state-family policy
  to be ready, requires an allowed warm-state seed, and requires a compact
  state seed payload by default. Remote retained GPU refs remain nonlocal; the
  committed payload records `local-refresh-required` when local hot buffers
  must be rebuilt. Validation passed: PeerCompute NodeKernel focused unit
  `7/7`, remote compute regression `8/8`, ComputeManager task-graph cache
  regression `17/17`, ULG focused integration `7/7`, physics atomics with the
  expected long-horizon skip, and visual matrix run
  `codex-state-seed-commit-sequence-20260614` with `failedCount=0` and three
  frames per scenario. Remaining: implement actual local hot-buffer refresh
  execution from these warm seed records.
- Added remote-import state seed/hot-buffer policy reporting in sibling
  PeerCompute. `ComputeManager.evaluateRemoteTaskGraphStateSeedPolicy()` now
  emits `peercompute.compute.remote-task-graph-state-seed-policy.v0` for an
  admitted remote cache import. It requires an admitted remote import, checks
  declared state families against the caller's allowed-family policy, blocks
  disallowed families, and reports `local-refresh-required` when remote
  retained GPU refs exist but cannot be used as local WebGPU leases. Validation
  passed: PeerCompute NodeKernel focused unit `7/7`, remote compute regression
  `8/8`, ComputeManager task-graph cache regression `17/17`, ULG focused
  integration `7/7`, physics atomics with the expected long-horizon skip, and
  visual matrix run `codex-state-seed-policy-sequence-20260614` with
  `failedCount=0` and three frames per scenario. Remaining: implement actual
  local warm-state seed/hot-buffer refresh execution under NodeKernel/
  StateManager authority.
- Added admitted remote task-graph cache import in sibling PeerCompute.
  `ComputeManager.importRemoteTaskGraphCacheResult()` now records an explicitly
  admitted remote graph result as a local read-through cache entry with
  `peercompute.compute.remote-task-graph-cache-import.v0`. A later local graph
  submission with the same admitted cache key can return a cache hit. Remote
  GPU resident lane/buffer refs are retained as metadata-only nonlocal refs
  with `usableLocally=false`, so remote device state cannot masquerade as a
  local GPU lease. Validation passed: PeerCompute NodeKernel focused unit
  `7/7`, remote compute regression `8/8`, ComputeManager task-graph cache
  regression `17/17`, ULG focused integration `7/7`, and physics atomics with
  the expected long-horizon skip; the four-scenario dense visual subset also
  passed with `failedCount=0` and three frames per scenario. Remaining: define the retained-lane/
  state-family policy for when imported remote results may seed ULG local
  hot/warm resident state.
- Added remote task-graph cache-artifact admission preflight in sibling
  PeerCompute. Remote graph results that carry cache artifacts now report
  `peercompute.nodekernel.remote-task-graph-cache-artifact-preflight.v0`.
  Default status is `remote-cache-artifact-received-not-admitted`; an explicit
  `admitRemoteTaskGraphCacheArtifact` placement/graph option routes the
  artifact object through NodeKernel/StateManager admission and reports
  `admitted-through-node-kernel-state-manager`. Validation passed:
  PeerCompute NodeKernel focused unit `7/7`, remote compute regression `8/8`,
  ULG focused integration `7/7`, and physics atomics with the expected
  long-horizon skip. Remaining: use the admitted remote artifact records for
  actual distributed cache/result sharing plus retained GPU lane refs.
- Added the first NodeKernel remote task-graph transport hop in sibling
  PeerCompute. Non-advisory distributed graph placement still fails closed
  when no executor exists, but a graph with explicit `targetPeerIds` can now
  resolve a `network-task-graph:<peer>` executor, send `compute-task-graph`,
  execute on the responder's `ComputeManager.submitTaskGraph()`, and return
  `peercompute.nodekernel.remote-task-graph-placement-provenance.v0` without
  invoking requester-local graph execution. Validation passed: PeerCompute
  NodeKernel focused unit `6/6`, remote compute regression `8/8`, ULG focused
  integration `7/7`, physics atomics with the expected long-horizon skip, and
  the four-scenario dense visual subset with `failedCount=0` and three frames
  per scenario.
  Remaining: thread admitted artifact hashes, retained GPU lane refs,
  distributed cache/result sharing, and StateManager admission through the
  graph request/result path before moving resident ULG physics remote by
  default.
- Added a NodeKernel task-graph placement preflight guardrail in sibling
  PeerCompute. `NodeKernel.submitTaskGraph()` now records
  `peercompute.nodekernel.task-graph-placement-preflight.v0`, allows local and
  advisory distributed graph requests with explicit status, and rejects
  non-advisory distributed graph placement until a real distributed graph
  executor exists. ULG carries the preflight schema/status in the mechanics
  stage-chain artifact, and focused Node/browser tests prove
  `local-placement-accepted` on the current CPU-oracle mechanics graph.
  Validation passed: NodeKernel focused unit `5/5`, ULG focused integration
  `7/7`, browser authority `1/1`, and physics atomics with the expected
  long-horizon skip. Remaining: implement the actual distributed graph
  executor and rerun the dense visual subset after any physics/render-facing
  change.
- Routed the mechanics stage-chain native DAG through NodeKernel authority when
  a real kernel is available. PeerCompute now exposes
  `NodeKernel.submitTaskGraph()` with
  `peercompute.nodekernel.task-graph-authority.v0`, and ULG's
  `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()` prefers
  that wrapper before falling back to direct `ComputeManager.submitTaskGraph()`.
  The browser resident authority host passes its real NodeKernel into the
  mechanics stage-chain helper, so mounted authority tests now prove
  `node-kernel-submit-task-graph` rather than a scene-local graph submission.
  Validation passed: NodeKernel focused unit `3/3`, ULG focused integration
  `7/7`, browser authority `1/1`, physics atomics with the expected
  long-horizon skip, and the four-scenario dense visual subset with
  `failedCount=0` and three frames per scenario. Remaining: distributed graph
  placement/execution across peers using admitted hashes and retained GPU lane
  refs.
- Landed the first StateManager/NodeKernel cache artifact authority slice in
  sibling PeerCompute and proved it from ULG. `StateManager` now records
  admitted and invalidated task-graph cache artifacts in CRDT-backed authority
  records, `NodeKernel` exposes admission/invalidation as the public authority
  facade, and `ComputeManager` only marks local read-through artifacts usable
  after receiving that authority record. ULG's mechanics P2G -> grid-update ->
  G2P native stage DAG now moves its record-only cache artifact through
  NodeKernel/StateManager admission and invalidation in the focused integration
  test. Focused PeerCompute units passed `25/25`; the focused ULG
  PeerCompute integration gate passed `7/7`; the browser authority gate passed
  `1/1`; physics atomics passed with the expected long-horizon skip; and the
  four-scenario dense visual subset passed with `failedCount=0` and three
  frames per scenario. Remaining: distributed graph placement/execution using
  admitted artifact hashes and retained GPU lane refs, plus the known Na/H2O
  visual timeout and long-horizon liquid-quality gates.
- Added first-class graph cache artifacts and admission metadata to sibling
  PeerCompute `ComputeManager.submitTaskGraph()`. Content-addressed graph
  cache writes now produce `peercompute.compute.task-graph-cache-artifact.v0`
  with result hash, input hash, invalidation refs, result node schemas, and
  `peercompute.compute.task-graph-cache-admission.v0`. Read-through requires
  an admitted artifact by default; ULG mechanics stage-chain artifacts are
  deliberately `recorded-not-admitted`, so no physics output is replayed yet.
  ULG records artifact schema/status/admitted/result-hash evidence in
  `peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0`, and the real
  browser authority host exposes the same fields. Syntax, focused Node and
  browser authority gates, physics atomics, PeerCompute focused units, and the
  four-scenario dense visual matrix all pass. Remaining: wire admitted
  cache artifacts into StateManager/NodeKernel invalidation and distributed
  graph placement/execution.
- Added content-addressed graph cache input evidence to sibling PeerCompute
  `ComputeManager.submitTaskGraph()`. A graph can now declare state refs,
  closure refs, law ids, invalidation refs, retained-buffer refs, units, and
  stage node cache inputs; the manager normalizes those inputs, hashes the
  material into `peercompute.compute.task-graph-cache-inputs.v0`, and derives
  the local cache key when no explicit key is supplied. ULG's mechanics
  P2G -> grid-update -> G2P stage-chain helper now supplies those inputs from
  the CPU-oracle mechanics law graph and records key source, input hash, input
  schema, key, and cache status in
  `peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0`. The cache remains
  record-only for physics outputs until admission/invalidation is stronger.
  Syntax checks, focused ULG Node and browser authority gates, physics atomics,
  PeerCompute focused units, and the four-scenario dense visual matrix all
  pass. Remaining: promote these cache input hashes into shared closure/state
  cache artifacts and use them for distributed graph placement/execution.
- Extended sibling PeerCompute `ComputeManager.submitTaskGraph()` with
  graph-level lifecycle metadata for cache policy, placement policy,
  cooperative cancellation, active-graph inspection, stats, and optional
  graph-wide GPU resident lane leases. ULG now passes record-only CPU-oracle
  cache metadata and local ComputeManager placement intent into the mechanics
  P2G -> grid-update -> G2P graph, and records cache/placement/cancellation
  and lease status in `peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0`.
  The focused Node gate proves lifecycle metadata on the real mechanics DAG,
  including a graph-wide GPU lane lease on the direct native DAG. The browser
  authority gate verifies the same stage-chain lifecycle fields from the real
  mounted authority host. Syntax, Node, browser, and physics atomics pass.
  The full five-scenario visual matrix still times out on the known
  Na/H2O reaction-product scenario; the four representative non-Na scenarios
  passed with three captured frames each. Remaining: make graph cache keys
  content-addressed, add distributed graph placement/execution, and keep the
  Na/H2O reaction visual timeout as a P0 reaction/closure harness blocker.
- Added native PeerCompute `ComputeManager.submitTaskGraph()` support in the
  sibling PeerCompute checkout and proved it from ULG with the mechanics
  P2G -> grid-update -> G2P stage DAG. The API records
  `peercompute.compute.task-graph-result.v0`, validates dependency edges,
  executes ready nodes in dependency batches, passes completed upstream results
  into downstream task factories, and returns per-node reports plus results.
  ULG now gates the native graph by submitting the three mechanics stage tasks
  through `submitTaskGraph()` and asserting all stage-task evidence artifacts
  pass. The ULG mechanics stage-chain helper consumes this native graph path
  directly for CPU-oracle/no-upload requests, and the browser authority gate
  now executes `runMechanicsStageTaskChain()` successfully. Syntax checks
  passed for PeerCompute `ComputeManager.js` and ULG tests, the focused ULG
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix
  classified both scenarios as `good` with two captured frames each.
  Remaining: add graph-level leases, cancellation, cache keys, placement, and
  distributed execution semantics.
- Added a first-class ULG mechanics stage-chain helper:
  `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()`. It
  runs one mechanics-only split step while submitting P2G, grid update, and
  G2P through the active ComputeManager stage tasks, records
  `peercompute.ulg.mls-mpm-mechanics-stage-task-chain.v0`, keeps the child law
  non-authoritative, and uses native PeerCompute task graphs for the
  CPU-oracle/no-upload path. The browser resident authority
  host now exposes `runMechanicsStageTaskChain()` and reports
  `residentMechanicsStageTaskChainReady`. Syntax checks passed, the focused
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix
  classified both scenarios as `good` with two captured frames each.
  Remaining: extend native graph scheduling with explicit leases, placement,
  cancellation, caching, and distributed execution.
- Added the mechanics-only split-step replacement seam for
  ComputeManager-owned stage task. `runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu()`
  now accepts optional whole-stage runners for P2G, grid update, and G2P while
  defaulting to the existing raw kernel entrypoints. Focused integration
  coverage now proves P2G-only replacement, P2G+grid-update replacement, and
  full P2G+grid-update+G2P replacement through
  `ulg-mls-mpm-mechanics-{p2g,grid-update,g2p}-stage` tasks. The split-path
  evidence records `stageTaskBoundaries` plus each
  `peercompute.ulg.mechanics-*-stage-task-evidence.v0` artifact without
  making the mechanics child law authoritative. Syntax checks passed, the
  focused ComputeManager
  integration file passed `7/7`, the real browser authority Playwright gate
  passed `1/1`, physics atomics passed with the expected long-horizon skip,
  and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix classified both
  scenarios as `good` with two captured frames each. Remaining: promote the
  hook-based replacement seam into a first-class ComputeManager/NodeKernel
  stage-chain scheduler with manager-owned dependencies, leases, cancellation,
  caching, placement, and eventual distributed execution.
- Added the third ComputeManager-owned mechanics sub-stage task:
  `ulg-mls-mpm-mechanics-g2p-stage`. The task surface
  `createMlsMpmMechanicsG2pStageComputeTask()` /
  `runMlsMpmMechanicsG2pStageComputeTask()` wraps the existing G2P kernel
  entrypoint, consumes the transient grid-update artifact, suppresses internal
  pressure-interface impulses for the mechanics-only path, returns candidate
  particle state plus MLS-MPM mechanics output, suppresses commit deltas, and
  emits `peercompute.ulg.mechanics-g2p-stage-task-evidence.v0`. The browser
  resident authority host now exposes `submitMechanicsG2pStageTask()` through
  its real ComputeManager. Syntax checks passed, the focused ComputeManager
  integration file passed `7/7`, the real browser authority Playwright gate
  passed `1/1`, physics atomics passed with the expected long-horizon skip,
  and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix classified both
  scenarios as `good` with three captured frames each. Remaining: wire
  P2G/grid-update/G2P stage replacement into the mechanics child path under
  CPU oracle, StateManager admission, GPU fence/lease evidence, and visual
  sanity. This is architecture boundary progress, not final long-horizon
  liquid-settling validation.
- Added the second ComputeManager-owned mechanics sub-stage task:
  `ulg-mls-mpm-mechanics-grid-update-stage`. The task surface
  `createMlsMpmMechanicsGridUpdateStageComputeTask()` /
  `runMlsMpmMechanicsGridUpdateStageComputeTask()` wraps the existing grid
  update kernel entrypoint, consumes transient P2G grid state, suppresses
  pressure-interface rows for the mechanics-only path, writes only transient
  updated grid state, suppresses commit deltas, and emits
  `peercompute.ulg.mechanics-grid-update-stage-task-evidence.v0`. The browser
  resident authority host now exposes `submitMechanicsGridUpdateStageTask()`
  through its real ComputeManager. Syntax checks passed, the focused
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix
  classified both scenarios as `good` with two captured frames each.
  Remaining: add the matching G2P stage task, then wire stage replacement into
  the mechanics child path under CPU oracle and visual sanity.
- Added the first ComputeManager-owned mechanics sub-stage task:
  `ulg-mls-mpm-mechanics-p2g-stage`. The new task surface
  `createMlsMpmMechanicsP2gStageComputeTask()` /
  `runMlsMpmMechanicsP2gStageComputeTask()` wraps the existing P2G kernel
  entrypoint without changing solver math, suppresses pressure/product inputs
  for the mechanics-only path, writes only transient `mls-mpm-grid`, suppresses
  commit deltas, and emits
  `peercompute.ulg.mechanics-p2g-stage-task-evidence.v0`. CPU-oracle P2G
  stage tasks remain valid without a GPU fence; WebGPU/no-full-readback paths
  declare a GPU-lane/fence requirement. The browser resident authority host now
  exposes `submitMechanicsP2gStageTask()` through its real ComputeManager.
  Syntax checks passed, the focused ComputeManager integration file passed
  `7/7`, the real browser authority Playwright gate passed `1/1`, physics
  atomics passed with the expected long-horizon skip, and the short H2O/H2O
  MLS-MPM plus CPU-SPH visual matrix classified both scenarios as `good` with
  two captured frames each. Remaining: use this P2G stage task as the pattern
  for grid-update and G2P stage tasks, then wire stage replacement into the
  mechanics child path under CPU oracle and visual sanity.
- Split G2P out as its own mechanics child stage evidence artifact, completing
  individually named evidence gates for P2G, grid update, and G2P under the
  current mechanics child task. Mechanics-only child task results now emit
  `peercompute.ulg.mechanics-child-g2p-stage-evidence.v0` top-level and under
  `perStageEvidence.g2p`. The artifact proves G2P executed through the
  explicit mechanics-only split path, used an accepted backend, suppressed
  pressure-interface forces, read transient MLS-MPM grid state, wrote only
  particle state plus MLS-MPM mechanics, and remains
  `stage-evidence-only-not-authoritative`. Mechanics promotion admission now
  requires `mechanics-child-g2p-stage-evidence`; child dry-run and promotion
  evidence validate and record it before mechanics can become an admitted law
  owner. Syntax checks passed for the touched runtime and tests, the focused
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix
  classified both scenarios as `good` with two captured frames each.
  Remaining: use the now-complete P2G/grid-update/G2P evidence set to replace
  one mechanics kernel at a time under the CPU oracle, StateManager admission,
  GPU fence/lease evidence, and visual sanity.
- Split grid update out as its own mechanics child stage evidence artifact.
  Mechanics-only child task results now emit
  `peercompute.ulg.mechanics-child-grid-update-stage-evidence.v0` top-level
  and under `perStageEvidence.gridUpdate`, alongside P2G and the broad stage
  kernel envelope. The artifact proves grid update executed through the
  explicit mechanics-only split path, used an accepted backend, suppressed
  pressure-interface forces, touched only transient MLS-MPM grid state, and
  remains `stage-evidence-only-not-authoritative`. Mechanics promotion
  admission now requires `mechanics-child-grid-update-stage-evidence`; child
  dry-run and promotion evidence validate and record it before mechanics can
  become an admitted law owner. Syntax checks passed for the touched runtime
  and tests, the focused ComputeManager integration file passed `7/7`, the
  real browser authority Playwright gate passed `1/1`, physics atomics passed
  with the expected long-horizon skip, and the short H2O/H2O MLS-MPM plus
  CPU-SPH visual matrix classified both scenarios as `good` with two captured
  frames each. Remaining: add the same individually named gate for G2P before
  replacing any mechanics kernel.
- Split P2G out as its own mechanics child stage evidence artifact under the
  architecture-first promotion path. Mechanics-only child task results now emit
  both `peercompute.ulg.mechanics-child-stage-kernel-evidence.v0` and
  `peercompute.ulg.mechanics-child-p2g-stage-evidence.v0`; the P2G artifact is
  exposed top-level and nested under `perStageEvidence.p2g`. It proves the P2G
  stage executed through the explicit mechanics-only split path, used an
  accepted backend, suppressed pressure-interface forces, wrote only transient
  MLS-MPM grid state, and remains
  `stage-evidence-only-not-authoritative`. Mechanics promotion admission now
  requires `mechanics-child-p2g-stage-evidence`; child dry-run and promotion
  evidence validate and record it before mechanics can become an admitted law
  owner. Syntax checks passed for the touched runtime and tests, the focused
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix
  classified both scenarios as `good` with two captured frames each.
  Remaining: repeat the same per-stage evidence pattern for grid update and
  G2P before replacing any mechanics kernel.
- Added stage-level mechanics child kernel evidence under the required
  ComputeManager task envelope. Mechanics-only child task results now emit
  `peercompute.ulg.mechanics-child-stage-kernel-evidence.v0`, proving P2G,
  grid update, and G2P ran in order, forbidden thermal/reaction/mechanics
  refresh stages stayed skipped, pressure-interface impulses stayed
  suppressed, and writes remained limited to particle state plus mechanics.
  The mechanics law-family admission contract now also requires
  `mechanics-child-stage-kernel-evidence`; child dry-run and promotion
  evidence validate and record that artifact. Syntax checks passed, the
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix
  classified both scenarios as `good` with two captured frames each.
  Diff hygiene passed and ICC was refreshed. Remaining: use this per-stage
  evidence to replace or promote P2G, grid update, and G2P one at a time
  against the CPU oracle.
- Made the mechanics-only child task envelope a required promotion artifact.
  The mechanics law-family admission contract now requires
  `mechanics-only-child-task-envelope` in addition to
  `mechanics-child-dry-run-parity`. `runUlgMechanicsChildDryRunTask()`
  validates a `peercompute.ulg.mechanics-only-child-task-envelope.v0` report
  proving the child candidate came from the non-mutating mechanics-only
  ComputeManager task, used the mechanics law node, suppressed commit deltas,
  executed at least one mechanics-only step, and satisfied any required GPU
  fence. The promotion evidence task records the same key before admission.
  Syntax checks passed, the ComputeManager integration file passed `7/7`, the
  real browser authority Playwright gate passed `1/1`, physics atomics passed
  with the expected long-horizon skip, and the short H2O/H2O MLS-MPM plus
  CPU-SPH visual matrix classified both scenarios as `good` with two captured
  frames each. Diff hygiene passed and ICC was refreshed. Remaining: replace
  the underlying mechanics kernels one stage at a time under this required
  child-task envelope and CPU oracle.
- Added a ComputeManager-owned mechanics-only resident steps task surface:
  `createMlsMpmMechanicsOnlyResidentStepsComputeTask()`,
  `runMlsMpmMechanicsOnlyResidentStepsComputeTask()`, and
  `submitMlsMpmMechanicsOnlyResidentStepsComputeTask()`. The task is a
  non-mutating child execution envelope for the mechanics law node, writes only
  particle state plus MLS-MPM mechanics, suppresses commit deltas by default,
  and supports CPU-oracle execution without a required GPU fence while still
  requiring a same-device GPU lane/fence when WebGPU residency is requested.
  The browser resident authority host now exposes
  `submitMechanicsOnlyResidentStepsTask()` through its real ComputeManager.
  Syntax checks passed, the ComputeManager integration file passed `7/7`, and
  the real browser authority Playwright gate passed `1/1`. Physics atomics
  passed with the expected long-horizon skip, and the short H2O/H2O MLS-MPM
  plus CPU-SPH visual matrix classified both scenarios as `good` with two
  captured frames each. Diff hygiene passed and ICC was refreshed. Remaining:
  feed this task envelope directly into the mechanics child dry-run/promotion
  evidence chain as a required artifact before any mechanics child law becomes
  an admitted current owner, then replace the underlying mechanics kernels one
  law stage at a time under the CPU oracle.
- Added a direct mechanics-only single-step split path:
  `runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu()`. The mechanics-only
  sequence entrypoint now calls that direct step path for every substep instead
  of wrapping the generic resident pass-DAG step. The direct path runs only
  P2G, grid update, G2P, and optional compact summary; it supplies null
  pressure-interface/product inputs, disables non-mechanics law stages, emits
  `peercompute.ulg.mls-mpm-mechanics-only-split-step.v0`, and preserves the
  mechanics-only write contract. Syntax checks passed, the ComputeManager
  integration file passed `7/7`, the real browser authority Playwright gate
  passed `1/1`, physics atomics passed with the expected long-horizon skip,
  diff hygiene passed, and the short H2O/H2O MLS-MPM plus CPU-SPH visual
  matrix classified both scenarios as `good` with two captured frames each.
  Remaining: migrate the underlying mechanics-only direct step from CPU
  reference parity toward a WebGPU child worker owned by ComputeManager.
- Added the explicit mechanics-only resident execution entrypoint
  `runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu()`. Mechanics
  promotion reference and child dry-run evidence now route through that
  entrypoint instead of calling the generic pass-DAG helper directly. The
  entrypoint forcibly disables thermal, reaction, mechanics-refresh, and
  pressure-interface stages, marks the execution path as
  `mechanics-only-entrypoint-enforced`, and preserves the child write contract
  of `particle-kinematics` plus `mechanics`. Syntax checks passed, the
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, diff hygiene passed, and the short H2O/H2O MLS-MPM plus
  CPU-SPH visual matrix classified both scenarios as `good` with two captured
  frames each. Remaining: replace the current CPU mechanics implementation
  inside the mechanics-only entrypoint with the eventual split WebGPU/CPU child
  kernel while keeping the same entrypoint contract.
- Added explicit mechanics-only stage contract evidence to the child dry-run
  gate. Measured reference runs and child dry-run results now carry
  `peercompute.ulg.mechanics-only-stage-contract.v0` / reference contract
  reports proving that the candidate executed only P2G, grid update, and G2P,
  skipped thermal/reaction/mechanics-refresh law stages, writes only
  `particle-kinematics` and `mechanics`, and must not write thermo, reaction,
  gas, or pressure-interface families. The child parity gate now fails if that
  mechanics-only contract is not satisfied. Syntax checks passed, the
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, diff hygiene passed, and the short H2O/H2O MLS-MPM plus
  CPU-SPH visual matrix classified both scenarios as `good` with two captured
  frames each. Remaining: replace the CPU resident candidate implementation
  behind this contract with the actual split mechanics kernel path.
- Added a non-mutating mechanics child dry-run candidate gate. The mechanics
  admission contract now requires `mechanics-child-dry-run-parity`, and
  `runUlgMechanicsChildDryRunTask()` runs the child candidate as a
  module-backed ComputeManager task with `suppressCommitDelta: true`. It
  compares the candidate CPU resident mechanics dry run against measured
  reference evidence and emits
  `peercompute.ulg.mechanics-child-dry-run-evidence.v0`. The existing
  mechanics promotion evidence task now accepts this child dry-run artifact
  and forwards `mechanics-child-dry-run-parity` into promotion admission.
  Syntax checks passed, the ComputeManager integration file passed `7/7`, the
  real browser authority Playwright gate passed `1/1`, physics atomics passed
  with the expected long-horizon skip, diff hygiene passed, and the short
  H2O/H2O MLS-MPM plus CPU-SPH visual matrix classified both scenarios as
  `good` with two captured frames each. Remaining: make this child dry-run
  candidate use the actual split mechanics kernel path once mechanics is
  separated from the parent pass DAG.
- Added measured mechanics promotion reference evidence. New runtime helper
  `createUlgMechanicsPromotionReferenceEvidence()` runs actual CPU resident
  zero-force and gravity-only mechanics probes, measures displacement,
  velocity, volume ratio, pressure-disabled impulse, and mass conservation,
  then returns `peercompute.ulg.mechanics-promotion-reference-evidence.v0`.
  Node and browser authority tests now feed those measured fields into the
  mechanics promotion evidence task instead of static physics booleans while
  still supplying live authority/context evidence from the host. Syntax checks
  passed, the ComputeManager integration file passed `7/7`, the real browser
  authority Playwright gate passed `1/1`, physics atomics passed with the
  expected long-horizon skip, diff hygiene passed, and the short H2O/H2O
  MLS-MPM plus CPU-SPH visual matrix classified both scenarios as `good` with
  two captured frames each. Remaining: turn this measured reference builder
  into a true mechanics child dry-run task candidate before allowing mechanics
  to become an executable current owner.
- Added a non-mutating mechanics promotion evidence task under the resident
  authority host. `runUlgMechanicsPromotionEvidenceTask()` validates
  structured CPU/reference, conservation, volume-stability,
  pressure-disabled, owner-map, GPU fence, StateManager admission,
  committed-delta, and visual-sequence evidence. The browser authority host
  exposes `submitMechanicsPromotionEvidenceTask()` through ComputeManager, and
  the resulting `peercompute.ulg.mechanics-promotion-evidence.v0` artifact can
  feed the existing promotion admission task. Child mechanics remains
  metadata-only and does not own writes. Syntax checks passed, the
  ComputeManager integration file passed `7/7`, the real browser authority
  Playwright gate passed `1/1`, physics atomics passed with the expected
  long-horizon skip, diff hygiene passed, and the short H2O/H2O MLS-MPM plus
  CPU-SPH visual matrix classified both scenarios as `good` with two captured
  frames each. Remaining: replace the fixture-shaped structured evidence with
  measured dry-run/reference artifacts from the actual mechanics child path
  before allowing independent mechanics mutation.
- Added a non-mutating ComputeManager task wrapper for law-family promotion
  admission. `runUlgLawFamilyPromotionAdmissionTask()` is serializable for
  inline JS execution, and `createUlgLawFamilyPromotionAdmissionComputeTask()`
  creates local ComputeManager tasks with `suppressCommitDelta: true`. The
  resident authority host exposes `submitLawFamilyPromotionAdmissionTask()`.
  Child law descriptors remain metadata-only and non-executable. Syntax
  checks passed, the ComputeManager integration file passed `7/7`, the real
  browser authority Playwright gate passed `1/1`, physics atomics passed with
  the expected long-horizon skip, diff hygiene passed, and the short H2O/H2O
  MLS-MPM plus CPU-SPH visual matrix classified both scenarios as `good`.
  Remaining: add mechanics-specific reference/dry-run artifacts before any
  child mechanics law owns writes.
- Added a ComputeManager-facing law-family promotion admission gate. The
  browser resident authority now exposes `ulgLawFamilyPromotionAdmission()` on
  its ComputeManager and `host.admitLawFamilyPromotion()`. The gate consumes
  the resident law graph manifest, rejects missing evidence, enforces
  promotion order, and admits only mechanics families when all required
  evidence is supplied. Mechanics remains metadata-only; thermal/phase is
  still blocked by promotion order. Syntax checks passed, the ComputeManager
  integration file passed `7/7`, the real browser authority Playwright gate
  passed `1/1`, physics atomics passed with the expected long-horizon skip,
  diff hygiene passed, and the short H2O/H2O MLS-MPM plus CPU-SPH visual
  matrix classified both scenarios as `good`. Remaining: decide whether the
  next slice is a metadata mechanics task wrapper or real mechanics child
  execution after stronger mechanics-specific reference artifacts.
- Added resident state-family owner metadata to the law graph descriptors and
  manifest. The pass DAG is now explicitly the single current owner for
  admitted `particle-kinematics`, `mechanics`, `thermo-phase`,
  `reaction-products`, `gas-pressure`, and `pressure-interface` families.
  Child law-family descriptors declare only prospective ownership; mechanics
  is the first promotion candidate but remains non-executable. The manifest
  now exposes current/prospective owner maps, conflict status, first-promotion
  candidate fields, resident read/write family surfaces, and admission
  evidence requirements. Syntax checks passed, the ComputeManager integration
  file passed `7/7`, the real browser authority Playwright gate passed `1/1`,
  physics atomics passed with the expected long-horizon skip, diff hygiene
  passed, and the short H2O/H2O MLS-MPM plus CPU-SPH visual matrix classified
  both scenarios as `good`. Remaining: add a ComputeManager-side promotion
  admission gate for the mechanics child law before making it executable.
- Added a resident law graph manifest derived from the registered
  ComputeManager solver descriptors. The manifest exposes five nodes, seven
  parent/dependency edges, executable versus metadata-only node IDs, read/write
  and conserved state families, validation gates, WebGPU residency, warm-delta
  scopes, and the `metadata-only-until-gated` promotion policy. The browser
  authority host and summary now expose the manifest. Syntax checks passed,
  the ComputeManager integration file passed `7/7`, the real browser
  authority Playwright gate passed `1/1`, physics atomics passed with the
  expected long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH
  visual matrix classified both scenarios as `good`. Remaining: choose a first
  child law family, likely mechanics, and add owner metadata plus
  execution-admission hooks before independent execution.
- Published resident law-family descriptors under PeerCompute
  `ComputeManager` authority without splitting execution yet. The browser
  authority host now registers the executable
  `ulg-mls-mpm-sph-resident-steps` pass DAG plus metadata-only child law
  families for mechanics, thermal/phase, reaction/product/gas, and
  pressure/interface. The child descriptors carry parent law graph metadata,
  GPU-lane-child residency metadata, CPU-reference and visual sanity gates,
  and direct `submitSolverTask()` rejection because they are not yet
  independently executable. The host summary now reports executable solver
  IDs, law-family solver IDs, and law graph ID separately. Syntax checks
  passed, the ComputeManager integration file passed `7/7`, the real browser
  authority Playwright gate passed `1/1`, physics atomics passed with the
  expected long-horizon skip, and the short H2O/H2O MLS-MPM plus CPU-SPH visual
  matrix classified both scenarios as `good`. Remaining: promote one law
  family at a time to executable GPU/CPU workers only after CPU-oracle,
  conserved-field, StateManager-admission, and visual sequence gates pass.
- Added the live browser/libp2p PeerCompute provider transport gate for ULG
  resident state authority. The focused Playwright test starts a local WSS
  PeerCompute relay without taking over ULG's HTTPS Vite server, creates two
  real browser NodeKernel authority hosts, commits a resident warm delta before
  the second host joins, and proves provider sync replays the preexisting
  `ulg-sph-resident-pass-dag` entry over real transport. The first failing run
  exposed a PeerCompute lifecycle bug: provider sync could fire before network
  connection or before relay/pubsub settlement. PeerCompute `StateManager` now
  exposes `requestProviderSync()`, `NodeKernel.start()` requests sync after
  connect and retries briefly with clearable timers, and ULG clears those
  timers in its network-only stop path. Live provider Playwright passed `1/1`,
  ULG resident tests passed `35/35`, physics atomics passed with the expected
  long-horizon skip, PeerCompute focused/unit authority tests passed `27/27`,
  and the two-scenario H2O/H2O visual matrix classified both MLS-MPM and
  CPU-SPH as `good`. Remaining: expand more law groups under ComputeManager
  law-graph descriptors and keep long-horizon liquid settling as the separate
  physics-quality blocker.
- Added a PeerComputeProvider initial Yjs sync handshake in sibling
  PeerCompute and verified it from ULG. Late peers now request sync with a Yjs
  state vector and existing peers respond with the missing encoded update. ULG
  now commits a resident warm delta before the replica StateManager joins, then
  proves the late replica receives and validates that preexisting
  `ulg-sph-resident-pass-dag` entry through the provider sync response.
  PeerCompute StateManager tests passed `3/3`, ULG resident tests passed
  `35/35`, physics atomics passed with the expected long-horizon skip, scoped
  HTTPS browser authority tests passed `3/3`, and H2O/H2O MLS-MPM visual
  sanity classified `good`. Remaining: live browser/libp2p NodeKernel
  transport for the same resident-delta path.
- Added a PeerComputeProvider warm-delta transport gate for ULG resident state.
  Two real sibling PeerCompute `StateManager`s now instantiate real
  `PeerComputeProvider`s, and a minimal in-process NetworkManager shim carries
  provider `yjs-update` broadcasts between them. A compact ULG resident
  commit delta written on the source converges into the replica warm state and
  passes `readResidentStepsCommittedWarmDelta()`. Node resident tests passed
  `35/35`, physics atomics passed with the expected long-horizon skip, scoped
  HTTPS browser authority tests passed `3/3`, and H2O/H2O MLS-MPM visual
  sanity classified `good`. Follow-up at 02:26 adds initial state-vector sync;
  remaining work is real browser/libp2p provider transport across live
  NodeKernel peers.
- Added a replicated StateManager convergence gate to the redundant remote
  placement smoke. After non-advisory remote resident execution, two-result
  quorum validation, and requester StateManager admission, the test now encodes
  the requester's Yjs document and applies it to a second real PeerCompute
  `StateManager`; the replica reads and validates the same committed
  `ulg-sph-resident-pass-dag` warm delta. Node resident tests passed `34/34`,
  physics atomics passed with the expected long-horizon skip, scoped HTTPS
  browser authority tests passed `3/3`, the live HTTPS Vite server returned
  `HTTP/2 200`, and H2O/H2O MLS-MPM visual sanity classified `good`.
  Remaining: real browser/provider transport convergence across live
  NodeKernel peers and the separate long-horizon liquid-settling acceptance
  blocker.
- Added a ULG redundant remote-placement smoke for the resident pass DAG. The
  integration test builds an in-memory NodeKernel mesh, submits a module-backed
  ULG resident task with `placementHint.advisoryOnly=false`, runs primary and
  replica responders through PeerCompute remote placement, validates quorum,
  and admits the resulting compact delta into the requester's real
  `StateManager`. Remote responders execute through their `ComputeManager`s but
  commit no local deltas. Node resident tests passed `34/34`, physics atomics
  passed with the expected long-horizon skip, and H2O/H2O MLS-MPM visual
  sanity classified `good`. Follow-up replicated StateManager convergence is
  now covered by the 02:04 gate; remaining work is real browser-local
  provider transport and more law groups under ComputeManager law-graph tasks.
- Added a browser PeerCompute remote-placement gate to the resident authority
  host. `refreshRemotePlacementGateStatus()`, `configureRemotePlacement()`,
  and `clearRemotePlacement()` now expose
  `peercompute.ulg.remote-placement-gate.v0`, wire
  `NodeKernel.createNetworkPlacementExecutor()` /
  `createRedundantNetworkPlacementExecutor()` into
  `ComputeManager.configurePlacementHooks()`, add a ULG placement admission
  report, and use PeerCompute's existing remote-result quorum validator for
  redundant placement. The gate reports configured/ready state and keeps
  networking off until `startNodeKernelNetwork()` is called. Focused HTTPS
  authority tests passed `7/7`, Node resident tests passed `33/33`, physics
  atomics passed with the expected long-horizon skip, and H2O/H2O MLS-MPM
  visual sanity classified `good`. Remaining: actual two-node/browser-local or
  loopback remote placement smoke with non-advisory placement hints, quorum
  validation, and StateManager admission evidence.
- Routed mounted resident SPH/MLS-MPM scheduling through solver-created
  PeerCompute task envelopes without dropping ULG's root authority metadata.
  `submitMlsMpmResidentStepsComputeTask()` now uses
  `SolverRegistry.createTask()` for `ulg-mls-mpm-sph-resident-steps` when a
  real solver registry is present, then bridges the solver envelope back into
  the ULG resident pass-DAG task with GPU fence, GPU-resident lane, law-graph,
  read/write family, return-envelope, and StateManager commit metadata intact.
  Browser execution now reports
  `peercompute.ulg.mls-mpm-resident-steps-solver-task-bridge.v0` with
  `created=true`; focused HTTPS authority tests passed `6/6`, Node resident
  tests passed `33/33`, physics atomics passed with the expected long-horizon
  skip, and H2O/H2O MLS-MPM visual sanity classified `good`. Remaining:
  long-horizon liquid settling/free-surface quality and more law groups under
  the ComputeManager law graph.
- Registered the ULG resident SPH/MLS-MPM pass DAG as a real PeerCompute
  solver descriptor on the browser NodeKernel `ComputeManager`. The default
  authority host now reports
  `peercompute.ulg.resident-solver-registration.v0` and registers
  `ulg-mls-mpm-sph-resident-steps` with JS module/export metadata,
  GPU-lane residency, read/write fields, warm-delta scope, law-graph node
  metadata, and validation flags. Focused HTTPS authority tests passed `6/6`,
  Node resident tests passed `33/33`, physics atomics passed with the expected
  long-horizon skip, and H2O/H2O MLS-MPM visual sanity classified `good`.
  Follow-up completed in the 01:28 solver-created resident task bridge slice.
- Added an explicit NodeKernel network gate to the browser resident authority
  host. The default path remains local/no-start, but callers can now use
  `startNodeKernelNetwork()` to deliberately start the real PeerCompute
  NodeKernel/libp2p network and `stopNodeKernelNetwork()` to disconnect
  NetworkManager without destroying StateManager. The host reports
  `peercompute.ulg.nodekernel-network-gate.v0` telemetry plus peer id,
  connection state, topology, room, and gate status. Focused HTTPS authority
  tests passed `6/6`, Node resident tests passed `33/33`, physics atomics
  passed with the expected long-horizon skip, and H2O/H2O MLS-MPM visual
  sanity classified `good`. Later slices now cover remote placement, quorum
  validation, and in-memory StateManager convergence; remaining distributed
  work is real peer/bootstrap configuration and browser/provider transport.
- Promoted the browser resident authority host from a NodeKernel-shaped facade
  to a real PeerCompute `NodeKernel` initialized in local/no-start mode. The
  default host now reports `peercompute-browser-nodekernel-authority-host` and
  `nodeKernelMode=real-peercompute-nodekernel`; its real `ComputeManager`,
  `StateManager`, and `GPUHub` own default mounted resident batches and
  StateManager warm-delta publication. The direct-manager facade remains only
  as fallback. Focused HTTPS authority tests passed `5/5`, Node resident tests
  passed `33/33`, physics atomics passed with the expected long-horizon skip,
  and the H2O/H2O MLS-MPM visual sanity matrix classified `good`. Remaining:
  explicitly start/connect NodeKernel for distributed placement, add quorum and
  replicated StateManager gates, and keep long-horizon liquid quality separate.
- Added a browser-local PeerCompute resident authority host as the default
  mounted SPH resident route. `src/runtime/peercomputeBrowserResidentHost.js`
  imports the real sibling PeerCompute `ComputeManager`, `StateManager`, and
  optional `GPUHubManager`, creates a no-persistence/no-network browser demo
  authority host, attaches the ULG resident commit bridge, and exposes a
  NodeKernel-shaped facade. `vite.config.mjs` and the live HTTPS Vite config
  now allow `/@fs/...` imports from the sibling PeerCompute checkout. The
  mounted overlay starts this host, uses its ComputeManager/StateManager by
  default, and keeps explicit/injected ComputeManagers ahead of the default
  host without borrowing the host StateManager by mistake. Focused browser
  tests passed `5/5`, resident/ComputeManager unit tests passed `33/33`,
  physics atomics passed with the expected long-horizon skip, and the H2O/H2O
  MLS-MPM visual sanity matrix classified `good`. Current priority:
  architecture authority should lead now that CPU/reference gates exist; the
  CPU path remains the oracle, and long-horizon liquid quality remains a
  separate gate.
- Added a StateManager-backed scene publication gate. The resident commit
  bridge can now read/validate committed warm entries from a
  StateManager/DataState-shaped object, and `refreshMlsMpmResidentSteps()`
  accepts `residentStateManager`. When the resident sequence runs through a
  ComputeManager and StateManager is supplied, the scene checks the matching
  warm delta before publishing hot retained-buffer execution artifacts. The
  execution envelope records `stateManagerCommit` evidence and reports
  `state-manager-committed-inline-execution-returned` once the warm delta is
  accepted. The mounted demo resolves StateManager from mount/runtime/global
  hosts and passes it into the auto scheduler. Focused Node, browser,
  physics-atomic, visual matrix, and diff hygiene gates passed. Remaining work:
  instantiate/use the real PeerCompute NodeKernel/StateManager host by default
  in the browser route and then add distributed/quorum StateManager gates.
- Added a StateManager admission bridge for resident sequence deltas.
  `src/runtime/peercomputeResidentCommitBridge.js` validates
  `peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0` before handing it
  to a PeerCompute-compatible `StateManager.commitDelta()` handler. The bridge
  enforces accepted scope, task id, state key, completed-step count, expected
  payload schema, and satisfied payload GPU-fence evidence. The sibling
  PeerCompute integration test now proves
  `ComputeManager.submitTask()` -> GPU resident lane fence ->
  bridge admission -> real `StateManager`/`DataState` warm delta, plus a
  rejection case where an unsatisfied committed payload fence blocks state
  mutation. This makes architecture the current priority without abandoning
  CPU/reference and visual sanity gates. Remaining work: instantiate the real
  browser NodeKernel/StateManager host and make scene publication read accepted
  committed state rather than treating task completion as authority.
- Added a compact commit-delta envelope to the real resident sequence task
  handler. `runMlsMpmResidentStepsComputeTask()` now emits
  `peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0` with a compact
  `peercompute.ulg.mls-mpm-resident-steps-state-delta.v0` payload carrying
  state key, law graph node, output families, GPU-fence evidence,
  retained-buffer refs, final-step summary, and recent step summaries. The
  payload avoids full typed arrays and GPUBuffer objects so it can be admitted
  by PeerCompute/StateManager. Focused Node, browser ComputeManager, atomics,
  and visual sanity gates passed. Remaining work: route this emitted delta
  through a real StateManager/DataState commit/read path instead of letting the
  scene publish inline execution as local authority.
- Wired the mounted SPH phase resident auto scheduler to a provided
  ComputeManager-compatible lane host. `mountSphPhaseDemoOverlay()` now accepts
  `residentComputeManager`, also checks `runtime.residentComputeManager`,
  `runtime.computeManager`, and `globalThis.__ulgResidentComputeManager`, and
  records `peercompute.ulg.sph-demo-resident-compute-manager.v0` status on the
  overlay. Automatic resident batches pass that manager into
  `refreshMlsMpmResidentSteps()` on lane `ulg:sph-resident:demo-auto`, so the
  normal mounted loop can cross the ComputeManager task boundary when the host
  provides authority. The focused HTTPS Playwright regression passed, and the
  post-change visual sanity matrix classified H2O/H2O MLS-MPM as `good`.
  Remaining work: instantiate/use the real PeerCompute package in the browser
  route and replace inline scene publication with StateManager committed-delta
  retrieval.
- Added the first real PeerCompute contract gate for ULG resident pass-DAG
  tasks. `tests/peercomputeComputeManagerIntegration.test.mjs` creates a
  `createMlsMpmResidentStepsComputeTask()` envelope and submits it through the
  actual sibling PeerCompute `ComputeManager`, verifying GPU resident lane
  lease acquire/complete, satisfied `peercompute.compute.gpu-fence-report.v0`
  evidence, `peercompute.compute.task-execution.v0` reporting, and
  fence-before-commit behavior. The negative case proves a required missing
  fence rejects with `ERR_COMPUTE_GPU_FENCE_UNSATISFIED`, commits no delta,
  and releases the lane with a missing-fence report. Remaining architecture
  work is still the real NodeKernel/StateManager/GPUHub path, but ULG's task
  envelope is now tested against the real ComputeManager contract rather than
  only a fake scene submitter.
- Added the first scene-visible ComputeManager-shaped resident sequence
  boundary. `src/runtime/sph/sphMlsMpmGpuStep.js` now exposes a sequence-level
  resident task factory/handler/submit helper that declares GPU-lane residency,
  law-graph node metadata, state-family read/write contracts, retained-buffer
  refs, copy budgets, and required GPU-fence evidence. The handler returns the
  existing resident sequence execution with a satisfied fence report while
  deliberately leaving lane leasing to ComputeManager. `refreshMlsMpmResidentSteps()`
  can now accept a ComputeManager-compatible `submitTask()` surface and publish
  the returned inline execution envelope. This advances the architecture
  priority: the CPU/reference implementation remains the truth harness, while
  resident execution starts moving behind the PeerCompute/ComputeManager lane
  boundary. Remaining architecture work: use a real PeerCompute
  ComputeManager/GPUHub resident lane host and StateManager commit-delta path,
  not just the local inline task shape.
- Added a retained surface-vertex diagnostic checkpoint for the no-full
  resident render path. The HTTPS Vite server is running on `0.0.0.0:5173`,
  and the focused Playwright regression now passes against
  `https://127.0.0.1:5173`. The path completes resident physics, render rows,
  render field, and retained surface-vertex generation, then reports
  `resident-surface-vertex-buffers-retained` without entering compact
  surface-draw metadata/readback when the surface overlay is disabled. This
  fixes the diagnostic hang enough to keep investigating resident rendering,
  but it is not a liquid-physics fix. Compact surface-draw metadata/readback
  still hangs under Chromium/SwiftShader and remains a P0 GPU-resident render
  blocker. Browser tests that retain WebGPU buffers now explicitly dispose the
  scene before Playwright teardown.
- Added a bounded retained surface-draw diagnostic mode. Resident render
  refresh and the long-horizon probe now accept
  `surfaceDrawDiagnosticMode=metadata`, and the path is guarded by
  `surfaceDrawDiagnosticMaxFieldCells` before launching the retained
  surface-vertex/draw metadata builder. This prevents the current sparse
  H2O/H2O render fields (`272072` cells) from hanging headless Chromium. The
  over-budget path reports
  `resident-surface-draw-diagnostic-skipped` and
  `surface-draw-diagnostic-field-cell-budget-exceeded` instead of pretending
  fresh surface-draw evidence exists. Focused Playwright coverage passes, and
  `/tmp/ulg-history-probes/current-surface-draw-diagnostic-budget-skip-small.json`
  classifies `good`. Remaining work: reduce or tile the surface-vertex/draw
  metadata path so representative sparse fields can build under budget.
- Fixed the first mounted Na/H2O resident orchestration bug. Direct mounted
  scene/probe resident steps now promote the WebGPU resident product
  gas-species ledger into the overlay/render gas-pressure summary through
  `overlay.__sphUpdateResidentGasPressureSummary`, and the long-horizon probe
  passes that summary into resident render refresh. The mounted Na/H2O scene
  probe at
  `/tmp/ulg-history-probes/current-na-h2o-mounted-1x1-promoted-gas.json`
  classified `good` with total gas pressure `125.9kPa`, H2 partial pressure
  about `24.6kPa`, WebGPU `reaction-step-executed`, and retained product mass
  rows plus EOS sidecar ready. The focused Playwright regression
  `SPH phase mounted resident Na/H2O promotes product gas pressure` passes.
  Remaining Na/H2O work is repeated-horizon product carry-forward, double-count
  prevention, visible product/gas presentation, and pressure coupling under the
  retained GPU authority path.
- Fixed the catastrophic no-full resident G2P zero-output bug. The immediate
  root cause was an 80-byte G2P uniform payload being written into a 64-byte
  WebGPU params buffer after internal-pressure and liquid-wall-damping fields
  were added. `src/runtime/sph/sphG2pGpuKernel.js` now uses a shared
  `G2P_PARAMS_BYTES = 80` allocation/write contract, and
  `tests/sphG2pGpuKernel.test.mjs` has a fake-device regression that catches
  writeBuffer overruns. `tests/webgpuKernelAbi.test.mjs` now extends that
  guard across `16` resident params contracts by comparing WGSL scalar param
  struct size, JS packing size, uniform allocation size, and writeBuffer
  factory usage. Full-readback parity now reports WebGPU G2P
  `maxStateAbs ~= 7.45e-9` and `maxMechanicsAbs ~= 4.46e-9`; direct no-full
  H2O/H2O, no-full thermal, mounted H2O/H2O no-full scene, and mounted CPU-SPH
  scene probes classify `good` for the short sanity checks. Temporary per-stage
  queue fences were removed so the fix stays compatible with the
  GPU-resident/ComputeManager direction. Validation now includes full
  `npm test` at `496` pass / `1` expected opt-in skip, and ICC is refreshed at
  `227` indexed files / `1071` memory chunks. Remaining P0: long-horizon
  liquid quality, cheap no-full visual summaries, retained GPU diagnostic
  lanes, and longer Na/H2O product/gas horizons.
- Added a repo-local representative SPH visual sanity matrix runner at
  `scripts/sph-visual-sanity-matrix.mjs` and package script
  `npm run probe:sph-visual-matrix`. It wraps the long-horizon browser probe
  across named scenarios for liquid/liquid, CPU-SPH liquid/liquid,
  solid/liquid, hot-water phase-change, and Na/H2O reaction-product checks,
  writing per-scenario JSON/log files plus a summary under
  `/tmp/ulg-visual-sanity-matrix/<run-id>/`. Smoke validation passed for the
  CPU-SPH H2O/H2O scenario with `status=good`, `issues=[]`, and
  `visualSurfaceIssues=[]`. This makes the "run visual sanity after major todo
  items" instruction executable instead of another manual one-off command.
- Completed the first explicit liquid-settling remediation slice. The CPU and
  resident mechanics paths now carry liquid dynamic viscosity through the ABI,
  mechanics refresh, packed buffers, CPU MLS-MPM carrier, and WGSL P2G stress
  calculation. The CPU carrier also consumes the hydrostatic-pressure lane that
  the packed GPU path already used. A floor-only no-slip wall boundary now
  removes long-lived wall-contact kinetic energy without damping particles near
  the top/side walls early. The previous opt-in long H2O/H2O atomic gate has
  moved from failing to passing: `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run
  test:physics-liquid-atomic` now passes `6/6`. The CPU SPH render path also no
  longer throws on undefined resident render-field variables, and empty CPU
  surface batches retain the last valid CPU-particle surface instead of
  blinking out. Browser probe evidence for `mech=sph` classified `good` with
  H2O visible in all sampled states and no visual surface issues. Full
  `npm test` passes `484` tests with `1` skipped. Remaining P0: this is a
  reduced-demo stabilization, not final multiscale physics; surface tension,
  broader representative visual sequences, resident throughput, and
  ComputeManager/GPUHub lane authority remain open.
- Completed the next P0 law-isolation and visual-bounds slice. Law-group
  controls now reach `createSphPhaseDemo()` and the direct/plain-SPH probe
  path, so mechanics, gravity, EOS, pressure, thermal/walls, and reactions can
  be isolated without deleting laws or leaving stale stage behavior. The
  no-full-readback cohort diagnostic no longer pretends stale initial CPU
  cohorts are live motion data; when no full state readback is available, the
  probe reports resident cohort diagnostics as unavailable instead of claiming
  the drop is frozen. The visible "nested/pulsing blob" class for valid
  H2O/H2O was narrowed to render-field extraction: compact particle state and
  decoded render rows were bounded, but MarchingCubes surfaces overshot the
  sparse drop domain. The current scene clamps each resident render-field
  surface to its decoded material/phase/domain bounds plus radius-derived
  padding before the container clamp, and lowers the default visible surface
  radius to `0.15`. Probe
  `/tmp/ulg-history-probes/current-lawmatrix-12-scene-bounds-clipped-5batch.json`
  is `good` with `issues=[]`, `maxOverflow=0`, H2O visible in all sampled
  frames, J about `0.997..1.007`, and max speed about `1.026 m/s`.
  A dense visual sequence also passed and wrote GIF/WebM/timeline artifacts
  under
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-valid-geometry-bounds-clipped-visual/`.
  This is still not liquid-settling proof: the capture cadence is slow
  (`meanIntervalMs ~= 4934` for a `250 ms` target) and the next P0 remains
  long-horizon same-material merge/settle quality plus faster resident/render
  validation.
- Added finite-support gap diagnostics to the long-horizon analyzer. The
  previous same-material contact guard used center-sample drop/base bounds, so
  a valid face-contact setup started with an apparent `0.183 m` gap even though
  the physical particle supports were touching. The analyzer now records the
  initial center-to-support offset from preflight geometry and reports
  `firstDropBaseSupportGapM`, `lastDropBaseSupportGapM`, and
  `dropBaseSupportGapDeltaM`. Long all-laws H2O/H2O live-state evidence at
  `/tmp/ulg-history-probes/current-lawmatrix-13-direct-long-all-laws-live-cohorts.json`
  is `good` over `1024` substeps / `0.512 s`: J stays
  `0.997748..1.009107`, pressure impulse is `0`, live drop COM falls
  `1.25 -> 0.463889 m`, and center gap shrinks `0.183333 -> 0.034447 m`.
  The shorter support-gap smoke
  `/tmp/ulg-history-probes/current-lawmatrix-14-direct-support-gap-smoke.json`
  verifies finite-support gap `~0 -> -0.01625 m` after `0.128 s`.
  Remaining P0: this proves live descent/contact and bounded volume, but not a
  visually validated long-horizon merged/settled free surface.
- Added compact resident cohort/support diagnostics to the no-full-readback
  path. The MLS-MPM compact summary ABI now appends optional base/drop cohort
  rows keyed by initial-order ranges, and the summary shader runs at a 32-lane
  reduction size to stay under common WebGPU workgroup-storage limits. Resident
  step diagnostics now expose `cohortDiagnostics` from compact summaries, and
  the long-horizon probe passes base/drop ranges into resident steps. Probe
  `/tmp/ulg-history-probes/current-lawmatrix-16-nofull-compact-cohorts-32lane.json`
  is `good` in no-full mode over `256` substeps / `0.128 s`: compact cohort
  diagnostics are ready, drop COM moves `1.25 -> 1.159897 m`, support gap
  moves `~0 -> -0.01625 m`, J stays `0.998833..1.006488`, and pressure impulse
  is `0`. This removes the need for full particle readback just to know whether
  the drop/base cohorts are moving, but compact summary timing is still too
  expensive and must be optimized before it becomes the normal visual matrix.
- Fixed the valid-geometry H2O/H2O render-field surface expansion bug. The
  scene probe was clean at the particle/volume level, but the resident
  render-field MarchingCubes surface for a sparse 27-particle drop was too
  coarse in the global 5 m field and expanded above particle bounds. Sparse
  resident render-field surfaces now use resolution `32` and no longer get an
  extra sparse radius boost beyond the default `0.4` scale. The scene probe
  `/tmp/ulg-history-probes/current-h2o-face-contact-scene-256-all-laws-valid-geometry-sparse-res-32.json`
  is `good` with no visual surface issues, visible H2O samples present, and
  J `0.9988..1.0073`. The visual sequence passed after the test harness was
  made drawRange-aware; artifacts are under
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-face-contact-valid-geometry-sparse-res-32-drawrange/`.
- Hardened the plain SPH reference slice enough to separate invalid geometry
  from real liquid-mechanics failures. `mech=sph` now uses a PBF-style density
  projection with wall clamping, records `sphDensityProjection*` settings in
  `gpuMechanics`, and the preflight reports initial block support extents. A
  URL like `ironh=0.85` is now correctly blocked as
  `initial-block-geometry-overlap` because the 0.5 m drop overlaps the 1.0 m
  base by `0.15 m`; the old center-gap metric made that look like a valid
  contact case. The probe also carries preflight status into analysis and no
  longer parses missing wall temperatures as `0 K`. Valid face-contact SPH
  (`ironh=1`) passes a short direct probe:
  `/tmp/ulg-history-probes/current-h2o-face-contact-plain-sph-reference-pbf-parser-fixed.json`
  is `good`, walls are `283.15 K`, max speed is `0.08076 m/s`, and the drop
  moves downward. Overlapped SPH remains `bad` by design at
  `/tmp/ulg-history-probes/current-h2o-overlap-plain-sph-reference-preflight-blocked-parser-fixed.json`.
- Added the first plain SPH reference-mode plumbing. The overlay URL/state now
  accepts `mech=mlsmpm|sph`, status reports the active mechanics mode, and
  worker-view-state playback no longer routes `mech=sph` into resident MLS-MPM.
  The standalone long-horizon probe also honors `mech=sph` and emits
  `peercompute.ulg.plain-sph-cpu-reference-*` diagnostics instead of claiming
  WebGPU residency. Focused syntax/tests pass and a short H2O/H2O contact probe
  writes
  `/tmp/ulg-history-probes/current-h2o-direct-contact-near-plain-sph-reference-smoke-analyzer-fixed.json`.
  The result is only a diagnostic smoke: current plain SPH reaches high speeds
  and barely closes the contact gap over the short interval, so P0 still needs
  wall constraints plus PBF/incompressibility/viscosity/surface-tension before
  this becomes a real liquid reference.
- Isolated the current residual water failure below pressure/gas/thermal and
  below the renderer. The pressure/gas rows in `c81a66a` were a real earlier
  explosive bug class, but the still-broken liquid behavior now reproduces in
  a direct WebGPU resident mechanics+gravity-only probe with EOS, pressure,
  thermal, reactions, and mechanics refresh disabled. Evidence:
  `/tmp/ulg-history-probes/current-h2o-direct-contact-near-256-mechanics-gravity-only.json`
  is `bad` with `same-material-contact-gap-not-closing`, gap
  `0.03333336 -> 0.02995068 m`, base `J` down to about `0.876`, pressure
  impulse `0`, and no render surface path involved. Hydrostatic base
  initialization and a hydrostatic pressure lane did not fix this. The active
  root-cause area is now MLS-MPM P2G/grid-update/G2P mechanics transfer,
  wall/contact handling, volume preservation, and missing liquid constraints.
  Added the plain SPH/PBF reference mode to the P0 plan as a diagnostic and
  fallback lane, not a replacement for ULG laws.
- Fixed the current high-drop same-material H2O/H2O visible-surface bug enough
  to restore short-horizon coherence. Pressure-off did not change the failure,
  and pressure impulse was already zero, so pressure was not the proximate
  cause. The actual bug chain was missing wall-temperature inputs in the
  resident path, same-material base/drop render domains being merged, a
  resident render-row extraction scope error, and a sparse 3x3x3 drop render
  kernel that fell below the isosurface threshold. The current tree carries
  wall temperatures in resident signatures, preserves base/drop render-domain
  ids through render rows/surface tables/render-field splatting, keeps the
  global default surface scale at `0.4`, and applies a scoped `0.5` radius
  floor only to default-scale sparse cohorts of `27` particles or fewer.
  Focused render tests pass `58/58`. Scene probes pass for high-drop H2O/H2O
  over `1 x 16` and `4 x 64` resident steps with two visible liquid H2O
  domains, no particle-bound surface inflation, zero pressure impulse, and J
  near one. Full `npm test` passes `466/466`, and ICC is refreshed at `224`
  files / `1004` chunks. This is still short-horizon render/diagnostic
  coherence, not proof of true liquid contact/settling.
- Added physical law-group controls for isolation debugging. The SPH overlay
  now exposes default-on checkboxes and URL/hash keys for mechanics, gravity,
  pressure, thermal/walls, and reactions. The resident loop includes those
  groups in signatures and disables the corresponding inputs/stages without
  deleting the laws. The long-horizon probe now has an opt-in static
  expectation mode for isolation runs; `gravity=off pressure=off` passes with
  zero displacement and two visible H2O liquid domains under
  `ULG_PROBE_EXPECT_STATIC=1`.
- Fixed the first WebGPU resident G2P motion regression. P2G projection,
  grid-update, and G2P execution envelopes now preserve `gridShift` for
  downstream consumers. Before this, G2P could receive an execution envelope
  without the shifted grid origin used by P2G/grid-update, making CPU parity see
  no active samples while GPU sampled the wrong grid coordinates.
  Browser/WebGPU probes now pass G2P parity and recover exact short-horizon
  gravity motion: 8 zero-pressure steps expected `0.0392266 m/s` and observed
  `0.03922661 m/s`; retained-upload thermal plus mechanics refresh expected
  `0.0196133 m/s` after 4 steps and observed `0.019613305 m/s`. The focused P0
  suite passes `74/74`, including a resident-step regression for shifted-grid
  gravity reconstruction. The visual sequence now shows monotonic resident
  velocities with zero pressure impulse, and the harness can now be pointed at
  alternate scenarios through `ULG_SPH_VISUAL_URL` and `ULG_SPH_VISUAL_LABEL`.
  A contact-near H2O/H2O capture produced one visible merged surface. Capture
  runs now use `visualCapture=1` to preserve the drawing buffer and write frames
  through `canvas-to-data-url`, but runtime/render cadence remains slow. This
  has not yet proven long-horizon water-like settling.
- Fixed the first resident cadence/synchronization regression created during
  the WebGPU refactor. The page now honors the MLS-MPM `mechanicalSubsteps`
  target (`substeps=16 target=16`) instead of capping resident submissions at
  four substeps, hot resident kernels use cached compute pipelines, no-full
  mutation passes defer temporary-buffer cleanup behind queue fences instead of
  blocking after every pass, and scene/probe batches use
  `compactSummaryMode=final-only`. Direct retained-resident H2O/H2O evidence
  over `2 x 32` substeps remains compact-stable (`max-v=0.1798196 m/s`,
  `J=0.998767..0.999974`, pressure rows `0`), and sparse scene evidence
  improved the corrected 16-substep envelope from roughly `75s` to `11.4s`.
  This is a throughput/cadence fix, not proof of liquid settling: the direct
  probe bypasses scene pressure rows and marching-cubes surfaces, and `0.008s`
  of simulated time per resident envelope is still too short to validate
  water-like contact/settling.
- Fixed the first resident motion-diagnostic/render-refresh bug. Compact
  summaries report final-substep displacement, not total displacement over a
  retained resident batch. A separated H2O/H2O direct probe over `256` substeps
  reaches `1.255 m/s` after `0.128s`, matching free-fall scale while keeping J
  in `0.997750..1.000842`; the old final-substep `maxDisplacementM` alone was
  only `0.0006275 m`, which could be below visible-refresh thresholds in other
  batches and produce misleading "below visible threshold" warnings. The demo
  motion diagnostic now exposes a conservative batch-motion upper-bound
  estimate and forces render refresh with
  `resident-batch-motion-estimate-visual-refresh` when that estimate crosses
  the visible threshold. Sparse scene evidence confirmed the refresh path and
  exposed the next P0: nonphysical visible H2O render-surface bounds.
- Fixed the first visible render-field bounds bug. The scene now converts
  physical blob radii into padded render-field units using the field span
  instead of making each blob about `1.79x` too large, and it clips generated
  Three.js MarchingCubes geometry to the sealed container. The long-horizon
  probe now flags out-of-box visible surfaces as visual failures. The separated
  H2O/H2O scene probe first caught `visible-surface-outside-box`; after the
  radius/clip fix the same `1 x 16` scene probe is `good`, with H2O y-min
  effectively at the floor (`-1.06e-8 m`) and `maxVisibleSurfaceOutsideM=0`.
  This fixes a visible render coherency bug, not liquid physics validation:
  the probe now distinguishes active draw vertices from the `72000`-vertex
  MarchingCubes buffer capacity (`840` active H2O vertices after resident
  refresh), render-field readback is active, and long-horizon same-material
  contact/settling remains P0.
- Tightened the default visible isosurface radius scale. The new
  `SPH_SURFACE_RADIUS_SCALE_DEFAULT = 0.4` keeps sparse resident particle
  cohorts from rendering as oversized nested blobs while preserving the live
  `blob=` override for targeted probes. The standalone scene probe now checks
  visible surface bounds against compact resident particle AABBs and caught the
  old default as `visible-surface-expanded-beyond-particle-bounds`. With the
  default lowered, the contact-near H2O/H2O `1 x 16` scene probe passes without
  any URL override: pressure rows `0`, pressure impulse `0`, J
  `0.999490..0.999996`, `maxVisibleSurfaceOutsideM=0`, and
  `maxVisibleSurfaceOutsideParticleBoundsM=0`. A post-change visual sequence
  also passed and wrote artifacts under
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-contact-near-default-blob-0p4/`.
  This fixes a major visible render exaggeration; it still does not prove
  long-horizon liquid merge/settle behavior.
- Promoted the remaining same-material liquid/contact failures into the
  standalone probe. Direct full-readback H2O/H2O contact-near now tracks
  initial-order base/drop cohorts and fails if a near-contact liquid gap does
  not close over a long enough resident interval. Contact-gap evidence is still
  bad:
  after `256` substeps / `0.128s`, drop COM falls only `0.01955 m` and the
  drop/base gap changes from `0.03333 m` to `0.03219 m`, so analysis reports
  `same-material-contact-gap-not-closing`. Scene mode also now fails
  same-material liquid H2O/H2O when visible resident render surfaces split into
  inconsistent H2O descriptors. That phase/render split guard caught the stale
  resident wall-temperature/render-domain bug and should remain as a regression
  guard; the current high-drop scene probes no longer show the bogus
  `solid:ice` visible H2O surface.
- Added explicit resident surface-draw overlay policy and bounded probe
  diagnostics. The normal demo remains on the safe Three/MarchingCubes visible
  fallback by default (`surface-draw-overlay-disabled-by-policy`), while
  `surfaceOverlay=1` can force the raw WebGPU overlay path for targeted work.
  Forced overlay currently blocks headless Chromium/SwiftShader and now returns
  bounded `blocked` probe JSON instead of spinning indefinitely. Status text and
  probe output now show overlay policy/mode, active surface count, vertex count,
  bridge status, and draw-buffer retention. The default H2O/H2O fallback probe
  remains `good` with bounded visible H2O geometry, zero pressure impulse, and
  J near one. Full `npm test` passes `457/457`, build passes with the existing
  large-chunk warning, and ICC is current at `224` files / `988` chunks.
  Resident GPU surface draw is still not ready to default on.
- Rechecked the user-reported pressure/gas regression window with temporary
  worktrees and the standalone scene probe. The comparable separated H2O/H2O
  run at `c81a66a` is still bad after `1 x 16` resident steps: pressure rows
  reach `302`, the grid consumer is
  `grid-momentum-impulse-submitted-unverified-no-full-readback`, max speed is
  `20.7157 m/s`, J spreads to `0.509843..1.372338`, and the visible H2O surface
  extends below the box by about `1.31 m`. The current dirty tree passes the
  same probe with pressure rows `0`, consumer
  `blocked-pressure-force-rows-unavailable`, max speed `0.156908 m/s`, J
  `0.999495..1.0`, active nodes `280`, and `maxVisibleSurfaceOutsideM=0`.
  `f0d101f` is not a clean visual comparator for this exact URL because that
  older page path maps the same controls into an Fe/H2O case.
- Extended the resident compact summary with no-full-readback settling
  diagnostics: source/next center of mass and source/next particle bounds. The
  compact readback is now `224` bytes instead of `128`, still diagnostic-only.
  Focused resident-step tests pass, and real WebGPU probes show the fields in
  both direct and scene mode. The updated scene H2O/H2O `1 x 16` probe remains
  `good` with pressure rows blocked and visible geometry bounded; its analysis
  now reports COM Y movement and next-position Y bounds, giving future
  long-horizon settling probes a compact signal beyond final-substep
  displacement. The live HTTPS derived-material e2e now passes with the `224`
  byte compact summary, COM/AABB diagnostics, the refreshed-mechanics
  next-buffer mode, and the explicit
  `surface-draw-overlay-disabled-by-policy` bridge status. A post-change visual
  sequence artifact for separated H2O/H2O also passed and wrote PNG/GIF/WebM
  outputs under
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-separated-current-com-bounds/`.
- Added a standalone history/long-horizon SPH probe:
  `npm run probe:sph-long-horizon`. It can serve any checkout specified by
  `ULG_PROBE_REPO_DIR`, run retained resident WebGPU batches in the browser,
  and emit JSON compact diagnostics plus visible surface bounds. It confirmed
  the pressure/gas regression boundary: `f0d101f` is sane for contact-near
  H2O/H2O (`max-v=0.012864 m/s`, `J=0.999677..1.000018`, active nodes `248`),
  while `c81a66a` spikes to `max-v=303.441 m/s` and `J=0.1..8.343449` after
  unverified pressure-interface rows become grid momentum consumers. The
  current dirty tree passes the same probe with pressure rows blocked
  (`max-v=0.140798 m/s`, `J=0.999399..1.0`, applied pressure impulse `0`).
- Added the first resident mechanics/constitutive refresh stage after thermal
  state updates. ULG now builds an MLS-MPM material/phase mechanics table from
  material properties, has CPU and WebGPU refresh paths, threads the refresh
  through resident P2G/grid/G2P/thermal/reaction ordering, carries the refreshed
  mechanics buffer into the next retained upload, cleans it up correctly, and
  records `mechanics-constitutive-refresh` as the mechanics authority owner when
  it runs. Focused validation passed `64/64` across EOS, P2G, G2P, resident
  step, mechanics refresh, summary, and resident authority tests. The required
  post-item visual sanity check also ran: mechanics refresh is active in the
  H2O/H2O path, but the visible surface still stacks into a nonphysical blob
  and later jumps to `max-v=140.18 m/s`; same-material H2O/H2O settling and
  visible liquid/contact behavior remain P0 broken.
- Added and corrected the P0 H2O/H2O visual validation harness. The current
  long-horizon Playwright path can force validation render-field readback,
  disable the resident overlay for that validation refresh, timeout render
  refreshes, write PNG/GIF/WebM plus JSON timelines, and measure only drawn
  MarchingCubes vertices through `geometry.drawRange` instead of the fixed
  `72000`-vertex buffer capacity. Corrected high-drop evidence shows `5` fresh
  render-field readbacks, `5` frames, and
  `maxVisibleSurfaceCenterMotionM=0.0098805`; contact-near evidence shows `7`
  readbacks, `7` frames, and
  `maxVisibleSurfaceCenterMotionM=0.0047826`. This makes the visual sequence
  harness trustworthy enough for recurring sanity checks, but it is still
  short-horizon evidence, not proof of water-like settling.
- Fixed the pressure/gas regression slice inside `c81a66a` that made the user
  screenshots look frozen, delayed, or explosive. Condensed Tait pressure is
  signed again in CPU and WGSL P2G while gas pressure remains nonnegative,
  hidden condensed-liquid affine damping has been removed from CPU/WGSL G2P,
  and finite-volume particles now clamp at wall clearance
  `0.5 * cbrt(restVolume)` instead of acting as dimensionless points at the
  sealed walls. Focused mechanics/render tests pass, and direct resident
  H2O/H2O high-drop over `256` substeps is coherent: drop COM
  `2.75 -> 2.669350 m`, final drop velocity `-1.25525 m/s`, pressure impulse
  `0`, and J `0.998292..1.000527`. Remaining P0 work is not more pressure
  clamping; it is true same-material liquid contact/settling, phase/wall
  consistency, incompressible/viscous/surface-tension law stages, and faster
  resident execution for longer visual horizons.
- Read `agents.md`, `/home/cos/projects/AGENTS.md`, and the ULG v0.5 PDF.
- Completed the first cold-start cache/performance slice for the SPH demo.
  `discoverReactions()` now keeps material-property-backed reactions cacheable
  by hashing stable material-property provenance into its cache key, accepts
  persisted reaction records, and can reuse supplied/product cold-cache
  closures. The live SPH overlay now starts initial material/reaction/view-state
  rebuilds through the supervised `ulg-runtime` worker when available, writes
  localStorage cold-start reaction/product records, exposes `cold cache`,
  `cache clear`, and `perf trace` diagnostics, and provides a
  scoped `Clear Cache` button. If FPS drops below 30 during CPU closure work the
  banner reports `deriving material or reaction properties`. The ultra-low-FPS
  auto-pause behavior has been removed; long 0.1 FPS cold-start periods remain
  an active performance target rather than a playback-control behavior. Manual
  Step/Play can reconstruct the interactive driver from cache after worker
  prepopulation without forcing cold derivation on initial load. Remaining cache
  work: thermal/optical/static table reuse, GPU warmup metadata, stale-record
  browser probes, PeerCompute state mirroring, and measured cold/warm/clear
  deltas.
- Added the first resident GPU gas/product ledger slice. The no-full-readback
  reaction path now binds proposals into a compact summary pass and returns a
  128-byte f32x4 readback with event count, consumed mass, visible/unplaced
  product mass, gas mass/moles, heat, and residuals. Resident diagnostics,
  repeated-step summaries, and overlay status expose the ledger, and sealed-box
  pressure can be derived from the resident summary for guarded single-gas
  reactions without scanning stale CPU particle arrays. Multi-gas per-species
  resident buffers and force/wall pressure feedback remain pending.
- Added per-gas-product resident compact ledger rows. A separate 32-byte f32x4
  row is emitted for each gas product with material id, mass, moles,
  visible/unplaced mass, event count, gas-product index, and status. The decoder
  aggregates duplicate gas rows by material, resident diagnostics preserve the
  species ledger, and the sealed-box pressure diagnostic now consumes
  material-keyed resident gas species before aggregate fallback. Remaining
  reaction work: dynamic or inventory-backed product append, stricter
  atom/charge residual summaries, and force/wall pressure feedback.
- Added compact resident product inventory and atom/charge residual ledgers.
  Product-inventory rows now report per-product-term mass, visible/unplaced
  mass, moles, routing, charge contribution, raw mass, and mass scale without
  full particle readback. Reaction tables now carry formula-derived atom-term
  rows for reactants and products, static-table cache restore preserves them,
  and a compact WebGPU atom-residual pass reports atom residuals by atomic
  number plus charge residuals. Resident diagnostics and the SPH overlay expose
  product-inventory and atom-residual row counts. Remaining reaction work:
  strict validity gates using the residuals/energetics, pressure feedback into
  forces and wall ledgers, and dynamic/renderable product storage.
- Reprioritized cold-start work per
  `plan/done/reprioritize-cold-start-work-2026-06-11.md`. Cache
  correctness remains active, but cold/warm timing polish, stale-record browser
  probes, and GPU warmup persistence are deferred until reaction, pressure,
  steam, hot-loop, and material-resolver schemas stabilize. Worker static-table
  reuse now ignores particle count alone but rejects stale reaction-table
  bundles when a changed smoothing/contact radius changes the derived reaction
  table.
- Added the WebGPU-Ocean/marching-cubes performance todo to the active plan.
  The hot-loop phase will evaluate fixed-point/tiled GPU P2G scatter, GPU
  cell/neighbor structures, and a WebGPU marching-cubes surface extractor for
  continuous PBR material volumes before returning to cold-start timing polish.
- Added strict reaction gate and pressure wall-load feedback contracts. Compact
  reaction summaries now include `peercompute.ulg.sph-reaction-strict-gate.v0`,
  which blocks strict force coupling on provisional energetics or atom/charge
  residual drift while reporting product mass scaling separately. Gas-pressure
  summaries now attach `peercompute.ulg.sph-sealed-gas-pressure-feedback.v0`
  with gauge pressure, six wall force ledgers, net force, and an explicit force
  coupling blocker. Resident diagnostics and overlay text surface the strict
  gate and pressure feedback status. Remaining: use surface/gas-cell gradients
  to turn the wall/pressure ledger into validated force coupling.
- Completed the first phase-resolved H2O vapor optics slice. The SPH demo now
  derives a bucketed gas-phase optical state from sealed-box H2O partial
  pressure, total pressure, temperature, droplet radius, saturation pressure,
  supersaturation ratio, condensed fraction, vapor/condensed density, droplet
  number density, and scattering coefficient. Pure vapor stays nearly invisible
  from the O-H absorption closure; supersaturated vapor reaches the
  Clausius-Clapeyron plus droplet scattering closure and uses the
  condensed-droplet PBR render model. The optical CPU cache key now handles
  nested/string state fields, and the optical GPU lookup ABI appends optical
  depth, scatter, absorption, and optical-state id diagnostics. Remaining:
  make this state per-cell/per-particle GPU-resident and gate vapor surface
  visibility directly from closure-derived optical depth/scattering.
- Added the first material-interface and pressure/interface coupling checkpoint.
  `peercompute.ulg.sph-material-interface-field.v0` now derives aggregate
  per-surface area, threshold crossing count, area centroid, and mean outward
  normal from the same render-field density grids used for continuous surfaces.
  `peercompute.ulg.sph-pressure-interface-coupling.v0` joins that interface
  field with the sealed gas pressure feedback and reports
  `pressure-interface-coupling-ready-for-solver` only when pressure and
  interface geometry are available. Force coupling remains explicitly blocked
  with `blocked-pressure-force-solver-not-implemented`; no particle/grid force
  application has been added.
- Extended that checkpoint with local interface element rows and a non-applied
  pressure-force preview. Interface fields now include f32x4-aligned local
  rows with centroid, area, normal, normal-area vector, material, phase, and
  surface ids. The preview multiplies uniform gas pressure by local normal-area
  vectors and reports per-surface/net force diagnostics, but keeps
  `forceApplicationStatus = not-applied-diagnostic-preview` and all validation
  flags false. Remaining: GPU-resident element generation and a conservative
  pressure-force solver with parity/conservation tests before applying forces.
- Tightened the resident render-field blob flicker guard. Under-threshold
  transient frames now retain the last valid marching-cubes mesh through the
  existing inactive-frame grace window instead of immediately clearing to an
  empty field, and new surfaces start hidden until their field crosses the
  isosurface threshold. Validation: focused renderer/kernel tests passed
  `22/22`, full `npm test` passed `390/390`, and the live HTTPS Playwright run
  passed the SPH/runtime browser coverage while the unrelated supervised
  service smoke timed out on legacy service telemetry.
- Added the GPU-shaped material-interface candidate buffer. The ABI now has
  `peercompute.ulg.sph-material-interface-candidate-field.v0` and a fixed
  f32x4 cell-axis candidate row shape, with one inactive-or-active candidate
  per render-field cell and positive axis. `deriveSphMaterialInterfaceField()`
  now compacts from that candidate field, and
  `sphMaterialInterfaceCandidatesWgsl` plus
  `buildSphMaterialInterfaceCandidateFieldWebGpu()` provide the matching
  WebGPU candidate-row pass behind explicit parity/readback gates. Validation:
  focused ABI/render-kernel tests passed `30/30`, the broader SPH slice passed
  `59/59`, live HTTPS SPH e2e passed `1/1`, and full `npm test` passed
  `393/393`. Remaining: consume the candidate buffer in a conservative
  pressure-force solver before enabling force application.
- Added the conservative pressure-interface force solver artifact. The ABI now
  includes `peercompute.ulg.sph-pressure-interface-force-solver.v0` and a
  16-float force row carrying interface identity, centroid, area, material
  force, equal/opposite gas reaction force, pressure, and status. The solver
  reports `solver-ready-not-applied`, pairwise conservation residuals, and a
  pending MLS-MPM grid-force target; it does not yet mutate particle state or
  grid momentum. Validation: focused ABI/headless tests passed `34/34`, broader
  SPH tests passed `59/59`, live HTTPS SPH e2e passed `1/1`, and full
  `npm test` passed `393/393`. Remaining: implement the MLS-MPM/WebGPU
  grid-force consumer and apply only after parity/conservation checks pass.
- Added the pressure-interface MLS-MPM grid-force consumer and tightened the
  flicker test coverage. Grid update now accepts the pressure-interface solver
  force rows, scatters material-force impulses to mass-bearing grid nodes using
  the same quadratic MLS-MPM weights on CPU and in WGSL, and exposes
  `pressure-interface-grid-force-consumer-applied`,
  `grid-momentum-impulse-consumed`, row-count, and applied-impulse diagnostics
  through the grid-update execution envelope. Inactive grid nodes are skipped
  so default zero-position rows cannot inflate impulse summaries. The render
  flicker guard now has direct grace-window coverage through
  `hideRenderFieldSurfaceAfterGrace()`: the last valid mesh is retained without
  reset/update during the inactive grace frames and hidden only after expiry.
  Validation: focused renderer/grid/ABI tests passed `43/43`, broader SPH tests
  passed `95/95`, live HTTPS SPH e2e passed `1/1`, full `npm test` passed
  `396/396`, and both production and Pages builds passed. Remaining: wire the
  pressure solver rows from the resident render-state/pressure path into the
  resident MLS-MPM step so the demo’s gas pressure can visibly push material
  surfaces in the live simulation.
- Wired pressure-interface force rows into resident MLS-MPM steps. The latest
  resident render-state solver is now a one-frame-delayed input to standalone
  grid update, single resident steps, and repeated resident steps; resident
  signatures include the pressure force-row payload so stale cached resident
  steps are not reused after pressure/interface changes. Resident step
  envelopes, diagnostics, and repeated-step summaries expose solver schema,
  application status, row count, applied impulse, and consumer status. CPU and
  WebGPU grid-update routing remain parity-gated. Validation: focused
  resident-step tests passed `14/14`, broader SPH tests passed `96/96`, live
  HTTPS SPH e2e passed `1/1`, full `npm test` passed `397/397`, and both
  production and Pages builds passed. Remaining: use the next render/physics
  loop to observe this one-frame-delayed pressure force in the live demo and
  then move into GPU marching cubes/WebGPU-Ocean hot-loop work.
- Completed the first GPU-resident render-field/marching-cube hot-loop slice.
  `buildSphRenderFieldWebGpu()` now has an explicit no-full-readback mode with
  retained render-field and surface buffers, so normal hot-loop execution can
  keep the density grid GPU-resident. The ABI now exposes
  `peercompute.ulg.sph-gpu-render-marching-cube-cells.v0` plus an f32x4
  fixed-voxel row layout, and `sphRenderMarchingCubeCellsWgsl` classifies each
  render-field voxel cube into corner mask, edge crossing count, density range,
  reserved triangle/vertex counts, and active status. CPU reference and
  optional WebGPU wrappers cover parity/readback and resident no-readback
  execution. Validation: focused ABI/render-kernel tests passed `34/34`, the
  broader filtered runtime slice passed `401/401`, live HTTPS SPH e2e passed
  `1/1`, full `npm test` passed `401/401`, and both production and Pages builds
  passed. Remaining: add prefix/compaction plus actual WebGPU triangle
  emission, wire the emitted surface buffers into the renderer, and profile the
  live no-readback path against the current CPU MarchingCubes object update.
- Added the first deterministic surface-vertex emission contract after the
  marching-cube classification pass. The ABI now exposes
  `peercompute.ulg.sph-gpu-render-surface-vertices.v0` and a f32x4 per-vertex
  row carrying surface/material/phase ids, compact debug triangle/vertex ids,
  position, normal, optical-state id, density/isolation, source voxel, and
  status. The CPU reference emits tetrahedralized render-field cube triangles
  from first-principles scalar density rows, and the WebGPU WGSL path writes the
  same tetrahedralized vertices into deterministic fixed slots
  (`totalFieldCells * 36`) instead of nondeterministic atomic append. Full
  readback mode compacts those slots only for parity/debug; no-full-readback
  mode can retain the fixed-slot GPU vertex buffer. Also fixed the classifier
  CPU/WGSL reservation mismatch to `12/36` and corrected the render-field
  coordinate conversion for marching-cube cell centers and emitted vertices.
  Validation: focused ABI/render-kernel tests passed `36/36`, broader SPH tests
  passed `102/102`, live HTTPS SPH e2e passed `1/1`, full `npm test` passed
  `403/403`, and both production and Pages builds passed. Remaining: add the
  prefix/compaction and per-surface draw/indirect metadata buffers, then wire
  emitted vertices into a WebGPU/Three draw path while keeping CPU
  `MarchingCubes` as fallback.
- Added surface draw metadata rows for the emitted vertex path. The ABI now
  exposes `peercompute.ulg.sph-gpu-render-surface-draw.v0` and a f32x4
  per-surface row with material/phase/optical ids, vertex and triangle offsets
  and counts, render-order/depth flags, status, and bounds. The CPU reference
  derives this metadata from compact surface vertices as the draw-stage prefix
  anchor, and the optional wrapper gives the future WebGPU prefix/draw metadata
  kernel the same parity/fallback envelope as the rest of the render pipeline.
  Validation: focused ABI/render tests passed `38/38`, broader SPH tests
  passed `104/104`, live HTTPS SPH e2e passed `1/1`, full `npm test` passed
  `405/405`, and both production and Pages builds passed. Remaining:
  implement the actual WebGPU prefix/compaction kernel, produce draw-indirect
  rows from fixed slots without CPU readback, and bind those rows to a renderer
  path.
- Added GPU-resident sparse product-event staging for reaction products. The
  reaction ABI now declares
  `peercompute.ulg.sph-gpu-reaction-product-event.v0`, and the no-full-readback
  reaction path can retain a separate particle-major product-event buffer with
  one row per source particle/product term. Verification readback is optional;
  normal resident runs keep the product-event rows WebGPU-resident, expose row
  counts/buffer bytes in resident diagnostics and the SPH overlay, and destroy
  the retained buffer with the resident step.
- Added resident product-event render-field consumption. The SPH render-field
  ABI now binds the retained product-event buffer and splats only unplaced
  product mass, avoiding double-rendering products already emitted into source
  slots. The scene now creates synthetic surface entries from the generic
  reaction product inventory/product-term metadata, so event-only gas or
  condensed products can render as spawned volume through the same
  material/phase optical table path. Remaining product-event consumers:
  pressure/EOS and field-force kernels.
- Added a compact product-event/product-inventory pressure bridge. Resident gas
  pressure now still prefers the per-species GPU gas ledger, but can fall back
  to gas product-event readback rows or compact product-inventory rows when
  sparse event rows stay GPU-resident. It filters through generic reaction
  product routing metadata, reports the resident product-gas source/rows, and
  avoids full particle readback. This is a pressure diagnostic input bridge;
  EOS and force-field kernels still need resident consumption for dynamics.
- Added `peercompute.ulg.sph-resident-product-mass.v0` as the explicit resident
  product-mass handle. Reaction results and resident MLS-MPM steps now expose
  the retained product-event buffer, row count/stride, product-inventory count,
  unplaced mass, gas mass, and the `unplaced-product-mass-only` consumption
  policy in one object. Buffer destruction is guarded through the handle, and
  the SPH overlay reports that EOS/force coupling remains blocked until
  field/gas kernels consume the resident mass directly.
- Added the first resident product-mass P2G consumption slice. The MLS-MPM P2G
  CPU reference and WebGPU binding contract now accept a resident product-mass
  sidecar, bind the sparse product-event buffer as read-only storage, and
  deposit only ready rows with positive `unplacedMassKg` into grid mass. Repeated
  resident steps carry the prior product-mass handle into the next P2G before
  cleanup, with a preserve hook so borrowed product-event buffers are not
  destroyed early. This is mass/inertia participation only; pressure/EOS force
  coupling remains blocked until product-event rows carry mechanics/EOS state
  or a gas-cell EOS kernel consumes the resident inventory.
- Expanded product-event rows to carry derived mechanics/EOS metadata. The
  product-event ABI now has 32 f32 values: the original render/pressure fields
  plus product velocity, support volume, effective bulk modulus, shear modulus,
  Lame lambda, sound speed, EOS model id, solid flag, and mechanics status.
  `sphReactionProductEventWgsl` derives those fields from reaction product
  phase records, and P2G now consumes product-event velocity plus EOS pressure
  when support volume and closure-derived EOS fields are present. Remaining:
  validate a gas-cell/pressure-gradient force solve and add GPU append/compaction
  for multiple generations of unplaced products.
- Extended the cold-start/performance slice with finer diagnostics and cache
  coverage. Resident MLS-MPM steps now report per-stage timing for device
  acquisition, P2G, grid update, G2P, thermal, reaction, and compact summary;
  worker SPH rebuild artifacts report `createSphPhaseDemo`, view-state, and
  preflight timing; scene particle sync reports batching, thermal table/graph,
  reaction table, optical table, and surface-application timing. The demo now
  pre-spawns `ulg-runtime`, consumes partial material-closure cache hits instead
  of discarding all hits when a runtime default is missing, derives only missing
  runtime materials individually, and persists deterministic thermal, closure
  graph, phase-response, optical/PBR, reaction-table, and GPU warmup signature
  records into the cold-start cache. Remaining work: actually rehydrate these
  table rows into WebGPU uploads across reloads, move cache serialization off
  the UI thread, and record measured cold/warm deltas.
- Added the first balanced multi-product CPU reference reaction execution
  path. `reactionDiscovery()` now preserves balanced `reactants[]` and
  `products[]` terms in `stoichiometry` and rejects stale persistent reaction
  records that lack those terms. `reactiveStep()` can allocate contact-pair mass
  across all product terms by stoichiometric coefficient and molar mass, so
  room-temperature Na + liquid H2O now produces both NaOH and H2 instead of
  collapsing both reactants to one product. This is still a reduced
  macro-particle reference path; strict validated thermochemistry, full extent
  solving, resident WebGPU multi-product execution, and gas force coupling
  remain open.
- Added a sealed-box gas-pressure diagnostic. The SPH demo now derives baseline
  air moles from the scenario gas closure and adds gas-phase SPH products/vapor
  by material, temperature, and molar mass to compute per-species partial
  pressures and total pressure. The overlay exposes a `gas pressure` row and
  the Na/H2O browser test verifies positive H2 partial pressure after reaction.
  Pressure is diagnostic only until the resident gas EOS consumes the same
  species inventory.
- Rebuilt the ULG Triad PDF current-status artifact after the cold-start,
  balanced-reaction, and gas-pressure continuation. The checked-in
  `plan/ULG_Triad_v0.5_Pretty_Diagrams.pdf` now preserves the original body and
  appends the current status, validation, active risks, and immediate next work
  through page 71. Focused browser validation, full `npm test` (`339/339`),
  `npm run build`, `npm run build:pages`, and `git diff --check` passed at this
  checkpoint.
- Moved SPH static table/GPU-warmup cache serialization into the supervised
  `ulg-runtime` worker. `ulg-runtime` now advertises and executes
  `sph.static-table-cache`; `src/runtime/sph/sphColdStartCache.js` owns the
  static table cache schemas, typed-array payload hashing, warm unchanged-record
  detection, generator invalidation, and rehydration helpers. Static table
  records are stored under a separate localStorage key so reaction cold-cache
  lookups do not parse the large thermal/optical/reaction table payload. The
  overlay persists the worker-returned snapshot and exposes compact counts,
  bytes, backend, and timing only. Validation passed: focused cache/contract
  tests (`7/7`), focused HTTPS SPH browser group (`3/3`), `npm run build`,
  `npm run build:pages`, `git diff --check`, and full `npm test` (`342/342`).
- Added warm static-table cache consumption in the SPH scene. The cache module
  now rehydrates scene-consumable bundles for thermal material tables, thermal
  closure graph banks/sets, thermal phase-response tables, optical/PBR tables,
  and reaction tables. Graph-bank rows are converted back into per-graph CPU
  closure objects with local sample/edge/status offsets so thermal/reaction CPU
  fallbacks still work. `sphPhaseScene.setParticles()` accepts the guarded
  bundle and uses cached families when present; the overlay records
  `staticTableCacheStatus` and `staticTableCacheFamilies`. Focused unit/browser
  coverage and full `npm test` now pass at `343/343`.
- Advanced resident balanced reaction execution beyond the old single-product
  conversion. Packed SPH reaction tables now include reactant term rows,
  product term rows, and gas-product rows in the GPU combined record; static
  table cache rehydration restores the same order. The resident CPU reference
  computes limiting extent from coefficient times molar mass, preserves excess
  reactant mass in-place, applies event heat across product mass, and records a
  fixed-buffer reaction ledger with visible and unplaced product/gas inventory.
  The WGSL reaction resolve kernel now reads reactant/product term rows and
  emits fixed-slot products while preserving leftover reactants. Focused
  reaction/static-cache/ABI tests pass (`30/30`) and the broader
  chemistry/discovery/SPH/resident slice passes (`54/54`). Remaining work:
  resident GPU gas/product ledger buffers, compact no-full-readback pressure
  summaries, and dynamic or inventory-backed product append.
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
- Added the first GPU-executed MLS-MPM mechanics slice:
  `peercompute.ulg.mls-mpm-gpu-mechanics-prediction.v0`,
  `peercompute.ulg.mls-mpm-gpu-mechanics-execution.v0`, and
  `peercompute.ulg.mls-mpm-gpu-mechanics-parity.v0`. The WGSL kernel consumes
  the resident SPH state/thermo rows and MLS-MPM mechanics rows, applies a
  particle-local ballistic/APIC deformation prediction, emits predicted state
  and mechanics rows, and is accepted only after CPU parity. The live browser
  path executes it on WebGPU using the already uploaded buffers. It deliberately
  keeps `p2gValidation`, `gridValidation`, `g2pValidation`, `sphValidation`,
  `phaseChangeValidation`, and `fullPhysicsValidation` false.
- Added the first WebGPU P2G grid projection slice:
  `peercompute.ulg.mls-mpm-gpu-grid-projection.v0`,
  `peercompute.ulg.mls-mpm-gpu-grid-projection-execution.v0`, and
  `peercompute.ulg.mls-mpm-gpu-grid-projection-parity.v0`. The gather-form
  WGSL kernel launches one invocation per grid node, loops over resident
  particle rows, applies CPU-compatible quadratic B-spline support, and writes
  grid mass/momentum rows without float atomics. The live browser path executes
  it on WebGPU from the uploaded SPH/MLS-MPM buffers and accepts it only after
  CPU parity. Stress projection, grid velocity/update, contact/walls, G2P, SPH,
  phase-change, and full-physics validation remain false.
- Restored the SPH phase demo to running by default under strict provenance:
  the ice block starts solid at -40 F, the drop block starts molten from its
  own derived liquidus plus superheat, the preflight uses attached closures
  instead of reference fixtures, and room-temperature Na + H2O can react into
  a derived NaOH product closure when initialized in contact.
- Added the first GPU-resident SPH reaction/material-conversion stage. The ABI
  now declares packed reaction records and product phase mechanics rows;
  `sphReactionGpuKernel.js` builds those tables from the first-principles
  reaction network and derived product closures, runs a deterministic
  mutual-nearest contact proposal/resolve kernel on WebGPU, resolves product
  thermo rows through the shared thermal phase-response table plus thermal
  graph bank, and resets retained MLS-MPM mechanics rows from derived product
  phase properties. The resident MLS-MPM chain now runs P2G -> grid update ->
  G2P -> thermal -> reaction without full particle readback when WebGPU is
  available, then continues from `retained-reaction-output-buffers`. Verified
  in Chromium with Na + liquid H2O: all five resident stages ran on WebGPU, no
  full readback, and the reaction stage retained output buffers. Scientific/
  material/chemistry/phase/full-physics validation remain false.
- Extended the resident MLS-MPM compact GPU summary from mechanics-only
  telemetry to a 128-byte mechanics + thermal/phase summary. The WGSL summary
  now binds retained thermo rows, prefers reaction/thermal output buffers before
  the source upload, and reports phase masses, mass-weighted temperature range,
  ready/problem thermo counts, and compact readback metadata without a full
  particle/grid readback. The SPH overlay shows a `thermal summary` status row.
  This is resident diagnostic telemetry only; scientific/SPH/phase/full-physics
  validation remain false.
- Reduced default SPH demo readbacks in the resident hot loop. The standalone
  MLS-MPM mechanics prediction parity path is now disabled by default because
  the resident P2G -> grid -> G2P chain is the active mechanics path, and the
  resident render bridge now refreshes expensive render-field readbacks on a
  cadence instead of every continuation frame. The overlay exposes
  `render cadence`, `resident profile`, and `standalone mech` rows for timing
  and skipped-readback evidence. The renderer still uses a Three.js/
  MarchingCubes CPU bridge, so a fully GPU-resident renderer remains open.
- Fixed transparent-surface render ordering for the SPH phase renderer. The
  renderer now exports deterministic render-order layers for opaque,
  transmissive, vapor, alpha, and container-wire objects; transparent/
  transmissive surfaces no longer write depth; GPU optical lookup reuses the
  original material/phase descriptor for phase-aware alpha/order decisions; and
  the sealed container wireframe renders last without depth writes. Browser e2e
  now checks live mesh render order/depth-write state.
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
- Updated `plan/todo/sphphasedemo.md` and `plan/todo/perf-upgrade.md` with the honest
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

## 2026-06-10 Update - WebGPU MLS-MPM Stress P2G Slice

Completed:

- Extended the MLS-MPM mechanics GPU particle ABI from 24 to 32 f32 values so
  each particle carries closure-derived constitutive constants on GPU:
  effective bulk modulus, shear modulus, Lame lambda, sound speed, EOS model,
  and constitutive status.
- Stored the demo's CFL-derived global stiffness scale on `state.gpuMechanics`
  so the live WebGPU rows use the same reduced-but-derived moduli as the
  interactive CPU carrier.
- Ported the P2G grid projection from mass/APIC momentum only to stress-aware
  momentum transfer:
  `aff = m*C + (-dt*V*4/dx^2)*sigma`, with fluid pressure from packed EOS
  constants and solid stress from fixed-corotated elasticity.
- Kept the projection gather-form and parity-gated. The visual simulation is
  still CPU-authoritative, and validation flags for stress/grid/G2P/SPH/phase
  physics remain false until the full grid update and G2P loop are resident.

Latest validation:

- PASS: focused ABI/SPH-buffer/P2G/mechanics tests passed `32/32`.
- PASS: focused browser e2e passed against `https://127.0.0.1:5173` (`1/1`).
- PASS: live browser WebGPU probe reported mechanics and P2G both
  `webgpu-executed`, parity `pass`, mechanics stride `32`, P2G kernel scope
  `gather-form-p2g-stress-momentum-projection`, `p2gDt=0.0005`,
  `gridNodeCount=13824`, and `maxGridAbs=0.00006866455078125`.
- PASS: `npm test` (`258/258`).
- PASS: `npm run build` with the existing Vite large-chunk warning.

Not claimed:

- The GPU path now computes stress contribution during P2G, but does not yet
  update grid velocities, apply wall/contact constraints, CFL-clamp grid nodes,
  or perform G2P reconstruction.
- CPU carrier state still drives the visible particles.

## 2026-06-11 Update - WebGPU MLS-MPM Grid Update Slice

Completed:

- Added grid-update ABI schemas and an 8-float grid velocity row layout carrying
  mass, post-update velocity, node position, and status.
- Added `mlsMpmGridUpdateWgsl` plus CPU/WebGPU/parity runtime wrappers for the
  MLS-MPM grid velocity update stage.
- Implemented the CPU carrier's grid update formula on WebGPU: momentum divided
  by mass, gravity integration, CFL velocity clamp, and sealed-box into-wall
  normal velocity clamping.
- Wired the SPH phase scene and overlay to schedule grid update after P2G and
  expose `getMlsMpmGridUpdate()`.
- Added retained GPU output buffers on the successful WebGPU P2G and grid-update
  paths. P2G now keeps a resident grid buffer for grid update, and grid update
  keeps a resident velocity-grid buffer for the next G2P slice.

Latest validation:

- PASS: focused ABI/P2G/grid-update tests passed `26/26`.
- PASS: focused browser e2e passed against `https://127.0.0.1:5173` (`1/1`).
- PASS: live browser WebGPU probe reported P2G and grid update both
  `webgpu-executed`, grid-update parity `pass`,
  `maxGridAbs=4.656612873077393e-10`, P2G retained grid buffer `true`,
  grid-update retained velocity buffer `true`, both buffer byte lengths
  `442368`, `gridNodeCount=13824`, and `particleCount=152`.
- PASS: `npm test` (`267/267`).
- PASS: `npm run build` with the existing Vite large-chunk warning.

Not claimed:

- G2P reconstruction is not implemented yet, so the visual simulation remains
  CPU-authoritative.
- Thermal/phase/reaction/wall heat updates are still CPU-side in the live demo.

## 2026-06-11 Update - WebGPU MLS-MPM G2P Reconstruction Slice

Completed:

- Added a G2P reconstruction ABI and WGSL kernel for the MLS-MPM GPU path.
- Added `src/runtime/sph/sphG2pGpuKernel.js` with CPU reference, optional
  WebGPU execution, parity gating, and fallback statuses.
- Consumed the retained grid-update velocity buffer directly when WebGPU
  execution is available.
- Reconstructed velocity, affine `C`, deformation gradient `F`, and volume ratio
  `J`, including sealed-box position and inward velocity clamps.
- Wired scene/overlay scheduling so G2P runs after grid update and is exposed
  through `getMlsMpmG2pReconstruction()`.

Latest validation:

- PASS: focused ABI/G2P tests passed `18/18`.
- PASS: focused ABI/G2P/P2G/grid-update tests passed `35/35`.
- PASS: focused browser e2e passed against `https://127.0.0.1:5173` (`1/1`).
- PASS: live browser WebGPU probe reported G2P `webgpu-executed`, parity
  `pass`, `maxStateAbs=0.004903326742351055`,
  `maxMechanicsAbs=0.016690582036972046`, tolerance `0.05`,
  `particleCount=152`, and `gridNodeCount=13824`.
- PASS: `npm test` (`276/276`).
- PASS: `npm run build` with the existing Vite large-chunk warning.

Not claimed:

- The visible SPH demo is still CPU-authoritative.
- P2G, grid update, and G2P need to be chained into one resident step with
  compact diagnostics before it can be used as the normal hot loop.
- Thermal/phase/reaction/wall heat updates remain CPU-side in the live demo.

## 2026-06-11 Update - WebGPU MLS-MPM Resident Step Slice

Completed:

- Added `src/runtime/sph/sphMlsMpmGpuStep.js` as the runtime owner for a
  single MLS-MPM resident step: P2G -> grid update -> G2P.
- Added resident-step ABI schemas:
  `peercompute.ulg.mls-mpm-gpu-resident-step.v0` and
  `peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0`.
- The resident step shares a WebGPU device, reuses uploaded particle buffers,
  retains the P2G grid buffer for grid update, and retains the updated velocity
  grid buffer for G2P.
- Added compact diagnostics for mass/momentum deltas, active grid nodes, max
  speed, max displacement, and volume-ratio range.
- Changed the live SPH scene/overlay to schedule the resident step directly
  while preserving the old P2G/grid-update/G2P getters from the chain output.
- Fixed a P2G device-loss fallback bug that referenced `gpuResult` before the
  variable existed.

Latest validation:

- PASS: syntax checks for the new runtime module, scene, mount, P2G module, and
  browser e2e file.
- PASS: focused ABI/P2G/grid-update/G2P/resident-step tests passed `39/39`.
- PASS: focused browser e2e passed against `https://127.0.0.1:5173` (`1/1`).
- PASS: live flagged-WebGPU browser probe reported resident step `webgpu`,
  P2G/grid-update/G2P all `webgpu-executed`, all three parity reports `pass`,
  retained buffers `true`, `activeGridNodeCount=280`, `massDeltaKg=0`,
  `particleCount=152`, and `gridNodeCount=13824`.
- PASS: `npm test` (`280/280`).
- PASS: `npm run build` with the existing Vite large-chunk warning.

Not claimed:

- The visible SPH demo is still CPU-authoritative.
- The resident step still reports `readbackMode=full-parity-readback`,
  `normalHotLoopReadbackFree=false`, and `gpuAuthoritativeState=false`.
- G2P output buffers are not yet retained as ping-pong inputs for repeated GPU
  stepping.
- Thermal/phase/reaction/wall heat updates remain CPU-side in the live demo.

## 2026-06-11 Update - Retained G2P Output And Ping-Pong Metadata

Completed:

- Added retained G2P output state/mechanics buffers after parity-passing WebGPU
  execution.
- Exposed retained output buffers as resident-step `nextParticleUploads`.
- Added ownership flags to SPH and MLS-MPM upload descriptors, and made destroy
  helpers honor borrowed buffers.
- Added resident-step ping-pong metadata: source slot, next slot, source step,
  next step, source time, and next time.
- Extended browser e2e telemetry to assert retained G2P output buffers and
  ping-pong metadata.

Latest validation:

- PASS: focused SPH-buffer/G2P/resident-step tests passed `21/21`.
- PASS: focused ABI/SPH-buffer/P2G/grid-update/G2P/resident-step tests passed
  `49/49`.
- PASS: focused browser e2e passed against `https://127.0.0.1:5173` (`1/1`).
- PASS: flagged-WebGPU browser probe reported retained stage buffers `true`,
  retained G2P output buffers `true`,
  `nextParticleBufferMode=retained-g2p-output-buffers`,
  output byte lengths `4864` and `19456`, ping-pong slot `0 -> 1`,
  `nextTime=0.0005`, and P2G/grid-update/G2P parity `pass`.
- PASS: `npm test` (`283/283`).
- PASS: `npm run build` with the existing Vite large-chunk warning.

Not claimed:

- The retained outputs are not yet swapped into a repeated GPU hot loop.
- Full parity readback is still active.
- CPU state remains authoritative for visible motion, thermal state, phase
  changes, reactions, wall heat, and status.

## 2026-06-11 Update - Multi-Step Resident Ping-Pong

Completed:

- Added `runMlsMpmResidentStepsWithOptionalWebGpu()` as a repeated MLS-MPM
  resident-step execution wrapper.
- Added ABI schema
  `peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0`.
- The repeated-step wrapper feeds each accepted G2P retained state/mechanics
  output buffer into the next resident step as `nextParticleUploads`.
- Added sequence summaries that preserve per-step backend, stage status,
  retained-buffer, diagnostics, and ping-pong metadata without retaining every
  intermediate buffer by default.
- Added `destroyMlsMpmResidentStepsBuffers()` for final plus optionally
  retained intermediate cleanup.

Latest validation:

- PASS: focused ABI/resident-step tests passed `15/15`.
- PASS: broader ABI/SPH-buffer/P2G/grid-update/G2P/resident-step tests passed
  `50/50`.
- PASS: `npm test` passed `284/284`.
- PASS: `npm run build` passed with the existing Vite large-chunk warning.
- PASS: `git diff --check`.

Not claimed:

- This is still a parity/readback evidence path. The wrapper reports
  `readbackMode=full-parity-readback`,
  `normalHotLoopReadbackFree=false`, and `gpuAuthoritativeState=false`.
- The live scene is not wired to run multiple resident steps per visual frame
  yet.
- CPU state remains authoritative for visible motion, thermal state, phase
  changes, reactions, wall heat, gas pressure, and status.

## 2026-06-11 Update - Scene-Scheduled Multi-Step Resident Chain

Completed:

- Wired `sphPhaseScene` to expose `refreshMlsMpmResidentSteps()` and
  `getMlsMpmResidentSteps()`.
- The SPH phase demo mount now schedules two resident MLS-MPM steps per GPU
  scene update.
- The old single-step getters remain compatible by pointing at the sequence's
  final step.
- Added sequence-aware cleanup so resident stage buffers are destroyed as one
  sequence instead of double-destroying P2G/grid-update/G2P artifacts.
- Extended browser e2e coverage for the sequence artifact, final-step artifact,
  two-step ping-pong metadata, and the explicit non-authoritative/readback
  flags.

Latest validation:

- PASS: syntax checks for scene, mount, and browser e2e files.
- PASS: focused resident-step and SPH renderer tests passed `9/9`.
- PASS: focused HTTPS browser e2e passed against the live server.
- PASS: flagged browser WebGPU probe reported two resident steps on WebGPU,
  both with P2G/grid-update/G2P `webgpu-executed`, ping-pong `0 -> 1` then
  `1 -> 0`, `activeGridNodeCount=280`, `massDeltaKg=0`, and final G2P output
  buffers retained.
- PASS: `npm run build` passed with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: Vite is listening on `0.0.0.0:5173`; local HTTPS returned `200` and
  current Tailscale/VPN URL `https://100.86.83.35:5173/` returned `200`.

Not claimed:

- The sequence still reports `readbackMode=full-parity-readback`,
  `normalHotLoopReadbackFree=false`, and `gpuAuthoritativeState=false`.
- CPU state remains authoritative for visible motion, thermal state, phase
  changes, reactions, wall heat, gas pressure, and status.

## 2026-06-11 Update - No-Full-Readback Resident Step Foundation

Completed:

- Added opt-in `readbackMode: 'no-full-readback'` to the P2G, grid-update,
  G2P, single resident-step, and repeated resident-step runtime path.
- P2G/grid-update/G2P WebGPU runners can now skip full output-buffer readback
  while retaining the GPU storage buffers needed by the next stage.
- Optional wrappers avoid CPU-reference/parity work on no-full-readback success
  and mark parity reports as `not-run-no-full-readback`.
- Resident diagnostics switch to metadata-only values when full arrays are not
  read back; no mass/speed/active-node values are faked.
- Repeated no-readback steps preserve stale CPU arrays only for metadata and
  buffer sizing, mark the packed state as unread/stale, and feed retained G2P
  buffers into the next step.

Latest validation:

- PASS: syntax checks for P2G, grid update, G2P, resident-step, and tests.
- PASS: focused resident-step tests passed `6/6`.
- PASS: broader ABI/P2G/grid-update/G2P/resident-step tests passed `43/43`.
- PASS: `git diff --check`.

Not claimed:

- This is not yet the default live scene mode.
- There are no compact GPU summary buffers yet, so diagnostics are
  metadata-only in no-full-readback mode.
- `gpuAuthoritativeState` remains false and render state is not GPU
  authoritative.

## 2026-06-11 Update - SPH Demo No-Full-Readback + Compact Summary

Completed:

- Added `peercompute.ulg.mls-mpm-gpu-resident-summary.v0` and a compact
  f32x4-aligned resident summary row layout.
- Added a browser WebGPU compact summary pass for resident MLS-MPM steps. It
  reads retained source/output particle buffers plus the updated grid buffer
  and returns only the compact diagnostic row, not full particle/grid arrays.
- Upgraded that compact summary from a single-invocation GPU loop to a two-pass
  workgroup reduction: 64-lane partial summaries followed by a small final
  reduction into the same 80-byte diagnostic record.
- Resident diagnostics now use compact GPU summary values in
  no-full-readback mode when available: active grid nodes, source/next mass,
  momentum delta, max speed, max displacement, and min/max volume ratio.
- The SPH phase scene now defaults resident-step requests to
  `readbackMode: 'no-full-readback'` and includes that request in resident
  execution cache signatures.
- The SPH phase demo scheduler explicitly requests no-full-readback for the
  two-step resident chain and exposes requested versus actual readback mode.
- Overlay status now reports resident backend, requested/actual readback mode,
  render-readback availability, hot-loop no-full status, and
  `gpuAuthoritativeState`.
- Browser e2e coverage now requires the no-full request, accepts no-full
  WebGPU substages without parity readback, requires the compact WebGPU summary
  on real WebGPU execution, and keeps CPU/mixed fallback on the honest
  full-readback diagnostics path.

Latest validation:

- PASS: `npm test` passed `289/289`.
- PASS: `npm run build` passed with the existing Vite large-chunk warning.
- PASS: `node --test tests/abi.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  passed `20/20`.
- PASS: `node --check src/visualization/sphPhaseScene.js &&
  node --check src/visualization/sphPhaseDemoMount.js &&
  node --check tests/demo.e2e.mjs`.
- PASS: focused HTTPS browser e2e passed against the live server:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1
  npx playwright test --config tests/playwright.config.mjs -g "SPH phase demo
  runs derived material properties by default"` (`1/1`) with the two-pass
  summary WGSL.
- PASS: Vite HTTPS server remains bound to `0.0.0.0:5173`; local
  `https://127.0.0.1:5173/` and VPN `https://100.86.83.35:5173/` returned
  `200`.
- PASS: `git diff --check`.

Not claimed:

- `gpuAuthoritativeState` remains false; no render-authoritative physics is
  claimed.
- The compact summary still has a serial final pass over partial rows. That is
  much smaller than scanning every particle/grid node, but future very large
  runs should replace it with recursive partial reductions.
- Full particle/grid arrays are still not read back in normal no-full mode.

## 2026-06-11 Update - Resident MLS-MPM Continuation

Completed:

- Extended repeated resident-step executions to return the next packed SPH
  state, next packed MLS-MPM mechanics state, retained next particle uploads,
  and next particle buffer mode.
- `sphPhaseScene.refreshMlsMpmResidentSteps()` can now continue from the
  previous resident execution's retained G2P output buffers when the requested
  mode is `no-full-readback`.
- The SPH phase demo scheduler now starts from the CPU-packed upload, then
  schedules bounded follow-up resident chains from
  `previous-gpu-resident-output` while the same particle-sync generation is
  current.
- Overlay status reports resident source mode, whether the execution continued
  from resident GPU state, whether a next continuation is available, and compact
  summary status/mode/reduction strategy.
- Browser e2e now waits for and asserts a real WebGPU continuation path when
  the browser supports no-full-readback resident execution; CPU/mixed fallback
  still reports `cpu-packed-state` and full-readback honestly.

Latest validation:

- PASS: syntax checks for scene, mount, and browser e2e files.
- PASS: `node --test tests/abi.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  passed `20/20`.
- PASS: `npm test` passed `289/289`.
- PASS: `npm run build` passed with the existing Vite large-chunk warning.
- PASS: focused HTTPS Chromium/WebGPU e2e passed against the live server:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1
  npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs
  -g "SPH phase demo runs derived material properties by default"` (`1/1`,
  about 1.0 minutes).
- PASS: `git diff --check`.

Not claimed:

- This only chains resident MLS-MPM state/mechanics buffers. Thermal state,
  phase changes, reactions, wall heat, gas pressure, and material closure
  updates remain CPU-side.
- `gpuAuthoritativeState` remains false, and Three.js rendering is still fed
  from CPU-side visual particles rather than a WebGPU render buffer.

## 2026-06-11 Update - Resident Thermal/Thermo GPU Stage

Completed:

- Added `peercompute.ulg.sph-gpu-thermal-material-table.v0` plus stable
  f32x4-aligned material-record and phase-segment row layouts.
- Added `peercompute.ulg.sph-gpu-thermal-step.v0` and a WGSL thermal kernel
  that consumes resident SPH state/thermo buffers plus a closure-derived
  material phase table, applies pairwise compact-support conduction and six
  explicit wall reservoirs, and writes refreshed state/internal-energy and
  thermo rows.
- The thermal material table is generated from material closure energy/phase
  segments, keyed by stable material id, so elements and compounds use the same
  path rather than one-off Fe/H2O patches.
- Resident MLS-MPM steps can now run the thermal stage after G2P and before the
  next P2G, retaining thermal output `stateBuffer`/`thermoBuffer` while keeping
  G2P mechanics buffers resident.
- The live SPH scene builds a thermal material table from the active derived
  material closures and passes it into resident MLS-MPM chains. Overlay status
  and browser e2e now surface the resident thermal stage.

Latest validation:

- PASS: syntax checks for ABI, WGSL, thermal kernel, resident-step, scene,
  mount, and browser e2e files.
- PASS: focused ABI/thermal/resident-step tests passed `27/27`.
- PASS: `npm test` passed `296/296`.
- PASS: `npm run build` passed with the existing Vite large-chunk warning.
- PASS: focused HTTPS Chromium/WebGPU e2e passed against the live server:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1
  npx playwright test --config tests/playwright.config.mjs tests/demo.e2e.mjs
  -g "SPH phase demo runs derived material properties by default"` (`1/1`,
  about 59 seconds), requiring `thermal-step-executed` on WebGPU and
  `retained-thermal-output-and-g2p-mechanics-buffers`.

Not claimed:

- This is a resident thermal/thermo refresh stage, not full GPU-authoritative
  chemistry. Reactions/material conversion, product-closure changes, gas
  pressure summaries, and render-authoritative positions still need GPU paths.
- The thermal phase table is a closure-derived lookup representation; it is
  evidence-level and keeps scientific/material/phase validation flags false.
- `gpuAuthoritativeState` remains false because the visible Three.js renderer
  still consumes CPU-side visual particles.

## 2026-06-11 Update - Resident Reaction/Render Rows And WebGPU Layout Hardening

Completed:

- Added compact SPH render-row ABI/runtime extraction:
  `peercompute.ulg.sph-gpu-render-rows.v0` and
  `peercompute.ulg.sph-gpu-render-rows-execution.v0`.
- Added a WebGPU render-row kernel that extracts position, mass, material id,
  phase id, temperature, rest density, gas fraction, and represented entity
  count from retained resident SPH state/thermo buffers.
- Refactored the continuous SPH scene surfaces so CPU visual particles and
  resident GPU render rows use the same batching, optical lookup, emissive, and
  MarchingCubes path.
- Wired the demo scheduler so successful no-full-readback resident WebGPU steps
  refresh the visible surfaces from compact render rows instead of clearing back
  to CPU visual particles.
- Fixed the Na + water resident reaction/render bug where invalid WebGPU
  pipelines left render rows as `unknown`. The reaction table now packs product
  phase mechanics rows into the same GPU storage buffer as reaction rows, which
  keeps the resolve pass at this browser adapter's 10-storage-buffer limit.
- Replaced SPH/MLS-MPM hot-path `layout: 'auto'` pipelines with explicit
  compute bind group layouts for mechanics, P2G, grid update, G2P, thermal,
  reaction, compact summary, optical lookup, and render-row extraction.
- `requestOpticalGpuDevice()` now requests
  `maxStorageBuffersPerShaderStage: 10` when the adapter supports it, so the
  resident reaction resolve pass gets the required device limit.
- Disabled `preserveDrawingBuffer` for the SPH Three.js renderer. Profiling
  showed headless WebGL readback/flush stalls dominating the trace while JS
  execution remained small.

Latest validation:

- PASS: focused kernel/layout tests including ABI, optical GPU buffers, reaction
  GPU, mechanics, grid, grid update, resident steps, render rows, and thermal
  paths.
- PASS: final full Node test suite passed `308/308`.
- PASS: `npm run build` passed with the existing Vite large-chunk warning.
- PASS: focused HTTPS Chromium e2e passed after the renderer perf change:
  `PLAYWRIGHT_BASE_URL=https://127.0.0.1:5173 PLAYWRIGHT_SKIP_WEB_SERVER=1
  npx playwright test --config tests/playwright.config.mjs --project=chromium
  -g "SPH phase demo runs derived material properties by default"` (`1/1`,
  about 1.2 minutes).
- PASS: manual Chromium/WebGPU Na + water probe reported resident render rows
  from WebGPU with material keys `h2o`, `Na`, and `naoh`, phase keys `liquid`,
  `gas`, and `solid`, three visible resident surfaces, optical lookup row
  indices attached, and zero WebGPU bind group/validation warnings.
- PERF: browser profiling after resident render activation showed JS script
  time around `33 ms` over the sampled window; GPU-process stalls are dominated
  by headless WebGL readback/flush behavior. Turning off SPH
  `preserveDrawingBuffer` reduced observed `GLES2::ReadPixels` calls in the
  sampled window from `18` to `5`.

Not claimed:

- `gpuAuthoritativeState` in the overlay still means the full simulation state
  is not yet fully GPU-authoritative across all diagnostics; the new render
  state itself is GPU-authoritative and compact-readback backed.
- Render rows still perform a compact readback into Three.js. The next renderer
  step is direct GPU-driven draw buffers rather than CPU-side surface rebuilds.
- Cherenkov, radioactive decay, fission, fusion, activation, and ionizing
  radiation remain planned closure families, not implemented solvers.

## 2026-06-11 Update - Generic Resident SPH Render Field

Completed:

- Added `peercompute.ulg.sph-gpu-render-field.v0` and execution schema for
  generic material/phase render fields.
- Added `sphRenderFieldWgsl`, which consumes compact resident render rows and a
  surface table keyed by material id + phase id, then writes flattened
  density/palette fields.
- Added runtime helpers to build surface tables, CPU reference fields, WebGPU
  field output, and per-surface field slices without material-specific
  interaction branches.
- Wired the resident scene renderer so successful WebGPU resident steps render
  via `resident-gpu-render-field`; compact rows and CPU particles remain
  fallback paths.
- Added a generic resident bridge resolution cap of 32 cells per axis, reducing
  default Fe/H2O field readback to `1048576` bytes while preserving visible H2O.

Latest validation:

- PASS: syntax checks for touched runtime/scene/test files.
- PASS: focused ABI/render tests passed `23/23`.
- PASS: focused scene renderer tests passed `6/6`.
- PASS: focused HTTPS Chromium e2e passed `1/1`.
- PASS: manual Fe/H2O and Na/H2O browser probes showed
  `resident-gpu-render-field` with material keys preserved and visible H2O.
- PASS: `git diff --check`.

Not claimed:

- The renderer is still not direct WebGPU draw/volume rendering. It reads the
  field back to CPU and still uses Three.js MarchingCubes polygonization.
- Per-cell temperature-varying optical/radiation color and gas
  condensation/scattering remain future GPU closure-sampling work.

## 2026-06-11 Update - Current Performance Slice

Completed:

- Retaining the WebGPU compact SPH render-row buffer after extraction and
  borrowing it directly in the resident render-field kernel. This keeps the
  current metadata readback for the Three.js bridge, but removes the redundant
  render-row reupload on the successful WebGPU render-field path.
- Recording `renderFieldInputSource = resident-render-rows-buffer`,
  `renderRowsBufferRetained`, and retained-buffer byte length in the live demo
  telemetry and browser e2e expectations.
- Added the flat closure-law graph WebGPU target to `plan/todo/perf-upgrade.md`.
  The intended architecture is CPU compile/validation of the law graph followed
  by WebGPU evaluation from flat closure node/edge/table buffers. This belongs
  before the full 60 Hz SPH/MLS-MPM/nuclear hot loop because it removes
  per-frame JS closure traversal without weakening first-principles provenance.

Latest validation:

- PASS: syntax checks for `src/runtime/sph/sphRenderGpuKernel.js`,
  `src/visualization/sphPhaseScene.js`, and `tests/demo.e2e.mjs`.
- PASS: `node --test tests/sphRenderGpuKernel.test.mjs` (`7/7`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: `npm test` (`313/313`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.

Not claimed:

- The render path is still not direct WebGPU volume rendering.
- At this checkpoint the closure-law graph flat-buffer evaluator was planned
  but not implemented; the following update records the first implemented
  table-linear graph slice.

## 2026-06-11 Update - Flat Closure-Law Graph Runtime Slice

Completed:

- Added flat closure-law graph ABI rows and schemas:
  `peercompute.ulg.closure-law-graph.v0` and execution
  `peercompute.ulg.closure-law-graph-execution.v0`.
- Added CPU compile/validation for table-interpolation closure artifacts into
  flat graph buffers. The compiler rejects unsorted table axes and preserves
  domain exits as status rows rather than silently clamping.
- Added CPU and WebGPU evaluators for table-linear closure nodes. WebGPU reads
  graph node/sample/slot buffers and writes slot/status buffers.
- Added parity-gated optional WebGPU execution for the flat graph path.
- Fixed shared WGSL prelude compatibility by renaming reserved field
  `TensorDescriptor.layout` to `tensor_layout`.

Latest validation:

- PASS: syntax checks for the touched closure graph, closure handle, ABI, WGSL,
  and test files.
- PASS: `node --test tests/closureLawGraph.test.mjs tests/abi.test.mjs`
  (`24/24`).
- PASS: manual Chromium/WebGPU probe against `https://127.0.0.1:5173/` with
  WebGPU flags reported `backend = webgpu`, `status = webgpu-accepted`, parity
  `pass`, `maxSlotAbs = 0`, and `maxStatusAbs = 0`.

Not claimed:

- Only table-linear closure nodes are implemented so far.
- SPH/MLS-MPM kernels do not yet consume closure-law graph slot buffers.

## 2026-06-11 Update - Carrier Closure Graph Bridge

Completed:

- Added `carrierGraphStepWgsl`, which drives the existing toy carrier WebGPU
  step from flat closure-law graph buffers.
- Updated the real WebGPU carrier runner to compile the closure artifact into a
  flat graph and bind graph node/sample/slot/status buffers instead of the old
  direct sample buffer.
- Carrier WebGPU results now report a `closureLawGraph` metadata block with
  `backend = webgpu-resident-flat-graph`.

Latest validation:

- PASS: focused carrier/closure/ABI tests passed `32/32`.
- PASS: manual Chromium/WebGPU probe against `https://127.0.0.1:5173/` with
  WebGPU flags reported `backend = webgpu`, carrier parity `pass`, max position
  drift about `5.7e-9`, max velocity drift about `1.6e-9`, and invariant status
  `pass`.

Not claimed:

- This is a compatibility bridge for the toy carrier runtime. It does not yet
  move SPH/MLS-MPM material closure sampling onto the flat graph.

## 2026-06-11 Update - SPH Thermal Closure Graph Artifact

Completed:

- Added `peercompute.ulg.sph-gpu-thermal-closure-graph-set.v0` as the SPH
  thermal graph artifact schema.
- Added `buildSphThermalClosureGraphBuffers()`, which emits one flat
  closure-law graph per derived thermal segment for
  `specificInternalEnergyJPerKg -> temperatureK`.
- The graph builder consumes the same closure-derived SPH thermal material
  table that drives the CPU/WebGPU thermal path, preserves material id, phase
  id, source segment index, and temperature derivative metadata, and rejects
  non-positive energy domains by reporting skipped segments rather than
  fabricating a fake domain.
- Exposed the graph set from the browser SPH phase scene as
  `getSphThermalClosureGraphBuffers()`.

Latest validation:

- PASS: syntax checks for `src/runtime/sph/sphThermalGpuKernel.js`,
  `src/visualization/sphPhaseScene.js`, and
  `tests/sphThermalGpuKernel.test.mjs`.
- PASS: `node --test tests/sphThermalGpuKernel.test.mjs` (`6/6`).
- PASS: `node --test tests/sphThermalGpuKernel.test.mjs
  tests/closureLawGraph.test.mjs tests/abi.test.mjs` (`30/30`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/`
  confirmed the demo scene exposes the thermal closure graph set (`1/1`).
- PASS: full `npm test` (`323/323`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.

Not claimed:

- The thermal WebGPU kernel still consumes the existing material/phase segment
  table. This slice exports graph buffers and proves parity; it does not yet
  replace phase selection in the hot loop.
- Phase ids, phase fractions, density selection, and plateau mixture state are
  not encoded as scalar graph outputs. They remain table-driven until the flat
  graph ABI has explicit selector/categorical outputs.

## 2026-06-11 Update - SPH Thermal Phase-Response ABI

Completed:

- Added `peercompute.ulg.sph-gpu-thermal-closure-graph-bank.v0` as the packed
  thermal temperature-graph bank artifact. The bank concatenates graph
  node/sample/slot/status rows so the next WebGPU thermal kernel slice can bind
  one graph-bank buffer set instead of arrays of JS graph objects.
- Added `peercompute.ulg.sph-gpu-thermal-phase-response-table.v0` with
  material response records and explicit phase-response rows. These rows encode
  segment type, temperature graph index, energy domain, phase endpoints, density
  endpoints, density/stable-phase policy ids, and plateau fraction coefficients.
- Added `buildSphThermalPhaseResponseTable()`,
  `resolveThermalPhaseResponseFromTable()`, and
  `resolveThermalStateFromGraphPhaseResponseCpu()`.
- Added generic `tableStep` support to the flat closure-law graph CPU/WebGPU
  evaluator for future explicit selector nodes. SPH thermal does not use graph
  scalar slots for phase ids or density in this slice.

Latest validation:

- PASS: syntax checks for the touched SPH thermal runtime, graph runtime, ABI,
  WGSL, and tests.
- PASS: `node --test tests/abi.test.mjs tests/closureLawGraph.test.mjs
  tests/sphThermalGpuKernel.test.mjs` (`32/32`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`325/325`).

Not claimed:

- The WebGPU thermal kernel still binds the legacy thermal segment table. The
  new response table and graph bank are CPU-validated artifacts ready for the
  next kernel-binding slice.
- The current density policy intentionally preserves the legacy
  dominant-at-half plateau behavior. It is explicit policy metadata, not a
  claim of physically validated mixture density.

## 2026-06-11 Update - SPH Thermal Response/Graph WebGPU Binding

Completed:

- Updated `sphThermalStepWgsl` to bind phase-response records, phase-response
  rows, thermal graph node rows, and thermal graph sample rows.
- The shader now selects the response row by material id and internal energy,
  evaluates temperature from the packed graph-bank sample rows using
  per-invocation local values, and projects the explicit phase-response row into
  the existing particle thermo layout.
- Updated `runSphThermalStepWebGpu()` to build or accept prebuilt thermal graph
  sets, graph banks, and phase-response tables, then upload/bind those buffers
  instead of legacy thermal segment rows.
- Updated the SPH scene to build the graph set and phase-response table once
  when particles/materials are set, then pass those cached artifacts into
  resident thermal steps.
- Browser e2e now confirms the demo scene exposes both the graph bank and the
  phase-response table.

Latest validation:

- PASS: syntax checks for touched shader/runtime/scene/test files.
- PASS: `node --test tests/abi.test.mjs tests/sphThermalGpuKernel.test.mjs
  tests/closureLawGraph.test.mjs` (`32/32`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`325/325`).

Not claimed:

- Reaction WebGPU still uses the legacy thermal segment table for product phase
  reset. That is the next thermal-response consumer to migrate.
- The thermal kernel still uploads response/graph buffers on each WebGPU
  invocation unless callers pass cached artifacts, which the scene now does.

## 2026-06-11 Update - SPH Reaction Response/Graph Binding

Completed:

- Updated `sphReactionStepWgsl` so the reaction resolve pass binds thermal
  phase-response records, phase-response rows, thermal graph node rows, and
  thermal graph sample rows.
- Product material conversion now resolves temperature from the packed thermal
  graph bank and phase/density/fraction state from the thermal phase-response
  table instead of reinterpreting legacy segment rows.
- `runSphReactionStepCpu()` and `runSphReactionStepWebGpu()` now build or
  accept `thermalClosureGraphSet`, graph bank, and
  `thermalPhaseResponseTable` artifacts, and report their schemas/counts in the
  reaction execution envelope.
- The SPH phase scene now passes the cached thermal graph/response artifacts
  into both resident thermal and resident reaction steps.
- Focused tests now assert that reaction WGSL no longer references
  `thermal_segments`, that it binds response/graph buffers, and that explicit
  graph/response artifacts produce the same reaction CPU output as generated
  artifacts.

Latest validation:

- PASS: syntax checks for touched runtime, scene, WGSL, and tests.
- PASS: `node --test tests/abi.test.mjs tests/sphReactionGpuKernel.test.mjs
  tests/sphThermalGpuKernel.test.mjs` (`29/29`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`326/326`).

Not claimed:

- Thermal response/graph buffers are still uploaded per invocation. The next
  task is persistent GPU-side response/graph buffer ownership across resident
  thermal and reaction steps.
- The renderer still needs the queued transparent z-buffer/render-order fix
  after the five current GPU-runtime tasks are complete.

## 2026-06-11 Update - Persistent SPH Thermal Response/Graph Upload

Completed:

- Added `peercompute.ulg.sph-gpu-thermal-response-graph-buffer-set.v0` for the
  persistent runtime WebGPU upload that contains thermal phase-response records,
  phase-response rows, thermal graph node rows, and thermal graph sample rows.
- Added `uploadSphThermalResponseGraphBuffers()` and
  `destroySphThermalResponseGraphBuffers()` in `sphThermalGpuKernel.js`.
- Updated `runSphThermalStepWebGpu()` and `runSphReactionStepWebGpu()` to
  borrow `thermalResponseGraphUpload` when supplied, otherwise create and
  destroy a temporary upload for standalone calls.
- Added scene-level caching that reuses the upload across particle syncs while
  the derived thermal response/graph signature is unchanged, invalidates it on
  material/graph changes, and destroys it on scene disposal.
- The resident SPH/MLS-MPM path now passes the same cached upload into both
  thermal and reaction stages. The live status panel reports
  `thermal graph gpu: status=... responses=... graphs=... bytes=...`.

Latest validation:

- PASS: syntax checks for touched runtime, scene, mount, and test files.
- PASS: `node --test tests/abi.test.mjs tests/sphThermalGpuKernel.test.mjs
  tests/sphReactionGpuKernel.test.mjs tests/sphMlsMpmGpuStep.test.mjs`
  (`40/40`).
- PASS: focused HTTPS Chromium e2e against `https://127.0.0.1:5173/` (`1/1`).
- PASS: `npm run build` with the existing Vite large-chunk warning.
- PASS: `git diff --check`.
- PASS: full `npm test` (`327/327`).

Not claimed:

- Compact thermal/phase GPU summaries are still pending.
- The transparent z-buffer/render-order fix remains queued until the five
  current GPU-runtime tasks are complete.

## 2026-06-11 Update - SPH Box/Grid, Worker Rebuild, Cache/Warnings, Reaction Candidates

Completed:

- Continuous SPH surface radius is now derived from particle spacing or the
  packed smoothing length, not the box dimensions. Increasing the sealed box
  size now leaves rendered blobs at the same physical size while the MLS-MPM
  grid dimensions and node count grow.
- The SPH phase overlay now shows WebGPU/CPU warnings plus separate render,
  physics, and resident FPS counters. CPU closure work is visible as a warning
  while active.
- Derived material closures are mirrored into
  `peercompute.ulg.sph-derived-closure-cache.v1` in `localStorage` and reused
  on later rebuilds when required runtime defaults are present.
- Added `sph.phase.rebuild` to the `ulg-runtime` service contract and worker.
  The SPH overlay now submits material/reaction/view-state rebuilds through the
  supervised worker when `window.__ulgDemo` provides `runSphPhaseRebuild()`,
  applies the returned typed arrays/buffers, and falls back to main-thread
  derivation only if the worker path fails or is unavailable.
- Added a DOM-free `createSphPhaseViewState()` runtime helper shared by the
  overlay and worker.
- Added `src/runtime/chemistry/` formula/candidate utilities for general
  formula parsing and balanced reaction candidates. The SPH reaction discovery
  adapter now consumes balanced candidate records for active metal + water and
  binary ionic element/nonmetal pairs, including Na + Cl/Cl2 and balanced
  Fe(OH)2 for Fe + H2O.
- Regenerated `docs/` with `npm run build:pages`.

Latest validation:

- PASS: focused renderer, contract, chemistry, and reactive-chemistry Node
  tests (`22/22`).
- PASS: focused `tests/reactionDiscovery.test.mjs` (`7/7`; slow integration
  evidence).
- PASS: focused HTTPS Chromium e2e (`1/1`).
- PASS: manual HTTPS Chromium worker/grid probe reported worker status
  `complete`, view state source `peercompute-worker-packed-state`, and
  expanded grid `30x18x18` for a 10 m X box at `dx=0.400m`.
- PASS: `npm run build` and `npm run build:pages` with the existing Vite
  large-chunk warning.
- PASS: `git diff --check`.

Not claimed:

- General reaction energetics are still mixed: negative derived energies are
  used where available, but crude generated geometries that produce false
  endothermic signs fall back to explicit provisional candidate energetics.
- Runtime chemistry still applies one product key per contact; full
  stoichiometric multi-product particle conversion and gas byproduct pressure
  accounting remain future work.
- Product-closure derivation for heavy compounds can be slow and should move
  behind worker/WebGPU-resident cache/peer reuse before broad all-element UI
  sweeps.

## 2026-06-11 Update - PeerCompute Local Closure Cache Invalidation

Completed:

- Upgraded the browser-local SPH material closure cache to
  `peercompute.ulg.local-derived-closure-cache.v2` while preserving the
  existing localStorage namespace so the browser can build a larger reusable
  library over time.
- Cache records are now hash-keyed and indexed by material. Each record stores
  `inputHash`, `methodHash`, `validityDomainHash`, `propertiesHash`, and a
  generator fingerprint.
- The generator fingerprint includes the material-closure method version, app
  version, module/build URL, and source strings for the participating material
  derivation functions. A code/bundle update changes the fingerprint and causes
  old records to be reported stale instead of consumed.
- Lookup now rejects stale records for schema, method-version,
  generator-fingerprint, material-key, guard-hash, or properties-hash mismatch.
  The SPH status row reports stale count alongside hits/misses/stored records.

Latest validation:

- PASS: manual HTTPS Chromium probe seeded a v1 localStorage record and verified
  `schema-mismatch`, `stale=1`, v2 replacement records, generator fingerprint,
  input hash, and material index writes.
- PASS: focused HTTPS Chromium e2e (`1/1`) with the v2 cache schema and
  generator fingerprint assertion.
- PASS: `npm run build` and `npm run build:pages` with the existing Vite
  large-chunk warning.
- PASS: `git diff --check`.

Not claimed:

- This is browser-local persistence and invalidation. It does not yet publish
  the closure library into a networked PeerCompute peer cache or deduplicate
  across machines.
- Cache invalidation is only as strong as the generator fingerprint inputs; the
  next production-grade step is to include repo commit/content hashes from the
  service artifact envelope when available.

## 2026-06-11 Planning Update - Reaction Stoichiometry And Energetics

Added `plan/todo/reaction-stoichiometry-energetics-plan.md` to turn the two known
chemistry gaps into an implementation path:

- strict first-principles mode must reject provisional candidate energetics
  instead of accepting heuristic signs when crude geometries fail;
- balanced candidate equations must survive through the SPH adapter, CPU
  runtime, WebGPU reaction tables, gas inventory, and sealed-box pressure
  coupling;
- reaction closures need their own provenance-keyed cache, separate from
  material closure records;
- CPU and WebGPU tests must prove multi-product stoichiometry, gas byproducts,
  pressure contribution, and atom/mass/charge/energy conservation.

This is a plan-only checkpoint. The current executable runtime still has the
single-product conversion and provisional-energy gaps documented above.

## 2026-06-11 Planning Update - Phase-Resolved Steam Optics And Cache Findings

Added `plan/todo/phase-resolved-steam-optics-plan.md` so water, vapor, ice, and
visible steam can diverge through phase/state/microstructure-resolved optical
closures. The current code already keys render optics by phase, but pure vapor is
modeled as nearly invisible; visible white steam needs a condensation/droplet
scattering closure rather than a hard-coded white alpha.

Added `plan/todo/cold-start-cache-performance-plan.md` with measured cold/warm
startup evidence and the remediation path for reaction/product closure caching,
material-property-backed reaction memoization, and timing diagnostics.

Plan file cleanup:

- Moved completed audit/handoff artifacts to `plan/done/`.
- Moved forward-looking plans to `plan/todo/`.
- Moved empty/superseded documents to `plan/moot/`.
- Kept `plan/plan.md`, `plan/log.md`, `plan/tests.md`,
  `plan/implementation-status.md`, and the v0.5 PDF at top level because they
  remain active operating ledgers/spec artifacts.

Performance/cache investigation findings:

- Cold material closure derivation remains significant, but the largest visible
  miss is reaction/product closure derivation.
- `discoverReactions()` disables its in-memory cache whenever
  `options.materialProperties` is present, which is the normal demo path, so
  repeated material-property-backed discovery still reruns expensive chemistry.
- Browser `localStorage` currently persists material closures, not full reaction
  closures, product-closure derivation results, thermal graph uploads, optical
  state buckets, or WebGPU pipeline warmup.
- The worker rebuild path now receives cached material closures through
  `optionsWithCachedClosures()`, but it still has to recompute uncached
  reaction/product closures.

## 2026-06-11 Planning Update - WebGPU Material Property Resolvers

Added `plan/todo/webgpu-material-property-resolvers-plan.md` after auditing the
current optical path. The current relativistic/interband optical model is
implemented in JavaScript on the CPU; WebGPU only consumes packed optical rows
through `opticalLookupWgsl`. The new todo plan enumerates the resolver families
that must move toward WebGPU residency:

- atomic Kohn-Sham/KH/LSDA electronic structure;
- element bulk thermomechanics and jellium/radial-density cold curves;
- molecular/compound HF/UHF/all-element electronic closures;
- formula, mixture, and gas statistical mechanics;
- phase equilibrium and thermal response graph construction;
- mechanics/EOS/viscosity/transport tables;
- optical/PBR/emission/opacity derivation;
- balanced reaction discovery/energetics/execution;
- radiation, nuclear, and Cherenkov closures;
- cache/provenance and flat resolver-graph execution.

The plan preserves CPU validation and cache-key construction as control-plane
work, but treats hidden main-thread numeric closure resolution during the live
demo as a bug once a worker or WebGPU resolver exists.

## 2026-06-11 Planning Update - Cold-Start Cache Remediation

Expanded `plan/todo/cold-start-cache-performance-plan.md` into the active
cold-start remediation plan. The plan now explicitly targets the main bug:
`discoverReactions()` disables its in-memory cache when `materialProperties` is
provided, even though that is the normal SPH demo path. The fix is to hash stable
material-property provenance fields instead of turning caching off.

The remediation plan now also covers cacheable artifacts beyond material
closures:

- reaction closures;
- product reuse decisions;
- thermal material tables, graph banks, and phase-response tables;
- optical/PBR state buckets and spectral rows;
- material id maps and static WebGPU table rows;
- GPU warmup signatures and in-session pipeline/bind-group reuse metadata.

It also adds a required retro SPH `clear cache` button that clears only ULG SPH
cache families, resets in-memory signatures, reports cleared counts, and forces a
controlled cold rebuild.

## 2026-06-11 Planning Update - Overarching Remaining Todo Order

Added `plan/todo/overarching-completion-plan.md` after reviewing every active
todo file and the unchecked cross-repo items in `plan/plan.md`. The ordering is:

1. baseline/plan hygiene and live-demo status;
2. cold-start cache coordinator, reaction/product/table cache persistence, GPU
   warmup reuse, and SPH `clear cache`;
3. balanced reaction closures, strict energetics, CPU multi-product reference,
   and gas byproduct ledgers;
4. sealed gas pressure and phase-resolved steam/droplet optics;
5. ice-on-molten-iron preflight, six wall controls, particle-resolution
   controls, and energy feasibility;
6. no-full-readback GPU runtime authority, compact summaries, resident thermal,
   reaction, gas, wall, and render buffers;
7. WebGPU material resolver migration, starting with resolver manifests and
   optical/EOS/thermal numeric kernels before electronic/molecular solvers;
8. scientific fidelity frontier work such as PBE/LDA+U, larger molecular basis,
   UMP2, periodic DFT/QHA, shared clocks, neighbor lists, and stiff EOS;
9. nuclear/radiation/Cherenkov closures;
10. PeerCompute/Eshkol/MoonLab integration and final profiling/demo evidence.

Immediate next work remains Phase 1: timing spans, cache coordinator,
material-property-backed reaction memoization, reaction/product cache records,
and clear-cache UI wiring.

## 2026-06-12 Status Update - Rendered Blob Flicker

Before resuming the next todo item, the SPH marching-cubes renderer was
stabilized against one-frame blob flicker:

- resident render-field surfaces now use a narrow hysteresis band around the
  isosurface threshold;
- inactive marching-cubes surfaces are retained for a short grace period before
  their geometry is cleared;
- transparent/transmissive surfaces now get deterministic per-surface ordering
  inside each render layer;
- surface recreation no longer follows transient material-property object
  identity when the optical/config signature is unchanged.

Validation completed:

- focused renderer and resident SPH suites passed;
- the live HTTPS Vite SPH Playwright derived-material demo passed;
- a browser probe sampled 24 frames with stable `2/2` visible blob surfaces;
- full `npm test` passed `384/384`;
- `git diff --check` passed.

## 2026-06-12 Status Update - Resident Product-Event Merge

The resident product-event/product-mass merge prerequisite is now directly
covered:

- carried resident product-event buffers and newly emitted product-event
  buffers can be concatenated on the GPU without full particle readback;
- merged handles preserve cumulative source row-count and byte-length metadata,
  so repeated-step diagnostics do not collapse history to a two-buffer view;
- repeated-step cleanup can destroy superseded input generations after the next
  merged buffer exists, while single-step cleanup still preserves caller-owned
  input handles by default;
- `nextParticleUploads.residentProductMass` carries the merged handle forward
  for the next P2G/render/gas consumer.

Validation completed:

- resident MLS-MPM merge test passed;
- adjacent P2G/render/phase/renderer suites passed `58/58`;
- `git diff --check` passed.

Remaining work in this area:

- bind the merged resident product mass into all remaining EOS/gas-cell/field
  and pressure/force consumers;
- keep force coupling guarded by strict reaction and pressure-gradient evidence.

## 2026-06-12 Status Update - Resident Gas Pressure Continuity

The resident product-mass handle now carries compact gas-species pressure
state:

- reaction summaries with gas-species rows create resident product-mass handles
  with a compact gas ledger;
- product-mass merges aggregate gas species by material across carried and newly
  emitted generations;
- sealed-box pressure now prefers the merged resident product-mass gas ledger
  over the latest reaction summary, avoiding current-step-only pressure
  undercounts while product events remain GPU resident;
- the overlay recognizes the new `gpu-resident-product-mass-gas-species-ledger`
  source as resident pressure.

Validation completed:

- focused resident/pressure/reaction tests passed `33/33`;
- adjacent P2G/render/phase/renderer/reaction tests passed `67/67`;
- live HTTPS Playwright SPH derived-material test passed `1/1`;
- `git diff --check` passed.

Remaining work:

- convert the diagnostic pressure ledger into force coupling only after
  pressure gradients/normals or gas-cell fields are derived;
- continue toward GPU-resident gas/field force consumers without material
  special cases.

## 2026-06-12 Status Update - Pressure-Cell Field Contract

The sealed-gas pressure feedback now exposes a compact pressure-cell field:

- `peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0` is derived from the
  gas EOS summary;
- the current sealed-box field is one uniform gas cell with zero pressure
  gradient, matching the uniform gas state;
- pressure feedback now lists force-coupling prerequisites and blocks particle
  force application on missing material surface normals/areas instead of a
  vague missing-gradient reason.

Validation completed:

- phase pressure tests passed `14/14`;
- adjacent resident/render/reaction tests passed `67/67`;
- live HTTPS SPH Playwright test passed `1/1`;
- `git diff --check` passed.

Remaining work:

- derive material surface normals/areas or an interface field before any gas
  pressure force is applied to particles or grid nodes.

## 2026-06-12 Status Update - GPU Surface Draw Compaction

The rendered-blob flicker guard remains in place and the next render hot-loop
slice now replaces the previous surface-draw GPU stub:

- `sphRenderSurfaceDrawWgsl` scans fixed-slot surface vertices on the GPU,
  computes deterministic per-surface prefix offsets, writes a compact surface
  vertex buffer, and emits per-surface draw metadata rows;
- `buildSphRenderSurfaceDrawMetadataWebGpu()` now returns retained
  `compactedVertexRowsBuffer` and `drawRowsBuffer` handles for no-full-readback
  resident rendering instead of throwing;
- full-readback debug mode decodes compact vertices and draw rows for CPU parity
  checks, while no-full-readback mode keeps the compact vertex/draw buffers
  resident;
- the current ABI still stores draw offsets/counts as f32 values, so very large
  meshes above exact f32 integer range still need a future u32 draw-indirect ABI.

Validation completed:

- syntax checks passed for the render kernel, WGSL ABI, and render/ABI tests;
- focused render/ABI tests passed `40/40`;
- adjacent SPH/render/reaction/ABI coverage passed `106/106`;
- full `npm test` passed `407/407`;
- `npm run build`, `npm run build:pages`, and the live HTTPS Playwright SPH
  smoke passed;
- Infinite Context Coder was refreshed for `ulg`.

Remaining work:

- compile/exercise the new draw shader in a browser WebGPU smoke path;
- wire the compacted vertex buffer and draw rows into the live renderer while
  keeping CPU `MarchingCubes` as fallback;
- add u32 draw-indirect rows before relying on very high vertex counts.

## 2026-06-12 Status Update - Browser WebGPU Surface Draw Smoke

The surface draw compaction shader is now exercised in Chromium WebGPU:

- added an opt-in Playwright WebGPU launch flag
  `PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1` for focused shader smoke tests without
  changing the normal demo e2e browser path;
- added a browser test that imports the Vite-served render runtime, requests a
  real WebGPU device, dispatches `buildSphRenderSurfaceDrawMetadataWebGpu()`,
  and verifies compacted vertex rows plus draw metadata against a tiny CPU
  fixture;
- fixed a browser-only WGSL parse bug by replacing reserved local identifier
  `active` with explicit names in the marching-cube classifier and surface draw
  shaders;
- kept the normal HTTPS SPH demo smoke passing without unsafe WebGPU flags.

Validation completed:

- focused render/ABI tests passed `40/40`;
- opt-in browser WebGPU surface-draw smoke passed `1/1`;
- normal live HTTPS SPH e2e smoke passed `1/1`;
- full `npm test` passed `407/407`;
- `npm run build` and `npm run build:pages` passed.

Remaining work:

- wire compact surface vertex/draw buffers into the visible renderer;
- add a u32 draw-indirect ABI and transparent-depth tests before replacing CPU
  `MarchingCubes` for high-count live surfaces.

## 2026-06-12 Status Update - Resident Surface Draw Sidecar

The live SPH render refresh now builds a GPU-resident surface draw artifact next
to the existing Three `MarchingCubes` fallback:

- the resident render-field pass retains its field and surface buffers only long
  enough to feed `buildSphRenderSurfaceVerticesWebGpu()` and
  `buildSphRenderSurfaceDrawMetadataWebGpu()`;
- the scene then releases the transient render-field and fixed-slot vertex
  buffers while keeping only the compacted vertex buffer and draw metadata
  buffer as `peercompute.ulg.sph-resident-surface-draw.v0`;
- `sphResidentRenderState` now reports the retained surface draw buffer status,
  no-full-readback mode, compaction mode, and the explicit
  `pending-three-webgpu-binding` visible-renderer bridge;
- the status overlay now includes a `surface draw` line so live runs expose
  whether the compact draw source is resident or unavailable.

Validation completed:

- syntax checks passed for `src/visualization/sphPhaseScene.js`,
  `src/visualization/sphPhaseDemoMount.js`, and `tests/demo.e2e.mjs`;
- focused render/ABI/renderer tests passed `53/53`;
- normal live HTTPS SPH e2e smoke passed `1/1`;
- opt-in Chromium WebGPU surface-draw shader smoke passed `1/1`;
- full `npm test` passed `407/407`;
- `npm run build` and `npm run build:pages` passed.
- Infinite Context Coder was refreshed for `ulg` (`237` files indexed,
  `1096` memory chunks).

Remaining work:

- bind the retained compacted vertex and draw metadata buffers into an actual
  visible WebGPU render pass;
- replace f32 draw offsets/counts with a u32 draw-indirect ABI before relying on
  large generated meshes;
- add transparent-depth tests for surfaces viewed through water/steam/glass once
  the WebGPU renderer bridge owns visible draw ordering.

## 2026-06-12 Status Update - Surface Draw Indirect And WebGPU Overlay

The surface draw path now has the first visible WebGPU bridge boundary:

- the render ABI exposes
  `peercompute.ulg.sph-gpu-render-surface-draw-indirect.v0`, a standard u32
  draw-indirect row with `vertexCount`, `instanceCount`, `firstVertex`, and
  `firstInstance`;
- the CPU reference emits the indirect rows beside the existing f32 diagnostic
  draw metadata, and the WebGPU surface-draw kernel writes a retained
  `INDIRECT | STORAGE` buffer while it still has exact u32 prefix/count values;
- the resident surface-draw sidecar now retains and reports the u32 indirect
  buffer along with compacted vertex and f32 metadata buffers;
- `sphPhaseScene` can create a transparent raw-WebGPU overlay canvas that reads
  the compacted vertex storage buffer and submits `drawIndirect()` per surface,
  while the current Three/WebGL `MarchingCubes` path remains the fallback;
- the browser smoke validates the overlay shader and indirect draw path against
  an offscreen WebGPU render target. Headless Chromium canvas presentation is
  not treated as required evidence; the production overlay reports an explicit
  fallback if canvas presentation is unavailable.

Validation completed:

- syntax checks passed for scene, render kernel, WGSL ABI, and browser tests;
- focused render/ABI tests passed `40/40`;
- focused Chromium WebGPU surface-draw shader plus offscreen overlay render-pass
  smoke passed `1/1`;
- normal live HTTPS SPH e2e smoke passed `1/1`;
- full `npm test` passed `407/407`;
- `npm run build`, `npm run build:pages`, and `git diff --check` passed.

Remaining work:

- replace the debug overlay color path with closure/PBR optical table sampling;
- decide whether the production visible bridge should remain a raw WebGPU
  overlay or copy into Three-owned WebGPU buffers once Three WebGPU integration
  is worth the complexity;
- add z/depth ordering coverage for transparent water, steam, and nested
  surfaces before the overlay can supersede the WebGL fallback.

## 2026-06-12 Status Update - Vapor Visibility From Derived Optics

The steam/water rendering path now uses the derived optical closure to decide
whether gas-phase H2O should draw as geometry:

- `resolveOpticalSurfaceVisibility()` classifies vapor surfaces from optical
  depth and droplet scattering, not from the `steam` render label;
- pure H2O vapor with negligible optical depth stays optically hidden, while
  supersaturated droplet steam remains visible through the existing
  Clausius-Clapeyron droplet-scattering closure;
- the gate is applied to both CPU particle-batch MarchingCubes surfaces and
  resident render-field surfaces, using the existing inactive grace-frame path
  to avoid threshold flicker;
- liquid water and ice remain geometrically visible even when they are
  transmissive, so condensed phases are not hidden just because opacity is low.

Validation completed:

- syntax checks passed for `src/visualization/sphPhaseScene.js` and
  `tests/sphPhaseRenderer.test.mjs`;
- focused renderer tests passed `14/14`;
- focused optics/render/SPH demo tests passed `80/80`;
- live HTTPS Playwright SPH smoke passed `1/1`.

Remaining work:

- move H2O vapor/droplet microphysics into resident per-cell or per-particle
  GPU data instead of rebuilding state on the CPU;
- add an explicit UI diagnostic for pure-vapor versus condensed-steam optical
  mode;
- audit transparent depth ordering for water/steam/nested surfaces.

## 2026-06-12 Status Update - Resident Draw Transparency Policy

The resident surface draw path now carries the renderer's optical transparency
policy into draw metadata instead of relying only on phase:

- scene-generated render-field surface descriptors include render layer, render
  order, transparency class, and depth-write policy derived from the same
  optical/PBR closure rows used by the Three material path;
- the render-field surface table preserves transparency class and depth-write
  flags in existing reserved row slots, so the 16-float ABI row length is
  unchanged;
- CPU draw metadata and the WebGPU surface-draw WGSL prefer those explicit
  policy slots and fall back to phase-derived policy only when no policy is
  supplied;
- tests now cover a glass-like solid/transmissive case that phase-only logic
  would incorrectly treat as opaque/depth-writing.

Validation completed:

- syntax checks passed for scene, render kernel, WGSL, and render/ABI tests;
- focused render/ABI tests passed `55/55`;
- browser WebGPU surface-draw shader smoke passed `1/1`;
- normal live HTTPS SPH demo smoke passed `1/1`.

Remaining work:

- use the retained resident draw metadata to sort the raw WebGPU overlay by
  render order and depth policy;
- feed closure-derived PBR optical table rows into the overlay shader instead
  of fixed debug phase colors;
- add browser coverage for transparent surfaces viewed through other
  transparent/nested surfaces.

## 2026-06-12 Status Update - Resident Overlay Draw Order

The raw WebGPU resident surface overlay now consumes the resident draw-order
metadata instead of drawing surfaces in raw surface-index order:

- `residentSurfaceDrawOrder()` sorts retained surfaces by render order,
  depth-write flag, transparency class, and surface index;
- the overlay bridge stores ordered surface indices and indirect-buffer offsets
  and issues `drawIndirect()` in that order;
- resident render-state and Playwright snapshots now expose the bridge draw
  ordering policy and ordered offsets.

Validation completed:

- syntax checks passed for scene and e2e updates;
- focused renderer tests passed `15/15`;
- focused Chromium WebGPU surface-draw shader smoke passed `1/1`;
- normal live HTTPS SPH demo smoke passed `1/1`.

Known limitation:

- the full unsafe-WebGPU SPH e2e path still times out in headless Chromium
  before resident readback status, matching the previous overlay smoke
  limitation. Focused offscreen WebGPU shader coverage remains the useful
  overlay evidence.

Remaining work:

- feed closure-derived PBR optical table rows into the overlay shader instead
  of fixed debug phase colors;
- add browser coverage for transparent surfaces viewed through other
  transparent/nested surfaces after overlay PBR data is available.

## 2026-06-12 Status Update - Resident Overlay Optical/PBR Rows

The raw WebGPU resident surface overlay now consumes the closure-derived optical
GPU table instead of fixed debug colors:

- compact resident surface vertices already carry material id, phase id, and
  optical state id; the overlay shader now uses those IDs to look up the
  matching optical record in WGSL;
- the overlay bridge uploads the existing `peercompute.ulg.optical-gpu-table.v0`
  records to a resident storage buffer and binds it alongside compact surface
  vertices and camera data;
- fragment shading now derives base color, opacity, metalness, roughness,
  transmission handling, blocked status, and a small PBR-style lighting response
  from the optical row;
- the demo status line, resident render-state snapshot, and Playwright summary
  expose `closure-derived-optical-gpu-table` plus the bound optical record count
  so fallback/debug rendering is visible.

Validation completed:

- syntax checks passed for scene, mount, renderer test, and e2e updates;
- focused renderer tests passed `16/16`;
- focused render/kernel/ABI tests passed `57/57`;
- focused Chromium WebGPU surface-draw shader smoke passed `1/1`;
- normal live HTTPS SPH demo smoke passed `1/1`.

Known limitation:

- this is still a lightweight raw WebGPU overlay shader, not a complete IBL or
  refraction-equivalent replacement for Three's `MeshPhysicalMaterial`. The
  material inputs now come from the closure-derived optical rows; deeper nested
  transparency/depth behavior still needs dedicated browser coverage and a depth
  attachment or order-independent transparency strategy.

Remaining work:

- add transparent/nested-surface browser coverage;
- decide whether the overlay should add a depth attachment, weighted blended
  OIT, or hand off to a fuller WebGPU PBR render path;
- continue moving resident material-property resolution and render extraction
  work off the CPU hot loop.

## 2026-06-12 Status Update - Resident Overlay Depth Attachment

The raw WebGPU resident overlay now has a real depth attachment and separate
opaque/transparent depth policies:

- the bridge creates compatible opaque and transparent render pipelines from an
  explicit WebGPU bind-group layout;
- opaque surfaces render with `depthWriteEnabled: true`; transparent/vapor
  surfaces render with depth testing but no depth writes;
- the render pass creates and resizes a `depth24plus` texture alongside the
  overlay canvas, clears it each overlay frame, and switches pipelines per
  resident draw metadata;
- resident render-state, surface-draw sidecar state, bridge state, status text,
  and Playwright snapshots expose the depth policy, depth format, and depth
  attachment readiness;
- a browser WebGPU pixel test now proves that far transparent and far opaque
  draws are occluded by a near opaque depth write.

Validation completed:

- syntax checks passed for scene, mount, renderer test, and e2e updates;
- focused renderer tests passed `16/16`;
- focused Chromium WebGPU overlay tests passed `2/2`, including pixel readback
  for depth occlusion;
- normal live HTTPS SPH demo smoke passed `1/1`.

Known limitation:

- transparent surfaces are still ordered by surface/layer metadata and do not
  write depth. This fixes opaque occlusion of transparent/vapor surfaces, but it
  is not order-independent transparency and does not match full
  `MeshPhysicalMaterial` transmission/refraction.

Remaining work:

- implement weighted blended OIT or another order-independent transparent pass
  for transparent/vapor surfaces;
- extend optical overlay shading toward attenuation, IOR/refraction, and
  spectral/optical-depth use;
- continue moving resident material-property resolution and render extraction
  work off the CPU hot loop.

## 2026-06-12 Status Update - Resident Overlay Weighted Blended OIT

Transparent/vapor surfaces in the raw WebGPU resident overlay now use weighted
blended order-independent transparency:

- the overlay shader has a transparent OIT fragment entry point that accumulates
  closure-derived premultiplied color and revealage;
- the bridge creates `rgba16float` accumulation and `rgba8unorm` revealage
  targets, then composites them over the opaque canvas pass;
- opaque surfaces still write `depth24plus`; transparent/vapor surfaces test
  against that depth but accumulate into OIT targets instead of relying on
  surface order for alpha blending;
- the bridge, resident sidecar, render-state snapshot, status text, and
  Playwright summary expose the transparency composite mode, OIT target formats,
  target readiness, and last opaque/transparent draw counts.

Validation completed:

- syntax checks passed for scene, mount, renderer test, and e2e updates;
- focused renderer tests passed `16/16`;
- focused Chromium WebGPU overlay tests passed `2/2`, covering OIT pipeline
  submission and depth pixel readback;
- normal live HTTPS SPH demo smoke passed `1/1`, with the default scene using
  `weighted-blended-oit`.

Known limitation:

- weighted blended OIT improves transparent/vapor composition but is still an
  approximation. It does not yet implement physical refraction, attenuation
  distance, IOR bending, spectral dispersion, or shared depth with the underlying
  Three/WebGL scene.

Remaining work:

- extend optical overlay shading to use attenuation, IOR/refraction, spectral
  rows, and optical depth;
- decide whether to keep the overlay as the long-term renderer or migrate to a
  fuller WebGPU PBR path;
- continue moving resident material-property resolution and render extraction
  work off the CPU hot loop.

## 2026-06-12 Status Update - Resident Overlay Optical Attenuation And IOR

The raw WebGPU overlay now uses more of the closure-derived optical material row
instead of only base color and opacity:

- the WGSL optical material lookup carries IOR, attenuation RGB, attenuation
  distance, absorption coefficient, scattering coefficient, and optical depth;
- overlay shading uses IOR-derived Fresnel, Beer-Lambert-style attenuation from
  optical depth/absorption, and scattering-driven rim haze;
- transmissive overlay alpha is now derived from transmission plus optical depth
  instead of forcing every non-vapor transmissive surface fully opaque in the raw
  overlay path;
- vapor alpha uses derived opacity and optical depth, preserving the earlier
  vapor visibility behavior while giving the resident overlay a derived
  transparency signal.

Validation completed:

- syntax checks passed for scene, renderer test, and e2e updates;
- focused renderer tests passed `16/16`;
- focused Chromium WebGPU overlay tests passed `2/2`;
- normal live HTTPS SPH demo smoke passed `1/1`.

Known limitation:

- this is still a screen-space approximation. It does not trace refracted rays
  through geometry or sample spectral rows directly yet; it only consumes the
  compact PBR/optical row derived from the spectral closure.

Remaining work:

- sample spectral rows or preintegrated spectral bands in the overlay shader;
- move more material/optical state resolution to resident WebGPU buffers rather
  than CPU-prepared rows;
- continue reducing CPU hot-loop work in material and render resolution.

## 2026-06-12 Status Update - Resident Overlay Spectral Rows

The raw WebGPU overlay now binds and samples the optical spectral row buffer:

- the overlay bind group includes the optical spectral sample storage buffer
  alongside optical material records;
- WGSL resolves the optical record's spectral offset/count, samples up to a
  bounded spectral band window, maps wavelength response to approximate linear
  RGB, and blends that spectral tint with the compact optical base color;
- bridge telemetry, resident sidecar state, render-state snapshots, status text,
  and Playwright summaries expose spectral sample count and stride, proving the
  live resident overlay has spectral rows resident on GPU.

Validation completed:

- syntax checks passed for scene, mount, renderer test, and e2e updates;
- focused renderer tests passed `16/16`;
- focused Chromium WebGPU overlay tests passed `2/2`;
- normal live HTTPS SPH demo smoke passed `1/1`.

Known limitation:

- the wavelength-to-RGB conversion is a compact GPU approximation for real-time
  rendering. It is not a full color-matching-function integration yet, but it
  uses generalized spectral samples from the optical closure rather than
  material-specific renderer constants.

Remaining work:

- replace the compact wavelength mapping with preintegrated color-matching
  weights or a small spectral LUT;
- move generation/resolution of spectral optical rows further into resident
  WebGPU material resolvers;
- continue reducing CPU hot-loop work in material and render resolution.

## 2026-06-12 Status Update - Manual Resident SPH Watch

The headed browser demo now reaches and runs the resident WebGPU path without
WebGPU validation warnings:

- `https://127.0.0.1:5173/?sph=1` loads the SPH overlay, derives the material
  and reaction state, and reaches `peercompute-worker-packed-state`;
- Play toggles to the resident GPU loop, not the CPU driver, so normal physics
  fps stays `0.0` while resident fps advances;
- resident status reaches backend `webgpu`, readback
  `requested=no-full-readback actual=no-full-readback`, and surface draw bridge
  `webgpu-storage-indirect-overlay`;
- headed Chromium watch for 90 seconds after Play produced zero WebGPU warnings
  and no crash. Evidence is in
  `test-results/manual-sph-watch-running-serialized/`.

Cleanup completed in this slice:

- empty resident product-event, pressure-force, and spectral-sample storage
  bindings now upload one full zeroed ABI row while preserving zero counts;
- resident product-event merge-copy is awaited before the merged buffer is
  reused;
- resident GPU scheduling is single-flight in both the UI and scene layer to
  prevent in-flight buffer destruction.

Known limitations:

- the demo still warns that render-field readback is active because
  MarchingCubes consumes CPU arrays;
- the 90-second watch did not show convincing melting/phase-change progression;
- the resident loop is stable but only around 3.9 resident fps at the watched
  settings, so more hot-loop work remains.

## 2026-06-12 Status Update - Resident Pressure Force Rows And Physics FPS

The pressure-interface path now has a cleaner live resident contract:

- `sphPhaseScene` uploads pressure-interface solver rows once into a retained
  WebGPU storage buffer keyed by the solver signature;
- standalone grid update, single resident step, and repeated resident steps pass
  that retained buffer into the MLS-MPM grid-update kernel instead of rebuilding
  the pressure-force storage input every step;
- the resident render-state snapshot exposes pressure-force row upload status,
  retained-buffer state, and byte length;
- the render-state force-coupling status now reports the solver-ready state
  instead of the older pre-solver blocker once `gasPressureInterfaceForceSolver`
  has produced conservative force rows;
- the UI physics FPS counter now counts accepted resident WebGPU steps when the
  demo is running from the worker/view-state path without a CPU driver, so Play no
  longer displays `physics fps 0.0` while resident physics is advancing.

Product-mass diagnostics were also corrected:

- retained product-event buffers now report
  `resident-product-mass-p2g-eos-sidecar-ready`, matching the existing P2G
  mechanics/EOS sidecar consumption;
- summary-only product handles still report that no EOS buffer is available.

Validation completed:

- focused pressure/resident/grid/render tests passed;
- the live HTTPS browser SPH smoke passed against `https://127.0.0.1:5173`;
- focused Chromium WebGPU overlay tests passed;
- `git diff --check`, `npm run build`, and `npm run build:pages` passed.

Remaining work:

- pressure coupling is still a uniform sealed-gas/interface force row solve, not
  a full gas-cell pressure-gradient solver;
- render-field readback and CPU MarchingCubes are still the dominant hot-loop
  architecture gap;
- the demo still needs stronger phase-change progression evidence after the
  hot-loop and thermodynamic coupling work advances.

## 2026-06-13 Status Update - P0 Physics Regression Narrowed

Current state:

- Same-material H2O/H2O liquid mechanics and CPU-SPH render disappearance have
  first-pass fixes and passing atomic/browser probes.
- Hot H2O/H2O phase-change instability is now pinned to thermal conduction and
  phase/eos coupling, not pressure rows. The thermal pass has pair and
  aggregate overshoot limiters plus a conservative default conduction rate.
- Fe/H2O solid/liquid contact no longer spuriously cools Fe through a two-point
  Debye graph or reacts as zero-barrier active metal/water. Debye thermal
  graphs use 32 samples, and active-metal water reactions are scoped to the
  intended reactive metal classes.
- The long-horizon probe and visual matrix can now write close-spaced PNG frame
  sequences with resident diagnostics by setting `ULG_PROBE_CAPTURE_FRAMES=1`
  or `ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1`.

Validation completed in this slice:

- focused thermal/phase tests passed `35/35`;
- chemistry reaction-candidate and reaction-discovery tests passed `24/24`;
- direct resident hot H2O/H2O and Fe/H2O probes are stable;
- frame-capture probe smoke wrote three valid `1280x800` PNGs under
  `/tmp/ulg-frame-check/frames/`;
- one-scenario matrix frame-capture smoke passed with `failedCount=0` under
  `/tmp/ulg-visual-sanity-matrix/codex-frame-smoke/`.

Still open:

- Na/H2O direct resident works, but the mounted scene matrix case still timed
  out in the last representative run. Treat this as a reactive
  product-closure/render orchestration gate.
- The user's phone CPU-SPH report, where surfaces appear only after switching
  apps and then flash/disappear, is not reproduced by desktop probes. Add a
  mobile/page-visibility render lifecycle probe.
- Surface tension/free-surface behavior, cheaper resident visual horizons, and
  moving the accepted law DAG behind ComputeManager/GPUHub remain active P0/P1
  work.

## 2026-06-13 Status Update - Atomic J Regression Fixed

Current state:

- `npm run test:physics-atomics` is passing again (`5` pass, `1` skipped).
- H2O/H2O EOS-on contact no longer starts from a badly compressed liquid base:
  hydrostatic initialization now uses raw closure bulk modulus for initial
  volume strain and keeps hydrostatic pressure as an explicit support term.
- CPU, JS resident fallback, and WGSL G2P now share the same condensed-phase
  weak-incompressibility guard. The internal upper clamp is `1.049`, below the
  public `J <= 1.05` acceptance threshold.
- Direct resident WebGPU H2O/H2O mechanics with thermal/reactions disabled and
  liquid wall boundary classified `good` with
  `J=0.999991..1.049000`, drop COM moving downward by about `0.0505 m`, and
  zero pressure impulse.

Still open:

- Compact summary/readback is still too slow for routine long visual horizons.
  The latest direct no-full correctness probe spent about `51.7s` in compact
  summary for `256` substeps.
- Na/H2O mounted scene timeout and the mobile CPU-SPH visibility lifecycle bug
  remain the next representative validation blockers.

## 2026-06-13 Status Update - Mounted CPU-SPH And Long Liquid Gate Stabilized

Current state:

- The opt-in long-horizon liquid atomic gate is passing again with the wall
  damping/viscosity slice enabled. This is a small explicit support-wall
  viscosity law, gated by the viscosity law group, not a removal of pressure,
  EOS, or mechanics laws.
- The mounted `mech=sph` browser probe now exercises the actual CPU-SPH scene
  stepping path instead of accidentally validating resident WebGPU MLS-MPM.
- CPU MarchingCubes rendering now has a CPU-only alias-safe raster radius floor
  and resolution floors, which fixes the blank/flash behavior for sparse CPU
  SPH surfaces without changing physical particle radii.
- Mounted H2O/H2O CPU-SPH frame validation and MLS-MPM full-readback validation
  both classify `good` with bounded `J`, visible H2O, and no visual surface
  issues.

Still open:

- No-full resident render validation still lacks fresh cheap visual summaries;
  full-readback probes are the current correctness path until the GPU-resident
  render/diagnostic lane lands.
- The first mounted Na/H2O gas-promotion blocker is fixed; repeated-horizon
  product carry-forward and visible product/gas presentation remain open.
- Surface tension/free-surface quality and longer multiscale validation remain
  open law work.

## 2026-06-13 Status Update - Compact Summary Scope Split

Current state:

- No-full resident compact summaries now support `compactSummaryScope=particle-visual`.
  This keeps resident particle/cohort/thermal/COM/AABB/J evidence while
  explicitly skipping the active-grid-node scan.
- The skipped scan is represented as `activeGridNodeCount=null`,
  `activeGridNodeCountAvailable=false`, and `gridNodeScanCount=0`; full active
  grid evidence remains available with `compactSummaryScope=full`.
- Scene resident refreshes and the long-horizon probe can request the cheaper
  scope. Strict probes can force `ULG_PROBE_COMPACT_SUMMARY_SCOPE=full`.

Validation:

- Focused resident-step tests pass `26/26`.
- Focused resident ABI/render suite passes `92/92`.
- Direct H2O/H2O no-full `2 x 1` particle-visual probe classified `good`, with
  compact summary around `3026 ms` cold and `230 ms` warm.
- Direct H2O/H2O no-full `2 x 1` full-scope comparison classified `good`, with
  compact summary around `3248 ms` cold and `295 ms` warm.

Still open:

- The remaining cost is the readback/map fence and cold-start latency, not just
  active-grid scanning. Move routine visual validation to retained GPU
  diagnostic/render lanes with sparse admitted readbacks.
- Longer Na/H2O product/gas horizons, mobile CPU-SPH real-device reproduction
  if needed, and free-surface/surface-tension quality remain active follow-ups.

## 2026-06-13 Status Update - CPU-SPH Lifecycle Refresh

Current state:

- CPU-SPH surface sync now forces a viewport refresh burst after applying CPU
  MarchingCubes surfaces: one immediate render plus two RAF renders.
- `visibilitychange` and `pageshow` resume use the same burst path.
- The focused mobile-sized Playwright test for H2O/H2O `mech=sph` now steps the
  CPU-SPH scene, dispatches page lifecycle events, and verifies visible
  CPU-particle surfaces with completed refresh-burst telemetry.

Still open:

- This is synthetic lifecycle coverage. If the user's phone still blanks or
  flashes, add real-device visual sequence capture plus canvas/context-loss
  diagnostics.
- No-full resident readback cost, longer Na/H2O product/gas horizons, and
  free-surface/surface-tension quality remain open.

## 2026-06-13 Status Update - No-Full Surface Summary Skip

Current state:

- Resident render refresh now supports `renderFieldSurfaceSummaryMode`:
  `auto`, `readback`, or `skip`.
- In no-full `skip` mode, render rows stay GPU-resident, render fields stay
  GPU-resident, and the compact surface-summary readback is skipped with
  explicit telemetry. This avoids a `mapAsync` fence for routine diagnostic
  frames that do not need fresh visual-surface activity proof.
- The long-horizon probe can request this with
  `ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip`.

Still open:

- This does not produce fresh no-full visible surfaces when the raw WebGPU
  overlay is disabled. It only makes skipped summary evidence truthful and
  cheaper.
- Strict visual validation and default mounted playback still need readback or
  a retained GPU draw/summary lane.
- The first mounted Na/H2O gas-promotion slice is complete; repeated-horizon
  product/gas orchestration remains open.
