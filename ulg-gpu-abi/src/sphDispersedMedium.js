export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-buffer-set.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-authority.v0';

export const SPH_DISPERSED_MEDIUM_OPTICS_VERSION = 0;
export const SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS = 8;
export const SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES =
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT;

export const SPH_DISPERSED_MEDIUM_OPTICS_STATUS = Object.freeze({
  ready: 1,
  blocked: 255
});

export const SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT = Object.freeze([
  'dispersedMaterialId:f32',
  'dispersedPhaseId:f32',
  'opticalStateId:f32',
  'status:f32',
  'dispersedMassKg:f32',
  'scatteringCrossSectionM2:f32',
  'absorptionCrossSectionM2:f32',
  'scatteringAsymmetryCrossSectionM2:f32'
]);

export const SPH_DISPERSED_MEDIUM_OPTICS_ABI = Object.freeze({
  schema: ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
  version: SPH_DISPERSED_MEDIUM_OPTICS_VERSION,
  rowFloats: SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
  rowBytes: SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
  rowLayout: SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
  status: SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  indexing: 'dense-particle-index-aligned',
  absencePolicy: 'no-sidecar-allocation-when-no-particle-advertises-optics',
  blockedRowPolicy: 'zero-moments-status-255',
  momentPolicy:
    'finite-nonnegative-mass-scattering-and-absorption;absolute-asymmetry-not-greater-than-scattering',
  ownership: 'same-device-resident-sidecar-owned-by-sph-particle-buffer-set',
  readbackPolicy: 'no-host-hot-loop-readback'
});
