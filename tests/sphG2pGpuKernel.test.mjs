import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mlsMpmG2pReconstructWgsl,
  mlsMpmParticleSeparationApplyWgsl,
  mlsMpmParticleSeparationBinFillWgsl,
  mlsMpmParticleSeparationComputeWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS,
  SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_LAYOUT
} from '../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import {
  MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE,
  MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO,
  MLS_MPM_G2P_MAX_VOLUME_RATIO_J,
  ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA,
  ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA,
  applyMlsMpmParticleSeparationCpu,
  createMlsMpmG2pParityReport,
  destroyRetainedMlsMpmG2pOutputComponents,
  encodeMlsMpmParticleSeparationPasses,
  reconstructMlsMpmG2pCpu,
  runMlsMpmG2pWebGpu,
  runMlsMpmG2pWithOptionalWebGpu
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  createMlsMpmGridSpec,
  runMlsMpmP2gGridProjectionWebGpu
} from '../src/runtime/sph/sphGridGpuKernel.js';
import {
  MLS_MPM_GPU_GRID_VELOCITY_FLOATS,
  runMlsMpmGridUpdateWebGpu
} from '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  runSchroederSpatialMechanicalProposalWebGpu
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  postSeparationThermalBinAuthorityLiveness,
  releasePostSeparationThermalBinAuthorityAfterQueue,
  resolvePostSeparationThermalBinAuthority
} from '../src/runtime/sph/sphPostSeparationThermalBinAuthority.js';

function nearlyEqual(actual, expected, tolerance = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function nodeIndex({ gridDims, gridShift }, i, j, k) {
  const [, gny, gnz] = gridDims;
  return ((i + gridShift) * gny + (j + gridShift)) * gnz + (k + gridShift);
}

function fixture({
  position = [1.25, 1.25, 1.25],
  gridVelocity = [2, 0, 0],
  dt = 0.1,
  restVolumeM3 = 1
} = {}) {
  const state = new Float32Array([
    position[0], position[1], position[2], 8,
    0, 0, 0, 123
  ]);
  const thermo = new Float32Array(12);
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = restVolumeM3;
  mechanics[20] = 1;
  mechanics[21] = 1;
  const gridDims = [7, 7, 7];
  const gridShift = 1;
  const gridNodeCount = gridDims[0] * gridDims[1] * gridDims[2];
  const updatedGridNodes = new Float32Array(gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS);
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex({ gridDims, gridShift }, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    updatedGridNodes.set([
      1,
      gridVelocity[0],
      gridVelocity[1],
      gridVelocity[2],
      i,
      j,
      k,
      1
    ], offset);
  }
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      state,
      thermo,
      smoothingLengthM: 1
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      mechanics,
      mechanicsDtS: dt
    },
    gridUpdate: {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
      updateSchema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      backend: 'cpu-reference',
      particleCount: 1,
      gridSpacingM: 1,
      gridDims,
      gridNodeCount,
      gridShift,
      dt,
      updatedGridNodes
    }
  };
}

function twoParticleFixture() {
  const args = fixture({ position: [1.25, 1.25, 1.25], restVolumeM3: 1 });
  const state = new Float32Array(args.sphParticleState.state.length * 2);
  state.set(args.sphParticleState.state, 0);
  state.set(args.sphParticleState.state, args.sphParticleState.state.length);
  state[8] = 1.5;
  state[15] = 124;
  const thermo = new Float32Array(args.sphParticleState.thermo.length * 2);
  thermo.set(args.sphParticleState.thermo, 0);
  thermo.set(args.sphParticleState.thermo, args.sphParticleState.thermo.length);
  const mechanics = new Float32Array(args.mlsMpmParticleState.mechanics.length * 2);
  mechanics.set(args.mlsMpmParticleState.mechanics, 0);
  mechanics.set(
    args.mlsMpmParticleState.mechanics,
    args.mlsMpmParticleState.mechanics.length
  );
  return {
    sphParticleState: {
      ...args.sphParticleState,
      particleCount: 2,
      state,
      thermo
    },
    mlsMpmParticleState: {
      ...args.mlsMpmParticleState,
      particleCount: 2,
      mechanics
    },
    gridUpdate: {
      ...args.gridUpdate,
      particleCount: 2
    }
  };
}

function canonicalSpatialGenerationFixture(device, { evidenceBufferSize = 80 } = {}) {
  const exactNearQueryProfile = Object.freeze({
    status: 'schroeder-spatial-exact-near-query-profile-ready',
    ready: true,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    chartId: 0,
    minLevel: 0,
    maxLevel: 3,
    levelCount: 4,
    baseGridSpacingM: 0.25,
    positionEpoch: 29,
    supportEpoch: 71
  });
  const directoryBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-directory',
    size: 512,
    usage: 128
  }), device);
  const evidenceBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-evidence',
    size: evidenceBufferSize,
    usage: 128
  }), device);
  const execution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    submitPerformed: true,
    released: false,
    directoryBuffer,
    evidenceBuffer,
    evidenceBufferByteLength: evidenceBufferSize,
    sourceAdapterId: SCHROEDER_SPATIAL_SOURCE_ADAPTER_EXACT_NEAR_QUERY,
    exactNearQueryProfile,
    queryGeometryEvidence: exactNearQueryProfile,
    generationId: 17,
    storageGeneration: 23,
    positionEpoch: 29,
    topologyEpoch: 31,
    deviceOrdinal: 37,
    laneOrdinal: 41,
    leaseToken: 43,
    sourceFamilyId: 47,
    physicsTick: 53,
    physicsSubstep: 59,
    chartEpoch: 61,
    levelEpoch: 67,
    supportEpoch: 71,
    layout: { byteLength: 512 }
  };
  return {
    directoryBuffer,
    evidenceBuffer,
    exactNearQueryProfile,
    generation: {
      schema: ULG_SCHROEDER_SPATIAL_EPOCH_GENERATION_SCHEMA,
      selected: true,
      ready: true,
      source: { phaseVolumeAssignmentOverlayEnabled: false },
      execution
    }
  };
}

