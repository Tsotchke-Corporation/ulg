import assert from 'node:assert/strict';
import test from 'node:test';
import * as buffers from '../src/runtime/sph/sphGpuBuffers.js';
import * as steps from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import * as thermal from '../src/runtime/sph/sphThermalGpuKernel.js';
import * as mechanics from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import * as closure from '../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import * as hierarchy from '../src/runtime/sph/schroederHierarchyGpu.js';
import * as spatial from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { validateSchroederSpatialEpochTransactionCommit } from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { acquireMlsMpmG2pExactMassCapture } from '../src/runtime/sph/sphG2pGpuKernel.js';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { createSphExactMassFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';

// Fake command recorder copied from existing sphG2pGpuKernel.test.mjs.
// These are ownership/authentication tests; no WGSL is executed.
function fakeG2pDevice() {
  const createdBuffers = [];
  const writes = [];
  const submissions = [];
  const dispatches = [];
  const commandEncoders = [];
  const mapAsyncCalls = [];
  const unmapCalls = [];
  const clears = [];
  const bindGroups = [];
  const bindGroupLayouts = [];
  const pipelineLayouts = [];
  const pipelines = [];
  const device = {
    createdBuffers,
    writes,
    submissions,
    dispatches,
    commandEncoders,
    mapAsyncCalls,
    unmapCalls,
    clears,
    bindGroups,
    bindGroupLayouts,
    pipelineLayouts,
    pipelines,
    commandEventHook: null,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 16,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const byteLength = data?.byteLength ?? 0;
        if (offset + byteLength > buffer.size) {
          throw new RangeError(`writeBuffer overflow for ${buffer.label}: ${offset + byteLength} > ${buffer.size}`);
        }
        const sourceBytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : (ArrayBuffer.isView(data)
              ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
              : new Uint8Array());
        writes.push({
          buffer,
          label: buffer.label,
          offset,
          byteLength,
          data: sourceBytes.slice().buffer
        });
        buffer.bytes.set(sourceBytes, offset);
      },
      submit(commands) {
        for (const command of commands) {
          for (const event of command.events ?? []) {
            if (event.kind === 'clear') {
              const end = event.size == null
                ? event.buffer.size
                : event.offset + event.size;
              event.buffer.bytes.fill(0, event.offset, end);
            } else if (event.kind === 'copy') {
              event.destination.bytes.set(
                event.source.bytes.subarray(
                  event.sourceOffset,
                  event.sourceOffset + event.size
                ),
                event.destinationOffset
              );
            } else if (event.kind === 'dispatch') {
              device.commandEventHook?.(event);
            }
          }
        }
        submissions.push(commands);
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        bytes: new Uint8Array(size),
        destroyed: false,
        mapped: false,
        async mapAsync(mode, offset = 0, mapSize = size - offset) {
          mapAsyncCalls.push({ buffer: this, mode, offset, size: mapSize });
          this.mapped = true;
        },
        getMappedRange(offset = 0, mapSize = size - offset) {
          if (!this.mapped) throw new Error(`buffer ${label} is not mapped`);
          return this.bytes.buffer.slice(offset, offset + mapSize);
        },
        unmap() {
          unmapCalls.push(this);
          this.mapped = false;
        },
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ label, code }) {
      return { label, code };
    },
    createBindGroupLayout({ label, entries }) {
      const layout = { label, entries };
      bindGroupLayouts.push(layout);
      return layout;
    },
    createPipelineLayout({ label, bindGroupLayouts: layouts }) {
      const layout = { label, bindGroupLayouts: layouts };
      pipelineLayouts.push(layout);
      return layout;
    },
    createComputePipeline({ label, layout, compute }) {
      const pipeline = {
        label,
        layout,
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      const events = [];
      const encoderRecord = { events };
      commandEncoders.push(encoderRecord);
      return {
        clearBuffer(buffer, offset, size) {
          clears.push({ buffer, offset, size });
          events.push({ kind: 'clear', buffer, offset, size });
        },
        beginComputePass() {
          return {
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              const event = {
                kind: 'dispatch',
                count,
                pipeline: this.pipeline,
                bindGroup: this.bindGroup?.bindGroup
              };
              dispatches.push(event);
              events.push(event);
            },
            dispatchWorkgroupsIndirect(buffer, offset) {
              const event = {
                kind: 'dispatch',
                indirect: true,
                buffer,
                offset,
                pipeline: this.pipeline,
                bindGroup: this.bindGroup?.bindGroup
              };
              dispatches.push(event);
              events.push(event);
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          events.push({
            kind: 'copy',
            source,
            sourceOffset,
            destination,
            destinationOffset,
            size
          });
        },
        finish() {
          return { events: [...events] };
        }
      };
    }
  };
  return device;
}


const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
function fixture() {
  const device = fakeG2pDevice(); device.lost = new Promise(() => {});
  const materialProperties = { fe: createReferenceMaterialClosures().fe.properties };
  const initial = { smoothingLengthM: .5, dimension: 3, step: 0, time: 0, storageGeneration: 1,
    particles: [{ id: 'carrier', material: 'fe', massKg: .001 * (1 + 2 ** -30), x: [.15, 1, 1], v: [.1, 0, 0],
      specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.fe, 300) }] };
  const packed = buffers.buildSphGpuParticleBuffers(initial, { materialProperties,
    exactMass: { format: createSphExactMassFormat(), reference: 'exact continuation ownership regression' } });
  const packedMls = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties,
    particleSeparationRelaxation: 0, soundSpeedScale: .01 });
  return { device, packed, packedMls,
    sphUpload: buffers.uploadSphGpuParticleBuffers(device, packed),
    mlsUpload: buffers.uploadMlsMpmGpuParticleBuffers(device, packedMls),
    thermalTable: thermal.buildSphThermalMaterialTable(materialProperties),
    mechanicsTable: mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties) };
}
function run(f, extra = {}) {
  return steps.runMlsMpmResidentStepWithOptionalWebGpu({ device: f.device,
    sphParticleState: f.packed, mlsMpmParticleState: f.packedMls,
    sphParticleUpload: f.sphUpload, mlsMpmParticleUpload: f.mlsUpload,
    thermalMaterialTable: f.thermalTable, mechanicsMaterialTable: f.mechanicsTable,
    thermalStepOptions: { conductionRate: 0 }, gridSpacingM: .5, boxDimsM: [2, 2, 2],
    dt: .001, gravityMPerS2: [0, 0, 0], preferWebGpu: true, readbackMode: 'no-full-readback',
    contactSolverEnabled: false, fuseNoFullResidentMechanics: false, ...extra });
}
async function retire(f, step, preserve = []) {
  if (step) steps.destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: preserve });
  buffers.destroySphGpuParticleBuffers(f.sphUpload);
  buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
  await settle();
}
function advance(f, step) {
  return { ...f, packed: steps.cloneSphParticleStateForNext(f.packed, step),
    packedMls: steps.cloneMlsMpmParticleStateForNext(f.packedMls, step),
    sphUpload: step.nextParticleUploads.sphParticleUpload,
    mlsUpload: step.nextParticleUploads.mlsMpmParticleUpload };
}

