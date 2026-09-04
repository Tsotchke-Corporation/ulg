export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-buffer-set.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optics-authority.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optical-closure-table.v0';
export const ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA =
  'peercompute.ulg.sph-dispersed-medium-optical-closure-property.v0';

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

export const SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION = 0;
export const SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS = 12;
export const SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES =
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS
  * Float32Array.BYTES_PER_ELEMENT;

export const SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS = Object.freeze({
  ready: 1,
  blocked: 255
});

export const SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL = Object.freeze({
  blocked: 0,
  singleCompactCondensateCarrierLowerBound: 1,
  monodisperseRadius: 2
});

export const SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS =
  Object.freeze({
    blocked: 'blocked-missing-or-invalid-morphology',
    singleCompactCondensateCarrierLowerBound:
      'single-compact-condensate-carrier-lower-bound',
    monodisperseRadius: 'monodisperse-radius'
  });

export const SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES = Object.freeze({
  dispersedMaterialId: 0,
  vaporPhaseId: 1,
  condensedPhaseId: 2,
  opticalStateId: 3,
  morphologyModelId: 4,
  status: 5,
  condensedDensityKgPerM3: 6,
  scatteringEfficiencyQsca: 7,
  absorptionEfficiencyQabs: 8,
  asymmetryFactorG: 9,
  effectiveRadiusM: 10,
  reserved0: 11
});

export const SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT = Object.freeze([
  'dispersedMaterialId:f32',
  'vaporPhaseId:f32',
  'condensedPhaseId:f32',
  'opticalStateId:f32',
  'morphologyModelId:f32',
  'status:f32',
  'condensedDensityKgPerM3:f32',
  'scatteringEfficiencyQsca:f32',
  'absorptionEfficiencyQabs:f32',
  'asymmetryFactorG:f32',
  'effectiveRadiusM:f32',
  'reserved0:f32'
]);

export const SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ABI = Object.freeze({
  schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
  propertySchema:
    ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
  version: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION,
  rowFloats: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
  rowBytes: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES,
  rowLayout: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT,
  rowLanes: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES,
  status: SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  morphologyModel: SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  morphologyModelLabels:
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  indexing:
    'exact-dispersed-material-vapor-phase-condensed-phase-route-key',
  massAuthority:
    'already-conserved-dispersed-condensed-mass-only-never-saturation-inference',
  blockedPolicy:
    'missing-or-invalid-morphology-publishes-blocked-zero-closure-lanes',
  alignment: 'three-vec4-f32-record'
});
