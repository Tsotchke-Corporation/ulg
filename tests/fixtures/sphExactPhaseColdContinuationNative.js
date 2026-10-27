import { preloadExactMassContinuationNative } from './sphExactMassContinuationNative.js';
import { createSphExactMassFormat, encodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

// A real cold upload, two complete hierarchy/resident steps, and ownership
// retirement between them. No raw hot-buffer registration or producer stubs.
export async function runExactPhaseColdContinuationNative(device, { gasPressure = false } = {}) {
  const { steps, buffers, thermal, mechanics, materials, energy, hierarchy, spatial } = await preloadExactMassContinuationNative();
  const format = createSphExactMassFormat({ wordCount: 9, quantumExponent: -149 });
  const material = gasPressure ? 'n2' : 'fe';
  const closures = materials.createReferenceMaterialClosures();
  const { withRoomAirCaloricReference } = await import('../../src/runtime/material/roomAirCaloricReference.js');
  const { createReferenceAnchoredMaterialClosure } = await import('../../src/runtime/material/materialDerivation.js');
  const materialProperties = { [material]: (gasPressure
    ? withRoomAirCaloricReference(createReferenceAnchoredMaterialClosure(material), material) : closures[material]).properties };
  const mass = .001 * (1 + 2 ** -30);
  const particle = { id: 'phase-origin', material, initialBodyDomainId: 1, initialBodyId: 'phase-origin',
    massKg: mass, x: [1, 1, 1], v: [0, 0, 0],
    specificInternalEnergyJPerKg: gasPressure
      ? materialProperties.n2.phaseCaloricModel.referenceSpecificInternalEnergyJPerKg
      : energy.specificInternalEnergyJPerKg(materialProperties.fe, 2000),
    ...(gasPressure ? { temperatureK: 293.15, phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] } } : {}) };
  const particles = [particle, ...[1, 2, 3].map(lane => ({ ...particle, id: `phase-companion-${lane}`,
    x: [...particle.x], v: [0, 0, 0], massKg: 0, phaseCompanionSlot: true,
    phaseCarrierPrimaryIndex: 0, phaseCarrierLineageIndex: 0, phaseCarrierLane: lane,
    phaseCarrierTargetPhaseId: lane + 1, phaseVolumeReferenceMassKg: 0, mpmVolume0: 0, visualRestParticleRadiusM: 0 }))];
  const initial = { particles, smoothingLengthM: .5, dimension: 3, step: 0, time: 0, storageGeneration: 1,
    phaseCarrierPlan: { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
      lineageCapacity: 1, primaryCapacity: 1, phaseLaneCount: 4, phaseLaneStride: 1,
      companionStart: 1, companionCapacity: 3, particleCapacity: 4 } };
  let packed = buffers.buildSphGpuParticleBuffers(initial, { materialProperties, exactMass: { format, reference: 'native exact phase cold continuation' } });
  let mls = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties, particleSeparationRelaxation: 0, soundSpeedScale: .01 });
  let upload = buffers.uploadSphGpuParticleBuffers(device, packed), mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, mls);
  const table = thermal.buildSphThermalMaterialTable(materialProperties);
  for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
  const mechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties);
  const read = async buffer => { const copy = device.createBuffer({ size: buffer.size, usage: 9 });
    try { const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
      device.queue.submit([encoder.finish()]); await copy.mapAsync(1); const words = new Uint32Array(copy.getMappedRange().slice(0)); copy.unmap(); return words;
    } finally { copy.destroy(); } };
  const integer = words => Array.from(words).reduceRight((value, word) => (value << 32n) | BigInt(word), 0n);
  const expectedMass = integer(encodeSphExactMass(mass, format));
  const energyBits = new Uint32Array(packed.state.buffer, packed.state.byteOffset, packed.state.length)[7];
  const energyEncodedExponent = (energyBits >>> 23) & 255;
  const expectedEnergyNumerator = expectedMass * BigInt((energyBits & 0x7fffff) | (energyEncodedExponent ? 0x800000 : 0))
    * ((energyBits & 0x80000000) ? -1n : 1n);
  const expectedEnergyExponent = format.quantumExponent + (energyEncodedExponent ? energyEncodedExponent - 150 : -149);
  let family = null, lease = null, assignment = null, step = null;
  const runs = [];
  const recorder = { active: true, async measureQueueStage(meta, work) {
    console.log('phase-cold-stage ' + meta.stage);
    const result = await work(); console.log('phase-cold-finished ' + meta.stage); return result;
  } };
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      if (family) lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
      const oldMassFamily = upload.exactMassInventory;
      const execution = await hierarchy.runSchroederSameLevelMechanicsWebGpu({ device,
        gpuTimestampRecorder: recorder,
        sphParticleState: packed, mlsMpmParticleState: mls, sphParticleUpload: upload, mlsMpmParticleUpload: mlsUpload,
        levelAssignment: assignment, levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
        selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5, boxDimsM: [2, 2, 2],
        dt: .000001, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
        enableTwoLevelMechanics: false, enableCrossLevelCoupling: false, enableLawQueue: false, enableLawNeighborCandidates: false,
        enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
        residentStepOptions: { thermalMaterialTable: table, mechanicsMaterialTable: mechanicsTable,
          gpuTimestampRecorder: recorder,
          thermalStepOptions: { conductionRate: 0, wallRate: 0 }, internalPressureScale: gasPressure ? 1 : 0,
          fuseNoFullResidentMechanics: false, gasPressureMechanicsBoundaryEnabled: gasPressure,
          particleGasLedgerActionable: gasPressure, summaryRunner: null } });
      step = execution.residentStep; const next = step.nextParticleUploads;
      const held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, device, { mlsMpmParticleUpload: next.mlsMpmParticleUpload });
      try {
        const phase = step.exactMassPostMechanicsClosure.phaseCarrierTransferStep;
        const validation = Array.from(await read(phase.exactValidationBuffer));
        const quantities = await read(held.quantities.quantityBuffer), layout = held.quantities.quantityLayout;
        const massRows = Array.from({ length: 4 }, (_, row) => integer(quantities.slice(row * layout.recordWords + 16,
          row * layout.recordWords + 16 + format.wordCount)));
        const physical = new Float32Array((await read(next.sphParticleUpload.stateBuffer)).buffer);
        const thermo = new Float32Array((await read(next.sphParticleUpload.thermoBuffer)).buffer);
        const destinationLane = gasPressure ? 2 : 1;
        const energyAt = destinationLane * layout.recordWords + layout.scalarOffsetWords + 3 * layout.scalar.recordWords;
        const actualEnergyNumerator = integer(quantities.slice(energyAt + 4, energyAt + 4 + layout.scalar.wordCount)) * (quantities[energyAt] ? -1n : 1n);
        const actualEnergyDenominator = integer(quantities.slice(energyAt + 4 + layout.scalar.wordCount, energyAt + layout.scalar.recordWords));
        const exponentDifference = (quantities[energyAt + 2] | 0) - expectedEnergyExponent;
        const energyConserved = !quantities[energyAt + 1] && actualEnergyDenominator > 0n && (exponentDifference >= 0
          ? (actualEnergyNumerator << BigInt(exponentDifference)) === expectedEnergyNumerator * actualEnergyDenominator
          : actualEnergyNumerator === (expectedEnergyNumerator * actualEnergyDenominator << BigInt(-exponentDifference)));
        const momentumConserved = [0, 1, 2, 3].every(row => [0, 1, 2].every(field => {
          const at = row * layout.recordWords + layout.scalarOffsetWords + field * layout.scalar.recordWords;
          return !quantities[at + 1] && quantities.slice(at + 4, at + 4 + layout.scalar.wordCount).every(word => word === 0);
        }));
        const checks = { completeStep: true, accepted: validation[0] === 0,
          mass: massRows.reduce((a, b) => a + b, 0n) === expectedMass,
          energyConserved, momentumConserved,
          targetLane: massRows.every((value, lane) => value === (lane === destinationLane ? expectedMass : 0n))
            && physical[3] === 0 && physical[destinationLane * 8 + 3] > 0 && thermo[destinationLane * 12 + 1] === destinationLane + 1,
          ...(gasPressure ? { pressureSubmitted: step.gasPressureMechanicsBoundary?.submitted === true,
            pressureAuthenticated: step.gasPressureMechanicsBoundary?.sourceDeviceAuthenticated === true,
            pressureReadbackFree: step.gasPressureMechanicsBoundary?.normalHotLoopReadbackFree === true } : {}),
          successorInventory: held.read.family !== oldMassFamily, successorQuantities: layout.rowCount === 4 };
        const diagnostics = gasPressure ? {
          initialState: Array.from(packed.state),
          beforePhase: Array.from(new Float32Array((await read(step.exactMassPostMechanicsClosure.phaseCarrierTransferFamilyReceipt.preTransferStateBuffer)).buffer)),
          afterPhase: Array.from(new Float32Array((await read(phase.stateBuffer)).buffer)),
          finalState: Array.from(physical),
          pressure: step.gasPressureMechanicsBoundary,
          quantityWords: Array.from(quantities.slice(destinationLane * layout.recordWords,
            (destinationLane + 1) * layout.recordWords)), quantityLayout: layout, format
        } : null;
        runs.push({ cycle, checks, validation, diagnostics, pass: Object.values(checks).every(Boolean) });
        console.log('phase-cold-progress ' + JSON.stringify(runs.at(-1)));
        if (!runs.at(-1).pass) return { runs, pass: false };
      } finally { await buffers.releaseSphParticleExactMassRead(held); }
      const nextPacked = steps.cloneSphParticleStateForNext(packed, step), nextMls = steps.cloneMlsMpmParticleStateForNext(mls, step);
      await device.queue.onSubmittedWorkDone();
      if (family) { spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device }); lease = null;
        await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device }); }
      steps.destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: steps.retainedContinuationBuffersFromUploads(next) }); step = null;
      buffers.destroySphGpuParticleBuffers(upload); buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
      upload = next.sphParticleUpload; mlsUpload = next.mlsMpmParticleUpload; packed = nextPacked; mls = nextMls;
      family = next.schroederSpatialSuccessorSourceFamily; assignment = next.schroederSpatialSuccessorLevelAssignment;
    }
    return { runs, pass: runs.length === 2 && runs.every(run => run.pass) };
  } finally {
    if (family) { if (lease) spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device });
      await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device }); }
    if (step) steps.destroyMlsMpmResidentStepBuffers(step);
    buffers.destroySphGpuParticleBuffers(upload); buffers.destroyMlsMpmGpuParticleBuffers(mlsUpload);
  }
}
