import {
  COHERENT_SOLID_REST_VERTEX_FLOATS,
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_RENDER_EXECUTION_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA
} from '../../../ulg-gpu-abi/src/coherentSolid.js';
import {
  coherentSolidGridBackdropWgsl,
  coherentSolidShapeRenderWgsl
} from '../../../ulg-gpu-abi/src/coherentSolidRenderWgsl.js';

export * from '../../../ulg-gpu-abi/src/coherentSolidRenderWgsl.js';

const PARAM_BYTES = 64;
export const COHERENT_SOLID_SHAPE_GPU_TIMESTAMP_STAGE = Object.freeze({
  directShapeRender: 'coherentSolidDirectShapeRender'
});
const GPU_BUFFER_USAGE = {
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  INDEX: globalThis.GPUBufferUsage?.INDEX ?? 16,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64
};
const GPU_TEXTURE_USAGE = {
  RENDER_ATTACHMENT: globalThis.GPUTextureUsage?.RENDER_ATTACHMENT ?? 16
};

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 0xffffffff) {
    throw new RangeError(`${label} must be a positive u32`);
  }
  return number;
}

function u32(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) {
    throw new RangeError(`${label} must be a u32`);
  }
  return number;
}

function positiveFinite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${label} must be positive and finite`);
  }
  return number;
}

function vec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(`${label} must be a three-component array`);
  }
  return value.map((component, index) => {
    const number = Number(component);
    if (!Number.isFinite(number)) throw new RangeError(`${label}[${index}] must be finite`);
    return number;
  });
}

function assertDevice(device) {
  for (const method of [
    'createBuffer',
    'createBindGroup',
    'createShaderModule',
    'createRenderPipeline',
    'createTexture'
  ]) {
    if (typeof device?.[method] !== 'function') {
      throw new TypeError(`coherent-solid shape rendering requires device.${method}`);
    }
  }
  if (typeof device?.queue?.writeBuffer !== 'function') {
    throw new TypeError('coherent-solid shape rendering requires device.queue.writeBuffer');
  }
}

function createUploadBuffer(device, { label, data, usage }) {
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, data.byteLength),
    usage: usage | GPU_BUFFER_USAGE.COPY_DST
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

export function createCoherentSolidRestMeshGpu(device, descriptor, {
  label = 'ulg-coherent-solid-rest-mesh'
} = {}) {
  assertDevice(device);
  if (descriptor?.schema !== ULG_COHERENT_SOLID_REST_MESH_SCHEMA) {
    throw new TypeError('rest mesh descriptor uses the wrong coherent-solid schema');
  }
  if (!(descriptor.vertices instanceof Float32Array)) {
    throw new TypeError('rest mesh vertices must be a Float32Array');
  }
  if (!(descriptor.indices instanceof Uint32Array)) {
    throw new TypeError('rest mesh indices must be a Uint32Array');
  }
  const vertexStrideFloats = positiveInteger(
    descriptor.vertexStrideFloats,
    'descriptor.vertexStrideFloats'
  );
  if (vertexStrideFloats !== COHERENT_SOLID_REST_VERTEX_FLOATS) {
    throw new RangeError('rest mesh vertex stride does not match the coherent-solid ABI');
  }
  const vertexCount = positiveInteger(descriptor.vertexCount, 'descriptor.vertexCount');
  const indexCount = positiveInteger(descriptor.indexCount, 'descriptor.indexCount');
  if (descriptor.vertices.length !== vertexCount * vertexStrideFloats) {
    throw new RangeError('rest mesh vertex array length does not match its descriptor');
  }
  if (descriptor.indices.length !== indexCount) {
    throw new RangeError('rest mesh index array length does not match its descriptor');
  }
  if (descriptor.indices.some((index) => index >= vertexCount)) {
    throw new RangeError('rest mesh index references a vertex outside the descriptor');
  }
  const vertexBuffer = createUploadBuffer(device, {
    label: `${label}-vertices`,
    data: descriptor.vertices,
    usage: GPU_BUFFER_USAGE.STORAGE
  });
  const indexBuffer = createUploadBuffer(device, {
    label: `${label}-indices`,
    data: descriptor.indices,
    usage: GPU_BUFFER_USAGE.INDEX
  });
  let destroyed = false;
  return {
    schema: ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
    status: 'coherent-solid-rest-mesh-gpu-resident',
    device,
    geometryKey: u32(descriptor.geometryKey, 'descriptor.geometryKey'),
    topologyGeneration: u32(
      descriptor.topologyGeneration,
      'descriptor.topologyGeneration'
    ),
    vertexBuffer,
    indexBuffer,
    vertexCount,
    indexCount,
    indexFormat: 'uint32',
    vertexStrideFloats,
    persistent: true,
    cpuVertexTransformPerformed: false,
    uploadPolicy: 'rest-geometry-upload-once',
    allocationEntries() {
      return [
        { role: 'persistent-rest-mesh-vertices', buffer: vertexBuffer, owned: true },
        { role: 'persistent-rest-mesh-indices', buffer: indexBuffer, owned: true }
      ];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      vertexBuffer.destroy?.();
      indexBuffer.destroy?.();
    }
  };
}

export function createCoherentSolidRenderParamsArray({
  bodyIndex,
  generationId,
  leaseId,
  leaseEpoch,
  viewCenterM = [0, 0, 0],
  halfWidthM,
  halfHeightM,
  depthScalePerM = 0.01,
  viewportWidthPx,
  viewportHeightPx,
  minorGridSpacingM = 1,
  majorGridSpacingM = 10,
  exposure = 1,
  flags = 0
} = {}) {
  const center = vec3(viewCenterM, 'viewCenterM');
  const halfWidth = positiveFinite(halfWidthM, 'halfWidthM');
  const halfHeight = positiveFinite(halfHeightM, 'halfHeightM');
  const buffer = new ArrayBuffer(PARAM_BYTES);
  const view = new DataView(buffer);
  const setU32 = (index, value) => view.setUint32(index * 4, value, true);
  const setF32 = (index, value) => view.setFloat32(index * 4, value, true);
  setU32(0, u32(bodyIndex, 'bodyIndex'));
  setU32(1, u32(generationId, 'generationId'));
  setU32(2, u32(leaseId, 'leaseId'));
  setU32(3, u32(leaseEpoch, 'leaseEpoch'));
  setF32(4, center[0]);
  setF32(5, center[1]);
  setF32(6, center[2]);
  setF32(7, 1 / halfWidth);
  setF32(8, 1 / halfHeight);
  setF32(9, positiveFinite(depthScalePerM, 'depthScalePerM'));
  setF32(10, positiveFinite(viewportWidthPx, 'viewportWidthPx'));
  setF32(11, positiveFinite(viewportHeightPx, 'viewportHeightPx'));
  setF32(12, positiveFinite(minorGridSpacingM, 'minorGridSpacingM'));
  setF32(13, positiveFinite(majorGridSpacingM, 'majorGridSpacingM'));
  setF32(14, positiveFinite(exposure, 'exposure'));
  setU32(15, u32(flags, 'flags'));
  return buffer;
}

function createPipelines(device, format, label) {
  const shapeModule = device.createShaderModule({
    label: `${label}-shape-shader`,
    code: coherentSolidShapeRenderWgsl
  });
  const backdropModule = device.createShaderModule({
    label: `${label}-backdrop-shader`,
    code: coherentSolidGridBackdropWgsl
  });
  return {
    backdrop: device.createRenderPipeline({
      label: `${label}-grid-backdrop`,
      layout: 'auto',
      vertex: { module: backdropModule, entryPoint: 'backdrop_vertex' },
      fragment: {
        module: backdropModule,
        entryPoint: 'backdrop_fragment',
        targets: [{ format }]
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false,
        depthCompare: 'always'
      }
    }),
    shape: device.createRenderPipeline({
      label: `${label}-persistent-shape`,
      layout: 'auto',
      vertex: { module: shapeModule, entryPoint: 'solid_vertex' },
      fragment: {
        module: shapeModule,
        entryPoint: 'solid_fragment',
        targets: [{ format }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    })
  };
}

function timestampPassDescriptor(timestampProfiler, label, metadata = {}) {
  return timestampProfiler?.beginComputePassDescriptor
    ? timestampProfiler.beginComputePassDescriptor(label, metadata)
    : { label };
}

export function createCoherentSolidShapeRenderer(device, {
  format,
  width,
  height,
  label = 'ulg-coherent-solid-shape-renderer'
} = {}) {
  assertDevice(device);
  if (typeof format !== 'string' || format.length === 0) {
    throw new TypeError('coherent-solid shape renderer requires a canvas format');
  }
  const renderWidth = positiveInteger(width, 'width');
  const renderHeight = positiveInteger(height, 'height');
  const pipelines = createPipelines(device, format, label);
  const depthTexture = device.createTexture({
    label: `${label}-depth`,
    size: [renderWidth, renderHeight, 1],
    format: 'depth24plus',
    usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
  });
  const transientParams = new Set();
  let destroyed = false;

  function encode(encoder, {
    colorView,
    frameSource,
    restMesh,
    bodyIndex = 0,
    viewCenterM = [0, 0, 0],
    halfWidthM,
    halfHeightM,
    depthScalePerM = 0.01,
    minorGridSpacingM = 1,
    majorGridSpacingM = 10,
    exposure = 1,
    allowUnadmittedCandidate = false,
    timestampProfiler = null,
    timestampMetadata = {}
  } = {}) {
    if (destroyed) throw new Error(`${label} is destroyed`);
    if (!encoder?.beginRenderPass) {
      throw new TypeError('shape rendering requires a caller-owned GPUCommandEncoder');
    }
    if (!colorView) throw new TypeError('shape rendering requires a target color texture view');
    if (restMesh?.schema !== ULG_COHERENT_SOLID_REST_MESH_SCHEMA || restMesh.device !== device) {
      throw new TypeError('shape rendering requires a same-device coherent-solid rest mesh');
    }
    const candidate = frameSource?.schema === ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA;
    const admitted = frameSource?.schema === ULG_COHERENT_SOLID_FRAME_SCHEMA
      && frameSource?.authorityStatus === COHERENT_SOLID_STATE_MANAGER_ADMITTED;
    if (!admitted && !(candidate && allowUnadmittedCandidate)) {
      throw new RangeError('shape rendering requires an admitted frame or explicit validation candidate');
    }
    if (frameSource.device !== device || !frameSource.buffer) {
      throw new TypeError('shape rendering frame must be a retained same-device GPUBuffer');
    }
    const selectedBodyIndex = u32(bodyIndex, 'bodyIndex');
    if (selectedBodyIndex >= positiveInteger(frameSource.bodyCount, 'frameSource.bodyCount')) {
      throw new RangeError('bodyIndex exceeds the frame source body count');
    }
    const generationId = u32(frameSource.generationId, 'frameSource.generationId');
    const leaseId = u32(frameSource.leaseId, 'frameSource.leaseId');
    const leaseEpoch = u32(frameSource.leaseEpoch, 'frameSource.leaseEpoch');
    const paramsArray = createCoherentSolidRenderParamsArray({
      bodyIndex: selectedBodyIndex,
      generationId,
      leaseId,
      leaseEpoch,
      viewCenterM,
      halfWidthM,
      halfHeightM,
      depthScalePerM,
      viewportWidthPx: renderWidth,
      viewportHeightPx: renderHeight,
      minorGridSpacingM,
      majorGridSpacingM,
      exposure
    });
    const paramsBuffer = device.createBuffer({
      label: `${label}-params-${generationId}`,
      size: PARAM_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
    });
    transientParams.add(paramsBuffer);
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    const backdropBindGroup = device.createBindGroup({
      label: `${label}-backdrop-bind-group-${generationId}`,
      layout: pipelines.backdrop.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: paramsBuffer, size: PARAM_BYTES } }]
    });
    const shapeBindGroup = device.createBindGroup({
      label: `${label}-shape-bind-group-${generationId}`,
      layout: pipelines.shape.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: frameSource.buffer } },
        { binding: 1, resource: { buffer: restMesh.vertexBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer, size: PARAM_BYTES } }
      ]
    });
    const pass = encoder.beginRenderPass({
      ...timestampPassDescriptor(
        timestampProfiler,
        COHERENT_SOLID_SHAPE_GPU_TIMESTAMP_STAGE.directShapeRender,
        {
          ...timestampMetadata,
          coherentSolidStage: 'direct-shape-render',
          generationId,
          leaseId,
          leaseEpoch
        }
      ),
      colorAttachments: [{
        view: colorView,
        clearValue: { r: 0.012, g: 0.018, b: 0.022, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });
    pass.setPipeline(pipelines.backdrop);
    pass.setBindGroup(0, backdropBindGroup);
    pass.draw(3);
    pass.setPipeline(pipelines.shape);
    pass.setBindGroup(0, shapeBindGroup);
    pass.setIndexBuffer(restMesh.indexBuffer, 'uint32');
    pass.drawIndexed(restMesh.indexCount, 1, 0, 0, 0);
    pass.end();
    let released = false;
    const releaseTransientBuffers = () => {
      if (released) return;
      released = true;
      if (transientParams.delete(paramsBuffer)) paramsBuffer.destroy?.();
    };
    return {
      schema: ULG_COHERENT_SOLID_RENDER_EXECUTION_SCHEMA,
      status: candidate
        ? 'validation-candidate-render-encoded'
        : 'admitted-coherent-solid-render-encoded',
      generationId,
      leaseId,
      leaseEpoch,
      bodyIndex: selectedBodyIndex,
      geometryKey: restMesh.geometryKey,
      topologyGeneration: restMesh.topologyGeneration,
      vertexCount: restMesh.vertexCount,
      indexCount: restMesh.indexCount,
      directResidentFrameStorageBinding: true,
      persistentRestMeshBinding: true,
      cpuFrameTransformUploadPerformed: false,
      particleSpherePathUsed: false,
      densityFieldPathUsed: false,
      schedulerStatus: 'caller-compute-manager-presentation-node',
      submissionOwnership: 'caller',
      queueSubmissionPerformed: false,
      transientBuffers: [paramsBuffer],
      releaseTransientBuffers
    };
  }

  return {
    schema: ULG_COHERENT_SOLID_RENDER_EXECUTION_SCHEMA,
    status: 'coherent-solid-shape-renderer-ready',
    width: renderWidth,
    height: renderHeight,
    format,
    encode,
    allocationEntries() {
      return [{ role: 'coherent-solid-render-depth', texture: depthTexture, owned: true }];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      depthTexture.destroy?.();
      for (const paramsBuffer of transientParams) paramsBuffer.destroy?.();
      transientParams.clear();
    }
  };
}
