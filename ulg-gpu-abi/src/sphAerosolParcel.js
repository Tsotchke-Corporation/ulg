// Independently owned aerosol inventory. Initial mass and a privately paired
// pre-transfer condensate debit have distinct provenance. The ABI by itself
// authorizes neither nucleation nor optical duplication. Physical multiplicity
// is an exact u64, not the computational parcel count.
export const ULG_SPH_AEROSOL_PARCEL_SCHEMA =
  'peercompute.ulg.sph-aerosol-parcel.v0';
export const ULG_SPH_AEROSOL_BUDGET_SCHEMA =
  'peercompute.ulg.sph-carrier-aerosol-inventory-budget.v0';

export const SPH_AEROSOL_PARCEL_WORDS = 24;
export const SPH_AEROSOL_PARCEL_BYTES = SPH_AEROSOL_PARCEL_WORDS * 4;
export const SPH_AEROSOL_BUDGET_WORDS = 40;
export const SPH_AEROSOL_BUDGET_BYTES = SPH_AEROSOL_BUDGET_WORDS * 4;
export const SPH_AEROSOL_BUDGET_MAGIC = 0x41494230; // AIB0
export const SPH_AEROSOL_BUDGET_VERSION = 0;
export const SPH_AEROSOL_NO_SOURCE_LINEAGE = 0xffffffff;

export const SPH_AEROSOL_PARCEL_STATUS = Object.freeze({
  INACTIVE: 0,
  READY: 1,
  INVALID: 255
});
export const SPH_AEROSOL_PARCEL_SOURCE_KIND = Object.freeze({
  INITIAL_CONDITIONS: 1,
  PRE_TRANSFER_CONDENSATE: 2
});
export const SPH_AEROSOL_BUDGET_ERROR = Object.freeze({
  LAYOUT: 1 << 0,
  CARRIER_INVALID: 1 << 1,
  PARCEL_INVALID: 1 << 2,
  POPULATION_OVERFLOW: 1 << 3,
  COUNT_OVERFLOW: 1 << 4,
  NUMERIC_OVERFLOW: 1 << 5,
  PARTIAL_INVALID: 1 << 6
});

export const SPH_AEROSOL_PARCEL_OFFSETS = Object.freeze({
  POSITION_X: 0,
  POSITION_Y: 1,
  POSITION_Z: 2,
  MASS: 3,
  VELOCITY_X: 4,
  VELOCITY_Y: 5,
  VELOCITY_Z: 6,
  SPECIFIC_INTERNAL_ENERGY: 7,
  TEMPERATURE: 8,
  CONDENSED_DENSITY: 9,
  RADIUS: 10,
  RESERVED: 11,
  MATERIAL_ID: 12,
  PHASE_ID: 13,
  MULTIPLICITY_LO: 14,
  MULTIPLICITY_HI: 15,
  PARCEL_ID_LO: 16,
  PARCEL_ID_HI: 17,
  SOURCE_LINEAGE_INDEX: 18,
  SOURCE_TOPOLOGY_EPOCH: 19,
  NUCLEUS_POPULATION_ID_LO: 20,
  NUCLEUS_POPULATION_ID_HI: 21,
  STATUS: 22,
  SOURCE_KIND: 23
});

export const SPH_AEROSOL_BUDGET_OFFSETS = Object.freeze({
  MASS: 0,
  SOLID_MASS: 1,
  LIQUID_MASS: 2,
  GAS_MASS: 3,
  PLASMA_MASS: 4,
  MOMENTUM_X: 5,
  MOMENTUM_Y: 6,
  MOMENTUM_Z: 7,
  INTERNAL_ENERGY: 8,
  TRANSLATIONAL_KINETIC_ENERGY: 9,
  TRACKED_ENERGY: 10,
  AEROSOL_MASS: 11,
  FIRST_MOMENT_X: 12,
  FIRST_MOMENT_Y: 13,
  FIRST_MOMENT_Z: 14,
  TEMPERATURE_MASS: 15,
  MIN_X: 16,
  MIN_Y: 17,
  MIN_Z: 18,
  MAX_X: 19,
  MAX_Y: 20,
  MAX_Z: 21,
  MIN_TEMPERATURE: 22,
  MAX_TEMPERATURE: 23,
  MAX_SPEED: 24,
  AEROSOL_CONDENSED_VOLUME: 25,
  AEROSOL_GEOMETRIC_CROSS_SECTION: 26,
  MIN_RADIUS: 27,
  MAX_RADIUS: 28,
  RESERVED: 29,
  LIVE_CARRIER_COUNT: 30,
  LIVE_PARCEL_COUNT: 31,
  MULTIPLICITY_LO: 32,
  MULTIPLICITY_HI: 33,
  ERROR_BITS: 34,
  MAGIC: 35,
  VERSION: 36,
  PARCEL_CAPACITY: 37,
  PARTICLE_COUNT: 38,
  GENERATION: 39
});

export const SPH_AEROSOL_BUDGET_ENERGY_SCOPE =
  'internal-plus-translational-kinetic-only;excludes-constitutive-apic-surface-and-field-energy';

// With nonzero ERROR_BITS all totals are diagnostic partial sums, not an
// admitted conservation budget. u64 overflow is flagged and the stored limbs
// are the modulo-2^64 sum; consumers must not accept that sum as a population.
// Bounds/min-radius in an empty FINAL packet are zero. Internal partials use
// finite extrema sentinels. Radius and optical area use f32 arithmetic; exact
// multiplicity/identity limbs are never reconstructed from those floats.
