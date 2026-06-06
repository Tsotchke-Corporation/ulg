export const ULG_ARTIFACT_SUMMARY_SCHEMA = 'peercompute.ulg.artifact-summary.v0';
export const ULG_QUANTUM_RESPONSE_DESCRIPTOR_SCHEMA = 'peercompute.ulg.quantum-response-descriptor.v0';
export const ULG_QUANTUM_RESPONSE_PARITY_SCHEMA = 'peercompute.ulg.quantum-response-parity.v0';
export const ULG_MAGNETAR_DIPOLE_ISING_CALIBRATION_SCHEMA = 'peercompute.ulg.magnetar-dipole-ising-calibration.v0';

function inferArtifactKind(artifact = {}) {
  if (artifact.responseDescriptor || artifact.parity || artifact.calibrationArtifacts) return 'quantum-response';
  if (artifact.closureKind || artifact.closureId) return 'closure';
  return artifact.taskKind || 'artifact';
}

function normalizeCalibrationEntry(entry = {}, fallbackId = '') {
  const schema = entry.schema || null;
  const status = entry.validation?.status || entry.status || null;
  const parityStatus = entry.parity?.status || entry.parityStatus || null;
  return {
    id: entry.id || fallbackId || null,
    schema,
    sample: entry.sample || null,
    status,
    parityStatus,
    groundStateBitString: entry.summary?.groundState?.bitString || entry.groundStateBitString || null,
    maxEnergyDelta: entry.summary?.maxEnergyDelta ?? entry.parity?.metrics?.maxEnergyDelta ?? entry.maxEnergyDelta ?? null,
    evaluatedBitstrings: entry.summary?.evaluatedBitstrings ?? entry.evaluatedBitstrings ?? null,
    ready: entry.ready === true
      || (
        schema === ULG_MAGNETAR_DIPOLE_ISING_CALIBRATION_SCHEMA
        && status === 'pass'
        && parityStatus === 'pass'
      )
  };
}

export function summarizeUlgArtifact(artifact = {}) {
  const responseDescriptor = artifact.responseDescriptor && typeof artifact.responseDescriptor === 'object'
    ? artifact.responseDescriptor
    : null;
  const parity = artifact.parity && typeof artifact.parity === 'object' ? artifact.parity : null;
  const parityComparisons = Array.isArray(parity?.comparisons) ? parity.comparisons : [];
  const calibrationArtifacts = artifact.calibrationArtifacts && typeof artifact.calibrationArtifacts === 'object'
    ? artifact.calibrationArtifacts
    : {};
  const calibrationSummaries = Object.entries(calibrationArtifacts)
    .filter(([, calibration]) => calibration && typeof calibration === 'object')
    .map(([id, calibration]) => normalizeCalibrationEntry(calibration, id));
  const magnetarDipoleIsing = calibrationSummaries.find((entry) => (
    entry.id === 'magnetarDipoleIsing'
    || entry.schema === ULG_MAGNETAR_DIPOLE_ISING_CALIBRATION_SCHEMA
  )) || null;

  return {
    schema: ULG_ARTIFACT_SUMMARY_SCHEMA,
    artifactKind: inferArtifactKind(artifact),
    sourceService: artifact.sourceService || null,
    validationStatus: artifact.validation?.status || null,
    responseDescriptorSchema: responseDescriptor?.schema || null,
    responseDescriptorReady: responseDescriptor?.schema === ULG_QUANTUM_RESPONSE_DESCRIPTOR_SCHEMA,
    paritySchema: parity?.schema || null,
    parityStatus: parity?.status || null,
    parityReady: parity?.schema === ULG_QUANTUM_RESPONSE_PARITY_SCHEMA && parity?.status === 'pass',
    parityModeCount: parityComparisons.length,
    unsupportedParityModeCount: parityComparisons.filter((entry) => entry?.status === 'unsupported').length,
    unsupportedParityModes: parityComparisons
      .filter((entry) => entry?.status === 'unsupported')
      .map((entry) => String(entry.mode || '').trim())
      .filter(Boolean),
    calibrationArtifactCount: calibrationSummaries.length,
    calibrationReadyCount: calibrationSummaries.filter((entry) => entry.ready).length,
    calibrationArtifacts: calibrationSummaries,
    magnetarDipoleIsingReady: magnetarDipoleIsing?.ready === true,
    magnetarDipoleIsingStatus: magnetarDipoleIsing?.status || null,
    magnetarDipoleIsingParityStatus: magnetarDipoleIsing?.parityStatus || null,
    magnetarDipoleIsingGroundState: magnetarDipoleIsing?.groundStateBitString || null,
    magnetarDipoleIsingMaxEnergyDelta: magnetarDipoleIsing?.maxEnergyDelta ?? null,
    magnetarDipoleIsingEvaluatedBitstrings: magnetarDipoleIsing?.evaluatedBitstrings ?? null
  };
}
