import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  resolveSphAerosolCondensateOpticalExclusion as opticalExclusion
} from '../src/runtime/sph/sphAerosolParcelGpu.js';
import {
  createSchroederSpatialEpochTransaction, abortSchroederSpatialEpochTransaction,
  sealSchroederSpatialEpochTransactionReaders, sealSchroederSpatialEpochTransactionProposals,
  commitSchroederSpatialEpochTransaction
} from '../src/runtime/sph/schroederSpatialEpochTransaction.js';
import { acquireSphAerosolSpatialParcelRead } from '../src/runtime/sph/sphAerosolSpatialBinding.js';
import { tagWebGpuBufferDevice, webGpuDeviceId } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA } from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import { buildSphDispersedMediumOpticalClosureTable } from '../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import { buildSphDispersedMediumOpticsProducerSeedRows,
  createSphDispersedMediumOpticsProducerWebGpuEncoderStage,
  runSphDispersedMediumOpticsProducerWebGpu } from '../src/runtime/sph/sphDispersedMediumOpticsProducerGpu.js';

// CPU lifetime/identity double only: copies bytes and supplies the compact
// extraction-ready receipt. It does NOT simulate physics or manufacture a
// positive publication window. Root's actual closure/SS tests cover publication.
function fakeDevice() {
  const buffers = [], submissions = [], fences = [], groups = [];
  let lose;
  const lost = new Promise((resolve) => { lose = resolve; });
  const device = {
    buffers, submissions, groups, deferFences: false, fenceFailure: null, fenceCount: 0,
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
    createBindGroup(args) { groups.push(args); return args; },
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
    async lose() { lose({ reason: 'destroyed' }); for (let i = 0; i < 12; i++) await Promise.resolve(); }
  };
  return device;
}

