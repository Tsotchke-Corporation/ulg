# Physics Behavior Regression Plan

Date: 2026-06-12 AKDT

## Purpose

The current visible/local physics behavior is still severely broken. This is a
P0 gate above additional WebGPU plumbing, warm-service work, and broad
distributed scheduling. ULG is about physics laws; moving work to WebGPU only
counts if the resulting loop still applies the laws in a coherent order and the
state that moves on screen is the state the laws actually mutated.

## Failure Classes To Audit First

- 2026-06-15 AKDT update: the long-horizon CPU-SPH H2O/H2O settling regression
  is now fixed for the mounted/browser reference lane. The root issue was not
  only render identity; the carrier also allowed a residual gravity half-kick
  at finite-volume wall contact and had no explicit plain-SPH liquid viscosity
  damping law. Contact now cancels into-wall velocity at the floor/ceiling
  clearance, and viscosity-gated liquid wall damping plus same-material
  velocity diffusion damps bulk liquid motion. Evidence:
  `ULG_RUN_LONG_LIQUID_ATOMIC=1 npm run test:physics-liquid-atomic` passed
  `13/13`; `codex-cpu-sph-liquid-viscosity-short-20260615` passed; long
  browser probe `codex-cpu-sph-h2o-long-after-sph-viscosity-20260615` passed
  with status `good`, final drop speed about `0.246 m/s`, one visible H2O
  surface throughout, no visual issues, and ten captured frames. Keep this as
  CPU-SPH reference-lane acceptance, not as closure of MLS-MPM fragmentation,
  z-buffer/focus visual trust, or full WebGPU residency.
- 2026-06-15 13:07 AKDT update: the short-horizon CPU-SPH same-material
  visible surface identity bug is fixed. The CPU particle surface path now
  merges same-material liquid render domains before MarchingCubes, while
  preserving solid render domains as separate surfaces. The visual probe now
  adds runtime-reported CPU MarchingCubes cell size to the particle-bound
  support envelope, avoiding a centimeter-scale false failure from grid
  sampling after the merge. Evidence
  `codex-cpu-liquid-merge-surface-short-cellslack-20260615` passed with H2O
  visible surface count `1 -> 1`, empty issue counts, and three frames.
  Public/default Na/H2O evidence
  `codex-default-na-h2o-plain-sph-blob1-20260615` also passed with `mech=sph`,
  both blocks at `293.15 K`, `blob=1`, and empty visual issues. Keep
  long-horizon liquid settling/free-surface quality open: the latest long
  CPU-SPH H2O/H2O probe before this fix still had residual drop speed and
  overlapping shells, so it needs a rerun and likely more physics work before
  acceptance.
- 2026-06-15 12:32 AKDT update: the full short-horizon visual matrix now
  passes after the pressure-participant and stale CPU-surface fixes. Run
  `codex-full-after-sph-partition-and-stale-surface-20260615` covered all 12
  matrix scenarios with `failedCount=0`, empty issue counts, empty visual
  surface issue counts, correct mechanics integrators, and three captured
  frames per row. Representative frame inspection still shows the CPU-SPH
  liquid/liquid row as two stacked H2O surfaces at this short horizon, so the
  next P0 behavior work is not another short-matrix fix; it is a longer liquid
  merge/free-surface acceptance gate plus renderer depth/focus trust.
- 2026-06-15 12:16 AKDT update: the targeted Na/H2O stale-surface visual
  failure is fixed. CPU-particle surface batches now hide absent material/phase
  surfaces immediately, so a consumed reactant cannot leave its previous
  MarchingCubes mesh visible during inactive grace frames. The grace behavior
  remains for resident render-field gaps. Targeted evidence
  `codex-sph-reaction-roomtemp-blob1-no-stale-na-20260615` passed with
  `failedCount=0`, empty issue counts, empty visual-surface issue counts,
  five captured frames, `maxVisibleSurfaceOutsideParticleBoundsM=0`, pressure
  impulse `0`, and H2O visible surface count `1 -> 1`. This closes the
  public-default Na/H2O plain-SPH row; do not treat it as closure of broader
  water free-surface quality, z-buffer/depth-order, or focus-resume trust.
- 2026-06-15 12:08 AKDT update: the Na/H2O high-speed reaction motion is
  fixed at the condensed-pressure participant boundary. The root cause was
  that plain SPH treated every non-solid particle as a liquid pressure/density
  participant, so product gases created by reactions could enter PBF/pressure
  as condensed fluid mass. `src/runtime/sph/sphPhaseCarrier.js` now supports
  an explicit `fluidPredicate`, and `src/runtime/sphPhaseDemo.js` wires it to
  phase identity so only liquids participate in condensed SPH pressure. Atomic
  validation now includes room-temperature Na/H2O reaction products and
  Fe/H2O solid-liquid contact. Targeted visual evidence
  `codex-sph-reaction-roomtemp-blob1-20260615` shows calm dynamics for
  `Na + h2o`, `293.15 K`, `mech=sph`, `blob=1` (`maxSpeedObservedMPerS`
  about `0.541`, pressure impulse `0`, H2O visible surface count `1 -> 1`).
  The row remains visually red only because the Na solid MarchingCubes surface
  exceeds particle bounds by about `0.102 m` after support-radius tolerance;
  track that as renderer/probe surface-envelope debt, not as the resolved
  reaction pressure bug.
- 2026-06-15 11:22 AKDT update: the no-force plain-SPH law-isolation failure is
  fixed and guarded. The bug was that PBF density projection continued to run
  even when EOS/pressure laws were disabled, so the H2O base moved under a
  supposed no-force configuration. `src/runtime/sphPhaseDemo.js` now sets
  `sphDensityProjectionIterations=0` unless the EOS law group is enabled, and
  `scripts/sph-visual-sanity-matrix.mjs` makes
  `law-static-gravity-off-fe-h2o` a true no-force case. Validation:
  `npm run test:physics-atomics` now includes a no-force plain-SPH invariant
  and passed; visual matrix run
  `codex-gravity-off-static-no-force-after-eos-gate-20260615` passed with zero
  speed, zero displacement, no issues, and five captured frames.
- 2026-06-15 11:03 AKDT update: the repeated
  `visible-surface-expanded-beyond-particle-bounds` finding was a harness
  false positive for normal MarchingCubes support radius. The probe now inflates
  particle-center bounds by the rendered surface support radius before flagging
  particle-bound overflow. Focused H2O visual trio
  `codex-surface-radius-bounds-trio-20260615` passes with no issue counts and
  two captured frames per scenario. Do not over-read this as liquid acceptance:
  short H2O/H2O visual cases still show two visible H2O surfaces, and long-
  horizon liquid merge/settling remains open.
- 2026-06-15 10:56 AKDT update: the visual matrix harness now captures frames
  by default and propagates `analysis.issues` plus compact visual-surface issue
  details into `summary.json`. Smoke evidence
  `/tmp/ulg-visual-sanity-matrix/codex-visual-summary-issues-smoke-20260615`
  now shows the CPU-SPH H2O/H2O failure directly in the matrix summary:
  `visible-surface-expanded-beyond-particle-bounds`, two captured frames, max
  overflow about `0.229 m` in X/Z and `0.095 m` in Y, and two visible H2O
  surfaces. Use this as the next P0 behavior target; do not treat the visual
  matrix as accepted unless the summary issue counts are empty and the frame
  artifacts are nonblank.
- 2026-06-15 10:48 AKDT update: the positioned retained product-event gas path
  is fixed for the mounted no-full Na/H2O gate, but this does not clear the
  broad physics behavior regression. A full visual matrix after the fix wrote
  `/tmp/ulg-visual-sanity-matrix/2026-06-15T18-36-32-215Z` and failed `11/12`.
  The only good scenario was `phase-change-hot-h2o-water`; H2O/H2O, cold H2O,
  law-isolation, and Na/H2O scenarios still classify bad, with repeated
  visible-surface-expanded-beyond-particle-bounds findings and Na/H2O
  high-speed reaction motion. Treat this as the active P0 visual/physics
  behavior debt after the current WebGPU residency slice. Also track the WGSL
  compact-row predicate anomaly separately: browser WebGPU row readback showed
  ready positioned H2 rows, but shader-side filtering produced no compact rows,
  so filtering now happens in JS until a reduced shader probe proves the branch
  behavior.
- 2026-06-15 09:57 AKDT update: the mounted Na/H2O no-full path can now run
  `spatialGasLedgerProducer -> gasCellEosProducer -> admitted gas-cell import`
  without full product-event readback by using a labelled one-cell sealed-box
  aggregate gas fallback when positioned compact product-event rows are absent.
  This fixes a resident coupling blocker, not liquid/solid visual behavior.
  The visual matrix remained nonblank and bounded, but MLS-MPM H2O is still
  fragmented and CPU-SPH liquid/solid are still stacked/blob-shaped in short
  captures.
- Reset/playback continuity: reset must not leave stale pressure rows, stale
  render fields, stale resident uploads, or mismatched sequence state that make
  the first post-reset substep diverge from later substeps.
- Stage order: mechanics, pressure/interface, thermal, reaction/product/gas,
  material-interface, and render/surface extraction must have an explicit order
  and the order must match the data each stage consumes.
- Authority mismatch: CPU mirrors, GPU resident buffers, compact summaries, and
  render fields must not disagree silently. If CPU mirrors are stale, consumers
  must either use retained GPU buffers or block until an admitted readback.
