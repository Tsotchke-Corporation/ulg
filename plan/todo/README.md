# ULG Todo Priority Index

Date: 2026-06-14 AKDT

Use this file as the active routing layer for `plan/todo/`. The detailed todo
files remain valid, but implementation order now starts with the screenshot-
backed P0 physics behavior regression. Authority and distributed law execution
remain the long-term shape, but they do not count as done while the visible
physics loop is incoherent.

## Non-Negotiable Direction

- Do not remove or demote physics laws. ULG exists to add more laws and connect
  them from first principles.
- Do separate law content from law authority. Laws may be authored in ULG,
  Eshkol, MoonLab, or service artifacts, but distributed execution and accepted
  state mutation must be supervised through PeerCompute's NodeKernel,
  ComputeManager, and StateManager path.
- Do not let the browser scene become a second scheduler. The scene can host a
  local reference path and a visualization, but the long-term runtime is a
  PeerCompute-managed graph of laws, closures, workers, leases, caches, and
  admitted compact state deltas.
- Do not let renderer cadence decide physics cadence. Physics extraction stages
  can feed rendering, but pressure, interface, gas, and product state cannot
  depend on whether a visible mesh was drawn this frame.
- Every major todo item must finish with a dense visual sequence sanity check
  over representative scenarios, not only unit tests. The sequence must capture
  close-spaced frames plus resident diagnostics, visible surface bounds, and
  simulation-time cadence proving the resident state advanced between sampled
  frames.
- Physics behavior work must run atomic scientific invariant checks before
  visual tuning or integrated demo fixes. Use `npm run test:physics-atomics`
  as the current fast gate and extend it whenever a new law group or failure
  class is touched.

## Active Priority Order

Current routing note, 2026-06-20 AKDT: compact
`algorithmMaterialContactRows` now reach the material-interface mechanics path
through a kinematics-gated cubic-barrier response. The pressure-interface
force-row producer packs contact policy rows plus per-interface contact
kinematics rows, the WGSL stage binds both buffers in no-full WebGPU mode, and
the CPU oracle uses the same gap/normal-velocity/effective-mass pressure helper.
Contact policy alone no longer fabricates material/material force: a matching
interface element must carry gap evidence before the force row receives a
bounded contact pressure. Stage task evidence reports policy rows, applied
contact rows, pair keys, max contact pressure, and interface-kinematics
ready/row counts. The no-full WebGPU path can now derive missing contact
kinematics from resident SPH particle state/thermo buffers with a same-device
pre-force compute pass, so this is no longer restricted to element-provided
test fields. The focused browser-console blocker from 4-byte empty
material-bank warm-input sentinels is closed: thermal and mechanics now bind a
64-byte zero-row sentinel while reporting shader row count `0`, and
`/tmp/ulg-contact-kinematics-gpu-probe-rerun.json` is `status=good` with zero
browser-console issues. Continue contact work by replacing the current per-interface GPU
particle scan with a tiled/neighbor-list producer, adding browser visual
acceptance, and keeping the response in the physics stage; do not replace this
with renderer overlays or post-hoc particle position clamps. Follow-up,
2026-06-20 AKDT: the first GPU neighbor producer is now in place for this path.
The pressure stage builds a bounded fixed-capacity particle-bin grid on the
same WebGPU device, the contact-kinematics shader scans neighboring cells
instead of every particle when the bin grid is ready, and diagnostics report
bin-grid status/enabled/cell-count/capacity through the solver and
ComputeManager stage evidence. Empty pressure-interface gas-cell storage
sentinels now bind a 16-byte zero row instead of a 4-byte buffer, closing the
browser validation warning found during the direct WebGPU smoke. Follow-up:
adaptive capacity/headroom diagnostics are now wired into the bin-grid
resolver and pressure-stage evidence. Dense bins scale capacity from average
particle occupancy under a 128 MiB index-buffer budget and report average
occupancy, estimated overflow risk, and index-buffer bytes. Follow-up: exact
GPU overflow metadata readback is now available as an explicit debug opt-in,
reporting overflow status/count without changing the default no-full hot path.
The browser/probe flag now round-trips through URL policy, scene signatures,
and pressure-stage task options; the contact-bin browser probe is console-clean
after fixing stale signature teardown and product-event buffer preservation.
Remaining contact-performance work is, if fixed capacity still proves too
lossy, a prefix-scan compact bin list. Browser summary acceptance now exposes
the contact-bin grid and overflow diagnostics through mounted
`sphResidentRenderState` and the long-horizon probe compact diagnostics; the
mounted derived-material resident render-state Playwright test is green after
separating material-surface readback readiness from pressure-solver readiness.

Current routing note, 2026-06-20 AKDT: native/extension marching-cubes surface
draw now consumes the compact algorithm surface-extraction rows emitted by
MLS-MPM packing. `createUlgRenderFieldBufferVolumeDescriptor()` selects the
drop/base row by render-domain role, falls back by material/phase, and uses the
row `isovalue` for native buffer-volume extraction while publishing
surface-policy diagnostics into scene and native extraction summaries. The
follow-on contact slice now feeds `algorithmMaterialContactRows` into the
MLS-MPM wall-barrier grid update as a non-authoritative
elasticity-inclusive stiffness source when no explicit wall stiffness/modulus
override is supplied. Continue contact work by extending material-interface
pair response inside the mechanics update path, not by adding renderer
overlays or post-hoc position fixes.

Current routing note, 2026-06-20 AKDT: native/extension marching-cubes surface
draw metadata now distinguishes material `surfaceIndex` from the compact
extension's single retained indirect draw row. Extension surfaces publish
`indirectRowIndex=0` / `indirectOffsetBytes=0`, and the native draw order uses
those explicit offsets. Browser probe
`/tmp/ulg-native-indirect-offset-probe-wait.json` is console-clean and reaches
`native-webgpu-surface-consumer-rendered` with retained surface-buffer input
ready, but still fails closed on the existing
`native-surface-validation-readback-lifetime` blocker. Continue the native
rendering lane by fixing validation/presentation evidence, not by adding an
overlay or reviving CPU mesh fallback.

Current routing note, 2026-06-20 AKDT: the native browser console harness is
clean after the submit-pacing slice, and frame capture can analyze captured PNG
data in memory without artifact output. Native same-device readback validation
now fails closed as `browser-frame-validation-required` when runtime pixel
readback is disabled. The remaining native harness blocker is not WGSL or
console spam: headless Chromium can destroy the native main-canvas WebGPU
device after repeated native canvas submits, even in debug clear-only mode.
The bridge now avoids duplicate bridge-ready RAF renders, bounds submit-fence
waits, and pauses automatic redraw after a native submit timeout. Continue this
lane by moving native presentation/physics synchronization into the planned
engine/worker ownership split, keeping the consumer engine-integrated and
fail-closed rather than adding an overlay.

Current routing note, 2026-06-20 AKDT: the material JSON bank now has the first
Phase 2 element crystalline-structure seed checked in and validated. The
`element-crystal-structures` bank covers active solid Li, Na, K, Rb, Cs, Fe,
and Pd rows with schema, provenance, reference-state, lattice, unit-cell,
packing-fraction, and fallback-policy gates. Runtime normalization rejects
stale/future crystal bank versions, duplicate structure keys, unknown
provenance statuses, and missing units. Next material-bank work is to feed
these crystal/packing hints into the algorithm-derived particle initialization,
MLS-MPM/contact, and marching-cubes row contracts rather than treating them as
renderer constants.

Current routing note, 2026-06-20 AKDT: particle initialization now attaches
state-valid element crystal warm inputs beside the element material-bank warm
rows. Solid Na at room temperature carries `na-bcc-alpha` packing metadata into
the material-bank particle-size GPU row, while the default hot Fe drop rejects
the solid `fe-bcc-alpha` row as outside its temperature validity domain. The
particle-size row ABI now matches the WGSL consumer: row status is read from
`row3.x`, and the existing padding carries crystal packing fraction,
coordination number, and atoms per conventional cell. Continue by deriving
MLS-MPM/contact/marching-cubes algorithm rows from these accepted warm inputs.

Current routing note, 2026-06-20 AKDT: the first algorithm-derived particle
initialization row contract now exists. `buildSphPhaseDemoState()` publishes
`algorithmMaterialParticleInitializationRows` with closure-derived density,
spacing, rest volume, applied radius, smoothing/support metadata, and optional
state-valid crystal packing diagnostics. The solid Na row carries
`na-bcc-alpha`; invalid hot Fe remains closure-rest-volume authoritative with a
rejected crystal warm input. Next row contracts should specialize this data for
MLS-MPM mechanics/contact and marching-cubes isovalue/smoothing/normal policy.

Current routing note, 2026-06-20 AKDT: MLS-MPM packing now publishes compact
`algorithmMaterialMlsMpmMechanicsRows` derived from the actual mechanics buffer
and particle initialization rows. The rows aggregate role/material/phase
particle count, rest volume, bulk/shear/lambda/sound-speed, viscosity,
surface-tension, hydrostatic pressure, and carried crystal metadata such as
`na-bcc-alpha`. Next solver-specific work is contact stiffness/impulse policy
and marching-cubes surface extraction policy, using these compact rows instead
of scanning every particle or inventing renderer-side constants.

Current routing note, 2026-06-20 AKDT: MLS-MPM packing now also emits
`algorithmMaterialContactRows`, a non-authoritative contact-policy view derived
from compact mechanics rows. The row pairs drop/base materials, uses the softer
constituent normal stiffness, carries viscosity/support radius and crystal
structure keys, and explicitly reports
`forceMutationAuthority=not-authoritative-contact-policy-row`. The next
algorithm-row consumer is marching-cubes/surface extraction policy, followed by
validated force-kernel consumption of the contact rows.

Current routing note, 2026-06-20 AKDT: MLS-MPM packing now emits compact
`algorithmMaterialSurfaceExtractionRows` for marching-cubes/surface policy.
Rows carry isovalue policy, smoothing radius, voxel size, normal scale,
particle radius, support radius, material/phase ids, and crystal packing
metadata while explicitly reporting
`rendererAuthority=not-renderer-authoritative-surface-policy-row`. The next
work is to bind these rows into the actual marching-cubes/native surface
extraction path and prove browser/pixel validation, not to tune visual
threshold constants in renderer code.

Current routing note, 2026-06-20 AKDT: the variable-scale reaction browser
coverage now extends K/H2O and Cs/H2O beyond the prior two-pass resident
sequence, and adds a browser-mounted multivalent alkaline-earth Ca/H2O pass.
The focused mounted active-metal/H2O Playwright harness runs Na/H2O first pass,
Na/H2O continuation, Na/H2O reset/post-reset, K/H2O and Cs/H2O first pass plus
two consecutive no-full resident continuation batches each, then Ca/H2O first
pass plus one no-full continuation. Each continuation proves resident product
carry-forward, promoted
`gpu-resident-pressure-interface-spatial-gas-ledger` pressure above baseline,
render-state pressure consumption, G2P/render-row scale policies, support
radius bounds, and clean WebGPU console output. Evidence:
`PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_ENABLE_UNSAFE_WEBGPU=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npx playwright test --config tests/playwright.config.mjs --grep "resident active-metal/H2O promotes product gas pressure"`
passed `1/1` in `5.6m`. Remaining in this lane: broader long-horizon batches
for non-alkali/multivalent pairs and representative non-water binary products
once their pressure/product routes have stable browser-ready expectations.

Current routing note, 2026-06-20 AKDT: the monolithic CPU MLS-MPM
H2O/H2O liquid gate regressed after material/spacing work because wall-only
damping no longer killed long-horizon residual slosh. MLS-MPM now uses a
viscosity-law same-material liquid velocity diffusion default of `0.1`, delayed
until `20` demo steps (`0.16 s` with current defaults) so short contact closure
still descends under gravity before late-settling diffusion engages. Evidence:
`npm run test:physics-liquid-atomic` passes `14/14`, including the short
EOS-on contact gate, the long monolithic MLS-MPM settle/speed/free-surface
gate, the plain SPH long gate, and the resident free-surface oracle. This
closes the current CPU liquid-settling regression but does not close retained
GPU no-full visual diagnostics, mobile rendering, or explicit surface-tension
law work.

Current routing note, 2026-06-19 AKDT: variable scaled particle rendering now
has fail-closed render-row and resident G2P mechanics bounds in CPU and WGSL
(`max radius growth = 4`, `max J = 64`). Render extraction also clamps visual
particle radius to `2 * smoothingLengthM`, reports
`peercompute.ulg.sph-render-row-particle-scale-stability.v0`, and exposes the
retained shader support-radius policy through scene/probe diagnostics. G2P /
resident mechanics reports
`peercompute.ulg.mls-mpm-g2p-particle-scale-stability.v0`, including
`gpu-g2p-cap-policy-applied-in-shader` for no-full/fused batches. Track
remaining work in `plan/todo/reaction-variable-particle-scale-stability-plan.md`:
gas-routed products are now kept out of visible product slots, WebGPU reaction
resolve mirrors the condensed-visible-product selection, and gas-phase render
rows use a visual proxy cap of `0.5 * smoothingLengthM`. The mounted Na/H2O
resident browser regression now runs a no-full reaction/render pass, resets,
then runs a second pass while asserting clean WebGPU console output, G2P and
render-row scale policies, decoded gas-phase rows, and bounded gas visual
radius. The first pass also proves the retained product-event buffer feeds the
spatial gas ledger producer and gas-cell EOS stage without full product-event
readback. The retained spatial gas ledger is now promoted back into the sealed
resident gas-pressure summary as
`gpu-resident-pressure-interface-spatial-gas-summary`, and render refresh
consumes `gpu-resident-pressure-interface-spatial-gas-ledger` instead of the
baseline fallback. The browser gate now also runs a consecutive resident
reaction/render pass before reset, proving the promoted pressure source remains
active across multiple resident batches. Remaining gap: broaden long-horizon
browser coverage beyond the focused resident sequences. K/H2O now has a
console-guarded two-pass resident pressure/render regression with retained
product mass, KOH/H2 material keys, promoted spatial gas pressure, scale
policies, and support-radius bounds. Cs/H2O now has the same two-pass resident
browser coverage with retained CsOH/H2 product pressure, clean WebGPU console
output, and the same scale/support bounds. Do not treat these caps as the
final physics model.

Current routing note, 2026-06-19 AKDT: particle/sphere render modes now apply a
bridge-local metallic visibility proxy for closure-derived conductor PBR rows,
so sodium-style fully metallic particles do not render black when the mobile or
WebGL sphere bridge lacks reliable environment lighting. Evidence:
`/tmp/ulg-particle-pbr-na-mobile-spheres-probe.json` completed `status=good`
with zero console issues/warnings, two nonblank mobile-shaped canvas captures,
sphere material keys `h2o`, `naoh`, and `Na`, closure-derived sphere PBR, and
`renderBridgeSphereMetallicVisibilityProxyCount=1`. Track remaining broader
coverage in `plan/todo/particle-pbr-material-closure-rendering-plan.md`: air now
packs as `gas-rayleigh-transparent-pbr` instead of blocked black, Pd and Fe
mobile-shaped sphere probes are console-clean with metallic proxy count `1`, and
products resolve to nonblocked PBR rows. The Three WebGPU render-row sphere
material-proxy path now carries particle-specific diagnostics and has sodium,
air, and black-source fallback guards. The remaining gap is an explicit
air-particle mounted visual scenario once one is cheap and non-flaky.

Current routing note, 2026-06-19 AKDT: drop-edge >6 remains active but is now
narrowed. The scene exposes
`peercompute.ulg.sph-render-domain-position-bounds.v0` inside
`peercompute.ulg.sph-scene-set-particles-timing.v0`, and the mounted
mobile-shaped H2O/H2O MLS-MPM reset regression for `dropn=7, basen=5` passes:
the drop domain is `7^3`, the same-material base expands to `14^3` for equal
physical particle radius, render-domain counts match generated particles, and
base/drop position bounds are available after reset. CPU continuous surface
batching now derives role domains from `renderDomainCounts`, count-only
resident seed batches can merge by domain, and
`peercompute.ulg.sph-same-material-domain-merge-diagnostics.v0` explicitly
reports when same-material same-phase role domains are intentionally merged for
a continuous visible surface. Fe/H2O now has a non-H2O mounted mobile-shaped
regression for `dropn=8, basen=5`: the Fe drop preserves edge `8`, H2O adapts
to edge `7`, counts/domain bounds stay aligned at `855`, GPU uploads match, and
the variable-size sphere render mode remains selected with clean browser
console output. The same Fe/H2O high-edge path now also passes a mounted
`three-render-row-points` regression with reset, render-domain bounds, GPU
uploads, selected points mode, and clean WebGPU console output. Keep
`plan/todo/drop-edge-large-size-respect-plan.md` active only for a new live
repro outside these covered URL paths or resident render-state bridge batches
that actually publish more detail; do not hide this behind a visual scale or
loosen the initialized edge contract.

Current routing note, 2026-06-19 AKDT: material-property JSON bank Phase 1 is
now an active bounded-generation lane instead of a hand-authored seed only.
`npm run generate:material-properties` preserves existing rows unless
`--regenerate` is passed, supports `--limit`/`--symbols` dry runs, and has
checked-in first-tranche coverage for `Be`, `B`, `C`, `N`, and `F` on top of
the nine active/PBR probe rows. A second tranche now adds `Mg`, `Al`, `Si`,
`P`, `S`, `Cl`, `Ca`, and `Sc`, leaving 89 selectable non-noble targets.
A slower third tranche now adds the selectable prefix through `Se`, bringing
the bank to 34 rows and leaving 77 selectable non-noble targets. Continue
bounded generation now reaches `Ru`: the fourth tranche added `Br`, `Sr`, `Y`,
`Zr`, `Nb`, `Mo`, `Tc`, and `Ru`, bringing the bank to 42 rows and leaving 69
selectable non-noble targets. The fifth tranche now reaches `I`, adding `Rh`,
`Ag`, `Cd`, `In`, `Sn`, `Sb`, `Te`, and `I`; the bank has 50 rows and 61
selectable non-noble targets remain. Continue
`plan/todo/material-property-json-bank-plan.md` by adding selectable non-noble
elements in reviewable batches and then binding the packed rows from the
current upload buffers into shader-side consumers. The sixth tranche reaches
`Pr` with `Ba`, `La`, `Ce`, and `Pr`, bringing the bank to 54 rows and leaving
57 targets; further lanthanide/actinide expansion should first add
generator-side intermediate caching because repeated dry-run/write passes are
now taking about a minute per four rows. That first cache is now present:
generator runs read/write ignored local records under
`.cache/material-properties/element-records`, expose cache hit/write counts in
the JSON summary, and support `--cache-dir` plus `--no-cache`. The first
cache-backed write added `Nd`, `Pm`, `Sm`, and `Eu`, moving the bank to 58 rows
and leaving 53 selectable non-noble targets; the write pass reported
`cache.hitCount=4`. The next cache-backed write added `Gd`, `Tb`, `Dy`, and
`Ho`, moving the bank to 62 rows and leaving 49 selectable non-noble targets.
The final lanthanide continuation added `Er`, `Tm`, `Yb`, and `Lu`, so the
bank now covers the selectable prefix through `Lu` with 66 rows and 45 targets
remaining.
Post-lanthanide transition coverage now reaches `Au`; `Hf`, `Ta`, `W`, `Re`,
`Os`, `Ir`, `Pt`, and `Au` bring the bank to 74 rows with 37 selectable
non-noble targets remaining.
Heavy post-transition coverage now reaches `Ra`; `Hg`, `Tl`, `Pb`, `Bi`,
`Po`, `At`, `Fr`, and `Ra` bring the bank to 82 rows with 29 selectable
non-noble targets remaining.
The first actinide tranche reaches `Cm`; `Ac`, `Th`, `Pa`, `U`, `Np`, `Pu`,
`Am`, and `Cm` bring the bank to 90 rows with 21 selectable non-noble targets
remaining.
The actinide tail now reaches `Rf`; `Bk`, `Cf`, `Es`, `Fm`, `Md`, `No`, `Lr`,
and `Rf` bring the bank to 98 rows with 13 selectable non-noble targets
remaining.
The final superheavy tranche added `Db`, `Sg`, `Bh`, `Hs`, `Mt`, `Ds`, `Rg`,
`Cn`, `Nh`, `Fl`, `Mc`, `Lv`, and `Ts`; the element bank now has 111 rows and
`remainingMissingCount=0` for the current selectable non-noble closure gate.
The first shader-side consumer is now bound: render-row WGSL consumes the
packed particle-size row table at binding `5` as a non-authoritative
role/rest-volume seed before the MLS-MPM mechanics override, and reports
`peercompute.ulg.sph-render-row-material-bank-particle-size-consumer.v0`.
The material-bank todo should now move from render-row-only consumption to
mechanics/EOS/thermal/optical shader consumers, reference-quality replacement
rows, and Phase 2 crystalline structure data.

Current routing note, 2026-06-20 AKDT: the thermal WebGPU step now has a
second shader-side material-bank consumer. In addition to the render-row
particle-size binding at `5`, `sphThermalStepWgsl` binds accepted
material-bank warm-input rows at binding `9` and reports
`thermal-material-bank-warm-inputs-bound-in-shader` when an uploaded row buffer
is actually used. The shader reads the row table only as a zeroed
non-authoritative presence probe; phase, temperature, rest density, and
response slopes still come from closure-derived thermal graph buffers. Evidence:
`node --test tests/webgpuKernelAbi.test.mjs tests/abi.test.mjs tests/sphThermalGpuKernel.test.mjs`
passed `33/33`; the mounted derived-material Playwright test passed `1/1`;
`/tmp/ulg-thermal-bank-shader-binding-probe.json` completed `status=good` with
browser console issue/warning counts `0/0`. Remaining material-bank consumers:
mechanics/EOS shader warm-start availability, optical shader-side binding
beyond metadata annotations, reference-quality replacement rows, and Phase 2
crystalline structure data.

