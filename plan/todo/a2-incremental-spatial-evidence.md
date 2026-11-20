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

## Update, 2026-11-20: Bounded GPU CSR Migration Built, Verified & Measured at 103,831 Carriers

With A1 sustaining >1× real-time at 103,831 live carriers (`a4100f24`), the
bounded GPU incremental spatial membership migration module
(`src/runtime/sph/schroederIncrementalSpatialMigrationGpu.js`) and its native
Vulkan gate (`tests/schroederIncrementalSpatialMigration.native.test.mjs`) are
now implemented and measured on the same RTX 5060 Ti device:

- **Single-pass GPU architecture (`<= 7` storage bindings):** moved-member flag
  detection, conservative Euclidean displacement (`||dx|| / h <= margin`) and
  single-cell $L_\infty$ jump certificates, shared-memory bitonic chunk sort +
  parallel binary-search merge up to `16,384` moved members, sorted brand-new /
  surviving old cell prefix-rank merge, two-pointer sorted CSR member repair,
  and immutable arena ring (`prevExecution.directoryBuffer` never mutated).
- **Exactness & fail-closed proofs (`ULG_RUN_NATIVE_INCREMENTAL_SPATIAL=1`):**
  100% bit-for-bit `directoryBuffer` (all 48 header words, `cell_keys`,
  `cell_offsets`, `cell_members`, `particle_to_cell`) and
  `consumerDispatchBuffer` identity against trusted `createSchroederSpatialEpochGpu`
  across 0% sub-cell jitter (`zero-churn-rebase`), 1.5% single-cell crossings
  (cell births + cell deaths), 45% multi-chunk crossings (`1,346` moved),
  adversarial 12-cell jump (`STATUS_FAIL_CLOSED` + `[0, 0, 0]` consumer
  dispatch proven on GPU before automatic trusted radix retry), and source-count
  capacity changes (`3,000 -> 3,600`).

| Live carriers `N` | Lexicographic `u32x5` radix | Bounded-atlas `u32` radix | Incremental `0%` churn | Incremental `1%` churn | Incremental `5%` churn |
| ---: | ---: | ---: | ---: | ---: | ---: |
| `2,048` | `0.81 ms` | `0.51 ms` | `0.33 ms` (`2.49×` / `1.56×`) | `0.32 ms` (`2.55×` / `1.60×`) | `0.36 ms` (`2.26×` / `1.42×`) |
| `32,768` | `1.30 ms` | `0.51 ms` | `0.20 ms` (`6.50×` / `2.54×`) | `0.33 ms` (`4.00×` / `1.56×`) | `0.32 ms` (`4.10×` / `1.60×`) |
| `103,831` | `3.14 ms` | `0.69 ms` | **`0.33 ms` (`9.67×` / `2.13×`)** | **`0.33 ms` (`9.43×` / `2.08×`)** | **`0.43 ms` (`7.39×` / `1.63×`)** |
