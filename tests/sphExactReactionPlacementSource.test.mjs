import assert from 'node:assert/strict';
import test from 'node:test';
import { runExactReactionSourceNative } from './fixtures/sphExactReactionSourceNative.js';
import { runSphExactReactionSourceSelectionWebGpu } from '../src/runtime/sph/sphExactReactionSourceGpu.js';
import { runSphExactReactionRoutingCandidateWebGpu, acquireSphExactReactionRoutingRead,
  resolveSphExactReactionRoutingCandidate } from '../src/runtime/sph/sphExactReactionRoutingGpu.js';
import { createSphReactionResolvePositionInvariantCertificate,
  runSchroederSpatialReactionPlacementEpochWebGpu, resolveSchroederSpatialReactionPlacementSourceFamily,
  resolveSchroederSpatialReactionPlacementExactSource,
  acquireSchroederSpatialReactionPlacementDestinationRead,
  releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue } from '../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js';
import { assertSphLegacyMassPathAllowed } from '../src/runtime/sph/sphGpuBuffers.js';
import { createSphExactMassFormat as captureTestFormat } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphExactPlacementQuantityLayout as captureTestQuantityLayout } from '../src/runtime/sph/sphExactPlacementQuantityWgsl.js';
import { sphExactPlacementCaptureLayout, planSphExactPlacementCaptureWorkgroups } from '../src/runtime/sph/sphExactPlacementCaptureWgsl.js';
import { sphExactPlacementCaptureMergeLayout, createSphExactPlacementCaptureMergeWgsl } from '../src/runtime/sph/sphExactPlacementCaptureMergeWgsl.js';

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
      maxUniformBuffersPerShaderStage: 12,
      maxBindingsPerBindGroup: 1000,
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
          this.destroyCount = (this.destroyCount ?? 0) + 1;
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

async function withSource(inspect, { lost = new Promise(() => {}), stopAfterInspect = false, nativeOptions = {} } = {}) {
  const device = fakeG2pDevice();
  device.lost = lost;
  // Loss tests finish inside the genuine G2P source hook: a lost transaction
  // cannot then enter the fixture's unrelated preserving closure.
  const stop = new Error('Source inspection completed before terminal closure');
  let observed;
  try {
    return await runExactReactionSourceNative(device, { ...nativeOptions, inspect: async args => {
      observed = await inspect(args);
      if (stopAfterInspect) throw stop;
      return observed;
    } });
  } catch (error) {
    if (error === stop) return observed;
    throw error;
  }
}


const nextTurn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function candidateFor(args) {
  const selected = await runSphExactReactionSourceSelectionWebGpu(args);
  const candidate = await runSphExactReactionRoutingCandidateWebGpu({ selection: selected,
    expected: { device: args.device, sphParticleState: args.sphParticleState,
      sphParticleUpload: args.sphParticleUpload, mlsMpmParticleUpload: args.mlsMpmParticleUpload,
      reactionTable: args.reactionTable, thermalMaterialTable: args.thermalMaterialTable,
      generation: args.generation, reactionDiscoveryProposal: args.reactionDiscoveryProposal,
      sourceStateBuffer: args.thermalResult.stateBuffer, sourceThermoBuffer: args.thermalResult.thermoBuffer,
      sourceMechanicsBuffer: args.g2pResult.mechanicsBuffer, dtSeconds: args.dtSeconds } });
  return { selected, candidate };
}
function certificateArgs(args, candidate) {
  const physical = candidate.physicalOutput;
  return { device: args.device, ancestorGeneration: args.generation,
    reactionInputStateBuffer: args.thermalResult.stateBuffer,
    reactionInputThermoBuffer: args.thermalResult.thermoBuffer,
    reactionInputMechanicsBuffer: args.g2pResult.mechanicsBuffer,
    transactionRollbackThermoBuffer: args.thermalResult.thermoBuffer,
    transactionRollbackMechanicsBuffer: args.g2pResult.mechanicsBuffer,
    frozenResolvedStateBuffer: physical.stateBuffer, frozenResolvedThermoBuffer: physical.thermoBuffer,
    frozenResolvedMechanicsBuffer: physical.mechanicsBuffer, particleCount: candidate.particleCount,
    reactionDiscoveryProposal: args.reactionDiscoveryProposal, reactionTable: args.reactionTable,
    exactReactionCandidate: candidate };
}
function familyArgs(args, candidate, certificate = createSphReactionResolvePositionInvariantCertificate(certificateArgs(args, candidate))) {
  return { device: args.device, ancestorPublicGeneration: args.generation,
    sphParticleState: args.sphParticleState, mlsMpmParticleState: args.mlsMpmParticleState,
    sphParticleUpload: args.sphParticleUpload, positionInvariantCertificate: certificate,
    frozenSourceStateBuffer: candidate.physicalOutput.stateBuffer,
    frozenSourceThermoBuffer: candidate.physicalOutput.thermoBuffer,
    frozenSourceMechanicsBuffer: candidate.physicalOutput.mechanicsBuffer };
}
const candidateBuffers = device => device.createdBuffers.filter(buffer =>
  buffer.label?.startsWith('ulg-exact-reaction-routing') || buffer.label?.startsWith('ulg-exact-reaction-output')
  || buffer.label?.startsWith('ulg-exact-placement-'));

test('routing reads authenticate original tuples and never invoke substituted accessors', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    for (const key of ['device', 'generation', 'sourceStateBuffer', 'sourceThermoBuffer',
      'sourceMechanicsBuffer', 'reactionTable', 'thermalMaterialTable', 'sourceSelection']) {
      assert.throws(() => acquireSphExactReactionRoutingRead(candidate, { device: args.device, [key]: {} }), /original/i);
    }
    assert.throws(() => acquireSphExactReactionRoutingRead({ ...candidate }, { device: args.device }), /Original/);
    let invoked = false;
    const expected = { device: args.device, get generation() { invoked = true; candidate.release(); return args.generation; } };
    assert.throws(() => acquireSphExactReactionRoutingRead(candidate, expected), /original/i);
    assert.equal(invoked, false);
    const read = acquireSphExactReactionRoutingRead(candidate, { device: args.device, generation: args.generation });
    assert.equal(read.view.source.discovery.sourceMechanicsBuffer, args.g2pResult.mechanicsBuffer);
    assert.equal(read.view.source.discovery.release, undefined);
    assert.equal(read.view.source.discovery.acquire, undefined);
    await read.release(); await candidate.release(); await selected.release();
    return true;
  });
});