function runSpatial(f, extra = {}) {
  return hierarchy.runSchroederSameLevelMechanicsWebGpu({ device: f.device,
    sphParticleState: f.packed, mlsMpmParticleState: f.packedMls,
    sphParticleUpload: f.sphUpload, mlsMpmParticleUpload: f.mlsUpload,
    selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5,
    boxDimsM: [2, 2, 2], dt: .001, gravityMPerS2: [0, 0, 0],
    enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
    enableLawQueue: false, enableLawNeighborCandidates: false,
    enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
    residentStepOptions: { thermalMaterialTable: f.thermalTable,
      mechanicsMaterialTable: f.mechanicsTable, thermalStepOptions: { conductionRate: 0 },
      gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null }, ...extra });
}

test('spatial continuation admits only the genuine publication and its final epochs', async () => {
  const f = fixture(); let step, family, commitReceipt;
  try {
    const result = await runSpatial(f, { async successorLevelAssignmentRunner(args) {
      const assignment = await hierarchy.runSchroederLevelAssignmentWebGpu(args);
      buffers.destroySphGpuParticleBuffers(f.sphUpload);
      assert.notEqual(f.sphUpload.destroyed, true, 'existing transaction and producer reads pin the retiring source');
      return assignment;
    }, spatialSuccessorPublicationRunner(plan, inputs) {
      commitReceipt = inputs.commitReceipt;
      return spatial.publishPreparedSchroederSpatialSuccessorSourceFamily(plan, inputs);
    } });
    step = result.residentStep;
    assert.equal(f.packedMls.gridCflFactor, 0);
    assert.equal(step.gridUpdate.cflFactor, .6, 'unspecified packed CFL uses the actual resident default');
    const next = step.nextParticleUploads;
    family = next.schroederSpatialSuccessorSourceFamily;
    assert.ok(family);
    const producer = acquireMlsMpmG2pExactMassCapture(step.g2pReconstruction.gpuResult,
      { device: f.device, sphParticleUpload: f.sphUpload });
    try {
      const validates = nextParticleUploads => validateSchroederSpatialEpochTransactionCommit(
        producer.transaction, commitReceipt, { nextParticleUploads, expectedGeneration: producer.generation });
      assert.equal(validates(next), true);
      assert.equal(validates({ ...next }), false);
      const originalSph = next.sphParticleUpload, originalMls = next.mlsMpmParticleUpload;
      try {
        next.sphParticleUpload = { ...originalSph };
        assert.equal(validates(next), false);
        next.sphParticleUpload = originalSph;
        next.mlsMpmParticleUpload = { ...originalMls };
        assert.equal(validates(next), false);
      } finally { next.sphParticleUpload = originalSph; next.mlsMpmParticleUpload = originalMls; }
    } finally { producer.release(); }
    assert.equal(next.sphParticleUpload.exactMassInventory, f.sphUpload.exactMassInventory);
    const read = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, f.device);
    await buffers.releaseSphParticleExactMassRead(read);
    for (const key of ['storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch',
      'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch']) {
      assert.equal(next.sphParticleUpload[key], family[key]);
      assert.equal(next.mlsMpmParticleUpload[key], family[key]);
    }
    assert.throws(() => spatial.resolveSchroederSpatialSuccessorSourceFamily(family, {
      device: f.device, sphParticleUpload: { ...next.sphParticleUpload },
      mlsMpmParticleUpload: next.mlsMpmParticleUpload }), /successor|exact/i);
    assert.throws(() => buffers.activateSphExactMassSpatialContinuation({ plan: {},
      commitReceipt: {}, nextParticleUploads: next }), /genuine SS publication/);
    await assert.rejects(buffers.bindSphExactMassPostMechanicsContinuation({
      closure: step.exactMassPostMechanicsClosure,
      claim: closure.claimMlsMpmPostMechanicsContinuation(step.exactMassPostMechanicsClosure, { nextParticleUploads: next }),
      nextParticleUploads: next, spatialPublicationPlan: {} }), /replaced/);
  } finally {
    if (family) await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device: f.device });
    await retire(f, step);
  }
});

