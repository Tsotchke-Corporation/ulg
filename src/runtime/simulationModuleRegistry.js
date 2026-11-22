import { createSimulationArtifact, hashPayload } from '../../ulg-gpu-abi/src/index.js';
import { ULG_SERVICE_IDS, ULG_TASK_KINDS } from '../../ulg-gpu-abi/src/serviceContract.js';
import { createResidentModuleBufferSession } from './residentBufferLease.js';

export const ULG_SIMULATION_MODULE_REGISTRATION_SCHEMA =
  'peercompute.ulg.simulation-module-registration.v1';

function cleanString(value, fallback = null) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

/**
 * Deterministic canonical method key for routing `simulation.step` capsules to
 * registered external or built-in simulation modules.
 */
export function canonicalSimulationMethodKey(method) {
  if (typeof method === 'string') {
    const trimmed = method.trim();
    return trimmed || null;
  }
  if (!method || typeof method !== 'object') return null;
  const model = cleanString(method.model ?? method.moduleId ?? method.id);
  if (!model) return null;
  const version = method.version != null ? String(method.version).trim() : '1';
  return `${model}@${version}`;
}

function validateParametersAgainstSchema(parameters = {}, parameterSchema = null) {
  if (!parameterSchema || typeof parameterSchema !== 'object') return { ok: true };
  if (!parameters || typeof parameters !== 'object') {
    return { ok: false, reason: 'parameters-must-be-object' };
  }
  for (const [name, rule] of Object.entries(parameterSchema)) {
    if (!rule || typeof rule !== 'object') continue;
    const raw = parameters[name];
    if (raw === undefined) {
      if (rule.required === true) {
        return { ok: false, reason: `missing-required-parameter:${name}` };
      }
      continue;
    }
    if (rule.type === 'number') {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        return { ok: false, reason: `non-finite-parameter:${name}` };
      }
      if (rule.min != null && value < rule.min) {
        return { ok: false, reason: `parameter-below-min:${name}:${value}<${rule.min}` };
      }
      if (rule.max != null && value > rule.max) {
        return { ok: false, reason: `parameter-above-max:${name}:${value}>${rule.max}` };
      }
    } else if (rule.type === 'boolean' && typeof raw !== 'boolean') {
      return { ok: false, reason: `parameter-not-boolean:${name}` };
    } else if (rule.type === 'string' && typeof raw !== 'string') {
      return { ok: false, reason: `parameter-not-string:${name}` };
    }
  }
  return { ok: true };
}

/**
 * Method-keyed simulation-module registry and capsule dispatcher for
 * `ulg-runtime`. Enables external PeerCompute/Eshkol compute modules (such as
 * `nbody-gravity`, `cosmology-comoving-nbody`, and `quantum-material-derivation`)
 * to register WGSL kernels, parameter schemas, state layouts, and entry points,
 * borrow epoch-fenced resident GPU buffers on the host's device, and execute
 * v0.5 `simulation.step` capsules without forking the ULG worker runtime.
 */
