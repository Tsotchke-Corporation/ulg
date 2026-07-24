import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT,
  SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_LAYOUT,
  ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA,
  createSchroederSpatialAggregateMortonKey,
  createSchroederSpatialAggregatePrefixShape,
  createSchroederSpatialAggregateViewLayout,
  createSchroederSpatialAggregateViewPlan,
  reduceSchroederSpatialAggregateCpuOracle,
  traverseSchroederSpatialAggregateCpuOracle,
  validateSchroederSpatialAggregateViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
import {
  schroederSpatialAggregateStacklessTraversalWgsl,
  schroederSpatialAggregateViewWgsl
} from '../ulg-gpu-abi/src/schroederSpatialAggregateViewWgsl.js';
import {
  ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
  createSchroederSpatialEpochLayout
} from '../ulg-gpu-abi/src/schroederSpatialEpoch.js';
import {
  createSchroederSpatialAggregateViewGpu
} from '../src/runtime/sph/schroederSpatialAggregateViewGpu.js';
import {
  createSchroederSpatialAggregateTraversalGpu,
  finalizeSchroederSpatialAggregateTraversalSubmissionReceipt,
  isFinalizedSchroederSpatialAggregateTraversalSubmissionReceipt
} from '../src/runtime/sph/schroederSpatialAggregateTraversalGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
      maxStorageBuffersPerShaderStage: 12,
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
      maxComputeWorkgroupsPerDimension: 65535
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, data });
      }
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
    resolveLost: lost.resolve,
    rejectLost: lost.reject
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

const epochIdentity = Object.freeze({
  storageGeneration: 9,
  positionEpoch: 10,
  topologyEpoch: 11,
  chartEpoch: 12,
  levelEpoch: 13,
  supportEpoch: 14
});

function taggedBuffer(device, label, size) {
  return tagWebGpuBufferDevice({ label, size, destroy() {} }, device);
}

function createAuthorities(device, { sourceCount = 3, sourceCapacity = 4 } = {}) {
  const layout = createSchroederSpatialEpochLayout({
    sourceCapacity,
    cellCapacity: sourceCapacity
  });
  const directoryBuffer = taggedBuffer(device, 'directory', layout.byteLength);
  const sourceBuffer = taggedBuffer(device, 'level-assignment', sourceCapacity * 16 * 4);
  const stateBuffer = taggedBuffer(device, 'state', sourceCount * 8 * 4);
  const thermoBuffer = taggedBuffer(device, 'thermo', sourceCount * 12 * 4);
  const identityBuffer = taggedBuffer(device, 'identity', sourceCount * 4);
  const ownerRuntime = { ownsExecution: () => true };
  const spatialExecution = {
    schema: ULG_SCHROEDER_SPATIAL_EPOCH_SCHEMA,
    status: 'schroeder-spatial-epoch-gpu-encoded',
    released: false,
    ownerRuntime,
    directoryBuffer,
    sourceBuffer,
    sourceCount,
    sourceCapacity,
    sourceRowLayoutId: 1,
    sourceAdapterId: 2,
    layout,
    generationId: 21,
    deviceOrdinal: 22,
    laneOrdinal: 23,
    leaseToken: 24,
    sourceFamilyId: 25,
    physicsTick: 26,
    physicsSubstep: 27,
    buildOrdinal: 21,
    sortUniqueOrdinal: 21,
    ...epochIdentity
  };
  const spatialSource = {
    ready: true,
    sourceBuffer,
    sourceStateBuffer: stateBuffer,
    sourceStateBufferBorrowed: true,
    sourceCount,
    ...epochIdentity
  };
  const particleBufferSet = {
    status: 'webgpu-uploaded',
    particleCount: sourceCount,
    stateBuffer,
    thermoBuffer,
    identityBuffer,
    stateStrideBytes: 8 * 4,
    thermoStrideBytes: 12 * 4,
    identityStrideBytes: 4,
    ...epochIdentity
  };
  return { spatialExecution, spatialSource, particleBufferSet };
}

function oneParticlePerCellFixture(cellCount) {
  const cellKeys = new Uint32Array(cellCount * 5);
  const cellOffsets = new Uint32Array(cellCount + 1);
  const cellMembers = new Uint32Array(cellCount);
  const state = new Float32Array(cellCount * 8);
  const thermo = new Float32Array(cellCount * 12);
  const identity = new Uint32Array(cellCount);
  for (let index = 0; index < cellCount; index += 1) {
    const z = index % 15;
    const y = Math.floor(index / 15) % 17;
    const x = Math.floor(index / (15 * 17));
    cellKeys.set([
      0,
      0x8000_0000,
      (0x8000_0000 + x) >>> 0,
      (0x8000_0000 + y) >>> 0,
      (0x8000_0000 + z) >>> 0
    ], index * 5);
    cellOffsets[index] = index;
    cellMembers[index] = index;
    state.set([x * 2, y * 2, z * 2, 1, 0, 1, 0, 2], index * 8);
    thermo.set([1, 1, 300, 1, 1, 0, 0, 0, 0, 1, 1, 0.1], index * 12);
    identity[index] = index;
  }
  cellOffsets[cellCount] = cellCount;
  return { cellKeys, cellOffsets, cellMembers, state, thermo, identity };
}

function allDormantLevelAssignmentFixture(sourceCount = 2) {
  const cellKeys = new Uint32Array(sourceCount * 5);
  const cellOffsets = new Uint32Array(sourceCount + 1);
  const cellMembers = new Uint32Array(sourceCount);
  const sourceRows = new Float32Array(sourceCount * 16);
  const state = new Float32Array(sourceCount * 8);
  const thermo = new Float32Array(sourceCount * 12);
  const identity = new Uint32Array(sourceCount);
  thermo.fill(Number.NaN);
  for (let index = 0; index < sourceCount; index += 1) {
    cellKeys.set([
      0,
      0x8000_0000,
      (0x8000_0000 + index) >>> 0,
      0x8000_0000,
      0x8000_0000
    ], index * 5);
    cellOffsets[index] = index;
    cellMembers[index] = index;
    state.set([
      index,
      0,
      0,
      0,
      Number.NaN,
      Number.NaN,
      Number.NaN,
      Number.NaN
    ], index * 8);
    sourceRows.set([
      0, 1, 0, 0, 0, 0, 0, 0,
      index + 1, 26, 1, 0,
      index, 0, 0, 0
    ], index * 16);
  }
  cellOffsets[sourceCount] = sourceCount;
  return {
    cellKeys,
    cellOffsets,
    cellMembers,
    sourceRows,
    sourceRowLayoutId: 1,
    sourceCount,
    state,
    thermo,
    identity
  };
}

