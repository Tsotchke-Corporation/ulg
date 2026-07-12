import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_FUSED_SS_MIXED_BASE_URL || 'http://127.0.0.1:5320/';
const outputPath = process.env.ULG_FUSED_SS_MIXED_OUTPUT
  || '/tmp/ulg-sph-fused-sparse-grid-mixed-sources.json';

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
      const mechanics = await import(
        `/src/runtime/sph/sphMlsMpmGpuStep.js?fusedMixedSourceProbe=${nonce}`
      );
      const limits = await import(
        `/src/runtime/webgpuDeviceLimits.js?fusedMixedSourceProbe=${nonce}`
      );
      const abi = await import(`/ulg-gpu-abi/src/index.js?fusedMixedSourceProbe=${nonce}`);
      const render = await import(
        `/src/runtime/sph/sphRenderGpuKernel.js?fusedMixedSourceProbe=${nonce}`
      );
      const arenaModule = await import(
        `/src/runtime/sph/residentProductEventArenaGpu.js?fusedMixedSourceProbe=${nonce}`
      );
      const identityModule = await import(
        `/src/runtime/sph/sphGpuDeviceIdentity.js?fusedMixedSourceProbe=${nonce}`
      );
      const neighborhood = await import(
        `/src/runtime/sph/residentNeighborhoodGpu.js?fusedMixedSourceProbe=${nonce}`
      );
      const consumer = await import(
        `/src/runtime/sph/residentNeighborhoodConsumer.js?fusedMixedSourceProbe=${nonce}`
      );
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      }
      const device = await adapter.requestDevice(
        limits.webGpuDeviceDescriptorForResidentSph(adapter)
      );
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('out-of-memory');
      device.pushErrorScope('internal');

      const particleCapacity = 64;
      const hierarchyGeneration = 91;
      const productGeneration = 109;
      const gridSpacingM = 0.25;
      const laneIdentity = {
        schema: 'peercompute.compute.gpu-resident-lane-lease-identity.v0',
        authoritative: true,
        leaseId: 'native-fused-mixed-source-lease',
        laneId: 'native-fused-mixed-source-lane',
        stateKey: 'native/fused-mixed-source-state',
        sourceFamily: 'sph-particle-state',
        taskId: 'native-fused-mixed-source-probe'
      };
      const token = neighborhood.createResidentNeighborhoodAuthorityToken(laneIdentity);
      const sourceIdentity = {
        generation: 0,
        positionEpoch: 0,
        leaseTokenLow: token.low,
        leaseTokenHigh: token.high,
        sourceCount: particleCapacity,
        consumerBit: consumer.residentNeighborhoodConsumerBit('ssUniqueNodeCompaction')
      };
      const sourceBuffers = {
        state: device.createBuffer({
          label: 'fused-mixed-source-state',
          size: particleCapacity * 8 * 4,
          usage: GPUBufferUsage.STORAGE
        }),
        thermo: device.createBuffer({
          label: 'fused-mixed-source-thermo',
          size: particleCapacity * 12 * 4,
          usage: GPUBufferUsage.STORAGE
        }),
        mechanics: device.createBuffer({
          label: 'fused-mixed-source-mechanics',
          size: particleCapacity * 32 * 4,
          usage: GPUBufferUsage.STORAGE
        }),
        assignments: device.createBuffer({
          label: 'fused-mixed-source-assignments',
          size: particleCapacity * 16 * 4,
          usage: GPUBufferUsage.STORAGE
        })
      };
      const seedParams = device.createBuffer({
        label: 'fused-mixed-source-seed-params',
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(seedParams, 0, new Uint32Array([particleCapacity, 4, 4, 4]));
      const seedModule = device.createShaderModule({
        label: 'fused-mixed-source-seed-shader',
        code: /* wgsl */ `
struct Params { count: u32, nx: u32, ny: u32, nz: u32 };
@group(0) @binding(0) var<storage, read_write> state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> assignments: array<f32>;
@group(0) @binding(4) var<uniform> params: Params;

@compute @workgroup_size(64)
fn seed(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let x = i % params.nx;
  let yz = i / params.nx;
  let y = yz % params.ny;
  let z = yz / params.ny;
  let p = vec3<f32>(0.65, 0.65, 0.65) + vec3<f32>(f32(x), f32(y), f32(z)) * 0.42;
  state[i * 2u] = vec4<f32>(p, 0.001);
  state[i * 2u + 1u] = vec4<f32>(0.0, 0.0, 0.0, 300.0);
  thermo[i * 3u] = vec4<f32>(1.0, 2.0, 300.0, 1000.0);
  thermo[i * 3u + 1u] = vec4<f32>(0.0, 1.0, 0.0, 0.0);
  thermo[i * 3u + 2u] = vec4<f32>(${gridSpacingM}, 1.0, 1.0, 0.08);
  let m = i * 8u;
  mechanics[m] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  mechanics[m + 1u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  mechanics[m + 2u] = vec4<f32>(1.0, 0.0, 0.0, 0.0);
  mechanics[m + 3u] = vec4<f32>(0.0);
  mechanics[m + 4u] = vec4<f32>(0.0, 0.0, 1.0, 0.000001);
  mechanics[m + 5u] = vec4<f32>(0.0);
  mechanics[m + 6u] = vec4<f32>(0.0);
  mechanics[m + 7u] = vec4<f32>(0.0);
  assignments[i * 16u] = 0.0;
  assignments[i * 16u + 1u] = ${gridSpacingM};
}
`
      });
      const seedPipeline = device.createComputePipeline({
        label: 'fused-mixed-source-seed',
        layout: 'auto',
        compute: { module: seedModule, entryPoint: 'seed' }
      });
      const seedEncoder = device.createCommandEncoder();
      const seedPass = seedEncoder.beginComputePass();
      seedPass.setPipeline(seedPipeline);
      seedPass.setBindGroup(0, device.createBindGroup({
        layout: seedPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: sourceBuffers.state } },
          { binding: 1, resource: { buffer: sourceBuffers.thermo } },
          { binding: 2, resource: { buffer: sourceBuffers.mechanics } },
          { binding: 3, resource: { buffer: sourceBuffers.assignments } },
          { binding: 4, resource: { buffer: seedParams } }
        ]
      }));
      seedPass.dispatchWorkgroups(1);
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
      countMetadata[10] = hierarchyGeneration;
      const countMetadataBuffer = device.createBuffer({
        label: 'fused-mixed-source-count-metadata',
        size: 64,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const countDispatchBuffer = device.createBuffer({
        label: 'fused-mixed-source-count-dispatch',
        size: 24,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(countMetadataBuffer, 0, countMetadata);
      device.queue.writeBuffer(countDispatchBuffer, 0, new Uint32Array([1, 1, 1, 1, 1, 1]));
      const residencyFields = {
        particleCount: particleCapacity,
        particleCapacity,
        authoritativeParticleCount: null,
        particleCountAuthority: 'gpu-authored-residency-metadata',
        particleCountCpuDecoded: false,
        particleCountMetadataWord: 4,
        particleCountResidencyGenerationId: hierarchyGeneration,
        particleCountResidencyMetadataBuffer: countMetadataBuffer,
        particleCountDispatchIndirectBuffer: countDispatchBuffer,
        particleCountDispatchIndirectByteOffset: 0,
        particleCountSelectionIndirectByteOffset: 12,
        particleCountResidencyStatus: 'gpu-authored-particle-count-residency-ready',
        normalHotLoopReadbackFree: true
      };
      const hierarchyEvidence = new Uint32Array(16);
      hierarchyEvidence[0] = hierarchyGeneration;
      hierarchyEvidence[5] = 1;
      hierarchyEvidence[6] = 1;
      const hierarchyEvidenceBuffer = device.createBuffer({
        label: 'fused-mixed-source-hierarchy-evidence',
        size: 64,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(hierarchyEvidenceBuffer, 0, hierarchyEvidence);

      const arena = arenaModule.createResidentProductEventArenaGpu(device, {
        strideFloats: 32,
        capacityRows: 2,
        sourceCapacityRows: 2,
        maxCapacityRows: 2,
        generationId: productGeneration,
        label: 'fused-mixed-source-product-arena'
      });
      const productRows = new Float32Array(2 * 32);
      for (let i = 0; i < 2; i += 1) {
        const base = i * 32;
        productRows.set(i === 0 ? [0.35, 0.4, 0.45] : [2.45, 2.5, 2.55], base);
        productRows[base + 3] = 0.01;
        productRows[base + 4] = 1;
        productRows[base + 9] = 1;
        productRows[base + 11] = 2;
        productRows[base + 13] = 0.01;
        productRows[base + 14] = 1;
        productRows[base + 15] = 0.01;
        productRows[base + 16] = 300;
        productRows[base + 18] = 1;
      }
      const productMetadata = new Uint32Array(16);
      productMetadata[0] = 0x554c4750;
      productMetadata[1] = 1;
      productMetadata[2] = 2;
      productMetadata[3] = 2;
      productMetadata[4] = 2;
      productMetadata[7] = productGeneration;
      productMetadata[8] = 32;
      productMetadata[15] = 1;
      device.queue.writeBuffer(arena.buffer, 0, productRows);
      device.queue.writeBuffer(arena.metadataBuffer, 0, productMetadata);
      device.queue.writeBuffer(arena.dispatchIndirectBuffer, 0, new Uint32Array([1, 1, 1]));
      arena.occupiedRowCountUpperBound = 2;
      const residentProductMass = identityModule.tagResidentProductMassDevice({
        schema: 'peercompute.ulg.sph-resident-product-mass.v0',
        status: 'resident-product-mass-merged-gpu-resident',
        source: 'native-mixed-source-product-event-arena',
        productEventBuffer: arena.buffer,
        productEventBufferRetained: true,
        productEventBufferByteLength: arena.buffer.size,
        productEventRowCount: 2,
        productEventActiveEventCount: 2,
        productEventRowCapacity: 2,
        productEventStrideFloats: 32,
        productEventStrideBytes: 128,
        productEventArena: arena,
        productEventArenaCapacityDescriptor:
          arenaModule.createResidentProductEventArenaCapacityDescriptor(arena),
        productEventMetadataBuffer: arena.metadataBuffer,
        productEventDispatchIndirectBuffer: arena.dispatchIndirectBuffer,
        productEventDispatchMode: 'gpu-authored-exact-live-prefix-indirect',
        productEventSourceIdentity: sourceIdentity,
        productEventSourceLeaseIdentity: laneIdentity,
        normalHotLoopReadbackFree: true,
        destroyResidentProductMassBuffers() { arena.destroy(); }
      }, device);

      const surfaceTable = render.buildSphRenderFieldSurfaceTable([{
        surfaceKey: 'native-water|liquid',
        material: 'native-water',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        resolution: 4,
        isolation: 80,
        subtract: 24,
        radiusNorm: 0.1,
        colorLinear: [0.2, 0.5, 1]
      }]);
      let leaseOrdinal = 0;
      const materialInterfaceSourceField = {
        schema: 'peercompute.ulg.sph-material-interface-source-field.v0',
        status: 'material-interface-source-field-ready',
        backend: 'webgpu-state-thermo-direct-topology',
        sourceFieldGenerationMode: 'same-encoder-state-thermo-direct',
        sourceNeighborhoodAuthorityBinding: 'deferred-to-consuming-compute-manager-lane',
        sourceRenderField: {
          schema: surfaceTable.schema,
          status: 'render-field-built',
          backend: 'webgpu-state-thermo-direct-topology',
          surfaceTable,
          surfaceCount: surfaceTable.surfaceCount,
          totalFieldCells: surfaceTable.totalFieldCells,
          maxFieldCellCount: surfaceTable.maxFieldCellCount,
          fieldPadding: 0.22,
          refEdgeM: 3
        },
        surfaceTable,
        surfaceCount: surfaceTable.surfaceCount,
        totalFieldCells: surfaceTable.totalFieldCells,
        maxFieldCellCount: surfaceTable.maxFieldCellCount,
        fieldPadding: 0.22,
        refEdgeM: 3,
        sourceStep: 0,
        sourcePositionEpoch: 0,
        sourceNeighborhoodGeneration: 0,
        sourceNeighborhoodLaneId: null,
        sourceNeighborhoodStateKey: null,
        sourceDeviceId: identityModule.webGpuDeviceId(device),
        fieldRowsBuffer: null,
        surfaceBuffer: null,
        sourceIndexFieldBuffer: null,
        fieldRowsBufferRetained: false,
        surfaceBufferRetained: false,
        sourceIndexFieldBufferRetained: false,
        normalHotLoopReadbackFree: true,
        addMaterialInterfaceSourceFieldConsumerLease(options = {}) {
          return {
            leaseId: `native-mixed-source-field-consumer:${++leaseOrdinal}`,
            status: 'material-interface-source-field-consumer-lease-acquired',
            ...options
          };
        },
        releaseMaterialInterfaceSourceFieldConsumerLease(leaseId, options = {}) {
          return {
            leaseId,
            status: 'material-interface-source-field-consumer-lease-released-after-submit',
            deferred: true,
            ...options
          };
        }
      };
      const cpuState = new Float32Array([0.65, 0.65, 0.65, 0.001, 0, 0, 0, 300]);
      const cpuThermo = new Float32Array([1, 2, 300, 1000, 0, 1, 0, 0, gridSpacingM, 1, 1, 0.08]);
      const cpuMechanics = new Float32Array(32);
      cpuMechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
      cpuMechanics[18] = 1;
      cpuMechanics[19] = 0.000001;
      const pressureFeedback = {
        schema: 'peercompute.ulg.sph-sealed-gas-pressure-feedback.v0',
        status: 'wall-pressure-ledger-ready',
        totalPressurePa: 120000,
        strictReactionGateStatus: 'strict-reaction-gate-pass',
        gasCellField: {
          schema: 'peercompute.ulg.sph-gas-cell-pressure-field.v0',
          status: 'gas-cell-pressure-field-ready',
          uniformPressurePa: 120000,
          pressureFieldMode: 'uniform-single-cell-sealed-gas',
          pressureFieldResolution: 'lumped-sealed-box',
          gradientStatus: 'uniform-sealed-gas-pressure-zero-gradient'
        }
      };
      const submittedAt = performance.now();
      const execution = await mechanics.runMlsMpmResidentStepsWithOptionalWebGpu({
        sphParticleState: {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: particleCapacity,
          smoothingLengthM: gridSpacingM,
          step: 0,
          time: 0,
          state: cpuState,
          thermo: cpuThermo
        },
        mlsMpmParticleState: {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: particleCapacity,
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
        residentProductMass,
        materialInterfaceSourceField,
        materialInterfaceCompactCandidateCapacity: 192,
        pressureFeedback,
        schroederLevelAssignment: {
          schema: abi.ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
          status: 'schroeder-level-assignment-submitted',
          particleCount: particleCapacity,
          assignmentStrideFloats: 16,
          assignmentBuffer: sourceBuffers.assignments,
          assignmentBufferByteLength: sourceBuffers.assignments.size,
          retainedAssignmentBuffer: true
        },
        schroederSelectedLevel: 0,
        schroederSparseHierarchy: {
          schema: abi.ULG_SCHROEDER_SPARSE_HIERARCHY_EXECUTION_SCHEMA,
          status: 'schroeder-sparse-two-level-hierarchy-submitted',
          generationId: hierarchyGeneration,
          evidenceBuffer: hierarchyEvidenceBuffer,
          routeCapacity: 1,
          maxUniqueNodeCount: 1
        },
        schroederSparseGridArenaByteBudget: 8 * 1024 * 1024,
        stepCount: 1,
        preferWebGpu: true,
        device,
        gridSpacingM,
        boxDimsM: [3, 3, 3],
        readbackMode: 'no-full-readback',
        compactSummaryMode: 'none',
        fuseNoFullResidentMechanicsSequence: true,
        gpuResidentLaneId: laneIdentity.laneId,
        gpuResidentLaneStateKey: laneIdentity.stateKey,
        gpuResidentLaneLeaseIdentity: laneIdentity,
        residentNeighborhoodLaneOptions: {
          maxCandidatesPerSource: 32,
          supportDistanceM: 0.5
        }
      });
      await device.queue.onSubmittedWorkDone();
      const queueFenceMs = performance.now() - submittedAt;
      const fused = execution.fusedResidentSequence;
      const sparseGrid = fused.schroederSparseGrid;
      const readback = device.createBuffer({
        label: 'fused-mixed-source-fixed-evidence-readback',
        size: 256,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      const readbackEncoder = device.createCommandEncoder();
      readbackEncoder.copyBufferToBuffer(sparseGrid.viewBuffer, 0, readback, 0, 64);
      readbackEncoder.copyBufferToBuffer(sparseGrid.dispatchIndirectBuffer, 0, readback, 64, 36);
      readbackEncoder.copyBufferToBuffer(
        sparseGrid.productEventSourceMetadataBuffer, 0, readback, 100, 64
      );
      readbackEncoder.copyBufferToBuffer(
        sparseGrid.pressureForceSourceMetadataBuffer, 0, readback, 164, 16
      );
      readbackEncoder.copyBufferToBuffer(
        sparseGrid.productEventSourceDispatchIndirectBuffer, 0, readback, 180, 12
      );
      readbackEncoder.copyBufferToBuffer(
        sparseGrid.pressureForceSourceDispatchIndirectBuffer, 0, readback, 192, 12
      );
      device.queue.submit([readbackEncoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      const internalError = await device.popErrorScope();
      const outOfMemoryError = await device.popErrorScope();
      const validationError = await device.popErrorScope();
      await readback.mapAsync(GPUMapMode.READ);
      const words = new Uint32Array(readback.getMappedRange()).slice();
      readback.unmap();
      const header = Array.from(words.slice(0, 16));
      const dispatch = Array.from(words.slice(16, 25));
      const productMetadataRead = Array.from(words.slice(25, 41));
      const pressureMetadataRead = Array.from(words.slice(41, 45));
      const productDispatch = Array.from(words.slice(45, 48));
      const pressureDispatch = Array.from(words.slice(48, 51));
      const hotStateBuffersCopyDstEnabled = Object.values(sourceBuffers).some((buffer) => (
        (buffer.usage & GPUBufferUsage.COPY_DST) !== 0
      ));
      const pass = validationError == null
        && outOfMemoryError == null
        && internalError == null
        && uncapturedErrors.length === 0
        && header[1] > 0
        && header[1] === header[2]
        && header[3] === 1
        && header[4] === 0
        && dispatch[0] > 0
        && productMetadataRead[3] === 2
        && productMetadataRead[6] === 0
        && productDispatch[0] > 0
        && pressureMetadataRead[0] > 0
        && pressureMetadataRead[1] === 0
        && pressureDispatch[0] > 0
        && fused.schroederSparseGridSourceAdmissionStatus
          === 'mixed-source-family-gpu-admission-encoded'
        && fused.schroederSparseGridReactionProductEventSourceStatus
          === 'current-product-event-positions-encoded-before-compaction'
        && fused.schroederSparseGridPressureForceSourceStatus
          === 'current-pressure-force-centroids-encoded-before-compaction'
        && fused.schroederSparseGridPressureCentroidOrderStatus
          === 'same-encoder-current-pressure-centroids-built-before-actual-node-compaction'
        && fused.schroederSparseGridHostSourceFailClosed === false
        && fused.schroederSparseGridNormalHotLoopReadbackFree === true
        && hotStateBuffersCopyDstEnabled === false;
      mechanics.destroyMlsMpmResidentStepsBuffers(execution);
      for (const buffer of [
        ...Object.values(sourceBuffers),
        seedParams,
        countMetadataBuffer,
        countDispatchBuffer,
        hierarchyEvidenceBuffer,
        readback
      ]) buffer.destroy();
      return {
        status: pass ? 'pass' : 'fail',
        queueFenceMs,
        header,
        dispatch,
        productMetadata: productMetadataRead,
        pressureMetadata: pressureMetadataRead,
        productDispatch,
        pressureDispatch,
        sourceIdentity,
        telemetry: {
          status: fused.status,
          sourceAdmissionStatus: fused.schroederSparseGridSourceAdmissionStatus,
          productSourceStatus: fused.schroederSparseGridReactionProductEventSourceStatus,
          pressureSourceStatus: fused.schroederSparseGridPressureForceSourceStatus,
          pressureCentroidOrderStatus: fused.schroederSparseGridPressureCentroidOrderStatus,
          hostSourceFailClosed: fused.schroederSparseGridHostSourceFailClosed,
          normalHotLoopReadbackFree: fused.schroederSparseGridNormalHotLoopReadbackFree,
          nodeCapacity: fused.schroederSparseGridNodeCapacity,
          particleCapacity: fused.schroederSparseGridParticleCapacity,
          productSourceIdentity: sparseGrid.productEventSourceIdentity,
          productSourceExpectedIdentity: sparseGrid.productEventSourceExpectedIdentity,
          productSourceLeaseIdentity: sparseGrid.productEventSourceLeaseIdentity,
          productSourceExpectedLeaseIdentity:
            sparseGrid.productEventSourceExpectedLeaseIdentity,
          productSourceGenerationId: sparseGrid.productEventSourceGenerationId,
          productSourceHostAdmitted: sparseGrid.productEventSourceHostAdmitted,
          pressureSourceIdentity: sparseGrid.pressureForceSourceIdentity,
          pressureSourceExpectedIdentity: sparseGrid.pressureForceSourceExpectedIdentity,
          pressureSourceGenerationId: sparseGrid.pressureForceSourceGenerationId,
          pressureSourceHostAdmitted: sparseGrid.pressureForceSourceHostAdmitted
        },
        hotStateBuffersCopyDstEnabled,
        validationError: validationError?.message || null,
        outOfMemoryError: outOfMemoryError?.message || null,
        internalError: internalError?.message || null,
        uncapturedErrors
      };
    });
    const artifact = {
      schema: 'peercompute.ulg.sph-fused-sparse-grid-mixed-source-probe.v0',
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
