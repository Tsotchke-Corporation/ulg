import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostMechanicsStageOutputSeal } from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import { acquireSphThermalExactMassSourceCapture, resolveSphThermalSourceCapture,
  runSphThermalStepWebGpu } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { createExactThermalReactionSourceFixture } from './fixtures/sphThermalExactReactionSourceFixture.js';

// Command-recorder helper from sphExactMassContinuation: genuine production
// JavaScript owners execute; these CPU tests do not execute shader arithmetic.
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

const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject }; };
async function fixture(options) {
  const device = fakeG2pDevice(), loss = deferred();
  device.lost = loss.promise;
  return { ...await createExactThermalReactionSourceFixture(device, options), loss };
}
const acquire = f => acquireSphThermalExactMassSourceCapture(f.thermalResult, f.token, f.expected);

test('post-mechanics seal retains independent reads after original owner release', () => {
  let destroyed = 0, drained = 0;
  const output = { stateBuffer: {}, destroyOutputParticleBuffers() { destroyed++; } };
  const seal = createPostMechanicsStageOutputSeal(output, {}, { onLastRelease() { drained++; } });
  const a = seal.retain(), b = seal.retain();
  assert.equal(seal.release(), true); assert.equal(seal.release(), false);
  assert.equal(a.release(), true); assert.equal(a.release(), false);
  assert.equal(b.validate(), true);
  assert.throws(() => output.destroyOutputParticleBuffers(), /owner read/);
  assert.throws(() => seal.retain(), /closed read admission/);
  assert.equal(drained, 0);
  assert.equal(b.release(), true); assert.equal(drained, 1);
  output.destroyOutputParticleBuffers(); assert.equal(destroyed, 1);
});

test('genuine exact thermal source binds its independent physical window and encoded interval', async () => {
  const f = await fixture();
  try {
    const source = await acquire(f);
    assert.equal(source.stateBuffer, f.thermalResult.stateBuffer);
    assert.equal(source.thermoBuffer, f.thermalResult.thermoBuffer);
    assert.equal(source.mechanicsBuffer, f.g2pResult.mechanicsBuffer);
    assert.equal(source.sourceSphUpload, f.sphParticleUpload);
    assert.equal(source.sourceMlsUpload, f.mlsMpmParticleUpload);
    assert.equal(source.thermalMaterialTable, f.thermalMaterialTable);
    assert.equal(source.format, f.sphParticleUpload.exactMassInventory.format);
    assert.equal(source.rowCount, f.sphParticleState.particleCount);
    assert.equal(source.encodedDtSeconds, Math.fround(f.expected.dtSeconds));
    assert.equal(source.encodedDtBits, new Uint32Array(new Float32Array([f.expected.dtSeconds]).buffer)[0]);
    assert.equal(source.physicalPublicationAdmitted, false);
    const completion = source.release(); assert.equal(source.release(), completion);
    await completion;
    assert.throws(() => source.validate(), /released/);
    assert.throws(() => f.thermalResult.destroyOutputParticleBuffers(), /owner read/, 'original closure hold remains');
  } finally { await f.cleanup(); }
});

test('exact thermal source rejects copied origins and every missing or substituted critical expectation', async () => {
  const f = await fixture();
  try {
    await assert.rejects(acquireSphThermalExactMassSourceCapture({ ...f.thermalResult }, f.token, f.expected), /original producer/);
    await assert.rejects(acquireSphThermalExactMassSourceCapture(f.thermalResult, {}, f.expected), /original producer/);
    for (const key of Object.keys(f.expected)) {
      const changed = { ...f.expected, [key]: key === 'dtSeconds' ? .002 : {} };
      await assert.rejects(acquireSphThermalExactMassSourceCapture(f.thermalResult, f.token, changed), /original/);
      if (key !== 'g2pResult') {
        delete changed[key];
        await assert.rejects(acquireSphThermalExactMassSourceCapture(f.thermalResult, f.token, changed), /original/);
      }
    }
    const source = await acquire(f); await source.release();
  } finally { await f.cleanup(); }
});

test('two thermal source reads retain outputs through closure release and independent retirement', async () => {
  const f = await fixture();
  try {
    const first = await acquire(f), second = await acquire(f);
    resolveSphThermalSourceCapture(f.thermalResult, f.token).release();
    await first.release();
    assert.equal(second.validate(), true);
    assert.throws(() => f.thermalResult.destroyOutputParticleBuffers(), /owner read/);
    assert.throws(() => f.g2pResult.destroyOutputParticleBuffers(), /retained/);
    await second.release();
    await assert.rejects(acquire(f), /original producer and token/);
    assert.equal(resolveSphThermalSourceCapture(f.thermalResult, f.token).validate(), true,
      'legacy stage lookup remains valid until physical output retirement');
  } finally { await f.cleanup(); }
});