function signedOrderKey(value) {
  return ((Number(value) >>> 0) ^ 0x8000_0000) >>> 0;
}

function canonicalSparseFixture(cells) {
  const ordered = cells.map((cell, sourceIndex) => ({ ...cell, sourceIndex }))
    .sort((left, right) => {
      const leftKey = [
        left.chart,
        signedOrderKey(left.level),
        signedOrderKey(left.x),
        signedOrderKey(left.y),
        signedOrderKey(left.z)
      ];
      const rightKey = [
        right.chart,
        signedOrderKey(right.level),
        signedOrderKey(right.x),
        signedOrderKey(right.y),
        signedOrderKey(right.z)
      ];
      for (let word = 0; word < leftKey.length; word += 1) {
        if (leftKey[word] !== rightKey[word]) return leftKey[word] - rightKey[word];
      }
      return 0;
    });
  const count = ordered.length;
  const fixture = {
    cellKeys: new Uint32Array(count * 5),
    cellOffsets: new Uint32Array(count + 1),
    cellMembers: new Uint32Array(count),
    state: new Float32Array(count * 8),
    thermo: new Float32Array(count * 12),
    identity: new Uint32Array(count)
  };
  ordered.forEach((cell, canonicalIndex) => {
    fixture.cellKeys.set([
      cell.chart,
      signedOrderKey(cell.level),
      signedOrderKey(cell.x),
      signedOrderKey(cell.y),
      signedOrderKey(cell.z)
    ], canonicalIndex * 5);
    fixture.cellOffsets[canonicalIndex] = canonicalIndex;
    fixture.cellMembers[canonicalIndex] = canonicalIndex;
    fixture.state.set([
      cell.x,
      cell.y,
      cell.z,
      1,
      0,
      0,
      0,
      1
    ], canonicalIndex * 8);
    fixture.thermo.set([
      1, 1, 300, 1, 1, 0, 0, 0, 0, 1, 1, 0.1
    ], canonicalIndex * 12);
    fixture.identity[canonicalIndex] = cell.sourceIndex;
  });
  fixture.cellOffsets[count] = count;
  return fixture;
}

test('Morton key interleaves signed-order x/y/z lanes without permutation', () => {
  const prefix = [7, 0x8000_0000];
  const origin = 0x8000_0000;
  assert.deepEqual(
    createSchroederSpatialAggregateMortonKey([
      ...prefix, origin, origin, origin
    ]),
    [7, 0x8000_0000, 0xe000_0000, 0, 0]
  );
  assert.deepEqual(
    createSchroederSpatialAggregateMortonKey([
      ...prefix, origin + 1, origin, origin
    ]),
    [7, 0x8000_0000, 0xe000_0000, 0, 4]
  );
  assert.deepEqual(
    createSchroederSpatialAggregateMortonKey([
      ...prefix, origin, origin + 1, origin
    ]),
    [7, 0x8000_0000, 0xe000_0000, 0, 2]
  );
  assert.deepEqual(
    createSchroederSpatialAggregateMortonKey([
      ...prefix, origin, origin, origin + 1
    ]),
    [7, 0x8000_0000, 0xe000_0000, 0, 1]
  );
});

test('aggregate ABI reserves a canonical-leaf compressed Morton-prefix tree above 4096 leaves', () => {
  assert.equal(SCHROEDER_SPATIAL_AGGREGATE_VIEW_HEADER_LAYOUT.length, 112);
  assert.equal(SCHROEDER_SPATIAL_AGGREGATE_VIEW_RECORD_LAYOUT.length, 44);
  const shape = createSchroederSpatialAggregatePrefixShape(4097);
  assert.equal(shape.treeArity, 2);
  assert.equal(shape.prefixBitCount, 160);
  assert.equal(shape.internalRecordCount, 4096);
  assert.equal(shape.recordCount, 8193);
  assert.equal(shape.rootRecordIndex, 4097);
  const layout = createSchroederSpatialAggregateViewLayout({ cellCapacity: 4097 });
  assert.equal(layout.treeArity, 2);
  assert.equal(layout.maxRecordCount, 8193);
  assert.equal(layout.wordLength, 112 + 8193 * 44);
  assert.equal(layout.dispatchWordLength, 9);
  const plan = createSchroederSpatialAggregateViewPlan({
    sourceCount: 4097,
    sourceCapacity: 8192,
    cellCapacity: 4097,
    sourceRowLayoutId: 1,
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
    supportEpoch: 13
  });
  assert.equal(
    plan.constructionComplexity,
    'O(sourceCount*keyWords+cellCount*prefixDepth)'
  );
  assert.equal(plan.contributionRowCapacity, 0);
  assert.equal(plan.materializedCandidateRows, false);
  assert.equal(plan.perSourceCandidateBudget, null);
});

test('CPU aggregate oracle conserves mass, moments, momentum, angular momentum, and energies', () => {
  const state = new Float32Array([
    0, 0, 0, 1, 1, 0, 0, 10,
    2, 0, 0, 2, 0, 2, 0, 20,
    0, 1, 0, 3, 0, 0, 1, 30
  ]);
  const thermo = new Float32Array(3 * 12);
  const rows = [
    [26, 1, 300, 7800, 1, 0, 0, 0, 0.1, 1, 1, 0.1],
    [26, 1, 300, 7800, 1, 0, 0, 0, 0.1, 1, 1, 0.2],
    [8, 2, 300, 1000, 0, 1, 0, 0, 0.1, 1, 1, 0.3]
  ];
  rows.forEach((row, index) => thermo.set(row, index * 12));
  const result = reduceSchroederSpatialAggregateCpuOracle({
    cellKeys: new Uint32Array([
      0, 0x80000000, 0x80000000, 0x80000000, 0x80000000,
      0, 0x80000000, 0x80000001, 0x80000000, 0x80000000
    ]),
    cellOffsets: new Uint32Array([0, 2, 3]),
    cellMembers: new Uint32Array([0, 2, 1]),
    state,
    thermo,
    identity: new Uint32Array([1, 1, 2])
  });
  assert.equal(result.leaves.length, 2);
  assert.equal(result.shape.internalRecordCount, 1);
  assert.deepEqual(result.mortonLeafIndices, [0, 1]);
  assert.equal(result.contributionRowCount, 0);
  assert.equal(result.materializedCandidateRowCount, 0);
  assert.equal(result.root.massKg, 6);
  assert.deepEqual(result.root.firstMassMomentKgM, [4, 3, 0]);
  assert.deepEqual(result.root.linearMomentumKgMPerS, [1, 4, 3]);
  assert.deepEqual(result.root.orbitalAngularMomentumKgM2PerS, [3, 0, 8]);
  assert.equal(result.root.internalEnergyJ, 140);
  assert.equal(result.root.kineticEnergyJ, 6);
  assert.equal(result.root.homogeneousMaterialId, 0xffff_ffff);
  assert.equal(result.root.homogeneousPhaseId, 0xffff_ffff);
  assert.equal(result.root.phaseMask, 0b110);
  assert.ok(result.root.boundingRadiusM > 1.62);
  assert.ok(result.root.boundingRadiusM < 1.63);
});

