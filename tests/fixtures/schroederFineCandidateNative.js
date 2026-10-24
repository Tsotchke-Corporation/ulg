import {
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_MAGIC,
  SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_VERSION
} from '../../ulg-gpu-abi/src/schroederSpatialParentFieldMechanicsWorkspace.js';
import {
  schroederFineCandidateWgsl,
  FINE_CANDIDATE_HEADER_WORDS,
  FINE_CANDIDATE_ROW_WORDS
} from './schroederFineCandidateWgsl.js';
import {
  schroederFineCandidateGatherWgsl,
  FINE_CANDIDATE_GATHER_HEADER_WORDS,
  FINE_CANDIDATE_GATHER_ROW_WORDS,
  FINE_CANDIDATE_GATHER_PARAMS_BYTES
} from './schroederFineCandidateGatherWgsl.js';

const PARAMS_BYTES = 304;
const scalar = (value) => Object.fromEntries(Object.entries(value ?? {}).filter(
  ([, entry]) => entry == null || ['number', 'string', 'boolean'].includes(typeof entry)
));
const PHASE_STAGES = [
  ['begin_cross_level_phase_volume_admission', [0, 1, 2, 3, 5, 6, 8, 9], 1],
  ['validate_fine_cross_level_phase_volume_admission', [0, 1, 3, 5, 7, 8], 'fine'],
  ['validate_coarse_cross_level_phase_volume_admission', [0, 2, 3, 5, 9, 11], 'coarse'],
  ['seal_cross_level_phase_volume_admission', [1, 2, 3, 5], 1],
  ['propose_cross_level_phase_volume', [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11], 'fine']
];

// TEST ONLY. Split one known production compute-pass boundary without changing
// its pipelines, bindings, dispatches, encoder submission, or source authority.
export function captureFineProjectionBoundary(encoder, { pipelineLabel, onBoundary }) {
  if (typeof pipelineLabel !== 'string'
      || !pipelineLabel.endsWith('-project-prepare-fine-rows-pipeline')
      || typeof onBoundary !== 'function') {
    throw new TypeError('Fine projection capture requires an exact known pipeline label and callback');
  }
  let captureCount = 0;
  const rejectDebug = () => { throw new Error('Fine projection capture does not support debug-group/timestamp ambiguity'); };
  const wrapped = new Proxy(encoder, {
    get(target, property) {
      if (['pushDebugGroup', 'popDebugGroup', 'writeTimestamp'].includes(property)) return rejectDebug;
      if (property !== 'beginComputePass') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return (descriptor = {}) => {
        if (descriptor.timestampWrites != null) rejectDebug();
        let pass = target.beginComputePass(descriptor);
        let pipeline = null;
        const bindings = new Map();
        return new Proxy(pass, {
          get(_originalPass, method) {
            if (['pushDebugGroup', 'popDebugGroup', 'writeTimestamp'].includes(method)) return rejectDebug;
            if (method === 'setPipeline') return (value) => { pipeline = value; return pass.setPipeline(value); };
            if (method === 'setBindGroup') return (...args) => {
              const saved = [...args];
              if (ArrayBuffer.isView(saved[2]) || Array.isArray(saved[2])) saved[2] = saved[2].slice();
              bindings.set(args[0], saved);
              return pass.setBindGroup(...args);
            };
            if (method === 'dispatchWorkgroups' || method === 'dispatchWorkgroupsIndirect') return (...args) => {
              pass[method](...args);
              if (pipeline?.label !== pipelineLabel) return;
              if (++captureCount !== 1) throw new Error('Fine projection capture matched more than one dispatch');
              pass.end();
              onBoundary(target);
              pass = target.beginComputePass(descriptor);
              pass.setPipeline(pipeline);
              for (const saved of bindings.values()) pass.setBindGroup(...saved);
            };
            const value = Reflect.get(pass, method, pass);
            return typeof value === 'function' ? value.bind(pass) : value;
          }
        });
      };
    }
  });
  return Object.freeze({ encoder: wrapped, assertCaptured() {
    if (captureCount !== 1) throw new Error('Fine projection capture did not observe its exact dispatch boundary');
    return true;
  } });
}