function fixture({ attach = true, exact = false } = {}) {
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
  const sphParticleUpload = { stateBuffer: make('prior-state', exact ? 256 : 4096),
    thermoBuffer: make('prior-thermo', exact ? 384 : 4096),
    identityBuffer: make('prior-identity', exact ? 128 : 4096), identityRevision: 'cold-donor-optics-identity',
    particleCount: 8, phaseCarrierPlan, ...epoch };
  if (attach) sphParticleUpload.aerosolFamily = sourceFamily;
  const mlsMpmParticleUpload = { mechanicsBuffer: make('prior-mechanics'), particleCount: 8, ...epoch };
  // A real private transaction, with no physics-reader claims in this lifetime
  // fixture. A real same-family commit below still cannot authorize extraction.
  const transaction = createSchroederSpatialEpochTransaction({ device, generation, sphParticleUpload,
    mlsMpmParticleUpload, requiredReaderIds: [] });
  return { device, make, sourceFamily, expectedGeneration: 0,
    sourceLineage: { transaction, generation, sphParticleUpload, mlsMpmParticleUpload },
    sourceStateBuffer: make('post-thermal-state', exact ? 256 : 4096),
    sourceThermoBuffer: make('post-thermal-thermo', exact ? 384 : 4096),
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

function sourceTuple(options) {
  return { device: options.device, ...options.sourceLineage, sourceStateBuffer: options.sourceStateBuffer,
    sourceThermoBuffer: options.sourceThermoBuffer, sourceMechanicsBuffer: options.sourceMechanicsBuffer };
}

function expected(options, transition) {
  return { device: options.device, transaction: options.sourceLineage.transaction,
    generation: options.sourceLineage.generation, sourceFamily: options.sourceFamily, nextFamily: transition.aerosolFamily };
}

function opticalTuple(options, transition) {
  const sph = options.sourceLineage.sphParticleUpload;
  return { device: options.device, phaseCarrierPlan: sph.phaseCarrierPlan,
    particleLineage: { particleCount: sph.particleCount, topologyEpoch: sph.topologyEpoch,
      identityBuffer: sph.identityBuffer, identityRevision: sph.identityRevision },
    postReactionStateBuffer: options.sourceStateBuffer, postReactionThermoBuffer: options.sourceThermoBuffer,
    preTransferStateBuffer: transition.stateBuffer, preTransferThermoBuffer: transition.thermoBuffer };
}

async function opticalStageFixture() {
  const f = fixture({ exact: true });
  Object.assign(f.device.limits, { maxStorageBuffersPerShaderStage: 8,
    maxUniformBufferBindingSize: 65536, maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256 });
  const plan = f.sourceLineage.sphParticleUpload.phaseCarrierPlan;
  Object.assign(plan, { stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true });
  const candidate = await extract(f), transition = reserve(candidate, sourceTuple(f));
  const opticalClosureTable = buildSphDispersedMediumOpticalClosureTable([{ dispersedMaterialId: 9,
    vaporPhaseId: 3, condensedPhaseId: 2, opticalStateId: 99, morphologyModelId: 1,
    condensedDensityKgPerM3: 1000, scatteringEfficiencyQsca: 2, absorptionEfficiencyQabs: 0,
    asymmetryFactorG: 0.5, effectiveRadiusM: 1e-6 }]);
  const args = { ...opticalTuple(f, transition), aerosolCondensateTransition: transition,
    preReactionStateBuffer: f.make('pre-reaction-state', 256),
    preReactionThermoBuffer: f.make('pre-reaction-thermo', 384),
    postTransferStateBuffer: f.make('post-transfer-state', 256),
    postTransferThermoBuffer: f.make('post-transfer-thermo', 384),
    opticalClosureTable, seedOpticsRows: buildSphDispersedMediumOpticsProducerSeedRows({
      phaseCarrierPlan: plan, lineageMaterialIds: new Float32Array([9, 9]), opticalClosureTable }).rows };
  return { f, transition, args };
}

test('optical capture binds cold donor flags in its evidence tail with unchanged header and dispatch count', async () => {
  const { f, transition, args } = await opticalStageFixture();
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(args);
  assert.equal(stage.evidenceBuffer.size, 72);
  assert.equal(stage.evidenceBufferByteLength, 64, 'public readback remains header-only');
  assert.deepEqual([...new Uint32Array(stage.evidenceBuffer.bytes, 64)], [1, 0]);
  const group = (suffix) => f.device.groups.find((g) => g.label?.endsWith(suffix));
  const evidence = (g) => g.entries.find((e) => e.binding === 7).resource;
  assert.equal(evidence(group('-reaction-capture-bind-group')).size, 72);
  assert.equal(evidence(group('-preflight-bind-group')).size, 64);
  assert.equal(evidence(group('-apply-bind-group')).size, 64);
  const encoder = f.device.createCommandEncoder();
  stage.encode(encoder);
  assert.deepEqual(encoder.finish().map((c) => c.entry), ['capture_reaction_births', 'preflight', 'apply_production']);
  assert.equal(stage.result.encodedDispatchCount, 3);
  assert.equal(stage.result.extractedCondensateDonorCount, 1);
  stage.cleanupConstructionFailure(); discard(transition); await cleanup(f);
});

test('actual optical constructor rejects omitted or copied transition before allocation', async () => {
  const { f, transition, args } = await opticalStageFixture();
  const before = f.device.buffers.length;
  for (const token of [null, { ...transition }]) {
    assert.throws(() => createSphDispersedMediumOpticsProducerWebGpuEncoderStage({ ...args,
      aerosolCondensateTransition: token }), /exact pending transition/);
  }
  for (const field of ['preTransferStateBuffer', 'preTransferThermoBuffer']) {
    assert.throws(() => createSphDispersedMediumOpticsProducerWebGpuEncoderStage({ ...args,
      aerosolCondensateTransition: null, [field]: field === 'preTransferStateBuffer'
        ? f.sourceStateBuffer : f.sourceThermoBuffer }), /exact pending transition/);
  }
  assert.equal(f.device.buffers.length, before);
  discard(transition); await cleanup(f);
});

test('optical producer revalidates abandoned extraction before encoding', async () => {
  const { f, transition, args } = await opticalStageFixture();
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(args);
  discard(transition);
  const encoder = f.device.createCommandEncoder();
  assert.throws(() => stage.encode(encoder), /exact pending transition/);
  assert.equal(encoder.finish().length, 0);
  stage.cleanupConstructionFailure(); await cleanup(f);
});

test('standalone optical submission rejects extraction abandoned after encoding but before submission', async () => {
  const { f, transition, args } = await opticalStageFixture();
  const original = f.device.createCommandEncoder;
  const before = f.device.submissions.length;
  f.device.createCommandEncoder = () => {
    const encoder = original();
    const finish = encoder.finish;
    encoder.finish = () => { const commands = finish(); discard(transition); return commands; };
    return encoder;
  };
  assert.throws(() => runSphDispersedMediumOpticsProducerWebGpu(args), /exact pending transition/);
  assert.equal(f.device.submissions.length, before, 'no stale optical commands submitted');
  f.device.createCommandEncoder = original;
  await cleanup(f);
});

test('optical exclusion yields only immutable privately snapshotted donor addresses without GPU work', async () => {
  const f = fixture(), candidate = await extract(f), transition = reserve(candidate, sourceTuple(f));
  const tuple = opticalTuple(f, transition), allocations = f.device.buffers.length;
  const submissions = f.device.submissions.length, fences = f.device.fenceCount;
  const indices = opticalExclusion(transition, tuple);
  assert.deepEqual(indices, [0]); assert.equal(Object.isFrozen(indices), true);
  f.declarations[0].lineageIndex = 1;
  assert.equal(opticalExclusion(transition, tuple), indices);
  assert.throws(() => indices.push(1), TypeError);
  assert.equal(f.device.buffers.length, allocations);
  assert.equal(f.device.submissions.length, submissions);
  assert.equal(f.device.fenceCount, fences);
  discard(transition); await cleanup(f);
});

test('optical exclusion fails closed for omitted, copied, abandoned or mismatched source authority', async () => {
  const f = fixture(), candidate = await extract(f), transition = reserve(candidate, sourceTuple(f));
  const tuple = opticalTuple(f, transition);
  for (const token of [null, undefined, { ...transition }]) {
    assert.throws(() => opticalExclusion(token, tuple), /exact pending transition/);
  }
  for (const field of ['device', 'phaseCarrierPlan', 'postReactionStateBuffer', 'postReactionThermoBuffer',
    'preTransferStateBuffer', 'preTransferThermoBuffer']) {
    assert.throws(() => opticalExclusion(transition, { ...tuple, [field]: { ...tuple[field] } }), /exact/);
  }
  for (const field of ['particleCount', 'topologyEpoch', 'identityBuffer', 'identityRevision']) {
    const wrong = { ...tuple.particleLineage, [field]: field === 'identityBuffer' ? f.make('foreign-identity') : 999 };
    assert.throws(() => opticalExclusion(transition, { ...tuple, particleLineage: wrong }), /exact/);
  }
  for (const identityRevision of [undefined, null, '']) {
    assert.throws(() => opticalExclusion(transition, { ...tuple,
      particleLineage: { ...tuple.particleLineage, identityRevision } }), /exact/);
  }
  for (const field of ['preTransferStateBuffer', 'preTransferThermoBuffer']) {
    const original = field === 'preTransferStateBuffer' ? f.sourceStateBuffer : f.sourceThermoBuffer;
    assert.throws(() => opticalExclusion(null, { ...tuple, [field]: original }), /exact pending transition/);
  }
  assert.equal(opticalExclusion(null, { preTransferStateBuffer: f.sourceStateBuffer }), null,
    'ordinary non-extracted optics remains unchanged');
  discard(transition);
  assert.throws(() => opticalExclusion(transition, tuple), /exact pending transition/);
  assert.throws(() => opticalExclusion(null, tuple), /exact pending transition/);
  await cleanup(f);
});

test('optical donor authority cannot invent or revise captured stable identity metadata', async () => {
  for (const sourceRevision of [undefined, 'original']) {
    const f = fixture();
    f.sourceLineage.sphParticleUpload.identityRevision = sourceRevision;
    const candidate = await extract(f), transition = reserve(candidate, sourceTuple(f));
    const tuple = opticalTuple(f, transition);
    if (sourceRevision == null) assert.throws(() => opticalExclusion(transition, tuple), /exact/);
    else assert.deepEqual(opticalExclusion(transition, tuple), [0]);
    f.sourceLineage.sphParticleUpload.identityRevision = 'rewritten';
    tuple.particleLineage.identityRevision = 'rewritten';
    assert.throws(() => opticalExclusion(transition, tuple), /exact/);
    discard(transition); await cleanup(f);
  }
});

test('an aborted exact source cannot continue using a previously resolved optical donor list', async () => {
  const f = fixture(), candidate = await extract(f), transition = reserve(candidate, sourceTuple(f));
  const tuple = opticalTuple(f, transition);
  assert.deepEqual(opticalExclusion(transition, tuple), [0]);
  abortSchroederSpatialEpochTransaction(f.sourceLineage.transaction, 'source abandoned before optics');
  assert.throws(() => opticalExclusion(transition, tuple), /live SS source/);
  discard(transition); await cleanup(f);
});

async function cleanup(options) {
  abortSchroederSpatialEpochTransaction(options.sourceLineage.transaction, 'CPU fixture retired');
  releaseSphAerosolParcelFamily(options.sourceFamily);
  await options.device.finishQueue();
}

function candidateOutputs(options) {
  return options.device.buffers.filter(({ label }) => /extraction-(?:residual-|successor-parcels)/.test(label));
}

test('pending reservation exposes only the paired residuals, not ordinary aerosol authority or another adoption', async () => {
  const options = fixture(), candidate = await extract(options), tuple = sourceTuple(options);
  const allocations = options.device.buffers.length, submissions = options.device.submissions.length;
  const transition = reserve(candidate, tuple);
  assert.equal(Object.isFrozen(transition), true); assert.equal(Object.isFrozen(transition.aerosolFamily), true);
  assert.equal(transition.particleCount, 8); assert.equal(transition.sourceTopologyEpoch, 5);
  assert.equal(transition.aerosolFamily.generation, 1); assert.equal(transition.aerosolFamily.capacity, 3);
  assert.equal(transition.sourceAerosolFamily, options.sourceFamily);
  assert.equal(transition.energyScope, 'stored-internal-plus-translational-kinetic-only');
  assert.equal(transition.gasVolumeAuthority, false); assert.equal(transition.opticalAuthority, false);
  assert.equal(transition.fullPhysicsValidation, false);
  assert.notEqual(transition.stateBuffer, options.sourceStateBuffer);
  assert.notEqual(transition.thermoBuffer, options.sourceThermoBuffer);
  assert.notEqual(transition.mechanicsBuffer, options.sourceMechanicsBuffer);
  assert.equal(options.device.buffers.length, allocations); assert.equal(options.device.submissions.length, submissions);
  assert.equal(validate(transition, expected(options, transition)), true);
  assert.equal(sphAerosolParcelFamilyMatchesDevice(transition.aerosolFamily, options.device), false);
  assert.throws(() => acquireSphAerosolParcelRead({ device: options.device, family: transition.aerosolFamily,
    expectedGeneration: 1 }), /exact live/);
  assert.throws(() => releaseSphAerosolParcelFamily(transition.aerosolFamily), /exact family/);
  assert.throws(() => isolatedAdopt(candidate), /outer-reserved/);
  assert.throws(() => reserve(candidate, tuple), /once/);
  await assert.rejects(extract(options), /pending/);
  assert.equal(discard(transition), true); assert.equal(discard(transition), false);
  assert.equal(validate(transition, expected(options, transition)), false);
  assert.equal(discardCandidate(candidate), false);
  await cleanup(options);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
  assert.ok([options.sourceStateBuffer, options.sourceThermoBuffer, options.sourceMechanicsBuffer].every(({ destroyed }) => destroyed === 0));
});

for (const field of ['device', 'transaction', 'generation', 'sphParticleUpload', 'mlsMpmParticleUpload',
  'sourceStateBuffer', 'sourceThermoBuffer', 'sourceMechanicsBuffer']) {
  test(`reservation rejects copied/foreign original ${field} without reserving or consuming`, async () => {
    const options = fixture(), candidate = await extract(options), tuple = sourceTuple(options);
    assert.throws(() => reserve(candidate, { ...tuple, [field]: { ...tuple[field] } }), /exact original/);
    const transition = reserve(candidate, tuple);
    assert.equal(validate(transition, expected(options, transition)), true);
    discard(transition); await cleanup(options);
  });
}

test('isolated unbound aerosol inventory cannot become an outer transaction transition', async () => {
  const options = fixture({ attach: false }), candidate = await extract(options);
  assert.throws(() => reserve(candidate, sourceTuple(options)), /transaction-owned aerosol/);
  assert.equal(discardCandidate(candidate), true); await cleanup(options);
});

test('pending validation rejects copied descriptors and every mismatched private identity', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  const input = expected(options, transition);
  assert.equal(validate({ ...transition }, input), false);
  for (const field of Object.keys(input)) assert.equal(validate(transition, { ...input, [field]: { ...input[field] } }), false, field);
  assert.equal(validate(transition), false);
  assert.throws(() => discard({ ...transition }), /exact reservation/);
  assert.throws(() => reserve({ ...candidate }, sourceTuple(options)), /exact pending/);
  assert.equal(validate(transition, input), true);
  discard(transition); await cleanup(options);
});

test('reservation uses extraction-time source references, not a later reassigned lineage wrapper', async () => {
  const options = fixture(), original = sourceTuple(options), candidate = await extract(options);
  const wrapper = options.sourceLineage;
  wrapper.transaction = { ...wrapper.transaction };
  assert.throws(() => reserve(candidate, sourceTuple(options)), /exact original/);
  const transition = reserve(candidate, original);
  wrapper.transaction = original.transaction;
  assert.equal(validate(transition, expected(options, transition)), true);
  discard(transition); await cleanup(options);
});

test('a genuine committed transaction is allowed pending context, but not a publication window', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  const { transaction, sphParticleUpload, mlsMpmParticleUpload } = options.sourceLineage;
  sealSchroederSpatialEpochTransactionReaders(transaction);
  sealSchroederSpatialEpochTransactionProposals(transaction);
  const commitReceipt = commitSchroederSpatialEpochTransaction(transaction, {
    nextParticleUploads: { sphParticleUpload: { ...sphParticleUpload, stateBuffer: options.make('other-commit-state') },
      mlsMpmParticleUpload: { ...mlsMpmParticleUpload } }
  });
  assert.equal(transaction.state, 'committed');
  assert.equal(validate(transition, expected(options, transition)), true);
  assert.equal(finalize(transition, { plan: Object.freeze({ transition, commitReceipt }), commitReceipt }), null);
  assert.equal(validate(transition, expected(options, transition)), true);
  assert.equal(sphAerosolParcelFamilyMatchesDevice(transition.aerosolFamily, options.device), false);
  discard(transition); await cleanup(options);
});

