import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_AGGREGATE_PROBE_BASE_URL
  || 'https://127.0.0.1:5174/';
const outputPath = process.env.ULG_AGGREGATE_PROBE_OUTPUT
  || '/tmp/ulg-schroeder-aggregate-native-probe.json';
const particleCount = Number(process.env.ULG_AGGREGATE_PROBE_PARTICLES || 4097);
const corruptionMode = process.env.ULG_AGGREGATE_PROBE_CORRUPT === '1';

if (!Number.isSafeInteger(particleCount) || particleCount < 1) {
  throw new RangeError('ULG_AGGREGATE_PROBE_PARTICLES must be a positive integer');
}

const browser = await chromium.launch({
  executablePath: process.env.ULG_AGGREGATE_PROBE_CHROME
    || '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
    '--disable-gpu-sandbox'
  ]
});

let result;
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  page.setDefaultTimeout(120_000);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  result = await page.evaluate(async ({ particleCount, corruptionMode }) => {
    const startedAt = performance.now();
    if (!navigator.gpu) {
      return { status: 'unsupported', reason: 'navigator.gpu unavailable' };
    }
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });
    if (!adapter) {
      return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
    }
    const device = await adapter.requestDevice();
    const uncapturedErrors = [];
    device.addEventListener('uncapturederror', (event) => {
      uncapturedErrors.push({
        name: event.error?.constructor?.name || null,
        message: event.error?.message || String(event.error)
      });
    });
    const nonce = Date.now();
    device.pushErrorScope('validation');
    try {
      const [
        spatialModule,
        traversalModule,
        aggregateAbi,
        aggregateWgsl,
        spatialWgsl,
        identityModule
      ] = await Promise.all([
        import(`/src/runtime/sph/schroederSpatialEpochGpu.js?aggregateNativeProbe=${nonce}`),
        import(`/src/runtime/sph/schroederSpatialAggregateTraversalGpu.js?aggregateNativeProbe=${nonce}`),
        import(`/ulg-gpu-abi/src/schroederSpatialAggregateView.js?aggregateNativeProbe=${nonce}`),
        import(`/ulg-gpu-abi/src/schroederSpatialAggregateViewWgsl.js?aggregateNativeProbe=${nonce}`),
        import(`/ulg-gpu-abi/src/schroederSpatialEpochWgsl.js?aggregateNativeProbe=${nonce}`),
        import(`/src/runtime/sph/sphGpuDeviceIdentity.js?aggregateNativeProbe=${nonce}`)
      ]);

      const compileShader = async (name, code, entryPoints) => {
        const compileStartedAt = performance.now();
        device.pushErrorScope('validation');
        let module = null;
        let compilationMessages = [];
        let pipelineErrors = [];
        try {
          module = device.createShaderModule({
            label: `native-probe-${name}-shader`,
            code
          });
          if (typeof module.getCompilationInfo === 'function') {
            const info = await module.getCompilationInfo();
            compilationMessages = [...info.messages].map((message) => ({
              type: message.type,
              message: message.message,
              lineNum: message.lineNum,
              linePos: message.linePos,
              offset: message.offset,
              length: message.length
            }));
          }
          for (const entryPoint of entryPoints) {
            try {
              if (typeof device.createComputePipelineAsync === 'function') {
                await device.createComputePipelineAsync({
                  label: `native-probe-${name}-${entryPoint}`,
                  layout: 'auto',
                  compute: { module, entryPoint }
                });
              } else {
                device.createComputePipeline({
                  label: `native-probe-${name}-${entryPoint}`,
                  layout: 'auto',
                  compute: { module, entryPoint }
                });
              }
            } catch (error) {
              pipelineErrors.push({
                entryPoint,
                name: error?.constructor?.name || null,
                message: error?.message || String(error)
              });
            }
          }
        } catch (error) {
          pipelineErrors.push({
            entryPoint: null,
            name: error?.constructor?.name || null,
            message: error?.message || String(error)
          });
        }
        const validationError = await device.popErrorScope();
        return {
          name,
          entryPoints,
          compilationMessages,
          pipelineErrors,
          validationError: validationError?.message || null,
          elapsedMs: performance.now() - compileStartedAt
        };
      };

      const compileResults = [];
      compileResults.push(await compileShader(
        'schroeder-spatial-epoch-key',
        spatialWgsl.schroederSpatialEpochKeyWgsl,
        ['emit_spatial_keys']
      ));
      compileResults.push(await compileShader(
        'schroeder-spatial-epoch-assemble',
        spatialWgsl.schroederSpatialEpochAssembleWgsl,
        ['assemble_directory', 'finalize_directory']
      ));
      compileResults.push(await compileShader(
        'schroeder-spatial-aggregate-view',
        aggregateWgsl.schroederSpatialAggregateViewWgsl,
        [
          'initialize_aggregate_view',
          'initialize_aggregate_records',
          'emit_aggregate_morton_keys',
          'reduce_cell_leaves',
          'build_aggregate_prefix_topology',
          'build_aggregate_escape_ropes',
          'reduce_aggregate_internals',
          'authenticate_aggregate_topology',
          'finalize_aggregate_view'
        ]
      ));
      compileResults.push(await compileShader(
        'schroeder-spatial-aggregate-traversal',
        aggregateWgsl.schroederSpatialAggregateStacklessTraversalWgsl,
        ['traverse_aggregate_view']
      ));

      const state = new Float32Array(particleCount * 8);
      const thermo = new Float32Array(particleCount * 12);
      const identity = new Uint32Array(particleCount);
      const assignment = new Float32Array(particleCount * 16);
      const dimensions = [17, 17, 15];
      const expected = {
        massKg: 0,
        firstMomentKgM: [0, 0, 0],
        momentumKgMPerS: [0, 0, 0],
        angularMomentumKgM2PerS: [0, 0, 0],
        internalEnergyJ: 0,
        kineticEnergyJ: 0,
        negativeVelocityComponentCount: 0,
        nonzeroVelocityComponentCount: 0
      };
      for (let index = 0; index < particleCount; index += 1) {
        const xIndex = index % dimensions[0];
        const yIndex = Math.floor(index / dimensions[0]) % dimensions[1];
        const zIndex = Math.floor(index / (dimensions[0] * dimensions[1]));
        const position = [
          xIndex - 8 + 0.25,
          yIndex - 8 + 0.25,
          zIndex - 7 + 0.25
        ];
        const mass = 1 + (index % 5) * 0.125;
        const velocity = [
          ((index % 11) - 5) * 0.125,
          ((index % 7) - 3) * -0.2,
          index % 2 === 0 ? 0.45 : -0.35
        ];
        const specificInternalEnergy = 10 + (index % 13) * 0.5;
        const supportRadius = 0.7 + (index % 4) * 0.1;
        const visualRadius = 0.08 + (index % 3) * 0.01;
        const stateBase = index * 8;
        state.set([
          ...position,
          mass,
          ...velocity,
          specificInternalEnergy
        ], stateBase);
        const phase = index % 4;
        const thermoBase = index * 12;
        thermo[thermoBase] = index % 3;
        thermo[thermoBase + 1] = phase;
        thermo[thermoBase + 2] = 300 + (index % 17);
        thermo[thermoBase + 3] = 1;
        thermo[thermoBase + 4 + phase] = 1;
        thermo[thermoBase + 8] = 0;
        thermo[thermoBase + 9] = 1;
        thermo[thermoBase + 10] = 1;
        thermo[thermoBase + 11] = visualRadius;
        identity[index] = index + 1;
        const assignmentBase = index * 16;
        assignment[assignmentBase] = 0;
        assignment[assignmentBase + 1] = 1;
        assignment[assignmentBase + 2] = supportRadius;
        assignment[assignmentBase + 6] = mass;
        assignment[assignmentBase + 10] = 1;
        assignment[assignmentBase + 12] = position[0];
        assignment[assignmentBase + 13] = position[1];
        assignment[assignmentBase + 14] = position[2];
        assignment[assignmentBase + 15] = 0;

        expected.massKg += mass;
        expected.internalEnergyJ += mass * specificInternalEnergy;
        let velocitySquared = 0;
        for (let axis = 0; axis < 3; axis += 1) {
          const momentum = mass * velocity[axis];
          expected.firstMomentKgM[axis] += mass * position[axis];
          expected.momentumKgMPerS[axis] += momentum;
          velocitySquared += velocity[axis] * velocity[axis];
          if (velocity[axis] < 0) expected.negativeVelocityComponentCount += 1;
          if (velocity[axis] !== 0) expected.nonzeroVelocityComponentCount += 1;
        }
        expected.angularMomentumKgM2PerS[0] += mass * (
          position[1] * velocity[2] - position[2] * velocity[1]
        );
        expected.angularMomentumKgM2PerS[1] += mass * (
          position[2] * velocity[0] - position[0] * velocity[2]
        );
        expected.angularMomentumKgM2PerS[2] += mass * (
          position[0] * velocity[1] - position[1] * velocity[0]
        );
        expected.kineticEnergyJ += 0.5 * mass * velocitySquared;
      }

      const storageBuffer = (label, typedArray) => {
        const buffer = identityModule.tagWebGpuBufferDevice(device.createBuffer({
          label,
          size: typedArray.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }), device);
        device.queue.writeBuffer(buffer, 0, typedArray);
        return buffer;
      };
      const assignmentBuffer = storageBuffer(
        'native-aggregate-level-assignment',
        assignment
      );
      const stateBuffer = storageBuffer('native-aggregate-state', state);
      const thermoBuffer = storageBuffer('native-aggregate-thermo', thermo);
      const identityBuffer = storageBuffer('native-aggregate-identity', identity);
      const epochIdentity = Object.freeze({
        storageGeneration: 101,
        physicsTick: 202,
        physicsSubstep: 0,
        positionEpoch: 303,
        topologyEpoch: 404,
        chartEpoch: 505,
        levelEpoch: 606,
        supportEpoch: 707
      });
      const levelAssignment = {
        schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
        status: 'schroeder-level-assignment-submitted',
        bufferFamilyGenerationStatus:
          'schroeder-particle-buffer-family-generation-ready',
        particleCount,
        assignmentStrideFloats: 16,
        assignmentBuffer,
        assignmentBufferByteLength: assignmentBuffer.size,
        sourceAssignmentBuffer: assignmentBuffer,
        sourceStateBuffer: stateBuffer,
        sourceStateBufferBorrowed: true,
        minLevel: 0,
        maxLevel: 0,
        chartId: 0,
        baseGridSpacingM: 1,
        ...epochIdentity
      };
      const particleBufferSet = {
        status: 'webgpu-uploaded',
        particleCount,
        stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
        thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
        identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
        stateBuffer,
        thermoBuffer,
        identityBuffer,
        ...epochIdentity
      };

      const aggregateBuildStartedAt = performance.now();
      const generation = spatialModule.runSchroederSpatialEpochGenerationWebGpu({
        device,
        levelAssignment,
        particleCount,
        particleBufferSet,
        laneId: 'native-aggregate-probe'
      });
      const aggregateSubmissionElapsedMs = performance.now() - aggregateBuildStartedAt;
      if (generation.ready !== true || !generation.aggregateView) {
        throw new Error(
          `aggregate generation rejected: ${generation.status}: ${generation.reason}`
        );
      }
      const aggregateFenceStartedAt = performance.now();
      await device.queue.onSubmittedWorkDone();
      const aggregateFenceElapsedMs = performance.now() - aggregateFenceStartedAt;
      if (corruptionMode) {
        const rootRecordIndex = particleCount === 1 ? 0 : particleCount;
        const rootFingerprintWord =
          aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS
          + rootRecordIndex
            * aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS
          + 41;
        device.queue.writeBuffer(
          generation.aggregateView.aggregateViewBuffer,
          rootFingerprintWord * Uint32Array.BYTES_PER_ELEMENT,
          new Uint32Array([0])
        );
      }

      const traversalRuntime =
        traversalModule.createSchroederSpatialAggregateTraversalGpu(device, {
          maxQueryCount: particleCount,
          arenaCount: 1,
          label: 'native-aggregate-level-assignment-traversal'
        });
      const traversalEncoder = device.createCommandEncoder({
        label: 'native-aggregate-level-assignment-traversal-encoder'
      });
      const publicEpochIdentity = Object.freeze(Object.fromEntries([
        'storageGeneration',
        'physicsTick',
        'physicsSubstep',
        'positionEpoch',
        'topologyEpoch',
        'chartEpoch',
        'levelEpoch',
        'supportEpoch'
      ].map((field) => [field, generation.aggregateView[field]])));
      const traversalEncodeStartedAt = performance.now();
      const traversal = traversalRuntime.encode(traversalEncoder, {
        aggregateView: generation.aggregateView,
        queryBuffer: generation.source.sourceBuffer,
        queryCount: particleCount,
        queryStrideFloats: 16,
        querySourceLayoutId:
          aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
            .LEVEL_ASSIGNMENT_V0,
        nearFieldSupportScale: 1.25,
        openingTheta: 0.65,
        publicEpochIdentity,
        gravitationalConstant: 6.6743e-11,
        softeningLengthM: 0.01,
        forceScale: 1
      });
      const traversalEncodeElapsedMs = performance.now() - traversalEncodeStartedAt;
      const summaryReadback = device.createBuffer({
        label: 'native-aggregate-traversal-summary-readback',
        size: particleCount
          * aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS
          * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const aggregateReadback = device.createBuffer({
        label: 'native-aggregate-view-readback',
        size: generation.aggregateView.layout.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      traversalEncoder.copyBufferToBuffer(
        traversal.traversalSummaryBuffer,
        0,
        summaryReadback,
        0,
        summaryReadback.size
      );
      traversalEncoder.copyBufferToBuffer(
        generation.aggregateView.aggregateViewBuffer,
        0,
        aggregateReadback,
        0,
        aggregateReadback.size
      );
      const traversalSubmitStartedAt = performance.now();
      device.queue.submit([traversalEncoder.finish()]);
      traversalRuntime.markExecutionSubmitted(traversal);
      const traversalFence = device.queue.onSubmittedWorkDone();
      await traversalFence;
      const traversalFenceElapsedMs = performance.now() - traversalSubmitStartedAt;
      const receipt = traversalModule
        .finalizeSchroederSpatialAggregateTraversalSubmissionReceipt(
        traversal,
        traversal.submissionEvidence
      );

      await Promise.all([
        summaryReadback.mapAsync(GPUMapMode.READ),
        aggregateReadback.mapAsync(GPUMapMode.READ)
      ]);
      const summaryWords = new Uint32Array(summaryReadback.getMappedRange().slice(0));
      const summaryFloats = new Float32Array(summaryWords.buffer);
      const aggregateWords = new Uint32Array(aggregateReadback.getMappedRange().slice(0));
      const aggregateFloats = new Float32Array(aggregateWords.buffer);
      const header = {
        statusFlags: aggregateWords[2],
        sourceCount: aggregateWords[16],
        sourceCapacity: aggregateWords[17],
        cellCount: aggregateWords[18],
        cellCapacity: aggregateWords[19],
        leafCount: aggregateWords[23],
        internalCount: aggregateWords[27],
        nodeCount: aggregateWords[29],
        invalidSourceCount: aggregateWords[32],
        nonfiniteSourceCount: aggregateWords[33],
        identityMismatchCount: aggregateWords[34],
        overflowCount: aggregateWords[35],
        attemptedSourceCount: aggregateWords[36],
        reducedSourceCount: aggregateWords[37],
        reducedLeafCount: aggregateWords[38],
        reducedInternalCount: aggregateWords[39],
        topologyMode: aggregateWords[51],
        prefixBitCapacity: aggregateWords[52],
        rootRecordIndex: aggregateWords[53],
        totalRecordCount: aggregateWords[54],
        internalRecordCount: aggregateWords[55],
        topologyFingerprint: aggregateWords[56],
        traversalStatus: aggregateWords[57],
        traversalLeafCoverage: aggregateWords[58],
        malformedTopologyCount: aggregateWords[59],
        dispatchWords: aggregateWords[60],
        replayGuardToken: aggregateWords[62],
        topologyReserved: Array.from(aggregateWords.slice(64, 72)),
        topologyCounters: Array.from(aggregateWords.slice(72, 80))
      };
      const rootBase = aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS
        + header.rootRecordIndex
          * aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_WORDS;
      const root = {
        massKg: aggregateFloats[rootBase],
        firstMomentKgM: Array.from(aggregateFloats.slice(rootBase + 1, rootBase + 4)),
        momentumKgMPerS: Array.from(aggregateFloats.slice(rootBase + 4, rootBase + 7)),
        angularMomentumKgM2PerS:
          Array.from(aggregateFloats.slice(rootBase + 7, rootBase + 10)),
        internalEnergyJ: aggregateFloats[rootBase + 10],
        kineticEnergyJ: aggregateFloats[rootBase + 11],
        particleCount: aggregateWords[rootBase + 19],
        recordStatus: aggregateWords[rootBase + 27],
        subtreeLeafBegin: aggregateWords[rootBase + 38],
        subtreeLeafEnd: aggregateWords[rootBase + 39],
        prefixBitCount: aggregateWords[rootBase + 40],
        topologyFingerprint: aggregateWords[rootBase + 41]
      };
      const conservationTolerance = Object.freeze({
        absoluteFloor: 1e-4,
        relative: 2e-6
      });
      const withinConservationTolerance = (actual, target) => (
        Number.isFinite(actual)
        && Math.abs(actual - target) <= Math.max(
          conservationTolerance.absoluteFloor,
          Math.abs(target) * conservationTolerance.relative
        )
      );
      const rootError = {
        massKg: root.massKg - expected.massKg,
        firstMomentKgM: root.firstMomentKgM.map(
          (value, axis) => value - expected.firstMomentKgM[axis]
        ),
        momentumKgMPerS: root.momentumKgMPerS.map(
          (value, axis) => value - expected.momentumKgMPerS[axis]
        ),
        angularMomentumKgM2PerS: root.angularMomentumKgM2PerS.map(
          (value, axis) => value - expected.angularMomentumKgM2PerS[axis]
        ),
        internalEnergyJ: root.internalEnergyJ - expected.internalEnergyJ,
        kineticEnergyJ: root.kineticEnergyJ - expected.kineticEnergyJ
      };
      const rootConservation = {
        particleCount: root.particleCount === particleCount,
        massKg: withinConservationTolerance(root.massKg, expected.massKg),
        firstMomentKgM: root.firstMomentKgM.every(
          (value, axis) => withinConservationTolerance(
            value,
            expected.firstMomentKgM[axis]
          )
        ),
        momentumKgMPerS: root.momentumKgMPerS.every(
          (value, axis) => withinConservationTolerance(
            value,
            expected.momentumKgMPerS[axis]
          )
        ),
        angularMomentumKgM2PerS: root.angularMomentumKgM2PerS.every(
          (value, axis) => withinConservationTolerance(
            value,
            expected.angularMomentumKgM2PerS[axis]
          )
        ),
        internalEnergyJ: withinConservationTolerance(
          root.internalEnergyJ,
          expected.internalEnergyJ
        ),
        kineticEnergyJ: withinConservationTolerance(
          root.kineticEnergyJ,
          expected.kineticEnergyJ
        )
      };
      const conservationFailureCount = Object.values(rootConservation)
        .filter((conserved) => !conserved).length;
      const summaries = [];
      const statusHistogram = {};
      let totalVisitedNodes = 0;
      let totalAcceptedFarNodes = 0;
      let totalNearLeaves = 0;
      let totalFarLeafCoverage = 0;
      let minVisitedNodes = Number.POSITIVE_INFINITY;
      let maxVisitedNodes = 0;
      let minNearLeaves = Number.POSITIVE_INFINITY;
      let maxNearLeaves = 0;
      let partitionFailureCount = 0;
      let queryIndexFailureCount = 0;
      let massPartitionFailureCount = 0;
      let compressedFarQueryCount = 0;
      const visitedNodeCounts = [];
      const rootMassTolerance = Math.max(0.01, Math.abs(root.massKg) * 2e-5);
      for (let queryIndex = 0; queryIndex < particleCount; queryIndex += 1) {
        const base = queryIndex
          * aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_SUMMARY_WORDS;
        const status = summaryWords[base];
        const visitedNodeCount = summaryWords[base + 2];
        const acceptedFarNodeCount = summaryWords[base + 3];
        const nearLeafCount = summaryWords[base + 4];
        const openedNodeCount = summaryWords[base + 5];
        const coveredLeafCount = summaryWords[base + 6];
        const leafCount = summaryWords[base + 7];
        const farLeafCoverage = leafCount - nearLeafCount;
        const farMassKg = summaryFloats[base + 8];
        const nearMassKg = summaryFloats[base + 9];
        const summary = {
          queryIndex,
          status,
          reportedQueryIndex: summaryWords[base + 1],
          visitedNodeCount,
          acceptedFarNodeCount,
          nearLeafCount,
          farLeafCoverage,
          openedNodeCount,
          coveredLeafCount,
          leafCount,
          farMassKg,
          nearMassKg,
          farMomentumKgMPerS:
            Array.from(summaryFloats.slice(base + 13, base + 16)),
          queryMassKg: summaryFloats[base + 24],
          generationId: summaryWords[base + 25],
          storageGeneration: summaryWords[base + 26],
          positionEpoch: summaryWords[base + 27],
          topologyEpoch: summaryWords[base + 28],
          replayGuardToken: summaryWords[base + 29],
          topologyFingerprint: summaryWords[base + 30],
          completionOrdinal: summaryWords[base + 31]
        };
        summaries.push(summary);
        statusHistogram[status] = (statusHistogram[status] || 0) + 1;
        totalVisitedNodes += visitedNodeCount;
        visitedNodeCounts.push(visitedNodeCount);
        totalAcceptedFarNodes += acceptedFarNodeCount;
        totalNearLeaves += nearLeafCount;
        totalFarLeafCoverage += farLeafCoverage;
        minVisitedNodes = Math.min(minVisitedNodes, visitedNodeCount);
        maxVisitedNodes = Math.max(maxVisitedNodes, visitedNodeCount);
        minNearLeaves = Math.min(minNearLeaves, nearLeafCount);
        maxNearLeaves = Math.max(maxNearLeaves, nearLeafCount);
        if (coveredLeafCount !== leafCount || leafCount !== header.leafCount) {
          partitionFailureCount += 1;
        }
        if (summary.reportedQueryIndex !== queryIndex) queryIndexFailureCount += 1;
        if (Math.abs(farMassKg + nearMassKg - root.massKg) > rootMassTolerance) {
          massPartitionFailureCount += 1;
        }
        if (acceptedFarNodeCount < farLeafCoverage) compressedFarQueryCount += 1;
      }

      visitedNodeCounts.sort((left, right) => left - right);
      const p95VisitedNodes = visitedNodeCounts[
        Math.min(
          visitedNodeCounts.length - 1,
          Math.ceil(visitedNodeCounts.length * 0.95) - 1
        )
      ];
      const averageVisitedNodes = totalVisitedNodes / particleCount;
      const averageAcceptedFarNodes = totalAcceptedFarNodes / particleCount;
      const averageFarLeafCoverage = totalFarLeafCoverage / particleCount;
      const averageFarCoveragePerAcceptedNode = averageAcceptedFarNodes > 0
        ? averageFarLeafCoverage / averageAcceptedFarNodes
        : 0;

      summaryReadback.unmap();
      aggregateReadback.unmap();
      summaryReadback.destroy();
      aggregateReadback.destroy();
      await traversalRuntime.releaseExecutionAfter(traversal, traversalFence);
      const traversalRuntimeDestroyed = traversalRuntime.destroy();
      const generationReleaseScheduled =
        spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
          generation,
          device
        );
      const generationReleased = await generation.releasePromise;
      for (const buffer of [
        assignmentBuffer,
        stateBuffer,
        thermoBuffer,
        identityBuffer
      ]) buffer.destroy();
      const outerValidationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const compileErrorCount = compileResults.reduce((sum, entry) => (
        sum
          + entry.compilationMessages.filter((message) => message.type === 'error').length
          + entry.pipelineErrors.length
          + (entry.validationError ? 1 : 0)
      ), 0);
      const expectedTraversalStatus = corruptionMode
        ? aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_FAIL_CLOSED
          | aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_TOPOLOGY_MISMATCH
        : aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_READY
          | aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_STATUS_ADMITTED;
      const statusFailureCount = summaries.filter(
        (summary) => summary.status !== expectedTraversalStatus
      ).length;
      return {
        schema: 'peercompute.ulg.schroeder-spatial-aggregate-native-probe.v1',
        status: compileErrorCount === 0
          && !outerValidationError
          && uncapturedErrors.length === 0
          && statusFailureCount === 0
          && queryIndexFailureCount === 0
          && header.leafCount === particleCount
          && header.cellCount === particleCount
          && header.topologyMode
            === aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_VIEW_TOPOLOGY_MODE_MORTON_PREFIX_BINARY
          && header.prefixBitCapacity
            === aggregateAbi.SCHROEDER_SPATIAL_AGGREGATE_VIEW_PREFIX_BIT_COUNT
          && header.internalRecordCount === particleCount - 1
          && header.totalRecordCount === particleCount * 2 - 1
          && header.rootRecordIndex === (particleCount === 1 ? 0 : particleCount)
          && header.malformedTopologyCount === 0
          && header.traversalLeafCoverage === particleCount
          && conservationFailureCount === 0
          && (
            corruptionMode
              ? partitionFailureCount === particleCount
                && massPartitionFailureCount === particleCount
                && totalVisitedNodes === 0
              : partitionFailureCount === 0
                && massPartitionFailureCount === 0
                && root.subtreeLeafBegin === 0
                && root.subtreeLeafEnd === particleCount
                && root.particleCount === particleCount
                && (
                  particleCount < 128
                  || (
                    averageVisitedNodes <= header.totalRecordCount * 0.25
                    && p95VisitedNodes <= header.totalRecordCount * 0.4
                    && compressedFarQueryCount > 0
                    && averageFarCoveragePerAcceptedNode > 4
                  )
                )
          )
          && receipt.canonicalQueryProvenanceAuthenticated === true
          && receipt.querySourceLayout === 'schroeder-level-assignment-v0'
          && traversalRuntimeDestroyed === true
          && generationReleaseScheduled === true
          && generationReleased === true
          ? 'passed'
          : 'failed',
        adapterInfo: adapter.info ? {
          vendor: adapter.info.vendor,
          architecture: adapter.info.architecture,
          device: adapter.info.device,
          description: adapter.info.description
        } : null,
        particleCount,
        corruptionMode,
        expectedTraversalStatus,
        compileResults,
        compileErrorCount,
        outerValidationError: outerValidationError?.message || null,
        uncapturedErrors,
        header,
        root,
        expected,
        rootError,
        rootConservation,
        conservationTolerance,
        conservationFailureCount,
        receipt: {
          status: receipt.status,
          authenticated: receipt.authenticated,
          gpuAuthenticated: receipt.gpuAuthenticated,
          queryCount: receipt.queryCount,
          querySourceLayoutId: receipt.querySourceLayoutId,
          querySourceLayout: receipt.querySourceLayout,
          canonicalQueryProvenanceAuthenticated:
            receipt.canonicalQueryProvenanceAuthenticated,
          submissionAuthenticated: receipt.submissionAuthenticated,
          resultAuthenticated: receipt.resultAuthenticated,
          exactNearFarPartitionObserved:
            receipt.exactNearFarPartitionObserved,
          topologyFingerprintObserved: receipt.topologyFingerprintObserved,
          materializedCandidateRowCount: receipt.materializedCandidateRowCount,
          perSourceCandidateBudget: receipt.perSourceCandidateBudget,
          fullReadbackPerformed: receipt.fullReadbackPerformed
        },
        traversalAggregate: {
          summaryCount: summaries.length,
          statusHistogram,
          statusFailureCount,
          partitionFailureCount,
          queryIndexFailureCount,
          massPartitionFailureCount,
          compressedFarQueryCount,
          totalVisitedNodes,
          averageVisitedNodes,
          p95VisitedNodes,
          minVisitedNodes,
          maxVisitedNodes,
          totalAcceptedFarNodes,
          averageAcceptedFarNodes,
          totalNearLeaves,
          averageNearLeaves: totalNearLeaves / particleCount,
          minNearLeaves,
          maxNearLeaves,
          totalFarLeafCoverage,
          averageFarLeafCoverage,
          averageFarCoveragePerAcceptedNode
        },
        summaries,
        performance: {
          compileElapsedMs: compileResults.reduce(
            (sum, entry) => sum + entry.elapsedMs,
            0
          ),
          aggregateSubmissionElapsedMs,
          aggregateFenceElapsedMs,
          traversalEncodeElapsedMs,
          traversalFenceElapsedMs,
          totalElapsedMs: performance.now() - startedAt
        },
        lifecycle: {
          traversalRuntimeDestroyed,
          generationReleaseScheduled,
          generationReleased
        }
      };
    } catch (error) {
      let validationError = null;
      try {
        validationError = await device.popErrorScope();
      } catch {
        // The outer scope may already have been popped by the success path.
      }
      return {
        schema: 'peercompute.ulg.schroeder-spatial-aggregate-native-probe.v1',
        status: 'failed-with-exception',
        error: {
          name: error?.constructor?.name || null,
          message: error?.message || String(error),
          stack: error?.stack || null,
          code: error?.code || null
        },
        validationError: validationError?.message || null,
        uncapturedErrors,
        elapsedMs: performance.now() - startedAt
      };
    }
  }, { particleCount, corruptionMode });
  await page.close();
} finally {
  await browser.close();
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath,
  status: result?.status,
  particleCount: result?.particleCount,
  header: result?.header,
  root: result?.root,
  rootError: result?.rootError,
  rootConservation: result?.rootConservation,
  conservationFailureCount: result?.conservationFailureCount,
  receipt: result?.receipt,
  traversalAggregate: result?.traversalAggregate,
  compileErrorCount: result?.compileErrorCount,
  outerValidationError: result?.outerValidationError,
  uncapturedErrors: result?.uncapturedErrors,
  performance: result?.performance,
  lifecycle: result?.lifecycle,
  error: result?.error,
  validationError: result?.validationError
}, null, 2));
if (result?.status !== 'passed') process.exitCode = 1;
