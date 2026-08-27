/**
 * Ordered initial-body authority for the SPH phase demo.
 *
 * Bodies are deliberately axis-aligned at initialization. Identity is separate
 * from array position: `id` is the user-facing stable identity and `domainId`
 * is the positive integer carried by GPU/render-domain records. The containing
 * array is authoritative for order.
 */

export const SPH_INITIAL_BODIES_SCHEMA =
  'peercompute.ulg.sph-initial-bodies.v0';

export const SPH_INITIAL_BODIES_SIMULATION_PREFLIGHT_SCHEMA =
  'peercompute.ulg.sph-initial-bodies-simulation-preflight.v0';

export const DEFAULT_SPH_INITIAL_BODY_MAX_CELL_PITCH_ANISOTROPY_RATIO = 1.05;
export const DEFAULT_SPH_INITIAL_BODIES_MAX_CROSS_BODY_CELL_PITCH_RATIO = 2;
export const SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES = 262_144;

export const SPH_INITIAL_BODY_LEGACY_ROLES = Object.freeze(['base', 'drop']);

const BODY_KEYS = new Set([
  'id',
  'domainId',
  'material',
  'sizeM',
  'centerM',
  'temperatureK',
  'particlesPerEdge',
  'velocityMPerS',
  'legacyRole'
]);

const CONTAINER_KEYS = new Set(['schema', 'bodies']);
const BODY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export class SphInitialBodiesValidationError extends TypeError {
  constructor(message, { code = 'invalid-sph-initial-bodies', path = null } = {}) {
    super(path ? `${path}: ${message}` : message);
    this.name = 'SphInitialBodiesValidationError';
    this.code = code;
    this.path = path;
  }
}

function fail(message, { code, path } = {}) {
  throw new SphInitialBodiesValidationError(message, { code, path });
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownKeys(value, allowedKeys, path) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      fail(`unknown field '${key}'`, {
        code: 'unknown-field',
        path: `${path}.${key}`
      });
    }
  }
}

function finiteNumber(value, path) {
  if (
    value == null
    || typeof value === 'boolean'
    || (typeof value === 'string' && value.trim() === '')
  ) {
    fail('must be a finite number', { code: 'nonfinite-number', path });
  }
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized)) {
    fail('must be a finite number', { code: 'nonfinite-number', path });
  }
  return Object.is(normalized, -0) ? 0 : normalized;
}

function positiveNumber(value, path) {
  const normalized = finiteNumber(value, path);
  if (!(normalized > 0)) {
    fail('must be greater than zero', { code: 'nonpositive-number', path });
  }
  return normalized;
}

function finiteFloat32Number(value, path) {
  const normalized = finiteNumber(value, path);
  if (!Number.isFinite(Math.fround(normalized))) {
    fail('must remain finite when encoded as float32', {
      code: 'float32-out-of-range',
      path
    });
  }
  return normalized;
}

function positiveFloat32Number(value, path) {
  const normalized = positiveNumber(value, path);
  const encoded = Math.fround(normalized);
  if (!Number.isFinite(encoded)) {
    fail('must remain finite when encoded as float32', {
      code: 'float32-out-of-range',
      path
    });
  }
  if (!(encoded > 0)) {
    fail('must remain greater than zero when encoded as float32', {
      code: 'positive-float32-underflow',
      path
    });
  }
  return normalized;
}

function positiveSafeInteger(value, path) {
  const normalized = finiteNumber(value, path);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('must be a positive safe integer', {
      code: 'invalid-positive-integer',
      path
    });
  }
  return normalized;
}

function positiveGpuDomainId(value, path) {
  const normalized = positiveSafeInteger(value, path);
  // The resident sidecar is u32, but native render rows currently carry the
  // domain into a float32 lane. Keep every accepted identity exactly
  // representable across both authorities so distinct bodies cannot alias.
  if (normalized > 0x00ffffff) {
    fail('must fit in the exact positive integer range shared by u32 and float32 render identity', {
      code: 'domain-id-out-of-range',
      path
    });
  }
  return normalized;
}

function safePositiveIntegerProduct(values, path) {
  let product = 1;
  for (const value of values) {
    if (value > Math.floor(Number.MAX_SAFE_INTEGER / product)) {
      fail('particle-count product must be a positive safe integer', {
        code: 'unsafe-particle-count-product',
        path
      });
    }
    product *= value;
  }
  return product;
}

