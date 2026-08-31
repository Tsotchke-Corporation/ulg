# GPU-resident refactor recovery

Status: completed validated recovery decision, 2026-07-12 AKDT. Moved to
`plan/done` after recovery checkpoint `bdd3eee`; bounded continuation now
routes through `plan/done/SS/shared-spatial-authority-refactor-plan.md`.

## Decision

Keep `SS` (`33c3075`) as the integration base. Do not merge or continue the
whole `gpu-resident-physics-refactor` branch. That branch mixes useful fixes
with regressions in reactive execution, substantially larger bundles, and
slower direct-resident batches. Port independently proven changes in bounded
commits instead.

The recovery branch is `gpu-resident-refactor-recovery`, based on `SS`, with:

- `0b989a2` - native WebGPU surface-generation ownership, retirement, teardown,
  stable resize, and capture-cadence fixes from `f0f0f56`, without importing
  the refactor branch's planning documents;
- `0ceefad` - fail-closed resident admission backed by actual completed queue
  fences, plus commit-bridge validation;
- `b056b6c` - rejection of conflicting authoritative resident-state owners.

The refactor's neighborhood-epoch machinery, same-device pacing changes,
pressure-identity work, coherent-solid scaffolding, lease machinery, and broad
plan rewrites were intentionally excluded. They remain candidates for separate
review, not accepted dependencies of this recovery.

## Verification

- Focused surface lifecycle/renderer suites: 125/125 pass.
- Focused resident-step, commit-bridge, and ComputeManager integration suites:
  108/108 pass.
- Resident authority suite: 9/9 pass.
- Full `npm test`: 1,021 pass, 0 fail, 3 opt-in skips out of 1,024.
- `npm run build`: pass; main bundle 5,304.56 kB, versus 5,288.26 kB on `SS`
  and 6,081.34 kB on the abandoned refactor snapshot.
- Standard seven-scene native WebGPU matrix: 72 captured frames; every frame
  nonblank and surface-varying, native browser-frame validation passed, all
  scenario timelines completed, and no browser console errors or warnings.
- Mobile gate: 390x844, DPR 2, mobile/touch emulation; generations 1-3, five
  nonblank varying frames, one canvas configuration, no refresh resize or
  reconfiguration, and native browser-frame validation passed.

The visual matrix still reports four behavior failures. These are existing
physics-quality gaps, not presentation regressions: incomplete water/steam and
iron/ice behavior plus the standard named-scene initial-state gate. Sodium and
cesium both complete all ten resident batches on this branch; the refactor's
neighborhood-epoch abort is absent.

## Performance

Three direct-resident runs used the same `SS=1`, level-0, active-index,
portable-summary configuration, with five batches of 64 steps. Median mean
batch times were:

| Target particles | Recovery | `SS` | Refactor snapshot |
| ---: | ---: | ---: | ---: |
| 1,000 | 97.94 ms | 97.62 ms | 170.90 ms |
| 10,000 | 110.14 ms | 102.06 ms | 201.58 ms |
| 50,000 | 107.40 ms | 110.34 ms | 156.80 ms |

The recovery remains in the `SS` performance class and is materially faster
than the refactor snapshot. Its 1,000- and 50,000-target medians are within 3%
of `SS`; the 10,000-target row is 7.9% slower by mean batch time and 11.2%
slower by completed-stage time. The 50,000-target row remains scientifically
bad on both `SS` and recovery because the active grid saturates and the probe
lacks positive-motion/J/cohort evidence. No throughput or physics-validity
claim should be made from that row until those gates are repaired.

## Next bounded work

1. Add numeric performance thresholds and reliable GPU timestamp attribution.
2. Repair the 50k active-grid saturation/evidence failure independently.
3. Address water/steam and iron/ice behavior gates without weakening visual or
   conservation checks.
4. Re-evaluate remaining refactor commits one concept at a time, with focused
   tests, the native visual matrix, and three-run performance evidence for each.
