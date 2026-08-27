import assert from 'node:assert/strict';
import { test } from 'node:test';

// Diagnostic-only reproduction of the first authoritative two-level
// mechanics transaction for the exact mounted iron/ice preset.  It deliberately
// reports zero motion instead of treating it as a test failure: the evidence is
// intended to identify the earliest stage at which mass or velocity disappears.
const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_IRON_ICE_MECHANICS_DIAGNOSTIC === '1';
const DIAGNOSTIC_PRESET_ID =
  process.env.ULG_MECHANICS_DIAGNOSTIC_PRESET === 'cesium-fluorine'
    ? 'cesium-fluorine'
    : 'iron-ice-quench';
const NATIVE_BASE_URL =
  process.env.ULG_IRON_ICE_MECHANICS_DIAGNOSTIC_BASE_URL
  || 'https://127.0.0.1:5174/';
const DIAGNOSTIC_MODE =
  process.env.ULG_IRON_ICE_MECHANICS_DIAGNOSTIC_MODE === 'single-level'
    ? 'single-level'
    : 'two-level';
const SMOKE_MODE =
  process.env.ULG_IRON_ICE_MECHANICS_DIAGNOSTIC_SMOKE === '1';

test(`native ${DIAGNOSTIC_PRESET_ID} ${DIAGNOSTIC_MODE}${SMOKE_MODE ? ' smoke' : ''} mechanics diagnostic`, {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_IRON_ICE_MECHANICS_DIAGNOSTIC=1 for native WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath:
      process.env.ULG_IRON_ICE_MECHANICS_DIAGNOSTIC_CHROME
      || '/usr/bin/google-chrome',
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
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async ({
      diagnosticMode,
      diagnosticPresetId,
      smokeMode
    }) => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }

      const hierarchySource = await fetch(
        '/src/runtime/sph/schroederHierarchyGpu.js'
      ).then((response) => response.text());
      const dependencyUrl = (sources, path) => {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const source of sources) {
          const match = source.match(new RegExp(
            `["']([^"']*${escaped}(?:\\?[^"']*)?)["']`
          ));
          if (match) return match[1];
        }
        throw new Error(`Vite dependency URL not found for ${path}`);
      };
      const crossLevelUrl = dependencyUrl(
        [hierarchySource],
        '/src/runtime/sph/schroederCrossLevelCouplingGpu.js'
      );
      const crossLevelSource = await fetch(crossLevelUrl)
        .then((response) => response.text());
      const buffersUrl = dependencyUrl(
        [hierarchySource, crossLevelSource],
        '/src/runtime/sph/sphGpuBuffers.js'
      );
      const mechanicsRefreshUrl = dependencyUrl(
        [hierarchySource, crossLevelSource],
        '/src/runtime/sph/sphMechanicsRefreshGpuKernel.js'
      );

      const [
        deviceLimits,
        buffersModule,
        mechanicsRefreshModule,
        materialTableModule,
        hierarchyModule,
        crossLevelModule,
        proposalModule,
        pairGraphAbiModule,
        aggregateViewAbiModule,
        demoModule,
        bodiesModule,
        presetsModule,
        scenarioModule
      ] = await Promise.all([
        import('/src/runtime/webgpuDeviceLimits.js'),
        import(buffersUrl),
        import(mechanicsRefreshUrl),
        import('/src/runtime/sph/sphMechanicsMaterialTable.js'),
        import('/src/runtime/sph/schroederHierarchyGpu.js'),
        import(crossLevelUrl),
        import('/src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js'),
        import('/ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js'),
        import('/ulg-gpu-abi/src/schroederSpatialAggregateView.js'),
        import('/src/runtime/sphPhaseDemo.js'),
        import('/src/runtime/sphInitialBodies.js'),
        import('/src/runtime/sphPhaseScenarioPresets.js'),
        import('/src/runtime/thermoPreflight.js')
      ]);

      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      const deviceLost = device.lost.then((info) => ({
        reason: info.reason,
        message: info.message
      }));
      device.pushErrorScope('validation');

      const preset = presetsModule.sphPhaseScenarioPresetById(
        diagnosticPresetId
      );
      const controls = preset.controls;
      const sceneLengthScale = Number(
        preset.runtime.sceneLengthScale ?? 1
      );
      const wallFaces = Object.fromEntries([
        ['xMin', 'wxmin'],
        ['xMax', 'wxmax'],
        ['yMin', 'wymin'],
        ['yMax', 'wymax'],
        ['zMin', 'wzmin'],
        ['zMax', 'wzmax']
      ].map(([faceId, key]) => {
        const temperatureK = Number(controls[key]);
        return [
          faceId,
          Number.isFinite(temperatureK) ? temperatureK : 293.15
        ];
      }));
      const scenario = scenarioModule.createSphPhaseScenario({
        wallFaces,
        wallModel: preset.runtime.wallModel,
        sceneLengthScale,
        boxDimensionsM:
          ['boxx', 'boxy', 'boxz'].map((key) => Number(controls[key]))
      });
      const cesiumFluorine = diagnosticPresetId === 'cesium-fluorine';
      const initialBodies = cesiumFluorine
        ? bodiesModule.sphInitialBodiesFromLegacyDropBase({
            baseMaterial: 'F',
            dropMaterial: 'Cs',
            baseSizeM: [1, 1, 1],
            dropSizeM: [0.6, 0.6, 0.6],
            baseCenterM: [2, 0.5, 2],
            dropCenterM: [2, 1.31, 2],
            baseTemperatureK: 293.15,
            dropTemperatureK: 293.15,
            baseParticlesPerEdge: smokeMode ? [2, 2, 2] : [5, 5, 5],
            dropParticlesPerEdge: smokeMode ? [2, 2, 2] : [5, 5, 5]
          })
        : bodiesModule.sphInitialBodiesFromLegacyPhaseControls({
            baseMaterial: controls.base,
            dropMaterial: controls.drop,
            baseTemperatureK: Number(controls.baset),
            dropTemperatureK: Number(controls.dropt),
            baseParticlesPerEdge: smokeMode ? 2 : Number(controls.basen),
            dropParticlesPerEdge: smokeMode ? 2 : Number(controls.dropn),
            referenceBaseEdgeM: scenario.referenceGeometry.iceEdgeM,
            referenceBaseParticlesPerEdge: 5,
            sceneLengthScale,
            referenceBoxDimensionsM:
              scenario.referenceGeometry.boxDimensionsM,
            referenceBaseBottomM: Number(controls.iceh),
            referenceDropBottomM: Number(controls.ironh)
          });
      const demo = demoModule.buildSphPhaseDemoState({
        scenario,
        initialBodies,
        mechanics: 'mlsmpm',
        allowReducedProductProperties: true
      });
      const buildOptions = {
        materialProperties: demo.materialProperties,
        initialParticleSpacing: demo.initialParticleSpacing
      };
      const packedSph = buffersModule.buildSphGpuParticleBuffers(
        demo.state,
        buildOptions
      );
      const packedMls = buffersModule.buildMlsMpmGpuParticleBuffers(
        demo.state,
        buildOptions
      );
      const epochIdentity = {
        storageGeneration: 1,
        bufferFamilyGeneration: 1,
        physicsTick: 0,
        physicsSubstep: 0,
        positionEpoch: 0,
        topologyEpoch: 0,
        chartEpoch: 0,
        levelEpoch: 0,
        supportEpoch: 0
      };
      Object.assign(packedSph, epochIdentity);
      Object.assign(packedMls, epochIdentity);
      const sphParticleUpload =
        buffersModule.uploadSphGpuParticleBuffers(device, packedSph);
      const mlsMpmParticleUpload =
        buffersModule.uploadMlsMpmGpuParticleBuffers(device, packedMls);
      for (const upload of [sphParticleUpload, mlsMpmParticleUpload]) {
        Object.assign(upload, {
          ...epochIdentity,
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1,
          step: 0,
          time: 0
        });
      }

      const mechanicsMaterialTable =
        materialTableModule.buildMlsMpmMechanicsMaterialTable(
          demo.materialProperties,
          {
            soundSpeedScale: packedMls.soundSpeedScale,
            cflMaxSoundSpeedMPerS: packedMls.cflMaxSoundSpeedMPerS,
            minGasSoundSpeedMPerS: packedMls.minGasSoundSpeedMPerS,
            viscosityEnabled: packedMls.viscosityEnabled,
            mlsMpmArtificialViscosityAlpha:
              packedMls.mlsMpmArtificialViscosityAlpha,
            viscosityLengthM: packedMls.viscosityLengthM,
            surfaceTensionEnabled:
              demo.physicalLawGroups?.surfaceTension === true
          }
        );
      const mechanicsMaterialPhaseUpload =
        mechanicsRefreshModule.uploadMlsMpmMechanicsMaterialPhaseRecords(
          device,
          mechanicsMaterialTable
        );

      const pendingReadbacks = [];
      const queueReadback = (label, buffer, byteLength, metadata = {}) => {
        const size = Math.ceil(Number(byteLength) / 4) * 4;
        if (!buffer || !Number.isSafeInteger(size) || size <= 0) {
          pendingReadbacks.push({
            label,
            unavailable: true,
            reason: 'missing or malformed source buffer',
            ...metadata
          });
          return;
        }
        const readback = device.createBuffer({
          label: `native-iron-ice-${label}-readback`,
          size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder({
          label: `native-iron-ice-${label}-readback-encoder`
        });
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, size);
        device.queue.submit([encoder.finish()]);
        pendingReadbacks.push({
          label,
          readback,
          wordLength: size / 4,
          ...metadata
        });
      };

      let p2gCalls = 0;
      let gridUpdateCalls = 0;
      let g2pCalls = 0;
      let fieldProjectionQueued = false;
      let observedTwoLevelMechanics = null;
      let observedSpatialProposal = null;
      let observedSpatialProposalGeneration = null;
      const observedSpatialProposalRunner = (options) => {
        observedSpatialProposalGeneration = options.generation;
        observedSpatialProposal =
          proposalModule.runSchroederSpatialMechanicalProposalWebGpu(options);
        return observedSpatialProposal;
      };
      let assignmentQueued = false;
      const observedTwoLevelMechanicsRunner = async (options) => {
        if (!assignmentQueued) {
          assignmentQueued = true;
          queueReadback(
            'level-assignment',
            options.levelAssignment?.assignmentBuffer,
            options.levelAssignment?.assignmentBufferByteLength
              ?? options.levelAssignment?.assignmentBuffer?.size,
            {
              kind: 'level-assignment',
              particleCount: options.levelAssignment?.particleCount,
              strideWords:
                options.levelAssignment?.assignmentStrideFloats ?? 16
            }
          );
        }
        const productionP2gRunner = options.p2gRunner;
        const productionGridUpdateRunner = options.gridUpdateRunner;
        const productionG2pRunner = options.g2pRunner;
        observedTwoLevelMechanics =
          await crossLevelModule.runSchroederTwoLevelMechanicsStepWebGpu({
          ...options,
          canonicalSpatialAuthorityTrace: true,
          p2gRunner: async (p2gOptions) => {
            p2gCalls += 1;
            const projection = await productionP2gRunner(p2gOptions);
            if (
              !fieldProjectionQueued
              && projection?.mechanicsFieldViewBuffer
            ) {
              fieldProjectionQueued = true;
              const field = projection.mechanicsFieldViewExecution;
              queueReadback(
                'fine-p2g-field',
                projection.mechanicsFieldViewBuffer,
                field?.layout?.byteLength
                  ?? projection.mechanicsFieldViewBuffer?.size,
                { kind: 'mechanics-field' }
              );
              const generation =
                p2gOptions.schroederSpatialEpochGeneration;
              const activeSource = generation?.activeSourceView
                ?? generation?.execution?.activeSourceView
                ?? field?.activeSourceView
                ?? null;
              queueReadback(
                'fine-active-source',
                activeSource?.activeSourceViewBuffer,
                activeSource?.layout?.byteLength
                  ?? activeSource?.activeSourceViewBuffer?.size,
                { kind: 'active-source' }
              );
            }
            return projection;
          },
          gridUpdateRunner: async (gridUpdateOptions) => {
            gridUpdateCalls += 1;
            const update = await productionGridUpdateRunner(
              gridUpdateOptions
            );
            if (gridUpdateCalls === 1) {
              queueReadback(
                'fine-grid-update-field',
                update.mechanicsFieldViewBuffer,
                update.mechanicsFieldViewExecution?.layout?.byteLength
                  ?? update.mechanicsFieldViewBuffer?.size,
                { kind: 'mechanics-field' }
              );
            }
            return update;
          },
          g2pRunner: async (g2pOptions) => {
            g2pCalls += 1;
            const field = g2pOptions.gridUpdate?.mechanicsFieldViewExecution;
            const transaction =
              g2pOptions.fusedFineSubstepTransaction
              ?? g2pOptions.fusedCoarseTerminalTransaction
              ?? null;
            queueReadback(
              `pre-g2p-${g2pCalls}-field`,
              g2pOptions.gridUpdate?.mechanicsFieldViewBuffer,
              field?.layout?.byteLength
                ?? g2pOptions.gridUpdate?.mechanicsFieldViewBuffer?.size,
              { kind: 'mechanics-field' }
            );
            queueReadback(
              `pre-g2p-${g2pCalls}-reflux`,
              transaction?.refluxLedger?.buffer,
              transaction?.refluxLedger?.byteLength
                ?? transaction?.refluxLedger?.buffer?.size,
              { kind: 'reflux-ledger' }
            );
            const reconstruction = await productionG2pRunner(g2pOptions);
            queueReadback(
              `g2p-${g2pCalls}-field`,
              g2pOptions.gridUpdate?.mechanicsFieldViewBuffer,
              field?.layout?.byteLength
                ?? g2pOptions.gridUpdate?.mechanicsFieldViewBuffer?.size,
              { kind: 'mechanics-field' }
            );
            queueReadback(
              `g2p-${g2pCalls}-reflux`,
              transaction?.refluxLedger?.buffer,
              transaction?.refluxLedger?.byteLength
                ?? transaction?.refluxLedger?.buffer?.size,
              { kind: 'reflux-ledger' }
            );
            queueReadback(
              `g2p-${g2pCalls}-particle-state`,
              reconstruction.stateBuffer,
              reconstruction.stateBufferByteLength
                ?? reconstruction.stateBuffer?.size,
              {
                kind: 'particle-state',
                particleCount: packedSph.particleCount,
                strideWords: packedSph.stateStrideFloats,
                referenceState: packedSph.state
              }
            );
            return reconstruction;
          }
        });
        return observedTwoLevelMechanics;
      };
      observedTwoLevelMechanicsRunner
        .schroederSpatialTopologyTransitionAware = true;

      let residentCalls = 0;
      const baseGridSpacingM = cesiumFluorine
        ? Math.cbrt((3 * (0.6 / 5) ** 3) / (4 * Math.PI)) / 1.5
        : packedSph.smoothingLengthM;
      const hierarchyResult =
        await hierarchyModule.runSchroederSameLevelMechanicsWebGpu({
          device,
          sphParticleState: packedSph,
          mlsMpmParticleState: packedMls,
          sphParticleUpload,
          mlsMpmParticleUpload,
          selectedLevel: 0,
          minLevel: 0,
          maxLevel: diagnosticMode === 'single-level' ? 0 : 1,
          baseGridSpacingM,
          // Match the production worker-owned Cesium/F lane classifier.  The
          // iron diagnostic historically requests four cells explicitly,
          // while the Cesium preset leaves the hierarchy at its canonical
          // 1.5-cell default; forcing four here collapses every live Cs/F row
          // onto level zero and manufactures a zero-coarse-registry failure.
          targetSupportCells: cesiumFluorine ? 1.5 : 4,
          boxDimsM: scenario.box.dimensionsM,
          dt: 0.0005,
          gravityMPerS2: packedMls.gravityMPerS2,
          readbackMode: 'no-full-readback',
          enablePressureInterfaceOwnerScope: false,
          enableTwoLevelMechanics: diagnosticMode === 'two-level',
          twoLevelMechanicsAuthority: 'authoritative',
          twoLevelFineSubstepCount: 2,
          twoLevelConservationSummaryReadback: false,
          twoLevelCompactSummaryReadback: false,
          spatialEpochArenaCount: 4,
          residentStepOptions: {
            mechanicsMaterialTable,
            spatialMechanicalProposalRunner: observedSpatialProposalRunner,
            mechanicsRefreshOptions: {
              mechanicsMaterialPhaseUpload
            }
          },
          ...(diagnosticMode === 'two-level'
            ? {
                residentStepRunner: async () => {
                  residentCalls += 1;
                  return { status: 'resident-step-stubbed' };
                },
                twoLevelMechanicsRunner: observedTwoLevelMechanicsRunner
              }
            : {})
        });
      const residentStep = hierarchyResult.residentStep;
      const finalUpload =
        residentStep?.nextParticleUploads?.sphParticleUpload;
      queueReadback(
        'final-particle-state',
        finalUpload?.stateBuffer ?? residentStep?.stateBuffer,
        packedSph.particleCount * packedSph.stateStrideBytes,
        {
          kind: 'particle-state',
          particleCount: packedSph.particleCount,
          strideWords: packedSph.stateStrideFloats,
          referenceState: packedSph.state
        }
      );
      if (observedSpatialProposal) {
        queueReadback(
          'single-level-contact-evidence',
          observedSpatialProposal.evidence?.buffer,
          observedSpatialProposal.evidence?.wordCount
            * Uint32Array.BYTES_PER_ELEMENT,
          {
            kind: 'mechanical-evidence',
            layout: pairGraphAbiModule
              .SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_LAYOUT
          }
        );
        queueReadback(
          'single-level-contact-control',
          observedSpatialProposal.graphControlBuffer,
          observedSpatialProposal.contactGraph?.layout
            ?.bufferLayouts?.control?.byteLength,
          {
            kind: 'mechanical-control',
            layout: pairGraphAbiModule
              .SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_LAYOUT
          }
        );
        queueReadback(
          'single-level-contact-source-offsets',
          observedSpatialProposal.sourceOffsetBuffer,
          observedSpatialProposal.contactGraph?.layout
            ?.bufferLayouts?.sourceOffsets?.byteLength,
          {
            kind: 'mechanical-source-offsets',
            particleCount: packedSph.particleCount
          }
        );
        queueReadback(
          'single-level-contact-proposal',
          observedSpatialProposal.proposalBuffer,
          observedSpatialProposal.proposalBufferByteLength,
          {
            kind: 'mechanical-proposal',
            particleCount: packedSph.particleCount,
            headerWords: observedSpatialProposal.proposalHeaderWords,
            rowWords: observedSpatialProposal.proposalRowWords
          }
        );
        queueReadback(
          'single-level-spatial-directory-header',
          observedSpatialProposalGeneration?.directoryBuffer
            ?? observedSpatialProposalGeneration?.execution?.directoryBuffer,
          64 * Uint32Array.BYTES_PER_ELEMENT,
          { kind: 'raw-words' }
        );
        queueReadback(
          'single-level-aggregate-view-header',
          observedSpatialProposalGeneration?.aggregateView
            ?.aggregateViewBuffer,
          aggregateViewAbiModule.SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_WORDS
            * Uint32Array.BYTES_PER_ELEMENT,
          {
            kind: 'mechanical-evidence',
            layout: aggregateViewAbiModule
              .SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_LAYOUT
          }
        );
      }
      await device.queue.onSubmittedWorkDone();

      const summarizeLevelAssignment = (words, pending) => {
        const floats = new Float32Array(words.buffer);
        const levels = {};
        let liveCount = 0;
        let dormantCount = 0;
        let totalLiveMassKg = 0;
        for (let index = 0; index < pending.particleCount; index += 1) {
          const offset = index * pending.strideWords;
          const mass = floats[offset + 6];
          if (mass > 0) {
            liveCount += 1;
            totalLiveMassKg += mass;
            const level = Math.round(floats[offset]);
            levels[level] = (levels[level] ?? 0) + 1;
          } else {
            dormantCount += 1;
          }
        }
        return {
          header: Array.from(words.slice(0, 16)),
          particleCount: pending.particleCount,
          liveCount,
          dormantCount,
          totalLiveMassKg,
          liveLevelCounts: levels
        };
      };
      const summarizeField = (words) => {
        const floats = new Float32Array(words.buffer);
        const sourceCount = words[16] ?? 0;
        const descriptorOffset = words[24] ?? 0;
        const descriptorWords = words[25] ?? 0;
        const keyOffset = words[26] ?? 0;
        const keyWords = words[27] ?? 0;
        const stateOffset = words[30] ?? 0;
        const stateWords = words[31] ?? 0;
        const fieldCapacity = words[32] ?? 0;
        const fieldCount = Math.min(words[34] ?? 0, fieldCapacity);
        let enabledDescriptorCount = 0;
        for (let index = 0; index < sourceCount; index += 1) {
          if (words[descriptorOffset + index * descriptorWords + 3] === 1) {
            enabledDescriptorCount += 1;
          }
        }
        let invalidContactKeyCount = 0;
        let invalidContactPairCount = 0;
        let multiFieldNodeCount = 0;
        const invalidContactKeyExamples = [];
        const contactKeyCounts = {};
        let priorNode = null;
        let nodeGroup = [];
        const keyValidForContact = (key) => {
          const [, phase, material, domain] = key;
          return phase >= 1 && phase <= 4
            && material !== 0
            && (phase === 1 ? domain !== 0 : domain === 0);
        };
        const finishNodeGroup = () => {
          if (nodeGroup.length <= 1) {
            nodeGroup = [];
            return;
          }
          multiFieldNodeCount += 1;
          for (let left = 0; left < nodeGroup.length; left += 1) {
            for (
              let right = left + 1;
              right < nodeGroup.length;
              right += 1
            ) {
              if (
                !keyValidForContact(nodeGroup[left])
                || !keyValidForContact(nodeGroup[right])
              ) {
                invalidContactPairCount += 1;
              }
            }
          }
          nodeGroup = [];
        };
        for (let index = 0; index < fieldCount; index += 1) {
          const offset = keyOffset + index * keyWords;
          const key = Array.from(words.slice(offset, offset + 4));
          if (priorNode !== null && key[0] !== priorNode) finishNodeGroup();
          priorNode = key[0];
          nodeGroup.push(key);
          const contactKey = key.slice(1).join(':');
          contactKeyCounts[contactKey] =
            (contactKeyCounts[contactKey] ?? 0) + 1;
          if (!keyValidForContact(key)) {
            invalidContactKeyCount += 1;
            if (invalidContactKeyExamples.length < 8) {
              invalidContactKeyExamples.push(key);
            }
          }
        }
        finishNodeGroup();
        let fieldStateMassKg = 0;
        const fieldStateVector123 = [0, 0, 0];
        for (let index = 0; index < fieldCount; index += 1) {
          const offset = stateOffset + index * stateWords;
          fieldStateMassKg += floats[offset];
          fieldStateVector123[0] += floats[offset + 1];
          fieldStateVector123[1] += floats[offset + 2];
          fieldStateVector123[2] += floats[offset + 3];
        }
        const receiptOffset = Math.max(0, stateOffset - 36);
        return {
          header: Array.from(words.slice(0, 64)),
          status: words[2] ?? null,
          sourceCount,
          selectedLevel: new Int32Array(
            Uint32Array.of(words[17] ?? 0).buffer
          )[0],
          candidateCount: words[33] ?? null,
          fieldCount: words[34] ?? null,
          invalidSourceCount: words[35] ?? null,
          clippedCandidateCount: words[36] ?? null,
          overflowCount: words[37] ?? null,
          stateEncoding: words[59] ?? null,
          mutationOrdinal: words[63] ?? null,
          enabledDescriptorCount,
          invalidContactKeyCount,
          invalidContactPairCount,
          multiFieldNodeCount,
          invalidContactKeyExamples,
          contactKeyCounts,
          fieldStateMassKg,
          fieldStateVector123,
          receipt: Array.from(words.slice(
            receiptOffset,
            receiptOffset + 36
          ))
        };
      };
      const summarizeActiveSource = (words) => ({
        header: Array.from(words.slice(0, 48)),
        status: words[2] ?? null,
        physicalCount: words[16] ?? null,
        activeCount: words[18] ?? null,
        dormantCount: words[20] ?? null,
        invalidCount: words[21] ?? null,
        unsupportedCount: words[22] ?? null,
        candidateCount: words[43] ?? null
      });
      const summarizeRefluxLedger = (words) => ({
        header: Array.from(words.slice(0, 130)),
        status: words[2] ?? null,
        completionOrdinal: words[7] ?? null,
        committedFineSubsteps: words[8] ?? null,
        consumedFineSubsteps: words[15] ?? null,
        fineSubstepCount: words[54] ?? null,
        phase: words[59] ?? null,
        terminalStatus: words[80] ?? null,
        terminalToken: words[81] ?? null,
        publicationToken: words[95] ?? null,
        rollbackCount: words[122] ?? null
      });
      const summarizeParticleState = (words, pending) => {
        const floats = new Float32Array(words.buffer);
        let liveCount = 0;
        let referenceLiveCount = 0;
        let movingCount = 0;
        let positionChangedCount = 0;
        let maxPositionDeltaM = 0;
        let maxSpeedMPerS = 0;
        let kineticEnergyJ = 0;
        const totalMomentumKgMPerS = [0, 0, 0];
        for (let index = 0; index < pending.particleCount; index += 1) {
          const offset = index * pending.strideWords;
          const mass = floats[offset + 3];
          if (!(mass > 0)) continue;
          liveCount += 1;
          if (
            pending.referenceState
            && pending.referenceState[offset + 3] > 0
          ) {
            referenceLiveCount += 1;
            const positionDelta = Math.hypot(
              floats[offset] - pending.referenceState[offset],
              floats[offset + 1] - pending.referenceState[offset + 1],
              floats[offset + 2] - pending.referenceState[offset + 2]
            );
            if (positionDelta > 0) positionChangedCount += 1;
            maxPositionDeltaM = Math.max(maxPositionDeltaM, positionDelta);
          }
          const velocity = [
            floats[offset + 4],
            floats[offset + 5],
            floats[offset + 6]
          ];
          const speed = Math.hypot(...velocity);
          if (speed > 0) movingCount += 1;
          maxSpeedMPerS = Math.max(maxSpeedMPerS, speed);
          kineticEnergyJ += 0.5 * mass * speed * speed;
          for (let axis = 0; axis < 3; axis += 1) {
            totalMomentumKgMPerS[axis] += mass * velocity[axis];
          }
        }
        return {
          firstParticle: Array.from(floats.slice(0, pending.strideWords)),
          particleCount: pending.particleCount,
          liveCount,
          referenceLiveCount,
          movingCount,
          positionChangedCount,
          maxPositionDeltaM,
          maxSpeedMPerS,
          kineticEnergyJ,
          totalMomentumKgMPerS
        };
      };
      const summarizeMechanicalWords = (words, pending) => {
        const floats = new Float32Array(words.buffer);
        return {
          named: Object.fromEntries(pending.layout.map((field, index) => [
            field.slice(0, field.indexOf(':')),
            words[index]
          ])),
          floats: Object.fromEntries(pending.layout.flatMap((field, index) =>
            field.includes('f32')
              ? [[field.slice(0, field.indexOf(':')), floats[index]]]
              : []
          )),
          raw: Array.from(words)
        };
      };
      const summarizeMechanicalSourceOffsets = (words, pending) => {
        const sourceCount = Math.min(
          pending.particleCount,
          Math.max(0, words.length - 1)
        );
        let nonzeroDegreeCount = 0;
        let maxDirectedDegree = 0;
        let invalidMonotonicCount = 0;
        for (let index = 0; index < sourceCount; index += 1) {
          const degree = words[index + 1] - words[index];
          if (words[index + 1] < words[index]) invalidMonotonicCount += 1;
          if (degree > 0) nonzeroDegreeCount += 1;
          maxDirectedDegree = Math.max(maxDirectedDegree, degree);
        }
        return {
          sourceCount,
          publishedDirectedPairCount: words[sourceCount] ?? null,
          nonzeroDegreeCount,
          maxDirectedDegree,
          invalidMonotonicCount,
          firstOffsets: Array.from(words.slice(0, 32))
        };
      };
      const summarizeMechanicalProposal = (words, pending) => {
        const floats = new Float32Array(words.buffer);
        let correctedParticleCount = 0;
        let maxPositionDeltaM = 0;
        let maxVelocityDeltaMPerS = 0;
        let totalMechanicalHeatJ = 0;
        let totalInternalEnergyDeltaJ = 0;
        for (let index = 0; index < pending.particleCount; index += 1) {
          const offset = pending.headerWords + index * pending.rowWords;
          const positionDelta = Math.hypot(
            floats[offset],
            floats[offset + 1],
            floats[offset + 2]
          );
          const velocityDelta = Math.hypot(
            floats[offset + 4],
            floats[offset + 5],
            floats[offset + 6]
          );
          const mechanicalHeatJ = floats[offset + 3];
          const internalEnergyDeltaJ = floats[offset + 7];
          if (
            positionDelta > 0
            || velocityDelta > 0
            || mechanicalHeatJ > 0
            || internalEnergyDeltaJ > 0
          ) correctedParticleCount += 1;
          maxPositionDeltaM = Math.max(maxPositionDeltaM, positionDelta);
          maxVelocityDeltaMPerS = Math.max(
            maxVelocityDeltaMPerS,
            velocityDelta
          );
          totalMechanicalHeatJ += mechanicalHeatJ;
          totalInternalEnergyDeltaJ += internalEnergyDeltaJ;
        }
        return {
          header: Array.from(words.slice(0, pending.headerWords)),
          correctedParticleCount,
          maxPositionDeltaM,
          maxVelocityDeltaMPerS,
          totalMechanicalHeatJ,
          totalInternalEnergyDeltaJ
        };
      };

      const evidence = {};
      for (const pending of pendingReadbacks) {
        if (pending.unavailable) {
          evidence[pending.label] = {
            unavailable: true,
            reason: pending.reason
          };
          continue;
        }
        await pending.readback.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(
          pending.readback.getMappedRange()
        ).slice(0, pending.wordLength);
        pending.readback.unmap();
        pending.readback.destroy();
        evidence[pending.label] = pending.kind === 'level-assignment'
          ? summarizeLevelAssignment(words, pending)
          : pending.kind === 'mechanics-field'
            ? summarizeField(words)
            : pending.kind === 'active-source'
              ? summarizeActiveSource(words)
              : pending.kind === 'reflux-ledger'
                ? summarizeRefluxLedger(words)
                : pending.kind === 'mechanical-evidence'
                    || pending.kind === 'mechanical-control'
                  ? summarizeMechanicalWords(words, pending)
                  : pending.kind === 'mechanical-source-offsets'
                    ? summarizeMechanicalSourceOffsets(words, pending)
                  : pending.kind === 'mechanical-proposal'
                      ? summarizeMechanicalProposal(words, pending)
                      : pending.kind === 'raw-words'
                        ? { raw: Array.from(words) }
                      : summarizeParticleState(words, pending);
      }

      const validationError = await device.popErrorScope();
      mechanicsRefreshModule.destroyMlsMpmMechanicsMaterialPhaseUpload(
        mechanicsMaterialPhaseUpload
      );
      const result = {
        status: 'executed',
        diagnosticMode,
        smokeMode,
        presetId: preset.id,
        particleCount: packedSph.particleCount,
        initialLiveCount: packedSph.state.reduce(
          (count, value, index) => index % 8 === 3 && value > 0
            ? count + 1
            : count,
          0
        ),
        smoothingLengthM: packedSph.smoothingLengthM,
        baseGridSpacingM,
        boxDimensionsM: scenario.box.dimensionsM,
        dt: 0.0005,
        authority: residentStep?.authority ?? residentStep?.status ?? null,
        canonicalSpatialAuthorityTrace:
          observedTwoLevelMechanics?.canonicalSpatialAuthorityTrace ?? null,
        spatialProposalMetadata: observedSpatialProposal
          ? {
              aggregateHierarchyEnabled:
                observedSpatialProposal.aggregateHierarchyEnabled,
              aggregateAdmissionStatus:
                observedSpatialProposal.aggregateAdmissionStatus,
              activeRankViewEnabled:
                observedSpatialProposal.activeRankViewEnabled,
              activeRankViewAdmissionStatus:
                observedSpatialProposal.activeRankViewAdmissionStatus,
              spatialProjectionMode:
                observedSpatialProposal.spatialProjectionMode
            }
          : null,
        runnerCalls: {
          p2g: p2gCalls,
          gridUpdate: gridUpdateCalls,
          g2p: g2pCalls,
          resident: residentCalls
        },
        evidence,
        validationError: validationError?.message ?? null,
        uncapturedErrors
      };
      device.destroy();
      result.deviceLost = await Promise.race([
        deviceLost,
        Promise.resolve(null)
      ]);
      return result;
    }, {
      diagnosticMode: DIAGNOSTIC_MODE,
      diagnosticPresetId: DIAGNOSTIC_PRESET_ID,
      smokeMode: SMOKE_MODE
    });
  } finally {
    await browser.close();
  }

  console.log(
    `IRON_ICE_MECHANICS_DIAGNOSTIC ${JSON.stringify(native)}`
  );
  assert.equal(native.status, 'executed', JSON.stringify(native));
  assert.equal(native.presetId, DIAGNOSTIC_PRESET_ID);
  if (SMOKE_MODE) {
    assert.equal(native.initialLiveCount, 16);
    assert.ok(native.particleCount >= native.initialLiveCount);
  } else if (DIAGNOSTIC_PRESET_ID === 'cesium-fluorine') {
    assert.equal(native.particleCount, 1248);
    assert.equal(native.initialLiveCount, 250);
  } else {
    assert.equal(native.particleCount, 5472);
    assert.equal(native.initialLiveCount, 1216);
  }
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));
  if (DIAGNOSTIC_MODE === 'two-level') {
    assert.equal(
      native.evidence['level-assignment'].liveCount,
      SMOKE_MODE
        ? 16
        : (DIAGNOSTIC_PRESET_ID === 'cesium-fluorine' ? 250 : 1216)
    );
    assert.equal(
      native.evidence['level-assignment'].dormantCount,
      native.particleCount - native.initialLiveCount
    );
    assert.ok(native.runnerCalls.p2g > 0);
    assert.ok(native.runnerCalls.gridUpdate > 0);
    assert.ok(native.runnerCalls.g2p > 0);
    assert.ok(native.evidence['fine-p2g-field']);
    assert.ok(native.evidence['fine-grid-update-field']);
    if (!SMOKE_MODE && DIAGNOSTIC_PRESET_ID === 'cesium-fluorine') {
      assert.deepEqual(
        native.evidence['level-assignment'].liveLevelCounts,
        { 0: 125, 1: 125 }
      );
      assert.equal(
        native.canonicalSpatialAuthorityTrace?.status,
        'canonical-authority-trace-sequence-admitted',
        JSON.stringify(native.canonicalSpatialAuthorityTrace)
      );
      assert.equal(native.evidence['g2p-1-reflux']?.rollbackCount, 0);
      const firstFineState = native.evidence['g2p-1-particle-state'];
      const terminalState = native.evidence['final-particle-state'];
      assert.equal(firstFineState?.positionChangedCount, 125);
      assert.equal(terminalState?.liveCount, native.initialLiveCount);
      assert.equal(terminalState?.referenceLiveCount, native.initialLiveCount);
      assert.equal(terminalState?.positionChangedCount, native.initialLiveCount);
      assert.ok(
        terminalState?.maxPositionDeltaM
          > native.baseGridSpacingM * 1e-3,
        JSON.stringify(terminalState)
      );
    }
  } else {
    assert.ok(native.evidence['single-level-contact-evidence']);
    assert.ok(native.evidence['single-level-contact-control']);
    assert.ok(native.evidence['single-level-contact-source-offsets']);
    assert.ok(native.evidence['single-level-contact-proposal']);
  }
  assert.ok(native.evidence['final-particle-state']);
});
