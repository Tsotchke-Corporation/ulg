import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
  SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL,
  SCHROEDER_DYADIC_SCALE_SPAN_LEVELS,
  SCHROEDER_DYADIC_SCALE_TARGET_OOM,
  SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS,
  SCHROEDER_SCALE_CHART_RECORD_WORDS,
  SCHROEDER_SCALE_CHART_NO_PARENT,
  ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA,
  splitFloat64ToDoubleFloat,
  combineDoubleFloatToFloat64,
  dyadicScaleSpacingM,
  dyadicLevelSpanOrdersOfMagnitude,
  createSchroederScaleChartDescriptor,
  createSchroederScaleAtlasPlan,
  packSchroederScaleAtlasChartTable,
  rebasePositionChildToParent,
  rebasePositionParentToChild,
  rebaseAggregateMomentChildToParent,
  buildSchroederMechanicsChainLevelSpecs,
  schroederScaleAtlasChartRebaseWgsl
} from '../ulg-gpu-abi/src/index.js';
import {
  schroederSpatialChainCorrectionAccumulateAdmissionWgsl,
  schroederSpatialChainForceWgsl,
  schroederSpatialChainProlongWgsl
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsCorrectionWgsl.js';
import {
  schroederSpatialCompositeMechanicsWgsl
} from '../ulg-gpu-abi/src/schroederSpatialCompositeMechanicsWgsl.js';
import {
  schroederSpatialNativePublicationWgsl
} from '../ulg-gpu-abi/src/schroederSpatialNativePublicationWgsl.js';
import {
  createSchroederSpatialCompositeMechanicsGpu
} from '../src/runtime/sph/schroederSpatialCompositeMechanicsGpu.js';
import {
  createSchroederSpatialScaleAtlasGpu,
  packSchroederScaleAtlasSamples,
  decodeSchroederScaleAtlasVerifyReceipt,
  SCHROEDER_SCALE_ATLAS_VERIFY_MAGIC
} from '../src/runtime/sph/schroederSpatialScaleAtlasGpu.js';
import {
  createSchroederWorkerHierarchyConfig
} from '../src/runtime/sph/schroederWorkerLaneControlPlane.js';
import {
  createMlsMpmGridSpec
} from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  buildLaunchParamsFromStagedConfig,
  buildStagedConfigFromPreset,
  parseStagedConfigFromUrlSearchParams,
  serializeStagedConfigToUrlSearchParams
} from '../src/visualization/ulgSimStudioModel.js';

