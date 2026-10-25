import assert from 'node:assert/strict';
import test from 'node:test';
import { runExactReactionSourceNative } from './fixtures/sphExactReactionSourceNative.js';
import { runSphExactReactionSourceSelectionWebGpu, resolveSphExactReactionSourceSelection,
  acquireSphExactReactionSourceSelectionRead } from '../src/runtime/sph/sphExactReactionSourceGpu.js';
import { runSphReactionStepWebGpu } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { resolveSphExactReactionRoutingCandidate } from '../src/runtime/sph/sphExactReactionRoutingGpu.js';

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

async function withSource(inspect, { lost = new Promise(() => {}), stopAfterInspect = false } = {}) {
  const device = fakeG2pDevice();
  device.lost = lost;
  // Loss tests finish inside the genuine G2P source hook: a lost transaction
  // cannot then enter the fixture's unrelated preserving closure.
  const stop = new Error('Source inspection completed before terminal closure');
  let observed;
  try {
    return await runExactReactionSourceNative(device, { inspect: async args => {
      observed = await inspect(args);
      if (stopAfterInspect) throw stop;
      return observed;
    } });
  } catch (error) {
    if (error === stop) return observed;
    throw error;
  }
}

test('exact preparation admits genuine canonical inputs and keeps numerical evidence private', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    assert.equal(result.physicalPublicationAdmitted, false);
    const admitted = resolveSphExactReactionSourceSelection(result, { device: args.device });
    const selectedDispatches = args.device.dispatches.filter(event => event.pipeline.compute.entryPoint.includes('exact_reaction'));
    assert.deepEqual(selectedDispatches.map(event => event.pipeline.compute.entryPoint), [
      'prepare_exact_reaction_sources', 'select_exact_reaction_debits', 'partition_exact_reaction_products',
      'prepare_exact_reaction_extensives', 'project_exact_reaction_momentum',
      'prepare_exact_reaction_caloric_target', 'initialize_exact_reaction_caloric_bracket',
      ...Array(31).fill('refine_exact_reaction_caloric_bracket'), 'finalize_exact_reaction_caloric_state',
      'prepare_exact_reaction_product_energy', 'prepare_exact_reaction_species_quantity'
    ]);
    for (const event of selectedDispatches) {
      assert.equal(event.bindGroup.entries[0].resource.buffer, args.thermalResult.stateBuffer);
      assert.equal(event.bindGroup.entries[6].resource.buffer, result.outputBuffer);
    }
    assert.equal(result.extensiveWordCount, result.format.wordCount + 18);
    assert.equal(result.extensiveQuantumExponent, result.format.quantumExponent - 299);
    assert.equal(result.caloricOffsetWords, result.extensiveOffsetWords + 4 + 12 * (result.extensiveWordCount + 2));
    assert.equal(result.productEnergyOffsetWords, result.caloricOffsetWords + result.caloricRecordWords);
    assert.equal(result.speciesOffsetWords, result.productEnergyOffsetWords + result.productEnergyRecordWords);
    assert.equal(result.recordWords, result.speciesOffsetWords + result.speciesRecordWords);
    assert.equal(result.caloricWordCount, 3 * result.format.wordCount + 26);
    assert.equal(result.caloricRecordWords, result.caloricProductOffsetWords
      + 3 * result.caloricProductCapacity * result.caloricProductStrideWords);
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

test('expanded packet parameters reject device capacity without leaking original producer reads', async () => {
  await withSource(async args => {
    const oldLimit = args.device.limits.maxUniformBufferBindingSize;
    const submissionCount = args.device.submissions.length;
    const bufferCount = args.device.createdBuffers.length;
    args.device.limits.maxUniformBufferBindingSize = 48;
    try {
      let failure;
      await assert.rejects(runSphExactReactionSourceSelectionWebGpu(args), error => {
        failure = error;
        return /params exceeds exact reaction device capacity/.test(error.message);
      });
      await failure.exactReactionSourceCleanupCompletion;
      assert.equal(args.device.submissions.length, submissionCount);
      const owned = args.device.createdBuffers.slice(bufferCount)
        .filter(buffer => buffer.label?.startsWith('ulg-exact-reaction-source-'));
      assert.equal(owned.length, 2);
      assert.ok(owned.every(buffer => buffer.destroyed));
    } finally { args.device.limits.maxUniformBufferBindingSize = oldLimit; }
    // Reacquisition and successful retirement prove that the rejected attempt
    // did not retire or strand the original genuine source tuple.
    const selected = await runSphExactReactionSourceSelectionWebGpu(args);
    await selected.release();
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
    // Drive every cold pipeline await, including the extensive and COM passes.
    for (let index = 0; index < 11; index++) {
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
    const read = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
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
    const rejected = assert.rejects(result.release(), /cleanup failed/);
    await read.release();
    await rejected;
    assert.deepEqual(counts, [1, 1, 1]);
    await result.release();
    assert.deepEqual(counts, [1, 2, 1]);
    assert.ok(owned.every(buffer => buffer.destroyed));
    return true;
  });
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('packet reads authenticate the complete original tuple without acquiring on mismatches or invoking getters', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    const expected = { device: args.device, reactionTable: args.reactionTable,
      thermalMaterialTable: args.thermalMaterialTable, sphParticleUpload: args.sphParticleUpload,
      mlsMpmParticleUpload: args.mlsMpmParticleUpload, transaction: args.transaction, generation: args.generation,
      dtSeconds: args.dtSeconds, encodedDtBits: result.encodedDtBits,
      sourceStateBuffer: args.thermalResult.stateBuffer, sourceThermoBuffer: args.thermalResult.thermoBuffer,
      sourceMechanicsBuffer: args.g2pResult.mechanicsBuffer };
    const buffers = args.device.createdBuffers.length, submissions = args.device.submissions.length;
    assert.throws(() => acquireSphExactReactionSourceSelectionRead({ ...result }, expected), /Original/);
    for (const key of Object.keys(expected)) {
      assert.throws(() => acquireSphExactReactionSourceSelectionRead(result,
        { ...expected, [key]: typeof expected[key] === 'number' ? expected[key] + 1 : {} }), /original/i, key);
    }
    let getterCalls = 0;
    for (const key of Object.keys(expected)) {
      const accessor = { ...expected };
      Object.defineProperty(accessor, key, { get() { getterCalls++; return expected[key]; } });
      assert.throws(() => acquireSphExactReactionSourceSelectionRead(result, accessor), /original/i, key);
    }
    assert.equal(getterCalls, 0);
    assert.throws(() => acquireSphExactReactionSourceSelectionRead(result, {}), /original device/);
    assert.equal(args.device.createdBuffers.length, buffers);
    assert.equal(args.device.submissions.length, submissions);
    const read = acquireSphExactReactionSourceSelectionRead(result, expected);
    assert.ok(Object.isFrozen(read) && Object.isFrozen(read.view) && Object.isFrozen(read.view.source));
    assert.equal(read.view.result, result);
    assert.equal(read.view.reactionTable, args.reactionTable);
    assert.equal(read.view.thermalMaterialTable, args.thermalMaterialTable);
    const source = read.view.source;
    assert.equal(source.device, args.device);
    assert.equal(source.particleCount, result.particleCount);
    assert.equal(source.stateBuffer, args.thermalResult.stateBuffer);
    assert.equal(source.thermoBuffer, args.thermalResult.thermoBuffer);
    assert.equal(source.mechanicsBuffer, args.g2pResult.mechanicsBuffer);
    assert.equal(source.sourceSphUpload, args.sphParticleUpload);
    assert.equal(source.sourceMlsUpload, args.mlsMpmParticleUpload);
    assert.equal(source.transaction, args.transaction);
    assert.equal(source.generation, args.generation);
    assert.equal(source.encodedDtBits, result.encodedDtBits);
    assert.equal(source.release, undefined);
    assert.equal(source.sourceRead, undefined);
    assert.equal(source.inventory.buffer,
      resolveSphExactReactionSourceSelection(result, { device: args.device }).source.sourceRead.read.buffer);
    expected.sourceStateBuffer = {}; // Caller options are not retained authority.
    assert.equal(read.validate(), read.view);
    assert.equal(await read.release(), true);
    assert.equal(read.released, true);
    assert.throws(() => read.validate(), /released/);
    await result.release();
    return true;
  });
});

test('independent packet readers survive owner close and consumer awaits until each submitted read retires', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    const first = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
    const second = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
    const originalFence = args.device.queue.onSubmittedWorkDone, fences = [];
    args.device.queue.onSubmittedWorkDone = () => { const gate = deferred(); fences.push(gate); return gate.promise; };
    let retired = false;
    const ownerCompletion = result.release().then(value => { retired = true; return value; });
    args.reactionDiscoveryProposal.destroy();
    await nextTurn();
    assert.equal(fences.length, 0, 'closing the producer must not fence before held consumers submit');
    assert.equal(retired, false);
    assert.throws(() => resolveSphExactReactionSourceSelection(result, { device: args.device }), /released/);
    assert.throws(() => acquireSphExactReactionSourceSelectionRead(result, { device: args.device }), /released/);
    assert.equal(first.validate(), first.view);
    assert.equal(second.validate(), second.view);
    assert.throws(() => args.thermalResult.destroyOutputParticleBuffers(), /owner read/);
    args.device.queue.submit([args.device.createCommandEncoder().finish()]);
    const firstCompletion = first.release();
    assert.equal(first.release(), firstCompletion);
    assert.throws(() => first.validate(), /released/);
    assert.equal(fences.length, 1);
    assert.equal(result.outputBuffer.destroyed, false);
    fences[0].resolve();
    assert.equal(await firstCompletion, true);
    assert.equal(retired, false);
    assert.equal(second.validate(), second.view);
    await nextTurn(); // Second consumer can still compile/encode after the first retires.
    args.device.queue.submit([args.device.createCommandEncoder().finish()]);
    const secondCompletion = second.release();
    assert.equal(fences.length, 2);
    assert.equal(result.outputBuffer.destroyed, false);
    args.device.queue.onSubmittedWorkDone = originalFence;
    fences[1].resolve();
    assert.equal(await secondCompletion, true);
    await ownerCompletion;
    assert.equal(result.outputBuffer.destroyed, true);
    return true;
  });
});

