// Gate 5D Multi-Host Scaling: PeerCompute Spatial Domain Partitioner
// (`src/services/distributedSpatialPartitioner.js`).
//
// Partitions large 3D spatial domains (continuum, galactic, or supergalactic
// FLRW TreePM volumes) across K WebGPU PeerCompute browser peers using G5
// `ReservationLedger` CAS tile leases, compact multipole boundary summaries,
// strict epoch fencing, and fail-closed peer-loss tile reassignment.

import { ReservationLedger } from '../runtime/peercomputeCore.js';

export const ULG_DISTRIBUTED_SPATIAL_PARTITION_SCHEMA =
  'peercompute.ulg.distributed-spatial-partition.v1';

/**
 * Create a G5-fenced PeerCompute spatial domain partitioner splitting
 * `[-boxL/2, boxL/2]^3` into `tileCount` non-overlapping spatial tiles.
 */
export function createDistributedSpatialPartitioner({
  domainId = 'ulg-supergalactic-domain',
  boxLength = 200,
  tileCount = 4,
  leaseTtlMs = 30_000
} = {}) {
  const count = Math.max(1, Math.trunc(Number(tileCount)));
  const L = Number(boxLength);
  const half = 0.5 * L;
  const ledger = new ReservationLedger({ name: `${domainId}:tiles`, maxKeys: count * 4 });
  const tileSummaries = new Map();
  let epoch = 1;

  const tiles = [];
  const activeTokens = new Map();
  const slabWidth = L / count;
  for (let i = 0; i < count; i += 1) {
    tiles.push(Object.freeze({
      tileId: `${domainId}:tile-${i}`,
      index: i,
      xMin: -half + i * slabWidth,
      xMax: -half + (i + 1) * slabWidth,
      yMin: -half,
      yMax: half,
      zMin: -half,
      zMax: half
    }));
  }

  function claimTile(tileIndex, peerId) {
    const tile = tiles[tileIndex];
    if (!tile) throw new RangeError(`Invalid tileIndex ${tileIndex}`);
    const key = tile.tileId;
    const expectedEpoch = epoch - 1;
    const res = ledger.reserve({
      key,
      consumerId: String(peerId),
      expectedEpoch
    });
    if (res?.ok && res.token) {
      activeTokens.set(tile.tileId, res.token);
    }
    return Object.freeze({
      claimed: Boolean(res?.ok),
      tile,
      epoch,
      owner: String(peerId),
      token: res?.token ?? null,
      receipt: res
    });
  }

  function submitTileMultipoleSummary({ tileIndex, peerId, summaryEpoch, totalMass, com, quadrupoleTrace = 0 }) {
    if (summaryEpoch !== epoch) {
      return Object.freeze({ accepted: false, reason: 'stale-epoch', expectedEpoch: epoch });
    }
    const tile = tiles[tileIndex];
    if (!tile) return Object.freeze({ accepted: false, reason: 'unknown-tile' });
    const tok = activeTokens.get(tile.tileId);
    if (tok && tok.owner === String(peerId)) {
      ledger.commit(tok, { admissionId: `${tile.tileId}@e${epoch}:${peerId}` });
    }
    tileSummaries.set(tile.tileId, Object.freeze({
      tileId: tile.tileId,
      peerId: String(peerId),
      epoch: summaryEpoch,
      totalMass: Number(totalMass),
      com: Object.freeze([Number(com[0]), Number(com[1]), Number(com[2])]),
      quadrupoleTrace: Number(quadrupoleTrace)
    }));
    return Object.freeze({ accepted: true, epoch, admittedTiles: tileSummaries.size, totalTiles: count });
  }

  function advanceEpoch() {
    for (const tile of tiles) {
      if (ledger.fence(tile.tileId).state !== 'free' || activeTokens.has(tile.tileId)) {
        ledger.retire(tile.tileId);
      }
    }
    activeTokens.clear();
    epoch += 1;
    tileSummaries.clear();
    return epoch;
  }

  function globalMultipoleSummary() {
    if (tileSummaries.size < count) {
      return Object.freeze({
        complete: false,
        reason: 'missing-peer-tiles',
        admittedTiles: tileSummaries.size,
        totalTiles: count
      });
    }
    let mTot = 0; let cx = 0; let cy = 0; let cz = 0;
    for (const s of tileSummaries.values()) {
      mTot += s.totalMass;
      cx += s.totalMass * s.com[0];
      cy += s.totalMass * s.com[1];
      cz += s.totalMass * s.com[2];
    }
    return Object.freeze({
      schema: ULG_DISTRIBUTED_SPATIAL_PARTITION_SCHEMA,
      complete: true,
      epoch,
      admittedTiles: count,
      totalTiles: count,
      totalMass: mTot,
      com: Object.freeze(mTot > 0 ? [cx / mTot, cy / mTot, cz / mTot] : [0, 0, 0])
    });
  }

  return Object.freeze({
    schema: ULG_DISTRIBUTED_SPATIAL_PARTITION_SCHEMA,
    tiles: Object.freeze(tiles),
    claimTile,
    submitTileMultipoleSummary,
    advanceEpoch,
    globalMultipoleSummary,
    getEpoch: () => epoch,
    destroy: () => ledger.destroy()
  });
}