function vector3(value, path, componentNormalizer = finiteNumber) {
  if (!Array.isArray(value) || value.length !== 3) {
    fail('must be an XYZ array with exactly three entries', {
      code: 'invalid-vector3',
      path
    });
  }
  return Object.freeze(value.map((component, axis) => (
    componentNormalizer(component, `${path}[${axis}]`)
  )));
}

function nonEmptyString(value, path, { id = false } = {}) {
  if (typeof value !== 'string') {
    fail('must be a string', { code: 'invalid-string', path });
  }
  const normalized = value.trim();
  if (!normalized) {
    fail('must not be empty', { code: 'empty-string', path });
  }
  if (id && !BODY_ID_PATTERN.test(normalized)) {
    fail(
      'must start with an alphanumeric character and contain only alphanumerics, dot, underscore, colon, or hyphen',
      { code: 'invalid-body-id', path }
    );
  }
  if (!id && (/\p{Cc}/u.test(normalized) || normalized.length > 128)) {
    fail('contains unsupported control characters or is longer than 128 characters', {
      code: 'invalid-material',
      path
    });
  }
  return normalized;
}

function normalizeLegacyRole(value, path) {
  const role = nonEmptyString(value, path);
  if (!SPH_INITIAL_BODY_LEGACY_ROLES.includes(role)) {
    fail("must be either 'base' or 'drop'", {
      code: 'invalid-legacy-role',
      path
    });
  }
  return role;
}

function normalizeBody(body, index) {
  const path = `bodies[${index}]`;
  if (!isRecord(body)) {
    fail('must be an object', { code: 'invalid-body', path });
  }
  rejectUnknownKeys(body, BODY_KEYS, path);

  const normalized = {
    id: nonEmptyString(body.id, `${path}.id`, { id: true }),
    domainId: positiveGpuDomainId(body.domainId, `${path}.domainId`),
    material: nonEmptyString(body.material, `${path}.material`),
    sizeM: vector3(body.sizeM, `${path}.sizeM`, positiveFloat32Number),
    centerM: vector3(body.centerM, `${path}.centerM`, finiteFloat32Number),
    temperatureK: positiveFloat32Number(body.temperatureK, `${path}.temperatureK`),
    particlesPerEdge: vector3(
      body.particlesPerEdge,
      `${path}.particlesPerEdge`,
      positiveSafeInteger
    ),
    velocityMPerS: vector3(body.velocityMPerS, `${path}.velocityMPerS`, finiteFloat32Number)
  };
  safePositiveIntegerProduct(normalized.particlesPerEdge, `${path}.particlesPerEdge`);

  if (body.legacyRole != null) {
    normalized.legacyRole = normalizeLegacyRole(
      body.legacyRole,
      `${path}.legacyRole`
    );
  }

  return Object.freeze(normalized);
}

function normalizedBodyArrayInput(value) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) {
    fail('must be a body array or a versioned body container', {
      code: 'invalid-container',
      path: 'initialBodies'
    });
  }
  rejectUnknownKeys(value, CONTAINER_KEYS, 'initialBodies');
  if (value.schema !== SPH_INITIAL_BODIES_SCHEMA) {
    fail(`must use schema '${SPH_INITIAL_BODIES_SCHEMA}'`, {
      code: 'unsupported-schema',
      path: 'initialBodies.schema'
    });
  }
  if (!Array.isArray(value.bodies)) {
    fail('must be an array', {
      code: 'invalid-bodies-array',
      path: 'initialBodies.bodies'
    });
  }
  return value.bodies;
}

/** Normalize, validate, clone, and deeply freeze an ordered body collection. */
export function normalizeSphInitialBodies(value) {
  const bodies = normalizedBodyArrayInput(value).map(normalizeBody);
  const ids = new Set();
  const domainIds = new Set();
  let totalLiveParticleCount = 0;
  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index];
    if (ids.has(body.id)) {
      fail(`duplicate body id '${body.id}'`, {
        code: 'duplicate-body-id',
        path: `bodies[${index}].id`
      });
    }
    if (domainIds.has(body.domainId)) {
      fail(`duplicate domain id '${body.domainId}'`, {
        code: 'duplicate-domain-id',
        path: `bodies[${index}].domainId`
      });
    }
    ids.add(body.id);
    domainIds.add(body.domainId);
    const bodyParticleCount = safePositiveIntegerProduct(
      body.particlesPerEdge,
      `bodies[${index}].particlesPerEdge`
    );
    if (
      bodyParticleCount > SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES
      || totalLiveParticleCount > SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES - bodyParticleCount
    ) {
      fail(
        `total live particle count must not exceed ${SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES}`,
        {
          code: 'initial-live-particle-cap-exceeded',
          path: 'bodies'
        }
      );
    }
    totalLiveParticleCount += bodyParticleCount;
  }
  return Object.freeze({
    schema: SPH_INITIAL_BODIES_SCHEMA,
    bodies: Object.freeze(bodies)
  });
}