function canonicalMechanicalProposalFixture(device, generation, applyCalls = null) {
  const proposalBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-mechanical-proposals',
    size: 128,
    usage: 128
  }), device);
  const evidenceBuffers = Array.from({ length: 1 }, (_, iteration) => (
    tagWebGpuBufferDevice(device.createBuffer({
      label: `retained-schroeder-spatial-mechanical-evidence-${iteration}`,
      size: 48 * Uint32Array.BYTES_PER_ELEMENT,
      usage: 128
    }), device)
  ));
  const evidenceBuffer = evidenceBuffers.at(-1);
  const makeGraphBuffer = (label, size = 64) => tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: 128
  }), device);
  const scaleBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'retained-schroeder-spatial-mechanical-barrier-scales',
    size: 64,
    usage: 128
  }), device);
  const graphControlBuffer = makeGraphBuffer(
    'retained-contact-graph-control',
    40 * Uint32Array.BYTES_PER_ELEMENT
  );
  const indirectDispatchBuffer = makeGraphBuffer('retained-contact-graph-indirect');
  const sourceCountBuffer = makeGraphBuffer('retained-contact-graph-counts');
  const sourceOffsetBuffer = makeGraphBuffer('retained-contact-graph-offsets');
  const appendStagingBuffer = makeGraphBuffer('retained-contact-graph-staging');
  const directedPeerBuffer = makeGraphBuffer('retained-contact-graph-peers');
  const scratchStateABuffer = makeGraphBuffer('retained-contact-graph-scratch-a');
  const scratchStateBBuffer = makeGraphBuffer('retained-contact-graph-scratch-b');
  const energyLedgerBuffer = proposalBuffer;
  const separationReceipt = Object.freeze({
    status: 'schroeder-spatial-epoch-consumer-receipt-finalized',
    gpuAuthenticated: true,
    consumerId: 'separation',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
    generationId: generation.execution.generationId,
    traversalCount: 1,
    expectedTraversalCount: 1,
    privateLookupBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0
  });
  return Object.freeze({
    schema: 'peercompute.ulg.schroeder-spatial-mechanical-proposal.v3',
    status: 'schroeder-spatial-mechanical-contact-graph-prepared',
    ready: true,
    lifecycleStatus: 'prepared',
    encodePolicy: 'single-use-immutable-selected-level',
    selectedLevel: 0,
    proposalMode: 'proposal-deferred-to-post-mechanics',
    sourcePositionAuthority:
      'post-g2p-state-with-swept-pre-integration-ss-directory',
    generation,
    generationId: generation.execution.generationId,
    supportEpoch: generation.execution.supportEpoch,
    traversalCount: 1,
    solverIterationCount: 16,
    privateBuildCount: 0,
    fixedCandidateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    fullParticleReadbackPerformed: false,
    releaseScheduled: false,
    released: false,
    proposalBuffer,
    proposalRowByteOffset: 64,
    proposalRowWords: 8,
    proposalRowStrideFloats: 8,
    graphControlBuffer,
    indirectDispatchBuffer,
    sourceCountBuffer,
    sourceOffsetBuffer,
    appendStagingBuffer,
    directedPeerBuffer,
    scratchStateABuffer,
    scratchStateBBuffer,
    scaleBuffer,
    energyLedgerBuffer,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerByteOffset: 64,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    energyLedgerRowStrideFloats: 8,
    directedPairCapacity: 4,
    contactGraph: Object.freeze({
      schema: 'peercompute.ulg.schroeder-spatial-mechanical-pair-graph.v6',
      status: 'schroeder-spatial-mechanical-pair-graph-prepared',
      selectedLevel: 0,
      directedPairCapacity: 4,
      controlBuffer: graphControlBuffer,
      indirectDispatchBuffer,
      sourceCountBuffer,
      sourceOffsetBuffer,
      appendStagingBuffer,
      directedPeerBuffer,
      scratchStateABuffer,
      scratchStateBBuffer,
      scaleBuffer,
      energyLedgerBuffer,
      energyLedgerAliasedToProposalRows: true,
      energyLedgerByteOffset: 64,
      energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
      layout: Object.freeze({
        readbackRequired: false,
        energyLedgerAliasedToProposalRows: true,
        energyLedgerAliasByteOffset: 64
      })
    }),
    evidence: Object.freeze({
      buffer: evidenceBuffer,
      traversalCount: 1,
      traversalBuffers: Object.freeze(evidenceBuffers),
      scaleMeasurementBuffer: scaleBuffer,
      graphControlBuffer,
      wordCount: 48
    }),
    consumerReceipt(consumerId) {
      return consumerId === 'separation' ? separationReceipt : null;
    },
    encodeApply(encoder, options = {}) {
      applyCalls?.push(options);
      const pass = encoder.beginComputePass({
        label: 'ulg-schroeder-spatial-mechanical-proposal-apply'
      });
      pass.setPipeline({
        label: 'ulg-schroeder-spatial-mechanical-proposal-apply'
      });
      pass.dispatchWorkgroups(1);
      pass.end();
      return true;
    }
  });
}

function liquidSeparationPair() {
  const state = new Float32Array(2 * 8);
  state.set([2, 2, 2, 1, 1, 0, 0, 0], 0);
  state.set([2.5, 2, 2, 1, -1, 0, 0, 0], 8);
  const mechanics = new Float32Array(2 * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  for (let index = 0; index < 2; index += 1) {
    const offset = index * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
    mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], offset);
    mechanics[offset + 18] = 1;
    mechanics[offset + 19] = 1;
    mechanics[offset + 20] = 0;
    mechanics[offset + 26] = 1;
  }
  return { state, mechanics };
}

test('excluded-volume projection separates position without implicitly erasing liquid velocity', () => {
  const undamped = liquidSeparationPair();
  const legacy = liquidSeparationPair();
  const partial = liquidSeparationPair();
  const velocityOnly = liquidSeparationPair();

  applyMlsMpmParticleSeparationCpu({
    ...undamped,
    particleCount: 2,
    relaxation: 0.5,
    normalVelocityDamping: 0
  });
  applyMlsMpmParticleSeparationCpu({
    ...legacy,
    particleCount: 2,
    relaxation: 0.5,
    normalVelocityDamping: 1
  });
  applyMlsMpmParticleSeparationCpu({
    ...partial,
    particleCount: 2,
    relaxation: 0.5,
    normalVelocityDamping: 0.25
  });
  applyMlsMpmParticleSeparationCpu({
    ...velocityOnly,
    particleCount: 2,
    relaxation: 0,
    normalVelocityDamping: 1
  });

  assert.deepEqual(
    [undamped.state[0], undamped.state[8]],
    [legacy.state[0], legacy.state[8]],
    'position projection is independent of velocity damping'
  );
  assert.deepEqual([undamped.state[4], undamped.state[12]], [1, -1]);
  assert.deepEqual([legacy.state[4], legacy.state[12]], [0, 0]);
  assert.deepEqual([partial.state[4], partial.state[12]], [0.75, -0.75]);
  assert.deepEqual([velocityOnly.state[0], velocityOnly.state[8]], [2, 2.5]);
  assert.deepEqual([velocityOnly.state[4], velocityOnly.state[12]], [0, 0]);
  assert.equal(undamped.state[4] + undamped.state[12], 0);
  assert.equal(partial.state[4] + partial.state[12], 0);
});

test('excluded-volume WGSL packs independent pair-normal velocity damping in the fixed uniform', () => {
  for (const source of [
    mlsMpmParticleSeparationBinFillWgsl,
    mlsMpmParticleSeparationComputeWgsl,
    mlsMpmParticleSeparationApplyWgsl
  ]) {
    assert.match(source, /normal_velocity_damping: f32/);
    assert.match(
      source,
      /params\.relaxation <= 0\.0 && params\.normal_velocity_damping <= 0\.0/
    );
    assert.doesNotMatch(source, /params\.enabled/);
  }
  assert.match(
    mlsMpmParticleSeparationComputeWgsl,
    /dv = dv - params\.normal_velocity_damping \* share \* approach \* normal/
  );
});

function webGpuNavigator() {
  return {
    gpu: {
      async requestAdapter() {
        return {
          async requestDevice() {
            return { lost: new Promise(() => {}) };
          }
        };
      }
    }
  };
}

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

function seedBufferWords(buffer, words, offsetWords = 0) {
  new Uint32Array(
    buffer.bytes.buffer,
    buffer.bytes.byteOffset,
    Math.floor(buffer.bytes.byteLength / Uint32Array.BYTES_PER_ELEMENT)
  ).set(words, offsetWords);
}

function abiWordIndex(layout, name) {
  const index = layout.findIndex((field) => String(field).split(':')[0] === name);
  assert.ok(index >= 0, `missing ABI field ${name}`);
  return index;
}

function float32Bits(value) {
  const floats = new Float32Array(1);
  const words = new Uint32Array(floats.buffer);
  floats[0] = value;
  return words[0];
}

function canonicalDenseTraceRuntimeFixture() {
  const device = fakeG2pDevice();
  const particleCount = 2;
  const base = twoParticleFixture();
  const stateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-trace-state',
    size: base.sphParticleState.state.byteLength,
    usage: 128
  }), device);
  const thermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-trace-thermo',
    size: base.sphParticleState.thermo.byteLength,
    usage: 128
  }), device);
  const identityBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-trace-identity',
    size: particleCount * Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const mechanicsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-trace-mechanics',
    size: base.mlsMpmParticleState.mechanics.byteLength,
    usage: 128
  }), device);
  const activeNodeBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-trace-active-node-source',
    size: particleCount * 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const activeNodeList = {
    schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
    status: 'schroeder-active-node-list-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema:
      'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: 0,
    spatialEpochMaxLevel: 0,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: particleCount,
    activeNodeStrideFloats: 16,
    activeNodeBuffer,
    spatialEpochStorageGeneration: 11,
    spatialEpochPhysicsTick: 13,
    spatialEpochPhysicsSubstep: 0,
    spatialEpochPositionEpoch: 17,
    spatialEpochTopologyEpoch: 19,
    spatialEpochChartEpoch: 23,
    spatialEpochLevelEpoch: 29,
    spatialEpochSupportEpoch: 31,
    phaseVolumeAssignmentOverlayEnabled: false
  };
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount
  });
  assert.equal(generation.ready, true, generation.reason ?? generation.status);
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    stateBuffer,
    thermoBuffer,
    identityBuffer
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    mechanicsBuffer
  };
  const gridDims = [4, 4, 4];
  const gridNodeCount = gridDims[0] * gridDims[1] * gridDims[2];
  return {
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    sphParticleState: base.sphParticleState,
    mlsMpmParticleState: base.mlsMpmParticleState,
    gridUpdate: {
      schema: ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
      updateSchema: ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
      backend: 'webgpu',
      particleCount,
      gridSpacingM: 0.25,
      gridDims,
      gridNodeCount,
      gridShift: 1,
      dt: 0.001,
      updatedGridNodes: new Float32Array(
        gridNodeCount * MLS_MPM_GPU_GRID_VELOCITY_FLOATS
      )
    }
  };
}

