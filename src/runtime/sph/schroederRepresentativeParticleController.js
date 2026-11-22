// Representative-particle split / bulkCoarsen merge-back controller and
// representedEntityCount telemetry summary for four-lane Schroeder phase
// carriers (plan/todo/interface-resolution.md, plan/todo/g2-integer-ledger-proposal.md).
//
// Conservation laws enforced on both split and bulkCoarsen merge-back:
//   - Exact mass conservation: sum(m_i) unchanged
//   - Exact momentum conservation: sum(m_i * v_i) unchanged
//   - Exact first-moment (center of mass) conservation: sum(m_i * x_i) unchanged
//   - Exact total energy conservation (Galilean-invariant): relative KE lost on
//     merge converts directly into internal energy (heat = sum 0.5*m_i*|v_i - v_cm|^2)
//   - Exact entity count conservation: sum(representedEntityCount_i) unchanged
//   - Exact spare lineage reclamation: merged bulk gas/steam followers clear
//     back to spare_lineages for subsequent hot/interface splits.

export const ULG_REPRESENTATIVE_PARTICLES_SCHEMA =
  'peercompute.ulg.representative-particles-status.v1';

/**
 * Compute initial representedEntityCount statistics from a packed SPH particle
 * state (thermo stride = 12 floats; offset + 9 = representedEntityCount,
 * state stride = 8 floats; offset + 3 = massKg). Zero GPU readback on hot steps.
 */
export function summarizeRepresentedEntityDistribution(sphParticleState) {
  const thermo = sphParticleState?.thermo;
  const state = sphParticleState?.state;
  const count = Math.max(0, Math.floor(Number(sphParticleState?.particleCount) || 0));
  if (!(thermo instanceof Float32Array) || !(state instanceof Float32Array) || count === 0) {
    return Object.freeze({
      activeCarrierCount: 0,
      minEntitiesPerCarrier: 0,
      maxEntitiesPerCarrier: 0,
      meanEntitiesPerCarrier: 0,
      totalRepresentedEntities: 0
    });
  }
  let active = 0;
  let minE = Infinity;
  let maxE = 0;
  let totalE = 0;
  const rows = Math.min(count, Math.floor(thermo.length / 12), Math.floor(state.length / 8));
  for (let i = 0; i < rows; i += 1) {
    const mass = state[i * 8 + 3];
    if (!(mass > 0)) continue;
    const entities = thermo[i * 12 + 9];
    if (!Number.isFinite(entities) || entities < 0) continue;
    active += 1;
    totalE += entities;
    if (entities < minE) minE = entities;
    if (entities > maxE) maxE = entities;
  }
  return Object.freeze({
    activeCarrierCount: active,
    minEntitiesPerCarrier: active > 0 ? minE : 0,
    maxEntitiesPerCarrier: active > 0 ? maxE : 0,
    meanEntitiesPerCarrier: active > 0 ? totalE / active : 0,
    totalRepresentedEntities: totalE
  });
}

/**
 * Build a live schedule-boundary representative-particle status snapshot for
 * Studio Diagnostics without performing any full-particle GPU readback.
 */
export function buildRepresentativeParticlesStatus({
  phaseCarrierPlan = null,
  entityStats = null,
  phaseSlotRefinementEnabled = false,
  stefanExactSkinLedgerActive = true,
  splitCount = 0,
  bulkCoarsenMergeCount = 0,
  reclaimedSpareLineages = 0,
  bulkCoarsenTempSpanK = 15,
  bulkCoarsenSpeedSpanMPerS = 0.5
} = {}) {
  const lineageCapacity = Math.max(0, Math.round(Number(phaseCarrierPlan?.lineageCapacity) || 0));
  const spareReserve = phaseCarrierPlan?.splitSpareReserve ?? null;
  const spareLineageCapacity = Math.max(0, Math.round(Number(spareReserve?.count) || 0));
  const primaryLineageCount = Math.max(0, lineageCapacity - spareLineageCapacity);
  const stats = entityStats || summarizeRepresentedEntityDistribution(null);
  return Object.freeze({
    schema: ULG_REPRESENTATIVE_PARTICLES_SCHEMA,
    lineageCapacity,
    primaryLineageCount,
    spareLineageCapacity,
    phaseSlotRefinementActive: Boolean(phaseSlotRefinementEnabled),
    bulkCoarsenEnabled: spareLineageCapacity > 0,
    stefanExactSkinLedgerActive: Boolean(stefanExactSkinLedgerActive),
    activeCarrierCount: stats.activeCarrierCount,
    minEntitiesPerCarrier: stats.minEntitiesPerCarrier,
    maxEntitiesPerCarrier: stats.maxEntitiesPerCarrier,
    meanEntitiesPerCarrier: stats.meanEntitiesPerCarrier,
    totalRepresentedEntities: stats.totalRepresentedEntities,
    splitCount: Math.max(0, Math.round(Number(splitCount) || 0)),
    bulkCoarsenMergeCount: Math.max(0, Math.round(Number(bulkCoarsenMergeCount) || 0)),
    reclaimedSpareLineages: Math.max(0, Math.round(Number(reclaimedSpareLineages) || 0)),
    bulkCoarsenPolicy: Object.freeze({
      maxTemperatureSpanK: bulkCoarsenTempSpanK,
      maxSpeedSpreadMPerS: bulkCoarsenSpeedSpanMPerS
    })
  });
}

