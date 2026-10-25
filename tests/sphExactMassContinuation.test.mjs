import assert from 'node:assert/strict';
import test from 'node:test';
import * as buffers from '../src/runtime/sph/sphGpuBuffers.js';
import * as steps from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import * as thermal from '../src/runtime/sph/sphThermalGpuKernel.js';
import * as refresh from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import * as mechanics from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import * as closure from '../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import * as hierarchy from '../src/runtime/sph/schroederHierarchyGpu.js';
import * as spatial from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { validateSchroederSpatialEpochTransactionCommit } from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { acquireMlsMpmG2pExactMassCapture, acquireMlsMpmMechanicsExactMassCapture } from '../src/runtime/sph/sphG2pGpuKernel.js';
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
function fixture(initialOverrides = {}) {
  const device = fakeG2pDevice(); let loseDevice;
  device.lost = new Promise(resolve => { loseDevice = resolve; });
  const materialProperties = { fe: createReferenceMaterialClosures().fe.properties };
  const initial = { smoothingLengthM: .5, dimension: 3, step: 0, time: 0, storageGeneration: 1,
    particles: [{ id: 'carrier', material: 'fe', initialBodyDomainId: 1, initialBodyId: 'exact-carrier-body',
      massKg: .001 * (1 + 2 ** -30), x: [.15, 1, 1], v: [.1, 0, 0],
      specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.fe, 300) }], ...initialOverrides };
  const packed = buffers.buildSphGpuParticleBuffers(initial, { materialProperties,
    exactMass: { format: createSphExactMassFormat(), reference: 'exact continuation ownership regression' } });
  const packedMls = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties,
    particleSeparationRelaxation: 0, soundSpeedScale: .01 });
  return { device, loseDevice, packed, packedMls,
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

function runSpatial(f, extra = {}, useFused = false) {
  return hierarchy.runSchroederSameLevelMechanicsWebGpu({ device: f.device,
    sphParticleState: f.packed, mlsMpmParticleState: f.packedMls,
    sphParticleUpload: f.sphUpload, mlsMpmParticleUpload: f.mlsUpload,
    selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5,
    boxDimsM: [2, 2, 2], dt: .001, gravityMPerS2: [0, 0, 0],
    enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
    enableLawQueue: false, enableLawNeighborCandidates: false,
    enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
    residentStepOptions: { thermalMaterialTable: f.thermalTable,
      fuseNoFullResidentMechanics: useFused,
      mechanicsMaterialTable: f.mechanicsTable, thermalStepOptions: { conductionRate: 0 },
      gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null }, ...extra });
}

function runTwoLevel(f, materialUpload, extra = {}) {
  return runSpatial(f, { enableTwoLevelMechanics: true, enableCrossLevelCoupling: true,
    minLevel: 0, maxLevel: 1, baseGridSpacingM: .25, supportRadiusScale: 15, targetSupportCells: 4,
    twoLevelMechanicsAuthority: 'authoritative', twoLevelFineSubstepCount: 2, spatialEpochArenaCount: 4,
    residentStepOptions: { thermalMaterialTable: f.thermalTable, mechanicsMaterialTable: f.mechanicsTable,
      mechanicsRefreshOptions: { mechanicsMaterialPhaseUpload: materialUpload },
      thermalStepOptions: { conductionRate: 0 }, gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null },
    ...extra });
}

test('exact two-level hierarchy publishes the real terminal thermal continuation', async () => {
  const f = fixture();
  const materialUpload = refresh.uploadMlsMpmMechanicsMaterialPhaseRecords(f.device, f.mechanicsTable);
  let step;
  try {
    const result = await runTwoLevel(f, materialUpload);
    step = result.residentStep;
    assert.equal(step.nextParticleUploads.sphParticleUpload.exactMassInventory, f.sphUpload.exactMassInventory);
    assert.ok(step.nextParticleUploads.schroederSpatialSuccessorSourceFamily);
  } finally {
    if (step) await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
      step.nextParticleUploads.schroederSpatialSuccessorSourceFamily, { device: f.device });
    await retire(f, step); refresh.destroyMlsMpmMechanicsMaterialPhaseUpload(materialUpload);
  }
});

