import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ABI,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS,
  SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL,
  SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
  ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  buildSphDispersedMediumOpticalClosureTable,
  deriveSphDispersedMediumOpticalMoments,
  findSphDispersedMediumOpticalClosureRow,
  validateSphDispersedMediumOpticalClosureTable
} from '../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import {
  collectiveOpticalRouteDescriptor
} from '../src/runtime/sph/sphOpticalRouteIdentity.js';

const MODELS = SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL;

function monodisperseEntry(overrides = {}) {
  return {
    dispersedMaterialId: 1101,
    vaporPhaseId: 3,
    condensedPhaseId: 2,
    opticalStateId: 9101,
    morphologyModelId: MODELS.monodisperseRadius,
    condensedDensityKgPerM3: 925,
    scatteringEfficiencyQsca: 1.8,
    absorptionEfficiencyQabs: 0.12,
    asymmetryFactorG: 0.72,
    effectiveRadiusM: 2e-6,
    ...overrides
  };
}

function compactEntry(overrides = {}) {
  return {
    dispersedMaterialId: 1201,
    vaporPhaseId: 3,
    condensedPhaseId: 1,
    opticalStateId: 9201,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactCondensateCarrierLowerBound,
    condensedDensityKgPerM3: 1840,
    scatteringEfficiencyQsca: 1.25,
    absorptionEfficiencyQabs: 0.08,
    asymmetryFactorG: -0.35,
    ...overrides
  };
}

function complexIndexCompactEntry(overrides = {}) {
  return {
    dispersedMaterialId: 1251,
    vaporPhaseId: 3,
    condensedPhaseId: 2,
    opticalStateId: 9251,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactSphereComplexIndex,
    condensedDensityKgPerM3: 1000,
    relativeRefractiveIndexN: 1.3326,
    relativeExtinctionCoefficientK: 0,
    largeSizeRayAsymmetryFactorG: 0.764,
    referenceWavelengthM: 550e-9,
    ...overrides
  };
}

function approximatelyEqual(actual, expected, relativeTolerance = 2e-6) {
  const scale = Math.max(Math.abs(actual), Math.abs(expected), 1e-30);
  assert.ok(
    Math.abs(actual - expected) <= relativeTolerance * scale,
    `${actual} differs from ${expected} by more than ${relativeTolerance * 100}%`
  );
}

test('dispersed-medium optical closure ABI is one exact three-vec4 record', () => {
  assert.equal(
    ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA,
    'peercompute.ulg.sph-dispersed-medium-optical-closure-table.v0'
  );
  assert.equal(
    ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    'peercompute.ulg.sph-dispersed-medium-optical-closure-property.v0'
  );
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_VERSION, 1);
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS, 12);
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_BYTES, 48);
  assert.equal(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_FLOATS % 4, 0);
  assert.deepEqual(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES, {
    dispersedMaterialId: 0,
    vaporPhaseId: 1,
    condensedPhaseId: 2,
    opticalStateId: 3,
    morphologyModelId: 4,
    status: 5,
    condensedDensityKgPerM3: 6,
    scatteringEfficiencyQsca: 7,
    relativeRefractiveIndexN: 7,
    absorptionEfficiencyQabs: 8,
    relativeExtinctionCoefficientK: 8,
    asymmetryFactorG: 9,
    largeSizeRayAsymmetryFactorG: 9,
    effectiveRadiusM: 10,
    reserved0: 11,
    referenceWavelengthM: 11
  });
  assert.deepEqual(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LAYOUT, [
    'dispersedMaterialId:f32',
    'vaporPhaseId:f32',
    'condensedPhaseId:f32',
    'opticalStateId:f32',
    'morphologyModelId:f32',
    'status:f32',
    'condensedDensityKgPerM3:f32',
    'scatteringEfficiencyQsca:f32',
    'absorptionEfficiencyQabs:f32',
    'asymmetryFactorG:f32',
    'effectiveRadiusM:f32',
    'reserved0:f32'
  ]);
  assert.deepEqual(SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS, {
    ready: 1,
    blocked: 255
  });
  assert.deepEqual(MODELS, {
    blocked: 0,
    singleCompactCondensateCarrierLowerBound: 1,
    monodisperseRadius: 2,
    singleCompactSphereComplexIndex: 3
  });
  assert.equal(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ABI.rowLanes,
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES
  );
  assert.match(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ABI.massAuthority,
    /already-conserved.*never-saturation-inference/
  );
  assert.match(
    SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ABI.taggedLanePolicy,
    /morphology-3.*relative-complex-index.*reference-wavelength/
  );
});