async function canonicalFieldTraceRuntimeFixture() {
  const device = fakeG2pDevice();
  const base = fixture({
    position: [0.5, 0.5, 0.5],
    dt: 0.005,
    restVolumeM3: 1
  });
  base.sphParticleState.step = 211;
  base.mlsMpmParticleState.step = 211;
  const particleCount = 1;
  const stateBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-field-trace-state',
    size: base.sphParticleState.state.byteLength,
    usage: 128
  }), device);
  const thermoBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-field-trace-thermo',
    size: base.sphParticleState.thermo.byteLength,
    usage: 128
  }), device);
  const identityBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-field-trace-identity',
    size: Uint32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const mechanicsBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-field-trace-mechanics',
    size: base.mlsMpmParticleState.mechanics.byteLength,
    usage: 128
  }), device);
  const assignmentBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'canonical-field-trace-level-assignment',
    size: 16 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  }), device);
  const levelAssignment = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
    status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    particleCount,
    assignmentStrideFloats: 16,
    assignmentBuffer,
    assignmentBufferByteLength: assignmentBuffer.size,
    sourceStateBuffer: stateBuffer,
    sourceStateBufferBorrowed: true,
    sourceThermoBuffer: thermoBuffer,
    sourceThermoBufferBorrowed: true,
    sourceThermoBufferByteLength: thermoBuffer.size,
    sourceMechanicsBuffer: mechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    sourceMechanicsBufferByteLength: mechanicsBuffer.size,
    storageGeneration: 11,
    physicsTick: 13,
    physicsSubstep: 0,
    positionEpoch: 17,
    topologyEpoch: 19,
    chartEpoch: 23,
    levelEpoch: 29,
    supportEpoch: 31,
    minLevel: 0,
    maxLevel: 0,
    chartId: 0,
    baseGridSpacingM: 0.25,
    phaseVolumeAssignmentOverlayEnabled: false
  };
  const gridSpec = createMlsMpmGridSpec({
    boxDimsM: [1, 1, 1],
    gridSpacingM: 0.25
  });
  gridSpec.gridShift = gridSpec.shift;
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    levelAssignment,
    particleCount,
    particleIdentityBuffer: identityBuffer,
    particleIdentityStrideWords: 1,
    mechanicsLevels: [{ selectedLevel: 0, mechanicsGrid: gridSpec }]
  });
  assert.equal(generation.ready, true, generation.reason ?? generation.status);
  assert.ok(generation.mechanicsFieldView);
  const uploadIdentity = {
    storageGeneration: levelAssignment.storageGeneration,
    bufferFamilyGeneration: levelAssignment.storageGeneration,
    bufferFamilyGenerationStatus:
      'schroeder-particle-buffer-family-generation-ready',
    physicsTick: levelAssignment.physicsTick,
    physicsSubstep: levelAssignment.physicsSubstep,
    positionEpoch: levelAssignment.positionEpoch,
    topologyEpoch: levelAssignment.topologyEpoch,
    chartEpoch: levelAssignment.chartEpoch,
    levelEpoch: levelAssignment.levelEpoch,
    supportEpoch: levelAssignment.supportEpoch
  };
  const sphParticleUpload = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    stateStrideBytes: 8 * Float32Array.BYTES_PER_ELEMENT,
    thermoStrideBytes: 12 * Float32Array.BYTES_PER_ELEMENT,
    identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
    stateBufferByteLength: stateBuffer.size,
    thermoBufferByteLength: thermoBuffer.size,
    identityBufferByteLength: identityBuffer.size,
    ...uploadIdentity
  };
  const mlsMpmParticleUpload = {
    schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded',
    particleCount,
    mechanicsBuffer,
    mechanicsStrideBytes:
      MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    mechanicsBufferByteLength: mechanicsBuffer.size,
    ...uploadIdentity
  };
  const projection = await runMlsMpmP2gGridProjectionWebGpu({
    device,
    sphParticleState: base.sphParticleState,
    mlsMpmParticleState: base.mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: generation,
    canonicalSpatialRequired: true,
    mechanicsFieldMode: 'required',
    gridSpacingM: 0.25,
    boxDimsM: [1, 1, 1],
    dt: 0.005,
    readbackMode: 'no-full-readback'
  });
  const gridUpdate = await runMlsMpmGridUpdateWebGpu({
    device,
    p2gGridProjection: projection,
    mechanicsFieldMode: 'required',
    mechanicsFieldEnergyReceipt: { deferSeal: true },
    dt: 0.005,
    gravityMPerS2: [0, -9.80665, 0],
    boxDimsM: [1, 1, 1],
    cflFactor: 0.4,
    readbackMode: 'no-full-readback'
  });
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    cleanupPassBudget: 1024,
    device,
    generation,
    sphParticleState: base.sphParticleState,
    mlsMpmParticleState: base.mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    boxDimsM: [1, 1, 1],
    gridSpacingM: 0.25,
    relaxation: 0,
    normalVelocityDamping: 0,
    selectedLevel: 0
  });
  assert.equal(proposal.ready, true, proposal.reason ?? proposal.status);
  return {
    device,
    generation,
    gridUpdate,
    proposal,
    sphParticleState: base.sphParticleState,
    mlsMpmParticleState: base.mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload
  };
}

test('MLS-MPM G2P WGSL declares particle and grid bindings', () => {
  assert.match(mlsMpmG2pReconstructWgsl, /struct G2pParams/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read> updated_grid_nodes/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_sph_state/);
  assert.match(mlsMpmG2pReconstructWgsl, /var<storage, read_write> out_mls_mechanics/);
  assert.match(mlsMpmG2pReconstructWgsl, /@group\(0\) @binding\(7\) var<storage, read> schroeder_level_assignments/);
  assert.match(mlsMpmG2pReconstructWgsl, /fn g2p_particle_enabled/);
  assert.match(mlsMpmG2pReconstructWgsl, /fn g2p_copy_input_particle/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_cubic_root_positive/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_particle_wall_clearance/);
  assert.match(mlsMpmG2pReconstructWgsl, /wall_clearance = g2p_particle_wall_clearance\(row4\.w\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /internal_pressure_scale: f32/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_condensed_target_j/);
  assert.match(mlsMpmG2pReconstructWgsl, /row6\.z > 0\.5 && row6\.z < 1\.5/);
  assert.match(mlsMpmG2pReconstructWgsl, /params\.internal_pressure_scale == 0\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /if \(condensed\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /g2p_clamp\(previous_j, 0\.95, 1\.05\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /liquid_wall_damping_alpha: f32/);
  assert.match(mlsMpmG2pReconstructWgsl, /velocity = velocity \* keep/);
  assert.match(mlsMpmG2pReconstructWgsl, /if \(!solid\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_RADIUS_GROWTH_RATIO:\s*f32\s*=\s*4\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_VOLUME_RATIO_J:\s*f32\s*=\s*64\.0/);
  // Gas expands to the vacuum density floor (J_max 1000) while condensed
  // phases keep the 64x cap; the bound is selected per-particle from the EOS id.
  assert.match(mlsMpmG2pReconstructWgsl, /next_j > g2p_max_volume_ratio_j\(row6\.z\)/);
  assert.match(mlsMpmG2pReconstructWgsl, /G2P_MAX_VOLUME_RATIO_J_GAS: f32 = 1000\.0/);
  assert.match(mlsMpmG2pReconstructWgsl, /next_j = max_volume_ratio_j/);
  assert.doesNotMatch(mlsMpmG2pReconstructWgsl, /c00 = c00 \* 0\.25/);
  assert.match(mlsMpmG2pReconstructWgsl, /@compute @workgroup_size\(64\)/);
});

test('CPU MLS-MPM G2P reconstructs velocity and advects without affine strain in constant grid flow', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture();
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.kernelScope, 'mls-mpm-g2p-velocity-affine-deformation-reconstruction');
  nearlyEqual(result.state[0], 1.45);
  nearlyEqual(result.state[4], 2);
  nearlyEqual(result.state[5], 0);
  nearlyEqual(result.mechanics[0], 1);
  nearlyEqual(result.mechanics[4], 1);
  nearlyEqual(result.mechanics[8], 1);
  nearlyEqual(result.mechanics[18], 1);
  nearlyEqual(result.mechanics[9], 0, 1e-4);
  assert.equal(result.g2pValidation, false);
  assert.equal(result.fullPhysicsValidation, false);
});

test('WebGPU MLS-MPM G2P params buffer fits the full uniform payload', async () => {
  const device = fakeG2pDevice();
  const result = await runMlsMpmG2pWebGpu({
    ...fixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback'
  });
  const paramsBuffer = device.createdBuffers.find((buffer) => buffer.label === 'ulg-mls-mpm-g2p-params');
  const paramsWrite = device.writes.find((write) => write.label === 'ulg-mls-mpm-g2p-params');

  assert.equal(result.backend, 'webgpu');
  assert.equal(paramsBuffer.size, 80);
  assert.equal(paramsWrite.byteLength, 80);
  assert.equal(device.submissions.length, 1);
  assert.equal(result.observedHostQueueFenceCount, 1);
  assert.equal(result.deferredCleanupHostQueueFenceCount, 1);
  assert.equal(result.unclassifiedHostQueueFenceCount, 0);
  assert.equal(result.normalHotLoopReadbackFree, false);
  assert.equal(result.productionHotLoopHostDependencyFree, true);
});

test('WebGPU MLS-MPM G2P brackets coarse reconstruction without adding a readback', async () => {
  const device = fakeG2pDevice();
  const begun = [];
  const ended = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      const token = { encoder, descriptor };
      begun.push(token);
      return token;
    },
    endEncoderSpan(encoder, token) {
      ended.push({ encoder, token });
    }
  };
  const result = await runMlsMpmG2pWebGpu({
    ...fixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    gpuTimestampRecorder
  });

  assert.deepEqual(
    begun.map(({ descriptor }) => descriptor.producerId),
    ['mls-mpm-g2p:particle-reconstruction']
  );
  assert.equal(begun[0].descriptor.coarseStage, true);
  assert.equal(ended.length, 1);
  assert.equal(ended[0].encoder, begun[0].encoder);
  assert.equal(ended[0].token, begun[0]);
  assert.equal(result.mapAsyncCount, 0);
  assert.equal(result.readbackBytes, 0);
  assert.equal(result.finalDiagnosticMapAsyncCount, 0);
  assert.equal(result.finalDiagnosticReadbackBytes, 0);
  assert.equal(result.canonicalSpatialAuthorityTrace, null);
  assert.equal(
    device.createdBuffers.some((buffer) => (buffer.usage & 1) !== 0),
    false
  );
  assert.equal(device.submissions.length, 1);
});

