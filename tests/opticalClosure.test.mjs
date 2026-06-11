import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearOpticalRenderParamsCache,
  createOpticalClosure,
  drudeAbsorptionCoefficientPerM,
  drudeReflectance,
  intrinsicColorSrgb,
  metalDrudeColorSrgb,
  metalRelativisticColorSrgb,
  opticalRenderParams,
  relativisticInterbandOscillators,
  spectralResponseToSrgb
} from '../src/runtime/material/opticalClosure.js';
import { deriveElementProperties } from '../src/runtime/material/elementClosures.js';
import { SPH_PHASE_CLOSURE_SCHEMAS } from '../ulg-gpu-abi/src/index.js';

const fastHeavyOptics = {
  gridPointsN: 420,
  rMaxBohr: 42,
  maxScf: 100,
  opticalInterbandOptions: { gridPointsN: 420, rMaxBohr: 42, maxScf: 100 }
};

test('a flat unit reflectance integrates to white; flat zero to black', () => {
  const white = spectralResponseToSrgb(() => 1);
  assert.ok(white.r > 0.95 && white.g > 0.95 && white.b > 0.95);
  const black = spectralResponseToSrgb(() => 0);
  assert.ok(black.r < 0.01 && black.g < 0.01 && black.b < 0.01);
});

test('Drude metal reflectance is high across the visible (iron is a bright, fairly flat metal)', () => {
  const r450 = drudeReflectance(450, { plasmaRadPerS: 1.5e16, dampingRadPerS: 6e15 });
  const r650 = drudeReflectance(650, { plasmaRadPerS: 1.5e16, dampingRadPerS: 6e15 });
  const a550 = drudeAbsorptionCoefficientPerM(550, { plasmaRadPerS: 1.5e16, dampingRadPerS: 6e15 });
  assert.ok(r450 > 0.4 && r650 > 0.4);
  assert.ok(a550 > 0, 'conductors must expose a positive skin-depth absorption coefficient');
  // Slightly higher reflectance toward the red -> a warm (reddish) grey, not bluish.
  assert.ok(r650 >= r450);
});

test('iron is a warm grey, water/ice are blue (red-absorbing), air is near-transparent', () => {
  const fe = deriveElementProperties(26);
  const iron = intrinsicColorSrgb({ material: 'fe', conductionElectronDensityPerM3: fe.conductionElectronDensityPerM3 });
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
  clearOpticalRenderParamsCache();
  const fe = deriveElementProperties(26, fastHeavyOptics);
  const iron = opticalRenderParams({ material: 'fe', properties: { conductionElectronDensityPerM3: fe.conductionElectronDensityPerM3 } });
  assert.equal(iron.metalness, 1);
  assert.ok(iron.transmission < 1e-6); // opaque from Drude skin depth
  assert.ok(iron.opacity > 0.999);
  assert.equal(iron.vertexColorPolicy, 'material-pbr');
  assert.equal(iron.renderModel, 'conductor-drude-lorentz-relativistic-interband');
  assert.ok(Array.isArray(iron.baseColorSrgb));
  assert.ok(iron.baseColorSrgb.every((v) => v >= 0 && v <= 1));
  assert.ok(iron.spectralSamples.length > 0);
  assert.ok(iron.spectralSamples.every((sample) => sample.wavelengthNm >= 380 && sample.wavelengthNm <= 780));
  assert.equal(iron.provenance.source, 'scalar-relativistic-kohn-sham-drude-lorentz-skin-depth');

  const water = opticalRenderParams({ material: 'h2o', phase: 'liquid' });
  assert.ok(Math.abs(water.ior - 1.333) < 1e-6); // refractive index sets IOR
  assert.ok(water.transmission > 0.8); // clear water mostly transmits
  assert.ok(water.opacity >= 0 && water.opacity < 0.2);
  assert.equal(water.vertexColorPolicy, 'material-pbr');
  assert.equal(water.renderModel, 'molecular-transparent-beer-lambert-pbr');
  assert.ok(Array.isArray(water.attenuationColor)); // Beer-Lambert tint
  // Blue tint: less attenuation in the blue than the red over the path.
  assert.ok(water.attenuationColor[2] >= water.attenuationColor[0]);
  assert.ok(water.attenuationDistanceM > 0);

  const steam = opticalRenderParams({ material: 'steam' });
  assert.ok(steam.ior < 1.01); // vapour barely refracts (n ~ 1)
  assert.ok(steam.transmission > water.transmission); // pure vapour is optically thinner than liquid
  assert.equal(steam.condensationScatter, 0);
});