export function createSimulationModuleRegistry({
  createArtifact = createSimulationArtifact
} = {}) {
  const modules = new Map();
  const sessions = new Map();

  function getOrCreateSession(methodKey, entry, { device = null, sessionId = null } = {}) {
    const resolvedSessionId = cleanString(sessionId, `${methodKey}:default`);
    const existing = sessions.get(resolvedSessionId);
    if (existing && !existing.disposed) return existing;
    const created = createResidentModuleBufferSession({
      sessionId: resolvedSessionId,
      moduleId: methodKey,
      device,
      layout: entry.stateLayout,
      initialStep: 0
    });
    sessions.set(resolvedSessionId, created);
    return created;
  }

  function registerModule(spec = {}) {
    const methodKey = canonicalSimulationMethodKey(spec.method ?? spec.methodId ?? spec.id);
    if (!methodKey) {
      throw new TypeError('Simulation module registration requires method ({ model, version }) or methodId');
    }
    if (typeof spec.stepCapsule !== 'function') {
      throw new TypeError(`Simulation module ${methodKey} requires a stepCapsule(capsule, context) function`);
    }
    const descriptor = Object.freeze({
      schema: ULG_SIMULATION_MODULE_REGISTRATION_SCHEMA,
      methodKey,
      method: typeof spec.method === 'object' && spec.method
        ? Object.freeze({ ...spec.method })
        : Object.freeze({ model: methodKey.split('@')[0], version: methodKey.split('@')[1] || '1' }),
      kernel: spec.kernel && typeof spec.kernel === 'object'
        ? Object.freeze({
          sourceModule: cleanString(spec.kernel.sourceModule),
          entryPoint: cleanString(spec.kernel.entryPoint, 'main'),
          workgroupSize: Number.isInteger(spec.kernel.workgroupSize) ? spec.kernel.workgroupSize : 64,
          wgslHash: spec.kernel.wgsl ? hashPayload(spec.kernel.wgsl) : cleanString(spec.kernel.wgslHash)
        })
        : null,
      parameterSchema: spec.parameterSchema && typeof spec.parameterSchema === 'object'
        ? Object.freeze({ ...spec.parameterSchema })
        : Object.freeze({}),
      stateLayout: spec.stateLayout && typeof spec.stateLayout === 'object'
        ? Object.freeze({
          tensorId: cleanString(spec.stateLayout.tensorId, 'state'),
          dtype: cleanString(spec.stateLayout.dtype, 'f32'),
          layout: cleanString(spec.stateLayout.layout, 'interleaved'),
          strideElements: Number(spec.stateLayout.strideElements) || 1,
          strideBytes: Number(spec.stateLayout.strideBytes) || 4,
          fields: Object.freeze(Array.isArray(spec.stateLayout.fields) ? [...spec.stateLayout.fields] : [])
        })
        : Object.freeze({ tensorId: 'state', dtype: 'f32', layout: 'interleaved', strideElements: 1, strideBytes: 4, fields: Object.freeze([]) }),
      scaleRangeM: Array.isArray(spec.scaleRangeM) && spec.scaleRangeM.length === 2
        ? Object.freeze([Number(spec.scaleRangeM[0]), Number(spec.scaleRangeM[1])])
        : null,
      supportsResidentStep: typeof spec.stepResident === 'function',
      registeredAt: new Date().toISOString()
    });

    modules.set(methodKey, {
      descriptor,
      stepCapsule: spec.stepCapsule,
      stepResident: typeof spec.stepResident === 'function' ? spec.stepResident : null,
      reset: typeof spec.reset === 'function' ? spec.reset : null,
      dispose: typeof spec.dispose === 'function' ? spec.dispose : null
    });
    return descriptor;
  }

  function resolveModule(method) {
    const key = canonicalSimulationMethodKey(method);
    return key ? (modules.get(key) || null) : null;
  }

  function hasModule(method) {
    return resolveModule(method) !== null;
  }

  function listModules() {
    return [...modules.values()].map((entry) => entry.descriptor);
  }

  function unregisterModule(method) {
    const key = canonicalSimulationMethodKey(method);
    if (!key || !modules.has(key)) return false;
    const entry = modules.get(key);
    for (const [sid, session] of [...sessions.entries()]) {
      if (session.moduleId === key) {
        session.dispose();
        sessions.delete(sid);
      }
    }
    entry.dispose?.();
    modules.delete(key);
    return true;
  }

  function getModuleLeaseSession(method, { device = null, sessionId = null } = {}) {
    const entry = resolveModule(method);
    if (!entry) {
      throw new RangeError(`Unregistered simulation module: ${canonicalSimulationMethodKey(method) || 'missing'}`);
    }
    return getOrCreateSession(entry.descriptor.methodKey, entry.descriptor, { device, sessionId });
  }

  async function resetModuleSession(method, {
    sessionId = null,
    nextStep = 0,
    destroyBuffers = true,
    reason = 'module-session-reset'
  } = {}) {
    const entry = resolveModule(method);
    if (!entry) {
      throw new RangeError(`Unregistered simulation module: ${canonicalSimulationMethodKey(method) || 'missing'}`);
    }
    const session = getOrCreateSession(entry.descriptor.methodKey, entry.descriptor, { sessionId });
    const receipt = session.reset({ nextStep, destroyBuffers, reason });
    if (entry.reset) {
      await entry.reset({ session, receipt, nextStep, reason });
    }
    return receipt;
  }

  async function dispatchSimulationStepCapsule(capsule, {
    device = null,
    gpuLease = null,
    sessionId = null
  } = {}) {
    if (!capsule || capsule.serviceId !== ULG_SERVICE_IDS.ulgRuntime || capsule.taskKind !== ULG_TASK_KINDS.simulationStep) {
      return { matched: false, reason: 'not-ulg-runtime-simulation-step' };
    }
    const entry = resolveModule(capsule.method);
    if (!entry) {
      return { matched: false, reason: 'method-not-registered' };
    }
    if (!capsule.taskId || !capsule.inputHash || !capsule.methodHash || !capsule.provenance) {
      throw new TypeError('Registered simulation.step capsule requires taskId, inputHash, methodHash, and provenance');
    }
    const paramCheck = validateParametersAgainstSchema(
      capsule.input?.parameters,
      entry.descriptor.parameterSchema
    );
    if (!paramCheck.ok) {
      const err = new RangeError(`Invalid simulation parameters for ${entry.descriptor.methodKey}: ${paramCheck.reason}`);
      err.code = 'ERR_INVALID_SIMULATION_MODULE_PARAMETERS';
      throw err;
    }

    const leaseSession = getOrCreateSession(entry.descriptor.methodKey, entry.descriptor, {
      device,
      sessionId: sessionId ?? capsule.input?.sessionId ?? null
    });

    const rawResult = await entry.stepCapsule(capsule, {
      createSimulationArtifact: createArtifact,
      device,
      gpuLease,
      leaseSession,
      moduleDescriptor: entry.descriptor
    });

    const artifact = rawResult?.artifact ?? rawResult;
    const leaseHandle = rawResult?.leaseHandle ?? null;
    const leaseSummary = leaseSession.summary();
    const enrichedArtifact = artifact && typeof artifact === 'object'
      ? {
        ...artifact,
        execution: {
          ...(artifact.execution || {}),
          registeredModule: entry.descriptor.methodKey,
          gpuLeaseStatus: gpuLease?.status ?? artifact.execution?.gpuLeaseStatus ?? null,
          residentLeaseSession: leaseSummary
        }
      }
      : artifact;

    return {
      matched: true,
      methodKey: entry.descriptor.methodKey,
      artifact: enrichedArtifact,
      leaseHandle,
      leaseSession,
      leaseSummary
    };
  }

  return Object.freeze({
    schema: ULG_SIMULATION_MODULE_REGISTRATION_SCHEMA,
    registerModule,
    resolveModule,
    hasModule,
    listModules,
    unregisterModule,
    getModuleLeaseSession,
    resetModuleSession,
    dispatchSimulationStepCapsule
  });
}

