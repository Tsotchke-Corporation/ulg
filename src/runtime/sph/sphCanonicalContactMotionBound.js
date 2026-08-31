/**
 * Shared leaf contract for the canonical contact solver's absolute position
 * trust region. The motion-envelope watcher imports these constants instead
 * of copying solver literals, so a solver/watch revision drift fails exact
 * receipt validation rather than silently weakening the bound.
 */
export const SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION =
  'canonical-contact-epoch-trust-wall-shell-v1';

export const SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS = 16;

export const SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M = 1e-6;

export const SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER = 64;

// Smallest f32 strictly above sqrt(3). It converts a per-axis clearance-shell
// bound into a Euclidean 3-D displacement bound without an implementation-
// dependent WGSL sqrt underestimate.
export const SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS = 0x3fdd_b3d8;

export const SPH_CANONICAL_CONTACT_MOTION_BOUND = Object.freeze({
  revision: SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION,
  positionTrustDiameters:
    SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS,
  positionToleranceAbsoluteM:
    SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_ABSOLUTE_M,
  positionToleranceEpsilonMultiplier:
    SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER,
  wallShellEuclideanUpperF32Bits:
    SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS
});
