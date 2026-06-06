export const ULG_ARTIFACT_SUMMARY_SCHEMA = 'peercompute.ulg.artifact-summary.v0';
export const ULG_QUANTUM_RESPONSE_DESCRIPTOR_SCHEMA = 'peercompute.ulg.quantum-response-descriptor.v0';
export const ULG_QUANTUM_RESPONSE_PARITY_SCHEMA = 'peercompute.ulg.quantum-response-parity.v0';
export const ULG_MAGNETAR_DIPOLE_ISING_CALIBRATION_SCHEMA = 'peercompute.ulg.magnetar-dipole-ising-calibration.v0';
export const ESHKOL_CLOSURE_OUTPUT_SEMANTICS_SCHEMA = 'eshkol.ulg.closure-output-semantics.v0';
export const ESHKOL_MAGNETAR_CLOSURE_DESCRIPTOR_SCHEMA = 'eshkol.ulg.magnetar-closure-descriptor.v0';
export const ESHKOL_MAGNETAR_CLOSURE_TENSOR_RUNTIME_CONTRACT_SCHEMA = 'eshkol.ulg.magnetar-closure-tensor-runtime-contract.v0';
export const ESHKOL_TENSOR_LINEAR_MEMORY_BINDING_SCHEMA = 'eshkol.ulg.tensor-linear-memory-binding.v0';
export const ESHKOL_TENSOR_LINEAR_MEMORY_SMOKE_BINDING_SCHEMA = 'eshkol.ulg.tensor-linear-memory-smoke-binding.v0';
export const ESHKOL_TENSOR_ENTRY_EXPORT_OFFSET_PROBE_SCHEMA = 'eshkol.ulg.tensor-entry-export-offset-probe.v0';
export const ESHKOL_PRODUCTION_HANDLER_BOUNDARY_SCHEMA = 'eshkol.ulg.production-handler-boundary.v0';
export const PEERCOMPUTE_DISPATCH_HANDLER_CONTEXT_SCHEMA = 'peercompute.ulg.dispatch-service-handler-context.v0';
export const MOONLAB_MAGNETAR_DIPOLE_ISING_REFERENCE_SCHEMA = 'moonlab.magnetar-dipole-ising-reference.v0';
export const MOONLAB_MAGNETAR_REFERENCE_ROLE = 'peercompute-reference-tolerance-input';
export const MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_SCHEMA = 'moonlab.magnetar.calibrated-reference.v0';
export const MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_ROLE = 'peercompute-scientific-tolerance-input';
export const MOONLAB_WEBGPU_COMPLEX64_PARITY_SCOPE_SCHEMA = 'moonlab.webgpu.complex64-parity-scope.v0';
export const MOONLAB_WEBGPU_COMPLEX64_PROBABILITY_KERNEL_PROBE_SCHEMA = 'moonlab.webgpu.complex64-probability-kernel-probe.v0';
export const MOONLAB_WEBGPU_COMPLEX64_NATIVE_OPERATION_PROBE_SCHEMA = 'moonlab.webgpu.complex64-native-operation-probe.v0';

const ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS = Object.freeze([
  'production-magnetar-handler-not-implemented',
  'wasm-tensor-memory-binding-not-executed',
  'wasm-entry-export-does-not-consume-tensor-offsets',
  'wasm-main-export-offset-args-leave-declared-tensor-range-unchanged',
  'host-imports-require-runtime-smoke-stubs-for-magnetar-fixture',
  'full-physics-validation-not-run'
]);
const MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS = Object.freeze([
  'hadamard',
  'pauli_x',
  'pauli_z',
  'cnot'
]);
const MOONLAB_NATIVE_OPERATION_TARGET_DECLARATIONS = Object.freeze([
  'hadamard',
  'pauli_x',
  'pauli_z',
  'cnot'
]);

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

