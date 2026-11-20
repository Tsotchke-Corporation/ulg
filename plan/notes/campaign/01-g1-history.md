# Campaign note 1: G1's history and what it measured (September 2026)

Source: `plan/todo/seven-goal-campaign.md`, all 1,429 lines. Hermes read lines
1-40, 311-456 and 828-1067 in the first pass (digest `picture/07`), and lines
41-310, 457-827 and 1068-1429 on 2026-11-17 for this note. The file is now read
in full. The September text was written by the earlier agent (Codex) in a
dense checkpoint style; the numbers below are its own.

## What G1 is, and is not

- "approximately 60 Hz visual presentation, not 60 Hz real-time physics.
  All-preset solver real-time speed belongs to A1" (digest `picture/07`).
- Repeated at almost every checkpoint: "actual all-preset real-time physics
  remains A1, not a G1 prerequisite" (`:687`); "do not add real-time physics as
  a G1 blocker" (`:1154`); "All-preset solver real-time remains A1, not an
  extra G1 gate" (`:1312`).
- The measure is decoded changes of scene pixels in a fixed crop per second of
  wall time, from a desktop capture. "These measurements do not substitute
  simulation time or HUD callbacks for visible changes" (`:816-817`).
- The oracle `ulg-g1-presentation` has nine authored criteria. Best recorded:
  "5 PASS / 4 FAIL (blocked)" (`:634`).

## The numbers (scene changes per wall second; target 54)

| Build / date | water | iron/ice | sodium | Cs/F | bulk | dam |
|---|---|---|---|---|---|---|
| item 68, 09-07 (`:811-813`) | 52.2 | 50.0 | 53.8 | 2.7, stops | 57.0 | 55.6 |
| v4, 09-07 (`:692-694`) | 50.1 | 50.1 | 54.1 | 2.6, stops | 56.1 | 56.0 |
| v5 sweep (`:672-674`) | 51.3 | 53.5 | 53.8 | 2.6, stops | 54.3 | 56.2 |
| v6, 09-09 (`:657-658`) | 72.1 | 56.8 | 82.5 | 2.0, stops | 98.3 | 96.6 |
| gas-lifecycle candidate, 09-09 (`:537-538`) | 49.1 | 50.6 | 54.2 | 2.0, stops | 55.5 | 56.1 |
| v3 decoder, 09-13 (`:340-342`) | 70.8 | 55.2 | 76.8 | stopped | 97.5 | 96.6 |

Every row carries the same caveat: "bounded sampled rates do not establish
sustained performance or all-six optics/lifecycle acceptance"; "this is not
scanout, every-second cadence, fresh physics per frame or a causal improvement
claim" (`:659-660`). The strict all-six sweep stayed "0/6", but "The current
admitted-input sweep hardcodes visibleMotionCadenceVerified false ...;
historical strict 0/6 is NOT evidence all six are currently below 54 Hz"
(`:1306-1308`).

So five presets were at or near the target in presentation terms. Two things
failed G1: cesium-fluorine stopped, and the evidence could not prove sustained
cadence with optics and controls on all six.

## Why cesium-fluorine stopped (an SS two-level finding)

- Cs/F is the two-level preset. Its macro step at dt 0.0005 with ratio 2
  rejects on a nodal CFL check ("field 973"; "prior field speed 1,006.411 m/s
  above the 635.239 m/s CFL limit", `:507-508`).
- "trial 34463 accepts four full r2 macros at dt 0.000125 over the original
  0.0005 interval, with fixed materials and unchanged
  conservation/positivity/CFL gates" (`:619-622`). r4 at the original dt still
  rejects (`:583-585`).
- "Do not promote fixed dt/ratio settings or keep trying arbitrary smaller
  values" (`:1202`). The delivered form is recovery: "v5 preserves the
  four-child recovery first; only a fully retired, authenticated physical
  failure permits one whole-root restart with eight fresh children. No failed
  prefix is reused, physical gate relaxed, or preset branch introduced"
  (`:321-324`).
- Result: "The actual desktop run advances 16 committed sources from 15 to
  255, through 45.227 wall-clock seconds" (`:326-328`). That is about 5 source
  schedules per second: functional, far from 54.

This is adaptive time refinement of a two-level macro on rejection. It is the
only time subdivision SS does today, and it is reactive (retry after a failed
admission), not the per-level subcycling the SS plan describes.

## What the presentation investigation found (still relevant to G1 and A1)

- Host scheduling, not GPU rendering, bounded the rate: "worker next-request
  median 0.383 ms versus request-to-delivery 18.35 ms" (`:1347-1348`); the
  seven render passes total a median of 0.060 ms (`:1350-1352`).
- "An 80.051 ms offscreen-worker message task postpones renderer timer ...
  sampled stacks show repeated authority/transition/configuration validation
  and stable-token/TextEncoder/SHA256 fingerprinting" (`:1272-1275`). A
  call-local hash memo cut that host work 14.6-21.1% without a proven delivery
  win (`:1294-1299`).
- Major GCs of 39 ms and 241 ms; retired buffer families retained "through
  GPUDevice.lost and a weak callback's strong parent context" (`:1396-1399`).
- Tried and not kept: initial busy-slot batching (`:1244-1258`); a
  camera-upload cache, "**withdrawn**" (`:792-796`); a host-task yield,
  "reject production adoption" (`:1377-1378`). Kept: the final-Jacobi wait
  (+5.8%, `:1101-1103`); pipeline cache reuse (52 → 4 pipeline creations,
  `:1138`).
- Early water moves little on screen: "median 34 changed pixels versus iron
  737 ... This is not evidence to amplify motion, enlarge bounds or introduce
  field morphing" (`:1323-1326`).

The 11-03 audit's A-prime plan and the A1 slices of 11-14 to 11-16 (presentation
holds, coupling) are the same problem met again from the physics side.

## The owner's decision, 2026-09-13 (`:311-318`, `:351`)

"The user ends the current G1 performance effort as **FAILED acceptance** and
defers remaining work until the architectural follow-ons. Preserve improvements
and failed evidence; do not claim the all-preset 54 Hz target was met,
impossible, or relaxed." "Delivery sequence is G2-G7, then dependency-led A1-A6
and G1 reassessment."

## The Codex-era G2 (09-13 to 10-25), in one paragraph

G2 began as diagnostics on SS-owned gas cells (species partial pressure,
saturation), then an aerosol inventory with "exact u64 physical droplet
multiplicity", a conservative pre-transfer extraction, local occupied volume in
the gas EOS denominator, paired outer publication, and donor-resolved optical
accounting. Each was proved on manufactured inputs; "No preset enables the new
extraction path" (`:490`). By 10-25 it had turned to exact-rational caloric and
reaction arithmetic, and stood at "G2 stays at 3/6 original child items"
(digest `direction/03`). The owner stopped it on 10-27 ("Stop and review
first"), and integer ledgers replaced the rationals. The room-air and nuclei
decision of 09-14 still binds.

## For the reassessment of G1 (Hermes, INFERRED)

1. G1 needs a presentation consumer that shows a fresh admitted state at
   display rate on every preset. In September that was nearly true for five
   presets and blocked by a physics stop on the sixth.
2. Since then the scenes changed (room air, rigid ice, mixture parcels) and
   presentation was partly re-coupled to physics steps for water-realtime. The
   September numbers cannot be carried forward.
3. Open question 4 in digest `picture/11` (redefine the G1 receipt as
   "presented steps == physics steps") would merge G1 into A1. The campaign
   text keeps them apart on purpose.
