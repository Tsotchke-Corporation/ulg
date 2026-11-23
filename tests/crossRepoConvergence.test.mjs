import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulationArtifact } from '../ulg-gpu-abi/src/index.js';
import {
  createUlgTaskCapsule,
  ULG_SERVICE_IDS,
  ULG_TASK_KINDS
} from '../ulg-gpu-abi/src/serviceContract.js';
import { createResidentModuleBufferSession } from '../src/runtime/residentBufferLease.js';
import { stepNBodyInterleavedReference } from '../src/runtime/simulationModuleRegistry.js';
import { createGalacticBodies } from '../src/demos/cosmicQuantumGpuKernels.js';
import {
  ESHKOL_TARGET_MAX_BODIES,
  checkEshkol2MBodyMemoryBudget,
  createEshkolWasmServiceManifest,
  createEshkolsInSpaceCapsuleAdapter,
  createMoonLabReducedParityEnvelope,
  validatePeerComputeServiceContract
} from '../src/services/crossRepoConvergenceAdapter.js';
import {
  COSMIC_QUANTUM_PEER_TASK_SCHEMA,
  run as runCosmicQuantumPeerTask
} from '../src/services/cosmicQuantumPeerTask.js';
import { NodeKernel } from '../../peercompute/peercompute/src/peercompute/nodeKernel/NodeKernel.js';
import { ComputeManager } from '../../peercompute/peercompute/src/peercompute/computeManager/ComputeManager.js';
import { StateManager } from '../../peercompute/peercompute/src/peercompute/stateManager/StateManager.js';
import { createRemoteResultQuorumValidator } from '../../peercompute/peercompute/src/peercompute/computeManager/RemoteResultQuorumValidator.js';
import { runNBodyCapsule as siblingRunNBodyCapsule } from '../../eshkols-in-space/integration/ulg.mjs';

function createTestHarnessNBodySim(initialBodies) {
  let bodies = Float32Array.from(initialBodies);
  const count = bodies.length / 8;
  let stepIndex = 0;
  return {
    get count() { return count; },
    get activeCount() { return count; },
    get stepIndex() { return stepIndex; },
    get backend() { return 'test-harness-direct'; },
    get gravityMode() { return 'direct-pairs-test-harness'; },
    getBodies: () => bodies,
    getResidentBuffer: () => null,
    async step({ dt = 0.01, gravity = 1.0, softening = 0.25 } = {}) {
      const out = stepNBodyInterleavedReference(bodies, { dt, gravity, softening });
      bodies = out.bodies;
      stepIndex += 1;
      return bodies;
    },
    dispose() {}
  };
}

test('Phase 9: ULG Eshkols-in-Space adapter matches sibling integration/ulg.mjs ABI verbatim and supports resident leases', async () => {
  const bodies0 = createGalacticBodies({ count: 64, preset: 'disk', seed: 901 });
  const simUlg = createTestHarnessNBodySim(bodies0);
  const simSibling = createTestHarnessNBodySim(bodies0);

  const capsule = createUlgTaskCapsule({
    taskId: 'phase9-nbody-parity-0',
    serviceId: ULG_SERVICE_IDS.ulgRuntime,
    taskKind: ULG_TASK_KINDS.simulationStep,
    method: { model: 'nbody-gravity', version: 1 },
    input: { stepIndex: 0, parameters: { dt: 0.01, gravity: 1.0, softening: 0.25 } }
  });

  const leaseSession = createResidentModuleBufferSession({
    moduleId: 'nbody-gravity@1',
    sessionId: 'phase9-parity'
  });
  const adapter = createEshkolsInSpaceCapsuleAdapter({
    simulation: simUlg,
    createSimulationArtifact,
    leaseSession,
    zeroCopy: false
  });

  const [{ artifact: ulgArt, leaseHandle }, siblingArt] = await Promise.all([
    adapter.runNBodyCapsule(capsule),
    siblingRunNBodyCapsule(capsule, { simulation: simSibling, createSimulationArtifact })
  ]);

  assert.equal(ulgArt.artifactId, siblingArt.artifactId);
  assert.equal(ulgArt.representation, siblingArt.representation);
  assert.deepEqual(ulgArt.closureRef, siblingArt.closureRef);
  assert.deepEqual(ulgArt.outputs.deltas, siblingArt.outputs.deltas);
  assert.deepEqual(ulgArt.outputs.finalState.shape, siblingArt.outputs.finalState.shape);
  assert.deepEqual(ulgArt.outputs.finalState.values, siblingArt.outputs.finalState.values);
  assert.deepEqual(ulgArt.validity, siblingArt.validity);
  assert.equal(ulgArt.validation.scientificValidation, false);
  assert.equal(ulgArt.validation.fullPhysicsValidation, false);
  assert.equal(siblingArt.validation.scientificValidation, false);
  assert.equal(leaseHandle.isCurrent(), true);
  leaseHandle.release();

  // Fail-closed stepIndex mismatch guard
  await assert.rejects(
    () => adapter.runNBodyCapsule(capsule),
    /stepIndex/i
  );

  simUlg.dispose();
  simSibling.dispose();
});

