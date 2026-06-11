const GPU_SHADER_STAGE = {
  COMPUTE: globalThis.GPUShaderStage?.COMPUTE ?? 4
};

export function computeBufferBinding(binding, type = 'read-only-storage') {
  return {
    binding,
    visibility: GPU_SHADER_STAGE.COMPUTE,
    buffer: { type }
  };
}

export function createExplicitComputePipeline(device, {
  label,
  module,
  entryPoint = 'main',
  bindings = []
} = {}) {
  let bindGroupLayout = null;
  let pipelineLayout = null;
  if (device?.createBindGroupLayout && device?.createPipelineLayout && bindings.length > 0) {
    bindGroupLayout = device.createBindGroupLayout({
      label: `${label || entryPoint}-bind-group-layout`,
      entries: bindings
    });
    pipelineLayout = device.createPipelineLayout({
      label: `${label || entryPoint}-pipeline-layout`,
      bindGroupLayouts: [bindGroupLayout]
    });
  }
  const pipeline = device.createComputePipeline({
    label,
    layout: pipelineLayout || 'auto',
    compute: { module, entryPoint }
  });
  return {
    pipeline,
    bindGroupLayout: bindGroupLayout || pipeline.getBindGroupLayout(0)
  };
}
