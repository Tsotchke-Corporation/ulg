# Codex Audit - 2026-07-09

Prepared for big dog.

## Executive verdict

Claude has made substantial, concrete progress. The work is not complete and the
current branch is not an accepted application-goal checkpoint.

The correct status is **substantial implementation progress, P0 blocked**:

- The GPU-resident MLS-MPM and Schroeder hierarchy are real implementations, not
  plan-only scaffolding.
- Local PeerCompute authority, admission, retained-buffer, hierarchy, topology,
  reaction, thermal, molecular, and rendering paths have all advanced materially.
- The current authoritative two-level SS mechanics path is physically invalid for
  a demonstrated tiny-mass gas cohort. It disperses a coherent drop at roughly
  300 m/s in 8 ms of simulated time.
- The newest complete browser acceptance run is red (`57 passed / 3 failed / 2
  skipped`), and no later full run covers the July 9 changes.
- Several recent renderer and chemistry claims have weaker tests than their scope.
- Production PeerCompute loading, device-portable marching-cubes allocation,
  distributed execution, scientific breadth, and current documentation remain
  incomplete.

The branch should not be described as physics-green, release-green, or fully
PeerCompute-integrated until the P0 mechanics defect is fixed and the full visual
and behavioral acceptance sequence is rerun.

## Snapshot and scope

- Audit prompt received: `2026-07-09T11:18:57-08:00`.
- Audit file completed: `2026-07-09T11:41:52-08:00`.
- File created: `plan/codex-audit-7-9.md`. No other ULG file was edited by this
  audit.
- Audit cutoff: branch `SS`, commit
  `1bd474ead4a912a37b7a819a18bb97af12e7ecbb`, committed at
  `2026-07-09T11:35:20-08:00`.
- The branch advanced from `b8a744b` to `1bd474e` during the audit. The final
  delta was inspected and is included here.
- After the cutoff, Claude began a separate uncommitted transmission-shader edit
  in `sphPhaseScene.js`. It is not part of this audit snapshot. It did not address
  the P0 SS defect or other P1 findings when observed.
- At cutoff, `SS` was 365 commits ahead of local `main`, zero behind, with merge
  base `b4e2bcd`.
- Full `SS` delta from the merge base: 97 files, 81,483 insertions, 11,062
  deletions.
- Claude working range audited (`a1e5378^..1bd474e`): 195 commits, 81 files,
  30,223 insertions, 10,148 deletions.
- Plan inventory read: 137 files, including 135 Markdown files (87,307 lines)
  and two PDFs (84 pages total). This includes root plans, 99 files under
  `plan/done`, 20 root todo files, and five `plan/todo/SS` files.
- `plan/plan.md` and `plan/log.md` were read first. All plan/todo paths and both
  PDFs were inventoried and reviewed; goal-bearing, active, contradictory, and
  recently changed documents received a deeper evidence pass.
- Source, tests, commit history, generated production output, live process state,
  and current test behavior were cross-checked against plan claims.
- ICC was registered but stale (`ceaeb6e` indexed versus the then-current
  `b8a744b`). It was not refreshed because refresh would modify `.icc` files and
  violate the instruction to change only this audit file.

This is a moving-work snapshot. Commits after `1bd474e` are outside this audit.

## Application goals used for the audit

The current project documents define the following goal hierarchy.

1. **Triad application:** a browser-native ULG demonstration integrating
   PeerCompute orchestration with Eshkol and MoonLab services, GPU ABI execution,
   provenance-bearing closures, carrier/runtime behavior, and a useful browser
   visualization surface (`README.md:1-31`; Triad PDF pages 8-9).
2. **Authority correctness:** ULG owns law content, reference/oracle paths, and
   visualization; PeerCompute's NodeKernel, ComputeManager, GPUHub, and
   StateManager supervise accepted execution and authoritative mutation
   (`plan/todo/README.md:11-38`; `plan/todo/overarching-completion-plan.md:75-101`).
3. **First-principles and honest science:** laws and closures have provenance,
   validation gates, explicit state-family reads/writes, and CPU/WASM reference
   paths. Unsupported scientific scope must remain labeled as such.