test('WebGPU MLS-MPM G2P discards timestamp spans after a pre-submit encode failure', async () => {
  const device = fakeG2pDevice();
  const createCommandEncoder = device.createCommandEncoder.bind(device);
  let abandonedEncoder = null;
  device.createCommandEncoder = () => {
    const encoder = createCommandEncoder();
    encoder.finish = () => {
      throw new Error('injected G2P finish failure');
    };
    abandonedEncoder = encoder;
    return encoder;
  };
  const discarded = [];
  const gpuTimestampRecorder = {
    active: true,
    beginEncoderSpan(encoder, descriptor) {
      return { encoder, descriptor };
    },
    endEncoderSpan() {},
    discardEncoderSpans(encoder) {
      discarded.push(encoder);
    }
  };

  await assert.rejects(
    runMlsMpmG2pWebGpu({
      ...fixture(),
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      gpuTimestampRecorder
    }),
    /injected G2P finish failure/
  );
  assert.deepEqual(discarded, [abandonedEncoder]);
  assert.equal(device.submissions.length, 0);
});

test('excluded-volume separation refills one retained bin directory after position apply', () => {
  const device = fakeG2pDevice();
  const stateBuffer = device.createBuffer({
    label: 'post-apply-refill-state',
    size: 2 * 8 * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const mechanicsBuffer = device.createBuffer({
    label: 'post-apply-refill-mechanics',
    size: 2 * MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    usage: 128
  });
  const encoded = encodeMlsMpmParticleSeparationPasses(
    device,
    device.createCommandEncoder(),
    {
      stateBuffer,
      mechanicsBuffer,
      particleCount: 2,
      boxDimsM: [3, 3, 3],
      relaxation: 0.5,
      normalVelocityDamping: 0,
      maxPairRestDistanceM: 1,
      gridSpacingM: 1
    }
  );

  assert.equal(encoded.enabled, true);
  assert.equal(encoded.neighborBinsPublished, false);
  assert.equal(encoded.neighborBinsRefreshedAfterSeparation, true);
  assert.equal(encoded.postSeparationThermalBinCandidate.stateBuffer, stateBuffer);
  assert.equal(
    encoded.postSeparationThermalBinCandidate.binsBuffer,
    encoded.scratch.binsBuffer
  );
  assert.deepEqual(device.dispatches.map(({ pipeline }) => pipeline.label), [
    'ulg-mls-mpm-particle-separation-bin-fill',
    'ulg-mls-mpm-particle-separation-compute',
    'ulg-mls-mpm-particle-separation-apply',
    'ulg-mls-mpm-particle-separation-bin-fill'
  ]);
  assert.equal(device.clears.length, 2);
  assert.ok(device.clears.every(({ buffer }) => (
    buffer === encoded.postSeparationThermalBinCandidate.binsBuffer
  )));
});

test('retained G2P publishes one live post-separation thermal-bin authority', async () => {
  const device = fakeG2pDevice();
  const result = await runMlsMpmG2pWebGpu({
    ...twoParticleFixture(),
    device,
    boxDimsM: [3, 3, 3],
    particleSeparationRelaxation: 0.5,
    particleSeparationVelocityDamping: 0,
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });
  const authority = result.postSeparationThermalBinAuthority;
  const resolved = resolvePostSeparationThermalBinAuthority(authority, {
    device,
    stateBuffer: result.stateBuffer,
    particleCount: result.particleCount
  });

  assert.ok(authority);
  assert.ok(resolved);
  assert.equal(resolved.positionAuthority, 'post-separation-g2p-output-state');
  assert.equal(resolved.binsBuffer.label, 'ulg-mls-mpm-separation-bins');
  assert.equal(resolved.binsBuffer.destroyed, false);
  assert.equal(
    device.dispatches.filter(({ pipeline }) => (
      pipeline.label === 'ulg-mls-mpm-particle-separation-bin-fill'
    )).length,
    2
  );
  assert.equal(
    postSeparationThermalBinAuthorityLiveness(authority).releaseScheduled,
    false
  );
  assert.equal(releasePostSeparationThermalBinAuthorityAfterQueue(authority, {
    device
  }), true);
  await postSeparationThermalBinAuthorityLiveness(authority).releasePromise;
  assert.equal(resolved.binsBuffer.destroyed, true);
  assert.equal(postSeparationThermalBinAuthorityLiveness(authority).destroyCount, 1);
  assert.equal(result.destroyOutputParticleBuffers(), true);
});

test('CPU MLS-MPM G2P renormalizes clipped active grid support for constant flow', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture({
    position: [0.1, 1.25, 1.25],
    gridVelocity: [3, 0, 0],
    dt: 0.1,
    restVolumeM3: 0
  });
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    dt: 0.1,
    boxDimsM: [5, 5, 5]
  });

  nearlyEqual(result.state[4], 3, 1e-5);
  nearlyEqual(result.state[0], 0.4, 1e-5);
});

