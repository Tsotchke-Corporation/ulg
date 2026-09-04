import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  createReferenceAnchoredMaterialClosure
} from '../src/runtime/material/materialDerivation.js';
import {
  GPU_PHASE_IDS,
  stableOpticalStateId
} from '../src/runtime/material/opticalGpuBuffers.js';
import {
  COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA,
  COLLECTIVE_OPTICAL_ROUTE_DEFAULT_CLOSURE_MODEL,
  collectiveOpticalRouteDescriptor,
  collectiveOpticalRouteDescriptorsFromMaterialProperties,
  collectiveOpticalRouteId,
  collectiveOpticalRouteKey
} from '../src/runtime/sph/sphOpticalRouteIdentity.js';
import {
  findSphDispersedMediumOpticalClosureRow
} from '../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import {
  sphStaticTableInputsFromViewState,
  surfaceDescriptorsFromMaterials
} from '../src/runtime/sph/sphStaticTableInputs.js';

function volatileMaterial({ boilingPointK, densityKgPerM3, color }) {
  return {
    molarMassKgPerMol: 0.05,
    electronicGapEv: 5,
    intrinsicColorSrgb: color,
    phases: [
      {
        name: 'liquid',
        cpJPerKgK: 1_000,
        densityKgPerM3,
        temperatureRange: [0, boilingPointK],
        bulkModulusPa: 1e9,
        shearModulusPa: 0
      },
      {
        name: 'gas',
        cpJPerKgK: 800,
        densityKgPerM3: 1,
        temperatureRange: [boilingPointK, 10_000],
        bulkModulusPa: null,
        shearModulusPa: 0
      }
    ],
    transitions: [{
      from: 'liquid',
      to: 'gas',
      temperatureK: boilingPointK,
      latentHeatJPerKg: 1e6
    }]
  };
}

const volatileMaterials = Object.freeze({
  'volatile-a': volatileMaterial({
    boilingPointK: 350,
    densityKgPerM3: 900,
    color: [0.8, 0.9, 1]
  }),
  'volatile-b': volatileMaterial({
    boilingPointK: 410,
    densityKgPerM3: 1_100,
    color: [1, 0.85, 0.75]
  })
});

test('collective optical route identity is exact-f32, deterministic, and dynamic-state invariant', () => {
  const identity = {
    material: 'Volatile-A',
    condensedPhase: 'LIQUID',
    vaporPhase: 'vapor',
    closureModel: COLLECTIVE_OPTICAL_ROUTE_DEFAULT_CLOSURE_MODEL
  };
  const first = collectiveOpticalRouteDescriptor({
    ...identity,
    temperatureK: 250,
    dispersedMassKg: 1e-9,
    pressurePa: 2_000,
    renderDomainId: 1,
    scenarioId: 'first-preset',
    renderKey: 'first-display-name'
  });
  const second = collectiveOpticalRouteDescriptor({
    ...identity,
    temperatureK: 900,
    dispersedMassKg: 40,
    pressurePa: 2e7,
    renderDomainId: 99,
    scenarioId: 'unrelated-preset',
    renderKey: 'second-display-name'
  });

  assert.equal(first.schema, COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA);
  assert.equal(first.routeKey, second.routeKey);
  assert.equal(first.routeId, second.routeId);
  assert.equal(first.opticalStateId, first.routeId);
  assert.equal(stableOpticalStateId(first.opticalState), first.routeId);
  assert.equal(first.surfaceIdentityKey, first.routeKey);
  assert.equal(first.phase, 'liquid');
  assert.equal(first.phaseId, GPU_PHASE_IDS.liquid);
  assert.equal(first.vaporPhase, 'gas');
  assert.equal(first.vaporPhaseId, GPU_PHASE_IDS.gas);
  assert.equal(first.closureModelId,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
      .singleCompactCondensateCarrierLowerBound);
  assert.equal(first.closureModel,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
      .singleCompactCondensateCarrierLowerBound);
  assert.ok(Number.isInteger(first.routeId));
  assert.ok(first.routeId > 0);
  assert.equal(Math.fround(first.routeId), first.routeId);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.opticalState), true);
  assert.equal(
    collectiveOpticalRouteId(identity),
    collectiveOpticalRouteId({ ...identity, temperatureK: 1, massKg: Number.MAX_VALUE })
  );
  assert.equal(
    collectiveOpticalRouteKey(identity),
    collectiveOpticalRouteKey({ ...identity, material: 'volatile-a' })
  );
});

