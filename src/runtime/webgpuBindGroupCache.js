// Device-level bind group cache.
//
// The worker-owned resident lane binds the same retained buffers to the same
// layouts every step, but the runners historically called
// device.createBindGroup per encode. Each createBindGroup is a GPU-process
// round trip (decode + validate + allocate), and at ~160 bind groups per
// step that server-side CPU became the queue's throughput ceiling. A bind
// group is an immutable snapshot of (layout, resources), so returning a
// previously created identical bind group is observationally identical.
//
// Keys are exact object identities: the layout plus each entry's
// (binding, buffer identity, offset, size). Any entry that is not a plain
// buffer binding falls back to direct creation. A destroyed buffer never
// produces a stale hit because callers key with the buffer OBJECT they are
// about to bind; a replacement buffer is a new identity and therefore a new
// key. Per-layout stores are pruned FIFO past a bounded entry count so
// transient-buffer keys cannot grow the cache without bound.

const PER_LAYOUT_ENTRY_CAP = 256;

const bufferIdentities = new WeakMap();
let nextBufferIdentity = 1;

function bufferIdentity(buffer) {
  let id = bufferIdentities.get(buffer);
  if (id == null) {
    id = nextBufferIdentity;
    nextBufferIdentity += 1;
    bufferIdentities.set(buffer, id);
  }
  return id;
}

const layoutStores = new WeakMap();

function layoutStore(layout) {
  let store = layoutStores.get(layout);
  if (!store) {
    store = new Map();
    layoutStores.set(layout, store);
  }
  return store;
}

function entriesKey(entries) {
  let key = '';
  for (const entry of entries) {
    const resource = entry?.resource;
    const buffer = resource?.buffer;
    if (!buffer || typeof buffer.destroy !== 'function') return null;
    key += entry.binding
      + ':' + bufferIdentity(buffer)
      + ':' + (resource.offset ?? 0)
      + ':' + (resource.size ?? -1)
      + ';';
  }
  return key;
}

export function cachedWebGpuBindGroup(device, { label, layout, entries }) {
  const key = entriesKey(entries);
  if (key == null) {
    return device.createBindGroup({ label, layout, entries });
  }
  const store = layoutStore(layout);
  const cached = store.get(key);
  if (cached) return cached;
  const bindGroup = device.createBindGroup({ label, layout, entries });
  if (store.size >= PER_LAYOUT_ENTRY_CAP) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(key, bindGroup);
  return bindGroup;
}
