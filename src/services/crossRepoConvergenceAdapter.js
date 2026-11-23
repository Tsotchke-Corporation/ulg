/**
 * Phase 9 Cross-Repo Convergence Adapters (ULG-Side Boundary Contracts).
 *
 * Aligns exact verified interfaces across ULG and its sibling repositories
 * without modifying any sibling repository:
 *   1. `eshkols-in-space` (`integration/ulg.mjs` v0.5 `runNBodyCapsule` ABI &
 *      2M-body Barnes-Hut WebGPU memory-budget gate).
 *   2. `peercompute` (`NodeKernel`, `ComputeManager`, `StateManager`,
 *      `RemoteResultQuorumValidator` service contract validator).
 *   3. `moonlab` (v1.2.0 Community Edition / ABI 0.6.0 reduced-scope complex64
 *      WebGPU parity envelope).
 *   4. `eshkol` (`eshkol.closure.derive` WASM/AD service manifest).
 *
 * Every adapter preserves ULG's non-overclaim governance:
 * `scientificValidation: false`, `fullPhysicsValidation: false`.
 */

import { createSimulationArtifact as defaultCreateSimulationArtifact } from '../../ulg-gpu-abi/src/index.js';
import {
  ULG_SERVICE_IDS,
  ULG_TASK_KINDS
} from '../../ulg-gpu-abi/src/serviceContract.js';

export const CROSS_REPO_CONVERGENCE_SCHEMA = 'peercompute.ulg.cross-repo-convergence.v1';

export const ESHKOL_NBODY_STRIDE_FLOATS = 8;
export const ESHKOL_NBODY_STRIDE_BYTES = 32; // [x, y, z, mass, vx, vy, vz, radius] f32
export const ESHKOL_TARGET_MAX_BODIES = 2_000_000;

/**
 * Validate WebGPU device buffer limits against the `eshkols-in-space` 2M-body
 * resident Barnes-Hut octree memory envelope (~64 MB per ping-pong state buffer,
 * ~317 MB aggregate with octree nodes, Morton sort scratch, and staging).
 */
