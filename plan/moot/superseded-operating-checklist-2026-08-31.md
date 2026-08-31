# Superseded Operating Checklist Items

Archived: 2026-08-31 AKDT

These lines were removed from the active checkbox stream in `plan/plan.md`.
They were routing reminders, session operations, bootstrap inventories, or
rules—not independently finishable project work.

- Follow `plan/todo/README.md` and the overarching plan as active ordering.
- Keep the development server running for live inspection.
- Start PeerCompute work from `ComputeManager`, `NodeKernel`,
  `SolverRegistry`, relay tooling, NetViz telemetry, and Multiscale schemas.
- Start Eshkol work from its CLI, LLVM backend/codegen, GPU memory/VM dispatch,
  and existing web/GPU scripts.
- Use swarm lightly for status/context until a ULG-specific profile exists.
  This is superseded by direct ICC control-plane use plus native agent leases.
- Keep adaptive MLS-MPM out of the June liquid bugfix track. That track ended;
  adaptive-law work now has its own current plan and the completed SS refactor
  record.

Still-valid prohibitions were not moved here. The JIT hold, portable replay
boundary, and no-frame-copy-back rule remain active prose constraints.
