import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
} from '../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  ULG_MLS_MPM_GPU_GRID_UPDATE_EXECUTION_SCHEMA,
  ULG_MLS_MPM_GPU_GRID_UPDATE_SCHEMA,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
  SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
  classifySchroederSpatialMechanicalPair,
  destroySchroederSpatialMechanicalProposalRuntime,
  evaluateSchroederSpatialMechanicalPairProposal,
  isLiveSchroederSpatialMechanicalProposal,
  runSchroederSpatialMechanicalProposalWebGpu,
  schroederSpatialMechanicalProposalApplyWgsl,
  schroederSpatialMechanicalProposalWgsl
} from '../src/runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  isFinalizedSchroederSpatialExactNearConsumerReceipt,
  runSchroederSpatialEpochGenerationWebGpu
} from '../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  runMlsMpmG2pWebGpu
} from '../src/runtime/sph/sphG2pGpuKernel.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function copyBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    );
  }
  return new Uint8Array();
}

function createFakeEncoder(device, descriptor = {}) {
  const event = { descriptor, clears: [], passes: [], copies: [] };
  device.encoders.push(event);
  return {
    clearBuffer(buffer, offset = 0, size = null) {
      event.clears.push({ buffer, offset, size });
    },
    beginComputePass(passDescriptor = {}) {
      const pass = { descriptor: passDescriptor, commands: [] };
      event.passes.push(pass);
      return {
        setPipeline(pipeline) { pass.pipeline = pipeline; },
        setBindGroup(index, bindGroup) { pass.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) {
          const command = { dispatch: [x, y, z] };
          pass.commands.push(command);
          device.dispatches.push({
            encoder: event,
            pass,
            pipeline: pass.pipeline,
            bindGroup: pass.bindGroup?.bindGroup,
            ...command
          });
        },
        dispatchWorkgroupsIndirect(buffer, offset) {
          const command = { dispatchIndirect: { buffer, offset } };
          pass.commands.push(command);
          device.dispatches.push({
            encoder: event,
            pass,
            pipeline: pass.pipeline,
            bindGroup: pass.bindGroup?.bindGroup,
            ...command
          });
        },
        end() { pass.ended = true; }
      };
    },
    copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
      event.copies.push({ source, sourceOffset, destination, destinationOffset, size });
    },
    finish() { return event; }
  };
}

function createFakeDevice() {
  const device = {
    buffers: [],
    writes: [],
    submissions: [],
    encoders: [],
    dispatches: [],
    shaderModules: [],
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 12,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = copyBytes(data);
        if (Number.isFinite(buffer?.size) && offset + bytes.byteLength > buffer.size) {
          throw new RangeError(
            `writeBuffer overflow for ${buffer.label}: ${offset + bytes.byteLength} > ${buffer.size}`
          );
        }
        device.writes.push({ buffer, offset, bytes });
      },
      submit(commandBuffers) { device.submissions.push(commandBuffers); },
      onSubmittedWorkDone() { return Promise.resolve(); }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        destroy() { this.destroyCount += 1; }
      };
      device.buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      device.shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; },
    createCommandEncoder(descriptor) { return createFakeEncoder(device, descriptor); }
  };
  return device;
}

function taggedBuffer(device, label, size, usage = 128) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage }), device);
}

