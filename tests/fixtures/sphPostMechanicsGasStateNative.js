// Browser-only opt-in native integration fixture. All physical models and the
// cold post-mechanics boundary are manufactured. No kinetics, nuclei, plume,
// atmospheric transport, pre-closure mechanics step or preset is validated.

async function dependency(parent, file) {
  const response = await fetch(parent);
  if (!response.ok) throw new Error('Dependency HTTP ' + response.status + ': ' + parent);
  const code = await response.text();
  const path = [...code.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)]
    .map((match) => match[1]).find((value) => value.split('?')[0].endsWith('/' + file));
  if (!path) throw new Error('Missing actual module edge ' + file + ' from ' + parent);
  return new URL(path, new URL(parent, location.href)).href;
}

async function loadModules() {
  // Resolve Vite's real transformed import URLs: importing a second timestamp
  // identity would duplicate the private authority maps and invalidate proof.
  const eosEntry = new URL('/src/runtime/sph/sphSpatialGasLedgerEosGpu.js', location.href).href;
  const currentUrl = await dependency(eosEntry, 'sphPostMechanicsGasStateGpu.js');
  const closureUrl = await dependency(currentUrl, 'sphMlsMpmPostMechanicsClosure.js');
  const hierarchyUrl = await dependency(currentUrl, 'schroederHierarchyGpu.js');
  const eosUrl = await dependency(currentUrl, 'sphSpatialGasLedgerEosGpu.js');
  const caloricUrl = await dependency(eosUrl, 'sphSpatialGasCaloricAdmission.js');
  const thermalUrl = await dependency(closureUrl, 'sphThermalGpuKernel.js');
  const reactionUrl = await dependency(closureUrl, 'sphReactionGpuKernel.js');
  const refreshUrl = await dependency(closureUrl, 'sphMechanicsRefreshGpuKernel.js');
  const stepUrl = await dependency(closureUrl, 'sphMlsMpmGpuStep.js');
  const expectedThermalUrl = await dependency(caloricUrl, 'sphThermalGpuKernel.js');
  if (thermalUrl !== expectedThermalUrl) throw new Error('Thermal private module identity split');
  const bindingUrl = await dependency(currentUrl, 'sphAerosolSpatialBinding.js');
  for (const parent of [eosUrl, bindingUrl]) {
    if (await dependency(parent, 'sphPostMechanicsGasStateGpu.js') !== currentUrl) {
      throw new Error('Current gas private module identity split');
    }
  }
  const named = {
    current: currentUrl, closure: closureUrl, hierarchy: hierarchyUrl, eos: eosUrl, caloric: caloricUrl,
    thermal: thermalUrl, reaction: reactionUrl, step: stepUrl,
    mechanics: await dependency(refreshUrl, 'sphMechanicsMaterialTable.js'),
    buffers: await dependency(closureUrl, 'sphGpuBuffers.js'),
    spatial: await dependency(closureUrl, 'schroederSpatialEpochGpu.js'),
    tx: await dependency(closureUrl, 'schroederSpatialEpochTransaction.js'),
    history: await dependency(closureUrl, 'sphResidentProductHistoryGpu.js'),
    parcels: await dependency(closureUrl, 'sphAerosolParcelGpu.js'),
    binding: bindingUrl,
    summary: await dependency(closureUrl, 'sphReactionGpuSummary.js'),
    identity: await dependency(closureUrl, 'sphGpuDeviceIdentity.js'),
    models: await dependency(caloricUrl, 'condensableThermodynamics.js'),
    state: '/src/runtime/sph/sphState.js', limits: '/src/runtime/webgpuDeviceLimits.js',
    optics: '/src/runtime/material/opticalGpuBuffers.js'
  };
  const entries = await Promise.all(Object.entries(named).map(async ([name, url]) => [name, await import(url)]));
  return { ...Object.fromEntries(entries), moduleUrls: named };
}

const epochFields = ['storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch',
  'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch'];
const R = 8.314462618;
const data = {
  h2: ['H2', .002, 6000, 5000, -50000, 1000],
  o2: ['O2', .032, 1500, 1000, -100000, 1200],
  h2o: ['H2O', .018, 4000, 2000, -200000, 900],
  h2o2: ['H2O2', .034, 3000, 3000, -60000, 1100]
};

