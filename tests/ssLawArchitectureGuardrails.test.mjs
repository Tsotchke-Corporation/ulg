import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA,
  ULG_REPRESENTED_VOLUME_SCHEMA,
  ULG_WGSL_COMPOSED_MODULE_SCHEMA,
  assertRepresentedVolume,
  composeWgslModule,
  composeWgslVariantFromSource,
  generateRepresentedVolumeWgsl,
  generateVec4LaneAccessorsWgsl,
  isRepresentedVolume,
  mergeRepresentedVolumes,
  parseRowLayoutDescriptor,
  readRepresentedVolumeFromMechanicsRow,
  representedVolumeAtRestState,
  representedVolumeFromCurrent,
  representedVolumeFromDeformationGradient,
  resolveLayoutFieldOffset,
  retargetRepresentedVolumeToPhase,
  splitRepresentedVolume,
  writeRepresentedVolumeToMechanicsRow
} from '../ulg-gpu-abi/src/index.js';
import {
  CANONICAL_ULG_LAW_ADAPTERS,
  assertBindGroupMatchesLawDescriptor,
  assertValidLawAdapterSchedule,
  generateBindGroupLayoutEntriesFromLawDescriptor
} from '../src/runtime/sph/lawAdapterContract.js';
import {
  ULG_GPU_RESOURCE_LEASE_SCOPE_SCHEMA,
  createGpuResourceLeaseScope
} from '../src/runtime/sph/gpuResourceLease.js';
import { getSphMlsMpmWgslVariantManifests } from '../src/runtime/sph/sphMlsMpmGpuStep.js';

