import { chromium } from '@playwright/test';

import { buildSphReactionTable } from '../src/runtime/sph/sphReactionGpuKernel.js';

const particleCount = Math.max(
  2,
  Math.round(Number(process.env.ULG_PRODUCT_PREFIX_PARTICLE_COUNT || 300_000))
);
const baseUrl = process.env.ULG_PRODUCT_PREFIX_BASE_URL || 'https://127.0.0.1:5173/';

const materialProperties = {
  a: {
    molarMassKgPerMol: 0.01,
    phases: [{
      name: 'solid',
      temperatureRange: [0, 2000],
      cpJPerKgK: 1000,
      densityKgPerM3: 1000,
      bulkModulusPa: 1e6,
      shearModulusPa: 2e5
    }],
    transitions: []
  },
  b: {
    molarMassKgPerMol: 0.02,
    phases: [{
      name: 'liquid',
      temperatureRange: [0, 2000],
      cpJPerKgK: 1200,
      densityKgPerM3: 800,
      bulkModulusPa: 8e5,
      shearModulusPa: 0
    }],
    transitions: []
  },
  ab: {
    molarMassKgPerMol: 0.03,
    phases: [{
      name: 'liquid',
      temperatureRange: [0, 3000],
      cpJPerKgK: 1500,
      densityKgPerM3: 500,
      bulkModulusPa: 5e5,
      shearModulusPa: 0
    }],
    transitions: []
  },
  c2: {
    molarMassKgPerMol: 0.004,
    phases: [{
      name: 'gas',
      temperatureRange: [0, 3000],
      cpJPerKgK: 14000,
      densityKgPerM3: 0.1,
      bulkModulusPa: 1e5,
      shearModulusPa: 0
    }],
    transitions: []
  }
};

const packed = buildSphReactionTable([{
  a: 'a',
  b: 'b',
  product: 'ab',
  activationTemperatureK: 0,
  phaseRequirements: { b: ['liquid'] },
  specificEnthalpyJPerKg: -1000,
  stoichiometry: {
    equation: '2 A + 2 B -> 2 AB + C2',
    atomBalance: { balanced: true },
    reactants: [
      { coefficient: 2, formula: 'A', material: 'a' },
      { coefficient: 2, formula: 'B', material: 'b' }
    ],
    products: [
      { coefficient: 2, formula: 'AB', material: 'ab' },
      { coefficient: 1, formula: 'C2', material: 'c2' }
    ]
  }
}], { materialProperties, contactRadiusM: 0.1 });

const table = {
  schema: packed.schema,
  reactionCount: packed.reactionCount,
  productPhaseCount: packed.productPhaseCount,
  reactantTermCount: packed.reactantTermCount,
  productTermCount: packed.productTermCount,
  gasProductCount: packed.gasProductCount,
  atomTermCount: packed.atomTermCount,
  reactionHeaderStrideFloats: packed.reactionHeaderStrideFloats,
  reactionHeaders: Array.from(packed.reactionHeaders),
  combinedRecords: Array.from(packed.combinedRecords),
  materialA: packed.records[0],
  materialB: packed.records[1]
};

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer'
  ]
});