function createActiveNodeList(
  device,
  particleCount,
  { minLevel = 0, maxLevel = minLevel } = {}
) {
  return {
    schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
    status: 'schroeder-active-node-list-submitted',
    spatialDirectorySourceSchema:
      'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
    spatialDirectorySourceStatus: 'schroeder-spatial-directory-source-ready',
    spatialDirectorySourceReady: true,
    spatialEpochSourceSchema: 'peercompute.ulg.schroeder-spatial-active-node-source.v1',
    spatialEpochSourceStatus: 'schroeder-spatial-active-node-source-ready',
    spatialEpochSourceReady: true,
    spatialEpochLevelSpacingMode: 'base-grid-spacing-times-pow2-level',
    spatialEpochPositionAuthority: 'same-epoch-pre-integration-particle-state',
    spatialEpochMinLevel: minLevel,
    spatialEpochMaxLevel: maxLevel,
    spatialEpochBaseGridSpacingM: 0.25,
    spatialEpochChartId: 0,
    activeCandidateCount: particleCount,
    activeNodeStrideFloats: 16,
    activeNodeBuffer: taggedBuffer(
      device,
      'mechanical-proposal-active-node-source',
      particleCount * 16 * Float32Array.BYTES_PER_ELEMENT
    ),
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
}

function liveFixture(
  particleCount = 2,
  { identityEnabled = true, minLevel = 0, maxLevel = minLevel } = {}
) {
  const device = createFakeDevice();
  const state = new Float32Array(particleCount * 8);
  const thermo = new Float32Array(particleCount * 12);
  const mechanics = new Float32Array(particleCount * 32);
  for (let index = 0; index < particleCount; index += 1) {
    state.set([
      1 + 0.5 * index, 1, 1, index + 1,
      index === 0 ? 1 : -1, 0, 0, 0
    ], index * 8);
    thermo[index * 12] = index + 1;
    mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], index * 32);
    mechanics[index * 32 + 18] = 1;
    mechanics[index * 32 + 19] = 1;
    mechanics[index * 32 + 20] = 1;
    mechanics[index * 32 + 21] = 1;
    mechanics[index * 32 + 26] = 1;
  }
  const activeNodeList = createActiveNodeList(device, particleCount, {
    minLevel,
    maxLevel
  });
  const generation = runSchroederSpatialEpochGenerationWebGpu({
    device,
    activeNodeList,
    particleCount
  });
  assert.equal(generation.selected, true);
  const sphParticleUpload = {
    status: 'webgpu-uploaded',
    stateBuffer: taggedBuffer(device, 'mechanical-source-state', state.byteLength),
    thermoBuffer: taggedBuffer(device, 'mechanical-source-thermo', thermo.byteLength),
    ...(identityEnabled
      ? { identityBuffer: taggedBuffer(device, 'mechanical-source-identity', particleCount * 4) }
      : {})
  };
  const mlsMpmParticleUpload = {
    status: 'webgpu-uploaded',
    mechanicsBuffer: taggedBuffer(device, 'mechanical-source-mechanics', mechanics.byteLength)
  };
  const gridDims = [4, 4, 4];
  const gridNodeCount = gridDims[0] * gridDims[1] * gridDims[2];
  return {
    device,
    generation,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state,
      thermo,
      smoothingLengthM: 0.25
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      mechanics,
      mechanicsDtS: 0.001,
      particleSeparationRelaxation: 0.35,
      particleSeparationVelocityDamping: 0.25
    },
    sphParticleUpload,
    mlsMpmParticleUpload,
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
      updatedGridNodes: new Float32Array(gridNodeCount * 8)
    }
  };
}

async function settleDeferredCleanup(device) {
  await device.queue.onSubmittedWorkDone();
  await new Promise((resolve) => setImmediate(resolve));
}

function assertVectorNearZero(vector, tolerance = 1e-12) {
  for (const value of vector) assert.ok(Math.abs(value) <= tolerance, String(vector));
}

test('mechanical pair policy skips one solid body but handles material and domain interfaces', () => {
  const base = {
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 7,
    otherMaterialId: 7,
    domainId: 11,
    otherDomainId: 11,
    identityEnabled: true
  };
  assert.deepEqual(classifySchroederSpatialMechanicalPair(base), {
    handled: false,
    reason: 'same-body-solid'
  });
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    otherDomainId: 12
  }).handled, true);
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    otherMaterialId: 8
  }).handled, true);
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    phaseClass: 1,
    otherPhaseClass: 1
  }).handled, true);
  assert.equal(classifySchroederSpatialMechanicalPair({
    ...base,
    otherPhaseClass: 0
  }).handled, false);
});