function coldMaterialInputs(m) {
  const materialProperties = {}, condensableThermodynamicsByMaterial = {}, materials = [];
  for (const [key, [formula, M, liquidCv, gasCv, liquidU, density]] of Object.entries(data)) {
    const model = m.models.createCondensableThermodynamics({
      schema: 'peercompute.ulg.condensable-thermodynamics.v1',
      energyBasis: 'specific-enthalpy-at-reference-pressure', referenceTemperatureK: 300,
      referencePressurePa: 3000, liquidReferenceEnthalpyJPerKg: liquidU + 3000 / density,
      vaporizationReferenceEnthalpyJPerKg: 2e6, liquidCpJPerKgK: liquidCv,
      vaporCpJPerKgK: gasCv + R / M, liquidDensityKgPerM3: density, molarMassKgPerMol: M,
      minTemperatureK: 200, maxTemperatureK: 500, maxPressurePa: 2e6,
      provenance: 'manufactured current-stage source fixture: ' + key
    });
    condensableThermodynamicsByMaterial[key] = model;
    materialProperties[key] = { formula, molarMassKgPerMol: M, phases: [
      { name: 'liquid', temperatureRange: [0, 400], cpJPerKgK: liquidCv, densityKgPerM3: density,
        bulkModulusPa: 1e8, shearModulusPa: 0, thermalConductivityWPerMK: 0 },
      { name: 'gas', temperatureRange: [400, 1000], cpJPerKgK: gasCv + R / M,
        densityKgPerM3: 3000 * M / (R * 300), bulkModulusPa: null, shearModulusPa: 0,
        thermalConductivityWPerMK: 0 }
    ], transitions: [{ from: 'liquid', to: 'gas', temperatureK: 400, latentHeatJPerKg: 2e6 }] };
    materials.push({ key, id: m.optics.stableOpticalMaterialId(key), molarMassKgPerMol: M,
      liquidCv, gasCv, liquidUAt300: liquidU, liquidDensityKgPerM3: density,
      gasUAt300: liquidU + 3000 / density + 2e6 - R * 300 / M });
  }
  const options = { materialProperties, condensableThermodynamicsByMaterial,
    soundSpeedScale: 1, minGasSoundSpeedMPerS: 0 };
  const thermalMaterialTable = m.thermal.buildSphThermalMaterialTable(materialProperties, options);
  // Closed, adiabatic source test; select emissivity before binding authority.
  for (let i = 4; i < thermalMaterialTable.records.length; i += 8) thermalMaterialTable.records[i] = 0;
  const caloricAuthority = m.caloric.createSphSpatialGasCaloricAuthority({
    thermalMaterialTable, condensableThermodynamicsByMaterial
  });
  const mechanicsMaterialTable = m.mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties, options);
  const reactants = [{ material: 'h2', coefficient: 3, phase: 'gas' },
    { material: 'o2', coefficient: 2, phase: 'gas' }];
  const products = [{ material: 'h2o', coefficient: 2, phase: 'gas' },
    { material: 'h2o2', coefficient: 1, phase: 'gas' }];
  const reactionTable = m.reaction.buildSphReactionTable([{
    a: 'h2', b: 'o2', product: 'h2o', contactRadiusM: .1, activationTemperatureK: 0,
    phaseRequirements: { h2: ['gas'], o2: ['gas'] },
    stoichiometry: { reactants, products, atomBalance: { balanced: true }, chargeBalance: { balanced: true } },
    energyReference: { schema: 'peercompute.ulg.reaction-energy-reference.v1', referenceTemperatureK: 300,
      referencePressurePa: 3000, reactionInternalEnergyChangeJPerMolExtent: -2460,
      reactantPhases: reactants.map((term) => ({ material: term.material, coefficient: term.coefficient, phaseId: 3 })),
      productPhases: products.map((term) => ({ material: term.material, coefficient: term.coefficient, phaseId: 3 })),
      source: { kind: 'manufactured-analytic', provenance: 'conserved all-gas reaction for current-source integration',
        fingerprint: 'current-source-all-gas-v1', provisional: false, phaseApplicable: true } }
  }], { materialProperties, thermalMaterialTable, soundSpeedScale: 1, minGasSoundSpeedMPerS: 0 });
  return { options, materials, thermalMaterialTable, caloricAuthority, mechanicsMaterialTable, reactionTable };
}

