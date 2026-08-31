import {
  SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION,
  SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M,
  SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER,
  SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS,
  SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS
} from './sphCanonicalContactMotionBound.js';

export const ULG_SPH_REACTION_MOTION_ENVELOPE_SCHEMA =
  'peercompute.ulg.sph-reaction-motion-envelope.v2';

export const ULG_SPH_REACTION_ACTIVATION_OBSERVATION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-reaction-activation-observation.v3';

export const ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE =
  'ERR_ULG_REACTION_MOTION_ENVELOPE_WATCH_FATAL';

export const SPH_REACTION_ACTIVATION_OBSERVATION_PUBLIC_FAILURE_WORD =
  0xffff_ffff;

export const SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_FAILURE_WORD = 0;

export const SPH_REACTION_ACTIVATION_OBSERVATION_ENCODED_COUNT_BIAS = 1;

export const SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION =
  'canonical-reaction-motion-envelope-cfl-separation-contact-thermal-phase-latch-v3';

export const SPH_REACTION_MOTION_ENVELOPE_PREDICATE =
  'reactant-pair-material-phase-temperature-with-cfl-separation-contact-and-thermal-phase-latch';

export const SPH_REACTION_MOTION_ENVELOPE_NUMERIC_SAFETY_REVISION =
  'f32-cuberoot-wall-shell-contact-trust-position-store-and-thermal-phase-latch-v5';

export const SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_POLICY =
  'terminal-exact-when-static-trigger-positive-before-evolution';

export const SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_REVISION =
  'target-horizon-thermal-phase-rest-volume-trigger-positive-v1';

export const SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_COUNT_POLICY =
  'all-fixed-phase-carrier-slots';

export const SPH_REACTION_MOTION_ENVELOPE_STATIC_REST_DIAMETER_STATUS =
  'terminal-upper-under-declared-no-writer-premise';

export const SPH_REACTION_MOTION_ENVELOPE_DYNAMIC_REST_DIAMETER_STATUS =
  'future-upper-unclaimed-trigger-positive';

export const SPH_REACTION_MOTION_ENVELOPE_MAX_FUTURE_SUBSTEPS = 128;

// Counts cross both u32 storage and f32 identity/comparison paths. Keeping one
// public ceiling prevents the main-thread seal, clone-safe receipts, and the
// GPU producer from admitting mutually impossible numeric domains.
export const SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT = 0x00ff_ffff;

const MAX_EXACT_F32_INTEGER =
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT;
const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);
const RESERVED_F32_FAILURE_VALUE = (() => {
  U32[0] = 0x7f7f_ffff;
  return F32[0];
})();
const RELATIVE_REACH_FORMULA =
  'dt>=0;max(g2p,separation,canonicalContactTrust)+K*positionStoreRounding(maxAbsPosition,contactRadius,physicalReach)';
const TERMINAL_POSITION_DOMAIN =
  'active-terminal-position-inside-sealed-physical-box';
const FUTURE_REST_DIAMETER_POLICY =
  'terminal-upper-only-with-no-rest-volume-writer-else-trigger-positive';

function finiteMotionOperand(value) {
  return Number.isFinite(value)
    && Math.abs(value) < RESERVED_F32_FAILURE_VALUE;
}

/**
 * Validate the immutable reaction-header prefix before either GPU watch can
 * publish a zero. Pair-local shader validation is insufficient because a
 * malformed rule might never be visited by a narrow spatial scan.
 */