test('Slice 3.1: laneAccessorGenerator derives exact WGSL offsets from canonical ABI *_ROW_LAYOUT descriptors', () => {
  const parsed = parseRowLayoutDescriptor(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT, {
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT',
    requireVec4Aligned: true
  });
  assert.equal(parsed.schema, ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA);
  assert.equal(parsed.scalarCount, 32);
  assert.equal(parsed.vec4Stride, 8);

  const jField = resolveLayoutFieldOffset(parsed, 'volumeRatioJ');
  const v0Field = resolveLayoutFieldOffset(parsed, 'restVolumeM3');
  const viscField = resolveLayoutFieldOffset(parsed, 'dynamicViscosityPaS');
  assert.deepEqual({ scalarIndex: jField.scalarIndex, vec4Index: jField.vec4Index, component: jField.component },
    { scalarIndex: 18, vec4Index: 4, component: 'z' });
  assert.deepEqual({ scalarIndex: v0Field.scalarIndex, vec4Index: v0Field.vec4Index, component: v0Field.component },
    { scalarIndex: 19, vec4Index: 4, component: 'w' });
  assert.deepEqual({ scalarIndex: viscField.scalarIndex, vec4Index: viscField.vec4Index, component: viscField.component },
    { scalarIndex: 29, vec4Index: 7, component: 'y' });

  // Renaming or querying a nonexistent field fails closed synchronously.
  assert.throws(() => resolveLayoutFieldOffset(parsed, 'nonExistentLane'), RangeError);

  const wgsl = generateVec4LaneAccessorsWgsl({
    layout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
    layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT',
    bufferName: 'mls_mechanics',
    prefix: 'mech',
    fields: ['volumeRatioJ', 'restVolumeM3', 'dynamicViscosityPaS'],
    includeWriters: true
  });
  assert.match(wgsl, /fn mech_volume_ratio_j\(particle_index: u32\) -> f32 \{\n  return mls_mechanics\[particle_index \* 8u \+ 4u\]\.z;/);
  assert.match(wgsl, /fn mech_rest_volume_m3\(particle_index: u32\) -> f32 \{\n  return mls_mechanics\[particle_index \* 8u \+ 4u\]\.w;/);
  assert.match(wgsl, /fn set_mech_dynamic_viscosity_pa_s\(particle_index: u32, value: f32\)/);

  // Also verify SPH state & thermo row layouts generate clean vec4 accessors.
  const stateWgsl = generateVec4LaneAccessorsWgsl({
    layout: SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
    layoutName: 'SPH_GPU_PARTICLE_STATE_ROW_LAYOUT',
    bufferName: 'sph_state',
    prefix: 'state',
    fields: ['massKg', 'specificInternalEnergyJPerKg']
  });
  assert.match(stateWgsl, /sph_state\[particle_index \* 2u\]\.w/);
  assert.match(stateWgsl, /sph_state\[particle_index \* 2u \+ 1u\]\.w/);

  const thermoWgsl = generateVec4LaneAccessorsWgsl({
    layout: SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
    layoutName: 'SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT',
    bufferName: 'sph_thermo',
    prefix: 'thermo',
    fields: ['temperatureK', 'restDensityKgPerM3']
  });
  assert.match(thermoWgsl, /sph_thermo\[particle_index \* 3u\]\.z/);
  assert.match(thermoWgsl, /sph_thermo\[particle_index \* 3u\]\.w/);
});

test('Slice 3.2: paired RepresentedVolume makes Slice-9 V0/J phase-mismatch blow-up unconstructible', () => {
  // Cannot forge a bare { restVolumeM3, volumeRatioJ } object.
  assert.equal(isRepresentedVolume({ restVolumeM3: 0.01, volumeRatioJ: 1, currentVolumeM3: 0.01 }), false);
  assert.throws(() => assertRepresentedVolume({ restVolumeM3: 0.01, volumeRatioJ: 1 }), TypeError);

  // At rest: 8 kg of liquid water (rho0 = 1000) -> V0 = 0.008 m^3, J = 1.0.
  const liquidVol = representedVolumeAtRestState(8.0, 1000.0);
  assert.equal(liquidVol.schema, ULG_REPRESENTED_VOLUME_SCHEMA);
  assert.equal(Object.isFrozen(liquidVol), true);
  assert.ok(Math.abs(liquidVol.restVolumeM3 - 0.008) < 1e-12);
  assert.equal(liquidVol.volumeRatioJ, 1.0);
  assert.ok(Math.abs(liquidVol.currentVolumeM3 - 0.008) < 1e-12);

  // Retargeting liquid water (rho0=1000) to steam (rho0=0.6) MUST preserve physical
  // currentVolumeM3 (0.008 m^3) and adjust J_target = 0.008 / (8/0.6) = 0.0006,
  // never mixing V0_steam with J_liquid=1.0 (which would invent 13.3 m^3 instantaneously!).
  const steamRetargeted = retargetRepresentedVolumeToPhase(liquidVol, 8.0, 0.6);
  assert.ok(Math.abs(steamRetargeted.currentVolumeM3 - liquidVol.currentVolumeM3) < 1e-12);
  assert.ok(Math.abs(steamRetargeted.restVolumeM3 - 8.0 / 0.6) < 1e-12);
  assert.ok(Math.abs(steamRetargeted.volumeRatioJ - 0.0006) < 1e-12);

  // Split 1 -> 8 and merge 8 -> 1 conserve V0, currentVolumeM3, and J exactly.
  const deformed = representedVolumeFromCurrent(0.008, 0.0076);
  const { child, count } = splitRepresentedVolume(deformed, 8);
  assert.equal(count, 8);
  assert.ok(Math.abs(child.restVolumeM3 * 8 - deformed.restVolumeM3) < 1e-12);
  assert.equal(child.volumeRatioJ, deformed.volumeRatioJ);
  const merged = mergeRepresentedVolumes(Array.from({ length: 8 }, () => child));
  assert.ok(Math.abs(merged.restVolumeM3 - deformed.restVolumeM3) < 1e-12);
  assert.ok(Math.abs(merged.currentVolumeM3 - deformed.currentVolumeM3) < 1e-12);
  assert.ok(Math.abs(merged.volumeRatioJ - deformed.volumeRatioJ) < 1e-12);

  // Deformation gradient constructor enforces det(F) > 0.
  const stretched = representedVolumeFromDeformationGradient(0.001, [2, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(stretched.volumeRatioJ, 2);
  assert.equal(stretched.currentVolumeM3, 0.002);
  assert.throws(() => representedVolumeFromDeformationGradient(0.001, [-1, 0, 0, 0, 1, 0, 0, 0, 1]), RangeError);

  // Mechanics row read/write uses derived layout offsets atomically.
  const mech = new Float32Array(32);
  writeRepresentedVolumeToMechanicsRow(mech, 0, stretched, MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT);
  const roundtrip = readRepresentedVolumeFromMechanicsRow(mech, 0, MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT);
  assert.ok(Math.abs(roundtrip.restVolumeM3 - 0.001) < 1e-7);
  assert.ok(Math.abs(roundtrip.volumeRatioJ - 2.0) < 1e-7);

  // Generated RepresentedVolume WGSL derives exact vec4 indices from MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.
  const rvWgsl = generateRepresentedVolumeWgsl({ mechanicsLayout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT });
  assert.match(rvWgsl, /mls_mechanics\[particle_index \* 8u \+ 4u\]\.z/);
  assert.match(rvWgsl, /mls_mechanics\[particle_index \* 8u \+ 4u\]\.w/);
  assert.match(rvWgsl, /fn represented_volume_retarget_phase/);
});

test('Slice 3.3: GpuResourceLeaseScope turns silent GPU buffer leaks, double-consumes, and owner mismatches into loud errors', () => {
  const scope = createGpuResourceLeaseScope({ scopeId: 'step-42', epoch: 42 });
  assert.equal(scope.schema, ULG_GPU_RESOURCE_LEASE_SCOPE_SCHEMA);
  let destroyedCount = 0;
  const fakeBuf = { label: 'ulg-mls-mpm-separation-bins', destroy() { destroyedCount += 1; } };

  const lease = scope.issue(fakeBuf, {
    label: 'ulg-mls-mpm-separation-bins',
    producer: 'p2g-stage',
    expectedConsumers: ['two-level-consumer'],
    onRelease: (res) => res.destroy()
  });

  // Unreleased live lease triggers ERR_GPU_RESOURCE_LEASE_LEAK at frame end!
  assert.throws(
    () => scope.assertDrained(),
    (err) => err.code === 'ERR_GPU_RESOURCE_LEASE_LEAK' && err.leaks.length === 1 && err.leaks[0].label === 'ulg-mls-mpm-separation-bins'
  );

  // Wrong transfer owner fails closed.
  assert.throws(
    () => scope.transfer(lease, { from: 'stranger', to: 'two-level-consumer' }),
    (err) => err.code === 'ERR_GPU_LEASE_OWNER_MISMATCH'
  );

  // Unauthorized consumer fails closed.
  assert.throws(
    () => scope.consume(lease, 'rogue-pass'),
    (err) => err.code === 'ERR_GPU_LEASE_UNAUTHORIZED_CONSUMER'
  );

  // Valid transfer -> consume -> release drains cleanly.
  scope.transfer(lease, { from: 'p2g-stage', to: 'two-level-coordinator' });
  const resource = scope.consume(lease, 'two-level-consumer');
  assert.equal(resource, fakeBuf);
  assert.throws(() => scope.consume(lease, 'two-level-consumer'), (err) => err.code === 'ERR_GPU_LEASE_DOUBLE_CONSUME');
  scope.release(lease, { by: 'two-level-consumer' });
  assert.equal(destroyedCount, 1);
  assert.throws(() => scope.release(lease), (err) => err.code === 'ERR_GPU_LEASE_DOUBLE_RELEASE');
  const snap = scope.assertDrained({ requireAllReleased: true });
  assert.equal(snap.live, 0);
  assert.equal(snap.released, 1);
});

test('Slice 3.4: typed Law Adapter Contract generates and validates WebGPU bind-group layouts from declared reads/writes', () => {
  // Full canonical ULG law adapter schedule (including implicit-pressure-solve & phase-slot-refinement) validates cleanly!
  const order = CANONICAL_ULG_LAW_ADAPTERS.map((a) => a.id);
  const sched = assertValidLawAdapterSchedule(
    { stages: CANONICAL_ULG_LAW_ADAPTERS, requiredStageOrder: order },
    { requireExtendedMetadata: true }
  );
  assert.equal(sched.valid, true);
  assert.deepEqual(sched.debt, []);
  assert.ok(order.includes('implicit-pressure-solve'));
  assert.ok(order.includes('phase-slot-refinement'));

  const p2g = CANONICAL_ULG_LAW_ADAPTERS.find((a) => a.id === 'mls-mpm-p2g');
  const table = {
    'sph-particle-state': 0,
    'sph-thermo-phase': 1,
    'mls-mpm-mechanics': 2,
    'mls-mpm-grid-velocity': 3,
    'mls-mpm-grid-momentum': 4
  };
  const layoutEntries = generateBindGroupLayoutEntriesFromLawDescriptor(p2g, table, { uniformBindings: [5] });
  assert.equal(layoutEntries.length, 6);
  assert.equal(layoutEntries[0].buffer.type, 'read-only-storage');
  assert.equal(layoutEntries[1].buffer.type, 'read-only-storage');
  assert.equal(layoutEntries[2].buffer.type, 'read-only-storage');
  assert.equal(layoutEntries[3].buffer.type, 'storage');
  assert.equal(layoutEntries[4].buffer.type, 'storage');
  assert.equal(layoutEntries[5].buffer.type, 'uniform');

  // Binding too few buffers (Defect 2!) throws ERR_LAW_BIND_GROUP_MISMATCH synchronously.
  assert.throws(
    () => assertBindGroupMatchesLawDescriptor(p2g, table, [{ binding: 0 }, { binding: 1 }, { binding: 2 }], { uniformBindings: [5] }),
    (err) => err.code === 'ERR_LAW_BIND_GROUP_MISMATCH' && err.missing.includes(3) && err.missing.includes(5)
  );
  assert.doesNotThrow(
    () => assertBindGroupMatchesLawDescriptor(p2g, table, [0, 1, 2, 3, 4, 5].map((binding) => ({ binding })), { uniformBindings: [5] })
  );
});

test('Slice 3.5: named WGSL fragment composer rejects unknown/ambiguous slots and tracks live sphMlsMpmGpuStep variant manifests', () => {
  const composed = composeWgslModule({
    moduleId: 'test-law',
    variantId: 'custom-filter',
    fragments: [
      { slot: 'params', code: 'struct Params { n: u32 };' },
      { slot: 'filter', code: 'fn active(i: u32) -> bool { return true; }' },
      { slot: 'entry', code: '@compute @workgroup_size(64) fn main() { let _ok = active(0u); }' }
    ],
    overrides: {
      filter: 'fn active(i: u32) -> bool { return i < 64u; }'
    }
  });
  assert.equal(composed.schema, ULG_WGSL_COMPOSED_MODULE_SCHEMA);
  assert.deepEqual(composed.activeFragments, ['params', 'filter', 'entry']);
  assert.deepEqual(composed.overriddenSlots, ['filter']);
  assert.match(composed.code, /return i < 64u;/);
  assert.match(composed.code, /\[ulg-wgsl-module:test-law:custom-filter/);

  // Typo in override slot fails loudly instead of silently leaving base code!
  assert.throws(
    () => composeWgslModule({
      moduleId: 'test-law',
      fragments: [{ slot: 'entry', code: 'fn main() {}' }],
      overrides: { nonexistent_slot: 'fn x() {}' }
    }),
    /unknown fragment slot/
  );

  // Ambiguous duplicate anchor in source-bridge fails closed!
  assert.throws(
    () => composeWgslVariantFromSource({
      moduleId: 'dup',
      variantId: 'v1',
      baseSource: 'let x = 1u;\nlet x = 1u;\n',
      slots: [{ slot: 's', match: 'let x = 1u;', code: 'let x = 2u;' }]
    }),
    /ambiguous WGSL slot anchor/
  );

  // Live sphMlsMpmGpuStep variant manifest registry is exported cleanly.
  assert.equal(typeof getSphMlsMpmWgslVariantManifests, 'function');
  const manifests = getSphMlsMpmWgslVariantManifests();
  assert.equal(typeof manifests, 'object');
});
