import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_AGGREGATE_V2 === '1';
const BASE_URL = process.env.ULG_AGGREGATE_V2_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_AGGREGATE_V2_CHROME
  || '/usr/bin/google-chrome';

test('native Vulkan aggregate v2 preserves sparse physical identity and admits A=0', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_AGGREGATE_V2=1 for native Vulkan WebGPU',
  timeout: 180_000
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
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    const native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const [
        aggregateRuntimeModule,
        traversalRuntimeModule,
        identityModule,
        epochAbi,
        activeAbi,
        aggregateAbi
      ] = await Promise.all([
        import('/src/runtime/sph/schroederSpatialAggregateViewGpu.js'),
        import('/src/runtime/sph/schroederSpatialAggregateTraversalGpu.js'),
        import('/src/runtime/sph/sphGpuDeviceIdentity.js'),
        import('/ulg-gpu-abi/src/schroederSpatialEpoch.js'),
        import('/ulg-gpu-abi/src/schroederSpatialActiveSourceView.js'),
        import('/ulg-gpu-abi/src/schroederSpatialAggregateView.js')
      ]);

      const createBuffer = (label, data, usage) => {
        const buffer = identityModule.tagWebGpuBufferDevice(
          device.createBuffer({
            label,
            size: data.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST
          }),
          device
        );
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const readWords = async (buffer, byteLength) => {
        const readback = device.createBuffer({
          label: 'aggregate-v2-native-readback',
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const words = Array.from(new Uint32Array(
          readback.getMappedRange().slice(0)
        ));
        readback.unmap();
        readback.destroy();
        return words;
      };
      const signedOrder = (value) => (
        ((Number(value) | 0) >>> 0) ^ 0x8000_0000
      ) >>> 0;
      const identity = Object.freeze({
        generationId: 41,
        deviceOrdinal: 2,
        laneOrdinal: 3,
        leaseToken: 5,
        sourceFamilyId: 7,
        storageGeneration: 11,
        physicsTick: 13,
        physicsSubstep: 0,
        positionEpoch: 17,
        topologyEpoch: 19,
        chartEpoch: 23,
        levelEpoch: 29,
        supportEpoch: 31,
        buildOrdinal: 37
      });
      const epochFields = Object.freeze({
        storageGeneration: identity.storageGeneration,
        physicsTick: identity.physicsTick,
        physicsSubstep: identity.physicsSubstep,
        positionEpoch: identity.positionEpoch,
        topologyEpoch: identity.topologyEpoch,
        chartEpoch: identity.chartEpoch,
        levelEpoch: identity.levelEpoch,
        supportEpoch: identity.supportEpoch
      });

      const runFixture = async (
        activePhysicalSources,
        label,
        directoryPhysicalSources = activePhysicalSources
      ) => {
        const physicalSourceCount = 4;
        const physicalSourceCapacity = 4;
        const activeSourceCapacity = 2;
        const cellCapacity = 2;
        const activeSourceCount = activePhysicalSources.length;
        const cellCount = directoryPhysicalSources.length;
        const directoryLayout = epochAbi.createSchroederSpatialEpochV2Layout({
          physicalSourceCapacity,
          activeSourceCapacity,
          cellCapacity
        });
        const activeLayout =
          activeAbi.createSchroederSpatialActiveSourceViewLayout({
            physicalSourceCapacity,
            activeSourceCapacity
          });

        const directoryWords = new Uint32Array(directoryLayout.wordLength);
        directoryWords[0] = epochAbi.SCHROEDER_SPATIAL_EPOCH_MAGIC;
        directoryWords[1] = epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION;
        directoryWords[2] = epochAbi.SCHROEDER_SPATIAL_EPOCH_STATUS_READY
          | epochAbi.SCHROEDER_SPATIAL_EPOCH_STATUS_ADMITTED;
        [
          identity.generationId,
          identity.deviceOrdinal,
          identity.laneOrdinal,
          identity.leaseToken,
          identity.sourceFamilyId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          identity.positionEpoch,
          identity.topologyEpoch,
          identity.chartEpoch,
          identity.levelEpoch,
          identity.supportEpoch
        ].forEach((value, index) => {
          directoryWords[3 + index] = value;
        });
        directoryWords[16] = physicalSourceCount;
        directoryWords[17] = physicalSourceCapacity;
        directoryWords[18] = cellCount;
        directoryWords[19] = cellCapacity;
        directoryWords[20] = directoryLayout.wordLength;
        directoryWords[21] = directoryLayout.wordLength;
        directoryWords[22] = directoryLayout.wordLength;
        directoryWords[25] = epochAbi.SCHROEDER_SPATIAL_EPOCH_KEY_WORDS;
        directoryWords[26] = epochAbi.SCHROEDER_SPATIAL_EPOCH_KEY_WORDS;
        directoryWords[27] =
          epochAbi.SCHROEDER_SPATIAL_SORT_LEXICOGRAPHIC_U32X5;
        directoryWords[28] = epochAbi.SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS;
        directoryWords[29] = directoryLayout.cellKeysOffsetWords;
        directoryWords[30] = directoryLayout.cellOffsetsOffsetWords;
        directoryWords[31] = directoryLayout.cellMembersOffsetWords;
        directoryWords[32] =
          directoryLayout.physicalToCellPlusOneOffsetWords;
        directoryWords[33] = identity.buildOrdinal;
        directoryWords[34] = identity.buildOrdinal;
        directoryWords[35] = identity.buildOrdinal;
        directoryWords[36] = identity.generationId;
        directoryWords[37] = activeSourceCount;
        directoryWords[38] = cellCount;
        directoryWords[39] = 1;
        directoryWords[41] = 1;
        directoryWords[42] = cellCount > 0 ? 1 : 0;
        directoryWords[43] = cellCount > 0 ? 1 : 0;
        directoryWords[44] = cellCount > 0 ? 1 : 0;
        directoryWords[45] = 67;
        directoryWords[46] = 2;
        directoryWords[47] = directoryLayout.wordLength;
        for (let activeOrdinal = 0; activeOrdinal < cellCount; activeOrdinal += 1) {
          const keyBase = directoryLayout.cellKeysOffsetWords
            + activeOrdinal * epochAbi.SCHROEDER_SPATIAL_EPOCH_KEY_WORDS;
          directoryWords.set([
            7,
            signedOrder(activeOrdinal),
            signedOrder(activePhysicalSources[activeOrdinal]),
            signedOrder(0),
            signedOrder(0)
          ], keyBase);
          directoryWords[
            directoryLayout.cellOffsetsOffsetWords + activeOrdinal + 1
          ] = activeOrdinal + 1;
          const physicalSource = directoryPhysicalSources[activeOrdinal];
          directoryWords[
            directoryLayout.cellMembersOffsetWords + activeOrdinal
          ] = physicalSource;
          directoryWords[
            directoryLayout.physicalToCellPlusOneOffsetWords + physicalSource
          ] = activeOrdinal + 1;
        }

        const sourceRows = new Float32Array(physicalSourceCapacity * 16);
        const particleState = new Float32Array(physicalSourceCapacity * 8);
        const particleThermo = new Float32Array(physicalSourceCapacity * 12);
        const particleIdentity = new Uint32Array(physicalSourceCapacity);
        activePhysicalSources.forEach((physicalSource, activeOrdinal) => {
          const position = [activeOrdinal * 2, activeOrdinal, 0];
          const mass = activeOrdinal + 1;
          sourceRows.set([7, activeOrdinal, 0.5, 1, 1, 1, mass], physicalSource * 16);
          sourceRows.set(position, physicalSource * 16 + 12);
          particleState.set([
            ...position,
            mass,
            0.25 * (activeOrdinal + 1),
            0,
            0,
            2
          ], physicalSource * 8);
          particleThermo.set([
            activeOrdinal + 1,
            activeOrdinal,
            300,
            1,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            0.1
          ], physicalSource * 12);
          particleIdentity[physicalSource] = 100 + activeOrdinal;
        });

        const activeWords = new Uint32Array(activeLayout.wordLength);
        activeWords.fill(activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MISSING_ORDINAL);
        activeWords.fill(0, 0, activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_HEADER_WORDS);
        activeWords[0] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_MAGIC;
        activeWords[1] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_VERSION;
        activeWords[2] = activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_READY
          | activeAbi.SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_STATUS_ADMITTED;
        [
          identity.generationId,
          identity.deviceOrdinal,
          identity.laneOrdinal,
          identity.leaseToken,
          identity.sourceFamilyId,
          identity.storageGeneration,
          identity.physicsTick,
          identity.physicsSubstep,
          identity.positionEpoch,
          identity.topologyEpoch,
          identity.chartEpoch,
          identity.levelEpoch,
          identity.supportEpoch
        ].forEach((value, index) => {
          activeWords[3 + index] = value;
        });
        activeWords[16] = physicalSourceCount;
        activeWords[17] = physicalSourceCapacity;
        activeWords[18] = activeSourceCount;
        activeWords[19] = activeSourceCapacity;
        activeWords[20] = physicalSourceCount - activeSourceCount;
        activeWords[23] = 1;
        activeWords[24] = 16;
        activeWords[25] = activeLayout.activeToPhysicalOffsetWords;
        activeWords[26] = activeLayout.physicalToActiveOffsetWords;
        activeWords[27] = activeLayout.wordLength;
        activeWords[28] = activeLayout.wordLength;
        activeWords[29] = identity.buildOrdinal;
        activeWords[30] = identity.buildOrdinal;
        activeWords[31] =
          activeAbi.createSchroederSpatialActiveSourceFingerprint({
            ...identity,
            physicalSourceCount,
            physicalSourceCapacity,
            activeSourceCapacity,
            buildOrdinal: identity.buildOrdinal
          });
        activeWords[32] = physicalSourceCount;
        activeWords[33] = activeSourceCount;
        activeWords[34] = activeSourceCount;
        activeWords[35] = activeSourceCount;
        activeWords[36] = activeSourceCount > 0
          ? Math.max(...activePhysicalSources) + 1
          : 0;
        activeWords[37] = 64;
        activeWords[38] = 65_535;
        activeWords[39] = activeLayout.wordLength;
        activeWords[40] = activeLayout.activeDispatchOffsetWords;
        activeWords[41] = activeLayout.candidateDispatchOffsetWords;
        activeWords[42] = activeLayout.physicalDispatchOffsetWords;
        activeWords[43] = activeSourceCount * 27;
        activeWords[44] = activeSourceCapacity * 27;
        activeWords[45] = 1;
        activeWords[47] = activeWords[31] || 1;
        activeWords.set(
          [activeSourceCount > 0 ? 1 : 0, 1, 1],
          activeLayout.activeDispatchOffsetWords
        );
        activeWords.set(
          [activeSourceCount > 0
            ? Math.ceil(activeSourceCount * 27 / 64)
            : 0, 1, 1],
          activeLayout.candidateDispatchOffsetWords
        );
        activeWords.set(
          [Math.ceil(physicalSourceCount / 64), 1, 1],
          activeLayout.physicalDispatchOffsetWords
        );
        activePhysicalSources.forEach((physicalSource, activeOrdinal) => {
          activeWords[
            activeLayout.activeToPhysicalOffsetWords + activeOrdinal
          ] = physicalSource;
          activeWords[
            activeLayout.physicalToActiveOffsetWords + physicalSource
          ] = activeOrdinal;
        });

        const directoryBuffer = createBuffer(
          `${label}-directory`,
          directoryWords,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        );
        const consumerDispatchBuffer = createBuffer(
          `${label}-consumer-dispatch`,
          new Uint32Array([
            cellCount > 0 ? 1 : 0,
            cellCount > 0 ? 1 : 0,
            cellCount > 0 ? 1 : 0
          ]),
          GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE
        );
        const sourceBuffer = createBuffer(
          `${label}-source`,
          sourceRows,
          GPUBufferUsage.STORAGE
        );
        const stateBuffer = createBuffer(
          `${label}-state`,
          particleState,
          GPUBufferUsage.STORAGE
        );
        const thermoBuffer = createBuffer(
          `${label}-thermo`,
          particleThermo,
          GPUBufferUsage.STORAGE
        );
        const identityBuffer = createBuffer(
          `${label}-identity`,
          particleIdentity,
          GPUBufferUsage.STORAGE
        );
        const activeSourceViewBuffer = createBuffer(
          `${label}-active-source`,
          activeWords,
          GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT
        );

        const activeOwners = new WeakSet();
        const spatialOwners = new WeakSet();
        const activeOwnerRuntime = {
          ownsExecution(value) { return activeOwners.has(value); }
        };
        const spatialOwnerRuntime = {
          ownsExecution(value) { return spatialOwners.has(value); }
        };
        const activeSourceView = {
          schema: activeAbi.ULG_SCHROEDER_SPATIAL_ACTIVE_SOURCE_VIEW_SCHEMA,
          status: 'schroeder-spatial-active-source-view-gpu-encoded',
          ownerRuntime: activeOwnerRuntime,
          sourceBuffer,
          activeSourceViewBuffer,
          physicalSourceCount,
          physicalSourceCapacity,
          activeSourceCapacity,
          activeSourceCount: null,
          sourceRowLayoutId: 1,
          sourceRowStrideFloats: 16,
          activeDispatchOffsetBytes: activeLayout.activeDispatchOffsetBytes,
          layout: activeLayout,
          ...identity
        };
        activeOwners.add(activeSourceView);
        const activeSourceCountAuthority = Object.freeze({
          schema: activeSourceView.schema,
          activeSourceView,
          buffer: activeSourceViewBuffer,
          offsetWords: 18,
          offsetBytes: 18 * 4,
          capacity: activeSourceCapacity,
          residency: 'gpu-only'
        });
        const spatialExecution = {
          schema: epochAbi.ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
          directorySchema: epochAbi.ULG_SCHROEDER_SPATIAL_EPOCH_V2_SCHEMA,
          status: 'schroeder-spatial-epoch-v2-gpu-encoded',
          ownerRuntime: spatialOwnerRuntime,
          abiVersion: epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
          directoryAbiVersion: epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_VERSION,
          directoryBuffer,
          consumerDispatchBuffer,
          sourceBuffer,
          sourceCount: physicalSourceCount,
          sourceCapacity: physicalSourceCapacity,
          physicalSourceCount,
          physicalSourceCapacity,
          activeSourceCapacity,
          activeSourceCount: null,
          activeSourceView,
          activeSourceViewBuffer,
          activeSourceCountAuthority,
          logicalSourceCountAuthority: activeSourceCountAuthority,
          activeSourceCountAuthorityOffsetWords: 18,
          activeSourceGenerationSeal: Object.freeze({
            buffer: activeSourceViewBuffer,
            offsetWords: 30,
            expected: identity.buildOrdinal
          }),
          sourceWorkIdentity: 'gpu-active-ordinal',
          reverseEncoding:
            epochAbi.SCHROEDER_SPATIAL_EPOCH_V2_REVERSE_CELL_PLUS_ONE,
          sourceRowLayoutId: 1,
          sourceAdapterId: 2,
          layout: directoryLayout,
          sortUniqueOrdinal: identity.buildOrdinal,
          ...identity
        };
        spatialOwners.add(spatialExecution);
        const spatialSource = {
          ready: true,
          sourceBuffer,
          sourceStateBuffer: stateBuffer,
          sourceStateBufferBorrowed: true,
          sourceCount: physicalSourceCount,
          ...epochFields
        };
        const particleBufferSet = {
          status: 'webgpu-uploaded',
          particleCount: physicalSourceCount,
          stateBuffer,
          thermoBuffer,
          identityBuffer,
          stateStrideBytes: 8 * 4,
          thermoStrideBytes: 12 * 4,
          identityStrideBytes: 4,
          ...epochFields
        };

        const aggregateRuntime =
          aggregateRuntimeModule.createSchroederSpatialAggregateViewGpu(
            device,
            {
              maxSourceCount: physicalSourceCapacity,
              cellCapacity,
              arenaCount: 1,
              label: `${label}-aggregate`
            }
          );
        const aggregateEncoder = device.createCommandEncoder();
        const aggregateView = aggregateRuntime.encode(aggregateEncoder, {
          spatialExecution,
          spatialSource,
          particleBufferSet
        });
        device.queue.submit([aggregateEncoder.finish()]);
        aggregateRuntime.markExecutionSubmitted(aggregateView);
        await device.queue.onSubmittedWorkDone();
        const aggregateWords = await readWords(
          aggregateView.aggregateViewBuffer,
          aggregateView.aggregatePhysicalByteLength
        );

        const traversalRuntime =
          traversalRuntimeModule.createSchroederSpatialAggregateTraversalGpu(
            device,
            {
              maxQueryCount: physicalSourceCapacity,
              arenaCount: 1,
              label: `${label}-traversal`
            }
          );
        const traversalEncoder = device.createCommandEncoder();
        const traversal = traversalRuntime.encode(traversalEncoder, {
          aggregateView,
          queryBuffer: sourceBuffer,
          queryCount: physicalSourceCount,
          queryStrideFloats: 16,
          querySourceLayoutId:
            aggregateAbi
              .SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
              .LEVEL_ASSIGNMENT_V0,
          publicEpochIdentity: epochFields
        });
        device.queue.submit([traversalEncoder.finish()]);
        traversalRuntime.markExecutionSubmitted(traversal);
        await device.queue.onSubmittedWorkDone();
        const traversalWords = await readWords(
          traversal.traversalSummaryBuffer,
          traversal.traversalSummaryBuffer.size
        );

        await traversalRuntime.releaseExecutionAfter(
          traversal,
          Promise.resolve()
        );
        traversalRuntime.destroy();
        await aggregateRuntime.releaseExecutionAfter(
          aggregateView,
          Promise.resolve()
        );
        aggregateRuntime.destroy();
        [
          directoryBuffer,
          consumerDispatchBuffer,
          sourceBuffer,
          stateBuffer,
          thermoBuffer,
          identityBuffer,
          activeSourceViewBuffer
        ].forEach((buffer) => buffer.destroy());

        const rootRecordIndex = aggregateWords[53];
        const rootBase = rootRecordIndex === 0xffff_ffff
          ? null
          : 112 + rootRecordIndex * 44;
        return {
          aggregateStatus: aggregateWords[2],
          sourceCount: aggregateWords[16],
          cellCount: aggregateWords[18],
          rootRecordIndex,
          totalRecordCount: aggregateWords[54],
          attemptedSourceCount: aggregateWords[36],
          reducedSourceCount: aggregateWords[37],
          activeProjectionStatus: aggregateWords[93],
          activeProjectionCount: aggregateWords[96],
          activeProjection: aggregateWords.slice(
            aggregateView.activeMemberOffsetWords,
            aggregateView.activeMemberOffsetWords + activeSourceCount
          ),
          rootParticleCount: rootBase == null ? 0 : aggregateWords[rootBase + 19],
          rootSourceMemberCount:
            rootBase == null ? 0 : aggregateWords[rootBase + 43],
          traversalRows: Array.from(
            { length: physicalSourceCount },
            (_, physicalSource) => traversalWords.slice(
              physicalSource * 32,
              physicalSource * 32 + 8
            )
          )
        };
      };

      const sparse = await runFixture(
        [1, 3],
        'aggregate-v2-sparse',
        [3, 1]
      );
      const empty = await runFixture([], 'aggregate-v2-empty');
      await device.queue.onSubmittedWorkDone();
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 0));
      device.destroy();
      return {
        status: 'ok',
        sparse,
        empty,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });

    if (native.status === 'unsupported') {
      return;
    }
    assert.equal(native.status, 'ok', JSON.stringify(native));
    assert.equal(native.validationError, null, JSON.stringify(native));
    assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));
    assert.deepEqual(native.sparse, {
      aggregateStatus: 259,
      sourceCount: 4,
      cellCount: 2,
      rootRecordIndex: 2,
      totalRecordCount: 3,
      attemptedSourceCount: 2,
      reducedSourceCount: 2,
      activeProjectionStatus: 3,
      activeProjectionCount: 2,
      activeProjection: [3, 1],
      rootParticleCount: 2,
      rootSourceMemberCount: 2,
      traversalRows: [
        Array(8).fill(0),
        [3, 1, 3, 1, 1, 1, 2, 2],
        Array(8).fill(0),
        [3, 3, 3, 1, 1, 1, 2, 2]
      ]
    });
    assert.deepEqual(native.empty, {
      aggregateStatus: 259,
      sourceCount: 4,
      cellCount: 0,
      rootRecordIndex: 0xffff_ffff,
      totalRecordCount: 0,
      attemptedSourceCount: 0,
      reducedSourceCount: 0,
      activeProjectionStatus: 3,
      activeProjectionCount: 0,
      activeProjection: [],
      rootParticleCount: 0,
      rootSourceMemberCount: 0,
      traversalRows: Array.from({ length: 4 }, () => Array(8).fill(0))
    });
  } finally {
    await browser.close();
  }
});