test('independent routing reads survive both owner closes and public discovery destruction', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const a = acquireSphExactReactionRoutingRead(candidate, { device: args.device });
    const b = acquireSphExactReactionRoutingRead(candidate, { device: args.device });
    const packetClose = selected.release(), ownerClose = candidate.release();
    args.reactionDiscoveryProposal.destroy();
    await nextTurn();
    assert.throws(() => resolveSphExactReactionRoutingCandidate(candidate, { device: args.device }), /released/);
    assert.throws(() => acquireSphExactReactionRoutingRead(candidate, { device: args.device }), /released/);
    assert.equal(a.validate().result, candidate); assert.equal(b.validate().result, candidate);
    await a.release(); assert.throws(() => a.validate(), /released/);
    assert.equal(b.validate().result, candidate);
    assert.ok(candidateBuffers(args.device).every(buffer => !buffer.destroyed));
    const fence = deferred(), originalFence = args.device.queue.onSubmittedWorkDone;
    args.device.queue.onSubmittedWorkDone = () => fence.promise;
    const retirement = b.release(); assert.equal(b.release(), retirement);
    await nextTurn();
    assert.ok(candidateBuffers(args.device).every(buffer => !buffer.destroyed));
    args.device.queue.onSubmittedWorkDone = originalFence; fence.resolve();
    assert.equal(await retirement, true); assert.equal(await ownerClose, true); await packetClose;
    assert.ok(candidateBuffers(args.device).every(buffer => buffer.destroyed));
    return true;
  });
});

test('placement borrows original frozen output and keeps it alive through candidate close', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    args.reactionDiscoveryProposal.destroy();
    const familyPending = runSchroederSpatialReactionPlacementEpochWebGpu(familyArgs(args, candidate));
    const ownerClose = candidate.release(), packetClose = selected.release();
    const family = await familyPending;
    assert.throws(() => acquireSchroederSpatialReactionPlacementDestinationRead(family, { device: args.device }),
      /original live transferred placement owner/);
    const context = resolveSchroederSpatialReactionPlacementExactSource(family, { device: args.device });
    assert.equal(context.validate().result, candidate);
    assert.equal(context.release, undefined);
    assert.equal(context.view.source.discovery.positionAuthorityStateBuffer, args.generation.source.sourceStateBuffer);
    for (const key of ['State', 'Thermo', 'Mechanics']) {
      assert.notEqual(family[`placedDestination${key}Buffer`], family[`frozenSource${key}Buffer`]);
    }
    assert.throws(() => assertSphLegacyMassPathAllowed({ stateBuffer: family.placedDestinationStateBuffer }, 'alias'), /legacy mass path/);
    const counts = new Map();
    for (const buffer of candidateBuffers(args.device)) {
      const destroy = buffer.destroy;
      buffer.destroy = () => { counts.set(buffer, (counts.get(buffer) ?? 0) + 1); destroy.call(buffer); };
    }
    assert.equal(releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, { abandon: true }), true);
    assert.equal(releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, { abandon: true }), false);
    assert.throws(() => context.validate(), /retiring/);
    await ownerClose; await packetClose;
    assert.ok(candidateBuffers(args.device).every(buffer => counts.get(buffer) === 1));
    assert.equal(family.placedDestinationStateBuffer.destroyed, true);
    assert.equal(family.placedDestinationQuantityBuffer.destroyed, true);
    assert.equal(family.placedDestinationResidualCountBuffer.destroyed, true);
    return true;
  });
});

test('exact certificate and family reject copied owners and substituted frozen tuples before allocating', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args), original = certificateArgs(args, candidate);
    const count = args.device.createdBuffers.length, submitted = args.device.submissions.length;
    for (const key of ['exactReactionCandidate', 'reactionTable', 'reactionDiscoveryProposal',
      'frozenResolvedThermoBuffer', 'frozenResolvedMechanicsBuffer']) {
      assert.throws(() => createSphReactionResolvePositionInvariantCertificate({ ...original, [key]: {} }), /original|Original|exact/);
    }
    const certificate = createSphReactionResolvePositionInvariantCertificate(original);
    const originalFamily = familyArgs(args, candidate, certificate);
    await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu({ ...originalFamily,
      frozenSourceThermoBuffer: args.thermalResult.thermoBuffer }), /certificate/);
    await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu({ ...originalFamily,
      positionInvariantCertificate: { ...certificate } }), /certificate/);
    assert.equal(args.device.createdBuffers.length, count); assert.equal(args.device.submissions.length, submitted);
    await candidate.release(); await selected.release(); return true;
  });
});

for (const retired of ['releaseScheduled', 'released']) test(`exact held source cannot admit a ${retired} generation`, async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const options = familyArgs(args, candidate);
    const key = retired === 'released' ? 'execution' : retired;
    const previous = args.generation[key];
    const before = args.device.createdBuffers.length, submitted = args.device.submissions.length;
    const pending = runSchroederSpatialReactionPlacementEpochWebGpu(options);
    args.generation[key] = retired === 'released' ? { ...previous, released: true } : true;
    try {
      await assert.rejects(pending, /generation|retired/);
      assert.throws(() => createSphReactionResolvePositionInvariantCertificate(certificateArgs(args, candidate)), /generation|retired/);
      assert.equal(args.device.createdBuffers.length, before); assert.equal(args.device.submissions.length, submitted);
    } finally { args.generation[key] = previous; }
    await candidate.release(); await selected.release(); return true;
  });
});

test('generation retirement closes family admission but still permits exact owner cleanup', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const family = await runSchroederSpatialReactionPlacementEpochWebGpu(familyArgs(args, candidate));
    const context = resolveSchroederSpatialReactionPlacementExactSource(family, { device: args.device });
    args.generation.releaseScheduled = true;
    try {
      assert.throws(() => resolveSchroederSpatialReactionPlacementSourceFamily(family), /generation|retired/);
      assert.throws(() => context.validate(), /generation|retired/);
      assert.equal(releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, { abandon: true }), true);
      await candidate.release(); await selected.release();
    } finally { args.generation.releaseScheduled = false; }
    return true;
  });
});

