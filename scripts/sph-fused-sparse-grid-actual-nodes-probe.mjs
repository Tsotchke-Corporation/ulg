import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_FUSED_SS_GRID_BASE_URL || 'http://127.0.0.1:5320/';
const overflowMode = process.env.ULG_FUSED_SS_GRID_OVERFLOW === '1';
const outputPath = process.env.ULG_FUSED_SS_GRID_OUTPUT
  || (overflowMode
    ? '/tmp/ulg-sph-fused-sparse-grid-overflow.json'
    : '/tmp/ulg-sph-fused-sparse-grid-actual-nodes.json');

function chromiumArgs() {
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu'
  ];
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async ({ overflowMode }) => {
      const nonce = Date.now();
      const mechanicsModule = await import(
        `/src/runtime/sph/sphMlsMpmGpuStep.js?fusedActualNodeProbe=${nonce}`
      );
      const limitsModule = await import(
        `/src/runtime/webgpuDeviceLimits.js?fusedActualNodeProbe=${nonce}`
      );
      const abi = await import(`/ulg-gpu-abi/src/index.js?fusedActualNodeProbe=${nonce}`);
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      }
      const device = await adapter.requestDevice(
        limitsModule.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      const particleCapacity = 300_000;
      const generationId = 91;
      const gridSpacingM = 0.02;
      const stateStrideFloats = 8;
      const thermoStrideFloats = 12;
      const mechanicsStrideFloats = 32;
      const assignmentStrideFloats = 16;
      const sourceBuffers = {
        state: device.createBuffer({
          label: 'fused-actual-node-source-state',
          size: particleCapacity * stateStrideFloats * 4,
          usage: GPUBufferUsage.STORAGE
        }),
        thermo: device.createBuffer({
          label: 'fused-actual-node-source-thermo',
          size: particleCapacity * thermoStrideFloats * 4,
          usage: GPUBufferUsage.STORAGE
        }),
        mechanics: device.createBuffer({
          label: 'fused-actual-node-source-mechanics',
          size: particleCapacity * mechanicsStrideFloats * 4,
          usage: GPUBufferUsage.STORAGE
        }),
        assignments: device.createBuffer({
          label: 'fused-actual-node-source-assignments',
          size: particleCapacity * assignmentStrideFloats * 4,
          usage: GPUBufferUsage.STORAGE
        })
      };
      const seedParamsBuffer = device.createBuffer({
        label: 'fused-actual-node-seed-params',
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(seedParamsBuffer, 0, new Uint32Array([
        particleCapacity,
        48,
        48,
        24
      ]));
      const seedModule = device.createShaderModule({
        label: 'fused-actual-node-seed-shader',
        code: /* wgsl */ `
struct SeedParams {
  particle_count: u32,
  lattice_x: u32,
  lattice_y: u32,
  lattice_z: u32,
};
@group(0) @binding(0) var<storage, read_write> state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> assignments: array<f32>;
@group(0) @binding(4) var<uniform> params: SeedParams;

@compute @workgroup_size(64)
fn seed(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= params.particle_count) { return; }
  let lattice_volume = params.lattice_x * params.lattice_y * params.lattice_z;
  let slot = index % lattice_volume;
  let gx = slot % params.lattice_x;
  let yz = slot / params.lattice_x;
  let gy = yz % params.lattice_y;
  let gz = yz / params.lattice_y;
  let position = vec3<f32>(f32(gx) + 4.17, f32(gy) + 4.31, f32(gz) + 4.43)
    * ${gridSpacingM};
  state[index * 2u] = vec4<f32>(position, 1.0e-6);
  state[index * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 300.0);
  thermo[index * 3u] = vec4<f32>(300.0, 1000.0, 0.0, 1000.0);
  thermo[index * 3u + 1u] = vec4<f32>(0.0);
  thermo[index * 3u + 2u] = vec4<f32>(0.0, 0.0, 1.0, 0.0);
  let mechanics_base = index * 8u;
  mechanics[mechanics_base] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  mechanics[mechanics_base + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  mechanics[mechanics_base + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  mechanics[mechanics_base + 3u] = vec4<f32>(0.0);
  mechanics[mechanics_base + 4u] = vec4<f32>(0.0, 0.0, 1.0, 1.0e-9);
  mechanics[mechanics_base + 5u] = vec4<f32>(0.0);
  mechanics[mechanics_base + 6u] = vec4<f32>(0.0);
  mechanics[mechanics_base + 7u] = vec4<f32>(0.0);
  let assignment_base = index * 16u;
  assignments[assignment_base] = 0.0;
  assignments[assignment_base + 1u] = ${gridSpacingM};
}
`
      });
      const seedPipeline = device.createComputePipeline({
        label: 'fused-actual-node-seed',
        layout: 'auto',
        compute: { module: seedModule, entryPoint: 'seed' }
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('out-of-memory');
      device.pushErrorScope('internal');
      const seedEncoder = device.createCommandEncoder({ label: 'fused-actual-node-seed-encoder' });
      const seedPass = seedEncoder.beginComputePass();
      seedPass.setPipeline(seedPipeline);
      seedPass.setBindGroup(0, device.createBindGroup({
        layout: seedPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: sourceBuffers.state } },
          { binding: 1, resource: { buffer: sourceBuffers.thermo } },
          { binding: 2, resource: { buffer: sourceBuffers.mechanics } },
          { binding: 3, resource: { buffer: sourceBuffers.assignments } },
          { binding: 4, resource: { buffer: seedParamsBuffer } }
        ]
      }));
      seedPass.dispatchWorkgroups(Math.ceil(particleCapacity / 64));
      seedPass.end();
      device.queue.submit([seedEncoder.finish()]);
      await device.queue.onSubmittedWorkDone();

      const countMetadata = new Uint32Array(16);
      countMetadata[0] = 0x53535052;
      countMetadata[1] = 1;
      countMetadata[2] = 1;
      countMetadata[3] = 2;
      countMetadata[4] = particleCapacity;
      countMetadata[6] = particleCapacity;
      countMetadata[9] = 0;
      countMetadata[10] = generationId;
      const countMetadataBuffer = device.createBuffer({
        label: 'fused-actual-node-count-metadata',
        size: countMetadata.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const countDispatchBuffer = device.createBuffer({
        label: 'fused-actual-node-count-dispatch',
        size: 24,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(countMetadataBuffer, 0, countMetadata);
      device.queue.writeBuffer(countDispatchBuffer, 0, new Uint32Array([
        Math.ceil(particleCapacity / 64), 1, 1,
        Math.ceil(particleCapacity / 64), 1, 1
      ]));
      const hierarchyEvidence = new Uint32Array(16);
      hierarchyEvidence[0] = generationId;
      hierarchyEvidence[5] = 1;
      hierarchyEvidence[6] = 1;
      const hierarchyEvidenceBuffer = device.createBuffer({
        label: 'fused-actual-node-hierarchy-evidence',
        size: hierarchyEvidence.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(hierarchyEvidenceBuffer, 0, hierarchyEvidence);
      const residencyFields = {
        particleCount: particleCapacity,
        particleCapacity,
        authoritativeParticleCount: null,
        particleCountAuthority: 'gpu-authored-residency-metadata',
        particleCountCpuDecoded: false,
        particleCountMetadataWord: 4,
        particleCountResidencyGenerationId: generationId,
        particleCountResidencyMetadataBuffer: countMetadataBuffer,
        particleCountDispatchIndirectBuffer: countDispatchBuffer,
        particleCountDispatchIndirectByteOffset: 0,
        particleCountSelectionIndirectByteOffset: 12,
        particleCountResidencyStatus: 'gpu-authored-particle-count-residency-ready',
        normalHotLoopReadbackFree: true
      };
      const cpuState = new Float32Array(8);
      cpuState.set([0.2, 0.2, 0.2, 1e-6], 0);
      const cpuThermo = new Float32Array(12);
      cpuThermo[3] = 1000;
      const cpuMechanics = new Float32Array(32);
      cpuMechanics[0] = 1;
      cpuMechanics[4] = 1;
      cpuMechanics[8] = 1;
      cpuMechanics[18] = 1;
      cpuMechanics[19] = 1e-9;
      const hotStateBuffersCopyDstEnabled = Object.values(sourceBuffers).some((buffer) => (
        (buffer.usage & GPUBufferUsage.COPY_DST) !== 0
      ));
      const submittedAt = performance.now();
      const execution = await mechanicsModule.runMlsMpmResidentStepsWithOptionalWebGpu({
        sphParticleState: {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: 1,
          smoothingLengthM: gridSpacingM,
          step: 0,
          time: 0,
          state: cpuState,
          thermo: cpuThermo
        },
        mlsMpmParticleState: {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: 1,
          step: 0,
          time: 0,
          mechanicsDtS: 0,
          particleSeparationRelaxation: 0,
          gridCflFactor: 1,
          gravityMPerS2: [0, 0, 0],
          mechanics: cpuMechanics
        },
        sphParticleUpload: {
          status: 'webgpu-uploaded',
          stateBuffer: sourceBuffers.state,
          thermoBuffer: sourceBuffers.thermo,
          slot: 0,
          ...residencyFields
        },
        mlsMpmParticleUpload: {
          status: 'webgpu-uploaded',
          mechanicsBuffer: sourceBuffers.mechanics,
          slot: 0,
          ...residencyFields
        },
        schroederLevelAssignment: {
          schema: abi.ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
          status: 'schroeder-level-assignment-submitted',
          particleCount: particleCapacity,
          assignmentStrideFloats,
          assignmentBuffer: sourceBuffers.assignments,
          assignmentBufferByteLength: sourceBuffers.assignments.size,
          retainedAssignmentBuffer: true
        },
        schroederSelectedLevel: 0,
        schroederSparseHierarchy: {
          schema: abi.ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
          status: 'schroeder-sparse-two-level-hierarchy-submitted',
          generationId,
          evidenceBuffer: hierarchyEvidenceBuffer,
          routeCapacity: 1,
          maxUniqueNodeCount: 1
        },
        schroederSparseGridArenaByteBudget: overflowMode
          ? 256 * 1024
          : 64 * 1024 * 1024,
        stepCount: 2,
        preferWebGpu: true,
        device,
        gridSpacingM,
        boxDimsM: [5.02, 5.02, 5.02],
        readbackMode: 'no-full-readback',
        compactSummaryMode: 'none',
        fuseNoFullResidentMechanicsSequence: true
      });
      await device.queue.onSubmittedWorkDone();
      const queueFenceMs = performance.now() - submittedAt;
      const sparseGrid = execution.fusedResidentSequence.schroederSparseGrid;
      const evidenceReadback = device.createBuffer({
        label: 'fused-actual-node-fixed-evidence-readback',
        size: 128,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const evidenceEncoder = device.createCommandEncoder();
      evidenceEncoder.copyBufferToBuffer(sparseGrid.viewBuffer, 0, evidenceReadback, 0, 64);
      evidenceEncoder.copyBufferToBuffer(
        sparseGrid.dispatchIndirectBuffer,
        0,
        evidenceReadback,
        64,
        36
      );
      device.queue.submit([evidenceEncoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      const internalError = await device.popErrorScope();
      const outOfMemoryError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      await evidenceReadback.mapAsync(GPUMapMode.READ);
      const evidence = new Uint32Array(evidenceReadback.getMappedRange()).slice();
      evidenceReadback.unmap();
      const header = Array.from(evidence.slice(0, 16));
      const dispatch = Array.from(evidence.slice(16, 25));
      const telemetry = execution.fusedResidentSequence;
      const gpuOutcomePass = overflowMode
        ? header[1] === 0
          && header[2] > 0
          && header[3] === 0
          && header[4] !== 0
          && dispatch[0] === 0
        : header[1] > 0
          && header[1] < header[5]
          && header[1] === header[2]
          && header[3] === 1
          && header[4] === 0
          && dispatch[0] > 0;
      const pass = validationError == null
        && outOfMemoryError == null
        && internalError == null
        && uncapturedErrors.length === 0
        && telemetry.schroederSparseGridParticleCapacity === particleCapacity
        && telemetry.schroederSparseGridDeclaredBuildInvocationCapacity === particleCapacity
        && telemetry.schroederSparseGridExecutionCount === 2
        && telemetry.schroederSparseGridCapacityLessThanDense === true
        && telemetry.schroederSparseGridActualNodeCountCpuDecoded === false
        && telemetry.schroederSparseGridNormalHotLoopReadbackFree === true
        && telemetry.schroederSparseGridHostSourceFailClosed === false
        && gpuOutcomePass
        && hotStateBuffersCopyDstEnabled === false;
      mechanicsModule.destroyMlsMpmResidentStepsBuffers(execution);
      for (const buffer of [
        ...Object.values(sourceBuffers),
        seedParamsBuffer,
        countMetadataBuffer,
        countDispatchBuffer,
        hierarchyEvidenceBuffer,
        evidenceReadback
      ]) {
        buffer.destroy();
      }
      return {
        status: pass ? 'pass' : 'fail',
        mode: overflowMode ? 'forced-overflow' : 'admitted-actual-nodes',
        queueFenceMs,
        header,
        dispatch,
        telemetry: {
          status: telemetry.status,
          particleCapacity: telemetry.schroederSparseGridParticleCapacity,
          declaredBuildInvocationCapacity:
            telemetry.schroederSparseGridDeclaredBuildInvocationCapacity,
          gridNodeCapacity: telemetry.schroederSparseGridNodeCapacity,
          fullGridNodeCount: telemetry.schroederSparseGridFullGridNodeCount,
          capacityLessThanDense: telemetry.schroederSparseGridCapacityLessThanDense,
          executionCount: telemetry.schroederSparseGridExecutionCount,
          actualNodeCountAuthority: telemetry.schroederSparseGridActualNodeCountAuthority,
          actualNodeCountCpuDecoded: telemetry.schroederSparseGridActualNodeCountCpuDecoded,
          gridSpacingM: telemetry.schroederSparseGridGridSpacingM,
          gridSpacingAuthority: telemetry.schroederSparseGridGridSpacingAuthority,
          sourceAdmissionStatus: telemetry.schroederSparseGridSourceAdmissionStatus,
          normalHotLoopReadbackFree:
            telemetry.schroederSparseGridNormalHotLoopReadbackFree
        },
        hotStateBuffersCopyDstEnabled,
        validationError: validationError?.message || null,
        outOfMemoryError: outOfMemoryError?.message || null,
        internalError: internalError?.message || null,
        uncapturedErrors
      };
    }, { overflowMode });
    const artifact = {
      schema: 'peercompute.ulg.sph-fused-sparse-grid-actual-node-probe.v1',
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl,
      ...result
    };
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(artifact, null, 2));
    if (artifact.status !== 'pass') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
