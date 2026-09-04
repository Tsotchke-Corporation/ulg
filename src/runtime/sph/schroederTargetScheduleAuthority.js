import {
  schroederAuthorityTextFingerprint,
  schroederAuthorityTypedArrayFingerprint
} from './schroederAuthorityFingerprint.js';
import {
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  assertSphReactionMotionEnvelopeRulePrefix,
  createSphReactionMotionEnvelope,
  isSphReactionMotionEnvelopeReceipt
} from './sphReactionMotionEnvelope.js';
import {
  exactWorkerDynamicLawObservationSelf
} from './schroederWorkerScheduleRouteEvidence.js';
import {
  SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE,
  SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
} from './schroederDynamicLawRoutingContract.js';
import {
  SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT,
  SPH_GPU_REACTION_HEADER_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT,
  SPH_GPU_REACTION_RECORD_ROW_LAYOUT,
  ULG_REACTION_CLOSURE_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';

export const ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA =
  'peercompute.ulg.schroeder-target-schedule-authority.v5';
export const ULG_SCHROEDER_TARGET_SCHEDULE_WRITER_SET_SCHEMA =
  'peercompute.ulg.schroeder-target-schedule-writer-set.v0';
export const ULG_SCHROEDER_TARGET_SCHEDULE_PROVIDER_AUTHORITY_SCHEMA =
  'peercompute.ulg.schroeder-target-schedule-provider-authority.v0';
export const ULG_SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINTS_SCHEMA =
  'peercompute.ulg.schroeder-target-schedule-table-fingerprints.v3';
export const ULG_SCHROEDER_TARGET_SCHEDULE_CONFIGURATION_SCHEMA =
  'peercompute.ulg.schroeder-target-schedule-configuration.v0';
export const ULG_SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_SCHEMA =
  'peercompute.ulg.schroeder-prospective-dynamic-law-transition.v3';

export const SCHROEDER_TARGET_SCHEDULE_REQUEST_REVISION =
  'main-thread-next-schedule-request-prospective-writer-transition-sha256-v9';
export const SCHROEDER_TARGET_SCHEDULE_PROVIDER_REVISION =
  'worker-lane-assignment-only-classifier-options-sha256-v2';
export const SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINT_REVISION =
  'shader-bound-typed-array-content-layout-count-and-domain-sha256-v5';
export const SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_REVISION =
  'reaction-or-retained-product-gas-boundary-sha256-v3';
export const SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_KIND =
  'reaction-dormant-watch-to-executing-reaction';
export const SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND =
  'retained-product-gas-boundary-inactive-to-actionable';
export const SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_POLICY =
  'authentic-trigger-or-uncertainty-consumes-presealed-target';
export const SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_POLICY =
  'worker-retained-product-event-buffer-consumes-presealed-target';
export const SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE =
  SCHROEDER_DYNAMIC_LAW_ROUTING_EXECUTION_GATE;

export const SCHROEDER_TARGET_SCHEDULE_LINEAGE_FIELDS = Object.freeze([
  'storageGeneration',
  'physicsTick',
  'physicsSubstep',
  'positionEpoch',
  'topologyEpoch',
  'chartEpoch',
  'levelEpoch',
  'supportEpoch'
]);

export const SCHROEDER_TARGET_SCHEDULE_CLASSIFIER_OPTION_FIELDS =
  Object.freeze([
    'baseGridSpacingM',
    'minLevel',
    'maxLevel',
    'targetSupportCells',
    'supportRadiusScale',
    'chartId',
    'minSupportRadiusM',
    'maxSupportRadiusM',
    'fallbackSupportRadiusM',
    'hysteresisBand'
  ]);

export const SCHROEDER_TARGET_SCHEDULE_ACTIVATION_FIELDS = Object.freeze([
  'thermal',
  'reaction',
  'contactSolver',
  'contactSolverRequested',
  'contactSolverEscalatedForDynamicLaws',
  'lawQueue',
  'lawNeighborCandidates',
  'phaseVolumeMigration',
  'twoLevelMechanics',
  'surfaceTension',
  'particleGasLedgerActionable',
  'retainedProductGasBoundaryActionable',
  'gasBoundaryActionable',
  'explicitVacuumAmbient',
  'phaseVolumeSidecars',
  'mechanicsFieldViews'
]);

const PROVIDER_KEYS = Object.freeze([
  'schema',
  'status',
  'kind',
  'revision',
  'descriptorFingerprint',
  'mayActivateDynamicWriters',
  'writerSetComplete'
]);
const WRITER_SET_KEYS = Object.freeze([
  'schema',
  'status',
  ...SCHROEDER_TARGET_SCHEDULE_ACTIVATION_FIELDS,
  'crossLevelCoupling',
  'mechanicsFieldPairV2',
  'scheduleStepOptionsProviderMayWrite',
  'thermalPhaseEvolutionEnabled',
  'writerIds',
  'complete'
]);
const TABLE_FINGERPRINT_KEYS = Object.freeze([
  'schema',
  'revision',
  'thermalMaterialTable',
  'thermalClosureGraphSet',
  'thermalClosureGraphBank',
  'thermalPhaseResponseTable',
  'mechanicsMaterialTable',
  'reactionTable',
  'reactionActivationWatchTable',
  'thermalStepOptions',
  'reactionStepOptions',
  'mechanicsRefreshOptions',
  'watchReactionTableSource',
  'watchReactionCount',
  'watchGasProductCount',
  'watchReactionTableFingerprint',
  'watchReactionTableDomainFingerprint'
]);
const TARGET_CONFIGURATION_KEYS = Object.freeze([
  'schema',
  'status',
  'motionEnvelope',
  'writerSet',
  'scheduleStepOptionsProvider',
  'tableFingerprints',
  'configurationFingerprint'
]);
const PROSPECTIVE_DYNAMIC_LAW_TRANSITION_KEYS = Object.freeze([
  'schema',
  'status',
  'kind',
  'revision',
  'lawFamily',
  'sourceScheduleId',
  'targetScheduleRequestId',
  'laneId',
  'stateKey',
  'sourceConfiguration',
  'targetConfiguration',
  'activationPolicy',
  'transitionFingerprint',
  'shadowOnly',
  'routingAuthority',
  'executionGating'
]);
const TARGET_AUTHORITY_KEYS = Object.freeze([
  'schema',
  'status',
  'authorityRevision',
  'sourceScheduleId',
  'targetScheduleRequestId',
  'laneId',
  'stateKey',
  'sourceLineage',
  'sourceParticleCount',
  'sourcePhaseLaneCount',
  'predecessorDynamicLawObservation',
  'predecessorDynamicLawTransition',
  'prospectiveDynamicLawTransition',
  'motionEnvelope',
  'writerSet',
  'scheduleStepOptionsProvider',
  'tableFingerprints',
  'requestFingerprint',
  'shadowOnly',
  'routingAuthority',
  'executionGating'
]);
const WATCH_REACTION_TABLE_SECTIONS = Object.freeze([
  Object.freeze({
    countField: 'reactionCount',
    strideField: 'recordStrideFloats',
    arrayField: 'records',
    layoutField: 'recordLayout',
    layout: SPH_GPU_REACTION_RECORD_ROW_LAYOUT
  }),
  Object.freeze({
    countField: 'productPhaseCount',
    strideField: 'productPhaseStrideFloats',
    arrayField: 'productPhaseRecords',
    layoutField: 'productPhaseLayout',
    layout: SPH_GPU_REACTION_PRODUCT_PHASE_ROW_LAYOUT
  }),
  Object.freeze({
    countField: 'reactionHeaderCount',
    strideField: 'reactionHeaderStrideFloats',
    arrayField: 'reactionHeaders',
    layoutField: 'reactionHeaderLayout',
    layout: SPH_GPU_REACTION_HEADER_ROW_LAYOUT
  }),
  Object.freeze({
    countField: 'reactantTermCount',
    strideField: 'reactantTermStrideFloats',
    arrayField: 'reactantTermRecords',
    layoutField: 'reactantTermLayout',
    layout: SPH_GPU_REACTION_REACTANT_TERM_ROW_LAYOUT
  }),
  Object.freeze({
    countField: 'productTermCount',
    strideField: 'productTermStrideFloats',
    arrayField: 'productTermRecords',
    layoutField: 'productTermLayout',
    layout: SPH_GPU_REACTION_PRODUCT_TERM_ROW_LAYOUT
  }),
  Object.freeze({
    countField: 'gasProductCount',
    strideField: 'gasProductStrideFloats',
    arrayField: 'gasProductRecords',
    layoutField: 'gasProductLayout',
    layout: SPH_GPU_REACTION_GAS_PRODUCT_ROW_LAYOUT
  }),
  Object.freeze({
    countField: 'atomTermCount',
    strideField: 'atomTermStrideFloats',
    arrayField: 'atomTermRecords',
    layoutField: 'atomTermLayout',
    layout: SPH_GPU_REACTION_ATOM_TERM_ROW_LAYOUT
  })
]);

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function objectHasExactKeys(value, keys) {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => valuesEqual(entry, right[index]));
  }
  if (!plainObject(left) || !plainObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index]
      && valuesEqual(left[key], right[key])
    ));
}