4. **GPU-resident scaling:** mutable hot state stays on same-device,
   ComputeManager-owned lanes; full readback/reupload and frame-copy-back are not
   accepted architecture. SS levels must be physically derived, conservative,
   and admission-gated (`plan/todo/SS/README.md:24-43`;
   `schroeder-tree-and-algorithm-plan.md:501-514`).
5. **Flagship behavior and visual truth:** phase change, reaction, pressure,
   settling, conservation, material optics, and cadence must survive close-spaced
   sequence checks with frame/log artifacts and physics atomics.
6. **Deployable distributed system:** production packaging, portable task and
   state descriptors, multi-peer scheduling, warm supervised services, accepted
   deltas, cold start, and end-to-end distributed gates must work outside one
   developer Vite checkout.

## Goal scorecard

| Goal | Status | Audit assessment |
| --- | --- | --- |
| GPU-first local architecture | Substantial, partial | Resident MLS-MPM, retained buffers, hierarchy stages, coupling, admission, and descriptors exist. Some promotion work remains design-only. |
| PeerCompute authority boundary | Partial | Real NodeKernel/ComputeManager/StateManager/GPUHub imports and admission paths exist locally. Default imports are development-machine paths, and the full network/distributed authority path is not complete. |
| SS multilevel physical acceptance | Blocked | Levels, subcycling, merge/split, compaction, sidecars, and coupling landed, but the current two-level path has a severe mechanics explosion. |
| GPU residency and scaling | Partial | Credible same-device work and roughly 8.5k-particle progress exist. Ocean tiled P2G, 48k scaling, active-voxel surface compaction, and portable device-limit handling remain open. |
| Materials and molecular science | Partial | Boys-function precision, molecular optimization, H2O/CO2 vibration data, and Cp(T) advanced. Basis breadth, correlation, periodic/phonon/QHA work, bulk accuracy, and derived barriers remain open. |
| Chemistry and phase behavior | Partial | Reaction discovery, thermal sidecars, gas pressure, topology, and active chemistry advanced. Current alkali-halogen activation is phase-blind, and fluorine remains visually/physically incomplete. |
| Rendering and inspection | Partial | Native surfaces, PBR-like shading, optics, gas-phase field selection, and wireframes improved. One gradient-normal lane is disabled by uniform overwrites; PBR parity is qualitative; per-fragment temperature and thin-sheet handling remain open. |
| Validation and evidence | Unit-green, acceptance-red | 989/0/3 Node result and focused WebGPU compile are strong. Latest full E2E is 57/3/2, mandatory visual gates normally skip, and July 9 lacks a complete durable sequence. |
| Documentation and reproducibility | Stale | `plan/log.md` is the live narrative, but `plan.md`, `tests.md`, implementation status, README, SS queues, and done/todo routing do not represent current state reliably. |
| Production/distributed readiness | Blocked | Production bundle retains absolute `/@fs/home/cos/...` dependencies; network scheduling, replication, service residency, and full distributed gates remain future work. |

## Severity-ranked findings

### P0-1: authoritative two-level SS mechanics is physically unstable

`plan/log.md:39892-39922` corrects an earlier mass-loss diagnosis. Mass was not
destroyed; the probe rounded approximately 2.7 g particle masses to zero. The
matched live-GPU comparison instead showed:

- Plain resident mechanics: the gas cohort remained coherent at about
  `y=[0.99,1.48]`.
- SS two-level mechanics: the same cohort scattered to about
  `y=[0.63,2.73]` in 8 ms, approximately 300 m/s.
- Thermal equalization then behaved consistently for particles that the mechanics
  path had incorrectly thrown into contact.

The coupling shader at `ulg-gpu-abi/src/wgsl.js:14183-14214` derives a coarse
velocity correction and applies it to fine nodes without a mass-share limit or
CFL-style delta bound. This is consistent with the logged tiny-mass failure.
Existing coupling tests (`tests/schroederCrossLevelCouplingGpu.test.mjs:224-301`)
cover constant/random fields and aggregate momentum, but not a mixed-mass cohort
that reproduces the live failure. The hierarchy test at
`tests/schroederHierarchyGpu.test.mjs:8840-8866` uses stubbed output.