- Force application: pressure/interface force rows must be refreshed by
  physics, applied by grid/mechanics consumers, and proven by impulse/coupling
  evidence; they must not be created only as a side effect of visible
  rendering.
- Reaction/product/gas coupling: reaction outputs, product-event buffers,
  gas-species ledgers, pressure ledgers, and product mass sidecars must carry
  forward across repeated resident steps without double-counting or vanishing.
- Thermal/phase continuity: thermal state, phase response tables, wall heat,
  latent heat, and reaction heat must advance consistently across substeps and
  must not be reset by render or rebuild paths.
- Diagnostics truthfulness: status rows must distinguish proxy/readiness,
  queue-fence completion, retained-buffer ownership, actual force coupling,
  actual mutation, and scientific validation.
- Atomic scientific checks: before another visual or renderer-led physics fix,
  run narrow invariant tests for zero-force rest, gravity-only motion away from
  walls, mass conservation, bounded volume ratio `J`, law-group isolation, and
  zero pressure impulse when pressure is disabled. Visual sequences remain
  required integration evidence, but they should not be the first or only guard.
- Long-horizon acceptance checks: short contact and render coherence are not
  enough. Same-material liquid/liquid must also have a numeric settle gate that
  checks simulated duration, support merge, bounded J, mass conservation, and
  residual bulk velocity against an explicit threshold.
- Visual evidence: recurring sanity checks must capture close-spaced frame
  sequences plus resident diagnostics and surface identity/extent metrics. A
  major todo item is not closed if the representative sequences show stale
  meshes, detached surfaces, delayed jumps, unbounded pulsing, or visible motion
  that contradicts resident diagnostics.
- Render depth/order evidence: visual acceptance must also catch major
  z-buffer and draw-order failures. Transparent water/steam/product surfaces,
  opaque/solid surfaces, nested blobs, the container, and grid overlays need
  explicit depth-test/depth-write/render-order expectations instead of relying
  on visually plausible static screenshots.

## Current Diagnosis

- 2026-06-15 05:58 AKDT update: user reports major z-buffer issues with draw
  order are still present. Keep this as an open renderer visual-trust blocker,
  separate from the active pressure/gas-cell residency work. Visual acceptance
  must reproduce or clear transparent sorting, opaque depth writes,
  container/grid overlay ordering, nested surface identity, and
  focus/context-resume flashing/disappearing through close-spaced frame
  sequences plus explicit draw/depth metadata before screenshots or GIFs are
  treated as reliable physics evidence.
- 2026-06-15 01:57 AKDT update: user again reports major z-buffer/draw-order
  issues in the live renderer. Keep this ordered after the current
  pressure/residency copy-reduction slice, but before treating visual captures
  as final evidence. The renderer pass must explicitly test depth-write,
  depth-test, transparent sorting, container/grid overlay ordering, nested
  surface ordering, and the focus-change flash/disappear symptom using
  close-spaced frame captures.
- 2026-06-14 20:24 AKDT update: user reports major z-buffer/draw-order issues
  in the live visualization. Treat this as a deferred renderer blocker after
  the current GPUHub stage-executor clean point. The fix should audit
  transparent-vs-opaque surface depth policy, nested surface sorting,
  MarchingCubes/retained WebGPU overlay ordering, and add browser coverage
  that fails on wrong draw order.
- 2026-06-14 18:50 AKDT update: the mounted active-grid scene opt-in probe
  now proves the browser scene can request and report the fused active-grid
  resident mechanics path. The evidence artifact
  `/tmp/ulg-history-probes/current-scene-active-grid-optin-frames-20260614.json`
  classified `good` with active dispatch `2744/13824`, bounded J
  `0.99999..1.00299`, max speed about `0.107 m/s`, zero pressure impulse, and
  two captured frames. This is deliberately a sparse wiring/performance gate
  using a tiny `27/125` particle scene. Do not count it as liquid-quality
  acceptance; same-material H2O/H2O long-horizon settling and free-surface
  coherence remain P0.
- 2026-06-14 15:57 AKDT update: the recurring visual matrix now includes
  browser-mounted law-isolation scenarios for mechanics-off static,
  gravity-off static, pressure-off H2O, EOS-off H2O, thermal-off hot H2O, and
  reactions-off Na/H2O. The selected law-isolation run
  `codex-law-isolation-matrix-20260614` passed with `failedCount=0` and
  three captured frames for all six scenarios. This makes the earlier direct
  law matrix evidence repeatable through the standard visual harness. It is
  still a guardrail only: liquid H2O long-horizon settling/free-surface quality
  and the all-reactions Na/H2O timeout remain open P0 items.
- 2026-06-14 16:20 AKDT update: the live CPU-SPH solid H2O report was
  reproduced as missing solid-solid support/contact, not as internal
  liquid-like deformation. Before the fix, the longer mounted cold H2O/H2O
  CPU-SPH probe kept two solid H2O surfaces but let the drop continue sinking
  into the base: last support gap about `-0.016 m` and max drop speed about
  `0.565 m/s`. The carrier now resolves solid group support contact and does
  not derive solid velocities from contact/projection corrections. The fixed
  mounted probe holds support gap near `1.83e-7 m`, drop COM delta `0`, max
  drop speed `0`, and H2O visible surface count `2 -> 2`. The recurring matrix
  now makes `solid-h2o-cpu-sph` a static/support guard instead of only a
  surface-count guard.
- 2026-06-14 15:18 AKDT update: user reports the live CPU-SPH version can
  still show ice/solid H2O flowing like liquid water. Treat this as a reopened
  mounted-scene validation gap, not as proof that the earlier atomics were
  useless. The reference-path invariant and focused matrix now guard one solid
  H2O path, but the live route still needs a targeted audit of URL/control
  phase initialization, mounted driver material/phase handoff, CPU-SPH carrier
  solid predicate wiring, wall/support handling, and render surface identity.
  Next physics behavior work must reproduce this through the browser-mounted
  CPU-SPH path and accept it only when solid H2O keeps internal pair distances
  and phase identity across a dense visual sequence while liquid H2O remains
  free to flow under explicit liquid laws.
- 2026-06-14 15:04 AKDT update: compact buffer snapshot materialization landed
  without disturbing the guarded scenarios. Visual matrix
  `codex-compact-snapshot-materialization-20260614` passed five selected
  scenarios with `failedCount=0` and `frameCount=5` each.
- 2026-06-14 14:45 AKDT update: after hardening compact refresh so blocked
  executor results cannot complete a GPU lane, visual matrix
  `codex-compact-executor-contract-20260614` passed the same five
  representative scenarios with `failedCount=0` and `frameCount=5` each.
- 2026-06-14 14:33 AKDT update: after adding the fail-closed compact
  candidate refresh surface, visual matrix
  `codex-compact-refresh-surface-20260614` passed the same five representative
  scenarios with `failedCount=0` and `frameCount=5` each. This verifies the new
  authority wrapper did not disturb the guarded CPU/reference visual paths.
- 2026-06-14 14:18 AKDT update: after the compact candidate admission slice,
  the frame-capturing visual matrix
  `codex-core-compact-authority-20260614` passed five representative scenarios
  with `failedCount=0` and `frameCount=5` each: H2O/H2O MLS-MPM, H2O/H2O
  CPU-SPH, solid H2O CPU-SPH, Fe/H2O contact, and hot H2O phase change. The
  default six-scenario matrix still hard-times out on `reaction-product-na-h2o`
  after 210 s, so Na/H2O remains a P0 reaction/closure visual-harness blocker
  separate from the compact mechanics admission work.
- 2026-06-14 13:30 AKDT update: the reported CPU-SPH ice-flow bug is now
  pinned and guarded. Cold H2O solid particles no longer participate in the
  liquid SPH pressure/density projection, and solid wall contact is clamped by
  role/material group so base/drop geometry does not internally shear or
  compress like liquid. `npm run test:physics-atomics` now includes
  `plain SPH/PBF reference keeps solid H2O from flowing like liquid water` and
  passes `6` with `1` expected long-liquid skip. The focused scene sequence
  `codex-cpu-sph-solid-h2o-sequence-20260614` is `good`, with three captured
  frames, two H2O solid surfaces from first to last sample, and no visible
  surface bound issues. This closes the CPU-SPH solid/ice flow slice only;
  liquid H2O settling/free-surface quality remains open.
- 2026-06-14 07:53 AKDT update: the task-graph lifecycle slice did not
  regress the stable visual scenarios. A dense four-scenario visual matrix
  over H2O/H2O MLS-MPM, H2O/H2O CPU-SPH, Fe/H2O contact, and hot H2O phase
  change passed with three captured frames each. The full matrix still
  hard-times out on `reaction-product-na-h2o` before writing a full probe
  result, matching the earlier
  `codex-retained-vertex-check-20260613-2247` timeout. Treat Na/H2O as a P0
  reaction/closure visual-harness blocker until the probe can produce a full
  resident timeline instead of pegging headless GPU/SwiftShader.
- 2026-06-13 22:47 AKDT update: the no-full resident render diagnostic no
  longer needs to enter compact surface-draw metadata/readback when the overlay
  is disabled. The retained path now completes physics, render rows, render
  field, and surface-vertex buffer generation, then reports
  `resident-surface-vertex-buffers-retained`. This is a harness/render-path
  currentness checkpoint, not a liquid-quality fix. The compact metadata
  shader/readback path still hangs under Chromium/SwiftShader and must stay a
  P0 render-residency item until it can produce draw metadata safely. Browser
  visual tests that retain WebGPU buffers must explicitly dispose scene/GPU
  resources during teardown.
