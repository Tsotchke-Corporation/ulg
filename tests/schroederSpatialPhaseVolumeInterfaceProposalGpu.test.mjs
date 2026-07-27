import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS,
  ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA,
  createSchroederSpatialPhaseVolumeInterfaceProposalLayout,
  createSchroederSpatialPhaseVolumeInterfaceProposalPlan,
  validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposal.js';
import {
  createSchroederSpatialPhaseVolumeInterfaceProposalWgsl
} from '../ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposalWgsl.js';
import {
  createSchroederSpatialMechanicsFieldViewPlan
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js';
import {
  createSchroederSpatialParentFieldViewLayout
} from '../ulg-gpu-abi/src/schroederSpatialParentFieldView.js';
import {
  createSchroederSpatialPhaseVolumeMomentGpu
} from '../src/runtime/sph/schroederSpatialPhaseVolumeMomentGpu.js';
import {
  createSchroederSpatialPhaseVolumeReceiptGpu
} from '../src/runtime/sph/schroederSpatialPhaseVolumeReceiptGpu.js';
import {
  createSchroederSpatialPhaseVolumeInterfaceProposalGpu
} from '../src/runtime/sph/schroederSpatialPhaseVolumeInterfaceProposalGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PHASE_VOLUME_INTERFACE === '1';
const NATIVE_BASE_URL = process.env.ULG_PHASE_VOLUME_INTERFACE_BASE_URL
  || 'https://127.0.0.1:5174/';

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  promise.catch(() => {});
  return { promise, resolve };
}