test('typed nested material closure data is consumed without mining other properties', () => {
  const properties = {
    phases: [{ name: 'liquid', densityKgPerM3: 999999 }],
    particleRadiusM: 0.25,
    dispersedMediumOpticalClosure: {
      schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
      morphologyModel:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
          .singleCompactCondensateCarrierLowerBound,
      condensedDensityKgPerM3: 811,
      scatteringEfficiencyQsca: 1.6,
      absorptionEfficiencyQabs: 0.2,
      asymmetryFactorG: 0.5,
      provenance: {
        status: 'reduced-estimate',
        source: 'synthetic-geometric-optics',
        method: 'dimensionless-efficiencies-from-an-external-closure',
        blockers: ['not-yet-validated']
      },
      scientificValidation: false
    }
  };
  const route = collectiveOpticalRouteDescriptor({
    material: 'synthetic-material-1051',
    vaporPhase: 'gas',
    condensedPhase: 'liquid',
    closureModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactCondensateCarrierLowerBound,
    properties
  });
  const table = buildSphDispersedMediumOpticalClosureTable([route]);
  const row = findSphDispersedMediumOpticalClosureRow(table, route);
  assert.equal(row.status, SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.ready);
  approximatelyEqual(row.condensedDensityKgPerM3, 811);
  assert.equal(row.effectiveRadiusM, 0);
  assert.equal(table.metadata[0].routeKey, route.routeKey);
  assert.deepEqual(table.metadata[0].provenance, {
    status: 'reduced-estimate',
    source: 'synthetic-geometric-optics',
    method: 'dimensionless-efficiencies-from-an-external-closure',
    blockers: ['not-yet-validated']
  });
  assert.ok(Object.isFrozen(table.metadata[0].provenance));
  assert.ok(Object.isFrozen(table.metadata[0].provenance.blockers));
  assert.equal(table.scientificValidation, false);
  assert.equal(table.metadata[0].scientificValidation, false);

  const wrongSchema = buildSphDispersedMediumOpticalClosureTable([{
    ...route,
    properties: {
      ...route.properties,
      dispersedMediumOpticalClosure: {
        ...route.properties.dispersedMediumOpticalClosure,
        schema: 'wrong-schema'
      }
    }
  }]);
  assert.equal(wrongSchema.readyRowCount, 0);
  assert.equal(wrongSchema.blockedRowCount, 1);
  assert.match(wrongSchema.metadata[0].statusReason, /schema-mismatch/);
});

test('typed closure fields are authoritative and every duplicate alias must agree', () => {
  const typedClosure = {
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactCondensateCarrierLowerBound,
    condensedDensityKgPerM3: 811,
    scatteringEfficiencyQsca: 1.6,
    absorptionEfficiencyQabs: 0.2,
    asymmetryFactorG: 0.5,
    provenance: { status: 'reduced-estimate', source: 'synthetic' },
    scientificValidation: false
  };
  const route = collectiveOpticalRouteDescriptor({
    material: 'typed-authority-material',
    vaporPhase: 'gas',
    condensedPhase: 'liquid',
    closureModel: typedClosure.morphologyModel,
    properties: { dispersedMediumOpticalClosure: typedClosure }
  });
  assert.equal(
    buildSphDispersedMediumOpticalClosureTable([{
      ...route,
      condensedDensityKgPerM3: typedClosure.condensedDensityKgPerM3
    }]).readyRowCount,
    1
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([{
      ...route,
      condensedDensityKgPerM3: 999
    }]),
    /conflicts with the authoritative typed closure/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([{
      ...route,
      effectiveRadiusM: 1e-6
    }]),
    /must be declared by the typed closure/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([{
      ...route,
      morphologyModel:
        SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS.monodisperseRadius
    }]),
    /morphology aliases identify conflicting/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([{
      ...route,
      routeId: route.routeId + 1
    }]),
    /routeId contradicts/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([{
      ...route,
      routeKey: `${route.routeKey}|forged`
    }]),
    /routeKey contradicts/
  );
});