Current routing note, 2026-06-20 AKDT: the MLS-MPM mechanics refresh now has
the matching shader-side material-bank warm-input consumer. Mechanics material
tables annotate accepted warm rows as non-authoritative metadata, live scene
construction passes the packed SPH warm-input table into
`buildMlsMpmMechanicsMaterialTable()`, and `mlsMpmMechanicsRefreshWgsl` binds
those rows at binding `6` with the row count in `MechanicsRefreshParams`.
The shader currently reads a zeroed presence anchor only; closure-derived
mechanics/EOS phase records still own rest density, bulk/shear/lambda, sound
speed, EOS model, viscosity, and surface tension. Evidence:
`node --test tests/sphMechanicsRefreshGpuKernel.test.mjs tests/webgpuKernelAbi.test.mjs tests/abi.test.mjs`
passed `27/27`; the mounted Fe/H2O MLS-MPM variable-sphere probe
`/tmp/ulg-mechanics-bank-shader-binding-probe.json` completed `status=good`
with browser console issue/warning counts `0/0`; `npm run build` passed with
the existing large bundle warning. Remaining material-bank consumers: optical
shader-side binding beyond PBR metadata, reference-quality replacement rows,
and Phase 2 crystalline structure data.

Current routing note, 2026-06-20 AKDT: optical/PBR material-bank warm inputs
now have a shader-side consumer as well. `buildOpticalGpuTable()` preserves the
accepted warm-input rows alongside closure-derived optical records, static
table cache records serialize/rehydrate those rows, old optical cache entries
without row arrays are rejected for warm-input reuse, and `opticalLookupWgsl`
binds the row table at binding `4` with a zeroed presence anchor. Closure
optical records still own base color, metalness, roughness, opacity,
transmission, IOR, render model, and spectral/scattering values. Evidence:
`node --test tests/opticalGpuBuffers.test.mjs tests/sphColdStartCache.test.mjs tests/webgpuKernelAbi.test.mjs tests/abi.test.mjs`
passed `45/45`; `/tmp/ulg-optical-bank-shader-binding-probe.json` completed
`status=good` with browser console issue/warning counts `0/0`; `npm run build`
passed with the existing large bundle warning. Remaining material-bank work is
reference-quality replacement rows, Phase 2 crystalline structure data, and
turning these shader-bound warm inputs into validated algorithm-shaped row
schemas where the closures can safely consume them.

Current routing note, 2026-06-19 AKDT: the sibling native marching-cubes
extension now has a conservative no-readback extraction mode and ULG binds the
retained GPU vertex counter into the surface-row translation pass. This
replaces the older final-extraction blocker where
`MarchingCubes.computeActiveVoxels()` mapped a CPU-visible counter on the
resident device. Current evidence:
`/tmp/ulg-browser-native-mlsmpm-native-renderer-pixel-validation-3.json`
completed with zero browser console issues/warnings, native extraction status
`extension-surface-ready-needs-ulg-row-translation`, ULG source vertex counter
mode `extension-gpu-vertex-counter`, bridge status
`native-webgpu-surface-consumer-ready`, and render status
`native-webgpu-surface-consumer-rendered`. The native validation wait is now
actually plumbed into the in-page probe, and local headless Chromium has been
proven to screenshot a minimal WebGPU canvas clear as black while standalone
offscreen texture readback works. Current evidence
`/tmp/ulg-native-validation-analysis-classified-probe.json` is console-clean,
records `nativeSurfaceValidationWaitMs=2500`, classifies blank native canvas
captures as `browserCanvasCaptureUnsupportedByNativeWebGpu=true`, and fails
only on `resident-surface-visible-gpu-consumer-not-ready` because resident
device readback/offscreen validation exhausts with `A valid external Instance
reference no longer exists`. Newer evidence
`/tmp/ulg-native-device-texture-smoke-probe.json` keeps the same native path
console-clean and proves the cached resident `GPUDevice` can pass both
`MAP_READ` and a standalone `rgba8unorm` texture render/copy/MAP_READ smoke
(`sample=[255,0,0,255]`). The blocker is therefore narrowed to native
surface/offscreen validation readback and device lifetime around the engine
main-canvas consumer, not generic resident-device texture readback, extension
counter readback, blank headless screenshot chasing, overlay fallback, or CPU
mesh optimization. `/tmp/ulg-native-readback-classified-probe.json` now
classifies that bridge readback-smoke failure as texture-readback-unavailable
`not-run` while leaving the visible consumer fail-closed.

Current routing note, 2026-06-19 AKDT: the native surface bridge now includes a
diagnostic offscreen same-device validation pass. It draws the same retained
compact vertex and indirect buffers into a 64x64 WebGPU texture and reports
offscreen validation telemetry through the scene/probe state without creating
an overlay or marking the visible consumer ready. Evidence:
`/tmp/ulg-native-validation-analysis-classified-probe.json` is console-clean
and shows retained native MC surface draw buffers plus
`native-webgpu-surface-consumer-rendered`. The wait now settles validation
attempts instead of leaving them pending, but the resident-device readback
smoke and offscreen validation both exhaust after three attempts with
`external Instance` failures. Keep the next P0 on resident WebGPU device
lifetime/validation and real mobile native rendering; do not detour into
overlays or CPU mesh fallback.

Current routing note, 2026-06-19 AKDT: native validation cadence now reports a
scope instead of letting debug clear-only look like surface geometry evidence.
`native-current-texture-debug-clear` can run the standalone same-device
readback smoke validation, but offscreen surface validation is ineligible until
actual retained surface draws are submitted. The render bridge publishes
validation scope, offscreen eligibility, and offscreen skip reason into
surface-draw/render-state diagnostics, and both the long-horizon probe and
performance benchmark now flatten those fields into artifacts. Use this to
debug native current-texture presentation, but do not promote the visible
consumer from clear-only evidence; real acceptance still needs
`native-surface-draw` validation or browser pixel evidence on the engine-owned
surface.

Current routing note, 2026-06-19 AKDT: resident MLS-MPM render-every
continuation is now console-clean on the native WebGPU surface-consumer route
when native marching-cubes extraction is deferred until the final resident
batch. The probe
`/tmp/ulg-browser-native-mlsmpm-render-every-2x1-extension-no-explicit-fences.json`
completed with zero browser console issues and preserved the engine-owned
native surface consumer path without an overlay. This supersedes the older
multi-batch timeout notes below for the immediate queue-lifetime failure class.
This block is now superseded for the extension counter-readback failure class:
the next todo is native WebGPU canvas visibility/pixel evidence over the
GPU-counter surface rows. Do not spend more time optimizing CPU summary/readback
fallback paths except as diagnostic gates.

Current routing note, 2026-06-19 AKDT: the engine-owned
`native-webgpu-surface-consumer` main-canvas path is wired, but the earlier
`status=good` native/mobile artifacts are superseded false positives. Explicit
native surface draw requests default to `renderer=native-webgpu`, bind the main
canvas WebGPU context to the resident `GPUDevice`, consume retained native MC /
extension surface draw buffers without an overlay, and report
`renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered` in the
one-step smoke. The visible GPU consumer remains fail-closed because runtime
render-loop pixel readback is disabled after WebGPU external-instance failures;
browser PNG/composited-frame analysis is now the validation owner. Current
evidence: `/tmp/ulg-native-no-full-policy-smoke.json` completes with zero
browser console issues/warnings, retained surface draw buffers, native bridge
ready, and `surfaceDrawVisibleGpuConsumerPixelValidationStatus=not-run`.
The frame artifacts show direct canvas captures are transparent black while the
composited page is nonblank, so do not promote this path until native visible
pixels are proven. Multi-batch no-full continuation is also still a P0 blocker:
without active grid it times out in `p2gGridProjection`; with active grid it
times out in second-batch `fusedMechanics`. The next renderer/runtime slice is
resident continuation plus native pixel validation, not real-phone signoff,
fallback geometry, or an overlay.

Current routing note, 2026-06-19 AKDT: native visible-consumer readiness is now
tightened against false positives. `resolveResidentSurfaceVisibleGpuConsumer()`
no longer treats pending validation or texture-readback-unavailable errors as a
ready visible consumer; only browser pixel validation or a same-device
readback/offscreen pass can promote native no-readback rendering. Evidence:
`/tmp/ulg-native-validation-analysis-classified-probe.json` reaches retained
surface draw buffers and
`renderBridgeLastRenderStatus=native-webgpu-surface-consumer-rendered` with
console issues/warnings `0/0`, but remains `bad` with
`resident-surface-visible-gpu-consumer-blocked-pixel-validation`. Headless
canvas captures are now marked capture-unsupported for this native path rather
than counted as a visual-canvas failure. Next work remains actual native
validation/mobile rendering, not loosening the gate.

Superseded routing note, 2026-06-19 AKDT: the native
`native-webgpu-surface-consumer` contract now exists as the next renderer
handoff target. It is intentionally fail-closed unless the engine owns the main
canvas or provides a renderer-owned WebGPU texture view, uses the same
`GPUDevice` as the retained resident buffers, has a render target ready, passes
runtime validation, and then passes browser pixel validation. Separate overlay
canvases are explicitly blocked. The latest MLS-MPM browser probe was
console-clean and retained resident render-field buffers, but still classified
`bad` because the runtime has no engine-owned native consumer yet:
`native-webgpu-surface-consumer-blocked-engine-integration` and
`resident-surface-visible-gpu-consumer-blocked-surface-extraction-required`.
The main-canvas binding and native MC/direct-consumer draw pass described here
has since landed in the note above; keep this block only as historical evidence
for why the native path was prioritized over Three material polish, fallback
overlays, or CPU geometry rebuilds.

Current routing note, 2026-06-19 AKDT: unsafe Three WebGPU diagnostics now
separate renderer-owned resident-device probing from presentation-only probing,
and resident diagnostic meshes can force basic materials plus low-poly geometry.
Both browser routes still fail with `Instance dropped in popErrorScope`; the
renderer-owned render-row route reaches resident spheres but then fails Three's
mapped buffer creation, while presentation-only times out before metrics. The
external surface-buffer route now gets as far as a position-only,
no-indirect, no-normal, `MeshNormalMaterial`-style bridge and still fails in
`WebGPUPipelineUtils.createRenderPipeline`. Treat this as evidence that the
current Three WebGPU adapter path is blocked at renderer
error-scope/device-lifetime or external-buffer pipeline validation, not at PBR
material choice, normals, indirect draw, or marching-cubes extraction alone. Do
not promote `three-webgpu-surface-buffers` or spend the next slice on material
polish; either fix the Three WebGPU presentation/device lifetime directly or
build the native engine-owned WebGPU surface consumer that can bind retained
buffers without an overlay and then pixel-validate it.

Current routing note, 2026-06-19 AKDT: probe and benchmark harnesses now
surface `surfaceDrawVisibleGpuConsumer*` separately from
`surfaceDrawGpuBufferHandoff*`. Explicit `three-webgpu-surface-buffers` probes
must fail or flag `resident-surface-visible-gpu-consumer-not-ready` when GPU
inputs are retained but no engine-owned visible GPU consumer is bound and pixel
validated. This is a harness guardrail only; it does not complete the renderer
work.

Current routing note, 2026-06-19 AKDT: native marching-cubes/extension surface
buffers now publish a separate visible-GPU-consumer gate. A run can correctly
report `surfaceDrawGpuBufferHandoffReady=true` for retained compact surface
draw buffers while also reporting
`surfaceDrawVisibleGpuConsumerReady=false` until an engine-owned WebGPU surface
consumer is bound and browser pixel validated. Treat this as the guardrail for
the weird-MC rendering class: retained buffers are direct-consumer inputs, not
visible no-readback rendering evidence by themselves. The next todo remains
the actual engine-owned WebGPU consumer/pixel-validation path, not fallback
geometry or an overlay.

Todo hygiene note, 2026-06-18 AKDT: completed planning artifacts
`6-16-audit.md` and `critique.md` have moved to `plan/done/`. The older broad
`perf-upgrade.md` has moved to `plan/moot/` because the active performance
routing now lives in `webgpu-ocean-mlsmpm-simulator-plan.md` and
`gpu-resident-lanes-and-warm-services-plan.md`.

Current routing note, 2026-06-18 AKDT: WebGPU-Ocean Phase 1 audit is complete
and it confirms the fundamental performance fix already in
`webgpu-ocean-mlsmpm-simulator-plan.md`. The reference loop is particle-
parallel for P2G/G2P, uses fixed-point integer `atomicAdd` scatter into grid
cells, keeps grid work in grid-only passes, and renders particle-derived
depth/thickness on GPU. ULG now has particle-parallel scatter P2G, so do not
spend major effort optimizing fallback readback paths that the replacement
lane should remove. The next performance slice is an explicit Ocean-style
resident lane: scatter/tiled P2G, resident product/gas/thermal sidecars,
throttled compact diagnostics, and GPU surface/render generation.

Current routing note, 2026-06-18 AKDT: resident MLS-MPM fused WebGPU paths now
publish a runtime dispatch-topology contract. Probes and sequence summaries can
read `dispatchTopologyStatus=resident-dispatch-topology-ready`,
`cpuParticleLoopInHotPath=false`, P2G `particle-parallel-scatter`, G2P
`particle-parallel-gather`, and active-grid finalize/update
`active-grid-node` dispatch axes. Browser evidence:
`artifacts/sph-long-probe-mobile-dispatch-topology-2.json` is console-clean for
the mounted mobile scene, and
`artifacts/sph-direct-resident-dispatch-topology-sequence.json` is
console-clean for a two-substep fused mechanics sequence with 8 total
dispatches. Treat poor GUI FPS as a resident surface/render/readback issue
unless this topology contract regresses.

Current routing note, 2026-06-18 AKDT: the native checkout at
`/home/cos/projects/webgpu-marching-cubes` is a good fit as a surface
extraction core reference, not as a drop-in renderer. Its useful pieces are
active-voxel classification, GPU exclusive scan, active-id stream compaction,
vertex-count scan, and compact vertex-buffer emission. Port those ideas into
ULG's resident render-field/surface ABI to replace fixed
`totalFieldCells * maxVertsPerCell` allocation and readback-heavy surface
paths. Do not use it as a separate canvas overlay, and do not treat its
Three.js WebGPURenderer adapter as ready until ULG has a same-device,
engine-owned Three/WebGPU bridge with material/PBR metadata and shared depth.

Current routing note, 2026-06-18 AKDT: ULG now executes the sibling
`webgpu-marching-cubes` buffer-volume extractor from retained render-field
descriptors and translates compact MC positions into ULG world-meter surface
rows with a render-field grid-to-world transform. The old compact
tetrahedralized fallback remains blocked. The next renderer todo is therefore
the same-device engine-owned WebGPU surface consumer and pixel validation, not
another extraction adapter or overlay.

Current routing note, 2026-06-18 AKDT: retained native MC compact vertex
buffers now carry `GPUBufferUsage.VERTEX`, so the direct Three WebGPU
external-buffer bridge is no longer blocked by storage-only buffer usage. The
browser/pixel validation gate still remains: do not enable
`three-webgpu-surface-buffers` by default until it passes console-clean
same-device presentation on the engine-owned renderer.

Current routing note, 2026-06-18 AKDT: the interim Three render-row bridge now
reports when it forces CPU render-row readback for fresh Three geometry, and it
can retain the previous Three bridge on later explicit no-full refreshes. Treat
that retained mode as visual continuity and console-clean fallback evidence
only. It is not the final no-readback renderer because it does not update
geometry from resident GPU buffers and cannot prove fresh motion without
separate diagnostics.

Current routing note, 2026-06-18 AKDT: the marching-cubes extension boundary
has advanced from planning to an engine-state integration. The sibling
extension now exposes a caller-owned-device vanilla JS adapter; ULG now has
CPU-reference and same-device WebGPU translators from compact
`float32x4-position` output into ULG surface vertex/draw/indirect rows; and
`sphPhaseScene.refreshSphResidentSurfaceDrawFromExtension()` can publish those
retained buffers into `sphResidentSurfaceDraw` without an overlay or second
GPU device. The next required slice is visible renderer consumption of those
resident extension buffers inside the engine-owned Three/WebGPU path with PBR
metadata, depth behavior, browser-console validation, and pixel evidence.
The capability gate now blocks that no-full-readback bridge until Three WebGPU
has an initialized backend device and it matches the resident device; do not
count a WebGPU renderer object alone as bridge readiness.

Current routing note, 2026-06-18 AKDT: do not use the old
`three-compact-vertices` path as visual evidence. ULG now blocks it by default
because the in-repo surface-vertex extractor emits tetrahedralized
render-field cube triangles and can stall on compact readback. When the
resident path keeps lower-level render-field buffers, browser diagnostics must
surface the real missing consumer:
`surfaceDrawGpuBufferHandoffSurfaceExtractionInputKind=render-field-density-storage-buffer`,
`surfaceDrawGpuBufferHandoffSurfaceExtractionConsumerKind=native-webgpu-marching-cubes-buffer-volume`,
and
`surfaceDrawGpuBufferHandoffSurfaceExtractionBridgeStatus=requires-buffer-native-marching-cubes-adapter`.
The next native MC slice is therefore buffer-backed scalar-volume support in
the sibling extension or an explicit GPU render-field-to-texture bridge, then
engine-owned consumption; not a canvas overlay and not the compact
tetrahedral fallback.

Current routing note, 2026-06-18 AKDT: architecture work takes priority over
micro-optimizing the old fallback renderer. Three WebGPU presentation and the
same-device `three-webgpu-surface-buffers` bridge now fail closed by default:
requests for `renderer=webgpu&rendererPresentation=1&rendererResidentDevice=1`
record the request, but mounted presentation falls back to the console-clean
Three WebGL engine path while WebGPU compute remains available. The validated
probe `artifacts/sph-probe-three-webgpu-presentation-gated-webgl-fallback-1.json`
is `status=good`, has zero browser console issues/page errors, and displays
H2O through the in-engine `three-render-row-spheres` fallback. This is a
correctness/mobile guardrail only. The throughput acceptance gate remains a
direct engine-owned GPU renderer/native marching-cubes consumer that passes
console plus pixel validation without full CPU surface readback.

Current routing note, 2026-06-18 AKDT: browser visual probes now treat
DevTools console WebGPU validation as first-class evidence. The probe captures
page console/pageerror events, analysis emits `browser-console:*` issues, and
the matrix aggregates `browserConsoleIssueCounts`. Do not call a browser
visual run clean unless this count is empty. The resident SPH WebGPU device
request now asks for supported higher `maxBufferSize` and
`maxStorageBufferBindingSize` limits, fixing the 305,015,808-byte material
interface candidate buffer on capable adapters. The remaining
`peercompute-worker-inline-fallback` console warning is not explained by a
ULG disabled-by-default setting: the browser resident host passes
`enableWorkers=true`, while PeerCompute still reports Worker support false in
the captured context. Treat it as Worker capability/bootstrap work, not as a
WebGPU memory-limit or shader issue.

Current routing note, 2026-06-18 AKDT: Three WebGPU presentation remains an
explicit experiment, not a default path. The non-overlay
`three-webgpu-surface-buffers` bridge is wired through engine-owned
surface-draw state and can still be unit-tested behind an explicit future
capability, but normal mounted probes block it because Three WebGPU currently
fails browser error-scope validation. The safe mounted behavior is now:
requested WebGPU presentation blocked, actual renderer `three-webgl`, requested
surface-buffer bridge downgraded to `three-render-row-spheres`, and no overlay
or second canvas. Keep the next architecture work on resident MLS-MPM, native
WebGPU marching-cubes surface extraction, and a direct engine-owned GPU buffer
consumer that passes console plus pixel validation.

Current routing note, 2026-06-18 AKDT: the unsafe Three WebGPU presentation
diagnostic flag exists only to reproduce and inspect the blocked path. The
probe `artifacts/sph-probe-three-webgpu-presentation-unsafe-diagnostic-1.json`
gets as far as `three-webgpu-renderer-ready` with an app-owned resident WebGPU
device, then throws page error `Instance dropped in popErrorScope`. Do not
promote this route until a browser run is console-clean and pixel-validated;
use it as failure evidence while building the proper direct GPU/native
marching-cubes consumer.

Current routing note, 2026-06-18 AKDT: direct-consumer handoff telemetry now
separates compact `surface-draw-buffers` from lower-level
`render-field-buffers`. The current no-summary MLS-MPM route is the latter:
it is a valid no-readback resident GPU handoff, but it explicitly requires
native marching-cubes surface extraction before visible draw rows exist. Treat
`requiresSurfaceExtraction=true` as the next implementation target, not as a
reason to fall back to CPU geometry or an overlay.

Current routing note, 2026-06-18 AKDT: the sibling
`/home/cos/projects/webgpu-marching-cubes` adapter now supports buffer-backed
scalar volumes, and ULG exposes
`createUlgRenderFieldBufferVolumeDescriptor()` for retained render-field
density buffers. The next native-MC slice should call the extension's
`createBufferVolumeDescriptor`/surface extraction path from this descriptor and
bind the resulting buffers into the engine-owned surface draw path.

Current routing note, 2026-06-18 AKDT: retained no-summary render-field
handoffs now publish per-surface native MC buffer-volume descriptor summaries
in `sphResidentRenderState`. The browser contract test asserts descriptor
schema/status/counts plus scalar-buffer layout/stride metadata, so broken or
ambiguous marching-cubes volume wiring should fail before a weird visible mesh
is treated as evidence. Continue with the native extraction binding; do not
revive the old tetrahedral compact fallback as the main renderer.

Current routing note, 2026-06-18 AKDT: the sibling WebGPU marching-cubes
adapter now exposes a renderer-free preflight/capability contract, and ULG's
wrapper consumes it before extraction. Future extension surface failures should
surface as `extension-preflight-blocked` / adapter-contract issues before
renderer integration, not as late WebGPU bind-group errors. This is still a
boundary/safety gate; the throughput win requires resident surface rows to be
consumed by the engine-owned GPU renderer path without full geometry readback.