for (const publication of ['success', 'reject', 'publish-then-throw']) {
  test(`exact two-level auxiliary ownership survives ${publication} and predecessor retirement`, async () => {
    const f = fixture();
    buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
    f.mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(f.device, { ...f.packedMls,
      materialPropertyBankWarmInputTable: { rowCount: 1, rows: new Float32Array(16) } });
    const bank = f.mlsUpload.materialPropertyBankWarmInputBuffer;
    const materialUpload = refresh.uploadMlsMpmMechanicsMaterialPhaseRecords(f.device, f.mechanicsTable);
    let step, published, failure;
    try {
      const result = await runTwoLevel(f, materialUpload, {
        async successorLevelAssignmentRunner(args) {
          const assignment = await hierarchy.runSchroederLevelAssignmentWebGpu(args);
          if (publication === 'success') buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
          return assignment;
        },
        spatialSuccessorPublicationRunner(plan, inputs) {
          if (publication === 'reject') throw new Error('injected pre-publication failure');
          const receipt = spatial.publishPreparedSchroederSpatialSuccessorSourceFamily(plan, inputs);
          if (publication === 'publish-then-throw') throw new Error('injected post-publication failure');
          return receipt;
        }
      });
      step = result.residentStep;
      published = step.nextParticleUploads;
      await result.schroederTwoLevelPositiveCompletionPromise;
    } catch (error) {
      failure = error;
      published = error.schroederSpatialSuccessorPublicationWitness?.nextParticleUploads;
    }
    try {
      if (publication === 'success') assert.equal(failure, undefined);
      else assert.match(failure?.message ?? '', /injected .*publication failure/);
      await settle();
      if (publication === 'reject') {
        assert.equal(published, undefined);
        assert.equal(f.mlsUpload.ownsMaterialPropertyBankWarmInputBuffer, true);
        assert.equal(bank.destroyed, false, 'rollback restores the still-live original owner');
      } else {
        assert.ok(published);
        assert.ok([published.sphParticleUpload.stateBuffer, published.sphParticleUpload.thermoBuffer,
          published.mlsMpmParticleUpload.mechanicsBuffer].every(buffer => !buffer.destroyed),
        'published components survive even when the publisher throws after exposing them');
        assert.equal(published.mlsMpmParticleUpload.materialPropertyBankWarmInputBuffer, bank);
        assert.equal(published.mlsMpmParticleUpload.ownsMaterialPropertyBankWarmInputBuffer, true);
        buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
        await settle();
        assert.equal(bank.destroyed, false, 'original retirement cannot free the published auxiliary');
        const read = buffers.acquireSphParticleExactMassRead(published.sphParticleUpload, f.device,
          { mlsMpmParticleUpload: published.mlsMpmParticleUpload });
        await buffers.releaseSphParticleExactMassRead(read);
      }
    } finally {
      if (published) {
        await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
          published.schroederSpatialSuccessorSourceFamily, { device: f.device });
        buffers.destroySphGpuParticleBuffers(published.sphParticleUpload);
        buffers.destroyMlsMpmGpuParticleBuffers(published.mlsMpmParticleUpload);
      }
      await retire(f, step);
      refresh.destroyMlsMpmMechanicsMaterialPhaseUpload(materialUpload);
    }
    assert.equal(bank.destroyed, true, 'the eventual owner retires its auxiliary');
  });
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