test('collective optical route identity changes with each static route dimension', () => {
  const base = {
    material: 'volatile-a',
    condensedPhase: 'liquid',
    vaporPhase: 'gas',
    closureModel: SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
      .singleCompactCondensateCarrierLowerBound
  };
  const routes = [
    base,
    { ...base, material: 'volatile-b' },
    { ...base, condensedPhase: 'solid' },
    {
      ...base,
      closureModel: SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .monodisperseRadius
    }
  ];
  const ids = routes.map(collectiveOpticalRouteId);
  assert.equal(new Set(ids).size, routes.length);
  assert.ok(ids.every((id) => id > 0 && Math.fround(id) === id));
});

test('collective route discovery is material-general, ordered, and collision-free', () => {
  const staticPhaseDescriptors = [
    { material: 'volatile-b', phase: 'liquid', renderKey: 'b-condensate' },
    { material: 'volatile-a', phase: 'gas', renderKey: 'a-cloud' }
  ];
  const routes = collectiveOpticalRouteDescriptorsFromMaterialProperties(
    {
      'volatile-b': volatileMaterials['volatile-b'],
      'volatile-a': volatileMaterials['volatile-a']
    },
    { staticPhaseDescriptors }
  );
  const repeated = collectiveOpticalRouteDescriptorsFromMaterialProperties(
    volatileMaterials,
    { staticPhaseDescriptors: [...staticPhaseDescriptors].reverse() }
  );

  assert.equal(routes.length, 2);
  assert.deepEqual(
    routes.map((route) => route.material),
    ['volatile-a', 'volatile-b']
  );
  assert.deepEqual(
    routes.map((route) => route.renderKey),
    ['a-cloud', 'b-condensate']
  );
  assert.deepEqual(
    routes.map((route) => route.routeKey),
    repeated.map((route) => route.routeKey)
  );
  assert.deepEqual(
    routes.map((route) => route.routeId),
    repeated.map((route) => route.routeId)
  );
  assert.equal(new Set(routes.map((route) => route.routeId)).size, routes.length);
  assert.equal(Object.isFrozen(routes), true);
  assert.ok(routes.every((route) => route.properties === volatileMaterials[route.material]));
});

test('collective route discovery canonicalizes vapor transition aliases before phase lookup', () => {
  const propertiesWithTransition = (transition) => ({
    ...volatileMaterials['volatile-a'],
    transitions: [transition]
  });
  const [gasRoute] = collectiveOpticalRouteDescriptorsFromMaterialProperties({
    'volatile-a': propertiesWithTransition({ from: 'liquid', to: 'gas' })
  });
  const [vaporRoute] = collectiveOpticalRouteDescriptorsFromMaterialProperties({
    'volatile-a': propertiesWithTransition({ from: 'liquid', to: 'vapor' })
  });
  const [reverseVaporRoute] = collectiveOpticalRouteDescriptorsFromMaterialProperties({
    'volatile-a': propertiesWithTransition({ from: 'vapor', to: 'liquid' })
  });

  assert.ok(gasRoute);
  assert.equal(vaporRoute.routeKey, gasRoute.routeKey);
  assert.equal(vaporRoute.routeId, gasRoute.routeId);
  assert.equal(reverseVaporRoute.routeKey, gasRoute.routeKey);
  assert.equal(reverseVaporRoute.vaporPhase, 'gas');
});

test('paired static descriptors can declare a collective route without a transition', () => {
  const materialWithoutTransition = {
    ...volatileMaterials['volatile-a'],
    transitions: []
  };
  const explicitDescriptor = {
    material: 'volatile-a',
    condensedPhase: 'liquid',
    vaporPhase: 'gas',
    renderKey: 'explicit-cloud'
  };
  const [route] = collectiveOpticalRouteDescriptorsFromMaterialProperties(
    { 'volatile-a': materialWithoutTransition },
    {
      staticPhaseDescriptors: [explicitDescriptor]
    }
  );
  assert.equal(route.material, 'volatile-a');
  assert.equal(route.renderKey, 'explicit-cloud');
  assert.equal(route.condensedPhaseId, GPU_PHASE_IDS.liquid);
  assert.equal(route.vaporPhaseId, GPU_PHASE_IDS.gas);

  const inputs = sphStaticTableInputsFromViewState({
    materialProperties: { 'volatile-a': materialWithoutTransition },
    materials: [explicitDescriptor],
    reactions: []
  });
  assert.equal(inputs.collectiveOpticalRouteDescriptors.length, 1);
  assert.equal(
    inputs.collectiveOpticalRouteDescriptors[0].routeKey,
    route.routeKey
  );
});