Current routing note, 2026-06-18 AKDT: retained surface-draw metadata now has
an explicit GPU-only handoff contract for no-full-readback paths. When compact
surface-draw summaries are not read, the WebGPU builder publishes retained draw,
indirect, and compacted-vertex buffers plus conservative upper-bound
vertex/triangle draw ranges and a `surface-draw-gpu-resident-*` status instead
of pretending it knows exact active surface counts. This is the contract the
future direct renderer/native marching-cubes consumer should use; exact CPU
summaries remain diagnostic/parity tools, not a hot-loop requirement.

Current routing note, 2026-06-18 AKDT: native marching-cubes retained surface
rows now use the same container-clipping contract as the CPU MarchingCubes
path. The extension-to-ULG translation shader accepts `[0,0,0]..boxDims`,
clamps transformed compact MC positions before writing ULG surface rows, and
publishes exact no-readback vertex/triangle ranges plus conservative bounds.
This targets the weird/perspective-dependent native MC mesh artifact without
adding an overlay or CPU geometry fallback. Remaining work is still the
engine-owned same-device WebGPU renderer consumer and pixel validation.

Current routing note, 2026-06-18 AKDT: the direct Three WebGPU surface-buffer
consumer now has an explicit unsafe diagnostic flag:
`renderer=webgpu&rendererPresentation=1&rendererResidentDevice=1&rendererPresentationUnsafe=1&surfaceBufferPresentation=1&surfaceDraw=three-webgpu-surface-buffers`.
The safe default remains fail-closed. Manual console-harness evidence shows
the flag makes same-device capability report `same-device-gpu-buffer-geometry-supported`,
but the render refresh still fails before mesh binding with page error
`Instance dropped in popErrorScope` during the shared renderer-owned GPUDevice
surface-draw metadata queue wait. Treat this as the current direct-renderer
blocker: solve Three WebGPU error-scope/lifetime sequencing on the shared
device before promoting external surface buffers or pixel-validating them.

Current routing note, 2026-06-18 AKDT: explicit native/extension
`three-webgpu-surface-buffers` requests now preserve the no-full-readback
resident surface-buffer handoff instead of forcing compact Three geometry
readback when the visible Three WebGPU bridge is blocked. The new
`surfaceDrawGpuBufferHandoff*` telemetry marks when retained draw, indirect,
and compacted-vertex buffers are ready for a direct GPU consumer. Mounted
WebGL fallback probes can still show H2O through `three-render-row-spheres`;
those visible fallbacks do not satisfy the direct GPU consumer gate unless the
handoff counter is nonzero.

Current routing note, 2026-06-18 AKDT: ULG now follows NodeKernel for both GPU
resident stage placement and execution when a real NodeKernel owns the
resident ComputeManager. The mechanics stage chain records
`node-kernel-execution` and
`peercompute.nodekernel.gpu-resident-stage-execution-authority.v0`; direct
injected ComputeManagers stay on `compute-manager-execution`. PeerCompute is
now ahead of the older todo wording: placement executor contracts, execution
authority, remote result metadata admission, and local hot-buffer refresh
surfaces exist in sibling PeerCompute. Next architecture priority is to wire
ULG to those remote/admission/refresh surfaces deliberately for opt-in
non-advisory remote resident-stage work, without treating remote retained refs
as local handles.

Current routing note, 2026-06-18 AKDT: the browser WGSL parser error in
`ulg-sph-render-field-surface-summary` is fixed. `active` was renamed to
`has_active_cells`, and the WebGPU ABI test now guards against exact WGSL
`let|var|const active` declarations. The separate
`ulg-sph-thermal-output-state used in submit while destroyed` warning is also
fixed: retained thermal output destruction is now idempotent and deferred until
submitted WebGPU queue work completes, and resident cleanup releases superseded
thermal buffers through the thermal stage destroyer before generic direct
buffer cleanup can touch them. Keep watching browser console issue counts for
regressions.

Current routing note, 2026-06-18 AKDT: initial particle spacing should be
treated as physics setup, not rendering density. ULG now records an explicit
initial particle-size policy and per-particle size state: rest size comes from
material, initial temperature, phase/rest-density closure, target neighbor
count, and box/support constraints, while current size can follow pressure
through `restVolumeM3 * volumeRatioJ`. Same-material/same-temperature
drop/base particles keep matching rest radius; supported base particles report
pressure-adjusted current radius through hydrostatic initialization and render
rows. The remaining initialization work is to make MLS-MPM/contact/timestep
and marching-cubes rows consume these algorithm-derived size views directly,
not to tune role-specific visual scale.

Current routing note, 2026-06-18 AKDT: add a precomputed material-property JSON
bank as an explicit material resolver/cache todo. The scope ladder is elements
first, then element crystalline-structure records, then a top-1000 common
compound bank after schemas and provenance gates are stable. Treat these JSON
records as versioned, unit-bearing, provenance-rich warm inputs for
initialization, PBR, table packing, and resolver caches, not as unvalidated
source-of-truth constants.

Current routing note, 2026-06-19 AKDT: the element JSON bank is now wired into
`MaterialRegistry` as optional warm metadata, not as a sampled-property source.
Lookup canonicalizes element symbols from material keys such as `fe`, strict
closure sampling still owns returned property values and provenance, and warm
inputs carry bank schema version plus generator fingerprint for cache
fingerprinting. Continue by expanding element coverage, adding stale
schema/provenance rejection fixtures, and consuming accepted rows in GPU
material-table and particle-size packing.

Current routing note, 2026-06-19 AKDT: stale/provenance rejection fixtures are
now covered for the element material-property bank. The JSON schema requires
supported `schemaVersion: 1`, the runtime normalizer rejects stale/future
versions, and tests mutate records to require unknown provenance statuses and
missing units to fail closed. The next material-bank work is element coverage
expansion and GPU material-table/particle-size packing consumption.

Current routing note, 2026-06-19 AKDT: active material-property bank coverage
now includes `H`, `O`, `Li`, `Na`, `K`, `Rb`, `Cs`, `Fe`, and `Pd`. This covers
the alkali reaction paths and Palladium PBR/mobile probe while keeping new rows
as `reduced-estimate` warm seeds from `elementMaterialClosure`. Full selectable
non-noble element coverage remains open, as does accepted-row consumption by
GPU material-table and particle-size packing.

Current routing note, 2026-06-19 AKDT: the initial particle-spacing path now
has an accepted-row hook. `buildSphPhaseDemoState({ materialPropertyBank })`
normalizes the bank, attaches matching role warm inputs under
`initialParticleSpacing.materialPropertyBankWarmInputs`, and reports missing
roles such as `h2o` instead of inventing compound rows. The remaining runtime
work is default browser bank loading and actual GPU material-table /
particle-size packing consumption.

Current routing note, 2026-06-19 AKDT: default demo builds now load the
checked-in element JSON bank via `defaultMaterialPropertyBank.js`; Vite bundles
the JSON import successfully. Explicit callers can still pass
`materialPropertyBank: null` to suppress bank metadata. The remaining
material-bank runtime work is GPU material-table and particle-size packing
consumption, plus full selectable non-noble element coverage.

Current routing note, 2026-06-19 AKDT: accepted element bank warm inputs now
pack into explicit GPU-ready warm-input and particle-size tables. Demo
initialization attaches those tables under `initialParticleSpacing`, SPH and
MLS-MPM particle buffer builders/uploaders carry optional storage buffers for
the rows, and remote PeerCompute seed graphs preserve/hash optional
`initialParticleSpacing`. Continue with full selectable non-noble element
coverage and actual shader-stage row consumers.

Current routing note, 2026-06-18 AKDT: after the resident MLS-MPM and native
WebGPU marching-cubes implementation lands, adapt material-property derivation
for the algorithms that consume those rows. Track this in
`plan/todo/algorithm-derived-material-properties-plan.md`. MLS-MPM mechanics,
contact, timestep/CFL policy, particle mass/support/spacing, marching-cubes
isovalue/smoothing/normal policy, and surface PBR rows should become
algorithm-shaped derived views of fundamental closures, not new hand-tuned
constants. The precomputed JSON bank can seed/cache these rows only with
schema, unit, validity-domain, and provenance gates intact.

Current routing note, 2026-06-18 AKDT: slot the new material polytope and
property-fit roadmap after the element/crystal JSON bank and after the first
algorithm-derived row schemas are stable. Track it in
`plan/todo/material-polytope-registry-and-property-fit-plan.md`. Its job is to
discover valid state domains, replay first-principles samples inside those
domains, and fit cheap runtime response functions with residual/provenance
gates. Do not let it become a hand-authored constants table or a reason to
extrapolate outside accepted domains.

Current routing note, 2026-06-18 AKDT: slot the electron-cloud/material
derivation visualization plan after provenance-backed material bank,
algorithm-row, and polytope/sample/fit artifacts exist. Track it in
`plan/todo/electron-cloud-material-derivation-visualization-plan.md`. Its
first implementation should be replay/inspection of accepted derivation
artifacts: orbital clouds, radial density, molecular charge density, bonding,
polytope domains, sample points, fits, and final reduced runtime rows. It must
not run heavy quantum derivation on the main render loop or create a second
authority path for material properties.

Current routing note, 2026-06-18 AKDT: the cold same-material CPU-SPH
solid-H2O static row remains stable under the current dense visual sequence
harness. `codex-solid-h2o-static-sequence-20260618` passed with nine frames
over `0.9216 s`, max displacement `1.19e-7 m`, max speed `0.00147 m/s`,
two H2O visible surfaces from first to last frame, and empty issue lists. Keep
the ice/solid bug class open, but focus the next evidence on mixed
solid/liquid contacts, resident/mounted solid mechanics, phase-transition
solid behavior, and live-render cadence rather than the already-passing static
same-material CPU-SPH fixture.

Current routing note, 2026-06-18 AKDT: CPU-SPH visible water flow and a
practical resident MLS-MPM smoke path now have opt-in dense visual sequence
gates. `codex-cpu-sph-flow-sequence-20260617` passed the CPU-SPH H2O/H2O row
with nine frames over `0.9216 s`, final tallness `0.587`, and footprint fill
`0.297`. `codex-mlsmpm-flow-smoke-pass-20260618` passed the lower-resolution
resident MLS-MPM smoke row with nine frames over `1.024 s`, one H2O
surface/component, final tallness `0.767`, and footprint fill `0.151`. The
full 3x5 resident MLS-MPM row remains the stricter gate and is still costly
under headless WebGPU/SwiftShader; keep it for deeper validation, but use the
smoke row for periodic visual sanity.

Current routing note, 2026-06-17 AKDT: reaction execution and product
visibility now have a focused CPU/plain-SPH visual contract, but live fluid
motion remains an active behavior/UX gate. The Na/H2O room-temperature blob-1
row now fails unless cumulative reaction events exist, `naoh` and `h2` are in
the final particle inventory, and `Na` is absent; the status panel also reports
current material counts instead of stale drop/base role counts. Evidence:
`codex-reaction-panel-contract-rerun-20260617` passed with
`maxReactionEventsTotal=8` and final particles `{h2o:125, naoh:8, h2:8}`.
Separate evidence says the apparent "fluids do not flow" report is still not
closed: long atomics pass, but short visual rows under-sample simulated time
and still look tall/low-footprint. Next behavior item after the current
architecture clean point is a browser visual-cadence/sequence gate that drives
enough simulated time for H2O/H2O CPU-SPH and MLS-MPM, captures close-spaced
frames, and makes real motion or lack of motion unambiguous.

Current routing note, 2026-06-17 AKDT: ULG now routes mechanics stage
placement preflight through NodeKernel when a real NodeKernel owns the
ComputeManager, and records both NodeKernel authority and raw ComputeManager
preflight in telemetry. Injected/local-only ComputeManagers stay on the direct
ComputeManager preflight path. Evidence: ULG PeerCompute integration `16/16`,
physics atomics `11` pass with `3` expected opt-in skips, and visual matrix
`codex-nodekernel-stage-placement-preflight-20260617` passed `3/3`. Next:
design the first real remote/dedicated resident-stage placement executor, still
fail-closed for non-advisory distributed placement until retained-ref locality,
cache admission, and peer capability checks are enforced.

Current routing note, 2026-06-17 AKDT: ComputeManager now owns an advisory
GPU resident stage-placement preflight. Before ULG executes the mechanics
stage plan, it asks PeerCompute for
`peercompute.compute.gpu-resident-lane-stage-placement-preflight.v0`, which
uses the same dependency batches and state-family read/write conflict policy
as execution. Telemetry now records placement batches, max concurrent stage
count, executor sources, Worker readiness/fallback, and missing executors.
Evidence: PeerCompute lane tests `10/10`, ULG PeerCompute integration
`16/16`, physics atomics `11` pass with `3` expected opt-in skips, and visual
matrix `codex-stage-placement-preflight-20260617` passed `3/3`. Next:
connect this report to actual ComputeManager/NodeKernel placement across
Workers, devices, and peers; do not claim true distributed WebGPU concurrency
until placement can fail closed and retained refs are consumed where they live.

Current routing note, 2026-06-17 AKDT: GPU resident ready batches now respect
state-family read/write conflicts. PeerCompute defers ready stages with
write/write, write/read, or read/write overlap and reports the exact deferral
records; ULG mechanics stage-chain telemetry now exposes that policy. This is
the missing guard between "more concurrency" and "unsafe concurrency." Next:
promote this from per-lane stage execution into broader ComputeManager/GPUHub
placement across Workers, devices, and peers.

Current routing note, 2026-06-17 AKDT: the Worker-retained access contract is
now being consumed, not only published. `host.planWorkerRetainedContinuation()`
produces `peercompute.ulg.worker-retained-continuation-plan.v0` from admitted
hot-buffer evidence and blocks when required output families, retained refs,
same-Worker consumer mode, or Worker runner availability are missing. The
mechanics stage chain now records that plan and uses it to enable retained G2P
input. Next architecture priority: generalize this into ComputeManager/GPUHub
placement over state-family read/write sets so independent law families can
overlap without copying or overwriting authoritative resident state.

Current routing note, 2026-06-17 AKDT: WebGPU concurrency is improved but not
sufficient. Sibling PeerCompute now executes GPU resident lane stage plans in
explicit dependency-ready batches, and ULG's mechanics contract declares the
law-stage DAG rather than relying on linear pass order. The current accepted
batches prove scheduler-level overlap (`p2g` plus independent
`pressureInterface` before `gridUpdate`), not guaranteed simultaneous GPU
kernel execution on one ordered WebGPU queue. Evidence: PeerCompute lane tests
passed `8/8`; ULG PeerCompute integration passed `16/16`; physics atomics
passed `11` with `3` expected opt-in skips; recurring visual matrix
`codex-stage-dependency-batches-20260617` passed `3/3`. Next architecture
priority: use worker-retained access contracts plus state-family read/write
sets for conflict-aware placement and same-Worker retained-ref continuations.
Do not treat this as a physics behavior fix; liquid, ice/solid, z-buffer/focus,
and long-horizon stability bugs remain in the behavior lane.

Current routing note, 2026-06-17 AKDT: architecture work is active before the
next physics behavior pass. Worker-retained law-family hot-buffer publications
now carry `peercompute.ulg.worker-retained-access-contract.v0` through
StateManager hot records, warm deltas, and import descriptors for mechanics,
thermal/phase, pressure/interface, and reaction/product outputs. The contract
distinguishes same-device main-thread aliases from Worker-private retained GPU
refs that must be consumed by scheduling a continuation on the same
Worker/lane. Evidence: syntax checks passed; focused PeerCompute integration
for mechanics/reaction/pressure Worker-retained output descriptors passed
`16/16`; `npm run test:physics-atomics` passed `11` checks with `3` expected
opt-in skips; recurring short visual matrix
`codex-worker-retained-contract-20260617` passed `3/3` with empty issue counts
and frame artifacts. Next architecture item: use this contract in
ComputeManager/GPUHub placement so independent law-family/closure/cache/remote
tasks can overlap and Worker-retained outputs continue on the lane where their
buffers live. WebGPU concurrency is not sufficient yet because too much still
serializes around ordered queue fences/readbacks. The known physics behavior
bugs remain tracked for the next behavior pass after this architecture lane.

Current routing note, 2026-06-17 AKDT: the resident MLS-MPM H2O render-field
surface now merges visually without the previous cuboid/chopped look. The
surface topology had already reported one H2O surface and one connected
component; the misleading "not merging" artifact came from
`applySurfaceFields()` clipping current visible render-field vertices to
particle bounds before display. Current render fields now keep that bounds
check diagnostic-only, still clamp to the container, and the probe fails if a
visible resident surface is ever particle-bounds-clipped again. Evidence:
`codex-mlsmpm-h2o-unclipped-renderfield-cellslack-20260617` passed with empty
issues, one H2O surface/component, final tallness `0.488`, footprint fill
`0.356`, no particle-bound overflow, and five frames. Keep broader surface
smoothing, true raw WebGPU overlay depth sharing, mobile focus-resume flashing,
ice/solid flow, and PeerCompute/WebGPU law-stage migration open.

Current routing note, 2026-06-17 AKDT: the default Three/MarchingCubes H2O
z-buffer/draw-through issue is fixed for condensed transmissive water. The
renderer was incorrectly treating non-vapor transmission as alpha transparency,
so liquid H2O used `transparent=true`, `depthWrite=false`, and same-layer
transparent sorting. That allowed the floor grid to draw through water and made
merged liquid shells visually unreliable. H2O liquid now renders as
depth-writing physical transmission (`transparent=false`, `depthWrite=true`,
stable order), while vapor/alpha surfaces stay non-depth-writing. Evidence:
renderer tests passed `35/35`; CPU-SPH post-patch long visual row
`codex-cpu-sph-h2o-depthwrite-long-20260617` and resident MLS-MPM post-patch
row `codex-mlsmpm-h2o-depthwrite-merge-20260617` both passed with one H2O
surface, one connected component, empty visual issue counts, and depth-writing
transmissive metadata. Keep low-resolution MLS-MPM blockiness, explicit raw
WebGPU overlay depth sharing, and mobile focus-resume flashing in the open
visual-trust lane.

Current routing note, 2026-06-17 AKDT: the resident MLS-MPM H2O/H2O
free-surface spread regression is fixed for the browser/resident split path.
The root cause was a parity break in the resident grid-update floor boundary:
the split CPU/WGSL path zeroed velocity for the first interior grid row at
`y <= dx`, while the monolithic CPU carrier only fully no-slips the floor guard
row below `dx`. That froze the row floor-supported liquid needed for tangential
spread, producing the sticky/nested block-like water screenshots. The resident
grid-update CPU and WGSL kernels now leave the first interior row active, grid
update pipeline cache keys are bumped, and acceptance coverage includes a new
resident split long-horizon free-surface gate. Evidence:
`ULG_RUN_LONG_LIQUID_ATOMIC=1 node --test tests/physicsBehaviorInvariants.test.mjs --test-name-pattern "resident MLS-MPM H2O/H2O long-horizon"`
passed `14/14`; visual matrix
`codex-mlsmpm-free-surface-1s-floorfix-finalframe-20260617` passed with
`failedCount=0`, final tallness `0.440`, footprint fill `0.182`, one connected
H2O surface, no visual issues, and five close-spaced frames. Keep visual polish,
surface smoothing, mobile focus-resume flashing, z-buffer pixel evidence,
ice/solid flow, and the PeerCompute/WebGPU law-stage migration open.

Current routing note, 2026-06-15 AKDT: CPU-SPH same-material water now passes
the long free-surface visual gate, but MLS-MPM remains the active liquid P0.
The CPU reference lane uses a small, law-gated reduced free-surface relaxation
closure to spread floor-supported liquid groups toward a volume-derived
footprint, with shape acceptance now guarded by atomics and the browser visual
matrix. Evidence: `codex-cpu-sph-free-surface-fix-long-20260615` passed with
last H2O tallness `0.582`, footprint fill `0.296`, one connected surface, and
empty issue counts. Next behavior work should move the same standard to
MLS-MPM/WebGPU-resident mechanics without turning this CPU closure into hidden
scene authority.

Current routing note, 2026-06-15 AKDT: the free-surface/levelness validation
gate now exists and currently fails the representative same-material H2O rows.
`scripts/sph-long-horizon-probe.mjs` reports H2O liquid surface height,
tallness ratio, and footprint fill ratio; setting
`ULG_PROBE_EXPECT_LIQUID_FREE_SURFACE=1` makes the analyzer emit explicit
`liquid-free-surface-*` issues. Visual matrix run
`codex-free-surface-gate-h2o-short-fixedsummary-20260615` failed both short
H2O rows with one connected surface but excessive tallness and insufficient
footprint fill. Treat this as the active P0 behavior gate before more
architecture work: liquids must spread/settle through law-governed mechanics,
not just render as bounded connected blobs.

Current routing note, 2026-06-15 AKDT: MarchingCubes connected-component
metrics are now available in the long-horizon probe and visual matrix summary.
The first baseline did not confirm disconnected fragmentation:
`codex-surface-components-h2o-baseline-20260615` reported one connected H2O
surface for both MLS-MPM and CPU-SPH short rows, and medium MLS-MPM probe
`codex-mlsmpm-h2o-medium-components-20260615` still reported one connected
surface. The visible problem is now sharper: MLS-MPM liquid remains a tall,
blocky connected body instead of flattening into a plausible free surface, and
medium visual validation is expensive because compact summaries dominate batch
time. Next P0 is a free-surface shape/levelness metric plus the mechanics fix
that makes liquid spread/settle.