test('retained packet validates original table contents after producer close', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    const read = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
    const ownerCompletion = result.release();
    const original = args.reactionTable.records[3];
    args.reactionTable.records[3] = original + 1;
    assert.throws(() => read.validate(), /snapshot|changed|stale/);
    args.reactionTable.records[3] = original;
    assert.equal(read.validate(), read.view);
    await read.release(); await ownerCompletion;
    return true;
  });
});

test('closing the producer during expected tuple inspection cannot acquire a packet pin', async () => {
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    let completion;
    const expected = new Proxy({ device: args.device }, {
      ownKeys(target) { completion = result.release(); return Reflect.ownKeys(target); }
    });
    assert.throws(() => acquireSphExactReactionSourceSelectionRead(result, expected), /released/);
    await completion;
    assert.equal(result.outputBuffer.destroyed, true);
    return true;
  });
});

test('packet loss observation is shared across successive producers on one device', async () => {
  let subscriptions = 0;
  const pending = new Promise(() => {});
  const lost = { then(...args) { subscriptions++; return pending.then(...args); } };
  await withSource(async args => {
    let firstCount;
    for (let iteration = 0; iteration < 3; iteration++) {
      const result = await runSphExactReactionSourceSelectionWebGpu(args);
      const read = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
      await read.release(); await result.release(); await nextTurn();
      if (iteration === 0) firstCount = subscriptions;
      else assert.equal(subscriptions, firstCount);
    }
    return true;
  }, { lost });
});