function createFakeDevice() {
  const createdBuffers = [];
  const shaderModules = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const lost = deferred();
  const device = {
    lost: lost.promise,
    limits: {
      maxStorageBuffersPerShaderStage: 8,
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) { writes.push({ buffer, offset, data }); }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyCount: 0,
        get destroyed() { return this.destroyCount > 0; },
        destroy() { this.destroyCount += 1; }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      const module = { descriptor };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline(descriptor) {
      const pipeline = {
        descriptor,
        getBindGroupLayout() { return { entryPoint: descriptor.compute.entryPoint }; }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      const group = { descriptor };
      bindGroups.push(group);
      return group;
    }
  };
  return {
    device,
    createdBuffers,
    shaderModules,
    pipelines,
    bindGroups,
    writes,
    resolveLost: lost.resolve
  };
}

function createFakeEncoder() {
  const clears = [];
  const passes = [];
  return {
    clears,
    passes,
    clearBuffer(buffer) { clears.push(buffer); },
    beginComputePass(descriptor = {}) {
      const pass = {
        descriptor,
        pipeline: null,
        bindGroup: null,
        dispatch: null,
        indirect: null,
        ended: false,
        setPipeline(value) { this.pipeline = value; },
        setBindGroup(index, value) { this.bindGroup = { index, value }; },
        dispatchWorkgroups(...value) { this.dispatch = value; },
        dispatchWorkgroupsIndirect(buffer, offset) { this.indirect = { buffer, offset }; },
        end() { this.ended = true; }
      };
      passes.push(pass);
      return pass;
    }
  };
}

function taggedBuffer(device, label, size) {
  return tagWebGpuBufferDevice({
    label,
    size,
    destroyCount: 0,
    destroy() { this.destroyCount += 1; }
  }, device);
}

function createAuthority(device, {
  sourceCount = 2,
  sourceCapacity = 4,
  fieldCapacity = 12,
  selectedLevel = 0
} = {}) {
  const sourceBuffer = taggedBuffer(
    device,
    `interface-source-assignment-${selectedLevel}`,
    sourceCount * 16 * Float32Array.BYTES_PER_ELEMENT
  );
  const sourceMechanicsBuffer = taggedBuffer(
    device,
    `interface-source-mechanics-${selectedLevel}`,
    sourceCount * 32 * Float32Array.BYTES_PER_ELEMENT
  );
  const plan = createSchroederSpatialMechanicsFieldViewPlan({
    sourceCount,
    sourceCapacity,
    fieldCapacity,
    sourceRowLayoutId: 1,
    identityStrideWords: 1,
    selectedLevel,
    gridNodeCount: 8,
    gridDims: [2, 2, 2],
    gridShift: 1,
    gridSpacingM: 0.25,
    generationId: 31,
    deviceOrdinal: 5,
    laneOrdinal: 7,
    leaseToken: 11,
    sourceFamilyId: 13,
    storageGeneration: 17,
    physicsTick: 19,
    physicsSubstep: 0,
    positionEpoch: 23,
    topologyEpoch: 29,
    chartEpoch: 37,
    levelEpoch: 41,
    supportEpoch: 43,
    completionOrdinal: 47
  });
  const fieldViewBuffer = taggedBuffer(
    device,
    `interface-mechanics-field-${selectedLevel}`,
    plan.layout.byteLength
  );
  const stableCandidateOrderBuffer = taggedBuffer(
    device,
    `interface-stable-candidate-order-${selectedLevel}`,
    plan.candidateCount * Uint32Array.BYTES_PER_ELEMENT
  );
  const submitted = new WeakSet();
  let field;
  const fieldOwnerRuntime = {
    ownsExecution(candidate) { return candidate === field; },
    isExecutionSubmitted(candidate) { return submitted.has(candidate); },
    markExecutionSubmitted(candidate) {
      if (candidate !== field) throw new Error('foreign mechanics-field view');
      submitted.add(candidate);
      field.submitPerformed = true;
      field.status = 'schroeder-spatial-mechanics-field-view-gpu-build-submitted';
      return true;
    }
  };
  field = {
    ...plan,
    status: 'schroeder-spatial-mechanics-field-view-gpu-encoded',
    submitPerformed: false,
    released: false,
    sourceBuffer,
    fieldViewBuffer,
    indirectDispatchBuffer: fieldViewBuffer,
    indirectDispatchOffsetBytes: 240,
    stableCandidateOrderBuffer,
    stableCandidateOrderCount: plan.candidateCount
  };
  Object.defineProperty(field, 'ownerRuntime', {
    value: fieldOwnerRuntime,
    enumerable: false
  });
  return { sourceBuffer, sourceMechanicsBuffer, field, fieldOwnerRuntime, plan };
}

function buildReceipt(device, authority) {
  const momentRuntime = createSchroederSpatialPhaseVolumeMomentGpu(device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity
  });
  const moment = momentRuntime.encode(createFakeEncoder(), {
    sourceBuffer: authority.sourceBuffer,
    sourceMechanicsBuffer: authority.sourceMechanicsBuffer,
    sourceMechanicsBufferBorrowed: true,
    mechanicsFieldView: authority.field
  });
  const receiptRuntime = createSchroederSpatialPhaseVolumeReceiptGpu(device, {
    maxSourceCount: authority.plan.sourceCapacity,
    fieldCapacity: authority.plan.fieldCapacity
  });
  const receipt = receiptRuntime.encode(createFakeEncoder(), { phaseVolumeMoment: moment });
  return { momentRuntime, moment, receiptRuntime, receipt };
}

