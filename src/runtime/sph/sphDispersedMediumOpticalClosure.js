import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  sphericalParticleOpticalEfficiencies
} from '../material/opticalClosure.js';
import {
  COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA,
  COLLECTIVE_OPTICAL_ROUTE_STATUS,
  collectiveOpticalRouteDescriptor
} from './sphOpticalRouteIdentity.js';

const EXACT_F32_INTEGER_MAX = 0x00ff_ffff;
const FOUR_PI_OVER_THREE = (4 * Math.PI) / 3;
const THREE_OVER_FOUR = 3 / 4;
const CLOSURE_TABLE_STATUS_EMPTY =
  'dispersed-medium-optical-closure-table-empty';
const CLOSURE_TABLE_STATUS_READY =
  'dispersed-medium-optical-closure-table-ready';
const CLOSURE_ROUTE_LOOKUP =
  'exact-dispersed-material-vapor-phase-condensed-phase-linear-scan';
const CLOSURE_MASS_AUTHORITY =
  'already-conserved-dispersed-condensed-mass';
const CANONICAL_ROUTE_IDENTITY = 'canonical-collective-optical-route';
const LOCAL_ROUTE_IDENTITY = 'closure-table-local-numeric-route';

const CLOSURE_PHYSICAL_FIELDS = Object.freeze([
  'condensedDensityKgPerM3',
  'scatteringEfficiencyQsca',
  'absorptionEfficiencyQabs',
  'asymmetryFactorG',
  'effectiveRadiusM',
  'relativeRefractiveIndexN',
  'relativeExtinctionCoefficientK',
  'largeSizeRayAsymmetryFactorG',
  'referenceWavelengthM'
]);

const UNVALIDATED_PROVENANCE_STATUSES = new Set([
  'blocked',
  'evidence-only',
  'model-unvalidated',
  'reduced-estimate',
  'reference-fallback',
  'unvalidated'
]);

const MORPHOLOGY_MODEL_ID_BY_LABEL = new Map([
  [
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS.blocked,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked
  ],
  [
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
      .singleCompactCondensateCarrierLowerBound,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
      .singleCompactCondensateCarrierLowerBound
  ],
  [
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS.monodisperseRadius,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
  ],
  [
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
      .singleCompactSphereComplexIndex,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
      .singleCompactSphereComplexIndex
  ]
]);

const MORPHOLOGY_MODEL_LABEL_BY_ID = new Map(
  [...MORPHOLOGY_MODEL_ID_BY_LABEL.entries()].map(([label, id]) => [id, label])
);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function finiteF32(value, label) {
  const number = Number(value);
  const rounded = Math.fround(number);
  if (!Number.isFinite(number) || !Number.isFinite(rounded)) {
    throw new RangeError(`${label} must be representable as a finite f32`);
  }
  return rounded;
}

function nonnegativeF32(value, label) {
  const number = finiteF32(value, label);
  if (number < 0) {
    throw new RangeError(`${label} must be nonnegative`);
  }
  return number === 0 ? 0 : number;
}

function exactF32Identifier(value, label, { positive = true } = {}) {
  const number = Number(value);
  const minimum = positive ? 1 : 0;
  if (
    !Number.isInteger(number)
    || number < minimum
    || number > EXACT_F32_INTEGER_MAX
    || Math.fround(number) !== number
  ) {
    throw new RangeError(
      `${label} must be an ${positive ? 'positive' : 'nonnegative'} exact f32 integer`
    );
  }
  return number;
}

function canonicalClosureStatus(value, label) {
  if (value == null) return null;
  const status = Number(value);
  if (
    status !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready
    && status !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked
  ) {
    throw new RangeError(
      `${label} must be ready (${SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready}) `
      + `or blocked (${SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked})`
    );
  }
  return status;
}

function morphologyModelId(value) {
  if (typeof value === 'string') {
    return MORPHOLOGY_MODEL_ID_BY_LABEL.get(value)
      ?? SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked;
  }
  const modelId = Number(value);
  return MORPHOLOGY_MODEL_LABEL_BY_ID.has(modelId)
    ? modelId
    : SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked;
}

function parsedMorphologyModelId(value) {
  if (typeof value === 'string') {
    return MORPHOLOGY_MODEL_ID_BY_LABEL.has(value)
      ? MORPHOLOGY_MODEL_ID_BY_LABEL.get(value)
      : null;
  }
  const modelId = Number(value);
  return MORPHOLOGY_MODEL_LABEL_BY_ID.has(modelId) ? modelId : null;
}

function resolvedMorphologyModel(entry, closureInput, prefix) {
  const aliases = [];
  for (const [owner, value] of [
    ['route.morphologyModelId', entry.morphologyModelId],
    ['route.closureModelId', entry.closureModelId],
    ['route.morphologyModel', entry.morphologyModel],
    ['route.closureModel', entry.closureModel],
    ['closure.morphologyModelId', closureInput?.morphologyModelId],
    ['closure.closureModelId', closureInput?.closureModelId],
    ['closure.morphologyModel', closureInput?.morphologyModel],
    ['closure.closureModel', closureInput?.closureModel]
  ]) {
    if (value != null) aliases.push({ owner, value, modelId: parsedMorphologyModelId(value) });
  }
  if (aliases.length === 0) {
    return {
      modelId: SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked,
      invalid: false
    };
  }
  const invalid = aliases.filter((alias) => alias.modelId == null);
  const ids = new Set(aliases.map((alias) => alias.modelId).filter((id) => id != null));
  if (ids.size > 1 || (invalid.length > 0 && aliases.length > 1)) {
    throw new RangeError(
      `${prefix} morphology aliases identify conflicting or invalid models`
    );
  }
  return {
    modelId: invalid.length > 0
      ? SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked
      : aliases[0].modelId,
    invalid: invalid.length > 0
  };
}