test('CPU aggregate oracle authenticates dormant phase lanes without adding them to physical summaries', () => {
  const lineageCapacity = 3;
  const phaseLaneCount = 4;
  const sourceCount = lineageCapacity * phaseLaneCount;
  const state = new Float32Array(sourceCount * 8);
  const thermo = new Float32Array(sourceCount * 12);
  const identity = new Uint32Array(sourceCount);
  const sourceRows = new Float32Array(sourceCount * 16);
  for (let index = 0; index < sourceCount; index += 1) {
    const phaseLane = Math.floor(index / lineageCapacity);
    const lineage = index % lineageCapacity;
    const active = index === 0 || index === lineageCapacity + 1;
    const massKg = index === 0 ? 2 : index === lineageCapacity + 1 ? 3 : 0;
    const position = [lineage * 2, 0, 0];
    state.set([
      ...position,
      massKg,
      active ? (index === 0 ? 3 : 0) : Number.NaN,
      active ? (index === 0 ? 0 : 2) : Number.NaN,
      active ? 0 : Number.NaN,
      active ? (index === 0 ? 10 : 20) : Number.NaN
    ], index * 8);
    if (active) {
      thermo.set([
        26,
        phaseLane + 1,
        300,
        7800,
        phaseLane === 0 ? 1 : 0,
        phaseLane === 1 ? 1 : 0,
        phaseLane === 2 ? 1 : 0,
        phaseLane === 3 ? 1 : 0,
        0.1,
        1,
        1,
        0.1
      ], index * 12);
    } else {
      thermo.fill(Number.NaN, index * 12, index * 12 + 12);
    }
    sourceRows.set([
      0,
      1,
      active ? 0.1 : 0,
      active ? 0.001 : 0,
      active ? 0.001 : 0,
      active ? 0.001 : 0,
      massKg,
      active ? 7800 : 0,
      phaseLane + 1,
      26,
      1,
      0,
      ...position,
      0
    ], index * 16);
    identity[index] = lineage + 1;
  }
  const cellMembers = new Uint32Array([
    0, 3, 6, 9,
    1, 4, 7, 10,
    2, 5, 8, 11
  ]);
  const result = reduceSchroederSpatialAggregateCpuOracle({
    cellKeys: new Uint32Array([
      0, 0x80000000, 0x80000000, 0x80000000, 0x80000000,
      0, 0x80000000, 0x80000001, 0x80000000, 0x80000000,
      0, 0x80000000, 0x80000002, 0x80000000, 0x80000000
    ]),
    cellOffsets: new Uint32Array([0, 4, 8, 12]),
    cellMembers,
    sourceRows,
    sourceRowLayoutId: 1,
    sourceCount,
    state,
    thermo,
    identity
  });
  assert.equal(result.sourceCount, 12);
  assert.equal(result.activeParticleCount, 2);
  assert.equal(result.dormantSourceCount, 10);
  assert.equal(result.root.sourceMemberCount, 12);
  assert.equal(result.root.particleCount, 2);
  assert.equal(result.root.massKg, 5);
  assert.equal(result.root.internalEnergyJ, 80);
  assert.equal(result.root.kineticEnergyJ, 15);
  assert.equal(result.root.phaseMask, 0b110);
  assert.equal(result.root.homogeneousMaterialId, 26);
  assert.equal(result.root.homogeneousPhaseId, 0xffff_ffff);
  const activeRadius = thermo[11];
  assert.deepEqual(result.root.aabbMinM, [
    -activeRadius,
    -activeRadius,
    -activeRadius
  ]);
  assert.deepEqual(result.root.aabbMaxM, [
    2 + activeRadius,
    activeRadius,
    activeRadius
  ]);
  assert.equal(result.leaves[0].sourceMemberCount, 4);
  assert.equal(result.leaves[0].particleCount, 1);
  assert.equal(result.leaves[1].sourceMemberCount, 4);
  assert.equal(result.leaves[1].particleCount, 1);
  assert.equal(result.leaves[2].sourceMemberCount, 4);
  assert.equal(result.leaves[2].particleCount, 0);
  assert.equal(result.leaves[2].massKg, 0);
  assert.deepEqual(result.leaves[2].aabbMinM, [0, 0, 0]);
  assert.deepEqual(result.leaves[2].aabbMaxM, [0, 0, 0]);
  assert.deepEqual(result.leaves[2].centerOfMassM, [0, 0, 0]);
  assert.equal(result.leaves[2].boundingRadiusM, 0);
  assert.deepEqual(result.leaves[2].materialBloomMask, [0, 0, 0, 0]);
  assert.equal(result.leaves[2].phaseMask, 0);
  assert.deepEqual(
    Array.from(cellMembers.slice(0, 4)),
    Array.from({ length: phaseLaneCount }, (_, lane) => lane * lineageCapacity)
  );
});

