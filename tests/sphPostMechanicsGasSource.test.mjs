import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { createSphState } from '../src/runtime/sph/sphState.js';
import { buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers } from '../src/runtime/sph/sphGpuBuffers.js';
import { buildSphThermalMaterialTable, runSphThermalStepWebGpu,
  resolveSphThermalSourceCapture } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { buildMlsMpmMechanicsMaterialTable } from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import { runMlsMpmMechanicsRefreshWebGpu, resolveMlsMpmMechanicsRefreshSourceCapture,
  createPostMechanicsStageOutputSeal } from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import { runSphReactionStepWebGpu, resolveSphReactionSourceCapture } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { resolveSphPhaseCarrierTransferSourceCapture } from '../src/runtime/sph/sphPhaseCarrierTransferGpu.js';
import { runSchroederLevelAssignmentWebGpu } from '../src/runtime/sph/schroederHierarchyGpu.js';
import { runSchroederSpatialEpochGenerationWebGpu } from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import { createSchroederSpatialEpochTransaction } from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { runMlsMpmPostMechanicsClosureWebGpu, acquireMlsMpmPostMechanicsGasSourceRead,
  resolveMlsMpmPostMechanicsGasSourceRead, releaseMlsMpmPostMechanicsGasSourceReadAfterQueue,
  claimMlsMpmPostMechanicsContinuation, retireMlsMpmPostMechanicsClosureOutputsAfter
} from '../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import { mergeResidentProductMassBuffersWebGpu, resolveResidentProductMassMergeSourceCapture
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import { tagWebGpuBufferDevice, tagResidentProductMassDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { createResidentProductMassHandle } from '../src/runtime/sph/sphReactionGpuSummary.js';
import { createResidentProductEventCountControlWords, registerResidentProductEventCountAuthority
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { createSphAerosolParcelFamilyWebGpu, releaseSphAerosolParcelFamily,
  validateSphAerosolParcelRead } from '../src/runtime/sph/sphAerosolParcelGpu.js';
import { runSphPostMechanicsGasStateWebGpu, releaseSphPostMechanicsGasStateAfterQueue
} from '../src/runtime/sph/sphPostMechanicsGasStateGpu.js';

// Owner/control-flow double only: these tests make no numerical physics claim.
function deviceDouble() {
  let lose;
  const device = { buffers: [], fences: [], deferred: false, failFence: false, submissions: 0,
    lost: new Promise((resolve) => { lose = resolve; }), lose: () => lose({ reason: 'destroyed' }),
    limits: { maxBufferSize: 2 ** 28, maxStorageBufferBindingSize: 2 ** 28, maxComputeWorkgroupsPerDimension: 65535 },
    createBuffer(d) {
      const buffer = tagWebGpuBufferDevice({ ...d, destroyed: false,
        destroy() { this.destroyed = true; }, mapAsync: async () => {},
        getMappedRange: () => new ArrayBuffer(d.size), unmap() {} }, device);
      device.buffers.push(buffer); return buffer;
    },
    createShaderModule: (d) => d, createBindGroupLayout: (d) => d,
    createPipelineLayout: (d) => d,
    createComputePipeline: (d) => ({ ...d, getBindGroupLayout: () => ({}) }), createBindGroup: (d) => d,
    createCommandEncoder() { return { clearBuffer() {}, copyBufferToBuffer() {},
      beginComputePass() { return { setPipeline() {}, setBindGroup() {}, dispatchWorkgroups() {},
        dispatchWorkgroupsIndirect() {}, end() {} }; }, finish: () => ({}) }; },
    queue: { writeBuffer() {}, submit() { device.submissions++; }, onSubmittedWorkDone() {
      if (device.failFence) return Promise.reject(new Error('unconfirmed device fence'));
      if (!device.deferred) return Promise.resolve();
      return new Promise((resolve) => device.fences.push(resolve));
    } },
    async finish() { for (let i = 0; i < 20; i++) {
      device.fences.splice(0).forEach((resolve) => resolve()); await Promise.resolve();
    } }
  };
  return device;
}

function packedInputs(device = deviceDouble()) {
  const materialProperties = { h2o: createReferenceMaterialClosures().h2o.properties };
  const state = createSphState({ smoothingLengthM: 0.25, particles: [{ material: 'h2o',
    massKg: 1, x: [0.5, 0.5, 0.5], v: [0, 0, 0],
    specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.h2o, 300) }] });
  state.topologyEpoch = 1;
  const sphParticleState = buildSphGpuParticleBuffers(state, { materialProperties });
  const mlsMpmParticleState = buildMlsMpmGpuParticleBuffers(state, { materialProperties });
  const sphParticleUpload = uploadSphGpuParticleBuffers(device, sphParticleState);
  const mlsMpmParticleUpload = uploadMlsMpmGpuParticleBuffers(device, mlsMpmParticleState);
  const epoch = { storageGeneration: 1, physicsTick: 2, physicsSubstep: 0, positionEpoch: 2,
    topologyEpoch: 1, chartEpoch: 0, levelEpoch: 2, supportEpoch: 2 };
  Object.assign(sphParticleUpload, epoch); Object.assign(mlsMpmParticleUpload, epoch);
  return { device, sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
    sourceStateBuffer: sphParticleUpload.stateBuffer, sourceThermoBuffer: sphParticleUpload.thermoBuffer,
    sourceMechanicsBuffer: mlsMpmParticleUpload.mechanicsBuffer,
    thermalMaterialTable: buildSphThermalMaterialTable(materialProperties),
    mechanicsMaterialTable: buildMlsMpmMechanicsMaterialTable(materialProperties),
    readbackMode: 'no-full-readback', retainOutputParticleBuffers: true, dtS: 0.002,
    dtSeconds: 0.002, boxDimsM: [2, 2, 2], expectedEpochIdentity: epoch };
}

async function closureInputs({ withAerosol = false } = {}) {
  const inputs = packedInputs();
  if (withAerosol) inputs.sphParticleUpload.aerosolFamily = createSphAerosolParcelFamilyWebGpu({
    device: inputs.device, capacity: 1, parcels: [],
    provenance: { kind: 'initial-conditions', reference: 'declared empty owner test reservoir' } });
  const assignment = await runSchroederLevelAssignmentWebGpu({ ...inputs,
    baseGridSpacingM: 0.25, minLevel: 0, maxLevel: 0, retainAssignmentBuffer: true });
  const generation = runSchroederSpatialEpochGenerationWebGpu({ device: inputs.device,
    levelAssignment: assignment, particleCount: inputs.sphParticleState.particleCount,
    particleIdentityBuffer: inputs.sphParticleUpload.identityBuffer,
    particleIdentityStrideWords: inputs.sphParticleUpload.identityStrideBytes / 4,
    mechanicsGrid: { gridSpacingM: 0.25, gridDims: [13, 13, 13], gridNodeCount: 2197, gridShift: 2 }, selectedLevel: 0 });
  assert.equal(generation.ready, true, generation.reason);
  const transaction = createSchroederSpatialEpochTransaction({ device: inputs.device, generation,
    sphParticleUpload: inputs.sphParticleUpload, mlsMpmParticleUpload: inputs.mlsMpmParticleUpload,
    requiredReaderIds: [] });
  return { ...inputs, schroederSpatialEpochGeneration: generation,
    schroederSpatialEpochTransaction: transaction, gasSourceLevelAssignment: assignment,
    captureGasSource: true, postMechanicsParticleBuffers: {
      stateBuffer: inputs.sourceStateBuffer, mechanicsBuffer: inputs.sourceMechanicsBuffer },
    // This fixture has no transfer plan or reaction table: those stages are inactive.
    thermalStepOptions: { conductionRate: 0, wallRate: 0 } };
}

function historyHandle(device, generation = 1, gpuCount = true) {
  const productEventBuffer = device.createBuffer({ label: `test-history-${generation}`, size: 128, usage: 128 | 4 | 8 });
  const handle = createResidentProductMassHandle({ productEventBuffer, productEventDevice: device,
    productEventBufferRetained: true, productEventBufferByteLength: 128, productEventRowCount: 1,
    productEventActiveEventCount: 1, destroyProductEventBuffer: () => productEventBuffer.destroy() });
  tagResidentProductMassDevice(handle, device);
  if (!gpuCount) return handle;
  const words = createResidentProductEventCountControlWords({ liveRowCount: 1, rowCapacity: 1,
    rowStrideVec4: 8, generation, seal: generation + 1000 });
  const controlBuffer = device.createBuffer({ label: 'test-history-count', size: words.byteLength, usage: 128 | 4 | 8 });
  device.queue.writeBuffer(controlBuffer, 0, words);
  registerResidentProductEventCountAuthority(handle, { device, controlBuffer, controlOffsetBytes: 0,
    rowCapacity: 1, rowStrideFloats: 32, generation, seal: generation + 1000 });
  return handle;
}

test('standard producer seals reject structural/copied receipts and exact-token replay', async () => {
  const args = packedInputs(), token = Object.freeze({});
  const output = await runSphThermalStepWebGpu({ ...args, postMechanicsSourceCapture: token });
  const seal = resolveSphThermalSourceCapture(output, token);
  assert.equal(seal.inputs.sourceStateBuffer, args.sourceStateBuffer);
  assert.equal(seal.inputs.dtSeconds, args.dtS);
  assert.throws(() => resolveSphThermalSourceCapture({ ...output }, token));
  assert.throws(() => resolveSphThermalSourceCapture(output, {}));
  assert.throws(() => output.destroyOutputParticleBuffers(), /owner read/);
  await assert.rejects(runSphThermalStepWebGpu({ ...args, postMechanicsSourceCapture: token }), /replay/);
  seal.release();
  output.destroyOutputParticleBuffers();
  assert.throws(() => resolveSphThermalSourceCapture(output, token), /retired/);
});

test('shared bookkeeping cannot mint a producer seal', () => {
  const result = {}, token = {};
  createPostMechanicsStageOutputSeal(result, {});
  for (const resolver of [resolveSphThermalSourceCapture, resolveSphReactionSourceCapture,
    resolveSphPhaseCarrierTransferSourceCapture, resolveMlsMpmMechanicsRefreshSourceCapture]) {
    assert.throws(() => resolver(result, token), /Unknown/);
  }
});

test('captured selectors cannot hide carrier mutation or replace the owner', () => {
  const result = { reactionSummary: { reactionSummaryAvailable: false, changedMassCount: 0 },
    ownsStateBuffer: true, componentOwnership: { state: true } };
  const seal = createPostMechanicsStageOutputSeal(result, {});
  result.reactionSummary.reactionSummaryAvailable = true;
  assert.throws(() => seal.validate(), /changed/);
  result.reactionSummary.reactionSummaryAvailable = false;
  result.result = { ...result };
  assert.throws(() => seal.validate(), /changed/);
  delete result.result;
  result.componentOwnership.state = false;
  assert.throws(() => seal.validate(), /changed/);
  result.componentOwnership.state = true;
  result.ownsStateBuffer = false;
  assert.throws(() => seal.validate(), /changed/);
  result.ownsStateBuffer = true;
  assert.equal(seal.validate(), true); seal.release();
});

test('mechanics seal binds actual effective inputs and detects mutated outputs', async () => {
  const args = packedInputs(), token = {};
  const output = await runMlsMpmMechanicsRefreshWebGpu({ ...args, postMechanicsSourceCapture: token });
  const seal = resolveMlsMpmMechanicsRefreshSourceCapture(output, token);
  assert.equal(seal.inputs.sourceThermoBuffer, args.sourceThermoBuffer);
  const actual = output.mechanicsBuffer; output.mechanicsBuffer = args.sourceMechanicsBuffer;
  assert.throws(() => resolveMlsMpmMechanicsRefreshSourceCapture(output, token), /changed/);
  output.mechanicsBuffer = actual; seal.release(); output.destroyOutputParticleBuffers();
});

test('reaction capture rejects every nested injected producer before GPU work', async () => {
  for (const key of ['reactionPlacementEpochRunner', 'canonicalReactionDiscoveryResolver',
    'reactionWarmArenaAcquireRunner', 'reactionWarmArenaResolveRunner', 'reactionWarmArenaReleaseRunner']) {
    const device = deviceDouble();
    await assert.rejects(runSphReactionStepWebGpu({ device, retainOutputParticleBuffers: true,
      postMechanicsSourceCapture: {}, [key]: () => {} }), /standard retained producer/);
    assert.equal(device.submissions, 0);
  }
});

test('exact merger capture authenticates absence and rejects replay/copy', async () => {
  const device = deviceDouble(), token = {};
  const output = await mergeResidentProductMassBuffersWebGpu({ device, postMechanicsSourceCapture: token });
  const seal = resolveResidentProductMassMergeSourceCapture(output, token);
  assert.equal(output, null); assert.equal(seal.productCountDescriptor, null);
  assert.equal(seal.inputResidentProductMass, null); assert.equal(seal.emittedResidentProductMass, null);
  assert.throws(() => resolveResidentProductMassMergeSourceCapture({}, token));
  await assert.rejects(mergeResidentProductMassBuffersWebGpu({ device, postMechanicsSourceCapture: token }), /replay/);
  seal.release();
});

test('current closure read owns exact final sources, duration and fixed grid metadata', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  const packet = resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device });
  assert.equal(packet.stateBuffer, closure.continuation.stateBuffer);
  assert.equal(packet.thermoBuffer, closure.continuation.thermoBuffer);
  assert.equal(packet.mechanicsBuffer, closure.continuation.mechanicsBuffer);
  assert.equal(packet.dtSeconds, args.dtSeconds); assert.equal(packet.residentProductMass, null);
  assert.equal(packet.sphParticleUpload.aerosolFamily, null);
  assert.equal(packet.mechanicsLevels[0].grid.gridShift, 2);
  assert.equal(Object.isFrozen(packet.mechanicsLevels[0].grid.gridDims), true);
  assert.notEqual(packet.sphParticleUpload, args.sphParticleUpload);
  assert.equal(packet.identityBuffer, args.sphParticleUpload.identityBuffer);
  assert.equal(packet.kineticsAdmitted, false); assert.equal(packet.exchangeIntervalAdmitted, false);
  assert.equal(packet.outerPublicationAdmitted, false);
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead({ ...read }, { device: args.device }));
  assert.throws(() => acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device }));
  args.sphParticleUpload.physicsTick++;
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /changed/);
  args.sphParticleUpload.physicsTick--;
  const claimed = { stateBuffer: packet.stateBuffer, thermoBuffer: packet.thermoBuffer, mechanicsBuffer: packet.mechanicsBuffer };
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, claimed), /pins/);
  assert.throws(() => retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: Promise.resolve(true), abandon: true }), /pins/);
  args.device.deferred = true;
  const released = releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /released/);
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, claimed), /pins/);
  await args.device.finish(); assert.equal(await released, true);
  claimMlsMpmPostMechanicsContinuation(closure, claimed);
});

