import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS
} from '../ulg-gpu-abi/src/coherentSolid.js';
import {
  COHERENT_SOLID_METAMORPHIC_EVIDENCE_BYTES,
  COHERENT_SOLID_METAMORPHIC_MODE,
  createCoherentSolidMetamorphicValidationGpu,
  decodeCoherentSolidMetamorphicEvidence,
  encodeCoherentSolidMetamorphicSnapshotGpu,
  coherentSolidMetamorphicValidationWgsl
} from '../src/runtime/solid/coherentSolidMetamorphicValidationGpu.js';

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  return {
    buffers,
    pipelines,
    bindGroups,
    writes,
    limits: { maxComputeWorkgroupsPerDimension: 65535 },
    queue: {
      writeBuffer(...args) { writes.push(args); }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout() { return {}; }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    }
  };
}

function createEncoder() {
  const passes = [];
  const copies = [];
  return {
    passes,
    copies,
    beginComputePass(descriptor) {
      const commands = [];
      const pass = {
        descriptor,
        commands,
        setPipeline(value) { commands.push(['pipeline', value]); },
        setBindGroup(index, value) { commands.push(['bind-group', index, value]); },
        dispatchWorkgroups(...shape) { commands.push(['dispatch', ...shape]); },
        end() { commands.push(['end']); }
      };
      passes.push(pass);
      return pass;
    },
    copyBufferToBuffer(...args) { copies.push(args); }
  };
}

function source(device, {
  generationId = 2,
  chartId = 0,
  levelId = 0,
  hierarchyGeneration = 1,
  positionEpoch = 2,
  bodyCount = 2,
  proxyCount = 5
} = {}) {
  const makeBuffer = (label, size) => device.createBuffer({
    label,
    size: Math.max(4, size),
    usage: 128 | 4 | 8,
    destroy() {}
  });
  return {
    device,
    generationId,
    chartId,
    levelId,
    hierarchyGeneration,
    positionEpoch,
    frameSource: {
      device,
      buffer: makeBuffer(
        'frames',
        bodyCount * COHERENT_SOLID_FRAME_WORDS * 4
      ),
      bodyCount,
      strideWords: COHERENT_SOLID_FRAME_WORDS,
      generationId
    },
    worldContactProxies: {
      device,
      buffer: makeBuffer(
        'world-contact-proxies',
        proxyCount * COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS * 4
      ),
      proxyCount,
      strideWords: COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS,
      generationId,
      chartId,
      levelId,
      hierarchyGeneration,
      positionEpoch
    },
    instanceBodyIndexBuffer: makeBuffer('draw-indices', bodyCount * 4),
    drawCount: bodyCount
  };
}

test('coherent-solid metamorphic validation reduces full GPU rows to fixed evidence', () => {
  assert.match(coherentSolidMetamorphicValidationWgsl, /@compute @workgroup_size\(64\)/);
  assert.match(coherentSolidMetamorphicValidationWgsl, /validation_dispatch_x/);
  assert.match(
    coherentSolidMetamorphicValidationWgsl,
    /MODE_PARTITION_EQUIVALENCE && !partition_metadata_matches/
  );
  assert.match(coherentSolidMetamorphicValidationWgsl, /ordered_before/);
  assert.match(
    coherentSolidMetamorphicValidationWgsl,
    /previous_body_id == body_id && previous_proxy_id < proxy_id/
  );
  assert.match(coherentSolidMetamorphicValidationWgsl, /left_frames/);
  assert.match(coherentSolidMetamorphicValidationWgsl, /linear_momentum_x_kg_m_s|left_base \+ 20u/);
  assert.match(coherentSolidMetamorphicValidationWgsl, /right_world_proxies/);
  assert.match(coherentSolidMetamorphicValidationWgsl, /right_draw_indices/);
  assert.match(coherentSolidMetamorphicValidationWgsl, /evidence\[31\]/);
  assert.equal(COHERENT_SOLID_METAMORPHIC_EVIDENCE_BYTES, 128);
});

