# ULG `.icc/` - Infinite Context Coder Policy

These are checked-in ULG campaign and acceptance definitions. Durable tasks,
leases, attempts, source indexes and runtime evidence live outside the repo.

ICC executes completion-oracle and production-audit policies today. The active
routing document is [`plan/CURRENT-PLAN.md`](../plan/CURRENT-PLAN.md) (Unified
40-OOM Foundation-First Scale-Ladder Roadmap, `10^-15 m` Nuclear to `10^+25 m`
Supergalactic; historical granular definitions preserved in
[seven-goal-campaign.md](../plan/todo/seven-goal-campaign.md)). **G5** and
**G7** were accepted on 2026-11-18; on 2026-11-22 **big dog** restructured the
active campaign into **6 clean Scale-Ladder Gates (`Gate 0`–`Gate 5`, 8 total
with `G5` & `G7`)** so ULG gets the architectural spine (`peercompute-core`,
`gpuMath`, canonical ABIs, Zero-Churn Step Loop), complete `Z=1..118`
first-principles Periodic Table Engine + live GPU visualizations, chemical
reactions → recursive compound feedback loop → convex Polytope Atlas right
first before scaling back up through Continuum/Studio (`Gates 3–4`) and
Planetary → Stellar → Galactic → Supergalactic FLRW TreePM (`Gate 5`).
Historical 2026-09-13 G1 failure evidence and all 13 legacy target names remain
preserved in `completion-oracles.yaml`; deleted `bulk-water` has been removed
from `ulg-g1-presentation`. Do not confuse configuration validation, static test
references, or a matching event label with application acceptance.

## Files

| File | Purpose |
|---|---|
| `quality-campaigns.yaml` | Seven immediate milestones and six architectural tracks, with exact oracle targets. |
| `completion-oracles.yaml` | Campaign receipt contracts, separate clean-release and advisory-science targets, plus retained historical targets. |
| `production-audit.yaml` | Composes ULG oracle targets with required ICC artifacts and guard presets for development, demo, and release gates. |
| `assistant-goals.yaml` | Current priorities and technical dependencies; old broad goals retained under non-active `legacy_goals`. |
| `modularity-justifications.json` | Documents known oversized integration files so future audits distinguish legacy boundaries from new drift. |

## Acceptance boundaries

- G1 requires >=54 visibly advancing scene presentations per wall-clock second
  across all six presets with their configured geometry and restored optics.
  Solver throughput, rAF and input serials are not pixel cadence evidence.
  That criterion remains unmet and unchanged; it no longer blocks starting G2.
- Development receipt oracles match explicit source/artifact review attestations;
  they do not authenticate dirty source hashes or compute ULG numeric thresholds.
  Independent original-artifact review is a separate mandatory gate.
- `ulg-campaign-clean-release` applies exact clean-current source binding only
  after an authorized commit, not as a pre-commit circular blocker.
- G7 proves the offline operator-side audit works. Database disagreement is a
  separate `ulg-science-advisory-signal`, never a required campaign/release gate.
- Native `quality-campaign` currently omits the oracle callback and reports
  declared stages pending. Run each real `completion-oracle` separately; the
  campaign's metric/threshold fields are inventory metadata, not measurement.

## Usage

```bash
ICC=/home/cos/projects/infinite_context_coder/bin/icc
"$ICC" assistant-status --repo ulg --format markdown
"$ICC" quality-campaign --repo ulg --format json
"$ICC" completion-oracle --repo ulg --validate --format json
# Use only the exact current run's reviewed external receipt bundle.
"$ICC" completion-oracle --repo ulg --target ulg-g1-presentation \
  --trace-file /absolute/external/path/to/current-run.jsonl \
  --criteria-limit 200 --evidence-limit 5 --format json
# Refresh explicitly through CLI after material source edits; MCP stays query-only.
"$ICC" reindex --repo ulg --full
"$ICC" build-git-history --repo ulg
"$ICC" status --repo ulg --check-staleness
"$ICC" freshness --repo ulg --format markdown
```

## Editing Tips

- Preserve exact target names and old failed evidence. Missing required evidence
  is incomplete; never synthesize PASS events to fill an oracle.
- Keep both PASS and FAIL in development filters. Use one reviewed current run,
  not accumulated history that might hide a later failure or source change.
- Reduced scientific scope stays labeled; never promote it to full validation.
  GPU-native acceptance uses invariants/manufactured/metamorphic/A-B evidence,
  not a CPU mirror/parity solver or full hot-state readback.
- Add modularity justifications only for existing integration boundaries or
  generated assets. New large files should be split before being justified.
- Use direct ICC and native agents with non-overlapping edit leases. Do not
  re-register ULG or reset its skip policy just to refresh evidence.
