// Pressure-adjusted carrier transform for an admitted liquid-to-gas plateau.
//
// Downstream thermal code reads a carrier energy defined against one reference
// pressure ladder. When a particle's resolved absolute pressure differs from
// that reference, the plateau moves: Clausius-Clapeyron shifts the boiling
// point, which shifts where the latent segment starts, while the latent span
// itself is unchanged. Rather than re-derive every consumer's ladder, this maps
// the particle's physical energy U onto the reference carrier C so the existing
// reference-pressure ladder stays correct, and provides the exact inverse.
//
// The reference-pressure case is bit-identical to doing nothing: it is checked
// on the f32 bit patterns of P and Pref before any arithmetic, so a run at the
// reference pressure executes the old path unchanged rather than round-tripping
// through a log.

const UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K = 8.314462618;

export const ULG_PRESSURE_CARRIER_TRANSFORM_SCHEMA =
  'peercompute.ulg.pressure-carrier-transform.v1';

// Identity law: the carrier is the physical energy, no plateau shift.
export const PRESSURE_CARRIER_LAW_REFERENCE_ONLY = 0;
// Clausius-Clapeyron plateau shift on a single liquid-to-gas segment.
export const PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU = 1;

const f32Bits = (() => {
  const floats = new Float32Array(1);
  const bits = new Uint32Array(floats.buffer);
  return (value) => {
    floats[0] = value;
    return bits[0];
  };
})();

const finitePositive = (value) => Number.isFinite(value) && value > 0;

/**
 * True when the resolved pressure is bit-identical to the reference pressure in
 * f32. Callers must consult this before any arithmetic so the reference case
 * cannot drift by a rounding step.
 */
export function isReferencePressure(absolutePressurePa, referencePressurePa) {
  return f32Bits(absolutePressurePa) === f32Bits(referencePressurePa);
}

/**
 * Resolve the shifted plateau for one admitted liquid-to-gas segment.
 *
 * anchorEnergyJPerKg / anchorTemperatureK (Ea, Ta) is a point on the liquid
 * branch below the plateau. plateauStartJPerKg / plateauEndJPerKg (E0, E1) and
 * referenceTemperatureK (Tref) describe the plateau at the reference pressure.
 *
 * Returns null when the inputs cannot support a shifted plateau, which callers
 * must treat as fail-closed rather than falling back to the reference ladder.
 */