function createParentAuthority(device, fineReceipt, coarseReceipt, completionOrdinal = 59) {
  const layout = createSchroederSpatialParentFieldViewLayout({
    fineFieldCapacity: fineReceipt.fieldCapacity,
    coarseFieldCapacity: coarseReceipt.fieldCapacity
  });
  const parentFieldViewBuffer = taggedBuffer(
    device,
    'interface-parent-field-view',
    layout.byteLength
  );
  const submitted = new WeakSet();
  let parent;
  const ownerRuntime = {
    ownsExecution(candidate) { return candidate === parent; },
    isExecutionSubmitted(candidate) { return submitted.has(candidate); },
    markExecutionSubmitted(candidate) {
      if (candidate !== parent) throw new Error('foreign parent-field view');
      submitted.add(candidate);
      parent.submitPerformed = true;
      parent.status = 'schroeder-spatial-parent-field-view-gpu-build-submitted';
    }
  };
  parent = {
    generationId: fineReceipt.generationId,
    deviceOrdinal: fineReceipt.deviceOrdinal,
    laneOrdinal: fineReceipt.laneOrdinal,
    leaseToken: fineReceipt.leaseToken,
    sourceFamilyId: fineReceipt.sourceFamilyId,
    storageGeneration: fineReceipt.storageGeneration,
    physicsTick: fineReceipt.physicsTick,
    physicsSubstep: fineReceipt.physicsSubstep,
    positionEpoch: fineReceipt.positionEpoch,
    topologyEpoch: fineReceipt.topologyEpoch,
    chartEpoch: fineReceipt.chartEpoch,
    levelEpoch: fineReceipt.levelEpoch,
    supportEpoch: fineReceipt.supportEpoch,
    schema: 'peercompute.ulg.schroeder-spatial-parent-field-view.v1',
    status: 'schroeder-spatial-parent-field-view-gpu-encoded',
    submitPerformed: false,
    completionOrdinal,
    fineLevel: fineReceipt.selectedLevel,
    coarseLevel: coarseReceipt.selectedLevel,
    fineFieldView: fineReceipt.mechanicsFieldView,
    coarseFieldView: coarseReceipt.mechanicsFieldView,
    parentFieldViewBuffer,
    layout
  };
  Object.defineProperty(parent, 'ownerRuntime', { value: ownerRuntime, enumerable: false });
  Object.defineProperty(parent, 'released', { value: false, enumerable: true });
  return { parent, ownerRuntime };
}