for (const kind of ['missing', 'throwing', 'rejecting']) test(`routing read ${kind} fence waits for fulfilled loss and returns false`, async () => {
  const loss = deferred();
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const read = acquireSphExactReactionRoutingRead(candidate, { device: args.device });
    const originalFence = args.device.queue.onSubmittedWorkDone;
    args.device.queue.onSubmittedWorkDone = kind === 'missing' ? undefined : kind === 'throwing'
      ? () => { throw new Error('unconfirmed fence'); } : () => Promise.reject(new Error('unconfirmed fence'));
    const retirement = read.release(), ownerClose = candidate.release(), packetClose = selected.release();
    let settled = false; retirement.then(() => { settled = true; });
    await nextTurn();
    assert.equal(settled, false);
    assert.ok(candidateBuffers(args.device).every(buffer => !buffer.destroyed));
    args.device.queue.onSubmittedWorkDone = originalFence;
    loss.resolve({ reason: 'destroyed', message: 'actual fulfilled loss' });
    assert.equal(await retirement, false); assert.equal(await ownerClose, false); await packetClose;
    assert.throws(() => read.validate(), /released|lost/);
    assert.ok(candidateBuffers(args.device).every(buffer => buffer.destroyed));
    return true;
  }, { lost: loss.promise, stopAfterInspect: true });
});

test('rejected loss never confirms routing read retirement', async () => {
  const loss = deferred();
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const read = acquireSphExactReactionRoutingRead(candidate, { device: args.device });
    const originalFence = args.device.queue.onSubmittedWorkDone, fence = deferred();
    args.device.queue.onSubmittedWorkDone = () => fence.promise;
    const retirement = read.release(), close = candidate.release();
    let settled = false; retirement.then(() => { settled = true; });
    loss.reject(new Error('observer failure, not device loss'));
    await nextTurn();
    assert.equal(settled, false);
    assert.ok(candidateBuffers(args.device).every(buffer => !buffer.destroyed));
    args.device.queue.onSubmittedWorkDone = originalFence; fence.resolve();
    assert.equal(await retirement, true); assert.equal(await close, true); await selected.release();
    return true;
  }, { lost: loss.promise, stopAfterInspect: true });
});

test('fulfilled loss retires an abandoned placement borrow without granting continued consumption', async () => {
  const loss = deferred();
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const family = await runSchroederSpatialReactionPlacementEpochWebGpu(familyArgs(args, candidate));
    const context = resolveSchroederSpatialReactionPlacementExactSource(family, { device: args.device });
    const observer = acquireSphExactReactionRoutingRead(candidate, { device: args.device });
    const originalFence = args.device.queue.onSubmittedWorkDone;
    args.device.queue.onSubmittedWorkDone = undefined;
    const close = candidate.release();
    loss.resolve({ reason: 'destroyed' });
    await nextTurn();
    assert.equal(await observer.release(), false); assert.equal(await close, false); await selected.release();
    assert.throws(() => context.validate(), /loss|lost/);
    assert.equal(family.placedDestinationStateBuffer.destroyed, true);
    assert.equal(family.placedDestinationQuantityBuffer.destroyed, true);
    assert.equal(family.placedDestinationResidualCountBuffer.destroyed, true);
    assert.ok(candidateBuffers(args.device).every(buffer => buffer.destroyed));
    args.device.queue.onSubmittedWorkDone = originalFence;
    return true;
  }, { lost: loss.promise, stopAfterInspect: true });
});

test('placement submit throwing after delegation retains its borrowed source and destinations until a fence', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const options = familyArgs(args, candidate), fence = deferred();
    const originalSubmit = args.device.queue.submit, originalFence = args.device.queue.onSubmittedWorkDone;
    args.device.queue.onSubmittedWorkDone = () => fence.promise;
    args.device.queue.submit = commands => { originalSubmit(commands); throw new Error('delegated placement submit failed'); };
    await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options), /delegated placement/);
    const close = candidate.release();
    await nextTurn();
    const destinations = args.device.createdBuffers.filter(buffer => buffer.label?.startsWith('ulg-schroeder-reaction-placement-')
      && buffer.label.endsWith('-destination'));
    try {
      assert.equal(destinations.length, 9, 'physical, quantity, history and numeric destination allocations');
      assert.ok(destinations.every(buffer => !buffer.destroyed));
      assert.ok(candidateBuffers(args.device).every(buffer => !buffer.destroyed));
    } finally {
      args.device.queue.submit = originalSubmit; args.device.queue.onSubmittedWorkDone = originalFence;
      fence.resolve(); await close; await selected.release(); await nextTurn();
    }
    assert.ok(destinations.every(buffer => buffer.destroyed));
    assert.ok(candidateBuffers(args.device).every(buffer => buffer.destroyed));
    return true;
  });
});

test('routing owner retries only failed destructors after its independent reads retire', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const read = acquireSphExactReactionRoutingRead(candidate, { device: args.device });
    const counts = new Map(), failed = candidate.outputBuffer;
    for (const buffer of candidateBuffers(args.device)) {
      const destroy = buffer.destroy;
      buffer.destroy = () => {
        const count = (counts.get(buffer) ?? 0) + 1; counts.set(buffer, count);
        if (buffer === failed && count === 1) throw new Error('retry destructor');
        destroy.call(buffer);
      };
    }
    const close = candidate.release();
    const rejected = assert.rejects(close, /routing cleanup failed/);
    await read.release(); await rejected;
    assert.equal(selected.outputBuffer.destroyed, false);
    assert.equal(await candidate.release(), true); await selected.release();
    assert.equal(counts.get(failed), 2);
    assert.ok(candidateBuffers(args.device).filter(buffer => buffer !== failed).every(buffer => counts.get(buffer) === 1));
    return true;
  });
});

test('placement revalidates original table contents after its import await before allocating destinations', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args), options = familyArgs(args, candidate);
    const before = args.device.createdBuffers.length, submissions = args.device.submissions.length;
    const original = args.reactionTable.records[3];
    const pending = runSchroederSpatialReactionPlacementEpochWebGpu(options);
    args.reactionTable.records[3] = original + 1;
    try {
      await assert.rejects(pending, /source changed/);
      assert.equal(args.device.createdBuffers.length, before);
      assert.equal(args.device.submissions.length, submissions);
    } finally { args.reactionTable.records[3] = original; }
    await candidate.release(); await selected.release();
    return true;
  });
});

