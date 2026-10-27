import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  createSphAerosolParcelFamilyWebGpu, releaseSphAerosolParcelFamily,
  sphAerosolParcelFamilyMatchesDevice, acquireSphAerosolParcelRead,
  releaseSphAerosolParcelRead, validateSphAerosolParcelRead,
  runSphAerosolCondensateExtractionWebGpu as extract,
  adoptSphAerosolCondensateExtraction as isolatedAdopt,
  discardSphAerosolCondensateExtraction as discardCandidate,
  prepareSphAerosolCondensateTransition as reserve,
  validateSphAerosolCondensateTransition as validate,
  discardSphAerosolCondensateTransition as discard,
  finalizeSphAerosolCondensateTransition as finalize,
  resolveSphAerosolCondensateOpticalExclusion
} from '../src/runtime/sph/sphAerosolParcelGpu.js';
import {
  createSchroederSpatialEpochTransaction, abortSchroederSpatialEpochTransaction,
  sealSchroederSpatialEpochTransactionReaders, sealSchroederSpatialEpochTransactionProposals,
  commitSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { acquireSphAerosolSpatialParcelRead } from '../src/runtime/sph/sphAerosolSpatialBinding.js';
import { tagWebGpuBufferDevice, webGpuDeviceId } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA } from '../src/runtime/sph/sphMechanicsMaterialTable.js';

test('fresh SS, aerosol, thermal and exact reaction entry points initialize without an eager proposal/closure cycle', () => {
  const thermal = new URL('../src/runtime/sph/sphThermalGpuKernel.js', import.meta.url).href;
  const proposals = new URL('../src/runtime/sph/schroederSpatialThermalProposalsGpu.js', import.meta.url).href;
  const protocol = new URL('../ulg-gpu-abi/src/schroederSpatialThermalProposalConstants.js', import.meta.url).href;
  for (const entry of ['schroederSpatialThermalProposalsGpu.js', 'sphThermalGpuKernel.js',
    'schroederSpatialEpochTransaction.js', 'sphAerosolParcelGpu.js', 'sphMlsMpmPostMechanicsClosure.js',
    'sphExactReactionSourceGpu.js', 'sphExactReactionRoutingGpu.js',
    'schroederSpatialReactionPlacementEpochGpu.js', 'schroederSpatialReactionProductPlacementGpu.js']) {
    const first = new URL('../src/runtime/sph/' + entry, import.meta.url).href;
    execFileSync(process.execPath, ['--input-type=module', '--eval',
      `await import(${JSON.stringify(first)});\n` +
      `const thermal = await import(${JSON.stringify(thermal)});\n` +
      `const proposals = await import(${JSON.stringify(proposals)});\n` +
      `const protocol = await import(${JSON.stringify(protocol)});\n` +
      `for (const [key, value] of Object.entries(protocol)) {\n` +
      `  if (proposals[key] !== value) throw new Error('original thermal protocol export changed: ' + key);\n` +
      `}\n` +
      `if (!thermal.sphThermalStepWgsl.includes('THERMAL_PROPOSAL_MAGIC: u32 = 0x54504831u')) ` +
      `throw new Error('canonical thermal shader protocol changed');`],
    { timeout: 15000, stdio: 'pipe' });
  }
});