function coldParticles(m, cold, epoch = {}) {
  const input = m.state.createSphState({ smoothingLengthM: .1, particles: ['h2', 'o2'].map((material, i) => ({
    material, massKg: i ? .064 : .012, x: [.25 + i * .02, .25, .25], v: [0, 0, 0],
    specificInternalEnergyJPerKg: cold.materials.find((entry) => entry.key === material).gasUAt300,
    phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] }
  })) });
  Object.assign(input, epoch);
  input.step = epoch.physicsTick ?? 0;
  // Same initial lane convention as the production cold demo: live source in
  // its primary slot, three reserved phase slots. Actual phase transfer below
  // moves the pure gas into its declared gas address; no classifier rows or
  // retained thermal/phase output are constructed by this test.
  const capacity = input.particles.length;
  for (let i = 0; i < capacity; i++) Object.assign(input.particles[i], {
    phaseCarrierPrimaryIndex: i, phaseCarrierCompanionIndex: capacity + i,
    phaseCarrierLineageIndex: i, phaseCarrierLane: 0, phaseCarrierTargetPhaseId: 1
  });
  for (let lane = 1; lane < 4; lane++) for (let i = 0; i < capacity; i++) {
    input.particles.push({ ...input.particles[i], id: `reserve-${lane}-${i}`,
      x: [...input.particles[i].x], v: [0, 0, 0], massKg: 0, phaseCompanionSlot: true,
      phaseCarrierLane: lane, phaseCarrierTargetPhaseId: lane + 1,
      phaseVolumeReferenceMassKg: 0, mpmVolume0: 0, visualRestParticleRadiusM: 0 });
  }
  input.phaseCarrierPlan = Object.freeze({ schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
    status: 'phase-lane-capacity-ready', lineageCapacity: capacity, primaryCapacity: capacity,
    phaseLaneCount: 4, phaseLaneStride: capacity, companionStart: capacity,
    companionCapacity: 3 * capacity, particleCapacity: input.particles.length,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true });
  // Publish cold epoch metadata BEFORE uploads capture their private
  // identity/optics owner. Relabeling topology afterward is not admissible.
  return { sph: Object.assign(m.buffers.buildSphGpuParticleBuffers(input, cold.options), epoch),
    mls: Object.assign(m.buffers.buildMlsMpmGpuParticleBuffers(input, cold.options), epoch) };
}

function historyRow(cold, { condensed = false } = {}) {
  const entry = cold.materials.find((material) => material.key === (condensed ? 'h2o' : 'h2o2'));
  const mass = .002, placed = .0005, residual = mass - placed, T = 350, phase = condensed ? 2 : 3;
  const density = condensed ? entry.liquidDensityKgPerM3 : 3000 * entry.molarMassKgPerMol / (R * 300);
  const u = (condensed ? entry.liquidUAt300 : entry.gasUAt300)
    + (condensed ? entry.liquidCv : entry.gasCv) * (T - 300);
  const gamma = (entry.gasCv + R / entry.molarMassKgPerMol) / entry.gasCv;
  return new Float32Array([.3, .25, .25, mass, entry.id, 7, 77, 0, 1,
    mass / entry.molarMassKgPerMol, condensed ? 2 : 1, phase, placed, residual,
    1, entry.molarMassKgPerMol, T, density, 1, u, 0, 0, 0, residual / density,
    condensed ? 1e8 : 0, 0, 0, condensed ? Math.sqrt(1e8 / density)
      : Math.sqrt(gamma * R / entry.molarMassKgPerMol * T), condensed ? 1 : 2, 0, 1, 0]);
}

function serializable(value) {
  if (ArrayBuffer.isView(value)) return [...value];
  if (Array.isArray(value)) return value.map(serializable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => typeof item !== 'function').map(([key, item]) => [key, serializable(item)]));
  return value;
}