/**
 * Exact symplectic-Euler softened Newtonian N-body step matching the
 * `eshkols-in-space` body layout (`[x, y, z, mass, vx, vy, vz, radius]`, 8 f32
 * floats per body) with optional momentum- and volume-conserving sticky contact
 * mergers. Suitable both as a standalone CPU reference and as a host-side
 * oracle for WebGPU Barnes-Hut/direct adapters plugged via `SimulationModuleRegistry`.
 */
export function stepNBodyInterleavedReference(bodiesInput, {
  dt = 0.015,
  gravity = 1.0,
  softening = 0.18,
  collisions = false
} = {}) {
  const src = bodiesInput instanceof Float32Array ? bodiesInput : Float32Array.from(bodiesInput);
  if (src.length % 8 !== 0) {
    throw new RangeError('Interleaved N-body tensor length must be a multiple of 8 floats');
  }
  const count = src.length / 8;
  const out = new Float32Array(src.length);
  const eps2 = softening * softening;

  for (let i = 0; i < count; i += 1) {
    const bi = i * 8;
    const mi = src[bi + 3];
    if (!(mi > 0)) continue;
    const xi = src[bi + 0];
    const yi = src[bi + 1];
    const zi = src[bi + 2];
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (let j = 0; j < count; j += 1) {
      if (i === j) continue;
      const bj = j * 8;
      const mj = src[bj + 3];
      if (!(mj > 0)) continue;
      const dx = src[bj + 0] - xi;
      const dy = src[bj + 1] - yi;
      const dz = src[bj + 2] - zi;
      const r2 = dx * dx + dy * dy + dz * dz + eps2;
      const invR3 = (gravity * mj) / (r2 * Math.sqrt(r2));
      ax += dx * invR3;
      ay += dy * invR3;
      az += dz * invR3;
    }
    const vx = src[bi + 4] + dt * ax;
    const vy = src[bi + 5] + dt * ay;
    const vz = src[bi + 6] + dt * az;
    out[bi + 0] = xi + dt * vx;
    out[bi + 1] = yi + dt * vy;
    out[bi + 2] = zi + dt * vz;
    out[bi + 3] = mi;
    out[bi + 4] = vx;
    out[bi + 5] = vy;
    out[bi + 6] = vz;
    out[bi + 7] = src[bi + 7];
  }

  if (collisions) {
    const partner = new Int32Array(count).fill(-1);
    for (let i = 0; i < count; i += 1) {
      const bi = i * 8;
      if (!(out[bi + 3] > 0)) continue;
      for (let j = 0; j < count; j += 1) {
        if (i === j) continue;
        const bj = j * 8;
        if (!(out[bj + 3] > 0)) continue;
        const dist = Math.hypot(
          out[bi + 0] - out[bj + 0],
          out[bi + 1] - out[bj + 1],
          out[bi + 2] - out[bj + 2]
        );
        if (dist <= out[bi + 7] + out[bj + 7]) {
          partner[i] = j;
          break;
        }
      }
    }
    for (let i = 0; i < count; i += 1) {
      const j = partner[i];
      if (j > i && partner[j] === i) {
        const bi = i * 8;
        const bj = j * 8;
        const mi = out[bi + 3];
        const mj = out[bj + 3];
        const mt = mi + mj;
        out[bi + 0] = (mi * out[bi + 0] + mj * out[bj + 0]) / mt;
        out[bi + 1] = (mi * out[bi + 1] + mj * out[bj + 1]) / mt;
        out[bi + 2] = (mi * out[bi + 2] + mj * out[bj + 2]) / mt;
        out[bi + 3] = mt;
        out[bi + 4] = (mi * out[bi + 4] + mj * out[bj + 4]) / mt;
        out[bi + 5] = (mi * out[bi + 5] + mj * out[bj + 5]) / mt;
        out[bi + 6] = (mi * out[bi + 6] + mj * out[bj + 6]) / mt;
        out[bi + 7] = Math.cbrt(out[bi + 7] ** 3 + out[bj + 7] ** 3);
        out.fill(0, bj, bj + 8);
      }
    }
  }

  let activeCount = 0;
  for (let i = 0; i < count; i += 1) {
    if (out[i * 8 + 3] > 0) activeCount += 1;
  }
  return { bodies: out, activeCount, slotCount: count };
}

