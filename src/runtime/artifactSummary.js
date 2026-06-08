export const ULG_ARTIFACT_SUMMARY_SCHEMA = 'peercompute.ulg.artifact-summary.v0';
export const ULG_SIMULATION_ARTIFACT_SCHEMA = 'peercompute.ulg.simulation-artifact.v0';
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
export const ESHKOL_PRODUCTION_HANDLER_CONTRACT_SCHEMA = 'eshkol.ulg.production-handler-contract.v0';
export const ESHKOL_PRODUCTION_HANDLER_IMPLEMENTATION_SCHEMA =
  'eshkol.ulg.production-handler-implementation.v0';
export const ESHKOL_PRODUCTION_HANDLER_RUNTIME_EXECUTION_SCHEMA =
  'eshkol.ulg.production-handler-runtime-execution.v0';
export const ESHKOL_FULL_PHYSICS_VALIDATION_REQUIREMENTS_SCHEMA =
  'eshkol.ulg.full-physics-validation-requirements.v0';
export const ESHKOL_PRODUCTION_HANDLER_DISPATCH_PREFLIGHT_SCHEMA = 'eshkol.ulg.production-handler-dispatch-preflight.v0';
export const ESHKOL_PRODUCTION_HANDLER_DISPATCH_PREFLIGHT_CHECK_SUMMARY_SCHEMA =
  'eshkol.ulg.production-handler-dispatch-preflight-check-summary.v0';
export const PEERCOMPUTE_DISPATCH_HANDLER_CONTEXT_SCHEMA = 'peercompute.ulg.dispatch-service-handler-context.v0';
export const ESHKOL_PRODUCTION_CANDIDATE_RUNTIME_PROBE_SCHEMA = 'eshkol.ulg.production-candidate-runtime-probe.v0';
export const MOONLAB_MAGNETAR_DIPOLE_ISING_REFERENCE_SCHEMA = 'moonlab.magnetar-dipole-ising-reference.v0';
export const MOONLAB_MAGNETAR_REFERENCE_ROLE = 'peercompute-reference-tolerance-input';
export const MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_SCHEMA = 'moonlab.magnetar.calibrated-reference.v0';
export const MOONLAB_MAGNETAR_CALIBRATED_REFERENCE_ROLE = 'peercompute-scientific-tolerance-input';
export const MOONLAB_WEBGPU_COMPLEX64_PARITY_SCOPE_SCHEMA = 'moonlab.webgpu.complex64-parity-scope.v0';
export const MOONLAB_WEBGPU_COMPLEX64_PARITY_HANDOFF_SUMMARY_SCHEMA =
  'moonlab.webgpu.complex64-parity-handoff-summary.v0';
export const MOONLAB_WEBGPU_COMPLEX64_BROWSER_BACKEND_PREFLIGHT_SCHEMA = 'moonlab.webgpu.complex64-browser-backend-preflight.v0';
export const MOONLAB_WEBGPU_COMPLEX64_PROBABILITY_KERNEL_PROBE_SCHEMA = 'moonlab.webgpu.complex64-probability-kernel-probe.v0';
export const MOONLAB_WEBGPU_COMPLEX64_NATIVE_OPERATION_PROBE_SCHEMA = 'moonlab.webgpu.complex64-native-operation-probe.v0';

const ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS = Object.freeze([
  'full-physics-validation-not-run'
]);
const ESHKOL_PRODUCTION_HOST_IMPORT_CANDIDATE_SCHEMA = 'eshkol.ulg.production-host-import-candidate.v0';
const ESHKOL_PRODUCTION_HOST_IMPORT_CANDIDATE_READINESS_REQUIRES = Object.freeze([
  'non-stub-host-runtime-imports',
  'validated-f64-tensor-memory-imports',
  'full-physics-validation-pass'
]);
const ESHKOL_PRODUCTION_HOST_IMPORT_CANDIDATE_TENSOR_MEMORY_IMPORTS = Object.freeze([
  'ulg_read_f64',
  'ulg_write_f64'
]);
const ESHKOL_PRODUCTION_HANDLER_CONTRACT_REQUIRED_EVIDENCE = Object.freeze([
  'content-addressed-wasm-module',
  'entry-export-main-signature-i32-i32-to-i32',
  'production-candidate-host-imports',
  'validated-f64-tensor-memory-binding',
  'production-candidate-runtime-probe',
  'production-magnetar-handler-implementation',
  'production-handler-runtime-execution',
  'full-physics-validation-pass'
]);
const ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_REQUIRED_CHECKS = Object.freeze([
  'artifact-module-sha256-matches-module-ref',
  'entry-export-main-signature-i32-i32-to-i32',
  'production-handler-contract-declared',
  'non-stub-host-imports-present',
  'f64-tensor-memory-binding-validated',
  'production-candidate-runtime-probe-passed',
  'runtime-smoke-stubs-rejected-for-production',
  'handler-ready-flag-true',
  'runtime-execution-flag-true',
  'full-physics-validation-evidence-present'
]);
const ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_PASSED_CHECKS = Object.freeze([
  'artifact-module-sha256-matches-module-ref',
  'entry-export-main-signature-i32-i32-to-i32',
  'production-handler-contract-declared',
  'non-stub-host-imports-present',
  'f64-tensor-memory-binding-validated',
  'production-candidate-runtime-probe-passed',
  'runtime-smoke-stubs-rejected-for-production',
  'handler-ready-flag-true',
  'runtime-execution-flag-true'
]);
const ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_BLOCKED_CHECKS = Object.freeze([
  'full-physics-validation-evidence-present'
]);
const ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES = Object.freeze([
  'magnetosphere-mhd',
  'pic-kinetic-plasma',
  'radiation-transport',
  'relativistic-correction',
  'cross-family-conservation-coupling'
]);
const ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_SCHEMAS = Object.freeze([
  'peercompute.multiscale.magnetosphere-mhd.runtime-validation.v0',
  'peercompute.multiscale.pic-kinetic-plasma.runtime-validation.v0',
  'peercompute.multiscale.radiation-transport.runtime-validation.v0',
  'peercompute.multiscale.relativistic-correction.runtime-validation.v0',
  'peercompute.multiscale.cross-family-conservation-coupling.runtime-validation.v0'
]);
const ESHKOL_FULL_PHYSICS_REQUIRED_HASH_FIELDS = Object.freeze([
  'referenceHash',
  'toleranceHash',
  'runtimeOutputHash',
  'evidenceHash'
]);
const ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_REJECTED_RUNTIME_SCOPES = Object.freeze([
  'deterministic-runtime-smoke-stubs'
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
const MOONLAB_WEBGPU_COMPLEX64_REQUIRED_COVERAGE = Object.freeze([
  ...MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS,
  'compute_probabilities'
]);
const MOONLAB_WEBGPU_BROWSER_BACKEND_PREFLIGHT_STAGES = Object.freeze([
  'navigator-gpu-unavailable',
  'adapter-unavailable',
  'request-adapter-failed',
  'request-device-failed',
  'device-acquired'
]);

function inferArtifactKind(artifact = {}) {
  if (artifact.schema === ULG_SIMULATION_ARTIFACT_SCHEMA || artifact.sourceService === 'ulg-runtime') {
    return 'simulation-delta';
  }
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

function arrayContentsMatch(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && right.every((value) => left.includes(value));
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

function finiteWithinTolerance(value, tolerance) {
  const finiteValue = finiteNumberOrNull(value);
  const finiteTolerance = finiteNumberOrNull(tolerance);
  return finiteValue != null && finiteTolerance != null && finiteValue <= finiteTolerance;
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
  const simulationInvariantReport = objectOrNull(outputs.invariants);
  const simulationInvariantMetrics = objectOrNull(simulationInvariantReport?.metrics);
  const simulationDeltas = Array.isArray(outputs.deltas) ? outputs.deltas : [];
  const simulationFinalState = objectOrNull(outputs.finalState);
  const simulationWebGpuStatus = objectOrNull(execution.webgpuStatus);
  const simulationWebGpuParity = objectOrNull(execution.webgpuParity);
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
  const closureProductionHandlerContract = objectOrNull(closureProductionHandlerBoundary?.productionHandlerContract);
  const closureProductionHandlerContractInvocation = objectOrNull(closureProductionHandlerContract?.invocation);
  const closureProductionHandlerImplementation =
    objectOrNull(closureProductionHandlerBoundary?.productionHandlerImplementation);
  const closureProductionHandlerImplementationInvocation =
    objectOrNull(closureProductionHandlerImplementation?.invocation);
  const closureProductionHandlerRuntimeExecution =
    objectOrNull(closureProductionHandlerBoundary?.productionHandlerRuntimeExecution);
  const closureProductionHandlerRuntimeExecutionHostImportCallCounts =
    objectOrNull(closureProductionHandlerRuntimeExecution?.hostImportCallCounts);
  const closureFullPhysicsValidationRequirements =
    objectOrNull(closureProductionHandlerBoundary?.fullPhysicsValidationRequirements);
  const closureProductionHandlerTensorMemoryBinding = objectOrNull(closureProductionHandlerBoundary?.tensorMemoryBinding);
  const closureProductionHandlerHostImports = objectOrNull(closureProductionHandlerBoundary?.hostImports);
  const closureProductionHostImportCandidate = objectOrNull(closureProductionHandlerHostImports?.productionCandidate);
  const closureProductionCandidateRuntimeProbe =
    objectOrNull(closureProductionHandlerBoundary?.productionCandidateRuntimeProbe);
  const closureProductionCandidateRuntimeProbeHostImportCallCounts =
    objectOrNull(closureProductionCandidateRuntimeProbe?.hostImportCallCounts);
  const closureProductionCandidateRuntimeProbeHostImportOptions =
    objectOrNull(closureProductionCandidateRuntimeProbe?.hostImportOptions);
  const closureProductionDispatchPreflight = objectOrNull(closureProductionHandlerBoundary?.dispatchPreflight);
  const closureProductionDispatchPreflightCheckSummary =
    objectOrNull(closureProductionDispatchPreflight?.checkSummary);
  const closureProductionHostImportCandidateRequiredNonStubImports =
    Array.isArray(closureProductionHostImportCandidate?.requiredNonStubImports)
      ? closureProductionHostImportCandidate.requiredNonStubImports.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHostImportCandidateReadinessRequires =
    Array.isArray(closureProductionHostImportCandidate?.readinessRequires)
      ? closureProductionHostImportCandidate.readinessRequires.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHostImportCandidateBlockedBy =
    Array.isArray(closureProductionHostImportCandidate?.blockedBy)
      ? closureProductionHostImportCandidate.blockedBy.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHostImportCandidateTensorMemoryImports =
    Array.isArray(closureProductionHostImportCandidate?.tensorMemoryImports)
      ? closureProductionHostImportCandidate.tensorMemoryImports.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionDispatchPreflightRequiredChecks =
    Array.isArray(closureProductionDispatchPreflight?.requiredChecks)
      ? closureProductionDispatchPreflight.requiredChecks.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHandlerImplementationEvidence =
    Array.isArray(closureProductionHandlerImplementation?.evidence)
      ? closureProductionHandlerImplementation.evidence.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHandlerImplementationBlockedBy =
    Array.isArray(closureProductionHandlerImplementation?.blockedBy)
      ? closureProductionHandlerImplementation.blockedBy.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHandlerRuntimeExecutionEntryArgs =
    Array.isArray(closureProductionHandlerRuntimeExecution?.entryArgs)
      ? closureProductionHandlerRuntimeExecution.entryArgs.map((value) => Number(value)).filter(Number.isFinite)
      : [];
  const closureProductionHandlerRuntimeExecutionParameterTypes =
    Array.isArray(closureProductionHandlerRuntimeExecution?.parameterTypes)
      ? closureProductionHandlerRuntimeExecution.parameterTypes.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHandlerRuntimeExecutionResultTypes =
    Array.isArray(closureProductionHandlerRuntimeExecution?.resultTypes)
      ? closureProductionHandlerRuntimeExecution.resultTypes.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionHandlerRuntimeExecutionBlockedBy =
    Array.isArray(closureProductionHandlerRuntimeExecution?.blockedBy)
      ? closureProductionHandlerRuntimeExecution.blockedBy.map((value) => String(value)).filter(Boolean)
      : [];
  const closureFullPhysicsValidationRequiredRuntimeEvidenceFamilies =
    Array.isArray(closureFullPhysicsValidationRequirements?.requiredRuntimeEvidenceFamilies)
      ? closureFullPhysicsValidationRequirements.requiredRuntimeEvidenceFamilies.map((value) => String(value)).filter(Boolean)
      : [];
  const closureFullPhysicsValidationRequiredHashFields =
    Array.isArray(closureFullPhysicsValidationRequirements?.requiredHashFields)
      ? closureFullPhysicsValidationRequirements.requiredHashFields.map((value) => String(value)).filter(Boolean)
      : [];
  const closureFullPhysicsValidationBlockedBy =
    Array.isArray(closureFullPhysicsValidationRequirements?.blockedBy)
      ? closureFullPhysicsValidationRequirements.blockedBy.map((value) => String(value)).filter(Boolean)
      : [];
  const closureFullPhysicsValidationRequiredRuntimeEvidence =
    Array.isArray(closureFullPhysicsValidationRequirements?.requiredRuntimeEvidence)
      ? closureFullPhysicsValidationRequirements.requiredRuntimeEvidence
        .filter(isPlainObject)
        .map((entry) => ({
          family: textOrNull(entry.family),
          schema: textOrNull(entry.schema),
          status: textOrNull(entry.status),
          required: typeof entry.required === 'boolean' ? entry.required : null
        }))
      : [];
  const closureProductionDispatchPreflightRejectedRuntimeScopes =
    Array.isArray(closureProductionDispatchPreflight?.rejectedRuntimeScopes)
      ? closureProductionDispatchPreflight.rejectedRuntimeScopes.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionDispatchPreflightBlockedBy =
    Array.isArray(closureProductionDispatchPreflight?.blockedBy)
      ? closureProductionDispatchPreflight.blockedBy.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionDispatchPreflightCheckResults =
    Array.isArray(closureProductionDispatchPreflight?.checkResults)
      ? closureProductionDispatchPreflight.checkResults
        .filter(isPlainObject)
        .map((entry) => ({
          check: textOrNull(entry.check),
          status: textOrNull(entry.status),
          ready: typeof entry.ready === 'boolean' ? entry.ready : null,
          evidenceSource: textOrNull(entry.evidenceSource),
          blocker: textOrNull(entry.blocker),
          observed: clonePlain(objectOrNull(entry.observed))
        }))
      : [];
  const closureProductionDispatchPreflightCheckResultChecks =
    closureProductionDispatchPreflightCheckResults.map((entry) => entry.check).filter(Boolean);
  const closureProductionDispatchPreflightCheckSummaryPassedChecks =
    Array.isArray(closureProductionDispatchPreflightCheckSummary?.passedChecks)
      ? closureProductionDispatchPreflightCheckSummary.passedChecks.map((value) => String(value)).filter(Boolean)
      : [];
  const closureProductionDispatchPreflightCheckSummaryBlockedChecks =
    Array.isArray(closureProductionDispatchPreflightCheckSummary?.blockedChecks)
      ? closureProductionDispatchPreflightCheckSummary.blockedChecks.map((value) => String(value)).filter(Boolean)
      : [];
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
  const runtimeAssetProbe = objectOrNull(artifact.runtime?.assetProbe);
  const runtimeAssets = Array.isArray(runtimeAssetProbe?.assets)
    ? runtimeAssetProbe.assets.filter(isPlainObject)
    : [];
  const hostImportsAsset = runtimeAssets.find((asset) => asset.kind === 'hostImportsModule') ?? null;
  const hostImportsFactory = objectOrNull(artifact.runtime?.hostImportsFactory)
    || objectOrNull(runtimeAssetProbe?.bundleHostImports)
    || null;
  const parityComparisons = Array.isArray(parity?.comparisons) ? parity.comparisons : [];
  const moonlabWebGpuParityScope = objectOrNull(artifact.webGpuParityScope)
    || objectOrNull(outputs.webGpuParityScope)
    || objectOrNull(artifact.runtime?.coreProbe?.webGpuParityScope?.artifact);
  const moonlabWebGpuParityHandoffSummary = objectOrNull(artifact.webGpuParityHandoffSummary)
    || objectOrNull(outputs.webGpuParityHandoffSummary)
    || objectOrNull(artifact.runtime?.coreProbe?.webGpuParityHandoffSummary?.artifact);
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
  const moonlabWebGpuCoverageNativeWebGpuEntries =
    Array.isArray(moonlabWebGpuParityScope?.coverage?.nativeWebGpu)
      ? moonlabWebGpuParityScope.coverage.nativeWebGpu.filter(isPlainObject)
      : [];
  const moonlabWebGpuCoverageNativeWebGpuByOperation = new Map(
    moonlabWebGpuCoverageNativeWebGpuEntries
      .filter((entry) => textOrNull(entry.operation))
      .map((entry) => [textOrNull(entry.operation), entry])
  );
  const moonlabWebGpuRequiredCoverageReady = MOONLAB_WEBGPU_COMPLEX64_REQUIRED_COVERAGE.every((operation) => {
    const entry = moonlabWebGpuCoverageNativeWebGpuByOperation.get(operation);
    return entry?.covered === true
      && entry.required === true
      && entry.fallbackAllowed === false
      && entry.status === 'covered-by-browser-webgpu';
  });
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
  const moonlabWebGpuBrowserBackendPreflight = objectOrNull(moonlabWebGpuParityScope?.browserBackendPreflight);
  const moonlabWebGpuBrowserBackendPreflightDeclared =
    moonlabWebGpuBrowserBackendPreflight?.schema === MOONLAB_WEBGPU_COMPLEX64_BROWSER_BACKEND_PREFLIGHT_SCHEMA
    && moonlabWebGpuBrowserBackendPreflight.probeKind === 'browser-webgpu-adapter-device-preflight'
    && MOONLAB_WEBGPU_BROWSER_BACKEND_PREFLIGHT_STAGES.includes(moonlabWebGpuBrowserBackendPreflight.stage)
    && typeof moonlabWebGpuBrowserBackendPreflight.navigatorGpuAvailable === 'boolean'
    && typeof moonlabWebGpuBrowserBackendPreflight.adapterAvailable === 'boolean'
    && typeof moonlabWebGpuBrowserBackendPreflight.deviceAcquired === 'boolean'
    && textOrNull(moonlabWebGpuBrowserBackendPreflight.reason) != null;
  const moonlabWebGpuBrowserBackendDeviceAcquired =
    moonlabWebGpuBrowserBackendPreflightDeclared
    && moonlabWebGpuBrowserBackendPreflight.stage === 'device-acquired'
    && moonlabWebGpuBrowserBackendPreflight.navigatorGpuAvailable === true
    && moonlabWebGpuBrowserBackendPreflight.adapterAvailable === true
    && moonlabWebGpuBrowserBackendPreflight.deviceAcquired === true;
  const moonlabWebGpuProbabilityKernelProbeDeclared =
    moonlabWebGpuProbabilityKernelProbe?.schema === MOONLAB_WEBGPU_COMPLEX64_PROBABILITY_KERNEL_PROBE_SCHEMA
    && moonlabWebGpuProbabilityKernelProbe.probeKind === 'browser-webgpu-complex64-probability-kernel'
    && moonlabWebGpuProbabilityKernelProbe.kernel === 'compute_probabilities'
    && typeof moonlabWebGpuProbabilityKernelProbe.executed === 'boolean'
    && typeof moonlabWebGpuProbabilityKernelProbe.passed === 'boolean';
  const moonlabWebGpuProbabilityKernelProbeReady =
    moonlabWebGpuProbabilityKernelProbeDeclared
    && moonlabWebGpuProbabilityKernelProbe.executed === true
    && moonlabWebGpuProbabilityKernelProbe.passed === true
    && moonlabWebGpuProbabilityKernelCoveredNativeOperations.includes('compute_probabilities')
    && finiteWithinTolerance(
      moonlabWebGpuProbabilityKernelProbe.maxProbabilityAbsDiff,
      moonlabWebGpuProbabilityKernelProbe.tolerance
    );
  const moonlabWebGpuNativeOperationResultReady = (entry) => entry?.executed === true
    && entry?.passed === true
    && entry?.covered === true
    && textOrNull(entry.blocker) == null
    && finiteWithinTolerance(entry.maxAmplitudeAbsDiff, entry.tolerance);
  const moonlabWebGpuNativeOperationProbeDeclared =
    moonlabWebGpuNativeOperationProbe?.schema === MOONLAB_WEBGPU_COMPLEX64_NATIVE_OPERATION_PROBE_SCHEMA
    && moonlabWebGpuNativeOperationProbe.probeKind === 'browser-webgpu-complex64-native-operation-probe'
    && typeof moonlabWebGpuNativeOperationProbe.executed === 'boolean'
    && typeof moonlabWebGpuNativeOperationProbe.passed === 'boolean'
    && moonlabWebGpuNativeOperationResults.length >= MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS.length
    && MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS
      .every((operation) => moonlabWebGpuNativeOperationResultByOperation.has(operation));
  const moonlabWebGpuNativeOperationProbeReady =
    moonlabWebGpuNativeOperationProbeDeclared
    && moonlabWebGpuNativeOperationProbe.executed === true
    && moonlabWebGpuNativeOperationProbe.passed === true
    && finiteWithinTolerance(
      moonlabWebGpuNativeOperationProbe.maxAmplitudeAbsDiff,
      moonlabWebGpuNativeOperationProbe.tolerance
    )
    && MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS
      .every((operation) => moonlabWebGpuNativeOperationCoveredOperations.includes(operation))
    && MOONLAB_NATIVE_OPERATION_REQUIRED_DECLARATIONS
      .every((operation) => moonlabWebGpuNativeOperationResultReady(
        moonlabWebGpuNativeOperationResultByOperation.get(operation)
      ));
  const moonlabWebGpuParityScopeReady = moonlabWebGpuParityScope?.schema === MOONLAB_WEBGPU_COMPLEX64_PARITY_SCOPE_SCHEMA
    && moonlabWebGpuParityScope.contractReady === true
    && moonlabWebGpuParityScope.contractValidation?.valid === true
    && moonlabWebGpuParityScope.reducedFixtureOnly === true
    && moonlabWebGpuParityScope.status === 'scope-ready-backend-detected'
    && moonlabWebGpuParityScope.backendAvailable === true
    && moonlabWebGpuParityScope.requireBackend === true
    && moonlabWebGpuParity?.executed === true
    && moonlabWebGpuParity?.passed === true
    && finiteWithinTolerance(moonlabWebGpuParity?.maxProbabilityAbsDiff, moonlabWebGpuParity?.tolerance)
    && moonlabComplex64Preflight?.passed === true
    && moonlabWebGpuParityScope.fullFidelityMagnetarSimulation === false
    && moonlabWebGpuParityScope.fullPhysicsValidation === false
    && moonlabWebGpuBrowserBackendDeviceAcquired
    && moonlabWebGpuParityFidelityRuntimeScope?.schema === 'ulg.magnetar.fidelity-runtime-scope.v0'
    && moonlabWebGpuParityFidelityRuntimeScope.fullFidelityMagnetarSimulation === false
    && moonlabWebGpuParityFidelityRuntimeScope.fullPhysicsValidation === false
    && moonlabWebGpuProbabilityKernelProbeReady
    && moonlabWebGpuNativeOperationProbeReady
    && moonlabWebGpuRequiredCoverageReady
    && moonlabWebGpuParityScopeBlockers.length === 0;
  const moonlabWebGpuParityHandoffSummaryBlockers =
    Array.isArray(moonlabWebGpuParityHandoffSummary?.blockers)
      ? moonlabWebGpuParityHandoffSummary.blockers.map((blocker) => String(blocker)).filter(Boolean)
      : [];
  const moonlabWebGpuParityHandoffSummaryValidationErrors =
    Array.isArray(moonlabWebGpuParityHandoffSummary?.validationErrors)
      ? moonlabWebGpuParityHandoffSummary.validationErrors.map((error) => String(error)).filter(Boolean)
      : [];
  const moonlabWebGpuParityHandoffSummaryNativeCoverage =
    objectOrNull(moonlabWebGpuParityHandoffSummary?.nativeCoverage);
  const moonlabWebGpuParityHandoffSummaryRequiredOperations =
    Array.isArray(moonlabWebGpuParityHandoffSummaryNativeCoverage?.required)
      ? moonlabWebGpuParityHandoffSummaryNativeCoverage.required.map((operation) => String(operation)).filter(Boolean)
      : [];
  const moonlabWebGpuParityHandoffSummaryCoveredOperations =
    Array.isArray(moonlabWebGpuParityHandoffSummaryNativeCoverage?.covered)
      ? moonlabWebGpuParityHandoffSummaryNativeCoverage.covered.map((operation) => String(operation)).filter(Boolean)
      : [];
  const moonlabWebGpuParityHandoffSummaryMissingOperations =
    Array.isArray(moonlabWebGpuParityHandoffSummaryNativeCoverage?.missing)
      ? moonlabWebGpuParityHandoffSummaryNativeCoverage.missing.map((operation) => String(operation)).filter(Boolean)
      : [];
  const moonlabWebGpuParityHandoffSummaryExcludedOperations =
    Array.isArray(moonlabWebGpuParityHandoffSummaryNativeCoverage?.excluded)
      ? moonlabWebGpuParityHandoffSummaryNativeCoverage.excluded.map((operation) => String(operation)).filter(Boolean)
      : [];
  const moonlabWebGpuParityHandoffSummaryBackendPreflight =
    objectOrNull(moonlabWebGpuParityHandoffSummary?.backendPreflight);
  const moonlabWebGpuParityHandoffSummaryWebGpuParity =
    objectOrNull(moonlabWebGpuParityHandoffSummary?.webgpuParity);
  const moonlabWebGpuParityHandoffSummaryReady =
    moonlabWebGpuParityHandoffSummary?.schema === MOONLAB_WEBGPU_COMPLEX64_PARITY_HANDOFF_SUMMARY_SCHEMA
    && moonlabWebGpuParityHandoffSummary.sourceSchema === MOONLAB_WEBGPU_COMPLEX64_PARITY_SCOPE_SCHEMA
    && moonlabWebGpuParityHandoffSummary.artifactKind === 'browser-webgpu-complex64-parity-handoff-summary'
    && moonlabWebGpuParityHandoffSummary.status === 'scope-ready-backend-detected'
    && moonlabWebGpuParityHandoffSummary.contractValidationValid === true
    && moonlabWebGpuParityHandoffSummary.reducedFixtureOnly === true
    && moonlabWebGpuParityHandoffSummary.reducedFixtureWebGpuParityReady === true
    && moonlabWebGpuParityHandoffSummary.backendAvailable === true
    && moonlabWebGpuParityHandoffSummary.requireBackend === true
    && moonlabWebGpuParityHandoffSummary.runtimeBackendReady === false
    && moonlabWebGpuParityHandoffSummary.fullFidelityMagnetarSimulation === false
    && moonlabWebGpuParityHandoffSummary.fullPhysicsValidation === false
    && moonlabWebGpuParityHandoffSummary.readinessClaim === 'integration-tolerance-gate-only'
    && moonlabWebGpuParityHandoffSummaryBackendPreflight?.stage === 'device-acquired'
    && moonlabWebGpuParityHandoffSummaryBackendPreflight.navigatorGpuAvailable === true
    && moonlabWebGpuParityHandoffSummaryBackendPreflight.adapterAvailable === true
    && moonlabWebGpuParityHandoffSummaryBackendPreflight.deviceAcquired === true
    && arrayContentsMatch(moonlabWebGpuParityHandoffSummaryRequiredOperations, MOONLAB_WEBGPU_COMPLEX64_REQUIRED_COVERAGE)
    && arrayContentsMatch(moonlabWebGpuParityHandoffSummaryCoveredOperations, MOONLAB_WEBGPU_COMPLEX64_REQUIRED_COVERAGE)
    && moonlabWebGpuParityHandoffSummaryMissingOperations.length === 0
    && moonlabWebGpuParityHandoffSummaryExcludedOperations.includes('phase')
    && moonlabWebGpuParityHandoffSummaryWebGpuParity?.executed === true
    && moonlabWebGpuParityHandoffSummaryWebGpuParity?.passed === true
    && finiteWithinTolerance(
      moonlabWebGpuParityHandoffSummaryWebGpuParity?.maxProbabilityAbsDiff,
      moonlabWebGpuParityHandoffSummaryWebGpuParity?.tolerance
    )
    && moonlabWebGpuParityHandoffSummaryBlockers.length === 0
    && moonlabWebGpuParityHandoffSummaryValidationErrors.length === 0;
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
  const closureProductionHandlerContractInputTensorIds =
    Array.isArray(closureProductionHandlerContract?.inputTensorIds)
      ? closureProductionHandlerContract.inputTensorIds
      : [];
  const closureProductionHandlerContractOutputTensorIds =
    Array.isArray(closureProductionHandlerContract?.outputTensorIds)
      ? closureProductionHandlerContract.outputTensorIds
      : [];
  const closureProductionHandlerContractInvocationParameterTypes =
    Array.isArray(closureProductionHandlerContractInvocation?.parameterTypes)
      ? closureProductionHandlerContractInvocation.parameterTypes
      : [];
  const closureProductionHandlerContractInvocationResultTypes =
    Array.isArray(closureProductionHandlerContractInvocation?.resultTypes)
      ? closureProductionHandlerContractInvocation.resultTypes
      : [];
  const closureProductionHandlerContractRequiredEvidence =
    Array.isArray(closureProductionHandlerContract?.requiredEvidence)
      ? closureProductionHandlerContract.requiredEvidence.map((entry) => String(entry)).filter(Boolean)
      : [];
  const closureProductionHandlerContractBlockedBy =
    Array.isArray(closureProductionHandlerContract?.blockedBy)
      ? closureProductionHandlerContract.blockedBy.map((blocker) => String(blocker)).filter(Boolean)
      : [];
  const closureProductionHandlerAllowedExecutionClaims =
    Array.isArray(closureProductionHandlerBoundary?.allowedExecutionClaims)
      ? closureProductionHandlerBoundary.allowedExecutionClaims.map((claim) => String(claim)).filter(Boolean)
      : [];
  const closureProductionCandidateRuntimeProbeEntryArgs =
    Array.isArray(closureProductionCandidateRuntimeProbe?.entryArgs)
      ? closureProductionCandidateRuntimeProbe.entryArgs
        .map((value) => finiteNumberOrNull(value))
        .filter((value) => value != null)
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
    && closureTensorRuntimeContract.runtimeStatus === 'deterministic-runtime-smoke-executed'
    && closureTensorRuntimeContract.executionClaim === 'deterministic-tensor-runtime-smoke-only'
    && closureTensorRuntimeContract.scientificValidation === false
    && closureTensorRuntimeContract.fullPhysicsValidation === false;
  const closureTensorLinearMemoryBindingReady =
    closureTensorLinearMemoryBinding?.schema === ESHKOL_TENSOR_LINEAR_MEMORY_BINDING_SCHEMA
    && closureTensorLinearMemoryBinding.bindingId === 'eshkol:magnetar-closure-linear-memory-binding:v0'
    && closureTensorLinearMemoryBinding.status === 'entry-export-runtime-smoke-passed'
    && closureTensorLinearMemoryBinding.runtimeStatus === 'deterministic-host-runtime-smoke-executed'
    && closureTensorLinearMemoryBinding.executionClaim === 'deterministic-tensor-runtime-smoke-only'
    && closureTensorLinearMemoryBinding.elementType === 'f64'
    && finiteNumberOrNull(closureTensorLinearMemoryBinding.elementByteLength) === 8
    && finiteNumberOrNull(closureTensorLinearMemoryBinding.alignmentBytes) === 8
    && closureTensorLinearMemoryBinding.entryExportConsumesOffsets === true
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
      && tensor.consumedByEntryExport === true
    ))
    && closureTensorLinearMemorySmokeBinding?.schema === ESHKOL_TENSOR_LINEAR_MEMORY_SMOKE_BINDING_SCHEMA
    && closureTensorLinearMemorySmokeBinding.status === 'entry-export-runtime-smoke-passed'
    && closureTensorLinearMemorySmokeBinding.entryExportConsumesOffsets === true
    && closureTensorLinearMemorySmokeBinding.scientificValidation === false
    && closureTensorLinearMemorySmokeBinding.outputInitialization === 'entry-export-produced'
    && arraysEqual(closureTensorLinearMemorySmokeBinding.writeTensorIds, closureTensorRuntimeInputIds)
    && arraysEqual(closureTensorLinearMemorySmokeBinding.readbackTensorIds, closureTensorRuntimeInputIds)
    && arraysEqual(closureTensorLinearMemorySmokeBinding.outputTensorIds, closureTensorRuntimeOutputIds)
    && closureTensorEntryExportOffsetProbe?.schema === ESHKOL_TENSOR_ENTRY_EXPORT_OFFSET_PROBE_SCHEMA
    && closureTensorEntryExportOffsetProbe.status === 'runtime-smoke-passed'
    && closureTensorEntryExportOffsetProbe.entryExport === closureDescriptor?.entryExport
    && closureTensorEntryExportOffsetProbe.entryExportConsumesOffsets === true
    && closureTensorEntryExportOffsetProbe.outputTensorsProducedByEntryExport === true
    && finiteNumberOrNull(closureTensorEntryExportOffsetProbe.changedBytesInDeclaredTensorRange) === 64
    && closureTensorEntryExportOffsetProbe.observedStdoutInvariantAcrossArgs === false
    && closureTensorEntryExportOffsetProbe.scientificValidation === false
    && closureTensorEntryExportOffsetProbe.fullPhysicsValidation === false
    && closureTensorEntryExportOffsetProbe.hostImportOptions?.factory === 'createEshkolHostImportObject'
    && closureTensorEntryExportOffsetProbe.hostImportOptions?.runtimeSmokeStubs === true
    && closureTensorEntryExportOffsetProbe.hostImportOptions?.f64TensorMemoryImports === true
    && closureTensorEntryExportOffsetProbe.hostImportOptions?.stubScope === 'deterministic-f64-linear-memory-smoke'
    && closureTensorEntryExportOffsetProbe.blocker
      === 'none-for-deterministic-runtime-smoke-production-physics-unvalidated';
  const closureProductionCandidateRuntimeProbeReady =
    closureProductionCandidateRuntimeProbe?.schema === ESHKOL_PRODUCTION_CANDIDATE_RUNTIME_PROBE_SCHEMA
    && closureProductionCandidateRuntimeProbe.status === 'production-candidate-runtime-smoke-passed'
    && closureProductionCandidateRuntimeProbe.executionClaim === 'production-candidate-host-import-runtime-smoke-only'
    && closureProductionCandidateRuntimeProbe.runtimeScope === 'production-candidate-host-imports'
    && closureProductionCandidateRuntimeProbe.implementationStatus === 'production-candidate-runtime-imports-present'
    && closureProductionCandidateRuntimeProbe.entryExport === closureDescriptor?.entryExport
    && arraysEqual(closureProductionCandidateRuntimeProbeEntryArgs, [131072, 131136])
    && finiteNumberOrNull(closureProductionCandidateRuntimeProbe.expectedEntryResult) === 0
    && finiteNumberOrNull(closureProductionCandidateRuntimeProbe.changedBytesInDeclaredTensorRange) === 64
    && closureProductionCandidateRuntimeProbe.outputTensorsProducedByEntryExport === true
    && closureProductionCandidateRuntimeProbe.productionHandlerReady === true
    && closureProductionCandidateRuntimeProbe.productionHandlerRuntimeExecution === true
    && closureProductionCandidateRuntimeProbe.scientificValidation === false
    && closureProductionCandidateRuntimeProbe.fullPhysicsValidation === false
    && closureProductionCandidateRuntimeProbe.fullFidelityMagnetarSimulation === false
    && closureProductionCandidateRuntimeProbeHostImportOptions?.factory === 'createEshkolHostImportObject'
    && closureProductionCandidateRuntimeProbeHostImportOptions?.productionCandidateRuntimeImports === true
    && closureProductionCandidateRuntimeProbeHostImportOptions?.runtimeSmokeStubs === false
    && closureProductionCandidateRuntimeProbeHostImportOptions?.f64TensorMemoryImports === true
    && finiteNumberOrNull(closureProductionCandidateRuntimeProbeHostImportCallCounts?.ulg_read_f64) === 12
    && finiteNumberOrNull(closureProductionCandidateRuntimeProbeHostImportCallCounts?.ulg_write_f64) === 9
    && closureProductionCandidateRuntimeProbe.blocker
      === 'full-physics-validation-not-run';
  const closureProductionHandlerContractDeclared =
    closureProductionHandlerContract?.schema === ESHKOL_PRODUCTION_HANDLER_CONTRACT_SCHEMA
    && closureProductionHandlerContract.status === 'implemented-runtime-smoke-pending-full-physics'
    && closureProductionHandlerContract.handlerId === closureProductionHandlerBoundary?.handlerId
    && closureProductionHandlerContract.dispatchSchema === closureProductionHandlerBoundary?.dispatchSchema
    && closureProductionHandlerContract.entryExport === closureProductionHandlerBoundary?.entryExport
    && closureProductionHandlerContract.runtimeAbi === closureProductionHandlerBoundary?.runtimeAbi
    && closureProductionHandlerContract.tensorMemoryModel === closureProductionHandlerBoundary?.tensorMemoryModel
    && arraysEqual(closureProductionHandlerContractInputTensorIds, closureProductionHandlerInputTensorIds)
    && arraysEqual(closureProductionHandlerContractOutputTensorIds, closureProductionHandlerOutputTensorIds)
    && closureProductionHandlerContractInvocation?.moduleSource === 'artifact.execution.module'
    && closureProductionHandlerContractInvocation?.entryExport === closureProductionHandlerBoundary?.entryExport
    && closureProductionHandlerContractInvocation?.argumentMode === 'linear-memory-offsets'
    && arraysEqual(closureProductionHandlerContractInvocationParameterTypes, ['i32', 'i32'])
    && arraysEqual(closureProductionHandlerContractInvocationResultTypes, ['i32'])
    && finiteNumberOrNull(closureProductionHandlerContractInvocation?.inputOffsetParam) === 0
    && finiteNumberOrNull(closureProductionHandlerContractInvocation?.outputOffsetParam) === 1
    && finiteNumberOrNull(closureProductionHandlerContractInvocation?.expectedReturn) === 0
    && arraysEqual(
      closureProductionHandlerContractRequiredEvidence,
      ESHKOL_PRODUCTION_HANDLER_CONTRACT_REQUIRED_EVIDENCE
    )
    && arraysEqual(
      closureProductionHandlerContractBlockedBy,
      ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS
    );
  const closureProductionHandlerImplementationReady =
    closureProductionHandlerImplementation?.schema === ESHKOL_PRODUCTION_HANDLER_IMPLEMENTATION_SCHEMA
    && closureProductionHandlerImplementation.status === 'implemented-production-candidate-runtime-smoke'
    && closureProductionHandlerImplementation.handlerId === closureProductionHandlerBoundary?.handlerId
    && closureProductionHandlerImplementation.handlerKind === closureProductionHandlerBoundary?.handlerKind
    && closureProductionHandlerImplementation.implementationScope === 'deterministic-magnetar-tensor-abi-smoke'
    && closureProductionHandlerImplementation.moduleSource === 'artifact.execution.module'
    && closureProductionHandlerImplementation.entryExport === closureProductionHandlerBoundary?.entryExport
    && closureProductionHandlerImplementation.runtimeAbi === closureProductionHandlerBoundary?.runtimeAbi
    && closureProductionHandlerImplementation.dispatchSchema === closureProductionHandlerBoundary?.dispatchSchema
    && closureProductionHandlerImplementation.tensorMemoryModel === closureProductionHandlerBoundary?.tensorMemoryModel
    && arraysEqual(closureProductionHandlerImplementation.inputTensorIds, closureProductionHandlerInputTensorIds)
    && arraysEqual(closureProductionHandlerImplementation.outputTensorIds, closureProductionHandlerOutputTensorIds)
    && closureProductionHandlerImplementationInvocation?.moduleSource === 'artifact.execution.module'
    && closureProductionHandlerImplementationInvocation?.entryExport === closureProductionHandlerBoundary?.entryExport
    && closureProductionHandlerImplementationInvocation?.argumentMode === 'linear-memory-offsets'
    && arraysEqual(closureProductionHandlerImplementationInvocation?.parameterTypes, ['i32', 'i32'])
    && arraysEqual(closureProductionHandlerImplementationInvocation?.resultTypes, ['i32'])
    && finiteNumberOrNull(closureProductionHandlerImplementationInvocation?.inputOffsetParam) === 0
    && finiteNumberOrNull(closureProductionHandlerImplementationInvocation?.outputOffsetParam) === 1
    && finiteNumberOrNull(closureProductionHandlerImplementationInvocation?.expectedReturn) === 0
    && closureProductionHandlerImplementation.executionClaim === 'production-candidate-host-import-runtime-smoke-only'
    && arraysEqual(closureProductionHandlerImplementationEvidence, [
      'content-addressed-wasm-module',
      'entry-export-main-signature-i32-i32-to-i32',
      'production-candidate-host-imports',
      'validated-f64-tensor-memory-binding',
      'production-candidate-runtime-probe'
    ])
    && closureProductionHandlerImplementation.scientificValidation === false
    && closureProductionHandlerImplementation.fullPhysicsValidation === false
    && closureProductionHandlerImplementation.fullFidelityMagnetarSimulation === false
    && arraysEqual(
      closureProductionHandlerImplementationBlockedBy,
      ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS
    );
  const closureProductionHandlerRuntimeExecutionReady =
    closureProductionHandlerRuntimeExecution?.schema === ESHKOL_PRODUCTION_HANDLER_RUNTIME_EXECUTION_SCHEMA
    && closureProductionHandlerRuntimeExecution.status === 'production-handler-runtime-smoke-executed'
    && closureProductionHandlerRuntimeExecution.handlerId === closureProductionHandlerBoundary?.handlerId
    && closureProductionHandlerRuntimeExecution.moduleSource === 'artifact.execution.module'
    && closureProductionHandlerRuntimeExecution.entryExport === closureProductionHandlerBoundary?.entryExport
    && closureProductionHandlerRuntimeExecution.runtimeAbi === closureProductionHandlerBoundary?.runtimeAbi
    && closureProductionHandlerRuntimeExecution.runtimeScope === 'production-candidate-host-imports'
    && closureProductionHandlerRuntimeExecution.executionClaim === 'production-candidate-host-import-runtime-smoke-only'
    && closureProductionHandlerRuntimeExecution.argumentMode === 'linear-memory-offsets'
    && arraysEqual(closureProductionHandlerRuntimeExecutionParameterTypes, ['i32', 'i32'])
    && arraysEqual(closureProductionHandlerRuntimeExecutionResultTypes, ['i32'])
    && arraysEqual(closureProductionHandlerRuntimeExecutionEntryArgs, closureProductionCandidateRuntimeProbeEntryArgs)
    && finiteNumberOrNull(closureProductionHandlerRuntimeExecution.entryResult)
      === finiteNumberOrNull(closureProductionCandidateRuntimeProbe?.expectedEntryResult)
    && closureProductionHandlerRuntimeExecution.sampleSource === closureProductionCandidateRuntimeProbe?.sampleSource
    && closureProductionHandlerRuntimeExecution.linearMemoryBindingSource
      === closureProductionCandidateRuntimeProbe?.linearMemoryBindingSource
    && finiteNumberOrNull(closureProductionHandlerRuntimeExecution.changedBytesInDeclaredTensorRange) === 64
    && closureProductionHandlerRuntimeExecution.outputTensorsProducedByEntryExport === true
    && finiteNumberOrNull(closureProductionHandlerRuntimeExecutionHostImportCallCounts?.ulg_read_f64) === 12
    && finiteNumberOrNull(closureProductionHandlerRuntimeExecutionHostImportCallCounts?.ulg_write_f64) === 9
    && closureProductionHandlerRuntimeExecution.scientificValidation === false
    && closureProductionHandlerRuntimeExecution.fullPhysicsValidation === false
    && closureProductionHandlerRuntimeExecution.fullFidelityMagnetarSimulation === false
    && arraysEqual(
      closureProductionHandlerRuntimeExecutionBlockedBy,
      ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS
    );
  const closureFullPhysicsValidationRequirementsDeclared =
    closureFullPhysicsValidationRequirements?.schema === ESHKOL_FULL_PHYSICS_VALIDATION_REQUIREMENTS_SCHEMA
    && closureFullPhysicsValidationRequirements.status === 'declared-not-run'
    && closureFullPhysicsValidationRequirements.ready === false
    && closureFullPhysicsValidationRequirements.validationScope === 'magnetar-production-handler-full-physics'
    && closureFullPhysicsValidationRequirements.producerSchema
      === 'peercompute.multiscale.scenario-runtime-evidence-manifest.v0'
    && closureFullPhysicsValidationRequirements.requiredValidationSchema
      === 'peercompute.multiscale.scenario-scientific-runtime-validation.v0'
    && closureFullPhysicsValidationRequirements.requiredValidationScope
      === 'magnetar-scientific-runtime-reference-validation'
    && arraysEqual(
      closureFullPhysicsValidationRequiredRuntimeEvidenceFamilies,
      ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES
    )
    && arraysEqual(closureFullPhysicsValidationRequiredHashFields, ESHKOL_FULL_PHYSICS_REQUIRED_HASH_FIELDS)
    && closureFullPhysicsValidationRequiredRuntimeEvidence.length
      === ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES.length
    && closureFullPhysicsValidationRequiredRuntimeEvidence.every((entry, index) => (
      entry.family === ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_FAMILIES[index]
      && entry.schema === ESHKOL_FULL_PHYSICS_RUNTIME_EVIDENCE_SCHEMAS[index]
      && entry.status === 'required-not-provided'
      && entry.required === true
    ))
    && arraysEqual(
      closureFullPhysicsValidationBlockedBy,
      ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS
    );
  const closureProductionHandlerBoundaryDeclared =
    closureProductionHandlerBoundary?.schema === ESHKOL_PRODUCTION_HANDLER_BOUNDARY_SCHEMA
    && textOrNull(closureProductionHandlerBoundary.handlerId) != null
    && textOrNull(closureProductionHandlerBoundary.handlerKind) != null
    && closureProductionHandlerBoundary.dispatchSchema === PEERCOMPUTE_DISPATCH_HANDLER_CONTEXT_SCHEMA
    && closureProductionHandlerBoundary.status === 'production-handler-runtime-smoke-executed'
    && closureProductionHandlerBoundary.handlerReady === true
    && closureProductionHandlerBoundary.runtimeExecution === true
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
    && closureProductionHandlerContractDeclared
    && closureProductionHandlerImplementationReady
    && closureProductionHandlerRuntimeExecutionReady
    && closureFullPhysicsValidationRequirementsDeclared
    && closureProductionHandlerHostImports?.source === 'bundle.hostImports'
    && closureProductionHandlerHostImports?.required === validity.requiresHostImports
    && closureProductionHandlerHostImports?.factory === 'createEshkolHostImportObject'
    && closureProductionHandlerHostImports?.runtimeScope === 'production-candidate-host-imports'
    && closureProductionHandlerHostImports?.implementationStatus
      === 'production-candidate-runtime-imports-present'
    && closureProductionHostImportCandidate?.schema === ESHKOL_PRODUCTION_HOST_IMPORT_CANDIDATE_SCHEMA
    && closureProductionHostImportCandidate.status === 'production-candidate-runtime-imports-implemented'
    && closureProductionHostImportCandidate.factory === closureProductionHandlerHostImports?.factory
    && closureProductionHostImportCandidate.smokeRuntimeAbi
      === 'wasm32-unknown-unknown:eshkol-host-imports-smoke-v0'
    && closureProductionHostImportCandidate.productionRuntimeAbi === 'wasm32-unknown-unknown:eshkol-host-imports-production-candidate-v0'
    && closureProductionHostImportCandidate.runtimeScope === 'production-candidate-host-imports'
    && closureProductionHostImportCandidate.implementationStatus
      === 'production-candidate-runtime-imports-present'
    && closureProductionHostImportCandidate.runtimeSmokeStubsAllowed === false
    && arraysEqual(
      closureProductionHostImportCandidateTensorMemoryImports,
      ESHKOL_PRODUCTION_HOST_IMPORT_CANDIDATE_TENSOR_MEMORY_IMPORTS
    )
    && closureProductionHostImportCandidateRequiredNonStubImports.length > 0
    && arraysEqual(
      closureProductionHostImportCandidateReadinessRequires,
      ESHKOL_PRODUCTION_HOST_IMPORT_CANDIDATE_READINESS_REQUIRES
    )
    && arraysEqual(
      closureProductionHostImportCandidateBlockedBy,
      ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS
    )
    && hostImports?.factory === closureProductionHandlerHostImports?.factory
    && closureProductionHandlerAllowedExecutionClaims.includes(closureTensorRuntimeContract?.executionClaim)
    && closureProductionHandlerAllowedExecutionClaims.includes('production-candidate-host-import-runtime-smoke-only')
    && closureProductionHandlerTensorMemoryBinding?.source
      === 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding'
    && closureProductionHandlerTensorMemoryBinding?.status === closureTensorLinearMemoryBinding?.status
    && closureProductionHandlerTensorMemoryBinding?.executionClaim === closureTensorLinearMemoryBinding?.executionClaim
    && closureProductionHandlerTensorMemoryBinding?.entryExportConsumesOffsets === true
    && closureProductionCandidateRuntimeProbeReady
    && closureProductionDispatchPreflight?.schema === ESHKOL_PRODUCTION_HANDLER_DISPATCH_PREFLIGHT_SCHEMA
    && closureProductionDispatchPreflight.status === 'blocked'
    && closureProductionDispatchPreflight.ready === false
    && closureProductionDispatchPreflight.dispatchSchema === PEERCOMPUTE_DISPATCH_HANDLER_CONTEXT_SCHEMA
    && closureProductionDispatchPreflight.entryExport === closureDescriptor?.entryExport
    && closureProductionDispatchPreflight.currentRuntimeAbi === closureTensorRuntimeContract?.runtimeAbi
    && closureProductionDispatchPreflight.requiredRuntimeAbi
      === closureProductionHostImportCandidate?.productionRuntimeAbi
    && closureProductionDispatchPreflight.moduleContentAddressing === 'required'
    && closureProductionDispatchPreflight.moduleSha256Field === 'artifact.execution.module.sha256'
    && closureProductionDispatchPreflight.tensorMemoryBindingSource
      === 'validation.closureDescriptor.descriptorBinding.closureTensorRuntimeContract.linearMemoryBinding'
    && closureProductionDispatchPreflight.hostImportsCandidateSource
      === 'productionHandlerBoundary.hostImports.productionCandidate'
    && arraysEqual(
      closureProductionDispatchPreflightRequiredChecks,
      ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_REQUIRED_CHECKS
    )
    && arraysEqual(
      closureProductionDispatchPreflightRejectedRuntimeScopes,
      ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_REJECTED_RUNTIME_SCOPES
    )
    && closureProductionDispatchPreflight.runtimeSmokeStubsAllowed === false
    && closureProductionDispatchPreflight.handlerReadyRequired === true
    && closureProductionDispatchPreflight.runtimeExecutionRequired === true
    && closureProductionDispatchPreflight.fullPhysicsValidationRequired === true
    && closureProductionDispatchPreflight.scientificValidationRequired === true
    && arraysEqual(
      closureProductionDispatchPreflightBlockedBy,
      ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS
    )
    && closureProductionDispatchPreflightCheckSummary?.schema
      === ESHKOL_PRODUCTION_HANDLER_DISPATCH_PREFLIGHT_CHECK_SUMMARY_SCHEMA
    && closureProductionDispatchPreflightCheckSummary.status === 'blocked'
    && closureProductionDispatchPreflightCheckSummary.ready === false
    && closureProductionDispatchPreflightCheckSummary.totalRequiredCheckCount
      === ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_REQUIRED_CHECKS.length
    && closureProductionDispatchPreflightCheckSummary.passedCount
      === ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_PASSED_CHECKS.length
    && closureProductionDispatchPreflightCheckSummary.blockedCount
      === ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_BLOCKED_CHECKS.length
    && arraysEqual(
      closureProductionDispatchPreflightCheckSummaryPassedChecks,
      ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_PASSED_CHECKS
    )
    && arraysEqual(
      closureProductionDispatchPreflightCheckSummaryBlockedChecks,
      ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_BLOCKED_CHECKS
    )
    && arraysEqual(
      closureProductionDispatchPreflightCheckResultChecks,
      ESHKOL_PRODUCTION_DISPATCH_PREFLIGHT_REQUIRED_CHECKS
    )
    && arraysEqual(
      closureProductionHandlerBoundaryBlockers,
      ESHKOL_PRODUCTION_HANDLER_BOUNDARY_REQUIRED_BLOCKERS
    );
  const closureHandoffReady = (artifact.validation?.status || null) === 'pass'
    || closureDescriptorReady;

  return {
    schema: ULG_ARTIFACT_SUMMARY_SCHEMA,
    artifactKind: inferArtifactKind(artifact),
    artifactId: artifact.artifactId || artifact.closureId || null,
    sourceService: artifact.sourceService || null,
    validationStatus: artifact.validation?.status || null,
    simulationSchema: artifact.schema === ULG_SIMULATION_ARTIFACT_SCHEMA ? artifact.schema : null,
    simulationRepresentation: artifact.representation || null,
    simulationTaskKind: artifact.taskKind || null,
    simulationClosureRef: artifact.closureRef?.uri || artifact.closureRef?.artifactHash || null,
    simulationBackend: execution.backend || null,
    simulationWebGpuStatus: simulationWebGpuStatus?.status || null,
    simulationWebGpuFallback: simulationWebGpuStatus?.fallback || null,
    simulationWebGpuReason: simulationWebGpuStatus?.reason || null,
    simulationWebGpuParitySchema: simulationWebGpuParity?.schema || null,
    simulationWebGpuParityStatus: simulationWebGpuParity?.status || null,
    simulationWebGpuParityMaxPositionAbs: finiteNumberOrNull(simulationWebGpuParity?.maxPositionAbs),
    simulationWebGpuParityMaxVelocityAbs: finiteNumberOrNull(simulationWebGpuParity?.maxVelocityAbs),
    simulationIntegrator: execution.integrator || null,
    simulationStepCount: finiteNumberOrNull(execution.steps),
    simulationDt: finiteNumberOrNull(execution.dt),
    simulationDeltaCount: simulationDeltas.length,
    simulationFinalStep: finiteNumberOrNull(simulationFinalState?.step),
    simulationInvariantStatus: simulationInvariantReport?.status || null,
    simulationMaxEnergyDriftAbs: finiteNumberOrNull(simulationInvariantMetrics?.maxEnergyDriftAbs),
    simulationMaxMomentumDriftAbs: finiteNumberOrNull(simulationInvariantMetrics?.maxMomentumDriftAbs),
    simulationScientificValidation:
      typeof artifact.validation?.scientificValidation === 'boolean'
        ? artifact.validation.scientificValidation
        : null,
    simulationFullPhysicsValidation:
      typeof artifact.validation?.fullPhysicsValidation === 'boolean'
        ? artifact.validation.fullPhysicsValidation
        : null,
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
    closureHostImportsModule: hostImports?.module || hostImportsAsset?.url || hostImportsFactory?.module || null,
    closureHostImportsAssetStatus: hostImportsAsset?.status || null,
    closureHostImportsFactoryStatus: hostImportsFactory?.status || hostImports?.status || null,
    closureHostImportsFactoryReady: hostImportsFactory?.factoryReady === true || hostImports?.factoryReady === true,
    closureHostImportsRequirementsSchema: hostImportsFactory?.requirementsSchema || hostImports?.requirementsSchema || null,
    closureHostImportsRequirementsStatus: hostImportsFactory?.requirementsStatus || hostImports?.requirementsStatus || null,
    closureHostImportsRuntimeScope: hostImportsFactory?.runtimeScope || hostImports?.runtimeScope || null,
    closureHostImportsImplementationStatus:
      hostImportsFactory?.implementationStatus || hostImports?.implementationStatus || null,
    closureHostImportsRequiredNonStubImportCount:
      finiteNumberOrNull(hostImportsFactory?.requiredNonStubImportCount ?? hostImports?.requiredNonStubImportCount),
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
    closureTensorRuntimeRuntimeStatus: closureTensorRuntimeContract?.runtimeStatus || null,
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
    closureTensorLinearMemorySmokeBindingEntryExportConsumesOffsets:
      typeof closureTensorLinearMemorySmokeBinding?.entryExportConsumesOffsets === 'boolean'
        ? closureTensorLinearMemorySmokeBinding.entryExportConsumesOffsets
        : null,
    closureTensorLinearMemorySmokeBindingOutputInitialization:
      closureTensorLinearMemorySmokeBinding?.outputInitialization || null,
    closureTensorEntryExportOffsetProbeSchema: closureTensorEntryExportOffsetProbe?.schema || null,
    closureTensorEntryExportOffsetProbeStatus: closureTensorEntryExportOffsetProbe?.status || null,
    closureTensorEntryExportOffsetProbeBlocker: closureTensorEntryExportOffsetProbe?.blocker || null,
    closureTensorEntryExportOffsetProbeEntryExport: closureTensorEntryExportOffsetProbe?.entryExport || null,
    closureTensorEntryExportHostImportOptions: clonePlain(closureTensorEntryExportOffsetProbe?.hostImportOptions || null),
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
    closureProductionHandlerContractSchema: closureProductionHandlerContract?.schema || null,
    closureProductionHandlerContractStatus: closureProductionHandlerContract?.status || null,
    closureProductionHandlerContractDeclared,
    closureProductionHandlerContractHandlerId: closureProductionHandlerContract?.handlerId || null,
    closureProductionHandlerContractDispatchSchema: closureProductionHandlerContract?.dispatchSchema || null,
    closureProductionHandlerContractEntryExport: closureProductionHandlerContract?.entryExport || null,
    closureProductionHandlerContractRuntimeAbi: closureProductionHandlerContract?.runtimeAbi || null,
    closureProductionHandlerContractTensorMemoryModel:
      closureProductionHandlerContract?.tensorMemoryModel || null,
    closureProductionHandlerContractInputTensorIds:
      clonePlain(closureProductionHandlerContractInputTensorIds),
    closureProductionHandlerContractOutputTensorIds:
      clonePlain(closureProductionHandlerContractOutputTensorIds),
    closureProductionHandlerContractInvocationModuleSource:
      closureProductionHandlerContractInvocation?.moduleSource || null,
    closureProductionHandlerContractInvocationEntryExport:
      closureProductionHandlerContractInvocation?.entryExport || null,
    closureProductionHandlerContractInvocationArgumentMode:
      closureProductionHandlerContractInvocation?.argumentMode || null,
    closureProductionHandlerContractInvocationParameterTypes:
      clonePlain(closureProductionHandlerContractInvocationParameterTypes),
    closureProductionHandlerContractInvocationResultTypes:
      clonePlain(closureProductionHandlerContractInvocationResultTypes),
    closureProductionHandlerContractInvocationInputOffsetParam:
      finiteNumberOrNull(closureProductionHandlerContractInvocation?.inputOffsetParam),
    closureProductionHandlerContractInvocationOutputOffsetParam:
      finiteNumberOrNull(closureProductionHandlerContractInvocation?.outputOffsetParam),
    closureProductionHandlerContractInvocationExpectedReturn:
      finiteNumberOrNull(closureProductionHandlerContractInvocation?.expectedReturn),
    closureProductionHandlerContractRequiredEvidence:
      clonePlain(closureProductionHandlerContractRequiredEvidence),
    closureProductionHandlerContractRequiredEvidenceCount:
      closureProductionHandlerContractRequiredEvidence.length,
    closureProductionHandlerContractBlockedBy:
      clonePlain(closureProductionHandlerContractBlockedBy),
    closureProductionHandlerImplementationSchema: closureProductionHandlerImplementation?.schema || null,
    closureProductionHandlerImplementationStatus: closureProductionHandlerImplementation?.status || null,
    closureProductionHandlerImplementationReady,
    closureProductionHandlerImplementationScope:
      closureProductionHandlerImplementation?.implementationScope || null,
    closureProductionHandlerImplementationExecutionClaim:
      closureProductionHandlerImplementation?.executionClaim || null,
    closureProductionHandlerImplementationEvidence:
      clonePlain(closureProductionHandlerImplementationEvidence),
    closureProductionHandlerImplementationEvidenceCount:
      closureProductionHandlerImplementationEvidence.length,
    closureProductionHandlerImplementationBlockedBy:
      clonePlain(closureProductionHandlerImplementationBlockedBy),
    closureProductionHandlerRuntimeExecutionSchema: closureProductionHandlerRuntimeExecution?.schema || null,
    closureProductionHandlerRuntimeExecutionStatus: closureProductionHandlerRuntimeExecution?.status || null,
    closureProductionHandlerRuntimeExecutionReady,
    closureProductionHandlerRuntimeExecutionEntryArgs:
      clonePlain(closureProductionHandlerRuntimeExecutionEntryArgs),
    closureProductionHandlerRuntimeExecutionEntryResult:
      finiteNumberOrNull(closureProductionHandlerRuntimeExecution?.entryResult),
    closureProductionHandlerRuntimeExecutionChangedBytesInDeclaredTensorRange:
      finiteNumberOrNull(closureProductionHandlerRuntimeExecution?.changedBytesInDeclaredTensorRange),
    closureProductionHandlerRuntimeExecutionOutputTensorsProduced:
      typeof closureProductionHandlerRuntimeExecution?.outputTensorsProducedByEntryExport === 'boolean'
        ? closureProductionHandlerRuntimeExecution.outputTensorsProducedByEntryExport
        : null,
    closureProductionHandlerRuntimeExecutionHostImportCallCounts:
      clonePlain(closureProductionHandlerRuntimeExecutionHostImportCallCounts),
    closureProductionHandlerRuntimeExecutionBlockedBy:
      clonePlain(closureProductionHandlerRuntimeExecutionBlockedBy),
    closureFullPhysicsValidationRequirementsSchema:
      closureFullPhysicsValidationRequirements?.schema || null,
    closureFullPhysicsValidationRequirementsStatus:
      closureFullPhysicsValidationRequirements?.status || null,
    closureFullPhysicsValidationRequirementsDeclared,
    closureFullPhysicsValidationRequirementsReady:
      typeof closureFullPhysicsValidationRequirements?.ready === 'boolean'
        ? closureFullPhysicsValidationRequirements.ready
        : null,
    closureFullPhysicsValidationRequirementsValidationScope:
      closureFullPhysicsValidationRequirements?.validationScope || null,
    closureFullPhysicsValidationRequirementsProducerSchema:
      closureFullPhysicsValidationRequirements?.producerSchema || null,
    closureFullPhysicsValidationRequirementsRequiredValidationSchema:
      closureFullPhysicsValidationRequirements?.requiredValidationSchema || null,
    closureFullPhysicsValidationRequirementsRequiredValidationScope:
      closureFullPhysicsValidationRequirements?.requiredValidationScope || null,
    closureFullPhysicsValidationRequiredRuntimeEvidenceFamilies:
      clonePlain(closureFullPhysicsValidationRequiredRuntimeEvidenceFamilies),
    closureFullPhysicsValidationRequiredRuntimeEvidenceCount:
      closureFullPhysicsValidationRequiredRuntimeEvidence.length,
    closureFullPhysicsValidationRequiredHashFields:
      clonePlain(closureFullPhysicsValidationRequiredHashFields),
    closureFullPhysicsValidationRequiredRuntimeEvidence:
      clonePlain(closureFullPhysicsValidationRequiredRuntimeEvidence),
    closureFullPhysicsValidationRequirementsBlockedBy:
      clonePlain(closureFullPhysicsValidationBlockedBy),
    closureProductionCandidateRuntimeProbeSchema: closureProductionCandidateRuntimeProbe?.schema || null,
    closureProductionCandidateRuntimeProbeStatus: closureProductionCandidateRuntimeProbe?.status || null,
    closureProductionCandidateRuntimeProbeReady,
    closureProductionCandidateRuntimeProbeExecutionClaim:
      closureProductionCandidateRuntimeProbe?.executionClaim || null,
    closureProductionCandidateRuntimeProbeRuntimeScope:
      closureProductionCandidateRuntimeProbe?.runtimeScope || null,
    closureProductionCandidateRuntimeProbeImplementationStatus:
      closureProductionCandidateRuntimeProbe?.implementationStatus || null,
    closureProductionCandidateRuntimeProbeEntryExport:
      closureProductionCandidateRuntimeProbe?.entryExport || null,
    closureProductionCandidateRuntimeProbeEntryArgs:
      clonePlain(closureProductionCandidateRuntimeProbeEntryArgs),
    closureProductionCandidateRuntimeProbeExpectedEntryResult:
      finiteNumberOrNull(closureProductionCandidateRuntimeProbe?.expectedEntryResult),
    closureProductionCandidateRuntimeProbeChangedBytesInDeclaredTensorRange:
      finiteNumberOrNull(closureProductionCandidateRuntimeProbe?.changedBytesInDeclaredTensorRange),
    closureProductionCandidateRuntimeProbeOutputTensorsProduced:
      typeof closureProductionCandidateRuntimeProbe?.outputTensorsProducedByEntryExport === 'boolean'
        ? closureProductionCandidateRuntimeProbe.outputTensorsProducedByEntryExport
        : null,
    closureProductionCandidateRuntimeProbeProductionHandlerReady:
      typeof closureProductionCandidateRuntimeProbe?.productionHandlerReady === 'boolean'
        ? closureProductionCandidateRuntimeProbe.productionHandlerReady
        : null,
    closureProductionCandidateRuntimeProbeProductionHandlerRuntimeExecution:
      typeof closureProductionCandidateRuntimeProbe?.productionHandlerRuntimeExecution === 'boolean'
        ? closureProductionCandidateRuntimeProbe.productionHandlerRuntimeExecution
        : null,
    closureProductionCandidateRuntimeProbeScientificValidation:
      typeof closureProductionCandidateRuntimeProbe?.scientificValidation === 'boolean'
        ? closureProductionCandidateRuntimeProbe.scientificValidation
        : null,
    closureProductionCandidateRuntimeProbeFullPhysicsValidation:
      typeof closureProductionCandidateRuntimeProbe?.fullPhysicsValidation === 'boolean'
        ? closureProductionCandidateRuntimeProbe.fullPhysicsValidation
        : null,
    closureProductionCandidateRuntimeProbeFullFidelityMagnetarSimulation:
      typeof closureProductionCandidateRuntimeProbe?.fullFidelityMagnetarSimulation === 'boolean'
        ? closureProductionCandidateRuntimeProbe.fullFidelityMagnetarSimulation
        : null,
    closureProductionCandidateRuntimeProbeHostImportOptions:
      clonePlain(closureProductionCandidateRuntimeProbeHostImportOptions),
    closureProductionCandidateRuntimeProbeHostImportCallCounts:
      clonePlain(closureProductionCandidateRuntimeProbeHostImportCallCounts),
    closureProductionCandidateRuntimeProbeBlocker:
      closureProductionCandidateRuntimeProbe?.blocker || null,
    closureProductionHostImportsRuntimeScope: closureProductionHandlerHostImports?.runtimeScope || null,
    closureProductionHostImportsImplementationStatus:
      closureProductionHandlerHostImports?.implementationStatus || null,
    closureProductionHostImportCandidateSchema: closureProductionHostImportCandidate?.schema || null,
    closureProductionHostImportCandidateStatus: closureProductionHostImportCandidate?.status || null,
    closureProductionHostImportCandidateProductionRuntimeAbi:
      closureProductionHostImportCandidate?.productionRuntimeAbi || null,
    closureProductionHostImportCandidateRuntimeSmokeStubsAllowed:
      typeof closureProductionHostImportCandidate?.runtimeSmokeStubsAllowed === 'boolean'
        ? closureProductionHostImportCandidate.runtimeSmokeStubsAllowed
        : null,
    closureProductionHostImportCandidateRequiredNonStubImports:
      clonePlain(closureProductionHostImportCandidateRequiredNonStubImports),
    closureProductionHostImportCandidateTensorMemoryImports:
      clonePlain(closureProductionHostImportCandidateTensorMemoryImports),
    closureProductionHostImportCandidateReadinessRequires:
      clonePlain(closureProductionHostImportCandidateReadinessRequires),
    closureProductionHostImportCandidateBlockedBy:
      clonePlain(closureProductionHostImportCandidateBlockedBy),
    closureProductionDispatchPreflightSchema: closureProductionDispatchPreflight?.schema || null,
    closureProductionDispatchPreflightStatus: closureProductionDispatchPreflight?.status || null,
    closureProductionDispatchPreflightReady:
      typeof closureProductionDispatchPreflight?.ready === 'boolean'
        ? closureProductionDispatchPreflight.ready
        : null,
    closureProductionDispatchPreflightDispatchSchema:
      closureProductionDispatchPreflight?.dispatchSchema || null,
    closureProductionDispatchPreflightCurrentRuntimeAbi:
      closureProductionDispatchPreflight?.currentRuntimeAbi || null,
    closureProductionDispatchPreflightRequiredRuntimeAbi:
      closureProductionDispatchPreflight?.requiredRuntimeAbi || null,
    closureProductionDispatchPreflightRuntimeSmokeStubsAllowed:
      typeof closureProductionDispatchPreflight?.runtimeSmokeStubsAllowed === 'boolean'
        ? closureProductionDispatchPreflight.runtimeSmokeStubsAllowed
        : null,
    closureProductionDispatchPreflightRequiredChecks:
      clonePlain(closureProductionDispatchPreflightRequiredChecks),
    closureProductionDispatchPreflightRejectedRuntimeScopes:
      clonePlain(closureProductionDispatchPreflightRejectedRuntimeScopes),
    closureProductionDispatchPreflightBlockedBy:
      clonePlain(closureProductionDispatchPreflightBlockedBy),
    closureProductionDispatchPreflightCheckSummarySchema:
      closureProductionDispatchPreflightCheckSummary?.schema || null,
    closureProductionDispatchPreflightCheckSummaryStatus:
      closureProductionDispatchPreflightCheckSummary?.status || null,
    closureProductionDispatchPreflightCheckSummaryReady:
      typeof closureProductionDispatchPreflightCheckSummary?.ready === 'boolean'
        ? closureProductionDispatchPreflightCheckSummary.ready
        : null,
    closureProductionDispatchPreflightTotalRequiredCheckCount:
      Number.isInteger(closureProductionDispatchPreflightCheckSummary?.totalRequiredCheckCount)
        ? closureProductionDispatchPreflightCheckSummary.totalRequiredCheckCount
        : null,
    closureProductionDispatchPreflightPassedCheckCount:
      Number.isInteger(closureProductionDispatchPreflightCheckSummary?.passedCount)
        ? closureProductionDispatchPreflightCheckSummary.passedCount
        : null,
    closureProductionDispatchPreflightBlockedCheckCount:
      Number.isInteger(closureProductionDispatchPreflightCheckSummary?.blockedCount)
        ? closureProductionDispatchPreflightCheckSummary.blockedCount
        : null,
    closureProductionDispatchPreflightPassedChecks:
      clonePlain(closureProductionDispatchPreflightCheckSummaryPassedChecks),
    closureProductionDispatchPreflightBlockedChecks:
      clonePlain(closureProductionDispatchPreflightCheckSummaryBlockedChecks),
    closureProductionDispatchPreflightCheckResults:
      clonePlain(closureProductionDispatchPreflightCheckResults),
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
    moonlabWebGpuBrowserBackendPreflightSchema: moonlabWebGpuBrowserBackendPreflight?.schema || null,
    moonlabWebGpuBrowserBackendPreflightDeclared,
    moonlabWebGpuBrowserBackendPreflightProbeKind: moonlabWebGpuBrowserBackendPreflight?.probeKind || null,
    moonlabWebGpuBrowserBackendPreflightRuntime: moonlabWebGpuBrowserBackendPreflight?.runtime || null,
    moonlabWebGpuBrowserBackendPreflightStage: moonlabWebGpuBrowserBackendPreflight?.stage || null,
    moonlabWebGpuBrowserBackendPreflightNavigatorGpuAvailable:
      typeof moonlabWebGpuBrowserBackendPreflight?.navigatorGpuAvailable === 'boolean'
        ? moonlabWebGpuBrowserBackendPreflight.navigatorGpuAvailable
        : null,
    moonlabWebGpuBrowserBackendPreflightAdapterAvailable:
      typeof moonlabWebGpuBrowserBackendPreflight?.adapterAvailable === 'boolean'
        ? moonlabWebGpuBrowserBackendPreflight.adapterAvailable
        : null,
    moonlabWebGpuBrowserBackendPreflightDeviceAcquired:
      typeof moonlabWebGpuBrowserBackendPreflight?.deviceAcquired === 'boolean'
        ? moonlabWebGpuBrowserBackendPreflight.deviceAcquired
        : null,
    moonlabWebGpuBrowserBackendPreflightReason:
      textOrNull(moonlabWebGpuBrowserBackendPreflight?.reason),
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
    moonlabWebGpuParityHandoffSummarySchema: moonlabWebGpuParityHandoffSummary?.schema || null,
    moonlabWebGpuParityHandoffSummaryStatus: moonlabWebGpuParityHandoffSummary?.status || null,
    moonlabWebGpuParityHandoffSummaryReady,
    moonlabWebGpuParityHandoffSummarySourceSchema: moonlabWebGpuParityHandoffSummary?.sourceSchema || null,
    moonlabWebGpuParityHandoffSummaryArtifactKind: moonlabWebGpuParityHandoffSummary?.artifactKind || null,
    moonlabWebGpuParityHandoffSummaryReadinessClaim: moonlabWebGpuParityHandoffSummary?.readinessClaim || null,
    moonlabWebGpuParityHandoffSummaryReducedFixtureOnly:
      typeof moonlabWebGpuParityHandoffSummary?.reducedFixtureOnly === 'boolean'
        ? moonlabWebGpuParityHandoffSummary.reducedFixtureOnly
        : null,
    moonlabWebGpuParityHandoffSummaryReducedFixtureWebGpuParityReady:
      typeof moonlabWebGpuParityHandoffSummary?.reducedFixtureWebGpuParityReady === 'boolean'
        ? moonlabWebGpuParityHandoffSummary.reducedFixtureWebGpuParityReady
        : null,
    moonlabWebGpuParityHandoffSummaryRuntimeBackendReady:
      typeof moonlabWebGpuParityHandoffSummary?.runtimeBackendReady === 'boolean'
        ? moonlabWebGpuParityHandoffSummary.runtimeBackendReady
        : null,
    moonlabWebGpuParityHandoffSummaryBackendAvailable:
      typeof moonlabWebGpuParityHandoffSummary?.backendAvailable === 'boolean'
        ? moonlabWebGpuParityHandoffSummary.backendAvailable
        : null,
    moonlabWebGpuParityHandoffSummaryBackendPreflightStage:
      moonlabWebGpuParityHandoffSummaryBackendPreflight?.stage || null,
    moonlabWebGpuParityHandoffSummaryRequiredOperations:
      clonePlain(moonlabWebGpuParityHandoffSummaryRequiredOperations),
    moonlabWebGpuParityHandoffSummaryCoveredOperations:
      clonePlain(moonlabWebGpuParityHandoffSummaryCoveredOperations),
    moonlabWebGpuParityHandoffSummaryMissingOperations:
      clonePlain(moonlabWebGpuParityHandoffSummaryMissingOperations),
    moonlabWebGpuParityHandoffSummaryExcludedOperations:
      clonePlain(moonlabWebGpuParityHandoffSummaryExcludedOperations),
    moonlabWebGpuParityHandoffSummaryBlockers:
      clonePlain(moonlabWebGpuParityHandoffSummaryBlockers),
    moonlabWebGpuParityHandoffSummaryValidationErrors:
      clonePlain(moonlabWebGpuParityHandoffSummaryValidationErrors),
    moonlabWebGpuParityHandoffSummaryFullFidelityMagnetarSimulation:
      typeof moonlabWebGpuParityHandoffSummary?.fullFidelityMagnetarSimulation === 'boolean'
        ? moonlabWebGpuParityHandoffSummary.fullFidelityMagnetarSimulation
        : null,
    moonlabWebGpuParityHandoffSummaryFullPhysicsValidation:
      typeof moonlabWebGpuParityHandoffSummary?.fullPhysicsValidation === 'boolean'
        ? moonlabWebGpuParityHandoffSummary.fullPhysicsValidation
        : null,
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
