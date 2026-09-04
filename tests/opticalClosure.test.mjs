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
  sphericalParticleOpticalEfficiencies,
  sphereGeometricRayAsymmetryFactor,
  spectralResponseToSrgb,
  waterDropletOpticalMicrophysics,
  waterVisibleSphereOpticalInputs,
  waterSaturationPressurePa
} from '../src/runtime/material/opticalClosure.js';
import { deriveElementProperties } from '../src/runtime/material/elementClosures.js';
import {
  conductorOpticalConstantsRecord,
  interpolateConductorOpticalConstants,
  normalIncidenceReflectanceFromComplexIndex
} from '../src/runtime/material/conductorOpticalConstants.js';
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

test('checked-in conductor complex-index rows interpolate measured n and k', () => {
  const copper = conductorOpticalConstantsRecord('Cu');
  assert.ok(copper);
  const exact = interpolateConductorOpticalConstants(copper, 2.75);
  assert.ok(Math.abs(exact.n - 1.24) < 1e-12);
  assert.ok(Math.abs(exact.k - 2.397) < 1e-12);
  const midpoint = interpolateConductorOpticalConstants(copper, (2.63 + 2.75) / 2);
  assert.ok(Math.abs(midpoint.n - (1.25 + 1.24) / 2) < 1e-12);
  assert.ok(Math.abs(midpoint.k - (2.483 + 2.397) / 2) < 1e-12);
  const reflectance = normalIncidenceReflectanceFromComplexIndex(exact);
  const expected = (((exact.n - 1) ** 2) + exact.k ** 2)
    / (((exact.n + 1) ** 2) + exact.k ** 2);
  assert.ok(Math.abs(reflectance - expected) < 1e-12);
});

test('reference anchoring makes silver, copper, and gold optically distinct while strict derivation stays pure', async () => {
  const { deriveMaterialProperties } = await import('../src/runtime/material/materialDerivation.js');
  const { anchorDerivedMaterialProperties } = await import('../src/runtime/material/referenceBankAnchoring.js');
  const colors = {};
  for (const material of ['Cu', 'Ag', 'Au']) {
    const derived = deriveMaterialProperties(material, {
      elementOptions: { allowReducedEstimates: true, gridPointsN: 80 }
    });
    assert.equal(derived.conductorOpticalConstants, undefined, `${material} strict derivation must not carry a reference anchor`);
    const anchored = anchorDerivedMaterialProperties(derived, material);
    assert.equal(anchored.anchored, true);
    assert.equal(anchored.properties.conductorOpticalConstants.symbol, material);
    assert.equal(anchored.properties.conductorOpticalConstants.doi, '10.1103/PhysRevB.6.4370');
    assert.deepEqual(
      anchored.properties.referenceBankAnchoring.derivationResiduals.conductorOpticalConstants.derivedIntrinsicColorSrgb,
      derived.intrinsicColorSrgb
    );
    const render = opticalRenderParams({
      material,
      phase: 'solid',
      pathLengthM: 0.3,
      properties: anchored.properties
    });
    assert.equal(render.renderModel, 'conductor-reference-complex-index');
    assert.equal(render.provenance.status, 'reference-fallback');
    assert.equal(render.provenance.source, 'johnson-christy-1972-complex-index');
    assert.equal(render.provenance.inputs.phaseApplication, 'within-reference-phase');
    assert.ok(render.opacity > 0.999);
    assert.ok(render.spectralSamples.every((sample) => sample.n > 0 && sample.k > 0));
    assert.deepEqual(render.baseColorSrgb, anchored.properties.intrinsicColorSrgb);
    colors[material] = render.baseColorSrgb;
  }
  const [cuR, cuG, cuB] = colors.Cu;
  const [agR, agG, agB] = colors.Ag;
  const [auR, auG, auB] = colors.Au;
  assert.ok(cuR > cuG && cuG > cuB && cuG - cuB < 0.12, `copper should be rose metallic: ${colors.Cu}`);
  assert.ok(Math.max(agR, agG, agB) - Math.min(agR, agG, agB) < 0.06, `silver should be neutral: ${colors.Ag}`);
  assert.ok(auR > auG && auG > auB && auR - auB > 0.3, `gold should be yellow: ${colors.Au}`);
  const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
  assert.ok(distance(colors.Cu, colors.Au) > 0.1);
  assert.ok(distance(colors.Ag, colors.Au) > 0.3);
  assert.ok(distance(colors.Ag, colors.Cu) > 0.2);

  const moltenGold = opticalRenderParams({
    material: 'Au',
    phase: 'liquid',
    pathLengthM: 0.3,
    properties: anchorDerivedMaterialProperties(
      deriveMaterialProperties('Au', { elementOptions: { allowReducedEstimates: true, gridPointsN: 80 } }),
      'Au'
    ).properties
  });
  assert.equal(moltenGold.provenance.inputs.phaseApplication, 'nearest-reference-condensed-phase-extrapolation');
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

  const air = opticalRenderParams({
    material: 'air',
    phase: 'gas',
    pathLengthM: 10,
    properties: { phases: [{ name: 'gas', densityKgPerM3: 1.225 }] }
  });
  assert.equal(air.vertexColorPolicy, 'material-pbr');
  assert.equal(air.renderModel, 'gas-rayleigh-transparent-pbr');
  assert.equal(air.blocked, undefined);
  assert.ok(air.ior > 1 && air.ior < 1.001);
  assert.ok(air.transmission > 0.999);
  assert.ok(air.opacity > 0 && air.opacity < 0.001);
  assert.ok(air.baseColorSrgb.every((value) => value > 0.8));
  assert.ok(air.spectralSamples.some((sample) => sample.scatteringCoefficientPerM > 0));
  assert.ok(
    air.spectralSamples[0].scatteringCoefficientPerM
      > air.spectralSamples.at(-1).scatteringCoefficientPerM
  );
  assert.equal(air.provenance.source, 'dry-air-rayleigh-scattering-reference-composition');
});