test('exact placement rejects substituted identity upload and destination aliases without stranding its read', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args), options = familyArgs(args, candidate);
    const before = args.device.createdBuffers.length, submissions = args.device.submissions.length;
    await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu({ ...options,
      sphParticleUpload: { ...args.sphParticleUpload } }), /original stable identity/);
    await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu({ ...options,
      placedDestinationStateBuffer: candidate.physicalOutput.thermoBuffer }), /distinct/);
    assert.equal(args.device.createdBuffers.length, before);
    assert.equal(args.device.submissions.length, submissions);
    await candidate.release(); await selected.release();
    assert.ok(candidateBuffers(args.device).every(buffer => buffer.destroyed));
    return true;
  });
});


test('original placement owner copies persistent current and residual words in its physical initialization command', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args);
    const source = candidate.physicalOutput.quantities;
    const { layout } = source;
    const wordOffset = layout.currentRowOffset * layout.recordWords;
    const wordLength = (candidate.particleCount + layout.eventCapacity) * layout.recordWords;
    // Byte-copy fixture data only; this command recorder makes no numeric or
    // physical-readiness assertion about these deliberately distinctive words.
    const expected = Uint32Array.from({ length: wordLength }, (_, i) => (0x80000001 + i * 17) >>> 0);
    args.device.queue.writeBuffer(source.outputBuffer, wordOffset * 4, expected);
    args.device.queue.writeBuffer(candidate.physicalOutput.compactCountBuffer, 0, new Uint32Array([1, 0]));
    const pending = runSchroederSpatialReactionPlacementEpochWebGpu(familyArgs(args, candidate));
    const close = candidate.release(), sourceClose = selected.release();
    const family = await pending;
    assert.notEqual(family.placedDestinationQuantityBuffer, source.outputBuffer);
    assert.equal(family.frozenSourceQuantityBuffer, source.outputBuffer);
    assert.equal(family.placedDestinationQuantityLayout.currentRowOffset, 0);
    assert.equal(family.placedDestinationQuantityLayout.eventRowOffset, candidate.particleCount);
    assert.equal(family.placedDestinationQuantityLayout.originalRowOffset, undefined);
    assert.deepEqual(new Uint32Array(family.placedDestinationQuantityBuffer.bytes.buffer), expected);
    assert.deepEqual(new Uint32Array(family.placedDestinationResidualCountBuffer.bytes.buffer), new Uint32Array([1, 0]));
    const copies = args.device.submissions.at(-1)[0].events.filter(event => event.kind === 'copy');
    assert.equal(copies.length, 5);
    assert.equal(copies[3].source, source.outputBuffer);
    assert.equal(copies[3].sourceOffset, wordOffset * 4);
    assert.equal(copies[3].destination, family.placedDestinationQuantityBuffer);
    assert.equal(copies[4].destination, family.placedDestinationResidualCountBuffer);
    for (const buffer of [family.placedDestinationQuantityBuffer, family.placedDestinationResidualCountBuffer]) {
      assert.throws(() => assertSphLegacyMassPathAllowed({ stateBuffer: buffer }, 'quantity alias'), /legacy mass path/);
      assert.throws(() => assertSphLegacyMassPathAllowed({ productEventBuffer: buffer }, 'quantity event alias'), /legacy mass path/);
      assert.equal(buffer.destroyed, false);
    }
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, { abandon: true });
    await close; await sourceClose;
    assert.equal(family.placedDestinationQuantityBuffer.destroyed, true);
    assert.equal(family.placedDestinationResidualCountBuffer.destroyed, true);
    return true;
  });
});

test('persistent quantity capacity rejection allocates no destinations or submitted copies', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args), options = familyArgs(args, candidate);
    const layout = candidate.physicalOutput.quantities.layout;
    const bytes = (candidate.particleCount + layout.eventCapacity) * layout.recordWords * 4;
    const originalLimit = args.device.limits.maxStorageBufferBindingSize;
    const count = args.device.createdBuffers.length, submissions = args.device.submissions.length;
    args.device.limits.maxStorageBufferBindingSize = bytes - 4;
    try {
      await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options), /persistent placement quantities/);
      assert.equal(args.device.createdBuffers.length, count);
      assert.equal(args.device.submissions.length, submissions);
    } finally { args.device.limits.maxStorageBufferBindingSize = originalLimit; }
    await candidate.release(); await selected.release();
    return true;
  });
});

test('failure allocating residual count destroys every newly owned destination and preserves the source owner', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args), options = familyArgs(args, candidate);
    const create = args.device.createBuffer, before = args.device.createdBuffers.length;
    args.device.createBuffer = descriptor => {
      if (descriptor.label === 'ulg-schroeder-reaction-placement-residual-count-destination') {
        throw new Error('injected residual count allocation failure');
      }
      return create(descriptor);
    };
    try {
      await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options), /residual count allocation/);
      const allocated = args.device.createdBuffers.slice(before);
      assert.equal(allocated.length, 4);
      assert.ok(allocated.every(buffer => buffer.destroyed));
      assert.equal(candidate.physicalOutput.quantities.outputBuffer.destroyed, false);
    } finally { args.device.createBuffer = create; }
    await candidate.release(); await selected.release();
    return true;
  });
});

test('exact destinations cannot alias the original packet, quantity or companion buffers', async () => {
  await withSource(async args => {
    const { selected, candidate } = await candidateFor(args), options = familyArgs(args, candidate);
    const count = args.device.createdBuffers.length, submissions = args.device.submissions.length;
    for (const buffer of [selected.outputBuffer, candidate.outputBuffer,
      candidate.physicalOutput.quantities.outputBuffer, candidate.physicalOutput.auxiliaryBuffer,
      candidate.physicalOutput.compactCompanionBuffer]) {
      await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu({ ...options,
        placedDestinationStateBuffer: buffer }), /distinct/);
    }
    assert.equal(args.device.createdBuffers.length, count);
    assert.equal(args.device.submissions.length, submissions);
    await candidate.release(); await selected.release();
    return true;
  });
});


import { createSchroederSpatialReactionProductPlacementAuthorityWebGpu as createExactAuthority,
  resolveSchroederSpatialReactionProductPlacementAuthority as resolveExactAuthority,
  resolveSphReactionProductPlacementExactCompactionSource as exactCompactionSource,
  acquireSphReactionProductPlacementSegmentedArenaWebGpu as acquireExactArena,
  encodeSphReactionProductPlacementExactCompactionWebGpu as encodeExactCompaction,
  encodeSphReactionProductPlacementSegmentedWebGpu as encodeStillBlockedExactPlacement,
  discardSphReactionProductPlacementSegmentedArenaLease as discardExactArena,
  destroySphReactionProductPlacementSegmentedArenaWebGpu as destroyExactArena }
  from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import { tagWebGpuBufferDevice as tagAuthorityTestBuffer } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

