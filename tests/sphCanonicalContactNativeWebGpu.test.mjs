import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_CONTACT === '1';
const RUN_NATIVE_TIMESTAMPS =
  process.env.ULG_RUN_NATIVE_CONTACT_TIMESTAMPS === '1';
const BASE_URL = process.env.ULG_CONTACT_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_CONTACT_CHROME
  || '/usr/bin/google-chrome';

test('native Vulkan canonical contact applies deferred swept nonpenetration with bounded multi-contact response', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_CONTACT=1 for native Vulkan WebGPU',
  timeout: RUN_NATIVE_TIMESTAMPS ? 900_000 : 300_000
}, async (t) => {
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
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async (runMaterializeTimestampCampaign) => {
      const fail = (message) => {
        throw new Error(message);
      };
      const requireTrue = (condition, message) => {
        if (!condition) fail(message);
      };
      const finite = (value) => Number.isFinite(Number(value));
      const vectorLength = (value) => Math.hypot(value[0], value[1], value[2]);
      const subtract3 = (left, right) => left.map(
        (value, axis) => value - right[axis]
      );
      const dot3 = (left, right) => (
        left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
      );
      const totalMomentum = (state) => {
        const momentum = [0, 0, 0];
        for (let index = 0; index < state.length / 8; index += 1) {
          const massKg = state[index * 8 + 3];
          for (let axis = 0; axis < 3; axis += 1) {
            momentum[axis] += massKg * state[index * 8 + 4 + axis];
          }
        }
        return momentum;
      };
      const totalMassPosition = (state) => {
        const moment = [0, 0, 0];
        for (let index = 0; index < state.length / 8; index += 1) {
          const massKg = state[index * 8 + 3];
          for (let axis = 0; axis < 3; axis += 1) {
            moment[axis] += massKg * state[index * 8 + axis];
          }
        }
        return moment;
      };
      const totalKineticEnergyJ = (state) => {
        let energyJ = 0;
        for (let index = 0; index < state.length / 8; index += 1) {
          const massKg = state[index * 8 + 3];
          const velocity = state.slice(index * 8 + 4, index * 8 + 7);
          energyJ += 0.5 * massKg * dot3(velocity, velocity);
        }
        return energyJ;
      };
      const totalInternalEnergyJ = (state) => {
        let energyJ = 0;
        for (let index = 0; index < state.length / 8; index += 1) {
          energyJ += state[index * 8 + 3] * state[index * 8 + 7];
        }
        return energyJ;
      };

      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const timestampQueryAvailable = adapter.features?.has('timestamp-query')
        === true;
      if (runMaterializeTimestampCampaign && !timestampQueryAvailable) {
        return {
          status: 'unsupported',
          reason: 'timestamp-query unavailable on the selected adapter'
        };
      }
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter, {
          timestampProfilingRequested: runMaterializeTimestampCampaign
        })
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      const proposalUrl =
        '/src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
      const proposalSource = await fetch(proposalUrl).then((response) => {
        if (!response.ok) fail(`mechanical proposal module fetch failed: ${response.status}`);
        return response.text();
      });
      const dependencyUrl = (sources, path) => {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const { source, url } of sources) {
          const match = source.match(new RegExp(
            `["']([^"']*${escaped}(?:\\?[^"']*)?)["']`
          ));
          if (match) return new URL(match[1], new URL(url, location.href)).href;
        }
        fail(`Vite dependency URL not found for ${path}`);
      };
      const spatialUrl = dependencyUrl(
        [{ source: proposalSource, url: proposalUrl }],
        '/schroederSpatialEpochGpu.js'
      );
      const identityUrl = dependencyUrl(
        [{ source: proposalSource, url: proposalUrl }],
        '/sphGpuDeviceIdentity.js'
      );
      const [
        proposalModule,
        pairGraphAbi,
        spatial,
        identity,
        gpuBuffers,
        closuresModule,
        thermoState,
        sphStateModule
      ] = await Promise.all([
        import(proposalUrl),
        import('/ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js'),
        import(spatialUrl),
        import(identityUrl),
        import('/src/runtime/sph/sphGpuBuffers.js'),
        import('/src/runtime/material/materialClosures.js'),
        import('/src/runtime/material/thermoState.js'),
        import('/src/runtime/sph/sphState.js')
      ]);
      const evidenceWord =
        pairGraphAbi.SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD;
      const controlWord =
        pairGraphAbi.SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD;
      const graphStatus =
        pairGraphAbi.SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STATUS;
      const solverIterations =
        proposalModule.SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS;
      const matchingCleanupPasses =
        proposalModule.SCHROEDER_SPATIAL_MECHANICAL_MATCHING_CLEANUP_PASSES;

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
      const createMechanicalMaterializeTimestampRecorder = (fixtureName) => {
        const querySet = device.createQuerySet({
          label: `ulg-native-contact-${fixtureName}-materialize-timestamps`,
          type: 'timestamp',
          count: 2
        });
        const resolveBuffer = device.createBuffer({
          label: `ulg-native-contact-${fixtureName}-materialize-resolve`,
          size: 2 * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        const readbackBuffer = device.createBuffer({
          label: `ulg-native-contact-${fixtureName}-materialize-readback`,
          size: 2 * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        let token = null;
        let completed = false;
        const producerId =
          'schroeder-spatial-mechanical-contact-graph:materialize';
        return {
          recorder: {
            active: true,
            beginEncoderSpan(encoder, descriptor = {}) {
              if (
                descriptor.producerId !== producerId
                || descriptor.stage !== 'materialize'
              ) {
                return null;
              }
              requireTrue(
                token == null,
                `${fixtureName}: materialize timestamp span was duplicated`
              );
              token = {
                descriptor: { ...descriptor },
                startQueryIndex: 0,
                endQueryIndex: 1,
                begun: true,
                ended: false
              };
              encoder.writeTimestamp(querySet, token.startQueryIndex);
              return token;
            },
            endEncoderSpan(encoder, candidate) {
              requireTrue(
                candidate === token && candidate?.begun === true
                  && candidate.ended === false,
                `${fixtureName}: materialize timestamp end did not match its begin`
              );
              encoder.writeTimestamp(querySet, candidate.endQueryIndex);
              candidate.ended = true;
            }
          },
          async complete() {
            requireTrue(
              completed === false,
              `${fixtureName}: materialize timestamp recorder completed twice`
            );
            completed = true;
            requireTrue(
              token?.ended === true,
              `${fixtureName}: materialize timestamp span was not closed`
            );
            const encoder = device.createCommandEncoder({
              label: `ulg-native-contact-${fixtureName}-materialize-resolve-encoder`
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
            const durationNsBigInt = timestamps[1] - timestamps[0];
            requireTrue(
              timestamps[1] > timestamps[0]
                && durationNsBigInt <= BigInt(Number.MAX_SAFE_INTEGER),
              `${fixtureName}: materialize timestamp was non-monotonic or unsafe`
            );
            const durationNs = Number(durationNsBigInt);
            return {
              schema: 'peercompute.ulg.sph-native-mechanical-materialize-timestamp.v1',
              status: 'complete',
              producerId,
              stage: 'materialize',
              spanClass: token.descriptor.spanClass ?? null,
              generationId: token.descriptor.generationId ?? null,
              startTimestampNs: timestamps[0].toString(),
              endTimestampNs: timestamps[1].toString(),
              durationNs,
              durationMs: durationNs / 1e6,
              queryCount: 2,
              sameProductionCommandEncoder: true,
              productionBuildPassSplitForTimestamp: true,
              classification: 'benchmark-only-timestamp-query-readback'
            };
          },
          destroy() {
            querySet.destroy();
            resolveBuffer.destroy();
            readbackBuffer.destroy();
          }
        };
      };
      const stateRow = (state, index) => Array.from(
        state.slice(index * 8, index * 8 + 8)
      );
      const pairGeometry = (state, mechanics, left, right) => {
        const leftRow = stateRow(state, left);
        const rightRow = stateRow(state, right);
        const delta = subtract3(leftRow.slice(0, 3), rightRow.slice(0, 3));
        const leftDiameter = Math.cbrt(Math.max(mechanics[left * 32 + 19], 0));
        const rightDiameter = Math.cbrt(Math.max(mechanics[right * 32 + 19], 0));
        return {
          left,
          right,
          leftPosition: leftRow.slice(0, 3),
          rightPosition: rightRow.slice(0, 3),
          leftVelocity: leftRow.slice(4, 7),
          rightVelocity: rightRow.slice(4, 7),
          delta,
          distanceM: vectorLength(delta),
          restDistanceM: 0.5 * (leftDiameter + rightDiameter),
          leftDiameter,
          rightDiameter
        };
      };

      const shaderDiagnostics = [];
      for (const [name, code] of [
        ['build', proposalModule.schroederSpatialMechanicalProposalWgsl],
        ['active-rank-build', proposalModule.schroederSpatialMechanicalProposalActiveRankWgsl],
        ['control', proposalModule.schroederSpatialMechanicalGraphControlWgsl],
        ['solver', proposalModule.schroederSpatialMechanicalGraphSolverWgsl],
        [
          'interface-receipt',
          proposalModule.schroederSpatialMechanicalInterfaceReceiptWgsl
        ],
        ['publish', proposalModule.schroederSpatialMechanicalProposalApplyWgsl]
      ]) {
        const module = device.createShaderModule({
          label: `ulg-native-contact-${name}-compile-proof`,
          code
        });
        if (typeof module.getCompilationInfo !== 'function') continue;
        const info = await module.getCompilationInfo();
        for (const message of info.messages || []) {
          shaderDiagnostics.push({
            name,
            type: message.type,
            lineNum: message.lineNum,
            linePos: message.linePos,
            message: message.message
          });
        }
      }
      requireTrue(
        shaderDiagnostics.every(({ type }) => type !== 'error'),
        `mechanical retained-graph WGSL did not compile: ${JSON.stringify(shaderDiagnostics)}`
      );

      const closures = closuresModule.createReferenceMaterialClosures();
      const materialProperties = {
        h2o: closures.h2o.properties,
        fe: closures.fe.properties
      };
      const ironU = thermoState.specificInternalEnergyJPerKg(
        materialProperties.fe,
        300
      );
      const iceU = thermoState.specificInternalEnergyJPerKg(
        materialProperties.h2o,
        250
      );
      let epochOrdinal = 0;

      const runFixture = async ({
        name,
        particles,
        postPositions,
        postVelocities,
        corruptProposalHeader = false,
        corruptAggregateRecordFingerprint = false,
        expectZeroEdgeGraph = false,
        expectEmptyActiveGraph = false,
        expectedPhaseByMaterial = null,
        inspectGraphOutcome = false,
        captureGraphParity = false,
        captureAggregateRecords = false,
        captureActiveRankView = false,
        measureApplyDuration = false,
        captureMaterializeTimestamp = false,
        retainCompleteAuthenticatedCellCliques = false,
        useAggregateHierarchy = false,
        useLevelAssignmentSource = false,
        phaseLineageCapacity = 0,
        verify
      }) => {
        epochOrdinal += 1;
        const source = sphStateModule.createSphState({
          smoothingLengthM: 0.1,
          dimension: 3,
          step: epochOrdinal,
          particles: particles.map((particle) => ({
            id: particle.id,
            material: particle.material,
            x: particle.x,
            v: particle.v || [0, 0, 0],
            massKg: particle.massKg,
            specificInternalEnergyJPerKg: finite(
              particle.specificInternalEnergyJPerKg
            )
              ? Number(particle.specificInternalEnergyJPerKg)
              : finite(particle.temperatureK)
                ? thermoState.specificInternalEnergyJPerKg(
                    materialProperties[particle.material],
                    Number(particle.temperatureK)
                  )
                : particle.material === 'fe'
                  ? ironU
                  : iceU
          }))
        });
        for (let index = 0; index < source.particles.length; index += 1) {
          Object.assign(source.particles[index], {
            mpmVolume0: particles[index].restVolumeM3,
            initialBodyId: particles[index].bodyId,
            initialBodyDomainId: particles[index].bodyDomainId,
            phaseCompanionSlot: particles[index].phaseCompanionSlot === true,
            phaseVolumeReferenceMassKg:
              particles[index].phaseVolumeReferenceMassKg
          });
        }
        const packed = gpuBuffers.buildSphGpuParticleBuffers(source, {
          materialProperties
        });
        const mechanics = gpuBuffers.buildMlsMpmGpuParticleBuffers(source, {
          materialProperties
        });
        if (expectedPhaseByMaterial) {
          requireTrue(
            mechanics.metadata.every(({ material, phase }) => (
              expectedPhaseByMaterial[material] === phase
            )),
            `${name}: packed phases did not match the manufactured condensed state: ${
              JSON.stringify(mechanics.metadata.map(({ material, phase }) => ({
                material,
                phase
              })))
            }`
          );
        } else {
          requireTrue(
            mechanics.metadata.every(({ solid }) => solid === true),
            `${name}: fixture materials were not packed as condensed solids`
          );
        }
        const epoch = {
          storageGeneration: epochOrdinal,
          physicsTick: epochOrdinal,
          physicsSubstep: 0,
          positionEpoch: epochOrdinal,
          topologyEpoch: 0,
          chartEpoch: 0,
          levelEpoch: epochOrdinal,
          supportEpoch: epochOrdinal
        };
        Object.assign(packed, epoch);
        Object.assign(mechanics, epoch);
        const sphUpload = gpuBuffers.uploadSphGpuParticleBuffers(device, packed);
        const mlsUpload = gpuBuffers.uploadMlsMpmGpuParticleBuffers(device, mechanics);
        Object.assign(sphUpload, epoch, {
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1
        });
        Object.assign(mlsUpload, epoch, {
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1
        });
        if (phaseLineageCapacity > 0) {
          const phaseCarrierPlan = {
            schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
            status: 'phase-lane-capacity-ready',
            lineageCapacity: phaseLineageCapacity,
            primaryCapacity: phaseLineageCapacity,
            phaseLaneCount: 4,
            phaseLaneStride: phaseLineageCapacity,
            companionStart: phaseLineageCapacity,
            companionCapacity: phaseLineageCapacity * 3,
            particleCapacity: packed.particleCount
          };
          Object.assign(packed, mechanics, sphUpload, mlsUpload, {
            phaseCarrierPlan
          });
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
          `ulg-native-contact-${name}-active-nodes`,
          activeRows,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const activeNodeList = {
          schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
          status: 'schroeder-active-node-list-submitted',
          particleCount: packed.particleCount,
          activeCandidateCount: packed.particleCount,
          activeNodeStrideFloats: 16,
          activeNodeBuffer,
          sourceStateBuffer: sphUpload.stateBuffer,
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
        let levelAssignmentBuffer = null;
        let levelAssignment = null;
        if (useLevelAssignmentSource) {
          const assignmentRows = new Float32Array(packed.particleCount * 16);
          for (let index = 0; index < packed.particleCount; index += 1) {
            const stateOffset = index * 8;
            const thermoOffset = index * 12;
            const mechanicsOffset = index * 32;
            const massKg = packed.state[stateOffset + 3];
            const restVolumeM3 = mechanics.mechanics[mechanicsOffset + 19];
            const currentVolumeM3 = restVolumeM3
              * mechanics.mechanics[mechanicsOffset + 18];
            const active = massKg > 0;
            assignmentRows.set([
              0,
              gridSpacingM,
              active ? 2 * gridSpacingM : 0,
              active ? Math.max(restVolumeM3, currentVolumeM3) : 0,
              active ? restVolumeM3 : 0,
              active ? currentVolumeM3 : 0,
              massKg,
              packed.thermo[thermoOffset + 3],
              packed.thermo[thermoOffset + 1],
              packed.thermo[thermoOffset],
              1,
              0,
              packed.state[stateOffset],
              packed.state[stateOffset + 1],
              packed.state[stateOffset + 2],
              0
            ], index * 16);
          }
          levelAssignmentBuffer = createTaggedBuffer(
            `ulg-native-contact-${name}-level-assignment`,
            assignmentRows,
            GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          );
          levelAssignment = {
            schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
            status: 'schroeder-level-assignment-submitted',
            bufferFamilyGenerationStatus:
              'schroeder-particle-buffer-family-generation-ready',
            particleCount: packed.particleCount,
            assignmentStrideFloats: 16,
            assignmentBuffer: levelAssignmentBuffer,
            assignmentBufferByteLength: assignmentRows.byteLength,
            sourceStateBuffer: sphUpload.stateBuffer,
            sourceStateBufferBorrowed: true,
            minLevel: 0,
            maxLevel: 0,
            chartId: 0,
            baseGridSpacingM: gridSpacingM,
            ...epoch
          };
        }

        const postState = new Float32Array(packed.state);
        for (let index = 0; index < packed.particleCount; index += 1) {
          postState.set(postPositions[index], index * 8);
          postState.set(postVelocities[index], index * 8 + 4);
        }
        const postStateBeforeApply = new Float32Array(postState);
        const postStateBuffer = createTaggedBuffer(
          `ulg-native-contact-${name}-manufactured-post-g2p-state`,
          postState,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );

        let generation = null;
        let proposal = null;
        let materializeTimestampRecorder = null;
        let materializeTimestampEvidence = null;
        try {
          const nativeTestLegacyLevelAssignmentDirectoryV1Arm =
            captureActiveRankView
              ? spatial
                  .armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest({
                    device,
                    levelAssignment
                  })
              : null;
          if (useAggregateHierarchy) device.pushErrorScope('validation');
          generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
            device,
            ...(useLevelAssignmentSource
              ? { levelAssignment }
              : { activeNodeList }),
            particleCount: packed.particleCount,
            particleIdentityBuffer: sphUpload.identityBuffer,
            particleIdentityStrideWords: 1,
            particleBufferSet: useAggregateHierarchy ? sphUpload : null,
            laneId: `native-contact-${name}`,
            sourceFamily: `native-contact-${name}`,
            mechanicsLevels: [],
            nativeTestLegacyLevelAssignmentDirectoryV1Arm
          });
          if (useAggregateHierarchy) {
            await device.queue.onSubmittedWorkDone();
            const aggregateBuildValidationError = await device.popErrorScope();
            requireTrue(
              !aggregateBuildValidationError,
              `${name}: aggregate build validation failed: ${
                aggregateBuildValidationError?.message
                  || String(aggregateBuildValidationError)
              }`
            );
          }
          requireTrue(
            generation.ready === true && generation.selected === true,
            `${name}: spatial generation rejected: ${generation.status}: ${
              generation.reason || 'no reason'
            }`
          );
          if (useAggregateHierarchy) {
            requireTrue(
              generation.aggregateView?.status
                  === 'schroeder-spatial-aggregate-view-gpu-build-submitted'
                && generation.aggregateView.submitPerformed === true
                && generation.aggregateViewRuntime?.isExecutionSubmitted?.(
                  generation.aggregateView
                ) === true,
              `${name}: aggregate hierarchy execution was not really submitted`
            );
          } else {
            requireTrue(
              generation.aggregateView == null,
              `${name}: flat fixture unexpectedly built an aggregate hierarchy`
            );
          }
          let activeRankViewSummary = null;
          if (captureActiveRankView) {
            requireTrue(
              generation.activeRankView?.activeRankViewBuffer
                && generation.activeRankView?.layout,
              `${name}: active-rank fixture did not publish a retained view`
            );
            const activeRankWords = new Uint32Array(await readBuffer(
              generation.activeRankView.activeRankViewBuffer,
              generation.activeRankView.layout.byteLength,
              `ulg-native-contact-${name}-active-rank-view`
            ));
            const directoryWords = new Uint32Array(await readBuffer(
              generation.execution.directoryBuffer,
              generation.execution.layout.byteLength,
              `ulg-native-contact-${name}-active-rank-directory-header`
            ));
            const headerWords = generation.activeRankView.layout.headerWords;
            const sourceCount = activeRankWords[16];
            const activeRankCount = activeRankWords[26];
            const rankPrefixOffsetWords = activeRankWords[21];
            const activeRanksOffsetWords = activeRankWords[23];
            const activeSourceIndicesOffsetWords = activeRankWords[49];
            requireTrue(
              rankPrefixOffsetWords + sourceCount < activeRankWords.length
                && activeRanksOffsetWords + activeRankCount
                  <= activeRankWords.length
                && activeSourceIndicesOffsetWords + activeRankCount
                  <= activeRankWords.length,
              `${name}: active-rank view offsets escaped its payload: ${
                JSON.stringify(Array.from(activeRankWords.slice(0, headerWords)))
              }`
            );
            activeRankViewSummary = {
              header: Array.from(activeRankWords.slice(0, headerWords)),
              directoryHeader: Array.from(directoryWords.slice(0, 48)),
              directoryMembers: Array.from(directoryWords.slice(
                directoryWords[31],
                directoryWords[31] + sourceCount
              )),
              activeRankCount,
              dormantRankCount: activeRankWords[27],
              rankPrefix: Array.from(activeRankWords.slice(
                rankPrefixOffsetWords,
                rankPrefixOffsetWords + sourceCount + 1
              )),
              activeRanks: Array.from(activeRankWords.slice(
                activeRanksOffsetWords,
                activeRanksOffsetWords + activeRankCount
              )),
              activeSourceIndices: Array.from(activeRankWords.slice(
                activeSourceIndicesOffsetWords,
                activeSourceIndicesOffsetWords + activeRankCount
              ))
            };
          }
          proposal = proposalModule.runSchroederSpatialMechanicalProposalWebGpu({
            device,
            generation,
            sphParticleState: packed,
            mlsMpmParticleState: mechanics,
            sphParticleUpload: sphUpload,
            mlsMpmParticleUpload: mlsUpload,
            boxDimsM: [2, 2, 2],
            gridSpacingM,
            relaxation: 0,
            normalVelocityDamping: 0,
            selectedLevel: 0,
            retainCompleteAuthenticatedCellCliques,
            gpuTimestampRecorder: captureMaterializeTimestamp
              ? (materializeTimestampRecorder =
                createMechanicalMaterializeTimestampRecorder(name)).recorder
              : null
          });
          requireTrue(proposal.ready === true, `${name}: proposal was not ready`);
          if (activeRankViewSummary) {
            activeRankViewSummary.proposalActiveRankViewEnabled =
              proposal.activeRankViewEnabled === true;
            activeRankViewSummary.proposalProjectionMode =
              proposal.spatialProjectionMode;
            activeRankViewSummary.proposalAdmissionStatus =
              proposal.activeRankViewAdmissionStatus;
          }
          requireTrue(
            proposal.aggregateHierarchyEnabled === useAggregateHierarchy,
            `${name}: aggregate hierarchy admission was ${
              proposal.aggregateAdmissionStatus
            }`
          );
          requireTrue(
            proposal.sourcePositionAuthority
              === 'post-g2p-state-with-swept-pre-integration-ss-directory',
            `${name}: proposal authority was ${proposal.sourcePositionAuthority}`
          );

          const preEvidenceBytes = await readBuffer(
            proposal.evidence.buffer,
            proposal.evidence.wordCount * Uint32Array.BYTES_PER_ELEMENT,
            `ulg-native-contact-${name}-pre-apply-evidence`
          );
          const preEvidence = new Uint32Array(preEvidenceBytes);
          requireTrue(
            preEvidence[0]
                === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC
              && preEvidence[1]
                === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION
              && preEvidence[2] === 1
              && preEvidence.slice(14).every((value) => value === 0),
            `${name}: retained graph ran before deferred encodeApply: ${Array.from(preEvidence)}`
          );

          if (corruptProposalHeader) {
            device.queue.writeBuffer(
              proposal.proposalBuffer,
              Uint32Array.BYTES_PER_ELEMENT,
              Uint32Array.of(0)
            );
          }
          if (corruptAggregateRecordFingerprint) {
            requireTrue(
              generation.aggregateView != null,
              `${name}: aggregate fingerprint corruption requires an aggregate view`
            );
            device.queue.writeBuffer(
              generation.aggregateView.aggregateViewBuffer,
              (112 + 41) * Uint32Array.BYTES_PER_ELEMENT,
              Uint32Array.of(0)
            );
          }

          const applyStartedAtMs = measureApplyDuration
            ? performance.now()
            : null;
          const encoder = device.createCommandEncoder({
            label: `ulg-native-contact-${name}-deferred-apply`
          });
          device.pushErrorScope('validation');
          proposal.encodeApply(encoder, {
            stateBuffer: postStateBuffer,
            mechanicsBuffer: mlsUpload.mechanicsBuffer,
            selectedLevel: 0
          });
          device.queue.submit([encoder.finish()]);
          await device.queue.onSubmittedWorkDone();
          if (materializeTimestampRecorder) {
            materializeTimestampEvidence =
              await materializeTimestampRecorder.complete();
          }
          const applyDurationMs = measureApplyDuration
            ? performance.now() - applyStartedAtMs
            : null;
          const contactValidationError = await device.popErrorScope();
          requireTrue(
            !contactValidationError,
            `${name}: retained contact encode validation failed: ${
              contactValidationError?.message || String(contactValidationError)
            }`
          );

          const [
            finalStateBytes,
            epochStateBytes,
            proposalBytes,
            evidenceBytes,
            traversalEvidenceBytes,
            graphControlBytes,
            matchingCleanupControlBytes,
            sourceOffsetBytes,
            interfaceReceiptBytes
          ] =
            await Promise.all([
              readBuffer(
                postStateBuffer,
                postState.byteLength,
                `ulg-native-contact-${name}-final-state`
              ),
              readBuffer(
                sphUpload.stateBuffer,
                packed.state.byteLength,
                `ulg-native-contact-${name}-epoch-state`
              ),
              readBuffer(
                proposal.proposalBuffer,
                proposal.proposalBufferByteLength,
                `ulg-native-contact-${name}-proposal`
              ),
              readBuffer(
                proposal.evidence.buffer,
                proposal.evidence.wordCount * Uint32Array.BYTES_PER_ELEMENT,
                `ulg-native-contact-${name}-evidence`
              ),
              Promise.all(proposal.evidence.traversalBuffers.map(
                (buffer, traversal) => readBuffer(
                  buffer,
                  proposal.evidence.wordCount * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-contact-${name}-evidence-${traversal}`
                )
              )),
              readBuffer(
                proposal.graphControlBuffer,
                proposal.contactGraph.layout.bufferLayouts.control.byteLength,
                `ulg-native-contact-${name}-graph-control`
              ),
              readBuffer(
                proposal.matchingCleanupControlBuffer,
                proposal.contactGraph.layout.bufferLayouts
                  .matchingCleanupControl.byteLength,
                `ulg-native-contact-${name}-matching-cleanup-control`
              ),
              readBuffer(
                proposal.sourceOffsetBuffer,
                proposal.contactGraph.layout.bufferLayouts.sourceOffsets.byteLength,
                `ulg-native-contact-${name}-source-offsets`
              ),
              readBuffer(
                proposal.contactInterfaceReceipt.buffer,
                proposal.contactGraph.layout.bufferLayouts.interfaceReceipt.byteLength,
                `ulg-native-contact-${name}-interface-receipt`
              )
            ]);
          const finalState = new Float32Array(finalStateBytes);
          const epochState = new Float32Array(epochStateBytes);
          const proposalWords = new Uint32Array(proposalBytes);
          const proposalFloats = new Float32Array(proposalBytes);
          const evidence = new Uint32Array(evidenceBytes);
          const traversalEvidence = traversalEvidenceBytes.map(
            (bytes) => new Uint32Array(bytes)
          );
          const graphControl = new Uint32Array(graphControlBytes);
          const graphControlFloats = new Float32Array(graphControlBytes);
          const matchingCleanupControl =
            new Uint32Array(matchingCleanupControlBytes);
          const matchingCleanupControlFloats =
            new Float32Array(matchingCleanupControlBytes);
          const evidenceFloats = new Float32Array(evidenceBytes);
          const sourceOffsets = new Uint32Array(sourceOffsetBytes);
          const interfaceReceiptWords =
            new Uint32Array(interfaceReceiptBytes);
          const interfaceReceiptFloats =
            new Float32Array(interfaceReceiptBytes);
          const interfaceReceiptHeaderWords =
            proposal.contactInterfaceReceipt.headerWords;
          const interfaceReceiptRowWords =
            proposal.contactInterfaceReceipt.rowWords;
          const interfaceReceiptRowBase =
            interfaceReceiptHeaderWords + packed.particleCount + 1;
          const interfaceReceiptPublishedRows = interfaceReceiptWords[13];
          const interfaceReceiptHeader = Array.from(
            interfaceReceiptWords.slice(0, interfaceReceiptHeaderWords)
          );
          const interfaceReceiptExpectedFailClosed = Boolean(
            corruptProposalHeader || corruptAggregateRecordFingerprint
          );
          const interfaceReceiptStatus = interfaceReceiptHeader[15];
          const interfaceReceiptSealedAsExpected =
            interfaceReceiptExpectedFailClosed
              ? (
                interfaceReceiptStatus
                  & pairGraphAbi
                    .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_FAIL_CLOSED
              ) !== 0
              : interfaceReceiptStatus
                === (
                  pairGraphAbi
                    .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_READY
                  | pairGraphAbi
                    .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_STATUS_ADMITTED
                );
          const matchingSelections = Array.from(
            { length: packed.particleCount },
            (_, particleIndex) => {
              const wordBase =
                proposalModule.SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS
                  + particleIndex * 8;
              return [
                particleIndex,
                proposalWords[wordBase],
                proposalWords[wordBase + 2],
                proposalWords[wordBase + 3],
                proposalFloats[wordBase + 1]
              ];
            }
          ).filter(([, peerIndex]) => peerIndex < packed.particleCount);
          requireTrue(
            interfaceReceiptHeader[0]
                === pairGraphAbi
                  .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_MAGIC
              && interfaceReceiptHeader[1]
                === pairGraphAbi
                  .SCHROEDER_SPATIAL_MECHANICAL_INTERFACE_RECEIPT_VERSION
              && interfaceReceiptSealedAsExpected,
            `${name}: contact-interface receipt did not seal before payload decode: ${
              JSON.stringify(interfaceReceiptHeader)
            }; control=${Array.from(graphControl)}; cleanupPass0=${[
              matchingCleanupControl[12],
              matchingCleanupControl[12 + 512],
              matchingCleanupControl[12 + 2 * 512],
              matchingCleanupControl[12 + 3 * 512],
              matchingCleanupControl[12 + 4 * 512],
              matchingCleanupControl[12 + 5 * 512],
              matchingCleanupControl[12 + 6 * 512]
            ]}; cleanupHeader=${Array.from(
              matchingCleanupControl.slice(0, 12)
            )}; selections=${JSON.stringify(matchingSelections)}`
          );
          const interfaceReceiptRows = [];
          for (
            let selfIndex = 0;
            !interfaceReceiptExpectedFailClosed
              && selfIndex < packed.particleCount;
            selfIndex += 1
          ) {
            const begin =
              interfaceReceiptWords[interfaceReceiptHeaderWords + selfIndex];
            const end =
              interfaceReceiptWords[
                interfaceReceiptHeaderWords + selfIndex + 1
              ];
            requireTrue(
              begin <= end && end <= interfaceReceiptPublishedRows,
              `${name}: interface receipt row bounds were invalid for ${
                selfIndex
              }: ${begin}/${end}/${interfaceReceiptPublishedRows}; control=${
                Array.from(graphControl)
              }; cleanupPass0=${[
                matchingCleanupControl[12],
                matchingCleanupControl[12 + 512],
                matchingCleanupControl[12 + 2 * 512],
                matchingCleanupControl[12 + 3 * 512],
                matchingCleanupControl[12 + 4 * 512],
                matchingCleanupControl[12 + 5 * 512],
                matchingCleanupControl[12 + 6 * 512]
              ]}; cleanupHeader=${Array.from(
                matchingCleanupControl.slice(0, 12)
              )}; selections=${JSON.stringify(
                matchingSelections
              )}; sourceOffsets=${
                Array.from(sourceOffsets.slice(0, 16))
              }`
            );
            for (let cursor = begin; cursor < end; cursor += 1) {
              const rowOffset =
                interfaceReceiptRowBase + cursor * interfaceReceiptRowWords;
              interfaceReceiptRows.push({
                selfIndex,
                otherIndex: interfaceReceiptWords[rowOffset],
                signedAreaM2: interfaceReceiptFloats[rowOffset + 1]
              });
            }
          }
          const interfaceReceipt = {
            header: interfaceReceiptHeader,
            rows: interfaceReceiptRows,
            positiveRowCount: interfaceReceiptRows.filter(
              ({ signedAreaM2 }) => signedAreaM2 > 0
            ).length,
            negativeRowCount: interfaceReceiptRows.filter(
              ({ signedAreaM2 }) => signedAreaM2 < 0
            ).length,
            zeroRowCount: interfaceReceiptRows.filter(
              ({ signedAreaM2 }) => Object.is(signedAreaM2, 0)
            ).length,
            uniquePositiveRows: interfaceReceiptRows.filter(({
              selfIndex,
              otherIndex,
              signedAreaM2
            }) => signedAreaM2 > 0 && selfIndex < otherIndex)
          };
          interfaceReceipt.uniquePositivePairCount =
            interfaceReceipt.uniquePositiveRows.length;
          interfaceReceipt.uniquePositiveFaceAreaM2 =
            interfaceReceipt.uniquePositiveRows.reduce(
              (sum, { signedAreaM2 }) => sum + signedAreaM2,
              0
            );
          requireTrue(
            interfaceReceiptExpectedFailClosed
              || (
                interfaceReceipt.header[13] === interfaceReceiptRows.length
                && interfaceReceipt.header[14] === interfaceReceiptRows.length
              ),
            `${name}: admitted contact-interface receipt row counts drifted: ${
              JSON.stringify(interfaceReceipt)
            }; control=${Array.from(graphControl)}`
          );
          let sweptSeparatedPositiveRowCount = 0;
          let expectedUniquePositiveFaceAreaM2 = 0;
          for (const row of interfaceReceiptRows) {
            if (!(row.signedAreaM2 > 0)) continue;
            const geometry = pairGeometry(
              finalState,
              mechanics.mechanics,
              row.selfIndex,
              row.otherIndex
            );
            const epochGeometry = pairGeometry(
              packed.state,
              mechanics.mechanics,
              row.selfIndex,
              row.otherIndex
            );
            const expectedFace =
              proposalModule
                .evaluateSchroederSpatialMechanicalInterfaceFaceContact({
                  position: geometry.leftPosition,
                  otherPosition: geometry.rightPosition,
                  epochPosition: epochGeometry.leftPosition,
                  otherEpochPosition: epochGeometry.rightPosition,
                  restVolumeM3:
                    mechanics.mechanics[row.selfIndex * 32 + 19],
                  otherRestVolumeM3:
                    mechanics.mechanics[row.otherIndex * 32 + 19]
                });
            requireTrue(
              expectedFace.contact
                && Math.abs(row.signedAreaM2 - expectedFace.areaM2)
                  <= Math.max(1e-9, expectedFace.areaM2 * 1e-5),
              `${name}: active receipt area was not the exact candidate-scoped ${
                'finite-volume face overlap'
              }: ${JSON.stringify({
                row,
                expectedFace,
                epochGeometry,
                geometry
              })}`
            );
            if (expectedFace.sweptContact) sweptSeparatedPositiveRowCount += 1;
            if (row.selfIndex < row.otherIndex) {
              expectedUniquePositiveFaceAreaM2 += expectedFace.areaM2;
            }
          }
          interfaceReceipt.sweptSeparatedPositiveRowCount =
            sweptSeparatedPositiveRowCount;
          interfaceReceipt.expectedUniquePositiveFaceAreaM2 =
            expectedUniquePositiveFaceAreaM2;
          const matchingSelectionCountWord = 12;
          const matchingCopyCountWord =
            matchingSelectionCountWord + matchingCleanupPasses;
          const matchingApplyCountWord =
            matchingCopyCountWord + matchingCleanupPasses;
          const matchingWallCountWord =
            matchingApplyCountWord + matchingCleanupPasses;
          const matchingAppliedPairCountWord =
            matchingWallCountWord + matchingCleanupPasses;
          const matchingMaxPositionRatioWord =
            matchingAppliedPairCountWord + matchingCleanupPasses;
          const matchingMaxVelocityResidualWord =
            matchingMaxPositionRatioWord + matchingCleanupPasses;
          const candidateVisitCount = evidence[evidenceWord.candidateVisitCount];
          const projectedPeerVisitCount =
            evidence[evidenceWord.projectedPeerVisitCount];
          const aggregateDiagnostic = {
            summaryPhaseMismatchCount:
              evidence[evidenceWord.aggregateSummaryPhaseMismatchCount],
            summaryPreflightCount:
              evidence[evidenceWord.aggregateSummaryPreflightCount],
            nodeVisitCount:
              evidence[evidenceWord.aggregateHierarchyNodeVisitCount],
            prunedNodeCount:
              evidence[evidenceWord.aggregateHierarchyPrunedNodeCount],
            sourceCount:
              evidence[evidenceWord.aggregateHierarchySourceCount],
            lineageMaterialMismatchCount:
              evidence[
                evidenceWord.aggregateSummaryLineageMaterialMismatchCount
              ]
          };
          const publishedDirectedPairCount =
            evidence[evidenceWord.publishedDirectedPairCount];
          const stageMask = graphControl[controlWord.completedStageMask];
          const failureMask = graphControl[controlWord.stickyFailureBits];
          const stateMutationCount = finalState.reduce(
            (count, value, index) => count + Number(
              !Object.is(value, postStateBeforeApply[index])
            ),
            0
          );
          const sourceDegrees = Array.from(
            { length: packed.particleCount },
            (_, index) => sourceOffsets[index + 1] - sourceOffsets[index]
          );
          let graphParity = null;
          if (captureGraphParity) {
            const directedPeers = publishedDirectedPairCount > 0
              ? new Uint32Array(await readBuffer(
                  proposal.directedPeerBuffer,
                  publishedDirectedPairCount * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-contact-${name}-directed-peers`
                ))
              : new Uint32Array(0);
            requireTrue(
              Array.from(directedPeers).every(
                (peerIndex) => peerIndex < packed.particleCount
              ),
              `${name}: solver-private CSR activity bits escaped graph publication`
            );
            graphParity = {
              sourceOffsets: Array.from(sourceOffsets.slice(
                0,
                packed.particleCount + 1
              )),
              directedPeerSets: Array.from(
                { length: packed.particleCount },
                (_, index) => Array.from(directedPeers.slice(
                  sourceOffsets[index],
                  sourceOffsets[index + 1]
                )).sort((left, right) => left - right)
              ),
              finalState: Array.from(finalState)
            };
          }
          let aggregateRecordSummary = null;
          if (captureAggregateRecords && generation.aggregateView) {
            const aggregateWords = new Uint32Array(await readBuffer(
              generation.aggregateView.aggregateViewBuffer,
              generation.aggregateView.requiredCapacityBytes,
              `ulg-native-contact-${name}-aggregate-view`
            ));
            const totalRecordCount = aggregateWords[54];
            const leafCount = aggregateWords[23];
            const rootRecordIndex = aggregateWords[53];
            const records = Array.from(
              { length: totalRecordCount },
              (_, recordIndex) => {
                const base = 112 + recordIndex * 44;
                return {
                  recordIndex,
                  particleCount: aggregateWords[base + 19],
                  sourceMemberCount: aggregateWords[base + 43],
                  status: aggregateWords[base + 27],
                  aabbWords: Array.from(aggregateWords.slice(
                    base + 12,
                    base + 18
                  ))
                };
              }
            );
            aggregateRecordSummary = {
              headerStatus: aggregateWords[2],
              sourceCount: aggregateWords[16],
              attemptedSourceCount: aggregateWords[36],
              reducedSourceCount: aggregateWords[37],
              leafCount,
              totalRecordCount,
              rootRecordIndex,
              activeMemberProjectionHeader: Array.from(
                aggregateWords.slice(91, 112)
              ),
              root: records[rootRecordIndex],
              emptyLeafCount: records.slice(0, leafCount).filter(
                ({ particleCount }) => particleCount === 0
              ).length,
              records
            };
          }
          const graphDiagnostic = {
            evidenceStatus: evidence[evidenceWord.statusFlags],
            graphAdmitted: evidence[evidenceWord.statusFlags]
              === (graphStatus.READY | graphStatus.ADMITTED),
            graphFailClosed: (
              evidence[evidenceWord.statusFlags] & graphStatus.FAIL_CLOSED
            ) !== 0,
            graphFailureMask: failureMask,
            graphFailureNames: Object.entries(
              proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
            ).filter(([, bit]) => (failureMask & bit) !== 0).map(([key]) => key),
            completedStageMask: stageMask,
            completedStageNames: Object.entries(
              proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
            ).filter(([, bit]) => (stageMask & bit) !== 0).map(([key]) => key),
            candidateVisitCount,
            projectedPeerVisitCount,
            aggregateDiagnostic,
            pairCounts: {
              appendAttemptCount: evidence[evidenceWord.appendAttemptCount],
              stagedDirectedPairCount:
                evidence[evidenceWord.stagedDirectedPairCount],
              requiredDirectedPairCount:
                evidence[evidenceWord.requiredDirectedPairCount],
              publishedDirectedPairCount,
              directedPairCapacity: evidence[evidenceWord.directedPairCapacity]
            },
            rowCounts: {
              validation: graphControl[controlWord.validationCount],
              verification: graphControl[controlWord.verificationCount],
              publication: graphControl[controlWord.publicationCount],
              measure: [
                ...graphControl.slice(
                  controlWord.measureCount0,
                  controlWord.measureCount3 + 1
                ),
                ...graphControl.slice(
                  controlWord.measureCount4,
                  controlWord.measureCount7 + 1
                ),
                ...graphControl.slice(
                  controlWord.measureCount8,
                  controlWord.measureCount15 + 1
                )
              ],
              solve: [
                ...graphControl.slice(
                  controlWord.solveCount0,
                  controlWord.solveCount3 + 1
                ),
                ...graphControl.slice(
                  controlWord.solveCount4,
                  controlWord.solveCount7 + 1
                ),
                ...graphControl.slice(
                  controlWord.solveCount8,
                  controlWord.solveCount15 + 1
                )
              ],
              energyMeasure: [
                ...graphControl.slice(
                  controlWord.energyMeasureCount0,
                  controlWord.energyMeasureCount3 + 1
                ),
                ...graphControl.slice(
                  controlWord.energyMeasureCount4,
                  controlWord.energyMeasureCount7 + 1
                ),
                ...graphControl.slice(
                  controlWord.energyMeasureCount8,
                  controlWord.energyMeasureCount15 + 1
                )
              ]
            },
            matchingCleanup: {
              passCount:
                graphControl[controlWord.matchingCleanupPassCount],
              trustRestoreCount:
                graphControl[controlWord.matchingCleanupTrustRestoreCount],
              selectionCounts: Array.from(
                matchingCleanupControl.slice(
                  matchingSelectionCountWord,
                  matchingCopyCountWord
                )
              ),
              copyCounts: Array.from(
                matchingCleanupControl.slice(
                  matchingCopyCountWord,
                  matchingApplyCountWord
                )
              ),
              applyCounts: Array.from(
                matchingCleanupControl.slice(
                  matchingApplyCountWord,
                  matchingWallCountWord
                )
              ),
              wallCounts: Array.from(
                matchingCleanupControl.slice(
                  matchingWallCountWord,
                  matchingAppliedPairCountWord
                )
              ),
              appliedPairCounts: Array.from(
                matchingCleanupControl.slice(
                  matchingAppliedPairCountWord,
                  matchingMaxPositionRatioWord
                )
              ),
              maxPositionRatios: Array.from(
                matchingCleanupControlFloats.slice(
                  matchingMaxPositionRatioWord,
                  matchingMaxVelocityResidualWord
                )
              ),
              maxVelocityResidualsMPerS: Array.from(
                matchingCleanupControlFloats.slice(
                  matchingMaxVelocityResidualWord,
                  matchingMaxVelocityResidualWord + matchingCleanupPasses
                )
              )
            },
            sourceDegree: {
              min: Math.min(...sourceDegrees),
              max: Math.max(...sourceDegrees),
              mean: sourceDegrees.reduce((sum, value) => sum + value, 0)
                / Math.max(sourceDegrees.length, 1),
              csrTerminator: sourceOffsets[packed.particleCount]
            },
            residual: {
              maxPositionM:
                graphControlFloats[controlWord.maxPositionResidualOrderedF32],
              maxVelocityMPerS:
                graphControlFloats[controlWord.maxVelocityResidualOrderedF32],
              evidenceMaxPositionM:
                evidenceFloats[evidenceWord.maxPositionResidualOrderedF32],
              evidenceMaxVelocityMPerS:
                evidenceFloats[evidenceWord.maxVelocityResidualOrderedF32]
            },
            energy: {
              pairKineticDeltaJ:
                evidenceFloats[evidenceWord.pairKineticDeltaJ],
              pairHeatJ: evidenceFloats[evidenceWord.pairHeatJ],
              wallHeatJ: evidenceFloats[evidenceWord.wallHeatJ],
              residualJ: evidenceFloats[evidenceWord.energyResidualJ],
              toleranceJ: evidenceFloats[evidenceWord.energyToleranceJ],
              gainCount: evidence[evidenceWord.energyGainCount],
              negativeInternalEnergyCount:
                evidence[evidenceWord.negativeInternalEnergyCount]
            },
            phaseCounts: mechanics.metadata.reduce((counts, { material, phase }) => {
              const key = `${material}:${phase}`;
              counts[key] = (counts[key] || 0) + 1;
              return counts;
            }, {}),
            stateMutationCount
          };

          if (inspectGraphOutcome) {
            requireTrue(
              graphDiagnostic.graphAdmitted || graphDiagnostic.graphFailClosed,
              `${name}: graph did not reach an admitted or sealed fail-closed state: ${
                JSON.stringify(graphDiagnostic)
              }`
            );
            if (graphDiagnostic.graphFailClosed) {
              requireTrue(
                failureMask !== 0 && stateMutationCount === 0,
                `${name}: fail-closed graph lacked a sticky failure or mutated state: ${
                  JSON.stringify(graphDiagnostic)
                }`
              );
              return {
                name,
                particleCount: packed.particleCount,
                ...(measureApplyDuration ? { applyDurationMs } : {}),
                ...(materializeTimestampEvidence
                  ? { materializeTimestampEvidence }
                  : {}),
                ...graphDiagnostic,
                ...(activeRankViewSummary ? { activeRankViewSummary } : {}),
                ...(aggregateRecordSummary ? { aggregateRecordSummary } : {})
              };
            }
          }

          if (corruptProposalHeader) {
            const failureMask =
              proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
                .HEADER_OR_EPOCH
              | proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE
                .PUBLICATION_INCOMPLETE;
            requireTrue(
              proposalWords[1] === 0,
              `${name}: manufactured proposal-header corruption was not retained`
            );
            requireTrue(
              evidence[2] === 5,
              `${name}: sealed rejection was not READY|FAIL_CLOSED: ${
                Array.from(evidence)
              }`
            );
            requireTrue(
              (graphControl[14] & failureMask) === failureMask,
              `${name}: sealed rejection omitted the publication failure mask: ${
                Array.from(graphControl)
              }`
            );
            requireTrue(
              finalState.every((value, index) => (
                Object.is(value, postStateBeforeApply[index])
              )),
              `${name}: fail-closed publication mutated the destination state`
            );
            return {
              name,
              particleCount: packed.particleCount,
              evidenceStatus: evidence[2],
              graphFailureMask: graphControl[14],
              ...(measureApplyDuration ? { applyDurationMs } : {}),
              ...(materializeTimestampEvidence
                ? { materializeTimestampEvidence }
                : {})
            };
          }

          requireTrue(
            proposalWords[0]
              === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC
              && proposalWords[1]
                === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION,
            `${name}: proposal header identity mismatch`
          );
          requireTrue(
            evidence[0]
                === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC
              && evidence[1]
                === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION
              && evidence[2] === 3
              && evidence[3] === generation.execution.generationId
              && evidence[11] === packed.particleCount
              && evidence[evidenceWord.appendAttemptCount]
                === evidence[evidenceWord.stagedDirectedPairCount]
              && evidence[evidenceWord.stagedDirectedPairCount]
                === evidence[evidenceWord.requiredDirectedPairCount]
              && evidence[evidenceWord.requiredDirectedPairCount]
                === evidence[evidenceWord.publishedDirectedPairCount]
              && evidence.slice(18, 23).every((value) => value === 0)
              && evidence[23] === 1
              && evidence[24] === 1
              && evidence[25] === (
                expectZeroEdgeGraph || expectEmptyActiveGraph ? 0 : 1
              )
              && evidence[26] === 1
              && evidence[27] === 1
              && evidence[evidenceWord.measurePassCount] === solverIterations
              && evidence[evidenceWord.solvePassCount] === solverIterations
              && evidence[evidenceWord.energyMeasurePassCount]
                === solverIterations
              && evidence[38] === 0
              && evidence[39] === 0
              && projectedPeerVisitCount <= candidateVisitCount,
            `${name}: retained graph evidence rejected: ${Array.from(evidence)}; control=${
              Array.from(graphControl)
            }; uncaptured=${JSON.stringify(uncapturedErrors)}`
          );
          const expectedStageMask = Object.values(
            proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE
          ).reduce((mask, bit) => mask | bit, 0);
          requireTrue(
            graphControl[0]
                === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC
              && graphControl[1]
                === proposalModule.SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION
              && graphControl[11] === graphControl[12]
              && graphControl[12] === graphControl[13]
              && graphControl[14] === 0
              && graphControl[15] === expectedStageMask
              && graphControl[16] === packed.particleCount
              && graphControl[17] === packed.particleCount
              && graphControl[18] === packed.particleCount
              && [
                ...graphControl.slice(
                  controlWord.measureCount0,
                  controlWord.measureCount3 + 1
                ),
                ...graphControl.slice(
                  controlWord.measureCount4,
                  controlWord.measureCount7 + 1
                ),
                ...graphControl.slice(
                  controlWord.measureCount8,
                  controlWord.measureCount15 + 1
                ),
                ...graphControl.slice(
                  controlWord.solveCount0,
                  controlWord.solveCount3 + 1
                ),
                ...graphControl.slice(
                  controlWord.solveCount4,
                  controlWord.solveCount7 + 1
                ),
                ...graphControl.slice(
                  controlWord.solveCount8,
                  controlWord.solveCount15 + 1
                ),
                ...graphControl.slice(
                  controlWord.energyMeasureCount0,
                  controlWord.energyMeasureCount3 + 1
                ),
                ...graphControl.slice(
                  controlWord.energyMeasureCount4,
                  controlWord.energyMeasureCount7 + 1
                ),
                ...graphControl.slice(
                  controlWord.energyMeasureCount8,
                  controlWord.energyMeasureCount15 + 1
                )
              ].every((value) => value === packed.particleCount)
              && finite(graphControlFloats[36])
              && finite(graphControlFloats[37])
              && finite(graphControlFloats[38])
              && finite(graphControlFloats[39]),
            `${name}: retained graph control rejected: ${Array.from(graphControl)}`
          );
          const matchingCleanupRowCounts = [
            ...matchingCleanupControl.slice(
              matchingSelectionCountWord,
              matchingCopyCountWord
            ),
            ...matchingCleanupControl.slice(
              matchingCopyCountWord,
              matchingApplyCountWord
            ),
            ...matchingCleanupControl.slice(
              matchingApplyCountWord,
              matchingWallCountWord
            ),
            ...matchingCleanupControl.slice(
              matchingWallCountWord,
              matchingAppliedPairCountWord
            )
          ];
          const matchingCleanupAppliedPairCounts =
            matchingCleanupControl.slice(
              matchingAppliedPairCountWord,
              matchingMaxPositionRatioWord
            );
          const matchingCleanupAppliedConstraintBound =
            Math.floor(2 * packed.particleCount / 3);
          const matchingCleanupPackingCertificates = Array.from(
            matchingCleanupAppliedPairCounts,
            (appliedConstraintCount) => {
              for (
                let threeBlockCount = Math.floor(appliedConstraintCount / 2);
                threeBlockCount >= 0;
                threeBlockCount -= 1
              ) {
                const ordinaryPairCount =
                  appliedConstraintCount - 2 * threeBlockCount;
                const ownedParticleCount =
                  3 * threeBlockCount + 2 * ordinaryPairCount;
                if (ownedParticleCount <= packed.particleCount) {
                  return {
                    appliedConstraintCount,
                    threeBlockCount,
                    ordinaryPairCount,
                    ownedParticleCount
                  };
                }
              }
              return null;
            }
          );
          const matchingCleanupMetricFloats = [
            ...matchingCleanupControlFloats.slice(
              matchingMaxPositionRatioWord,
              matchingMaxVelocityResidualWord
            ),
            ...matchingCleanupControlFloats.slice(
              matchingMaxVelocityResidualWord,
              matchingMaxVelocityResidualWord + matchingCleanupPasses
            )
          ];
          requireTrue(
            matchingCleanupControl[0] === 0x4d43_4c31
              && matchingCleanupControl[1] === 1
              && matchingCleanupControl[2]
                === generation.execution.generationId
              && matchingCleanupControl[3]
                === generation.execution.storageGeneration
              && matchingCleanupControl[4]
                === generation.execution.physicsTick
              && matchingCleanupControl[5]
                === generation.execution.physicsSubstep
              && matchingCleanupControl[6]
                === generation.execution.positionEpoch
              && matchingCleanupControl[7]
                === generation.execution.topologyEpoch
              && matchingCleanupControl[8]
                === generation.execution.supportEpoch
              && matchingCleanupControl[9] === packed.particleCount
              && matchingCleanupControl[10] === solverIterations
              && matchingCleanupControl[11] === matchingCleanupPasses
              && matchingCleanupRowCounts.every(
                (value) => value === packed.particleCount
              )
              && Array.from(matchingCleanupAppliedPairCounts).every(
                (value) => value <= matchingCleanupAppliedConstraintBound
              )
              && matchingCleanupPackingCertificates.every(Boolean)
              && matchingCleanupMetricFloats.every(finite)
              && graphControl[controlWord.matchingCleanupPassCount]
                === matchingCleanupPasses
              && graphControl[controlWord.matchingCleanupTrustRestoreCount]
                === packed.particleCount,
            `${name}: matching cleanup certificate rejected: control=${
              Array.from(matchingCleanupControl)
            }; graph=${Array.from(graphControl)}`
          );
          if (expectZeroEdgeGraph || expectEmptyActiveGraph) {
            requireTrue(
              Array.from(matchingCleanupAppliedPairCounts).every(
                (value) => value === 0
              )
                && matchingCleanupMetricFloats.every((value) => value === 0),
              `${name}: zero-edge cleanup certificate retained pair activity`
            );
          }
          if (expectEmptyActiveGraph) {
            requireTrue(
              candidateVisitCount === 0
                && projectedPeerVisitCount === 0
                && publishedDirectedPairCount === 0
                && graphControl[11] === 0
                && graphControl[12] === 0
                && graphControl[13] === 0
                && sourceOffsets.every((value) => value === 0),
              `${name}: admitted empty active-rank graph retained traversal or CSR work: evidence=${
                Array.from(evidence)
              }; control=${Array.from(graphControl)}`
            );
          } else if (expectZeroEdgeGraph) {
            requireTrue(
              candidateVisitCount > 0
                && projectedPeerVisitCount > 0
                && publishedDirectedPairCount === 0
                && graphControl[11] === 0
                && graphControl[12] === 0
                && graphControl[13] === 0,
              `${name}: symmetric shell filter retained a directed edge: evidence=${
                Array.from(evidence)
              }; control=${Array.from(graphControl)}`
            );
          } else {
            requireTrue(
              candidateVisitCount > 0
                && projectedPeerVisitCount > 0
                && publishedDirectedPairCount > 0,
              `${name}: manufactured contact produced no exact-near pair evidence`
            );
          }
          requireTrue(
            epochState.every((value, index) => Object.is(value, packed.state[index])),
            `${name}: deferred apply mutated the immutable epoch source state`
          );
          requireTrue(
            finalState.every(finite),
            `${name}: deferred apply produced a non-finite state`
          );
          for (let index = 0; index < packed.particleCount; index += 1) {
            requireTrue(
              Object.is(
                finalState[index * 8 + 3],
                postStateBeforeApply[index * 8 + 3]
              ),
              `${name}: apply changed mass for particle ${index}`
            );
          }
          const kineticBeforeJ = totalKineticEnergyJ(postStateBeforeApply);
          const kineticAfterJ = totalKineticEnergyJ(finalState);
          const internalBeforeJ = totalInternalEnergyJ(postStateBeforeApply);
          const internalAfterJ = totalInternalEnergyJ(finalState);
          const totalEnergyResidualJ = kineticAfterJ + internalAfterJ
            - kineticBeforeJ - internalBeforeJ;
          const energyToleranceJ = Math.max(
            graphControlFloats[39],
            new Float32Array(evidenceBytes)[37],
            1e-4
          );
          requireTrue(
            Math.abs(totalEnergyResidualJ) <= energyToleranceJ * 1.01,
            `${name}: contact failed kinetic/internal energy closure: ${JSON.stringify({
              kineticBeforeJ,
              kineticAfterJ,
              internalBeforeJ,
              internalAfterJ,
              totalEnergyResidualJ,
              energyToleranceJ,
              control: Array.from(graphControl)
            })}`
          );

          const result = verify({
            packed,
            mechanics,
            postStateBeforeApply,
            finalState,
            pairGeometry,
            proposal,
            proposalFloats,
            evidence,
            traversalEvidence,
            graphControl,
            sourceOffsets,
            interfaceReceipt,
            kineticBeforeJ,
            kineticAfterJ,
            internalBeforeJ,
            internalAfterJ,
            totalEnergyResidualJ,
            energyToleranceJ
          });
          return {
            name,
            particleCount: packed.particleCount,
            aggregateHierarchyEnabled:
              proposal.aggregateHierarchyEnabled === true,
            aggregateAdmissionStatus:
              proposal.aggregateAdmissionStatus ?? null,
            candidateVisitCount,
            projectedPeerVisitCount,
            publishedDirectedPairCount,
            matchingCleanupCertificate: {
              appliedConstraintBound:
                matchingCleanupAppliedConstraintBound,
              ordinaryPairBound: Math.floor(packed.particleCount / 2),
              maximumAppliedConstraintCount:
                matchingCleanupAppliedPairCounts.reduce(
                  (maximum, value) => Math.max(maximum, value),
                  0
                ),
              mixedThreeBlockAndFallbackPackingCertified:
                matchingCleanupPackingCertificates.every(Boolean)
            },
            kineticDeltaJ: kineticAfterJ - kineticBeforeJ,
            internalEnergyDeltaJ: internalAfterJ - internalBeforeJ,
            totalEnergyResidualJ,
            energyToleranceJ,
            ...(measureApplyDuration ? { applyDurationMs } : {}),
            ...(materializeTimestampEvidence
              ? {
                materializeTimestampEvidence,
                encodedDispatchCount: proposal.encodedDispatchCount,
                encodedComputePassCount: proposal.encodedComputePassCount,
                spatialProjectionMode: proposal.spatialProjectionMode,
                activeRankViewEnabled: proposal.activeRankViewEnabled === true,
                proposalPoolCacheHit: proposal.proposalPoolCacheHit === true
              }
              : {}),
            ...(inspectGraphOutcome ? graphDiagnostic : {}),
            ...(activeRankViewSummary ? { activeRankViewSummary } : {}),
            ...(graphParity ? { graphParity } : {}),
            ...(aggregateRecordSummary ? { aggregateRecordSummary } : {}),
            interfaceReceiptSummary: {
              header: interfaceReceipt.header,
              positiveRowCount: interfaceReceipt.positiveRowCount,
              negativeRowCount: interfaceReceipt.negativeRowCount,
              zeroRowCount: interfaceReceipt.zeroRowCount,
              uniquePositivePairCount:
                interfaceReceipt.uniquePositivePairCount,
              uniquePositiveFaceAreaM2:
                interfaceReceipt.uniquePositiveFaceAreaM2,
              expectedUniquePositiveFaceAreaM2:
                interfaceReceipt.expectedUniquePositiveFaceAreaM2,
              sweptSeparatedPositiveRowCount:
                interfaceReceipt.sweptSeparatedPositiveRowCount
            },
            ...result
          };
        } finally {
          materializeTimestampRecorder?.destroy();
          proposal?.releaseAfterSubmittedWork?.();
          if (generation) {
            spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
              generation,
              device
            );
          }
          await device.queue.onSubmittedWorkDone();
          if (proposal?.releasePromise) await proposal.releasePromise;
          if (generation?.releasePromise) await generation.releasePromise;
          postStateBuffer.destroy();
          gpuBuffers.destroySphGpuParticleBuffers(sphUpload);
          gpuBuffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
          activeNodeBuffer.destroy();
          levelAssignmentBuffer?.destroy();
        }
      };

      const cases = [];
      cases.push(await runFixture({
        name: 'unequal-mass-swept-cohort-crossing',
        particles: [
          {
            id: 'heavy-small-iron',
            material: 'fe',
            x: [1, 1.02, 1],
            massKg: 4,
            restVolumeM3: 0.04 ** 3,
            bodyId: 'iron-body',
            bodyDomainId: 1
          },
          {
            id: 'light-large-ice',
            material: 'h2o',
            x: [1, 0.92, 1],
            massKg: 1,
            restVolumeM3: 0.16 ** 3,
            bodyId: 'ice-body',
            bodyDomainId: 2
          }
        ],
        // These post-G2P endpoints have crossed by a genuine f32-scale amount.
        // Their 1:4 swept displacement and velocity ratio also preserves the
        // unequal-mass center of mass and linear momentum before projection.
        postPositions: [
          [1, 0.99999994, 1],
          [1, 1.00000012, 1]
        ],
        postVelocities: [
          [0, -0.2, 0],
          [0, 0.8, 0]
        ],
        verify: ({ mechanics, postStateBeforeApply, finalState, pairGeometry }) => {
          const before = pairGeometry(postStateBeforeApply, mechanics.mechanics, 0, 1);
          const after = pairGeometry(finalState, mechanics.mechanics, 0, 1);
          requireTrue(
            before.delta[1] < 0,
            `unequal-mass crossing was not actually inverted: ${JSON.stringify(before)}`
          );
          requireTrue(
            after.delta[1] > 0,
            `swept barrier did not restore epoch cohort ordering: ${JSON.stringify(after)}`
          );
          requireTrue(
            after.distanceM >= after.restDistanceM - 5.0e-6,
            `swept pair remained penetrated: ${JSON.stringify(after)}`
          );
          const correction0 = vectorLength(subtract3(
            after.leftPosition,
            before.leftPosition
          ));
          const correction1 = vectorLength(subtract3(
            after.rightPosition,
            before.rightPosition
          ));
          requireTrue(
            correction0 <= 0.5 * after.leftDiameter + 5.0e-6
              && correction1 <= 0.5 * after.rightDiameter + 5.0e-6,
            `swept corrections exceeded the per-carrier trust bound: ${
              correction0}/${correction1}
            }`
          );
          const epochNormal = [0, 1, 0];
          const relativeVelocity = subtract3(
            after.leftVelocity,
            after.rightVelocity
          );
          requireTrue(
            dot3(relativeVelocity, epochNormal) >= -1.0e-5,
            `swept pair retained closing normal velocity: ${relativeVelocity}`
          );
          const initialMomentumY = 4 * before.leftVelocity[1]
            + before.rightVelocity[1];
          const finalMomentumY = 4 * after.leftVelocity[1]
            + after.rightVelocity[1];
          requireTrue(
            Math.abs(finalMomentumY - initialMomentumY) <= 1.0e-5,
            `unequal-mass normal momentum changed by ${
              finalMomentumY - initialMomentumY
            }`
          );
          return {
            restDistanceM: after.restDistanceM,
            finalDistanceM: after.distanceM,
            correctionM: [correction0, correction1],
            finalRelativeNormalVelocityMPerS: dot3(
              relativeVelocity,
              epochNormal
            ),
            momentumResidualKgMPerS: finalMomentumY - initialMomentumY
          };
        }
      }));

      cases.push(await runFixture({
        name: 'non-collinear-swept-face-normal',
        particles: [
          {
            id: 'oblique-swept-iron',
            material: 'fe',
            x: [1, 1.12, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'oblique-iron-body',
            bodyDomainId: 1
          },
          {
            id: 'oblique-swept-ice',
            material: 'h2o',
            x: [1, 0.88, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'oblique-ice-body',
            bodyDomainId: 2
          }
        ],
        postPositions: [
          [1.02, 0.98, 1],
          [0.98, 1.02, 1]
        ],
        postVelocities: [
          [0.1, -0.7, 0],
          [-0.1, 0.7, 0]
        ],
        verify: ({ mechanics, postStateBeforeApply, finalState, pairGeometry }) => {
          const before = pairGeometry(postStateBeforeApply, mechanics.mechanics, 0, 1);
          const after = pairGeometry(finalState, mechanics.mechanics, 0, 1);
          const faceNormal = [0, 1, 0];
          requireTrue(
            before.delta[1] < 0 && after.delta[1] > 0,
            `oblique swept cohort side was not restored: ${JSON.stringify({ before, after })}`
          );
          requireTrue(
            after.distanceM >= after.restDistanceM - 2.0e-5,
            `oblique swept pair remained penetrated: ${JSON.stringify(after)}`
          );
          const finalRelativeVelocity = subtract3(
            after.leftVelocity,
            after.rightVelocity
          );
          requireTrue(
            dot3(finalRelativeVelocity, faceNormal) >= -2.0e-5,
            `oblique swept pair retained closing face-normal velocity: ${finalRelativeVelocity}`
          );
          const initialRelativeVelocity = subtract3(
            before.leftVelocity,
            before.rightVelocity
          );
          requireTrue(
            Math.abs(
              finalRelativeVelocity[0] - initialRelativeVelocity[0]
            ) <= 2.0e-5
              && Math.abs(
                finalRelativeVelocity[2] - initialRelativeVelocity[2]
              ) <= 2.0e-5,
            `face-normal contact changed tangential relative velocity: ${
              initialRelativeVelocity
            } -> ${finalRelativeVelocity}`
          );
          const momentumResidual = subtract3(
            totalMomentum(finalState),
            totalMomentum(postStateBeforeApply)
          );
          const massPositionResidual = subtract3(
            totalMassPosition(finalState),
            totalMassPosition(postStateBeforeApply)
          );
          const kineticEnergyBeforeJ =
            totalKineticEnergyJ(postStateBeforeApply);
          const kineticEnergyAfterJ = totalKineticEnergyJ(finalState);
          requireTrue(
            vectorLength(momentumResidual) <= 2.0e-5,
            `oblique swept contact changed linear momentum: ${momentumResidual}`
          );
          requireTrue(
            vectorLength(massPositionResidual) <= 2.0e-5,
            `oblique swept contact changed center of mass: ${massPositionResidual}`
          );
          requireTrue(
            kineticEnergyAfterJ <= kineticEnergyBeforeJ + 2.0e-5,
            `face-normal contact gained kinetic energy: ${
              kineticEnergyBeforeJ
            } -> ${kineticEnergyAfterJ}`
          );
          return {
            restDistanceM: after.restDistanceM,
            finalDistanceM: after.distanceM,
            momentumResidual,
            massPositionResidual,
            tangentialRelativeVelocityMPerS: [
              finalRelativeVelocity[0],
              finalRelativeVelocity[2]
            ],
            kineticEnergyDeltaJ: kineticEnergyAfterJ - kineticEnergyBeforeJ
          };
        }
      }));

      const deepSweptFixture = ({
        name,
        velocityBoostMPerS = [0, 0, 0]
      }) => runFixture({
        name,
        particles: [
          {
            id: 'deep-swept-iron',
            material: 'fe',
            x: [1, 1.21, 1],
            massKg: 2,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'deep-swept-iron-body',
            bodyDomainId: 1
          },
          {
            id: 'deep-swept-ice',
            material: 'h2o',
            x: [1, 1, 1],
            massKg: 5,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'deep-swept-ice-body',
            bodyDomainId: 2
          }
        ],
        postPositions: [
          [1, 0.85, 1],
          [1, 1, 1]
        ],
        postVelocities: [
          [0, -1 + velocityBoostMPerS[1], 0],
          [0, 0.4 + velocityBoostMPerS[1], 0]
        ],
        verify: ({ mechanics, postStateBeforeApply, finalState, pairGeometry }) => {
          const before = pairGeometry(postStateBeforeApply, mechanics.mechanics, 0, 1);
          const after = pairGeometry(finalState, mechanics.mechanics, 0, 1);
          requireTrue(
            before.delta[1] < 0,
            `deep swept fixture did not invert its epoch cohort: ${JSON.stringify(before)}`
          );
          requireTrue(
            after.delta[1] > 0
              && after.distanceM >= after.restDistanceM - 2.0e-5,
            `deep swept barrier retained the wrong side or penetration: ${JSON.stringify(after)}`
          );
          const relativeVelocity = subtract3(
            after.leftVelocity,
            after.rightVelocity
          );
          requireTrue(
            relativeVelocity[1] >= -2.0e-5,
            `deep swept pair retained closing velocity: ${relativeVelocity}`
          );
          const momentumBefore = totalMomentum(postStateBeforeApply);
          const momentumAfter = totalMomentum(finalState);
          const momentumResidual = subtract3(momentumAfter, momentumBefore);
          requireTrue(
            vectorLength(momentumResidual) <= 2.0e-5,
            `deep swept velocity projection changed momentum: ${momentumResidual}`
          );
          const massPositionBefore = totalMassPosition(postStateBeforeApply);
          const massPositionAfter = totalMassPosition(finalState);
          const massPositionResidual = subtract3(
            massPositionAfter,
            massPositionBefore
          );
          requireTrue(
            vectorLength(massPositionResidual) <= 2.0e-5,
            `deep swept position projection changed center of mass: ${massPositionResidual}`
          );
          return {
            restDistanceM: after.restDistanceM,
            finalDistanceM: after.distanceM,
            momentumResidual,
            massPositionResidual,
            leftVelocityDeltaMPerS: subtract3(
              after.leftVelocity,
              before.leftVelocity
            ),
            rightVelocityDeltaMPerS: subtract3(
              after.rightVelocity,
              before.rightVelocity
            ),
            finalLeftVelocityMPerS: after.leftVelocity,
            finalRightVelocityMPerS: after.rightVelocity
          };
        }
      });
      const deepBase = await deepSweptFixture({
        name: 'deep-swept-cohort-crossing'
      });
      cases.push(deepBase);
      const velocityBoostMPerS = [0, 3, 0];
      const deepBoosted = await deepSweptFixture({
        name: 'deep-swept-cohort-crossing-boosted-frame',
        velocityBoostMPerS
      });
      cases.push(deepBoosted);
      for (let axis = 0; axis < 3; axis += 1) {
        requireTrue(
          Math.abs(
            deepBoosted.leftVelocityDeltaMPerS[axis]
              - deepBase.leftVelocityDeltaMPerS[axis]
          ) <= 2.0e-5
            && Math.abs(
              deepBoosted.rightVelocityDeltaMPerS[axis]
                - deepBase.rightVelocityDeltaMPerS[axis]
            ) <= 2.0e-5,
          `contact response changed under a common velocity boost on axis ${axis}`
        );
        requireTrue(
          Math.abs(
            deepBoosted.finalLeftVelocityMPerS[axis]
              - deepBase.finalLeftVelocityMPerS[axis]
              - velocityBoostMPerS[axis]
          ) <= 2.0e-5
            && Math.abs(
              deepBoosted.finalRightVelocityMPerS[axis]
                - deepBase.finalRightVelocityMPerS[axis]
                - velocityBoostMPerS[axis]
            ) <= 2.0e-5,
          `final contact state was not Galilean equivalent on axis ${axis}`
        );
      }

      cases.push(await runFixture({
        name: 'asymmetric-collinear-multi-contact-nonnegative-heat',
        particles: [
          {
            id: 'asymmetric-center-iron',
            material: 'fe',
            x: [1.1, 1, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'asymmetric-center-body',
            bodyDomainId: 1
          },
          {
            id: 'asymmetric-weak-ice',
            material: 'h2o',
            x: [1, 1, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'asymmetric-shared-ice-body',
            bodyDomainId: 2
          },
          {
            id: 'asymmetric-strong-ice',
            material: 'h2o',
            x: [1, 1, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'asymmetric-shared-ice-body',
            bodyDomainId: 2
          }
        ],
        postPositions: [
          [1.1, 1, 1],
          [1, 1, 1],
          [1, 1, 1]
        ],
        postVelocities: [
          [-1, 0, 0],
          [-0.8, 0, 0],
          [1, 0, 0]
        ],
        verify: ({ postStateBeforeApply, finalState }) => {
          const specificEnergyDeltasJPerKg = Array.from(
            { length: 3 },
            (_, index) => finalState[index * 8 + 7]
              - postStateBeforeApply[index * 8 + 7]
          );
          requireTrue(
            specificEnergyDeltasJPerKg.every((delta) => delta >= 0),
            `asymmetric Jacobi bookkeeping cooled an endpoint: ${
              specificEnergyDeltasJPerKg
            }`
          );
          const momentumResidual = subtract3(
            totalMomentum(finalState),
            totalMomentum(postStateBeforeApply)
          );
          requireTrue(
            vectorLength(momentumResidual) <= 2.0e-5,
            `asymmetric contact changed momentum: ${momentumResidual}`
          );
          return {
            specificEnergyDeltasJPerKg,
            momentumResidual,
            finalVelocitiesMPerS: Array.from(
              { length: 3 },
              (_, index) => stateRow(finalState, index).slice(4, 7)
            )
          };
        }
      }));

      cases.push(await runFixture({
        name: 'symmetric-cancellation-neutral-scale',
        particles: [
          {
            id: 'symmetric-heavy-iron',
            material: 'fe',
            x: [1, 1, 1],
            massKg: 1000,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'symmetric-iron-body',
            bodyDomainId: 1
          },
          {
            id: 'symmetric-left-ice',
            material: 'h2o',
            x: [0.875, 1, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'symmetric-ice-body',
            bodyDomainId: 2
          },
          {
            id: 'symmetric-right-ice',
            material: 'h2o',
            x: [1.125, 1, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'symmetric-ice-body',
            bodyDomainId: 2
          }
        ],
        // Both position and velocity corrections cancel exactly at the heavy
        // middle carrier. Its measured scale must remain the neutral 1.0 so
        // the two outer endpoints can still resolve their contacts.
        postPositions: [
          [1, 1, 1],
          [0.875, 1, 1],
          [1.125, 1, 1]
        ],
        postVelocities: [
          [0, 0, 0],
          [1, 0, 0],
          [-1, 0, 0]
        ],
        verify: ({ mechanics, postStateBeforeApply, finalState, pairGeometry }) => {
          const left = pairGeometry(finalState, mechanics.mechanics, 0, 1);
          const right = pairGeometry(finalState, mechanics.mechanics, 0, 2);
          for (const pair of [left, right]) {
            requireTrue(
              pair.distanceM >= pair.restDistanceM - 2.0e-4,
              `symmetric cancellation froze a penetrated pair: ${JSON.stringify(pair)}`
            );
            const normal = pair.delta.map((value) => value / pair.distanceM);
            requireTrue(
              dot3(
                subtract3(pair.leftVelocity, pair.rightVelocity),
                normal
              ) >= -2.0e-4,
              `symmetric cancellation froze closing velocity: ${JSON.stringify(pair)}`
            );
          }
          const centerBefore = stateRow(postStateBeforeApply, 0);
          const centerAfter = stateRow(finalState, 0);
          requireTrue(
            vectorLength(subtract3(
              centerAfter.slice(0, 3),
              centerBefore.slice(0, 3)
            )) <= 2.0e-5,
            `symmetric solve drifted the middle position: ${centerAfter}`
          );
          const momentumResidual = subtract3(
            totalMomentum(finalState),
            totalMomentum(postStateBeforeApply)
          );
          const massPositionResidual = subtract3(
            totalMassPosition(finalState),
            totalMassPosition(postStateBeforeApply)
          );
          requireTrue(
            vectorLength(momentumResidual) <= 2.0e-4,
            `symmetric solve changed momentum: ${momentumResidual}`
          );
          requireTrue(
            vectorLength(massPositionResidual) <= 2.0e-4,
            `symmetric solve changed center of mass: ${massPositionResidual}`
          );
          return {
            finalDistancesM: [left.distanceM, right.distanceM],
            restDistancesM: [left.restDistanceM, right.restDistanceM],
            momentumResidual,
            massPositionResidual
          };
        }
      }));

      cases.push(await runFixture({
        name: 'non-collinear-two-contact-residual',
        particles: [
          {
            id: 'corner-supported-iron',
            material: 'fe',
            x: [1.08, 1.08, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'corner-supported-iron-body',
            bodyDomainId: 1
          },
          {
            id: 'corner-ice-x',
            material: 'h2o',
            x: [0.88, 1, 1],
            massKg: 1000,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'corner-ice-bed',
            bodyDomainId: 2
          },
          {
            id: 'corner-ice-y',
            material: 'h2o',
            x: [1, 0.88, 1],
            massKg: 1000,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'corner-ice-bed',
            bodyDomainId: 2
          }
        ],
        postPositions: [
          [1, 1, 1],
          [0.88, 1, 1],
          [1, 0.88, 1]
        ],
        postVelocities: [
          [-1, -1, 0],
          [0, 0, 0],
          [0, 0, 0]
        ],
        verify: ({ mechanics, postStateBeforeApply, finalState, pairGeometry }) => {
          const pairs = [
            pairGeometry(finalState, mechanics.mechanics, 0, 1),
            pairGeometry(finalState, mechanics.mechanics, 0, 2)
          ];
          for (const pair of pairs) {
            requireTrue(
              pair.distanceM >= pair.restDistanceM - 2.0e-4,
              `non-collinear support retained overlap: ${JSON.stringify(pair)}`
            );
            const normal = pair.delta.map((value) => value / pair.distanceM);
            requireTrue(
              dot3(
                subtract3(pair.leftVelocity, pair.rightVelocity),
                normal
              ) >= -5.0e-4,
              `non-collinear support retained closing velocity: ${JSON.stringify(pair)}`
            );
          }
          const momentumResidual = subtract3(
            totalMomentum(finalState),
            totalMomentum(postStateBeforeApply)
          );
          const massPositionResidual = subtract3(
            totalMassPosition(finalState),
            totalMassPosition(postStateBeforeApply)
          );
          requireTrue(
            vectorLength(momentumResidual) <= 2.0e-4,
            `non-collinear solve changed momentum: ${momentumResidual}`
          );
          requireTrue(
            vectorLength(massPositionResidual) <= 2.0e-4,
            `non-collinear solve changed center of mass: ${massPositionResidual}`
          );
          return {
            finalDistancesM: pairs.map(({ distanceM }) => distanceM),
            restDistancesM: pairs.map(({ restDistanceM }) => restDistanceM),
            momentumResidual,
            massPositionResidual
          };
        }
      }));

      cases.push(await runFixture({
        name: 'marked-heavy-support-three-block-reservation',
        particles: [
          {
            id: 'reserved-light-center',
            material: 'fe',
            x: [1, 1, 1],
            massKg: 1,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'reserved-light-center-body',
            bodyDomainId: 1
          },
          {
            id: 'reserved-heavy-primary',
            material: 'h2o',
            x: [0.8, 1, 1],
            massKg: 32,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'reserved-heavy-support-body',
            bodyDomainId: 2
          },
          {
            id: 'reserved-heavy-secondary',
            material: 'h2o',
            x: [1.2, 1, 1],
            massKg: 48,
            restVolumeM3: 0.2 ** 3,
            bodyId: 'reserved-heavy-support-body',
            bodyDomainId: 2
          }
        ],
        postPositions: [
          [1, 1, 1],
          [0.8, 1, 1],
          [1.2, 1, 1]
        ],
        // The primary face approaches while the secondary is exactly satisfied.
        // Applying only the primary reactivates the secondary, so a two-edge
        // applied-count receipt proves the marked support reservation reached
        // the bounded three-particle projection.
        postVelocities: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 0, 0]
        ],
        verify: ({
          mechanics,
          postStateBeforeApply,
          finalState,
          pairGeometry
        }) => {
          const pairs = [
            pairGeometry(finalState, mechanics.mechanics, 0, 1),
            pairGeometry(finalState, mechanics.mechanics, 0, 2)
          ];
          const approachResidualsMPerS = pairs.map((pair) => {
            const normal = pair.delta.map(
              (value) => value / Math.max(pair.distanceM, 1e-30)
            );
            return dot3(
              subtract3(pair.leftVelocity, pair.rightVelocity),
              normal
            );
          });
          requireTrue(
            approachResidualsMPerS.every((value) => value >= -1.0e-5),
            `reserved three-block retained approach: ${
              approachResidualsMPerS
            }`
          );
          const momentumResidual = subtract3(
            totalMomentum(finalState),
            totalMomentum(postStateBeforeApply)
          );
          requireTrue(
            vectorLength(momentumResidual) <= 2.0e-5,
            `reserved three-block changed momentum: ${momentumResidual}`
          );
          return {
            approachResidualsMPerS,
            momentumResidual
          };
        }
      }));

      const bedParticle = (index) => ({
        id: `ice-bed-${index}`,
        material: 'h2o',
        x: [1, 1, 1],
        massKg: 100_000,
        restVolumeM3: 0.1 ** 3,
        bodyId: 'shared-ice-bed',
        bodyDomainId: 2
      });
      cases.push(await runFixture({
        name: 'supported-four-contact-bed-degree-bound',
        particles: [
          {
            id: 'supported-iron',
            material: 'fe',
            x: [1, 1.15, 1],
            massKg: 3,
            restVolumeM3: 0.1 ** 3,
            bodyId: 'supported-iron-body',
            bodyDomainId: 1
          },
          bedParticle(0),
          bedParticle(1),
          bedParticle(2),
          bedParticle(3)
        ],
        // Coincident same-body bed carriers manufacture four identical support
        // constraints without adding bed/bed response. The trust-region result
        // must not scale with contact degree.
        postPositions: [
          [1, 1.05, 1],
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1]
        ],
        postVelocities: [
          [0, -1, 0],
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0]
        ],
        verify: ({
          mechanics,
          postStateBeforeApply,
          finalState,
          pairGeometry,
          traversalEvidence,
          graphControl
        }) => {
          const before = pairGeometry(postStateBeforeApply, mechanics.mechanics, 0, 1);
          const after = pairGeometry(finalState, mechanics.mechanics, 0, 1);
          const topCorrection = vectorLength(subtract3(
            after.leftPosition,
            before.leftPosition
          ));
          const directedContactPairHits = traversalEvidence.reduce(
            (sum, row) => sum + row[17],
            0
          );
          requireTrue(
            directedContactPairHits >= 8,
            `multi-contact bed admitted only ${directedContactPairHits} directed pair hits`
          );
          requireTrue(
            after.distanceM >= after.restDistanceM - 5.0e-6,
            `supported carrier remained inside the bed: ${JSON.stringify(after)}`
          );
          requireTrue(
            topCorrection <= 0.5 * after.leftDiameter + 5.0e-6,
            `four-contact response scaled past trust bound: ${topCorrection}`
          );
          requireTrue(
            after.leftPosition[1] > before.leftPosition[1]
              && after.leftVelocity[1] >= -1.0e-5,
            `bed did not support/remove closing motion: ${JSON.stringify({
              after,
              graphControl: Array.from(graphControl),
              traversalEvidence
            })}`
          );
          for (let index = 1; index < 5; index += 1) {
            const beforeBed = stateRow(postStateBeforeApply, index);
            const afterBed = stateRow(finalState, index);
            requireTrue(
              vectorLength(subtract3(afterBed.slice(0, 3), beforeBed.slice(0, 3)))
                <= 1.0e-6,
              `static supported-bed carrier ${index} moved unexpectedly`
            );
          }
          return {
            restDistanceM: after.restDistanceM,
            finalDistanceM: after.distanceM,
            topCorrectionM: topCorrection,
            finalTopVelocityMPerS: after.leftVelocity,
            directedContactPairHits
          };
        }
      }));

      const failClosedCase = await runFixture({
        name: 'corrupt-proposal-header-fail-closed',
        particles: [
          {
            id: 'fail-closed-iron',
            material: 'fe',
            x: [1, 1.1, 1],
            massKg: 2,
            restVolumeM3: 0.1 ** 3,
            bodyId: 'fail-closed-iron-body',
            bodyDomainId: 1
          },
          {
            id: 'fail-closed-ice',
            material: 'h2o',
            x: [1, 1, 1],
            massKg: 2,
            restVolumeM3: 0.1 ** 3,
            bodyId: 'fail-closed-ice-body',
            bodyDomainId: 2
          }
        ],
        postPositions: [
          [1, 1.04, 1],
          [1, 1, 1]
        ],
        postVelocities: [
          [0, -0.5, 0],
          [0, 0, 0]
        ],
        corruptProposalHeader: true
      });

      const symmetricShellCase = await runFixture({
        name: 'unequal-support-shell-symmetric-filter',
        particles: [
          {
            id: 'shell-moving-small-iron',
            material: 'fe',
            x: [0.45, 1, 1],
            massKg: 1,
            restVolumeM3: 0.02 ** 3,
            bodyId: 'shell-iron-body',
            bodyDomainId: 1
          },
          {
            id: 'shell-static-smaller-ice',
            material: 'h2o',
            x: [1.25, 1, 1],
            massKg: 1,
            restVolumeM3: 0.01 ** 3,
            bodyId: 'shell-ice-body',
            bodyDomainId: 2
          }
        ],
        postPositions: [
          [0.5, 1, 1],
          [1.25, 1, 1]
        ],
        postVelocities: [
          [0.25, 0, 0],
          [0, 0, 0]
        ],
        expectZeroEdgeGraph: true,
        verify: ({ packed, postStateBeforeApply, finalState }) => {
          const spacingM = 0.1;
          const epochDistanceM = Math.abs(packed.state[0] - packed.state[8]);
          const globalDiameterM = 0.02;
          const globalDisplacementM = 0.05;
          const trustDiameters =
            proposalModule.SCHROEDER_SPATIAL_MECHANICAL_POSITION_TRUST_DIAMETERS;
          const movingOldRadiusM = 0.015 + 2 * (
            0.05 + globalDisplacementM
              + trustDiameters * globalDiameterM
          );
          const staticOldRadiusM = 0.015 + 2 * (
            globalDisplacementM + trustDiameters * globalDiameterM
          );
          const globalRadiusM = globalDiameterM + 2 * (
            2 * globalDisplacementM
              + trustDiameters * globalDiameterM
          );
          const symmetricPairRadiusM = 0.015 + 2 * (
            globalDisplacementM
              + trustDiameters * globalDiameterM
          );
          requireTrue(
            Math.floor(packed.state[0] / spacingM) === 4
              && Math.floor(packed.state[8] / spacingM) === 12
              && Math.ceil(movingOldRadiusM / spacingM) === 9
              && Math.ceil(staticOldRadiusM / spacingM) === 8,
            `shell fixture no longer manufactures asymmetric old cell radii: ${
              JSON.stringify({ movingOldRadiusM, staticOldRadiusM })
            }`
          );
          requireTrue(
            Math.ceil(globalRadiusM / spacingM) === 9
              && epochDistanceM > symmetricPairRadiusM,
            `shell fixture no longer exercises the symmetric excess shell: ${
              JSON.stringify({ epochDistanceM, globalRadiusM, symmetricPairRadiusM })
            }`
          );
          requireTrue(
            finalState.every((value, index) => (
              Object.is(value, postStateBeforeApply[index])
            )),
            'zero-edge symmetric shell changed the manufactured post-G2P state'
          );
          return {
            epochDistanceM,
            movingOldRadiusM,
            staticOldRadiusM,
            globalRadiusM,
            symmetricPairRadiusM
          };
        }
      });

      // The historical dense performance fixture below proves CSR contention,
      // but deliberately contains no overlap or relative motion. Manufacture
      // the default 5^3 ice / 3^3 iron resolution here at the instant a
      // 5 m/s molten-iron cohort reaches a staggered ice face. Each bottom iron
      // carrier begins at support distance from four top ice carriers and then
      // advances 4 cm in the post-G2P state, producing a shared, unequal-mass,
      // solid/liquid contact network without introducing a test-only solver.
      const integratedPitchM = 0.2;
      const integratedRestVolumeM3 = integratedPitchM ** 3;
      const iceDensityKgPerM3 = 917;
      const liquidIronDensityKgPerM3 = 6_980;
      const icePositions = [];
      for (let y = 0; y < 5; y += 1) {
        for (let z = 0; z < 5; z += 1) {
          for (let x = 0; x < 5; x += 1) {
            icePositions.push([
              0.6 + x * integratedPitchM,
              0.2 + y * integratedPitchM,
              0.6 + z * integratedPitchM
            ]);
          }
        }
      }
      const staggerM = 0.5 * integratedPitchM;
      const ironBottomEpochY = 1 + Math.sqrt(
        integratedPitchM ** 2 - 2 * staggerM ** 2
      );
      const ironPositions = [];
      for (let y = 0; y < 3; y += 1) {
        for (let z = 0; z < 3; z += 1) {
          for (let x = 0; x < 3; x += 1) {
            ironPositions.push([
              0.7 + x * integratedPitchM,
              ironBottomEpochY + y * integratedPitchM,
              0.7 + z * integratedPitchM
            ]);
          }
        }
      }
      const integratedIceParticles = icePositions.map((x, index) => ({
        id: `integrated-ice-${index}`,
        material: 'h2o',
        x,
        massKg: iceDensityKgPerM3 * integratedRestVolumeM3,
        restVolumeM3: integratedRestVolumeM3,
        temperatureK: 233.15,
        bodyId: 'integrated-ice-body',
        bodyDomainId: 2
      }));
      const integratedIronParticles = ironPositions.map((x, index) => ({
        id: `integrated-iron-${index}`,
        material: 'fe',
        x,
        massKg: liquidIronDensityKgPerM3 * integratedRestVolumeM3,
        restVolumeM3: integratedRestVolumeM3,
        temperatureK: 1_850,
        bodyId: 'integrated-iron-body',
        bodyDomainId: 1
      }));
      const integratedParticles = [
        ...integratedIceParticles,
        ...integratedIronParticles
      ];
      const integratedImpactDisplacementM = 0.04;
      const integratedPostPositions = [
        ...icePositions,
        ...ironPositions.map(([x, y, z]) => [
          x,
          y - integratedImpactDisplacementM,
          z
        ])
      ];
      const integratedPostVelocities = [
        ...icePositions.map(() => [0, 0, 0]),
        ...ironPositions.map(() => [0, -5, 0])
      ];
      const integratedInterfacePairs = [];
      const iceTopStart = 4 * 5 * 5;
      const ironStart = icePositions.length;
      for (let ironZ = 0; ironZ < 3; ironZ += 1) {
        for (let ironX = 0; ironX < 3; ironX += 1) {
          const ironIndex = ironStart + ironZ * 3 + ironX;
          for (let dz = 0; dz <= 1; dz += 1) {
            for (let dx = 0; dx <= 1; dx += 1) {
              integratedInterfacePairs.push([
                ironIndex,
                iceTopStart + (ironZ + dz) * 5 + ironX + dx
              ]);
            }
          }
        }
      }
      const denseIntegratedContactFixture = {
        name: 'dense-integrated-molten-iron-ice-impact',
        particles: integratedParticles,
        postPositions: integratedPostPositions,
        postVelocities: integratedPostVelocities,
        expectedPhaseByMaterial: {
          fe: 'liquid',
          h2o: 'solid'
        },
        inspectGraphOutcome: true,
        captureGraphParity: true,
        verify: ({
          mechanics,
          postStateBeforeApply,
          finalState,
          pairGeometry
        }) => {
          const interfaceGeometry = integratedInterfacePairs.map(
            ([ironIndex, iceIndex]) => pairGeometry(
              finalState,
              mechanics.mechanics,
              ironIndex,
              iceIndex
            )
          );
          const maxPositionResidualM = Math.max(...interfaceGeometry.map(
            ({ distanceM, restDistanceM }) => Math.max(
              restDistanceM - distanceM,
              0
            )
          ));
          const maxClosingVelocityMPerS = Math.max(...interfaceGeometry.map((pair) => {
            const normal = pair.delta.map(
              (value) => value / Math.max(pair.distanceM, 1e-30)
            );
            return Math.max(-dot3(
              subtract3(pair.leftVelocity, pair.rightVelocity),
              normal
            ), 0);
          }));
          requireTrue(
            maxPositionResidualM <= 0.02 * integratedPitchM + 2.0e-5,
            `integrated Fe/ice interface retained excess overlap: ${
              maxPositionResidualM
            }`
          );
          requireTrue(
            maxClosingVelocityMPerS <= 1.1e-3,
            `integrated Fe/ice interface retained closing speed: ${
              maxClosingVelocityMPerS
            }`
          );
          const momentumBefore = totalMomentum(postStateBeforeApply);
          const momentumAfter = totalMomentum(finalState);
          const momentumResidual = subtract3(momentumAfter, momentumBefore);
          const momentumScale = Math.max(vectorLength(momentumBefore), 1);
          requireTrue(
            vectorLength(momentumResidual) <= 1.0e-5 * momentumScale,
            `integrated Fe/ice graph changed linear momentum: ${
              momentumResidual
            }`
          );
          const massPositionBefore = totalMassPosition(postStateBeforeApply);
          const massPositionAfter = totalMassPosition(finalState);
          const massPositionResidual = subtract3(
            massPositionAfter,
            massPositionBefore
          );
          const massPositionScale = Math.max(
            vectorLength(massPositionBefore),
            1
          );
          requireTrue(
            vectorLength(massPositionResidual) <= 1.0e-5 * massPositionScale,
            `integrated Fe/ice graph changed center of mass: ${
              massPositionResidual
            }`
          );
          const averageIronVelocityY = (indices) => indices.reduce(
            (sum, index) => sum + finalState[index * 8 + 5],
            0
          ) / indices.length;
          const bottomIronIndices = Array.from(
            { length: 9 },
            (_, index) => ironStart + index
          );
          const upperIronIndices = Array.from(
            { length: 18 },
            (_, index) => ironStart + 9 + index
          );
          return {
            manufacturedInterfacePairCount: integratedInterfacePairs.length,
            impactDisplacementM: integratedImpactDisplacementM,
            impactVelocityMPerS: 5,
            maxManufacturedPositionResidualM: maxPositionResidualM,
            maxManufacturedClosingVelocityMPerS: maxClosingVelocityMPerS,
            momentumResidualKgMPerS: momentumResidual,
            massPositionResidualKgM: massPositionResidual,
            bottomIronAverageVelocityYMPerS:
              averageIronVelocityY(bottomIronIndices),
            upperIronAverageVelocityYMPerS:
              averageIronVelocityY(upperIronIndices)
          };
        }
      };
      const denseIntegratedContact = await runFixture(
        denseIntegratedContactFixture
      );
      const denseIntegratedAggregateContact = await runFixture({
        ...denseIntegratedContactFixture,
        name: 'dense-integrated-molten-iron-ice-impact-aggregate',
        useAggregateHierarchy: true
      });
      const flatGraphParity = denseIntegratedContact.graphParity;
      const aggregateGraphParity = denseIntegratedAggregateContact.graphParity;
      requireTrue(
        flatGraphParity != null && aggregateGraphParity != null,
        `dense aggregate parity payload was unavailable: ${JSON.stringify({
          flat: {
            graphAdmitted: denseIntegratedContact.graphAdmitted,
            graphFailClosed: denseIntegratedContact.graphFailClosed,
            graphFailureNames: denseIntegratedContact.graphFailureNames
          },
          aggregate: {
            graphAdmitted: denseIntegratedAggregateContact.graphAdmitted,
            graphFailClosed: denseIntegratedAggregateContact.graphFailClosed,
            graphFailureMask: denseIntegratedAggregateContact.graphFailureMask,
            graphFailureNames: denseIntegratedAggregateContact.graphFailureNames,
            aggregateRecordSummary:
              denseIntegratedAggregateContact.aggregateRecordSummary
          }
        })}`
      );
      requireTrue(
        flatGraphParity.sourceOffsets.length
            === aggregateGraphParity.sourceOffsets.length
          && flatGraphParity.sourceOffsets.every((value, index) => (
            value === aggregateGraphParity.sourceOffsets[index]
          )),
        'aggregate hierarchy did not reproduce the flat CSR source offsets'
      );
      requireTrue(
        flatGraphParity.directedPeerSets.length
            === aggregateGraphParity.directedPeerSets.length
          && flatGraphParity.directedPeerSets.every((peers, sourceIndex) => (
            peers.length
                === aggregateGraphParity.directedPeerSets[sourceIndex].length
              && peers.every((peer, peerIndex) => (
                peer
                  === aggregateGraphParity
                    .directedPeerSets[sourceIndex][peerIndex]
              ))
          )),
        'aggregate hierarchy did not reproduce the flat directed peer sets'
      );
      let maxNormalizedStateDelta = 0;
      for (let index = 0; index < flatGraphParity.finalState.length; index += 1) {
        const flatValue = flatGraphParity.finalState[index];
        const aggregateValue = aggregateGraphParity.finalState[index];
        if (index % 8 === 3) {
          requireTrue(
            Object.is(flatValue, aggregateValue),
            `aggregate hierarchy changed particle mass at state word ${index}`
          );
          continue;
        }
        const tolerance = 2.0e-5 + 2.0e-6 * Math.max(
          Math.abs(flatValue),
          Math.abs(aggregateValue)
        );
        maxNormalizedStateDelta = Math.max(
          maxNormalizedStateDelta,
          Math.abs(flatValue - aggregateValue) / tolerance
        );
      }
      requireTrue(
        maxNormalizedStateDelta <= 1,
        `aggregate hierarchy state diverged from flat contact: ${
          maxNormalizedStateDelta
        } normalized tolerance`
      );
      const denseIntegratedAggregateParity = {
        sourceOffsetCount: flatGraphParity.sourceOffsets.length,
        directedPeerCount:
          flatGraphParity.directedPeerSets.reduce(
            (sum, peers) => sum + peers.length,
            0
          ),
        maxNormalizedStateDelta
      };
      delete denseIntegratedContact.graphParity;
      delete denseIntegratedAggregateContact.graphParity;

      const phaseLineageCapacity = 2;
      const phaseParticleCount = phaseLineageCapacity * 4;
      const phaseParticles = Array.from(
        { length: phaseParticleCount },
        (_, index) => {
          const phaseLane = Math.floor(index / phaseLineageCapacity);
          const lineage = index % phaseLineageCapacity;
          const active = index === 0 || index === 3;
          const farDormant = phaseLane === 3;
          const x = farDormant
            ? [1.6 + lineage * 0.1, 1.6, 1]
            : lineage === 0
              ? [1, 1.02, 1]
              : [1, 0.92, 1];
          return {
            id: `phase-lineage-${lineage}-lane-${phaseLane}`,
            material: lineage === 0 ? 'fe' : 'h2o',
            x,
            massKg: active ? 1 : 0,
            restVolumeM3: active ? 0.1 ** 3 : 0,
            temperatureK: lineage === 0 ? 300 : 300,
            bodyId: `phase-lineage-body-${lineage}`,
            bodyDomainId: lineage + 1,
            phaseCompanionSlot: phaseLane > 0,
            phaseVolumeReferenceMassKg: active ? 1 : 0
          };
        }
      );
      const phasePostPositions = phaseParticles.map(({ x }, index) => (
        index === 0
          ? [1, 0.99999994, 1]
          : index === 3
            ? [1, 1.00000012, 1]
            : x
      ));
      const phasePostVelocities = phaseParticles.map((_, index) => (
        index === 0
          ? [0, -0.2, 0]
          : index === 3
            ? [0, 0.2, 0]
            : [0, 0, 0]
      ));
      const phaseDormantIndices = Array.from(
        { length: phaseParticleCount },
        (_, index) => index
      ).filter((index) => index !== 0 && index !== 3);
      const verifyPhaseLaneContact = ({
        mechanics,
        postStateBeforeApply,
        finalState,
        pairGeometry,
        sourceOffsets
      }) => {
        const after = pairGeometry(finalState, mechanics.mechanics, 0, 3);
        requireTrue(
          after.distanceM >= after.restDistanceM - 5.0e-6,
          `phase-lane contact remained penetrated: ${JSON.stringify(after)}`
        );
        for (const index of phaseDormantIndices) {
          requireTrue(
            sourceOffsets[index + 1] === sourceOffsets[index],
            `dormant phase lane ${index} retained graph edges`
          );
          for (let word = 0; word < 8; word += 1) {
            requireTrue(
              Object.is(
                finalState[index * 8 + word],
                postStateBeforeApply[index * 8 + word]
              ),
              `dormant phase lane ${index} changed state word ${word}`
            );
          }
        }
        return {
          activeParticleCount: 2,
          dormantParticleCount: phaseDormantIndices.length,
          activePairDistanceM: after.distanceM,
          activePairRestDistanceM: after.restDistanceM
        };
      };
      const phaseLaneFixture = {
        name: 'phase-lane-level-assignment-contact-flat',
        particles: phaseParticles,
        postPositions: phasePostPositions,
        postVelocities: phasePostVelocities,
        expectedPhaseByMaterial: {
          fe: 'solid',
          h2o: 'liquid'
        },
        inspectGraphOutcome: true,
        captureGraphParity: true,
        captureActiveRankView: true,
        useLevelAssignmentSource: true,
        phaseLineageCapacity,
        verify: verifyPhaseLaneContact
      };
      const phaseLaneFlatContact = await runFixture(phaseLaneFixture);
      const phaseLaneAggregateContact = await runFixture({
        ...phaseLaneFixture,
        name: 'phase-lane-level-assignment-contact-aggregate',
        useAggregateHierarchy: true,
        captureAggregateRecords: true
      });
      const allDormantPhaseContact = await runFixture({
        ...phaseLaneFixture,
        name: 'phase-lane-level-assignment-contact-all-dormant',
        particles: phaseParticles.map((particle) => ({
          ...particle,
          massKg: 0,
          restVolumeM3: 0,
          phaseVolumeReferenceMassKg: 0
        })),
        postPositions: phaseParticles.map(({ x }) => [...x]),
        postVelocities: phaseParticles.map(() => [0, 0, 0]),
        captureGraphParity: false,
        expectEmptyActiveGraph: true,
        verify: ({
          finalState,
          postStateBeforeApply,
          sourceOffsets
        }) => {
          requireTrue(
            sourceOffsets.every((value) => value === 0)
              && finalState.every((value, index) => (
                Object.is(value, postStateBeforeApply[index])
              )),
            'admitted all-dormant active-rank graph mutated state or CSR offsets'
          );
          return {
            activeParticleCount: 0,
            dormantParticleCount: phaseParticleCount
          };
        }
      });
      const allDormantActiveRankView = allDormantPhaseContact.activeRankViewSummary;
      requireTrue(
        allDormantActiveRankView?.activeRankCount === 0
          && allDormantActiveRankView?.dormantRankCount === phaseParticleCount
          && allDormantActiveRankView.rankPrefix.length
            === phaseParticleCount + 1
          && allDormantActiveRankView.rankPrefix.every((value) => value === 0)
          && allDormantActiveRankView.activeRanks.length === 0
          && allDormantActiveRankView.activeSourceIndices.length === 0
          && allDormantActiveRankView.header[44] === 1
          && allDormantActiveRankView.proposalActiveRankViewEnabled === true
          && allDormantPhaseContact.graphAdmitted === true
          && allDormantPhaseContact.graphFailureMask === 0
          && allDormantPhaseContact.candidateVisitCount === 0
          && allDormantPhaseContact.publishedDirectedPairCount === 0,
        `all-dormant active-rank projection did not complete as an admitted no-op: ${
          JSON.stringify(allDormantPhaseContact)
        }`
      );
      const phaseFlatGraph = phaseLaneFlatContact.graphParity;
      const phaseAggregateGraph = phaseLaneAggregateContact.graphParity;
      const phaseActiveRankView = phaseLaneFlatContact.activeRankViewSummary;
      requireTrue(
        phaseActiveRankView != null,
        'phase-lane flat fixture did not capture the active-rank producer payload'
      );
      const activeHeader = phaseActiveRankView.header;
      const directoryHeader = phaseActiveRankView.directoryHeader;
      const activeFingerprintFold = (value, word) => (
        Math.imul((value ^ word) >>> 0, 16777619) >>> 0
      );
      let activeReplayToken = 2166136261;
      for (const word of [3, 7, 8, 9, 10, 11, 12, 13, 14, 15, 35]) {
        activeReplayToken = activeFingerprintFold(
          activeReplayToken,
          directoryHeader[word]
        );
      }
      let activeHeaderFingerprint = activeReplayToken;
      for (const word of [64, 9, 73, 8, 81, 8, 2, 6, 1]) {
        activeHeaderFingerprint = activeFingerprintFold(
          activeHeaderFingerprint,
          word
        );
      }
      const activeRankDeltas = phaseActiveRankView.rankPrefix.slice(1).map(
        (value, index) => value - phaseActiveRankView.rankPrefix[index]
      );
      requireTrue(
        activeHeader[0] === 0x53525631
          && activeHeader[1] === 1
          && activeHeader[2] === 3
          && activeHeader[16] === phaseParticleCount
          && activeHeader[17] === phaseParticleCount
          && activeHeader[20] === 64
          && activeHeader[21] === 64
          && activeHeader[22] === 9
          && activeHeader[23] === 73
          && activeHeader[24] === phaseParticleCount
          && activeHeader[25] === 89
          && activeHeader[26] === 2
          && activeHeader[27] === 6
          && activeHeader[28] === 0
          && activeHeader[29] === 1
          && activeHeader[30] === directoryHeader[46]
          && activeHeader[31] === directoryHeader[31]
          && activeHeader[32] === directoryHeader[35]
          && activeHeader[33] === directoryHeader[35]
          && activeHeader[34] === directoryHeader[33]
          && activeHeader[35] === 64
          && activeHeader[36] === 44
          && activeHeader[37] === 3
          && activeHeader[38] === directoryHeader[22]
          && activeHeader[39] === directoryHeader[47]
          && activeHeader[40] === activeReplayToken
          && activeHeader[41] === activeHeaderFingerprint
          && activeHeader[42] === 8192
          && activeHeader[43] === 32
          && activeHeader[44] === 1
          && activeHeader[45] === 1
          && activeHeader[46] === 1
          && activeHeader[47] === 64
          && activeHeader[48] === 89
          && activeHeader[49] === 81
          && activeHeader[50] === phaseParticleCount,
        `phase-lane active-rank header was not exactly authenticated: ${
          JSON.stringify(phaseActiveRankView)
        }`
      );
      requireTrue(
        phaseActiveRankView.rankPrefix.length === phaseParticleCount + 1
          && phaseActiveRankView.rankPrefix[0] === 0
          && phaseActiveRankView.rankPrefix.at(-1) === 2
          && activeRankDeltas.every((delta) => delta === 0 || delta === 1)
          && phaseActiveRankView.activeRanks.every(
            (rank, ordinal) => activeRankDeltas[rank] === 1
              && phaseActiveRankView.activeSourceIndices[ordinal]
                === phaseActiveRankView.directoryMembers[rank]
          )
          && phaseActiveRankView.activeRanks.join(',') === '1,3'
          && [...phaseActiveRankView.activeSourceIndices].sort((a, b) => a - b)
            .join(',') === '0,3'
          && phaseActiveRankView.proposalActiveRankViewEnabled === true
          && phaseActiveRankView.proposalProjectionMode === 'active-rank'
          && phaseActiveRankView.proposalAdmissionStatus
            === 'schroeder-spatial-active-rank-view-admitted-host-descriptor',
        `phase-lane active-rank prefix or mechanical admission diverged: ${
          JSON.stringify(phaseActiveRankView)
        }`
      );
      requireTrue(
        phaseFlatGraph != null && phaseAggregateGraph != null,
        `phase-lane aggregate parity payload was unavailable: ${JSON.stringify({
          flat: phaseLaneFlatContact,
          aggregate: phaseLaneAggregateContact
        })}`
      );
      requireTrue(
        phaseFlatGraph.sourceOffsets.length
            === phaseAggregateGraph.sourceOffsets.length
          && phaseFlatGraph.sourceOffsets.every((value, index) => (
            value === phaseAggregateGraph.sourceOffsets[index]
          )),
        'phase-lane aggregate did not reproduce flat CSR source offsets'
      );
      requireTrue(
        phaseFlatGraph.directedPeerSets.every((peers, sourceIndex) => (
          peers.length === phaseAggregateGraph.directedPeerSets[sourceIndex].length
            && peers.every((peer, peerIndex) => (
              peer === phaseAggregateGraph.directedPeerSets[sourceIndex][peerIndex]
            ))
        )),
        'phase-lane aggregate did not reproduce flat directed peer sets'
      );
      requireTrue(
        phaseLaneFlatContact.aggregateDiagnostic.summaryPreflightCount
            === phaseParticleCount
          && phaseLaneAggregateContact.aggregateDiagnostic.summaryPreflightCount
            === phaseParticleCount
          && phaseLaneAggregateContact.aggregateDiagnostic.sourceCount
            === 2,
        `phase-lane aggregate did not authenticate every fixed-capacity lane: ${
          JSON.stringify({
            flat: phaseLaneFlatContact.aggregateDiagnostic,
            aggregate: phaseLaneAggregateContact.aggregateDiagnostic
          })
        }`
      );
      requireTrue(
        phaseLaneAggregateContact.aggregateRecordSummary.sourceCount
            === phaseParticleCount
          && phaseLaneAggregateContact.aggregateRecordSummary.attemptedSourceCount
            === phaseParticleCount
          && phaseLaneAggregateContact.aggregateRecordSummary.reducedSourceCount
            === phaseParticleCount
          && phaseLaneAggregateContact.aggregateRecordSummary.root.sourceMemberCount
            === phaseParticleCount
          && phaseLaneAggregateContact.aggregateRecordSummary.root.particleCount === 2
          && phaseLaneAggregateContact.aggregateRecordSummary.emptyLeafCount > 0,
        `phase-lane aggregate record authority was incomplete: ${JSON.stringify(
          phaseLaneAggregateContact.aggregateRecordSummary
        )}`
      );
      const phaseLaneAggregateParity = {
        sourceOffsetCount: phaseFlatGraph.sourceOffsets.length,
        directedPeerCount: phaseFlatGraph.directedPeerSets.reduce(
          (sum, peers) => sum + peers.length,
          0
        ),
        emptyLeafCount:
          phaseLaneAggregateContact.aggregateRecordSummary.emptyLeafCount,
        rootActiveParticleCount:
          phaseLaneAggregateContact.aggregateRecordSummary.root.particleCount,
        rootSourceMemberCount:
          phaseLaneAggregateContact.aggregateRecordSummary.root.sourceMemberCount
      };
      const corruptedAggregateRecord = await runFixture({
        ...phaseLaneFixture,
        name: 'phase-lane-aggregate-record-fingerprint-corruption',
        useAggregateHierarchy: true,
        captureGraphParity: false,
        corruptAggregateRecordFingerprint: true
      });
      requireTrue(
        corruptedAggregateRecord.graphFailClosed === true
          && corruptedAggregateRecord.graphFailureNames.includes(
            'MALFORMED_TRAVERSAL'
          )
          && corruptedAggregateRecord.candidateVisitCount === 0
          && corruptedAggregateRecord.pairCounts.publishedDirectedPairCount === 0
          && corruptedAggregateRecord.stateMutationCount === 0,
        `aggregate record corruption did not fail closed before traversal: ${
          JSON.stringify(corruptedAggregateRecord)
        }`
      );
      delete phaseLaneFlatContact.graphParity;
      delete phaseLaneAggregateContact.graphParity;
      delete phaseLaneAggregateContact.aggregateRecordSummary;

      // Gershgorin bounds are expressed in the world-coordinate basis. Rotate
      // the identical dense interface so the same reciprocal constraints must
      // close under a different distribution of tensor off-diagonal terms.
      const integratedRotationRadians = 15 * Math.PI / 180;
      const integratedRotationCos = Math.cos(integratedRotationRadians);
      const integratedRotationSin = Math.sin(integratedRotationRadians);
      const rotateIntegratedVector = ([x, y, z]) => [
        integratedRotationCos * x - integratedRotationSin * y,
        integratedRotationSin * x + integratedRotationCos * y,
        z
      ];
      const rotateIntegratedPoint = ([x, y, z]) => {
        const rotated = rotateIntegratedVector([x - 1, y - 1, z - 1]);
        return [rotated[0] + 1, rotated[1] + 1, rotated[2] + 1];
      };
      const rotatedIntegratedParticles = integratedParticles.map(
        (particle) => ({
          ...particle,
          id: `rotated-${particle.id}`,
          x: rotateIntegratedPoint(particle.x),
          bodyId: `rotated-${particle.bodyId}`
        })
      );
      const denseIntegratedRotatedContact = await runFixture({
        name: 'dense-integrated-molten-iron-ice-impact-rotated-15deg',
        particles: rotatedIntegratedParticles,
        postPositions: integratedPostPositions.map(rotateIntegratedPoint),
        postVelocities: integratedPostVelocities.map(rotateIntegratedVector),
        expectedPhaseByMaterial: {
          fe: 'liquid',
          h2o: 'solid'
        },
        inspectGraphOutcome: true,
        verify: ({
          mechanics,
          postStateBeforeApply,
          finalState,
          pairGeometry
        }) => {
          const interfaceGeometry = integratedInterfacePairs.map(
            ([ironIndex, iceIndex]) => pairGeometry(
              finalState,
              mechanics.mechanics,
              ironIndex,
              iceIndex
            )
          );
          const interfaceFaceGeometry = interfaceGeometry.map((pair) => {
            const normalAxis = pair.delta.reduce(
              (best, value, axis) => (
                Math.abs(value) > Math.abs(pair.delta[best])
                  ? axis
                  : best
              ),
              0
            );
            const normal = [0, 0, 0];
            normal[normalAxis] =
              Math.sign(pair.delta[normalAxis]) || 1;
            return {
              pair,
              normalAxis,
              positionResidualM: Math.max(
                pair.restDistanceM - dot3(pair.delta, normal),
                0
              ),
              closingVelocityMPerS: Math.max(-dot3(
                subtract3(pair.leftVelocity, pair.rightVelocity),
                normal
              ), 0)
            };
          });
          const maxPositionResidualM = Math.max(...interfaceFaceGeometry.map(
            ({ positionResidualM }) => positionResidualM
          ));
          const maxClosingVelocityMPerS = Math.max(...interfaceFaceGeometry.map(
            ({ closingVelocityMPerS }) => closingVelocityMPerS
          ));
          requireTrue(
            maxPositionResidualM <= 0.02 * integratedPitchM + 2.0e-5,
            `rotated integrated Fe/ice interface retained excess overlap: ${
              maxPositionResidualM
            }`
          );
          requireTrue(
            maxClosingVelocityMPerS <= 1.1e-3,
            `rotated integrated Fe/ice interface retained closing speed: ${
              maxClosingVelocityMPerS
            }`
          );
          const momentumBefore = totalMomentum(postStateBeforeApply);
          const momentumAfter = totalMomentum(finalState);
          const momentumResidual = subtract3(momentumAfter, momentumBefore);
          const momentumScale = Math.max(vectorLength(momentumBefore), 1);
          requireTrue(
            vectorLength(momentumResidual) <= 1.0e-5 * momentumScale,
            `rotated integrated Fe/ice graph changed linear momentum: ${
              momentumResidual
            }`
          );
          const massPositionBefore = totalMassPosition(postStateBeforeApply);
          const massPositionAfter = totalMassPosition(finalState);
          const massPositionResidual = subtract3(
            massPositionAfter,
            massPositionBefore
          );
          const massPositionScale = Math.max(
            vectorLength(massPositionBefore),
            1
          );
          requireTrue(
            vectorLength(massPositionResidual) <= 1.0e-5 * massPositionScale,
            `rotated integrated Fe/ice graph changed center of mass: ${
              massPositionResidual
            }`
          );
          return {
            rotationDegrees: 15,
            manufacturedInterfacePairCount: integratedInterfacePairs.length,
            impactDisplacementM: integratedImpactDisplacementM,
            impactVelocityMPerS: 5,
            maxManufacturedPositionResidualM: maxPositionResidualM,
            maxManufacturedClosingVelocityMPerS: maxClosingVelocityMPerS,
            momentumResidualKgMPerS: momentumResidual,
            massPositionResidualKgM: massPositionResidual
          };
        }
      });

      const denseParticleCount = 152;
      const denseDiameterM = 0.01;
      const densePitchM = denseDiameterM * 1.01;
      const densePositions = Array.from(
        { length: denseParticleCount },
        (_, index) => [
          0.9 + (index % 6) * densePitchM,
          0.9 + (Math.floor(index / 6) % 6) * densePitchM,
          0.9 + Math.floor(index / 36) * densePitchM
        ]
      );
      const denseParticles = densePositions.map((x, index) => ({
        id: `dense-contact-iron-${index}`,
        material: 'fe',
        x,
        massKg: 7_874 * denseDiameterM ** 3,
        restVolumeM3: denseDiameterM ** 3,
        bodyId: `dense-contact-body-${index}`,
        bodyDomainId: index + 1
      }));
      const denseDirectedPairCount =
        denseParticleCount * (denseParticleCount - 1);
      const runDenseContactSample = (sample) => runFixture({
        name: `dense-complete-contact-${sample}`,
        particles: denseParticles,
        postPositions: densePositions,
        postVelocities: densePositions.map(() => [0, 0, 0]),
        measureApplyDuration: true,
        retainCompleteAuthenticatedCellCliques: true,
        verify: ({
          postStateBeforeApply,
          finalState,
          proposal,
          evidence,
          graphControl,
          sourceOffsets
        }) => {
          requireTrue(
            proposal.directedPairCapacity >= denseDirectedPairCount,
            `dense contact capacity ${proposal.directedPairCapacity} cannot retain ${
              denseDirectedPairCount
            } directed pairs`
          );
          requireTrue(
            proposal.proposalCapacity === denseParticleCount
              && sourceOffsets.length === denseParticleCount + 1,
            `dense contact did not use the exact live-source arena: ${
              proposal.proposalCapacity
            }/${sourceOffsets.length}`
          );
          requireTrue(
            evidence[evidenceWord.appendAttemptCount] === denseDirectedPairCount
              && evidence[evidenceWord.stagedDirectedPairCount]
                === denseDirectedPairCount
              && evidence[evidenceWord.requiredDirectedPairCount]
                === denseDirectedPairCount
              && evidence[evidenceWord.publishedDirectedPairCount]
                === denseDirectedPairCount,
            `dense contact evidence did not retain the complete directed graph: ${
              Array.from(evidence)
            }`
          );
          requireTrue(
            graphControl[11] === denseDirectedPairCount
              && graphControl[12] === denseDirectedPairCount
              && graphControl[13] === denseDirectedPairCount
              && graphControl[29] === Math.ceil(denseDirectedPairCount / 64)
              && graphControl[30] === 1
              && graphControl[31] === 1,
            `dense contact control did not publish the complete directed graph: ${
              Array.from(graphControl)
            }`
          );
          requireTrue(
            sourceOffsets.length > proposal.proposalCapacity
              && sourceOffsets[0] === 0,
            `dense contact CSR offset layout was truncated: ${sourceOffsets.length}`
          );
          for (let index = 0; index < denseParticleCount; index += 1) {
            requireTrue(
              sourceOffsets[index + 1] - sourceOffsets[index]
                === denseParticleCount - 1,
              `dense contact source ${index} had degree ${
                sourceOffsets[index + 1] - sourceOffsets[index]
              } instead of ${denseParticleCount - 1}`
            );
          }
          requireTrue(
            sourceOffsets[denseParticleCount] === denseDirectedPairCount
              && sourceOffsets[proposal.proposalCapacity]
                === denseDirectedPairCount
              && Array.from(sourceOffsets.slice(
                denseParticleCount,
                proposal.proposalCapacity + 1
              )).every((value) => value === denseDirectedPairCount),
            `dense contact CSR terminators were not stable through capacity ${
              proposal.proposalCapacity
            }`
          );
          requireTrue(
            finalState.every((value, index) => (
              Object.is(value, postStateBeforeApply[index])
            )),
            'dense non-overlapping zero-velocity graph changed particle state'
          );
          return {
            directedPairCount: denseDirectedPairCount,
            degree: denseParticleCount - 1,
            particleTerminator: sourceOffsets[denseParticleCount],
            capacityTerminator: sourceOffsets[proposal.proposalCapacity],
            proposalCapacity: proposal.proposalCapacity,
            directedPairCapacity: proposal.directedPairCapacity,
            proposalPoolCacheHit: proposal.proposalPoolCacheHit
          };
        }
      });

      const denseWarmup = await runDenseContactSample('warmup');
      const denseMeasuredSamples = [];
      for (let sample = 0; sample < 9; sample += 1) {
        denseMeasuredSamples.push(await runDenseContactSample(`sample-${sample + 1}`));
      }
      const denseDurationsMs = denseMeasuredSamples
        .map(({ applyDurationMs }) => applyDurationMs)
        .sort((left, right) => left - right);
      const denseP95Rank = (denseDurationsMs.length - 1) * 0.95;
      const denseP95Lower = Math.floor(denseP95Rank);
      const denseP95Upper = Math.ceil(denseP95Rank);
      const denseP95Ms = denseDurationsMs[denseP95Lower]
        + (denseDurationsMs[denseP95Upper] - denseDurationsMs[denseP95Lower])
          * (denseP95Rank - denseP95Lower);
      const denseMaxMs = denseDurationsMs.at(-1);
      requireTrue(
        denseMeasuredSamples.every(({ proposalPoolCacheHit }) => (
          proposalPoolCacheHit === true
        )),
        'dense measured contact samples did not all reuse the warmed arena'
      );
      // The 512-sweep proof bound keeps 512 one-workgroup finalizer dispatches
      // encoded even when the GPU latch has suppressed the converged particle
      // tail. WebGPU forbids a finalizer from writing the buffer that supplies
      // its own indirect arguments, so removing those launches requires a
      // different multi-pass convergence topology rather than an unsafe
      // self-modifying dispatch. Retain this explicit temporary down payment
      // while the increasing-N campaign measures the full SS scaling law.
      const denseMatchingCleanupP95BudgetMs = 1_100.0;
      const denseMatchingCleanupMaxBudgetMs = 1_200.0;
      requireTrue(
        denseP95Ms <= denseMatchingCleanupP95BudgetMs
          && denseMaxMs <= denseMatchingCleanupMaxBudgetMs,
        `dense contact validation exceeded its frame budget: ${JSON.stringify({
          durationsMs: denseDurationsMs,
          p95Ms: denseP95Ms,
          maxMs: denseMaxMs
        })}`
      );
      const denseContactPerformance = {
        particleCount: denseParticleCount,
        directedPairCount: denseDirectedPairCount,
        degree: denseParticleCount - 1,
        warmupMs: denseWarmup.applyDurationMs,
        measuredDurationsMs: denseDurationsMs,
        p95Ms: denseP95Ms,
        maxMs: denseMaxMs,
        p95BudgetMs: denseMatchingCleanupP95BudgetMs,
        maxBudgetMs: denseMatchingCleanupMaxBudgetMs,
        proposalCapacity: denseMeasuredSamples[0].proposalCapacity,
        directedPairCapacity: denseMeasuredSamples[0].directedPairCapacity,
        particleTerminator: denseMeasuredSamples[0].particleTerminator,
        capacityTerminator: denseMeasuredSamples[0].capacityTerminator,
        measuredPoolCacheHits: denseMeasuredSamples.map(
          ({ proposalPoolCacheHit }) => proposalPoolCacheHit
        )
      };

      let mechanicalMaterializeTimestampCampaign = null;
      if (runMaterializeTimestampCampaign) {
        const materializeWarmupCount = 3;
        const materializeMeasuredSampleCount = 9;
        const percentile = (values, quantile) => {
          const sorted = [...values].sort((left, right) => left - right);
          const rank = Math.max(1, Math.ceil(sorted.length * quantile));
          return sorted[Math.min(sorted.length - 1, rank - 1)];
        };
        const fixtureActiveParticleCount = ({ particles }) => particles.reduce(
          (count, { massKg, restVolumeM3 }) => (
            count + (Number(massKg) > 0 && Number(restVolumeM3) > 0 ? 1 : 0)
          ),
          0
        );
        const summarizeMaterializeArm = ({
          fixtureClass,
          traversalMode,
          fixture,
          warmups,
          samples
        }) => {
          requireTrue(
            warmups.length === materializeWarmupCount
              && samples.length === materializeMeasuredSampleCount,
            `${fixtureClass}/${traversalMode}: materialize sample count drifted: ${JSON.stringify({
              warmups: warmups.length,
              samples: samples.length
            })}`
          );
          const timestampForSample = (sample, sampleClass) => {
            const { materializeTimestampEvidence } = sample;
            let timestampMonotonic = false;
            try {
              timestampMonotonic = BigInt(
                materializeTimestampEvidence?.endTimestampNs
              ) > BigInt(materializeTimestampEvidence?.startTimestampNs);
            } catch {
              timestampMonotonic = false;
            }
            requireTrue(
              materializeTimestampEvidence?.schema
                  === 'peercompute.ulg.sph-native-mechanical-materialize-timestamp.v1'
                && materializeTimestampEvidence.status === 'complete'
                && materializeTimestampEvidence.producerId
                  === 'schroeder-spatial-mechanical-contact-graph:materialize'
                && materializeTimestampEvidence.stage === 'materialize'
                && materializeTimestampEvidence.spanClass
                  === 'same-production-command-encoder'
                && materializeTimestampEvidence.queryCount === 2
                && Number.isFinite(materializeTimestampEvidence.durationMs)
                && materializeTimestampEvidence.durationMs > 0,
              `${fixtureClass}/${traversalMode}/${sampleClass}: materialize timestamp was incomplete: ${
                JSON.stringify(materializeTimestampEvidence)
              }`
            );
            requireTrue(
              timestampMonotonic,
              `${fixtureClass}/${traversalMode}/${sampleClass}: materialize timestamp was not monotonic`
            );
            return materializeTimestampEvidence;
          };
          const warmupEvidence = warmups.map((sample, index) => (
            timestampForSample(sample, `warmup-${index + 1}`)
          ));
          const measuredEvidence = samples.map((sample, index) => (
            timestampForSample(sample, `sample-${index + 1}`)
          ));
          const timingNs = measuredEvidence.map(({ durationNs }) => durationNs);
          const timings = measuredEvidence.map(({ durationMs }) => durationMs);
          const first = samples[0];
          const activeParticleCount = fixtureActiveParticleCount(fixture);
          requireTrue(
            first.particleCount === fixture.particles.length
              && activeParticleCount <= first.particleCount,
            `${fixtureClass}/${traversalMode}: fixture active-count accounting drifted`
          );
          requireTrue(
            traversalMode === 'aggregate'
              ? first.spatialProjectionMode === 'aggregate'
                && first.activeRankViewEnabled === false
              : (
                (first.spatialProjectionMode === 'flat'
                  || first.spatialProjectionMode === 'active-rank')
                && first.activeRankViewEnabled
                  === (first.spatialProjectionMode === 'active-rank')
              ),
            `${fixtureClass}/${traversalMode}: observed projection disagreed with the authenticated mode: ${
              JSON.stringify({
                spatialProjectionMode: first.spatialProjectionMode,
                activeRankViewEnabled: first.activeRankViewEnabled
              })
            }`
          );
          requireTrue(
            samples.every((sample) => (
              sample.candidateVisitCount === first.candidateVisitCount
              && sample.projectedPeerVisitCount === first.projectedPeerVisitCount
              && sample.publishedDirectedPairCount
                === first.publishedDirectedPairCount
              && sample.encodedDispatchCount === first.encodedDispatchCount
              && sample.encodedComputePassCount === 153
              && sample.spatialProjectionMode === first.spatialProjectionMode
              && sample.activeRankViewEnabled === first.activeRankViewEnabled
              && sample.proposalPoolCacheHit === true
            )),
            `${fixtureClass}/${traversalMode}: instrumented mechanical work drifted across samples`
          );
          return {
            fixtureClass,
            traversalMode,
            particleCount: first.particleCount,
            activeParticleCount,
            dormantParticleCount: first.particleCount - activeParticleCount,
            spatialProjectionModeObserved: first.spatialProjectionMode,
            activeRankViewEnabled: first.activeRankViewEnabled,
            instrumentation: {
              schema: 'peercompute.ulg.sph-native-mechanical-materialize-timestamp-campaign.v1',
              passGrouping: 'instrumented-dispatch-granular',
              sameProductionCommandEncoder: true,
              productionBuildPassSplitForTimestamp: true,
              queryCountPerSample: 2,
              note: 'Timestamp mode splits the production build pass solely to isolate materialize; compare only like-for-like instrumented arms.'
            },
            warmupMaterializeNs: warmupEvidence.map(({ durationNs }) => durationNs),
            warmupMaterializeMs: warmupEvidence.map(({ durationMs }) => durationMs),
            measuredMaterializeNs: timingNs,
            measuredMaterializeMs: timings,
            p50MaterializeNs: percentile(timingNs, 0.5),
            p50MaterializeMs: percentile(timings, 0.5),
            p95MaterializeNs: percentile(timingNs, 0.95),
            p95MaterializeMs: percentile(timings, 0.95),
            maxMaterializeNs: Math.max(...timingNs),
            maxMaterializeMs: Math.max(...timings),
            candidateVisitCount: first.candidateVisitCount,
            projectedPeerVisitCount: first.projectedPeerVisitCount,
            publishedDirectedPairCount: first.publishedDirectedPairCount,
            encodedDispatchCount: first.encodedDispatchCount,
            encodedComputePassCount: first.encodedComputePassCount,
            proposalPoolCacheHits: samples.map(
              ({ proposalPoolCacheHit }) => proposalPoolCacheHit
            ),
            aggregateDiagnostic: first.aggregateDiagnostic ?? null
          };
        };
        const runMaterializePair = async ({
          fixtureClass,
          fixture
        }) => {
          const runSample = (traversalMode, sample) => runFixture({
            ...fixture,
            name: `materialize-timestamp-${fixtureClass}-${traversalMode}-${sample}`,
            useAggregateHierarchy: traversalMode === 'aggregate',
            captureMaterializeTimestamp: true,
            captureGraphParity: false,
            captureActiveRankView: false,
            captureAggregateRecords: false,
            inspectGraphOutcome: true
          });
          const samplesByMode = {
            flat: [],
            aggregate: []
          };
          const warmupsByMode = {
            flat: [],
            aggregate: []
          };
          const interleavedOrder = (ordinal) => (
            ordinal % 2 === 0
              ? ['flat', 'aggregate']
              : ['aggregate', 'flat']
          );
          for (let warmup = 0; warmup < materializeWarmupCount; warmup += 1) {
            for (const traversalMode of interleavedOrder(warmup)) {
              warmupsByMode[traversalMode].push(await runSample(
                traversalMode,
                `warmup-${warmup + 1}`
              ));
            }
          }
          for (let sample = 0;
            sample < materializeMeasuredSampleCount;
            sample += 1) {
            for (const traversalMode of interleavedOrder(sample)) {
              samplesByMode[traversalMode].push(await runSample(
                traversalMode,
                `sample-${sample + 1}`
              ));
            }
          }
          const flat = summarizeMaterializeArm({
            fixtureClass,
            traversalMode: 'flat',
            fixture,
            warmups: warmupsByMode.flat,
            samples: samplesByMode.flat
          });
          const aggregate = summarizeMaterializeArm({
            fixtureClass,
            traversalMode: 'aggregate',
            fixture,
            warmups: warmupsByMode.aggregate,
            samples: samplesByMode.aggregate
          });
          requireTrue(
            flat.publishedDirectedPairCount
                === aggregate.publishedDirectedPairCount,
            `flat/aggregate materialize work parity drifted for ${fixtureClass}`
          );
          return {
            fixtureClass,
            flat,
            aggregate,
            aggregateToFlatP50Ratio:
              aggregate.p50MaterializeNs / flat.p50MaterializeNs,
            pairedAggregateMinusMaterializeNs:
              aggregate.measuredMaterializeNs.map((durationNs, index) => (
                durationNs - flat.measuredMaterializeNs[index]
              ))
          };
        };
        const sparseTimestampFixture = {
          particles: [
            {
              id: 'timestamp-sparse-iron',
              material: 'fe',
              x: [1, 1.02, 1],
              massKg: 4,
              restVolumeM3: 0.04 ** 3,
              bodyId: 'timestamp-sparse-iron-body',
              bodyDomainId: 1
            },
            {
              id: 'timestamp-sparse-ice',
              material: 'h2o',
              x: [1, 0.92, 1],
              massKg: 1,
              restVolumeM3: 0.16 ** 3,
              bodyId: 'timestamp-sparse-ice-body',
              bodyDomainId: 2
            }
          ],
          postPositions: [
            [1, 0.99999994, 1],
            [1, 1.00000012, 1]
          ],
          postVelocities: [
            [0, -0.2, 0],
            [0, 0.8, 0]
          ],
          verify: ({ finalState }) => ({
            finiteState: finalState.every(finite)
          })
        };
        const dormantHeavyPhaseLineageCapacity = 256;
        const dormantHeavyPhaseParticleCount = dormantHeavyPhaseLineageCapacity * 4;
        const dormantHeavyActiveIndices = new Set([
          0,
          dormantHeavyPhaseLineageCapacity + 1
        ]);
        const dormantHeavyQuerySafeCellCenters = [];
        const dormantHeavyActiveSweepAnchors = [
          [1, 1.02, 1],
          [1, 0.92, 1],
          [1, 0.99999994, 1],
          [1, 1.00000012, 1]
        ];
        // The directory uses 0.1 m cells. Keep every zero-mass carrier in a
        // distinct cell whose entire AABB is outside the active pair's mixed
        // swept-query support, so this measures the self-dispatch/projection
        // decision rather than incidental broad-phase pruning.
        for (let cellZ = 0; cellZ < 20; cellZ += 1) {
          for (let cellY = 0; cellY < 20; cellY += 1) {
            for (let cellX = 0; cellX < 20; cellX += 1) {
              const x = [
                0.05 + cellX * 0.1,
                0.05 + cellY * 0.1,
                0.05 + cellZ * 0.1
              ];
              if (dormantHeavyActiveSweepAnchors.every((anchor) => (
                vectorLength(subtract3(x, anchor)) > 0.8
              ))) {
                dormantHeavyQuerySafeCellCenters.push(x);
              }
            }
          }
        }
        requireTrue(
          dormantHeavyQuerySafeCellCenters.length
            >= dormantHeavyPhaseParticleCount - dormantHeavyActiveIndices.size,
          'dormant-heavy fixture could not allocate enough query-safe cell centers'
        );
        const dormantHeavyPhaseParticles = Array.from(
          { length: dormantHeavyPhaseParticleCount },
          (_, index) => {
            const phaseLane = Math.floor(index / dormantHeavyPhaseLineageCapacity);
            const lineage = index % dormantHeavyPhaseLineageCapacity;
            const active = dormantHeavyActiveIndices.has(index);
            const dormantOrdinal = index
              - (index > 0 ? 1 : 0)
              - (index > dormantHeavyPhaseLineageCapacity + 1 ? 1 : 0);
            const x = index === 0
              ? [1, 1.02, 1]
              : index === dormantHeavyPhaseLineageCapacity + 1
                ? [1, 0.92, 1]
                : dormantHeavyQuerySafeCellCenters[dormantOrdinal];
            return {
              id: `timestamp-dormant-heavy-lineage-${lineage}-lane-${phaseLane}`,
              material: lineage === 0 ? 'fe' : 'h2o',
              x,
              massKg: active ? 1 : 0,
              restVolumeM3: active ? 0.1 ** 3 : 0,
              temperatureK: 300,
              bodyId: `timestamp-dormant-heavy-body-${lineage}`,
              bodyDomainId: lineage + 1,
              phaseCompanionSlot: phaseLane > 0,
              phaseVolumeReferenceMassKg: active ? 1 : 0
            };
          }
        );
        const dormantHeavyPostPositions = dormantHeavyPhaseParticles.map(
          ({ x }, index) => (
            index === 0
              ? [1, 0.99999994, 1]
              : index === dormantHeavyPhaseLineageCapacity + 1
                ? [1, 1.00000012, 1]
                : [...x]
          )
        );
        const dormantHeavyPostVelocities = dormantHeavyPhaseParticles.map(
          (_, index) => (
            index === 0
              ? [0, -0.2, 0]
              : index === dormantHeavyPhaseLineageCapacity + 1
                ? [0, 0.2, 0]
                : [0, 0, 0]
          )
        );
        const dormantHeavyIndices = Array.from(
          { length: dormantHeavyPhaseParticleCount },
          (_, index) => index
        ).filter((index) => !dormantHeavyActiveIndices.has(index));
        const dormantHeavyTimestampFixture = {
          particles: dormantHeavyPhaseParticles,
          postPositions: dormantHeavyPostPositions,
          postVelocities: dormantHeavyPostVelocities,
          expectedPhaseByMaterial: {
            fe: 'solid',
            h2o: 'liquid'
          },
          useLevelAssignmentSource: true,
          phaseLineageCapacity: dormantHeavyPhaseLineageCapacity,
          captureGraphParity: false,
          captureActiveRankView: false,
          captureAggregateRecords: false,
          verify: ({
            mechanics,
            postStateBeforeApply,
            finalState,
            pairGeometry,
            sourceOffsets
          }) => {
            const activePeerIndex = dormantHeavyPhaseLineageCapacity + 1;
            const after = pairGeometry(
              finalState,
              mechanics.mechanics,
              0,
              activePeerIndex
            );
            requireTrue(
              after.distanceM >= after.restDistanceM - 5.0e-6,
              `dormant-heavy active pair remained penetrated: ${JSON.stringify(after)}`
            );
            for (const index of dormantHeavyIndices) {
              requireTrue(
                sourceOffsets[index + 1] === sourceOffsets[index],
                `dormant-heavy lane ${index} retained graph edges`
              );
              for (let word = 0; word < 8; word += 1) {
                requireTrue(
                  Object.is(
                    finalState[index * 8 + word],
                    postStateBeforeApply[index * 8 + word]
                  ),
                  `dormant-heavy lane ${index} changed state word ${word}`
                );
              }
            }
            return {
              activeParticleCount: dormantHeavyActiveIndices.size,
              dormantParticleCount: dormantHeavyIndices.length,
              activePairDistanceM: after.distanceM,
              activePairRestDistanceM: after.restDistanceM
            };
          }
        };
        const allDormantTimestampFixture = {
          ...dormantHeavyTimestampFixture,
          particles: dormantHeavyPhaseParticles.map((particle) => ({
            ...particle,
            massKg: 0,
            restVolumeM3: 0,
            phaseVolumeReferenceMassKg: 0
          })),
          postPositions: dormantHeavyPhaseParticles.map(({ x }) => [...x]),
          postVelocities: dormantHeavyPhaseParticles.map(() => [0, 0, 0]),
          expectEmptyActiveGraph: true,
          verify: ({ finalState, postStateBeforeApply, sourceOffsets }) => {
            requireTrue(
              sourceOffsets.every((value) => value === 0)
                && finalState.every((value, index) => (
                  Object.is(value, postStateBeforeApply[index])
                )),
              'all-dormant materialize timing fixture mutated state or CSR offsets'
            );
            return {
              activeParticleCount: 0,
              dormantParticleCount: dormantHeavyPhaseParticleCount
            };
          }
        };
        // The retained pools and epoch ordinal are intentionally device-local.
        // Interleave flat and aggregate arms serially so each sample starts
        // after the preceding generation releases, without queue overlap or a
        // one-sided thermal/cache bias.
        const sparsePair = await runMaterializePair({
          fixtureClass: 'sparse-two-body',
          fixture: sparseTimestampFixture
        });
        const densePair = await runMaterializePair({
          fixtureClass: 'dense-fe-ice-interface',
          fixture: denseIntegratedContactFixture
        });
        const dormantHeavyPair = await runMaterializePair({
          fixtureClass: 'dormant-heavy-phase-lanes',
          fixture: dormantHeavyTimestampFixture
        });
        const dormantHeavyAggregateStructure = await runFixture({
          ...dormantHeavyTimestampFixture,
          name: 'materialize-timestamp-dormant-heavy-aggregate-structure',
          useAggregateHierarchy: true,
          captureAggregateRecords: true,
          inspectGraphOutcome: true
        });
        const dormantHeavyAggregateRecordSummary =
          dormantHeavyAggregateStructure.aggregateRecordSummary;
        requireTrue(
          dormantHeavyAggregateRecordSummary?.sourceCount
              === dormantHeavyPhaseParticleCount
            && dormantHeavyAggregateRecordSummary.attemptedSourceCount
              === dormantHeavyPhaseParticleCount
            && dormantHeavyAggregateRecordSummary.reducedSourceCount
              === dormantHeavyPhaseParticleCount
            && dormantHeavyAggregateRecordSummary.leafCount
              === dormantHeavyPhaseParticleCount
            && dormantHeavyAggregateRecordSummary.totalRecordCount
              === dormantHeavyPhaseParticleCount * 2 - 1
            && dormantHeavyAggregateRecordSummary.root?.sourceMemberCount
              === dormantHeavyPhaseParticleCount
            && dormantHeavyAggregateRecordSummary.root?.particleCount === 2
            && dormantHeavyAggregateRecordSummary.emptyLeafCount
              === dormantHeavyPhaseParticleCount - 2,
          `dormant-heavy aggregate structure did not retain the exact full hierarchy: ${
            JSON.stringify(dormantHeavyAggregateRecordSummary)
          }`
        );
        const allDormantAggregate = await runFixture({
          ...allDormantTimestampFixture,
          name: 'materialize-timestamp-all-dormant-aggregate',
          useAggregateHierarchy: true,
          captureMaterializeTimestamp: true,
          captureAggregateRecords: true,
          inspectGraphOutcome: true
        });
        requireTrue(
          allDormantAggregate.materializeTimestampEvidence?.status === 'complete'
            && allDormantAggregate.candidateVisitCount === 0
            && allDormantAggregate.projectedPeerVisitCount === 0
            && allDormantAggregate.publishedDirectedPairCount === 0
            && allDormantAggregate.encodedComputePassCount === 153
            && allDormantAggregate.aggregateRecordSummary?.sourceCount
              === dormantHeavyPhaseParticleCount
            && allDormantAggregate.aggregateRecordSummary?.leafCount
              === dormantHeavyPhaseParticleCount
            && allDormantAggregate.aggregateRecordSummary?.totalRecordCount
              === dormantHeavyPhaseParticleCount * 2 - 1
            && allDormantAggregate.aggregateRecordSummary.root?.sourceMemberCount
              === dormantHeavyPhaseParticleCount
            && allDormantAggregate.aggregateRecordSummary.root?.particleCount === 0
            && allDormantAggregate.aggregateRecordSummary.emptyLeafCount
              === dormantHeavyPhaseParticleCount,
          `all-dormant aggregate materialize timing sanity failed: ${
            JSON.stringify(allDormantAggregate)
          }`
        );
        const pairedArms = [sparsePair, densePair, dormantHeavyPair];
        mechanicalMaterializeTimestampCampaign = {
          schema: 'peercompute.ulg.sph-native-mechanical-materialize-timestamp-campaign.v1',
          status: 'complete',
          timestampUnit: 'nanoseconds',
          warmupCount: materializeWarmupCount,
          measuredSampleCount: materializeMeasuredSampleCount,
          pairedArms,
          dormantHeavyAggregateStructure: {
            sourceCount: dormantHeavyAggregateRecordSummary.sourceCount,
            attemptedSourceCount:
              dormantHeavyAggregateRecordSummary.attemptedSourceCount,
            reducedSourceCount:
              dormantHeavyAggregateRecordSummary.reducedSourceCount,
            leafCount: dormantHeavyAggregateRecordSummary.leafCount,
            totalRecordCount: dormantHeavyAggregateRecordSummary.totalRecordCount,
            emptyLeafCount: dormantHeavyAggregateRecordSummary.emptyLeafCount,
            root: {
              sourceMemberCount:
                dormantHeavyAggregateRecordSummary.root.sourceMemberCount,
              particleCount:
                dormantHeavyAggregateRecordSummary.root.particleCount
            }
          },
          decision: {
            status: 'evidence-recorded-no-automatic-scheduler',
            policy: 'The timestamp campaign is evidence, not a frame-budget gate. Do not add a compact active-self scheduler solely from a ratio; compare the interleaved dormant-heavy result with the authenticated projection modes and exact-pair parity first.',
            aggregateBuildExcluded: true
          },
          allDormantAggregate: {
            materializeTimestampEvidence:
              allDormantAggregate.materializeTimestampEvidence,
            particleCount: allDormantAggregate.particleCount,
            spatialProjectionModeObserved:
              allDormantAggregate.spatialProjectionMode,
            activeRankViewEnabled:
              allDormantAggregate.activeRankViewEnabled,
            candidateVisitCount: allDormantAggregate.candidateVisitCount,
            projectedPeerVisitCount:
              allDormantAggregate.projectedPeerVisitCount,
            publishedDirectedPairCount:
              allDormantAggregate.publishedDirectedPairCount,
            aggregateDiagnostic: allDormantAggregate.aggregateDiagnostic ?? null,
            aggregateStructure: {
              sourceCount: allDormantAggregate.aggregateRecordSummary.sourceCount,
              leafCount: allDormantAggregate.aggregateRecordSummary.leafCount,
              totalRecordCount:
                allDormantAggregate.aggregateRecordSummary.totalRecordCount,
              emptyLeafCount:
                allDormantAggregate.aggregateRecordSummary.emptyLeafCount,
              root: {
                sourceMemberCount:
                  allDormantAggregate.aggregateRecordSummary.root
                    .sourceMemberCount,
                particleCount:
                  allDormantAggregate.aggregateRecordSummary.root.particleCount
              }
            },
            encodedComputePassCount:
              allDormantAggregate.encodedComputePassCount
          }
        };
      }

      await device.queue.onSubmittedWorkDone();
      proposalModule.destroySchroederSpatialMechanicalProposalRuntime(device);
      const scopeErrors = [];
      for (const label of ['out-of-memory', 'internal', 'validation']) {
        const error = await device.popErrorScope();
        if (error) scopeErrors.push(`${label}: ${error.message || String(error)}`);
      }
      const adapterInfo = typeof adapter.info === 'object'
        ? {
            vendor: adapter.info.vendor || null,
            architecture: adapter.info.architecture || null,
            device: adapter.info.device || null,
            description: adapter.info.description || null
          }
        : null;
      device.destroy?.();
      return {
        status: scopeErrors.length === 0 && uncapturedErrors.length === 0
          ? 'passed'
          : 'validation-failed',
        reason: [...scopeErrors, ...uncapturedErrors].join('\n') || null,
        adapterInfo,
        uncapturedErrors,
        scopeErrors,
        cases,
        failClosedCase,
        symmetricShellCase,
        denseIntegratedContact,
        denseIntegratedAggregateContact,
        denseIntegratedAggregateParity,
        phaseLaneFlatContact,
        phaseLaneAggregateContact,
        phaseLaneAggregateParity,
        allDormantPhaseContact,
        denseIntegratedRotatedContact,
        denseContactPerformance,
        mechanicalMaterializeTimestampCampaign
      };
    }, RUN_NATIVE_TIMESTAMPS);
  } finally {
    await browser.close();
  }

  if (native.status === 'unsupported') {
    t.skip(native.reason);
    return;
  }
  assert.equal(native.status, 'passed', native.reason || JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, []);
  assert.deepEqual(native.scopeErrors, []);
  assert.deepEqual(
    native.cases.map(({ name }) => name),
    [
      'unequal-mass-swept-cohort-crossing',
      'non-collinear-swept-face-normal',
      'deep-swept-cohort-crossing',
      'deep-swept-cohort-crossing-boosted-frame',
      'asymmetric-collinear-multi-contact-nonnegative-heat',
      'symmetric-cancellation-neutral-scale',
      'non-collinear-two-contact-residual',
      'marked-heavy-support-three-block-reservation',
      'supported-four-contact-bed-degree-bound'
    ]
  );
  assert.ok(native.cases.every(({ candidateVisitCount }) => candidateVisitCount > 0));
  assert.ok(native.cases.every(({ projectedPeerVisitCount }) => (
    projectedPeerVisitCount > 0
  )));
  assert.ok(native.cases.every(({ publishedDirectedPairCount }) => (
    publishedDirectedPairCount > 0
  )));
  const reservedSupportCase = native.cases.find(
    ({ name }) => name === 'marked-heavy-support-three-block-reservation'
  );
  assert.ok(reservedSupportCase);
  assert.equal(
    reservedSupportCase.matchingCleanupCertificate
      .maximumAppliedConstraintCount,
    2,
    JSON.stringify(reservedSupportCase)
  );
  assert.equal(
    reservedSupportCase.matchingCleanupCertificate
      .mixedThreeBlockAndFallbackPackingCertified,
    true
  );
  assert.ok(
    reservedSupportCase.approachResidualsMPerS.every(
      (value) => value >= -1.0e-5
    )
  );
  assert.equal(native.failClosedCase.name, 'corrupt-proposal-header-fail-closed');
  assert.equal(native.failClosedCase.evidenceStatus, 5);
  assert.equal(
    native.symmetricShellCase.name,
    'unequal-support-shell-symmetric-filter'
  );
  assert.ok(native.symmetricShellCase.candidateVisitCount > 0);
  assert.equal(native.symmetricShellCase.publishedDirectedPairCount, 0);
  t.diagnostic(
    `dense integrated Fe/ice contact: ${
      JSON.stringify(native.denseIntegratedContact)
    }`
  );
  assert.equal(
    native.denseIntegratedContact.graphAdmitted,
    true,
    `dense integrated Fe/ice graph failed closed: ${
      JSON.stringify(native.denseIntegratedContact)
    }`
  );
  assert.equal(native.denseIntegratedContact.graphFailClosed, false);
  assert.equal(native.denseIntegratedContact.graphFailureMask, 0);
  assert.equal(native.denseIntegratedContact.evidenceStatus, 3);
  assert.equal(native.denseIntegratedContact.particleCount, 152);
  assert.equal(native.denseIntegratedContact.phaseCounts['fe:liquid'], 27);
  assert.equal(native.denseIntegratedContact.phaseCounts['h2o:solid'], 125);
  assert.equal(
    native.denseIntegratedContact.manufacturedInterfacePairCount,
    36
  );
  assert.equal(
    native.denseIntegratedContact.interfaceReceiptSummary.positiveRowCount,
    72
  );
  assert.equal(
    native.denseIntegratedContact
      .interfaceReceiptSummary.uniquePositivePairCount,
    36
  );
  assert.ok(
    Math.abs(
      native.denseIntegratedContact
        .interfaceReceiptSummary.uniquePositiveFaceAreaM2
        - native.denseIntegratedContact
          .interfaceReceiptSummary.expectedUniquePositiveFaceAreaM2
    ) <= Math.max(
      1e-9,
      native.denseIntegratedContact
        .interfaceReceiptSummary.expectedUniquePositiveFaceAreaM2
        * 1e-5
    )
  );
  assert.equal(native.denseIntegratedContact.rowCounts.validation, 152);
  assert.equal(native.denseIntegratedContact.rowCounts.verification, 152);
  assert.equal(native.denseIntegratedContact.rowCounts.publication, 152);
  assert.ok(native.denseIntegratedContact.pairCounts.publishedDirectedPairCount > 0);
  assert.equal(
    native.denseIntegratedContact.sourceDegree.csrTerminator,
    native.denseIntegratedContact.pairCounts.publishedDirectedPairCount
  );
  assert.ok(
    native.denseIntegratedContact.residual.maxPositionM
      <= 0.02 * 0.2 + 2.0e-5
  );
  assert.ok(
    native.denseIntegratedContact.residual.maxVelocityMPerS <= 1.1e-3
  );
  assert.ok(
    native.denseIntegratedContact.energy.residualJ
      <= native.denseIntegratedContact.energy.toleranceJ
  );
  t.diagnostic(
    `aggregate dense integrated Fe/ice contact: ${
      JSON.stringify(native.denseIntegratedAggregateContact)
    }`
  );
  assert.equal(native.denseIntegratedAggregateContact.graphAdmitted, true);
  assert.equal(native.denseIntegratedAggregateContact.graphFailClosed, false);
  assert.equal(native.denseIntegratedAggregateContact.graphFailureMask, 0);
  assert.equal(native.denseIntegratedAggregateContact.evidenceStatus, 3);
  assert.equal(
    native.denseIntegratedAggregateContact.aggregateHierarchyEnabled,
    true
  );
  assert.equal(
    native.denseIntegratedAggregateContact.aggregateAdmissionStatus,
    'schroeder-spatial-aggregate-view-admitted'
  );
  assert.deepEqual(
    native.denseIntegratedAggregateContact.pairCounts,
    native.denseIntegratedContact.pairCounts
  );
  assert.deepEqual(
    native.denseIntegratedAggregateContact.rowCounts,
    native.denseIntegratedContact.rowCounts
  );
  assert.ok(
    native.denseIntegratedAggregateContact.candidateVisitCount
      < native.denseIntegratedContact.candidateVisitCount
  );
  assert.ok(
    native.denseIntegratedAggregateContact.projectedPeerVisitCount
      <= native.denseIntegratedAggregateContact.candidateVisitCount
  );
  assert.equal(
    native.denseIntegratedAggregateContact.sourceDegree.csrTerminator,
    native.denseIntegratedContact.sourceDegree.csrTerminator
  );
  assert.equal(
    native.denseIntegratedAggregateContact.aggregateDiagnostic
      .summaryPhaseMismatchCount,
    0
  );
  assert.equal(
    native.denseIntegratedAggregateContact.aggregateDiagnostic
      .summaryPreflightCount,
    native.denseIntegratedAggregateContact.particleCount
  );
  assert.equal(
    native.denseIntegratedAggregateContact.aggregateDiagnostic
      .lineageMaterialMismatchCount,
    0
  );
  assert.equal(
    native.denseIntegratedAggregateContact.aggregateDiagnostic.sourceCount,
    native.denseIntegratedAggregateContact.particleCount
  );
  assert.ok(
    native.denseIntegratedAggregateContact.aggregateDiagnostic.nodeVisitCount
      > native.denseIntegratedAggregateContact.particleCount
  );
  assert.ok(
    native.denseIntegratedAggregateContact.aggregateDiagnostic.prunedNodeCount
      > 0
  );
  assert.ok(
    native.denseIntegratedAggregateContact.residual.maxPositionM
      <= 0.02 * 0.2 + 2.0e-5
  );
  assert.ok(
    native.denseIntegratedAggregateContact.residual.maxVelocityMPerS <= 1.1e-3
  );
  assert.ok(
    native.denseIntegratedAggregateContact.energy.residualJ
      <= native.denseIntegratedAggregateContact.energy.toleranceJ
  );
  assert.equal(
    native.denseIntegratedAggregateParity.sourceOffsetCount,
    native.denseIntegratedAggregateContact.particleCount + 1
  );
  assert.equal(
    native.denseIntegratedAggregateParity.directedPeerCount,
    native.denseIntegratedAggregateContact.pairCounts.publishedDirectedPairCount
  );
  assert.ok(
    native.denseIntegratedAggregateParity.maxNormalizedStateDelta <= 1
  );
  t.diagnostic(
    `phase-lane flat contact: ${JSON.stringify(native.phaseLaneFlatContact)}`
  );
  t.diagnostic(
    `phase-lane aggregate contact: ${
      JSON.stringify(native.phaseLaneAggregateContact)
    }`
  );
  t.diagnostic(
    `all-dormant active-rank contact: ${
      JSON.stringify(native.allDormantPhaseContact)
    }`
  );
  assert.equal(native.phaseLaneFlatContact.graphAdmitted, true);
  assert.equal(native.phaseLaneFlatContact.graphFailureMask, 0);
  assert.equal(native.phaseLaneAggregateContact.graphAdmitted, true);
  assert.equal(native.phaseLaneAggregateContact.graphFailureMask, 0);
  assert.equal(native.phaseLaneAggregateContact.aggregateHierarchyEnabled, true);
  assert.equal(native.phaseLaneAggregateContact.particleCount, 8);
  assert.equal(
    native.phaseLaneAggregateContact.aggregateDiagnostic.summaryPreflightCount,
    8
  );
  assert.equal(
    native.phaseLaneAggregateContact.aggregateDiagnostic.sourceCount,
    2
  );
  assert.equal(native.phaseLaneAggregateParity.sourceOffsetCount, 9);
  assert.equal(native.phaseLaneAggregateParity.rootActiveParticleCount, 2);
  assert.equal(native.phaseLaneAggregateParity.rootSourceMemberCount, 8);
  assert.ok(native.phaseLaneAggregateParity.emptyLeafCount > 0);
  assert.equal(native.allDormantPhaseContact.graphAdmitted, true);
  assert.equal(native.allDormantPhaseContact.graphFailureMask, 0);
  assert.equal(native.allDormantPhaseContact.candidateVisitCount, 0);
  assert.equal(native.allDormantPhaseContact.projectedPeerVisitCount, 0);
  assert.equal(native.allDormantPhaseContact.publishedDirectedPairCount, 0);
  assert.equal(
    native.allDormantPhaseContact.activeRankViewSummary.activeRankCount,
    0
  );
  assert.equal(
    native.allDormantPhaseContact.activeRankViewSummary.dormantRankCount,
    8
  );
  t.diagnostic(
    `rotated dense integrated Fe/ice contact: ${
      JSON.stringify(native.denseIntegratedRotatedContact)
    }`
  );
  assert.equal(native.denseIntegratedRotatedContact.graphAdmitted, true);
  assert.equal(native.denseIntegratedRotatedContact.graphFailClosed, false);
  assert.equal(native.denseIntegratedRotatedContact.graphFailureMask, 0);
  assert.equal(native.denseIntegratedRotatedContact.evidenceStatus, 3);
  assert.equal(native.denseIntegratedRotatedContact.rotationDegrees, 15);
  assert.equal(
    native.denseIntegratedRotatedContact.manufacturedInterfacePairCount,
    36
  );
  assert.equal(native.denseIntegratedRotatedContact.rowCounts.publication, 152);
  assert.ok(
    native.denseIntegratedRotatedContact.residual.maxPositionM
      <= 0.02 * 0.2 + 2.0e-5
  );
  assert.ok(
    native.denseIntegratedRotatedContact.residual.maxVelocityMPerS <= 1.1e-3
  );
  assert.ok(
    native.denseIntegratedRotatedContact.energy.residualJ
      <= native.denseIntegratedRotatedContact.energy.toleranceJ
  );
  assert.equal(native.denseContactPerformance.particleCount, 152);
  assert.equal(native.denseContactPerformance.degree, 151);
  assert.equal(native.denseContactPerformance.directedPairCount, 22_952);
  assert.equal(native.denseContactPerformance.particleTerminator, 22_952);
  assert.equal(native.denseContactPerformance.capacityTerminator, 22_952);
  assert.equal(native.denseContactPerformance.measuredDurationsMs.length, 9);
  assert.ok(native.denseContactPerformance.measuredPoolCacheHits.every(Boolean));
  assert.ok(
    native.denseContactPerformance.p95Ms
      <= native.denseContactPerformance.p95BudgetMs
  );
  assert.ok(
    native.denseContactPerformance.maxMs
      <= native.denseContactPerformance.maxBudgetMs
  );
  t.diagnostic(
    `dense canonical contact: ${JSON.stringify(native.denseContactPerformance)}`
  );
  if (RUN_NATIVE_TIMESTAMPS) {
    const campaign = native.mechanicalMaterializeTimestampCampaign;
    assert.equal(campaign?.schema,
      'peercompute.ulg.sph-native-mechanical-materialize-timestamp-campaign.v1');
    assert.equal(campaign?.status, 'complete');
    assert.equal(campaign?.timestampUnit, 'nanoseconds');
    assert.equal(campaign?.warmupCount, 3);
    assert.equal(campaign?.measuredSampleCount, 9);
    assert.equal(campaign?.pairedArms?.length, 3);
    assert.deepEqual(
      campaign.pairedArms.map(({ fixtureClass }) => fixtureClass),
      [
        'sparse-two-body',
        'dense-fe-ice-interface',
        'dormant-heavy-phase-lanes'
      ]
    );
    assert.equal(
      campaign?.decision?.status,
      'evidence-recorded-no-automatic-scheduler'
    );
    for (const pair of campaign.pairedArms) {
      assert.equal(pair.flat.instrumentation.passGrouping,
        'instrumented-dispatch-granular');
      assert.equal(pair.aggregate.instrumentation.passGrouping,
        'instrumented-dispatch-granular');
      assert.equal(pair.flat.instrumentation.sameProductionCommandEncoder, true);
      assert.equal(
        pair.flat.instrumentation.productionBuildPassSplitForTimestamp,
        true
      );
      assert.equal(pair.aggregate.instrumentation.sameProductionCommandEncoder, true);
      assert.equal(
        pair.aggregate.instrumentation.productionBuildPassSplitForTimestamp,
        true
      );
      assert.equal(pair.flat.encodedComputePassCount, 153);
      assert.equal(pair.aggregate.encodedComputePassCount, 153);
      assert.equal(pair.flat.warmupMaterializeNs.length, 3);
      assert.equal(pair.aggregate.warmupMaterializeNs.length, 3);
      assert.equal(pair.flat.measuredMaterializeNs.length, 9);
      assert.equal(pair.aggregate.measuredMaterializeNs.length, 9);
      assert.equal(pair.flat.measuredMaterializeMs.length, 9);
      assert.equal(pair.aggregate.measuredMaterializeMs.length, 9);
      assert.ok(
        pair.flat.spatialProjectionModeObserved === 'flat'
          || pair.flat.spatialProjectionModeObserved === 'active-rank'
      );
      assert.equal(
        pair.flat.activeRankViewEnabled,
        pair.flat.spatialProjectionModeObserved === 'active-rank'
      );
      assert.equal(pair.aggregate.spatialProjectionModeObserved, 'aggregate');
      assert.equal(pair.aggregate.activeRankViewEnabled, false);
      assert.ok(pair.flat.warmupMaterializeNs.every((value) => value > 0));
      assert.ok(pair.aggregate.warmupMaterializeNs.every((value) => value > 0));
      assert.ok(pair.flat.measuredMaterializeNs.every((value) => value > 0));
      assert.ok(pair.aggregate.measuredMaterializeNs.every((value) => value > 0));
      assert.ok(pair.flat.measuredMaterializeMs.every((value) => value > 0));
      assert.ok(pair.aggregate.measuredMaterializeMs.every((value) => value > 0));
      assert.ok(pair.flat.proposalPoolCacheHits.every(Boolean));
      assert.ok(pair.aggregate.proposalPoolCacheHits.every(Boolean));
      assert.equal(
        pair.flat.publishedDirectedPairCount,
        pair.aggregate.publishedDirectedPairCount
      );
      assert.equal(
        pair.pairedAggregateMinusMaterializeNs.length,
        campaign.measuredSampleCount
      );
      assert.ok(Number.isFinite(pair.aggregateToFlatP50Ratio));
      assert.ok(pair.aggregateToFlatP50Ratio > 0);
    }
    const dormantHeavyPair = campaign.pairedArms.at(-1);
    assert.equal(dormantHeavyPair.flat.particleCount, 1024);
    assert.equal(dormantHeavyPair.aggregate.particleCount, 1024);
    assert.equal(dormantHeavyPair.flat.activeParticleCount, 2);
    assert.equal(dormantHeavyPair.aggregate.activeParticleCount, 2);
    assert.equal(dormantHeavyPair.flat.dormantParticleCount, 1022);
    assert.equal(dormantHeavyPair.aggregate.dormantParticleCount, 1022);
    assert.equal(dormantHeavyPair.flat.spatialProjectionModeObserved, 'active-rank');
    assert.equal(dormantHeavyPair.flat.activeRankViewEnabled, true);
    assert.deepEqual(campaign.dormantHeavyAggregateStructure, {
      sourceCount: 1024,
      attemptedSourceCount: 1024,
      reducedSourceCount: 1024,
      leafCount: 1024,
      totalRecordCount: 2047,
      emptyLeafCount: 1022,
      root: {
        sourceMemberCount: 1024,
        particleCount: 2
      }
    });
    assert.equal(
      campaign.allDormantAggregate.materializeTimestampEvidence.status,
      'complete'
    );
    assert.equal(campaign.allDormantAggregate.particleCount, 1024);
    assert.equal(
      campaign.allDormantAggregate.spatialProjectionModeObserved,
      'aggregate'
    );
    assert.equal(campaign.allDormantAggregate.activeRankViewEnabled, false);
    assert.equal(campaign.allDormantAggregate.candidateVisitCount, 0);
    assert.equal(campaign.allDormantAggregate.projectedPeerVisitCount, 0);
    assert.equal(campaign.allDormantAggregate.publishedDirectedPairCount, 0);
    assert.equal(campaign.allDormantAggregate.encodedComputePassCount, 153);
    assert.deepEqual(campaign.allDormantAggregate.aggregateStructure, {
      sourceCount: 1024,
      leafCount: 1024,
      totalRecordCount: 2047,
      emptyLeafCount: 1024,
      root: {
        sourceMemberCount: 1024,
        particleCount: 0
      }
    });
    t.diagnostic(
      `mechanical materialize GPU timestamps: ${JSON.stringify(campaign)}`
    );
  } else {
    assert.equal(native.mechanicalMaterializeTimestampCampaign, null);
  }
});
