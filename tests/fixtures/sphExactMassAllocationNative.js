// Real-device arithmetic and candidate exercise. Expected results are checked
// by the Node harness using BigInt, independently of WGSL's recurrence.
export function exactMassRatioCases(wordCount) {
  const mask = (1n << BigInt(32 * wordCount)) - 1n, rows = [];
  const add = (name, a, lower, upper, denominator) => rows.push({ name, a, lower, upper, denominator });
  add('zero-denominator', 3n, 0n, 0n, 0n);
  add('reversed-interval', 3n, 2n, 1n, 3n);
  add('upper-outside', 3n, 0n, 4n, 3n);
  add('zero-source', 0n, 1n, 2n, 3n);
  add('increment-two', 3n, 0n, 2n, 3n);
  add('full-width-identity', mask, 0n, mask, mask);
  add('full-width-product', mask - 1n, 0n, mask - 1n, mask);
  add('full-width-remainder', mask - 2n, 1n, mask - 1n, mask);
  for (let bit = 1; bit < 32 * wordCount; bit += 31) {
    const boundary = 1n << BigInt(bit);
    add(`boundary-${bit}`, boundary - 1n, 0n, boundary - 1n, boundary + 1n);
    add(`boundary-tail-${bit}`, mask, boundary - 1n, boundary, boundary + 1n);
  }
  let seed = 0x91f3ad7;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const integer = () => {
    let value = 0n;
    for (let i = 0; i < wordCount; i++) value = (value << 32n) | BigInt(random());
    return value;
  };
  for (let i = 0; i < 24; i++) {
    const a = integer(), denominator = integer() || 1n;
    const upper = integer() % (denominator + 1n), lower = integer() % (upper + 1n);
    add(`random-${i}`, a, lower, upper, denominator);
  }
  // The same source divided among nonuniform and zero-weight terms. Each
  // source's five results must telescope to the complete original inventory.
  for (const a of [1n, 3n, 5n, mask - 1n, mask]) {
    const weights = [0n, 7n, 8n, 8n, 31n, 50n];
    for (let i = 1; i < weights.length; i++) add(`partition-${a}-${i}`, a, weights[i - 1], weights[i], 50n);
  }
  return rows;
}

export async function runExactMassRatioNative(device, format, code, inputWords) {
  const n = format.wordCount, count = inputWords.length / (4 * n), stride = 3 * n + 2;
  const module = device.createShaderModule({ code: code + `
@group(0) @binding(0) var<storage, read> ratio_inputs: array<u32>;
@group(0) @binding(1) var<storage, read_write> ratio_outputs: array<u32>;
@compute @workgroup_size(64)
fn exercise_ratio(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${count}u) { return; }
  let base = id.x * ${4 * n}u; let out = id.x * ${stride}u;
  var a: ExactMass; var lower: ExactMass; var upper: ExactMass; var denominator: ExactMass;
  for (var i = 0u; i < EM_WORDS; i++) {
    a.words[i] = ratio_inputs[base + i]; lower.words[i] = ratio_inputs[base + EM_WORDS + i];
    upper.words[i] = ratio_inputs[base + 2u * EM_WORDS + i]; denominator.words[i] = ratio_inputs[base + 3u * EM_WORDS + i];
  }
  let ratio = em_multiply_ratio(a, upper, denominator);
  let share = em_partition_share(a, lower, upper, denominator);
  for (var i = 0u; i < EM_WORDS; i++) {
    ratio_outputs[out + i] = ratio.value.words[i];
    ratio_outputs[out + EM_WORDS + i] = ratio.remainder.words[i];
    ratio_outputs[out + 2u * EM_WORDS + i] = share.value.words[i];
  }
  ratio_outputs[out + 3u * EM_WORDS] = ratio.error;
  ratio_outputs[out + 3u * EM_WORDS + 1u] = share.error;
}` });
  const bad = (await module.getCompilationInfo()).messages.filter(message => message.type === 'error');
  if (bad.length) throw new Error(bad.map(message => `${message.lineNum}: ${message.message}`).join('\n'));
  const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_ratio' } });
  const source = device.createBuffer({ size: inputWords.length * 4, usage: 128 | 4 | 8 });
  const output = device.createBuffer({ size: count * stride * 4, usage: 128 | 4 });
  const readback = device.createBuffer({ size: source.size + output.size, usage: 1 | 8 });
  try {
    const input = new Uint32Array(inputWords); device.queue.writeBuffer(source, 0, input);
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
      [source, output].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, output.size);
    encoder.copyBufferToBuffer(source, 0, readback, output.size, source.size);
    device.queue.submit([encoder.finish()]); await readback.mapAsync(1);
    const mapped = readback.getMappedRange();
    const result = { words: Array.from(new Uint32Array(mapped, 0, output.size / 4)),
      sourceUnchanged: input.every((word, i) => word === new Uint32Array(mapped, output.size)[i]) };
    readback.unmap(); await device.queue.onSubmittedWorkDone(); return result;
  } finally { source.destroy(); output.destroy(); readback.destroy(); }
}