test('CPU MLS-MPM G2P clamps finite-volume particle walls and inward velocity', () => {
  const { sphParticleState, mlsMpmParticleState, gridUpdate } = fixture({
    position: [0.05, 1.25, 1.25],
    gridVelocity: [-2, 0, 0],
    dt: 0.1,
    restVolumeM3: 1
  });
  const result = reconstructMlsMpmG2pCpu({
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.state[0], 0.5);
  assert.equal(result.state[4], 0);
});

test('CPU MLS-MPM G2P damps condensed liquid support-wall slosh without damping solids', () => {
  const liquid = fixture({
    position: [1.25, 0.15, 1.25],
    gridVelocity: [2, 0, 0],
    dt: 0.1,
    restVolumeM3: 0.008
  });
  liquid.mlsMpmParticleState.mechanics[20] = 0;
  liquid.mlsMpmParticleState.mechanics[26] = 1;
  const solid = fixture({
    position: [1.25, 0.15, 1.25],
    gridVelocity: [2, 0, 0],
    dt: 0.1,
    restVolumeM3: 0.008
  });
  solid.mlsMpmParticleState.mechanics[20] = 1;
  solid.mlsMpmParticleState.mechanics[26] = 1;

  const liquidResult = reconstructMlsMpmG2pCpu({
    ...liquid,
    boxDimsM: [3, 3, 3],
    liquidWallDampingAlpha: 0.2,
    liquidWallDampingDistanceM: 0.2
  });
  const solidResult = reconstructMlsMpmG2pCpu({
    ...solid,
    boxDimsM: [3, 3, 3],
    liquidWallDampingAlpha: 0.2,
    liquidWallDampingDistanceM: 0.2
  });

  assert.ok(liquidResult.state[4] < 2, `expected liquid wall damping to reduce tangential speed, got ${liquidResult.state[4]}`);
  nearlyEqual(liquidResult.state[4], 1.775, 1e-5);
  nearlyEqual(solidResult.state[4], 2, 1e-5);
});

test('CPU MLS-MPM G2P bounds condensed liquid volume jumps', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 0;
  args.mlsMpmParticleState.mechanics[26] = 1;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 100 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 100 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 100 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3]
  });

  const maxCondensedJ = 1 + MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
  nearlyEqual(result.mechanics[18], maxCondensedJ, 1e-5);
  nearlyEqual(result.mechanics[0], Math.cbrt(maxCondensedJ), 1e-5);
  nearlyEqual(result.mechanics[4], Math.cbrt(maxCondensedJ), 1e-5);
  nearlyEqual(result.mechanics[8], Math.cbrt(maxCondensedJ), 1e-5);
});

test('CPU MLS-MPM G2P freezes non-solid deformation when EOS pressure is disabled', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 0;
  args.mlsMpmParticleState.mechanics[26] = 1;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 100 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 100 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 100 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3],
    internalPressureScale: 0
  });

  nearlyEqual(result.mechanics[18], 1, 1e-6);
  nearlyEqual(result.mechanics[0], 1, 1e-6);
  nearlyEqual(result.mechanics[4], 1, 1e-6);
  nearlyEqual(result.mechanics[8], 1, 1e-6);
  nearlyEqual(result.mechanics[9], 0, 1e-6);
  nearlyEqual(result.mechanics[13], 0, 1e-6);
  nearlyEqual(result.mechanics[17], 0, 1e-6);
});

test('CPU MLS-MPM G2P carries condensed liquid affine strain without hidden damping', () => {
  const liquid = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  liquid.mlsMpmParticleState.mechanics[20] = 0;
  liquid.mlsMpmParticleState.mechanics[26] = 1;
  const gas = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  gas.mlsMpmParticleState.mechanics[20] = 0;
  gas.mlsMpmParticleState.mechanics[26] = 2;
  for (const args of [liquid, gas]) {
    for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
      const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
      args.gridUpdate.updatedGridNodes[offset + 1] = 10 * i;
      args.gridUpdate.updatedGridNodes[offset + 2] = 10 * j;
      args.gridUpdate.updatedGridNodes[offset + 3] = 10 * k;
    }
  }

  const liquidResult = reconstructMlsMpmG2pCpu({
    ...liquid,
    boxDimsM: [3, 3, 3]
  });
  const gasResult = reconstructMlsMpmG2pCpu({
    ...gas,
    boxDimsM: [3, 3, 3]
  });

  assert.ok(Math.abs(gasResult.mechanics[9]) > 1e-3, 'fixture should generate affine strain');
  nearlyEqual(liquidResult.mechanics[9], gasResult.mechanics[9], 1e-5);
  nearlyEqual(liquidResult.mechanics[13], gasResult.mechanics[13], 1e-5);
  nearlyEqual(liquidResult.mechanics[17], gasResult.mechanics[17], 1e-5);
});

test('CPU MLS-MPM G2P bounds solid volume jumps without accepting blink-scale deformation', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 1;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 100 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 100 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 100 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3]
  });

  const maxCondensedJ = 1 + MLS_MPM_CONDENSED_VOLUME_STRAIN_TOLERANCE;
  nearlyEqual(result.mechanics[18], maxCondensedJ, 1e-5);
  assert.ok(result.mechanics[18] <= maxCondensedJ + 1e-5, `solid volume ratio should remain bounded, got ${result.mechanics[18]}`);
});

test('CPU MLS-MPM G2P caps non-condensed particle scale before render extraction', () => {
  const args = fixture({ gridVelocity: [0, 0, 0], dt: 0.1 });
  args.mlsMpmParticleState.mechanics[20] = 0;
  args.mlsMpmParticleState.mechanics[26] = 2;
  for (let i = 0; i <= 2; i += 1) for (let j = 0; j <= 2; j += 1) for (let k = 0; k <= 2; k += 1) {
    const offset = nodeIndex(args.gridUpdate, i, j, k) * MLS_MPM_GPU_GRID_VELOCITY_FLOATS;
    args.gridUpdate.updatedGridNodes[offset + 1] = 1000 * i;
    args.gridUpdate.updatedGridNodes[offset + 2] = 1000 * j;
    args.gridUpdate.updatedGridNodes[offset + 3] = 1000 * k;
  }

  const result = reconstructMlsMpmG2pCpu({
    ...args,
    boxDimsM: [3, 3, 3]
  });

  assert.equal(result.particleScaleStability.schema, ULG_MLS_MPM_G2P_PARTICLE_SCALE_STABILITY_SCHEMA);
  assert.equal(result.particleScaleStability.status, 'particle-scale-cap-applied');
  assert.equal(result.particleScaleStability.capCount, 1);
  assert.equal(result.particleScaleStability.maxRadiusGrowthRatioAllowed, MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO);
  assert.equal(result.particleScaleStability.maxVolumeRatioJAllowed, MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
  assert.ok(result.particleScaleStability.maxRawVolumeRatioJ > MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
  assert.equal(result.mechanics[18], MLS_MPM_G2P_MAX_VOLUME_RATIO_J);
  nearlyEqual(result.mechanics[0], MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO, 1e-5);
  nearlyEqual(result.mechanics[4], MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO, 1e-5);
  nearlyEqual(result.mechanics[8], MLS_MPM_G2P_MAX_RADIUS_GROWTH_RATIO, 1e-5);
});

test('optional MLS-MPM G2P returns CPU reference when WebGPU is not requested', async () => {
  const args = fixture();
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...args,
    preferWebGpu: false,
    navigatorRef: {
      gpu: {
        async requestAdapter() {
          throw new Error('should not request WebGPU');
        }
      }
    }
  });

  assert.equal(execution.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'not-requested');
});

test('optional MLS-MPM G2P falls back when WebGPU is unavailable', async () => {
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    navigatorRef: {}
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'blocked-webgpu-unavailable');
  assert.equal(execution.webgpuStatus.fallback, 'cpu-reference');
});

test('optional MLS-MPM G2P accepts a parity-passing WebGPU result', async () => {
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      return { ...result, backend: 'webgpu' };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA);
  assert.equal(execution.webgpuParity.status, 'pass');
});

