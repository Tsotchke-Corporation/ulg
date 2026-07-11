# Fable session handoff — 2026-07-09/10 run

Branch `SS`, tip `6f4bb82` (all work merged locally; nothing pushed to a
remote this session). Final suite on tip: 980+ pass / 0 fail (996-999 tests
depending on round), all four SS e2e gates green. Live server: main tree on
:5173. Snapshot summary also in `plan/STATUS.md`; per-round detail with
measured numbers in `plan/log.md` (Rounds 13-16).

## What this run was

A continuous ~24h agentic run driven by user bug reports, executed as a
sequence of worktree forks (one concern per fork, merged after certification).
Two arcs:

1. **Reaction/gas physics**: from "fluorine is invisible and Cs+F won't
   react" to a self-accelerating fluorine fire with molten cesium in it.
2. **Surface-lane rendering**: from "surfaces look like shit next to the PBR
   spheres" to closed visual parity (task #4 CLOSED).

## Physics merges (chronological, with root causes worth remembering)

- `fd9618e`/earlier — Cs+F activation: alkali + gaseous halogen is a
  contact-class reaction (activation 0), mirroring the active-metal-water
  family. (Pre-dates this handoff's window but is load-bearing context.)
- `3f5b2d9` **SS two-level explosion fix**: delta prolongation read coarse PRE
  velocity as raw momentum/mass; MLS-MPM momentum carries fused stress
  impulses, so near-empty parents produced clamp-difference deltas of
  hundreds of m/s. Fix: CFL-consistent PRE clamp + relative mass-significance
  guard (`schroederCrossLevelGridVelocityDeltaProlongationWgsl`).
- `3e89418` **Gas EOS cluster**: constant `gas_fraction·101325` replaced with
  gauge ideal-gas `P_atm·(ρ/ρ_rest) − P_ambient` (identity: gas rest density
  IS the 1-atm ideal-gas density; T-ratio≈1 is a documented gap); gas J-cap
  64 → 1000 (0.1% rest-density vacuum floor) in BOTH G2P and mechanics
  prediction; momentum-conserving hashed zero-distance twin separation.
- `885ef85` **Frozen-particle fix** (the "stuck particles" plague): wall
  clearance was `0.5·restVolume^⅓` from PHASE volume — gas particles carried
  0.25-1.2 m phantom forbidden shells and pinned at them (floor water,
  mid-air steam, quench ceiling shelf — all the same bug). Clearance now
  capped at half a grid cell: the wall BC operates at grid resolution.
- `21dfa94` **Per-pair contact conduction**: thermal support was a global 2h
  from condensed spacing; coarse gas (F₂ rest radius 1.2 m) was
  conduction-dead by geometry. Now `max(2h, r_i+r_j)` with
  r=(3m/4πρ_rest)^⅓; bins vs exhaustive scan self-selected via derived max
  pair support.
- `7382e0b` **Gas product placement** (chain 407d8d9→b146dfe→2c1d01a→5371cd5):
  gas product mass previously lived FOREVER in event rows (h2 particle count
  was permanently 0). Placement kernel converts events to real particles via
  freed reactant slots, then reserved zero-mass spare rows (distinct role,
  skipped by class-table derivation; GPU kernels needed zero changes — mass≤0
  guards were already the hot-path convention). Condensed products launch at
  the consumed pair's COM velocity (were ejecting at 31 m/s with one parent's
  pre-contact velocity, carrying ~100% of reaction heat away).
- `4055243` **Violence calibration** (probes only): energy magnitude was
  already right (7.5 vs ~8 MJ/kg real for Na+H₂O; KE 0.3% of release); the
  defect was the extent law consuming whole particles per event (127 kg Na
  in 8 ms).
- `ef2d45e` **Interface-flux extent law**: per-substep extent ≤
  ν·A_contact·dt; ν = kinetic-theory effusion ρv̄/4 for gas reactants,
  Clausius-Clapeyron vapor-carrier flux for volatile condensed (H₂O attacking
  Na), 0 for non-volatile condensed (solid-solid interdiffusion = documented
  frontier gap). Na: sustained 1.73 kg/s burn with exact stoichiometry.
  CRITICAL maintenance note: the cap must stay synchronized across ALL SIX
  extent-computing WGSL modules (apply, summary partials, product inventory,
  product events, atom residual, gas species) or ledgers desynchronize and
  mint phantom mass.
- `8b38c43` **Radiative transfer**: gray-body pair exchange
  ε_iε_jσ(T_i⁴−T_j⁴)·A_view on the thermal neighbor structure (view factor
  capped at the parallel-plate contact limit; pairs truncate at 4(r_i+r_j)),
  plus ambient loss to 293 K. Emissivity via Kirchhoff from the DERIVED
  optical closure (fe 0.065 from Drude reflectance, F₂ 0.74 band-limited,
  dielectrics 0.9 universal estimate). Stefan-Boltzmann analytic-cooling
  invariant test guards it. Result: ignition-at-range works; Cs+F spread ~8×
  the flux-only rate (~200× the original); hot products finally cool.
- `fa3d6fb` **E2e environment fix**: vite.config resolved sibling repos
  relative to the config file → worktree-served e2e lost peercompute from
  fs.allow → 403 → authority host failed closed → four host-dependent gates
  "failed" in every worktree run INCLUDING both sides of the original
  baseline A/B. All four gates pass on the tip. Any worktree e2e evidence
  predating 9e76487 is suspect for host-dependent gates.

## Rendering merges (task #4, CLOSED at 0b0520c)

