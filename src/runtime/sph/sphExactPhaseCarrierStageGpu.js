import { prepareSphExactPhaseCarrierMass } from './sphExactPhaseCarrierMassGpu.js';
import { prepareSphExactPhaseCarrierQuantities } from './sphExactPhaseCarrierQuantityGpu.js';
import { createSphExactPhaseCarrierPhysicalWgsl } from './sphExactPhaseCarrierPhysicalWgsl.js';
import { prepareSphExactPhaseInitialQuantities } from './sphExactPhaseInitialQuantityGpu.js';
import { sphExactPlacementQuantityLayout } from './sphExactPlacementQuantityWgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline, deferConfirmedSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { tagWebGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { markSphExactMassDerivedBuffers, markSphExactMassPlacementDerivedBuffers } from './sphGpuBuffers.js';
import { packSphPhaseCarrierClosureRows, validateSphPhaseCarrierPlan } from './sphPhaseCarrierTransferGpu.js';

// Called only by the standard phase producer. Its private capture registry is
// the source authority; this preparation helper cannot mint a phase capture.
export async function prepareSphExactPhaseCarrierStage(args) {
  const fromThermal = args.exactThermalResult != null;
  if (fromThermal === (args.exactReactionResult != null) || !args.postMechanicsSourceCapture
      || args.retainOutputParticleBuffers !== true || args.readbackMode !== 'no-full-readback') {
    throw new TypeError('Exact phase transfer requires one original retained thermal or reaction capture');
  }
  let seal, held, source, origin, sourceInventoryGeneration;
  if (fromThermal) {
    const { resolveSphThermalSourceCapture, acquireSphThermalExactMassSourceCapture } = await import('./sphThermalGpuKernel.js');
    seal = resolveSphThermalSourceCapture(args.exactThermalResult, args.exactThermalSourceCapture);
    held = await acquireSphThermalExactMassSourceCapture(args.exactThermalResult, args.exactThermalSourceCapture, {
      device: args.device, sphParticleUpload: args.sphParticleUpload, mlsMpmParticleUpload: args.mlsMpmParticleUpload,
      sphParticleState: args.sphParticleState, thermalMaterialTable: args.thermalMaterialTable,
      transaction: args.exactMassSpatialEpochTransaction, generation: args.exactMassSpatialEpochGeneration,
      g2pResult: args.exactMassG2pResult, dtSeconds: args.dtSeconds
    });
    origin = held.quantities;
    source = { ...origin, format: held.format, particleCount: held.particleCount, stateBuffer: held.stateBuffer,
      thermoBuffer: held.thermoBuffer, mechanicsBuffer: held.mechanicsBuffer };
    sourceInventoryGeneration = held.inventoryGeneration;
  } else {
    const { resolveSphReactionSourceCapture } = await import('./sphReactionGpuKernel.js');
    seal = resolveSphReactionSourceCapture(args.exactReactionResult, args.exactReactionSourceCapture);
    held = seal.retain(); origin = seal.exactReaction; source = origin?.destinationRead;
    sourceInventoryGeneration = origin?.carrierMassRead.generation;
  }
  const owned = new Set(), transient = new Set();
  let submitted = false, retired = false, released = false, sourceCleanup = null, massFamily = null, carrierMassRead = null;
  const destroy = buffers => { for (const buffer of buffers) { buffer.destroy(); } buffers.clear(); };
  const releaseSource = () => {
    if (!released) { released = true; sourceCleanup = submitted
      ? deferConfirmedSubmittedWorkCleanup(args.device, () => held.release()) : Promise.resolve(held.release());
      void sourceCleanup.catch(() => {}); }
    return sourceCleanup;
  };
  const abandon = () => {
    const cleanup = () => { destroy(transient); destroy(owned); retired = true; return releaseSource(); };
    return submitted ? deferConfirmedSubmittedWorkCleanup(args.device, cleanup) : Promise.resolve().then(cleanup);
  };
  try {
    const { device } = args;
    const validate = () => {
      if (retired || released) throw new TypeError('Exact phase source was released');
      seal.validate(); held.validate();
      if (!source || args.device !== seal.inputs.device || args.sphParticleState !== seal.inputs.sphParticleState
          || (!fromThermal && args.mlsMpmParticleState !== seal.inputs.mlsMpmParticleState)
          || args.thermalMaterialTable !== seal.inputs.thermalMaterialTable
          || args.sourceStateBuffer !== source.stateBuffer || args.sourceThermoBuffer !== source.thermoBuffer
          || args.sourceMechanicsBuffer !== source.mechanicsBuffer) {
        throw new TypeError('Exact phase transfer requires its complete original captured source tuple');
      }
    };
    validate();
    const count = source.particleCount, format = source.format;
    const plan = validateSphPhaseCarrierPlan(args.phaseCarrierPlan, count);
    if (plan.accepted !== true || plan.phaseLaneCount !== 4 || plan.lineageCapacity * 4 !== count
        || plan.phaseLaneStride !== plan.lineageCapacity) throw new TypeError('Exact phase transfer requires four complete phase lanes');
    const planSnapshot = Object.entries(args.phaseCarrierPlan);
    const closure = packSphPhaseCarrierClosureRows(args.thermalMaterialTable, args.mechanicsMaterialTable);
    const { resolveThermalResponseGraphArtifacts } = await import('./sphThermalGpuKernel.js');
    const artifacts = resolveThermalResponseGraphArtifacts({ thermalMaterialTable: args.thermalMaterialTable, requireExactContent: true });
    const responses = artifacts.thermalPhaseResponseTable, bank = artifacts.thermalClosureGraphBank;
    const graph = new Float32Array(responses.responses.length + bank.nodeRows.length + bank.sampleRows.length);
    graph.set(responses.responses); graph.set(bank.nodeRows, responses.responses.length);
    graph.set(bank.sampleRows, responses.responses.length + bank.nodeRows.length);
    const validateInputs = () => {
      validate();
      if (Object.keys(args.phaseCarrierPlan).length !== planSnapshot.length || planSnapshot.some(([key, value]) => args.phaseCarrierPlan[key] !== value)) {
        throw new TypeError('Exact phase plan changed during preparation');
      }
      const current = packSphPhaseCarrierClosureRows(args.thermalMaterialTable, args.mechanicsMaterialTable).values;
      if (current.length !== closure.values.length || new Uint32Array(current.buffer).some((word, i) => word !== new Uint32Array(closure.values.buffer)[i])) {
        throw new TypeError('Exact phase material tables changed during preparation');
      }
    };
    const allocate = (desc, keep = false) => {
      if (!Number.isSafeInteger(desc.size) || desc.size < 4 || desc.size > device.limits.maxBufferSize
          || ((desc.usage & 128) && desc.size > device.limits.maxStorageBufferBindingSize)) throw new RangeError('Exact phase allocation exceeds device capacity');
      const buffer = tagWebGpuBufferDevice(device.createBuffer(desc), device); (keep ? owned : transient).add(buffer); return buffer;
    };
    const make = (label, size, keep = false, usage = 128 | 8 | 4) => allocate({ label: `ulg-exact-phase-${label}`, size, usage }, keep);
    const upload = (label, data, usage = 128 | 8) => { const b = make(label, Math.max(4, data.byteLength), false, usage); device.queue.writeBuffer(b, 0, data); return b; };
    const sourceLayout = source.quantityLayout ?? sphExactPlacementQuantityLayout(format, { particleCount: count, eventCapacity: 1 });
    const layout = Object.freeze({ ...sourceLayout, rowCount: count, wordLength: count * sourceLayout.recordWords });
    const sourceQuantityBuffer = make('source-quantities', layout.wordLength * 4);
    if (source.quantityBuffer && source.quantityBuffer.size < sourceQuantityBuffer.size) throw new TypeError('Incomplete exact phase source quantities');
    const sourceMassBuffer = make('source-mass', count * format.wordCount * 4);
    let initialQuantities = null;
    if (!source.quantityBuffer) {
      if (!fromThermal || held.quantities || held.sourceRead.quantities
          || held.sourceRead.read.rowCount !== count
          || !(args.thermalMaterialTable.molarMassIdentities instanceof Uint32Array)) {
        throw new TypeError('Initial phase quantities require the original uncaptured thermal tuple and molecular identities');
      }
      initialQuantities = await prepareSphExactPhaseInitialQuantities({ device, format, layout,
        massBuffer: sourceMassBuffer, stateBuffer: source.stateBuffer, thermoBuffer: source.thermoBuffer,
        mechanicsBuffer: source.mechanicsBuffer, quantityBuffer: sourceQuantityBuffer,
        materialMolars: args.thermalMaterialTable.molarMassIdentities, allocate, validate: validateInputs });
    }
    const geometryBuffer = make('geometry', count * 32);
    const mass = await prepareSphExactPhaseCarrierMass({ device, format, lineageCapacity: plan.lineageCapacity,
      sourceMassBuffer, sourceThermoBuffer: source.thermoBuffer, allocate, validate: validateInputs });
    const quantity = await prepareSphExactPhaseCarrierQuantities({ device, format, layout, sourceQuantityBuffer,
      packetMassBuffer: mass.packetMassBuffer, candidateMassBuffer: mass.massBuffer, geometryBuffer,
      validationBuffer: mass.validationBuffer, lineageCapacity: plan.lineageCapacity, allocate, validate: validateInputs });
    transient.delete(quantity.quantityBuffer); owned.add(quantity.quantityBuffer);
    const outState = make('state', count * 32, true), outThermo = make('thermo', count * 48, true), outMechanics = make('mechanics', count * 128, true);
    const outputBuffers = [outState, outThermo, outMechanics, quantity.quantityBuffer];
    if (fromThermal) markSphExactMassDerivedBuffers(held.sourceRead, outputBuffers);
    else await markSphExactMassPlacementDerivedBuffers(source, outputBuffers, { device });
    const closureBuffer = upload('closure', closure.values), graphBuffer = upload('caloric', graph);
    const parameterBytes = new ArrayBuffer(80), p = new Uint32Array(parameterBytes), f = new Float32Array(parameterBytes);
    p.set([count, plan.lineageCapacity, 4, plan.lineageCapacity, closure.thermalSegmentCount, closure.mechanicsRecordCount,
      closure.thermalOffsetVec4, closure.mechanicsOffsetVec4, 254]); f[9] = 1e-7; f[10] = 2e-4;
    p[12] = closure.materialRecordCount; p[13] = closure.materialRecordOffsetVec4; p[14] = args.absolutePressureAuthority === true ? 1 : 0;
    p.set([responses.responseCount, responses.responses.length / 4, (responses.responses.length + bank.nodeRows.length) / 4, bank.graphCount], 16);
    const params = upload('physical-params', parameterBytes, 64 | 8);
    const physicalCode = createSphExactPhaseCarrierPhysicalWgsl(format);
    const resources = [source.stateBuffer, source.thermoBuffer, source.mechanicsBuffer, closureBuffer, mass.packetMassBuffer,
      geometryBuffer, quantity.projectionBuffer, graphBuffer, outState, outThermo, outMechanics, mass.validationBuffer, params];
    const types = [...Array(5).fill('read-only-storage'), 'storage', 'read-only-storage', 'read-only-storage', ...Array(4).fill('storage'), 'uniform'];
    const pipelines = [];
    for (const entryPoint of ['prepare_phase_geometry', 'apply_phase_physical', 'restore_rejected_phase_physical']) {
      const pipeline = await prewarmCachedExplicitComputePipeline(device, { code: physicalCode, entryPoint,
        label: entryPoint, cacheKey: `ulg-exact-${entryPoint}-v1:${format.wordCount}`,
        bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
      if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Phase physical pipeline unavailable: ${entryPoint}`);
      pipelines.push({ pipeline, group: device.createBindGroup({ layout: pipeline.bindGroupLayout,
        entries: resources.map((buffer, binding) => ({ binding, resource: { buffer } })) }) }); validateInputs();
    }
    const gatherCode = `@group(0) @binding(0) var<storage, read> q: array<u32>;
@group(0) @binding(1) var<storage, read_write> m: array<u32>;
@compute @workgroup_size(64) fn gather_phase_source(@builtin(global_invocation_id) id: vec3<u32>) {
 let i=id.x; if(i<arrayLength(&m)){m[i]=q[(i/${format.wordCount}u)*${layout.recordWords}u+16u+i%${format.wordCount}u];}}`;
    const gather = await prewarmCachedExplicitComputePipeline(device, { code: gatherCode, entryPoint: 'gather_phase_source',
      cacheKey: `ulg-phase-source-mass-v1:${format.wordCount}:${layout.recordWords}`,
      bindings: ['read-only-storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type)) });
    if (!gather.pipeline) throw gather.error ?? new Error('Phase source mass gather unavailable');
    const gatherGroup = device.createBindGroup({ layout: gather.bindGroupLayout,
      entries: [sourceQuantityBuffer, sourceMassBuffer].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const run = (encoder, pipeline, group, groups) => { const pass = encoder.beginComputePass(); pass.setPipeline(pipeline.pipeline);
      pass.setBindGroup(0, group); pass.dispatchWorkgroups(groups); pass.end(); };
    const components = { state: outState, thermo: outThermo, mechanics: outMechanics };
    const cleanupComponents = selected => {
      for (const [key, b] of Object.entries(components)) if (selected[key] && owned.delete(b)) {
        b.destroy(); retired = true;
        result[`owns${key[0].toUpperCase()}${key.slice(1)}Buffer`] = false;
      }
      if (!Object.values(components).some(b => owned.has(b))) {
        if (owned.delete(quantity.quantityBuffer)) quantity.quantityBuffer.destroy();
        if (owned.delete(mass.validationBuffer)) mass.validationBuffer.destroy(); retired = true;
      }
      return true;
    };
    const result = { schema: 'peercompute.ulg.sph-phase-carrier-transfer.v2', status: 'phase-carrier-transfer-submitted', backend: 'webgpu',
      readbackMode: args.readbackMode, particleCount: count, phaseCarrierPlan: { ...args.phaseCarrierPlan },
      stateBuffer: outState, thermoBuffer: outThermo, mechanicsBuffer: outMechanics,
      stateBufferByteLength: outState.size, thermoBufferByteLength: outThermo.size, mechanicsBufferByteLength: outMechanics.size,
      ownsStateBuffer: true, ownsThermoBuffer: true, ownsMechanicsBuffer: true, retainedOutputParticleBuffers: true,
      state: new Float32Array(), thermo: new Float32Array(), mechanics: new Float32Array(),
      exactValidationBuffer: mass.validationBuffer,
      destroyOutputParticleBuffers: () => cleanupComponents({ state: true, thermo: true, mechanics: true }),
      destroyOutputParticleBufferComponents: cleanupComponents };
    // Validation stays with the output so GPU rejection is observable after
    // queue-ordered transient retirement; numerical rollback is global.
    transient.delete(mass.validationBuffer); owned.add(mass.validationBuffer);
    const exactPhase = Object.freeze({ quantityBuffer: quantity.quantityBuffer, quantityLayout: layout, format,
      particleCount: count, sourceInventoryGeneration, source: origin ?? seal,
      stateBuffer: outState, thermoBuffer: outThermo, mechanicsBuffer: outMechanics,
      get carrierMassRead() { return carrierMassRead; },
      markDerivedBuffers(buffers) { if (fromThermal) return markSphExactMassDerivedBuffers(held.sourceRead, buffers);
        return markSphExactMassPlacementDerivedBuffers(source, buffers, { device }); }
    });
    return { result, exactPhase, releaseSource, abandon,
      releaseQuantityStorage() {
        return deferConfirmedSubmittedWorkCleanup(device, () => {
          for (const buffer of [quantity.quantityBuffer, mass.validationBuffer]) if (owned.delete(buffer)) buffer.destroy();
        });
      },
      validateOutput() { if (retired) throw new TypeError('Exact phase output retired'); return true; },
      encode(encoder) {
        validateInputs();
        if (initialQuantities) {
          encoder.copyBufferToBuffer(held.sourceRead.read.buffer, held.sourceRead.read.byteOffset,
            sourceMassBuffer, 0, sourceMassBuffer.size); initialQuantities.encode(encoder);
        } else encoder.copyBufferToBuffer(source.quantityBuffer, 0, sourceQuantityBuffer, 0, sourceQuantityBuffer.size);
        run(encoder, gather, gatherGroup, Math.ceil(count * format.wordCount / 64)); mass.encode(encoder);
        run(encoder, pipelines[0].pipeline, pipelines[0].group, Math.ceil(count / 64)); quantity.encode(encoder);
        for (const entry of pipelines.slice(1)) run(encoder, entry.pipeline, entry.group, Math.ceil(count / 64)); quantity.commit(encoder);
      },
      markSubmitted() { submitted = true; },
      cleanupSubmittedWork() { destroy(transient); },
      cleanupRetainedOutput: result.destroyOutputParticleBuffers,
      cleanupRetainedOutputComponents: cleanupComponents,
      async completeInventory(result, token) {
        const { createSphExactMassInventoryFromPhaseTransferWebGpu, acquireSphExactMassRead } = await import('./sphExactMassInventoryGpu.js');
        massFamily = await createSphExactMassInventoryFromPhaseTransferWebGpu({ device, result, token });
        carrierMassRead = acquireSphExactMassRead({ device, family: massFamily });
      },
      async releaseInventory() {
        const { releaseSphExactMassRead, releaseSphExactMassInventory } = await import('./sphExactMassInventoryGpu.js');
        if (carrierMassRead) await releaseSphExactMassRead(carrierMassRead, { deferInBurst: true });
        if (massFamily) await releaseSphExactMassInventory(massFamily);
      }
    };
  } catch (error) { const cleanup = abandon(); void cleanup.catch(() => {}); error.exactPhaseCleanupCompletion = cleanup; throw error; }
}