The isolated E2E gate beginning at `tests/demo.e2e.mjs:14494` passed during this
audit, but it only requires simulated-time and temperature-extrema movement. It
does not constrain cohort bounds, maximum speed, CFL, transferred momentum,
spatial coherence, or cross-level residual. Its pass therefore does not
contradict the diagnosed mechanics explosion.

Impact: the flagship two-level authority path violates its own conservation and
physical-plausibility acceptance gates. All downstream two-level thermal,
reaction, and visual conclusions are suspect until mechanics is corrected.

### P1-2: translated marching-cubes gradient normals are overwritten to off

`src/runtime/sph/sphMarchingCubesSurfaceAdapter.js:897-900` writes gradient
resolution, scalar offset, enabled state, and stride into the uniform payload.
Lines 902-903 and 911 immediately overwrite resolution, offset, and the enable
flag with zero. The translated surface-row lane consequently receives gradient
normals disabled.

The tests at `tests/sphMarchingCubesSurfaceAdapter.test.mjs:1019-1037` validate
shader text, binding presence, and write size, not the values in the uniform
payload or the resulting normals. The direct native compact-position path has a
separate working payload, so the defect is lane-specific rather than proof that
all surface normals are disabled.

Impact: the July 8 gradient-normal feature is not complete across its advertised
paths, while current tests allow the overwrite regression.

### P1-3: the default production bundle cannot load PeerCompute

`src/runtime/peercomputeBrowserResidentHost.js:150-155` hard-codes six sibling
module URLs under `/@fs/home/cos/projects/peercompute/...`. Dynamic loading is
intentionally excluded from Vite transformation. The audit production build
succeeded but retained five used absolute paths in the emitted JavaScript.

Vite's `/@fs` route is a development-server facility. A normal static production
deployment cannot serve those paths. Host mounting catches the import failure and
reports PeerCompute unavailable (`src/visualization/sphPhaseDemoMount.js:4058-4091`).

This predates Claude's July SS slice, but remains directly relevant to the
application goal: current local authority integration is not a deployable Triad
integration.

### P1-4: the 256 MiB marching-cubes budget is not device-limit-aware

`src/visualization/sphPhaseScene.js:1997-2002` raises the default worst-case
vertex-row budget to 256 MiB. The single-surface resolution-64 case allocates an
estimated 240,045,120-byte output buffer. The renderer's resolution selection at
approximately `sphPhaseScene.js:26727-26740` does not consult device limits.

The repository's own fallback at `src/runtime/webgpuDeviceLimits.js:1-31` treats
128 MiB as the default maximum storage-buffer binding size and only requests more
when the adapter advertises it. The render kernel allocates the full fixed row
buffer; the fact that actual emitted geometry is usually smaller does not reduce
that binding allocation.

The changed unit test only verifies that the estimate fits below 256 MiB. It does
not verify compatibility with `device.limits.maxStorageBufferBindingSize`.

Impact: a conformant adapter with a 128 MiB storage-binding limit can reject the
single-surface native extraction path. This conflicts with portable GPU scaling.

### P1-5: current acceptance evidence is red and incomplete

The latest recorded full browser run is Round 13 at
`plan/log.md:39859-39864`: `57 passed / 3 failed / 2 skipped`. The failures were
service asset smoke, active-metal gas pressure, and the two-level thermal gate
that exposed the mechanics explosion. Later targeted reruns do not constitute a
replacement full acceptance run.

Normal E2E execution also skips both required visual-sequence gates unless
special environment flags are supplied (`tests/demo.e2e.mjs:3277` and 3338;
`package.json:19`). Claude captured many useful scratchpad sequences from July
3-8, and those captures found real defects. They are not a durable, indexed
current-HEAD evidence set. No durable July 9 sequence was found for the final
emissive, PBR, budget, or gas-surface changes.

Impact: unit-green should not be promoted to application-green.

### P1-6: status and test documentation no longer represents the branch

- `plan/plan.md:14-31` still presents a June 29 target and does not route the
  current SS state coherently.
- `plan/tests.md` last changed June 30 and ends with blocked Chromium/WebGPU
  probes (`plan/tests.md:13813-13837`). It omits all July SS and Round 13 evidence.
- `plan/implementation-status.md:4039-4049` still reports a 44-test validation
  era rather than the current 992-test suite.
