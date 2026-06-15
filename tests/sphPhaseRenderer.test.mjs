import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_PHASE_RENDER_MODE,
  SPH_PHASE_RENDER_ORDER,
  SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT,
  SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT,
  SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT,
  SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL,
  SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY,
  SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS,
  SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN,
  SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN,
  SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES,
  SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN,
  SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  createContinuousSurfaceBatches,
  cpuMarchingCubesRadiusFloorM,
  createOpticalGpuLookupForSurfaceBatches,
  createOpticalGpuTableForSurfaceBatches,
  createProductEventSurfaceBatches,
  buildSphResidentPressureInterfaceStateSummary,
  hideRenderFieldSurfaceAfterGrace,
  mergeSameMaterialPhaseSurfaceBatchesForRenderField,
  normalizeResidentSurfaceDrawOverlayMode,
  publishScenePressureInterfaceGasCellFieldImportSource,
  residentSurfaceBatchIdentitySignature,
  residentRenderFieldReadbackModeForSurfaceOverlay,
  resolveResidentSurfaceDrawOverlayPolicy,
  renderAlphaFromOpticalResponse,
  renderDepthWriteFromOpticalResponse,
  renderLayerFromOpticalResponse,
  renderOrderFromOpticalResponse,
  normalizeSurfaceRadiusForRenderField,
  residentSurfaceDrawOrder,
  residentSurfaceDrawPipelineKey,
  resolveRenderFieldSurfaceVisibility,
  resolveOpticalSurfaceVisibility,
  shouldRetainResidentSurfaceDrawOverlay,
  SPH_SURFACE_INACTIVE_GRACE_FRAMES,
  surfaceRadiusScaleForRenderBatch,
  surfaceRadiusMetersFromRenderFieldRadius,
  surfaceObjectRenderOrder,
  stableSurfaceRenderOrder
} from '../src/visualization/sphPhaseScene.js';
import { residentMotionDiagnostic } from '../src/visualization/sphPhaseDemoMount.js';
import { createMlsMpmGridSpec } from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
  ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';

test('SPH phase renderer batches particles into continuous material surfaces', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 10,
    positionsM: new Float32Array([
      4.5, 1.1, 5.0,
      4.7, 1.1, 5.1,
      5.0, 0.3, 5.0
    ]),
    colorsRgb: new Float32Array([
      0.7, 0.9, 1.0,
      0.6, 0.8, 1.0,
      1.0, 0.32, 0.14
    ]),
    materials: ['h2o', 'h2o', 'fe']
  });

  assert.equal(SPH_PHASE_RENDER_MODE, 'continuous-marching-cubes');
  assert.equal(batches.length, 2);

  const h2o = batches.find((batch) => batch.material === 'h2o');
  const fe = batches.find((batch) => batch.material === 'fe');
  assert.equal(h2o.count, 2);
  assert.equal(fe.count, 1);
  assert.deepEqual(h2o.colorsRgb.slice(0, 3), [0.699999988079071, 0.8999999761581421, 1]);
  assert.ok(h2o.surfaceRadiusM > 0);
  assert.ok(fe.surfaceRadiusM > 0);
  assert.ok(h2o.normalizedPositions.every((value) => value > 0 && value < 1));
  assert.ok(fe.normalizedPositions.every((value) => value > 0 && value < 1));
});

test('resident motion diagnostic treats batch-visible motion as a refresh trigger', () => {
  const residentStep = {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-step-execution.v0',
    dt: 0.0005,
    diagnostics: {
      compactGpuSummaryAvailable: true,
      maxDisplacementM: 0.0001,
      maxSpeedMPerS: 1.25,
      pressureInterfaceAppliedImpulseMagnitudeNSeconds: 0
    }
  };
  const residentSteps = {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    completedStepCount: 256,
    finalStep: residentStep
  };

  const diagnostic = residentMotionDiagnostic({
    residentStep,
    residentSteps,
    gridSpacingM: 0.26666666666666666
  });

  assert.equal(diagnostic.status, 'batch-motion-estimate-visible');
  assert.equal(diagnostic.batchMotionEstimateVisible, true);
  assert.equal(diagnostic.completedStepCount, 256);
  assert.equal(diagnostic.stepDtS, 0.0005);
  assert.ok(diagnostic.maxDisplacementM < diagnostic.visibleThresholdM);
  assert.ok(diagnostic.estimatedBatchDisplacementUpperBoundM > diagnostic.visibleThresholdM);
  assert.equal(diagnostic.scientificValidation, false);
  assert.equal(diagnostic.fullPhysicsValidation, false);
});

test('SPH phase renderer preserves material and phase descriptors for optical closures', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 10,
    positionsM: new Float32Array([
      4.5, 1.1, 5.0,
      4.7, 1.1, 5.1,
      5.0, 0.3, 5.0
    ]),
    colorsRgb: new Float32Array([
      0.7, 0.9, 1.0,
      0.6, 0.8, 1.0,
      1.0, 0.32, 0.14
    ]),
    materials: [
      { material: 'h2o', phase: 'solid', renderKey: 'ice' },
      { material: 'h2o', phase: 'gas', renderKey: 'steam' },
      { material: 'fe', phase: 'liquid', renderKey: 'fe' }
    ]
  });

  assert.equal(batches.length, 3);
  const ice = batches.find((batch) => batch.renderKey === 'ice');
  const steam = batches.find((batch) => batch.renderKey === 'steam');
  const iron = batches.find((batch) => batch.material === 'fe');
  assert.equal(ice.material, 'h2o');
  assert.equal(ice.phase, 'solid');
  assert.equal(steam.material, 'h2o');
  assert.equal(steam.phase, 'gas');
  assert.equal(iron.renderKey, 'fe');
  assert.equal(iron.phase, 'liquid');
  assert.ok(new Set(batches.map((batch) => batch.surfaceKey)).size === 3);
});