// CPU lifetime/identity double only: copies bytes and supplies the compact
// extraction-ready receipt. It does NOT simulate physics or manufacture a
// positive publication window. The real closure and SS owners below supply it.
function fakeDevice() {
  const buffers = [], submissions = [], fences = [];
  let lose;
  const lost = new Promise((resolve) => { lose = resolve; });
  const device = {
    buffers, submissions, deferFences: false, fenceFailure: null, fenceCount: 0,
    lostSetupCount: 0, failLostSetupAt: null, mapGate: null,
    lost: { then(...args) {
      device.lostSetupCount++;
      device.onLostSetup?.();
      if (device.lostSetupCount === device.failLostSetupAt) throw new Error('injected loss-handler setup failure');
      return lost.then(...args);
    } },
    limits: { maxBufferSize: 2 ** 24, maxStorageBufferBindingSize: 2 ** 24,
      maxComputeWorkgroupsPerDimension: 65535 },
    createBuffer(descriptor) {
      const buffer = { ...descriptor, bytes: new ArrayBuffer(descriptor.size), destroyed: 0,
        destroy() { this.destroyed++; },
        async mapAsync() { if (device.mapGate) await device.mapGate; },
        getMappedRange() { return this.bytes; }, unmap() {} };
      buffers.push(buffer); return buffer;
    },
    createShaderModule: (args) => args, createBindGroupLayout: (args) => args,
    createPipelineLayout: (args) => args, createComputePipeline: (args) => args,
    createBindGroup: (args) => args,
    createCommandEncoder() {
      const commands = [];
      return { copyBufferToBuffer: (...args) => commands.push({ copy: args }),
        beginComputePass() {
          const command = {}; commands.push(command);
          return { setPipeline(pipeline) { command.entry = pipeline.compute.entryPoint; },
            setBindGroup(_index, group) { command.group = group; }, dispatchWorkgroups() {}, end() {} };
        }, finish: () => commands };
    },
    queue: {
      writeBuffer(buffer, offset, values) {
        const bytes = values instanceof ArrayBuffer ? new Uint8Array(values)
          : new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
        new Uint8Array(buffer.bytes).set(bytes, offset);
      },
      submit(commandBuffers) {
        submissions.push(commandBuffers);
        for (const commands of commandBuffers) for (const command of commands) {
          if (command.copy) {
            const [input, from, output, to, length] = command.copy;
            new Uint8Array(output.bytes).set(new Uint8Array(input.bytes, from, length), to);
          } else if (command.entry === 'propose_condensate' || command.entry === 'apply_condensate') {
            const binding = command.entry === 'propose_condensate' ? 6 : 0;
            const scratch = command.group.entries.find((item) => item.binding === binding).resource.buffer;
            const words = new Uint32Array(scratch.bytes);
            if (command.entry === 'propose_condensate') words[3] = words[4];
            else words[11] = words[4];
          }
        }
      },
      onSubmittedWorkDone() {
        device.fenceCount++;
        if (device.fenceFailure === 'throw') throw new Error('unconfirmed fence throw');
        if (device.fenceFailure === 'reject') return Promise.reject(new Error('unconfirmed fence rejection'));
        return device.deferFences ? new Promise((resolve) => fences.push(resolve)) : Promise.resolve();
      }
    },
    async finishQueue() {
      for (let i = 0; i < 12; i++) {
        fences.splice(0).forEach((resolve) => resolve());
        await Promise.resolve();
      }
    },
    async finishNextFence() {
      const resolve = fences.shift();
      assert.equal(typeof resolve, 'function', 'one actual captured fake queue fence is pending');
      resolve();
      for (let i = 0; i < 12; i++) await Promise.resolve();
    },
    async lose() { lose({ reason: 'destroyed' }); for (let i = 0; i < 12; i++) await Promise.resolve(); }
  };
  return device;
}

