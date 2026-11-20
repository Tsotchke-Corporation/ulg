# Reading notes (Hermes, started 2026-11-17)

These are notes from a complete read of the plan folder, the development log
and the codebase. They are not plans. Nothing here changes the plan of record
in `plan/todo/`, `plan/done/` or `plan/log.md`.

The owner's instruction (2026-11-17): "you should keep your notes in the plan
folder. you need to finish reading the complete plan, the complete log, and the
entire codebase with a bias towards goals and decisions made recently. you
can't make any changes to the actual plan or the code until you understand
where we are going and how the G+A campaign fits into it. the SS work is
critical".

## Layout

| Path | What |
|---|---|
| `STATUS.md` | Where the read stands and how to continue it |
| `ss/` | Hermes's own notes on Schroeder Simulation, read line by line |
| `direction/` | Hermes's own notes on where the project is going (Star Spec, Triad, standing direction, Eshkol plan, scale-adaptive activation) |
| `campaign/` | Hermes's own notes on the G+A campaign plans, read in full |
| `picture/` | Hermes's first-pass digests (2026-11-17, before this read): Claude's notes, the campaign plans, the owner's decisions |
| `log/L01..L09.md` | Reader notes on `plan/log.md`, all 45,148 lines; `log/00-synthesis.md` is Hermes's reading of them |
| `status/S01..S02.md` | Reader notes on `plan/implementation-status.md` |
| `docs/P01..P17.md` | Reader notes on every other plan document |
| `code/C001..C107.md` | Reader notes on `src/`, `ulg-gpu-abi/`, PeerCompute `src/` |
| `tests/T001..T063.md` | Reader notes on `tests/` |
| `code/X01..X13.md` | Reader notes on `scripts/`, `scratch/`, data and miscellany |
| `COVERAGE.md` | One row per slice with its state; generated |
| `manifest.json` | The exact line ranges of every slice; generated |
| `assignments/` | What each reader was asked to read |
| `BRIEF.md` | The instructions every reader followed |
| `tools/reading.py` | Builds the manifest, hands out slices, checks the notes |

## How the read is done

- The plan, log and code are cut into 211 slices of about 300 KB. Each slice
  is read in full by one reader (a sub-agent) that writes one notes file.
- Every notes file ends with a `SUMMARY` and a `COVERAGE` line. Verbatim quotes
  are written as `Q[path:line] "text"` and `tools/reading.py verify` checks
  each quote against the source near that line.
- Hermes reads the SS documents, the reference design and the campaign plans
  itself, and reads every reader's summary.
- Files changed or created since 2026-10-27 (the uncommitted campaign) are
  marked in each assignment, and readers get the exact diff.

## Not read line by line

Binary files (PDF figures, images, WASM); `docs/` and `dist/` (build output);
`node_modules/`; data and generated files, which are inventoried
(`data/material-properties/*.json`, the MoonLab and Eshkol JS glue,
`package-lock.json`, the `.orig` worker copy). PeerCompute's own plan folder
and tests are outside this read, except the Star Spec and the reservation
ledger test.