test('an exception after genuine spatial publication retains the published exact owner for recovery', async () => {
  const f = fixture(); let witness;
  try {
    await assert.rejects(runSpatial(f, { spatialSuccessorPublicationRunner(plan, inputs) {
      assert.equal(spatial.publishPreparedSchroederSpatialSuccessorSourceFamily(plan, inputs).published, true);
      throw new Error('failure after real publication');
    } }), error => {
      assert.match(error.message, /failure after real publication/);
      witness = error.schroederSpatialSuccessorPublicationWitness;
      assert.ok(witness); return true;
    });
    const next = witness.nextParticleUploads;
    spatial.resolveSchroederSpatialSuccessorSourceFamily(witness.sourceFamily, { device: f.device,
      sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload });
    const held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, f.device);
    await buffers.releaseSphParticleExactMassRead(held);
  } finally {
    if (witness) {
      await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(witness.sourceFamily, { device: f.device });
      buffers.destroySphGpuParticleBuffers(witness.nextParticleUploads.sphParticleUpload);
      buffers.destroyMlsMpmGpuParticleBuffers(witness.nextParticleUploads.mlsMpmParticleUpload);
    }
    await retire(f);
  }
});

test('pending spatial owner rejects reads and copied commit publication retires it without stranding the source', async () => {
  const f = fixture(); let target;
  const originalRead = buffers.acquireSphParticleExactMassRead(f.sphUpload, f.device);
  const numeric = originalRead.read.buffer;
  await buffers.releaseSphParticleExactMassRead(originalRead);
  try {
    await assert.rejects(runSpatial(f, {
      async successorLevelAssignmentRunner(args) {
        target = args.sphParticleUpload;
        return hierarchy.runSchroederLevelAssignmentWebGpu(args);
      },
      spatialSuccessorPublicationRunner(plan, { commitReceipt }) {
        assert.ok(target.exactMassInventory);
        assert.throws(() => buffers.acquireSphParticleExactMassRead(target, f.device), /original live upload/);
        assert.equal(spatial.publishPreparedSchroederSpatialSuccessorSourceFamily({ ...plan }, { commitReceipt }).published, false);
        return spatial.publishPreparedSchroederSpatialSuccessorSourceFamily(plan, { commitReceipt: { ...commitReceipt } });
      }
    }), /publication|successor/i);
    await settle();
    assert.throws(() => buffers.acquireSphParticleExactMassRead(target, f.device), /original live upload/);
    assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0, 'source producer and transaction reads drain');
  } finally { await retire(f); }
  assert.equal(numeric.destroyed, true);
  assert.equal(f.sphUpload.identityBuffer.destroyed, true);
});

