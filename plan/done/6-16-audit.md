# ULG Codebase Audit — 2026-06-16

Auditor pass against the `Agents.md` architecture contract and design
principles. Scope: the `ulg` repo (`/home/cos/projects/ulg`) plus its declared
integration boundary with the sibling `peercompute`, `eshkol`, and `moonlab`
projects. This is an assessment, not a set of applied changes.

## Method / evidence base

- `npm test` (node `--test`): **575 pass, 2 skipped (expected opt-in), 0 fail**,
  ~97 s. Unit/contract layer is genuinely green.
- Source inventory: 100 JS files, ~75.7k LOC under `src/`; 76 test files.
- Git: branch `main`, clean tree, last 30 commits are the SPH/gas-cell/visual
  slices from 2026-06-14..15.
- Sibling branches: `eshkol@ulg`, `moonlab@ulg`, `peercompute@multi-scale-physics-sim`,
  `swarm` not present / not a git repo.
- Read: `plan/plan.md`, `plan/implementation-status.md`, `plan/todo/README.md`,
  `plan/todo/overarching-completion-plan.md`, `plan/todo/frontier-todo.md`,
  `plan/todo/distributed-peercompute-network-stack-plan.md`, `README.md`, and
  spot reads of the largest runtime modules.

---

## 1. Overall verdict

The project is **healthy at the unit/contract layer and honest in its claims**,
but carries three structural risks that will compound: (a) a few enormous files
that concentrate most complexity, (b) documentation that has grown into
append-only logs instead of living status, and (c) an integration boundary to
PeerCompute that is wired through machine-specific absolute paths. The physics
*correctness* stack (DFT → chemistry → materials → thermo) is the strongest part
of the repo. The visible *physics/visual acceptance* (liquid free-surface,
MLS-MPM, ice/solid, z-buffer) is the weakest and is openly tracked as unfinished.

The recent two days of work are dominated by gas-cell pressure-field
admission/import/publication plumbing — many small descriptor layers — which is
correct per the authority contract but shows signs of churn relative to the
unresolved visible-physics P0s.

2026-06-17 follow-up: the audit's broad criticism of sequencing and visual
physics priority was valid, but the concrete G2P-renormalization attribution was
not the active current-fixture bug. Direct A/B testing showed the monolithic CPU
carrier was already passing the 1s H2O/H2O free-surface shape gate and did not
change when G2P renormalization was toggled. The fixed resident/browser bug was
instead a split grid-update floor-boundary parity break: resident CPU/WGSL
zeroed velocity at `y <= dx`, freezing the first interior floor row that liquid
needed for tangential spreading. The fix is tracked in
`plan/done/resident-mlsmpm-floor-boundary-free-surface-2026-06-17.md`.

---

## 2. Strengths (keep these)

- **Test discipline.** 575 passing tests across ABI, electronic structure,
  chemistry, materials, SPH kernels, worker contracts, and PeerCompute
  integration. `npm run test:physics-atomics` enforces scientific invariants
  (zero-force rest, gravity-only motion, mass conservation, bounded `J`,
  law-group isolation) before visual tuning, exactly as `Agents.md` demands.
- **Honesty culture.** Code and docs consistently flag `validation=false`,
  "toy/reference scoped", and "blocked-*" statuses instead of overclaiming.
  `plan/todo/frontier-todo.md` is a candid shortfall ledger of the science.
- **Law-content vs law-authority separation is real.** PeerCompute's
  `NodeKernel`/`ComputeManager`/`StateManager`/`GPUHubManager` are actually
  loaded and exercised (not faked) — see §6. Resident stages publish
  non-mutating evidence and gate mutation through admission descriptors.
- **No `TODO`/`FIXME`/`HACK` debt markers** in `src` (0 found) — intent is
  captured in plan docs rather than scattered code comments.
- **Artifact hygiene.** `dist/`, `test-results/`, `node_modules/` are correctly
  git-ignored and untracked.

---

## 3. Code health & maintainability  — HIGH

A handful of files hold a disproportionate share of complexity:

| File | LOC |
|---|---|
| `src/runtime/sph/sphMlsMpmGpuStep.js` | 11,844 |
| `src/visualization/sphPhaseScene.js` | 9,043 |
| `src/runtime/peercomputeBrowserResidentHost.js` | 5,699 |
| `src/runtime/sph/sphRenderGpuKernel.js` | 5,274 |
| `src/visualization/sphPhaseDemoMount.js` | 4,857 |
| `src/runtime/sphPhaseDemo.js` | 2,797 |