function objectOrNull(value) {
  return isPlainObject(value) ? value : null;
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
    fidelityRuntimeScope: clonePlain(objectOrNull(reference.fidelityRuntimeScope)),
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

function arraysEqual(left = [], right = []) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
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
  const closureDescriptor = artifact.validation?.closureDescriptor && typeof artifact.validation.closureDescriptor === 'object'
    ? artifact.validation.closureDescriptor
    : null;
  const closureDescriptorTensorContract = closureDescriptor?.tensorContract && typeof closureDescriptor.tensorContract === 'object'
    ? closureDescriptor.tensorContract
    : {};
  const closureDescriptorBinding = closureDescriptor?.descriptorBinding && typeof closureDescriptor.descriptorBinding === 'object'
    ? closureDescriptor.descriptorBinding
    : {};
  const closureDescriptorFidelityRuntimeScope = objectOrNull(closureDescriptorBinding.fidelityRuntimeScope);
  const closureInterpolationTable = closureDescriptorBinding.ulgInterpolationTable
    && typeof closureDescriptorBinding.ulgInterpolationTable === 'object'
    ? closureDescriptorBinding.ulgInterpolationTable
    : null;
  const closureTensorRuntimeContract = objectOrNull(closureDescriptorBinding.closureTensorRuntimeContract);
  const closureTensorRuntimeInterpolationTable = objectOrNull(closureTensorRuntimeContract?.interpolationTable);
  const closureTensorRuntimeSampleShapeValidation = objectOrNull(closureTensorRuntimeContract?.sampleShapeValidation);
  const closureTensorLinearMemoryBinding = objectOrNull(closureTensorRuntimeContract?.linearMemoryBinding);
  const closureTensorLinearMemoryImport = objectOrNull(closureTensorLinearMemoryBinding?.memoryImport);
  const closureTensorLinearMemorySmokeBinding = objectOrNull(closureTensorLinearMemoryBinding?.smokeBinding);
  const closureTensorEntryExportOffsetProbe = objectOrNull(closureTensorLinearMemoryBinding?.entryExportOffsetProbe);
  const closureProductionHandlerBoundary = objectOrNull(closureDescriptorBinding.productionHandlerBoundary);
  const closureProductionHandlerTensorMemoryBinding = objectOrNull(closureProductionHandlerBoundary?.tensorMemoryBinding);
  const outputSemanticsStdout = outputSemantics?.stdout && typeof outputSemantics.stdout === 'object'
    ? outputSemantics.stdout
    : {};
  const bundleManifest = artifact.runtime?.bundleManifest && typeof artifact.runtime.bundleManifest === 'object'
    ? artifact.runtime.bundleManifest
    : (artifact.bundleManifest && typeof artifact.bundleManifest === 'object' ? artifact.bundleManifest : null);
  const bundleCopyFiles = Array.isArray(bundleManifest?.copyFiles)
    ? bundleManifest.copyFiles
    : (Array.isArray(bundleManifest?.manualDeploy?.copyFiles) ? bundleManifest.manualDeploy.copyFiles : []);
  const hostImports = bundleManifest?.hostImports && typeof bundleManifest.hostImports === 'object'
    ? bundleManifest.hostImports
    : (artifact.runtime?.hostImports && typeof artifact.runtime.hostImports === 'object' ? artifact.runtime.hostImports : null);
  const parityComparisons = Array.isArray(parity?.comparisons) ? parity.comparisons : [];
  const moonlabWebGpuParityScope = objectOrNull(artifact.webGpuParityScope)
    || objectOrNull(outputs.webGpuParityScope)
    || objectOrNull(artifact.runtime?.coreProbe?.webGpuParityScope?.artifact);
  const moonlabWebGpuParityScopeBlockers = Array.isArray(moonlabWebGpuParityScope?.blockers)
    ? moonlabWebGpuParityScope.blockers.map((blocker) => String(blocker)).filter(Boolean)
    : [];
  const moonlabWebGpuParity = objectOrNull(moonlabWebGpuParityScope?.webgpuParity);
  const moonlabWebGpuProbabilityKernelProbe = objectOrNull(moonlabWebGpuParityScope?.browserKernelProbe);
  const moonlabWebGpuProbabilityKernelCoveredNativeOperations =
    Array.isArray(moonlabWebGpuProbabilityKernelProbe?.coveredNativeOperations)
      ? moonlabWebGpuProbabilityKernelProbe.coveredNativeOperations.map((operation) => String(operation)).filter(Boolean)
      : [];
  const moonlabWebGpuNativeOperationProbe = objectOrNull(moonlabWebGpuParityScope?.browserNativeOperationProbe);
  const moonlabWebGpuNativeOperationCoveredOperations =
    Array.isArray(moonlabWebGpuNativeOperationProbe?.coveredNativeOperations)
      ? moonlabWebGpuNativeOperationProbe.coveredNativeOperations.map((operation) => String(operation)).filter(Boolean)
      : [];
  const moonlabWebGpuNativeOperationResults =
    Array.isArray(moonlabWebGpuNativeOperationProbe?.operationResults)
      ? moonlabWebGpuNativeOperationProbe.operationResults
        .filter(isPlainObject)
        .map((entry) => ({
          operation: textOrNull(entry.operation),
          executed: typeof entry.executed === 'boolean' ? entry.executed : null,
          passed: typeof entry.passed === 'boolean' ? entry.passed : null,
          covered: typeof entry.covered === 'boolean' ? entry.covered : null,
          blocker: textOrNull(entry.blocker),
          reason: textOrNull(entry.reason),
          maxAmplitudeAbsDiff: finiteNumberOrNull(entry.maxAmplitudeAbsDiff),
          tolerance: finiteNumberOrNull(entry.tolerance)
        }))
      : [];
  const moonlabWebGpuNativeOperationResultByOperation = new Map(
    moonlabWebGpuNativeOperationResults
      .filter((entry) => entry.operation)
      .map((entry) => [entry.operation, entry])
  );
  const moonlabWebGpuNativeOperationDeclaredOperations =
    moonlabWebGpuNativeOperationResults.map((entry) => entry.operation).filter(Boolean);
  const moonlabWebGpuNativeOperationBlockedOperations =
    moonlabWebGpuNativeOperationResults
      .filter((entry) => entry.operation && entry.covered !== true)
      .map((entry) => entry.operation);
  const moonlabWebGpuNativeOperationMissingTargetOperations =
    MOONLAB_NATIVE_OPERATION_TARGET_DECLARATIONS
      .filter((operation) => !moonlabWebGpuNativeOperationResultByOperation.has(operation));
  const moonlabWebGpuHadamardNativeOperationResult = moonlabWebGpuNativeOperationResults
    .find((entry) => entry.operation === 'hadamard') || null;
  const moonlabWebGpuPauliXNativeOperationResult = moonlabWebGpuNativeOperationResults
    .find((entry) => entry.operation === 'pauli_x') || null;
  const moonlabComplex64Preflight = objectOrNull(moonlabWebGpuParityScope?.complex64Preflight);
  const moonlabWebGpuParityFidelityRuntimeScope = objectOrNull(moonlabWebGpuParityScope?.fidelityRuntimeScope);
  const moonlabWebGpuProbabilityKernelProbeDeclared =
    moonlabWebGpuProbabilityKernelProbe?.schema === MOONLAB_WEBGPU_COMPLEX64_PROBABILITY_KERNEL_PROBE_SCHEMA
    && moonlabWebGpuProbabilityKernelProbe.probeKind === 'browser-webgpu-complex64-probability-kernel'
    && moonlabWebGpuProbabilityKernelProbe.kernel === 'compute_probabilities'
    && moonlabWebGpuProbabilityKernelProbe.executed === false
    && moonlabWebGpuProbabilityKernelProbe.passed === false
    && moonlabWebGpuProbabilityKernelProbe.maxProbabilityAbsDiff == null
    && moonlabWebGpuProbabilityKernelCoveredNativeOperations.length === 0;
  const moonlabWebGpuNativeOperationResultBlocked = (entry) => entry?.executed === false
    && entry?.passed === false
    && entry?.covered === false
    && entry?.blocker === 'native-operation-probe-not-executed';
  const moonlabWebGpuNativeOperationProbeDeclared =
    moonlabWebGpuNativeOperationProbe?.schema === MOONLAB_WEBGPU_COMPLEX64_NATIVE_OPERATION_PROBE_SCHEMA
    && moonlabWebGpuNativeOperationProbe.probeKind === 'browser-webgpu-complex64-native-operation-probe'
    && moonlabWebGpuNativeOperationProbe.executed === false
    && moonlabWebGpuNativeOperationProbe.passed === false
    && moonlabWebGpuNativeOperationProbe.maxAmplitudeAbsDiff == null
    && moonlabWebGpuNativeOperationCoveredOperations.length === 0
    && MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS
      .every((operation) => moonlabWebGpuNativeOperationResultBlocked(
        moonlabWebGpuNativeOperationResultByOperation.get(operation)
      ))
    && moonlabWebGpuNativeOperationResults.length >= MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS.length
    && moonlabWebGpuNativeOperationResults.every(moonlabWebGpuNativeOperationResultBlocked);
  const moonlabWebGpuParityScopeReady = moonlabWebGpuParityScope?.schema === MOONLAB_WEBGPU_COMPLEX64_PARITY_SCOPE_SCHEMA
    && moonlabWebGpuParityScope.contractReady === true
    && moonlabWebGpuParityScope.contractValidation?.valid === true
    && moonlabWebGpuParityScope.reducedFixtureOnly === true
    && moonlabWebGpuParityScope.backendAvailable === false
    && moonlabWebGpuParity?.executed === false
    && moonlabWebGpuParity?.passed === false
    && moonlabComplex64Preflight?.passed === true
    && moonlabWebGpuParityScope.fullFidelityMagnetarSimulation === false
    && moonlabWebGpuParityScope.fullPhysicsValidation === false
    && moonlabWebGpuParityFidelityRuntimeScope?.schema === 'ulg.magnetar.fidelity-runtime-scope.v0'
    && moonlabWebGpuParityFidelityRuntimeScope.fullFidelityMagnetarSimulation === false
    && moonlabWebGpuParityFidelityRuntimeScope.fullPhysicsValidation === false
    && moonlabWebGpuProbabilityKernelProbeDeclared
    && moonlabWebGpuNativeOperationProbeDeclared
    && moonlabWebGpuParityScopeBlockers.includes('native-webgpu-operation-coverage-not-yet-recorded')
    && moonlabWebGpuParityScopeBlockers.includes('browser-webgpu-kernel-parity-not-executed');
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
  const closureDescriptorReady = closureDescriptor?.schema === ESHKOL_MAGNETAR_CLOSURE_DESCRIPTOR_SCHEMA
    && closureDescriptor.scientificValidation === false
    && closureDescriptor.entryExport === execution.entryExport
    && Array.isArray(closureDescriptorTensorContract.inputIds)
    && closureDescriptorTensorContract.inputIds.length > 0
    && Array.isArray(closureDescriptorTensorContract.outputIds)
    && closureDescriptorTensorContract.outputIds.length > 0;
  const closureTensorRuntimeInputIds = Array.isArray(closureTensorRuntimeContract?.inputTensorIds)
    ? closureTensorRuntimeContract.inputTensorIds
    : [];
  const closureTensorRuntimeOutputIds = Array.isArray(closureTensorRuntimeContract?.outputTensorIds)
    ? closureTensorRuntimeContract.outputTensorIds
    : [];
  const closureTensorLinearMemoryTensors = Array.isArray(closureTensorLinearMemoryBinding?.tensors)
    ? closureTensorLinearMemoryBinding.tensors.filter(isPlainObject).map((tensor) => ({
      id: textOrNull(tensor.id),
      direction: textOrNull(tensor.direction),
      dtype: textOrNull(tensor.dtype),
      layout: textOrNull(tensor.layout),
      shape: clonePlain(Array.isArray(tensor.shape) ? tensor.shape : []),
      byteOffset: finiteNumberOrNull(tensor.byteOffset),
      byteLength: finiteNumberOrNull(tensor.byteLength),
      elementOffset: finiteNumberOrNull(tensor.elementOffset),
      elementCount: finiteNumberOrNull(tensor.elementCount),
      consumedByEntryExport: typeof tensor.consumedByEntryExport === 'boolean'
        ? tensor.consumedByEntryExport
        : null
    }))
    : [];
  const closureTensorLinearMemoryTensorIds = closureTensorLinearMemoryTensors
    .map((tensor) => tensor.id)
    .filter(Boolean);
  const closureProductionHandlerInputTensorIds = Array.isArray(closureProductionHandlerBoundary?.inputTensorIds)
    ? closureProductionHandlerBoundary.inputTensorIds
    : [];
  const closureProductionHandlerOutputTensorIds = Array.isArray(closureProductionHandlerBoundary?.outputTensorIds)
    ? closureProductionHandlerBoundary.outputTensorIds
    : [];
  const closureProductionHandlerAllowedExecutionClaims =
    Array.isArray(closureProductionHandlerBoundary?.allowedExecutionClaims)
      ? closureProductionHandlerBoundary.allowedExecutionClaims.map((claim) => String(claim)).filter(Boolean)
      : [];
  const closureProductionHandlerBoundaryBlockers = Array.isArray(closureProductionHandlerBoundary?.blockers)
    ? closureProductionHandlerBoundary.blockers.map((blocker) => String(blocker)).filter(Boolean)
    : [];
  const closureTensorRuntimeContractReady =
    closureTensorRuntimeContract?.schema === ESHKOL_MAGNETAR_CLOSURE_TENSOR_RUNTIME_CONTRACT_SCHEMA
    && closureTensorRuntimeContract.status === 'declared-fixture-contract'
    && typeof closureTensorRuntimeContract.contractHash === 'string'
    && closureTensorRuntimeContract.contractHash.startsWith('sha256:')
    && closureTensorRuntimeContract.entryExport === closureDescriptor?.entryExport
    && closureTensorRuntimeContract.coordinateSystem === closureDescriptorTensorContract.coordinateSystem
    && arraysEqual(closureTensorRuntimeInputIds, closureDescriptorTensorContract.inputIds)
    && arraysEqual(closureTensorRuntimeOutputIds, closureDescriptorTensorContract.outputIds)
    && closureTensorRuntimeInterpolationTable?.id === closureInterpolationTable?.id
    && closureTensorRuntimeInterpolationTable?.contentHash === closureInterpolationTable?.contentHash
    && finiteNumberOrNull(closureTensorRuntimeInterpolationTable?.sampleCount) === finiteNumberOrNull(closureInterpolationTable?.sampleCount)
    && closureTensorRuntimeSampleShapeValidation?.status === 'pass'
    && closureTensorRuntimeSampleShapeValidation?.scientificValidation === false
    && finiteNumberOrNull(closureTensorRuntimeSampleShapeValidation?.validatedSampleCount) === finiteNumberOrNull(closureInterpolationTable?.sampleCount)
    && closureTensorRuntimeContract.runtimeStatus === 'declared-not-executed'
    && closureTensorRuntimeContract.scientificValidation === false
    && closureTensorRuntimeContract.fullPhysicsValidation === false;
  const closureTensorLinearMemoryBindingReady =
    closureTensorLinearMemoryBinding?.schema === ESHKOL_TENSOR_LINEAR_MEMORY_BINDING_SCHEMA
    && closureTensorLinearMemoryBinding.bindingId === 'eshkol:magnetar-closure-linear-memory-binding:v0'
    && closureTensorLinearMemoryBinding.status === 'host-layout-smoke-bound-not-consumed'
    && closureTensorLinearMemoryBinding.runtimeStatus === 'host-layout-smoke-only'
    && closureTensorLinearMemoryBinding.executionClaim === 'tensor-buffer-layout-only'
    && closureTensorLinearMemoryBinding.elementType === 'f64'
    && finiteNumberOrNull(closureTensorLinearMemoryBinding.elementByteLength) === 8
    && finiteNumberOrNull(closureTensorLinearMemoryBinding.alignmentBytes) === 8
    && closureTensorLinearMemoryBinding.entryExportConsumesOffsets === false
    && closureTensorLinearMemoryBinding.scientificValidation === false
    && closureTensorLinearMemoryBinding.fullPhysicsValidation === false
    && closureTensorLinearMemoryBinding.fullFidelityMagnetarSimulation === false
    && closureTensorLinearMemoryImport?.module === 'env'
    && closureTensorLinearMemoryImport?.name === '__linear_memory'
    && finiteNumberOrNull(closureTensorLinearMemoryImport?.baseOffset) === 131072
    && finiteNumberOrNull(closureTensorLinearMemoryImport?.totalByteLength) === 168
    && finiteNumberOrNull(closureTensorLinearMemoryImport?.minimumPages) === 3
    && arraysEqual(closureTensorLinearMemoryTensorIds, [
      'magnetar-state-vector',
      'closure-control-vector',
      'magnetar-closure-update',
      'closure-residual'
    ])
    && closureTensorLinearMemoryTensors.every((tensor) => (
      tensor.dtype === 'f64'
      && tensor.layout === 'dense-row-major'
      && tensor.consumedByEntryExport === false
    ))
    && closureTensorLinearMemorySmokeBinding?.schema === ESHKOL_TENSOR_LINEAR_MEMORY_SMOKE_BINDING_SCHEMA
    && closureTensorLinearMemorySmokeBinding.status === 'host-layout-smoke-passed'
    && closureTensorLinearMemorySmokeBinding.scientificValidation === false
    && closureTensorLinearMemorySmokeBinding.outputInitialization === 'host-smoke-only-not-entry-export-produced'
    && arraysEqual(closureTensorLinearMemorySmokeBinding.writeTensorIds, closureTensorRuntimeInputIds)
    && arraysEqual(closureTensorLinearMemorySmokeBinding.readbackTensorIds, closureTensorRuntimeInputIds)
    && arraysEqual(closureTensorLinearMemorySmokeBinding.outputTensorIds, closureTensorRuntimeOutputIds)
    && closureTensorEntryExportOffsetProbe?.schema === ESHKOL_TENSOR_ENTRY_EXPORT_OFFSET_PROBE_SCHEMA
    && closureTensorEntryExportOffsetProbe.status === 'abi-blocked'
    && closureTensorEntryExportOffsetProbe.entryExport === closureDescriptor?.entryExport
    && closureTensorEntryExportOffsetProbe.entryExportConsumesOffsets === false
    && closureTensorEntryExportOffsetProbe.outputTensorsProducedByEntryExport === false
    && finiteNumberOrNull(closureTensorEntryExportOffsetProbe.changedBytesInDeclaredTensorRange) === 0
    && closureTensorEntryExportOffsetProbe.observedStdoutInvariantAcrossArgs === true
    && closureTensorEntryExportOffsetProbe.scientificValidation === false
    && closureTensorEntryExportOffsetProbe.fullPhysicsValidation === false
    && closureTensorEntryExportOffsetProbe.blocker
      === 'main-export-accepts-two-i32-runtime-args-but-does-not-read-or-write-host-managed-tensor-offsets';
  const closureProductionHandlerBoundaryDeclared =
    closureProductionHandlerBoundary?.schema === ESHKOL_PRODUCTION_HANDLER_BOUNDARY_SCHEMA
    && textOrNull(closureProductionHandlerBoundary.handlerId) != null
    && textOrNull(closureProductionHandlerBoundary.handlerKind) != null
    && closureProductionHandlerBoundary.dispatchSchema === PEERCOMPUTE_DISPATCH_HANDLER_CONTEXT_SCHEMA
    && closureProductionHandlerBoundary.status === 'declared-not-executed'
    && closureProductionHandlerBoundary.handlerReady === false
    && closureProductionHandlerBoundary.runtimeExecution === false
    && closureProductionHandlerBoundary.derivativeStatus === 'declared-not-computed'
    && closureProductionHandlerBoundary.scientificValidation === false
    && closureProductionHandlerBoundary.fullPhysicsValidation === false
    && closureProductionHandlerBoundary.fullFidelityMagnetarSimulation === false
    && closureProductionHandlerBoundary.entryExport === closureDescriptor?.entryExport
    && closureProductionHandlerBoundary.entryExport === closureTensorRuntimeContract?.entryExport
    && closureProductionHandlerBoundary.runtimeAbi === closureTensorRuntimeContract?.runtimeAbi
    && closureProductionHandlerBoundary.tensorMemoryModel === closureTensorRuntimeContract?.tensorMemoryModel
    && arraysEqual(closureProductionHandlerInputTensorIds, closureTensorRuntimeInputIds)
    && arraysEqual(closureProductionHandlerOutputTensorIds, closureTensorRuntimeOutputIds)
    && closureProductionHandlerBoundary.moduleRef?.source === 'artifact.execution.module'
    && closureProductionHandlerBoundary.moduleRef?.contentAddressing === 'required'
    && closureProductionHandlerBoundary.moduleRef?.sha256Field === 'artifact.execution.module.sha256'
    && closureProductionHandlerBoundary.hostImports?.source === 'bundle.hostImports'
    && closureProductionHandlerBoundary.hostImports?.required === validity.requiresHostImports
    && closureProductionHandlerBoundary.hostImports?.factory === 'createEshkolHostImportObject'
    && hostImports?.factory === closureProductionHandlerBoundary.hostImports?.factory
    && closureProductionHandlerAllowedExecutionClaims.includes(closureTensorRuntimeContract?.executionClaim)
    && closureProductionHandlerTensorMemoryBinding?.source
      === 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding'
    && closureProductionHandlerTensorMemoryBinding?.status === closureTensorLinearMemoryBinding?.status
    && closureProductionHandlerTensorMemoryBinding?.executionClaim === closureTensorLinearMemoryBinding?.executionClaim
    && closureProductionHandlerTensorMemoryBinding?.entryExportConsumesOffsets === false
    && ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS.every((blocker) => (
      closureProductionHandlerBoundaryBlockers.includes(blocker)
    ));
  const closureHandoffReady = (artifact.validation?.status || null) === 'pass'
    || closureDescriptorReady;

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
    closureBundleCopyFileCount: bundleCopyFiles.length,
    closureBundlePreserveRelativeUrls: bundleManifest?.preserveRelativeUrls === true
      || bundleManifest?.manualDeploy?.preserveRelativeUrls === true,
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
    closureDescriptorSchema: closureDescriptor?.schema || null,
    closureDescriptorReady,
    closureDescriptorRole: closureDescriptor?.descriptorRole || null,
    closureDescriptorEntryExport: closureDescriptor?.entryExport || null,
    closureDescriptorFixtureChecksum: finiteNumberOrNull(closureDescriptor?.fixtureChecksum),
    closureDescriptorScientificValidation: typeof closureDescriptor?.scientificValidation === 'boolean'
      ? closureDescriptor.scientificValidation
      : null,
    closureDescriptorFidelityRuntimeScope: clonePlain(closureDescriptorFidelityRuntimeScope),
    closureDescriptorCoordinateSystem: closureDescriptorTensorContract.coordinateSystem || null,
    closureDescriptorInterpolation: closureDescriptorTensorContract.interpolation || null,
    closureDescriptorInputIds: clonePlain(Array.isArray(closureDescriptorTensorContract.inputIds)
      ? closureDescriptorTensorContract.inputIds
      : []),
    closureDescriptorOutputIds: clonePlain(Array.isArray(closureDescriptorTensorContract.outputIds)
      ? closureDescriptorTensorContract.outputIds
      : []),
    closureDescriptorNextContractFields: clonePlain(Array.isArray(closureDescriptor?.nextContractFields)
      ? closureDescriptor.nextContractFields
      : []),
    closureInterpolationTableSchema: closureInterpolationTable?.schema || null,
    closureInterpolationTableId: closureInterpolationTable?.id || null,
    closureInterpolationTableStatus: closureInterpolationTable?.status || null,
    closureInterpolationTableFixtureScope: closureInterpolationTable?.fixtureScope || null,
    closureInterpolationTableScientificValidation:
      typeof closureInterpolationTable?.scientificValidation === 'boolean'
        ? closureInterpolationTable.scientificValidation
        : null,
    closureInterpolationTableSampleCount: finiteNumberOrNull(closureInterpolationTable?.sampleCount),
    closureInterpolationTableSampleIds: clonePlain(Array.isArray(closureInterpolationTable?.sampleIds)
      ? closureInterpolationTable.sampleIds
      : []),
    closureInterpolationTableContentHash: closureInterpolationTable?.contentHash || null,
    closureInterpolationTablePayloadSampleCount: Array.isArray(closureInterpolationTable?.samples)
      ? closureInterpolationTable.samples.length
      : 0,
    closureTensorRuntimeContractSchema: closureTensorRuntimeContract?.schema || null,
    closureTensorRuntimeContractId: closureTensorRuntimeContract?.contractId || null,
    closureTensorRuntimeContractStatus: closureTensorRuntimeContract?.status || null,
    closureTensorRuntimeContractReady,
    closureTensorRuntimeContractHash: closureTensorRuntimeContract?.contractHash || null,
    closureTensorRuntimeRuntimeAbi: closureTensorRuntimeContract?.runtimeAbi || null,
    closureTensorRuntimeExecutionClaim: closureTensorRuntimeContract?.executionClaim || null,
    closureTensorRuntimeEntryExport: closureTensorRuntimeContract?.entryExport || null,
    closureTensorRuntimeMemoryModel: closureTensorRuntimeContract?.tensorMemoryModel || null,
    closureTensorRuntimeCoordinateSystem: closureTensorRuntimeContract?.coordinateSystem || null,
    closureTensorRuntimeInputTensorIds: clonePlain(closureTensorRuntimeInputIds),
    closureTensorRuntimeOutputTensorIds: clonePlain(closureTensorRuntimeOutputIds),
    closureTensorRuntimeInterpolationTableId: closureTensorRuntimeInterpolationTable?.id || null,
    closureTensorRuntimeInterpolationTableContentHash: closureTensorRuntimeInterpolationTable?.contentHash || null,
    closureTensorRuntimeInterpolationTableSampleCount: finiteNumberOrNull(closureTensorRuntimeInterpolationTable?.sampleCount),
    closureTensorRuntimeSampleShapeValidationSchema: closureTensorRuntimeSampleShapeValidation?.schema || null,
    closureTensorRuntimeSampleShapeValidationStatus: closureTensorRuntimeSampleShapeValidation?.status || null,
    closureTensorRuntimeSampleShapeValidatedSampleCount: finiteNumberOrNull(
      closureTensorRuntimeSampleShapeValidation?.validatedSampleCount
    ),
    closureTensorRuntimeScientificValidation:
      typeof closureTensorRuntimeContract?.scientificValidation === 'boolean'
        ? closureTensorRuntimeContract.scientificValidation
        : null,
    closureTensorRuntimeFullPhysicsValidation:
      typeof closureTensorRuntimeContract?.fullPhysicsValidation === 'boolean'
        ? closureTensorRuntimeContract.fullPhysicsValidation
        : null,
    closureTensorLinearMemoryBindingSchema: closureTensorLinearMemoryBinding?.schema || null,
    closureTensorLinearMemoryBindingId: closureTensorLinearMemoryBinding?.bindingId || null,
    closureTensorLinearMemoryBindingStatus: closureTensorLinearMemoryBinding?.status || null,
    closureTensorLinearMemoryBindingReady,
    closureTensorLinearMemoryRuntimeStatus: closureTensorLinearMemoryBinding?.runtimeStatus || null,
    closureTensorLinearMemoryExecutionClaim: closureTensorLinearMemoryBinding?.executionClaim || null,
    closureTensorLinearMemoryElementType: closureTensorLinearMemoryBinding?.elementType || null,
    closureTensorLinearMemoryElementByteLength:
      finiteNumberOrNull(closureTensorLinearMemoryBinding?.elementByteLength),
    closureTensorLinearMemoryAlignmentBytes:
      finiteNumberOrNull(closureTensorLinearMemoryBinding?.alignmentBytes),
    closureTensorLinearMemoryEntryExportConsumesOffsets:
      typeof closureTensorLinearMemoryBinding?.entryExportConsumesOffsets === 'boolean'
        ? closureTensorLinearMemoryBinding.entryExportConsumesOffsets
        : null,
    closureTensorLinearMemoryBaseOffset:
      finiteNumberOrNull(closureTensorLinearMemoryImport?.baseOffset),
    closureTensorLinearMemoryTotalByteLength:
      finiteNumberOrNull(closureTensorLinearMemoryImport?.totalByteLength),
    closureTensorLinearMemoryMinimumPages:
      finiteNumberOrNull(closureTensorLinearMemoryImport?.minimumPages),
    closureTensorLinearMemoryTensorCount: closureTensorLinearMemoryTensors.length,
    closureTensorLinearMemoryTensorIds: clonePlain(closureTensorLinearMemoryTensorIds),
    closureTensorLinearMemoryTensors: clonePlain(closureTensorLinearMemoryTensors),
    closureTensorLinearMemorySmokeBindingSchema: closureTensorLinearMemorySmokeBinding?.schema || null,
    closureTensorLinearMemorySmokeBindingStatus: closureTensorLinearMemorySmokeBinding?.status || null,
    closureTensorLinearMemorySmokeBindingOutputInitialization:
      closureTensorLinearMemorySmokeBinding?.outputInitialization || null,
    closureTensorEntryExportOffsetProbeSchema: closureTensorEntryExportOffsetProbe?.schema || null,
    closureTensorEntryExportOffsetProbeStatus: closureTensorEntryExportOffsetProbe?.status || null,
    closureTensorEntryExportOffsetProbeBlocker: closureTensorEntryExportOffsetProbe?.blocker || null,
    closureTensorEntryExportOffsetProbeEntryExport: closureTensorEntryExportOffsetProbe?.entryExport || null,
    closureTensorEntryExportConsumesOffsets:
      typeof closureTensorEntryExportOffsetProbe?.entryExportConsumesOffsets === 'boolean'
        ? closureTensorEntryExportOffsetProbe.entryExportConsumesOffsets
        : null,
    closureTensorEntryExportOutputTensorsProduced:
      typeof closureTensorEntryExportOffsetProbe?.outputTensorsProducedByEntryExport === 'boolean'
        ? closureTensorEntryExportOffsetProbe.outputTensorsProducedByEntryExport
        : null,
    closureTensorEntryExportChangedBytesInDeclaredTensorRange:
      finiteNumberOrNull(closureTensorEntryExportOffsetProbe?.changedBytesInDeclaredTensorRange),
    closureTensorEntryExportObservedStdoutInvariantAcrossArgs:
      typeof closureTensorEntryExportOffsetProbe?.observedStdoutInvariantAcrossArgs === 'boolean'
        ? closureTensorEntryExportOffsetProbe.observedStdoutInvariantAcrossArgs
        : null,
    closureProductionHandlerBoundarySchema: closureProductionHandlerBoundary?.schema || null,
    closureProductionHandlerBoundaryStatus: closureProductionHandlerBoundary?.status || null,
    closureProductionHandlerBoundaryDeclared,
    closureProductionHandlerBoundaryHandlerId: closureProductionHandlerBoundary?.handlerId || null,
    closureProductionHandlerBoundaryHandlerKind: closureProductionHandlerBoundary?.handlerKind || null,
    closureProductionHandlerBoundaryDispatchSchema: closureProductionHandlerBoundary?.dispatchSchema || null,
    closureProductionHandlerReady:
      typeof closureProductionHandlerBoundary?.handlerReady === 'boolean'
        ? closureProductionHandlerBoundary.handlerReady
        : null,
    closureProductionHandlerRuntimeExecution:
      typeof closureProductionHandlerBoundary?.runtimeExecution === 'boolean'
        ? closureProductionHandlerBoundary.runtimeExecution
        : null,
    closureProductionHandlerEntryExport: closureProductionHandlerBoundary?.entryExport || null,
    closureProductionHandlerRuntimeAbi: closureProductionHandlerBoundary?.runtimeAbi || null,
    closureProductionHandlerTensorMemoryModel: closureProductionHandlerBoundary?.tensorMemoryModel || null,
    closureProductionHandlerInputTensorIds: clonePlain(closureProductionHandlerInputTensorIds),
    closureProductionHandlerOutputTensorIds: clonePlain(closureProductionHandlerOutputTensorIds),
    closureProductionHandlerDerivativeStatus: closureProductionHandlerBoundary?.derivativeStatus || null,
    closureProductionHandlerScientificValidation:
      typeof closureProductionHandlerBoundary?.scientificValidation === 'boolean'
        ? closureProductionHandlerBoundary.scientificValidation
        : null,
    closureProductionHandlerFullPhysicsValidation:
      typeof closureProductionHandlerBoundary?.fullPhysicsValidation === 'boolean'
        ? closureProductionHandlerBoundary.fullPhysicsValidation
        : null,
    closureProductionHandlerFullFidelityMagnetarSimulation:
      typeof closureProductionHandlerBoundary?.fullFidelityMagnetarSimulation === 'boolean'
        ? closureProductionHandlerBoundary.fullFidelityMagnetarSimulation
        : null,
    closureProductionHandlerAllowedExecutionClaims: clonePlain(closureProductionHandlerAllowedExecutionClaims),
    closureProductionHandlerBoundaryBlockers: clonePlain(closureProductionHandlerBoundaryBlockers),
    closureProductionHandlerTensorMemoryBinding: clonePlain(closureProductionHandlerTensorMemoryBinding),
    closureReady: inferArtifactKind(artifact) === 'closure'
      && closureHandoffReady
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
    moonlabWebGpuParityScopeSchema: moonlabWebGpuParityScope?.schema || null,
    moonlabWebGpuParityScopeStatus: moonlabWebGpuParityScope?.status || null,
    moonlabWebGpuParityScopeReady,
    moonlabWebGpuParityScopeContractReady: moonlabWebGpuParityScope?.contractReady === true,
    moonlabWebGpuParityScopeReducedFixtureOnly: moonlabWebGpuParityScope?.reducedFixtureOnly === true,
    moonlabWebGpuParityScopeBackendAvailable:
      typeof moonlabWebGpuParityScope?.backendAvailable === 'boolean'
        ? moonlabWebGpuParityScope.backendAvailable
        : null,
    moonlabWebGpuParityExecuted:
      typeof moonlabWebGpuParity?.executed === 'boolean' ? moonlabWebGpuParity.executed : null,
    moonlabWebGpuParityPassed:
      typeof moonlabWebGpuParity?.passed === 'boolean' ? moonlabWebGpuParity.passed : null,
    moonlabWebGpuParityMaxProbabilityAbsDiff:
      finiteNumberOrNull(moonlabWebGpuParity?.maxProbabilityAbsDiff),
    moonlabWebGpuParityTolerance: finiteNumberOrNull(moonlabWebGpuParity?.tolerance),
    moonlabWebGpuProbabilityKernelProbeSchema: moonlabWebGpuProbabilityKernelProbe?.schema || null,
    moonlabWebGpuProbabilityKernelProbeDeclared,
    moonlabWebGpuProbabilityKernelProbeKind: moonlabWebGpuProbabilityKernelProbe?.probeKind || null,
    moonlabWebGpuProbabilityKernel: moonlabWebGpuProbabilityKernelProbe?.kernel || null,
    moonlabWebGpuProbabilityKernelExecuted:
      typeof moonlabWebGpuProbabilityKernelProbe?.executed === 'boolean'
        ? moonlabWebGpuProbabilityKernelProbe.executed
        : null,
    moonlabWebGpuProbabilityKernelPassed:
      typeof moonlabWebGpuProbabilityKernelProbe?.passed === 'boolean'
        ? moonlabWebGpuProbabilityKernelProbe.passed
        : null,
    moonlabWebGpuProbabilityKernelCoveredNativeOperations:
      clonePlain(moonlabWebGpuProbabilityKernelCoveredNativeOperations),
    moonlabWebGpuProbabilityKernelMaxProbabilityAbsDiff:
      finiteNumberOrNull(moonlabWebGpuProbabilityKernelProbe?.maxProbabilityAbsDiff),
    moonlabWebGpuProbabilityKernelTolerance:
      finiteNumberOrNull(moonlabWebGpuProbabilityKernelProbe?.tolerance),
    moonlabWebGpuProbabilityKernelReason:
      textOrNull(moonlabWebGpuProbabilityKernelProbe?.reason),
    moonlabWebGpuNativeOperationProbeSchema: moonlabWebGpuNativeOperationProbe?.schema || null,
    moonlabWebGpuNativeOperationProbeDeclared,
    moonlabWebGpuNativeOperationProbeKind: moonlabWebGpuNativeOperationProbe?.probeKind || null,
    moonlabWebGpuNativeOperationProbeExecuted:
      typeof moonlabWebGpuNativeOperationProbe?.executed === 'boolean'
        ? moonlabWebGpuNativeOperationProbe.executed
        : null,
    moonlabWebGpuNativeOperationProbePassed:
      typeof moonlabWebGpuNativeOperationProbe?.passed === 'boolean'
        ? moonlabWebGpuNativeOperationProbe.passed
        : null,
    moonlabWebGpuNativeOperationCoveredOperations:
      clonePlain(moonlabWebGpuNativeOperationCoveredOperations),
    moonlabWebGpuNativeOperationProbeOperationCount: moonlabWebGpuNativeOperationResults.length,
    moonlabWebGpuNativeOperationProbeCoveredOperationCount:
      moonlabWebGpuNativeOperationResults.filter((entry) => entry.covered === true).length,
    moonlabWebGpuNativeOperationProbeDeclaredOperations:
      clonePlain(moonlabWebGpuNativeOperationDeclaredOperations),
    moonlabWebGpuNativeOperationProbeBlockedOperations:
      clonePlain(moonlabWebGpuNativeOperationBlockedOperations),
    moonlabWebGpuNativeOperationProbeTargetOperations:
      clonePlain(MOONLAB_NATIVE_OPERATION_TARGET_DECLARATIONS),
    moonlabWebGpuNativeOperationProbeMissingTargetOperations:
      clonePlain(moonlabWebGpuNativeOperationMissingTargetOperations),
    moonlabWebGpuNativeOperationProbeOperationResults:
      clonePlain(moonlabWebGpuNativeOperationResults),
    moonlabWebGpuNativeOperationProbeMaxAmplitudeAbsDiff:
      finiteNumberOrNull(moonlabWebGpuNativeOperationProbe?.maxAmplitudeAbsDiff),
    moonlabWebGpuNativeOperationProbeTolerance:
      finiteNumberOrNull(moonlabWebGpuNativeOperationProbe?.tolerance),
    moonlabWebGpuNativeOperationProbeReason:
      textOrNull(moonlabWebGpuNativeOperationProbe?.reason),
    moonlabWebGpuHadamardNativeOperationDeclared:
      moonlabWebGpuHadamardNativeOperationResult != null,
    moonlabWebGpuHadamardNativeOperationExecuted:
      moonlabWebGpuHadamardNativeOperationResult?.executed ?? null,
    moonlabWebGpuHadamardNativeOperationPassed:
      moonlabWebGpuHadamardNativeOperationResult?.passed ?? null,
    moonlabWebGpuHadamardNativeOperationCovered:
      moonlabWebGpuHadamardNativeOperationResult?.covered ?? null,
    moonlabWebGpuHadamardNativeOperationBlocker:
      moonlabWebGpuHadamardNativeOperationResult?.blocker || null,
    moonlabWebGpuPauliXNativeOperationDeclared:
      moonlabWebGpuPauliXNativeOperationResult != null,
    moonlabWebGpuPauliXNativeOperationExecuted:
      moonlabWebGpuPauliXNativeOperationResult?.executed ?? null,
    moonlabWebGpuPauliXNativeOperationPassed:
      moonlabWebGpuPauliXNativeOperationResult?.passed ?? null,
    moonlabWebGpuPauliXNativeOperationCovered:
      moonlabWebGpuPauliXNativeOperationResult?.covered ?? null,
    moonlabWebGpuPauliXNativeOperationBlocker:
      moonlabWebGpuPauliXNativeOperationResult?.blocker || null,
    moonlabComplex64PreflightPassed:
      typeof moonlabComplex64Preflight?.passed === 'boolean' ? moonlabComplex64Preflight.passed : null,
    moonlabComplex64PreflightMaxProbabilityAbsDiff:
      finiteNumberOrNull(moonlabComplex64Preflight?.maxProbabilityAbsDiff),
    moonlabComplex64PreflightTolerance: finiteNumberOrNull(moonlabComplex64Preflight?.tolerance),
    moonlabWebGpuParityScopeFullFidelityMagnetarSimulation:
      typeof moonlabWebGpuParityScope?.fullFidelityMagnetarSimulation === 'boolean'
        ? moonlabWebGpuParityScope.fullFidelityMagnetarSimulation
        : null,
    moonlabWebGpuParityScopeFullPhysicsValidation:
      typeof moonlabWebGpuParityScope?.fullPhysicsValidation === 'boolean'
        ? moonlabWebGpuParityScope.fullPhysicsValidation
        : null,
    moonlabWebGpuParityScopeFidelityRuntimeScope: clonePlain(moonlabWebGpuParityFidelityRuntimeScope),
    moonlabWebGpuParityScopeBlockers,
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
