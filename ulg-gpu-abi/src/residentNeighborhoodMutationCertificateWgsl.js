import {
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC,
  RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION,
  RESIDENT_NEIGHBORHOOD_MUTATION_FLAG,
  RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32,
  RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE
} from './residentNeighborhoodMutationCertificate.js';

export function residentNeighborhoodMutationCertificateWriterWgsl({ binding } = {}) {
  const resolvedBinding = Number(binding);
  if (!Number.isInteger(resolvedBinding) || resolvedBinding < 0) {
    throw new RangeError('mutation certificate binding must be a non-negative integer');
  }
  return /* wgsl */ `
@group(0) @binding(${resolvedBinding}) var<storage, read_write>
  resident_mutation_certificate: array<atomic<u32>>;

const RESIDENT_MUTATION_MAGIC: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_MAGIC}u;
const RESIDENT_MUTATION_VERSION: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_CERTIFICATE_VERSION}u;
const RESIDENT_MUTATION_SLOT_ARMED: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_STATE.ARMED}u;
const RESIDENT_MUTATION_INVALID_OLD: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_OLD_POSITION}u;
const RESIDENT_MUTATION_INVALID_NEW: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_NEW_POSITION}u;
const RESIDENT_MUTATION_INVALID_BOUND: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.INVALID_DISPLACEMENT_BOUND}u;
const RESIDENT_MUTATION_NEW_SOURCE: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.NEWLY_ACTIVATED_SOURCE}u;
const RESIDENT_MUTATION_INVALID_HEADER: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_FLAG.SLOT_HEADER_INVALID}u;
const RESIDENT_MUTATION_SLOT_U32: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_U32}u;
const RESIDENT_MUTATION_MAGIC_INDEX: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.MAGIC}u;
const RESIDENT_MUTATION_VERSION_INDEX: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.VERSION}u;
const RESIDENT_MUTATION_SLOT_STATE_INDEX: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.SLOT_STATE}u;
const RESIDENT_MUTATION_MAX_INCREMENT_INDEX: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.MAX_INCREMENT_UPPER_BITS}u;
const RESIDENT_MUTATION_FLAGS_INDEX: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.MUTATION_FLAGS}u;
const RESIDENT_MUTATION_WRITER_SEEN_INDEX: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_SLOT_INDEX.WRITER_SEEN}u;
const RESIDENT_MUTATION_POSITIVE_INFINITY_BITS: u32 = ${RESIDENT_NEIGHBORHOOD_MUTATION_POSITIVE_INFINITY_BITS}u;

fn resident_mutation_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn resident_mutation_finite_vec3(value: vec3<f32>) -> bool {
  return resident_mutation_finite(value.x)
    && resident_mutation_finite(value.y)
    && resident_mutation_finite(value.z);
}

fn resident_mutation_next_up_nonnegative(value: f32) -> f32 {
  if (!resident_mutation_finite(value) || value < 0.0) {
    return bitcast<f32>(RESIDENT_MUTATION_POSITIVE_INFINITY_BITS);
  }
  if (value == 0.0) {
    return 0.0;
  }
  return bitcast<f32>(bitcast<u32>(value) + 1u);
}

fn resident_mutation_component_upper(next_value: f32, previous_value: f32) -> f32 {
  if (next_value == previous_value) {
    return 0.0;
  }
  return resident_mutation_next_up_nonnegative(abs(next_value - previous_value));
}

fn resident_mutation_displacement_upper(
  previous_position: vec3<f32>,
  next_position: vec3<f32>
) -> f32 {
  let dx = resident_mutation_component_upper(next_position.x, previous_position.x);
  let dy = resident_mutation_component_upper(next_position.y, previous_position.y);
  let dz = resident_mutation_component_upper(next_position.z, previous_position.z);
  let xy = resident_mutation_next_up_nonnegative(dx + dy);
  return resident_mutation_next_up_nonnegative(xy + dz);
}

fn resident_mutation_note_position(
  source_index: u32,
  previous_position: vec3<f32>,
  next_position: vec3<f32>,
  previous_mass: f32,
  next_mass: f32
) {
  if (arrayLength(&resident_mutation_certificate) < RESIDENT_MUTATION_SLOT_U32
    || atomicLoad(&resident_mutation_certificate[RESIDENT_MUTATION_MAGIC_INDEX])
      != RESIDENT_MUTATION_MAGIC
    || atomicLoad(&resident_mutation_certificate[RESIDENT_MUTATION_VERSION_INDEX])
      != RESIDENT_MUTATION_VERSION
    || atomicLoad(&resident_mutation_certificate[RESIDENT_MUTATION_SLOT_STATE_INDEX])
      != RESIDENT_MUTATION_SLOT_ARMED) {
    if (arrayLength(&resident_mutation_certificate) > RESIDENT_MUTATION_FLAGS_INDEX) {
      atomicOr(
        &resident_mutation_certificate[RESIDENT_MUTATION_FLAGS_INDEX],
        RESIDENT_MUTATION_INVALID_HEADER
      );
    }
    return;
  }
  if (source_index == 0u) {
    atomicStore(&resident_mutation_certificate[RESIDENT_MUTATION_WRITER_SEEN_INDEX], 1u);
  }
  if (!resident_mutation_finite_vec3(previous_position)) {
    atomicOr(
      &resident_mutation_certificate[RESIDENT_MUTATION_FLAGS_INDEX],
      RESIDENT_MUTATION_INVALID_OLD
    );
    return;
  }
  if (!resident_mutation_finite_vec3(next_position)) {
    atomicOr(
      &resident_mutation_certificate[RESIDENT_MUTATION_FLAGS_INDEX],
      RESIDENT_MUTATION_INVALID_NEW
    );
    return;
  }
  let upper = resident_mutation_displacement_upper(previous_position, next_position);
  if (!resident_mutation_finite(upper) || upper < 0.0) {
    atomicOr(
      &resident_mutation_certificate[RESIDENT_MUTATION_FLAGS_INDEX],
      RESIDENT_MUTATION_INVALID_BOUND
    );
    return;
  }
  atomicMax(
    &resident_mutation_certificate[RESIDENT_MUTATION_MAX_INCREMENT_INDEX],
    bitcast<u32>(upper)
  );
  if (!(previous_mass > 0.0) && next_mass > 0.0) {
    atomicOr(
      &resident_mutation_certificate[RESIDENT_MUTATION_FLAGS_INDEX],
      RESIDENT_MUTATION_NEW_SOURCE
    );
  }
}
`;
}