test('gold opacity is derived from conductor skin depth, not a generic translucent fallback', () => {
  const au = deriveElementProperties(79, fastHeavyOptics);
  const render = opticalRenderParams({ material: 'Au', properties: { conductionElectronDensityPerM3: au.conductionElectronDensityPerM3, opticalInterbandOscillators: au.opticalInterbandOscillators } });
  assert.equal(render.metalness, 1);
  assert.ok(render.opacity > 0.999);
  assert.ok(render.transmission < 1e-6);
  assert.ok(render.baseColorSrgb[0] > render.baseColorSrgb[1] && render.baseColorSrgb[1] > render.baseColorSrgb[2]);
  assert.equal(render.vertexColorPolicy, 'material-pbr');
  assert.equal(render.provenance.source, 'scalar-relativistic-kohn-sham-drude-lorentz-skin-depth');
  const blocked = opticalRenderParams({ material: 'unknownium' });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.opacity, 0);
  assert.equal(blocked.vertexColorPolicy, 'blocked');
});

test('optical render params are cached but returned as caller-safe clones', () => {
  clearOpticalRenderParamsCache();
  const first = opticalRenderParams({ material: 'h2o', phase: 'liquid' });
  first.baseColorSrgb[0] = 0;
  first.spectralSamples[0].reflectance = 99;
  const second = opticalRenderParams({ material: 'h2o', phase: 'liquid' });
  assert.notEqual(second.spectralSamples[0].reflectance, 99);
  assert.ok(second.baseColorSrgb[0] > 0);
});

test('gold colour comes from scalar-relativistic interband oscillators, not a per-element colour patch', () => {
  const au = deriveElementProperties(79, fastHeavyOptics);
  assert.ok(au.opticalInterbandOscillators.length > 0);
  assert.ok(au.opticalInterbandOscillators.some((osc) => osc.from.endsWith('d') && osc.to.endsWith('p')));
  assert.ok(au.opticalInterbandOscillators.every((osc) => Math.abs(osc.toL - osc.fromL) === 1));

  const relativistic = metalRelativisticColorSrgb({
    atomicNumberZ: 79,
    conductionElectronDensityPerM3: au.conductionElectronDensityPerM3,
    interbandOptions: fastHeavyOptics.opticalInterbandOptions
  });
  const drude = metalDrudeColorSrgb(au.conductionElectronDensityPerM3);
  assert.ok(relativistic.r > relativistic.g && relativistic.g > relativistic.b, `Au should be gold-tinted: ${JSON.stringify(relativistic)}`);
  assert.ok(relativistic.b < drude.b - 0.05, `interband response should suppress Au blue reflectance: ${JSON.stringify({ relativistic, drude })}`);
  assert.ok(Math.abs(relativistic.r - au.opticalColorSrgb[0]) < 1e-9);
});

test('interband branch is localized-d/f driven and renderer can use precomputed closure oscillators', () => {
  const ga = deriveElementProperties(31, fastHeavyOptics);
  assert.deepEqual(ga.opticalInterbandOscillators, []);

  const au = deriveElementProperties(79, fastHeavyOptics);
  const oscillators = relativisticInterbandOscillators({
    atomicNumberZ: 79,
    conductionElectronDensityPerM3: au.conductionElectronDensityPerM3,
    options: fastHeavyOptics.opticalInterbandOptions
  });
  const render = opticalRenderParams({
    material: 'custom-mapped-metal',
    properties: {
      conductionElectronDensityPerM3: au.conductionElectronDensityPerM3,
      opticalInterbandOscillators: oscillators
    }
  });
  assert.equal(render.provenance.source, 'scalar-relativistic-kohn-sham-drude-lorentz-skin-depth');
  assert.equal(render.interbandOscillators.length, oscillators.length);
});
