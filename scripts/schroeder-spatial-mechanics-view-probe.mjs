import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_MECHANICS_VIEW_BASE_URL
  || 'https://127.0.0.1:5174/';
const outputPath = process.env.ULG_MECHANICS_VIEW_OUTPUT
  || '/tmp/ulg-schroeder-spatial-mechanics-view-probe.json';

const browser = await chromium.launch({
  executablePath: process.env.ULG_MECHANICS_VIEW_CHROME
    || '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist'
  ]
});

let raw;
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(baseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000
  });
  raw = await page.evaluate(async () => {
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
      uncapturedErrors.push(event.error?.message || String(event.error));
    });
    device.pushErrorScope('validation');
    const spatialModule = await import(
      `/src/runtime/sph/schroederSpatialEpochGpu.js?mechanicsViewProbe=${Date.now()}`
    );
    const mechanicsModule = await import(
      `/src/runtime/sph/schroederSpatialMechanicsViewGpu.js?mechanicsViewProbe=${Date.now()}`
    );
    const mechanicsAbi = await import(
      `/ulg-gpu-abi/src/schroederSpatialMechanicsView.js?mechanicsViewProbe=${Date.now()}`
    );

    const gridDims = [7, 7, 7];
    const gridNodeCount = gridDims[0] * gridDims[1] * gridDims[2];
    const gridShift = 3;
    const gridSpacingM = 1;
    const rowsFor = (entries) => {
      const rows = new Float32Array(entries.length * 16);
      entries.forEach((entry, sourceIndex) => {
        const offset = sourceIndex * 16;
        rows[offset] = entry.level;
        rows[offset + 1] = entry.spacing;
        rows[offset + 10] = entry.status ?? 1;
        rows[offset + 12] = entry.position[0];
        rows[offset + 13] = entry.position[1];
        rows[offset + 14] = entry.position[2];
        rows[offset + 15] = 0;
      });
      return rows;
    };
    const baseEntries = [
      { level: 0, spacing: 1, position: [0, 0, 0] },
      { level: 0, spacing: 1, position: [1, 0, 0] },
      { level: 0, spacing: 1, position: [0, 0, 0] },
      { level: 0, spacing: 1, position: [-2.8, -2.8, -2.8] }
    ];
    const permutedEntries = [
      baseEntries[3],
      baseEntries[1],
      baseEntries[0],
      baseEntries[2]
    ];
    const zeroEntries = baseEntries.map((entry) => ({
      ...entry,
      level: 1,
      spacing: 2
    }));
    const sourceBuffer = (label, entries) => {
      const rows = rowsFor(entries);
      const buffer = device.createBuffer({
        label,
        size: rows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(buffer, 0, rows);
      return { buffer, rows };
    };
    const sources = {
      valid: sourceBuffer('mechanics-view-valid-source', baseEntries),
      permuted: sourceBuffer('mechanics-view-permuted-source', permutedEntries),
      zero: sourceBuffer('mechanics-view-zero-source', zeroEntries),
      corrupt: sourceBuffer('mechanics-view-corrupt-source', baseEntries)
    };
    const spatialRuntime = spatialModule.createSchroederSpatialEpochGpu(device, {
      maxSourceCount: 4,
      cellCapacity: 4,
      arenaCount: 4,
      label: 'native-mechanics-view-spatial'
    });
    const mechanicsRuntime = mechanicsModule.createSchroederSpatialMechanicsViewGpu(
      device,
      {
        maxSourceCount: 4,
        gridNodeCount,
        gridDims,
        gridShift,
        gridSpacingM,
        arenaCount: 4,
        label: 'native-mechanics-view'
      }
    );
    const encoder = device.createCommandEncoder({
      label: 'native-mechanics-view-caller-encoder'
    });
    const encoded = [];
    const encodeCase = (name, source, generationId, selectedLevel, corrupt) => {
      const exactNearQueryProfile = {
        schema: 'peercompute.ulg.schroeder-spatial-exact-near-query-profile.v1',
        status: 'schroeder-spatial-exact-near-query-profile-ready',
        ready: true,
        sourceCount: 4,
        chartId: 0,
        minLevel: 0,
        maxLevel: 1,
        levelCount: 2,
        baseGridSpacingM: 1,
        levelSpacingMode: 'base-grid-spacing-times-pow2-level',
        positionAuthority: 'same-epoch-pre-integration-particle-state'
      };
      const spatial = spatialRuntime.encode(encoder, {
        sourceBuffer: source.buffer,
        sourceCount: 4,
        sourceRowLayoutId:
          mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
        sortMode: 'lexicographic-u32x5',
        generationId,
        leaseToken: generationId,
        storageGeneration: 11,
        physicsTick: generationId,
        physicsSubstep: 0,
        positionEpoch: generationId,
        topologyEpoch: 1,
        chartEpoch: 1,
        levelEpoch: 1,
        supportEpoch: 1,
        buildOrdinal: generationId,
        sortUniqueOrdinal: generationId,
        exactNearQueryProfile
      });
      if (corrupt) {
        encoder.clearBuffer(
          spatial.directoryBuffer,
          26 * Uint32Array.BYTES_PER_ELEMENT,
          Uint32Array.BYTES_PER_ELEMENT
        );
      }
      const mechanics = mechanicsRuntime.encode(encoder, {
        sourceBuffer: source.buffer,
        sourceCount: 4,
        sourceRowLayoutId:
          mechanicsAbi.SCHROEDER_SPATIAL_SOURCE_ROW_LAYOUT_LEVEL_ASSIGNMENT_V0,
        selectedLevel,
        spatialExecution: spatial
      });
      const readback = device.createBuffer({
        label: `${name}-mechanics-view-readback`,
        size: mechanics.layout.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyBufferToBuffer(
        mechanics.mechanicsViewBuffer,
        0,
        readback,
        0,
        mechanics.layout.byteLength
      );
      encoded.push({ name, source, spatial, mechanics, readback });
    };
    encodeCase('valid', sources.valid, 1, 0, false);
    encodeCase('permuted', sources.permuted, 2, 0, false);
    encodeCase('zeroSelected', sources.zero, 3, 0, false);
    encodeCase('corruptDirectory', sources.corrupt, 4, 0, true);
    device.queue.submit([encoder.finish()]);
    for (const entry of encoded) {
      spatialRuntime.markExecutionSubmitted(entry.spatial);
      mechanicsRuntime.markExecutionSubmitted(entry.mechanics);
    }
    const fence = device.queue.onSubmittedWorkDone();
    await fence;
    const cases = {};
    for (const entry of encoded) {
      await entry.readback.mapAsync(GPUMapMode.READ);
      const words = new Uint32Array(entry.readback.getMappedRange().slice(0));
      const nodeCount = words[46];
      cases[entry.name] = {
        flags: words[22],
        nodeCount,
        invalidSourceCount: words[47],
        overflowCount: words[48],
        attemptedSourceCount: words[49],
        selectedSourceCount: words[50],
        stencilVisitCount: words[51],
        requiredWords: words[54],
        capacityWords: words[55],
        dispatch: Array.from(words.slice(60, 63)),
        nodes: Array.from(words.slice(64, 64 + nodeCount)),
        bufferAllocationCountDuringEncode:
          entry.mechanics.bufferAllocationCountDuringEncode,
        gpuBufferCreationCountDuringEncode:
          entry.mechanics.gpuBufferCreationCountDuringEncode
      };
      entry.readback.unmap();
      entry.readback.destroy();
    }
    const cpuNodes = (entries, selectedLevel) => {
      const nodes = new Set();
      for (const entry of entries) {
        if (entry.level !== selectedLevel) continue;
        const base = entry.position.map((position) => (
          Math.floor(position / gridSpacingM - 0.5)
        ));
        for (let ox = 0; ox < 3; ox += 1) {
          for (let oy = 0; oy < 3; oy += 1) {
            for (let oz = 0; oz < 3; oz += 1) {
              const i = base[0] + ox + gridShift;
              const j = base[1] + oy + gridShift;
              const k = base[2] + oz + gridShift;
              if (
                i < 0 || j < 0 || k < 0
                || i >= gridDims[0]
                || j >= gridDims[1]
                || k >= gridDims[2]
              ) continue;
              nodes.add((i * gridDims[1] + j) * gridDims[2] + k);
            }
          }
        }
      }
      return [...nodes].sort((left, right) => left - right);
    };
    await Promise.all(encoded.flatMap((entry) => [
      mechanicsRuntime.releaseExecutionAfter(entry.mechanics, fence),
      spatialRuntime.releaseExecutionAfter(entry.spatial, fence)
    ]));
    mechanicsRuntime.destroy();
    spatialRuntime.destroy();
    Object.values(sources).forEach(({ buffer }) => buffer.destroy());
    const validationError = await device.popErrorScope();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      status: 'gpu-evidence-ready',
      gridNodeCount,
      expectedNodes: cpuNodes(baseEntries, 0),
      cases,
      validationErrors: validationError ? [validationError.message] : [],
      uncapturedErrors,
      adapterInfo: adapter.info || null
    };
  });
} finally {
  await browser.close();
}

