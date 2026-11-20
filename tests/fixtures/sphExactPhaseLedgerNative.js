import { preloadExactMassContinuationNative } from './sphExactMassContinuationNative.js';
import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

// G2 Phase 2 gate (plan/todo/g2-integer-ledger-proposal.md): H2O lineages in
// one solid body melt and boil on the integer energy ledger. Ice and water
// carriers sit in a 600 K wall layer and conduct to each other; every step
// runs ledger thermal, the f32 phase split and its exact reconcile. One body
// means no contact heat, which is not yet ledgered. Returns raw rows; the
// caller checks them on the host.
export async function runExactPhaseLedgerNative(device, { cycles = 6, wallTemperatureK = 600, exact = true, debug = false } = {}) {
  const { steps, buffers, thermal, mechanics, materials, energy, hierarchy, spatial } = await preloadExactMassContinuationNative();
  const format = createSphExactMassFormat();
  const h2o = materials.createReferenceMaterialClosures().h2o.properties;
  // The reference closure carries no phase conductivity; declare one.
  const conductivity = { solid: 2.2, liquid: 0.6, gas: 0.025 };
  const materialProperties = { h2o: { ...h2o,
    phases: h2o.phases.map(phase => ({ ...phase, thermalConductivityWPerMK: conductivity[phase.name] })) } };
  const seeds = [272, 372, 272, 372.5];
  const lineages = seeds.length;
  const primaries = seeds.map((temperatureK, l) => ({ id: `ledger-${l}`, material: 'h2o',
    initialBodyDomainId: 1, initialBodyId: 'ledger-body', massKg: 0.001,
    x: [0.3 + 0.004 * (l & 1), 1 + 0.004 * (l >> 1), 1], v: [0, 0, 0],
    specificInternalEnergyJPerKg: energy.specificInternalEnergyJPerKg(materialProperties.h2o, temperatureK) }));
  const companions = [1, 2, 3].flatMap(lane => primaries.map((primary, l) => ({ ...primary, id: `ledger-${l}-lane-${lane}`,
    x: [...primary.x], massKg: 0, phaseCompanionSlot: true, phaseCarrierPrimaryIndex: l, phaseCarrierLineageIndex: l,
    phaseCarrierLane: lane, phaseCarrierTargetPhaseId: lane + 1, phaseVolumeReferenceMassKg: 0, mpmVolume0: 0,
    visualRestParticleRadiusM: 0 })));
  const initial = { particles: [...primaries, ...companions], smoothingLengthM: .5, dimension: 3, step: 0, time: 0,
    storageGeneration: 1, phaseCarrierPlan: { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
      status: 'phase-lane-capacity-ready', lineageCapacity: lineages, primaryCapacity: lineages, phaseLaneCount: 4,
      phaseLaneStride: lineages, companionStart: lineages, companionCapacity: 3 * lineages, particleCapacity: 4 * lineages } };
  // exact: false runs the same scene on the plain f32 route, for comparison.
  let packed = buffers.buildSphGpuParticleBuffers(initial, { materialProperties,
    ...(exact ? { exactMass: { format, reference: 'native exact phase ledger gate' } } : {}) });
  let mls = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties, particleSeparationRelaxation: 0, soundSpeedScale: .01 });
  let upload = buffers.uploadSphGpuParticleBuffers(device, packed), mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, mls);
  const table = thermal.buildSphThermalMaterialTable(materialProperties);
  for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
  const mechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties);
  const read = async (buffer, offset = 0, size = buffer.size) => {
    const copy = device.createBuffer({ size, usage: 9 });
    try { const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, offset, copy, 0, size);
      device.queue.submit([encoder.finish()]); await copy.mapAsync(1); const words = Array.from(new Uint32Array(copy.getMappedRange().slice(0))); copy.unmap(); return words;
    } finally { copy.destroy(); } };
  const snapshot = async () => {
    if (!exact) return { mass: null, energy: null, state: await read(upload.stateBuffer), thermo: await read(upload.thermoBuffer) };
    const held = buffers.acquireSphParticleExactMassRead(upload, device);
    try {
      return { mass: await read(held.read.buffer, held.read.byteOffset, held.read.byteLength),
        energy: held.energy ? await read(held.energy.energyBuffer) : null,
        state: await read(upload.stateBuffer), thermo: await read(upload.thermoBuffer) };
    } finally { await buffers.releaseSphParticleExactMassRead(held); }
  };
  const result = { lineages, rows: 4 * lineages, initial: await snapshot(), cycles: [] };
  let family = null, lease = null, assignment = null, step = null;
  try {
    for (let cycle = 0; cycle < cycles; cycle++) {
      if (family) lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
      let observedProposal = null;
      const execution = await hierarchy.runSchroederSameLevelMechanicsWebGpu({ device,
        sphParticleState: packed, mlsMpmParticleState: mls, sphParticleUpload: upload, mlsMpmParticleUpload: mlsUpload,
        levelAssignment: assignment, levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
        selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5, boxDimsM: [2, 2, 2],
        dt: .001, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
        enableTwoLevelMechanics: false, enableCrossLevelCoupling: false, enableLawQueue: false, enableLawNeighborCandidates: false,
        enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
        residentStepOptions: { thermalMaterialTable: table, mechanicsMaterialTable: mechanicsTable,
          thermalStepOptions: { wallTemperaturesK: { xMin: wallTemperatureK }, wallLayerM: .5, wallRate: 2600 },
          internalPressureScale: 0, fuseNoFullResidentMechanics: false, gasPressureMechanicsBoundaryEnabled: false,
          particleGasLedgerActionable: false, summaryRunner: null,
          spatialThermalProposalObserver: proposal => { observedProposal = proposal; } } });
      step = execution.residentStep;
      const next = step.nextParticleUploads;
      const phase = step.exactMassPostMechanicsClosure?.phaseCarrierTransferStep ?? null;
      await device.queue.onSubmittedWorkDone();
      const thermalOut = debug && step.exactMassPostMechanicsClosure?.thermalStep?.thermoBuffer
        ? { state: await read(step.exactMassPostMechanicsClosure.thermalStep.stateBuffer),
          thermo: await read(step.exactMassPostMechanicsClosure.thermalStep.thermoBuffer) } : null;
      const proposalDiagnostics = observedProposal ? { ledgerWords: observedProposal.exactEnergyLedgerWords,
        header: await read(observedProposal.proposalBuffer, 0, 64),
        conductionEvidence: observedProposal.conductionEvidenceBuffer
          ? await read(observedProposal.conductionEvidenceBuffer, 0, 64) : null } : null;
      const nextPacked = steps.cloneSphParticleStateForNext(packed, step), nextMls = steps.cloneMlsMpmParticleStateForNext(mls, step);
      await device.queue.onSubmittedWorkDone();
      if (family) { spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device }); lease = null;
        await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device }); }
      steps.destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: steps.retainedContinuationBuffersFromUploads(next) }); step = null;
      buffers.destroySphGpuParticleBuffers(upload); buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
      upload = next.sphParticleUpload; mlsUpload = next.mlsMpmParticleUpload; packed = nextPacked; mls = nextMls;
      family = next.schroederSpatialSuccessorSourceFamily; assignment = next.schroederSpatialSuccessorLevelAssignment;
      result.cycles.push({ phaseTransferRan: Boolean(phase), proposalDiagnostics, thermalOut, ...(await snapshot()) });
    }
    return result;
  } finally {
    if (family) { if (lease) spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device });
      await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device }); }
    if (step) steps.destroyMlsMpmResidentStepBuffers(step);
    buffers.destroySphGpuParticleBuffers(upload); buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
  }
}