test('CPU aggregate oracle fails closed on malformed dormant authority and traverses all-empty trees finitely', () => {
  const fixture = allDormantLevelAssignmentFixture(2);
  const aggregate = reduceSchroederSpatialAggregateCpuOracle(fixture);
  assert.equal(aggregate.root.sourceMemberCount, 2);
  assert.equal(aggregate.root.particleCount, 0);
  for (const record of aggregate.records) {
    assert.deepEqual(record.aabbMinM, [0, 0, 0]);
    assert.deepEqual(record.aabbMaxM, [0, 0, 0]);
    assert.deepEqual(record.centerOfMassM, [0, 0, 0]);
    assert.equal(record.boundingRadiusM, 0);
  }
  const traversal = traverseSchroederSpatialAggregateCpuOracle({
    aggregate,
    queryPositionM: [100, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5
  });
  assert.equal(traversal.coveredLeafCount, 2);
  assert.equal(traversal.emptyNodes.length, 1);
  assert.equal(traversal.emptyAggregate.sourceMemberCount, 2);
  assert.deepEqual(traversal.emptyAggregate.aabbMinM, [0, 0, 0]);
  assert.deepEqual(traversal.farAggregate.aabbMinM, [0, 0, 0]);
  assert.deepEqual(traversal.nearAggregate.aabbMinM, [0, 0, 0]);

  const nonzeroDormantExtent = {
    ...fixture,
    sourceRows: fixture.sourceRows.slice()
  };
  nonzeroDormantExtent.sourceRows[2] = 0.1;
  assert.throws(
    () => reduceSchroederSpatialAggregateCpuOracle(nonzeroDormantExtent),
    /source mechanical authority mismatched state/
  );

  const missingDormantMember = {
    ...fixture,
    cellOffsets: new Uint32Array([0, 1]),
    cellMembers: new Uint32Array([0]),
    cellKeys: fixture.cellKeys.slice(0, 5)
  };
  assert.throws(
    () => reduceSchroederSpatialAggregateCpuOracle(missingDormantMember),
    /exactly cover the declared source count/
  );

  const activeNodeWithoutMassAuthority = {
    ...fixture,
    sourceRows: fixture.sourceRows.slice(),
    sourceRowLayoutId: 2
  };
  activeNodeWithoutMassAuthority.sourceRows[10] = 0;
  activeNodeWithoutMassAuthority.sourceRows[9] = 0.1;
  assert.throws(
    () => reduceSchroederSpatialAggregateCpuOracle(activeNodeWithoutMassAuthority),
    /source mechanical authority mismatched state/
  );
});

test('CPU aggregate oracle builds one compressed spatial-prefix tree above 4096 leaves', () => {
  const result = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(4097)
  );
  assert.equal(result.shape.internalRecordCount, 4096);
  assert.equal(result.records.length, 8193);
  assert.equal(new Set(result.mortonLeafIndices).size, 4097);
  assert.equal(result.root.massKg, 4097);
  assert.deepEqual(result.root.linearMomentumKgMPerS, [0, 4097, 0]);
  assert.equal(result.root.internalEnergyJ, 8194);
  assert.equal(result.root.kineticEnergyJ, 2048.5);
  assert.equal(result.root.particleCount, 4097);
  assert.equal(result.root.subtreeLeafBegin, 0);
  assert.equal(result.root.subtreeLeafEnd, 4097);
  assert.equal(result.root.escapeRecordIndex, 0xffff_ffff);
  assert.ok(result.internals.every((record) => (
    record.subtreeLeafEnd - record.subtreeLeafBegin >= 2
  )));
  assert.notEqual(result.topologyFingerprint, 0);
});

test('Morton-prefix topology is a canonical-cell bijection across signed sparse mixed domains', () => {
  const aggregate = reduceSchroederSpatialAggregateCpuOracle(
    canonicalSparseFixture([
      { chart: 0, level: -1, x: -17, y: 0, z: 4 },
      { chart: 0, level: -1, x: -1, y: -1, z: -1 },
      { chart: 0, level: -1, x: 0, y: 0, z: 0 },
      { chart: 0, level: -1, x: 1_000_000, y: 3, z: -9 },
      { chart: 0, level: 0, x: -1, y: -1, z: -1 },
      { chart: 0, level: 0, x: 0, y: 0, z: 0 },
      { chart: 1, level: 0, x: 0, y: 0, z: 0 },
      { chart: 1, level: 0, x: 0, y: 0, z: 1 },
      { chart: 1, level: 1, x: 0, y: 0, z: 0 }
    ])
  );
  assert.deepEqual(
    [...aggregate.mortonLeafIndices].sort((left, right) => left - right),
    Array.from({ length: 9 }, (_, index) => index)
  );
  assert.equal(aggregate.records.length, 17);
  assert.equal(aggregate.root.particleCount, 9);
  assert.ok(aggregate.internals.every((record) => {
    const left = aggregate.records[record.childBeginRecordIndex];
    const right = aggregate.records[record.childEndRecordIndex];
    return left.parentRecordIndex === record.recordIndex
      && right.parentRecordIndex === record.recordIndex
      && left.subtreeLeafBegin === record.subtreeLeafBegin
      && left.subtreeLeafEnd === right.subtreeLeafBegin
      && right.subtreeLeafEnd === record.subtreeLeafEnd;
  }));
  const traversal = traverseSchroederSpatialAggregateCpuOracle({
    aggregate,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 0.25,
    openingTheta: 0.5
  });
  assert.equal(traversal.coveredLeafCount, 9);
  assert.equal(traversal.partitionStatus, 'exact-no-overlap-no-gap');
});

test('canonical leaves retain directory authority across a noncanonical source permutation', () => {
  const fixture = oneParticlePerCellFixture(4);
  fixture.cellMembers.set([3, 1, 0, 2]);
  const aggregate = reduceSchroederSpatialAggregateCpuOracle(fixture);
  assert.deepEqual(
    aggregate.leaves.map((leaf) => leaf.centerOfMassM),
    [
      [0, 0, 6],
      [0, 0, 2],
      [0, 0, 0],
      [0, 0, 4]
    ]
  );
  assert.deepEqual(
    [...aggregate.mortonLeafIndices].sort((left, right) => left - right),
    [0, 1, 2, 3]
  );
  assert.equal(aggregate.root.particleCount, 4);
  const traversal = traverseSchroederSpatialAggregateCpuOracle({
    aggregate,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 0.25,
    openingTheta: 0.5
  });
  assert.equal(traversal.coveredLeafCount, 4);
  assert.equal(traversal.partitionStatus, 'exact-no-overlap-no-gap');
});

test('spatial-prefix opening materially prunes the non-power-of-two 4097-cell lattice', () => {
  const aggregate = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(4097)
  );
  let visitedNodeCount = 0;
  let acceptedInternalCount = 0;
  let sampleCount = 0;
  for (let cellIndex = 0; cellIndex < 4097; cellIndex += 137) {
    const z = cellIndex % 15;
    const y = Math.floor(cellIndex / 15) % 17;
    const x = Math.floor(cellIndex / (15 * 17));
    const traversal = traverseSchroederSpatialAggregateCpuOracle({
      aggregate,
      queryPositionM: [x * 2, y * 2, z * 2],
      nearFieldRadiusM: 0.25,
      openingTheta: 0.5
    });
    visitedNodeCount += traversal.visitedNodeCount;
    acceptedInternalCount += traversal.farNodes.filter(
      (record) => record.kind === 'internal'
    ).length;
    sampleCount += 1;
  }
  const averageVisitedNodeCount = visitedNodeCount / sampleCount;
  assert.ok(averageVisitedNodeCount <= aggregate.records.length * 0.25);
  assert.ok(acceptedInternalCount > 0);
});