for (const mode of ['pending', 'reject', 'throw', 'missing']) {
  test(`exact thermal source ${mode} retirement fence retains all pins until fulfilled loss`, async () => {
    const f = await fixture(), fence = deferred();
    const source = await acquire(f);
    resolveSphThermalSourceCapture(f.thermalResult, f.token).release();
    f.device.queue.onSubmittedWorkDone = mode === 'throw' ? () => { throw new Error('fence unavailable'); }
      : mode === 'missing' ? undefined : () => fence.promise;
    if (mode === 'reject') fence.reject(new Error('fence rejected'));
    const completion = source.release(); let settled = false;
    completion.then(() => { settled = true; });
    await turn();
    assert.equal(settled, false);
    assert.throws(() => f.thermalResult.destroyOutputParticleBuffers(), /owner read/);
    assert.throws(() => f.g2pResult.destroyOutputParticleBuffers(), /retained/);
    f.loss.resolve({ message: 'fulfilled loss' });
    assert.equal(await completion, true);
    fence.resolve();
    f.device.queue.onSubmittedWorkDone = () => Promise.resolve();
    await f.cleanup();
  });
}

test('rejected device loss does not release a pending exact thermal source', async () => {
  const f = await fixture(), fence = deferred();
  const source = await acquire(f);
  f.device.queue.onSubmittedWorkDone = () => fence.promise;
  const completion = source.release(); let settled = false;
  completion.then(() => { settled = true; });
  f.loss.reject(new Error('loss observer rejection')); await turn();
  assert.equal(settled, false);
  assert.throws(() => f.g2pResult.destroyOutputParticleBuffers(), /retained/);
  fence.resolve(); await completion;
  await f.cleanup();
});

test('exact thermal source rejects original material contents changed after production', async () => {
  const f = await fixture(), records = f.thermalMaterialTable.records;
  const original = records[0];
  try {
    const source = await acquire(f);
    records[0] = original + 1;
    assert.throws(() => source.validate(), /contents changed/);
    await assert.rejects(acquire(f), /contents changed/);
    records[0] = original; await source.release();
  } finally { records[0] = original; await f.cleanup(); }
});

test('exact thermal snapshots cold table contents before its first await', async () => {
  const f = await fixture(), records = f.thermalMaterialTable.records, original = records[0];
  try {
    const count = f.device.submissions.length;
    const pending = runSphThermalStepWebGpu({ ...f.thermalArgs, postMechanicsSourceCapture: {} });
    records[0] = original + 1;
    await assert.rejects(pending, /contents changed/);
    assert.equal(f.device.submissions.length, count);
  } finally { records[0] = original; await f.cleanup(); }
});

for (const dtS of [NaN, Infinity, -1, Number.MIN_VALUE, Number.MAX_VALUE]) {
  test(`exact thermal rejects unrepresentable duration ${dtS} before submission`, async () => {
    const f = await fixture();
    try {
      const count = f.device.submissions.length;
      await assert.rejects(runSphThermalStepWebGpu({ ...f.thermalArgs, dtS, postMechanicsSourceCapture: {} }), /duration/);
      assert.equal(f.device.submissions.length, count);
    } finally { await f.cleanup(); }
  });
}

test('failed late source acquisition throws promptly and carries quarantined cleanup completion', async () => {
  const f = await fixture(), fence = deferred();
  try {
    const pending = acquire(f);
    const records = f.thermalMaterialTable.records, original = records[0];
    records[0] = original + 1;
    f.device.queue.onSubmittedWorkDone = () => fence.promise;
    let failure;
    try { await pending; } catch (error) { failure = error; }
    assert.match(failure.message, /contents changed/);
    assert.ok(failure.exactThermalSourceCleanupCompletion?.then);
    records[0] = original;
    assert.throws(() => f.g2pResult.destroyOutputParticleBuffers(), /retained/);
    fence.resolve(); await failure.exactThermalSourceCleanupCompletion;
  } finally { fence.resolve(); await f.cleanup(); }
});

for (const loss of [false, true]) {
  test(`throwing exact thermal submission retains source and output owners until ${loss ? 'fulfilled loss' : 'queue completion'}`, async () => {
    const f = await fixture(), fence = deferred();
    const submit = f.device.queue.submit, done = f.device.queue.onSubmittedWorkDone;
    try {
      const start = f.device.createdBuffers.length;
      f.device.queue.onSubmittedWorkDone = () => fence.promise;
      f.device.queue.submit = commands => { submit(commands); throw new Error('injected post-submit failure'); };
      let failure;
      try { await runSphThermalStepWebGpu({ ...f.thermalArgs, postMechanicsSourceCapture: {} }); }
      catch (error) { failure = error; }
      assert.match(failure.message, /injected post-submit failure/);
      assert.ok(failure.exactThermalSourceCleanupCompletion?.then);
      const outputs = f.device.createdBuffers.slice(start).filter(buffer => buffer.label.includes('thermal-output'));
      assert.equal(outputs.length, 2);
      assert.ok(outputs.every(buffer => !buffer.destroyed));
      assert.throws(() => f.g2pResult.destroyOutputParticleBuffers(), /retained/);
      if (loss) { fence.reject(new Error('unconfirmed queue')); await turn();
        assert.ok(outputs.every(buffer => !buffer.destroyed)); f.loss.resolve({ message: 'fulfilled loss' }); }
      else fence.resolve();
      await failure.exactThermalSourceCleanupCompletion;
      assert.ok(outputs.every(buffer => buffer.destroyed));
    } finally {
      f.device.queue.submit = submit; f.device.queue.onSubmittedWorkDone = done;
      fence.resolve(); await f.cleanup();
    }
  });
}
