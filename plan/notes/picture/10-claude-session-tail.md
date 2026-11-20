# Digest J: the tail of Claude's session, 2026-11-17 06:14Z to 20:19Z (after its last compaction)

Source: `~/.hermes/cache/scratch/ulg-import/dialogue.md` (assistant text and user messages from transcript lines 64265-69057). Figures are Claude's.

## Claude's last full status table, given to the user 2026-11-17 16:05Z
("The percentages are my judgment of remaining scope, not measurements; the speed figures are measured.")

| | What | Done | Where it stood |
|---|---|---|---|
| G1 | Frame rate on all presets | ~35% | Failed and deferred by the user 2026-09-13; waits on A1 |
| G2 | Conserved steam and aerosol plumes | ~90% | Steam rises in vacuum and in room air (iron melts the ice and boils it). Open: iron-cools fails (8 K in 4 s vs 10 K needed), left until A5 by user choice |
| G3 | Coherent solids | ~95% | Delivered. Left: the Iron Ice coupling (via A5) and a long-run memory growth |
| G4 | Laws idle where nothing happens | ~80% | Exact dormancy default on every preset, per-schedule receipts, bit-identical. Left: workgroup compaction (part of A1); eps > 0 needs approval |
| G5 | Shared reservation ledger | ~95% | Delivered with tests |
| G6 | Local fit and cache | ~95% | Delivered with tests |
| G7 | Scientific release audit | ~95% | Delivered with tests |
| A1 | Real-time speed | ~25% | water-realtime runs in real time. Iron Ice ~13 steps/s room air, 21 vacuum, vs 2,000 |
| A2 | Incremental spatial updates | ~50% | Parked: rebuild is at most 6% of GPU time |
| A3 | Representative sampling | ~65% | Sampler entirely on the GPU, passes its native test. Not used inside the live step |
| A4 | Derived material functions | ~55% | "The plan and its parts exist; it isn't used live" |
| A5 | Solid mechanics and more tree levels | ~35% | Body-body contact done; solid-fluid heat and contact wired; N-level chain Phase A done. Not started: deformable surfaces (SOL-4), melt/fracture topology (SOL-5) |
| A6 | Remote derivation across peers | ~85% | Runs across browser peers. Cross-host needs the user's go-ahead (user: "not now") |

## What happened after that table, in order
1. 06:14-07:21Z (before the table): N-level chain Phase A (level index, coverage admission, epoch transaction check accept a chain; a test that pinned the two-level-only contract was updated: a third level must be a valid 2:1 link, a chain longer than the cap is rejected). Current-volume wall clearance tried and reverted. Amagat buoyancy verified in vacuum Iron Ice: steam (6 rows, 0.16 mg) reaches the ceiling, 6,000 of 6,000 admitted, 21 steps/s. Host suite 6,004 tests, 0 fail.
2. 16:05-17:36Z: mixture parcels stage 1 (closure module, Atmosphere-panel select `environmentAirParcels`, tests). Four room-air drift bugs fixed (vapor density basis, Amagat seeding, stand-in atmosphere density, gas-gas conduction). Room-air Iron Ice in both modes holds position; parcel temperatures agree within 4.8 K. Room-air water-cycle 6,000/6,000 admitted. Default water-cycle 6,000/6,000 at 47.7 steps/s.
3. 17:46Z USER: "should I be seeing any steam yet? yes proceed to stage 2".
   - Claude's answer: NO, not visibly. Default (vacuum) Iron Ice boiled ~0.16 mg in 4 simulated seconds, in 6 small parcels that do reach the ceiling: real, but far too little to see in a 2.7 L box. Two reasons: (a) the iron slides off the ice instead of sitting in a melting crater (the A5 item); (b) the parcels are coarse, so only a thin layer reaches boiling. In room air, some of the steam seen rising earlier was the vapor-volume bug.
4. 17:48-19:02Z: stage 2. A sub-agent survey found no composition-aware path on the GPU and that mixture mode silently had no oxidation path. Design chosen: lift each reaction onto the parcel (composition set) rather than a per-row composition sidecar. Done and live: 81 mg FeO from the parcels' oxygen; three air parcels fully used; 60 mg of oxygen-free residue stays at 297 K; 2,131 of 2,131 traced steps admitted. Species mode: 3,304 of 3,304. Host suite 6,008 tests, 0 fail.
5. 19:03Z: FeO at ~6,780 K examined. 19:04-19:12Z: vacuum Iron Ice with a 20 s render-worker CPU profile; the window caught the cold start (2.4 steps/s, 95% idle), so `S0_CPU_PROFILE_DELAY` was added to the probe.
6. 19:58Z USER asked to back off the GPU (the 50% request).
7. 20:06Z Claude's report:
   - GPU: every probe in a CPU-throttled scope (50% cap), `nvidia-smi` logged, cooldowns. "At that cap a run averaged 42.5% total GPU, including your ~22%, so about 20% was mine. Short bursts still reach 100%. Without root access to cap GPU clocks, the only other control is running less on the GPU."
   - Per-step JS: the optics declaration-row checks are deliberate tamper detection (rows must equal their private snapshot each use). Skipping them would weaken the authority model; making them cheap means redesigning ownership. Left for now.
   - Iron Ice speed: GPU-bound at ~40 steps/s with the per-step contact audit off; 512 and 128 cleanup passes both give 37-40. 64-step schedules reached 59, so ~130 ms is lost at each 16-step schedule boundary (fence, commit, presentation): "the clearest remaining speed lever".
   - A DECISION FOR THE USER, STILL UNANSWERED: FeO overheating. Causes: the heat proxy (kept by user choice) puts all reaction heat into the products; and the FeO properties are a rough derived estimate (one version melts at 51 K; real FeO melts near 1,650 K and boils near 3,700 K). Proposed fix: add reference FeO data to the material bank and anchor product properties to it, so the oxide can boil and cap its temperature. "That changes how reaction products behave, so I'd like your go-ahead first."
8. 20:07Z: started the A1 schedule-boundary work with code reading: what happens between one resident schedule ending and the next starting, and whether the Tier-0 pipelined boundaries can apply to the canonical lane. Then one throttled probe.
9. 20:18Z: stopped the probe for the driver update. Last words: "I was measuring the gap between Iron Ice simulation schedules: about 100 ms of page work after each schedule before the next one is requested. The next step was profiling that page work. I won't run anything until you say resume. When you do, I'll first confirm the new driver works (nvidia-smi, plus a check that WebGPU still gets an adapter), then continue at the 50% GPU budget."

## Rates, reconciled
- Audited runs (per-step contact audit, authority observation): vacuum Iron Ice ~21 steps/s, room air ~13-14. These are the runs with "N of N admitted".
- Unaudited: vacuum Iron Ice ~37-40 steps/s. The audit itself is a ~3x slowdown.
- The 2026-11-16 "true rate ~19" was an audited figure. The 42-49 "census regime" figures stay invalid (those steps rolled back).
- Target for near-real-time Iron Ice: 2,000 steps/s at dt 0.5 ms. So 40 steps/s is 2% of real time.
- water-realtime: real time by default (1.29 sim-s/s at 60 fps). Default water-cycle 47.7 steps/s.

## Things the stop hook listed as open at the very end (20:06Z)
G1 deferred; G2 iron-cools failing; FeO ~6,780 K; A1 at ~40 steps/s against 2,000; A2 parked; A3 and A4 not used in the live step; A5 with deformable surfaces and melt/fracture topology not started; A6 pending a go-ahead; mixture parcels still opt-in; the optics tamper-check overhead left unchanged; nothing committed.