for (const useSpatial of [false, true]) {
  const route = useSpatial ? 'canonical' : 'dense';
  const runFused = async (f, extra = {}) => useSpatial
    ? (await runSpatial(f, { gpuTimestampRecorder: extra.gpuTimestampRecorder, residentStepOptions: {
      thermalMaterialTable: f.thermalTable, mechanicsMaterialTable: f.mechanicsTable,
      thermalStepOptions: { conductionRate: 0 }, gasPressureMechanicsBoundaryEnabled: false,
      summaryRunner: null, fuseNoFullResidentMechanics: true, ...extra } }, true)).residentStep
    : run(f, { fuseNoFullResidentMechanics: true, ...extra });

  test(`${route} fused capture authenticates both aliases and holds both destructor entrances`, async () => {
    const f = fixture(); let step, capture;
    try {
      step = await runFused(f);
      assert.equal(step.stageTiming.fusedResidentMechanics, true);
      const outer = step.g2pReconstruction, output = outer.gpuResult;
      const args = { device: f.device, sphParticleUpload: f.sphUpload };
      capture = await acquireMlsMpmMechanicsExactMassCapture(output, args);
      assert.equal(capture.dt, .001);
      assert.equal(Boolean(capture.transaction), useSpatial);
      assert.equal(outer.destroyOutputParticleBuffers, output.destroyOutputParticleBuffers);
      assert.equal(outer.destroyOutputParticleBufferComponents, output.destroyOutputParticleBufferComponents);
      assert.equal(outer.destroyOutputParticleBufferComponents({}), false);
      assert.equal(capture.validate(), true);
      for (const alias of [outer, output]) {
        assert.throws(() => alias.destroyOutputParticleBuffers(), /retained by a consumer/);
        assert.throws(() => alias.destroyOutputParticleBufferComponents({ state: true }), /retained by a consumer/);
        for (const key of ['stateBuffer', 'mechanicsBuffer', 'stateBufferByteLength', 'destroyOutputParticleBuffers']) {
          const original = alias[key]; alias[key] = null;
          try { assert.throws(() => capture.validate(), /genuine live G2P/); }
          finally { alias[key] = original; }
        }
      }
      const stateDescriptor = Object.getOwnPropertyDescriptor(output, 'stateBuffer');
      let getterInvoked = false;
      Object.defineProperty(output, 'stateBuffer', { configurable: true, get() {
        getterInvoked = true;
        output.destroyOutputParticleBufferComponents({ mechanics: true });
        return stateDescriptor.value;
      } });
      try { await assert.rejects(acquireMlsMpmMechanicsExactMassCapture(output, args), /genuine live G2P/); }
      finally { Object.defineProperty(output, 'stateBuffer', stateDescriptor); }
      assert.equal(getterInvoked, false, 'accessor substitution must not execute during authentication');
      await assert.rejects(acquireMlsMpmMechanicsExactMassCapture({ ...output }, args), /genuine live G2P/);
      await assert.rejects(acquireMlsMpmMechanicsExactMassCapture({ gpuResult: output }, args), /genuine live G2P/);
      await assert.rejects(acquireMlsMpmMechanicsExactMassCapture(output,
        { ...args, sphParticleUpload: { ...f.sphUpload } }), /genuine live G2P/);
    } finally {
      capture?.release();
      const family = step?.nextParticleUploads.schroederSpatialSuccessorSourceFamily;
      if (family) await spatial.retireSchroederSpatialSuccessorSourceFamilyAfterLeases(family, { device: f.device });
      await retire(f, step);
    }
    assert.equal(f.sphUpload.destroyed, true);
  });

  for (const outcome of ['replace', 'throw', 'replace-inner', 'mutate-destructor']) {
    test(`${route} fused diagnostic ${outcome} retires original particle and grid outputs`, async () => {
      const f = fixture(); let genuine, owned = [], retired;
      try {
        await assert.rejects(runFused(f, { gpuTimestampRecorder: { active: true,
          async measureQueueStage(meta, work) {
            const result = await work();
            if (meta.stage !== 'fusedMechanics') return result;
            genuine = result;
            owned = [result.g2pReconstruction.stateBuffer, result.g2pReconstruction.mechanicsBuffer,
              result.p2gGridProjection.gridBuffer, result.gridUpdate.updatedGridBuffer].filter(Boolean);
            if (outcome === 'throw') throw new Error('diagnostic wrapper failed');
            if (outcome === 'replace') return { ...result };
            if (outcome === 'replace-inner') result.g2pReconstruction.gpuResult = { ...result.g2pReconstruction.gpuResult };
            else result.g2pReconstruction.gpuResult.destroyOutputParticleBuffers = () => { throw new Error('substituted destructor invoked'); };
            return result;
          }
        } }), error => {
          assert.match(error.message, /replaced|diagnostic wrapper failed|genuine live G2P/);
          retired = error.exactMassFusedRetirement;
          return true;
        });
        if (retired) await retired;
      } finally { await retire(f); }
      assert.ok(genuine, 'real fused producer completed');
      assert.equal(owned.length, useSpatial ? 2 : 4);
      assert.ok(owned.every(buffer => buffer.destroyed), 'every genuine retained output retired');
      assert.equal(f.sphUpload.destroyed, true, 'original physical owner has no stranded producer reads');
    });
  }
}