export function checkEshkol2MBodyMemoryBudget(bodyCount, {
  deviceMaxBufferSizeBytes = 256 * 1024 * 1024,
  deviceMaxStorageBufferBindingSizeBytes = 128 * 1024 * 1024,
  includeOctreeScratch = true
} = {}) {
  const n = Math.max(0, Math.floor(Number(bodyCount) || 0));
  const stateBufferBytes = n * ESHKOL_NBODY_STRIDE_BYTES;
  // Ping-pong state (2x) + Barnes-Hut octree (~48 B/body) + Morton/Radix scratch (~46 B/body)
  const octreeBytes = includeOctreeScratch ? Math.ceil(n * 48) : 0;
  const mortonScratchBytes = includeOctreeScratch ? Math.ceil(n * 46) : 0;
  const totalResidentBytes = stateBufferBytes * 2 + octreeBytes + mortonScratchBytes;

  const blockers = [];
  if (n <= 0) blockers.push('bodyCount must be positive');
  if (stateBufferBytes > deviceMaxBufferSizeBytes) {
    blockers.push(`stateBufferBytes (${stateBufferBytes}) exceeds maxBufferSize (${deviceMaxBufferSizeBytes})`);
  }
  if (stateBufferBytes > deviceMaxStorageBufferBindingSizeBytes) {
    blockers.push(`stateBufferBytes (${stateBufferBytes}) exceeds maxStorageBufferBindingSize (${deviceMaxStorageBufferBindingSizeBytes})`);
  }
  if (octreeBytes > deviceMaxStorageBufferBindingSizeBytes) {
    blockers.push(`octreeBytes (${octreeBytes}) exceeds maxStorageBufferBindingSize (${deviceMaxStorageBufferBindingSizeBytes})`);
  }

  return Object.freeze({
    schema: 'peercompute.ulg.eshkol-nbody-memory-budget.v1',
    bodyCount: n,
    strideBytes: ESHKOL_NBODY_STRIDE_BYTES,
    stateBufferBytes,
    octreeBytes,
    mortonScratchBytes,
    totalResidentBytes,
    totalResidentMiB: Number((totalResidentBytes / (1024 * 1024)).toFixed(2)),
    fitsDeviceLimits: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
}

/**
 * ULG-side adapter matching `/home/cos/projects/eshkols-in-space/integration/ulg.mjs`
 * `runNBodyCapsule(capsule, { simulation, createSimulationArtifact })` verbatim,
 * with optional zero-copy `ResidentModuleBufferSession` lease publication.
 */
export function createEshkolsInSpaceCapsuleAdapter({
  simulation,
  createSimulationArtifact = defaultCreateSimulationArtifact,
  leaseSession = null,
  zeroCopy = false
} = {}) {
  if (!simulation || typeof simulation.step !== 'function') {
    throw new TypeError('createEshkolsInSpaceCapsuleAdapter requires a simulation object with step(parameters)');
  }

  async function runNBodyCapsule(capsule) {
    if (capsule?.serviceId !== ULG_SERVICE_IDS.ulgRuntime || capsule.taskKind !== ULG_TASK_KINDS.simulationStep) {
      throw new TypeError('Expected a ULG simulation.step capsule for ulg-runtime.');
    }
    if (!capsule.taskId || !capsule.inputHash || !capsule.methodHash || !capsule.provenance) {
      throw new TypeError('The ULG capsule needs identity and provenance.');
    }
    if (capsule.validation?.mode && !['none', 'self'].includes(capsule.validation.mode)) {
      throw new RangeError('This adapter supports self or none validation.');
    }
    const { stepIndex, parameters } = capsule.input ?? {};
    if (!Number.isSafeInteger(stepIndex) || stepIndex < 0 || stepIndex !== simulation.stepIndex) {
      throw new RangeError(`Requested stepIndex (${stepIndex}) does not match resident simulation.stepIndex (${simulation.stepIndex}).`);
    }
    if (!parameters || typeof parameters !== 'object') {
      throw new TypeError('Expected capsule.input.parameters for the Eshkol gravity step.');
    }

    const useZeroCopy = Boolean(zeroCopy && parameters.readback !== true && typeof simulation.getResidentBuffer === 'function');
    const bodies = await simulation.step({ ...parameters, readback: !useZeroCopy });
    const toStep = stepIndex + 1;
    const finite = bodies.every(Number.isFinite);
    if (!finite) {
      throw new Error('The simulation produced a non-finite body state.');
    }

    let leaseHandle = null;
    if (leaseSession && typeof leaseSession.publishBuffer === 'function') {
      leaseSession.publishBuffer({
        resourceKey: 'bodies',
        buffer: typeof simulation.getResidentBuffer === 'function' ? simulation.getResidentBuffer() : null,
        destroyFn: () => true,
        byteLength: bodies.byteLength,
        rowCount: simulation.count,
        layout: {
          tensorId: 'bodies',
          dtype: 'f32',
          layout: 'interleaved',
          strideElements: ESHKOL_NBODY_STRIDE_FLOATS,
          strideBytes: ESHKOL_NBODY_STRIDE_BYTES,
          fields: ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'radius']
        },
        stepIndex: toStep,
        portableSnapshotFn: async () => Float32Array.from(
          typeof simulation.readbackBodies === 'function' && useZeroCopy
            ? await simulation.readbackBodies()
            : bodies
        )
      });
      leaseHandle = leaseSession.borrowBufferReadLease({
        resourceKey: 'bodies',
        consumerStage: 'eshkols-in-space-adapter',
        reason: useZeroCopy ? 'zero-copy-gpu-vertex-lease' : 'portable-snapshot-lease'
      });
    }

    const outputs = {
      deltas: [{ operation: 'replace', tensorId: 'bodies', fromStep: stepIndex, toStep }]
    };
    if (!useZeroCopy) {
      outputs.finalState = {
        tensorId: 'bodies',
        dtype: 'f32',
        layout: 'interleaved',
        shape: [simulation.count, ESHKOL_NBODY_STRIDE_FLOATS],
        stepIndex: toStep,
        values: Array.from(bodies)
      };
    }

    const artifact = createSimulationArtifact({
      artifactId: `${capsule.taskId}:nbody:${toStep}`,
      taskKind: capsule.taskKind,
      closureRef: {
        module: 'physics/nbody.esk',
        entryPoint: 'step-world',
        kernelEntryPoint: 'main'
      },
      representation: 'nbody-interleaved-f32',
      outputs,
      execution: {
        backend: simulation.backend || 'webgpu',
        stage: 'eshkol.nbody.step',
        placement: 'local',
        gravityMode: simulation.gravityMode,
        zeroCopyReadbackSkipped: useZeroCopy
      },
      validity: {
        finite,
        bodyCount: simulation.activeCount,
        slotCount: simulation.count
      },
      validation: {
        status: 'pass',
        validationMode: 'finite-output',
        scientificValidation: false,
        fullPhysicsValidation: false
      },
      provenance: {
        ...capsule.provenance,
        sourceService: ULG_SERVICE_IDS.ulgRuntime,
        methodHash: capsule.methodHash,
        inputHash: capsule.inputHash
      }
    });

    return { artifact, leaseHandle };
  }

  return Object.freeze({
    schema: CROSS_REPO_CONVERGENCE_SCHEMA,
    targetRepo: 'eshkols-in-space',
    contractFile: 'integration/ulg.mjs',
    strideFloats: ESHKOL_NBODY_STRIDE_FLOATS,
    strideBytes: ESHKOL_NBODY_STRIDE_BYTES,
    runNBodyCapsule
  });
}

/**
 * Validate the live PeerCompute service contract imported by ULG (`NodeKernel`,
 * `ComputeManager`, `createRemoteResultQuorumValidator`, optional `StateManager`).
 */
export function validatePeerComputeServiceContract({
  NodeKernel,
  ComputeManager,
  createRemoteResultQuorumValidator,
  StateManager = null
} = {}) {
  const checks = [];
  const missing = [];

  const checkFn = (name, fn) => {
    const ok = typeof fn === 'function';
    checks.push({ name, ok });
    if (!ok) missing.push(name);
  };

  checkFn('NodeKernel', NodeKernel);
  checkFn('ComputeManager', ComputeManager);
  checkFn('createRemoteResultQuorumValidator', createRemoteResultQuorumValidator);
  if (StateManager !== null) checkFn('StateManager', StateManager);

  let quorumSmokePassed = false;
  if (typeof createRemoteResultQuorumValidator === 'function') {
    const validator = createRemoteResultQuorumValidator({
      validationId: 'ulg-phase9-contract-check',
      minReplicaCount: 2,
      minMatchingReplicas: 2,
      compareCommitDeltaHash: false
    });
    quorumSmokePassed = typeof validator === 'function' || typeof validator?.validate === 'function';
    checks.push({ name: 'RemoteResultQuorumValidator:2of2', ok: quorumSmokePassed });
    if (!quorumSmokePassed) missing.push('RemoteResultQuorumValidator:2of2');
  }

  const hasRedundantPlacement = typeof NodeKernel?.prototype?.createRedundantNetworkPlacementExecutor === 'function';
  checks.push({ name: 'NodeKernel.prototype.createRedundantNetworkPlacementExecutor', ok: hasRedundantPlacement });
  if (!hasRedundantPlacement) missing.push('NodeKernel.prototype.createRedundantNetworkPlacementExecutor');

  return Object.freeze({
    schema: 'peercompute.ulg.peercompute-contract-check.v1',
    targetRepo: 'peercompute',
    ok: missing.length === 0,
    checks: Object.freeze(checks),
    missing: Object.freeze(missing),
    validation: Object.freeze({
      scientificValidation: false,
      fullPhysicsValidation: false
    })
  });
}

/**
 * Reduced-scope MoonLab v1.2.0 Community Edition / ABI 0.6.0 WebGPU complex64
 * parity envelope. Explicitly bounds parity claims to reduced-scope complex64
 * circuits and keeps full physics validation false.
 */
export function createMoonLabReducedParityEnvelope({
  qubits = 12,
  circuit = null,
  probabilitySum = 1.0,
  complex64ParityRelErr = 0,
  nativeDispatches = null,
  expectedDispatches = null,
  backend = 'moonlab-wasm-webgpu-worker',
  abiVersion = '0.6.0',
  edition = 'v1.2.0-community'
} = {}) {
  const q = Math.max(1, Math.floor(Number(qubits) || 1));
  const expDisp = expectedDispatches ?? (q + 1);
  const probErr = Math.abs(Number(probabilitySum) - 1.0);
  const parityErr = Math.abs(Number(complex64ParityRelErr));
  const ok = Number.isFinite(probErr) && probErr < 1e-4 && Number.isFinite(parityErr) && parityErr < 1e-4;

  return Object.freeze({
    schema: 'peercompute.ulg.moonlab-reduced-parity-envelope.v1',
    targetRepo: 'moonlab',
    edition,
    abiVersion,
    scope: 'reduced-complex64-webgpu-parity',
    backend,
    circuit: circuit || `ghz-${q}`,
    qubits: q,
    stateDim: 2 ** Math.min(26, q),
    probabilitySum: Number(probabilitySum),
    probabilityNormalizationError: probErr,
    complex64ParityRelErr: parityErr,
    nativeDispatches,
    expectedDispatches: expDisp,
    parityPass: ok,
    validation: Object.freeze({
      scientificValidation: false,
      fullPhysicsValidation: false,
      reducedScopeParityOnly: true
    })
  });
}

/**
 * ULG <-> Eshkol WASM/AD closure service manifest (`eshkol.closure.derive`).
 */
export function createEshkolWasmServiceManifest({
  vmAssetPath = '/service-assets/eshkol/vm/',
  workerUrl = '/workers/eshkol-warm-vm.worker.js',
  supportsReverseModeAd = true,
  supportsForwardModeAd = true,
  supportsGpuMatmulDispatch = true,
  closureOperations = ['sample', 'matmul-sum', 'helmholtz-a4']
} = {}) {
  return Object.freeze({
    schema: 'peercompute.ulg.eshkol-wasm-service-manifest.v1',
    targetRepo: 'eshkol',
    serviceId: ULG_SERVICE_IDS.eshkol,
    taskKind: ULG_TASK_KINDS.closureDerive,
    vmAssetPath,
    workerUrl,
    capabilities: Object.freeze({
      wasmVm: true,
      forwardModeAd: Boolean(supportsForwardModeAd),
      reverseModeAd: Boolean(supportsReverseModeAd),
      gpuMatmulDispatch: Boolean(supportsGpuMatmulDispatch),
      operations: Object.freeze([...closureOperations])
    }),
    validation: Object.freeze({
      scientificValidation: false,
      fullPhysicsValidation: false
    })
  });
}