function fixture({ attach = true } = {}) {
  const device = fakeDevice();
  const make = (label, size = 4096) => tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 | 4 | 8 }), device);
  const epoch = { storageGeneration: 3, physicsTick: 11, physicsSubstep: 2,
    positionEpoch: 13, topologyEpoch: 5, chartEpoch: 1, levelEpoch: 4, supportEpoch: 6 };
  const activeNodeBuffer = make('active-node'), directoryBuffer = make('directory');
  const sourceFamily = createSphAerosolParcelFamilyWebGpu({ device, capacity: 2,
    provenance: { kind: 'initial-conditions', reference: 'explicit empty initial aerosol reservoir' } });
  const phaseCarrierPlan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
    lineageCapacity: 2, primaryCapacity: 2, phaseLaneCount: 4, phaseLaneStride: 2,
    companionStart: 2, companionCapacity: 6, particleCapacity: 8 };
  const generation = { ready: true, selected: true, directoryBuildCount: 1, privateLookupBuildCount: 0,
    source: { ready: true, activeNodeBuffer, ...epoch },
    execution: { submitPerformed: true, deviceId: webGpuDeviceId(device), generationId: 7,
      buildOrdinal: 7, sortUniqueOrdinal: 7, activeNodeBuffer, directoryBuffer, ...epoch } };
  const sphParticleUpload = { stateBuffer: make('prior-state'), thermoBuffer: make('prior-thermo'),
    identityBuffer: make('prior-identity'), identityRevision: 'stable-outer-fixture-lineages',
    particleCount: 8, phaseCarrierPlan, ...epoch };
  if (attach) sphParticleUpload.aerosolFamily = sourceFamily;
  const mlsMpmParticleUpload = { mechanicsBuffer: make('prior-mechanics'), particleCount: 8, ...epoch };
  // A real private transaction, with no physics-reader claims in this lifetime
  // fixture. A real same-family commit below still cannot authorize extraction.
  const transaction = createSchroederSpatialEpochTransaction({ device, generation, sphParticleUpload,
    mlsMpmParticleUpload, requiredReaderIds: [] });
  return { device, make, sourceFamily, expectedGeneration: 0,
    sourceLineage: { transaction, generation, sphParticleUpload, mlsMpmParticleUpload },
    sourceStateBuffer: make('post-thermal-state'), sourceThermoBuffer: make('post-thermal-thermo'),
    sourceMechanicsBuffer: make('post-thermal-mechanics'),
    thermalMaterialTable: { records: new Float32Array([9, 0, 2, 1, 0, 1, 100, 0.001]),
      segments: new Float32Array([9, 1, 2, 2, -10, 10, 300, 400, 1000, 1000, 1, 0,
        9, 2, 2, 3, 10, 30, 400, 400, 1000, 1, 1, 0]) },
    mechanicsMaterialTable: { schema: ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
      phaseRecordCount: 2,
      records: new Float32Array([9, 2, 1000, 1, 0, 0, 1, 1, 0, 1, 0, 0,
        9, 3, 1, 1, 0, 0, 1, 2, 0, 1, 0, 0]) },
    absolutePressureAuthority: true,
    declarations: [{ lineageIndex: 0, parcelId: 100n, nucleusPopulationId: 200n, physicalMultiplicity: 2n ** 40n + 7n }],
    provenance: { kind: 'already-activated-condensate-population', reference: 'declared nuclei; not a nucleation claim' } };
}

import {
  runMlsMpmPostMechanicsClosureWebGpu, claimMlsMpmPostMechanicsContinuation,
  abandonMlsMpmPostMechanicsCondensate, retireMlsMpmPostMechanicsClosureOutputsAfter
} from '../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js';
import {
  prepareSchroederSpatialSuccessorSourceFamilyPublication,
  publishPreparedSchroederSpatialSuccessorSourceFamily,
  abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication,
  resolveSchroederSpatialSuccessorSourceFamily, validateSchroederSpatialSuccessorPublicationReceipt,
  acquireSchroederSpatialSuccessorSourceFamilyLease, retireSchroederSpatialSuccessorSourceFamilyAfterLeases,
  releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter, retireSchroederSpatialSuccessorSourceFamily
} from '../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { validateSchroederSpatialEpochTransactionCommit } from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  sphAerosolCondensateTransitionForUploads, acquireSphAerosolSpatialGenerationRead,
  releaseSphAerosolSpatialGenerationRead
} from '../src/runtime/sph/sphAerosolSpatialBinding.js';
import { ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
  ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA } from '../ulg-gpu-abi/src/index.js';