test('SPH phase renderer does not collapse arbitrary selected elements to the last material', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'Na', phase: 'solid', renderKey: 'Na' },
      { material: 'Na', phase: 'solid', renderKey: 'Na' },
      { material: 'Au', phase: 'liquid', renderKey: 'Au' },
      { material: 'Au', phase: 'liquid', renderKey: 'Au' }
    ]
  });

  const summary = Object.fromEntries(batches.map((batch) => [batch.material, batch.count]));
  assert.deepEqual(summary, { Na: 2, Au: 2 });
  assert.deepEqual(batches.map((batch) => batch.surfaceKey).sort(), ['Au|Au|liquid', 'Na|Na|solid']);
});

test('SPH phase renderer preserves same-material render domains as separate surfaces', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' }
    ]
  });

  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((batch) => [batch.surfaceKey, batch.renderDomainId, batch.count]).sort(),
    [
      ['h2o|h2o|liquid|domain:base', 1, 2],
      ['h2o|h2o|liquid|domain:drop', 2, 2]
    ]
  );
});

test('SPH resident render fields merge same-material domains into one visible material field', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 1.1, 2.4,
      2.6, 1.1, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 1, renderDomainKey: 'base' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o', renderDomainId: 2, renderDomainKey: 'drop' }
    ]
  });

  const [merged] = mergeSameMaterialPhaseSurfaceBatchesForRenderField(batches);

  assert.equal(merged.surfaceKey, 'h2o|h2o|liquid');
  assert.equal(merged.renderDomainId, 0);
  assert.equal(merged.renderDomainKey, null);
  assert.equal(merged.count, 4);
  assert.equal(merged.positionsM.length, 12);
  assert.equal(merged.normalizedPositions.length, 12);
  assert.deepEqual(
    merged.mergedRenderDomains.map((domain) => [domain.renderDomainId, domain.renderDomainKey, domain.count]),
    [
      [1, 'base', 2],
      [2, 'drop', 2]
    ]
  );
});

test('SPH phase renderer creates event-only product surfaces from reaction inventory', () => {
  const baseBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.2, 0.35, 1,
      0.2, 0.35, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' }
    ]
  });
  const eventBatches = createProductEventSurfaceBatches({
    baseBatches,
    reactionSummary: {
      productInventory: {
        records: [
          {
            material: 'h2',
            productTermIndex: 1,
            reactionIndex: 0,
            routing: 'gas',
            unplacedMassKg: 0.002,
            eventCount: 3,
            status: 'ready'
          },
          {
            material: 'h2o',
            productTermIndex: 2,
            reactionIndex: 0,
            routing: 'condensed',
            unplacedMassKg: 0.1,
            eventCount: 1,
            status: 'ready'
          }
        ]
      }
    },
    reactionTable: {
      productTermMetadata: [
        { productTermIndex: 1, material: 'h2', routing: 'gas', reactionIndex: 0 },
        { productTermIndex: 2, material: 'h2o', routing: 'condensed', reactionIndex: 0 }
      ]
    },
    materialProperties: {
      h2: {
        phases: [{ name: 'gas', densityKgPerM3: 0.09 }]
      },
      h2o: {
        phases: [{ name: 'liquid', densityKgPerM3: 997 }]
      }
    },
    smoothingLengthM: 0.2
  });

  assert.equal(eventBatches.length, 1);
  assert.equal(eventBatches[0].material, 'h2');
  assert.equal(eventBatches[0].phase, 'gas');
  assert.equal(eventBatches[0].source, 'reaction-product-event-buffer');
  assert.equal(eventBatches[0].count, 3);
  assert.equal(eventBatches[0].surfaceRadiusM, 0.2);
  assert.ok(eventBatches[0].colorsRgb.length === 9);
  assert.ok(!eventBatches.some((batch) => batch.material === 'h2o'));
});

test('SPH surface radius is independent of box size while the MLS-MPM grid grows', () => {
  const positionsM = new Float32Array([
    2.4, 0.4, 2.4,
    2.6, 0.4, 2.6,
    2.4, 0.6, 2.4,
    2.6, 0.6, 2.6
  ]);
  const colorsRgb = new Float32Array([
    0.9, 0.9, 0.9,
    0.9, 0.9, 0.9,
    0.9, 0.9, 0.9,
    0.9, 0.9, 0.9
  ]);
  const materials = Array.from({ length: 4 }, () => ({ material: 'h2o', phase: 'solid', renderKey: 'ice' }));
  const small = createContinuousSurfaceBatches({
    positionsM,
    colorsRgb,
    materials,
    boxDimsM: [5, 5, 5],
    smoothingLengthM: 0.32
  });
  const large = createContinuousSurfaceBatches({
    positionsM,
    colorsRgb,
    materials,
    boxDimsM: [10, 10, 10],
    smoothingLengthM: 0.32
  });

  assert.equal(small.length, 1);
  assert.equal(large.length, 1);
  assert.equal(large[0].surfaceRadiusM, small[0].surfaceRadiusM);

  const smallGrid = createMlsMpmGridSpec({ boxDimsM: [5, 5, 5], gridSpacingM: 0.32 });
  const largeGrid = createMlsMpmGridSpec({ boxDimsM: [10, 10, 10], gridSpacingM: 0.32 });
  assert.ok(largeGrid.gridDims.every((dim, index) => dim > smallGrid.gridDims[index]));
  assert.ok(largeGrid.gridNodeCount > smallGrid.gridNodeCount);
});

test('SPH renderer converts physical blob radius into padded render-field units', () => {
  const radiusM = 0.4266666667;
  const refEdgeM = 5;
  const fieldPadding = 0.22;
  const fieldSpan = 1 - 2 * fieldPadding;
  const radiusNorm = normalizeSurfaceRadiusForRenderField(radiusM, refEdgeM, fieldPadding);

  assert.ok(Math.abs(radiusNorm - ((radiusM / refEdgeM) * fieldSpan)) < 1e-12);
  assert.ok(Math.abs(surfaceRadiusMetersFromRenderFieldRadius(radiusNorm, refEdgeM, fieldPadding) - radiusM) < 1e-12);
  assert.ok(radiusNorm < radiusM / refEdgeM);
});

