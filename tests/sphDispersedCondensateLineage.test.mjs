import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSphDispersedMediumOpticalClosureTable } from '../src/runtime/sph/sphDispersedMediumOpticalClosure.js';
import { buildSphDispersedMediumOpticsProducerSeedRows, deriveSphDispersedMediumOpticsProducerReference,
  createSphDispersedMediumOpticsProducerWebGpuEncoderStage } from '../src/runtime/sph/sphDispersedMediumOpticsProducerGpu.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import { SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL } from '../ulg-gpu-abi/src/index.js';

const plan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
  lineageCapacity: 1, primaryCapacity: 1, phaseLaneCount: 4, phaseLaneStride: 1,
  companionStart: 1, companionCapacity: 3, particleCapacity: 4,
  stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true };
const table = buildSphDispersedMediumOpticalClosureTable([{ dispersedMaterialId: 11, vaporPhaseId: 3,
  condensedPhaseId: 2, opticalStateId: 101,
  morphologyModelId: SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius,
  condensedDensityKgPerM3: 1000, scatteringEfficiencyQsca: 2, absorptionEfficiencyQabs: 0,
  asymmetryFactorG: 0.5, effectiveRadiusM: 1e-6 }]);
const seed = () => buildSphDispersedMediumOpticsProducerSeedRows({ phaseCarrierPlan: plan,
  lineageMaterialIds: new Float32Array([11]), opticalClosureTable: table }).rows;

function rows(gasMass, liquidFraction, bulkMass = 2) {
  const state = new Float32Array(32), thermo = new Float32Array(48);
  for (let phase = 1; phase <= 4; phase++) {
    const mass = phase === 2 ? bulkMass : phase === 3 ? gasMass : 0;
    const fractions = phase === 2 ? [0, 1, 0, 0]
      : phase === 3 ? [0, liquidFraction, 1 - liquidFraction, 0] : [0, 0, 0, 0];
    state.set([0, 0, 0, mass, 0, 0, 0, 1], (phase - 1) * 8);
    thermo.set([11, phase, 300, phase === 3 ? 1 : 1000,
      ...fractions, 0.1, mass > 0 ? 1 : 0, 1, 0.01], (phase - 1) * 12);
  }
  return { state, thermo };
}

test('new uncredited extraction omits its condensation credit without subtracting the older carrier optical subset', () => {
  const postReaction = rows(1, 0.5), residual = rows(0.5, 0), terminal = rows(0.5, 0);
  const prior = seed(); prior[8 + 4] = 0.25;
  const result = deriveSphDispersedMediumOpticsProducerReference({ phaseCarrierPlan: plan,
    preReactionState: postReaction.state, preReactionThermo: postReaction.thermo,
    postReactionState: postReaction.state, postReactionThermo: postReaction.thermo,
    preTransferState: residual.state, preTransferThermo: residual.thermo,
    postTransferState: terminal.state, postTransferThermo: terminal.thermo,
    priorOpticsRows: prior, opticalClosureTable: table });
  assert.equal(result.reactionBornMassKg, 0);
  assert.equal(result.gasToCondensedMassKg, 0);
  assert.equal(result.totalDispersedMassKg, 0.25);
  assert.equal(prior[12], 0.25, 'immutable older subset');
});

function reactionCase({ beforeFraction, afterFraction, beforeBulk = 10, afterBulk = 10, selected = true }) {
  const pre = rows(2, beforeFraction, beforeBulk), post = rows(2, afterFraction, afterBulk);
  const residual = rows(2 * (1 - afterFraction), 0, afterBulk);
  const prior = seed(); prior[12] = 2;
  return deriveSphDispersedMediumOpticsProducerReference({ phaseCarrierPlan: plan,
    preReactionState: pre.state, preReactionThermo: pre.thermo,
    postReactionState: post.state, postReactionThermo: post.thermo,
    preTransferState: residual.state, preTransferThermo: residual.thermo,
    postTransferState: residual.state.slice(), postTransferThermo: residual.thermo.slice(),
    priorOpticsRows: prior, opticalClosureTable: table,
    extractedCondensateLineages: selected ? [0] : null });
}

test('fully extracted reaction-born donor cannot use spare bulk mass to double-credit optics', () => {
  const input = { beforeFraction: 0, afterFraction: 0.5 };
  const legacy = reactionCase({ ...input, selected: false });
  assert.equal(legacy.totalDispersedMassKg, 3, 'counterexample: bulk clamp hides the extra aerosol kilogram');
  const result = reactionCase(input);
  assert.equal(result.reactionBornMassKg, 0);
  assert.equal(result.totalDispersedMassKg, 2);
  assert.equal(result.invalidInputRowCount, 0);
});

test('excluding a pre-existing thermal condensate donor preserves unrelated retained reaction births', () => {
  const result = reactionCase({ beforeFraction: 0.5, afterFraction: 0.5, afterBulk: 10.5 });
  assert.equal(result.reactionBornMassKg, 0.5);
  assert.equal(result.totalDispersedMassKg, 2.5);
  assert.equal(result.invalidInputRowCount, 0);
});

test('shrinking donor liquid cannot cancel a surviving carrier reaction birth', () => {
  const input = { beforeFraction: 0.75, afterFraction: 0.5, afterBulk: 10.5 };
  assert.equal(reactionCase({ ...input, selected: false }).reactionBornMassKg, 0);
  const result = reactionCase(input);
  assert.equal(result.reactionBornMassKg, 0.5);
  assert.equal(result.totalDispersedMassKg, 2.5);
  assert.equal(result.invalidInputRowCount, 0);
});