function closureFixture() {
  const f = fixture();
  const { sphParticleUpload: sph, mlsMpmParticleUpload: mls, generation } = f.sourceLineage;
  Object.assign(sph, { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded', stateStrideBytes: 32, thermoStrideBytes: 48, identityStrideBytes: 16 });
  Object.assign(mls, { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
    status: 'webgpu-uploaded', mechanicsStrideBytes: 128 });
  generation.source.sourceCount = 8;
  generation.execution.sourceCount = 8;
  const epoch = Object.fromEntries(['storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch',
    'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch'].map((name) => [name, sph[name]]));
  f.lookup = { schema: ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
    assignmentSchema: 'peercompute.ulg.schroeder-level-assignment.v0', status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
    particleCount: 8, assignmentStrideFloats: 16, assignmentStrideBytes: 64,
    assignmentBuffer: f.make('lookup-assignment', 512), assignmentBufferByteLength: 512,
    assignments: new Float32Array(128), sourceStateBuffer: sph.stateBuffer, sourceStateBufferBorrowed: true,
    sourceStateBufferByteLength: 256, sourceThermoBuffer: sph.thermoBuffer, sourceThermoBufferBorrowed: true,
    sourceThermoBufferByteLength: 384, sourceMechanicsBuffer: mls.mechanicsBuffer,
    sourceMechanicsBufferBorrowed: true, sourceMechanicsBufferByteLength: 1024,
    minLevel: 0, maxLevel: 1, chartId: 0, baseGridSpacingM: 0.25, ...epoch };
  f.classify = async ({ nextParticleUploads }) => {
    const { sphParticleUpload: s, mlsMpmParticleUpload: m } = nextParticleUploads;
    const assignmentBuffer = f.make('final-assignment', 512);
    return { ...f.lookup, ...Object.fromEntries(Object.keys(epoch).map((name) => [name, s[name]])),
      assignmentBuffer, assignments: f.lookup.assignments.slice(),
      sourceStateBuffer: s.stateBuffer, sourceThermoBuffer: s.thermoBuffer, sourceMechanicsBuffer: m.mechanicsBuffer,
      kernelScope: 'schroeder-gpu-level-assignment', fullParticleReadbackPerformed: false,
      destroyAssignmentBuffer() { assignmentBuffer.destroy(); } };
  };
  const stage = (fields) => ({ backend: 'webgpu', fullParticleReadbackFree: true, ...fields });
  f.phaseCalls = [];
  f.options = { device: f.device, sphParticleState: { particleCount: 8 }, mlsMpmParticleState: { particleCount: 8 },
    sphParticleUpload: sph, mlsMpmParticleUpload: mls,
    schroederSpatialEpochGeneration: generation, schroederSpatialEpochTransaction: f.sourceLineage.transaction,
    postMechanicsParticleBuffers: { stateBuffer: sph.stateBuffer, mechanicsBuffer: mls.mechanicsBuffer },
    postMechanicsBackend: 'webgpu', readbackMode: 'no-full-readback',
    thermalMaterialTable: f.thermalMaterialTable, mechanicsMaterialTable: f.mechanicsMaterialTable,
    thermalStepRunner: async () => stage({ stateBuffer: f.sourceStateBuffer, thermoBuffer: f.sourceThermoBuffer }),
    reactionStepRunner: null, mechanicsRefreshRunner: null,
    phaseCarrierTransferRunner: async (options) => {
      f.phaseCalls.push(options);
      return stage({ stateBuffer: f.make('final-state', 256), thermoBuffer: f.make('final-thermo', 384),
        mechanicsBuffer: f.make('final-mechanics', 1024) });
    },
    condensateExtraction: { declarations: f.declarations, provenance: f.provenance },
    phaseCarrierTransferOptions: { absolutePressureAuthority: true }, boxDimsM: [1, 1, 1], dtSeconds: 0.001 };
  return f;
}

async function closeAndClaim(f) {
  f.closure = await runMlsMpmPostMechanicsClosureWebGpu(f.options);
  f.transition = f.closure.aerosolCondensateTransition;
  const { sphParticleUpload: sph, mlsMpmParticleUpload: mls } = f.sourceLineage;
  f.next = { sphParticleUpload: { ...sph, stateBuffer: f.closure.continuation.stateBuffer,
    thermoBuffer: f.closure.continuation.thermoBuffer },
    mlsMpmParticleUpload: { ...mls, mechanicsBuffer: f.closure.continuation.mechanicsBuffer } };
  f.claim = claimMlsMpmPostMechanicsContinuation(f.closure, { nextParticleUploads: f.next });
  return f;
}

async function preflight(f) {
  f.plan = await prepareSchroederSpatialSuccessorSourceFamilyPublication({
    transaction: f.sourceLineage.transaction, generation: f.sourceLineage.generation,
    nextParticleUploads: f.next, lookupLevelAssignment: f.lookup,
    successorLevelAssignmentRunner: f.classify, conservativeTopologyAdvance: true, forcePositionAdvance: true
  });
  return f.plan;
}

function commit(f) {
  sealSchroederSpatialEpochTransactionReaders(f.sourceLineage.transaction);
  sealSchroederSpatialEpochTransactionProposals(f.sourceLineage.transaction);
  f.commit = commitSchroederSpatialEpochTransaction(f.sourceLineage.transaction, { nextParticleUploads: f.next });
  return f.commit;
}

async function cleanup(f) {
  if (f.closure) abandonMlsMpmPostMechanicsCondensate(f.closure);
  if (f.publication?.published) retireSchroederSpatialSuccessorSourceFamily(f.publication.sourceFamily,
    { device: f.device, reason: 'test terminal lane teardown' });
  abortSchroederSpatialEpochTransaction(f.sourceLineage.transaction);
  releaseSphAerosolParcelFamily(f.sourceFamily);
  await f.device.finishQueue();
}

test('actual closure uses pending residuals, binds final carrier outputs and publishes both halves once', async () => {
  const f = await closeAndClaim(closureFixture());
  const { transition, closure, next } = f;
  assert.equal(f.phaseCalls[0].sourceStateBuffer, transition.stateBuffer);
  assert.equal(f.phaseCalls[0].sourceThermoBuffer, transition.thermoBuffer);
  assert.equal(f.phaseCalls[0].sourceMechanicsBuffer, transition.mechanicsBuffer);
  assert.equal(closure.phaseCarrierTransferFamilyReceipt.postReactionStateBuffer, f.sourceStateBuffer);
  assert.deepEqual(closure.executedStageOrder,
    ['thermal-phase', 'pending-condensate-extraction', 'phase-carrier-transfer-v2']);
  assert.equal(closure.authoritativeStageOrder.indexOf('pending-condensate-extraction') + 1,
    closure.authoritativeStageOrder.indexOf('phase-carrier-transfer-v2'));
  assert.notEqual(next.sphParticleUpload.stateBuffer, transition.stateBuffer);
  assert.equal(sphAerosolCondensateTransitionForUploads(next), transition);
  assert.equal(sphAerosolParcelFamilyMatchesDevice(transition.aerosolFamily, f.device), false);
  await preflight(f);
  commit(f);
  assert.equal(f.commit.aerosolCondensateTransition, transition);
  assert.equal(finalize(transition, { plan: f.plan, commitReceipt: f.commit }), null, 'commit alone is not publication');
  assert.equal(sphAerosolParcelFamilyMatchesDevice(transition.aerosolFamily, f.device), false);
  f.publication = publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan, { commitReceipt: f.commit });
  assert.equal(f.publication.published, true, f.publication.reason);
  assert.equal(validateSchroederSpatialSuccessorPublicationReceipt(f.publication, {
    plan: f.plan, commitReceipt: f.commit, nextParticleUploads: next }), true);
  assert.equal(sphAerosolParcelFamilyMatchesDevice(transition.aerosolFamily, f.device), true);
  assert.equal(resolveSchroederSpatialSuccessorSourceFamily(f.publication.sourceFamily,
    { device: f.device, ...next }).admitted, true);
  assert.equal(abandonMlsMpmPostMechanicsCondensate(closure), false, 'late error cannot undo published physics');
  assert.equal(publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan, { commitReceipt: f.commit }).published, false);
  await f.device.finishQueue();
  assert.equal(transition.stateBuffer.destroyed, 1, 'residual retires after phase consumption');
  assert.equal(next.sphParticleUpload.stateBuffer.destroyed, 0, 'actual final carrier stays with its owner');
  await assert.rejects(extract(f), /already adopted|already consumed/);
  await cleanup(f);
});

