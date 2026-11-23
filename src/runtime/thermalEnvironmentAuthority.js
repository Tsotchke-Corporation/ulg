export const ULG_SPH_THERMAL_ENVIRONMENT_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-thermal-environment-authority.v0';
export const ULG_SPH_WALL_RESERVOIR_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-wall-reservoir-authority.v0';

export const SPH_THERMAL_AMBIENT_TEMPERATURE_K_DEFAULT = 293;
export const SPH_THERMAL_WALL_FACE_IDS = Object.freeze([
  'xMin',
  'xMax',
  'yMin',
  'yMax',
  'zMin',
  'zMax'
]);
export const SPH_THERMAL_WALL_MODEL_FIXED =
  'infinite-fixed-temperature-reservoir';
export const SPH_THERMAL_WALL_MODEL_ADIABATIC = 'adiabatic';
// Honest walls: each face is a finite lumped body (one temperature per face)
// whose temperature moves with the heat it exchanges, T += Q / C. C is the
// face's heat capacity, derived from a declared wall material and thickness
// (rho * c * area * thickness), never an assumed reservoir.
export const SPH_THERMAL_WALL_MODEL_FINITE =
  'finite-heat-capacity-lumped-face';

/** Per-face heat capacity of a thin lumped wall of one material. */
export function sphWallFaceHeatCapacitiesJPerK({
  boxDimsM,
  densityKgPerM3,
  specificHeatJPerKgK,
  thicknessM
} = {}) {
  const [x, y, z] = Array.from(boxDimsM || []).map(Number);
  const rho = Number(densityKgPerM3);
  const c = Number(specificHeatJPerKgK);
  const t = Number(thicknessM);
  if (![x, y, z, rho, c, t].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError(
      'wall face heat capacity requires positive box dimensions, density, specific heat and thickness'
    );
  }
  const perArea = rho * c * t;
  return Object.freeze({
    xMin: perArea * y * z,
    xMax: perArea * y * z,
    yMin: perArea * x * z,
    yMax: perArea * x * z,
    zMin: perArea * x * y,
    zMax: perArea * x * y
  });
}

function finiteAmbientTemperatureK(value, label) {
  const resolved = Number(value);
  if (!Number.isFinite(resolved)) {
    throw new RangeError(`${label} must be finite`);
  }
  return Math.max(0, resolved);
}

function assertInheritedAuthorityEnvelope(authority, {
  label,
  readyStatus
}) {
  if (authority.status !== readyStatus) {
    throw new TypeError(`${label}.status must be ${readyStatus}`);
  }
  if (authority.authoritative !== true) {
    throw new TypeError(`${label}.authoritative must be true`);
  }
  if (
    typeof authority.source !== 'string'
    || authority.source.trim().length === 0
  ) {
    throw new TypeError(`${label}.source must be a nonempty string`);
  }
  if (typeof authority.defaultApplied !== 'boolean') {
    throw new TypeError(`${label}.defaultApplied must be boolean`);
  }
}

/**
 * Resolve one authoritative ambient-temperature value at a runtime boundary.
 * An inherited authority may supply the value; when both a scalar and an
 * authority are present they must agree, so provenance cannot silently drift.
 */
export function resolveSphThermalEnvironmentAuthority({
  ambientTemperatureK,
  thermalEnvironmentAuthority = null,
  defaultAmbientTemperatureK = SPH_THERMAL_AMBIENT_TEMPERATURE_K_DEFAULT,
  source = 'thermal-step-caller',
  defaultSource = 'sph-thermal-kernel-default',
  sourceScenarioId = null
} = {}) {
  const inherited = thermalEnvironmentAuthority != null;
  if (
    inherited
    && thermalEnvironmentAuthority?.schema !== ULG_SPH_THERMAL_ENVIRONMENT_AUTHORITY_SCHEMA
  ) {
    throw new TypeError(
      `thermalEnvironmentAuthority must use ${ULG_SPH_THERMAL_ENVIRONMENT_AUTHORITY_SCHEMA}`
    );
  }
  if (inherited) {
    assertInheritedAuthorityEnvelope(thermalEnvironmentAuthority, {
      label: 'thermalEnvironmentAuthority',
      readyStatus: 'thermal-environment-authority-ready'
    });
  }

  const scalarProvided = ambientTemperatureK !== undefined;
  const inheritedTemperatureK = inherited
    ? finiteAmbientTemperatureK(
        thermalEnvironmentAuthority.ambientTemperatureK,
        'thermalEnvironmentAuthority.ambientTemperatureK'
      )
    : null;
  const scalarTemperatureK = scalarProvided
    ? finiteAmbientTemperatureK(ambientTemperatureK, 'ambientTemperatureK')
    : null;
  if (
    scalarProvided
    && inherited
    && scalarTemperatureK !== inheritedTemperatureK
  ) {
    throw new RangeError(
      'ambientTemperatureK must match thermalEnvironmentAuthority.ambientTemperatureK'
    );
  }

  const defaultApplied = !scalarProvided && !inherited;
  const resolvedAmbientTemperatureK = scalarProvided
    ? scalarTemperatureK
    : (inherited
        ? inheritedTemperatureK
        : finiteAmbientTemperatureK(
            defaultAmbientTemperatureK,
            'defaultAmbientTemperatureK'
          ));
  return Object.freeze({
    schema: ULG_SPH_THERMAL_ENVIRONMENT_AUTHORITY_SCHEMA,
    status: 'thermal-environment-authority-ready',
    ambientTemperatureK: resolvedAmbientTemperatureK,
    source: inherited
      ? thermalEnvironmentAuthority.source
      : (defaultApplied ? defaultSource : source),
    sourceScenarioId:
      thermalEnvironmentAuthority?.sourceScenarioId
      ?? sourceScenarioId
      ?? null,
    defaultApplied:
      inherited
        ? thermalEnvironmentAuthority.defaultApplied === true
        : defaultApplied,
    inheritedAuthority: inherited,
    authoritative: true,
    scientificValidation: false,
    fullPhysicsValidation: false
  });
}