function createFakeWebGpuDevice({ maxStorageBuffersPerShaderStage = 8 } = {}) {
  const createdBuffers = [];
  const createdPipelines = [];
  const createdBindGroupLayouts = [];
  const submittedEncoders = [];
  return {
    limits: { maxStorageBuffersPerShaderStage },
    createdBuffers,
    createdPipelines,
    createdBindGroupLayouts,
    submittedEncoders,
    createBuffer(desc) {
      const buf = {
        ...desc,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      createdBuffers.push(buf);
      return buf;
    },
    createShaderModule(desc) {
      return { ...desc };
    },
    createBindGroupLayout(desc) {
      const storageCount = (desc.entries || []).filter(
        (e) => e.buffer?.type === 'storage' || e.buffer?.type === 'read-only-storage'
      ).length;
      if (storageCount > maxStorageBuffersPerShaderStage) {
        throw new Error(
          `BindGroupLayout ${desc.label} uses ${storageCount} storage buffers > device limit ${maxStorageBuffersPerShaderStage}`
        );
      }
      createdBindGroupLayouts.push({ ...desc, storageCount });
      return { ...desc, storageCount };
    },
    createPipelineLayout(desc) {
      return { ...desc };
    },
    createComputePipeline(desc) {
      createdPipelines.push(desc);
      return { ...desc };
    },
    createBindGroup(desc) {
      return { ...desc };
    },
    createCommandEncoder(desc) {
      const ops = [];
      return {
        ...desc,
        ops,
        beginComputePass(passDesc) {
          const passOps = [];
          ops.push({ type: 'compute-pass', passDesc, passOps });
          return {
            setPipeline(p) { passOps.push({ op: 'pipeline', label: p.label }); },
            setBindGroup(slot, bg) { passOps.push({ op: 'bindGroup', slot, label: bg.label }); },
            dispatchWorkgroups(x, y = 1, z = 1) { passOps.push({ op: 'dispatch', x, y, z }); },
            end() { passOps.push({ op: 'end' }); }
          };
        },
        clearBuffer(buffer) { ops.push({ type: 'clear', label: buffer.label }); },
        copyBufferToBuffer(src, srcOff, dst, dstOff, size) {
          ops.push({ type: 'copy', src: src.label, dst: dst.label, size });
        },
        finish() {
          const finished = { desc, ops };
          submittedEncoders.push(finished);
          return finished;
        }
      };
    },
    queue: {
      writes: [],
      writeBuffer(buf, offset, data) {
        this.writes.push({ label: buf.label, offset, byteLength: data.byteLength });
      },
      submit() {},
      onSubmittedWorkDone: () => Promise.resolve()
    }
  };
}

test('40-OOM dyadic scale-chart atlas spans >41 OOM with sparse residency and exact rebasing', () => {
  assert.equal(SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL, -64);
  assert.equal(SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL, 96);
  assert.equal(SCHROEDER_DYADIC_SCALE_SPAN_LEVELS, 161);
  assert.ok(
    dyadicLevelSpanOrdersOfMagnitude(
      SCHROEDER_DYADIC_SCALE_GLOBAL_MIN_LEVEL,
      SCHROEDER_DYADIC_SCALE_GLOBAL_MAX_LEVEL
    ) > 48
  );
  assert.equal(SCHROEDER_SPATIAL_MAX_CONTIGUOUS_CHAIN_LEVELS, 16);

  // Build a 7-chart sparse hierarchy from femtometer nuclear scale (L=-50)
  // to supergalactic scale (L=+86): 137 dyadic levels = 41.24 orders of magnitude.
  const atlas = createSchroederScaleAtlasPlan({
    referenceSpacingM: 1.0,
    charts: [
      {
        chartId: 0, label: 'cosmic-supercluster',
        globalBaseLevel: 84, localMinLevel: 0, localMaxLevel: 2,
        parentChartId: null, originInParentUnits: [0, 0, 0]
      },
      {
        chartId: 1, label: 'galactic-arm',
        globalBaseLevel: 64, localMinLevel: 0, localMaxLevel: 2,
        parentChartId: 0, originInParentUnits: [1.25, -0.75, 2.5]
      },
      {
        chartId: 2, label: 'solar-system',
        globalBaseLevel: 44, localMinLevel: 0, localMaxLevel: 2,
        parentChartId: 1, originInParentUnits: [-0.5, 3.125, 0.875]
      },
      {
        chartId: 3, label: 'planetary-atmosphere',
        globalBaseLevel: 24, localMinLevel: 0, localMaxLevel: 2,
        parentChartId: 2, originInParentUnits: [4.5, -1.25, 0.25]
      },
      {
        chartId: 4, label: 'laboratory-room',
        globalBaseLevel: 0, localMinLevel: 0, localMaxLevel: 3,
        parentChartId: 3, originInParentUnits: [0.375, 1.5, -2.25]
      },
      {
        chartId: 5, label: 'aerosol-microstructure',
        globalBaseLevel: -24, localMinLevel: 0, localMaxLevel: 2,
        parentChartId: 4, originInParentUnits: [1.125, 0.625, 0.375]
      },
      {
        chartId: 6, label: 'nuclear-femtometer',
        globalBaseLevel: -50, localMinLevel: 0, localMaxLevel: 2,
        parentChartId: 5, originInParentUnits: [-0.25, 0.75, 1.5]
      }
    ]
  });

  assert.equal(atlas.schema, ULG_SCHROEDER_SPATIAL_SCALE_ATLAS_SCHEMA);
  assert.equal(atlas.supports40OomTarget, true);
  assert.equal(atlas.minGlobalLevel, -50);
  assert.equal(atlas.maxGlobalLevel, 86);
  assert.equal(atlas.dyadicSpanLevels, 137);
  assert.ok(atlas.ordersOfMagnitude > SCHROEDER_DYADIC_SCALE_TARGET_OOM);
  assert.ok(atlas.ordersOfMagnitude > 40.9);
  // Sparse residency: only 22 active levels across a 137-level (>41 OOM) span!
  assert.equal(atlas.activeLevelCount, 22);
  assert.ok(atlas.sparseOccupancyRatio < 0.2);
  assert.equal(atlas.minPhysicalSpacingM, dyadicScaleSpacingM(-50, 1.0));
  assert.equal(atlas.maxPhysicalSpacingM, dyadicScaleSpacingM(86, 1.0));

  // Verify exact double-float origin splitting and child <-> parent rebasing.
  const [hi, lo] = splitFloat64ToDoubleFloat(123456789.12345679);
  assert.ok(Math.abs(combineDoubleFloatToFloat64(hi, lo) - 123456789.12345679) < 1e-7);

  for (let i = 1; i < atlas.charts.length; i += 1) {
    const child = atlas.charts[i];
    const parent = atlas.charts.find((c) => c.chartId === child.parentChartId);
    const localPos = [0.75, -1.25, 2.5];
    const parentPos = rebasePositionChildToParent(localPos, child, parent);
    const recovered = rebasePositionParentToChild(parentPos, parent, child);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(
        Math.abs(recovered[axis] - localPos[axis]) < 1e-6,
        `chart ${child.chartId} -> ${parent.chartId} roundtrip axis ${axis}`
      );
    }

    // Parallel-axis angular momentum conservation across chart boundary.
    const agg = {
      massKg: 3.5,
      comLocal: localPos,
      linearMomentumKgMPerS: [2.0, -1.5, 0.5],
      angularMomentumKgM2PerS: [0.1, -0.2, 0.3],
      kineticEnergyJ: 12.25,
      internalEnergyJ: 48.5,
      boundingRadiusLocal: 0.4
    };
    const lifted = rebaseAggregateMomentChildToParent(agg, child, parent);
    assert.equal(lifted.massKg, agg.massKg);
    assert.deepEqual(lifted.linearMomentumKgMPerS, agg.linearMomentumKgMPerS);
    assert.equal(lifted.kineticEnergyJ, agg.kineticEnergyJ);
    assert.equal(lifted.internalEnergyJ, agg.internalEnergyJ);
    const originM = child.originInParentUnits.map((u) => u * parent.physicalBaseSpacingM);
    const expectedShift = [
      originM[1] * agg.linearMomentumKgMPerS[2] - originM[2] * agg.linearMomentumKgMPerS[1],
      originM[2] * agg.linearMomentumKgMPerS[0] - originM[0] * agg.linearMomentumKgMPerS[2],
      originM[0] * agg.linearMomentumKgMPerS[1] - originM[1] * agg.linearMomentumKgMPerS[0]
    ];
    for (let axis = 0; axis < 3; axis += 1) {
      const expected = agg.angularMomentumKgM2PerS[axis] + expectedShift[axis];
      const tol = Math.max(1e-12, Math.abs(expected) * 1e-6);
      assert.ok(Math.abs(lifted.angularMomentumKgM2PerS[axis] - expected) <= tol);
    }
  }

  // Pack GPU chart table and inspect exact layout.
  const packed = packSchroederScaleAtlasChartTable(atlas);
  assert.equal(packed.length, atlas.chartCount * SCHROEDER_SCALE_CHART_RECORD_WORDS);
  assert.equal(packed[0], 0);
  assert.equal(packed[1], SCHROEDER_SCALE_CHART_NO_PARENT);
  assert.match(schroederScaleAtlasChartRebaseWgsl, /ss_atlas_dyadic_scale_vec3/);
  assert.match(schroederScaleAtlasChartRebaseWgsl, /ss_atlas_rebase_child_to_parent/);

  // Reject cycles and out-of-range levels fail-closed.
  assert.throws(
    () => createSchroederScaleAtlasPlan({
      charts: [
        { chartId: 0, globalBaseLevel: 0, localMinLevel: 0, localMaxLevel: 1, parentChartId: 1 },
        { chartId: 1, globalBaseLevel: 10, localMinLevel: 0, localMaxLevel: 1, parentChartId: 0 }
      ]
    }),
    /Cycle detected/i
  );
  assert.throws(
    () => createSchroederScaleChartDescriptor({ globalBaseLevel: 95, localMinLevel: 0, localMaxLevel: 5 }),
    /exceed/i
  );
});