export function assertSphReactionMotionEnvelopeRulePrefix(
  combined,
  reactionCount,
  label = 'reactionTable'
) {
  if (!(combined instanceof Float32Array)) {
    throw new TypeError(`${label} records must be a Float32Array`);
  }
  if (
    !Number.isSafeInteger(reactionCount)
    || reactionCount < 1
    || reactionCount > SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT
  ) {
    throw new RangeError(
      `${label}.reactionCount must be an exact positive f32 integer`
    );
  }
  const requiredFloats = reactionCount * 12;
  if (combined.length < requiredFloats) {
    throw new RangeError(`${label} does not contain every reaction header`);
  }
  for (let reactionIndex = 0; reactionIndex < reactionCount; reactionIndex += 1) {
    const offset = reactionIndex * 12;
    for (let word = 0; word < 12; word += 1) {
      if (!finiteMotionOperand(combined[offset + word])) {
        throw new TypeError(
          `${label} reaction ${reactionIndex} contains a non-finite motion-watch operand`
        );
      }
    }
    const status = combined[offset + 8];
    if (![1, 254, 255].includes(status)) {
      throw new TypeError(
        `${label} reaction ${reactionIndex} has an unrecognized row status`
      );
    }
    if (status !== 1) continue;
    const materialA = combined[offset];
    const materialB = combined[offset + 1];
    const productMaterial = combined[offset + 2];
    const activationTemperatureK = combined[offset + 3];
    const contactRadiusM = combined[offset + 5];
    const phaseMaskA = combined[offset + 6];
    const phaseMaskB = combined[offset + 7];
    const materialAdmitted = (value) => Number.isInteger(value)
      && value >= 0
      && value <= MAX_EXACT_F32_INTEGER;
    const phaseMaskAdmitted = (value) => Number.isInteger(value)
      && value >= 0
      && value <= 0x7fff_ffff;
    const radiusSquared = Math.fround(contactRadiusM * contactRadiusM);
    if (
      !materialAdmitted(materialA)
      || !materialAdmitted(materialB)
      || materialA === materialB
      || !materialAdmitted(productMaterial)
      || activationTemperatureK < 0
      || contactRadiusM < 0
      || !finiteMotionOperand(radiusSquared)
      || !phaseMaskAdmitted(phaseMaskA)
      || !phaseMaskAdmitted(phaseMaskB)
    ) {
      throw new TypeError(
        `${label} reaction ${reactionIndex} violates the active motion-watch rule contract`
      );
    }
  }
  return true;
}

function exactPositiveFiniteF32(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  F32[0] = value;
  const rounded = F32[0];
  if (
    !Number.isFinite(rounded)
    || rounded <= 0
    || Math.abs(rounded) >= RESERVED_F32_FAILURE_VALUE
  ) {
    throw new RangeError(
      `${label} must remain positive in the admitted finite f32 domain`
    );
  }
  return Object.freeze({ value: rounded, bits: U32[0] >>> 0 });
}