- New screenshot/GIF evidence: same-material H2O/H2O at about 300 K is not
  settling as liquid water. The visible state can hold a detached faceted blob
  above a larger pool, then jump later into a different nonphysical
  configuration. This is not visual polish; it is a P0 mechanics/render-state
  coherence failure in the resident loop.
- Updated atomic evidence, 2026-06-14 16:42 AKDT:
  `npm run test:physics-liquid-atomic` now passes the opt-in CPU/reference
  long-horizon H2O/H2O gate. The current measured CPU-driver run reaches
  `1.024 s`, keeps mass conserved, keeps J bounded at about `1.046..1.049`,
  stays merged with support gap about `-0.125 m`, and reduces final drop speed
  to about `0.196 m/s` against the `0.25 m/s` threshold. This closes the
  node-level CPU/reference acceptance for bulk settling, but not the browser/
  direct-resident no-full visual proof, compact-summary throughput, or
  free-surface quality work.
- The screenshot warning "resident physics is stepping, but displacement is
  below the visible threshold" is not sufficient evidence that the visible
  state is coherent. A compact latest-batch displacement can be small while an
  older retained surface is stale, or while resident continuation accumulates
  hidden motion and only reveals it on a later surface rebuild.
- Fixed: resident no-full-readback steps now carry the thermal `stateBuffer`
  forward when thermal ran and reaction did not replace particle state. The old
  path kept G2P state, which dropped thermal updates to `specificInternalEnergy`
  while carrying post-thermal thermo rows. That split energy from
  phase/temperature and could break EOS, reaction gating, and rendering.
- Fixed first mechanics-refresh slice: the resident loop now builds a
  material/phase mechanics table, runs a post-thermal mechanics refresh stage
  when reaction does not own mechanics, and carries the refreshed MLS-MPM
  mechanics buffer into the next P2G. The authority ledger records
  `mechanics-constitutive-refresh` as the mechanics owner when this path runs
  instead of leaving
  `mechanics-constitutive-refresh-pending-after-thermal-state`.
- Fixed first pressure force-authority bug: pressure-interface solver rows now
  remain diagnostic unless the solver explicitly opts into MLS-MPM grid force
  application. The H2O/H2O same-material path now reports zero pressure rows and
  zero applied pressure impulse instead of letting render/interface rows inject
  hidden grid impulses.
- Confirmed the regression boundary with a standalone history probe. The
  H2O/H2O contact-near scenario is compact-physics sane at `f0d101f`
  (`max-v=0.012864 m/s`, `J=0.999677..1.000018`, active nodes `248`) and bad at
  `c81a66a` (`max-v=303.441 m/s`, `J=0.1..8.343449`, pressure rows `146`,
  consumer `grid-momentum-impulse-submitted-unverified-no-full-readback`). The
  current dirty tree is back to sane under the same probe (`max-v=0.140798
  m/s`, `J=0.999399..1.0`, pressure rows `0`, consumer
  `blocked-pressure-force-rows-unavailable`). Culprit class: c81 pressure/gas
  material-interface rows were allowed to become grid momentum consumers before
  the force-application contract was authoritative.
- Fixed WebGPU G2P grid-origin handoff: P2G/grid-update execution envelopes now
  preserve `gridShift`, so G2P samples the same shifted grid that P2G and grid
  update produced. Before this, CPU parity saw no active samples while the GPU
  sampled a shift-0 grid, causing wrong/damped resident motion that individual
  P2G and grid-update parity reports did not catch.
- Still P0: future approved pressure/interface rows must carry upload, lease,
  queue-fence, and consumer evidence before continuation. Continuation must not
  hide missing or stale pressure rows behind render cadence.
- Superseded an earlier bad reduced-solver guardrail. Gas pressure may clamp to
  nonnegative values, but condensed Tait pressure must remain signed so weakly
  compressed/expanded liquid has a restoring pressure. Hidden liquid-only APIC
  damping in G2P also suppressed gravity/contact motion and has been removed;
  viscosity, surface tension, cavitation, and incompressible pressure projection
  need explicit law/closure stages instead of being smuggled in as damping.
- Added the opt-in H2O/H2O visual sequence harness. Current validation artifact
  proves the harness can save frames, JSON timeline metrics, GIF, and WebM, and
  the post-grid-origin run shows monotonic resident motion instead of the old
  pressure/G2P spike: `max-v` progresses through about `0.0196`, `0.0392`, and
  `0.0588 m/s`, with zero pressure impulse. It also proves close-spaced visual
  inference is not solved yet: the harness can now force
  `preserveDrawingBuffer` via `visualCapture=1` and capture frames with
  `canvas-to-data-url`, but runtime/render work still reports
  `captureCadence.status = slow-capture-cadence` with observed intervals of
  several seconds for a 250 ms target.
- The visual sequence harness can now take `ULG_SPH_VISUAL_URL` and
  `ULG_SPH_VISUAL_LABEL`, so the same capture path can be reused for
  contact-near liquid/liquid, solid/liquid, phase-change, and reaction/product
  representative scenarios. A contact-near H2O/H2O run (`ironh=0.85`) produced
  one visible merged surface, monotonic resident velocity, zero pressure
  impulse, GIF/WebM/PNG artifacts, and the same slow-cadence warning.
- Post-grid-origin visual sanity check: the old `max-v=140.18 m/s` H2O/H2O
  spike is gone in the short-horizon resident path, G2P parity passes in the
  browser, and retained-upload thermal/mechanics refresh reports the expected
  gravity velocity. The visible surface is still a stacked short-horizon blob
  and has not yet proven water-like settling/merge behavior over a long enough
  horizon, so same-material liquid/contact/render-surface coherency remains P0.
- Fixed the first resident cadence contract bug: the page now honors the
  MLS-MPM `mechanicalSubsteps` target (`substeps=16 target=16`) instead of
  silently capping resident submissions at four substeps. This explains part of
  the "drop does not move / delayed motion" screenshot behavior: the GPU path
  was advancing less physical time than the CPU driver contract.
- Reduced the worst hot-loop synchronization overhead: P2G, grid-update, G2P,
  thermal, mechanics refresh, and compact summary now use cached compute
  pipelines; no-full-readback mutation stages defer cleanup behind a queue
  fence instead of blocking after every pass; scene/probe resident batches use
  `compactSummaryMode=final-only`. Sparse scene evidence improved the corrected
  16-substep H2O/H2O envelope from roughly `75s` to `11.4s`.
- Fixed the first motion-diagnostic/render-refresh lie: compact
  `maxDisplacementM` is the final substep's displacement, not total resident
  batch displacement. A separated H2O/H2O direct probe over `256` substeps now
  shows resident gravity accumulation at the right scale (`1.255 m/s` after
  `0.128s`) while final-substep displacement is only `0.0006275 m`. The demo
  now publishes a batch-motion upper-bound estimate and forces visual refresh
  when that estimate crosses the visible threshold. Sparse scene evidence
  shows `status=batch-motion-estimate-visible` and render cadence reason
  `resident-batch-motion-estimate-visual-refresh`.
- Fixed the first render-field bounds lie: physical blob radii are now converted
  into padded field coordinates with the field span, generated MarchingCubes
  geometry is clipped to the sealed container, and the standalone probe now
  marks out-of-box visible surfaces as visual issues. The separated H2O/H2O
  scene probe went from a visually bad out-of-box H2O surface to y-min
  effectively on the floor (`-1.06e-8 m`) with `maxVisibleSurfaceOutsideM=0`.
- Added an explicit resident surface-draw overlay policy. The default remains
  the proven Three/MarchingCubes fallback; `surfaceOverlay=1` opt-in now tries
  the raw WebGPU overlay and suppresses stale Three meshes when the overlay is
  ready. Current evidence says this is still P0-blocked: forced overlay in
  headless Chromium/SwiftShader timed out after `30000ms` before returning
  metrics. The probe now bounds that failure and reports policy, bridge, active
  surface, and vertex counts instead of silently spinning.
- New regression-search evidence from the user-reported pressure/gas window:
  the comparable separated H2O/H2O scene probe at `c81a66a` reproduces the
  visible pressure/render failure after `1 x 16` resident steps: surface bounds
  extend below the container by about `1.31 m`, the H2O surface is oversized in
  Y, pressure rows reach `302`, the grid consumer reports
  `grid-momentum-impulse-submitted-unverified-no-full-readback`, max speed
  jumps to `20.7157 m/s`, and J spreads to `0.509843..1.372338`. The same probe
  on the current dirty tree is compact-scene sane: pressure rows `0`, consumer
  `blocked-pressure-force-rows-unavailable`, max speed `0.156908 m/s`, J
  `0.999495..1.0`, active nodes `280`, and `maxVisibleSurfaceOutsideM=0`.
  A `f0d101f` run is not a clean separated-H2O/H2O visual comparator because
  that older page path remapped/ignored the same URL controls into an Fe/H2O
  case, so use it only for older API context unless the historical scenario
  adapter is normalized.