function explicitClosureInput(entry, prefix) {
  const direct = hasOwn(entry, 'dispersedMediumOpticalClosure')
    ? entry.dispersedMediumOpticalClosure
    : null;
  const fromProperties = entry.properties?.dispersedMediumOpticalClosure ?? null;
  if (direct != null && fromProperties != null && direct !== fromProperties) {
    throw new RangeError(
      `${prefix} must not carry two distinct typed dispersed-medium optical closures`
    );
  }
  const nested = direct ?? fromProperties;
  if (nested == null) {
    return { closureInput: null, invalidReason: null };
  }
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return {
      closureInput: null,
      invalidReason: `${prefix}.dispersedMediumOpticalClosure-not-an-object`
    };
  }
  if (nested.schema !== ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA) {
    return {
      closureInput: null,
      invalidReason: `${prefix}.dispersedMediumOpticalClosure-schema-mismatch`
    };
  }
  return { closureInput: nested, invalidReason: null };
}

function closureField(entry, closureInput, key, prefix) {
  if (closureInput) {
    if (hasOwn(entry, key)) {
      if (!hasOwn(closureInput, key)) {
        throw new RangeError(
          `${prefix}.${key} must be declared by the typed closure`
        );
      }
      if (Number(entry[key]) !== Number(closureInput[key])) {
        throw new RangeError(
          `${prefix}.${key} conflicts with the authoritative typed closure`
        );
      }
    }
    return closureInput[key];
  }
  return entry[key];
}

function assertNoScientificValidationClaim(value, label) {
  if (value != null && value !== false) {
    throw new RangeError(`${label} must be exactly false when present`);
  }
}

function assertUnvalidatedProvenanceTree(value, label, seen = new Set()) {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) throw new TypeError(`${label} must not contain cycles`);
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    const itemLabel = `${label}.${key}`;
    if (key === 'scientificValidation') {
      assertNoScientificValidationClaim(item, itemLabel);
    }
    if (
      key === 'status'
      && item != null
      && !UNVALIDATED_PROVENANCE_STATUSES.has(item)
    ) {
      throw new RangeError(`${itemLabel} must be explicitly unvalidated`);
    }
    if (item && typeof item === 'object') {
      assertUnvalidatedProvenanceTree(item, itemLabel, seen);
    }
  }
  seen.delete(value);
}

function validateClosureProvenance(value, label) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  assertUnvalidatedProvenanceTree(value, label);
  if (value.blockers != null && !Array.isArray(value.blockers)) {
    throw new TypeError(`${label}.blockers must be an array`);
  }
  return value;
}

function closureProvenance(entry, closureInput, prefix) {
  const direct = entry.dispersedMediumOpticalClosureProvenance ?? null;
  if (closureInput && direct != null && direct !== closureInput.provenance) {
    throw new RangeError(
      `${prefix}.dispersedMediumOpticalClosureProvenance conflicts with the typed closure`
    );
  }
  const value = validateClosureProvenance(
    closureInput?.provenance ?? direct,
    `${prefix}.dispersedMediumOpticalClosure.provenance`
  );
  if (value == null) return null;
  const blockers = value.blockers == null
    ? Object.freeze([])
    : Object.freeze(value.blockers.map((blocker) => String(blocker)));
  return Object.freeze({
    ...value,
    blockers
  });
}

function closureRouteLookupKey({
  dispersedMaterialId,
  vaporPhaseId,
  condensedPhaseId
}) {
  return `${dispersedMaterialId}|${vaporPhaseId}|${condensedPhaseId}`;
}

function closureRouteIdentityKey({
  dispersedMaterialId,
  vaporPhaseId,
  condensedPhaseId,
  morphologyModelId: modelId
}) {
  return `${closureRouteLookupKey({
    dispersedMaterialId,
    vaporPhaseId,
    condensedPhaseId
  })}|${modelId}`;
}

function canonicalRouteIdentityForEntry(entry, route, prefix) {
  const claimsCanonicalIdentity = [
    'routeKey',
    'routeId',
    'surfaceIdentityKey',
    'opticalState'
  ].some((field) => entry[field] != null)
    || entry.schema != null
    || entry.status === COLLECTIVE_OPTICAL_ROUTE_STATUS;
  if (!claimsCanonicalIdentity) {
    return {
      identityKind: LOCAL_ROUTE_IDENTITY,
      routeSchema: null,
      routeKey: route.closureIdentityKey,
      routeId: null,
      material: null,
      vaporPhase: null,
      condensedPhase: null
    };
  }
  if (entry.schema !== COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA) {
    throw new RangeError(`${prefix}.schema must identify the canonical collective route`);
  }
  if (entry.routeKey == null || entry.routeId == null) {
    throw new RangeError(
      `${prefix} canonical collective route requires both routeKey and routeId`
    );
  }
  const canonical = collectiveOpticalRouteDescriptor({
    schema: entry.schema,
    status: typeof entry.status === 'string' ? entry.status : undefined,
    material: entry.material,
    materialId: route.dispersedMaterialId,
    condensedPhase: entry.condensedPhase,
    condensedPhaseId: route.condensedPhaseId,
    vaporPhase: entry.vaporPhase,
    vaporPhaseId: route.vaporPhaseId,
    closureModelId: route.morphologyModelId,
    routeKey: entry.routeKey,
    routeId: entry.routeId,
    opticalStateId: route.opticalStateId,
    surfaceIdentityKey: entry.surfaceIdentityKey,
    opticalState: entry.opticalState,
    phase: entry.phase,
    phaseId: entry.phaseId,
    dispersedPhase: entry.dispersedPhase,
    dispersedPhaseId: entry.dispersedPhaseId
  });
  return {
    identityKind: CANONICAL_ROUTE_IDENTITY,
    routeSchema: canonical.schema,
    routeKey: canonical.routeKey,
    routeId: canonical.routeId,
    material: canonical.material,
    vaporPhase: canonical.vaporPhase,
    condensedPhase: canonical.condensedPhase
  };
}

