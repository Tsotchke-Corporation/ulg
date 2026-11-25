import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

import {
  SCHROEDER_SOLID_FLUID_THERMAL_SPATIAL_AUTHORITY,
  schroederSolidFluidThermalWgsl
} from '../src/runtime/sph/schroederSolidFluidThermalGpu.js';
import {
  SCHROEDER_SOLID_FLUID_CONTACT_SPATIAL_AUTHORITY,
  schroederSolidFluidContactWgsl
} from '../src/runtime/sph/schroederSolidFluidContactGpu.js';
import {
  SOLID_LIQUID_VELOCITY_SEPARATION_LAW_DESCRIPTOR,
  ULG_SOLID_LIQUID_SLIP_SCHEMA,
  detectMixedSolidLiquidContinuumState,
  resolveSolidLiquidSlipFixedScale,
  sphSolidLiquidVelocitySeparationWgsl
} from '../src/runtime/sph/sphSolidLiquidVelocitySeparationGpu.js';
import {
  LAW_SPATIAL_AUTHORITIES,
  validateLawAdapterDescriptor
} from '../src/runtime/sph/lawAdapterContract.js';
import {
  SPH_PHASE_SCENARIO_PRESETS,
  sphPhaseScenarioPresetById
} from '../src/runtime/sphPhaseScenarioPresets.js';

const REPO_ROOT = process.cwd();

test('Gate 6 Phase C: ZERO private 4096-bucket solid-fluid spatial hashes exist anywhere in src/runtime/sph/', () => {
  const thermalSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/runtime/sph/schroederSolidFluidThermalGpu.js'), 'utf8');
  const contactSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/runtime/sph/schroederSolidFluidContactGpu.js'), 'utf8');
  for (const [name, src] of [['schroederSolidFluidThermalGpu.js', thermalSrc], ['schroederSolidFluidContactGpu.js', contactSrc]]) {
    assert.doesNotMatch(src, /GRID_BUCKETS\s*=\s*4096/, `${name} still defines private 4096-bucket hash`);
    assert.doesNotMatch(src, /fn hash_cell\(/, `${name} still contains private hash_cell`);
    assert.doesNotMatch(src, /var<storage, read_write> spatial_grid/, `${name} still binds private spatial_grid`);
    assert.match(src, /var<storage, read> fluid_directory: array<u32>/, `${name} must consume canonical SS fluid_directory`);
  }
  assert.equal(SCHROEDER_SOLID_FLUID_THERMAL_SPATIAL_AUTHORITY, LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH);
  assert.equal(SCHROEDER_SOLID_FLUID_CONTACT_SPATIAL_AUTHORITY, LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH);
  assert.match(schroederSolidFluidThermalWgsl, /ss_find_cell/);
  assert.match(schroederSolidFluidContactWgsl, /ss_find_cell/);
});

test('Gate 6 Phase C: unilateral solid-liquid slip law uses generated ABI accessors and passes Law Adapter Contract', () => {
  const check = validateLawAdapterDescriptor(SOLID_LIQUID_VELOCITY_SEPARATION_LAW_DESCRIPTOR, {
    requireExtendedMetadata: true
  });
  assert.equal(check.valid, true, check.errors.join(', '));
  assert.equal(check.debt.length, 0);
  assert.equal(ULG_SOLID_LIQUID_SLIP_SCHEMA, 'peercompute.ulg.solid-liquid-velocity-separation.v1');
  assert.match(sphSolidLiquidVelocitySeparationWgsl, /sl_state_mass_kg\(p\)/);
  assert.match(sphSolidLiquidVelocitySeparationWgsl, /sl_mech_solid_flag\(p\)/);
  assert.match(sphSolidLiquidVelocitySeparationWgsl, /sl_mech_eos_model_id\(p\)/);
  assert.doesNotMatch(sphSolidLiquidVelocitySeparationWgsl, /@workgroup_size\(\s*1\b/);
  // Verify live production wiring in sphMlsMpmGpuStep.js and pure-liquid zero-cost skip!
  const stepSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/runtime/sph/sphMlsMpmGpuStep.js'), 'utf8');
  assert.match(stepSrc, /runCachedSphSolidLiquidVelocitySeparationStep/);
  assert.equal(detectMixedSolidLiquidContinuumState(null).hasMixedSolidLiquid, false);
  assert.ok(resolveSolidLiquidSlipFixedScale(1e-4) >= 1e7);
});

test('Gate 6 Phase C: shipped Studio presets promote exact energy ledger (non-finite-wall presets) and dynamic hierarchy LOD to default-ON', () => {
  for (const id of ['water-cycle', 'iron-ice-quench']) {
    const p = sphPhaseScenarioPresetById(id);
    assert.ok(p, id);
    assert.equal(p.runtime.exactEnergyLedger, '1', `${id} must enable exactEnergyLedger by default`);
    assert.equal(p.runtime.dynamicHierarchyLod, '1', `${id} must enable dynamicHierarchyLod by default`);
  }
  for (const id of ['sodium-water', 'cesium-fluorine']) {
    const p = sphPhaseScenarioPresetById(id);
    assert.ok(p, id);
    assert.equal(p.runtime.dynamicHierarchyLod, '1', `${id} must enable dynamicHierarchyLod by default`);
    assert.equal(p.runtime.exactEnergyLedger, undefined, `${id} preserves finite-capacity-wall exactEnergyLedger contract`);
  }
  const rt = sphPhaseScenarioPresetById('water-realtime');
  assert.equal(rt.runtime.implicitPressure, '1');
  assert.equal(SPH_PHASE_SCENARIO_PRESETS.length, 5);
});
