const DEFAULT_GAS_PHASES = Object.freeze(['gas']);

export const DEFAULT_PHASE_VOLUME_RATIO_BOUNDS = Object.freeze({
  condensedMinJ: 0.2,
  condensedMaxJ: 5,
  gasMinJ: 0.1,
  gasMaxJ: 1000,
  gasFloorJ: 0.1,
  gasFloorToleranceJ: 1e-6
});

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedToken(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizedTokenSet(values) {
  return new Set(arrayOf(values).map(normalizedToken).filter(Boolean));
}

function normalizedPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function checkpointTime(checkpoint, index) {
  return finiteOrNull(checkpoint?.sourceTimeS) ?? index;
}

function rowMass(row) {
  return Math.max(0, finiteOrNull(row?.massKg) ?? 0);
}

function checkpointSystemMass(checkpoint) {
  const reportedTotalMassKg = finiteOrNull(checkpoint?.totals?.massKg);
  if (Number.isFinite(reportedTotalMassKg) && reportedTotalMassKg >= 0) {
    return reportedTotalMassKg;
  }
  return arrayOf(checkpoint?.materialPhases).reduce((sum, row) => sum + rowMass(row), 0);
}

export function checkpointRowMatches(row, selector = {}) {
  const materials = normalizedTokenSet(selector.materials);
  const phases = normalizedTokenSet(selector.phases);
  const excludedMaterials = normalizedTokenSet(selector.excludeMaterials);
  const excludedPhases = normalizedTokenSet(selector.excludePhases);
  const material = normalizedToken(row?.material);
  const phase = normalizedToken(row?.phase);
  const minimumMassKg = Math.max(0, finiteOrNull(selector.minimumMassKg) ?? 0);
  return (materials.size === 0 || materials.has(material))
    && (phases.size === 0 || phases.has(phase))
    && !excludedMaterials.has(material)
    && !excludedPhases.has(phase)
    && rowMass(row) >= minimumMassKg;
}

function selectedRows(checkpoint, selector) {
  return arrayOf(checkpoint?.materialPhases).filter((row) => (
    checkpointRowMatches(row, selector)
  ));
}

function compactMechanicsRow(row, checkpoint, checkpointIndex) {
  return {
    checkpointIndex,
    timeS: checkpointTime(checkpoint, checkpointIndex),
    material: row?.material ?? null,
    phase: row?.phase ?? null,
    massKg: rowMass(row),
    mechanicsSampleCount: finiteOrNull(row?.mechanicsSampleCount),
    mechanicsProblemParticleCount: finiteOrNull(row?.mechanicsProblemParticleCount),
    minVolumeRatioJ: finiteOrNull(row?.minVolumeRatioJ),
    maxVolumeRatioJ: finiteOrNull(row?.maxVolumeRatioJ)
  };
}

function volumeClassEvidence(rows, { minJ, maxJ }) {
  const violations = rows.filter((row) => (
    !(row.mechanicsSampleCount > 0)
    || !Number.isFinite(row.minVolumeRatioJ)
    || !Number.isFinite(row.maxVolumeRatioJ)
    || Number(row.mechanicsProblemParticleCount || 0) > 0
    || row.minVolumeRatioJ < minJ
    || row.maxVolumeRatioJ > maxJ
  ));
  const minima = rows.map((row) => row.minVolumeRatioJ).filter(Number.isFinite);
  const maxima = rows.map((row) => row.maxVolumeRatioJ).filter(Number.isFinite);
  return {
    status: rows.length === 0 ? 'not-observed' : violations.length === 0 ? 'pass' : 'fail',
    bounds: { minJ, maxJ },
    rowCount: rows.length,
    minimumObservedJ: minima.length ? Math.min(...minima) : null,
    maximumObservedJ: maxima.length ? Math.max(...maxima) : null,
    violations
  };
}

export function phaseAwareVolumeRatioEvidence(checkpoints, options = {}) {
  const bounds = {
    ...DEFAULT_PHASE_VOLUME_RATIO_BOUNDS,
    ...(options || {})
  };
  const gasPhases = normalizedTokenSet(options.gasPhases || DEFAULT_GAS_PHASES);
  const mechanicsRows = arrayOf(checkpoints).flatMap((checkpoint, checkpointIndex) => (
    arrayOf(checkpoint?.materialPhases)
      .filter((row) => rowMass(row) > 0)
      .map((row) => compactMechanicsRow(row, checkpoint, checkpointIndex))
  ));
  const gasRows = mechanicsRows.filter((row) => gasPhases.has(normalizedToken(row.phase)));
  const condensedRows = mechanicsRows.filter((row) => !gasPhases.has(normalizedToken(row.phase)));
  const condensed = volumeClassEvidence(condensedRows, {
    minJ: bounds.condensedMinJ,
    maxJ: bounds.condensedMaxJ
  });
  const gas = volumeClassEvidence(gasRows, {
    minJ: bounds.gasMinJ,
    maxJ: bounds.gasMaxJ
  });

  const floorHitRows = gasRows.filter((row) => (
    Number.isFinite(row.minVolumeRatioJ)
    && row.minVolumeRatioJ <= bounds.gasFloorJ + bounds.gasFloorToleranceJ
  ));
  const floorHitCheckpoints = new Set(floorHitRows.map((row) => row.checkpointIndex));
  let consecutiveFloorHitCheckpoints = 0;
  let maximumConsecutiveFloorHitCheckpoints = 0;
  for (let index = 0; index < arrayOf(checkpoints).length; index += 1) {
    if (floorHitCheckpoints.has(index)) {
      consecutiveFloorHitCheckpoints += 1;
      maximumConsecutiveFloorHitCheckpoints = Math.max(
        maximumConsecutiveFloorHitCheckpoints,
        consecutiveFloorHitCheckpoints
      );
    } else {
      consecutiveFloorHitCheckpoints = 0;
    }
  }

  return {
    schema: 'peercompute.ulg.sph-phase-aware-volume-ratio-evidence.v0',
    status: condensed.status === 'fail' || gas.status === 'fail'
      ? 'fail'
      : mechanicsRows.length === 0
        ? 'inconclusive'
        : 'pass',
    mechanicsRowCount: mechanicsRows.length,
    condensed,
    gas,
    gasFloorTelemetry: {
      floorJ: bounds.gasFloorJ,
      toleranceJ: bounds.gasFloorToleranceJ,
      hitRowCount: floorHitRows.length,
      hitCheckpointCount: floorHitCheckpoints.size,
      maximumConsecutiveHitCheckpoints: maximumConsecutiveFloorHitCheckpoints,
      rows: floorHitRows
    }
  };
}

function aggregateCenterSample(checkpoint, checkpointIndex, selector) {
  const rows = selectedRows(checkpoint, selector).filter((row) => rowMass(row) > 0);
  const massKg = rows.reduce((sum, row) => sum + rowMass(row), 0);
  if (!(massKg > 0)) return null;
  const centerRows = rows.filter((row) => Number.isFinite(finiteOrNull(row?.yCenterMassWeightedM)));
  const representedMassKg = centerRows.reduce((sum, row) => sum + rowMass(row), 0);
  if (!(representedMassKg > 0)) return null;
  return {
    checkpointIndex,
    timeS: checkpointTime(checkpoint, checkpointIndex),
    massKg,
    representedMassKg,
    yCenterM: centerRows.reduce((sum, row) => (
      sum + rowMass(row) * finiteOrNull(row?.yCenterMassWeightedM)
    ), 0) / representedMassKg
  };
}

function interfaceHeight(checkpoint, selector) {
  const heights = selectedRows(checkpoint, selector)
    .filter((row) => rowMass(row) > 0)
    .map((row) => finiteOrNull(row?.yMaxM))
    .filter(Number.isFinite);
  return heights.length ? Math.max(...heights) : null;
}

export function generatedCohortTrajectoryEvidence(checkpoints, options = {}) {
  const selector = options.selector || { phases: DEFAULT_GAS_PHASES };
  const requestedMinimumMassKg = Math.max(0, finiteOrNull(options.minimumMassKg) ?? 0);
  const minimumMassFractionOfSystem = Math.max(
    0,
    finiteOrNull(options.minimumMassFractionOfSystem) ?? 0
  );
  const systemReferenceMassKg = arrayOf(checkpoints).reduce((maximum, checkpoint) => (
    Math.max(maximum, checkpointSystemMass(checkpoint))
  ), 0);
  const minimumMassKg = Math.max(
    requestedMinimumMassKg,
    minimumMassFractionOfSystem * systemReferenceMassKg
  );
  const minimumSustainedRiseM = Math.max(
    0,
    finiteOrNull(options.minimumSustainedRiseM) ?? 0.05
  );
  const tailSampleCount = normalizedPositiveInteger(options.tailSampleCount, 2);
  const minimumTailFraction = Math.min(
    1,
    Math.max(0, finiteOrNull(options.minimumTailFraction) ?? 1)
  );
  const minimumSustainedInterfaceSeparationM = finiteOrNull(
    options.minimumSustainedInterfaceSeparationM
  );
  const samples = arrayOf(checkpoints).map((checkpoint, checkpointIndex) => {
    const sample = aggregateCenterSample(checkpoint, checkpointIndex, selector);
    if (!sample || sample.massKg < minimumMassKg) return null;
    const interfaceY = options.interfaceSelector
      ? interfaceHeight(checkpoint, options.interfaceSelector)
      : null;
    return {
      ...sample,
      interfaceYMaxM: interfaceY,
      interfaceSeparationM: Number.isFinite(interfaceY) ? sample.yCenterM - interfaceY : null
    };
  }).filter(Boolean);
  const birth = samples[0] || null;
  const postBirth = samples.slice(1);
  const tail = postBirth.slice(-tailSampleCount);
  const riseTargetY = birth ? birth.yCenterM + minimumSustainedRiseM : null;
  const tailRisePassCount = birth
    ? tail.filter((sample) => sample.yCenterM >= riseTargetY).length
    : 0;
  const requiredTailPassCount = Math.ceil(tailSampleCount * minimumTailFraction);
  const enoughTailSamples = tail.length >= tailSampleCount;
  const sustainedRisePassed = Boolean(
    birth
    && enoughTailSamples
    && tailRisePassCount >= requiredTailPassCount
  );
  const interfaceTail = tail.filter((sample) => Number.isFinite(sample.interfaceSeparationM));
  const interfaceSeparationRequired = Number.isFinite(minimumSustainedInterfaceSeparationM);
  const sustainedInterfaceSeparationPassed = !interfaceSeparationRequired || (
    interfaceTail.length >= tailSampleCount
    && interfaceTail.every((sample) => (
      sample.interfaceSeparationM >= minimumSustainedInterfaceSeparationM
    ))
  );
  const peakY = samples.length
    ? Math.max(...samples.map((sample) => sample.yCenterM))
    : null;
  const final = samples.at(-1) || null;

  return {
    schema: 'peercompute.ulg.sph-generated-cohort-trajectory-evidence.v0',
    status: !birth
      ? 'missing'
      : !enoughTailSamples
        ? 'insufficient'
        : sustainedRisePassed && sustainedInterfaceSeparationPassed
          ? 'pass'
          : 'fail',
    formed: Boolean(birth),
    sampleCount: samples.length,
    requiredPostBirthSampleCount: tailSampleCount,
    minimumMassKg,
    requestedMinimumMassKg,
    minimumMassFractionOfSystem,
    systemReferenceMassKg,
    minimumSustainedRiseM,
    minimumTailFraction,
    birth,
    final,
    peakYCenterM: peakY,
    peakRiseFromBirthM: birth && Number.isFinite(peakY) ? peakY - birth.yCenterM : null,
    finalRiseFromBirthM: birth && final ? final.yCenterM - birth.yCenterM : null,
    tailRisePassCount,
    requiredTailPassCount,
    sustainedRisePassed,
    minimumSustainedInterfaceSeparationM,
    sustainedInterfaceSeparationPassed,
    tail,
    samples
  };
}

function aggregateCondensedSample(checkpoint, checkpointIndex, selector) {
  const center = aggregateCenterSample(checkpoint, checkpointIndex, selector);
  if (!center) return null;
  const rows = selectedRows(checkpoint, selector).filter((row) => rowMass(row) > 0);
  const kineticEnergyJ = rows.reduce((sum, row) => (
    sum + Math.max(0, finiteOrNull(row?.kineticEnergyJ) ?? 0)
  ), 0);
  return {
    ...center,
    kineticEnergyJ,
    rmsSpeedMPerS: Math.sqrt((2 * kineticEnergyJ) / center.massKg)
  };
}

export function condensedLaunchEvidence(checkpoints, options = {}) {
  const selector = options.selector || { excludePhases: DEFAULT_GAS_PHASES };
  const maxUpwardExcursionM = Math.max(
    0,
    finiteOrNull(options.maxUpwardExcursionM) ?? 0.5
  );
  const maxUpwardCenterSpeedMPerS = finiteOrNull(options.maxUpwardCenterSpeedMPerS);
  const minimumSampleCount = normalizedPositiveInteger(options.minimumSampleCount, 3);
  const samples = arrayOf(checkpoints)
    .map((checkpoint, checkpointIndex) => (
      aggregateCondensedSample(checkpoint, checkpointIndex, selector)
    ))
    .filter(Boolean);
  let runningMinimum = null;
  let maximumUpwardExcursionM = 0;
  let maximumUpwardCenterSpeedObservedMPerS = 0;
  let maximumRmsSpeedMPerS = 0;
  let peakExcursion = null;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!runningMinimum || sample.yCenterM < runningMinimum.yCenterM) {
      runningMinimum = sample;
    }
    const upwardExcursionM = sample.yCenterM - runningMinimum.yCenterM;
    if (upwardExcursionM > maximumUpwardExcursionM) {
      maximumUpwardExcursionM = upwardExcursionM;
      peakExcursion = {
        minimum: runningMinimum,
        peak: sample,
        upwardExcursionM
      };
    }
    const previous = samples[index - 1];
    if (previous && sample.timeS > previous.timeS) {
      maximumUpwardCenterSpeedObservedMPerS = Math.max(
        maximumUpwardCenterSpeedObservedMPerS,
        (sample.yCenterM - previous.yCenterM) / (sample.timeS - previous.timeS)
      );
    }
    maximumRmsSpeedMPerS = Math.max(maximumRmsSpeedMPerS, sample.rmsSpeedMPerS);
  }
  const excursionPassed = maximumUpwardExcursionM <= maxUpwardExcursionM;
  const upwardSpeedPassed = !Number.isFinite(maxUpwardCenterSpeedMPerS)
    || maximumUpwardCenterSpeedObservedMPerS <= maxUpwardCenterSpeedMPerS;
  return {
    schema: 'peercompute.ulg.sph-condensed-launch-evidence.v0',
    status: samples.length < minimumSampleCount
      ? 'inconclusive'
      : excursionPassed && upwardSpeedPassed
        ? 'pass'
        : 'fail',
    sampleCount: samples.length,
    minimumSampleCount,
    maxUpwardExcursionM,
    maximumUpwardExcursionM,
    maxUpwardCenterSpeedMPerS,
    maximumUpwardCenterSpeedObservedMPerS,
    maximumRmsSpeedMPerS,
    excursionPassed,
    upwardSpeedPassed,
    peakExcursion,
    samples
  };
}