- `61dfc3a` **Gas electronic-band optics**: F was invisible because its
  optics were `blocked` (opacity 0) — the render pipeline was never broken.
  New TRK Gaussian-continuum absorption law; band centers anchored to a new
  spectroscopic bank (`data/material-properties/molecular-electronic-bands.json`)
  via the reference-fallback tier; ΔSCF derivation is the opt-in pure path
  (`deriveGasElectronicExcitation`) — minimal-basis ΔSCF overshoots σ* bands.
  TRAP: reference-fallback provenance inside the PURE derivation path
  silently kills demo boot (strict gate throws with no console error); bank
  data must flow through `referenceBankAnchoring.js` only.
- `09bf72c`+`ec5a01f` (sibling repo) **Vertex-budget clamp**: MC extraction
  offsets/draw counts were always exact; only the allocation was worst-case.
  Budget clamp decoupled allocation from resolution → all surfaces extract at
  full res. `ccca280` raised the ceiling to 96³ (no fps cost).
- `0b1e285` **Per-fragment emissive**: field-row ABI 4→8 floats with a
  density-weighted temperature lane (lane 4; lanes 5-7 now carry splash
  velocity moments); surface WGSL samples it density-weighted-trilinear.
- `e99c410` **Water refraction**: the milky-blob was transmission ADDED ON
  TOP of full diffuse (energy non-conservation); albedo *= (1−transmission)
  + screen-space refraction from a post-opaque canvas copy.
  TRAP: local GPU_TEXTURE_USAGE shims can silently drop flags (COPY_DST) and
  invalidate the whole encoder with no error.
- `59a798a` **Sphere-lane gas colors**: the material-bank PBR warm-input
  table silently OVERRODE derived optics in the optical GPU records; banked
  warm inputs now defer to derived colors.
- `f7a6965` **Env reflections + T⁴ emission**: latlong env from the active
  background image (analytic path byte-identical without one); emission above
  the 2200 K ramp anchor follows T⁴ (was clamped — a 5000 K crown couldn't
  outshine a 2200 K blob).
- `b77a7af` **Splash-shard dispersion law**: per-cell velocity moments in the
  field pass; dispersing cells re-sample metaballs at
  dist²+(σ_v·dt_render)²; coherent volumes are BIT-IDENTICAL (asserted in a
  regression test). Velocity rides the render-row pad lanes.
- `0b0520c` **Closeout**: GGX importance-sampled env prefiltering in linear
  light (the old box chain filtered gamma values — real bug); refraction
  hit-case tinting proven unnecessary by construction (screen copy is taken
  after the background draws — documented so the item stops resurfacing);
  sphere-lane emissive ported to the same T⁴ law.

## ON HOLD (user request, 2026-07-10)

- **Task #7 — third (finer) SS grid level.** Do not resume without the user.
  Items explicitly parked WITH it (documented, not forgotten):
  - In-pool steam-bubble buoyancy (sub-cell bubbles are mass-dominated by
    surrounding liquid on shared grid nodes).
  - Particle-granular emissive patchiness on molten surfaces.
  - Sub-cell gas venting under solids (Cs compression-branch bounce).
  - True sub-resolution splash-sheet breakup.
  - Mild metaball top-face terracing.
  Design constraints already captured in the task: must land after the
  two-level coupling fix (done, 3f5b2d9); all levels must feed ONE render
  field (no per-level draws, seamless per user directive); level assignment
  mass/volume-adaptive.

## Watch items / small leftovers

- One-time canvas-intercepts-click race on e2e gate 6116's second scenario,
  seen once under concurrent suite load, never reproduced. Re-check if it
  recurs in CI-like conditions.
- Derived ionic-synthesis enthalpy runs ~3× low (heuristic lattice model;
  CsF −1.18 vs real −3.64 MJ/kg). Bank-anchor candidate if reaction violence
  ever needs more headroom.
- Thin-diatomic IR ro-vibrational emissivity ≈ 0 (frontier gap, errs
  conservative — H₂/N₂ barely radiate, which is roughly true anyway).
- The radiative ambient sink is ledgered CPU-side (`radiativeAmbientHeatJ`),
  matching the wall-coupling accounting architecture; there is no GPU-side
  thermal energy ledger to extend yet.

## Operational conventions (see also memory: fork-orchestration-patterns)

- One concern per worktree fork; forks inherit context; expect them to STALL
  right before their final commit — nudge via SendMessage. Worktrees are cut
  from a stale base: tell forks the expected SS tip and have them reset.
- Validation stack per merge: full `npm test` in background (`setsid nohup`,
  10-min Bash timeout), targeted kernel/contract tests inline, REAL-browser
  before/after screenshots for EVERY fix (user directive — probe numbers
  alone missed frozen steam that one screenshot exposed), gates 14371+14494 +
  physics atomics for physics changes, sealed-box KE plateau for gas/energy
  changes, random element-pair spot checks per session.
- `plan/log.md` is append-only; merge conflicts resolve by keeping both
  sides. Playwright needs `--use-angle=vulkan --enable-unsafe-webgpu
  --ignore-certificate-errors`; e2e needs the isolated-rerun env (memory).
- Don't edit `~/projects/webgpu-marching-cubes` (file:-dep symlink shared by
  every checkout's server) while any fork is mid-e2e.
- GPU-native validation directive (Agents.md, 2026-07-09): no CPU mirror
  solvers, no CPU-parity acceptance gates; manufactured states, invariants,
  A/B, compact reductions.
