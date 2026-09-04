import {
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
} from '../../../ulg-gpu-abi/src/index.js';
import {
  GPU_PHASE_IDS,
  gpuPhaseId,
  stableOpticalMaterialId,
  stableOpticalStateId
} from '../material/opticalGpuBuffers.js';

export const COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA =
  'peercompute.ulg.sph-collective-dispersed-medium-optical-route.v0';

export const COLLECTIVE_OPTICAL_ROUTE_DEFAULT_CLOSURE_MODEL =
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
    .singleCompactCondensateCarrierLowerBound;

const COLLECTIVE_OPTICAL_ROUTE_KIND = 'collective-dispersed-medium';
export const COLLECTIVE_OPTICAL_ROUTE_STATUS =
  'collective-dispersed-medium-optical-route-ready';

const MORPHOLOGY_MODEL_BY_LABEL = new Map(
  Object.entries(SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS)
    .map(([key, label]) => [
      label,
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL[key]
    ])
);

const MORPHOLOGY_MODEL_LABEL_BY_ID = new Map(
  [...MORPHOLOGY_MODEL_BY_LABEL.entries()].map(([label, id]) => [id, label])
);

function requiredCanonicalKey(value, label) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) throw new TypeError(`${label} must be a non-empty string`);
  return key;
}

function canonicalPhase(value, label) {
  const phase = requiredCanonicalKey(value, label);
  return phase === 'vapor' ? 'gas' : phase;
}

function closureModelForRoute(route = {}) {
  const explicitLabel = String(route.closureModel ?? '').trim();
  const explicitId = Number(route.closureModelId);
  if (explicitLabel) {
    const expectedId = MORPHOLOGY_MODEL_BY_LABEL.get(explicitLabel);
    if (
      Number.isFinite(explicitId)
      && expectedId !== explicitId
    ) {
      throw new RangeError('closureModel and closureModelId identify different morphology models');
    }
    return explicitLabel;
  }
  if (route.closureModelId != null) {
    if (!Number.isFinite(explicitId)) {
      throw new RangeError('closureModelId must identify a ready morphology model');
    }
    for (const [label, id] of MORPHOLOGY_MODEL_BY_LABEL) {
      if (id === explicitId) return label;
    }
    throw new RangeError('closureModelId must identify a ready morphology model');
  }
  return COLLECTIVE_OPTICAL_ROUTE_DEFAULT_CLOSURE_MODEL;
}

function closureModelIdForLabel(label) {
  const id = MORPHOLOGY_MODEL_BY_LABEL.get(label);
  if (!Number.isInteger(id) || id <= 0) {
    throw new RangeError(
      `collective optical route closureModel ${JSON.stringify(label)} is not a ready morphology model`
    );
  }
  return id;
}

function readyClosureModelLabel(value) {
  if (typeof value === 'string') {
    const id = MORPHOLOGY_MODEL_BY_LABEL.get(value);
    return Number.isInteger(id) && id > 0 ? value : null;
  }
  const id = Number(value);
  const label = MORPHOLOGY_MODEL_LABEL_BY_ID.get(id) ?? null;
  return Number.isInteger(id) && id > 0 ? label : null;
}

function typedMaterialClosureModel(properties) {
  const closure = properties?.dispersedMediumOpticalClosure;
  if (
    !closure
    || typeof closure !== 'object'
    || Array.isArray(closure)
    || closure.schema
      !== ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
  ) return null;
  return readyClosureModelLabel(
    closure.morphologyModel ?? closure.morphologyModelId
  );
}

function explicitRouteClosureModel(route) {
  if (route?.closureModel == null && route?.closureModelId == null) return null;
  return closureModelForRoute(route);
}

function routeClosureModel({
  routeOverride = null,
  globalOverride = null,
  properties = null
} = {}) {
  return routeOverride
    ?? globalOverride
    ?? typedMaterialClosureModel(properties)
    ?? COLLECTIVE_OPTICAL_ROUTE_DEFAULT_CLOSURE_MODEL;
}

function lengthPrefixed(value) {
  return `${value.length}:${value}`;
}