test('foreign publication claims cannot submit, consume or activate; fenced discard permits the exact batch again', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  const count = options.device.fenceCount;
  for (const plan of [undefined, null, {}, Object.freeze({ aerosolPublicationWindow: true, transition })]) {
    assert.equal(finalize(transition, { plan, commitReceipt: { published: true, publicationOrdinal: 1 } }), null);
    assert.equal(finalize({ ...transition }, { plan, commitReceipt: {} }), null);
  }
  assert.equal(options.device.fenceCount, count, 'foreign publication has no queue effects');
  assert.equal(validate(transition, expected(options, transition)), true);
  options.device.deferFences = true;
  assert.equal(discard(transition), true);
  await assert.rejects(extract(options), /pending/);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 0));
  await options.device.finishQueue();
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
  const retry = await extract(options), replacement = reserve(retry, sourceTuple(options));
  assert.equal(replacement.aerosolFamily.generation, 1, 'a rejected publication consumed no generation or population');
  discard(replacement); await cleanup(options);
});

test('reentrant or throwing publication input cannot consume a pending candidate or leave its guard latched', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  let calls = 0, recursive;
  const input = { get plan() { calls++; recursive = finalize(transition, input); return {}; } };
  assert.equal(finalize(transition, input), null); assert.equal(recursive, null); assert.equal(calls, 1);
  assert.equal(finalize(transition, input), null); assert.equal(calls, 2);
  assert.equal(finalize(transition, { get plan() { throw new Error('injected input getter'); } }), null);
  assert.equal(finalize(transition, null), null);
  assert.equal(validate(transition, expected(options, transition)), true);
  assert.equal(validate(transition, null), false);
  discard(transition); await cleanup(options);
});

