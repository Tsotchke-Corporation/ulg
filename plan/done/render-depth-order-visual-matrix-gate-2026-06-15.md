# Render Depth/Order Visual Matrix Gate - 2026-06-15

Status: done for recurring metadata validation.

Summary:

- Extended `scripts/sph-long-horizon-probe.mjs` to capture per-surface render
  layer, object/base render order, render-order policy, material depth-write,
  material depth-test, and container grid/wire render policy.
- The probe now fails visual analysis with `render-depth-order-visual-trust`
  when transparent surfaces write depth, opaque surfaces fail to write depth,
  transparent same-layer surfaces use hashed object render order, or the
  container overlays lose their non-depth-writing order.
- Extended `scripts/sph-visual-sanity-matrix.mjs` compact issue summaries with
  these render metadata fields.

Validation:

- PASS: `node --check scripts/sph-long-horizon-probe.mjs`.
- PASS: `node --check scripts/sph-visual-sanity-matrix.mjs`.
- PASS:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "transparent|draw order|depth|render order"`
  (`35/35`).
- PASS: visual row `codex-render-depth-policy-cpu-sph-20260615`.
- PASS: visual row `codex-render-depth-policy-solid-liquid-20260615`.
- PASS: combined visual row
  `codex-render-depth-policy-two-row-refresh-20260615`.

Remaining:

- This closes the recurring matrix metadata blind spot. Real-device
  focus-resume flashing and pixel-level z-buffer artifacts still need a
  dedicated capture/probe if they reproduce.