test('SPH renderer defaults to a bounded isosurface radius scale', () => {
  assert.equal(SPH_SURFACE_RADIUS_SCALE_DEFAULT, 0.15);
  assert.ok(SPH_SURFACE_RADIUS_SCALE_DEFAULT > 0);
  assert.ok(SPH_SURFACE_RADIUS_SCALE_DEFAULT <= 0.5);
  assert.equal(SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN, 0.2);
  assert.equal(SPH_SPARSE_SURFACE_RADIUS_SCALE_MAX_PARTICLES, 27);
  assert.equal(SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN, 64);
  assert.equal(SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN, 32);
  assert.equal(SPH_CPU_MARCHING_CUBES_RADIUS_FLOOR_CELLS, 0.5);
  assert.equal(surfaceRadiusScaleForRenderBatch({ count: 27 }, SPH_SURFACE_RADIUS_SCALE_DEFAULT), 0.2);
  assert.equal(surfaceRadiusScaleForRenderBatch({ count: 28 }, SPH_SURFACE_RADIUS_SCALE_DEFAULT), 0.15);
  assert.equal(surfaceRadiusScaleForRenderBatch({ count: 27 }, 0.3), 0.3);
  assert.ok(cpuMarchingCubesRadiusFloorM(5, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN) < 0.15);
  assert.ok(cpuMarchingCubesRadiusFloorM(5, SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN) < cpuMarchingCubesRadiusFloorM(5, SPH_CPU_MARCHING_CUBES_RESOLUTION_MIN));
});

test('SPH phase renderer derives a packed optical GPU table from surface batches', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.4, 2.8, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'solid', renderKey: 'ice' },
      { material: 'h2o', phase: 'gas', renderKey: 'steam' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const table = createOpticalGpuTableForSurfaceBatches(batches, {
    materialProperties: {
      Au: {
        conductionElectronDensityPerM3: 5.9e28,
        opticalInterbandOscillators: []
      }
    }
  });

  assert.equal(table.schema, 'peercompute.ulg.optical-gpu-table.v0');
  assert.equal(table.recordCount, 3);
  assert.ok(table.spectralSampleCount > 0);
  assert.deepEqual(
    table.recordMetadata.map((record) => `${record.material}|${record.phase}`).sort(),
    ['Au|solid', 'h2o|gas', 'h2o|solid']
  );
  assert.match(table.wgslStructs, /OpticalMaterialRecord/);
});

test('SPH phase renderer keeps clear vapor and droplet steam optical states separate', () => {
  const clearVaporState = {
    temperatureK: 450,
    h2oPartialPressurePa: 100,
    pressurePa: 101325
  };
  const supersaturatedState = {
    temperatureK: 300,
    h2oPartialPressurePa: 1e6,
    pressurePa: 1e6
  };
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.6, 2.6
    ]),
    colorsRgb: new Float32Array([
      1, 1, 1,
      0.7, 0.85, 1
    ]),
    materials: [
      { material: 'h2o', phase: 'gas', renderKey: 'steam', opticalState: clearVaporState },
      { material: 'h2o', phase: 'gas', renderKey: 'steam', opticalState: supersaturatedState }
    ]
  });
  const table = createOpticalGpuTableForSurfaceBatches(batches);
  const lookup = createOpticalGpuLookupForSurfaceBatches(table, batches);

  assert.equal(batches.length, 2);
  assert.ok(new Set(batches.map((batch) => batch.surfaceKey)).size === 2);
  assert.equal(table.recordCount, 2);
  assert.deepEqual(
    table.recordMetadata.map((record) => record.renderModel).sort(),
    ['molecular-condensed-droplet-scattering-pbr', 'molecular-vapor-transparent-spectrum']
  );
  const clearRecord = table.recordMetadata.find((record) => record.renderModel === 'molecular-vapor-transparent-spectrum');
  const dropletRecord = table.recordMetadata.find((record) => record.renderModel === 'molecular-condensed-droplet-scattering-pbr');
  const clearOffset = clearRecord.recordIndex * table.recordStrideFloats;
  const dropletOffset = dropletRecord.recordIndex * table.recordStrideFloats;
  assert.equal(table.records[clearOffset + 17], 0);
  assert.ok(table.records[clearOffset + 20] < 1e-3);
  assert.ok(table.records[dropletOffset + 17] > 0);
  assert.ok(table.records[dropletOffset + 20] > 0);
  assert.deepEqual(
    lookup.cpuReference.outputs.filter((_, index) => index % lookup.lookup.outputStrideFloats === 11),
    new Float32Array([0, 1])
  );
});

test('SPH phase renderer derives optical GPU lookup rows for active surface batches', () => {
  const batches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 2.8, 2.6
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const table = createOpticalGpuTableForSurfaceBatches(batches, {
    materialProperties: {
      Au: {
        conductionElectronDensityPerM3: 5.9e28,
        opticalInterbandOscillators: []
      }
    }
  });
  const lookup = createOpticalGpuLookupForSurfaceBatches(table, batches);

  assert.equal(lookup.lookup.schema, 'peercompute.ulg.optical-gpu-lookup.v0');
  assert.equal(lookup.lookup.queryCount, 2);
  assert.deepEqual(lookup.surfaceKeys, batches.map((batch) => batch.surfaceKey));
  assert.equal(lookup.cpuReference.outputs.length, lookup.lookup.queryCount * lookup.lookup.outputStrideFloats);
  assert.equal(lookup.cpuReference.outputs[11], 0);
  assert.equal(lookup.cpuReference.outputs[lookup.lookup.outputStrideFloats + 11], 1);
});

