# Digest I: Claude's last compaction summary (transcript line 64234, state as of 2026-11-16 late)

Source: `~/.hermes/cache/scratch/ulg-import/compact_summary.md` (extracted from `8857fa92-3dba-4788-81f5-1e353c3d1ca5.jsonl`).

## The standing goal
- A stop hook held Claude to the user's instruction: "push all the way through the rest if thw goals". Complete G1-G7 and A1-A6.
- The hook kept listing open items: the buoyancy double count, mixture parcels, A5 (iron-cools failing), A1 speed, in-step A3, the G4 phase-change slice, G1/A6 deferred, and nothing committed.

## User messages in that segment (verbatim)
- "im hoping thisnwill be solved with optimizations around simulating only representative samples and with Eshkol approximated functions for complex underlying behavior" (about simulation cost)
- "where is that in our architecture roadmap btw" (answered: A3/A4 in `seven-goal-campaign.md`, plus the Eshkol plan; a gap was noted for interface heat transfer)
- "we really shouldn't ever be running anything on the host. I thought we already clarified that"
- "what exactly do you mean when you say host anyway?" (answered: host = the CPU/JS side; device = the GPU)
- "move the A3 sampler to the gpu too" (done)
- Decisions: steam-rises check uses "Per-carrier band"; iron cooling "Leave failing until A5".

## Constraints as Claude carried them
- No commit, push, merge or Pages build.
- Headless only (`ULG_HEADED=1` only with permission).
- Do not edit `src/` during live runs.
- Engage ICC. Task attempts go through `python3 scripts/codebase_tool.py task-attempt` in `/home/cos/projects/infinite_context_coder` (the ICC MCP is query-only).
- One GPU workload at a time. Memory-capped native tests. Compile-check WGSL.
- Never `pkill -f` your own pattern. Check `journalctl -k` for Xid/OOM.
- The user's email is private.
- Contact fail-closed stays. Iron Ice at dt 0.5 ms.
- Any approximation weakening G2 acceptance needs approval.
- Nothing on the host.
- Never open the diff panel or run /diff.

## State at that compaction
- Solved: room-air Iron Ice conducts, melts, boils and steam rises. Vacuum Iron Ice runs at 25 steps/s with steam at default settings. The scientific-calibration arm passes except iron-cools. A3 runs on the GPU. Gas mixture law live: room air 6000/6000, contact 1023/1024. Host suite 6004 tests, 5896 pass, 0 fail.
- The iron-ice-quench preset runtime gained `contactInnerRounds: '2'`.
- A3 on the GPU: `src/runtime/material/regionalClosureSamplerGpu.js` (envelope atomics, plan, workgroup tensor-Chebyshev fit with held-out bound, `rf_eval` lookups, async pending fits with boundary adoption, verify pass); gate `tests/regionalClosureSamplerGpu.native.test.mjs` (`ULG_RUN_NATIVE_A3_GPU=1`). Host `regionalClosureSampler.js` deleted.
- Explicit fusion/boiling gate: `tests/sphPhaseCarrierExplicitFusion.native.test.mjs` (`ULG_RUN_NATIVE_EXPLICIT_FUSION=1`), 7 cases.

## Pending tasks at that compaction
1. Finish the implicit ambient buoyancy fix for explicit room air. (Later resolved differently: Amagat fix; implicit atmosphere kept and matched. See digest A.)
2. Mixture parcels (first-class air slice 3) [stage 1 and 2 done 2026-11-17, opt-in]; slice 1c split kernel; slice 6 retire air special cases.
3. A5: iron runs off the ice, so iron-cools fails (1850 -> 1842 K vs 10 K) and steam is tiny (0.18 mg).
4. A1 speed: ~14 steps/s room air, ~25 vacuum.
5. In-step A3 consumer; G4 phase-change slice and compaction; A5 SOL-4/5; G1 and A6 deferred.
6. Commits are not allowed.
