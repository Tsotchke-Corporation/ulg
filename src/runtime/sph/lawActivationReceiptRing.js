// G4 per-schedule law activation receipt (plan/todo/g4-dynamic-laws-proposal.md).
//
// Each gated law stage (thermal, reaction, phase, radiation) writes its
// per-step counts [active, dormant, present, overflow] on the GPU. A schedule
// opens one ring per device; every gated stage copies its counts into the next
// slot of its law's region inside the stage's own command encoder (no extra
// pass, submit or host wait). After the schedule's terminal fence the ring is
// mapped once (fixed-size compact evidence) and summarized: per-law totals,
// the steps where a law did zero work, and the exact (epsilon 0) flag.
import { unwrapWebGpuCacheDevice } from '../webgpuComputeLayout.js';

const COUNT_BYTES = 16;
const LAWS = Object.freeze(['thermal', 'reaction', 'phase', 'radiation']);
const USAGE = Object.freeze({
  MAP_READ: globalThis.GPUBufferUsage?.MAP_READ ?? 1,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8
});
const rings = new WeakMap();
const pooledRingBuffers = new WeakMap();

export const ULG_LAW_ACTIVATION_RECEIPT_SCHEMA = 'peercompute.ulg.law-activation-receipt.v1';

function acquirePooledRingBuffer(device, keyDevice, byteSize) {
  const pool = pooledRingBuffers.get(keyDevice);
  if (pool && pool.length > 0) {
    const idx = pool.findIndex((entry) => entry.size >= byteSize);
    if (idx >= 0) {
      const [entry] = pool.splice(idx, 1);
      return entry;
    }
  }
  return {
    size: byteSize,
    buffer: device.createBuffer({
      label: 'ulg-law-activation-receipt-ring',
      size: byteSize,
      usage: USAGE.MAP_READ | USAGE.COPY_DST
    })
  };
}

function releasePooledRingBuffer(keyDevice, entry) {
  if (!entry?.buffer) return;
  let pool = pooledRingBuffers.get(keyDevice);
  if (!pool) {
    pool = [];
    pooledRingBuffers.set(keyDevice, pool);
  }
  if (pool.length < 4) {
    pool.push(entry);
  } else {
    entry.buffer.destroy?.();
  }
}

/** Open a ring for one schedule of at most `capacityPerLaw` gated encodes per law. */
export function openLawActivationReceiptRing(device, { capacityPerLaw, reuseBuffer = false } = {}) {
  if (!device?.createBuffer || !(Number.isInteger(capacityPerLaw) && capacityPerLaw > 0)) return null;
  const keyDevice = unwrapWebGpuCacheDevice(device);
  const previous = rings.get(keyDevice);
  if (previous) previous.buffer.destroy?.();
  const byteSize = LAWS.length * capacityPerLaw * COUNT_BYTES;
  const pooled = reuseBuffer
    ? acquirePooledRingBuffer(device, keyDevice, byteSize)
    : {
        size: byteSize,
        buffer: device.createBuffer({
          label: 'ulg-law-activation-receipt-ring',
          size: byteSize,
          usage: USAGE.MAP_READ | USAGE.COPY_DST
        })
      };
  const ring = {
    keyDevice,
    reuseBuffer: Boolean(reuseBuffer),
    capacityPerLaw,
    pooledEntry: pooled,
    buffer: pooled.buffer,
    encodes: Object.fromEntries(LAWS.map((law) => [law, 0])),
    overflowedEncodes: Object.fromEntries(LAWS.map((law) => [law, 0])),
    epsilon: Object.fromEntries(LAWS.map((law) => [law, null]))
  };
  rings.set(keyDevice, ring);
  return ring;
}

/** Copy one gated stage's counts into the open ring (no-op without a ring). */
export function encodeLawActivationCount(encoder, device, law, countBuffer, { epsilon = null } = {}) {
  const ring = device ? rings.get(unwrapWebGpuCacheDevice(device)) : null;
  const lawIndex = LAWS.indexOf(law);
  if (!ring || lawIndex < 0 || !countBuffer || typeof encoder?.copyBufferToBuffer !== 'function') return false;
  const slot = ring.encodes[law];
  if (slot >= ring.capacityPerLaw) {
    ring.overflowedEncodes[law] += 1;
    return false;
  }
  encoder.copyBufferToBuffer(countBuffer, 0, ring.buffer,
    (lawIndex * ring.capacityPerLaw + slot) * COUNT_BYTES, COUNT_BYTES);
  ring.encodes[law] = slot + 1;
  if (epsilon != null) ring.epsilon[law] = epsilon;
  return true;
}

/**
 * Close the ring after the schedule's GPU work completed and summarize it.
 * Returns null when no ring was opened or no gated stage ran.
 */
export async function closeLawActivationReceiptRing(device) {
  const keyDevice = device ? unwrapWebGpuCacheDevice(device) : null;
  const ring = keyDevice ? rings.get(keyDevice) : null;
  if (!ring) return null;
  rings.delete(keyDevice);
  const anyEncodes = LAWS.some((law) => ring.encodes[law] > 0);
  try {
    if (!anyEncodes) return null;
    await ring.buffer.mapAsync(USAGE.MAP_READ);
    const words = new Uint32Array(ring.buffer.getMappedRange().slice(0));
    ring.buffer.unmap();
    const laws = {};
    for (const [lawIndex, law] of LAWS.entries()) {
      const encodes = ring.encodes[law];
      if (!encodes) continue;
      let active = 0, dormant = 0, present = 0, overflow = 0, zeroWorkSteps = 0;
      for (let slot = 0; slot < encodes; slot += 1) {
        const base = (lawIndex * ring.capacityPerLaw + slot) * 4;
        active += words[base];
        dormant += words[base + 1];
        present += words[base + 2];
        overflow += words[base + 3];
        if (words[base] === 0 && words[base + 2] > 0) zeroWorkSteps += 1;
      }
      laws[law] = Object.freeze({
        gatedEncodes: encodes,
        unrecordedEncodes: ring.overflowedEncodes[law],
        activeSourceSteps: active,
        dormantSourceSteps: dormant,
        presentSourceSteps: present,
        overflowSteps: overflow,
        // Steps where the law had sources but none was active: the exact
        // zero-work witness (a dormant law's kernel walked no source).
        zeroWorkSteps,
        epsilon: ring.epsilon[law],
        exact: law === 'reaction' || ring.epsilon[law] === 0
      });
    }
    return Object.freeze({ schema: ULG_LAW_ACTIVATION_RECEIPT_SCHEMA, laws: Object.freeze(laws) });
  } finally {
    if (ring.reuseBuffer && ring.keyDevice && ring.pooledEntry) {
      releasePooledRingBuffer(ring.keyDevice, ring.pooledEntry);
    } else {
      ring.buffer.destroy?.();
    }
  }
}