test('async retirement joins an exact physical read already released by synchronous SS retirement', async () => {
  const f = fixture(); let step, family, releaseFence;
  try {
    step = (await runSpatial(f)).residentStep;
    const next = step.nextParticleUploads;
    family = next.schroederSpatialSuccessorSourceFamily;
    steps.destroyMlsMpmResidentStepBuffers(step, { preserveBuffers: steps.retainedContinuationBuffersFromUploads(next) });
    await settle();
    const fence = new Promise(resolve => { releaseFence = resolve; });
    f.device.queue.onSubmittedWorkDone = () => fence;
    buffers.destroySphGpuParticleBuffers(next.sphParticleUpload);
    spatial.retireSchroederSpatialSuccessorSourceFamily(family, { device: f.device });
    let settled = false;
    const completion = spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device: f.device })
      .then(() => { settled = true; });
    await settle();
    assert.equal(settled, false, 'SS retirement cannot finish before the exact held read');
    assert.notEqual(next.sphParticleUpload.destroyed, true);
    releaseFence(); await completion; await settle();
    assert.equal(next.sphParticleUpload.destroyed, true);
  } finally {
    releaseFence?.();
    if (family) await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device: f.device });
    await retire(f, step);
  }
});

test('successor retirement cannot destroy identity pinned by an original physical read', async () => {
  const f = fixture(); const held = buffers.acquireSphParticleExactMassRead(f.sphUpload, f.device);
  let step;
  try {
    step = await run(f);
    const next = step.nextParticleUploads.sphParticleUpload;
    assert.equal(next.identityBuffer, f.sphUpload.identityBuffer);
    assert.equal(next.ownsIdentityBuffer, true);
    assert.equal(buffers.destroySphGpuParticleBuffers(next), true);
    await settle();
    assert.equal(f.sphUpload.identityBuffer.destroyed, false, 'source read must pin shared identity');
    assert.equal(buffers.validateSphParticleExactMassRead(held,
      { device: f.device, sourceSphUpload: f.sphUpload }), true);
  } finally {
    await buffers.releaseSphParticleExactMassRead(held);
    await retire(f, step);
  }
  assert.equal(f.sphUpload.identityBuffer.destroyed, true);
});