function exactNonnegativeFiniteF32(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a nonnegative finite number`);
  }
  F32[0] = value;
  const rounded = F32[0];
  if (
    !Number.isFinite(rounded)
    || rounded < 0
    || Math.abs(rounded) >= RESERVED_F32_FAILURE_VALUE
  ) {
    throw new RangeError(
      `${label} must remain nonnegative in the admitted finite f32 domain`
    );
  }
  return Object.freeze({ value: rounded, bits: U32[0] >>> 0 });
}

function exactFutureSubsteps(value) {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
    || value > SPH_REACTION_MOTION_ENVELOPE_MAX_FUTURE_SUBSTEPS
  ) {
    throw new RangeError(
      `maxFutureSubsteps must be an integer in [1, ${
        SPH_REACTION_MOTION_ENVELOPE_MAX_FUTURE_SUBSTEPS
      }]`
    );
  }
  return value;
}

function exactBoxDims(value) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
    throw new TypeError('boxDimsM must contain exactly three dimensions');
  }
  if (value.length !== 3) {
    throw new RangeError('boxDimsM must contain exactly three dimensions');
  }
  const exact = Array.from(value, (dimension, axis) => (
    exactPositiveFiniteF32(dimension, `boxDimsM[${axis}]`)
  ));
  return Object.freeze({
    values: Object.freeze(exact.map(({ value: dimension }) => dimension)),
    bits: Object.freeze(exact.map(({ bits }) => bits))
  });
}

function plainMotionEnvelopeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Seal the exact Tier0 integration controls covered by a reaction watch.
 * Values are rounded once to their GPU f32 representation and the bit patterns
 * are carried in every receipt, so a future routing gate can compare the
 * proposed schedule without recomputing host floating-point products.
 */
export function createSphReactionMotionEnvelope({
  maxFutureSubsteps,
  dtS,
  gridSpacingM,
  cflFactor,
  boxDimsM,
  separationDisplacementEnabled = true,
  contactCorrectionEnabled = false,
  thermalPhaseEvolutionEnabled = false
} = {}) {
  const resolvedSubsteps = exactFutureSubsteps(maxFutureSubsteps);
  const dt = exactNonnegativeFiniteF32(dtS, 'dtS');
  const spacing = exactPositiveFiniteF32(gridSpacingM, 'gridSpacingM');
  const cfl = exactPositiveFiniteF32(cflFactor, 'cflFactor');
  const box = exactBoxDims(boxDimsM);
  const contactTolerance = exactPositiveFiniteF32(
    SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M,
    'contactPositionToleranceAbsoluteM'
  );
  if (typeof separationDisplacementEnabled !== 'boolean') {
    throw new TypeError('separationDisplacementEnabled must be a boolean');
  }
  if (typeof contactCorrectionEnabled !== 'boolean') {
    throw new TypeError('contactCorrectionEnabled must be a boolean');
  }
  if (typeof thermalPhaseEvolutionEnabled !== 'boolean') {
    throw new TypeError('thermalPhaseEvolutionEnabled must be a boolean');
  }
  return Object.freeze({
    schema: ULG_SPH_REACTION_MOTION_ENVELOPE_SCHEMA,
    status: 'reaction-motion-envelope-sealed',
    predicateRevision: SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
    numericSafetyRevision:
      SPH_REACTION_MOTION_ENVELOPE_NUMERIC_SAFETY_REVISION,
    maxFutureSubsteps: resolvedSubsteps,
    dtS: dt.value,
    dtF32Bits: dt.bits,
    gridSpacingM: spacing.value,
    gridSpacingF32Bits: spacing.bits,
    cflFactor: cfl.value,
    cflFactorF32Bits: cfl.bits,
    boxDimsM: box.values,
    boxDimsF32Bits: box.bits,
    separationDisplacementEnabled,
    contactCorrectionEnabled,
    thermalPhaseLatchRevision:
      SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_REVISION,
    thermalPhaseEvolutionEnabled,
    thermalPhaseEvolutionPolicy:
      SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_POLICY,
    thermalPhaseLatchCountPolicy:
      SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_COUNT_POLICY,
    contactMotionBoundRevision:
      SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION,
    contactPositionTrustDiameters:
      SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS,
    contactPositionToleranceAbsoluteM: contactTolerance.value,
    contactPositionToleranceAbsoluteF32Bits: contactTolerance.bits,
    contactPositionToleranceEpsilonMultiplier:
      SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER,
    wallShellEuclideanUpperF32Bits:
      SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS,
    terminalPositionDomain: TERMINAL_POSITION_DOMAIN,
    futureRestDiameterPolicy: FUTURE_REST_DIAMETER_POLICY,
    futureRestDiameterBoundStatus: thermalPhaseEvolutionEnabled
      ? SPH_REACTION_MOTION_ENVELOPE_DYNAMIC_REST_DIAMETER_STATUS
      : SPH_REACTION_MOTION_ENVELOPE_STATIC_REST_DIAMETER_STATUS,
    relativeReachFormula: RELATIVE_REACH_FORMULA,
    conservativeSuperset: true
  });
}

function sphReactionMotionEnvelopeMatches(value, requireFrozen) {
  if (
    !plainMotionEnvelopeObject(value)
    || (requireFrozen && !Object.isFrozen(value))
    || value.schema !== ULG_SPH_REACTION_MOTION_ENVELOPE_SCHEMA
    || value.status !== 'reaction-motion-envelope-sealed'
    || value.predicateRevision
      !== SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION
    || value.numericSafetyRevision
      !== SPH_REACTION_MOTION_ENVELOPE_NUMERIC_SAFETY_REVISION
    || value.relativeReachFormula !== RELATIVE_REACH_FORMULA
    || value.terminalPositionDomain !== TERMINAL_POSITION_DOMAIN
    || value.futureRestDiameterPolicy !== FUTURE_REST_DIAMETER_POLICY
    || value.thermalPhaseEvolutionPolicy
      !== SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_POLICY
    || value.thermalPhaseLatchRevision
      !== SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_REVISION
    || value.thermalPhaseLatchCountPolicy
      !== SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_COUNT_POLICY
    || value.futureRestDiameterBoundStatus !== (
      value.thermalPhaseEvolutionEnabled
        ? SPH_REACTION_MOTION_ENVELOPE_DYNAMIC_REST_DIAMETER_STATUS
        : SPH_REACTION_MOTION_ENVELOPE_STATIC_REST_DIAMETER_STATUS
    )
    || value.contactMotionBoundRevision
      !== SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION
    || value.contactPositionTrustDiameters
      !== SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS
    || value.contactPositionToleranceEpsilonMultiplier
      !== SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER
    || value.wallShellEuclideanUpperF32Bits
      !== SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS
    || value.conservativeSuperset !== true
    || typeof value.separationDisplacementEnabled !== 'boolean'
    || typeof value.contactCorrectionEnabled !== 'boolean'
    || typeof value.thermalPhaseEvolutionEnabled !== 'boolean'
    || !Array.isArray(value.boxDimsM)
    || value.boxDimsM.length !== 3
    || !Array.isArray(value.boxDimsF32Bits)
    || value.boxDimsF32Bits.length !== 3
    || (requireFrozen && (
      !Object.isFrozen(value.boxDimsM)
      || !Object.isFrozen(value.boxDimsF32Bits)
    ))
  ) return false;
  try {
    const exact = createSphReactionMotionEnvelope(value);
    const actualKeys = Object.keys(value).sort();
    const exactKeys = Object.keys(exact).sort();
    return actualKeys.length === exactKeys.length
      && actualKeys.every((key, index) => key === exactKeys[index])
      && exact.maxFutureSubsteps === value.maxFutureSubsteps
      && exact.dtS === value.dtS
      && exact.dtF32Bits === value.dtF32Bits
      && exact.gridSpacingM === value.gridSpacingM
      && exact.gridSpacingF32Bits === value.gridSpacingF32Bits
      && exact.cflFactor === value.cflFactor
      && exact.cflFactorF32Bits === value.cflFactorF32Bits
      && exact.boxDimsM.every(
        (dimension, axis) => dimension === value.boxDimsM?.[axis]
      )
      && exact.boxDimsF32Bits.every(
        (bits, axis) => bits === value.boxDimsF32Bits?.[axis]
      )
      && exact.separationDisplacementEnabled
        === value.separationDisplacementEnabled
      && exact.contactCorrectionEnabled === value.contactCorrectionEnabled
      && exact.thermalPhaseEvolutionEnabled
        === value.thermalPhaseEvolutionEnabled
      && exact.contactPositionToleranceAbsoluteM
        === value.contactPositionToleranceAbsoluteM
      && exact.contactPositionToleranceAbsoluteF32Bits
        === value.contactPositionToleranceAbsoluteF32Bits;
  } catch {
    return false;
  }
}

export function isExactSphReactionMotionEnvelope(value) {
  return sphReactionMotionEnvelopeMatches(value, true);
}

export function isSphReactionMotionEnvelopeReceipt(value) {
  return sphReactionMotionEnvelopeMatches(value, false);
}

export function assertSphReactionMotionEnvelopeBoxDimsMatch(
  motionEnvelope,
  boxDimsM,
  label = 'boxDimsM'
) {
  if (!isExactSphReactionMotionEnvelope(motionEnvelope)) {
    throw new TypeError('box comparison requires an exact sealed envelope');
  }
  const exact = exactBoxDims(boxDimsM);
  if (!exact.bits.every(
    (bits, axis) => bits === motionEnvelope.boxDimsF32Bits[axis]
  )) {
    throw new RangeError(
      `${label} does not bit-match the sealed reaction motion envelope`
    );
  }
  return exact.values;
}

/**
 * Shared WGSL arithmetic used by canonical and Tier0 producers. The physical
 * bound comes from the grid-update CFL clamp, wall-shell changes between the
 * G2P/separation/contact clamps, the separation kernel's per-particle
 * `0.5*cbrt(restVolume)` correction cap, and the canonical contact solver's
 * absolute epoch trust region. The cube-root input is enclosed by an exact
 * power of two before the remaining positive operations are nudged upward by
 * 64 f32 ULPs. An additional
 * 32-epsilon-per-substep factor covers repeated f32
 * integration/accumulation. Any overflow is rejected by the producer and
 * seals the public sentinel instead of a false zero.
 */
export const sphReactionMotionEnvelopeWgsl = `
const REACTION_MOTION_F32_MAX_BITS: u32 = 0x7f7fffffu;
const REACTION_MOTION_UPWARD_ULPS: u32 = 64u;
const REACTION_MOTION_ROUNDING_PER_SUBSTEP: f32 = 0.000003814697265625;
const REACTION_MOTION_F32_EPSILON: f32 = 1.1920928955078125e-7;
const REACTION_MOTION_CONTACT_TRUST_DIAMETERS: f32 =
  ${SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS}.0;
const REACTION_MOTION_CONTACT_TOLERANCE_ABSOLUTE_M: f32 =
  ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M};
