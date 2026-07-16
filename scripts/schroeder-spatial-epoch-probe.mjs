import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_SPATIAL_EPOCH_BASE_URL || 'https://127.0.0.1:5174/';
const outputPath = process.env.ULG_SPATIAL_EPOCH_OUTPUT
  || '/tmp/ulg-schroeder-spatial-epoch-probe.json';

const HEADER = Object.freeze({
  magic: 0,
  version: 1,
  status: 2,
  generation: 3,
  sourceCount: 16,
  sourceCapacity: 17,
  cellCount: 18,
  cellCapacity: 19,
  logicalRequiredWords: 20,
  logicalAdmittedWords: 21,
  directoryCapacityWords: 22,
  invalidSourceCount: 23,
  overflowCount: 24,
  exactKeyWordCount: 25,
  sortKeyWordCount: 26,
  sortMode: 27,
  headerWords: 28,
  cellKeysOffsetWords: 29,
  cellOffsetsOffsetWords: 30,
  cellMembersOffsetWords: 31,
  particleToCellOffsetWords: 32,
  completionOrdinal: 35,
  primitiveUniqueCount: 38,
  dispatchX: 42,
  dispatchY: 43,
  dispatchZ: 44,
  clearedWords: 45,
  sourceAdapter: 46,
  physicalAddressUpperBoundWords: 47
});

function chromiumArgs() {
  const extra = String(process.env.ULG_SPATIAL_EPOCH_CHROMIUM_ARGS || '').trim();
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    ...(extra ? extra.split(/\s+/) : [])
  ];
}

function equalArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function decodeCase(result, name) {
  const entry = result.cases[name];
  const words = entry.directory;
  const header = words.slice(0, 48);
  const cellCount = header[HEADER.cellCount];
  const cellKeysOffset = header[HEADER.cellKeysOffsetWords];
  const cellOffsetsOffset = header[HEADER.cellOffsetsOffsetWords];
  const cellMembersOffset = header[HEADER.cellMembersOffsetWords];
  const reverseOffset = header[HEADER.particleToCellOffsetWords];
  return {
    ...entry,
    header,
    cellKeys: words.slice(cellKeysOffset, cellKeysOffset + cellCount * 5),
    cellOffsets: words.slice(cellOffsetsOffset, cellOffsetsOffset + cellCount + 1),
    cellMembers: words.slice(
      cellMembersOffset,
      cellMembersOffset + header[HEADER.sourceCount]
    ),
    particleToCell: words.slice(reverseOffset, reverseOffset + header[HEADER.sourceCount]),
    queryEvidence: words.slice(
      reverseOffset + header[HEADER.sourceCount],
      reverseOffset + header[HEADER.sourceCount] + 6
    )
  };
}