test('O(1)-binding composite mechanics supports 8 and 16 contiguous levels under strict 8-storage-buffer WebGPU floor', () => {
  assert.match(schroederSpatialChainCorrectionAccumulateAdmissionWgsl, /fn init_chain_admission/);
  assert.match(schroederSpatialChainCorrectionAccumulateAdmissionWgsl, /fn accumulate_chain_admission/);
  assert.match(schroederSpatialChainCorrectionAccumulateAdmissionWgsl, /fn seal_chain_admission/);

  for (const levelCount of [3, 8, 12, 16]) {
    const device = createFakeWebGpuDevice({ maxStorageBuffersPerShaderStage: 8 });
    const composite = createSchroederSpatialCompositeMechanicsGpu(device, {
      parentFieldCapacities: Array.from({ length: levelCount - 1 }, () => 32),
      nativeFieldCapacities: Array.from({ length: levelCount }, () => 32),
      arenaCount: 1,
      firstMoments: true
    });
    assert.equal(typeof composite.encode, 'function');
    assert.equal(typeof composite.publishNativeState, 'function');
    assert.ok(device.createdBindGroupLayouts.length > 0);
    // Every single bind group layout fits inside WebGPU's 8-storage-buffer floor!
    for (const bgl of device.createdBindGroupLayouts) {
      assert.ok(
        bgl.storageCount <= 8,
        `${levelCount}-level chain layout ${bgl.label} used ${bgl.storageCount} storage buffers (> 8)`
      );
    }
    composite.destroy();
  }

  // 17 contiguous levels inside a single chart is rejected cleanly (use multi-chart scale atlas instead).
  const device = createFakeWebGpuDevice({ maxStorageBuffersPerShaderStage: 8 });
  assert.throws(
    () => createSchroederSpatialCompositeMechanicsGpu(device, {
      parentFieldCapacities: Array.from({ length: 16 }, () => 16),
      nativeFieldCapacities: Array.from({ length: 17 }, () => 16)
    }),
    /one to 15 bounded pair capacities/i
  );
});