- `README.md:61-70` says ULG does not yet implement an SPH solver even though the
  mounted application now defaults to GPU-resident MLS-MPM and retains `mech=sph`
  as an alternate path.
- `plan/todo/frontier-todo.md:52-61` calls runtime Cp(T) closed end-to-end while
  also listing runtime Cp(T) as the remaining piece.
- SS queues ask for work that later entries say landed. `fable-handoff.md` remains
  active despite `fable-plan.md` explicitly superseding it.
- The authority-diagram todo does not cover Schroeder/multilevel/cross-level
  authority despite SS routing requiring that coverage.
- Active trackers contain links to plans already moved to `plan/done`.
- `plan/done/physics-behavior-regression-plan.md:1628-1637` declares closure
  before Round 13 exposed the current P0 behavior. It should not be considered
  closed.

Of 99 files in `plan/done`, 62 still contain explicit Remaining, Open, or
Follow-Up sections. That keyword count does not prove all 62 are misclassified,
but it does show that directory placement is not a dependable completion metric.

Recent `plan/log.md` entries are the best current narrative, but they generally
record only a date, not the exact prompt timestamp, exact commands, complete file
lists, or durable artifact paths required by the repository instructions.

Impact: a new agent cannot reliably infer actual readiness from the advertised
plan/status surface, and closed items can hide active P0 work.

### P2-7: alkali-halogen zero activation is phase-blind

`src/runtime/sph/reactionDiscovery.js:458-484` identifies F/Cl and alkali family
membership. Lines 561-584 set zero activation based on identity/family, while
phase requirements are only populated for the water-specialized path. The rule
therefore means alkali plus F/Cl, not alkali plus *gaseous* F2/Cl2 as documented.

If condensed or cryogenic fluorine/chlorine closures are later added, they will
also receive the contact rule. Commit `fd9618e` added no regression test. The
existing Cs/F test at `tests/reactionDiscovery.test.mjs:85-105` checks discovery,
not activation model/value or phase exclusion.

The code remains honest that this is a barrier-not-yet-derived model. It is still
a heuristic, not a first-principles activation closure.

### P2-8: surface/sphere “same PBR recipe” is an approximation, not parity

The native surface shader has meaningful improvements: GGX distribution,
Smith/Schlick terms, scene-like lights, environment contribution, tone mapping,
and stronger emissive output. It is not the same rendering path as the sphere
lane:

- `sphPhaseScene.js:6026-6035` samples a normal-y color gradient as a
  RoomEnvironment stand-in rather than the sphere lane's environment map.
- Transmission changes surface alpha; it does not implement background
  refraction/thickness like Three's `MeshPhysicalMaterial` sphere path.
- Tone mapping is a local approximation.

Commit `b8a744b` added no shader-term, pixel-difference, or side-by-side
quantitative parity gate. Its test change covered the memory budget. A focused
live WebGPU shader test passed, which is compilation/execution evidence rather
than perceptual parity evidence.

Impact: the port is progress, but the log and commit wording overstate equivalence.

### P2-9: molecular generator does not enforce its stated SCF convergence gate

`scripts/material-properties/generate-molecular-vibrations.mjs:59-66` promises
rejection of unconverged SCF energies. The Hessian path at lines 163-165 consumes
`rhf(...).totalEnergyHa` without checking `scfConverged`; final bank validation at
168-189 uses broad plausibility ranges. No test reruns the generator or directly
covers the Boys crossover/MOM generation path.

Current H2O and CO2 artifacts appear plausible, so this is an evidence and
generator-contract gap, not a demonstrated bad artifact.

### P3-10: operational and maintainability debt is accumulating

- Large aggregation files have reached approximately 30,799 lines
  (`sphPhaseScene.js`), 18,431 (`sphMlsMpmGpuStep.js`), 15,556
  (`schroederHierarchyGpu.js`), and 14,693 (`tests/demo.e2e.mjs`). Claude also
  created useful focused modules for coupling, compaction, and count summaries,
  so modularity progress is mixed rather than absent.
- The production main chunk is about 5.17 MiB (1.12 MiB gzip) and triggers Vite's
  chunk-size warning. This reinforces the still-open cold-start/code-splitting
  work.
- `sncu.cpuprofile` is a tracked 238 KiB generated profile added in an unrelated
  steam-optics commit.