function evaluateChecks(raw) {
  const bounded = decodeCase(raw, 'bounded');
  const exact = decodeCase(raw, 'exact');
  const invalid = decodeCase(raw, 'invalidStatus');
  const nearIntegral = decodeCase(raw, 'nearIntegralIdentity');
  const atlasOverflow = decodeCase(raw, 'atlasOverflow');
  const capacity = decodeCase(raw, 'capacityOverflow');
  const queryAuthenticated = decodeCase(raw, 'queryAuthenticated');
  const boundary4097 = decodeCase(raw, 'boundary4097');
  const boundary513 = decodeCase(raw, 'boundary513Reuse');
  const empty = decodeCase(raw, 'emptyReuse');
  const expectedKeys = [
    0, 0x7fff_ffff, 0x8000_0000, 0x8000_0000, 0x8000_0000,
    0, 0x8000_0000, 0x7fff_ffff, 0x8000_0000, 0x8000_0000,
    0, 0x8000_0000, 0x8000_0000, 0x7fff_ffff, 0x8000_0000,
    0, 0x8000_0000, 0x8000_0000, 0x8000_0000, 0x8000_0000,
    0, 0x8000_0000, 0x8000_0000, 0x8000_0000, 0x8000_0001,
    1, 0x8000_0000, 0x8000_0000, 0x8000_0000, 0x8000_0000
  ];
  const expectedOffsets = [0, 1, 3, 4, 6, 7, 8];
  const expectedMembers = [3, 2, 6, 7, 0, 1, 5, 4];
  const expectedReverse = [3, 3, 1, 0, 5, 4, 1, 2];
  const checks = [
    ['webgpu-executed', raw.status === 'gpu-evidence-ready'],
    ['runtime-does-not-create-command-encoder', raw.runtimeCommandEncoderCount === 0],
    ['runtime-does-not-submit', raw.runtimeSubmitCount === 0],
    ['runtime-does-not-map', raw.runtimeMapReadBufferCount === 0],
    ['caller-owns-all-submissions', raw.callerSubmitCount === 4],
    ['no-buffer-allocation-during-encode', raw.encodeBufferCreationCounts.every((count) => count === 0)],
    ['allocation-identities-stable', raw.allocationIdentitiesStable === true],
    ['compilation-clean', raw.compilationErrors.length === 0],
    ['validation-clean', raw.validationErrors.length === 0],
    ['uncaptured-clean', raw.uncapturedErrors.length === 0],
    ['bounded-header-admitted', bounded.header[HEADER.status] === 3],
    ['bounded-header-identity', bounded.header[HEADER.magic] === 0x53534531
      && bounded.header[HEADER.version] === 1
      && bounded.header[HEADER.generation] === 11],
    ['bounded-counts', bounded.header[HEADER.sourceCount] === 8
      && bounded.header[HEADER.sourceCapacity] === 8
      && bounded.header[HEADER.cellCount] === 6
      && bounded.header[HEADER.cellCapacity] === 8],
    ['bounded-evidence-words', bounded.header[HEADER.logicalRequiredWords] === 101
      && bounded.header[HEADER.logicalAdmittedWords] === 101
      && bounded.header[HEADER.directoryCapacityWords] === 119
      && bounded.header[HEADER.physicalAddressUpperBoundWords] === 113
      && bounded.header[HEADER.clearedWords] === 67],
    ['bounded-sort-mode', bounded.header[HEADER.exactKeyWordCount] === 5
      && bounded.header[HEADER.sortKeyWordCount] === 1
      && bounded.header[HEADER.sortMode] === 1
      && bounded.header[HEADER.sourceAdapter] === 1],
    ['bounded-completion', bounded.header[HEADER.completionOrdinal] === 21
      && bounded.header[HEADER.primitiveUniqueCount] === 6],
    ['bounded-dispatch', equalArray(bounded.dispatch, [1, 1, 1])],
    ['bounded-cell-keys', equalArray(bounded.cellKeys, expectedKeys)],
    ['bounded-cell-offsets', equalArray(bounded.cellOffsets, expectedOffsets)],
    ['bounded-stable-members', equalArray(bounded.cellMembers, expectedMembers)],
    ['bounded-reverse-map', equalArray(bounded.particleToCell, expectedReverse)],
    ['exact-header-admitted', exact.header[HEADER.status] === 3],
    ['exact-sort-mode', exact.header[HEADER.sortKeyWordCount] === 5
      && exact.header[HEADER.sortMode] === 2
      && exact.header[HEADER.sourceAdapter] === 1],
    ['exact-cell-keys-match-bounded', equalArray(exact.cellKeys, bounded.cellKeys)],
    ['exact-offsets-match-bounded', equalArray(exact.cellOffsets, bounded.cellOffsets)],
    ['exact-members-match-bounded', equalArray(exact.cellMembers, bounded.cellMembers)],
    ['exact-reverse-match-bounded', equalArray(exact.particleToCell, bounded.particleToCell)],
    ['invalid-status-fails-closed', invalid.header[HEADER.status] === 13
      && invalid.header[HEADER.invalidSourceCount] === 1
      && invalid.header[HEADER.cellCount] === 0
      && invalid.header[HEADER.logicalAdmittedWords] === 0
      && equalArray(invalid.dispatch, [0, 0, 0])],
    ['near-integral-identity-fails-closed', nearIntegral.header[HEADER.status] === 13
      && nearIntegral.header[HEADER.invalidSourceCount] === 1
      && nearIntegral.header[HEADER.cellCount] === 0
      && nearIntegral.header[HEADER.logicalAdmittedWords] === 0
      && equalArray(nearIntegral.dispatch, [0, 0, 0])],
    ['atlas-overflow-fails-closed', atlasOverflow.header[HEADER.status] === 13
      && atlasOverflow.header[HEADER.invalidSourceCount] === 1
      && atlasOverflow.header[HEADER.cellCount] === 0
      && equalArray(atlasOverflow.dispatch, [0, 0, 0])],
    ['capacity-overflow-fails-closed', capacity.header[HEADER.status] === 21
      && capacity.header[HEADER.overflowCount] > 0
      && capacity.header[HEADER.cellCount] === 0
      && capacity.header[HEADER.logicalAdmittedWords] === 0
      && equalArray(capacity.dispatch, [0, 0, 0])],
    ['query-profile-authenticated', queryAuthenticated.header[HEADER.status] === 3
      && queryAuthenticated.header[HEADER.sourceAdapter] === 2
      && queryAuthenticated.header[HEADER.cellCount] === 5
      && queryAuthenticated.header[HEADER.logicalRequiredWords] === 101
      && queryAuthenticated.header[HEADER.physicalAddressUpperBoundWords] === 119
      && equalArray(
        queryAuthenticated.queryEvidence,
        [0, 0xffff_ffff, 0, 0x3f00_0000, 3, 0]
      )],
    ['boundary-4097-multilevel-csr', boundary4097.header[HEADER.status] === 3
      && boundary4097.header[HEADER.sourceCount] === 4097
      && boundary4097.header[HEADER.cellCount] === 4097
      && boundary4097.header[HEADER.logicalRequiredWords] === 32825
      && boundary4097.header[HEADER.physicalAddressUpperBoundWords] === 32825
      && boundary4097.cellOffsets.every((value, index) => value === index)
      && boundary4097.cellMembers.every((value, index) => value === index)
      && boundary4097.particleToCell.every((value, index) => value === index)],
    ['boundary-4097-two-dimensional-dispatch',
      equalArray(boundary4097.dispatch, [16, 5, 1])
      && equalArray(boundary4097.keyDispatchWorkgroups, [16, 5, 1])
      && equalArray(boundary4097.assembleDispatchWorkgroups, [16, 5, 1])],
    ['boundary-513-same-arena-variable-reuse', boundary513.header[HEADER.status] === 3
      && boundary513.header[HEADER.sourceCount] === 513
      && boundary513.header[HEADER.cellCount] === 513
      && boundary513.header[HEADER.logicalRequiredWords] === 4153
      && boundary513.header[HEADER.physicalAddressUpperBoundWords] === 29241
      && boundary513.arenaGeneration === boundary4097.arenaGeneration + 1
      && boundary513.spatialBindGroupReuseCount >= 3
      && boundary513.cellOffsets.every((value, index) => value === index)
      && boundary513.cellMembers.every((value, index) => value === index)
      && boundary513.particleToCell.every((value, index) => value === index)],
    ['empty-same-arena-reuse', empty.header[HEADER.status] === 3
      && empty.header[HEADER.sourceCount] === 0
      && empty.header[HEADER.cellCount] === 0
      && empty.header[HEADER.logicalRequiredWords] === 49
      && empty.header[HEADER.physicalAddressUpperBoundWords] === 20534
      && empty.arenaGeneration === boundary513.arenaGeneration + 1
      && equalArray(empty.dispatch, [0, 0, 0])]
  ].map(([name, passed]) => ({ name, passed: Boolean(passed) }));
  return {
    checks,
    passed: checks.filter((check) => check.passed).length,
    unsatisfiedChecks: checks.filter((check) => !check.passed).map((check) => check.name),
    total: checks.length,
    decoded: {
      bounded,
      exact,
      invalid,
      nearIntegral,
      atlasOverflow,
      capacity,
      queryAuthenticated,
      boundary4097,
      boundary513,
      empty
    }
  };
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.ULG_SPATIAL_EPOCH_CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: chromiumArgs()
  });
  let raw;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    raw = await page.evaluate(async () => {
      if (!navigator.gpu) return { status: 'unsupported', reason: 'navigator.gpu unavailable' };
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const nativeDevice = await adapter.requestDevice();
      const uncapturedErrors = [];
      nativeDevice.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      const counters = {
        runtimeCommandEncoderCount: 0,
        runtimeSubmitCount: 0,
        runtimeMapReadBufferCount: 0,
        runtimeBufferCreateCount: 0,
        callerSubmitCount: 0
      };
      const shaderModules = [];
      const queueFacade = new Proxy(nativeDevice.queue, {
        get(target, property) {
          if (property === 'submit') {
            return (commandBuffers) => {
              counters.runtimeSubmitCount += 1;
              return target.submit(commandBuffers);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const runtimeDevice = new Proxy(nativeDevice, {
        get(target, property) {
          if (property === 'queue') return queueFacade;
          if (property === 'createCommandEncoder') {
            return (descriptor) => {
              counters.runtimeCommandEncoderCount += 1;
              return target.createCommandEncoder(descriptor);
            };
          }
          if (property === 'createBuffer') {
            return (descriptor) => {
              counters.runtimeBufferCreateCount += 1;
              if ((descriptor.usage & GPUBufferUsage.MAP_READ) !== 0) {
                counters.runtimeMapReadBufferCount += 1;
              }
              return target.createBuffer(descriptor);
            };
          }
          if (property === 'createShaderModule') {
            return (descriptor) => {
              const module = target.createShaderModule(descriptor);
              shaderModules.push({ label: descriptor.label || '', module });
              return module;
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });

      nativeDevice.pushErrorScope('validation');
      const runtimeModule = await import(
        `/src/runtime/sph/schroederSpatialEpochGpu.js?nativeProbe=${Date.now()}`
      );
      const abi = await import(`/ulg-gpu-abi/src/schroederSpatialEpoch.js?nativeProbe=${Date.now()}`);
      const atlas = {
        chartMin: 0,
        chartCount: 2,
        levelMin: -1,
        levelCount: 2,
        cellMin: [-1, -1, 0],
        cellCount: [2, 2, 2]
      };
      const positions = [
        [0.1, 0.1, 0.1],
        [0.49, 0.25, 0],
        [-0.1, 0.1, 0.1],
        [0.1, 0.1, 0.1],
        [0.1, 0.1, 0.1],
        [0.1, 0.1, 0.6],
        [-0.2, 0.2, 0.2],
        [0.1, -0.1, 0.1]
      ];
      const levels = [0, 0, 0, -1, 0, 0, 0, 0];
      const spacings = [0.5, 0.5, 0.5, 0.25, 0.5, 0.5, 0.5, 0.5];
      const charts = [0, 0, 0, 0, 1, 0, 0, 0];
      const activeRows = ({
        invalidStatusIndex = null,
        nearIntegralIndex = null,
        forceChartId = null
      } = {}) => {
        const rows = new Float32Array(8 * 16);
        for (let index = 0; index < 8; index += 1) {
          const offset = index * 16;
          rows[offset] = levels[index];
          rows[offset + 8] = spacings[index];
          rows[offset + 9] = spacings[index] * 2;
          rows[offset + 10] = index === nearIntegralIndex ? index + 0.00005 : index;
          rows[offset + 11] = index === invalidStatusIndex ? 32 : 1;
          rows[offset + 12] = positions[index][0];
          rows[offset + 13] = positions[index][1];
          rows[offset + 14] = positions[index][2];
          rows[offset + 15] = forceChartId ?? charts[index];
        }
        return rows;
      };
      const sourceBuffer = (label, rows) => {
        const buffer = nativeDevice.createBuffer({
          label,
          size: rows.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        nativeDevice.queue.writeBuffer(buffer, 0, rows);
        return buffer;
      };
      const validSource = sourceBuffer('spatial-probe-valid-source', activeRows());
      const invalidSource = sourceBuffer(
        'spatial-probe-invalid-source',
        activeRows({ invalidStatusIndex: 2 })
      );
      const nearIntegralSource = sourceBuffer(
        'spatial-probe-near-integral-source',
        activeRows({ nearIntegralIndex: 2 })
      );
      const querySource = sourceBuffer(
        'spatial-probe-query-authenticated-source',
        activeRows({ forceChartId: 0 })
      );
      const runtime = runtimeModule.createSchroederSpatialEpochGpu(runtimeDevice, {
        maxSourceCount: 8,
        cellCapacity: 8,
        arenaCount: 6,
        label: 'native-spatial-probe'
      });
      const capacityRuntime = runtimeModule.createSchroederSpatialEpochGpu(runtimeDevice, {
        maxSourceCount: 8,
        cellCapacity: 4,
        arenaCount: 1,
        label: 'native-spatial-capacity-probe'
      });
      const allocationBuffersBefore = [
        ...runtime.allocationEntries(),
        ...capacityRuntime.allocationEntries()
      ].map((entry) => entry.buffer);
      const encoder = nativeDevice.createCommandEncoder({ label: 'spatial-probe-caller-encoder' });
      const cases = {};
      const executions = [];
      const readbacks = [];
      const encodeBufferCreationCounts = [];
      const encodeCase = (name, targetRuntime, options) => {
        const bufferCountBefore = counters.runtimeBufferCreateCount;
        const execution = targetRuntime.encode(encoder, options);
        encodeBufferCreationCounts.push(counters.runtimeBufferCreateCount - bufferCountBefore);
        executions.push({ runtime: targetRuntime, execution });
        const directoryReadback = nativeDevice.createBuffer({
          label: `${name}-directory-readback`,
          size: execution.layout.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const dispatchReadback = nativeDevice.createBuffer({
          label: `${name}-dispatch-readback`,
          size: 12,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(
          execution.directoryBuffer,
          0,
          directoryReadback,
          0,
          execution.layout.byteLength
        );
        encoder.copyBufferToBuffer(
          execution.consumerDispatchBuffer,
          0,
          dispatchReadback,
          0,
          12
        );
        readbacks.push({ name, execution, directoryReadback, dispatchReadback });
      };
      encodeCase('bounded', runtime, {
        activeNodeBuffer: validSource,
        sourceCount: 8,
        sortMode: 'bounded-atlas-u32',
        atlas,
        generationId: 11,
        buildOrdinal: 21,
        sortUniqueOrdinal: 31,
        deviceOrdinal: 41,
        laneOrdinal: 42,
        sourceFamilyId: 43,
        storageGeneration: 44,
        physicsTick: 45,
        physicsSubstep: 2,
        positionEpoch: 46,
        topologyEpoch: 47,
        chartEpoch: 48,
        levelEpoch: 49,
        supportEpoch: 50,
        leaseToken: 51
      });
      encodeCase('exact', runtime, {
        activeNodeBuffer: validSource,
        sourceCount: 8,
        sortMode: 'lexicographic-u32x5',
        generationId: 12,
        buildOrdinal: 22
      });
      encodeCase('invalidStatus', runtime, {
        activeNodeBuffer: invalidSource,
        sourceCount: 8,
        sortMode: 'bounded-atlas-u32',
        atlas,
        generationId: 13,
        buildOrdinal: 23
      });
      encodeCase('nearIntegralIdentity', runtime, {
        activeNodeBuffer: nearIntegralSource,
        sourceCount: 8,
        sortMode: 'bounded-atlas-u32',
        atlas,
        generationId: 16,
        buildOrdinal: 26
      });
      encodeCase('atlasOverflow', runtime, {
        activeNodeBuffer: validSource,
        sourceCount: 8,
        sortMode: 'bounded-atlas-u32',
        atlas: { ...atlas, chartCount: 1 },
        generationId: 14,
        buildOrdinal: 24
      });
      encodeCase('queryAuthenticated', runtime, {
        activeNodeBuffer: querySource,
        sourceCount: 8,
        sortMode: 'lexicographic-u32x5',
        generationId: 17,
        buildOrdinal: 27,
        exactNearQueryProfile: {
          schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
          status: 'schroeder-spatial-exact-near-query-profile-ready',
          ready: true,
          sourceCount: 8,
          chartId: 0,
          minLevel: -1,
          maxLevel: 0,
          levelCount: 2,
          baseGridSpacingM: 0.5,
          levelSpacingMode: 'base-grid-spacing-times-pow2-level',
          positionAuthority: 'same-epoch-pre-integration-particle-state'
        }
      });
      encodeCase('capacityOverflow', capacityRuntime, {
        activeNodeBuffer: validSource,
        sourceCount: 8,
        sortMode: 'bounded-atlas-u32',
        atlas,
        generationId: 15,
        buildOrdinal: 25
      });
      const allocationBuffersAfter = [
        ...runtime.allocationEntries(),
        ...capacityRuntime.allocationEntries()
      ].map((entry) => entry.buffer);
      let allocationIdentitiesStable = allocationBuffersBefore.length === allocationBuffersAfter.length
        && allocationBuffersBefore.every((buffer, index) => buffer === allocationBuffersAfter[index]);
      counters.callerSubmitCount += 1;
      nativeDevice.queue.submit([encoder.finish()]);
      const submissionFence = nativeDevice.queue.onSubmittedWorkDone();
      await submissionFence;
      for (const entry of readbacks) {
        await entry.directoryReadback.mapAsync(GPUMapMode.READ);
        await entry.dispatchReadback.mapAsync(GPUMapMode.READ);
        cases[entry.name] = {
          directory: Array.from(new Uint32Array(entry.directoryReadback.getMappedRange().slice(0))),
          dispatch: Array.from(new Uint32Array(entry.dispatchReadback.getMappedRange().slice(0))),
          radixPassCount: entry.execution.radixPassCount,
          encodedDispatchCount: entry.execution.encodedDispatchCount,
          keyDispatchWorkgroups: entry.execution.keyDispatchWorkgroups,
          assembleDispatchWorkgroups: entry.execution.assembleDispatchWorkgroups,
          arenaGeneration: entry.execution.arenaGeneration,
          spatialBindGroupReuseCount: entry.execution.spatialBindGroupReuseCount,
          paramsWriteCount: entry.execution.paramsWriteCount,
          retainedGpuBufferBytes: entry.execution.retainedGpuBufferBytes
        };
        entry.directoryReadback.unmap();
        entry.dispatchReadback.unmap();
        entry.directoryReadback.destroy();
        entry.dispatchReadback.destroy();
      }
      for (const entry of executions) {
        entry.runtime.markExecutionSubmitted(entry.execution);
        await entry.runtime.releaseExecutionAfter(entry.execution, submissionFence);
      }

      // Exercise the retained variable-count path across real fence-delimited
      // arena reuse. A deliberately reported x-dimension limit of 16 forces
      // key, assembly, radix, and consumer dispatches into 2-D shapes without
      // requiring millions of rows on the native probe device.
      const limitedLimits = new Proxy(nativeDevice.limits, {
        get(target, property) {
          if (property === 'maxComputeWorkgroupsPerDimension') return 16;
          return Reflect.get(target, property, target);
        }
      });
      const limitedRuntimeDevice = new Proxy(runtimeDevice, {
        get(target, property) {
          if (property === 'limits') return limitedLimits;
          return Reflect.get(target, property, target);
        }
      });
      const boundaryCount = 4097;
      const boundaryRows = new Float32Array(boundaryCount * 16);
      for (let index = 0; index < boundaryCount; index += 1) {
        const offset = index * 16;
        boundaryRows[offset] = 0;
        boundaryRows[offset + 8] = 1;
        boundaryRows[offset + 9] = 2;
        boundaryRows[offset + 10] = index;
        boundaryRows[offset + 11] = 1;
        boundaryRows[offset + 12] = index;
        boundaryRows[offset + 13] = 0;
        boundaryRows[offset + 14] = 0;
        boundaryRows[offset + 15] = 0;
      }
      const boundarySource = sourceBuffer('spatial-probe-boundary-source', boundaryRows);
      const boundaryAtlas = {
        chartMin: 0,
        chartCount: 1,
        levelMin: 0,
        levelCount: 1,
        cellMin: [0, 0, 0],
        cellCount: [boundaryCount, 1, 1]
      };
      const boundaryRuntime = runtimeModule.createSchroederSpatialEpochGpu(
        limitedRuntimeDevice,
        {
          maxSourceCount: boundaryCount,
          cellCapacity: boundaryCount,
          arenaCount: 1,
          label: 'native-spatial-boundary-probe'
        }
      );
      const boundaryAllocationsBefore = boundaryRuntime.allocationEntries()
        .map((entry) => entry.buffer);
      const runBoundaryCase = async (name, sourceCount, generationId) => {
        const boundaryEncoder = nativeDevice.createCommandEncoder({
          label: `${name}-caller-encoder`
        });
        const bufferCountBefore = counters.runtimeBufferCreateCount;
        const execution = boundaryRuntime.encode(boundaryEncoder, {
          activeNodeBuffer: boundarySource,
          sourceCount,
          sortMode: 'bounded-atlas-u32',
          atlas: boundaryAtlas,
          generationId,
          buildOrdinal: generationId
        });
        encodeBufferCreationCounts.push(counters.runtimeBufferCreateCount - bufferCountBefore);
        const directoryReadback = nativeDevice.createBuffer({
          label: `${name}-directory-readback`,
          size: execution.layout.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const dispatchReadback = nativeDevice.createBuffer({
          label: `${name}-dispatch-readback`,
          size: 12,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        boundaryEncoder.copyBufferToBuffer(
          execution.directoryBuffer,
          0,
          directoryReadback,
          0,
          execution.layout.byteLength
        );
        boundaryEncoder.copyBufferToBuffer(
          execution.consumerDispatchBuffer,
          0,
          dispatchReadback,
          0,
          12
        );
        counters.callerSubmitCount += 1;
        nativeDevice.queue.submit([boundaryEncoder.finish()]);
        boundaryRuntime.markExecutionSubmitted(execution);
        const fence = nativeDevice.queue.onSubmittedWorkDone();
        await fence;
        await directoryReadback.mapAsync(GPUMapMode.READ);
        await dispatchReadback.mapAsync(GPUMapMode.READ);
        cases[name] = {
          directory: Array.from(new Uint32Array(directoryReadback.getMappedRange().slice(0))),
          dispatch: Array.from(new Uint32Array(dispatchReadback.getMappedRange().slice(0))),
          radixPassCount: execution.radixPassCount,
          encodedDispatchCount: execution.encodedDispatchCount,
          keyDispatchWorkgroups: execution.keyDispatchWorkgroups,
          assembleDispatchWorkgroups: execution.assembleDispatchWorkgroups,
          arenaGeneration: execution.arenaGeneration,
          spatialBindGroupReuseCount: execution.spatialBindGroupReuseCount,
          paramsWriteCount: execution.paramsWriteCount,
          retainedGpuBufferBytes: execution.retainedGpuBufferBytes
        };
        directoryReadback.unmap();
        dispatchReadback.unmap();
        directoryReadback.destroy();
        dispatchReadback.destroy();
        await boundaryRuntime.releaseExecutionAfter(execution, fence);
      };
      await runBoundaryCase('boundary4097', 4097, 61);
      await runBoundaryCase('boundary513Reuse', 513, 62);
      await runBoundaryCase('emptyReuse', 0, 63);
      const boundaryAllocationsAfter = boundaryRuntime.allocationEntries()
        .map((entry) => entry.buffer);
      allocationIdentitiesStable = allocationIdentitiesStable
        && boundaryAllocationsBefore.length === boundaryAllocationsAfter.length
        && boundaryAllocationsBefore.every(
          (buffer, index) => buffer === boundaryAllocationsAfter[index]
        );
      boundaryRuntime.destroy();
      boundarySource.destroy();

      runtime.destroy();
      capacityRuntime.destroy();
      validSource.destroy();
      invalidSource.destroy();
      nearIntegralSource.destroy();
      querySource.destroy();

      const compilationErrors = [];
      for (const { label, module } of shaderModules) {
        if (typeof module.getCompilationInfo !== 'function') continue;
        const info = await module.getCompilationInfo();
        for (const message of info.messages || []) {
          if (message.type === 'error') compilationErrors.push(`${label}: ${message.message}`);
        }
      }
      const validationError = await nativeDevice.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        status: 'gpu-evidence-ready',
        ...counters,
        encodeBufferCreationCounts,
        allocationIdentitiesStable,
        cases,
        compilationErrors,
        validationErrors: validationError ? [validationError.message] : [],
        uncapturedErrors,
        adapterInfo: adapter.info || null,
        abiHeaderWords: abi.SCHROEDER_SPATIAL_EPOCH_HEADER_WORDS
      };
    });
  } finally {
    await browser.close();
  }
  const evaluation = raw?.status === 'gpu-evidence-ready'
    ? evaluateChecks(raw)
    : {
        checks: [],
        passed: 0,
        unsatisfiedChecks: [raw?.reason || 'probe did not execute'],
        total: 0
      };
  const report = {
    schema: 'peercompute.ulg.schroeder-spatial-epoch-native-probe.v1',
    timestamp: new Date().toISOString(),
    baseUrl,
    status: evaluation.unsatisfiedChecks.length === 0 ? 'pass' : 'fail',
    ...evaluation,
    raw
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