function blockedClosureRow(route, reason) {
  const lanes = SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES;
  const values = new Array(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS).fill(0);
  values[lanes.dispersedMaterialId] = route.dispersedMaterialId;
  values[lanes.vaporPhaseId] = route.vaporPhaseId;
  values[lanes.condensedPhaseId] = route.condensedPhaseId;
  values[lanes.opticalStateId] = route.opticalStateId;
  values[lanes.morphologyModelId] = route.morphologyModelId;
  values[lanes.status] = SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked;
  return {
    ...route,
    values,
    status: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked,
    statusReason: reason
  };
}

function optionalNonnegativeF32(entry, closureInput, key, label, prefix) {
  const value = closureField(entry, closureInput, key, prefix);
  if (value == null) return null;
  return nonnegativeF32(value, label);
}

function canonicalClosureEntry(entry, sourceIndex) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError(`entries[${sourceIndex}] must be an object`);
  }
  const prefix = `entries[${sourceIndex}]`;
  const dispersedMaterialId = exactF32Identifier(
    entry.dispersedMaterialId ?? entry.materialId,
    `${prefix}.dispersedMaterialId`
  );
  const vaporPhaseId = exactF32Identifier(
    entry.vaporPhaseId,
    `${prefix}.vaporPhaseId`
  );
  const condensedPhaseId = exactF32Identifier(
    entry.condensedPhaseId,
    `${prefix}.condensedPhaseId`
  );
  if (vaporPhaseId === condensedPhaseId) {
    throw new RangeError(
      `${prefix}.vaporPhaseId and ${prefix}.condensedPhaseId must be distinct`
    );
  }
  const opticalStateId = exactF32Identifier(
    entry.opticalStateId,
    `${prefix}.opticalStateId`
  );
  const { closureInput, invalidReason: closureInputInvalidReason } =
    explicitClosureInput(entry, prefix);
  const { modelId, invalid: invalidMorphologyModel } =
    resolvedMorphologyModel(entry, closureInput, prefix);
  assertNoScientificValidationClaim(
    entry.scientificValidation,
    `${prefix}.scientificValidation`
  );
  assertNoScientificValidationClaim(
    closureInput?.scientificValidation,
    `${prefix}.dispersedMediumOpticalClosure.scientificValidation`
  );
  if (closureInput) {
    for (const key of CLOSURE_PHYSICAL_FIELDS) {
      if (hasOwn(entry, key)) closureField(entry, closureInput, key, prefix);
    }
  }
  const route = {
    sourceIndex,
    dispersedMaterialId,
    vaporPhaseId,
    condensedPhaseId,
    opticalStateId,
    morphologyModelId: modelId,
    morphologyModel:
      MORPHOLOGY_MODEL_LABEL_BY_ID.get(modelId)
      ?? SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS.blocked,
    provenance: closureProvenance(entry, closureInput, prefix)
  };
  route.lookupKey = closureRouteLookupKey(route);
  route.closureIdentityKey = closureRouteIdentityKey(route);
  Object.assign(route, canonicalRouteIdentityForEntry(entry, route, prefix));

  // Route descriptors carry their own textual construction status. Only the
  // numeric closure-status ABI is authoritative for this table.
  let requestedStatus = null;
  if (typeof entry.status === 'number') {
    requestedStatus = canonicalClosureStatus(entry.status, `${prefix}.status`);
  } else if (
    entry.status != null
    && entry.status !== COLLECTIVE_OPTICAL_ROUTE_STATUS
  ) {
    throw new RangeError(
      `${prefix}.status must be a numeric closure status or canonical route status`
    );
  }
  if (requestedStatus === SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked) {
    return blockedClosureRow(route, 'explicitly-blocked');
  }
  if (closureInputInvalidReason) {
    return blockedClosureRow(route, closureInputInvalidReason);
  }
  if (invalidMorphologyModel) {
    return blockedClosureRow(route, 'missing-or-invalid-morphology-model');
  }
  if (modelId === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked) {
    return blockedClosureRow(route, 'missing-or-invalid-morphology-model');
  }
  if (route.provenance?.status === 'blocked') {
    return blockedClosureRow(route, 'optical-model-provenance-blocked');
  }

  const condensedDensityKgPerM3 = optionalNonnegativeF32(
    entry,
    closureInput,
    'condensedDensityKgPerM3',
    `${prefix}.condensedDensityKgPerM3`,
    prefix
  );
  if (condensedDensityKgPerM3 == null || !(condensedDensityKgPerM3 > 0)) {
    return blockedClosureRow(route, 'missing-or-invalid-optical-morphology-input');
  }

  const complexIndexModel = modelId
    === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
      .singleCompactSphereComplexIndex;
  let opticalParameter0;
  let opticalParameter1;
  let opticalParameter2;
  let referenceWavelengthM = 0;
  if (complexIndexModel) {
    opticalParameter0 = optionalNonnegativeF32(
      entry,
      closureInput,
      'relativeRefractiveIndexN',
      `${prefix}.relativeRefractiveIndexN`,
      prefix
    );
    opticalParameter1 = optionalNonnegativeF32(
      entry,
      closureInput,
      'relativeExtinctionCoefficientK',
      `${prefix}.relativeExtinctionCoefficientK`,
      prefix
    );
    const rayAsymmetryValue = closureField(
      entry,
      closureInput,
      'largeSizeRayAsymmetryFactorG',
      prefix
    );
    opticalParameter2 = rayAsymmetryValue != null
      ? finiteF32(
          rayAsymmetryValue,
          `${prefix}.largeSizeRayAsymmetryFactorG`
        )
      : null;
    if (opticalParameter2 != null && Math.abs(opticalParameter2) > 1) {
      throw new RangeError(
        `${prefix}.largeSizeRayAsymmetryFactorG magnitude must not exceed one`
      );
    }
    referenceWavelengthM = optionalNonnegativeF32(
      entry,
      closureInput,
      'referenceWavelengthM',
      `${prefix}.referenceWavelengthM`,
      prefix
    );
    if (
      !(opticalParameter0 > 0)
      || opticalParameter1 == null
      || opticalParameter2 == null
      || !(referenceWavelengthM > 0)
    ) {
      return blockedClosureRow(
        route,
        'missing-or-invalid-complex-index-sphere-input'
      );
    }
  } else {
    opticalParameter0 = optionalNonnegativeF32(
      entry,
      closureInput,
      'scatteringEfficiencyQsca',
      `${prefix}.scatteringEfficiencyQsca`,
      prefix
    );
    opticalParameter1 = optionalNonnegativeF32(
      entry,
      closureInput,
      'absorptionEfficiencyQabs',
      `${prefix}.absorptionEfficiencyQabs`,
      prefix
    );
    const asymmetryFactorValue = closureField(
      entry,
      closureInput,
      'asymmetryFactorG',
      prefix
    );
    opticalParameter2 = asymmetryFactorValue != null
      ? finiteF32(asymmetryFactorValue, `${prefix}.asymmetryFactorG`)
      : null;
    if (opticalParameter2 != null && Math.abs(opticalParameter2) > 1) {
      throw new RangeError(
        `${prefix}.asymmetryFactorG magnitude must not exceed one`
      );
    }
    if (
      opticalParameter0 == null
      || opticalParameter1 == null
      || opticalParameter2 == null
    ) {
      return blockedClosureRow(
        route,
        'missing-or-invalid-optical-morphology-input'
      );
    }
  }

  let effectiveRadiusM = 0;
  if (
    modelId
    === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
  ) {
    effectiveRadiusM = optionalNonnegativeF32(
      entry,
      closureInput,
      'effectiveRadiusM',
      `${prefix}.effectiveRadiusM`,
      prefix
    );
    if (!(effectiveRadiusM > 0)) {
      return blockedClosureRow(route, 'missing-or-invalid-authoritative-radius');
    }
  } else if (closureField(
    entry,
    closureInput,
    'effectiveRadiusM',
    prefix
  ) != null) {
    effectiveRadiusM = optionalNonnegativeF32(
      entry,
      closureInput,
      'effectiveRadiusM',
      `${prefix}.effectiveRadiusM`,
      prefix
    );
    if (effectiveRadiusM !== 0) {
      return blockedClosureRow(route, 'compact-model-forbids-authoritative-radius');
    }
  }

  const lanes = SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES;
  const values = new Array(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS).fill(0);
  values[lanes.dispersedMaterialId] = dispersedMaterialId;
  values[lanes.vaporPhaseId] = vaporPhaseId;
  values[lanes.condensedPhaseId] = condensedPhaseId;
  values[lanes.opticalStateId] = opticalStateId;
  values[lanes.morphologyModelId] = modelId;
  values[lanes.status] = SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready;
  values[lanes.condensedDensityKgPerM3] = condensedDensityKgPerM3;
  values[lanes.scatteringEfficiencyQsca] = opticalParameter0;
  values[lanes.absorptionEfficiencyQabs] = opticalParameter1;
  values[lanes.asymmetryFactorG] = opticalParameter2;
  values[lanes.effectiveRadiusM] = effectiveRadiusM;
  values[lanes.reserved0] = referenceWavelengthM;
  return {
    ...route,
    values,
    status: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready,
    statusReason: 'closure-ready'
  };
}

