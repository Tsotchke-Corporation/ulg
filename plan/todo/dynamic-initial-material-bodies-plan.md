# Dynamic Initial Material Bodies

Date: 2026-07-15 AKDT

ICC task: `dynamic-initial-material-blocks-20260715`

## Goal

Replace the fixed base/drop setup as the UI authority with an ordered,
versioned collection of axis-aligned initial material bodies. Each body owns a
stable string identity and numeric GPU/render domain plus independent material,
XYZ edge lengths, XYZ center, temperature, XYZ sampling resolution, and XYZ
initial velocity.

## Implemented slice

- `peercompute.ulg.sph-initial-bodies.v0` is the canonical schema and URL
  payload. Identity survives add, duplicate, delete, and reorder operations.
- The control panel renders a dynamic card per body and retains legacy URL and
  preset compatibility through an exact base/drop adapter. Preset-only runtime
  tuning is serialized with custom body edits, and selecting another preset
  reloads its driver/resident policy as one mount-time authority.
- The initializer builds rectangular lattices in ordered body/XYZ order,
  derives mass and thermal state from material closures, conserves each body's
  requested physical volume, and rejects out-of-box or spatially incompatible
  sampling before allocation.
- Preflight, sealed-gas volume, particle diagnostics, material warm rows,
  mechanics/contact/surface rows, and reaction discovery operate over all
  bodies. Chemistry evaluates every unique material pair; contact policy rows
  evaluate every unique body pair, including distinct bodies of the same
  material.
- A resident integer identity sidecar carries body domains through render-row
  production and the SS hierarchy/particle-storage reorder path. Legacy
  base/drop ranges remain a fallback only when explicit identity is absent.
- Incandescent surface authority is keyed by exact
  `(render domain, material, phase)` while retaining a material aggregate for
  legacy consumers. A cold body therefore cannot inherit the glow of a hot
  body made from the same material; legacy base/drop particles mirror their
  synthesized domains 1/2 into the same authority.
- Card commits are debounced for 200 ms. Draft state and URL authority update
  immediately, while a burst of XYZ edits or card operations submits only the
  newest expensive material/reaction closure rebuild.

## Invariants

- Body IDs and domain IDs are unique and order-independent.
- Domain IDs are positive and no larger than `2^24 - 1`, so the value remains
  exact in both the resident `u32` sidecar and the current float32 render-row
  lane.
- Physical scalars must remain finite after float32 encoding. Positive sizes
  and temperatures may not underflow to zero on the GPU.
- The ordered collection has no separate body-count ceiling, but its aggregate
  live-particle count is capped at 262,144 and every XYZ count product must be
  a safe integer. This bounds browser/GPU allocation without restoring a
  fixed two-body shape.
- Cell pitch is approximately isotropic within a body and within a bounded
  ratio across bodies while the runtime has one global smoothing length.
- Particle mass times XYZ particle count equals closure density times XYZ body
  volume.
- Spare product rows use domain zero and cannot mint a body cohort.
- Old links without `bodies` preserve the legacy base/drop interpretation;
  explicit `bodies` state wins over preset and legacy parameters.

## Follow-ups

- Move from one global smoothing length to SS-owned heterogeneous support so
  independently resolved bodies need not share a bounded cell pitch.
- Add rotations and non-cuboid initial volumes only after body-local frames and
  solid proxy ownership follow `plan/todo/sol-critic.md`.
- Replace the remaining float32 render-domain lane with an integer-native
  surface record before allowing domain IDs beyond the exact float32 integer
  range.
- Extend the persistent cold-start reaction cache from one pair record to an
  ordered set of per-pair records for large body/material collections.
- Preserve per-body emissive authority through the deliberately merged
  same-material liquid CPU fallback. Native merged surfaces already retain
  per-vertex temperature; the non-native merged field currently uses the
  material aggregate because its domain is intentionally zero.

## Verification gate

- Schema, initialization, mass/volume, N-body preflight/pressure, all-pair
  chemistry, material/contact rows, GPU identity, SS reorder, and legacy unit
  suites must pass.
- Browser validation must exercise add/edit/duplicate/reorder/remove, URL
  round-trip, a three-body scene, same-material separate domains, all default
  presets, and the native surface path over multiple time samples.

## Verification evidence — 2026-07-15

- Focused initial-body/render regressions: 185/185 passed, including a 50^3
  allocation, same-material cold/hot domains, and legacy hot-drop emission.
- Combined schema, GPU identity, SS hierarchy/storage, render, worker, and
  exact-domain contact suite: 536/538 passed. The two failures are the existing
  gas-cell pressure expectation drift in
  `peercomputeComputeManagerIntegration.test.mjs`; all identity/contact tests
  passed. The delegated identity-only run passed 465/465.
- Browser controls: both new Playwright workflows passed. They cover preset
  runtime replacement, invalid-draft playback stop, arbitrary XYZ fields,
  add/duplicate/reorder/remove, and exact URL/runtime round-trip.
- Physics atomics: 11/11 active tests passed; three opt-in long-horizon tests
  remained skipped. `vite build` completed successfully.
- Native WebGPU visual capture rendered a water, sodium, and iron three-body
  scene simultaneously. A separate dark-lab capture rendered 300 K and 1700 K
  iron domains side by side with only the hot domain emissive. Desktop and
  390x844 mobile control captures kept the XYZ card layout usable.
- The seven-scene standard visual matrix reported no browser-console or visual
  surface issues, and all three deterministic random element pairs plus
  cesium/fluorine passed. It still reports pre-existing scenario-physics
  failures: water-cycle does not reach steam rise/condensation in 3.072 s,
  iron/ice does not cool or raise steam in 2.56 s, and sodium/water reacts but
  reaches 75.42 m/s with J clamped at 0.1. Those are not hidden as control
  validation successes and remain separate physics work.
