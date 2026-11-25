import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  composeWgslModule,
  generateRepresentedVolumeWgsl,
  generateVec4LaneAccessorsWgsl,
  representedVolumeAtRestState,
  retargetRepresentedVolumeToPhase,
  writeRepresentedVolumeToMechanicsRow
} from '../../ulg-gpu-abi/src/index.js';
import {
  CANONICAL_ULG_LAW_ADAPTERS,
  assertBindGroupMatchesLawDescriptor,
  generateBindGroupLayoutEntriesFromLawDescriptor
} from '../../src/runtime/sph/lawAdapterContract.js';
import { createGpuResourceLeaseScope } from '../../src/runtime/sph/gpuResourceLease.js';

export async function runSsLawGuardrailsNative() {
  let adapter = null;
  for (let i = 0; i < 5 && !adapter; i += 1) {
    adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) await new Promise((r) => setTimeout(r, 500));
  }
  if (!adapter) return { status: 'unsupported' };
  const device = await adapter.requestDevice();
  const uncapturedErrors = [];
  device.addEventListener('uncapturederror', (e) => uncapturedErrors.push(e.error?.message || String(e.error)));
  device.pushErrorScope('validation');

  const scope = createGpuResourceLeaseScope({ scopeId: 'vulkan-ss-guardrails', epoch: 1 });
  const issueBuf = (label, size, usage, consumer) => {
    const b = device.createBuffer({ label, size, usage });
    const lease = scope.issue(b, {
      label,
      producer: 'guardrails-test',
      expectedConsumers: [consumer],
      onRelease: (res) => res.destroy()
    });
    return { buffer: b, lease };
  };

  try {
    // 1. Compose a real GPU compute shader from named fragments using GENERATED
    //    ABI lane accessors and GENERATED paired RepresentedVolume WGSL!
    const stateAccessors = generateVec4LaneAccessorsWgsl({
      layout: SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
      layoutName: 'SPH_GPU_PARTICLE_STATE_ROW_LAYOUT',
      bufferName: 'sph_state',
      prefix: 'state',
      fields: ['massKg']
    });
    const mechAccessors = generateVec4LaneAccessorsWgsl({
      layout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
      layoutName: 'MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT',
      bufferName: 'mls_mechanics',
      prefix: 'mech',
      fields: ['volumeRatioJ', 'restVolumeM3', 'dynamicViscosityPaS']
    });
    const rvWgsl = generateRepresentedVolumeWgsl({
      mechanicsLayout: MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
      bufferName: 'mls_mechanics'
    });

    const composed = composeWgslModule({
      moduleId: 'ss-law-guardrails-probe',
      variantId: 'retarget-volume-check',
      fragments: [
        {
          slot: 'bindings',
          code: `
@group(0) @binding(0) var<storage, read> sph_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> sph_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> mls_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> out_grid: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> out_momentum: array<vec4<f32>>;`
        },
        { slot: 'state-accessors', code: stateAccessors },
        { slot: 'mechanics-accessors', code: mechAccessors },
        { slot: 'represented-volume', code: rvWgsl },
        {
          slot: 'kernel',
          code: `
@compute @workgroup_size(1)
fn main() {
  let mass = state_mass_kg(0u);
  let rv = represented_volume_from_mechanics(0u);
  let target_rho = sph_thermo[0u].w; // target gas rest density (0.6 kg/m^3)
  let retargeted = represented_volume_retarget_phase(rv, mass, target_rho);
  out_grid[0u] = vec4<f32>(rv.v0_m3, rv.j, rv.current_m3, f32(rv.valid));
  out_momentum[0u] = vec4<f32>(retargeted.v0_m3, retargeted.j, retargeted.current_m3, mech_dynamic_viscosity_pa_s(0u));
}`
        }
      ]
    });

    const shaderModule = device.createShaderModule({ label: composed.moduleId, code: composed.code });
    const info = await shaderModule.getCompilationInfo();
    const compileErrors = info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}: ${m.message}`);

    // 2. Generate the WebGPU GPUBindGroupLayout directly from CANONICAL_ULG_LAW_ADAPTERS ('mls-mpm-p2g')!
    const p2gAdapter = CANONICAL_ULG_LAW_ADAPTERS.find((a) => a.id === 'mls-mpm-p2g');
    const bindingTable = {
      'sph-particle-state': 0,
      'sph-thermo-phase': 1,
      'mls-mpm-mechanics': 2,
      'mls-mpm-grid-velocity': 3,
      'mls-mpm-grid-momentum': 4
    };
    const layoutEntries = generateBindGroupLayoutEntriesFromLawDescriptor(p2gAdapter, bindingTable);
    const bindGroupLayout = device.createBindGroupLayout({ label: 'law-derived-bgl', entries: layoutEntries });
    const pipeline = await device.createComputePipelineAsync({
      label: 'ss-law-guardrails-pipe',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    // 3. Seed inputs using paired RepresentedVolume + layout-derived mechanics write!
    const stateData = new Float32Array(8);
    stateData[3] = 8.0; // massKg = 8.0
    const thermoData = new Float32Array(12);
    thermoData[3] = 0.6; // target gas rest density = 0.6 kg/m^3
    const mechData = new Float32Array(32);
    const liquidVol = representedVolumeAtRestState(8.0, 1000.0);
    writeRepresentedVolumeToMechanicsRow(mechData, 0, liquidVol, MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT);
    mechData[29] = 0.001; // dynamicViscosityPaS = 0.001 Pa*s (water)

    const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    const bState = issueBuf('state', 32, S, 'guardrails-pass');
    const bThermo = issueBuf('thermo', 48, S, 'guardrails-pass');
    const bMech = issueBuf('mech', 128, S, 'guardrails-pass');
    const bGrid = issueBuf('out-grid', 16, S, 'guardrails-pass');
    const bMom = issueBuf('out-mom', 16, S, 'guardrails-pass');
    const bRead = issueBuf('readback', 32, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'readback');
    device.queue.writeBuffer(bState.buffer, 0, stateData);
    device.queue.writeBuffer(bThermo.buffer, 0, thermoData);
    device.queue.writeBuffer(bMech.buffer, 0, mechData);

    const bindEntries = [
      { binding: 0, resource: { buffer: scope.consume(bState.lease, 'guardrails-pass') } },
      { binding: 1, resource: { buffer: scope.consume(bThermo.lease, 'guardrails-pass') } },
      { binding: 2, resource: { buffer: scope.consume(bMech.lease, 'guardrails-pass') } },
      { binding: 3, resource: { buffer: scope.consume(bGrid.lease, 'guardrails-pass') } },
      { binding: 4, resource: { buffer: scope.consume(bMom.lease, 'guardrails-pass') } }
    ];
    assertBindGroupMatchesLawDescriptor(p2gAdapter, bindingTable, bindEntries);
    const bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries: bindEntries });

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    const readBuf = scope.consume(bRead.lease, 'readback');
    enc.copyBufferToBuffer(bGrid.buffer, 0, readBuf, 0, 16);
    enc.copyBufferToBuffer(bMom.buffer, 0, readBuf, 16, 16);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const out = Array.from(new Float32Array(readBuf.getMappedRange().slice(0)));
    readBuf.unmap();

    // Release all leases and assert strictly drained!
    for (const item of [bState, bThermo, bMech, bGrid, bMom, bRead]) {
      scope.release(item.lease, { by: 'teardown' });
    }
    const leaseSnapshot = scope.assertDrained({ requireAllReleased: true });
    const hostExpected = retargetRepresentedVolumeToPhase(liquidVol, 8.0, 0.6);
    const validationError = await device.popErrorScope();
    return {
      status: 'ok',
      compileErrors,
      fingerprint: composed.fingerprint,
      activeFragments: composed.activeFragments,
      gpuSourceVolume: out.slice(0, 4),
      gpuRetargetedVolumeAndVisc: out.slice(4, 8),
      hostExpectedRetargeted: [hostExpected.restVolumeM3, hostExpected.volumeRatioJ, hostExpected.currentVolumeM3],
      leaseSnapshot,
      validationError: validationError ? validationError.message : null,
      uncapturedErrors
    };
  } finally {
    device.destroy();
  }
}
