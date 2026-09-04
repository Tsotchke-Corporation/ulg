import {
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
  hashPayload
} from '../../../ulg-gpu-abi/src/index.js';
import referenceBankJson from '../../../data/material-properties/condensed-dispersed-optical-constants.json' with { type: 'json' };
import {
  SPHERE_OPTICAL_EFFICIENCY_MODEL,
  sphereGeometricRayAsymmetryFactor
} from './opticalClosure.js';

export const CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_SCHEMA =
  'peercompute.ulg.condensed-dispersed-optical-reference-bank.v0';
export const CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION =
  'condensed-dispersed-optical-reference-closure.v1';
export const CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE =
  'condensed-dispersed-optical-reference-bank';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export const CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK = deepFreeze(
  cloneJson(referenceBankJson)
);
export const CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_FINGERPRINT = hashPayload(
  CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK
);

function normalizedText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizedFormula(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, '').toLowerCase()
    : '';
}

function canonicalAtomCountsKey(atomCounts) {
  if (!atomCounts || typeof atomCounts !== 'object' || Array.isArray(atomCounts)) {
    return null;
  }
  const entries = Object.entries(atomCounts)
    .map(([atomicNumber, count]) => [Number(atomicNumber), Number(count)])
    .sort(([left], [right]) => left - right);
  if (
    entries.length === 0
    || entries.some(([atomicNumber, count]) => (
      !Number.isInteger(atomicNumber)
      || atomicNumber <= 0
      || !Number.isInteger(count)
      || count <= 0
    ))
  ) {
    return null;
  }
  return entries.map(([atomicNumber, count]) => `${atomicNumber}:${count}`).join('|');
}

function finitePositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function validSource(source) {
  return source
    && typeof source === 'object'
    && typeof source.role === 'string'
    && source.role.length > 0
    && typeof source.title === 'string'
    && source.title.length > 0
    && typeof source.url === 'string'
    && source.url.startsWith('https://');
}

function validReferenceRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const materialKeys = Array.isArray(record.materialKeys)
    ? record.materialKeys.map(normalizedText).filter(Boolean)
    : [];
  const formulas = Array.isArray(record.formulas)
    ? record.formulas.map(normalizedFormula).filter(Boolean)
    : [];
  const atomCountsKey = canonicalAtomCountsKey(record.atomCounts);
  const phase = normalizedText(record.condensedPhase);
  const ratio = Number(record.absoluteRefractiveIndexN)
    / Number(record.carrierRefractiveIndexN);
  const relativeIndexError = Math.abs(
    ratio - Number(record.relativeRefractiveIndexN)
  );
  const temperatureRange = record.densityModel?.validTemperatureRangeK;
  const referenceTemperatureK = Number(record.referenceTemperatureK);
  const modeledDensityKgPerM3 = (
    Number(record.densityModel?.interceptGPerCm3)
    + Number(record.densityModel?.slopeGPerCm3PerK) * referenceTemperatureK
  ) * 1000;
  let derivedRayAsymmetryFactorG = null;
  try {
    derivedRayAsymmetryFactorG = sphereGeometricRayAsymmetryFactor({
      relativeRefractiveIndexN: Number(record.relativeRefractiveIndexN)
    });
  } catch {
    return false;
  }
  return (
    typeof record.id === 'string'
    && record.id.length > 0
    && materialKeys.length > 0
    && formulas.length > 0
    && atomCountsKey != null
    && ['solid', 'liquid'].includes(phase)
    && typeof record.materialForm === 'string'
    && record.materialForm.length > 0
    && finitePositive(referenceTemperatureK)
    && finitePositive(record.referenceWavelengthM)
    && finitePositive(record.condensedDensityKgPerM3)
    && finitePositive(record.absoluteRefractiveIndexN)
    && finitePositive(record.carrierRefractiveIndexN)
    && finitePositive(record.relativeRefractiveIndexN)
    && relativeIndexError <= 1e-12 * Math.max(1, Math.abs(ratio))
    && Number.isFinite(Number(record.relativeExtinctionCoefficientK))
    && Number(record.relativeExtinctionCoefficientK) >= 0
    && (
      Number(record.relativeExtinctionCoefficientK) > 0
      || record.extinctionModel === 'lossless-model-assumption'
    )
    && Number.isFinite(Number(record.largeSizeRayAsymmetryFactorG))
    && Math.abs(Number(record.largeSizeRayAsymmetryFactorG)) <= 1
    && Math.abs(
      Number(record.largeSizeRayAsymmetryFactorG) - derivedRayAsymmetryFactorG
    ) <= 1e-12
    && record.densityModel?.model === 'linear-temperature'
    && Number.isFinite(Number(record.densityModel?.interceptGPerCm3))
    && Number.isFinite(Number(record.densityModel?.slopeGPerCm3PerK))
    && Math.abs(
      Number(record.condensedDensityKgPerM3) - modeledDensityKgPerM3
    ) <= 1e-9 * Math.max(1, Math.abs(modeledDensityKgPerM3))
    && Array.isArray(temperatureRange)
    && temperatureRange.length === 2
    && finitePositive(temperatureRange[0])
    && finitePositive(temperatureRange[1])
    && Number(temperatureRange[0]) <= referenceTemperatureK
    && referenceTemperatureK <= Number(temperatureRange[1])
    && typeof record.densityModel?.equation === 'string'
    && record.densityModel.equation.length > 0
    && record.provenance?.status === 'reference-fallback'
    && typeof record.provenance?.method === 'string'
    && record.provenance.method.length > 0
    && Array.isArray(record.provenance?.sources)
    && record.provenance.sources.length > 0
    && record.provenance.sources.every(validSource)
    && Array.isArray(record.provenance?.blockers)
    && record.provenance.blockers.length > 0
    && record.scientificValidation === false
  );
}