Current routing note, 2026-06-15 AKDT: renderer depth/order visual trust now
has a recurring matrix gate. The long-horizon probe captures explicit
render-layer, render-order, depth-write/depth-test, and container grid/wire
metadata, and the analyzer fails on bad transparent sorting, bad opaque depth
writes, or broken overlay ordering. Focused evidence:
`codex-render-depth-policy-cpu-sph-20260615` and
`codex-render-depth-policy-solid-liquid-20260615` both passed with empty issue
counts; the mixed row showed H2O as transparent no-depth-write/same-layer
sortable, Fe as opaque depth-write, and grid/wire as non-depth-writing
overlays. Fresh combined evidence
`codex-render-depth-policy-two-row-refresh-20260615` passed both rows with
empty issue counts and three frames each. Keep mobile focus-resume flashing and
pixel-level z-buffer probes open, but do not accept future visual-matrix rows
if this metadata guard fails.

Current routing note, 2026-06-15 AKDT: the immediate long-horizon CPU-SPH
same-material liquid settling regression is closed for the mounted/browser
reference lane. Contact-at-wall now removes the residual gravity half-kick,
and explicit SPH liquid viscosity/wall damping runs through the viscosity law
group instead of hidden renderer or scheduler behavior. Evidence:
`ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` passed
`13/13`; visual matrix `codex-cpu-sph-liquid-viscosity-short-20260615` passed;
long browser probe `codex-cpu-sph-h2o-long-after-sph-viscosity-20260615`
passed with H2O visible surface count `1 -> 1`, no visual issues, final drop
speed about `0.246 m/s`, and ten captured frames. Next P0 remains behavior
before architecture: MLS-MPM fragmentation, broader liquid free-surface
quality, mounted ice/solid visual trust, z-buffer/draw-order, and
focus-resume flashing. Then continue the ComputeManager/GPUHub law-stage move.

Current routing note, 2026-06-15 13:07 AKDT: the immediate CPU-SPH
same-material liquid render-domain bug is fixed for the browser path. CPU
MarchingCubes rendering now merges same-material liquid domains into one
visible surface, while preserving same-material solid domains as separate
support/contact surfaces. The visual probe also accounts for one actual
MarchingCubes grid cell of sampling slack in particle-bound checks, using
runtime metadata from the rendered mesh rather than a blind tolerance.
Focused evidence: `codex-cpu-liquid-merge-surface-short-cellslack-20260615`
passed with H2O visible surface count `1 -> 1`, empty issue counts, and three
frames. The public/default Na/H2O row
`codex-default-na-h2o-plain-sph-blob1-20260615` also passed with `mech=sph`,
`293.15 K`, `blob=1`, empty issues, and three frames. This does not close
long-horizon liquid settling/free-surface quality or renderer z-buffer/focus
trust; keep those next in the P0 behavior lane.

Current routing note, 2026-06-15 12:32 AKDT: the current full short-horizon
visual matrix baseline is clean. `codex-full-after-sph-partition-and-stale-surface-20260615`
passed all 12 scenarios with empty issue counts and three frame artifacts per
row. This clears the immediate P0 regressions from pressure/gas products,
no-force SPH projection, solid/liquid contact, Na/H2O stale reactant surfaces,
and law-toggle mode drift. Do not over-promote this to final liquid quality:
short CPU-SPH H2O/H2O still visually shows stacked separate H2O surfaces, so
the next P0 behavior item is a longer liquid merge/free-surface acceptance
gate, followed by z-buffer/depth-order and focus-resume visual trust.

Current routing note, 2026-06-15 12:16 AKDT: the public-default Na/H2O
plain-SPH visual row now passes. The remaining visual issue after the pressure
partition fix was stale CPU MarchingCubes retention: the Na solid surface stayed
visible for grace frames after reaction products consumed the Na batch. CPU
particle surfaces now hide immediately when their material/phase batch is
absent, while resident render-field grace remains available for transient GPU
readback gaps. Targeted matrix
`codex-sph-reaction-roomtemp-blob1-no-stale-na-20260615` passed with empty
issue counts and five frames. Next P0 behavior priorities are broader liquid
free-surface/settling quality, renderer z-buffer/depth-order and focus-resume
trust, then continuing the PeerCompute/WebGPU law migration.

Current routing note, 2026-06-15 12:08 AKDT: the Na/H2O plain-SPH reaction
motion failure is narrowed and the pressure-side bug is fixed. Plain SPH now
keeps only liquid particles in the condensed density/pressure/PBF solve;
solids and reaction gases remain particles/ledger evidence but no longer
inflate liquid pressure mass. Atomic physics coverage passes for solid-liquid
Fe/H2O and room-temperature Na/H2O reaction products. The targeted visual row
now proves calm dynamics for public defaults (`Na + h2o`, `293.15 K`,
`mech=sph`, `blob=1`) with max speed about `0.541 m/s`; the only remaining
targeted failure is a Na solid MarchingCubes surface-envelope overflow of
about `0.102 m` after the allowed support-radius/tolerance expansion. Keep
that under renderer/probe visual-trust priority, alongside the reported
z-buffer/focus issues. Do not reopen the resolved gas-as-liquid pressure bug
unless a sequence again shows speed clamp, pressure impulse, or product gases
participating in liquid pressure.

Current routing note, 2026-06-15 11:22 AKDT: the no-force plain-SPH
law-isolation failure is closed. The `law-static-gravity-off-fe-h2o` matrix
scenario now disables EOS, pressure, and viscosity as well as gravity, and SPH
density projection is gated by the EOS law group. Focused visual matrix
`codex-gravity-off-static-no-force-after-eos-gate-20260615` passed with zero
motion and five frame artifacts, and physics atomics now include a no-force
plain-SPH invariant. Next priority remains the real behavior debt in the full
matrix: solid/liquid contact surface overflow, Na/H2O reaction motion,
thermal-off hot-water speed, same-material liquid merge/free-surface quality,
ice/solid rigidity in mounted paths, and renderer z-buffer/focus visual trust.

Current routing note, 2026-06-15 11:03 AKDT: the H2O visual surface bounds
failure is narrowed. The matrix no longer treats normal MarchingCubes support
radius as geometry escaping particle bounds; `particleBoundsToleranceM` is now
augmented by each surface's rendered support radius. Focused H2O visual trio
`codex-surface-radius-bounds-trio-20260615` passes with frame artifacts and
empty issue counts. Keep the real behavior debt open: short liquid scenarios
still show two visible H2O surfaces, and long-horizon liquid merge/free-surface
quality still needs a dedicated visual acceptance gate before we can say water
settling is fixed.

Current routing note, 2026-06-15 10:56 AKDT: the visual sanity matrix now
defaults to writing close-spaced PNG frame artifacts and propagates
`analysis.issues` plus compact visual-surface issue details into
`summary.json`. This fixes a validation blind spot from the `11/12` failed
full matrix: failures are now actionable at the matrix summary layer instead
of requiring manual digs into each giant probe JSON/log. Keep this as the
mandatory visual gate for each major slice. The next active behavior target is
the now-visible H2O surface identity/bounds failure: same-material CPU-SPH
liquid still renders as detached/stacked H2O surfaces with
`visible-surface-expanded-beyond-particle-bounds`, so visual acceptance is not
cleared even when physics atomics pass.

Current routing note, 2026-06-15 10:48 AKDT: the immediate no-full Na/H2O
spatial-gas blocker is now past the sealed-box fallback. The WebGPU
`spatialGasLedgerProducer` compact stage transcodes retained product-event rows
to compact spatial-gas rows, while the JS decoder performs the safety filter
for active gas rows. The mounted gate now proves positioned H2 product-event
rows feed `gasCellEosProducer` and the admitted pressure gas-cell import
without full product-event readback, with aggregate fallback disabled. Keep a
follow-up item for the WGSL predicate/filter anomaly: do not reintroduce
shader-side boolean filtering on compact rows until a small fake-device/browser
probe proves Chromium/Dawn writes expected rows. The public defaults are plain
SPH CPU reference, sodium over water, both `293.15 K`, blob size `1`, and the
GitHub Pages build has been regenerated. Next priority is WGSL gas-cell EOS
inside the ComputeManager/GPUHub stage, while P0 visual behavior remains open:
the full matrix failed `11/12` after this slice, mostly due H2O surface
identity/bounds, Na/H2O high-speed motion, CPU-SPH stacked/blob settling, solid
rigidity, and renderer visual-trust issues.

Current routing note, 2026-06-15 09:57 AKDT: the no-full mounted Na/H2O path
now runs the resident spatial-gas producer, gas-cell EOS producer, and admitted
gas-cell import path without full product-event readback. This uses a strictly
provenanced bridge: positioned compact rows win, but if retained compact rows
are inactive/positionless and the aggregate gas species ledger is ready, the
producer emits a one-cell sealed-box spatial ledger labelled
`aggregate-gas-ledger-single-cell-sealed-box` with position source
`aggregate-gas-ledger-no-positioned-product-events`. Treat this as a temporary
correctness bridge only. The next priority remains a true GPU/worker positioned
spatial-gas ledger producer from retained product-event buffers, followed by a
WGSL EOS producer. The public demo defaults are now plain SPH, sodium over
water, both `293.15 K`, blob size `1`, and the latest GitHub Pages build is in
`docs/`. Keep MLS-MPM fragmentation, CPU-SPH stacked/blob behavior, long-
horizon/free-surface quality, ice/solid rigidity, volume pulsing/blinking, and
renderer z-buffer/focus visual trust open.

Current routing note, 2026-06-15 09:18 AKDT: resident product-mass handles now
preserve positioned product-event records when records are available, and the
preferred resident product-mass gas-ledger pressure path can derive a spatial
gas species ledger from those records. This enables the gas-cell EOS producer
route for compact-record/reference product-event paths without returning to
scene snapshot imports. The live no-full Na/H2O browser gate still blocks
correctly because it has retained product-event rows but zero CPU-side event
records, so the next priority is a GPU/worker compact spatial-gas ledger
producer from retained product-event buffers. That producer should emit
`peercompute.ulg.sph-spatial-gas-species-ledger.v0` or an admitted retained
descriptor without full product-event readback, then feed the existing
`gasCellEosProducer` stage.

Current routing note, 2026-06-15 08:55 AKDT: the mounted resident
pressure-interface hot path no longer publishes gas-cell imports from
`gasPressureSummary` snapshots. The helper keeps snapshot import compatibility
by default for explicit callers, but mounted refresh passes
`allowSummaryGasCellFieldImport=false`, so normal hot-path imports must come
from a supplied admitted import or a resident `gasCellEosProducer` result.
Snapshot candidates now block as `blocked-snapshot-gas-cell-import-disabled`
with retained-ref and snapshot-readiness diagnostics instead of being
published. Next priority: make normal resident scenarios emit a ready spatial
gas species ledger so this producer route is active in realistic gas/product
cases, then move gas-cell EOS derivation into a WGSL/WebGPU kernel. Keep the
visible physics-quality blockers open.

Current routing note, 2026-06-15 08:32 AKDT: the mounted resident
pressure-interface hot loop now requests `gasCellEosProducer` through the
resident authority host when a ready spatial gas species ledger exists and no
ready gas-cell import is already supplied. The request is fail-closed and
telemetry-bearing: missing spatial ledgers, missing host submitters, submitted
task status, retained gas-pressure refs, retained source readiness, and
spatial ledger cell counts are all surfaced on the resident pressure-interface
state. Ready producer output is fed into the existing host-published gas-cell
admission/import helper rather than letting the scene become a scheduler.
Next priority: remove the remaining snapshot-derived gas-cell import fallback
from the mounted hot path once normal resident scenarios produce a spatial gas
ledger, then promote the EOS derivation itself into a WGSL/WebGPU compute
stage. Keep MLS-MPM fragmentation, CPU SPH stacked/blob behavior, mounted ice/
solid rigidity, volume pulsation/blinking, long-horizon liquid settling,
renderer z-buffer/draw-order, and focus-resume visual trust open.

Current routing note, 2026-06-15 08:14 AKDT: the resident gas-cell EOS
producer is now in the formal ComputeManager mechanics stage-chain before
pressureInterface. Opt-in chains can execute
`p2g -> gasCellEosProducer -> pressureInterface -> gridUpdate -> g2p`, use the
resident authority host to publish/admit/import the producer's retained
gas-cell field, and feed the imported field into pressureInterface without
fabricating a partial pressure feedback object. The scene helper can publish
from a producer result source, and the resident worker mirrors the same
behavior. Next priority: wire the mounted resident hot loop to request this
producer stage when spatial gas ledger inputs are available, then retire
snapshot-derived scene gas-cell imports from the hot path. Keep WGSL EOS,
long-horizon liquid quality, MLS-MPM fragmentation, CPU SPH stacked/blob
behavior, ice/solid rigidity, volume pulsation/blinking, z-buffer/draw-order,
and focus-resume visual trust open.

Current routing note, 2026-06-15 07:34 AKDT: the dedicated resident gas-cell
EOS producer stage surface is in place. `gasCellEosProducer` can derive the
local gas-cell pressure field from a spatial gas species ledger, pack the
shared 12-float gas-pressure-cell ABI, upload/retain it on a WebGPU lane, and
publish a retained gas-cell field source descriptor for pressureInterface
admission/import. The worker stage registry recognizes the new law stage.
Next priority: wire this producer into the live resident stage chain and scene
host publication path so snapshot-derived gas-cell imports are replaced by
ComputeManager/GPUHub-owned producer output. Keep the eventual WGSL EOS shader
and all visible physics-quality blockers open.

Current routing note, 2026-06-15 07:13 AKDT: pressure/interface gas-cell
admission/import now consumes the retained gas-cell field source descriptor
directly. The host can derive worker/local retained gas-pressure refs and row
metadata from
`peercompute.ulg.pressure-interface-retained-gas-cell-field-source.v0` even
when caller ref arrays are empty, and it persists the descriptor through
StateManager admission/import hot and warm records. Next priority: replace the
remaining local gas-cell snapshot requirement by adding the dedicated resident
gas-cell EOS producer stage under ComputeManager/GPUHub, then feed that
retained output into pressureInterface. Do not mark liquid quality, MLS-MPM
fragmentation, CPU SPH stacked/blob behavior, ice/solid rigidity, volume
pulsation/blinking, long-horizon settling, z-buffer/draw-order, or
focus-resume visual trust complete.

Current routing note, 2026-06-15 06:57 AKDT: the pressure/interface
Worker-retained publication path now publishes a StateManager-visible retained
gas-cell field source descriptor for local-gradient gas-cell buffers. This
keeps the gas-cell field as a lane-owned retained source instead of only a
scene/caller snapshot, while still preserving the current import/admission
gates. Next priority: have the pressure-interface gas-cell admission/import
path consume this retained source descriptor directly, then move upstream to a
dedicated resident gas-cell EOS producer stage under ComputeManager/GPUHub.
Do not mark liquid quality, MLS-MPM fragmentation, CPU SPH stacked/blob
behavior, z-buffer/focus visual trust, or long-horizon settling as complete.

Current routing note, 2026-06-15 06:44 AKDT: spatial gas-cell source
provenance now threads through the local EOS path without treating source refs
as pressure-cell refs. Positioned gas product events backed by an actual
retained product-event buffer mark the spatial gas species ledger, derived
gas-cell pressure field, and pressure feedback gas-cell field with
`retainedSpatialGasSourceBufferRefs=["resident-product-mass-buffer"]`; synthetic
or aggregate ledgers remain unretained. Next priority is unchanged: make the
spatial gas-cell ledger/field itself a retained ComputeManager/GPUHub output
with real worker/local GPU refs, then feed that lane-owned source into
StateManager admission/import. Keep liquid quality, MLS-MPM fragmentation, CPU
SPH stacked/blob behavior, z-buffer/focus visual trust, and long-horizon
settling open.

Current routing note, 2026-06-15 06:29 AKDT: the resident authority host can
now publish/admit pressure-interface gas-cell field-consumption evidence
through StateManager before the import descriptor is published. The scene no
longer needs caller-built admission when a ready gas-cell field and retained
gas-pressure refs are present; it asks the host to mint
`peercompute.ulg.pressure-interface-gas-cell-field-admission.v0`, then uses the
host-published admission to publish the import. Next priority: make the
spatial gas-cell ledger/field itself a retained ComputeManager/GPUHub output
with real worker/local GPU refs, then feed that lane-owned source into the
admission/import path. Keep liquid quality, MLS-MPM fragmentation, CPU SPH
stacked/blob behavior, and renderer z-buffer/focus visual trust open.

Current routing note, 2026-06-15 06:09 AKDT: the first spatial gas-cell EOS
producer contract is complete. Aggregate resident gas-species ledgers remain
uniform sealed-box pressure only and cannot unlock local gradients. True
spatial gas-species ledgers, including positioned product-event rows with
support volume, can now derive local per-cell ideal-gas pressure and pressure
gradients for pressureInterface oracle rows while StateManager/NodeKernel
admission still blocks distributed consumption unless retained refs and the
gas-cell import/admission contract are present. Next priority: make this
spatial gas-cell ledger/field a retained ComputeManager/GPUHub output admitted
through StateManager, then publish the existing gas-cell field import from that
authoritative retained source. Keep the z-buffer/draw-order and focus-resume
visual-trust blocker queued separately before treating captures as final
physics evidence.

Renderer blocker update, 2026-06-15 05:58 AKDT: user reports major z-buffer
issues with draw order are still present. Keep this queued as a renderer
visual-trust blocker independent from the current resident gas-cell pressure
producer slice. Before visual captures are accepted as physics evidence again,
the renderer pass must reproduce/clear transparent surface sorting,
opaque-depth writes, container/grid overlay order, nested surface identity,
and focus/context-resume flash/disappear behavior with close-spaced frame
sequences plus explicit draw/depth metadata.

Current routing note, 2026-06-15 05:47 AKDT: retained gas-cell buffer refs are
now separated from pressure force-row refs in the pressureInterface worker
publication path. `createSphPressureInterfaceStageComputeTask()` and the
resident Worker declare `resident-gas-pressure-cells-buffer` retention when a
local gas-cell field/import is present, and the publication candidate now
recognizes worker refs shaped like `result.gasPressureCellsBuffer` as gas-cell
refs without double-counting them as force-row refs. Next priority: build the
actual resident local gas-cell pressure-gradient producer from EOS/species/
material state, publish its admitted retained refs through StateManager, and
then feed that import through the scene/stage path completed in the previous
slice.

Current routing note, 2026-06-15 05:28 AKDT: the live scene/stage path now
uses the resident authority host as the publication boundary for pressure/
interface gas-cell imports. The scene may derive a candidate from resident
gas-pressure telemetry, but it only obtains a consumable import by calling
`host.publishPressureInterfaceGasCellFieldImportSource()` with a ready local
gas-cell gradient field, admitted field-consumption evidence, and retained
gas-pressure refs. Missing admission, missing refs, missing local gradients, or
missing host publisher all fail closed as telemetry. Next priority: make the
resident gas-cell pressure-gradient producer itself publish retained refs and
admission through NodeKernel/StateManager/GPUHub so the scene path has real
WebGPU-resident source data without caller fabrication.

Current routing note, 2026-06-15 05:00 AKDT: the browser resident authority
host can now publish admitted pressure/interface gas-cell field imports through
StateManager hot/warm records. This moves import construction behind
NodeKernel/StateManager authority: callers should request
`host.publishPressureInterfaceGasCellFieldImportSource()` instead of
hand-building import descriptors. Next priority: wire the live scene/stage
path to use this host-published gas-cell import when resident gas-cell fields
exist, then remove any remaining direct caller construction from the hot path.

Current routing note, 2026-06-15 04:50 AKDT: pressureInterface now has an
admitted retained gas-cell field import contract. A
`peercompute.ulg.pressure-interface-gas-cell-field-import.v0` descriptor can
inject a local gas-cell pressure field only when it is ready, carries the
admitted gas-cell field-consumption object, includes retained gas-cell refs,
and provides a local gas-cell snapshot for the CPU/WebGPU oracle path. Invalid
imports remain blocked and leave pressureInterface on uniform sealed-gas
pressure. Next priority: create the NodeKernel/StateManager/GPUHub source that
publishes these imports from resident gas-cell buffers, so callers stop
constructing the import descriptor directly.

Current routing note, 2026-06-15 04:37 AKDT: local gas-cell pressure-field
consumption is now admission-gated. PressureInterface stage evidence,
Worker compact publication candidates, and the browser authority host all
distinguish a computable local oracle gas-cell field from an admitted
distributed gas-cell field. Retained gas-cell buffer refs alone are no longer
enough: local-gradient pressure publication also requires
`peercompute.ulg.pressure-interface-gas-cell-field-admission.v0` with
`pressure-interface-gas-cell-field-consumption-approved`. Next priority:
replace caller-supplied local gas-cell fields with admitted retained gas-cell
refs loaded from StateManager/GPUHub inside the ComputeManager stage DAG.
Keep the reported z-buffer/draw-order issue queued as renderer visual
correctness, not as a blocker for this pressure admission slice.

Current routing note, 2026-06-15 04:23 AKDT: pressure/interface Worker
publication now admits local gas-cell pressure buffers only when they are
worker-retained. If a pressure stage uses local pressure gradients, the
publication candidate and authority host require retained gas-cell buffer refs,
row count, row stride, byte length, and retained-buffer status before the
pressure/interface output can be published through StateManager. Next priority:
make the pressureInterface stage consume admitted retained gas-cell refs from
StateManager/GPUHub rather than caller-supplied local fields.

Current routing note, 2026-06-15 04:13 AKDT: the local gas-cell pressure field
contract has first CPU and WebGPU support. ULG can now represent per-cell gas
pressure and pressure gradients, sample them at material-interface centroids,
and produce pressure/interface force rows from either uniform sealed-gas
pressure or local nearest-cell/gradient reconstruction. Next priority is to
make those local gas-cell fields resident and admitted: publish retained
gas-cell pressure buffers through NodeKernel/StateManager, then make the
pressureInterface stage consume admitted Worker-local gas-cell refs inside the
ComputeManager/GPUHub DAG.

