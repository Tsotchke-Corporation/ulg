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
  const liveParticleCounts = rows
    .map((row) => finiteOrNull(row?.liveParticleCount));
  const phaseWeightedParticleCounts = rows
    .map((row) => finiteOrNull(row?.phaseWeightedParticleCount));
  const velocityRows = rows.map((row) => ({
    meanVyMPerS: finiteOrNull(row?.meanVyMPerS),
    vySampleMassKg: Math.max(0, finiteOrNull(row?.vySampleMassKg) ?? 0)
  })).filter((row) => (
    Number.isFinite(row.meanVyMPerS)
    && row.vySampleMassKg > 0
  ));
  const vySampleMassKg = velocityRows.reduce(
    (sum, row) => sum + row.vySampleMassKg,
    0
  );
  const velocityMassToleranceKg = Math.max(1e-12, massKg * 1e-6);
  const velocityMassCoverageComplete = (
    vySampleMassKg > 0
    &&
    Math.abs(vySampleMassKg - massKg) <= velocityMassToleranceKg
  );
  return {
    checkpointIndex,
    timeS: checkpointTime(checkpoint, checkpointIndex),
    massKg,
    representedMassKg,
    liveParticleCount: liveParticleCounts.length === rows.length
      && liveParticleCounts.every((count) => Number.isInteger(count) && count >= 0)
      ? liveParticleCounts.reduce((sum, count) => sum + count, 0)
      : null,
    phaseWeightedParticleCount:
      phaseWeightedParticleCounts.length === rows.length
      && phaseWeightedParticleCounts.every((count) => (
        Number.isFinite(count) && count >= 0
      ))
        ? phaseWeightedParticleCounts.reduce((sum, count) => sum + count, 0)
        : null,
    vySampleMassKg,
    velocityMassCoverageComplete,
    meanVyMPerS: velocityMassCoverageComplete
      ? velocityRows.reduce((sum, row) => (
          sum + row.meanVyMPerS * row.vySampleMassKg
        ), 0) / vySampleMassKg
      : null,
    yCenterM: centerRows.reduce((sum, row) => (
      sum + rowMass(row) * finiteOrNull(row?.yCenterMassWeightedM)
    ), 0) / representedMassKg
  };
}