test('failed fused execution waits for an existing consumer and preserves the original error', async () => {
  const f = fixture(); let held, owned = [], completion;
  try {
    await assert.rejects(run(f, { fuseNoFullResidentMechanics: true, gpuTimestampRecorder: {
      active: true, async measureQueueStage(meta, work) {
        const result = await work();
        if (meta.stage === 'fusedMechanics') {
          const output = result.g2pReconstruction.gpuResult;
          owned = [output.stateBuffer, output.mechanicsBuffer, result.p2gGridProjection.gridBuffer,
            result.gridUpdate.updatedGridBuffer];
          held = await acquireMlsMpmMechanicsExactMassCapture(output,
            { device: f.device, sphParticleUpload: f.sphUpload });
          throw new Error('original diagnostic failure with a held reader');
        }
        return result;
      }
    } }), error => {
      assert.match(error.message, /^original diagnostic failure/);
      completion = error.exactMassFusedRetirement;
      return true;
    });
    assert.ok(completion?.then);
    await settle();
    assert.equal(held.validate(), true, 'existing consumer remains usable while failure retirement waits');
    assert.ok(owned.every(buffer => !buffer.destroyed));
    held.release();
    assert.equal(await completion, true);
    assert.ok(owned.every(buffer => buffer.destroyed));
  } finally { held?.release(); await retire(f); }
  assert.equal(f.sphUpload.destroyed, true);
});

test('fused component retirement preserves its sibling and waits for the physical queue fence', async () => {
  const f = fixture(); let step, releaseFence;
  try {
    step = await run(f, { fuseNoFullResidentMechanics: true });
    const outer = step.g2pReconstruction, output = outer.gpuResult;
    await settle();
    const fence = new Promise(resolve => { releaseFence = resolve; });
    f.device.queue.onSubmittedWorkDone = () => fence;
    const retirement = outer.destroyOutputParticleBufferComponents({ state: true });
    await settle();
    assert.equal(output.stateBuffer.destroyed, false);
    assert.equal(output.mechanicsBuffer.destroyed, false);
    await assert.rejects(acquireMlsMpmMechanicsExactMassCapture(output,
      { device: f.device, sphParticleUpload: f.sphUpload }), /genuine live G2P/);
    releaseFence(); assert.equal(await retirement, true);
    assert.equal(output.stateBuffer.destroyed, true);
    assert.equal(output.mechanicsBuffer.destroyed, false, 'unselected sibling remains owned');
    assert.equal(await output.destroyOutputParticleBuffers(), true);
    assert.equal(output.mechanicsBuffer.destroyed, true);
  } finally { releaseFence?.(); await retire(f, step); }
  assert.equal(f.sphUpload.destroyed, true);
});

test('resident cleanup accepts asynchronous fused component ownership without raw destruction', async () => {
  const f = fixture(); let step, releaseFence;
  try {
    step = await run(f, { fuseNoFullResidentMechanics: true });
    await settle();
    const output = step.g2pReconstruction.gpuResult;
    const fence = new Promise(resolve => { releaseFence = resolve; });
    f.device.queue.onSubmittedWorkDone = () => fence;
    steps.destroyMlsMpmResidentStepBuffers(step,
      { preserveBuffers: steps.retainedContinuationBuffersFromUploads(step.nextParticleUploads) });
    await settle();
    assert.equal(output.stateBuffer.destroyed, false);
    assert.equal(output.mechanicsBuffer.destroyed, false);
    releaseFence(); await settle();
    assert.equal(output.stateBuffer.destroyed, true);
    assert.equal(output.mechanicsBuffer.destroyed, true);
  } finally { releaseFence?.(); await retire(f, step); }
});

test('a rejected fused retirement fence quarantines outputs until confirmed device loss', async () => {
  const f = fixture(); let step;
  try {
    step = await run(f, { fuseNoFullResidentMechanics: true });
    await settle();
    const output = step.g2pReconstruction.gpuResult;
    f.device.queue.onSubmittedWorkDone = () => Promise.reject(new Error('unconfirmed queue failure'));
    let completed = false;
    const retirement = output.destroyOutputParticleBuffers().then(() => { completed = true; });
    await settle();
    assert.equal(completed, false);
    assert.equal(output.stateBuffer.destroyed, false);
    assert.equal(output.mechanicsBuffer.destroyed, false);
    f.loseDevice({ reason: 'destroyed' }); await retirement;
    assert.equal(output.stateBuffer.destroyed, true);
    assert.equal(output.mechanicsBuffer.destroyed, true);
  } finally {
    f.loseDevice({ reason: 'destroyed' });
    f.device.queue.onSubmittedWorkDone = async () => {};
    await retire(f, step);
  }
});

function runSequence(f, withThermal, extra = {}) {
  return steps.runMlsMpmResidentStepsWithOptionalWebGpu({ device: f.device,
    sphParticleState: f.packed, mlsMpmParticleState: f.packedMls,
    sphParticleUpload: f.sphUpload, mlsMpmParticleUpload: f.mlsUpload,
    preferWebGpu: true, readbackMode: 'no-full-readback', stepCount: 3,
    fuseNoFullResidentMechanicsSequence: true, compactSummaryMode: 'none',
    gridSpacingM: .5, boxDimsM: [2, 2, 2], dt: .001, gravityMPerS2: [0, 0, 0],
    summaryRunner: null, contactSolverEnabled: false,
    ...(withThermal ? { thermalMaterialTable: f.thermalTable, mechanicsMaterialTable: f.mechanicsTable } : {}),
    ...extra });
}