const equalArray = (left = [], right = []) => (
  left.length === right.length
  && left.every((value, index) => value === right[index])
);
const valid = raw?.cases?.valid || {};
const permuted = raw?.cases?.permuted || {};
const zeroSelected = raw?.cases?.zeroSelected || {};
const corruptDirectory = raw?.cases?.corruptDirectory || {};
const checks = [
  ['webgpu-executed', raw?.status === 'gpu-evidence-ready'],
  ['validation-clean', raw?.validationErrors?.length === 0],
  ['uncaptured-clean', raw?.uncapturedErrors?.length === 0],
  ['valid-admitted', valid.flags === 3 && valid.invalidSourceCount === 0],
  ['valid-cpu-node-parity', equalArray(valid.nodes, raw?.expectedNodes)],
  ['valid-strict-ascending', valid.nodes?.every((node, index, nodes) => (
    node < raw.gridNodeCount && (index === 0 || nodes[index - 1] < node)
  )) === true],
  ['permutation-deterministic', equalArray(permuted.nodes, valid.nodes)],
  ['zero-selected-admitted-empty', zeroSelected.flags === 3
    && zeroSelected.nodeCount === 0
    && equalArray(zeroSelected.dispatch, [0, 0, 0])],
  ['corrupt-directory-fails-closed', corruptDirectory.flags === 12
    && corruptDirectory.nodeCount === 0
    && corruptDirectory.invalidSourceCount === 4
    && equalArray(corruptDirectory.dispatch, [0, 0, 0])],
  ['encode-allocation-free', Object.values(raw?.cases || {}).every((entry) => (
    entry.bufferAllocationCountDuringEncode === 0
    && entry.gpuBufferCreationCountDuringEncode === 0
  ))]
].map(([name, passed]) => ({ name, passed: passed === true }));
const unsatisfiedChecks = checks.filter(({ passed }) => !passed).map(({ name }) => name);
const report = {
  schema: 'peercompute.ulg.schroeder-spatial-mechanics-view-native-probe.v1',
  timestamp: new Date().toISOString(),
  baseUrl,
  status: unsatisfiedChecks.length === 0 ? 'pass' : 'fail',
  checks,
  passed: checks.length - unsatisfiedChecks.length,
  total: checks.length,
  unsatisfiedChecks,
  raw
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'pass') process.exitCode = 1;