function finiteWallTemperatureK(value, label) {
  const resolved = Number(value);
  if (!Number.isFinite(resolved)) {
    throw new RangeError(`${label} must be finite`);
  }
  return resolved;
}

function assertWallModel(model, label) {
  if (
    model !== SPH_THERMAL_WALL_MODEL_FIXED
    && model !== SPH_THERMAL_WALL_MODEL_ADIABATIC
    && model !== SPH_THERMAL_WALL_MODEL_FINITE
  ) {
    throw new RangeError(
      `${label} must be ${SPH_THERMAL_WALL_MODEL_FIXED}, ${SPH_THERMAL_WALL_MODEL_ADIABATIC} or ${SPH_THERMAL_WALL_MODEL_FINITE}`
    );
  }
  return model;
}

function normalizedFaceHeatCapacities(capacities, label) {
  const faces = {};
  for (const faceId of SPH_THERMAL_WALL_FACE_IDS) {
    const value = Number(capacities?.[faceId]);
    if (!Number.isFinite(value) || !(value > 0)) {
      throw new RangeError(`${label}.${faceId} must be a positive finite J/K`);
    }
    faces[faceId] = value;
  }
  return Object.freeze(faces);
}

function wallInstanceId() {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    || `wall-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizedWallFaces(
  wallTemperaturesK,
  defaultWallTemperatureK,
  { requireEveryFace = false, label = 'wallTemperaturesK' } = {}
) {
  const faces = {};
  for (const faceId of SPH_THERMAL_WALL_FACE_IDS) {
    if (
      requireEveryFace
      && !Object.prototype.hasOwnProperty.call(wallTemperaturesK || {}, faceId)
    ) {
      throw new TypeError(`${label}.${faceId} is required`);
    }
    faces[faceId] = finiteWallTemperatureK(
      wallTemperaturesK?.[faceId] ?? defaultWallTemperatureK,
      `${label}.${faceId}`
    );
  }
  return Object.freeze(faces);
}

/**
 * Resolve one wall-boundary authority. Legacy scalar-map callers remain fixed
 * reservoirs (missing faces retain the historical 0 K fallback); adiabatic is
 * represented only by the explicit model and disables exchange independently
 * of the six carried face temperatures.
 */
export function resolveSphWallReservoirAuthority({
  wallTemperaturesK,
  wallReservoirAuthority = null,
  wallModel,
  wallFaceHeatCapacitiesJPerK = null,
  wallMaterial = null,
  wallThicknessM = null,
  defaultWallTemperatureK = 0,
  source = 'thermal-step-caller',
  defaultSource = 'sph-thermal-kernel-default',
  sourceScenarioId = null
} = {}) {
  const inherited = wallReservoirAuthority != null;
  if (
    inherited
    && wallReservoirAuthority?.schema !== ULG_SPH_WALL_RESERVOIR_AUTHORITY_SCHEMA
  ) {
    throw new TypeError(
      `wallReservoirAuthority must use ${ULG_SPH_WALL_RESERVOIR_AUTHORITY_SCHEMA}`
    );
  }
  if (inherited) {
    assertInheritedAuthorityEnvelope(wallReservoirAuthority, {
      label: 'wallReservoirAuthority',
      readyStatus: 'wall-reservoir-authority-ready'
    });
  }
  const inheritedModel = inherited
    ? assertWallModel(
        wallReservoirAuthority.model,
        'wallReservoirAuthority.model'
      )
    : null;
  const requestedModel = wallModel === undefined
    ? null
    : assertWallModel(wallModel, 'wallModel');
  if (inherited && requestedModel != null && requestedModel !== inheritedModel) {
    throw new RangeError('wallModel must match wallReservoirAuthority.model');
  }

  const inheritedFaces = inherited
    ? normalizedWallFaces(
        wallReservoirAuthority.faces,
        defaultWallTemperatureK,
        {
          requireEveryFace: true,
          label: 'wallReservoirAuthority.faces'
        }
      )
    : null;
  if (
    inherited
    && wallReservoirAuthority.exchangeEnabled
      !== (inheritedModel !== SPH_THERMAL_WALL_MODEL_ADIABATIC)
  ) {
    throw new TypeError(
      'wallReservoirAuthority.exchangeEnabled must match wallReservoirAuthority.model'
    );
  }
  if (
    inherited
    && wallReservoirAuthority.finiteCapacity
      !== (inheritedModel === SPH_THERMAL_WALL_MODEL_FINITE)
  ) {
    throw new TypeError(
      'wallReservoirAuthority.finiteCapacity must match wallReservoirAuthority.model'
    );
  }
  const scalarMapProvided = wallTemperaturesK !== undefined;
  const scalarFaces = scalarMapProvided
    ? normalizedWallFaces(wallTemperaturesK, defaultWallTemperatureK)
    : null;
  if (inherited && scalarMapProvided) {
    for (const faceId of SPH_THERMAL_WALL_FACE_IDS) {
      if (scalarFaces[faceId] !== inheritedFaces[faceId]) {
        throw new RangeError(
          `wallTemperaturesK.${faceId} must match wallReservoirAuthority.faces.${faceId}`
        );
      }
    }
  }

  const defaultApplied = !inherited && !scalarMapProvided && requestedModel == null;
  const model =
    inheritedModel
    ?? requestedModel
    ?? SPH_THERMAL_WALL_MODEL_FIXED;
  const faces =
    inheritedFaces
    ?? scalarFaces
    ?? normalizedWallFaces(undefined, defaultWallTemperatureK);
  const finite = model === SPH_THERMAL_WALL_MODEL_FINITE;
  // A finite wall carries its per-face heat capacity and a stable instance id
  // (minted when the scene resolves it; it survives structured clone, so the
  // GPU-resident face temperatures persist for the scene and reset with it).
  const faceHeatCapacitiesJPerK = finite
    ? normalizedFaceHeatCapacities(
        inherited
          ? wallReservoirAuthority.faceHeatCapacitiesJPerK
          : wallFaceHeatCapacitiesJPerK,
        inherited
          ? 'wallReservoirAuthority.faceHeatCapacitiesJPerK'
          : 'wallFaceHeatCapacitiesJPerK'
      )
    : null;
  const instanceId = finite
    ? String(
        inherited
          ? wallReservoirAuthority.instanceId || ''
          : wallInstanceId()
      )
    : null;
  if (finite && !instanceId) {
    throw new TypeError('wallReservoirAuthority.instanceId is required for finite walls');
  }
  const implicitZeroKelvinFaces = [];
  if (!inherited && model !== SPH_THERMAL_WALL_MODEL_ADIABATIC && defaultWallTemperatureK === 0) {
    for (const faceId of SPH_THERMAL_WALL_FACE_IDS) {
      const hasExplicit = scalarMapProvided
        && wallTemperaturesK
        && typeof wallTemperaturesK === 'object'
        && Object.prototype.hasOwnProperty.call(wallTemperaturesK, faceId)
        && wallTemperaturesK[faceId] !== undefined;
      if (!hasExplicit) implicitZeroKelvinFaces.push(faceId);
    }
  }
  return Object.freeze({
    schema: ULG_SPH_WALL_RESERVOIR_AUTHORITY_SCHEMA,
    status: 'wall-reservoir-authority-ready',
    model,
    faces,
    exchangeEnabled: model !== SPH_THERMAL_WALL_MODEL_ADIABATIC,
    finiteCapacity: finite,
    implicitZeroKelvinFaces: Object.freeze(implicitZeroKelvinFaces),
    implicitZeroKelvinFaceCount: implicitZeroKelvinFaces.length,
    ...(finite
      ? {
          faceHeatCapacitiesJPerK,
          instanceId,
          wallMaterial: inherited
            ? wallReservoirAuthority.wallMaterial ?? null
            : wallMaterial,
          wallThicknessM: inherited
            ? wallReservoirAuthority.wallThicknessM ?? null
            : wallThicknessM
        }
      : {}),
    source: inherited
      ? wallReservoirAuthority.source
      : (defaultApplied ? defaultSource : source),
    sourceScenarioId:
      wallReservoirAuthority?.sourceScenarioId
      ?? sourceScenarioId
      ?? null,
    defaultApplied:
      inherited
        ? wallReservoirAuthority.defaultApplied === true
        : defaultApplied,
    inheritedAuthority: inherited,
    authoritative: true,
    scientificValidation: false,
    fullPhysicsValidation: false
  });
}