test('SPH static inputs expose collective route descriptors and their exact optical bindings', () => {
  const materials = [
    { material: 'volatile-a', phase: 'gas', renderKey: 'a-cloud' },
    { material: 'volatile-b', phase: 'liquid', renderKey: 'b-condensate' }
  ];
  const inputs = sphStaticTableInputsFromViewState({
    materialProperties: volatileMaterials,
    materials,
    reactions: []
  });

  assert.deepEqual(
    surfaceDescriptorsFromMaterials(materials).map((descriptor) => descriptor.renderKey),
    ['a-cloud', 'b-condensate']
  );
  assert.equal(inputs.collectiveOpticalRouteDescriptors.length, 2);
  assert.equal(inputs.collectiveOpticalGpuTable.recordCount, 2);
  assert.equal(inputs.dispersedMediumOpticalClosureTable.rowCount, 2);
  assert.equal(inputs.dispersedMediumOpticalClosureTable.readyRowCount, 0);
  assert.equal(inputs.dispersedMediumOpticalClosureTable.blockedRowCount, 2);
  const routeIds = new Set(
    inputs.collectiveOpticalRouteDescriptors.map((route) => route.opticalStateId)
  );
  const tableIds = new Set(
    inputs.collectiveOpticalGpuTable.recordMetadata.map((record) => record.opticalStateId)
  );
  assert.deepEqual(tableIds, routeIds);
  for (const record of inputs.collectiveOpticalGpuTable.recordMetadata) {
    assert.equal(record.phase, 'liquid');
    assert.equal(record.phaseId, GPU_PHASE_IDS.liquid);
    assert.equal(Math.fround(record.opticalStateId), record.opticalStateId);
  }
  assert.equal(inputs.opticalGpuTable.recordCount, 2);
  assert.equal(inputs.thermalMaterialTable.materialCount, 2);
  assert.equal(inputs.reactionTable.reactionCount, 0);
});

test('live reference-anchored H2O readies one shared route while missing generic optics stay blocked', () => {
  const h2o = createReferenceAnchoredMaterialClosure('h2o').properties;
  const inputs = sphStaticTableInputsFromViewState({
    materialProperties: {
      h2o,
      'volatile-without-optics': volatileMaterial({
        boilingPointK: 390,
        densityKgPerM3: 850,
        color: [0.7, 0.8, 0.9]
      })
    },
    materials: [
      { material: 'h2o', phase: 'gas', renderKey: 'water-cloud' },
      {
        material: 'volatile-without-optics',
        phase: 'gas',
        renderKey: 'unresolved-cloud'
      }
    ],
    reactions: []
  });
  const h2oRoute = inputs.collectiveOpticalRouteDescriptors.find(
    (route) => route.material === 'h2o'
  );
  const missingRoute = inputs.collectiveOpticalRouteDescriptors.find(
    (route) => route.material === 'volatile-without-optics'
  );
  const h2oClosure = findSphDispersedMediumOpticalClosureRow(
    inputs.dispersedMediumOpticalClosureTable,
    h2oRoute
  );
  const missingClosure = findSphDispersedMediumOpticalClosureRow(
    inputs.dispersedMediumOpticalClosureTable,
    missingRoute
  );

  assert.equal(
    h2o.dispersedMediumOpticalClosure.schema,
    ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA
  );
  assert.equal(h2o.dispersedMediumOpticalClosure.condensedDensityKgPerM3, 1_000);
  assert.equal(h2o.dispersedMediumOpticalClosure.scatteringEfficiencyQsca, 2);
  assert.equal(h2o.dispersedMediumOpticalClosure.absorptionEfficiencyQabs, 0);
  assert.equal(h2o.dispersedMediumOpticalClosure.asymmetryFactorG, 0);
  assert.equal(h2o.dispersedMediumOpticalClosure.effectiveRadiusM, undefined);
  assert.equal(h2o.dispersedMediumOpticalClosure.scientificValidation, false);
  assert.equal(
    h2o.dispersedMediumOpticalClosure.provenance.status,
    'reduced-estimate'
  );
  assert.equal(h2oClosure.status, SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready);
  assert.equal(h2oClosure.opticalStateId, h2oRoute.opticalStateId);
  assert.equal(h2oClosure.condensedDensityKgPerM3, 1_000);
  assert.equal(
    h2o.dispersedMediumOpticalClosure.condensedDensityKgPerM3,
    h2o.phases.find((phase) => phase.name === 'liquid').densityKgPerM3
  );
  assert.equal(h2oClosure.scatteringEfficiencyQsca, 2);
  assert.equal(h2oClosure.absorptionEfficiencyQabs, 0);
  assert.equal(h2oClosure.asymmetryFactorG, 0);
  assert.equal(h2oClosure.effectiveRadiusM, 0);
  assert.equal(
    missingClosure.status,
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked
  );
  assert.equal(inputs.dispersedMediumOpticalClosureTable.readyRowCount, 1);
  assert.equal(inputs.dispersedMediumOpticalClosureTable.blockedRowCount, 1);

  const opticalIds = new Set(
    inputs.collectiveOpticalGpuTable.recordMetadata.map(
      (record) => record.opticalStateId
    )
  );
  const closureIds = new Set(
    inputs.dispersedMediumOpticalClosureTable.metadata.map(
      (record) => record.opticalStateId
    )
  );
  assert.deepEqual(opticalIds, new Set([
    h2oRoute.opticalStateId,
    missingRoute.opticalStateId
  ]));
  assert.deepEqual(closureIds, opticalIds);
});

