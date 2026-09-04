import {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT
} from './index.js';

export const ULG_SPH_SPATIAL_GAS_CANDIDATE_UNION_SCHEMA =
  'peercompute.ulg.sph-spatial-gas-candidate-union.v0';

export const SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_LAYOUT = Object.freeze([
  'positionXM:f32',
  'positionYM:f32',
  'positionZM:f32',
  'materialId:f32',
  'massKg:f32',
  'moles:f32',
  'temperatureK:f32',
  // This is diagnostic source volume. The spatial free-volume sidecar, not
  // this lane, is the pressure denominator for the retained EOS.
  'referenceVolumeM3:f32',
  // Product events carry their non-negative term index. A particle source is
  // tagged by the exactly representable f32 sentinel -1.
  'productTermIndexOrNegativeOne:f32',
  'sourceIndex:f32',
  'status:f32',
  'routingId:f32'
]);

export const SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS =
  SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_LAYOUT.length;

export const SPH_SPATIAL_GAS_CANDIDATE_ERROR = Object.freeze({
  NONE: 0,
  INVALID_CANDIDATE: 1 << 0,
  CONSERVATION: 1 << 1,
  // Source-specific aliases retain the retained authority bit meanings while
  // structured counts identify which half of the union was malformed.
  INVALID_PRODUCT_EVENT: 1 << 0,
  PRODUCT_MASS_CONSERVATION: 1 << 1,
  INVALID_PARTICLE_GAS: 1 << 0,
  ACCUMULATION_OVERFLOW: 1 << 1
});

export const SPH_SPATIAL_GAS_CANDIDATE_SOURCE = Object.freeze({
  PRODUCT_EVENT: 'product-event',
  PARTICLE: 'particle',
  UNION: 'union'
});

export const SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL = Math.fround(
  6.02214076e23
);
export const SPH_SPATIAL_GAS_CANDIDATE_PARTICLE_PRODUCT_TERM_SENTINEL =
  Math.fround(-1);

const PRODUCT_GAS_ROUTING_ID = Math.fround(1);
const GAS_PHASE_ID = Math.fround(3);
const READY_STATUS = Math.fround(1);
const MIN_LIVE_PARTICLE_STATUS = Math.fround(0.5);
const MAX_LIVE_PARTICLE_STATUS = Math.fround(3.5);
const PARTICLE_PHASE_FRACTION_TOLERANCE = Math.fround(1e-5);
const MAX_EXACT_F32_SOURCE_COUNT = 0x00ff_ffff;
const PRODUCT_MASS_ABSOLUTE_TOLERANCE_KG = Math.fround(1e-7);
const PRODUCT_MASS_RELATIVE_TOLERANCE = Math.fround(1e-4);
const DEFAULT_PRODUCT_TEMPERATURE_K = Math.fround(293.15);

let sourceOffsetsCache = null;

function f32(value) {
  return Math.fround(Number(value));
}

function finite(value) {
  return Number.isFinite(value);
}

function f32Add(left, right) {
  return f32(f32(left) + f32(right));
}

function f32Subtract(left, right) {
  return f32(f32(left) - f32(right));
}

function f32Multiply(left, right) {
  return f32(f32(left) * f32(right));
}

function f32Divide(left, right) {
  return f32(f32(left) / f32(right));
}

function layoutOffset(layout, field, label) {
  const index = layout.indexOf(`${field}:f32`);
  if (index < 0) {
    throw new Error(`${label} is missing required f32 field ${field}`);
  }
  return index;
}