function validReferenceBank(bank) {
  if (
    !bank
    || typeof bank !== 'object'
    || Array.isArray(bank)
    || bank.schema !== CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK_SCHEMA
    || bank.methodRevision !== CONDENSED_DISPERSED_OPTICAL_REFERENCE_METHOD_REVISION
    || bank.scientificValidation !== false
    || !Array.isArray(bank.records)
    || !bank.records.every(validReferenceRecord)
  ) {
    return false;
  }
  const ids = bank.records.map((record) => record.id);
  return new Set(ids).size === ids.length;
}

function recordMatchesIdentity(record, {
  material,
  formula,
  atomCounts,
  condensedPhase
}) {
  const materialKey = normalizedText(material);
  const formulaKey = normalizedFormula(formula);
  const atomCountsKey = canonicalAtomCountsKey(atomCounts);
  const phaseKey = normalizedText(condensedPhase);
  if (!phaseKey || normalizedText(record.condensedPhase) !== phaseKey) return false;
  if (
    materialKey
    && !record.materialKeys.some((candidate) => normalizedText(candidate) === materialKey)
  ) {
    return false;
  }
  if (
    formulaKey
    && !record.formulas.some((candidate) => normalizedFormula(candidate) === formulaKey)
  ) {
    return false;
  }
  if (
    atomCountsKey
    && canonicalAtomCountsKey(record.atomCounts) !== atomCountsKey
  ) {
    return false;
  }
  return Boolean(materialKey || formulaKey || atomCountsKey);
}

/**
 * Resolve an immutable condensed-material optical reference. Every supplied
 * identity selector must agree with the same record, and phase is mandatory;
 * ambiguous, malformed, or incomplete inputs are explicit blocked results.
 */