const REACTION_MOTION_CONTACT_TOLERANCE_EPSILON_MULTIPLIER: f32 =
  ${SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER}.0;
const REACTION_MOTION_SQRT_THREE_UPPER: f32 = bitcast<f32>(
  ${SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS}u
);

fn reaction_motion_finite(value: f32) -> bool {
  // Reserve the largest finite f32 bit pattern as an in-band arithmetic
  // failure marker. WGSL validation rejects a constant-expression infinity,
  // while this value is portable and every watch treats it as non-finite.
  return (bitcast<u32>(value) & 0x7fffffffu)
    < REACTION_MOTION_F32_MAX_BITS;
}

fn reaction_motion_vec4_finite(value: vec4<f32>) -> bool {
  return all(vec4<bool>(
    reaction_motion_finite(value.x),
    reaction_motion_finite(value.y),
    reaction_motion_finite(value.z),
    reaction_motion_finite(value.w)
  ));
}

fn reaction_motion_upward(value: f32) -> f32 {
  if (!(value > 0.0) || !reaction_motion_finite(value)) {
    return value;
  }
  let bits = bitcast<u32>(value);
  if (bits > REACTION_MOTION_F32_MAX_BITS - REACTION_MOTION_UPWARD_ULPS) {
    return bitcast<f32>(REACTION_MOTION_F32_MAX_BITS);
  }
  return bitcast<f32>(bits + REACTION_MOTION_UPWARD_ULPS);
}

