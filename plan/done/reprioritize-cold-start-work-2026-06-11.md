# Reprioritize Cold-Start Work

Completed routing note: moved from `plan/todo/` to `plan/done/` on
2026-06-14 after the active priority index absorbed this ordering.

Date: 2026-06-11 AKDT

## Recommendation

Move cold-start performance polish toward the end of the todo list. Keep only
the cache correctness contracts in the near term:

- cache schemas;
- provenance and generator hashes;
- invalidation rules;
- worker/off-main-thread boundaries;
- visible CPU-closure warnings.

Do not spend more implementation time on cold/warm/clear timing polish,
stale-record browser probes, or GPU warmup persistence until the core physics
contracts stop moving.

## Preferred Immediate Order

1. Reaction inventory-backed product storage.
2. Atom, mass, and charge residual ledgers.
3. Pressure feedback into forces and wall ledgers.
4. Phase-resolved steam and sealed-gas microphysics.
5. Hot-loop GPU residency and readback reduction.
6. WebGPU material derivation kernels.
7. Cold-start profiling, stale-record browser probes, warmup persistence, and
   cache optimization polish.

## Reasoning

Reaction inventory, pressure coupling, steam microphysics, and WebGPU material
resolver work will continue changing cache keys, persisted artifacts, and ABI
rows. Optimizing cold start too early risks reworking the same cache and warmup
paths after every physics/schema change.

Treat cold-start caching as a correctness/provenance contract for now, not the
main performance target. Return to measured cold-start optimization after the
reaction, pressure, steam, hot-loop, and material-resolver contracts stabilize.