/** Normalize one body using the same strict contract as a collection. */
export function normalizeSphInitialBody(body) {
  return normalizeSphInitialBodies([body]).bodies[0];
}

/** Derive a frozen XYZ size while preserving a body's per-axis cell pitch. */
export function deriveSphInitialBodySizeM(body, particlesPerEdge) {
  const normalizedBody = normalizeSphInitialBody(body);
  const resizedBody = normalizeSphInitialBody({
    ...normalizedBody,
    particlesPerEdge
  });
  return normalizeSphInitialBody({
    ...resizedBody,
    sizeM: normalizedBody.sizeM.map((size, axis) => (
      size
      / normalizedBody.particlesPerEdge[axis]
      * resizedBody.particlesPerEdge[axis]
    ))
  }).sizeM;
}

/**
 * Return the next deterministic identity for an appended body.
 *
 * String identities use `<idPrefix>-N`, with N one greater than the largest
 * existing suffix for that prefix. GPU domain identities use max(domainId)+1.
 */
export function allocateNextSphInitialBodyIdentity(value, { idPrefix = 'body' } = {}) {
  const initialBodies = normalizeSphInitialBodies(value);
  const prefix = nonEmptyString(idPrefix, 'idPrefix', { id: true });
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixPattern = new RegExp(`^${escapedPrefix}-(\\d+)$`);
  const usedIds = new Set(initialBodies.bodies.map((body) => body.id));
  let largestSuffix = 0;
  let largestDomainId = 0;
  for (const body of initialBodies.bodies) {
    const match = suffixPattern.exec(body.id);
    if (match) largestSuffix = Math.max(largestSuffix, Number(match[1]));
    largestDomainId = Math.max(largestDomainId, body.domainId);
  }

  let suffix = largestSuffix + 1;
  let id = `${prefix}-${suffix}`;
  while (usedIds.has(id)) {
    suffix += 1;
    id = `${prefix}-${suffix}`;
  }
  if (!BODY_ID_PATTERN.test(id)) {
    fail('allocated id exceeds the supported 128-character body id contract', {
      code: 'allocated-body-id-invalid',
      path: 'idPrefix'
    });
  }
  const domainId = largestDomainId + 1;
  if (!Number.isSafeInteger(domainId) || domainId > 0x00ffffff) {
    fail('no exact shared u32/float32 GPU domain id remains', {
      code: 'domain-id-space-exhausted',
      path: 'bodies'
    });
  }
  return Object.freeze({ id, domainId });
}

/** Duplicate a body immediately after its source with fresh stable identities. */
export function duplicateSphInitialBody(value, sourceId) {
  const initialBodies = normalizeSphInitialBodies(value);
  const normalizedSourceId = nonEmptyString(sourceId, 'sourceId', { id: true });
  const sourceIndex = initialBodies.bodies.findIndex(
    (body) => body.id === normalizedSourceId
  );
  if (sourceIndex < 0) {
    fail(`body '${normalizedSourceId}' does not exist`, {
      code: 'body-not-found',
      path: 'sourceId'
    });
  }
  const source = initialBodies.bodies[sourceIndex];
  const identity = allocateNextSphInitialBodyIdentity(initialBodies, {
    idPrefix: `${source.id}-copy`
  });
  const duplicate = {
    ...source,
    id: identity.id,
    domainId: identity.domainId
  };
  // A duplicate is a general body, not a second claimant for a unique legacy
  // base/drop role. The caller may explicitly rebuild legacy state if needed.
  delete duplicate.legacyRole;
  const bodies = [...initialBodies.bodies];
  bodies.splice(sourceIndex + 1, 0, duplicate);
  return normalizeSphInitialBodies(bodies);
}

