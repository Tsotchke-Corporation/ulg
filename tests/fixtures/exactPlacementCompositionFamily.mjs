import assert from 'node:assert/strict';
import { runExactReactionSourceNative } from './sphExactReactionSourceNative.js';
import { runSphExactReactionSourceSelectionWebGpu } from '../../src/runtime/sph/sphExactReactionSourceGpu.js';
import { runSphExactReactionRoutingCandidateWebGpu, acquireSphExactReactionRoutingRead,
  resolveSphExactReactionRoutingCandidate } from '../../src/runtime/sph/sphExactReactionRoutingGpu.js';
import { createSphReactionResolvePositionInvariantCertificate,
  runSchroederSpatialReactionPlacementEpochWebGpu, resolveSchroederSpatialReactionPlacementSourceFamily,
  resolveSchroederSpatialReactionPlacementExactSource,
  releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue } from '../../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js';
import { assertSphLegacyMassPathAllowed } from '../../src/runtime/sph/sphGpuBuffers.js';

// Command recorder: genuine JavaScript producers, no WGSL arithmetic claims.
function fakeG2pDevice({ storageBindingLimit = 128 * 1024 * 1024, strictStorageAllocations = false, freezeLimits = false } = {}) {
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
      maxStorageBufferBindingSize: storageBindingLimit,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 12,
      maxBindingsPerBindGroup: 1000,
      maxUniformBuffersPerShaderStage: 12,
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
      if (strictStorageAllocations) {
        assert(size <= device.limits.maxBufferSize, `allocation maxBufferSize: ${label} ${size}`);
        if (usage & 128) assert(size <= device.limits.maxStorageBufferBindingSize,
          `storage allocation exceeds granted limit: ${label} ${size}`);
      }
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
            dispatchWorkgroups(count, y = 1, z = 1) {
              const event = {
                kind: 'dispatch',
                count, y, z,
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
  if (freezeLimits) Object.freeze(device.limits);
  return device;
}

async function withSource(inspect, { lost = new Promise(() => {}), stopAfterInspect = false, sourceOptions = {}, deviceOptions = {} } = {}) {
  const device = fakeG2pDevice(deviceOptions);
  device.lost = lost;
  // Loss tests finish inside the genuine G2P source hook: a lost transaction
  // cannot then enter the fixture's unrelated preserving closure.
  const stop = new Error('Source inspection completed before terminal closure');
  let observed;
  try {
    return await runExactReactionSourceNative(device, { ...sourceOptions, inspect: async args => {
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

async function withActualExactFamily(callback, sourceOptions = {}, deviceOptions = {}) {
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
  },{stopAfterInspect:true,sourceOptions,deviceOptions});
}


export { withActualExactFamily };
