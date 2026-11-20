# Where the read stands, and how to continue it

Written by Hermes for Hermes (and for anyone resuming this work). Update it at
every stage. Last update: 2026-11-17 14:30 AKST.

## The rule in force

The owner, 2026-11-17: finish reading the complete plan, the complete log and
the entire codebase, biased towards recent goals and decisions; make no change
to the actual plan or the code until it is understood where the project is
going and how the G+A campaign fits; "the SS work is critical". Notes go in
the plan folder. Until the report is given and the owner answers, the only
writes are under `plan/notes/`.

## The method

1. `tools/reading.py` cut the plan, log and code into 211 slices
   (`manifest.json`, `assignments/`, `COVERAGE.md`).
2. One reader sub-agent per slice writes one notes file ending in a SUMMARY
   and a COVERAGE line (`BRIEF.md`).
3. `python3 tools/reading.py verify ID ...` checks coverage and every quote.
   A failed slice is re-read: `python3 tools/reading.py redo ID`.
4. Hermes reads SS documents, direction documents and campaign plans itself
   (`ss/`, `direction/`, `campaign/`), and reads the reader summaries:
   `summaries ID ...` in full, or `sections C,T ID ...` for chosen blocks
   (A-H, W = what, D8 = dates, T = top five).
5. For code and tests, a second pass of sub-agents will write one digest per
   group from the verified slice notes; Hermes reads every digest, and the SS
   code slices directly.
6. Then: verify the surprising claims against source, write the synthesis,
   report to the owner. Only after that, correct `plan/handoff-2026-11-17.md`
   and the `ulg` skill.

## Dispatch mechanics (learned the hard way)

- `python3 tools/reading.py next N KINDS` marks N pending slices dispatched
  and prints them; KINDS is comma-separated (`S,C`). Do not pass `--json`
  unless the JSON is wanted on screen: it is long.
- One `delegate_task` call takes 10 tasks. Several calls may run at once.
  **At most 50 sub-agents may be spawned in one turn**; the sixth call in a
  turn is refused, and the turn then ends. If a call is refused after `next`
  marked its slices, spawn them first thing next turn or `redo` them.
- Results come back only between turns, one message per call. On each message:
  verify that batch, read its summaries, write notes, dispatch the next batch,
  end the turn.
- A reader takes 20-30 minutes for about 300 KB. 50 at once kept the machine at
  load 4 and 13 GB used of 31 GB.
- Task text used for every reader:
  goal "Reading assignment ID for the ULG repository: read every line of the
  assigned ranges and write structured notes to NOTES."; context "Read
  .../BRIEF.md in full first, then .../assignments/ID.md, and follow both
  exactly. Read-only: the only file you may create or modify anywhere is NOTES.
  Run no tests, builds, browsers, GPU work, servers, installs or
  state-changing git commands. Write in English."

## Progress

| Stage | State |
|---|---|
| Log L01-L09, status S01 | Done and verified (1,906 quotes). Synthesis: `log/00-synthesis.md` |
| Status S02 | Dispatched 14:16 |
| Plans P01-P10 (campaign, SS, older todo, top level) | Dispatched 14:14 |
| Plans P11-P17 (done, moot, tests.md) | Pending |
| Code, first 39 slices (SS hierarchy, epoch, proposals, thermal; scene and mount; worker; MPM step; ABI) | Dispatched 14:16-14:27: C003-C014, C017, C025, C033-C036, C039, C041-C043, C046-C051, C059, C061, C065-C069, C074, C077, C091, C092 |
| Code, remaining 68 slices | Pending |
| Tests T001-T063, scripts and miscellany X01-X13 | Pending |
| Group digests | Not started |

## What Hermes has read itself (all in full unless a range is given)

- SS: `plan/todo/SS/README.md`, `schroeder-tree-and-algorithm-plan.md`,
  `ss-law-architecture-assessment.md`, `ss-regression.md`,
  `done/SS/shared-spatial-authority-refactor-plan.md`, `first-class-air.md`,
  `refactor/handoff.md`, `sol-critic.md`, `interface-resolution.md`
  (notes `ss/01` to `ss/07`).
- Direction: Star Spec v0.4, Triad v0.5 (Parts 0-4), `greenfield.md`,
  `todo/README.md` (1-272, 3252-3300), `plan/Agents.md`, root `Agents.md`,
  the Eshkol higher-order plan, `scale-adaptive-law-activation-plan.md`
  (1-330) (notes `direction/01` to `05`).
- Campaign: `seven-goal-campaign.md`, `2026-11-03audit.md`,
  `g2-integer-ledger-proposal.md`, `a1-eshkol-coarse-dt.md`,
  `a1-realtime-substrate.md`, `g3-solids-proposal.md`,
  `g4-dynamic-laws-proposal.md`, `g5-reservation.md`, `g6-local-fit.md`,
  `g7-release-audit.md`, `a2-...md`, `a3-a4-...md`,
  `a5-solid-fluid-coupling.md`, `a6-remote-derivation.md`,
  `.icc/completion-oracles.yaml` (notes `campaign/01` to `05`, digests
  `picture/01` to `16`).
- Not yet read by Hermes itself: `plan.md`, `overarching-completion-plan.md`,
  `frontier-todo.md`, `g2-exact-gpu-inventory.md`, the scale-adaptive plan
  331-981, the Triad addendum, `handoff-2026-10-24.md`, and everything under
  `plan/done` and `plan/moot`. Readers P01-P17 cover all of them.

## Open questions being carried to the synthesis

See the "Hermes, INFERRED" and "to verify in code" paragraphs in `ss/04`,
`ss/06`, `ss/07`, `campaign/02`, `campaign/03` and `campaign/05`. The main
ones:

1. SS runs one level on the flagship scene; the N-level chain is at phase A of
   five; empty levels are a rejection in the two-level protocol.
2. One spatial epoch is rebuilt per step, and one step is one host call. This
   is the floor under A1.
3. The ledger does not run on the two-level, fused or room-air routes.
4. The closure loop (envelope exit → derivation → fit → adoption → resident
   evaluator) has every link built and has never run as a loop.
5. Solids sit beside the SS tree, with brute-force searches.
6. G1's September rates were extrapolated frames around physics states arriving
   at under one per second.
7. No oracle receipt exists for any of the thirteen milestones, and nothing
   since 10-27 is committed or logged in `plan/log.md`.