test('stackless opening produces an exact no-double-count near/far leaf partition', () => {
  const aggregate = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(130)
  );
  const result = traverseSchroederSpatialAggregateCpuOracle({
    aggregate,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 0.25,
    openingTheta: 0.5,
    expected: {
      replayGuardToken: aggregate.replayGuardToken,
      topologyFingerprint: aggregate.topologyFingerprint
    }
  });
  assert.equal(result.partitionStatus, 'exact-no-overlap-no-gap');
  assert.equal(result.coveredLeafCount, 130);
  assert.equal(result.nearLeaves.length, 1);
  assert.equal(result.nearLeaves[0].recordIndex, 0);
  assert.ok(result.farNodes.length > 0);
  assert.ok(result.decisions.some((entry) => entry.decision === 'open'));
  assert.ok(result.decisions.some((entry) => entry.decision === 'far-aggregate'));
  assert.equal(result.materializedCandidateRowCount, 0);
  assert.equal(result.perSourceCandidateBudget, null);
  const covered = result.coverage.flatMap((span) => (
    Array.from({ length: span.end - span.begin }, (_, index) => span.begin + index)
  ));
  assert.deepEqual(covered, Array.from({ length: 130 }, (_, index) => index));
  assert.equal(
    result.farAggregate.massKg + result.nearAggregate.massKg,
    aggregate.root.massKg
  );

  const distant = traverseSchroederSpatialAggregateCpuOracle({
    aggregate,
    queryPositionM: [10000, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 1
  });
  assert.equal(distant.farNodes.length, 1);
  assert.equal(distant.farNodes[0], aggregate.root);
  assert.equal(distant.nearLeaves.length, 0);
});

test('CPU oracle and traversal reject malformed source replay and topology replay', () => {
  const malformed = oneParticlePerCellFixture(2);
  malformed.cellMembers[1] = 0;
  assert.throws(
    () => reduceSchroederSpatialAggregateCpuOracle(malformed),
    /replayed or out-of-range source/
  );
  const aggregate = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(2)
  );
  assert.throws(() => traverseSchroederSpatialAggregateCpuOracle({
    aggregate,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5,
    expected: { replayGuardToken: aggregate.replayGuardToken + 1 }
  }), /replayed replayGuardToken/);
  aggregate.records[0].escapeRecordIndex = 0xffff_ffff;
  assert.throws(() => traverseSchroederSpatialAggregateCpuOracle({
    aggregate,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5
  }), /malformed topology authority/);

  const keyCorruption = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(3)
  );
  keyCorruption.records[0].mortonKey = [...keyCorruption.records[0].mortonKey];
  keyCorruption.records[0].mortonKey[4] ^= 1;
  assert.throws(() => traverseSchroederSpatialAggregateCpuOracle({
    aggregate: keyCorruption,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5
  }), /malformed topology authority/);

  const kindCorruption = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(3)
  );
  kindCorruption.records[0].kind = 'internal';
  assert.throws(() => traverseSchroederSpatialAggregateCpuOracle({
    aggregate: kindCorruption,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5
  }), /malformed topology authority/);

  const sourceMemberCorruption = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(3)
  );
  sourceMemberCorruption.records[0].sourceMemberCount += 1;
  assert.throws(() => traverseSchroederSpatialAggregateCpuOracle({
    aggregate: sourceMemberCorruption,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5
  }), /malformed topology authority/);

  const negativeKineticEnergy = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(3)
  );
  negativeKineticEnergy.records[0].kineticEnergyJ = -1;
  assert.throws(() => traverseSchroederSpatialAggregateCpuOracle({
    aggregate: negativeKineticEnergy,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5
  }), /malformed topology authority/);

  const rootSourceCountCorruption = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(3)
  );
  const corruptedRoot = {
    ...rootSourceCountCorruption.root,
    sourceMemberCount: rootSourceCountCorruption.root.sourceMemberCount - 1
  };
  const corruptedRecords = [...rootSourceCountCorruption.records];
  corruptedRecords[rootSourceCountCorruption.shape.rootRecordIndex] = corruptedRoot;
  const corruptedRootAggregate = {
    ...rootSourceCountCorruption,
    root: corruptedRoot,
    records: corruptedRecords
  };
  assert.throws(() => traverseSchroederSpatialAggregateCpuOracle({
    aggregate: corruptedRootAggregate,
    queryPositionM: [0, 0, 0],
    nearFieldRadiusM: 1,
    openingTheta: 0.5
  }), /malformed topology authority|malformed source-member authority/);

  const shiftedKeys = oneParticlePerCellFixture(3);
  for (let cellIndex = 0; cellIndex < 3; cellIndex += 1) {
    shiftedKeys.cellKeys[cellIndex * 5 + 2] += 17;
  }
  const shiftedAggregate = reduceSchroederSpatialAggregateCpuOracle(shiftedKeys);
  assert.notEqual(
    shiftedAggregate.topologyFingerprint,
    reduceSchroederSpatialAggregateCpuOracle(
      oneParticlePerCellFixture(3)
    ).topologyFingerprint
  );

  const descendantChange = oneParticlePerCellFixture(3);
  descendantChange.cellKeys[2 * 5 + 4] += 1;
  const baselineAggregate = reduceSchroederSpatialAggregateCpuOracle(
    oneParticlePerCellFixture(3)
  );
  const descendantAggregate = reduceSchroederSpatialAggregateCpuOracle(
    descendantChange
  );
  assert.equal(
    descendantAggregate.root.topologyFingerprint,
    baselineAggregate.root.topologyFingerprint,
    'the adversarial fixture must leave the root-local fingerprint unchanged'
  );
  assert.notEqual(
    descendantAggregate.topologyFingerprint,
    baselineAggregate.topologyFingerprint,
    'the global fingerprint must authenticate descendant keys'
  );
});