function sourceOffsets() {
  if (sourceOffsetsCache) return sourceOffsetsCache;
  const state = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT;
  const thermo = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT;
  const product = SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT;
  sourceOffsetsCache = Object.freeze({
    state: Object.freeze({
      x: layoutOffset(state, 'positionXM', 'particle state layout'),
      y: layoutOffset(state, 'positionYM', 'particle state layout'),
      z: layoutOffset(state, 'positionZM', 'particle state layout'),
      mass: layoutOffset(state, 'massKg', 'particle state layout')
    }),
    thermo: Object.freeze({
      material: layoutOffset(thermo, 'materialId', 'particle thermo layout'),
      phase: layoutOffset(thermo, 'phaseId', 'particle thermo layout'),
      temperature: layoutOffset(thermo, 'temperatureK', 'particle thermo layout'),
      density: layoutOffset(thermo, 'restDensityKgPerM3', 'particle thermo layout'),
      solid: layoutOffset(thermo, 'phaseFractionSolid', 'particle thermo layout'),
      liquid: layoutOffset(thermo, 'phaseFractionLiquid', 'particle thermo layout'),
      gas: layoutOffset(thermo, 'phaseFractionGas', 'particle thermo layout'),
      plasma: layoutOffset(thermo, 'phaseFractionPlasma', 'particle thermo layout'),
      representedEntities: layoutOffset(
        thermo,
        'representedEntityCount',
        'particle thermo layout'
      ),
      status: layoutOffset(thermo, 'status', 'particle thermo layout')
    }),
    product: Object.freeze({
      x: layoutOffset(product, 'positionXM', 'reaction product event layout'),
      y: layoutOffset(product, 'positionYM', 'reaction product event layout'),
      z: layoutOffset(product, 'positionZM', 'reaction product event layout'),
      mass: layoutOffset(product, 'massKg', 'reaction product event layout'),
      material: layoutOffset(product, 'materialId', 'reaction product event layout'),
      productTerm: layoutOffset(
        product,
        'productTermIndex',
        'reaction product event layout'
      ),
      moles: layoutOffset(product, 'moles', 'reaction product event layout'),
      routing: layoutOffset(product, 'routingId', 'reaction product event layout'),
      placedMass: layoutOffset(
        product,
        'placedMassKg',
        'reaction product event layout'
      ),
      unplacedMass: layoutOffset(
        product,
        'unplacedMassKg',
        'reaction product event layout'
      ),
      temperature: layoutOffset(
        product,
        'temperatureK',
        'reaction product event layout'
      ),
      density: layoutOffset(
        product,
        'restDensityKgPerM3',
        'reaction product event layout'
      ),
      status: layoutOffset(product, 'status', 'reaction product event layout')
    })
  });
  return sourceOffsetsCache;
}

function rowSource(value, label) {
  if (value == null) return null;
  if (!(value instanceof Float32Array)) {
    throw new TypeError(`${label} must be a Float32Array when supplied`);
  }
  return value;
}

function stride(value, fallback, label) {
  const resolved = value == null ? fallback : Number(value);
  if (!Number.isInteger(resolved) || resolved < fallback) {
    throw new RangeError(`${label} must be an integer at least ${fallback}`);
  }
  return resolved;
}

function sourceCount(rows, requested, rowStride, label) {
  if (rows == null) {
    if (requested != null && Number(requested) !== 0) {
      throw new RangeError(`${label} cannot be positive without source rows`);
    }
    return 0;
  }
  let resolved = requested == null ? rows.length / rowStride : Number(requested);
  if (
    !Number.isInteger(resolved)
    || resolved < 0
    || resolved > MAX_EXACT_F32_SOURCE_COUNT
    || resolved * rowStride > rows.length
    || (requested == null && rows.length % rowStride !== 0)
  ) {
    throw new RangeError(
      `${label} must exactly address complete rows with f32-exact source indices`
    );
  }
  return resolved;
}

function frozenError({ sourceKind, sourceIndex, code, flag, fields }) {
  return Object.freeze({
    sourceKind,
    sourceIndex,
    code,
    flag,
    fields: Object.freeze([...fields])
  });
}

function compactRowObject(values, sourceKind) {
  return Object.freeze({
    positionM: Object.freeze(values.slice(0, 3)),
    materialId: values[3],
    massKg: values[4],
    moles: values[5],
    temperatureK: values[6],
    referenceVolumeM3: values[7],
    productTermIndex: values[8],
    sourceIndex: values[9],
    sourceKind,
    status: values[10],
    routingId: values[11]
  });
}

