// A parent dictionary and its mechanics state have different owners/ABIs.
// Rows preserve the extensive P2G quantities, plus the transported kinetic
// budget. The latter must survive averaging: p²/(2m) alone loses energy when
// distinct velocities combine. This is not yet an internal-energy deposit.
export const ULG_SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_SCHEMA =
  'peercompute.ulg.schroeder-spatial-composite-mechanics.v1';
export const SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_MAGIC = 0x53434d31;
export const SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_HEADER_WORDS = 64;
export const SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_COMPOSITE_MECHANICS_ROW_LAYOUT = Object.freeze([
  'massKg', 'momentumXKgMPerS', 'momentumYKgMPerS', 'momentumZKgMPerS',
  'massGradientX', 'massGradientY', 'massGradientZ', 'transportedKineticEnergyJ'
]);

export function createSchroederSpatialCompositeMechanicsLayout(parentFieldCapacity, { firstMoments = false } = {}) {
  if (typeof firstMoments !== 'boolean') throw new TypeError('Composite first moments require an explicit boolean');
  if (!Number.isSafeInteger(parentFieldCapacity) || parentFieldCapacity < 1
    || parentFieldCapacity > Math.floor((0xffff_ffff - 64) / (firstMoments ? 19 : 16))) {
    throw new RangeError('Composite mechanics requires a bounded positive field capacity');
  }
  return Object.freeze({
    parentFieldCapacity,
    rowWords: 8,
    baselineOffsetWords: 64,
    combinedOffsetWords: 64 + parentFieldCapacity * 8,
    firstMoments,
    firstMomentOffsetWords: firstMoments ? 64 + parentFieldCapacity * 16 : 0,
    byteLength: (64 + parentFieldCapacity * (firstMoments ? 19 : 16)) * 4
  });
}
