import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_SPARSE_FIELD_BASE_URL || 'https://127.0.0.1:5173/';
const outputPath = process.env.ULG_SPARSE_FIELD_OUTPUT
  || '/tmp/ulg-sph-sparse-render-field-probe.json';
const authoritativePolicy = process.env.ULG_SPARSE_FIELD_AUTHORITATIVE_ISOVALUE === '1';

function chromiumArgs() {
  const extra = String(process.env.ULG_SPARSE_FIELD_CHROMIUM_ARGS || '').trim();
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    ...(extra ? extra.split(/\s+/) : [])
  ];
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async ({ authoritativePolicy }) => {
      const nonce = Date.now();
      const [fieldModule, planModule, adapterModule, abi] = await Promise.all([
        import(`/src/runtime/sph/sphSparseRenderFieldGpu.js?probe=${nonce}`),
        import(`/src/runtime/sph/sphSparseRenderFieldPlan.js?probe=${nonce}`),
        import(`/src/runtime/sph/sphMarchingCubesSurfaceAdapter.js?probe=${nonce}`),
        import(`/ulg-gpu-abi/src/index.js?probe=${nonce}`)
      ]);
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      }
      const requiredStorageBuffersPerStage = 10;
      if (adapter.limits.maxStorageBuffersPerShaderStage < requiredStorageBuffersPerStage) {
        return {
          status: 'unsupported',
          reason: `adapter supports only ${adapter.limits.maxStorageBuffersPerShaderStage} storage buffers per stage`
        };
      }
      const device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: requiredStorageBuffersPerStage
        }
      });
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const generationId = 41;
      const surfaceStride = abi.SPH_GPU_RENDER_SURFACE_ROW_LAYOUT.length;
      const sourceRecords = new Float32Array(surfaceStride);
      sourceRecords.set([
        1, 2, 0, 9 ** 3,
        9, 80, 10, 0.9,
        0.3, 0.2, 0.5, 0.9,
        0, 0, 0, 0
      ]);
      const sourceMetadata = {
        index: 0,
        surfaceIndex: 0,
        surfaceKey: 'h2o|liquid|domain:drop',
        role: 'drop',
        material: 'h2o',
        phase: 'liquid',
        materialId: 1,
        phaseId: 2,
        renderDomainId: 0,
        renderDomainKey: 'drop',
        resolution: 9,
        isolation: 80,
        subtract: 10,
        strength: 0.9,
        radiusNorm: 0.3
      };
      const sourceSurfaceTable = {
        schema: abi.ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
        status: 'render-field-surface-table-built',
        surfaceCount: 1,
        rowStrideFloats: surfaceStride,
        records: sourceRecords,
        metadata: [sourceMetadata]
      };
      const policyRows = {
        schema: 'peercompute.ulg.algorithm-material-surface-extraction-rows.v0',
        status: 'algorithm-derived-surface-extraction-rows-ready',
        rowCount: 1,
        rows: [{
          schema: 'peercompute.ulg.algorithm-material-surface-extraction-row.v0',
          role: 'drop',
          material: 'h2o',
          phase: 'liquid',
          isovalue: 0.5,
          isovaluePolicy: 'manufactured-half-occupancy',
          strictSourceOfTruth: false,
          rendererAuthority: authoritativePolicy
            ? 'renderer-authoritative-surface-policy-row'
            : 'not-renderer-authoritative-surface-policy-row'
        }]
      };
      const policySurfaceTable = adapterModule.createUlgEffectiveRenderFieldSurfaceTable({
        surfaceTable: sourceSurfaceTable,
        algorithmMaterialSurfaceExtractionRows: policyRows
      });
      const directRecords = new Float32Array(sourceRecords);
      directRecords[5] = authoritativePolicy ? 0.5 : 80;
      const directSurfaceTable = adapterModule.createUlgEffectiveRenderFieldSurfaceTable({
        surfaceTable: {
          ...sourceSurfaceTable,
          records: directRecords,
          metadata: [{
            ...sourceMetadata,
            isolation: authoritativePolicy ? 0.5 : 80
          }]
        }
      });

      const sparsePlan = planModule.createSphSparseRenderFieldPlan({
        generationId,
        surfaces: [{ surfaceIndex: 0, dimensions: [9, 9, 9] }],
        requiredRouteCount: 1,
        capacity: {
          directoryEntryCount: 8,
          routeCount: 1,
          activeBrickCount: 8,
          atlasCellCount: 8 * 512,
          activeVoxelCount: 8 ** 3
        },
        maxTotalByteLength: 1024 * 1024
      });
      const storageBuffer = (label, data) => {
        const buffer = device.createBuffer({
          label,
          size: data.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const renderRows = new Float32Array(20);
      renderRows.set([0.5, 0.5, 0.5, 0], 0);
      renderRows.set([1, 2, 300, 0], 4);
      renderRows.set([0, 0, 0, 0], 8);
      renderRows.set([0, 0, 0, 0], 12);
      renderRows.set([0, 0, 0, 0], 16);
      const renderRowsBuffer = storageBuffer('manufactured-render-rows', renderRows);

      const makeCase = (label, surfaceTable, {
        runtimeSparsePlan = sparsePlan,
        candidateVoxelCapacities = null
      } = {}) => {
        const surfaceBuffer = storageBuffer(`${label}-surface-rows`, surfaceTable.records);
        const runtime = fieldModule.createSphSparseRenderFieldGpu(device, {
          sparsePlan: runtimeSparsePlan,
          particleCapacity: 1,
          productEventCapacity: 0,
          surfaceMetadata: surfaceTable.metadata,
          maxSupportRadiusBricks: 1,
          candidateVoxelCapacities,
          label
        });
        return { label, surfaceTable, surfaceBuffer, runtime };
      };
      const caseA = makeCase('sparse-field-policy-resolved', policySurfaceTable);
      const caseB = makeCase('sparse-field-direct-isovalue', directSurfaceTable);
      const overflowSparsePlan = planModule.createSphSparseRenderFieldPlan({
        generationId,
        surfaces: [{ surfaceIndex: 0, dimensions: [9, 9, 9] }],
        requiredRouteCount: 1,
        capacity: {
          directoryEntryCount: 8,
          routeCount: 1,
          activeBrickCount: 8,
          atlasCellCount: 8 * 512,
          activeVoxelCount: 1
        },
        maxTotalByteLength: 1024 * 1024
      });
      const overflowCase = makeCase(
        'sparse-field-candidate-overflow',
        policySurfaceTable,
        { runtimeSparsePlan: overflowSparsePlan, candidateVoxelCapacities: [1] }
      );
      if (!caseA.runtime.admitted || !caseB.runtime.admitted) {
        throw new Error(`manufactured sparse plans blocked: ${JSON.stringify({
          a: caseA.runtime.reasons,
          b: caseB.runtime.reasons
        })}`);
      }

      const encoder = device.createCommandEncoder({ label: 'sparse-field-manufactured-a-b' });
      for (const current of [caseA, caseB]) {
        current.artifact = current.runtime.encode(encoder, {
          renderRowsBuffer,
          surfaceBuffer: current.surfaceBuffer,
          particleCount: 1,
          productEventCount: 0,
          generationId,
          fieldPadding: 0.08,
          refEdgeM: 1,
          renderSmearDtS: 0,
          backgroundValue: 0
        });
      }
      overflowCase.artifact = overflowCase.runtime.encode(encoder, {
        renderRowsBuffer,
        surfaceBuffer: overflowCase.surfaceBuffer,
        particleCount: 1,
        productEventCount: 0,
        generationId,
        fieldPadding: 0.08,
        refEdgeM: 1,
        renderSmearDtS: 0,
        backgroundValue: 0
      });

      const comparisonWgsl = `
struct CompareParams {
  atlas_vec4_count: u32,
  candidate_capacity: u32,
  generation_id: u32,
  _pad0: u32,
};
@group(0) @binding(0) var<storage, read> atlas_a: array<vec4<u32>>;
@group(0) @binding(1) var<storage, read> atlas_b: array<vec4<u32>>;
@group(0) @binding(2) var<storage, read> evidence_a: array<u32>;
@group(0) @binding(3) var<storage, read> evidence_b: array<u32>;
@group(0) @binding(4) var<storage, read> candidates_a: array<u32>;
@group(0) @binding(5) var<storage, read> candidates_b: array<u32>;
@group(0) @binding(6) var<storage, read> counters_a: array<u32>;
@group(0) @binding(7) var<storage, read> counters_b: array<u32>;
@group(0) @binding(8) var<storage, read> indirect_a: array<u32>;
@group(0) @binding(9) var<storage, read> indirect_b: array<u32>;
@group(0) @binding(10) var<storage, read_write> comparison: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> params: CompareParams;
@group(0) @binding(12) var<storage, read> overflow_evidence: array<u32>;
@group(0) @binding(13) var<storage, read> overflow_indirect: array<u32>;
@group(0) @binding(14) var<storage, read> overflow_counter: array<u32>;

@compute @workgroup_size(64)
fn compare_atlas(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index < params.atlas_vec4_count && any(atlas_a[index] != atlas_b[index])) {
    atomicAdd(&comparison[0], 1u);
  }
}

@compute @workgroup_size(64)
fn compare_evidence(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index < 36u && evidence_a[index] != evidence_b[index]) {
    atomicAdd(&comparison[1], 1u);
  }
  if (index == 0u) {
    let valid = evidence_a[0] == params.generation_id
      && evidence_a[6] == 1u
      && evidence_a[10] == 1u
      && evidence_a[14] > 0u
      && evidence_a[20] == 0u
      && evidence_a[22] == 1u
      && evidence_a[23] == 0u
      && evidence_a[24] == 0u
      && evidence_a[25] == 1u;
    if (!valid) { atomicAdd(&comparison[8], 1u); }
    atomicStore(&comparison[9], evidence_a[10]);
    atomicStore(&comparison[10], evidence_a[14]);
    atomicStore(&comparison[11], evidence_a[16]);
  }
}

@compute @workgroup_size(64)
fn compare_candidates(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  let count_a = counters_a[0];
  let count_b = counters_b[0];
  if (index == 0u) {
    if (count_a != count_b || count_a == 0u || count_a > params.candidate_capacity) {
      atomicAdd(&comparison[2], 1u);
    }
    let expected_dispatch = (min(count_a, params.candidate_capacity) + 31u) / 32u;
    if (indirect_a[0] != expected_dispatch || indirect_b[0] != expected_dispatch
      || indirect_a[1] != 1u || indirect_a[2] != 1u
      || indirect_b[1] != 1u || indirect_b[2] != 1u) {
      atomicAdd(&comparison[3], 1u);
    }
    atomicStore(&comparison[7], count_a);
  }
  let count = min(min(count_a, count_b), params.candidate_capacity);
  if (index < count) {
    let left = candidates_a[index];
    let right = candidates_b[index];
    atomicXor(&comparison[4], left);
    atomicXor(&comparison[4], right);
    atomicAdd(&comparison[5], left);
    atomicAdd(&comparison[5], 0u - right);
    if (left >= 512u || right >= 512u) {
      atomicAdd(&comparison[6], 1u);
    }
  }
}

@compute @workgroup_size(1)
fn validate_candidate_overflow() {
  let valid = (overflow_evidence[20] & 16u) != 0u
    && overflow_evidence[22] == 0u
    && overflow_evidence[23] == 1u
    && overflow_evidence[24] == 1u
    && overflow_evidence[25] == 2u
    && overflow_indirect[0] == 0u
    && overflow_indirect[1] == 1u
    && overflow_indirect[2] == 1u
    && overflow_counter[0] > 1u;
  if (!valid) { atomicAdd(&comparison[12], 1u); }
  atomicStore(&comparison[13], overflow_evidence[20]);
  atomicStore(&comparison[14], overflow_indirect[0]);
  atomicStore(&comparison[15], overflow_counter[0]);
}
`;
      const module = device.createShaderModule({
        label: 'sparse-field-manufactured-comparison-shader',
        code: comparisonWgsl
      });
      const makePipeline = (entryPoint) => device.createComputePipeline({
        label: `sparse-field-manufactured-${entryPoint}`,
        layout: 'auto',
        compute: { module, entryPoint }
      });
      const atlasPipeline = makePipeline('compare_atlas');
      const evidencePipeline = makePipeline('compare_evidence');
      const candidatePipeline = makePipeline('compare_candidates');
      const overflowPipeline = makePipeline('validate_candidate_overflow');
      const comparisonBuffer = device.createBuffer({
        label: 'sparse-field-manufactured-comparison',
        size: 16 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
      });
      const paramsBuffer = device.createBuffer({
        label: 'sparse-field-manufactured-comparison-params',
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      const atlasVec4Count = caseA.runtime.atlasCellCapacity * 2;
      device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([
        atlasVec4Count,
        caseA.runtime.activeVoxelCapacity,
        generationId,
        0
      ]));
      encoder.clearBuffer(comparisonBuffer);
      const pass = (pipeline, entries, count) => {
        const computePass = encoder.beginComputePass({ label: pipeline.label });
        computePass.setPipeline(pipeline);
        computePass.setBindGroup(0, device.createBindGroup({
          label: `${pipeline.label}-group`,
          layout: pipeline.getBindGroupLayout(0),
          entries
        }));
        computePass.dispatchWorkgroups(Math.ceil(count / 64));
        computePass.end();
      };
      pass(atlasPipeline, [
        { binding: 0, resource: { buffer: caseA.artifact.atlasBuffer } },
        { binding: 1, resource: { buffer: caseB.artifact.atlasBuffer } },
        { binding: 10, resource: { buffer: comparisonBuffer } },
        { binding: 11, resource: { buffer: paramsBuffer } }
      ], atlasVec4Count);
      pass(evidencePipeline, [
        { binding: 2, resource: { buffer: caseA.artifact.runtimeEvidenceBuffer } },
        { binding: 3, resource: { buffer: caseB.artifact.runtimeEvidenceBuffer } },
        { binding: 10, resource: { buffer: comparisonBuffer } },
        { binding: 11, resource: { buffer: paramsBuffer } }
      ], 64);
      pass(candidatePipeline, [
        { binding: 4, resource: { buffer: caseA.artifact.candidateVoxelIdsBuffer } },
        { binding: 5, resource: { buffer: caseB.artifact.candidateVoxelIdsBuffer } },
        { binding: 6, resource: { buffer: caseA.artifact.candidateVoxelCountersBuffer } },
        { binding: 7, resource: { buffer: caseB.artifact.candidateVoxelCountersBuffer } },
        { binding: 8, resource: { buffer: caseA.artifact.candidateDispatchIndirectBuffer } },
        { binding: 9, resource: { buffer: caseB.artifact.candidateDispatchIndirectBuffer } },
        { binding: 10, resource: { buffer: comparisonBuffer } },
        { binding: 11, resource: { buffer: paramsBuffer } }
      ], caseA.runtime.activeVoxelCapacity);
      pass(overflowPipeline, [
        { binding: 10, resource: { buffer: comparisonBuffer } },
        { binding: 12, resource: { buffer: overflowCase.artifact.runtimeEvidenceBuffer } },
        {
          binding: 13,
          resource: { buffer: overflowCase.artifact.candidateDispatchIndirectBuffer }
        },
        {
          binding: 14,
          resource: { buffer: overflowCase.artifact.candidateVoxelCountersBuffer }
        }
      ], 1);

      const readback = device.createBuffer({
        label: 'sparse-field-manufactured-comparison-readback',
        size: comparisonBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyBufferToBuffer(comparisonBuffer, 0, readback, 0, readback.size);
      const submittedAt = performance.now();
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      const queueFenceMs = performance.now() - submittedAt;
      const scopedError = await device.popErrorScope();
      await readback.mapAsync(GPUMapMode.READ);
      const comparison = new Uint32Array(readback.getMappedRange()).slice();
      readback.unmap();

      const exactBytePlan = [caseA, caseB, overflowCase].every((current) =>
        current.artifact.byteEvidence.allocatedByteLength
          === current.runtime.byteLayout.peakAllocatedByteLength);
      const exactCapacityProof = [caseA, caseB].every((current) =>
        current.runtime.runtimeOverflowImpossibleForDeclaredInputBounds === true
          && current.artifact.runtimeOverflowImpossibleForDeclaredInputBounds === true
          && current.artifact.exactCapacityProof?.admitted === true);
      const passStatus = comparison[0] === 0
        && comparison[1] === 0
        && comparison[2] === 0
        && comparison[3] === 0
        && comparison[4] === 0
        && comparison[5] === 0
        && comparison[6] === 0
        && comparison[7] > 0
        && comparison[8] === 0
        && comparison[9] === 1
        && comparison[12] === 0
        && comparison[13] !== 0
        && comparison[14] === 0
        && comparison[15] > 1
        && exactBytePlan
        && exactCapacityProof
        && !scopedError
        && uncapturedErrors.length === 0;
      const summary = {
        status: passStatus ? 'pass' : 'fail',
        comparison: {
          atlasMismatchCount: comparison[0],
          evidenceMismatchCount: comparison[1],
          candidateCountMismatch: comparison[2],
          candidateDispatchMismatch: comparison[3],
          candidateXorDelta: comparison[4],
          candidateSumDelta: comparison[5],
          invalidCandidateCount: comparison[6],
          candidateCount: comparison[7],
          evidenceInvariantFailures: comparison[8],
          routeCount: comparison[9],
          activeBrickCount: comparison[10],
          atlasCellRequiredCount: comparison[11]
        },
        candidateOverflowFailClosed: {
          invariantFailures: comparison[12],
          overflowFlags: comparison[13],
          candidateDispatchX: comparison[14],
          candidateRequiredCount: comparison[15],
          exactCapacityProofRejected:
            overflowCase.runtime.runtimeOverflowImpossibleForDeclaredInputBounds === false
        },
        policyResolution: {
          policyMode: authoritativePolicy ? 'renderer-authoritative' : 'advisory',
          sourceIsovalue: sourceSurfaceTable.records[5],
          producerIsovalue: policySurfaceTable.records[5],
          directIsovalue: directSurfaceTable.records[5],
          consumerIsovalue: policySurfaceTable.metadata[0].effectiveExtractionIsovalue
        },
        zeroStatusRowsAccepted: comparison[9] === 1,
        exactBytePlan,
        exactCapacityProof,
        allocatedByteLength: caseA.artifact.byteEvidence.allocatedByteLength,
        candidateDispatchIndirectByteLength:
          caseA.artifact.candidateDispatchIndirectBufferByteLength,
        queueFenceMs,
        scopedError: scopedError?.message || null,
        uncapturedErrors
      };

      for (const current of [caseA, caseB, overflowCase]) {
        current.runtime.releaseTransientBuffers(current.artifact);
        current.runtime.destroy();
        current.surfaceBuffer.destroy();
      }
      renderRowsBuffer.destroy();
      comparisonBuffer.destroy();
      paramsBuffer.destroy();
      readback.destroy();
      device.destroy();
      return summary;
    }, { authoritativePolicy });

    const artifact = {
      schema: 'peercompute.ulg.sph-sparse-render-field-manufactured-probe.v0',
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl,
      ...result
    };
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(artifact)}\n`);
    if (artifact.status !== 'pass') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
