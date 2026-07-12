import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SPH_GPU_REACTION_ADMITTED_OUTCOME_ABI,
  SPH_GPU_REACTION_ADMITTED_OUTCOME_READY_MAGIC,
  SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_ABI,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  SPH_REACTION_PRODUCT_EVENT_PLACEMENT_CANDIDATE_WORDS,
  SPH_REACTION_ADMITTED_OUTCOME_BYTES_PER_PARTICLE,
  SPH_REACTION_PRODUCT_EVENT_FLOATS,
  ULG_SPH_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_SCHEMA,
  createSphReactionProductEventPlacementWorkspaceGpu,
  createSphReactionProductEventWebGpuEncoderStage,
  maxProductTermsPerReaction,
  sphReactionProductEventCapacityRows
} from '../src/runtime/sph/sphReactionProductEventGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function fakeDevice() {
  const buffers = [];
  const writes = [];
  const submissions = [];
  const passes = [];
  const clears = [];
  return {
    buffers,
    writes,
    submissions,
    passes,
    clears,
    limits: {
      maxBufferSize: 1 << 28,
      maxStorageBufferBindingSize: 1 << 28,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      },
      submit(commands) {
        submissions.push(commands);
      }
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) { return { index }; }
      };
    },
    createBindGroup(descriptor) { return descriptor; }
  };
}

function commandEncoder(device) {
  return {
    clearBuffer(buffer, offset = 0, size = buffer.size - offset) {
      device.clears.push({ buffer, offset, size });
    },
    beginComputePass(descriptor = {}) {
      const passRecord = { descriptor };
      device.passes.push(passRecord);
      return {
        setPipeline(pipeline) { passRecord.pipeline = pipeline; },
        setBindGroup(index, bindGroup) { passRecord.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) { passRecord.dispatch = [x, y, z]; },
        dispatchWorkgroupsIndirect(buffer, offset) {
          passRecord.indirectDispatch = { buffer, offset };
        },
        end() { passRecord.ended = true; }
      };
    }
  };
}

function buffer(device, label, size) {
  return tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 }), device);
}

function fixture(device) {
  const particleCount = 2;
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(particleCount * SPH_GPU_PARTICLE_STATE_FLOATS),
      thermo: new Float32Array(particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS)
    },
    reactionTable: {
      schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
      reactionCount: 1,
      productPhaseCount: 2,
      reactantTermCount: 2,
      productTermCount: 2,
      gasProductCount: 1,
      atomTermCount: 4
    },
    sourceStateBuffer: buffer(
      device,
      'source-state',
      particleCount * SPH_GPU_PARTICLE_STATE_FLOATS * 4
    ),
    sourceThermoBuffer: buffer(
      device,
      'source-thermo',
      particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * 4
    ),
    nextStateBuffer: buffer(
      device,
      'next-state',
      particleCount * SPH_GPU_PARTICLE_STATE_FLOATS * 4
    ),
    nextThermoBuffer: buffer(
      device,
      'next-thermo',
      particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * 4
    ),
    nextMechanicsBuffer: buffer(
      device,
      'next-mechanics',
      particleCount * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS * 4
    ),
    reactionRecordBuffer: buffer(device, 'reaction-records', 1024),
    proposalBuffer: buffer(device, 'reaction-proposals', particleCount * 16)
  };
}