function compareClosureRoutes(left, right) {
  return left.dispersedMaterialId - right.dispersedMaterialId
    || left.vaporPhaseId - right.vaporPhaseId
    || left.condensedPhaseId - right.condensedPhaseId
    || left.morphologyModelId - right.morphologyModelId
    || left.opticalStateId - right.opticalStateId;
}

/**
 * Build a deterministic material-general route table. The table contains only
 * static morphology plus either authored efficiencies or complex-index sphere
 * inputs. It intentionally has no thermodynamic state and therefore cannot
 * create dispersed mass; compact-sphere efficiencies are derived later from
 * the runtime conserved-mass radius.
 */
export function buildSphDispersedMediumOpticalClosureTable(entries = []) {
  if (!Array.isArray(entries)) {
    throw new TypeError(
      'buildSphDispersedMediumOpticalClosureTable requires an entries array'
    );
  }
  const canonicalEntries = entries
    .map((entry, index) => canonicalClosureEntry(entry, index))
    .sort(compareClosureRoutes);
  const lookupKeys = new Set();
  const opticalStateIds = new Set();
  for (const entry of canonicalEntries) {
    if (lookupKeys.has(entry.lookupKey)) {
      throw new RangeError(
        `duplicate dispersed-medium optical closure route ${entry.lookupKey}`
      );
    }
    if (opticalStateIds.has(entry.opticalStateId)) {
      throw new RangeError(
        `duplicate dispersed-medium opticalStateId ${entry.opticalStateId}`
      );
    }
    lookupKeys.add(entry.lookupKey);
    opticalStateIds.add(entry.opticalStateId);
  }

  const rows = new Float32Array(
    canonicalEntries.length
    * SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS
  );
  const metadata = canonicalEntries.map((entry, rowIndex) => {
    rows.set(
      entry.values,
      rowIndex * SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS
    );
    return Object.freeze({
      rowIndex,
      sourceIndex: entry.sourceIndex,
      lookupKey: entry.lookupKey,
      routeKey: entry.routeKey,
      routeId: entry.routeId,
      routeIdentityKind: entry.identityKind,
      routeSchema: entry.routeSchema,
      material: entry.material,
      vaporPhase: entry.vaporPhase,
      condensedPhase: entry.condensedPhase,
      closureIdentityKey: entry.closureIdentityKey,
      dispersedMaterialId: entry.dispersedMaterialId,
      vaporPhaseId: entry.vaporPhaseId,
      condensedPhaseId: entry.condensedPhaseId,
      opticalStateId: entry.opticalStateId,
      morphologyModelId: entry.morphologyModelId,
      morphologyModel: entry.morphologyModel,
      status: entry.status,
      statusReason: entry.statusReason,
      provenance: entry.provenance,
      scientificValidation: false
    });
  });
  const readyRowCount = canonicalEntries.filter(
    (entry) => entry.status
      === SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready
  ).length;
  const readyOpticalStateIds = Object.freeze(
    canonicalEntries
      .filter((entry) => entry.status
        === SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready)
      .map((entry) => entry.opticalStateId)
      .sort((left, right) => left - right)
  );
  const table = Object.freeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
    propertySchema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    version: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION,
    status: canonicalEntries.length === 0
      ? CLOSURE_TABLE_STATUS_EMPTY
      : CLOSURE_TABLE_STATUS_READY,
    rowCount: canonicalEntries.length,
    routeCount: canonicalEntries.length,
    readyRowCount,
    blockedRowCount: canonicalEntries.length - readyRowCount,
    readyOpticalStateIds,
    rowStrideFloats: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
    rowStrideBytes: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES,
    rowLayout: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT,
    bufferByteLength: rows.byteLength,
    rows,
    metadata: Object.freeze(metadata),
    routeLookup: CLOSURE_ROUTE_LOOKUP,
    massAuthority: CLOSURE_MASS_AUTHORITY,
    saturationMassInference: false,
    scientificValidation: false
  });
  validateSphDispersedMediumOpticalClosureTable(table);
  return table;
}

