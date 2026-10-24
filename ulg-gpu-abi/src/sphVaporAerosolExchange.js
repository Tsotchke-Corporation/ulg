// A conservative representation-transfer candidate, NOT a nucleation, kinetic,
// matched-interval or outer-publication authority. Every edge connects one
// actual pure gas owner to one already existing, colocated liquid parcel.
export const ULG_SPH_VAPOR_AEROSOL_EXCHANGE_SCHEMA =
  'peercompute.ulg.sph-vapor-aerosol-conservative-candidate.v1';
export const SPH_VAPOR_AEROSOL_EXCHANGE_MAGIC = 0x56414530; // VAE0
export const SPH_VAPOR_AEROSOL_EXCHANGE_VERSION = 1;
export const SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_WORDS = 32;
export const SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_WORDS = 8;
export const SPH_VAPOR_AEROSOL_EXCHANGE_MATERIAL_FLOATS = 16;
export const SPH_VAPOR_AEROSOL_EXCHANGE_SURFACE_FLOATS = 4;
export const SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_HEADER_WORDS = 16;
export const SPH_VAPOR_AEROSOL_EXCHANGE_WORKGROUP_SIZE = 64;

export const SPH_VAPOR_AEROSOL_EXCHANGE_STATUS = Object.freeze({
  PENDING: 0, READY: 1, FAILED: 2
});
export const SPH_VAPOR_AEROSOL_EXCHANGE_ERROR = Object.freeze({
  LAYOUT: 1 << 0,
  EOS: 1 << 1,
  CALORIC: 1 << 2,
  MATERIAL: 1 << 3,
  PRODUCT_COUNT: 1 << 4,
  PRODUCT: 1 << 5,
  PARCEL: 1 << 6,
  EDGE: 1 << 7,
  OVERLAP: 1 << 8,
  SOURCE: 1 << 9,
  MECHANICS: 1 << 10,
  DOMAIN: 1 << 11,
  NUMERIC: 1 << 12,
  CONSERVATION: 1 << 13,
  COMPLETION: 1 << 14
});
export const SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_FAILURE = 0x80000000;
export const SPH_VAPOR_AEROSOL_EXCHANGE_CONTROL_OFFSETS = Object.freeze({
  MAGIC: 0, VERSION: 1, STATUS: 2, ERROR_BITS: 3, EDGE_COUNT: 4,
  ACCEPTED_EDGES: 5, PRODUCT_LIVE_COUNT: 6, READY_PARCEL_COUNT: 7,
  OUTPUT_COUNT_GENERATION: 8, OUTPUT_COUNT_SEAL: 9,
  EXPECTED_EOS_GENERATION: 10
});
// The control suffix has one u32 per edge: 0 pending, 1 accepted, or
// EDGE_FAILURE | ERROR bits. A single error rejects the ENTIRE candidate;
// successful per-edge writes inside a failed candidate are not publishable.

export const SPH_VAPOR_AEROSOL_EXCHANGE_PARAM_OFFSETS = Object.freeze({
  PARTICLE_COUNT: 0, PRODUCT_CAPACITY: 1, AEROSOL_CAPACITY: 2,
  EDGE_COUNT: 3, MATERIAL_COUNT: 4, STATE_OFFSET: 5, THERMO_OFFSET: 6,
  MECHANICS_OFFSET: 7, PRODUCT_OFFSET: 8, PARCEL_OFFSET: 9,
  EOS_CONTROL_OFFSET: 10, COMPACT_OFFSET: 11, CALORIC_CELLS_OFFSET: 12,
  PRODUCT_COUNT_OFFSET: 13, EXPECTED_EOS_GENERATION: 14,
  COMPACT_CAPACITY: 15, CALORIC_CELL_CAPACITY: 16, SOURCE_WORD_COUNT: 17,
  PRODUCT_COUNT_PRESENT: 18, OUTPUT_COUNT_GENERATION: 19,
  OUTPUT_COUNT_SEAL: 20, SOURCE_COUNT_GENERATION: 21, SOURCE_COUNT_SEAL: 22
});
// Offsets are u32 WORD offsets, not byte offsets. Segment strides are S8,
// T12, M32, product32, parcel24, EOS-control36, compact16, caloric8 and a
// 64-word (256-byte-aligned) product-count record. Params23..31 are zero.
// Params21/22 match the ORIGINAL count descriptor exactly (zero if absent).
// The owner GPU-copies all original buffers to one immutable arena and
// copies that arena to the candidate before dispatch. There are no host
// numerical source reads and no aliases between arena segments.

