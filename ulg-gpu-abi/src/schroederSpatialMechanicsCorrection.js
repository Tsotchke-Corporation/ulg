export const ULG_SCHROEDER_SPATIAL_MECHANICS_CORRECTION_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanics-correction.v1';
export const SCHROEDER_SPATIAL_MECHANICS_CORRECTION_MAGIC = 0x534d4331;

// Immutable proposal rows: mass, momentum xyz, mass-gradient xyz, energy
// budget. These are not native velocity rows and cannot be passed to G2P
// without the chain admission and an enrolled native-field publisher.
export function createSchroederSpatialMechanicsCorrectionLayout(capacity) {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > (0xffff_ffff-64)/8) {
    throw new RangeError('Mechanics correction requires a bounded positive capacity');
  }
  return Object.freeze({ capacity, rowWords: 8, stateOffsetWords: 64,
    byteLength: (64+capacity*8)*4 });
}

export function normalizeSchroederSpatialChainForceInputs(value) {
  const finite = (v, label, min, max) => {
    const n=Math.fround(v);
    if (typeof v !== 'number' || !Number.isFinite(n) || n<min || n>max) {
      throw new RangeError(`Chain force ${label} is outside its finite physical range`);
    }
    return n;
  };
  const vector = (v,label,min) => {
    if (!Array.isArray(v) || v.length!==3) throw new TypeError(`Chain force ${label} requires three explicit values`);
    return Object.freeze(v.map(x=>finite(x,label,min,Infinity)));
  };
  if (!value || typeof value.wallsEnabled!=='boolean' || typeof value.contactEnabled!=='boolean') {
    throw new TypeError('Chain force laws require explicit wall and contact switches');
  }
  return Object.freeze({
    dt: finite(value.dt,'dt',1e-12,Infinity),
    gravityMPerS2: vector(value.gravityMPerS2,'gravity',-Infinity),
    boxDimsM: vector(value.boxDimsM,'box dimensions',1e-12),
    wallsEnabled: value.wallsEnabled, contactEnabled: value.contactEnabled,
    cflFactor: finite(value.cflFactor,'CFL factor',1e-12,1),
    wallBarrierElasticStiffnessNPerM: finite(value.wallBarrierElasticStiffnessNPerM,'wall stiffness',0,Infinity),
    wallBarrierContactScale: finite(value.wallBarrierContactScale,'wall contact scale',0,1),
    wallBarrierMinGapM: finite(value.wallBarrierMinGapM,'wall minimum gap',1e-12,Infinity)
  });
}