export async function runSphPostMechanicsGasStateNative() {
  const m = await loadModules();
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('Native WebGPU adapter unavailable');
  const device = await adapter.requestDevice(m.limits.webGpuDeviceDescriptorForResidentSph(adapter) || {});
  const errors = [], cases = [], buffers = new Set(), recoveryHandles = new Set();
  const recoveryObservations = [];
  const adapterInfo = { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture,
    device: adapter.info?.device, description: adapter.info?.description };
  device.addEventListener('uncapturederror', (event) => errors.push(String(event.error?.message || event.error)));
  for (const scope of ['validation', 'internal', 'out-of-memory']) device.pushErrorScope(scope);
  const make = (label, values) => {
    const result = m.identity.tagWebGpuBufferDevice(device.createBuffer({ label, size: Math.max(4, values.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }), device);
    buffers.add(result); device.queue.writeBuffer(result, 0, values); return result;
  };
  const read = async (buffer, bytes = buffer.size, offset = 0) => {
    const copy = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    let mapped = false;
    try {
      const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, offset, copy, 0, bytes);
      device.queue.submit([encoder.finish()]); await copy.mapAsync(GPUMapMode.READ); mapped = true;
      return copy.getMappedRange().slice(0);
    } finally { if (mapped) copy.unmap(); copy.destroy(); }
  };
  const readTuple = async (sph, mls) => ({
    state: [...new Float32Array(await read(sph.stateBuffer))],
    thermo: [...new Float32Array(await read(sph.thermoBuffer))],
    mechanics: [...new Float32Array(await read(mls.mechanicsBuffer))]
  });
  const rejects = async (action) => {
    try { await action(); return null; } catch (error) {
      if (error.retainedGasState) recoveryHandles.add(error.retainedGasState);
      return { code: error.code || null, message: String(error.message || error),
        controlWords: error.controlWords ? [...error.controlWords] : null,
        cleanupConfirmed: error.cleanupConfirmed ?? null,
        retainedOwner: error.retainedGasState ? { ready: error.retainedGasState.ready,
          status: error.retainedGasState.status } : null };
    }
  };
  let fatalError = null;
  try {
    const cold = coldMaterialInputs(m);
    for (const config of [
      { name: 'thermal-phase-current-source' },
      { name: 'old-and-new-reaction-history', reaction: true },
      { name: 'unsupported-condensed-history', reaction: true, condensed: true },
      { name: 'released-source-read', readOnly: true },
      { name: 'current-source-existing-aerosol-consumer', aerosol: true }
    ]) {
      const run = { name: config.name, reactionEnabled: Boolean(config.reaction), error: null,
        dtSeconds: 1e-5, materials: cold.materials, originalSourcesUnchanged: false,
        closureRetired: false, originalGenerationReleased: false, originalTransactionAborted: false };
      cases.push(run);
      let sph, mls, assignment, generation, transaction, closure, current, directRead, originalHistory;
      let aerosolFamily, aerosolRead, exchangeCandidate;
      const ordinal = cases.length;
      const epoch = { storageGeneration: ordinal, physicsTick: ordinal, physicsSubstep: 0,
        positionEpoch: ordinal, topologyEpoch: ordinal, chartEpoch: 0, levelEpoch: ordinal, supportEpoch: ordinal };
      const initial = coldParticles(m, cold, epoch);
      run.particleCount = initial.sph.particleCount;
      const snapshots = [];
      try {
        sph = m.buffers.uploadSphGpuParticleBuffers(device, initial.sph);
        mls = m.buffers.uploadMlsMpmGpuParticleBuffers(device, initial.mls);
        Object.assign(sph, epoch); Object.assign(mls, epoch);
        if (config.aerosol) {
          const liquid = cold.materials.find((entry) => entry.key === 'h2');
          aerosolFamily = m.parcels.createSphAerosolParcelFamilyWebGpu({ device, capacity: 1,
            provenance: { kind: 'initial-conditions', reference: 'manufactured existing liquid population; no nucleus activation claim' },
            parcels: [{ slot: 0, parcelId: 901n, nucleusPopulationId: 902n, physicalMultiplicity: 1048576n,
              sourceLineageIndex: 0xffffffff, sourceTopologyEpoch: 0, materialId: liquid.id, phaseId: 2,
              massKg: .02, positionM: [.25, .25, .25], velocityMPerS: [-1, .5, .25],
              specificInternalEnergyJPerKg: liquid.liquidUAt300, temperatureK: 300,
              condensedDensityKgM3: liquid.liquidDensityKgPerM3 }] });
          sph.aerosolFamily = aerosolFamily;
          aerosolRead = m.parcels.acquireSphAerosolParcelRead({ family: aerosolFamily, device, expectedGeneration: 0 });
          const originalDestroy = aerosolRead.buffer.destroy.bind(aerosolRead.buffer);
          run.aerosolDestroyCount = 0;
          aerosolRead.buffer.destroy = () => { run.aerosolDestroyCount += 1; originalDestroy(); };
          run.aerosolBefore = [...new Uint32Array(await read(aerosolRead.buffer))];
          snapshots.push({ buffer: aerosolRead.buffer, words: [...run.aerosolBefore] });
        }
        run.epochIdentity = Object.fromEntries(epochFields.map((key) => [key, epoch[key]]));
        run.before = await readTuple(sph, mls);
        run.initialTotalCarrierMassKg = run.before.state.reduce((sum, value, index) => index % 8 === 3 ? sum + value : sum, 0);
        for (const buffer of [sph.stateBuffer, sph.thermoBuffer, mls.mechanicsBuffer]) {
          snapshots.push({ buffer, words: [...new Uint32Array(await read(buffer))] });
        }
        assignment = await m.hierarchy.runSchroederLevelAssignmentWebGpu({ device,
          sphParticleState: initial.sph, mlsMpmParticleState: initial.mls, sphParticleUpload: sph, mlsMpmParticleUpload: mls,
          baseGridSpacingM: 1, minLevel: 0, maxLevel: 0, chartId: 0,
          retainAssignmentBuffer: true, readbackMode: 'no-full-readback' });
        generation = m.spatial.runSchroederSpatialEpochGenerationWebGpu({ device, levelAssignment: assignment,
          particleCount: initial.sph.particleCount, particleIdentityBuffer: sph.identityBuffer,
          particleIdentityStrideWords: sph.identityStrideBytes / 4, selectedLevel: 0,
          mechanicsGrid: { selectedLevel: 0, gridDims: [9, 9, 9], gridNodeCount: 729, gridShift: 2, gridSpacingM: 1 },
          exactNearCellTreeEnabled: false });
        if (!generation.ready) throw new Error('Genuine source SS failed: ' + (generation.reason || generation.status));
        transaction = m.tx.createSchroederSpatialEpochTransaction({ device, generation,
          sphParticleUpload: sph, mlsMpmParticleUpload: mls, requiredReaderIds: [] });
        if (aerosolFamily) {
          // The original transaction already holds the genuine population.
          // Descendants must fork that read, not reopen a retired family.
          run.aerosolRetirementRequested = m.parcels.releaseSphAerosolParcelFamily(aerosolFamily);
          run.rawAerosolReopenRejected = Boolean(await rejects(() => m.parcels.acquireSphAerosolParcelRead({
            family: aerosolFamily, device, expectedGeneration: 0 })));
        }
        let originalRow = null;
        if (config.reaction) {
          originalRow = historyRow(cold, config);
          const rows = new Float32Array(3 * 32); rows.set(originalRow);
          const productEventBuffer = make('current-source-declared-initial-history-' + ordinal, rows);
          // A documented initial reservoir is cold authored input. The real
          // history merger below authors the current GPU-counted output; no
          // fabricated READY count or private output seal is supplied here.
          originalHistory = m.summary.createResidentProductMassHandle({ productEventBuffer,
            productEventDevice: device, productEventBufferRetained: true, productEventBufferByteLength: rows.byteLength,
            productEventRowCount: 3, productEventActiveEventCount: 1,
            destroyProductEventBuffer: () => productEventBuffer.destroy() });
          m.identity.tagResidentProductMassDevice(originalHistory, device);
          snapshots.push({ buffer: productEventBuffer, words: [...new Uint32Array(await read(productEventBuffer))] });
        }
        run.initialResidualGasMassKg = originalRow && originalRow[10] === 1 ? originalRow[13] : 0;
        closure = await m.closure.runMlsMpmPostMechanicsClosureWebGpu({ device,
          sphParticleState: initial.sph, mlsMpmParticleState: initial.mls, sphParticleUpload: sph, mlsMpmParticleUpload: mls,
          postMechanicsParticleBuffers: { stateBuffer: sph.stateBuffer, thermoBuffer: sph.thermoBuffer,
            mechanicsBuffer: mls.mechanicsBuffer, particleCount: initial.sph.particleCount },
          postMechanicsBackend: 'webgpu', thermalMaterialTable: cold.thermalMaterialTable,
          thermalStepOptions: { wallModel: 'adiabatic', wallRate: 0, conductionRate: 0 },
          reactionTable: config.reaction ? cold.reactionTable : null,
          reactionStepOptions: { readCompactReactionSummary: true, readReactionGasSpeciesSummary: false,
            readReactionProductInventory: false, readReactionAtomResidual: false },
          mechanicsMaterialTable: cold.mechanicsMaterialTable,
          boxDimsM: [4, 4, 4], dtSeconds: run.dtSeconds, preferWebGpu: true, readbackMode: 'no-full-readback',
          schroederSpatialEpochGeneration: generation, schroederSpatialEpochTransaction: transaction,
          expectedEpochIdentity: epoch, captureGasSource: true, gasSourceLevelAssignment: assignment,
          inputResidentProductMass: originalHistory, residentProductMassMergeRunner: m.step.mergeResidentProductMassBuffersWebGpu });
        const stage = (value) => value?.result || value;
        run.closure = { status: closure.status, executedStageOrder: [...closure.executedStageOrder],
          fullParticleReadbackPerformed: closure.fullParticleReadbackPerformed,
          stageBackends: { thermal: stage(closure.thermalStep)?.backend,
            reaction: stage(closure.reactionStep)?.backend ?? null,
            phase: stage(closure.phaseCarrierTransferStep)?.backend,
            refresh: stage(closure.mechanicsRefreshStep)?.backend } };
        if (config.readOnly) {
          directRead = m.closure.acquireMlsMpmPostMechanicsGasSourceRead(closure, { device });
          const packet = m.closure.resolveMlsMpmPostMechanicsGasSourceRead(directRead, { device });
          run.copiedReadRejected = Boolean(await rejects(() =>
            m.closure.resolveMlsMpmPostMechanicsGasSourceRead({ ...directRead }, { device })));
          run.readUsesFinalTuple = packet.stateBuffer === closure.continuation.stateBuffer
            && packet.thermoBuffer === closure.continuation.thermoBuffer
            && packet.mechanicsBuffer === closure.continuation.mechanicsBuffer;
          const release = m.closure.releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(directRead, { device });
          run.releasedReadRejected = Boolean(await rejects(() =>
            m.closure.resolveMlsMpmPostMechanicsGasSourceRead(directRead, { device })));
          run.readReleased = await release;
          run.reacquireRejected = Boolean(await rejects(() =>
            m.closure.acquireMlsMpmPostMechanicsGasSourceRead(closure, { device })));
          continue;
        }
        const currentOptions = { device, closure, caloricAuthority: cold.caloricAuthority,
          caloricThermalMaterialTable: cold.thermalMaterialTable, speciesDiagnostics: null, diagnosticsMode: 'none' };
        run.copiedClosureRejection = await rejects(() => m.current.runSphPostMechanicsGasStateWebGpu({
          ...currentOptions, closure: { ...closure } }));
        run.copiedClosureRejected = Boolean(run.copiedClosureRejection);
        sph.physicsTick += 1;
        try { run.staleSourceRejection = await rejects(() => m.current.runSphPostMechanicsGasStateWebGpu(currentOptions)); }
        finally { sph.physicsTick -= 1; }
        run.staleOriginalSourceRejected = Boolean(run.staleSourceRejection);
        const final = closure.continuation;
        run.final = await readTuple({ stateBuffer: final.stateBuffer, thermoBuffer: final.thermoBuffer },
          { mechanicsBuffer: final.mechanicsBuffer });
        run.sourceIdentity = { finalStateDiffers: final.stateBuffer !== sph.stateBuffer,
          finalThermoDiffers: final.thermoBuffer !== sph.thermoBuffer,
          finalMechanicsDiffers: final.mechanicsBuffer !== mls.mechanicsBuffer };
        const resident = closure.residentProductMass;
        const descriptor = resident ? m.history.productEventLiveCountCopyDescriptor(resident, device) : null;
        const countWords = descriptor ? [...new Uint32Array(await read(descriptor.buffer,
          descriptor.controlPrefixByteLength, descriptor.controlOffsetBytes))] : [];
        const liveRowCount = countWords[3] || 0;
        if (resident && (!descriptor || liveRowCount > descriptor.rowCapacity)) {
          throw new Error('Current history lacks an authentic bounded live prefix');
        }
        const mergedBytes = resident && liveRowCount > 0
          ? await read(resident.productEventBuffer, liveRowCount * 32 * 4) : new ArrayBuffer(0);
        const rows = [...new Float32Array(mergedBytes)], mergedWords = [...new Uint32Array(mergedBytes)];
        const emitted = stage(closure.reactionStep)?.reactionSummary?.productEventBuffer;
        const emittedBytes = emitted ? await read(emitted) : new ArrayBuffer(0);
        const emittedRows = [...new Float32Array(emittedBytes)];
        // Observe the exact input buffer, not reconstructed JS values. The
        // filtered-append ABI preserves every vec4 of each positive residual
        // row in stable old-then-new order; it does not normalize its payload.
        const originalWords = originalHistory
          ? snapshots.find((snapshot) => snapshot.buffer === originalHistory.productEventBuffer).words : [];
        run.history = { rows, mergedWords, originalWords, emittedWords: [...new Uint32Array(emittedBytes)],
          mergePayloadPolicy: 'stable-old-then-new-positive-residual-full32-word-copy',
          countWords, liveRowCount, liveCountAuthorityPresent: Boolean(descriptor),
          countDescriptor: descriptor ? { generation: descriptor.expectedGeneration, seal: descriptor.expectedSeal,
            magic: descriptor.expectedMagic, version: descriptor.expectedVersion,
            readyStatus: descriptor.expectedReadyStatus, rowCapacity: descriptor.expectedRowCapacity } : null,
          distinctMergedBuffer: Boolean(resident && originalHistory
            && resident.productEventBuffer !== originalHistory.productEventBuffer && resident.productEventBuffer !== emitted),
          emittedPositiveRows: emittedRows.filter((value, index) => index % 32 === 13 && value > 0).length };
        const currentError = await rejects(async () => {
          current = await m.current.runSphPostMechanicsGasStateWebGpu(currentOptions);
          if (!current.ready) return;
          const oracle = await m.eos.observeSphSpatialGasLedgerEosOracle(current.gasEos);
          run.oracle = serializable(oracle);
        });
        if (config.condensed) {
          run.usableEosRejected = Boolean(currentError || current?.ready !== true || !run.oracle);
          run.rejection = currentError || { status: current?.status, reason: current?.reason };
          run.rejectionControlWords = currentError?.controlWords || current?.controlWords || null;
        } else {
          if (currentError) throw new Error('Current-source integration: ' + JSON.stringify(currentError));
          run.current = { ready: current.ready, status: current.status, dtSeconds: current.dtSeconds,
            epochIdentity: current.epochIdentity, sourceStage: current.sourceStage,
            kineticsAdmitted: current.kineticsAdmitted, outerPublicationAdmitted: current.outerPublicationAdmitted };
          Object.assign(run.sourceIdentity, {
            freshAssignment: current.levelAssignment !== assignment,
            freshGeneration: current.spatialGeneration !== generation,
            assignmentUsesFinalState: current.levelAssignment.sourceStateBuffer === final.stateBuffer,
            assignmentUsesFinalThermo: current.levelAssignment.sourceThermoBuffer === final.thermoBuffer,
            assignmentUsesFinalMechanics: current.levelAssignment.sourceMechanicsBuffer === final.mechanicsBuffer,
            assignmentNotOriginalState: current.levelAssignment.sourceStateBuffer !== assignment.sourceStateBuffer,
            completeHistoryMatches: current.completeHistory === resident });
          if (aerosolFamily) {
            const gas = run.oracle.compactRows.find((row) => row.sourceKind === 'particle'
              && row.materialId === cold.materials.find((entry) => entry.key === 'h2').id);
            if (!gas) throw new Error('Fresh current EOS lost the actual H2 gas source');
            const surfaceModels = { h2: { schema: 'peercompute.ulg.linear-pure-interface.v1',
              provenance: 'manufactured nonzero interface; prescribed conservative integration test',
              interceptNPerM: .2, slopeNPerMK: -.0002, minTemperatureK: 200, maxTemperatureK: 500 } };
            const materialRows = m.caloric.resolveSphSpatialGasExchangeMaterials(cold.caloricAuthority,
              { thermalMaterialTable: cold.thermalMaterialTable, surfaceModels });
            const edge = { gasKind: 0, gasIndex: gas.sourceRowIndex, parcelIndex: 0,
              materialRow: materialRows.materials.indexOf('h2'), deltaMassKg: 1 / 65536,
              transportEnthalpyCorrectionJ: 0, conductiveHeatJ: 0, pressureWorkIntoLiquidJ: 0 };
            exchangeCandidate = await m.eos.runSphSpatialVaporAerosolExchangeCandidate(current.gasEos,
              { surfaceModels, edges: [edge] });
            run.exchange = { edge, candidate: serializable(exchangeCandidate),
              result: exchangeCandidate.ready ? serializable(await m.eos.observeSphSpatialVaporAerosolExchangeCandidate(exchangeCandidate)) : null,
              sourceStage: current.sourceStage, kineticsAdmitted: false, exchangeIntervalAdmitted: false,
              outerPublicationAdmitted: false, originalParcelOwnerStillHeld: run.aerosolDestroyCount === 0 };
            const after = await readTuple({ stateBuffer: final.stateBuffer, thermoBuffer: final.thermoBuffer },
              { mechanicsBuffer: final.mechanicsBuffer });
            run.exchange.sourceUnchanged = ['state', 'thermo', 'mechanics'].every((key) =>
              after[key].every((value, index) => Object.is(value, run.final[key][index])))
              && [...new Uint32Array(await read(aerosolRead.buffer))].every((value, index) => value === run.aerosolBefore[index]);
          }
        }
      } catch (error) { run.error = String(error?.stack || error); }
      finally {
        try {
          if (exchangeCandidate?.ready) {
            run.exchange.candidateReleased = await m.eos.releaseSphSpatialVaporAerosolExchangeCandidate(exchangeCandidate);
          }
          if (current) {
            run.currentReleased = await m.current.releaseSphPostMechanicsGasStateAfterQueue(current, { device });
            if (run.currentReleased !== true) {
              recoveryHandles.add(current);
              run.cleanupQuarantined = true;
              throw new Error('Current gas owner did not confirm its own final consumer release');
            }
          }
          for (const handle of [...recoveryHandles]) {
            const released = await m.current.releaseSphPostMechanicsGasStateAfterQueue(handle, { device });
            recoveryObservations.push({ case: run.name, status: handle.status, released, deviceLost: false });
            if (released === true) recoveryHandles.delete(handle);
            else {
              run.cleanupQuarantined = true;
              throw new Error('Failed current gas construction retained an unconfirmed child; source cleanup quarantined');
            }
          }
          if (directRead) await m.closure.releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(directRead, { device });
          await device.queue.onSubmittedWorkDone();
          run.originalSourcesUnchanged = true;
          for (const snapshot of snapshots) {
            const words = [...new Uint32Array(await read(snapshot.buffer))];
            if (words.length !== snapshot.words.length || words.some((value, index) => value !== snapshot.words[index])) {
              run.originalSourcesUnchanged = false;
            }
          }
          if (closure) {
            const receipt = await m.closure.retireMlsMpmPostMechanicsClosureOutputsAfter(closure,
              { abandon: true, after: device.queue.onSubmittedWorkDone().then(() => true) });
            run.closureRetirementReceipt = { status: receipt?.status, abandoned: receipt?.abandoned,
              destroyedBufferCount: receipt?.destroyedBufferCount, preservedBufferCount: receipt?.preservedBufferCount,
              ownerFamilyCount: receipt?.ownerFamilyCount };
            run.closureRetired = receipt?.status === 'post-mechanics-closure-abandoned'
              && receipt?.abandoned === true;
          }
          if (transaction) {
            run.originalTransactionAborted = m.tx.abortSchroederSpatialEpochTransaction(transaction,
              'native current source read finished without publication');
            const summary = m.tx.summarizeSchroederSpatialEpochTransaction(transaction);
            run.originalTransactionSummary = { state: summary.state, commitPublished: summary.commitPublished,
              commitStatus: summary.commitStatus, counters: summary.counters, abortReason: summary.abortReason };
            run.abortedBindingReadRejected = Boolean(await rejects(() => m.binding.acquireSphAerosolSpatialParcelRead({
              device, transaction, generation, family: aerosolFamily ?? null })));
          }
          if (generation) {
            m.spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
            run.originalGenerationReleased = await generation.releasePromise;
          }
          // ABORTED is already the transaction's real terminal transition and
          // releases its aerosol capture. Its SS allocation still has a
          // separate genuine queue-owner retirement above. Do not fabricate a
          // committed/private-advanced transaction just to schedule release.
          if (aerosolRead) {
            run.aerosolSurvivedCurrentOwners = run.aerosolDestroyCount === 0
              && m.parcels.validateSphAerosolParcelRead(aerosolRead,
                { family: aerosolFamily, device, expectedGeneration: 0 });
            run.monitorAerosolReadReleased = m.parcels.releaseSphAerosolParcelRead(aerosolRead);
            if (!run.aerosolRetirementRequested) m.parcels.releaseSphAerosolParcelFamily(aerosolFamily);
            await device.queue.onSubmittedWorkDone();
            await Promise.resolve();
            await device.queue.onSubmittedWorkDone();
          }
          assignment?.destroyAssignmentBuffer?.();
          await originalHistory?.destroyResidentProductMassBuffers?.();
          if (mls) m.buffers.destroyMlsMpmGpuParticleBuffers(mls);
          if (sph) m.buffers.destroySphGpuParticleBuffers(sph);
        } catch (error) { run.error ||= 'cleanup: ' + String(error?.stack || error); }
      }
      if (run.cleanupQuarantined) throw new Error('Stopping native cases for unconfirmed current gas owner cleanup');
    }
  } catch (error) { fatalError = String(error?.stack || error); }
  finally {
    try { await device.queue.onSubmittedWorkDone(); } catch (error) { errors.push(String(error)); }
    for (const scope of ['out-of-memory', 'internal', 'validation']) {
      const error = await device.popErrorScope(); if (error) errors.push(scope + ': ' + error.message);
    }
    // Confirmed loss is the recovery boundary for an owner whose queue cleanup
    // remained uncertain. Keep its exact branded object until this point; do
    // not claim the original closure/transaction was successfully retired.
    device.destroy();
    for (const handle of recoveryHandles) {
      const released = await m.current.releaseSphPostMechanicsGasStateAfterQueue(handle, { device });
      recoveryObservations.push({ status: handle.status, released, deviceLost: true });
    }
    for (const buffer of buffers) buffer.destroy();
  }
  return { moduleUrls: m.moduleUrls, adapterInfo, cases, errors, fatalError, recoveryObservations };
}
