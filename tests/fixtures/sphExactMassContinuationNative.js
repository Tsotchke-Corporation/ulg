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
  return { steps, buffers, thermal, mechanics, materials, energy, hierarchy, spatial };
}

export async function runExactMassContinuationNative(device, format, useSpatial = false) {
  const { steps, buffers, thermal, mechanics, materials, energy, hierarchy, spatial } = await preloadExactMassContinuationNative();
  const materialProperties = { fe: materials.createReferenceMaterialClosures().fe.properties };
  const mass = 0.001 * (1 + 2 ** -30);
  const initial = { smoothingLengthM: .5, dimension: 3, step: 0, time: 0, storageGeneration: 1,
    particles: [{ id: 'exact-carrier', material: 'fe', massKg: mass, x: [.15, 1, 1], v: [.1, 0, 0],
      specificInternalEnergyJPerKg: energy.specificInternalEnergyJPerKg(materialProperties.fe, 300) }] };
  let packed = buffers.buildSphGpuParticleBuffers(initial, { materialProperties,
    exactMass: { format, reference: 'native two-step preserving solver fixture' } });
  let packedMls = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties,
    particleSeparationRelaxation: 0, soundSpeedScale: .01 });
  let sphUpload = buffers.uploadSphGpuParticleBuffers(device, packed);
  let mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, packedMls);
  const family = sphUpload.exactMassInventory;
  const table = thermal.buildSphThermalMaterialTable(materialProperties);
  for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
  const mechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties);
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
    mass, runs: [], fullG2Acceptance: false, spatialPublicationAdmitted: useSpatial };
  let previousStep = null;
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
        gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null, fuseNoFullResidentMechanics: false };
      if (sourceFamily) sourceLease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(sourceFamily, { device });
      const execution = useSpatial ? await hierarchy.runSchroederSameLevelMechanicsWebGpu({
        device, sphParticleState: packed, mlsMpmParticleState: packedMls,
        sphParticleUpload: sphUpload, mlsMpmParticleUpload: mlsUpload,
        levelAssignment: successorAssignment, levelAssignmentSourceFamily: sourceFamily,
        levelAssignmentSourceFamilyLease: sourceLease,
        selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5,
        boxDimsM: [2, 2, 2], dt: .001, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
        enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
        enableLawQueue: false, enableLawNeighborCandidates: false,
        enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
        residentStepOptions: options }) : null;
      const step = execution?.residentStep ?? await steps.runMlsMpmResidentStepWithOptionalWebGpu(options);
      const next = step.nextParticleUploads;
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
        result.runs.push({ cycle, backend: step.backend, exact: await observe(held.read.buffer, true),
          state: await observe(next.sphParticleUpload.stateBuffer), thermo: await observe(next.sphParticleUpload.thermoBuffer),
          g2pState: await observe(step.g2pReconstruction.gpuResult.stateBuffer),
          p2gGrid: step.p2gGridProjection?.gpuResult?.gridBuffer
            ? await observe(step.p2gGridProjection.gpuResult.gridBuffer) : null,
          updatedGrid: step.gridUpdate?.gpuResult?.updatedGridBuffer
            ? await observe(step.gridUpdate.gpuResult.updatedGridBuffer) : null,
          p2gMode: step.p2gGridProjection?.gpuResult?.canonicalSpatialAuthorityMode ?? null,
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
  }
}
