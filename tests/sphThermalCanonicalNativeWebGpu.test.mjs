import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE_TREE = process.env.ULG_RUN_NATIVE_THERMAL_TREE === '1';
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_THERMAL === '1'
  || RUN_NATIVE_TREE;
const BASE_URL = process.env.ULG_THERMAL_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_THERMAL_CHROME
  || '/usr/bin/google-chrome';

test('native Vulkan thermal v2 producer and canonical apply keep latent carriers bounded and reciprocal', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_THERMAL=1 for native Vulkan WebGPU',
  timeout: RUN_NATIVE_TREE ? 900_000 : 300_000
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
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async ({ runNativeTreeShadow }) => {
      const fail = (message) => {
        throw new Error(message);
      };
      const requireTrue = (condition, message) => {
        if (!condition) fail(message);
      };
      const finite = (value) => Number.isFinite(Number(value));
      const f32 = Math.fround;
      const previousF32 = (value) => {
        const rounded = f32(value);
        requireTrue(Number.isFinite(rounded), `cannot step below non-finite f32 ${value}`);
        if (Object.is(rounded, -Infinity)) return rounded;
        if (Object.is(rounded, 0) || Object.is(rounded, -0)) {
          return -new Float32Array(new Uint32Array([1]).buffer)[0];
        }
        const words = new Uint32Array(new Float32Array([rounded]).buffer);
        words[0] += rounded > 0 ? -1 : 1;
        return new Float32Array(words.buffer)[0];
      };
      const nextF32 = (value) => {
        const rounded = f32(value);
        requireTrue(Number.isFinite(rounded), `cannot step above non-finite f32 ${value}`);
        if (Object.is(rounded, Infinity)) return rounded;
        if (Object.is(rounded, 0) || Object.is(rounded, -0)) {
          return new Float32Array(new Uint32Array([1]).buffer)[0];
        }
        const words = new Uint32Array(new Float32Array([rounded]).buffer);
        words[0] += rounded > 0 ? 1 : -1;
        return new Float32Array(words.buffer)[0];
      };
      const near = (actual, expected, absolute = 1.0e-3, relative = 2.0e-6) => (
        finite(actual)
        && finite(expected)
        && Math.abs(actual - expected)
          <= Math.max(absolute, Math.abs(expected) * relative)
      );

      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      if (
        runNativeTreeShadow
        && !adapter.features?.has?.('timestamp-query')
      ) {
        return {
          status: 'unsupported',
          reason: 'timestamp-query is required for the thermal tree campaign'
        };
      }
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter, {
          timestampProfilingRequested: runNativeTreeShadow
        })
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      const thermalUrl = '/src/runtime/sph/sphThermalGpuKernel.js';
      const thermalSource = await fetch(thermalUrl).then((response) => {
        if (!response.ok) fail(`thermal module fetch failed: ${response.status}`);
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
      const proposalUrl = dependencyUrl(
        [{ source: thermalSource, url: thermalUrl }],
        '/schroederSpatialThermalProposalsGpu.js'
      );
      const proposalSource = await fetch(proposalUrl).then((response) => {
        if (!response.ok) fail(`thermal proposal module fetch failed: ${response.status}`);
        return response.text();
      });
      const spatialUrl = dependencyUrl([
        { source: proposalSource, url: proposalUrl },
        { source: thermalSource, url: thermalUrl }
      ], '/schroederSpatialEpochGpu.js');
      const spatialSource = await fetch(spatialUrl).then((response) => {
        if (!response.ok) fail(`spatial epoch module fetch failed: ${response.status}`);
        return response.text();
      });
      const buffersUrl = dependencyUrl(
        [{ source: thermalSource, url: thermalUrl }],
        '/sphGpuBuffers.js'
      );
      const identityUrl = dependencyUrl([
        { source: thermalSource, url: thermalUrl },
        { source: proposalSource, url: proposalUrl },
        { source: spatialSource, url: spatialUrl }
      ], '/sphGpuDeviceIdentity.js');
      const transactionUrl = dependencyUrl(
        [{ source: proposalSource, url: proposalUrl }],
        '/schroederSpatialEpochTransaction.js'
      );
      const binAuthorityUrl = dependencyUrl(
        [{ source: proposalSource, url: proposalUrl }],
        '/sphPostSeparationThermalBinAuthority.js'
      );
      const [
        thermal,
        proposalModule,
        spatial,
        gpuBuffers,
        identity,
        transactionModule,
        binAuthorityModule,
        closuresModule,
        thermoState,
        sphStateModule
      ] = await Promise.all([
        import(thermalUrl),
        import(proposalUrl),
        import(spatialUrl),
        import(buffersUrl),
        import(identityUrl),
        import(transactionUrl),
        import(binAuthorityUrl),
        import('/src/runtime/material/materialClosures.js'),
        import('/src/runtime/material/thermoState.js'),
        import('/src/runtime/sph/sphState.js')
      ]);

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
      const median = (values) => {
        const sorted = values
          .map(Number)
          .filter(Number.isFinite)
          .sort((left, right) => left - right);
        requireTrue(sorted.length > 0, 'median requires finite samples');
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 1
          ? sorted[middle]
          : 0.5 * (sorted[middle - 1] + sorted[middle]);
      };
      const createTimestampRecorder = (label, stages) => {
        const expectedStages = [...new Set(stages)];
        requireTrue(
          expectedStages.length > 0,
          `${label}: timestamp recorder requires stages`
        );
        const queryCount = expectedStages.length * 2;
        const querySet = device.createQuerySet({
          label: `${label}-queries`,
          type: 'timestamp',
          count: queryCount
        });
        const resolveBuffer = device.createBuffer({
          label: `${label}-resolve`,
          size: queryCount * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        const readbackBuffer = device.createBuffer({
          label: `${label}-readback`,
          size: queryCount * BigUint64Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const tokens = [];
        return {
          recorder: {
            active: true,
            beginEncoderSpan(encoder, descriptor = {}) {
              if (!expectedStages.includes(descriptor.stage)) return null;
              const token = {
                encoder,
                descriptor,
                queryIndex: tokens.length * 2,
                ended: false
              };
              requireTrue(
                token.queryIndex + 1 < queryCount,
                `${label}: too many timestamp spans`
              );
              encoder.writeTimestamp(querySet, token.queryIndex);
              tokens.push(token);
              return token;
            },
            endEncoderSpan(encoder, token) {
              requireTrue(
                token?.encoder === encoder && token.ended === false,
                `${label}: timestamp end did not match begin`
              );
              encoder.writeTimestamp(querySet, token.queryIndex + 1);
              token.ended = true;
            }
          },
          async complete() {
            requireTrue(
              tokens.length === expectedStages.length
                && tokens.every((token) => token.ended)
                && expectedStages.every((stage) => tokens.some(
                  (token) => token.descriptor.stage === stage
                )),
              `${label}: missing expected timestamp span: ${
                JSON.stringify(tokens.map(({ descriptor }) => descriptor.stage))
              }`
            );
            const encoder = device.createCommandEncoder({
              label: `${label}-resolve-encoder`
            });
            encoder.resolveQuerySet(
              querySet,
              0,
              queryCount,
              resolveBuffer,
              0
            );
            encoder.copyBufferToBuffer(
              resolveBuffer,
              0,
              readbackBuffer,
              0,
              queryCount * BigUint64Array.BYTES_PER_ELEMENT
            );
            device.queue.submit([encoder.finish()]);
            await readbackBuffer.mapAsync(
              GPUMapMode.READ,
              0,
              queryCount * BigUint64Array.BYTES_PER_ELEMENT
            );
            const values = new BigUint64Array(
              readbackBuffer.getMappedRange(
                0,
                queryCount * BigUint64Array.BYTES_PER_ELEMENT
              ).slice(0)
            );
            readbackBuffer.unmap();
            const result = {};
            for (const token of tokens) {
              const start = values[token.queryIndex];
              const end = values[token.queryIndex + 1];
              requireTrue(
                end > start
                  && end - start <= BigInt(Number.MAX_SAFE_INTEGER),
                `${label}: non-monotonic timestamp for ${
                  token.descriptor.stage
                }`
              );
              result[token.descriptor.stage] =
                Number(end - start) / 1e6;
            }
            return result;
          },
          destroy() {
            querySet.destroy();
            resolveBuffer.destroy();
            readbackBuffer.destroy();
          }
        };
      };
      const responseDomain = (table, materialId, specificEnergy) => (
        thermal.resolveThermalCarrierEnergyDomainFromTable(
          table,
          materialId,
          specificEnergy
        )
      );
      const totalEnergyJ = (state) => {
        let total = 0;
        for (let index = 0; index < state.length / 8; index += 1) {
          total += state[index * 8 + 3] * state[index * 8 + 7];
        }
        return total;
      };
      const phaseMassKg = (state, thermo, materialId) => {
        const totals = { solid: 0, liquid: 0, gas: 0, plasma: 0 };
        for (let index = 0; index < state.length / 8; index += 1) {
          const stateOffset = index * 8;
          const thermoOffset = index * 12;
          const massKg = state[stateOffset + 3];
          if (!(massKg > 0) || thermo[thermoOffset] !== materialId) continue;
          totals.solid += massKg * thermo[thermoOffset + 4];
          totals.liquid += massKg * thermo[thermoOffset + 5];
          totals.gas += massKg * thermo[thermoOffset + 6];
          totals.plasma += massKg * thermo[thermoOffset + 7];
        }
        return totals;
      };

      const closures = closuresModule.createReferenceMaterialClosures();
      const materialProperties = {
        h2o: closures.h2o.properties,
        fe: closures.fe.properties
      };
      const thermalMaterialTable = thermal.buildSphThermalMaterialTable(
        materialProperties
      );
      const graphSet = thermal.buildSphThermalClosureGraphBuffers(
        thermalMaterialTable
      );
      const phaseResponseTable = thermal.buildSphThermalPhaseResponseTable(
        thermalMaterialTable,
        graphSet
      );
      // This fixture isolates the closed-system conduction contract. Pair
      // radiation is disabled at its generic material response input rather
      // than by changing either production shader.
      for (
        let offset = 0;
        offset < phaseResponseTable.records.length;
        offset += phaseResponseTable.recordStrideFloats
      ) {
        phaseResponseTable.records[offset + 4] = 0;
      }
      const responseUpload = thermal.uploadSphThermalResponseGraphBuffers(device, {
        thermalMaterialTable,
        thermalClosureGraphSet: graphSet,
        thermalClosureGraphBank: graphSet.graphBank,
        thermalPhaseResponseTable: phaseResponseTable
      });
      const boilingPlateau = thermalMaterialTable.segmentMetadata.find(
        (segment) => (
          segment.material === 'h2o'
          && segment.type === 'plateau'
          && segment.from === 'liquid'
          && segment.to === 'gas'
        )
      );
      requireTrue(Boolean(boilingPlateau), 'H2O boiling plateau is unavailable');
      const boilingGasPhase = thermalMaterialTable.segmentMetadata.find(
        (segment) => (
          segment.material === 'h2o'
          && segment.type === 'phase'
          && segment.phase === 'gas'
        )
      );
      requireTrue(
        Boolean(boilingGasPhase)
          && f32(boilingPlateau.eEnd) === f32(boilingGasPhase.eStart),
        'H2O boiling plateau and gas response do not share an exact f32 knot'
      );
      const boilingMidpointU = 0.5
        * (boilingPlateau.eStart + boilingPlateau.eEnd);
      const boilingGasKnotU = boilingPlateau.eEnd;
      const fusionPlateau = thermalMaterialTable.segmentMetadata.find(
        (segment) => (
          segment.material === 'h2o'
          && segment.type === 'plateau'
          && segment.from === 'solid'
          && segment.to === 'liquid'
        )
      );
      requireTrue(Boolean(fusionPlateau), 'H2O fusion plateau is unavailable');
      const fusionKnotU = f32(fusionPlateau.eStart);
      const oneUlpBelowFusionU = previousF32(fusionKnotU);
      requireTrue(
        oneUlpBelowFusionU < fusionKnotU
          && nextF32(oneUlpBelowFusionU) === fusionKnotU,
        `H2O fusion fixture is not one f32 ULP below ${fusionKnotU}`
      );
      const ironHotU = thermoState.specificInternalEnergyJPerKg(
        materialProperties.fe,
        1200
      );
      const ironColdU = thermoState.specificInternalEnergyJPerKg(
        materialProperties.fe,
        240
      );
      const productionIronHotU = thermoState.specificInternalEnergyJPerKg(
        materialProperties.fe,
        1850
      );
      const productionIceColdU = thermoState.specificInternalEnergyJPerKg(
        materialProperties.h2o,
        233.15
      );
      const productionPitchM = 0.2;
      const productionSmoothingLengthM = 0.24814;
      const productionIronMassKg = 55.84;
      const productionIceMassKg = 7.336;
      let epochOrdinal = 0;

      const runFixture = async ({
        name,
        particles,
        requireCentralHeating = false,
        smoothingLengthM = 0.1,
        spatialCellSizeM = 0.1,
        nativeGridSpacingM = spatialCellSizeM,
        dtS = 0.1,
        conductionRate = 1500,
        fusionIngress = false,
        exactTouchPlane = false,
        currentPositions = null,
        currentMasses = null,
        currentSpecificEnergies = null,
        cpuStateStale = false,
        corruptActiveProjection = null,
        expectProducerFailClosed = false,
        corruptTreeWord = null,
        expectTreeFailClosed = false,
        expectCandidateCsrFallback = false,
        expectCandidateCsrRoute = null,
        includePairLedgerInResult = true,
        requireThermalExchange = true,
        useAggregate = true,
        useActiveRank = false,
        producerTraversal = 'direct',
        observeTreeTraversalCounters = true,
        includeAppliedRowsInResult = false,
        particleLevels = null,
        sameGenerationTreeShadow = false,
        sameGenerationExhaustiveShadow = false
      }) => {
        requireTrue(
          !(useAggregate && useActiveRank),
          `${name}: aggregate and base active-rank projections are mutually exclusive`
        );
        requireTrue(
          producerTraversal === 'direct'
            || producerTraversal === 'native-test-tree-shadow',
          `${name}: unsupported producer traversal ${producerTraversal}`
        );
        requireTrue(
          !sameGenerationTreeShadow || producerTraversal === 'direct',
          `${name}: same-generation tree comparator requires the direct control arm`
        );
        requireTrue(
          !sameGenerationExhaustiveShadow || producerTraversal === 'direct',
          `${name}: same-generation exhaustive comparator requires the direct control arm`
        );
        const resolvedParticleLevels = particleLevels
          ? [...particleLevels]
          : Array.from({ length: particles.length }, () => 0);
        requireTrue(
          resolvedParticleLevels.length === particles.length
            && resolvedParticleLevels.every((level) => (
              Number.isInteger(level) && level >= -30 && level <= 30
            )),
          `${name}: particle levels do not match the source rows`
        );
        const minimumParticleLevel = Math.min(...resolvedParticleLevels);
        const maximumParticleLevel = Math.max(...resolvedParticleLevels);
        const expectedFailClosed = expectProducerFailClosed
          || expectTreeFailClosed;
        epochOrdinal += 1;
        const source = sphStateModule.createSphState({
          smoothingLengthM,
          dimension: 3,
          step: epochOrdinal,
          particles
        });
        const packed = gpuBuffers.buildSphGpuParticleBuffers(source, {
          materialProperties
        });
        const currentState = new Float32Array(packed.state);
        if (currentPositions) {
          requireTrue(
            currentPositions.length === packed.particleCount,
            `${name}: current-position row count mismatch`
          );
          for (let index = 0; index < currentPositions.length; index += 1) {
            const position = currentPositions[index];
            requireTrue(
              Array.isArray(position)
                && position.length === 3
                && position.every(finite),
              `${name}: current position ${index} is invalid`
            );
            currentState.set(position, index * 8);
          }
        }
        if (currentMasses) {
          requireTrue(
            currentMasses.length === packed.particleCount
              && currentMasses.every((massKg) => finite(massKg) && massKg >= 0),
            `${name}: current-mass row count or value is invalid`
          );
          for (let index = 0; index < currentMasses.length; index += 1) {
            currentState[index * 8 + 3] = currentMasses[index];
          }
        }
        if (currentSpecificEnergies) {
          requireTrue(
            currentSpecificEnergies.length === packed.particleCount
              && currentSpecificEnergies.every((energy) => finite(energy) && energy >= 0),
            `${name}: current-specific-energy row count or value is invalid`
          );
          for (let index = 0; index < currentSpecificEnergies.length; index += 1) {
            currentState[index * 8 + 7] = currentSpecificEnergies[index];
          }
        }
        // The optional CSR selection sees this CPU object, while the proposal
        // itself always reads the retained GPU buffer.  Keep the two distinct
        // here so a GPU-resident continuation with an obsolete CPU mirror can
        // be tested without weakening the matched-time source contract.
        const proposalCpuState = cpuStateStale
          ? { ...packed, cpuStateStale: true }
          : packed;
        const proposalSourceState = currentSpecificEnergies
          ? currentState
          : packed.state;
        if (requireCentralHeating) {
          requireTrue(
            packed.thermo[1] === 3
              && packed.thermo[4] === 0
              && packed.thermo[5] === 0
              && packed.thermo[6] === 1
              && packed.thermo[7] === 0,
            `${name}: shared-knot carrier was not packed as pure gas`
          );
        }
        if (fusionIngress) {
          requireTrue(
            packed.state[7] === oneUlpBelowFusionU,
            `${name}: central U ${packed.state[7]} is not one f32 ULP below fusion ${fusionKnotU}`
          );
          requireTrue(
            packed.thermo[1] === 1
              && packed.thermo[4] === 1
              && packed.thermo[5] === 0
              && packed.thermo[6] === 0
              && packed.thermo[7] === 0,
            `${name}: boundary carrier was not packed as pure solid H2O`
          );
        }
        if (exactTouchPlane) {
          requireTrue(
            particles.every((particle) => particle.v.every((component) => component === 0)),
            `${name}: exact-touch fixture must be mechanically frozen`
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
        const particleUpload = gpuBuffers.uploadSphGpuParticleBuffers(
          device,
          packed
        );
        Object.assign(particleUpload, epoch, {
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1
        });
        if (currentSpecificEnergies) {
          device.queue.writeBuffer(particleUpload.stateBuffer, 0, currentState);
        }

        const activeRows = new Float32Array(packed.particleCount * 16);
        for (let index = 0; index < packed.particleCount; index += 1) {
          const stateOffset = index * 8;
          const x = packed.state[stateOffset];
          const y = packed.state[stateOffset + 1];
          const z = packed.state[stateOffset + 2];
          const level = resolvedParticleLevels[index];
          const levelSpacingM = spatialCellSizeM * (2 ** level);
          const cellX = Math.floor(x / levelSpacingM);
          const cellY = Math.floor(y / levelSpacingM);
          const cellZ = Math.floor(z / levelSpacingM);
          activeRows.set([
            level, cellX, cellY, cellZ,
            cellX, cellY, cellZ, levelSpacingM,
            nativeGridSpacingM, 2 * smoothingLengthM, index, 1,
            x, y, z, 0
          ], index * 16);
        }
        const activeNodeBuffer = createTaggedBuffer(
          `ulg-native-thermal-${name}-active-nodes`,
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
          sourceStateBuffer: particleUpload.stateBuffer,
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
          spatialEpochMinLevel: minimumParticleLevel,
          spatialEpochMaxLevel: maximumParticleLevel,
          spatialEpochBaseGridSpacingM: spatialCellSizeM,
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
        if (useActiveRank) {
          const assignmentRows = new Float32Array(packed.particleCount * 16);
          for (let index = 0; index < packed.particleCount; index += 1) {
            const stateOffset = index * 8;
            const thermoOffset = index * 12;
            const level = resolvedParticleLevels[index];
            const levelSpacingM = spatialCellSizeM * (2 ** level);
            const massKg = packed.state[stateOffset + 3];
            const restDensityKgPerM3 = packed.thermo[thermoOffset + 3];
            const active = massKg > 0;
            const volumeM3 = active
              ? Math.max(1.0e-12, massKg / Math.max(restDensityKgPerM3, 1))
              : 0;
            assignmentRows.set([
              level,
              levelSpacingM,
              active ? 2 * smoothingLengthM : 0,
              active ? volumeM3 : 0,
              active ? volumeM3 : 0,
              active ? volumeM3 : 0,
              massKg,
              restDensityKgPerM3,
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
            `ulg-native-thermal-${name}-level-assignment`,
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
            sourceStateBuffer: particleUpload.stateBuffer,
            sourceStateBufferBorrowed: true,
            minLevel: minimumParticleLevel,
            maxLevel: maximumParticleLevel,
            chartId: 0,
            baseGridSpacingM: spatialCellSizeM,
            phaseVolumeAssignmentOverlayEnabled: false,
            ...epoch
          };
        }
        let generation = null;
        let proposal = null;
        let canonicalThermalStage = null;
        let currentStateBuffer = null;
        let classicBinsBuffer = null;
        let classicBinAuthority = null;
        let transactionMechanicsBuffer = null;
        let treeShadowReceipt = null;
        let sameGenerationTreeParity = null;
        let sameGenerationExhaustiveParity = null;
        try {
          generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
            device,
            ...(useActiveRank ? { levelAssignment } : { activeNodeList }),
            particleCount: packed.particleCount,
            particleIdentityBuffer: particleUpload.identityBuffer,
            particleIdentityStrideWords: 1,
            particleBufferSet: useAggregate ? particleUpload : null,
            laneId: `native-thermal-${name}`,
            sourceFamily: `native-thermal-${name}`,
            mechanicsLevels: []
          });
          requireTrue(
            generation.ready === true && generation.selected === true,
            `${name}: spatial generation rejected: ${generation.status}: ${
              generation.reason || 'no reason'
            }`
          );
          requireTrue(
            useAggregate
              ? generation.aggregateView != null
              : generation.aggregateView == null,
            `${name}: aggregate presence did not match aggregate=${useAggregate}`
          );
          requireTrue(
            useActiveRank
              ? generation.activeRankView != null
              : generation.activeRankView == null,
            `${name}: base active-rank view presence did not match activeRank=${useActiveRank}`
          );
          transactionMechanicsBuffer = createTaggedBuffer(
            `ulg-native-thermal-${name}-transaction-mechanics`,
            new Float32Array(packed.particleCount * 24),
            GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          );
          const mlsMpmParticleUpload = {
            mechanicsBuffer: transactionMechanicsBuffer
          };
          currentStateBuffer = currentPositions || currentMasses
            ? createTaggedBuffer(
                `ulg-native-thermal-${name}-current-state`,
                currentState,
                GPUBufferUsage.STORAGE
                  | GPUBufferUsage.COPY_SRC
                  | GPUBufferUsage.COPY_DST
              )
            : particleUpload.stateBuffer;
          const consumerSupportProfileIds = Object.fromEntries(
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map((consumer) => [
              consumer.consumerId,
              consumer.supportProfileId
            ])
          );
          const schroederSpatialEpochTransaction = transactionModule
            .createSchroederSpatialEpochTransaction({
              device,
              generation,
              sphParticleUpload: particleUpload,
              mlsMpmParticleUpload,
              requiredReaderIds: [],
              enabledConsumerReaderIds: Object.keys(consumerSupportProfileIds),
              consumerSupportProfileIds
            });
          requireTrue(
            transactionModule.validateSchroederSpatialEpochTransactionSourceFamily(
              schroederSpatialEpochTransaction,
              {
                generation,
                sphParticleUpload: particleUpload,
                mlsMpmParticleUpload
              }
            ) === true,
            `${name}: transaction source validation failed immediately: ${JSON.stringify({
              generationReady: generation.ready,
              generationSelected: generation.selected,
              generationReleaseScheduled: generation.releaseScheduled,
              mechanicsViewSubmitted: generation.mechanicsView?.submitPerformed ?? null,
              mechanicsFieldSubmitted:
                generation.mechanicsFieldView?.submitPerformed ?? null,
              mechanicsFieldReleased:
                generation.mechanicsFieldView?.released ?? null,
              stateMatch:
                schroederSpatialEpochTransaction.sourceBuffers.stateBuffer
                  === particleUpload.stateBuffer,
              thermoMatch:
                schroederSpatialEpochTransaction.sourceBuffers.thermoBuffer
                  === particleUpload.thermoBuffer,
              identityMatch:
                schroederSpatialEpochTransaction.sourceBuffers.identityBuffer
                  === particleUpload.identityBuffer,
              mechanicsMatch:
                schroederSpatialEpochTransaction.sourceBuffers.mechanicsBuffer
                  === mlsMpmParticleUpload.mechanicsBuffer
            })}`
          );
          proposal = proposalModule.runSchroederSpatialThermalProposalWebGpu({
            device,
            generation,
            schroederSpatialEpochTransaction,
            sphParticleState: proposalCpuState,
            sphParticleUpload: particleUpload,
            mlsMpmParticleUpload,
            thermalResponseGraphUpload: responseUpload,
            dtS,
            smoothingLengthM: packed.smoothingLengthM,
            conductionRate
          });
          requireTrue(proposal.ready === true, `${name}: proposal was not ready`);
          if (producerTraversal === 'native-test-tree-shadow') {
            treeShadowReceipt = proposalModule
              .armSchroederSpatialThermalTreeShadowForNativeTest({
                device,
                schroederSpatialThermalProposal: proposal,
                observeTraversalCounters: observeTreeTraversalCounters
              });
            requireTrue(
              treeShadowReceipt?.nativeTestOnly === true
                && treeShadowReceipt.tree
                  === generation.exactNearCellTree
                && treeShadowReceipt.fallback == null,
              `${name}: native tree shadow did not bind the exact generation tree`
            );
            if (corruptTreeWord) {
              const corruptTreeWordIndex =
                typeof corruptTreeWord.word === 'function'
                  ? corruptTreeWord.word(generation.exactNearCellTree)
                  : corruptTreeWord.word;
              requireTrue(
                Number.isInteger(corruptTreeWordIndex)
                  && corruptTreeWordIndex >= 0
                  && corruptTreeWordIndex
                    < generation.exactNearCellTree.layout.wordLength
                  && Number.isInteger(corruptTreeWord.value)
                  && corruptTreeWord.value >= 0
                  && corruptTreeWord.value <= 0xffff_ffff,
                `${name}: invalid tree-word corruption request`
              );
              device.queue.writeBuffer(
                treeShadowReceipt.treeBuffer,
                corruptTreeWordIndex * Uint32Array.BYTES_PER_ELEMENT,
                new Uint32Array([corruptTreeWord.value])
              );
            }
          }
          requireTrue(
            proposal.activeSourceProjectionMode === (
              useAggregate
                ? proposalModule
                  .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_AGGREGATE
                : (
                    useActiveRank
                      ? proposalModule
                        .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
                      : proposalModule
                        .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
                  )
            ),
            `${name}: active-source projection mode ${
              proposal.activeSourceProjectionMode
            } did not match aggregate=${useAggregate}, activeRank=${useActiveRank}`
          );
          if (corruptActiveProjection) {
            const { ordinal, sourceIndex } = corruptActiveProjection;
            const projectionOffset = useAggregate
              ? generation.aggregateView.activeMemberOffsetWords
              : generation.activeRankView?.layout.activeSourceIndicesOffsetWords;
            const projectionBuffer = useAggregate
              ? generation.aggregateView.aggregateViewBuffer
              : generation.activeRankView?.activeRankViewBuffer;
            requireTrue(
              (useAggregate || useActiveRank)
                && Number.isInteger(ordinal)
                && ordinal >= 0
                && ordinal < packed.particleCount
                && Number.isInteger(sourceIndex)
                && sourceIndex >= 0
                && sourceIndex < packed.particleCount
                && Number.isInteger(projectionOffset),
              `${name}: active projection corruption request is invalid`
            );
            device.queue.writeBuffer(
              projectionBuffer,
              (projectionOffset + ordinal) * Uint32Array.BYTES_PER_ELEMENT,
              new Uint32Array([sourceIndex])
            );
          }
          canonicalThermalStage = thermal.createSphThermalStepWebGpuEncoderStage({
            device,
            sphParticleState: packed,
            thermalMaterialTable,
            thermalClosureGraphSet: graphSet,
            thermalClosureGraphBank: graphSet.graphBank,
            thermalPhaseResponseTable: phaseResponseTable,
            thermalResponseGraphUpload: responseUpload,
            sphParticleUpload: particleUpload,
            proposalStateBuffer: currentStateBuffer,
            proposalThermoBuffer: particleUpload.thermoBuffer,
            sourceStateBuffer: currentStateBuffer,
            sourceThermoBuffer: particleUpload.thermoBuffer,
            wallTemperaturesK: {},
            boxDimsM: [10, 10, 10],
            dtS,
            conductionRate,
            wallRate: 0,
            wallLayerM: 0,
            ambientTemperatureK: 0,
            readbackMode: 'full-parity-readback',
            schroederSpatialEpochGeneration: generation,
            schroederSpatialThermalProposal: proposal
          });
          device.pushErrorScope('validation');
          const canonicalEncoder = device.createCommandEncoder({
            label: `ulg-native-thermal-${name}-producer-apply`
          });
          canonicalThermalStage.encode(canonicalEncoder);
          device.queue.submit([canonicalEncoder.finish()]);
          canonicalThermalStage.markSubmittedWork();
          await device.queue.onSubmittedWorkDone();
          const canonicalProducerValidationError = await device.popErrorScope();
          requireTrue(
            !canonicalProducerValidationError,
            `${name}: canonical thermal producer validation failed: ${
              canonicalProducerValidationError?.message
                || String(canonicalProducerValidationError)
            }`
          );

          const [
            derivedBytes,
            proposalBytes,
            conductionEvidenceBytes,
            radiationEvidenceBytes,
            activeDispatchBytes,
            directoryBytes
          ] = await Promise.all([
            readBuffer(
              proposal.thermalDerivedBudgetBuffer,
              proposal.activeDerivedByteLength,
              `ulg-native-thermal-${name}-derived-readback`
            ),
            readBuffer(
              proposal.proposalBuffer,
              proposal.activeProposalByteLength,
              `ulg-native-thermal-${name}-proposal-readback`
            ),
            readBuffer(
              proposal.conductionEvidenceBuffer,
              proposal.evidenceWordCount * Uint32Array.BYTES_PER_ELEMENT,
              `ulg-native-thermal-${name}-conduction-evidence-readback`
            ),
            readBuffer(
              proposal.radiationEvidenceBuffer,
              proposal.evidenceWordCount * Uint32Array.BYTES_PER_ELEMENT,
              `ulg-native-thermal-${name}-radiation-evidence-readback`
            ),
            readBuffer(
              proposal.activeDispatchBuffer,
              3 * Uint32Array.BYTES_PER_ELEMENT,
              `ulg-native-thermal-${name}-active-dispatch-readback`
            ),
            readBuffer(
              generation.execution.directoryBuffer,
              generation.execution.layout.wordLength
                * Uint32Array.BYTES_PER_ELEMENT,
              `ulg-native-thermal-${name}-directory-readback`
            )
          ]);
          const derivedWords = new Uint32Array(derivedBytes);
          const derivedFloats = new Float32Array(derivedBytes);
          const proposalWords = new Uint32Array(proposalBytes);
          const proposalFloats = new Float32Array(proposalBytes);
          const conductionEvidence = Array.from(
            new Uint32Array(conductionEvidenceBytes)
          );
          const radiationEvidence = Array.from(
            new Uint32Array(radiationEvidenceBytes)
          );
          const activeDispatch = Array.from(
            new Uint32Array(activeDispatchBytes)
          );
          const directoryWords = new Uint32Array(directoryBytes);
          const treeShadowDiagnostics = treeShadowReceipt?.diagnosticBuffer
            ? Array.from(new Uint32Array(await readBuffer(
                treeShadowReceipt.diagnosticBuffer,
                treeShadowReceipt.diagnosticWordCount
                  * Uint32Array.BYTES_PER_ELEMENT,
                `ulg-native-thermal-${name}-tree-shadow-diagnostics-readback`
              )))
            : null;
          if (treeShadowDiagnostics && !expectedFailClosed) {
            const gpuPairwiseTemperatureUniform = derivedWords[2]
              === ((~derivedWords[3]) >>> 0);
            requireTrue(
              treeShadowDiagnostics.length
                  === proposalModule
                    .SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_DIAGNOSTIC_WORDS
                && (
                  gpuPairwiseTemperatureUniform
                    ? treeShadowDiagnostics.every((value) => value === 0)
                    : (
                        treeShadowDiagnostics[0] > 0
                        && treeShadowDiagnostics[1] > 0
                        && treeShadowDiagnostics[2] > 0
                      )
                ),
              `${name}: tree shadow did not publish budget traversal counters: ${
                JSON.stringify(treeShadowDiagnostics)
              }`
            );
          }
          const aggregateHeader = generation.aggregateView
            ? Array.from(new Uint32Array(await readBuffer(
                generation.aggregateView.aggregateViewBuffer,
                112 * Uint32Array.BYTES_PER_ELEMENT,
                `ulg-native-thermal-${name}-aggregate-header-readback`
              )))
            : null;
          const activeRankHeader = generation.activeRankView
            ? Array.from(new Uint32Array(await readBuffer(
                generation.activeRankView.activeRankViewBuffer,
                64 * Uint32Array.BYTES_PER_ELEMENT,
                `ulg-native-thermal-${name}-active-rank-header-readback`
              )))
            : null;
          const thermalCandidateCsrReplayBytes = proposal.thermalCandidateCsr
            ? await readBuffer(
                proposal.thermalCandidateCsr.replayBuffer,
                (
                  proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
                    + proposal.thermalCandidateCsr.candidateCapacity
                ) * Uint32Array.BYTES_PER_ELEMENT,
                `ulg-native-thermal-${name}-candidate-csr-replay-readback`
              )
            : null;
          const thermalCandidateCsrRowStateBytes =
            proposal.thermalCandidateCsr
              ? await readBuffer(
                  proposal.thermalCandidateCsr.sourceRowStateBuffer,
                  proposal.thermalCandidateCsr.sourceCapacity
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-candidate-csr-row-states-readback`
                )
              : null;
          const thermalCandidateCsrHeader = thermalCandidateCsrReplayBytes
            ? Array.from(new Uint32Array(
                thermalCandidateCsrReplayBytes,
                0,
                proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
              ))
            : null;
          const thermalCandidateCsrRowStates =
            thermalCandidateCsrRowStateBytes
              ? Array.from(new Uint32Array(thermalCandidateCsrRowStateBytes))
              : null;
          const displacementHeaderWord = proposal.derivedHeaderLayout.indexOf(
            'maximumPositionDisplacementM:atomic<f32-bits>'
          );
          const projectionAdmissionHeaderWord = proposal.derivedHeaderLayout.indexOf(
            'activeMemberProjectionAdmission:atomic<u32>'
          );
          const currentActiveCountHeaderWord = proposal.derivedHeaderLayout.indexOf(
            'currentActiveSourceCount:atomic<u32>'
          );
          const expectedActiveCountHeaderWord = proposal.derivedHeaderLayout.indexOf(
            'expectedActiveMemberCount:atomic<u32>'
          );
          const materializedRankCountHeaderWord = proposal.derivedHeaderLayout.indexOf(
            'materializedActiveSourceRankCount:atomic<u32>'
          );
          requireTrue(
            displacementHeaderWord >= 0,
            `${name}: matched-time displacement header ABI is missing`
          );
          requireTrue(
            projectionAdmissionHeaderWord
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMISSION_WORD,
            `${name}: active-member projection admission header ABI is missing`
          );
          if (!expectedFailClosed && proposal.thermalCandidateCsr) {
            const candidateCsr = proposal.thermalCandidateCsr;
            const gpuPairwiseTemperatureUniform = derivedWords[2]
              === ((~derivedWords[3]) >>> 0);
            const candidateCsrStatus = thermalCandidateCsrHeader?.[
              proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
            ] || 0;
            const candidateCsrRoute = thermalCandidateCsrHeader?.[
              proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD
            ] || 0;
            const expectedRoute = expectCandidateCsrRoute ?? (
              derivedWords[currentActiveCountHeaderWord] === 0
                ? 0
                : (
                    expectCandidateCsrFallback
                      ? proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK
                      : proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY
                  )
            );
            const candidateCsrRowStatesComplete = gpuPairwiseTemperatureUniform
              || thermalCandidateCsrRowStates.every((rowState, sourceIndex) => (
                sourceIndex >= packed.particleCount
                  ? rowState === 0
                  : (
                    currentState[sourceIndex * 8 + 3] > 0
                      ? (
                        rowState > 0
                        && rowState <= candidateCsr.rowStride
                        && rowState
                          !== proposalModule
                            .SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STATE_WRITING
                      )
                      : rowState === 0
                  )
              ));
            const candidateCsrSealed = candidateCsrRowStatesComplete
              && (candidateCsrStatus
                & proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY) !== 0
              && (candidateCsrStatus
                & (
                  proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID
                  | proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW
                )) === 0;
            const candidateCsrFallback = !candidateCsrSealed
              && (candidateCsrStatus
                & (
                  proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID
                  | proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW
                )) !== 0
              && proposal.thermalCandidateCsrFallbackMode
                === 'authenticated-exact-near-directory-rewalk-on-unsealed-row-receipt';
            requireTrue(
              proposal.hierarchyTraversalCount === 2
                && proposal.preferredHierarchyTraversalCount === 1
                && proposal.maximumHierarchyTraversalCount === 2
                && proposal.reciprocalTraversalMode
                  === 'fixed-source-row-thermal-candidate-replay-or-authenticated-exact-near-rewalk'
                && thermalCandidateCsrHeader?.[0]
                  === proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_MAGIC
                && thermalCandidateCsrHeader?.[1]
                  === proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_VERSION
                && thermalCandidateCsrHeader?.[2] === candidateCsr.sourceCapacity
                && thermalCandidateCsrHeader?.[3] === candidateCsr.candidateCapacity
                && thermalCandidateCsrHeader?.[
                  proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STRIDE_WORD
                ] === candidateCsr.rowStride
                && candidateCsr.candidateCapacity
                  === candidateCsr.sourceCapacity * candidateCsr.rowStride
                && thermalCandidateCsrRowStates?.length
                  === candidateCsr.sourceCapacity
                && (expectedRoute === 0 || (candidateCsrRoute & expectedRoute) !== 0)
                && (
                  expectCandidateCsrFallback
                    ? candidateCsrFallback
                    : candidateCsrSealed
                ),
              `${name}: thermal candidate CSR route was not authenticated: ${
                JSON.stringify({
                  header: thermalCandidateCsrHeader || null,
                  expectedRoute,
                  candidateCsrStatus,
                  candidateCsrRoute
                })
              }`
            );
          } else if (!expectedFailClosed) {
            requireTrue(
              proposal.hierarchyTraversalCount === 2
                && proposal.thermalCandidateCsr == null,
              `${name}: uniform/direct thermal route did not preserve its no-CSR traversal contract`
            );
          }
          requireTrue(
            expectedFailClosed
              ? (
                  derivedWords[projectionAdmissionHeaderWord]
                    === proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED
                  || derivedWords[projectionAdmissionHeaderWord]
                    === proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_REJECTED
                )
              : derivedWords[projectionAdmissionHeaderWord]
                === proposalModule
                  .SCHROEDER_SPATIAL_THERMAL_ACTIVE_MEMBER_PROJECTION_ADMITTED,
            `${name}: active-member projection admission was ${
              derivedWords[projectionAdmissionHeaderWord]
            }`
          );
          const activeSourceCount = Array.from(
            { length: packed.particleCount },
            (_, index) => packed.state[index * 8 + 3]
          ).filter((massKg) => massKg > 0).length;
          if (expectedFailClosed) {
            requireTrue(
              expectTreeFailClosed
                || derivedWords[1] > 0
                || derivedWords[currentActiveCountHeaderWord]
                  !== derivedWords[expectedActiveCountHeaderWord]
                || derivedWords[materializedRankCountHeaderWord]
                  !== derivedWords[expectedActiveCountHeaderWord],
              `${name}: requested fail-closed fixture left all active seals valid`
            );
            requireTrue(
              proposalWords[6] > 0
                && proposalWords[7] > 0
                && proposalWords[15] === 0
                && conductionEvidence[6] === 0
                && radiationEvidence[6] === 0
                && conductionEvidence[13] === 0
                && conductionEvidence[14] === 0
                && conductionEvidence[15] === 0
                && radiationEvidence[13] === 0
                && radiationEvidence[14] === 0
                && radiationEvidence[15] === 0,
              `${name}: malformed active projection published rows or no invalid evidence: ${
                proposalWords[6]
              }/${proposalWords[7]}/${proposalWords[15]}; evidence rows ${
                conductionEvidence[6]
              }/${radiationEvidence[6]}`
            );
            const failedState = new Float32Array(await readBuffer(
              canonicalThermalStage.stateBuffer,
              currentState.byteLength,
              `ulg-native-thermal-${name}-failed-state-readback`
            ));
            requireTrue(
              failedState.every((value, index) => value === currentState[index]),
              `${name}: fail-closed canonical apply mutated current state`
            );
            canonicalThermalStage.cleanupSubmittedWork();
            return {
              name,
              producerTraversal,
              treeShadowDiagnostics,
              useAggregate,
              useActiveRank,
              activeSourceProjectionMode: proposal.activeSourceProjectionMode,
              particleCount: packed.particleCount,
              expectedFailClosed: true,
              derivedInvalidCount: derivedWords[1],
              currentActiveCount: derivedWords[currentActiveCountHeaderWord],
              expectedActiveCount: derivedWords[expectedActiveCountHeaderWord],
              materializedRankCount: derivedWords[materializedRankCountHeaderWord],
              proposalInvalidCounts: [proposalWords[6], proposalWords[7]],
              publishedRowCount: proposalWords[15],
              activeDispatch,
              conductionEvidence,
              radiationEvidence
            };
          }
          requireTrue(
            currentActiveCountHeaderWord >= 0
              && expectedActiveCountHeaderWord >= 0
              && materializedRankCountHeaderWord >= 0
              && derivedWords[currentActiveCountHeaderWord] === activeSourceCount
              && derivedWords[expectedActiveCountHeaderWord] === activeSourceCount
              && derivedWords[materializedRankCountHeaderWord] === activeSourceCount,
            `${name}: active dispatch seals were current/expected/materialized ${
              derivedWords[currentActiveCountHeaderWord]
            }/${derivedWords[expectedActiveCountHeaderWord]}/${
              derivedWords[materializedRankCountHeaderWord]
            }, expected ${activeSourceCount}`
          );
          requireTrue(
            activeDispatch[0] === Math.max(1, Math.ceil(activeSourceCount / 64))
              && activeDispatch[1] === 1
              && activeDispatch[2] === 1,
            `${name}: finalized active dispatch was ${activeDispatch}`
          );
          const activeRankSidecarOffset = proposal.derivedHeaderWords
            + packed.particleCount * proposal.derivedRowWords;
          const activeRankSidecar = Array.from(derivedWords.slice(
            activeRankSidecarOffset,
            activeRankSidecarOffset + packed.particleCount
          ));
          const activeSourceRanks = (useAggregate || useActiveRank)
            ? activeRankSidecar.slice(0, activeSourceCount)
            : activeRankSidecar.filter((sourceRank) => sourceRank !== 0xffffffff);
          const materializedActiveSources = activeSourceRanks.map((sourceRank) => {
            requireTrue(
              sourceRank < packed.particleCount,
              `${name}: materialized source rank ${sourceRank} is out of range`
            );
            return directoryWords[
              generation.execution.layout.cellMembersOffsetWords + sourceRank
            ];
          });
          const expectedActiveSources = Array.from(
            { length: packed.particleCount },
            (_, index) => index
          ).filter((index) => packed.state[index * 8 + 3] > 0);
          requireTrue(
            new Set(activeSourceRanks).size === activeSourceCount
              && JSON.stringify([...materializedActiveSources].sort((a, b) => a - b))
                === JSON.stringify(expectedActiveSources),
            `${name}: active rank sidecar ${activeSourceRanks} decoded to ${
              materializedActiveSources
            }, expected ${expectedActiveSources}`
          );
          if (useAggregate) {
            requireTrue(
              aggregateHeader != null
                && aggregateHeader[2] === 259
                && aggregateHeader[91] === 0x53414d31
                && aggregateHeader[92] === 1
                && aggregateHeader[93] === 3
                && aggregateHeader[95] === generation.execution.sourceCapacity
                && aggregateHeader[96] === activeSourceCount
                && aggregateHeader[97] === packed.particleCount
                && aggregateHeader[108] === 2,
              `${name}: aggregate active-member projection header is invalid: ${
                JSON.stringify(aggregateHeader)
              }`
            );
          } else if (useActiveRank) {
            requireTrue(
              aggregateHeader == null
                && activeRankHeader != null
                && activeRankHeader[0] === 0x53525631
                && activeRankHeader[1] === 1
                && activeRankHeader[2] === 3
                && activeRankHeader[16] === packed.particleCount
                && activeRankHeader[26] === activeSourceCount
                && activeRankHeader[27] === packed.particleCount - activeSourceCount
                && activeRankHeader[44] === Math.max(1, Math.ceil(activeSourceCount / 64)),
              `${name}: base active-rank header is invalid: ${
                JSON.stringify(activeRankHeader)
              }`
            );
          } else {
            requireTrue(
              aggregateHeader == null
                && activeRankSidecar.every((sourceRank, rank) => (
                  sourceRank === 0xffffffff || sourceRank === rank
                )),
              `${name}: local active-rank mask is not stable by source rank: ${
                activeRankSidecar
              }`
            );
          }
          requireTrue(
            derivedWords[1] === 0,
            `${name}: derived invalid count ${derivedWords[1]}`
          );
          requireTrue(
            proposalWords[0] === proposalModule.SCHROEDER_SPATIAL_THERMAL_PROPOSAL_MAGIC,
            `${name}: proposal magic mismatch`
          );
          requireTrue(
            proposalWords[1] === proposalModule.SCHROEDER_SPATIAL_THERMAL_PROPOSAL_VERSION,
            `${name}: proposal version mismatch`
          );
          requireTrue(
            proposalWords[6] === 0
              && proposalWords[7] === 0
              && proposalWords[15] === packed.particleCount,
            `${name}: proposal invalid counts/rows ${proposalWords[6]}/${proposalWords[7]}/${proposalWords[15]}; aggregate=${JSON.stringify(aggregateHeader)}`
          );
          for (const [consumer, evidence] of [
            ['conduction', conductionEvidence],
            ['radiation', radiationEvidence]
          ]) {
            requireTrue(
              evidence.length === proposal.evidenceWordCount,
              `${name}: ${consumer} evidence length ${evidence.length}`
            );
            requireTrue(
              evidence[2] === 0 && evidence[5] === 0 && evidence[7] === 0,
              `${name}: ${consumer} producer rejected/malformed/non-finite ${
                evidence[2]
              }/${evidence[5]}/${evidence[7]}`
            );
            requireTrue(
              evidence[6] === packed.particleCount && evidence[12] === 2,
              `${name}: ${consumer} producer rows/traversals ${evidence[6]}/${evidence[12]}`
            );
            requireTrue(
              evidence[0] === 2 * packed.particleCount
                && evidence[1] === 2 * packed.particleCount,
              `${name}: ${consumer} source/directory evidence ${evidence[0]}/${evidence[1]}`
            );
          }
          requireTrue(
            requireThermalExchange
              ? conductionEvidence[4] > 0
              : conductionEvidence[4] === 0,
            `${name}: conduction support-mask hits were ${conductionEvidence[4]}`
          );

          const derivedRows = [];
          const proposalRows = [];
          let reciprocalProposalEnergyJ = 0;
          let absoluteProposalEnergyJ = 0;
          let inactiveProposalRowCount = 0;
          for (let index = 0; index < packed.particleCount; index += 1) {
            const stateOffset = index * 8;
            const massKg = packed.state[stateOffset + 3];
            const sourceU = proposalSourceState[stateOffset + 7];
            const derivedOffset = proposal.derivedHeaderWords
              + index * proposal.derivedRowWords;
            const derivedRow = Array.from(
              derivedFloats.slice(derivedOffset, derivedOffset + proposal.derivedRowWords)
            );
            derivedRows.push(derivedRow);
            requireTrue(
              derivedRow.every(finite),
              `${name}: non-finite derived row ${index}: ${derivedRow}`
            );

            const proposalOffset = proposal.proposalHeaderWords
              + index * proposal.proposalRowWords;
            const proposalRow = Array.from(
              proposalFloats.slice(proposalOffset, proposalOffset + proposal.proposalRowWords)
            );
            proposalRows.push(proposalRow);
            requireTrue(
              proposalRow.every(finite),
              `${name}: non-finite proposal row ${index}: ${proposalRow}`
            );
            if (!(massKg > 0)) {
              inactiveProposalRowCount += 1;
              requireTrue(
                derivedRow[0] === 0
                  && derivedRow[1] === 0
                  && derivedRow[2] === 0
                  && derivedRow[3] === 0
                  && derivedRow[4] === 1
                  && derivedRow[5] === 1
                  && derivedRow[6] === 0
                  && derivedRow[7] === 0,
                `${name}: inactive derived row ${index} was not inert with neutral budgets: ${derivedRow}`
              );
              requireTrue(
                proposalRow.every((value) => value === 0),
                `${name}: inactive proposal row ${index} was not zero: ${proposalRow}`
              );
              continue;
            }
            requireTrue(
              derivedRow[0] >= 0 && derivedRow[1] >= 0 && derivedRow[2] > 0,
              `${name}: invalid derived thermal state at row ${index}: ${derivedRow}`
            );
            requireTrue(
              derivedRow[4] >= 0 && derivedRow[4] <= 1
                && derivedRow[5] >= 0 && derivedRow[5] <= 1,
              `${name}: invalid directional scales at row ${index}: ${derivedRow}`
            );
            requireTrue(
              derivedRow[6] <= sourceU && sourceU <= derivedRow[7],
              `${name}: source U ${sourceU} escaped derived domain ${derivedRow[6]}..${derivedRow[7]}`
            );
            requireTrue(
              proposalRow[2] <= sourceU && sourceU <= proposalRow[3],
              `${name}: source U ${sourceU} escaped proposal domain ${proposalRow[2]}..${proposalRow[3]}`
            );
            requireTrue(
              Math.abs(proposalRow[1]) <= 1.0e-7,
              `${name}: pair radiation was not disabled at row ${index}: ${proposalRow[1]}`
            );
            const pairDu = proposalRow[0] + proposalRow[1];
            reciprocalProposalEnergyJ += massKg * pairDu;
            absoluteProposalEnergyJ += Math.abs(massKg * pairDu);
          }
          requireTrue(
            requireThermalExchange
              ? absoluteProposalEnergyJ > 1.0e-4
              : absoluteProposalEnergyJ <= 1.0e-7,
            `${name}: absolute proposal energy was ${absoluteProposalEnergyJ} J`
          );
          const proposalConservationToleranceJ = Math.max(
            2.0e-3,
            absoluteProposalEnergyJ * 5.0e-6
          );
          requireTrue(
            Math.abs(reciprocalProposalEnergyJ) <= proposalConservationToleranceJ,
            `${name}: reciprocal proposal energy residual ${reciprocalProposalEnergyJ} J exceeds ${proposalConservationToleranceJ} J`
          );

          // Reconstruct the producer's pair request from GPU-derived endpoint
          // temperatures/slopes/radii. The proposal readback remains the
          // authority for accepted Q; this ledger makes a zero proposal
          // attributable to contact, equalization, directional room, or apply.
          const requestedGainJ = new Float64Array(packed.particleCount);
          const requestedLossJ = new Float64Array(packed.particleCount);
          const reconstructedAcceptedJ = new Float64Array(packed.particleCount);
          const pairLedger = [];
          const clampPairEnergy = ({
            rawEnergyJ,
            temperatureK,
            otherTemperatureK,
            temperatureSlope,
            otherTemperatureSlope,
            massKg,
            otherMassKg
          }) => {
            if (rawEnergyJ === 0) return 0;
            const temperatureGapK = otherTemperatureK - temperatureK;
            if (
              temperatureGapK === 0
              || Math.sign(rawEnergyJ) !== Math.sign(temperatureGapK)
            ) return rawEnergyJ;
            const responsePerJ = temperatureSlope / Math.max(massKg, 1.0e-30)
              + otherTemperatureSlope / Math.max(otherMassKg, 1.0e-30);
            if (!(responsePerJ > 0)) return rawEnergyJ;
            const equalizingEnergyJ = Math.abs(temperatureGapK) / responsePerJ;
            return Math.sign(rawEnergyJ) * Math.min(
              Math.abs(rawEnergyJ),
              equalizingEnergyJ * 0.25
            );
          };
          for (let i = 0; i < packed.particleCount; i += 1) {
            const stateOffsetI = i * 8;
            const massI = packed.state[stateOffsetI + 3];
            if (!(massI > 0)) continue;
            for (let j = i + 1; j < packed.particleCount; j += 1) {
              const stateOffsetJ = j * 8;
              const massJ = packed.state[stateOffsetJ + 3];
              if (!(massJ > 0)) continue;
              const distanceM = Math.hypot(
                currentState[stateOffsetI] - currentState[stateOffsetJ],
                currentState[stateOffsetI + 1] - currentState[stateOffsetJ + 1],
                currentState[stateOffsetI + 2] - currentState[stateOffsetJ + 2]
              );
              const supportM = Math.max(
                2 * packed.smoothingLengthM,
                derivedRows[i][2] + derivedRows[j][2]
              );
              if (!(distanceM < supportM)) continue;
              const rawEnergyIntoIJ = conductionRate
                * (derivedRows[j][0] - derivedRows[i][0])
                * (1 - distanceM / supportM)
                * dtS;
              const requestedEnergyIntoIJ = clampPairEnergy({
                rawEnergyJ: rawEnergyIntoIJ,
                temperatureK: derivedRows[i][0],
                otherTemperatureK: derivedRows[j][0],
                temperatureSlope: derivedRows[i][1],
                otherTemperatureSlope: derivedRows[j][1],
                massKg: massI,
                otherMassKg: massJ
              });
              if (requestedEnergyIntoIJ > 0) {
                requestedGainJ[i] += requestedEnergyIntoIJ;
                requestedLossJ[j] += requestedEnergyIntoIJ;
              } else if (requestedEnergyIntoIJ < 0) {
                requestedLossJ[i] -= requestedEnergyIntoIJ;
                requestedGainJ[j] -= requestedEnergyIntoIJ;
              }
              const directionalScale = requestedEnergyIntoIJ > 0
                ? Math.min(derivedRows[i][4], derivedRows[j][5])
                : Math.min(derivedRows[i][5], derivedRows[j][4]);
              const acceptedEnergyIntoIJ = requestedEnergyIntoIJ
                * directionalScale;
              reconstructedAcceptedJ[i] += acceptedEnergyIntoIJ;
              reconstructedAcceptedJ[j] -= acceptedEnergyIntoIJ;
              if (includePairLedgerInResult || fusionIngress || exactTouchPlane) {
                pairLedger.push({
                  i,
                  j,
                  idI: particles[i].id,
                  idJ: particles[j].id,
                  distanceM,
                  supportM,
                  rawEnergyIntoIJ,
                  requestedEnergyIntoIJ,
                  directionalScale,
                  acceptedEnergyIntoIJ,
                  limiterRejectedEnergyIntoIJ:
                    requestedEnergyIntoIJ - acceptedEnergyIntoIJ
                });
              }
            }
          }
          const carrierEvidence = [];
          for (let index = 0; index < packed.particleCount; index += 1) {
            const stateOffset = index * 8;
            const massKg = packed.state[stateOffset + 3];
            const sourceU = proposalSourceState[stateOffset + 7];
            const lowerU = derivedRows[index][6];
            const upperU = derivedRows[index][7];
            const gainRoomJ = Math.max(0, massKg * (upperU - sourceU));
            const lossRoomJ = Math.max(0, massKg * (sourceU - lowerU));
            const expectedGainScale = requestedGainJ[index] > 0
              ? Math.min(1, gainRoomJ / requestedGainJ[index])
              : 1;
            const expectedLossScale = requestedLossJ[index] > 0
              ? Math.min(1, lossRoomJ / requestedLossJ[index])
              : 1;
            const acceptedEnergyJ = massKg
              * (proposalRows[index][0] + proposalRows[index][1]);
            requireTrue(
              near(derivedRows[index][4], expectedGainScale, 2.0e-3, 2.0e-3),
              `${name}: carrier ${index} gain scale ${derivedRows[index][4]} does not match room/request ${expectedGainScale}`
            );
            requireTrue(
              near(derivedRows[index][5], expectedLossScale, 2.0e-3, 2.0e-3),
              `${name}: carrier ${index} loss scale ${derivedRows[index][5]} does not match room/request ${expectedLossScale}`
            );
            requireTrue(
              near(
                acceptedEnergyJ,
                reconstructedAcceptedJ[index],
                0.1,
                2.0e-3
              ),
              `${name}: carrier ${index} GPU accepted Q ${acceptedEnergyJ} does not match reconstructed ${reconstructedAcceptedJ[index]}`
            );
            carrierEvidence.push({
              index,
              id: particles[index].id,
              massKg,
              sourceU,
              lowerU,
              upperU,
              gainRoomJ,
              lossRoomJ,
              requestedGainJ: requestedGainJ[index],
              requestedLossJ: requestedLossJ[index],
              gainScale: derivedRows[index][4],
              lossScale: derivedRows[index][5],
              expectedGainScale,
              expectedLossScale,
              acceptedEnergyJ,
              reconstructedAcceptedEnergyJ: reconstructedAcceptedJ[index]
            });
          }

          const initialEnergyJ = totalEnergyJ(proposalSourceState);
          const [finalStateBytes, finalThermoBytes] = await Promise.all([
            readBuffer(
              canonicalThermalStage.stateBuffer,
              packed.state.byteLength,
              `ulg-native-thermal-${name}-final-state-readback`
            ),
            readBuffer(
              canonicalThermalStage.thermoBuffer,
              packed.thermo.byteLength,
              `ulg-native-thermal-${name}-final-thermo-readback`
            )
          ]);
          const result = canonicalThermalStage.result;
          result.state = new Float32Array(finalStateBytes);
          result.thermo = new Float32Array(finalThermoBytes);
          canonicalThermalStage.cleanupSubmittedWork();
          requireTrue(
            result.fullReadbackPerformed === true,
            `${name}: canonical apply did not perform full final readback`
          );
          requireTrue(
            result.neighborLookupMode === 'canonical-schroeder-spatial-thermal-proposals',
            `${name}: canonical apply used ${result.neighborLookupMode}`
          );
          requireTrue(
            result.state.length === packed.state.length
              && result.thermo.length === packed.thermo.length,
            `${name}: final readback row count mismatch`
          );

          if (sameGenerationTreeShadow) {
            for (
              let waitOrdinal = 0;
              waitOrdinal < 100 && proposal.released !== true;
              waitOrdinal += 1
            ) {
              await device.queue.onSubmittedWorkDone();
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
            requireTrue(
              proposal.released === true
                && generation.released !== true
                && generation.exactNearCellTree.released !== true,
              `${name}: direct proposal did not release while its generation/tree stayed live`
            );
            let treeProposal = null;
            let treeStage = null;
            let treeSubmitted = false;
            let sameGenerationTreeReceipt = null;
            try {
              treeProposal =
                proposalModule.runSchroederSpatialThermalProposalWebGpu({
                  device,
                  generation,
                  schroederSpatialEpochTransaction,
                  sphParticleState: proposalCpuState,
                  sphParticleUpload: particleUpload,
                  mlsMpmParticleUpload,
                  thermalResponseGraphUpload: responseUpload,
                  dtS,
                  smoothingLengthM: packed.smoothingLengthM,
                  conductionRate
                });
              sameGenerationTreeReceipt = proposalModule
                .armSchroederSpatialThermalTreeShadowForNativeTest({
                  device,
                  schroederSpatialThermalProposal: treeProposal,
                  observeTraversalCounters: true
                });
              requireTrue(
                treeProposal.generationId === proposal.generationId
                  && treeProposal.supportEpoch === proposal.supportEpoch
                  && sameGenerationTreeReceipt.tree
                    === generation.exactNearCellTree,
                `${name}: same-generation tree shadow changed epoch identity`
              );
              treeStage = thermal.createSphThermalStepWebGpuEncoderStage({
                device,
                sphParticleState: packed,
                thermalMaterialTable,
                thermalClosureGraphSet: graphSet,
                thermalClosureGraphBank: graphSet.graphBank,
                thermalPhaseResponseTable: phaseResponseTable,
                thermalResponseGraphUpload: responseUpload,
                sphParticleUpload: particleUpload,
                proposalStateBuffer: currentStateBuffer,
                proposalThermoBuffer: particleUpload.thermoBuffer,
                sourceStateBuffer: currentStateBuffer,
                sourceThermoBuffer: particleUpload.thermoBuffer,
                wallTemperaturesK: {},
                boxDimsM: [10, 10, 10],
                dtS,
                conductionRate,
                wallRate: 0,
                wallLayerM: 0,
                ambientTemperatureK: 0,
                readbackMode: 'full-parity-readback',
                schroederSpatialEpochGeneration: generation,
                schroederSpatialThermalProposal: treeProposal
              });
              device.pushErrorScope('validation');
              const treeEncoder = device.createCommandEncoder({
                label: `ulg-native-thermal-${name}-same-generation-tree`
              });
              treeStage.encode(treeEncoder);
              device.queue.submit([treeEncoder.finish()]);
              treeStage.markSubmittedWork();
              treeSubmitted = true;
              await device.queue.onSubmittedWorkDone();
              const treeValidationError = await device.popErrorScope();
              requireTrue(
                !treeValidationError,
                `${name}: same-generation tree validation failed: ${
                  treeValidationError?.message || String(treeValidationError)
                }`
              );
              const [
                treeDerivedBytes,
                treeProposalBytes,
                treeConductionEvidenceBytes,
                treeRadiationEvidenceBytes,
                treeFinalStateBytes,
                treeFinalThermoBytes,
                treeDiagnosticBytes,
                treeActiveDispatchBytes,
                treeCandidateCsrReplayBytes,
                treeCandidateCsrRowStateBytes
              ] = await Promise.all([
                readBuffer(
                  treeProposal.thermalDerivedBudgetBuffer,
                  treeProposal.activeDerivedByteLength,
                  `ulg-native-thermal-${name}-same-generation-tree-derived`
                ),
                readBuffer(
                  treeProposal.proposalBuffer,
                  treeProposal.activeProposalByteLength,
                  `ulg-native-thermal-${name}-same-generation-tree-proposal`
                ),
                readBuffer(
                  treeProposal.conductionEvidenceBuffer,
                  treeProposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-tree-conduction`
                ),
                readBuffer(
                  treeProposal.radiationEvidenceBuffer,
                  treeProposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-tree-radiation`
                ),
                readBuffer(
                  treeStage.stateBuffer,
                  packed.state.byteLength,
                  `ulg-native-thermal-${name}-same-generation-tree-state`
                ),
                readBuffer(
                  treeStage.thermoBuffer,
                  packed.thermo.byteLength,
                  `ulg-native-thermal-${name}-same-generation-tree-thermo`
                ),
                readBuffer(
                  sameGenerationTreeReceipt.diagnosticBuffer,
                  sameGenerationTreeReceipt.diagnosticWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-tree-diagnostics`
                ),
                readBuffer(
                  treeProposal.activeDispatchBuffer,
                  3 * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-tree-active-dispatch`
                ),
                treeProposal.thermalCandidateCsr
                  ? readBuffer(
                      treeProposal.thermalCandidateCsr.replayBuffer,
                      (
                        proposalModule
                          .SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
                          + treeProposal.thermalCandidateCsr.candidateCapacity
                      ) * Uint32Array.BYTES_PER_ELEMENT,
                      `ulg-native-thermal-${name}-same-generation-tree-csr-replay`
                    )
                  : Promise.resolve(null),
                treeProposal.thermalCandidateCsr
                  ? readBuffer(
                      treeProposal.thermalCandidateCsr.sourceRowStateBuffer,
                      treeProposal.thermalCandidateCsr.sourceCapacity
                        * Uint32Array.BYTES_PER_ELEMENT,
                      `ulg-native-thermal-${name}-same-generation-tree-csr-row-states`
                    )
                  : Promise.resolve(null)
              ]);
              const exactBytes = (left, right) => {
                const a = new Uint8Array(left);
                const b = new Uint8Array(right);
                return a.length === b.length
                  && a.every((value, index) => value === b[index]);
              };
              const exactOptionalBytes = (left, right) => (
                left == null || right == null
                  ? left == null && right == null
                  : exactBytes(left, right)
              );
              const byteReceipts = {
                derived: exactBytes(derivedBytes, treeDerivedBytes),
                proposal: exactBytes(proposalBytes, treeProposalBytes),
                conductionEvidence: exactBytes(
                  conductionEvidenceBytes,
                  treeConductionEvidenceBytes
                ),
                radiationEvidence: exactBytes(
                  radiationEvidenceBytes,
                  treeRadiationEvidenceBytes
                ),
                activeDispatch: exactBytes(
                  activeDispatchBytes,
                  treeActiveDispatchBytes
                ),
                candidateCsrReplay: exactOptionalBytes(
                  thermalCandidateCsrReplayBytes,
                  treeCandidateCsrReplayBytes
                ),
                candidateCsrRowStates: exactOptionalBytes(
                  thermalCandidateCsrRowStateBytes,
                  treeCandidateCsrRowStateBytes
                ),
                appliedState: exactBytes(finalStateBytes, treeFinalStateBytes),
                appliedThermo: exactBytes(finalThermoBytes, treeFinalThermoBytes)
              };
              requireTrue(
                Object.values(byteReceipts).every(Boolean),
                `${name}: same-generation direct/tree byte parity failed: ${
                  JSON.stringify(byteReceipts)
                }`
              );
              const diagnostics = Array.from(
                new Uint32Array(treeDiagnosticBytes)
              );
              const uniform = conductionEvidence[3] === 0
                && radiationEvidence[3] === 0;
              requireTrue(
                uniform
                  ? diagnostics.every((value) => value === 0)
                  : diagnostics.slice(0, 3).every((value) => value > 0),
                `${name}: same-generation tree counters were ${
                  JSON.stringify(diagnostics)
                }`
              );
              sameGenerationTreeParity = {
                exact: true,
                generationId: proposal.generationId,
                supportEpoch: proposal.supportEpoch,
                treeArenaIndex: generation.exactNearCellTree.arenaIndex,
                treeArenaGeneration:
                  generation.exactNearCellTree.arenaGeneration,
                uniform,
                byteReceipts,
                diagnostics
              };
            } finally {
              if (treeStage) {
                if (treeSubmitted) {
                  treeStage.cleanupSubmittedWork?.();
                } else {
                  treeStage.cleanupAbortedWork?.();
                }
              } else {
                treeProposal?.abandonPreparedWork?.(
                  'same-generation-tree-shadow-setup-failed'
                );
              }
              await device.queue.onSubmittedWorkDone();
            }
          }

          if (sameGenerationExhaustiveShadow) {
            for (
              let waitOrdinal = 0;
              waitOrdinal < 100 && proposal.released !== true;
              waitOrdinal += 1
            ) {
              await device.queue.onSubmittedWorkDone();
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
            requireTrue(
              proposal.released === true
                && generation.released !== true,
              `${name}: direct proposal did not release before exhaustive control`
            );
            let exhaustiveProposal = null;
            let exhaustiveStage = null;
            let exhaustiveSubmitted = false;
            try {
              exhaustiveProposal =
                proposalModule.runSchroederSpatialThermalProposalWebGpu({
                  device,
                  generation,
                  schroederSpatialEpochTransaction,
                  sphParticleState: proposalCpuState,
                  sphParticleUpload: particleUpload,
                  mlsMpmParticleUpload,
                  thermalResponseGraphUpload: responseUpload,
                  dtS,
                  smoothingLengthM: packed.smoothingLengthM,
                  conductionRate
                });
              const exhaustiveReceipt = proposalModule
                .armSchroederSpatialThermalExhaustiveShadowForNativeTest({
                  device,
                  schroederSpatialThermalProposal: exhaustiveProposal
                });
              requireTrue(
                exhaustiveProposal.generationId === proposal.generationId
                  && exhaustiveProposal.supportEpoch === proposal.supportEpoch
                  && exhaustiveReceipt.generation === generation
                  && exhaustiveReceipt.fallback == null,
                `${name}: same-generation exhaustive control changed epoch identity`
              );
              exhaustiveStage =
                thermal.createSphThermalStepWebGpuEncoderStage({
                  device,
                  sphParticleState: packed,
                  thermalMaterialTable,
                  thermalClosureGraphSet: graphSet,
                  thermalClosureGraphBank: graphSet.graphBank,
                  thermalPhaseResponseTable: phaseResponseTable,
                  thermalResponseGraphUpload: responseUpload,
                  sphParticleUpload: particleUpload,
                  proposalStateBuffer: currentStateBuffer,
                  proposalThermoBuffer: particleUpload.thermoBuffer,
                  sourceStateBuffer: currentStateBuffer,
                  sourceThermoBuffer: particleUpload.thermoBuffer,
                  wallTemperaturesK: {},
                  boxDimsM: [10, 10, 10],
                  dtS,
                  conductionRate,
                  wallRate: 0,
                  wallLayerM: 0,
                  ambientTemperatureK: 0,
                  readbackMode: 'full-parity-readback',
                  schroederSpatialEpochGeneration: generation,
                  schroederSpatialThermalProposal: exhaustiveProposal
                });
              device.pushErrorScope('validation');
              const exhaustiveEncoder = device.createCommandEncoder({
                label:
                  `ulg-native-thermal-${name}-same-generation-exhaustive`
              });
              exhaustiveStage.encode(exhaustiveEncoder);
              device.queue.submit([exhaustiveEncoder.finish()]);
              exhaustiveStage.markSubmittedWork();
              exhaustiveSubmitted = true;
              await device.queue.onSubmittedWorkDone();
              const exhaustiveValidationError = await device.popErrorScope();
              requireTrue(
                !exhaustiveValidationError,
                `${name}: same-generation exhaustive validation failed: ${
                  exhaustiveValidationError?.message
                    || String(exhaustiveValidationError)
                }`
              );
              const [
                exhaustiveDerivedBytes,
                exhaustiveProposalBytes,
                exhaustiveConductionEvidenceBytes,
                exhaustiveRadiationEvidenceBytes,
                exhaustiveFinalStateBytes,
                exhaustiveFinalThermoBytes,
                exhaustiveActiveDispatchBytes,
                exhaustiveCandidateCsrReplayBytes,
                exhaustiveCandidateCsrRowStateBytes
              ] = await Promise.all([
                readBuffer(
                  exhaustiveProposal.thermalDerivedBudgetBuffer,
                  exhaustiveProposal.activeDerivedByteLength,
                  `ulg-native-thermal-${name}-same-generation-exhaustive-derived`
                ),
                readBuffer(
                  exhaustiveProposal.proposalBuffer,
                  exhaustiveProposal.activeProposalByteLength,
                  `ulg-native-thermal-${name}-same-generation-exhaustive-proposal`
                ),
                readBuffer(
                  exhaustiveProposal.conductionEvidenceBuffer,
                  exhaustiveProposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-exhaustive-conduction`
                ),
                readBuffer(
                  exhaustiveProposal.radiationEvidenceBuffer,
                  exhaustiveProposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-exhaustive-radiation`
                ),
                readBuffer(
                  exhaustiveStage.stateBuffer,
                  packed.state.byteLength,
                  `ulg-native-thermal-${name}-same-generation-exhaustive-state`
                ),
                readBuffer(
                  exhaustiveStage.thermoBuffer,
                  packed.thermo.byteLength,
                  `ulg-native-thermal-${name}-same-generation-exhaustive-thermo`
                ),
                readBuffer(
                  exhaustiveProposal.activeDispatchBuffer,
                  3 * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-exhaustive-active-dispatch`
                ),
                exhaustiveProposal.thermalCandidateCsr
                  ? readBuffer(
                      exhaustiveProposal.thermalCandidateCsr.replayBuffer,
                      (
                        proposalModule
                          .SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
                          + exhaustiveProposal
                            .thermalCandidateCsr.candidateCapacity
                      ) * Uint32Array.BYTES_PER_ELEMENT,
                      `ulg-native-thermal-${name}-same-generation-exhaustive-csr-replay`
                    )
                  : Promise.resolve(null),
                exhaustiveProposal.thermalCandidateCsr
                  ? readBuffer(
                      exhaustiveProposal
                        .thermalCandidateCsr.sourceRowStateBuffer,
                      exhaustiveProposal.thermalCandidateCsr.sourceCapacity
                        * Uint32Array.BYTES_PER_ELEMENT,
                      `ulg-native-thermal-${name}-same-generation-exhaustive-csr-row-states`
                    )
                  : Promise.resolve(null)
              ]);
              const exactBytes = (left, right) => {
                const a = new Uint8Array(left);
                const b = new Uint8Array(right);
                return a.length === b.length
                  && a.every((value, index) => value === b[index]);
              };
              const exactOptionalBytes = (left, right) => (
                left == null || right == null
                  ? left == null && right == null
                  : exactBytes(left, right)
              );
              const byteReceipts = {
                derived: exactBytes(
                  derivedBytes,
                  exhaustiveDerivedBytes
                ),
                proposal: exactBytes(
                  proposalBytes,
                  exhaustiveProposalBytes
                ),
                conductionEvidence: exactBytes(
                  conductionEvidenceBytes,
                  exhaustiveConductionEvidenceBytes
                ),
                radiationEvidence: exactBytes(
                  radiationEvidenceBytes,
                  exhaustiveRadiationEvidenceBytes
                ),
                activeDispatch: exactBytes(
                  activeDispatchBytes,
                  exhaustiveActiveDispatchBytes
                ),
                candidateCsrReplay: exactOptionalBytes(
                  thermalCandidateCsrReplayBytes,
                  exhaustiveCandidateCsrReplayBytes
                ),
                candidateCsrRowStates: exactOptionalBytes(
                  thermalCandidateCsrRowStateBytes,
                  exhaustiveCandidateCsrRowStateBytes
                ),
                appliedState: exactBytes(
                  finalStateBytes,
                  exhaustiveFinalStateBytes
                ),
                appliedThermo: exactBytes(
                  finalThermoBytes,
                  exhaustiveFinalThermoBytes
                )
              };
              const proposalHeaderBytes =
                proposal.proposalRowByteOffset;
              const proposalHeaderExact = exactBytes(
                proposalBytes.slice(0, proposalHeaderBytes),
                exhaustiveProposalBytes.slice(0, proposalHeaderBytes)
              );
              const directProposalRows = new Float32Array(
                proposalBytes,
                proposalHeaderBytes
              );
              const exhaustiveProposalRows = new Float32Array(
                exhaustiveProposalBytes,
                proposalHeaderBytes
              );
              let maximumProposalAbsoluteDifference = 0;
              const proposalRowsNear =
                directProposalRows.length === exhaustiveProposalRows.length
                && directProposalRows.every((value, index) => {
                  const difference = Math.abs(
                    value - exhaustiveProposalRows[index]
                  );
                  maximumProposalAbsoluteDifference = Math.max(
                    maximumProposalAbsoluteDifference,
                    difference
                  );
                  return near(
                    value,
                    exhaustiveProposalRows[index],
                    1.0e-5,
                    2.0e-6
                  );
                });
              const evidenceExceptCandidateVisitsExact = (left, right) => {
                const directWords = new Uint32Array(left);
                const bruteForceWords = new Uint32Array(right);
                return directWords.length === bruteForceWords.length
                  && directWords.every((value, index) => (
                    index === 3 || value === bruteForceWords[index]
                  ));
              };
              const semanticReceipts = {
                derived: byteReceipts.derived,
                proposalHeader: proposalHeaderExact,
                proposalRowsNear,
                conductionEvidenceExceptCandidateVisits:
                  evidenceExceptCandidateVisitsExact(
                    conductionEvidenceBytes,
                    exhaustiveConductionEvidenceBytes
                  ),
                radiationEvidenceExceptCandidateVisits:
                  evidenceExceptCandidateVisitsExact(
                    radiationEvidenceBytes,
                    exhaustiveRadiationEvidenceBytes
                  ),
                activeDispatch: byteReceipts.activeDispatch,
                candidateCsrRowStates: byteReceipts.candidateCsrRowStates,
                appliedState: byteReceipts.appliedState,
                appliedThermo: byteReceipts.appliedThermo
              };
              requireTrue(
                Object.values(semanticReceipts).every(Boolean),
                `${name}: same-generation direct/brute-force semantic parity failed: ${
                  JSON.stringify({
                    byteReceipts,
                    semanticReceipts,
                    maximumProposalAbsoluteDifference
                  })
                }`
              );
              sameGenerationExhaustiveParity = {
                exact: Object.values(byteReceipts).every(Boolean),
                semanticExact: true,
                enumerationIndependent: true,
                generationId: proposal.generationId,
                supportEpoch: proposal.supportEpoch,
                byteReceipts,
                semanticReceipts,
                maximumProposalAbsoluteDifference
              };
            } finally {
              if (exhaustiveStage) {
                if (exhaustiveSubmitted) {
                  exhaustiveStage.cleanupSubmittedWork?.();
                } else {
                  exhaustiveStage.cleanupAbortedWork?.();
                }
              } else {
                exhaustiveProposal?.abandonPreparedWork?.(
                  'same-generation-exhaustive-shadow-setup-failed'
                );
              }
              await device.queue.onSubmittedWorkDone();
            }
          }

          // Model the G2P post-apply refill with an exact submitted producer
          // command and issue the runtime-only authority bound to this state.
          const classicBinWords = new Uint32Array(1 + packed.particleCount);
          classicBinWords[0] = packed.particleCount;
          for (let index = 0; index < packed.particleCount; index += 1) {
            classicBinWords[1 + index] = index;
          }
          classicBinsBuffer = createTaggedBuffer(
            `ulg-native-thermal-${name}-classic-refreshed-bins`,
            classicBinWords,
            GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          );
          const classicBinProducerEncoder = device.createCommandEncoder({
            label: `ulg-native-thermal-${name}-post-separation-bin-producer`
          });
          const classicBinProducerCommandBuffer =
            classicBinProducerEncoder.finish();
          device.queue.submit([classicBinProducerCommandBuffer]);
          classicBinAuthority =
            binAuthorityModule.issuePostSeparationThermalBinAuthority({
              device,
              stateBuffer: currentStateBuffer,
              binsBuffer: classicBinsBuffer,
              particleCount: packed.particleCount,
              capacity: packed.particleCount,
              nx: 1,
              ny: 1,
              nz: 1,
              cellSizeM: 10,
              producerSubmission: {
                commandBuffer: classicBinProducerCommandBuffer
              }
            });
          device.pushErrorScope('validation');
          const classicResult = await thermal.runSphThermalStepWebGpu({
            device,
            sphParticleState: packed,
            thermalMaterialTable,
            thermalClosureGraphSet: graphSet,
            thermalClosureGraphBank: graphSet.graphBank,
            thermalPhaseResponseTable: phaseResponseTable,
            thermalResponseGraphUpload: responseUpload,
            sphParticleUpload: particleUpload,
            sourceStateBuffer: currentStateBuffer,
            sourceThermoBuffer: particleUpload.thermoBuffer,
            wallTemperaturesK: {},
            boxDimsM: [10, 10, 10],
            dtS,
            conductionRate,
            wallRate: 0,
            wallLayerM: 0,
            ambientTemperatureK: 0,
            readbackMode: 'full-parity-readback',
            neighborBins: classicBinAuthority
          });
          const classicValidationError = await device.popErrorScope();
          requireTrue(
            !classicValidationError,
            `${name}: classic thermal validation failed: ${
              classicValidationError?.message || String(classicValidationError)
            }`
          );
          requireTrue(
            classicResult.neighborLookupMode
              === 'canonical-post-separation-binned-thermal-proposals',
            `${name}: classic v2 used ${classicResult.neighborLookupMode}`
          );
          requireTrue(
            classicResult.thermalPairLaw
              === 'reciprocal-directional-energy-budget-v2'
              && classicResult.thermalProposalNormalLookupBinned === true
              && classicResult.thermalProposalBinnedTraversalCount === 2
              && classicResult.thermalProposalExhaustiveTraversalConfiguredCount === 0
              && classicResult.thermalProposalExhaustiveTraversalPotentialCount === 2
              && classicResult.thermalProposalResidentOverflowFallbackCapable === true
              && classicResult.legacyExhaustiveTraversalCount === 0
              && classicResult.thermalProposalSchroederSpatialBuildCount === 0,
            `${name}: classic v2 authenticated binned contract was not preserved`
          );
          let classicMaxTemperatureDeltaK = 0;
          let classicMaxSpecificEnergyDeltaJPerKg = 0;
          for (let index = 0; index < packed.particleCount; index += 1) {
            const stateOffset = index * 8;
            const thermoOffset = index * 12;
            requireTrue(
              near(
                classicResult.state[stateOffset + 7],
                result.state[stateOffset + 7],
                0.5,
                2.0e-6
              ),
              `${name}: classic/SS U mismatch at ${index}: ${
                classicResult.state[stateOffset + 7]
              } vs ${result.state[stateOffset + 7]}`
            );
            classicMaxSpecificEnergyDeltaJPerKg = Math.max(
              classicMaxSpecificEnergyDeltaJPerKg,
              Math.abs(
                classicResult.state[stateOffset + 7]
                  - result.state[stateOffset + 7]
              )
            );
            classicMaxTemperatureDeltaK = Math.max(
              classicMaxTemperatureDeltaK,
              Math.abs(
                classicResult.thermo[thermoOffset + 2]
                  - result.thermo[thermoOffset + 2]
              )
            );
          }
          requireTrue(
            classicMaxTemperatureDeltaK < 3,
            `${name}: classic/SS temperature delta ${classicMaxTemperatureDeltaK} K`
          );

          const finalDomains = [];
          let appliedEnergyDeltaJ = 0;
          for (let index = 0; index < packed.particleCount; index += 1) {
            const stateOffset = index * 8;
            const thermoOffset = index * 12;
            const massKg = result.state[stateOffset + 3];
            if (!(massKg > 0)) continue;
            const initialU = proposalSourceState[stateOffset + 7];
            const finalU = result.state[stateOffset + 7];
            const finalTemperature = result.thermo[thermoOffset + 2];
            const materialId = result.thermo[thermoOffset];
            requireTrue(
              finite(finalU) && finite(finalTemperature),
              `${name}: non-finite final carrier ${index}`
            );
            requireTrue(
              finalTemperature > 1 && finalTemperature < 999_999,
              `${name}: carrier ${index} saturated at ${finalTemperature} K`
            );
            const domain = responseDomain(
              thermalMaterialTable,
              materialId,
              finalU
            );
            finalDomains.push(domain);
            requireTrue(
              domain.ready === true
                && finalU >= domain.energyMinJPerKg
                && finalU <= domain.energyMaxJPerKg,
              `${name}: final carrier ${index} U=${finalU} is outside its response domain: ${
                JSON.stringify(domain)
              }`
            );
            const expectedDu = f32(
              f32(proposalRows[index][0]) + f32(proposalRows[index][1])
            );
            const expectedFinalU = f32(f32(initialU) + expectedDu);
            requireTrue(
              near(finalU, expectedFinalU, 0.5, 2.0e-6),
              `${name}: canonical apply row ${index} produced ${finalU}; expected ${expectedFinalU}`
            );
            appliedEnergyDeltaJ += massKg * (finalU - initialU);
          }
          const finalEnergyJ = totalEnergyJ(result.state);
          const applyConservationToleranceJ = Math.max(
            5.0e-2,
            absoluteProposalEnergyJ * 1.0e-5
          );
          requireTrue(
            Math.abs(appliedEnergyDeltaJ) <= applyConservationToleranceJ,
            `${name}: applied reciprocal energy residual ${appliedEnergyDeltaJ} J exceeds ${applyConservationToleranceJ} J`
          );
          requireTrue(
            Math.abs(finalEnergyJ - initialEnergyJ) <= applyConservationToleranceJ,
            `${name}: total energy changed by ${finalEnergyJ - initialEnergyJ} J; tolerance ${applyConservationToleranceJ} J`
          );
          if (requireCentralHeating) {
            requireTrue(
              result.state[7] > proposalSourceState[7],
              `${name}: pure-gas knot carrier did not heat`
            );
          }

          const h2oIndex = particles.findIndex(({ material }) => material === 'h2o');
          requireTrue(h2oIndex >= 0, `${name}: fixture has no H2O carrier`);
          const h2oMaterialId = packed.thermo[h2oIndex * 12];
          const initialH2oPhaseMassKg = phaseMassKg(
            proposalSourceState,
            packed.thermo,
            h2oMaterialId
          );
          const finalH2oPhaseMassKg = phaseMassKg(
            result.state,
            result.thermo,
            h2oMaterialId
          );
          let h2oAcceptedEnergyJ = 0;
          let nonH2oAcceptedEnergyJ = 0;
          for (let index = 0; index < packed.particleCount; index += 1) {
            const stateOffset = index * 8;
            const thermoOffset = index * 12;
            const energyDeltaJ = proposalSourceState[stateOffset + 3]
              * (result.state[stateOffset + 7] - proposalSourceState[stateOffset + 7]);
            if (packed.thermo[thermoOffset] === h2oMaterialId) {
              h2oAcceptedEnergyJ += energyDeltaJ;
            } else {
              nonH2oAcceptedEnergyJ += energyDeltaJ;
            }
          }

          let boundaryEvidence = null;
          if (fusionIngress) {
            const centerPairs = pairLedger
              .filter(({ i, j }) => i === 0 || j === 0)
              .map((pair) => {
                const orientation = pair.i === 0 ? 1 : -1;
                const otherIndex = pair.i === 0 ? pair.j : pair.i;
                return {
                  otherIndex,
                  otherId: particles[otherIndex].id,
                  otherMaterial: particles[otherIndex].material,
                  rawEnergyIntoCenterJ: orientation * pair.rawEnergyIntoIJ,
                  requestedEnergyIntoCenterJ:
                    orientation * pair.requestedEnergyIntoIJ,
                  acceptedEnergyIntoCenterJ:
                    orientation * pair.acceptedEnergyIntoIJ,
                  directionalScale: pair.directionalScale
                };
              });
            const hotFePairCount = centerPairs.filter((pair) => (
              pair.otherMaterial === 'fe' && pair.rawEnergyIntoCenterJ > 0
            )).length;
            const coldH2oPairCount = centerPairs.filter((pair) => (
              pair.otherMaterial === 'h2o' && pair.rawEnergyIntoCenterJ < 0
            )).length;
            const rawSignedEnergyIntoCenterJ = centerPairs.reduce(
              (sum, pair) => sum + pair.rawEnergyIntoCenterJ,
              0
            );
            const requestedSignedEnergyIntoCenterJ = centerPairs.reduce(
              (sum, pair) => sum + pair.requestedEnergyIntoCenterJ,
              0
            );
            const reconstructedAcceptedEnergyIntoCenterJ = centerPairs.reduce(
              (sum, pair) => sum + pair.acceptedEnergyIntoCenterJ,
              0
            );
            const acceptedEnergyIntoCenterJ = carrierEvidence[0].acceptedEnergyJ;
            const residualToFusionBeforeJPerKg = fusionKnotU - packed.state[7];
            const residualToFusionAfterJPerKg = fusionKnotU - result.state[7];
            requireTrue(
              hotFePairCount >= 2 && coldH2oPairCount >= 1,
              `${name}: center pair signs were hot Fe=${hotFePairCount}, cold H2O=${coldH2oPairCount}`
            );
            requireTrue(
              rawSignedEnergyIntoCenterJ > 0
                && requestedSignedEnergyIntoCenterJ > 0
                && acceptedEnergyIntoCenterJ > 0,
              `${name}: center raw/requested/accepted Q was ${rawSignedEnergyIntoCenterJ}/${requestedSignedEnergyIntoCenterJ}/${acceptedEnergyIntoCenterJ} J`
            );
            requireTrue(
              residualToFusionBeforeJPerKg > 0
                && nextF32(packed.state[7]) === fusionKnotU,
              `${name}: initial fusion residual ${residualToFusionBeforeJPerKg} is not one f32 step`
            );
            requireTrue(
              residualToFusionAfterJPerKg < 0
                && result.state[7] <= f32(fusionPlateau.eEnd),
              `${name}: center did not enter bounded fusion plateau: final U=${result.state[7]}, knot=${fusionKnotU}, plateau end=${fusionPlateau.eEnd}`
            );
            requireTrue(
              result.thermo[5] > 0
                && result.thermo[4] < 1
                && result.thermo[6] === 0
                && result.thermo[7] === 0,
              `${name}: center phase ingress was solid/liquid/gas/plasma ${
                result.thermo[4]
              }/${result.thermo[5]}/${result.thermo[6]}/${result.thermo[7]}`
            );
            requireTrue(
              finalH2oPhaseMassKg.liquid > initialH2oPhaseMassKg.liquid,
              `${name}: aggregate H2O liquid mass did not increase`
            );
            boundaryEvidence = {
              fusionKnotU,
              fusionPlateauEndU: f32(fusionPlateau.eEnd),
              oneUlpBelowFusionU,
              residualToFusionBeforeJPerKg,
              residualToFusionAfterJPerKg,
              rawSignedEnergyIntoCenterJ,
              requestedSignedEnergyIntoCenterJ,
              acceptedEnergyIntoCenterJ,
              reconstructedAcceptedEnergyIntoCenterJ,
              limiterRejectedEnergyJ:
                requestedSignedEnergyIntoCenterJ - acceptedEnergyIntoCenterJ,
              hotFePairCount,
              coldH2oPairCount,
              centerPairs,
              centralInitialPhaseFractions: Array.from(packed.thermo.slice(4, 8)),
              centralFinalPhaseFractions: Array.from(result.thermo.slice(4, 8))
            };
          }

          let exactTouchEvidence = null;
          if (exactTouchPlane) {
            const crossMaterialPairs = pairLedger.filter(({ i, j }) => (
              particles[i].material !== particles[j].material
            ));
            const minimumCrossMaterialDistanceM = Math.min(
              ...crossMaterialPairs.map(({ distanceM }) => distanceM)
            );
            requireTrue(
              near(minimumCrossMaterialDistanceM, productionPitchM, 2.0e-6, 2.0e-6),
              `${name}: closest frozen Fe/ice centers are ${minimumCrossMaterialDistanceM} m, not one ${productionPitchM} m pitch`
            );
            requireTrue(
              h2oAcceptedEnergyJ > 0 && nonH2oAcceptedEnergyJ < 0,
              `${name}: exact-touch slab H2O/non-H2O accepted Q was ${h2oAcceptedEnergyJ}/${nonH2oAcceptedEnergyJ} J`
            );
            for (let index = 0; index < packed.particleCount; index += 1) {
              const offset = index * 8;
              requireTrue(
                result.state[offset] === currentState[offset]
                  && result.state[offset + 1] === currentState[offset + 1]
                  && result.state[offset + 2] === currentState[offset + 2],
                `${name}: thermal apply moved frozen carrier ${index}`
              );
            }
            exactTouchEvidence = {
              pitchM: productionPitchM,
              smoothingLengthM: packed.smoothingLengthM,
              minimumCrossMaterialDistanceM,
              crossMaterialPairCount: crossMaterialPairs.length,
              h2oAcceptedEnergyJ,
              nonH2oAcceptedEnergyJ,
              reciprocalResidualJ: h2oAcceptedEnergyJ + nonH2oAcceptedEnergyJ
            };
          }

          return {
            name,
            producerTraversal,
            treeShadowDiagnostics,
            treeArenaIndex: generation.exactNearCellTree.arenaIndex,
            treeArenaGeneration:
              generation.exactNearCellTree.arenaGeneration,
            treeRuntimeCapacity: generation.runtimeCapacity,
            useAggregate,
            useActiveRank,
            activeSourceProjectionMode: proposal.activeSourceProjectionMode,
            particleCount: packed.particleCount,
            inactiveProposalRowCount,
            initialEnergyJ,
            finalEnergyJ,
            reciprocalProposalEnergyJ,
            proposalConservationToleranceJ,
            appliedEnergyDeltaJ,
            applyConservationToleranceJ,
            centralInitialU: proposalSourceState[7],
            centralFinalU: result.state[7],
            centralInitialTemperatureK: packed.thermo[2],
            centralFinalTemperatureK: result.thermo[2],
            maxPositionDisplacementM:
              derivedFloats[displacementHeaderWord],
            activeDispatch,
            currentActiveCount:
              derivedWords[currentActiveCountHeaderWord],
            expectedActiveCount:
              derivedWords[expectedActiveCountHeaderWord],
            materializedRankCount:
              derivedWords[materializedRankCountHeaderWord],
            derivedRows,
            proposalRows,
            conductionEvidence,
            radiationEvidence,
            pairLedger: includePairLedgerInResult ? pairLedger : null,
            thermalCandidateCsrHeader,
            thermalCandidateCsrRowStates,
            thermalCandidateCsrRoute: thermalCandidateCsrHeader?.[
              proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD
            ] ?? null,
            carrierEvidence,
            initialH2oPhaseMassKg,
            finalH2oPhaseMassKg,
            h2oAcceptedEnergyJ,
            nonH2oAcceptedEnergyJ,
            boundaryEvidence,
            exactTouchEvidence,
            sameGenerationTreeParity,
            sameGenerationExhaustiveParity,
            classicMaxTemperatureDeltaK,
            classicMaxSpecificEnergyDeltaJPerKg,
            finalDomains,
            appliedState: includeAppliedRowsInResult
              ? Array.from(result.state)
              : null,
            appliedThermo: includeAppliedRowsInResult
              ? Array.from(result.thermo)
              : null
          };
        } finally {
          canonicalThermalStage?.cleanupAbortedWork?.();
          if (classicBinAuthority) {
            binAuthorityModule
              .releasePostSeparationThermalBinAuthorityAfterQueue(
                classicBinAuthority,
                { device }
              );
            await binAuthorityModule
              .postSeparationThermalBinAuthorityLiveness(classicBinAuthority)
              ?.releasePromise;
          } else {
            classicBinsBuffer?.destroy?.();
          }
          proposal?.releaseAfterCanonicalApplySubmittedWork?.();
          if (generation) {
            spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
              generation,
              device
            );
          }
          try {
            await device.queue.onSubmittedWorkDone();
          } catch (error) {
            const lost = await Promise.race([
              device.lost,
              new Promise((resolve) => setTimeout(
                () => resolve(null),
                1000
              ))
            ]);
            fail(
              `${name}: queue completion failed: ${error?.message || String(error)}; `
              + `deviceLost=${lost ? `${lost.reason}: ${lost.message}` : 'not-reported'}; `
              + `uncaptured=${uncapturedErrors.join(' | ') || 'none'}`
            );
          }
          if (generation?.releasePromise) {
            await generation.releasePromise;
          }
          gpuBuffers.destroySphGpuParticleBuffers(particleUpload);
          if (currentStateBuffer && currentStateBuffer !== particleUpload.stateBuffer) {
            currentStateBuffer.destroy?.();
          }
          transactionMechanicsBuffer?.destroy?.();
          activeNodeBuffer.destroy();
          levelAssignmentBuffer?.destroy?.();
        }
      };

      const cases = [];
      const treeShadowComparisons = [];
      const treeShadowFailureCases = [];
      let thermalTreeTiming = null;
      const compareTreeAndDirect = (name, direct, tree) => {
        for (const field of [
          'derivedRows',
          'proposalRows',
          'conductionEvidence',
          'radiationEvidence',
          'appliedState',
          'appliedThermo'
        ]) {
          const normalizeFreshGenerationIdentity = (value) => (
            field === 'conductionEvidence' || field === 'radiationEvidence'
              ? value.map((word, index) => (
                  index === 10 || index === 11 ? 0 : word
                ))
              : value
          );
          requireTrue(
            JSON.stringify(normalizeFreshGenerationIdentity(tree[field]))
              === JSON.stringify(
                normalizeFreshGenerationIdentity(direct[field])
              ),
            `${name} tree/direct ${field} mismatch: ${
              JSON.stringify({
                direct: direct[field],
                tree: tree[field],
                diagnostics: tree.treeShadowDiagnostics
              })
            }`
          );
        }
        const diagnostics = tree.treeShadowDiagnostics;
        const uniform = direct.conductionEvidence[3] === 0
          && direct.radiationEvidence[3] === 0;
        requireTrue(
          diagnostics?.length
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_DIAGNOSTIC_WORDS
            && (
              uniform
                ? diagnostics.every((value) => value === 0)
                : diagnostics.slice(0, 3).every((value) => value > 0)
            ),
          `${name}: invalid tree traversal diagnostics ${
            JSON.stringify(diagnostics)
          }`
        );
        const receipt = {
          name,
          exact: true,
          uniform,
          diagnostics,
          treeArenaIndex: tree.treeArenaIndex,
          treeArenaGeneration: tree.treeArenaGeneration,
          treeRuntimeCapacity: tree.treeRuntimeCapacity,
          candidateCsrRoute: tree.thermalCandidateCsrRoute
        };
        treeShadowComparisons.push(receipt);
        return receipt;
      };
      const thermalTimingStages = [
        'thermal-producer-apply-total',
        'derived-prepass',
        'directional-budget',
        'candidate-csr-validate-rows',
        'candidate-csr-seal',
        'budget-resolve',
        'reciprocal-limited-proposal'
      ];
      const runThermalTimingPair = async ({
        name,
        particles,
        order,
        ordinal,
        expectedRoute,
        smoothingLengthM = 0.1,
        spatialCellSizeM = 0.1,
        dtS = 0.001,
        conductionRate = 1500
      }) => {
        epochOrdinal += 1;
        const timingEpoch = epochOrdinal;
        const source = sphStateModule.createSphState({
          smoothingLengthM,
          dimension: 3,
          step: timingEpoch,
          particles
        });
        const packed = gpuBuffers.buildSphGpuParticleBuffers(source, {
          materialProperties
        });
        const epoch = {
          storageGeneration: timingEpoch,
          physicsTick: timingEpoch,
          physicsSubstep: 0,
          positionEpoch: timingEpoch,
          topologyEpoch: 0,
          chartEpoch: 0,
          levelEpoch: timingEpoch,
          supportEpoch: timingEpoch
        };
        Object.assign(packed, epoch);
        const particleUpload = gpuBuffers.uploadSphGpuParticleBuffers(
          device,
          packed
        );
        Object.assign(particleUpload, epoch, {
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1
        });
        const assignmentRows = new Float32Array(
          packed.particleCount * 16
        );
        for (let index = 0; index < packed.particleCount; index += 1) {
          const stateOffset = index * 8;
          const thermoOffset = index * 12;
          const massKg = packed.state[stateOffset + 3];
          const restDensityKgPerM3 = packed.thermo[thermoOffset + 3];
          const volumeM3 = Math.max(
            1.0e-12,
            massKg / Math.max(restDensityKgPerM3, 1)
          );
          assignmentRows.set([
            0,
            spatialCellSizeM,
            2 * smoothingLengthM,
            volumeM3,
            volumeM3,
            volumeM3,
            massKg,
            restDensityKgPerM3,
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
        const assignmentBuffer = createTaggedBuffer(
          `ulg-native-thermal-timing-${name}-${ordinal}-assignment`,
          assignmentRows,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const levelAssignment = {
          schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          particleCount: packed.particleCount,
          assignmentStrideFloats: 16,
          assignmentBuffer,
          assignmentBufferByteLength: assignmentRows.byteLength,
          sourceStateBuffer: particleUpload.stateBuffer,
          sourceStateBufferBorrowed: true,
          minLevel: 0,
          maxLevel: 0,
          chartId: 0,
          baseGridSpacingM: spatialCellSizeM,
          phaseVolumeAssignmentOverlayEnabled: false,
          ...epoch
        };
        const mechanicsBuffer = createTaggedBuffer(
          `ulg-native-thermal-timing-${name}-${ordinal}-mechanics`,
          new Float32Array(packed.particleCount * 24),
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const mlsMpmParticleUpload = { mechanicsBuffer };
        let generation = null;
        let treeBuildTimer = null;
        try {
          treeBuildTimer = createTimestampRecorder(
            `ulg-native-thermal-timing-${name}-${ordinal}-tree-build`,
            ['exact-near-cell-tree-build']
          );
          generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
            device,
            levelAssignment,
            particleCount: packed.particleCount,
            particleIdentityBuffer: particleUpload.identityBuffer,
            particleIdentityStrideWords: 1,
            particleBufferSet: null,
            laneId: `native-thermal-timing-${name}`,
            sourceFamily: `native-thermal-timing-${name}`,
            mechanicsLevels: [],
            gpuTimestampRecorder: treeBuildTimer.recorder
          });
          requireTrue(
            generation.ready === true
              && generation.selected === true
              && generation.activeRankView != null
              && generation.exactNearCellTree != null,
            `${name}/${ordinal}: timing generation rejected: ${
              generation.reason || generation.status
            }`
          );
          await device.queue.onSubmittedWorkDone();
          const buildTiming = await treeBuildTimer.complete();
          treeBuildTimer.destroy();
          treeBuildTimer = null;

          const consumerSupportProfileIds = Object.fromEntries(
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(
              (consumer) => [
                consumer.consumerId,
                consumer.supportProfileId
              ]
            )
          );
          const schroederSpatialEpochTransaction = transactionModule
            .createSchroederSpatialEpochTransaction({
              device,
              generation,
              sphParticleUpload: particleUpload,
              mlsMpmParticleUpload,
              requiredReaderIds: [],
              enabledConsumerReaderIds:
                Object.keys(consumerSupportProfileIds),
              consumerSupportProfileIds
            });
          const runArm = async (route) => {
            let proposal = null;
            let stage = null;
            let submitted = false;
            let timer = null;
            try {
              proposal =
                proposalModule.runSchroederSpatialThermalProposalWebGpu({
                  device,
                  generation,
                  schroederSpatialEpochTransaction,
                  sphParticleState: packed,
                  sphParticleUpload: particleUpload,
                  mlsMpmParticleUpload,
                  thermalResponseGraphUpload: responseUpload,
                  dtS,
                  smoothingLengthM: packed.smoothingLengthM,
                  conductionRate
                });
              if (route === 'tree') {
                const receipt = proposalModule
                  .armSchroederSpatialThermalTreeShadowForNativeTest({
                    device,
                    schroederSpatialThermalProposal: proposal,
                    observeTraversalCounters: false
                  });
                requireTrue(
                  receipt.tree === generation.exactNearCellTree
                    && receipt.diagnosticBuffer == null,
                  `${name}/${ordinal}: timing tree was not unobserved`
                );
              }
              timer = createTimestampRecorder(
                `ulg-native-thermal-timing-${name}-${ordinal}-${route}`,
                thermalTimingStages
              );
              stage = thermal.createSphThermalStepWebGpuEncoderStage({
                device,
                sphParticleState: packed,
                thermalMaterialTable,
                thermalClosureGraphSet: graphSet,
                thermalClosureGraphBank: graphSet.graphBank,
                thermalPhaseResponseTable: phaseResponseTable,
                thermalResponseGraphUpload: responseUpload,
                sphParticleUpload: particleUpload,
                proposalStateBuffer: particleUpload.stateBuffer,
                proposalThermoBuffer: particleUpload.thermoBuffer,
                sourceStateBuffer: particleUpload.stateBuffer,
                sourceThermoBuffer: particleUpload.thermoBuffer,
                wallTemperaturesK: {},
                boxDimsM: [1000, 1000, 1000],
                dtS,
                conductionRate,
                wallRate: 0,
                wallLayerM: 0,
                ambientTemperatureK: 0,
                readbackMode: 'no-full-readback',
                schroederSpatialEpochGeneration: generation,
                schroederSpatialThermalProposal: proposal,
                gpuTimestampRecorder: timer.recorder
              });
              const encoder = device.createCommandEncoder({
                label:
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}`
              });
              const totalSpan = timer.recorder.beginEncoderSpan(encoder, {
                producerId: `s9d4-thermal-${route}`,
                stage: 'thermal-producer-apply-total',
                generationId: generation.execution.generationId
              });
              stage.encode(encoder);
              timer.recorder.endEncoderSpan(encoder, totalSpan);
              device.queue.submit([encoder.finish()]);
              stage.markSubmittedWork();
              submitted = true;
              const timing = await timer.complete();
              const csrHeader = Array.from(new Uint32Array(await readBuffer(
                proposal.thermalCandidateCsr.replayBuffer,
                proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
                  * Uint32Array.BYTES_PER_ELEMENT,
                `ulg-native-thermal-timing-${name}-${ordinal}-${route}-csr`
              )));
              const csrStatus = csrHeader[
                proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
              ];
              const csrRoute = csrHeader[
                proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD
              ];
              requireTrue(
                (csrRoute & expectedRoute) !== 0
                  && (
                    expectedRoute
                      === proposalModule
                        .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY
                      ? (
                          csrStatus
                            & proposalModule
                              .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY
                        ) !== 0
                      : (
                          csrStatus
                            & proposalModule
                              .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW
                        ) !== 0
                  ),
                `${name}/${ordinal}/${route}: unexpected CSR status/route ${
                  csrStatus
                }/${csrRoute}`
              );
              return { timing, csrStatus, csrRoute };
            } finally {
              timer?.destroy?.();
              if (stage) {
                if (submitted) {
                  stage.cleanupSubmittedWork?.();
                } else {
                  stage.cleanupAbortedWork?.();
                }
              } else {
                proposal?.abandonPreparedWork?.(
                  `timing-${route}-setup-failed`
                );
              }
              await device.queue.onSubmittedWorkDone();
              for (
                let waitOrdinal = 0;
                waitOrdinal < 100 && proposal?.released !== true;
                waitOrdinal += 1
              ) {
                await new Promise((resolve) => setTimeout(resolve, 0));
              }
              requireTrue(
                proposal?.released === true,
                `${name}/${ordinal}/${route}: proposal arena did not release`
              );
            }
          };

          const firstRoute = order === 'direct-tree' ? 'direct' : 'tree';
          const secondRoute = firstRoute === 'direct' ? 'tree' : 'direct';
          const first = await runArm(firstRoute);
          const second = await runArm(secondRoute);
          return {
            name,
            order,
            ordinal,
            particleCount: packed.particleCount,
            treeBuildMs: buildTiming['exact-near-cell-tree-build'],
            direct: firstRoute === 'direct' ? first : second,
            tree: firstRoute === 'tree' ? first : second
          };
        } finally {
          treeBuildTimer?.destroy?.();
          if (generation) {
            spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
              generation,
              device
            );
          }
          await device.queue.onSubmittedWorkDone();
          if (generation?.releasePromise) {
            await generation.releasePromise;
          }
          mechanicsBuffer.destroy?.();
          assignmentBuffer.destroy?.();
          gpuBuffers.destroySphGpuParticleBuffers(particleUpload);
        }
      };
      try {
        const mixedBoilingParticles = [
          {
            id: 'h2o-mixed-boiling-carrier',
            material: 'h2o',
            x: [5, 5, 5],
            v: [0, 0, 0],
            massKg: 1.0e-5,
            specificInternalEnergyJPerKg: boilingMidpointU
          },
          {
            id: 'fe-hot-x-min',
            material: 'fe',
            x: [4.96, 5, 5],
            v: [0, 0, 0],
            massKg: 1.0e-2,
            specificInternalEnergyJPerKg: ironHotU
          },
          {
            id: 'fe-hot-x-max',
            material: 'fe',
            x: [5.04, 5, 5],
            v: [0, 0, 0],
            massKg: 1.0e-2,
            specificInternalEnergyJPerKg: ironHotU
          },
          {
            id: 'fe-cold-y-min',
            material: 'fe',
            x: [5, 4.96, 5],
            v: [0, 0, 0],
            massKg: 1.0e-2,
            specificInternalEnergyJPerKg: ironColdU
          },
          {
            id: 'fe-cold-y-max',
            material: 'fe',
            x: [5, 5.04, 5],
            v: [0, 0, 0],
            massKg: 1.0e-2,
            specificInternalEnergyJPerKg: ironColdU
          }
        ];
        cases.push(await runFixture({
          name: 'mixed-boiling-plateau-four-neighbor',
          particles: mixedBoilingParticles,
          includeAppliedRowsInResult: runNativeTreeShadow,
          sameGenerationTreeShadow: runNativeTreeShadow,
          sameGenerationExhaustiveShadow: runNativeTreeShadow
        }));
        requireTrue(
          cases[0].derivedRows[0][1] === 0,
          `mixed plateau slope was ${cases[0].derivedRows[0][1]}, not zero`
        );
        if (runNativeTreeShadow) {
          const tree = await runFixture({
            name: 'tree-shadow-mixed-boiling-plateau-four-neighbor',
            particles: mixedBoilingParticles,
            producerTraversal: 'native-test-tree-shadow',
            includeAppliedRowsInResult: true
          });
          const mixedComparison = compareTreeAndDirect(
            'mixed-boiling-plateau-four-neighbor',
            cases[0],
            tree
          );
          const sameGenerationTree =
            cases[0].sameGenerationTreeParity;
          requireTrue(
            sameGenerationTree?.treeArenaIndex === tree.treeArenaIndex
              && sameGenerationTree.treeArenaGeneration
                < tree.treeArenaGeneration
              && cases[0].treeRuntimeCapacity === tree.treeRuntimeCapacity,
            `mixed tree arena was not reused after the same-generation control: ${
              JSON.stringify({
                sameGenerationTree,
                freshTree: {
                  treeArenaIndex: tree.treeArenaIndex,
                  treeArenaGeneration: tree.treeArenaGeneration,
                  treeRuntimeCapacity: tree.treeRuntimeCapacity
                }
              })
            }`
          );
          mixedComparison.arenaReuse = {
            exact: true,
            arenaIndex: tree.treeArenaIndex,
            previousArenaGeneration:
              sameGenerationTree.treeArenaGeneration,
            currentArenaGeneration: tree.treeArenaGeneration,
            runtimeCapacity: tree.treeRuntimeCapacity
          };
          mixedComparison.sameGeneration = true;
          mixedComparison.byteReceipts =
            sameGenerationTree.byteReceipts;
          mixedComparison.exhaustiveByteReceipts =
            cases[0].sameGenerationExhaustiveParity.byteReceipts;
          mixedComparison.exhaustiveSemanticReceipts =
            cases[0].sameGenerationExhaustiveParity.semanticReceipts;
        }

        cases.push(await runFixture({
          name: 'pure-gas-shared-boil-knot',
          requireCentralHeating: true,
          particles: [
            {
              id: 'h2o-pure-gas-boil-knot',
              material: 'h2o',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-5,
              specificInternalEnergyJPerKg: boilingGasKnotU
            },
            {
              id: 'fe-hot-neighbor',
              material: 'fe',
              x: [5.04, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironHotU
            }
          ]
        }));
        requireTrue(
          cases[1].centralFinalU > cases[1].centralInitialU,
          'shared-knot gas carrier did not receive bounded heat'
        );

        cases.push(await runFixture({
          name: 'fusion-minus-one-ulp-hot-iron-boundary-star',
          smoothingLengthM: productionSmoothingLengthM,
          spatialCellSizeM: productionPitchM,
          nativeGridSpacingM: productionPitchM,
          fusionIngress: true,
          particles: [
            {
              id: 'h2o-fusion-minus-one-ulp-center',
              material: 'h2o',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: productionIceMassKg,
              specificInternalEnergyJPerKg: oneUlpBelowFusionU
            },
            {
              id: 'fe-hot-x-min-production-neighbor',
              material: 'fe',
              x: [5 - productionPitchM, 5, 5],
              v: [0, 0, 0],
              massKg: productionIronMassKg,
              specificInternalEnergyJPerKg: productionIronHotU
            },
            {
              id: 'fe-hot-x-max-production-neighbor',
              material: 'fe',
              x: [5 + productionPitchM, 5, 5],
              v: [0, 0, 0],
              massKg: productionIronMassKg,
              specificInternalEnergyJPerKg: productionIronHotU
            },
            {
              id: 'h2o-cold-y-min-production-neighbor',
              material: 'h2o',
              x: [5, 5 - productionPitchM, 5],
              v: [0, 0, 0],
              massKg: productionIceMassKg,
              specificInternalEnergyJPerKg: productionIceColdU
            }
          ]
        }));
        requireTrue(
          cases[2].boundaryEvidence?.acceptedEnergyIntoCenterJ > 0
            && cases[2].boundaryEvidence?.residualToFusionAfterJPerKg < 0,
          'one-ULP fusion boundary star did not prove accepted phase ingress'
        );

        const frozenSlabParticles = [];
        const pushFourLaneCarrier = (particle) => {
          frozenSlabParticles.push(particle);
          for (let lane = 1; lane < 4; lane += 1) {
            frozenSlabParticles.push({
              ...particle,
              id: `${particle.id}-inactive-lane-${lane}`,
              massKg: 0
            });
          }
        };
        for (const xOffset of [-0.5, 0.5]) {
          for (const zOffset of [-0.5, 0.5]) {
            pushFourLaneCarrier({
              id: `h2o-ice-plane-${xOffset}-${zOffset}`,
              material: 'h2o',
              x: [
                5 + xOffset * productionPitchM,
                5,
                5 + zOffset * productionPitchM
              ],
              v: [0, 0, 0],
              massKg: productionIceMassKg,
              specificInternalEnergyJPerKg: productionIceColdU
            });
          }
        }
        for (const xOffset of [-0.5, 0.5]) {
          for (const zOffset of [-0.5, 0.5]) {
            pushFourLaneCarrier({
              id: `fe-hot-plane-${xOffset}-${zOffset}`,
              material: 'fe',
              x: [
                5 + xOffset * productionPitchM,
                5 + productionPitchM,
                5 + zOffset * productionPitchM
              ],
              v: [0, 0, 0],
              massKg: productionIronMassKg,
              specificInternalEnergyJPerKg: productionIronHotU
            });
          }
        }
        cases.push(await runFixture({
          name: 'sparse-four-lane-frozen-exact-touch-iron-ice-planes',
          smoothingLengthM: productionSmoothingLengthM,
          spatialCellSizeM: productionPitchM,
          nativeGridSpacingM: productionPitchM,
          exactTouchPlane: true,
          particles: frozenSlabParticles
        }));
        requireTrue(
          cases[3].exactTouchEvidence?.h2oAcceptedEnergyJ > 0,
          'frozen exact-touch Fe/ice planes had no live conductive exchange'
        );
        requireTrue(
          cases[3].particleCount === 32
            && cases[3].inactiveProposalRowCount === 24,
          `sparse exact-touch fixture published ${
            cases[3].inactiveProposalRowCount
          } inactive rows of ${cases[3].particleCount}`
        );

        cases.push(await runFixture({
          name: 'matched-time-current-contact-frozen-separated',
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          particles: [
            {
              id: 'h2o-cold-frozen-origin',
              material: 'h2o',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-3,
              specificInternalEnergyJPerKg: productionIceColdU
            },
            {
              id: 'fe-hot-frozen-far',
              material: 'fe',
              x: [5.5, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironHotU
            }
          ],
          currentPositions: [
            [5, 5, 5],
            [5.05, 5, 5]
          ]
        }));
        requireTrue(
          cases[4].centralFinalU > cases[4].centralInitialU
            && near(cases[4].maxPositionDisplacementM, 0.45, 2.0e-5, 2.0e-5),
          `current-contact/frozen-separated fixture did not exchange heat with Dmax ${
            cases[4].maxPositionDisplacementM
          }`
        );

        cases.push(await runFixture({
          name: 'matched-time-current-separated-frozen-contact',
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          particles: [
            {
              id: 'h2o-cold-frozen-origin-contact',
              material: 'h2o',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-3,
              specificInternalEnergyJPerKg: productionIceColdU
            },
            {
              id: 'fe-hot-frozen-near',
              material: 'fe',
              x: [5.05, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironHotU
            }
          ],
          currentPositions: [
            [5, 5, 5],
            [5.5, 5, 5]
          ]
        }));
        requireTrue(
          cases[5].centralFinalU === cases[5].centralInitialU
            && near(cases[5].maxPositionDisplacementM, 0.45, 2.0e-5, 2.0e-5),
          `current-separated/frozen-contact fixture exchanged heat or reported Dmax ${
            cases[5].maxPositionDisplacementM
          }`
        );

        const allDormantParticles = Array.from({ length: 4 }, (_, index) => ({
          id: `all-dormant-${index}`,
          material: index % 2 === 0 ? 'h2o' : 'fe',
          x: [4 + index * 0.2, 4, 4],
          v: [0, 0, 0],
          massKg: 0,
          specificInternalEnergyJPerKg:
            index % 2 === 0 ? productionIceColdU : ironColdU
        }));
        cases.push(await runFixture({
          name: 'all-dormant-active-dispatch',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false
        }));
        requireTrue(
          cases[6].currentActiveCount === 0
            && cases[6].expectedActiveCount === 0
            && cases[6].materializedRankCount === 0
            && cases[6].activeDispatch[0] === 1
            && cases[6].inactiveProposalRowCount === 4,
          `all-dormant dispatch contract failed: ${JSON.stringify(cases[6])}`
        );

        cases.push(await runFixture({
          name: 'all-dormant-current-active-mismatch-fails-closed',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          currentMasses: [1.0e-3, 0, 0, 0],
          expectProducerFailClosed: true,
          requireThermalExchange: false
        }));

        const corruptedProjectionParticles = [
          {
            id: 'projection-active-h2o',
            material: 'h2o',
            x: [5, 5, 5],
            v: [0, 0, 0],
            massKg: 1.0e-3,
            specificInternalEnergyJPerKg: productionIceColdU
          },
          {
            id: 'projection-dormant-h2o',
            material: 'h2o',
            x: [5.01, 5, 5],
            v: [0, 0, 0],
            massKg: 0,
            specificInternalEnergyJPerKg: productionIceColdU
          },
          {
            id: 'projection-active-fe',
            material: 'fe',
            x: [5.02, 5, 5],
            v: [0, 0, 0],
            massKg: 1.0e-2,
            specificInternalEnergyJPerKg: ironHotU
          },
          {
            id: 'projection-dormant-fe',
            material: 'fe',
            x: [5.03, 5, 5],
            v: [0, 0, 0],
            massKg: 0,
            specificInternalEnergyJPerKg: ironHotU
          }
        ];
        cases.push(await runFixture({
          name: 'corrupt-active-projection-entry-fails-closed',
          particles: corruptedProjectionParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          corruptActiveProjection: { ordinal: 0, sourceIndex: 1 },
          expectProducerFailClosed: true,
          requireThermalExchange: false
        }));

        const multiWorkgroupParticles = Array.from({ length: 65 }, (_, index) => ({
          id: `active-dispatch-two-workgroups-${index}`,
          material: index === 0 ? 'h2o' : 'fe',
          x: index === 0
            ? [8, 8, 8]
            : [
                2 + (index % 13) * 0.2,
                2 + Math.floor(index / 13) * 0.2,
                2
              ],
          v: [0, 0, 0],
          massKg: 1.0e-3,
          specificInternalEnergyJPerKg:
            index === 0 ? productionIceColdU : ironColdU
        }));
        cases.push(await runFixture({
          name: 'sixty-five-active-indirect-two-workgroups',
          particles: multiWorkgroupParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false
        }));
        requireTrue(
          cases[9].currentActiveCount === 65
            && cases[9].expectedActiveCount === 65
            && cases[9].materializedRankCount === 65
            && cases[9].activeDispatch[0] === 2,
          `65-active dispatch contract failed: ${JSON.stringify(cases[9])}`
        );

        const localSparse = await runFixture({
          name: 'local-rank-mask-sparse-four-lane-iron-ice-planes',
          smoothingLengthM: productionSmoothingLengthM,
          spatialCellSizeM: productionPitchM,
          nativeGridSpacingM: productionPitchM,
          exactTouchPlane: true,
          particles: frozenSlabParticles,
          useAggregate: false
        });
        cases.push(localSparse);
        requireTrue(
          localSparse.particleCount === 32
            && localSparse.currentActiveCount === 8
            && localSparse.materializedRankCount === 8
            && localSparse.inactiveProposalRowCount === 24
            && localSparse.exactTouchEvidence?.h2oAcceptedEnergyJ > 0,
          `local sparse rank mask failed: ${JSON.stringify(localSparse)}`
        );

        const localDormant = await runFixture({
          name: 'local-rank-mask-all-dormant',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false
        });
        cases.push(localDormant);
        requireTrue(
          localDormant.currentActiveCount === 0
            && localDormant.expectedActiveCount === 0
            && localDormant.materializedRankCount === 0
            && localDormant.inactiveProposalRowCount === 4,
          `local all-dormant rank mask failed: ${JSON.stringify(localDormant)}`
        );

        cases.push(await runFixture({
          name: 'local-rank-mask-current-active-mismatch-fails-closed',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          currentMasses: [1.0e-3, 0, 0, 0],
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false
        }));

        const localSparseMultiWorkgroupParticles = Array.from(
          { length: 130 },
          (_, index) => {
            const sourceGroup = Math.floor(index / 2);
            const sourceLane = index % 2;
            const active = sourceLane === 1;
            return {
              id: `local-rank-mask-sparse-two-workgroups-${index}`,
              material: active && sourceGroup === 0 ? 'h2o' : 'fe',
              x: [
                2 + (sourceGroup % 13) * 0.2,
                2 + Math.floor(sourceGroup / 13) * 0.2,
                2 + sourceLane * 0.01
              ],
              v: [0, 0, 0],
              massKg: active ? 1.0e-3 : 0,
              specificInternalEnergyJPerKg:
                active && sourceGroup === 0 ? productionIceColdU : ironColdU
            };
          }
        );
        const localMultiWorkgroup = await runFixture({
          name: 'local-rank-mask-sixty-five-active',
          particles: localSparseMultiWorkgroupParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false
        });
        cases.push(localMultiWorkgroup);
        requireTrue(
          localMultiWorkgroup.particleCount === 130
            && localMultiWorkgroup.currentActiveCount === 65
            && localMultiWorkgroup.expectedActiveCount === 65
            && localMultiWorkgroup.materializedRankCount === 65
            && localMultiWorkgroup.inactiveProposalRowCount === 65
            && localMultiWorkgroup.activeDispatch[0] === 2,
          `local sparse 65-active rank mask failed: ${JSON.stringify(localMultiWorkgroup)}`
        );

        const baseSparse = await runFixture({
          name: 'base-active-rank-sparse-four-lane-iron-ice-planes',
          smoothingLengthM: productionSmoothingLengthM,
          spatialCellSizeM: productionPitchM,
          nativeGridSpacingM: productionPitchM,
          exactTouchPlane: true,
          particles: frozenSlabParticles,
          useAggregate: false,
          useActiveRank: true
        });
        cases.push(baseSparse);
        requireTrue(
          baseSparse.activeSourceProjectionMode
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
            && baseSparse.particleCount === 32
            && baseSparse.currentActiveCount === 8
            && baseSparse.expectedActiveCount === 8
            && baseSparse.materializedRankCount === 8
            && baseSparse.inactiveProposalRowCount === 24
            && baseSparse.exactTouchEvidence?.h2oAcceptedEnergyJ > 0,
          `base active-rank sparse thermal path failed: ${JSON.stringify(baseSparse)}`
        );

        const baseDormant = await runFixture({
          name: 'base-active-rank-all-dormant',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useActiveRank: true
        });
        cases.push(baseDormant);
        requireTrue(
          baseDormant.currentActiveCount === 0
            && baseDormant.expectedActiveCount === 0
            && baseDormant.materializedRankCount === 0
            && baseDormant.activeDispatch[0] === 1
            && baseDormant.inactiveProposalRowCount === 4,
          `base active-rank all-dormant path failed: ${JSON.stringify(baseDormant)}`
        );

        const baseMismatch = await runFixture({
          name: 'base-active-rank-current-active-mismatch-fails-closed',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          currentMasses: [1.0e-3, 0, 0, 0],
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useActiveRank: true
        });
        cases.push(baseMismatch);
        requireTrue(
          baseMismatch.expectedFailClosed === true,
          `base active-rank current mass mismatch did not fail closed: ${
            JSON.stringify(baseMismatch)
          }`
        );

        const baseCorruptProjection = await runFixture({
          name: 'base-active-rank-corrupt-paired-index-fails-closed',
          particles: corruptedProjectionParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          corruptActiveProjection: { ordinal: 0, sourceIndex: 1 },
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useActiveRank: true
        });
        cases.push(baseCorruptProjection);
        requireTrue(
          baseCorruptProjection.expectedFailClosed === true,
          `base active-rank paired-index corruption did not fail closed: ${
            JSON.stringify(baseCorruptProjection)
          }`
        );

        const baseMultiWorkgroup = await runFixture({
          name: 'base-active-rank-sixty-five-active',
          particles: multiWorkgroupParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useActiveRank: true
        });
        cases.push(baseMultiWorkgroup);
        requireTrue(
          baseMultiWorkgroup.particleCount === 65
            && baseMultiWorkgroup.currentActiveCount === 65
            && baseMultiWorkgroup.expectedActiveCount === 65
            && baseMultiWorkgroup.materializedRankCount === 65
            && baseMultiWorkgroup.activeDispatch[0] === 2,
          `base active-rank 65-active dispatch failed: ${
            JSON.stringify(baseMultiWorkgroup)
          }`
        );

        // LOCAL source projection makes the outer dispatch sparse, but the
        // canonical directory intentionally retains dormant phase companions
        // and spare source capacity. This exercises a 1,026-source directory
        // with only two live rows. Before dormant peers are terminal-accounted
        // the raw row would need 1,027 words (1,026 peers plus its terminal),
        // exceeding the bounded 1,025-word receipt. After accounting, each
        // live row has its two raw live peers plus one terminal record and
        // must seal/replay rather than rewalk.
        const localDormantCapacityParticles = Array.from(
          { length: 1026 },
          (_, index) => {
            const active = index < 2;
            const isWater = index % 2 === 0;
            return {
              id: `local-csr-dormant-capacity-${index}`,
              material: isWater ? 'h2o' : 'fe',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: active ? 1.0e-4 : 0,
              specificInternalEnergyJPerKg: isWater
                ? productionIceColdU
                : ironHotU
            };
          }
        );
        const localDormantCapacityReplay = await runFixture({
          name: 'local-two-live-plus-one-thousand-twenty-four-dormant-csr-replays',
          particles: localDormantCapacityParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          useAggregate: false,
          includePairLedgerInResult: false
        });
        cases.push(localDormantCapacityReplay);
        const localDormantCapacityStatus = localDormantCapacityReplay
          .thermalCandidateCsrHeader?.[
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
          ] || 0;
        const localDormantCapacityRowStride = localDormantCapacityReplay
          .thermalCandidateCsrHeader?.[
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROW_STRIDE_WORD
          ] || 0;
        const localDormantCapacitySourceCapacity = localDormantCapacityReplay
          .thermalCandidateCsrHeader?.[2] || 0;
        const localDormantCapacityInvalidMask = proposalModule
          .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID
          | proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW;
        const localDormantCapacityReadyMask = proposalModule
          .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY
          | proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_ROWS_FINALIZED
          | proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_VALIDATED;
        requireTrue(
          localDormantCapacityReplay.activeSourceProjectionMode
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_LOCAL
            && localDormantCapacityReplay.particleCount === 1026
            && localDormantCapacityReplay.currentActiveCount === 2
            && localDormantCapacityReplay.expectedActiveCount === 2
            && localDormantCapacityReplay.materializedRankCount === 2
            && localDormantCapacityReplay.inactiveProposalRowCount === 1024
            && localDormantCapacityReplay.activeDispatch[0] === 1
            && localDormantCapacityRowStride === 1025
            && localDormantCapacitySourceCapacity >= 1026
            && localDormantCapacitySourceCapacity > localDormantCapacityRowStride
            && (localDormantCapacityStatus & localDormantCapacityReadyMask)
              === localDormantCapacityReadyMask
            && (localDormantCapacityStatus & localDormantCapacityInvalidMask) === 0
            && (localDormantCapacityReplay.thermalCandidateCsrRoute
              & proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY) !== 0
            && localDormantCapacityReplay.thermalCandidateCsrRowStates?.length
              === localDormantCapacitySourceCapacity
            && localDormantCapacityReplay.thermalCandidateCsrRowStates
              .slice(0, 2)
              .every((rowState) => rowState === 3)
            && localDormantCapacityReplay.thermalCandidateCsrRowStates
              .slice(2)
              .every((rowState) => rowState === 0)
            && localDormantCapacityReplay.h2oAcceptedEnergyJ > 0
            && localDormantCapacityReplay.nonH2oAcceptedEnergyJ < 0,
          `LOCAL dormant capacity did not seal/replay its bounded CSR: ${JSON.stringify({
            status: localDormantCapacityStatus,
            route: localDormantCapacityReplay.thermalCandidateCsrRoute,
            sourceCapacity: localDormantCapacitySourceCapacity,
            rowStride: localDormantCapacityRowStride,
            active: localDormantCapacityReplay.currentActiveCount,
            expected: localDormantCapacityReplay.expectedActiveCount,
            materialized: localDormantCapacityReplay.materializedRankCount,
            dispatch: localDormantCapacityReplay.activeDispatch,
            firstRows: localDormantCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(0, 4),
            firstDormantRows: localDormantCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(2, 6),
            h2oAcceptedEnergyJ: localDormantCapacityReplay.h2oAcceptedEnergyJ,
            nonH2oAcceptedEnergyJ: localDormantCapacityReplay.nonH2oAcceptedEnergyJ
          })}`
        );

        // The candidate receipt must also compact ordinary *live* candidates
        // when the authoritative matched-time pair law proves they are
        // outside both thermal supports.  Freeze every source into one
        // directory cell, then move all 1,026 active carriers onto a
        // half-metre-spaced current grid.  The matched-time displacement
        // expands the exact query enough to visit the whole frozen cell, but
        // every non-self pair is a physical no-op. Without terminal accounting
        // this would require 1,027 raw words per source and falsely rewalk.
        const activeSeparatedCapacityParticles = Array.from(
          { length: 1026 },
          (_, index) => {
            const isWater = index % 2 === 0;
            return {
              id: `active-csr-separated-capacity-${index}`,
              material: isWater ? 'h2o' : 'fe',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-4,
              specificInternalEnergyJPerKg: isWater
                ? productionIceColdU
                : ironHotU
            };
          }
        );
        const activeSeparatedCurrentPositions = Array.from(
          { length: activeSeparatedCapacityParticles.length },
          (_, index) => [
            (index % 11) * 0.5,
            (Math.floor(index / 11) % 11) * 0.5,
            Math.floor(index / 121) * 0.5
          ]
        );
        const activeSeparatedCapacityReplay = await runFixture({
          name: 'active-one-thousand-twenty-six-currently-separated-csr-replays',
          particles: activeSeparatedCapacityParticles,
          currentPositions: activeSeparatedCurrentPositions,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useActiveRank: true,
          includePairLedgerInResult: false
        });
        cases.push(activeSeparatedCapacityReplay);
        const activeSeparatedStatus = activeSeparatedCapacityReplay
          .thermalCandidateCsrHeader?.[
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
          ] || 0;
        const activeSeparatedSourceCapacity = activeSeparatedCapacityReplay
          .thermalCandidateCsrHeader?.[2] || 0;
        const activeSeparatedExpectedCandidateVisits = 1026 * 1025 * 2;
        requireTrue(
          activeSeparatedCapacityReplay.activeSourceProjectionMode
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
            && activeSeparatedCapacityReplay.currentActiveCount === 1026
            && activeSeparatedCapacityReplay.expectedActiveCount === 1026
            && activeSeparatedCapacityReplay.materializedRankCount === 1026
            && activeSeparatedCapacityReplay.activeDispatch[0] === 17
            && activeSeparatedSourceCapacity >= 1026
            && (activeSeparatedStatus & localDormantCapacityReadyMask)
              === localDormantCapacityReadyMask
            && (activeSeparatedStatus & localDormantCapacityInvalidMask) === 0
            && (activeSeparatedCapacityReplay.thermalCandidateCsrRoute
              & proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY) !== 0
            && activeSeparatedCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(0, 1026)
              .every((rowState) => rowState === 2)
            && activeSeparatedCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(1026)
              .every((rowState) => rowState === 0)
            && activeSeparatedCapacityReplay.conductionEvidence[3]
              === activeSeparatedExpectedCandidateVisits
            && activeSeparatedCapacityReplay.radiationEvidence[3]
              === activeSeparatedExpectedCandidateVisits
            && activeSeparatedCapacityReplay.conductionEvidence[4] === 0
            && activeSeparatedCapacityReplay.radiationEvidence[4] === 0
            && activeSeparatedCapacityReplay.proposalRows.every((row) => (
              row[0] === 0 && row[1] === 0
            ))
            && Math.abs(activeSeparatedCapacityReplay.h2oAcceptedEnergyJ) <= 1.0e-7
            && Math.abs(activeSeparatedCapacityReplay.nonH2oAcceptedEnergyJ) <= 1.0e-7,
          `active no-support capacity did not compact into sealed CSR rows: ${JSON.stringify({
            status: activeSeparatedStatus,
            route: activeSeparatedCapacityReplay.thermalCandidateCsrRoute,
            sourceCapacity: activeSeparatedSourceCapacity,
            firstRows: activeSeparatedCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(0, 4),
            candidateVisits: [
              activeSeparatedCapacityReplay.conductionEvidence[3],
              activeSeparatedCapacityReplay.radiationEvidence[3]
            ],
            maskHits: [
              activeSeparatedCapacityReplay.conductionEvidence[4],
              activeSeparatedCapacityReplay.radiationEvidence[4]
            ],
            acceptedEnergyJ: [
              activeSeparatedCapacityReplay.h2oAcceptedEnergyJ,
              activeSeparatedCapacityReplay.nonH2oAcceptedEnergyJ
            ]
          })}`
        );

        // Keep one true matched-time contact among the same broad frozen
        // directory candidates. The contact must remain raw and transfer heat,
        // while every unrelated live peer is terminal-accounted. This pins the
        // optimization to law-proven no-ops rather than a material or distance
        // heuristic that could silently discard a real interaction.
        const activeNearFarCurrentPositions = [
          [5, 5, 5],
          [5.05, 5, 5]
        ];
        for (
          let z = 0;
          z <= 10 && activeNearFarCurrentPositions.length < 1026;
          z += 1
        ) {
          for (
            let y = 0;
            y <= 10 && activeNearFarCurrentPositions.length < 1026;
            y += 1
          ) {
            for (
              let x = 0;
              x <= 10 && activeNearFarCurrentPositions.length < 1026;
              x += 1
            ) {
              if (Math.hypot(x - 5, y - 5, z - 5) < 1) continue;
              activeNearFarCurrentPositions.push([x, y, z]);
            }
          }
        }
        requireTrue(
          activeNearFarCurrentPositions.length === 1026,
          'active near/far current-position fixture is undersized'
        );
        const activeNearFarCapacityReplay = await runFixture({
          name: 'active-one-thousand-twenty-six-one-near-pair-csr-replays',
          particles: activeSeparatedCapacityParticles,
          currentPositions: activeNearFarCurrentPositions,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          useAggregate: false,
          useActiveRank: true,
          includePairLedgerInResult: false
        });
        cases.push(activeNearFarCapacityReplay);
        const activeNearFarStatus = activeNearFarCapacityReplay
          .thermalCandidateCsrHeader?.[
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
          ] || 0;
        const activeNearFarSourceCapacity = activeNearFarCapacityReplay
          .thermalCandidateCsrHeader?.[2] || 0;
        requireTrue(
          activeNearFarCapacityReplay.activeSourceProjectionMode
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
            && activeNearFarCapacityReplay.currentActiveCount === 1026
            && activeNearFarCapacityReplay.expectedActiveCount === 1026
            && activeNearFarCapacityReplay.materializedRankCount === 1026
            && activeNearFarSourceCapacity >= 1026
            && (activeNearFarStatus & localDormantCapacityReadyMask)
              === localDormantCapacityReadyMask
            && (activeNearFarStatus & localDormantCapacityInvalidMask) === 0
            && (activeNearFarCapacityReplay.thermalCandidateCsrRoute
              & proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY) !== 0
            && activeNearFarCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(0, 2)
              .every((rowState) => rowState === 3)
            && activeNearFarCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(2, 1026)
              .every((rowState) => rowState === 2)
            && activeNearFarCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(1026)
              .every((rowState) => rowState === 0)
            && activeNearFarCapacityReplay.conductionEvidence[3]
              === activeSeparatedExpectedCandidateVisits
            && activeNearFarCapacityReplay.radiationEvidence[3]
              === activeSeparatedExpectedCandidateVisits
            && activeNearFarCapacityReplay.conductionEvidence[4] > 0
            && activeNearFarCapacityReplay.h2oAcceptedEnergyJ > 0
            && activeNearFarCapacityReplay.nonH2oAcceptedEnergyJ < 0
            && activeNearFarCapacityReplay.proposalRows
              .slice(2)
              .every((row) => row[0] === 0 && row[1] === 0),
          `active near/far capacity did not preserve contact while sealing CSR: ${JSON.stringify({
            status: activeNearFarStatus,
            route: activeNearFarCapacityReplay.thermalCandidateCsrRoute,
            sourceCapacity: activeNearFarSourceCapacity,
            firstRows: activeNearFarCapacityReplay.thermalCandidateCsrRowStates
              ?.slice(0, 4),
            candidateVisits: [
              activeNearFarCapacityReplay.conductionEvidence[3],
              activeNearFarCapacityReplay.radiationEvidence[3]
            ],
            conductionMaskHits: activeNearFarCapacityReplay.conductionEvidence[4],
            acceptedEnergyJ: [
              activeNearFarCapacityReplay.h2oAcceptedEnergyJ,
              activeNearFarCapacityReplay.nonH2oAcceptedEnergyJ
            ]
          })}`
        );

        // Every source traverses every member in one cell. The fixed receipt
        // row has 1,025 words including its terminal sentinel, so this must
        // overflow rather than silently truncate. The thermal law still has
        // to publish complete, reciprocal rows through the authenticated
        // directory-rewalk fallback.
        const denseOverflowParticles = Array.from(
          { length: 1026 },
          (_, index) => {
            const isWater = index % 2 === 0;
            return {
              id: `dense-csr-overflow-${index}`,
              material: isWater ? 'h2o' : 'fe',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-4,
              specificInternalEnergyJPerKg: isWater
                ? productionIceColdU
                : ironHotU
            };
          }
        );
        const denseOverflowFallback = await runFixture({
          name: 'dense-one-thousand-twenty-six-overflow-rewalks-exactly',
          particles: denseOverflowParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          expectCandidateCsrFallback: true,
          includePairLedgerInResult: false
        });
        cases.push(denseOverflowFallback);
        const denseOverflowStatus = denseOverflowFallback
          .thermalCandidateCsrHeader?.[
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
          ] || 0;
        const denseOverflowMask = proposalModule
          .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID
          | proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW;
        requireTrue(
          (denseOverflowStatus & denseOverflowMask) === denseOverflowMask
            && (denseOverflowFallback.thermalCandidateCsrRoute
              & proposalModule
                .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK) !== 0
            && denseOverflowFallback.pairLedger == null
            && denseOverflowFallback.currentActiveCount === 1026
            && denseOverflowFallback.expectedActiveCount === 1026
            && denseOverflowFallback.materializedRankCount === 1026
            && denseOverflowFallback.activeDispatch[0] === 17
            && denseOverflowFallback.conductionEvidence[4] > 0
            && denseOverflowFallback.proposalRows.length === 1026
            && denseOverflowFallback.h2oAcceptedEnergyJ > 0
            && denseOverflowFallback.nonH2oAcceptedEnergyJ < 0,
          `dense receipt overflow did not rewalk exact thermal pairs: ${JSON.stringify({
            status: denseOverflowStatus,
            route: denseOverflowFallback.thermalCandidateCsrRoute,
            active: denseOverflowFallback.currentActiveCount,
            expected: denseOverflowFallback.expectedActiveCount,
            materialized: denseOverflowFallback.materializedRankCount,
            dispatch: denseOverflowFallback.activeDispatch,
            conductionEvidence: denseOverflowFallback.conductionEvidence,
            h2oAcceptedEnergyJ: denseOverflowFallback.h2oAcceptedEnergyJ,
            nonH2oAcceptedEnergyJ: denseOverflowFallback.nonH2oAcceptedEnergyJ,
            reciprocalProposalEnergyJ: denseOverflowFallback.reciprocalProposalEnergyJ
          })}`
        );

        const uniformTemperatureParticles = Array.from(
          { length: 130 },
          (_, index) => ({
            id: `uniform-temperature-h2o-${index}`,
            material: 'h2o',
            x: [
              2 + (index % 13) * 0.2,
              2 + Math.floor(index / 13) * 0.2,
              2
            ],
            v: [0, 0, 0],
            massKg: index % 2 === 0 ? 1.0e-3 : 0,
            specificInternalEnergyJPerKg: productionIceColdU
          })
        );
        const uniformTemperature = await runFixture({
          name: 'uniform-temperature-sixty-five-active-completion',
          particles: uniformTemperatureParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false
        });
        cases.push(uniformTemperature);
        requireTrue(
          uniformTemperature.particleCount === 130
            && uniformTemperature.inactiveProposalRowCount === 65
            && uniformTemperature.currentActiveCount === 65
            && uniformTemperature.expectedActiveCount === 65
            && uniformTemperature.materializedRankCount === 65
            && uniformTemperature.conductionEvidence[3] === 0
            && uniformTemperature.radiationEvidence[3] === 0
            && uniformTemperature.proposalRows.every((row) => (
              row[0] === 0 && row[1] === 0
            )),
          `uniform thermal completion retained traversal work or nonzero transfer: ${
            JSON.stringify({
              currentActiveCount: uniformTemperature.currentActiveCount,
              expectedActiveCount: uniformTemperature.expectedActiveCount,
              materializedRankCount: uniformTemperature.materializedRankCount,
              conductionEvidence: uniformTemperature.conductionEvidence,
              radiationEvidence: uniformTemperature.radiationEvidence,
              proposalRows: uniformTemperature.proposalRows
            })
          }`
        );

        const activeRankUniformTemperature = await runFixture({
          name: 'base-active-rank-uniform-temperature-sixty-five-active-completion',
          particles: uniformTemperatureParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useActiveRank: true
        });
        cases.push(activeRankUniformTemperature);
        requireTrue(
          activeRankUniformTemperature.activeSourceProjectionMode
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
            && activeRankUniformTemperature.particleCount === 130
            && activeRankUniformTemperature.inactiveProposalRowCount === 65
            && activeRankUniformTemperature.currentActiveCount === 65
            && activeRankUniformTemperature.expectedActiveCount === 65
            && activeRankUniformTemperature.materializedRankCount === 65
            && activeRankUniformTemperature.activeDispatch[0] === 2
            && activeRankUniformTemperature.conductionEvidence[3] === 0
            && activeRankUniformTemperature.radiationEvidence[3] === 0
            && activeRankUniformTemperature.proposalRows.every((row) => (
              row[0] === 0 && row[1] === 0
            )),
          `base active-rank uniform completion retained traversal work or wrote nonzero transfer: ${
            JSON.stringify({
              currentActiveCount: activeRankUniformTemperature.currentActiveCount,
              expectedActiveCount: activeRankUniformTemperature.expectedActiveCount,
              materializedRankCount: activeRankUniformTemperature.materializedRankCount,
              conductionEvidence: activeRankUniformTemperature.conductionEvidence,
              radiationEvidence: activeRankUniformTemperature.radiationEvidence,
              proposalRows: activeRankUniformTemperature.proposalRows
            })
          }`
        );

        // A retained no-full-readback continuation keeps this CPU mirror at
        // the original uniform temperature while the GPU state has acquired a
        // spatially varying G2P energy deposit. The CPU mirror must therefore
        // not suppress candidate receipt allocation: the GPU prepass decides
        // whether the true field is uniform and seals/replays this receipt.
        const staleCpuMirrorParticles = Array.from(
          { length: 8 },
          (_, index) => ({
            id: `stale-cpu-mirror-h2o-${index}`,
            material: 'h2o',
            x: [
              4 + (index % 4) * 0.04,
              4 + Math.floor(index / 4) * 0.04,
              4
            ],
            v: [0, 0, 0],
            massKg: 1.0e-3,
            specificInternalEnergyJPerKg: productionIceColdU
          })
        );
        const staleCpuMirrorGpuEnergies = staleCpuMirrorParticles.map(
          (_, index) => productionIceColdU + (index % 2 === 0 ? 0 : 5000)
        );
        const staleCpuMirrorNonuniform = await runFixture({
          name: 'stale-uniform-cpu-mirror-nonuniform-gpu-state-seals-csr',
          particles: staleCpuMirrorParticles,
          currentSpecificEnergies: staleCpuMirrorGpuEnergies,
          cpuStateStale: true,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          useAggregate: false
        });
        cases.push(staleCpuMirrorNonuniform);
        const staleCpuMirrorCsrStatus = staleCpuMirrorNonuniform
          .thermalCandidateCsrHeader?.[
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_WORD
          ] || 0;
        const staleCpuMirrorCsrInvalidMask = proposalModule
          .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID
          | proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW;
        requireTrue(
          staleCpuMirrorNonuniform.thermalCandidateCsrHeader != null
            && (staleCpuMirrorCsrStatus
              & proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY) !== 0
            && (staleCpuMirrorCsrStatus & staleCpuMirrorCsrInvalidMask) === 0
            && (staleCpuMirrorNonuniform.thermalCandidateCsrRoute
              & proposalModule.SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY) !== 0
            && staleCpuMirrorNonuniform.currentActiveCount === 8
            && staleCpuMirrorNonuniform.expectedActiveCount === 8
            && staleCpuMirrorNonuniform.materializedRankCount === 8
            && staleCpuMirrorNonuniform.proposalRows.some((row) => (
              Math.abs(row[0]) > 1.0e-5
            ))
            && Math.abs(staleCpuMirrorNonuniform.reciprocalProposalEnergyJ)
              <= staleCpuMirrorNonuniform.proposalConservationToleranceJ
            && Math.abs(staleCpuMirrorNonuniform.appliedEnergyDeltaJ)
              <= staleCpuMirrorNonuniform.applyConservationToleranceJ,
          `stale CPU mirror disabled or corrupted the nonuniform GPU CSR path: ${
            JSON.stringify({
              header: staleCpuMirrorNonuniform.thermalCandidateCsrHeader,
              status: staleCpuMirrorCsrStatus,
              route: staleCpuMirrorNonuniform.thermalCandidateCsrRoute,
              active: staleCpuMirrorNonuniform.currentActiveCount,
              expected: staleCpuMirrorNonuniform.expectedActiveCount,
              materialized: staleCpuMirrorNonuniform.materializedRankCount,
              reciprocalProposalEnergyJ:
                staleCpuMirrorNonuniform.reciprocalProposalEnergyJ,
              appliedEnergyDeltaJ: staleCpuMirrorNonuniform.appliedEnergyDeltaJ,
              proposalRows: staleCpuMirrorNonuniform.proposalRows
            })
          }`
        );

        const activeRankUniformCorrupt = await runFixture({
          name: 'base-active-rank-uniform-corrupt-mapping-fails-closed',
          particles: uniformTemperatureParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          corruptActiveProjection: { ordinal: 0, sourceIndex: 1 },
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useActiveRank: true
        });
        cases.push(activeRankUniformCorrupt);
        requireTrue(
          activeRankUniformCorrupt.expectedFailClosed === true,
          `base active-rank uniform corrupt mapping was not rejected: ${
            JSON.stringify(activeRankUniformCorrupt)
          }`
        );

        if (runNativeTreeShadow) {
          const negativeBoundaryParticles = [
            {
              id: 'negative-boundary-cold-water',
              material: 'h2o',
              x: [-0.1, -0.1, -0.1],
              v: [0, 0, 0],
              massKg: 1.0e-3,
              specificInternalEnergyJPerKg: productionIceColdU
            },
            {
              id: 'negative-boundary-hot-iron',
              material: 'fe',
              x: [-0.05, -0.1, -0.1],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironHotU
            },
            {
              id: 'positive-boundary-cold-iron',
              material: 'fe',
              x: [0.1, 0.1, 0.1],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironColdU
            }
          ];
          const multiLevelParticles = [
            {
              id: 'multilevel-fine-cold-water',
              material: 'h2o',
              x: [-0.025, 0, 0],
              v: [0, 0, 0],
              massKg: 1.0e-3,
              specificInternalEnergyJPerKg: productionIceColdU
            },
            {
              id: 'multilevel-base-hot-iron',
              material: 'fe',
              x: [0.025, 0, 0],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironHotU
            },
            {
              id: 'multilevel-coarse-cold-water',
              material: 'h2o',
              x: [0.2, 0, 0],
              v: [0, 0, 0],
              massKg: 1.0e-3,
              specificInternalEnergyJPerKg: productionIceColdU
            },
            {
              id: 'multilevel-coarse-hot-iron',
              material: 'fe',
              x: [0.38, 0, 0],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironHotU
            }
          ];
          const parityCampaigns = [
            {
              name: 'multilevel-fine-base-coarse',
              args: {
                particles: multiLevelParticles,
                particleLevels: [-1, 0, 1, 1],
                smoothingLengthM: 0.1,
                spatialCellSizeM: 0.1,
                useAggregate: false,
                useActiveRank: true
              }
            },
            {
              name: 'negative-coordinate-cell-boundary',
              args: {
                particles: negativeBoundaryParticles,
                smoothingLengthM: 0.1,
                spatialCellSizeM: 0.1,
                useAggregate: false
              }
            },
            {
              name: 'matched-time-current-contact-frozen-separated',
              args: {
                particles: [
                  {
                    id: 'tree-parity-h2o-frozen-origin',
                    material: 'h2o',
                    x: [5, 5, 5],
                    v: [0, 0, 0],
                    massKg: 1.0e-3,
                    specificInternalEnergyJPerKg: productionIceColdU
                  },
                  {
                    id: 'tree-parity-fe-frozen-far',
                    material: 'fe',
                    x: [5.5, 5, 5],
                    v: [0, 0, 0],
                    massKg: 1.0e-2,
                    specificInternalEnergyJPerKg: ironHotU
                  }
                ],
                currentPositions: [
                  [5, 5, 5],
                  [5.05, 5, 5]
                ],
                smoothingLengthM: 0.1,
                spatialCellSizeM: 0.1
              }
            },
            {
              name: 'matched-time-current-separated-frozen-contact',
              args: {
                particles: [
                  {
                    id: 'tree-parity-h2o-frozen-contact',
                    material: 'h2o',
                    x: [5, 5, 5],
                    v: [0, 0, 0],
                    massKg: 1.0e-3,
                    specificInternalEnergyJPerKg: productionIceColdU
                  },
                  {
                    id: 'tree-parity-fe-frozen-contact',
                    material: 'fe',
                    x: [5.05, 5, 5],
                    v: [0, 0, 0],
                    massKg: 1.0e-2,
                    specificInternalEnergyJPerKg: ironHotU
                  }
                ],
                currentPositions: [
                  [5, 5, 5],
                  [5.5, 5, 5]
                ],
                smoothingLengthM: 0.1,
                spatialCellSizeM: 0.1,
                requireThermalExchange: false
              }
            },
            {
              name: 'base-active-rank-dormant-projection',
              args: {
                particles: frozenSlabParticles,
                smoothingLengthM: productionSmoothingLengthM,
                spatialCellSizeM: productionPitchM,
                nativeGridSpacingM: productionPitchM,
                exactTouchPlane: true,
                useAggregate: false,
                useActiveRank: true
              }
            },
            {
              name: 'dense-csr-overflow-exact-rewalk',
              args: {
                particles: denseOverflowParticles,
                smoothingLengthM: 0.1,
                spatialCellSizeM: 0.1,
                expectCandidateCsrFallback: true,
                includePairLedgerInResult: false
              }
            },
            {
              name: 'gpu-uniform-zero-traversal',
              args: {
                particles: uniformTemperatureParticles,
                smoothingLengthM: 0.05,
                spatialCellSizeM: 0.1,
                requireThermalExchange: false,
                useAggregate: false
              }
            }
          ];
          for (const campaign of parityCampaigns) {
            const direct = await runFixture({
              ...campaign.args,
              name: `tree-direct-control-${campaign.name}`,
              includeAppliedRowsInResult: true,
              includePairLedgerInResult: false,
              sameGenerationTreeShadow: true,
              sameGenerationExhaustiveShadow: true
            });
            requireTrue(
              direct.sameGenerationTreeParity?.exact === true
                && Object.values(
                  direct.sameGenerationTreeParity.byteReceipts
                ).every(Boolean),
              `${campaign.name}: same-generation byte comparator failed: ${
                JSON.stringify(direct.sameGenerationTreeParity)
              }`
            );
            requireTrue(
              direct.sameGenerationExhaustiveParity?.semanticExact === true
                && direct.sameGenerationExhaustiveParity
                  .enumerationIndependent === true
                && Object.values(
                  direct.sameGenerationExhaustiveParity.semanticReceipts
                ).every(Boolean),
              `${campaign.name}: brute-force semantic comparator failed: ${
                JSON.stringify(direct.sameGenerationExhaustiveParity)
              }`
            );
            treeShadowComparisons.push({
              name: campaign.name,
              exact: true,
              uniform: direct.sameGenerationTreeParity.uniform,
              diagnostics: direct.sameGenerationTreeParity.diagnostics,
              candidateCsrRoute: direct.thermalCandidateCsrRoute,
              sameGeneration: true,
              byteReceipts:
                direct.sameGenerationTreeParity.byteReceipts,
              exhaustiveByteReceipts:
                direct.sameGenerationExhaustiveParity.byteReceipts,
              exhaustiveSemanticReceipts:
                direct.sameGenerationExhaustiveParity.semanticReceipts
            });
          }
          for (const corruption of [
            { name: 'status', word: 2, value: 4 },
            { name: 'generation-id', word: 3, value: 0 },
            { name: 'position-epoch', word: 11, value: 0 },
            { name: 'node-capacity', word: 21, value: 0 },
            { name: 'node-offset', word: 22, value: 41 },
            {
              name: 'root-aabb-nan',
              word: 40,
              value: 0x7fc0_0000,
              traversedBeforeReject: true
            },
            {
              name: 'live-child-status-cleared',
              word: (tree) => tree.layout.nodeOffsetWords
                + tree.layout.nodeWords + 6,
              value: 0,
              traversedBeforeReject: true
            },
            {
              name: 'duplicate-live-leaf',
              word: (tree) => tree.layout.nodeOffsetWords
                + tree.layout.leafOffset * tree.layout.nodeWords + 7,
              value: 1,
              traversedBeforeReject: true
            }
          ]) {
            const rejected = await runFixture({
              name: `tree-shadow-corrupt-${corruption.name}-fails-closed`,
              particles: mixedBoilingParticles,
              producerTraversal: 'native-test-tree-shadow',
              corruptTreeWord: corruption,
              expectTreeFailClosed: true,
              includePairLedgerInResult: false
            });
            requireTrue(
              rejected.expectedFailClosed === true
                && rejected.publishedRowCount === 0
                && rejected.proposalInvalidCounts.every((count) => count > 0)
                && (
                  rejected.conductionEvidence[2] > 0
                    || rejected.conductionEvidence[5] > 0
                )
                && (
                  rejected.radiationEvidence[2] > 0
                    || rejected.radiationEvidence[5] > 0
                )
                && (
                  corruption.traversedBeforeReject === true
                    ? (
                        rejected.treeShadowDiagnostics[0] > 0
                          && rejected.treeShadowDiagnostics[3] > 0
                          && [
                            rejected.treeShadowDiagnostics[1],
                            rejected.treeShadowDiagnostics[2],
                            rejected.treeShadowDiagnostics[4],
                            rejected.treeShadowDiagnostics[5]
                          ].every((value) => value === 0)
                      )
                    : rejected.treeShadowDiagnostics.every(
                        (value) => value === 0
                      )
                ),
              `corrupt ${corruption.name} tree did not fail closed: ${
                JSON.stringify(rejected)
              }`
            );
            treeShadowFailureCases.push({
              name: corruption.name,
              failClosed: true,
              fallbackCounts: [
                rejected.conductionEvidence[13],
                rejected.conductionEvidence[14],
                rejected.conductionEvidence[15],
                rejected.radiationEvidence[13],
                rejected.radiationEvidence[14],
                rejected.radiationEvidence[15]
              ]
            });
          }

          const timingParticle = (index, position, prefix) => {
            const isWater = index % 2 === 0;
            return {
              id: `${prefix}-${index}`,
              material: isWater ? 'h2o' : 'fe',
              x: position,
              v: [0, 0, 0],
              massKg: 1.0e-4,
              specificInternalEnergyJPerKg: isWater
                ? productionIceColdU
                : ironHotU
            };
          };
          const sparseTimingParticles = Array.from(
            { length: 1024 },
            (_, index) => {
              const pair = Math.floor(index / 2);
              return timingParticle(
                index,
                [pair * 0.5 + (index % 2) * 0.05, 0, 0],
                'timing-sparse'
              );
            }
          );
          const clusteredTimingParticles = Array.from(
            { length: 1024 },
            (_, index) => {
              const cluster = Math.floor(index / 16);
              const local = index % 16;
              return timingParticle(
                index,
                [
                  (cluster % 8) * 1.0 + (local % 4) * 0.025,
                  Math.floor(cluster / 8) * 1.0
                    + Math.floor(local / 4) * 0.025,
                  0
                ],
                'timing-clustered'
              );
            }
          );
          const timingFixtures = [
            {
              name: 'sparse-many-cells-replay',
              particles: sparseTimingParticles,
              expectedRoute:
                proposalModule
                  .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY
            },
            {
              name: 'clustered-multi-cell-replay',
              particles: clusteredTimingParticles,
              expectedRoute:
                proposalModule
                  .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY
            },
            {
              name: 'dense-one-cell-overflow-rewalk',
              particles: denseOverflowParticles,
              expectedRoute:
                proposalModule
                  .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_EXACT_NEAR_REWALK
            }
          ];
          const warmupOrders = [
            'direct-tree',
            'tree-direct',
            'direct-tree',
            'tree-direct'
          ];
          const measuredOrders = [
            'direct-tree',
            'tree-direct',
            'direct-tree',
            'tree-direct',
            'direct-tree',
            'tree-direct',
            'direct-tree',
            'tree-direct',
            'direct-tree'
          ];
          const timingCampaigns = [];
          for (
            let fixtureIndex = 0;
            fixtureIndex < timingFixtures.length;
            fixtureIndex += 1
          ) {
            const fixture = timingFixtures[fixtureIndex];
            const warmups = [];
            for (
              let orderIndex = 0;
              orderIndex < warmupOrders.length;
              orderIndex += 1
            ) {
              warmups.push(await runThermalTimingPair({
                ...fixture,
                order: warmupOrders[orderIndex],
                ordinal:
                  10_000 + fixtureIndex * 100 + orderIndex
              }));
            }
            const measurements = [];
            for (
              let orderIndex = 0;
              orderIndex < measuredOrders.length;
              orderIndex += 1
            ) {
              measurements.push(await runThermalTimingPair({
                ...fixture,
                order: measuredOrders[orderIndex],
                ordinal:
                  20_000 + fixtureIndex * 100 + orderIndex
              }));
            }
            timingCampaigns.push({
              name: fixture.name,
              warmupCount: warmups.length,
              measuredOrders,
              measurements
            });
          }
          const ratioReceipt = (
            measurements,
            directValue,
            treeValue
          ) => {
            const direct = measurements.map(directValue);
            const tree = measurements.map(treeValue);
            const paired = measurements.map((sample, index) => (
              tree[index] / direct[index]
            ));
            const orderRatios = (order) => measurements
              .map((sample, index) => ({ sample, ratio: paired[index] }))
              .filter(({ sample }) => sample.order === order)
              .map(({ ratio }) => ratio);
            return {
              directMedianMs: median(direct),
              treeMedianMs: median(tree),
              pairedRatioMedian: median(paired),
              independentRatio:
                median(tree) / median(direct),
              directFirstRatioMedian:
                median(orderRatios('direct-tree')),
              treeFirstRatioMedian:
                median(orderRatios('tree-direct'))
            };
          };
          const stageValue = (route, stage) => (sample) => (
            sample[route].timing[stage]
          );
          const traversalValue = (route) => (sample) => (
            sample[route].timing['directional-budget']
              + sample[route].timing['reciprocal-limited-proposal']
          );
          const totalValue = (route) => (sample) => (
            sample[route].timing['thermal-producer-apply-total']
          );
          const sharedValue = (route) => (sample) => (
            sample.treeBuildMs
              + sample[route].timing['thermal-producer-apply-total']
          );
          const timingFixtureReceipts = timingCampaigns.map((campaign) => {
            const receipt = {
              name: campaign.name,
              warmupSamples: campaign.warmupCount,
              measuredSamples: campaign.measurements.length,
              measuredOrders: campaign.measuredOrders,
              treeBuildMedianMs: median(campaign.measurements.map(
                ({ treeBuildMs }) => treeBuildMs
              )),
              directionalBudget: ratioReceipt(
                campaign.measurements,
                stageValue('direct', 'directional-budget'),
                stageValue('tree', 'directional-budget')
              ),
              reciprocalProposal: ratioReceipt(
                campaign.measurements,
                stageValue('direct', 'reciprocal-limited-proposal'),
                stageValue('tree', 'reciprocal-limited-proposal')
              ),
              traversal: ratioReceipt(
                campaign.measurements,
                traversalValue('direct'),
                traversalValue('tree')
              ),
              fullThermalRoute: ratioReceipt(
                campaign.measurements,
                totalValue('direct'),
                totalValue('tree')
              ),
              sharedTreePlusThermal: ratioReceipt(
                campaign.measurements,
                sharedValue('direct'),
                sharedValue('tree')
              )
            };
            const ratioFields = [
              receipt.traversal,
              receipt.fullThermalRoute,
              receipt.sharedTreePlusThermal
            ];
            const noMaterialRegression = ratioFields.every((metric) => (
              metric.pairedRatioMedian <= 1.05
                && metric.independentRatio <= 1.05
                && metric.directFirstRatioMedian <= 1.05
                && metric.treeFirstRatioMedian <= 1.05
            ));
            const denseProposalAccepted =
              campaign.name !== 'dense-one-cell-overflow-rewalk'
                || (
                  receipt.reciprocalProposal.pairedRatioMedian <= 1.05
                    && receipt.reciprocalProposal.independentRatio <= 1.05
                );
            const topologyWin = campaign.name
              === 'sparse-many-cells-replay'
              ? true
              : (
                receipt.traversal.pairedRatioMedian <= 1.0
                  && receipt.traversal.independentRatio <= 1.0
              );
            receipt.accepted = noMaterialRegression
              && denseProposalAccepted
              && topologyWin;
            return receipt;
          });
          const compositeDirect = [];
          const compositeTree = [];
          for (
            let sampleIndex = 0;
            sampleIndex < measuredOrders.length;
            sampleIndex += 1
          ) {
            compositeDirect.push(timingCampaigns.reduce(
              (sum, campaign) => sum
                + totalValue('direct')(campaign.measurements[sampleIndex]),
              0
            ));
            compositeTree.push(timingCampaigns.reduce(
              (sum, campaign) => sum
                + totalValue('tree')(campaign.measurements[sampleIndex]),
              0
            ));
          }
          const composite = {
            pairedRatioMedian: median(compositeTree.map(
              (value, index) => value / compositeDirect[index]
            )),
            independentRatio:
              median(compositeTree) / median(compositeDirect),
            directMedianMs: median(compositeDirect),
            treeMedianMs: median(compositeTree)
          };
          const accepted = timingFixtureReceipts.every(
            ({ accepted: fixtureAccepted }) => fixtureAccepted
          )
            && composite.pairedRatioMedian <= 1.0
            && composite.independentRatio <= 1.0;
          thermalTreeTiming = {
            schema:
              'peercompute.ulg.native-test.s9d4-thermal-tree-timing.v0',
            timestampQueryRequired: true,
            warmupSamplesPerFixture: warmupOrders.length,
            measuredSamplesPerFixture: measuredOrders.length,
            fixtures: timingFixtureReceipts,
            composite,
            accepted,
            productionDecision: accepted
              ? 'admit-tree'
              : 'retain-direct'
          };
        }
      } finally {
        thermal.destroySphThermalResponseGraphBuffers(responseUpload);
      }

      await device.queue.onSubmittedWorkDone();
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
        treeShadowComparisons,
        treeShadowFailureCases,
        thermalTreeTiming
      };
    }, { runNativeTreeShadow: RUN_NATIVE_TREE });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'passed', native.reason || JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, []);
  assert.deepEqual(native.scopeErrors, []);
  if (RUN_NATIVE_TREE) {
    const adapterDescription = Object.values(native.adapterInfo || {})
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    assert.ok(
      adapterDescription.length > 0,
      `native thermal tree timing requires identified hardware: ${
        JSON.stringify(native.adapterInfo)
      }`
    );
    assert.doesNotMatch(
      adapterDescription,
      /swiftshader|software|llvmpipe|lavapipe/,
      `native thermal tree timing rejects software adapters: ${
        JSON.stringify(native.adapterInfo)
      }`
    );
  }
  assert.deepEqual(
    native.cases.map(({ name }) => name),
    [
      'mixed-boiling-plateau-four-neighbor',
      'pure-gas-shared-boil-knot',
      'fusion-minus-one-ulp-hot-iron-boundary-star',
      'sparse-four-lane-frozen-exact-touch-iron-ice-planes',
      'matched-time-current-contact-frozen-separated',
      'matched-time-current-separated-frozen-contact',
      'all-dormant-active-dispatch',
      'all-dormant-current-active-mismatch-fails-closed',
      'corrupt-active-projection-entry-fails-closed',
      'sixty-five-active-indirect-two-workgroups',
      'local-rank-mask-sparse-four-lane-iron-ice-planes',
      'local-rank-mask-all-dormant',
      'local-rank-mask-current-active-mismatch-fails-closed',
      'local-rank-mask-sixty-five-active',
      'base-active-rank-sparse-four-lane-iron-ice-planes',
      'base-active-rank-all-dormant',
      'base-active-rank-current-active-mismatch-fails-closed',
      'base-active-rank-corrupt-paired-index-fails-closed',
      'base-active-rank-sixty-five-active',
      'local-two-live-plus-one-thousand-twenty-four-dormant-csr-replays',
      'active-one-thousand-twenty-six-currently-separated-csr-replays',
      'active-one-thousand-twenty-six-one-near-pair-csr-replays',
      'dense-one-thousand-twenty-six-overflow-rewalks-exactly',
      'uniform-temperature-sixty-five-active-completion',
      'base-active-rank-uniform-temperature-sixty-five-active-completion',
      'stale-uniform-cpu-mirror-nonuniform-gpu-state-seals-csr',
      'base-active-rank-uniform-corrupt-mapping-fails-closed'
    ]
  );
  assert.ok(native.cases.every(({ particleCount }) => particleCount > 0));
  if (RUN_NATIVE_TREE) {
    assert.deepEqual(
      native.cases[0].sameGenerationTreeParity?.byteReceipts,
      {
        derived: true,
        proposal: true,
        conductionEvidence: true,
        radiationEvidence: true,
        activeDispatch: true,
        candidateCsrReplay: true,
        candidateCsrRowStates: true,
        appliedState: true,
        appliedThermo: true
      },
      JSON.stringify(native.cases[0].sameGenerationTreeParity)
    );
    assert.equal(
      native.cases[0].sameGenerationTreeParity?.exact,
      true,
      JSON.stringify(native.cases[0].sameGenerationTreeParity)
    );
    assert.equal(
      native.cases[0].sameGenerationExhaustiveParity?.semanticExact,
      true,
      JSON.stringify(native.cases[0].sameGenerationExhaustiveParity)
    );
    assert.equal(
      native.cases[0].sameGenerationExhaustiveParity
        ?.enumerationIndependent,
      true,
      JSON.stringify(native.cases[0].sameGenerationExhaustiveParity)
    );
    assert.ok(
      Object.values(
        native.cases[0].sameGenerationExhaustiveParity
          ?.semanticReceipts || {}
      ).every(Boolean),
      JSON.stringify(native.cases[0].sameGenerationExhaustiveParity)
    );
    assert.ok(
      native.cases[0].sameGenerationTreeParity?.diagnostics
        ?.slice(0, 3)
        .every((value) => value > 0),
      JSON.stringify(native.cases[0].sameGenerationTreeParity)
    );
    assert.deepEqual(
      native.treeShadowComparisons.map(({ name, exact }) => ({ name, exact })),
      [
        { name: 'mixed-boiling-plateau-four-neighbor', exact: true },
        { name: 'multilevel-fine-base-coarse', exact: true },
        { name: 'negative-coordinate-cell-boundary', exact: true },
        {
          name: 'matched-time-current-contact-frozen-separated',
          exact: true
        },
        {
          name: 'matched-time-current-separated-frozen-contact',
          exact: true
        },
        { name: 'base-active-rank-dormant-projection', exact: true },
        { name: 'dense-csr-overflow-exact-rewalk', exact: true },
        { name: 'gpu-uniform-zero-traversal', exact: true }
      ]
    );
    assert.ok(
      native.treeShadowComparisons[0].diagnostics
        .slice(0, 3)
        .every((value) => value > 0),
      JSON.stringify(native.treeShadowComparisons)
    );
    assert.equal(
      native.treeShadowComparisons[0].arenaReuse?.exact,
      true,
      JSON.stringify(native.treeShadowComparisons[0])
    );
    assert.ok(
      native.treeShadowComparisons[0].arenaReuse.currentArenaGeneration
        > native.treeShadowComparisons[0].arenaReuse.previousArenaGeneration,
      JSON.stringify(native.treeShadowComparisons[0])
    );
    assert.ok(
      native.treeShadowComparisons.every((receipt) => (
        receipt.sameGeneration === true
          && Object.values(receipt.byteReceipts).every(Boolean)
          && Object.values(receipt.exhaustiveSemanticReceipts).every(Boolean)
      )),
      JSON.stringify(native.treeShadowComparisons)
    );
    assert.deepEqual(
      native.treeShadowFailureCases,
      [
        {
          name: 'status',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        },
        {
          name: 'generation-id',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        },
        {
          name: 'position-epoch',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        },
        {
          name: 'node-capacity',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        },
        {
          name: 'node-offset',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        },
        {
          name: 'root-aabb-nan',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        },
        {
          name: 'live-child-status-cleared',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        },
        {
          name: 'duplicate-live-leaf',
          failClosed: true,
          fallbackCounts: [0, 0, 0, 0, 0, 0]
        }
      ]
    );
    assert.equal(
      native.thermalTreeTiming?.schema,
      'peercompute.ulg.native-test.s9d4-thermal-tree-timing.v0'
    );
    assert.equal(
      native.thermalTreeTiming?.warmupSamplesPerFixture,
      4
    );
    assert.equal(
      native.thermalTreeTiming?.measuredSamplesPerFixture,
      9
    );
    assert.deepEqual(
      native.thermalTreeTiming?.fixtures.map(({ name }) => name),
      [
        'sparse-many-cells-replay',
        'clustered-multi-cell-replay',
        'dense-one-cell-overflow-rewalk'
      ]
    );
    assert.ok(
      native.thermalTreeTiming.fixtures.every((fixture) => (
        fixture.measuredSamples === 9
          && fixture.treeBuildMedianMs > 0
          && fixture.traversal.directMedianMs > 0
          && fixture.traversal.treeMedianMs > 0
          && fixture.fullThermalRoute.directMedianMs > 0
          && fixture.fullThermalRoute.treeMedianMs > 0
      )),
      JSON.stringify(native.thermalTreeTiming)
    );
    assert.equal(
      native.thermalTreeTiming.productionDecision,
      native.thermalTreeTiming.accepted
        ? 'admit-tree'
        : 'retain-direct'
    );
    const timingSummary = {
      adapterInfo: native.adapterInfo,
      accepted: native.thermalTreeTiming.accepted,
      productionDecision:
        native.thermalTreeTiming.productionDecision,
      composite: native.thermalTreeTiming.composite,
      fixtures: native.thermalTreeTiming.fixtures.map((fixture) => ({
        name: fixture.name,
        accepted: fixture.accepted,
        treeBuildMedianMs: fixture.treeBuildMedianMs,
        directionalBudget: fixture.directionalBudget,
        reciprocalProposal: fixture.reciprocalProposal,
        traversal: fixture.traversal,
        fullThermalRoute: fixture.fullThermalRoute,
        sharedTreePlusThermal: fixture.sharedTreePlusThermal
      }))
    };
    console.log(`S9D4_THERMAL_TREE_TIMING ${JSON.stringify(timingSummary)}`);
  } else {
    assert.deepEqual(native.treeShadowComparisons, []);
    assert.deepEqual(native.treeShadowFailureCases, []);
    assert.equal(native.thermalTreeTiming, null);
  }
});