/** Reorder by a complete ordered list of ids, preserving all body identities. */
export function reorderSphInitialBodies(value, orderedIds) {
  const initialBodies = normalizeSphInitialBodies(value);
  if (!Array.isArray(orderedIds) || orderedIds.length !== initialBodies.bodies.length) {
    fail('must contain exactly one id for every body', {
      code: 'invalid-reorder',
      path: 'orderedIds'
    });
  }
  const byId = new Map(initialBodies.bodies.map((body) => [body.id, body]));
  const seen = new Set();
  const bodies = orderedIds.map((id, index) => {
    const normalizedId = nonEmptyString(id, `orderedIds[${index}]`, { id: true });
    if (seen.has(normalizedId)) {
      fail(`duplicate body id '${normalizedId}'`, {
        code: 'duplicate-reorder-id',
        path: `orderedIds[${index}]`
      });
    }
    const body = byId.get(normalizedId);
    if (!body) {
      fail(`body '${normalizedId}' does not exist`, {
        code: 'body-not-found',
        path: `orderedIds[${index}]`
      });
    }
    seen.add(normalizedId);
    return body;
  });
  return normalizeSphInitialBodies(bodies);
}

/** Move one body to an array index while retaining its id and domain id. */
export function moveSphInitialBody(value, bodyId, toIndex) {
  const initialBodies = normalizeSphInitialBodies(value);
  const normalizedId = nonEmptyString(bodyId, 'bodyId', { id: true });
  if (!Number.isSafeInteger(toIndex) || toIndex < 0 || toIndex >= initialBodies.bodies.length) {
    fail('must be an in-range body index', {
      code: 'invalid-move-index',
      path: 'toIndex'
    });
  }
  const fromIndex = initialBodies.bodies.findIndex((body) => body.id === normalizedId);
  if (fromIndex < 0) {
    fail(`body '${normalizedId}' does not exist`, {
      code: 'body-not-found',
      path: 'bodyId'
    });
  }
  const bodies = [...initialBodies.bodies];
  const [body] = bodies.splice(fromIndex, 1);
  bodies.splice(toIndex, 0, body);
  return normalizeSphInitialBodies(bodies);
}

/** Canonical JSON suitable for use as one URLSearchParams `bodies` value. */
export function serializeSphInitialBodies(value) {
  return JSON.stringify(normalizeSphInitialBodies(value));
}

/** Parse canonical body JSON from one URLSearchParams `bodies` value. */
export function parseSphInitialBodies(serialized) {
  if (typeof serialized !== 'string' || serialized.trim() === '') {
    fail('must be a non-empty JSON string', {
      code: 'invalid-serialization',
      path: 'serialized'
    });
  }
  let decoded;
  try {
    decoded = JSON.parse(serialized);
  } catch (error) {
    fail(`is not valid JSON (${error.message})`, {
      code: 'invalid-json',
      path: 'serialized'
    });
  }
  return normalizeSphInitialBodies(decoded);
}

/** Exact canonical cache signature. Body array order is intentionally included. */
export function sphInitialBodiesSignature(value) {
  return serializeSphInitialBodies(value);
}

function preflightLimit(value, fallback, path) {
  if (value == null) return fallback;
  const normalized = finiteNumber(value, path);
  if (normalized < 1) {
    fail('must be at least 1', { code: 'invalid-preflight-limit', path });
  }
  return normalized;
}

/**
 * Verify that each axis samples approximately the same physical cell pitch
 * and that representative pitches remain compatible across bodies.
 */
