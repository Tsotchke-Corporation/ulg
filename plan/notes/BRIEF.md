# Reader brief: complete read of the ULG plan, log and codebase (2026-11-17)

You are one of many readers. Each reader has one slice of the repository at
`/home/cos/projects/ulg` (or of `/home/cos/projects/peercompute`, which the app
loads). Together the slices cover the complete plan folder, the complete
development log and the entire codebase.

The repository owner's instruction, verbatim: "you need to finish reading the
complete plan, the complete log, and the entire codebase with a bias towards
goals and decisions made recently. you can't make any changes to the actual
plan or the code until you understand where we are going and how the G+A
campaign fits into it. the SS work is critical".

Your notes are the record of that reading. A coordinator will read them and
check them against the source. Nobody else will read your slice, so anything
you leave out is lost.

## Hard rules

- **Read-only.** The only file you may create or modify, anywhere, is the notes
  file named in your assignment. Do not edit, move, rename or delete anything
  else: no fixes, no formatting, no "small improvements".
- **Run nothing.** No tests, builds, browsers, GPU work, dev servers, package
  installs. No git command that changes state. `git diff`, `git log`,
  `git show`, `git status`, `grep`/`search_files`, `sed -n`, `wc` are fine.
- **Read every line of your assigned ranges**, in order, with no skimming,
  sampling or skipping. The only exception is an item marked INVENTORY ONLY.
- **Do not read other slices.** To answer "does this still exist", "who calls
  this" or "where is this defined", search (`search_files`, or `grep -rn` over
  `src/`, `ulg-gpu-abi/src/` and `/home/cos/projects/peercompute/peercompute/src/`)
  and read only the few lines you need.
- **Never invent.** If you did not read it, do not state it. Mark your own
  interpretation as INFERRED.

## Background (the coordinator's understanding; say so if your slice contradicts it)

**The project.** ULG is the Universal Law Graph: a first-principles physics
engine. Macroscopic behaviour is supposed to emerge from activated laws and
derived closures, never from hand-written special cases. It runs on WebGPU in
the browser and is shown in a three.js demo.

- `src/runtime/` holds the law graph, materials, chemistry and the physics
  runtime. `src/runtime/sph/` is the GPU physics: SPH and MLS-MPM particle
  mechanics plus thermal, phase, reaction, gas, contact and solid laws.
- `src/services/` holds the workers. Physics runs in a worker, the "canonical
  worker lane" (`ulgMechanicsResidentStage.worker.js`). Presentation runs in an
  offscreen render worker.
- `src/visualization/` holds the scene, the demo mount and the renderers.
- `ulg-gpu-abi/` holds the shared WGSL and buffer-layout (ABI) codecs.
- **PeerCompute** (`/home/cos/projects/peercompute`) is the orchestration and
  authority framework: NodeKernel, ComputeManager, StateManager, GPUHub. Accepted
  state changes are meant to flow through it. **Eshkol** derives and compiles
  laws, closures and derivatives. **MoonLab** supplies quantum and many-body
  response. Both are separate repositories.

**SS means Schroeder Simulation.** It has two parts:

- the **Schroeder Tree**: a GPU-resident scale hierarchy whose nodes are both
  multilevel MLS-MPM grid nodes and law-aggregate nodes;
- the **Schroeder Algorithm**: the multiscale solver that moves particles,
  fields, reactions, contact, optics and long-range laws through that hierarchy,
  with conservative coupling between levels and per-law rules for when exact
  near-field work, aggregate far-field traversal or cross-level transfer is
  admissible.

It is meant to be one scale-aware substrate "from atomic to supergalactic
scale", not one grid per law. In code it is the `schroeder*` files: spatial
epochs, the cell/member directory, hierarchy generations, exact-near
traversal, mechanics views, aggregate views, cross-level coupling, phase-volume
migration, split and merge, law queues. Today two levels run; an N-level chain
of 2:1 pairs was approved on 2026-11-16. **The owner calls the SS work
critical. Record everything your slice says about it.**