test('SPH renderer keeps condensed transmissive H2O geometrically visible', () => {
  const waterOptics = {
    material: 'h2o',
    phase: 'liquid',
    opacity: 0.0028,
    transmission: 0.977,
    metalness: 0
  };
  const vaporOptics = {
    material: 'h2o',
    phase: 'gas',
    opacity: 0.0028,
    transmission: 0.999,
    metalness: 0
  };

  assert.equal(renderAlphaFromOpticalResponse(waterOptics, waterOptics), 1);
  assert.equal(renderDepthWriteFromOpticalResponse(waterOptics, waterOptics), false);
  assert.equal(renderAlphaFromOpticalResponse(vaporOptics, vaporOptics), vaporOptics.opacity);
});

test('SPH renderer gates vapor geometry from derived optical depth and scattering', () => {
  const clearVapor = {
    material: 'h2o',
    phase: 'gas',
    opacity: 0.001,
    transmission: 0.999,
    opticalDepth: 0.001,
    scatteringCoefficientPerM: 0
  };
  const barelyRetainedVapor = {
    ...clearVapor,
    opacity: 0.006,
    opticalDepth: 0.006
  };
  const condensedSteam = {
    ...clearVapor,
    opacity: 0.2,
    opticalDepth: 0.2,
    scatteringCoefficientPerM: 0.01
  };
  const water = {
    material: 'h2o',
    phase: 'liquid',
    opacity: 0.001,
    transmission: 0.98,
    opticalDepth: 0.001,
    scatteringCoefficientPerM: 0
  };

  const hidden = resolveOpticalSurfaceVisibility({ optics: clearVapor, descriptorOrRow: clearVapor });
  const retained = resolveOpticalSurfaceVisibility({
    optics: barelyRetainedVapor,
    descriptorOrRow: barelyRetainedVapor,
    wasVisible: true
  });
  const shownByDepth = resolveOpticalSurfaceVisibility({
    optics: { ...clearVapor, opacity: 0.02, opticalDepth: 0.02 },
    descriptorOrRow: clearVapor
  });
  const shownByDroplets = resolveOpticalSurfaceVisibility({
    optics: condensedSteam,
    descriptorOrRow: condensedSteam
  });
  const liquid = resolveOpticalSurfaceVisibility({ optics: water, descriptorOrRow: water });

  assert.equal(hidden.visible, false);
  assert.equal(hidden.reason, 'derived-pure-vapor-optically-thin');
  assert.equal(hidden.retainPreviousSurface, false);
  assert.equal(retained.visible, true);
  assert.equal(retained.reason, 'derived-vapor-optical-depth-visible');
  assert.equal(shownByDepth.visible, true);
  assert.equal(shownByDepth.reason, 'derived-vapor-optical-depth-visible');
  assert.equal(shownByDroplets.visible, true);
  assert.equal(shownByDroplets.reason, 'derived-droplet-scattering-visible');
  assert.equal(liquid.visible, true);
  assert.equal(liquid.reason, 'non-vapor-surface');
});

test('SPH resident render fields use hysteresis around the isosurface threshold', () => {
  const coldStart = resolveRenderFieldSurfaceVisibility({
    maxDensity: 79,
    isolation: 80,
    wasVisible: false
  });
  const retained = resolveRenderFieldSurfaceVisibility({
    maxDensity: 75,
    isolation: 80,
    wasVisible: true
  });
  const hidden = resolveRenderFieldSurfaceVisibility({
    maxDensity: 73,
    isolation: 80,
    wasVisible: true
  });

  assert.equal(coldStart.visible, false);
  assert.equal(coldStart.retainPreviousSurface, false);
  assert.equal(coldStart.renderIsolation, 80);
  assert.equal(retained.visible, true);
  assert.equal(retained.retainPreviousSurface, false);
  assert.equal(retained.renderIsolation, retained.hideIsolation);
  assert.ok(retained.renderIsolation < 80);
  assert.equal(hidden.visible, false);
  assert.equal(hidden.retainPreviousSurface, true);
  assert.equal(hidden.renderIsolation, 80);
});

test('SPH resident render fields retain previous mesh during inactive grace frames', () => {
  const calls = { reset: 0, update: 0 };
  const surface = {
    inactiveFrameCount: 0,
    config: { isolation: 80 },
    mesh: {
      visible: true,
      isolation: 74,
      userData: {},
      reset() {
        calls.reset += 1;
      },
      update() {
        calls.update += 1;
      }
    }
  };

  for (let frame = 0; frame < SPH_SURFACE_INACTIVE_GRACE_FRAMES; frame += 1) {
    assert.equal(hideRenderFieldSurfaceAfterGrace(surface, 'resident-gpu-render-field'), false);
    assert.equal(surface.mesh.visible, true);
    assert.equal(calls.reset, 0);
    assert.equal(calls.update, 0);
    assert.equal(surface.mesh.userData.renderSource, 'resident-gpu-render-field');
    assert.equal(surface.mesh.userData.surfaceInactiveFrameCount, frame + 1);
  }
  assert.equal(hideRenderFieldSurfaceAfterGrace(surface, 'resident-gpu-render-field'), true);
  assert.equal(surface.mesh.visible, false);
  assert.equal(surface.mesh.isolation, 80);
  assert.equal(calls.reset, 1);
  assert.equal(calls.update, 1);
});

test('SPH resident render fields hide empty surfaces without stale grace retention', () => {
  const calls = { reset: 0, update: 0 };
  const surface = {
    inactiveFrameCount: 0,
    config: { isolation: 80 },
    mesh: {
      visible: true,
      isolation: 74,
      userData: {},
      reset() {
        calls.reset += 1;
      },
      update() {
        calls.update += 1;
      }
    }
  };

  assert.equal(
    hideRenderFieldSurfaceAfterGrace(surface, 'resident-gpu-render-field', { immediate: true }),
    true
  );
  assert.equal(surface.mesh.visible, false);
  assert.equal(surface.mesh.isolation, 80);
  assert.equal(surface.mesh.userData.surfaceInactiveFrameCount, 1);
  assert.equal(calls.reset, 1);
  assert.equal(calls.update, 1);
});

