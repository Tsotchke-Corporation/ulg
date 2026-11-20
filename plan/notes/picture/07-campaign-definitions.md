# Digest G: the campaign's formal definitions (`plan/todo/seven-goal-campaign.md`)

Read by Hermes: lines 1-40 (2026-11-13 user decision), 311-456 (2026-09-13 reprioritization), 828-1067 (delivery order, follow-ons, oracle protocol, operating loop, crosswalk). NOT read: the Codex-era G2 checkpoints (lines 41-310, 457-499) and G1 verification checkpoints (500-827, 1068-1429). Those describe the exact-rational and G1 cadence work that the 2026-10-27 integer-ledger proposal and the G1 deferral superseded.

## Goals (thirteen milestones = seven goals + six architecture tracks)

| ID | Required outcome | ICC oracle |
|---|---|---|
| G1 | Shared presentation pipeline, >= 54 visibly advancing scene presentations per wall-clock second for all six configured presets; preserve refraction, materials, depth and controls | `ulg-g1-presentation` |
| G2 | Conserved species/phase/enthalpy and shared participating-volume transport; real iron/ice plume and identified Na/water gas/aerosol lineage | `ulg-g2-plumes` |
| G3 | Coherent-solid foundation SOL-0/SOL-1, GPU invariants, resident rest mesh and compatible phase ownership | `ulg-g3-solids` |
| G4 | Generic conservative per-node activation beyond the reaction seed; relevant generalized kernels stay warm; scoped laws and zero-work evidence | `ulg-g4-dynamic-laws` |
| G5 | Bounded CAS multi-consumer reservation, epoch fencing, single-winner ownership and lifecycle correctness | `ulg-g5-reservation` |
| G6 | One local provenance-bound online sample/fit/cache with residual bounds, envelope invalidation and schedule-boundary adoption | `ulg-g6-local-fit` |
| G7 | Operator-side offline scientific release audit using immutable versioned database snapshots cached on this host; deviations advisory | `ulg-g7-release-audit` |

- G1's six presets: `water-cycle`, `iron-ice-quench`, `sodium-water`, `cesium-fluorine`, `bulk-water`, `water-realtime` (dam break). The first four keep true isosurfaces; the two water throughput demos keep sphere impostors.
- G1 is "approximately 60 Hz visual presentation, not 60 Hz real-time physics. All-preset solver real-time speed belongs to A1."
- G1 measurement rule: scene pixels against wall time, excluding HUD/camera-only changes. UI rAF, submitted frames, solver steps/s and sim time are diagnostics, not visible-rate proof. No per-preset physics branches or geometry substitutions to improve a score.
- G1 disposition: FAILED acceptance 2026-09-13, deferred until the architecture follow-ons. "Do not claim the all-preset 54 Hz target was met, impossible, or relaxed." Last strict all-six sweep was 0/6. Its ICC task is `goal1-all-preset-wallclock-rendering-20260904`; do not regenerate that plan.
- G7: agreement with a scientific database is NOT required; the gate tests the audit tool, cache integrity, offline execution, provenance, missing-data handling and advisory reporting.

## Architecture follow-ons

| ID | Bounded track | Technical prerequisites |
|---|---|---|
| A1 | Real-time physics: fused/batched bulk substrate, cheap inactive laws, >= 100k quiescent carriers and all-preset measured solver real-time behavior, including near-real-time G2 plume scenarios (moved from G2, 2026-11-13) | G4; A2-A4 may provide optimizations; deferred G1 is not a prerequisite |
| A2 | Investigate incremental SS membership repair/particle migration, then adopt only with GPU rebuild equivalence, conservative certificates and measured benefit | Existing immutable spatial-generation contracts |
| A3 | Representative homogeneous-region samples, conservative envelope expansion and bounded region-wide interpolation/lookup | G4, G6 |
| A4 | Broader multidimensional material/compound/property domain functions derived from simulation samples, held-out residuals, provenance and invalidation | G6 |
| A5 | Dependency-gated SOL-2/3 contact/coupling, SOL-4 deformation, SOL-5 topology, then eligible SOL-6 and additional SS levels | G3 |
| A6 | PeerCompute-owned warm remote derivation using Eshkol/MoonLab-compatible services, with actual remote failure/recovery proof | G5, G6 |

- "These are six tracks, not six atomic patches." Passing one subslice does not complete its track.
- A2 is an evidence-gated investigation. Reject a failed approach and keep its evidence.
- Strict fits never extrapolate. Never relabel approximation, cached evidence or stale closure use as fresh exact physics.
- No CPU mirror solver/parity gate or CPU-owned hot-state fallback. PeerCompute remains the sole authority/admission framework.
- Not part of the thirteen: full frontier-law expansion, electron-cloud inspection, broad material-bank growth, WSS/STUN/TURN deployment (separately routed backlog).

## Order
- G2-G7, then dependency-led A1-A6, then G1 reassessment. Later relaxed by the user (2026-11-14): order does not matter if all are achieved.

## 2026-11-13 user decision (top of the doc)
- "actually we should defer architecural work until we reach the correct phase. and at least finish out this goal first"; "yes move it to A1, allow dt 1 ms".
- G2 acceptance no longer requires near-real-time plume runs (now A1). G2 plume evidence may run at dt 1 ms; longer recordings were not approved, so the milestone cap applies.
- Deferred to A1 and G4, in campaign order: decoupling physics from presentation; multi-step fusion; the law descriptor; selective contact; the steps/s gate.
- Design rule for new G2 code: no per-step host fences or readbacks; keep counters on the GPU.

## Oracle protocol (evidence, not labels)
- Thirteen target-specific development oracles, a separate clean-release target (`ulg-campaign-clean-release`, `exact_clean_current`), and a separate advisory science signal (`ulg-science-advisory-signal`, never a gate).
- Receipts: `ulg.campaign.receipt.v1`, kind `ulg_campaign_receipt`, target-specific `value.contract.id`, lane `development-review`. Event names are in `.icc/completion-oracles.yaml`.
- Receipts are reviewed evidence attestations. ICC does not measure 54 Hz or validate numbers itself. "No new producer may stamp PASS just because a probe returned successfully."
- Before accepting a bundle: run the real domain checks and inspect originals; bind source fingerprint, run ID and SHA-256 of logs/outputs/images; independent review of each claim; pass only that run's bundle via `--trace-file`; inspect `target_matched` and criteria. Unknown proof is not PASS.
- ICC `quality-campaign` is inventory bookkeeping (reports declared oracles as unknown/pending). Run `completion-oracle` per target.

## Operating loop (as written 2026-09; parts are superseded)
- Direct ICC, `assistant-status`, `task-show --task-id ulg-seven-goals-and-architecture`, `task-plan --merge-existing` for updates, `task-attempt` only after actually executing recorded commands.
- One GPU probe at a time; stop only the owned browser; keep the VPN HTTPS Vite running; no terminal-browser or pane splits.
- SUPERSEDED: "Finish each runtime slice with owned, visible real-desktop browser checks". The user banned headed browsers on 2026-11-15.
- Hold as written: no commit/push/merge/Pages until G1 and the combined candidate are accepted. Later: specific local commits were authorized 2026-10-24; "skip the commit" 2026-11-13. Push/merge/Pages hold stands.
