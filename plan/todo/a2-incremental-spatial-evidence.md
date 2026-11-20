# A2 incremental SS membership repair: evidence, 2026-11-14

A2 is evidence-gated: "implementation remains contingent on evidence". Before
building a membership-repair experiment, I measured what such a repair could
save at most. The bound is the share of step time the per-step spatial
rebuild costs. Measured with `?residentGpuTimestampProfile=1`, which gives
real GPU stage times (`residentStageTiming.stageGpuMs`), on the RTX
workstation. The probe readout was added to `scripts/step0-baseline-probe.mjs`.
Evidence: `~/.cache/icc/repos/ulg/a2-churn-20261114/`.

| Preset (route) | Wall | GPU queue per step | Per-step spatial rebuild |
| --- | --- | --- | --- |
| water-cycle (canonical SS), dt 1 ms | 7.55 steps/s = 132 ms/step | 11.7 ms | not separately timed; unattributed queue time ≤ 0.7 ms ≈ 6% of GPU, < 1% of wall |
| bulk-water (fused Tier0) | 24.5 steps/s = 41 ms/step | 3.5 ms (fused mechanics 2.9) | none: the Tier0 path does not rebuild SS membership per step |

**water-cycle stage breakdown** (GPU ms per step): gas EOS 2.09, P2G 2.16,
grid update 2.22, G2P 2.04, thermal step 1.86, thermal proposal 0.33,
mechanical proposal 0.21, others under 0.03.

**The churn profiler** (`?spatialChurnProfile=1`) reports
`route-has-no-canonical-frozen-fine-refresh` on both routes. It applies only
to two-level frozen-refresh routes, so per-step key churn was not observed
here.

## Conclusion

Do not adopt incremental membership repair now.
- On today's presets it can save at most about 6% of GPU time on the SS
  route, and nothing on the Tier0 bulk route.
- Wall time is dominated by host and orchestration time (GPU is under 10% of
  it), which is A1's problem.

**Revisit when both hold:**
1. A1 has made the SS route GPU-bound.
2. Scenes are large enough that the rebuild's share grows (the SS route at
   100k+ particles).

At that point build the bounded experiment the oracle names: moved-member
flags or adjacent-node migration, checked against the trusted GPU rebuild
under crossings, capacity changes and adversarial motion.

**Not done:** the repair experiment itself; the evidence above says it would
not pay today.
