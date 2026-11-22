import {
  acquireQueueOrderedPooledBuffer,
  computeBufferBinding,
  createCachedExplicitBindGroup,
  prewarmCachedExplicitComputePipeline,
  deferConfirmedSubmittedWorkCleanup,
  registerQueueOrderedPooledBufferReturn,
  releaseOrDestroyQueueOrderedPooledBuffer
} from '../webgpuComputeLayout.js';
import { createSphExactMechanicsQuantityRefreshWgsl } from './sphExactMechanicsRefreshWgsl.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { markSphExactMassPlacementDerivedBuffers, markSphExactMassDerivedBuffers } from './sphGpuBuffers.js';

export function planSphExactMechanicsRestoreDispatch(particleCount, recordWords, maxWorkgroupsPerDimension) {
  const words = particleCount * recordWords;
  if (![particleCount, recordWords, maxWorkgroupsPerDimension].every(n => Number.isSafeInteger(n) && n > 0)
      || !Number.isSafeInteger(words) || words > 0x3fffffff) {
    throw new RangeError('Exact mechanics restore exceeds checked addressing');
  }
  const groups = Math.ceil(words / 64), x = Math.min(groups, maxWorkgroupsPerDimension);
  const y = Math.ceil(groups / x);
  if (y > maxWorkgroupsPerDimension || x * y * 64 > 0xffffffff) {
    throw new RangeError('Exact mechanics restore exceeds device dispatch capacity');
  }
  return Object.freeze({ x, y, z: 1 });
}