test('optional MLS-MPM G2P exposes retained output buffers after parity passes', async () => {
  const stateBuffer = { label: 'g2p-state', destroyed: false, destroy() { this.destroyed = true; } };
  const mechanicsBuffer = { label: 'g2p-mechanics', destroyed: false, destroy() { this.destroyed = true; } };
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    retainOutputParticleBuffers: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      assert.equal(args.retainOutputParticleBuffers, true);
      const result = reconstructMlsMpmG2pCpu(args);
      return {
        ...result,
        backend: 'webgpu',
        stateBuffer,
        mechanicsBuffer,
        stateBufferByteLength: result.state.byteLength,
        mechanicsBufferByteLength: result.mechanics.byteLength,
        retainedOutputParticleBuffers: true,
        destroyOutputParticleBuffers() {
          stateBuffer.destroy();
          mechanicsBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.retainedOutputParticleBuffers, true);
  assert.equal(execution.stateBuffer, stateBuffer);
  assert.equal(execution.mechanicsBuffer, mechanicsBuffer);
  assert.equal(execution.stateBufferByteLength, execution.state.byteLength);
  assert.equal(execution.mechanicsBufferByteLength, execution.mechanics.byteLength);
  assert.equal(stateBuffer.destroyed, false);
  assert.equal(mechanicsBuffer.destroyed, false);
  execution.destroyOutputParticleBuffers();
  assert.equal(stateBuffer.destroyed, true);
  assert.equal(mechanicsBuffer.destroyed, true);
});

test('WebGPU MLS-MPM G2P retires retained state and mechanics independently and replay-safely', async () => {
  const device = fakeG2pDevice();
  const result = await runMlsMpmG2pWebGpu({
    ...twoParticleFixture(),
    device,
    boxDimsM: [3, 3, 3],
    particleSeparationRelaxation: 0,
    particleSeparationVelocityDamping: 0,
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });
  const stateBuffer = result.stateBuffer;
  const mechanicsBuffer = result.mechanicsBuffer;

  assert.equal(result.retainedOutputParticleBuffers, true);
  assert.equal(stateBuffer.destroyed, false);
  assert.equal(mechanicsBuffer.destroyed, false);
  assert.equal(destroyRetainedMlsMpmG2pOutputComponents(result, {
    state: true
  }), true);
  assert.equal(stateBuffer.destroyed, true);
  assert.equal(mechanicsBuffer.destroyed, false);
  assert.equal(destroyRetainedMlsMpmG2pOutputComponents(result, {
    state: true
  }), true);
  assert.equal(mechanicsBuffer.destroyed, false);
  assert.equal(destroyRetainedMlsMpmG2pOutputComponents(result, {
    mechanics: true
  }), true);
  assert.equal(mechanicsBuffer.destroyed, true);
  assert.equal(result.destroyOutputParticleBuffers(), false);
});

test('optional MLS-MPM G2P rejects parity drift and keeps CPU output', async () => {
  let destroyed = 0;
  const execution = await runMlsMpmG2pWithOptionalWebGpu({
    ...fixture(),
    preferWebGpu: true,
    retainOutputParticleBuffers: true,
    navigatorRef: webGpuNavigator(),
    async webGpuRunner(args) {
      const result = reconstructMlsMpmG2pCpu(args);
      result.backend = 'webgpu';
      result.state = result.state.slice();
      result.state[0] += 1;
      result.stateBuffer = { destroy: () => { destroyed += 1; } };
      result.mechanicsBuffer = { destroy: () => { destroyed += 1; } };
      result.retainedOutputParticleBuffers = true;
      result.destroyOutputParticleBuffers = () => {
        result.stateBuffer.destroy();
        result.mechanicsBuffer.destroy();
      };
      return result;
    },
    parityTolerance: 1e-8
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
  assert.ok(execution.webgpuParity.maxStateAbs > 0.5);
  assert.equal(destroyed, 2);
});

test('MLS-MPM G2P parity report is explicit and non-scientific', () => {
  const cpuReference = reconstructMlsMpmG2pCpu(fixture());
  const parity = createMlsMpmG2pParityReport({
    cpuReference,
    gpuResult: { ...cpuReference, backend: 'webgpu' }
  });

  assert.equal(parity.schema, ULG_MLS_MPM_GPU_G2P_RECONSTRUCTION_PARITY_SCHEMA);
  assert.equal(parity.status, 'pass');
  assert.equal(parity.scientificValidation, false);
  assert.equal(parity.sphValidation, false);
  assert.equal(parity.phaseChangeValidation, false);
  assert.equal(parity.fullPhysicsValidation, false);
});

test('WebGPU MLS-MPM G2P rejects a freehand finalized receipt that lacks a runtime-issued resident binding', async () => {
  const device = fakeG2pDevice();
  const { generation, evidenceBuffer } = canonicalSpatialGenerationFixture(device);
  let legacyAssignmentPropertyReads = 0;
  const contradictoryMalformedAssignment = new Proxy({
    particleCount: -99,
    assignmentStrideFloats: 'not-a-stride',
    assignmentBuffer: { label: 'wrong-device-legacy-assignment' },
    assignments: new Uint8Array([255]),
    selectedLevel: -17
  }, {
    get(target, property, receiver) {
      legacyAssignmentPropertyReads += 1;
      return Reflect.get(target, property, receiver);
    }
  });
  const proposalApplyCalls = [];
  const mechanicalProposal = canonicalMechanicalProposalFixture(
    device,
    generation,
    proposalApplyCalls
  );

  await assert.rejects(runMlsMpmG2pWebGpu({
      ...twoParticleFixture(),
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      schroederLevelAssignment: contradictoryMalformedAssignment,
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      schroederSpatialMechanicalProposal: mechanicalProposal,
      canonicalSpatialRequired: true,
      observeCanonicalSpatialAuthority: true
    }),
    /requires an authenticated deferred post-G2P contact\/separation residual solver/
  );
  assert.equal(legacyAssignmentPropertyReads, 0);
  assert.equal(proposalApplyCalls.length, 0);
  assert.equal(device.submissions.length, 0);
  const traceReadback = device.createdBuffers.find(
    (buffer) => buffer.label
      === 'ulg-mls-mpm-g2p-canonical-authority-trace-readback'
  );
  assert.ok(traceReadback);
  assert.equal(traceReadback.size, 80);
  assert.equal(traceReadback.usage, 1 | 8);
  assert.equal(traceReadback.destroyed, true);
  assert.equal(evidenceBuffer.destroyed, false);
  assert.equal(
    device.writes.some(({ buffer }) => buffer === evidenceBuffer),
    false,
    'diagnostic setup never host-writes the borrowed authority source'
  );
});

test('observed canonical dense G2P maps exactly one terminal 80-byte authority snapshot', async () => {
  const fixture = canonicalDenseTraceRuntimeFixture();
  const {
    device,
    generation,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    gridUpdate
  } = fixture;
  sphParticleState.step = 101;
  mlsMpmParticleState.step = 101;
  const proposal = runSchroederSpatialMechanicalProposalWebGpu({
    cleanupPassBudget: 1024,
    device,
    generation,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload,
    boxDimsM: [3, 3, 3],
    gridSpacingM: 0.25,
    relaxation: 0,
    normalVelocityDamping: 0,
    selectedLevel: 0
  });
  assert.equal(proposal.ready, true, proposal.reason ?? proposal.status);

  const authorityWords = Uint32Array.from(
    { length: 20 },
    (_, index) => 0x7000_0000 + index
  );
  seedBufferWords(generation.execution.evidenceBuffer, authorityWords);
  const sourceBefore = generation.execution.evidenceBuffer.bytes.slice();
  const sourceWriteCount = device.writes.filter(
    ({ buffer }) => buffer === generation.execution.evidenceBuffer
  ).length;
  const submissionStart = device.submissions.length;

  const result = await runMlsMpmG2pWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    sphParticleUpload,
    mlsMpmParticleUpload,
    dt: 0.001,
    boxDimsM: [3, 3, 3],
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialMechanicalProposal: proposal,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: true,
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });

  const trace = result.canonicalSpatialAuthorityTrace;
  assert.equal(trace.status, 'canonical-spatial-authority-trace-observed');
  assert.equal(trace.observed, true);
  assert.equal(trace.sourceStep, 101);
  assert.equal(trace.generationId, generation.execution.generationId);
  assert.equal(trace.selectedLevel, 0);
  assert.equal(trace.bufferRole, 'schroeder-spatial-epoch-with-mechanics-evidence');
  assert.equal(trace.bufferSchema, ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA);
  assert.equal(trace.diagnosticOnly, true);
  assert.equal(trace.admissionAuthority, false);
  assert.equal(trace.readbackBytes, 80);
  assert.equal(trace.snapshotCount, 1);
  assert.deepEqual(trace.rawWords, Array.from(authorityWords));
  for (const [name, index] of Object.entries(
    SCHROEDER_MECHANICS_SPATIAL_AUTHORITY_EVIDENCE_LAYOUT
  )) {
    assert.equal(trace.counters[name], authorityWords[index], name);
  }
  assert.equal(result.mapAsyncCount, 1);
  assert.equal(result.readbackBytes, 80);
  assert.equal(result.finalDiagnosticMapAsyncCount, 1);
  assert.equal(result.finalDiagnosticReadbackBytes, 80);
  assert.equal(device.mapAsyncCalls.length, 1);
  assert.equal(device.unmapCalls.length, 1);

  const command = device.submissions[submissionStart]?.[0];
  assert.ok(command);
  const finalizeIndex = command.events.findIndex((event) => (
    event.kind === 'dispatch'
    && event.pipeline?.label === 'ulg-mls-mpm-g2p-finalize-spatial-authority'
  ));
  const snapshotIndex = command.events.findIndex((event) => (
    event.kind === 'copy'
    && event.source === generation.execution.evidenceBuffer
    && event.size === 80
  ));
  assert.ok(finalizeIndex >= 0);
  assert.ok(snapshotIndex > finalizeIndex);

  const traceReadback = device.createdBuffers.find(
    (buffer) => buffer.label
      === 'ulg-mls-mpm-g2p-canonical-authority-trace-readback'
  );
  assert.equal(device.mapAsyncCalls[0].buffer, traceReadback);
  assert.equal(traceReadback.destroyed, true);
  assert.equal(traceReadback.mapped, false);
  assert.equal(generation.execution.evidenceBuffer.destroyed, false);
  assert.deepEqual(generation.execution.evidenceBuffer.bytes, sourceBefore);
  assert.equal(device.writes.filter(
    ({ buffer }) => buffer === generation.execution.evidenceBuffer
  ).length, sourceWriteCount);

  assert.equal(result.destroyOutputParticleBuffers(), true);
  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  await proposal.releasePromise;
});

test('observed mechanics-field G2P maps one 800-byte pre-claim and terminal authority trace', async () => {
  const fixture = await canonicalFieldTraceRuntimeFixture();
  const {
    device,
    generation,
    gridUpdate,
    proposal,
    sphParticleState,
    mlsMpmParticleState,
    sphParticleUpload,
    mlsMpmParticleUpload
  } = fixture;
  const field = generation.mechanicsFieldView;
  const sourceBuffer = field.fieldViewBuffer;
  const receiptOffsetWords = field.layout.receiptControlOffsetWords;
  assert.equal(
    field.layout.receiptControlWords,
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
  );

  const preHeader = new Uint32Array(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_WORDS
  );
  const preReceipt = new Uint32Array(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
  );
  preHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'statusFlags'
  )] = 0x31;
  preHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'generationId'
  )] = 0x41;
  preHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'selectedLevel'
  )] = 0xffff_fffe;
  preHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'gridSpacingM'
  )] = float32Bits(0.25);
  preHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'fieldCount'
  )] = 7;
  preHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'stateEncoding'
  )] = SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_MASS_VELOCITY_GRADIENT;
  preHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'stateMutationOrdinal'
  )] = 11;
  preReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'statusFlags'
  )] = 0x51;
  preReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'phase'
  )] = 4;
  preReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'fieldMutationOrdinal'
  )] = 11;
  preReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'totalHeatJ'
  )] = float32Bits(12.5);

  const terminalHeader = preHeader.slice();
  const terminalReceipt = preReceipt.slice();
  terminalHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'statusFlags'
  )] = 0x32;
  terminalHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'fieldCount'
  )] = 9;
  terminalHeader[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_HEADER_LAYOUT,
    'stateMutationOrdinal'
  )] = 12;
  terminalReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'statusFlags'
  )] = 0x52;
  terminalReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'phase'
  )] = 6;
  terminalReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'fieldMutationOrdinal'
  )] = 12;
  terminalReceipt[abiWordIndex(
    SCHROEDER_SPATIAL_MECHANICS_FIELD_RECEIPT_LAYOUT,
    'consumedHeatJ'
  )] = float32Bits(12.5);

  seedBufferWords(sourceBuffer, preHeader);
  seedBufferWords(sourceBuffer, preReceipt, receiptOffsetWords);
  const sourceWriteCount = device.writes.filter(
    ({ buffer }) => buffer === sourceBuffer
  ).length;
  let terminalMutationCount = 0;
  device.commandEventHook = (event) => {
    if (
      event.pipeline?.label === 'ulg-mls-mpm-g2p-field-energy-claim'
      && terminalMutationCount === 0
    ) {
      seedBufferWords(sourceBuffer, terminalHeader);
      seedBufferWords(sourceBuffer, terminalReceipt, receiptOffsetWords);
      terminalMutationCount += 1;
    }
  };
  const submissionStart = device.submissions.length;

  const result = await runMlsMpmG2pWebGpu({
    device,
    sphParticleState,
    mlsMpmParticleState,
    gridUpdate,
    sphParticleUpload,
    mlsMpmParticleUpload,
    dt: 0.005,
    boxDimsM: [1, 1, 1],
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: generation,
    schroederSpatialMechanicalProposal: proposal,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: true,
    mechanicsFieldMode: 'required',
    retainOutputParticleBuffers: true,
    readbackMode: 'no-full-readback'
  });
  device.commandEventHook = null;

  const trace = result.canonicalSpatialAuthorityTrace;
  assert.equal(trace.status, 'canonical-spatial-authority-trace-observed');
  assert.equal(trace.observed, true);
  assert.equal(trace.sourceStep, 211);
  assert.equal(trace.generationId, generation.execution.generationId);
  assert.equal(trace.selectedLevel, 0);
  assert.equal(
    trace.bufferRole,
    'schroeder-spatial-mechanics-field-view-header-and-receipt'
  );
  assert.equal(
    trace.bufferSchema,
    ULG_SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_SCHEMA
  );
  assert.equal(trace.diagnosticOnly, true);
  assert.equal(trace.admissionAuthority, false);
  assert.equal(trace.readbackBytes, 800);
  assert.equal(trace.snapshotCount, 2);
  assert.equal(trace.preClaim.stage, 'pre-g2p-claim');
  assert.equal(
    trace.terminal.stage,
    'post-g2p-contact-receipts-finalize'
  );
  assert.deepEqual(trace.preClaim.headerWords, Array.from(preHeader));
  assert.deepEqual(trace.preClaim.receiptWords, Array.from(preReceipt));
  assert.deepEqual(trace.terminal.headerWords, Array.from(terminalHeader));
  assert.deepEqual(trace.terminal.receiptWords, Array.from(terminalReceipt));
  assert.equal(trace.preClaim.header.selectedLevel, -2);
  assert.equal(trace.preClaim.header.gridSpacingM, 0.25);
  assert.equal(trace.preClaim.header.fieldCount, 7);
  assert.equal(trace.preClaim.receipt.phase, 4);
  assert.equal(trace.preClaim.receipt.totalHeatJ, 12.5);
  assert.equal(trace.terminal.header.fieldCount, 9);
  assert.equal(trace.terminal.header.stateMutationOrdinal, 12);
  assert.equal(trace.terminal.receipt.phase, 6);
  assert.equal(trace.terminal.receipt.consumedHeatJ, 12.5);
  assert.deepEqual(trace.rawWords, [
    ...preHeader,
    ...preReceipt,
    ...terminalHeader,
    ...terminalReceipt
  ]);
  assert.equal(result.mapAsyncCount, 1);
  assert.equal(result.readbackBytes, 800);
  assert.equal(result.finalDiagnosticMapAsyncCount, 1);
  assert.equal(result.finalDiagnosticReadbackBytes, 800);
  assert.equal(device.mapAsyncCalls.length, 1);
  assert.equal(device.unmapCalls.length, 1);
  assert.equal(terminalMutationCount, 1);

  const command = device.submissions[submissionStart]?.[0];
  assert.ok(command);
  const traceReadback = device.createdBuffers.find(
    (buffer) => buffer.label
      === 'ulg-mls-mpm-g2p-canonical-field-authority-trace-readback'
  );
  const traceCopies = command.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => (
      event.kind === 'copy'
      && event.source === sourceBuffer
      && event.destination === traceReadback
    ));
  assert.deepEqual(traceCopies.map(({ event }) => ({
    sourceOffset: event.sourceOffset,
    destinationOffset: event.destinationOffset,
    size: event.size
  })), [
    { sourceOffset: 0, destinationOffset: 0, size: 256 },
    {
      sourceOffset: receiptOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
      destinationOffset: 256,
      size: 144
    },
    { sourceOffset: 0, destinationOffset: 400, size: 256 },
    {
      sourceOffset: receiptOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
      destinationOffset: 656,
      size: 144
    }
  ]);
  const claimIndex = command.events.findIndex((event) => (
    event.kind === 'dispatch'
    && event.pipeline?.label === 'ulg-mls-mpm-g2p-field-energy-claim'
  ));
  const finalizeIndex = command.events.findIndex((event) => (
    event.kind === 'dispatch'
    && event.pipeline?.label === 'ulg-mls-mpm-g2p-finalize-spatial-authority'
  ));
  assert.ok(traceCopies[1].index < claimIndex);
  assert.ok(traceCopies[2].index > finalizeIndex);

  assert.equal(device.mapAsyncCalls[0].buffer, traceReadback);
  assert.equal(traceReadback.size, 800);
  assert.equal(traceReadback.destroyed, true);
  assert.equal(traceReadback.mapped, false);
  assert.equal(sourceBuffer.destroyed, false);
  assert.deepEqual(
    Array.from(new Uint32Array(sourceBuffer.bytes.buffer, 0, 64)),
    Array.from(terminalHeader)
  );
  assert.deepEqual(
    Array.from(new Uint32Array(
      sourceBuffer.bytes.buffer,
      receiptOffsetWords * Uint32Array.BYTES_PER_ELEMENT,
      SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_RECEIPT_WORDS
    )),
    Array.from(terminalReceipt)
  );
  assert.equal(device.writes.filter(
    ({ buffer }) => buffer === sourceBuffer
  ).length, sourceWriteCount);

  assert.equal(result.destroyOutputParticleBuffers(), true);
  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  await proposal.releasePromise;
});