for (const mode of ['missing', 'throwing', 'rejecting', 'non-thenable']) {
  test(`packet read ${mode} fence cannot retire before fulfilled device loss`, async () => {
    const loss = deferred();
    await withSource(async args => {
      const result = await runSphExactReactionSourceSelectionWebGpu(args);
      const read = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
      const originalFence = args.device.queue.onSubmittedWorkDone;
      args.device.queue.onSubmittedWorkDone = mode === 'missing' ? undefined : () => {
        if (mode === 'throwing') throw new Error('fence unavailable');
        if (mode === 'rejecting') return Promise.reject(new Error('fence rejected'));
        return undefined;
      };
      let settled = false;
      const completion = read.release().then(value => { settled = true; return value; });
      const ownerCompletion = result.release();
      await nextTurn();
      assert.equal(settled, false);
      assert.equal(result.outputBuffer.destroyed, false);
      assert.throws(() => args.thermalResult.destroyOutputParticleBuffers(), /owner read/);
      args.device.queue.onSubmittedWorkDone = originalFence;
      loss.resolve({ reason: 'destroyed', message: 'confirmed loss' });
      assert.equal(await completion, false);
      await ownerCompletion;
      assert.equal(result.outputBuffer.destroyed, true);
      assert.throws(() => acquireSphExactReactionSourceSelectionRead(result, { device: args.device }), /Original|lost|released/);
      return true;
    }, { lost: loss.promise, stopAfterInspect: true });
  });
}