/**
 * TEST ONLY. Append exact pre-correction copies, call production correction,
 * then call encodeCandidate on this SAME encoder. No source buffer is mutated.
 * Caller submits normally; neither a mapped zero buffer nor this object grants
 * source/endpoint admission. read() retains owned inputs through retirement.
 */
export function encodeFineCandidateClone(device, encoder, execution, {
  stage = 'first-fine-counterfactual', particleInputs = null
} = {}) {
  if (!device?.createBuffer || !encoder?.copyBufferToBuffer
      || !execution?.layout || execution.fineSubstepOrdinal !== 0) {
    throw new TypeError('Fine candidate requires the actual first-fine execution and encoder');
  }
  const layout = execution.layout;
  const fineCapacity = layout.fineFieldCapacity;
  const coarseCapacity = execution.parentFieldView?.coarseFieldCapacity;
  if (!Number.isSafeInteger(fineCapacity) || fineCapacity <= 0
      || !Number.isSafeInteger(coarseCapacity) || coarseCapacity <= 0
      || execution.paramsBuffer?.size !== PARAMS_BYTES) {
    throw new TypeError('Fine candidate requires exact field capacities and 304-byte uniform');
  }
  const sources = [
    ['workspaceWords', execution.workspaceBuffer, 3],
    ['parentFieldWords', execution.parentFieldView.parentFieldViewBuffer, 0],
    ['fineFieldWords', execution.fineFieldView.fieldViewBuffer, 1],
    ['coarseFieldWords', execution.coarseFieldView.fieldViewBuffer, 2],
    ['refluxLedgerWords', execution.refluxLedgerBuffer, 4]
  ];
  for (const [name, source] of sources) {
    if (!Number.isSafeInteger(source?.size) || source.size <= 0 || source.size % 4
        || (source.usage & GPUBufferUsage.COPY_SRC) === 0) {
      throw new TypeError(`Fine candidate ${name} is not a complete COPY_SRC buffer`);
    }
  }
  const metadata = {
    schema: 'ulg.first-fine-counterfactual-gpu-diagnostic.v1', stage,
    admissionClaim: false, counterfactual: true, declaredRouteAlpha: 1,
    declaredCausalAlpha: 1, fineCapacity, coarseCapacity,
    paramsByteLength: PARAMS_BYTES,
    scope: 'first-fine cloned proposals/endpoints; not production admission or a complete coupled solve',
    metadataOrigin: 'encode-time scalar metadata; GPU identities must match copied headers',
    identities: { execution: scalar(execution), parentField: scalar(execution.parentFieldView),
      fineField: scalar(execution.fineFieldView), coarseField: scalar(execution.coarseFieldView) },
    layouts: { workspace: scalar(layout), parentField: scalar(execution.parentFieldView.layout),
      fineField: scalar(execution.fineFieldView.layout), coarseField: scalar(execution.coarseFieldView.layout) },
    sourceBuffers: Object.fromEntries(sources.map(([name, buffer]) => [name, { byteLength: buffer.size, usage: buffer.usage }])),
    phaseBuffers: {}, dispatches: [],
    particleInputMetadata: particleInputs ? scalar(particleInputs) : null
  };
  const owned = [];
  const reads = [];
  const resources = new Map();
  const particleResources = new Map();
  let encoded = false;
  let encodeAttempted = false;
  let encodeError = null;
  let released = false;
  let destroyRequested = false;
  let readPromise = null;
  let destroyPromise = null;
  const allocate = (label, size, usage) => {
    const buffer = device.createBuffer({ label: `fine-candidate:${stage}:${label}`, size, usage });
    owned.push(buffer);
    return buffer;
  };
  const releaseNow = () => {
    if (released) return;
    released = true;
    for (const buffer of owned) {
      try { buffer.unmap(); } catch { /* Retire all allocations after a map failure. */ }
      try { buffer.destroy(); } catch { /* Preserve original diagnostic error. */ }
    }
  };
  const appendRead = (targetEncoder, name, buffer) => {
    const readback = allocate(`${name}:readback`, buffer.size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
    reads.push({ name, buffer: readback, size: buffer.size });
    targetEncoder.copyBufferToBuffer(buffer, 0, readback, 0, buffer.size);
  };
  const storageUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
  try {
    for (const [name, source, binding] of sources) {
      const clone = allocate(`${name}:clone`, source.size, storageUsage);
      resources.set(binding, clone);
      encoder.copyBufferToBuffer(source, 0, clone, 0, source.size);
      // Preserve pre-prefix bytes independently of subsequently mutated clones.
      appendRead(encoder, `preCorrection.${name}`, clone);
    }
    resources.set(11, resources.get(3));
    if (particleInputs) {
      for (const [name, source] of [
        ['activeSourceWords', particleInputs.activeSourceBuffer],
        ['stateWords', particleInputs.stateBuffer],
        ['mechanicsWords', particleInputs.mechanicsBuffer]
      ]) {
        if (!Number.isSafeInteger(source?.size) || source.size <= 0 || source.size % 4
            || (source.usage & GPUBufferUsage.COPY_SRC) === 0) {
          throw new TypeError(`Fine candidate requires complete current particle input ${name}`);
        }
        const clone = allocate(`${name}:clone`, source.size, storageUsage);
        particleResources.set(name, clone);
        encoder.copyBufferToBuffer(source, 0, clone, 0, source.size);
        appendRead(encoder, `particleInputs.${name}`, clone);
      }
    }
  } catch (error) {
    // This synchronous call has not exposed its encoder for submission yet.
    releaseNow();
    throw error;
  }

  function encodeCandidate(targetEncoder, currentExecution = execution) {
    if (encodeAttempted || destroyRequested || released || targetEncoder !== encoder
        || currentExecution !== execution) {
      throw new Error('Fine candidate must be encoded once on its original execution/encoder');
    }
    encodeAttempted = true;
    const dispatch = (entryPoint, code, bindings, groups, boundResources = resources) => {
      const bindGroupLayout = device.createBindGroupLayout({
        label: `fine-candidate:${entryPoint}:layout`,
        entries: bindings.map((binding) => ({ binding, visibility: GPUShaderStage.COMPUTE,
          buffer: { type: binding === 5 ? 'uniform'
            : [0, 6, 7, 8, 9, 10].includes(binding) ? 'read-only-storage' : 'storage' } }))
      });
      const pipeline = device.createComputePipeline({
        label: `fine-candidate:${entryPoint}`, compute: {
          module: device.createShaderModule({ label: `fine-candidate:${entryPoint}:shader`, code }), entryPoint
        }, layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })
      });
      const group = device.createBindGroup({ layout: bindGroupLayout,
        entries: bindings.map((binding) => ({ binding, resource: binding === 3
          ? { buffer: boundResources.get(binding), offset: 0, size: layout.workspaceBindingByteLength }
          : binding === 11 ? { buffer: boundResources.get(binding),
            offset: layout.parentToCoarseOrdinalByteOffset, size: layout.parentToCoarseOrdinalByteLength }
            : { buffer: boundResources.get(binding) } })) });
      const pass = targetEncoder.beginComputePass({ label: `fine-candidate:${entryPoint}` });
      try {
        pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(groups);
      } finally { pass.end(); }
      metadata.dispatches.push({ entryPoint, bindings: [...bindings], groups });
    };
    try {
      const paramsClone = allocate('paramsWords:clone', PARAMS_BYTES, storageUsage | GPUBufferUsage.UNIFORM);
      // Actual GPU uniform bits; no inferred host dt or uniform COPY_SRC assumption.
      dispatch('copy_params', `
        @group(0) @binding(5) var<uniform> original: array<vec4<u32>, 19>;
        @group(0) @binding(12) var<storage, read_write> copied: array<u32>;
        @compute @workgroup_size(64) fn copy_params(@builtin(global_invocation_id) id: vec3<u32>) {
          if (id.x < 76u) { copied[id.x] = original[id.x / 4u][id.x % 4u]; }
        }`, [5, 12], 2, new Map([[5, execution.paramsBuffer], [12, paramsClone]]));
      resources.set(5, paramsClone);
      appendRead(targetEncoder, 'paramsWords', paramsClone);
      const transport = execution.phaseVolumeTransportAuthority;
      if (transport) {
        const phaseSources = [
          ['proposalControlWords', 6, transport.phaseVolumeInterfaceProposalControlBuffer],
          ['refluxRouteWords', 7, transport.phaseVolumeInterfaceRefluxRouteBuffer],
          ['fineMomentWords', 8, transport.finePhaseVolumeMomentBuffer],
          ['coarseMomentWords', 9, transport.coarsePhaseVolumeMomentBuffer],
          ['materialPhaseWords', 10, execution.mechanicsMaterialPhaseBuffer]
        ];
        for (const [name, binding, source] of phaseSources) {
          if (!Number.isSafeInteger(source?.size) || source.size <= 0 || source.size % 4
              || (source.usage & GPUBufferUsage.STORAGE) === 0) {
            throw new TypeError(`Fine candidate requires actual read-only phase source ${name}`);
          }
          const clone = allocate(`${name}:clone`, source.size, storageUsage);
          const copyable = (source.usage & GPUBufferUsage.COPY_SRC) !== 0;
          if (copyable) targetEncoder.copyBufferToBuffer(source, 0, clone, 0, source.size);
          else dispatch('copy_storage_words', `
            @group(0) @binding(0) var<storage, read> original: array<u32>;
            @group(0) @binding(12) var<storage, read_write> copied: array<u32>;
            @compute @workgroup_size(64) fn copy_storage_words(@builtin(global_invocation_id) id: vec3<u32>) {
              if (id.x < arrayLength(&original)) { copied[id.x] = original[id.x]; }
            }`, [0, 12], Math.ceil(source.size / 256), new Map([[0, source], [12, clone]]));
          resources.set(binding, clone);
          metadata.phaseBuffers[name] = { byteLength: source.size, usage: source.usage,
            copyMethod: copyable ? 'copyBufferToBuffer' : 'read-only-storage-u32-mirror' };
          appendRead(targetEncoder, `phaseInputs.${name}`, clone);
        }
        for (const [entryPoint, bindings, count] of PHASE_STAGES) {
          const groups = count === 'fine' ? Math.ceil(fineCapacity / 64)
            : count === 'coarse' ? Math.ceil(coarseCapacity / 64) : count;
          dispatch(entryPoint, schroederFineCandidateWgsl, bindings, groups);
        }
      }
      metadata.phasePrefixEncoded = Boolean(transport);
      const candidate = allocate('candidateWords', (FINE_CANDIDATE_HEADER_WORDS
        + fineCapacity * FINE_CANDIDATE_ROW_WORDS) * 4, storageUsage);
      resources.set(12, candidate);
      // Private explicit superset: source WGSL may share transitive identity helpers.
      const candidateBindings = [0, 1, 2, 3, 4, 5, 11, 12];
      dispatch('candidate_complete_fine_proposals', schroederFineCandidateWgsl,
        candidateBindings, Math.ceil(fineCapacity / 64));
      dispatch('candidate_evaluate_fine_rows', schroederFineCandidateWgsl,
        candidateBindings, Math.ceil(fineCapacity / 64));
      dispatch('candidate_seal_evidence', schroederFineCandidateWgsl, candidateBindings, 1);
      appendRead(targetEncoder, 'candidateWords', candidate);
      if (particleInputs) {
        const { particleCount, gridSpacingM, dt, pressureScale, internalPressureScale } = particleInputs;
        if (!Number.isSafeInteger(particleCount) || particleCount <= 0
            || !Number.isFinite(gridSpacingM) || gridSpacingM <= 0
            || !Number.isFinite(dt) || dt <= 0
            || !Number.isFinite(pressureScale) || !Number.isFinite(internalPressureScale)
            || particleInputs.stateStrideBytes !== 32 || particleInputs.mechanicsStrideBytes !== 128
            || !Number.isSafeInteger(execution.completionOrdinal) || execution.completionOrdinal <= 0) {
          throw new TypeError('Candidate gather requires exact current projection scalars and particle strides');
        }
        const gatherParams = allocate('gatherParamsWords', FINE_CANDIDATE_GATHER_PARAMS_BYTES,
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC);
        const paramsData = new ArrayBuffer(FINE_CANDIDATE_GATHER_PARAMS_BYTES);
        const paramsView = new DataView(paramsData);
        paramsView.setUint32(0, particleCount, true);
        paramsView.setFloat32(4, gridSpacingM, true);
        paramsView.setFloat32(8, 1 / gridSpacingM, true);
        paramsView.setUint32(12, execution.completionOrdinal, true);
        paramsView.setFloat32(16, dt, true);
        paramsView.setFloat32(20, pressureScale, true);
        paramsView.setFloat32(24, internalPressureScale, true);
        paramsView.setUint32(28, execution.fineSubstepOrdinal, true);
        device.queue.writeBuffer(gatherParams, 0, paramsData);
        const gatherOutput = allocate('gatherWords', (FINE_CANDIDATE_GATHER_HEADER_WORDS
          + particleCount * FINE_CANDIDATE_GATHER_ROW_WORDS) * 4, storageUsage);
        const gatherBuffers = [resources.get(1), candidate, particleResources.get('activeSourceWords'),
          particleResources.get('stateWords'), particleResources.get('mechanicsWords'), gatherOutput, gatherParams];
        // Gather has a DIFFERENT binding ABI: full state at 3, storage output
        // at 5 and uniform at 6. Never reuse the workspace's split 3/11 layout.
        const gatherLayout = device.createBindGroupLayout({
          label: 'fine-candidate:gather-layout', entries: gatherBuffers.map((_, binding) => ({
            binding, visibility: GPUShaderStage.COMPUTE,
            buffer: { type: binding === 6 ? 'uniform' : binding === 5 ? 'storage' : 'read-only-storage' }
          }))
        });
        const gatherPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [gatherLayout] });
        const gatherModule = device.createShaderModule({ label: 'fine-candidate:gather-shader', code: schroederFineCandidateGatherWgsl });
        const gatherGroup = device.createBindGroup({ layout: gatherLayout,
          entries: gatherBuffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
        for (const [entryPoint, groups] of [
          ['candidate_gather_begin', 1], ['candidate_gather_particles', Math.ceil(particleCount / 64)],
          ['candidate_gather_seal', 1]
        ]) {
          const pipeline = device.createComputePipeline({ label: `fine-candidate:${entryPoint}`,
            layout: gatherPipelineLayout, compute: { module: gatherModule, entryPoint } });
          const pass = targetEncoder.beginComputePass({ label: `fine-candidate:${entryPoint}` });
          try {
            pass.setPipeline(pipeline); pass.setBindGroup(0, gatherGroup); pass.dispatchWorkgroups(groups);
          } finally { pass.end(); }
          metadata.dispatches.push({ entryPoint, bindings: [0, 1, 2, 3, 4, 5, 6], groups });
        }
        appendRead(targetEncoder, 'gatherParamsWords', gatherParams);
        appendRead(targetEncoder, 'gatherWords', gatherOutput);
        metadata.gatherEncoded = true;
        metadata.gatherUniformOrigin = 'exact first-fine projection/grid-update/continuation arguments, copied GPU-bound uniform';
      }
      for (const [name, , binding] of sources) appendRead(targetEncoder, `candidate.${name}`, resources.get(binding));
      encoded = true;
      return true;
    } catch (error) {
      encodeError = error?.message ?? String(error);
      // Encoder may contain original work; caller's normal finally retires by fence.
      throw error;
    }
  }

  function read() {
    if (readPromise) return readPromise;
    if (destroyRequested || released) return Promise.reject(new Error('Fine candidate destroyed before read'));
    readPromise = (async () => {
      const result = { ...metadata, encoded, encodeError,
        preCorrection: {}, candidate: {}, phaseInputs: {}, particleInputs: {} };
      try {
        await device.queue.onSubmittedWorkDone();
        for (const { name, buffer, size } of reads) {
          await buffer.mapAsync(GPUMapMode.READ, 0, size);
          const words = Array.from(new Uint32Array(buffer.getMappedRange(0, size)));
          buffer.unmap();
          const [group, key] = name.split('.');
          if (key) result[group][key] = words;
          else result[name] = words;
        }
        const header = Object.fromEntries(SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_HEADER_LAYOUT.map(
          (name, index) => [name.split(':')[0], result.preCorrection.workspaceWords?.[index]]));
        result.preCorrectionIdentityConfirmed = header.magic === SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_MAGIC
          && header.abiVersion === SCHROEDER_SPATIAL_PARENT_FIELD_MECHANICS_WORKSPACE_VERSION
          && ['generationId', 'completionOrdinal', 'sourceFamilyId', 'storageGeneration',
            'deviceOrdinal', 'laneOrdinal', 'leaseToken', 'fineSubstepOrdinal']
            .every((name) => header[name] === metadata.identities.execution[name]);
        const evidence = result.candidateWords;
        result.candidateIdentityConfirmed = encoded && evidence?.[0] === 0x46434331 && evidence[1] === 1
          && evidence[11] === header.generationId && evidence[12] === header.completionOrdinal
          && evidence[13] === header.fineSubstepOrdinal;
        result.coverageConfirmed = result.preCorrectionIdentityConfirmed && result.candidateIdentityConfirmed
          && evidence[3] > 0 && evidence[3] <= fineCapacity
          && evidence[4] === evidence[3] && evidence[5] > 0 && evidence[6] === evidence[5]
          && (evidence[2] & 1) === 1;
        result.boundaryEvidenceStatus = !result.preCorrectionIdentityConfirmed
          ? 'unconfirmed-pre-correction-copy-do-not-interpret-operands'
          : !result.coverageConfirmed ? 'incomplete-counterfactual-coverage-no-endpoint-claim'
            : 'complete-counterfactual-coverage-not-physics-admission';
        if (result.gatherWords) {
          const words = result.gatherWords;
          const floatWords = new Float32Array(Uint32Array.from(words).buffer);
          const names = ['magic', 'version', 'flags', 'particleCount', 'expectedActiveCount',
            'visitedCount', 'fineActiveCount', 'completeFineCount', 'nonfiniteCount', 'incompleteCount',
            'clippedCount', 'deformationDisabledCount', 'rawNonpositiveJCount', 'fieldGeneration',
            'fieldCompletionOrdinal', 'fineSubstepOrdinal'];
          const header = Object.fromEntries(names.map((name, index) => [name, words[index]]));
          result.gather = { admissionClaim: false,
            scope: 'counterfactual raw pre-wall/pre-volume-cap first-fine gather; not a complete coupled endpoint',
            header, rows: Array.from({ length: particleInputs.particleCount }, (_, ordinal) => {
              const at = FINE_CANDIDATE_GATHER_HEADER_WORDS + ordinal * FINE_CANDIDATE_GATHER_ROW_WORDS;
              const floats = (start, count) => Array.from(floatWords.slice(at + start, at + start + count));
              return { ordinal, particleIndex: words[at], flags: words[at + 1], sampleCount: words[at + 2],
                sampledWeight: floatWords[at + 3], positionMass: floats(4, 4), velocity: floats(8, 3),
                rawJ: floatWords[at + 11], rawC: floats(12, 9), rawTrialF: floats(21, 9), inputF: floats(30, 9),
                effectiveJ: floatWords[at + 39], effectiveC: floats(40, 9), effectiveTrialF: floats(49, 9),
                clippedCount: words[at + 58], missingCount: words[at + 59], visitedStencilCount: words[at + 60],
                displacementOverDx: floatWords[at + 61], maximumNodeSpeed: floatWords[at + 62], activeOrdinal: words[at + 63] };
            }) };
          result.gatherCoverageConfirmed = result.coverageConfirmed && header.magic === 0x46434731
            && header.version === 1 && header.flags === 15 && header.particleCount === particleInputs.particleCount
            && header.expectedActiveCount > 0 && header.visitedCount === header.expectedActiveCount
            && header.fineActiveCount > 0 && header.completeFineCount === header.fineActiveCount
            && header.nonfiniteCount === 0 && header.incompleteCount === 0
            && header.fieldGeneration === result.preCorrection.fineFieldWords[3]
            && header.fieldCompletionOrdinal === result.preCorrection.fineFieldWords[38]
            && header.fineSubstepOrdinal === execution.fineSubstepOrdinal;
        }
        return result;
      } finally { releaseNow(); }
    })();
    return readPromise;
  }
  function destroy() {
    if (destroyPromise) return destroyPromise;
    destroyRequested = true;
    destroyPromise = (async () => {
      try {
        if (readPromise) await readPromise;
        else await device.queue.onSubmittedWorkDone();
      } catch { /* Device loss/read failure must still retire every owned buffer. */ }
      finally { releaseNow(); }
    })();
    return destroyPromise;
  }
  return Object.freeze({ stage, encodeCandidate, read, destroy });
}
