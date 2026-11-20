# G5 bounded CAS multi-consumer reservation

## Accepted — 2026-11-18 UTC

All three original G5 criteria pass: candidate review, reservation invariants
and lifecycle correctness. The exact source-bound bundle has three unique PASS
events; ICC selected the original G5 oracle, one input file, with no dropped or
truncated criteria/events. Independent source and final-bundle reviews pass.

The lifecycle fixes fence destruction/retirement before external callbacks,
detach old resource lists, preserve returned operation identities during audit
re-entry, and retain replacement named ledgers created during cleanup.
Six of seven added regression cases failed before the fix. Final verification:
**81 pass, 0 fail, 0 skip** (15 ledger, 33 ULG control-plane, 33 related ownership
and state-management tests). The independent reviewer also ran all 15 ledger
tests. All 411 ULG and 178 PeerCompute manifest hashes remained unchanged.

Scope: one authoritative JavaScript realm, bounded CAS and resource lifetime.
The real-manager ULG test uses manufactured schedule/fence evidence. No GPU
execution, physical correctness, distributed exactly-once or durable recovery
is inferred. The legacy StateManager fallback remains outside the guarantee.

Evidence: `/home/cos/.cache/icc/repos/ulg/g5-acceptance-20261118/`, including
`executed-checks.json`, `final-tests.log`, `source-manifest.json`,
`independent-review.md`, `final-bundle-signoff.md`, `g5-reviewed-receipts.jsonl`
and `g5-oracle.json`. Both scoped production audits show only intentional
uncommitted-source notices; both full-tree rollback guards pass.

G5 and G7 are accepted. G1–G4, G6 and A1–A6 remain open at their original scope.
Next is first-class-air worker publication and the path to G2's visible plume.
No commit, push, merge or Pages build.

The records below are historical and preserve the original failures.

## Acceptance review — 2026-11-18 UTC: still open

The existing PeerCompute and ULG suites pass 41 tests together, but direct
review reproduced two missing lifecycle cases in `ReservationLedger.js`:

- `attach(token, release)` still succeeds after `destroy()`, leaving one live
  resource on a destroyed ledger that will never release it.
- A release callback invoked by `retire()` can still commit the retiring
  token at its old epoch; callback re-entry and fence ordering need explicit
  treatment before acceptance.

No PeerCompute source was changed in this review. Reproductions and original
passing logs are in `~/.cache/icc/repos/ulg/g5-g7-acceptance-20261118/`.
Next: fix these cases and verify re-entrant callbacks, destruction and retirement
alongside the existing contention/epoch/ULG consumer tests. No distributed
exactly-once claim is added.

Date: 2026-11-14. Task: ICC `ulg-g5-reservation`. Oracle:
`ulg-g5-reservation`.

## Gap

Predecessor target tokens were consumed by a read-then-commit sequence:
1. `readStateManagerWarmEntry(...) == null`;
2. `commitDelta` into the warm store.

The warm store is last-writer-wins and checks no versions (see
`ulg-statemanager-no-exactly-once`). An erased or overwritten warm receipt
therefore made a consumed token available again. Nothing fenced epochs or
owned resources.

## Delivered

**PeerCompute: `stateManager/ReservationLedger.js`.** Exported from the
package index.
- **StateManager API:**
  - `createReservationLedger({ name, maxKeys, auditNamespace })`;
  - `getReservationLedger`;
  - `destroyReservationLedger`;
  - the manager's own `destroy()` releases every ledger.
- **Bounded model.** One ledger in one realm is the authority. Each operation
  is a synchronous CAS, so interleaved asynchronous consumers (lanes, worker
  requests routed through this realm, async tasks) see one linear order. The
  optional audit records written with `writeScoped` are evidence only.
  Nothing claims distributed exactly-once.
- **Per-key states:**
  - `free(e)` → `reserved(e, id, owner)` → `consumed(e)`, which is exactly
    once;
  - `cancel` returns a key to `free(e)`, and losers retry;
  - `retire` moves a key to `free(e+1)`, the epoch fence.
- **Tokens** carry the ledger id, key, epoch and reservation id. A token is
  valid only while its reservation id is the key's live reservation at its
  epoch, and only in the ledger that issued it, so a restart cannot replay
  it.
- **Refusals** are explicit: `busy`, `consumed`, `stale-epoch`, `replay`,
  `not-owner`, `foreign-ledger`, `capacity` (`maxKeys`, the bound) and
  `destroyed`.
- **Resource lifetime.** Attached release callbacks run exactly once: on
  cancel, on retire, or on ledger destruction. A committed reservation keeps
  its resources until retirement.

**ULG: `schroederWorkerLaneControlPlane.js`.** Token consumption now goes
through the ledger `ulg-schroeder-target-tokens` (audit scope
`ulg-schroeder-target-token-reservations`):
- the token is reserved at epoch 0 and committed (exactly once) before the
  warm receipt is written and before lease acquisition;
- a StateManager without the ledger API keeps the previous check.

## Evidence

**PeerCompute** `tests/unit/reservationLedger.test.js`, 8 of 8 pass:

| Test | What it shows |
| --- | --- |
| Single winner | 64 interleaved consumers race for one key; one wins, and every loser sees `busy` with the winner's id |
| Exactly once | Replay, and reservations after consumption, are refused |
| Loser retry | Retry works after cancellation; cancellation releases resources once |
| Epoch fencing | Retirement invalidates old tokens, expected epochs and cancels; committed resources are released at retirement |
| Ledger-bound tokens | A restarted ledger refuses old tokens |
| Capacity and destruction | The capacity bound holds; destruction releases each resource exactly once |
| Randomized model check | 5 seeds × 12 consumers × 60 operations over 4 keys, with random retire, cancel and commit. Unique admission ids; each (key, epoch) consumed at most once; a live owner is beaten only by retirement; every resource released exactly once; counters agree |
| StateManager integration | Audit mirroring works; a forged audit record changes nothing; destroy releases resources |

Related PeerCompute suites (StateManager, DataState, ComputeManager
commitDelta, GPU resident lanes): 40 of 40 pass.

**ULG** `tests/schroederWorkerLaneControlPlane.test.mjs`, 33 of 33 pass. The
replay test now also erases the consumed token's warm receipt; the ledger
still refuses the replay (`predecessor-target-token-replayed`) and no
schedule executes.

## Limits

- One realm. Cross-realm or cross-peer exactly-once needs a single
  authoritative realm, or consensus. That is A6's remote derivation work,
  and it is not claimed here.
- The ledger is in memory. A page reload starts a new ledger, and tokens
  are bound to their ledger, so a reload cannot replay them. They are also
  not redeemable after the reload, matching the existing fail-closed
  restart semantics.