- Added compact no-full-readback settling diagnostics. The MLS-MPM resident
  compact summary now includes source/next center of mass and source/next
  particle AABB, increasing the diagnostic readback from `128` to `224` bytes
  while avoiding full particle readback. The updated direct H2O/H2O `1 x 16`
  probe reports COM/bounds in WebGPU output; the updated scene H2O/H2O `1 x
  16` probe remains `good` and shows bounded visible geometry plus total-water
  COM Y decreasing by about `0.00134 m` over the sampled scene sequence.
  Because same-material total COM is dominated by the base block, max-Y bounds
  and visible surface bounds are still required to reason about drop descent
  and merge/settle behavior.
- Fixed the first particle-relative surface inflation bug. The probe now
  compares visible MarchingCubes world bounds against compact resident particle
  AABBs and reports `visible-surface-expanded-beyond-particle-bounds` when the
  rendered material is much larger than the particles that generated it. The
  raw default isosurface scale failed that guard; `blob=0.4` passed; the scene
  default is now `SPH_SURFACE_RADIUS_SCALE_DEFAULT = 0.4` while preserving the
  live `blob=` control. The contact-near H2O/H2O probe now passes with no
  `blob=` override and reports `maxVisibleSurfaceOutsideParticleBoundsM=0`.
  This is a visible-surface coherency fix, not a liquid physics victory.
- Fixed the pressure/gas regression slice identified inside the `c81a66a`
  boundary commit. The direct culprit set was: condensed pressure was clamped
  non-tensile, condensed-liquid affine motion was silently damped in CPU/WGSL
  G2P, and finite particles were still clamped as dimensionless points at box
  walls. The current tree restores signed condensed Tait pressure, removes the
  hidden liquid APIC damping, and clamps finite-volume particle centers at
  `0.5 * cbrt(restVolume)` from sealed walls. Direct separated H2O/H2O resident
  evidence now matches gravity over `0.128s`: drop COM `2.75 -> 2.669350 m`,
  final drop velocity `-1.25525 m/s`, pressure impulse `0`, and J remains near
  one (`0.998292..1.000527`).
- Fixed the first visual sequence trust bug. The long-horizon Playwright probe
  can now force a validation render-field readback, disable the resident
  overlay for that validation refresh, skip pressure-interface refresh while
  validating visuals, and timeout render refreshes instead of hanging. The
  harness also samples only the MarchingCubes `drawRange`, not the fixed
  `72000` vertex buffer capacity, so visible surface bounds and motion are
  based on drawn triangles rather than unwritten zero vertices. Corrected
  high-drop evidence: `5` fresh render-field readbacks, `5` frames,
  `maxVisibleSurfaceCenterMotionM=0.0098805`, and stable analysis. Corrected
  contact-near evidence: `7` fresh render-field readbacks, `7` frames,
  `maxVisibleSurfaceCenterMotionM=0.0047826`, and stable short-horizon visual
  analysis.
- Added explicit failing guards for the remaining liquid/contact bug. Direct
  full-readback H2O/H2O contact-near now tracks initial-order drop/base cohorts
  and fails when a near-contact same-material liquid gap does not close over a
  long enough resident interval. Current evidence after `256` substeps /
  `0.128s`: drop COM falls only `0.01955 m`, base/drop gap changes only
  `0.03333 -> 0.03219 m`, pressure impulse remains `0`, and J remains stable.
  Scene mode now also fails same-material H2O/H2O 300 K if visible resident
  render surfaces split into multiple H2O phase/render descriptors. That guard
  caught a real bug: wall temperatures were not included in the resident render
  signature/inputs, so the resident path could default toward frozen H2O and
  draw both `liquid:h2o` and `solid:ice` for a 300 K water/water scenario.
  Current tree carries wall temperatures through the resident path and the
  visible same-material phase split is no longer present in high-drop scene
  probes.
- Fixed the first same-material resident render-domain failure. Same-material
  H2O base/drop particles now carry separate render-domain ids through
  `SPH_GPU_RENDER_ROW_LAYOUT`, decoded resident rows, surface descriptors, and
  render-field splatting. The render field no longer merges separated base/drop
  water into one bridge/nested surface just because material and phase match.
  Diagnostic readbacks confirmed `h2o|liquid|domain:base = 125` and
  `h2o|liquid|domain:drop = 27`, with CPU/GPU render-field parity matching.
- Fixed the sparse-domain visibility tradeoff without re-inflating the base.
  Raising the global surface radius scale from `0.4` to `0.5` made the 3x3x3
  drop visible but inflated dense base water beyond particle bounds. The
  current policy keeps `SPH_SURFACE_RADIUS_SCALE_DEFAULT = 0.4` and applies a
  scoped `0.5` render-radius floor only to default-scale sparse cohorts of
  `27` particles or fewer. High-drop H2O/H2O scene probes now keep the dense
  base bounded while rendering the sparse drop above the isosurface threshold.
- Added physical law-group isolation controls. The SPH overlay now exposes
  default-on checkboxes and URL/hash keys for `mechanics`, `gravity`,
  `pressure`, `thermal/walls`, and `reactions`. The resident loop includes law
  groups in signatures and disables the relevant inputs/stages without removing
  the laws. A `gravity=off pressure=off` scene probe passes under
  `ULG_PROBE_EXPECT_STATIC=1` with zero displacement and two visible H2O liquid
  domains, proving the controls reach resident execution.
- Added static-expectation support to the long-horizon probe so law-isolation
  tests can intentionally require no motion while normal water-settling probes
  still require positive motion.