function productMassIsConserved(totalMass, placedMass, unplacedMass) {
  const partitionMass = f32Add(placedMass, unplacedMass);
  if (!finite(partitionMass)) return false;
  const scale = f32(Math.max(Math.abs(totalMass), Math.abs(partitionMass)));
  const relativeTolerance = f32Multiply(
    scale,
    PRODUCT_MASS_RELATIVE_TOLERANCE
  );
  const tolerance = f32(Math.max(
    PRODUCT_MASS_ABSOLUTE_TOLERANCE_KG,
    relativeTolerance
  ));
  const residual = f32(Math.abs(f32Subtract(totalMass, partitionMass)));
  return finite(tolerance) && finite(residual) && residual <= tolerance;
}

function particleGasClassification(phase, solid, liquid, gas, plasma) {
  const gasPhaseDeclared = finite(phase)
    && phase > f32Subtract(GAS_PHASE_ID, f32(0.5))
    && phase < f32Add(GAS_PHASE_ID, f32(0.5));
  const fractionsFinite = finite(solid)
    && finite(liquid)
    && finite(gas)
    && finite(plasma);
  const pureGasFractions = fractionsFinite
    && Math.abs(solid) <= PARTICLE_PHASE_FRACTION_TOLERANCE
    && Math.abs(liquid) <= PARTICLE_PHASE_FRACTION_TOLERANCE
    && Math.abs(f32Subtract(gas, f32(1)))
      <= PARTICLE_PHASE_FRACTION_TOLERANCE
    && Math.abs(plasma) <= PARTICLE_PHASE_FRACTION_TOLERANCE;
  return Object.freeze({
    gasIndicated: gasPhaseDeclared || pureGasFractions,
    gasPhaseDeclared,
    pureGasFractions
  });
}

/**
 * Deterministic CPU reference for the retained spatial-gas source union.
 * Product residuals are emitted first in event order, followed by phase-pure
 * gas particles in particle order. Any malformed would-be gas invalidates the
 * entire publication so a partial gas inventory cannot become EOS authority.
 */