test('CPU exclusion is bounded diagnostic input, not a way to hide invalid pre-reaction fractions', () => {
  const before = rows(2, Number.NaN, 10), post = rows(2, 0.5, 10), residual = rows(1, 0, 10);
  const options = { phaseCarrierPlan: plan, preReactionState: before.state, preReactionThermo: before.thermo,
    postReactionState: post.state, postReactionThermo: post.thermo,
    preTransferState: residual.state, preTransferThermo: residual.thermo,
    postTransferState: residual.state, postTransferThermo: residual.thermo,
    seedOpticsRows: seed(), opticalClosureTable: table };
  assert.ok(deriveSphDispersedMediumOpticsProducerReference({ ...options,
    extractedCondensateLineages: [0] }).invalidInputRowCount > 0);
  for (const value of [[], [1], [-1], [0, 0], [0.5], new Uint32Array([0])]) {
    assert.throws(() => deriveSphDispersedMediumOpticsProducerReference({ ...options,
      extractedCondensateLineages: value }), /lineage|donor reference/);
  }
});

test('explicit post-reaction input pairs reject incomplete or orphaned CPU lineage', () => {
  const r = rows(0.5, 0);
  const options = { phaseCarrierPlan: plan, preTransferState: r.state, preTransferThermo: r.thermo,
    postTransferState: r.state, postTransferThermo: r.thermo, seedOpticsRows: seed(), opticalClosureTable: table };
  assert.throws(() => deriveSphDispersedMediumOpticsProducerReference({ ...options,
    postReactionState: r.state }), /complete reaction/);
  assert.throws(() => deriveSphDispersedMediumOpticsProducerReference({ ...options,
    postReactionState: r.state, postReactionThermo: r.thermo }), /complete reaction/);
});

// Bind-group inspection only, not a numerical GPU oracle.
function gpuFixture() {
  const groups = [], buffers = [];
  const device = { groups, buffers, queue: { writeBuffer() {} },
    limits: { maxStorageBuffersPerShaderStage: 8, maxBufferSize: 2 ** 28,
      maxStorageBufferBindingSize: 2 ** 27, maxUniformBufferBindingSize: 65536,
      maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256,
      maxComputeWorkgroupsPerDimension: 65535 },
    createBuffer(d) { const b = { ...d, bytes: new ArrayBuffer(d.size), destroy() {},
      getMappedRange() { return this.bytes; }, unmap() {} }; buffers.push(b); return b; },
    createBindGroup(d) { groups.push(d); return d; },
    createShaderModule: (d) => d, createBindGroupLayout: (d) => d,
    createPipelineLayout: (d) => d, createComputePipeline: (d) => d };
  const make = (label, size) => tagWebGpuBufferDevice(device.createBuffer({ label, size, usage: 128 }), device);
  const options = { device, phaseCarrierPlan: plan, seedOpticsRows: seed(), opticalClosureTable: table,
    particleLineage: { particleCount: 4, topologyEpoch: 1, identityRevision: 'split-lineage-test',
      identityBuffer: make('identity', 64) } };
  for (const stage of ['preReaction', 'postReaction', 'preTransfer', 'postTransfer']) {
    options[stage + 'StateBuffer'] = make(stage + '-state', 128);
    options[stage + 'ThermoBuffer'] = make(stage + '-thermo', 192);
  }
  return options;
}

test('GPU reaction capture reads actual reaction outputs while transfer reads the different residual pair', () => {
  const f = gpuFixture();
  const stage = createSphDispersedMediumOpticsProducerWebGpuEncoderStage(f);
  const capture = f.device.groups.find((group) => group.label.endsWith('-reaction-capture-bind-group'));
  const transfer = f.device.groups.find((group) => group.label.endsWith('-apply-bind-group'));
  const buffer = (group, binding) => group.entries.find((entry) => entry.binding === binding).resource.buffer;
  assert.equal(buffer(capture, 2), f.postReactionStateBuffer);
  assert.equal(buffer(capture, 3), f.postReactionThermoBuffer);
  assert.equal(buffer(transfer, 0), f.preTransferStateBuffer);
  assert.equal(buffer(transfer, 1), f.preTransferThermoBuffer);
  stage.cleanupSubmittedWork(); stage.result.destroyOutputBuffer();
});

test('explicit reaction output buffers reject wrong device, size or paired roles before allocation', () => {
  for (const mutation of ['device', 'size', 'missing', 'alias']) {
    const f = gpuFixture();
    if (mutation === 'device') f.postReactionStateBuffer = gpuFixture().postReactionStateBuffer;
    if (mutation === 'size') f.postReactionStateBuffer.size = 16;
    if (mutation === 'missing') f.postReactionThermoBuffer = null;
    if (mutation === 'alias') f.postReactionThermoBuffer = f.postReactionStateBuffer;
    const before = f.device.buffers.length;
    assert.throws(() => createSphDispersedMediumOpticsProducerWebGpuEncoderStage(f),
      mutation === 'missing' ? /complete reaction/ : /postReaction|same-device|distinct/);
    assert.equal(f.device.buffers.length, before);
  }
});
