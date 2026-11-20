import { createSchroederPhaseSlotMaterializer } from './schroederPhaseSlotMaterializationGpu.js';
import { cloneSchroederSplitSpareReserve, splitSpareReservesEqual } from './schroederSplitSpareReserve.js';
import { resolveSphPhaseCarrierTransferSourceCapture } from './sphPhaseCarrierTransferGpu.js';
import { assertSphLegacyMassPathAllowed, markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';
import { createPostMechanicsStageOutputSeal } from './sphMechanicsRefreshGpuKernel.js';
import { webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { deferSubmittedWorkCleanup, createQueueOrderedCleanupClaimIssuer,
  submitQueueOrderedProducerWorkAndCleanup } from '../webgpuComputeLayout.js';

const sourceCaptures = new WeakMap();
const consumedRequests = new WeakSet();
const results = new WeakSet();
const scratchCleanupIssuer = createQueueOrderedCleanupClaimIssuer({
  producerFamily: 'phase-slot-refinement-scratch'
});

export function retainedSchroederPhaseSlotRefinementBuffers(result) {
  if (result == null) return {};
  if (!results.has(result)) throw new TypeError('Unknown phase-slot refinement producer');
  return result;
}

export function resolveSchroederPhaseSlotRefinementSourceCapture(result, token) {
  const seal = sourceCaptures.get(token);
  if (!seal || seal.result !== result) throw new Error('Unknown phase-slot refinement source capture');
  seal.validate();
  return seal;
}

// Standard post-phase producer. A request binds the original tick's upload
// objects and admitted assignments; the closure supplies the CURRENT S/T/M
// buffers after thermal, reaction and phase transfer. It never rereads cold rows.
// The result still needs constitutive refresh and the normal continuation claim.
export async function runSchroederPhaseSlotRefinementWebGpu(args) {
  const { device, sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
    sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer, thermalMaterialTable, boxDimsM,
    phaseSlotRefinement: request, postMechanicsSourceCapture: token, readbackMode } = args;
  const ledger = args.exactLedger ?? null;
  let phaseSeal = null;
  if (ledger) {
    phaseSeal = resolveSphPhaseCarrierTransferSourceCapture(ledger.phaseResult, ledger.phaseCapture);
    if (!phaseSeal.exactLedgerPhase || phaseSeal.inputs.device !== device
        || phaseSeal.inputs.sphParticleState !== sphParticleState
        || phaseSeal.inputs.mlsMpmParticleState !== mlsMpmParticleState
        || phaseSeal.output.stateBuffer !== sourceStateBuffer
        || phaseSeal.output.thermoBuffer !== sourceThermoBuffer
        || phaseSeal.output.mechanicsBuffer !== sourceMechanicsBuffer) {
      throw new TypeError('Phase-slot ledger requires its genuine current integer phase output');
    }
  } else assertSphLegacyMassPathAllowed(args, 'Phase-slot refinement');
  if (!token || sourceCaptures.has(token) || !request || consumedRequests.has(request)) {
    throw new TypeError('Phase-slot refinement requires a fresh captured request');
  }
  if (readbackMode !== 'no-full-readback'
      || request.sourceSphParticleUpload !== sphParticleUpload
      || request.sourceMlsMpmParticleUpload !== mlsMpmParticleUpload) {
    throw new TypeError('Phase-slot refinement requires its original resident source family');
  }
  const count = sphParticleState.particleCount;
  const plans = [sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload]
    .map(source => {
      if (source?.particleCount !== count) throw new RangeError('Phase-slot source counts disagree');
      return source.phaseCarrierPlan;
    });
  const reserves = plans.map(plan => cloneSchroederSplitSpareReserve(plan, count));
  if (!reserves[0] || plans.some(plan => plan?.phaseLaneCount !== 4)
      || reserves.some(reserve => !splitSpareReservesEqual(reserve, reserves[0]))) {
    throw new RangeError('Phase-slot refinement requires matching four-lane split reserves');
  }
  for (const buffer of [sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer, sphParticleUpload.identityBuffer]) {
    if (!buffer || webGpuBufferDevice(buffer) !== device) {
      throw new TypeError('Phase-slot refinement requires same-device captured source buffers');
    }
  }
  const assignment = request.particleStorageSlotAssignment ? { ...request.particleStorageSlotAssignment } : null;
  const spareLineagesBuffer = request.spareLineagesBuffer;
  if (assignment?.preservePhaseSlots !== true || !assignment.slotAssignmentBuffer
      || assignment.status !== 'schroeder-particle-storage-slot-assignment-submitted'
      || assignment.particleStorageSlotAssignmentAdmissionApproved !== true) {
    throw new TypeError('Phase-slot refinement requires admitted fixed-slot assignments');
  }
  for (const buffer of [assignment.slotAssignmentBuffer, spareLineagesBuffer]) {
    if (!buffer || webGpuBufferDevice(buffer) !== device) {
      throw new TypeError('Phase-slot refinement requires same-device assignment and spare buffers');
    }
  }
  // Reuse the existing StateManager publication contract; a new true/false
  // switch cannot authorize mutation. The legacy identity approval remains
  // required by that contract even though this producer never binds identity.
  const { schroederParticleStorageMaterializationAdmissionAllowsApplication } =
    await import('./schroederHierarchyGpu.js');
  const admission = schroederParticleStorageMaterializationAdmissionAllowsApplication({
    particleStorageMaterializationAdmission: request.particleStorageMaterializationAdmission,
    particleStorageSlotAssignment: assignment, assignmentRowCount: assignment.allocationRowCount
  });
  if (!admission.approved) throw new TypeError('Phase-slot refinement has no StateManager materialization admission');
  consumedRequests.add(request);
  sourceCaptures.set(token, null);
  const stage = createSchroederPhaseSlotMaterializer(device, {
    lineageCapacity: plans[0].lineageCapacity, firstSpareLineage: reserves[0].firstLineageIndex,
    spareCount: reserves[0].count, assignmentRowCount: assignment.allocationRowCount,
    thermalMaterialTable, boxDimsM, admissionApproved: true,
    exactLedger: phaseSeal ? { massRead: phaseSeal.exactLedgerPhase.carrierMassRead,
      energy: phaseSeal.exactLedgerPhase.exactEnergy } : null
  });
  let submitted = false, ledgerCommitted = null;
  try {
    const encoder = device.createCommandEncoder({ label: 'ulg-phase-slot-refinement' });
    stage.encode(encoder, { sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer,
      slotAssignmentBuffer: assignment.slotAssignmentBuffer, spareLineagesBuffer });
    submitQueueOrderedProducerWorkAndCleanup(scratchCleanupIssuer, device, [encoder.finish()], {
      producerOutput: stage, cleanup: stage.cleanupSubmittedWork
    });
    submitted = true;
    if (ledger) {
      markSphExactMassDerivedBuffers(ledger.sourceRead, [stage.stateBuffer, stage.thermoBuffer],
        { mechanicsBuffers: [stage.mechanicsBuffer] });
      ledgerCommitted = stage.ledgerStage.commit();
    }
    const result = {
      schema: 'peercompute.ulg.schroeder-phase-slot-refinement.v1',
      status: 'phase-slot-refinement-awaiting-constitutive-refresh', backend: 'webgpu',
      particleCount: count, identityPreserved: true, requiresConstitutiveRefresh: true,
      stateBuffer: stage.stateBuffer, thermoBuffer: stage.thermoBuffer, mechanicsBuffer: stage.mechanicsBuffer,
      evidenceBuffer: stage.evidenceBuffer,
      stateBufferByteLength: count * 32, thermoBufferByteLength: count * 48, mechanicsBufferByteLength: count * 128,
      ownsStateBuffer: true, ownsThermoBuffer: true, ownsMechanicsBuffer: true,
      fullParticleReadbackFree: true, fullParticleReadbackPerformed: false,
      mapAsyncCount: 0, readbackBytes: 0, hostQueueFenceCount: 0,
      destroyOutputParticleBufferComponents: stage.destroyOutputParticleBufferComponents,
      destroyOutputParticleBuffers() {
        return stage.destroyOutputParticleBufferComponents({ state: true, thermo: true, mechanics: true });
      }
    };
    const seal = createPostMechanicsStageOutputSeal(result, { device, sphParticleState, mlsMpmParticleState,
      sphParticleUpload, mlsMpmParticleUpload, sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer,
      thermalMaterialTable, phaseSlotRefinement: request, ...(ledger ? { exactLedger: ledger } : {}) }, {
      onLastRelease: ledgerCommitted ? () => {
        void stage.ledgerStage.releaseUnadopted(ledgerCommitted).catch(() => {});
      } : null
    });
    sourceCaptures.set(token, Object.freeze({ ...seal, refinementValidationBuffer: stage.evidenceBuffer,
      validate() {
        seal.validate();
        if (result.evidenceBuffer !== stage.evidenceBuffer) throw new TypeError('Captured refinement validation was replaced');
        return true;
      },
      ...(ledgerCommitted ? { exactLedgerRefinement: ledgerCommitted, sourcePhaseSeal: phaseSeal } : {}) }));
    results.add(result);
    return result;
  } catch (error) {
    if (ledgerCommitted) void stage.ledgerStage.releaseUnadopted(ledgerCommitted).catch(() => {});
    if (submitted) deferSubmittedWorkCleanup(device, stage.destroy);
    else stage.destroy();
    throw error;
  }
}