function canonicalRouteKeys(route = {}) {
  const material = requiredCanonicalKey(route.material, 'material');
  const condensedPhase = canonicalPhase(route.condensedPhase, 'condensedPhase');
  const vaporPhase = canonicalPhase(route.vaporPhase, 'vaporPhase');
  const closureModel = closureModelForRoute(route);
  const closureModelId = closureModelIdForLabel(closureModel);
  const condensedPhaseId = gpuPhaseId(condensedPhase);
  const vaporPhaseId = gpuPhaseId(vaporPhase);
  if (![GPU_PHASE_IDS.solid, GPU_PHASE_IDS.liquid].includes(condensedPhaseId)) {
    throw new RangeError('condensedPhase must resolve to a solid or liquid GPU phase');
  }
  if (vaporPhaseId !== GPU_PHASE_IDS.gas) {
    throw new RangeError('vaporPhase must resolve to the gas GPU phase');
  }
  for (const [field, actual] of [
    ['condensedPhaseId', condensedPhaseId],
    ['vaporPhaseId', vaporPhaseId]
  ]) {
    if (
      route[field] != null
      && Number(route[field]) !== actual
    ) {
      throw new RangeError(`${field} contradicts its canonical phase name`);
    }
  }
  if (
    route.materialId != null
    && Number(route.materialId) !== stableOpticalMaterialId(material)
  ) {
    throw new RangeError('materialId contradicts the canonical material key');
  }
  return {
    material,
    condensedPhase,
    condensedPhaseId,
    vaporPhase,
    vaporPhaseId,
    closureModel,
    closureModelId
  };
}

/**
 * Return the canonical identity text for a collective dispersed-medium route.
 *
 * This key intentionally excludes every dynamic quantity (temperature, mass,
 * morphology radius, pressure, domain, and preset identity). Those values may
 * change the moments written for a route, but never the numeric binding shared
 * by resident physics and presentation.
 */
export function collectiveOpticalRouteKey(route = {}) {
  const keys = canonicalRouteKeys(route);
  return [
    COLLECTIVE_OPTICAL_ROUTE_KIND,
    `material=${lengthPrefixed(keys.material)}`,
    `condensed=${lengthPrefixed(keys.condensedPhase)}`,
    `vapor=${lengthPrefixed(keys.vaporPhase)}`,
    `closure=${lengthPrefixed(keys.closureModel)}`
  ].join('|');
}

/**
 * Stable, positive, exactly representable f32 route/binding identity.
 */
export function collectiveOpticalRouteId(route = {}) {
  const routeKey = collectiveOpticalRouteKey(route);
  const routeId = Math.fround(stableOpticalStateId({
    collectiveOpticalRouteKey: routeKey
  }));
  if (
    !Number.isInteger(routeId)
    || routeId <= 0
    || Math.fround(routeId) !== routeId
  ) {
    throw new RangeError('collective optical route id must be an exact positive f32 integer');
  }
  return routeId;
}

/**
 * Build the one static descriptor consumed by both closure-table production
 * and collective surface construction.
 */
