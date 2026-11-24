import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSphInitialBodies } from '../src/runtime/sphInitialBodies.js';
import { buildSphPhaseDemoState } from '../src/runtime/sphPhaseDemo.js';
import {
  SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA
} from '../src/runtime/sph/schroederSolidDeformableShapeGpu.js';
import {
  SCHROEDER_SOLID_BODIES_SCHEMA
} from '../src/runtime/sph/schroederSolidRigidLane.js';
import { schroederSolidRigidWgsl } from '../src/runtime/sph/schroederSolidRigidGpu.js';
import fs from 'node:fs';

test('SOL-4 deformable mechanicsMode validates cleanly and builds clone-safe surface carrier in sphPhaseDemo', async () => {
  const normalized = normalizeSphInitialBodies([
    {
      id: 'water-base',
      domainId: 1,
      material: 'h2o',
      sizeM: [0.4, 0.2, 0.4],
      centerM: [0.25, 0.12, 0.25],
      temperatureK: 293.15,
      particlesPerEdge: [4, 2, 4],
      velocityMPerS: [0, 0, 0],
      mechanicsMode: 'continuum'
    },
    {
      id: 'deformable-iron',
      domainId: 2,
      material: 'fe',
      sizeM: [0.18, 0.18, 0.18],
      centerM: [0.25, 0.35, 0.25],
      temperatureK: 300,
      particlesPerEdge: [3, 3, 3],
      velocityMPerS: [0, -0.5, 0],
      mechanicsMode: 'deformable'
    }
  ]);
  assert.equal(normalized.bodies[1].mechanicsMode, 'deformable');

  const demo = await buildSphPhaseDemoState({
    boxDimensionsM: [0.5, 0.5, 0.5],
    initialBodies: normalized.bodies,
    environment: null,
    reactionsRequested: false
  });
  const def = demo.state.deformableSolidSurfaces;
  assert.equal(def?.schema, SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA);
  assert.equal(def.surfaces.length, 1);
  assert.equal(def.surfaces[0].bodyId, 'deformable-iron');
  assert.equal(def.surfaces[0].material, 'fe');
  assert.equal(def.surfaces[0].particleRowOffset, 32); // after 4*2*4 water particles
  assert.equal(def.surfaces[0].mesh.particleCount, 27);
  assert.ok(def.surfaces[0].mesh.triangleCount > 0);
  // Clone-safe for worker postMessage.
  const cloned = structuredClone(def);
  assert.equal(cloned.surfaces[0].mesh.triangleCount, def.surfaces[0].mesh.triangleCount);
});

test('SOL-5/SOL-6 rigid body declaration carries physical sizeM and fracture strengths for live lane', async () => {
  const demo = await buildSphPhaseDemoState({
    boxDimensionsM: [0.6, 0.6, 0.6],
    initialBodies: [
      {
        id: 'ice-cube',
        domainId: 1,
        material: 'h2o',
        sizeM: [0.16, 0.16, 0.16],
        centerM: [0.3, 0.3, 0.3],
        temperatureK: 260,
        particlesPerEdge: [4, 4, 4],
        velocityMPerS: [0, 0, 0],
        mechanicsMode: 'rigid'
      }
    ],
    environment: null,
    reactionsRequested: false
  });
  const rb = demo.state.rigidBodies;
  assert.equal(rb?.schema, SCHROEDER_SOLID_BODIES_SCHEMA);
  assert.equal(rb.bodies.length, 1);
  assert.deepEqual(rb.bodies[0].sizeM, [0.16, 0.16, 0.16]);
  assert.ok(rb.bodies[0].fracture?.tensileStrengthPa > 0);
  assert.ok(rb.bodies[0].fracture?.shearStrengthPa > 0);
  const cloned = structuredClone(rb);
  assert.deepEqual(cloned.bodies[0].sizeM, [0.16, 0.16, 0.16]);
});

test('Gate 3 B2: unified SS solid wiring passes raw generation on mechanics-only route, retires private solid hash, and never silently skips fine SS levels', () => {
  // 1. Mechanics-only route must pass schroederSpatialEpochGeneration directly (unwrapped).
  const stepSrc = fs.readFileSync(new URL('../src/runtime/sph/sphMlsMpmGpuStep.js', import.meta.url), 'utf8');
  assert.equal(
    stepSrc.includes('{ spatialEpochGeneration: schroederSpatialEpochGeneration }'),
    false,
    'mechanics-only solidRigidReleaseFluidBuffers call must not wrap schroederSpatialEpochGeneration in an object'
  );
  const directCallMatches = stepSrc.match(/solidRigidReleaseFluidBuffers\(\s*sphParticleState,\s*sphParticleUpload,\s*g2pReconstruction,\s*schroederSpatialEpochGeneration\s*\)/g) || [];
  assert.ok(directCallMatches.length >= 2, `Expected both main and mechanics-only routes to pass schroederSpatialEpochGeneration directly, found ${directCallMatches.length}`);

  // 2. Multi-body rigid broadphase must use exact body bounding spheres, zero private proxy spatial hash.
  const rigidWgsl = schroederSolidRigidWgsl();
  assert.equal(rigidWgsl.includes('proxy_hash_cell'), false, 'rigid WGSL must not define private proxy_hash_cell');
  assert.equal(rigidWgsl.includes('clear_proxy_grid'), false, 'rigid WGSL must not define private clear_proxy_grid');
  assert.equal(rigidWgsl.includes('bin_proxies'), false, 'rigid WGSL must not define private bin_proxies');
  assert.equal(rigidWgsl.includes('fn clear_body_bounds'), true, 'rigid WGSL must compute exact body_bounds');
  assert.equal(rigidWgsl.includes('fn measure_body_bounds'), true, 'rigid WGSL must measure per-body bounding spheres');

  // 3. Solid-fluid SS contact and thermal must never silently skip fine levels and must flag halo overflow.
  const contactWgsl = fs.readFileSync(new URL('../src/runtime/sph/schroederSolidFluidContactGpu.js', import.meta.url), 'utf8');
  const thermalWgsl = fs.readFileSync(new URL('../src/runtime/sph/schroederSolidFluidThermalGpu.js', import.meta.url), 'utf8');
  assert.equal(contactWgsl.includes('halo_needed > 6i && level < max_level'), false, 'solid-fluid contact must not silently skip fine SS levels');
  assert.equal(thermalWgsl.includes('halo_needed > 6i && level < max_level'), false, 'solid-fluid thermal must not silently skip fine SS levels');
  assert.equal(contactWgsl.includes('if (halo_needed > 8i) { error |= 2u; }'), true, 'solid-fluid contact must flag SS halo overflow explicitly');
  assert.equal(thermalWgsl.includes('if (halo_needed > 8i) { atomicOr(&coupling_ledger[2], 4); }'), true, 'solid-fluid thermal must flag SS halo overflow explicitly');
});