export function resolveCondensedDispersedOpticalReference({
  material = null,
  formula = null,
  atomCounts = null,
  condensedPhase = null,
  bank = CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK
} = {}) {
  if (!validReferenceBank(bank)) {
    return Object.freeze({
      status: 'blocked',
      reason: 'condensed-dispersed-optical-reference-bank-malformed',
      reference: null
    });
  }
  if (!normalizedText(condensedPhase)) {
    return Object.freeze({
      status: 'blocked',
      reason: 'condensed-dispersed-optical-reference-phase-missing',
      reference: null
    });
  }
  if (
    (material != null && !normalizedText(material))
    || (formula != null && !normalizedFormula(formula))
    || (atomCounts != null && canonicalAtomCountsKey(atomCounts) == null)
  ) {
    return Object.freeze({
      status: 'blocked',
      reason: 'condensed-dispersed-optical-reference-identity-missing-or-malformed',
      reference: null
    });
  }
  if (
    !normalizedText(material)
    && !normalizedFormula(formula)
    && canonicalAtomCountsKey(atomCounts) == null
  ) {
    return Object.freeze({
      status: 'blocked',
      reason: 'condensed-dispersed-optical-reference-identity-missing-or-malformed',
      reference: null
    });
  }
  const matches = bank.records.filter((record) => recordMatchesIdentity(record, {
    material,
    formula,
    atomCounts,
    condensedPhase
  }));
  if (matches.length !== 1) {
    return Object.freeze({
      status: 'blocked',
      reason: matches.length > 1
        ? 'condensed-dispersed-optical-reference-ambiguous'
        : 'condensed-dispersed-optical-reference-not-found-or-identity-phase-mismatch',
      reference: null
    });
  }
  return Object.freeze({
    status: 'ready',
    reason: null,
    bankFingerprint: hashPayload(bank),
    methodRevision: bank.methodRevision,
    reference: matches[0]
  });
}

/**
 * Construct the material-response half of the shared compact-sphere producer.
 * Radius and efficiencies remain runtime products of conserved condensed mass.
 * A blocked lookup returns null so callers retain their explicit zero-efficiency
 * fail-closed closure.
 */
export function createCondensedDispersedMediumOpticalClosure(options = {}) {
  const resolved = resolveCondensedDispersedOpticalReference(options);
  if (resolved.status !== 'ready') return null;
  const reference = resolved.reference;
  return deepFreeze({
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactSphereComplexIndex,
    condensedDensityKgPerM3: Number(reference.condensedDensityKgPerM3),
    relativeRefractiveIndexN: Number(reference.relativeRefractiveIndexN),
    relativeExtinctionCoefficientK:
      Number(reference.relativeExtinctionCoefficientK),
    largeSizeRayAsymmetryFactorG:
      Number(reference.largeSizeRayAsymmetryFactorG),
    referenceWavelengthM: Number(reference.referenceWavelengthM),
    provenance: {
      status: 'reference-fallback',
      source: CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE,
      accuracy: reference.provenance.accuracy,
      method:
        `resolve a phase- and composition-authenticated reference, then evaluate ${SPHERE_OPTICAL_EFFICIENCY_MODEL} at runtime from conserved condensed mass and the reference density/complex index; k=0 remains an explicit lossless model assumption`,
      referenceBankSchema: options.bank?.schema
        || CONDENSED_DISPERSED_OPTICAL_REFERENCE_BANK.schema,
      referenceBankFingerprint: resolved.bankFingerprint,
      referenceMethodRevision: resolved.methodRevision,
      referenceRecordId: reference.id,
      referenceMaterialForm: reference.materialForm,
      referenceCondensedPhase: reference.condensedPhase,
      referenceTemperatureK: Number(reference.referenceTemperatureK),
      referenceTemperatureRangeK: [
        ...reference.densityModel.validTemperatureRangeK
      ].map(Number),
      runtimeApplicabilityEnforced: false,
      referenceWavelengthM: Number(reference.referenceWavelengthM),
      absoluteRefractiveIndexN: Number(reference.absoluteRefractiveIndexN),
      carrierRefractiveIndexN: Number(reference.carrierRefractiveIndexN),
      extinctionModel: reference.extinctionModel,
      densityModel: cloneJson(reference.densityModel),
      sources: cloneJson(reference.provenance.sources),
      densitySource: {
        status: 'reference-fallback',
        source: CONDENSED_DISPERSED_OPTICAL_REFERENCE_SOURCE,
        method: reference.densityModel.equation,
        referenceTemperatureK: Number(reference.referenceTemperatureK)
      },
      blockers: [...reference.provenance.blockers]
    },
    scientificValidation: false
  });
}