test('production acceptance maps fixed reductions instead of proxy or draw row arrays', () => {
  const source = readFileSync(
    new URL('../scripts/coherent-solid-production-bridge-probe.mjs', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(source, /readAllWorldContactProxies/);
  assert.doesNotMatch(source, /readDrawInstanceBodyIndices/);
  assert.match(source, /compareMetamorphicPublications/);
  assert.match(source, /mappedEvidenceBytes === 128/);
  assert.match(source, /transition\.before\.snapshot\.hostMappedBytes === 0/);
});

test('metamorphic validator encodes on a caller command buffer without submitting or mapping', () => {
  const device = createFakeDevice();
  const validator = createCoherentSolidMetamorphicValidationGpu(device);
  const encoder = createEncoder();
  const execution = validator.encode(encoder, {
    left: source(device),
    right: source(device),
    mode: COHERENT_SOLID_METAMORPHIC_MODE.partitionEquivalence
  });
  assert.equal(device.pipelines.length, 3);
  assert.equal(device.writes.length, 1);
  assert.deepEqual(device.bindGroups.map(({ entries }) => entries.length), [2, 8, 2]);
  assert.equal(encoder.passes.length, 3);
  assert.deepEqual(encoder.passes.map((pass) => pass.commands.at(-2)), [
    ['dispatch', 1, 1, 1],
    ['dispatch', 1, 1, 1],
    ['dispatch', 1, 1, 1]
  ]);
  assert.equal(execution.evidenceByteLength, 128);
  assert.equal(execution.fullStateReadbackPerformed, false);
  assert.equal(execution.queueSubmissionPerformed, false);
  assert.equal(execution.executionShape.workgroupSize, 64);
  assert.equal(execution.executionShape.validationExtent, 5);
  assert.deepEqual(execution.executionShape.reductionPasses, [
    'initialize',
    'validate',
    'finalize'
  ]);
  assert.equal(execution.readbackPolicy, 'fixed-evidence-only-explicit-validation');
  assert.equal(execution.release(), true);
  assert.equal(execution.release(), false);
  assert.equal(validator.destroy(), true);
  assert.equal(validator.destroy(), false);
});

test('chart snapshots remain same-device GPU copies and retain no host state rows', () => {
  const device = createFakeDevice();
  const encoder = createEncoder();
  const input = source(device, { bodyCount: 3, proxyCount: 7 });
  const snapshot = encodeCoherentSolidMetamorphicSnapshotGpu(
    device,
    encoder,
    input
  );
  assert.equal(encoder.copies.length, 3);
  assert.equal(snapshot.source.device, device);
  assert.equal(snapshot.source.frameSource.bodyCount, 3);
  assert.equal(snapshot.source.worldContactProxies.proxyCount, 7);
  assert.equal(snapshot.hostMappedBytes, 0);
  assert.equal(snapshot.fullStateReadbackPerformed, false);
  assert.equal(snapshot.release(), true);
  assert.equal(snapshot.release(), false);
});

test('metamorphic row reduction partitions large validation extents over 2D dispatch', () => {
  const device = createFakeDevice();
  device.limits.maxComputeWorkgroupsPerDimension = 4;
  const validator = createCoherentSolidMetamorphicValidationGpu(device);
  const encoder = createEncoder();
  const execution = validator.encode(encoder, {
    left: source(device, { bodyCount: 600, proxyCount: 0 }),
    right: source(device, { bodyCount: 600, proxyCount: 0 })
  });
  assert.deepEqual(execution.executionShape.dispatch, [4, 3, 1]);
  assert.deepEqual(encoder.passes[1].commands.at(-2), ['dispatch', 4, 3, 1]);
  execution.release();
});

test('metamorphic validation rejects cross-device and generation-forked sources', () => {
  const device = createFakeDevice();
  const otherDevice = createFakeDevice();
  const validator = createCoherentSolidMetamorphicValidationGpu(device);
  assert.throws(() => validator.encode(createEncoder(), {
    left: source(device),
    right: source(otherDevice)
  }), /validator WebGPU device/);
  assert.throws(() => validator.encode(createEncoder(), {
    left: source(device),
    right: source(device),
    mode: 'toString'
  }), /unsupported coherent-solid metamorphic mode/);
  const forked = source(device);
  forked.frameSource.generationId = 99;
  assert.throws(() => validator.encode(createEncoder(), {
    left: forked,
    right: source(device)
  }), /exact same-device generation/);
});

test('fixed metamorphic evidence decoder exposes only reduced counters and residuals', () => {
  assert.throws(
    () => decodeCoherentSolidMetamorphicEvidence(new Uint32Array(33)),
    /exactly 32 u32 words/
  );
  const words = new Uint32Array(32);
  words[0] = 0x534f4c4d;
  words[1] = 1;
  words[2] = 1;
  words[3] = 1;
  words[4] = 600;
  words[5] = 600;
  words[6] = 65;
  words[7] = 65;
  words[31] = 3;
  const decoded = decodeCoherentSolidMetamorphicEvidence(words);
  assert.equal(decoded.mode, COHERENT_SOLID_METAMORPHIC_MODE.chartTransitionContinuity);
  assert.equal(decoded.numericallyAdmissible, true);
  assert.equal(decoded.leftBodyCount, 600);
  assert.equal(decoded.leftProxyCount, 65);
  assert.equal(decoded.mappedEvidenceBytes, 128);
  assert.equal(decoded.fullStateReadbackPerformed, false);
  assert.equal(decoded.readbackMode, 'fixed-gpu-reduction-evidence-only');
});
