import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ABI,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  SPH_DISPERSED_MEDIUM_OPTICS_ABI,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICS_VERSION,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
  sphDispersedMediumOpticsWgsl
} from '../ulg-gpu-abi/src/index.js';

test('closure ABI v1 adds a tagged compact complex-index sphere without widening rows', () => {
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION, 1);
  assert.equal(
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
      .singleCompactSphereComplexIndex,
    3
  );
  assert.equal(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.relativeRefractiveIndexN,
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.scatteringEfficiencyQsca
  );
  assert.equal(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES
      .relativeExtinctionCoefficientK,
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.absorptionEfficiencyQabs
  );
  assert.equal(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.referenceWavelengthM,
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.reserved0
  );
  assert.match(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ABI.taggedLanePolicy,
    /relative-complex-index.*reference-wavelength/
  );
});

test('dispersed-medium optics v0 fixes one exact eight-f32 particle row', () => {
  assert.equal(
    ULG_SPH_DISPERSED_MEDIUM_OPTICS_SCHEMA,
    'peercompute.ulg.sph-dispersed-medium-optics.v0'
  );
  assert.equal(
    ULG_SPH_DISPERSED_MEDIUM_OPTICS_BUFFER_SET_SCHEMA,
    'peercompute.ulg.sph-dispersed-medium-optics-buffer-set.v0'
  );
  assert.equal(
    ULG_SPH_DISPERSED_MEDIUM_OPTICS_AUTHORITY_SCHEMA,
    'peercompute.ulg.sph-dispersed-medium-optics-authority.v0'
  );
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICS_VERSION, 0);
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS, 8);
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICS_ROW_BYTES, 32);
  assert.deepEqual(SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT, [
    'dispersedMaterialId:f32',
    'dispersedPhaseId:f32',
    'opticalStateId:f32',
    'status:f32',
    'dispersedMassKg:f32',
    'scatteringCrossSectionM2:f32',
    'absorptionCrossSectionM2:f32',
    'scatteringAsymmetryCrossSectionM2:f32'
  ]);
  assert.deepEqual(SPH_DISPERSED_MEDIUM_OPTICS_STATUS, {
    ready: 1,
    blocked: 255
  });
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICS_ABI.rowLayout, SPH_DISPERSED_MEDIUM_OPTICS_ROW_LAYOUT);
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICS_ABI.status, SPH_DISPERSED_MEDIUM_OPTICS_STATUS);
  assert.match(SPH_DISPERSED_MEDIUM_OPTICS_ABI.readbackPolicy, /no-host-hot-loop-readback/);
});

test('dispersed-medium WGSL publishes the exact struct and fail-closed moment predicate', () => {
  for (const field of [
    'dispersed_material_id',
    'dispersed_phase_id',
    'optical_state_id',
    'status',
    'dispersed_mass_kg',
    'scattering_cross_section_m2',
    'absorption_cross_section_m2',
    'scattering_asymmetry_cross_section_m2'
  ]) {
    assert.match(sphDispersedMediumOpticsWgsl, new RegExp(`${field}: f32`));
  }
  assert.match(sphDispersedMediumOpticsWgsl, /STATUS_READY: f32 = 1\.0/);
  assert.match(sphDispersedMediumOpticsWgsl, /STATUS_BLOCKED: f32 = 255\.0/);
  assert.match(sphDispersedMediumOpticsWgsl, /row\.dispersed_mass_kg >= 0\.0/);
  assert.match(sphDispersedMediumOpticsWgsl, /row\.scattering_cross_section_m2 >= 0\.0/);
  assert.match(sphDispersedMediumOpticsWgsl, /row\.absorption_cross_section_m2 >= 0\.0/);
  assert.match(
    sphDispersedMediumOpticsWgsl,
    /abs\(row\.scattering_asymmetry_cross_section_m2\)[\s\S]*<= row\.scattering_cross_section_m2/
  );
  assert.doesNotMatch(sphDispersedMediumOpticsWgsl, /@binding/);
});