function decodedClosureRow(rows, rowIndex) {
  const lanes = SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES;
  const offset = rowIndex * SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS;
  const modelId = rows[offset + lanes.morphologyModelId];
  return Object.freeze({
    rowIndex,
    rowOffset: offset,
    dispersedMaterialId: rows[offset + lanes.dispersedMaterialId],
    vaporPhaseId: rows[offset + lanes.vaporPhaseId],
    condensedPhaseId: rows[offset + lanes.condensedPhaseId],
    opticalStateId: rows[offset + lanes.opticalStateId],
    morphologyModelId: modelId,
    morphologyModel:
      MORPHOLOGY_MODEL_LABEL_BY_ID.get(modelId)
      ?? SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS.blocked,
    status: rows[offset + lanes.status],
    condensedDensityKgPerM3:
      rows[offset + lanes.condensedDensityKgPerM3],
    scatteringEfficiencyQsca:
      rows[offset + lanes.scatteringEfficiencyQsca],
    relativeRefractiveIndexN:
      rows[offset + lanes.relativeRefractiveIndexN],
    absorptionEfficiencyQabs:
      rows[offset + lanes.absorptionEfficiencyQabs],
    relativeExtinctionCoefficientK:
      rows[offset + lanes.relativeExtinctionCoefficientK],
    asymmetryFactorG: rows[offset + lanes.asymmetryFactorG],
    largeSizeRayAsymmetryFactorG:
      rows[offset + lanes.largeSizeRayAsymmetryFactorG],
    effectiveRadiusM: rows[offset + lanes.effectiveRadiusM],
    referenceWavelengthM: rows[offset + lanes.referenceWavelengthM]
  });
}

function validateMetadataRouteIdentity(metadata, row, rowIndex) {
  if (metadata.routeIdentityKind === LOCAL_ROUTE_IDENTITY) {
    if (
      metadata.routeSchema !== null
      || metadata.routeId !== null
      || metadata.material !== null
      || metadata.vaporPhase !== null
      || metadata.condensedPhase !== null
      || metadata.routeKey !== metadata.closureIdentityKey
    ) {
      throw new RangeError(
        `dispersed-medium optical closure metadata row ${rowIndex} has an inconsistent local route identity`
      );
    }
    return;
  }
  if (metadata.routeIdentityKind !== CANONICAL_ROUTE_IDENTITY) {
    throw new RangeError(
      `dispersed-medium optical closure metadata row ${rowIndex} has an unknown route identity kind`
    );
  }
  const canonical = collectiveOpticalRouteDescriptor({
    schema: metadata.routeSchema,
    status: COLLECTIVE_OPTICAL_ROUTE_STATUS,
    material: metadata.material,
    materialId: row.dispersedMaterialId,
    condensedPhase: metadata.condensedPhase,
    condensedPhaseId: row.condensedPhaseId,
    vaporPhase: metadata.vaporPhase,
    vaporPhaseId: row.vaporPhaseId,
    closureModelId: row.morphologyModelId,
    routeKey: metadata.routeKey,
    routeId: metadata.routeId,
    opticalStateId: row.opticalStateId
  });
  if (
    metadata.routeSchema !== canonical.schema
    || metadata.routeId !== canonical.routeId
    || row.opticalStateId !== canonical.opticalStateId
  ) {
    throw new RangeError(
      `dispersed-medium optical closure metadata row ${rowIndex} has an inconsistent canonical route identity`
    );
  }
}

