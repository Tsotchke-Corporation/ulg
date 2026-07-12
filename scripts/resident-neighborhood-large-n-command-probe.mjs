import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_NEIGHBOR_LARGE_BASE_URL || 'http://127.0.0.1:5320/';
const outputPath = process.env.ULG_NEIGHBOR_LARGE_OUTPUT
  || '/tmp/ulg-resident-neighborhood-large-n-commands.json';
const sourceCount = Math.max(300, Math.round(Number(
  process.env.ULG_NEIGHBOR_LARGE_SOURCE_COUNT || 300_000
)));

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
    result = await page.evaluate(async (count) => {
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

      const stateRows = new Float32Array(count * 8);
      for (let index = 0; index < count; index += 1) {
        const base = index * 8;
        stateRows[base] = index * 2;
        stateRows[base + 3] = 1;
      }
      const stateBuffer = device.createBuffer({
        label: 'large-neighborhood-manufactured-state',
        size: stateRows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(stateBuffer, 0, stateRows);
      const lane = createResidentNeighborhoodGpuLane(device, {
        sourceCount: count,
        supportDistanceM: 0.25,
        cellSizeM: 2,
        originM: [0, 0, 0],
        denseUniformChart: {
          minCell: [0, 0, 0],
          dimensions: [count, 1, 1]
        },
        consumers: ['mechanics'],
        supportClasses: [{
          supportClassId: 0,
          consumerMask: 1,
          minLevelDelta: 0,
          maxLevelDelta: 0,
          cellRadius: 0,
          maxCandidatesPerSource: 1,
          flags: 7
        }],
        maxCandidatesPerSource: 1,
        candidateCapacity: count,
        builderStrategy: 'auto',
        generationBase: 1,
        positionEpochBase: 1,
        laneId: 'compute-manager-large-neighborhood-lane',
        stateKey: 'probe/large-neighborhood/hot-state',
        sourceFamily: 'sph-particle-state',
        label: 'native-large-neighborhood'
      });
      const leaseAuthorityIdentity = {
        schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
        authoritative: true,
        leaseId: 'native-large-neighborhood-lease',
        laneId: 'compute-manager-large-neighborhood-lane',
        stateKey: 'probe/large-neighborhood/hot-state',
        sourceFamily: 'sph-particle-state',
        domainKey: 'native-large-neighborhood-command-proof',
        solverId: 'ulg-resident-neighborhood',
        taskId: 'native-large-neighborhood-command-proof',
        owner: 'compute-manager'
      };

      const encoder = device.createCommandEncoder({ label: 'large-neighborhood-encoder' });
      const encodeStartedAt = performance.now();
      const build = lane.encodeGeneration(encoder, {
        positionBuffer: stateBuffer,
        positionStrideU32: 8,
        leaseAuthorityIdentity,
        generation: 1,
        positionEpoch: 1,
        mutationPhase: 'manufactured-static-separated-particles'
      });
      const encodeWallMs = performance.now() - encodeStartedAt;
      const packedHeaderByteLength = build.descriptor.packedCsr.regions.sourceOffsets.baseU32 * 4;
      const capacityEvidenceByteLength = build.resources.outputs.capacityEvidence.byteLength;
      const radixEvidenceByteLength = 8 * 4;
      const dispatchByteLength = 3 * 4;
      const offsets = {
        packedHeader: 0,
        capacityEvidence: packedHeaderByteLength,
        radixEvidence: packedHeaderByteLength + capacityEvidenceByteLength,
        dispatch: packedHeaderByteLength + capacityEvidenceByteLength + radixEvidenceByteLength
      };
      const readback = device.createBuffer({
        label: 'large-neighborhood-fixed-evidence-readback',
        size: offsets.dispatch + dispatchByteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyBufferToBuffer(
        build.resources.outputs.sourceCandidateCsr.buffer,
        0,
        readback,
        offsets.packedHeader,
        packedHeaderByteLength
      );
      encoder.copyBufferToBuffer(
        build.resources.outputs.capacityEvidence.buffer,
        0,
        readback,
        offsets.capacityEvidence,
        capacityEvidenceByteLength
      );
      encoder.copyBufferToBuffer(
        build.resources.scratch.radixUnique.uniqueEvidenceBuffer,
        0,
        readback,
        offsets.radixEvidence,
        radixEvidenceByteLength
      );
      encoder.copyBufferToBuffer(
        build.resources.outputs.candidateDispatchIndirect.buffer,
        0,
        readback,
        offsets.dispatch,
        dispatchByteLength
      );
      const submittedAt = performance.now();
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      const queueFenceMs = performance.now() - submittedAt;
      await readback.mapAsync(GPUMapMode.READ);
      const evidenceBytes = readback.getMappedRange();
      const words = (byteOffset, byteLength) => Array.from(new Uint32Array(
        evidenceBytes.slice(byteOffset, byteOffset + byteLength)
      ));
      const packedHeader = words(offsets.packedHeader, packedHeaderByteLength);
      const capacityEvidence = words(offsets.capacityEvidence, capacityEvidenceByteLength);
      const radixEvidence = words(offsets.radixEvidence, radixEvidenceByteLength);
      const candidateDispatch = words(offsets.dispatch, dispatchByteLength);
      readback.unmap();
      const scopedValidationError = await device.popErrorScope();
      if (scopedValidationError) validationErrors.push(scopedValidationError.message);

      const checks = {
        packedHeaderAdmitted: packedHeader[31] === 1 && packedHeader[33] === 0,
        noSeparatedCandidates: packedHeader[19] === 0 && candidateDispatch[0] === 0,
        radixEvidenceExact: radixEvidence[0] === 1
          && radixEvidence[1] === count
          && radixEvidence[2] === count
          && radixEvidence[3] === 1
          && radixEvidence[4] === 0
          && radixEvidence[5] === 1
          && radixEvidence[6] === 8
          && radixEvidence[7] === 1,
        denseUniformChartSelected: build.productionLane.builderStrategy === 'dense-grid'
          && build.productionLane.denseUniformChart?.admitted === true,
        dispatchTopologyReduced: build.productionLane.encodingTelemetry.encodedDispatchCount === 50,
        normalPassesGrouped: build.productionLane.encodingTelemetry.encodedComputePassCount === 6,
        fixedEvidenceOnly: readback.size < 1024,
        noValidationErrors: validationErrors.length === 0
      };
      const snapshot = {
        status: Object.values(checks).every(Boolean)
          ? 'resident-neighborhood-large-n-command-native-pass'
          : 'resident-neighborhood-large-n-command-native-fail',
        checks,
        sourceCount: count,
        encodeWallMs,
        queueFenceMs,
        fixedEvidenceReadbackByteLength: readback.size,
        encodingTelemetry: build.productionLane.encodingTelemetry,
        packedHeader,
        capacityEvidence,
        radixEvidence,
        candidateDispatch,
        validationErrors,
        gpuAuthority: {
          particleReadback: false,
          candidateCsrReadback: false,
          fixedEvidenceOnly: true,
          cpuMirror: false
        }
      };
      build.releaseProductionLaneGeneration();
      lane.destroy();
      readback.destroy();
      stateBuffer.destroy();
      device.destroy();
      return snapshot;
    }, sourceCount);
  } finally {
    await browser.close();
  }
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...result }, null, 2));
  if (!result || result.status !== 'resident-neighborhood-large-n-command-native-pass') {
    process.exitCode = 1;
  }
}

await main();