test('capture rejects injected/skipped/replaced active stages and allows inactive options', async () => {
  for (const options of [
    { thermalStepRunner: async () => ({}) },
    { timedStage: async () => ({}) },
    { timedStage: async (_name, run) => ({ ...await run() }) },
    { afterThermalStep: ({ thermalStep }) => { thermalStep.result = { ...thermalStep }; } },
    { mechanicsRefreshRunner: async () => ({}) },
    { timedStage: async (_name, run) => { const result = await run();
      await assert.rejects(run(), /repeated/); return result; } },
    { condensateExtraction: {} }
  ]) {
    const args = await closureInputs();
    await assert.rejects(runMlsMpmPostMechanicsClosureWebGpu({ ...args, ...options }), /standard|skipped|replaced|unsupported|changed/);
  }
});

test('inactive optional producers are not required to be standard', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({ ...args,
    reactionStepRunner: async () => { throw new Error('inactive reaction ran'); },
    phaseCarrierTransferRunner: async () => { throw new Error('inactive phase ran'); } });
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  assert.equal(resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }).dtSeconds, args.dtSeconds);
  await releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
  await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: Promise.resolve(true), abandon: true });
});

test('uncaptured path preserves option evaluation inside the timing callback', async () => {
  const args = await closureInputs();
  let observed = null;
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({ ...args, captureGasSource: false,
    thermalStepOptions: args.thermalStepOptions,
    timedStage: async (name, run) => {
      if (name === 'thermalStep') args.thermalStepOptions.conductionRate = 17;
      return run();
    },
    thermalStepRunner: async (options) => {
      observed = options.conductionRate;
      return runSphThermalStepWebGpu(options);
    } });
  assert.equal(observed, 17);
  assert.throws(() => acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device }), /did not capture/);
  await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: Promise.resolve(true), abandon: true });
});