test('SPH renderer gives surfaces stable intra-layer render order', () => {
  const baseOrder = SPH_PHASE_RENDER_ORDER.transmissiveSurface;
  const waterOrder = stableSurfaceRenderOrder(baseOrder, 'h2o|h2o|liquid');
  const steamOrder = stableSurfaceRenderOrder(baseOrder, 'steam|h2o|gas');

  assert.equal(stableSurfaceRenderOrder(baseOrder, 'h2o|h2o|liquid'), waterOrder);
  assert.notEqual(waterOrder, steamOrder);
  assert.ok(waterOrder >= baseOrder);
  assert.ok(waterOrder < baseOrder + 0.01);
});

test('SPH renderer leaves transparent same-layer meshes depth-sortable', () => {
  const baseOrder = SPH_PHASE_RENDER_ORDER.transmissiveSurface;

  assert.equal(
    surfaceObjectRenderOrder(baseOrder, 'front-water', {
      renderLayer: 'transmissive-surface',
      depthWrite: false
    }),
    baseOrder
  );
  assert.equal(
    surfaceObjectRenderOrder(baseOrder, 'back-water', {
      renderLayer: 'transmissive-surface',
      depthWrite: false
    }),
    baseOrder
  );
  assert.notEqual(
    surfaceObjectRenderOrder(SPH_PHASE_RENDER_ORDER.opaqueSurface, 'iron-a', {
      renderLayer: 'opaque-surface',
      depthWrite: true
    }),
    surfaceObjectRenderOrder(SPH_PHASE_RENDER_ORDER.opaqueSurface, 'iron-b', {
      renderLayer: 'opaque-surface',
      depthWrite: true
    })
  );
});

test('SPH resident overlay draw order follows render policy metadata', () => {
  const order = residentSurfaceDrawOrder([
    { surfaceIndex: 0, renderOrder: 300, transparencyClassId: 3, depthWriteFlag: 0 },
    { surfaceIndex: 1, renderOrder: 100, transparencyClassId: 0, depthWriteFlag: 1 },
    { surfaceIndex: 2, renderOrder: 200, transparencyClassId: 2, depthWriteFlag: 0 }
  ], { indirectStrideBytes: 16 });

  assert.deepEqual(order.map((row) => row.surfaceIndex), [1, 2, 0]);
  assert.deepEqual(order.map((row) => row.indirectOffsetBytes), [16, 32, 0]);
  assert.deepEqual(order.map((row) => row.renderOrder), [100, 200, 300]);
  assert.equal(residentSurfaceDrawPipelineKey(order[0]), 'opaque-depth-write');
  assert.equal(residentSurfaceDrawPipelineKey(order[1]), 'transparent-depth-test');
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_DEPTH_FORMAT, 'depth24plus');
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_OIT_ACCUM_FORMAT, 'rgba16float');
  assert.equal(SPH_RESIDENT_SURFACE_DRAW_OIT_REVEAL_FORMAT, 'rgba8unorm');
});

test('SPH resident overlay policy chooses no-full-readback only when overlay is available', () => {
  assert.equal(normalizeResidentSurfaceDrawOverlayMode('1'), 'enabled');
  assert.equal(normalizeResidentSurfaceDrawOverlayMode('three'), 'disabled');
  assert.equal(normalizeResidentSurfaceDrawOverlayMode('wat'), 'auto');

  const availableContainer = {
    ownerDocument: {
      createElement: () => ({
        getContext: (name) => (name === 'webgpu' ? {} : null)
      })
    }
  };
  const unavailableContainer = {
    ownerDocument: {
      createElement: () => ({
        getContext: () => null
      })
    }
  };
  const navigatorRef = { gpu: { getPreferredCanvasFormat: () => 'rgba8unorm' } };

  const autoReady = resolveResidentSurfaceDrawOverlayPolicy({
    mode: 'auto',
    container: availableContainer,
    navigatorRef
  });
  assert.equal(autoReady.enabled, true);
  assert.equal(autoReady.status, 'surface-draw-overlay-auto-ready');
  assert.equal(residentRenderFieldReadbackModeForSurfaceOverlay(autoReady.enabled), 'no-full-readback');

  const autoUnavailable = resolveResidentSurfaceDrawOverlayPolicy({
    mode: 'auto',
    container: unavailableContainer,
    navigatorRef
  });
  assert.equal(autoUnavailable.enabled, false);
  assert.equal(autoUnavailable.status, 'surface-draw-overlay-auto-unavailable');
  assert.equal(residentRenderFieldReadbackModeForSurfaceOverlay(autoUnavailable.enabled), 'full-parity-readback');

  const disabled = resolveResidentSurfaceDrawOverlayPolicy({
    mode: '0',
    container: availableContainer,
    navigatorRef
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.status, 'surface-draw-overlay-disabled-by-policy');
});

test('SPH resident overlay retains the last draw buffers across same-surface refreshes', () => {
  const previousBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.4, 0.4, 2.4,
      2.6, 0.4, 2.6,
      2.5, 2.8, 2.5
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.7, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'fe', phase: 'liquid', renderKey: 'fe' }
    ]
  });
  const nextBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.42, 0.42, 2.4,
      2.62, 0.42, 2.6,
      2.5, 2.75, 2.5
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.7, 0.4
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'fe', phase: 'liquid', renderKey: 'fe' }
    ]
  });
  const changedMaterialBatches = createContinuousSurfaceBatches({
    boxEdgeM: 5,
    positionsM: new Float32Array([
      2.42, 0.42, 2.4,
      2.62, 0.42, 2.6,
      2.5, 2.75, 2.5
    ]),
    colorsRgb: new Float32Array([
      0.9, 0.9, 0.9,
      0.9, 0.9, 0.9,
      1.0, 0.8, 0.3
    ]),
    materials: [
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'h2o', phase: 'liquid', renderKey: 'h2o' },
      { material: 'Au', phase: 'solid', renderKey: 'Au' }
    ]
  });
  const previousSignature = residentSurfaceBatchIdentitySignature(previousBatches);
  const nextSignature = residentSurfaceBatchIdentitySignature(nextBatches);
  const changedSignature = residentSurfaceBatchIdentitySignature(changedMaterialBatches);

  assert.equal(SPH_RESIDENT_SURFACE_DRAW_TEMPORAL_SWAP_POLICY, 'retain-last-overlay-until-replacement-ready');
  assert.equal(previousSignature, nextSignature);
  assert.notEqual(previousSignature, changedSignature);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: previousSignature,
    nextSurfaceBatchSignature: nextSignature,
    hasResidentSurfaceDraw: true,
    hasResidentRenderBridge: true
  }), true);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: previousSignature,
    nextSurfaceBatchSignature: changedSignature,
    hasResidentSurfaceDraw: true,
    hasResidentRenderBridge: true
  }), false);
  assert.equal(shouldRetainResidentSurfaceDrawOverlay({
    previousSurfaceBatchSignature: previousSignature,
    nextSurfaceBatchSignature: nextSignature,
    hasResidentSurfaceDraw: false,
    hasResidentRenderBridge: true
  }), false);
});