fn reaction_motion_ceil_div_3(value: i32) -> i32 {
  if (value >= 0) {
    return (value + 2) / 3;
  }
  return -((-value) / 3);
}

fn reaction_motion_rest_diameter_upper(rest_volume_m3: f32) -> f32 {
  if (!(rest_volume_m3 > 0.0) || !reaction_motion_finite(rest_volume_m3)) {
    return 0.0;
  }
  // The mechanics separation kernel evaluates cbrt(max(V, 1e-18)). For a
  // positive normal f32 with unbiased exponent e, V < 2^(e+1), hence
  // cbrt(V) < 2^ceil((e+1)/3). Constructing that power directly avoids an
  // implementation-dependent pow underestimate in the safety envelope.
  // max(V, 1e-18) is normal, so no subnormal exponent branch is required.
  let bounded_volume = max(rest_volume_m3, 1.0e-18);
  let volume_bits = bitcast<u32>(bounded_volume);
  let unbiased_exponent = i32((volume_bits >> 23u) & 0xffu) - 127;
  let upper_exponent = reaction_motion_ceil_div_3(unbiased_exponent + 1);
  let upper_exponent_bits = u32(upper_exponent + 127) << 23u;
  return reaction_motion_upward(bitcast<f32>(upper_exponent_bits));
}

fn reaction_motion_box_dims_admitted(box_dims_m: vec3<f32>) -> bool {
  return all(vec3<bool>(
    reaction_motion_finite(box_dims_m.x) && box_dims_m.x > 0.0,
    reaction_motion_finite(box_dims_m.y) && box_dims_m.y > 0.0,
    reaction_motion_finite(box_dims_m.z) && box_dims_m.z > 0.0
  ));
}

fn reaction_motion_position_inside_box(
  position_m: vec3<f32>,
  box_dims_m: vec3<f32>
) -> bool {
  return reaction_motion_box_dims_admitted(box_dims_m)
    && all(position_m >= vec3<f32>(0.0))
    && all(position_m <= box_dims_m);
}

fn reaction_motion_wall_shell_transition_upper(
  grid_spacing_m: f32,
  box_dims_m: vec3<f32>
) -> f32 {
  let minimum_box_dimension_m = min(
    box_dims_m.x,
    min(box_dims_m.y, box_dims_m.z)
  );
  let grid_clearance_upper_m = reaction_motion_upward(
    0.5 * reaction_motion_upward(grid_spacing_m)
  );
  let box_clearance_upper_m = reaction_motion_upward(
    0.49 * reaction_motion_upward(minimum_box_dimension_m)
  );
  let axis_shell_upper_m = min(
    grid_clearance_upper_m,
    box_clearance_upper_m
  );
  return reaction_motion_upward(
    REACTION_MOTION_SQRT_THREE_UPPER * axis_shell_upper_m
  );
}