for (const failure of ['abandon-plan', 'foreign-commit', 'changed-carrier', 'changed-family', 'throwing-slot']) {
  test(`actual outer ${failure} rejects pending extraction without consuming source mass`, async () => {
    const f = await closeAndClaim(closureFixture());
    await preflight(f);
    if (failure === 'abandon-plan') {
      assert.equal(abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication(f.plan), true);
    } else {
      commit(f);
      if (failure === 'changed-carrier') f.next.sphParticleUpload.stateBuffer = f.make('foreign-final');
      if (failure === 'changed-family') f.next.sphParticleUpload.aerosolFamily = { ...f.transition.aerosolFamily };
      if (failure === 'throwing-slot') Object.defineProperty(f.next, 'schroederSpatialSuccessorSourceFamily', {
        configurable: true, get() { throw new Error('injected publication getter'); }
      });
      const publication = publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan,
        { commitReceipt: failure === 'foreign-commit' ? { ...f.commit } : f.commit });
      assert.equal(publication.published, false);
    }
    await f.device.finishQueue();
    assert.equal(sphAerosolParcelFamilyMatchesDevice(f.transition.aerosolFamily, f.device), false);
    assert.equal(f.transition.stateBuffer.destroyed, 1);
    const retry = await extract(f);
    discardCandidate(retry);
    await cleanup(f);
  });
}