test('fulfilled loss closes unreleased packet readers and retires the owner without reporting success', async () => {
  const loss = deferred();
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    const first = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
    const second = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
    loss.resolve({ reason: 'destroyed', message: 'confirmed loss while consumer is compiling' });
    await nextTurn();
    assert.equal(first.released, true);
    assert.equal(second.released, true);
    assert.throws(() => first.validate(), /released|lost/);
    assert.throws(() => acquireSphExactReactionSourceSelectionRead(result, { device: args.device }), /Original|lost|released/);
    assert.equal(await first.release(), false);
    assert.equal(await second.release(), false);
    await result.release();
    assert.equal(result.outputBuffer.destroyed, true);
    return true;
  }, { lost: loss.promise, stopAfterInspect: true });
});

test('rejected device loss never confirms a packet read before its successful queue fence', async () => {
  const loss = deferred();
  await withSource(async args => {
    const result = await runSphExactReactionSourceSelectionWebGpu(args);
    const read = acquireSphExactReactionSourceSelectionRead(result, { device: args.device });
    const originalFence = args.device.queue.onSubmittedWorkDone, fence = deferred();
    args.device.queue.onSubmittedWorkDone = () => fence.promise;
    let settled = false;
    const completion = read.release().then(value => { settled = true; return value; });
    const ownerCompletion = result.release();
    loss.reject(new Error('not fulfilled loss'));
    await nextTurn();
    assert.equal(settled, false);
    assert.equal(result.outputBuffer.destroyed, false);
    args.device.queue.onSubmittedWorkDone = originalFence;
    fence.resolve();
    assert.equal(await completion, true);
    await ownerCompletion;
    return true;
  }, { lost: loss.promise, stopAfterInspect: true });
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

function routingArgs(args, selection) {
  return { ...args, sourceStateBuffer: args.thermalResult.stateBuffer,
    sourceThermoBuffer: args.thermalResult.thermoBuffer, sourceMechanicsBuffer: args.g2pResult.mechanicsBuffer,
    schroederSpatialEpochGeneration: args.generation,
    schroederSpatialReactionDiscoveryProposal: args.reactionDiscoveryProposal,
    exactReactionSourceSelection: selection, retainOutputParticleBuffers: true, readbackMode: 'no-full-readback' };
}
const routingBuffers = device => device.createdBuffers.filter(buffer => buffer.label?.startsWith('ulg-exact-reaction-routing'));

test('actual reaction routing retains the original packet through cold compilation and producer close', async () => {
  await withSource(async args => {
    const selected = await runSphExactReactionSourceSelectionWebGpu(args);
    const compilations = [];
    args.device.createComputePipelineAsync = descriptor => new Promise(resolve => compilations.push({ descriptor, resolve }));
    const pending = runSphReactionStepWebGpu(routingArgs(args, selected));
    await nextTurn();
    assert.equal(compilations.length, 1);
    assert.equal(compilations[0].descriptor.compute.entryPoint, 'prepare_exact_reaction_endpoint_routes');
    const parentCompletion = selected.release();
    args.reactionDiscoveryProposal.destroy();
    await nextTurn();
    assert.equal(selected.outputBuffer.destroyed, false);
    assert.throws(() => args.thermalResult.destroyOutputParticleBuffers(), /owner read/);
    compilations[0].resolve(args.device.createComputePipeline(compilations[0].descriptor));
    const routed = await pending;
    const events = args.device.dispatches.filter(event => event.pipeline.compute.entryPoint === 'prepare_exact_reaction_endpoint_routes');
    assert.equal(events.length, 1);
    assert.equal(events[0].bindGroup.entries[0].resource.buffer, selected.outputBuffer);
    assert.equal(events[0].bindGroup.entries[2].resource.buffer, routed.outputBuffer);
    assert.equal(routed.sourceSelection, selected);
    assert.equal(routed.physicalPublicationAdmitted, false);
    assert.equal(routed.stateBuffer, undefined, 'numeric candidate is not a physical stage output');
    const inspected = resolveSphExactReactionRoutingCandidate(routed, { device: args.device });
    assert.equal(inspected.source.result, selected);
    assert.equal(inspected.source.source.stateBuffer, args.thermalResult.stateBuffer);
    assert.throws(() => resolveSphExactReactionRoutingCandidate({ ...routed }, { device: args.device }), /Original/);
    assert.equal(await routed.release(), true);
    await parentCompletion;
    assert.equal(selected.outputBuffer.destroyed, true);
    assert.ok(routingBuffers(args.device).every(buffer => buffer.destroyed));
    assert.throws(() => resolveSphExactReactionRoutingCandidate(routed, { device: args.device }), /Original|released/);
    return true;
  });
});

test('actual reaction routing rejects changed tuple and custom producer hooks before allocation or submission', async () => {
  await withSource(async args => {
    const selected = await runSphExactReactionSourceSelectionWebGpu(args);
    const original = routingArgs(args, selected);
    const buffers = args.device.createdBuffers.length, submissions = args.device.submissions.length;
    for (const key of ['device', 'sphParticleState', 'sphParticleUpload', 'mlsMpmParticleUpload',
      'reactionTable', 'thermalMaterialTable', 'sourceStateBuffer', 'sourceThermoBuffer', 'sourceMechanicsBuffer',
      'schroederSpatialEpochGeneration', 'schroederSpatialReactionDiscoveryProposal', 'exactReactionSourceSelection']) {
      await assert.rejects(runSphReactionStepWebGpu({ ...original, [key]: {} }), /original/i, key);
    }
    for (const key of ['reactionPlacementEpochRunner', 'canonicalReactionDiscoveryResolver',
      'reactionWarmArenaAcquireRunner', 'reactionWarmArenaResolveRunner', 'reactionWarmArenaReleaseRunner']) {
      await assert.rejects(runSphReactionStepWebGpu({ ...original, [key]: () => {} }), /original retained canonical/i, key);
    }
    for (const overrides of [{ dtSeconds: args.dtSeconds + 1 }, { retainOutputParticleBuffers: false },
      { readbackMode: 'full' }, { resetMechanics: false }, { postMechanicsSourceCapture: {} },
      { schroederSpatialEpochGeneration: null }, { schroederSpatialReactionDiscoveryProposal: null }]) {
      await assert.rejects(runSphReactionStepWebGpu({ ...original, ...overrides }), /original/i);
    }
    await assert.rejects(runSphReactionStepWebGpu({ ...original, exactReactionSourceSelection: null }), /legacy mass path is not admitted/);
    assert.equal(args.device.createdBuffers.length, buffers);
    assert.equal(args.device.submissions.length, submissions);
    await selected.release();
    assert.equal(selected.outputBuffer.destroyed, true, 'rejected requests acquired no stranded parent pin');
    return true;
  });
});

test('actual reaction routing revalidates original table after cold compilation before submission', async () => {
  await withSource(async args => {
    const selected = await runSphExactReactionSourceSelectionWebGpu(args);
    const original = args.reactionTable.records[3], submissions = args.device.submissions.length;
    args.device.createComputePipelineAsync = async descriptor => {
      args.reactionTable.records[3] = original + 1;
      return args.device.createComputePipeline(descriptor);
    };
    let failure;
    try {
      await assert.rejects(runSphReactionStepWebGpu(routingArgs(args, selected)), error => {
        failure = error; return /snapshot|changed|stale/.test(error.message);
      });
      assert.equal(await failure.exactReactionRoutingCleanupCompletion, true);
      assert.equal(args.device.submissions.length, submissions);
      assert.ok(routingBuffers(args.device).every(buffer => buffer.destroyed));
    } finally { args.reactionTable.records[3] = original; }
    await selected.release();
    return true;
  });
});

test('actual reaction routing keeps candidate and parent resources until confirmed retirement', async () => {
  await withSource(async args => {
    const selected = await runSphExactReactionSourceSelectionWebGpu(args);
    const routed = await runSphReactionStepWebGpu(routingArgs(args, selected));
    const originalFence = args.device.queue.onSubmittedWorkDone, fence = deferred();
    args.device.queue.onSubmittedWorkDone = () => fence.promise;
    const parentCompletion = selected.release(), completion = routed.release();
    assert.equal(routed.release(), completion);
    await nextTurn();
    assert.equal(selected.outputBuffer.destroyed, false);
    assert.ok(routingBuffers(args.device).every(buffer => !buffer.destroyed));
    assert.throws(() => args.thermalResult.destroyOutputParticleBuffers(), /owner read/);
    assert.throws(() => resolveSphExactReactionRoutingCandidate(routed, { device: args.device }), /released/);
    args.device.queue.onSubmittedWorkDone = originalFence;
    fence.resolve();
    assert.equal(await completion, true);
    await parentCompletion;
    assert.equal(selected.outputBuffer.destroyed, true);
    assert.ok(routingBuffers(args.device).every(buffer => buffer.destroyed));
    return true;
  });
});

test('throwing actual reaction routing submit quarantines parent and candidate until a real fence', async () => {
  await withSource(async args => {
    const selected = await runSphExactReactionSourceSelectionWebGpu(args);
    const originalSubmit = args.device.queue.submit, originalFence = args.device.queue.onSubmittedWorkDone;
    const fence = deferred();
    args.device.queue.onSubmittedWorkDone = () => fence.promise;
    args.device.queue.submit = commands => {
      if (commands.some(command => command.events?.some(event => event.pipeline?.compute.entryPoint === 'prepare_exact_reaction_endpoint_routes'))) {
        throw new Error('routing submission failed');
      }
      return originalSubmit(commands);
    };
    let failure;
    await assert.rejects(runSphReactionStepWebGpu(routingArgs(args, selected)), error => {
      failure = error; return /routing submission failed/.test(error.message);
    });
    const parentCompletion = selected.release();
    await nextTurn();
    assert.ok(routingBuffers(args.device).every(buffer => !buffer.destroyed));
    assert.equal(selected.outputBuffer.destroyed, false);
    assert.throws(() => args.thermalResult.destroyOutputParticleBuffers(), /owner read/);
    args.device.queue.submit = originalSubmit; args.device.queue.onSubmittedWorkDone = originalFence;
    fence.resolve();
    assert.equal(await failure.exactReactionRoutingCleanupCompletion, true);
    await parentCompletion;
    assert.ok(routingBuffers(args.device).every(buffer => buffer.destroyed));
    assert.equal(selected.outputBuffer.destroyed, true);
    return true;
  });
});

test('device loss during actual reaction routing compilation retires without routing submission or success', async () => {
  const loss = deferred();
  await withSource(async args => {
    const selected = await runSphExactReactionSourceSelectionWebGpu(args);
    const submissions = args.device.submissions.length, compilation = deferred();
    let descriptor;
    args.device.createComputePipelineAsync = value => { descriptor = value; return compilation.promise; };
    const pending = runSphReactionStepWebGpu(routingArgs(args, selected));
    await nextTurn();
    assert.ok(descriptor);
    loss.resolve({ reason: 'destroyed', message: 'lost while compiling actual routing consumer' });
    await nextTurn();
    compilation.resolve(args.device.createComputePipeline(descriptor));
    let failure;
    await assert.rejects(pending, error => { failure = error; return /released|lost/.test(error.message); });
    assert.equal(await failure.exactReactionRoutingCleanupCompletion, false);
    await selected.release();
    assert.equal(args.device.submissions.length, submissions);
    assert.equal(selected.outputBuffer.destroyed, true);
    assert.ok(routingBuffers(args.device).every(buffer => buffer.destroyed));
    return true;
  }, { lost: loss.promise, stopAfterInspect: true });
});