- Four long-running Vite servers were responsive during the audit (ports 5173,
  5175, 5283, and 5301). They were left untouched because Claude was actively
  working, but they increase stale-server and cache ambiguity.
- Node 24 was active (`v24.17.0`), but no `.nvmrc`, `.node-version`, or package
  engine constraint enforces the repository's Node 24 requirement.

## Material progress delivered

### Authority, residency, and SS hierarchy

Claude's strongest progress is architectural and implementation-heavy:

- GPU-first hierarchy levels and authoritative switching exist.
- Fine/coarse scheduling, subcycling, shared-force exclusion, and cross-level
  coupling were implemented.
- Merge/split topology, storage compaction, count summaries, and retained rows
  advanced from plan text into code.
- Thermal/reaction sidecars, spatial gas ledgers, pressure interfaces, and product
  handling were integrated into the resident flow.
- StateManager admission, provenance-bearing descriptors, portable task graph
  records, and same-device retained references are present in local paths.
- A serious frozen-state/time-advance bug was found and fixed by correcting the
  active-node/particle alignment logic.

The P0 coupling result means the hierarchy cannot yet be accepted physically, but
it does not erase the amount of implemented infrastructure.

### Physics, chemistry, and materials

Meaningful progress includes:

- temperature-dependent gas heat capacity and thermo-state segment handling;
- reaction discovery, product topology/compaction, gas pressure, buoyancy, phase
  behavior, steam handling, and thermal sidecars;
- Boys-function precision work, DIIS/MOM-related Hartree-Fock work,
  internal-coordinate optimization, and H2O/CO2 vibration-bank data;
- continued use of `scientificValidation: false` and
  `fullPhysicsValidation: false` where the science is not yet validated.

Remaining scientific limits are large and already recognized in the frontier
plans: small STO-3G-like element/basis coverage, missing correlation and analytic
gradients, incomplete reaction barriers, weak bulk-density closures, open
periodic DFT/phonon/QHA work, and material resolvers that often select stored data
rather than derive it.

The cutoff commit `1bd474e` correctly changed gas/vapor surface field selection
to be phase-aware instead of keyed only on the literal `steam` name. Its own log
also records that fluorine still draws zero vertices and that the demo gas EOS can
behave as a stiff cushion. This is good diagnostic honesty, not task completion.

### Rendering and browser experience

Delivered work includes native GPU surfaces, retained draw paths, optics tables,
gradient-normal shader support, degenerate-triangle collapse, material
wireframes, emissive tuning, a custom GGX/ACES-style shader, and higher marching-
cubes resolution. Visual A/B work identified real wall-damping and surface-quality
issues.

Open work includes the translated-lane gradient bug, real environment/refraction
parity, spatial temperature fields, thin splash-sheet stability, fluorine/gas
optical visibility, active-voxel compaction, adaptive surface resolution, and
device-portable allocation.

### Distributed application

The local code now respects more of the intended authority vocabulary and uses
real PeerCompute classes. The end goal is still open:

- sibling checkout imports are not production packaging;
- full StateManager promotion is incomplete;
- network scheduling, peer replication, quorum/admission behavior, and portable
  multi-peer runs are not end-to-end accepted;
- warm Eshkol/MoonLab supervision and cold-start/cache policy remain incomplete;
- the final distributed gate list in the overarching plan has not been met.

## Plan and todo state

The active priority order in `plan/todo/overarching-completion-plan.md:39-71`
remains broadly correct: authority, resident correctness, reaction/gas pressure,
phase/optics, GPU hot loop, material resolvers, inspection, frontier laws, Triad
integration, cold start, validation, and distributed completion.

The practical queue at this audit cutoff should be:

1. Correct or disable the authoritative two-level cross-level correction for the
   demonstrated tiny-mass case.
2. Add a deterministic gate for velocity, cohort extent, CFL/delta transfer,
   momentum residual, and conservation across the exact failing scenario.
3. Reopen the physics behavior regression plan and rerun the full acceptance
   suite, including visual and long-horizon flags, after the fix.
4. Fix the translated gradient uniform overwrite and add payload plus pixel/normal
   evidence.
5. Clamp marching-cubes budgets to actual device limits or land active-voxel
   compaction before treating the 256 MiB tier as portable.
