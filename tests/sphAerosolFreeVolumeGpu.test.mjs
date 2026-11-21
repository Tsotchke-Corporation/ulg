import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SPH_SPATIAL_GAS_FREE_VOLUME_AEROSOL_VERSION,
  SPH_SPATIAL_GAS_FREE_VOLUME_AEROSOL_GEOMETRY_BYTES,
  SPH_SPATIAL_GAS_FREE_VOLUME_CONTROL_OFFSETS as O,
  SPH_SPATIAL_GAS_FREE_VOLUME_STATUS as S,
  createSphSpatialGasFreeVolumeLayout
} from '../ulg-gpu-abi/src/sphSpatialGasFreeVolume.js';
import { createSphSpatialGasFreeVolumeWgsl } from '../ulg-gpu-abi/src/sphSpatialGasFreeVolumeWgsl.js';
import { sphSpatialGasLedgerEosWgsl, runSphSpatialGasLedgerEosRetainedWebGpu }
  from '../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';

// Layout/structural checks complement the real producer/consumer numerical
// fixture; these do not stand in for GPU arithmetic acceptance.
test('optional aerosol volume ABI fits reserved lanes and leaves legacy defaults unextended', () => {
  const layout = createSphSpatialGasFreeVolumeLayout({ cellCapacity: 128 });
  assert.equal(layout.paramsByteLength, 288); assert.equal(layout.controlWords, 64);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_AEROSOL_VERSION, 1);
  assert.equal(SPH_SPATIAL_GAS_FREE_VOLUME_AEROSOL_GEOMETRY_BYTES, 272);
  assert.deepEqual([O.AEROSOL_ENABLED, O.AEROSOL_FAMILY_ID, O.AEROSOL_GENERATION,
    O.AEROSOL_CAPACITY, O.AEROSOL_VISITED_COUNT, O.AEROSOL_LIVE_COUNT,
    O.INVALID_AEROSOL_COUNT, O.AEROSOL_VERSION, O.AEROSOL_COMPLETION_GENERATION],
  [35, 36, 37, 38, 39, 40, 41, 42, 43]);
  assert.equal(S.INVALID_AEROSOL, 1024);
  const ordinary = createSphSpatialGasFreeVolumeWgsl(layout);
  assert.doesNotMatch(ordinary, /fn scatter_aerosol_condensed_volume|binding\(9\)/);
});

test('aerosol volume uses material-agnostic m/rho through B/A/W without radius, multiplicity or sparse normalization', () => {
  const source = createSphSpatialGasFreeVolumeWgsl(createSphSpatialGasFreeVolumeLayout({ cellCapacity: 16 }), { aerosols: true });
  const scatter = source.slice(source.indexOf('fn aerosol_quadratic_weight'), source.indexOf('fn build_gas_free_volume'));
  assert.match(scatter, /let volume = mass \/ density;/);
  assert.match(scatter, /vec3<f32>\(node\) \* 0\.5 \+ f32\(params\.grid_shift\)/);
  assert.match(scatter, /aerosol_project_fine_node\(base \+ vec3<i32>\(offset\), volume \* weight\)/);
  assert.doesNotMatch(scatter, /parent_field_view\[|field_key|volume \/.*(weight|count)|pow\(/);
  assert.match(scatter, /atomicAdd\(&output_control\[39u\], 1u\)/);
  assert.doesNotMatch(scatter, /atomicStore\(&output_control\[39u\]/);
  assert.match(scatter, /params\.aerosol_capacity > arrayLength\(&aerosol_parcels\) \/ 24u/);
  assert.match(scatter, /!finite_f32\(grid_position\.x\)/);
  assert.match(scatter, /source_kind == 1u/); assert.match(scatter, /source_kind == 2u/);
  const otherCapacity = createSphSpatialGasFreeVolumeWgsl(createSphSpatialGasFreeVolumeLayout({ cellCapacity: 512 }), { aerosols: true });
  assert.equal(otherCapacity, source, 'capacity does not specialize material-agnostic code');
});

test('EOS requires exact optional aerosol completion and rejects an enabled/absent mismatch', () => {
  for (const [lane, field] of [[35, 'enabled'], [36, 'family_id'], [37, 'generation'],
    [38, 'capacity'], [42, 'version']]) {
    assert.ok(sphSpatialGasLedgerEosWgsl.includes(
      `gas_free_volume_control[${lane}u] == params.aerosol_${field}`));
  }
  assert.match(sphSpatialGasLedgerEosWgsl, /gas_free_volume_control\[39u\] == params\.aerosol_capacity/);
  assert.match(sphSpatialGasLedgerEosWgsl, /gas_free_volume_control\[43u\] == params\.free_volume_generation/);
  assert.match(sphSpatialGasLedgerEosWgsl, /gas_free_volume_control\[41u\] == 0u/);
});

test('direct EOS rejects conflicting or accessor upload aerosol declarations before GPU work', async () => {
  const noWork = () => { throw new Error('GPU work must not begin for conflicting source declarations'); };
  const device = { createBuffer: noWork, createCommandEncoder: noWork,
    queue: { writeBuffer: noWork, submit: noWork } };
  const namedFamily = Object.freeze({ familyId: 1 });
  const accessorUpload = Object.defineProperty({}, 'aerosolFamily', { get: noWork });
  const inheritedUpload = Object.create({ aerosolFamily: namedFamily });
  for (const args of [
    { sphParticleUpload: { aerosolFamily: namedFamily }, aerosolFamily: null },
    { sphParticleUpload: {}, aerosolFamily: namedFamily },
    { sphParticleUpload: { aerosolFamily: namedFamily }, aerosolFamily: { ...namedFamily } },
    { sphParticleUpload: accessorUpload }, { sphParticleUpload: inheritedUpload }
  ]) {
    const result = await runSphSpatialGasLedgerEosRetainedWebGpu({ device, ...args });
    assert.equal(result.ready, false);
    assert.equal(result.status, 'spatial-gas-ledger-eos-rejected-aerosol-source');
    assert.match(result.reason, /conflicts|own data property|inherited metadata/);
  }
});