export function computeSphSpatialGasCandidateUnionCpuOracle({
  productEventRows = null,
  productEventCount = null,
  productEventStrideFloats = null,
  particleStateRows = null,
  particleThermoRows = null,
  particleCount = null,
  particleStateStrideFloats = null,
  particleThermoStrideFloats = null,
  fallbackTemperatureK = DEFAULT_PRODUCT_TEMPERATURE_K
} = {}) {
  const offsets = sourceOffsets();
  const products = rowSource(productEventRows, 'productEventRows');
  const states = rowSource(particleStateRows, 'particleStateRows');
  const thermos = rowSource(particleThermoRows, 'particleThermoRows');
  const productStride = stride(
    productEventStrideFloats,
    SPH_GPU_REACTION_PRODUCT_EVENT_ROW_LAYOUT.length,
    'productEventStrideFloats'
  );
  const stateStride = stride(
    particleStateStrideFloats,
    SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length,
    'particleStateStrideFloats'
  );
  const thermoStride = stride(
    particleThermoStrideFloats,
    SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length,
    'particleThermoStrideFloats'
  );
  const productSources = sourceCount(
    products,
    productEventCount,
    productStride,
    'productEventCount'
  );
  if ((states == null) !== (thermos == null)) {
    throw new TypeError(
      'particleStateRows and particleThermoRows must be supplied together'
    );
  }
  const stateSources = sourceCount(
    states,
    particleCount,
    stateStride,
    'particleCount'
  );
  const thermoSources = sourceCount(
    thermos,
    particleCount,
    thermoStride,
    'particleCount'
  );
  if (stateSources !== thermoSources) {
    throw new RangeError(
      'particle state and thermo rows must exactly cover the same particle count'
    );
  }
  const fallbackTemperature = f32(fallbackTemperatureK);
  if (!finite(fallbackTemperature) || !(fallbackTemperature > 0)) {
    throw new RangeError('fallbackTemperatureK must be a positive finite f32');
  }

  const candidateRows = [];
  const candidateKinds = [];
  const errors = [];
  let errorFlags = SPH_SPATIAL_GAS_CANDIDATE_ERROR.NONE;
  let ignoredProductEventCount = 0;
  let ignoredParticleCount = 0;
  let invalidProductEventCount = 0;
  let productMassConservationErrorCount = 0;
  let invalidParticleGasCount = 0;
  let productCandidateCount = 0;
  let particleCandidateCount = 0;

  const rejectProduct = (sourceIndex, code, flag, fields) => {
    errorFlags = (errorFlags | flag) >>> 0;
    invalidProductEventCount += 1;
    if (flag === SPH_SPATIAL_GAS_CANDIDATE_ERROR.PRODUCT_MASS_CONSERVATION) {
      productMassConservationErrorCount += 1;
    }
    errors.push(frozenError({
      sourceKind: SPH_SPATIAL_GAS_CANDIDATE_SOURCE.PRODUCT_EVENT,
      sourceIndex,
      code,
      flag,
      fields
    }));
  };

  for (let sourceIndex = 0; sourceIndex < productSources; sourceIndex += 1) {
    const base = sourceIndex * productStride;
    const routing = f32(products[base + offsets.product.routing]);
    const status = f32(products[base + offsets.product.status]);
    const unplacedMass = f32(products[base + offsets.product.unplacedMass]);
    const gasRoutedReady = finite(routing)
      && routing > f32(0.5)
      && routing < f32(1.5)
      && finite(status)
      && status > f32(0.5);
    if (!gasRoutedReady) {
      ignoredProductEventCount += 1;
      continue;
    }

    const totalMass = f32(products[base + offsets.product.mass]);
    const totalMoles = f32(products[base + offsets.product.moles]);
    const placedMass = f32(products[base + offsets.product.placedMass]);
    const density = f32(products[base + offsets.product.density]);
    if (
      !finite(totalMass) || totalMass < 0
      || !finite(totalMoles) || totalMoles < 0
      || !finite(placedMass) || placedMass < 0
      || !finite(unplacedMass) || unplacedMass < 0
      || !finite(density) || !(density > 0)
    ) {
      rejectProduct(
        sourceIndex,
        'product-gas-scalar-invalid',
        SPH_SPATIAL_GAS_CANDIDATE_ERROR.INVALID_PRODUCT_EVENT,
        [
          'massKg',
          'moles',
          'placedMassKg',
          'unplacedMassKg',
          'restDensityKgPerM3'
        ]
      );
      continue;
    }
    if (!productMassIsConserved(totalMass, placedMass, unplacedMass)) {
      rejectProduct(
        sourceIndex,
        'product-mass-partition-not-conserved',
        SPH_SPATIAL_GAS_CANDIDATE_ERROR.PRODUCT_MASS_CONSERVATION,
        ['massKg', 'placedMassKg', 'unplacedMassKg']
      );
      continue;
    }
    if (unplacedMass === 0) {
      ignoredProductEventCount += 1;
      continue;
    }

    const x = f32(products[base + offsets.product.x]);
    const y = f32(products[base + offsets.product.y]);
    const z = f32(products[base + offsets.product.z]);
    const material = f32(products[base + offsets.product.material]);
    const productTerm = f32(products[base + offsets.product.productTerm]);
    const sourceTemperature = f32(products[base + offsets.product.temperature]);
    const temperature = finite(sourceTemperature) && sourceTemperature > 0
      ? sourceTemperature
      : fallbackTemperature;
    const residualFraction = f32Divide(unplacedMass, totalMass);
    const residualMoles = f32Multiply(totalMoles, residualFraction);
    const referenceVolume = f32Divide(unplacedMass, density);
    if (
      !finite(x) || !finite(y) || !finite(z)
      || !finite(material) || !(material > 0)
      || !finite(productTerm) || productTerm < 0
      || !finite(residualFraction) || !(residualFraction > 0)
      || residualFraction > f32(1.0001)
      || !finite(residualMoles) || !(residualMoles > 0)
      || !finite(referenceVolume) || !(referenceVolume > 0)
    ) {
      rejectProduct(
        sourceIndex,
        'product-gas-payload-invalid',
        SPH_SPATIAL_GAS_CANDIDATE_ERROR.INVALID_PRODUCT_EVENT,
        [
          'positionM',
          'materialId',
          'productTermIndex',
          'residualMoles',
          'referenceVolumeM3'
        ]
      );
      continue;
    }
    candidateRows.push([
      x,
      y,
      z,
      material,
      unplacedMass,
      residualMoles,
      temperature,
      referenceVolume,
      productTerm,
      f32(sourceIndex),
      READY_STATUS,
      routing
    ]);
    candidateKinds.push(SPH_SPATIAL_GAS_CANDIDATE_SOURCE.PRODUCT_EVENT);
    productCandidateCount += 1;
  }

  const rejectParticle = (sourceIndex, code, fields) => {
    const flag = SPH_SPATIAL_GAS_CANDIDATE_ERROR.INVALID_PARTICLE_GAS;
    errorFlags = (errorFlags | flag) >>> 0;
    invalidParticleGasCount += 1;
    errors.push(frozenError({
      sourceKind: SPH_SPATIAL_GAS_CANDIDATE_SOURCE.PARTICLE,
      sourceIndex,
      code,
      flag,
      fields
    }));
  };

  for (let sourceIndex = 0; sourceIndex < stateSources; sourceIndex += 1) {
    const stateBase = sourceIndex * stateStride;
    const thermoBase = sourceIndex * thermoStride;
    const mass = f32(states[stateBase + offsets.state.mass]);
    // Fixed-capacity storage rows can retain their former material/phase
    // after reaction placement or consumption takes inventory to exactly
    // zero. With no mass, moles, or reference volume they cannot contribute
    // gas pressure and are inert regardless of their historical status.
    if (finite(mass) && mass === 0) {
      ignoredParticleCount += 1;
      continue;
    }
    const phase = f32(thermos[thermoBase + offsets.thermo.phase]);
    const solid = f32(thermos[thermoBase + offsets.thermo.solid]);
    const liquid = f32(thermos[thermoBase + offsets.thermo.liquid]);
    const gas = f32(thermos[thermoBase + offsets.thermo.gas]);
    const plasma = f32(thermos[thermoBase + offsets.thermo.plasma]);
    const status = f32(thermos[thermoBase + offsets.thermo.status]);
    const gasClassification = particleGasClassification(
      phase,
      solid,
      liquid,
      gas,
      plasma
    );
    if (!gasClassification.gasIndicated) {
      ignoredParticleCount += 1;
      continue;
    }
    const activeStatus = finite(status)
      && status > MIN_LIVE_PARTICLE_STATUS
      && status < MAX_LIVE_PARTICLE_STATUS;
    if (
      !finite(mass) || !(mass > 0)
      || !activeStatus
      || !gasClassification.gasPhaseDeclared
      || !gasClassification.pureGasFractions
    ) {
      rejectParticle(
        sourceIndex,
        'particle-gas-phase-purity-invalid',
        [
          'massKg',
          'phaseId',
          'phaseFractions',
          'status'
        ]
      );
      continue;
    }

    const x = f32(states[stateBase + offsets.state.x]);
    const y = f32(states[stateBase + offsets.state.y]);
    const z = f32(states[stateBase + offsets.state.z]);
    const material = f32(thermos[thermoBase + offsets.thermo.material]);
    const temperature = f32(thermos[thermoBase + offsets.thermo.temperature]);
    const density = f32(thermos[thermoBase + offsets.thermo.density]);
    const representedEntities = f32(
      thermos[thermoBase + offsets.thermo.representedEntities]
    );
    const moles = f32Divide(
      representedEntities,
      SPH_SPATIAL_GAS_CANDIDATE_AVOGADRO_PER_MOL
    );
    const referenceVolume = f32Divide(mass, density);
    if (
      !finite(x) || !finite(y) || !finite(z)
      || !finite(material) || !(material > 0)
      || !finite(temperature) || !(temperature > 0)
      || !finite(density) || !(density > 0)
      || !finite(representedEntities) || !(representedEntities > 0)
      || !finite(moles) || !(moles > 0)
      || !finite(referenceVolume) || !(referenceVolume > 0)
    ) {
      rejectParticle(
        sourceIndex,
        'particle-gas-payload-invalid',
        [
          'positionM',
          'materialId',
          'temperatureK',
          'restDensityKgPerM3',
          'representedEntityCount',
          'moles',
          'referenceVolumeM3'
        ]
      );
      continue;
    }
    candidateRows.push([
      x,
      y,
      z,
      material,
      mass,
      moles,
      temperature,
      referenceVolume,
      SPH_SPATIAL_GAS_CANDIDATE_PARTICLE_PRODUCT_TERM_SENTINEL,
      f32(sourceIndex),
      READY_STATUS,
      PRODUCT_GAS_ROUTING_ID
    ]);
    candidateKinds.push(SPH_SPATIAL_GAS_CANDIDATE_SOURCE.PARTICLE);
    particleCandidateCount += 1;
  }

  let candidateTotalMassKg = f32(0);
  let candidateTotalMoles = f32(0);
  let accumulationOverflowCount = 0;
  for (const row of candidateRows) {
    candidateTotalMassKg = f32Add(candidateTotalMassKg, row[4]);
    candidateTotalMoles = f32Add(candidateTotalMoles, row[5]);
  }
  if (!finite(candidateTotalMassKg) || !finite(candidateTotalMoles)) {
    const flag = SPH_SPATIAL_GAS_CANDIDATE_ERROR.ACCUMULATION_OVERFLOW;
    errorFlags = (errorFlags | flag) >>> 0;
    accumulationOverflowCount = 1;
    errors.push(frozenError({
      sourceKind: SPH_SPATIAL_GAS_CANDIDATE_SOURCE.UNION,
      sourceIndex: null,
      code: 'candidate-total-overflow',
      flag,
      fields: ['totalMassKg', 'totalMoles']
    }));
  }

  const failClosed = errorFlags !== SPH_SPATIAL_GAS_CANDIDATE_ERROR.NONE;
  const publishedRows = failClosed ? [] : candidateRows;
  const compactRows = new Float32Array(
    publishedRows.length * SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS
  );
  for (let rowIndex = 0; rowIndex < publishedRows.length; rowIndex += 1) {
    compactRows.set(
      publishedRows[rowIndex],
      rowIndex * SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS
    );
  }
  const rows = Object.freeze(publishedRows.map((row, index) => (
    compactRowObject(row, candidateKinds[index])
  )));
  const sourceTotal = productSources + stateSources;
  const ignoredSourceCount = ignoredProductEventCount + ignoredParticleCount;
  const invalidCandidateCount = invalidProductEventCount
    + invalidParticleGasCount;
  const liveCount = failClosed ? 0 : publishedRows.length;
  return Object.freeze({
    schema: ULG_SPH_SPATIAL_GAS_CANDIDATE_UNION_SCHEMA,
    status: failClosed
      ? 'sph-spatial-gas-candidate-union-fail-closed'
      : liveCount > 0
        ? 'sph-spatial-gas-candidate-union-ready'
        : 'sph-spatial-gas-candidate-union-empty',
    admitted: !failClosed,
    failClosed,
    errorFlags,
    errorCount: errors.length,
    errors: Object.freeze(errors),
    sourceCount: sourceTotal,
    productEventSourceCount: productSources,
    particleSourceCount: stateSources,
    candidateCount: candidateRows.length,
    productCandidateCount,
    particleCandidateCount,
    liveCount,
    ignoredSourceCount,
    ignoredProductEventCount,
    ignoredParticleCount,
    invalidCandidateCount,
    invalidProductEventCount,
    productMassConservationErrorCount,
    invalidParticleGasCount,
    accumulationOverflowCount,
    totalMassKg: failClosed ? f32(0) : candidateTotalMassKg,
    totalMoles: failClosed ? f32(0) : candidateTotalMoles,
    compactRowStrideFloats: SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS,
    compactRows,
    rows
  });
}

export const SPH_SPATIAL_GAS_CANDIDATE_UNION_ABI = Object.freeze({
  schema: ULG_SPH_SPATIAL_GAS_CANDIDATE_UNION_SCHEMA,
  rowFloats: SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_FLOATS,
  rowLayout: SPH_SPATIAL_GAS_CANDIDATE_COMPACT_ROW_LAYOUT,
  particleProductTermSentinel:
    SPH_SPATIAL_GAS_CANDIDATE_PARTICLE_PRODUCT_TERM_SENTINEL,
  particleMolesAuthority: 'represented-entity-count-divided-by-avogadro',
  sourceOrder: 'unplaced-product-events-then-phase-pure-gas-particles',
  pressureVolumeAuthority: 'external-spatial-free-volume-sidecar',
  failurePolicy: 'whole-union-fail-closed'
});
