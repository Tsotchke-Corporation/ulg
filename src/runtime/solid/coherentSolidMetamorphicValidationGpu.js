import {
  COHERENT_SOLID_FRAME_WORDS,
  COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS
} from '../../../ulg-gpu-abi/src/coherentSolid.js';
import {
  coherentSolidMetamorphicValidationWgsl
} from '../../../ulg-gpu-abi/src/coherentSolidMetamorphicValidationWgsl.js';

export const ULG_COHERENT_SOLID_METAMORPHIC_EVIDENCE_SCHEMA =
  'peercompute.ulg.coherent-solid-metamorphic-evidence.v0';
export const COHERENT_SOLID_METAMORPHIC_EVIDENCE_WORDS = 32;
export const COHERENT_SOLID_METAMORPHIC_EVIDENCE_BYTES =
  COHERENT_SOLID_METAMORPHIC_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const COHERENT_SOLID_METAMORPHIC_MODE = Object.freeze({
  partitionEquivalence: 'partition-equivalence',
  chartTransitionContinuity: 'chart-transition-continuity'
});

const MODE_CODE = Object.freeze({
  [COHERENT_SOLID_METAMORPHIC_MODE.partitionEquivalence]: 0,
  [COHERENT_SOLID_METAMORPHIC_MODE.chartTransitionContinuity]: 1
});
const VALIDATION_WORKGROUP_SIZE = 64;
const PARAM_WORDS = 24;
const PARAM_BYTES = PARAM_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const U32_BYTES = Uint32Array.BYTES_PER_ELEMENT;
const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128
};

function u32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) {
    throw new RangeError(`${label} must be a u32`);
  }
  return number;
}

function i32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < -0x80000000 || number > 0x7fffffff) {
    throw new RangeError(`${label} must be an i32`);
  }
  return number;
}