export function preflightSphInitialBodiesForSimulation(value, {
  maxCellPitchAnisotropyRatio = DEFAULT_SPH_INITIAL_BODY_MAX_CELL_PITCH_ANISOTROPY_RATIO,
  maxCrossBodyCellPitchRatio = DEFAULT_SPH_INITIAL_BODIES_MAX_CROSS_BODY_CELL_PITCH_RATIO
} = {}) {
  const initialBodies = normalizeSphInitialBodies(value);
  const anisotropyLimit = preflightLimit(
    maxCellPitchAnisotropyRatio,
    DEFAULT_SPH_INITIAL_BODY_MAX_CELL_PITCH_ANISOTROPY_RATIO,
    'maxCellPitchAnisotropyRatio'
  );
  const crossBodyLimit = preflightLimit(
    maxCrossBodyCellPitchRatio,
    DEFAULT_SPH_INITIAL_BODIES_MAX_CROSS_BODY_CELL_PITCH_RATIO,
    'maxCrossBodyCellPitchRatio'
  );
  const blockers = [];
  const totalLiveParticleCount = initialBodies.bodies.reduce((total, body, index) => (
    total + safePositiveIntegerProduct(
      body.particlesPerEdge,
      `bodies[${index}].particlesPerEdge`
    )
  ), 0);
  const bodyPitches = initialBodies.bodies.map((body) => {
    const cellPitchM = body.sizeM.map((size, axis) => (
      size / body.particlesPerEdge[axis]
    ));
    const minCellPitchM = Math.min(...cellPitchM);
    const maxCellPitchM = Math.max(...cellPitchM);
    const anisotropyRatio = maxCellPitchM / minCellPitchM;
    const approximatelyIsotropic = anisotropyRatio <= anisotropyLimit;
    if (!approximatelyIsotropic) {
      blockers.push(`body-cell-pitch-anisotropy:${body.id}`);
    }
    return Object.freeze({
      id: body.id,
      domainId: body.domainId,
      cellPitchM: Object.freeze(cellPitchM),
      representativeCellPitchM: Math.cbrt(
        cellPitchM[0] * cellPitchM[1] * cellPitchM[2]
      ),
      minCellPitchM,
      maxCellPitchM,
      anisotropyRatio,
      approximatelyIsotropic
    });
  });

  if (bodyPitches.length === 0) blockers.push('initial-bodies-empty');
  const representativePitches = bodyPitches.map((body) => body.representativeCellPitchM);
  const minRepresentativeCellPitchM = representativePitches.length
    ? Math.min(...representativePitches)
    : null;
  const maxRepresentativeCellPitchM = representativePitches.length
    ? Math.max(...representativePitches)
    : null;
  const crossBodyCellPitchRatio = representativePitches.length
    ? maxRepresentativeCellPitchM / minRepresentativeCellPitchM
    : null;
  const crossBodyCellPitchWithinLimit = crossBodyCellPitchRatio == null
    ? false
    : crossBodyCellPitchRatio <= crossBodyLimit;
  if (crossBodyCellPitchRatio != null && !crossBodyCellPitchWithinLimit) {
    blockers.push('cross-body-cell-pitch-ratio-exceeded');
  }

  const feasible = blockers.length === 0;
  return Object.freeze({
    schema: SPH_INITIAL_BODIES_SIMULATION_PREFLIGHT_SCHEMA,
    status: feasible
      ? 'simulation-preflight-ready'
      : 'simulation-preflight-blocked',
    feasible,
    bodyCount: initialBodies.bodies.length,
    totalLiveParticleCount,
    limits: Object.freeze({
      maxCellPitchAnisotropyRatio: anisotropyLimit,
      maxCrossBodyCellPitchRatio: crossBodyLimit,
      maxTotalLiveParticles: SPH_INITIAL_BODIES_MAX_TOTAL_LIVE_PARTICLES
    }),
    bodyPitches: Object.freeze(bodyPitches),
    crossBodyPitch: Object.freeze({
      minRepresentativeCellPitchM,
      maxRepresentativeCellPitchM,
      ratio: crossBodyCellPitchRatio,
      withinLimit: crossBodyCellPitchWithinLimit
    }),
    blockers: Object.freeze(blockers)
  });
}

function legacyVector(value, path, componentNormalizer) {
  const expanded = Array.isArray(value) ? value : [value, value, value];
  return vector3(expanded, path, componentNormalizer);
}

/**
 * Adapt the old base/drop controls after their block sizes and centers have
 * been resolved. The order and domain ids reproduce the existing particle
 * ordering: base/domain 1, then drop/domain 2.
 */
export function sphInitialBodiesFromLegacyDropBase({
  baseId = 'base',
  dropId = 'drop',
  baseDomainId = 1,
  dropDomainId = 2,
  baseMaterial,
  dropMaterial,
  baseSizeM,
  dropSizeM,
  baseCenterM,
  dropCenterM,
  baseTemperatureK,
  dropTemperatureK,
  baseParticlesPerEdge,
  dropParticlesPerEdge,
  baseVelocityMPerS = [0, 0, 0],
  dropVelocityMPerS = [0, 0, 0]
} = {}) {
  return normalizeSphInitialBodies([
    {
      id: baseId,
      domainId: baseDomainId,
      material: baseMaterial,
      sizeM: legacyVector(baseSizeM, 'baseSizeM', positiveNumber),
      centerM: vector3(baseCenterM, 'baseCenterM'),
      temperatureK: baseTemperatureK,
      particlesPerEdge: legacyVector(
        baseParticlesPerEdge,
        'baseParticlesPerEdge',
        positiveSafeInteger
      ),
      velocityMPerS: vector3(baseVelocityMPerS, 'baseVelocityMPerS'),
      legacyRole: 'base'
    },
    {
      id: dropId,
      domainId: dropDomainId,
      material: dropMaterial,
      sizeM: legacyVector(dropSizeM, 'dropSizeM', positiveNumber),
      centerM: vector3(dropCenterM, 'dropCenterM'),
      temperatureK: dropTemperatureK,
      particlesPerEdge: legacyVector(
        dropParticlesPerEdge,
        'dropParticlesPerEdge',
        positiveSafeInteger
      ),
      velocityMPerS: vector3(dropVelocityMPerS, 'dropVelocityMPerS'),
      legacyRole: 'drop'
    }
  ]);
}