test('buildSchroederMechanicsChainLevelSpecs builds exact 2:1 f32 hierarchies up to 16 levels and scale-atlas GPU encodes cleanly', () => {
  for (const levelCount of [3, 4, 8, 16]) {
    const levels = buildSchroederMechanicsChainLevelSpecs({
      boxDimsM: [1.0, 1.0, 1.0],
      fineGridSpacingM: 0.0625,
      levelCount,
      minLevel: 0,
      gridSpecFactory: createMlsMpmGridSpec
    });
    assert.equal(levels.length, levelCount);
    for (let i = 0; i < levelCount; i += 1) {
      assert.equal(levels[i].selectedLevel, i);
      if (i > 0) {
        assert.equal(
          levels[i].mechanicsGrid.gridSpacingM,
          Math.fround(levels[i - 1].mechanicsGrid.gridSpacingM * 2)
        );
      }
    }
  }

  // Exercise scale-atlas GPU encoder against a fake device with 8-binding limit.
  const device = createFakeWebGpuDevice({ maxStorageBuffersPerShaderStage: 8 });
  const atlasPlan = createSchroederScaleAtlasPlan({
    charts: [
      { chartId: 0, globalBaseLevel: 40, localMinLevel: 0, localMaxLevel: 2, parentChartId: null },
      { chartId: 1, globalBaseLevel: 0, localMinLevel: 0, localMaxLevel: 2, parentChartId: 0, originInParentUnits: [1, 2, 3] }
    ]
  });
  const gpuAtlas = createSchroederSpatialScaleAtlasGpu(device, { atlasPlan, maxSamples: 8 });
  const encoder = device.createCommandEncoder({ label: 'test-atlas' });
  const encoded = gpuAtlas.encodeVerify(encoder, [
    { chartId: 1, posLocal: [0.5, -0.25, 1.0], massKg: 2.0, energyJ: 10.0, linearMomentumKgMPerS: [1, 0, 0], angularMomentumKgM2PerS: [0, 1, 0] }
  ]);
  assert.equal(encoded.sampleCount, 1);
  assert.equal(encoder.ops.length, 1);
  assert.equal(encoder.ops[0].type, 'compute-pass');
  gpuAtlas.destroy();

  // Receipt decoder check
  const words = new Uint32Array(16);
  words[0] = SCHROEDER_SCALE_ATLAS_VERIFY_MAGIC;
  words[1] = 3;
  words[2] = 0;
  words[3] = 4;
  words[4] = 24;
  words[5] = 137;
  const decoded = decodeSchroederScaleAtlasVerifyReceipt(words);
  assert.equal(decoded.verified, true);
  assert.equal(decoded.dyadicSpanLevels, 137);
  assert.equal(packSchroederScaleAtlasSamples([{ chartId: 0 }]).length, 16);
});