/**
 * Assert that an arbitrary table has the exact immutable ABI shape expected
 * by CPU and WGSL producers. The Float32Array remains transferable/mutable, so
 * callers may invoke this again at trust boundaries.
 */
export function validateSphDispersedMediumOpticalClosureTable(table) {
  if (table?.schema !== ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA) {
    throw new TypeError('expected a dispersed-medium optical closure table');
  }
  if (!(table.rows instanceof Float32Array)) {
    throw new TypeError('dispersed-medium optical closure rows must be a Float32Array');
  }
  if (
    table.version !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION
    || table.propertySchema
      !== ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
    || !Number.isSafeInteger(table.rowCount)
    || table.rowCount < 0
    || table.routeCount !== table.rowCount
    || table.rowStrideFloats
      !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS
    || table.rowStrideBytes !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES
    || table.rows.length
      !== table.rowCount * SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS
    || table.bufferByteLength !== table.rows.byteLength
  ) {
    throw new RangeError(
      'dispersed-medium optical closure table does not exactly fill its ABI layout'
    );
  }
  if (
    table.rowLayout !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT
    && (
      !Array.isArray(table.rowLayout)
      || table.rowLayout.length
        !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT.length
      || table.rowLayout.some(
        (field, index) => field
          !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT[index]
      )
    )
  ) {
    throw new RangeError('dispersed-medium optical closure row layout is not canonical');
  }
  if (!Array.isArray(table.metadata) || table.metadata.length !== table.rowCount) {
    throw new RangeError(
      'dispersed-medium optical closure metadata must align exactly with rows'
    );
  }
  const expectedStatus = table.rowCount === 0
    ? CLOSURE_TABLE_STATUS_EMPTY
    : CLOSURE_TABLE_STATUS_READY;
  if (
    table.status !== expectedStatus
    || table.routeLookup !== CLOSURE_ROUTE_LOOKUP
    || table.massAuthority !== CLOSURE_MASS_AUTHORITY
    || table.saturationMassInference !== false
    || table.scientificValidation !== false
  ) {
    throw new RangeError(
      'dispersed-medium optical closure table authority metadata is inconsistent'
    );
  }

  const lookupKeys = new Set();
  const opticalStateIds = new Set();
  const readyOpticalStateIds = [];
  let readyRowCount = 0;
  let blockedRowCount = 0;
  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const row = decodedClosureRow(table.rows, rowIndex);
    exactF32Identifier(
      row.dispersedMaterialId,
      `closure row ${rowIndex} dispersedMaterialId`
    );
    exactF32Identifier(row.vaporPhaseId, `closure row ${rowIndex} vaporPhaseId`);
    exactF32Identifier(
      row.condensedPhaseId,
      `closure row ${rowIndex} condensedPhaseId`
    );
    if (row.vaporPhaseId === row.condensedPhaseId) {
      throw new RangeError(`closure row ${rowIndex} phase route must be distinct`);
    }
    exactF32Identifier(
      row.opticalStateId,
      `closure row ${rowIndex} opticalStateId`
    );
    const lookupKey = closureRouteLookupKey(row);
    if (lookupKeys.has(lookupKey)) {
      throw new RangeError(`duplicate dispersed-medium optical closure route ${lookupKey}`);
    }
    if (opticalStateIds.has(row.opticalStateId)) {
      throw new RangeError(
        `duplicate dispersed-medium opticalStateId ${row.opticalStateId}`
      );
    }
    lookupKeys.add(lookupKey);
    opticalStateIds.add(row.opticalStateId);

    const metadata = table.metadata[rowIndex];
    const closureIdentityKey = closureRouteIdentityKey(row);
    if (
      metadata?.rowIndex !== rowIndex
      || metadata.lookupKey !== lookupKey
      || metadata.closureIdentityKey !== closureIdentityKey
      || typeof metadata.routeKey !== 'string'
      || metadata.routeKey.length === 0
      || metadata.dispersedMaterialId !== row.dispersedMaterialId
      || metadata.vaporPhaseId !== row.vaporPhaseId
      || metadata.condensedPhaseId !== row.condensedPhaseId
      || metadata.opticalStateId !== row.opticalStateId
      || metadata.morphologyModelId !== row.morphologyModelId
      || metadata.morphologyModel !== row.morphologyModel
      || metadata.status !== row.status
      || metadata.scientificValidation !== false
    ) {
      throw new RangeError(
        `dispersed-medium optical closure metadata row ${rowIndex} is inconsistent`
      );
    }
    validateMetadataRouteIdentity(metadata, row, rowIndex);
    validateClosureProvenance(
      metadata.provenance,
      `dispersed-medium optical closure metadata row ${rowIndex}.provenance`
    );

    if (!MORPHOLOGY_MODEL_LABEL_BY_ID.has(row.morphologyModelId)) {
      throw new RangeError(`closure row ${rowIndex} has invalid morphology model id`);
    }
    if (row.status === SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked) {
      for (const value of [
        row.condensedDensityKgPerM3,
        row.scatteringEfficiencyQsca,
        row.absorptionEfficiencyQabs,
        row.asymmetryFactorG,
        row.effectiveRadiusM,
        row.referenceWavelengthM
      ]) {
        if (value !== 0) {
          throw new RangeError(
            `blocked closure row ${rowIndex} must have zero physical lanes`
          );
        }
      }
      blockedRowCount += 1;
      continue;
    }
    if (row.status !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready) {
      throw new RangeError(`closure row ${rowIndex} has invalid status`);
    }
    if (
      row.morphologyModelId
        !== SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
          .singleCompactCondensateCarrierLowerBound
      && row.morphologyModelId
        !== SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
      && row.morphologyModelId
        !== SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
          .singleCompactSphereComplexIndex
    ) {
      throw new RangeError(`ready closure row ${rowIndex} has invalid morphology`);
    }
    if (!(row.condensedDensityKgPerM3 > 0)) {
      throw new RangeError(`ready closure row ${rowIndex} requires positive density`);
    }
    const complexIndexModel = row.morphologyModelId
      === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
        .singleCompactSphereComplexIndex;
    if (complexIndexModel) {
      if (!(row.relativeRefractiveIndexN > 0)) {
        throw new RangeError(
          `closure row ${rowIndex} relative refractive index must be positive`
        );
      }
      nonnegativeF32(
        row.relativeExtinctionCoefficientK,
        `closure row ${rowIndex} relative extinction coefficient`
      );
      if (!Number.isFinite(row.largeSizeRayAsymmetryFactorG)
        || Math.abs(row.largeSizeRayAsymmetryFactorG) > 1) {
        throw new RangeError(
          `closure row ${rowIndex} large-size ray asymmetry must be in [-1, 1]`
        );
      }
      if (!(row.referenceWavelengthM > 0)) {
        throw new RangeError(
          `closure row ${rowIndex} reference wavelength must be positive`
        );
      }
    } else {
      nonnegativeF32(
        row.scatteringEfficiencyQsca,
        `closure row ${rowIndex} scatteringEfficiencyQsca`
      );
      nonnegativeF32(
        row.absorptionEfficiencyQabs,
        `closure row ${rowIndex} absorptionEfficiencyQabs`
      );
      if (!Number.isFinite(row.asymmetryFactorG)
        || Math.abs(row.asymmetryFactorG) > 1) {
        throw new RangeError(`closure row ${rowIndex} asymmetry must be in [-1, 1]`);
      }
      if (row.referenceWavelengthM !== 0) {
        throw new RangeError(`closure row ${rowIndex} reserved lane must be zero`);
      }
    }
    if (
      row.morphologyModelId
        === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
      ? !(row.effectiveRadiusM > 0)
      : row.effectiveRadiusM !== 0
    ) {
      throw new RangeError(`closure row ${rowIndex} has invalid radius authority`);
    }
    readyRowCount += 1;
    readyOpticalStateIds.push(row.opticalStateId);
  }
  if (
    table.readyRowCount !== readyRowCount
    || table.blockedRowCount !== blockedRowCount
    || readyRowCount + blockedRowCount !== table.rowCount
  ) {
    throw new RangeError('dispersed-medium optical closure status counts are inconsistent');
  }
  readyOpticalStateIds.sort((left, right) => left - right);
  if (
    !Array.isArray(table.readyOpticalStateIds)
    || table.readyOpticalStateIds.length !== readyOpticalStateIds.length
    || table.readyOpticalStateIds.some(
      (value, index) => value !== readyOpticalStateIds[index]
    )
  ) {
    throw new RangeError(
      'dispersed-medium optical closure ready route identifiers are inconsistent'
    );
  }
  return true;
}