function stableToken(value, seen = new Set()) {
  if (value === null) return 'null';
  if (typeof value === 'string') return `s:${JSON.stringify(value)}`;
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('fingerprint numbers must be finite');
    if (Object.is(value, -0)) return 'n:-0';
    return `n:${value}`;
  }
  if (ArrayBuffer.isView(value)) {
    return `t:${schroederAuthorityTypedArrayFingerprint(
      value,
      'typed-array-content-v2'
    )}`;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('fingerprint inputs must be acyclic');
    seen.add(value);
    const token = `a:[${value.map((entry) => stableToken(entry, seen)).join(',')}]`;
    seen.delete(value);
    return token;
  }
  if (!plainObject(value)) {
    throw new TypeError('fingerprint inputs must be clone-safe plain values');
  }
  if (seen.has(value)) throw new TypeError('fingerprint inputs must be acyclic');
  seen.add(value);
  const token = `o:{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}=${stableToken(value[key], seen)}`
  ).join(',')}}`;
  seen.delete(value);
  return token;
}

function textFingerprint(value, label) {
  return schroederAuthorityTextFingerprint(value, label);
}

function exactLineage(value) {
  if (!objectHasExactKeys(value, SCHROEDER_TARGET_SCHEDULE_LINEAGE_FIELDS)) {
    return null;
  }
  const output = {};
  for (const field of SCHROEDER_TARGET_SCHEDULE_LINEAGE_FIELDS) {
    const word = value[field];
    if (!Number.isSafeInteger(word) || word < 0 || word > 0xffff_ffff) {
      return null;
    }
    output[field] = word;
  }
  return output;
}

function exactPredecessorDynamicLawObservation(value) {
  if (value == null) return null;
  const observation = exactWorkerDynamicLawObservationSelf(value);
  return observation
    && nonEmptyString(observation.targetScheduleRequestId)
    && nonEmptyString(observation.targetScheduleAuthorityFingerprint)
      ? observation
      : null;
}

function predecessorObservationMatchesAuthority(
  observation,
  authority
) {
  if (observation == null) return true;
  const exactObservation = exactPredecessorDynamicLawObservation(observation);
  const predecessorTransition = authority.predecessorDynamicLawTransition == null
    ? null
    : exactSchroederProspectiveDynamicLawTransition(
        authority.predecessorDynamicLawTransition
      );
  const observedConfiguration = predecessorTransition?.sourceConfiguration
    ?? targetScheduleConfigurationFromAuthority(authority);
  return Boolean(
    exactObservation
    && exactObservation.sourceScheduleId !== authority.sourceScheduleId
    && exactObservation.targetScheduleRequestId
      === authority.sourceScheduleId
    && exactObservation.laneId === authority.laneId
    && exactObservation.stateKey === authority.stateKey
    && valuesEqual(
      exactObservation.terminalLineage,
      authority.sourceLineage
    )
    && exactObservation.particleCount === authority.sourceParticleCount
    && observationMatchesConfiguration(
      exactObservation,
      observedConfiguration,
      { allowUnmeasuredUncertainty: Boolean(predecessorTransition) }
    )
    && (
      predecessorTransition === null
      || (
        predecessorTransition.sourceScheduleId
          === exactObservation.sourceScheduleId
        && predecessorTransition.targetScheduleRequestId
          === authority.sourceScheduleId
        && predecessorTransition.laneId === authority.laneId
        && predecessorTransition.stateKey === authority.stateKey
        && observationAuthorizesProspectiveTransition(
          exactObservation,
          predecessorTransition
        )
        && valuesEqual(
          predecessorTransition.targetConfiguration,
          targetScheduleConfigurationFromAuthority(authority)
        )
      )
    )
    && exactObservation.shadowOnly
      === SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    && exactObservation.routingAuthority
      === SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    && exactObservation.executionGating
      === SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE
  );
}

function exactQuiescentReactionTable(reactionTable) {
  if (!plainObject(reactionTable)) return false;
  const zeroCountFields = [
    'reactionCount',
    'reactionHeaderCount',
    'reactantTermCount',
    'productTermCount',
    'gasProductCount',
    'atomTermCount',
    'productPhaseCount',
    'combinedRecordCount'
  ];
  const zeroRecordFields = [
    'records',
    'reactionHeaders',
    'reactantTermRecords',
    'productTermRecords',
    'gasProductRecords',
    'atomTermRecords',
    'productPhaseRecords',
    'combinedRecords'
  ];
  const zeroMetadataFields = [
    'metadata',
    'reactantTermMetadata',
    'productTermMetadata',
    'gasProductMetadata',
    'atomTermMetadata',
    'productPhaseMetadata'
  ];
  return reactionTable.schema === ULG_SPH_GPU_REACTION_TABLE_SCHEMA
    && reactionTable.reactionClosureSchema === ULG_REACTION_CLOSURE_SCHEMA
    // Cold-cache rehydration preserves the exact packed zero domain but marks
    // its provenance as a cache hit. Count/row/metadata emptiness, rather than
    // that provenance label alone, is the quiescence authority.
    && [
      'no-derived-reactions',
      'static-table-cache-hit'
    ].includes(reactionTable.status)
    && zeroCountFields.every(
      (field) => Number.isSafeInteger(reactionTable[field])
        && reactionTable[field] === 0
    )
    && zeroRecordFields.every(
      (field) => reactionTable[field] instanceof Float32Array
        && reactionTable[field].length === 0
    )
    && zeroMetadataFields.every(
      (field) => Array.isArray(reactionTable[field])
        && reactionTable[field].length === 0
    );
}

function providerWriterIds(writerSet) {
  return [
    writerSet.thermal ? 'thermal-material-table' : null,
    writerSet.reaction ? 'reaction-table' : null,
    writerSet.contactSolver ? 'canonical-contact-solver' : null,
    writerSet.lawQueue ? 'law-queue' : null,
    writerSet.lawNeighborCandidates ? 'law-neighbor-candidates' : null,
    writerSet.phaseVolumeMigration ? 'phase-volume-migration' : null,
    writerSet.twoLevelMechanics ? 'two-level-mechanics' : null,
    writerSet.surfaceTension ? 'surface-tension' : null,
    writerSet.particleGasLedgerActionable
      ? 'particle-gas-ledger-actionable'
      : null,
    writerSet.retainedProductGasBoundaryActionable
      ? 'retained-product-gas-boundary-actionable'
      : null,
    writerSet.gasBoundaryActionable ? 'gas-boundary-actionable' : null,
    writerSet.mechanicsFieldViews ? 'mechanics-field-views' : null,
    writerSet.crossLevelCoupling ? 'cross-level-coupling' : null,
    writerSet.mechanicsFieldPairV2 ? 'mechanics-field-pair-v2' : null,
    writerSet.scheduleStepOptionsProviderMayWrite
      ? 'schedule-step-options-provider'
      : null
  ].filter(Boolean).sort();
}

export function createSchroederTargetScheduleProviderAuthority({
  kind = 'none',
  classifierOptions = null,
  descriptorFingerprint = null
} = {}) {
  if (kind === 'none') {
    return deepFreeze({
      schema: ULG_SCHROEDER_TARGET_SCHEDULE_PROVIDER_AUTHORITY_SCHEMA,
      status: 'target-schedule-provider-authority-ready',
      kind: 'none',
      revision: SCHROEDER_TARGET_SCHEDULE_PROVIDER_REVISION,
      descriptorFingerprint: null,
      mayActivateDynamicWriters: false,
      writerSetComplete: true
    });
  }
  if (kind === 'worker-lane-assignment-only') {
    const filtered = {};
    for (const field of SCHROEDER_TARGET_SCHEDULE_CLASSIFIER_OPTION_FIELDS) {
      if (classifierOptions?.[field] == null) continue;
      const value = classifierOptions[field];
      if (
        !['number', 'string', 'boolean'].includes(typeof value)
        || (typeof value === 'number' && !Number.isFinite(value))
      ) {
        throw new TypeError(
          `classifierOptions.${field} must be a finite primitive value`
        );
      }
      filtered[field] = value;
    }
    return deepFreeze({
      schema: ULG_SCHROEDER_TARGET_SCHEDULE_PROVIDER_AUTHORITY_SCHEMA,
      status: 'target-schedule-provider-authority-ready',
      kind,
      revision: SCHROEDER_TARGET_SCHEDULE_PROVIDER_REVISION,
      descriptorFingerprint: textFingerprint(
        stableToken(filtered),
        'schroeder-assignment-provider-v2'
      ),
      mayActivateDynamicWriters: false,
      writerSetComplete: true
    });
  }
  if (kind === 'general-unsealed') {
    return deepFreeze({
      schema: ULG_SCHROEDER_TARGET_SCHEDULE_PROVIDER_AUTHORITY_SCHEMA,
      status: 'target-schedule-provider-authority-incomplete',
      kind,
      revision: SCHROEDER_TARGET_SCHEDULE_PROVIDER_REVISION,
      descriptorFingerprint: nonEmptyString(descriptorFingerprint),
      mayActivateDynamicWriters: true,
      writerSetComplete: false
    });
  }
  throw new TypeError(`Unsupported target schedule provider kind: ${kind}`);
}

export function exactSchroederTargetScheduleProviderAuthority(value) {
  if (
    !objectHasExactKeys(value, PROVIDER_KEYS)
    || value.schema !== ULG_SCHROEDER_TARGET_SCHEDULE_PROVIDER_AUTHORITY_SCHEMA
    || value.revision !== SCHROEDER_TARGET_SCHEDULE_PROVIDER_REVISION
    || typeof value.mayActivateDynamicWriters !== 'boolean'
    || typeof value.writerSetComplete !== 'boolean'
  ) return null;
  if (value.kind === 'none') {
    return value.status === 'target-schedule-provider-authority-ready'
      && value.descriptorFingerprint === null
      && value.mayActivateDynamicWriters === false
      && value.writerSetComplete === true
        ? value
        : null;
  }
  if (value.kind === 'worker-lane-assignment-only') {
    return value.status === 'target-schedule-provider-authority-ready'
      && nonEmptyString(value.descriptorFingerprint)
      && value.mayActivateDynamicWriters === false
      && value.writerSetComplete === true
        ? value
        : null;
  }
  if (value.kind === 'general-unsealed') {
    return value.status === 'target-schedule-provider-authority-incomplete'
      && value.mayActivateDynamicWriters === true
      && value.writerSetComplete === false
        ? value
        : null;
  }
  return null;
}

export function createSchroederTargetScheduleWriterSet({
  residentStepOptions = null,
  epochOptions = null,
  mechanicsOptions = null,
  hierarchyConfig = null,
  scheduleStepOptionsProvider = null,
  particleGasLedgerActionable = false,
  retainedProductGasBoundaryActionable = false
} = {}) {
  if (typeof particleGasLedgerActionable !== 'boolean') {
    throw new TypeError(
      'particleGasLedgerActionable must be an exact boolean'
    );
  }
  if (typeof retainedProductGasBoundaryActionable !== 'boolean') {
    throw new TypeError(
      'retainedProductGasBoundaryActionable must be an exact boolean'
    );
  }
  const resident = plainObject(residentStepOptions) ? residentStepOptions : {};
  const epoch = plainObject(epochOptions) ? epochOptions : {};
  const mechanics = plainObject(mechanicsOptions) ? mechanicsOptions : {};
  const hierarchy = plainObject(hierarchyConfig)
    ? hierarchyConfig
    : (plainObject(mechanics.hierarchyConfig) ? mechanics.hierarchyConfig : {});
  const provider = exactSchroederTargetScheduleProviderAuthority(
    scheduleStepOptionsProvider
  );
  if (!provider) {
    throw new TypeError('scheduleStepOptionsProvider authority must be exact');
  }
  const phaseVolumeMigration = Boolean(
    epoch.enablePhaseVolumeMigration === true
    || mechanics.enablePhaseVolumeMigration === true
    || hierarchy.enablePhaseVolumeMigration === true
  );
  const twoLevelMechanics = Boolean(
    mechanics.enableTwoLevelMechanics === true
    || hierarchy.enableTwoLevelMechanics === true
  );
  const authoritativeTwoLevelMechanics = Boolean(
    twoLevelMechanics
    && String(
      mechanics.twoLevelMechanicsAuthority
      ?? hierarchy.twoLevelMechanicsAuthority
      ?? 'observation'
    ).trim().toLowerCase() === 'authoritative'
  );
  const thermal = Boolean(resident.thermalMaterialTable);
  const reaction = resident.reactionTable != null
    && !exactQuiescentReactionTable(resident.reactionTable);
  const activeReactionGasProductCount = Number(
    resident.reactionTable?.gasProductCount
  );
  if (
    reaction
    && Number.isSafeInteger(activeReactionGasProductCount)
    && !Object.is(activeReactionGasProductCount, -0)
    && activeReactionGasProductCount > 0
    && particleGasLedgerActionable !== true
  ) {
    throw new TypeError(
      'an executing gas-producing reaction table requires particleGasLedgerActionable authority'
    );
  }
  const lawQueue = Boolean(
    mechanics.enableLawQueue === true || hierarchy.enableLawQueue === true
  );
  const lawNeighborCandidates = Boolean(
    mechanics.enableLawNeighborCandidates === true
    || hierarchy.enableLawNeighborCandidates === true
  );
  const crossLevelCoupling = Boolean(
    mechanics.enableCrossLevelCoupling === true
    || hierarchy.enableCrossLevelCoupling === true
  );
  const mechanicsFieldPairV2 = Boolean(
    mechanics.enableMechanicsFieldPairV2 === true
    || hierarchy.enableMechanicsFieldPairV2 === true
  );
  const surfaceTension =
    resident.mechanicsMaterialTable?.surfaceTensionEnabled === true;
  const nonParticleGasBoundaryActionable = Boolean(
    retainedProductGasBoundaryActionable
    || resident.gasPressureSummary?.gasCellField
    || resident.pressureInterfaceForceRowsBuffer
    || resident.pressureInterfaceForceSolver
    || resident.pressureInterfaceGasCellFieldImport
    || resident.pressureInterfaceGridForceAdmission
    || resident.externalGaugePressureEnabled === true
  );
  const unsupportedTwoLevelGasBoundaryActionable = Boolean(
    resident.gasPressureSummary?.gasCellField
    || resident.pressureInterfaceForceRowsBuffer
    || resident.pressureInterfaceForceSolver
    || resident.pressureInterfaceGasCellFieldImport
    || resident.pressureInterfaceGridForceAdmission
    || resident.externalGaugePressureEnabled === true
  );
  const gasBoundaryActionable = Boolean(
    particleGasLedgerActionable || nonParticleGasBoundaryActionable
  );
  if (
    authoritativeTwoLevelMechanics
    && unsupportedTwoLevelGasBoundaryActionable
  ) {
    throw new TypeError(
      'authoritative two-level mechanics accepts only exact particle/product gas-ledger sources, not legacy imported pressure or external-gauge authorities'
    );
  }
  const explicitVacuumAmbient = typeof resident.ambientPressurePa === 'number'
    && Number.isFinite(resident.ambientPressurePa)
    && resident.ambientPressurePa === 0;
  const mechanicsFieldViews = Boolean(
    epoch.mechanicsFieldViewsRequired === true
    || phaseVolumeMigration
    || twoLevelMechanics
    || surfaceTension
    || gasBoundaryActionable
    || !explicitVacuumAmbient
  );
  const contactSolverRequested = resident.contactSolverEnabled !== false;
  const dynamicLawActive = Boolean(
    thermal
    || reaction
    || lawQueue
    || lawNeighborCandidates
    || phaseVolumeMigration
    || twoLevelMechanics
    || surfaceTension
    // Merely presenting the current particle family to the gas candidate
    // classifier must not turn contact back on for contact-free fluids. Keep
    // the historical escalation for retained/imported gas authorities.
    || nonParticleGasBoundaryActionable
  );
  const contactSolverEscalatedForDynamicLaws = Boolean(
    !contactSolverRequested && dynamicLawActive
  );
  const base = {
    schema: ULG_SCHROEDER_TARGET_SCHEDULE_WRITER_SET_SCHEMA,
    status: provider.writerSetComplete
      ? 'target-schedule-writer-set-complete'
      : 'target-schedule-writer-set-incomplete',
    thermal,
    reaction,
    contactSolver: Boolean(
      contactSolverRequested || contactSolverEscalatedForDynamicLaws
    ),
    contactSolverRequested,
    contactSolverEscalatedForDynamicLaws,
    lawQueue,
    lawNeighborCandidates,
    phaseVolumeMigration,
    twoLevelMechanics,
    surfaceTension,
    particleGasLedgerActionable,
    retainedProductGasBoundaryActionable,
    gasBoundaryActionable,
    explicitVacuumAmbient,
    phaseVolumeSidecars: Boolean(
      phaseVolumeMigration
      || twoLevelMechanics
      || particleGasLedgerActionable
      || retainedProductGasBoundaryActionable
    ),
    mechanicsFieldViews,
    crossLevelCoupling,
    mechanicsFieldPairV2,
    scheduleStepOptionsProviderMayWrite:
      provider.mayActivateDynamicWriters,
    thermalPhaseEvolutionEnabled: Boolean(
      thermal
      || phaseVolumeMigration
      || provider.mayActivateDynamicWriters
    ),
    writerIds: null,
    complete: provider.writerSetComplete
  };
  base.writerIds = providerWriterIds(base);
  return deepFreeze(base);
}

export function exactSchroederTargetScheduleWriterSet(value) {
  if (
    !objectHasExactKeys(value, WRITER_SET_KEYS)
    || value.schema !== ULG_SCHROEDER_TARGET_SCHEDULE_WRITER_SET_SCHEMA
    || !SCHROEDER_TARGET_SCHEDULE_ACTIVATION_FIELDS.every(
      (field) => typeof value[field] === 'boolean'
    )
    || typeof value.crossLevelCoupling !== 'boolean'
    || typeof value.mechanicsFieldPairV2 !== 'boolean'
    || typeof value.scheduleStepOptionsProviderMayWrite !== 'boolean'
    || typeof value.thermalPhaseEvolutionEnabled !== 'boolean'
    || typeof value.complete !== 'boolean'
    || !Array.isArray(value.writerIds)
    || !value.writerIds.every((entry) => nonEmptyString(entry))
    || new Set(value.writerIds).size !== value.writerIds.length
    || value.phaseVolumeSidecars
      !== Boolean(
        value.phaseVolumeMigration
        || value.twoLevelMechanics
        || value.particleGasLedgerActionable
        || value.retainedProductGasBoundaryActionable
      )
    || (
      value.particleGasLedgerActionable
      && !value.gasBoundaryActionable
    )
    || (
      value.retainedProductGasBoundaryActionable
      && !value.gasBoundaryActionable
    )
    || value.contactSolver !== (
      value.contactSolverRequested
      || value.contactSolverEscalatedForDynamicLaws
    )
    || value.contactSolverEscalatedForDynamicLaws === true
      && (
        value.contactSolverRequested === true
        || !(
          value.thermal
          || value.reaction
          || value.lawQueue
          || value.lawNeighborCandidates
          || value.phaseVolumeMigration
          || value.twoLevelMechanics
          || value.surfaceTension
          || value.gasBoundaryActionable
        )
      )
    || value.thermalPhaseEvolutionEnabled !== Boolean(
      value.thermal
      || value.phaseVolumeMigration
      || value.scheduleStepOptionsProviderMayWrite
    )
    || value.status !== (value.complete
      ? 'target-schedule-writer-set-complete'
      : 'target-schedule-writer-set-incomplete')
  ) return null;
  const expectedWriterIds = providerWriterIds(value);
  return expectedWriterIds.length === value.writerIds.length
    && expectedWriterIds.every(
      (entry, index) => entry === value.writerIds[index]
    )
      ? value
      : null;
}

function tableFingerprint(table, family) {
  if (table == null) return null;
  if (!plainObject(table)) {
    throw new TypeError(`${family} must be a plain table object`);
  }
  return textFingerprint(
    stableToken(table),
    `schroeder-${family}-v2`
  );
}

function authorizedWatchReactionTable(
  reactionTable,
  watchReactionTableSource = null
) {
  if (
    !plainObject(reactionTable)
    || reactionTable.schema !== ULG_SPH_GPU_REACTION_TABLE_SCHEMA
    || reactionTable.reactionClosureSchema !== ULG_REACTION_CLOSURE_SCHEMA
    || ![
      'derived-reaction-table-ready',
      'static-table-cache-hit'
    ].includes(reactionTable.status)
  ) {
    throw new TypeError(
      'the authorized reaction watch table requires the ready packed v1 schema'
    );
  }
  const reactionCount = reactionTable.reactionCount;
  if (
    typeof reactionCount !== 'number'
    || !Number.isSafeInteger(reactionCount)
    || reactionCount < 1
    || reactionCount > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
  ) {
    throw new RangeError(
      'the authorized reaction watch count is outside the exact f32/u32 domain'
      + ` (source=${watchReactionTableSource ?? 'unknown'}, `
      + `status=${reactionTable.status ?? 'missing'}, `
      + `reactionCount=${String(reactionCount)})`
    );
  }
  const combined = reactionTable.combinedRecords;
  if (!(combined instanceof Float32Array)) {
    throw new TypeError(
      'the authorized reaction watch table requires Float32Array combinedRecords'
    );
  }
  if (
    typeof SharedArrayBuffer === 'function'
    && combined.buffer instanceof SharedArrayBuffer
  ) {
    throw new TypeError(
      'the authorized reaction watch table cannot use shared mutable records'
    );
  }
  if (reactionTable.reactionHeaderCount !== reactionCount) {
    throw new RangeError(
      'the authorized reaction watch header count must equal reactionCount'
    );
  }
  let combinedOffset = 0;
  for (const section of WATCH_REACTION_TABLE_SECTIONS) {
    const count = reactionTable[section.countField];
    const stride = reactionTable[section.strideField];
    const records = reactionTable[section.arrayField];
    const layout = reactionTable[section.layoutField];
    if (
      !Number.isSafeInteger(count)
      || Object.is(count, -0)
      || count < (section.countField === 'reactionCount' ? 1 : 0)
      || count > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      || stride !== section.layout.length
      || !Array.isArray(layout)
      || layout.length !== section.layout.length
      || !layout.every((entry, index) => entry === section.layout[index])
    ) {
      throw new RangeError(
        `the authorized reaction watch ${section.countField} descriptor is inconsistent`
      );
    }
    const expectedLength = count * stride;
    if (!(records instanceof Float32Array) || records.length !== expectedLength) {
      throw new RangeError(
        `the authorized reaction watch ${section.arrayField} capacity is inconsistent`
      );
    }
    if (
      typeof SharedArrayBuffer === 'function'
      && records.buffer instanceof SharedArrayBuffer
    ) {
      throw new TypeError(
        `the authorized reaction watch ${section.arrayField} cannot use shared storage`
      );
    }
    if (combinedOffset + expectedLength > combined.length) {
      throw new RangeError(
        'the authorized reaction watch combined-record sections overflow'
      );
    }
    for (let index = 0; index < expectedLength; index += 1) {
      const word = records[index];
      if (
        !Number.isFinite(word)
        || !Object.is(word, combined[combinedOffset + index])
      ) {
        throw new TypeError(
          `the authorized reaction watch ${section.arrayField} prefix is inconsistent`
        );
      }
    }
    combinedOffset += expectedLength;
  }
  if (
    combinedOffset !== combined.length
    || combinedOffset % 4 !== 0
    || !Number.isSafeInteger(reactionTable.combinedRecordCount)
    || reactionTable.combinedRecordCount !== combinedOffset / 4
    || reactionTable.combinedRecordCount > 0xffff_ffff
  ) {
    throw new RangeError(
      'the authorized reaction watch combinedRecordCount is inconsistent'
    );
  }
  assertSphReactionMotionEnvelopeRulePrefix(
    combined,
    reactionCount,
    'authorized reaction watch table'
  );
  return Object.freeze({
    reactionCount,
    gasProductCount: reactionTable.gasProductCount,
    combined
  });
}

export function createSchroederTargetScheduleTableFingerprints({
  residentStepOptions = null,
  executingReactionActive = false
} = {}) {
  const resident = plainObject(residentStepOptions) ? residentStepOptions : {};
  let thermalStepOptions = plainObject(resident.thermalStepOptions)
    ? { ...resident.thermalStepOptions }
    : null;
  let reactionStepOptions = plainObject(resident.reactionStepOptions)
    ? { ...resident.reactionStepOptions }
    : null;
  let mechanicsRefreshOptions = plainObject(resident.mechanicsRefreshOptions)
    ? { ...resident.mechanicsRefreshOptions }
    : null;
  if (thermalStepOptions) delete thermalStepOptions.thermalResponseGraphUpload;
  if (reactionStepOptions) {
    delete reactionStepOptions.thermalResponseGraphUpload;
  }
  if (mechanicsRefreshOptions) {
    delete mechanicsRefreshOptions.mechanicsMaterialPhaseUpload;
  }
  if (thermalStepOptions && Object.keys(thermalStepOptions).length === 0) {
    thermalStepOptions = null;
  }
  if (reactionStepOptions && Object.keys(reactionStepOptions).length === 0) {
    reactionStepOptions = null;
  }
  if (
    mechanicsRefreshOptions
    && Object.keys(mechanicsRefreshOptions).length === 0
  ) {
    mechanicsRefreshOptions = null;
  }
  const thermalPhaseResponseTable =
    thermalStepOptions?.thermalPhaseResponseTable
    || reactionStepOptions?.thermalPhaseResponseTable
    || null;
  const thermalClosureGraphSet =
    thermalStepOptions?.thermalClosureGraphSet
    || reactionStepOptions?.thermalClosureGraphSet
    || null;
  const thermalClosureGraphBank =
    thermalStepOptions?.thermalClosureGraphBank
    || reactionStepOptions?.thermalClosureGraphBank
    || null;
  const reactionTable = resident.reactionTable ?? null;
  const reactionActivationWatchTable =
    resident.reactionActivationWatchTable ?? null;
  const watchReactionTableSource = executingReactionActive
    ? (reactionTable ? 'reaction-table' : null)
    : (reactionActivationWatchTable
        ? 'reaction-activation-watch-table'
        : null);
  const watchReactionTable = watchReactionTableSource === 'reaction-table'
    ? reactionTable
    : watchReactionTableSource === 'reaction-activation-watch-table'
      ? reactionActivationWatchTable
      : null;
  const authorizedWatchTable = watchReactionTable == null
    ? null
    : authorizedWatchReactionTable(
        watchReactionTable,
        watchReactionTableSource
      );
  return deepFreeze({
    schema: ULG_SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINTS_SCHEMA,
    revision: SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINT_REVISION,
    thermalMaterialTable: tableFingerprint(
      resident.thermalMaterialTable ?? null,
      'thermal-material-table'
    ),
    thermalClosureGraphSet: tableFingerprint(
      thermalClosureGraphSet,
      'thermal-closure-graph-set'
    ),
    thermalClosureGraphBank: tableFingerprint(
      thermalClosureGraphBank,
      'thermal-closure-graph-bank'
    ),
    thermalPhaseResponseTable: tableFingerprint(
      thermalPhaseResponseTable,
      'thermal-phase-response-table'
    ),
    mechanicsMaterialTable: tableFingerprint(
      resident.mechanicsMaterialTable ?? null,
      'mechanics-material-table'
    ),
    reactionTable: tableFingerprint(reactionTable, 'reaction-table'),
    reactionActivationWatchTable: tableFingerprint(
      reactionActivationWatchTable,
      'reaction-activation-watch-table'
    ),
    thermalStepOptions: tableFingerprint(
      thermalStepOptions,
      'thermal-step-options'
    ),
    reactionStepOptions: tableFingerprint(
      reactionStepOptions,
      'reaction-step-options'
    ),
    mechanicsRefreshOptions: tableFingerprint(
      mechanicsRefreshOptions,
      'mechanics-refresh-options'
    ),
    watchReactionTableSource,
    watchReactionCount: authorizedWatchTable?.reactionCount ?? null,
    watchGasProductCount:
      authorizedWatchTable?.gasProductCount ?? null,
    watchReactionTableFingerprint: authorizedWatchTable
      ? schroederAuthorityTypedArrayFingerprint(
          authorizedWatchTable.combined,
          'reaction-table-combined-records-v2'
        )
      : null,
    watchReactionTableDomainFingerprint: watchReactionTable == null
      ? null
      : tableFingerprint(
          watchReactionTable,
          'reaction-table-role-neutral-domain'
        )
  });
}

export function exactSchroederTargetScheduleTableFingerprints(value) {
  if (
    !objectHasExactKeys(value, TABLE_FINGERPRINT_KEYS)
    || value.schema
      !== ULG_SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINTS_SCHEMA
    || value.revision
      !== SCHROEDER_TARGET_SCHEDULE_TABLE_FINGERPRINT_REVISION
  ) return null;
  for (const field of [
    'thermalMaterialTable',
    'thermalClosureGraphSet',
    'thermalClosureGraphBank',
    'thermalPhaseResponseTable',
    'mechanicsMaterialTable',
    'reactionTable',
    'reactionActivationWatchTable',
    'thermalStepOptions',
    'reactionStepOptions',
    'mechanicsRefreshOptions',
    'watchReactionTableFingerprint',
    'watchReactionTableDomainFingerprint'
  ]) {
    if (value[field] !== null && !nonEmptyString(value[field])) return null;
  }
  if (![
    null,
    'reaction-table',
    'reaction-activation-watch-table'
  ].includes(value.watchReactionTableSource)) return null;
  if (
    (value.watchReactionTableSource === null)
      !== (value.watchReactionTableFingerprint === null)
    || (value.watchReactionTableSource === null)
      !== (value.watchReactionTableDomainFingerprint === null)
    || (value.watchReactionTableSource === null)
      !== (value.watchReactionCount === null)
    || (value.watchReactionTableSource === null)
      !== (value.watchGasProductCount === null)
    || (
      value.watchReactionCount !== null
      && (
        !Number.isSafeInteger(value.watchReactionCount)
        || value.watchReactionCount < 1
        || value.watchReactionCount
          > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      )
    )
    || (
      value.watchGasProductCount !== null
      && (
        !Number.isSafeInteger(value.watchGasProductCount)
        || Object.is(value.watchGasProductCount, -0)
        || value.watchGasProductCount < 0
        || value.watchGasProductCount
          > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
      )
    )
    || (
      value.watchReactionTableSource === 'reaction-table'
      && value.reactionTable === null
    )
    || (
      value.watchReactionTableSource === 'reaction-activation-watch-table'
      && value.reactionActivationWatchTable === null
    )
  ) return null;
  return value;
}

function targetScheduleConfigurationFingerprint(value) {
  const {
    configurationFingerprint: ignoredFingerprint,
    ...content
  } = value;
  return textFingerprint(
    stableToken(content),
    'schroeder-target-schedule-configuration-v0'
  );
}

function targetScheduleConfigurationFromParts({
  motionEnvelope,
  writerSet,
  scheduleStepOptionsProvider,
  tableFingerprints
}) {
  const configuration = {
    schema: ULG_SCHROEDER_TARGET_SCHEDULE_CONFIGURATION_SCHEMA,
    status: writerSet.complete
      ? 'target-schedule-configuration-ready'
      : 'target-schedule-configuration-incomplete',
    motionEnvelope,
    writerSet,
    scheduleStepOptionsProvider,
    tableFingerprints,
    configurationFingerprint: null
  };
  configuration.configurationFingerprint =
    targetScheduleConfigurationFingerprint(configuration);
  return deepFreeze(configuration);
}

export function createSchroederTargetScheduleConfiguration({
  maxFutureSubsteps,
  dtS,
  gridSpacingM,
  cflFactor,
  boxDimsM,
  residentStepOptions = null,
  epochOptions = null,
  mechanicsOptions = null,
  hierarchyConfig = null,
  scheduleStepOptionsProvider = null,
  particleGasLedgerActionable = false,
  retainedProductGasBoundaryActionable = false
} = {}) {
  const provider = exactSchroederTargetScheduleProviderAuthority(
    scheduleStepOptionsProvider
  );
  if (!provider) {
    throw new TypeError('target schedule provider authority is not exact');
  }
  const writerSet = createSchroederTargetScheduleWriterSet({
    residentStepOptions,
    epochOptions,
    mechanicsOptions,
    hierarchyConfig,
    scheduleStepOptionsProvider: provider,
    particleGasLedgerActionable,
    retainedProductGasBoundaryActionable
  });
  const tableFingerprints = createSchroederTargetScheduleTableFingerprints({
    residentStepOptions,
    executingReactionActive: writerSet.reaction
  });
  const motionEnvelope = createSphReactionMotionEnvelope({
    maxFutureSubsteps,
    dtS,
    gridSpacingM,
    cflFactor,
    boxDimsM,
    separationDisplacementEnabled: writerSet.contactSolver !== true,
    contactCorrectionEnabled: writerSet.contactSolver === true,
    thermalPhaseEvolutionEnabled: writerSet.thermalPhaseEvolutionEnabled
  });
  return targetScheduleConfigurationFromParts({
    motionEnvelope,
    writerSet,
    scheduleStepOptionsProvider: provider,
    tableFingerprints
  });
}

export function exactSchroederTargetScheduleConfiguration(value) {
  if (
    !objectHasExactKeys(value, TARGET_CONFIGURATION_KEYS)
    || value.schema !== ULG_SCHROEDER_TARGET_SCHEDULE_CONFIGURATION_SCHEMA
    || ![
      'target-schedule-configuration-ready',
      'target-schedule-configuration-incomplete'
    ].includes(value.status)
    || !isSphReactionMotionEnvelopeReceipt(value.motionEnvelope)
    || !exactSchroederTargetScheduleWriterSet(value.writerSet)
    || !exactSchroederTargetScheduleProviderAuthority(
      value.scheduleStepOptionsProvider
    )
    || !exactSchroederTargetScheduleTableFingerprints(
      value.tableFingerprints
    )
    || !nonEmptyString(value.configurationFingerprint)
    || value.status !== (value.writerSet.complete
      ? 'target-schedule-configuration-ready'
      : 'target-schedule-configuration-incomplete')
    || value.writerSet.scheduleStepOptionsProviderMayWrite
      !== value.scheduleStepOptionsProvider.mayActivateDynamicWriters
    || value.writerSet.complete
      !== value.scheduleStepOptionsProvider.writerSetComplete
    || value.motionEnvelope.contactCorrectionEnabled
      !== value.writerSet.contactSolver
    || value.motionEnvelope.separationDisplacementEnabled
      === value.writerSet.contactSolver
    || value.motionEnvelope.thermalPhaseEvolutionEnabled
      !== value.writerSet.thermalPhaseEvolutionEnabled
  ) return null;
  try {
    return targetScheduleConfigurationFingerprint(value)
      === value.configurationFingerprint
      ? value
      : null;
  } catch {
    return null;
  }
}

function valuesEqualExcept(left, right, ignoredKeys) {
  if (!plainObject(left) || !plainObject(right)) return false;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (ignoredKeys.has(key)) continue;
    if (!valuesEqual(left[key], right[key])) return false;
  }
  return true;
}

function exactDormantReactionWatchToExecutingReactionTransition(
  sourceConfiguration,
  targetConfiguration
) {
  const source = exactSchroederTargetScheduleConfiguration(
    sourceConfiguration
  );
  const target = exactSchroederTargetScheduleConfiguration(
    targetConfiguration
  );
  if (
    !source
    || !target
    || source.status !== 'target-schedule-configuration-ready'
    || target.status !== 'target-schedule-configuration-ready'
    || !valuesEqual(
      source.scheduleStepOptionsProvider,
      target.scheduleStepOptionsProvider
    )
  ) return false;

  const sourceWriters = source.writerSet;
  const targetWriters = target.writerSet;
  const reactionCanCreateGas =
    source.tableFingerprints.watchGasProductCount > 0;
  const expectedTargetParticleGasLedgerActionable = Boolean(
    sourceWriters.particleGasLedgerActionable
    || reactionCanCreateGas
  );
  const particleGasActivation = Boolean(
    sourceWriters.particleGasLedgerActionable === false
    && expectedTargetParticleGasLedgerActionable
  );
  const writerDelta = new Set([
    'reaction',
    'contactSolver',
    'contactSolverEscalatedForDynamicLaws',
    ...(particleGasActivation
      ? [
          'particleGasLedgerActionable',
          'gasBoundaryActionable',
          'phaseVolumeSidecars',
          'mechanicsFieldViews'
        ]
      : []),
    'writerIds'
  ]);
  if (
    sourceWriters.reaction !== false
    || targetWriters.reaction !== true
    || targetWriters.particleGasLedgerActionable
      !== expectedTargetParticleGasLedgerActionable
    || (
      particleGasActivation
      && (
        targetWriters.gasBoundaryActionable !== true
        || targetWriters.phaseVolumeSidecars !== true
        || targetWriters.mechanicsFieldViews !== true
      )
    )
    || !valuesEqualExcept(sourceWriters, targetWriters, writerDelta)
    || targetWriters.contactSolverRequested
      !== sourceWriters.contactSolverRequested
    || targetWriters.contactSolverEscalatedForDynamicLaws
      !== (targetWriters.contactSolverRequested !== true)
    || targetWriters.contactSolver !== true
  ) return false;

  const sourceTables = source.tableFingerprints;
  const targetTables = target.tableFingerprints;
  const tableDelta = new Set([
    'reactionTable',
    'reactionActivationWatchTable',
    'watchReactionTableSource',
    'watchReactionCount',
    'watchGasProductCount',
    'watchReactionTableFingerprint',
    'watchReactionTableDomainFingerprint'
  ]);
  if (
    sourceTables.reactionTable !== null
    || !nonEmptyString(sourceTables.reactionActivationWatchTable)
    || sourceTables.watchReactionTableSource
      !== 'reaction-activation-watch-table'
    || !nonEmptyString(targetTables.reactionTable)
    || targetTables.reactionActivationWatchTable !== null
    || targetTables.watchReactionTableSource !== 'reaction-table'
    || !valuesEqualExcept(sourceTables, targetTables, tableDelta)
    || sourceTables.watchReactionCount !== targetTables.watchReactionCount
    || sourceTables.watchGasProductCount
      !== targetTables.watchGasProductCount
    || sourceTables.watchReactionTableFingerprint
      !== targetTables.watchReactionTableFingerprint
    || sourceTables.watchReactionTableDomainFingerprint
      !== targetTables.watchReactionTableDomainFingerprint
    || !Number.isSafeInteger(sourceTables.watchReactionCount)
    || sourceTables.watchReactionCount < 1
    || !nonEmptyString(sourceTables.watchReactionTableFingerprint)
    || !nonEmptyString(sourceTables.watchReactionTableDomainFingerprint)
  ) return false;

  return valuesEqualExcept(
    source.motionEnvelope,
    target.motionEnvelope,
    new Set([
      'separationDisplacementEnabled',
      'contactCorrectionEnabled'
    ])
  )
    && source.motionEnvelope.contactCorrectionEnabled
      === sourceWriters.contactSolver
    && target.motionEnvelope.contactCorrectionEnabled === true
    && source.motionEnvelope.separationDisplacementEnabled
      === (sourceWriters.contactSolver !== true)
    && target.motionEnvelope.separationDisplacementEnabled === false;
}

function exactRetainedProductGasBoundaryTransition(
  sourceConfiguration,
  targetConfiguration
) {
  const source = exactSchroederTargetScheduleConfiguration(
    sourceConfiguration
  );
  const target = exactSchroederTargetScheduleConfiguration(
    targetConfiguration
  );
  if (
    !source
    || !target
    || source.status !== 'target-schedule-configuration-ready'
    || target.status !== 'target-schedule-configuration-ready'
    || !valuesEqual(
      source.scheduleStepOptionsProvider,
      target.scheduleStepOptionsProvider
    )
    || !valuesEqual(source.tableFingerprints, target.tableFingerprints)
  ) return false;

  const sourceWriters = source.writerSet;
  const targetWriters = target.writerSet;
  const writerDelta = new Set([
    'retainedProductGasBoundaryActionable',
    'gasBoundaryActionable',
    'phaseVolumeSidecars',
    'mechanicsFieldViews',
    'writerIds'
  ]);
  if (
    sourceWriters.reaction !== true
    || targetWriters.reaction !== true
    || sourceWriters.retainedProductGasBoundaryActionable !== false
    || targetWriters.retainedProductGasBoundaryActionable !== true
    || targetWriters.gasBoundaryActionable !== true
    || targetWriters.mechanicsFieldViews !== true
    || !valuesEqualExcept(sourceWriters, targetWriters, writerDelta)
  ) return false;

  // Product evidence is sampled only after the complete source schedule and
  // its terminal GPU fence. The presealed target therefore changes the gas
  // writer set at the NEXT schedule boundary even when the source batch has
  // multiple steps; it never mutates a writer inside the sealed source batch.
  return valuesEqual(source.motionEnvelope, target.motionEnvelope);
}

function prospectiveDynamicLawTransitionFingerprint(value) {
  const {
    transitionFingerprint: ignoredFingerprint,
    ...content
  } = value;
  return textFingerprint(
    stableToken(content),
    'schroeder-prospective-dynamic-law-transition-v1'
  );
}

export function createSchroederProspectiveDynamicLawTransition({
  sourceScheduleId,
  targetScheduleRequestId,
  laneId,
  stateKey,
  sourceConfiguration,
  targetConfiguration
} = {}) {
  const resolvedSourceScheduleId = nonEmptyString(sourceScheduleId);
  const resolvedTargetScheduleRequestId = nonEmptyString(
    targetScheduleRequestId
  );
  const resolvedLaneId = nonEmptyString(laneId);
  const resolvedStateKey = nonEmptyString(stateKey);
  const source = exactSchroederTargetScheduleConfiguration(
    sourceConfiguration
  );
  const target = exactSchroederTargetScheduleConfiguration(
    targetConfiguration
  );
  if (
    !resolvedSourceScheduleId
    || !resolvedTargetScheduleRequestId
    || resolvedSourceScheduleId === resolvedTargetScheduleRequestId
    || !resolvedLaneId
    || !resolvedStateKey
    || !source
    || !target
  ) {
    throw new TypeError(
      'prospective dynamic-law transition requires exact identity and configurations'
    );
  }
  const reactionTransition =
    exactDormantReactionWatchToExecutingReactionTransition(source, target);
  const retainedProductGasTransition =
    exactRetainedProductGasBoundaryTransition(source, target);
  if (!reactionTransition && !retainedProductGasTransition) {
    throw new TypeError(
      'prospective dynamic-law transition requires one exact admitted writer delta'
    );
  }
  const kind = reactionTransition
    ? SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_KIND
    : SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND;
  const lawFamily = reactionTransition ? 'reaction' : 'gas-pressure';
  const activationPolicy = reactionTransition
    ? SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_POLICY
    : SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_POLICY;
  const transition = {
    schema: ULG_SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_SCHEMA,
    status: 'prospective-dynamic-law-transition-sealed',
    kind,
    revision: SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_REVISION,
    lawFamily,
    sourceScheduleId: resolvedSourceScheduleId,
    targetScheduleRequestId: resolvedTargetScheduleRequestId,
    laneId: resolvedLaneId,
    stateKey: resolvedStateKey,
    sourceConfiguration: structuredClone(source),
    targetConfiguration: structuredClone(target),
    activationPolicy,
    transitionFingerprint: null,
    shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
    routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
    executionGating: SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE
  };
  transition.transitionFingerprint =
    prospectiveDynamicLawTransitionFingerprint(transition);
  return deepFreeze(transition);
}

export function exactSchroederProspectiveDynamicLawTransition(value) {
  const reactionTransition = Boolean(
    value?.kind === SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_KIND
    && value?.lawFamily === 'reaction'
    && value?.activationPolicy
      === SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_POLICY
    && exactDormantReactionWatchToExecutingReactionTransition(
      value?.sourceConfiguration,
      value?.targetConfiguration
    )
  );
  const retainedProductGasTransition = Boolean(
    value?.kind
      === SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND
    && value?.lawFamily === 'gas-pressure'
    && value?.activationPolicy
      === SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_POLICY
    && exactRetainedProductGasBoundaryTransition(
      value?.sourceConfiguration,
      value?.targetConfiguration
    )
  );
  if (
    !objectHasExactKeys(value, PROSPECTIVE_DYNAMIC_LAW_TRANSITION_KEYS)
    || value.schema
      !== ULG_SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_SCHEMA
    || value.status !== 'prospective-dynamic-law-transition-sealed'
    || value.revision !== SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_REVISION
    || (!reactionTransition && !retainedProductGasTransition)
    || !nonEmptyString(value.sourceScheduleId)
    || !nonEmptyString(value.targetScheduleRequestId)
    || value.sourceScheduleId === value.targetScheduleRequestId
    || !nonEmptyString(value.laneId)
    || !nonEmptyString(value.stateKey)
    || !exactSchroederTargetScheduleConfiguration(value.sourceConfiguration)
    || !exactSchroederTargetScheduleConfiguration(value.targetConfiguration)
    || !nonEmptyString(value.transitionFingerprint)
    || value.shadowOnly !== SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    || value.routingAuthority !== SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    || value.executionGating !== SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE
  ) return null;
  try {
    return prospectiveDynamicLawTransitionFingerprint(value)
      === value.transitionFingerprint
      ? value
      : null;
  } catch {
    return null;
  }
}

function targetScheduleConfigurationFromAuthority(authority) {
  return targetScheduleConfigurationFromParts({
    motionEnvelope: authority.motionEnvelope,
    writerSet: authority.writerSet,
    scheduleStepOptionsProvider: authority.scheduleStepOptionsProvider,
    tableFingerprints: authority.tableFingerprints
  });
}

function observationAuthorizesProspectiveTransition(
  observation,
  transition = null
) {
  const writerEvidence = observation?.prospectiveWriterEvidence;
  const terminalScheduleStructurallyAdmitted = Boolean(
    writerEvidence?.terminalGpuFenceSatisfied === true
    && writerEvidence?.scheduleCancelled === false
  );
  const exactTransition = transition == null
    ? null
    : exactSchroederProspectiveDynamicLawTransition(transition);
  if (
    exactTransition?.kind
      === SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND
  ) {
    const liveBound = writerEvidence?.productHistoryLiveBoundObservation;
    const arenaIdentity = writerEvidence?.productHistoryArenaIdentity;
    return Boolean(
      terminalScheduleStructurallyAdmitted
      && writerEvidence?.gasBoundaryActionable === true
      && writerEvidence.productEventBufferRetained === true
      && writerEvidence.terminalGpuFenceSatisfied === true
      && writerEvidence.scheduleCancelled === false
      && Number.isSafeInteger(writerEvidence.productEventRowCount)
      && writerEvidence.productEventRowCount > 0
      && arenaIdentity?.schema
        === 'peercompute.ulg.sph-resident-product-history-arena-identity.v0'
      && arenaIdentity.status
        === 'retained-product-history-arena-authenticated'
      && arenaIdentity.rowCapacity === writerEvidence.productEventRowCount
      && Number.isSafeInteger(arenaIdentity.countAuthorityGeneration)
      && arenaIdentity.countAuthorityGeneration > 0
      && Number.isSafeInteger(arenaIdentity.countAuthoritySeal)
      && arenaIdentity.countAuthoritySeal > 0
      && (
        liveBound == null
        || (
          liveBound.schema
            === 'peercompute.ulg.sph-product-history-live-bound-observation.v0'
          && Number.isSafeInteger(liveBound.observedLiveRowCount)
          && liveBound.observedLiveRowCount >= 0
          && liveBound.arenaRowCapacity === writerEvidence.productEventRowCount
          && liveBound.readbackByteLength === Uint32Array.BYTES_PER_ELEMENT
          && valuesEqual(liveBound.arenaIdentity, arenaIdentity)
        )
      )
    );
  }
  return Boolean(
    terminalScheduleStructurallyAdmitted
    && observation
    && (
      (
        observation.uncertainty === true
        && observation.failureReason
          !== 'reaction-activation-observation-not-sampled-after-partial-cancellation'
      )
      || (
        observation.observationSucceeded === true
        && observation.triggered === true
        && Number.isSafeInteger(observation.triggeredSourceCount)
        && observation.triggeredSourceCount > 0
      )
    )
  );
}

function observationBindsTargetScheduleAuthorityExecution(
  observation,
  authority
) {
  const exactAuthority = exactSchroederTargetScheduleAuthority(authority);
  const exactObservation = exactPredecessorDynamicLawObservation(observation);
  if (!exactAuthority || !exactObservation) return false;
  const sourceConfiguration = targetScheduleConfigurationFromAuthority(
    exactAuthority
  );
  return exactObservation.sourceScheduleId === exactAuthority.sourceScheduleId
    && exactObservation.targetScheduleRequestId
      === exactAuthority.targetScheduleRequestId
    && exactObservation.targetScheduleAuthorityFingerprint
      === exactAuthority.requestFingerprint
    && exactObservation.laneId === exactAuthority.laneId
    && exactObservation.stateKey === exactAuthority.stateKey
    && observationMatchesConfiguration(
      exactObservation,
      sourceConfiguration,
      { allowUnmeasuredUncertainty: true }
    );
}

function observationMatchesConfiguration(
  observation,
  configuration,
  { allowUnmeasuredUncertainty = false } = {}
) {
  const exactObservation = exactPredecessorDynamicLawObservation(observation);
  const exactConfiguration = exactSchroederTargetScheduleConfiguration(
    configuration
  );
  if (!exactObservation || !exactConfiguration) return false;
  const tables = exactConfiguration.tableFingerprints;
  const uncertaintyMayOmitMeasurement = allowUnmeasuredUncertainty === true
    && exactObservation.uncertainty === true;
  return (
    uncertaintyMayOmitMeasurement
      ? (
          exactObservation.motionEnvelope === null
          || valuesEqual(
            exactObservation.motionEnvelope,
            exactConfiguration.motionEnvelope
          )
        )
      : valuesEqual(
          exactObservation.motionEnvelope,
          exactConfiguration.motionEnvelope
        )
  )
    && (
      uncertaintyMayOmitMeasurement
        ? (
            exactObservation.reactionCount === null
            || exactObservation.reactionCount === tables.watchReactionCount
          )
        : exactObservation.reactionCount === tables.watchReactionCount
    )
    && (
      uncertaintyMayOmitMeasurement
        ? (
            exactObservation.reactionTableFingerprint === null
            || exactObservation.reactionTableFingerprint
              === tables.watchReactionTableFingerprint
          )
        : exactObservation.reactionTableFingerprint
          === tables.watchReactionTableFingerprint
    );
}

export function schroederTargetScheduleSuccessorGasBoundaryActionable({
  predecessorTargetScheduleAuthority = null,
  predecessorDynamicLawObservation = null
} = {}) {
  const authority = exactSchroederTargetScheduleAuthority(
    predecessorTargetScheduleAuthority
  );
  const observation = exactPredecessorDynamicLawObservation(
    predecessorDynamicLawObservation
  );
  if (!authority || !observation) return false;
  const sourceConfiguration = targetScheduleConfigurationFromAuthority(
    authority
  );
  if (
    observation.sourceScheduleId !== authority.sourceScheduleId
    || observation.targetScheduleRequestId
      !== authority.targetScheduleRequestId
    || observation.targetScheduleAuthorityFingerprint
      !== authority.requestFingerprint
    || observation.laneId !== authority.laneId
    || observation.stateKey !== authority.stateKey
    || !observationMatchesConfiguration(
      observation,
      sourceConfiguration,
      { allowUnmeasuredUncertainty: true }
    )
  ) return false;
  // Current particle candidates and retained product history are independent
  // sources in the union. Only the dedicated retained bit may carry product
  // authority; a particle-only gas writer can never masquerade as history.
  if (authority.writerSet.retainedProductGasBoundaryActionable === true) {
    return true;
  }
  const transition = exactSchroederProspectiveDynamicLawTransition(
    authority.prospectiveDynamicLawTransition
  );
  return Boolean(
    transition?.kind
      === SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND
    && observationAuthorizesProspectiveTransition(observation, transition)
  );
}

export function schroederTargetScheduleSuccessorReactionExecutionRequired({
  predecessorTargetScheduleAuthority = null,
  predecessorDynamicLawObservation = null
} = {}) {
  const authority = exactSchroederTargetScheduleAuthority(
    predecessorTargetScheduleAuthority
  );
  const observation = exactPredecessorDynamicLawObservation(
    predecessorDynamicLawObservation
  );
  if (
    !authority
    || !observation
    || !observationBindsTargetScheduleAuthorityExecution(
      observation,
      authority
    )
    || observation.prospectiveWriterEvidence.terminalGpuFenceSatisfied
      !== true
    || observation.prospectiveWriterEvidence.scheduleCancelled !== false
  ) return false;
  if (authority.writerSet.reaction === true) return true;
  const sourceConfiguration = targetScheduleConfigurationFromAuthority(
    authority
  );
  const transition = exactSchroederProspectiveDynamicLawTransition(
    authority.prospectiveDynamicLawTransition
  );
  return Boolean(
    transition?.kind === SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_KIND
    && transition.sourceScheduleId === authority.sourceScheduleId
    && transition.targetScheduleRequestId
      === authority.targetScheduleRequestId
    && transition.laneId === authority.laneId
    && transition.stateKey === authority.stateKey
    && valuesEqual(transition.sourceConfiguration, sourceConfiguration)
    && observationAuthorizesProspectiveTransition(observation, transition)
  );
}

function prospectiveTransitionMatchesAuthoritySource(transition, authority) {
  if (transition == null) return true;
  const exactTransition = exactSchroederProspectiveDynamicLawTransition(
    transition
  );
  return Boolean(
    exactTransition
    && exactTransition.sourceScheduleId === authority.sourceScheduleId
    && exactTransition.targetScheduleRequestId
      === authority.targetScheduleRequestId
    && exactTransition.laneId === authority.laneId
    && exactTransition.stateKey === authority.stateKey
    && valuesEqual(
      exactTransition.sourceConfiguration,
      targetScheduleConfigurationFromAuthority(authority)
    )
  );
}

function predecessorTransitionMatchesAuthorityTarget(transition, authority) {
  if (transition == null) return true;
  const exactTransition = exactSchroederProspectiveDynamicLawTransition(
    transition
  );
  const observation = exactPredecessorDynamicLawObservation(
    authority.predecessorDynamicLawObservation
  );
  return Boolean(
    exactTransition
    && observation
    && exactTransition.sourceScheduleId === observation.sourceScheduleId
    && exactTransition.targetScheduleRequestId === authority.sourceScheduleId
    && exactTransition.targetScheduleRequestId
      === observation.targetScheduleRequestId
    && exactTransition.laneId === authority.laneId
    && exactTransition.stateKey === authority.stateKey
    && observationAuthorizesProspectiveTransition(
      observation,
      exactTransition
    )
    && observationMatchesConfiguration(
      observation,
      exactTransition.sourceConfiguration,
      { allowUnmeasuredUncertainty: true }
    )
    && valuesEqual(
      exactTransition.targetConfiguration,
      targetScheduleConfigurationFromAuthority(authority)
    )
  );
}

function targetAuthorityFingerprint(value) {
  const {
    requestFingerprint: ignoredFingerprint,
    ...content
  } = value;
  return textFingerprint(
    stableToken(content),
    'schroeder-target-schedule-authority-v7'
  );
}

export function createSchroederTargetScheduleAuthority({
  sourceScheduleId,
  targetScheduleRequestId,
  laneId,
  stateKey,
  sourceLineage,
  sourceParticleCount,
  sourcePhaseLaneCount,
  predecessorDynamicLawObservation = null,
  predecessorTargetScheduleAuthority = null,
  prospectiveTargetConfiguration = null,
  currentTargetConfiguration = null,
  maxFutureSubsteps,
  dtS,
  gridSpacingM,
  cflFactor,
  boxDimsM,
  residentStepOptions = null,
  epochOptions = null,
  mechanicsOptions = null,
  hierarchyConfig = null,
  scheduleStepOptionsProvider = null,
  particleGasLedgerActionable = null
} = {}) {
  if (
    particleGasLedgerActionable != null
    && typeof particleGasLedgerActionable !== 'boolean'
  ) {
    throw new TypeError(
      'particleGasLedgerActionable must be an exact boolean'
    );
  }
  const resolvedSourceScheduleId = nonEmptyString(sourceScheduleId);
  const resolvedTargetRequestId = nonEmptyString(targetScheduleRequestId);
  const resolvedLaneId = nonEmptyString(laneId);
  const resolvedStateKey = nonEmptyString(stateKey);
  const lineage = exactLineage(sourceLineage);
  if (
    !resolvedSourceScheduleId
    || !resolvedTargetRequestId
    || resolvedSourceScheduleId === resolvedTargetRequestId
    || !resolvedLaneId
    || !resolvedStateKey
    || !lineage
  ) {
    throw new TypeError(
      'target schedule authority requires exact schedule/lane/state/source-lineage identity'
    );
  }
  if (
    !Number.isSafeInteger(sourceParticleCount)
    || sourceParticleCount < 1
    || sourceParticleCount > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
  ) {
    throw new RangeError(
      'sourceParticleCount must be an exact positive f32/u32 integer'
    );
  }
  if (![1, 4].includes(sourcePhaseLaneCount)) {
    throw new RangeError('sourcePhaseLaneCount must be exactly 1 or 4');
  }
  const predecessorObservation = predecessorDynamicLawObservation == null
    ? null
    : exactPredecessorDynamicLawObservation(
        predecessorDynamicLawObservation
      );
  if (
    predecessorDynamicLawObservation != null
    && !predecessorObservation
  ) {
    throw new TypeError(
      'predecessorDynamicLawObservation must be an exact admitted observation'
    );
  }
  const predecessorAuthority = predecessorTargetScheduleAuthority == null
    ? null
    : exactSchroederTargetScheduleAuthority(
        predecessorTargetScheduleAuthority
      );
  if (predecessorTargetScheduleAuthority != null && !predecessorAuthority) {
    throw new TypeError(
      'predecessorTargetScheduleAuthority must be an exact authority'
    );
  }
  if (predecessorAuthority != null && predecessorObservation == null) {
    throw new TypeError(
      'predecessorTargetScheduleAuthority requires its exact dynamic-law observation'
    );
  }
  // This bit can only enter through an exact worker observation whose clone is
  // compared with the worker-retained original before execution. It lets the
  // main author either carry an already-active writer set or consume a
  // presealed product/gas transition. Physical product evidence alone cannot
  // activate an unsealed multi-step schedule.
  const retainedProductGasBoundaryActionable =
    schroederTargetScheduleSuccessorGasBoundaryActionable({
      predecessorTargetScheduleAuthority: predecessorAuthority,
      predecessorDynamicLawObservation: predecessorObservation
    });
  const precomputedCurrentConfiguration = currentTargetConfiguration == null
    ? null
    : exactSchroederTargetScheduleConfiguration(
        currentTargetConfiguration
      );
  if (
    currentTargetConfiguration != null
    && !precomputedCurrentConfiguration
  ) {
    throw new TypeError(
      'currentTargetConfiguration must be an exact target schedule configuration'
    );
  }
  if (
    precomputedCurrentConfiguration
    && [
      maxFutureSubsteps,
      dtS,
      gridSpacingM,
      cflFactor,
      boxDimsM,
      residentStepOptions,
      epochOptions,
      mechanicsOptions,
      hierarchyConfig,
      scheduleStepOptionsProvider,
      particleGasLedgerActionable
    ].some((value) => value != null)
  ) {
    throw new TypeError(
      'currentTargetConfiguration is mutually exclusive with raw configuration inputs'
    );
  }
  const currentConfiguration = precomputedCurrentConfiguration
    || createSchroederTargetScheduleConfiguration({
      maxFutureSubsteps,
      dtS,
      gridSpacingM,
      cflFactor,
      boxDimsM,
      residentStepOptions,
      epochOptions,
      mechanicsOptions,
      hierarchyConfig,
      scheduleStepOptionsProvider,
      particleGasLedgerActionable: particleGasLedgerActionable === true,
      retainedProductGasBoundaryActionable
    });
  if (
    precomputedCurrentConfiguration
    && retainedProductGasBoundaryActionable
    && precomputedCurrentConfiguration.writerSet
      .retainedProductGasBoundaryActionable
      !== true
  ) {
    throw new TypeError(
      'currentTargetConfiguration gas-boundary actionability does not match predecessor authority'
    );
  }
  let predecessorTransition = null;
  if (predecessorAuthority && predecessorObservation) {
    const predecessorConfiguration =
      targetScheduleConfigurationFromAuthority(predecessorAuthority);
    if (!valuesEqual(predecessorConfiguration, currentConfiguration)) {
      const transition = exactSchroederProspectiveDynamicLawTransition(
        predecessorAuthority.prospectiveDynamicLawTransition
      );
      if (
        !transition
        || !valuesEqual(
          transition.sourceConfiguration,
          predecessorConfiguration
        )
        || !valuesEqual(
          transition.targetConfiguration,
          currentConfiguration
        )
        || !observationAuthorizesProspectiveTransition(
          predecessorObservation,
          transition
        )
      ) {
        throw new TypeError(
          'the changed target configuration was not prospectively authorized by its predecessor'
        );
      }
      predecessorTransition = structuredClone(transition);
    }
  }
  const prospectiveTransition = prospectiveTargetConfiguration == null
    ? null
    : createSchroederProspectiveDynamicLawTransition({
        sourceScheduleId: resolvedSourceScheduleId,
        targetScheduleRequestId: resolvedTargetRequestId,
        laneId: resolvedLaneId,
        stateKey: resolvedStateKey,
        sourceConfiguration: currentConfiguration,
        targetConfiguration: prospectiveTargetConfiguration
      });
  const {
    motionEnvelope,
    writerSet,
    scheduleStepOptionsProvider: provider,
    tableFingerprints
  } = currentConfiguration;
  const authority = {
    schema: ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA,
    status: writerSet.complete
      ? 'target-schedule-authority-ready'
      : 'target-schedule-authority-incomplete',
    authorityRevision: SCHROEDER_TARGET_SCHEDULE_REQUEST_REVISION,
    sourceScheduleId: resolvedSourceScheduleId,
    targetScheduleRequestId: resolvedTargetRequestId,
    laneId: resolvedLaneId,
    stateKey: resolvedStateKey,
    sourceLineage: lineage,
    sourceParticleCount,
    sourcePhaseLaneCount,
    predecessorDynamicLawObservation: predecessorObservation == null
      ? null
      : structuredClone(predecessorObservation),
    predecessorDynamicLawTransition: predecessorTransition,
    prospectiveDynamicLawTransition: prospectiveTransition,
    motionEnvelope,
    writerSet,
    scheduleStepOptionsProvider: provider,
    tableFingerprints,
    requestFingerprint: null,
    shadowOnly: SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY,
    routingAuthority: SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY,
    executionGating: SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE
  };
  if (!predecessorObservationMatchesAuthority(
    authority.predecessorDynamicLawObservation,
    authority
  )) {
    throw new TypeError(
      'predecessorDynamicLawObservation does not match the target schedule source authority'
    );
  }
  authority.requestFingerprint = targetAuthorityFingerprint(authority);
  const sealedAuthority = deepFreeze(authority);
  if (predecessorAuthority) {
    const continuity = validateSchroederTargetScheduleConfigurationContinuity({
      predecessorTargetScheduleAuthority: predecessorAuthority,
      currentTargetScheduleAuthority: sealedAuthority,
      predecessorDynamicLawObservation: predecessorObservation
    });
    if (continuity.ready !== true) {
      throw new TypeError(
        `predecessor target configuration continuity failed: ${continuity.reason}`
      );
    }
  }
  return sealedAuthority;
}

export function exactSchroederTargetScheduleAuthority(value) {
  if (
    !objectHasExactKeys(value, TARGET_AUTHORITY_KEYS)
    || value.schema !== ULG_SCHROEDER_TARGET_SCHEDULE_AUTHORITY_SCHEMA
    || value.authorityRevision !== SCHROEDER_TARGET_SCHEDULE_REQUEST_REVISION
    || ![
      'target-schedule-authority-ready',
      'target-schedule-authority-incomplete'
    ].includes(value.status)
    || !nonEmptyString(value.sourceScheduleId)
    || !nonEmptyString(value.targetScheduleRequestId)
    || value.sourceScheduleId === value.targetScheduleRequestId
    || !nonEmptyString(value.laneId)
    || !nonEmptyString(value.stateKey)
    || !exactLineage(value.sourceLineage)
    || !Number.isSafeInteger(value.sourceParticleCount)
    || value.sourceParticleCount < 1
    || value.sourceParticleCount
      > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
    || ![1, 4].includes(value.sourcePhaseLaneCount)
    || !(
      value.predecessorDynamicLawObservation === null
      || exactPredecessorDynamicLawObservation(
        value.predecessorDynamicLawObservation
      )
    )
    || !(
      value.predecessorDynamicLawTransition === null
      || exactSchroederProspectiveDynamicLawTransition(
        value.predecessorDynamicLawTransition
      )
    )
    || !(
      value.prospectiveDynamicLawTransition === null
      || exactSchroederProspectiveDynamicLawTransition(
        value.prospectiveDynamicLawTransition
      )
    )
    || !isSphReactionMotionEnvelopeReceipt(value.motionEnvelope)
    || !exactSchroederTargetScheduleWriterSet(value.writerSet)
    || !exactSchroederTargetScheduleProviderAuthority(
      value.scheduleStepOptionsProvider
    )
    || !exactSchroederTargetScheduleTableFingerprints(
      value.tableFingerprints
    )
    || !nonEmptyString(value.requestFingerprint)
    || value.shadowOnly !== SCHROEDER_DYNAMIC_LAW_ROUTING_SHADOW_ONLY
    || value.routingAuthority !== SCHROEDER_DYNAMIC_LAW_ROUTING_AUTHORITY
    || value.executionGating !== SCHROEDER_TARGET_SCHEDULE_EXECUTION_GATE
    || value.status !== (value.writerSet.complete
      ? 'target-schedule-authority-ready'
      : 'target-schedule-authority-incomplete')
    || value.writerSet.scheduleStepOptionsProviderMayWrite
      !== value.scheduleStepOptionsProvider.mayActivateDynamicWriters
    || value.writerSet.complete
      !== value.scheduleStepOptionsProvider.writerSetComplete
    || value.motionEnvelope.contactCorrectionEnabled
      !== value.writerSet.contactSolver
    || value.motionEnvelope.separationDisplacementEnabled
      === value.writerSet.contactSolver
    || value.motionEnvelope.thermalPhaseEvolutionEnabled
      !== value.writerSet.thermalPhaseEvolutionEnabled
    || !prospectiveTransitionMatchesAuthoritySource(
      value.prospectiveDynamicLawTransition,
      value
    )
    || !predecessorTransitionMatchesAuthorityTarget(
      value.predecessorDynamicLawTransition,
      value
    )
    || !predecessorObservationMatchesAuthority(
      value.predecessorDynamicLawObservation,
      value
    )
  ) return null;
  try {
    return targetAuthorityFingerprint(value) === value.requestFingerprint
      ? value
      : null;
  } catch {
    return null;
  }
}

function targetScheduleConfigurationContinuityFailure(reason) {
  return Object.freeze({ ready: false, reason });
}

export function validateSchroederTargetScheduleConfigurationContinuity({
  predecessorTargetScheduleAuthority,
  currentTargetScheduleAuthority,
  predecessorDynamicLawObservation = null
} = {}) {
  const predecessorAuthority = exactSchroederTargetScheduleAuthority(
    predecessorTargetScheduleAuthority
  );
  const currentAuthority = exactSchroederTargetScheduleAuthority(
    currentTargetScheduleAuthority
  );
  const observation = exactPredecessorDynamicLawObservation(
    predecessorDynamicLawObservation
      ?? currentAuthority?.predecessorDynamicLawObservation
  );
  if (!predecessorAuthority || !currentAuthority || !observation) {
    return targetScheduleConfigurationContinuityFailure(
      'configuration-continuity-schema'
    );
  }
  if (!valuesEqual(
    currentAuthority.predecessorDynamicLawObservation,
    observation
  )) {
    return targetScheduleConfigurationContinuityFailure(
      'configuration-continuity-observation'
    );
  }
  if (
    predecessorAuthority.sourceScheduleId !== observation.sourceScheduleId
    || predecessorAuthority.targetScheduleRequestId
      !== currentAuthority.sourceScheduleId
    || predecessorAuthority.targetScheduleRequestId
      !== observation.targetScheduleRequestId
    || predecessorAuthority.requestFingerprint
      !== observation.targetScheduleAuthorityFingerprint
    || predecessorAuthority.laneId !== currentAuthority.laneId
    || predecessorAuthority.laneId !== observation.laneId
    || predecessorAuthority.stateKey !== currentAuthority.stateKey
    || predecessorAuthority.stateKey !== observation.stateKey
    || !valuesEqual(
      currentAuthority.sourceLineage,
      observation.terminalLineage
    )
    || currentAuthority.sourceParticleCount !== observation.particleCount
  ) {
    return targetScheduleConfigurationContinuityFailure(
      'configuration-continuity-identity'
    );
  }

  const predecessorConfiguration =
    targetScheduleConfigurationFromAuthority(predecessorAuthority);
  const currentConfiguration =
    targetScheduleConfigurationFromAuthority(currentAuthority);
  const prospectiveTransition =
    exactSchroederProspectiveDynamicLawTransition(
      predecessorAuthority.prospectiveDynamicLawTransition
    );
  const reactionObservationRequiresProspectiveTransition = Boolean(
    predecessorConfiguration.writerSet.reaction === false
    && observationBindsTargetScheduleAuthorityExecution(
      observation,
      predecessorAuthority
    )
    && observationAuthorizesProspectiveTransition(observation)
  );
  if (
    reactionObservationRequiresProspectiveTransition
    && prospectiveTransition?.kind
      !== SCHROEDER_PROSPECTIVE_DYNAMIC_LAW_TRANSITION_KIND
  ) {
    return targetScheduleConfigurationContinuityFailure(
      'configuration-continuity-required-reaction-transition-missing'
    );
  }
  const prospectiveTransitionAuthorized = Boolean(
    prospectiveTransition
    && observationMatchesConfiguration(
      observation,
      predecessorConfiguration,
      { allowUnmeasuredUncertainty: true }
    )
    && observationAuthorizesProspectiveTransition(
      observation,
      prospectiveTransition
    )
  );
  if (valuesEqual(predecessorConfiguration, currentConfiguration)) {
    if (currentAuthority.predecessorDynamicLawTransition !== null) {
      return targetScheduleConfigurationContinuityFailure(
        'configuration-continuity-spurious-transition'
      );
    }
    if (prospectiveTransitionAuthorized) {
      return targetScheduleConfigurationContinuityFailure(
        'configuration-continuity-authorized-transition-not-consumed'
      );
    }
    return deepFreeze({
      ready: true,
      reason: null,
      mode: 'exact-configuration-continuation',
      predecessorConfigurationFingerprint:
        predecessorConfiguration.configurationFingerprint,
      currentConfigurationFingerprint:
        currentConfiguration.configurationFingerprint,
      prospectiveDynamicLawTransitionFingerprint: null,
      conservativeActivationRequired:
        observationAuthorizesProspectiveTransition(observation)
    });
  }

  const consumedTransition = exactSchroederProspectiveDynamicLawTransition(
    currentAuthority.predecessorDynamicLawTransition
  );
  if (
    !prospectiveTransition
    || !consumedTransition
    || !valuesEqual(prospectiveTransition, consumedTransition)
    || !valuesEqual(
      prospectiveTransition.sourceConfiguration,
      predecessorConfiguration
    )
    || !valuesEqual(
      prospectiveTransition.targetConfiguration,
      currentConfiguration
    )
    || !prospectiveTransitionAuthorized
  ) {
    return targetScheduleConfigurationContinuityFailure(
      'configuration-continuity-unsealed-transition'
    );
  }
  return deepFreeze({
    ready: true,
    reason: null,
    mode: prospectiveTransition.kind
      === SCHROEDER_PROSPECTIVE_RETAINED_PRODUCT_GAS_TRANSITION_KIND
      ? 'prospective-retained-product-gas-boundary-actionable'
      : 'prospective-reaction-dormant-to-executing',
    predecessorConfigurationFingerprint:
      predecessorConfiguration.configurationFingerprint,
    currentConfigurationFingerprint:
      currentConfiguration.configurationFingerprint,
    prospectiveDynamicLawTransitionFingerprint:
      prospectiveTransition.transitionFingerprint,
    conservativeActivationRequired: true
  });
}

export function schroederTargetScheduleAuthorityEquals(left, right) {
  return Boolean(
    exactSchroederTargetScheduleAuthority(left)
    && exactSchroederTargetScheduleAuthority(right)
    && valuesEqual(left, right)
  );
}

export function schroederTargetScheduleConfigurationReceipt(authority) {
  const exactAuthority = exactSchroederTargetScheduleAuthority(authority);
  return exactAuthority
    ? targetScheduleConfigurationFromAuthority(exactAuthority)
    : null;
}

export function schroederTargetScheduleWriterSetMatchesActivation(
  writerSet,
  activationReceipt
) {
  const exactWriterSet = exactSchroederTargetScheduleWriterSet(writerSet);
  return Boolean(
    exactWriterSet
    && plainObject(activationReceipt)
    && SCHROEDER_TARGET_SCHEDULE_ACTIVATION_FIELDS.every(
      (field) => exactWriterSet[field] === activationReceipt[field]
    )
  );
}

export function validateSchroederTargetScheduleAuthorityForExecution(
  authority,
  {
    sourceScheduleId,
    laneId,
    stateKey,
    sourceLineage,
    sourceParticleCount,
    sourcePhaseLaneCount,
    motionEnvelope,
    writerSet,
    scheduleStepOptionsProvider,
    tableFingerprints
  } = {}
) {
  const exactAuthority = exactSchroederTargetScheduleAuthority(authority);
  if (!exactAuthority) {
    return Object.freeze({ ready: false, reason: 'target-authority-schema' });
  }
  const expectedLineage = exactLineage(sourceLineage);
  if (
    exactAuthority.status !== 'target-schedule-authority-ready'
    || exactAuthority.sourceScheduleId !== sourceScheduleId
    || exactAuthority.laneId !== laneId
    || exactAuthority.stateKey !== stateKey
    || !expectedLineage
    || !valuesEqual(exactAuthority.sourceLineage, expectedLineage)
    || exactAuthority.sourceParticleCount !== sourceParticleCount
    || exactAuthority.sourcePhaseLaneCount !== sourcePhaseLaneCount
  ) {
    return Object.freeze({ ready: false, reason: 'target-authority-identity' });
  }
  if (!valuesEqual(exactAuthority.motionEnvelope, motionEnvelope)) {
    return Object.freeze({ ready: false, reason: 'target-authority-envelope' });
  }
  if (!valuesEqual(exactAuthority.writerSet, writerSet)) {
    return Object.freeze({ ready: false, reason: 'target-authority-writer-set' });
  }
  if (!valuesEqual(
    exactAuthority.scheduleStepOptionsProvider,
    scheduleStepOptionsProvider
  )) {
    return Object.freeze({ ready: false, reason: 'target-authority-provider' });
  }
  if (!valuesEqual(exactAuthority.tableFingerprints, tableFingerprints)) {
    return Object.freeze({ ready: false, reason: 'target-authority-tables' });
  }
  return Object.freeze({
    ready: true,
    reason: null,
    authority: exactAuthority
  });
}
