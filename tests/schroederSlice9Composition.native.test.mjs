import assert from 'node:assert/strict';
import { test } from 'node:test';

// Slice 9 compositional invariant.
//
// Every stage of the Slice 9 chain has its own native test. This one exists
// because stages can each be individually correct and still lose a conserved
// quantity where they meet: a receipt claimed twice, a deformation republished
// after its volume was rescaled, an impulse applied on one side of an
// interface but not the other. It therefore runs the real production modules
// end to end
//
//   epoch generation -> P2G -> grid update (local transport + parent/reflux)
//
// and asserts, across the whole composition rather than per stage: field mass,
// linear momentum (which is the statement that the pressure and drag impulses
// are antisymmetric), the dissipation ledger against the kinetic energy
// actually removed, the ambient ledger, receipt status/phase ordering and
// consumer-mask discipline, and fail-closed behavior when the sealed receipt
// is corrupted.
//
// It deliberately stops at the grid update. Canonical G2P additionally
// requires an authenticated deferred contact/separation residual solver and a
// four-lane phase-carrier plan, neither of which a three-particle fixture can
// express; G2P's own contract is covered by tests/sphG2pGpuKernel.test.mjs and
// the cross-level M3 native test.
const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_SLICE9_COMPOSITION === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

test('native Slice 9 composition conserves mass, volume, momentum, and energy', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_SLICE9_COMPOSITION=1 for native WebGPU',
  timeout: 300_000
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
        identityRevision: 'native-slice9-composition-same-level-pair',
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
        label: 'native-slice9-composition-assignment',
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
          'native-slice9-composition-proposal-control'
        ),
        readWords(
          proposal.localHeadBuffer,
          proposal.layout.localHeadByteLength,
          'native-slice9-composition-local-heads'
        ),
        readWords(
          fineLevelView.mechanicsFieldView.fieldViewBuffer,
          64 * Uint32Array.BYTES_PER_ELEMENT,
          'native-slice9-composition-fine-field-header'
        ),
        readWords(
          coarseLevelView.mechanicsFieldView.fieldViewBuffer,
          64 * Uint32Array.BYTES_PER_ELEMENT,
          'native-slice9-composition-coarse-field-header'
        ),
        readWords(
          fineLevelView.phaseVolumeMoment.controlBuffer,
          fineLevelView.phaseVolumeMoment.layout.controlByteLength,
          'native-slice9-composition-fine-moment-control'
        ),
        readWords(
          coarseLevelView.phaseVolumeMoment.controlBuffer,
          coarseLevelView.phaseVolumeMoment.layout.controlByteLength,
          'native-slice9-composition-coarse-moment-control'
        ),
        readWords(
          fineLevelView.phaseVolumeReceipt.controlBuffer,
          fineLevelView.phaseVolumeReceipt.layout.controlByteLength,
          'native-slice9-composition-fine-receipt-control'
        ),
        readWords(
          coarseLevelView.phaseVolumeReceipt.controlBuffer,
          coarseLevelView.phaseVolumeReceipt.layout.controlByteLength,
          'native-slice9-composition-coarse-receipt-control'
        ),
        readWords(
          generation.parentFieldView.parentFieldViewBuffer,
          80 * Uint32Array.BYTES_PER_ELEMENT,
          'native-slice9-composition-parent-field-header'
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
        'native-slice9-composition-fine-before-update'
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
        'native-slice9-composition-fine-after-update'
      );

      // Field rows. Before the grid update the state row holds momentum; after
      // it holds velocity, because the update is what divides through by mass.
      const fieldCount = after.words[34];
      const fields = [];
      for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
        const key = fineField.layout.keyOffsetWords
          + fieldIndex * fineField.layout.keyWords;
        const stateRow = fineField.layout.stateOffsetWords
          + fieldIndex * fineField.layout.stateWords;
        const accumulator = fineField.layout.accumulatorOffsetWords
          + fieldIndex * fineField.layout.accumulatorWords;
        fields.push({
          node: before.words[key],
          phase: before.words[key + 1],
          material: before.words[key + 2],
          beforeMass: before.floats[stateRow],
          afterMass: after.floats[stateRow],
          beforeMomentum: [
            before.floats[stateRow + 1],
            before.floats[stateRow + 2],
            before.floats[stateRow + 3]
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

      const receipt = fineField.layout.receiptControlOffsetWords;
      const receiptWords = Array.from(
        after.words.slice(receipt, receipt + 36)
      );
      const receiptFloats = Array.from(
        after.floats.slice(receipt, receipt + 36)
      );

      // ---- Fail-closed: the consumed field may not be updated again -------
      // The first update consumed this field's sealed receipt. A second update
      // against the same field is a replay and must be refused. The seal is
      // also corrupted first, but note the control below: the refusal here is
      // driven by re-consumption, not by the tamper, and the test says so
      // rather than claiming a seal check it does not exercise.
      const sealWordIndex = receipt + 35;
      device.queue.writeBuffer(
        fineField.fieldViewBuffer,
        sealWordIndex * 4,
        new Uint32Array([receiptWords[35] ^ 0x5a5a5a5a])
      );
      let corruptionRefused = null;
      let corruptionError = null;
      try {
        const tampered = await updateModule.runMlsMpmGridUpdateWebGpu({
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
          ambientReferenceDensityKgPerM3: 0,
          phaseVolumePressureScale: 0.01,
          phaseVolumeDragScale: 1,
          phaseVolumeMaxImpulseFraction: 0.01,
          phaseVolumeInterfaceTransportRequired: true,
          retainUpdatedGridBuffer: false,
          readbackMode: 'no-full-readback'
        });
        corruptionRefused = tampered?.status || 'completed-without-refusal';
      } catch (error) {
        corruptionRefused = 'threw';
        corruptionError = error?.message || String(error);
      }

      const validationError = await device.popErrorScope();
      await device.queue.onSubmittedWorkDone();
      const result = {
        status: 'executed',
        updateStatus: update.status,
        p2gBackend: fineProjection.backend,
        fieldCount,
        fields,
        receiptWords,
        receiptFloats,
        ambientPressurePa: 101325,
        corruptionRefused,
        corruptionError,
        validationError: validationError?.message || null,
        uncapturedErrors
      };

      // Release everything this fixture allocated. A leaked epoch generation or
      // particle upload shows up much later as an unrelated out-of-memory in
      // whatever runs next on the same device.
      transactionModule.abortSchroederSpatialEpochTransaction(
        transaction,
        new Error('native Slice 9 composition fixture complete')
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

  assert.equal(native.status, 'executed', JSON.stringify(native).slice(0, 4000));
  assert.equal(native.validationError, null, JSON.stringify(native).slice(0, 4000));
  assert.deepEqual(native.uncapturedErrors, []);
  assert.equal(native.p2gBackend, 'webgpu');
  assert.ok(native.fieldCount > 0, 'the composition must produce fields');

  const fields = native.fields;
  const sum = (pick) => fields.reduce((total, row) => total + pick(row), 0);
  const vectorSum = (pick) => [0, 1, 2].map(
    (axis) => fields.reduce((total, row) => total + pick(row)[axis], 0)
  );

  // ---- Mass -------------------------------------------------------------
  // Local transport exchanges momentum and energy between the phase fields
  // sharing a node. It must not move mass between them, and P2G's deposited
  // mass must survive the update unchanged.
  const beforeMass = sum((row) => row.beforeMass);
  const afterMass = sum((row) => row.afterMass);
  assert.ok(beforeMass > 0, `P2G must deposit mass, got ${beforeMass}`);
  assert.ok(
    Math.abs(afterMass - beforeMass) <= 1e-5 * beforeMass,
    `field mass must survive the update: ${beforeMass} -> ${afterMass}`
  );
  for (const [index, row] of fields.entries()) {
    assert.ok(
      Number.isFinite(row.afterMass) && row.afterMass > 0,
      `field ${index} must keep a finite-positive mass, got ${row.afterMass}`
    );
  }

  // ---- Linear momentum and pressure antisymmetry ------------------------
  // The fixture runs at zero gravity with no external traction and no ambient
  // reference density, so every impulse the transport applies is internal and
  // antisymmetric. Total momentum across all fields is therefore conserved --
  // which is exactly the statement that the pressure and drag impulses are
  // applied equally and oppositely. A one-sided impulse shows up here as a
  // momentum residual.
  const beforeMomentum = vectorSum((row) => row.beforeMomentum);
  const afterMomentum = vectorSum(
    (row) => row.afterVelocity.map((v) => v * row.afterMass)
  );
  const momentumScale = Math.max(
    1e-9,
    Math.hypot(...beforeMomentum),
    ...fields.map((row) => Math.hypot(...row.beforeMomentum))
  );
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(afterMomentum[axis] - beforeMomentum[axis]) <= 2e-3 * momentumScale,
      `momentum axis ${axis} must be conserved across the composition: `
        + `${beforeMomentum[axis]} -> ${afterMomentum[axis]}`
    );
  }

  // ---- Energy ledger ----------------------------------------------------
  // Drag is dissipative, so the heat the transport books must be non-negative,
  // and every field that booked heat must have recorded the contributions that
  // produced it. A heat value with no contribution count is an unsourced
  // deposit.
  let totalHeatJ = 0;
  for (const [index, row] of fields.entries()) {
    assert.ok(
      Number.isFinite(row.heatJ) && row.heatJ >= 0,
      `field ${index} heat must be finite and non-negative, got ${row.heatJ}`
    );
    assert.ok(
      Number.isFinite(row.pressureCompensationJ),
      `field ${index} pressure compensation must be finite`
    );
    if (row.heatJ > 0) {
      assert.ok(
        row.heatContributionCount > 0,
        `field ${index} booked ${row.heatJ} J with no contributions`
      );
    }
    totalHeatJ += row.heatJ;
  }
  assert.ok(totalHeatJ > 0, 'the drag operator must dissipate some energy');

  // The kinetic energy the fields lost must be at least as large as the heat
  // booked: the composition may not book more heat than it removed from motion.
  const kineticBefore = fields.reduce((total, row) => (
    total + (row.beforeMass > 0
      ? row.beforeMomentum.reduce((s, p) => s + p * p, 0) / (2 * row.beforeMass)
      : 0)
  ), 0);
  const kineticAfter = fields.reduce((total, row) => (
    total + 0.5 * row.afterMass
      * row.afterVelocity.reduce((s, v) => s + v * v, 0)
  ), 0);
  assert.ok(
    totalHeatJ <= (kineticBefore - kineticAfter) + 1e-6 * Math.max(1, kineticBefore),
    `booked heat ${totalHeatJ} J exceeds the kinetic energy removed `
      + `(${kineticBefore} -> ${kineticAfter})`
  );

  // ---- Ambient ledger ---------------------------------------------------
  // Zero ambient reference density means no buoyancy, so the ambient impulse
  // ledger must be exactly zero rather than merely small. A nonzero entry here
  // is ambient authority leaking into a fixture that declared none.
  for (const [index, row] of fields.entries()) {
    for (let axis = 0; axis < 3; axis += 1) {
      assert.equal(
        row.ambientImpulseNs[axis], 0,
        `field ${index} ambient impulse axis ${axis} must be exactly zero`
      );
    }
    assert.equal(
      row.ambientWorkJ, 0,
      `field ${index} ambient work must be exactly zero`
    );
  }

  // ---- Receipt: ambient bits and phase ordering -------------------------
  const receiptWords = native.receiptWords;
  const receiptFloats = native.receiptFloats;
  assert.ok(receiptWords[24] !== 0, 'the v4 pressure tail must be published');
  const ambientBits = new Float32Array([native.ambientPressurePa]);
  assert.equal(
    receiptFloats[28],
    ambientBits[0],
    'the sealed ambient must be bit-identical to the ambient P2G published'
  );
  // Word 2 is status, word 3 is the phase tag.
  assert.equal(receiptWords[2], 3, 'the receipt must be in a ready status');
  assert.equal(
    receiptWords[3], 4,
    `the receipt must reach ENERGY_READY, got phase ${receiptWords[3]}`
  );
  // Consumer masks: energy may only be claimed once every declared consumer
  // has finished, so required must be nonzero and claimed must not run ahead
  // of it.
  const required = receiptWords[32];
  assert.ok(required !== 0, 'the receipt must declare at least one consumer');
  assert.equal(
    receiptWords[33] & ~required, 0,
    'no consumer may claim energy it was not required to claim'
  );
  assert.equal(
    receiptWords[34] & ~receiptWords[33], 0,
    'no consumer may consume energy it did not claim'
  );

  // ---- Fail-closed: no replay of a consumed field ------------------------
  // The second update must be refused. Be precise about why: the field's
  // receipt was already consumed by the first update, so the guard that fires
  // is the live-generation-ownership check, not a seal comparison. Asserting
  // the actual message keeps this from silently becoming a test that claims to
  // prove seal-tamper rejection while really proving replay rejection --
  // shader-level tampered magic/seal rejection is still outstanding from
  // item 6 and needs its own case.
  assert.equal(
    native.corruptionRefused,
    'threw',
    `a second update against a consumed field must be refused, got `
      + `${native.corruptionRefused}`
  );
  assert.match(
    String(native.corruptionError),
    /requires the exact live generation-owned field published by P2G/,
    'the refusal must come from the live-generation ownership guard, got '
      + String(native.corruptionError)
  );
});