/** Return the one exact material/phase-pair closure route, or null. */
export function findSphDispersedMediumOpticalClosureRow(table, query = {}) {
  validateSphDispersedMediumOpticalClosureTable(table);
  const dispersedMaterialId = exactF32Identifier(
    query.dispersedMaterialId ?? query.materialId,
    'query.dispersedMaterialId'
  );
  const vaporPhaseId = exactF32Identifier(
    query.vaporPhaseId,
    'query.vaporPhaseId'
  );
  const condensedPhaseId = exactF32Identifier(
    query.condensedPhaseId,
    'query.condensedPhaseId'
  );
  const lanes = SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES;
  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const offset = rowIndex * SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS;
    if (
      table.rows[offset + lanes.dispersedMaterialId] === dispersedMaterialId
      && table.rows[offset + lanes.vaporPhaseId] === vaporPhaseId
      && table.rows[offset + lanes.condensedPhaseId] === condensedPhaseId
    ) {
      return decodedClosureRow(table.rows, rowIndex);
    }
  }
  return null;
}

function blockedOpticalMoments(reason) {
  return Object.freeze({
    dispersedMaterialId: 0,
    dispersedPhaseId: 0,
    opticalStateId: 0,
    status: SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked,
    dispersedMassKg: 0,
    scatteringCrossSectionM2: 0,
    absorptionCrossSectionM2: 0,
    scatteringAsymmetryCrossSectionM2: 0,
    effectiveRadiusM: 0,
    morphologyModelId:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked,
    statusReason: reason,
    massAuthority: 'already-conserved-dispersed-condensed-mass'
  });
}

function finiteMomentF32(value, label) {
  const rounded = Math.fround(value);
  if (!Number.isFinite(value) || !Number.isFinite(rounded) || rounded < 0) {
    throw new RangeError(`${label} overflowed the finite nonnegative f32 domain`);
  }
  return rounded;
}

/**
 * Convert already-conserved dispersed condensed mass to extensive optical
 * moments. This closure has no pressure, temperature, or equilibrium input and
 * consequently cannot manufacture condensate from a vapor state.
 */
