import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://127.0.0.1:5173';
const outputPath = process.env.ULG_GAS_CELL_EOS_PROBE_OUTPUT
  || '/tmp/ulg-sph-spatial-gas-cell-eos-gpu.json';
const gpuTimestampProfilingRequested = process.env.ULG_NATIVE_GPU_PROFILE !== '0';
const chromiumArgs = [
  '--use-angle=vulkan',
  '--enable-features=Vulkan,UseSkiaRenderer',
  '--enable-unsafe-webgpu'
];

function closeEnough(actual, expected, relativeTolerance = 2e-5) {
  const scale = Math.max(1, Math.abs(expected));
  return Number.isFinite(actual) && Math.abs(actual - expected) <= scale * relativeTolerance;
}

const browser = await chromium.launch({ headless: true, args: chromiumArgs });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
const browserIssues = [];
page.on('pageerror', (error) => browserIssues.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    browserIssues.push(`${message.type()}: ${message.text()}`);
  }
});

let evidence;
try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  evidence = await page.evaluate(async ({ gpuTimestampProfilingRequested }) => {
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { blocked: 'webgpu-adapter-unavailable' };
    if (adapter.limits.maxStorageBuffersPerShaderStage < 10) {
      return {
        blocked: 'maxStorageBuffersPerShaderStage-below-production-contract',
        maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage
      };
    }
    const timestampQuerySupported = adapter.features?.has?.('timestamp-query') === true;
    const device = await adapter.requestDevice({
      requiredFeatures: gpuTimestampProfilingRequested && timestampQuerySupported
        ? ['timestamp-query']
        : [],
      requiredLimits: { maxStorageBuffersPerShaderStage: 10 }
    });
    const gas = await import('/src/runtime/sph/sphSpatialGasCellEosGpu.js');
    const pressure = await import('/src/runtime/sph/sphPressureInterfaceGpuKernel.js');
    const identityApi = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');
    const identity = {
      schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
      authoritative: true,
      leaseId: 'native-gas-eos-pressure-lease-1',
      laneId: 'ulg:sph:native-gas-eos-pressure',
      stateKey: 'ulg:sph:native-gas-eos-pressure-state',
      sourceFamily: 'sph-particle-state',
      domainKey: 'manufactured-box:0',
      solverId: 'ulg-sph-gas-cell-eos-producer-stage',
      taskId: 'native-gas-eos-pressure-task',
      owner: 'compute-manager-native-probe'
    };
    const lane = gas.getOrCreateSphSpatialGasCellEosGpuLane(device, {
      sourceCapacity: 4,
      gasCellCapacity: 5,
      maxGridCellCount: 4,
      laneId: identity.laneId,
      stateKey: identity.stateKey,
      sourceFamily: identity.sourceFamily,
      requireLaneIdentity: true
    });
    const interfaceField = {
      schema: 'peercompute.ulg.sph-material-interface-field.v0',
      status: 'material-interface-field-ready',
      elementCount: 2,
      elements: [
        {
          status: 'interface-element-ready',
          surfaceIndex: 0,
          materialId: 1,
          phaseId: 2,
          centroidM: [0.25, 0.5, 0.5],
          areaM2: 1,
          normal: [1, 0, 0],
          normalAreaVectorM2: [1, 0, 0],
          gapM: 0.1,
          normalVelocityMPerS: 0,
          representativeMassKg: 0
        },
        {
          status: 'interface-element-ready',
          surfaceIndex: 0,
          materialId: 1,
          phaseId: 2,
          centroidM: [1.25, 0.5, 0.5],
          areaM2: 1,
          normal: [-1, 0, 0],
          normalAreaVectorM2: [-1, 0, 0],
          gapM: 0.1,
          normalVelocityMPerS: 0,
          representativeMassKg: 0
        }
      ]
    };

    function productRows(temperatureScale, permuted) {
      const records = [
        { x: 0.25, moles: 0.5, temperatureK: 300 * temperatureScale, volumeM3: 0.5 },
        { x: 0.25, moles: 0.5, temperatureK: 300 * temperatureScale, volumeM3: 0.5 },
        { x: 1.25, moles: 1, temperatureK: 600 * temperatureScale, volumeM3: 1 },
        null
      ];
      if (permuted) records.reverse();
      const rows = new Float32Array(records.length * 32);
      for (const [index, record] of records.entries()) {
        if (!record) continue;
        const offset = index * 32;
        rows[offset] = record.x;
        rows[offset + 1] = 0.5;
        rows[offset + 2] = 0.5;
        rows[offset + 3] = 0.1;
        rows[offset + 9] = record.moles;
        rows[offset + 10] = 1;
        rows[offset + 16] = record.temperatureK;
        rows[offset + 18] = 1;
        rows[offset + 23] = record.volumeM3;
      }
      return rows;
    }

    async function readBuffer(source, byteLength) {
      const readback = device.createBuffer({
        size: Math.max(4, byteLength),
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(source, 0, readback, 0, byteLength);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const copy = readback.getMappedRange().slice(0, byteLength);
      readback.unmap();
      readback.destroy();
      return copy;
    }

    async function runCase({ name, sourceEpoch, sourceGeneration, temperatureScale, permuted }) {
      const rows = productRows(temperatureScale, permuted);
      const sourceBuffer = identityApi.tagWebGpuBufferDevice(device.createBuffer({
        label: `${name}-product-events`,
        size: rows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }), device);
      device.queue.writeBuffer(sourceBuffer, 0, rows);
      const source = gas.resolveSphSpatialGasCellEosGpuSource({
        productEventBuffer: sourceBuffer,
        productEventBufferRetained: true,
        productEventRowCount: 4,
        productEventStrideFloats: 32,
        sourceEpoch,
        sourceGeneration,
        sourceTaskId: `${name}-reaction-product-task`
      });
      device.pushErrorScope('validation');
      const gasResult = await gas.runSphSpatialGasCellEosGpu({
        device,
        lane,
        source,
        gridDims: [2, 2, 1],
        boxDimsM: [2, 1, 1],
        gpuResidentLaneLeaseIdentity: identity,
        awaitQueueFence: true,
        measureGpuTimestamps: gpuTimestampProfilingRequested,
        timestampMetadata: { probe: 'sph-spatial-gas-cell-eos', caseName: name }
      });
      const pressureResult = await pressure.runSphPressureInterfaceForceRowsWebGpu({
        device,
        pressureFeedback: { totalPressurePa: 0 },
        pressureInterfaceCoupling: {
          status: 'pressure-interface-coupling-ready-for-solver',
          forceCouplingStatus: 'pressure-interface-coupling-ready'
        },
        materialInterfaceField: interfaceField,
        gpuResidentLaneLeaseIdentity: identity,
        expectedGasPressureCellSourceEpoch: sourceEpoch,
        expectedGasPressureCellSourceGeneration: sourceGeneration,
        retainedGasPressureCellImport: gasResult,
        retainForceRowsBuffer: true,
        readbackMode: 'no-full-readback'
      });
      await device.queue.onSubmittedWorkDone();
      const [metadataCopy, pressureRowsCopy, forceRowsCopy] = await Promise.all([
        readBuffer(gasResult.gasPressureCellMetadataBuffer, gas.SPH_GAS_CELL_EOS_METADATA_BYTES),
        readBuffer(gasResult.gasPressureCellsBuffer, 2 * 12 * Float32Array.BYTES_PER_ELEMENT),
        readBuffer(pressureResult.forceRowsBuffer, 2 * 16 * Float32Array.BYTES_PER_ELEMENT)
      ]);
      const validationError = await device.popErrorScope();
      const metadata = Array.from(new Uint32Array(metadataCopy));
      const pressureRows = Array.from(new Float32Array(pressureRowsCopy));
      const forceRows = Array.from(new Float32Array(forceRowsCopy));
      return {
        name,
        gasResult,
        pressureResult,
        sourceBuffer,
        metadata,
        pressureRows,
        forceRows,
        validationError: validationError?.message || null,
        compact: {
          gpuStatus: metadata[gas.SPH_GAS_CELL_EOS_METADATA.status],
          admittedActiveCellCount: metadata[gas.SPH_GAS_CELL_EOS_METADATA.admittedActiveCellCount],
          invalidSourceRowCount: metadata[gas.SPH_GAS_CELL_EOS_METADATA.invalidSourceRowCount],
          overflowCount: metadata[gas.SPH_GAS_CELL_EOS_METADATA.overflowCount],
          sourceEpoch: metadata[gas.SPH_GAS_CELL_EOS_METADATA.sourceEpoch],
          sourceGeneration: metadata[gas.SPH_GAS_CELL_EOS_METADATA.sourceGeneration],
          pressuresPa: [pressureRows[7], pressureRows[19]],
          pressureGradientXPaPerM: [pressureRows[8], pressureRows[20]],
          interfacePressuresPa: [forceRows[14], forceRows[30]],
          forceReady: [forceRows[15], forceRows[31]]
        }
      };
    }

    async function runExactAuthorityCase({
      name,
      activeRowCount,
      declaredGeneration,
      metadataGeneration = declaredGeneration,
      overflowFlags = 0
    }) {
      const sourceRowCountUpperBound = 5_270;
      const arenaCapacityRows = 5_440;
      const rows = productRows(1, false);
      const sourceBuffer = identityApi.tagWebGpuBufferDevice(device.createBuffer({
        label: `${name}-exact-arena-product-events`,
        size: arenaCapacityRows * 32 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }), device);
      device.queue.writeBuffer(sourceBuffer, 0, rows.subarray(0, 3 * 32));
      const authorityMetadataBuffer = identityApi.tagWebGpuBufferDevice(device.createBuffer({
        label: `${name}-exact-arena-metadata`,
        size: 16 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
      }), device);
      const authorityDispatchBuffer = identityApi.tagWebGpuBufferDevice(device.createBuffer({
        label: `${name}-exact-arena-dispatch`,
        size: 3 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT
          | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
      }), device);
      const arenaWords = new Uint32Array(16);
      arenaWords[0] = 0x554c4750;
      arenaWords[1] = 1;
      arenaWords[2] = activeRowCount;
      arenaWords[3] = activeRowCount;
      arenaWords[4] = arenaCapacityRows;
      arenaWords[6] = overflowFlags;
      arenaWords[7] = metadataGeneration;
      arenaWords[8] = 32;
      arenaWords[14] = arenaCapacityRows;
      arenaWords[15] = 1;
      device.queue.writeBuffer(authorityMetadataBuffer, 0, arenaWords);
      device.queue.writeBuffer(
        authorityDispatchBuffer,
        0,
        new Uint32Array([Math.ceil(activeRowCount / 64), 1, 1])
      );
      const arena = {
        schema: 'peercompute.ulg.sph-resident-product-event-arena.v0',
        capacityRows: arenaCapacityRows,
        generationId: declaredGeneration,
        strideFloats: 32,
        metadataBuffer: authorityMetadataBuffer,
        dispatchIndirectBuffer: authorityDispatchBuffer
      };
      const residentProductMass = {
        productEventBuffer: sourceBuffer,
        productEventBufferRetained: true,
        productEventRowCount: sourceRowCountUpperBound,
        productEventStrideFloats: 32,
        productEventMetadataBuffer: authorityMetadataBuffer,
        productEventDispatchIndirectBuffer: authorityDispatchBuffer,
        productEventArena: arena
      };
      const source = gas.resolveSphSpatialGasCellEosGpuSource({
        residentProductMass,
        sourceEpoch: 31,
        sourceGeneration: 47,
        sourceTaskId: `${name}-exact-source-task`
      });
      const exactLane = gas.getOrCreateSphSpatialGasCellEosGpuLane(device, {
        sourceCapacity: sourceRowCountUpperBound,
        gasCellCapacity: 513,
        maxGridCellCount: 512,
        laneId: identity.laneId,
        stateKey: identity.stateKey,
        sourceFamily: identity.sourceFamily,
        requireLaneIdentity: true
      });
      device.pushErrorScope('validation');
      const gasResult = await gas.runSphSpatialGasCellEosGpu({
        device,
        lane: exactLane,
        source,
        gridDims: [2, 2, 1],
        boxDimsM: [2, 1, 1],
        gpuResidentLaneLeaseIdentity: identity,
        awaitQueueFence: true,
        measureGpuTimestamps: false
      });
      const [metadataCopy, pressureRowsCopy, gatedDispatchCopy] = await Promise.all([
        readBuffer(gasResult.gasPressureCellMetadataBuffer, gas.SPH_GAS_CELL_EOS_METADATA_BYTES),
        readBuffer(gasResult.gasPressureCellsBuffer, 2 * 12 * Float32Array.BYTES_PER_ELEMENT),
        readBuffer(gasResult.exactPrefixGatedDispatchBuffer, 3 * Uint32Array.BYTES_PER_ELEMENT)
      ]);
      const validationError = await device.popErrorScope();
      const metadata = Array.from(new Uint32Array(metadataCopy));
      const pressureRows = Array.from(new Float32Array(pressureRowsCopy));
      const gatedDispatch = Array.from(new Uint32Array(gatedDispatchCopy));
      const compact = {
        status: metadata[gas.SPH_GAS_CELL_EOS_METADATA.status],
        exactSourceRowCount: metadata[gas.SPH_GAS_CELL_EOS_METADATA.sourceRowCount],
        admittedActiveCellCount:
          metadata[gas.SPH_GAS_CELL_EOS_METADATA.admittedActiveCellCount],
        invalidSourceRowCount:
          metadata[gas.SPH_GAS_CELL_EOS_METADATA.invalidSourceRowCount],
        overflowCount: metadata[gas.SPH_GAS_CELL_EOS_METADATA.overflowCount],
        pressuresPa: [pressureRows[7], pressureRows[19]],
        gatedDispatch
      };
      const summary = {
        name,
        validationError: validationError?.message || null,
        ready: gasResult.ready,
        aggregationStrategy: gasResult.aggregationStrategy,
        exactPrefix: gasResult.exactPrefix,
        radixBypassed: gasResult.radixBypassed,
        encodedDispatchCount: gasResult.encodedDispatchCount,
        encodedComputePassCount: gasResult.encodedComputePassCount,
        gpuGatedIndirectDispatchCount: gasResult.gpuGatedIndirectDispatchCount,
        exactPrefixStaticSourceCapacityBound: gasResult.exactPrefixStaticSourceCapacityBound,
        exactPrefixStaticOperationBound: gasResult.exactPrefixStaticOperationBound,
        laneCapacityClass: gasResult.residentGasCellEosLaneCapacityClass,
        mapAsyncCalledInHotPath: gasResult.mapAsyncCalled,
        fullReadbackPerformedInHotPath: gasResult.fullReadbackPerformed,
        compact
      };
      gasResult.retire({ reason: `${name}-exact-native-probe-complete` });
      await device.queue.onSubmittedWorkDone();
      sourceBuffer.destroy();
      authorityMetadataBuffer.destroy();
      authorityDispatchBuffer.destroy();
      return summary;
    }

    const timeZero = await runCase({
      name: 'time-zero',
      sourceEpoch: 0,
      sourceGeneration: 1,
      temperatureScale: 1,
      permuted: false
    });
    const continuation = await runCase({
      name: 'continuation',
      sourceEpoch: 1,
      sourceGeneration: 2,
      temperatureScale: 2,
      permuted: true
    });
    const exactActive = await runExactAuthorityCase({
      name: 'exact-active-prefix',
      activeRowCount: 3,
      declaredGeneration: 41
    });
    const exactZero = await runExactAuthorityCase({
      name: 'exact-zero-prefix',
      activeRowCount: 0,
      declaredGeneration: 42
    });
    const exactStale = await runExactAuthorityCase({
      name: 'exact-stale-generation',
      activeRowCount: 3,
      declaredGeneration: 43,
      metadataGeneration: 44
    });
    const exactOverflow = await runExactAuthorityCase({
      name: 'exact-overflow',
      activeRowCount: 3,
      declaredGeneration: 45,
      overflowFlags: 1
    });
    let staleProvenanceRejected = false;
    let staleProvenanceReason = null;
    try {
      await pressure.runSphPressureInterfaceForceRowsWebGpu({
        device,
        pressureFeedback: { totalPressurePa: 0 },
        pressureInterfaceCoupling: { status: 'pressure-interface-coupling-ready-for-solver' },
        materialInterfaceField: interfaceField,
        gpuResidentLaneLeaseIdentity: identity,
        expectedGasPressureCellSourceEpoch: 2,
        expectedGasPressureCellSourceGeneration: 2,
        retainedGasPressureCellImport: continuation.gasResult,
        readbackMode: 'no-full-readback'
      });
    } catch (error) {
      staleProvenanceRejected = true;
      staleProvenanceReason = error?.message || String(error);
    }
    const summarizeCase = (entry) => ({
      name: entry.name,
      gasStatus: entry.gasResult.status,
      pressureStatus: entry.pressureResult.status,
      pressureModelId: entry.pressureResult.pressureInterfaceForceSolver?.pressureModelId,
      metadataGuarded: entry.pressureResult.gasPressureCellGpuMetadataGuarded === true,
      rowCount: entry.pressureResult.gasPressureCellRowCount,
      rowCapacity: entry.pressureResult.gasPressureCellRowCapacity,
      rowCountSource: entry.pressureResult.gasPressureCellRowCountSource,
      normalHotLoopReadbackFree:
        entry.gasResult.normalHotLoopReadbackFree === true
        && entry.pressureResult.normalHotLoopReadbackFree === true,
      cpuDecodePerformed: entry.gasResult.cpuDecodePerformed === true,
      cpuGasCellRowsUploaded: entry.gasResult.cpuGasCellRowsUploaded === true,
      mapAsyncCalledInHotPath: entry.gasResult.mapAsyncCalled === true,
      laneCacheStatus: entry.gasResult.residentGasCellEosLaneCacheStatus,
      aggregationStrategy: entry.gasResult.aggregationStrategy,
      radixBypassed: entry.gasResult.radixBypassed === true,
      gpuTimestampProfile: entry.gasResult.gpuTimestampProfile,
      gpuTimestampStageTotals: entry.gasResult.gpuTimestampProfile?.stageTotals ?? {},
      validationError: entry.validationError,
      compact: entry.compact
    });
    const timestampCases = [timeZero, continuation].map((entry) => ({
      name: entry.name,
      aggregationStrategy: entry.gasResult.aggregationStrategy,
      profile: entry.gasResult.gpuTimestampProfile
    })).filter(({ profile }) => Boolean(profile));
    const timestampProfiles = timestampCases.map(({ profile }) => profile);
    const commonTimestampRequirements = [
      {
        id: 'dispatch-prepare',
        label: gas.SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.dispatchPrepare
      },
      { id: 'cell-reduce', label: gas.SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.cellReduce },
      { id: 'finalize', label: gas.SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.finalize },
      { id: 'gradient', label: gas.SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.gradient }
    ];
    const timestampCoverage = timestampCases.flatMap(({ name, aggregationStrategy, profile }) => {
      const routeRequirements = aggregationStrategy === 'deterministic-direct-key-sort-unique'
        ? [{ id: 'direct-group', label: gas.SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.directGroup }]
        : [
            { id: 'key-build', label: gas.SPH_SPATIAL_GAS_CELL_EOS_GPU_TIMESTAMP_STAGE.keyBuild },
            { id: 'radix', metadata: { sphGasCellEosStage: 'radix' } }
          ];
      const validTimestampSpans = (profile.spans || []).filter((span) => span.valid === true);
      return [...routeRequirements, ...commonTimestampRequirements].map((requirement) => ({
        ...requirement,
        caseName: name,
        aggregationStrategy,
        matched: validTimestampSpans.some((span) => (
          (!requirement.label || span.label === requirement.label)
          && (!requirement.metadata || Object.entries(requirement.metadata).every(
            ([key, value]) => span.metadata?.[key] === value
          ))
        ))
      }));
    });
    const missingTimestampStages = timestampCoverage
      .filter(({ matched }) => !matched)
      .map(({ caseName, id }) => `${caseName}:${id}`);
    const unsupportedStatuses = new Set(['unsupported', 'unsupported-api', 'allocation-failed']);
    const timestampUnsupported = timestampProfiles.length > 0
      && timestampProfiles.every((profile) => unsupportedStatuses.has(profile.status));
    const timestampComplete = timestampProfiles.length === 2
      && timestampProfiles.every((profile) => (
        profile.status === 'timestamp-profile-complete'
        && profile.skippedSpanCount === 0
        && profile.invalidSpanCount === 0
      ))
      && missingTimestampStages.length === 0;
    const gpuTimestampEvidence = {
      schema: 'peercompute.ulg.native-gpu-timestamp-evidence.v0',
      requested: gpuTimestampProfilingRequested,
      adapterSupported: timestampQuerySupported,
      status: !gpuTimestampProfilingRequested
        ? 'not-requested'
        : (timestampUnsupported
            ? 'inconclusive-unsupported'
            : (timestampComplete ? 'pass' : 'fail')),
      sameSubmissionResolve: timestampProfiles.every((profile) => profile.queryCount > 0)
        || timestampUnsupported
        || !gpuTimestampProfilingRequested,
      requiredStages: timestampCoverage,
      missingStageIds: missingTimestampStages,
      skippedSpanCount: timestampProfiles.reduce(
        (sum, profile) => sum + Number(profile.skippedSpanCount || 0),
        0
      ),
      invalidSpanCount: timestampProfiles.reduce(
        (sum, profile) => sum + Number(profile.invalidSpanCount || 0),
        0
      ),
      stageTotals: {
        timeZero: timeZero.gasResult.gpuTimestampProfile?.stageTotals ?? {},
        continuation: continuation.gasResult.gpuTimestampProfile?.stageTotals ?? {}
      },
      profiles: timestampProfiles
    };
    const summary = {
      adapterInfo: adapter.info || null,
      timestampQuerySupported,
      maxStorageBuffersPerShaderStage: device.limits.maxStorageBuffersPerShaderStage,
      laneReused: timeZero.gasResult.residentGasCellEosLane === continuation.gasResult.residentGasCellEosLane,
      allocationEntryCount: lane.allocationEntries().length,
      timeZero: summarizeCase(timeZero),
      continuation: summarizeCase(continuation),
      exactActive,
      exactZero,
      exactStale,
      exactOverflow,
      gpuTimestampEvidence,
      gpuTimestampStageTotals: gpuTimestampEvidence.stageTotals,
      staleProvenanceRejected,
      staleProvenanceReason
    };
    timeZero.pressureResult.destroyForceRowsBuffer?.();
    continuation.pressureResult.destroyForceRowsBuffer?.();
    timeZero.gasResult.retire({ reason: 'native-probe-complete' });
    continuation.gasResult.retire({ reason: 'native-probe-complete' });
    sourceBufferDestroy(timeZero.sourceBuffer);
    sourceBufferDestroy(continuation.sourceBuffer);
    await device.queue.onSubmittedWorkDone();
    gas.destroyCachedSphSpatialGasCellEosGpuLanes(device);
    return summary;

    function sourceBufferDestroy(buffer) {
      buffer?.destroy?.();
    }
  }, { gpuTimestampProfilingRequested });
} finally {
  await browser.close();
}

const gasConstant = 8.314462618;
const expectedBasePressure = 300 * gasConstant;
const expectedHotPressure = 600 * gasConstant;
const checks = evidence?.blocked
  ? [{ name: 'native-webgpu-ready', passed: false, actual: evidence.blocked }]
  : [
      { name: 'browser-clean', passed: browserIssues.length === 0, actual: browserIssues },
      {
        name: 'production-storage-binding-limit',
        passed: evidence.maxStorageBuffersPerShaderStage >= 10,
        actual: evidence.maxStorageBuffersPerShaderStage
      },
      { name: 'persistent-lane-reused', passed: evidence.laneReused === true, actual: evidence.laneReused },
      {
        name: 'native-validation-clean',
        passed: !evidence.timeZero.validationError && !evidence.continuation.validationError,
        actual: [evidence.timeZero.validationError, evidence.continuation.validationError]
      },
      {
        name: 'gpu-metadata-admitted-active-count',
        passed: evidence.timeZero.compact.admittedActiveCellCount === 2
          && evidence.continuation.compact.admittedActiveCellCount === 2
          && evidence.timeZero.compact.gpuStatus === 1
          && evidence.continuation.compact.gpuStatus === 1,
        actual: [evidence.timeZero.compact, evidence.continuation.compact]
      },
      {
        name: 'gpu-overflow-fail-close-clean',
        passed: evidence.timeZero.compact.overflowCount === 0
          && evidence.continuation.compact.overflowCount === 0,
        actual: [evidence.timeZero.compact.overflowCount, evidence.continuation.compact.overflowCount]
      },
      {
        name: 'time-zero-and-continuation-provenance',
        passed: evidence.timeZero.compact.sourceEpoch === 0
          && evidence.timeZero.compact.sourceGeneration === 1
          && evidence.continuation.compact.sourceEpoch === 1
          && evidence.continuation.compact.sourceGeneration === 2
          && evidence.staleProvenanceRejected === true,
        actual: {
          timeZero: [evidence.timeZero.compact.sourceEpoch, evidence.timeZero.compact.sourceGeneration],
          continuation: [evidence.continuation.compact.sourceEpoch, evidence.continuation.compact.sourceGeneration],
          staleProvenanceReason: evidence.staleProvenanceReason
        }
      },
      {
        name: 'pressure-consumer-uses-gpu-admitted-count',
        passed: evidence.timeZero.rowCount === 0
          && evidence.continuation.rowCount === 0
          && evidence.timeZero.rowCountSource === 'gpu-metadata-word-9'
          && evidence.continuation.rowCountSource === 'gpu-metadata-word-9'
          && evidence.timeZero.metadataGuarded
          && evidence.continuation.metadataGuarded,
        actual: [evidence.timeZero.rowCountSource, evidence.continuation.rowCountSource]
      },
      {
        name: 'ideal-gas-manufactured-state',
        passed: closeEnough(evidence.timeZero.compact.pressuresPa[0], expectedBasePressure)
          && closeEnough(evidence.timeZero.compact.pressuresPa[1], expectedHotPressure),
        actual: evidence.timeZero.compact.pressuresPa
      },
      {
        name: 'temperature-scale-and-permutation-metamorphic',
        passed: closeEnough(
          evidence.continuation.compact.pressuresPa[0],
          evidence.timeZero.compact.pressuresPa[0] * 2
        ) && closeEnough(
          evidence.continuation.compact.pressuresPa[1],
          evidence.timeZero.compact.pressuresPa[1] * 2
        ),
        actual: {
          baseline: evidence.timeZero.compact.pressuresPa,
          transformed: evidence.continuation.compact.pressuresPa
        }
      },
      {
        name: 'pressure-force-consumer-executed',
        passed: evidence.timeZero.pressureModelId === 1
          && evidence.continuation.pressureModelId === 1
          && evidence.timeZero.compact.forceReady.every((value) => value === 1)
          && evidence.continuation.compact.forceReady.every((value) => value === 1)
          && evidence.timeZero.compact.interfacePressuresPa.every((value) => value > 0)
          && evidence.continuation.compact.interfacePressuresPa.every((value) => value > 0),
        actual: {
          timeZero: evidence.timeZero.compact.interfacePressuresPa,
          continuation: evidence.continuation.compact.interfacePressuresPa
        }
      },
      {
        name: 'normal-hot-path-no-readback-decode-reupload',
        passed: evidence.timeZero.normalHotLoopReadbackFree
          && evidence.continuation.normalHotLoopReadbackFree
          && !evidence.timeZero.cpuDecodePerformed
          && !evidence.continuation.cpuDecodePerformed
          && !evidence.timeZero.cpuGasCellRowsUploaded
          && !evidence.continuation.cpuGasCellRowsUploaded
          && !evidence.timeZero.mapAsyncCalledInHotPath
          && !evidence.continuation.mapAsyncCalledInHotPath,
        actual: [evidence.timeZero, evidence.continuation]
      },
      {
        name: 'exact-prefix-native-validation-clean',
        passed: [
          evidence.exactActive,
          evidence.exactZero,
          evidence.exactStale,
          evidence.exactOverflow
        ].every((entry) => !entry.validationError),
        actual: [
          evidence.exactActive.validationError,
          evidence.exactZero.validationError,
          evidence.exactStale.validationError,
          evidence.exactOverflow.validationError
        ]
      },
      {
        name: 'exact-prefix-active-ideal-gas-and-command-reduction',
        passed: evidence.exactActive.exactPrefix === true
          && evidence.exactActive.radixBypassed === true
          && evidence.exactActive.aggregationStrategy === 'gpu-exact-stable-counting-radix'
          && evidence.exactActive.encodedDispatchCount === 6
          && evidence.exactActive.encodedComputePassCount === 6
          && evidence.exactActive.gpuGatedIndirectDispatchCount === 3
          && evidence.exactActive.compact.status === 1
          && evidence.exactActive.compact.exactSourceRowCount === 3
          && evidence.exactActive.compact.admittedActiveCellCount === 2
          && closeEnough(evidence.exactActive.compact.pressuresPa[0], expectedBasePressure)
          && closeEnough(evidence.exactActive.compact.pressuresPa[1], expectedHotPressure)
          && evidence.exactActive.compact.gatedDispatch[0] === 1
          && evidence.exactActive.laneCapacityClass.sourceCapacityClass === 65_536,
        actual: evidence.exactActive
      },
      {
        name: 'exact-zero-prefix-gates-all-heavy-source-work',
        passed: evidence.exactZero.exactPrefix === true
          && evidence.exactZero.compact.status === 2
          && evidence.exactZero.compact.exactSourceRowCount === 0
          && evidence.exactZero.compact.admittedActiveCellCount === 0
          && evidence.exactZero.compact.overflowCount === 0
          && evidence.exactZero.compact.gatedDispatch[0] === 0
          && !evidence.exactZero.mapAsyncCalledInHotPath
          && !evidence.exactZero.fullReadbackPerformedInHotPath,
        actual: evidence.exactZero
      },
      {
        name: 'stale-and-overflow-arena-authority-fail-closed',
        passed: evidence.exactStale.compact.status === 3
          && evidence.exactStale.compact.admittedActiveCellCount === 0
          && evidence.exactStale.compact.overflowCount > 0
          && evidence.exactStale.compact.gatedDispatch[0] === 0
          && evidence.exactOverflow.compact.status === 3
          && evidence.exactOverflow.compact.admittedActiveCellCount === 0
          && evidence.exactOverflow.compact.overflowCount > 0
          && evidence.exactOverflow.compact.gatedDispatch[0] === 0,
        actual: {
          stale: evidence.exactStale,
          overflow: evidence.exactOverflow
        }
      }
    ];

const physicsChecksPassed = checks.every((check) => check.passed);
const gpuTimestampEvidenceStatus = evidence?.gpuTimestampEvidence?.status ?? (
  gpuTimestampProfilingRequested ? 'fail' : 'not-requested'
);
const report = {
  schema: 'peercompute.ulg.sph-spatial-gas-cell-eos-native-probe.v0',
  status: !physicsChecksPassed || gpuTimestampEvidenceStatus === 'fail'
    ? 'sph-spatial-gas-cell-eos-native-probe-fail'
    : (gpuTimestampEvidenceStatus === 'inconclusive-unsupported'
        ? 'sph-spatial-gas-cell-eos-native-probe-inconclusive-unsupported'
        : 'sph-spatial-gas-cell-eos-native-probe-pass'),
  baseUrl,
  chromiumArgs,
  gpuTimestampProfilingRequested,
  gpuTimestampEvidenceStatus,
  gpuTimestampStageTotals: evidence?.gpuTimestampStageTotals ?? {},
  browserIssues,
  evidence,
  checks
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  status: report.status,
  outputPath,
  passed: checks.filter((check) => check.passed).length,
  total: checks.length,
  failed: checks.filter((check) => !check.passed).map((check) => check.name)
}, null, 2));
if (!physicsChecksPassed || gpuTimestampEvidenceStatus === 'fail') process.exitCode = 1;