Current routing note, 2026-06-15 03:52 AKDT: the pressure/interface stage now
labels its current gas pressure law as uniform single-cell sealed-gas pressure
and explicitly blocks local pressure-gradient coupling until a resident gas
cell/EOS gradient field exists. Keep the uniform interface traction law; it is
still a valid first-principles pressure force row producer. The next pressure
slice should add the resident local gas-cell pressure-gradient field contract
and then move pressure-gradient force coupling into WebGPU/Worker execution
under ComputeManager/GPUHub authority.

Current routing note, 2026-06-15 03:39 AKDT: pressure/interface Worker
publication is now WebGPU-retained-only. Candidate readiness and NodeKernel/
StateManager publication reject CPU-reference or cloneable pressure force-row
arrays for the worker-retained pressure path. Continue pressure/readback
copy-reduction toward resident gas-cell/local pressure-gradient fields and
eventual GPU-resident surface extraction; do not treat cloneable pressure
arrays as an accepted distributed hot-buffer format.

Renderer blocker update, 2026-06-15 03:46 AKDT: user reports major z-buffer
issues with draw order are still visible. Keep this as a queued renderer
visual-correctness blocker independent from the pressure/local-gas-cell physics
slice. The follow-up pass must use close-spaced visual sequences and explicit
depth/draw metadata to prove transparent sorting, opaque depth writes,
container/grid overlay policy, nested water/solid surface identity, and
focus-change/context-resume behavior before visual captures are treated as
trusted physics evidence.

Current routing note, 2026-06-15 03:25 AKDT: scene pressure-row upload
admission is complete. The browser scene can surface pressure/interface
candidate force-row telemetry, but it cannot upload or feed those rows into
resident mechanics unless the same admitted grid-force consumption descriptor
and solver approval are present. The default browser gate now expects
`resident-pressure-interface-force-rows-admission-required` plus blocked upload
status for unadmitted pressure rows, and the resident continuation state key
stays lane-stable across reset/continuation. Continue pressure/readback
copy-reduction and PeerCompute/GPUHub law-stage promotion; keep the renderer
z-buffer/focus-change follow-up queued as a separate visual correctness item.

Renderer blocker update, 2026-06-15 02:59 AKDT: user reports additional major
z-buffer/draw-order problems in the live view. Treat renderer depth/order as
still open until a follow-up pass reproduces it with close-spaced frame
captures and validates Three.js fallback plus any raw WebGPU overlay path for
nested transparent/opaque surfaces, container/grid overlays, focus-change
flash/disappear, and surface identity stability. Do not treat visual captures
as authoritative physics evidence when this reproduces; record the artifact
and either fix the renderer pass or mark the capture as visually suspect.

Current routing note, 2026-06-15 02:20 AKDT: first renderer depth-order pass is
complete. The immediate Three.js bug was per-surface hash offsets on
transparent MarchingCubes meshes: those offsets prevented Three's transparent
object sorter from ordering overlapping water/vapor/alpha surfaces by camera
depth. Transparent meshes now share their layer order, opaque meshes keep
stable hash ordering, and the diagnostic floor grid no longer writes depth.
Keep the live-device focus-change flash/disappear symptom queued as a follow-up
if it still reproduces; otherwise return to pressure/readback surface reduction
and GPU-resident law graph promotion.

Current routing note, 2026-06-15 02:05 AKDT: grid-update pressure/interface
consumption now treats retained GPU force-row buffers as first-class submitted
work instead of collapsing missing CPU rows into zero impulse evidence. The
WebGPU grid-update wrapper requires the same admitted grid-force descriptor as
the CPU path, records retained-buffer submissions as unverified no-full GPU
work, and the pressure/interface StateManager publication records stride,
byte length, buffer residency, and same-lane consumer protocol. Next priority:
finish broad validation for this slice, then continue pressure/readback
copy-reduction or take the queued z-buffer/draw-order renderer blocker if the
visual harness cannot be trusted.

Current routing note, 2026-06-15 01:51 AKDT: the pressure/interface force-row
producer now has a WebGPU-resident path. The new WGSL kernel consumes packed
material-interface elements, writes the same 16-float pressure force-row ABI
as the CPU oracle, and retains the output `forceRowsBuffer` for no-full
Worker execution. The resident Worker now passes the raw retained pressure
row buffer from `pressureInterface` to `gridUpdate` on the same lane; the
same-frame admitted descriptor remains required before grid consumption. Next
priority: reduce remaining pressure publication/consumption copies and
readback surfaces, then schedule the queued renderer z-buffer/draw-order pass.

Renderer blocker update, 2026-06-15 01:57 AKDT: user again reports major
z-buffer/draw-order issues in the live view. Keep this queued as a renderer
P0/P1 after the current pressure/residency copy-reduction slice and before any
claim that visual captures are authoritative. The pass must verify depth-test,
depth-write, transparent sorting, container/grid overlays, nested surfaces, and
the focus-change flash/disappear symptom against close-spaced frame captures.
Partially addressed by the 2026-06-15 02:20 transparent-depth-sort pass; keep
focus-change flashing/disappearing and any remaining nested-surface artifact
open until reproduced against the live device/browser path.

Current routing note, 2026-06-15 01:33 AKDT: same-frame intra-DAG
pressure/interface publication and grid-update admission are complete for the
ComputeManager/GPUHub stage-plan path. With
`approveSameFramePressureInterfaceGridForces=true`, `pressureInterface`
publishes its retained force-row descriptor before `gridUpdate` executes,
creates
`peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`, and
injects that admitted descriptor plus an approved pressure solver into the
`gridUpdate` Worker context. The next priority is moving the
pressure/interface force-row producer away from CPU-reference rows toward a
WebGPU-resident stage while keeping NodeKernel/StateManager admission and
GPUHub lane authority intact.

Current routing note, 2026-06-15 01:14 AKDT: grid-update pressure consumption
now has an explicit admission gate. Direct force solvers are blocked unless
paired with `peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0`
and `gridForceApplicationApproved=true`; successful consumption reports
admission status, source hot-buffer key, force-row count, applied impulse, and
impulse proof diagnostics. The next priority is same-frame intra-DAG pressure
publication/admission: when `pressureInterface` runs immediately before
`gridUpdate`, the stage-plan executor must publish/admit the force-row
descriptor before the `gridUpdate` task is created, rather than relying on a
prior-frame descriptor supplied by the caller.

Current routing note, 2026-06-15 00:53 AKDT: pressure/interface force-row
output now has a Worker-retained publication/admission path. The
`pressureInterface` stage builds a dedicated compact publication candidate,
the authority host exposes `publishWorkerRetainedPressureInterfaceStageOutput()`,
and admitted descriptors are stored as StateManager hot records plus warm
deltas under `ulg-worker-retained-pressure-interface-publications`. This is
still non-mutating; the admitted payload explicitly carries
`gridForceApplicationApproved=false`. The next priority is the approved
grid-update consumer slice: grid update may consume pressure/interface rows
only from an admitted descriptor and must report force-row count, impulse,
pairwise conservation residuals, and authority status.

Current routing note, 2026-06-15 00:34 AKDT: the first
pressure/interface force-row producer stage now exists under the formal
ComputeManager/GPUHub stage DAG. `pressureInterface` runs after `p2g` and
before `gridUpdate`, reads `resident-gas-pressure` plus
`sph-material-interface-field`, writes candidate
`pressure-interface-force-rows`, and remains non-authoritative with grid force
application explicitly not approved. The next priority is pressure/interface
retained-ref publication/admission through NodeKernel/StateManager, followed
by an explicitly approved grid-update consumption slice with conservation and
impulse evidence.

Current routing note, 2026-06-15 00:13 AKDT: Worker-retained
reaction/product output now has a NodeKernel/StateManager publication path.
`reactionProduct` builds a dedicated compact publication candidate, requires
Worker-ready WebGPU no-full execution plus retained product refs, calls a
reaction/product-specific publisher, stores the Worker retained-ref descriptor
as a StateManager hot record, and commits an admitted warm delta under
`ulg-worker-retained-reaction-product-publications`. This completes the
reaction/product admission slice as evidence/non-authoritative state
publication. Next priority is pressure/interface force-row promotion behind
the same ComputeManager/GPUHub Worker authority, then wiring downstream stages
to consume admitted retained-ref descriptors rather than private lane records.

Current routing note, 2026-06-15 00:01 AKDT: the first reaction/product
ComputeManager stage boundary and Worker/GPUHub DAG slot now exist. ULG
exposes `createSphReactionProductStageComputeTask()` and
`runSphReactionProductStageComputeTask()`, the resident Worker accepts
`reactionProduct`, and the injected PeerCompute integration proves
`p2g -> gridUpdate -> g2p -> thermalPhase -> reactionProduct` executes through
GPUHub resident-stage executors with all five stages `worker-ready`. The
reaction no-full wrapper now accepts retained WebGPU output without stale CPU
parity. This stage is still evidence-only and non-authoritative; next priority
is to add Worker-retained reaction/product publication/admission through
NodeKernel/StateManager, then promote pressure/interface rows behind the same
ComputeManager/GPUHub worker authority.

Current routing note, 2026-06-14 23:36 AKDT: Worker-retained thermal/phase
output now has its own publication/admission path. Mechanics publication stays
mechanics-only, while `thermalPhase` publishes retained thermo refs under
`peercompute.ulg.thermal-phase-worker-retained-hot-buffer-publication.v0` and
commits a warm StateManager delta with `outputFamilies=["sph-thermo-phase"]`.
The browser authority gate proves hot record storage, live Worker backend,
warm delta admission, and retained thermo refs. Next priority: promote
pressure/interface and reaction/product stages behind the same
ComputeManager/GPUHub Worker authority and make them consume the admitted
thermal retained-ref descriptor. Superseded by the 2026-06-15 00:01
reaction/product stage DAG note above.

Renderer blocker note, 2026-06-14 23:42 AKDT: user reports major z-buffer and
draw-order issues are still visible. Keep this queued as a renderer P0/P1
before treating visual captures as authoritative evidence. The later renderer
pass must test transparent/opaque pass ordering, depth-write/depth-test policy,
nested liquid/solid surfaces, container/grid overlay ordering, focus-change
flash/disappear behavior, and multi-frame draw-order flicker.

Renderer blocker update, 2026-06-15 01:33 AKDT: user reiterated that major
z-buffer/draw-order issues remain. Keep this queued after the current
ComputeManager/GPUHub physics authority slices and before any claim that
browser surface captures are final visual truth.

Current routing note, 2026-06-14 23:23 AKDT: `thermalPhase` now runs as an
opt-in fourth node in the formal ComputeManager/GPUHub stage-plan DAG. The
browser authority-host gate requests `includeThermalPhaseStage=true` on the
same Worker/lane retained continuation, so PeerCompute executes
`p2g -> gridUpdate -> g2p -> thermalPhase` through GPUHub resident-stage
executors instead of a direct test-only Worker call. Validation passed focused
PeerCompute integration, resident-step units, the browser authority gate,
physics atomics, and the representative visual matrix. Next priority: publish
and admit Worker-retained thermal outputs through NodeKernel/StateManager so
downstream pressure/interface and reaction/product stages consume an admitted
thermal retained-ref descriptor rather than only a Worker-local lane record.
Superseded by the 23:36 thermal publication admission note above.

Current routing note, 2026-06-14 23:01 AKDT: the focused browser authority
gate now runs `thermalPhase` on the same warm Worker/lane after the mechanics
Worker continuation. The Worker consumes its retained G2P state and retained
thermo source, builds/uploads thermal response graph buffers inside the Worker
from cloneable scene tables, runs no-full WebGPU thermal execution, waits on
the Worker queue fence, and adopts the emitted retained `thermoBuffer` into
the lane record. This proves the first real browser Worker thermal stage path.
Next priority: fold this into the formal GPUHub stage-plan DAG instead of
calling the Worker directly from the test, then publish/admit thermal retained
outputs through NodeKernel/StateManager. Superseded by the 23:23 formal DAG
note above.

Current routing note, 2026-06-14 22:50 AKDT: the resident-stage Worker module
now accepts a `thermalPhase` stage id. It can run
`runSphThermalPhaseStageComputeTask()`, receive retained state/thermo inputs,
return retained state/thermo outputs, and adopt the emitted `thermoBuffer` into
the Worker lane record. Direct Worker-payload coverage proves this stage shape
with an injected thermal runner. Superseded by the 23:01 live browser Worker
thermal stage gate above.

Current routing note, 2026-06-14 22:42 AKDT: the first thermal/phase
ComputeManager stage-task boundary now exists. ULG exposes
`createSphThermalPhaseStageComputeTask()` and
`runSphThermalPhaseStageComputeTask()` as an evidence-only, commit-suppressed
thermal/phase child task with GPU-lane/fence descriptors, retained state/
thermo outputs, and `thermalPhaseStageTaskAuthority.authoritativeStateMutation
= false`. This is not the Worker thermal law yet; it is the executable task
contract the next Worker module can run under GPUHub/ComputeManager. Next:
register a thermal/phase Worker stage runner that consumes the Worker-retained
G2P state plus retained thermo, emits retained thermal state/thermo, and feeds
that thermo source into reaction/product and mechanics refresh.

Current routing note, 2026-06-14 22:32 AKDT: the Worker mechanics lane now
seeds and reuses a Worker-retained thermo buffer for WebGPU P2G/G2P stages.
The first Worker WebGPU stage creates the thermo buffer once from the CPU
mirror, later P2G/G2P stages borrow it through `sphParticleUpload`, and the
Worker has a generic adoption hook for future thermal/reaction `thermoBuffer`
outputs. This closes the immediate repeated thermo-upload issue in the
mechanics Worker chain. It does not yet move the thermal/phase law stage into
the Worker; next priority is promoting thermal/phase and then pressure/
interface and reaction/product stages under the same ComputeManager/GPUHub
worker authority.

Current routing note, 2026-06-14 22:18 AKDT: the Worker-retained mechanics
stage output can now be consumed by a second mechanics stage-chain run on the
same warm Worker/lane. When the caller sets
`gpuHubResidentStageWorkerUseRetainedInput=true`, P2G uses the prior retained
G2P state/mechanics buffers through the Worker-local lane record instead of
requiring those hot arrays to return through main. Superseded by the 22:32
retained-thermo input slice above.

Renderer blocker note, 2026-06-14 22:18 AKDT; reiterated 2026-06-14 23:08
AKDT: user again reports major z-buffer/draw-order problems. Keep this as an
explicit renderer P0/P1 before claiming visual correctness. Audit transparent
fluid depth-write/test policy, opaque/transparent pass separation, surface
sorting for nested fluids/solids, container/grid overlay ordering, and the
flash/disappear/focus-change symptom. Add a close-spaced browser visual
regression that catches draw-order flicker and vanished volumes independently
from physics-state acceptance.

Current routing note, 2026-06-14 22:06 AKDT: the Worker-retained mechanics
stage output now has an admitted publication path. The browser authority host
exposes `publishWorkerRetainedMechanicsStageOutput()`, which stores a
StateManager hot record containing the live Worker backend plus worker-local
retained refs, and commits a serializable warm delta with
`peercompute.ulg.mechanics-worker-retained-hot-buffer-publication.v0`. The
focused browser gate passes a publisher into the stage-chain runner, keeps the
Worker backend warm when publication commits, and asserts the hot record,
warm delta, and `peercompute.ulg.mechanics-worker-retained-buffer-import.v0`
descriptor exist. This still does not transfer Worker `GPUBuffer` handles to
main; future consumers must address the Worker through the retained-ref
descriptor or implement a worker-side continuation stage.

Current routing note, 2026-06-14 21:50 AKDT: the Worker WebGPU mechanics
stage-chain gate now runs `no-full-readback` instead of full parity readback.
The Worker explicitly waits on its own `queue.onSubmittedWorkDone()` for each
no-full WebGPU stage message, so P2G, grid-update, and G2P report satisfied
stage fences while keeping stage buffers worker-local. ULG now surfaces
`peercompute.ulg.mls-mpm-mechanics-worker-compact-publication-candidate.v0`
on the stage-chain summary: it records worker-retained refs, no-full readback
mode, WebGPU backends, worker-ready residency, and the deliberate publication
blocker `blocked-authorized-worker-publication-required`. Superseded by the
22:06 admitted worker-retained publication path above.

Current routing note, 2026-06-14 21:36 AKDT: the focused browser authority
gate now proves real browser Worker WebGPU mechanics stage execution. The
test creates `host.createUlgMechanicsResidentStageWorkerRunner()`, requests
`preferWebGpu=true`, runs P2G, grid-update, and G2P through the checked-in
Worker module, and asserts all three worker stage backends report `webgpu`
with `worker-ready` residency. This closes the first in-worker WebGPU
acceptance gate, but not the final copy-free path. Superseded by the 21:50
no-full Worker gate above.

Renderer blocker note, 2026-06-14 21:36 AKDT: user reports major z-buffer and
draw-order failures in the live visualization. Keep this queued as renderer
correctness debt before claiming visual correctness: audit depth write/test
policy, transparent fluid sorting, opaque/transparent pass separation,
container/grid overlay ordering, nested fluid/solid surfaces, and the
reported flash/disappear behavior where volumes briefly render and then vanish
until a browser/app focus change. Add a visual/browser regression that samples
multi-frame render state and catches depth-order flicker, not just physics
state.

Current routing note, 2026-06-14 21:24 AKDT: ULG now has a checked-in
mechanics resident-stage Worker module and the browser authority-host gate
creates a PeerCompute `createResidentStageWorkerBackend()` runner for it. The
focused browser test runs P2G, grid-update, and G2P through the real browser
Worker bridge and reports `worker-ready` for all three stages. This first
module keeps raw stage outputs in a worker-local lane store and returns
clone-safe summaries/values to the main thread; it is still CPU/reference
worker execution unless WebGPU is explicitly validated in the worker. Next
priority: promote the worker path to worker-owned WebGPU device/buffer
retention so the hot mechanics lane no longer round-trips through main-thread
arrays.

Follow-up note, 2026-06-14 21:29 AKDT: the Worker now caches a Worker-local
WebGPU device result when `preferWebGpu=true`, but the acceptance gate still
needs to prove in-worker WebGPU execution and retained GPU buffers between
stages.

Current routing note, 2026-06-14 21:01 AKDT: ULG mechanics stage-chain
registration can now consume a supplied GPUHub resident-stage worker runner.
When a backend is supplied, P2G, grid-update, and G2P report `worker-ready`,
the stage plan still resolves through `gpu-hub-resident-stage-executor`, and
returned worker values populate the normal stage-result evidence. The default
live path remains truthful `blocked-worker-backend-missing` because ULG still
needs the actual browser worker module that owns its WebGPU device and
retained lane buffers. Next priority: implement that worker-owned backend for
the same stage chain without copying main-thread `GPUBuffer` handles.

Current routing note, 2026-06-14 20:41 AKDT: ULG mechanics stage-chain
registration now requests dedicated worker residency for P2G, grid-update, and
G2P GPUHub stage executors, but the evidence correctly reports
`blocked-worker-backend-missing` until a worker-owned WebGPU device/buffer
backend exists. This makes the next acceptance target explicit without
pretending main-thread `GPUBuffer` handles moved to a child worker. Next
priority: add the real supervised worker-owned backend under
ComputeManager/GPUHub for this same stage chain, then repeat the pattern for
pressure/interface, thermal/phase, and reaction/product stages.

Current routing note, 2026-06-14 20:23 AKDT: ULG mechanics stage-chain
execution now registers P2G, grid-update, and G2P handlers on the
ComputeManager-attached GPUHub and lets `GpuResidentLaneManager` resolve the
stage plan through `gpu-hub-resident-stage-executor` instead of direct ULG
callbacks. Focused Node and browser gates prove all three mechanics stages
use GPUHub executor sources while retaining WebGPU backends, GPU-lane
residency, same parent lane/state key, completed stage-plan execution, and
satisfied fences. Next priority remains supervised GPUHub/ComputeManager
worker residency for this same stage chain, followed by pressure/interface,
thermal/phase, and reaction/product stage promotion.

Deferred renderer blocker noted 2026-06-14 20:24 AKDT: user reports major
z-buffer/draw-order issues in the live visualization. Do not let this distract
from the current GPUHub stage-executor architecture clean point, but keep it
queued as a renderer P0/P1 before claiming visual correctness. The fix should
audit transparent/opaque surface ordering, depth-write/depth-test policy,
nested fluid/solid surfaces, container/grid overlay ordering, and add browser
coverage that catches wrong draw order rather than relying on static
screenshots. Superseded by the 21:36 renderer blocker note above.

Current routing note, 2026-06-14 19:59 AKDT: browser authority-host
validation now proves the same-lane mechanics stage chain can run P2G,
grid-update, and G2P as actual `webgpu` child stage tasks under one parent
ComputeManager lane id/state key. The focused Playwright gate uses
`preferWebGpu=true`, `useNativeTaskGraph=false`, and a shared scene
`deviceResult`, and it asserts WebGPU backends, GPU-lane residencies,
same-lane task summaries, completed stage-plan execution, and satisfied
fences. Next priority is supervised GPUHub/ComputeManager worker residency for
that same stage chain; after that, promote pressure/interface, thermal/phase,
and reaction/product stages behind the same pattern.

Current routing note, 2026-06-14 19:48 AKDT: WebGPU-requested mechanics
stage tasks now inherit the parent lane executor identity instead of creating
three unrelated stage-specific GPU lane descriptors. The non-native lane
executor path stamps P2G, grid-update, and G2P child tasks with the same lane
id/state key, keeps them inline for WebGPU object safety, and records
per-stage lane/backend/residency/fence summaries. This completes the
same-lane authority invariant for the WebGPU-requested path in Node/fallback
validation.

Current routing note, 2026-06-14 19:36 AKDT: the mechanics stage-plan executor
now drives actual ComputeManager stage-task submissions in the non-native
graph path. With `useNativeTaskGraph=false`, the lane executor submits P2G,
grid-update, and G2P stage tasks, records completed stage count/order and
fence evidence, and the mechanics-only step consumes the lane-produced stage
results without duplicate execution. This remains non-authoritative and CPU/
inline in the focused test.

