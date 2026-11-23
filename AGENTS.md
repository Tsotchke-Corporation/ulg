# ULG Repository Agent Rules (Canonical Uppercase Discovery Entrypoint)

> **Why this file exists:** Linux is case-sensitive and Antigravity / Codex /
> Claude directory-rule discovery scans strictly for uppercase `AGENTS.md` (and
> `GEMINI.md`). This file is the canonical uppercase entrypoint for
> `/home/cos/projects/ulg` and automatically pulls in `Agents.md` and
> `plan/Agents.md`.

## Mandatory Session-Start & Post-Compaction Checklist

1. Read [`plan/CURRENT-PLAN.md`](plan/CURRENT-PLAN.md) (authoritative routing,
   Section 1 non-negotiable rules, Section 3 GPU performance budgets).
2. Read the top of [`plan/STATUS.md`](plan/STATUS.md) and any active
   `plan/handoff-*.md` (currently [`plan/handoff-2026-11-22.md`](plan/handoff-2026-11-22.md)).
3. Follow the **Star Spec Anti-Shortcut Pre-Code Gate** below on every change:
   - **Zero preset/material-scoped hacks** (`if (mat === 'h2o')`, `isBinary`,
     `phase_mode == 0/1/2`, etc.).
   - **Zero one-off animations or visual fakes** (no CSS screen-space glows,
     no `Math.sin(t)`/`Math.cos(t)` scripted orbits/particles, no toggled canned
     props masquerading as emergent dynamics).
   - **Strict translation & multi-body invariance** (no `(0,0,0)` origin-centered
     forces or screen-center overlays).
   - **GPU-native only** (no production CPU mirror solvers, no full-state
     hot-loop readbacks; extend ULG's canonical `ClosureRegistry`,
     `SimulationModuleRegistry`, Schroeder Spatial / MLS-MPM / exact `2^-149`
     ledgers, and 3D GPU renderers).
   - **Publication hold:** Do **not** `git push`, merge to `main`, or rebuild
     GitHub Pages `docs/` without explicit authorization from **big dog**.
   - **House rule:** Address the user as **big dog** in every response.

@[ULG Core Tenets](plan/Agents.md)

@[ULG Agents Guide](Agents.md)
