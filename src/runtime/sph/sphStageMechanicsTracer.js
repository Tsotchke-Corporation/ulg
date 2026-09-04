// Per-stage mechanics snapshots across the post-mechanics closure.
//
// The aggregate checkpoint reads one buffer -- whatever the closure leaves
// behind -- so it can say *that* a value is wrong and never *which stage wrote
// it*. Two open questions need that distinction and cannot be answered without
// it:
//
//   - h2 reaction-product gas sits at J = 0.1 * V0_old/V0_new, a composition of
//     two writers. Four single-path edits all returned byte-identical results,
//     which is what a composition looks like from the outside.
//   - `resolvedAbsolutePressurePa` is exactly 0 for every reaction product and
//     ~ambient for every original material, while the field-view G2P does write
//     that lane and the products are demonstrably not being rejected.
//
// The tracer runs the SAME reduction the authoritative checkpoint uses, once
// per stage, against that stage's own retained buffers. Same fixed-size
// evidence record, same decode, so a stage row is directly comparable to a
// checkpoint row. It does not read particles back.
//
// It is opt-in and off by default: each snapshot is an extra submit plus a
// fixed-size map, which serializes the closure's stage pipeline. That cost is
// acceptable for a diagnostic and is not acceptable in the hot loop.
import {
  SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY,
  reduceAuthoritativeGpuMaterialPhaseEvidence
} from '../../../scripts/sph-authoritative-gpu-checkpoint.mjs';

export const ULG_SPH_STAGE_MECHANICS_TRACE_SCHEMA =
  'peercompute.ulg.sph-stage-mechanics-trace.v0';

// A step has five candidate stages; the cap is a runaway guard, not a policy.
const MAX_TRACED_STAGES = 16;

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

// Only the fields that separate "which stage wrote this". Carrying the whole
// decoded row would make a trace of five stages larger than the evidence it
// came from, for no extra discrimination.
function compactPhaseRow(row) {
  return Object.freeze({
    material: row.material ?? null,
    materialId: row.materialId ?? null,
    phase: row.phase ?? null,
    liveParticleCount: row.liveParticleCount ?? 0,
    massKg: row.massKg ?? 0,
    kineticEnergyJ: row.kineticEnergyJ ?? null,
    speedSampleCount: row.speedSampleCount ?? 0,
    maxSpeedMPerS: row.maxSpeedMPerS ?? null,
    meanVyMPerS: row.meanVyMPerS ?? null,
    minVyMPerS: row.minVyMPerS ?? null,
    maxVyMPerS: row.maxVyMPerS ?? null,
    // The existing fixed-size reduction already computes these. Preserve
    // them so nonzero velocity with stationary positions can be localized
    // to a writer without mapping particle rows or changing the GPU workload.
    yMinM: row.yMinM ?? null,
    yMaxM: row.yMaxM ?? null,
    yCenterMassWeightedM: row.yCenterMassWeightedM ?? null,
    maxAbsVelocityDivergencePerS: row.maxAbsVelocityDivergencePerS ?? null,
    volumeRatioCapBoundaryContributionCount:
      row.volumeRatioCapBoundaryContributionCount ?? null,
    minVolumeRatioJ: row.minVolumeRatioJ ?? null,
    maxVolumeRatioJ: row.maxVolumeRatioJ ?? null,
    minPressurePa: row.minPressurePa ?? null,
    maxPressurePa: row.maxPressurePa ?? null,
    pressureSampleCount: row.pressureSampleCount ?? 0,
    phaseWeightedRestVolumeM3: row.phaseWeightedRestVolumeM3 ?? null,
    phaseWeightedCurrentVolumeM3: row.phaseWeightedCurrentVolumeM3 ?? null,
    minDensityKgPerM3: row.minDensityKgPerM3 ?? null,
    maxDensityKgPerM3: row.maxDensityKgPerM3 ?? null
  });
}