Current routing note, 2026-06-14 19:28 AKDT: the first ULG mechanics consumer
of the PeerCompute lane stage-plan boundary is in place. The existing
mechanics stage-chain helper now wraps real P2G/grid-update/G2P stage graph
outputs in `peercompute.ulg.mls-mpm-mechanics-stage-lane-contract.v0`,
executes the contract through `ComputeManager.executeGpuResidentLaneStagePlan()`,
and records completed stage count/order plus lane fence evidence. This is
still CPU-oracle/native-stage output and remains non-authoritative.

Current routing note, 2026-06-14 19:13 AKDT: the resident sequence contract is
now consumed by sibling PeerCompute's `GpuResidentLaneManager`. The manager
derives `peercompute.compute.gpu-resident-lane-stage-plan.v0`, exposes a
generic `executeStagePlan()` lease-bound stage executor, preserves retained
refs, and returns the stage plan in `ComputeManager` execution envelopes.
This is still not default physics behavior; it is the authority boundary for
moving individual P2G/grid/G2P/thermal/reaction law stages behind
ComputeManager/GPUHub lanes.

Current routing note, 2026-06-14 18:58 AKDT: resident steps tasks now publish
`peercompute.ulg.mls-mpm-resident-sequence-lane-contract.v0` across the task,
solver-registry input, result, and commit-delta surfaces. This is the first
ComputeManager/GPUHub lane contract for the active-grid fused sequence: it
declares the lane-owned P2G -> grid update -> G2P -> compact-summary DAG,
single-owner rules, retained buffers, queue-fence policy, and active-grid
constraints. `defaultEnabled=false` remains mandatory. Next work is still to
move execution behind a real lane-owned worker/stage boundary and then extend
validation to pressure, thermal, reaction/product, and long-horizon liquid
gates.

Current routing note, 2026-06-14 18:50 AKDT: mounted scene opt-in wiring for
the active-grid fused resident mechanics sequence has landed. Browser URLs can
set `residentActiveGrid=1` and `residentFuseSequence=1`; the scene signature,
status overlay, explicit scene probe refresh path, and ComputeManager resident
task options all carry the same policy. The validation artifact
`/tmp/ulg-history-probes/current-scene-active-grid-optin-frames-20260614.json`
is `good` with active dispatch `2744/13824` and two persisted frames. Keep
active-grid default-off. The next priority remains promoting this into a
ComputeManager/GPUHub lane contract and then expanding validation beyond
mechanics-only sparse probes to pressure, thermal, reaction/product, and real
liquid settling gates.

Current routing note, 2026-06-14 08:43 AKDT: yes, architecture authority is now
the active implementation priority because the CPU/reference path, fast
physics atomics, and short visual sanity matrix are strong enough to serve as
guards. Treat CPU/reference as the correctness oracle. Move accepted mutation
behind PeerCompute/NodeKernel/ComputeManager/StateManager authority first, then
continue GPU-resident physics migration under that authority. Do not remove the
physics gates; run atomics and visual sanity after each architecture slice.
Sibling PeerCompute `submitTaskGraph()` now has graph-level cache, placement,
cancellation, stats, active-graph, and optional graph-wide GPU lane lease
evidence, and ULG records those fields in the mechanics stage-chain artifact.
It now also derives graph cache keys from declared state refs, closure refs,
law ids, invalidation refs, units, stable values, and per-node cache inputs.
Graph cache writes now produce explicit cache artifacts with admission and
invalidation metadata. ULG mechanics artifacts are still
`recorded-not-admitted`; this is intentional and prevents replaying physics
outputs before StateManager/NodeKernel admission. The next authority slice has
landed in sibling PeerCompute: `StateManager` owns a CRDT admission and
invalidation ledger for task-graph cache artifacts, `NodeKernel` exposes the
authority facade, and `ComputeManager` only flips local read-through cache
artifacts to admitted when that authority record exists. ULG now proves its
mechanics native stage DAG artifact can be admitted and invalidated through a
NodeKernel-owned StateManager. Next priority is distributed graph
placement/execution semantics using admitted hashes and retained GPU lane refs.
The next NodeKernel routing slice has also landed: mechanics stage-chain task
graphs now use `NodeKernel.submitTaskGraph()` when a real kernel is present,
and the browser authority path reports `node-kernel-submit-task-graph` plus
`nodeKernelOwned=true`. Direct ComputeManager graph submission remains the
fallback for non-kernel tests and standalone helpers. Next priority remains
true distributed graph placement/execution across peers under the same
StateManager/NodeKernel authority. NodeKernel now also fails closed for
non-advisory distributed graph placement until that executor exists; local and
advisory graph requests carry explicit placement-preflight status instead of
silently pretending to be distributed. The first sibling PeerCompute remote
task-graph executor now exists for explicit target peers: non-advisory graphs
with `targetPeerIds` send `compute-task-graph`, execute on the responder's
`ComputeManager.submitTaskGraph()`, and return remote graph provenance without
falling back to requester-local graph execution. This is still a first-hop
transport slice; next priority is admitted artifact hashes, retained GPU lane
refs, distributed cache/result sharing, and StateManager admission through
that request/result path before resident ULG physics moves remote by default.
Remote graph results now also carry a cache-artifact admission preflight:
artifacts are `remote-cache-artifact-received-not-admitted` by default, and
explicit admission routes them through NodeKernel/StateManager authority.
Admitted remote graph results now import as local read-through cache entries,
but remote GPU retained-buffer refs are metadata-only and `usableLocally=false`;
the retained-lane/state-family policy report now exists in sibling
PeerCompute. Imported remote results must pass an explicit allowed-family
policy before seeding local warm state, and remote retained-buffer refs report
`local-refresh-required` instead of becoming local WebGPU leases. The next
authority slice has also landed: `NodeKernel.commitRemoteTaskGraphStateSeed()`
can commit an allowed imported remote result with a compact state seed payload
into StateManager warm state. The next slice must implement actual local
hot-buffer refresh execution from those warm seed records, including local
GPU-resident lane acquisition, instead of stopping at metadata. That first
refresh executor surface now also exists in sibling PeerCompute:
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromSeed()` reads the warm seed,
acquires a local GPU resident lane lease, invokes a local refresh executor,
completes a local fence, and commits a refresh delta. The next ULG slice has
now landed: ULG exposes a SPH/MLS-MPM refresh executor that rebuilds real local
SPH state, SPH thermo, and MLS-MPM mechanics WebGPU buffers from an admitted
remote seed payload, stores the non-serializable uploads only in local
StateManager hot storage, and returns local retained-buffer refs to NodeKernel.
The browser authority host now also exposes `refreshRemoteSeedHotBuffers()`,
which commits an admitted remote seed if needed and runs the local ULG refresh
executor through NodeKernel. It now also exposes
`submitTaskGraphWithRemoteSeedHotBufferRefresh()`: an opt-in live remote graph
submit wrapper that submits through NodeKernel, admits/imports the remote cache
artifact when policy allows it, auto-refreshes local SPH/MLS-MPM hot buffers
for allowed state families, and blocks disallowed families such as
`reaction-products` without creating GPU uploads. The mounted resident
scheduler now has a default-off remote-refresh prelude that calls this wrapper
only when `enableRemoteResidentTaskGraphRefresh` is set and a caller supplies a
remote task graph or graph factory. The next priority is building the actual
mounted resident law DAG as a remote graph and placing those law stages on
PeerCompute WebGPU workers under ComputeManager/GPUHub authority, still
guarded by atomics and visual matrix checks.
The first graph-builder slice has now landed: PeerCompute preserves explicit
graph-level `stateSeedPayload` in task-graph results/cache artifacts, and ULG
can build a SPH/MLS-MPM remote seed graph that a real responder
`ComputeManager` executes before NodeKernel admission/import and local
hot-buffer refresh. That graph now has an optional evidence-only resident
compute stage after the seed node, so a responder can execute
`ulg-sph-mls-mpm-resident-steps` with commit deltas suppressed and return
task-result evidence before requester-local hot-buffer refresh. It now also
has a post-stage seed node that derives a full-readback transitional state seed
from the resident result and lets the requester refresh local hot buffers from
that advanced seed after NodeKernel/StateManager admission. Remaining work is
to replace that transitional full-readback seed with actual P2G/grid/G2P/
thermal/reaction/pressure/render WebGPU worker-stage output under
ComputeManager/GPUHub lane authority.
The first compact worker-stage boundary is now in the remote graph as
evidence-only mechanics P2G -> grid update -> G2P nodes before the resident
stage. Grid update and G2P consume upstream node results through PeerCompute
`resultInputs`, the resident stage depends on G2P when enabled, and all of it
stays non-mutating until the admitted compact seed/retained-lane handoff is
implemented.
The next seed-candidate slice has also landed: the graph can insert
`mechanics-stage-state-seed` after G2P. That node derives a full-readback
candidate seed from mechanics stage output, preserves original thermo/phase
rows, and is only selected for refresh when `preferMechanicsStageSeed` is
explicitly set. It remains non-authoritative by default.
The compact boundary for that node has now started: no-full/retained mechanics
G2P output returns a non-refreshable compact candidate with output-buffer byte
evidence, state families, retained refs, GPU-fence status, and explicit
`admissionRequired`/`localRefreshRequired` flags. It does not emit a
`stateSeedPayload`, so local hot-buffer refresh still cannot consume compact
remote output until the admitted retained-lane refresh executor exists.
That compact candidate is now also recorded through
`NodeKernel.commitRemoteTaskGraphCompactCandidate()` when an explicit
mechanics-stage refresh request selects it. The wrapper still blocks
hot-buffer refresh and returns no local buffer refs, which is the desired
authority boundary until a local retained-lane refresh executor can rebuild
admitted compact output into same-device hot buffers.
The next fail-closed refresh surface has now landed as well:
`NodeKernel.refreshRemoteTaskGraphHotBuffersFromCompactCandidate()` reads the
admitted compact-candidate record and refuses to complete without an explicit
local compact refresh executor. ULG exposes
`refreshRemoteCompactCandidateHotBuffers()` plus an opt-in
`attemptCompactCandidateRefresh` path; absent that executor, the reported
refresh remains not completed and still returns no local refs. Blocked/failed
executor results or executor results with no local refs now reject the local
lane instead of completing it. ULG also has a default compact executor contract
that reports `blocked-compact-candidate-local-source-required` unless an
explicit local source seed is attached. The next real implementation item is a
source/materialization path that gives this executor valid local compact data.
No-full mechanics compact candidates now carry a typed
`peercompute.ulg.remote-task-graph-compact-local-refresh-contract.v0` listing
the required state families, required local source roles, remote retained refs,
and accepted materialization modes. Use that contract as the target for the
next source-transfer/import slices.
The first source materialization mode has now landed:
`peercompute.ulg.remote-task-graph-compact-buffer-snapshot.v0` carries compact
SPH state, SPH thermo, and MLS-MPM mechanics rows that ULG validates and
uploads into local hot buffers under StateManager hot storage. This is useful
for admission and correctness, but it is still a copy-bearing snapshot mode;
the next mode reduces that copy cost. ULG now also accepts
`peercompute.ulg.remote-task-graph-same-device-retained-buffer-import.v0`,
which aliases an explicit same-device local hot-buffer record without new GPU
uploads or writes. Mechanics G2P stage results can now propagate those
descriptors into compact candidates when a producer supplies one. The remaining
copy-avoidance work is to have real live ComputeManager/GPUHub worker outputs
create the local hot-buffer source record and descriptor automatically, while
remote retained refs stay metadata-only across devices.
Same-device source publication follow-up, 2026-06-14 16:07 AKDT: the resident
authority host now exposes `host.publishSameDeviceHotBufferSource()`, which
stores same-device SPH/MLS-MPM upload handles in StateManager hot storage and
returns a serializable same-device retained-buffer import descriptor. The
integration test now feeds compact same-device candidates from that published
source record rather than a hand-written descriptor. At that point, remaining
work narrowed to automatic use from live ComputeManager/GPUHub outputs when
they already own the handles.
Live same-device source auto-publication, 2026-06-14 16:24 AKDT: the mounted
resident ComputeManager path now calls that publication surface automatically
after StateManager admission when it already owns real same-device SPH state,
SPH thermo, and MLS-MPM mechanics upload handles. The execution carries the
same-device retained-buffer import descriptor and StateManager hot storage
retains the handles. The descriptor is also bridged onto the final G2P
reconstruction metadata so compact candidate builders can discover the live
producer source. The remaining copy-avoidance work is now downstream: admitted
compact worker-stage outputs must consume/propagate that descriptor instead of
falling back to snapshots or full readback, while cross-device remote retained
refs remain metadata-only.
The CPU-SPH solid H2O bug report is now pinned and guarded: cold H2O solid
particles no longer flow through the liquid PBF path, `npm run
test:physics-atomics` includes a solid H2O invariant, and the recurring visual
matrix includes `solid-h2o-cpu-sph` with an expected two-surface solid H2O
render. This does not close liquid H2O settling/free-surface work.
Live-scene solid H2O follow-up, 2026-06-14 16:20 AKDT: the CPU-SPH report was
the missing solid-solid support/contact slice. The solid stayed internally
rigid but sank into the solid base. `sphPhaseCarrier` now resolves solid group
support contact and the visual matrix's `solid-h2o-cpu-sph` scenario now has a
static/support guard. Keep liquid H2O settling/free-surface work open; do not
misclassify this completed solid-support fix as liquid realism.
Law-isolation visual harness follow-up, 2026-06-14 15:57 AKDT: the recurring
visual matrix now includes explicit browser-mounted law-toggle labels for
mechanics-off static, gravity-off static, pressure-off H2O, EOS-off H2O,
thermal-off hot H2O, and reactions-off Na/H2O. The selected run
`codex-law-isolation-matrix-20260614` passed with `failedCount=0` and three
captured frames for all six. Keep these labels in the post-slice visual sanity
rotation; they are diagnostic guards, not permission to remove or demote laws.
Keep Na/H2O reaction-product visual timeouts as a P0 blocker: the five
representative non-Na visual sequence scenarios pass with frames, but Na/H2O
still hard-times out before writing a full result.

0. **P0 PeerCompute authority spine**
   - `peercompute-law-graph-authority-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `resident-state-authority-contract-plan.md`
   - Goal: make NodeKernel/ComputeManager/StateManager/GPUHub the default
     authority for law execution and accepted state mutation. ULG scene code
     should be a visualization/reference host, not a competing scheduler.
   - Current checkpoint, 2026-06-14 03:44 AKDT: the browser route now
     initializes a real sibling PeerCompute `NodeKernel` in local/no-start
     mode. Its real `ComputeManager`, `StateManager`, and `GPUHub` own the
     default mounted resident authority path, and the NodeKernel-shaped facade
     is now only a fallback. An explicit `startNodeKernelNetwork()` /
     `stopNodeKernelNetwork()` gate now proves browser libp2p can start and
     stop locally without destroying StateManager. The resident SPH/MLS-MPM
     pass DAG is now registered as ComputeManager solver
     `ulg-mls-mpm-sph-resident-steps`, and mounted resident scheduling now
     uses solver-created task envelopes when the real solver registry is
     present while preserving ULG GPU fence, GPU-resident lane, law-graph, and
     StateManager commit evidence. Remote placement is now an explicit gate
     that configures NodeKernel placement executors, ComputeManager placement
     hooks, ULG admission, and PeerCompute quorum validation without
     auto-starting networking or sending resident physics remote by default.
     A deterministic in-memory redundant NodeKernel smoke now proves
     non-advisory remote resident execution, quorum validation, no
     responder-side commit, and requester StateManager admission. That smoke
     now also proves in-memory replicated StateManager convergence by applying
     the requester's encoded Yjs update to a second real StateManager and
     validating the same warm resident delta there. A provider-transport gate
     now proves fresh resident warm deltas move through real
     PeerComputeProvider `yjs-update` broadcasts into a replica StateManager.
     The missing initial state-vector/full-document sync handshake exposed by
     that gate is now implemented in PeerComputeProvider and verified from ULG
     with a late-joining replica that receives a preexisting resident warm
     delta. The live browser/libp2p provider gate now also passes through a
     Playwright-started WSS relay and two real browser NodeKernel authority
     hosts. That gate exposed a provider-sync lifecycle race, now fixed by
     explicit `StateManager.requestProviderSync()` plus post-connect
     NodeKernel sync retries. The next architecture slice is now landed:
     `ComputeManager` registers metadata-only law-family descriptors for
     mechanics, thermal/phase, reaction/product/gas, and pressure/interface,
     including sedenion periodic-table chemistry scoping on the
     reaction/product/gas node. The existing resident pass DAG remains the
     only executable solver; child law-family descriptors are visible to the
     law graph but blocked from direct task creation until they pass
     CPU-reference, conserved-field, GPU fence/lease, StateManager-admission,
     and visual-sequence gates. The host now also derives a concrete law graph
     manifest from the registered descriptors with five nodes, seven
     parent/dependency edges, executable/metadata-only node lists, state-family
     surfaces, and the `metadata-only-until-gated` promotion policy. That
     manifest now includes current/prospective state-family owner maps. The
     pass DAG is the single current owner for admitted particle, mechanics,
     thermo/phase, reaction/product, gas-pressure, and pressure/interface
     families; mechanics is only the first prospective promotion candidate.
     The resident ComputeManager now exposes a ULG promotion admission gate
     that rejects missing evidence, enforces promotion order, and admits the
     mechanics families only when all required evidence is present. That
     admission report now runs as a non-mutating ComputeManager task with
     `suppressCommitDelta: true` while keeping child law descriptors
     metadata-only. The next architecture slice has also landed: a
     non-mutating mechanics promotion evidence task validates structured
     CPU/reference, conserved-field, volume-stability, pressure-disabled,
     owner-map, GPU fence, StateManager admission, committed-delta, and
     visual-sequence evidence, then feeds the admission task. The
     physics/reference fields are now generated by measured CPU resident
     zero-force and gravity-only probes through
     `createUlgMechanicsPromotionReferenceEvidence()`, while browser authority
     tests add live host GPU-fence, StateManager, committed-delta, and
     owner-map context from the actual resident step. The child dry-run gate
     now exists as `ulg-mechanics-child-dry-run`: it runs under
     ComputeManager with `suppressCommitDelta: true`, compares the child
     candidate against measured reference evidence, and contributes
     `mechanics-child-dry-run-parity` before promotion admission. The next
     checkpoint now proves the child candidate is mechanics-only by contract:
     only P2G, grid update, and G2P can run; thermal, reaction, and
     mechanics-refresh stages must be skipped; writes are limited to
     `particle-kinematics` and `mechanics`. The child candidate now routes
     through explicit entrypoint
     `runMlsMpmMechanicsOnlyResidentStepsWithOptionalWebGpu()`, which records
     `mechanics-only-entrypoint-enforced` and forcibly disables non-mechanics
     law stages. That entrypoint now calls the direct split step
     `runMlsMpmMechanicsOnlyResidentStepWithOptionalWebGpu()` for each substep
     instead of delegating to the generic resident pass DAG step. The direct
     mechanics path now has a ComputeManager-owned non-mutating WebGPU/CPU
     child task envelope,
     `ulg-mls-mpm-mechanics-only-resident-steps`, exposed through the browser
     resident authority host as `submitMechanicsOnlyResidentStepsTask()`. CPU
     oracle runs remain valid without a GPU fence, while WebGPU runs require
     same-device lane/fence evidence. This child task envelope is now required
     by mechanics promotion admission as
     `mechanics-only-child-task-envelope`; the dry-run task validates it and the
     promotion evidence task records it before admission. The child task now
     also emits `mechanics-child-stage-kernel-evidence`, and promotion requires
     it so P2G, grid update, and G2P can be replaced/promoted one at a time
     with explicit stage evidence. The first per-stage gate is now split out:
     `mechanics-child-p2g-stage-evidence` is emitted top-level and under
     `perStageEvidence.p2g`, required by promotion admission, and kept
     `stage-evidence-only-not-authoritative` until the CPU oracle, child task
     envelope, dry-run parity, StateManager admission, GPU fence/lease
     evidence, and visual sanity gates agree. Grid update now has the same
     explicit gate as `mechanics-child-grid-update-stage-evidence`, emitted
     top-level and under `perStageEvidence.gridUpdate`, required by promotion
     admission, and kept evidence-only while it proves transient grid
     read/write scope. G2P now completes the explicit mechanics sub-stage
     gates as `mechanics-child-g2p-stage-evidence`, emitted top-level and
     under `perStageEvidence.g2p`, required by promotion admission, and kept
     evidence-only while it proves transient grid reads plus particle/mechanics
     writes. The first real stage-task boundary is now landed for P2G:
     `ulg-mls-mpm-mechanics-p2g-stage` runs through ComputeManager, wraps the
     existing P2G kernel entrypoint, suppresses pressure/product inputs, writes
     only transient `mls-mpm-grid`, suppresses commit deltas, and emits
     `mechanics-p2g-stage-task-evidence`. Grid update is now landed as
     `ulg-mls-mpm-mechanics-grid-update-stage`, consuming transient P2G grid
     state, suppressing pressure-interface rows, writing only transient updated
     grid state, and emitting `mechanics-grid-update-stage-task-evidence`.
     G2P now completes the stage-task boundary set as
     `ulg-mls-mpm-mechanics-g2p-stage`, consuming transient updated grid
     state, suppressing internal pressure impulses, returning candidate
     particle state plus MLS-MPM mechanics output, and emitting
     `mechanics-g2p-stage-task-evidence`. The first replacement seam is now in
     the mechanics-only split step: optional whole-stage runners can swap a raw
     stage call for a ComputeManager-owned stage task while preserving the
     default path, and the focused gate now proves P2G-only,
     P2G+grid-update, and full P2G+grid-update+G2P replacement this way. The
     next slice has started that lift with
     `runMlsMpmMechanicsOnlyResidentStepWithComputeManagerStageTasks()`, a ULG
     helper exposed by the browser resident authority host that submits all
     three mechanics stages through the active ComputeManager and records a
     stage-chain artifact while remaining non-authoritative. Sibling
     PeerCompute now has the first native scheduler primitive,
     `ComputeManager.submitTaskGraph()`, and ULG proves it with the mechanics
     P2G -> grid-update -> G2P stage DAG. The ULG helper now consumes that
     native graph path for CPU-oracle/no-upload stage chains, and the browser
     authority gate executes it. Graph-level lease/cancellation/cache/
     placement evidence now exists on the native graph and is recorded by the
     ULG mechanics stage-chain artifact. Graph cache keys are now
     content-addressed from declared state/closure/law/invalidation inputs and
     per-stage cache input summaries. Cache writes now produce explicit
     artifacts with admission metadata, but ULG mechanics stage artifacts are
     intentionally `recorded-not-admitted`. The next slice has now routed
     those artifacts through StateManager/NodeKernel admission and invalidation:
     StateManager owns the admitted/invalidated artifact ledger, NodeKernel is
     the authority facade, and ComputeManager only consumes local cache entries
     after that admission. Mechanics stage-chain task graphs now also route
     through `NodeKernel.submitTaskGraph()` when a real kernel is available,
     while preserving direct ComputeManager fallback for non-kernel contexts.
     NodeKernel placement preflight now blocks non-advisory peer/cluster graph
     requests without an executor, while recording local/advisory status for
     allowed graph submissions. The first remote task-graph transport now
     exists for explicit target peers, executing through the responder's
     `ComputeManager.submitTaskGraph()` with remote graph provenance and no
     requester-local fallback. Remote graph cache artifacts now carry explicit
     admission preflight and only become admitted when routed through
     NodeKernel/StateManager authority. Admitted remote graph results now
     import as local read-through cache entries while remote retained GPU refs
     remain metadata-only. The next architecture priority is defining when
     those imported remote results may seed warm state or cause local hot
     buffer refresh before any mechanics child law owns writes outside the
     parent pass DAG. Then continue one law family
     at a time,
     deepen GPU resident lanes/warm service residency, and keep long-horizon
     liquid-quality work guarded by the CPU oracle.
     CPU/reference atomics, scoped browser authority checks, and
     representative visual sanity remain mandatory after every slice.