test('typed monodisperse material closure selects the shared route model end to end', () => {
  const effectiveRadiusM = 2.5e-6;
  const properties = {
    ...volatileMaterial({
      boilingPointK: 365,
      densityKgPerM3: 875,
      color: [0.65, 0.75, 0.9]
    }),
    dispersedMediumOpticalClosure: {
      schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
      morphologyModel:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
          .monodisperseRadius,
      condensedDensityKgPerM3: 875,
      scatteringEfficiencyQsca: 1.6,
      absorptionEfficiencyQabs: 0.15,
      asymmetryFactorG: 0.55,
      effectiveRadiusM,
      scientificValidation: false
    }
  };
  const inputs = sphStaticTableInputsFromViewState({
    materialProperties: { 'volatile-monodisperse': properties },
    materials: [{
      material: 'volatile-monodisperse',
      phase: 'gas',
      renderKey: 'monodisperse-cloud'
    }],
    reactions: []
  });

  assert.equal(inputs.collectiveOpticalRouteDescriptors.length, 1);
  const [route] = inputs.collectiveOpticalRouteDescriptors;
  assert.equal(
    route.closureModel,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS.monodisperseRadius
  );
  assert.equal(
    route.closureModelId,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
  );
  const closure = findSphDispersedMediumOpticalClosureRow(
    inputs.dispersedMediumOpticalClosureTable,
    route
  );
  assert.equal(closure.status, SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready);
  assert.equal(
    closure.morphologyModelId,
    SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
  );
  assert.equal(closure.effectiveRadiusM, Math.fround(effectiveRadiusM));
  assert.equal(inputs.dispersedMediumOpticalClosureTable.readyRowCount, 1);
  assert.equal(inputs.dispersedMediumOpticalClosureTable.blockedRowCount, 0);
  assert.equal(
    inputs.collectiveOpticalGpuTable.recordMetadata[0].opticalStateId,
    route.opticalStateId
  );
  assert.equal(
    inputs.dispersedMediumOpticalClosureTable.metadata[0].opticalStateId,
    route.opticalStateId
  );
});

test('collective route descriptors fail closed for unsupported phase or morphology keys', () => {
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      material: 'volatile-a',
      condensedPhase: 'gas',
      vaporPhase: 'gas'
    }),
    /condensedPhase/
  );
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      material: 'volatile-a',
      condensedPhase: 'liquid',
      vaporPhase: 'gas',
      closureModel:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS.blocked
    }),
    /not a ready morphology model/
  );
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      material: 'volatile-a',
      condensedPhase: 'liquid',
      condensedPhaseId: GPU_PHASE_IDS.solid,
      vaporPhase: 'gas'
    }),
    /condensedPhaseId contradicts/
  );
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      material: 'volatile-a',
      condensedPhase: 'liquid',
      vaporPhase: 'gas',
      closureModel:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
          .singleCompactCondensateCarrierLowerBound,
      closureModelId:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius
    }),
    /identify different morphology models/
  );
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      material: 'volatile-a',
      condensedPhase: 'liquid',
      vaporPhase: 'gas',
      closureModelId: SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.blocked
    }),
    /not a ready morphology model/
  );
  const canonical = collectiveOpticalRouteDescriptor({
    material: 'volatile-a',
    condensedPhase: 'liquid',
    vaporPhase: 'gas'
  });
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      ...canonical,
      routeId: canonical.routeId + 1
    }),
    /routeId contradicts/
  );
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      ...canonical,
      routeKey: `${canonical.routeKey}|forged`
    }),
    /routeKey contradicts/
  );
  assert.throws(
    () => collectiveOpticalRouteDescriptor({
      ...canonical,
      opticalState: {
        ...canonical.opticalState,
        forged: 1
      }
    }),
    /opticalState contradicts/
  );
});