test('WGSL builds an authenticated Morton-prefix tree and exposes a budget-free stackless traversal', () => {
  assert.match(schroederSpatialAggregateViewWgsl, /AGGREGATE_VERSION: u32 = 2u/);
  assert.match(schroederSpatialAggregateViewWgsl, /KEY_WORDS: u32 = 5u/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn emit_aggregate_morton_keys/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn reduce_cell_leaves/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn common_prefix/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn build_aggregate_prefix_topology/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn build_aggregate_escape_ropes/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn reduce_aggregate_internals/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn authenticate_aggregate_topology/);
  assert.match(schroederSpatialAggregateViewWgsl, /fn topology_fingerprint/);
  for (let keyWord = 28; keyWord <= 32; keyWord += 1) {
    assert.match(
      schroederSpatialAggregateViewWgsl,
      new RegExp(`fold_fingerprint\\(value, load_word\\(base \\+ ${keyWord}u\\)\\)`)
    );
  }
  assert.match(schroederSpatialAggregateViewWgsl, /dispatch_store/);
  assert.doesNotMatch(schroederSpatialAggregateViewWgsl, /reduce_aggregate_level/);
  assert.doesNotMatch(schroederSpatialAggregateViewWgsl, /pyramid/i);
  assert.match(schroederSpatialAggregateStacklessTraversalWgsl, /loop \{/);
  assert.match(schroederSpatialAggregateStacklessTraversalWgsl, /escape_index/);
  assert.match(schroederSpatialAggregateStacklessTraversalWgsl, /record_index = left_child/);
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /aggregate_view\[62u\] != 0u/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /aggregate_view\[16u\] == params\.expected_source_count/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /aggregate_view\[62u\] == replay_token/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /aggregate_view\[63u\] == header_fingerprint/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /aggregate_view\[base \+ 41u\] != topology_fingerprint\(record_index\)/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /right_source_count != source_member_count - left_source_count/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /right_particle_count != particle_count - left_particle_count/
  );
  assert.match(
    schroederSpatialAggregateViewWgsl,
    /record\.internal_energy >= 0\.0/
  );
  assert.match(
    schroederSpatialAggregateViewWgsl,
    /SOURCE_LAYOUT_ACTIVE_NODE[\s\S]*mechanically_dormant = bitcast<u32>\(mass\) == 0u[\s\S]*support_radius >= 0\.0/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /!finite_vec3\(momentum\)/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /!finite_f32\(internal_energy\)[\s\S]*internal_energy < 0\.0/
  );
  assert.match(schroederSpatialAggregateStacklessTraversalWgsl, /near_intersects/);
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /QUERY_SOURCE_LEVEL_ASSIGNMENT_V0/
  );
  assert.match(
    schroederSpatialAggregateStacklessTraversalWgsl,
    /traversal_queries\[query_base \+ 12u\]/
  );
  assert.match(schroederSpatialAggregateStacklessTraversalWgsl, /covered_leaf_count != leaf_count/);
  assert.doesNotMatch(schroederSpatialAggregateStacklessTraversalWgsl, /candidate_rows/i);
  assert.doesNotMatch(schroederSpatialAggregateStacklessTraversalWgsl, /candidate_budget/i);
  assert.doesNotMatch(schroederSpatialAggregateViewWgsl, /contribution_rows/i);
});

test('runtime retains Morton radix arenas and uses separate cell/internal/record dispatches', async () => {
  const tracker = createFakeDevice();
  const runtime = createSchroederSpatialAggregateViewGpu(tracker.device, {
    maxSourceCount: 4097,
    cellCapacity: 4097,
    arenaCount: 2
  });
  assert.equal(runtime.schema, ULG_SCHROEDER_SPATIAL_AGGREGATE_VIEW_SCHEMA);
  assert.equal(runtime.aggregatePipelineCount, 9);
  assert.equal(runtime.radixPipelineCountPerArena, 12);
  assert.equal(
    runtime.pipelineCount,
    runtime.aggregatePipelineCount + 2 * runtime.radixPipelineCountPerArena
  );
  assert.equal(runtime.topologyMode, 2);
  assert.equal(runtime.mortonKeyWordCount, 5);
  assert.equal(runtime.mortonPrefixBitCount, 160);
  const createdBeforeEncode = tracker.createdBuffers.length;
  const encoder = createFakeEncoder();
  const authorities = createAuthorities(tracker.device, {
    sourceCount: 3,
    sourceCapacity: 4097
  });
  const execution = runtime.encode(encoder, authorities);
  assert.equal(tracker.createdBuffers.length, createdBeforeEncode);
  assert.equal(execution.status, 'schroeder-spatial-aggregate-view-gpu-encoded');
  assert.equal(execution.aggregateEncodedDispatchCount, 9);
  assert.equal(execution.encodedComputePassCount, encoder.passes.length);
  assert.equal(execution.radixPassCount, 40);
  assert.equal(execution.radixParamsBufferResidency, 'retained-slot-arena');
  assert.equal(execution.topologyMode, 2);
  assert.equal(execution.mortonKeyWordCount, 5);
  assert.equal(execution.mortonPrefixBitCount, 160);
  assert.equal(execution.readbackPerformed, false);
  assert.equal(execution.gpuBufferCreationCountDuringEncode, 0);
  assert.equal(execution.materializedCandidateRowCount, 0);
  assert.equal(execution.perSourceCandidateBudget, null);
  assert.ok(encoder.clears.length >= 2);
  assert.notEqual(execution.indirectDispatchBuffer, execution.aggregateViewBuffer);
  assert.notEqual(execution.mortonKeyBuffer, execution.aggregateViewBuffer);
  assert.notEqual(execution.mortonSortedIndicesBuffer, execution.aggregateViewBuffer);
  assert.deepEqual(encoder.passes[0].dispatch, [1, 1, 1]);
  const aggregateIndirectOffsets = encoder.passes
    .filter((pass) => pass.indirect?.buffer === execution.indirectDispatchBuffer)
    .map((pass) => pass.indirect.offset);
  assert.deepEqual(aggregateIndirectOffsets, [24, 0, 12, 24, 12, 24]);
  const finalizeBindings = tracker.bindGroups.find(
    ({ descriptor }) => descriptor.label.endsWith('-finalize-bindings')
  );
  assert.ok(finalizeBindings);
  assert.deepEqual(
    finalizeBindings.descriptor.entries.map(({ binding }) => binding),
    [0, 5, 6, 7]
  );
  assert.equal(
    execution.authIndirectDispatchOffsetBytes,
    SCHROEDER_SPATIAL_AGGREGATE_VIEW_AUTH_DISPATCH_SLOT * 3 * 4
  );
  assert.equal(runtime.ownsExecution(execution), true);
  assert.equal(runtime.markExecutionSubmitted(execution), true);
  assert.equal(validateSchroederSpatialAggregateViewDescriptor(execution).admitted, true);
  assert.equal(await runtime.releaseExecutionAfter(execution, Promise.resolve()), true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.equal(runtime.destroy(), true);
});

test('runtime enforces exact provenance, identity epochs, backpressure, and release mode', () => {
  const tracker = createFakeDevice();
  const runtime = createSchroederSpatialAggregateViewGpu(tracker.device, {
    maxSourceCount: 4,
    cellCapacity: 4,
    arenaCount: 1
  });
  const authorities = createAuthorities(tracker.device);
  const stale = {
    ...authorities,
    particleBufferSet: {
      ...authorities.particleBufferSet,
      positionEpoch: authorities.particleBufferSet.positionEpoch + 1
    }
  };
  assert.throws(
    () => runtime.encode(createFakeEncoder(), stale),
    /same-generation SPH particle buffer family/
  );
  const execution = runtime.encode(createFakeEncoder(), authorities);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), authorities),
    (error) => error.code === 'ERR_SCHROEDER_AGGREGATE_VIEW_ARENA_EXHAUSTED'
  );
  assert.throws(() => runtime.releaseExecution(execution), /discardedEncoder/);
  assert.equal(runtime.releaseExecution(execution, { discardedEncoder: true }), true);
  assert.equal(runtime.destroy(), true);
});