test('manufactured contact proposal conserves center of mass and pair momentum', () => {
  const massKg = 2;
  const otherMassKg = 5;
  const proposal = evaluateSchroederSpatialMechanicalPairProposal({
    phaseClass: 2,
    otherPhaseClass: 2,
    materialId: 1,
    otherMaterialId: 2,
    domainId: 3,
    otherDomainId: 3,
    position: [0, 0, 0],
    otherPosition: [0.5, 0, 0],
    velocity: [1, 0, 0],
    otherVelocity: [-0.5, 0, 0],
    massKg,
    otherMassKg,
    restVolumeM3: 1,
    otherRestVolumeM3: 1,
    relaxation: 0.35,
    normalVelocityDamping: 0.25
  });
  assert.equal(proposal.handled, true);
  assert.ok(proposal.overlapM > 0);
  assertVectorNearZero(proposal.positionDeltaM.map(
    (value, axis) => massKg * value + otherMassKg * proposal.otherPositionDeltaM[axis]
  ));
  assertVectorNearZero(proposal.velocityDeltaMPerS.map(
    (value, axis) => massKg * value + otherMassKg * proposal.otherVelocityDeltaMPerS[axis]
  ));
});

test('mechanical WGSL uses one exact-near traversal and a complete resident apply gate', () => {
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT.length, 16);
  assert.equal(SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT.length, 20);
  assert.equal(SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS, 20);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /ss_exact_near_directory_admitted\(spatial_expectation\)/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /mechanical_same_body_solid_pair/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /self_domain == 0u \|\| other_domain == 0u \|\| self_domain == other_domain/);
  assert.match(schroederSpatialMechanicalProposalWgsl,
    /mechanical_flush_evidence\(index: u32, count: u32\)/);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /atomicAdd\(&traversal_evidence\[3u\], 1u\)/);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /atomicAdd\(&traversal_evidence\[4u\], 1u\)/);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /separation_bins|bin_capacity|candidate_budget/i);
  assert.doesNotMatch(schroederSpatialMechanicalProposalWgsl,
    /for\s*\(var other_index\s*=\s*0u/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /mechanical_complete_proposal_admitted/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /mechanical_proposal_header_word\(2u\) != mechanical_params\.generation_id/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /atomicLoad\(&traversal_evidence\[6u\]\) == mechanical_params\.particle_count/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /atomicLoad\(&traversal_evidence\[14u\]\) == 0u/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /@binding\(5\) var<storage, read> level_assignments/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /mechanical_params\.apply_selected_level != -2147483648/);
  assert.match(schroederSpatialMechanicalProposalApplyWgsl,
    /level_assignments\[particle_index \* 16u\]/);
});