1. **P0 physics behavior regression**
   - `physics-behavior-regression-plan.md`
   - Goal: restore coherent visible/local physics behavior before treating more
     WebGPU migration as success. Reset/playback, pressure/interface force
     application, reaction/product/gas carry-forward, thermal/phase continuity,
     stale mirror guards, and diagnostics must be behaviorally coherent.
   - Latest checkpoint, 2026-06-13 22:47 AKDT: the no-full retained render
     diagnostic can now stop at resident surface-vertex buffers under HTTPS
     without hanging on compact draw metadata/readback. Keep the compact
     metadata/readback lane as a P0 GPU-resident render blocker; do not count
     this as liquid behavior fixed. After that render-diagnostic checkpoint,
     return to the liquid-quality work: long-horizon merge/settle,
     free-surface stability, pulsing/blinking solids, and representative visual
     sequences.
   - Current first code slice: reproduce and pin the screenshot-backed H2O/H2O
     same-material settling failure, including detached floating blobs and
     delayed render-cadence jumps. The post-thermal SPH state handoff,
     GPU-resident mechanics-refresh stage, pressure force-application gate, and
     WebGPU G2P grid-origin handoff are now in place. The resident page cadence
     now honors `substeps=16 target=16`, and the hot loop no longer blocks on
     every no-full-readback mutation stage. Batch motion diagnostics now force
     visual refresh when accumulated resident motion crosses the visible
     threshold even if the final substep displacement is small. The first
     visible render-bounds bug is also fixed: padded-field blob radii now
     preserve physical meters, generated MarchingCubes geometry is clipped to
     the sealed container, and the probe flags out-of-box visible surfaces.
     Short-horizon resident gravity motion is coherent again, so the remaining
     P0 focus is actual same-material liquid settling/contact stability,
     corrected-cadence resident throughput, resident GPU surface draw without
     readback, draw-range-aware vertex budgeting, and close-spaced visual
     evidence over longer horizons. The raw WebGPU surface overlay is now an
     explicit opt-in (`surfaceOverlay=1`) with policy/status telemetry, but it
     currently blocks headless Chromium/SwiftShader and must remain behind the
     default Three/MarchingCubes fallback until it passes visual probes. The
     latest pressure/gas regression search confirms `c81a66a` reproduces the
     separated H2O/H2O scene failure with unapproved pressure rows, oversized
     visible bounds, and a `20.7 m/s` velocity spike after `1 x 16` steps; the
     current dirty tree passes the same short scene probe with pressure rows
     blocked, J near one, visible bounds inside the container, and compact
     COM/AABB telemetry. The live derived-material e2e and post-COM/AABB visual
     sequence pass, with artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-separated-current-com-bounds/`.
     The next visible-surface slice lowered the default isosurface scale to
     `0.4`, added a particle-AABB-relative surface bounds guard, and passed the
     contact-near H2O/H2O scene probe plus visual sequence with artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-contact-near-default-blob-0p4/`.
     The active failing guard is now sharper: direct full-readback contact-near
     H2O/H2O reports `same-material-contact-gap-not-closing`. The earlier
     sparse scene `solid:ice` visible-surface split is fixed in the current
     tree by carrying wall temperatures into resident signatures, preserving
     same-material base/drop render domains, and giving sparse render domains a
     scoped default-radius floor without inflating dense base water.
     Latest regression slice: the pressure/gas boundary commit is still
     `c81a66a`, but the fix set inside the dirty tree is now clearer. Gas EOS
     remains nonnegative; condensed Tait pressure is signed again, hidden
     condensed-liquid affine damping has been removed, and finite-volume
     particles now clamp at wall clearance instead of point centers. Direct
     high-drop H2O/H2O is numerically coherent over `256` substeps
     (`drop COM 2.75 -> 2.669350 m`, final drop velocity `-1.25525 m/s`,
     pressure impulse `0`, J near one). The long-horizon visual harness can
     force validation render-field readback, timeout render refreshes, and
     measure drawn MarchingCubes surfaces by `drawRange` instead of the fixed
     `72000` vertex capacity. Corrected visual artifacts now show real
     short-horizon motion for separated and contact-near H2O/H2O, but that is
     not long-horizon liquid settling proof.
     2026-06-13 update: pressure-off did not fix the high-drop H2O/H2O visible
     failure; the proximate bugs were missing thermal wall inputs defaulting the
     resident path toward frozen H2O, same-material render-field/domain
     coalescence, a render-row extraction scope error, and an overly sparse
     3x3x3 drop render kernel. Focused tests pass, the separated high-drop scene
     passes `1 x 16` and `4 x 64` resident scene probes with two visible liquid
     H2O domains and no particle-bound inflation, and law-group checkboxes now
     let mechanics, gravity, pressure, thermal/walls, and reactions be isolated
     from the overlay/URL. A static `gravity=off pressure=off` probe passes with
     zero displacement under `ULG_PROBE_EXPECT_STATIC=1`.
     This is a bounded short-horizon fix, not long-horizon liquid-settling
     proof.
     2026-06-13 08:51 update: the remaining broken liquid behavior is now
     isolated below pressure/gas/thermal/reaction. Direct full-readback
     contact-near H2O/H2O remains `bad` when only mechanics and gravity are
     enabled: the gap changes only about `0.03333 -> 0.02995 m`, the base
     compresses to `J ~= 0.876`, the drop/base cohorts still fail to merge or
     settle like water, and pressure impulse is zero. Hydrostatic base
     initialization and an EOS-off run did not fix the issue. Treat the active
     root-cause target as MLS-MPM mechanics transfer, wall/contact handling,
     volume preservation, and missing liquid constraint laws, not renderer,
     pressure rows, gas, thermal, or reactions. Add a plain SPH/PBF reference
     mode as a P0 diagnostic/fallback lane so ULG can compare MLS-MPM behavior
     against a simpler liquid integrator while preserving the law graph.
     2026-06-13 09:03 update: `mech=mlsmpm|sph` now exists as a UI/probe
     selector. The `sph` path is explicitly labeled
     `plain-sph-cpu-reference`, bypasses resident WebGPU MLS-MPM, and is
     diagnostic only. A short H2O/H2O contact smoke confirms the branch runs,
     but it also reaches high velocities and barely closes the gap over the
     short interval, so the next reference-lane task is wall handling plus
     PBF/incompressibility/viscosity/surface-tension constraints before using
     it as a liquid-quality baseline.
     2026-06-13 09:21 update: the plain SPH reference lane now has
     PBF-style density projection, wall clamping, explicit mechanics telemetry,
     and preflight geometry diagnostics. The old `ironh=0.85` same-material
     "contact" probe was not valid contact: physical support extents overlap
     by `0.15 m`, even though center bounds report a small positive gap.
     Overlapped setups now report `initial-block-geometry-overlap` and the
     probe analysis records `initial-preflight-blocked`. A valid face-contact
     `mech=sph` URL with `ironh=1` is `good` over a short direct probe
     (`maxSpeed 0.080756 m/s`, drop COM moves downward, wall defaults
     `283.15 K`). This improves the reference lane, but it does not clear the
     MLS-MPM resident bug: mechanics+gravity-only MLS-MPM still needs its
     own valid-geometry contact/settling audit.
     2026-06-13 09:51 update: valid-geometry all-laws MLS-MPM direct probes
     preserve volume over `1024` substeps (`J 0.997..1.009`), while
     mechanics+gravity-only collapses to the `J=0.2` floor because the
     incompressibility/EOS law is disabled. The valid-geometry scene probe
     exposed a separate visible render-field bug: sparse 27-particle drops
     were rendered in a too-coarse global field and expanded above particle
     bounds. Sparse resident render-field resolution is now `32`, sparse
     radius inflation is removed, the scene probe is `good`, and the visual
     sequence harness is drawRange-aware. Remaining P0 is now long-horizon
     liquid quality/merge/settle evidence and resident throughput, not the
     invalid `ironh=0.85` overlap or the fixed sparse render-field expansion.
     2026-06-13 10:36 update: the `0.4`/resolution-32 sparse render fix was
     not sufficient for all valid separated H2O/H2O cases. Direct and scene
     probes showed compact particle state and decoded render rows were bounded,
     while MarchingCubes still overshot sparse drop domains and created the
     nested/pulsing visible blob class. The runtime now defaults visible
     surface radius to `0.15`, records decoded material/phase/domain render-row
     bounds, and clamps each generated surface to those bounds plus
     radius-derived padding before the sealed-container clamp. Law-group
     controls are fully wired through runtime/probes, and no-full-readback
     cohort analysis now reports unavailable live cohorts instead of stale
     initial CPU data. The bounds-clipped scene probe
     `/tmp/ulg-history-probes/current-lawmatrix-12-scene-bounds-clipped-5batch.json`
     is `good` with no visual surface issues, and the dense visual artifact
     `h2o-h2o-valid-geometry-bounds-clipped-visual` passed. This closes the
     current render-extraction lie, not the long-horizon water-quality gate.
     2026-06-13 11:00 update: live-state long direct probes now prove the
     all-laws valid-geometry drop is not frozen. Over `1024` substeps /
     `0.512 s`, J stays `0.997748..1.009107`, pressure impulse remains `0`,
     drop COM moves `1.25 -> 0.463889 m`, and center-bound gap shrinks
     `0.183333 -> 0.034447 m`. The analyzer now also reports finite-support
     gap from preflight geometry, because center-bound gap made a physically
     touching setup look separated by one particle-radius sum. Support-gap
     smoke shows `~0 -> -0.01625 m` after `0.128 s`. Remaining P0 is therefore
     not "drop is frozen"; it is visually validated merged/settled liquid
     behavior, free-surface quality, and making this evidence cheap enough to
     run routinely without full readback.
     2026-06-13 11:35 update: base/drop cohort diagnostics now exist in the
     compact no-full resident summary. The summary ABI appends optional
     initial-order cohort rows, the shader uses a 32-lane reduction to stay
     under workgroup-storage limits, and the probe passes base/drop ranges into
     resident steps. No-full compact-cohort smoke is `good` over `0.128 s` with
     drop COM `1.25 -> 1.159897 m`, support gap `~0 -> -0.01625 m`, J
     `0.998833..1.006488`, and pressure impulse `0`. Remaining work is to make
     compact summary timing cheap enough for long visual matrices and pair this
     live-state evidence with scene/visual free-surface checks.
     2026-06-13 12:25 update: the screenshot-backed detached/nested water
     artifact is now pinned as a render-field currentness/aliasing chain, not a
     single vague physics failure. Stale retained MarchingCubes surfaces are
     hidden when they no longer fit current particle-derived bounds;
     same-material/same-phase H2O render domains merge into one visible
     material field while base/drop diagnostics remain separate; sparse
     render-only radius floor is `0.2`; and merged same-material fields use
     render resolution `32`. The decisive current-render scene probe
     `/tmp/ulg-history-probes/reassess-10-scene-all-laws-tight-long-merged-res32-render-every-batch.json`
     is `good` over `8 x 64` no-full resident batches with no visual issues,
     H2O visible in all samples, J `0.998677..1.008176`, drop COM
     `1.2498 -> 0.9031 m`, and pressure impulse `0`. The post-item visual
     sequence also passed and wrote GIF/WebM artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-valid-merged-res32-current-render-pass/`.
     Remaining P0 is still true liquid quality/settling over longer horizons
     and render/capture throughput; `renderEvery=2` is explicitly stale-cadence
     evidence for moving liquid and should not be used as a current-render
     correctness gate.
     2026-06-13 atomic-gate update: added `npm run test:physics-atomics` for
     zero-force rest, free-space gravity-only motion, mass conservation,
     bounded `J`, law-group isolation, and zero disabled-pressure impulse. The
     suite initially failed on gravity-only transfer and H2O/H2O
     mechanics+gravity-only volume drift. Fix: non-solid particles with the
     EOS/pressure law disabled now move ballistically but do not let APIC
     affine residue mutate deformation volume in either CPU carrier or
     resident CPU/WGSL G2P. Focused atomics, nearby MLS-MPM/SPH tests, and
     full `npm test` pass. Direct resident evidence:
     `/tmp/ulg-history-probes/current-atomicgate-valid-mechanics-gravity-only-256-g2p-scale.json`
     is `good` over `256` substeps with disabled-pressure impulse `0`, J
     exactly `1..1`, max speed about `0.135 m/s`, and drop COM
     `1.25 -> 1.235336 m`. Post-item short visual sanity also passed and
     wrote PNG/GIF/WebM/timeline artifacts under
     `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-atomicgate-mech-gravity-pressure-disabled/`;
     limitation: capture cadence is still slow (`~5.4 s` mean interval for a
     `250 ms` target).
     2026-06-13 EOS-on update: expanded `npm run test:physics-atomics` to
     `5/5` with H2O/H2O EOS-on MLS-MPM contact and plain SPH/PBF reference
     lane invariants. The current WebGPU resident direct probe
     `/tmp/ulg-history-probes/current-atomicgate-eos-on-liquid-contact-direct-resident.json`
     is `good` over `256` substeps with J `0.997148..1.006978`, pressure
     impulse `0`, drop COM `1.25 -> 1.159897 m`, and support gap
     `~0 -> -0.016253 m`. The matching visual sequence
     `h2o-h2o-atomicgate-eos-on-liquid-contact` passed and wrote PNG/GIF/WebM
     artifacts; capture cadence is still slow (`~5.35 s` mean interval for a
     `250 ms` target).
     2026-06-13 liquid-quality gate update: `scripts/sph-long-horizon-probe.mjs`
     now has opt-in H2O/H2O same-material quality gates. The merge/render gate
     passes in scene mode at
     `/tmp/ulg-history-probes/current-liquid-quality-merge-optin-scene-256-tolerance-aligned.json`
     with final H2O visible surface count `1`, support gap
     `~0 -> -0.02056 m`, J `0.998788..1.007276`, pressure impulse `0`, and no
     visual surface issues. The settle gate correctly remains `bad` at
     `/tmp/ulg-history-probes/current-liquid-quality-merge-settle-optin-direct-1024.json`:
     `1024` direct substeps / `0.512 s` are still below the `1 s` settle
     horizon and final drop speed is about `1.68 m/s` against the `0.25 m/s`
     gate. Treat merge/contact as pinned and settling/free-surface quality plus
     affordable long horizons as the next P0 target.
     Follow-up `1.024 s` direct settle evidence at
     `/tmp/ulg-history-probes/current-liquid-quality-merge-settle-optin-direct-2048-singlebatch.json`
     reaches the declared horizon and still fails
     `liquid-settle-final-drop-speed>0.25` with final drop speed about
     `1.43 m/s`, J `0.985629..1.026000`, and pressure impulse `0`. That same
     single-batch run took about `399 s`, with compact-summary wait about
     `368 s`, so the next P0 slice must address both physical settling laws
     and compact-summary/long-horizon throughput.
     2026-06-14 atomic-settle status: `npm run test:physics-liquid-atomic`
     now passes the opt-in node-level long-horizon acceptance gate. Current
     measured CPU-driver evidence after `1.024 s`: support gap about
     `-0.125 m`, final drop speed about `0.196 m/s` against the `0.25 m/s`
     gate, bounded J `1.046..1.049`, and conserved mass. This is useful
     CPU/reference evidence.
     2026-06-14 direct-resident no-full settle status: the
     `/tmp/ulg-history-probes/current-liquid-settle-direct-resident-nofull-2048-20260614.json`
     probe reaches `1.024 s` over `2048` resident substeps and classifies
     `good`: final drop max speed about `0.1935 m/s`, support gap about
     `-0.1079 m`, bounded J about `0.9500..1.0490`, pressure impulse `0`.
     This closes retained direct-resident telemetry for the scenario, but not
     the browser scene/MarchingCubes visual settle proof. The run took about
     `431.4 s`, with compact summary about `342.7 s`, so compact-summary/
     readback throughput is now the immediate P0 before this can be part of
     routine visual validation.
     2026-06-14 fence-attribution status: compact-summary telemetry now splits
     setup/encode/submit/`mapAsync`/decode timing. A `64`-substep no-full
     H2O/H2O probe spends about `14.49 s` in final summary `mapAsync` for a
     `336` byte row; system Chrome/Vulkan stays about the same; thermal/
     reaction-off mechanics-only still spends about `13.50 s`. The summary row
     is not the real cost. The first readback is draining queued resident
     mechanics command buffers. Prioritize fused/sparse P2G -> grid update ->
     G2P execution under ComputeManager/GPU lane authority.
     2026-06-14 active-grid status: the opt-in
     `fuseNoFullResidentMechanicsActiveGrid` path now dispatches only an
     active full-grid row window inside the fused sequence and keeps inactive
     rows zeroed for G2P. Matched `64`-substep browser probes stayed `good` in
     full-grid and active-grid modes; active-grid reduced compact-summary
     `mapAsync` from about `13.44 s` to about `3.02 s` with `2352/13824`
     active nodes. A `2x64` active run stayed `good` and used resident compact
     bounds for the second batch. Keep this opt-in until scene-paired visual
     validation and ComputeManager/GPU-lane promotion are complete.
   - Rule: architecture plumbing is not done if the demo still behaves
     severely wrong.
- Recurring evidence gate: after each major todo item, run the visual
  sequence harness across same-material liquid/liquid, solid/liquid,
  phase-change steam/water, and reaction/product cases as applicable.
  The harness now accepts `ULG_SPH_VISUAL_URL` and
  `ULG_SPH_VISUAL_LABEL` so those representative scenarios can reuse the
  same capture/test path. Use `npm run probe:sph-long-horizon` with
  `ULG_PROBE_REPO_DIR=<worktree>` for repeatable compact-diagnostic
  comparisons across old commits or isolated worktrees; this is the probe
  that pinned the pressure/gas regression to `c81a66a` and verified the
  current pressure-row gate. Use `ULG_PROBE_MODE=direct-resident` for fast
  retained resident mechanics/thermal telemetry, then pair it with scene
  mode for pressure/render-surface evidence. Use
  `npm run probe:sph-visual-matrix` as the recurring representative scenario
  smoke; select a subset with `ULG_VISUAL_MATRIX_SCENARIOS=<label,...>` when
  only the touched scenario family needs to run.
   - Immediate next slices:
     - run a longer valid-geometry all-laws H2O/H2O merge/settle probe with
       full or admitted cohort readback at sparse checkpoints, so "drop
       descends and merges" is measured from live state rather than stale CPU
       mirrors or short-window render surfaces;
     - promote the active-grid mechanics sequence into a ComputeManager-owned
       GPU resident lane and replace the simple AABB active window with tiled/
       neighbor indexing before making it default;
     - make `ULG_PROBE_EXPECT_LIQUID_SETTLE=1` pass for same-material H2O/H2O
       without disabling laws or relaxing the declared physics thresholds;
     - audit P2G/grid-update/G2P for momentum, volume, wall clearance, and
       same-material contact transfer under valid-geometry mechanics+gravity
       probes;
     - extend the plain SPH/PBF reference mode toward long-horizon
       incompressible/liquid behavior, viscosity, surface tension, and visual
       scene validation before moving it into a ComputeManager-managed WebGPU
       law lane;
     - keep improving visual sequence cadence and resident render throughput;
       current GIF/WebM capture works but still reports slow-capture cadence,
       so it is not yet dense enough to infer subtle fluid motion by eye alone;
     - keep law-group checkboxes in the recurring visual matrix so each law
       group can be tested independently and in combinations.
1. **Authority and state ownership**
   - `peercompute-law-graph-authority-plan.md`
   - `resident-state-authority-contract-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `physics-loop-authority-diagrams.md`
   - Goal: one authoritative owner per state family and one admitted mutation
     path for distributed compute.