export function deriveSphDispersedMediumOpticalMoments({
  closureRow,
  dispersedMassKg
} = {}) {
  if (!closureRow || typeof closureRow !== 'object' || Array.isArray(closureRow)) {
    throw new TypeError('deriveSphDispersedMediumOpticalMoments requires closureRow');
  }
  const status = canonicalClosureStatus(closureRow.status, 'closureRow.status');
  if (status === SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked) {
    return blockedOpticalMoments('closure-route-blocked');
  }
  if (status !== SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready) {
    throw new RangeError('closureRow.status must be explicit');
  }
  const modelId = morphologyModelId(
    closureRow.morphologyModelId ?? closureRow.morphologyModel
  );
  if (modelId === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked) {
    return blockedOpticalMoments('missing-or-invalid-morphology-model');
  }

  const materialId = exactF32Identifier(
    closureRow.dispersedMaterialId ?? closureRow.materialId,
    'closureRow.dispersedMaterialId'
  );
  const condensedPhaseId = exactF32Identifier(
    closureRow.condensedPhaseId,
    'closureRow.condensedPhaseId'
  );
  const opticalStateId = exactF32Identifier(
    closureRow.opticalStateId,
    'closureRow.opticalStateId'
  );
  const mass = nonnegativeF32(dispersedMassKg, 'dispersedMassKg');
  const density = finiteF32(
    closureRow.condensedDensityKgPerM3,
    'closureRow.condensedDensityKgPerM3'
  );
  if (!(density > 0)) {
    return blockedOpticalMoments('missing-or-invalid-condensed-density');
  }
  const complexIndexModel = modelId
    === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
      .singleCompactSphereComplexIndex;
  let qScattering = 0;
  let qAbsorption = 0;
  let asymmetryFactor = 0;
  if (!complexIndexModel) {
    qScattering = nonnegativeF32(
      closureRow.scatteringEfficiencyQsca,
      'closureRow.scatteringEfficiencyQsca'
    );
    qAbsorption = nonnegativeF32(
      closureRow.absorptionEfficiencyQabs,
      'closureRow.absorptionEfficiencyQabs'
    );
    asymmetryFactor = finiteF32(
      closureRow.asymmetryFactorG,
      'closureRow.asymmetryFactorG'
    );
    if (Math.abs(asymmetryFactor) > 1) {
      throw new RangeError(
        'closureRow.asymmetryFactorG magnitude must not exceed one'
      );
    }
  }

  let effectiveRadiusM;
  let totalGeometricCrossSectionM2;
  if (
    modelId
    === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
      .singleCompactCondensateCarrierLowerBound
    || complexIndexModel
  ) {
    effectiveRadiusM = mass > 0
      ? finiteMomentF32(
          Math.cbrt(mass / (FOUR_PI_OVER_THREE * density)),
          'compact effective radius'
        )
      : 0;
    totalGeometricCrossSectionM2 = mass > 0
      ? finiteMomentF32(
          Math.PI * effectiveRadiusM * effectiveRadiusM,
          'compact geometric cross section'
        )
      : 0;
  } else if (
    modelId
    === SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
  ) {
    effectiveRadiusM = finiteF32(
      closureRow.effectiveRadiusM,
      'closureRow.effectiveRadiusM'
    );
    if (!(effectiveRadiusM > 0)) {
      return blockedOpticalMoments('missing-or-invalid-authoritative-radius');
    }
    totalGeometricCrossSectionM2 = mass > 0
      ? finiteMomentF32(
          (THREE_OVER_FOUR * mass) / (density * effectiveRadiusM),
          'monodisperse geometric cross section'
        )
      : 0;
  } else {
    return blockedOpticalMoments('missing-or-invalid-morphology-model');
  }

  if (complexIndexModel && mass > 0) {
    const efficiencies = sphericalParticleOpticalEfficiencies({
      radiusM: effectiveRadiusM,
      wavelengthM: closureRow.referenceWavelengthM,
      relativeRefractiveIndexN: closureRow.relativeRefractiveIndexN,
      relativeExtinctionCoefficientK:
        closureRow.relativeExtinctionCoefficientK,
      largeSizeRayAsymmetryFactorG:
        closureRow.largeSizeRayAsymmetryFactorG
    });
    if (efficiencies.valid !== true) {
      return blockedOpticalMoments(
        'sphere-efficiency-model-outside-supported-domain'
      );
    }
    qScattering = efficiencies.scatteringEfficiencyQsca;
    qAbsorption = efficiencies.absorptionEfficiencyQabs;
    asymmetryFactor = efficiencies.asymmetryFactorG;
  }

  const scatteringCrossSectionM2 = finiteMomentF32(
    qScattering * totalGeometricCrossSectionM2,
    'scattering cross section'
  );
  const absorptionCrossSectionM2 = finiteMomentF32(
    qAbsorption * totalGeometricCrossSectionM2,
    'absorption cross section'
  );
  let scatteringAsymmetryCrossSectionM2 = Math.fround(
    asymmetryFactor * scatteringCrossSectionM2
  );
  if (!Number.isFinite(scatteringAsymmetryCrossSectionM2)) {
    throw new RangeError('scattering asymmetry cross section overflowed finite f32');
  }
  scatteringAsymmetryCrossSectionM2 = Math.max(
    -scatteringCrossSectionM2,
    Math.min(scatteringCrossSectionM2, scatteringAsymmetryCrossSectionM2)
  );

  return Object.freeze({
    dispersedMaterialId: materialId,
    dispersedPhaseId: condensedPhaseId,
    opticalStateId,
    status: SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
    dispersedMassKg: mass,
    scatteringCrossSectionM2,
    absorptionCrossSectionM2,
    scatteringAsymmetryCrossSectionM2,
    effectiveRadiusM,
    morphologyModelId: modelId,
    morphologyModel: MORPHOLOGY_MODEL_LABEL_BY_ID.get(modelId),
    statusReason: mass > 0 ? 'extensive-optical-moments-ready' : 'zero-dispersed-mass',
    massAuthority: 'already-conserved-dispersed-condensed-mass'
  });
}
