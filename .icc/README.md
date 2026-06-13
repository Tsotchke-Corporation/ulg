# ULG `.icc/` - Infinite Context Coder Policy

These files are ULG-specific repo-local ICC policy notes and generated context
snapshots. They describe the ULG triad runtime, SPH/MLS-MPM demo, material
closure chain, reaction chain, and GPU-residency goals.

The current ICC checkout at `/home/cos/projects/infinite_context_coder` supports
index, memory, status, and architecture-summary commands. The oracle and audit
YAML files are forward-compatible ULG policy for ICC builds that expose
`completion-oracle`, `production-audit`, or assistant status commands; this
local ICC checkout does not currently execute those YAML files.

## Files

| File | Purpose |
|---|---|
| `completion-oracles.yaml` | Defines ULG readiness targets for the SPH phase demo, GPU-resident hot loop, material/reaction closure chain, and handoff evidence. |
| `production-audit.yaml` | Composes ULG oracle targets with required ICC artifacts and guard presets for development, demo, and release gates. |
| `assistant-goals.yaml` | Prioritized ULG work goals an assistant should suggest when no specific bug is queued. |
| `modularity-justifications.json` | Documents known oversized integration files so future audits distinguish legacy boundaries from new drift. |
| `ulg_arch_summary.md` | Generated architecture snapshot from `icc architecture-summary --repo ulg --bundle --include-cheatsheet`. |
| `ulg_status.json` | Generated status snapshot from `icc status --repo ulg --check-staleness`. |

## Targets

| Target | When to run |
|---|---|
| `sph-phase-demo-ready` | Before relying on the browser SPH demo for user-facing proof. |
| `resident-hot-loop-ready` | Before claiming the resident WebGPU loop is actually fast and readback-minimal. |
| `material-closure-ready` | Before claiming material properties, optics, EOS, or phase behavior are first-principles-derived. |
| `reaction-closure-ready` | Before claiming general chemistry reactions are balanced, energetic, and pressure-coupled. |
| `triad-handoff-ready` | Before exporting ULG handoff artifacts as integrated evidence for sibling runtimes, demos, or closure consumers. |
| `no-regression` | Per-slice sanity; high-severity blockers only. |

## Usage

```bash
# Refresh repo-local ICC index, memory, status, and architecture snapshot.
npm run icc:update

# Equivalent direct commands.
ICC=/home/cos/projects/infinite_context_coder/scripts/codebase_tool.py
EMSDK_QUIET=1 python3 "$ICC" register --name ulg --path /home/cos/projects/ulg \
  --skip-dir .git --skip-dir coverage --skip-dir dist --skip-dir docs \
  --skip-dir node_modules --skip-dir playwright-report \
  --skip-dir public --skip-dir test-results
EMSDK_QUIET=1 python3 "$ICC" index --repo ulg
EMSDK_QUIET=1 python3 "$ICC" build-memory --repo ulg
EMSDK_QUIET=1 python3 "$ICC" status --repo ulg --check-staleness
EMSDK_QUIET=1 python3 "$ICC" architecture-summary --repo ulg --bundle --include-cheatsheet
```

## Editing Tips

- Keep target names stable; handoff docs can refer to them without chasing
  implementation details.
- Use `runtime_event` names that can be emitted by future smoke/probe scripts.
- Treat `scientificValidation=false` and `fullPhysicsValidation=false` as
  blockers unless the lower-level evidence chain is genuinely implemented and
  verified.
- Add modularity justifications only for existing integration boundaries or
  generated assets. New large files should be split before being justified.
- The updater intentionally registers ULG with generated/staged output skipped:
  `docs`, `public`, `dist`, coverage, Playwright output, `node_modules`, and
  `test-results`.