export async function runExactMassAllocationNative({ device, abi, owner, identity, format }) {
  const runs = [], families = [], reads = [];
  const create = masses => {
    const family = owner.createSphExactMassInventoryWebGpu({ device, format, massesKg: masses,
      provenance: { kind: 'initial-conditions', reference: 'native exact product allocation' } });
    families.push(family);
    const read = owner.acquireSphExactMassRead({ family, device }); reads.push(read); return read;
  };
  const observe = async read => {
    const buffer = device.createBuffer({ size: read.byteLength, usage: 1 | 8 });
    try {
      const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(read.buffer, read.byteOffset, buffer, 0, read.byteLength);
      device.queue.submit([encoder.finish()]); await buffer.mapAsync(1);
      const words = Array.from(new Uint32Array(buffer.getMappedRange()));
      buffer.unmap(); await device.queue.onSubmittedWorkDone(); return words;
    } finally { buffer.destroy(); }
  };
  const candidate = async (name, sourceReads, mapping, outputRowCount, edges, fault = null) => {
    const before = await Promise.all(sourceReads.map(observe)), n = format.wordCount, stride = 3 * n + 2;
    const words = new Uint32Array(edges.length * stride);
    edges.forEach(([donor, receiver, lower, upper, denominator], index) => {
      const base = index * stride; words.set([donor, receiver], base);
      for (const [i, value] of [lower, upper, denominator].entries()) words.set(abi.encodeSphExactMassUnits(value, format), base + 2 + i * n);
    });
    const destinations = device.createBuffer({ size: mapping.length * 4, usage: 4 | 8 });
    const graph = edges.length ? device.createBuffer({ size: words.byteLength, usage: 4 | 8 }) : null;
    identity.tagWebGpuBufferDevice(destinations, device);
    device.queue.writeBuffer(destinations, 0, new Uint32Array(mapping));
    if (graph) { identity.tagWebGpuBufferDevice(graph, device); device.queue.writeBuffer(graph, 0, words); }
    const createEncoder = device.createCommandEncoder;
    if (fault === 'omit-validation') device.createCommandEncoder = function(...args) {
      const encoder = createEncoder.apply(this, args), begin = encoder.beginComputePass;
      encoder.beginComputePass = function(...args) {
        const pass = begin.apply(this, args), set = pass.setPipeline, dispatch = pass.dispatchWorkgroups;
        let skip = false;
        pass.setPipeline = function(pipeline) { skip = pipeline.label === 'exact_mass_validate'; return set.call(this, pipeline); };
        pass.dispatchWorkgroups = function(...args) { if (!skip) return dispatch.apply(this, args); };
        return pass;
      };
      return encoder;
    };
    let result, failure = null, next = null;
    try {
      result = await owner.runSphExactMassAllocationCandidateWebGpu({ device, sourceReads, outputRowCount,
        destinationBuffer: destinations, edgeBuffer: graph, edgeCount: edges.length, edgeFormat: format });
      if (result.family) {
        families.push(result.family); next = owner.acquireSphExactMassRead({ family: result.family, device }); reads.push(next);
      }
    } catch (error) { failure = String(error); }
    finally { device.createCommandEncoder = createEncoder; destinations.destroy(); graph?.destroy(); }
    runs.push({ name, before, sourceAfter: await Promise.all(sourceReads.map(observe)), mapping, outputRowCount,
      edges: edges.map(edge => edge.map(value => typeof value === 'bigint' ? String(value) : value)),
      ready: result?.ready ?? false, errorBits: result?.errorBits ?? null, observedBytes: result?.observedBytes ?? null,
      physicalPublicationAdmitted: result?.physicalPublicationAdmitted ?? false,
      packetSelection: result?.packetSelection ?? null, provenanceKind: result?.family?.provenance.kind ?? null,
      after: next ? await observe(next) : null, failure });
    return next;
  };
  try {
    const source = create([1 + 2 ** -30, 2 ** -20 + 2 ** -50]);
    const thirds = [[0, 1, 0n, 1n, 3n], [0, 2, 1n, 2n, 3n], [0, 3, 2n, 3n, 3n]];
    const allocated = await candidate('joined-reactant-product-thirds', [source], [0, 0], 4, thirds);
    await candidate('permuted-product-edges', [source], [0, 0], 4, [...thirds].reverse());
    await candidate('partial-allocation-retains-remainder', [source], [0, 0], 4, thirds.slice(0, 2));
    await candidate('zero-weight-term', [source], [0, 0], 4, [[0, 1, 0n, 0n, 3n], [0, 2, 0n, 3n, 3n]]);
    await candidate('incoming-is-not-available', [source], [0, 0], 3, [[0, 1, 0n, 1n, 1n], [1, 2, 0n, 1n, 1n]]);
    for (const [name, edges] of [
      ['zero-denominator', [[0, 1, 0n, 1n, 0n]]],
      ['reversed-interval', [[0, 1, 2n, 1n, 3n]]],
      ['outside-interval', [[0, 1, 0n, 4n, 3n]]],
      ['gross-overspend', [[0, 1, 0n, 3n, 3n], [0, 2, 0n, 3n, 3n]]],
      ['invalid-endpoint', [[0, 3, 0n, 1n, 3n]]],
      ['self-edge', [[0, 0, 0n, 1n, 3n]]]
    ]) await candidate(name, [source], [0, 0], 3, edges);
    await candidate('missing-allocation-validation', [source], [0, 0], 4, thirds, 'omit-validation');
    if (!allocated) throw new Error('Cannot continue rejected product allocation');
    const residual = owner.sliceSphExactMassRead(allocated, { device, rowOffset: 3, rowCount: 1 }); reads.push(residual);
    owner.releaseSphExactMassInventory(allocated.family); await owner.releaseSphExactMassRead(allocated);
    await candidate('successor-spends-whole-residual-window', [residual], [0], 2, [[0, 1, 0n, 1n, 1n]]);
    const oneQuantum = create([2 ** -149]);
    await candidate('one-quantum-three-products', [oneQuantum], [0], 4, thirds);
    const crowded = create([1, 1, 1]);
    await candidate('shared-destination', [crowded], [0, 1, 2], 4,
      [[0, 3, 0n, 1n, 3n], [1, 3, 0n, 2n, 3n], [2, 3, 0n, 1n, 1n]]);
    return runs;
  } finally {
    for (const family of families) owner.releaseSphExactMassInventory(family);
    await Promise.all(reads.map(read => owner.releaseSphExactMassRead(read)));
    await device.queue.onSubmittedWorkDone();
  }
}