test('WebGPU MLS-MPM G2P rejects a host-invalid selected epoch before submission', async () => {
  const device = fakeG2pDevice();
  const { generation } = canonicalSpatialGenerationFixture(device, {
    evidenceBufferSize: 76
  });

  await assert.rejects(
    runMlsMpmG2pWebGpu({
      ...fixture(),
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      canonicalSpatialRequired: true
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(error.status, 'canonical-spatial-directory-rejected-evidence-capacity');
      return true;
    }
  );

  assert.equal(device.submissions.length, 0);
  assert.equal(device.dispatches.length, 0);
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-g2p-state-out'),
    false
  );
  assert.equal(
    device.createdBuffers.some((buffer) => buffer.label === 'ulg-mls-mpm-g2p-params'),
    false
  );
});

test('WebGPU canonical G2P rejects a forged zero-row proposal before submission', async () => {
  const device = fakeG2pDevice();
  const { generation } = canonicalSpatialGenerationFixture(device);
  const mechanicalProposal = canonicalMechanicalProposalFixture(device, generation);

  await assert.rejects(runMlsMpmG2pWebGpu({
      ...twoParticleFixture(),
      device,
      boxDimsM: [3, 3, 3],
      particleSeparationRelaxation: 0,
      particleSeparationVelocityDamping: 0,
      readbackMode: 'no-full-readback',
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      schroederSpatialMechanicalProposal: mechanicalProposal,
      canonicalSpatialRequired: true
    }),
    /requires an authenticated deferred post-G2P contact\/separation residual solver/
  );
  assert.equal(device.submissions.length, 0);
  const productionShader = device.dispatches[0].pipeline.compute.module.code;
  assert.match(
    productionShader,
    /fn g2p_spatial_evidence_add\(word: u32, value: u32\) \{\s*\}/
  );
  assert.match(
    productionShader,
    /fn g2p_spatial_reject\(word: u32\)[\s\S]*atomicStore\(&schroeder_spatial_authority_evidence\[14u\], 1u\)/
  );
});

