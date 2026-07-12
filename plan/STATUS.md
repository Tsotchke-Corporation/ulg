# Audit Status - 2026-07-11 GPU-Resident Refactor

Branch `gpu-resident-physics-refactor`, committed HEAD `b4d1a38` plus the
current worktree. The branch is materially improved but not complete.

- Native presentation is one triangle-surface canvas with packed generation-
  owned normals, zero visible point fallback, alpha-one unblended depth-writing
  PBR, and a restored native opaque background pass.
- A bounded two-in-flight presentation window replaced the per-frame whole-
  queue fence. The accepted thickness-aware route measures 60.296 FPS; the
  pre-fix path measured about 29.5 FPS.
- Refraction requires an exact, nonblocked, provenance-bearing blue/green/red
  spectral record. A same-encoder `depth32float` backface pass supplies
  geometric thickness and adds no submit; invalid rear geometry fails closed.
- The current molecular response is reduced and scientifically unvalidated:
  STO-3G RHF independent-particle dipole response plus Lorentz-Lorenz, not a
  complete first-principles dielectric solution.
- Accepted visual checkpoints are `/tmp/ulg-background-native-after2.png` and
  `/tmp/ulg-thickness-refraction-live2.png`. They do not substitute for the
  still-missing manufactured thickness/metamorphic and fresh standard matrix
  gates.
- The 300k resident reaction path removed 192,000,000 bytes/substep of host
  zero initialization/upload. Warm reactive physics remains about 48-52
  ms/substep.
- P0 remains parallel product carrier/placement work and elimination of
  redundant 40-radix-pass neighborhood generations. P1 remains exact live-
  prefix indirect dispatch, retained thermal indexes, and persistent stage
  workspaces.
- Do not introduce a CPU mirror/reference solver or CPU parity gate. Final
  acceptance uses GPU manufactured states, invariants, metamorphic same-device
  executions, fixed-size reductions, and close-spaced native visual sequences.

`SURF-4`, `OPTICS-0`, `OPTICS-1`, `NEIGH-0`, `LANE-0`, `SS-0`, and the overall
refactor remain open until their declared validation and production-integration
gates pass.

## Historical Audit Status - 2026-07-10 18:13 AKDT

Branch `SS`, reviewed at `d5319c2` plus the standard-scenario audit slice.

- Fable's reaction/gas/radiation work is substantive, but SOL-0 through SOL-6
  coherent-solid work remains unstarted. The third SS level remains on hold.
- The SPH drawer now has shared water-cycle, molten-iron/ice, sodium/water, and
  cesium/fluorine presets. The same immutable records drive the standard test.
- Standard evidence is no-full resident WebGPU plus a fixed 5,184-byte GPU
  reduction. No particle-state or thermo buffer is mapped.
- The seven-scenario run fails production presentation: the native canvas is
  surface-like initially and uniform after the first refresh; 109 destroyed
  indirect-buffer submissions were recorded. A shared offscreen bind-group
  defect was fixed, and offscreen validation passes, but that is not visible
  acceptance.
- Quantitative result: Cs/F is strongly exothermic and cools; water vapor does
  not rise/condense; Fe cools too little and steam does not rise; Na/H2O forms
  products and heats but misses the hydrogen-rise gate. Time-zero GPU capture
  is still absent.
- The reordered objectives and performance findings are in
  `plan/todo/sol-critic.md`. No physics optimization was implemented.

# Session status — 2026-07-10 (surface-lane + physics run)

Branch `SS`, tip `0b0520c`. Full suite on tip: **993 pass / 0 fail**, all four
SS e2e gates green. Live server: https://<vpn-host>:5173 (main tree; port 5179+
fork servers are gone).

## Surface-lane (task #4) — done items
1. Sphere-PBR parity port (GGX, scene lights, split-sum env, ACES) — b8a744b
2. PBR transmission, zero artistic alpha — f266aa3/e5dc503
3. Vertex-budget clamp; extraction uncapped to full res — ec5a01f + 09bf72c
4. Field resolution ceiling 64 → 96 (smoother, no fps cost) — ccca280
5. Per-fragment emissive temperature (molten core vs cooled crust) — 0b1e285
6. Water refraction + transmission energy conservation (milky-blob fix) — e99c410
7. Sphere-lane gas colors (bank warm-inputs defer to derived optics) — 59a798a
8. Background-image env reflections + T^4 emission above 2200 K — f7a6965
9. Splash-shard velocity-dispersion law (spray → droplets, coherent drops
   bit-identical) — b77a7af

**Task #4 CLOSED (0b0520c):** GGX-exact env prefiltering landed (linear-light
importance sampling, 176 ms build, lobe-shape unit tests); refraction
hit-case tinting proven unnecessary (screen copy is already env-lit by
construction — documented so it stops reappearing); sphere-lane emissive now
follows the same T^4 law as the surface lane. Only mild top-face terracing
remains, parked with the on-hold task #7 (finer SS level), as is true
sub-resolution sheet breakup.

## Physics landed this run
- SS two-level explosion fix (CFL-consistent prolongation) — 3f5b2d9
- Gauge ideal-gas pressure, gas expansion floor, twin separation — 3e89418
- Frozen-particle fix (phase-volume wall shells → half-grid-cell) — 885ef85
- Per-pair contact conduction support — 21dfa94
- Gas product placement (H2 exists; products stay at interface) — 7382e0b
- Interface-flux reaction extent law (Na: 8 ms blast → 1.73 kg/s sustained,
  exact stoichiometry) — ef2d45e
- Radiative transfer (Kirchhoff emissivity, Stefan-Boltzmann invariant;
  Cs+F ignition-at-range, ~200x the original reaction rate) — 8b38c43
- E2e environment fix (worktree vite fs.allow) — fa3d6fb

## Open
- Task #7 third SS grid level: ON HOLD per user (2026-07-10)
- Cosmetic surface-lane leftovers above
- Watch item: one-time canvas-click race on gate 6116 under CPU load

10. Surface-lane closeout: GGX env prefilter + T^4 sphere emissive parity — 0b0520c