/**
 * Resolve the legacy phase-demo proxy controls into the exact ordered initial
 * bodies consumed by the runtime.
 *
 * The historical controls share one fixed matter pitch: the reference base
 * edge divided by its reference five-cell sampling. Changing either edge-count
 * control changes the physical block size by N * pitch; it does not ask the
 * material-specific legacy spacing planner to choose a second geometry.
 */
export function sphInitialBodiesFromLegacyPhaseControls({
  baseMaterial,
  dropMaterial,
  baseTemperatureK,
  dropTemperatureK,
  baseParticlesPerEdge = 5,
  dropParticlesPerEdge = 3,
  referenceBaseEdgeM = 1,
  referenceBaseParticlesPerEdge = 5,
  sceneLengthScale = 1,
  referenceBoxDimensionsM = [5, 5, 5],
  referenceBaseBottomM = 0,
  referenceDropBottomM = 2.5,
  baseVelocityMPerS = [0, 0, 0],
  dropVelocityMPerS = [0, 0, 0]
} = {}) {
  const scale = positiveNumber(sceneLengthScale, 'sceneLengthScale');
  const referenceBaseEdge = positiveNumber(
    referenceBaseEdgeM,
    'referenceBaseEdgeM'
  );
  const referencePitchCount = positiveSafeInteger(
    referenceBaseParticlesPerEdge,
    'referenceBaseParticlesPerEdge'
  );
  const baseCount = positiveSafeInteger(
    baseParticlesPerEdge,
    'baseParticlesPerEdge'
  );
  const dropCount = positiveSafeInteger(
    dropParticlesPerEdge,
    'dropParticlesPerEdge'
  );
  const referenceBox = vector3(
    referenceBoxDimensionsM,
    'referenceBoxDimensionsM',
    positiveNumber
  );
  const baseBottomM =
    finiteNumber(referenceBaseBottomM, 'referenceBaseBottomM') * scale;
  const dropBottomM =
    finiteNumber(referenceDropBottomM, 'referenceDropBottomM') * scale;
  const boxDimensionsM = referenceBox.map((extent) => extent * scale);
  const cellPitchM = referenceBaseEdge * scale / referencePitchCount;
  const baseEdgeM = cellPitchM * baseCount;
  const dropEdgeM = cellPitchM * dropCount;
  const centerX = boxDimensionsM[0] / 2;
  const centerZ = boxDimensionsM[2] / 2;

  return sphInitialBodiesFromLegacyDropBase({
    baseMaterial,
    dropMaterial,
    baseSizeM: [baseEdgeM, baseEdgeM, baseEdgeM],
    dropSizeM: [dropEdgeM, dropEdgeM, dropEdgeM],
    baseCenterM: [centerX, baseBottomM + baseEdgeM / 2, centerZ],
    dropCenterM: [centerX, dropBottomM + dropEdgeM / 2, centerZ],
    baseTemperatureK,
    dropTemperatureK,
    baseParticlesPerEdge: [baseCount, baseCount, baseCount],
    dropParticlesPerEdge: [dropCount, dropCount, dropCount],
    baseVelocityMPerS,
    dropVelocityMPerS
  });
}

/** Extract the unique legacy base/drop bodies without changing their geometry. */
export function sphInitialBodiesToLegacyDropBase(value) {
  const initialBodies = normalizeSphInitialBodies(value);
  const byRole = new Map();
  for (const body of initialBodies.bodies) {
    if (body.legacyRole == null) continue;
    if (byRole.has(body.legacyRole)) {
      fail(`multiple bodies claim legacy role '${body.legacyRole}'`, {
        code: 'duplicate-legacy-role',
        path: 'bodies'
      });
    }
    byRole.set(body.legacyRole, body);
  }
  for (const role of SPH_INITIAL_BODY_LEGACY_ROLES) {
    if (!byRole.has(role)) {
      fail(`no body claims legacy role '${role}'`, {
        code: 'missing-legacy-role',
        path: 'bodies'
      });
    }
  }
  return Object.freeze({
    base: byRole.get('base'),
    drop: byRole.get('drop')
  });
}