export function resolvePressurePlateau({
  anchorEnergyJPerKg,
  anchorTemperatureK,
  plateauStartJPerKg,
  plateauEndJPerKg,
  referenceTemperatureK,
  absolutePressurePa,
  referencePressurePa,
  latentHeatJPerKg,
  molarMassKgPerMol,
  // Slope form: beta = R/(L*M) precomputed and packed into the thermal
  // material record. When supplied it is used directly, so a consumer reading
  // the packed lane reaches the same plateau as one carrying L and M.
  clausiusInvTemperatureLogSlopePerK
} = {}) {
  const Ea = Number(anchorEnergyJPerKg);
  const Ta = Number(anchorTemperatureK);
  const E0 = Number(plateauStartJPerKg);
  const E1 = Number(plateauEndJPerKg);
  const Tref = Number(referenceTemperatureK);
  const P = Number(absolutePressurePa);
  const Pref = Number(referencePressurePa);
  const suppliedSlope = Number(clausiusInvTemperatureLogSlopePerK);
  const hasSuppliedSlope = finitePositive(suppliedSlope);
  const L = Number(latentHeatJPerKg);
  const M = Number(molarMassKgPerMol);
  const slope = hasSuppliedSlope
    ? suppliedSlope
    : UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K / (L * M);

  // Malformed, stale, nonpositive, nonfinite, or mismatched pressure fails
  // closed. There is deliberately no implicit one-atmosphere fallback.
  if (
    !Number.isFinite(Ea)
    || !Number.isFinite(E0)
    || !Number.isFinite(E1)
    || !finitePositive(Ta)
    || !finitePositive(Tref)
    || !finitePositive(P)
    || !finitePositive(Pref)
    || !(hasSuppliedSlope || (finitePositive(L) && finitePositive(M)))
    || !finitePositive(slope)
    || !(E0 > Ea)
    || !(E1 >= E0)
    || !(Tref > Ta)
  ) return null;

  if (isReferencePressure(P, Pref)) {
    return {
      schema: ULG_PRESSURE_CARRIER_TRANSFORM_SCHEMA,
      lawId: PRESSURE_CARRIER_LAW_REFERENCE_ONLY,
      identity: true,
      shiftedTemperatureK: Tref,
      shiftedPlateauStartJPerKg: E0,
      shiftedPlateauEndJPerKg: E1,
      anchorEnergyJPerKg: Ea,
      plateauStartJPerKg: E0,
      plateauEndJPerKg: E1
    };
  }

  // Same relation as clausiusClapeyronBoilingPointK, expressed on the packed
  // slope so both the L/M form and the slope form take one code path.
  const invShiftedTemperature = 1 / Tref - slope * Math.log(P / Pref);
  if (!finitePositive(invShiftedTemperature)) return null;
  const shiftedTemperatureK = 1 / invShiftedTemperature;
  if (!finitePositive(shiftedTemperatureK)) return null;

  // Mean heat capacity of the liquid branch between the anchor and the
  // reference plateau, used to walk the plateau start to the shifted boil.
  const meanHeatCapacity = (E0 - Ea) / (Tref - Ta);
  const shiftedPlateauStartJPerKg =
    Ea + meanHeatCapacity * (shiftedTemperatureK - Ta);
  const shiftedPlateauEndJPerKg = shiftedPlateauStartJPerKg + (E1 - E0);

  // The shifted plateau must still sit above the anchor, or the liquid branch
  // has been inverted and no monotone carrier map exists.
  if (
    !Number.isFinite(shiftedPlateauStartJPerKg)
    || !Number.isFinite(shiftedPlateauEndJPerKg)
    || !(shiftedPlateauStartJPerKg > Ea)
  ) return null;

  return {
    schema: ULG_PRESSURE_CARRIER_TRANSFORM_SCHEMA,
    lawId: PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU,
    identity: false,
    shiftedTemperatureK,
    shiftedPlateauStartJPerKg,
    shiftedPlateauEndJPerKg,
    anchorEnergyJPerKg: Ea,
    plateauStartJPerKg: E0,
    plateauEndJPerKg: E1
  };
}

/**
 * Physical specific energy U -> reference carrier C. Piecewise linear and
 * continuous at every breakpoint, and strictly increasing wherever the plateau
 * has positive width, so the inverse below is exact.
 */
export function carrierFromPhysicalEnergy(plateau, physicalEnergyJPerKg) {
  if (!plateau) return null;
  const U = Number(physicalEnergyJPerKg);
  if (!Number.isFinite(U)) return null;
  if (plateau.identity) return U;

  const Ea = plateau.anchorEnergyJPerKg;
  const E0 = plateau.plateauStartJPerKg;
  const E0s = plateau.shiftedPlateauStartJPerKg;
  const E1s = plateau.shiftedPlateauEndJPerKg;

  if (U <= Ea) return U;
  if (U < E0s) return Ea + ((U - Ea) * (E0 - Ea)) / (E0s - Ea);
  if (U <= E1s) return E0 + (U - E0s);
  return U - (E0s - E0);
}

/**
 * Reference carrier C -> physical specific energy U. Exact inverse of
 * carrierFromPhysicalEnergy on the same plateau.
 */
export function physicalEnergyFromCarrier(plateau, carrierJPerKg) {
  if (!plateau) return null;
  const C = Number(carrierJPerKg);
  if (!Number.isFinite(C)) return null;
  if (plateau.identity) return C;

  const Ea = plateau.anchorEnergyJPerKg;
  const E0 = plateau.plateauStartJPerKg;
  const E1 = plateau.plateauEndJPerKg;
  const E0s = plateau.shiftedPlateauStartJPerKg;

  if (C <= Ea) return C;
  if (C < E0) return Ea + ((C - Ea) * (E0s - Ea)) / (E0 - Ea);
  if (C <= E1) return E0s + (C - E0);
  return C + (E0s - E0);
}