test('aggregate arena device-loss quarantine supersedes an unresolved queue fence exactly once', async () => {
  const tracker = createFakeDevice();
  const runtime = createSchroederSpatialAggregateViewGpu(tracker.device, {
    maxSourceCount: 4,
    cellCapacity: 4,
    arenaCount: 1
  });
  const execution = runtime.encode(
    createFakeEncoder(),
    createAuthorities(tracker.device)
  );
  runtime.markExecutionSubmitted(execution);
  const normalFence = deferred();
  const normalRelease = runtime.releaseExecutionAfter(execution, normalFence.promise);
  const lossRelease = runtime.quarantineExecutionAfterDeviceLoss(execution);
  tracker.resolveLost({ reason: 'destroyed', message: 'test loss' });
  assert.equal(await lossRelease, true);
  assert.equal(execution.released, true);
  assert.equal(runtime.activeExecutionCount(), 0);
  assert.ok(runtime.allocationEntries().every((entry) => entry.buffer.destroyCount === 1));
  normalFence.resolve();
  assert.equal(await normalRelease, true);
  assert.throws(
    () => runtime.encode(createFakeEncoder(), createAuthorities(tracker.device)),
    (error) => error.code === 'ERR_SCHROEDER_AGGREGATE_VIEW_DEVICE_LOST'
  );
});

test('traversal runtime binds public E*, emits no candidates, and mints one honest submission receipt', async () => {
  const tracker = createFakeDevice();
  const aggregateRuntime = createSchroederSpatialAggregateViewGpu(tracker.device, {
    maxSourceCount: 4,
    cellCapacity: 4,
    arenaCount: 1
  });
  const aggregateView = aggregateRuntime.encode(
    createFakeEncoder(),
    createAuthorities(tracker.device)
  );
  aggregateRuntime.markExecutionSubmitted(aggregateView);
  const traversalRuntime = createSchroederSpatialAggregateTraversalGpu(
    tracker.device,
    { maxQueryCount: 4, arenaCount: 1 }
  );
  const queryBuffer = taggedBuffer(tracker.device, 'queries', 4 * 8 * 4);
  const publicEpochIdentity = Object.freeze(Object.fromEntries([
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ].map((field) => [field, aggregateView[field]])));
  const encoder = createFakeEncoder();
  const traversal = traversalRuntime.encode(encoder, {
    aggregateView,
    queryBuffer,
    queryCount: 3,
    publicEpochIdentity
  });
  const traversalParamsWrite = tracker.writes.findLast(
    (entry) => entry.data instanceof ArrayBuffer && entry.data.byteLength === 128
  );
  assert.ok(traversalParamsWrite);
  assert.equal(
    new DataView(traversalParamsWrite.data).getUint32(28 * 4, true),
    aggregateView.sourceCount
  );
  assert.equal(encoder.passes.length, 1);
  assert.equal(encoder.passes[0].dispatch, null);
  assert.equal(encoder.passes[0].indirect.offset, 0);
  assert.equal(traversal.materializedCandidateRowCount, 0);
  assert.equal(traversal.perSourceCandidateBudget, null);
  assert.equal(traversal.fullReadbackPerformed, false);
  traversalRuntime.markExecutionSubmitted(traversal);
  const receipt = finalizeSchroederSpatialAggregateTraversalSubmissionReceipt(
    traversal,
    traversal.submissionEvidence
  );
  assert.equal(
    isFinalizedSchroederSpatialAggregateTraversalSubmissionReceipt(receipt),
    true
  );
  assert.equal(receipt.aggregateView, aggregateView);
  assert.equal(receipt.publicEpochBound, true);
  assert.equal(receipt.queryCount, 3);
  assert.equal(receipt.submissionAuthenticated, true);
  assert.equal(receipt.authenticationScope, 'submission-and-provenance-only');
  assert.equal(receipt.gpuAuthenticated, false);
  assert.equal(receipt.gpuResultObserved, false);
  assert.equal(receipt.resultAuthenticated, false);
  assert.equal(receipt.failClosedSummaryProtocolEncoded, true);
  assert.equal(receipt.exactNearFarPartitionCheckEncoded, true);
  assert.equal(receipt.topologyFingerprintCheckEncoded, true);
  assert.equal(receipt.globalTopologySealRequiredEncoded, true);
  assert.equal(receipt.visitedTopologyFingerprintRecomputeEncoded, true);
  assert.equal(receipt.expectedGlobalTopologyFingerprintCompared, false);
  assert.equal(receipt.replayGuardRecomputedEncoded, true);
  assert.equal(receipt.visitedNodeSummaryEncoded, true);
  assert.equal(
    receipt.summaryPublicationContract,
    'per-row-status-gated-fail-closed'
  );
  assert.equal(receipt.authoritativeStatePublicationPerformed, false);
  assert.equal(receipt.authoritativeStateMutationCount, 0);
  assert.equal(receipt.traversalSummaryBuffer, traversal.traversalSummaryBuffer);
  assert.equal(receipt.visitedNodeCountObserved, null);
  assert.equal(receipt.exactNearFarPartitionObserved, null);
  assert.equal(receipt.topologyFingerprintObserved, null);
  assert.equal(receipt.explicitExhaustiveFallbackDispatchCount, 0);
  assert.equal(receipt.explicitFallbackPathEncoded, false);
  assert.equal(receipt.materializedCandidateRowCount, 0);
  assert.equal(receipt.perSourceCandidateBudget, null);
  assert.equal(
    isFinalizedSchroederSpatialAggregateTraversalSubmissionReceipt({ ...receipt }),
    false
  );
  assert.equal(
    await traversalRuntime.releaseExecutionAfter(traversal, Promise.resolve()),
    true
  );
  assert.equal(
    await traversalRuntime.releaseExecutionAfter(traversal, Promise.resolve()),
    true
  );
  assert.equal(
    await traversalRuntime.quarantineExecutionAfterDeviceLoss(traversal),
    true
  );
  assert.equal(
    await aggregateRuntime.releaseExecutionAfter(aggregateView, Promise.resolve()),
    true
  );
  assert.equal(traversalRuntime.destroy(), true);
  assert.equal(aggregateRuntime.destroy(), true);
});