export function collectiveOpticalRouteDescriptor(route = {}) {
  const keys = canonicalRouteKeys(route);
  const routeKey = collectiveOpticalRouteKey(keys);
  const routeId = collectiveOpticalRouteId(keys);
  for (const [field, actual] of [
    ['routeKey', routeKey],
    ['surfaceIdentityKey', routeKey],
    ['routeId', routeId],
    ['opticalStateId', routeId]
  ]) {
    if (route[field] != null && route[field] !== actual) {
      throw new RangeError(`${field} contradicts the canonical collective route identity`);
    }
  }
  if (
    route.schema != null
    && route.schema !== COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
  ) {
    throw new RangeError('schema contradicts the canonical collective route schema');
  }
  if (route.status != null && route.status !== COLLECTIVE_OPTICAL_ROUTE_STATUS) {
    throw new RangeError('status contradicts the canonical collective route status');
  }
  for (const [field, actual] of [
    ['phase', keys.condensedPhase],
    ['dispersedPhase', keys.condensedPhase],
    ['phaseId', keys.condensedPhaseId],
    ['dispersedPhaseId', keys.condensedPhaseId]
  ]) {
    if (
      route[field] != null
      && (typeof actual === 'string'
        ? canonicalPhase(route[field], field) !== actual
        : Number(route[field]) !== actual)
    ) {
      throw new RangeError(`${field} contradicts the canonical condensed phase`);
    }
  }
  if (route.opticalState != null) {
    if (
      !route.opticalState
      || typeof route.opticalState !== 'object'
      || Array.isArray(route.opticalState)
      || route.opticalState.collectiveOpticalRouteKey !== routeKey
      || stableOpticalStateId(route.opticalState) !== routeId
    ) {
      throw new RangeError('opticalState contradicts the canonical collective route identity');
    }
  }
  const sourceMaterial = String(route.material).trim();
  const renderKey = String(route.renderKey ?? sourceMaterial).trim() || sourceMaterial;
  const opticalState = Object.freeze({ collectiveOpticalRouteKey: routeKey });
  return Object.freeze({
    schema: COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA,
    status: COLLECTIVE_OPTICAL_ROUTE_STATUS,
    routeKey,
    routeId,
    opticalStateId: routeId,
    material: sourceMaterial,
    materialId: stableOpticalMaterialId(sourceMaterial),
    condensedPhase: keys.condensedPhase,
    condensedPhaseId: keys.condensedPhaseId,
    vaporPhase: keys.vaporPhase,
    vaporPhaseId: keys.vaporPhaseId,
    closureModel: keys.closureModel,
    closureModelId: keys.closureModelId,
    // The collective field represents condensed inclusions carried by vapor,
    // so its material optics come from the condensed phase.
    phase: keys.condensedPhase,
    phaseId: keys.condensedPhaseId,
    dispersedPhase: keys.condensedPhase,
    dispersedPhaseId: keys.condensedPhaseId,
    renderKey,
    surfaceIdentityKey: routeKey,
    opticalState,
    properties: route.properties ?? null
  });
}

function transitionRoutePair(transition = {}) {
  const rawFrom = String(transition.from ?? '').trim();
  const rawTo = String(transition.to ?? '').trim();
  if (!rawFrom || !rawTo) return null;
  const from = canonicalPhase(rawFrom, 'transition.from');
  const to = canonicalPhase(rawTo, 'transition.to');
  if (gpuPhaseId(from) === GPU_PHASE_IDS.gas
      && [GPU_PHASE_IDS.solid, GPU_PHASE_IDS.liquid].includes(gpuPhaseId(to))) {
    return { condensedPhase: to, vaporPhase: from };
  }
  if (gpuPhaseId(to) === GPU_PHASE_IDS.gas
      && [GPU_PHASE_IDS.solid, GPU_PHASE_IDS.liquid].includes(gpuPhaseId(from))) {
    return { condensedPhase: from, vaporPhase: to };
  }
  return null;
}

function typedClosureCarrierRoutePair(properties = null) {
  if (!typedMaterialClosureModel(properties)) return null;
  const condensedPhases = new Set();
  for (const phaseEntry of properties?.phases || []) {
    const phase = canonicalPhase(phaseEntry?.name ?? '', 'phase.name');
    const phaseId = gpuPhaseId(phase);
    if ([GPU_PHASE_IDS.solid, GPU_PHASE_IDS.liquid].includes(phaseId)) {
      condensedPhases.add(phase);
    }
  }
  if (condensedPhases.size !== 1) return null;
  return {
    condensedPhase: [...condensedPhases][0],
    // This identifies the four-lane gas carrier used by the collective
    // producer. It is deliberately not a fabricated thermodynamic transition
    // on the material closure.
    vaporPhase: 'gas'
  };
}

function routePairFromStaticDescriptor(descriptor = {}) {
  if (descriptor.condensedPhase != null && descriptor.vaporPhase != null) {
    return {
      condensedPhase: descriptor.condensedPhase,
      vaporPhase: descriptor.vaporPhase
    };
  }
  return transitionRoutePair(descriptor);
}

function descriptorMaterialMatches(descriptor, material) {
  const candidate = descriptor?.material ?? descriptor?.key ?? null;
  return candidate != null
    && String(candidate).trim().toLowerCase() === String(material).trim().toLowerCase();
}