**Rough timeline** (dates are 2026):

- 07-01: the SS plan starts. 07-09: validation becomes GPU-native (no CPU
  mirror solver, no CPU parity gate). 07-21: the "shared spatial authority"
  refactor record is complete (slices 0-8).
- 09-04 to 09-13: a seven-goal campaign begins. Goal 1 (frame rate) fails its
  acceptance and the owner defers it on 09-13. Work moves to Goal 2.
- up to 10-26: an earlier agent (Codex) works on Goal 2 with exact-rational
  arithmetic. `plan/log.md` ends here.
- 10-27: the owner says "Stop and review first". A full code and log review
  follows; integer ledgers replace exact rationals. `HEAD` is `f6f7a5e`.
- 11-03 to 11-17: "the campaign". Nothing from this period is committed: it is
  the uncommitted working tree (about 144 changed and 106 new files). Your
  assignment marks each file as unchanged, CHANGED or NEW relative to 10-27.

**The G+A campaign**: seven goals and six architecture tracks, defined in
`plan/todo/seven-goal-campaign.md`.

| | Outcome |
|---|---|
| G1 | At least 54 visibly advancing scene presentations per second on all six presets (`water-cycle`, `iron-ice-quench`, `sodium-water`, `cesium-fluorine`, `bulk-water`, `water-realtime`). Failed and deferred 09-13 |
| G2 | Conserved species, phase and enthalpy with shared gas/plume transport: a real steam plume from iron on ice, and traced gas/aerosol lineage for sodium-water |
| G3 | Coherent solids: body/member/contact/shape carriers, levels SOL-0 and SOL-1 |
| G4 | Laws switch on and off per node; a dormant law costs no work |
| G5 | A bounded multi-consumer reservation ledger in PeerCompute |
| G6 | One local sample/fit/cache cycle for derived closures, with residual bounds |
| G7 | An offline scientific release audit against cached reference databases |
| A1 | Real-time physics: fused/batched stepping, cheap inactive laws, 100k quiescent carriers |
| A2 | Incremental repair of SS membership instead of a full rebuild |
| A3 | Representative samples for homogeneous regions |
| A4 | Derived multidimensional material functions |
| A5 | Later solid levels (SOL-2 to SOL-6), solid-fluid coupling, more SS levels |
| A6 | Remote derivation with Eshkol/MoonLab services through PeerCompute |

**The owner's standing rules** (a place where the material breaks one is a finding):

- Physics is general: no law written for one scenario, material or reaction;
  no per-preset code branch; no law removed or demoted to make things simpler.
- Nothing runs on the host: no CPU simulation, CPU oracle, CPU parity gate or
  host-side law evaluation. Validation is on the GPU (manufactured states,
  invariants, metamorphic runs), reading back only fixed-size evidence.
- One authoritative owner per mutable state family. Physics cadence is
  independent of render cadence. Boundary conditions are explicit inputs.
- Anything that weakens a goal's acceptance needs the owner's approval.

## What to record

Bias towards what is recent, and towards goals and decisions. An old detail
gets one line; a recent decision gets its exact wording.

- **A. Direction.** Where the project is going: missions, end states, target
  architectures, roadmaps, what "done" means. Which earlier direction each one
  replaced.
- **B. Owner decisions.** Every instruction, approval, rejection or preference
  from the owner (the log calls them "the user"), quoted exactly, with its
  date. Every rule that binds future work.
- **C. SS.** Design, what is built against what is only planned, levels,
  epochs, spatial authority, directories, traversal, cross-level coupling,
  split/merge, law adapters, aggregates, measured costs, reverts, known gaps,
  and anything about how SS should evolve.
- **D. Campaign fit.** Anything that bears on a goal or track above, including
  earlier attempts at the same thing and how they ended. Name the goal or track.
- **E. Dead ends and reverts.** What was tried, what was measured, why it was
  dropped. Quote any "do not try this again" warning.
