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
      const recordCleanupFailure = (label, error) => {
        uncapturedErrors.push(
          `${label}: ${error?.message || String(error)}`
        );
      };
      const captureCleanup = async (label, cleanup) => {
        try {
          return await cleanup();
        } catch (error) {
          recordCleanupFailure(`${label} cleanup failed`, error);
          return null;
        }
      };
      const settleQueueForCleanup = async (label) => {
        try {
          await device.queue.onSubmittedWorkDone();
        } catch (error) {
          recordCleanupFailure(`${label} queue cleanup failed`, error);
        }
      };
      const drainAbortedValidationScope = async (label) => {
        try {
          const error = await device.popErrorScope();
          if (error) {
            recordCleanupFailure(`${label} validation failed`, error);
          }
        } catch (error) {
          recordCleanupFailure(`${label} validation scope pop failed`, error);
        }
      };
      const settleProposalRelease = async (label, proposal) => {
        if (!proposal) return true;
        await settleQueueForCleanup(label);
        for (
          let ordinal = 0;
          ordinal < 100 && proposal.released !== true;
          ordinal += 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (proposal.released === true) return true;
        recordCleanupFailure(
          `${label} proposal arena`,
          new Error('did not release')
        );
        return false;
      };
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

      const createTaggedBuffer = (
        label,
        values,
        usage,
        targetDevice = device
      ) => {
        const buffer = targetDevice.createBuffer({
          label,
          size: Math.max(4, Math.ceil(values.byteLength / 4) * 4),
          usage
        });
        if (values.byteLength > 0) {
          targetDevice.queue.writeBuffer(buffer, 0, values);
        }
        return identity.tagWebGpuBufferDevice(buffer, targetDevice);
      };
      const readBuffer = async (
        source,
        byteLength,
        label,
        sourceOffset = 0
      ) => {
        const size = Math.max(4, Math.ceil(byteLength / 4) * 4);
        const readback = device.createBuffer({
          label,
          size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder({
          label: `${label}-copy-encoder`
        });
        encoder.copyBufferToBuffer(source, sourceOffset, readback, 0, size);
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
              const fineSourceCellSpan =
                token.descriptor.stage.startsWith('source-cell-');
              requireTrue(
                end >= start
                  && (fineSourceCellSpan || end > start)
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
      const radiationPhaseResponseTable =
        thermal.buildSphThermalPhaseResponseTable(
          thermalMaterialTable,
          graphSet
        );
      let radiationResponseUpload = null;
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
      let responseUpload = null;
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
        expectedPhysicalTopologyMismatchCount = null,
        currentSpecificEnergies = null,
        cpuStateStale = false,
        nativeTestActiveSourceDispatchXLimit = null,
        corruptActiveProjection = null,
        corruptPhysicalToActiveProjection = null,
        corruptDirectoryPhysicalCell = null,
        expectProducerFailClosed = false,
        corruptTreeWord = null,
        expectTreeFailClosed = false,
        expectCandidateCsrFallback = false,
        expectCandidateCsrRoute = null,
        includePairLedgerInResult = true,
        requireThermalExchange = true,
        requireConductionExchange = requireThermalExchange,
        radiationEnabled = false,
        requireRadiationExchange = radiationEnabled,
        useAggregate = true,
        useActiveRank = false,
        useDirectoryV2 = false,
        producerTraversal = 'direct',
        observeTreeTraversalCounters = true,
        includeAppliedRowsInResult = false,
        particleLevels = null,
        sameGenerationTreeShadow = false,
        sameGenerationSourceCellTreeShadow = false,
        sameGenerationExhaustiveShadow = false
      }) => {
        const fixturePhaseResponseTable = radiationEnabled
          ? radiationPhaseResponseTable
          : phaseResponseTable;
        const fixtureResponseUpload = radiationEnabled
          ? radiationResponseUpload
          : responseUpload;
        requireTrue(
          Number(useAggregate) + Number(useActiveRank)
              + Number(useDirectoryV2) <= 1,
          `${name}: aggregate, base active-rank, and directory-v2 ActiveSource projections are mutually exclusive`
        );
        requireTrue(
          producerTraversal === 'direct'
            || producerTraversal === 'native-test-tree-shadow'
            || producerTraversal
              === 'native-test-source-cell-tree-shadow',
          `${name}: unsupported producer traversal ${producerTraversal}`
        );
        requireTrue(
          !sameGenerationTreeShadow || producerTraversal === 'direct',
          `${name}: same-generation tree comparator requires the direct control arm`
        );
        requireTrue(
          !sameGenerationSourceCellTreeShadow
            || producerTraversal === 'direct',
          `${name}: same-generation source-cell comparator requires the direct control arm`
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
        if (useDirectoryV2 || useActiveRank) {
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
        let sourceCellTreeShadowReceipt = null;
        let sameGenerationTreeParity = null;
        let sameGenerationSourceCellTreeParity = null;
        let sameGenerationExhaustiveParity = null;
        let canonicalSubmitted = false;
        let canonicalValidationScopeOpen = false;
        let classicValidationScopeOpen = false;
        try {
          const nativeTestLegacyLevelAssignmentDirectoryV1Arm = useActiveRank
            ? spatial
                .armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest({
                  device,
                  levelAssignment
                })
            : null;
          generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
            device,
            ...(useDirectoryV2 || useActiveRank
              ? { levelAssignment }
              : { activeNodeList }),
            particleCount: packed.particleCount,
            particleIdentityBuffer: particleUpload.identityBuffer,
            particleIdentityStrideWords: 1,
            particleBufferSet: useAggregate ? particleUpload : null,
            laneId: `native-thermal-${name}`,
            sourceFamily: `native-thermal-${name}`,
            mechanicsLevels: [],
            nativeTestLegacyLevelAssignmentDirectoryV1Arm
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
          requireTrue(
            useDirectoryV2
              ? (
                  generation.directoryAbiVersion === 2
                  && generation.activeSourceView != null
                  && generation.execution.activeSourceView
                    === generation.activeSourceView
                )
              : generation.activeSourceView == null,
            `${name}: retained ActiveSource presence did not match directoryV2=${useDirectoryV2}`
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
            thermalResponseGraphUpload: fixtureResponseUpload,
            dtS,
            smoothingLengthM: packed.smoothingLengthM,
            conductionRate
          });
          requireTrue(proposal.ready === true, `${name}: proposal was not ready`);
          if (nativeTestActiveSourceDispatchXLimit != null) {
            requireTrue(
              useDirectoryV2
                && Number.isInteger(nativeTestActiveSourceDispatchXLimit)
                && nativeTestActiveSourceDispatchXLimit > 0,
              `${name}: native 2D ActiveSource consumer proof requires directory v2 and a positive x limit`
            );
            const dispatchForInvocations = (invocationCount) => {
              if (invocationCount === 0) return [0, 1, 1];
              const groupCount = Math.ceil(invocationCount / 64);
              const x = Math.min(
                groupCount,
                nativeTestActiveSourceDispatchXLimit
              );
              return [x, Math.ceil(groupCount / x), 1];
            };
            const frozenActiveCount = Array.from(
              { length: packed.particleCount },
              (_, index) => packed.state[index * 8 + 3]
            ).filter((massKg) => massKg > 0).length;
            const activeSourceBuffer =
              generation.activeSourceView.activeSourceViewBuffer;
            const activeSourceLayout = generation.activeSourceView.layout;
            // The producer's own scalable 2D construction is covered by its
            // retained-runtime tests. Here the native consumer executes an
            // internally valid y>1 indirect contract on real WebGPU without
            // pretending this mutation is producer performance evidence.
            device.queue.writeBuffer(
              activeSourceBuffer,
              38 * Uint32Array.BYTES_PER_ELEMENT,
              new Uint32Array([nativeTestActiveSourceDispatchXLimit])
            );
            for (const [offsetWords, invocationCount] of [
              [
                activeSourceLayout.activeDispatchOffsetWords,
                frozenActiveCount
              ],
              [
                activeSourceLayout.candidateDispatchOffsetWords,
                frozenActiveCount * 27
              ],
              [
                activeSourceLayout.physicalDispatchOffsetWords,
                packed.particleCount
              ]
            ]) {
              device.queue.writeBuffer(
                activeSourceBuffer,
                offsetWords * Uint32Array.BYTES_PER_ELEMENT,
                new Uint32Array(dispatchForInvocations(invocationCount))
              );
            }
          }
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
          } else if (
            producerTraversal === 'native-test-source-cell-tree-shadow'
          ) {
            sourceCellTreeShadowReceipt = proposalModule
              .armSchroederSpatialThermalSourceCellTreeShadowForNativeTest({
                device,
                schroederSpatialThermalProposal: proposal,
                observeTraversalCounters: true
              });
            requireTrue(
              sourceCellTreeShadowReceipt?.nativeTestOnly === true
                && sourceCellTreeShadowReceipt.tree
                  === generation.exactNearCellTree
                && sourceCellTreeShadowReceipt.fallback == null,
              `${name}: native source-cell shadow did not bind the exact generation tree`
            );
          }
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
              (treeShadowReceipt || sourceCellTreeShadowReceipt).treeBuffer,
              corruptTreeWordIndex * Uint32Array.BYTES_PER_ELEMENT,
              new Uint32Array([corruptTreeWord.value])
            );
          }
          requireTrue(
            proposal.activeSourceProjectionMode === (
              useDirectoryV2
                ? proposalModule
                  .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_SOURCE
                : useAggregate
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
            } did not match aggregate=${useAggregate}, activeRank=${
              useActiveRank
            }, directoryV2=${useDirectoryV2}`
          );
          if (corruptActiveProjection) {
            const { ordinal, sourceIndex } = corruptActiveProjection;
            const projectionOffset = useDirectoryV2
              ? generation.activeSourceView.layout.activeToPhysicalOffsetWords
              : useAggregate
                ? generation.aggregateView.activeMemberOffsetWords
                : generation.activeRankView?.layout.activeSourceIndicesOffsetWords;
            const projectionBuffer = useDirectoryV2
              ? generation.activeSourceView.activeSourceViewBuffer
              : useAggregate
                ? generation.aggregateView.aggregateViewBuffer
                : generation.activeRankView?.activeRankViewBuffer;
            requireTrue(
              (useAggregate || useActiveRank || useDirectoryV2)
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
          if (corruptPhysicalToActiveProjection) {
            const { physicalIndex, activeOrdinal } =
              corruptPhysicalToActiveProjection;
            requireTrue(
              useDirectoryV2
                && Number.isInteger(physicalIndex)
                && physicalIndex >= 0
                && physicalIndex < packed.particleCount
                && Number.isInteger(activeOrdinal)
                && activeOrdinal >= 0
                && activeOrdinal <= 0xffff_ffff,
              `${name}: physical-to-active corruption request is invalid`
            );
            device.queue.writeBuffer(
              generation.activeSourceView.activeSourceViewBuffer,
              (
                generation.activeSourceView.layout
                  .physicalToActiveOffsetWords + physicalIndex
              ) * Uint32Array.BYTES_PER_ELEMENT,
              new Uint32Array([activeOrdinal])
            );
          }
          if (corruptDirectoryPhysicalCell) {
            const { physicalIndex, cellPlusOne } =
              corruptDirectoryPhysicalCell;
            requireTrue(
              useDirectoryV2
                && Number.isInteger(physicalIndex)
                && physicalIndex >= 0
                && physicalIndex < packed.particleCount
                && Number.isInteger(cellPlusOne)
                && cellPlusOne >= 0
                && cellPlusOne <= 0xffff_ffff,
              `${name}: directory physical-cell corruption request is invalid`
            );
            device.queue.writeBuffer(
              generation.execution.directoryBuffer,
              (
                generation.execution.layout
                  .physicalToCellPlusOneOffsetWords + physicalIndex
              ) * Uint32Array.BYTES_PER_ELEMENT,
              new Uint32Array([cellPlusOne])
            );
          }
          canonicalThermalStage = thermal.createSphThermalStepWebGpuEncoderStage({
            device,
            sphParticleState: packed,
            thermalMaterialTable,
            thermalClosureGraphSet: graphSet,
            thermalClosureGraphBank: graphSet.graphBank,
            thermalPhaseResponseTable: fixturePhaseResponseTable,
            thermalResponseGraphUpload: fixtureResponseUpload,
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
          canonicalValidationScopeOpen = true;
          const canonicalEncoder = device.createCommandEncoder({
            label: `ulg-native-thermal-${name}-producer-apply`
          });
          canonicalThermalStage.encode(canonicalEncoder);
          device.queue.submit([canonicalEncoder.finish()]);
          canonicalSubmitted = true;
          canonicalThermalStage.markSubmittedWork();
          await device.queue.onSubmittedWorkDone();
          const canonicalProducerValidationError = await device.popErrorScope();
          canonicalValidationScopeOpen = false;
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
            physicalTopologyDispatchBytes,
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
              proposal.sourceWorkIndirectBuffer,
              3 * Uint32Array.BYTES_PER_ELEMENT,
              `ulg-native-thermal-${name}-active-dispatch-readback`,
              proposal.sourceWorkIndirectOffsetBytes
            ),
            proposal.physicalTopologyWorkIndirectBuffer
              ? readBuffer(
                  proposal.physicalTopologyWorkIndirectBuffer,
                  3 * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-physical-topology-dispatch-readback`,
                  proposal.physicalTopologyWorkIndirectOffsetBytes
                )
              : null,
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
          const physicalTopologyDispatch = physicalTopologyDispatchBytes
            ? Array.from(new Uint32Array(physicalTopologyDispatchBytes))
            : null;
          const directoryWords = new Uint32Array(directoryBytes);
          const treeShadowDiagnostics = treeShadowReceipt?.diagnosticBuffer
            ? Array.from(new Uint32Array(await readBuffer(
                treeShadowReceipt.diagnosticBuffer,
                treeShadowReceipt.diagnosticWordCount
                  * Uint32Array.BYTES_PER_ELEMENT,
                `ulg-native-thermal-${name}-tree-shadow-diagnostics-readback`
              )))
            : null;
          const sourceCellTreeShadowBatchControl =
            sourceCellTreeShadowReceipt?.batchBuffer
              ? Array.from(new Uint32Array(await readBuffer(
                  sourceCellTreeShadowReceipt.batchBuffer,
                  64 * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-source-cell-batch-control-readback`
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
          const activeSourceViewWords = generation.activeSourceView
            ? new Uint32Array(await readBuffer(
                generation.activeSourceView.activeSourceViewBuffer,
                generation.activeSourceView.layout.byteLength,
                `ulg-native-thermal-${name}-active-source-view-readback`
              ))
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
          const physicalTopologyMismatchHeaderWord =
            proposal.derivedHeaderLayout.indexOf(
              'physicalTopologyMismatchCount:atomic<u32>'
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
          requireTrue(
            physicalTopologyMismatchHeaderWord
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_PHYSICAL_TOPOLOGY_MISMATCH_COUNT_WORD,
            `${name}: physical-topology mismatch header ABI is missing`
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
                  candidateCsrRoute,
                  candidateCsrRowStates: thermalCandidateCsrRowStates,
                  candidateCsrRowStatesComplete,
                  activeDispatch,
                  activeSources: activeSourceViewWords
                    ? Array.from(activeSourceViewWords.slice(
                        activeSourceViewWords[25],
                        activeSourceViewWords[25]
                          + activeSourceViewWords[18]
                      ))
                    : null,
                  derivedHeader: Array.from(derivedWords.slice(
                    0,
                    proposal.derivedHeaderWords
                  )),
                  proposalHeader: Array.from(proposalWords.slice(
                    0,
                    proposal.proposalHeaderWords
                  ))
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
            if (expectedPhysicalTopologyMismatchCount != null) {
              requireTrue(
                derivedWords[physicalTopologyMismatchHeaderWord]
                  === expectedPhysicalTopologyMismatchCount,
                `${name}: physical-topology mismatch receipt was ${
                  derivedWords[physicalTopologyMismatchHeaderWord]
                }, expected ${expectedPhysicalTopologyMismatchCount}`
              );
            }
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
              sourceCellTreeShadowBatchControl,
              useAggregate,
              useActiveRank,
              useDirectoryV2,
              nativeTestActiveSourceDispatchXLimit,
              activeSourceProjectionMode: proposal.activeSourceProjectionMode,
              particleCount: packed.particleCount,
              expectedFailClosed: true,
              derivedInvalidCount: derivedWords[1],
              physicalTopologyMismatchCount:
                derivedWords[physicalTopologyMismatchHeaderWord],
              currentActiveCount: derivedWords[currentActiveCountHeaderWord],
              expectedActiveCount: derivedWords[expectedActiveCountHeaderWord],
              materializedRankCount: derivedWords[materializedRankCountHeaderWord],
              proposalInvalidCounts: [proposalWords[6], proposalWords[7]],
              publishedRowCount: proposalWords[15],
              activeDispatch,
              physicalTopologyDispatch,
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
          const activeGroupCount = Math.ceil(activeSourceCount / 64);
          const expectedActiveDispatch = useDirectoryV2
            ? (
                activeSourceCount === 0
                  ? [0, 1, 1]
                  : [
                      Math.min(activeGroupCount, activeSourceViewWords[38]),
                      Math.ceil(
                        activeGroupCount
                          / Math.min(activeGroupCount, activeSourceViewWords[38])
                      ),
                      1
                    ]
              )
            : [Math.max(1, activeGroupCount), 1, 1];
          requireTrue(
            JSON.stringify(activeDispatch)
              === JSON.stringify(expectedActiveDispatch),
            `${name}: finalized active dispatch was ${activeDispatch}, expected ${
              expectedActiveDispatch
            }`
          );
          if (useDirectoryV2) {
            const activeSourceLayout = generation.activeSourceView.layout;
            const physicalDispatchOffset =
              activeSourceLayout.physicalDispatchOffsetWords;
            const physicalGroupCount = Math.ceil(packed.particleCount / 64);
            const physicalDispatchX = Math.min(
              physicalGroupCount,
              activeSourceViewWords[38]
            );
            const expectedPhysicalTopologyDispatch = [
              physicalDispatchX,
              Math.ceil(physicalGroupCount / physicalDispatchX),
              1
            ];
            requireTrue(
              proposal.physicalTopologyWorkIdentity
                  === 'gpu-physical-source-slot'
                && proposal.physicalTopologyWorkIndirectBuffer
                  === generation.activeSourceView.activeSourceViewBuffer
                && proposal.physicalTopologyWorkIndirectOffsetBytes
                  === generation.activeSourceView.physicalDispatchOffsetBytes
                && proposal.physicalTopologyReadbackPerformed === false
                && activeSourceViewWords[42] === physicalDispatchOffset
                && JSON.stringify(Array.from(activeSourceViewWords.slice(
                  physicalDispatchOffset,
                  physicalDispatchOffset + 3
                ))) === JSON.stringify(expectedPhysicalTopologyDispatch)
                && physicalTopologyDispatch != null
                && JSON.stringify(physicalTopologyDispatch)
                  === JSON.stringify(expectedPhysicalTopologyDispatch),
              `${name}: physical-topology dispatch was ${
                JSON.stringify(physicalTopologyDispatch)
              }, expected ${JSON.stringify(expectedPhysicalTopologyDispatch)}`
            );
            const physicalToCellPlusOneOffset =
              generation.execution.layout.physicalToCellPlusOneOffsetWords;
            for (
              let physicalIndex = 0;
              physicalIndex < packed.particleCount;
              physicalIndex += 1
            ) {
              const expectedActive = packed.state[physicalIndex * 8 + 3] > 0;
              const activeOrdinal = activeSourceViewWords[
                activeSourceLayout.physicalToActiveOffsetWords + physicalIndex
              ];
              const directoryCellPlusOne = directoryWords[
                physicalToCellPlusOneOffset + physicalIndex
              ];
              requireTrue(
                expectedActive
                  ? (
                      activeOrdinal < activeSourceCount
                      && activeSourceViewWords[
                        activeSourceLayout.activeToPhysicalOffsetWords
                          + activeOrdinal
                      ] === physicalIndex
                      && directoryCellPlusOne > 0
                      && directoryCellPlusOne <= directoryWords[18]
                    )
                  : (
                      activeOrdinal === 0xffff_ffff
                      && directoryCellPlusOne === 0
                    ),
                `${name}: physical topology row ${physicalIndex} was ${
                  activeOrdinal
                }/${directoryCellPlusOne}, expected active=${expectedActive}`
              );
            }
          }
          const activeRankSidecarOffset = proposal.derivedHeaderWords
            + packed.particleCount * proposal.derivedRowWords;
          const activeRankSidecar = Array.from(derivedWords.slice(
            activeRankSidecarOffset,
            activeRankSidecarOffset + packed.particleCount
          ));
          const activeSourceRanks = useDirectoryV2
            ? []
            : (useAggregate || useActiveRank)
              ? activeRankSidecar.slice(0, activeSourceCount)
              : activeRankSidecar.filter(
                  (sourceRank) => sourceRank !== 0xffffffff
                );
          const materializedActiveSources = useDirectoryV2
            ? Array.from(activeSourceViewWords.slice(
                activeSourceViewWords[25],
                activeSourceViewWords[25] + activeSourceCount
              ))
            : activeSourceRanks.map((sourceRank) => {
                requireTrue(
                  sourceRank < packed.particleCount,
                  `${name}: materialized source rank ${sourceRank} is out of range`
                );
                return directoryWords[
                  generation.execution.layout.cellMembersOffsetWords
                    + sourceRank
                ];
              });
          const expectedActiveSources = Array.from(
            { length: packed.particleCount },
            (_, index) => index
          ).filter((index) => packed.state[index * 8 + 3] > 0);
          requireTrue(
            new Set(materializedActiveSources).size === activeSourceCount
              && JSON.stringify([...materializedActiveSources].sort((a, b) => a - b))
                === JSON.stringify(expectedActiveSources),
            `${name}: active work identity ${activeSourceRanks} decoded to ${
              materializedActiveSources
            }, expected ${expectedActiveSources}`
          );
          if (useDirectoryV2) {
            requireTrue(
              aggregateHeader == null
                && activeRankHeader == null
                && activeSourceViewWords != null
                && proposal.directoryAbiVersion === 2
                && proposal.sourceWorkIdentity === 'gpu-active-ordinal'
                && proposal.activeSourceView === generation.activeSourceView
                && proposal.activeSourceCountAuthority
                  === generation.execution.activeSourceCountAuthority
                && activeSourceViewWords[0] === 0x53535631
                && activeSourceViewWords[1] === 1
                && activeSourceViewWords[2] === 3
                && activeSourceViewWords[16] === packed.particleCount
                && activeSourceViewWords[18] === activeSourceCount
                && activeSourceViewWords[20]
                  === packed.particleCount - activeSourceCount
                && activeSourceViewWords[25] === 64
                && activeSourceViewWords[30] === activeSourceViewWords[29]
                && activeSourceViewWords[33] === activeSourceCount
                && activeSourceViewWords[34] === activeSourceCount
                && activeSourceViewWords[35] === activeSourceCount
                && activeSourceViewWords[40]
                  === generation.activeSourceView.layout.activeDispatchOffsetWords
                && activeSourceViewWords[47] !== 0
                && directoryWords[1] === 2
                && directoryWords[37] === activeSourceCount,
              `${name}: directory-v2 ActiveSource header is invalid: ${
                JSON.stringify(Array.from(activeSourceViewWords.slice(0, 64)))
              }`
            );
          } else if (useAggregate) {
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
            derivedWords[1] === 0
              && derivedWords[physicalTopologyMismatchHeaderWord] === 0,
            `${name}: derived invalid/topology-mismatch count ${
              derivedWords[1]
            }/${derivedWords[physicalTopologyMismatchHeaderWord]}`
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
              evidence[0] === 2 * activeSourceCount
                && evidence[1] === 2 * activeSourceCount,
              `${name}: ${consumer} source/directory evidence ${evidence[0]}/${evidence[1]}`
            );
          }
          requireTrue(
            requireConductionExchange
              ? conductionEvidence[4] > 0
              : conductionEvidence[4] === 0,
            `${name}: conduction support-mask hits were ${conductionEvidence[4]}`
          );
          requireTrue(
            !requireRadiationExchange || radiationEvidence[4] > 0,
            `${name}: radiation support-mask hits were ${radiationEvidence[4]}`
          );

          const derivedRows = [];
          const proposalRows = [];
          let reciprocalProposalEnergyJ = 0;
          let absoluteProposalEnergyJ = 0;
          let absoluteConductionEnergyJ = 0;
          let absoluteRadiationEnergyJ = 0;
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
            if (!requireRadiationExchange) {
              requireTrue(
                Math.abs(proposalRow[1]) <= 1.0e-7,
                `${name}: pair radiation was not disabled at row ${index}: ${proposalRow[1]}`
              );
            }
            const pairDu = proposalRow[0] + proposalRow[1];
            reciprocalProposalEnergyJ += massKg * pairDu;
            absoluteProposalEnergyJ += Math.abs(massKg * pairDu);
            absoluteConductionEnergyJ += Math.abs(
              massKg * proposalRow[0]
            );
            absoluteRadiationEnergyJ += Math.abs(
              massKg * proposalRow[1]
            );
          }
          requireTrue(
            requireConductionExchange
              ? absoluteConductionEnergyJ > 1.0e-4
              : absoluteConductionEnergyJ <= 1.0e-7,
            `${name}: absolute conduction proposal energy was ${
              absoluteConductionEnergyJ
            } J`
          );
          requireTrue(
            requireRadiationExchange
              ? absoluteRadiationEnergyJ > 1.0e-7
              : absoluteRadiationEnergyJ <= 1.0e-7,
            `${name}: absolute radiation proposal energy was ${
              absoluteRadiationEnergyJ
            } J`
          );
          requireTrue(
            requireThermalExchange
              ? absoluteProposalEnergyJ > (
                  requireConductionExchange ? 1.0e-4 : 1.0e-7
                )
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
            let treeValidationScopeOpen = false;
            try {
              treeProposal =
                proposalModule.runSchroederSpatialThermalProposalWebGpu({
                  device,
                  generation,
                  schroederSpatialEpochTransaction,
                  sphParticleState: proposalCpuState,
                  sphParticleUpload: particleUpload,
                  mlsMpmParticleUpload,
                  thermalResponseGraphUpload: fixtureResponseUpload,
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
                thermalPhaseResponseTable: fixturePhaseResponseTable,
                thermalResponseGraphUpload: fixtureResponseUpload,
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
              treeValidationScopeOpen = true;
              const treeEncoder = device.createCommandEncoder({
                label: `ulg-native-thermal-${name}-same-generation-tree`
              });
              treeStage.encode(treeEncoder);
              device.queue.submit([treeEncoder.finish()]);
              treeSubmitted = true;
              treeStage.markSubmittedWork();
              await device.queue.onSubmittedWorkDone();
              const treeValidationError = await device.popErrorScope();
              treeValidationScopeOpen = false;
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
              const uniform = derivedWords[2]
                === ((~derivedWords[3]) >>> 0);
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
              await settleQueueForCleanup(
                `${name} same-generation tree shadow`
              );
              if (treeValidationScopeOpen) {
                await drainAbortedValidationScope(
                  `${name} same-generation tree shadow`
                );
                treeValidationScopeOpen = false;
              }
              await captureCleanup(
                `${name} same-generation tree shadow`,
                () => (
                  treeStage
                    ? (
                        treeSubmitted
                          ? treeStage.cleanupSubmittedWork?.()
                          : treeStage.cleanupAbortedWork?.()
                      )
                    : treeProposal?.abandonPreparedWork?.(
                        'same-generation-tree-shadow-setup-failed'
                  )
                )
              );
              await settleProposalRelease(
                `${name} same-generation tree shadow`,
                treeProposal
              );
            }
          }

          if (sameGenerationSourceCellTreeShadow) {
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
              `${name}: direct proposal did not release before the source-cell control`
            );
            let sourceCellProposal = null;
            let sourceCellStage = null;
            let sourceCellSubmitted = false;
            let sourceCellReceipt = null;
            let sourceCellValidationScopeOpen = false;
            try {
              sourceCellProposal =
                proposalModule.runSchroederSpatialThermalProposalWebGpu({
                  device,
                  generation,
                  schroederSpatialEpochTransaction,
                  sphParticleState: proposalCpuState,
                  sphParticleUpload: particleUpload,
                  mlsMpmParticleUpload,
                  thermalResponseGraphUpload: fixtureResponseUpload,
                  dtS,
                  smoothingLengthM: packed.smoothingLengthM,
                  conductionRate
                });
              sourceCellReceipt = proposalModule
                .armSchroederSpatialThermalSourceCellTreeShadowForNativeTest({
                  device,
                  schroederSpatialThermalProposal: sourceCellProposal,
                  observeTraversalCounters: true
                });
              requireTrue(
                sourceCellProposal.generationId === proposal.generationId
                  && sourceCellProposal.supportEpoch === proposal.supportEpoch
                  && sourceCellReceipt.tree
                    === generation.exactNearCellTree
                  && sourceCellReceipt.batchBuffer != null
                  && sourceCellReceipt.batchWordCount
                    === sourceCellReceipt.plan.wordLength
                  && sourceCellReceipt.batchByteLength
                    === sourceCellReceipt.plan.byteLength
                  && sourceCellReceipt.fallback == null,
                `${name}: same-generation source-cell shadow changed epoch or batch identity`
              );
              sourceCellStage =
                thermal.createSphThermalStepWebGpuEncoderStage({
                  device,
                  sphParticleState: packed,
                  thermalMaterialTable,
                  thermalClosureGraphSet: graphSet,
                  thermalClosureGraphBank: graphSet.graphBank,
                  thermalPhaseResponseTable: fixturePhaseResponseTable,
                  thermalResponseGraphUpload: fixtureResponseUpload,
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
                  schroederSpatialThermalProposal: sourceCellProposal
              });
              device.pushErrorScope('validation');
              sourceCellValidationScopeOpen = true;
              const sourceCellEncoder = device.createCommandEncoder({
                label:
                  `ulg-native-thermal-${name}-same-generation-source-cell`
              });
              sourceCellStage.encode(sourceCellEncoder);
              device.queue.submit([sourceCellEncoder.finish()]);
              sourceCellSubmitted = true;
              sourceCellStage.markSubmittedWork();
              await device.queue.onSubmittedWorkDone();
              const sourceCellValidationError = await device.popErrorScope();
              sourceCellValidationScopeOpen = false;
              requireTrue(
                !sourceCellValidationError,
                `${name}: same-generation source-cell validation failed: ${
                  sourceCellValidationError?.message
                    || String(sourceCellValidationError)
                }`
              );
              const [
                sourceCellDerivedBytes,
                sourceCellProposalBytes,
                sourceCellConductionEvidenceBytes,
                sourceCellRadiationEvidenceBytes,
                sourceCellFinalStateBytes,
                sourceCellFinalThermoBytes,
                sourceCellActiveDispatchBytes,
                sourceCellCandidateCsrReplayBytes,
                sourceCellCandidateCsrRowStateBytes,
                sourceCellBatchControlBytes
              ] = await Promise.all([
                readBuffer(
                  sourceCellProposal.thermalDerivedBudgetBuffer,
                  sourceCellProposal.activeDerivedByteLength,
                  `ulg-native-thermal-${name}-same-generation-source-cell-derived`
                ),
                readBuffer(
                  sourceCellProposal.proposalBuffer,
                  sourceCellProposal.activeProposalByteLength,
                  `ulg-native-thermal-${name}-same-generation-source-cell-proposal`
                ),
                readBuffer(
                  sourceCellProposal.conductionEvidenceBuffer,
                  sourceCellProposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-source-cell-conduction`
                ),
                readBuffer(
                  sourceCellProposal.radiationEvidenceBuffer,
                  sourceCellProposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-source-cell-radiation`
                ),
                readBuffer(
                  sourceCellStage.stateBuffer,
                  packed.state.byteLength,
                  `ulg-native-thermal-${name}-same-generation-source-cell-state`
                ),
                readBuffer(
                  sourceCellStage.thermoBuffer,
                  packed.thermo.byteLength,
                  `ulg-native-thermal-${name}-same-generation-source-cell-thermo`
                ),
                readBuffer(
                  sourceCellProposal.activeDispatchBuffer,
                  3 * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-source-cell-active-dispatch`
                ),
                sourceCellProposal.thermalCandidateCsr
                  ? readBuffer(
                      sourceCellProposal.thermalCandidateCsr.replayBuffer,
                      (
                        proposalModule
                          .SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
                          + sourceCellProposal
                            .thermalCandidateCsr.candidateCapacity
                      ) * Uint32Array.BYTES_PER_ELEMENT,
                      `ulg-native-thermal-${name}-same-generation-source-cell-csr-replay`
                    )
                  : Promise.resolve(null),
                sourceCellProposal.thermalCandidateCsr
                  ? readBuffer(
                      sourceCellProposal
                        .thermalCandidateCsr.sourceRowStateBuffer,
                      sourceCellProposal.thermalCandidateCsr.sourceCapacity
                        * Uint32Array.BYTES_PER_ELEMENT,
                      `ulg-native-thermal-${name}-same-generation-source-cell-csr-row-states`
                    )
                  : Promise.resolve(null),
                readBuffer(
                  sourceCellReceipt.batchBuffer,
                  64 * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-${name}-same-generation-source-cell-batch-control`
                )
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
                  sourceCellDerivedBytes
                ),
                proposal: exactBytes(
                  proposalBytes,
                  sourceCellProposalBytes
                ),
                conductionEvidence: exactBytes(
                  conductionEvidenceBytes,
                  sourceCellConductionEvidenceBytes
                ),
                radiationEvidence: exactBytes(
                  radiationEvidenceBytes,
                  sourceCellRadiationEvidenceBytes
                ),
                activeDispatch: exactBytes(
                  activeDispatchBytes,
                  sourceCellActiveDispatchBytes
                ),
                candidateCsrReplay: exactOptionalBytes(
                  thermalCandidateCsrReplayBytes,
                  sourceCellCandidateCsrReplayBytes
                ),
                candidateCsrRowStates: exactOptionalBytes(
                  thermalCandidateCsrRowStateBytes,
                  sourceCellCandidateCsrRowStateBytes
                ),
                appliedState: exactBytes(
                  finalStateBytes,
                  sourceCellFinalStateBytes
                ),
                appliedThermo: exactBytes(
                  finalThermoBytes,
                  sourceCellFinalThermoBytes
                )
              };
              requireTrue(
                Object.values(byteReceipts).every(Boolean),
                `${name}: same-generation direct/source-cell byte parity failed: ${
                  JSON.stringify(byteReceipts)
                }`
              );
              const batchControl = Array.from(
                new Uint32Array(sourceCellBatchControlBytes)
              );
              const uniform = derivedWords[2]
                === ((~derivedWords[3]) >>> 0);
              const sourceCellCandidateCsrHeader =
                sourceCellCandidateCsrReplayBytes
                  ? new Uint32Array(
                      sourceCellCandidateCsrReplayBytes,
                      0,
                      proposalModule
                        .SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
                    )
                  : null;
              const sourceCellCandidateCsrRoute =
                sourceCellCandidateCsrHeader?.[
                  proposalModule
                    .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_WORD
                ] ?? 0;
              const sourceCellReplayed = (
                sourceCellCandidateCsrRoute
                  & proposalModule
                    .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY
              ) !== 0;
              const batchControlReceipts = {
                wordCount: batchControl.length === 64,
                magic: batchControl[0] === 0x5343_4231,
                version: batchControl[1] === 1,
                ready: batchControl[2] === 2,
                generationId:
                  batchControl[3] === proposal.generationId,
                supportEpoch:
                  batchControl[4] === proposal.supportEpoch,
                capacities:
                  batchControl[5] > 0
                    && batchControl[5]
                      <= sourceCellReceipt.plan.cellCapacity
                    && batchControl[6]
                      === sourceCellReceipt.plan.cellCapacity
                    && batchControl[7]
                      === sourceCellReceipt.plan.sourceCapacity,
                layout:
                  batchControl[8]
                      === sourceCellReceipt.plan.bitsetRowWords
                    && batchControl[9]
                      === sourceCellReceipt.plan.wordLength
                    && batchControl[10]
                      === sourceCellReceipt.plan
                        .inverseSourceRankOffsetWords
                    && batchControl[11]
                      === sourceCellReceipt.plan
                        .cellRowStateOffsetWords
                    && batchControl[12]
                      === sourceCellReceipt.plan.bitsetOffsetWords,
                dispatch:
                  batchControl[16] === batchControl[5]
                    && batchControl[17]
                      === Math.ceil(batchControl[26] / 64)
                    && batchControl[18] === 1,
                tree:
                  batchControl[20]
                      === sourceCellReceipt.plan.nodeCapacity
                    && batchControl[21] === 0
                    && batchControl[22] === batchControl[5]
                    && batchControl[23] === 0
                    && batchControl[27] === batchControl[5]
                    && batchControl[28] > 0
                    && batchControl[29] > 0
                    && batchControl[30] > 0,
                projection:
                  batchControl[24] === activeSourceCount
                    && batchControl[25] === 0
                    && batchControl[26] > 0,
                traversal: uniform
                  ? batchControl
                    .slice(32, 40)
                    .every((value) => value === 0)
                  : (
                      batchControl[32] === activeSourceCount
                        && batchControl[36] === activeSourceCount
                        && batchControl
                          .slice(33, 36)
                          .every((value) => value > 0)
                        && (
                          sourceCellReplayed
                            ? batchControl
                              .slice(37, 40)
                              .every((value) => value === 0)
                            : batchControl
                              .slice(37, 40)
                              .every((value) => value > 0)
                        )
                    )
              };
              requireTrue(
                Object.values(batchControlReceipts).every(Boolean),
                `${name}: source-cell batch control was not sealed: ${
                  JSON.stringify({
                    batchControlReceipts,
                    batchControl
                  })
                }`
              );
              sameGenerationSourceCellTreeParity = {
                exact: true,
                generationId: proposal.generationId,
                supportEpoch: proposal.supportEpoch,
                treeArenaIndex: generation.exactNearCellTree.arenaIndex,
                treeArenaGeneration:
                  generation.exactNearCellTree.arenaGeneration,
                uniform,
                byteReceipts,
                batchControlReceipts,
                batchControl
              };
            } finally {
              await settleQueueForCleanup(
                `${name} same-generation source-cell shadow`
              );
              if (sourceCellValidationScopeOpen) {
                await drainAbortedValidationScope(
                  `${name} same-generation source-cell shadow`
                );
                sourceCellValidationScopeOpen = false;
              }
              await captureCleanup(
                `${name} same-generation source-cell shadow`,
                () => (
                  sourceCellStage
                    ? (
                        sourceCellSubmitted
                          ? sourceCellStage.cleanupSubmittedWork?.()
                          : sourceCellStage.cleanupAbortedWork?.()
                      )
                    : sourceCellProposal?.abandonPreparedWork?.(
                        'same-generation-source-cell-shadow-setup-failed'
                  )
                )
              );
              await settleProposalRelease(
                `${name} same-generation source-cell shadow`,
                sourceCellProposal
              );
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
            let exhaustiveValidationScopeOpen = false;
            try {
              exhaustiveProposal =
                proposalModule.runSchroederSpatialThermalProposalWebGpu({
                  device,
                  generation,
                  schroederSpatialEpochTransaction,
                  sphParticleState: proposalCpuState,
                  sphParticleUpload: particleUpload,
                  mlsMpmParticleUpload,
                  thermalResponseGraphUpload: fixtureResponseUpload,
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
                  thermalPhaseResponseTable: fixturePhaseResponseTable,
                  thermalResponseGraphUpload: fixtureResponseUpload,
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
              exhaustiveValidationScopeOpen = true;
              const exhaustiveEncoder = device.createCommandEncoder({
                label:
                  `ulg-native-thermal-${name}-same-generation-exhaustive`
              });
              exhaustiveStage.encode(exhaustiveEncoder);
              device.queue.submit([exhaustiveEncoder.finish()]);
              exhaustiveSubmitted = true;
              exhaustiveStage.markSubmittedWork();
              await device.queue.onSubmittedWorkDone();
              const exhaustiveValidationError = await device.popErrorScope();
              exhaustiveValidationScopeOpen = false;
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
              await settleQueueForCleanup(
                `${name} same-generation exhaustive shadow`
              );
              if (exhaustiveValidationScopeOpen) {
                await drainAbortedValidationScope(
                  `${name} same-generation exhaustive shadow`
                );
                exhaustiveValidationScopeOpen = false;
              }
              await captureCleanup(
                `${name} same-generation exhaustive shadow`,
                () => (
                  exhaustiveStage
                    ? (
                        exhaustiveSubmitted
                          ? exhaustiveStage.cleanupSubmittedWork?.()
                          : exhaustiveStage.cleanupAbortedWork?.()
                      )
                    : exhaustiveProposal?.abandonPreparedWork?.(
                        'same-generation-exhaustive-shadow-setup-failed'
                  )
                )
              );
              await settleProposalRelease(
                `${name} same-generation exhaustive shadow`,
                exhaustiveProposal
              );
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
          classicValidationScopeOpen = true;
          const classicResult = await thermal.runSphThermalStepWebGpu({
            device,
            sphParticleState: packed,
            thermalMaterialTable,
            thermalClosureGraphSet: graphSet,
            thermalClosureGraphBank: graphSet.graphBank,
            thermalPhaseResponseTable: fixturePhaseResponseTable,
            thermalResponseGraphUpload: fixtureResponseUpload,
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
          classicValidationScopeOpen = false;
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
            sourceCellTreeShadowBatchControl,
            treeArenaIndex: generation.exactNearCellTree.arenaIndex,
            treeArenaGeneration:
              generation.exactNearCellTree.arenaGeneration,
            treeRuntimeCapacity: generation.runtimeCapacity,
            useAggregate,
            useActiveRank,
            useDirectoryV2,
            nativeTestActiveSourceDispatchXLimit,
            activeSourceProjectionMode: proposal.activeSourceProjectionMode,
            particleCount: packed.particleCount,
            inactiveProposalRowCount,
            publishedRowCount: proposalWords[15],
            initialEnergyJ,
            finalEnergyJ,
            reciprocalProposalEnergyJ,
            absoluteConductionEnergyJ,
            absoluteRadiationEnergyJ,
            proposalConservationToleranceJ,
            appliedEnergyDeltaJ,
            applyConservationToleranceJ,
            centralInitialU: proposalSourceState[7],
            centralFinalU: result.state[7],
            centralInitialTemperatureK: packed.thermo[2],
            centralFinalTemperatureK: result.thermo[2],
            maxPositionDisplacementM:
              derivedFloats[displacementHeaderWord],
            gpuPairwiseTemperatureUniform:
              derivedWords[2] === ((~derivedWords[3]) >>> 0),
            activeDispatch,
            physicalTopologyDispatch,
            currentActiveCount:
              derivedWords[currentActiveCountHeaderWord],
            expectedActiveCount:
              derivedWords[expectedActiveCountHeaderWord],
            materializedRankCount:
              derivedWords[materializedRankCountHeaderWord],
            physicalTopologyMismatchCount:
              derivedWords[physicalTopologyMismatchHeaderWord],
            materializedActiveSources,
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
            sameGenerationSourceCellTreeParity,
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
          if (canonicalSubmitted) {
            await settleQueueForCleanup(`${name} canonical thermal`);
          }
          if (classicValidationScopeOpen) {
            await drainAbortedValidationScope(`${name} classic thermal`);
            classicValidationScopeOpen = false;
          }
          if (canonicalValidationScopeOpen) {
            await drainAbortedValidationScope(`${name} canonical thermal`);
            canonicalValidationScopeOpen = false;
          }
          await captureCleanup(`${name} canonical thermal stage`, () => (
            canonicalSubmitted
              ? canonicalThermalStage?.cleanupSubmittedWork?.()
              : canonicalThermalStage?.cleanupAbortedWork?.()
          ));
          if (classicBinAuthority) {
            await captureCleanup(`${name} classic-bin authority`, async () => {
              binAuthorityModule
                .releasePostSeparationThermalBinAuthorityAfterQueue(
                  classicBinAuthority,
                  { device }
                );
              await binAuthorityModule
                .postSeparationThermalBinAuthorityLiveness(classicBinAuthority)
                ?.releasePromise;
            });
          } else {
            await captureCleanup(`${name} classic-bin buffer`, () => (
              classicBinsBuffer?.destroy?.()
            ));
          }
          await captureCleanup(`${name} thermal proposal`, () => (
            proposal?.releaseAfterCanonicalApplySubmittedWork?.()
          ));
          if (generation) {
            await captureCleanup(`${name} spatial generation`, () => (
              spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
                generation,
                device
              )
            ));
          }
          await settleQueueForCleanup(`${name} final generation`);
          if (generation?.releasePromise) {
            await captureCleanup(`${name} generation release`, () => (
              generation.releasePromise
            ));
          }
          await captureCleanup(`${name} fixture inputs`, () => {
            gpuBuffers.destroySphGpuParticleBuffers(particleUpload);
            if (
              currentStateBuffer
              && currentStateBuffer !== particleUpload.stateBuffer
            ) {
              currentStateBuffer.destroy?.();
            }
            transactionMechanicsBuffer?.destroy?.();
            activeNodeBuffer.destroy();
            levelAssignmentBuffer?.destroy?.();
          });
        }
      };

      const cases = [];
      const treeShadowComparisons = [];
      const treeShadowFailureCases = [];
      const sourceCellTreeShadowFailureCases = [];
      let thermalTreeTiming = null;
      let sourceCellLifecycle = null;
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
        const uniform = direct.gpuPairwiseTemperatureUniform === true;
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
        'source-cell-initialize',
        'source-cell-projection',
        'source-cell-build',
        'source-cell-finalize',
        'directional-budget',
        'candidate-csr-validate-rows',
        'candidate-csr-seal',
        'budget-resolve',
        'reciprocal-limited-proposal'
      ];
      const runThermalTimingTrio = async ({
        name,
        particles,
        order,
        ordinal,
        expectedRoute,
        smoothingLengthM = 0.1,
        spatialCellSizeM = 0.1,
        dtS = 0.001,
        conductionRate = 1500,
        observeSourceCellCounters = false,
        detailedSourceCellTimestamps = false
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
          const nativeTestLegacyLevelAssignmentDirectoryV1Arm =
            spatial
              .armSchroederSpatialLegacyLevelAssignmentDirectoryV1ForNativeTest({
                device,
                levelAssignment
              });
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
            nativeTestLegacyLevelAssignmentDirectoryV1Arm,
            gpuTimestampRecorder: treeBuildTimer.recorder
          });
          requireTrue(
            generation.ready === true
              && generation.selected === true
              && generation.directoryAbiVersion === 1
              && generation.execution.abiVersion === 1
              && generation.nativeTestLegacyLevelAssignmentDirectoryV1 === true
              && generation.activeRankView != null
              && generation.activeSourceView == null
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
              requireTrue(
                proposal.directoryAbiVersion === 1
                  && proposal.activeSourceProjectionMode
                    === proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_RANK
                  && proposal.activeRankView === generation.activeRankView
                  && proposal.activeSourceView == null
                  && proposal.sourceWorkIdentity
                    === 'legacy-directory-member-rank'
                  && proposal.sourceWorkIndirectBuffer
                    === proposal.activeDispatchBuffer
                  && proposal.sourceWorkIndirectOffsetBytes === 0,
                `${name}/${ordinal}/${route}: timing arm was not an explicit directory-v1 ActiveRank route`
              );
              let sourceCellReceipt = null;
              if (route === 'perParticle') {
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
              } else if (route === 'sourceCell') {
                sourceCellReceipt = proposalModule
                  .armSchroederSpatialThermalSourceCellTreeShadowForNativeTest({
                    device,
                    schroederSpatialThermalProposal: proposal,
                    observeTraversalCounters:
                      observeSourceCellCounters
                  });
                requireTrue(
                  sourceCellReceipt.tree === generation.exactNearCellTree
                    && sourceCellReceipt.batchBuffer != null
                    && sourceCellReceipt.batchWordCount
                      === sourceCellReceipt.plan.wordLength,
                  `${name}/${ordinal}: timing source-cell batch was not bound`
                );
              }
              timer = createTimestampRecorder(
                `ulg-native-thermal-timing-${name}-${ordinal}-${route}`,
                thermalTimingStages.filter((stageName) => (
                  !stageName.startsWith('source-cell-')
                    || (
                      route === 'sourceCell'
                      && detailedSourceCellTimestamps
                    )
                ))
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
                producerId: `s9d5-thermal-${route}`,
                stage: 'thermal-producer-apply-total',
                generationId: generation.execution.generationId
              });
              stage.encode(encoder);
              timer.recorder.endEncoderSpan(encoder, totalSpan);
              device.queue.submit([encoder.finish()]);
              submitted = true;
              stage.markSubmittedWork();
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
              const replayExpected = expectedRoute
                === proposalModule
                  .SCHROEDER_SPATIAL_THERMAL_CSR_ROUTE_REPLAY;
              const expectedCsrStatus = replayExpected
                ? (
                    proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_READY
                    | proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_ROWS_FINALIZED
                    | proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_VALIDATED
                  )
                : (
                    proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_INVALID
                    | proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_OVERFLOW
                    | proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_ROWS_FINALIZED
                    | proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_STATUS_VALIDATED
                  );
              requireTrue(
                csrRoute === expectedRoute
                  && csrStatus === expectedCsrStatus,
                `${name}/${ordinal}/${route}: unexpected CSR status/route ${
                  csrStatus
                }/${csrRoute}; expected ${
                  expectedCsrStatus
                }/${expectedRoute}`
              );
              const batchControl = sourceCellReceipt
                ? Array.from(new Uint32Array(await readBuffer(
                    sourceCellReceipt.batchBuffer,
                    64 * Uint32Array.BYTES_PER_ELEMENT,
                    `ulg-native-thermal-timing-${name}-${ordinal}-${route}-batch-control`
                  )))
                : null;
              if (batchControl) {
                requireTrue(
                  batchControl.length === 64
                    && batchControl[0] === 0x5343_4231
                    && batchControl[1] === 1
                    && batchControl[2] === 2
                    && batchControl[3]
                      === generation.execution.generationId
                    && batchControl[4]
                      === generation.execution.supportEpoch
                    && batchControl[5] > 0
                    && batchControl[20]
                      === sourceCellReceipt.plan.nodeCapacity
                    && batchControl[21] === 0
                    && batchControl[22] === batchControl[5]
                    && batchControl[23] === 0
                    && batchControl[25] === 0
                    && (
                      observeSourceCellCounters
                        ? (
                            batchControl[27] === batchControl[5]
                            && batchControl[28] > 0
                            && batchControl[29] > 0
                            && batchControl[30] > 0
                            && batchControl[32] === packed.particleCount
                            && batchControl[36] === packed.particleCount
                            && batchControl
                              .slice(33, 36)
                              .every((value) => value > 0)
                            && (
                              replayExpected
                                ? batchControl
                                  .slice(37, 40)
                                  .every((value) => value === 0)
                                : batchControl
                                  .slice(37, 40)
                                  .every((value) => value > 0)
                            )
                          )
                        : (
                            batchControl
                              .slice(27, 31)
                              .every((value) => value === 0)
                            && batchControl
                              .slice(32, 40)
                              .every((value) => value === 0)
                          )
                    ),
                  `${name}/${ordinal}/${route}: timing batch control was not sealed: ${
                    JSON.stringify(batchControl)
                  }`
                );
              }
              const parityBytes = await Promise.all([
                readBuffer(
                  proposal.thermalDerivedBudgetBuffer,
                  proposal.activeDerivedByteLength,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-derived`
                ),
                readBuffer(
                  proposal.proposalBuffer,
                  proposal.activeProposalByteLength,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-proposal`
                ),
                readBuffer(
                  proposal.conductionEvidenceBuffer,
                  proposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-conduction`
                ),
                readBuffer(
                  proposal.radiationEvidenceBuffer,
                  proposal.evidenceWordCount
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-radiation`
                ),
                readBuffer(
                  proposal.activeDispatchBuffer,
                  3 * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-dispatch`
                ),
                readBuffer(
                  proposal.thermalCandidateCsr.replayBuffer,
                  (
                    proposalModule
                      .SCHROEDER_SPATIAL_THERMAL_CSR_CONTROL_WORDS
                    + proposal.thermalCandidateCsr.candidateCapacity
                  ) * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-csr-replay`
                ),
                readBuffer(
                  proposal.thermalCandidateCsr.sourceRowStateBuffer,
                  proposal.thermalCandidateCsr.sourceCapacity
                    * Uint32Array.BYTES_PER_ELEMENT,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-csr-rows`
                ),
                readBuffer(
                  stage.stateBuffer,
                  packed.state.byteLength,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-state`
                ),
                readBuffer(
                  stage.thermoBuffer,
                  packed.thermo.byteLength,
                  `ulg-native-thermal-timing-${name}-${ordinal}-${route}-thermo`
                )
              ]);
              return {
                timing,
                csrStatus,
                csrRoute,
                batchControl,
                parityBytes
              };
            } finally {
              await settleQueueForCleanup(
                `${name}/${ordinal}/${route} timing arm`
              );
              await captureCleanup(
                `${name}/${ordinal}/${route} timing arm`,
                () => {
                  timer?.destroy?.();
                  if (stage) {
                    return submitted
                      ? stage.cleanupSubmittedWork?.()
                      : stage.cleanupAbortedWork?.();
                  } else {
                    return proposal?.abandonPreparedWork?.(
                      `timing-${route}-setup-failed`
                    );
                  }
                }
              );
              await settleProposalRelease(
                `${name}/${ordinal}/${route} timing arm`,
                proposal
              );
            }
          };

          const routes = order.split('-');
          requireTrue(
            routes.length === 3
              && new Set(routes).size === 3
              && ['direct', 'perParticle', 'sourceCell'].every(
                (route) => routes.includes(route)
              ),
            `${name}/${ordinal}: invalid balanced trio order ${order}`
          );
          const arms = {};
          for (const route of routes) {
            arms[route] = await runArm(route);
          }
          const parityFields = [
            'derived',
            'proposal',
            'conductionEvidence',
            'radiationEvidence',
            'activeDispatch',
            'candidateCsrReplay',
            'candidateCsrRowStates',
            'appliedState',
            'appliedThermo'
          ];
          const exactBytes = (left, right) => {
            const a = new Uint8Array(left);
            const b = new Uint8Array(right);
            return a.length === b.length
              && a.every((value, index) => value === b[index]);
          };
          const parityReceipts = Object.fromEntries(
            ['perParticle', 'sourceCell'].map((route) => [
              route,
              Object.fromEntries(parityFields.map((field, index) => [
                field,
                exactBytes(
                  arms.direct.parityBytes[index],
                  arms[route].parityBytes[index]
                )
              ]))
            ])
          );
          requireTrue(
            Object.values(parityReceipts).every((receipt) => (
              Object.values(receipt).every(Boolean)
            )),
            `${name}/${ordinal}: timed trio output parity failed: ${
              JSON.stringify(parityReceipts)
            }`
          );
          const withoutParityBytes = ({ parityBytes, ...arm }) => arm;
          return {
            name,
            order,
            ordinal,
            directoryAbiVersion: 1,
            sourceWorkIdentity: 'legacy-directory-member-rank',
            evidenceScope: 'native-directory-v1-tree-shadow-only',
            particleCount: packed.particleCount,
            treeBuildMs: buildTiming['exact-near-cell-tree-build'],
            parityReceipts,
            direct: withoutParityBytes(arms.direct),
            perParticle: withoutParityBytes(arms.perParticle),
            sourceCell: withoutParityBytes(arms.sourceCell)
          };
        } finally {
          if (generation) {
            await captureCleanup(
              `${name}/${ordinal} timing generation`,
              () => spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
                generation,
                device
              )
            );
          }
          await settleQueueForCleanup(`${name}/${ordinal} timing generation`);
          if (generation?.releasePromise) {
            await captureCleanup(
              `${name}/${ordinal} timing generation release`,
              () => generation.releasePromise
            );
          }
          await captureCleanup(`${name}/${ordinal} timing inputs`, () => {
            treeBuildTimer?.destroy?.();
            mechanicsBuffer.destroy?.();
            assignmentBuffer.destroy?.();
            gpuBuffers.destroySphGpuParticleBuffers(particleUpload);
          });
        }
      };
      const runSourceCellLifecycleCampaign = async () => {
        const lifecycleAdapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance'
        });
        requireTrue(
          lifecycleAdapter != null,
          'source-cell lifecycle adapter unavailable'
        );
        const lifecycleDevice = await lifecycleAdapter.requestDevice(
          deviceLimits.webGpuDeviceDescriptorForResidentSph(
            lifecycleAdapter,
            { timestampProfilingRequested: false }
          )
        );
        requireTrue(
          lifecycleDevice !== device,
          'source-cell lifecycle campaign reused the timed GPUDevice'
        );
        const lifecycleAdapterInfo =
          typeof lifecycleAdapter.info === 'object'
            ? {
                vendor: lifecycleAdapter.info.vendor || null,
                architecture: lifecycleAdapter.info.architecture || null,
                device: lifecycleAdapter.info.device || null,
                description: lifecycleAdapter.info.description || null
              }
            : null;
        const lifecycleAdapterDescription = Object.values(
          lifecycleAdapterInfo || {}
        ).filter(Boolean).join(' ').toLowerCase();
        requireTrue(
          /nvidia/.test(lifecycleAdapterDescription)
            && !/(swiftshader|llvmpipe|software)/.test(
              lifecycleAdapterDescription
            ),
          `source-cell lifecycle requires NVIDIA hardware: ${
            JSON.stringify(lifecycleAdapterInfo)
          }`
        );
        const lifecycleUncapturedErrors = [];
        lifecycleDevice.addEventListener('uncapturederror', (event) => {
          lifecycleUncapturedErrors.push(
            event.error?.message || String(event.error)
          );
        });

        let lifecycleResponseUpload = null;
        let deviceDestroyed = false;
        let lifecycleOrdinal = 700_000;
        const syncError = (label, operation) => {
          try {
            operation();
          } catch (error) {
            return {
              name: error?.name || null,
              code: error?.code || null,
              message: error?.message || String(error)
            };
          }
          fail(`${label}: expected a synchronous rejection`);
        };
        const waitUntil = async (label, predicate) => {
          for (let ordinal = 0; ordinal < 100; ordinal += 1) {
            if (predicate()) return true;
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
          fail(`${label}: condition did not settle`);
        };
        const taggedBuffer = (label, values, usage) => (
          createTaggedBuffer(
            label,
            values,
            usage,
            lifecycleDevice
          )
        );
        const makeFixture = async (name) => {
          lifecycleOrdinal += 1;
          const smoothingLengthM = 0.1;
          const spatialCellSizeM = 0.1;
          const particles = [
            {
              id: `${name}-ice`,
              material: 'h2o',
              x: [5, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-3,
              specificInternalEnergyJPerKg: productionIceColdU
            },
            {
              id: `${name}-iron`,
              material: 'fe',
              x: [5.05, 5, 5],
              v: [0, 0, 0],
              massKg: 1.0e-2,
              specificInternalEnergyJPerKg: ironHotU
            }
          ];
          const source = sphStateModule.createSphState({
            smoothingLengthM,
            dimension: 3,
            step: lifecycleOrdinal,
            particles
          });
          const packed = gpuBuffers.buildSphGpuParticleBuffers(source, {
            materialProperties
          });
          const epoch = {
            storageGeneration: lifecycleOrdinal,
            physicsTick: lifecycleOrdinal,
            physicsSubstep: 0,
            positionEpoch: lifecycleOrdinal,
            topologyEpoch: 0,
            chartEpoch: 0,
            levelEpoch: lifecycleOrdinal,
            supportEpoch: lifecycleOrdinal
          };
          Object.assign(packed, epoch);
          const particleUpload = gpuBuffers.uploadSphGpuParticleBuffers(
            lifecycleDevice,
            packed
          );
          Object.assign(particleUpload, epoch, {
            bufferFamilyGenerationStatus:
              'schroeder-particle-buffer-family-generation-ready',
            slot: 0,
            sourceSlot: 0,
            nextSlot: 1
          });

          const activeRows = new Float32Array(packed.particleCount * 16);
          for (
            let index = 0;
            index < packed.particleCount;
            index += 1
          ) {
            const stateOffset = index * 8;
            const x = packed.state[stateOffset];
            const y = packed.state[stateOffset + 1];
            const z = packed.state[stateOffset + 2];
            const cellX = Math.floor(x / spatialCellSizeM);
            const cellY = Math.floor(y / spatialCellSizeM);
            const cellZ = Math.floor(z / spatialCellSizeM);
            activeRows.set([
              0, cellX, cellY, cellZ,
              cellX, cellY, cellZ, spatialCellSizeM,
              spatialCellSizeM, 2 * smoothingLengthM, index, 1,
              x, y, z, 0
            ], index * 16);
          }
          const activeNodeBuffer = taggedBuffer(
            `ulg-native-s9d5-lifecycle-${name}-active-nodes`,
            activeRows,
            GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          );
          const activeNodeList = {
            schema:
              'peercompute.ulg.schroeder-active-node-list-execution.v0',
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
            spatialEpochMinLevel: 0,
            spatialEpochMaxLevel: 0,
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
          const mechanicsBuffer = taggedBuffer(
            `ulg-native-s9d5-lifecycle-${name}-mechanics`,
            new Float32Array(packed.particleCount * 24),
            GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          );
          const mlsMpmParticleUpload = { mechanicsBuffer };
          const generation =
            spatial.runSchroederSpatialEpochGenerationWebGpu({
              device: lifecycleDevice,
              activeNodeList,
              particleCount: packed.particleCount,
              particleIdentityBuffer: particleUpload.identityBuffer,
              particleIdentityStrideWords: 1,
              particleBufferSet: particleUpload,
              laneId: `native-s9d5-lifecycle-${name}`,
              sourceFamily: `native-s9d5-lifecycle-${name}`,
              mechanicsLevels: [],
              directArenaCount: 1
            });
          requireTrue(
            generation.ready === true && generation.selected === true,
            `${name}: lifecycle spatial generation rejected: ${
              generation.status
            }`
          );
          const consumerSupportProfileIds = Object.fromEntries(
            proposalModule.SCHROEDER_SPATIAL_THERMAL_CONSUMERS.map(
              (consumer) => [
                consumer.consumerId,
                consumer.supportProfileId
              ]
            )
          );
          const transaction = transactionModule
            .createSchroederSpatialEpochTransaction({
              device: lifecycleDevice,
              generation,
              sphParticleUpload: particleUpload,
              mlsMpmParticleUpload,
              requiredReaderIds: [],
              enabledConsumerReaderIds:
                Object.keys(consumerSupportProfileIds),
              consumerSupportProfileIds
            });
          requireTrue(
            transactionModule
              .validateSchroederSpatialEpochTransactionSourceFamily(
                transaction,
                {
                  generation,
                  sphParticleUpload: particleUpload,
                  mlsMpmParticleUpload
                }
              ) === true,
            `${name}: lifecycle transaction source family rejected`
          );
          const proposal =
            proposalModule.runSchroederSpatialThermalProposalWebGpu({
              device: lifecycleDevice,
              generation,
              schroederSpatialEpochTransaction: transaction,
              sphParticleState: packed,
              sphParticleUpload: particleUpload,
              mlsMpmParticleUpload,
              thermalResponseGraphUpload: lifecycleResponseUpload,
              dtS: 0.1,
              smoothingLengthM: packed.smoothingLengthM,
              conductionRate: 1500
            });
          requireTrue(proposal.ready === true, `${name}: proposal not ready`);
          const receipt = proposalModule
            .armSchroederSpatialThermalSourceCellTreeShadowForNativeTest({
              device: lifecycleDevice,
              schroederSpatialThermalProposal: proposal,
              observeTraversalCounters: false
            });
          requireTrue(
            receipt.tree === generation.exactNearCellTree
              && receipt.treeConsumerLease.released === false
              && receipt.generationConsumerLease.released === false,
            `${name}: source-cell lifecycle receipt was not live`
          );
          await lifecycleDevice.queue.onSubmittedWorkDone();
          return {
            name,
            packed,
            particleUpload,
            activeNodeBuffer,
            activeNodeList,
            mechanicsBuffer,
            generation,
            proposal,
            receipt
          };
        };
        const cleanupLiveFixture = async (fixture, reason) => {
          if (!fixture) return;
          const { proposal, generation } = fixture;
          if (proposal && proposal.released !== true) {
            proposal.abandonPreparedWork(reason);
            await lifecycleDevice.queue.onSubmittedWorkDone();
            await waitUntil(
              `${fixture.name}: proposal release`,
              () => proposal.released === true
            );
          }
          if (generation?.execution?.released !== true) {
            const scheduled =
              spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
                generation,
                lifecycleDevice
              );
            requireTrue(
              scheduled === true || generation.releasePromise?.then,
              `${fixture.name}: generation release was not scheduled`
            );
            await lifecycleDevice.queue.onSubmittedWorkDone();
            if (generation.releasePromise?.then) {
              requireTrue(
                await generation.releasePromise === true,
                `${fixture.name}: generation retirement was not confirmed`
              );
            }
          }
          requireTrue(
            generation.execution.released === true
              && generation.exactNearCellTree.released === true,
            `${fixture.name}: generation/tree remained live after cleanup`
          );
          gpuBuffers.destroySphGpuParticleBuffers(fixture.particleUpload);
          fixture.mechanicsBuffer.destroy?.();
          fixture.activeNodeBuffer.destroy?.();
        };

        let reuseReceipt = null;
        let bindEncodeReceipt = null;
        let liveFixture = null;
        let lossFixture = null;
        try {
          lifecycleResponseUpload =
            thermal.uploadSphThermalResponseGraphBuffers(
              lifecycleDevice,
              {
                thermalMaterialTable,
                thermalClosureGraphSet: graphSet,
                thermalClosureGraphBank: graphSet.graphBank,
                thermalPhaseResponseTable: phaseResponseTable
              }
            );
        try {
          liveFixture = await makeFixture('released-reused-tree');
          const oldTree = liveFixture.generation.exactNearCellTree;
          const oldArenaIndex = oldTree.arenaIndex;
          const oldArenaGeneration = oldTree.arenaGeneration;
          const oldTreeBuffer = oldTree.treeBuffer;
          requireTrue(
            oldTree.ownerRuntime.releaseExecutionConsumerLease(
              liveFixture.receipt.treeConsumerLease,
              { discardedEncoder: true }
            ) === true,
            'released-reused-tree: tree consumer lease did not release'
          );
          requireTrue(
            await oldTree.ownerRuntime.releaseExecutionAfter(
              oldTree,
              lifecycleDevice.queue.onSubmittedWorkDone()
            ) === true,
            'released-reused-tree: old exact tree did not retire'
          );
          const replacementEncoder = lifecycleDevice.createCommandEncoder({
            label: 'ulg-native-s9d5-lifecycle-replacement-tree'
          });
          const replacementTree = oldTree.ownerRuntime.encode(
            replacementEncoder,
            {
              spatialExecution: oldTree.spatialExecution,
              supportProfileId: oldTree.supportProfileId
            }
          );
          lifecycleDevice.queue.submit([replacementEncoder.finish()]);
          requireTrue(
            oldTree.ownerRuntime.markExecutionSubmitted(replacementTree)
              === true,
            'released-reused-tree: replacement submit was not authenticated'
          );
          await lifecycleDevice.queue.onSubmittedWorkDone();
          requireTrue(
            replacementTree.treeBuffer === oldTreeBuffer
              && replacementTree.arenaIndex === oldArenaIndex
              && replacementTree.arenaGeneration > oldArenaGeneration,
            'released-reused-tree: exact physical arena was not reused'
          );
          liveFixture.generation.exactNearCellTree = replacementTree;
          const staleBindingError = syncError(
            'released-reused-tree stale binding',
            () => proposalModule
              .createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
                device: lifecycleDevice,
                schroederSpatialThermalProposal: liveFixture.proposal,
                currentStateBuffer:
                  liveFixture.particleUpload.stateBuffer,
                currentThermoBuffer:
                  liveFixture.particleUpload.thermoBuffer,
                thermalResponseGraphUpload: lifecycleResponseUpload,
                ...liveFixture.proposal.preparedLawConfig
              })
          );
          requireTrue(
            staleBindingError.code
              === 'ERR_SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_STALE_BINDING',
            `released-reused-tree: wrong rejection ${
              JSON.stringify(staleBindingError)
            }`
          );
          reuseReceipt = {
            oldTreeReleased: oldTree.released === true,
            sameTreeBuffer: replacementTree.treeBuffer === oldTreeBuffer,
            sameArenaIndex: replacementTree.arenaIndex === oldArenaIndex,
            oldArenaGeneration,
            replacementArenaGeneration:
              replacementTree.arenaGeneration,
            staleBindingError
          };
        } finally {
          await cleanupLiveFixture(
            liveFixture,
            'native-s9d5-released-reused-tree-probe-complete'
          );
          liveFixture = null;
        }

        try {
          liveFixture = await makeFixture('released-generation-lease');
          const stage = proposalModule
            .createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
              device: lifecycleDevice,
              schroederSpatialThermalProposal: liveFixture.proposal,
              currentStateBuffer: liveFixture.particleUpload.stateBuffer,
              currentThermoBuffer: liveFixture.particleUpload.thermoBuffer,
              thermalResponseGraphUpload: lifecycleResponseUpload,
              ...liveFixture.proposal.preparedLawConfig
            });
          requireTrue(
            spatial.releaseSchroederSpatialEpochGenerationConsumerLease(
              liveFixture.receipt.generationConsumerLease,
              { discardedEncoder: true }
            ) === true,
            'released-generation-lease: generation lease did not release'
          );
          const discardedEncoder = lifecycleDevice.createCommandEncoder({
            label: 'ulg-native-s9d5-lifecycle-stale-before-encode'
          });
          const staleEncodeError = syncError(
            'released-generation-lease stale encode',
            () => stage.encode(discardedEncoder)
          );
          requireTrue(
            staleEncodeError.code
              === 'ERR_SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_STALE_BINDING',
            `released-generation-lease: wrong rejection ${
              JSON.stringify(staleEncodeError)
            }`
          );
          bindEncodeReceipt = {
            boundBeforeRelease: true,
            generationLeaseReleased:
              liveFixture.receipt.generationConsumerLease.released === true,
            staleEncodeError
          };
        } finally {
          await cleanupLiveFixture(
            liveFixture,
            'native-s9d5-released-generation-lease-probe-complete'
          );
          liveFixture = null;
        }

        try {
          lossFixture = await makeFixture('device-loss');
          await lifecycleDevice.queue.onSubmittedWorkDone();
          const lossPromise = lifecycleDevice.lost;
          const retirement =
            spatial.quarantineSchroederSpatialEpochGenerationAfterDeviceLoss(
              lossFixture.generation,
              lifecycleDevice
            );
          requireTrue(
            retirement?.then,
            'device-loss: generation quarantine did not return a promise'
          );
          lifecycleDevice.destroy();
          deviceDestroyed = true;
          const [lossInfo, retired] = await Promise.all([
            lossPromise,
            retirement
          ]);
          await waitUntil(
            'device-loss: thermal proposal release',
            () => lossFixture.proposal.released === true
          );
          await new Promise((resolve) => setTimeout(resolve, 0));
          requireTrue(
            lossInfo?.reason === 'destroyed',
            `device-loss: browser reported ${lossInfo?.reason}`
          );
          requireTrue(
            retired === true,
            'device-loss: generation quarantine was not confirmed'
          );
          requireTrue(
            lossFixture.generation.releaseStatus
              === 'spatial-epoch-generation-device-loss-retired',
            `device-loss: wrong generation status ${
              lossFixture.generation.releaseStatus
            }`
          );
          requireTrue(
            lossFixture.generation.execution.released === true
              && lossFixture.generation.exactNearCellTree.released === true
              && lossFixture.generation.exactNearCellTree.deviceLost === true,
            'device-loss: directory/tree did not retire as lost'
          );
          requireTrue(
            lossFixture.generation.releaseOperationResults?.every(
              ({ confirmed }) => confirmed === true
            ) === true,
            `device-loss: artifact retirement incomplete ${
              JSON.stringify(
                lossFixture.generation.releaseOperationResults
              )
            }`
          );
          requireTrue(
            lossFixture.proposal.terminalDisposition
                === 'device-lost-quarantined'
              && lossFixture.proposal.released === true
              && lossFixture.receipt.treeConsumerLease.released === true
              && lossFixture.receipt.generationConsumerLease.released
                === true,
            'device-loss: proposal or source-cell leases remained live'
          );
          const materializeAfterLossError = syncError(
            'device-loss materialization',
            () => proposalModule
              .createSchroederSpatialMatchedTimeThermalProposalEncoderStage({
                device: lifecycleDevice,
                schroederSpatialThermalProposal: lossFixture.proposal,
                currentStateBuffer:
                  lossFixture.particleUpload.stateBuffer,
                currentThermoBuffer:
                  lossFixture.particleUpload.thermoBuffer,
                thermalResponseGraphUpload: lifecycleResponseUpload,
                ...lossFixture.proposal.preparedLawConfig
              })
          );
          requireTrue(
            materializeAfterLossError.message
              === 'Matched-time thermal proposal device is lost',
            `device-loss: wrong materialization rejection ${
              JSON.stringify(materializeAfterLossError)
            }`
          );
          const rearmAfterLossError = syncError(
            'device-loss source-cell rearm',
            () => proposalModule
              .armSchroederSpatialThermalSourceCellTreeShadowForNativeTest({
                device: lifecycleDevice,
                schroederSpatialThermalProposal: lossFixture.proposal,
                observeTraversalCounters: false
              })
          );
          requireTrue(
            rearmAfterLossError.message
              === 'Native thermal source-cell tree shadow requires the live proposal device',
            `device-loss: wrong rearm rejection ${
              JSON.stringify(rearmAfterLossError)
            }`
          );
          const spatialReentryError = syncError(
            'device-loss spatial reentry',
            () => spatial.runSchroederSpatialEpochGenerationWebGpu({
              device: lifecycleDevice,
              activeNodeList: lossFixture.activeNodeList,
              particleCount: lossFixture.packed.particleCount,
              particleIdentityBuffer:
                lossFixture.particleUpload.identityBuffer,
              particleIdentityStrideWords: 1,
              particleBufferSet: lossFixture.particleUpload,
              laneId: 'native-s9d5-lifecycle-device-loss-reentry',
              sourceFamily:
                'native-s9d5-lifecycle-device-loss-reentry',
              mechanicsLevels: [],
              directArenaCount: 1
            })
          );
          requireTrue(
            spatialReentryError.code
              === 'ERR_SCHROEDER_SPATIAL_DEVICE_LOST',
            `device-loss: wrong spatial rejection ${
              JSON.stringify(spatialReentryError)
            }`
          );
          requireTrue(
            lifecycleUncapturedErrors.length === 0,
            `lifecycle uncaptured errors: ${
              lifecycleUncapturedErrors.join(' | ')
            }`
          );
          return {
            schema:
              'peercompute.ulg.native-test.s9d5-source-cell-lifecycle.v0',
            isolatedDevice: lifecycleDevice !== device,
            adapterInfo: lifecycleAdapterInfo,
            reuse: reuseReceipt,
            bindToEncode: bindEncodeReceipt,
            deviceLoss: {
              reason: lossInfo.reason,
              message: lossInfo.message || null,
              generationReleaseStatus:
                lossFixture.generation.releaseStatus,
              operationCount:
                lossFixture.generation.releaseOperationResults?.length ?? 0,
              operationsConfirmed:
                lossFixture.generation.releaseOperationResults?.every(
                  ({ confirmed }) => confirmed === true
                ) === true,
              treeDeviceLost:
                lossFixture.generation.exactNearCellTree.deviceLost === true,
              treeReleased:
                lossFixture.generation.exactNearCellTree.released === true,
              proposalDisposition:
                lossFixture.proposal.terminalDisposition,
              proposalReleased: lossFixture.proposal.released === true,
              treeLeaseReleased:
                lossFixture.receipt.treeConsumerLease.released === true,
              generationLeaseReleased:
                lossFixture.receipt.generationConsumerLease.released
                  === true,
              materializeAfterLossError,
              rearmAfterLossError,
              spatialReentryError
            },
            uncapturedErrors: lifecycleUncapturedErrors
          };
        } finally {
          if (!deviceDestroyed) {
            await cleanupLiveFixture(
              lossFixture,
              'native-s9d5-device-loss-probe-aborted-before-destroy'
            );
            if (lifecycleResponseUpload) {
              thermal.destroySphThermalResponseGraphBuffers(
                lifecycleResponseUpload
              );
              lifecycleResponseUpload = null;
            }
            lifecycleDevice.destroy();
            deviceDestroyed = true;
          }
        }
        } finally {
          if (!deviceDestroyed) {
            try {
              await cleanupLiveFixture(
                liveFixture,
                'native-s9d5-lifecycle-campaign-aborted'
              );
              await cleanupLiveFixture(
                lossFixture,
                'native-s9d5-lifecycle-loss-campaign-aborted'
              );
              if (lifecycleResponseUpload) {
                thermal.destroySphThermalResponseGraphBuffers(
                  lifecycleResponseUpload
                );
                lifecycleResponseUpload = null;
              }
            } finally {
              lifecycleDevice.destroy();
              deviceDestroyed = true;
            }
          }
        }
      };
      try {
        radiationResponseUpload =
          thermal.uploadSphThermalResponseGraphBuffers(device, {
            thermalMaterialTable,
            thermalClosureGraphSet: graphSet,
            thermalClosureGraphBank: graphSet.graphBank,
            thermalPhaseResponseTable: radiationPhaseResponseTable
          });
        responseUpload = thermal.uploadSphThermalResponseGraphBuffers(device, {
          thermalMaterialTable,
          thermalClosureGraphSet: graphSet,
          thermalClosureGraphBank: graphSet.graphBank,
          thermalPhaseResponseTable: phaseResponseTable
        });
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
          sameGenerationSourceCellTreeShadow: runNativeTreeShadow,
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
          mixedComparison.sourceCellByteReceipts =
            cases[0].sameGenerationSourceCellTreeParity.byteReceipts;
          mixedComparison.sourceCellBatchControlReceipts =
            cases[0].sameGenerationSourceCellTreeParity
              .batchControlReceipts;
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

        const directoryV2Sparse = await runFixture({
          name: 'directory-v2-active-source-sparse-iron-ice-planes',
          smoothingLengthM: productionSmoothingLengthM,
          spatialCellSizeM: productionPitchM,
          nativeGridSpacingM: productionPitchM,
          exactTouchPlane: true,
          particles: frozenSlabParticles,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(directoryV2Sparse);
        requireTrue(
          directoryV2Sparse.activeSourceProjectionMode
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_SOURCE
            && directoryV2Sparse.particleCount === 32
            && directoryV2Sparse.currentActiveCount === 8
            && directoryV2Sparse.expectedActiveCount === 8
            && directoryV2Sparse.materializedRankCount === 8
            && directoryV2Sparse.inactiveProposalRowCount === 24
            && directoryV2Sparse.activeDispatch[0] === 1
            && directoryV2Sparse.activeDispatch[1] === 1
            && directoryV2Sparse.exactTouchEvidence?.h2oAcceptedEnergyJ > 0,
          `directory-v2 sparse ActiveSource thermal path failed: ${
            JSON.stringify(directoryV2Sparse)
          }`
        );

        const directoryV2Dormant = await runFixture({
          name: 'directory-v2-active-source-all-dormant',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(directoryV2Dormant);
        requireTrue(
          directoryV2Dormant.currentActiveCount === 0
            && directoryV2Dormant.expectedActiveCount === 0
            && directoryV2Dormant.materializedRankCount === 0
            && directoryV2Dormant.physicalTopologyMismatchCount === 0
            && directoryV2Dormant.activeDispatch[0] === 0
            && directoryV2Dormant.activeDispatch[1] === 1
            && directoryV2Dormant.activeDispatch[2] === 1
            && JSON.stringify(directoryV2Dormant.physicalTopologyDispatch)
              === JSON.stringify([1, 1, 1])
            && directoryV2Dormant.conductionEvidence[0] === 0
            && directoryV2Dormant.conductionEvidence[1] === 0
            && directoryV2Dormant.radiationEvidence[0] === 0
            && directoryV2Dormant.radiationEvidence[1] === 0
            && directoryV2Dormant.publishedRowCount === 4
            && directoryV2Dormant.inactiveProposalRowCount === 4,
          `directory-v2 all-dormant zero-dispatch path failed: ${
            JSON.stringify(directoryV2Dormant)
          }`
        );

        const directoryV2HighSlotParticles = Array.from(
          { length: 1024 },
          (_, index) => {
            const active = index === 7 || index === 1000;
            const isWater = index === 7;
            return {
              id: `directory-v2-high-slot-${index}`,
              material: isWater ? 'h2o' : 'fe',
              x: [
                1 + (index % 32) * 0.2,
                1 + Math.floor(index / 32) * 0.2,
                1
              ],
              v: [0, 0, 0],
              massKg: active ? 1.0e-3 : 0,
              specificInternalEnergyJPerKg:
                isWater ? productionIceColdU : ironColdU
            };
          }
        );
        const directoryV2HighSlotSparse = await runFixture({
          name: 'directory-v2-active-source-p1024-a2-high-slots',
          particles: directoryV2HighSlotParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true,
          nativeTestActiveSourceDispatchXLimit: 4
        });
        cases.push(directoryV2HighSlotSparse);
        requireTrue(
          directoryV2HighSlotSparse.particleCount === 1024
            && directoryV2HighSlotSparse.currentActiveCount === 2
            && directoryV2HighSlotSparse.expectedActiveCount === 2
            && directoryV2HighSlotSparse.materializedRankCount === 2
            && directoryV2HighSlotSparse.physicalTopologyMismatchCount === 0
            && JSON.stringify(
              directoryV2HighSlotSparse.materializedActiveSources
            ) === JSON.stringify([7, 1000])
            && JSON.stringify(directoryV2HighSlotSparse.activeDispatch)
              === JSON.stringify([1, 1, 1])
            && JSON.stringify(
              directoryV2HighSlotSparse.physicalTopologyDispatch
            ) === JSON.stringify([4, 4, 1])
            && directoryV2HighSlotSparse.inactiveProposalRowCount === 1022
            && directoryV2HighSlotSparse.publishedRowCount === 1024
            && directoryV2HighSlotSparse.conductionEvidence[0] === 4
            && directoryV2HighSlotSparse.conductionEvidence[1] === 4
            && directoryV2HighSlotSparse.radiationEvidence[0] === 4
            && directoryV2HighSlotSparse.radiationEvidence[1] === 4,
          `directory-v2 P1024/A2 high-slot path failed: ${
            JSON.stringify(directoryV2HighSlotSparse)
          }`
        );

        const baseMismatch = await runFixture({
          name: 'directory-v2-active-source-dormant-to-active-fails-closed',
          particles: allDormantParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          currentMasses: [1.0e-3, 0, 0, 0],
          expectedPhysicalTopologyMismatchCount: 1,
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(baseMismatch);
        requireTrue(
          baseMismatch.expectedFailClosed === true
            && baseMismatch.physicalTopologyMismatchCount === 1
            && baseMismatch.currentActiveCount === 0
            && baseMismatch.expectedActiveCount === 0
            && baseMismatch.materializedRankCount === 0,
          `directory-v2 ActiveSource current mass mismatch did not fail closed: ${
            JSON.stringify(baseMismatch)
          }`
        );

        const activeToDormant = await runFixture({
          name: 'directory-v2-active-source-active-to-dormant-fails-closed',
          particles: corruptedProjectionParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          currentMasses: [1.0e-3, 0, 0, 0],
          expectedPhysicalTopologyMismatchCount: 1,
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(activeToDormant);
        requireTrue(
          activeToDormant.expectedFailClosed === true
            && activeToDormant.physicalTopologyMismatchCount === 1,
          `directory-v2 ActiveSource active-to-dormant transition did not fail closed: ${
            JSON.stringify(activeToDormant)
          }`
        );

        const activeMassChange = await runFixture({
          name: 'directory-v2-active-source-active-mass-change-fails-closed',
          particles: corruptedProjectionParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          currentMasses: [1.0e-3, 0, 2.0e-2, 0],
          expectedPhysicalTopologyMismatchCount: 1,
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(activeMassChange);
        requireTrue(
          activeMassChange.expectedFailClosed === true
            && activeMassChange.physicalTopologyMismatchCount === 1,
          `directory-v2 ActiveSource active mass drift did not fail closed: ${
            JSON.stringify(activeMassChange)
          }`
        );

        const baseCorruptProjection = await runFixture({
          name: 'directory-v2-active-source-corrupt-paired-index-fails-closed',
          particles: corruptedProjectionParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          corruptActiveProjection: { ordinal: 0, sourceIndex: 1 },
          expectedPhysicalTopologyMismatchCount: 1,
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(baseCorruptProjection);
        requireTrue(
          baseCorruptProjection.expectedFailClosed === true,
          `directory-v2 ActiveSource paired-index corruption did not fail closed: ${
            JSON.stringify(baseCorruptProjection)
          }`
        );

        const reverseCorruptProjection = await runFixture({
          name: 'directory-v2-active-source-corrupt-reverse-index-fails-closed',
          particles: corruptedProjectionParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          corruptPhysicalToActiveProjection: {
            physicalIndex: 0,
            activeOrdinal: 1
          },
          expectedPhysicalTopologyMismatchCount: 1,
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(reverseCorruptProjection);
        requireTrue(
          reverseCorruptProjection.expectedFailClosed === true
            && reverseCorruptProjection.physicalTopologyMismatchCount === 1,
          `directory-v2 ActiveSource reverse-map corruption did not fail closed: ${
            JSON.stringify(reverseCorruptProjection)
          }`
        );

        const separatedDirectoryCellParticles =
          corruptedProjectionParticles.map((particle, index) => ({
            ...particle,
            x: index < 2
              ? [5 + index * 0.01, 5, 5]
              : [6 + (index - 2) * 0.01, 5, 5]
          }));
        const directoryCellCorruption = await runFixture({
          name: 'directory-v2-active-source-corrupt-physical-cell-fails-closed',
          particles: separatedDirectoryCellParticles,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          corruptDirectoryPhysicalCell: {
            physicalIndex: 0,
            cellPlusOne: 2
          },
          expectedPhysicalTopologyMismatchCount: 1,
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(directoryCellCorruption);
        requireTrue(
          directoryCellCorruption.expectedFailClosed === true
            && directoryCellCorruption.physicalTopologyMismatchCount === 1,
          `directory-v2 physical-cell corruption did not fail closed: ${
            JSON.stringify(directoryCellCorruption)
          }`
        );

        const baseMultiWorkgroup = await runFixture({
          name: 'directory-v2-active-source-sixty-five-active',
          particles: multiWorkgroupParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(baseMultiWorkgroup);
        requireTrue(
          baseMultiWorkgroup.particleCount === 65
            && baseMultiWorkgroup.currentActiveCount === 65
            && baseMultiWorkgroup.expectedActiveCount === 65
            && baseMultiWorkgroup.materializedRankCount === 65
            && baseMultiWorkgroup.activeDispatch[0] === 2,
          `directory-v2 ActiveSource 65-active dispatch failed: ${
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
          name: 'directory-v2-active-source-one-thousand-twenty-six-currently-separated-csr-replays',
          particles: activeSeparatedCapacityParticles,
          currentPositions: activeSeparatedCurrentPositions,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true,
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
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_SOURCE
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
          name: 'directory-v2-active-source-one-thousand-twenty-six-one-near-pair-csr-replays',
          particles: activeSeparatedCapacityParticles,
          currentPositions: activeNearFarCurrentPositions,
          smoothingLengthM: 0.1,
          spatialCellSizeM: 0.1,
          useAggregate: false,
          useDirectoryV2: true,
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
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_SOURCE
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

        const activeSourceUniformTemperature = await runFixture({
          name: 'directory-v2-active-source-uniform-temperature-sixty-five-active-completion',
          particles: uniformTemperatureParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(activeSourceUniformTemperature);
        requireTrue(
          activeSourceUniformTemperature.activeSourceProjectionMode
              === proposalModule
                .SCHROEDER_SPATIAL_THERMAL_ACTIVE_SOURCE_PROJECTION_MODE_ACTIVE_SOURCE
            && activeSourceUniformTemperature.particleCount === 130
            && activeSourceUniformTemperature.inactiveProposalRowCount === 65
            && activeSourceUniformTemperature.currentActiveCount === 65
            && activeSourceUniformTemperature.expectedActiveCount === 65
            && activeSourceUniformTemperature.materializedRankCount === 65
            && activeSourceUniformTemperature.activeDispatch[0] === 2
            && activeSourceUniformTemperature.conductionEvidence[3] === 0
            && activeSourceUniformTemperature.radiationEvidence[3] === 0
            && activeSourceUniformTemperature.proposalRows.every((row) => (
              row[0] === 0 && row[1] === 0
            )),
          `directory-v2 ActiveSource uniform completion retained traversal work or wrote nonzero transfer: ${
            JSON.stringify({
              currentActiveCount: activeSourceUniformTemperature.currentActiveCount,
              expectedActiveCount: activeSourceUniformTemperature.expectedActiveCount,
              materializedRankCount: activeSourceUniformTemperature.materializedRankCount,
              conductionEvidence: activeSourceUniformTemperature.conductionEvidence,
              radiationEvidence: activeSourceUniformTemperature.radiationEvidence,
              proposalRows: activeSourceUniformTemperature.proposalRows
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

        const activeSourceUniformCorrupt = await runFixture({
          name: 'directory-v2-active-source-uniform-corrupt-mapping-fails-closed',
          particles: uniformTemperatureParticles,
          smoothingLengthM: 0.05,
          spatialCellSizeM: 0.1,
          corruptActiveProjection: { ordinal: 0, sourceIndex: 1 },
          expectProducerFailClosed: true,
          requireThermalExchange: false,
          useAggregate: false,
          useDirectoryV2: true
        });
        cases.push(activeSourceUniformCorrupt);
        requireTrue(
          activeSourceUniformCorrupt.expectedFailClosed === true,
          `directory-v2 ActiveSource uniform corrupt mapping was not rejected: ${
            JSON.stringify(activeSourceUniformCorrupt)
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
              name: 'radiation-only-nonzero-wide-support',
              args: {
                particles: [
                  {
                    id: 'radiation-wide-cold-water',
                    material: 'h2o',
                    x: [0, 0, 0],
                    v: [0, 0, 0],
                    massKg: 1.0e-3,
                    specificInternalEnergyJPerKg: productionIceColdU
                  },
                  {
                    id: 'radiation-wide-hot-iron',
                    material: 'fe',
                    x: [0.03, 0, 0],
                    v: [0, 0, 0],
                    massKg: 1.0e-2,
                    specificInternalEnergyJPerKg: ironHotU
                  }
                ],
                smoothingLengthM: 0.005,
                spatialCellSizeM: 0.01,
                dtS: 0.001,
                requireConductionExchange: false,
                radiationEnabled: true,
                requireRadiationExchange: true,
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
              name: 'local-rank-dormant-projection',
              args: {
                particles: frozenSlabParticles,
                smoothingLengthM: productionSmoothingLengthM,
                spatialCellSizeM: productionPitchM,
                nativeGridSpacingM: productionPitchM,
                exactTouchPlane: true,
                useAggregate: false
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
              sameGenerationSourceCellTreeShadow: true,
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
              direct.sameGenerationSourceCellTreeParity?.exact === true
                && Object.values(
                  direct.sameGenerationSourceCellTreeParity.byteReceipts
                ).every(Boolean)
                && Object.values(
                  direct.sameGenerationSourceCellTreeParity
                    .batchControlReceipts
                ).every(Boolean),
              `${campaign.name}: source-cell byte/batch comparator failed: ${
                JSON.stringify(
                  direct.sameGenerationSourceCellTreeParity
                )
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
              sourceCellByteReceipts:
                direct.sameGenerationSourceCellTreeParity.byteReceipts,
              sourceCellBatchControlReceipts:
                direct.sameGenerationSourceCellTreeParity
                  .batchControlReceipts,
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
            const sourceCellRejected = await runFixture({
              name:
                `source-cell-tree-shadow-corrupt-${corruption.name}-fails-closed`,
              particles: mixedBoilingParticles,
              producerTraversal:
                'native-test-source-cell-tree-shadow',
              corruptTreeWord: corruption,
              expectTreeFailClosed: true,
              includePairLedgerInResult: false
            });
            const sourceCellFallbackCounts = [
              sourceCellRejected.conductionEvidence[13],
              sourceCellRejected.conductionEvidence[14],
              sourceCellRejected.conductionEvidence[15],
              sourceCellRejected.radiationEvidence[13],
              sourceCellRejected.radiationEvidence[14],
              sourceCellRejected.radiationEvidence[15]
            ];
            requireTrue(
              sourceCellRejected.expectedFailClosed === true
                && sourceCellRejected.publishedRowCount === 0
                && sourceCellRejected.proposalInvalidCounts.every(
                  (count) => count > 0
                )
                && sourceCellRejected
                  .sourceCellTreeShadowBatchControl?.length === 64
                && sourceCellRejected
                  .sourceCellTreeShadowBatchControl[2] === 4
                && sourceCellFallbackCounts.every((count) => count === 0),
              `corrupt ${corruption.name} source-cell tree did not fail closed: ${
                JSON.stringify(sourceCellRejected)
              }`
            );
            sourceCellTreeShadowFailureCases.push({
              name: corruption.name,
              failClosed: true,
              batchRejected: true,
              fallbackCounts: sourceCellFallbackCounts
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
            'direct-perParticle-sourceCell',
            'sourceCell-perParticle-direct',
            'perParticle-sourceCell-direct',
            'direct-sourceCell-perParticle'
          ];
          const measuredOrders = [
            'direct-perParticle-sourceCell',
            'direct-sourceCell-perParticle',
            'perParticle-direct-sourceCell',
            'perParticle-sourceCell-direct',
            'sourceCell-direct-perParticle',
            'sourceCell-perParticle-direct',
            'direct-perParticle-sourceCell',
            'perParticle-sourceCell-direct',
            'sourceCell-direct-perParticle'
          ];
          const timingCampaigns = [];
          for (
            let fixtureIndex = 0;
            fixtureIndex < timingFixtures.length;
            fixtureIndex += 1
          ) {
            const fixture = timingFixtures[fixtureIndex];
            const counterProbe = await runThermalTimingTrio({
              ...fixture,
              order: warmupOrders[fixtureIndex % warmupOrders.length],
              ordinal: 9_000 + fixtureIndex,
              observeSourceCellCounters: true,
              detailedSourceCellTimestamps: true
            });
            const warmups = [];
            for (
              let orderIndex = 0;
              orderIndex < warmupOrders.length;
              orderIndex += 1
            ) {
              warmups.push(await runThermalTimingTrio({
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
              measurements.push(await runThermalTimingTrio({
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
              counterProbe,
              measurements
            });
          }
          const ratioReceipt = (
            measurements,
            directValue,
            contenderValue,
            contenderRoute
          ) => {
            const direct = measurements.map(directValue);
            const contender = measurements.map(contenderValue);
            const paired = measurements.map((sample, index) => (
              contender[index] / direct[index]
            ));
            const directionalRatios = (directFirst) => measurements
              .map((sample, index) => ({
                routes: sample.order.split('-'),
                ratio: paired[index]
              }))
              .filter(({ routes }) => (
                directFirst
                  ? routes.indexOf('direct')
                    < routes.indexOf(contenderRoute)
                  : routes.indexOf(contenderRoute)
                    < routes.indexOf('direct')
              ))
              .map(({ ratio }) => ratio);
            const positionMedians = (route, values) => (
              [0, 1, 2].map((position) => median(
                measurements
                  .map((sample, index) => ({ sample, value: values[index] }))
                  .filter(({ sample }) => (
                    sample.order.split('-')[position] === route
                  ))
                  .map(({ value }) => value)
              ))
            );
            const directBefore = directionalRatios(true);
            const contenderBefore = directionalRatios(false);
            requireTrue(
              directBefore.length + contenderBefore.length
                  === measurements.length
                && Math.min(
                  directBefore.length,
                  contenderBefore.length
                ) === 4
                && Math.max(
                  directBefore.length,
                  contenderBefore.length
                ) === 5,
              `timing pair directions were not balanced for ${
                contenderRoute
              }: ${directBefore.length}/${contenderBefore.length}`
            );
            return {
              directMedianMs: median(direct),
              contender: contenderRoute,
              contenderMedianMs: median(contender),
              pairedRatioMedian: median(paired),
              independentRatio:
                median(contender) / median(direct),
              directBeforeContenderCount: directBefore.length,
              contenderBeforeDirectCount: contenderBefore.length,
              directBeforeContenderRatioMedian: median(directBefore),
              contenderBeforeDirectRatioMedian: median(contenderBefore),
              directPositionMediansMs:
                positionMedians('direct', direct),
              contenderPositionMediansMs:
                positionMedians(contenderRoute, contender)
            };
          };
          const stageValue = (route, stage) => (sample) => (
            sample[route].timing[stage]
          );
          const traversalValue = (route) => (sample) => (
            sample[route].timing['directional-budget']
              + sample[route].timing['reciprocal-limited-proposal']
          );
          const sourceCellSetupValue = (sample) => (
            sample.sourceCell.timing['source-cell-initialize']
              + sample.sourceCell.timing['source-cell-projection']
              + sample.sourceCell.timing['source-cell-build']
              + sample.sourceCell.timing['source-cell-finalize']
          );
          const sourceCellTraversalValue = (sample) => (
            traversalValue('sourceCell')(sample)
          );
          const totalValue = (route) => (sample) => (
            sample[route].timing['thermal-producer-apply-total']
          );
          const sharedValue = (route) => (sample) => (
            sample.treeBuildMs
              + sample[route].timing['thermal-producer-apply-total']
          );
          const candidateTimingReceipt = (
            campaign,
            contenderRoute,
            contenderTraversalValue
          ) => {
            const receipt = {
              directionalBudget: ratioReceipt(
                campaign.measurements,
                stageValue('direct', 'directional-budget'),
                stageValue(contenderRoute, 'directional-budget'),
                contenderRoute
              ),
              reciprocalProposal: ratioReceipt(
                campaign.measurements,
                stageValue('direct', 'reciprocal-limited-proposal'),
                stageValue(contenderRoute, 'reciprocal-limited-proposal'),
                contenderRoute
              ),
              traversal: ratioReceipt(
                campaign.measurements,
                traversalValue('direct'),
                contenderTraversalValue,
                contenderRoute
              ),
              fullThermalRoute: ratioReceipt(
                campaign.measurements,
                totalValue('direct'),
                totalValue(contenderRoute),
                contenderRoute
              ),
              sharedTreePlusThermal: ratioReceipt(
                campaign.measurements,
                sharedValue('direct'),
                sharedValue(contenderRoute),
                contenderRoute
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
                && metric.directBeforeContenderRatioMedian <= 1.05
                && metric.contenderBeforeDirectRatioMedian <= 1.05
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
          };
          const timingFixtureReceipts = timingCampaigns.map((campaign) => {
            const routePositionCounts = Object.fromEntries(
              ['direct', 'perParticle', 'sourceCell'].map((route) => [
                route,
                [0, 1, 2].map((position) => (
                  campaign.measurements.filter((sample) => (
                    sample.order.split('-')[position] === route
                  )).length
                ))
              ])
            );
            requireTrue(
              Object.values(routePositionCounts).every((counts) => (
                counts.every((count) => count === 3)
              )),
              `${campaign.name}: timing trio positions were not balanced: ${
                JSON.stringify(routePositionCounts)
              }`
            );
            const sourceCellBatchControls = [
              campaign.counterProbe.sourceCell.batchControl
            ];
            const receipt = {
              name: campaign.name,
              directoryAbiVersion:
                campaign.counterProbe.directoryAbiVersion,
              sourceWorkIdentity:
                campaign.counterProbe.sourceWorkIdentity,
              evidenceScope:
                campaign.counterProbe.evidenceScope,
              warmupSamples: campaign.warmupCount,
              measuredSamples: campaign.measurements.length,
              measuredOrders: campaign.measuredOrders,
              treeBuildMedianMs: median(campaign.measurements.map(
                ({ treeBuildMs }) => treeBuildMs
              )),
              routePositionCounts,
              perParticle: candidateTimingReceipt(
                campaign,
                'perParticle',
                traversalValue('perParticle')
              ),
              sourceCell: candidateTimingReceipt(
                campaign,
                'sourceCell',
                sourceCellTraversalValue
              ),
              sourceCellSetupMedianMs:
                sourceCellSetupValue(campaign.counterProbe),
              measuredParityExact: campaign.measurements.every(
                ({ parityReceipts }) => Object.values(
                  parityReceipts
                ).every((parity) => Object.values(parity).every(Boolean))
              ),
              rawSamples: campaign.measurements.map((sample) => ({
                order: sample.order,
                ordinal: sample.ordinal,
                treeBuildMs: sample.treeBuildMs,
                parityReceipts: sample.parityReceipts,
                direct: {
                  timing: sample.direct.timing,
                  csrStatus: sample.direct.csrStatus,
                  csrRoute: sample.direct.csrRoute
                },
                perParticle: {
                  timing: sample.perParticle.timing,
                  csrStatus: sample.perParticle.csrStatus,
                  csrRoute: sample.perParticle.csrRoute
                },
                sourceCell: {
                  timing: sample.sourceCell.timing,
                  csrStatus: sample.sourceCell.csrStatus,
                  csrRoute: sample.sourceCell.csrRoute
                }
              })),
              sourceCellBatchControl: {
                allSealed: sourceCellBatchControls.every((header) => (
                  header?.length === 64
                    && header[0] === 0x5343_4231
                    && header[1] === 1
                    && header[2] === 2
                    && header[21] === 0
                    && header[23] === 0
                    && header[25] === 0
                )),
                validatedNodeCountMedian: median(
                  sourceCellBatchControls.map((header) => header[20])
                ),
                builtCellRowCountMedian: median(
                  sourceCellBatchControls.map((header) => header[22])
                ),
                sourceCellTreeWalkCountMedian: median(
                  sourceCellBatchControls.map((header) => header[27])
                ),
                buildNodeVisitCountMedian: median(
                  sourceCellBatchControls.map((header) => header[28])
                ),
                buildCandidateCellCountMedian: median(
                  sourceCellBatchControls.map((header) => header[30])
                ),
                budgetSourceRowCountMedian: median(
                  sourceCellBatchControls.map((header) => header[32])
                ),
                proposalSourceRowCountMedian: median(
                  sourceCellBatchControls.map((header) => header[36])
                )
              }
            };
            return receipt;
          });
          const compositeDirect = [];
          const compositePerParticle = [];
          const compositeSourceCell = [];
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
            compositePerParticle.push(timingCampaigns.reduce(
              (sum, campaign) => sum
                + totalValue('perParticle')(
                  campaign.measurements[sampleIndex]
                ),
              0
            ));
            compositeSourceCell.push(timingCampaigns.reduce(
              (sum, campaign) => sum
                + totalValue('sourceCell')(
                  campaign.measurements[sampleIndex]
                ),
              0
            ));
          }
          const compositeReceipt = (contender) => ({
            pairedRatioMedian: median(contender.map(
              (value, index) => value / compositeDirect[index]
            )),
            independentRatio:
              median(contender) / median(compositeDirect),
            directMedianMs: median(compositeDirect),
            contenderMedianMs: median(contender)
          });
          const composite = {
            perParticle: compositeReceipt(compositePerParticle),
            sourceCell: compositeReceipt(compositeSourceCell)
          };
          const perParticleAccepted = timingFixtureReceipts.every(
            ({ perParticle }) => perParticle.accepted
          )
            && composite.perParticle.pairedRatioMedian <= 1.0
            && composite.perParticle.independentRatio <= 1.0;
          const sourceCellAccepted = timingFixtureReceipts.every(
            ({
              sourceCell,
              sourceCellBatchControl,
              measuredParityExact
            }) => (
              sourceCell.accepted
                && sourceCellBatchControl.allSealed
                && measuredParityExact
            )
          )
            && composite.sourceCell.pairedRatioMedian <= 1.0
            && composite.sourceCell.independentRatio <= 1.0;
          thermalTreeTiming = {
            schema:
              'peercompute.ulg.native-test.s9d5-thermal-source-cell-tree-timing.v0',
            directoryAbiVersion: 1,
            sourceWorkIdentity: 'legacy-directory-member-rank',
            evidenceScope: 'native-directory-v1-tree-shadow-only',
            timestampQueryRequired: true,
            arms: ['direct', 'perParticle', 'sourceCell'],
            warmupSamplesPerFixture: warmupOrders.length,
            measuredSamplesPerFixture: measuredOrders.length,
            warmupOrders,
            measuredOrders,
            fixtures: timingFixtureReceipts,
            composite,
            perParticleAccepted,
            sourceCellAccepted,
            accepted: sourceCellAccepted,
            experimentalDecision: sourceCellAccepted
              ? 'source-cell-benchmark-admitted-for-later-gate'
              : 'source-cell-benchmark-rejected',
            productionDecision: 'retain-direct'
          };
        }
      } finally {
        if (responseUpload) {
          thermal.destroySphThermalResponseGraphBuffers(responseUpload);
        }
        if (radiationResponseUpload) {
          thermal.destroySphThermalResponseGraphBuffers(
            radiationResponseUpload
          );
        }
      }

      if (runNativeTreeShadow) {
        sourceCellLifecycle = await runSourceCellLifecycleCampaign();
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
        sourceCellTreeShadowFailureCases,
        sourceCellLifecycle,
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
    assert.match(
      adapterDescription,
      /nvidia/,
      `native thermal tree timing requires NVIDIA hardware: ${
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
      'directory-v2-active-source-sparse-iron-ice-planes',
      'directory-v2-active-source-all-dormant',
      'directory-v2-active-source-p1024-a2-high-slots',
      'directory-v2-active-source-dormant-to-active-fails-closed',
      'directory-v2-active-source-active-to-dormant-fails-closed',
      'directory-v2-active-source-active-mass-change-fails-closed',
      'directory-v2-active-source-corrupt-paired-index-fails-closed',
      'directory-v2-active-source-corrupt-reverse-index-fails-closed',
      'directory-v2-active-source-corrupt-physical-cell-fails-closed',
      'directory-v2-active-source-sixty-five-active',
      'local-two-live-plus-one-thousand-twenty-four-dormant-csr-replays',
      'directory-v2-active-source-one-thousand-twenty-six-currently-separated-csr-replays',
      'directory-v2-active-source-one-thousand-twenty-six-one-near-pair-csr-replays',
      'dense-one-thousand-twenty-six-overflow-rewalks-exactly',
      'uniform-temperature-sixty-five-active-completion',
      'directory-v2-active-source-uniform-temperature-sixty-five-active-completion',
      'stale-uniform-cpu-mirror-nonuniform-gpu-state-seals-csr',
      'directory-v2-active-source-uniform-corrupt-mapping-fails-closed'
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
    assert.deepEqual(
      native.cases[0].sameGenerationSourceCellTreeParity?.byteReceipts,
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
      JSON.stringify(
        native.cases[0].sameGenerationSourceCellTreeParity
      )
    );
    assert.equal(
      native.cases[0].sameGenerationSourceCellTreeParity?.exact,
      true,
      JSON.stringify(
        native.cases[0].sameGenerationSourceCellTreeParity
      )
    );
    assert.ok(
      Object.values(
        native.cases[0].sameGenerationSourceCellTreeParity
          ?.batchControlReceipts || {}
      ).every(Boolean),
      JSON.stringify(
        native.cases[0].sameGenerationSourceCellTreeParity
      )
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
        { name: 'radiation-only-nonzero-wide-support', exact: true },
        {
          name: 'matched-time-current-contact-frozen-separated',
          exact: true
        },
        {
          name: 'matched-time-current-separated-frozen-contact',
          exact: true
        },
        { name: 'base-active-rank-dormant-projection', exact: true },
        { name: 'local-rank-dormant-projection', exact: true },
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
          && Object.values(receipt.sourceCellByteReceipts).every(Boolean)
          && Object.values(
            receipt.sourceCellBatchControlReceipts
          ).every(Boolean)
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
    assert.deepEqual(
      native.sourceCellTreeShadowFailureCases,
      [
        'status',
        'generation-id',
        'position-epoch',
        'node-capacity',
        'node-offset',
        'root-aabb-nan',
        'live-child-status-cleared',
        'duplicate-live-leaf'
      ].map((name) => ({
        name,
        failClosed: true,
        batchRejected: true,
        fallbackCounts: [0, 0, 0, 0, 0, 0]
      }))
    );
    assert.equal(native.sourceCellLifecycle?.isolatedDevice, true);
    assert.match(
      Object.values(native.sourceCellLifecycle.adapterInfo || {})
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      /nvidia/
    );
    assert.equal(
      native.sourceCellLifecycle?.reuse?.oldTreeReleased,
      true
    );
    assert.equal(
      native.sourceCellLifecycle?.reuse?.sameTreeBuffer,
      true
    );
    assert.equal(
      native.sourceCellLifecycle?.reuse?.sameArenaIndex,
      true
    );
    assert.ok(
      native.sourceCellLifecycle.reuse.replacementArenaGeneration
        > native.sourceCellLifecycle.reuse.oldArenaGeneration
    );
    assert.equal(
      native.sourceCellLifecycle.reuse.staleBindingError.code,
      'ERR_SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_STALE_BINDING'
    );
    assert.equal(
      native.sourceCellLifecycle.bindToEncode.boundBeforeRelease,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.bindToEncode.generationLeaseReleased,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.bindToEncode.staleEncodeError.code,
      'ERR_SCHROEDER_SPATIAL_THERMAL_TREE_SHADOW_STALE_BINDING'
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.reason,
      'destroyed'
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.generationReleaseStatus,
      'spatial-epoch-generation-device-loss-retired'
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.operationsConfirmed,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.treeDeviceLost,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.treeReleased,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.proposalDisposition,
      'device-lost-quarantined'
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.proposalReleased,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.treeLeaseReleased,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.generationLeaseReleased,
      true
    );
    assert.equal(
      native.sourceCellLifecycle.deviceLoss.spatialReentryError.code,
      'ERR_SCHROEDER_SPATIAL_DEVICE_LOST'
    );
    assert.deepEqual(native.sourceCellLifecycle.uncapturedErrors, []);
    assert.equal(
      native.thermalTreeTiming?.schema,
      'peercompute.ulg.native-test.s9d5-thermal-source-cell-tree-timing.v0'
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
      native.thermalTreeTiming?.arms,
      ['direct', 'perParticle', 'sourceCell']
    );
    assert.deepEqual(
      native.thermalTreeTiming?.warmupOrders,
      [
        'direct-perParticle-sourceCell',
        'sourceCell-perParticle-direct',
        'perParticle-sourceCell-direct',
        'direct-sourceCell-perParticle'
      ]
    );
    assert.deepEqual(
      native.thermalTreeTiming?.measuredOrders,
      [
        'direct-perParticle-sourceCell',
        'direct-sourceCell-perParticle',
        'perParticle-direct-sourceCell',
        'perParticle-sourceCell-direct',
        'sourceCell-direct-perParticle',
        'sourceCell-perParticle-direct',
        'direct-perParticle-sourceCell',
        'perParticle-sourceCell-direct',
        'sourceCell-direct-perParticle'
      ]
    );
    assert.deepEqual(
      native.thermalTreeTiming?.fixtures.map(({ name }) => name),
      [
        'sparse-many-cells-replay',
        'clustered-multi-cell-replay',
        'dense-one-cell-overflow-rewalk'
      ]
    );
    assert.equal(native.thermalTreeTiming?.directoryAbiVersion, 1);
    assert.equal(
      native.thermalTreeTiming?.sourceWorkIdentity,
      'legacy-directory-member-rank'
    );
    assert.equal(
      native.thermalTreeTiming?.evidenceScope,
      'native-directory-v1-tree-shadow-only'
    );
    assert.ok(
      native.thermalTreeTiming.fixtures.every((fixture) => (
        fixture.directoryAbiVersion === 1
          && fixture.sourceWorkIdentity === 'legacy-directory-member-rank'
          && fixture.evidenceScope
            === 'native-directory-v1-tree-shadow-only'
          && fixture.measuredSamples === 9
          && fixture.treeBuildMedianMs > 0
          && Object.values(fixture.routePositionCounts).every(
            (counts) => counts.every((count) => count === 3)
          )
          && fixture.perParticle.traversal.directMedianMs > 0
          && fixture.perParticle.traversal.contenderMedianMs > 0
          && fixture.perParticle.fullThermalRoute.directMedianMs > 0
          && fixture.perParticle.fullThermalRoute.contenderMedianMs > 0
          && fixture.sourceCellSetupMedianMs > 0
          && fixture.sourceCell.traversal.directMedianMs > 0
          && fixture.sourceCell.traversal.contenderMedianMs > 0
          && fixture.sourceCell.fullThermalRoute.directMedianMs > 0
          && fixture.sourceCell.fullThermalRoute.contenderMedianMs > 0
          && fixture.sourceCellBatchControl.allSealed === true
          && fixture.measuredParityExact === true
          && fixture.rawSamples.length === 9
      )),
      JSON.stringify(native.thermalTreeTiming)
    );
    assert.equal(
      native.thermalTreeTiming.productionDecision,
      'retain-direct'
    );
    const timingSummary = {
      adapterInfo: native.adapterInfo,
      directoryAbiVersion:
        native.thermalTreeTiming.directoryAbiVersion,
      sourceWorkIdentity:
        native.thermalTreeTiming.sourceWorkIdentity,
      evidenceScope:
        native.thermalTreeTiming.evidenceScope,
      accepted: native.thermalTreeTiming.accepted,
      perParticleAccepted:
        native.thermalTreeTiming.perParticleAccepted,
      sourceCellAccepted:
        native.thermalTreeTiming.sourceCellAccepted,
      experimentalDecision:
        native.thermalTreeTiming.experimentalDecision,
      productionDecision:
        native.thermalTreeTiming.productionDecision,
      composite: native.thermalTreeTiming.composite,
      fixtures: native.thermalTreeTiming.fixtures.map((fixture) => ({
        name: fixture.name,
        treeBuildMedianMs: fixture.treeBuildMedianMs,
        routePositionCounts: fixture.routePositionCounts,
        perParticle: fixture.perParticle,
        sourceCell: fixture.sourceCell,
        sourceCellSetupMedianMs: fixture.sourceCellSetupMedianMs,
        sourceCellBatchControl: fixture.sourceCellBatchControl,
        measuredParityExact: fixture.measuredParityExact,
        rawSamples: fixture.rawSamples
      }))
    };
    console.log(
      `S9D5_THERMAL_SOURCE_CELL_TIMING ${JSON.stringify(timingSummary)}`
    );
  } else {
    assert.deepEqual(native.treeShadowComparisons, []);
    assert.deepEqual(native.treeShadowFailureCases, []);
    assert.equal(native.sourceCellLifecycle, null);
    assert.equal(native.thermalTreeTiming, null);
  }
});