for (const withThermal of [false, true]) {
  for (const count of [2, 3]) test(`fused exact sequence preserves terminal ownership across batches (thermal=${withThermal}, K=${count})`, async () => {
    const f = fixture(); let first, second, next;
    try {
      first = (await runSequence(f, withThermal, { stepCount: count })).finalStep;
      assert.equal(first.stageTiming.fusedResidentSequence, true);
      next = advance(f, first);
      assert.equal(next.sphUpload.exactMassInventory, f.sphUpload.exactMassInventory);
      assert.notEqual(next.sphUpload.thermoBuffer, f.sphUpload.thermoBuffer);
      assert.equal(next.sphUpload.ownsThermoBuffer, true);
      assert.equal(next.sphUpload.storageGeneration, f.sphUpload.storageGeneration + 1);
      assert.equal(next.sphUpload.positionEpoch, f.sphUpload.positionEpoch + 1);
      assert.equal(next.sphUpload.physicsTick, f.sphUpload.physicsTick + count);
      if (!withThermal) assert.deepEqual(next.sphUpload.thermoBuffer.bytes, f.sphUpload.thermoBuffer.bytes);
      await retire(f);
      assert.equal(f.sphUpload.destroyed, true);
      const read = buffers.acquireSphParticleExactMassRead(next.sphUpload, f.device);
      assert.equal(buffers.validateSphParticleExactMassRead(read, { device: f.device, sourceSphUpload: next.sphUpload }), true);
      await buffers.releaseSphParticleExactMassRead(read);
      second = (await runSequence(next, withThermal, { stepCount: count })).finalStep;
      assert.equal(second.nextParticleUploads.sphParticleUpload.exactMassInventory, f.sphUpload.exactMassInventory);
      await retire(next, first);
      assert.equal(next.sphUpload.destroyed, true);
      const terminal = second.nextParticleUploads.sphParticleUpload;
      const terminalRead = buffers.acquireSphParticleExactMassRead(terminal, f.device);
      await buffers.releaseSphParticleExactMassRead(terminalRead);
      assert.equal(terminal.stateBuffer.destroyed, false);
      assert.equal(terminal.thermoBuffer.destroyed, false);
    } finally {
      if (second) await retire(advance(next, second), second);
      if (first && next) await retire(next, first);
      await retire(f);
    }
  });
}

for (const accepted of [true, false]) test(`early sequence cleanup callback waits for submission completion (accepted=${accepted})`, async () => {
  const f = fixture(); let releaseFence, step, callbackCompletion;
  f.device.queue.onSubmittedWorkDone = () => new Promise(resolve => { releaseFence = resolve; });
  try {
    const execution = runSequence(f, true, { registerFusedSubmittedCleanup({ cleanup }) {
      callbackCompletion = cleanup();
      return { accepted };
    } });
    if (accepted) step = (await execution).finalStep;
    else await assert.rejects(execution, /cleanup owner rejected/);
    await settle();
    const outputs = f.device.createdBuffers.filter(buffer => /fused-sequence-g2p|thermal.*out|refresh.*out/.test(buffer.label));
    assert.ok(outputs.length > 0);
    assert.ok(outputs.every(buffer => !buffer.destroyed));
    f.device.queue.onSubmittedWorkDone = async () => {};
    releaseFence(); await callbackCompletion; await settle();
    if (accepted) {
      assert.equal(step.nextParticleUploads.sphParticleUpload.stateBuffer.destroyed, false);
      const read = buffers.acquireSphParticleExactMassRead(step.nextParticleUploads.sphParticleUpload, f.device);
      await buffers.releaseSphParticleExactMassRead(read);
    } else assert.ok(outputs.every(buffer => buffer.destroyed));
  } finally {
    f.device.queue.onSubmittedWorkDone = async () => {}; releaseFence?.();
    await retire(f, step);
  }
});