test('the old candidate discard invalidates its reserved transition and fences both halves once', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  await options.device.finishQueue(); options.device.deferFences = true;
  assert.equal(discardCandidate(candidate), true); assert.equal(discard(transition), false);
  assert.equal(validate(transition, expected(options, transition)), false);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 0));
  await cleanup(options);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
});

for (const mode of ['throw', 'reject']) test(`pending discard quarantines ${mode} fence until confirmed loss`, async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  await options.device.finishQueue(); options.device.fenceFailure = mode;
  assert.equal(discard(transition), true);
  await Promise.resolve();
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 0));
  assert.equal(sphAerosolParcelFamilyMatchesDevice(transition.aerosolFamily, options.device), false);
  await options.device.lose(); await cleanup(options);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
  assert.equal(options.device.buffers.find(({ label }) => label === 'ulg-aerosol-initial-population').destroyed, 1);
});

test('confirmed loss automatically discards a reserved transition without activating or double destruction', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  await options.device.lose(); await options.device.finishQueue();
  assert.equal(validate(transition, expected(options, transition)), false);
  assert.equal(discard(transition), false); assert.equal(discardCandidate(candidate), false);
  assert.equal(finalize(transition, { plan: {}, commitReceipt: {} }), null);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
  await cleanup(options);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
});

