import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_EXACT_CELL_TREE === '1';
const BASE_URL = process.env.ULG_EXACT_CELL_TREE_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_EXACT_CELL_TREE_CHROME
  || '/usr/bin/google-chrome';

function median(values) {
  assert.ok(values.length > 0, 'median requires at least one value');
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

test('native Vulkan exact-cell tree preserves canonical CSR membership and reaction parity', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_EXACT_CELL_TREE=1 for native Vulkan WebGPU'
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    native = await page.evaluate(async () => {
      const fail = (message) => { throw new Error(message); };
      const requireTrue = (condition, message) => {
        if (!condition) fail(message);
      };
      const median = (values) => {
        requireTrue(values.length > 0, 'native median requires at least one value');
        const ordered = [...values].sort((left, right) => left - right);
        const middle = Math.floor(ordered.length / 2);
        return ordered.length % 2 === 0
          ? (ordered[middle - 1] + ordered[middle]) / 2
          : ordered[middle];
      };
      const closeEnough = (actual, expected, label) => {
        const tolerance = 0.00002 * Math.max(1, Math.abs(actual), Math.abs(expected));
        requireTrue(
          Math.abs(actual - expected) <= tolerance,
          `${label}: expected ${expected}, received ${actual}, tolerance ${tolerance}`
        );
      };
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      if (!adapter.features?.has('timestamp-query')) {
        return { status: 'unsupported', reason: 'timestamp-query unavailable' };
      }

      const [
        deviceLimits,
        discovery,
        spatial,
        identity,
        gpuBuffers,
        sphState,
        reactionKernel,
        epochAbi,
        treeAbi
      ] = await Promise.all([
        import('/src/runtime/webgpuDeviceLimits.js'),
        import('/src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js'),
        import('/src/runtime/sph/schroederSpatialEpochGpu.js'),
        import('/src/runtime/sph/sphGpuDeviceIdentity.js'),
        import('/src/runtime/sph/sphGpuBuffers.js'),
        import('/src/runtime/sph/sphState.js'),
        import('/src/runtime/sph/sphReactionGpuKernel.js'),
        import('/ulg-gpu-abi/src/schroederSpatialEpoch.js'),
        import('/ulg-gpu-abi/src/schroederSpatialExactNearCellTree.js')
      ]);

      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter, {
          timestampProfilingRequested: true
        })
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      const H = 0.125;
      const R = H;
      const property = (phase, densityKgPerM3) => ({
        molarMassKgPerMol: 0.02,
        phases: [{
          name: phase,
          temperatureRange: [0, 2000],
          cpJPerKgK: 1000,
          densityKgPerM3,
          bulkModulusPa: 1e6,
          shearModulusPa: phase === 'solid' ? 2e5 : 0
        }],
        transitions: []
      });
      const materialProperties = {
        a: property('solid', 1000),
        b: property('liquid', 900),
        ab: property('liquid', 850)
      };
      const reactionTable = reactionKernel.buildSphReactionTable([{
        a: 'a',
        b: 'b',
        product: 'ab',
        activationTemperatureK: 0,
        phaseRequirements: { a: ['solid'], b: ['liquid'] },
        specificEnthalpyJPerKg: -1000
      }, {
        // This never activates, but makes the real immutable material-pair
        // index participate in the shadow comparator. The valid row above
        // remains the canonical lowest-index winner.
        a: 'a',
        b: 'b',
        product: 'ab',
        activationTemperatureK: 2_000_000,
        phaseRequirements: { a: ['solid'], b: ['liquid'] },
        specificEnthalpyJPerKg: -500
      }], {
        materialProperties,
        contactRadiusM: R
      });

      const particle = (material, authority, level = 0, current = authority) => ({
        material,
        authority,
        current,
        level
      });
      const pair = (x, level = 0) => [
        particle('a', [x, 0, 0], level),
        particle('b', [x + H / 2, 0, 0], level)
      ];
      const fixtures = [
        {
          name: 'sparse',
          minLevel: 0,
          maxLevel: 0,
          particles: [
            ...pair(-2), ...pair(1), ...pair(3), ...pair(-4)
          ]
        },
        {
          name: 'dense-single-cell',
          minLevel: 0,
          maxLevel: 0,
          particles: [
            particle('a', [0, 0, 0]),
            particle('a', [0.0078125, 0, 0]),
            particle('a', [0.015625, 0, 0]),
            particle('a', [0.0234375, 0, 0]),
            particle('b', [0.046875, 0, 0]),
            particle('b', [0.0546875, 0, 0]),
            particle('b', [0.0625, 0, 0]),
            particle('b', [0.0703125, 0, 0])
          ]
        },
        {
          name: 'multilevel',
          minLevel: -1,
          maxLevel: 1,
          particles: [
            ...pair(-0.46875, -1),
            ...pair(0.25, 0),
            ...pair(1, 1)
          ]
        },
        {
          name: 'negative-coordinates',
          minLevel: 0,
          maxLevel: 0,
          particles: [...pair(-4.125), ...pair(-1.125)]
        },
        {
          name: 'cell-boundary',
          minLevel: 0,
          maxLevel: 0,
          particles: [
            particle('a', [0.125, -0.125, 0.25]),
            particle('b', [0.1875, -0.0625, 0.1875])
          ]
        },
        {
          name: 'current-source-r-plus-d-displacement',
          minLevel: 0,
          maxLevel: 0,
          particles: [
            particle('a', [0, 0, 0]),
            particle('b', [0.875, 0, 0], 0, [0.0625, 0, 0])
          ]
        }
      ];
      const makeContentionFixture = (name, centers, particlesPerMaterial) => ({
        name,
        minLevel: 0,
        maxLevel: 0,
        particles: centers.flatMap((center) => [
          ...Array.from(
            { length: particlesPerMaterial },
            () => particle('a', [...center])
          ),
          ...Array.from(
            { length: particlesPerMaterial },
            () => particle('b', [...center])
          )
        ])
      });
      const aggregationPerformanceFixtures = [
        makeContentionFixture('dense-contention', [[0.03125, 0.03125, 0.03125]], 96),
        {
          name: 'sparse-many-cells',
          minLevel: 0,
          maxLevel: 0,
          particles: Array.from({ length: 64 }, (_, index) => (
            pair(-16 + index * 0.5)
          )).flat()
        },
        makeContentionFixture(
          'clustered-multi-cell',
          [-3, -2, -1, 0, 1, 2, 3, 4].map((x) => [x, 0, 0]),
          16
        )
      ];

      const createTaggedBuffer = (deviceForBuffer, label, values, usage) => {
        const buffer = deviceForBuffer.createBuffer({
          label,
          size: Math.max(4, Math.ceil(values.byteLength / 4) * 4),
          usage
        });
        if (values.byteLength > 0) deviceForBuffer.queue.writeBuffer(buffer, 0, values);
        return identity.tagWebGpuBufferDevice(buffer, deviceForBuffer);
      };
      const readBuffer = async (deviceForRead, source, byteLength, label) => {
        const size = Math.max(4, Math.ceil(byteLength / 4) * 4);
        const readback = deviceForRead.createBuffer({
          label,
          size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = deviceForRead.createCommandEncoder({
          label: `${label}-copy-encoder`
        });
        encoder.copyBufferToBuffer(source, 0, readback, 0, size);
        deviceForRead.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ, 0, size);
        const bytes = readback.getMappedRange(0, size).slice(0, byteLength);
        readback.unmap();
        readback.destroy();
        return bytes;
      };
      const floatFromBits = (bits) => new Float32Array(
        new Uint32Array([bits]).buffer
      )[0];
      const DIRECT_CONTROL_EVIDENCE_WORDS = 30;
      const DIRECT_CONTROL_RANGE_LOOKUP_VISITS = 27;
      const DIRECT_CONTROL_CELL_VISITS = 28;
      const DIRECT_CONTROL_MEMBER_VISITS = 29;
      const LEGACY_TREE_CONTROL_EVIDENCE_WORDS = 27;
      const createDirectDirectoryControlWgsl = () => {
        // This code stays inside the native test. It is a deliberately
        // non-admissible shadow of the pre-tree canonical directory walker:
        // same current source, R + D envelope, directory, rule index, and
        // exact pair predicate; no production route can select it.
        const directTraversal = /* wgsl */ `
  if (
    !ss_exact_near_finite(query_minimum.x)
    || !ss_exact_near_finite(query_minimum.y)
    || !ss_exact_near_finite(query_minimum.z)
    || !ss_exact_near_finite(query_maximum.x)
    || !ss_exact_near_finite(query_maximum.y)
    || !ss_exact_near_finite(query_maximum.z)
    || !all(query_minimum <= query_maximum)
  ) {
    malformed = true;
  } else {
    for (
      var level_ordinal = 0u;
      level_ordinal < spatial_expectation.level_count;
      level_ordinal = level_ordinal + 1u
    ) {
      if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
        continue;
      }
      let level = spatial_expectation.min_level + i32(level_ordinal);
      let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
      if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
        malformed = true;
        break;
      }
      let minimum_cell = vec3<i32>(floor(query_minimum / spacing_m));
      let maximum_cell = vec3<i32>(floor(query_maximum / spacing_m));
      let level_order = ss_exact_near_signed_order_key(level);
      let minimum_order = vec3<u32>(
        ss_exact_near_signed_order_key(minimum_cell.x),
        ss_exact_near_signed_order_key(minimum_cell.y),
        ss_exact_near_signed_order_key(minimum_cell.z)
      );
      let maximum_order = vec3<u32>(
        ss_exact_near_signed_order_key(maximum_cell.x),
        ss_exact_near_signed_order_key(maximum_cell.y),
        ss_exact_near_signed_order_key(maximum_cell.z)
      );
      reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
      let level_begin = ss_exact_near_lower_bound_cell_key(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(0u)
      );
      reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
      let level_end = ss_exact_near_upper_bound_cell_key(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(0xffffffffu)
      );
      reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
      var x_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(minimum_order.x, 0u, 0u),
        level_begin,
        level_end
      );
      for (
        var x_iteration = 0u;
        x_iteration < spatial_expectation.source_count && x_cursor < level_end;
        x_iteration = x_iteration + 1u
      ) {
        let x_order = ss_exact_near_cell_key_word(spatial_expectation, x_cursor, 2u);
        if (x_order > maximum_order.x) {
          x_cursor = level_end;
          continue;
        }
        reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
        let x_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
          x_cursor,
          level_end
        );
        if (x_end <= x_cursor) {
          malformed = true;
          break;
        }
        reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
        var y_cursor = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, minimum_order.y, 0u),
          x_cursor,
          x_end
        );
        for (
          var y_iteration = 0u;
          y_iteration < spatial_expectation.source_count && y_cursor < x_end;
          y_iteration = y_iteration + 1u
        ) {
          let y_order = ss_exact_near_cell_key_word(spatial_expectation, y_cursor, 3u);
          if (y_order > maximum_order.y) {
            y_cursor = x_end;
            continue;
          }
          reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
          let y_end = ss_exact_near_upper_bound_cell_key_range(
            spatial_expectation,
            spatial_expectation.chart_id,
            level_order,
            vec3<u32>(x_order, y_order, 0xffffffffu),
            y_cursor,
            x_end
          );
          if (y_end <= y_cursor) {
            malformed = true;
            break;
          }
          reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
          let z_begin = ss_exact_near_lower_bound_cell_key_range(
            spatial_expectation,
            spatial_expectation.chart_id,
            level_order,
            vec3<u32>(x_order, y_order, minimum_order.z),
            y_cursor,
            y_end
          );
          reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS);
          let z_end = ss_exact_near_upper_bound_cell_key_range(
            spatial_expectation,
            spatial_expectation.chart_id,
            level_order,
            vec3<u32>(x_order, y_order, maximum_order.z),
            z_begin,
            y_end
          );
          for (
            var cell_index = z_begin;
            cell_index < z_end;
            cell_index = cell_index + 1u
          ) {
            reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_CELL_VISITS);
            let member_range = ss_exact_near_cell_member_range(
              spatial_expectation,
              cell_index
            );
            if (member_range.admitted == 0u) {
              malformed = true;
              break;
            }
            for (
              var member_offset = member_range.begin;
              member_offset < member_range.end;
              member_offset = member_offset + 1u
            ) {
              reaction_discovery_increment_counter(S9D_DIRECT_CONTROL_MEMBER_VISITS);
              let lookup = ss_exact_near_source_at_member(
                spatial_expectation,
                member_offset
              );
              if (lookup.admitted == 0u) {
                malformed = true;
                break;
              }
              reaction_discovery_consider_pair(
                particle_index,
                lookup.source_index,
                self_material,
                self_position,
                &best
              );
            }
            if (malformed) {
              break;
            }
          }
          if (malformed) {
            break;
          }
          y_cursor = y_end;
        }
        if (malformed || y_cursor < x_end) {
          malformed = true;
          break;
        }
        x_cursor = x_end;
      }
      if (malformed || x_cursor < level_end) {
        malformed = true;
        break;
      }
    }
  }`;
        const source = discovery.schroederSpatialReactionDiscoveryProposalWgsl;
        const constantsAnchor =
          'const REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS: u32 = 26u;';
        const directConstants = [
          'const S9D_DIRECT_CONTROL_RANGE_LOOKUP_VISITS: u32 = 27u;',
          'const S9D_DIRECT_CONTROL_CELL_VISITS: u32 = 28u;',
          'const S9D_DIRECT_CONTROL_MEMBER_VISITS: u32 = 29u;'
        ].join('\n');
        requireTrue(source.includes(constantsAnchor),
          'native shadow control could not locate production evidence constants');
        let control = source.replace(
          constantsAnchor,
          constantsAnchor + '\n' + directConstants
        );
        const capacityAnchor = [
          'arrayLength(&traversal_evidence)',
          '      < REACTION_DISCOVERY_EVIDENCE_TREE_MEMBER_VISITS + 1u'
        ].join('\n');
        requireTrue(control.includes(capacityAnchor),
          'native shadow control could not locate production proposal evidence guard');
        control = control.replace(
          capacityAnchor,
          [
            'arrayLength(&traversal_evidence)',
            '      < S9D_DIRECT_CONTROL_MEMBER_VISITS + 1u'
          ].join('\n')
        );
        const traversalStart =
          '  let tree_cell_count = exact_near_cell_tree[18u];';
        const traversalEnd = [
          '',
          '',
          '  if (!reaction_discovery_flush_hot_counters()) {',
          '    malformed = true;',
          '  }'
        ].join('\n');
        const start = control.indexOf(traversalStart);
        const end = control.indexOf(traversalEnd, start);
        requireTrue(start >= 0 && end > start,
          'native shadow control could not locate the production tree traversal');
        return control.slice(0, start)
          + directTraversal
          + control.slice(end);
      };
      const createLegacyUnaggregatedTreeControlWgsl = () => {
        // This test-only clone retains the production tree traversal and all
        // authoritative bindings. It removes only S9D's local diagnostic
        // aggregation so native evidence can compare the old global-atomic
        // behavior byte-for-byte with the production path.
        const source = discovery.schroederSpatialReactionDiscoveryProposalWgsl;
        const aggregationStart = '// S9D_HOT_COUNTER_AGGREGATION_BEGIN';
        const aggregationEnd = '// S9D_HOT_COUNTER_AGGREGATION_END';
        const start = source.indexOf(aggregationStart);
        const end = source.indexOf(aggregationEnd, start);
        requireTrue(start >= 0 && end > start,
          'native legacy tree control could not locate S9D aggregation helpers');
        const legacyCounterBlock = [
          '// S9D_HOT_COUNTER_AGGREGATION_BEGIN (native test-only legacy control)',
          'fn reaction_discovery_reset_hot_counters() {}',
          'fn reaction_discovery_flush_hot_counters() -> bool { return true; }',
          'fn reaction_discovery_increment_counter(counter_index: u32) {',
          '  reaction_discovery_increment_control_counter(counter_index);',
          '}',
          '// S9D_HOT_COUNTER_AGGREGATION_END (native test-only legacy control)'
        ].join('\n');
        return source.slice(0, start)
          + legacyCounterBlock
          + source.slice(end + aggregationEnd.length);
      };
      const decodeSigned = (word) => ((word ^ 0x80000000) | 0);

      function createFixtureResources(deviceForFixture, spec, epochOrdinal) {
        const source = sphState.createSphState({
          smoothingLengthM: H,
          dimension: 3,
          step: epochOrdinal,
          particles: spec.particles.map((entry, index) => ({
            id: `${spec.name}-${epochOrdinal}-${entry.material}-${index}`,
            material: entry.material,
            x: entry.authority,
            v: [0, 0, 0],
            massKg: 1,
            specificInternalEnergyJPerKg: 600000
          }))
        });
        const packed = gpuBuffers.buildSphGpuParticleBuffers(source, { materialProperties });
        const authorityState = packed.state.slice();
        for (const [index, entry] of spec.particles.entries()) {
          packed.state.set(entry.current, index * 8);
        }
        const epoch = {
          storageGeneration: epochOrdinal + 1,
          physicsTick: epochOrdinal,
          physicsSubstep: 0,
          positionEpoch: epochOrdinal,
          topologyEpoch: 1,
          chartEpoch: 1,
          levelEpoch: epochOrdinal,
          supportEpoch: epochOrdinal
        };
        Object.assign(packed, epoch);
        const upload = gpuBuffers.uploadSphGpuParticleBuffers(deviceForFixture, packed);
        Object.assign(upload, epoch, {
          bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1
        });
        const authorityStateBuffer = createTaggedBuffer(
          deviceForFixture,
          `ulg-native-exact-cell-${spec.name}-${epochOrdinal}-authority-state`,
          authorityState,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        const activeRows = new Float32Array(packed.particleCount * 16);
        for (const [index, entry] of spec.particles.entries()) {
          const [x, y, z] = entry.authority;
          const spacing = H * (2 ** entry.level);
          const cellX = Math.floor(x / spacing);
          const cellY = Math.floor(y / spacing);
          const cellZ = Math.floor(z / spacing);
          activeRows.set([
            entry.level, cellX, cellY, cellZ,
            cellX, cellY, cellZ, spacing,
            spacing, 2 * spacing, index, 1,
            x, y, z, 0
          ], index * 16);
        }
        const activeNodeBuffer = createTaggedBuffer(
          deviceForFixture,
          `ulg-native-exact-cell-${spec.name}-${epochOrdinal}-active-nodes`,
          activeRows,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        const activeNodeList = {
          schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
          status: 'schroeder-active-node-list-submitted',
          particleCount: packed.particleCount,
          activeCandidateCount: packed.particleCount,
          activeNodeStrideFloats: 16,
          activeNodeBuffer,
          sourceStateBuffer: authorityStateBuffer,
          sourceStateBufferBorrowed: true,
          phaseVolumeAssignmentOverlayEnabled: false,
          spatialDirectorySourceSchema:
            'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
          spatialDirectorySourceStatus:
            'schroeder-spatial-directory-source-ready',
          spatialDirectorySourceReady: true,
          spatialEpochSourceSchema:
            'peercompute.ulg.schroeder-spatial-active-node-source.v1',
          spatialEpochSourceStatus:
            'schroeder-spatial-active-node-source-ready',
          spatialEpochSourceReady: true,
          spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
          spatialEpochPositionAuthority:
            'same-epoch-pre-integration-particle-state',
          spatialEpochMinLevel: spec.minLevel,
          spatialEpochMaxLevel: spec.maxLevel,
          spatialEpochBaseGridSpacingM: H,
          spatialEpochChartId: 0,
          spatialEpochStorageGeneration: epoch.storageGeneration,
          spatialEpochPhysicsTick: epoch.physicsTick,
          spatialEpochPhysicsSubstep: epoch.physicsSubstep,
          spatialEpochPositionEpoch: epoch.positionEpoch,
          spatialEpochTopologyEpoch: epoch.topologyEpoch,
          spatialEpochChartEpoch: epoch.chartEpoch,
          spatialEpochLevelEpoch: epoch.levelEpoch,
          spatialEpochSupportEpoch: epoch.supportEpoch
        };
        return {
          packed,
          upload,
          authorityState,
          authorityStateBuffer,
          activeNodeBuffer,
          activeNodeList,
          destroy() {
            activeNodeBuffer.destroy();
            authorityStateBuffer.destroy();
            gpuBuffers.destroySphGpuParticleBuffers(upload);
          }
        };
      }

      function createTimestampRecorder(
        deviceForTimestamps,
        label,
        stages = ['exact-near-cell-tree-build', 'candidate-traversal']
      ) {
        const expectedStages = [...new Set(stages)];
        requireTrue(expectedStages.length > 0,
          `${label}: timestamp recorder requires at least one stage`);
        const queryCount = expectedStages.length * 2;
        const querySet = deviceForTimestamps.createQuerySet({
          label: `${label}-queries`,
          type: 'timestamp',
          count: queryCount
        });
        const resolveBuffer = deviceForTimestamps.createBuffer({
          label: `${label}-resolve`,
          size: queryCount * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        const readbackBuffer = deviceForTimestamps.createBuffer({
          label: `${label}-readback`,
          size: queryCount * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const tokens = [];
        return {
          recorder: {
            active: true,
            beginEncoderSpan(encoder, descriptor = {}) {
              if (!expectedStages.includes(descriptor.stage)) return null;
              const token = {
                encoder,
                descriptor,
                queryIndex: tokens.length * 2,
                ended: false
              };
              requireTrue(token.queryIndex + 1 < queryCount,
                `${label}: too many timestamp spans`);
              encoder.writeTimestamp(querySet, token.queryIndex);
              tokens.push(token);
              return token;
            },
            endEncoderSpan(encoder, token) {
              requireTrue(token?.encoder === encoder && token.ended === false,
                `${label}: timestamp end did not match begin`);
              encoder.writeTimestamp(querySet, token.queryIndex + 1);
              token.ended = true;
            }
          },
          async complete() {
            requireTrue(
              tokens.length === expectedStages.length
                && tokens.every((token) => token.ended)
                && expectedStages.every((stage) => (
                  tokens.some((token) => token.descriptor.stage === stage)
                )),
              `${label}: missing expected timestamp span`
            );
            const encoder = deviceForTimestamps.createCommandEncoder({
              label: `${label}-resolve-encoder`
            });
            encoder.resolveQuerySet(querySet, 0, queryCount, resolveBuffer, 0);
            encoder.copyBufferToBuffer(
              resolveBuffer,
              0,
              readbackBuffer,
              0,
              queryCount * BigUint64Array.BYTES_PER_ELEMENT
            );
            deviceForTimestamps.queue.submit([encoder.finish()]);
            await readbackBuffer.mapAsync(
              GPUMapMode.READ,
              0,
              queryCount * BigUint64Array.BYTES_PER_ELEMENT
            );
            const values = new BigUint64Array(
              readbackBuffer.getMappedRange(
                0,
                queryCount * BigUint64Array.BYTES_PER_ELEMENT
              ).slice(0)
            );
            readbackBuffer.unmap();
            const result = {};
            for (const token of tokens) {
              const start = values[token.queryIndex];
              const end = values[token.queryIndex + 1];
              requireTrue(end > start && end - start <= BigInt(Number.MAX_SAFE_INTEGER),
                `${label}: non-monotonic timestamp evidence for ${token.descriptor.stage}`);
              result[token.descriptor.stage] = Number(end - start) / 1e6;
            }
            return result;
          },
          destroy() {
            querySet.destroy();
            resolveBuffer.destroy();
            readbackBuffer.destroy();
          }
        };
      }

      const directControlWgsl = createDirectDirectoryControlWgsl();
      const legacyTreeControlWgsl = createLegacyUnaggregatedTreeControlWgsl();
      let directControlPipelines = null;
      function directControlPipelinesForDevice(deviceForControl) {
        if (directControlPipelines) return directControlPipelines;
        const module = deviceForControl.createShaderModule({
          label: 'ulg-s9d-native-only-direct-directory-shadow-control-shader',
          code: directControlWgsl
        });
        const createPipeline = (entryPoint) => deviceForControl.createComputePipeline({
          label: 'ulg-s9d-native-only-direct-directory-shadow-control-' + entryPoint,
          layout: 'auto',
          compute: { module, entryPoint }
        });
        directControlPipelines = Object.freeze({
          displacement: createPipeline('prepare_displacement_certificate'),
          proposal: createPipeline('propose'),
          seal: createPipeline('seal')
        });
        return directControlPipelines;
      }

      let legacyTreeControlPipelines = null;
      function legacyTreeControlPipelinesForDevice(deviceForControl) {
        if (legacyTreeControlPipelines) return legacyTreeControlPipelines;
        const module = deviceForControl.createShaderModule({
          label: 'ulg-s9d-native-only-legacy-tree-global-atomic-control-shader',
          code: legacyTreeControlWgsl
        });
        const createPipeline = (entryPoint) => deviceForControl.createComputePipeline({
          label: 'ulg-s9d-native-only-legacy-tree-global-atomic-control-' + entryPoint,
          layout: 'auto',
          compute: { module, entryPoint }
        });
        legacyTreeControlPipelines = Object.freeze({
          displacement: createPipeline('prepare_displacement_certificate'),
          proposal: createPipeline('propose'),
          seal: createPipeline('seal')
        });
        return legacyTreeControlPipelines;
      }

      let aggregateTreeControlPipelines = null;
      function aggregateTreeControlPipelinesForDevice(deviceForControl) {
        if (aggregateTreeControlPipelines) return aggregateTreeControlPipelines;
        const module = deviceForControl.createShaderModule({
          label: 'ulg-s9d-native-only-production-aggregate-tree-control-shader',
          code: discovery.schroederSpatialReactionDiscoveryProposalWgsl
        });
        const createPipeline = (entryPoint) => deviceForControl.createComputePipeline({
          label: 'ulg-s9d-native-only-production-aggregate-tree-control-' + entryPoint,
          layout: 'auto',
          compute: { module, entryPoint }
        });
        aggregateTreeControlPipelines = Object.freeze({
          displacement: createPipeline('prepare_displacement_certificate'),
          proposal: createPipeline('propose'),
          seal: createPipeline('seal')
        });
        return aggregateTreeControlPipelines;
      }

      function directControlParamsData(
        reference,
        { collectDiagnosticEvidence = true } = {}
      ) {
        const data = new ArrayBuffer(64);
        const view = new DataView(data);
        const ruleIndex = reference.reactionRuleIndex;
        view.setUint32(0, reference.particleCount, true);
        view.setUint32(4, reference.reactionCount, true);
        view.setUint32(8, 3, true);
        view.setUint32(12, reference.supportProfileId, true);
        view.setFloat32(16, reference.maximumContactRadiusM, true);
        view.setUint32(20, 16, true);
        view.setUint32(24, 3, true);
        view.setUint32(28, 2, true);
        view.setUint32(32, ruleIndex.modeCode, true);
        view.setUint32(36, ruleIndex.pairOffsetVec4s, true);
        view.setUint32(40, ruleIndex.pairCount, true);
        view.setUint32(44, ruleIndex.ruleOffsetVec4s, true);
        view.setUint32(48, ruleIndex.ruleCount, true);
        view.setUint32(52, ruleIndex.recordVec4Count, true);
        view.setUint32(56, collectDiagnosticEvidence === true ? 1 : 0, true);
        view.setUint32(60, 0, true);
        return data;
      }

      function directControlEvidenceInitial(reference) {
        const words = new Uint32Array(DIRECT_CONTROL_EVIDENCE_WORDS);
        words[9] = reference.supportProfileId;
        words[10] = reference.generationId;
        words[11] = reference.epochIdentity.supportEpoch;
        words[12] = reference.particleCount;
        words[13] = reference.reactionCount;
        words[21] = 0x3f800000;
        return words;
      }

      function directControlEvidence(words) {
        return Object.freeze({
          sourceDispatchCount: words[0],
          directoryAdmissionCount: words[1],
          directoryRejectionCount: words[2],
          candidateVisitCount: words[3],
          compatiblePairCount: words[4],
          malformedTraversalCount: words[5],
          proposalCount: words[6],
          sealedRowCount: words[7],
          sourceIdentityRejectionCount: words[8],
          supportProfileId: words[9],
          generationId: words[10],
          supportEpoch: words[11],
          particleCount: words[12],
          reactionCount: words[13],
          privateLookupBuildCount: words[14],
          overflowCount: words[15],
          ruleIndexPairLookupCount: words[16],
          ruleIndexPairMissCount: words[17],
          ruleIndexRuleVisitCount: words[18],
          fullRuleScanRuleVisitCount: words[19],
          maximumDisplacementBits: words[20],
          displacementCertificateStatusBits: words[21],
          authorityActiveCount: words[22],
          currentActiveCount: words[23],
          exactCellTreeNodeVisitCount: words[24],
          exactCellTreeLeafVisitCount: words[25],
          exactCellTreeMemberVisitCount: words[26],
          directRangeLookupVisitCount: words[DIRECT_CONTROL_RANGE_LOOKUP_VISITS],
          directCellVisitCount: words[DIRECT_CONTROL_CELL_VISITS],
          directMemberVisitCount: words[DIRECT_CONTROL_MEMBER_VISITS]
        });
      }

      function treeControlEvidenceInitial(reference) {
        const words = new Uint32Array(LEGACY_TREE_CONTROL_EVIDENCE_WORDS);
        words[9] = reference.supportProfileId;
        words[10] = reference.generationId;
        words[11] = reference.epochIdentity.supportEpoch;
        words[12] = reference.particleCount;
        words[13] = reference.reactionCount;
        words[21] = 0x3f800000;
        return words;
      }

      function treeControlEvidence(words) {
        return Object.freeze({
          sourceDispatchCount: words[0],
          directoryAdmissionCount: words[1],
          directoryRejectionCount: words[2],
          candidateVisitCount: words[3],
          compatiblePairCount: words[4],
          malformedTraversalCount: words[5],
          proposalCount: words[6],
          sealedRowCount: words[7],
          sourceIdentityRejectionCount: words[8],
          supportProfileId: words[9],
          generationId: words[10],
          supportEpoch: words[11],
          particleCount: words[12],
          reactionCount: words[13],
          privateLookupBuildCount: words[14],
          overflowCount: words[15],
          ruleIndexPairLookupCount: words[16],
          ruleIndexPairMissCount: words[17],
          ruleIndexRuleVisitCount: words[18],
          fullRuleScanRuleVisitCount: words[19],
          maximumDisplacementBits: words[20],
          displacementCertificateStatusBits: words[21],
          authorityActiveCount: words[22],
          currentActiveCount: words[23],
          exactCellTreeNodeVisitCount: words[24],
          exactCellTreeLeafVisitCount: words[25],
          exactCellTreeMemberVisitCount: words[26]
        });
      }

      function createDirectShadowReference({
        deviceForControl,
        generation,
        resources,
        label,
        reactionRuleMode = 'material-pair-indexed'
      }) {
        const combined = reactionTable.combinedRecords;
        const pairMap = new Map();
        let maximumContactRadiusM = 0;
        for (let reactionIndex = 0; reactionIndex < reactionTable.reactionCount; reactionIndex += 1) {
          const offset = reactionIndex * 12;
          const materialA = Math.fround(combined[offset]);
          const materialB = Math.fround(combined[offset + 1]);
          const activationTemperatureK = Math.fround(combined[offset + 3]);
          const contactRadiusM = Math.fround(combined[offset + 5]);
          const phaseMaskA = Math.fround(combined[offset + 6]);
          const phaseMaskB = Math.fround(combined[offset + 7]);
          const status = Math.fround(combined[offset + 8]);
          if (status !== 1 || !Number.isFinite(contactRadiusM) || contactRadiusM <= 0) {
            continue;
          }
          maximumContactRadiusM = Math.max(maximumContactRadiusM, contactRadiusM);
          if (
            !Number.isFinite(materialA)
            || !Number.isFinite(materialB)
            || materialA === materialB
            || !Number.isFinite(activationTemperatureK)
            || !Number.isFinite(phaseMaskA)
            || !Number.isFinite(phaseMaskB)
          ) {
            continue;
          }
          const materialLo = Math.min(materialA, materialB);
          const materialHi = Math.max(materialA, materialB);
          const key = materialLo + ':' + materialHi;
          let entry = pairMap.get(key);
          if (!entry) {
            entry = { materialLo, materialHi, ruleIndexes: [] };
            pairMap.set(key, entry);
          }
          entry.ruleIndexes.push(reactionIndex);
        }
        const entries = [...pairMap.values()].sort((left, right) => (
          left.materialLo - right.materialLo || left.materialHi - right.materialHi
        ));
        const ruleIndexes = entries.flatMap((entry) => entry.ruleIndexes);
        const indexedMode = reactionRuleMode === 'material-pair-indexed';
        requireTrue(
          indexedMode || reactionRuleMode === 'full-scan',
          label + ': unsupported reaction-rule control mode ' + reactionRuleMode
        );
        const pairOffsetVec4s = indexedMode ? combined.length / 4 : 0;
        const ruleOffsetVec4s = indexedMode
          ? pairOffsetVec4s + entries.length
          : 0;
        const paddedRuleCount = indexedMode
          ? Math.ceil(ruleIndexes.length / 4) * 4
          : 0;
        const upload = new Float32Array(indexedMode
          ? combined.length + entries.length * 4 + paddedRuleCount
          : combined.length);
        upload.set(combined);
        if (indexedMode) {
          let pairOffset = combined.length;
          let ruleOffset = 0;
          for (const entry of entries) {
            upload[pairOffset] = entry.materialLo;
            upload[pairOffset + 1] = entry.materialHi;
            upload[pairOffset + 2] = ruleOffset;
            upload[pairOffset + 3] = entry.ruleIndexes.length;
            pairOffset += 4;
            ruleOffset += entry.ruleIndexes.length;
          }
          upload.set(ruleIndexes, combined.length + entries.length * 4);
        }
        requireTrue(
          maximumContactRadiusM > 0
            && (indexedMode ? ruleIndexes.length > 0 : combined.length > 0),
          label + ': direct shadow could not build the immutable material-pair index'
        );
        const reactionRecordBuffer = deviceForControl.createBuffer({
          label: label + '-direct-directory-reaction-records',
          size: Math.max(4, upload.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        deviceForControl.queue.writeBuffer(reactionRecordBuffer, 0, upload);
        return Object.freeze({
          generation,
          particleCount: resources.packed.particleCount,
          reactionCount: reactionTable.reactionCount,
          maximumContactRadiusM,
          supportProfileId: generation.exactNearCellTree.supportProfileId,
          generationId: generation.execution.generationId,
          epochIdentity: {
            supportEpoch: generation.execution.supportEpoch
          },
          reactionRuleIndex: Object.freeze({
            mode: indexedMode ? 'material-pair-indexed' : 'full-scan',
            modeCode: indexedMode ? 1 : 0,
            pairOffsetVec4s,
            pairCount: indexedMode ? entries.length : 0,
            ruleOffsetVec4s,
            ruleCount: indexedMode ? ruleIndexes.length : reactionTable.reactionCount,
            recordVec4Count: upload.length / 4
          }),
          reactionRecordUpload: upload,
          positionAuthorityStateBuffer: resources.authorityStateBuffer,
          sourceCurrentStateBuffer: resources.upload.stateBuffer,
          sourceThermoBuffer: resources.upload.thermoBuffer,
          reactionRecordBuffer,
          directoryBuffer: generation.execution.directoryBuffer,
          exactNearCellTreeBuffer: generation.exactNearCellTree.treeBuffer,
          expectationBuffer: generation.exactNearCellTree.expectationBuffer,
          destroy() {
            reactionRecordBuffer.destroy();
          }
        });
      }

      async function runDirectDirectoryControl({
        deviceForControl,
        generation,
        reference,
        label
      }) {
        requireTrue(
          reference?.generation === generation
            && (
              reference?.reactionRuleIndex?.mode === 'material-pair-indexed'
              || reference?.reactionRuleIndex?.mode === 'full-scan'
            )
            && reference?.positionAuthorityStateBuffer
            && reference?.sourceCurrentStateBuffer
            && reference?.sourceThermoBuffer
            && reference?.reactionRecordBuffer
            && reference?.directoryBuffer
            && reference?.exactNearCellTreeBuffer
            && reference?.expectationBuffer,
          label + ': direct shadow control did not receive an exact production reference'
        );
        const pipelines = directControlPipelinesForDevice(deviceForControl);
        const proposalBytes = reference.particleCount * 4 * Float32Array.BYTES_PER_ELEMENT;
        const evidenceBytes = DIRECT_CONTROL_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT;
        const proposalBuffer = deviceForControl.createBuffer({
          label: label + '-direct-directory-proposals',
          size: proposalBytes,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        const evidenceBuffer = deviceForControl.createBuffer({
          label: label + '-direct-directory-evidence',
          size: evidenceBytes,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });
        const paramsBuffer = deviceForControl.createBuffer({
          label: label + '-direct-directory-params',
          size: 64,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const proposalReadback = deviceForControl.createBuffer({
          label: label + '-direct-directory-proposals-readback',
          size: proposalBytes,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const evidenceReadback = deviceForControl.createBuffer({
          label: label + '-direct-directory-evidence-readback',
          size: evidenceBytes,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const querySet = deviceForControl.createQuerySet({
          label: label + '-direct-directory-candidate-query',
          type: 'timestamp',
          count: 2
        });
        const resolveBuffer = deviceForControl.createBuffer({
          label: label + '-direct-directory-candidate-resolve',
          size: 2 * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        const timestampReadback = deviceForControl.createBuffer({
          label: label + '-direct-directory-candidate-readback',
          size: 2 * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        let proposalMapped = false;
        let evidenceMapped = false;
        let timestampMapped = false;
        try {
          deviceForControl.queue.writeBuffer(
            evidenceBuffer,
            0,
            directControlEvidenceInitial(reference)
          );
          deviceForControl.queue.writeBuffer(
            paramsBuffer,
            0,
            directControlParamsData(reference)
          );
          const proposalEntries = [
            { binding: 0, resource: { buffer: reference.positionAuthorityStateBuffer } },
            { binding: 1, resource: { buffer: reference.sourceThermoBuffer } },
            { binding: 2, resource: { buffer: reference.sourceCurrentStateBuffer } },
            { binding: 3, resource: { buffer: reference.reactionRecordBuffer } },
            { binding: 4, resource: { buffer: reference.directoryBuffer } },
            { binding: 5, resource: { buffer: reference.exactNearCellTreeBuffer } },
            { binding: 6, resource: { buffer: proposalBuffer } },
            { binding: 7, resource: { buffer: evidenceBuffer } },
            { binding: 8, resource: { buffer: reference.expectationBuffer } },
            { binding: 9, resource: { buffer: paramsBuffer } }
          ];
          const displacementEntries = [
            { binding: 0, resource: { buffer: reference.positionAuthorityStateBuffer } },
            { binding: 2, resource: { buffer: reference.sourceCurrentStateBuffer } },
            { binding: 7, resource: { buffer: evidenceBuffer } },
            { binding: 9, resource: { buffer: paramsBuffer } }
          ];
          const sealEntries = [
            { binding: 6, resource: { buffer: proposalBuffer } },
            { binding: 7, resource: { buffer: evidenceBuffer } },
            { binding: 9, resource: { buffer: paramsBuffer } }
          ];
          const proposalBindGroup = deviceForControl.createBindGroup({
            label: label + '-direct-directory-proposal-bindings',
            layout: pipelines.proposal.getBindGroupLayout(0),
            entries: proposalEntries
          });
          const displacementBindGroup = deviceForControl.createBindGroup({
            label: label + '-direct-directory-displacement-bindings',
            layout: pipelines.displacement.getBindGroupLayout(0),
            entries: displacementEntries
          });
          const sealBindGroup = deviceForControl.createBindGroup({
            label: label + '-direct-directory-seal-bindings',
            layout: pipelines.seal.getBindGroupLayout(0),
            entries: sealEntries
          });
          const workgroups = Math.max(1, Math.ceil(reference.particleCount / 64));
          const encoder = deviceForControl.createCommandEncoder({
            label: label + '-direct-directory-shadow-encoder'
          });
          const displacementPass = encoder.beginComputePass({
            label: label + '-direct-directory-displacement'
          });
          displacementPass.setPipeline(pipelines.displacement);
          displacementPass.setBindGroup(0, displacementBindGroup);
          displacementPass.dispatchWorkgroups(workgroups);
          displacementPass.end();
          encoder.writeTimestamp(querySet, 0);
          const proposalPass = encoder.beginComputePass({
            label: label + '-direct-directory-propose'
          });
          proposalPass.setPipeline(pipelines.proposal);
          proposalPass.setBindGroup(0, proposalBindGroup);
          proposalPass.dispatchWorkgroups(workgroups);
          proposalPass.end();
          encoder.writeTimestamp(querySet, 1);
          const sealPass = encoder.beginComputePass({
            label: label + '-direct-directory-seal'
          });
          sealPass.setPipeline(pipelines.seal);
          sealPass.setBindGroup(0, sealBindGroup);
          sealPass.dispatchWorkgroups(workgroups);
          sealPass.end();
          encoder.copyBufferToBuffer(
            proposalBuffer,
            0,
            proposalReadback,
            0,
            proposalBytes
          );
          encoder.copyBufferToBuffer(
            evidenceBuffer,
            0,
            evidenceReadback,
            0,
            evidenceBytes
          );
          encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
          encoder.copyBufferToBuffer(
            resolveBuffer,
            0,
            timestampReadback,
            0,
            2 * BigUint64Array.BYTES_PER_ELEMENT
          );
          deviceForControl.queue.submit([encoder.finish()]);
          await Promise.all([
            proposalReadback.mapAsync(GPUMapMode.READ, 0, proposalBytes),
            evidenceReadback.mapAsync(GPUMapMode.READ, 0, evidenceBytes),
            timestampReadback.mapAsync(
              GPUMapMode.READ,
              0,
              2 * BigUint64Array.BYTES_PER_ELEMENT
            )
          ]);
          proposalMapped = true;
          evidenceMapped = true;
          timestampMapped = true;
          const rows = new Float32Array(
            proposalReadback.getMappedRange(0, proposalBytes).slice(0)
          );
          const evidenceWords = new Uint32Array(
            evidenceReadback.getMappedRange(0, evidenceBytes).slice(0)
          );
          const timestamps = new BigUint64Array(
            timestampReadback.getMappedRange(
              0,
              2 * BigUint64Array.BYTES_PER_ELEMENT
            ).slice(0)
          );
          requireTrue(
            timestamps[1] > timestamps[0]
              && timestamps[1] - timestamps[0] <= BigInt(Number.MAX_SAFE_INTEGER),
            label + ': direct shadow candidate timestamp was invalid'
          );
          return Object.freeze({
            rows,
            evidence: directControlEvidence(evidenceWords),
            candidateTraversalMs: Number(timestamps[1] - timestamps[0]) / 1e6
          });
        } finally {
          if (proposalMapped) proposalReadback.unmap();
          if (evidenceMapped) evidenceReadback.unmap();
          if (timestampMapped) timestampReadback.unmap();
          proposalBuffer.destroy();
          evidenceBuffer.destroy();
          paramsBuffer.destroy();
          proposalReadback.destroy();
          evidenceReadback.destroy();
          querySet.destroy();
          resolveBuffer.destroy();
          timestampReadback.destroy();
        }
      }

      async function runLegacyUnaggregatedTreeControl({
        deviceForControl,
        generation,
        reference,
        label,
        gpuTimestampRecorder = null,
        productionAggregation = false,
        seedEvidence = null
      }) {
        requireTrue(
          reference?.generation === generation
            && (
              reference?.reactionRuleIndex?.mode === 'material-pair-indexed'
              || reference?.reactionRuleIndex?.mode === 'full-scan'
            )
            && reference?.positionAuthorityStateBuffer
            && reference?.sourceCurrentStateBuffer
            && reference?.sourceThermoBuffer
            && reference?.reactionRecordBuffer
            && reference?.directoryBuffer
            && reference?.exactNearCellTreeBuffer
            && reference?.expectationBuffer,
          label + ': legacy tree control did not receive an exact production reference'
        );
        const pipelines = productionAggregation === true
          ? aggregateTreeControlPipelinesForDevice(deviceForControl)
          : legacyTreeControlPipelinesForDevice(deviceForControl);
        const proposalBytes = reference.particleCount * 4 * Float32Array.BYTES_PER_ELEMENT;
        const evidenceBytes = LEGACY_TREE_CONTROL_EVIDENCE_WORDS
          * Uint32Array.BYTES_PER_ELEMENT;
        const proposalBuffer = deviceForControl.createBuffer({
          label: label + '-legacy-tree-proposals',
          size: proposalBytes,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        const evidenceBuffer = deviceForControl.createBuffer({
          label: label + '-legacy-tree-evidence',
          size: evidenceBytes,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });
        const paramsBuffer = deviceForControl.createBuffer({
          label: label + '-legacy-tree-params',
          size: 64,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const proposalReadback = deviceForControl.createBuffer({
          label: label + '-legacy-tree-proposals-readback',
          size: proposalBytes,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const evidenceReadback = deviceForControl.createBuffer({
          label: label + '-legacy-tree-evidence-readback',
          size: evidenceBytes,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        let proposalMapped = false;
        let evidenceMapped = false;
        try {
          const evidenceInitial = treeControlEvidenceInitial(reference);
          if (typeof seedEvidence === 'function') {
            seedEvidence(evidenceInitial);
          }
          deviceForControl.queue.writeBuffer(
            evidenceBuffer,
            0,
            evidenceInitial
          );
          deviceForControl.queue.writeBuffer(
            paramsBuffer,
            0,
            directControlParamsData(reference)
          );
          const proposalEntries = [
            { binding: 0, resource: { buffer: reference.positionAuthorityStateBuffer } },
            { binding: 1, resource: { buffer: reference.sourceThermoBuffer } },
            { binding: 2, resource: { buffer: reference.sourceCurrentStateBuffer } },
            { binding: 3, resource: { buffer: reference.reactionRecordBuffer } },
            { binding: 4, resource: { buffer: reference.directoryBuffer } },
            { binding: 5, resource: { buffer: reference.exactNearCellTreeBuffer } },
            { binding: 6, resource: { buffer: proposalBuffer } },
            { binding: 7, resource: { buffer: evidenceBuffer } },
            { binding: 8, resource: { buffer: reference.expectationBuffer } },
            { binding: 9, resource: { buffer: paramsBuffer } }
          ];
          const displacementEntries = [
            { binding: 0, resource: { buffer: reference.positionAuthorityStateBuffer } },
            { binding: 2, resource: { buffer: reference.sourceCurrentStateBuffer } },
            { binding: 7, resource: { buffer: evidenceBuffer } },
            { binding: 9, resource: { buffer: paramsBuffer } }
          ];
          const sealEntries = [
            { binding: 6, resource: { buffer: proposalBuffer } },
            { binding: 7, resource: { buffer: evidenceBuffer } },
            { binding: 9, resource: { buffer: paramsBuffer } }
          ];
          const proposalBindGroup = deviceForControl.createBindGroup({
            label: label + '-legacy-tree-proposal-bindings',
            layout: pipelines.proposal.getBindGroupLayout(0),
            entries: proposalEntries
          });
          const displacementBindGroup = deviceForControl.createBindGroup({
            label: label + '-legacy-tree-displacement-bindings',
            layout: pipelines.displacement.getBindGroupLayout(0),
            entries: displacementEntries
          });
          const sealBindGroup = deviceForControl.createBindGroup({
            label: label + '-legacy-tree-seal-bindings',
            layout: pipelines.seal.getBindGroupLayout(0),
            entries: sealEntries
          });
          const workgroups = Math.max(1, Math.ceil(reference.particleCount / 64));
          const encoder = deviceForControl.createCommandEncoder({
            label: label + '-legacy-tree-global-atomic-encoder'
          });
          const runPass = (stage, passLabel, pipeline, bindGroup) => {
            const token = gpuTimestampRecorder?.active === true
              && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
              && typeof gpuTimestampRecorder.endEncoderSpan === 'function'
              ? gpuTimestampRecorder.beginEncoderSpan(encoder, { stage })
              : null;
            const pass = encoder.beginComputePass({ label: passLabel });
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.dispatchWorkgroups(workgroups);
            pass.end();
            if (token) gpuTimestampRecorder.endEncoderSpan(encoder, token);
          };
          runPass(
            'spatial-displacement-certificate',
            label + '-legacy-tree-displacement',
            pipelines.displacement,
            displacementBindGroup
          );
          runPass(
            'candidate-traversal',
            label + '-legacy-tree-propose',
            pipelines.proposal,
            proposalBindGroup
          );
          runPass(
            'proposal-seal',
            label + '-legacy-tree-seal',
            pipelines.seal,
            sealBindGroup
          );
          encoder.copyBufferToBuffer(
            proposalBuffer,
            0,
            proposalReadback,
            0,
            proposalBytes
          );
          encoder.copyBufferToBuffer(
            evidenceBuffer,
            0,
            evidenceReadback,
            0,
            evidenceBytes
          );
          deviceForControl.queue.submit([encoder.finish()]);
          await Promise.all([
            proposalReadback.mapAsync(GPUMapMode.READ, 0, proposalBytes),
            evidenceReadback.mapAsync(GPUMapMode.READ, 0, evidenceBytes)
          ]);
          proposalMapped = true;
          evidenceMapped = true;
          const rows = new Float32Array(
            proposalReadback.getMappedRange(0, proposalBytes).slice(0)
          );
          const evidenceWords = new Uint32Array(
            evidenceReadback.getMappedRange(0, evidenceBytes).slice(0)
          );
          return Object.freeze({
            rows,
            proposalWords: new Uint32Array(rows.buffer),
            evidenceWords,
            evidence: treeControlEvidence(evidenceWords)
          });
        } finally {
          if (proposalMapped) proposalReadback.unmap();
          if (evidenceMapped) evidenceReadback.unmap();
          proposalBuffer.destroy();
          evidenceBuffer.destroy();
          paramsBuffer.destroy();
          proposalReadback.destroy();
          evidenceReadback.destroy();
        }
      }

      async function readProductionTreeResult({
        deviceForRead,
        proposal,
        label
      }) {
        const [proposalBytes, evidenceBytes] = await Promise.all([
          readBuffer(
            deviceForRead,
            proposal.proposalBuffer,
            proposal.proposalBufferByteLength,
            label + '-production-proposals'
          ),
          readBuffer(
            deviceForRead,
            proposal.evidenceBuffer,
            proposal.evidenceBufferByteLength,
            label + '-production-evidence'
          )
        ]);
        return Object.freeze({
          proposalWords: new Uint32Array(proposalBytes),
          evidenceWords: new Uint32Array(evidenceBytes)
        });
      }

      function requireWordParity(actual, expected, label) {
        requireTrue(actual.length === expected.length,
          label + ': word length diverged: ' + actual.length + ' !== ' + expected.length);
        for (let index = 0; index < actual.length; index += 1) {
          requireTrue(actual[index] === expected[index],
            label + ': word ' + index + ' diverged: '
              + actual[index] + ' !== ' + expected[index]);
        }
      }

      async function requireProductionRuleIndexUploadParity({
        proposal,
        reference,
        label
      }) {
        const productionUpload = proposal?.reactionRuleIndex?.upload;
        requireTrue(
          productionUpload instanceof Float32Array,
          label + ': production proposal did not retain its exact host upload snapshot'
        );
        const productionBytes = new Uint8Array(
          productionUpload.buffer,
          productionUpload.byteOffset,
          productionUpload.byteLength
        );
        const referenceBytes = new Uint8Array(
          reference.reactionRecordUpload.buffer,
          reference.reactionRecordUpload.byteOffset,
          reference.reactionRecordUpload.byteLength
        );
        requireTrue(
          productionBytes.length === referenceBytes.length,
          label + ': production/reference rule-index upload byte lengths diverged'
        );
        for (let index = 0; index < productionBytes.length; index += 1) {
          requireTrue(
            productionBytes[index] === referenceBytes[index],
            label + ': production/reference rule-index upload byte '
              + index + ' diverged: '
              + productionBytes[index] + ' !== ' + referenceBytes[index]
          );
        }
        requireTrue(
          proposal.reactionDiscoveryPayloadFingerprint
            === identity.typedArrayContentFingerprint(reference.reactionRecordUpload),
          label + ': production/reference rule-index payload fingerprints diverged'
        );
        return true;
      }

      function requireAggregateLegacyTreeParity({
        aggregate,
        legacy,
        label
      }) {
        requireTrue(
          aggregate.evidenceWords.length === LEGACY_TREE_CONTROL_EVIDENCE_WORDS
            && legacy.evidenceWords.length === LEGACY_TREE_CONTROL_EVIDENCE_WORDS,
          label + ': aggregation comparison did not retain the fixed 27-word evidence ABI'
        );
        requireWordParity(
          aggregate.proposalWords,
          legacy.proposalWords,
          label + ': aggregate/legacy proposal'
        );
        requireWordParity(
          aggregate.evidenceWords,
          legacy.evidenceWords,
          label + ': aggregate/legacy evidence'
        );
      }

      async function proveAggregateLegacyParityForGeneration({
        deviceForControl,
        generation,
        resources,
        label,
        reactionRuleMode = 'material-pair-indexed'
      }) {
        const reference = createDirectShadowReference({
          deviceForControl,
          generation,
          resources,
          label: label + '-reference',
          reactionRuleMode
        });
        try {
          const aggregate = await runLegacyUnaggregatedTreeControl({
            deviceForControl,
            generation,
            reference,
            label: label + '-aggregate',
            productionAggregation: true
          });
          const legacy = await runLegacyUnaggregatedTreeControl({
            deviceForControl,
            generation,
            reference,
            label: label + '-legacy'
          });
          requireAggregateLegacyTreeParity({ aggregate, legacy, label });
          return Object.freeze({
            exact: true,
            reactionRuleMode,
            proposalWordCount: aggregate.proposalWords.length,
            evidenceWordCount: aggregate.evidenceWords.length,
            fullRuleScanRuleVisitCount: aggregate.evidenceWords[19]
          });
        } finally {
          reference.destroy();
        }
      }

      const HOT_DIAGNOSTIC_EVIDENCE_WORDS = new Set([
        3, 4, 16, 17, 18, 19, 24, 25, 26
      ]);

      function requireDefaultNoReadbackLegacyParity({
        current,
        legacy,
        label
      }) {
        requireWordParity(
          current.proposalWords,
          legacy.proposalWords,
          label + ': default-no-readback/legacy proposal'
        );
        requireTrue(
          current.evidenceWords.length === LEGACY_TREE_CONTROL_EVIDENCE_WORDS
            && legacy.evidenceWords.length === LEGACY_TREE_CONTROL_EVIDENCE_WORDS,
          label + ': default-no-readback comparison changed the 27-word evidence ABI'
        );
        for (let index = 0; index < current.evidenceWords.length; index += 1) {
          if (HOT_DIAGNOSTIC_EVIDENCE_WORDS.has(index)) {
            requireTrue(
              current.evidenceWords[index] === 0,
              label + ': default production route populated diagnostic word ' + index
            );
            continue;
          }
          requireTrue(
            current.evidenceWords[index] === legacy.evidenceWords[index],
            label + ': control evidence word ' + index + ' diverged: '
              + current.evidenceWords[index] + ' !== ' + legacy.evidenceWords[index]
          );
        }
        const legacyDiagnosticTotal = [...HOT_DIAGNOSTIC_EVIDENCE_WORDS].reduce(
          (total, index) => total + legacy.evidenceWords[index],
          0
        );
        requireTrue(
          legacyDiagnosticTotal > 0,
          label + ': historical global-atomic control did not exercise diagnostics'
        );
      }

      function verifyCanonicalTree({ generation, directoryWords, treeWords }) {
        const directory = generation.execution;
        const tree = generation.exactNearCellTree;
        const treeFloats = new Float32Array(treeWords.buffer);
        const treeHeader = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS;
        const treeNodeWords = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS;
        const valid = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_VALID;
        const leaf = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_LEAF;
        const internal = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_INTERNAL;
        const ready = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_READY;
        const admitted = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_STATUS_ADMITTED;
        requireTrue(treeWords[0] === treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_MAGIC,
          'tree magic mismatch');
        requireTrue(treeWords[1] === treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_VERSION,
          'tree ABI version mismatch');
        requireTrue((treeWords[2] & (ready | admitted)) === (ready | admitted),
          `tree is not ready/admitted: ${treeWords[2]}`);
        requireTrue(treeWords[3] === directory.generationId
          && treeWords[4] === directory.deviceOrdinal
          && treeWords[5] === directory.laneOrdinal
          && treeWords[6] === directory.leaseToken
          && treeWords[7] === directory.sourceFamilyId
          && treeWords[8] === directory.storageGeneration
          && treeWords[9] === directory.physicsTick
          && treeWords[10] === directory.physicsSubstep
          && treeWords[11] === directory.positionEpoch
          && treeWords[12] === directory.topologyEpoch
          && treeWords[13] === directory.chartEpoch
          && treeWords[14] === directory.levelEpoch
          && treeWords[15] === directory.supportEpoch,
        'tree identity diverged from canonical directory execution');
        requireTrue(treeWords[16] === directory.sourceCount
          && treeWords[17] === directory.sourceCapacity
          && treeWords[18] === directoryWords[18]
          && treeWords[19] === directory.layout.cellCapacity
          && treeWords[24] === directory.layout.wordLength
          && treeWords[25] === directory.layout.cellKeysOffsetWords
          && treeWords[26] === directory.layout.cellOffsetsOffsetWords
          && treeWords[27] === directory.layout.cellMembersOffsetWords
          && treeWords[28] === directory.layout.particleToCellOffsetWords
          && treeWords[29] === directoryWords[35],
        'tree directory lineage mismatch');
        requireTrue(treeWords[30] === treeWords[18]
          && treeWords[31] === 0
          && treeWords[32] === 0
          && treeWords[33] === treeNodeWords,
        'tree completion/header counters rejected');
        const cellCount = treeWords[18];
        const leafCapacity = treeWords[20];
        const nodeCapacity = treeWords[21];
        const nodeOffset = treeWords[22];
        const leafOffset = leafCapacity - 1;
        requireTrue(nodeOffset === treeHeader
          && nodeCapacity === leafCapacity * 2 - 1
          && nodeCapacity === tree.layout.nodeCapacity
          && treeWords.length === tree.layout.wordLength,
        'tree topology/capacity mismatch');
        const node = (index) => {
          const base = nodeOffset + index * treeNodeWords;
          return {
            minimum: [treeFloats[base], treeFloats[base + 1], treeFloats[base + 2]],
            maximum: [treeFloats[base + 3], treeFloats[base + 4], treeFloats[base + 5]],
            status: treeWords[base + 6],
            cellIndex: treeWords[base + 7]
          };
        };
        const memberSet = new Set();
        for (let cellIndex = 0; cellIndex < leafCapacity; cellIndex += 1) {
          const leafNode = node(leafOffset + cellIndex);
          if (cellIndex >= cellCount) {
            requireTrue((leafNode.status & valid) === 0,
              `unused leaf ${cellIndex} became valid`);
            continue;
          }
          requireTrue((leafNode.status & (valid | leaf | internal)) === (valid | leaf),
            `leaf ${cellIndex} status was not exact leaf`);
          requireTrue(leafNode.cellIndex === cellIndex,
            `leaf ${cellIndex} maps to ${leafNode.cellIndex}`);
          const key = directory.layout.cellKeysOffsetWords
            + cellIndex * epochAbi.SCHROEDER_SPATIAL_EPOCH_KEY_WORDS;
          const level = decodeSigned(directoryWords[key + 1]);
          const coordinate = [
            decodeSigned(directoryWords[key + 2]),
            decodeSigned(directoryWords[key + 3]),
            decodeSigned(directoryWords[key + 4])
          ];
          const spacing = H * (2 ** level);
          for (let axis = 0; axis < 3; axis += 1) {
            const rawMinimum = coordinate[axis] * spacing;
            const rawMaximum = rawMinimum + spacing;
            requireTrue(leafNode.minimum[axis] <= rawMinimum + 0.00002,
              `leaf ${cellIndex} misses its raw minimum on axis ${axis}`);
            requireTrue(leafNode.maximum[axis] >= rawMaximum - 0.00002,
              `leaf ${cellIndex} misses its raw maximum on axis ${axis}`);
          }
          const begin = directoryWords[directory.layout.cellOffsetsOffsetWords + cellIndex];
          const end = directoryWords[directory.layout.cellOffsetsOffsetWords + cellIndex + 1];
          requireTrue(begin < end && end <= directory.sourceCount,
            `directory span ${cellIndex} is invalid: ${begin}..${end}`);
          for (let offset = begin; offset < end; offset += 1) {
            const member = directoryWords[directory.layout.cellMembersOffsetWords + offset];
            requireTrue(member < directory.sourceCount && !memberSet.has(member),
              `directory member ${member} is duplicate or out of range`);
            memberSet.add(member);
          }
        }
        requireTrue(memberSet.size === directory.sourceCount,
          `directory/tree leaf membership covered ${memberSet.size}/${directory.sourceCount}`);
        for (let parent = leafOffset - 1; parent >= 0; parent -= 1) {
          const parentNode = node(parent);
          const left = node(parent * 2 + 1);
          const right = node(parent * 2 + 2);
          const leftValid = (left.status & valid) !== 0;
          const rightValid = (right.status & valid) !== 0;
          if (!leftValid && !rightValid) {
            requireTrue((parentNode.status & valid) === 0,
              `empty parent ${parent} became valid`);
            continue;
          }
          requireTrue((parentNode.status & (valid | leaf | internal)) === (valid | internal),
            `parent ${parent} status was not exact internal`);
          for (let axis = 0; axis < 3; axis += 1) {
            const expectedMinimum = leftValid && rightValid
              ? Math.min(left.minimum[axis], right.minimum[axis])
              : (leftValid ? left.minimum[axis] : right.minimum[axis]);
            const expectedMaximum = leftValid && rightValid
              ? Math.max(left.maximum[axis], right.maximum[axis])
              : (leftValid ? left.maximum[axis] : right.maximum[axis]);
            closeEnough(parentNode.minimum[axis], expectedMinimum,
              `parent ${parent} minimum axis ${axis}`);
            closeEnough(parentNode.maximum[axis], expectedMaximum,
              `parent ${parent} maximum axis ${axis}`);
          }
        }
        return { cellCount, leafCapacity, nodeCapacity, treeDepth: treeWords[23] };
      }

      function verifyConsumerVisibleTreeParity(activeWords, staticWords) {
        const treeHeader = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_HEADER_WORDS;
        const treeNodeWords = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_WORDS;
        const valid = treeAbi.SCHROEDER_SPATIAL_EXACT_NEAR_CELL_TREE_NODE_VALID;
        requireTrue(activeWords.length === staticWords.length,
          'active/static tree word lengths diverged');
        for (let word = 0; word < treeHeader; word += 1) {
          requireTrue(activeWords[word] === staticWords[word],
            `active/static tree header word ${word} diverged`);
        }
        const nodeCapacity = activeWords[21];
        const nodeOffset = activeWords[22];
        for (let nodeIndex = 0; nodeIndex < nodeCapacity; nodeIndex += 1) {
          const base = nodeOffset + nodeIndex * treeNodeWords;
          const activeStatus = activeWords[base + 6];
          const staticStatus = staticWords[base + 6];
          requireTrue(
            (activeStatus & valid) === (staticStatus & valid),
            `active/static node ${nodeIndex} valid-bit diverged`
          );
          if ((activeStatus & valid) === 0) continue;
          for (let word = 0; word < treeNodeWords; word += 1) {
            requireTrue(
              activeWords[base + word] === staticWords[base + word],
              `active/static valid node ${nodeIndex} word ${word} diverged`
            );
          }
        }
      }

      function bruteForceRows(spec) {
        return spec.particles.map((entry, selfIndex) => {
          let bestPartner = -1;
          let bestDistance = Number.POSITIVE_INFINITY;
          for (const [otherIndex, other] of spec.particles.entries()) {
            if (otherIndex === selfIndex || entry.material === other.material) continue;
            const dx = entry.current[0] - other.current[0];
            const dy = entry.current[1] - other.current[1];
            const dz = entry.current[2] - other.current[2];
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            if (
              distanceSquared <= R * R
              && (
                distanceSquared < bestDistance
                || (distanceSquared === bestDistance && otherIndex < bestPartner)
              )
            ) {
              bestPartner = otherIndex;
              bestDistance = distanceSquared;
            }
          }
          if (bestPartner < 0) return [-1, -1, 0, 3.402823e38];
          return [
            bestPartner,
            0,
            entry.material === 'a' ? 1 : 2,
            Math.fround(bestDistance)
          ];
        });
      }

      async function releaseGeneration(deviceForRelease, generation) {
        if (!generation?.selected) return false;
        const scheduled = spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          deviceForRelease
        );
        requireTrue(scheduled === true, 'generation queue-fence retirement was not scheduled');
        await deviceForRelease.queue.onSubmittedWorkDone();
        requireTrue(await generation.releasePromise === true,
          `generation release was not confirmed: ${generation.releaseStatus}`);
        return true;
      }

      function buildGeneration(deviceForGeneration, resources, label, directArenaCount, recorder = null) {
        return spatial.runSchroederSpatialEpochGenerationWebGpu({
          device: deviceForGeneration,
          activeNodeList: resources.activeNodeList,
          particleCount: resources.packed.particleCount,
          particleIdentityBuffer: resources.upload.identityBuffer,
          particleIdentityStrideWords: 1,
          laneId: `native-exact-cell-${label}`,
          sourceFamily: `native-exact-cell-${label}`,
          directArenaCount,
          mechanicsLevels: [],
          gpuTimestampRecorder: recorder
        });
      }

      async function runFixture(spec, ordinal) {
        const resources = createFixtureResources(device, spec, ordinal);
        const timestamps = createTimestampRecorder(
          device,
          `ulg-native-exact-cell-${spec.name}-${ordinal}`
        );
        let generation = null;
        let proposal = null;
        let legacyTreeReference = null;
        try {
          generation = buildGeneration(
            device,
            resources,
            `${spec.name}-${ordinal}`,
            1,
            timestamps.recorder
          );
          requireTrue(generation.ready === true && generation.selected === true,
            `${spec.name}: generation rejected: ${generation.status}: ${generation.reason || 'no reason'}`);
          await device.queue.onSubmittedWorkDone();
          const directoryWords = new Uint32Array(await readBuffer(
            device,
            generation.execution.directoryBuffer,
            generation.execution.layout.byteLength,
            `ulg-native-exact-cell-${spec.name}-${ordinal}-directory`
          ));
          const treeWords = new Uint32Array(await readBuffer(
            device,
            generation.exactNearCellTree.treeBuffer,
            generation.exactNearCellTree.layout.byteLength,
            `ulg-native-exact-cell-${spec.name}-${ordinal}-tree`
          ));
          const treeProof = verifyCanonicalTree({ generation, directoryWords, treeWords });
          proposal = await discovery.runSchroederSpatialReactionDiscoveryProposalWebGpu({
            device,
            generation,
            sphParticleState: resources.packed,
            sphParticleUpload: resources.upload,
            reactionTable,
            observeGpuEvidence: true,
            gpuTimestampRecorder: timestamps.recorder
          });
          await device.queue.onSubmittedWorkDone();
          const actual = new Float32Array(await readBuffer(
            device,
            proposal.proposalBuffer,
            proposal.proposalBufferByteLength,
            `ulg-native-exact-cell-${spec.name}-${ordinal}-proposal`
          ));
          const direct = await runDirectDirectoryControl({
            deviceForControl: device,
            generation,
            reference: proposal,
            label: 'ulg-native-exact-cell-' + spec.name + '-' + ordinal
          });
          legacyTreeReference = createDirectShadowReference({
            deviceForControl: device,
            generation,
            resources,
            label: 'ulg-native-exact-cell-' + spec.name + '-' + ordinal
              + '-legacy-tree-reference'
          });
          const ruleIndexUploadByteParity =
            await requireProductionRuleIndexUploadParity({
              deviceForRead: device,
              proposal,
              reference: legacyTreeReference,
              label: 'ulg-native-exact-cell-' + spec.name + '-' + ordinal
            });
          requireTrue(
            proposal.reactionRuleIndex.mode === 'material-pair-indexed'
              && proposal.reactionRecordUploadByteLength
                === legacyTreeReference.reactionRecordUpload.byteLength
              && proposal.reactionRuleIndex.pairCount
                === legacyTreeReference.reactionRuleIndex.pairCount
              && proposal.reactionRuleIndex.ruleCount
                === legacyTreeReference.reactionRuleIndex.ruleCount,
            spec.name + ': legacy tree control index diverged from production'
          );
          const aggregateRaw = await readProductionTreeResult({
            deviceForRead: device,
            proposal,
            label: 'ulg-native-exact-cell-' + spec.name + '-' + ordinal
              + '-aggregate'
          });
          const legacyTree = await runLegacyUnaggregatedTreeControl({
            deviceForControl: device,
            generation,
            reference: legacyTreeReference,
            label: 'ulg-native-exact-cell-' + spec.name + '-' + ordinal
              + '-legacy-tree'
          });
          requireAggregateLegacyTreeParity({
            aggregate: aggregateRaw,
            legacy: legacyTree,
            label: spec.name + ': aggregate/legacy tree'
          });
          const expected = bruteForceRows(spec);
          for (const [index, expectedRow] of expected.entries()) {
            const offset = index * 4;
            requireTrue(actual[offset] === expectedRow[0]
              && actual[offset + 1] === expectedRow[1]
              && actual[offset + 2] === expectedRow[2],
            `${spec.name}: proposal identity mismatch at ${index}: expected ${expectedRow}, actual ${Array.from(actual.slice(offset, offset + 4))}`);
            closeEnough(actual[offset + 3], expectedRow[3],
              `${spec.name}: proposal distance at ${index}`);
          }
          for (const [index, expectedRow] of expected.entries()) {
            const offset = index * 4;
            requireTrue(
              direct.rows[offset] === actual[offset]
                && direct.rows[offset + 1] === actual[offset + 1]
                && direct.rows[offset + 2] === actual[offset + 2],
              spec.name + ': direct/tree proposal identity mismatch at ' + index
            );
            closeEnough(
              direct.rows[offset + 3],
              actual[offset + 3],
              spec.name + ': direct/tree proposal distance at ' + index
            );
            requireTrue(
              direct.rows[offset] === expectedRow[0]
                && direct.rows[offset + 1] === expectedRow[1]
                && direct.rows[offset + 2] === expectedRow[2],
              spec.name + ': direct proposal identity mismatch at ' + index
            );
            closeEnough(
              direct.rows[offset + 3],
              expectedRow[3],
              spec.name + ': direct proposal distance at ' + index
            );
          }
          const evidence = proposal.observedEvidence;
          requireTrue(evidence.sourceDispatchCount === spec.particles.length
            && evidence.directoryAdmissionCount === spec.particles.length
            && evidence.directoryRejectionCount === 0
            && evidence.malformedTraversalCount === 0
            && evidence.sourceIdentityRejectionCount === 0
            && evidence.overflowCount === 0
            && evidence.privateLookupBuildCount === 0
            && evidence.exactCellTreeNodeVisitCount > 0
            && evidence.exactCellTreeLeafVisitCount > 0
            && evidence.exactCellTreeMemberVisitCount >= evidence.candidateVisitCount,
          `${spec.name}: exact-cell evidence rejected: ${JSON.stringify(evidence)}`);
          const directEvidence = direct.evidence;
          requireTrue(
            directEvidence.sourceDispatchCount === spec.particles.length
              && directEvidence.directoryAdmissionCount === spec.particles.length
              && directEvidence.directoryRejectionCount === 0
              && directEvidence.malformedTraversalCount === 0
              && directEvidence.sourceIdentityRejectionCount === 0
              && directEvidence.privateLookupBuildCount === 0
              && directEvidence.overflowCount === 0
              && directEvidence.exactCellTreeNodeVisitCount === 0
              && directEvidence.exactCellTreeLeafVisitCount === 0
              && directEvidence.exactCellTreeMemberVisitCount === 0
              && directEvidence.directRangeLookupVisitCount > 0
              && directEvidence.directCellVisitCount > 0
              && directEvidence.directMemberVisitCount
                >= directEvidence.candidateVisitCount
              && directEvidence.ruleIndexPairLookupCount > 0
              && directEvidence.ruleIndexRuleVisitCount > 0,
            spec.name + ': direct shadow evidence rejected: '
              + JSON.stringify(directEvidence)
          );
          requireTrue(
            Number.isFinite(direct.candidateTraversalMs)
              && direct.candidateTraversalMs > 0,
            spec.name + ': direct shadow candidate timestamp was missing'
          );
          let directCorruptHeaderFailClosed = false;
          if (spec.name === 'sparse') {
            device.queue.writeBuffer(
              generation.exactNearCellTree.treeBuffer,
              2 * Uint32Array.BYTES_PER_ELEMENT,
              new Uint32Array([0])
            );
            await device.queue.onSubmittedWorkDone();
            const corruptedDirect = await runDirectDirectoryControl({
              deviceForControl: device,
              generation,
              reference: proposal,
              label: 'ulg-native-exact-cell-' + spec.name + '-' + ordinal + '-corrupt'
            });
            const invalidRows = [...Array(spec.particles.length).keys()].every((index) => {
              const offset = index * 4;
              return corruptedDirect.rows[offset] === -1
                && corruptedDirect.rows[offset + 1] === -1
                && corruptedDirect.rows[offset + 2] === 0;
            });
            requireTrue(
              corruptedDirect.evidence.sourceDispatchCount === spec.particles.length
                && corruptedDirect.evidence.directoryAdmissionCount === 0
                && corruptedDirect.evidence.directoryRejectionCount
                  === spec.particles.length
                && corruptedDirect.evidence.sealedRowCount === spec.particles.length
                && corruptedDirect.evidence.exactCellTreeNodeVisitCount === 0
                && corruptedDirect.evidence.directRangeLookupVisitCount === 0
                && invalidRows,
              'corrupt tree header did not fail close the direct shadow control: '
                + JSON.stringify(corruptedDirect.evidence)
            );
            directCorruptHeaderFailClosed = true;
          }
          const timing = await timestamps.complete();
          requireTrue(Number.isFinite(timing['exact-near-cell-tree-build'])
            && timing['exact-near-cell-tree-build'] > 0
            && Number.isFinite(timing['candidate-traversal'])
            && timing['candidate-traversal'] > 0,
          `${spec.name}: missing native tree/reaction timestamps: ${JSON.stringify(timing)}`);
          const maximumDisplacement = floatFromBits(evidence.maximumDisplacementBits);
          if (spec.name === 'current-source-r-plus-d-displacement') {
            requireTrue(maximumDisplacement >= 0.8124,
              `current-source displacement certificate was too small: ${maximumDisplacement}`);
          }
          return {
            name: spec.name,
            order: 'tree-direct',
            particleCount: spec.particles.length,
            tree: treeProof,
            evidence: {
              candidateVisitCount: evidence.candidateVisitCount,
              exactCellTreeNodeVisitCount: evidence.exactCellTreeNodeVisitCount,
              exactCellTreeLeafVisitCount: evidence.exactCellTreeLeafVisitCount,
              exactCellTreeMemberVisitCount: evidence.exactCellTreeMemberVisitCount,
              maximumDisplacement
            },
            direct: {
              candidateTraversalMs: direct.candidateTraversalMs,
              rangeLookupVisitCount: directEvidence.directRangeLookupVisitCount,
              cellVisitCount: directEvidence.directCellVisitCount,
              memberVisitCount: directEvidence.directMemberVisitCount,
              candidateVisitCount: directEvidence.candidateVisitCount,
              corruptHeaderFailClosed: directCorruptHeaderFailClosed
            },
            ruleIndexUploadByteParity,
            legacyTreeEvidenceParity: true,
            timing
          };
        } finally {
          legacyTreeReference?.destroy();
          proposal?.destroy();
          if (generation) await releaseGeneration(device, generation);
          timestamps.destroy();
          resources.destroy();
        }
      }

      async function runDirectFirstComparisonSample(spec, ordinal) {
        const resources = createFixtureResources(device, spec, ordinal);
        const treeBuildTimestamps = createTimestampRecorder(
          device,
          'ulg-native-exact-cell-direct-first-build-' + ordinal,
          ['exact-near-cell-tree-build']
        );
        const treeCandidateTimestamps = createTimestampRecorder(
          device,
          'ulg-native-exact-cell-direct-first-tree-' + ordinal,
          ['candidate-traversal']
        );
        let generation = null;
        let shadowReference = null;
        let treeProposal = null;
        try {
          generation = buildGeneration(
            device,
            resources,
            'direct-first-' + ordinal,
            1,
            treeBuildTimestamps.recorder
          );
          requireTrue(generation.ready === true && generation.selected === true,
            'direct-first generation rejected: ' + generation.status);
          await device.queue.onSubmittedWorkDone();
          shadowReference = createDirectShadowReference({
            deviceForControl: device,
            generation,
            resources,
            label: 'ulg-native-exact-cell-direct-first-shadow-' + ordinal
          });
          const direct = await runDirectDirectoryControl({
            deviceForControl: device,
            generation,
            reference: shadowReference,
            label: 'ulg-native-exact-cell-direct-first-' + ordinal
          });
          shadowReference.destroy();
          treeProposal = await discovery.runSchroederSpatialReactionDiscoveryProposalWebGpu({
            device,
            generation,
            sphParticleState: resources.packed,
            sphParticleUpload: resources.upload,
            reactionTable,
            observeGpuEvidence: true,
            gpuTimestampRecorder: treeCandidateTimestamps.recorder
          });
          requireTrue(
            treeProposal.reactionRuleIndex.mode === 'material-pair-indexed'
              && treeProposal.reactionRecordUploadByteLength
                === shadowReference.reactionRecordUpload.byteLength
              && treeProposal.reactionRuleIndex.pairCount
                === shadowReference.reactionRuleIndex.pairCount
              && treeProposal.reactionRuleIndex.ruleCount
                === shadowReference.reactionRuleIndex.ruleCount,
            'direct-first shadow index diverged from the production material-pair index'
          );
          const treeRows = new Float32Array(await readBuffer(
            device,
            treeProposal.proposalBuffer,
            treeProposal.proposalBufferByteLength,
            'ulg-native-exact-cell-direct-first-tree-rows-' + ordinal
          ));
          const expected = bruteForceRows(spec);
          for (const [index, expectedRow] of expected.entries()) {
            const offset = index * 4;
            requireTrue(
              direct.rows[offset] === treeRows[offset]
                && direct.rows[offset + 1] === treeRows[offset + 1]
                && direct.rows[offset + 2] === treeRows[offset + 2]
                && treeRows[offset] === expectedRow[0]
                && treeRows[offset + 1] === expectedRow[1]
                && treeRows[offset + 2] === expectedRow[2],
              'direct-first proposal identity parity failed at ' + index
            );
            closeEnough(
              direct.rows[offset + 3],
              treeRows[offset + 3],
              'direct-first direct/tree distance at ' + index
            );
            closeEnough(
              treeRows[offset + 3],
              expectedRow[3],
              'direct-first tree/oracle distance at ' + index
            );
          }
          const directEvidence = direct.evidence;
          const treeEvidence = treeProposal.observedEvidence;
          requireTrue(
            directEvidence.directRangeLookupVisitCount > 0
              && directEvidence.directCellVisitCount > 0
              && directEvidence.directMemberVisitCount
                >= directEvidence.candidateVisitCount
              && directEvidence.exactCellTreeNodeVisitCount === 0
              && directEvidence.overflowCount === 0
              && treeEvidence.exactCellTreeNodeVisitCount > 0
              && treeEvidence.exactCellTreeMemberVisitCount
                >= treeEvidence.candidateVisitCount
              && treeEvidence.overflowCount === 0,
            'direct-first control evidence rejected: '
              + JSON.stringify({ directEvidence, treeEvidence })
          );
          const [treeBuildTiming, treeCandidateTiming] = await Promise.all([
            treeBuildTimestamps.complete(),
            treeCandidateTimestamps.complete()
          ]);
          return {
            name: spec.name,
            order: 'direct-tree',
            timing: {
              'exact-near-cell-tree-build':
                treeBuildTiming['exact-near-cell-tree-build'],
              'candidate-traversal':
                treeCandidateTiming['candidate-traversal']
            },
            direct: {
              candidateTraversalMs: direct.candidateTraversalMs,
              rangeLookupVisitCount: directEvidence.directRangeLookupVisitCount,
              cellVisitCount: directEvidence.directCellVisitCount,
              memberVisitCount: directEvidence.directMemberVisitCount,
              candidateVisitCount: directEvidence.candidateVisitCount
            }
          };
        } finally {
          treeProposal?.destroy();
          shadowReference?.destroy();
          if (generation) await releaseGeneration(device, generation);
          treeBuildTimestamps.destroy();
          treeCandidateTimestamps.destroy();
          resources.destroy();
        }
      }

      async function runAggregateLegacyComparisonSample(
        spec,
        order,
        ordinal,
        { observeGpuEvidence = true } = {}
      ) {
        const resources = createFixtureResources(device, spec, ordinal);
        const buildTimestamps = createTimestampRecorder(
          device,
          'ulg-s9d-hot-counter-build-' + spec.name + '-' + ordinal,
          ['exact-near-cell-tree-build']
        );
        const reactionStages = [
          'spatial-displacement-certificate',
          'candidate-traversal',
          'proposal-seal'
        ];
        let generation = null;
        let reference = null;
        try {
          generation = buildGeneration(
            device,
            resources,
            'hot-counter-' + spec.name + '-' + ordinal,
            1,
            buildTimestamps.recorder
          );
          requireTrue(generation.ready === true && generation.selected === true,
            spec.name + ': hot-counter generation rejected: ' + generation.status);
          await device.queue.onSubmittedWorkDone();
          const buildTiming = await buildTimestamps.complete();
          const treeBuildMs = buildTiming['exact-near-cell-tree-build'];
          requireTrue(Number.isFinite(treeBuildMs) && treeBuildMs > 0,
            spec.name + ': hot-counter tree build timestamp was missing');
          reference = createDirectShadowReference({
            deviceForControl: device,
            generation,
            resources,
            label: 'ulg-s9d-hot-counter-' + spec.name + '-' + ordinal + '-reference'
          });
          const runAggregate = async () => {
            const timestamps = createTimestampRecorder(
              device,
              'ulg-s9d-hot-counter-' + spec.name + '-' + ordinal + '-aggregate',
              reactionStages
            );
            let proposal = null;
            try {
              proposal = await discovery.runSchroederSpatialReactionDiscoveryProposalWebGpu({
                device,
                generation,
                sphParticleState: resources.packed,
                sphParticleUpload: resources.upload,
                reactionTable,
                observeGpuEvidence,
                gpuTimestampRecorder: timestamps.recorder
              });
              const ruleIndexUploadByteParity =
                await requireProductionRuleIndexUploadParity({
                  deviceForRead: device,
                  proposal,
                  reference,
                  label: 'ulg-s9d-hot-counter-' + spec.name + '-' + ordinal
                    + '-aggregate'
                });
              const raw = await readProductionTreeResult({
                deviceForRead: device,
                proposal,
                label: 'ulg-s9d-hot-counter-' + spec.name + '-' + ordinal + '-aggregate'
              });
              const timing = await timestamps.complete();
              const reactionRouteMs = reactionStages.reduce(
                (total, stage) => total + timing[stage],
                0
              );
              return Object.freeze({
                ...raw,
                timing,
                reactionRouteMs,
                ruleIndexUploadByteParity,
                evidenceObservationRequested: proposal.evidenceObservationRequested,
                evidenceObservationReadbackByteLength:
                  proposal.evidenceObservationReadbackByteLength,
                reactionRecordUploadByteLength: proposal.reactionRecordUploadByteLength,
                reactionRuleIndex: Object.freeze({
                  mode: proposal.reactionRuleIndex.mode,
                  pairCount: proposal.reactionRuleIndex.pairCount,
                  ruleCount: proposal.reactionRuleIndex.ruleCount
                })
              });
            } finally {
              proposal?.destroy();
              timestamps.destroy();
            }
          };
          const runLegacy = async () => {
            const timestamps = createTimestampRecorder(
              device,
              'ulg-s9d-hot-counter-' + spec.name + '-' + ordinal + '-legacy',
              reactionStages
            );
            try {
              const legacy = await runLegacyUnaggregatedTreeControl({
                deviceForControl: device,
                generation,
                reference,
                label: 'ulg-s9d-hot-counter-' + spec.name + '-' + ordinal + '-legacy',
                gpuTimestampRecorder: timestamps.recorder
              });
              const timing = await timestamps.complete();
              const reactionRouteMs = reactionStages.reduce(
                (total, stage) => total + timing[stage],
                0
              );
              return Object.freeze({ ...legacy, timing, reactionRouteMs });
            } finally {
              timestamps.destroy();
            }
          };
          let aggregate;
          let legacy;
          if (order === 'aggregate-legacy') {
            aggregate = await runAggregate();
            legacy = await runLegacy();
          } else {
            legacy = await runLegacy();
            aggregate = await runAggregate();
          }
          requireTrue(
            aggregate.reactionRecordUploadByteLength
              === reference.reactionRecordUpload.byteLength
              && aggregate.reactionRuleIndex.mode === 'material-pair-indexed'
              && aggregate.reactionRuleIndex.pairCount === reference.reactionRuleIndex.pairCount
              && aggregate.reactionRuleIndex.ruleCount === reference.reactionRuleIndex.ruleCount
              && aggregate.ruleIndexUploadByteParity === true
              && aggregate.evidenceObservationRequested === observeGpuEvidence
              && aggregate.evidenceObservationReadbackByteLength
                === (observeGpuEvidence
                  ? LEGACY_TREE_CONTROL_EVIDENCE_WORDS
                    * Uint32Array.BYTES_PER_ELEMENT
                  : 0),
            spec.name + ': aggregate route material-pair index diverged from legacy reference'
          );
          if (observeGpuEvidence) {
            requireAggregateLegacyTreeParity({
              aggregate,
              legacy,
              label: spec.name + ': observed aggregate/legacy AB/BA parity'
            });
          } else {
            requireDefaultNoReadbackLegacyParity({
              current: aggregate,
              legacy,
              label: spec.name + ': default-no-readback/legacy AB/BA parity'
            });
          }
          return Object.freeze({
            name: spec.name,
            order,
            observeGpuEvidence,
            treeBuildMs,
            aggregate,
            legacy
          });
        } finally {
          reference?.destroy();
          if (generation) await releaseGeneration(device, generation);
          buildTimestamps.destroy();
          resources.destroy();
        }
      }

      async function proveAggregatedHotCounterOverflowFailsClosed() {
        const spec = aggregationPerformanceFixtures.find((entry) => (
          entry.name === 'dense-contention'
        ));
        requireTrue(spec != null, 'hot-counter overflow fixture was missing');
        const resources = createFixtureResources(device, spec, 3900);
        let generation = null;
        let reference = null;
        try {
          generation = buildGeneration(
            device,
            resources,
            'hot-counter-overflow',
            1
          );
          requireTrue(
            generation.ready === true && generation.selected === true,
            'hot-counter overflow generation was rejected'
          );
          await device.queue.onSubmittedWorkDone();
          reference = createDirectShadowReference({
            deviceForControl: device,
            generation,
            resources,
            label: 'ulg-s9d-hot-counter-overflow-reference'
          });
          const overflow = await runLegacyUnaggregatedTreeControl({
            deviceForControl: device,
            generation,
            reference,
            label: 'ulg-s9d-hot-counter-overflow',
            productionAggregation: true,
            seedEvidence(words) {
              // One real tree-node visit must overflow this global aggregate
              // destination. The unmodified production aggregation shader
              // must publish the overflow bit and the seal pass must erase
              // every proposal row.
              words[24] = 0xffffffff;
            }
          });
          const invalidRows = [...Array(spec.particles.length).keys()].every((index) => {
            const offset = index * 4;
            return overflow.rows[offset] === -1
              && overflow.rows[offset + 1] === -1
              && overflow.rows[offset + 2] === 0;
          });
          requireTrue(
            overflow.evidence.overflowCount === 1
              && overflow.evidence.malformedTraversalCount > 0
              && overflow.evidence.sealedRowCount === spec.particles.length
              && invalidRows,
            'aggregated hot-counter overflow did not fail closed: '
              + JSON.stringify(overflow.evidence)
          );
          return Object.freeze({
            overflowCount: overflow.evidence.overflowCount,
            malformedTraversalCount: overflow.evidence.malformedTraversalCount,
            sealedRowCount: overflow.evidence.sealedRowCount,
            invalidRows
          });
        } finally {
          reference?.destroy();
          if (generation) await releaseGeneration(device, generation);
          resources.destroy();
        }
      }

      async function proveFullRuleScanHotCounterParity() {
        const spec = aggregationPerformanceFixtures.find((entry) => (
          entry.name === 'dense-contention'
        ));
        requireTrue(spec != null, 'full-rule-scan aggregation fixture was missing');
        const resources = createFixtureResources(device, spec, 3950);
        let generation = null;
        try {
          generation = buildGeneration(
            device,
            resources,
            'hot-counter-full-rule-scan',
            1
          );
          requireTrue(
            generation.ready === true && generation.selected === true,
            'full-rule-scan aggregation generation was rejected'
          );
          await device.queue.onSubmittedWorkDone();
          const parity = await proveAggregateLegacyParityForGeneration({
            deviceForControl: device,
            generation,
            resources,
            label: 'full-rule-scan-aggregate-legacy',
            reactionRuleMode: 'full-scan'
          });
          requireTrue(
            parity.fullRuleScanRuleVisitCount > 0,
            'full-rule-scan aggregation parity did not exercise evidence word 19'
          );
          return parity;
        } finally {
          if (generation) await releaseGeneration(device, generation);
          resources.destroy();
        }
      }

      async function proveArenaReuseAndNegatives() {
        const spec = fixtures[0];
        const resources = createFixtureResources(device, spec, 1000);
        let first = null;
        let third = null;
        let staleA = null;
        let staleB = null;
        let corrupted = null;
        try {
          first = buildGeneration(device, resources, 'arena-first', 1);
          requireTrue(first.selected === true, 'first one-arena generation was not selected');
          await device.queue.onSubmittedWorkDone();
          let backpressure = null;
          try {
            backpressure = buildGeneration(device, resources, 'arena-backpressure', 1);
          } catch (error) {
            backpressure = { selected: false, reason: error.message };
          }
          requireTrue(backpressure?.selected === false,
            `one-arena build did not fail closed under backpressure: ${JSON.stringify(backpressure)}`);
          const firstTree = first.exactNearCellTree;
          await releaseGeneration(device, first);
          requireTrue(firstTree.released === true,
            'queue-fence release did not retire the first exact-cell tree');
          third = buildGeneration(device, resources, 'arena-third', 1);
          requireTrue(third.selected === true
            && third.exactNearCellTree.arenaIndex === firstTree.arenaIndex
            && third.exactNearCellTree.arenaGeneration > firstTree.arenaGeneration
            && third.exactNearCellTree.treeBuffer === firstTree.treeBuffer,
          'released exact-cell arena was not safely reused with a new generation');
          const arenaReuseAggregationParity =
            await proveAggregateLegacyParityForGeneration({
              deviceForControl: device,
              generation: third,
              resources,
              label: 'arena-reuse-aggregate-legacy'
            });
          await releaseGeneration(device, third);
          third = null;

          staleA = buildGeneration(device, resources, 'stale-a', 2);
          staleB = buildGeneration(device, resources, 'stale-b', 2);
          requireTrue(staleA.selected === true && staleB.selected === true,
            'two-arena stale-tree fixture could not build both epochs');
          await device.queue.onSubmittedWorkDone();
          const retainedTree = staleB.exactNearCellTree;
          const retainedRuntime = staleB.exactNearCellTreeRuntime;
          staleB.exactNearCellTree = staleA.exactNearCellTree;
          staleB.exactNearCellTreeRuntime = staleA.exactNearCellTreeRuntime;
          let staleError = null;
          try {
            await discovery.runSchroederSpatialReactionDiscoveryProposalWebGpu({
              device,
              generation: staleB,
              sphParticleState: resources.packed,
              sphParticleUpload: resources.upload,
              reactionTable,
              observeGpuEvidence: true
            });
          } catch (error) {
            staleError = error;
          } finally {
            staleB.exactNearCellTree = retainedTree;
            staleB.exactNearCellTreeRuntime = retainedRuntime;
          }
          requireTrue(staleError != null
            && /submitted same-epoch exact-near cell tree/.test(staleError.message),
          `foreign tree was not rejected before consumer dispatch: ${staleError?.message}`);
          await releaseGeneration(device, staleA);
          staleA = null;
          await releaseGeneration(device, staleB);
          staleB = null;

          corrupted = buildGeneration(device, resources, 'corrupted-header', 1);
          requireTrue(corrupted.selected === true, 'corruption fixture generation rejected');
          await device.queue.onSubmittedWorkDone();
          device.queue.writeBuffer(
            corrupted.exactNearCellTree.treeBuffer,
            2 * Uint32Array.BYTES_PER_ELEMENT,
            new Uint32Array([0])
          );
          await device.queue.onSubmittedWorkDone();
          const corruptHeaderAggregationParity =
            await proveAggregateLegacyParityForGeneration({
              deviceForControl: device,
              generation: corrupted,
              resources,
              label: 'corrupt-header-aggregate-legacy'
            });
          let corruptionError = null;
          try {
            await discovery.runSchroederSpatialReactionDiscoveryProposalWebGpu({
              device,
              generation: corrupted,
              sphParticleState: resources.packed,
              sphParticleUpload: resources.upload,
              reactionTable,
              observeGpuEvidence: true
            });
          } catch (error) {
            corruptionError = error;
          }
          requireTrue(corruptionError != null
            && /GPU completion evidence was missing or rejected/.test(corruptionError.message),
          `corrupt tree header did not fail closed through compact evidence: ${corruptionError?.message}`);
          await releaseGeneration(device, corrupted);
          corrupted = null;
          return {
            backpressure: backpressure.status || backpressure.reason || 'rejected',
            arenaReuseAggregationParity,
            corruptHeaderAggregationParity
          };
        } finally {
          if (first?.exactNearCellTree?.released !== true) await releaseGeneration(device, first);
          if (third?.exactNearCellTree?.released !== true) await releaseGeneration(device, third);
          if (staleA?.exactNearCellTree?.released !== true) await releaseGeneration(device, staleA);
          if (staleB?.exactNearCellTree?.released !== true) await releaseGeneration(device, staleB);
          if (corrupted?.exactNearCellTree?.released !== true) await releaseGeneration(device, corrupted);
          resources.destroy();
        }
      }

      async function proveDeviceLossQuarantine() {
        const lossAdapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance'
        });
        requireTrue(lossAdapter != null, 'device-loss fixture could not acquire a second adapter');
        const lossDevice = await lossAdapter.requestDevice(
          deviceLimits.webGpuDeviceDescriptorForResidentSph(lossAdapter, {
            timestampProfilingRequested: true
          })
        );
        const resources = createFixtureResources(lossDevice, fixtures[4], 2000);
        let generation = null;
        try {
          generation = buildGeneration(lossDevice, resources, 'device-loss', 1);
          requireTrue(generation.selected === true, 'device-loss fixture generation rejected');
          await lossDevice.queue.onSubmittedWorkDone();
          const aggregationParity =
            await proveAggregateLegacyParityForGeneration({
              deviceForControl: lossDevice,
              generation,
              resources,
              label: 'device-loss-pre-quarantine-aggregate-legacy'
            });
          const lossPromise = lossDevice.lost;
          const retirement = spatial.quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
            generation,
            lossDevice
          );
          lossDevice.destroy();
          const [loss, retired] = await Promise.all([lossPromise, retirement]);
          requireTrue(loss?.reason === 'destroyed' && retired === true
            && generation.exactNearCellTree.released === true,
          `native device-loss tree quarantine failed: ${JSON.stringify({ loss, retired, releaseStatus: generation.releaseStatus })}`);
          requireTrue(generation.releaseOperationResults?.some((entry) => (
            entry.owner === 'spatial-exact-near-cell-tree' && entry.confirmed === true
          )), 'device loss did not confirm exact-cell tree retirement');
          return {
            reason: loss.reason,
            releaseStatus: generation.releaseStatus,
            aggregationParity
          };
        } finally {
          resources.destroy();
        }
      }

      try {
        const fixtureResults = [];
        for (const [index, spec] of fixtures.entries()) {
          fixtureResults.push(await runFixture(spec, index + 1));
        }
        // The control is native-test-only. These measurements are real
        // same-device production-tree versus canonical-directory shadow
        // candidate spans, with common warmup setup excluded from the nine
        // AB/BA/AB samples. No browser/runtime path can select the control.
        const warmupOrders = [
          'tree-direct',
          'direct-tree',
          'tree-direct',
          'direct-tree'
        ];
        const measuredOrders = [
          'tree-direct',
          'direct-tree',
          'tree-direct',
          'direct-tree',
          'tree-direct',
          'direct-tree',
          'tree-direct',
          'direct-tree',
          'tree-direct'
        ];
        const runComparison = async (order, ordinal) => (
          order === 'tree-direct'
            ? runFixture(fixtures[1], ordinal)
            : runDirectFirstComparisonSample(fixtures[1], ordinal)
        );
        const denseWarmups = [];
        for (const [index, order] of warmupOrders.entries()) {
          denseWarmups.push(await runComparison(order, 100 + index));
        }
        const denseMeasurements = [];
        for (const [index, order] of measuredOrders.entries()) {
          denseMeasurements.push(await runComparison(order, 200 + index));
        }
        const comparison = {
          warmupSamples: denseWarmups.length,
          measuredSamples: denseMeasurements.length,
          measuredOrders,
          exactNearCellTreeBuildMedianMs: median(denseMeasurements.map((sample) => (
            sample.timing['exact-near-cell-tree-build']
          ))),
          treeCandidateTraversalMedianMs: median(denseMeasurements.map((sample) => (
            sample.timing['candidate-traversal']
          ))),
          directCandidateTraversalMedianMs: median(denseMeasurements.map((sample) => (
            sample.direct.candidateTraversalMs
          ))),
          treeRouteMedianMs: median(denseMeasurements.map((sample) => (
            sample.timing['exact-near-cell-tree-build']
              + sample.timing['candidate-traversal']
          ))),
          directRangeLookupVisitMedian: median(denseMeasurements.map((sample) => (
            sample.direct.rangeLookupVisitCount
          ))),
          directCellVisitMedian: median(denseMeasurements.map((sample) => (
            sample.direct.cellVisitCount
          ))),
          directMemberVisitMedian: median(denseMeasurements.map((sample) => (
            sample.direct.memberVisitCount
          )))
        };
        comparison.treeCandidateVsDirectRatio =
          comparison.treeCandidateTraversalMedianMs
            / comparison.directCandidateTraversalMedianMs;
        comparison.treeRouteVsDirectRatio =
          comparison.treeRouteMedianMs
            / comparison.directCandidateTraversalMedianMs;
        // This is the S9D-3 receipt. Each pair uses one fresh authenticated
        // generation and the same canonical tree/rule index. The only shader
        // difference is the native-test-only replacement of local diagnostic
        // aggregation with the old globally contended atomic increments.
        const aggregationWarmupOrders = [
          'aggregate-legacy',
          'legacy-aggregate',
          'aggregate-legacy',
          'legacy-aggregate'
        ];
        const aggregationMeasuredOrders = [
          'aggregate-legacy',
          'legacy-aggregate',
          'aggregate-legacy',
          'legacy-aggregate',
          'aggregate-legacy',
          'legacy-aggregate',
          'aggregate-legacy',
          'legacy-aggregate',
          'aggregate-legacy'
        ];
        const runAggregationCampaign = async ({
          observeGpuEvidence,
          ordinalBase
        }) => {
          const results = [];
          for (const [fixtureIndex, spec] of aggregationPerformanceFixtures.entries()) {
            const warmups = [];
            for (const [index, order] of aggregationWarmupOrders.entries()) {
              warmups.push(await runAggregateLegacyComparisonSample(
                spec,
                order,
                ordinalBase + fixtureIndex * 100 + index,
                { observeGpuEvidence }
              ));
            }
            const measurements = [];
            for (const [index, order] of aggregationMeasuredOrders.entries()) {
              measurements.push(await runAggregateLegacyComparisonSample(
                spec,
                order,
                ordinalBase + 20 + fixtureIndex * 100 + index,
                { observeGpuEvidence }
              ));
            }
            const aggregateReactionRouteMedianMs = median(measurements.map((sample) => (
              sample.aggregate.reactionRouteMs
            )));
            const legacyReactionRouteMedianMs = median(measurements.map((sample) => (
              sample.legacy.reactionRouteMs
            )));
            const aggregateCandidateTraversalMedianMs = median(measurements.map((sample) => (
              sample.aggregate.timing['candidate-traversal']
            )));
            const legacyCandidateTraversalMedianMs = median(measurements.map((sample) => (
              sample.legacy.timing['candidate-traversal']
            )));
            const treeBuildMedianMs = median(measurements.map((sample) => sample.treeBuildMs));
            const aggregateCombinedTreeRouteMedianMs = median(
              measurements.map((sample) => (
                sample.treeBuildMs + sample.aggregate.reactionRouteMs
              ))
            );
            const legacyCombinedTreeRouteMedianMs = median(
              measurements.map((sample) => (
                sample.treeBuildMs + sample.legacy.reactionRouteMs
              ))
            );
            results.push({
              name: spec.name,
              observationMode: observeGpuEvidence
                ? 'explicit-diagnostic-observation'
                : 'default-no-readback-production',
              warmupSamples: warmups.length,
              measuredSamples: measurements.length,
              measuredOrders: aggregationMeasuredOrders,
              observationContractExact: measurements.every((sample) => (
                sample.aggregate.evidenceObservationRequested === observeGpuEvidence
                && sample.aggregate.evidenceObservationReadbackByteLength
                  === (observeGpuEvidence
                    ? LEGACY_TREE_CONTROL_EVIDENCE_WORDS
                      * Uint32Array.BYTES_PER_ELEMENT
                    : 0)
                && sample.aggregate.ruleIndexUploadByteParity === true
              )),
              treeBuildMedianMs,
              aggregateDisplacementMedianMs: median(measurements.map((sample) => (
                sample.aggregate.timing['spatial-displacement-certificate']
              ))),
              legacyDisplacementMedianMs: median(measurements.map((sample) => (
                sample.legacy.timing['spatial-displacement-certificate']
              ))),
              aggregateCandidateTraversalMedianMs,
              legacyCandidateTraversalMedianMs,
              aggregateSealMedianMs: median(measurements.map((sample) => (
                sample.aggregate.timing['proposal-seal']
              ))),
              legacySealMedianMs: median(measurements.map((sample) => (
                sample.legacy.timing['proposal-seal']
              ))),
              aggregateReactionRouteMedianMs,
              legacyReactionRouteMedianMs,
              aggregateCombinedTreeRouteMedianMs,
              legacyCombinedTreeRouteMedianMs,
              aggregateCandidateVsLegacyRatio:
                aggregateCandidateTraversalMedianMs / legacyCandidateTraversalMedianMs,
              aggregateReactionRouteVsLegacyRatio:
                aggregateReactionRouteMedianMs / legacyReactionRouteMedianMs,
              aggregateCombinedTreeRouteVsLegacyRatio:
                aggregateCombinedTreeRouteMedianMs
                  / legacyCombinedTreeRouteMedianMs
            });
          }
          return results;
        };
        const aggregationComparison = await runAggregationCampaign({
          observeGpuEvidence: true,
          ordinalBase: 3000
        });
        const defaultNoReadbackHistoricalAtomicComparison =
          await runAggregationCampaign({
            observeGpuEvidence: false,
            ordinalBase: 5000
          });
        const hotCounterOverflow =
          await proveAggregatedHotCounterOverflowFailsClosed();
        const fullRuleScanHotCounterParity =
          await proveFullRuleScanHotCounterParity();
        const lifecycle = await proveArenaReuseAndNegatives();
        const deviceLoss = await proveDeviceLossQuarantine();
        const errorScopes = [
          await device.popErrorScope(),
          await device.popErrorScope(),
          await device.popErrorScope()
        ].filter(Boolean);
        requireTrue(errorScopes.length === 0 && uncapturedErrors.length === 0,
          `native WebGPU validation errors: ${JSON.stringify({ errorScopes, uncapturedErrors })}`);
        return {
          status: 'complete',
          fixtures: fixtureResults,
          comparison,
          aggregationComparison,
          defaultNoReadbackHistoricalAtomicComparison,
          hotCounterOverflow,
          fullRuleScanHotCounterParity,
          lifecycle,
          deviceLoss
        };
      } finally {
        discovery.destroySchroederSpatialReactionDiscoveryProposalCache(device);
      }
    });

    assert.equal(native.status, 'complete', native.reason || JSON.stringify(native));
    assert.equal(native.fixtures.length, 6);
    assert.ok(native.fixtures.every((fixture) => (
      fixture.tree.cellCount > 0
      && fixture.tree.nodeCapacity >= fixture.tree.leafCapacity
      && fixture.evidence.exactCellTreeNodeVisitCount > 0
      && fixture.evidence.exactCellTreeMemberVisitCount
        >= fixture.evidence.candidateVisitCount
      && fixture.direct.rangeLookupVisitCount > 0
      && fixture.direct.memberVisitCount >= fixture.direct.candidateVisitCount
      && fixture.ruleIndexUploadByteParity === true
      && fixture.legacyTreeEvidenceParity === true
    )), JSON.stringify(native));
    assert.equal(native.comparison.warmupSamples, 4, JSON.stringify(native));
    assert.equal(native.comparison.measuredSamples, 9, JSON.stringify(native));
    assert.equal(native.comparison.measuredOrders.filter((order) => (
      order === 'tree-direct'
    )).length, 5, JSON.stringify(native));
    assert.equal(native.comparison.measuredOrders.filter((order) => (
      order === 'direct-tree'
    )).length, 4, JSON.stringify(native));
    assert.ok(native.comparison.exactNearCellTreeBuildMedianMs > 0, JSON.stringify(native));
    assert.ok(native.comparison.treeCandidateTraversalMedianMs > 0, JSON.stringify(native));
    assert.ok(native.comparison.directCandidateTraversalMedianMs > 0, JSON.stringify(native));
    assert.ok(native.comparison.directRangeLookupVisitMedian > 0, JSON.stringify(native));
    assert.ok(native.comparison.directMemberVisitMedian > 0, JSON.stringify(native));
    const aggregationCampaigns = [
      {
        label: 'observed diagnostic aggregation',
        mode: 'explicit-diagnostic-observation',
        values: native.aggregationComparison
      },
      {
        label: 'default no-readback production',
        mode: 'default-no-readback-production',
        values: native.defaultNoReadbackHistoricalAtomicComparison
      }
    ];
    for (const campaign of aggregationCampaigns) {
      assert.equal(campaign.values.length, 3, JSON.stringify(native));
      for (const comparisonResult of campaign.values) {
        assert.equal(comparisonResult.observationMode, campaign.mode, JSON.stringify(native));
        assert.equal(comparisonResult.observationContractExact, true, JSON.stringify(native));
        assert.equal(comparisonResult.warmupSamples, 4, JSON.stringify(native));
        assert.equal(comparisonResult.measuredSamples, 9, JSON.stringify(native));
        assert.equal(comparisonResult.measuredOrders.filter((order) => (
          order === 'aggregate-legacy'
        )).length, 5, JSON.stringify(native));
        assert.equal(comparisonResult.measuredOrders.filter((order) => (
          order === 'legacy-aggregate'
        )).length, 4, JSON.stringify(native));
        assert.ok(comparisonResult.treeBuildMedianMs > 0, JSON.stringify(native));
        assert.ok(comparisonResult.aggregateCandidateTraversalMedianMs > 0,
          JSON.stringify(native));
        assert.ok(comparisonResult.legacyCandidateTraversalMedianMs > 0,
          JSON.stringify(native));
        assert.ok(comparisonResult.aggregateReactionRouteMedianMs > 0,
          JSON.stringify(native));
        assert.ok(comparisonResult.legacyReactionRouteMedianMs > 0,
          JSON.stringify(native));
      }
      const denseAggregation = campaign.values.find((entry) => (
        entry.name === 'dense-contention'
      ));
      assert.ok(
        denseAggregation?.aggregateReactionRouteVsLegacyRatio <= 0.85
          && denseAggregation.aggregateCombinedTreeRouteVsLegacyRatio <= 0.85,
        `${campaign.label} did not materially reduce dense global-atomic contention: `
          + JSON.stringify(denseAggregation)
      );
      for (const fixtureName of ['sparse-many-cells', 'clustered-multi-cell']) {
        const result = campaign.values.find((entry) => (
          entry.name === fixtureName
        ));
        assert.ok(
          result?.aggregateReactionRouteVsLegacyRatio <= 0.95
            && result.aggregateCombinedTreeRouteVsLegacyRatio <= 0.95,
          `${campaign.label} materially regressed ${fixtureName}: ${JSON.stringify(result)}`
        );
      }
    }
    assert.equal(
      native.fixtures.find((fixture) => fixture.name === 'sparse')
        ?.direct.corruptHeaderFailClosed,
      true,
      JSON.stringify(native)
    );
    assert.equal(native.hotCounterOverflow.overflowCount, 1, JSON.stringify(native));
    assert.ok(
      native.hotCounterOverflow.malformedTraversalCount > 0
        && native.hotCounterOverflow.sealedRowCount > 0
        && native.hotCounterOverflow.invalidRows === true,
      JSON.stringify(native)
    );
    assert.equal(
      native.fullRuleScanHotCounterParity.exact,
      true,
      JSON.stringify(native)
    );
    assert.ok(
      native.fullRuleScanHotCounterParity.fullRuleScanRuleVisitCount > 0,
      JSON.stringify(native)
    );
    assert.equal(
      native.lifecycle.arenaReuseAggregationParity.exact,
      true,
      JSON.stringify(native)
    );
    assert.equal(
      native.lifecycle.corruptHeaderAggregationParity.exact,
      true,
      JSON.stringify(native)
    );
    assert.equal(
      native.deviceLoss.aggregationParity.exact,
      true,
      JSON.stringify(native)
    );
    assert.equal(native.deviceLoss.reason, 'destroyed');
    if (process.env.ULG_NATIVE_EXACT_CELL_TREE_REPORT === '1') {
      console.log(`S9D exact-cell native comparison ${JSON.stringify(native.comparison)}`);
      console.log(
        'S9D observed aggregation versus historical-global-atomic native comparison '
          + JSON.stringify(native.aggregationComparison)
      );
      console.log(
        'S9D default-no-readback versus historical-global-atomic native comparison '
          + JSON.stringify(native.defaultNoReadbackHistoricalAtomicComparison)
      );
    }
  } finally {
    await browser.close();
  }
});