for (const withThermal of [false, true]) test(`sequence retirement aliases wait for a held terminal read (thermal=${withThermal})`, async () => {
  const f = fixture(); let step, held;
  try {
    step = (await runSequence(f, withThermal)).finalStep;
    const next = step.nextParticleUploads;
    held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, f.device);
    const outputs = [step.g2pReconstruction, step.g2pReconstruction.gpuResult,
      step.thermalStep, step.mechanicsRefreshStep].filter(Boolean);
    const completions = outputs.map(output => output.destroyOutputParticleBuffers());
    buffers.destroyMlsMpmGpuParticleBuffers(next.mlsMpmParticleUpload);
    steps.destroyMlsMpmResidentStepBuffers(step);
    await settle();
    assert.equal(next.sphParticleUpload.stateBuffer.destroyed, false);
    assert.equal(next.sphParticleUpload.thermoBuffer.destroyed, false);
    assert.equal(next.mlsMpmParticleUpload.mechanicsBuffer.destroyed, false);
    await buffers.releaseSphParticleExactMassRead(held); held = null;
    await Promise.all(completions); await settle();
    assert.equal(next.sphParticleUpload.stateBuffer.destroyed, true);
    assert.equal(next.sphParticleUpload.thermoBuffer.destroyed, true);
    assert.equal(next.mlsMpmParticleUpload.mechanicsBuffer.destroyed, true);
  } finally { if (held) await buffers.releaseSphParticleExactMassRead(held); await retire(f, step); }
});

test('exact sequence rejects copied sources and arbitrary thermal or terminal capabilities', async () => {
  const f = fixture();
  try {
    const start = f.device.createdBuffers.length;
    await assert.rejects(runSequence({ ...f, sphUpload: { ...f.sphUpload } }, true), /original live upload/);
    await assert.rejects(thermal.createSphThermalStepExactSequenceWebGpuEncoderStage({}, {}), /Unknown/);
    await assert.rejects(buffers.bindSphExactMassFusedSequenceContinuation({}), /source association/);
    assert.equal(f.device.createdBuffers.length, start);
    assert.equal(f.device.submissions.length, 0);
  } finally { await retire(f); }
});

test('exact sequence holds original source retirement through a submitted prefix', async () => {
  const f = fixture(); let step;
  try {
    step = (await runSequence(f, true, { maxSubstepsPerSubmission: 1,
      onPresentationSubmissionBoundary() {
        buffers.destroySphGpuParticleBuffers(f.sphUpload);
        assert.notEqual(f.sphUpload.destroyed, true);
      } })).finalStep;
    await settle();
    assert.equal(f.sphUpload.destroyed, true);
    const held = buffers.acquireSphParticleExactMassRead(step.nextParticleUploads.sphParticleUpload, f.device);
    await buffers.releaseSphParticleExactMassRead(held);
  } finally { await retire(f, step); }
});

test('submitted prefix failure quarantines exact sequence resources until confirmed device loss', async () => {
  const f = fixture(); const original = f.device.createCommandEncoder;
  const failure = new Error('next sequence encoder failed'); let retirement;
  f.device.queue.onSubmittedWorkDone = () => Promise.reject(new Error('fence observation failed'));
  try {
    await assert.rejects(runSequence(f, true, { maxSubstepsPerSubmission: 1,
      onPresentationSubmissionBoundary() { f.device.createCommandEncoder = () => { throw failure; }; }
    }), error => { assert.equal(error, failure); retirement = error.exactMassSequenceRetirement; return true; });
    await settle();
    assert.equal(f.device.submissions.length, 1);
    const owned = f.device.createdBuffers.filter(buffer => /fused-sequence-g2p/.test(buffer.label));
    assert.ok(owned.every(buffer => !buffer.destroyed));
    assert.ok(f.sphUpload.__ulgActiveBorrowCount > 0);
    f.loseDevice({ reason: 'destroyed' }); await retirement;
    assert.ok(owned.every(buffer => buffer.destroyed));
    assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0);
  } finally {
    f.device.createCommandEncoder = original; f.device.queue.onSubmittedWorkDone = async () => {};
    f.loseDevice({ reason: 'destroyed' }); await retire(f);
  }
});

test('SPH retirement drains queued sequence mechanics and resolves alias retirement', async () => {
  const f = fixture(); let step, held;
  try {
    step = (await runSequence(f, true)).finalStep;
    const next = step.nextParticleUploads;
    held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, f.device);
    const retirement = step.mechanicsRefreshStep.destroyOutputParticleBuffers();
    await settle();
    buffers.destroySphGpuParticleBuffers(next.sphParticleUpload);
    buffers.destroyMlsMpmGpuParticleBuffers(next.mlsMpmParticleUpload);
    assert.equal(next.mlsMpmParticleUpload.mechanicsBuffer.destroyed, false);
    await buffers.releaseSphParticleExactMassRead(held); held = null;
    await retirement;
    assert.equal(next.sphParticleUpload.destroyed, true);
    assert.equal(next.mlsMpmParticleUpload.mechanicsBuffer.destroyed, true);
  } finally { if (held) await buffers.releaseSphParticleExactMassRead(held); await retire(f, step); }
});

