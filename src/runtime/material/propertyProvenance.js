// Material-property provenance ledger.
//
// `closureBacked` only means a property flowed through a closure artifact. It does NOT mean the
// value was derived from lower-level physics. This ledger makes that distinction explicit and
// machine-checkable so material, SPH, and reaction code cannot silently treat a reference fixture as
// first-principles data.

export const MATERIAL_PROPERTY_PROVENANCE_SCHEMA = 'ulg.material-property-provenance.v0';

export const PROPERTY_DERIVATION_STATUS = Object.freeze({
  LOWER_LEVEL_SIMULATION: 'lower-level-simulation',
  DERIVED_FROM_LOWER_LEVEL: 'derived-from-lower-level',
  PHYSICAL_LAW: 'physical-law',
  EXACT_CONSTANT: 'exact-constant',
  REFERENCE_FALLBACK: 'reference-fallback',
  REDUCED_ESTIMATE: 'reduced-estimate',
  BLOCKED: 'blocked'
});

const DERIVED_STATUSES = new Set([
  PROPERTY_DERIVATION_STATUS.LOWER_LEVEL_SIMULATION,
  PROPERTY_DERIVATION_STATUS.DERIVED_FROM_LOWER_LEVEL,
  PROPERTY_DERIVATION_STATUS.PHYSICAL_LAW,
  PROPERTY_DERIVATION_STATUS.EXACT_CONSTANT
]);

const NON_DERIVED_STATUSES = new Set([
  PROPERTY_DERIVATION_STATUS.REFERENCE_FALLBACK,
  PROPERTY_DERIVATION_STATUS.REDUCED_ESTIMATE,
  PROPERTY_DERIVATION_STATUS.BLOCKED
]);

export class MaterialFirstPrinciplesResolutionError extends Error {
  constructor(message, { material = null, context = null, blockers = [], summary = null } = {}) {
    super(message);
    this.name = 'MaterialFirstPrinciplesResolutionError';
    this.code = 'material-properties-not-first-principles';
    this.material = material;
    this.context = context;
    this.blockers = blockers;
    this.summary = summary;
  }
}

function normalizePaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) throw new TypeError('provenance entry requires non-empty paths');
  return paths.map((path) => {
    if (typeof path !== 'string' || path.length === 0) throw new TypeError('provenance path must be a non-empty string');
    return path;
  });
}

export function propertyProvenanceEntry({
  paths,
  status,
  source,
  method,
  inputs = [],
  accuracy = 'evidence-only',
  blockers = []
}) {
  if (!Object.values(PROPERTY_DERIVATION_STATUS).includes(status)) {
    throw new TypeError(`unknown property derivation status: ${status}`);
  }
  return {
    paths: normalizePaths(paths),
    status,
    source,
    method,
    inputs,
    accuracy,
    blockers
  };
}

function phasePropertyPaths(properties) {
  const paths = [];
  for (const phase of properties.phases || []) {
    const prefix = `phases.${phase.name}`;
    for (const key of [
      'cpJPerKgK',
      'densityKgPerM3',
      'bulkModulusPa',
      'shearModulusPa',
      'debyeTemperatureK'
    ]) {
      if (phase[key] !== undefined && phase[key] !== null) paths.push(`${prefix}.${key}`);
    }
    if (Array.isArray(phase.temperatureRange)) paths.push(`${prefix}.temperatureRange`);
    if (phase.eos) {
      for (const key of ['gruneisen', 'bulkModulusPa', 'referenceDensityKgPerM3', 'referenceTemperatureK']) {
        if (phase.eos[key] !== undefined && phase.eos[key] !== null) paths.push(`${prefix}.eos.${key}`);
      }
    }
  }
  return paths;
}

function transitionPropertyPaths(properties) {
  const paths = [];
  for (const transition of properties.transitions || []) {
    const name = `${transition.from}->${transition.to}`;
    for (const key of ['temperatureK', 'latentHeatJPerKg']) {
      if (transition[key] !== undefined && transition[key] !== null) paths.push(`transitions.${name}.${key}`);
    }
  }
  return paths;
}