fn reaction_motion_position_store_rounding_upper(
  max_abs_position_m: f32,
  maximum_contact_radius_m: f32,
  physical_relative_reach_m: f32,
  max_future_substeps: u32
) -> f32 {
  let position_scale_m = reaction_motion_upward(
    reaction_motion_upward(max_abs_position_m)
      + reaction_motion_upward(maximum_contact_radius_m)
      + reaction_motion_upward(physical_relative_reach_m)
  );
  if (!(position_scale_m > 0.0) || !reaction_motion_finite(position_scale_m)) {
    return bitcast<f32>(REACTION_MOTION_F32_MAX_BITS);
  }
  let scale_bits = bitcast<u32>(position_scale_m);
  let exponent_bits = (scale_bits >> 23u) & 0xffu;
  // One exact power-of-two quantum at eight f32 ULPs of the enclosing
  // coordinate binade covers both 3-D endpoints, their store additions, and
  // the later distance arithmetic. Clamp tiny coordinates to the minimum
  // normal quantum; this is deliberately loose and remains finite.
  var rounding_quantum_m = bitcast<f32>(0x00800000u);
  if (exponent_bits > 20u) {
    rounding_quantum_m = bitcast<f32>((exponent_bits - 20u) << 23u);
  }
  return reaction_motion_upward(
    reaction_motion_upward(f32(max_future_substeps))
      * rounding_quantum_m
  );
}

fn reaction_motion_relative_reach_upper(
  max_future_substeps: u32,
  cfl_factor: f32,
  grid_spacing_m: f32,
  max_rest_diameter_m: f32,
  separation_enabled: bool,
  contact_correction_enabled: bool,
  box_dims_m: vec3<f32>,
  max_abs_position_m: f32,
  maximum_contact_radius_m: f32
) -> f32 {
  let advective_one_particle = reaction_motion_upward(
    reaction_motion_upward(cfl_factor) * reaction_motion_upward(grid_spacing_m)
  );
  let wall_shell_transition_m = reaction_motion_wall_shell_transition_upper(
    grid_spacing_m,
    box_dims_m
  );
  let g2p_one_particle = reaction_motion_upward(
    advective_one_particle + wall_shell_transition_m
  );
  let separation_one_particle = reaction_motion_upward(
    reaction_motion_upward(
      g2p_one_particle
        + reaction_motion_upward(0.5 * max_rest_diameter_m)
    ) + wall_shell_transition_m
  );
  let contact_trust_without_tolerance = reaction_motion_upward(
    reaction_motion_upward(
      REACTION_MOTION_CONTACT_TRUST_DIAMETERS * max_rest_diameter_m
    ) + reaction_motion_upward(
      2.0 * advective_one_particle
    ) + reaction_motion_upward(
      3.0 * wall_shell_transition_m
    )
  );
  let contact_tolerance_m = reaction_motion_upward(max(
    REACTION_MOTION_CONTACT_TOLERANCE_ABSOLUTE_M,
    reaction_motion_upward(
      REACTION_MOTION_CONTACT_TOLERANCE_EPSILON_MULTIPLIER
        * REACTION_MOTION_F32_EPSILON
        * max(contact_trust_without_tolerance, 1.0)
    )
  ));
  let contact_one_particle = reaction_motion_upward(
    contact_trust_without_tolerance + contact_tolerance_m
  );
  let one_particle_per_substep = max(
    g2p_one_particle,
    max(
      select(g2p_one_particle, separation_one_particle, separation_enabled),
      select(
        g2p_one_particle,
        contact_one_particle,
        contact_correction_enabled
      )
    )
  );
  let raw_relative = reaction_motion_upward(
    reaction_motion_upward(2.0 * f32(max_future_substeps))
      * one_particle_per_substep
  );
  let accumulated_rounding = reaction_motion_upward(
    1.0 + f32(max_future_substeps)
      * REACTION_MOTION_ROUNDING_PER_SUBSTEP
  );
  let physical_relative_reach = reaction_motion_upward(
    raw_relative * accumulated_rounding
  );
  let position_store_rounding = reaction_motion_position_store_rounding_upper(
    max_abs_position_m,
    maximum_contact_radius_m,
    physical_relative_reach,
    max_future_substeps
  );
  return reaction_motion_upward(
    physical_relative_reach + position_store_rounding
  );
}
`;