test('genuine captures reject copied outputs, source descriptors and claims without submitting', async () => {
  const f = fixture(); let step;
  try {
    step = await run(f);
    const result = step.g2pReconstruction.gpuResult;
    const args = { device: f.device, sphParticleUpload: f.sphUpload };
    const submissions = f.device.submissions.length;
    const held = acquireMlsMpmG2pExactMassCapture(result, args); held.release();
    assert.throws(() => acquireMlsMpmG2pExactMassCapture({ ...result }, args), /genuine live G2P/);
    assert.throws(() => acquireMlsMpmG2pExactMassCapture(result,
      { ...args, sphParticleUpload: { ...f.sphUpload } }), /genuine live G2P/);
    const stateBuffer = result.stateBuffer;
    result.stateBuffer = f.sphUpload.stateBuffer;
    try { assert.throws(() => acquireMlsMpmG2pExactMassCapture(result, args), /genuine live G2P/); }
    finally { result.stateBuffer = stateBuffer; }
    await assert.rejects(thermal.runSphThermalStepWebGpu({ ...args, exactMassG2pResult: { ...result },
      postMechanicsSourceCapture: Object.freeze({}), retainOutputParticleBuffers: true,
      readbackMode: 'no-full-readback', sourceStateBuffer: result.stateBuffer,
      sourceThermoBuffer: f.sphUpload.thermoBuffer, sphParticleState: f.packed }), /genuine live G2P/);
    const c = step.exactMassPostMechanicsClosure;
    const claim = closure.claimMlsMpmPostMechanicsContinuation(c, { nextParticleUploads: step.nextParticleUploads });
    await assert.rejects(buffers.bindSphExactMassPostMechanicsContinuation({ closure: c,
      claim: { ...claim }, nextParticleUploads: step.nextParticleUploads }), /original closure claim/);
    await assert.rejects(buffers.bindSphExactMassPostMechanicsContinuation({ closure: c, claim,
      nextParticleUploads: { ...step.nextParticleUploads } }), /original closure claim/);
    assert.equal(await buffers.bindSphExactMassPostMechanicsContinuation({ closure: c, claim,
      nextParticleUploads: step.nextParticleUploads }), f.sphUpload.exactMassInventory);
    assert.equal(f.device.submissions.length, submissions);
  } finally { await retire(f, step); }
});

test('two genuine continuations retain one numeric family after each predecessor retires', async () => {
  const f = fixture(); let current = f; let step = null;
  const family = f.sphUpload.exactMassInventory;
  const initialRead = buffers.acquireSphParticleExactMassRead(f.sphUpload, f.device);
  const numericBuffer = initialRead.read.buffer;
  const initialWords = Array.from(new Uint32Array(numericBuffer.bytes.buffer));
  await buffers.releaseSphParticleExactMassRead(initialRead);
  try {
    for (let cycle = 0; cycle < 2; cycle++) {
      step = await run(current);
      const next = advance(current, step);
      assert.equal(next.sphUpload.exactMassInventory, family);
      await retire(current, step, steps.retainedContinuationBuffersFromUploads(step.nextParticleUploads));
      assert.equal(current.sphUpload.destroyed, true);
      const held = buffers.acquireSphParticleExactMassRead(next.sphUpload, f.device);
      assert.equal(held.read.buffer, numericBuffer);
      assert.deepEqual(Array.from(new Uint32Array(held.read.buffer.bytes.buffer)), initialWords);
      assert.equal(numericBuffer.destroyed, false);
      await buffers.releaseSphParticleExactMassRead(held);
      current = next;
    }
  } finally { await retire(current, step); }
  assert.equal(numericBuffer.destroyed, true);
  assert.equal(current.sphUpload.identityBuffer.destroyed, true);
});

test('failure after genuine G2P does not strand the source physical read', async () => {
  const f = fixture();
  let sawG2p = false;
  f.device.commandEventHook = event => {
    if (event.pipeline?.label === 'ulg-mls-mpm-g2p-reconstruct') sawG2p = true;
    if (event.pipeline?.label === 'ulg-sph-thermal-step') {
      assert.equal(sawG2p, true, 'failure must occur after genuine G2P');
      throw new Error('injected thermal submission failure');
    }
  };
  try {
    await assert.rejects(run(f), /injected thermal submission failure/);
  } finally { await retire(f); }
  assert.equal(sawG2p, true);
  assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0, 'failed step must release genuine G2P source read');
  assert.equal(f.sphUpload.destroyed, true);
});