/**
 * Create a ULG simulation-module registration for `nbody-gravity@1` matching
 * `eshkols-in-space/plan/refs/ulg.md`. Accepts either an external resident
 * WebGPU simulation instance (`{ step, stepResident, count, activeCount, stepIndex, gravityMode, dispose }`)
 * or initial interleaved bodies using the built-in symplectic-Euler reference.
 */
export function createNBodyGravityModuleRegistration({
  initialBodies = null,
  simulation = null,
  externalRunner = null,
  scaleRangeM = [1e6, 1e27]
} = {}) {
  let stateBodies = initialBodies ? Float32Array.from(initialBodies) : null;
  let internalStepIndex = simulation?.stepIndex ?? 0;

  const stateLayout = {
    tensorId: 'bodies',
    dtype: 'f32',
    layout: 'interleaved',
    strideElements: 8,
    strideBytes: 32,
    fields: ['x', 'y', 'z', 'mass', 'vx', 'vy', 'vz', 'radius']
  };

  return {
    method: { model: 'nbody-gravity', version: 1 },
    kernel: {
      sourceModule: 'physics/nbody.esk',
      entryPoint: 'main',
      workgroupSize: 64
    },
    parameterSchema: {
      dt: { type: 'number', min: 0, required: true },
      gravity: { type: 'number', min: 0, required: true },
      softening: { type: 'number', min: 0, required: true },
      collisions: { type: 'boolean', required: false }
    },
    stateLayout,
    scaleRangeM,
    async stepCapsule(capsule, { createSimulationArtifact: makeArtifact, device, leaseSession }) {
      const { stepIndex, parameters } = capsule.input || {};
      const expectedStep = simulation ? simulation.stepIndex : internalStepIndex;
      if (!Number.isSafeInteger(stepIndex) || stepIndex < 0 || stepIndex !== expectedStep) {
        throw new RangeError(`Requested stepIndex ${stepIndex} does not match resident simulation step ${expectedStep}`);
      }

      if (typeof externalRunner === 'function' && simulation) {
        const artifact = await externalRunner(capsule, {
          simulation,
          createSimulationArtifact: makeArtifact
        });
        const values = artifact?.outputs?.finalState?.values ?? [];
        const liveBuf = typeof simulation.getResidentBuffer === 'function'
          ? simulation.getResidentBuffer()
          : null;
        leaseSession.publishBuffer({
          resourceKey: 'bodies',
          buffer: liveBuf,
          byteLength: values.length * Float32Array.BYTES_PER_ELEMENT,
          rowCount: simulation.count,
          layout: stateLayout,
          stepIndex: stepIndex + 1,
          portableSnapshotFn: () => Float32Array.from(values)
        });
        const leaseHandle = leaseSession.borrowBufferReadLease({
          resourceKey: 'bodies',
          consumerStage: 'ulg-host-consumer',
          reason: 'post-step-read-lease'
        });
        return { artifact, leaseHandle };
      }

      if (!stateBodies) {
        const seedBodies = capsule.input?.initialBodies;
        if (!seedBodies) {
          throw new Error('nbody-gravity module has no resident bodies and capsule.input.initialBodies was not provided');
        }
        stateBodies = Float32Array.from(seedBodies);
      }

      const stepped = stepNBodyInterleavedReference(stateBodies, parameters);
      stateBodies = stepped.bodies;
      internalStepIndex = stepIndex + 1;

      const finite = stateBodies.every(Number.isFinite);
      if (!finite) {
        throw new Error('nbody-gravity step produced non-finite body state');
      }

      let gpuBuffer = null;
      if (device && typeof device.createBuffer === 'function') {
        gpuBuffer = device.createBuffer({
          label: `ulg-nbody-bodies-step-${internalStepIndex}`,
          size: Math.max(32, stateBodies.byteLength),
          usage: 0x0080 | 0x0008 | 0x0004 // STORAGE | COPY_DST | COPY_SRC
        });
        device.queue.writeBuffer(gpuBuffer, 0, stateBodies);
      }

      leaseSession.publishBuffer({
        resourceKey: 'bodies',
        buffer: gpuBuffer,
        byteLength: stateBodies.byteLength,
        rowCount: stepped.slotCount,
        layout: stateLayout,
        stepIndex: internalStepIndex,
        portableSnapshotFn: () => Float32Array.from(stateBodies)
      });
      const leaseHandle = leaseSession.borrowBufferReadLease({
        resourceKey: 'bodies',
        consumerStage: 'ulg-host-consumer',
        reason: 'post-step-read-lease'
      });

      const artifact = makeArtifact({
        artifactId: `${capsule.taskId}:nbody:${internalStepIndex}`,
        taskKind: capsule.taskKind,
        closureRef: { module: 'physics/nbody.esk', entryPoint: 'step-world', kernelEntryPoint: 'main' },
        representation: 'nbody-interleaved-f32',
        outputs: {
          deltas: [{ operation: 'replace', tensorId: 'bodies', fromStep: stepIndex, toStep: internalStepIndex }],
          finalState: {
            tensorId: 'bodies',
            dtype: 'f32',
            layout: 'interleaved',
            shape: [stepped.slotCount, 8],
            stepIndex: internalStepIndex,
            values: Array.from(stateBodies)
          }
        },
        execution: {
          backend: gpuBuffer ? 'webgpu-staged-reference' : 'cpu-reference',
          stage: 'eshkol.nbody.step',
          placement: 'local',
          gravityMode: stepped.slotCount > 16384 ? 'barnes-hut-tree' : 'direct-pairs'
        },
        validity: {
          finite,
          bodyCount: stepped.activeCount,
          slotCount: stepped.slotCount
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
    },
    reset({ nextStep = 0 }) {
      internalStepIndex = nextStep;
      stateBodies = initialBodies ? Float32Array.from(initialBodies) : null;
    },
    dispose() {
      simulation?.dispose?.();
      stateBodies = null;
    }
  };
}

export const defaultSimulationModuleRegistry = createSimulationModuleRegistry();
export const registerSimulationModule = (spec) => defaultSimulationModuleRegistry.registerModule(spec);
export const unregisterSimulationModule = (method) => defaultSimulationModuleRegistry.unregisterModule(method);
export const listSimulationModules = () => defaultSimulationModuleRegistry.listModules();
export const resolveSimulationModule = (method) => defaultSimulationModuleRegistry.resolveModule(method);
export const resetSimulationModuleSession = (method, options) => defaultSimulationModuleRegistry.resetModuleSession(method, options);
export const dispatchSimulationStepCapsule = (capsule, options) => defaultSimulationModuleRegistry.dispatchSimulationStepCapsule(capsule, options);