test('Phase 9: 2M-body Eshkol Barnes-Hut memory budget validator enforces WebGPU device limits fail-closed', () => {
  const fit2M = checkEshkol2MBodyMemoryBudget(ESHKOL_TARGET_MAX_BODIES, {
    deviceMaxBufferSizeBytes: 256 * 1024 * 1024,
    deviceMaxStorageBufferBindingSizeBytes: 128 * 1024 * 1024
  });
  assert.equal(fit2M.fitsDeviceLimits, true);
  assert.equal(fit2M.stateBufferBytes, 64_000_000);
  assert.ok(fit2M.totalResidentMiB > 280 && fit2M.totalResidentMiB < 330,
    `expected ~301 MiB aggregate footprint, got ${fit2M.totalResidentMiB}`);

  const over = checkEshkol2MBodyMemoryBudget(5_000_000, {
    deviceMaxBufferSizeBytes: 256 * 1024 * 1024,
    deviceMaxStorageBufferBindingSizeBytes: 128 * 1024 * 1024
  });
  assert.equal(over.fitsDeviceLimits, false);
  assert.ok(over.blockers.length >= 1);
});

test('Phase 9: PeerCompute service contract, MoonLab reduced complex64 parity envelope, and Eshkol WASM manifest verify cleanly', async () => {
  const pc = validatePeerComputeServiceContract({
    NodeKernel,
    ComputeManager,
    StateManager,
    createRemoteResultQuorumValidator
  });
  assert.equal(pc.ok, true, `PeerCompute contract missing: ${pc.missing.join(', ')}`);
  assert.equal(pc.validation.scientificValidation, false);

  const ml = createMoonLabReducedParityEnvelope({
    qubits: 12,
    probabilitySum: 1.0 - 1e-7,
    complex64ParityRelErr: 2.4e-6,
    nativeDispatches: 13
  });
  assert.equal(ml.abiVersion, '0.6.0');
  assert.equal(ml.scope, 'reduced-complex64-webgpu-parity');
  assert.equal(ml.parityPass, true);
  assert.equal(ml.validation.scientificValidation, false);
  assert.equal(ml.validation.reducedScopeParityOnly, true);
  // Omitting parity measurements must fail closed (parityPass: false)!
  const mlEmpty = createMoonLabReducedParityEnvelope({ qubits: 12 });
  assert.equal(mlEmpty.parityPass, false);

  const eshkol = createEshkolWasmServiceManifest();
  assert.equal(eshkol.serviceId, ULG_SERVICE_IDS.eshkol);
  assert.equal(eshkol.taskKind, ULG_TASK_KINDS.closureDerive);
  assert.equal(eshkol.capabilities.reverseModeAd, true);
  assert.equal(eshkol.validation.scientificValidation, false);

  // Cosmic Quantum distributed peer derivation task determinism (required for 2-of-2 quorum hashing)
  const r1 = await runCosmicQuantumPeerTask({ kind: 'material.resolve-element', payload: { atomicNumberZ: 80 } });
  const r2 = await runCosmicQuantumPeerTask({ kind: 'material.resolve-element', payload: { atomicNumberZ: 80 } });
  assert.equal(r1.value.schema, COSMIC_QUANTUM_PEER_TASK_SCHEMA);
  assert.equal(r1.value.symbol, 'Hg');
  assert.equal(r1.value.standardPhaseAt298K, 'liquid');
  assert.equal(r1.value.scientificValidation, false);
  assert.deepEqual(r1, r2, 'peer task output must be bit-identical for 2-of-2 quorum validation');
  // Missing atomicNumberZ must fail closed (no silent Hg default)
  await assert.rejects(() => runCosmicQuantumPeerTask({ kind: 'material.resolve-element', payload: {} }), RangeError);

  const ch = await runCosmicQuantumPeerTask({ kind: 'nuclear.cherenkov', payload: { kineticEnergyMeV: 1.0, refractiveIndex: 1.333 } });
  assert.equal(ch.value.active, true);
  assert.equal(ch.value.scientificValidation, false);
  // Missing refractiveIndex defaults fail-closed to vacuum (n=1.0 -> inactive)
  const chVac = await runCosmicQuantumPeerTask({ kind: 'nuclear.cherenkov', payload: { kineticEnergyMeV: 1.0 } });
  assert.equal(chVac.value.active, false);
});