async function withActualExactFamily(callback) {
  return withSource(async args => {
    const {selected,candidate}=await candidateFor(args);
    const pending=runSchroederSpatialReactionPlacementEpochWebGpu(familyArgs(args,candidate));
    const closedCandidate=candidate.release(),closedSelection=selected.release();
    const family=await pending;
    const inputs={device:args.device,placementSourceFamily:family,particleCount:candidate.particleCount,
      productEventCapacity:candidate.physicalOutput.denseEventCount,
      sourceStateBuffer:family.transactionRollbackStateBuffer,
      sourceThermoBuffer:family.transactionRollbackThermoBuffer,
      sourceMechanicsBuffer:family.transactionRollbackMechanicsBuffer};
    try {return await callback({args,candidate,family,inputs});}
    finally {
      releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family,{abandon:true});
      await closedCandidate;await closedSelection;
    }
  },{stopAfterInspect:true});
}

function resolveInputs(authority) {
  return {device:authority.generation.device,generation:authority.generation,
    particleCount:authority.particleCount,productEventCapacity:authority.productEventCapacity,
    sourceStateBuffer:authority.sourceStateBuffer,sourceThermoBuffer:authority.sourceThermoBuffer,
    sourceMechanicsBuffer:authority.sourceMechanicsBuffer,
    placedDestinationStateBuffer:authority.placedDestinationStateBuffer,
    placedDestinationThermoBuffer:authority.placedDestinationThermoBuffer,
    placedDestinationMechanicsBuffer:authority.placedDestinationMechanicsBuffer};
}

test('exact authority binds genuine retained source and all persistent quantity roles after public owner close',async()=>{
  await withActualExactFamily(async({args,candidate,family,inputs})=>{
    const authority=createExactAuthority(inputs);
    const resolved=resolveExactAuthority(authority,{...resolveInputs(authority),device:args.device});
    for(const key of ['frozenSourceQuantityBuffer','frozenSourceQuantityLayout','frozenSourceResidualCountBuffer',
      'placedDestinationQuantityBuffer','placedDestinationQuantityLayout','placedDestinationQuantityFormat',
      'placedDestinationQuantityByteLength','placedDestinationResidualCountBuffer']) {
      assert.equal(authority[key],family[key]);assert.equal(resolved[key],family[key]);
    }
    assert.equal(exactCompactionSource(authority,{device:args.device}).physical,candidate.physicalOutput);
    assert.throws(()=>resolveSphExactReactionRoutingCandidate(candidate,{device:args.device}),/released/);
    assert.equal(candidate.physicalOutput.physicalPublicationAdmitted,false);
    assert.throws(()=>exactCompactionSource({...authority},{device:args.device}),/runtime-issued/);
  });
});

test('exact authority rejects wrong dense capacity before any expectation writes',async()=>{
  await withActualExactFamily(async({args,inputs})=>{
    const count=args.device.writes.length;
    assert.throws(()=>createExactAuthority({...inputs,productEventCapacity:inputs.productEventCapacity+1}),/quantity owner and capacity/);
    assert.equal(args.device.writes.length,count);
  });
});

test('exact authority refuses a copied original family',async()=>{
  await withActualExactFamily(async({args,family,inputs})=>{
    const before={buffers:args.device.createdBuffers.length,writes:args.device.writes.length};
    assert.throws(()=>createExactAuthority({...inputs,placementSourceFamily:{...family}}),/authenticated exact-inventory continuation/);
    assert.deepEqual({buffers:args.device.createdBuffers.length,writes:args.device.writes.length},before);
  });
});

test('genuine authority encodes exact compaction into its original receipt and rejects replay or missing destinations',async()=>{
  await withActualExactFamily(async({args,candidate,inputs})=>{
    const device=args.device,authority=createExactAuthority(inputs);
    const lease=acquireExactArena({device,authority,productTermCapacity:args.reactionTable.productTermCount});
    const events=tagAuthorityTestBuffer(device.createBuffer({label:'authority-test-events',
      size:authority.productEventCapacity*128,usage:128|8|4}),device);
    try {
      assert.equal(lease.arena.buffers.compactCount.size,8);
      const encoder=device.createCommandEncoder(),before=device.dispatches.length;
      const encoded=encodeExactCompaction({device,encoder,authority,arenaLease:lease,productEventBuffer:events});
      const dispatches=device.dispatches.slice(before);assert.equal(dispatches.length,3);
      assert.deepEqual(dispatches.map(x=>x.pipeline.compute.entryPoint),['count_placement_rows','scan_placement_row_groups','scatter_placement_rows']);
      for(const dispatch of dispatches) {
        const entries=dispatch.bindGroup.entries;
        assert.equal(entries.find(x=>x.binding===0).resource.buffer,candidate.physicalOutput.eventBuffer);
        assert.equal(entries.find(x=>x.binding===1).resource.buffer,events);
        assert.equal(entries.find(x=>x.binding===2).resource.buffer,lease.arena.buffers.compactCount);
        assert.equal(entries.find(x=>x.binding===4).resource.buffer,authority.completionReceiptBuffer);
        assert.equal(entries.find(x=>x.binding===8).resource.buffer,candidate.physicalOutput.auxiliaryBuffer);
        assert.equal(entries.find(x=>x.binding===8).resource.offset,candidate.physicalOutput.eventCompanionByteOffset);
        assert.equal(entries.find(x=>x.binding===9).resource.buffer,lease.arena.buffers.exactCompactCompanion);
      }
      assert(encoded);
      assert.throws(()=>encodeExactCompaction({device,encoder,authority,arenaLease:lease,productEventBuffer:events}),/already encoded/);
      assert.throws(()=>encodeStillBlockedExactPlacement({device,encoder,authority,arenaLease:lease,productEventBuffer:events}),/placed destination state/);
    } finally { discardExactArena(lease,{device,authority});destroyExactArena(lease.arena);events.destroy(); }
  });
});