export const SPH_VAPOR_AEROSOL_EXCHANGE_EDGE_OFFSETS = Object.freeze({
  GAS_KIND: 0, GAS_INDEX: 1, PARCEL_INDEX: 2, MATERIAL_ROW: 3,
  DELTA_MASS: 4, ENTHALPY_CORRECTION: 5, CONDUCTIVE_HEAT: 6,
  PRESSURE_WORK_INTO_LIQUID: 7
});
export const SPH_VAPOR_AEROSOL_EXCHANGE_GAS_KIND = Object.freeze({
  PARTICLE: 0, UNPLACED_PRODUCT: 1
});
// Edge0..3 are u32; edge4..7 are bitcast f32. Signed dm>0 condenses;
// dm<0 evaporates. The three independent energy proposals are joules into
// liquid, with their exact opposite into gas. No external-energy lane exists.
// In particular, enthalpy correction is NOT a second latent-heat source:
// the phase-specific U(T) offsets already retain the vapor/liquid difference.
// dm=0 is fixed-mass heat exchange: enthalpy correction and pressure work must
// both be zero. MATERIAL_ROW then identifies the GAS caloric model; the liquid
// model is resolved from the actual parcel material ID. Heat-only edges may
// share either endpoint, including across gas species; mass edges cannot share
// an endpoint with ANY other edge. One invocation gathers each heat endpoint
// from immutable source, so edge order never serially changes temperatures.
// Signed heat packets are summed exactly as integers in units of 2^-149 J.
// A nonzero endpoint sum not exactly representable as normal f32 rejects this bounded
// writer. Final stored dU*m must match its packet within 1e-5 relative error,
// without a reservoir-energy-sized epsilon. Zero net heat preserves U bits.
// This is not a kinetic heat law, all-member edge producer, matched interval,
// or solution to the full resident small-inventory precision problem.
// Heat/mass classification uses the packed integer zero encoding (either sign).
// Nonzero subnormal mass requests explicitly reject before floating arithmetic.

export const SPH_VAPOR_AEROSOL_EXCHANGE_MATERIAL_OFFSETS = Object.freeze({
  MATERIAL_ID: 0, MOLAR_MASS: 1, GAS_U_LO: 2, GAS_U_HI: 3,
  LIQUID_U_LO: 4, LIQUID_U_HI: 5, TEMPERATURE_MIN: 6,
  TEMPERATURE_MAX: 7, LIQUID_DENSITY: 8, SIGMA_INTERCEPT: 9,
  SIGMA_SLOPE: 10, SURFACE_READY: 11, GAS_CV: 12, GAMMA: 13,
  MAX_PRESSURE: 14, RESERVED: 15
});
export const SPH_VAPOR_AEROSOL_EXCHANGE_SURFACE_OFFSETS = Object.freeze({
  OLD_AREA: 0, OLD_INTERNAL_ENERGY: 1, NEW_AREA: 2,
  NEW_INTERNAL_ENERGY: 3
});
// The sidecar contains FOUR f32 values per parcel, not two parcel records.
// sigma(T)=a+b*T is a surface FREE-energy density. Its separately tracked
// internal energy is U_surface=(sigma-T*dSigma/dT)*A=a*A. It never aliases
// the parcel's reserved word11, budget word29, or bulk specific-U lane.
export const SPH_VAPOR_AEROSOL_EXCHANGE_ENERGY_SCOPE =
  'bulk-internal-plus-translational-kinetic-plus-linear-equilibrium-surface-internal';
export const SPH_VAPOR_AEROSOL_EXCHANGE_NUMERICAL_POLICY =
  'three-round-f32-common-debit-credit;post-dispatch-stored-endpoint-gate;each-endpoint-mass-ratio-at-most-2;exact-mass-equality;requested-dm-relative-budget-1e-5';
// Only independently loaded endpoint words in finalization prove rounding.
// In-register expressions in apply may be reassociated by a WGSL backend.
// Each old/new mass pair must have ratio<=2, checked with integer encodings.
// Within this exact-subtraction domain, debit==credit proves equal physical
// differences of the stored endpoints. Larger supplied transfers reject; the
// writer neither chooses smaller timesteps nor silently clamps a kinetic rate.
// Unclamped physical gas c(T) is updated, static nonnegative K retained.
// M28 remains HISTORICAL source pressure, and copied EOS/compact/caloric rows
// remain historical inputs. All require actual successor EOS/refresh before
// mechanics continuation. maxPressure is a cold model domain, NOT a pressure
// witness in this candidate. None of these copied fields admits continuation.

// Fixed arithmetic admission budgets, not a caller-tunable physics tolerance.
// T uses the existing explicit thermal compiler's f32 representability budget.
export const SPH_VAPOR_AEROSOL_EXCHANGE_RELATIVE_BUDGET = 1e-5;
export const SPH_VAPOR_AEROSOL_EXCHANGE_CONSERVATION_BUDGET = 2e-5;
export const SPH_VAPOR_AEROSOL_EXCHANGE_TEMPERATURE_ABSOLUTE_BUDGET_K = 1e-4;
export const SPH_VAPOR_AEROSOL_EXCHANGE_TEMPERATURE_DOMAIN_BUDGET = 1e-6;
