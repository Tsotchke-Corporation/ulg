import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPTICAL_RESOLVER_MODE_BAND_GAP,
  OPTICAL_RESOLVER_MODE_CHERENKOV,
  OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
  OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH,
  OPTICAL_RESOLVER_WEBGPU_SCHEMA,
  OPTICAL_RESOLVER_WGSL,
  packOpticalResolverRequests
} from '../src/runtime/material/opticalResolverWebGpu.js';
import {
  RADIAL_KS_OBSERVABLES_WGSL,
  RADIAL_KS_POTENTIAL_WGSL,
  RADIAL_KS_SPIN_ORBIT_WGSL,
  RADIAL_KS_WEBGPU_PROGRAM_HASH,
  RADIAL_KS_WEBGPU_SCHEMA
} from '../src/runtime/electronicStructure/radialKohnShamWebGpu.js';
import {
  MATERIAL_RESOLVER_DEFAULT_FINGERPRINT,
  createMaterialResolverPipeline
} from '../src/runtime/material/materialResolverPipeline.js';
import {
  MATERIAL_RESOLVER_STATUS,
  materialResolverFamilyById
} from '../src/runtime/material/materialResolverManifest.js';

test('Phase 6 WebGPU optical & radial Kohn-Sham WGSL shaders declare clean bindings and deterministic program hashes', () => {
  assert.equal(OPTICAL_RESOLVER_WEBGPU_SCHEMA, 'peercompute.ulg.optical-resolver-webgpu.v1');
  assert.equal(RADIAL_KS_WEBGPU_SCHEMA, 'peercompute.ulg.radial-kohn-sham-webgpu.v1');
  assert.match(OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH, /^wgsl-fnv1a64:[0-9a-f]{16}$/);
  assert.match(RADIAL_KS_WEBGPU_PROGRAM_HASH, /^wgsl-fnv1a64:[0-9a-f]{16}$/);
  assert.ok(MATERIAL_RESOLVER_DEFAULT_FINGERPRINT.includes(OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH));
  assert.ok(MATERIAL_RESOLVER_DEFAULT_FINGERPRINT.includes(RADIAL_KS_WEBGPU_PROGRAM_HASH));

  assert.ok(OPTICAL_RESOLVER_WGSL.includes('@compute @workgroup_size(128, 1, 1)'));
  assert.ok(OPTICAL_RESOLVER_WGSL.includes('fn resolve_optical_materials'));
  assert.ok(RADIAL_KS_POTENTIAL_WGSL.includes('fn ks_hartree_pbe_xc'));
  assert.ok(RADIAL_KS_OBSERVABLES_WGSL.includes('fn ks_density_and_observables'));
  assert.ok(RADIAL_KS_SPIN_ORBIT_WGSL.includes('fn ks_spin_orbit_quadrature'));

  const elecFamily = materialResolverFamilyById('peercompute.ulg.material-resolver.electronic-structure-band-optics.v0');
  const optFamily = materialResolverFamilyById('peercompute.ulg.material-resolver.optical-pbr-closures.v0');
  assert.equal(elecFamily.currentStatus, MATERIAL_RESOLVER_STATUS.HYBRID_WEBGPU_POTENTIAL_CPU_EIGENSOLVER);
  assert.equal(optFamily.currentStatus, MATERIAL_RESOLVER_STATUS.WEBGPU_DERIVED_WITH_CPU_FALLBACK);
  assert.ok(elecFamily.webgpu?.entrypoints?.length > 0);
  assert.ok(optFamily.webgpu?.entrypoints?.length > 0);
});

test('packOpticalResolverRequests packs Drude-Lorentz, Cherenkov, and band-gap requests into flat Float32 ABI', () => {
  const packed = packOpticalResolverRequests([
    {
      mode: OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ,
      conductionElectronDensityPerM3: 5.9e28,
      pathLengthM: 0.2,
      interbandOscillators: [
        { energyEv: 2.35, dampingEv: 0.55, strengthWeight: 0.62 }
      ]
    },
    {
      mode: OPTICAL_RESOLVER_MODE_CHERENKOV,
      beta: 0.94,
      refractiveIndex: 1.333,
      chargeZ: 1
    },
    {
      mode: OPTICAL_RESOLVER_MODE_BAND_GAP,
      electronicGapEv: 2.2,
      densityCrossSectionPerM: 120,
      pathLengthM: 0.1
    }
  ]);

  assert.equal(packed.materialCount, 3);
  assert.equal(packed.oscillatorCount, 1);
  assert.equal(packed.descData.length, 24);
  assert.equal(packed.oscData.length, 4);
  assert.equal(packed.descData[5], OPTICAL_RESOLVER_MODE_DRUDE_LORENTZ);
  assert.equal(packed.descData[8 + 5], OPTICAL_RESOLVER_MODE_CHERENKOV);
  assert.equal(packed.descData[16 + 5], OPTICAL_RESOLVER_MODE_BAND_GAP);
  assert.ok(Math.abs(packed.oscData[0] - 2.35) < 1e-5);
});

test('MaterialResolverPipeline resolves Cherenkov cleanly on CPU fallback and reports webgpu program hashes in stats', async () => {
  const pipeline = createMaterialResolverPipeline();
  const s = pipeline.stats();
  assert.equal(s.webgpuDeviceAttached, false);
  assert.equal(s.webgpuProgramHashes.optical, OPTICAL_RESOLVER_WEBGPU_PROGRAM_HASH);
  assert.equal(s.webgpuProgramHashes.radialKohnSham, RADIAL_KS_WEBGPU_PROGRAM_HASH);

  const sub = await pipeline.resolveCherenkov({ beta: 0.6, refractiveIndex: 1.333 });
  assert.equal(sub.active, false);
  assert.deepEqual([...sub.srgb], [0, 0, 0]);
  assert.equal(sub.resolverStatus, 'cpu-derived');

  const sup = await pipeline.resolveCherenkov({ beta: 0.94, refractiveIndex: 1.333 });
  assert.equal(sup.active, true);
  assert.ok(sup.srgb[2] > sup.srgb[0]);
  assert.equal(sup.resolverStatus, 'cpu-derived');

  // Fail-closed vacuum default (n=1.0) when refractiveIndex is omitted — never silently assume H2O 1.333!
  const vac = await pipeline.resolveCherenkov({ beta: 0.94 });
  assert.equal(vac.active, false);

  // Fail-closed when non-Cherenkov optical batch is requested without WebGPU device
  await assert.rejects(
    () => pipeline.resolveOpticalBatch([{ mode: OPTICAL_RESOLVER_MODE_BAND_GAP, electronicGapEv: 2.2 }]),
    /WebGPU GPUDevice/
  );
});