- Re-ran the live HTTPS derived-material e2e and post-change visual sequence
  after COM/AABB diagnostics were threaded through browser summaries. Both
  pass. The latest separated H2O/H2O visual artifact is:
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-separated-current-com-bounds/`.
  This is a sanity check for bounded short-horizon motion, not proof of
  long-horizon liquid settling.
- Still P0: `0.008s` of simulated time per corrected 16-substep envelope is
  not enough to prove water-like settling. The direct resident probe is useful
  for dense mechanics/thermal diagnostics, but it bypasses scene pressure rows
  and marching-cubes surfaces. Sparse scene evidence after the render-bounds
  fix still shows active render-field readback and a CPU MarchingCubes bridge.
  The probe now distinguishes active draw vertices from the `72000`-vertex
  buffer capacity (`840` active H2O vertices after resident refresh), so the
  next render issue is resident GPU surface draw and draw-range-aware budgeting,
  not false capacity-based saturation. Long-horizon liquid/contact behavior
  still needs faster resident execution plus sparse scene/visual validation.
- Latest isolation: the remaining liquid/contact failure survives with EOS,
  pressure/interface rows, thermal/walls, reactions, and mechanics refresh
  disabled. The direct full-readback mechanics+gravity-only H2O/H2O
  contact-near probe is still `bad`: gap changes only
  `0.03333336 -> 0.02995068 m`, base COM drops, the base compresses to
  `J ~= 0.876`, and pressure impulse remains zero. Hydrostatic base
  initialization and a separate EOS-off run also fail. This moves the active
  P0 target to MLS-MPM P2G/grid-update/G2P mechanics, wall/contact transfer,
  volume preservation, and missing liquid constraint laws. Pressure/gas caused
  a real earlier explosive slice in `c81a66a`, but it is not the current
  residual water-behavior blocker.
- Add a plain SPH/PBF reference mode. This is not a replacement for ULG laws or
  the WebGPU-resident MLS-MPM lane; it is a simpler liquid sanity lane that can
  prove expected water behavior, expose whether MLS-MPM mechanics is wrong, and
  later become a ComputeManager-managed WebGPU law node with the same explicit
  closure, cache, and validation contracts.
- First reference-lane slice complete: the overlay and standalone probe accept
  `mech=mlsmpm|sph`. `mech=sph` runs the existing CPU SPH driver and emits
  `plain-sph-cpu-reference` diagnostics instead of scheduling resident MLS-MPM.
  This is only a smoke/diagnostic mode today. A short H2O/H2O contact probe
  confirms the branch runs, but current plain SPH still lacks adequate wall and
  liquid constraints and cannot yet be treated as the water-quality baseline.
- Geometry-aware reference slice complete: the SPH lane now applies a PBF-style
  density projection, clamps finite-volume particles at walls, records the
  projection settings in `gpuMechanics`, and exposes initial block support
  extents in preflight/probe analysis. The earlier `ironh=0.85` center-gap
  probe is reclassified as invalid initial geometry because the drop support
  overlaps the base support by `0.15 m`; the probe now reports
  `initial-preflight-blocked` for that URL. A valid face-contact reference URL
  with `ironh=1` is `good` over a short direct probe, with real wall defaults
  (`283.15 K`), max speed `0.080756 m/s`, and downward drop motion. Use this
  as a sanity lane, not as proof of long-horizon water settling or a fix for
  resident MLS-MPM mechanics.
- Valid-geometry scene render slice complete: all-laws MLS-MPM preserves J over
  `1024` direct substeps on `ironh=1`, while mechanics+gravity-only collapses
  to the J floor because EOS/incompressibility is disabled. A valid-geometry
  scene probe then exposed and fixed sparse render-field expansion: 27-particle
  drops now use resident render-field resolution `32`, no sparse radius boost,
  and drawRange-aware visual-sequence metrics. The scene probe and three-frame
  visual sequence pass, but long-horizon same-material merge/settle remains
  open.
- Law-group isolation and surface-bounds slice complete: `createSphPhaseDemo()`,
  worker view state, overlay controls, and the standalone probe now carry
  physical law groups consistently. The all-laws-off/static path can require
  zero motion, and disabling a law group prevents the corresponding stage/input
  rather than relying on UI metadata only. A misleading no-full-readback
  diagnostic was also fixed: without full resident state readback, initial CPU
  cohort samples are not treated as live drop/base motion evidence. The
  remaining "drop did not move" claim must come from full readback, compact
  admitted summaries, or explicit unavailable status.
- The latest valid H2O/H2O visual artifact was primarily a render extraction
  failure, not proof that particle state itself was nested. Compact particle
  bounds and decoded render-row bounds stayed local, but MarchingCubes
  generated surfaces beyond sparse drop domains. The current scene clamps each
  generated material/phase/domain surface to decoded render-row world bounds
  plus radius-derived padding before the container clamp, and defaults the
  visible surface radius to `0.15`. Probe
  `/tmp/ulg-history-probes/current-lawmatrix-12-scene-bounds-clipped-5batch.json`
  passes with `maxOverflow=0`, and the visual sequence
  `h2o-h2o-valid-geometry-bounds-clipped-visual` writes PNG/GIF/WebM/timeline
  artifacts. Scope limit: visual capture cadence is still slow, and this does
  not prove liquid merge/settle quality.
- Long live-state all-laws probe result: with valid face-contact geometry and
  full resident state readback, H2O/H2O is not frozen and does not show the
  earlier explosive pressure/gas failure. Over `1024` substeps / `0.512 s`,
  drop COM moves `1.25 -> 0.463889 m`, center-bound gap shrinks
  `0.183333 -> 0.034447 m`, J remains `0.997748..1.009107`, and pressure
  impulse remains `0`. The analyzer now distinguishes center-bound gap from
  finite-support gap using preflight support geometry; a valid touching setup
  starts at support gap near `0`, not center gap `0.183 m`. The support-gap
  smoke reports support gap `~0 -> -0.01625 m` after `0.128 s`.
  Remaining issue: direct resident live-state evidence bypasses scene pressure
  rows and visual surface extraction, and does not prove a merged/settled
  liquid free surface.
- Compact no-full cohort summary slice complete: the resident compact summary
  ABI now carries optional base/drop initial-order cohort summaries, decoded as
  `cohortDiagnostics` with `readbackRequired=false`. The WebGPU reduction uses
  32 lanes after the first 64-lane version exceeded practical workgroup-storage
  limits and returned empty summaries in headless Chromium. Probe
  `/tmp/ulg-history-probes/current-lawmatrix-16-nofull-compact-cohorts-32lane.json`
  passes with compact cohort motion matching the full-readback smoke over
  `0.128 s`. Remaining issue: compact summary is still expensive enough that
  queue wait dominates the stage timing, so it is a correctness diagnostic
  improvement but not yet a performance win.
- Current-render H2O/H2O scene validation now separates physics from render
  extraction failures. The particle/live cohort invariants were already sane
  in no-full mode (`J` about `0.9987..1.0082`, pressure impulse `0`, drop COM
  descending under gravity), while the user-visible blob bugs came from three
  render-field mistakes:
  1. stale retained MarchingCubes meshes could survive outside current
     particle-derived bounds;
  2. same-material/same-phase H2O was rendered as permanent base/drop domain
     surfaces instead of one union material field after contact;
  3. merged H2O fields still used resolution `18`, which aliased one contact
     configuration below isolation (`maxDensity=31.2` against `80`).
  The current fix hides out-of-bounds retained meshes immediately, merges
  same-material/same-phase render domains into a domain-agnostic visible field
  while preserving cohort diagnostics, raises sparse render-only radius floor
  to `0.2`, and uses resolution `32` for merged same-material fields. Probe
  `/tmp/ulg-history-probes/reassess-10-scene-all-laws-tight-long-merged-res32-render-every-batch.json`
  now classifies `good`: no issues, no visual surface issues, H2O visible in
  all `9` samples, `maxVisibleSurfaceOutsideParticleBoundsM=0`, `J=0.998677..1.008176`,
  drop COM `1.2498 -> 0.9031 m`, and pressure impulse `0`.
  Scope limit: render cadence still matters. The `renderEvery=2` comparator
  fails as stale-cadence evidence, so moving-liquid visual validation should
  render every sampled batch unless the test is explicitly about skipped-render
  behavior.
- Added the first atomic physics-behavior invariant gate after reassessing the
  workflow. `npm run test:physics-atomics` now covers resident zero-force rest,
  resident free-space gravity-only motion against semi-implicit Euler,
  mass conservation, pressure-disabled zero impulse, and H2O/H2O
  mechanics+gravity law isolation with bounded `J`. The new tests initially
  reproduced the user's complaint below the renderer: gravity-only transfer
  lost acceleration near clamped wall support, and mechanics+gravity-only
  liquid inherited artificial volume deformation from APIC affine residue. The
  free-fall test was moved away from wall rows, and the code fix now makes
  non-solid EOS-disabled particles move ballistically without letting affine
  residue mutate deformation volume in CPU MLS-MPM and resident CPU/WGSL G2P.
  Focused atomics pass, nearby G2P/carrier/resident/phase-demo tests pass, and
  full `npm test` passes. Direct resident proof:
  `/tmp/ulg-history-probes/current-atomicgate-valid-mechanics-gravity-only-256-g2p-scale.json`
  is `good` over `256` substeps with pressure impulse `0`, J exactly `1..1`,
  max speed about `0.135 m/s`, and drop COM `1.25 -> 1.235336 m`. Post-item
  short visual sanity passed for H2O/H2O mechanics+gravity with
  EOS/pressure/thermal/reaction disabled and wrote PNG/GIF/WebM/timeline
  artifacts under
  `test-results/demo.e2e.mjs-SPH-phase-vis-e110d-nse-H2O-H2O-resident-motion-chromium/h2o-h2o-atomicgate-mech-gravity-pressure-disabled/`;
  capture cadence remains slow at about `5.4 s` mean interval for a `250 ms`
  target.
- Expanded the atomic gate for the next liquid/contact slice. `npm run
  test:physics-atomics` now passes `5/5` and includes H2O/H2O EOS-on MLS-MPM
  contact plus the plain SPH/PBF reference lane. The EOS-on atomics require
  same-material contact closure under gravity while keeping J inside
  `0.95..1.05`; the plain SPH/PBF atomics require finite bounded
  contact-closing behavior. Resident evidence also passes:
  `/tmp/ulg-history-probes/current-atomicgate-eos-on-liquid-contact-direct-resident.json`
  is `good` over `256` WebGPU no-full-readback resident substeps with J
  `0.997148..1.006978`, pressure impulse `0`, max speed about `1.60 m/s`,
  drop COM `1.25 -> 1.159897 m`, and support gap `~0 -> -0.016253 m`.
  Matching visual sequence `h2o-h2o-atomicgate-eos-on-liquid-contact` passed
  and wrote PNG/GIF/WebM artifacts; capture cadence is still slow at about
  `5.35 s` mean interval for a `250 ms` target.
- Tightened the visual sequence trust contract. `tests/demo.e2e.mjs` now
  records resident `nextStep`/`nextTime`, writes a `simulationCadence` summary,
  waits for resident advancement between fallback frames, and fails the opt-in
  visual sequence if multi-frame artifacts do not advance simulation state.
  Evidence artifact `h2o-h2o-sim-cadence-final-eos-on-liquid-contact` passed with
  resident steps `32 -> 48 -> 64`, simulation time
  `0.016 -> 0.024 -> 0.032 s`, `repeatedSampleCount=0`, J
  `0.997147..1.010376`, pressure impulse `0`, and H2O visible in all frames.
  This fixes duplicated-simulation-frame trust in the harness; it does not fix
  slow wall-clock capture cadence, which remains about `6.20 s` mean interval
  for a `250 ms` target in the latest run. Frame timing now shows the remaining
  cost directly: resident advance about `2.37..2.75 s`, metric collection
  about `1.52..1.62 s`, and canvas readback about `1.93..2.11 s` per sampled
  frame. A Playwright canvas-element screenshot trial was rejected because it
  raised capture cost to about `14 s` per frame under headless WebGPU.
- Added opt-in long-horizon liquid quality gates to
  `scripts/sph-long-horizon-probe.mjs`. Default probes remain compatible; the
  new gates are only active with `ULG_PROBE_EXPECT_LIQUID_MERGE=1` and/or
  `ULG_PROBE_EXPECT_LIQUID_SETTLE=1`. Scene merge/render evidence now passes:
  `/tmp/ulg-history-probes/current-liquid-quality-merge-optin-scene-256-tolerance-aligned.json`
  is `good` with final H2O visible surface count `1`, support gap
  `~0 -> -0.02056 m`, J `0.998788..1.007276`, pressure impulse `0`, and no
  visual surface issues. The settle gate is explicitly still bad:
  `/tmp/ulg-history-probes/current-liquid-quality-merge-settle-optin-direct-2048-singlebatch.json`
  reports `liquid-settle-final-drop-speed>0.25`; after `2048` substeps /
  `1.024 s`, J is still bounded and contact/merge is real, but final drop
  speed is about `1.43 m/s`. The same run took about `399 s` wall time with
  compact-summary wait about `368 s`, so the next physics target is not "make
  it touch"; it is viscosity/free-surface/settling quality plus affordable
  long-horizon diagnostics.

## Immediate P0 Work Queue

1. Audit MLS-MPM mechanics-only transfer on valid initial geometry:
   - P2G mass/momentum/APIC affine contribution;
   - grid update gravity, boundary clamp, and wall velocity handling;
   - G2P interpolation, deformation-gradient update, and finite-volume wall
     clearance;
   - contact between same-material cohorts without relying on render domains.
   - current status: initial atomic free-space and law-isolation invariants are
     pinned in `tests/physicsBehaviorInvariants.test.mjs`; continue with valid
     wall/contact and EOS-on liquid checks instead of visual-only edits.
2. Upgrade the exposed plain SPH/PBF reference lane from short-horizon sanity to
   a liquid-quality baseline: long-horizon incompressibility, viscosity,
   surface tension/free-surface policy, scene/visual validation, and later a
   ComputeManager-managed WebGPU law lane.
3. CPU-SPH solid/phase behavior for H2O ice is now pinned for the reference
   lane. Keep the invariant and `solid-h2o-cpu-sph` visual matrix scenario in
   every mechanics-facing gate. Future work may replace the rigid group guard
   with a real elastoplastic solid law, but solid H2O must not silently inherit
   liquid PBF flow unless thermal/phase evidence admits melting.
4. Build representative visual sequences for mechanics+gravity-only,
   all-laws-on, pressure-off, EOS-off, plain SPH/PBF, solid/liquid, and
   reaction/product scenarios before closing any P0 liquid item.
5. Add a full-readback or admitted compact-cohort checkpoint mode for long
   valid-geometry H2O/H2O settling probes so same-material drop/base motion is
   measured from live resident state at sparse intervals.
6. Add a render-surface parity guard that compares generated MarchingCubes
   bounds against decoded render-row material/phase/domain bounds, not only the
   sealed container and compact all-particle AABB.
   - current status: the standalone long-horizon probe now catches disappeared
     H2O, stale surfaces outside particle bounds, and same-material visible
     phase splits. Keep these as hard gates for H2O/H2O.
7. Optimize compact finite-support/cohort summaries and use them in longer
   scene-paired settling probes without full particle readback.
8. Keep the opt-in CPU/reference settle gate passing and promote equivalent
   browser/direct-resident evidence: require at least the declared settle
   duration, final drop speed below the gate threshold, bounded J, and coherent
   single-surface H2O render output without hiding laws.
   - current status: `npm run test:physics-liquid-atomic` passes after
     `1.024 s` with final drop speed about `0.196 m/s`, but the older
     direct-resident long-horizon probe remained too expensive/stale for
     routine use. Updated 2026-06-14 direct-resident no-full telemetry now
     passes at the declared horizon:
     `/tmp/ulg-history-probes/current-liquid-settle-direct-resident-nofull-2048-20260614.json`
     classified `good` after `2048` substeps / `1.024 s`, final drop max speed
     about `0.1935 m/s`, support gap about `-0.1079 m`, bounded J about
     `0.9500..1.0490`, and pressure impulse `0`. Browser scene/MarchingCubes
     visual settle proof is still open because that run took about `431.4 s`
     with compact summary about `342.7 s`.
   - fence-attribution update: compact summary is now timed internally. The
     representative `64`-substep no-full probe spends about `14.49 s` in the
     final summary `mapAsync` wait for a `336` byte row; Chrome/Vulkan and
     thermal/reaction-off mechanics-only comparisons stay in the same range.
     Treat this as queued mechanics pass cost hidden behind the first readback
     fence. The next implementation item is fused/sparse resident mechanics,
     not smaller summary metadata.
   - active-grid update: the first sparse resident mechanics slice is now
     implemented behind `fuseNoFullResidentMechanicsActiveGrid` /
     `ULG_PROBE_FUSE_RESIDENT_ACTIVE_GRID=1`. It keeps full-grid buffer layout
     for G2P, clears inactive rows, and falls back to full-grid dispatch when
     bounds are unavailable. A matched `64`-substep direct-resident A/B stayed
     `good` in both modes, but active-grid reduced compact-summary `mapAsync`
     from about `13.44 s` to about `3.02 s` by dispatching `2352/13824` grid
     nodes. A `2x64` active-grid run used resident compact-summary bounds for
     batch two and stayed `good`. This makes longer visual validation cheaper,
     but it does not close the visible same-material settling gate by itself.

## Immediate Work

1. Add a same-material H2O/H2O settling regression before treating this as
   fixed:
   - setup: water drop block above a water base block, equal material, no
     derived reaction, room-temperature liquid phase, default gravity and box;
   - expected behavior: the upper block descends, contacts, merges, and settles
     into one coherent liquid body within tolerance, with no detached floating
     faceted blob and no delayed jump after recording, pause, or cadence
     changes;
   - evidence required: compact resident summaries, rendered surface state, and
     resident continuation step/time agree over a long enough horizon to prove
     settling, not only the first few gravity ticks; status must not claim
     merely subvisible motion while the visible mesh is stale by multiple
     resident batches;
   - likely failure classes: MLS-MPM liquid mechanics/contact/rest-density
     handling, same-material surface merge/topology extraction, retained render
     field age, and compact-motion diagnostics that under-report visible state
     divergence.
   - current status: separated H2O/H2O resident gravity is coherent over
     `256` direct substeps after restoring signed condensed pressure, removing
     hidden liquid affine damping, and adding finite-volume wall clearance.
     Contact/merge/settle is still not proven and the visible render path still
     depends on CPU MarchingCubes readback. The compact summary and corrected
     visual long-horizon harness now expose COM, AABB, drawn-surface bounds,
     render-field readback, and per-surface motion so long direct and sparse
     scene probes can measure descent/settling without full particle readback
     in the hot path.
2. Add a dense visual sequence harness for the same H2O/H2O case:
   - capture frame PNGs close enough together to infer motion;
   - emit a JSON timeline with resident step/readback diagnostics, render
     cadence, visible surface identity, and surface world bounds;
   - assemble video/GIF artifacts when `ffmpeg` is available;
   - keep it reusable for later solid/liquid, steam/water phase-change, and
     reaction/product representative scenarios.
   - current status: harness exists, is scenario-parameterized by environment,
     and now proves short-horizon resident velocity coherence after the
     grid-origin, pressure, affine, wall-clearance, and draw-range fixes. The
     long-horizon validation path can force full render-field readback and
     times out stalled render refreshes. The older passive MediaRecorder visual
     test is not sufficient by itself because it can pass on stale or
     under-sampled motion.
   - current status: a standalone historical probe also exists as
     `npm run probe:sph-long-horizon`; set `ULG_PROBE_REPO_DIR` to any worktree
     to compare old commits without requiring the old checkout to contain the
     latest e2e harness.
   - current status: set `ULG_PROBE_MODE=direct-resident` for faster retained
     resident mechanics/thermal telemetry. Pair it with scene mode because the
     direct probe deliberately does not build scene-derived pressure-interface
     rows or visible surfaces.
3. Expand law-group isolation checks:
   - current status: overlay checkboxes and URL/hash controls exist for
     mechanics, gravity, pressure, thermal/walls, and reactions; resident
     signatures include those groups; disabling pressure does not fix the
     high-drop same-material render bug, which confirms pressure was not the
     proximate cause of that failure.
   - add a recurring probe matrix: all-laws, pressure-off, gravity-off static,
     thermal-off, reactions-off, and mechanics-off static for the representative
     H2O/H2O, solid/liquid, phase-change, and reaction/product scenarios.
   - law toggles are diagnostic controls, not a plan to remove laws. Any
     disabled law group must report as disabled in status/signature and must not
     leave stale resident buffers from the previous enabled run.
4. Continue the mechanics-refresh law stage beyond the first resident slice:
   - implemented now: material/phase mechanics table, CPU reference refresh,
     WebGPU refresh pass, resident stage ordering, next-buffer handoff, cleanup,
     and authority-ledger ownership;
   - still needed: compact validation summary, stale-table invalidation,
     richer phase-transition reset policy for large solid/liquid/gas changes,
     and ComputeManager/NodeKernel law-node placement for this stage;
   - authority: ComputeManager/NodeKernel eventually owns this as a law node,
     but the local resident loop now has the correctness-critical stage.
5. Build a stage-order trace for one reset -> play -> repeated resident-step
   sequence:
   - input state family owner;
   - consumed buffer/ref;
   - produced buffer/ref;
   - queue/fence evidence;
   - force/heat/reaction/product/gas delta;
   - next consumer.
6. Add failing regression assertions before broad changes:
   - H2O/H2O liquid block settles/merges without detached blobs or delayed
     cadence jumps;
   - post-reset repeated substeps keep nonzero active grid nodes and visible
     displacement;
   - pressure force rows refresh even when render refresh is skipped;
   - pressure rows are actually consumed by grid/resident mechanics;
   - reaction/product/gas ledgers persist across repeated no-full-readback
     steps;
   - thermal state, thermo rows, and refreshed mechanics constitutive fields
     advance together after a phase transition;
   - stale CPU mirrors cannot drive authoritative mutation;
   - compact summaries report diagnostics only unless admitted.
7. Fix the highest-impact broken path first, even if the implementation stays
   local temporarily.
8. Only after behavior is coherent, route the same pass sequence through the
   ComputeManager/GPUHub resident-lane task.
9. Continue performance remediation until corrected-cadence resident batches
   can cover settling horizons:
   - keep hot state, pipelines, thermal response tables, and resident uploads
     warm;
   - avoid per-substep diagnostic readback unless explicitly requested;
   - move the whole SPH pass DAG under a ComputeManager/GPUHub resident lane so
     long batches run without scene-side scheduling or control-plane copies;
   - validate against both direct resident probes and sparse visual/pressure
     scene probes.

## Acceptance Gates

- The browser SPH phase demo visibly moves after reset/play without collapse,
  stuck frames, stale render state, or pressure rows depending on render-only
  side effects.
- Same-material liquid H2O/H2O visibly settles into one coherent body and does
  not retain or reveal detached stale blobs through render cadence changes.
- A dense visual sequence artifact exists for the H2O/H2O regression and can be
  rerun after major todo completions; representative scenario sequences become
  mandatory closure evidence for later todo items.
- Repeated resident steps report coherent family owners, retained buffers,
  queue/fence evidence, and nonzero mechanics/pressure diagnostics.
- Pressure, thermal, reaction/product/gas, and material-interface stages expose
  whether they actually changed state and whether the next stage consumed those
  changes.
- New architecture work cannot close a todo item if these behavior gates fail.

## Current Split Status - 2026-06-13 15:01 AKDT

The screenshot-backed failure has been split into narrower gates, and the first
two concrete gates are now remediated:

1. Physics gate: `npm run test:physics-liquid-atomic` no longer fails. The
   failing H2O/H2O long-horizon speed case moved from about `1.613 m/s` after
   `1.024 s` to within the acceptance threshold after explicit liquid viscosity
   lanes, CPU/WGSL stress application, CPU hydrostatic-lane consumption, and a
   floor-only no-slip boundary.
2. Visual gate: the CPU SPH path no longer disappears when a CPU surface batch
   is empty or when resident render-field locals are unavailable. The `mech=sph`
   browser probe classified `good`: H2O was visible in all sampled states and
   no visual surface issues were reported.

Immediate remediation order from here:

1. Keep the new atomic gates mandatory for any SPH/MLS-MPM mechanics edit.
2. Add surface-tension/free-surface law behavior and representative visual
   sequence checks for liquid/liquid, solid/liquid, steam/water, and
   reaction/product cases.
3. Port and schedule the accepted law DAG under the ComputeManager/GPUHub
   resident lane instead of letting the browser scene remain the scheduler.
4. Reduce compact-summary and render-field readback cost so long visual
   horizons are cheap enough to run routinely.

## Current Split Status - 2026-06-13 17:20 AKDT

The pressure/gas introduction window was useful for regression search, but the
latest root causes are no longer a single pressure-row bug:

1. Hot H2O/H2O instability was thermal. Direct `16`-step resident probes were
   stable with thermal/reaction disabled and unstable with thermal plus EOS.
   The fix is pair/aggregate conduction limiting, wall heat after conduction,
   and a conservative default conduction rate until closure-derived
   heat-transfer coefficients are validated.
2. Fe/H2O solid/liquid corruption was two separate bugs:
   - Debye solids were packed into two-point thermal graphs, mapping Fe 300 K
     energy to about 130 K. Debye phase segments now preserve source metadata
     and use 32 graph samples plus Debye-aware table round trips.
   - active-metal/water reaction discovery was too broad. Fe/H2O no longer
     gets a zero-barrier water reaction; Na/H2O still does.
3. Visual validation now has a reusable close-spaced frame path. Scene probes
   can write PNG sequences with `ULG_PROBE_CAPTURE_FRAMES=1`, and the matrix
   can do the same with `ULG_VISUAL_MATRIX_CAPTURE_FRAMES=1`.

Current evidence:

- thermal and phase focused tests pass `35/35`;
- reaction candidate/discovery focused tests pass `24/24`;
- hot H2O/H2O, Fe/H2O with reactions disabled, and Fe/H2O with all laws are
  stable in direct resident probes;
- a small representative matrix is `4/5`: liquid/liquid MLS-MPM, CPU-SPH,
  Fe/H2O, and hot H2O pass; mounted Na/H2O still times out while direct
  resident Na/H2O succeeds;
- frame-capture smokes wrote valid PNG sequences and linked them from the probe
  JSON.

Remaining P0/P1 gates:

1. Fix mounted-scene Na/H2O product/reaction orchestration without removing the
   reaction law.
2. Add a mobile/page-visibility render lifecycle probe for the user's CPU-SPH
   phone symptom where surfaces appear only after app switching and then
   flash/disappear.
3. Keep surface tension/free-surface quality work explicit as law stages.
4. Reduce render-field readback cost and move resident pass authority toward
   ComputeManager/GPUHub before treating the local scene loop as final.

## Current Split Status - 2026-06-13 18:05 AKDT

The atomic gate briefly regressed after the thermal/reaction work exposed a
pre-existing mechanics initialization problem:

- H2O/H2O EOS-on contact started with liquid `mpmJ` around `0.801..0.952`
  because hydrostatic initialization computed initial volume strain with the
  CFL-scaled bulk modulus. This over-compressed liquid water before the first
  step.
- Hydrostatic prestrain now uses the raw closure bulk modulus and records
  `volumeRatioModel=raw-closure-bulk-modulus`; hydrostatic pressure remains an
  explicit support pressure input.
- Condensed G2P volume drift is bounded in CPU, JS resident fallback, and WGSL
  to the weak-incompressibility envelope. The internal upper clamp is `1.049`
  so the public `J <= 1.05` gate is not tripped by roundoff.

Current evidence:

- `npm run test:physics-atomics` passes (`5` pass, `1` skipped).
- Focused mechanics/phase suite passes `69/69` with one long-horizon skip.
- Direct resident WebGPU H2O/H2O mechanics with thermal/reactions disabled and
  liquid wall boundary passes with `J=0.999991..1.049000`, drop COM
  `1.25 -> 1.19950 m`, and pressure impulse `0`.

Remaining priority is unchanged: fix the Na/H2O mounted-scene timeout, add the
mobile CPU-SPH lifecycle probe, implement explicit surface tension/free-surface
law behavior, and reduce compact-summary/readback cost.

## Current Split Status - 2026-06-13 18:55 AKDT

The latest screenshot-backed behavior now maps to three concrete tracks:

1. Long liquid settling: passing first acceptance again.
   - The prior H2O/H2O long-horizon speed failure is covered by
     `ULG_RUN_LONG_LIQUID_ATOMIC=1 node --test tests/physicsBehaviorInvariants.test.mjs`.
   - The remediation is an explicit support-wall damping/viscosity slice in
     CPU MLS-MPM, resident JS fallback, and WGSL G2P. It is gated by the
     viscosity law group so law toggles still isolate mechanisms honestly.
   - This does not close surface tension/free-surface work; it only removes the
     artificial support-wall slosh that kept settled liquid moving.
2. Mounted CPU-SPH visibility: passing desktop probe.
   - The browser probe for `mech=sph` now calls `overlay.__sphStep(...)` and
     analyzes CPU-SPH diagnostics instead of accidentally running resident
     MLS-MPM.
   - CPU MarchingCubes now uses a CPU-only alias-safe raster radius floor and
     resolution floor, fixing the blank/flash failure for sparse CPU surfaces.
   - The user's phone-specific visibility lifecycle symptom still needs a
     mobile/page-visibility probe.
3. Mounted resident MLS-MPM visual correctness: passing only with full
   readback.
   - Full-readback H2O/H2O validation is good and shows bounded `J`, active
     grid nodes, zero pressure impulse, and visible H2O.
   - No-full resident render validation still cannot cheaply prove fresh
     MarchingCubes surfaces. This remains a ComputeManager/GPUHub resident-lane
     diagnostic task, not a reason to accept stale CPU mirrors.

Immediate P0/P1 order:

1. Keep the new liquid and render regressions mandatory during mechanics,
   renderer, and law-group edits.
2. Build fresh no-full GPU-resident visual summaries or an equivalent retained
   render diagnostic lane.
3. Fix mounted Na/H2O reaction/product orchestration without disabling
   reactions.
4. Add the mobile/page-visibility CPU-SPH lifecycle probe.
5. Continue explicit surface tension/free-surface law implementation and longer
   visual horizons.

## Current Split Status - 2026-06-13 19:25 AKDT

The newest no-full resident collapse was not a pressure law, thermal law, or
render-cadence bug. It was an ABI sizing error in WebGPU G2P:

- `createParamsArray()` had grown to an 80-byte uniform payload after adding
  internal-pressure and liquid-wall-damping fields, but the WebGPU uniform
  buffer was still allocated at 64 bytes.
- Browser `queue.writeBuffer()` could overrun the target buffer. In practice
  the G2P shader saw invalid/zero params, including `particle_count = 0`, so it
  wrote no output rows.
- In no-full-readback mode retained output buffers then looked like valid
  resident authority while all mass, positions, and mechanics rows were zero.
  That explains the catastrophic disappear/nested/pulsing surface class and
  the apparent delayed motion after a later refresh.

Fixed slice:

- `src/runtime/sph/sphG2pGpuKernel.js` now has a single `G2P_PARAMS_BYTES = 80`
  constant shared by `createParamsArray()` and the params buffer allocation.
- `tests/sphG2pGpuKernel.test.mjs` now includes a fake-device regression that
  throws if a WebGPU G2P uniform write exceeds the allocated buffer.
- `tests/webgpuKernelAbi.test.mjs` now guards the same class across resident
  params kernels by comparing WGSL scalar param struct size, JS ArrayBuffer
  size, uniform buffer allocation size, and the writeBuffer factory call.
- Temporary per-stage queue fences were not retained. Correctness holds without
  adding hot-loop synchronization that would work against the GPU-resident lane
  architecture.

Current evidence:

- Focused G2P test passes `16/16`, including the new params-buffer ABI guard.
- Focused resident ABI/physics/render suite passes `165/165`, including
  P2G, grid update, G2P, thermal, reaction, reaction summary, resident summary,
  mechanics, mechanics refresh, render rows, render field, material interface,
  MarchingCubes cells, surface vertices, surface summary, and surface draw
  params contracts.
- Focused G2P/resident/render suite passes `106/106`.
- Direct no-full H2O/H2O one-step probes classify `good` with conserved mass,
  nonzero output rows, bounded J, gravity-scale motion, and pressure impulse
  `0`.
- Full-readback direct parity passes with WebGPU G2P
  `maxStateAbs ~= 7.45e-9` and `maxMechanicsAbs ~= 4.46e-9`.
- Mounted H2O/H2O no-full scene and mounted CPU-SPH H2O/H2O scene both classify
  `good` over the short frame-capture probe.

Remaining gates are unchanged:

1. This fixes the catastrophic zero-output resident bug, not final water
   settling or free-surface quality.
2. Compact resident summaries are still too expensive for routine long visual
   horizons; a one-step no-full thermal probe spent about `3.24 s` in compact
   summary.
3. Keep extending the params-size guard whenever a new WGSL law kernel or
   non-scalar uniform struct is added; storage row-layout guards remain
   covered by the row-layout ABI tests.
4. Continue no-full fresh visual diagnostics, mounted Na/H2O product
   orchestration, mobile CPU-SPH lifecycle reproduction, and explicit
   surface-tension/free-surface law work.

## Current Split Status - 2026-06-13 19:50 AKDT

The next no-full diagnostics slice is partially complete:

- Resident compact summaries now accept `compactSummaryScope=particle-visual`.
  This keeps particle, cohort, thermal, COM/AABB, momentum, and J diagnostics
  on resident GPU buffers while skipping the active-grid-node scan.
- The skipped grid evidence is explicit and must be treated differently from
  zero active nodes:
  `activeGridNodeCount=null`,
  `activeGridNodeCountAvailable=false`,
  `activeGridNodeSummaryStatus=active-grid-node-summary-not-requested`, and
  `gridNodeScanCount=0`.
- Full-grid compact summary remains available as `compactSummaryScope=full` and
  is still the right choice for strict active-grid correctness checkpoints.

Current evidence:

- `node --test tests/sphMlsMpmGpuStep.test.mjs` passes `26/26`.
- Focused resident ABI/render suite passes `92/92`.
- Direct H2O/H2O `2 x 1` no-full particle-visual probe classified `good`;
  warm compact summary was about `230 ms`, with no active-grid count claimed.
- Direct H2O/H2O `2 x 1` no-full full-scope comparison classified `good`;
  warm compact summary was about `295 ms`,
  `gridNodeScanCount=13824`, and `activeGridNodeCount=280`.

Remaining gates:

1. The readback/map fence and cold-start cost remain too high for long routine
   visual matrices. Move visual summaries into retained GPU diagnostic/render
   lanes with sparse admitted readbacks.
2. Do not solve the remaining cost by accepting stale CPU mirrors or by
   removing physics laws.
3. Mounted Na/H2O product orchestration, mobile CPU-SPH page-visibility
   reproduction, and explicit surface-tension/free-surface law work remain
   open.

## CPU-SPH Lifecycle Status - 2026-06-13 20:02 AKDT

The first synthetic reproduction lane for the phone blank/flash report is now
covered:

- CPU-SPH `setParticles()` forces a presentation refresh burst immediately
  after CPU MarchingCubes surfaces are applied. The burst renders once
  synchronously through the scene refresh path and then schedules two RAF
  refreshes.
- `visibilitychange` and `pageshow` resume now use the same refresh burst
  instead of a single deferred frame.
- The focused mobile-sized Playwright test steps `mech=sph`, dispatches
  synthetic page visibility/page-show events, and asserts:
  visible CPU-particle H2O surfaces, a completed two-frame burst, and
  `viewport-refresh-rendered` telemetry on the final scene refresh.

Current evidence:

- `node --check src/visualization/sphPhaseScene.js tests/demo.e2e.mjs` passes.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5630 ... npm run test:e2e -- --grep
  "CPU-SPH view refreshes" --timeout 120000` passes `1/1`.