test('deferred MLS retirement cannot redirect to a substituted buffer', async () => {
  const f = fixture(); let step, held, original;
  const unrelated = f.device.createBuffer({ label: 'unrelated-mechanics', size: 4, usage: 0 });
  try {
    step = (await runSequence(f, true)).finalStep;
    const next = step.nextParticleUploads;
    original = next.mlsMpmParticleUpload.mechanicsBuffer;
    held = buffers.acquireSphParticleExactMassRead(next.sphParticleUpload, f.device);
    buffers.destroyMlsMpmGpuParticleBuffers(next.mlsMpmParticleUpload);
    next.mlsMpmParticleUpload.mechanicsBuffer = unrelated;
    await buffers.releaseSphParticleExactMassRead(held); held = null;
    await settle();
    assert.equal(original.destroyed, true);
    assert.equal(unrelated.destroyed, false);
    next.mlsMpmParticleUpload.mechanicsBuffer = original;
  } finally {
    if (held) await buffers.releaseSphParticleExactMassRead(held);
    if (step && original) step.nextParticleUploads.mlsMpmParticleUpload.mechanicsBuffer = original;
    unrelated.destroy(); await retire(f, step);
  }
});

test('sequence source snapshot rejects accessors without acquiring a stranded source read', async () => {
  const f = fixture(); let accesses = 0;
  const source = { ...f.mlsUpload };
  Object.defineProperty(source, 'physicsSubstep', { get() { accesses++; throw new Error('snapshot getter'); } });
  try {
    await assert.rejects(runSequence({ ...f, mlsUpload: source }, false), /data properties/);
    assert.equal(accesses, 0);
    assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0);
    assert.equal(f.device.submissions.length, 0);
  } finally { await retire(f); }
});

test('sequence pre-submit write failure retires every successfully allocated sequence buffer', async () => {
  const f = fixture(), write = f.device.queue.writeBuffer;
  let retirement;
  f.device.queue.writeBuffer = (buffer, ...args) => {
    if (buffer.label === 'ulg-mls-mpm-fused-sequence-p2g-params') throw new Error('sequence write failure');
    return write(buffer, ...args);
  };
  try {
    await assert.rejects(runSequence(f, false), error => {
      assert.match(error.message, /sequence write failure/); retirement = error.exactMassSequenceRetirement; return true;
    });
    await retirement; await settle();
    const allocated = f.device.createdBuffers.filter(buffer => buffer.label.includes('fused-sequence')
      && !buffer.label.includes('empty-schroeder')); // Device-owned cached sentinels outlive the sequence.
    assert.ok(allocated.length > 0);
    assert.ok(allocated.every(buffer => buffer.destroyed), allocated.filter(buffer => !buffer.destroyed).map(buffer => buffer.label).join(", "));
    assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0);
    assert.equal(f.device.submissions.length, 0);
  } finally { f.device.queue.writeBuffer = write; await retire(f); }
});

test('a paired source read pins genuine cold mechanics through submitted sequence prefixes', async () => {
  const f = fixture(); let step;
  try {
    step = (await runSequence(f, true, { maxSubstepsPerSubmission: 1,
      onPresentationSubmissionBoundary() {
        buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
        assert.notEqual(f.mlsUpload.destroyed, true);
        assert.equal(f.mlsUpload.mechanicsBuffer.destroyed, false);
      } })).finalStep;
    await settle();
    assert.equal(f.mlsUpload.destroyed, true);
    const next = advance(f, step);
    const held = buffers.acquireSphParticleExactMassRead(next.sphUpload, f.device,
      { mlsMpmParticleUpload: next.mlsUpload });
    await buffers.releaseSphParticleExactMassRead(held);
  } finally { await retire(f, step); }
});

test('a copied or privately retired cold MLS owner cannot enter an exact sequence', async () => {
  const f = fixture();
  try {
    await assert.rejects(runSequence({ ...f, mlsUpload: { ...f.mlsUpload } }, false), /original live MLS owner/);
    buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
    f.mlsUpload.destroyed = false;
    await assert.rejects(runSequence(f, false), /original live MLS owner/);
    assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0);
    assert.equal(f.device.submissions.length, 0);
  } finally { await retire(f); }
});

