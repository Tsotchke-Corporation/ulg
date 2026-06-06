export const ULG_ARTIFACT_SUMMARY_SCHEMA = 'peercompute.ulg.artifact-summary.v0';
export const ULG_QUANTUM_RESPONSE_DESCRIPTOR_SCHEMA = 'peercompute.ulg.quantum-response-descriptor.v0';
export const ULG_QUANTUM_RESPONSE_PARITY_SCHEMA = 'peercompute.ulg.quantum-response-parity.v0';
export const ULG_MAGNETAR_DIPOLE_ISING_CALIBRATION_SCHEMA = 'peercompute.ulg.magnetar-dipole-ising-calibration.v0';
export const ESHKOL_CLOSURE_OUTPUT_SEMANTICS_SCHEMA = 'eshkol.ulg.closure-output-semantics.v0';
export const MOONLAB_MAGNETAR_DIPOLE_ISING_REFERENCE_SCHEMA = 'moonlab.magnetar-dipole-ising-reference.v0';
export const MOONLAB_MAGNETAR_REFERENCE_ROLE = 'peercompute-reference-tolerance-input';
export const MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_SCHEMA = 'moonlab.magnetar.calibrated-reference.v0';
export const MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_ROLE = 'peercompute-scientific-tolerance-input';

function inferArtifactKind(artifact = {}) {
  if (artifact.responseDescriptor || artifact.parity || artifact.calibrationArtifacts) return 'quantum-response';
  if (artifact.closureKind || artifact.closureId) return 'closure';
  return artifact.taskKind || 'artifact';
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function textOrNull(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function referenceKey(reference = {}) {
  if (!reference.contractHash && !reference.id) {
    return JSON.stringify(reference);
  }
  const stableParts = [
    reference.id || '',
    reference.schema || '',
    reference.role || '',
    reference.contractHash || '',
    reference.energyUnits || ''
  ];
  return stableParts.join('|');
}

function collectReferenceEntries(source = {}) {
  const candidates = [];
  if (isPlainObject(source.reference)) {
    candidates.push(source.reference);
  }
  if (Array.isArray(source.references)) {
    candidates.push(...source.references.filter(isPlainObject));
  }
  const seen = new Set();
  return candidates.filter((reference) => {
    const key = referenceKey(reference);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeReferenceEntry(reference = {}, fallbackId = '') {
  const referenceGroundState = reference?.observables?.groundState && typeof reference.observables.groundState === 'object'
    ? reference.observables.groundState
    : {};
  const referenceTolerances = reference?.tolerances && typeof reference.tolerances === 'object'
    ? reference.tolerances
    : {};
  const referenceValidation = reference?.validation && typeof reference.validation === 'object'
    ? reference.validation
    : {};
  const referenceEnergyAbs = finiteNumberOrNull(referenceTolerances.energyAbs);
  const referenceMaxObservedEnergyDelta = finiteNumberOrNull(referenceTolerances.maxObservedEnergyDelta);
  const referenceGroundStateEnergy = finiteNumberOrNull(referenceGroundState.referenceEnergy);
  const referenceGroundStateBitString = referenceGroundState.bitString || referenceGroundState.bitstring || null;
  const validationStatus = referenceValidation.parityPassed === true
    ? 'pass'
    : textOrNull(referenceValidation.status || reference.validationStatus);
  const contractHash = textOrNull(reference?.contractHash);
  const unitsHash = textOrNull(reference?.unitsHash);
  const dipoleIsingReady = reference?.schema === MOONLAB_MAGNETAR_DIPOLE_ISING_REFERENCE_SCHEMA
    && reference.role === MOONLAB_MAGNETAR_REFERENCE_ROLE
    && typeof contractHash === 'string'
    && contractHash.startsWith('sha256:')
    && reference.energyUnits === 'normalized-ising'
    && referenceGroundStateBitString != null
    && referenceGroundStateEnergy != null
    && referenceEnergyAbs != null
    && referenceMaxObservedEnergyDelta != null
    && validationStatus === 'pass'
    && referenceMaxObservedEnergyDelta <= referenceEnergyAbs;
  const calibratedReady = reference?.schema === MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_SCHEMA
    && reference.role === MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_ROLE
    && reference.ready === true
    && reference.scientificCoverage === true
    && validationStatus === 'pass'
    && typeof contractHash === 'string'
    && contractHash.startsWith('sha256:')
    && typeof unitsHash === 'string'
    && unitsHash.startsWith('sha256:');
  return {
    id: reference.id || fallbackId || null,
    schema: reference?.schema || null,
    role: reference?.role || null,
    family: textOrNull(reference.family),
    provider: textOrNull(reference.provider),
    solverId: textOrNull(reference.solverId),
    contractHash,
    unitsHash,
    energyUnits: reference?.energyUnits || null,
    fieldMap: clonePlain(isPlainObject(reference.fieldMap) ? reference.fieldMap : null),
    fieldTolerances: clonePlain(isPlainObject(reference.fieldTolerances) ? reference.fieldTolerances : null),
    fieldObservedDeltas: clonePlain(isPlainObject(reference.fieldObservedDeltas) ? reference.fieldObservedDeltas : null),
    groundStateBitString: referenceGroundStateBitString,
    groundStateEnergy: referenceGroundStateEnergy,
    toleranceEnergyAbs: referenceEnergyAbs,
    maxObservedEnergyDelta: referenceMaxObservedEnergyDelta,
    status: textOrNull(reference.status),
    scientificCoverage: typeof reference.scientificCoverage === 'boolean' ? reference.scientificCoverage : null,
    scope: textOrNull(reference.scope),
    validationStatus,
    blocker: textOrNull(reference.blocker),
    blockers: Array.isArray(reference.blockers) ? reference.blockers.map((blocker) => String(blocker)) : [],
    ready: dipoleIsingReady || calibratedReady
  };
}

function findMoonLabReferenceSummary(references = []) {
  return references.find((reference) => reference.ready)
    || references.find((reference) => (
      reference.schema === MOONLAB_MAGNETAR_DIPOLE_ISING_REFERENCE_SCHEMA
      && reference.role === MOONLAB_MAGNETAR_REFERENCE_ROLE
    ))
    || null;
}

function normalizeCalibrationEntry(entry = {}, fallbackId = '') {
  const schema = entry.schema || null;
  const status = entry.validation?.status || entry.status || null;
  const parityStatus = entry.parity?.status || entry.parityStatus || null;
  const references = collectReferenceEntries(entry)
    .map((reference, index) => normalizeReferenceEntry(reference, `${fallbackId || 'reference'}-${index}`));
  const reference = findMoonLabReferenceSummary(references);
  return {
    id: entry.id || fallbackId || null,
    schema,
    sample: entry.sample || null,
    status,
    parityStatus,
    groundStateBitString: entry.summary?.groundState?.bitString || entry.groundStateBitString || null,
    maxEnergyDelta: entry.summary?.maxEnergyDelta ?? entry.parity?.metrics?.maxEnergyDelta ?? entry.maxEnergyDelta ?? null,
    evaluatedBitstrings: entry.summary?.evaluatedBitstrings ?? entry.evaluatedBitstrings ?? null,
    referenceCount: references.length,
    referenceReadyCount: references.filter((item) => item.ready).length,
    references,
    referenceSchema: reference?.schema || null,
    referenceRole: reference?.role || null,
    referenceContractHash: reference?.contractHash || null,
    referenceEnergyUnits: reference?.energyUnits || entry.summary?.groundState?.energyUnits || null,
    referenceGroundStateBitString: reference?.groundStateBitString || null,
    referenceGroundStateEnergy: reference?.groundStateEnergy ?? null,
    referenceToleranceEnergyAbs: reference?.toleranceEnergyAbs ?? null,
    referenceMaxObservedEnergyDelta: reference?.maxObservedEnergyDelta ?? null,
    referenceValidationStatus: reference?.validationStatus || null,
    referenceReady: reference?.ready === true,
    ready: entry.ready === true
      || (
        schema === ULG_MAGNETAR_DIPOLE_ISING_CALIBRATION_SCHEMA
        && status === 'pass'
        && parityStatus === 'pass'
      )
  };
}

function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function countWasmEntries(entries = [], kind) {
  return Array.isArray(entries)
    ? entries.filter((entry) => entry?.kind === kind).length
    : 0;
}

export function summarizeUlgArtifact(artifact = {}) {
  const outputs = artifact.outputs && typeof artifact.outputs === 'object' && !Array.isArray(artifact.outputs)
    ? artifact.outputs
    : {};
  const responseDescriptor = artifact.responseDescriptor && typeof artifact.responseDescriptor === 'object'
    ? artifact.responseDescriptor
    : null;
  const parity = artifact.parity && typeof artifact.parity === 'object' ? artifact.parity : null;
  const execution = artifact.execution && typeof artifact.execution === 'object' ? artifact.execution : {};
  const module = execution.module && typeof execution.module === 'object' ? execution.module : {};
  const executionImports = Array.isArray(execution.imports) ? execution.imports : [];
  const executionExports = Array.isArray(execution.exports) ? execution.exports : [];
  const wasmMetadata = execution.wasmMetadata && typeof execution.wasmMetadata === 'object' ? execution.wasmMetadata : {};
  const validity = artifact.validity && typeof artifact.validity === 'object' ? artifact.validity : {};
  const outputSemantics = artifact.validation?.outputSemantics && typeof artifact.validation.outputSemantics === 'object'
    ? artifact.validation.outputSemantics
    : null;
  const outputSemanticsStdout = outputSemantics?.stdout && typeof outputSemantics.stdout === 'object'
    ? outputSemantics.stdout
    : {};
  const bundleManifest = artifact.runtime?.bundleManifest && typeof artifact.runtime.bundleManifest === 'object'
    ? artifact.runtime.bundleManifest
    : (artifact.bundleManifest && typeof artifact.bundleManifest === 'object' ? artifact.bundleManifest : null);
  const hostImports = bundleManifest?.hostImports && typeof bundleManifest.hostImports === 'object'
    ? bundleManifest.hostImports
    : (artifact.runtime?.hostImports && typeof artifact.runtime.hostImports === 'object' ? artifact.runtime.hostImports : null);
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
  const outputReferences = collectReferenceEntries(outputs)
    .map((reference, index) => normalizeReferenceEntry(reference, `output-reference-${index}`));
  const outputMoonLabReference = findMoonLabReferenceSummary(outputReferences);
  const magnetarCalibratedReferences = outputReferences.filter((reference) => (
    reference.schema === MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_SCHEMA
    && reference.role === MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_ROLE
  ));

  return {
    schema: ULG_ARTIFACT_SUMMARY_SCHEMA,
    artifactKind: inferArtifactKind(artifact),
    artifactId: artifact.artifactId || artifact.closureId || null,
    sourceService: artifact.sourceService || null,
    validationStatus: artifact.validation?.status || null,
    closureKind: artifact.closureKind || null,
    closureModuleUrl: module.url || null,
    closureModuleSha256: module.sha256 || null,
    closureServiceWorkerSafe: execution.serviceWorkerSafe === true,
    closureRequiresDynamicCode: validity.requiresDynamicCode ?? null,
    closureRequiresHostImports: validity.requiresHostImports ?? null,
    closureEntryExport: execution.entryExport || null,
    closureEntrySignature: clonePlain(execution.entrySignature || null),
    closureHasStartSection: typeof execution.hasStartSection === 'boolean'
      ? execution.hasStartSection
      : (execution.startFunctionIndex == null ? null : true),
    closureStartFunctionIndex: finiteNumberOrNull(execution.startFunctionIndex),
    closureImportCount: executionImports.length,
    closureExportCount: executionExports.length,
    closureRuntimeFunctionImportCount: countWasmEntries(executionImports, 'function'),
    closureRuntimeMemoryImportCount: countWasmEntries(executionImports, 'memory'),
    closureRuntimeGlobalImportCount: countWasmEntries(executionImports, 'global'),
    closureRuntimeTableImportCount: countWasmEntries(executionImports, 'table'),
    closureWasmFunctionCount: finiteNumberOrNull(wasmMetadata.functionCount),
    closureWasmTypeCount: Array.isArray(wasmMetadata.types) ? wasmMetadata.types.length : 0,
    closureBundleManifestSchema: bundleManifest?.schema || null,
    closureBundleCopyFileCount: Array.isArray(bundleManifest?.copyFiles) ? bundleManifest.copyFiles.length : 0,
    closureBundlePreserveRelativeUrls: bundleManifest?.preserveRelativeUrls === true,
    closureHostImportsPath: hostImports?.path || null,
    closureHostImportsSha256: hostImports?.sha256 || null,
    closureHostImportsFactory: hostImports?.factory || null,
    closureHostImportsGlobal: hostImports?.global || null,
    closureHostImportsDomFree: hostImports?.domFree === true,
    closureOutputSemanticsSchema: outputSemantics?.schema || null,
    closureOutputSemanticsReady: outputSemantics?.schema === ESHKOL_CLOSURE_OUTPUT_SEMANTICS_SCHEMA
      && outputSemantics?.semanticScope === 'smoke-fixture'
      && outputSemantics?.scientificValidation === false,
    closureOutputSemanticScope: outputSemantics?.semanticScope || null,
    closureOutputScientificScope: outputSemantics?.scientificScope || null,
    closureOutputScientificValidation: typeof outputSemantics?.scientificValidation === 'boolean'
      ? outputSemantics.scientificValidation
      : null,
    closureOutputExpectedEntryExport: outputSemantics?.entryExport || null,
    closureOutputExpectedEntryArgs: clonePlain(Array.isArray(outputSemantics?.entryArgs) ? outputSemantics.entryArgs : null),
    closureOutputExpectedEntryResult: outputSemantics?.expectedEntryResult ?? null,
    closureOutputExpectedStdoutSha256: outputSemanticsStdout.sha256 || null,
    closureOutputExpectedStdoutByteLength: finiteNumberOrNull(outputSemanticsStdout.byteLength),
    closureReady: inferArtifactKind(artifact) === 'closure'
      && (artifact.validation?.status || null) === 'pass'
      && execution.serviceWorkerSafe === true
      && validity.requiresDynamicCode === false,
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
    outputReferenceCount: outputReferences.length,
    outputReferenceReadyCount: outputReferences.filter((entry) => entry.ready).length,
    outputReferences,
    magnetarCalibratedReferenceCount: magnetarCalibratedReferences.length,
    magnetarCalibratedReferenceReadyCount: magnetarCalibratedReferences.filter((entry) => entry.ready).length,
    magnetarCalibratedReferenceScientificCoverageCount: magnetarCalibratedReferences
      .filter((entry) => entry.scientificCoverage === true).length,
    magnetarCalibratedReferences,
    magnetarDipoleIsingReady: magnetarDipoleIsing?.ready === true,
    magnetarDipoleIsingStatus: magnetarDipoleIsing?.status || null,
    magnetarDipoleIsingParityStatus: magnetarDipoleIsing?.parityStatus || null,
    magnetarDipoleIsingGroundState: magnetarDipoleIsing?.groundStateBitString || null,
    magnetarDipoleIsingMaxEnergyDelta: magnetarDipoleIsing?.maxEnergyDelta ?? null,
    magnetarDipoleIsingEvaluatedBitstrings: magnetarDipoleIsing?.evaluatedBitstrings ?? null,
    magnetarReferenceReady: magnetarDipoleIsing?.referenceReady === true || outputMoonLabReference?.ready === true,
    magnetarReferenceSchema: magnetarDipoleIsing?.referenceSchema || outputMoonLabReference?.schema || null,
    magnetarReferenceRole: magnetarDipoleIsing?.referenceRole || outputMoonLabReference?.role || null,
    magnetarReferenceContractHash: magnetarDipoleIsing?.referenceContractHash || outputMoonLabReference?.contractHash || null,
    magnetarReferenceEnergyUnits: magnetarDipoleIsing?.referenceEnergyUnits || outputMoonLabReference?.energyUnits || null,
    magnetarReferenceGroundStateBitString: magnetarDipoleIsing?.referenceGroundStateBitString || outputMoonLabReference?.groundStateBitString || null,
    magnetarReferenceGroundStateEnergy: magnetarDipoleIsing?.referenceGroundStateEnergy ?? outputMoonLabReference?.groundStateEnergy ?? null,
    magnetarReferenceToleranceEnergyAbs: magnetarDipoleIsing?.referenceToleranceEnergyAbs ?? outputMoonLabReference?.toleranceEnergyAbs ?? null,
    magnetarReferenceMaxObservedEnergyDelta: magnetarDipoleIsing?.referenceMaxObservedEnergyDelta ?? outputMoonLabReference?.maxObservedEnergyDelta ?? null,
    magnetarReferenceValidationStatus: magnetarDipoleIsing?.referenceValidationStatus || outputMoonLabReference?.validationStatus || null
  };
}