test('canonical particle separation rejects aliased immutable restore buffers', () => {
  const device = fakeG2pDevice();
  const stateBuffer = { label: 'writable-state' };
  const mechanicsBuffer = { label: 'writable-mechanics' };
  const immutableMechanicsBuffer = { label: 'immutable-mechanics' };

  assert.throws(
    () => encodeMlsMpmParticleSeparationPasses(device, device.createCommandEncoder(), {
      stateBuffer,
      mechanicsBuffer,
      authorityRestoreStateBuffer: stateBuffer,
      authorityRestoreMechanicsBuffer: immutableMechanicsBuffer,
      particleCount: 2,
      maxPairRestDistanceM: 1,
      spatialAuthorityEvidenceBuffer: { label: 'canonical-authority-evidence' }
    }),
    /restore buffers must be distinct immutable inputs/
  );
  assert.equal(device.createdBuffers.length, 0);
  assert.equal(device.dispatches.length, 0);
});

test('WebGPU MLS-MPM G2P reports canonical level and rejection precedence consistently', async (t) => {
  const cases = [
    {
      name: 'selected level is not an exact i32',
      status: 'canonical-spatial-selected-level-rejected',
      selectedLevel: Number.NaN,
      invalidate() {}
    },
    {
      name: 'overlay authority takes precedence over a wrong schema',
      status: 'canonical-spatial-directory-rejected-overlay-authority',
      selectedLevel: 2,
      invalidate(generation) {
        generation.source.phaseVolumeAssignmentOverlayEnabled = true;
        generation.schema = 'peercompute.ulg.schroeder-spatial-epoch-generation.invalid';
      }
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const device = fakeG2pDevice();
      const { generation } = canonicalSpatialGenerationFixture(device);
      testCase.invalidate(generation);

      await assert.rejects(
        runMlsMpmG2pWebGpu({
          ...fixture(),
          device,
          boxDimsM: [3, 3, 3],
          readbackMode: 'no-full-readback',
          schroederSelectedLevel: testCase.selectedLevel,
          schroederSpatialEpochGeneration: generation,
          canonicalSpatialRequired: true
        }),
        (error) => {
          assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
          assert.equal(error.status, testCase.status);
          return true;
        }
      );

      assert.equal(device.submissions.length, 0);
      assert.equal(device.dispatches.length, 0);
    });
  }
});

test('optional MLS-MPM G2P never falls back to the unfiltered CPU oracle for canonical intent', async () => {
  const device = fakeG2pDevice();
  const { generation } = canonicalSpatialGenerationFixture(device);

  await assert.rejects(
    runMlsMpmG2pWithOptionalWebGpu({
      ...fixture(),
      schroederSelectedLevel: 2,
      schroederSpatialEpochGeneration: generation,
      canonicalSpatialRequired: true,
      preferWebGpu: true,
      navigatorRef: {}
    }),
    (error) => {
      assert.equal(error.code, 'ERR_CANONICAL_SPATIAL_AUTHORITY_REJECTED');
      assert.equal(error.status, 'canonical-spatial-webgpu-device-unavailable');
      return true;
    }
  );
});

test('WebGPU MLS-MPM G2P binds a retained Schroeder level-assignment buffer for level filtering', async () => {
  const device = fakeG2pDevice();
  const retainedAssignmentBuffer = { label: 'retained-schroeder-level-assignments', size: 4096 };
  const result = await runMlsMpmG2pWebGpu({
    ...fixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: { assignmentBuffer: retainedAssignmentBuffer },
    schroederSelectedLevel: 2
  });
  assert.equal(result.backend, 'webgpu');
  // No dummy assignment buffer is created when a retained buffer is borrowed.
  assert.equal(
    device.createdBuffers.some((buffer) => String(buffer.label).includes('level-assignments-dummy')),
    false
  );
  const bindGroup = device.dispatches[0].bindGroup;
  const assignmentEntry = bindGroup.entries.find((entry) => entry.binding === 7);
  assert.equal(assignmentEntry.resource.buffer, retainedAssignmentBuffer);
});

test('WebGPU MLS-MPM G2P uploads explicit level-assignment rows for level filtering', async () => {
  const device = fakeG2pDevice();
  const rows = new Float32Array(16 * 2);
  rows[0] = 1;
  rows[16] = 0;
  await runMlsMpmG2pWebGpu({
    ...fixture(),
    device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    schroederLevelAssignment: { assignments: rows },
    schroederSelectedLevel: 1
  });
  const uploaded = device.createdBuffers.find(
    (buffer) => buffer.label === 'ulg-mls-mpm-g2p-schroeder-level-assignments-in'
  );
  assert.ok(uploaded);
  const write = device.writes.find(
    (entry) => entry.label === 'ulg-mls-mpm-g2p-schroeder-level-assignments-in'
  );
  assert.equal(write.byteLength, rows.byteLength);
});

test('WebGPU MLS-MPM G2P rejects the compacted active-node list as a particle filter', async () => {
  const device = fakeG2pDevice();
  await assert.rejects(
    runMlsMpmG2pWebGpu({
      ...fixture(),
      device,
      boxDimsM: [3, 3, 3],
      readbackMode: 'no-full-readback',
      schroederActiveNodeList: { activeNodes: new Float32Array(16) },
      schroederSelectedLevel: 1
    }),
    /no longer accepts schroederActiveNodeList/
  );
});