test('sphere efficiencies cover analytic Rayleigh, exact absorbing Mie, and bounded large-size physics', () => {
  const wavelengthM = 550e-9;
  const radiusForSizeParameter = (sizeParameter) =>
    (sizeParameter * wavelengthM) / (2 * Math.PI);
  const relativeN = 1.5;
  const sizeParameter = 0.01;
  const rayleigh = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(sizeParameter),
    wavelengthM,
    relativeRefractiveIndexN: relativeN,
    relativeExtinctionCoefficientK: 0
  });
  const contrast = (relativeN ** 2 - 1) / (relativeN ** 2 + 2);
  const analyticQsca = (8 / 3) * sizeParameter ** 4 * contrast ** 2;
  assert.equal(rayleigh.regime, 'rayleigh-small-sphere');
  assert.ok(Math.abs(rayleigh.scatteringEfficiencyQsca - analyticQsca) < 1e-20);
  assert.equal(rayleigh.absorptionEfficiencyQabs, 0);

  const indexMatched = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(1),
    wavelengthM,
    relativeRefractiveIndexN: 1,
    relativeExtinctionCoefficientK: 0
  });
  assert.equal(indexMatched.regime, 'index-matched-no-scattering');
  assert.equal(indexMatched.scatteringEfficiencyQsca, 0);
  assert.equal(indexMatched.extinctionEfficiencyQext, 0);

  const nearPolarizabilityPole = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(0.1),
    wavelengthM,
    relativeRefractiveIndexN: 1e-6,
    relativeExtinctionCoefficientK: Math.sqrt(2)
  });
  assert.equal(nearPolarizabilityPole.regime, 'exact-lorenz-mie-series');
  assert.equal(nearPolarizabilityPole.valid, true);
  assert.ok(nearPolarizabilityPole.scatteringEfficiencyQsca < 10);
  assert.ok(nearPolarizabilityPole.absorptionEfficiencyQabs > 0);

  const largeInternalSizeParameter = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(0.1),
    wavelengthM,
    relativeRefractiveIndexN: 100,
    relativeExtinctionCoefficientK: 0.01
  });
  assert.equal(largeInternalSizeParameter.regime, 'exact-lorenz-mie-series');
  assert.equal(largeInternalSizeParameter.valid, true);
  assert.ok(largeInternalSizeParameter.scatteringEfficiencyQsca > 0);

  const absorbing = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(1),
    wavelengthM,
    relativeRefractiveIndexN: relativeN,
    relativeExtinctionCoefficientK: 0.1
  });
  assert.equal(absorbing.regime, 'exact-lorenz-mie-series');
  assert.equal(absorbing.valid, true);
  assert.ok(absorbing.scatteringEfficiencyQsca > 0);
  assert.ok(absorbing.absorptionEfficiencyQabs > 0);
  assert.ok(
    absorbing.extinctionEfficiencyQext
      >= absorbing.scatteringEfficiencyQsca
  );

  const waterInputs = waterVisibleSphereOpticalInputs();
  assert.equal(waterInputs.provenance.status, 'reference-fallback');
  assert.match(waterInputs.provenance.source, /hale-querry-1973/);
  assert.equal(waterInputs.relativeExtinctionCoefficientK, 0);
  const large = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(100),
    wavelengthM,
    ...waterInputs
  });
  assert.equal(
    large.regime,
    'geometric-optics-diffraction-lossless-large-sphere-asymptotic'
  );
  assert.equal(large.scatteringEfficiencyQsca, 2);
  assert.equal(large.absorptionEfficiencyQabs, 0);
  assert.ok(large.asymmetryFactorG > 0.85 && large.asymmetryFactorG < 0.91);
  assert.ok(Math.abs(
    sphereGeometricRayAsymmetryFactor({
      relativeRefractiveIndexN: waterInputs.relativeRefractiveIndexN
    }) - 0.7641552672
  ) < 1e-6);
  assert.ok(Math.abs(large.asymmetryFactorG - 0.8820526336) < 1e-6);

  const weakContrastLarge = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(100),
    wavelengthM,
    relativeRefractiveIndexN: 1.0001,
    relativeExtinctionCoefficientK: 0
  });
  assert.equal(weakContrastLarge.valid, false);
  assert.match(weakContrastLarge.regime, /blocked.*large-sphere/);
  assert.equal(weakContrastLarge.extinctionEfficiencyQext, 0);

  const nearMatchedAtExactEdge = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(32),
    wavelengthM,
    relativeRefractiveIndexN: 1.000001,
    relativeExtinctionCoefficientK: 0
  });
  const nearMatchedBeyondExactEdge = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(32.000001),
    wavelengthM,
    relativeRefractiveIndexN: 1.000001,
    relativeExtinctionCoefficientK: 0
  });
  assert.equal(nearMatchedAtExactEdge.valid, true);
  assert.ok(nearMatchedAtExactEdge.scatteringEfficiencyQsca < 1e-7);
  assert.equal(nearMatchedBeyondExactEdge.valid, false);
  assert.equal(nearMatchedBeyondExactEdge.scatteringEfficiencyQsca, 0);

  const transitionGapWater = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(48),
    wavelengthM,
    ...waterInputs
  });
  assert.equal(transitionGapWater.valid, false);
  assert.match(transitionGapWater.regime, /blocked.*large-sphere/);

  const admittedAsymptoticWater = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(80),
    wavelengthM,
    ...waterInputs
  });
  assert.equal(admittedAsymptoticWater.valid, true);
  assert.equal(
    admittedAsymptoticWater.regime,
    'geometric-optics-diffraction-lossless-large-sphere-asymptotic'
  );

  const exactTinyInternalSize = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(1),
    wavelengthM,
    relativeRefractiveIndexN: 1e-10,
    relativeExtinctionCoefficientK: 0
  });
  assert.equal(exactTinyInternalSize.valid, false);
  assert.match(exactTinyInternalSize.regime, /internal-size-parameter/);
  assert.equal(exactTinyInternalSize.extinctionEfficiencyQext, 0);
  const exactInternalSizeFloor = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(1),
    wavelengthM,
    relativeRefractiveIndexN: 1e-5,
    relativeExtinctionCoefficientK: 0
  });
  assert.equal(exactInternalSizeFloor.valid, false);
  assert.match(exactInternalSizeFloor.regime, /internal-size-parameter/);

  const exactTermCap = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(1),
    wavelengthM,
    relativeRefractiveIndexN: 200,
    relativeExtinctionCoefficientK: 0
  });
  assert.equal(exactTermCap.valid, false);
  assert.equal(exactTermCap.regime, 'blocked-exact-mie-term-cap');
  assert.equal(exactTermCap.extinctionEfficiencyQext, 0);

  const unsupportedAbsorbingLarge = sphericalParticleOpticalEfficiencies({
    radiusM: radiusForSizeParameter(100),
    wavelengthM,
    relativeRefractiveIndexN: relativeN,
    relativeExtinctionCoefficientK: 0.01
  });
  assert.equal(unsupportedAbsorbingLarge.valid, false);
  assert.match(unsupportedAbsorbingLarge.regime, /blocked-absorbing-large/);
  assert.equal(unsupportedAbsorbingLarge.extinctionEfficiencyQext, 0);
});

