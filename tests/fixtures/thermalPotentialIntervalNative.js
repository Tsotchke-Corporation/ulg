import * as potential from '../../src/runtime/material/thermalPotentialGpu.js';
import * as thermal from '../../src/runtime/sph/sphThermalGpuKernel.js';
import * as buffers from '../../src/runtime/sph/sphGpuBuffers.js';
import * as steps from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import * as hierarchy from '../../src/runtime/sph/schroederHierarchyGpu.js';
import * as spatial from '../../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import * as mechanics from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import * as thermo from '../../src/runtime/material/condensableThermodynamics.js';
import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createExtendedPhaseCaloricFixture } from './sphExtendedPhaseCaloric.js';
import { thermalPotentialIntervalReceipt, thermalPotentialAdoptionReceipt } from './thermalPotentialIntervalReceipt.js';
import { StateManager } from '../../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';
import { createResidentStateManagerCommitHandler, validateResidentStepsCommitDelta } from '../../src/runtime/peercomputeResidentCommitBridge.js';

const check = (condition, message) => { if (!condition) throw new Error(message); };

export async function runThermalPotentialIntervalNative({ wall = false, reverse = false } = {}) {
  let adapter;
  for (let i = 0; i < 5 && !adapter; i++) {
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) await new Promise(resolve => setTimeout(resolve, 300));
  }
  check(adapter, 'WebGPU adapter unavailable');
  const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 16 } });
  const errors = [];device.addEventListener('uncapturederror', event => { if (errors.length < 20) errors.push(event.error.message); });
  device.pushErrorScope('validation');
  const manager = new StateManager(null, { enablePersistence: false, disableBroadcast: true, disableNetworkProvider: true });
  await manager.initialize();
  const ledger = manager.createReservationLedger({ name: 'g6-interval', maxKeys: 3 });
  const properties = createExtendedPhaseCaloricFixture(thermo).materialProperties;
  for (const phase of properties['three-phase'].phases) phase.thermalConductivityWPerMK = 8000;
  const table = thermal.buildSphThermalMaterialTable(properties);
  // Manufactured adiabatic experiment: isolate conduction from radiation.
  for (let i = 4; i < table.records.length; i += 8) table.records[i] = 0;
  const graphs = thermal.buildSphThermalClosureGraphBuffers(table);
  const graph = graphs.graphBank.graphRecords.findIndex(row => row.phaseFromId === 2 && row.phaseToId === 2);
  check(graph >= 0, 'Liquid graph required');
  const upload = thermal.uploadSphThermalResponseGraphBuffers(device, { thermalMaterialTable: table, thermalClosureGraphSet: graphs });
  const cache = potential.createThermalPotentialGpu(device, { thermalResponseGraphUpload: upload, reservationLedger: ledger });
  const format = createSphExactMassFormat();
  const mechanicsTable = mechanics.buildMlsMpmMechanicsMaterialTable(properties);
  const snapshots = [];
  const copySnapshot = (source, before, after) => {
    const encoder = device.createCommandEncoder();const out = {};
    for (const [key, buffer] of Object.entries({ stateBuffer: source.stateBuffer, thermoBuffer: source.thermoBuffer,
      beforeEnergy: before.energy.energyBuffer, afterEnergy: after.energy.energyBuffer })) {
      out[key] = device.createBuffer({ size: buffer.size, usage: 128 | 4 | 8 });
      encoder.copyBufferToBuffer(buffer, 0, out[key], 0, buffer.size);
    }
    device.queue.submit([encoder.finish()]);snapshots.push(out);return out;
  };
  const run = async enabled => {
    const n = graphs.graphBank.nodeRows;
    const initial = { smoothingLengthM: .02, dimension: 3, step: 0, time: 0, storageGeneration: 1,
      particles: (reverse ? [.55, .45] : [.45, .55]).map((q, i) => ({ id: `thermal-${i}`, material: 'three-phase',
        massKg: .001 * (reverse && i === 0 ? 3 : 1) * (1 + 2 ** -30),
        x: [.1 + i * .01, wall ? .0075 : .1, .1], v: [0, 0, 0],
        specificInternalEnergyJPerKg: n[graph * 16 + 6] + q * (n[graph * 16 + 7] - n[graph * 16 + 6]) })) };
    let packed = buffers.buildSphGpuParticleBuffers(initial, { materialProperties: properties,
      exactMass: { format, reference: 'Manufactured G6 conduction interval' } });
    let packedMls = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties: properties, particleSeparationRelaxation: 0 });
    let sph = buffers.uploadSphGpuParticleBuffers(device, packed);
    let mls = buffers.uploadMlsMpmGpuParticleBuffers(device, packedMls);
    let family = null, lease = null, assignment = null, step = null;
    const rows = [], ordinals = [], commits = [], adoption = [], negativeControls = [];
    const counters = device.createBuffer({ size: 16, usage: 128 | 4 | 8 });
    try {
      for (let cycle = 1; cycle <= 3; cycle++) {
        const before = buffers.acquireSphParticleExactMassRead(sph, device);
        const binding = potential.thermalPotentialGpuBindings(cache, device, upload);
        ordinals.push(binding.ordinal);
        const encoder = device.createCommandEncoder();encoder.copyBufferToBuffer(binding.requests, 0, counters, 0, 12);
        device.queue.submit([encoder.finish()]);
        let after, beforeReleased = false;
        try {
          if (family) lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
          const execution = await hierarchy.runSchroederSameLevelMechanicsWebGpu({ device,
            sphParticleState: packed, mlsMpmParticleState: packedMls, sphParticleUpload: sph, mlsMpmParticleUpload: mls,
            levelAssignment: assignment, levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
            selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .05,
            boxDimsM: [.3, .3, .3], dt: 1e-6, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
            enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
            enableLawQueue: false, enableLawNeighborCandidates: false,
            enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
            residentStepOptions: { device, thermalMaterialTable: table, mechanicsMaterialTable: mechanicsTable,
              thermalStepOptions: { thermalResponseGraphUpload: upload, thermalPotential: enabled ? cache : null,
                conductionRate: 1, wallRate: wall ? 1 : 0,
                wallModel: wall ? 'infinite-fixed-temperature-reservoir' : 'adiabatic',
                wallLayerM: .3, wallTemperaturesK: Object.fromEntries(
                  ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'].map(face => [face, 400])) },
              preferWebGpu: true, readbackMode: 'no-full-readback', contactSolverEnabled: true,
              gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null, fuseNoFullResidentMechanics: false } });
          step = execution.residentStep;
          check(step?.thermalStep && step?.mechanicsRefreshStep, 'Complete resident thermal/refresh interval required');
          const next = step.nextParticleUploads;
          check(next?.sphParticleUpload && next.schroederSpatialSuccessorSourceFamily, 'Physical successor publication required');
          after = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, device);
          const receipt = await thermalPotentialIntervalReceipt({ device, format, count: 2, before, after,
            oldUpload: sph, newUpload: next.sphParticleUpload, baseline: enabled ? snapshots[cycle - 1] : null,
            requests: binding.requests, counters, cycle });
          rows.push(receipt);
          check(receipt[0] === 0, `Interval ${cycle}, fit=${enabled}: ${JSON.stringify(receipt)}`);
          check(receipt[2] > 0 && receipt[3] > 0 && receipt[6] > 0, 'Nonzero reciprocal conduction must execute');
          if (wall) check(receipt[8] === 2, `Both real wall sources must be booked: ${JSON.stringify(receipt)}`);
          if (enabled && cycle === 2) {
            // Deliberately reverse only the proof's ledger inputs. Total
            // energy still closes, but heat direction and flux must fail.
            const bad = await thermalPotentialIntervalReceipt({ device, format, count: 2, before: after, after: before,
              oldUpload: sph, newUpload: next.sphParticleUpload, baseline: snapshots[cycle - 1],
              requests: binding.requests, counters, cycle });
            check(bad[4] === 1 && (bad[0] & 64) !== 0 && (bad[0] & 128) !== 0,
              'Conservative reversed transfers must fail direction and transfer accuracy');
            negativeControls.push(bad);
          }
          if (!enabled) copySnapshot(next.sphParticleUpload, before, after);
          // This fixture owns the actual hierarchy invocation and observes
          // its real queue completion. The hierarchy's queue-ordered route
          // deliberately has no host completion receipt until its caller
          // observes one. This is not worker/ComputeManager enrollment.
          await device.queue.onSubmittedWorkDone();
          const stateKey = enabled ? 'g6-fitted' : 'g6-direct';
          const gpuFence = { ...steps.createMlsMpmResidentStepGpuFenceReport(step, { stateKey }),
            status: 'queue-work-completed', method: 'queue.onSubmittedWorkDone', fenceSatisfied: true,
            queueCompletionStatus: 'queue-work-completed', queueCompletionMethod: 'queue.onSubmittedWorkDone',
            source: 'native-fixture-observed-physical-interval-completion' };
          const delta = steps.createMlsMpmResidentStepsCommitDelta({ finalStep: step, completedStepCount: 1,
            gpuFence, backend: step.backend, continuationAvailable: true, fullParticleReadbackPerformed: false },
          { stateKey, taskId: `${stateKey}:interval:${cycle}` });
          const admission = validateResidentStepsCommitDelta(delta);
          check(admission.accepted, `Actual interval delta refused: ${JSON.stringify(admission.issues)}`);
          let candidate, adoptionSnapshot;
          if (enabled && cycle === 1) {
            adoptionSnapshot = copySnapshot(next.sphParticleUpload, before, after);
            candidate = potential.encodeThermalPotentialCandidateGpu(cache, device.createCommandEncoder());
            potential.submitThermalPotentialCandidateGpu(candidate);
            await potential.completeThermalPotentialCandidateGpu(candidate);
            potential.attachThermalPotentialCandidateToDelta(candidate, delta);
          }
          createResidentStateManagerCommitHandler(manager)(delta);
          commits.push({ completedStepCount: delta.payload.completedStepCount, status: gpuFence.status,
            version: delta.version, fitOrdinal: potential.thermalPotentialGpuBindings(cache, device, upload).ordinal });
          if (candidate) check(commits.at(-1).fitOrdinal === 1, 'Real interval commit failed to adopt fit');
          if (adoptionSnapshot) {
            const identity = await thermalPotentialAdoptionReceipt(device, adoptionSnapshot, next.sphParticleUpload, after.energy);
            check(identity[0] === 0 && identity[1] > 0, 'Fitting/adoption changed physical state');adoption.push(identity);
          }
          const nextPacked = steps.cloneSphParticleStateForNext(packed, step);
          const nextMls = steps.cloneMlsMpmParticleStateForNext(packedMls, step);
          check(nextPacked.step === packed.step + 1 && nextPacked.time > packed.time, 'Physical time must advance');
          commits.at(-1).step = nextPacked.step;commits.at(-1).time = nextPacked.time;
          await buffers.releaseSphParticleExactMassRead(after);after = null;
          await buffers.releaseSphParticleExactMassRead(before);
          beforeReleased = true;
          if (family) {
            spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device });lease = null;
            await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device });
          }
          steps.destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: steps.retainedContinuationBuffersFromUploads(next) });
          buffers.destroySphGpuParticleBuffers(sph);buffers.destroyMlsMpmGpuParticleBuffers(mls);
          await device.queue.onSubmittedWorkDone();await new Promise(resolve => setTimeout(resolve, 0));
          check(sph.destroyed && mls.destroyed, 'Original owners must retire before continuation');
          sph = next.sphParticleUpload;mls = next.mlsMpmParticleUpload;packed = nextPacked;packedMls = nextMls;
          family = next.schroederSpatialSuccessorSourceFamily;assignment = next.schroederSpatialSuccessorLevelAssignment;
          step = null;
        } finally {
          if (after) await buffers.releaseSphParticleExactMassRead(after);
          if (!beforeReleased) await buffers.releaseSphParticleExactMassRead(before);
        }
      }
      return { rows, ordinals, commits, adoption, negativeControls };
    } finally {
      await device.queue.onSubmittedWorkDone();
      if (family) {
        if (lease) spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device });
        await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device });
      }
      if (step) steps.destroyMlsMpmResidentStepBuffers(step);
      buffers.destroySphGpuParticleBuffers(sph);buffers.destroyMlsMpmGpuParticleBuffers(mls);counters.destroy();
    }
  };
  try {
    const direct = await run(false);const fitted = await run(true);
    const validation = (await device.popErrorScope())?.message ?? null;
    return { direct, fitted, validation, errors };
  } finally {
    await device.queue.onSubmittedWorkDone();potential.destroyThermalPotentialGpu(cache);
    for (const snapshot of snapshots) for (const buffer of Object.values(snapshot)) buffer.destroy();
    thermal.destroySphThermalResponseGraphBuffers(upload);await manager.destroy();device.destroy();
  }
}