test('reaction product events use resident-or-bounded search and parallel deterministic claims', () => {
  assert.equal(
    SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_ABI.protocol,
    'parallel-deterministic-exact-prefix-atomic-claims-v3'
  );
  assert.equal(
    SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_ABI.ownershipPolicy,
    'atomic-max-inverted-event-key-lowest-event-index'
  );
  assert.equal(
    SPH_GPU_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_ABI.conflictPolicy,
    'loser-event-remains-live'
  );
  assert.equal(SPH_GPU_REACTION_ADMITTED_OUTCOME_ABI.strideWords, 8);
  assert.equal(SPH_GPU_REACTION_ADMITTED_OUTCOME_READY_MAGIC, 0x4f555443);
  assert.equal(SPH_GPU_REACTION_ADMITTED_OUTCOME_ABI.ownerPolicy,
    'canonical-lower-particle-index-of-mutual-pair');
  const device = fakeDevice();
  const timestampLabels = [];
  const stage = createSphReactionProductEventWebGpuEncoderStage({
    device,
    commandEncoder: commandEncoder(device),
    ...fixture(device),
    dtSeconds: 1e-4,
    timestampProfiler: {
      beginComputePassDescriptor(label, metadata) {
        timestampLabels.push({ label, metadata });
        return { label };
      }
    }
  });
  assert.equal(stage.status, 'reaction-product-events-and-carriers-encoded');
  assert.equal(stage.queueSubmitPerformed, false);
  assert.equal(stage.mapPerformed, false);
  assert.equal(stage.readbackPerformed, false);
  assert.equal(stage.normalHotLoopReadbackFree, true);
  assert.equal(device.submissions.length, 0);
  assert.equal(stage.productEventRowCount, 2);
  assert.equal(stage.productEventBufferCapacityRows, 2);
  assert.equal(stage.productEventExactCountAuthority, 'gpu-prefix-metadata-word-6');
  assert.equal(stage.downstreamWorkPolicy, 'gpu-authored-exact-prefix-dispatch-indirect');
  assert.equal(stage.productEventStrideFloats, SPH_REACTION_PRODUCT_EVENT_FLOATS);
  assert.equal(stage.productEventBufferByteLength, 2 * SPH_REACTION_PRODUCT_EVENT_FLOATS * 4);
  const entryPoints = device.passes.map((pass) => pass.pipeline.compute.entryPoint);
  assert.deepEqual(entryPoints.filter((entryPoint) => entryPoint.startsWith('count_')), [
    'count_live_product_events'
  ]);
  assert.equal(entryPoints.includes('count_potential_product_events'), false);
  assert.deepEqual(entryPoints.slice(-3), [
    'find_product_event_carriers',
    'claim_product_event_carriers',
    'place_product_events'
  ]);
  assert.equal(entryPoints.includes('initialize_product_event_carrier_claims'), false);
  assert.equal(device.passes.filter((pass) => pass.indirectDispatch).length, 4);
  assert.equal(device.clears.length, 1);
  assert.equal(device.clears[0].size, stage.productEventPlacementCandidateBufferByteLength);
  assert.ok(timestampLabels.some(({ label }) => label === 'reactionProductEventExactCount'));
  assert.ok(timestampLabels.some(({ label }) => label === 'reactionProductEventEmitExactPrefix'));
  const eventShader = device.passes.find((pass) => (
    pass.pipeline.compute.entryPoint === 'emit_live_product_events'
  )).pipeline.compute.module.code;
  assert.match(eventShader, /source_particle_for_event/);
  assert.match(eventShader, /atomicLoad\(&prefix_metadata\[6\]\)/);
  assert.match(eventShader, /outcome\.product_term_offset \+ local/);
  assert.match(eventShader, /@binding\(12\) var<storage, read> reaction_outcomes/);
  assert.match(eventShader, /fn admitted_reaction_outcome/);
  assert.match(eventShader,
    /atomicLoad\(&prefix_metadata\[18\]\) == params\.generation_id/);
  assert.match(eventShader,
    /atomicLoad\(&prefix_metadata\[19\]\) == REACTION_ADMITTED_OUTCOME_READY_MAGIC/);
  assert.doesNotMatch(eventShader, /fn interface_flux_extent_cap_mol/);
  assert.doesNotMatch(eventShader, /fn reactant_term_for_material/);
  assert.equal(stage.reactionOutcomeBuffer,
    stage.productEventPlacementWorkspace.reactionOutcomeBuffer);
  assert.equal(stage.reactionOutcomeBufferByteLength,
    2 * SPH_REACTION_ADMITTED_OUTCOME_BYTES_PER_PARTICLE);
  assert.equal(stage.reactionChemistryEvaluationPolicy,
    'resolve-publishes-admitted-outcome-count-and-emit-consume-without-extent-recompute');
  const placementShader = device.passes.at(-1).pipeline.compute.module.code;
  assert.match(placementShader, /fn initialize_product_event_carrier_claims/);
  assert.match(placementShader, /@compute @workgroup_size\(64\)\s*fn find_product_event_carriers/);
  assert.match(placementShader, /fn resident_product_placement_valid\(\) -> bool/);
  assert.match(placementShader, /resident_neighborhood\[8\]/);
  assert.match(placementShader, /PRODUCT_EVENT_SPARE_PROBE_LIMIT: u32 = 64u/);
  assert.doesNotMatch(
    placementShader,
    /for \(var candidate = 0u; candidate < params\.particle_count/
  );
  assert.match(placementShader, /fn claim_product_event_carriers/);
  assert.match(placementShader,
    /atomicMax\(&placement_workspace\[claim_word\], PRODUCT_EVENT_NO_CARRIER - event\)/);
  assert.match(placementShader,
    /atomicLoad\(&placement_workspace\[claim_word\]\) != PRODUCT_EVENT_NO_CARRIER - event/);
  assert.match(placementShader, /@compute @workgroup_size\(64\)\s*fn place_product_events/);
  assert.doesNotMatch(placementShader, /@compute @workgroup_size\(1\)\s*fn place_product_events/);
  assert.match(placementShader, /product_events\[base \+ 4u\] = vec4<f32>\(row4\.x, row4\.y, 0\.0, row4\.w\)/);
  assert.equal(stage.carrierPlacementCandidateSearchEncoded, true);
  assert.equal(stage.carrierPlacementCandidateSelection,
    'resident-csr-or-bounded-probe-target-with-stable-lowest-event-atomic-ownership');
  assert.equal(stage.carrierPlacementSearchMode, 'bounded-deterministic-compatibility-probe');
  assert.equal(stage.carrierPlacementApplyOrdering, 'parallel-disjoint-target-single-writer');
  assert.equal(stage.carrierPlacementConflictPolicy,
    'lowest-event-index-wins-target-conflicts-losers-remain-live-in-event-ledger');
  assert.equal(stage.carrierPlacementProbeLimit, 64);
  assert.equal(stage.productEventPlacementWorkspaceOwned, true);
  assert.equal(stage.productEventPlacementWorkspaceBorrowed, false);
  assert.equal(stage.productEventPlacementCandidateBufferByteLength,
    (2 + 2) * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(stage.residentProductMass.productEventBuffer, stage.productEventBuffer);
  stage.cleanupSubmittedWork({ destroyProductEvents: false });
  assert.equal(stage.productEventPlacementWorkspace.destroyed, false);
  assert.equal(
    device.buffers.find((entry) => entry.label.endsWith('placement-neighborhood-disabled')).destroyed,
    false
  );
  assert.equal(stage.productEventBuffer.destroyed, false);
  stage.cleanupSubmittedWork({ destroyProductEvents: true });
  assert.equal(stage.productEventPlacementWorkspace.destroyed, true);
  assert.equal(
    device.buffers.find((entry) => entry.label.endsWith('placement-neighborhood-disabled')).destroyed,
    true
  );
  assert.equal(stage.productEventBuffer.destroyed, true);
});

test('caller-owned carrier candidate workspace is reused without per-stage candidate allocation', () => {
  const device = fakeDevice();
  const workspace = createSphReactionProductEventPlacementWorkspaceGpu(device, {
    eventCapacityRows: 8,
    particleCapacity: 2,
    label: 'shared-placement'
  });
  assert.equal(workspace.schema, ULG_SPH_REACTION_PRODUCT_EVENT_PLACEMENT_WORKSPACE_SCHEMA);
  assert.equal(
    workspace.allocationPolicy,
    'caller-owned-reusable-resolve-outcome-exact-prefix-count-scan-event-and-claim-workspace'
  );
  assert.equal(workspace.candidateBufferByteLength,
    (8 + 2) * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(workspace.reactionOutcomeBufferByteLength,
    2 * SPH_REACTION_ADMITTED_OUTCOME_BYTES_PER_PARTICLE);
  const sharedFixture = fixture(device);
  const first = createSphReactionProductEventWebGpuEncoderStage({
    device,
    commandEncoder: commandEncoder(device),
    ...sharedFixture,
    productEventPlacementWorkspace: workspace
  });
  const second = createSphReactionProductEventWebGpuEncoderStage({
    device,
    commandEncoder: commandEncoder(device),
    ...sharedFixture,
    productEventPlacementWorkspace: workspace
  });
  assert.equal(first.productEventPlacementWorkspace, workspace);
  assert.equal(second.productEventPlacementWorkspace, workspace);
  assert.equal(first.productEventPlacementWorkspaceBorrowed, true);
  assert.equal(second.productEventPlacementWorkspaceBorrowed, true);
  assert.equal(device.buffers.filter((entry) => entry.label === 'shared-placement-candidates').length, 1);
  assert.equal(device.buffers.filter(
    (entry) => entry.label === 'shared-placement-summary-params-arena'
  ).length, 1);
  assert.equal(device.buffers.filter(
    (entry) => entry.label === 'shared-placement-placement-params-arena'
  ).length, 1);
  assert.equal(device.buffers.some(
    (entry) => /product-event-(admission-)?params-\d+$/.test(entry.label)
  ), false);
  assert.equal(Object.values(first.productEventBindGroupCacheHits).every(
    (cacheHit) => cacheHit === false
  ), true);
  assert.equal(Object.values(second.productEventBindGroupCacheHits).every(
    (cacheHit) => cacheHit === true
  ), true);
  assert.deepEqual(workspace.bindGroupCacheEvidence(), {
    creationCount: 8,
    reuseCount: 8,
    entryCount: 8
  });
  first.cleanupSubmittedWork({ destroyProductEvents: true });
  second.cleanupSubmittedWork({ destroyProductEvents: true });
  assert.equal(workspace.destroyed, false);
  assert.equal(first.productEventBuffer, second.productEventBuffer);
  assert.equal(device.buffers.filter((entry) => entry.label === 'shared-placement-exact-live-rows').length, 1);
  assert.equal(workspace.destroy(), true);
  assert.equal(workspace.candidateBuffer.destroyed, true);
  assert.equal(workspace.reactionOutcomeBuffer.destroyed, true);
});

test('admitted resident neighborhood is bound without compatibility allocation or readback', () => {
  const device = fakeDevice();
  const residentBuffer = buffer(device, 'resident-neighborhood', 1024);
  const residentNeighborhoodAdmission = {
    admitted: true,
    packedCandidateCsrBuffer: residentBuffer,
    expectedIdentity: {
      generation: 7,
      leaseTokenLow: 11,
      leaseTokenHigh: 13,
      positionEpoch: 17,
      sourceCount: 2,
      consumerBit: 1 << 4
    }
  };
  const stage = createSphReactionProductEventWebGpuEncoderStage({
    device,
    commandEncoder: commandEncoder(device),
    ...fixture(device),
    residentNeighborhoodAdmission
  });
  assert.equal(
    stage.carrierPlacementSearchMode,
    'resident-neighborhood-packed-csr-plus-bounded-spare-probe'
  );
  assert.equal(device.buffers.filter(
    (entry) => entry.label.endsWith('placement-neighborhood-disabled')
  ).length, 1);
  const searchEntries = device.passes.find((pass) => (
    pass.pipeline.compute.entryPoint === 'find_product_event_carriers'
  )).bindGroup.bindGroup.entries;
  assert.equal(searchEntries.find((entry) => entry.binding === 6).resource.buffer, residentBuffer);
  assert.equal(device.writes.some((entry) => entry.byteLength === 64), true);
  assert.equal(stage.readbackPerformed, false);
  stage.cleanupSubmittedWork({ destroyProductEvents: true });
  assert.equal(residentBuffer.destroyed, false);
});

test('reaction product-event producer fails closed across device and capacity mismatches', () => {
  const constrainedWorkspaceDevice = fakeDevice();
  constrainedWorkspaceDevice.limits.maxBufferSize = 128;
  constrainedWorkspaceDevice.limits.maxStorageBufferBindingSize = 128;
  assert.throws(() => createSphReactionProductEventPlacementWorkspaceGpu(
    constrainedWorkspaceDevice,
    { eventCapacityRows: 17 }
  ), /workspace requires 2176 bytes beyond device capacity/);
  assert.throws(() => createSphReactionProductEventPlacementWorkspaceGpu(
    fakeDevice(),
    { eventCapacityRows: 0x8000_0000 }
  ), /exceeds uint32 workspace indexing capacity/);

  const device = fakeDevice();
  const foreignDevice = fakeDevice();
  const values = fixture(device);
  values.sourceStateBuffer = buffer(
    foreignDevice,
    'foreign-source-state',
    2 * SPH_GPU_PARTICLE_STATE_FLOATS * 4
  );
  assert.throws(() => createSphReactionProductEventWebGpuEncoderStage({
    device,
    commandEncoder: commandEncoder(device),
    ...values
  }), /sourceStateBuffer device mismatch/);

  const constrained = fakeDevice();
  constrained.limits.maxBufferSize = 128;
  constrained.limits.maxStorageBufferBindingSize = 128;
  assert.throws(() => createSphReactionProductEventWebGpuEncoderStage({
    device: constrained,
    commandEncoder: commandEncoder(constrained),
    ...fixture(constrained)
  }), /beyond device capacity/);
  assert.equal(constrained.submissions.length, 0);

  const workspaceDevice = fakeDevice();
  const undersizedWorkspace = createSphReactionProductEventPlacementWorkspaceGpu(
    workspaceDevice,
    { eventCapacityRows: 1, particleCapacity: 2 }
  );
  assert.throws(() => createSphReactionProductEventWebGpuEncoderStage({
    device: workspaceDevice,
    commandEncoder: commandEncoder(workspaceDevice),
    ...fixture(workspaceDevice),
    productEventPlacementWorkspace: undersizedWorkspace
  }), /capacity 1 is smaller than 2/);
  const otherWorkspaceDevice = fakeDevice();
  const foreignWorkspace = createSphReactionProductEventPlacementWorkspaceGpu(
    otherWorkspaceDevice,
    { eventCapacityRows: 2, particleCapacity: 2 }
  );
  assert.throws(() => createSphReactionProductEventWebGpuEncoderStage({
    device: workspaceDevice,
    commandEncoder: commandEncoder(workspaceDevice),
    ...fixture(workspaceDevice),
    productEventPlacementWorkspace: foreignWorkspace
  }), /PlacementWorkspace device mismatch/);

  const rejectedNeighborhoodDevice = fakeDevice();
  assert.throws(() => createSphReactionProductEventWebGpuEncoderStage({
    device: rejectedNeighborhoodDevice,
    commandEncoder: commandEncoder(rejectedNeighborhoodDevice),
    ...fixture(rejectedNeighborhoodDevice),
    residentNeighborhoodAdmission: { admitted: false }
  }), /resident neighborhood was not admitted/);

  const mismatchedNeighborhoodDevice = fakeDevice();
  const foreignNeighborhoodDevice = fakeDevice();
  assert.throws(() => createSphReactionProductEventWebGpuEncoderStage({
    device: mismatchedNeighborhoodDevice,
    commandEncoder: commandEncoder(mismatchedNeighborhoodDevice),
    ...fixture(mismatchedNeighborhoodDevice),
    residentNeighborhoodAdmission: {
      admitted: true,
      packedCandidateCsrBuffer: buffer(foreignNeighborhoodDevice, 'foreign-neighborhood', 1024),
      expectedIdentity: { sourceCount: 2, consumerBit: 1 << 4 }
    }
  }), /packedCandidateCsrBuffer device mismatch/);
});

test('300k sparse reaction domain uses one reusable bounded event workspace and exact indirect work', () => {
  const particleCount = 300_000;
  const reactionCount = 100;
  const productTermCount = 200;
  const reactionHeaders = new Float32Array(reactionCount * 16);
  for (let reaction = 0; reaction < reactionCount; reaction += 1) {
    reactionHeaders[reaction * 16] = reaction;
    reactionHeaders[reaction * 16 + 3] = reaction * 2;
    reactionHeaders[reaction * 16 + 4] = 2;
    reactionHeaders[reaction * 16 + 10] = 1;
  }
  const reactionTable = {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount,
    reactionHeaderStrideFloats: 16,
    reactionHeaders,
    productPhaseCount: 4,
    reactantTermCount: 200,
    productTermCount,
    gasProductCount: 50,
    atomTermCount: 400
  };
  assert.equal(maxProductTermsPerReaction(reactionTable), 2);
  const capacityRows = sphReactionProductEventCapacityRows({ particleCount, reactionTable });
  assert.equal(capacityRows, 300_000);
  assert.equal(capacityRows * SPH_REACTION_PRODUCT_EVENT_FLOATS * 4, 38_400_000);
  assert.equal(particleCount * productTermCount, 60_000_000);
  assert.equal(particleCount * productTermCount * SPH_REACTION_PRODUCT_EVENT_FLOATS * 4,
    7_680_000_000);
  assert.equal(capacityRows * 2 * SPH_REACTION_PRODUCT_EVENT_FLOATS * 4, 76_800_000);

  const device = fakeDevice();
  device.limits.maxBufferSize = 1 << 30;
  device.limits.maxStorageBufferBindingSize = 1 << 30;
  const workspace = createSphReactionProductEventPlacementWorkspaceGpu(device, {
    eventCapacityRows: capacityRows,
    particleCapacity: particleCount,
    label: 'sodium-water-300k-shared-events'
  });
  const sharedInputs = {
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      state: new Float32Array(),
      thermo: new Float32Array()
    },
    reactionTable,
    sourceStateBuffer: buffer(
      device,
      'large-source-state',
      particleCount * SPH_GPU_PARTICLE_STATE_FLOATS * 4
    ),
    sourceThermoBuffer: buffer(
      device,
      'large-source-thermo',
      particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * 4
    ),
    nextStateBuffer: buffer(
      device,
      'large-next-state',
      particleCount * SPH_GPU_PARTICLE_STATE_FLOATS * 4
    ),
    nextThermoBuffer: buffer(
      device,
      'large-next-thermo',
      particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS * 4
    ),
    reactionRecordBuffer: buffer(device, 'large-reaction-records', 1 << 20),
    proposalBuffer: buffer(device, 'large-proposals', particleCount * 16),
    productEventPlacementWorkspace: workspace,
    placeProductEvents: false
  };
  const first = createSphReactionProductEventWebGpuEncoderStage({
    ...sharedInputs,
    commandEncoder: commandEncoder(device)
  });
  const second = createSphReactionProductEventWebGpuEncoderStage({
    ...sharedInputs,
    commandEncoder: commandEncoder(device)
  });
  assert.equal(first.productEventBuffer, workspace.productEventBuffer);
  assert.equal(second.productEventBuffer, workspace.productEventBuffer);
  assert.equal(first.productEventBuffer, second.productEventBuffer);
  assert.equal(first.productEventBufferByteLength, 38_400_000);
  assert.equal(workspace.reactionOutcomeBufferByteLength, 9_600_000);
  assert.equal(first.denseCandidateRowCountAvoided, 60_000_000);
  assert.equal(first.denseCandidateByteLengthAvoidedExact, '7680000000');
  assert.equal(first.productEventExactLiveByteLength, null);
  assert.equal(first.productEventExactLiveByteLengthAuthority,
    'gpu-prefix-metadata-word-6-times-128-bytes-per-event');
  assert.equal(first.downstreamWorkPolicy, 'gpu-authored-exact-prefix-dispatch-indirect');
  assert.equal(first.queueSubmitPerformed, false);
  assert.equal(first.readbackPerformed, false);
  assert.equal(second.readbackPerformed, false);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.buffers.filter(
    ({ label }) => label === 'sodium-water-300k-shared-events-exact-live-rows'
  ).length, 1);
  assert.ok(workspace.totalByteLength < 55_000_000);
  const emitPasses = device.passes.filter(
    (pass) => pass.pipeline.compute.entryPoint === 'emit_live_product_events'
  );
  assert.equal(emitPasses.length, 2);
  assert.ok(emitPasses.every((pass) => pass.indirectDispatch?.buffer
    === workspace.prefixDispatchIndirectBuffer));
  first.cleanupSubmittedWork({ destroyProductEvents: true });
  second.cleanupSubmittedWork({ destroyProductEvents: true });
  assert.equal(workspace.destroyed, false);
  workspace.destroy();
});