test('aborted transaction invalidates pending admission even though its immutable source tuple still matches', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  abortSchroederSpatialEpochTransaction(options.sourceLineage.transaction, 'failed outer carrier phase');
  assert.equal(validate(transition, expected(options, transition)), false);
  assert.equal(finalize(transition, { plan: {}, commitReceipt: {} }), null);
  assert.equal(discard(transition), true); await cleanup(options);
});

test('retirement or source-epoch drift closes pending admission without consuming the candidate', async () => {
  const options = fixture(), candidate = await extract(options), transition = reserve(candidate, sourceTuple(options));
  options.sourceLineage.generation.releaseScheduled = true;
  assert.equal(validate(transition, expected(options, transition)), false);
  options.sourceLineage.generation.releaseScheduled = false;
  options.sourceLineage.sphParticleUpload.physicsTick++;
  assert.equal(validate(transition, expected(options, transition)), false);
  options.sourceLineage.sphParticleUpload.physicsTick--;
  assert.equal(validate(transition, expected(options, transition)), true);
  discard(transition); await cleanup(options);
});

for (const failHandler of [1, 2]) test(`loss-handler setup failure ${failHandler} leaves a retryable candidate and no prospective owner`, async () => {
  const options = fixture(), candidate = await extract(options);
  await options.device.finishQueue();
  options.device.failLostSetupAt = options.device.lostSetupCount + failHandler;
  assert.throws(() => reserve(candidate, sourceTuple(options)), /loss-handler setup/);
  const transition = reserve(candidate, sourceTuple(options));
  assert.equal(validate(transition, expected(options, transition)), true);
  discard(transition); await cleanup(options);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
});