test('one resident traversal publishes three distinct receipts and reuses its arena buffers', async () => {
  const fixture = liveFixture(2, { identityEnabled: false });
  const beforeProposalBuffers = fixture.device.buffers.length;
  const first = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  assert.equal(first.ready, true);
  assert.equal(first.traversalCount, 1);
  assert.equal(first.multiConsumerTraversal, true);
  assert.equal(first.proposalPoolCacheHit, false);
  assert.equal(first.proposalHeaderWords, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS);
  assert.equal(first.proposalRowWords, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS);
  assert.equal(first.proposalRowByteOffset, 64);
  assert.equal(first.privateBuildCount, 0);
  assert.equal(first.fixedCandidateBuildCount, 0);
  assert.equal(first.exhaustiveTraversalCount, 0);
  assert.equal(first.candidateBudget, null);
  assert.equal(first.fullParticleReadbackPerformed, false);
  assert.equal(isLiveSchroederSpatialMechanicalProposal(first, {
    device: fixture.device,
    generation: fixture.generation
  }), true);

  const expectedProfiles = [
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
    SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1
  ];
  const receipts = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
    ({ consumerId }) => first.consumerReceipt(consumerId)
  );
  assert.equal(new Set(receipts).size, 3);
  assert.deepEqual(receipts.map(({ supportProfileId }) => supportProfileId), expectedProfiles);
  assert.ok(receipts.every((receipt) => (
    receipt.generationId === fixture.generation.execution.generationId
    && receipt.traversalCount === 1
    && receipt.privateLookupBuildCount === 0
    && receipt.fixedCandidateBuildCount === 0
    && receipt.exhaustiveTraversalCount === 0
    && isFinalizedSchroederSpatialExactNearConsumerReceipt(receipt)
  )));

  const proposalEncoder = fixture.device.encoders.at(-1);
  assert.deepEqual(proposalEncoder.passes.map(({ descriptor }) => descriptor.label), [
    'ulg-schroeder-spatial-mechanical-support-reduction',
    'ulg-schroeder-spatial-mechanical-proposal'
  ]);
  assert.deepEqual(proposalEncoder.clears.map(({ offset, size }) => [offset, size]), [
    [0, null],
    [64, 2 * 32]
  ]);
  const headerWrite = fixture.device.writes.find(
    ({ buffer, offset }) => buffer === first.proposalBuffer && offset === 0
  );
  const header = new Uint32Array(
    headerWrite.bytes.buffer,
    headerWrite.bytes.byteOffset,
    SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS
  );
  assert.equal(header[0], SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC);
  assert.equal(header[2], fixture.generation.execution.generationId);
  assert.equal(header[4], 2);
  assert.equal(header[14], 1);
  assert.equal(header[15], 3);
  assert.equal(
    fixture.device.writes.some(({ buffer }) => (
      String(buffer.label).includes('identity-disabled')
    )),
    false,
    'WebGPU zero initialization avoids a per-tick JS identity upload'
  );
  assert.equal(
    fixture.device.buffers.some(({ label }) => /separation-(bins|params|corrections)/.test(label)),
    false
  );
  assert.throws(
    () => runSchroederSpatialMechanicalProposalWebGpu(fixture),
    /still leased/
  );

  assert.equal(first.releaseAfterSubmittedWork(), true);
  assert.ok(first.releasePromise instanceof Promise);
  assert.equal(await first.releasePromise, true);
  await settleDeferredCleanup(fixture.device);
  assert.equal(first.proposalBuffer.destroyCount, 0);
  const bufferCountAfterWarmup = fixture.device.buffers.length;
  const second = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  assert.equal(second.proposalPoolCacheHit, true);
  assert.equal(second.proposalBuffer, first.proposalBuffer);
  assert.equal(second.evidence.buffer, first.evidence.buffer);
  assert.equal(fixture.device.buffers.length, bufferCountAfterWarmup);
  assert.ok(fixture.device.buffers.length > beforeProposalBuffers);
  assert.equal(second.releaseAfterSubmittedWork(), true);
  assert.equal(await second.releasePromise, true);
  await settleDeferredCleanup(fixture.device);
  assert.equal(second.proposalBuffer.destroyCount, 0);
  assert.equal(destroySchroederSpatialMechanicalProposalRuntime(fixture.device), true);
  assert.equal(second.proposalBuffer.destroyCount, 1);
});