test('exact sequence rejects partial-tick source epochs before allocation or submission', async () => {
  const f = fixture({ physicsTick: 5, physicsSubstep: 1 });
  const originalCount = f.device.createdBuffers.length;
  try {
    await assert.rejects(runSequence(f, false), /matching source epochs at a complete physics tick/);
    await settle();
    assert.equal(f.device.createdBuffers.length, originalCount);
    assert.equal(f.device.submissions.length, 0);
    assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0);
  } finally { await retire(f); }
});

test('exact sequence rejects independently genuine but mismatched source epochs', async () => {
  const f = fixture({ physicsTick: 5 });
  buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
  f.mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(f.device, { ...f.packedMls, physicsTick: 6 });
  const originalCount = f.device.createdBuffers.length;
  try {
    await assert.rejects(runSequence(f, false), /matching source epochs at a complete physics tick/);
    await settle();
    assert.equal(f.device.createdBuffers.length, originalCount);
    assert.equal(f.device.submissions.length, 0);
    assert.equal(f.sphUpload.__ulgActiveBorrowCount, 0);
  } finally { await retire(f); }
});

test('copied cold mechanics cannot bypass an authenticated paired read', async () => {
  const f = fixture(); let held;
  try {
    held = buffers.acquireSphParticleExactMassRead(f.sphUpload, f.device, { mlsMpmParticleUpload: f.mlsUpload });
    assert.throws(() => buffers.destroyMlsMpmGpuParticleBuffers({ ...f.mlsUpload }), /original upload/);
    assert.equal(f.mlsUpload.mechanicsBuffer.destroyed, false);
    assert.equal(buffers.validateSphParticleExactMassRead(held, { device: f.device, sourceSphUpload: f.sphUpload }), true);
  } finally { if (held) await buffers.releaseSphParticleExactMassRead(held); await retire(f); }
});

test('pending source mechanics retirement preserves a bank transferred to the terminal owner', async () => {
  const f = fixture(); let step;
  buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload);
  f.mlsUpload = buffers.uploadMlsMpmGpuParticleBuffers(f.device, { ...f.packedMls,
    materialPropertyBankWarmInputTable: { rowCount: 1, rows: new Float32Array(16) } });
  const bank = f.mlsUpload.materialPropertyBankWarmInputBuffer;
  try {
    step = (await runSequence(f, false, { maxSubstepsPerSubmission: 1,
      onPresentationSubmissionBoundary() { buffers.destroyMlsMpmGpuParticleBuffers(f.mlsUpload); }
    })).finalStep;
    await settle();
    const next = step.nextParticleUploads.mlsMpmParticleUpload;
    assert.equal(f.mlsUpload.destroyed, true);
    assert.equal(next.materialPropertyBankWarmInputBuffer, bank);
    assert.equal(next.ownsMaterialPropertyBankWarmInputBuffer, true);
    assert.equal(bank.destroyed, false);
    buffers.destroyMlsMpmGpuParticleBuffers(next); await settle();
    assert.equal(bank.destroyed, true);
  } finally { await retire(f, step); }
});

test('late bound sequence failure resolves retirement only after terminal reads finish', async () => {
  const f = fixture(), fences = []; let retirement;
  f.device.queue.onSubmittedWorkDone = () => new Promise(resolve => fences.push(resolve));
  try {
    await assert.rejects(runSequence(f, false, { registerFusedSubmittedCleanup() {
      Object.defineProperty(f.sphUpload, 'ownsIdentityBuffer', { value: true, writable: false });
      return true;
    } }), error => { retirement = error.exactMassSequenceRetirement; return error instanceof TypeError; });
    let complete = false;
    retirement.then(() => { complete = true; });
    await settle();
    fences.shift()(); await settle();
    assert.ok(fences.length > 0, 'bound terminal producer read has its own confirmed retirement');
    const outputs = f.device.createdBuffers.filter(buffer => buffer.label.includes('g2p-state-ping'));
    assert.equal(complete, false);
    assert.ok(outputs.every(buffer => !buffer.destroyed));
    f.device.queue.onSubmittedWorkDone = async () => {};
    for (const release of fences) release();
    await retirement;
    assert.ok(outputs.every(buffer => buffer.destroyed));
  } finally {
    f.device.queue.onSubmittedWorkDone = async () => {};
    for (const release of fences) release();
    await retire(f);
  }
});