function frozenGeneratedGasCohortSample(checkpoint, checkpointIndex, selector) {
  const capture = checkpoint?.generatedGasCohortCapture || null;
  const rows = arrayOf(checkpoint?.generatedGasCohorts).filter((row) => (
    checkpointRowMatches(row, selector)
  ));
  if (rows.length === 0) return null;
  const massKg = rows.reduce((sum, row) => sum + rowMass(row), 0);
  if (!(massKg > 0)) return null;
  const representedRows = rows.filter((row) => (
    Number.isFinite(finiteOrNull(row?.yCenterMassWeightedM))
  ));
  const representedMassKg = representedRows.reduce(
    (sum, row) => sum + rowMass(row),
    0
  );
  const velocityRows = rows.filter((row) => (
    Number.isFinite(finiteOrNull(row?.meanVyMPerS))
    && Math.abs(
      Math.max(0, finiteOrNull(row?.vySampleMassKg) ?? 0) - rowMass(row)
    ) <= Math.max(1e-12, rowMass(row) * 1e-6)
  ));
  const vySampleMassKg = velocityRows.reduce(
    (sum, row) => sum + Math.max(0, finiteOrNull(row?.vySampleMassKg) ?? 0),
    0
  );
  const velocityMassCoverageComplete = (
    velocityRows.length === rows.length
    && Math.abs(vySampleMassKg - massKg) <= Math.max(1e-12, massKg * 1e-6)
  );
  const identityParts = rows.map((row) => [
    row?.materialId,
    row?.frozenLineageMaskHash,
    row?.topologySignature,
    row?.formedAtCheckpointIndex,
    row?.frozenLineageCount,
    capture?.topologyEpoch,
    capture?.identityRevision
  ].join(':')).sort();
  const sameCarrierLineageProven = Boolean(
    representedMassKg > 0
    && capture?.status === 'captured'
    && capture?.sameCarrierLineageProven === true
    && rows.every((row) => (
      row?.status === 'captured'
      && row?.sameCarrierLineageProven === true
      && Number.isInteger(row?.frozenLineageCount)
      && row.frozenLineageCount > 0
      && row?.frozenLineageMaskHash
      && row?.topologySignature
    ))
  );
  const activeGasCarrierCount = rows.reduce(
    (sum, row) => sum + Math.max(
      0,
      finiteOrNull(row?.activeGasCarrierCount) ?? 0
    ),
    0
  );
  const yMinSamples = rows
    .map((row) => finiteOrNull(row?.yMinM))
    .filter(Number.isFinite);
  const yMaxSamples = rows
    .map((row) => finiteOrNull(row?.yMaxM))
    .filter(Number.isFinite);
  return {
    checkpointIndex,
    timeS: checkpointTime(checkpoint, checkpointIndex),
    massKg,
    representedMassKg,
    activeGasCarrierCount,
    liveParticleCount: activeGasCarrierCount,
    inactiveFrozenLineageCount: rows.reduce(
      (sum, row) => sum + Math.max(
        0,
        finiteOrNull(row?.inactiveFrozenLineageCount) ?? 0
      ),
      0
    ),
    frozenLineageCount: rows.reduce(
      (sum, row) => sum + Math.max(0, finiteOrNull(row?.frozenLineageCount) ?? 0),
      0
    ),
    invalidActiveCarrierCount: rows.reduce(
      (sum, row) => sum + Math.max(
        0,
        finiteOrNull(row?.invalidActiveCarrierCount) ?? 0
      ),
      0
    ),
    phasePurityProblemCount: rows.reduce(
      (sum, row) => sum + Math.max(
        0,
        finiteOrNull(row?.phasePurityProblemCount) ?? 0
      ),
      0
    ),
    frozenLineageIdentity: identityParts.join('|'),
    sameCarrierLineageProven,
    vySampleMassKg,
    velocityMassCoverageComplete,
    meanVyMPerS: velocityMassCoverageComplete
      ? velocityRows.reduce((sum, row) => (
          sum + finiteOrNull(row.meanVyMPerS) * rowMass(row)
        ), 0) / massKg
      : null,
    yCenterM: representedMassKg > 0
      ? representedRows.reduce((sum, row) => (
          sum + finiteOrNull(row.yCenterMassWeightedM) * rowMass(row)
        ), 0) / representedMassKg
      : null,
    yMinM: yMinSamples.length ? Math.min(...yMinSamples) : null,
    yMaxM: yMaxSamples.length ? Math.max(...yMaxSamples) : null
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
  const minimumSustainedMeanVyMPerS = Math.max(
    0,
    finiteOrNull(options.minimumSustainedMeanVyMPerS) ?? 0
  );
  const tailSampleCount = normalizedPositiveInteger(options.tailSampleCount, 2);
  const minimumTailFraction = Math.min(
    1,
    Math.max(0, finiteOrNull(options.minimumTailFraction) ?? 1)
  );
  const minimumSustainedInterfaceSeparationM = finiteOrNull(
    options.minimumSustainedInterfaceSeparationM
  );
  const frozenLineageAuthorityAvailable = arrayOf(checkpoints).some((checkpoint) => (
    Object.hasOwn(checkpoint || {}, 'generatedGasCohortCapture')
  ));
  const samples = arrayOf(checkpoints).map((checkpoint, checkpointIndex) => {
    const sample = frozenLineageAuthorityAvailable
      ? frozenGeneratedGasCohortSample(checkpoint, checkpointIndex, selector)
      : aggregateCenterSample(checkpoint, checkpointIndex, selector);
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
  const tailUpwardVelocityPassCount = tail.filter((sample) => (
    sample.velocityMassCoverageComplete === true
    && Number.isFinite(sample.meanVyMPerS)
    && sample.meanVyMPerS > minimumSustainedMeanVyMPerS
  )).length;
  const requiredTailPassCount = Math.ceil(tailSampleCount * minimumTailFraction);
  const enoughTailSamples = tail.length >= tailSampleCount;
  const checkpointContinuityPassed = Boolean(
    birth
    && samples.every((sample, sampleIndex) => (
      sample.checkpointIndex === birth.checkpointIndex + sampleIndex
    ))
  );
  const liveCarrierContinuityPassed = Boolean(
    birth
    && (
      frozenLineageAuthorityAvailable
        ? Number.isInteger(birth.frozenLineageCount)
          && birth.frozenLineageCount > 0
          && samples.every((sample) => (
            sample.frozenLineageCount === birth.frozenLineageCount
            && sample.frozenLineageIdentity === birth.frozenLineageIdentity
          ))
        : Number.isInteger(birth.liveParticleCount)
          && birth.liveParticleCount > 0
          && samples.every((sample) => (
            sample.liveParticleCount === birth.liveParticleCount
          ))
    )
  );
  const sameCarrierLineageProven = Boolean(
    frozenLineageAuthorityAvailable
    && birth
    && samples.every((sample) => sample.sameCarrierLineageProven === true)
    && liveCarrierContinuityPassed
  );
  const velocityMassCoverageComplete = Boolean(
    birth
    && samples.every((sample) => sample.velocityMassCoverageComplete === true)
  );
  const sustainedRisePassed = Boolean(
    birth
    && enoughTailSamples
    && tailRisePassCount >= requiredTailPassCount
  );
  const sustainedUpwardVelocityPassed = Boolean(
    birth
    && enoughTailSamples
    && tailUpwardVelocityPassCount >= requiredTailPassCount
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
    schema: 'peercompute.ulg.sph-generated-cohort-trajectory-evidence.v1',
    status: !birth
      ? 'missing'
      : !enoughTailSamples
        ? 'insufficient'
        : checkpointContinuityPassed
          && liveCarrierContinuityPassed
          && (!frozenLineageAuthorityAvailable || sameCarrierLineageProven)
          && velocityMassCoverageComplete
          && sustainedRisePassed
          && sustainedUpwardVelocityPassed
          && sustainedInterfaceSeparationPassed
          ? 'pass'
          : 'fail',
    authority: frozenLineageAuthorityAvailable
      ? 'gpu-resident-frozen-phase-lineage-bitmask'
      : 'aggregate-contiguous-stable-live-carrier-positive-vy-proxy',
    sameCarrierLineageProven,
    frozenLineageAuthorityAvailable,
    formed: Boolean(birth),
    sampleCount: samples.length,
    requiredPostBirthSampleCount: tailSampleCount,
    minimumMassKg,
    requestedMinimumMassKg,
    minimumMassFractionOfSystem,
    systemReferenceMassKg,
    minimumSustainedRiseM,
    minimumSustainedMeanVyMPerS,
    minimumTailFraction,
    birth,
    final,
    peakYCenterM: peakY,
    peakRiseFromBirthM: birth && Number.isFinite(peakY) ? peakY - birth.yCenterM : null,
    finalRiseFromBirthM: birth && final ? final.yCenterM - birth.yCenterM : null,
    tailRisePassCount,
    tailUpwardVelocityPassCount,
    requiredTailPassCount,
    checkpointContinuityPassed,
    liveCarrierContinuityPassed,
    velocityMassCoverageComplete,
    sustainedRisePassed,
    sustainedUpwardVelocityPassed,
    minimumSustainedInterfaceSeparationM,
    sustainedInterfaceSeparationPassed,
    tail,
    samples
  };
}

export function coldCeilingCondensationEvidence(checkpoints, options = {}) {
  const selector = options.selector || {
    phases: DEFAULT_GAS_PHASES
  };
  const minimumCeilingContactYM = finiteOrNull(
    options.minimumCeilingContactYM
  );
  const minimumGasMassLossFraction = Math.max(
    0,
    finiteOrNull(options.minimumGasMassLossFraction) ?? 0.02
  );
  const minimumGasMassLossFractionOfSystem = Math.max(
    0,
    finiteOrNull(options.minimumGasMassLossFractionOfSystem) ?? 1e-6
  );
  const requestedMinimumGasMassLossKg = Math.max(
    0,
    finiteOrNull(options.minimumGasMassLossKg) ?? 0
  );
  const minimumReturnDropM = Math.max(
    0,
    finiteOrNull(options.minimumReturnDropM) ?? 0
  );
  const systemReferenceMassKg = arrayOf(checkpoints).reduce(
    (maximum, checkpoint) => Math.max(
      maximum,
      checkpointSystemMass(checkpoint)
    ),
    0
  );
  const minimumGasMassLossKg = Math.max(
    requestedMinimumGasMassLossKg,
    systemReferenceMassKg * minimumGasMassLossFractionOfSystem
  );
  const frozenLineageAuthorityAvailable = arrayOf(checkpoints).some(
    (checkpoint) => Object.hasOwn(
      checkpoint || {},
      'generatedGasCohortCapture'
    )
  );
  const samples = arrayOf(checkpoints).map(
    (checkpoint, checkpointIndex) =>
      frozenGeneratedGasCohortSample(
        checkpoint,
        checkpointIndex,
        selector
      )
  ).filter(Boolean);
  const birth = samples[0] || null;
  const identityContinuityPassed = Boolean(
    birth
    && samples.every((sample) =>
      sample.sameCarrierLineageProven === true
      && sample.frozenLineageCount === birth.frozenLineageCount
      && sample.frozenLineageIdentity === birth.frozenLineageIdentity
    )
  );
  const integrityPassed = Boolean(
    birth
    && samples.every((sample) =>
      sample.invalidActiveCarrierCount === 0
      && sample.phasePurityProblemCount === 0
    )
  );
  const contact = Number.isFinite(minimumCeilingContactYM)
    ? samples.find((sample) =>
        Number.isFinite(sample.yMaxM)
        && sample.yMaxM >= minimumCeilingContactYM
      ) || null
    : null;
  const postContactSamples = contact
    ? samples.filter(
        (sample) => sample.checkpointIndex >= contact.checkpointIndex
      )
    : [];
  const peakGasSample = postContactSamples.reduce(
    (peak, sample) => !peak || sample.massKg > peak.massKg
      ? sample
      : peak,
    null
  );
  const peakActiveGasCarrierCount = postContactSamples.reduce(
    (maximum, sample) => Math.max(
      maximum,
      sample.activeGasCarrierCount
    ),
    0
  );
  const requiredPeakRelativeMassLossKg = peakGasSample
    ? peakGasSample.massKg * minimumGasMassLossFraction
    : null;
  const requiredGasMassLossKg = peakGasSample
    ? Math.max(
        minimumGasMassLossKg,
        requiredPeakRelativeMassLossKg
      )
    : null;
  const condensation = peakGasSample
    ? postContactSamples.find((sample) =>
        sample.checkpointIndex > peakGasSample.checkpointIndex
        && sample.activeGasCarrierCount < peakActiveGasCarrierCount
        && peakGasSample.massKg - sample.massKg
          >= requiredGasMassLossKg
      ) || null
    : null;
  const peakCeilingSample = postContactSamples.reduce(
    (peak, sample) => !peak || sample.yCenterM > peak.yCenterM
      ? sample
      : peak,
    null
  );
  const returnSample = condensation && peakCeilingSample
    ? samples.find((sample) =>
        sample.checkpointIndex > condensation.checkpointIndex
        && Number.isFinite(sample.yCenterM)
        && peakCeilingSample.yCenterM - sample.yCenterM
          >= minimumReturnDropM
      ) || (minimumReturnDropM === 0 ? condensation : null)
    : null;
  const orderedEvidencePassed = Boolean(
    contact
    && peakGasSample
    && condensation
    && returnSample
    && contact.checkpointIndex <= peakGasSample.checkpointIndex
    && peakGasSample.checkpointIndex < condensation.checkpointIndex
    && condensation.checkpointIndex <= returnSample.checkpointIndex
  );

  return {
    schema:
      'peercompute.ulg.sph-cold-ceiling-condensation-evidence.v0',
    status: !frozenLineageAuthorityAvailable || !birth
      ? 'inconclusive'
      : identityContinuityPassed
        && integrityPassed
        && orderedEvidencePassed
        ? 'pass'
        : 'fail',
    authority: frozenLineageAuthorityAvailable
      ? 'gpu-resident-frozen-phase-lineage-bitmask'
      : null,
    frozenLineageAuthorityAvailable,
    sameCarrierLineageProven: identityContinuityPassed,
    integrityPassed,
    orderedEvidencePassed,
    sampleCount: samples.length,
    systemReferenceMassKg,
    minimumCeilingContactYM,
    minimumGasMassLossFraction,
    minimumGasMassLossFractionOfSystem,
    minimumGasMassLossKg,
    requiredGasMassLossKg,
    minimumReturnDropM,
    birth,
    contact,
    peakGasSample,
    peakActiveGasCarrierCount,
    condensation,
    returnSample,
    ceilingContactCheckpointIndex: contact?.checkpointIndex ?? null,
    gasMassLossKg: peakGasSample && condensation
      ? peakGasSample.massKg - condensation.massKg
      : null,
    condensedLineageCount: condensation
      ? peakActiveGasCarrierCount
        - condensation.activeGasCarrierCount
      : 0,
    returnDropM: peakCeilingSample && returnSample
      ? peakCeilingSample.yCenterM - returnSample.yCenterM
      : null,
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
