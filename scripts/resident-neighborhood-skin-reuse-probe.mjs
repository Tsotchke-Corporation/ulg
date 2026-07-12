import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_NEIGHBOR_SKIN_BASE_URL || 'http://127.0.0.1:5320/';
const outputPath = process.env.ULG_NEIGHBOR_SKIN_OUTPUT
  || '/tmp/ulg-resident-neighborhood-skin-reuse.json';

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
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

      const makeState = (offsetM) => new Float32Array([
        offsetM, 0, 0, 1, 0, 0, 0, 0,
        offsetM + 0.1, 0, 0, 1, 0, 0, 0, 0
      ]);
      const stateBuffer = device.createBuffer({
        label: 'skin-reuse-manufactured-state',
        size: makeState(0).byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
      });
      device.queue.writeBuffer(stateBuffer, 0, makeState(0));
      const lane = createResidentNeighborhoodGpuLane(device, {
        sourceCount: 2,
        supportDistanceM: 0.25,
        cellSizeM: 0.25,
        skinDistanceM: 0.1,
        originM: [-1, -1, -1],
        consumers: ['mechanics', 'thermal', 'reaction'],
        maxCandidatesPerSource: 2,
        candidateCapacity: 4,
        builderStrategy: 'radix',
        generationBase: 1,
        positionEpochBase: 1,
        laneId: 'compute-manager-native-skin-lane',
        stateKey: 'probe/hot-state',
        sourceFamily: 'sph-particle-state',
        label: 'native-skin-reuse-neighborhood'
      });
      const leaseAuthorityIdentity = {
        schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
        authoritative: true,
        leaseId: 'native-skin-reuse-lease',
        laneId: 'compute-manager-native-skin-lane',
        stateKey: 'probe/hot-state',
        sourceFamily: 'sph-particle-state',
        domainKey: 'native-manufactured-skin-proof',
        solverId: 'ulg-resident-neighborhood',
        taskId: 'native-skin-reuse-proof',
        owner: 'compute-manager'
      };

      const readU32 = async (buffer, byteLength = buffer.size) => {
        const staging = device.createBuffer({
          label: 'skin-reuse-fixed-evidence-readback',
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, staging, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(staging.getMappedRange().slice(0));
        staging.unmap();
        staging.destroy();
        return Array.from(words);
      };

      const generations = [];
      const encode = async (generation, positionEpoch, offsetM) => {
        device.queue.writeBuffer(stateBuffer, 0, makeState(offsetM));
        const encoder = device.createCommandEncoder({
          label: `skin-reuse-generation-${generation}`
        });
        const build = lane.encodeGeneration(encoder, {
          positionBuffer: stateBuffer,
          positionStrideU32: 8,
          leaseAuthorityIdentity,
          generation,
          positionEpoch,
          mutationPhase: `manufactured-offset-${offsetM}`
        });
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const packed = await readU32(build.resources.outputs.sourceCandidateCsr.buffer);
        const proof = build.productionLaneValidation.gpuSkinReuseProof;
        const evidence = proof ? await readU32(proof.evidenceBuffer, 8 * 4) : null;
        const snapshot = {
          generation,
          positionEpoch,
          offsetM,
          mode: build.productionLane.skinReuse.status,
          headerGeneration: packed[1],
          headerPositionEpoch: packed[4],
          admitted: packed[31],
          failClosed: packed[33],
          candidateCount: packed[19],
          encodingTelemetry: build.productionLane.encodingTelemetry,
          skinReuseEncoding: {
            encodedConditionalIndirectDispatchCount:
              build.productionLane.skinReuse.encodedConditionalIndirectDispatchCount,
            encodedProofPassCount: build.productionLane.skinReuse.encodedProofPassCount,
            encodedReferenceCapturePassCount:
              build.productionLane.skinReuse.encodedReferenceCapturePassCount,
            encodedDispatchCommandsStillPresent:
              build.productionLane.skinReuse.encodedDispatchCommandsStillPresent
          },
          payload: packed.slice(40),
          proof: evidence
            ? {
                reuseAdmitted: evidence[2],
                rebuildRequired: evidence[3],
                evidenceGeneration: evidence[4],
                evidencePositionEpoch: evidence[5],
                maxDisplacementM: new Float32Array(new Uint32Array([evidence[6]]).buffer)[0]
              }
            : null
        };
        generations.push({ build, snapshot });
        return snapshot;
      };

      const initial = await encode(1, 1, 0);
      const withinSkin = await encode(2, 2, 0.02);
      const exhaustedSkin = await encode(3, 3, 0.10);
      const afterRebuildWithinSkin = await encode(4, 4, 0.12);
      const decisionCounters = await readU32(
        generations.at(-1).build.productionLaneValidation.gpuSkinReuseProof.countersBuffer,
        4 * 4
      );
      const scopedValidationError = await device.popErrorScope();
      if (scopedValidationError) validationErrors.push(scopedValidationError.message);

      const checks = {
        initialAdmitted: initial.admitted === 1 && initial.failClosed === 0,
        withinSkinReused: withinSkin.proof?.reuseAdmitted === 1
          && withinSkin.proof?.rebuildRequired === 0,
        reusePreservedPayload: JSON.stringify(withinSkin.payload) === JSON.stringify(initial.payload),
        reuseAdvancedEpoch: withinSkin.headerGeneration === 2
          && withinSkin.headerPositionEpoch === 2,
        exhaustedSkinRebuilt: exhaustedSkin.proof?.reuseAdmitted === 0
          && exhaustedSkin.proof?.rebuildRequired === 1,
        rebuildAdvancedEpoch: exhaustedSkin.headerGeneration === 3
          && exhaustedSkin.headerPositionEpoch === 3,
        rebuiltReferenceReused: afterRebuildWithinSkin.proof?.reuseAdmitted === 1
          && afterRebuildWithinSkin.proof?.rebuildRequired === 0,
        gpuDecisionCountersExact: decisionCounters[0] === 3
          && decisionCounters[1] === 2
          && decisionCounters[2] === 1,
        noValidationErrors: validationErrors.length === 0
      };
      for (const { build } of generations) build.releaseProductionLaneGeneration();
      lane.destroy();
      stateBuffer.destroy();
      device.destroy();
      return {
        status: Object.values(checks).every(Boolean)
          ? 'resident-neighborhood-skin-reuse-native-pass'
          : 'resident-neighborhood-skin-reuse-native-fail',
        checks,
        validationErrors,
        decisionCounters: {
          conditionalDecisionCount: decisionCounters[0],
          gpuProvenReuseCount: decisionCounters[1],
          executedConditionalRebuildCount: decisionCounters[2]
        },
        snapshots: generations.map(({ snapshot }) => snapshot),
        gpuAuthority: {
          displacementDecision: 'same-encoder-atomic-max-reduction',
          conditionalRebuild: 'gpu-authored-indirect-dispatch-bank',
          referenceUpdate: 'gpu-indirect-gated-after-packed-header-admission',
          fullParticleReadback: false,
          cpuMirror: false
        }
      };
    });
  } finally {
    await browser.close();
  }
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...result }, null, 2));
  if (!result || result.status !== 'resident-neighborhood-skin-reuse-native-pass') {
    process.exitCode = 1;
  }
}

await main();
