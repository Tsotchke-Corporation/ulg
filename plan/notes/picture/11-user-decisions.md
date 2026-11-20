# Digest K: the user's decisions and directives, 2026-10-24 to 2026-11-17

Sources: `~/.hermes/cache/scratch/ulg-import/askq.md` (AskUserQuestion answers, deduplicated here) and `user_messages.md` (all 83 typed prompts; times are UTC).

## Decisions made through questions (question in brief -> answer)
| When (UTC) | Question | Answer |
|---|---|---|
| 10-27 | Direction for G2 after Codex's exact-rational path | "Stop and review first" |
| 10-27 | Commit Codex's R327 work locally as WIP | "Yes, local commit" |
| 10-27 (typed) | Proposal section 5 Q1-Q4 | "1 yes, 2 sure, 3 disabled, 4 25 min is insane these should run near realtime." |
| 11-14 04:03 | Meaning of a particle's energy u | "Internal energy" |
| 11-14 04:29 | Phase 2 phase rule | "Keep type 2, make it exact" |
| 11-14 07:18 | Reaction energy on the ledger | "Heat proxy" |
| 11-14 07:18 | Phase 2 gate's "Iron Ice past vapor onset" clause | "Accept water-cycle" |
| 11-14 07:18 | When contact fails closed, thermal skips conduction that step: keep? | Keep fail-closed (answer text truncated in the extract; Claude's notes record "contact fail-closed stays") |
| 11-15 03:54 | Add an interface-boiling law? / A1 presentation trade-off? | User declined to answer in that form and typed instead: "we should avoid adding bespoke laws for specific scenarios otherwise things will not work generally. what is the main issue here?" The A1 presentation trade-off question has no recorded answer. |
| 11-15 04:16 (typed) | Resolution vs interface law; walls | "increase the resolution at the interface because we want to support that kind of dynamic functionality and if it tanks our frame rate we implement the second method. as far as the walls are concerned go ahead and make honest walls that aren't infinite sinks" |
| 11-15 22:28 | Switch the ledger route to reference thermochemistry for humid-air Iron Ice? | "Keep the heat proxy" |
| 11-15 22:28 | Start the Eshkol-derived larger-dt slice? | "Start, 1% error budget" |
| 11-15/16 | The 1% budget cannot be met on momentum; how to apply it | "Second-order stepping" |
| 11-16 04:08 | Make the real-time flags the default for water-realtime (19 fps then) | "Default for water-realtime" |
| 11-16 05:48 | The "GPU-scheduling workaround" (4-byte copy + map) | User asked to clarify, then typed: "test it in a regular browser session and make it the default if it is still faster with persistent visual updates". It was later found to be an artifact and removed. |
| 11-16 08:49 | G4 eps > 0 | "Allow eps > 0 as opt-in" |
| 11-16 08:49 | Build general interface boiling | "Build general interface boiling" (the question was misframed; Claude corrected it at 14:58: boiling at the hot iron already worked) |
| 11-16 08:49 | A6 run across two machines | Not now (truncated in the extract; Claude's notes record "A6 cross-host: not now") |
| 11-16 14:58 | How to unblock the visible plume in room air | "Gauge-consistent heat proxy" |
| 11-16 18:03 | A cell the condensed matter overfills | "Minimum gas fraction" |
| 11-16 18:54 | Air out of contact, or contact redesign first | "Air out, then redesign" (premise was wrong; corrected at 21:22) |
| 11-16 21:22 | First-class air or contact redesign first | "First-class air first" |
| 11-16 21:26 | Lift the hold on a third SS level | "Lift it: 3+ levels" |
| 11-16 21:26 | One parcel with composition, or species rows | "Mixture parcels" |
| 11-17 03:45 | steam-rises check at a closed ceiling | "Per-carrier band" |
| 11-17 03:45 | iron-cools (8 K measured, 10 K required) | "Leave failing until A5" |
| 11-17 05:51 | Shape of the generalized hierarchy | "N-level 2:1 chain" |
| 11-17 05:51 | sol-critic Priority 3 gate (sparsity before a third level) | "Waive it" |
| 11-17 07:22 | How mixture parcels handle consumed oxygen | "Full composition" |
| 11-17 17:52 | Stage 2 implementation | "Composition set" |

Context worth keeping from the 11-16 14:58 question: "The visible plume needs room air, so steam can condense into droplets on nuclei." The visible G2 plume is therefore the humid room-air Iron Ice route, not the vacuum default.

## Typed directives (verbatim, in order)
- 10-24: "lets resume the full scope of g2. make the local commits and then write a new handoff doc in plan with the current date"
- 10-27: "pick up where codex left off and see if you can finish G2"
- 10-27: "why does moving things to a ledger help? why aren't we bounding the GPU passes to something more reasonable like 2 passes?"
- 10-27: "yes add it, then start phase 0"
- 10-27: "please stop any work for now. I'll tell you when to proceed" / 10-28 "ok proceed"
- 10-28: "can you look over the full todo list plans around architecture and refactoring first"
- 10-28: "Now I want you to read the entire dev log and every line of code in the application. make sure you're using icc. and tell me if your plan changes"
- 11-04: "write this up with the date and put it in plan/todo/<date>audit.md"
- 11-14: "actually we should defer architecural work until we reach the correct phase. and at least finish out this goal first. would it be smarter for us to actually do the arch work before the goal work?"
- 11-14: "yes move it to A1, allow dt 1 ms"
- 11-14: "are you using any chrome browsers at the moment? I need to run pkill chrome to free up my gpu"
- 11-14: "stay on 1ms to speed up testing. skipnthe commit"
- 11-14 05:35: "/goal push all the way through the rest if thw goals" (THE STANDING GOAL)
- 11-14: "did you crash? what is the status?" / "you crashed again. dontbgaslight me about it this time"
- 11-14: "is creep related to the dt relaxation? it could be an acceptible regression"
- 11-14 22:14: "one thing you shoukd be cautious about. dont fall into a pitfall of over anslysis or conflating an overly detsiled plan with the actual goal. keep your eyes on achieving the goals swiftly and the order doesnt matter if all goals are uktimstely achieved. if it mskes sense to defer closing a goal until additional architecural chsbges are complete we shoukd absolutely do so.therefore 2"
- 11-15: "moonlab and eshkol slready have wasm builds and webgou support" / "you msy need to look at the availsble branches on origin" / "wait why are youbrunning stuff host side? eshkol and moonlsb should be running in the client under wasm" / "definitely make sure youre using the eshkol wasm buikd thst supports webgpu" / "definitely use the webGPU moonlab if it exists." / "you should submit a PR for this moonlab fix"
- 11-15 06:08: "I think I have to restart my display manager I'm not sure if you'll get taken out" / "I restarted"
- 11-15 06:14: "is this running somewhere I can test? what demo should I test?"
- 11-15 06:17: "lmao the z buffer is all fucked up I'm sure you know this right? don't let me interrupt you though we can fix that later."
- 11-15 06:20: "there seems to be a 2hz discontinuity in the surfaces" / "like some kind of surface geometry or volume updae" / "I mean the request animatino frame timing fits the bill" / "anyway we'll fix that later stick to your core goals for now"
- 11-15 21:27: "part of the idea for getting to realtime is to use Eshkol derived approximations at higher dts. are you working that yet?"
- 11-16 00:11: "can you stop stealing focus while i'm trying to do work?"
- 11-16 21:21: "this orobably means we need to treat air as a first class sim object in the sph sim like everything else"
- 11-16 21:25: "do we still have dynamic subvivisoon of contsct surfaces? air coukd follownthe same pattern. big ss partickes/cubes for contiguous air volumes and smaller ones where they touch other materials"
- 11-16 23:24: "im hoping thisnwill be solved with optimizations around simulating only representative samples and with Eshkol approximated functions for complex underlying behavior"
- 11-17 00:26: "we really shouldn't ever be running anything on the host. I thought we already clarified that"
- 11-17 00:33: "move the A3 sampler to the gpu too"
- 11-17 17:46: "should I be seeing any steam yet? yes proceed to stage 2"
- 11-17 19:58: "can you back off of the GPU a little and maybe don't use more than 50% somehow?"
- 11-17 20:18: "I'm going to update my nvidia driver. can you pause work until I tel lyou to resume"
- Hermes session, 11-17: "hey it looks like you're making code changes before getting the full picture is that true?" / "you can increase the budget to 80% gpu. I just don't want it to crash my window manager. don't rever what you've done but I want you to get the full picture of where you were with all the goals and architecture tasks before resuming actual dev work."

## The user asked five times for the same report
"give me a high level overview and estimated percentage completion for every goal and architecture task" (11-15 05:49, 19:03, 21:17; 11-16 02:49, 15:39; 11-17 16:05). That is the report format the user expects.

## Questions still waiting on the user (as of the Claude session's end)
1. FeO overheating: add reference FeO data to the material bank and anchor product properties to it? (asked 11-17 20:06, no answer)
2. Contact-failure liveness on the canonical lane: escalate the pass budget or publish a partial result rather than hold (raised 11-15 in the interface-skin-law note as "user decisions pending"; Hermes has not found an answer)
3. The steps/s target and which laws count for A1 (never defined in a plan)
4. G1 receipt redefinition (presented steps == physics steps), from the 10-27 review
5. Longer default schedules / presentation rate trade-off (`residentStepsPerSchedule=64`: 59 steps/s at 10 frames/s)
6. Mixture parcels as the default (Claude said: only after visual and acceptance checks are re-run in that mode)