test('SPH resident overlay shader samples closure-derived optical records', () => {
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /@binding\(2\).*optical_records/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /@binding\(3\).*spectral_samples/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn find_optical_material/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn spectral_wavelength_rgb/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn spectral_tint_from_samples/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /base_color_linear/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /transmissive_surface_alpha/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /fn fs_oit_main/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /struct OitFragmentOut/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /attenuation_linear/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /optical_depth/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /dielectric_f0/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OVERLAY_WGSL, /scattering_coefficient_per_m/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL, /accum_texture/);
  assert.match(SPH_RESIDENT_SURFACE_DRAW_OIT_COMPOSITE_WGSL, /reveal_texture/);
});

test('SPH renderer orders transparent surfaces and disables their depth writes', () => {
  const opaqueMetal = {
    material: 'fe',
    phase: 'solid',
    opacity: 1,
    transmission: 0,
    metalness: 1
  };
  const condensedWater = {
    material: 'h2o',
    phase: 'liquid',
    opacity: 0.0028,
    transmission: 0.977,
    metalness: 0
  };
  const vapor = {
    material: 'h2o',
    phase: 'gas',
    opacity: 0.04,
    transmission: 0.9,
    metalness: 0
  };
  const transparentSolid = {
    material: 'sio2',
    phase: 'solid',
    opacity: 0.02,
    transmission: 0.95,
    metalness: 0
  };
  const alphaSurface = {
    material: 'generic',
    phase: 'liquid',
    opacity: 0.5,
    transmission: 0,
    metalness: 0
  };

  assert.equal(renderDepthWriteFromOpticalResponse(opaqueMetal, opaqueMetal), true);
  assert.equal(renderLayerFromOpticalResponse(opaqueMetal, opaqueMetal), 'opaque-surface');
  assert.equal(renderOrderFromOpticalResponse(opaqueMetal, opaqueMetal), SPH_PHASE_RENDER_ORDER.opaqueSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(condensedWater, condensedWater), false);
  assert.equal(renderLayerFromOpticalResponse(condensedWater, condensedWater), 'transmissive-surface');
  assert.equal(renderOrderFromOpticalResponse(condensedWater, condensedWater), SPH_PHASE_RENDER_ORDER.transmissiveSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(vapor, vapor), false);
  assert.equal(renderLayerFromOpticalResponse(vapor, vapor), 'vapor-surface');
  assert.equal(renderOrderFromOpticalResponse(vapor, vapor), SPH_PHASE_RENDER_ORDER.vaporSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(transparentSolid, transparentSolid), false);
  assert.equal(renderLayerFromOpticalResponse(transparentSolid, transparentSolid), 'transmissive-surface');
  assert.equal(renderOrderFromOpticalResponse(transparentSolid, transparentSolid), SPH_PHASE_RENDER_ORDER.transmissiveSurface);

  assert.equal(renderDepthWriteFromOpticalResponse(alphaSurface, alphaSurface), false);
  assert.equal(renderLayerFromOpticalResponse(alphaSurface, alphaSurface), 'alpha-surface');
  assert.equal(renderOrderFromOpticalResponse(alphaSurface, alphaSurface), SPH_PHASE_RENDER_ORDER.alphaSurface);
});