2. **ULG resident-loop bug remediation**
   - `resident-state-authority-contract-plan.md`
   - `webgpu-ocean-mlsmpm-simulator-plan.md`
   - Goal: repair the bugs introduced during the WebGPU-resident refactor:
     no-op law output overwrites, render/physics coupling, stale CPU mirrors,
     buffer lifetime mistakes, cadence mismatches, per-substep readback/fence
     stalls, and ambiguous producer/consumer ownership.
3. **Reaction, product, gas, and pressure closure completion**
   - `reaction-stoichiometry-energetics-plan.md`
   - `sedenion-reaction-scoping-plan.md`
   - Goal: keep balanced stoichiometry general, move gas/product ledgers toward
     resident state, use the sedenion reference only as a symbolic candidate
     prefilter, and finish validated pressure-gradient or gas-cell force
     coupling without material-pair scripts.
4. **Steam, water, phase, optics, and ice controls**
   - `phase-resolved-steam-optics-plan.md`
   - `sphphasedemo.md`
   - Goal: distinguish pure vapor from condensed steam, route optics through
     phase state, and make the iron-on-ice scenario preflight honest.
5. **WebGPU hot-loop and surface generation**
   - `webgpu-ocean-mlsmpm-simulator-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `algorithm-derived-material-properties-plan.md`
   - Goal: keep particle, grid, gas, wall, product, phase, and surface fields
     GPU resident; use compact summaries instead of full readback; derive
     MLS-MPM/contact/surface/PBR rows from closure-backed material state rather
     than renderer constants.
6. **Material/closure resolver migration**
   - `webgpu-material-property-resolvers-plan.md`
   - `material-property-json-bank-plan.md`
   - `material-polytope-registry-and-property-fit-plan.md`
   - Goal: move resolver families into ComputeManager-managed CPU/WASM/WebGPU
     workers with explicit closure provenance, cache keys, validity domains,
     precomputed JSON bank warm inputs, accepted polytopes, sampled
     first-principles artifacts, response-fit rows, and CPU/WASM reference
     paths.
7. **Derivation visualization and audit surfaces**
   - `electron-cloud-material-derivation-visualization-plan.md`
   - `material-polytope-registry-and-property-fit-plan.md`
   - Goal: let users inspect where material/runtime rows came from, including
     electron/radial density, molecular bonding, polytope domains, sampled
     first-principles data, fit residuals, cache status, and strict-mode
     blockers, without moving expensive closure derivation into the hot UI
     loop.
8. **Frontier law expansion**
   - `frontier-todo.md`
   - Goal: add radiation, nuclear, Cherenkov, gravity, MHD/PIC, quantum
     response, relativistic, and astrophysical closure paths as law nodes with
     honest validation gates.
9. **PeerCompute, Eshkol, and MoonLab service integration**
   - `peercompute-law-graph-authority-plan.md`
   - `gpu-resident-lanes-and-warm-services-plan.md`
   - `webgpu-material-property-resolvers-plan.md`
   - Goal: run ULG laws and closure derivations through PeerCompute service
     orchestration, keep heavy Eshkol/MoonLab hosts warm when scenario latency
     requires it, use Eshkol for derived closures/reference/WASM/WGSL artifacts,
     and use MoonLab for quantum/many-body response artifacts.
10. **Cold-start and persistence polish**
   - `cold-start-cache-performance-plan.md`
   - Goal: persist only stable schemas and content-addressed closure artifacts
     after the law/state contracts stop moving.
11. **Final validation and packaging**
    - `overarching-completion-plan.md`
    - Goal: complete browser smoke tests, scientific overclaim guards,
      distributed evidence handoff, and production-readable status docs.
12. **Full distributed PeerCompute stack**
    - `distributed-peercompute-network-stack-plan.md`
    - Goal: after the single-node authority and worker-stage contracts are
      stable, stand up this machine as the WSS/STUN/TURN/ICE test environment
      for three browser windows across two computers, proving real distributed
      placement, StateManager sync, cache admission, and GPU-fence gated
      mutation.

## Cache Layering Rule

- Hot cache: worker-local WebGPU buffers and pipeline resources under explicit
  leases, preferably retained inside ComputeManager-owned GPU resident lanes
  when the same state family is being mutated across multiple passes.
- Warm cache: StateManager/DataState deltas, closure handles, compact law
  summaries, admitted state references, and warm Eshkol/MoonLab service hosts
  when scenario latency requires them.
- Cold cache: content-addressed artifacts in browser storage, PeerCompute
  artifact cache, and sibling-repo service outputs.
- Invalidation must include input hash, method/tool hash, validity domain,
  schema version, source/runtime ABI, and validation status.

## Copy-Avoidance Rule

Do not split a single hot resident state across arbitrary GPU child workers just
because child-worker leases exist. First keep each active resident state key on
one GPU lane and move only compact summaries, retained-buffer refs, and admitted
deltas across the control plane. Domain-splitting comes later with explicit
tile ownership and boundary exchange.

2026-06-12 status: PeerCompute now has a passive `GpuResidentLaneManager`,
`ComputeManager` can wrap declared inline GPU-lane tasks before local commit,
and ULG resident MLS-MPM/SPH steps can publish shape-compatible lane lease, copy
budget, retained-buffer-ref, and GPU-fence evidence. The active next step is a
real ComputeManager/GPUHub lane task for the whole SPH pass DAG, not another
local scene-side scheduler.

## Scale Rule

The same law graph must be able to focus resolution by context: quantum and
molecular closures for small scales, continuum SPH/MLS-MPM/finite-volume laws
for materials, and gravity/MHD/PIC/radiation/relativistic laws for astrophysical
contexts. Higher and lower scales can provide boundary conditions and closures,
but only the active focus region should receive hot high-resolution compute.

## Current P0 Reassessment - 2026-06-13 15:01 AKDT

- Do not spend more time treating gas/pressure coupling as the primary H2O/H2O
  liquid-settling cause. The direct law matrix already showed pressure on/off
  was not the proximate remaining failure.
- The first explicit liquid-stability slice is now passing: dynamic viscosity
  is carried through the mechanics ABI/refresh/buffers/CPU carrier/WGSL P2G
  stress, the CPU carrier consumes hydrostatic pressure consistently, and the
  grid update uses a floor-only no-slip boundary.
- The opt-in atomic gate now passes:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` reports
  `6/6` passing for the former long-horizon H2O/H2O speed failure.
- The CPU SPH visual path no longer disappears on empty CPU batches. The
  `mech=sph` browser probe classifies `good`, with H2O visible in all sampled
  states and no visual surface issues.
- Priority order inside P0:
  1. Keep the new atomic liquid gate mandatory for SPH/MLS-MPM mechanics edits.
  2. Implement surface tension/free-surface behavior as an explicit law slice,
     not hidden APIC damping and not law removal.
  3. Run representative dense visual sequences for liquid/liquid,
     solid/liquid, steam/water, and reaction/product scenarios.
  4. Reduce compact-summary/readback cost and move the accepted SPH/MLS-MPM law
     DAG behind a ComputeManager/GPUHub resident lane with explicit authority.

2026-06-13 17:20 status: the latest pressure/gas-window failures split into
three narrower bugs and one open orchestration gate. Hot H2O/H2O instability was
thermal conduction/phase overshoot feeding EOS/mechanics; the thermal pass now
has pair/aggregate limiters and conservative default rate. Fe/H2O corruption
was a packed Debye thermal graph and over-broad active-metal/water reaction
scope; Debye graphs now use source metadata/32 samples and Fe/H2O no longer
reacts as zero-barrier water chemistry. The visual matrix can now save PNG
frame sequences (`ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1`). Immediate P0 order is:

1. Keep hot-H2O and Fe/H2O atomics in the focused test set while editing any
   thermal, phase, EOS, reaction, or mechanics buffer path.
2. Fix the mounted-scene Na/H2O timeout without disabling the reaction law.
   Direct resident Na/H2O works, so treat this as product-closure warmup,
   render-scene orchestration, and admission telemetry.
3. Reproduce the user's phone CPU-SPH render lifecycle bug with a mobile
   viewport/page-visibility RAF probe; desktop CPU-SPH probes currently pass.
4. Continue surface tension/free-surface work and move the pass DAG toward a
   ComputeManager/GPUHub resident lane once the representative matrix is
   stable with frame evidence.

2026-06-13 18:05 status: `npm run test:physics-atomics` is passing again after
fixing hydrostatic prestrain and tightening the condensed G2P `J` guard in CPU,
JS resident fallback, and WGSL. Direct resident H2O/H2O mechanics now passes the
`0.95..1.05` J gate with zero pressure impulse. Keep compact-summary/readback
cost high in the queue: the correctness probe still spent about `51.7s` in
compact summary for one `256`-substep no-full batch.

2026-06-13 18:55 status: the current P0 split is sharper. The long liquid gate
passes with a small explicit support-wall damping term carried through CPU,
resident JS fallback, and WGSL G2P, and gated by the viscosity law group. The
mounted `mech=sph` probe now validates the actual CPU-SPH path. CPU
MarchingCubes has a CPU-only raster radius floor/resolution floor so sparse CPU
SPH surfaces no longer vanish because the field under-samples the particles.

Updated immediate priority:

1. Keep the long liquid atomic gate, G2P damping regression, CPU MarchingCubes
   renderer regression, and mounted CPU-SPH frame probe in the recurring
   validation set.
2. Fix no-full resident visual summaries/readback cost. The current
   full-readback path is useful correctness evidence, but final resident
   behavior needs fresh GPU-resident visual diagnostics without round-tripping
   full particle/render fields.
3. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law. Prior evidence points at reaction ledger/readback/product
   handoff, not at pressure removal.
4. Implement explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
5. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after the representative matrix is stable.

2026-06-13 19:25 status: the newest catastrophic no-full resident failure was a
G2P WebGPU params ABI bug, not another pressure/thermal/render timing problem.
The G2P params payload is 80 bytes; the GPU uniform buffer was still 64 bytes.
After the write overrun, the shader could see invalid params and write no
particle rows, leaving retained no-full outputs effectively zero. The fix is a
shared `G2P_PARAMS_BYTES = 80` contract plus a fake-device regression that
throws on buffer write overruns. Full-readback G2P parity and short no-full
scene/CPU-SPH probes are good. Do not paper over this class with queue fences:
temporary per-stage fences were removed, and the next structural work is ABI
contract tests for the other WGSL kernels plus cheaper GPU-resident summaries.

Updated immediate priority after the G2P ABI fix:

1. Fix no-full resident visual summaries/readback cost so fresh visual proof
   does not require full particle/render-field round trips.
2. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
3. Add the mobile/page-visibility CPU-SPH lifecycle probe for the user's phone
   blank/flash symptom.
4. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
5. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 19:45 status: the first ABI hardening follow-up is complete.
`tests/webgpuKernelAbi.test.mjs` now covers `16` resident scalar params
contracts and compares WGSL struct byte length, JS params ArrayBuffer length,
uniform buffer allocation size, and writeBuffer factory usage. Keep adding to
this guard when new resident law kernels or params structs land. Full
`npm test` passes `496/497` with the one long-horizon liquid gate skipped unless
explicitly enabled, and ICC is refreshed at `227` indexed files / `1071` memory
chunks. The active next P0 is now no-full resident visual summaries/readback
cost, because full-readback remains the correctness path and compact summaries
are still too expensive for routine long visual horizons.

2026-06-13 19:50 status: the no-full compact-summary cost item is partially
complete. Resident compact summaries now have an explicit `particle-visual`
scope for routine visual/cohort diagnostics. It skips the active-grid-node scan
while still reporting mass, momentum, center of mass, particle AABBs, cohorts,
thermal phase totals, and J bounds from resident GPU buffers. The missing grid
evidence is explicit (`activeGridNodeCount=null`,
`activeGridNodeCountAvailable=false`, `gridNodeScanCount=0`), while strict
probes can force `ULG_PROBE_COMPACT_SUMMARY_SCOPE=full`. Direct no-full
H2O/H2O `2 x 1` comparison probes both classify `good`: particle-visual compact
summary was about `3026 ms` cold / `230 ms` warm, full scope was about
`3248 ms` cold / `295 ms` warm. The remaining P0 is therefore not the grid scan
alone; it is the readback/map fence plus cold-start cost. The next slice should
move visual summaries into a retained GPU diagnostic/render lane with sparse
admitted readbacks and warm long-lived services.

Updated immediate priority after the compact-summary scope split:

1. Reduce retained diagnostic/render readback fences for no-full resident visual
   validation; keep `particle-visual` as the cheap routine summary and reserve
   `full` summary scope for strict correctness checkpoints.
2. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
3. Extend the mobile/page-visibility CPU-SPH lifecycle probe into real-device
   visual sequence capture if the user's phone still blanks/flashes after the
   synthetic lifecycle fix.
4. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
5. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:02 status: the synthetic mobile/page-visibility CPU-SPH
lifecycle slice is complete. CPU-SPH `setParticles()` now forces an immediate
viewport render plus a two-frame RAF refresh burst after applying
MarchingCubes surfaces, and `visibilitychange`/`pageshow` resume use the same
burst path. The focused Playwright mobile-sized H2O/H2O `mech=sph` test steps
the CPU-SPH scene, dispatches visibility/page-show events, and verifies visible
CPU-particle surfaces plus refresh-burst telemetry. This directly targets the
phone symptom where the canvas only repainted after app switching and surfaces
flashed/disappeared. Keep this in the recurring validation set; if the real
phone still fails, escalate from synthetic lifecycle events to device capture
and browser-specific context-loss diagnostics.

Updated immediate priority after the CPU-SPH lifecycle slice:

1. Reduce retained diagnostic/render readback fences for no-full resident visual
   validation; keep `particle-visual` as the cheap routine summary, reserve
   `full` summary scope for strict correctness checkpoints, and use explicit
   no-full surface-summary skip only where stale visible surfaces are acceptable
   evidence.
2. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
3. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons, with the CPU-SPH lifecycle test in the
   recurring visual sanity matrix.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:15 status: the next no-full readback-fence slice is complete but
bounded. `refreshSphResidentRenderState()` now accepts
`renderFieldSurfaceSummaryMode=auto|readback|skip`. In skip mode, no-full
render refreshes avoid the compact render-field surface-summary `mapAsync`
readback and report explicit telemetry instead of pretending surface activity
was measured. The long-horizon probe exposes this through
`ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip`, and the mounted Playwright
regression verifies WebGPU resident H2O/H2O can run with render rows readback
`false`, render field readback `false`, compact surface summary readback
`false`, and `resident-surface-draw-summary-skipped`. This reduces routine
diagnostic fence pressure only for callers that accept stale visible surfaces
as non-strict evidence. Strict visual correctness, anomaly escalation, and
future default mounted playback still need either readback or the retained GPU
draw/summary lane.

2026-06-18 21:00 status: the no-summary route no longer has to stop at
`resident-surface-draw-summary-skipped`. When no-full resident render refreshes
skip compact surface summaries, the scene can retain render-field rows and
surface buffers as an engine-owned, no-overlay GPU handoff and publish
`resident-render-field-buffer-direct-consumer-ready`. Focused Playwright and
browser probe evidence are console-clean; visibility is still blocked on the
real engine/marching-cubes/WebGPU consumer binding, not another overlay or
compact readback fallback.

Updated immediate priority after the no-full summary-skip slice:

1. Bind the retained render-field/surface buffers to the proper engine
   marching-cubes/WebGPU renderer consumer so no-full visual correctness updates
   fresh surfaces without readback.
2. Fix mounted Na/H2O reaction/product orchestration without disabling the
   reaction law.
3. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:31 status: the first mounted Na/H2O orchestration bug is fixed.
Direct mounted scene/probe resident steps now promote the WebGPU resident
product gas-species ledger into the overlay/render gas-pressure summary instead
of leaving display/render pressure at the ambient baseline. The mounted
Na/H2O scene probe classified `good` and reports `h2=24.6kPa`, total pressure
`125.9kPa`, WebGPU `reaction-step-executed`, and retained product mass rows
with EOS sidecar ready. The focused Playwright regression
`SPH phase mounted resident Na/H2O promotes product gas pressure` passes.
Remaining Na/H2O work is longer-horizon product carry-forward, double-count
prevention, visible product/gas presentation, and pressure coupling under the
retained GPU authority path.

Updated immediate priority after the mounted Na/H2O gas-promotion slice:

1. Continue the retained GPU visual diagnostic lane so no-full visual
   correctness can update fresh surfaces without readback.
2. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
3. Extend Na/H2O to repeated resident horizons with product carry-forward,
   double-count prevention, and visible product/gas evidence.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-13 20:51 status: the retained surface-draw diagnostic lane is now
bounded instead of allowed to hang. `surfaceDrawDiagnosticMode=metadata` can be
requested by mounted render refresh and the long-horizon probe, but it has a
default `100000` render-field-cell budget. Current sparse H2O/H2O fields reach
`272072` cells, so the path returns
`resident-surface-draw-diagnostic-skipped` with
`surface-draw-diagnostic-field-cell-budget-exceeded` instead of wedging
headless Chromium. The previously hanging small scene probe now classifies
`good` with explicit skip telemetry. This is not completion of no-full fresh
surface draw; the next retained visual task is to reduce, tile, or otherwise
budget the surface-vertex/draw metadata path so representative sparse fields
can build under budget.

Updated immediate priority after the diagnostic-budget guard:

1. Reduce or tile retained surface-vertex/draw metadata so no-full visual
   diagnostics can produce fresh GPU-resident surface evidence under budget.
2. Continue explicit surface-tension/free-surface behavior and longer
   settled-liquid visual horizons.
3. Extend Na/H2O to repeated resident horizons with product carry-forward,
   double-count prevention, and visible product/gas evidence.
4. Move the accepted SPH/MLS-MPM law DAG into a ComputeManager/GPUHub resident
   lane with authority evidence after representative validation stabilizes.

2026-06-19 10:27 status: the current native WebGPU surface work is still the
top roadmap item. ULG now has an engine-owned native WebGPU surface consumer
and direct resident buffer handoff, plus bridge diagnostics for canvas
dimensions, DPR, draw attempts/skips, compact surface rows, and camera-projected
surface bounds. The long-horizon probe now captures a visible-canvas center
crop and distinguishes it from composited page screenshots. Current headless
evidence is console-clean and shows the surface bounds are in the camera frustum,
but direct canvas crops remain transparent black; headless WebGPU pixel
readback/presentation is also failing with `A valid external Instance reference
no longer exists`.

Updated immediate priority after the native bridge diagnostics slice:

1. Verify/fix the engine-owned native WebGPU surface consumer in a non-headless
   browser and on the phone. Use the new projection/canvas diagnostics to
   isolate presentation/device-scale failures.
2. Continue the no-readback native renderer path and avoid overlay or full
   compact surface-readback fallback as the main MLS-MPM route.
3. Once visible native pixels are accepted, return to the resident continuation
   hang and second-batch no-full mechanics failures.
4. Continue material-size/PBR restoration, material property registry work,
   and cubic-barrier/contact integration after the renderer path is not blocking
   every MLS-MPM performance test.

2026-06-19 11:16 status: native canvas sizing is now instrumented and less
overlay-coupled. The engine-owned native surface consumer sizes from the actual
canvas CSS/client box and owner-window DPR, then reports CSS size, backing size,
browser DPR, and clamped resize pixel ratio. Desktop and mobile-shaped probes
are console-clean and show the primary surface in frustum; both still capture
transparent black because this headless Chromium WebGPU path also fails a
standalone green-clear smoke with `A valid external Instance reference no longer
exists`.

2026-06-19 status update: native visible-output diagnostics now distinguish
runtime-readback-disabled browser/phone frame validation from WebGPU readback
lifetime failures. `resolveResidentSurfaceVisibleGpuConsumer()` reports
`browser-frame-validation-required` as the native validation blocker family when
the engine-owned native consumer rendered but runtime pixel readback is
delegated to the browser harness, and the long-horizon/performance summaries
surface that field without hiding blank real canvas frames.

Updated immediate priority after native canvas sizing:

1. Get a real browser/phone native WebGPU acceptance signal using the new
   CSS/backing/DPR/projection diagnostics.
2. If real-device native presentation remains blank, debug device/context
   presentation next; if it presents, return to the resident continuation hang.
3. Keep the no-overlay, no-full-readback route as the primary MLS-MPM renderer
   integration path.

2026-06-19 material-bank routing note: thermal material tables now preserve
accepted material-bank warm-input metadata through table construction,
static-table cache rehydration, and thermal WebGPU result envelopes. Treat this
as a non-authoritative annotation path for later thermal/EOS shader warm-start
work; closure-derived thermal graphs still own the physics.

2026-06-19 material-bank/PBR routing note: optical GPU tables now preserve
accepted material-bank PBR warm-input metadata through table construction and
static-table cache rehydration. Treat this as diagnostics and future
warm-start plumbing only; closure-derived optical rows still own packed PBR
values.

2026-06-19 render-row console routing note: the local browser console harness
no longer reports the `ulg-sph-render-rows-params` validation cascade. The
render-row params uniform allocation now matches the 48-byte JS/WGSL ABI, and a
short H2O/H2O render-row probe classifies `good` with zero browser console
issues or warnings. Continue native/mobile visible-output work separately; this
does not prove the phone presentation path.

2026-06-19 native surface routing note: explicit
`native-webgpu-surface-consumer` requests now retain render-field buffers by
coercing auto surface-summary mode to `skip`. Mobile-shaped native probes now
reach the native direct-consumer handoff and bridge render path with console
clean output; the remaining fail-closed blocker is
`native-surface-validation-readback-lifetime`, not summary-only fallback.

2026-06-19 reset trace note: the mounted demo now publishes a resident
stage-order trace for reset invalidation/resync and resident execution
completion/error/stale/watchdog outcomes. The long-horizon probe captures it in
per-batch metrics, including direct probe-driven resident batches. Next reset
work is to turn this trace into hard post-reset repeated-substep assertions for
nonzero active-grid and visible/motion evidence.
