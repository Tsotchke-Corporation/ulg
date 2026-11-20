import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCHROEDER_SPLIT_SPARE_RESERVE_SCHEMA,
  cloneSchroederSplitSpareReserve, clonePhaseCarrierPlanWithSplitReserve, splitSpareReservesEqual
} from '../src/runtime/sph/schroederSplitSpareReserve.js';
import { packSphPhaseViewStateForTransport, unpackSphPhaseViewStateFromTransport }
  from '../src/runtime/sphPhaseViewStateTransport.js';
import {
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers,
  uploadSphGpuParticleBuffers, uploadMlsMpmGpuParticleBuffers,
  destroySphGpuParticleBuffers, destroyMlsMpmGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';

function layout(lanes = 4) {
  return { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
    lineageCapacity: 8, primaryCapacity: 8, phaseLaneStride: 8, phaseLaneCount: lanes,
    companionStart: 8, companionCapacity: 8 * (lanes - 1), particleCapacity: 8 * lanes,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: lanes === 4,
    splitSpareReserve: { schema: SCHROEDER_SPLIT_SPARE_RESERVE_SCHEMA,
      firstLineageIndex: 4, count: 4, firstContinuityDomainId: 101 } };
}

test('split reserve round-trips the cold view-state transport and both upload families', () => {
  const plan = layout();
  // Manufactured cold rows, no simulation or CPU constitutive evaluation.
  const count = plan.particleCapacity;
  const packed = {
    sphGpuParticleState: { schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count,
      topologyEpoch: 0, identityRevision: 'manufactured-split-reserve',
      state: new Float32Array(count * 8), thermo: new Float32Array(count * 12),
      identity: new Uint32Array(count), identityStrideBytes: 4, stateStrideBytes: 32,
      thermoStrideBytes: 48, phaseCarrierPlan: clonePhaseCarrierPlanWithSplitReserve(plan) },
    mlsMpmGpuParticleState: { schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count,
      topologyEpoch: 0, mechanics: new Float32Array(count * 32), mechanicsStrideBytes: 128,
      phaseCarrierPlan: clonePhaseCarrierPlanWithSplitReserve(plan) }
  };
  const decoded = unpackSphPhaseViewStateFromTransport(structuredClone(packSphPhaseViewStateForTransport(packed)));
  const device = { createBuffer: ({ size, usage }) => ({ size, usage, destroy() {} }),
    queue: { writeBuffer() {} } };
  const sph = uploadSphGpuParticleBuffers(device, decoded.sphGpuParticleState);
  const mls = uploadMlsMpmGpuParticleBuffers(device, decoded.mlsMpmGpuParticleState);
  try {
    for (const upload of [sph, mls]) {
      assert.deepEqual(upload.phaseCarrierPlan.splitSpareReserve, plan.splitSpareReserve);
      assert.notEqual(upload.phaseCarrierPlan.splitSpareReserve, plan.splitSpareReserve);
      assert.equal(Object.isFrozen(upload.phaseCarrierPlan.splitSpareReserve), true);
    }
    plan.splitSpareReserve.count = 1;
    assert.equal(sph.phaseCarrierPlan.splitSpareReserve.count, 4);
    assert.equal(mls.phaseCarrierPlan.splitSpareReserve.count, 4);
  } finally { destroySphGpuParticleBuffers(sph); destroyMlsMpmGpuParticleBuffers(mls); }
});

test('split reserve validates fixed stride and exact bounds, and strips local-only properties', () => {
  const plan = layout();
  plan.splitSpareReserve.localBuffer = { destroy() {} };
  plan.splitSpareReserve.localRows = new Float32Array(4);
  assert.deepEqual(cloneSchroederSplitSpareReserve(plan), layout().splitSpareReserve);
  assert.deepEqual(cloneSchroederSplitSpareReserve(layout(1)), layout(1).splitSpareReserve);
  for (const delta of [{ count: 0 }, { count: 5 }, { count: '4' }, { firstLineageIndex: -0 },
    { firstLineageIndex: -1 }, { firstLineageIndex: 4.5 }, { firstContinuityDomainId: 0xffffff },
    { firstContinuityDomainId: NaN }, { schema: 'untrusted' }]) {
    assert.throws(() => cloneSchroederSplitSpareReserve({ ...plan,
      splitSpareReserve: { ...plan.splitSpareReserve, ...delta } }), /splitSpareReserve/);
  }
  for (const delta of [{ phaseLaneStride: 7 }, { particleCapacity: 31 }, { phaseLaneCount: 2 },
    { schema: 'peercompute.ulg.sph-phase-carrier-plan.v1' }, { stableLaneAddress: 'append' }]) {
    assert.throws(() => cloneSchroederSplitSpareReserve({ ...plan, ...delta }), /splitSpareReserve/);
  }
  assert.throws(() => cloneSchroederSplitSpareReserve(plan, 31), /splitSpareReserve/);
  assert.equal(cloneSchroederSplitSpareReserve({ ...plan, splitSpareReserve: null }), null);
  assert.equal(splitSpareReservesEqual(plan.splitSpareReserve, layout().splitSpareReserve), true);
  assert.equal(splitSpareReservesEqual(plan.splitSpareReserve, null), false);
  assert.equal(splitSpareReservesEqual(plan.splitSpareReserve, { ...plan.splitSpareReserve, count: 3 }), false);
});

test('both upload paths reject an invalid reserve before allocating any GPU resources', () => {
  let allocations = 0;
  const device = { createBuffer() { allocations++; throw new Error('must not allocate'); }, queue: { writeBuffer() {} } };
  for (const [upload, schema] of [[uploadSphGpuParticleBuffers, ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA],
    [uploadMlsMpmGpuParticleBuffers, ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA]]) {
    assert.throws(() => upload(device, { schema, particleCount: 32,
      phaseCarrierPlan: { ...layout(), phaseLaneStride: 1 } }), /splitSpareReserve/);
  }
  assert.equal(allocations, 0);
});

test('both cold packers reject mismatched reserve capacity before evaluating any particle law', () => {
  const particle = new Proxy({}, { get() { throw new Error('particle laws must not run'); } });
  const cold = { particles: Array(31).fill(particle), phaseCarrierPlan: layout() };
  for (const pack of [buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers]) {
    assert.throws(() => pack(cold), /splitSpareReserve/);
  }
});