test('conserved condensed water derives visible droplet scattering without changing pure vapor', () => {
  clearOpticalRenderParamsCache();
  const temperatureK = 293.15;
  const saturationPressurePa = waterSaturationPressurePa(temperatureK);
  assert.ok(saturationPressurePa > 2000 && saturationPressurePa < 3000);

  const supersaturationOnly = waterDropletOpticalMicrophysics({
    temperatureK,
    h2oPartialPressurePa: 1.2 * saturationPressurePa,
    dropletRadiusM: 1e-6,
    pathLengthM: 1
  });
  assert.equal(
    supersaturationOnly.status,
    'condensate-optics-blocked-missing-conserved-mass'
  );
  assert.equal(supersaturationOnly.scatteringCoefficientPerM, 0);
  assert.equal(supersaturationOnly.condensedMassAuthority, null);

  const pureVapor = opticalRenderParams({
    material: 'h2o',
    phase: 'gas',
    pathLengthM: 1,
    opticalState: {
      temperatureK,
      h2oPartialPressurePa: 0.5 * saturationPressurePa,
      conservedCondensedMassDensityKgPerM3: 0,
      dropletRadiusM: 1e-6
    }
  });
  const condensedSteam = opticalRenderParams({
    material: 'h2o',
    phase: 'gas',
    pathLengthM: 1,
    opticalState: {
      temperatureK,
      h2oPartialPressurePa: 1.2 * saturationPressurePa,
      conservedCondensedMassDensityKgPerM3: 0.001,
      dropletRadiusM: 1e-6
    }
  });
  const microphysics = waterDropletOpticalMicrophysics({
    temperatureK,
    h2oPartialPressurePa: 1.2 * saturationPressurePa,
    conservedCondensedMassDensityKgPerM3: 0.001,
    dropletRadiusM: 1e-6,
    pathLengthM: 1
  });

  assert.equal(pureVapor.renderModel, 'molecular-vapor-transparent-spectrum');
  assert.equal(pureVapor.condensationScatter, 0);
  assert.ok(pureVapor.transmission > 0.95);
  assert.equal(condensedSteam.renderModel, 'molecular-condensed-droplet-scattering-pbr');
  assert.ok(condensedSteam.condensationScatter > 0);
  assert.ok(condensedSteam.opacity > pureVapor.opacity);
  assert.ok(condensedSteam.transmission < pureVapor.transmission);
  assert.equal(pureVapor.dropletMicrophysics.status, 'subsaturated-pure-vapor');
  assert.equal(condensedSteam.dropletMicrophysics.status, 'conserved-condensed-droplets');
  assert.ok(Math.abs(condensedSteam.dropletMicrophysics.condensedMassFraction - microphysics.condensedMassFraction) < 1e-12);
  assert.ok(condensedSteam.spectralSamples.some((sample) => sample.scatteringCoefficientPerM > 0));
  assert.equal(condensedSteam.provenance.source, 'conserved-condensate-monodisperse-lorenz-mie-scattering');
  const largerDroplets = opticalRenderParams({
    material: 'h2o',
    phase: 'gas',
    pathLengthM: 1,
    opticalState: {
      temperatureK,
      h2oPartialPressurePa: 1.2 * saturationPressurePa,
      conservedCondensedMassDensityKgPerM3: 0.001,
      dropletRadiusM: 2e-6
    }
  });
  assert.notEqual(largerDroplets.condensationScatter, condensedSteam.condensationScatter);

  condensedSteam.baseColorSrgb[0] = 0;
  const reread = opticalRenderParams({
    material: 'h2o',
    phase: 'gas',
    pathLengthM: 1,
    opticalState: {
      temperatureK,
      h2oPartialPressurePa: 1.2 * saturationPressurePa,
      conservedCondensedMassDensityKgPerM3: 0.001,
      dropletRadiusM: 1e-6
    }
  });
  assert.ok(reread.baseColorSrgb[0] > 0.9);
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

test('gaseous fluorine is subtly yellow from its measured absorption band; H2 stays optically thin', async () => {
  const { deriveMaterialProperties } = await import('../src/runtime/material/materialDerivation.js');
  const { anchorDerivedMaterialProperties } = await import('../src/runtime/material/referenceBankAnchoring.js');
  // Band centre anchored to the spectroscopic maximum (reference-fallback, CRC-anchor policy);
  // the pure delta-SCF path overshoots sigma* centres in the minimal basis.
  const pureF = deriveMaterialProperties('F');
  assert.equal(pureF.gasElectronicExcitationEv, null);
  const f = anchorDerivedMaterialProperties(pureF, 'F').properties;
  assert.ok(Math.abs(f.gasElectronicExcitationEv - 4.34) < 1e-9);
  const render = opticalRenderParams({ material: 'F', phase: 'gas', pathLengthM: 0.3, properties: f });
  assert.equal(render.renderModel, 'molecular-gas-reference-cross-section-pbr');
  assert.equal(render.provenance.source, 'measured-molecular-gas-absorption-cross-section');
  assert.equal(render.provenance.inputs.absorptionCrossSectionDoi, '10.1021/ja01586a007');
  // The measured visible tail is weak but clears the renderer's physical
  // contrast gate: blue is absorbed more strongly than red, producing F2's
  // subtle yellow response without an opacity multiplier.
  assert.ok(render.opticalDepth > 4e-3, `optical depth ${render.opticalDepth} should be visible`);
  const [r, g, b] = render.baseColorSrgb;
  assert.ok(
    r > 0.95 && r > g && g > b && r - b > 0.1,
    `F2 response should be subtly yellow, got ${render.baseColorSrgb}`
  );

  const h2 = anchorDerivedMaterialProperties(deriveMaterialProperties('h2'), 'h2').properties;
  // The banked H2 Lyman band sits deep in the vacuum UV, so H2 is correctly near-invisible.
  assert.ok(h2.gasElectronicExcitationEv > 6);
  const h2Render = opticalRenderParams({ material: 'h2', phase: 'gas', pathLengthM: 0.3, properties: h2 });
  assert.ok(h2Render.opticalDepth < 5e-3, `H2 optical depth ${h2Render.opticalDepth} should be thin`);
});