test('late continuation rejection retires successful thermal and refresh outputs', async () => {
  const f = fixture(); const originalStride = f.sphUpload.stateStrideBytes;
  let reachedEnvelope = false;
  try {
    await assert.rejects(run(f, { onResidentStageProgress(progress) {
      if (progress.stage === 'residentStepEnvelope' && progress.status === 'resident-stage-started') {
        reachedEnvelope = true; f.sphUpload.stateStrideBytes = originalStride + 4;
      }
    } }), /exact|Exact/);
  } finally {
    f.sphUpload.stateStrideBytes = originalStride;
    await retire(f);
  }
  assert.equal(reachedEnvelope, true);
  const outputLabels = ['ulg-sph-thermal-output-state', 'ulg-sph-thermal-output-thermo',
    'ulg-mls-mpm-mechanics-refresh-output-mechanics'];
  const outputs = f.device.createdBuffers.filter(buffer => outputLabels.includes(buffer.label));
  assert.ok(outputs.length >= 2);
  assert.deepEqual(outputs.filter(buffer => !buffer.destroyed).map(buffer => buffer.label), []);
});

test('copied exact physical source is rejected before resident work submits', async () => {
  const f = fixture();
  try {
    await assert.rejects(run({ ...f, sphUpload: { ...f.sphUpload } }), /exact|Exact/);
    assert.equal(f.device.submissions.length, 0);
  } finally { await retire(f); }
});

test('the resident entry read pins a retirement request before any GPU stage', async () => {
  const f = fixture(); let requested = false; let observed = null;
  try {
    await assert.rejects(run(f, { onResidentStageProgress(progress) {
      if (progress.stage === 'deviceAcquire' && progress.status === 'resident-stage-started') {
        requested = true;
        buffers.destroySphGpuParticleBuffers(f.sphUpload);
        observed = [f.sphUpload.destroyed === true, f.sphUpload.stateBuffer.destroyed];
      }
    } }), /exact|Exact/);
  } finally { await retire(f); }
  assert.equal(requested, true);
  assert.deepEqual(observed, [false, false]);
  assert.equal(f.sphUpload.destroyed, true);
});

for (const stage of ['g2pReconstruction', 'thermalStep', 'mechanicsRefresh']) {
  for (const outcome of ['replace', 'throw']) {
    test(`rejected diagnostic ${outcome} retires genuine ${stage} outputs`, async () => {
      const f = fixture(); let intercepted = false;
      try {
        await assert.rejects(run(f, { gpuTimestampRecorder: {
          active: true,
          async measureQueueStage(meta, work) {
            const result = await work();
            if (meta.stage === stage) {
              intercepted = true;
              if (outcome === 'throw') throw new Error('diagnostic wrapper failed');
              return { ...result };
            }
            return result;
          }
        } }), /replaced|diagnostic wrapper failed/);
      } finally { await retire(f); }
      assert.equal(intercepted, true);
      const labels = stage === 'g2pReconstruction'
        ? ['ulg-mls-mpm-g2p-state-out', 'ulg-mls-mpm-g2p-mechanics-out']
        : ['ulg-sph-thermal-output-state', 'ulg-sph-thermal-output-thermo',
          ...(stage === 'mechanicsRefresh' ? ['ulg-mls-mpm-mechanics-refresh-output-mechanics'] : [])];
      const outputs = f.device.createdBuffers.filter(buffer => labels.includes(buffer.label));
      assert.ok(outputs.length >= 2, 'genuine output allocations must exist');
      assert.deepEqual(outputs.filter(buffer => !buffer.destroyed).map(buffer => buffer.label), []);
      assert.equal(f.sphUpload.destroyed, true, 'all producer source reads must release');
    });
  }
}