test('scientific authority and unsupported route status claims fail closed', () => {
  const baseClosure = {
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactCondensateCarrierLowerBound,
    condensedDensityKgPerM3: 1000,
    scatteringEfficiencyQsca: 2,
    absorptionEfficiencyQabs: 0,
    asymmetryFactorG: 0,
    provenance: { status: 'reduced-estimate', source: 'synthetic' },
    scientificValidation: false
  };
  const routeFor = (closure) => collectiveOpticalRouteDescriptor({
    material: 'authority-claim-material',
    vaporPhase: 'gas',
    condensedPhase: 'liquid',
    closureModel: closure.morphologyModel,
    properties: { dispersedMediumOpticalClosure: closure }
  });
  const validRoute = routeFor(baseClosure);
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([{
      ...validRoute,
      scientificValidation: true
    }]),
    /must be exactly false/
  );
  const validatedClosure = {
    ...baseClosure,
    provenance: {
      ...baseClosure.provenance,
      status: 'scientifically-validated'
    }
  };
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      routeFor(validatedClosure)
    ]),
    /status must be explicitly unvalidated/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([{
      ...compactEntry(),
      status: 'scientifically-validated'
    }]),
    /numeric closure status or canonical route status/
  );
});

test('two synthetic volatile materials use the same deterministic route-table code', () => {
  const materialA = monodisperseEntry();
  const materialB = compactEntry();
  const table = buildSphDispersedMediumOpticalClosureTable([
    materialB,
    materialA
  ]);

  assert.equal(table.schema, ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_TABLE_SCHEMA);
  assert.equal(table.rowCount, 2);
  assert.equal(table.readyRowCount, 2);
  assert.equal(table.blockedRowCount, 0);
  assert.equal(table.rows.length, 24);
  assert.equal(table.bufferByteLength, 96);
  assert.equal(validateSphDispersedMediumOpticalClosureTable(table), true);
  assert.deepEqual(table.metadata.map((row) => row.dispersedMaterialId), [1101, 1201]);

  const rowA = findSphDispersedMediumOpticalClosureRow(table, materialA);
  const rowB = findSphDispersedMediumOpticalClosureRow(table, materialB);
  assert.equal(rowA.morphologyModelId, MODELS.monodisperseRadius);
  assert.equal(
    rowB.morphologyModelId,
    MODELS.singleCompactCondensateCarrierLowerBound
  );
  assert.equal(rowA.opticalStateId, 9101);
  assert.equal(rowB.opticalStateId, 9201);
  assert.equal(
    findSphDispersedMediumOpticalClosureRow(table, {
      dispersedMaterialId: 1301,
      vaporPhaseId: 3,
      condensedPhaseId: 2
    }),
    null
  );

  for (const row of [rowA, rowB]) {
    const moments = deriveSphDispersedMediumOpticalMoments({
      closureRow: row,
      dispersedMassKg: 2.5e-6
    });
    assert.equal(moments.status, SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready);
    assert.equal(moments.dispersedMaterialId, row.dispersedMaterialId);
    assert.equal(moments.dispersedPhaseId, row.condensedPhaseId);
    assert.equal(moments.opticalStateId, row.opticalStateId);
    assert.ok(Number.isFinite(moments.scatteringCrossSectionM2));
    assert.ok(Number.isFinite(moments.absorptionCrossSectionM2));
    assert.ok(
      Math.abs(moments.scatteringAsymmetryCrossSectionM2)
        <= moments.scatteringCrossSectionM2
    );
  }
});

