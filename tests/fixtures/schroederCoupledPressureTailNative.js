// Browser-only, diagnostic snapshots of the real coupled GPU execution.
// No solver, producer registration, state publication, or admission decision.

function scalarMetadata(value) {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, entry]) =>
    entry == null || ['number', 'string', 'boolean'].includes(typeof entry)
  ));
}

/**
 * Test-only numerical restart copy, NOT successor/publication authority.
 * Targets are allocated/owned by the caller through the normal upload APIs.
 * Validate the entire family before encoding; the caller must submit and fence
 * before retiring either family. No host-computed particle values are written.
 */
export function encodeParticleFamilyCopy(encoder, { sourceUploads, targetUploads }) {
  if (typeof encoder?.copyBufferToBuffer !== 'function') {
    throw new TypeError('Particle family copy requires a live command encoder');
  }
  const components = [
    ['state', 'sphParticleUpload', 'stateBuffer', 'stateBufferByteLength'],
    ['thermo', 'sphParticleUpload', 'thermoBuffer', 'thermoBufferByteLength'],
    ['identity', 'sphParticleUpload', 'identityBuffer', 'identityBufferByteLength'],
    ['mechanics', 'mlsMpmParticleUpload', 'mechanicsBuffer', 'mechanicsBufferByteLength']
  ].map(([name, family, bufferKey, lengthKey]) => ({
    name,
    source: sourceUploads?.[family]?.[bufferKey],
    target: targetUploads?.[family]?.[bufferKey],
    byteLength: sourceUploads?.[family]?.[lengthKey],
    targetByteLength: targetUploads?.[family]?.[lengthKey]
  }));
  const sources = new Set(components.map(({ source }) => source));
  const targets = new Set(components.map(({ target }) => target));
  if (sources.size !== 4 || targets.size !== 4
      || [...targets].some((buffer) => sources.has(buffer))) {
    throw new TypeError('Particle family copies require four disjoint source and target buffers');
  }
  for (const { name, source, target, byteLength, targetByteLength } of components) {
    if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength % 4 !== 0
        || targetByteLength !== byteLength
        || !Number.isSafeInteger(source?.size) || !Number.isSafeInteger(target?.size)
        || source?.size < byteLength || target?.size < byteLength
        || (source?.usage & GPUBufferUsage.COPY_SRC) === 0
        || (target?.usage & GPUBufferUsage.COPY_DST) === 0) {
      throw new TypeError(`${name} requires complete equal-byte COPY_SRC/COPY_DST buffers`);
    }
  }
  for (const { source, target, byteLength } of components) {
    encoder.copyBufferToBuffer(source, 0, target, 0, byteLength);
  }
  return Object.freeze({
    scope: 'manufactured numeric source copy; not an authenticated successor',
    admissionClaim: false,
    byteLengths: Object.freeze(Object.fromEntries(components.map(({ name, byteLength }) =>
      [name, byteLength])))
  });
}

/**
 * Append copies at this exact command-encoder boundary. The caller must submit
 * that encoder before read(), and preserve normal source retirement ordering.
 * Owned readback buffers then survive source/arena retirement. Complete buffer
 * words include padding and potentially unvisited rows, NOT admitted endpoints.
 */
export function encodeSnapshot(device, encoder, execution, { stage } = {}) {
  if (typeof stage !== 'string' || stage.trim().length === 0) {
    throw new TypeError('A coupled diagnostic snapshot requires an explicit stage');
  }
  if (typeof device?.createBuffer !== 'function'
      || typeof encoder?.copyBufferToBuffer !== 'function'
      || !execution?.layout) {
    throw new TypeError('A coupled diagnostic snapshot requires a live encoder and execution');
  }
  const sources = [
    ['workspaceWords', execution.workspaceBuffer],
    ['parentFieldWords', execution.parentFieldView?.parentFieldViewBuffer],
    ['fineFieldWords', execution.fineFieldView?.fieldViewBuffer],
    ['coarseFieldWords', execution.coarseFieldView?.fieldViewBuffer],
    ['refluxLedgerWords', execution.refluxLedgerBuffer]
  ];
  const params = execution.paramsBuffer;
  const paramsCopyable = params != null
    && (params.usage & GPUBufferUsage.COPY_SRC) !== 0;
  if (paramsCopyable) sources.push(['paramsWords', params]);
  for (const [name, source] of sources) {
    if (!Number.isSafeInteger(source?.size) || source.size <= 0
        || source.size % 4 !== 0
        || (source.usage & GPUBufferUsage.COPY_SRC) === 0) {
      throw new TypeError(`${name} requires a complete COPY_SRC u32 buffer`);
    }
  }
  // These are detached encode-time host metadata, not GPU-bound identities or
  // parameters. The copied headers/words remain the actual GPU evidence.
  const metadata = {
    stage,
    scope: 'same-encoder diagnostic snapshot; no physics admission claim',
    admissionClaim: false,
    metadataOrigin: 'encode-time host objects; not GPU readback',
    identities: {
      execution: scalarMetadata(execution),
      parentField: scalarMetadata(execution.parentFieldView),
      fineField: scalarMetadata(execution.fineFieldView),
      coarseField: scalarMetadata(execution.coarseFieldView),
      refluxLedger: scalarMetadata(execution.refluxLedger)
    },
    layouts: {
      workspace: scalarMetadata(execution.layout),
      parentField: scalarMetadata(execution.parentFieldView?.layout),
      fineField: scalarMetadata(execution.fineFieldView?.layout),
      coarseField: scalarMetadata(execution.coarseFieldView?.layout),
      refluxLedger: scalarMetadata(execution.refluxLedger?.layout)
    },
    buffers: Object.fromEntries(sources.map(([name, source]) => [name, {
      byteLength: source.size,
      wordLength: source.size / 4,
      usage: source.usage
    }])),
    paramsCapture: {
      available: paramsCopyable,
      byteLength: params?.size ?? null,
      usage: params?.usage ?? null,
      reason: paramsCopyable ? null : 'paramsBuffer is absent or lacks COPY_SRC; no GPU parameter readback'
    }
  };
  const owned = [];
  let destroyed = false;
  let readPromise = null;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    for (const { buffer } of owned) {
      // Attempt every cleanup even when mapping failed or the device was lost.
      try { buffer.unmap(); } catch { /* Preserve the original read failure. */ }
      try { buffer.destroy(); } catch { /* Continue retiring the other buffers. */ }
    }
  }
  try {
    for (const [name, source] of sources) {
      owned.push({
        name,
        buffer: device.createBuffer({
          label: `coupled-pressure-tail:${stage}:${name}`,
          size: source.size,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        }),
        byteLength: source.size
      });
    }
    for (let index = 0; index < sources.length; index += 1) {
      encoder.copyBufferToBuffer(
        sources[index][1], 0, owned[index].buffer, 0, owned[index].byteLength
      );
    }
  } catch (error) {
    destroy();
    throw error;
  }
  function read() {
    if (readPromise) return readPromise;
    if (destroyed) return Promise.reject(new Error('Coupled snapshot was destroyed before read'));
    readPromise = (async () => {
      try {
        const result = { ...metadata, paramsWords: null };
        for (const { name, buffer, byteLength } of owned) {
          await buffer.mapAsync(GPUMapMode.READ, 0, byteLength);
          try {
            result[name] = Array.from(new Uint32Array(
              buffer.getMappedRange(0, byteLength)
            ));
          } finally {
            buffer.unmap();
          }
        }
        return result;
      } finally {
        destroy();
      }
    })();
    return readPromise;
  }
  return Object.freeze({ stage, read, destroy });
}