test('closure failure after extraction abandons residuals and leaves source reusable', async () => {
  const f = closureFixture();
  f.options.phaseCarrierTransferRunner = async () => { throw new Error('injected phase transfer failure'); };
  await assert.rejects(runMlsMpmPostMechanicsClosureWebGpu(f.options), /injected phase transfer/);
  await f.device.finishQueue();
  const retry = await extract(f); discardCandidate(retry);
  assert.equal(f.sourceStateBuffer.destroyed, 1, 'closure owns its discarded thermal output');
  assert.equal(f.sourceLineage.sphParticleUpload.stateBuffer.destroyed, 0, 'original SS source survives');
  await cleanup(f);
});

test('rejected publication invalidates the pending pair immediately and frees its source at the lower owner fence', async () => {
  const f = await closeAndClaim(closureFixture());
  await preflight(f); commit(f); await f.device.finishQueue();
  f.device.deferFences = true;
  f.next.sphParticleUpload.stateBuffer = f.make('tampered-final-state', 256);
  const assignment = f.device.buffers.find((buffer) => buffer.label === 'final-assignment');
  const publication = publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan,
    { commitReceipt: f.commit });
  assert.equal(publication.published, false);
  assert.equal(validate(f.transition, { device: f.device,
    transaction: f.sourceLineage.transaction, generation: f.sourceLineage.generation,
    sourceFamily: f.sourceFamily, nextFamily: f.transition.aerosolFamily }), false);
  assert.equal(discard(f.transition), false, 'rejection already performed logical abandonment');
  assert.equal(f.transition.stateBuffer.destroyed, 0);
  await assert.rejects(extract(f), /pending/);
  await f.device.finishNextFence();
  assert.equal(f.transition.stateBuffer.destroyed, 1);
  assert.equal(assignment.destroyed, 0, 'classifier retirement remains independently fenced');
  const retry = await extract(f); discardCandidate(retry);
  await cleanup(f);
  assert.equal(f.transition.stateBuffer.destroyed, 1, 'later classifier cleanup cannot redispose the pair');
});

test('pending continuation cannot use a cloned closure, different terminal envelope, or copied transition', async () => {
  const f = await closeAndClaim(closureFixture());
  assert.throws(() => claimMlsMpmPostMechanicsContinuation({ ...f.closure }, { nextParticleUploads: f.next }), /copied|Unknown/);
  const copied = { sphParticleUpload: { ...f.next.sphParticleUpload }, mlsMpmParticleUpload: { ...f.next.mlsMpmParticleUpload },
    aerosolCondensateTransition: { ...f.transition } };
  assert.throws(() => claimMlsMpmPostMechanicsContinuation(f.closure,
    { nextParticleUploads: copied }), /another envelope/);
  assert.equal(claimMlsMpmPostMechanicsContinuation(f.closure,
    { nextParticleUploads: f.next }), f.claim, 'only exact-envelope claim replay is idempotent');
  sealSchroederSpatialEpochTransactionReaders(f.sourceLineage.transaction);
  sealSchroederSpatialEpochTransactionProposals(f.sourceLineage.transaction);
  assert.throws(() => commitSchroederSpatialEpochTransaction(f.sourceLineage.transaction,
    { nextParticleUploads: copied }), /paired/);
  assert.equal(f.sourceLineage.transaction.state, 'proposals-sealed');
  await cleanup(f);
});

for (const component of ['state', 'thermo', 'both']) {
  test(`reaction-mutated ${component} plus extraction binds exact donor exclusion to the actual closure`, async () => {
    const f = closureFixture();
    const output = { backend: 'webgpu', fullParticleReadbackFree: true };
    if (component !== 'thermo') output.stateBuffer = f.make('reaction-state', 256);
    if (component !== 'state') output.thermoBuffer = f.make('reaction-thermo', 384);
    f.options.reactionTable = { reactionCount: 1 };
    f.options.reactionStepRunner = async () => output;
    await closeAndClaim(f);
    const receipt = f.closure.phaseCarrierTransferFamilyReceipt;
    assert.equal(receipt.aerosolCondensateTransition, f.transition);
    assert.equal(receipt.postReactionStateBuffer, output.stateBuffer ?? f.sourceStateBuffer);
    assert.equal(receipt.postReactionThermoBuffer, output.thermoBuffer ?? f.sourceThermoBuffer);
    assert.equal(receipt.preTransferStateBuffer, f.transition.stateBuffer);
    assert.equal(receipt.preTransferThermoBuffer, f.transition.thermoBuffer);
    assert.deepEqual(resolveSphAerosolCondensateOpticalExclusion(f.transition, receipt), [0]);
    assert.throws(() => resolveSphAerosolCondensateOpticalExclusion(null, receipt), /omitted/);
    assert.equal(f.phaseCalls.length, 1);
    assert.equal(f.sourceLineage.sphParticleUpload.stateBuffer.destroyed, 0);
    await cleanup(f);
  });
}

