import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  maxReactionContactRadiusM
} from '../src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_REACTION_RULE_INDEX === '1';
const BASE_URL = process.env.ULG_REACTION_RULE_INDEX_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_REACTION_RULE_INDEX_CHROME
  || '/usr/bin/google-chrome';

function median(values) {
  assert.ok(values.length > 0, 'median requires at least one sample');
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

test('reaction discovery derives its search envelope from canonical combined records', () => {
  const combinedRecords = new Float32Array([
    1, 2, 3, 900,
    -1000, 4, 1, 2,
    1, 0, 0, 0
  ]);
  const staleRecords = new Float32Array(combinedRecords);
  staleRecords[5] = 0.25;
  staleRecords[8] = 0;

  assert.equal(maxReactionContactRadiusM({
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 1,
    records: staleRecords,
    combinedRecords
  }), 4);
});

test('native Vulkan reaction material-pair index preserves canonical proposals and removes the full-rule multiplier', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_REACTION_RULE_INDEX=1 for native Vulkan WebGPU'
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
    native = await page.evaluate(async ({ sampleCount, pairCount }) => {
      const fail = (message) => {
        throw new Error(message);
      };
      const requireTrue = (condition, message) => {
        if (!condition) fail(message);
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
        motionEnvelopeModule,
        motionWatchModule
      ] = await Promise.all([
        import('/src/runtime/webgpuDeviceLimits.js'),
        import('/src/runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js'),
        import('/src/runtime/sph/schroederSpatialEpochGpu.js'),
        import('/src/runtime/sph/sphGpuDeviceIdentity.js'),
        import('/src/runtime/sph/sphGpuBuffers.js'),
        import('/src/runtime/sph/sphState.js'),
        import('/src/runtime/sph/sphReactionGpuKernel.js'),
        import('/src/runtime/sph/sphReactionMotionEnvelope.js'),
        import('/src/runtime/sph/sphReactionMotionEnvelopeWatchGpu.js')
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

      const createTaggedBuffer = (label, values, usage) => {
        const buffer = device.createBuffer({
          label,
          size: Math.max(4, Math.ceil(values.byteLength / 4) * 4),
          usage
        });
        if (values.byteLength > 0) device.queue.writeBuffer(buffer, 0, values);
        return identity.tagWebGpuBufferDevice(buffer, device);
      };
      const readBuffer = async (source, byteLength, label) => {
        const size = Math.max(4, Math.ceil(byteLength / 4) * 4);
        const readback = device.createBuffer({
          label,
          size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder({
          label: `${label}-copy-encoder`
        });
        encoder.copyBufferToBuffer(source, 0, readback, 0, size);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ, 0, size);
        const bytes = readback.getMappedRange(0, size).slice(0, byteLength);
        readback.unmap();
        readback.destroy();
        return bytes;
      };
      const hashWords = (words) => {
        let hash = 0x811c9dc5;
        for (const word of words) {
          hash ^= word;
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash >>> 0;
      };
      const median = (values) => {
        requireTrue(values.length > 0, 'native median requires at least one sample');
        const ordered = [...values].sort((left, right) => left - right);
        const middle = Math.floor(ordered.length / 2);
        return ordered.length % 2 === 0
          ? (ordered[middle - 1] + ordered[middle]) / 2
          : ordered[middle];
      };
      const createCandidateTraversalTimestampRecorder = (label) => {
        const querySet = device.createQuerySet({
          label: `ulg-native-reaction-rule-index-${label}-queries`,
          type: 'timestamp',
          count: 2
        });
        const resolveBuffer = device.createBuffer({
          label: `ulg-native-reaction-rule-index-${label}-resolve`,
          size: 2 * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        const readbackBuffer = device.createBuffer({
          label: `ulg-native-reaction-rule-index-${label}-readback`,
          size: 2 * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        let token = null;
        let complete = false;
        return {
          recorder: {
            active: true,
            beginEncoderSpan(encoder, descriptor = {}) {
              if (descriptor.stage !== 'candidate-traversal') return null;
              requireTrue(token == null, `${label}: duplicate candidate traversal span`);
              token = { encoder, descriptor, ended: false };
              encoder.writeTimestamp(querySet, 0);
              return token;
            },
            endEncoderSpan(encoder, candidate) {
              requireTrue(
                candidate === token
                  && candidate?.encoder === encoder
                  && candidate.ended === false,
                `${label}: invalid candidate traversal timestamp completion`
              );
              encoder.writeTimestamp(querySet, 1);
              candidate.ended = true;
            }
          },
          async complete() {
            requireTrue(complete === false, `${label}: timestamp completed twice`);
            complete = true;
            requireTrue(token?.ended === true, `${label}: missing candidate traversal span`);
            const encoder = device.createCommandEncoder({
              label: `ulg-native-reaction-rule-index-${label}-resolve-encoder`
            });
            encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
            encoder.copyBufferToBuffer(
              resolveBuffer,
              0,
              readbackBuffer,
              0,
              2 * BigUint64Array.BYTES_PER_ELEMENT
            );
            device.queue.submit([encoder.finish()]);
            await readbackBuffer.mapAsync(
              GPUMapMode.READ,
              0,
              2 * BigUint64Array.BYTES_PER_ELEMENT
            );
            const timestamps = new BigUint64Array(
              readbackBuffer.getMappedRange(
                0,
                2 * BigUint64Array.BYTES_PER_ELEMENT
              ).slice(0)
            );
            readbackBuffer.unmap();
            requireTrue(
              timestamps[1] > timestamps[0]
                && timestamps[1] - timestamps[0] <= BigInt(Number.MAX_SAFE_INTEGER),
              `${label}: non-monotonic or unsafe timestamp evidence`
            );
            const durationNs = Number(timestamps[1] - timestamps[0]);
            return {
              stage: token.descriptor.stage,
              producerId: token.descriptor.producerId,
              durationNs,
              durationMs: durationNs / 1e6
            };
          },
          destroy() {
            querySet.destroy();
            resolveBuffer.destroy();
            readbackBuffer.destroy();
          }
        };
      };
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
        ab: property('liquid', 850),
        ab2: property('liquid', 825),
        c: property('solid', 1100),
        d: property('liquid', 950),
        cd: property('liquid', 900)
      };
      const reactions = [
        {
          a: 'a',
          b: 'b',
          product: 'ab',
          activationTemperatureK: 0,
          phaseRequirements: { a: ['solid'], b: ['liquid'] },
          specificEnthalpyJPerKg: -1000
        },
        {
          a: 'a',
          b: 'b',
          product: 'ab2',
          activationTemperatureK: 0,
          phaseRequirements: { a: ['solid'], b: ['liquid'] },
          specificEnthalpyJPerKg: -900
        }
      ];
      for (let index = 0; index < 62; index += 1) {
        reactions.push({
          a: 'c',
          b: 'd',
          product: 'cd',
          activationTemperatureK: 0,
          phaseRequirements: { c: ['solid'], d: ['liquid'] },
          specificEnthalpyJPerKg: -800 - index
        });
      }
      const reactionTable = reactionKernel.buildSphReactionTable(reactions, {
        materialProperties,
        contactRadiusM: 0.1
      });
      const thermalPhaseIneligibleReactionTable =
        reactionKernel.buildSphReactionTable([{
          ...reactions[0],
          activationTemperatureK: 1.0e9
        }], {
          materialProperties,
          contactRadiusM: 0.1
        });
      requireTrue(
        reactionTable.reactionCount === reactions.length,
        `reaction table lost rules: ${reactionTable.reactionCount}`
      );

      const particles = [];
      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const x = pairIndex * 0.25;
        particles.push({
          id: `a-${pairIndex}`,
          material: 'a',
          x: [x, 0, 0],
          v: [0, 0, 0],
          massKg: 1,
          specificInternalEnergyJPerKg: 600000
        });
        particles.push({
          id: `b-${pairIndex}`,
          material: 'b',
          x: [x + 0.04, 0, 0],
          v: [0, 0, 0],
          massKg: 1,
          specificInternalEnergyJPerKg: 600000
        });
      }
      const source = sphState.createSphState({
        smoothingLengthM: 0.1,
        dimension: 3,
        step: 1,
        particles
      });
      const packed = gpuBuffers.buildSphGpuParticleBuffers(source, { materialProperties });
      const epoch = {
        storageGeneration: 1,
        physicsTick: 1,
        physicsSubstep: 0,
        positionEpoch: 1,
        topologyEpoch: 0,
        chartEpoch: 0,
        levelEpoch: 1,
        supportEpoch: 1
      };
      Object.assign(packed, epoch);
      const upload = gpuBuffers.uploadSphGpuParticleBuffers(device, packed);
      Object.assign(upload, epoch, {
        bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
        slot: 0,
        sourceSlot: 0,
        nextSlot: 1
      });
      const mechanicsRows = new Float32Array(packed.particleCount * 32);
      for (let index = 0; index < packed.particleCount; index += 1) {
        mechanicsRows[index * 32 + 19] = 1;
      }
      const motionBoxDimsM = [
        Math.max(...particles.map((particle) => particle.x[0])) + 1,
        2,
        2
      ];
      const mechanicsBuffer = createTaggedBuffer(
        'ulg-native-reaction-motion-envelope-mechanics',
        mechanicsRows,
        GPUBufferUsage.STORAGE
          | GPUBufferUsage.COPY_SRC
          | GPUBufferUsage.COPY_DST
      );
      const reactionMotionEnvelope =
        motionEnvelopeModule.createSphReactionMotionEnvelope({
          maxFutureSubsteps: 4,
          dtS: 1 / 120,
          gridSpacingM: 0.1,
          cflFactor: 0.4,
          boxDimsM: motionBoxDimsM,
          separationDisplacementEnabled: true
        });
      const thermalPhaseReactionMotionEnvelope =
        motionEnvelopeModule.createSphReactionMotionEnvelope({
          maxFutureSubsteps: 4,
          dtS: 1 / 120,
          gridSpacingM: 0.1,
          cflFactor: 0.4,
          boxDimsM: motionBoxDimsM,
          separationDisplacementEnabled: true,
          thermalPhaseEvolutionEnabled: true
        });
      const motionProbeBuffer = device.createBuffer({
        label: 'ulg-native-reaction-motion-envelope-numeric-probe',
        size: 3 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      });
      try {
        const motionProbeModule = device.createShaderModule({
          label: 'ulg-native-reaction-motion-envelope-numeric-probe',
          code: `
${motionEnvelopeModule.sphReactionMotionEnvelopeWgsl}
@group(0) @binding(0) var<storage, read_write> probe: array<f32>;
@compute @workgroup_size(1)
fn main() {
  probe[0] = reaction_motion_relative_reach_upper(
    1u, 0.4, 0.1564, 0.0, false, false,
    vec3<f32>(0.01), 0.0, 0.1
  );
  probe[1] = reaction_motion_relative_reach_upper(
    1u, 0.4, 0.1564, 0.0, false, false,
    vec3<f32>(0.01), 1048577.0, 0.1
  );
  probe[2] = reaction_motion_relative_reach_upper(
    1u, 0.4, 0.05, 0.1, false, true,
    vec3<f32>(0.01), 0.0, 0.0
  );
}
`
        });
        const motionProbePipeline = device.createComputePipeline({
          label: 'ulg-native-reaction-motion-envelope-numeric-probe',
          layout: 'auto',
          compute: { module: motionProbeModule, entryPoint: 'main' }
        });
        const motionProbeBindGroup = device.createBindGroup({
          layout: motionProbePipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: motionProbeBuffer } }]
        });
        const motionProbeEncoder = device.createCommandEncoder({
          label: 'ulg-native-reaction-motion-envelope-numeric-probe'
        });
        const motionProbePass = motionProbeEncoder.beginComputePass();
        motionProbePass.setPipeline(motionProbePipeline);
        motionProbePass.setBindGroup(0, motionProbeBindGroup);
        motionProbePass.dispatchWorkgroups(1);
        motionProbePass.end();
        device.queue.submit([motionProbeEncoder.finish()]);
        const motionProbe = new Float32Array(await readBuffer(
          motionProbeBuffer,
          3 * Float32Array.BYTES_PER_ELEMENT,
          'ulg-native-reaction-motion-envelope-numeric-probe-readback'
        ));
        const xA = Math.fround(1048576.75);
        const xB = Math.fround(1048577.0);
        const dx = Math.fround(Math.fround(0.4) * Math.fround(0.1564));
        const storedA = Math.fround(xA + dx);
        const storedB = Math.fround(xB - dx);
        const initialDistance = xB - xA;
        requireTrue(
          storedA === storedB,
          'native position-store fixture did not close under f32 storage'
        );
        requireTrue(
          0.1 + motionProbe[0] < initialDistance,
          'near-origin physical reach unexpectedly covers the counterexample'
        );
        requireTrue(
          0.1 + motionProbe[1] >= initialDistance,
          'absolute-coordinate store allowance missed the counterexample'
        );
        const oldCflSeparationRelativeReach = 2 * (
          Math.fround(0.4) * Math.fround(0.05) + 0.5 * 0.1
        );
        const contactOnlyCounterexampleDistanceM = 0.5;
        requireTrue(
          oldCflSeparationRelativeReach < contactOnlyCounterexampleDistanceM,
          'native contact fixture is not outside the former CFL/separation reach'
        );
        requireTrue(
          motionProbe[2] >= contactOnlyCounterexampleDistanceM,
          'canonical 16-diameter contact trust failed to cover the adversarial pair'
        );
      } finally {
        motionProbeBuffer.destroy();
      }
      const gridSpacingM = 0.1;
      const activeRows = new Float32Array(packed.particleCount * 16);
      for (let index = 0; index < packed.particleCount; index += 1) {
        const stateOffset = index * 8;
        const x = packed.state[stateOffset];
        const y = packed.state[stateOffset + 1];
        const z = packed.state[stateOffset + 2];
        const cellX = Math.floor(x / gridSpacingM);
        const cellY = Math.floor(y / gridSpacingM);
        const cellZ = Math.floor(z / gridSpacingM);
        activeRows.set([
          0, cellX, cellY, cellZ,
          cellX, cellY, cellZ, gridSpacingM,
          gridSpacingM, 2 * gridSpacingM, index, 1,
          x, y, z, 0
        ], index * 16);
      }
      const activeNodeBuffer = createTaggedBuffer(
        'ulg-native-reaction-rule-index-active-nodes',
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
        sourceStateBuffer: upload.stateBuffer,
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
        spatialEpochLevelSpacingMode:
          'base-grid-spacing-times-pow2-level',
        spatialEpochPositionAuthority:
          'same-epoch-pre-integration-particle-state',
        spatialEpochMinLevel: 0,
        spatialEpochMaxLevel: 0,
        spatialEpochBaseGridSpacingM: gridSpacingM,
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

      let fullScanRecordBuffer = null;
      try {
        fullScanRecordBuffer = createTaggedBuffer(
          'ulg-native-reaction-rule-index-full-scan-records',
          reactionTable.combinedRecords,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        const runVariant = async ({
          indexed,
          label,
          motion = false,
          table = reactionTable,
          envelope = reactionMotionEnvelope
        }) => {
          const timestamps = createCandidateTraversalTimestampRecorder(label);
          let generation = null;
          let proposal = null;
          try {
            // A discovery arena deliberately remains quarantined until its
            // spatial generation retires. Each A/B sample therefore uses the
            // same immutable source buffers but a fresh real generation.
            generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
              device,
              activeNodeList,
              particleCount: packed.particleCount,
              particleIdentityBuffer: upload.identityBuffer,
              particleIdentityStrideWords: 1,
              laneId: `native-reaction-rule-index-${label}`,
              sourceFamily: `native-reaction-rule-index-${label}`,
              mechanicsLevels: []
            });
            await device.queue.onSubmittedWorkDone();
            requireTrue(
              generation.ready === true && generation.selected === true,
              `${label}: canonical spatial generation rejected: ${generation.status}: ${generation.reason || 'no reason'}`
            );
            proposal = await discovery.runSchroederSpatialReactionDiscoveryProposalWebGpu({
              device,
              generation,
              sphParticleState: packed,
              sphParticleUpload: upload,
              reactionTable: table,
              reactionRecordBuffer: indexed ? null : fullScanRecordBuffer,
              sourceMechanicsBuffer: motion ? mechanicsBuffer : null,
              reactionMotionEnvelope: motion ? envelope : null,
              boxDimsM: motion ? motionBoxDimsM : null,
              observeGpuEvidence: true,
              captureActivationObservation: true,
              gpuTimestampRecorder: timestamps.recorder
            });
            await device.queue.onSubmittedWorkDone();
            const activationObservation =
              await discovery
                .observeSchroederSpatialReactionDiscoveryActivation(
                  proposal,
                  { device }
                );
            requireTrue(
              activationObservation.observationSucceeded === true
                && activationObservation.uncertainty === false
                && activationObservation.readbackByteLength
                  === Uint32Array.BYTES_PER_ELEMENT
                && activationObservation.mapAsyncCount === 1
                && (motion
                  ? activationObservation.triggeredSourceCount
                      >= proposal.observedEvidence?.proposalCount
                  : activationObservation.triggeredSourceCount
                      === proposal.observedEvidence?.proposalCount)
                && activationObservation.motionEnvelope
                  === (motion ? envelope : null),
              `${label}: four-byte activation reduction disagreed with the canonical diagnostic count: activation=${JSON.stringify(activationObservation)} evidence=${JSON.stringify(proposal.observedEvidence)}`
            );
            const receipt = proposal.receipt;
            requireTrue(
              receipt?.status === 'schroeder-spatial-epoch-consumer-receipt-finalized'
                && receipt.consumerId === 'reaction-discovery'
                && receipt.deviceId === generation.execution?.deviceId
                && receipt.generationId === generation.execution?.generationId
                && receipt.gpuAuthenticated === true
                && receipt.submitPerformed === true
                && receipt.generationBound === true
                && receipt.traversalCount === receipt.expectedTraversalCount
                && receipt.fallbackObserved === false
                && receipt.fullReadbackPerformed === false
                && receipt.privateLookupBuildCount === 0
                && receipt.fixedCandidateBuildCount === 0
                && receipt.exhaustiveTraversalCount === 0,
              `${label}: reaction receipt did not prove the native no-fallback route: ${JSON.stringify(receipt)}`
            );
            const proposalBytes = await readBuffer(
              proposal.proposalBuffer,
              proposal.proposalBufferByteLength,
              `ulg-native-reaction-rule-index-${label}-proposal`
            );
            const proposalWords = new Uint32Array(proposalBytes);
            const timestamp = await timestamps.complete();
            return {
              proposalWords,
              proposalHash: hashWords(proposalWords),
              evidence: proposal.observedEvidence,
              activationObservation,
              timestamp,
              reactionRuleIndex: {
                mode: proposal.reactionRuleIndex.mode,
                pairCount: proposal.reactionRuleIndex.pairCount,
                ruleCount: proposal.reactionRuleIndex.ruleCount,
                uploadByteLength: proposal.reactionRecordUploadByteLength,
                prefixByteLength: proposal.reactionRecordPrefixByteLength
              },
              receipt: {
                status: receipt.status,
                consumerId: receipt.consumerId,
                deviceId: receipt.deviceId,
                generationId: receipt.generationId,
                gpuAuthenticated: receipt.gpuAuthenticated,
                submitPerformed: receipt.submitPerformed,
                generationBound: receipt.generationBound,
                expectedTraversalCount: receipt.expectedTraversalCount,
                traversalCount: receipt.traversalCount,
                fallbackObserved: receipt.fallbackObserved,
                fullReadbackPerformed: receipt.fullReadbackPerformed,
                privateLookupBuildCount: receipt.privateLookupBuildCount,
                fixedCandidateBuildCount: receipt.fixedCandidateBuildCount,
                exhaustiveTraversalCount: receipt.exhaustiveTraversalCount
              },
              motionEnvelopeEnabled:
                proposal.activationMotionEnvelopeEnabled === true
            };
          } finally {
            proposal?.destroy();
            if (generation) {
              spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
              await device.queue.onSubmittedWorkDone();
              if (generation.releasePromise) await generation.releasePromise;
            }
            timestamps.destroy();
          }
        };

        // Warm both arena variants before the alternating timestamp campaign.
        const indexedWarm = await runVariant({ indexed: true, label: 'indexed-warm' });
        const fullWarm = await runVariant({ indexed: false, label: 'full-warm' });
        requireTrue(
          indexedWarm.proposalHash === fullWarm.proposalHash,
          'warm indexed/full proposal hashes differ'
        );
        const canonicalMotion = await runVariant({
          indexed: true,
          label: 'canonical-motion-envelope',
          motion: true
        });
        requireTrue(
          canonicalMotion.motionEnvelopeEnabled === true
            && canonicalMotion.activationObservation.observationSucceeded
              === true
            && canonicalMotion.activationObservation.motionEnvelope
              ?.maxFutureSubsteps === 4,
          `canonical native motion watch failed: ${JSON.stringify(canonicalMotion.activationObservation)}`
        );
        const thermalPhaseLatch = await runVariant({
          indexed: true,
          label: 'canonical-thermal-phase-latch',
          motion: true,
          table: thermalPhaseIneligibleReactionTable,
          envelope: thermalPhaseReactionMotionEnvelope
        });
        requireTrue(
          thermalPhaseLatch.evidence.proposalCount === 0
            && thermalPhaseLatch.activationObservation.observationSucceeded
              === true
            && thermalPhaseLatch.activationObservation.triggeredSourceCount
              === packed.particleCount
            && thermalPhaseLatch.activationObservation.nodeDomain
              === 'fixed-phase-carrier-slot'
            && thermalPhaseLatch.activationObservation.motionEnvelope
              ?.futureRestDiameterBoundStatus
                === 'future-upper-unclaimed-trigger-positive',
          `canonical thermal/phase latch failed to override an exact current-state zero: ${JSON.stringify(thermalPhaseLatch.activationObservation)}`
        );

        const tier0StateBuffer = createTaggedBuffer(
          'ulg-native-tier0-reaction-motion-watch-state',
          packed.state,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const tier0ThermoBuffer = createTaggedBuffer(
          'ulg-native-tier0-reaction-motion-watch-thermo',
          packed.thermo,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const tier0MechanicsBuffer = createTaggedBuffer(
          'ulg-native-tier0-reaction-motion-watch-mechanics',
          mechanicsRows,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        let tier0MotionProposal = null;
        let tier0MotionObservation = null;
        let canonicalTerminalMotionObservation = null;
        let canonicalThermalPhaseLatchObservation = null;
        let canonicalTerminalFamilyPreserved = false;
        let tier0Separation = null;
        try {
          const encoder = device.createCommandEncoder({
            label: 'ulg-native-tier0-reaction-motion-watch'
          });
          tier0Separation =
            motionWatchModule
              .encodeSphReactionMotionEnvelopeWatchTerminalBinsWebGpu(
                device,
                encoder,
                {
                  stateBuffer: tier0StateBuffer,
                  mechanicsBuffer: tier0MechanicsBuffer,
                  particleCount: packed.particleCount,
                  boxDimsM: motionBoxDimsM,
                  // Keep the producer enabled so it emits the authentic
                  // post-apply refill authority. Every fixture velocity is
                  // zero, so damping mints bins without moving a particle.
                  relaxation: 0,
                  normalVelocityDamping: 1,
                  maxPairRestDistanceM: 1,
                  gridSpacingM: 0.1
                }
              );
          tier0MotionProposal =
            motionWatchModule.encodeSphReactionMotionEnvelopeWatchWebGpu({
              device,
              encoder,
              terminalStateBuffer: tier0StateBuffer,
              terminalThermoBuffer: tier0ThermoBuffer,
              terminalMechanicsBuffer: tier0MechanicsBuffer,
              reactionTable,
              reactionMotionEnvelope,
              boxDimsM: motionBoxDimsM,
              neighborBins:
                tier0Separation.postSeparationThermalBinCandidate,
              particleCount: packed.particleCount
            });
          device.queue.submit([encoder.finish()]);
          requireTrue(
            tier0MotionProposal.markSubmittedWork() === true,
            'native Tier0 watch did not accept its caller submission'
          );
          await device.queue.onSubmittedWorkDone();
          tier0MotionObservation =
            await motionWatchModule.observeSphReactionMotionEnvelopeWatch(
              tier0MotionProposal,
              { device }
            );
          requireTrue(
            tier0MotionProposal.dispatchCount === 3
              && tier0MotionObservation.observationSucceeded === true
              && tier0MotionObservation.uncertainty === false
              && tier0MotionObservation.triggeredSourceCount
                === packed.particleCount
              && tier0MotionObservation.producerRoute
                === 'tier0-fused-resident-sequence'
              && tier0MotionObservation.motionEnvelope
                === reactionMotionEnvelope
              && tier0MotionObservation.triggeredSourceCount
                === canonicalMotion.activationObservation
                  .triggeredSourceCount,
            `native Tier0 motion watch failed: ${JSON.stringify({
              observation: tier0MotionObservation,
              proposal: {
                dispatchCount: tier0MotionProposal.dispatchCount,
                terminalBinsAdmitted:
                  tier0MotionProposal.terminalBinsAdmitted,
                status: tier0MotionProposal.status
              },
              separation: {
                enabled: tier0Separation?.enabled,
                postApplyBinCandidate: Boolean(
                  tier0Separation?.postSeparationThermalBinCandidate
                )
              },
              uncapturedErrors
            })}`
          );

          let canonicalTerminalProposal = null;
          let canonicalThermalPhaseLatchProposal = null;
          const canonicalScopedErrors = [];
          device.pushErrorScope('validation');
          device.pushErrorScope('internal');
          device.pushErrorScope('out-of-memory');
          try {
            canonicalTerminalProposal =
              motionWatchModule
                .runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
                  device,
                  terminalStateBuffer: tier0StateBuffer,
                  terminalThermoBuffer: tier0ThermoBuffer,
                  terminalMechanicsBuffer: tier0MechanicsBuffer,
                  reactionTable,
                  reactionMotionEnvelope,
                  particleCount: packed.particleCount,
                  boxDimsM: motionBoxDimsM
                });
            requireTrue(
              canonicalTerminalProposal.ownedCommandSubmissionCount === 1
                && canonicalTerminalProposal.producerRoute
                  === 'canonical-schroeder'
                && canonicalTerminalProposal.sampleStage
                  === 'canonical-terminal-published-carrier-family-motion-envelope'
                && canonicalTerminalProposal.nodeDomain
                  === 'fixed-phase-carrier-slot',
              'native canonical terminal watch published torn route metadata'
            );
            await device.queue.onSubmittedWorkDone();
            requireTrue(
              motionWatchModule
                .markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
                  canonicalTerminalProposal,
                  { device }
                ) === true,
              'native canonical terminal watch rejected its completion fence'
            );
            canonicalTerminalMotionObservation =
              await motionWatchModule.observeSphReactionMotionEnvelopeWatch(
                canonicalTerminalProposal,
                { device }
              );
            requireTrue(
              canonicalTerminalMotionObservation.observationSucceeded === true
                && canonicalTerminalMotionObservation.uncertainty === false
                && canonicalTerminalMotionObservation.triggeredSourceCount
                  === packed.particleCount
                && canonicalTerminalMotionObservation.triggeredSourceCount
                  === tier0MotionObservation.triggeredSourceCount
                && canonicalTerminalMotionObservation.producerRoute
                  === 'canonical-schroeder',
              `native canonical terminal motion watch failed: ${JSON.stringify(canonicalTerminalMotionObservation)}`
            );
            canonicalThermalPhaseLatchProposal =
              motionWatchModule
                .runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
                  device,
                  terminalStateBuffer: tier0StateBuffer,
                  terminalThermoBuffer: tier0ThermoBuffer,
                  terminalMechanicsBuffer: tier0MechanicsBuffer,
                  reactionTable: thermalPhaseIneligibleReactionTable,
                  reactionMotionEnvelope:
                    thermalPhaseReactionMotionEnvelope,
                  particleCount: packed.particleCount,
                  boxDimsM: motionBoxDimsM
                });
            await device.queue.onSubmittedWorkDone();
            requireTrue(
              motionWatchModule
                .markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
                  canonicalThermalPhaseLatchProposal,
                  { device }
                ) === true,
              'native canonical thermal/phase latch rejected its completion fence'
            );
            canonicalThermalPhaseLatchObservation =
              await motionWatchModule.observeSphReactionMotionEnvelopeWatch(
                canonicalThermalPhaseLatchProposal,
                { device }
              );
            requireTrue(
              canonicalThermalPhaseLatchObservation.observationSucceeded
                === true
                && canonicalThermalPhaseLatchObservation
                  .triggeredSourceCount === packed.particleCount
                && canonicalThermalPhaseLatchObservation.motionEnvelope
                  === thermalPhaseReactionMotionEnvelope,
              `native canonical thermal/phase terminal latch failed: ${JSON.stringify(canonicalThermalPhaseLatchObservation)}`
            );

            const [stateAfter, thermoAfter, mechanicsAfter] = await Promise.all([
              readBuffer(
                tier0StateBuffer,
                packed.state.byteLength,
                'ulg-native-canonical-terminal-watch-state-after'
              ),
              readBuffer(
                tier0ThermoBuffer,
                packed.thermo.byteLength,
                'ulg-native-canonical-terminal-watch-thermo-after'
              ),
              readBuffer(
                tier0MechanicsBuffer,
                mechanicsRows.byteLength,
                'ulg-native-canonical-terminal-watch-mechanics-after'
              )
            ]);
            const bytesEqual = (actual, expected) => {
              const left = new Uint8Array(actual);
              const right = new Uint8Array(
                expected.buffer,
                expected.byteOffset,
                expected.byteLength
              );
              return left.length === right.length
                && left.every((value, index) => value === right[index]);
            };
            canonicalTerminalFamilyPreserved = Boolean(
              bytesEqual(stateAfter, packed.state)
              && bytesEqual(thermoAfter, packed.thermo)
              && bytesEqual(mechanicsAfter, mechanicsRows)
            );
            requireTrue(
              canonicalTerminalFamilyPreserved,
              'native canonical terminal bin/watch producer mutated its borrowed family'
            );
          } finally {
            canonicalTerminalProposal?.destroy();
            canonicalThermalPhaseLatchProposal?.destroy();
            canonicalScopedErrors.push(
              await device.popErrorScope(),
              await device.popErrorScope(),
              await device.popErrorScope()
            );
          }
          requireTrue(
            canonicalScopedErrors.every((error) => error == null),
            `native canonical terminal watch raised scoped GPU errors: ${canonicalScopedErrors.map((error) => error?.message || null).join(', ')}`
          );
        } finally {
          tier0MotionProposal?.destroy();
          for (const buffer of tier0Separation?.transientBuffers || []) {
            buffer.destroy();
          }
          tier0StateBuffer.destroy();
          tier0ThermoBuffer.destroy();
          tier0MechanicsBuffer.destroy();
        }
        const indexedRuns = [];
        const fullRuns = [];
        for (let sample = 0; sample < sampleCount; sample += 1) {
          const firstIndexed = sample % 2 === 0;
          const first = await runVariant({
            indexed: firstIndexed,
            label: `${firstIndexed ? 'indexed' : 'full'}-${sample}-a`
          });
          const second = await runVariant({
            indexed: !firstIndexed,
            label: `${firstIndexed ? 'full' : 'indexed'}-${sample}-b`
          });
          (firstIndexed ? indexedRuns : fullRuns).push(first);
          (firstIndexed ? fullRuns : indexedRuns).push(second);
        }
        const referenceIndexed = indexedRuns[0];
        const referenceFull = fullRuns[0];
        const proposalsEqual = indexedRuns.every((run) => (
          run.proposalHash === referenceFull.proposalHash
            && run.proposalWords.length === referenceFull.proposalWords.length
            && run.proposalWords.every((word, index) => word === referenceFull.proposalWords[index])
        )) && fullRuns.every((run) => (
          run.proposalHash === referenceIndexed.proposalHash
            && run.proposalWords.length === referenceIndexed.proposalWords.length
            && run.proposalWords.every((word, index) => word === referenceIndexed.proposalWords[index])
        ));
        const indexedEvidence = referenceIndexed.evidence;
        const fullEvidence = referenceFull.evidence;
        requireTrue(proposalsEqual, 'indexed/full proposal rows differed');
        requireTrue(
          referenceIndexed.activationObservation.triggeredSourceCount
            === indexedEvidence.proposalCount
            && referenceFull.activationObservation.triggeredSourceCount
              === fullEvidence.proposalCount,
          `activation reduction parity failed: indexed=${JSON.stringify(referenceIndexed.activationObservation)} full=${JSON.stringify(referenceFull.activationObservation)}`
        );
        requireTrue(
          referenceIndexed.reactionRuleIndex.mode === 'material-pair-indexed'
            && referenceIndexed.reactionRuleIndex.pairCount === 2
            && referenceIndexed.reactionRuleIndex.ruleCount === reactionTable.reactionCount,
          `indexed rule artifact was not admitted: ${JSON.stringify(referenceIndexed.reactionRuleIndex)}`
        );
        requireTrue(
          referenceFull.reactionRuleIndex.mode === 'full-rule-scan',
          `borrowed record buffer did not force exact full scan: ${JSON.stringify(referenceFull.reactionRuleIndex)}`
        );
        requireTrue(
          indexedEvidence.ruleIndexPairLookupCount > 0
            && indexedEvidence.ruleIndexRuleVisitCount > 0
            && indexedEvidence.fullRuleScanRuleVisitCount === 0
            // The conservative cell halo admits same-material neighbors just
            // outside contact range. A pair-index miss is the correct cheap
            // rejection for those rows; it must not fall through to a scan.
            && indexedEvidence.ruleIndexPairMissCount > 0,
          `indexed evidence missing or fell back: ${JSON.stringify(indexedEvidence)}`
        );
        requireTrue(
          fullEvidence.ruleIndexPairLookupCount === 0
            && fullEvidence.ruleIndexRuleVisitCount === 0
            && fullEvidence.fullRuleScanRuleVisitCount > 0,
          `full-scan evidence was not isolated: ${JSON.stringify(fullEvidence)}`
        );
        requireTrue(
          indexedEvidence.exactCellTreeNodeVisitCount > 0
            && indexedEvidence.exactCellTreeLeafVisitCount > 0
            && indexedEvidence.exactCellTreeMemberVisitCount
              >= indexedEvidence.candidateVisitCount
            && fullEvidence.exactCellTreeNodeVisitCount
              === indexedEvidence.exactCellTreeNodeVisitCount
            && fullEvidence.exactCellTreeLeafVisitCount
              === indexedEvidence.exactCellTreeLeafVisitCount
            && fullEvidence.exactCellTreeMemberVisitCount
              === indexedEvidence.exactCellTreeMemberVisitCount,
          `shared exact-cell traversal telemetry was missing or variant-dependent: indexed=${JSON.stringify(indexedEvidence)} full=${JSON.stringify(fullEvidence)}`
        );
        requireTrue(
          fullEvidence.fullRuleScanRuleVisitCount
            >= indexedEvidence.ruleIndexRuleVisitCount * 20,
          `rule-visit reduction was too small: indexed=${indexedEvidence.ruleIndexRuleVisitCount}, full=${fullEvidence.fullRuleScanRuleVisitCount}`
        );
        const indexedMs = indexedRuns.map((run) => run.timestamp.durationMs);
        const fullMs = fullRuns.map((run) => run.timestamp.durationMs);
        const indexedMedianMs = median(indexedMs);
        const fullMedianMs = median(fullMs);
        requireTrue(
          indexedMedianMs <= fullMedianMs * 1.1,
          `indexed traversal regressed: indexed=${indexedMedianMs}ms full=${fullMedianMs}ms`
        );
        const firstProposal = new Float32Array(referenceIndexed.proposalWords.buffer);
        requireTrue(
          firstProposal[0] >= 0
            && firstProposal[1] === 0
            && firstProposal[2] > 0,
          `indexed proposal did not retain original rule-order tie break: ${Array.from(firstProposal.slice(0, 4))}`
        );
        await device.queue.onSubmittedWorkDone();
        const outerScopedErrors = [
          await device.popErrorScope(),
          await device.popErrorScope(),
          await device.popErrorScope()
        ];
        requireTrue(
          outerScopedErrors.every((error) => error == null),
          `native reaction-rule-index run raised scoped GPU errors: ${outerScopedErrors.map((error) => error?.message || null).join(', ')}`
        );
        return {
          status: 'complete',
          particleCount: packed.particleCount,
          reactionCount: reactionTable.reactionCount,
          proposalParity: proposalsEqual,
          canonicalMotion: {
            motionEnvelopeEnabled: canonicalMotion.motionEnvelopeEnabled,
            activationObservation: canonicalMotion.activationObservation
          },
          tier0Motion: tier0MotionObservation,
          canonicalTerminalMotion: canonicalTerminalMotionObservation,
          canonicalThermalPhaseLatch:
            canonicalThermalPhaseLatchObservation,
          sharedThermalPhaseLatch: thermalPhaseLatch.activationObservation,
          canonicalTerminalFamilyPreserved,
          indexed: {
            ...referenceIndexed.reactionRuleIndex,
            evidence: indexedEvidence,
            activationObservation:
              referenceIndexed.activationObservation,
            receipt: referenceIndexed.receipt,
            samplesMs: indexedMs,
            medianMs: indexedMedianMs
          },
          full: {
            ...referenceFull.reactionRuleIndex,
            evidence: fullEvidence,
            activationObservation: referenceFull.activationObservation,
            receipt: referenceFull.receipt,
            samplesMs: fullMs,
            medianMs: fullMedianMs
          },
          ruleVisitReduction:
            fullEvidence.fullRuleScanRuleVisitCount
              / indexedEvidence.ruleIndexRuleVisitCount,
          timestampSpeedup: fullMedianMs / indexedMedianMs
        };
      } finally {
        fullScanRecordBuffer?.destroy();
        discovery.destroySchroederSpatialReactionDiscoveryProposalCache(device);
        activeNodeBuffer.destroy();
        mechanicsBuffer.destroy();
        gpuBuffers.destroySphGpuParticleBuffers(upload);
      }
    }, { sampleCount: 4, pairCount: 128 });

    assert.equal(native.status, 'complete', native.reason || JSON.stringify(native));
    assert.equal(native.proposalParity, true);
    assert.equal(native.canonicalMotion.motionEnvelopeEnabled, true);
    assert.equal(
      native.canonicalMotion.activationObservation.observationSucceeded,
      true
    );
    assert.equal(native.tier0Motion.observationSucceeded, true);
    assert.equal(native.tier0Motion.uncertainty, false);
    assert.equal(native.tier0Motion.triggeredSourceCount, native.particleCount);
    assert.equal(
      native.canonicalTerminalMotion.observationSucceeded,
      true
    );
    assert.equal(native.canonicalTerminalMotion.uncertainty, false);
    assert.equal(
      native.canonicalTerminalMotion.triggeredSourceCount,
      native.particleCount
    );
    assert.equal(
      native.canonicalTerminalMotion.producerRoute,
      'canonical-schroeder'
    );
    assert.equal(native.canonicalTerminalFamilyPreserved, true);
    assert.equal(
      native.sharedThermalPhaseLatch.triggeredSourceCount,
      native.particleCount
    );
    assert.equal(
      native.canonicalThermalPhaseLatch.triggeredSourceCount,
      native.particleCount
    );
    assert.equal(native.indexed.evidence.fullRuleScanRuleVisitCount, 0);
    assert.equal(native.full.evidence.ruleIndexRuleVisitCount, 0);
    assert.equal(
      native.indexed.activationObservation.triggeredSourceCount,
      native.indexed.evidence.proposalCount
    );
    assert.equal(
      native.full.activationObservation.triggeredSourceCount,
      native.full.evidence.proposalCount
    );
    assert.ok(native.indexed.evidence.exactCellTreeNodeVisitCount > 0);
    assert.ok(native.indexed.evidence.exactCellTreeLeafVisitCount > 0);
    assert.ok(
      native.indexed.evidence.exactCellTreeMemberVisitCount
        >= native.indexed.evidence.candidateVisitCount
    );
    assert.equal(
      native.indexed.receipt.status,
      'schroeder-spatial-epoch-consumer-receipt-finalized'
    );
    assert.equal(native.indexed.receipt.consumerId, 'reaction-discovery');
    assert.equal(native.indexed.receipt.gpuAuthenticated, true);
    assert.equal(native.indexed.receipt.fallbackObserved, false);
    assert.equal(native.indexed.receipt.fullReadbackPerformed, false);
    assert.equal(native.indexed.receipt.privateLookupBuildCount, 0);
    assert.equal(native.indexed.receipt.fixedCandidateBuildCount, 0);
    assert.equal(native.indexed.receipt.exhaustiveTraversalCount, 0);
    assert.ok(native.ruleVisitReduction >= 20, JSON.stringify(native));
    assert.ok(native.timestampSpeedup >= 1 / 1.1, JSON.stringify(native));
  } finally {
    await browser.close();
  }
});