test('read admission reserves the exact closure before reentrant public resolution', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const continuation = closure.continuation;
  let reentries = 0;
  Object.defineProperty(closure, 'continuation', { configurable: true, get() {
    reentries++;
    assert.throws(() => acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device }), /prior read/);
    assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, continuation), /pins/);
    return continuation;
  } });
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  assert.ok(reentries > 0);
  Object.defineProperty(closure, 'continuation', { configurable: true, writable: true, value: continuation });
  await releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
  claimMlsMpmPostMechanicsContinuation(closure, continuation);
});

test('read resolution rechecks private liveness after a reentrant release', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  const continuation = closure.continuation;
  let release;
  Object.defineProperty(closure, 'continuation', { configurable: true, get() {
    release ??= releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
    return continuation;
  } });
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /ended during resolution/);
  await release;
  Object.defineProperty(closure, 'continuation', { configurable: true, writable: true, value: continuation });
  claimMlsMpmPostMechanicsContinuation(closure, continuation);
});

test('read release reserves its promise before reentrant device queue access', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  let nested;
  args.device.queue.onSubmittedWorkDone = () => {
    nested = releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
    return Promise.resolve();
  };
  const release = releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
  assert.equal(nested, release); assert.equal(await release, true);
  claimMlsMpmPostMechanicsContinuation(closure, closure.continuation);
});

