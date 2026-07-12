import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_NEIGHBOR_DIRECT_BASE_URL || 'http://127.0.0.1:5320/';
const outputPath = process.env.ULG_NEIGHBOR_DIRECT_OUTPUT
  || '/tmp/ulg-resident-neighborhood-direct-radix.json';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu'
    ]
  });
  let result;
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const { createResidentNeighborhoodGpuLane } = await import(
        '/src/runtime/sph/residentNeighborhoodGpuLane.js'
      );
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      const device = await adapter.requestDevice();
      const validationErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        validationErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const stateRows = new Float32Array([
        0.10, 0.10, 0.10, 1, 0, 0, 0, 0,
        0.20, 0.10, 0.10, 1, 0, 0, 0, 0,
        0.30, 0.10, 0.10, 1, 0, 0, 0, 0,
        0.40, 0.10, 0.10, 1, 0, 0, 0, 0
      ]);
      const stateBuffer = device.createBuffer({
        label: 'direct-radix-manufactured-state',
        size: stateRows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(stateBuffer, 0, stateRows);
      const readU32 = async (buffer, byteLength = buffer.size) => {
        const staging = device.createBuffer({
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, staging, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        const words = Array.from(new Uint32Array(staging.getMappedRange().slice(0)));
        staging.unmap();
        staging.destroy();
        return words;
      };
      const lease = (strategy) => ({
        schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
        authoritative: true,
        leaseId: `direct-radix-${strategy}-lease`,
        laneId: `compute-manager-direct-radix-${strategy}`,
        stateKey: `probe/direct-radix/${strategy}`,
        sourceFamily: 'sph-particle-state',
        domainKey: 'native-direct-radix-ab',
        solverId: 'ulg-resident-neighborhood',
        taskId: `native-direct-radix-${strategy}`,
        owner: 'compute-manager'
      });
      const execute = async ({
        strategy,
        candidateCapacity,
        requestedSkinDistanceM = 0,
        gridMinCell = [0, 0, 0]
      }) => {
        const lane = createResidentNeighborhoodGpuLane(device, {
          sourceCount: 4,
          supportDistanceM: 1,
          cellSizeM: 1,
          originM: [0, 0, 0],
          ...(strategy === 'dense-grid'
            ? {
                denseUniformChart: {
                  minCell: gridMinCell,
                  dimensions: [4, 1, 1]
                }
              }
            : {}),
          consumers: ['mechanics'],
          maxCandidatesPerSource: 4,
          candidateCapacity,
          builderStrategy: strategy,
          skinDistanceM: requestedSkinDistanceM,
          generationBase: 1,
          positionEpochBase: 1,
          laneId: `compute-manager-direct-radix-${strategy}`,
          stateKey: `probe/direct-radix/${strategy}`,
          label: `native-direct-radix-${strategy}`
        });
        const encoder = device.createCommandEncoder();
        const build = lane.encodeGeneration(encoder, {
          positionBuffer: stateBuffer,
          positionStrideU32: 8,
          leaseAuthorityIdentity: lease(strategy),
          generation: 1,
          positionEpoch: 1
        });
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const packed = await readU32(build.resources.outputs.sourceCandidateCsr.buffer);
        const dispatch = await readU32(
          build.resources.outputs.candidateDispatchIndirect.buffer,
          12
        );
        const descriptor = build.descriptor;
        const sourceOffsetRegion = descriptor.packedCsr.regions.sourceOffsets;
        const candidateRegion = descriptor.packedCsr.regions.candidates;
        const admittedCandidateCount = packed[19];
        const snapshot = {
          strategy: build.productionLane.builderStrategy,
          strategyPlan: build.productionLane.builderStrategyPlan,
          requestedSkinDistanceM,
          effectiveSkinDistanceM: build.descriptor.positionValidity.skinDistanceM,
          skinStatus: build.productionLane.skinReuse.status,
          admitted: packed[31],
          failClosed: packed[33],
          requiredCandidateCount: packed[18],
          admittedCandidateCount,
          sourceOffsets: packed.slice(
            sourceOffsetRegion.baseU32,
            sourceOffsetRegion.baseU32 + sourceOffsetRegion.capacity
          ),
          candidates: packed.slice(
            candidateRegion.baseU32,
            candidateRegion.baseU32 + admittedCandidateCount * candidateRegion.strideU32
          ),
          candidateDispatch: dispatch,
          encodingTelemetry: build.productionLane.encodingTelemetry,
          proofWorkspaceAllocated: build.productionLaneValidation.gpuSkinReuseProof !== null
        };
        build.releaseProductionLaneGeneration();
        lane.destroy();
        return snapshot;
      };

      const direct = await execute({
        strategy: 'direct',
        candidateCapacity: 16,
        requestedSkinDistanceM: 0
      });
      const radix = await execute({ strategy: 'radix', candidateCapacity: 16 });
      const dense = await execute({ strategy: 'dense-grid', candidateCapacity: 16 });
      const denseOutside = await execute({
        strategy: 'dense-grid',
        candidateCapacity: 16,
        gridMinCell: [1, 0, 0]
      });
      const overflow = await execute({ strategy: 'direct', candidateCapacity: 4 });
      const scopedValidationError = await device.popErrorScope();
      if (scopedValidationError) validationErrors.push(scopedValidationError.message);
      const checks = {
        directAdmitted: direct.admitted === 1 && direct.failClosed === 0,
        radixAdmitted: radix.admitted === 1 && radix.failClosed === 0,
        denseAdmitted: dense.admitted === 1 && dense.failClosed === 0,
        offsetsByteIdentical: JSON.stringify(direct.sourceOffsets)
          === JSON.stringify(radix.sourceOffsets),
        candidatesByteIdentical: JSON.stringify(direct.candidates)
          === JSON.stringify(radix.candidates),
        denseOffsetsByteIdentical: JSON.stringify(dense.sourceOffsets)
          === JSON.stringify(radix.sourceOffsets),
        denseCandidatesByteIdentical: JSON.stringify(dense.candidates)
          === JSON.stringify(radix.candidates),
        denseOutsideFailClosed: denseOutside.admitted === 0
          && denseOutside.failClosed === 1
          && denseOutside.candidateDispatch[0] === 0,
        directFiveDispatchesIncludingMetadata:
          direct.encodingTelemetry.encodedDispatchCount === 5,
        directSkinDisabled: direct.effectiveSkinDistanceM === 0
          && direct.proofWorkspaceAllocated === false
          && direct.skinStatus
            === 'resident-neighborhood-skin-reuse-disabled',
        overflowFailClosed: overflow.admitted === 0 && overflow.failClosed === 1,
        overflowDispatchXZero: overflow.candidateDispatch[0] === 0,
        noValidationErrors: validationErrors.length === 0
      };
      stateBuffer.destroy();
      device.destroy();
      return {
        status: Object.values(checks).every(Boolean)
          ? 'resident-neighborhood-direct-radix-native-pass'
          : 'resident-neighborhood-direct-radix-native-fail',
        checks,
        validationErrors,
        direct,
        radix,
        dense,
        denseOutside,
        overflow,
        gpuAuthority: {
          candidateCount: 'per-source-gpu-direct-pair-count',
          offsets: 'gpu-exclusive-scan',
          fillOrder: 'ascending-partner-index',
          overflow: 'packed-header-fail-closed-and-indirect-x-zero',
          cpuMirror: false,
          particleReadback: false
        }
      };
    });
  } finally {
    await browser.close();
  }
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...result }, null, 2));
  if (!result || result.status !== 'resident-neighborhood-direct-radix-native-pass') {
    process.exitCode = 1;
  }
}

await main();