function renderKeyForRoute(staticPhaseDescriptors, material, vaporPhase, condensedPhase) {
  const matches = staticPhaseDescriptors.filter((descriptor) => (
    descriptorMaterialMatches(descriptor, material)
  ));
  const preferred = matches.find((descriptor) => (
    canonicalPhase(descriptor.phase ?? 'unknown', 'phase') === vaporPhase
  )) ?? matches.find((descriptor) => (
    canonicalPhase(descriptor.phase ?? 'unknown', 'phase') === condensedPhase
  )) ?? matches[0];
  return preferred?.renderKey ?? preferred?.key ?? material;
}

function appendRouteDescriptor(result, routeById, routeByKey, route) {
  const descriptor = collectiveOpticalRouteDescriptor(route);
  const collidingKey = routeById.get(descriptor.routeId);
  if (collidingKey != null && collidingKey !== descriptor.routeKey) {
    throw new Error(
      `collective optical route id collision ${descriptor.routeId}: ${collidingKey} versus ${descriptor.routeKey}`
    );
  }
  routeById.set(descriptor.routeId, descriptor.routeKey);
  if (routeByKey.has(descriptor.routeKey)) return;
  routeByKey.add(descriptor.routeKey);
  result.push(descriptor);
}

/**
 * Derive every volatile condensed<->gas collective route from static material
 * closures. Explicit paired static descriptors may add routes not represented
 * by a transition record; ordinary per-particle descriptors only contribute a
 * presentation render key and never dynamic optical state.
 */
export function collectiveOpticalRouteDescriptorsFromMaterialProperties(
  materialProperties = {},
  {
    staticPhaseDescriptors = [],
    closureModel = null
  } = {}
) {
  if (!materialProperties || typeof materialProperties !== 'object') {
    throw new TypeError('materialProperties must be an object');
  }
  if (!Array.isArray(staticPhaseDescriptors)) {
    throw new TypeError('staticPhaseDescriptors must be an array');
  }
  const result = [];
  const routeById = new Map();
  const routeByKey = new Set();
  const sortedMaterials = Object.entries(materialProperties)
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [material, properties] of sortedMaterials) {
    for (const transition of properties?.transitions || []) {
      const pair = transitionRoutePair(transition);
      if (!pair) continue;
      appendRouteDescriptor(result, routeById, routeByKey, {
        material,
        properties,
        ...pair,
        closureModel: routeClosureModel({
          routeOverride: explicitRouteClosureModel(transition),
          globalOverride: closureModel,
          properties
        }),
        renderKey: renderKeyForRoute(
          staticPhaseDescriptors,
          material,
          canonicalPhase(pair.vaporPhase, 'vaporPhase'),
          canonicalPhase(pair.condensedPhase, 'condensedPhase')
        )
      });
    }
    const typedCarrierPair = typedClosureCarrierRoutePair(properties);
    if (typedCarrierPair) {
      appendRouteDescriptor(result, routeById, routeByKey, {
        material,
        properties,
        ...typedCarrierPair,
        closureModel: routeClosureModel({ properties }),
        renderKey: renderKeyForRoute(
          staticPhaseDescriptors,
          material,
          typedCarrierPair.vaporPhase,
          typedCarrierPair.condensedPhase
        )
      });
    }
  }

  for (const staticDescriptor of staticPhaseDescriptors) {
    const pair = routePairFromStaticDescriptor(staticDescriptor);
    if (!pair || !staticDescriptor?.material) continue;
    const properties = Object.entries(materialProperties).find(([material]) => (
      descriptorMaterialMatches(staticDescriptor, material)
    ))?.[1] ?? null;
    appendRouteDescriptor(result, routeById, routeByKey, {
      material: staticDescriptor.material,
      properties,
      ...pair,
      closureModel: routeClosureModel({
        routeOverride: explicitRouteClosureModel(staticDescriptor),
        globalOverride: closureModel,
        properties
      }),
      renderKey: staticDescriptor.renderKey ?? staticDescriptor.key
    });
  }

  result.sort((left, right) => left.routeKey.localeCompare(right.routeKey));
  return Object.freeze(result);
}