/**
 * Conservative CPU reference for representative-particle split (hot/high-gradient
 * /interface carriers into spare lineages) + bulkCoarsen merge-back (quiescent
 * homogeneous bulk gas/steam carriers reclaiming spare lineages), mirroring
 * `schroederPhaseSlotMaterializationGpu.js` invariants identically.
 */
export function executeRepresentativeParticleSplitAndBulkCoarsen({
  carriers,
  spareLineages = [],
  splitGradientThresholdKPerM = 500,
  splitFactor = 2,
  bulkCoarsenCellSizeM = 0.05,
  bulkCoarsenTempSpanK = 15,
  bulkCoarsenSpeedSpanMPerS = 0.5,
  boxDimsM = [1, 1, 1]
} = {}) {
  if (!Array.isArray(carriers)) throw new TypeError('carriers must be an array');
  const nextCarriers = carriers.map((c) => ({
    ...c,
    position: [...c.position],
    velocity: [...c.velocity]
  }));
  const freeSpares = [...spareLineages];
  let splitCount = 0;
  let mergeCount = 0;
  let reclaimedSpares = 0;

  // Phase 1: Conservative split of hot/high-gradient/interface carriers into spare lineages.
  const kSplit = Math.max(2, Math.round(Number(splitFactor) || 2));
  const initialLength = nextCarriers.length;
  for (let idx = 0; idx < initialLength; idx += 1) {
    const c = nextCarriers[idx];
    if (!(c.massKg > 0)) continue;
    const needsSplit = Boolean(
      c.atInterface === true
      || Number(c.temperatureGradientKPerM) >= splitGradientThresholdKPerM
    );
    if (!needsSplit) continue;
    const neededSpares = kSplit - 1;
    if (freeSpares.length < neededSpares) continue;

    const childMass = c.massKg / kSplit;
    const childEntities = c.representedEntityCount / kSplit;
    const childRestVol = (c.restVolumeM3 ?? 1e-6) / kSplit;
    const offsetMag = Math.min(
      0.25 * Math.cbrt(childRestVol),
      0.5 * Math.min(c.position[0], boxDimsM[0] - c.position[0])
    );

    // Symmetric zero-sum offsets preserve exact first moment sum(m_i * x_i) == m * x.
    const offsets = [];
    for (let s = 0; s < kSplit; s += 1) {
      const frac = (s - 0.5 * (kSplit - 1)) / Math.max(1, 0.5 * (kSplit - 1));
      offsets.push([offsetMag * frac, 0, 0]);
    }
    const basePos = [...c.position];
    c.massKg = childMass;
    c.representedEntityCount = childEntities;
    c.restVolumeM3 = childRestVol;
    c.position = [basePos[0] + offsets[0][0], basePos[1] + offsets[0][1], basePos[2] + offsets[0][2]];

    for (let s = 1; s < kSplit; s += 1) {
      const lineage = freeSpares.shift();
      nextCarriers.push({
        ...c,
        lineage,
        isSpareChild: true,
        massKg: childMass,
        representedEntityCount: childEntities,
        restVolumeM3: childRestVol,
        position: [basePos[0] + offsets[s][0], basePos[1] + offsets[s][1], basePos[2] + offsets[s][2]],
        velocity: [...c.velocity]
      });
    }
    splitCount += 1;
  }

  // Phase 2: Conservative bulkCoarsen merge-back of quiescent homogeneous bulk
  // gas/steam carriers sharing material & spatial cell, reclaiming spare lineages!
  const cellGroups = new Map();
  for (let i = 0; i < nextCarriers.length; i += 1) {
    const c = nextCarriers[i];
    if (!(c.massKg > 0) || c.phase !== 'gas' || c.atInterface === true) continue;
    if (Number(c.temperatureGradientKPerM ?? 0) >= splitGradientThresholdKPerM * 0.5) continue;
    const cx = Math.floor(c.position[0] / bulkCoarsenCellSizeM);
    const cy = Math.floor(c.position[1] / bulkCoarsenCellSizeM);
    const cz = Math.floor(c.position[2] / bulkCoarsenCellSizeM);
    const key = `${c.material}|${cx},${cy},${cz}`;
    const bucket = cellGroups.get(key) ?? [];
    bucket.push(i);
    cellGroups.set(key, bucket);
  }

  const removedIndices = new Set();
  for (const indices of cellGroups.values()) {
    if (indices.length < 2) continue;
    let minT = Infinity;
    let maxT = -Infinity;
    let totalMass = 0;
    let px = 0, py = 0, pz = 0;
    let mx = 0, my = 0, mz = 0;
    let totalInternalE = 0;
    let totalEntities = 0;
    let totalRestVol = 0;
    for (const i of indices) {
      const c = nextCarriers[i];
      minT = Math.min(minT, c.temperatureK);
      maxT = Math.max(maxT, c.temperatureK);
      totalMass += c.massKg;
      px += c.massKg * c.velocity[0];
      py += c.massKg * c.velocity[1];
      pz += c.massKg * c.velocity[2];
      mx += c.massKg * c.position[0];
      my += c.massKg * c.position[1];
      mz += c.massKg * c.position[2];
      totalInternalE += c.massKg * c.specificInternalEnergyJPerKg;
      totalEntities += c.representedEntityCount;
      totalRestVol += c.restVolumeM3 ?? 1e-6;
    }
    if (maxT - minT > bulkCoarsenTempSpanK) continue;
    const vx = px / totalMass;
    const vy = py / totalMass;
    const vz = pz / totalMass;
    let maxSpeedDiff = 0;
    let relativeKeHeat = 0;
    for (const i of indices) {
      const c = nextCarriers[i];
      const dvx = c.velocity[0] - vx;
      const dvy = c.velocity[1] - vy;
      const dvz = c.velocity[2] - vz;
      const dv2 = dvx * dvx + dvy * dvy + dvz * dvz;
      maxSpeedDiff = Math.max(maxSpeedDiff, Math.sqrt(dv2));
      relativeKeHeat += 0.5 * c.massKg * dv2;
    }
    if (maxSpeedDiff > bulkCoarsenSpeedSpanMPerS) continue;

    // Leader absorbs all followers conservatively; Galilean relative KE -> heat.
    const leaderIdx = indices[0];
    const leader = nextCarriers[leaderIdx];
    const cp = Number(leader.cpJPerKgK) > 0 ? Number(leader.cpJPerKgK) : 2000;
    const oldU = totalInternalE / totalMass;
    const newU = (totalInternalE + relativeKeHeat) / totalMass;
    leader.massKg = totalMass;
    leader.position = [mx / totalMass, my / totalMass, mz / totalMass];
    leader.velocity = [vx, vy, vz];
    leader.specificInternalEnergyJPerKg = newU;
    leader.temperatureK = (indices.reduce((s, i) => s + nextCarriers[i].massKg * nextCarriers[i].temperatureK, 0) / totalMass)
      + (newU - oldU) / cp;
    leader.representedEntityCount = totalEntities;
    leader.restVolumeM3 = totalRestVol;

    for (let k = 1; k < indices.length; k += 1) {
      const followerIdx = indices[k];
      const follower = nextCarriers[followerIdx];
      removedIndices.add(followerIdx);
      if (follower.lineage != null) {
        freeSpares.push(follower.lineage);
        reclaimedSpares += 1;
      }
    }
    mergeCount += 1;
  }

  const finalCarriers = nextCarriers.filter((_, i) => !removedIndices.has(i));
  return Object.freeze({
    carriers: finalCarriers,
    freeSpares,
    splitCount,
    mergeCount,
    reclaimedSpares
  });
}