test('explicit monodisperse radius gives mass-linear and inverse-radius moments', () => {
  const table = buildSphDispersedMediumOpticalClosureTable([
    monodisperseEntry(),
    monodisperseEntry({
      dispersedMaterialId: 1102,
      opticalStateId: 9102,
      effectiveRadiusM: 1e-6
    })
  ]);
  const radius2 = findSphDispersedMediumOpticalClosureRow(
    table,
    monodisperseEntry()
  );
  const radius1 = findSphDispersedMediumOpticalClosureRow(table, {
    dispersedMaterialId: 1102,
    vaporPhaseId: 3,
    condensedPhaseId: 2
  });
  const baseline = deriveSphDispersedMediumOpticalMoments({
    closureRow: radius2,
    dispersedMassKg: 1e-6
  });
  const doubleMass = deriveSphDispersedMediumOpticalMoments({
    closureRow: radius2,
    dispersedMassKg: 2e-6
  });
  const halfRadius = deriveSphDispersedMediumOpticalMoments({
    closureRow: radius1,
    dispersedMassKg: 1e-6
  });

  approximatelyEqual(
    doubleMass.scatteringCrossSectionM2 / baseline.scatteringCrossSectionM2,
    2
  );
  approximatelyEqual(
    doubleMass.absorptionCrossSectionM2 / baseline.absorptionCrossSectionM2,
    2
  );
  approximatelyEqual(
    halfRadius.scatteringCrossSectionM2 / baseline.scatteringCrossSectionM2,
    2
  );
  approximatelyEqual(
    halfRadius.absorptionCrossSectionM2 / baseline.absorptionCrossSectionM2,
    2
  );
  approximatelyEqual(
    baseline.scatteringAsymmetryCrossSectionM2,
    baseline.scatteringCrossSectionM2 * radius2.asymmetryFactorG
  );
});

test('single compact condensate carrier follows cube-root radius and area scaling', () => {
  const [row] = [
    findSphDispersedMediumOpticalClosureRow(
      buildSphDispersedMediumOpticalClosureTable([compactEntry()]),
      compactEntry()
    )
  ];
  const mass1 = deriveSphDispersedMediumOpticalMoments({
    closureRow: row,
    dispersedMassKg: 1e-9
  });
  const mass8 = deriveSphDispersedMediumOpticalMoments({
    closureRow: row,
    dispersedMassKg: 8e-9
  });
  approximatelyEqual(mass8.effectiveRadiusM / mass1.effectiveRadiusM, 2);
  approximatelyEqual(
    mass8.scatteringCrossSectionM2 / mass1.scatteringCrossSectionM2,
    4
  );
  approximatelyEqual(
    mass8.absorptionCrossSectionM2 / mass1.absorptionCrossSectionM2,
    4
  );
  assert.ok(mass1.scatteringAsymmetryCrossSectionM2 < 0);
  assert.ok(
    Math.abs(mass1.scatteringAsymmetryCrossSectionM2)
      <= mass1.scatteringCrossSectionM2
  );
});

test('compact-carrier fallback explicitly exposes carrier-partition resolution dependence', () => {
  const entry = compactEntry();
  const row = findSphDispersedMediumOpticalClosureRow(
    buildSphDispersedMediumOpticalClosureTable([entry]),
    entry
  );
  const totalMassKg = 8e-9;
  const oneCarrier = deriveSphDispersedMediumOpticalMoments({
    closureRow: row,
    dispersedMassKg: totalMassKg
  });
  const oneOfEight = deriveSphDispersedMediumOpticalMoments({
    closureRow: row,
    dispersedMassKg: totalMassKg / 8
  });
  approximatelyEqual(
    (8 * oneOfEight.scatteringCrossSectionM2)
      / oneCarrier.scatteringCrossSectionM2,
    2
  );
});

test('compact complex-index sphere derives Rayleigh, exact Mie, and large-size moments from conserved mass', () => {
  const momentsAtSizeParameter = (sizeParameter, overrides = {}) => {
    const entry = complexIndexCompactEntry(overrides);
    const row = findSphDispersedMediumOpticalClosureRow(
      buildSphDispersedMediumOpticalClosureTable([entry]),
      entry
    );
    const radiusM = (sizeParameter * row.referenceWavelengthM)
      / (2 * Math.PI);
    const massKg = (4 * Math.PI / 3)
      * row.condensedDensityKgPerM3
      * radiusM ** 3;
    return deriveSphDispersedMediumOpticalMoments({
      closureRow: row,
      dispersedMassKg: massKg
    });
  };

  const rayleigh = momentsAtSizeParameter(0.01);
  assert.equal(rayleigh.status, SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready);
  const rayleighArea = Math.PI * rayleigh.effectiveRadiusM ** 2;
  const relativeN = complexIndexCompactEntry().relativeRefractiveIndexN;
  const contrast = (relativeN ** 2 - 1) / (relativeN ** 2 + 2);
  const expectedRayleighQsca = (8 / 3) * 0.01 ** 4 * contrast ** 2;
  approximatelyEqual(
    rayleigh.scatteringCrossSectionM2 / rayleighArea,
    expectedRayleighQsca,
    5e-4
  );
  assert.equal(rayleigh.absorptionCrossSectionM2, 0);

  const absorbing = momentsAtSizeParameter(1, {
    relativeExtinctionCoefficientK: 0.1
  });
  assert.equal(absorbing.status, SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready);
  assert.ok(absorbing.scatteringCrossSectionM2 > 0);
  assert.ok(absorbing.absorptionCrossSectionM2 > 0);

  const large = momentsAtSizeParameter(100);
  const largeArea = Math.PI * large.effectiveRadiusM ** 2;
  approximatelyEqual(large.scatteringCrossSectionM2 / largeArea, 2, 2e-5);
  const largeG = large.scatteringAsymmetryCrossSectionM2
    / large.scatteringCrossSectionM2;
  assert.ok(largeG > 0.85 && largeG < 0.91);

  const unsupportedAbsorbingLarge = momentsAtSizeParameter(100, {
    relativeExtinctionCoefficientK: 0.01
  });
  assert.equal(
    unsupportedAbsorbingLarge.status,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked
  );
  assert.equal(unsupportedAbsorbingLarge.scatteringCrossSectionM2, 0);
});