test('mechanics-only reaction output does not trigger the state/thermo optical admission gate', async () => {
  const f = closureFixture();
  const mechanicsBuffer = f.make('reaction-mechanics-only', 1024);
  f.options.reactionTable = { reactionCount: 1 };
  f.options.reactionStepRunner = async () => ({ backend: 'webgpu', fullParticleReadbackFree: true,
    mechanicsBuffer });
  await closeAndClaim(f);
  assert.equal(f.closure.phaseCarrierTransferFamilyReceipt.postReactionMechanicsBuffer, mechanicsBuffer);
  assert.equal(f.closure.phaseCarrierTransferFamilyReceipt.reactionStateMutationApplied, false);
  assert.equal(f.closure.phaseCarrierTransferFamilyReceipt.reactionThermoMutationApplied, false);
  await cleanup(f);
});

test('without an extraction request the existing closure does not allocate extraction outputs', async () => {
  const f = closureFixture();
  f.options.condensateExtraction = null;
  const before = f.device.buffers.length;
  f.closure = await runMlsMpmPostMechanicsClosureWebGpu(f.options);
  assert.equal(f.device.buffers.length - before, 3, 'only the existing fake phase outputs');
  assert.equal(f.closure.aerosolCondensateTransition, null);
  assert.equal(f.closure.authoritativeStageOrder.includes('pending-condensate-extraction'), false);
  await cleanup(f);
});

test('actual publication window rejects recursive finalization and makes no post-adoption lost getter call', async () => {
  const f = await closeAndClaim(closureFixture());
  await preflight(f); commit(f);
  const onDone = f.device.queue.onSubmittedWorkDone;
  const oldLost = f.device.lost;
  let calls = 0;
  f.device.queue.onSubmittedWorkDone = () => {
    calls++;
    assert.equal(finalize(f.transition, { plan: f.plan, commitReceipt: f.commit }), null);
    Object.defineProperty(f.device, 'lost', { configurable: true,
      get() { throw new Error('no callable loss access after activation'); } });
    return onDone();
  };
  f.publication = publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan, { commitReceipt: f.commit });
  assert.equal(f.publication.published, true, f.publication.reason);
  assert.equal(calls, 1);
  Object.defineProperty(f.device, 'lost', { value: oldLost, configurable: true, writable: true });
  f.device.queue.onSubmittedWorkDone = onDone;
  await cleanup(f);
});

test('throwing final-consumer fence rejects publication before activation and quarantines pending outputs until loss', async () => {
  const f = await closeAndClaim(closureFixture());
  await preflight(f); commit(f);
  f.device.fenceFailure = 'throw';
  const publication = publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan, { commitReceipt: f.commit });
  assert.equal(publication.published, false);
  assert.equal(sphAerosolParcelFamilyMatchesDevice(f.transition.aerosolFamily, f.device), false);
  assert.equal(f.transition.stateBuffer.destroyed, 0);
  await f.device.lose();
  assert.equal(f.transition.stateBuffer.destroyed, 1);
  await cleanup(f);
});