test('genuine exact compaction rejects source alias before recording commands',async()=>{
  await withActualExactFamily(async({args,candidate,inputs})=>{
    const device=args.device,authority=createExactAuthority(inputs);
    const lease=acquireExactArena({device,authority,productTermCapacity:args.reactionTable.productTermCount});
    try {
      const encoder=device.createCommandEncoder(),before=device.dispatches.length;
      assert.throws(()=>encodeExactCompaction({device,encoder,authority,arenaLease:lease,
        productEventBuffer:candidate.physicalOutput.eventBuffer}),/alias/i);
      assert.equal(device.dispatches.length,before);
    } finally { discardExactArena(lease,{device,authority});destroyExactArena(lease.arena); }
  });
});

test('exact authority rejects genuinely retiring source family on later resolution',async()=>{
  await withActualExactFamily(async({args,family,inputs})=>{
    const authority=createExactAuthority(inputs);
    releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family,{abandon:true});
    assert.throws(()=>exactCompactionSource(authority,{device:args.device}),/live|retired|device|quantity/i);
  });
});

for(const role of ['directoryBuffer','directoryPositionAuthorityStateBuffer','expectationBuffer','directorySourceBuffer']) {
  test(`exact compaction rejects original ${role} as writable events before commands`,async()=>{
    await withActualExactFamily(async({args,family,inputs})=>{
      const device=args.device,authority=createExactAuthority(inputs);
      const lease=acquireExactArena({device,authority,productTermCapacity:args.reactionTable.productTermCount});
      try {
        const buffer=authority[role]??family[role];assert.ok(buffer);
        const encoder=device.createCommandEncoder();
        const before={dispatches:device.dispatches.length,clears:device.clears.length,writes:device.writes.length};
        assert.throws(()=>encodeExactCompaction({device,encoder,authority,arenaLease:lease,productEventBuffer:buffer}),/alias/i);
        assert.deepEqual({dispatches:device.dispatches.length,clears:device.clears.length,writes:device.writes.length},before);
      } finally {discardExactArena(lease,{device,authority});destroyExactArena(lease.arena);}
    });
  });
}

test('original exact arena owns distinct checked capture scratch for persistent current rows', async () => {
  await withActualExactFamily(async ({ args, family, inputs }) => {
    const device = args.device, authority = createExactAuthority(inputs);
    const lease = acquireExactArena({ device, authority, productTermCapacity: args.reactionTable.productTermCount });
    try {
      const capture = sphExactPlacementCaptureLayout(family.placedDestinationQuantityFormat,
        family.placedDestinationQuantityLayout);
      const merge = sphExactPlacementCaptureMergeLayout(family.placedDestinationQuantityFormat,
        family.placedDestinationQuantityLayout);
      assert.equal(lease.arena.exactCaptureLayout.quantityCurrentRowOffset, 0);
      assert.equal(lease.arena.exactCaptureLayout.quantityEventRowOffset, authority.particleCount);
      const buffers = lease.arena.buffers;
      const scratch = [buffers.exactCaptureA, buffers.exactCaptureB, buffers.exactCaptureMerged, buffers.exactCaptureMap];
      assert.equal(new Set(scratch).size, 4);
      assert.deepEqual(scratch.map(buffer => buffer.size),
        [capture.byteLength, capture.byteLength, merge.mergedByteLength, merge.mapByteLength]);
      for (const buffer of scratch) {
        assert.notEqual(buffer, family.placedDestinationQuantityBuffer);
        assert.notEqual(buffer, family.frozenSourceQuantityBuffer);
      }
      assert.throws(() => encodeStillBlockedExactPlacement({ device, authority, arenaLease: lease,
        encoder: device.createCommandEncoder() }), /exact|legacy/i);
    } finally { discardExactArena(lease, { device, authority }); destroyExactArena(lease.arena); }
  });
});

test('capture arena capacity rejects before allocating any scratch or writing commands', async () => {
  await withActualExactFamily(async ({ args, family, inputs }) => {
    const device = args.device, authority = createExactAuthority(inputs);
    const layout = sphExactPlacementCaptureLayout(family.placedDestinationQuantityFormat,
      family.placedDestinationQuantityLayout);
    const saved = device.limits.maxStorageBufferBindingSize;
    const before = [device.createdBuffers.length, device.writes.length, device.dispatches.length];
    device.limits.maxStorageBufferBindingSize = layout.byteLength - 4;
    try {
      assert.throws(() => acquireExactArena({ device, authority,
        productTermCapacity: args.reactionTable.productTermCount }), /capacity/);
      assert.deepEqual([device.createdBuffers.length, device.writes.length, device.dispatches.length], before);
    } finally { device.limits.maxStorageBufferBindingSize = saved; }
  });
});

test('capture arena allocation alias rejection preserves the actual original current owner', async () => {
  await withActualExactFamily(async ({ args, family, inputs }) => {
    const device = args.device, authority = createExactAuthority(inputs), create = device.createBuffer;
    const before = device.createdBuffers.length;
    device.createBuffer = descriptor => descriptor.label.endsWith('-exact-capture-a')
      ? family.placedDestinationQuantityBuffer : create(descriptor);
    try {
      assert.throws(() => acquireExactArena({ device, authority,
        productTermCapacity: args.reactionTable.productTermCount }), /aliases/);
      assert.equal(family.placedDestinationQuantityBuffer.destroyed, false);
      assert.equal(family.frozenSourceQuantityBuffer.destroyed, false);
      assert.ok(device.createdBuffers.slice(before).every(buffer => buffer.destroyed));
    } finally { device.createBuffer = create; }
  });
});

test('exact capture checks flattened dispatch capacity and original versus persistent layouts', () => {
  assert.deepEqual(planSphExactPlacementCaptureWorkgroups(7, 3), { x: 3, y: 3, z: 1 });
  assert.throws(() => planSphExactPlacementCaptureWorkgroups(10, 3), /capacity/);
  for (const wordCount of [1, 9, 66]) {
    const format = captureTestFormat({ wordCount, quantumExponent: -149 });
    const original = captureTestQuantityLayout(format, { particleCount: 2, eventCapacity: 6 });
    const persistent = { ...original, currentRowOffset: 0, eventRowOffset: 2,
      rowCount: 8, wordLength: 8 * original.recordWords };
    delete persistent.originalRowOffset;
    assert.equal(sphExactPlacementCaptureLayout(format, original).quantityCurrentRowOffset, 2);
    assert.equal(sphExactPlacementCaptureLayout(format, persistent).quantityCurrentRowOffset, 0);
    assert.throws(() => sphExactPlacementCaptureLayout(format, { ...persistent, eventRowOffset: 3 }), /layout/);
  }
});