for (const mode of ['rejected', 'missing']) test(`source release quarantines ${mode} latest fence until real device loss`, async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  const packet = resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device });
  if (mode === 'missing') args.device.queue.onSubmittedWorkDone = null;
  else args.device.failFence = true;
  let settled = false;
  const release = releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device }).then(() => { settled = true; });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(packet.stateBuffer.destroyed, false);
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, packet), /pins/);
  args.device.lose(); await release;
  assert.equal(settled, true);
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /released/);
});

test('source read rejects wrong device, changed count/history and copied closure', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  assert.throws(() => acquireMlsMpmPostMechanicsGasSourceRead({ ...closure }, { device: args.device }), /copied/);
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: deviceDouble() }), /wrong-device/);
  assert.throws(() => releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: deviceDouble() }));
  args.sphParticleUpload.particleCount++;
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /changed/);
  args.sphParticleUpload.particleCount--;
  closure.residentProductMass = {};
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /unchanged/);
  closure.residentProductMass = null;
  args.boxDimsM[0] = 100;
  assert.deepEqual(resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }).boxDimsM, [2, 2, 2]);
  await releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
  await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: Promise.resolve(true), abandon: true });
});

test('current history capture preserves exact sources and owns a new complete count view', async () => {
  const args = await closureInputs();
  const input = historyHandle(args.device), unrelated = historyHandle(args.device, 2);
  const closure = await runMlsMpmPostMechanicsClosureWebGpu({ ...args, inputResidentProductMass: input });
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  const packet = resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device });
  assert.notEqual(packet.residentProductMass, input);
  assert.notEqual(packet.residentProductMass.productEventBuffer, input.productEventBuffer);
  assert.ok(packet.productCountDescriptor);
  assert.equal(packet.productCountDescriptor.rowStrideFloats, 32);
  assert.ok(packet.residentProductMass.__ulgActiveBorrowCount > 0);
  const rowCount = packet.residentProductMass.productEventRowCount;
  packet.residentProductMass.productEventRowCount = 0;
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /changed/);
  packet.residentProductMass.productEventRowCount = rowCount;
  closure.residentProductMass = unrelated;
  assert.throws(() => resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }), /unchanged/);
  closure.residentProductMass = packet.residentProductMass;
  await releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
  await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: Promise.resolve(true), abandon: true });
});

