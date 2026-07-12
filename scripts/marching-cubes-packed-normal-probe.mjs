import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_MC_NORMAL_BASE_URL || 'http://127.0.0.1:5320/';
const outputPath = process.env.ULG_MC_NORMAL_OUTPUT
  || '/tmp/ulg-marching-cubes-packed-normal-probe.json';

function chromiumArgs() {
  const extra = String(process.env.ULG_MC_NORMAL_CHROMIUM_ARGS || '').trim();
  return [
    '--use-angle=vulkan',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--enable-unsafe-webgpu',
    ...(extra ? extra.split(/\s+/) : [])
  ];
}

function checksForCase(result) {
  const timestampUnsupported = [
    'unsupported',
    'unsupported-api',
    'allocation-failed'
  ].includes(result.timestamps?.status);
  return [
    ['surface-ready', result.surface?.status === 'surface-ready'],
    ['nonempty-triangle-list', result.evidence.total > 0 && result.evidence.total % 3 === 0],
    ['exact-count-not-truncated', result.evidence.exact === result.evidence.total],
    ['finite-position-and-normal', result.evidence.nonfinite === 0],
    ['unit-normal', result.evidence.nonunit === 0],
    ['outward-normal', result.evidence.nonoutward === 0],
    ['no-degenerate-sentinel', result.evidence.degenerate === 0],
    ['normal-field-varies', result.evidence.varying > 0],
    ['all-axis-directions', result.evidence.directionMask === 0x3f],
    ['packed-normal-byte-contract', result.surface.normalBufferByteLength
      === result.surface.vertexRowsBudget * Uint32Array.BYTES_PER_ELEMENT],
    ['position-byte-contract', result.surface.positionBufferByteLength
      === result.surface.vertexRowsBudget * 4 * Float32Array.BYTES_PER_ELEMENT],
    ['same-generation', result.descriptor.surfaceGenerationId
      === result.descriptor.pairedPositionSurfaceGenerationId],
    ['packed-normal-descriptor', result.descriptor.schema
      === 'peercompute.webgpu-marching-cubes.normal-buffer-descriptor.v0'
      && result.descriptor.encoding === 'octahedral-snorm16x2'
      && result.descriptor.normalSign === result.normalSign
      && result.descriptor.lifetimeOwner === 'surface-result'
      && result.descriptor.timestampSpanLabel === 'marchingCubesVertexEmit'],
    ['same-submit-as-position', result.descriptor.sameSubmitAsPosition === true],
    ['zero-normal-only-submits', result.descriptor.additionalSubmitCount === 0],
    ['three-cold-extraction-submits', result.submissions.extraction === 3],
    ['one-evidence-submit', result.submissions.evidence === 1],
    ['gpu-errors-empty', result.errors.length === 0],
    ['timestamp-stage-coverage', timestampUnsupported
      || result.timestamps.missingStages.length === 0]
  ].map(([name, passed]) => ({ name, passed: Boolean(passed) }));
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true, args: chromiumArgs() });
  let result;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    result = await page.evaluate(async () => {
      const nonce = Date.now();
      const [mcModule, timestampModule] = await Promise.all([
        import(`/@fs/home/cos/projects/webgpu-marching-cubes/src/surface_adapter.js?normalProbe=${nonce}`),
        import(`/src/runtime/webgpuTimestampProfiler.js?normalProbe=${nonce}`)
      ]);
      const gpuAdapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!gpuAdapter) {
        return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      }
      const timestampQuerySupported = gpuAdapter.features?.has?.('timestamp-query') === true;
      const rawDevice = await gpuAdapter.requestDevice({
        requiredFeatures: timestampQuerySupported ? ['timestamp-query'] : []
      });
      const uncapturedErrors = [];
      rawDevice.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });

      let submitCount = 0;
      const trackedQueue = new Proxy(rawDevice.queue, {
        get(target, property) {
          if (property === 'submit') {
            return (commandBuffers) => {
              submitCount += 1;
              return target.submit(commandBuffers);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const device = new Proxy(rawDevice, {
        get(target, property) {
          if (property === 'queue') return trackedQueue;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });

      const reductionWgsl = `
struct EvidenceParams {
  center: vec4f,
  vertex_capacity: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
};

@group(0) @binding(0) var<storage, read> positions: array<vec4f>;
@group(0) @binding(1) var<storage, read> packed_normals: array<u32>;
@group(0) @binding(2) var<storage, read> exact_counts: array<u32>;
@group(0) @binding(3) var<storage, read_write> evidence: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: EvidenceParams;

fn sign_not_zero(v: vec2f) -> vec2f {
  return select(vec2f(-1.0), vec2f(1.0), v >= vec2f(0.0));
}

fn decode_octahedral_snorm16x2(packed: u32) -> vec3f {
  let oct = unpack2x16snorm(packed);
  var normal = vec3f(oct, 1.0 - abs(oct.x) - abs(oct.y));
  if (normal.z < 0.0) {
    normal.x = (1.0 - abs(oct.y)) * sign_not_zero(oct).x;
    normal.y = (1.0 - abs(oct.x)) * sign_not_zero(oct).y;
  }
  return normalize(normal);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let vertex_count = min(exact_counts[0], params.vertex_capacity);
  if (gid.x >= vertex_count) { return; }
  if (gid.x == 0u) {
    atomicStore(&evidence[9], vertex_count);
    atomicStore(&evidence[10], exact_counts[1]);
    if (exact_counts[1] > vertex_count) { atomicStore(&evidence[11], 1u); }
  }
  let packed = packed_normals[gid.x];
  let position = positions[gid.x].xyz;
  atomicAdd(&evidence[0], 1u);
  if (packed == 0x80008000u) {
    atomicAdd(&evidence[1], 1u);
    return;
  }
  let normal = decode_octahedral_snorm16x2(packed);
  let finite = all(position == position) && all(normal == normal)
    && all(abs(position) < vec3f(1.0e20)) && all(abs(normal) < vec3f(1.0e20));
  if (!finite) {
    atomicAdd(&evidence[2], 1u);
    return;
  }
  let unit_error = abs(length(normal) - 1.0);
  if (unit_error > 0.001) { atomicAdd(&evidence[3], 1u); }
  atomicMax(&evidence[7], u32(round(min(unit_error, 1.0) * 1000000.0)));
  let radial = normalize(position - params.center.xyz);
  let outward = dot(normal, radial);
  if (outward <= 0.75) { atomicAdd(&evidence[4], 1u); }
  atomicMax(&evidence[8], u32(round(clamp(1.0 - outward, 0.0, 2.0) * 1000000.0)));
  if (packed != packed_normals[0]) { atomicAdd(&evidence[5], 1u); }
  var mask = 0u;
  if (normal.x > 0.25) { mask |= 1u; }
  if (normal.x < -0.25) { mask |= 2u; }
  if (normal.y > 0.25) { mask |= 4u; }
  if (normal.y < -0.25) { mask |= 8u; }
  if (normal.z > 0.25) { mask |= 16u; }
  if (normal.z < -0.25) { mask |= 32u; }
  atomicOr(&evidence[6], mask);
}`;

      const reductionModule = device.createShaderModule({
        label: 'marching-cubes-packed-normal-evidence',
        code: reductionWgsl
      });
      const reductionPipeline = await device.createComputePipelineAsync({
        label: 'marching-cubes-packed-normal-evidence',
        layout: 'auto',
        compute: { module: reductionModule, entryPoint: 'main' }
      });
      const dims = [32, 32, 32];
      const center = dims.map((dim) => (dim - 1) * 0.5);
      const emittedCenter = center.map((value) => value + 0.5);
      const radius = 10.25;
      const vertexRowsBudget = 100_000;

      const runCase = async ({ name, normalSign }) => {
        device.pushErrorScope('validation');
        device.pushErrorScope('out-of-memory');
        device.pushErrorScope('internal');
        const scalars = new Float32Array(dims[0] * dims[1] * dims[2]);
        let cursor = 0;
        for (let z = 0; z < dims[2]; z += 1) {
          for (let y = 0; y < dims[1]; y += 1) {
            for (let x = 0; x < dims[0]; x += 1) {
              const distance = Math.hypot(x - center[0], y - center[1], z - center[2]);
              scalars[cursor] = normalSign === -1 ? radius - distance : distance - radius;
              cursor += 1;
            }
          }
        }
        const scalarBuffer = device.createBuffer({
          label: `${name}-manufactured-scalar-field`,
          size: scalars.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(scalarBuffer, 0, scalars);
        const volume = mcModule.createBufferVolumeDescriptor({
          device,
          scalarBuffer,
          dims,
          normalSign,
          label: `${name}-manufactured-sphere`
        });
        const profiler = timestampModule.createWebGpuTimestampProfiler(device, {
          requested: timestampQuerySupported,
          label: `marching-cubes-packed-normal-${name}`,
          maxSpans: 8
        });
        const extractor = mcModule.createSurfaceExtractor({ device, volume });
        const beforeExtraction = submitCount;
        const execution = await extractor.extractSurface({
          isovalue: 0,
          noReadback: true,
          readbackMode: 'gpu-conservative-no-readback',
          vertexRowsBudget,
          timestampProfiler: profiler,
          timestampMetadata: { probe: 'packed-normal', caseName: name }
        });
        const afterExtraction = submitCount;
        if (!execution.ok || !execution.result?.buffer || !execution.result?.normalBuffer) {
          throw new Error(`surface extraction failed for ${name}: ${JSON.stringify(execution.webgpuStatus)}`);
        }

        const evidenceBuffer = device.createBuffer({
          label: `${name}-normal-evidence`,
          size: 16 * Uint32Array.BYTES_PER_ELEMENT,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });
        const evidenceReadback = device.createBuffer({
          label: `${name}-normal-evidence-readback`,
          size: evidenceBuffer.size,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const paramsBuffer = device.createBuffer({
          label: `${name}-normal-evidence-params`,
          size: 32,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        const paramsBytes = new ArrayBuffer(32);
        new Float32Array(paramsBytes).set([...emittedCenter, 1], 0);
        new Uint32Array(paramsBytes)[4] = vertexRowsBudget;
        device.queue.writeBuffer(evidenceBuffer, 0, new Uint32Array(16));
        device.queue.writeBuffer(paramsBuffer, 0, paramsBytes);
        const bindGroup = device.createBindGroup({
          layout: reductionPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: execution.result.buffer } },
            { binding: 1, resource: { buffer: execution.result.normalBuffer } },
            { binding: 2, resource: { buffer: execution.result.actualVertexCounterBuffer } },
            { binding: 3, resource: { buffer: evidenceBuffer } },
            { binding: 4, resource: { buffer: paramsBuffer } }
          ]
        });
        const encoder = device.createCommandEncoder({ label: `${name}-normal-evidence` });
        const pass = encoder.beginComputePass(
          profiler.beginComputePassDescriptor('marchingCubesNormalEvidence', {
            probe: 'packed-normal',
            caseName: name
          })
        );
        pass.setPipeline(reductionPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(vertexRowsBudget / 64));
        pass.end();
        encoder.copyBufferToBuffer(
          evidenceBuffer,
          0,
          evidenceReadback,
          0,
          evidenceReadback.size
        );
        profiler.encodeResolve(encoder);
        const beforeEvidence = submitCount;
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const afterEvidence = submitCount;
        const timestampProfile = await profiler.read();
        await evidenceReadback.mapAsync(GPUMapMode.READ);
        const evidence = new Uint32Array(evidenceReadback.getMappedRange()).slice();
        evidenceReadback.unmap();

        const internalError = await device.popErrorScope();
        const outOfMemoryError = await device.popErrorScope();
        const validationError = await device.popErrorScope();
        const scopedErrors = [validationError, outOfMemoryError, internalError]
          .filter(Boolean)
          .map((error) => error.message || String(error));
        const normalDescriptor = execution.result.outputDescriptors?.rows?.normal
          ?.normalBufferDescriptor || null;
        const requiredTimestampStages = [
          'marchingCubesVertexCount',
          'marchingCubesVertexCountClamp',
          'marchingCubesVertexEmit',
          'marchingCubesNormalEvidence'
        ];
        const validTimestampLabels = (timestampProfile.spans || [])
          .filter((span) => span.valid === true)
          .map((span) => span.label);
        const report = {
          name,
          normalSign,
          surface: {
            status: execution.result.status,
            vertexCountMode: execution.result.vertexCountMode,
            vertexRowsBudget,
            conservativeWorstCaseVertexCount: execution.result.conservativeWorstCaseVertexCount,
            positionBufferByteLength: execution.result.buffer.size,
            normalBufferByteLength: execution.result.normalBuffer.size,
            normalEncoding: execution.result.normalEncoding,
            normalSemantic: execution.result.normalSemantic
          },
          descriptor: {
            schema: normalDescriptor?.schema ?? null,
            encoding: normalDescriptor?.encoding ?? null,
            normalSign: normalDescriptor?.normalSign ?? null,
            surfaceGenerationId: normalDescriptor?.generation?.surfaceGenerationId ?? null,
            pairedPositionSurfaceGenerationId:
              normalDescriptor?.generation?.pairedPositionSurfaceGenerationId ?? null,
            sameSubmitAsPosition: normalDescriptor?.generation?.sameSubmitAsPosition ?? null,
            lifetimeOwner: normalDescriptor?.lifetime?.owner ?? null,
            additionalSubmitCount: normalDescriptor?.producer?.additionalSubmitCount ?? null,
            timestampSpanLabel: normalDescriptor?.producer?.timestampSpanLabel ?? null
          },
          evidence: {
            total: evidence[0],
            degenerate: evidence[1],
            nonfinite: evidence[2],
            nonunit: evidence[3],
            nonoutward: evidence[4],
            varying: evidence[5],
            directionMask: evidence[6],
            maxUnitError: evidence[7] / 1_000_000,
            maxAngularError: evidence[8] / 1_000_000,
            drawn: evidence[9],
            exact: evidence[10],
            saturated: evidence[11] === 1
          },
          submissions: {
            extraction: afterExtraction - beforeExtraction,
            evidence: afterEvidence - beforeEvidence,
            total: afterEvidence - beforeExtraction,
            normalAdditional: normalDescriptor?.producer?.additionalSubmitCount ?? null
          },
          timestamps: {
            requested: timestampQuerySupported,
            status: timestampProfile.status,
            stageTotals: timestampProfile.stageTotals,
            validLabels: validTimestampLabels,
            missingStages: requiredTimestampStages.filter(
              (label) => !validTimestampLabels.includes(label)
            ),
            skippedSpanCount: timestampProfile.skippedSpanCount,
            invalidSpanCount: timestampProfile.invalidSpanCount
          },
          errors: scopedErrors
        };

        execution.result.release();
        await extractor.release();
        profiler.destroy();
        scalarBuffer.destroy();
        evidenceBuffer.destroy();
        evidenceReadback.destroy();
        paramsBuffer.destroy();
        return report;
      };

      const cases = [];
      cases.push(await runCase({ name: 'density-negative-gradient', normalSign: -1 }));
      cases.push(await runCase({ name: 'sdf-positive-gradient', normalSign: 1 }));
      rawDevice.destroy();
      return {
        status: 'executed',
        timestampQuerySupported,
        cases,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  if (result.status === 'executed') {
    for (const caseResult of result.cases) {
      caseResult.checks = checksForCase(caseResult);
      caseResult.status = caseResult.checks.every((check) => check.passed) ? 'pass' : 'fail';
    }
  }
  const report = {
    schema: 'peercompute.ulg.marching-cubes-packed-normal-probe.v0',
    ...result,
    status: result.status === 'executed'
      && result.cases.every((caseResult) => caseResult.status === 'pass')
      && result.uncapturedErrors.length === 0
      ? 'pass'
      : result.status,
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    chromiumArgs: chromiumArgs()
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

await main();