try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const result = await page.evaluate(async ({ table, particleCount }) => {
    const nonce = Date.now();
    const [runtime, wgsl] = await Promise.all([
      import(`/src/runtime/sph/sphReactionProductEventGpu.js?probe=${nonce}`),
      import(`/ulg-gpu-abi/src/wgsl.js?probe=${nonce}`)
    ]);
    const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { status: 'adapter-unavailable' };
    const device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(
          10,
          adapter.limits.maxStorageBuffersPerShaderStage
        ),
        maxBufferSize: Math.min(512 * 1024 * 1024, adapter.limits.maxBufferSize),
        maxStorageBufferBindingSize: Math.min(
          512 * 1024 * 1024,
          adapter.limits.maxStorageBufferBindingSize
        )
      }
    });
    const uncapturedErrors = [];
    device.addEventListener('uncapturederror', (event) => {
      uncapturedErrors.push(event.error?.message || String(event.error));
    });
    device.pushErrorScope('validation');

    const makeBuffer = (label, data, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST) => {
      const buffer = device.createBuffer({
        label,
        size: Math.max(4, data.byteLength),
        usage
      });
      if (data.byteLength > 0) device.queue.writeBuffer(buffer, 0, data);
      return buffer;
    };
    const state = new Float32Array(particleCount * 8);
    state.set([0, 0, 0, 2, 0, 0, 0, 100], 0);
    state.set([0.04, 0, 0, 4, 0, 0, 0, 200], 8);
    const thermo = new Float32Array(particleCount * 12);
    thermo.set([table.materialA, 1, 300, 1000, 1, 0, 0, 0, 0.1, 1, 1, 0], 0);
    thermo.set([table.materialB, 2, 300, 800, 0, 1, 0, 0, 0.1, 1, 1, 0], 12);
    const proposals = new Float32Array(particleCount * 4);
    proposals.fill(-1);
    proposals.set([1, 0, 1, 0.0016], 0);
    proposals.set([0, 0, 2, 0.0016], 4);
    const stateBuffer = makeBuffer('product-prefix-state', state);
    const thermoBuffer = makeBuffer('product-prefix-thermo', thermo);
    const proposalBuffer = makeBuffer('product-prefix-proposals', proposals);
    const reactionRecords = new Float32Array(table.combinedRecords);
    const reactionRecordBuffer = makeBuffer('product-prefix-reaction-records', reactionRecords);
    const reactionTable = {
      ...table,
      reactionHeaders: new Float32Array(table.reactionHeaders),
      combinedRecords: reactionRecords
    };
    const sphParticleState = {
      schema: 'peercompute.ulg.sph-gpu-particle-buffer.v0',
      particleCount,
      state: new Float32Array(),
      thermo: new Float32Array()
    };
    const capacityRows = runtime.sphReactionProductEventCapacityRows({
      particleCount,
      reactionTable
    });
    const workspace = runtime.createSphReactionProductEventPlacementWorkspaceGpu(device, {
      eventCapacityRows: capacityRows,
      particleCapacity: particleCount,
      label: 'product-prefix-benchmark-workspace'
    });
    const outcomeParamsData = new ArrayBuffer(48);
    const outcomeParamsView = new DataView(outcomeParamsData);
    outcomeParamsView.setUint32(0, particleCount, true);
    outcomeParamsView.setUint32(4, 1, true);
    outcomeParamsView.setUint32(8, 0, true);
    outcomeParamsView.setUint32(12, 0, true);
    outcomeParamsView.setUint32(16, 2, true);
    outcomeParamsView.setFloat32(32, 100, true);
    outcomeParamsView.setFloat32(36, 0.9375, true);
    outcomeParamsView.setFloat32(40, 2, true);
    outcomeParamsView.setFloat32(44, 4, true);
    const outcomeParamsBuffer = makeBuffer(
      'product-prefix-manufactured-outcome-params',
      new Uint8Array(outcomeParamsData),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    const outcomeModule = device.createShaderModule({ code: /* wgsl */ `
      struct OutcomeParams {
        particle_count: u32,
        partner_index: u32,
        reaction_index: u32,
        product_term_offset: u32,
        product_term_count: u32,
        _pad0: u32,
        _pad1: u32,
        _pad2: u32,
        extent_mol: f32,
        product_mass_scale: f32,
        source_consumed_mass_kg: f32,
        partner_consumed_mass_kg: f32,
      };
      @group(0) @binding(0) var<storage, read_write> outcomes: array<vec4<u32>>;
      @group(0) @binding(1) var<uniform> params: OutcomeParams;
      @group(0) @binding(2) var<storage, read_write> prefix_metadata: array<u32>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let particle = global_id.x;
        if (particle >= params.particle_count) { return; }
        let base = particle * 2u;
        outcomes[base] = vec4<u32>(0xffffffffu, 0u, 0u, 0u);
        outcomes[base + 1u] = vec4<u32>(0u);
        if (particle == 0u) {
          prefix_metadata[18] = prefix_metadata[2];
          prefix_metadata[19] = 0x4f555443u;
        }
        if (particle != 0u) { return; }
        outcomes[base] = vec4<u32>(
          params.partner_index,
          params.reaction_index,
          params.product_term_offset,
          params.product_term_count
        );
        outcomes[base + 1u] = vec4<u32>(
          bitcast<u32>(params.extent_mol),
          bitcast<u32>(params.product_mass_scale),
          bitcast<u32>(params.source_consumed_mass_kg),
          bitcast<u32>(params.partner_consumed_mass_kg)
        );
      }
    ` });
    const outcomePipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: outcomeModule, entryPoint: 'main' }
    });
    const outcomeBindGroup = device.createBindGroup({
      layout: outcomePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: workspace.reactionOutcomeBuffer } },
        { binding: 1, resource: { buffer: outcomeParamsBuffer } },
        { binding: 2, resource: { buffer: workspace.prefixMetadataBuffer } }
      ]
    });
    const encodeExact = (label) => {
      const encoder = device.createCommandEncoder({ label });
      const admission = runtime.createSphReactionProductEventAdmissionWebGpuEncoderStage({
        device,
        commandEncoder: encoder,
        sphParticleState,
        reactionTable,
        reactionRecordBuffer,
        proposalBuffer,
        productEventPlacementWorkspace: workspace,
        label: `${label}-admission`
      });
      const outcomePass = encoder.beginComputePass({ label: `${label}-manufacture-outcome` });
      outcomePass.setPipeline(outcomePipeline);
      outcomePass.setBindGroup(0, outcomeBindGroup);
      outcomePass.dispatchWorkgroups(Math.ceil(particleCount / 64));
      outcomePass.end();
      const stage = runtime.createSphReactionProductEventWebGpuEncoderStage({
        device,
        commandEncoder: encoder,
        sphParticleState,
        reactionTable,
        sourceStateBuffer: stateBuffer,
        sourceThermoBuffer: thermoBuffer,
        nextStateBuffer: stateBuffer,
        nextThermoBuffer: thermoBuffer,
        reactionRecordBuffer,
        proposalBuffer,
        productEventPlacementWorkspace: workspace,
        productEventAdmissionStage: admission,
        placeProductEvents: false,
        label
      });
      return { encoder, stage };
    };

    let exact = encodeExact('product-prefix-warm');
    device.queue.submit([exact.encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    exact.stage.cleanupSubmittedWork({ destroyProductEvents: false });
    exact = encodeExact('product-prefix-timed');
    const metadataReadback = device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    const eventsReadback = device.createBuffer({
      size: 2 * 128,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    const outcomeReadback = device.createBuffer({
      size: 2 * 32,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    exact.encoder.copyBufferToBuffer(workspace.prefixMetadataBuffer, 0, metadataReadback, 0, 80);
    exact.encoder.copyBufferToBuffer(workspace.productEventBuffer, 0, eventsReadback, 0, 256);
    exact.encoder.copyBufferToBuffer(workspace.reactionOutcomeBuffer, 0, outcomeReadback, 0, 64);
    const exactStarted = performance.now();
    device.queue.submit([exact.encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    const exactMs = performance.now() - exactStarted;
    await Promise.all([
      metadataReadback.mapAsync(GPUMapMode.READ),
      eventsReadback.mapAsync(GPUMapMode.READ),
      outcomeReadback.mapAsync(GPUMapMode.READ)
    ]);
    const metadata = new Uint32Array(metadataReadback.getMappedRange()).slice();
    const events = new Float32Array(eventsReadback.getMappedRange()).slice();
    const outcomeWords = new Uint32Array(outcomeReadback.getMappedRange()).slice();
    const outcomeFloats = new Float32Array(outcomeWords.buffer);
    metadataReadback.unmap();
    eventsReadback.unmap();
    outcomeReadback.unmap();
    exact.stage.cleanupSubmittedWork({ destroyProductEvents: false });

    const denseRows = particleCount * reactionTable.productTermCount;
    const denseBenchmarkRows = Math.min(
      denseRows,
      1_000_000,
      Math.floor(Math.min(
        Number(device.limits.maxBufferSize),
        Number(device.limits.maxStorageBufferBindingSize)
      ) / 128)
    );
    const denseBuffer = device.createBuffer({
      label: 'product-prefix-old-dense-events',
      size: denseBenchmarkRows * 128,
      usage: GPUBufferUsage.STORAGE
    });
    const denseParamsData = new ArrayBuffer(48);
    const denseParamsView = new DataView(denseParamsData);
    denseParamsView.setUint32(0, particleCount, true);
    denseParamsView.setUint32(4, reactionTable.reactionCount, true);
    denseParamsView.setUint32(8, reactionTable.productPhaseCount, true);
    denseParamsView.setUint32(12, reactionTable.reactantTermCount, true);
    denseParamsView.setUint32(16, reactionTable.productTermCount, true);
    denseParamsView.setUint32(20, reactionTable.gasProductCount, true);
    denseParamsView.setUint32(24, Math.ceil(particleCount / 64), true);
    denseParamsView.setUint32(28, 1, true);
    denseParamsView.setUint32(32, reactionTable.atomTermCount, true);
    const denseParams = makeBuffer(
      'product-prefix-old-dense-params',
      new Uint8Array(denseParamsData),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    const denseModule = device.createShaderModule({ code: wgsl.sphReactionProductEventWgsl });
    const densePipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: denseModule, entryPoint: 'main' }
    });
    const denseBindGroup = device.createBindGroup({
      layout: densePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: stateBuffer } },
        { binding: 1, resource: { buffer: thermoBuffer } },
        { binding: 2, resource: { buffer: stateBuffer } },
        { binding: 3, resource: { buffer: thermoBuffer } },
        { binding: 4, resource: { buffer: reactionRecordBuffer } },
        { binding: 5, resource: { buffer: proposalBuffer } },
        { binding: 6, resource: { buffer: denseBuffer } },
        { binding: 7, resource: { buffer: denseParams } }
      ]
    });
    const encodeDense = (label) => {
      const encoder = device.createCommandEncoder({ label });
      const pass = encoder.beginComputePass();
      pass.setPipeline(densePipeline);
      pass.setBindGroup(0, denseBindGroup);
      pass.dispatchWorkgroups(Math.ceil(denseBenchmarkRows / 64));
      pass.end();
      return encoder;
    };
    device.queue.submit([encodeDense('product-prefix-old-dense-warm').finish()]);
    await device.queue.onSubmittedWorkDone();
    const denseStarted = performance.now();
    device.queue.submit([encodeDense('product-prefix-old-dense-timed').finish()]);
    await device.queue.onSubmittedWorkDone();
    const denseMs = performance.now() - denseStarted;
    const validationError = await device.popErrorScope();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rowMassSum = events[3] + events[35];
    const unplacedMassSum = events[13] + events[45];
    const result = {
      status: validationError || uncapturedErrors.length > 0 ? 'validation-error' : 'ok',
      validationError: validationError?.message || null,
      uncapturedErrors,
      particleCount,
      productTermCount: reactionTable.productTermCount,
      denseRows,
      denseBytes: denseRows * 128,
      denseBenchmarkRows,
      denseBenchmarkBytes: denseBenchmarkRows * 128,
      capacityRows,
      physicalEventBytes: workspace.productEventBufferByteLength,
      workspaceTotalBytes: workspace.totalByteLength,
      reactionOutcomeBytes: workspace.reactionOutcomeBufferByteLength,
      reactionOutcomeOwner: Array.from(outcomeWords.slice(0, 4)),
      reactionOutcomeKinetics: Array.from(outcomeFloats.slice(4, 8)),
      twoSubstepArenaBytes: capacityRows * 2 * 128,
      potentialCount: metadata[5],
      exactCount: metadata[6],
      emittedCount: metadata[10],
      overflowFlags: metadata[7],
      mutationAdmitted: metadata[8],
      exactPrefixReady: metadata[9],
      prefixStatus: metadata[17],
      resolveOutcomeGeneration: metadata[18],
      resolveOutcomeReadyMagic: metadata[19],
      dispatch: Array.from(metadata.slice(12, 15)),
      rowMassSum,
      unplacedMassSum,
      sourceConsumedMass: 6,
      conservationAbsError: Math.abs(rowMassSum - 6),
      stableProductTermOrder: [events[5], events[37]],
      exactMs,
      denseMs,
      denseToExactTimeRatio: denseMs / exactMs
    };
    workspace.destroy();
    outcomeParamsBuffer.destroy();
    device.destroy();
    return result;
  }, { table, particleCount });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ok'
    || result.potentialCount !== result.capacityRows
    || result.exactCount !== 2
    || result.emittedCount !== 2
    || result.overflowFlags !== 0
    || result.prefixStatus !== 4
    || result.resolveOutcomeGeneration <= 0
    || result.resolveOutcomeReadyMagic !== 0x4f555443
    || result.conservationAbsError > 1e-5) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