test('zero conserved dispersed mass stays a ready route with exactly zero moments', () => {
  const entry = monodisperseEntry();
  const row = findSphDispersedMediumOpticalClosureRow(
    buildSphDispersedMediumOpticalClosureTable([entry]),
    entry
  );
  const moments = deriveSphDispersedMediumOpticalMoments({
    closureRow: row,
    dispersedMassKg: 0
  });
  assert.equal(moments.status, SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready);
  assert.equal(moments.dispersedMassKg, 0);
  assert.equal(moments.scatteringCrossSectionM2, 0);
  assert.equal(moments.absorptionCrossSectionM2, 0);
  assert.equal(moments.scatteringAsymmetryCrossSectionM2, 0);
  assert.equal(moments.statusReason, 'zero-dispersed-mass');
});

test('missing or contradictory morphology becomes an explicit blocked route', () => {
  const table = buildSphDispersedMediumOpticalClosureTable([
    monodisperseEntry({
      dispersedMaterialId: 1401,
      opticalStateId: 9401,
      morphologyModelId: undefined,
      effectiveRadiusM: undefined
    }),
    monodisperseEntry({
      dispersedMaterialId: 1402,
      opticalStateId: 9402,
      effectiveRadiusM: undefined
    }),
    compactEntry({
      dispersedMaterialId: 1403,
      opticalStateId: 9403,
      effectiveRadiusM: 1e-6
    })
  ]);
  assert.equal(table.readyRowCount, 0);
  assert.equal(table.blockedRowCount, 3);
  for (const metadata of table.metadata) {
    const row = findSphDispersedMediumOpticalClosureRow(table, metadata);
    assert.equal(row.status, SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_STATUS.blocked);
    assert.equal(row.condensedDensityKgPerM3, 0);
    assert.equal(row.scatteringEfficiencyQsca, 0);
    assert.equal(row.absorptionEfficiencyQabs, 0);
    assert.equal(row.asymmetryFactorG, 0);
    assert.equal(row.effectiveRadiusM, 0);
    const moments = deriveSphDispersedMediumOpticalMoments({
      closureRow: row,
      dispersedMassKg: 1
    });
    assert.equal(moments.status, SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked);
    assert.equal(moments.dispersedMassKg, 0);
    assert.equal(moments.scatteringCrossSectionM2, 0);
  }
});