test('S9-C ABI is capacity-dispatched and keeps live field counts GPU-only', () => {
  assert.equal(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_LAYOUT.length, 64);
  assert.equal(SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_HEADER_WORDS, 64);
  const layout = createSchroederSpatialPhaseVolumeInterfaceProposalLayout({
    fineFieldCapacity: 12,
    coarseFieldCapacity: 8
  });
  assert.equal(layout.localHeadCapacity, 20);
  assert.equal(layout.refluxRouteCapacity, 12);
  const plan = createSchroederSpatialPhaseVolumeInterfaceProposalPlan({
    fineFieldCapacity: 12,
    coarseFieldCapacity: 8,
    fineLevel: 0,
    coarseLevel: 1,
    hasParentFieldView: true,
    generationId: 1,
    deviceOrdinal: 2,
    laneOrdinal: 3,
    leaseToken: 4,
    sourceFamilyId: 5,
    storageGeneration: 6,
    physicsTick: 7,
    physicsSubstep: 8,
    positionEpoch: 9,
    topologyEpoch: 10,
    chartEpoch: 11,
    levelEpoch: 12,
    supportEpoch: 13,
    fineReceiptCompletionOrdinal: 14,
    coarseReceiptCompletionOrdinal: 15,
    parentFieldCompletionOrdinal: 16
  });
  assert.equal(plan.schema, ULG_SCHROEDER_SPATIAL_PHASE_VOLUME_INTERFACE_PROPOSAL_SCHEMA);
  assert.equal('fineFieldCount' in plan, false);
  assert.equal('coarseFieldCount' in plan, false);
  assert.equal(plan.fineLocalDispatchX, 1);
  assert.equal(plan.coarseLocalDispatchX, 1);
  assert.equal(plan.refluxRouteDispatchX, 1);
  assert.throws(
    () => createSchroederSpatialPhaseVolumeInterfaceProposalPlan({
      ...plan,
      coarseLevel: null
    }),
    /coarseLevel must be explicit/
  );
  assert.throws(
    () => createSchroederSpatialPhaseVolumeInterfaceProposalPlan({
      ...plan,
      hasParentFieldView: false
    }),
    /requires exactly one immutable parent-field route authority/
  );
  const wgsl = createSchroederSpatialPhaseVolumeInterfaceProposalWgsl(layout);
  assert.match(wgsl, /field_count\(&fine_field_view\)/);
  assert.doesNotMatch(wgsl, /params\.fine_field_count/);
  assert.match(wgsl, /emit_phase_volume_interface_reflux_routes/);
  assert.match(
    wgsl,
    /\(\*receipt\)\[29u\] == source_capacity_groups \+ 2u \* field_capacity_groups/
  );
  assert.match(
    wgsl,
    /fn field_dispatch_shape_admitted\([\s\S]*dispatch_y == expected_y[\s\S]*\(\*field_view\)\[44u\] == dispatch_x[\s\S]*\(\*field_view\)\[45u\] == dispatch_y[\s\S]*\(\*field_view\)\[46u\] == dispatch_z/
  );
  assert.match(
    wgsl,
    /field_dispatch_shape_admitted\(field_view, field_count\)/
  );
  assert.doesNotMatch(
    wgsl,
    /\(\*field_view\)\[60u\] == group_count\(field_count\)[\s\S]*\(\*field_view\)\[61u\] == 1u[\s\S]*\(\*field_view\)\[62u\] == 1u/
  );
});

test('S9-C one-level proposal is a read-only, same-encoder artifact with no host field count', () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const chain = buildReceipt(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeInterfaceProposalGpu(fixture.device, {
    fineFieldCapacity: authority.plan.fieldCapacity
  });
  const encoder = createFakeEncoder();
  const proposal = runtime.encode(encoder, { fineReceipt: chain.receipt });
  assert.equal(proposal.status, 'schroeder-spatial-phase-volume-interface-proposal-gpu-encoded');
  assert.equal(proposal.storageBindingCount, 6);
  assert.equal(proposal.distinctStorageResourceCount, 8);
  assert.equal(proposal.encodedComputePassCount, 2);
  assert.equal(proposal.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(proposal.readbackPerformed, false);
  assert.equal(proposal.stateMutationAllowed, false);
  assert.equal('fineFieldCount' in proposal, false);
  assert.equal(encoder.clears.length, 3);
  assert.equal(encoder.passes.length, 2);
  assert.deepEqual(encoder.passes[0].dispatch, [
    Math.ceil(proposal.fineFieldCapacity / 64),
    1,
    1
  ]);
  assert.equal(validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(proposal).admitted, true);
  assert.equal(chain.receipt.submitPerformed, false);
  assert.equal(chain.moment.submitPerformed, false);
  runtime.releaseExecution(proposal, { discardedEncoder: true });
  assert.equal(proposal.released, true);
  assert.equal(validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(proposal).admitted, false);
  assert.equal(runtime.destroy(), true);
});

test('S9-C two-level proposal requires exact CSR lineage and ordered parent submission', async () => {
  const fixture = createFakeDevice();
  const fineAuthority = createAuthority(fixture.device, { selectedLevel: 0 });
  const coarseAuthority = createAuthority(fixture.device, { selectedLevel: 1 });
  const fineChain = buildReceipt(fixture.device, fineAuthority);
  const coarseChain = buildReceipt(fixture.device, coarseAuthority);
  const parent = createParentAuthority(fixture.device, fineChain.receipt, coarseChain.receipt);
  const runtime = createSchroederSpatialPhaseVolumeInterfaceProposalGpu(fixture.device, {
    fineFieldCapacity: fineAuthority.plan.fieldCapacity,
    coarseFieldCapacity: coarseAuthority.plan.fieldCapacity
  });
  const proposal = runtime.encode(createFakeEncoder(), {
    fineReceipt: fineChain.receipt,
    coarseReceipt: coarseChain.receipt,
    parentFieldView: parent.parent
  });
  assert.equal(proposal.encodedComputePassCount, 3);
  assert.equal(proposal.hasParentFieldView, true);
  const routeBindGroup = fixture.bindGroups.find((group) => (
    group.descriptor.label.endsWith('-reflux-routes-bindings')
  ));
  assert.deepEqual(
    routeBindGroup.descriptor.entries.map((entry) => entry.binding),
    [1, 3, 4, 6, 7, 8]
  );
  assert.equal(validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(proposal).admitted, true);
  assert.throws(
    () => runtime.markExecutionSubmitted(proposal),
    /parents must be marked submitted/
  );
  fineChain.momentRuntime.markExecutionSubmitted(fineChain.moment);
  coarseChain.momentRuntime.markExecutionSubmitted(coarseChain.moment);
  fineChain.receiptRuntime.markExecutionSubmitted(fineChain.receipt);
  coarseChain.receiptRuntime.markExecutionSubmitted(coarseChain.receipt);
  parent.ownerRuntime.markExecutionSubmitted(parent.parent);
  assert.throws(
    () => runtime.markExecutionSubmitted(proposal),
    /parents must be marked submitted/
  );
  fineAuthority.fieldOwnerRuntime.markExecutionSubmitted(fineAuthority.field);
  coarseAuthority.fieldOwnerRuntime.markExecutionSubmitted(coarseAuthority.field);
  runtime.markExecutionSubmitted(proposal);
  assert.equal(validateSchroederSpatialPhaseVolumeInterfaceProposalDescriptor(proposal).admitted, true);
  await runtime.releaseExecutionAfter(proposal, Promise.resolve());
  assert.equal(proposal.released, true);
  assert.equal(runtime.destroy(), true);
});

test('S9-C rejects a foreign/stale receipt before it acquires an arena', () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const chain = buildReceipt(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeInterfaceProposalGpu(fixture.device, {
    fineFieldCapacity: authority.plan.fieldCapacity
  });
  const foreign = createFakeDevice();
  const foreignReceipt = { ...chain.receipt, controlBuffer: taggedBuffer(foreign.device, 'foreign-receipt-control', 256) };
  assert.throws(
    () => runtime.encode(createFakeEncoder(), { fineReceipt: foreignReceipt }),
    /exact live encoded S9-B artifact/
  );
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('S9-C device-loss retirement destroys only proposal-owned arena buffers', async () => {
  const fixture = createFakeDevice();
  const authority = createAuthority(fixture.device);
  const chain = buildReceipt(fixture.device, authority);
  const runtime = createSchroederSpatialPhaseVolumeInterfaceProposalGpu(fixture.device, {
    fineFieldCapacity: authority.plan.fieldCapacity
  });
  const proposal = runtime.encode(createFakeEncoder(), { fineReceipt: chain.receipt });
  const lossRetirement = runtime.quarantineExecutionAfterDeviceLoss(proposal);
  fixture.resolveLost({ reason: 'destroyed' });
  assert.equal(await lossRetirement, true);
  assert.equal(proposal.released, true);
  assert.equal(proposal.controlBuffer.destroyCount, 1);
  assert.equal(proposal.localHeadBuffer.destroyCount, 1);
  assert.equal(proposal.refluxRouteBuffer.destroyCount, 1);
  assert.equal(chain.receipt.controlBuffer.destroyCount, 0);
  assert.equal(chain.moment.controlBuffer.destroyCount, 0);
  assert.equal(authority.field.fieldViewBuffer.destroyCount, 0);
  assert.equal(runtime.destroy(), true);
  assert.equal(proposal.controlBuffer.destroyCount, 1);
});

test('native S9-C shader admits an authenticated local span and fails no WebGPU validation', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_INTERFACE=1 for native WebGPU topology execution',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_INTERFACE_CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      const nonce = Date.now();
      const abi = await import(
        `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposal.js?nativeInterface=${nonce}`
      );
      const wgslModule = await import(
        `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeInterfaceProposalWgsl.js?nativeInterface=${nonce}`
      );
      const fieldAbi = await import(
        `/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js?nativeInterface=${nonce}`
      );
      const layout = abi.createSchroederSpatialPhaseVolumeInterfaceProposalLayout({
        fineFieldCapacity: 27
      });
      const fieldLayout =
        fieldAbi.createSchroederSpatialMechanicsFieldViewLayout({
          sourceCapacity: 1,
          fieldCapacity: 27
        });
      const storageUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
      const storageBuffer = (size) => device.createBuffer({ size, usage: storageUsage });
      const fineReceipt = storageBuffer(64 * Uint32Array.BYTES_PER_ELEMENT);
      const fineField = storageBuffer(fieldLayout.byteLength);
      const dummy = storageBuffer(Uint32Array.BYTES_PER_ELEMENT);
      const localHeads = storageBuffer(layout.localHeadByteLength);
      const refluxRoutes = storageBuffer(layout.refluxRouteByteLength);
      const control = storageBuffer(layout.controlByteLength);
      const params = device.createBuffer({
        size: 192,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const generationId = 31;
      const completionOrdinal = 47;
      const admittedFlags = 3;
      const f32Bits = (value) => new Uint32Array(new Float32Array([value]).buffer)[0];
      const receipt = new Uint32Array(64);
      receipt[0] = 0x53505652;
      receipt[1] = 2;
      receipt[2] = admittedFlags;
      receipt[3] = generationId;
      receipt[4] = 5;
      receipt[5] = 7;
      receipt[6] = 11;
      receipt[7] = 13;
      receipt[8] = 17;
      receipt[9] = 19;
      receipt[11] = 23;
      receipt[12] = 29;
      receipt[13] = 37;
      receipt[14] = 41;
      receipt[15] = 43;
      receipt[16] = 1;
      receipt[17] = 1;
      receipt[18] = 3;
      receipt[19] = 27;
      receipt[20] = 27;
      receipt[22] = 27;
      receipt[23] = f32Bits(0.25);
      receipt[24] = 64;
      receipt[25] = 12;
      receipt[26] = completionOrdinal;
      receipt[27] = 1;
      receipt[28] = 1;
      receipt[29] = 3;
      receipt[30] = f32Bits(1);
      receipt[31] = f32Bits(1);
      receipt[37] = f32Bits(0.001);
      receipt[38] = f32Bits(0.001);
      receipt[39] = f32Bits(2);
      receipt[40] = f32Bits(8);
      receipt[47] = 1;
      receipt[48] = 27;
      receipt[49] = 32;
      receipt[50] = 18;
      receipt[51] = 19;
      receipt[54] = 1;
      receipt[56] = 1;
      receipt[57] = 1;
      receipt[58] = 64;
      receipt[59] = (0x53505652 ^ generationId ^ completionOrdinal ^ admittedFlags) >>> 0;
      device.queue.writeBuffer(fineReceipt, 0, receipt);
      const field = new Uint32Array(fieldLayout.wordLength);
      field[0] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
      field[1] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
      field[2] = admittedFlags;
      field[3] = generationId;
      field[4] = 5;
      field[5] = 7;
      field[6] = 11;
      field[7] = 13;
      field[8] = 17;
      field[9] = 19;
      field[11] = 23;
      field[12] = 29;
      field[13] = 37;
      field[14] = 41;
      field[15] = 43;
      field[16] = 1;
      field[18] = 27;
      field[19] = 3;
      field[20] = 3;
      field[21] = 3;
      field[22] = 1;
      field[23] = f32Bits(0.25);
      field[24] = 64;
      field[25] = 32;
      field[26] = fieldLayout.keyOffsetWords;
      field[27] = 4;
      field[28] = fieldLayout.accumulatorOffsetWords;
      field[29] = 8;
      field[30] = fieldLayout.stateOffsetWords;
      field[31] = 8;
      field[32] = 27;
      field[33] = 27;
      field[34] = 3;
      field[38] = completionOrdinal;
      field[39] = 1;
      field[40] = 1;
      // v5 required words bound the immutable pressure tail that follows the
      // full state-capacity bank, matching the mechanics-field producer.
      field[41] =
        fieldLayout.pressureOffsetWords
        + 3 * fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_PRESSURE_WORDS;
      field[42] = fieldLayout.wordLength;
      field[44] = 1;
      field[45] = 1;
      field[46] = 1;
      field[47] = 0x534d5631;
      field[48] = 1;
      field[49] = 27;
      field[50] = generationId;
      field[51] = 27;
      field[52] = 3;
      field[53] = 1;
      field[54] = 1;
      field[55] = 1;
      field[56] = 1;
      field[57] = 1;
      field[60] = 1;
      field[61] = 1;
      field[62] = 1;
      // Two fields share dense node 9, producing exactly one admitted span.
      field.set([9, 1, 1, 1], fieldLayout.keyOffsetWords);
      field.set([9, 1, 2, 1], fieldLayout.keyOffsetWords + 4);
      field.set([10, 1, 1, 1], fieldLayout.keyOffsetWords + 8);
      device.queue.writeBuffer(fineField, 0, field);
      const paramsWords = new Uint32Array(48);
      paramsWords[0] = 27;
      paramsWords[3] = 0x80000000;
      paramsWords[6] = generationId;
      paramsWords[7] = 5;
      paramsWords[8] = 7;
      paramsWords[9] = 11;
      paramsWords[10] = 13;
      paramsWords[11] = 17;
      paramsWords[12] = 19;
      paramsWords[14] = 23;
      paramsWords[15] = 29;
      paramsWords[16] = 37;
      paramsWords[17] = 41;
      paramsWords[18] = 43;
      paramsWords[19] = completionOrdinal;
      paramsWords[23] = 27 * 8;
      paramsWords[24] = 27;
      paramsWords[26] = 1;
      paramsWords[27] = 1;
      paramsWords[28] = 64;
      paramsWords[29] = 12;
      paramsWords[30] = 80;
      paramsWords[31] = 27 * 8;
      paramsWords[33] = 64;
      device.queue.writeBuffer(params, 0, paramsWords);
      device.pushErrorScope('validation');
      const fullShaderSource = wgslModule.createSchroederSpatialPhaseVolumeInterfaceProposalWgsl(layout);
      const shader = device.createShaderModule({
        code: fullShaderSource
      });
      const compilationInfo = await shader.getCompilationInfo();
      if (compilationInfo.messages.length > 0) {
        return {
          status: 'compilation-messages',
          messages: compilationInfo.messages.map((message) => ({
            type: message.type,
            message: message.message
          })),
          uncapturedErrors
        };
      }
      const localPipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shader, entryPoint: 'emit_phase_volume_interface_local_heads' }
      });
      const finalizePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shader, entryPoint: 'finalize_phase_volume_interface_proposal' }
      });
      const resources = new Map([
        [0, fineReceipt], [1, fineField], [2, dummy], [3, dummy], [4, dummy],
        [5, localHeads], [6, refluxRoutes], [7, control], [8, params]
      ]);
      const bindGroup = (pipeline, bindings) => device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: bindings.map((binding) => ({
          binding,
          resource: { buffer: resources.get(binding) }
        }))
      });
      const encoder = device.createCommandEncoder({ label: 'native-s9c-local-span' });
      encoder.clearBuffer(control);
      encoder.clearBuffer(localHeads);
      encoder.clearBuffer(refluxRoutes);
      let pass = encoder.beginComputePass();
      pass.setPipeline(localPipeline);
      pass.setBindGroup(0, bindGroup(localPipeline, [0, 1, 2, 3, 5, 7, 8]));
      pass.dispatchWorkgroups(1);
      pass.end();
      pass = encoder.beginComputePass();
      pass.setPipeline(finalizePipeline);
      pass.setBindGroup(0, bindGroup(finalizePipeline, [0, 1, 2, 3, 4, 7, 8]));
      pass.dispatchWorkgroups(1);
      pass.end();
      const readback = device.createBuffer({
        size: layout.controlByteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const localReadback = device.createBuffer({
        size: layout.localHeadByteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyBufferToBuffer(control, 0, readback, 0, layout.controlByteLength);
      encoder.copyBufferToBuffer(localHeads, 0, localReadback, 0, layout.localHeadByteLength);
      device.queue.submit([encoder.finish()]);
      try {
        await readback.mapAsync(GPUMapMode.READ);
        await localReadback.mapAsync(GPUMapMode.READ);
      } catch (error) {
        const lost = await device.lost.catch(() => null);
        return {
          status: 'map-failed',
          mapError: error instanceof Error ? error.message : String(error),
          deviceLost: lost ? {
            reason: lost.reason || null,
            message: lost.message || null
          } : null,
          uncapturedErrors
        };
      }
      const header = Array.from(new Uint32Array(readback.getMappedRange()).slice());
      const localRows = Array.from(new Uint32Array(localReadback.getMappedRange()).slice(0, 8));
      readback.unmap();
      localReadback.unmap();
      readback.destroy();
      localReadback.destroy();
      // S9-C must reject a receipt which claims an impossible selected
      // candidate subset even when its global scan counters remain valid.
      const corruptSelectedReceipt = receipt.slice();
      corruptSelectedReceipt[48] = 26;
      device.queue.writeBuffer(fineReceipt, 0, corruptSelectedReceipt);
      const rejectedEncoder = device.createCommandEncoder({
        label: 'native-s9c-rejected-selected-candidate-count'
      });
      rejectedEncoder.clearBuffer(control);
      rejectedEncoder.clearBuffer(localHeads);
      rejectedEncoder.clearBuffer(refluxRoutes);
      let rejectedPass = rejectedEncoder.beginComputePass();
      rejectedPass.setPipeline(localPipeline);
      rejectedPass.setBindGroup(0, bindGroup(localPipeline, [0, 1, 2, 3, 5, 7, 8]));
      rejectedPass.dispatchWorkgroups(1);
      rejectedPass.end();
      rejectedPass = rejectedEncoder.beginComputePass();
      rejectedPass.setPipeline(finalizePipeline);
      rejectedPass.setBindGroup(0, bindGroup(finalizePipeline, [0, 1, 2, 3, 4, 7, 8]));
      rejectedPass.dispatchWorkgroups(1);
      rejectedPass.end();
      const rejectedReadback = device.createBuffer({
        size: layout.controlByteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      rejectedEncoder.copyBufferToBuffer(
        control,
        0,
        rejectedReadback,
        0,
        layout.controlByteLength
      );
      device.queue.submit([rejectedEncoder.finish()]);
      await rejectedReadback.mapAsync(GPUMapMode.READ);
      const rejectedHeader = Array.from(
        new Uint32Array(rejectedReadback.getMappedRange()).slice()
      );
      rejectedReadback.unmap();
      rejectedReadback.destroy();
      const validationError = await device.popErrorScope();
      return {
        status: 'ok',
        validationError: validationError?.message || null,
        uncapturedErrors,
        header,
        localRows,
        rejectedHeader
      };
    });
    assert.notEqual(native.status, 'unsupported', native.reason);
    assert.equal(native.status, 'ok', JSON.stringify(native));
    assert.equal(native.validationError, null, native.validationError);
    assert.deepEqual(native.uncapturedErrors, []);
    assert.equal(native.header[2], 3, JSON.stringify(native));
    assert.equal(native.header[16], 3);
    assert.equal(native.header[20], 1);
    assert.equal(native.header[22], 0);
    assert.deepEqual(native.localRows, [0, 9, 2, 0, 1, 3, 0, 0]);
    assert.notEqual(native.rejectedHeader[2], 3, JSON.stringify(native));
    assert.ok(native.rejectedHeader[40] > 0, JSON.stringify(native));
  } finally {
    await browser.close();
  }
});
