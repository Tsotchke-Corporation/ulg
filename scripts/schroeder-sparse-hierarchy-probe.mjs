import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_SS_SPARSE_BASE_URL || 'https://127.0.0.1:5173/';
const outputPath = process.env.ULG_SS_SPARSE_OUTPUT || '/tmp/ulg-schroeder-sparse-hierarchy.json';
const scaleSourceCount = Math.max(1, Math.round(Number(
  process.env.ULG_SS_SPARSE_SCALE_COUNT || 300_000
)));

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async ({ scaleCount }) => {
      const module = await import(`/src/runtime/sph/schroederSparseHierarchyGpu.js?probe=${Date.now()}`);
      const deviceLimitsModule = await import(
        `/src/runtime/webgpuDeviceLimits.js?ssSparseProbe=${Date.now()}`
      );
      const abi = await import(`/ulg-gpu-abi/src/index.js?ssSparseProbe=${Date.now()}`);
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      const adapterStorageBuffersPerStage = Number(
        adapter.limits.maxStorageBuffersPerShaderStage || 0
      );
      if (adapterStorageBuffersPerStage < 10) {
        return {
          status: 'unsupported',
          reason: 'resident SPH requires 10 storage buffers per shader stage',
          adapterStorageBuffersPerStage,
          requiredStorageBuffersPerStage: 10
        };
      }
      const deviceDescriptor = deviceLimitsModule.webGpuDeviceDescriptorForResidentSph(adapter);
      const requestedStorageBuffersPerStage = Number(
        deviceDescriptor?.requiredLimits?.maxStorageBuffersPerShaderStage || 8
      );
      const device = await adapter.requestDevice(deviceDescriptor);
      const deviceStorageBuffersPerStage = Number(
        device.limits.maxStorageBuffersPerShaderStage || 0
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });

      const activeRows = new Float32Array(6 * 16);
      const setRow = (index, { level, minX, maxX, status = 1, chart = 0 }) => {
        const offset = index * 16;
        activeRows[offset] = level;
        activeRows[offset + 1] = minX;
        activeRows[offset + 2] = 0;
        activeRows[offset + 3] = 0;
        activeRows[offset + 4] = maxX;
        activeRows[offset + 5] = 0;
        activeRows[offset + 6] = 0;
        activeRows[offset + 7] = 1;
        activeRows[offset + 8] = 0.25;
        activeRows[offset + 9] = 0.5;
        activeRows[offset + 10] = index;
        activeRows[offset + 11] = status;
        activeRows[offset + 12] = minX;
        activeRows[offset + 15] = chart;
      };
      setRow(0, { level: 0, minX: 0, maxX: 1 });
      setRow(1, { level: 0, minX: 1, maxX: 2 });
      setRow(2, { level: 1, minX: 0, maxX: 0 });
      setRow(3, { level: 1, minX: 0, maxX: 0 });
      setRow(4, { level: 2, minX: 0, maxX: 0 });
      setRow(5, { level: 0, minX: 8, maxX: 8, status: 32 });
      const activeNodeBuffer = device.createBuffer({
        label: 'ss-sparse-probe-active-nodes',
        size: activeRows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(activeNodeBuffer, 0, activeRows);
      const activeNodeList = {
        schema: abi.ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
        status: 'schroeder-active-node-list-submitted',
        activeCandidateCount: 6,
        activeNodeStrideFloats: 16,
        activeNodeBuffer
      };

      const runCase = async ({ name, routeCapacity, generationId }) => {
        device.pushErrorScope('validation');
        device.pushErrorScope('out-of-memory');
        device.pushErrorScope('internal');
        const plan = module.createSchroederSparseHierarchyArenaPlan({
          sourceRowCount: 6,
          fineLevel: 0,
          coarseLevel: 1,
          routeCapacity,
          maxTilesPerSource: 16,
          retainedArenaByteBudget: 1 << 20,
          scratchArenaByteBudget: 1 << 20,
          maxBufferSize: device.limits.maxBufferSize,
          maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
          maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension
        });
        const runtime = module.createSchroederSparseHierarchyGpu(device, {
          plan,
          label: `ss-sparse-probe-${name}`
        });
        const encoder = device.createCommandEncoder({ label: `ss-sparse-probe-${name}-encoder` });
        const execution = runtime.encode(encoder, { activeNodeList, generationId });
        const evidenceRead = device.createBuffer({
          label: `ss-sparse-probe-${name}-evidence-read`,
          size: 64,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const sampleNodeCount = Math.min(8, routeCapacity);
        const nodesRead = device.createBuffer({
          label: `ss-sparse-probe-${name}-nodes-read`,
          size: sampleNodeCount * 16 * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const offsetsRead = device.createBuffer({
          label: `ss-sparse-probe-${name}-offsets-read`,
          size: (sampleNodeCount + 1) * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const sortedRead = device.createBuffer({
          label: `ss-sparse-probe-${name}-sorted-read`,
          size: Math.min(8, routeCapacity) * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const sourceRead = device.createBuffer({
          label: `ss-sparse-probe-${name}-source-read`,
          size: routeCapacity * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(execution.evidenceBuffer, 0, evidenceRead, 0, 64);
        encoder.copyBufferToBuffer(execution.compactNodeBuffer, 0, nodesRead, 0, nodesRead.size);
        encoder.copyBufferToBuffer(
          execution.sourceMembershipOffsetBuffer,
          0,
          offsetsRead,
          0,
          offsetsRead.size
        );
        encoder.copyBufferToBuffer(execution.sortedRouteIndexBuffer, 0, sortedRead, 0, sortedRead.size);
        encoder.copyBufferToBuffer(execution.routeSourceIndexBuffer, 0, sourceRead, 0, sourceRead.size);
        const submittedAt = performance.now();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const queueFenceMs = performance.now() - submittedAt;
        const internalError = await device.popErrorScope();
        const outOfMemoryError = await device.popErrorScope();
        const validationError = await device.popErrorScope();

        await evidenceRead.mapAsync(GPUMapMode.READ);
        const evidence = new Uint32Array(evidenceRead.getMappedRange()).slice();
        evidenceRead.unmap();
        await nodesRead.mapAsync(GPUMapMode.READ);
        const nodes = new Uint32Array(nodesRead.getMappedRange()).slice();
        nodesRead.unmap();
        await offsetsRead.mapAsync(GPUMapMode.READ);
        const offsets = new Uint32Array(offsetsRead.getMappedRange()).slice();
        offsetsRead.unmap();
        await sortedRead.mapAsync(GPUMapMode.READ);
        const sorted = new Uint32Array(sortedRead.getMappedRange()).slice();
        sortedRead.unmap();
        await sourceRead.mapAsync(GPUMapMode.READ);
        const routeSources = new Uint32Array(sourceRead.getMappedRange()).slice();
        sourceRead.unmap();

        const uniqueCount = Math.min(evidence[5], sampleNodeCount);
        const nodeSamples = [];
        for (let nodeIndex = 0; nodeIndex < uniqueCount; nodeIndex += 1) {
          const row = nodes.slice(nodeIndex * 16, nodeIndex * 16 + 16);
          const start = row[5];
          const end = row[6];
          const sourceMembers = [];
          for (let position = start; position < end && position < sorted.length; position += 1) {
            sourceMembers.push(routeSources[sorted[position]]);
          }
          nodeSamples.push({
            chart: row[9] | 0,
            level: row[8] | 0,
            tile: [row[10] | 0, row[11] | 0, row[12] | 0],
            span: [start, end],
            sourceMembers
          });
        }
        const expectedNodes = [
          { chart: 0, level: 0, tile: [0, 0, 0], span: [0, 1], sourceMembers: [0] },
          { chart: 0, level: 0, tile: [1, 0, 0], span: [1, 3], sourceMembers: [0, 1] },
          { chart: 0, level: 0, tile: [2, 0, 0], span: [3, 4], sourceMembers: [1] },
          { chart: 0, level: 1, tile: [0, 0, 0], span: [4, 6], sourceMembers: [2, 3] }
        ];
        const expectedAdmission = routeCapacity >= 6;
        const pass = validationError == null && outOfMemoryError == null && internalError == null
          && evidence[0] === generationId
          && evidence[1] === 6
          && evidence[2] === routeCapacity
          && evidence[3] === 6
          && evidence[4] === Math.min(6, routeCapacity)
          && evidence[6] === (expectedAdmission ? 1 : 0)
          && (expectedAdmission ? evidence[7] === 0 : (evidence[7] & 1) === 1)
          && evidence[15] === 1
          && (!expectedAdmission || JSON.stringify(nodeSamples) === JSON.stringify(expectedNodes));

        execution.releaseTransientBuffers();
        runtime.destroy();
        for (const buffer of [evidenceRead, nodesRead, offsetsRead, sortedRead, sourceRead]) buffer.destroy();
        return {
          name,
          status: pass ? 'pass' : 'fail',
          queueFenceMs,
          evidence: Array.from(evidence),
          nodeSamples,
          offsetPrefix: Array.from(offsets.slice(0, uniqueCount + 1)),
          validationError: validationError?.message || null,
          outOfMemoryError: outOfMemoryError?.message || null,
          internalError: internalError?.message || null
        };
      };

      const cases = [
        await runCase({ name: 'exact-two-level', routeCapacity: 64, generationId: 41 }),
        await runCase({ name: 'fail-closed-overflow', routeCapacity: 4, generationId: 42 })
      ];
      const runOverlappingGridViewCase = async () => {
        device.pushErrorScope('validation');
        device.pushErrorScope('out-of-memory');
        device.pushErrorScope('internal');
        const compactNodes = new Uint32Array(2 * 16);
        for (let index = 0; index < 2; index += 1) {
          const row = index * 16;
          compactNodes[row + 8] = 0;
          compactNodes[row + 9] = 0;
          compactNodes[row + 10] = 1;
          compactNodes[row + 11] = 1;
          compactNodes[row + 12] = 1;
        }
        const hierarchyEvidence = new Uint32Array(16);
        hierarchyEvidence[0] = 44;
        hierarchyEvidence[5] = 2;
        hierarchyEvidence[6] = 1;
        const compactNodeBuffer = device.createBuffer({
          label: 'ss-sparse-probe-overlap-compact-nodes',
          size: compactNodes.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        const hierarchyEvidenceBuffer = device.createBuffer({
          label: 'ss-sparse-probe-overlap-hierarchy-evidence',
          size: hierarchyEvidence.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(compactNodeBuffer, 0, compactNodes);
        device.queue.writeBuffer(hierarchyEvidenceBuffer, 0, hierarchyEvidence);
        const plan = module.createSchroederSparseGridViewPlan({
          gridDims: [32, 32, 32],
          gridShift: 0,
          selectedLevel: 0,
          chartId: 0,
          tileCellCount: 8,
          activeTileCapacity: 2,
          activeNodeCapacityHeadroom: 1.125,
          arenaByteBudget: 1 << 20,
          maxBufferSize: device.limits.maxBufferSize,
          maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
          maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension
        });
        const hierarchy = {
          schema: module.ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
          generationId: 44,
          compactNodeBuffer,
          evidenceBuffer: hierarchyEvidenceBuffer
        };
        const runtime = module.createSchroederSparseGridViewGpu(device, {
          hierarchy,
          plan,
          label: 'ss-sparse-probe-overlap-grid-view'
        });
        const encoder = device.createCommandEncoder({
          label: 'ss-sparse-probe-overlap-grid-view-encoder'
        });
        const execution = runtime.encode(encoder, { generationId: 44 });
        const headerRead = device.createBuffer({
          label: 'ss-sparse-probe-overlap-grid-view-header-read',
          size: 64,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(execution.viewBuffer, 0, headerRead, 0, 64);
        const submittedAt = performance.now();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const queueFenceMs = performance.now() - submittedAt;
        const internalError = await device.popErrorScope();
        const outOfMemoryError = await device.popErrorScope();
        const validationError = await device.popErrorScope();
        await headerRead.mapAsync(GPUMapMode.READ);
        const header = new Uint32Array(headerRead.getMappedRange()).slice();
        headerRead.unmap();
        const pass = plan.admitted
          && plan.buildInvocationAddressable
          && plan.declaredBuildInvocationCapacity === 1024
          && header[0] === 44
          && header[1] === 512
          && header[2] === 512
          && header[3] === 1
          && header[4] === 0
          && header[13] === 2048
          && header[15] === 2
          && validationError == null
          && outOfMemoryError == null
          && internalError == null;
        execution.releaseTransientBuffers();
        runtime.destroy();
        for (const buffer of [compactNodeBuffer, hierarchyEvidenceBuffer, headerRead]) {
          buffer.destroy();
        }
        return {
          name: 'overlapping-tile-grid-view-dedup',
          status: pass ? 'pass' : 'fail',
          queueFenceMs,
          declaredBuildInvocationCapacity: plan.declaredBuildInvocationCapacity,
          gridNodeCapacity: plan.gridNodeCapacity,
          physicalHashCapacity: plan.hashCapacity,
          header: Array.from(header),
          validationError: validationError?.message || null,
          outOfMemoryError: outOfMemoryError?.message || null,
          internalError: internalError?.message || null
        };
      };
      const gridViewOverlap = await runOverlappingGridViewCase();
      activeNodeBuffer.destroy();

      device.pushErrorScope('validation');
      device.pushErrorScope('out-of-memory');
      device.pushErrorScope('internal');
      const scaleRows = new Float32Array(scaleCount * 16);
      for (let index = 0; index < scaleCount; index += 1) {
        const row = index * 16;
        const cycle = index % 200_000;
        const local = cycle % 100_000;
        const level = cycle >= 100_000 ? 1 : 0;
        const tileX = local % 1000;
        const tileY = Math.floor(local / 1000);
        scaleRows[row] = level;
        scaleRows[row + 1] = tileX;
        scaleRows[row + 2] = tileY;
        scaleRows[row + 3] = 0;
        scaleRows[row + 4] = tileX;
        scaleRows[row + 5] = tileY;
        scaleRows[row + 6] = 0;
        scaleRows[row + 7] = 1;
        scaleRows[row + 8] = level === 0 ? 0.25 : 0.5;
        scaleRows[row + 9] = 0.5;
        scaleRows[row + 10] = index;
        scaleRows[row + 11] = 1;
        scaleRows[row + 12] = tileX;
        scaleRows[row + 13] = tileY;
      }
      const scaleActiveBuffer = device.createBuffer({
        label: 'ss-sparse-probe-scale-active-nodes',
        size: scaleRows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(scaleActiveBuffer, 0, scaleRows);
      const scalePlan = module.createSchroederSparseHierarchyArenaPlan({
        sourceRowCount: scaleCount,
        fineLevel: 0,
        coarseLevel: 1,
        routeCapacity: scaleCount,
        maxTilesPerSource: 1,
        retainedArenaByteBudget: 64 * 1024 * 1024,
        scratchArenaByteBudget: 64 * 1024 * 1024,
        maxBufferSize: device.limits.maxBufferSize,
        maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension
      });
      const scaleRuntime = module.createSchroederSparseHierarchyGpu(device, {
        plan: scalePlan,
        label: 'ss-sparse-probe-scale'
      });
      const scaleEncoder = device.createCommandEncoder({ label: 'ss-sparse-probe-scale-encoder' });
      const scaleExecution = scaleRuntime.encode(scaleEncoder, {
        activeNodeList: {
          schema: abi.ULG_SCHROEDER_ACTIVE_NODE_LIST_EXECUTION_SCHEMA,
          status: 'schroeder-active-node-list-submitted',
          activeCandidateCount: scaleCount,
          activeNodeStrideFloats: 16,
          activeNodeBuffer: scaleActiveBuffer
        },
        generationId: 43
      });
      const scaleEvidenceRead = device.createBuffer({
        label: 'ss-sparse-probe-scale-evidence-read',
        size: 64,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      scaleEncoder.copyBufferToBuffer(scaleExecution.evidenceBuffer, 0, scaleEvidenceRead, 0, 64);
      const scaleSubmittedAt = performance.now();
      device.queue.submit([scaleEncoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      const scaleQueueFenceMs = performance.now() - scaleSubmittedAt;
      const scaleInternalError = await device.popErrorScope();
      const scaleOutOfMemoryError = await device.popErrorScope();
      const scaleValidationError = await device.popErrorScope();
      await scaleEvidenceRead.mapAsync(GPUMapMode.READ);
      const scaleEvidence = new Uint32Array(scaleEvidenceRead.getMappedRange()).slice();
      scaleEvidenceRead.unmap();
      const expectedScaleUnique = Math.min(scaleCount, 200_000);
      const scalePass = scalePlan.admitted
        && scaleEvidence[0] === 43
        && scaleEvidence[1] === scaleCount
        && scaleEvidence[2] === scaleCount
        && scaleEvidence[3] === scaleCount
        && scaleEvidence[4] === scaleCount
        && scaleEvidence[5] === expectedScaleUnique
        && scaleEvidence[6] === 1
        && scaleEvidence[7] === 0
        && scaleValidationError == null
        && scaleOutOfMemoryError == null
        && scaleInternalError == null;
      const scale = {
        name: 'scale-two-level-300k',
        status: scalePass ? 'pass' : 'fail',
        sourceRowCount: scaleCount,
        routeCapacity: scalePlan.routeCapacity,
        uniqueNodeCount: scaleEvidence[5],
        retainedArenaBytes: scalePlan.retainedArenaBytes,
        scratchArenaBytes: scalePlan.scratchArenaBytes,
        queueFenceMs: scaleQueueFenceMs,
        evidence: Array.from(scaleEvidence),
        validationError: scaleValidationError?.message || null,
        outOfMemoryError: scaleOutOfMemoryError?.message || null,
        internalError: scaleInternalError?.message || null
      };
      scaleExecution.releaseTransientBuffers();
      scaleRuntime.destroy();
      scaleEvidenceRead.destroy();
      scaleActiveBuffer.destroy();
      device.destroy();
      return {
        status: cases.every(({ status }) => status === 'pass')
          && gridViewOverlap.status === 'pass'
          && scale.status === 'pass'
          && uncapturedErrors.length === 0
          ? 'pass'
          : 'fail',
        deviceLimits: {
          adapterStorageBuffersPerStage,
          requestedStorageBuffersPerStage,
          deviceStorageBuffersPerStage
        },
        cases,
        gridViewOverlap,
        scale,
        uncapturedErrors
      };
    }, { scaleCount: scaleSourceCount });
    const artifact = {
      schema: 'peercompute.ulg.schroeder-sparse-hierarchy-probe.v0',
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl,
      ...result
    };
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(artifact)}\n`);
    if (artifact.status !== 'pass') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
