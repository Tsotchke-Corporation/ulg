# Solid H2O Static Sequence Recheck

Date: 2026-06-18 AKDT

Status: completed targeted recheck; broad ice/solid behavior remains open.

## What Was Rechecked

- Re-ran the current dense visual sequence harness for
  `solid-h2o-cpu-sph`.
- Confirmed the cold same-material CPU-SPH static/support fixture is stable
  under the current code after the recent reaction, flow, and resident
  rendering changes.
- Kept the broader "ice flows like water" class open, but narrowed the next
  evidence target to mixed solid/liquid contacts, resident/mounted solid
  mechanics, phase-transition solid behavior, and live-render cadence.

## Validation

- Visual matrix run `codex-solid-h2o-static-sequence-20260618`:
  `failedCount=0`, nine captured frames, `visualFrameTimeSpanS=0.9216`, max
  displacement `1.19e-7 m`, max speed `0.00147 m/s`, first/last H2O visible
  surface count `2 -> 2`, one connected component per visible surface, empty
  issue lists, and final particles `{h2o:152}`.

## Remaining Follow-Up

- Add dedicated gates for mixed solid/liquid contact and cold/hot
  phase-transition solid behavior.
- Add a resident/mounted solid mechanics row once the resident solid path is
  ready to be trusted.
- Keep live-render cadence and focus-resume flashing under the visual-trust
  lane rather than treating them as solid mechanics by default.
