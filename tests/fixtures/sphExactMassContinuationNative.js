export async function preloadExactMassContinuationNative() {
  const dependency = async (url, file) => {
    const code = await (await fetch(url)).text();
    const path = [...code.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g)]
      .map(match => match[1]).find(path => path.split('?')[0].endsWith('/' + file));
    if (!path) throw new Error(`Missing ${file} in ${url}`);
    return new URL(path, new URL(url, location.href)).href;
  };
  const hierarchyUrl = '/src/runtime/sph/schroederHierarchyGpu.js';
  const stepUrl = await dependency(hierarchyUrl, 'sphMlsMpmGpuStep.js');
  const spatialUrl = await dependency(hierarchyUrl, 'schroederSpatialSuccessorSourceFamily.js');
  const bufferUrl = await dependency(stepUrl, 'sphGpuBuffers.js');
  const thermalUrl = await dependency(stepUrl, 'sphThermalGpuKernel.js');
  const mechanicsUrl = await dependency(bufferUrl, 'sphMechanicsMaterialTable.js');
  const couplingUrl = await dependency(hierarchyUrl, 'schroederCrossLevelCouplingGpu.js');
  const fusedUrl = await dependency(couplingUrl, 'schroederFusedFineSubstepGpu.js');
  const refreshUrl = await dependency(stepUrl, 'sphMechanicsRefreshGpuKernel.js');
  const identityUrl = await dependency(bufferUrl, 'sphGpuDeviceIdentity.js');
  const refluxUrl = await dependency(fusedUrl, 'schroederCrossLevelRefluxLedger.js');
  const epochUrl = await dependency(hierarchyUrl, 'schroederSpatialEpochGpu.js');
  const [steps, buffers, thermal, mechanics, materials, energy] = await Promise.all([
    import(/* @vite-ignore */ stepUrl), import(/* @vite-ignore */ bufferUrl),
    import(/* @vite-ignore */ thermalUrl), import(/* @vite-ignore */ mechanicsUrl),
    import('/src/runtime/material/materialClosures.js'), import('/src/runtime/material/thermoState.js')
  ]);
  // These are lazy production dependencies. Warm them before the measured
  // run so Vite can finish any pending development reload first.
  for (const file of ['sphG2pGpuKernel.js', 'sphMlsMpmPostMechanicsClosure.js', 'sphMechanicsRefreshGpuKernel.js']) {
    const url = await dependency(stepUrl, file);
    await import(/* @vite-ignore */ url);
  }
  const [hierarchy, spatial] = await Promise.all([
    import(/* @vite-ignore */ hierarchyUrl), import(/* @vite-ignore */ spatialUrl)]);
  const [refresh, , fused, identity, reflux, epoch] = await Promise.all([import(/* @vite-ignore */ refreshUrl),
    import(/* @vite-ignore */ couplingUrl), import(/* @vite-ignore */ fusedUrl),
    import(/* @vite-ignore */ identityUrl), import(/* @vite-ignore */ refluxUrl), import(/* @vite-ignore */ epochUrl)]);
  return { steps, buffers, thermal, mechanics, materials, energy, hierarchy, spatial, refresh, fused, identity, reflux, epoch };
}