- An ~11.8k-line single module (`sphMlsMpmGpuStep.js`) is a maintenance and
  review hazard: it now hosts P2G/G2P, grid update, thermal, pressure-interface,
  gas-cell EOS, reaction-product **stage task factories** plus commit-delta
  schemas. These are separable concerns (one module per stage family would map
  cleanly onto the law-graph node model the architecture already wants).
- **Risk flagged by `Agents.md` itself:** "Do not let the browser scene become a
  second scheduler." `sphPhaseScene.js` (9k LOC) + `sphPhaseDemoMount.js` show
  scheduler-shaped surface area — `sphPhaseDemoMount.js` has 14 references to
  `submit*StageTask` / `runMechanicsStageTaskChain` / stage-chain wiring. This is
  currently *requester/telemetry* behavior (the status notes are careful about
  this), but the volume of stage-orchestration code in the visualization layer
  is the early shape of the anti-pattern. Recommend extracting a thin
  scene-side "stage request client" so the scene file holds rendering only.

**Recommendation:** Treat file decomposition as an explicit, test-gated slice —
split `sphMlsMpmGpuStep.js` by stage family and move stage-request glue out of
`sphPhaseScene.js`. Tests already cover each stage, so the split is low-risk.

---

## 4. Documentation hygiene — MEDIUM/HIGH

`Agents.md` asked for a *short* `implementation-status.md` and a development
narrative log. Both have grown into append-only ledgers:

- `plan/implementation-status.md`: **5,495 lines** (the file the user wants to
  "check at any time" — it is no longer skimmable).
- `plan/plan.md`: **2,131 lines**, containing **83 "Current checkpoint" entries**
  appended chronologically — `plan.md` has become a second log rather than a plan.
- `plan/log.md`: **25,002 lines** (this *is* meant to be the log; acceptable, but
  consider rotating by month).
- `plan/done/`: 74 files; `plan/todo/`: 17 files.

**Recommendation:**
- Cap `implementation-status.md` at a true short status: current P0, in-flight
  item, last-green validation, next item. Move history to `log.md`.
- Make `plan.md` a *plan* (target architecture + ordered open work). Move the 83
  checkpoint blocks into `log.md` or an archive.
- The two-day burst of gas-cell descriptor done-items suggests the done/ ledger
  granularity is finer than the user-facing value; consider grouping.

---

## 5. Physics & visual acceptance gap — HIGH (and openly tracked)

Unit tests are green, but `Agents.md`'s required *visual sequence sanity checks*
are not passing for the headline scenarios. Per `plan/plan.md` and the todo
README, persistent open P0s are:

- MLS-MPM H2O **fragmentation**; CPU-SPH liquid renders **blocky/stacked**, not a
  settled free surface (the new free-surface shape gate intentionally fails
  short H2O rows: tallness ~1.16–1.40 vs `<=0.75` target).
- Ice/solid rigidity (solids creeping/flowing) in mounted view.
- Renderer **z-buffer/draw-order** and phone **focus-resume flash/disappear**
  remain unverified on real devices.
- A recent full 12-row visual matrix run was **11/12 failing**; the green short
  matrices do not yet imply long-horizon liquid quality.

This is the gap between "tests pass" and "the demo looks physically correct."
The team is honest about it, but it is the **single most important correctness
risk** and should outrank further descriptor-plumbing slices, per the todo
README's own "does not count as done while the visible physics loop is
incoherent" rule.

2026-06-17 update: the specific resident MLS-MPM H2O/H2O free-surface spread
gate now passes in the browser matrix (`failedCount=0`, final tallness `0.440`,
footprint fill `0.182`, one connected H2O surface). Keep this section's warning
active for remaining visible-trust issues: low-resolution blocky/faceted water,
ice/solid flow, z-buffer/draw-order pixel evidence, mobile focus-resume
flashing, and non-demo-scale physics validation.

---

## 6. PeerCompute integration boundary — HIGH (portability)

PeerCompute is integrated for real, but through **hardcoded machine-absolute
Vite `@fs` URLs** in `src/runtime/peercomputeBrowserResidentHost.js:84-89`:

```
/@fs/home/cos/projects/peercompute/peercompute/src/peercompute/index.js
/@fs/home/cos/projects/peercompute/.../NodeKernel.js
/@fs/.../ComputeManager.js  StateManager.js  GPUHubManager.js  RemoteResultQuorumValidator.js
```