test('actual generated merge guard rejects missing reduction coverage at the segment start', () => {
  const format = captureTestFormat({ wordCount: 1, quantumExponent: -149 });
  const quantity = captureTestQuantityLayout(format, { particleCount: 1, eventCapacity: 4 });
  const layout = sphExactPlacementCaptureMergeLayout(format, quantity);
  const shader = createSphExactPlacementCaptureMergeWgsl(format, quantity);
  const entry = shader.indexOf('fn merge_exact_capture_segment_tails(');
  const start = shader.indexOf('{', entry) + 1, end = shader.indexOf('  var current_mass =', start);
  assert(entry >= 0 && end > start);
  // Execute the generated admission prefix, not a second copy of its checks.
  // This CPU regression does not execute arithmetic or prove native WGSL.
  const prefix = shader.slice(start, end).replace(/\bvar\b/g, 'let').replace(/\b(\d+)u\b/g, '$1');
  const globals = {
    XM_E: 4, XM_P: 1, XM_C: layout.capture.recordWords, XM_Q: layout.recordWords,
    XM_N: 1, XM_R: quantity.scalar.wordCount, XM_INVALID: 0xffffffff,
    xm_sorted: new Uint32Array([0, 1, 2, 3]), xm_keys: new Uint32Array(4),
    xm_capture: new Uint32Array(layout.capture.wordLength), xm_current: new Uint32Array(quantity.wordLength),
    xm_bounds: () => true
  };
  const current = quantity.currentRowOffset * quantity.recordWords, tail = 3 * layout.capture.recordWords;
  globals.xm_current.set([1, 0, 7, 2, 0x3c9374bc, 0, 0, 0xffffffff, 0xffffffff,
    1, quantity.scalar.wordCount, 1, 0, 0, 0, 0], current);
  const check = (spanStart, priorEvent = spanStart - 1) => {
    let error = null, flagged = false;
    globals.xm_sorted.set([0, 1, 2, 3]);
    if (spanStart > 0) globals.xm_sorted[spanStart - 1] = priorEvent;
    globals.xm_capture.set([1, 0, 0, 4 - spanStart, 7, 2, 0x3c9374bc, 3, spanStart, 3,
      1, quantity.scalar.wordCount, 0, 0, 0, 0], tail);
    const args = { ...globals, xm_flag: () => { flagged = true; },
      xm_fail: (_receiver, value) => { flagged = true; error = value; } };
    const run = Function(...Object.keys(args), 'id', 'groups', prefix + '\nreturn true;');
    const admitted = run(...Object.values(args), { x: 3, y: 0 }, { x: 4 }) === true;
    return { admitted, error, flagged };
  };
  assert.deepEqual(check(0), { admitted: true, error: null, flagged: false });
  for (const [start, prior] of [[2, 1], [3, 2], [2, 0xffffffff]]) {
    assert.deepEqual(check(start, prior), { admitted: false, error: 8192, flagged: true });
  }
});

// External durable-storage regressions. Genuine JavaScript producer records;
// fake commands prove allocation/copy/lifetime, never physical GPU acceptance.
const historyDestinations = family => [family.placedDestinationStateBuffer,
  family.placedDestinationThermoBuffer, family.placedDestinationMechanicsBuffer,
  family.placedDestinationQuantityBuffer, family.placedDestinationResidualCountBuffer,
  family.placedDestinationResidualEventBuffer, family.placedDestinationResidualCompanionBuffer,
  family.placedDestinationMassBuffer, family.placedDestinationResidualPhysicalBuffer];
