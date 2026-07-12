import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_SS_ACTUAL_GRID_BASE_URL || 'http://127.0.0.1:5320/';
const outputPath = process.env.ULG_SS_ACTUAL_GRID_OUTPUT
  || '/tmp/ulg-schroeder-sparse-grid-actual-nodes.json';

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
    const result = await page.evaluate(async () => {
      const nonce = Date.now();
      const module = await import(
        `/src/runtime/sph/schroederSparseHierarchyGpu.js?actualNodeProbe=${nonce}`
      );
      const limitsModule = await import(
        `/src/runtime/webgpuDeviceLimits.js?actualNodeProbe=${nonce}`
      );
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

      const seedWgsl = /* wgsl */ `
struct SeedParams {
  particle_count: u32,
  state_stride_vec4: u32,
  assignment_stride_floats: u32,
  reverse_order: u32,
  grid_spacing_m: f32,
  lattice_x: u32,
  lattice_y: u32,
  lattice_z: u32,
};

@group(0) @binding(0) var<storage, read_write> particle_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> level_assignments: array<f32>;
@group(0) @binding(2) var<uniform> params: SeedParams;

@compute @workgroup_size(64)
fn seed(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= params.particle_count) {
    return;
  }
  let source_index = select(index, params.particle_count - 1u - index, params.reverse_order != 0u);
  let lattice_volume = params.lattice_x * params.lattice_y * params.lattice_z;
  let slot = source_index % max(lattice_volume, 1u);
  let gx = slot % params.lattice_x;
  let yz = slot / params.lattice_x;
  let gy = yz % params.lattice_y;
  let gz = yz / params.lattice_y;
  let grid_position = vec3<f32>(
    f32(gx) + 4.17,
    f32(gy) + 4.31,
    f32(gz) + 4.43
  );
  particle_state[index * params.state_stride_vec4] = vec4<f32>(
    grid_position * params.grid_spacing_m,
    1.0
  );
  let assignment_base = index * params.assignment_stride_floats;
  level_assignments[assignment_base] = 0.0;
  level_assignments[assignment_base + 1u] = params.grid_spacing_m;
}
`;
      const checksumWgsl = /* wgsl */ `
struct ChecksumParams {
  reverse_mapping_word_offset: u32,
  node_capacity: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> sparse_view: array<u32>;
@group(0) @binding(1) var<storage, read_write> checksum: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: ChecksumParams;

@compute @workgroup_size(64)
fn checksum_nodes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  let active_count = sparse_view[1];
  if (index >= active_count || index >= params.node_capacity) {
    return;
  }
  let key = sparse_view[params.reverse_mapping_word_offset + index];
  atomicXor(&checksum[0], key);
  atomicAdd(&checksum[1], key);
  atomicAdd(&checksum[2], key * 1664525u + 1013904223u);
  atomicAdd(&checksum[3], 1u);
}
`;
      const seedModule = device.createShaderModule({
        label: 'ss-actual-node-probe-seed-shader',
        code: seedWgsl
      });
      const checksumModule = device.createShaderModule({
        label: 'ss-actual-node-probe-checksum-shader',
        code: checksumWgsl
      });
      const seedPipeline = device.createComputePipeline({
        label: 'ss-actual-node-probe-seed',
        layout: 'auto',
        compute: { module: seedModule, entryPoint: 'seed' }
      });
      const checksumPipeline = device.createComputePipeline({
        label: 'ss-actual-node-probe-checksum',
        layout: 'auto',
        compute: { module: checksumModule, entryPoint: 'checksum_nodes' }
      });

      const runCase = async ({
        name,
        generationId,
        particleCount,
        gridDims,
        latticeDims,
        arenaByteBudget,
        reverseOrder = false,
        unsupportedSources = false,
        mixedSources = false,
        reverseMixedSourceOrder = false,
        staleSourceIdentity = false
      }) => {
        device.pushErrorScope('validation');
        device.pushErrorScope('out-of-memory');
        device.pushErrorScope('internal');
        const gridSpacingM = 0.02;
        const plan = module.createSchroederSparseGridViewPlan({
          gridDims,
          gridShift: 1,
          gridSpacingM,
          selectedLevel: 0,
          chartId: 0,
          particleCapacity: particleCount,
          activeTileCapacity: 1,
          tileCellCount: 64,
          arenaByteBudget,
          maxBufferSize: device.limits.maxBufferSize,
          maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
          maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension
        });
        if (!plan.admitted) {
          const internalError = await device.popErrorScope();
          const outOfMemoryError = await device.popErrorScope();
          const validationError = await device.popErrorScope();
          return {
            name,
            status: 'fail',
            reason: 'host plan did not admit a positive node arena',
            plan,
            validationError: validationError?.message || null,
            outOfMemoryError: outOfMemoryError?.message || null,
            internalError: internalError?.message || null
          };
        }
        const stateBuffer = device.createBuffer({
          label: `ss-actual-node-${name}-state`,
          size: particleCount * plan.particleStateStrideVec4 * 16,
          usage: GPUBufferUsage.STORAGE
        });
        const assignmentBuffer = device.createBuffer({
          label: `ss-actual-node-${name}-assignments`,
          size: particleCount * plan.levelAssignmentStrideFloats * 4,
          usage: GPUBufferUsage.STORAGE
        });
        const mixedSourceBuffers = [];
        let mixedSourceDescriptors = {};
        let mixedExpectedKeys = [];
        if (mixedSources) {
          const sourceIdentity = {
            generation: generationId,
            positionEpoch: 37,
            leaseTokenLow: 0x13579bdf,
            leaseTokenHigh: 0x2468ace0,
            sourceCount: particleCount,
            consumerBit: 1 << 7
          };
          const expectedIdentity = { ...sourceIdentity };
          if (staleSourceIdentity) sourceIdentity.positionEpoch -= 1;
          const leaseIdentity = {
            schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
            authoritative: true,
            leaseId: 'native-mixed-source-lease',
            laneId: 'native-mixed-source-lane',
            stateKey: 'native-mixed-source-state',
            sourceFamily: 'sph-particle-state'
          };
          const productPositions = [
            [18.17, 6.31, 6.43],
            [19.17, 6.31, 6.43]
          ];
          const pressurePositions = [
            [23.17, 22.31, 22.43],
            [24.17, 22.31, 22.43]
          ];
          if (reverseMixedSourceOrder) {
            productPositions.reverse();
            pressurePositions.reverse();
          }
          const productRows = new Float32Array(2 * 32);
          productPositions.forEach((gridPosition, index) => {
            const base = index * 32;
            productRows.set(gridPosition.map((value) => value * gridSpacingM), base);
            productRows[base + 3] = 1;
            productRows[base + 13] = 1;
            productRows[base + 18] = 1;
          });
          const pressureRows = new Float32Array(2 * 16);
          pressurePositions.forEach((gridPosition, index) => {
            const base = index * 16;
            pressureRows.set(gridPosition.map((value) => value * gridSpacingM), base + 4);
            pressureRows[base + 15] = 1;
          });
          const productMetadata = new Uint32Array(16);
          productMetadata[0] = 0x554c4750;
          productMetadata[1] = 1;
          productMetadata[2] = 2;
          productMetadata[3] = 2;
          productMetadata[4] = 2;
          productMetadata[7] = generationId + 100;
          productMetadata[8] = 32;
          productMetadata[15] = 1;
          const pressureMetadata = new Uint32Array([2, 0, 2, 2]);
          const identityEvidence = new Uint32Array(40);
          identityEvidence[1] = expectedIdentity.generation;
          identityEvidence[2] = expectedIdentity.leaseTokenLow;
          identityEvidence[3] = expectedIdentity.leaseTokenHigh;
          identityEvidence[4] = expectedIdentity.positionEpoch;
          identityEvidence[5] = expectedIdentity.sourceCount;
          identityEvidence[21] = 2;
          identityEvidence[22] = expectedIdentity.consumerBit;
          identityEvidence[31] = 1;
          identityEvidence[33] = 0;
          const createUploadedStorage = (label, data, usage = GPUBufferUsage.STORAGE) => {
            const buffer = device.createBuffer({
              label,
              size: data.byteLength,
              usage: usage | GPUBufferUsage.COPY_DST
            });
            device.queue.writeBuffer(buffer, 0, data);
            mixedSourceBuffers.push(buffer);
            return buffer;
          };
          const productEventBuffer = createUploadedStorage(
            `ss-actual-node-${name}-product-events`,
            productRows
          );
          const productEventMetadataBuffer = createUploadedStorage(
            `ss-actual-node-${name}-product-metadata`,
            productMetadata
          );
          const productEventDispatchIndirectBuffer = createUploadedStorage(
            `ss-actual-node-${name}-product-dispatch`,
            new Uint32Array([1, 1, 1]),
            GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT
          );
          const forceRowsBuffer = createUploadedStorage(
            `ss-actual-node-${name}-pressure-rows`,
            pressureRows
          );
          const candidateMetadataBuffer = createUploadedStorage(
            `ss-actual-node-${name}-pressure-metadata`,
            pressureMetadata
          );
          const candidateDispatchIndirectBuffer = createUploadedStorage(
            `ss-actual-node-${name}-pressure-dispatch`,
            new Uint32Array([1, 1, 1]),
            GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT
          );
          const identityEvidenceBuffer = createUploadedStorage(
            `ss-actual-node-${name}-identity-evidence`,
            identityEvidence
          );
          mixedSourceDescriptors = {
            productEventSource: {
              productEventBuffer,
              productEventMetadataBuffer,
              productEventDispatchIndirectBuffer,
              productEventCapacity: 2,
              generationId: generationId + 100,
              identity: sourceIdentity,
              expectedIdentity,
              leaseIdentity,
              expectedLeaseIdentity: { ...leaseIdentity },
              identityEvidenceBuffer
            },
            pressureForceSource: {
              forceRowsBuffer,
              candidateMetadataBuffer,
              candidateDispatchIndirectBuffer,
              forceRowCapacity: 2,
              generationId,
              identity: sourceIdentity,
              expectedIdentity,
              leaseIdentity,
              expectedLeaseIdentity: { ...leaseIdentity },
              identityEvidenceBuffer
            }
          };
          const expected = new Set();
          const addStencil = (gridPosition) => {
            const base = gridPosition.map((value) => Math.floor(value - 0.5));
            for (let ox = 0; ox < 3; ox += 1) {
              for (let oy = 0; oy < 3; oy += 1) {
                for (let oz = 0; oz < 3; oz += 1) {
                  const x = base[0] + ox + 1;
                  const y = base[1] + oy + 1;
                  const z = base[2] + oz + 1;
                  if (x >= 0 && y >= 0 && z >= 0
                    && x < gridDims[0] && y < gridDims[1] && z < gridDims[2]) {
                    expected.add((x * gridDims[1] + y) * gridDims[2] + z);
                  }
                }
              }
            }
          };
          for (let index = 0; index < particleCount; index += 1) {
            const latticeVolume = latticeDims[0] * latticeDims[1] * latticeDims[2];
            const slot = index % Math.max(latticeVolume, 1);
            const gx = slot % latticeDims[0];
            const yz = Math.floor(slot / latticeDims[0]);
            const gy = yz % latticeDims[1];
            const gz = Math.floor(yz / latticeDims[1]);
            addStencil([gx + 4.17, gy + 4.31, gz + 4.43]);
          }
          productPositions.forEach(addStencil);
          pressurePositions.forEach(addStencil);
          mixedExpectedKeys = [...expected].sort((left, right) => left - right);
        }
        const seedParamsBuffer = device.createBuffer({
          label: `ss-actual-node-${name}-seed-params`,
          size: 32,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const seedParams = new ArrayBuffer(32);
        const seedView = new DataView(seedParams);
        seedView.setUint32(0, particleCount, true);
        seedView.setUint32(4, plan.particleStateStrideVec4, true);
        seedView.setUint32(8, plan.levelAssignmentStrideFloats, true);
        seedView.setUint32(12, reverseOrder ? 1 : 0, true);
        seedView.setFloat32(16, gridSpacingM, true);
        seedView.setUint32(20, latticeDims[0], true);
        seedView.setUint32(24, latticeDims[1], true);
        seedView.setUint32(28, latticeDims[2], true);
        device.queue.writeBuffer(seedParamsBuffer, 0, seedParams);
        const hierarchyEvidence = new Uint32Array(16);
        hierarchyEvidence[0] = generationId;
        hierarchyEvidence[5] = 1;
        hierarchyEvidence[6] = 1;
        const hierarchyEvidenceBuffer = device.createBuffer({
          label: `ss-actual-node-${name}-hierarchy-evidence`,
          size: hierarchyEvidence.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(hierarchyEvidenceBuffer, 0, hierarchyEvidence);
        const hierarchy = {
          schema: module.ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
          generationId,
          evidenceBuffer: hierarchyEvidenceBuffer
        };
        const runtime = module.createSchroederSparseGridViewGpu(device, {
          hierarchy,
          plan,
          label: `ss-actual-node-${name}`
        });
        const checksumBuffer = device.createBuffer({
          label: `ss-actual-node-${name}-checksum`,
          size: 16,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        const checksumParamsBuffer = device.createBuffer({
          label: `ss-actual-node-${name}-checksum-params`,
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(
          checksumParamsBuffer,
          0,
          new Uint32Array([
            plan.reverseMappingWordOffset,
            plan.gridNodeCapacity,
            0,
            0
          ])
        );
        const readbackBuffer = device.createBuffer({
          label: `ss-actual-node-${name}-fixed-evidence-readback`,
          size: mixedSources ? 128 + plan.gridNodeCapacity * 4 : 256,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder({
          label: `ss-actual-node-${name}-encoder`
        });
        let pass = encoder.beginComputePass({ label: `ss-actual-node-${name}-seed-pass` });
        pass.setPipeline(seedPipeline);
        pass.setBindGroup(0, device.createBindGroup({
          label: `ss-actual-node-${name}-seed-bind-group`,
          layout: seedPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: stateBuffer } },
            { binding: 1, resource: { buffer: assignmentBuffer } },
            { binding: 2, resource: { buffer: seedParamsBuffer } }
          ]
        }));
        pass.dispatchWorkgroups(Math.ceil(particleCount / 64));
        pass.end();
        const execution = runtime.encode(encoder, {
          generationId,
          particleStateBuffer: stateBuffer,
          particleLevelAssignmentBuffer: assignmentBuffer,
          ...(mixedSources
            ? mixedSourceDescriptors
            : unsupportedSources
            ? {
                productEventSource: { buffer: stateBuffer },
                pressureForceSource: { buffer: assignmentBuffer }
              }
            : {})
        });
        encoder.clearBuffer(checksumBuffer);
        pass = encoder.beginComputePass({ label: `ss-actual-node-${name}-checksum-pass` });
        pass.setPipeline(checksumPipeline);
        pass.setBindGroup(0, device.createBindGroup({
          label: `ss-actual-node-${name}-checksum-bind-group`,
          layout: checksumPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: execution.viewBuffer } },
            { binding: 1, resource: { buffer: checksumBuffer } },
            { binding: 2, resource: { buffer: checksumParamsBuffer } }
          ]
        }));
        pass.dispatchWorkgroups(Math.ceil(plan.gridNodeCapacity / 64));
        pass.end();
        encoder.copyBufferToBuffer(execution.viewBuffer, 0, readbackBuffer, 0, 64);
        encoder.copyBufferToBuffer(execution.dispatchIndirectBuffer, 0, readbackBuffer, 64, 36);
        encoder.copyBufferToBuffer(checksumBuffer, 0, readbackBuffer, 112, 16);
        encoder.copyBufferToBuffer(
          execution.viewBuffer,
          plan.reverseMappingWordOffset * 4,
          readbackBuffer,
          128,
          mixedSources ? plan.gridNodeCapacity * 4 : 64
        );
        const submittedAt = performance.now();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const queueFenceMs = performance.now() - submittedAt;
        const internalError = await device.popErrorScope();
        const outOfMemoryError = await device.popErrorScope();
        const validationError = await device.popErrorScope();
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const evidence = new Uint32Array(readbackBuffer.getMappedRange()).slice();
        readbackBuffer.unmap();
        const header = Array.from(evidence.slice(0, 16));
        const dispatch = Array.from(evidence.slice(16, 25));
        const checksum = Array.from(evidence.slice(28, 32));
        const keySample = Array.from(evidence.slice(32, 48));
        const actualKeys = mixedSources
          ? Array.from(evidence.slice(32, 32 + header[1]))
          : [];
        const mixedSourcesPresent = mixedSources && header[3] === 1
          ? mixedExpectedKeys.every((key) => actualKeys.includes(key))
            && actualKeys.length === mixedExpectedKeys.length
          : false;
        execution.releaseTransientBuffers();
        runtime.destroy();
        for (const buffer of [
          stateBuffer,
          assignmentBuffer,
          seedParamsBuffer,
          hierarchyEvidenceBuffer,
          checksumBuffer,
          checksumParamsBuffer,
          readbackBuffer,
          ...mixedSourceBuffers
        ]) {
          buffer.destroy();
        }
        return {
          name,
          status: validationError == null && outOfMemoryError == null && internalError == null
            ? 'executed'
            : 'gpu-error',
          queueFenceMs,
          particleCount,
          gridNodeCapacity: plan.gridNodeCapacity,
          peakAllocatedByteLength: plan.peakAllocatedByteLength,
          arenaByteBudget: plan.arenaByteBudget,
          header,
          dispatch,
          checksum,
          keySample,
          mixedExpectedNodeCount: mixedExpectedKeys.length,
          mixedActualNodeCount: actualKeys.length,
          mixedSourcesPresent,
          mixedSourceStatus: execution.sourceIntegrationAdmission,
          productEventSourceStatus: execution.reactionProductEventSourceStatus,
          pressureForceSourceStatus: execution.pressureForceSourceStatus,
          unsupportedSourceFamilyMask: execution.unsupportedSourceFamilyMask,
          validationError: validationError?.message || null,
          outOfMemoryError: outOfMemoryError?.message || null,
          internalError: internalError?.message || null
        };
      };

      const forward = await runCase({
        name: 'manufactured-forward',
        generationId: 71,
        particleCount: 64,
        gridDims: [32, 32, 32],
        latticeDims: [4, 4, 2],
        arenaByteBudget: 1 << 20
      });
      const reverse = await runCase({
        name: 'manufactured-reverse',
        generationId: 72,
        particleCount: 64,
        gridDims: [32, 32, 32],
        latticeDims: [4, 4, 2],
        arenaByteBudget: 1 << 20,
        reverseOrder: true
      });
      const scale = await runCase({
        name: 'manufactured-300k',
        generationId: 73,
        particleCount: 300_000,
        gridDims: [256, 256, 256],
        latticeDims: [48, 48, 24],
        arenaByteBudget: 64 * 1024 * 1024
      });
      const overflow = await runCase({
        name: 'manufactured-overflow',
        generationId: 74,
        particleCount: 4096,
        gridDims: [64, 64, 64],
        latticeDims: [16, 16, 16],
        arenaByteBudget: 256 * 1024
      });
      const unsupported = await runCase({
        name: 'unsupported-product-pressure',
        generationId: 75,
        particleCount: 64,
        gridDims: [32, 32, 32],
        latticeDims: [4, 4, 2],
        arenaByteBudget: 1 << 20,
        unsupportedSources: true
      });
      const mixedA = await runCase({
        name: 'mixed-product-pressure-a',
        generationId: 76,
        particleCount: 64,
        gridDims: [32, 32, 32],
        latticeDims: [4, 4, 2],
        arenaByteBudget: 1 << 20,
        mixedSources: true
      });
      const mixedB = await runCase({
        name: 'mixed-product-pressure-b',
        generationId: 77,
        particleCount: 64,
        gridDims: [32, 32, 32],
        latticeDims: [4, 4, 2],
        arenaByteBudget: 1 << 20,
        mixedSources: true,
        reverseOrder: true,
        reverseMixedSourceOrder: true
      });
      const staleMixed = await runCase({
        name: 'mixed-product-pressure-stale-identity',
        generationId: 78,
        particleCount: 64,
        gridDims: [32, 32, 32],
        latticeDims: [4, 4, 2],
        arenaByteBudget: 1 << 20,
        mixedSources: true,
        staleSourceIdentity: true
      });
      const cases = [
        forward,
        reverse,
        scale,
        overflow,
        unsupported,
        mixedA,
        mixedB,
        staleMixed
      ];
      const gpuClean = cases.every((entry) => (
        entry.status === 'executed'
          && entry.validationError == null
          && entry.outOfMemoryError == null
          && entry.internalError == null
      ));
      const metamorphicPass = forward.header?.[3] === 1
        && reverse.header?.[3] === 1
        && forward.header[4] === 0
        && reverse.header[4] === 0
        && forward.header[1] === reverse.header[1]
        && JSON.stringify(forward.checksum) === JSON.stringify(reverse.checksum)
        && JSON.stringify(forward.keySample) === JSON.stringify(reverse.keySample);
      const scalePass = scale.particleCount === 300_000
        && scale.gridNodeCapacity > 300_000
        && scale.peakAllocatedByteLength <= scale.arenaByteBudget
        && scale.header?.[3] === 1
        && scale.header[4] === 0
        && scale.header[1] > 0
        && scale.header[1] === scale.header[2]
        && scale.checksum?.[3] === scale.header[1]
        && scale.dispatch?.[0] > 0;
      const overflowPass = overflow.header?.[3] === 0
        && overflow.header[4] !== 0
        && overflow.header[1] === 0
        && overflow.dispatch?.[0] === 0;
      const unsupportedPass = unsupported.unsupportedSourceFamilyMask === 0
        && unsupported.header?.[3] === 0
        && (unsupported.header[4]
          & module.SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY) !== 0
        && unsupported.header[1] === 0
        && unsupported.dispatch?.[0] === 0;
      const mixedSourcesPass = mixedA.mixedSourcesPresent === true
        && mixedB.mixedSourcesPresent === true
        && mixedA.header?.[3] === 1
        && mixedB.header?.[3] === 1
        && mixedA.header[4] === 0
        && mixedB.header[4] === 0
        && mixedA.header[1] === mixedB.header[1]
        && JSON.stringify(mixedA.checksum) === JSON.stringify(mixedB.checksum)
        && mixedA.mixedSourceStatus === 'mixed-source-family-gpu-admission-encoded'
        && mixedB.mixedSourceStatus === 'mixed-source-family-gpu-admission-encoded';
      const staleMixedPass = staleMixed.header?.[3] === 0
        && (staleMixed.header[4]
          & module.SCHROEDER_SPARSE_GRID_VIEW_OVERFLOW_SOURCE_IDENTITY) !== 0
        && staleMixed.header[1] === 0
        && staleMixed.dispatch?.[0] === 0
        && String(staleMixed.productEventSourceStatus).includes('fail-closed')
        && String(staleMixed.pressureForceSourceStatus).includes('fail-closed');
      return {
        status: gpuClean && metamorphicPass && scalePass && overflowPass && unsupportedPass
          && mixedSourcesPass && staleMixedPass
          && uncapturedErrors.length === 0
          ? 'pass'
          : 'fail',
        gpuClean,
        metamorphicPass,
        scalePass,
        overflowPass,
        unsupportedPass,
        mixedSourcesPass,
        staleMixedPass,
        adapter: {
          maxBufferSize: Number(adapter.limits.maxBufferSize),
          maxStorageBufferBindingSize: Number(adapter.limits.maxStorageBufferBindingSize),
          maxComputeWorkgroupsPerDimension: Number(
            adapter.limits.maxComputeWorkgroupsPerDimension
          )
        },
        cases,
        uncapturedErrors
      };
    });
    const artifact = {
      schema: 'peercompute.ulg.schroeder-sparse-grid-actual-node-probe.v1',
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
