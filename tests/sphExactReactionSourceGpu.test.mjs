import assert from 'node:assert/strict';
import test from 'node:test';
import { runExactReactionSourceNative } from './fixtures/sphExactReactionSourceNative.js';
import { runSphExactReactionSourceSelectionWebGpu, resolveSphExactReactionSourceSelection } from '../src/runtime/sph/sphExactReactionSourceGpu.js';

// Command recorder: genuine JavaScript producers, no WGSL arithmetic claims.
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

async function withSource(inspect) {
  const device = fakeG2pDevice();
  device.lost = new Promise(() => {});
  return runExactReactionSourceNative(device, { inspect });
}

test('exact preparation admits genuine canonical inputs and keeps numerical evidence private', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    assert.equal(result.physicalPublicationAdmitted, false);
    const admitted = resolveSphExactReactionSourceSelection(result, { device: args.device });
    assert.equal(admitted.source.stateBuffer, args.thermalResult.stateBuffer);
    assert.equal(admitted.source.mechanicsBuffer, args.g2pResult.mechanicsBuffer);
    assert.equal(admitted.source.generation, args.generation);
    assert.throws(() => resolveSphExactReactionSourceSelection({ ...result }, { device: args.device }), /Original/);
    const pending = result.release(); assert.equal(result.release(), pending); await pending;
    assert.throws(() => resolveSphExactReactionSourceSelection(result, { device: args.device }), /Original|released/);
    return true;
  });
});

test('exact preparation rejects replaced producer, interval, table and upload inputs before selection submit', async () => {
  await withSource(async args => {
    for (const replace of [
      { thermalResult: { ...args.thermalResult } }, { thermalSourceCapture: {} },
      { g2pResult: { ...args.g2pResult } }, { dtSeconds: args.dtSeconds * 2 },
      { sphParticleUpload: { ...args.sphParticleUpload } },
      { mlsMpmParticleUpload: { ...args.mlsMpmParticleUpload } },
      { reactionTable: { ...args.reactionTable } }, { reactionDiscoveryProposal: { ...args.reactionDiscoveryProposal } }
    ]) {
      const count = args.device.submissions.length;
      let failure;
      await assert.rejects(runSphExactReactionSourceSelectionWebGpu({ ...args, ...replace }), error => {
        failure = error; return true;
      });
      await failure.exactReactionSourceCleanupCompletion;
      assert.equal(args.device.submissions.length, count);
    }
    return true;
  });
});

test('started preparation independently holds discovery across its first asynchronous source acquisition', async () => {
  await withSource(async args => {
    const pending = runSphExactReactionSourceSelectionWebGpu(args);
    args.reactionDiscoveryProposal.destroy();
    const result = await pending;
    assert.ok(resolveSphExactReactionSourceSelection(result, { device: args.device }));
    await result.release();
    return true;
  });
});

test('genuine source and discovery holds survive all asynchronous pipeline compilations', async () => {
  await withSource(async args => {
    const compilations = [];
    args.device.createComputePipelineAsync = descriptor => new Promise(resolve => compilations.push({ descriptor, resolve }));
    const pending = runSphExactReactionSourceSelectionWebGpu(args);
    await new Promise(resolve => setImmediate(resolve));
    args.reactionDiscoveryProposal.destroy();
    for (let index = 0; index < 3; index++) {
      assert.equal(compilations.length, index + 1);
      assert.throws(() => args.thermalResult.destroyOutputParticleBuffers(), /owner read/);
      const { descriptor, resolve } = compilations[index];
      resolve(args.device.createComputePipeline(descriptor));
      await new Promise(resolve => setImmediate(resolve));
    }
    const result = await pending;
    assert.ok(resolveSphExactReactionSourceSelection(result, { device: args.device }));
    await result.release(); return true;
  });
});

test('changed original reaction table during compilation rejects before selection submission', async () => {
  await withSource(async args => {
    const previous = args.reactionTable.records[3], submissions = args.device.submissions.length;
    let compilationCount = 0, failure;
    args.device.createComputePipelineAsync = async descriptor => {
      if (++compilationCount === 1) args.reactionTable.records[3] = previous + 1;
      return args.device.createComputePipeline(descriptor);
    };
    try {
      await assert.rejects(runSphExactReactionSourceSelectionWebGpu(args), error => { failure = error; return true; });
      await failure.exactReactionSourceCleanupCompletion;
      assert.equal(args.device.submissions.length, submissions);
    } finally { args.reactionTable.records[3] = previous; }
    return true;
  });
});

test('late selection destructor failure retires siblings and retries only the failed buffer', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    const owned = args.device.createdBuffers.filter(buffer => [
      'ulg-exact-reaction-source-selection', 'ulg-exact-reaction-source-metadata', 'ulg-exact-reaction-source-params'
    ].includes(buffer.label));
    assert.equal(owned.length, 3);
    const counts = [0, 0, 0];
    owned.forEach((buffer, index) => {
      const destroy = buffer.destroy;
      buffer.destroy = () => {
        counts[index]++;
        if (index === 1 && counts[index] === 1) throw new Error('late destruction failure');
        destroy.call(buffer);
      };
    });
    await assert.rejects(result.release(), /cleanup failed/);
    assert.deepEqual(counts, [1, 1, 1]);
    await result.release();
    assert.deepEqual(counts, [1, 2, 1]);
    assert.ok(owned.every(buffer => buffer.destroyed));
    return true;
  });
});

test('selection resources and source pins survive pending confirmed retirement', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    const originalFence = args.device.queue.onSubmittedWorkDone, fences = [];
    args.device.queue.onSubmittedWorkDone = () => new Promise(resolve => fences.push(resolve));
    const completion = result.release();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(result.outputBuffer.destroyed, false);
    assert.throws(() => args.thermalResult.destroyOutputParticleBuffers(), /owner read/);
    assert.ok(fences.length >= 1);
    args.device.queue.onSubmittedWorkDone = originalFence;
    for (const resolve of fences) resolve();
    await completion;
    assert.equal(result.outputBuffer.destroyed, true);
    return true;
  });
});

test('throwing selection submission attaches quarantined cleanup until actual queue completion', async () => {
  await withSource(async args => {
    const submit = args.device.queue.submit, originalFence = args.device.queue.onSubmittedWorkDone, fences = [];
    args.device.queue.onSubmittedWorkDone = () => new Promise(resolve => fences.push(resolve));
    args.device.queue.submit = commands => {
      if (commands.some(command => command.events?.some(event => event.pipeline?.label === 'ulg-exact-reaction-source-selection'))) {
        throw new Error('selection submission failed');
      }
      return submit(commands);
    };
    let failure;
    await assert.rejects(runSphExactReactionSourceSelectionWebGpu(args), error => {
      failure = error; return /selection submission failed/.test(error.message);
    });
    const output = args.device.createdBuffers.find(buffer => buffer.label === 'ulg-exact-reaction-source-selection');
    assert.equal(output.destroyed, false);
    args.device.queue.submit = submit; args.device.queue.onSubmittedWorkDone = originalFence;
    for (const resolve of fences) resolve();
    await failure.exactReactionSourceCleanupCompletion;
    assert.equal(output.destroyed, true);
    return true;
  });
});