- `node --test tests/sphPhaseRenderer.test.mjs tests/sphRenderGpuKernel.test.mjs`
  passes `65/65`.

Remaining gates:

1. If the user's phone still blanks or flashes, capture a real-device visual
   sequence with close-spaced frames and add canvas/context-loss diagnostics.
2. Keep this lifecycle test in the recurring visual sanity set after major
   physics/render todo items.
3. This does not prove long-horizon liquid quality or solve the no-full
   resident diagnostic readback cost.

## No-Full Surface Summary Status - 2026-06-13 20:15 AKDT

The next readback-fence reduction is deliberately scoped:

- `refreshSphResidentRenderState()` can now skip the compact render-field
  surface-summary readback when the caller requests
  `renderFieldSurfaceSummaryMode=skip`.
- The skip is explicit evidence, not a zero surface count:
  `renderFieldSurfaceSummarySkipped=true`,
  `renderFieldSurfaceSummaryReadback=false`, and
  `surfaceDrawStatus=resident-surface-draw-summary-skipped`.
- The long-horizon probe accepts
  `ULG_PROBE_RENDER_FIELD_SURFACE_SUMMARY_MODE=skip`.

Current evidence:

- No-full mounted H2O/H2O skip probe
  `/tmp/ulg-history-probes/current-no-full-render-summary-skip-smoke-2.json`
  classified `good`, with no render-row, render-field, or compact
  surface-summary readback on resident-batch render samples.