test('malformed identities, closure values, duplicates, and f32 overflow fail closed', () => {
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable({}),
    /entries array/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry({ dispersedMaterialId: 0x0100_0000 })
    ]),
    /exact f32 integer/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry({ vaporPhaseId: 2 })
    ]),
    /must be distinct/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry({ opticalStateId: 0 })
    ]),
    /positive exact f32 integer/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry({ scatteringEfficiencyQsca: Number.MAX_VALUE })
    ]),
    /finite f32/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry({ absorptionEfficiencyQabs: -0.1 })
    ]),
    /must be nonnegative/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry({ asymmetryFactorG: 1.001 })
    ]),
    /magnitude must not exceed one/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry(),
      monodisperseEntry({ opticalStateId: 9102 })
    ]),
    /duplicate.*route/
  );
  assert.throws(
    () => buildSphDispersedMediumOpticalClosureTable([
      monodisperseEntry(),
      compactEntry({ opticalStateId: 9101 })
    ]),
    /duplicate.*opticalStateId/
  );

  const ordinaryRow = findSphDispersedMediumOpticalClosureRow(
    buildSphDispersedMediumOpticalClosureTable([monodisperseEntry()]),
    monodisperseEntry()
  );
  assert.throws(
    () => deriveSphDispersedMediumOpticalMoments({
      closureRow: ordinaryRow,
      dispersedMassKg: Number.MAX_VALUE
    }),
    /finite f32/
  );

  const tiny = Math.fround(1.401298464324817e-45);
  const overflowEntry = monodisperseEntry({
    condensedDensityKgPerM3: tiny,
    effectiveRadiusM: tiny
  });
  const overflowRow = findSphDispersedMediumOpticalClosureRow(
    buildSphDispersedMediumOpticalClosureTable([overflowEntry]),
    overflowEntry
  );
  assert.throws(
    () => deriveSphDispersedMediumOpticalMoments({
      closureRow: overflowRow,
      dispersedMassKg: Math.fround(3.4028234663852886e38)
    }),
    /overflowed.*f32/
  );
});

test('validator catches post-build row corruption at the trust boundary', () => {
  const table = buildSphDispersedMediumOpticalClosureTable([
    monodisperseEntry()
  ]);
  const corrupted = {
    ...table,
    rows: table.rows.slice(),
    metadata: [...table.metadata],
    readyOpticalStateIds: [...table.readyOpticalStateIds]
  };
  corrupted.rows[SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_ROW_LANES.reserved0] = 1;
  assert.throws(
    () => validateSphDispersedMediumOpticalClosureTable(corrupted),
    /reserved lane must be zero/
  );
});

test('validator rejects forged table authority, provenance, lookup, and canonical route identity', () => {
  const closure = {
    schema: ULG_SPH_DISPERSED_MEDIUM_OPTICAL_CLOSURE_PROPERTY_SCHEMA,
    morphologyModel:
      SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL_LABELS
        .singleCompactCondensateCarrierLowerBound,
    condensedDensityKgPerM3: 1000,
    scatteringEfficiencyQsca: 2,
    absorptionEfficiencyQabs: 0,
    asymmetryFactorG: 0,
    provenance: { status: 'reduced-estimate', source: 'synthetic' },
    scientificValidation: false
  };
  const route = collectiveOpticalRouteDescriptor({
    material: 'validator-authority-material',
    vaporPhase: 'gas',
    condensedPhase: 'liquid',
    closureModel: closure.morphologyModel,
    properties: { dispersedMediumOpticalClosure: closure }
  });
  const table = buildSphDispersedMediumOpticalClosureTable([route]);
  for (const [field, value] of [
    ['status', 'scientifically-validated'],
    ['massAuthority', 'saturation-inference'],
    ['saturationMassInference', true],
    ['routeLookup', 'forged-lookup'],
    ['scientificValidation', true]
  ]) {
    assert.throws(
      () => validateSphDispersedMediumOpticalClosureTable({
        ...table,
        [field]: value
      }),
      /authority metadata is inconsistent/,
      field
    );
  }
  assert.throws(
    () => validateSphDispersedMediumOpticalClosureTable({
      ...table,
      metadata: [{
        ...table.metadata[0],
        provenance: {
          ...table.metadata[0].provenance,
          status: 'scientifically-validated'
        }
      }]
    }),
    /status must be explicitly unvalidated/
  );
  assert.throws(
    () => validateSphDispersedMediumOpticalClosureTable({
      ...table,
      metadata: [{
        ...table.metadata[0],
        routeKey: `${table.metadata[0].routeKey}|forged`
      }]
    }),
    /routeKey contradicts/
  );
});

test('closure implementation contains no material, steam, or preset branch', async () => {
  const source = await readFile(
    new URL('../src/runtime/sph/sphDispersedMediumOpticalClosure.js', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /\b(?:h2o|steam|scenario|preset)\b/i);
  assert.doesNotMatch(source, /\b(?:temperatureK|pressurePa|supersaturation)\b/);
});
