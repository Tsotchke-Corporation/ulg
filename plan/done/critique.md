# Plan Complexity Critique — 2026-06-16

Question asked: *is the current plan too complex?*

Short answer: the **architecture** is not too complex for the stated mission —
but the **plan as it is currently being executed** is, and the gas-cell work is
the tell. The complexity isn't wrong, it's **mis-sequenced**: full architectural
overhead is being paid on every slice before the CPU oracle it's all gated
against is trustworthy for liquids.

---

## Two different "complexities" — keep them separate

### 1. Target architecture — justified, do not simplify

A distributed, law-graph physics engine with PeerCompute authority, CPU/WASM/
WebGPU lanes, content-addressed caches, and Eshkol/MoonLab closures is
inherently complex. That is the stated mission ("ULG is about physics laws…
more laws will be added"). The authority boundary, admission gating, and
CPU-oracle-as-promotion-gate are sound and worth the cost. Do **not** simplify
the destination.

### 2. Execution plan / bookkeeping — overgrown

This is where it is too complex, with concrete evidence:

- **Descriptor churn vs. unsolved core.** The last two days produced ~25 "done"
  items, nearly all gas-cell pressure-field *plumbing* (`…field-import`,
  `…field-admission`, `…import-publisher`, `…retained-ref`,
  `…source-provenance`, `…source-consumption`). Each adds a schema + admission
  layer. Meanwhile the headline P0 — MLS-MPM water does not render coherently —
  traces to a **6-line G2P renormalization bug** (see
  `6-16-audit.md` and the resident G2P path: `mlsMpmCarrier.js:418`,
  `sphG2pGpuKernel.js:307`, `ulg-gpu-abi/src/wgsl.js:4924`) that sat untouched.
  That ratio — dozens of authority descriptors to one unfixed physics line — is
  the strongest signal the plan has drifted from value to ceremony.

  2026-06-17 correction: the execution critique still stands, but the exact
  "6-line G2P renormalization bug" attribution was not supported by current
  evidence. The G2P toggle did not move the current H2O/H2O fixture. The
  resident/browser regression was the split grid-update floor clamp freezing the
  first interior row (`y <= dx`); that is now fixed and guarded by a resident
  long-horizon free-surface gate.

- **Docs have become logs.** `implementation-status.md` is 5,495 lines (the spec
  asked for *short*); `plan.md` holds 83 chronological "Current checkpoint"
  blocks; `plan/done/` has 74 files. The artifact meant to be checkable "at any
  time" is no longer skimmable. That is complexity paid on every resume.

- **Granularity mismatch.** 74 done-files for slices this fine means the plan is
  tracked at the wrong altitude — each retained-ref descriptor became its own
  ceremony with its own validation note, visual matrix run, and checkpoint.

---

## The deeper issue

The plan's own routing rule already states it: *"authority and distributed law
execution… do not count as done while the visible physics loop is incoherent."*
The work order has been doing the opposite — hardening distributed authority
descriptors on top of a physics loop that still fragments. You are paying full
architectural overhead on every slice before the CPU oracle it is all gated
against is actually trustworthy for liquids.

2026-06-17 update: this is now partially remediated for the headline H2O/H2O
resident MLS-MPM spread regression. Do not treat that as permission to resume
descriptor churn indiscriminately: the next architecture slices should still be
small, test-gated, and subordinate to visible physics gates.

---

## What to cut / reorder (not redesign)

1. **Freeze new authority/descriptor layers** until the CPU + resident physics
   oracle passes the free-surface gate for MLS-MPM and SPH liquid, ice/solid
   rigidity, and z-buffer/draw-order. Per the existing rules these gate "done."
2. **Collapse the docs:** one short `implementation-status.md` (current P0 /
   in-flight / last-green / next); move the 83 checkpoints and done-files into
   `log.md` or a dated archive.
3. **Raise plan granularity** to law-family milestones (e.g. "pressure/gas
   coupling" as one item with sub-checks), not one item per retained-ref schema.
4. **Keep the architecture exactly as designed** — just stop building it ahead
   of the oracle.

---

## Verdict

Not too complex to *be*. Too complex to *be running right now*, because the
hard, simple physics work got out-prioritized by elaborate plumbing. Fix the
resident split parity bugs and clear the liquid/visual gates first, then resume
the authority migration on a trustworthy oracle. The 2026-06-17 floor-boundary
fix clears the immediate resident H2O/H2O spread gate; remaining visual quality,
solid/ice behavior, z-buffer/focus trust, and architecture hygiene remain open.