6. Package PeerCompute as a production dependency/entry point instead of `/@fs`
   development URLs.
7. Add direct phase/activation tests for alkali-halogen chemistry and finish the
   molecular gas phase/optical closure needed for visible F2/Cl2.
8. Make PBR claims measurable with compile, pixel, and representative side-by-side
   gates; add spatial temperature and thin-sheet work afterward.
9. Reconcile `plan.md`, `tests.md`, implementation status, README, SS queues,
   authority diagrams, moved links, and `done` semantics.
10. Resume Ocean tiled kernels, 48k scaling, full StateManager promotion,
    resolver/frontier work, cold start, and distributed-network gates only after
    the P0 regression is closed.

## Independent verification

### Passed

- Node `v24.17.0` / npm `11.13.0` confirmed.
- `npm test` at `b8a744b`: 992 tests, 989 passed, 0 failed, 3 opt-in long-liquid
  tests skipped; approximately 5.3 minutes.
- `node --test tests/sphPhaseRenderer.test.mjs` at final cutoff `1bd474e`: 93
  passed, 0 failed, 0 skipped.
- `npx vite build --outDir /tmp/ulg-codex-audit-7-9-build --emptyOutDir`: passed,
  133 modules, approximately 2.1 seconds. Main JavaScript was about 5.17 MiB and
  emitted a large-chunk warning.
- Focused Playwright test `SPH surface draw WebGPU shader compacts vertex rows in
  Chromium`: 1 passed in approximately 9.8 seconds.
- Isolated two-level thermal gate at `demo.e2e.mjs:14494`: 1 passed in
  approximately 25.8 seconds; as explained above, its assertions do not test the
  diagnosed mechanics failure.
- `git diff --check`: passed before the audit-file write.
- `git fsck --connectivity-only`: no connectivity error; dangling objects only.
- Existing application endpoints on ports 5173, 5175, 5283, and 5301 returned
  HTTP success responses.

### Failed, skipped, or not established

- Latest tracked complete E2E: Round 13, 57 passed, 3 failed, 2 skipped in 26.3
  minutes. It has not been superseded by a current clean full run.
- The standard full E2E configuration skips visual sequence and long-horizon
  capture gates unless explicitly enabled.
- No current durable visual artifact sequence establishes the final July 9 PBR,
  emissive, surface-budget, and gas-field behavior.
- Full `npm test` and production build were run at `b8a744b`; the final commit
  changed only `plan/log.md` and `sphPhaseScene.js`. The affected 93-test renderer
  suite was rerun at `1bd474e`, but a second complete Node/E2E/build cycle was not.
- The production build's success exposed, rather than resolved, the absolute
  PeerCompute `/@fs` import blocker.
- An exploratory quoted `rg` command had an unmatched-quote shell error; it was
  rerun correctly. The corrected search found no TypeScript/React application
  dependency and confirmed vanilla ES modules, Vite, Three.js, and WebGPU usage.
- ICC was not refreshed because doing so would have violated this audit's
  one-file write boundary.

No test server was started by this audit. Existing Claude-owned servers were not
stopped while Claude was actively working. Test/build outputs created by the
audit were directed to `/tmp` where configurable.

## Exit criteria for the next credible green checkpoint

A future checkpoint can be called green only when all of the following are true:

- The exact tiny-mass two-level scenario has bounded velocities and cohort extent,
  conservative momentum/energy evidence, and no invalid thermal contact caused by
  mechanics.
- The full current-head Node and browser suites pass, with required visual
  sequence and long-horizon gates enabled and durable artifacts indexed.
- The translated gradient-normal payload is exercised by value and rendered
  output, not shader-text inspection alone.
- Surface memory selection respects actual adapter/device binding limits.
- Current chemistry changes have activation and phase-exclusion regression tests.
- Local PeerCompute authority works from a production bundle without developer
  absolute paths.
- Plan, test, status, README, and done/todo surfaces agree with the verified state.
- `scientificValidation` and `fullPhysicsValidation` remain false until their
  broader scientific gates are actually satisfied.

Until then, Claude's work should be reported as a large and useful development
slice with strong unit health and valuable diagnostics, but with a blocking SS
physics regression and significant acceptance, portability, and documentation
work still open.