test('reentrant transition preparation cannot reserve or isolate a second owner', async () => {
  const options = fixture(), candidate = await extract(options);
  options.device.onLostSetup = () => {
    options.device.onLostSetup = null;
    assert.throws(() => reserve(candidate, sourceTuple(options)), /once/);
    assert.throws(() => isolatedAdopt(candidate), /outer-reserved/);
  };
  const transition = reserve(candidate, sourceTuple(options));
  assert.equal(validate(transition, expected(options, transition)), true);
  discard(transition); await cleanup(options);
});

test('a cancellation during transition setup cannot leave a usable pending descriptor', async () => {
  const options = fixture(), candidate = await extract(options);
  options.device.onLostSetup = () => {
    options.device.onLostSetup = null;
    assert.equal(discardCandidate(candidate), true);
  };
  assert.throws(() => reserve(candidate, sourceTuple(options)), /exact pending/);
  await options.device.finishQueue();
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
  const retry = await extract(options), transition = reserve(retry, sourceTuple(options));
  discard(transition); await cleanup(options);
});

test('a generation-retained read permits extraction after initial-owner release and survives caller-read retirement', async () => {
  const options = fixture(), { device, sourceFamily, sourceLineage } = options;
  releaseSphAerosolParcelFamily(sourceFamily); await device.finishQueue();
  assert.equal(sphAerosolParcelFamilyMatchesDevice(sourceFamily, device), false);
  const read = acquireSphAerosolSpatialParcelRead({ device, family: sourceFamily, ...sourceLineage });
  assert.equal(validateSphAerosolParcelRead(read, { device, family: sourceFamily, expectedGeneration: 0 }), true);
  await assert.rejects(extract(options), /exact live/);
  await assert.rejects(extract({ ...options, sourceRead: { ...read } }), /exact live source read/);
  let releaseMap;
  device.mapGate = new Promise((resolve) => { releaseMap = resolve; });
  const pending = extract({ ...options, sourceRead: read });
  releaseSphAerosolParcelRead(read); await device.finishQueue();
  releaseMap(); const candidate = await pending;
  const transition = reserve(candidate, sourceTuple(options));
  assert.equal(validate(transition, expected(options, transition)), true);
  assert.equal(device.buffers.find(({ label }) => label === 'ulg-aerosol-initial-population').destroyed, 0);
  discard(transition); await device.finishQueue();
  assert.equal(device.buffers.find(({ label }) => label === 'ulg-aerosol-initial-population').destroyed, 0,
    'the actual source transaction still owns its generation capture');
  await cleanup(options);
  assert.equal(device.buffers.find(({ label }) => label === 'ulg-aerosol-initial-population').destroyed, 1);
  assert.ok(candidateOutputs(options).every(({ destroyed }) => destroyed === 1));
});

test('failure installing extraction private-read loss retirement leaves no leaked read or claimed source', async () => {
  const options = fixture(), { device, sourceFamily, sourceLineage } = options;
  const sourceRead = acquireSphAerosolSpatialParcelRead({ device, family: sourceFamily, ...sourceLineage });
  await device.finishQueue();
  device.failLostSetupAt = device.lostSetupCount + 1;
  const before = device.buffers.length;
  await assert.rejects(extract({ ...options, sourceRead }), /loss-handler setup/);
  assert.equal(device.buffers.length, before);
  const candidate = await extract({ ...options, sourceRead });
  discardCandidate(candidate); releaseSphAerosolParcelRead(sourceRead); await cleanup(options);
  assert.equal(device.buffers.find(({ label }) => label === 'ulg-aerosol-initial-population').destroyed, 1);
});