function finiteTolerance(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${label} must be finite and non-negative`);
  }
  return number;
}

function assertBuffer(buffer, minimumBytes, label) {
  if (!buffer) throw new TypeError(`${label} requires a GPUBuffer`);
  const size = Number(buffer.size ?? buffer.byteLength);
  if (Number.isFinite(size) && size < Math.max(4, minimumBytes)) {
    throw new RangeError(
      `${label} requires at least ${Math.max(4, minimumBytes)} bytes, received ${size}`
    );
  }
  return buffer;
}

function validateSource(device, source, label) {
  if (!source || source.device !== device) {
    throw new TypeError(`${label} must retain the validator WebGPU device`);
  }
  const generationId = u32(source.generationId, `${label}.generationId`);
  const chartId = i32(source.chartId, `${label}.chartId`);
  const levelId = i32(source.levelId, `${label}.levelId`);
  const hierarchyGeneration = u32(
    source.hierarchyGeneration,
    `${label}.hierarchyGeneration`
  );
  const positionEpoch = u32(source.positionEpoch, `${label}.positionEpoch`);
  const frameSource = source.frameSource;
  const bodyCount = u32(frameSource?.bodyCount, `${label}.frameSource.bodyCount`);
  if (frameSource?.device !== device
    || frameSource?.strideWords !== COHERENT_SOLID_FRAME_WORDS
    || frameSource?.generationId !== generationId) {
    throw new TypeError(`${label}.frameSource must be an exact same-device generation`);
  }
  assertBuffer(
    frameSource.buffer,
    bodyCount * COHERENT_SOLID_FRAME_WORDS * U32_BYTES,
    `${label}.frameSource.buffer`
  );
  const worldContactProxies = source.worldContactProxies;
  const proxyCount = u32(
    worldContactProxies?.proxyCount,
    `${label}.worldContactProxies.proxyCount`
  );
  if (worldContactProxies?.device !== device
    || worldContactProxies?.strideWords !== COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS
    || worldContactProxies?.generationId !== generationId
    || worldContactProxies?.chartId !== chartId
    || worldContactProxies?.levelId !== levelId
    || worldContactProxies?.hierarchyGeneration !== hierarchyGeneration
    || worldContactProxies?.positionEpoch !== positionEpoch) {
    throw new TypeError(`${label}.worldContactProxies must match its source generation and chart`);
  }
  assertBuffer(
    worldContactProxies.buffer,
    proxyCount * COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS * U32_BYTES,
    `${label}.worldContactProxies.buffer`
  );
  const drawCount = u32(source.drawCount, `${label}.drawCount`);
  if (drawCount !== bodyCount) {
    throw new RangeError(`${label}.drawCount must equal its body invariant count`);
  }
  assertBuffer(
    source.instanceBodyIndexBuffer,
    drawCount * U32_BYTES,
    `${label}.instanceBodyIndexBuffer`
  );
  return Object.freeze({
    device,
    generationId,
    chartId,
    levelId,
    hierarchyGeneration,
    positionEpoch,
    frameSource,
    bodyCount,
    worldContactProxies,
    proxyCount,
    instanceBodyIndexBuffer: source.instanceBodyIndexBuffer,
    drawCount
  });
}

function createBuffer(device, label, size, usage) {
  return device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(size / 4) * 4),
    usage
  });
}

function createParams(
  left,
  right,
  mode,
  absoluteTolerance,
  relativeTolerance,
  validationExtent,
  validationDispatchX
) {
  const buffer = new ArrayBuffer(PARAM_BYTES);
  const view = new DataView(buffer);
  const setU32 = (word, value) => view.setUint32(word * 4, value, true);
  const setI32 = (word, value) => view.setInt32(word * 4, value, true);
  const setF32 = (word, value) => view.setFloat32(word * 4, value, true);
  setU32(0, left.bodyCount);
  setU32(1, right.bodyCount);
  setU32(2, left.proxyCount);
  setU32(3, right.proxyCount);
  setU32(4, left.drawCount);
  setU32(5, right.drawCount);
  setU32(6, MODE_CODE[mode]);
  setU32(7, left.generationId);
  setU32(8, right.generationId);
  setI32(9, left.chartId);
  setI32(10, left.levelId);
  setU32(11, left.hierarchyGeneration);
  setU32(12, left.positionEpoch);
  setI32(13, right.chartId);
  setI32(14, right.levelId);
  setU32(15, right.hierarchyGeneration);
  setU32(16, right.positionEpoch);
  setF32(17, absoluteTolerance);
  setF32(18, relativeTolerance);
  setU32(19, validationExtent);
  setU32(20, validationDispatchX);
  setU32(21, VALIDATION_WORKGROUP_SIZE);
  setU32(22, 0);
  setU32(23, 0);
  return buffer;
}

function dispatchShapeFor(extent, maxWorkgroupsPerDimension) {
  const groupCount = Math.max(1, Math.ceil(extent / VALIDATION_WORKGROUP_SIZE));
  const x = Math.min(groupCount, maxWorkgroupsPerDimension);
  const y = Math.ceil(groupCount / x);
  if (y > maxWorkgroupsPerDimension) {
    throw new RangeError('coherent-solid metamorphic validation exceeds the device 2D dispatch limit');
  }
  return [x, y, 1];
}

export function createCoherentSolidMetamorphicValidationGpu(device, {
  label = 'ulg-coherent-solid-metamorphic-validation'
} = {}) {
  if (!device?.createBuffer
    || !device?.createShaderModule
    || !device?.createComputePipeline
    || !device?.createBindGroup
    || !device?.queue?.writeBuffer) {
    throw new TypeError('coherent-solid metamorphic validation requires a WebGPU device');
  }
  const shaderModule = device.createShaderModule({
    label: `${label}-shader`,
    code: coherentSolidMetamorphicValidationWgsl
  });
  const pipeline = (suffix, entryPoint) => device.createComputePipeline({
    label: `${label}-${suffix}`,
    layout: 'auto',
    compute: { module: shaderModule, entryPoint }
  });
  const pipelines = Object.freeze({
    initialize: pipeline('initialize', 'initialize_coherent_solid_metamorphic_evidence'),
    validate: pipeline('validate', 'validate_coherent_solid_metamorphic_rows'),
    finalize: pipeline('finalize', 'finalize_coherent_solid_metamorphic_evidence')
  });
  let destroyed = false;
  let executionSerial = 0;

  const encode = (commandEncoder, {
    left: rawLeft,
    right: rawRight,
    mode = COHERENT_SOLID_METAMORPHIC_MODE.partitionEquivalence,
    absoluteTolerance = 2e-5,
    relativeTolerance = 2e-5
  } = {}) => {
    if (destroyed) throw new Error('coherent-solid metamorphic validator is destroyed');
    if (!commandEncoder?.beginComputePass) {
      throw new TypeError('coherent-solid metamorphic validation requires a caller command encoder');
    }
    if (!Object.hasOwn(MODE_CODE, mode)) {
      throw new RangeError(`unsupported coherent-solid metamorphic mode: ${mode}`);
    }
    const left = validateSource(device, rawLeft, 'left');
    const right = validateSource(device, rawRight, 'right');
    const absTolerance = finiteTolerance(absoluteTolerance, 'absoluteTolerance');
    const relTolerance = finiteTolerance(relativeTolerance, 'relativeTolerance');
    const validationExtent = Math.max(
      left.bodyCount,
      right.bodyCount,
      left.proxyCount,
      right.proxyCount,
      left.drawCount,
      right.drawCount
    );
    const maxWorkgroupsPerDimension = u32(
      Number(device.limits?.maxComputeWorkgroupsPerDimension ?? 65535),
      'device.limits.maxComputeWorkgroupsPerDimension'
    );
    if (maxWorkgroupsPerDimension === 0) {
      throw new RangeError('device maxComputeWorkgroupsPerDimension must be positive');
    }
    const validationDispatch = dispatchShapeFor(
      validationExtent,
      maxWorkgroupsPerDimension
    );
    executionSerial += 1;
    const executionLabel = `${label}-${executionSerial}`;
    const paramsBuffer = createBuffer(
      device,
      `${executionLabel}-params`,
      PARAM_BYTES,
      GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    );
    const evidenceBuffer = createBuffer(
      device,
      `${executionLabel}-evidence`,
      COHERENT_SOLID_METAMORPHIC_EVIDENCE_BYTES,
      GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST
    );
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      createParams(
        left,
        right,
        mode,
        absTolerance,
        relTolerance,
        validationExtent,
        validationDispatch[0]
      )
    );
    const validationEntries = [
      { binding: 0, resource: { buffer: left.frameSource.buffer } },
      { binding: 1, resource: { buffer: right.frameSource.buffer } },
      { binding: 2, resource: { buffer: left.worldContactProxies.buffer } },
      { binding: 3, resource: { buffer: right.worldContactProxies.buffer } },
      { binding: 4, resource: { buffer: left.instanceBodyIndexBuffer } },
      { binding: 5, resource: { buffer: right.instanceBodyIndexBuffer } },
      { binding: 6, resource: { buffer: paramsBuffer } },
      { binding: 7, resource: { buffer: evidenceBuffer } }
    ];
    const evidenceEntries = validationEntries.slice(6);
    const bindGroup = (suffix, computePipeline, entries) => device.createBindGroup({
      label: `${executionLabel}-${suffix}-bind-group`,
      layout: computePipeline.getBindGroupLayout(0),
      entries
    });
    const passes = [
      {
        suffix: 'initialize',
        pipeline: pipelines.initialize,
        entries: evidenceEntries,
        dispatch: [1, 1, 1]
      },
      {
        suffix: 'validate',
        pipeline: pipelines.validate,
        entries: validationEntries,
        dispatch: validationDispatch
      },
      {
        suffix: 'finalize',
        pipeline: pipelines.finalize,
        entries: evidenceEntries,
        dispatch: [1, 1, 1]
      }
    ];
    for (const stage of passes) {
      const pass = commandEncoder.beginComputePass({
        label: `${executionLabel}-${stage.suffix}`
      });
      pass.setPipeline(stage.pipeline);
      pass.setBindGroup(0, bindGroup(stage.suffix, stage.pipeline, stage.entries));
      pass.dispatchWorkgroups(...stage.dispatch);
      pass.end();
    }
    let released = false;
    return Object.freeze({
      schema: ULG_COHERENT_SOLID_METAMORPHIC_EVIDENCE_SCHEMA,
      status: 'gpu-evidence-encoded-awaiting-caller-submit',
      mode,
      device,
      evidenceBuffer,
      evidenceWordCount: COHERENT_SOLID_METAMORPHIC_EVIDENCE_WORDS,
      evidenceByteLength: COHERENT_SOLID_METAMORPHIC_EVIDENCE_BYTES,
      readbackPolicy: 'fixed-evidence-only-explicit-validation',
      fullStateReadbackPerformed: false,
      queueSubmissionPerformed: false,
      executionShape: Object.freeze({
        workgroupSize: VALIDATION_WORKGROUP_SIZE,
        validationExtent,
        dispatch: Object.freeze([...validationDispatch]),
        reductionPasses: Object.freeze(['initialize', 'validate', 'finalize'])
      }),
      release() {
        if (released) return false;
        released = true;
        paramsBuffer.destroy();
        evidenceBuffer.destroy();
        return true;
      }
    });
  };

  return Object.freeze({
    schema: 'peercompute.ulg.coherent-solid-metamorphic-validator.v0',
    status: 'ready',
    device,
    pipelines,
    evidenceByteLength: COHERENT_SOLID_METAMORPHIC_EVIDENCE_BYTES,
    encode,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      return true;
    }
  });
}

export function encodeCoherentSolidMetamorphicSnapshotGpu(
  device,
  commandEncoder,
  rawSource,
  { label = 'ulg-coherent-solid-metamorphic-snapshot' } = {}
) {
  if (!commandEncoder?.copyBufferToBuffer) {
    throw new TypeError('coherent-solid metamorphic snapshot requires a caller command encoder');
  }
  const source = validateSource(device, rawSource, 'source');
  const frameBytes = source.bodyCount * COHERENT_SOLID_FRAME_WORDS * U32_BYTES;
  const proxyBytes = source.proxyCount * COHERENT_SOLID_WORLD_CONTACT_PROXY_WORDS * U32_BYTES;
  const drawBytes = source.drawCount * U32_BYTES;
  const usage = GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST;
  const frameBuffer = createBuffer(device, `${label}-frames`, frameBytes, usage);
  const proxyBuffer = createBuffer(device, `${label}-world-contact-proxies`, proxyBytes, usage);
  const drawBuffer = createBuffer(device, `${label}-draw-indices`, drawBytes, usage);
  if (frameBytes > 0) {
    commandEncoder.copyBufferToBuffer(source.frameSource.buffer, 0, frameBuffer, 0, frameBytes);
  }
  if (proxyBytes > 0) {
    commandEncoder.copyBufferToBuffer(
      source.worldContactProxies.buffer,
      0,
      proxyBuffer,
      0,
      proxyBytes
    );
  }
  if (drawBytes > 0) {
    commandEncoder.copyBufferToBuffer(
      source.instanceBodyIndexBuffer,
      0,
      drawBuffer,
      0,
      drawBytes
    );
  }
  let released = false;
  const snapshotSource = Object.freeze({
    device,
    generationId: source.generationId,
    chartId: source.chartId,
    levelId: source.levelId,
    hierarchyGeneration: source.hierarchyGeneration,
    positionEpoch: source.positionEpoch,
    frameSource: Object.freeze({
      ...source.frameSource,
      device,
      buffer: frameBuffer
    }),
    worldContactProxies: Object.freeze({
      ...source.worldContactProxies,
      device,
      buffer: proxyBuffer
    }),
    instanceBodyIndexBuffer: drawBuffer,
    drawCount: source.drawCount
  });
  return Object.freeze({
    schema: 'peercompute.ulg.coherent-solid-metamorphic-snapshot.v0',
    status: 'gpu-to-gpu-snapshot-encoded-awaiting-caller-submit',
    device,
    source: snapshotSource,
    copiedBytes: frameBytes + proxyBytes + drawBytes,
    hostMappedBytes: 0,
    fullStateReadbackPerformed: false,
    release() {
      if (released) return false;
      released = true;
      frameBuffer.destroy();
      proxyBuffer.destroy();
      drawBuffer.destroy();
      return true;
    }
  });
}

export function decodeCoherentSolidMetamorphicEvidence(words) {
  if (!(words instanceof Uint32Array)
    || words.length !== COHERENT_SOLID_METAMORPHIC_EVIDENCE_WORDS) {
    throw new TypeError('coherent-solid metamorphic evidence requires exactly 32 u32 words');
  }
  if (words[0] !== 0x534f4c4d || words[1] !== 1) {
    throw new Error('coherent-solid metamorphic evidence has an unknown header');
  }
  const f32 = (word) => new Float32Array(new Uint32Array([word]).buffer)[0];
  return Object.freeze({
    schema: ULG_COHERENT_SOLID_METAMORPHIC_EVIDENCE_SCHEMA,
    status: words[3] === 1 ? 'metamorphic-pair-admissible' : 'metamorphic-pair-rejected',
    mode: words[2] === 1
      ? COHERENT_SOLID_METAMORPHIC_MODE.chartTransitionContinuity
      : COHERENT_SOLID_METAMORPHIC_MODE.partitionEquivalence,
    numericallyAdmissible: words[3] === 1,
    leftBodyCount: words[4],
    rightBodyCount: words[5],
    leftProxyCount: words[6],
    rightProxyCount: words[7],
    bodyCountMismatchCount: words[8],
    proxyCountMismatchCount: words[9],
    drawCountMismatchCount: words[10],
    leftProxyOrderViolationCount: words[11],
    rightProxyOrderViolationCount: words[12],
    proxyIdentityMismatchCount: words[13],
    proxyStaticMismatchCount: words[14],
    proxyMetadataMismatchCount: words[15],
    bodyIdentityMismatchCount: words[16],
    bodyStaticMismatchCount: words[17],
    bodyMetadataMismatchCount: words[18],
    drawIndexMismatchCount: words[19],
    leftDrawIdentityMismatchCount: words[20],
    rightDrawIdentityMismatchCount: words[21],
    nonFiniteResidualCount: words[22],
    maxProxyPositionResidualM: f32(words[23]),
    maxProxyNormalResidual: f32(words[24]),
    maxProxyVelocityResidualMPerS: f32(words[25]),
    maxProxyMeasureResidual: f32(words[26]),
    maxBodyCenterResidualM: f32(words[27]),
    maxBodyOrientationResidual: f32(words[28]),
    maxBodyMomentumRelativeResidual: f32(words[29]),
    maxBodyEnergyRelativeResidual: f32(words[30]),
    validationStatusFlags: words[31],
    mappedEvidenceBytes: COHERENT_SOLID_METAMORPHIC_EVIDENCE_BYTES,
    fullStateReadbackPerformed: false,
    readbackMode: 'fixed-gpu-reduction-evidence-only'
  });
}

export { coherentSolidMetamorphicValidationWgsl };