test('merger source seal binds exact source order, not another genuine history', async () => {
  const device = deviceDouble(), left = historyHandle(device), right = historyHandle(device, 2, false), token = {};
  const output = await mergeResidentProductMassBuffersWebGpu({ device, inputResidentProductMass: left,
    emittedResidentProductMass: right, postMechanicsSourceCapture: token, allowHostCompactionObservation: false });
  const seal = resolveResidentProductMassMergeSourceCapture(output, token);
  assert.equal(seal.inputResidentProductMass, left); assert.equal(seal.emittedResidentProductMass, right);
  assert.throws(() => resolveResidentProductMassMergeSourceCapture(right, token));
  const originalBuffer = left.productEventBuffer; left.productEventBuffer = right.productEventBuffer;
  assert.throws(() => resolveResidentProductMassMergeSourceCapture(output, token), /changed/);
  left.productEventBuffer = originalBuffer; seal.release();
});

test('unchanged aerosol family survives retirement while closure holds a source read', async () => {
  const args = await closureInputs({ withAerosol: true });
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const read = acquireMlsMpmPostMechanicsGasSourceRead(closure, { device: args.device });
  const packet = resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device });
  assert.equal(packet.sphParticleUpload.aerosolFamily, packet.aerosolFamily);
  assert.equal(validateSphAerosolParcelRead(packet.aerosolRead, { device: args.device,
    family: packet.aerosolFamily, expectedGeneration: packet.aerosolRead.generation }), true);
  releaseSphAerosolParcelFamily(packet.aerosolFamily);
  assert.equal(resolveMlsMpmPostMechanicsGasSourceRead(read, { device: args.device }).aerosolFamily, packet.aerosolFamily);
  await releaseMlsMpmPostMechanicsGasSourceReadAfterQueue(read, { device: args.device });
  await retireMlsMpmPostMechanicsClosureOutputsAfter(closure, { after: Promise.resolve(true), abandon: true });
});