for (const wordCount of [1,9,66]) test(`N${wordCount} original family owns frozen, cleared and denied residual planes`, async()=>{
 await withSource(async args=>{
  const {selected,candidate}=await candidateFor(args),pending=runSchroederSpatialReactionPlacementEpochWebGpu(familyArgs(args,candidate));
  const close=candidate.release(),sourceClose=selected.release(),family=await pending,l=family.placedDestinationResidualLayout;
  assert(Object.isFrozen(l));assert.equal(l.eventCapacity,candidate.physicalOutput.denseEventCount);
  assert.equal(l.eventStrideWords,32);assert.equal(l.companionStrideWords,8+3*wordCount);
  assert.equal(l.quantityLayout,family.placedDestinationQuantityLayout);assert.equal(l.format,family.placedDestinationQuantityFormat);
  assert.equal(l.historyTransferAdmitted,false);assert.equal(l.physicalPublicationAdmitted,false);
  assert.equal(family.placedDestinationResidualEventBuffer.size,l.eventByteLength);
  assert.equal(family.placedDestinationResidualCompanionBuffer.size,l.companionByteLength);
  assert.equal(family.placedDestinationMassByteLength,(family.particleCount+l.eventCapacity)*wordCount*4);
  assert.equal(family.placedDestinationMassBuffer.size,family.placedDestinationMassByteLength);
  assert.equal(family.placedDestinationMassSourceGeneration,args.sphParticleUpload.exactMassInventory.generation);
  const initialization=args.device.submissions.at(-1)[0].events;
  for(const buffer of [family.placedDestinationResidualEventBuffer,family.placedDestinationResidualCompanionBuffer,family.placedDestinationMassBuffer,family.placedDestinationResidualPhysicalBuffer]){
   assert(initialization.some(e=>e.kind==='clear'&&e.buffer===buffer&&e.size===buffer.size));
   assert(buffer.bytes.every(x=>x===0));assert.throws(()=>assertSphLegacyMassPathAllowed({productEventBuffer:buffer},'durable history'),/legacy mass path/);
  }
  assert.equal(new Set(historyDestinations(family)).size,9);
  assert.throws(()=>resolveSchroederSpatialReactionPlacementSourceFamily({...family}),/minted|brand/i);
  releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family,{abandon:true});await close;await sourceClose;await nextTurn();
  for(const buffer of historyDestinations(family))assert.equal(buffer.destroyCount,1);
  return true;
 },{nativeOptions:wordCount===1?{wordCount,quantumExponent:-16,massesKg:[1/256,1/128]}:{wordCount}});
});
for(const suffix of ['residual-events','residual-companions','residual-physical','mass'])test(`failure allocating ${suffix} unwinds each original owned sibling`,async()=>{
 await withSource(async args=>{const {selected,candidate}=await candidateFor(args),options=familyArgs(args,candidate),original=args.device.createBuffer;
  const before=args.device.createdBuffers.length,submitted=args.device.submissions.length;
  args.device.createBuffer=descriptor=>{if(descriptor.label===`ulg-schroeder-reaction-placement-${suffix}-destination`)throw Error('durable allocation failed');return original(descriptor)};
  try{await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options),/durable allocation failed/);
   const allocations=args.device.createdBuffers.slice(before);assert.equal(allocations.length,{'residual-events':5,'residual-companions':6,'residual-physical':7,mass:8}[suffix]);
   assert(allocations.every(x=>x.destroyCount===1));assert.equal(candidate.physicalOutput.quantities.outputBuffer.destroyed,false);assert.equal(args.device.submissions.length,submitted);
  }finally{args.device.createBuffer=original;}await candidate.release();await selected.release();return true;});
});
for(const alias of ['source','sibling'])test(`durable destination ${alias} alias rejects without destroying borrowed data or double retiring siblings`,async()=>{
 await withSource(async args=>{const {selected,candidate}=await candidateFor(args),options=familyArgs(args,candidate),original=args.device.createBuffer;
  const before=args.device.createdBuffers.length,submitted=args.device.submissions.length;let sibling;
  args.device.createBuffer=descriptor=>{if(descriptor.label.endsWith('residual-events-destination'))return alias==='source'?candidate.physicalOutput.compactCompanionBuffer:sibling;
   const result=original(descriptor);if(descriptor.label.endsWith('residual-count-destination'))sibling=result;return result;};
  try{await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options),/aliases/);
   assert(args.device.createdBuffers.slice(before).every(x=>x.destroyCount===1));assert.equal(candidate.physicalOutput.compactCompanionBuffer.destroyed,false);assert.equal(args.device.submissions.length,submitted);
  }finally{args.device.createBuffer=original;}await candidate.release();await selected.release();return true;});
});
for(const suffix of ['residual-companions','residual-physical','mass'])for(const fault of ['short','usage'])test(`durable ${suffix} ${fault} allocation fails before submission and unwinds owned buffers`,async()=>{
 await withSource(async args=>{const {selected,candidate}=await candidateFor(args),options=familyArgs(args,candidate),original=args.device.createBuffer;
  const before=args.device.createdBuffers.length,submitted=args.device.submissions.length;
  args.device.createBuffer=d=>original(d.label.endsWith(`${suffix}-destination`)?{...d,...(fault==='short'?{size:d.size-4}:{usage:128})}:d);
  try{await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options),/extent and usage/);const allocations=args.device.createdBuffers.slice(before);
   assert.equal(allocations.length,{'residual-companions':7,'residual-physical':8,mass:9}[suffix]);assert(allocations.every(x=>x.destroyCount===1));assert.equal(args.device.submissions.length,submitted);
  }finally{args.device.createBuffer=original;}await candidate.release();await selected.release();return true;});
});
for(const mode of ['pending','rejected','missing','throwing','rejected-loss'])test(`durable tuple remains owned through ${mode} fence/loss notifications`,async()=>{
 const loss=deferred(),fence=deferred();fence.promise.catch(()=>{});loss.promise.catch(()=>{});
 await withSource(async args=>{const{selected,candidate}=await candidateFor(args),family=await runSchroederSpatialReactionPlacementEpochWebGpu(familyArgs(args,candidate));
  const old=args.device.queue.onSubmittedWorkDone;
  args.device.queue.onSubmittedWorkDone=mode==='missing'?undefined:mode==='throwing'?()=>{throw Error('fence unavailable')}:()=>fence.promise;
  const close=candidate.release(),sourceClose=selected.release();releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family,{abandon:true});
  if(mode==='rejected')fence.reject(Error('queue did not confirm'));if(mode==='rejected-loss')loss.reject(Error('loss observer rejected'));
  await nextTurn();await nextTurn();assert(historyDestinations(family).every(x=>!x.destroyed),'unconfirmed notification cannot retire storage');
  if(mode==='rejected-loss')fence.resolve();else loss.resolve({message:'confirmed terminal loss'});
  await close;await sourceClose;await nextTurn();assert(historyDestinations(family).every(x=>x.destroyCount===1));
  fence.resolve();await nextTurn();assert(historyDestinations(family).every(x=>x.destroyCount===1),'late queue cannot double retire');
  args.device.queue.onSubmittedWorkDone=old;return true;
 },{lost:loss.promise,stopAfterInspect:true});
});

test('durable allocation failure preserves caller-owned state while retiring all newly allocated siblings',async()=>{
 await withSource(async args=>{const{selected,candidate}=await candidateFor(args),original=args.device.createBuffer;
  const provided=tagAuthorityTestBuffer(original({label:'caller-state',size:candidate.particleCount*32,usage:128|8|4}),args.device);
  const options={...familyArgs(args,candidate),placedDestinationStateBuffer:provided},before=args.device.createdBuffers.length;
  args.device.createBuffer=d=>{if(d.label.endsWith('residual-events-destination'))throw Error('durable allocation failed');return original(d);};
  try{await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options),/durable allocation failed/);
   assert.equal(provided.destroyed,false);assert.equal(args.device.createdBuffers.length-before,4);assert(args.device.createdBuffers.slice(before).every(x=>x.destroyCount===1));
  }finally{args.device.createBuffer=original;provided.destroy();}await candidate.release();await selected.release();return true;});
});
test('one throwing partial destructor does not skip the other original family allocations',async()=>{
 await withSource(async args=>{const{selected,candidate}=await candidateFor(args),options=familyArgs(args,candidate),original=args.device.createBuffer,before=args.device.createdBuffers.length;let throwing;
  args.device.createBuffer=d=>{if(d.label.endsWith('residual-companions-destination'))throw Error('durable allocation failed');const result=original(d);
   if(d.label==='ulg-schroeder-reaction-placement-state-destination'){throwing=result;result.destroy=()=>{result.destroyCount=(result.destroyCount??0)+1;throw Error('injected destructor failure');};}return result;};
  try{await assert.rejects(runSchroederSpatialReactionPlacementEpochWebGpu(options),/durable allocation failed/);const all=args.device.createdBuffers.slice(before);
   assert.equal(all.length,6);assert(all.every(x=>x.destroyCount===1));assert(all.filter(x=>x!==throwing).every(x=>x.destroyed));assert.equal(candidate.physicalOutput.quantities.outputBuffer.destroyed,false);
  }finally{args.device.createBuffer=original;}await candidate.release();await selected.release();return true;});
});