test('traversal authenticates the complete level-assignment source instead of aliasing SPH state', async () => {
  const tracker = createFakeDevice();
  const authorities = createAuthorities(tracker.device);
  const aggregateRuntime = createSchroederSpatialAggregateViewGpu(tracker.device, {
    maxSourceCount: 4,
    cellCapacity: 4,
    arenaCount: 1
  });
  const aggregateView = aggregateRuntime.encode(
    createFakeEncoder(),
    authorities
  );
  aggregateRuntime.markExecutionSubmitted(aggregateView);
  const traversalRuntime = createSchroederSpatialAggregateTraversalGpu(
    tracker.device,
    { maxQueryCount: 3, arenaCount: 1 }
  );
  const identity = Object.freeze(Object.fromEntries([
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ].map((field) => [field, aggregateView[field]])));
  assert.throws(() => traversalRuntime.encode(createFakeEncoder(), {
    aggregateView,
    queryBuffer: taggedBuffer(
      tracker.device,
      'foreign-level-assignment',
      3 * 16 * Float32Array.BYTES_PER_ELEMENT
    ),
    queryCount: 3,
    queryStrideFloats: 8,
    querySourceLayoutId:
      SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
        .LEVEL_ASSIGNMENT_V0,
    publicEpochIdentity: identity
  }), /queryStrideFloats must be at least 16/);
  assert.throws(() => traversalRuntime.encode(createFakeEncoder(), {
    aggregateView,
    queryBuffer: taggedBuffer(
      tracker.device,
      'foreign-level-assignment-exact-size',
      3 * 16 * Float32Array.BYTES_PER_ELEMENT
    ),
    queryCount: 3,
    queryStrideFloats: 16,
    querySourceLayoutId:
      SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
        .LEVEL_ASSIGNMENT_V0,
    publicEpochIdentity: identity
  }), (error) => (
    error.code === 'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_QUERY_PROVENANCE'
  ));
  const traversal = traversalRuntime.encode(createFakeEncoder(), {
    aggregateView,
    queryBuffer: authorities.spatialSource.sourceBuffer,
    queryCount: 3,
    queryStrideFloats: 16,
    querySourceLayoutId:
      SCHROEDER_SPATIAL_AGGREGATE_TRAVERSAL_QUERY_SOURCE_LAYOUT
        .LEVEL_ASSIGNMENT_V0,
    nearFieldSupportScale: 1.5,
    openingTheta: 0.4,
    publicEpochIdentity: identity
  });
  traversalRuntime.markExecutionSubmitted(traversal);
  const receipt = finalizeSchroederSpatialAggregateTraversalSubmissionReceipt(
    traversal,
    traversal.submissionEvidence
  );
  assert.equal(receipt.querySourceLayout, 'schroeder-level-assignment-v0');
  assert.equal(receipt.canonicalQueryProvenanceAuthenticated, true);
  assert.equal(receipt.queryCount, aggregateView.sourceCount);
  assert.equal(receipt.nearFieldSupportScale, 1.5);
  assert.equal(receipt.openingTheta, 0.4);
  assert.equal(
    await traversalRuntime.releaseExecutionAfter(traversal, Promise.resolve()),
    true
  );
  assert.equal(traversalRuntime.destroy(), true);
  assert.equal(
    await aggregateRuntime.releaseExecutionAfter(aggregateView, Promise.resolve()),
    true
  );
  assert.equal(aggregateRuntime.destroy(), true);
});

test('traversal rejects stale public E* identity and retains its arena under backpressure', () => {
  const tracker = createFakeDevice();
  const aggregateRuntime = createSchroederSpatialAggregateViewGpu(tracker.device, {
    maxSourceCount: 4,
    cellCapacity: 4,
    arenaCount: 1
  });
  const aggregateView = aggregateRuntime.encode(
    createFakeEncoder(),
    createAuthorities(tracker.device)
  );
  aggregateRuntime.markExecutionSubmitted(aggregateView);
  const traversalRuntime = createSchroederSpatialAggregateTraversalGpu(
    tracker.device,
    { maxQueryCount: 1, arenaCount: 1 }
  );
  const queryBuffer = taggedBuffer(tracker.device, 'query', 8 * 4);
  const identity = Object.freeze(Object.fromEntries([
    'storageGeneration',
    'physicsTick',
    'physicsSubstep',
    'positionEpoch',
    'topologyEpoch',
    'chartEpoch',
    'levelEpoch',
    'supportEpoch'
  ].map((field) => [field, aggregateView[field]])));
  assert.throws(() => traversalRuntime.encode(createFakeEncoder(), {
    aggregateView,
    queryBuffer,
    queryCount: 1,
    publicEpochIdentity: Object.freeze({ ...identity, positionEpoch: 999 })
  }), (error) => (
    error.code === 'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_PUBLIC_EPOCH_IDENTITY'
  ));
  const traversal = traversalRuntime.encode(createFakeEncoder(), {
    aggregateView,
    queryBuffer,
    queryCount: 1,
    publicEpochIdentity: identity
  });
  assert.throws(() => traversalRuntime.encode(createFakeEncoder(), {
    aggregateView,
    queryBuffer,
    queryCount: 1,
    publicEpochIdentity: identity
  }), (error) => (
    error.code === 'ERR_SCHROEDER_AGGREGATE_TRAVERSAL_ARENA_EXHAUSTED'
  ));
  assert.equal(
    traversalRuntime.releaseExecution(traversal, { discardedEncoder: true }),
    true
  );
});