// This prepares arithmetic and storage only. The mechanics runner's private
// capture registry authenticates the final refresh; this helper cannot issue it.
export async function prepareSphExactMechanicsRefresh(args) {
  const fromThermal = args.exactThermalResult != null;
  const fromVapor = args.exactVaporProducerRead != null;
  const fromPhase = args.exactPhaseResult != null;
  let seal, held, exact, source;
  if (fromPhase) {
    if (fromThermal || fromVapor || args.exactReactionResult != null) throw new TypeError('Exact refresh requires one original producer');
    const { resolveSphPhaseCarrierTransferSourceCapture } = await import('./sphPhaseCarrierTransferGpu.js');
    seal = resolveSphPhaseCarrierTransferSourceCapture(args.exactPhaseResult, args.exactPhaseSourceCapture);
    held = seal.retain(); exact = seal.exactPhase; source = exact;
  } else if (fromVapor) {
    if (fromThermal || args.exactReactionResult != null || args.exactReactionSourceCapture != null
        || args.exactThermalSourceCapture != null) {
      throw new TypeError('Exact refresh requires one original producer');
    }
    const { resolveSphSpatialVaporAerosolProducerRead: resolve,
      forkSphSpatialVaporAerosolProducerRead: fork,
      releaseSphSpatialVaporAerosolProducerRead: release } = await import('./sphSpatialGasLedgerEosGpu.js');
    const token = fork(args.exactVaporProducerRead, { device: args.device });
    exact = resolve(token, { device: args.device });
    held = { validate: () => resolve(token, { device: args.device }), release: () => release(token) };
    seal = { validate: held.validate, inputs: exact.sourcePacket };
    source = { ...exact, quantityBuffer: exact.endpoints.particleBuffer,
      quantityLayout: exact.endpoints.particleLayout };
  } else if (fromThermal) {
    if (args.exactReactionResult != null) throw new TypeError('Exact refresh cannot combine reaction and thermal sources');
    const { acquireSphThermalExactMassSourceCapture, resolveSphThermalSourceCapture } = await import('./sphThermalGpuKernel.js');
    seal = resolveSphThermalSourceCapture(args.exactThermalResult, args.exactThermalSourceCapture);
    held = await acquireSphThermalExactMassSourceCapture(args.exactThermalResult, args.exactThermalSourceCapture,
      { device: args.device, sphParticleUpload: args.sphParticleUpload, mlsMpmParticleUpload: args.mlsMpmParticleUpload,
        sphParticleState: args.sphParticleState, g2pResult: args.exactMassG2pResult,
        transaction: args.exactMassSpatialEpochTransaction, generation: args.exactMassSpatialEpochGeneration,
        dtSeconds: args.dtSeconds, thermalMaterialTable: args.thermalMaterialTable });
    exact = held.quantities;
    source = exact && { ...exact, stateBuffer: held.stateBuffer, thermoBuffer: held.thermoBuffer,
      mechanicsBuffer: held.mechanicsBuffer, particleCount: held.particleCount };
  } else {
    const { resolveSphReactionSourceCapture } = await import('./sphReactionGpuKernel.js');
    seal = resolveSphReactionSourceCapture(args.exactReactionResult, args.exactReactionSourceCapture);
    held = seal.retain(); exact = seal.exactReaction; source = exact?.destinationRead;
  }
  const owned = [], transient = [], acceptance = [];
  let submitted = false, retired = false, heldReleased = false, quantitiesTransferred = false, sourceCleanup = null;
  const releaseSource = () => {
    if (!heldReleased) {
      heldReleased = true;
      const cleanup = () => { destroy(acceptance, submitted); return held.release(); };
      sourceCleanup = fromVapor && submitted ? deferConfirmedSubmittedWorkCleanup(args.device, cleanup)
        : Promise.resolve(cleanup());
      void sourceCleanup.catch(() => {});
    }
    return sourceCleanup;
  };
  const destroy = (list, allowPool = false) => {
    for (const buffer of list.splice(0)) {
      releaseOrDestroyQueueOrderedPooledBuffer(buffer, { allowPool });
    }
  };
  const validate = () => {
    seal.validate(); held.validate();
    if (!source || args.device !== seal.inputs.device || args.sphParticleState !== seal.inputs.sphParticleState
        || (!fromThermal && args.mlsMpmParticleState !== seal.inputs.mlsMpmParticleState)
        || args.sourceStateBuffer !== source.stateBuffer || args.sourceThermoBuffer !== source.thermoBuffer
        || args.sourceMechanicsBuffer !== source.mechanicsBuffer
        || args.retainOutputParticleBuffers !== true || args.readbackMode !== 'no-full-readback'
        || !args.postMechanicsSourceCapture) {
      throw new TypeError('Exact mechanics refresh requires the original captured reaction tuple and retained capture');
    }
  };
  const abandon = () => {
    const cleanup = () => { destroy(transient); destroy(owned); retired = true; return releaseSource(); };
    return submitted ? deferConfirmedSubmittedWorkCleanup(args.device, cleanup) : Promise.resolve().then(cleanup);
  };
  try {
    validate();
    const { device } = args, { quantityLayout: layout, format, particleCount: count } = source;
    const byteLength = count * layout.recordWords * 4;
    if (!Number.isSafeInteger(byteLength) || byteLength > device.limits.maxStorageBufferBindingSize
        || byteLength > device.limits.maxBufferSize || Math.ceil(count * 3 / 32) > device.limits.maxComputeWorkgroupsPerDimension) {
      throw new RangeError('Exact mechanics refresh exceeds device capacity');
    }
    const restoreDispatch = planSphExactMechanicsRestoreDispatch(count, layout.recordWords,
      device.limits.maxComputeWorkgroupsPerDimension);
    const usePool = Boolean(
      typeof globalThis.GPUDevice === 'function'
      && device instanceof globalThis.GPUDevice
    );
    const allocate = (label, size, usage, list, poolKey = null) => {
      const buffer = tagWebGpuBufferDevice(
        usePool && poolKey
          ? registerQueueOrderedPooledBufferReturn(
              acquireQueueOrderedPooledBuffer(device, { bucketKey: poolKey, label, size, usage }),
              device,
              { bucketKey: poolKey, size, usage }
            )
          : device.createBuffer({ label, size, usage }),
        device
      );
      list.push(buffer); return buffer;
    };
    const quantityBuffer = allocate('ulg-exact-mechanics-refresh-quantities', byteLength, 128 | 8 | 4, owned);
    if (fromPhase) await exact.markDerivedBuffers([quantityBuffer]);
    else if (fromVapor) markSphExactMassDerivedBuffers(exact.sourceParticleRead, [quantityBuffer]);
    else if (fromThermal) markSphExactMassDerivedBuffers(held.sourceRead, [quantityBuffer]);
    else await markSphExactMassPlacementDerivedBuffers(source, [quantityBuffer], { device });
    validate();
    const projectionBuffer = allocate('ulg-exact-mechanics-refresh-projections', count * 16, 128 | 8, transient, 'ulg-exact-mechanics-refresh-projections');
    const params = allocate('ulg-exact-mechanics-refresh-params', 16, 64 | 8, transient, 'ulg-exact-mechanics-refresh-params');
    const scratch = allocate('ulg-exact-mechanics-refresh-scratch', count * 5 * layout.scalar.recordWords * 4, 128 | 8, transient, 'ulg-exact-mechanics-refresh-scratch');
    const code = createSphExactMechanicsQuantityRefreshWgsl(format, layout);
    const pipelines = [];
    for (const entryPoint of ['prepare_exact_mechanics_refresh', 'divide_exact_mechanics_reference',
      'normalize_exact_mechanics_operands', 'divide_exact_mechanics_ratio',
      'project_exact_mechanics_scalar', 'finalize_exact_mechanics_quantities',
      'commit_or_restore_exact_mechanics_quantities']) {
      const pipeline = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint,
        label: `ulg-${entryPoint}`, cacheKey: `ulg-${entryPoint}-v8-${format.wordCount}-${format.quantumExponent}-${layout.scalar.wordCount}`,
        bindings: ['read-only-storage', 'read-only-storage', 'storage', 'storage', 'storage', 'uniform', 'storage']
          .map((type, binding) => computeBufferBinding(binding, type)) });
      if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Exact mechanics refresh unavailable: ${entryPoint}`);
      pipelines.push(pipeline); validate();
    }
    device.queue.writeBuffer(params, 0, new Uint32Array([count, 0, 0, 0]));
    let groups;
    return {
      quantityBuffer, projectionBuffer, quantityLayout: Object.freeze({ ...layout, rowCount: count, wordLength: count * layout.recordWords }),
      source: exact, format, releaseSource, sourceCleanupCompletion: () => sourceCleanup, validate, abandon,
      retainAcceptance: fromVapor,
      retainAcceptanceBuffer(buffer) {
        if (!fromVapor || acceptance.length || heldReleased) throw new TypeError('Exact exchange acceptance owner required');
        acceptance.push(buffer);
      },
      bind(authorityValidationBuffer) {
        validate();
        const resources = [source.quantityBuffer, source.thermoBuffer, quantityBuffer, projectionBuffer, authorityValidationBuffer, params, scratch];
        groups = pipelines.map(pipeline => createCachedExplicitBindGroup(device, {
          layout: pipeline.bindGroupLayout,
          entries: resources.map((buffer, binding) => ({ binding, resource: { buffer } }))
        }));
      },
      encode(encoder, commit = false) {
        validate();
        if (!commit) encoder.copyBufferToBuffer(source.quantityBuffer, 0, quantityBuffer, 0, byteLength);
        for (let index = commit ? 6 : 0; index < (commit ? 7 : 6); index++) {
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipelines[index].pipeline); pass.setBindGroup(0, groups[index]);
          if (commit) pass.dispatchWorkgroups(restoreDispatch.x, restoreDispatch.y, restoreDispatch.z);
          else pass.dispatchWorkgroups(Math.ceil(count * (index === 2 ? 2 : index === 4 ? 3 : 1) / 32));
          pass.end();
        }
      },
      markSubmitted() { submitted = true; },
      cleanupTransient() { destroy(transient, submitted); },
      transferQuantities() {
        if (!submitted || retired || quantitiesTransferred) throw new TypeError('Exact mechanics quantities already transferred or retired');
        quantitiesTransferred = true;
        owned.splice(owned.indexOf(quantityBuffer), 1);
      },
      destroyOutput() { if (!retired) { destroy(owned); releaseSource(); retired = true; } },
      validateOutput() { if (retired) throw new TypeError('Exact mechanics quantities have retired'); return true; }
    };
  } catch (error) {
    const cleanup = abandon(); void cleanup.catch(() => {});
    error.exactMechanicsRefreshCleanupCompletion = cleanup;
    throw error;
  }
}