test('SPH resident pressure interface state owns retained force rows outside render cadence', () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    surfaceCount: 1,
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 2,
    elementCount: 1,
    elements: [{
      status: 'interface-element-ready',
      surfaceIndex: 0,
      surfaceKey: 'h2o|h2o|liquid',
      material: 'h2o',
      phase: 'liquid',
      materialId: 1,
      phaseId: 2,
      axisId: 1,
      centroidM: [0.5, 0.5, 0.5],
      normalAreaVectorM2: [0, 2, 0],
      areaM2: 2
    }]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-gas-pressure-summary-ready',
    source: 'gpu-resident-product-mass',
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      pressureGaugePa: 10,
      gasCellField: {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
        status: 'gas-cell-pressure-field-ready',
        uniformPressurePa: 10
      }
    }
  };
  const forceRowsUpload = {
    status: 'webgpu-pressure-interface-force-rows-uploaded',
    bufferRetained: true,
    forceRowByteLength: 64,
    signature: 'solver-signature',
    pressureInterfaceGridForceAdmissionSchema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    pressureInterfaceGridForceAdmissionStatus: 'pressure-interface-grid-force-consumption-approved',
    pressureInterfaceGridForceAdmissionApproved: true,
    pressureInterfaceGridForceAdmissionDescriptorStatus: 'pressure-interface-worker-retained-hot-buffer-committed',
    pressureInterfaceGridForceAdmissionSourceHotBufferKey: 'ulg:test:pressure-interface-admitted-hot-buffer',
    pressureInterfaceForceRowsUploadQueueCompletionStatus: 'ordered-before-consumer-queue-completed',
    pressureInterfaceForceRowsUploadQueueCompletionMethod: 'queue.writeBuffer -> queue.onSubmittedWorkDone',
    pressureInterfaceForceRowsConsumerQueueCompletionStatus: 'queue-work-completed',
    pressureInterfaceForceRowsConsumerQueueCompletionMethod: 'queue.onSubmittedWorkDone',
    pressureInterfaceForceRowsUploadCleanupStatus: 'destroyed',
    pressureInterfaceForceRowsUploadDestroyStatus: 'destroyed',
    residentBufferLeaseLedgerStatus: 'active',
    residentBufferLeaseResourceCount: 1,
    residentBufferLeaseActiveLeaseCount: 1,
    residentBufferLeaseSummary: { status: 'active', activeLeaseCount: 1 }
  };

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField,
    gasPressureSummary,
    pressureInterfaceForceRowsUpload: forceRowsUpload,
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(state.schema, 'peercompute.ulg.sph-resident-pressure-interface-state.v0');
  assert.equal(state.status, 'resident-pressure-interface-force-rows-ready');
  assert.equal(state.pressureAuthority, 'resident-pressure-interface-state');
  assert.equal(state.source, 'resident-physics-loop-pressure-interface-refresh');
  assert.equal(state.sourceCadence, 'resident-step-completed');
  assert.equal(state.pressureInterfaceCouplingStatus, 'pressure-interface-coupling-ready-for-solver');
  assert.equal(state.pressureInterfaceForceSolverStatus, 'pressure-interface-force-solver-ready');
  assert.equal(state.pressureInterfaceSolverForceRowCount, 1);
  assert.equal(state.pressureInterfaceForceRowsBufferRetained, true);
  assert.equal(state.pressureInterfaceForceRowsBufferByteLength, 64);
  assert.equal(state.pressureInterfaceGridForceAdmissionSchema, 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0');
  assert.equal(state.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-approved');
  assert.equal(state.pressureInterfaceGridForceAdmissionApproved, true);
  assert.equal(state.pressureInterfaceGridForceAdmissionSourceHotBufferKey, 'ulg:test:pressure-interface-admitted-hot-buffer');
  assert.equal(state.pressureInterfaceForceRowsUploadQueueCompletionStatus, 'ordered-before-consumer-queue-completed');
  assert.equal(state.pressureInterfaceForceRowsUploadQueueCompletionMethod, 'queue.writeBuffer -> queue.onSubmittedWorkDone');
  assert.equal(state.pressureInterfaceForceRowsConsumerQueueCompletionStatus, 'queue-work-completed');
  assert.equal(state.pressureInterfaceForceRowsConsumerQueueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(state.pressureInterfaceForceRowsUploadCleanupStatus, 'destroyed');
  assert.equal(state.pressureInterfaceForceRowsUploadDestroyStatus, 'destroyed');
  assert.equal(state.pressureInterfaceForceRowsLeaseStatus, 'active');
  assert.equal(state.pressureInterfaceForceRowsLeaseActiveCount, 1);
  assert.equal(state.gpuAuthoritativeState, true);
});

test('SPH scene requests resident authority publication for admitted gas-cell field imports', () => {
  const gasCellField = {
    schema: 'peercompute.ulg.sph-sealed-gas-pressure-cell-field.v0',
    status: 'gas-cell-pressure-field-ready',
    localPressureGradientReady: true,
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer'],
    cellDims: [2, 1, 1],
    cells: [
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [0, 0, 0],
        centerM: [0.5, 1, 1],
        pressurePa: 120000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      },
      {
        status: 'local-gas-pressure-cell-ready',
        gridIndex: [1, 0, 0],
        centerM: [1.5, 1, 1],
        pressurePa: 180000,
        pressureGradientPaPerM: [0, 0, 0],
        volumeM3: 4
      }
    ]
  };
  const gasPressureSummary = {
    schema: 'peercompute.ulg.sph-resident-gas-pressure-summary.v0',
    status: 'gpu-resident-reaction-pressure-summary',
    source: 'gpu-resident-product-mass-gas-species-ledger',
    pressureFeedback: {
      schema: 'peercompute.ulg.sph-gas-pressure-feedback.v0',
      status: 'wall-pressure-ledger-ready',
      totalPressurePa: 150000,
      pressureGaugePa: 48675,
      gasCellField
    }
  };
  const pressureInterfaceGasCellFieldAdmission = {
    schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_ADMISSION_SCHEMA,
    status: 'pressure-interface-gas-cell-field-consumption-approved',
    gasCellFieldConsumptionApproved: true,
    sourceHotBufferKey: 'ulg:test:gas-cell-source-hot-buffer',
    retainedGasPressureBufferRefs: ['resident-gas-pressure-cells-buffer']
  };
  const calls = [];
  const residentAuthorityHost = {
    publishPressureInterfaceGasCellFieldImportSource(options) {
      calls.push(options);
      return {
        schema: 'peercompute.ulg.pressure-interface-gas-cell-field-import-hot-buffer-publication.v0',
        status: 'pressure-interface-gas-cell-field-import-published',
        committed: true,
        hotBufferKey: 'ulg:test:scene-gas-cell-import-hot-buffer',
        commitDeltaTaskId: 'ulg:test:scene-gas-cell-import-task',
        commitDeltaScope: 'ulg-pressure-interface-gas-cell-field-imports',
        pressureInterfaceGasCellFieldImport: {
          schema: ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA,
          status: 'pressure-interface-gas-cell-field-import-ready',
          sourceHotBufferKey: 'ulg:test:scene-gas-cell-import-hot-buffer',
          retainedGasPressureBufferRefs: options.retainedGasPressureBufferRefs,
          workerRetainedGasPressureBufferRefs: options.workerRetainedGasPressureBufferRefs,
          pressureInterfaceGasPressureCellRowCount: options.gasCellFieldSnapshot.cells.length,
          pressureInterfaceGasCellFieldAdmission: options.pressureInterfaceGasCellFieldAdmission,
          gasCellFieldSnapshot: options.gasCellFieldSnapshot
        }
      };
    }
  };

  const publication = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission,
    cacheKey: 'ulg:test:scene-gas-cell-import-cache',
    stateKey: 'ulg:test:scene-gas-cell-import-state',
    sourceTaskId: 'ulg:test:resident-gas-pressure-source',
    source: 'resident-physics-loop-pressure-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].stateKey, 'ulg:test:scene-gas-cell-import-state');
  assert.deepEqual(calls[0].retainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
  assert.equal(calls[0].gasCellFieldSnapshot, gasCellField);
  assert.equal(calls[0].pressureInterfaceGasCellFieldAdmission, pressureInterfaceGasCellFieldAdmission);
  assert.equal(publication.status, 'pressure-interface-gas-cell-field-import-published');
  assert.equal(publication.committed, true);
  assert.equal(publication.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(publication.pressureInterfaceGasCellFieldImportSchema, ULG_PRESSURE_INTERFACE_GAS_CELL_FIELD_IMPORT_SCHEMA);
  assert.equal(publication.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:scene-gas-cell-import-hot-buffer');
  assert.equal(publication.pressureInterfaceGasCellFieldAdmissionApproved, true);

  const blocked = publishScenePressureInterfaceGasCellFieldImportSource({
    residentAuthorityHost,
    gasPressureSummary,
    pressureInterfaceGasCellFieldAdmission: null
  });
  assert.equal(calls.length, 1);
  assert.equal(blocked.status, 'blocked-gas-cell-field-consumption-admission-required');
  assert.equal(blocked.pressureInterfaceGasCellFieldImportReady, false);

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField: {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      readySurfaceCount: 0,
      totalSurfaceAreaM2: 0,
      elementCount: 0,
      elements: []
    },
    gasPressureSummary,
    pressureInterfaceGasCellFieldImportPublication: publication
  });
  assert.equal(state.pressureInterfaceGasCellFieldImportReady, true);
  assert.equal(state.pressureInterfaceGasCellFieldImportSourceHotBufferKey, 'ulg:test:scene-gas-cell-import-hot-buffer');
  assert.deepEqual(state.pressureInterfaceGasCellFieldRetainedGasPressureBufferRefs, ['resident-gas-pressure-cells-buffer']);
});

test('SPH resident pressure interface state blocks force-row upload without grid admission', () => {
  const materialInterfaceField = {
    schema: 'peercompute.ulg.sph-material-interface-field.v0',
    status: 'material-interface-field-ready',
    readySurfaceCount: 1,
    totalSurfaceAreaM2: 1,
    elementCount: 1,
    elements: [{
      status: 'interface-element-ready',
      surfaceIndex: 0,
      surfaceKey: 'h2o|h2o|liquid',
      material: 'h2o',
      phase: 'liquid',
      materialId: 1,
      phaseId: 2,
      axisId: 1,
      centroidM: [0.5, 0.5, 0.5],
      normalAreaVectorM2: [0, 1, 0],
      areaM2: 1
    }]
  };
  const pressureInterfaceForceSolver = {
    schema: 'peercompute.ulg.sph-pressure-interface-force-solver.v0',
    status: 'pressure-interface-force-solver-ready',
    forceCouplingStatus: 'pressure-force-solver-ready-not-applied',
    forceApplicationStatus: 'solver-ready-not-applied',
    forceRowCount: 1,
    forceRowStrideFloats: 16,
    conservationStatus: 'pairwise-equal-opposite-force-conservative',
    conservationResidualMagnitudeN: 0
  };
  const forceRowsUpload = {
    status: 'blocked-pressure-interface-grid-force-admission-required',
    blocker: 'pressure-interface-force-solver-grid-application-not-approved',
    bufferRetained: false,
    forceRowByteLength: 0,
    candidateForceRowByteLength: 64,
    pressureInterfaceGridForceAdmissionSchema: 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0',
    pressureInterfaceGridForceAdmissionStatus: 'pressure-interface-grid-force-consumption-blocked',
    pressureInterfaceGridForceAdmissionApproved: false
  };

  const state = buildSphResidentPressureInterfaceStateSummary({
    materialInterfaceField,
    pressureInterfaceForceSolver,
    pressureInterfaceForceRowsUpload: forceRowsUpload
  });

  assert.equal(state.status, 'resident-pressure-interface-force-rows-admission-required');
  assert.equal(state.pressureInterfaceForceRowsUploadStatus, 'blocked-pressure-interface-grid-force-admission-required');
  assert.equal(state.pressureInterfaceForceRowsUploadBlocker, 'pressure-interface-force-solver-grid-application-not-approved');
  assert.equal(state.pressureInterfaceForceRowsBufferRetained, false);
  assert.equal(state.pressureInterfaceForceRowsBufferByteLength, 0);
  assert.equal(state.pressureInterfaceForceRowsCandidateByteLength, 64);
  assert.equal(state.pressureInterfaceGridForceAdmissionSchema, 'peercompute.ulg.pressure-interface-grid-force-consumption-admission.v0');
  assert.equal(state.pressureInterfaceGridForceAdmissionStatus, 'pressure-interface-grid-force-consumption-blocked');
  assert.equal(state.pressureInterfaceGridForceAdmissionApproved, false);
  assert.equal(state.gpuAuthoritativeState, false);
});
