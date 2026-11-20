// Cold capacity metadata, carried inside the fixed phase-lane plan. This is
// neither an occupancy report nor mutation admission: the GPU scans all lanes
// before allocation, and PeerCompute still owns acceptance of the candidate.
export const SCHROEDER_SPLIT_SPARE_RESERVE_SCHEMA =
  'peercompute.ulg.schroeder-split-spare-reserve.v1';

export function cloneSchroederSplitSpareReserve(plan, particleCount = plan?.particleCapacity) {
  const reserve = plan?.splitSpareReserve;
  if (reserve == null) return null;
  const integer = (value) => Number.isSafeInteger(value) && !Object.is(value, -0);
  const capacity = plan.lineageCapacity;
  const lanes = plan.phaseLaneCount;
  const valid = plan.schema === 'peercompute.ulg.sph-phase-carrier-plan.v2'
    && plan.status === 'phase-lane-capacity-ready'
    && integer(capacity) && capacity > 0
    && (lanes === 4 || (lanes === 1 && plan.phaseCompanionLanesRequired === false))
    && plan.primaryCapacity === capacity && plan.phaseLaneStride === capacity
    && plan.companionStart === capacity && plan.companionCapacity === capacity * (lanes - 1)
    && integer(particleCount) && particleCount <= 0x00ff_ffff
    && plan.particleCapacity === particleCount && particleCount === capacity * lanes
    && plan.stableLaneAddress === 'phaseLane*phaseLaneStride+lineageIndex'
    && reserve.schema === SCHROEDER_SPLIT_SPARE_RESERVE_SCHEMA
    && integer(reserve.firstLineageIndex) && reserve.firstLineageIndex >= 0
    && integer(reserve.count) && reserve.count > 0
    && reserve.firstLineageIndex + reserve.count <= capacity
    && integer(reserve.firstContinuityDomainId) && reserve.firstContinuityDomainId > 0
    && reserve.firstContinuityDomainId + reserve.count - 1 <= 0x00ff_ffff;
  if (!valid) throw new RangeError('splitSpareReserve does not match the fixed phase-carrier layout');
  // A fresh allowlisted value: no local GPUBuffer, typed array or caller-owned
  // mutable object can hitchhike on the worker descriptor.
  return Object.freeze({
    schema: SCHROEDER_SPLIT_SPARE_RESERVE_SCHEMA,
    firstLineageIndex: reserve.firstLineageIndex,
    count: reserve.count,
    firstContinuityDomainId: reserve.firstContinuityDomainId
  });
}

export function clonePhaseCarrierPlanWithSplitReserve(plan, particleCount = plan?.particleCapacity) {
  if (plan == null) return null;
  const splitSpareReserve = cloneSchroederSplitSpareReserve(plan, particleCount);
  return { ...plan, ...(splitSpareReserve ? { splitSpareReserve } : {}) };
}

export function splitSpareReservesEqual(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return left.schema === right.schema && left.firstLineageIndex === right.firstLineageIndex
    && left.count === right.count && left.firstContinuityDomainId === right.firstContinuityDomainId;
}
