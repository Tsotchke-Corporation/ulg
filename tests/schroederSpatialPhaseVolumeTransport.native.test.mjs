import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT_HOST === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

test('native Slice 9 production host path admits generated same-level pressure and drag', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_TRANSPORT_HOST=1 for native WebGPU',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_TRANSPORT_CHROME
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
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const deviceLimits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(
        deviceLimits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      // Vite versions dirty dependencies with ?t=... URLs. The grid-update
      // admission path uses private WeakMap brands, so import every producer
      // from the exact transformed dependency graph consumed by grid update.
      const updateSource = await fetch(
        '/src/runtime/sph/sphGridUpdateGpuKernel.js'
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
      const gridUrl = dependencyUrl(
        [updateSource],
        '/src/runtime/sph/sphGridGpuKernel.js'
      );
      const transactionUrl = dependencyUrl(
        [updateSource],
        '/src/runtime/sph/schroederSpatialEpochTransaction.js'
      );
      const mechanicsRefreshUrl = dependencyUrl(
        [updateSource],
        '/src/runtime/sph/sphMechanicsRefreshGpuKernel.js'
      );
      const [gridSource, transactionSource] = await Promise.all([
        fetch(gridUrl).then((response) => response.text()),
        fetch(transactionUrl).then((response) => response.text())
      ]);
      const buffersUrl = dependencyUrl(
        [gridSource],
        '/src/runtime/sph/sphGpuBuffers.js'
      );
      const spatialUrl = dependencyUrl(
        [transactionSource],
        '/src/runtime/sph/schroederSpatialEpochGpu.js'
      );
      const [
        abi,
        buffersModule,
        spatialModule,
        transactionModule,
        gridModule,
        updateModule,
        materialTableModule,
        mechanicsRefreshModule
      ] = await Promise.all([
        import('/ulg-gpu-abi/src/index.js'),
        import(buffersUrl),
        import(spatialUrl),
        import(transactionUrl),
        import(gridUrl),
        import('/src/runtime/sph/sphGridUpdateGpuKernel.js'),
        import('/src/runtime/sph/sphMechanicsMaterialTable.js'),
        import(mechanicsRefreshUrl)
      ]);

      const mechanicsMaterialTable =
        materialTableModule.buildMlsMpmMechanicsMaterialTable({
          h2o: {
            molarMassKgPerMol: 0.018015,
            phases: [{
              name: 'liquid',
              densityKgPerM3: 997,
              bulkModulusPa: 2.2e9,
              shearModulusPa: 0,
              cpJPerKgK: 4184,
              dynamicViscosityPaS: 0.001,
              temperatureRange: [273.15, 373.15]
            }, {
              name: 'gas',
              densityKgPerM3: 0.6,
              bulkModulusPa: null,
              shearModulusPa: 0,
              cpJPerKgK: 2010,
              dynamicViscosityPaS: 1.3e-5,
              temperatureRange: [373.15, 1000]
            }]
          }
        }, { viscosityEnabled: true });
      const materialId = mechanicsMaterialTable.metadata[0].materialId;
      const particleCount = 3;
      const mechanicsStride =
        abi.MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
      const restVolumeM3 = 0.001;
      const liquidMassKg = 997 * restVolumeM3;
      const gasMassKg = 0.6 * restVolumeM3;
      const state = new Float32Array([
        0.88, 1, 1, liquidMassKg, 0.2, 0, 0, 16,
        1.07, 1, 1, gasMassKg, -0.2, 0, 0, 16,
        1.5, 1.5, 1.5, liquidMassKg, 0, 0, 0, 16
      ]);
      const thermo = new Float32Array(particleCount * 12);
      const identity = new Uint32Array([101, 102, 201]);
      const mechanics = new Float32Array(
        particleCount * mechanicsStride
      );
      const phases = [2, 3, 2];
      const densities = [997, 0.6, 997];
      const temperatures = [300, 500, 300];
      for (let index = 0; index < particleCount; index += 1) {
        thermo.set([
          materialId,
          phases[index],
          temperatures[index],
          densities[index],
          0,
          phases[index] === 2 ? 1 : 0,
          phases[index] === 3 ? 1 : 0,
          0,
          0.25,
          1,
          materialId,
          restVolumeM3
        ], index * 12);
        const offset = index * mechanicsStride;
        mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
        mechanics[offset + 18] = 1;
        mechanics[offset + 19] = restVolumeM3;
        mechanics[offset + 20] = 0;
        mechanics[offset + 21] = 1;
        mechanics[offset + 27] = materialId;
        mechanics[offset + 31] = 1;
      }

      const epochIdentity = {
        storageGeneration: 17,
        bufferFamilyGeneration: 17,
        physicsTick: 1,
        physicsSubstep: 0,
        positionEpoch: 1,
        topologyEpoch: 1,
        chartEpoch: 1,
        levelEpoch: 1,
        supportEpoch: 1
      };
      const sphParticleState = {
        schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'cpu-derived-gpu-buffer-ready',
        particleCount,
        dimension: 3,
        step: 1,
        time: 0,
        smoothingLengthM: 0.25,
        stateStrideFloats: 8,
        thermoStrideFloats: 12,
        identityStrideUints: 1,
        stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
        thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
        identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
        identitySchema: abi.ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
        identityRequired: true,
        identityRevision: 'native-slice9-production-same-level-pair',
        renderDomainKeys: {
          101: 'fine-liquid',
          102: 'fine-gas',
          201: 'coarse-dummy'
        },
        state,
        thermo,
        identity,
        metadata: [],
        ...epochIdentity
      };
      const mlsMpmParticleState = {
        schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        status: 'cpu-derived-gpu-buffer-ready',
        particleCount,
        step: 1,
        time: 0,
        mechanicsStrideFloats: mechanicsStride,
        mechanicsStrideBytes:
          mechanicsStride * Float32Array.BYTES_PER_ELEMENT,
        mechanicsDtS: 0.005,
        mechanicalSubsteps: 1,
        gridCflFactor: 0.4,
        gravityMPerS2: [0, 0, 0],
        particleSeparationRelaxation: 0,
        particleSeparationVelocityDamping: 0,
        mechanics,
        metadata: [],
        storageGeneration: epochIdentity.storageGeneration
      };
      const sphParticleUpload =
        buffersModule.uploadSphGpuParticleBuffers(device, sphParticleState);
      const mlsMpmParticleUpload =
        buffersModule.uploadMlsMpmGpuParticleBuffers(
          device,
          mlsMpmParticleState
        );
      for (const upload of [sphParticleUpload, mlsMpmParticleUpload]) {
        Object.assign(upload, {
          ...epochIdentity,
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1,
          step: 1,
          time: 0
        });
      }

      const assignmentRows = new Float32Array(particleCount * 16);
      const levels = [0, 0, 1];
      for (let index = 0; index < particleCount; index += 1) {
        const level = levels[index];
        const offset = index * 16;
        assignmentRows.set([
          level,
          0.25 * (2 ** level),
          1,
          restVolumeM3,
          restVolumeM3,
          restVolumeM3,
          1,
          densities[index],
          phases[index],
          materialId,
          1,
          0.15,
          state[index * 8],
          state[index * 8 + 1],
          state[index * 8 + 2],
          0
        ], offset);
      }
      const assignmentBuffer = device.createBuffer({
        label: 'native-slice9-production-assignment',
        size: assignmentRows.byteLength,
        usage: GPUBufferUsage.STORAGE
          | GPUBufferUsage.COPY_DST
          | GPUBufferUsage.COPY_SRC
      });
      device.queue.writeBuffer(assignmentBuffer, 0, assignmentRows);
      const levelAssignment = {
        schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
        status: 'schroeder-level-assignment-submitted',
        bufferFamilyGenerationStatus:
          'schroeder-particle-buffer-family-generation-ready',
        particleCount,
        assignmentStrideFloats: 16,
        assignments: assignmentRows,
        assignmentBuffer,
        assignmentBufferByteLength: assignmentRows.byteLength,
        sourceStateBuffer: sphParticleUpload.stateBuffer,
        sourceStateBufferBorrowed: true,
        sourceMechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer,
        sourceMechanicsBufferBorrowed: true,
        sourceMechanicsBufferByteLength:
          mlsMpmParticleUpload.mechanicsBufferByteLength,
        ...epochIdentity,
        minLevel: 0,
        maxLevel: 1,
        chartId: 0,
        baseGridSpacingM: 0.25
      };
      const fineGrid = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.25
      });
      const coarseGrid = gridModule.createMlsMpmGridSpec({
        boxDimsM: [2, 2, 2],
        gridSpacingM: 0.5
      });
      fineGrid.gridShift = fineGrid.shift;
      coarseGrid.gridShift = coarseGrid.shift;

      const generation =
        spatialModule.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment,
          particleCount,
          particleIdentityBuffer: sphParticleUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          particleBufferSet: sphParticleUpload,
          mechanicsLevels: [
            { selectedLevel: 0, mechanicsGrid: fineGrid },
            { selectedLevel: 1, mechanicsGrid: coarseGrid }
          ],
          phaseVolumeInterfaceProposalEnabled: true
        });
      if (
        generation.ready !== true
        || generation.selected !== true
        || !generation.parentFieldView
        || !generation.phaseVolumeInterfaceProposal
      ) {
        return {
          status: 'generation-rejected',
          generationStatus: generation.status,
          reason: generation.reason || 'missing two-level S9 artifacts'
        };
      }
      const transaction =
        transactionModule.createSchroederSpatialEpochTransaction({
          device,
          generation,
          sphParticleUpload,
          mlsMpmParticleUpload,
          twoLevelAuthoritative: true,
          phaseVolumeInterfaceProposalAuthoritative: true,
          enabledConsumerReaderIds: [],
          consumerSupportProfileIds: {}
        });
      const p2gAdmitted =
        transactionModule.admitSchroederSpatialEpochTransactionReader(
          transaction,
          {
            readerId:
              transactionModule
                .SCHROEDER_SPATIAL_EPOCH_READER.MECHANICS_P2G,
            phase:
              transactionModule
                .SCHROEDER_SPATIAL_EPOCH_READER_PHASE.PRE_INTEGRATION,
            generation,
            sphParticleUpload,
            mlsMpmParticleUpload
          }
        );
      if (p2gAdmitted !== true) {
        return {
          status: 'transaction-rejected',
          transaction:
            transactionModule.summarizeSchroederSpatialEpochTransaction(
              transaction
            )
        };
      }
      const mechanicsMaterialPhaseUpload =
        mechanicsRefreshModule.uploadMlsMpmMechanicsMaterialPhaseRecords(
          device,
          mechanicsMaterialTable
        );

      const readWords = async (buffer, byteLength, label) => {
        const readback = device.createBuffer({
          label,
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const bytes = readback.getMappedRange().slice(0);
        readback.unmap();
        readback.destroy();
        return {
          words: new Uint32Array(bytes),
          floats: new Float32Array(bytes)
        };
      };

      const proposal = generation.phaseVolumeInterfaceProposal;
      const fineLevelView = generation.mechanicsLevelViews[0];
      const coarseLevelView = generation.mechanicsLevelViews[1];
      const [
        proposalControl,
        localHeads,
        fineFieldHeader,
        coarseFieldHeader,
        fineMomentControl,
        coarseMomentControl,
        fineReceiptControl,
        coarseReceiptControl,
        parentFieldHeader
      ] = await Promise.all([
        readWords(
          proposal.controlBuffer,
          proposal.layout.controlByteLength,
          'native-slice9-production-proposal-control'
        ),
        readWords(
          proposal.localHeadBuffer,
          proposal.layout.localHeadByteLength,
          'native-slice9-production-local-heads'
        ),
        readWords(
          fineLevelView.mechanicsFieldView.fieldViewBuffer,
          64 * Uint32Array.BYTES_PER_ELEMENT,
          'native-slice9-production-fine-field-header'
        ),
        readWords(
          coarseLevelView.mechanicsFieldView.fieldViewBuffer,
          64 * Uint32Array.BYTES_PER_ELEMENT,
          'native-slice9-production-coarse-field-header'
        ),
        readWords(
          fineLevelView.phaseVolumeMoment.controlBuffer,
          fineLevelView.phaseVolumeMoment.layout.controlByteLength,
          'native-slice9-production-fine-moment-control'
        ),
        readWords(
          coarseLevelView.phaseVolumeMoment.controlBuffer,
          coarseLevelView.phaseVolumeMoment.layout.controlByteLength,
          'native-slice9-production-coarse-moment-control'
        ),
        readWords(
          fineLevelView.phaseVolumeReceipt.controlBuffer,
          fineLevelView.phaseVolumeReceipt.layout.controlByteLength,
          'native-slice9-production-fine-receipt-control'
        ),
        readWords(
          coarseLevelView.phaseVolumeReceipt.controlBuffer,
          coarseLevelView.phaseVolumeReceipt.layout.controlByteLength,
          'native-slice9-production-coarse-receipt-control'
        ),
        readWords(
          generation.parentFieldView.parentFieldViewBuffer,
          80 * Uint32Array.BYTES_PER_ELEMENT,
          'native-slice9-production-parent-field-header'
        )
      ]);
      const fineProjection =
        await gridModule.runMlsMpmP2gGridProjectionWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload,
          mlsMpmParticleUpload,
          schroederLevelAssignment: levelAssignment,
          schroederSelectedLevel: 0,
          schroederSpatialEpochGeneration: generation,
          canonicalSpatialRequired: true,
          mechanicsFieldMode: 'required',
          gridSpacingM: 0.25,
          boxDimsM: [2, 2, 2],
          dt: 0.005,
          // A vacuum fixture cannot exercise the pressure law: every field
          // resolves to p_abs = 0, so the antisymmetric pressure impulse is
          // identically zero. Publish a real one-atmosphere reference and a
          // live EOS gauge so gas and condensed rows carry different absolute
          // pressures. The grid update below must repeat the exact same
          // ambient bits: the transport authenticates them against the sealed
          // P2G pressure receipt.
          internalPressureScale: 1,
          ambientPressurePa: 101325,
          retainGridBuffer: false,
          readbackMode: 'no-full-readback'
        });
      const fineField = generation.parentFieldView.fineFieldView;
      const before = await readWords(
        fineField.fieldViewBuffer,
        fineField.layout.byteLength,
        'native-slice9-production-fine-before-update'
      );
      const update = await updateModule.runMlsMpmGridUpdateWebGpu({
        device,
        p2gGridProjection: fineProjection,
        mechanicsFieldMode: 'required',
        dt: 0.005,
        gravityMPerS2: [0, 0, 0],
        boxDimsM: [2, 2, 2],
        cflFactor: 0.4,
        wallBarrierElasticStiffnessNPerM: 0,
        wallBarrierContactScale: 0,
        mechanicsFieldEnergyReceipt: { deferSeal: false },
        schroederSpatialEpochTransaction: transaction,
        mechanicsMaterialTable,
        mechanicsMaterialPhaseUpload,
        ambientPressurePa: 101325,
        // This fixture isolates the transport operator: zero gravity so the
        // momentum and energy residuals below measure only pressure and drag.
        // Buoyancy is gravity-driven, so a nonzero air density would be inert
        // here. Nonzero ambient authority is proven by the cross-level M3 test,
        // which runs under real gravity and checks the ambient ledger bits.
        ambientReferenceDensityKgPerM3: 0,
        phaseVolumePressureScale: 0.01,
        phaseVolumeDragScale: 1,
        phaseVolumeMaxImpulseFraction: 0.01,
        phaseVolumeInterfaceTransportRequired: true,
        retainUpdatedGridBuffer: false,
        readbackMode: 'no-full-readback'
      });
      const after = await readWords(
        fineField.fieldViewBuffer,
        fineField.layout.byteLength,
        'native-slice9-production-fine-after-update'
      );

      const fieldCount = after.words[34];
      const fields = [];
      for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
        const key = fineField.layout.keyOffsetWords
          + fieldIndex * fineField.layout.keyWords;
        const stateRow = fineField.layout.stateOffsetWords
          + fieldIndex * fineField.layout.stateWords;
        const accumulator = fineField.layout.accumulatorOffsetWords
          + fieldIndex * fineField.layout.accumulatorWords;
        const mass = before.floats[stateRow];
        fields.push({
          node: before.words[key],
          phase: before.words[key + 1],
          material: before.words[key + 2],
          mass,
          beforeVelocity: [
            before.floats[stateRow + 1] / mass,
            before.floats[stateRow + 2] / mass,
            before.floats[stateRow + 3] / mass
          ],
          afterVelocity: [
            after.floats[stateRow + 1],
            after.floats[stateRow + 2],
            after.floats[stateRow + 3]
          ],
          heatJ: after.floats[accumulator],
          heatContributionCount: after.words[accumulator + 1],
          routeHeatJ: after.floats[accumulator + 2],
          pressureCompensationJ: after.floats[accumulator + 3],
          ambientImpulseNs: Array.from(
            after.floats.slice(accumulator + 4, accumulator + 7)
          ),
          ambientWorkJ: after.floats[accumulator + 7]
        });
      }
      const admittedLocalHeads = [];
      for (
        let fieldIndex = 0;
        fieldIndex < proposal.fineFieldCapacity;
        fieldIndex += 1
      ) {
        const row = proposal.layout.fineLocalHeadOffsetWords
          + fieldIndex * proposal.layout.localHeadWords
            / proposal.layout.localHeadCapacity;
        if (localHeads.words[row + 5] === 3) {
          admittedLocalHeads.push(
            Array.from(localHeads.words.slice(row, row + 8))
          );
        }
      }
      const receipt = fineField.layout.receiptControlOffsetWords;
      const validationError = await device.popErrorScope();
      await device.queue.onSubmittedWorkDone();
      const result = {
        status: 'executed',
        updateStatus: update.status,
        p2gBackend: fineProjection.backend,
        p2gDenseGridBufferAllocatedBytes:
          fineProjection.denseGridBufferAllocatedBytes,
        proposalStatus: proposalControl.words[2],
        proposalFineFieldCount: proposalControl.words[16],
        proposalFineFieldCapacity: proposalControl.words[17],
        proposalFineLocalHeadCount: proposalControl.words[20],
        proposalControl: Array.from(proposalControl.words),
        fineFieldHeader: Array.from(fineFieldHeader.words),
        coarseFieldHeader: Array.from(coarseFieldHeader.words),
        fineMomentControl: Array.from(fineMomentControl.words),
        coarseMomentControl: Array.from(coarseMomentControl.words),
        fineReceiptControl: Array.from(fineReceiptControl.words),
        coarseReceiptControl: Array.from(coarseReceiptControl.words),
        parentFieldHeader: Array.from(parentFieldHeader.words),
        admittedLocalHeads,
        fieldStatus: after.words[2],
        fieldEncoding: after.words[59],
        fieldMutationOrdinal: after.words[63],
        fieldCount,
        receiptStatus: after.words[receipt + 2],
        receiptPhase: after.words[receipt + 3],
        // Full 36-word receipt (heat/work 0-23 plus the v4 pressure tail
        // 24-35) so a fail-closed transition is diagnosable without a rerun.
        receiptWords: Array.from(after.words.slice(receipt, receipt + 36)),
        receiptHeatContributionCount: after.words[receipt + 7],
        receiptPublishedHeatJ: after.floats[receipt + 9],
        receiptPressureCompensationJ: after.floats[receipt + 17],
        fields: proposalControl.words[2] === 3 ? fields : [],
        validationError: validationError?.message || null,
        uncapturedErrors
      };

      transactionModule.abortSchroederSpatialEpochTransaction(
        transaction,
        new Error('native Slice 9 production fixture complete')
      );
      mechanicsRefreshModule.destroyMlsMpmMechanicsMaterialPhaseUpload(
        mechanicsMaterialPhaseUpload
      );
      spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
        generation,
        device
      );
      await generation.releasePromise;
      assignmentBuffer.destroy();
      buffersModule.destroySphGpuParticleBuffers(sphParticleUpload);
      buffersModule.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
      device.destroy();
      return result;
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'executed', JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));
  assert.equal(native.p2gBackend, 'webgpu');
  assert.equal(native.p2gDenseGridBufferAllocatedBytes, 0);
  assert.equal(native.updateStatus, 'submitted-unverified');
  assert.equal(native.proposalStatus, 3, JSON.stringify(native));
  assert.equal(native.proposalFineFieldCount, 54, JSON.stringify(native));
  assert.equal(native.proposalFineLocalHeadCount, 27, JSON.stringify(native));
  assert.equal(native.admittedLocalHeads.length, 27, JSON.stringify(native));
  for (const head of native.admittedLocalHeads) {
    assert.equal(head[2] - head[0], 2, JSON.stringify(native));
    assert.equal(head[3], 0);
    assert.equal(head[4], 1);
    assert.equal(head[5], 3);
  }
  assert.equal(native.fieldStatus, 3, JSON.stringify(native));
  assert.equal(native.fieldEncoding, 2, JSON.stringify(native));
  assert.equal(native.fieldMutationOrdinal, 2, JSON.stringify(native));
  assert.equal(native.fieldCount, 54, JSON.stringify(native));
  assert.equal(native.receiptStatus, 3, JSON.stringify(native));
  assert.equal(native.receiptPhase, 4, JSON.stringify(native));

  // Momentum and energy residuals below are reconstructed by differencing the
  // published f32 velocity state, so they inherit the representation error of
  // that state, not only of the applied change. An impulse smaller than one
  // ulp of the velocity it acts on is unrepresentable, so a change-conditioned
  // tolerance alone is unreachable even for an exactly antisymmetric operator.
  // This is the same gamma_n state floor the transport shader admits.
  const F32_EPS = 2 ** -24;
  const stateFloorFor = (stateAbs, operationCount) => {
    const nEpsilon = Math.min(0.25, operationCount * F32_EPS);
    return (nEpsilon / (1 - nEpsilon)) * Math.max(stateAbs, 1.175494351e-38);
  };
  const close = (
    actual,
    expected,
    scale = 1,
    toleranceScale = 4096,
    stateFloor = 0
  ) => {
    const tolerance = Math.max(
      8 * 1.175494351e-38,
      toleranceScale * F32_EPS
        * Math.max(scale, Math.abs(actual), Math.abs(expected))
    ) + stateFloor;
    assert.ok(
      Number.isFinite(actual)
        && Number.isFinite(expected)
        && Math.abs(actual - expected) <= tolerance,
      `expected ${actual} to be close to ${expected} ±${tolerance}; `
        + JSON.stringify(native)
    );
  };
  let momentumResidual = [0, 0, 0];
  let kineticDeltaJ = 0;
  let pressureCompensationJ = 0;
  let pressureL1J = 0;
  let heatJ = 0;
  let ambientImpulseL1 = 0;
  let ambientWorkL1 = 0;
  const momentumStateL1 = [0, 0, 0];
  let kineticStateJ = 0;
  const phaseVelocityChange = new Map([[2, 0], [3, 0]]);
  for (const field of native.fields) {
    assert.ok(field.mass > 0 && Number.isFinite(field.mass));
    for (let axis = 0; axis < 3; axis += 1) {
      const delta = field.afterVelocity[axis] - field.beforeVelocity[axis];
      momentumResidual[axis] += field.mass * delta;
      momentumStateL1[axis] += field.mass * (
        Math.abs(field.beforeVelocity[axis])
          + Math.abs(field.afterVelocity[axis])
      );
      phaseVelocityChange.set(
        field.phase,
        (phaseVelocityChange.get(field.phase) || 0) + Math.abs(delta)
      );
    }
    const beforeSpeed2 = field.beforeVelocity.reduce(
      (sum, value) => sum + value * value,
      0
    );
    const afterSpeed2 = field.afterVelocity.reduce(
      (sum, value) => sum + value * value,
      0
    );
    kineticDeltaJ += 0.5 * field.mass * (afterSpeed2 - beforeSpeed2);
    kineticStateJ += 0.5 * field.mass * (afterSpeed2 + beforeSpeed2);
    pressureCompensationJ += field.pressureCompensationJ;
    pressureL1J += Math.abs(field.pressureCompensationJ);
    heatJ += field.heatJ;
    ambientImpulseL1 += field.ambientImpulseNs.reduce(
      (sum, value) => sum + Math.abs(value),
      0
    );
    ambientWorkL1 += Math.abs(field.ambientWorkJ);
    close(field.routeHeatJ, 0);
  }
  assert.ok(pressureL1J > 0, JSON.stringify(native));
  assert.ok(heatJ > 0, JSON.stringify(native));
  assert.ok(phaseVelocityChange.get(2) > 0, JSON.stringify(native));
  assert.ok(phaseVelocityChange.get(3) > 0, JSON.stringify(native));
  momentumResidual.forEach((residual, axis) => {
    close(
      residual,
      0,
      pressureL1J + heatJ,
      4096,
      stateFloorFor(momentumStateL1[axis], 4)
    );
  });
  close(
    kineticDeltaJ + pressureCompensationJ + heatJ,
    0,
    Math.abs(kineticDeltaJ) + pressureL1J + heatJ,
    8192,
    stateFloorFor(kineticStateJ, 6)
  );
  close(ambientImpulseL1, 0);
  close(ambientWorkL1, 0);
  close(native.receiptPublishedHeatJ, heatJ, Math.abs(heatJ));
  close(
    native.receiptPressureCompensationJ,
    pressureCompensationJ,
    pressureL1J
  );
  assert.ok(native.receiptHeatContributionCount > 0, JSON.stringify(native));
});
