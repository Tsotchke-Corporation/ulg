// Phase-carrier v2 lineage facts shared by the reaction kernels.
//
// The kernels' in-place product hosting rule (reaction_row_hosts_product in
// ulg-gpu-abi/src/wgsl.js) needs the lineage capacity: rows are
// lane * capacity + lineage across four phase lanes, and one lineage holds one
// material. A freed reactant row hosts a product only while every other lane
// of its lineage is empty.

// ReactionParams uniform: 12 words, the phase lineage capacity, and padding.
export const SPH_REACTION_PARAMS_BYTES = 64;

// The lineage capacity of a four-lane phase-carrier state, or 0 when the
// state has no such layout (the kernels then allow in-place hosting as before).
export function sphReactionPhaseLineageCapacity(sphParticleState = null) {
  const plan = sphParticleState?.phaseCarrierPlan;
  const capacity = Number(plan?.lineageCapacity);
  const particleCount = Number(sphParticleState?.particleCount);
  return plan?.schema === 'peercompute.ulg.sph-phase-carrier-plan.v2'
    && Number(plan.phaseLaneCount) === 4
    && Number.isSafeInteger(capacity) && capacity > 0
    && capacity * 4 === particleCount
    ? capacity
    : 0;
}