test('canonical G2P applies the authenticated proposal before authority finalization and creates no private bins', async () => {
  const fixture = liveFixture();
  const proposal = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  const dispatchStart = fixture.device.dispatches.length;
  const bufferStart = fixture.device.buffers.length;
  const result = await runMlsMpmG2pWebGpu({
    ...fixture,
    device: fixture.device,
    boxDimsM: [3, 3, 3],
    readbackMode: 'no-full-readback',
    retainOutputParticleBuffers: true,
    schroederSelectedLevel: 0,
    schroederSpatialEpochGeneration: fixture.generation,
    schroederSpatialMechanicalProposal: proposal,
    canonicalSpatialRequired: true,
    observeCanonicalSpatialAuthority: true
  });
  const labels = fixture.device.dispatches.slice(dispatchStart).map(
    ({ pipeline }) => pipeline?.label
  );
  assert.deepEqual(labels, [
    'ulg-mls-mpm-g2p-reconstruct',
    'ulg-schroeder-spatial-mechanical-proposal-apply',
    'ulg-mls-mpm-g2p-finalize-spatial-authority'
  ]);
  assert.equal(labels.some((label) => String(label).startsWith(
    'ulg-mls-mpm-particle-separation-'
  )), false);
  assert.equal(fixture.device.buffers.slice(bufferStart).some(
    ({ label }) => /separation-(bins|params|corrections)/.test(String(label))
  ), false);
  assert.equal(result.separationCanonicalSpatialAuthorityGate, true);
  assert.equal(result.oldLevelAssignmentLookupRemoved, true);
  const selectedLevelWrite = fixture.device.writes.find(({ buffer, offset }) => (
    String(buffer?.label || '').startsWith(
      'ulg-schroeder-spatial-mechanical-params-'
    ) && offset === 44
  ));
  assert.equal(selectedLevelWrite, undefined);
  assert.equal(proposal.uniformQueryLevel, 0);
  assert.equal(
    proposal.applyLevelFilterPolicy,
    'omit-redundant-uniform-level-assignment-filter'
  );
  const applyDispatch = fixture.device.dispatches.slice(dispatchStart).find(
    ({ pipeline }) => pipeline?.label
      === 'ulg-schroeder-spatial-mechanical-proposal-apply'
  );
  assert.ok(applyDispatch);
  assert.equal(
    applyDispatch.bindGroup.entries.find(({ binding }) => binding === 5)
      ?.resource?.buffer,
    fixture.generation.source.sourceBuffer
  );
  assert.equal(webGpuBufferMatchesDevice(result.stateBuffer, fixture.device), true);
  assert.equal(webGpuBufferMatchesDevice(result.mechanicsBuffer, fixture.device), true);
  result.destroyOutputParticleBuffers();
  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  await settleDeferredCleanup(fixture.device);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});

test('mechanical proposal filters genuine multi-level apply and caches the level write', async () => {
  const fixture = liveFixture(2, { minLevel: 0, maxLevel: 1 });
  const proposal = runSchroederSpatialMechanicalProposalWebGpu(fixture);
  assert.equal(proposal.uniformQueryLevel, null);
  assert.equal(
    proposal.applyLevelFilterPolicy,
    'filter-authenticated-multi-level-assignment'
  );
  const apply = (selectedLevel) => proposal.encodeApply(
    fixture.device.createCommandEncoder(),
    {
      stateBuffer: fixture.sphParticleUpload.stateBuffer,
      mechanicsBuffer: fixture.mlsMpmParticleUpload.mechanicsBuffer,
      selectedLevel
    }
  );
  const selectedLevelWrites = () => fixture.device.writes.filter(
    ({ buffer, offset }) => String(buffer?.label || '').startsWith(
      'ulg-schroeder-spatial-mechanical-params-'
    ) && offset === 44
  );

  assert.equal(apply(1), true);
  assert.equal(selectedLevelWrites().length, 1);
  assert.equal(new DataView(
    selectedLevelWrites()[0].bytes.buffer,
    selectedLevelWrites()[0].bytes.byteOffset,
    selectedLevelWrites()[0].bytes.byteLength
  ).getInt32(0, true), 1);
  assert.equal(apply(1), true);
  assert.equal(selectedLevelWrites().length, 1);
  assert.equal(apply(0), true);
  assert.equal(selectedLevelWrites().length, 2);
  assert.equal(new DataView(
    selectedLevelWrites()[1].bytes.buffer,
    selectedLevelWrites()[1].bytes.byteOffset,
    selectedLevelWrites()[1].bytes.byteLength
  ).getInt32(0, true), 0);

  assert.equal(proposal.releaseAfterSubmittedWork(), true);
  await settleDeferredCleanup(fixture.device);
  destroySchroederSpatialMechanicalProposalRuntime(fixture.device);
});
