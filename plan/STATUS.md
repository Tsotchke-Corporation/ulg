# Session status — 2026-07-10 (surface-lane + physics run)

Branch `SS`, tip `b77a7af`. Full suite on tip: **993 pass / 0 fail**, all four
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

**Remaining (cosmetic tier):** GGX-exact env prefiltering (mips are
box-filtered → slightly soft reflections), env tint on the refraction hit
case, sphere-lane emissive legacy scale above ~2760 K, mild top-face
terracing from the metaball field. True sheet breakup is parked with the
on-hold task #7 (finer SS level).

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