export async function runExactMassContinuationNative(device, format, useSpatial = false, useFused = false, observeAuthority = false, sequence = null) {
  const { steps, buffers, thermal, mechanics, materials, energy, hierarchy, spatial, refresh, fused, identity, reflux, epoch } = await preloadExactMassContinuationNative();
  const twoLevel = useSpatial === 'two-level';
  const materialProperties = { fe: materials.createReferenceMaterialClosures().fe.properties };
  const mass = 0.001 * (1 + 2 ** -30);
  const initial = { smoothingLengthM: .5, dimension: 3, step: 0, time: 0, storageGeneration: 1,
    particles: [{ id: 'exact-carrier', material: 'fe', initialBodyDomainId: 1, initialBodyId: 'exact-carrier-body',
      massKg: mass, x: [.15, 1, 1], v: [.1, 0, 0],
      specificInternalEnergyJPerKg: energy.specificInternalEnergyJPerKg(materialProperties.fe, 300) }] };
  if (twoLevel) {
    const density = materialProperties.fe.phases.find(phase => phase.name === 'solid').densityKgPerM3;
    initial.particles = [.001, .008].map((volume, index) => ({ id: `exact-level-${index}`, material: 'fe',
      initialBodyDomainId: index + 1, initialBodyId: `exact-body-${index}`,
      massKg: density * volume * (1 + 2 ** -30), x: [1.3 + .8 * index, 2, 2], v: [.1, 0, 0],
      specificInternalEnergyJPerKg: energy.specificInternalEnergyJPerKg(materialProperties.fe, 300) }));
  }
  let packed = buffers.buildSphGpuParticleBuffers(initial, { materialProperties,
    exactMass: { format, reference: 'native two-step preserving solver fixture' } });
  if (packed.identity[0] !== 1) throw new Error('Solid fixture requires its authored nonzero continuity domain');
  let packedMls = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties,
    particleSeparationRelaxation: 0, soundSpeedScale: .01 });
  let sphUpload = buffers.uploadSphGpuParticleBuffers(device, packed);
  let mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, packedMls);
  const family = sphUpload.exactMassInventory;
  const table = thermal.buildSphThermalMaterialTable(materialProperties);
  for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
  const mechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties);
  const materialUpload = twoLevel ? refresh.uploadMlsMpmMechanicsMaterialPhaseRecords(device, mechanicsTable) : null;
  const observe = async (buffer, integer = false) => {
    const copy = device.createBuffer({ size: buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    try {
      const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, copy.size);
      device.queue.submit([encoder.finish()]); await copy.mapAsync(GPUMapMode.READ);
      const values = Array.from(integer ? new Uint32Array(copy.getMappedRange()) : new Float32Array(copy.getMappedRange()));
      copy.unmap(); return values;
    } finally { copy.destroy(); }
  };
  const result = { initialState: Array.from(packed.state), initialThermo: Array.from(packed.thermo),
    mass, masses: initial.particles.map(particle => particle.massKg), twoLevel,
    runs: [], fullG2Acceptance: false, spatialPublicationAdmitted: Boolean(useSpatial), fusedMechanicsRequested: useFused, sequence };
  let previousStep = null;
  const receiptBuffers = [];
  let sourceFamily = null, sourceLease = null, successorAssignment = null;
  try {
    for (let cycle = 1; cycle <= 2; cycle++) {
      const options = {
        device, sphParticleState: packed, mlsMpmParticleState: packedMls,
        sphParticleUpload: sphUpload, mlsMpmParticleUpload: mlsUpload,
        thermalMaterialTable: table, mechanicsMaterialTable: mechanicsTable,
        thermalStepOptions: { conductionRate: 0, wallTemperaturesK: { xMin: 350 }, wallLayerM: .5, wallRate: 2600 },
        gridSpacingM: .5, boxDimsM: [2, 2, 2], dt: .001, gravityMPerS2: [0, 0, 0],
        preferWebGpu: true, readbackMode: 'no-full-readback', contactSolverEnabled: useSpatial,
        observeCanonicalSpatialAuthority: observeAuthority,
        gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null, fuseNoFullResidentMechanics: useFused };
      if (sequence?.thermal) options.thermalStepOptions.wallRate = 26;
      if (twoLevel) {
        options.boxDimsM = [4, 4, 4];
        // This broad layer reaches all six walls. Unspecified legacy faces
        // are 0 K reservoirs, so declare the complete heating environment.
        options.thermalStepOptions.wallTemperaturesK = Object.fromEntries(
          ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'].map(face => [face, 350]));
        options.thermalStepOptions.wallLayerM = 4;
        options.thermalStepOptions.wallRate = 26000;
        options.mechanicsRefreshOptions = { mechanicsMaterialPhaseUpload: materialUpload };
      }
      if (sequence && !sequence.thermal) {
        delete options.thermalMaterialTable;
        delete options.mechanicsMaterialTable;
        delete options.thermalStepOptions;
      }
      if (sourceFamily) sourceLease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(sourceFamily, { device });
      let receiptBuffer = null;
      const generationRunner = async args => {
        const generation = await epoch.runSchroederSpatialEpochGenerationWithBackpressureWebGpu(args);
        if (!receiptBuffer) {
          receiptBuffer = identity.tagWebGpuBufferDevice(device.createBuffer({
            size: fused.SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_BYTE_LENGTH,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), device);
          receiptBuffers.push(receiptBuffer);
          options[fused.SCHROEDER_FUSED_TERMINAL_REFLUX_RECEIPT_TARGET_OPTION] =
            fused.createSchroederFusedTerminalRefluxReceiptTarget({ device,
              scheduleId: `exact-native-two-level-${cycle}`, laneId: 'native', stateKey: 'exact',
              stepOrdinal: 1, targetBuffer: receiptBuffer, targetOffsetBytes: 0,
              expectedCompletionOrdinal: generation.execution.generationId,
              expectedFineSubstepCount: 2, expectedFineLevel: 0, expectedCoarseLevel: 1 });
        }
        return generation;
      };
      const execution = useSpatial ? await hierarchy.runSchroederSameLevelMechanicsWebGpu({
        device, sphParticleState: packed, mlsMpmParticleState: packedMls,
        sphParticleUpload: sphUpload, mlsMpmParticleUpload: mlsUpload,
        levelAssignment: successorAssignment, levelAssignmentSourceFamily: sourceFamily,
        levelAssignmentSourceFamilyLease: sourceLease,
        selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5,
        boxDimsM: [2, 2, 2], dt: .001, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
        enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
        observeCanonicalSpatialAuthority: observeAuthority,
        enableLawQueue: false, enableLawNeighborCandidates: false,
        enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
        ...(twoLevel ? { maxLevel: 1, baseGridSpacingM: .25, targetSupportCells: 4, supportRadiusScale: 15,
          boxDimsM: [4, 4, 4], enablePressureInterfaceOwnerScope: false,
          enableTwoLevelMechanics: true, twoLevelMechanicsAuthority: 'authoritative',
          twoLevelFineSubstepCount: 2, spatialEpochArenaCount: 4,
          spatialEpochGenerationRunner: generationRunner } : {}),
        residentStepOptions: options }) : null;
      const step = sequence
        ? (await steps.runMlsMpmResidentStepsWithOptionalWebGpu({ ...options,
          stepCount: sequence.count, fuseNoFullResidentMechanicsSequence: true, compactSummaryMode: 'none' })).finalStep
        : execution?.residentStep ?? await steps.runMlsMpmResidentStepWithOptionalWebGpu(options);
      if (sequence) {
        if (step.stageTiming.fusedResidentSequence !== true || step.fusedResidentSequence.stepCount !== sequence.count) {
          throw new Error('Actual fused K-step sequence was not selected');
        }
      } else if (twoLevel) {
        if (step.twoLevelMechanicsAuthority !== 'authoritative' || step.twoLevelFineSubstepCount !== 2
            || !step.twoLevelAuthoritativeCommitVerified || !step.thermalStep || !step.mechanicsRefreshStep) {
          throw new Error('Actual authoritative two-level thermal continuation was not selected');
        }
      } else if (step.stageTiming.fusedResidentMechanics !== useFused) throw new Error('Actual mechanics route differs from requested fused execution');
      const next = step.nextParticleUploads;
      let refluxHeader = null;
      if (twoLevel) {
        if (!receiptBuffer || !step.twoLevelTerminalRefluxReceiptCopy) throw new Error('Missing actual terminal reflux copy');
        await receiptBuffer.mapAsync(GPUMapMode.READ);
        refluxHeader = reflux.decodeSchroederCrossLevelRefluxTerminalHeader(new Uint32Array(receiptBuffer.getMappedRange().slice(0)));
        receiptBuffer.unmap();
        if (!fused.isSchroederFusedTerminalRefluxHeaderFullyAdmitted(refluxHeader, { expectedFineSubstepCount: 2 })
            || refluxHeader.completionOrdinal !== step.twoLevelTerminalRefluxReceiptCopy.completionOrdinal) {
          throw new Error('Native two-level terminal reflux was not admitted: ' + JSON.stringify(refluxHeader));
        }
      }
      if (!next || next.sphParticleUpload.exactMassInventory !== family) throw new Error('Exact inventory did not reach the actual step continuation');
      const nextFamily = next.schroederSpatialSuccessorSourceFamily ?? null;
      if (useSpatial) {
        if (!nextFamily) throw new Error('Missing actual SS publication');
        spatial.resolveSchroederSpatialSuccessorSourceFamily(nextFamily, { device,
          sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload });
        for (const key of ['storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch',
          'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch']) {
          if (next.sphParticleUpload[key] !== nextFamily[key] || next.mlsMpmParticleUpload[key] !== nextFamily[key]) {
            throw new Error('Final physical owner epoch mismatch: ' + key);
          }
        }
      }
      const held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, device);
      try {
        let fieldEvidence = null;
        if (observeAuthority && useSpatial && useFused) {
          const capture = steps.acquireFusedMlsMpmMechanicsExactMassCapture(step.g2pReconstruction.gpuResult,
            { device, sphParticleUpload: sphUpload });
          try {
            const field = capture.generation.mechanicsFieldView;
            const words = await observe(field.fieldViewBuffer, true);
            const offset = field.layout.receiptControlOffsetWords;
            fieldEvidence = { header: words.slice(0, 64), receipt: words.slice(offset, offset + field.layout.receiptControlWords),
              layout: field.layout, state: words.slice(field.layout.stateOffsetWords),
              parent: (await observe(field.parentMechanicsView.mechanicsViewBuffer, true)).slice(0, 64),
              activeSource: (await observe(field.activeSourceViewBuffer, true)).slice(0, 64),
              identity: await observe(field.identityBuffer, true),
              plan: Object.fromEntries(['sourceCount', 'sourceCapacity', 'sourceRowStrideFloats', 'sourceRowLayoutId',
                'identityStrideWords', 'selectedLevel', 'gridNodeCount', 'gridDims', 'gridShift', 'candidateCapacity',
                'fieldCapacity', 'generationId', 'deviceOrdinal', 'laneOrdinal', 'leaseToken', 'sourceFamilyId',
                'storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch', 'topologyEpoch', 'chartEpoch',
                'levelEpoch', 'supportEpoch', 'completionOrdinal', 'gridSpacingM'].map(key => [key, field[key]])) };
          } finally { capture.release(); }
        }
        result.runs.push({ cycle, backend: step.backend, fusedResidentMechanics: step.stageTiming?.fusedResidentMechanics ?? false,
          fieldEvidence, fusedResidentSequence: step.stageTiming?.fusedResidentSequence ?? false,
          twoLevelAuthority: step.twoLevelMechanicsAuthority ?? null,
          twoLevelFineSubstepCount: step.twoLevelFineSubstepCount ?? null,
          twoLevelCommitVerified: step.twoLevelAuthoritativeCommitVerified ?? false,
          refluxHeader,
          assignment: twoLevel ? await observe(next.schroederSpatialSuccessorLevelAssignment.assignmentBuffer) : null,
          physicsTick: next.sphParticleUpload.physicsTick, positionEpoch: next.sphParticleUpload.positionEpoch,
          exact: await observe(held.read.buffer, true),
          state: await observe(next.sphParticleUpload.stateBuffer), thermo: await observe(next.sphParticleUpload.thermoBuffer),
          g2pState: step.g2pReconstruction ? await observe(step.g2pReconstruction.gpuResult.stateBuffer) : null,
          p2gGrid: step.p2gGridProjection?.gpuResult?.gridBuffer
            ? await observe(step.p2gGridProjection.gpuResult.gridBuffer) : null,
          updatedGrid: step.gridUpdate?.gpuResult?.updatedGridBuffer
            ? await observe(step.gridUpdate.gpuResult.updatedGridBuffer) : null,
          p2gMode: step.p2gGridProjection?.gpuResult?.canonicalSpatialAuthorityMode ?? null,
          spatialAuthorityEvidence: step.g2pReconstruction?.schroederSpatialAuthorityEvidence ?? null,
          storageGeneration: next.sphParticleUpload.storageGeneration, inventoryGeneration: held.read.generation,
          spatialFamilyStatus: nextFamily?.status ?? null,
          finalEpochs: nextFamily?.successorEpochIdentity ?? null });
      } finally { await buffers.releaseSphParticleExactMassRead(held); }
      const nextPacked = steps.cloneSphParticleStateForNext(packed, step);
      const nextMls = steps.cloneMlsMpmParticleStateForNext(packedMls, step);
      await device.queue.onSubmittedWorkDone();
      if (sourceFamily) {
        spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(sourceFamily, sourceLease, { device });
        sourceLease = null;
        await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(sourceFamily, { device });
      }
      steps.destroyMlsMpmResidentStepBuffers(step, {
        preserveBuffers: steps.retainedContinuationBuffersFromUploads(next) });
      // Retire the original upload after the producer/closure has bound its
      // successor. Its immutable numeric family must remain open for step 2.
      buffers.destroySphGpuParticleBuffers(sphUpload);
      buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
      await device.queue.onSubmittedWorkDone();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (sphUpload.destroyed !== true) throw new Error('Original particle owner did not retire before the next step');
      if (mlsUpload.destroyed !== true) throw new Error('Original mechanics owner did not retire before the next step');
      sphUpload = next.sphParticleUpload; mlsUpload = next.mlsMpmParticleUpload;
      packed = nextPacked; packedMls = nextMls; previousStep = step;
      sourceFamily = nextFamily;
      successorAssignment = next.schroederSpatialSuccessorLevelAssignment ?? null;
    }
    const held = buffers.acquireSphParticleExactMassRead(sphUpload, device);
    await buffers.releaseSphParticleExactMassRead(held);
    result.successorUsableAfterOriginalRetirement = true;
    if (sourceFamily) {
      sourceLease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(sourceFamily, { device });
      const retiring = spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(sourceFamily, { device });
      buffers.destroySphGpuParticleBuffers(sphUpload);
      await device.queue.onSubmittedWorkDone();
      if (sphUpload.destroyed === true) throw new Error('SS lease did not retain the physical owner');
      const heldByLease = spatial.acquireSchroederSpatialSuccessorExactMassRead({ device,
        sphParticleUpload: sphUpload, mlsMpmParticleUpload: mlsUpload, consumerLease: sourceLease });
      result.exactAfterRetirementRequested = await observe(heldByLease.read.buffer, true);
      await buffers.releaseSphParticleExactMassRead(heldByLease);
      spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(sourceFamily, sourceLease, { device });
      sourceLease = null;
      await retiring;
      await device.queue.onSubmittedWorkDone();
      await new Promise(resolve => setTimeout(resolve, 0));
      result.finalLeaseRetainedOwner = true;
      result.finalOwnerRetired = sphUpload.destroyed === true;
      result.finalOwnerBorrowCount = sphUpload.__ulgActiveBorrowCount;
    }
    return result;
  } finally {
    await device.queue.onSubmittedWorkDone();
    if (sourceFamily) {
      if (sourceLease) spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(sourceFamily, sourceLease, { device });
      await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(sourceFamily, { device });
    }
    if (previousStep) steps.destroyMlsMpmResidentStepBuffers(previousStep);
    buffers.destroySphGpuParticleBuffers(sphUpload);
    buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
    if (materialUpload) refresh.destroyMlsMpmMechanicsMaterialPhaseUpload(materialUpload);
    for (const buffer of receiptBuffers) buffer.destroy();
  }
}