export function trackedMaterialPropertyPaths(properties = {}) {
  const paths = [];
  for (const key of [
    'molarMassKgPerMol',
    'atomsPerFormula',
    'conductionElectronDensityPerM3',
    'intrinsicColorSrgb',
    'opticalInterbandOscillators',
    'idealGas'
  ]) {
    if (properties[key] !== undefined && properties[key] !== null) paths.push(key);
  }
  paths.push(...phasePropertyPaths(properties));
  paths.push(...transitionPropertyPaths(properties));
  return paths;
}

function pathMatches(pattern, path) {
  if (pattern === path || pattern === '*') return true;
  const p = pattern.split('.');
  const q = path.split('.');
  if (p.length !== q.length) return false;
  return p.every((segment, i) => segment === '*' || segment === q[i]);
}

export function provenanceEntriesForPath(properties = {}, path) {
  const entries = properties.propertyProvenance?.entries || [];
  return entries.filter((entry) => entry.paths.some((pattern) => pathMatches(pattern, path)));
}

export function unprovenancedMaterialPropertyPaths(properties = {}) {
  return trackedMaterialPropertyPaths(properties)
    .filter((path) => provenanceEntriesForPath(properties, path).length === 0);
}

export function createPropertyProvenanceLedger({ entries, notes = [] } = {}) {
  if (!Array.isArray(entries)) throw new TypeError('property provenance ledger requires entries');
  return {
    schema: MATERIAL_PROPERTY_PROVENANCE_SCHEMA,
    entries,
    notes
  };
}

export function withPropertyProvenance(properties, { entries, notes = [] }) {
  return {
    ...properties,
    propertyProvenance: createPropertyProvenanceLedger({ entries, notes })
  };
}

export function materialDerivationSummary(properties = {}) {
  const entries = properties.propertyProvenance?.entries || [];
  const counts = {};
  for (const entry of entries) counts[entry.status] = (counts[entry.status] || 0) + entry.paths.length;
  const unprovenanced = unprovenancedMaterialPropertyPaths(properties);
  const fallbackEntries = entries.filter((entry) => NON_DERIVED_STATUSES.has(entry.status));
  const blockers = [
    ...new Set(fallbackEntries.flatMap((entry) => entry.blockers || []))
  ];
  return {
    schema: MATERIAL_PROPERTY_PROVENANCE_SCHEMA,
    trackedPropertyCount: trackedMaterialPropertyPaths(properties).length,
    entryCount: entries.length,
    counts,
    unprovenanced,
    fullyLowerLevelDerived: unprovenanced.length === 0 && fallbackEntries.length === 0,
    hasReferenceFallbacks: fallbackEntries.some((entry) => entry.status === PROPERTY_DERIVATION_STATUS.REFERENCE_FALLBACK),
    hasReducedEstimates: fallbackEntries.some((entry) => entry.status === PROPERTY_DERIVATION_STATUS.REDUCED_ESTIMATE),
    blockers
  };
}

export function assertNoUnprovenancedMaterialProperties(properties = {}) {
  const missing = unprovenancedMaterialPropertyPaths(properties);
  if (missing.length > 0) {
    throw new Error(`material properties missing provenance: ${missing.join(', ')}`);
  }
  return true;
}

export function assertFullyLowerLevelDerived(properties = {}) {
  assertNoUnprovenancedMaterialProperties(properties);
  const summary = materialDerivationSummary(properties);
  if (!summary.fullyLowerLevelDerived) {
    throw new Error(`material properties are not fully lower-level-derived; blockers: ${summary.blockers.join(', ') || 'fallback-or-reduced-estimate'}`);
  }
  return true;
}

export function requireFirstPrinciplesMaterialProperties(properties = {}, { material = null, context = 'material-resolution' } = {}) {
  assertNoUnprovenancedMaterialProperties(properties);
  const summary = materialDerivationSummary(properties);
  if (!summary.fullyLowerLevelDerived) {
    throw new MaterialFirstPrinciplesResolutionError(
      `${material ? `${material} ` : ''}material properties are not first-principles-derived`,
      { material, context, blockers: summary.blockers, summary }
    );
  }
  return true;
}

export function requireFirstPrinciplesMaterialMap(materialProperties = {}, { context = 'material-map' } = {}) {
  for (const [material, properties] of Object.entries(materialProperties)) {
    requireFirstPrinciplesMaterialProperties(properties, { material, context });
  }
  return true;
}

export function isDerivedStatus(status) {
  return DERIVED_STATUSES.has(status);
}