test('published child survives predecessor retirement request through the exact next-consumer lease', async () => {
  const f = await closeAndClaim(closureFixture());
  await preflight(f); commit(f);
  f.publication = publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan, { commitReceipt: f.commit });
  assert.equal(f.publication.published, true, f.publication.reason);
  const sourceFamily = f.publication.sourceFamily;
  const lease = acquireSchroederSpatialSuccessorSourceFamilyLease(sourceFamily,
    { device: f.device, consumerStage: 'actual-next-epoch' });
  const retirement = retireSchroederSpatialSuccessorSourceFamilyAfterLeases(sourceFamily,
    { device: f.device, after: Promise.resolve(), reason: 'next generation begins' });
  const sourceEpoch = Object.fromEntries(['storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch',
    'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch'].map((key) => [key, f.next.sphParticleUpload[key]]));
  const old = f.sourceLineage.generation;
  const nextGeneration = { ...old, source: { ...old.source, ...sourceEpoch },
    execution: { ...old.execution, ...sourceEpoch, generationId: 8, buildOrdinal: 8, sortUniqueOrdinal: 8 } };
  const nextInput = { device: f.device, generation: nextGeneration, ...f.next, requiredReaderIds: [] };
  assert.throws(() => createSchroederSpatialEpochTransaction(nextInput), /retirement was requested/);
  assert.throws(() => createSchroederSpatialEpochTransaction({ ...nextInput,
    aerosolSourceFamilyConsumerLease: { ...lease } }), /lease does not identify/);
  const nextTransaction = createSchroederSpatialEpochTransaction({ ...nextInput,
    aerosolSourceFamilyConsumerLease: lease });
  const read = acquireSphAerosolSpatialGenerationRead({ device: f.device, generation: nextGeneration });
  assert.equal(read.family, f.transition.aerosolFamily);
  await releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(sourceFamily, lease,
    { device: f.device, after: Promise.resolve() });
  await retirement; await f.device.finishQueue();
  assert.equal(read.buffer.destroyed, 0, 'actual next generation and consumer retain buffer after predecessor retires');
  releaseSphAerosolSpatialGenerationRead(read);
  abortSchroederSpatialEpochTransaction(nextTransaction);
  await f.device.finishQueue();
  assert.equal(read.buffer.destroyed, 1, 'last generation/consumer releases child exactly once');
  f.publication = null;
  await cleanup(f);
});

test('two actual successor publications share one child owner until the last lane retires', async () => {
  const f = await closeAndClaim(closureFixture());
  await preflight(f); commit(f);
  f.publication = publishPreparedSchroederSpatialSuccessorSourceFamily(f.plan, { commitReceipt: f.commit });
  assert.equal(f.publication.published, true, f.publication.reason);
  const epoch = Object.fromEntries(['storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch',
    'topologyEpoch', 'chartEpoch', 'levelEpoch', 'supportEpoch'].map((key) => [key, f.next.sphParticleUpload[key]]));
  const old = f.sourceLineage.generation;
  const generation = { ...old, source: { ...old.source, ...epoch },
    execution: { ...old.execution, ...epoch, generationId: 8, buildOrdinal: 8, sortUniqueOrdinal: 8 } };
  const transaction = createSchroederSpatialEpochTransaction({ device: f.device, generation,
    ...f.next, requiredReaderIds: [] });
  const second = { ...f, sourceLineage: { transaction, generation,
    sphParticleUpload: f.next.sphParticleUpload, mlsMpmParticleUpload: f.next.mlsMpmParticleUpload },
    next: { sphParticleUpload: { ...f.next.sphParticleUpload },
      mlsMpmParticleUpload: { ...f.next.mlsMpmParticleUpload } },
    lookup: f.next.schroederSpatialSuccessorLevelAssignment };
  await preflight(second); commit(second);
  const publication = publishPreparedSchroederSpatialSuccessorSourceFamily(second.plan,
    { commitReceipt: second.commit });
  assert.equal(publication.published, true, publication.reason);
  assert.equal(second.commit.aerosolCondensateTransition, null, 'ordinary continuation does not re-extract');
  retireSchroederSpatialSuccessorSourceFamily(f.publication.sourceFamily,
    { device: f.device, reason: 'first lane complete' });
  await f.device.finishQueue();
  assert.equal(sphAerosolParcelFamilyMatchesDevice(f.transition.aerosolFamily, f.device), true,
    'first lane cannot release the shared ordinary owner');
  const read = acquireSphAerosolParcelRead({ device: f.device, family: f.transition.aerosolFamily,
    expectedGeneration: f.transition.aerosolFamily.generation });
  assert.equal(resolveSchroederSpatialSuccessorSourceFamily(publication.sourceFamily,
    { device: f.device, ...second.next }).admitted, true);
  retireSchroederSpatialSuccessorSourceFamily(publication.sourceFamily,
    { device: f.device, reason: 'last lane complete' });
  abortSchroederSpatialEpochTransaction(transaction);
  await f.device.finishQueue();
  assert.equal(sphAerosolParcelFamilyMatchesDevice(f.transition.aerosolFamily, f.device), false,
    'last lane releases the ordinary owner');
  assert.equal(read.buffer.destroyed, 0, 'independent live consumer still holds the child');
  releaseSphAerosolParcelRead(read);
  await f.device.finishQueue();
  assert.equal(read.buffer.destroyed, 1);
  f.publication = null;
  await cleanup(f);
});
