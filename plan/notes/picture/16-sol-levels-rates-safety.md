# Digest P: SOL levels and priorities, Iron Ice timing history, machine-safety evidence, the GPU wrapper

Sources: `plan/todo/sol-critic.md` (679-728, 830-906, 962-988), `plan/todo/a5-solid-fluid-coupling.md` (56-87), `plan/todo/a1-eshkol-coarse-dt.md` (477-552), the kernel journal of boot -1 (2026-11-12 to 2026-11-17 11:20 AKST) and boot 0, `coredumpctl`, Claude's transcript lines 68784-69052, `scripts/gpuprobe.sh`.

## SOL levels as specified (`sol-critic.md`) against what was delivered
| Level | Specified | Delivered |
|---|---|---|
| SOL-0 | frame/member/contact/shape schemas, rigid transforms, wrench reductions, GPU manufactured/metamorphic gates | yes (G3) |
| SOL-1 | one asymmetric rigid body with a rest mesh, drawn from the resident frame buffer; no grid-axis artefacts | yes (G3) |
| SOL-2 | exact-near SS contact queues for body-owned proxies; gate stacking, tumbling, glancing collision, driven rotation | body-body contact delivered 2026-11-15 as brute-force O(P^2/2) nearest-partner pairs with head-on, glancing and stack gates. Not SS contact queues |
| SOL-3 | "separate mixed-cell solid/fluid velocity/interface handling. Integrate pressure and viscous traction into body wrench. Gate float, sink, neutral buoyancy, rotating boundary, and liquid-through-pile scenarios" | particle-member sphere contact (inelastic, FRICTIONLESS, Baumgarte) with exact reaction into the frame, plus quantized pair heat. Gate: 8 particles against a 32-member ice body (momentum, approach, angular, non-contact). The specified float/sink/neutral-buoyancy/rotating-boundary/liquid-through-pile gates are NOT recorded, and there is no pressure or viscous traction |
| SOL-4 | explicit material-space surface on the fixed-corotated MLS-MPM/APIC state; elastic recovery, plastic deformation, grid crossing, liquid contact | not started |
| SOL-5 | admitted melt, solidification, fracture, component merge/split deltas; solid-to-liquid-to-solid and fracture sequences | melt release exists (G3 Phase 4, f32 route only). Solidification into a body, fracture, merge/split: not started |
| SOL-6 | multilevel and planetary body | not started |

So "SOL-3 delivered" in Claude's notes means a first contact-and-heat coupling, not the level as `sol-critic.md` specifies it.

sol-critic priority order (2026-07): 0A trustworthy GPU-native evidence; 0B production presentation liveness; 1 dense-field algorithm (done as FIELD-0 splat); 2 one resident lane and one neighbourhood authority; 3 make two-level SS actually sparse (gate WAIVED by the user 2026-11-16; its items stay as follow-up: byte-bounded CSR arenas, overflow evidence, consumed cross-level candidates, closed affine/angular/reflux invariants, extreme-ratio invariants); 4 SOL-0/1; 5 parallel resident sidecars (includes centralizing the reaction extent law and removing per-step fences that cross no authority boundary); 6 coupling, deformable surfaces, topology, then scale.

## Iron Ice rate history (so no stale number gets quoted)
| When | Rate at dt 0.5 ms unless noted | Conditions |
|---|---|---|
| 10-27 | 6.4 steps/s | baseline; 53% idle in the presentation hold |
| 11-14 | 19.5 | rigid-ice plume route at dt 1 ms, after slices 1-2 |
| 11-15 | ~19 (seven runs, 16.6-20.4) | plain headless. 48% of wall time in `schedule-terminal-fence` (~800 ms per 16-step schedule). GPU at 77% utilisation and full clocks |
| 11-15 | 41 / 42-52 | INVALID: census/readback regime, steps rolled back |
| 11-16 | ~19, 17.7 with a verified census | after removing the readback; 0 rollbacks in 543 steps |
| 11-16/17 | 21 vacuum, 13-14 room air | audited (contact audit + authority observation); N of N admitted. After the contact trust fix and `contactInnerRounds: 2` |
| 11-17 | 37-40 vacuum | per-step contact audit off; 512 vs 128 cleanup passes makes no difference |
| 11-17 | 59 | 64-step schedules (earlier run), 10 presented frames/s |
Remaining Iron Ice levers named by Claude: dt (solids' elasticity is explicit, and implicit pressure covers liquids on Tier-0 only) and the per-schedule terminal fence / boundary latency.

## What agent work has actually done to this desktop (evidence, boot -1)
- Xid events: NONE in the whole boot (2026-11-12 to 11-17). The Xid 109 storm (116 device losses) was 2026-10-24 to 10-27, from Codex's exact-rational kernels, now disabled. Current kernels are short passes.
- Global out-of-memory, twice on 2026-11-14 (04:49 and 09:44 AKST): a node `MainThread` at 19.7 GB and 20.5 GB was killed (Claude's uncapped native test with an invalid shader). The second was invoked from the user's Brave browser, i.e. the whole machine was out of memory. These are the two "crashes" the user called out.
- Contained memory-cgroup OOMs on 2026-11-14 (11:11, 17:06, 19:11 AKST): Chrome at 4.9 GB and 5.5 GB inside capped scopes (the renderer leak, fixed 11-15).
- NVIDIA driver allocation failures, `NVRM: GPU0 ... Out of memory [NV_ERR_NO_MEMORY] ... system_mem.c:353`: 2026-11-14 21:06:29 and 21:06:47 AKST, and 2026-11-17 03:35:24 and 03:35:29 AKST. The first pair is within a minute of the user restarting their display manager ("I think I have to restart my display manager", then "I restarted") while Claude was running a headed memory soak of the then-leaking app. Hermes has NOT established that the soak caused the restart; `coredumpctl` shows no plasmashell or kwin core from that day (the drkonqi line in the journal refers to an August core). The 11-17 03:35 pair is unattributed.
- Since the reboot (driver 615.71.09): no Xid, no NVRM error, no OOM.
- GPU: RTX 5060 Ti, 16,311 MiB VRAM. Idle desktop use ~1.0-1.1 GB VRAM and 13-22% utilisation.

Reading for "don't crash my window manager": the recorded harm came from MEMORY (system RAM, and driver allocations on the GPU side), not from utilisation percentage. Utilisation is a courtesy budget (80%); memory is the safety limit.

## The GPU wrapper: Claude's and Hermes's
- Claude's `/tmp/.../scratchpad/gpuprobe.sh` (lost with the reboot; recovered text in the transcript at line 68790): the whole probe tree in ONE scope with `CPUQuota=${GPU_CPU_QUOTA:-100%}`, `nvidia-smi` sampled every second. Run at 50% it booted and stepped. Its calibration run (`quota50`) averaged 42.5% total GPU including the user's ~22%, with bursts to 100%. Claude's conclusion: "Without root access to cap GPU clocks, the only other control is running less on the GPU."
- Hermes's `scripts/gpuprobe.sh`: boot quota 400% then stepping quota 50%, `MemoryMax=8G`, utilisation sampled, no VRAM sampling, no abort guard. One whole-run-50% attempt failed to boot after the driver update (n = 1; cause not established); the two-phase run gave 60.2% mean and p90 100% while stepping, against a desktop baseline of ~14%.
- So a CPU quota lowers the average but does not bound the peak, for either wrapper. Unthrottled, plain Iron Ice sits at ~77-100% with full clocks.
- Not available without root: capping GPU clocks or power (`nvidia-smi -pl`). SIGSTOP pauses are ruled out (Chrome's GPU watchdog, device loss).