- **F. Open and stale.** Follow-ups promised and not done, checks left failing,
  claims that later text or the code contradicts, `TODO`/`FIXME`.
- **G. Code only.** For each file: what it is for; which state it owns or
  writes; whether it is live (who calls it) or dead; knobs, URL parameters and
  defaults; contracts it enforces; comments that record a decision, a date or a
  failure; physics that still runs on the CPU; per-preset or per-material
  branches; anything that looks wrong.
- **H. Contradictions** between this slice and the background above, or inside
  the slice.

For a log or status slice, also keep a **timeline**: one line per dated entry
(date, subject, outcome, line number). Entries are mostly newest-first.

For a test slice, record what each test file proves, the environment variable
that gates it if any (`ULG_RUN_NATIVE_*`), and whether it is a GPU gate or
host-only logic. One or two lines per file is enough unless it is recent.

Many slices will have nothing under some headings. Say "none" and do not pad.

## How to read

1. Read your assignment file. Read the ranges in the order given.
2. Use `read_file` with `offset` and `limit`, **at most 1,000 lines per call**.
   If the result is truncated or gives a `next_offset`, continue from there:
   never assume you received the whole range. If a line looks cut off, print it
   with `sed -n 'Np' FILE`.
3. **After every read call, append to your notes file**: the range you just
   read, then what you found, each point with `file:line`. Create the file
   with `write_file`. Append later blocks with `patch` (match the last line of
   the file and replace it with itself plus the new block), or with a short
   `cat >> FILE <<'EOF'` of at most about 40 lines. The command guard refuses a
   long heredoc ("too long or complex"): split it, do not retry it and do not
   route around the guard with a script file. The notes file is your memory if
   your context is compacted. Re-read it if you lose track.
4. If the assignment names a campaign diff, read it in full after the files and
   record, per file, what the campaign changed and why.
5. Write the SUMMARY and the COVERAGE line last.

## Notes file format

```
# <slice id>: <one-line title>

Assigned: <the ranges, as in the assignment>

## Reading log

### <file>:<start>-<end>
- OBSERVED ... (`file:line`)
- INFERRED ...
- Q[file:line] "exact words copied from that line"

(one block per read call)

## Campaign changes        (only if you were given a diff)

## SUMMARY

What this slice is: 2-4 lines.
A. Direction: ...
B. Owner decisions: ...
C. SS: ...
D. Campaign fit: ...
E. Dead ends and reverts: ...
F. Open and stale: ...
G. Code: ...            (code, test and script slices)
H. Contradictions: ...
Dates covered: earliest to latest date mentioned in the slice.
Top five for the coordinator: the five things most worth knowing.

COVERAGE: <copied exactly from the assignment>
```

- **Verbatim quotes are mandatory and are machine-checked.** Write each as
  `Q[path:line] "text"` where `path` is the label used in your assignment's
  COVERAGE line (for example `plan/log.md` or `src/runtime/sph/x.js`), `line`
  is the line number in that file, and the text is copied exactly from that
  line (a fragment of at least eight characters is enough; do not paraphrase,
  do not join lines). Give at least ten, spread over the slice: every owner
  decision, every dated design decision, every warning, and the key lines of
  code. A quote that is not found near its line fails your slice.
- The SUMMARY is at most 70 lines. Detail stays in the reading log.
- **Size guide.** Log and plan slices: as long as the content needs. Code
  slices: aim for 25-45 KB of notes. Test and script slices: 10-25 KB. Do not
  transcribe code or list every function; record what a reader could not get
  from the file's name and its exports: purpose, ownership, contracts, knobs,
  decisions in comments, hazards, and how it connects to SS and the campaign.
  Spend the words on files marked CHANGED or NEW.
- The COVERAGE line is the last line of the file and must match the assignment
  character for character. Write it only if you really read every range.
  If you could not finish, write `COVERAGE-INCOMPLETE: <what you did read>`
  instead and say why.

## Your final message

At most 150 words: the notes path; whether coverage is complete; the three
most important findings with `file:line`; any problem you hit.