test('actual current-state builder pins closure through EOS and fresh geometry final fences', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const result = await runSphPostMechanicsGasStateWebGpu({ device: args.device, closure });
  assert.equal(result.ready, true);
  assert.notEqual(result.spatialGeneration, args.schroederSpatialEpochGeneration);
  assert.equal(result.levelAssignment.sourceStateBuffer, closure.continuation.stateBuffer);
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, closure.continuation), /pins/);
  assert.throws(() => releaseSphPostMechanicsGasStateAfterQueue({ ...result }, { device: args.device }));
  args.device.deferred = true;
  let settled = false;
  const release = releaseSphPostMechanicsGasStateAfterQueue(result, { device: args.device })
    .then((value) => { settled = true; return value; });
  await Promise.resolve(); assert.equal(settled, false);
  assert.equal(result.levelAssignment.assignmentBuffer.destroyed, false);
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, closure.continuation), /pins/);
  for (let i = 0; i < 20 && !settled; i++) await args.device.finish();
  assert.equal(await release, true);
  assert.equal(result.levelAssignment.assignmentBuffer.destroyed, true);
  assert.notEqual(args.schroederSpatialEpochGeneration.execution.released, true);
  claimMlsMpmPostMechanicsContinuation(closure, closure.continuation);
});

for (const mode of ['rejected', 'missing']) test(`actual current-state owner quarantines ${mode} final fence and releases after true loss`, async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const result = await runSphPostMechanicsGasStateWebGpu({ device: args.device, closure });
  if (mode === 'missing') args.device.queue.onSubmittedWorkDone = null;
  else args.device.failFence = true;
  const released = await releaseSphPostMechanicsGasStateAfterQueue(result, { device: args.device });
  assert.equal(released, false);
  assert.equal(result.levelAssignment.assignmentBuffer.destroyed, false);
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, closure.continuation), /pins/);
  args.device.lose();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(await releaseSphPostMechanicsGasStateAfterQueue(result, { device: args.device }), true);
  assert.equal(result.levelAssignment.assignmentBuffer.destroyed, true);
  claimMlsMpmPostMechanicsContinuation(closure, closure.continuation);
});

test('actual generation pre-submit failure retains unconfirmed source until loss', async () => {
  const args = await closureInputs();
  const closure = await runMlsMpmPostMechanicsClosureWebGpu(args);
  const createEncoder = args.device.createCommandEncoder;
  let calls = 0;
  args.device.createCommandEncoder = function (...options) {
    if (++calls === 2) {
      args.device.failFence = true;
      throw new Error('injected actual current-generation encoder construction failure');
    }
    return createEncoder.apply(this, options);
  };
  let failure;
  await assert.rejects(runSphPostMechanicsGasStateWebGpu({ device: args.device, closure }), (error) => {
    failure = error; return /injected actual current-generation/.test(error.message);
  });
  assert.equal(failure.cleanupConfirmed, false);
  assert.equal(failure.retainedGasState.ready, false);
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(closure, closure.continuation), /pins/);
  args.device.lose();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(await releaseSphPostMechanicsGasStateAfterQueue(failure.retainedGasState, { device: args.device }), true);
  claimMlsMpmPostMechanicsContinuation(closure, closure.continuation);
});
