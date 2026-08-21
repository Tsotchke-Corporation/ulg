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
// and then carries the terminal E* successor through one more production tick:
//
//   terminal classifier -> sealed successor family -> directory v2
//     -> ActiveSource/mechanics field -> P2G -> grid update -> G2P
//
// It asserts, across the whole composition rather than per stage: field mass,
// linear momentum (which is the statement that the pressure and drag impulses
// are antisymmetric), the dissipation ledger against the kinetic energy
// actually removed, the ambient ledger, receipt status/phase ordering and
// consumer-mask discipline, and fail-closed behavior when the sealed receipt
// is corrupted.
//
// The second tick is deliberately small and non-reacting. Reaction resolve and
// product placement have their own native physics fixtures; this composition
// gate proves that whatever final post-closure family they publish cannot lose
// its exact classifier or be rebuilt from stale CPU state before mechanics.
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
        mechanicsRefreshModule,
        hierarchyModule,
        crossLevelModule,
        sceneModule
      ] = await Promise.all([
        import('/ulg-gpu-abi/src/index.js'),
        import(buffersUrl),
        import(spatialUrl),
        import(transactionUrl),
        import(gridUrl),
        import('/src/runtime/sph/sphGridUpdateGpuKernel.js'),
        import('/src/runtime/sph/sphMechanicsMaterialTable.js'),
        import(mechanicsRefreshUrl),
        import('/src/runtime/sph/schroederHierarchyGpu.js'),
        import('/src/runtime/sph/schroederCrossLevelCouplingGpu.js'),
        import('/src/visualization/sphPhaseScene.js')
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
        mechanics[offset + 27] = 1;
        mechanics[offset + 31] = state[index * 8 + 3];
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
          // Directory v2 always publishes the aggregate view for a canonical
          // two-level epoch. FAR is its terminal owner even though this local
          // transport sub-fixture aborts before that post-closure reader.
          enabledConsumerReaderIds: [
            transactionModule
              .SCHROEDER_SPATIAL_EPOCH_READER.FAR_AGGREGATE
          ],
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
      spatialModule.releaseSchroederSpatialEpochGenerationAfterQueue(
        generation,
        device
      );
      await generation.releasePromise;

      // ---- Exact terminal successor -> next-tick mechanics -----------------
      //
      // Use a separate, physically two-level copy of the fixture so this proof
      // does not inherit the intentionally hand-authored assignment above. The
      // first production step publishes a classifier over its terminal E*
      // buffers. The second must consume that exact private assignment object
      // and buffer through directory v2, P2G, and G2P.
      device.pushErrorScope('validation');
      const chainStateValues = state.slice();
      const chainThermoValues = thermo.slice();
      const chainMechanicsValues = mechanics.slice();
      const coarseIndex = 2;
      const coarseRestVolumeM3 = restVolumeM3 * 8;
      chainStateValues[coarseIndex * 8 + 3] =
        densities[coarseIndex] * coarseRestVolumeM3;
      chainMechanicsValues[
        coarseIndex * mechanicsStride + 19
      ] = coarseRestVolumeM3;

      const chainEpochIdentity = {
        storageGeneration: 31,
        bufferFamilyGeneration: 31,
        physicsTick: 10,
        physicsSubstep: 0,
        positionEpoch: 10,
        topologyEpoch: 10,
        chartEpoch: 10,
        levelEpoch: 10,
        supportEpoch: 10
      };
      const chainSphParticleState = {
        ...sphParticleState,
        ...chainEpochIdentity,
        step: 10,
        time: 0,
        state: chainStateValues,
        thermo: chainThermoValues,
        identity: identity.slice(),
        identityRevision:
          'native-slice9-terminal-successor-next-tick-chain'
      };
      const chainMlsMpmParticleState = {
        ...mlsMpmParticleState,
        storageGeneration: chainEpochIdentity.storageGeneration,
        step: 10,
        time: 0,
        mechanics: chainMechanicsValues
      };
      const chainSphParticleUpload =
        buffersModule.uploadSphGpuParticleBuffers(
          device,
          chainSphParticleState
        );
      const chainMlsMpmParticleUpload =
        buffersModule.uploadMlsMpmGpuParticleBuffers(
          device,
          chainMlsMpmParticleState
        );
      for (const upload of [
        chainSphParticleUpload,
        chainMlsMpmParticleUpload
      ]) {
        Object.assign(upload, {
          ...chainEpochIdentity,
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          slot: 0,
          sourceSlot: 0,
          nextSlot: 1,
          step: 10,
          time: 0
        });
      }

      let terminalClassifierCallCount = 0;
      let terminalClassifierInput = null;
      let terminalClassifierOutput = null;
      const observedTerminalClassifier = async (options) => {
        terminalClassifierCallCount += 1;
        terminalClassifierInput = options;
        terminalClassifierOutput =
          await hierarchyModule.runSchroederLevelAssignmentWebGpu(options);
        return terminalClassifierOutput;
      };
      let residentCallCount = 0;
      const residentStepRunner = async () => {
        residentCallCount += 1;
        return { status: 'resident-step-stubbed' };
      };
      const commonChainOptions = {
        device,
        selectedLevel: 0,
        minLevel: 0,
        maxLevel: 1,
        baseGridSpacingM: 0.25,
        targetSupportCells: 4,
        supportRadiusScale: 15,
        boxDimsM: [2, 2, 2],
        dt: 0.005,
        gravityMPerS2: [0, 0, 0],
        readbackMode: 'no-full-readback',
        enablePressureInterfaceOwnerScope: false,
        enableTwoLevelMechanics: true,
        twoLevelMechanicsAuthority: 'authoritative',
        twoLevelFineSubstepCount: 2,
        twoLevelConservationSummaryReadback: false,
        spatialEpochArenaCount: 4,
        residentStepRunner,
        residentStepOptions: {
          mechanicsMaterialTable,
          mechanicsRefreshOptions: {
            mechanicsMaterialPhaseUpload
          }
        }
      };
      const firstChainStep =
        await hierarchyModule.runSchroederSameLevelMechanicsWebGpu({
          ...commonChainOptions,
          sphParticleState: chainSphParticleState,
          mlsMpmParticleState: chainMlsMpmParticleState,
          sphParticleUpload: chainSphParticleUpload,
          mlsMpmParticleUpload: chainMlsMpmParticleUpload,
          successorLevelAssignmentRunner: observedTerminalClassifier
        });
      const firstResidentStep = firstChainStep.residentStep;
      const firstNextUploads = firstResidentStep.nextParticleUploads;
      const firstSuccessorSourceFamily =
        firstChainStep.schroederSpatialSuccessorSourceFamily
        ?? firstResidentStep.schroederSpatialSuccessorSourceFamily
        ?? firstNextUploads.schroederSpatialSuccessorSourceFamily
        ?? null;
      const firstSuccessorConsumption =
        sceneModule.beginSchroederSpatialSuccessorSourceFamilyConsumption({
          sourceFamily: firstSuccessorSourceFamily,
          device,
          particleCount,
          stateBuffer: firstNextUploads.sphParticleUpload.stateBuffer,
          thermoBuffer: firstNextUploads.sphParticleUpload.thermoBuffer,
          identityBuffer: firstNextUploads.sphParticleUpload.identityBuffer,
          mechanicsBuffer:
            firstNextUploads.mlsMpmParticleUpload.mechanicsBuffer,
          consumerStage:
            'native-slice9-next-tick-production-mechanics',
          retirementReason:
            'native Slice 9 first terminal successor consumed',
          ownerFence: Promise.resolve()
        });
      const exactSuccessorLevelAssignment =
        firstSuccessorConsumption.levelAssignment;

      const secondGenerationRecords = [];
      const observedSpatialEpochGeneration = async (options) => {
        const generated =
          await spatialModule
            .runSchroederSpatialEpochGenerationWithBackpressureWebGpu(options);
        secondGenerationRecords.push({ options, generated });
        return generated;
      };
      let p2gCallCount = 0;
      let gridUpdateCallCount = 0;
      let g2pCallCount = 0;
      let p2gConsumedExactAssignment = false;
      let p2gConsumedExactStateBuffer = false;
      let g2pConsumedExactAssignment = false;
      const mechanicsStageReadbacks = [];
      const queueMechanicsStageReadback = ({
        stage,
        selectedLevel,
        generation,
        fieldExecution,
        fieldBuffer,
        workspaceExecution = null
      }) => {
        // The first fine transaction is the overlapping-recipient regression.
        // G2P motion below proves the rest of the chain; avoid retaining a full
        // GPU-buffer dump for every otherwise-successful production stage.
        if (stage !== 'pre-g2p-1') {
          return;
        }
        const activeSourceView = generation?.activeSourceView
          ?? generation?.execution?.activeSourceView
          ?? fieldExecution?.activeSourceView
          ?? null;
        const activeSourceBuffer =
          activeSourceView?.activeSourceViewBuffer ?? null;
        const fieldByteLength = Number(
          fieldExecution?.layout?.byteLength ?? fieldBuffer?.size ?? 0
        );
        const activeSourceByteLength = Number(
          activeSourceView?.layout?.byteLength
            ?? activeSourceBuffer?.size
            ?? 0
        );
        const workspaceBuffer = workspaceExecution?.workspaceBuffer ?? null;
        const workspaceByteLength = Number(
          workspaceExecution?.layout?.byteLength
            ?? workspaceBuffer?.size
            ?? 0
        );
        const refluxBuffer =
          workspaceExecution?.refluxLedgerBuffer
          ?? workspaceExecution?.refluxLedger?.buffer
          ?? null;
        const refluxByteLength = Number(
          workspaceExecution?.refluxLedger?.byteLength
            ?? refluxBuffer?.size
            ?? 0
        );
        if (
          !fieldBuffer
          || !Number.isSafeInteger(fieldByteLength)
          || fieldByteLength <= 0
          || fieldByteLength % Uint32Array.BYTES_PER_ELEMENT !== 0
          || (activeSourceBuffer && (
            !Number.isSafeInteger(activeSourceByteLength)
            || activeSourceByteLength <= 0
            || activeSourceByteLength % Uint32Array.BYTES_PER_ELEMENT !== 0
          ))
          || (workspaceBuffer && (
            !Number.isSafeInteger(workspaceByteLength)
            || workspaceByteLength <= 0
            || workspaceByteLength % Uint32Array.BYTES_PER_ELEMENT !== 0
          ))
          || (refluxBuffer && (
            !Number.isSafeInteger(refluxByteLength)
            || refluxByteLength <= 0
            || refluxByteLength % Uint32Array.BYTES_PER_ELEMENT !== 0
          ))
        ) {
          mechanicsStageReadbacks.push({
            stage,
            selectedLevel,
            unavailable: true,
            reason: 'missing or malformed mechanics-field/ActiveSource buffer'
          });
          return;
        }
        const readback = device.createBuffer({
          label: `native-slice9-${stage}-mechanics-field-readback`,
          size: fieldByteLength
            + activeSourceByteLength
            + workspaceByteLength
            + refluxByteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder({
          label: `native-slice9-${stage}-mechanics-field-readback-encoder`
        });
        encoder.copyBufferToBuffer(
          fieldBuffer,
          0,
          readback,
          0,
          fieldByteLength
        );
        if (activeSourceBuffer) {
          encoder.copyBufferToBuffer(
            activeSourceBuffer,
            0,
            readback,
            fieldByteLength,
            activeSourceByteLength
          );
        }
        if (workspaceBuffer) {
          encoder.copyBufferToBuffer(
            workspaceBuffer,
            0,
            readback,
            fieldByteLength + activeSourceByteLength,
            workspaceByteLength
          );
        }
        if (refluxBuffer) {
          encoder.copyBufferToBuffer(
            refluxBuffer,
            0,
            readback,
            fieldByteLength + activeSourceByteLength + workspaceByteLength,
            refluxByteLength
          );
        }
        device.queue.submit([encoder.finish()]);
        mechanicsStageReadbacks.push({
          stage,
          selectedLevel,
          readback,
          fieldWordLength:
            fieldByteLength / Uint32Array.BYTES_PER_ELEMENT,
          activeSourceWordLength:
            activeSourceByteLength / Uint32Array.BYTES_PER_ELEMENT,
          workspaceWordLength:
            workspaceByteLength / Uint32Array.BYTES_PER_ELEMENT,
          refluxWordLength:
            refluxByteLength / Uint32Array.BYTES_PER_ELEMENT
        });
      };
      const observedTwoLevelMechanicsRunner = async (options) => {
        const productionP2gRunner = options.p2gRunner;
        const productionGridUpdateRunner = options.gridUpdateRunner;
        const productionG2pRunner = options.g2pRunner;
        return crossLevelModule.runSchroederTwoLevelMechanicsStepWebGpu({
          ...options,
          p2gRunner: async (p2gOptions) => {
            p2gCallCount += 1;
            p2gConsumedExactAssignment ||= (
              p2gOptions.schroederLevelAssignment
                === exactSuccessorLevelAssignment
            );
            p2gConsumedExactStateBuffer ||= (
              p2gOptions.sphParticleUpload?.stateBuffer
                === firstNextUploads.sphParticleUpload.stateBuffer
            );
            const projection = await productionP2gRunner(p2gOptions);
            queueMechanicsStageReadback({
              stage: `p2g-${p2gCallCount}`,
              selectedLevel: p2gOptions.schroederSelectedLevel,
              generation: p2gOptions.schroederSpatialEpochGeneration,
              fieldExecution: projection.mechanicsFieldViewExecution,
              fieldBuffer: projection.mechanicsFieldViewBuffer
            });
            return projection;
          },
          gridUpdateRunner: async (gridUpdateOptions) => {
            gridUpdateCallCount += 1;
            const gridUpdate =
              await productionGridUpdateRunner(gridUpdateOptions);
            queueMechanicsStageReadback({
              stage: `grid-update-${gridUpdateCallCount}`,
              selectedLevel:
                gridUpdateOptions.p2gGridProjection?.schroederSelectedLevel,
              generation:
                gridUpdateOptions.p2gGridProjection
                  ?.schroederSpatialEpochGeneration,
              fieldExecution: gridUpdate.mechanicsFieldViewExecution,
              fieldBuffer: gridUpdate.mechanicsFieldViewBuffer
            });
            return gridUpdate;
          },
          g2pRunner: async (g2pOptions) => {
            g2pCallCount += 1;
            g2pConsumedExactAssignment ||= (
              g2pOptions.schroederLevelAssignment
                === exactSuccessorLevelAssignment
            );
            queueMechanicsStageReadback({
              stage: `pre-g2p-${g2pCallCount}`,
              selectedLevel: g2pOptions.schroederSelectedLevel,
              generation: g2pOptions.schroederSpatialEpochGeneration,
              fieldExecution:
                g2pOptions.gridUpdate?.mechanicsFieldViewExecution,
              fieldBuffer: g2pOptions.gridUpdate?.mechanicsFieldViewBuffer,
              workspaceExecution:
                g2pOptions.gridUpdate
                  ?.parentFieldMechanicsWorkspaceExecution
            });
            const reconstruction = await productionG2pRunner(g2pOptions);
            queueMechanicsStageReadback({
              stage: `g2p-${g2pCallCount}`,
              selectedLevel: g2pOptions.schroederSelectedLevel,
              generation: g2pOptions.schroederSpatialEpochGeneration,
              fieldExecution:
                g2pOptions.gridUpdate?.mechanicsFieldViewExecution,
              fieldBuffer: g2pOptions.gridUpdate?.mechanicsFieldViewBuffer,
              workspaceExecution:
                g2pOptions.gridUpdate
                  ?.parentFieldMechanicsWorkspaceExecution
            });
            return reconstruction;
          }
        });
      };
      observedTwoLevelMechanicsRunner
        .schroederSpatialTopologyTransitionAware = true;

      const secondSphParticleState = {
        ...chainSphParticleState,
        ...firstResidentStep.nextSphParticleState
      };
      const secondMlsMpmParticleState = {
        ...chainMlsMpmParticleState,
        ...firstResidentStep.nextMlsMpmParticleState
      };
      let secondChainStep;
      try {
        secondChainStep =
          await hierarchyModule.runSchroederSameLevelMechanicsWebGpu({
            ...commonChainOptions,
            sphParticleState: secondSphParticleState,
            mlsMpmParticleState: secondMlsMpmParticleState,
            sphParticleUpload: firstNextUploads.sphParticleUpload,
            mlsMpmParticleUpload: firstNextUploads.mlsMpmParticleUpload,
            levelAssignment: exactSuccessorLevelAssignment,
            levelAssignmentSourceFamily:
              firstSuccessorConsumption.sourceFamily,
            levelAssignmentSourceFamilyLease:
              firstSuccessorConsumption.sourceFamilyLease,
            spatialEpochGenerationRunner: observedSpatialEpochGeneration,
            twoLevelMechanicsRunner: observedTwoLevelMechanicsRunner
          });
      } catch (error) {
        const exactSuccessorError = new Error(
          'Exact sealed terminal successor was rejected before next-tick '
            + `authoritative P2G/G2P: ${error?.message || String(error)}`
        );
        exactSuccessorError.code = error?.code ?? null;
        exactSuccessorError.eligibility = error?.eligibility ?? null;
        exactSuccessorError.cause = error;
        throw exactSuccessorError;
      }
      const secondResidentStep = secondChainStep.residentStep;
      const secondNextUploads = secondResidentStep.nextParticleUploads;
      const initialNextTickGeneration = secondGenerationRecords[0] ?? null;

      // One post-chain diagnostic readback compares X_{n+1} with X_{n+2}.
      // The production calls above retain their no-full-readback policy.
      const chainStateByteLength =
        particleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
      const chainAssignmentByteLength =
        particleCount * 16 * Float32Array.BYTES_PER_ELEMENT;
      const chainReadback = device.createBuffer({
        label: 'native-slice9-terminal-successor-chain-readback',
        size: chainStateByteLength * 2 + chainAssignmentByteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const chainReadEncoder = device.createCommandEncoder({
        label: 'native-slice9-terminal-successor-chain-readback-encoder'
      });
      chainReadEncoder.copyBufferToBuffer(
        firstNextUploads.sphParticleUpload.stateBuffer,
        0,
        chainReadback,
        0,
        chainStateByteLength
      );
      chainReadEncoder.copyBufferToBuffer(
        secondNextUploads.sphParticleUpload.stateBuffer,
        0,
        chainReadback,
        chainStateByteLength,
        chainStateByteLength
      );
      chainReadEncoder.copyBufferToBuffer(
        exactSuccessorLevelAssignment.assignmentBuffer,
        0,
        chainReadback,
        chainStateByteLength * 2,
        chainAssignmentByteLength
      );
      device.queue.submit([chainReadEncoder.finish()]);
      await chainReadback.mapAsync(GPUMapMode.READ);
      const chainStates = new Float32Array(
        chainReadback.getMappedRange()
      ).slice();
      chainReadback.unmap();
      chainReadback.destroy();
      const firstOutputState = chainStates.slice(0, particleCount * 8);
      const secondOutputState = chainStates.slice(
        particleCount * 8,
        particleCount * 16
      );
      const exactSuccessorAssignmentRows = chainStates.slice(
        particleCount * 16,
        particleCount * 16 + particleCount * 16
      );
      let fineTransactionEvidence = null;
      for (const pending of mechanicsStageReadbacks) {
        if (pending.unavailable === true) {
          fineTransactionEvidence = pending;
          continue;
        }
        await pending.readback.mapAsync(GPUMapMode.READ);
        const words = new Uint32Array(
          pending.readback.getMappedRange()
        ).slice();
        pending.readback.unmap();
        pending.readback.destroy();
        const fieldWords = words.slice(0, pending.fieldWordLength);
        const activeSourceWords = words.slice(
          pending.fieldWordLength,
          pending.fieldWordLength + pending.activeSourceWordLength
        );
        const workspaceOffset =
          pending.fieldWordLength + pending.activeSourceWordLength;
        const workspaceWords = words.slice(
          workspaceOffset,
          workspaceOffset + pending.workspaceWordLength
        );
        const refluxOffset = workspaceOffset + pending.workspaceWordLength;
        const refluxWords = words.slice(
          refluxOffset,
          refluxOffset + pending.refluxWordLength
        );
        const descriptorOffsetWords = fieldWords[24] ?? 0;
        const descriptorWords = fieldWords[25] ?? 0;
        const receiptOffsetWords = (fieldWords[30] ?? 0) - 36;
        fineTransactionEvidence = {
          stage: pending.stage,
          selectedLevel: pending.selectedLevel,
          fieldStatus: fieldWords[2] ?? null,
          fieldCount: fieldWords[34] ?? null,
          fieldCandidateCount: fieldWords[33] ?? null,
          descriptors: Array.from({ length: particleCount }, (_, index) => {
            const offset = descriptorOffsetWords + index * descriptorWords;
            return Array.from(fieldWords.slice(offset, offset + 4));
          }),
          receiptStatus:
            receiptOffsetWords >= 0
              ? fieldWords[receiptOffsetWords + 2]
              : null,
          receiptPhase:
            receiptOffsetWords >= 0
              ? fieldWords[receiptOffsetWords + 3]
              : null,
          activeSourceStatus: activeSourceWords[2] ?? null,
          activeSourceCount: activeSourceWords[18] ?? null,
          activeSourceCandidateCount: activeSourceWords[43] ?? null,
          activeToPhysical: Array.from(activeSourceWords.slice(
            activeSourceWords[25] ?? 0,
            (activeSourceWords[25] ?? 0) + (activeSourceWords[18] ?? 0)
          )),
          physicalToActive: Array.from(activeSourceWords.slice(
            activeSourceWords[26] ?? 0,
            (activeSourceWords[26] ?? 0) + particleCount
          )),
          workspaceStatus: workspaceWords[2] ?? null,
          workspacePhase: workspaceWords[36] ?? null,
          workspaceInvalidSourceCount: workspaceWords[37] ?? null,
          refluxStatus: refluxWords[2] ?? null,
          committedFineSubstepCount: refluxWords[8] ?? null,
          correctionClampCount: refluxWords[10] ?? null,
          cflRejectCount: refluxWords[11] ?? null,
          refluxInvalidCount: refluxWords[12] ?? null,
          refluxPhase: refluxWords[59] ?? null
        };
      }
      let maxNextTickPositionDeltaM = 0;
      let allNextTickStateFinite = true;
      for (let index = 0; index < particleCount; index += 1) {
        for (let lane = 0; lane < 8; lane += 1) {
          allNextTickStateFinite &&=
            Number.isFinite(secondOutputState[index * 8 + lane]);
        }
        for (let axis = 0; axis < 3; axis += 1) {
          maxNextTickPositionDeltaM = Math.max(
            maxNextTickPositionDeltaM,
            Math.abs(
              secondOutputState[index * 8 + axis]
                - firstOutputState[index * 8 + axis]
            )
          );
        }
      }

      const firstConsumerFence = device.queue.onSubmittedWorkDone();
      const firstLeaseRelease =
        firstSuccessorConsumption.releaseAfter(firstConsumerFence);
      const secondSuccessorSourceFamily =
        secondChainStep.schroederSpatialSuccessorSourceFamily
        ?? secondResidentStep.schroederSpatialSuccessorSourceFamily
        ?? secondNextUploads.schroederSpatialSuccessorSourceFamily
        ?? null;
      const secondSuccessorConsumption =
        sceneModule.beginSchroederSpatialSuccessorSourceFamilyConsumption({
          sourceFamily: secondSuccessorSourceFamily,
          device,
          particleCount,
          stateBuffer: secondNextUploads.sphParticleUpload.stateBuffer,
          thermoBuffer: secondNextUploads.sphParticleUpload.thermoBuffer,
          identityBuffer: secondNextUploads.sphParticleUpload.identityBuffer,
          mechanicsBuffer:
            secondNextUploads.mlsMpmParticleUpload.mechanicsBuffer,
          consumerStage:
            'native-slice9-terminal-successor-test-retirement',
          retirementReason:
            'native Slice 9 second terminal successor fixture complete',
          ownerFence: Promise.resolve()
        });
      const secondLeaseRelease =
        secondSuccessorConsumption.releaseAfter(
          device.queue.onSubmittedWorkDone()
        );
      const [
        firstLeaseReceipt,
        firstRetirementReceipt,
        secondLeaseReceipt,
        secondRetirementReceipt
      ] = await Promise.all([
        firstLeaseRelease,
        firstSuccessorConsumption.retirementPromise,
        secondLeaseRelease,
        secondSuccessorConsumption.retirementPromise
      ]);
      const chainValidationError = await device.popErrorScope();
      result.successorChain = {
        status: 'executed',
        terminalClassifierCallCount,
        terminalClassifierInputExact: Boolean(
          terminalClassifierInput?.sphParticleUpload?.stateBuffer
            === firstNextUploads.sphParticleUpload.stateBuffer
          && terminalClassifierInput?.sphParticleUpload?.thermoBuffer
            === firstNextUploads.sphParticleUpload.thermoBuffer
          && terminalClassifierInput?.mlsMpmParticleUpload?.mechanicsBuffer
            === firstNextUploads.mlsMpmParticleUpload.mechanicsBuffer
        ),
        terminalClassifierPublishedExact: Boolean(
          terminalClassifierOutput
          && terminalClassifierOutput
            === firstNextUploads.schroederSpatialSuccessorLevelAssignment
          && terminalClassifierOutput === exactSuccessorLevelAssignment
        ),
        sourceFamilyReady: firstSuccessorSourceFamily?.ready === true,
        sourceFamilyAuthenticated:
          firstSuccessorSourceFamily?.authenticated === true,
        sourceFamilyHasExactAssignment:
          firstSuccessorSourceFamily
            ?.canonicalSpatialLevelAssignmentAvailable === true,
        exactAssignmentSourceBuffers: Boolean(
          exactSuccessorLevelAssignment?.sourceStateBuffer
            === firstNextUploads.sphParticleUpload.stateBuffer
          && exactSuccessorLevelAssignment?.sourceThermoBuffer
            === firstNextUploads.sphParticleUpload.thermoBuffer
          && exactSuccessorLevelAssignment?.sourceMechanicsBuffer
            === firstNextUploads.mlsMpmParticleUpload.mechanicsBuffer
        ),
        nextTickGenerationUsedExactAssignment: Boolean(
          initialNextTickGeneration?.options?.levelAssignment
            === exactSuccessorLevelAssignment
        ),
        nextTickDirectoryAbiVersion:
          initialNextTickGeneration?.generated?.directoryAbiVersion ?? null,
        nextTickActiveSourceReady:
          initialNextTickGeneration?.generated?.activeSourceView?.ready === true,
        nextTickMechanicsLevelCount:
          initialNextTickGeneration?.generated?.mechanicsLevelViews?.length
          ?? 0,
        nextTickMechanicsFieldsUseExactAssignment: Boolean(
          initialNextTickGeneration?.generated?.mechanicsLevelViews?.every(
            (levelView) => (
              levelView.mechanicsFieldView?.sourceBuffer
                === exactSuccessorLevelAssignment.assignmentBuffer
            )
          )
        ),
        p2gCallCount,
        gridUpdateCallCount,
        g2pCallCount,
        p2gConsumedExactAssignment,
        p2gConsumedExactStateBuffer,
        g2pConsumedExactAssignment,
        residentCallCount,
        firstNormalHotLoopReadbackFree:
          firstChainStep.normalHotLoopReadbackFree === true,
        secondNormalHotLoopReadbackFree:
          secondChainStep.normalHotLoopReadbackFree === true,
        firstFullParticleReadbackPerformed:
          firstChainStep.fullParticleReadbackPerformed === true,
        secondFullParticleReadbackPerformed:
          secondChainStep.fullParticleReadbackPerformed === true,
        firstSpatialTransitionCompactReadbackPerformed:
          firstChainStep
            .schroederSpatialTransitionCompactReadbackPerformed === true,
        secondSpatialTransitionCompactReadbackPerformed:
          secondChainStep
            .schroederSpatialTransitionCompactReadbackPerformed === true,
        allNextTickStateFinite,
        maxNextTickPositionDeltaM,
        firstOutputState: Array.from(firstOutputState),
        secondOutputState: Array.from(secondOutputState),
        exactSuccessorAssignmentRows:
          Array.from(exactSuccessorAssignmentRows),
        fineTransactionEvidence,
        nextTickStateBufferAliasedInput:
          secondNextUploads.sphParticleUpload.stateBuffer
            === firstNextUploads.sphParticleUpload.stateBuffer,
        firstOutputStateBufferLabel:
          firstNextUploads.sphParticleUpload.stateBuffer?.label ?? null,
        secondOutputStateBufferLabel:
          secondNextUploads.sphParticleUpload.stateBuffer?.label ?? null,
        firstLeaseReleased: firstLeaseReceipt?.released === true,
        firstRetired: firstRetirementReceipt?.retired === true,
        secondLeaseReleased: secondLeaseReceipt?.released === true,
        secondRetired: secondRetirementReceipt?.retired === true,
        validationError: chainValidationError?.message || null
      };

      buffersModule.destroySphGpuParticleBuffers(chainSphParticleUpload);
      buffersModule.destroyMlsMpmGpuParticleBuffers(
        chainMlsMpmParticleUpload
      );
      mechanicsRefreshModule.destroyMlsMpmMechanicsMaterialPhaseUpload(
        mechanicsMaterialPhaseUpload
      );
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

  // ---- Terminal successor -> next-tick production mechanics -------------
  const chain = native.successorChain;
  assert.equal(chain?.status, 'executed', JSON.stringify(chain));
  assert.equal(chain.validationError, null, JSON.stringify(chain));
  assert.equal(
    chain.terminalClassifierCallCount,
    1,
    'the first terminal E* family must be classified exactly once'
  );
  assert.equal(chain.terminalClassifierInputExact, true);
  assert.equal(chain.terminalClassifierPublishedExact, true);
  assert.equal(chain.sourceFamilyReady, true);
  assert.equal(chain.sourceFamilyAuthenticated, true);
  assert.equal(chain.sourceFamilyHasExactAssignment, true);
  assert.equal(chain.exactAssignmentSourceBuffers, true);
  assert.equal(
    chain.nextTickGenerationUsedExactAssignment,
    true,
    'the next tick must receive the private terminal assignment object'
  );
  assert.equal(
    chain.nextTickDirectoryAbiVersion,
    2,
    'the exact successor must enter directory v2'
  );
  assert.equal(chain.nextTickActiveSourceReady, true);
  assert.equal(chain.nextTickMechanicsLevelCount, 2);
  assert.equal(chain.nextTickMechanicsFieldsUseExactAssignment, true);
  assert.ok(chain.p2gCallCount > 0, 'the next tick must execute real P2G');
  assert.ok(chain.g2pCallCount > 0, 'the next tick must execute real G2P');
  assert.equal(chain.p2gConsumedExactAssignment, true);
  assert.equal(chain.p2gConsumedExactStateBuffer, true);
  assert.equal(chain.g2pConsumedExactAssignment, true);
  assert.equal(
    chain.residentCallCount,
    0,
    'authoritative two-level mechanics must not run the resident fallback'
  );
  assert.equal(chain.firstNormalHotLoopReadbackFree, true);
  assert.equal(chain.secondNormalHotLoopReadbackFree, true);
  assert.equal(chain.firstFullParticleReadbackPerformed, false);
  assert.equal(chain.secondFullParticleReadbackPerformed, false);
  assert.equal(chain.firstSpatialTransitionCompactReadbackPerformed, false);
  assert.equal(chain.secondSpatialTransitionCompactReadbackPerformed, false);
  assert.equal(chain.allNextTickStateFinite, true);
  const fineTransaction = chain.fineTransactionEvidence;
  assert.equal(
    fineTransaction?.stage,
    'pre-g2p-1',
    'the overlapping-recipient fine transaction must publish compact evidence'
  );
  assert.equal(fineTransaction.fieldStatus, 3);
  assert.equal(fineTransaction.fieldCount, 54);
  assert.equal(fineTransaction.fieldCandidateCount, 81);
  assert.deepEqual(fineTransaction.descriptors, [
    [2, 3061144, 0, 1],
    [3, 3061144, 0, 1],
    [0, 0, 0, 0]
  ]);
  assert.equal(fineTransaction.receiptStatus, 3);
  assert.equal(
    fineTransaction.receiptPhase,
    4,
    'the corrected fine field must reach ENERGY_READY before G2P'
  );
  assert.equal(fineTransaction.activeSourceStatus, 3);
  assert.equal(fineTransaction.activeSourceCount, 3);
  assert.equal(fineTransaction.activeSourceCandidateCount, 81);
  assert.deepEqual(fineTransaction.activeToPhysical, [0, 1, 2]);
  assert.deepEqual(fineTransaction.physicalToActive, [0, 1, 2]);
  assert.equal(fineTransaction.workspaceStatus, 3);
  assert.equal(fineTransaction.workspacePhase, 3);
  assert.equal(fineTransaction.workspaceInvalidSourceCount, 0);
  assert.equal(fineTransaction.refluxStatus, 3);
  assert.equal(fineTransaction.committedFineSubstepCount, 1);
  assert.equal(fineTransaction.correctionClampCount, 1);
  assert.equal(fineTransaction.cflRejectCount, 0);
  assert.equal(fineTransaction.refluxInvalidCount, 0);
  assert.equal(fineTransaction.refluxPhase, 1);
  assert.ok(
    chain.maxNextTickPositionDeltaM > 0,
    'the next-tick G2P output must advance particle positions: '
      + JSON.stringify({
        firstOutputState: chain.firstOutputState,
        secondOutputState: chain.secondOutputState,
        exactSuccessorAssignmentRows:
          chain.exactSuccessorAssignmentRows,
        fineTransactionEvidence: chain.fineTransactionEvidence,
        nextTickStateBufferAliasedInput:
          chain.nextTickStateBufferAliasedInput,
        firstOutputStateBufferLabel: chain.firstOutputStateBufferLabel,
        secondOutputStateBufferLabel: chain.secondOutputStateBufferLabel
      })
  );
  assert.equal(chain.firstLeaseReleased, true);
  assert.equal(chain.firstRetired, true);
  assert.equal(chain.secondLeaseReleased, true);
  assert.equal(chain.secondRetired, true);
});
