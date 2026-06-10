import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createOpticalClosure,
  drudeReflectance,
  intrinsicColorSrgb,
  opticalRenderParams,
  spectralResponseToSrgb
} from '../src/runtime/material/opticalClosure.js';
import { SPH_PHASE_CLOSURE_SCHEMAS } from '../ulg-gpu-abi/src/index.js';

test('a flat unit reflectance integrates to white; flat zero to black', () => {
  const white = spectralResponseToSrgb(() => 1);
  assert.ok(white.r > 0.95 && white.g > 0.95 && white.b > 0.95);
  const black = spectralResponseToSrgb(() => 0);
  assert.ok(black.r < 0.01 && black.g < 0.01 && black.b < 0.01);
});

test('Drude metal reflectance is high across the visible (iron is a bright, fairly flat metal)', () => {
  const r450 = drudeReflectance(450, { plasmaRadPerS: 1.5e16, dampingRadPerS: 6e15 });
  const r650 = drudeReflectance(650, { plasmaRadPerS: 1.5e16, dampingRadPerS: 6e15 });
  assert.ok(r450 > 0.4 && r650 > 0.4);
  // Slightly higher reflectance toward the red -> a warm (reddish) grey, not bluish.
  assert.ok(r650 >= r450);
});

test('iron is a warm grey, water/ice are blue (red-absorbing), air is near-transparent', () => {
  const iron = intrinsicColorSrgb({ material: 'fe' });
  // Warm neutral: red >= green >= blue, none strongly saturated.
  assert.ok(iron.r >= iron.g && iron.g >= iron.b);
  assert.ok(iron.r - iron.b < 0.25);

  const water = intrinsicColorSrgb({ material: 'h2o', phase: 'liquid' });
  assert.ok(water.b > water.r, `water should be blue: ${JSON.stringify(water)}`);
  const ice = intrinsicColorSrgb({ material: 'h2o', phase: 'solid' });
  assert.ok(ice.b > ice.r, 'ice should be faintly blue');
  // Liquid water (longer path) is bluer/more saturated than ice.
  assert.ok((water.b - water.r) > (ice.b - ice.r));

  const air = intrinsicColorSrgb({ material: 'air', phase: 'gas' });
  assert.ok(air.r > 0.9 && air.g > 0.9 && air.b > 0.9, 'air near-white/transparent');
});

test('optical closure artifact is physically derived but not optically validated', () => {
  const closure = createOpticalClosure();
  assert.equal(closure.schema, SPH_PHASE_CLOSURE_SCHEMAS.optical);
  assert.equal(closure.closureBacked, true);
  assert.equal(closure.validation.opticalValidation, false);
  assert.equal(closure.validation.scientificValidation, false);
});

test('render params are derived from the optics: iron opaque metal, water refracts, vapour barely', () => {
  const iron = opticalRenderParams({ material: 'fe' });
  assert.equal(iron.metalness, 1);
  assert.equal(iron.transmission, 0); // opaque metal

  const water = opticalRenderParams({ material: 'h2o', phase: 'liquid' });
  assert.ok(Math.abs(water.ior - 1.333) < 1e-6); // refractive index sets IOR
  assert.ok(water.transmission > 0.9); // clear water mostly transmits
  assert.ok(Array.isArray(water.attenuationColor)); // Beer-Lambert tint
  // Blue tint: less attenuation in the blue than the red over the path.
  assert.ok(water.attenuationColor[2] >= water.attenuationColor[0]);
  assert.ok(water.attenuationDistanceM > 0);

  const steam = opticalRenderParams({ material: 'steam' });
  assert.ok(steam.ior < 1.01); // vapour barely refracts (n ~ 1)
  assert.ok(steam.transmission < water.transmission); // condensation scattering lowers it
});