Issues:
- **Non-portable**: any checkout not at `/home/cos/projects/peercompute/...`
  breaks the browser authority path. CI, another machine, or the `old-donkey`
  server cannot run this without editing source. These should be configurable
  (env/import-map/`vite.config` alias) with the absolute path only as a default.
- **Branch divergence**: ULG targets PeerCompute APIs, but PeerCompute is on
  `multi-scale-physics-sim`, not a `ulg` branch. `Agents.md` says "each project
  is already on a ulg themed branch"; this one isn't. The Agents.md also notes a
  "large departure from that branch with the new architecture plan" — so confirm
  which PeerCompute branch is the intended integration target before more
  resident-host work hardens against the current API surface.
- These six `@fs` paths are the only hard external coupling; isolating them
  behind one config object would make the whole stack relocatable.

---

## 7. Distributed network stack — MEDIUM (not started, intentionally deferred)

`Agents.md` asks for "a full local peercompute stack locally with
stun/turn/ice/relay." Current state:
- **No WebRTC/STUN/TURN/ICE/relay implementation in `src`** (grep for
  `RTCPeerConnection|iceServers|stun:|turn:|coturn` → 0 real matches; the
  earlier broad `ice` hits were substrings of `service`/`device`/`lattice`).
- Only a **plan** exists: `plan/todo/distributed-peercompute-network-stack-plan.md`,
  which deliberately schedules this *last* (item 11 in the overarching plan),
  after single-node authority/state/visual gates stabilize.

This is a defensible deferral and consistent with the documented priority order —
flagging it only so the gap between the Agents.md ask and current reality is
explicit. The demo is single-node today.

---

## 8. Smaller findings — LOW

- **Directory split:** `src/runtime/materials/referenceMaterials.js` is the lone
  file under `materials/` while every sibling lives under `material/`. Minor, but
  it invites wrong-path imports; fold into `material/` unless the split is
  intentional.
- **Randomness in IDs:** `peercomputeBrowserResidentHost.js` uses
  `Math.random()` for `shortId()`. Fine for demo session ids, but if any of
  these leak into cache keys or admission provenance it undermines the
  content-addressed/deterministic cache contract — worth a quick confirm that
  cache keys derive only from inputs/versions, never `shortId`.
- **e2e/visual coverage is opt-in** (`ULG_SPH_VISUAL_CAPTURE`, Playwright behind
  flags). Given §5, the visual matrix is the real acceptance gate yet isn't part
  of the default `npm test`. Consider a CI lane that runs at least one visual row
  headless so visual regressions can't pass silently.
- **`README.md`** describes the runtime accurately and conservatively — good —
  but it predates the gas-cell/authority work; a refresh would help a resumer.

---

## 9. Prioritized recommendations

1. **(HIGH) Close the visible-physics P0 before more descriptor plumbing.**
   MLS-MPM fragmentation + CPU-SPH free-surface shape are the headline failures;
   the project's own rules say these block "done." Drive them with the existing
   free-surface shape gate over long horizons.
2. **(HIGH) De-hardcode the PeerCompute `@fs` paths** behind one config/alias so
   the stack is relocatable (CI, other machines, old-donkey). Confirm the
   intended PeerCompute integration branch.
3. **(HIGH) Decompose the mega-modules**, starting by splitting
   `sphMlsMpmGpuStep.js` per stage family and lifting stage-orchestration glue
   out of `sphPhaseScene.js`. Tests already gate each stage.
4. **(MED) Restore doc hygiene:** short `implementation-status.md`, turn
   `plan.md` back into a plan, route history to `log.md`.
5. **(MED) Add a headless visual-matrix lane** to default CI so visual
   acceptance regressions surface without manual opt-in.
6. **(LOW) Tidy `materials/` vs `material/`; audit cache-key determinism vs
   `shortId`.**
7. **(DEFERRED, as planned) Distributed stun/turn/ice/relay stack** — keep last
   per the overarching plan; revisit once §1–3 stabilize.

---

## Appendix — quick stats

- Source: 100 files / ~75,656 LOC; tests: 76 files.
- Test run: 575 pass / 2 skip / 0 fail.
- Debt markers in src (`TODO|FIXME|HACK|XXX`): 0.
- Hardcoded `/@fs/home/cos` paths in src: 6 (all in `peercomputeBrowserResidentHost.js`).
- Living-doc line counts: `plan.md` 2,131 · `implementation-status.md` 5,495 ·
  `log.md` 25,002 · `tests.md` 8,861.
- Plan ledgers: `done/` 74 · `todo/` 17.
