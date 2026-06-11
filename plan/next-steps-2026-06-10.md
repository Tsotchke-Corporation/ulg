# Next Steps - SPH Chemistry and Material Demo

## P0 - Keep the Na + H2O Reaction Demonstrable

- Keep `npm run test:e2e -- --grep "SPH phase demo"` green; it now covers the
  continuous volume renderer and the room-temperature NaOH reaction product
  surface.
- Use `test-results/sph-naoh-room-temperature-reaction.png` as the current visual
  reference.
- Do not publish or push until the user explicitly asks; commits should stay
  local.

## P1 - Remove Browser Main-Thread Chemistry Stalls

- Move `discoverReactions()` into a Web Worker or service worker path.
- Add a visible "computing derived chemistry" status while HF/UHF runs.
- Cache reaction discoveries by unordered material pair and closure provenance
  hash, not only material names.
- Keep the failure path explicit when the molecular basis cannot cover a pair.

## P2 - Generalize the Status and Preflight UI

- Split the legacy Fe/H2O thermodynamic preflight from generic two-material
  runtime status.
- Replace fixed `masses (kg): Fe / ice / air` rows with role-based rows:
  `drop`, `base`, `products`, and `gas`.
- Keep `material phases` prominent so reaction products and phase changes are
  visible without inspecting internals.

## P3 - Tighten Material Applicability Claims

- Filter or label selectable elements by the actual closure model:
  free-electron metal, reference compound, molecular gas, unsupported.
- Surface `metallicModelApplicable`, basis coverage, validation flags, and
  blockers in the UI.
- Prevent unsupported elements from silently entering jellium-derived paths when
  the model is physically inappropriate.

## P4 - Improve Reaction Physics Without Faking It

- Represent byproducts explicitly, especially H2 from metal + water reactions.
- Add gas pressure/volume contribution from reaction products instead of folding
  all byproduct energy into heat.
- Replace the remaining reduced kinetic treatment with a derived barrier/rate
  path: transition-state estimate, constrained geometry scan, or short BO-MD
  contact sampling. Active-metal + water is now phase-availability gated, but
  still lacks a first-principles rate constant.
- Add stoichiometry beyond the current small formula-unit cap while keeping HF
  cost bounded through caching or lower-fidelity screening.

## P5 - GPU-Resident Runtime Path

- Move MLS-MPM particle buffers, phase/EOS fields, and reaction-state buffers
  toward WebGPU residency.
- Keep closure tables and reaction/product parameters GPU-readable.
- Avoid CPU readback in the render loop except for telemetry and validation
  snapshots.
- Use the current Three.js MarchingCubes path as an interim visual reference,
  then evaluate a WebGPU screen-space fluid/material renderer closer to the
  PeerCompute MLS-MPM demo.

## P6 - Validation and Documentation

- Add browser tests for a non-reactive pair, a basis-blocked pair, and H2/O2.
- Add a headless convergence check for particle counts and reaction product mass
  at multiple particle resolutions.
- Rebuild `docs/` with `npm run build:pages` only when publishing the standalone
  demo is intentional.
- Update `plan/frontier-todo.md` after the chemistry worker and generic-status
  work land.