test('worker hierarchy config and Simulation Studio support 3..16-level Schroeder chains without changing legacy signatures', () => {
  // Legacy 1-level & 2-level signatures must remain byte-identical without `:chain1`.
  const legacySingle = createSchroederWorkerHierarchyConfig({ selectedLevel: 0, minLevel: 0, maxLevel: 0 });
  assert.equal(legacySingle.enableLevelChainMechanics, undefined);
  assert.ok(!legacySingle.signature.includes(':chain1'));

  const chain3 = createSchroederWorkerHierarchyConfig({
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 2,
    enableLevelChainMechanics: true
  });
  assert.equal(chain3.enableLevelChainMechanics, true);
  assert.ok(chain3.signature.endsWith(':chain1'));

  const chain16 = createSchroederWorkerHierarchyConfig({
    selectedLevel: 0,
    minLevel: 0,
    maxLevel: 15,
    enableLevelChainMechanics: true
  });
  assert.equal(chain16.enableLevelChainMechanics, true);

  assert.throws(
    () => createSchroederWorkerHierarchyConfig({
      selectedLevel: 0, minLevel: 0, maxLevel: 2,
      enableTwoLevelMechanics: true, enableLevelChainMechanics: true
    }),
    /mutually exclusive/i
  );
  assert.throws(
    () => createSchroederWorkerHierarchyConfig({
      selectedLevel: 0, minLevel: 0, maxLevel: 1, enableLevelChainMechanics: true
    }),
    /3\.\.16/
  );

  // Studio URL + launch params round-trip for 3, 4, 6-level chains AND backward compatibility of airTwoLevel=1.
  for (const levels of [3, 4, 6]) {
    const cfg = buildStagedConfigFromPreset('iron-ice-quench');
    cfg.environment.mode = 'air';
    cfg.environment.airHierarchyLevels = levels;
    cfg.environment.twoLevelAir = false;

    const urlParams = serializeStagedConfigToUrlSearchParams(cfg, { autoPlayWhenReady: true });
    assert.equal(urlParams.get('airLevels'), String(levels));
    assert.equal(urlParams.get('airTwoLevel'), null);

    const parsed = parseStagedConfigFromUrlSearchParams(urlParams);
    assert.equal(parsed.config.environment.airHierarchyLevels, levels);
    assert.equal(parsed.config.environment.twoLevelAir, false);

    const launch = buildLaunchParamsFromStagedConfig(parsed.config);
    assert.equal(launch.schroederLevelChain, '1');
    assert.equal(launch.schroederTwoLevel, '0');
    assert.equal(launch.schroederMinLevel, '0');
    assert.equal(launch.schroederMaxLevel, String(levels - 1));
    assert.equal(launch.exactEnergyLedger, '1');
    assert.equal(launch.environmentAirParcels, 'mixture');
  }

  // Backward compatibility: legacy `airTwoLevel=1` still compiles to 2-level authoritative air.
  const parsedTwoLevel = parseStagedConfigFromUrlSearchParams('?preset=iron-ice-quench&env=air&airTwoLevel=1');
  assert.equal(parsedTwoLevel.config.environment.twoLevelAir, true);
  assert.equal(parsedTwoLevel.config.environment.airHierarchyLevels, 2);
  const launchTwoLevel = buildLaunchParamsFromStagedConfig(parsedTwoLevel.config);
  assert.equal(launchTwoLevel.schroederTwoLevel, '1');
  assert.equal(launchTwoLevel.schroederLevelChain, undefined);
  assert.equal(launchTwoLevel.schroederMaxLevel, '1');
});

test('N-level chain mechanics WGSL avoids |p|^2/(2m) f32 underflow for microscopic/air-tail nodal masses', () => {
  // Dividing momentum by mass before squaring keeps 0.5*m*|v|^2 in normal f32 range
  // even when m ~ 1e-22 kg and |p|^2 ~ 1e-53 would underflow f32 to 0.0.
  const nativePub = schroederSpatialNativePublicationWgsl('fn begin_heat_receipt() {}');
  for (const [label, wgsl] of [
    ['chain-force', schroederSpatialChainForceWgsl],
    ['chain-prolong', schroederSpatialChainProlongWgsl],
    ['composite-mechanics', schroederSpatialCompositeMechanicsWgsl],
    ['native-publication', nativePub]
  ]) {
    assert.doesNotMatch(
      wgsl,
      /dot\s*\([^)]*momentum[^)]*\)\s*\/\s*\(\s*2\.0\s*\*/i,
      `${label} must divide momentum by mass before squaring`
    );
    assert.match(
      wgsl,
      /0\.5\s*\*\s*(?:row\[0u?\]|mass)\s*\*\s*dot\(/,
      `${label} must compute kinetic energy as 0.5 * m * dot(v, v)`
    );
  }
});