export function createSphStageMechanicsTracer({
  device = null,
  particleCount = null,
  materialKeyById = {},
  enabled = false,
  bucketCapacity = SPH_CHECKPOINT_MATERIAL_PHASE_CAPACITY,
  reducer = reduceAuthoritativeGpuMaterialPhaseEvidence,
  label = 'ulg-sph-stage-mechanics-trace'
} = {}) {
  const count = positiveInteger(particleCount);
  const deviceUsable = Boolean(
    device?.createBuffer && device?.createCommandEncoder && device.queue?.submit
  );
  const active = Boolean(enabled) && deviceUsable && count !== null;
  // A disabled tracer says which precondition failed. Silence here costs a
  // full probe run to diagnose, which is exactly what it cost to find that the
  // step envelope was dropping this field.
  const disabledReason = active
    ? null
    : !enabled
      ? 'stage-mechanics-trace-flag-off'
      : !deviceUsable
        ? 'stage-mechanics-trace-device-unusable'
        : 'stage-mechanics-trace-particle-count-unavailable';
  // Insertion-ordered, so the trace records the order stages actually ran in
  // rather than the order they are listed anywhere. That order is not obvious:
  // the closure runs thermal -> reaction -> phaseCarrierTransfer ->
  // mechanicsRefresh, so the refresh is the LAST writer of the mechanics
  // buffer, which is the reverse of how the stage list reads.
  let stages = new Map();
  let snapshotCount = 0;
  let skipped = 0;
  let failures = [];

  async function snapshot({
    stage = null,
    stateBuffer = null,
    thermoBuffer = null,
    mechanicsBuffer = null
  } = {}) {
    if (!active || !stage) return null;
    // A stage that did not run, or that produced no mechanics of its own, is
    // recorded as skipped rather than silently omitted -- an absent row and an
    // unwritten row are different answers to "which stage wrote this".
    if (!stateBuffer || !thermoBuffer || !mechanicsBuffer) {
      skipped += 1;
      stages.set(stage, Object.freeze({
        stage,
        status: 'stage-mechanics-trace-skipped-incomplete-triple',
        hasState: Boolean(stateBuffer),
        hasThermo: Boolean(thermoBuffer),
        hasMechanics: Boolean(mechanicsBuffer),
        materialPhases: Object.freeze([])
      }));
      return null;
    }
    if (stages.size >= MAX_TRACED_STAGES && !stages.has(stage)) {
      skipped += 1;
      return null;
    }
    try {
      const evidence = await reducer({
        device,
        stateBuffer,
        thermoBuffer,
        mechanicsBuffer,
        particleCount: count,
        materialKeyById,
        bucketCapacity,
        label: `${label}-${stage}`
      });
      snapshotCount += 1;
      const rows = (evidence?.materialPhases || [])
        .filter((row) => (Number(row?.massKg) || 0) > 0)
        .map(compactPhaseRow);
      stages.set(stage, Object.freeze({
        stage,
        status: 'stage-mechanics-trace-captured',
        particleCount: evidence?.particleCount ?? count,
        materialPhases: Object.freeze(rows)
      }));
      return evidence;
    } catch (error) {
      // A tracer must never take the step down with it.
      failures.push(Object.freeze({
        stage,
        message: String(error?.message || error)
      }));
      stages.set(stage, Object.freeze({
        stage,
        status: 'stage-mechanics-trace-failed',
        materialPhases: Object.freeze([])
      }));
      return null;
    }
  }

  function result() {
    if (!active) {
      return Object.freeze({
        schema: ULG_SPH_STAGE_MECHANICS_TRACE_SCHEMA,
        status: 'stage-mechanics-trace-disabled',
        disabledReason,
        requestedEnabled: Boolean(enabled),
        deviceUsable,
        particleCount: count,
        stages: Object.freeze([])
      });
    }
    return Object.freeze({
      schema: ULG_SPH_STAGE_MECHANICS_TRACE_SCHEMA,
      status: snapshotCount > 0
        ? 'stage-mechanics-trace-captured'
        : 'stage-mechanics-trace-empty',
      snapshotCount,
      skippedCount: skipped,
      // Execution order, not declaration order.
      stageOrder: Object.freeze([...stages.keys()]),
      stages: Object.freeze([...stages.values()]),
      failures: Object.freeze([...failures])
    });
  }

  function reset() {
    stages = new Map();
    snapshotCount = 0;
    skipped = 0;
    failures = [];
  }

  return Object.freeze({ enabled: active, snapshot, result, reset });
}

// Renders one trace into a table keyed by material+phase, so a lane that
// changes at exactly one stage boundary is visible by reading across.
export function summarizeSphStageMechanicsTrace(trace, { field = 'minPressurePa' } = {}) {
  if (!trace?.stages?.length) return Object.freeze({ rows: Object.freeze([]), stageOrder: Object.freeze([]) });
  const stageOrder = trace.stageOrder || trace.stages.map((entry) => entry.stage);
  const keys = new Map();
  for (const entry of trace.stages) {
    for (const row of entry.materialPhases || []) {
      const key = `${row.material}/${row.phase}`;
      if (!keys.has(key)) keys.set(key, new Map());
      keys.get(key).set(entry.stage, row[field] ?? null);
    }
  }
  const rows = [...keys.entries()].map(([key, byStage]) => Object.freeze({
    key,
    values: Object.freeze(stageOrder.map((stage) => byStage.get(stage) ?? null))
  }));
  return Object.freeze({ field, stageOrder: Object.freeze([...stageOrder]), rows: Object.freeze(rows) });
}