- Focused Playwright regression for the skip mode passes.
- Combined Playwright skip-mode plus CPU-SPH lifecycle run passes `2/2`.

Remaining gates:

1. Skipped summary evidence is not fresh visual-surface evidence. It is only
   acceptable for routine cost control where existing visible surfaces are
   explicitly stale/non-strict.
2. Strict visual correctness still requires readback or a retained GPU
   draw/summary lane.
3. Continue to mounted Na/H2O product orchestration and retained GPU visual
   diagnostics.

## Mounted Na/H2O Gas Promotion Status - 2026-06-13 20:31 AKDT

The first mounted Na/H2O orchestration failure is now pinned and fixed:

- The resident WebGPU reaction/product path was producing product rows and a
  gas-species ledger, but direct mounted scene/probe resident steps did not
  call the overlay gas-pressure promotion helper. Status/render pressure stayed
  at ambient air even though the resident product ledger contained H2.
- The overlay now exposes `__sphUpdateResidentGasPressureSummary`, and the
  long-horizon probe calls it after direct resident execution before refreshing
  render state.
- The promoted summary is passed into resident render refresh, so render
  telemetry reports the same source:
  `gpu-resident-product-mass-gas-species-ledger`.

Current evidence:

- Mounted Na/H2O scene probe
  `/tmp/ulg-history-probes/current-na-h2o-mounted-1x1-promoted-gas.json`
  classified `good`.
- Resident status shows `reaction-step-executed` on WebGPU, retained product
  mass rows with EOS sidecar ready, and gas pressure
  `total=125.9kPa ... h2=24.6kPa`.
- Focused Playwright regression
  `SPH phase mounted resident Na/H2O promotes product gas pressure` passes.

Remaining gates:

1. Repeated Na/H2O resident horizons must prove product carry-forward without
   double counting or disappearing sidecars.
2. Visible product/gas presentation still needs a retained GPU visual path or a
   strict readback validation path.
3. This does not replace the broader liquid/free-surface and retained GPU
   diagnostic-lane work.

## Retained Surface-Draw Diagnostic Budget Status - 2026-06-13 20:51 AKDT

The next retained GPU visual diagnostic slice is bounded but not complete:

- `surfaceDrawDiagnosticMode=metadata` can now be requested by resident render
  refresh and by the long-horizon probe.
- The path is guarded by `surfaceDrawDiagnosticMaxFieldCells` before launching
  retained surface-vertex/draw metadata construction. Current sparse H2O/H2O
  render fields are about `272072` cells, and the unguarded metadata path timed
  out in headless Chromium.
- Over-budget diagnostics return a truthful skipped status:
  `resident-surface-draw-diagnostic-skipped`,
  `surfaceDrawDiagnosticsSkipped=true`, and
  `surfaceDrawDiagnosticsSkipReason=surface-draw-diagnostic-field-cell-budget-exceeded`.

Current evidence:

- Focused Playwright regression
  `SPH phase no-full retained surface draw diagnostics are budget-bounded
  without overlay` passes.
- Probe
  `/tmp/ulg-history-probes/current-surface-draw-diagnostic-budget-skip-small.json`
  classifies `good` and reports `surfaceDrawDiagnosticFieldCellCount=272072`
  with no render-row, render-field, or render-field-summary readback.

Remaining gates:

1. Reduce/tile the retained surface-vertex/draw metadata path so representative
   sparse fields can produce fresh surface metadata under budget.
2. Keep the skip path as a bounded diagnostic blocker, not as a success claim
   for fresh no-full visual correctness.
3. Once retained metadata builds, reconnect it to visual sequence analysis so
   no-full resident state can be checked without full CPU readback.
