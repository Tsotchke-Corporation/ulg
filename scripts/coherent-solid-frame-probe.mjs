import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.ULG_SOLID_FRAME_BASE_URL || 'https://127.0.0.1:5173/';
const outputPath = process.env.ULG_SOLID_FRAME_OUTPUT || '/tmp/ulg-coherent-solid-frame.json';
const gpuTimestampProfilingRequested = process.env.ULG_NATIVE_GPU_PROFILE !== '0';

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
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async ({ gpuTimestampProfilingRequested }) => {
      const runtimeModule = await import(
        `/src/runtime/solid/coherentSolidFrameGpu.js?probe=${Date.now()}`
      );
      const timestampModule = await import(
        `/src/runtime/webgpuTimestampProfiler.js?probe=${Date.now()}`
      );
      const abi = await import(`/ulg-gpu-abi/src/coherentSolid.js?probe=${Date.now()}`);
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'unsupported', reason: 'navigator.gpu returned no adapter' };
      const timestampQuerySupported = adapter.features?.has?.('timestamp-query') === true;
      const device = await adapter.requestDevice({
        requiredFeatures: gpuTimestampProfilingRequested && timestampQuerySupported
          ? ['timestamp-query']
          : []
      });
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });

      const f32Bits = (value) => new Uint32Array(new Float32Array([value]).buffer)[0];
      const bitsF32 = (value) => new Float32Array(new Uint32Array([value]).buffer)[0];
      const localPositions = [
        [-1.0, -0.5, -0.25],
        [1.2, -0.4, -0.2],
        [-0.7, 0.8, -0.1],
        [0.5, 0.1, 0.55]
      ];
      const computeInertia = () => {
        const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (const [x, y, z] of localPositions) {
          matrix[0][0] += y * y + z * z;
          matrix[1][1] += x * x + z * z;
          matrix[2][2] += x * x + y * y;
          matrix[0][1] -= x * y;
          matrix[1][0] -= y * x;
          matrix[0][2] -= x * z;
          matrix[2][0] -= z * x;
          matrix[1][2] -= y * z;
          matrix[2][1] -= z * y;
        }
        return matrix;
      };
      const invert3 = (matrix) => {
        const [a, b, c] = matrix[0];
        const [d, e, f] = matrix[1];
        const [g, h, i] = matrix[2];
        const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
        return [
          [(e * i - f * h) / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant],
          [(f * g - d * i) / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant],
          [(d * h - e * g) / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant]
        ];
      };
      const inertia = computeInertia();
      const inverseInertia = invert3(inertia);
      const sourceGenerationId = 7;
      const targetGenerationId = 8;
      const leaseId = 41;
      const leaseEpoch = 3;
      const dtS = 0.01;
      const bodyId = 123;
      const componentGeneration = 5;
      const createBuffer = (label, data) => {
        const buffer = device.createBuffer({
          label,
          size: data.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };
      const makeFrame = (centerOfMass) => {
        const words = new Uint32Array(abi.COHERENT_SOLID_FRAME_WORDS);
        words[0] = bodyId;
        words[1] = componentGeneration;
        words[2] = 17;
        words[3] = 29;
        words[4] = 0;
        words[5] = 0;
        words[6] = 0;
        words[7] = abi.COHERENT_SOLID_MOTION_DYNAMIC;
        words[8] = 1;
        words[9] = sourceGenerationId;
        words[10] = leaseId;
        words[11] = leaseEpoch;
        words[12] = 1;
        words[13] = f32Bits(centerOfMass[0]);
        words[14] = f32Bits(centerOfMass[1]);
        words[15] = f32Bits(centerOfMass[2]);
        words[16] = f32Bits(0);
        words[17] = f32Bits(0);
        words[18] = f32Bits(0);
        words[19] = f32Bits(1);
        words[20] = f32Bits(2);
        words[21] = f32Bits(0);
        words[22] = f32Bits(0);
        words[24] = f32Bits(0.2);
        words[25] = f32Bits(0.3);
        words[26] = f32Bits(0.4);
        words[28] = f32Bits(4);
        words[29] = f32Bits(300);
        words[30] = f32Bits(1200);
        words[31] = f32Bits(1e-4);
        const tensorOffsets = [[32, 36, 40], [44, 48, 52]];
        for (let matrixIndex = 0; matrixIndex < 2; matrixIndex += 1) {
          const matrix = matrixIndex === 0 ? inertia : inverseInertia;
          for (let row = 0; row < 3; row += 1) {
            for (let column = 0; column < 3; column += 1) {
              words[tensorOffsets[matrixIndex][row] + column] = f32Bits(matrix[row][column]);
            }
          }
        }
        words[56] = 26;
        words[57] = 1;
        words[58] = 4;
        words[59] = 7;
        words[60] = 1001;
        words[61] = 1002;
        words[62] = 1003;
        words[63] = 1004;
        words[64] = 2;
        words[65] = 2;
        words[69] = f32Bits(0);
        words[70] = 2;
        words[71] = 55;
        words[75] = f32Bits(1);
        words[76] = 1;
        words[78] = 12;
        words[79] = abi.COHERENT_SOLID_ROW_STATUS_ACTIVE;
        return words;
      };
      const makeMembers = () => {
        const words = new Uint32Array(localPositions.length * abi.COHERENT_SOLID_MEMBER_WORDS);
        for (let index = 0; index < localPositions.length; index += 1) {
          const base = index * abi.COHERENT_SOLID_MEMBER_WORDS;
          const [x, y, z] = localPositions[index];
          words[base + 0] = 0;
          words[base + 1] = bodyId;
          words[base + 2] = 200 + index;
          words[base + 3] = componentGeneration;
          words[base + 4] = sourceGenerationId;
          words[base + 5] = 77;
          words[base + 6] = 26;
          words[base + 7] = 1;
          words[base + 8] = f32Bits(x);
          words[base + 9] = f32Bits(y);
          words[base + 10] = f32Bits(z);
          words[base + 11] = f32Bits(0.25);
          words[base + 12] = f32Bits(1);
          words[base + 13] = f32Bits(300);
          words[base + 14] = f32Bits(300);
          words[base + 15] = f32Bits(index === 0 ? 1 : 0);
          words[base + 32] = index === 0 ? 1 : 0;
          words[base + 36] = 1;
          words[base + 37] = 2;
          words[base + 38] = 11;
          words[base + 39] = abi.COHERENT_SOLID_ROW_STATUS_ACTIVE;
        }
        return words;
      };
      const makeWrenches = (driven) => {
        const words = new Uint32Array(localPositions.length * abi.COHERENT_SOLID_MEMBER_WRENCH_WORDS);
        for (let index = 0; index < localPositions.length; index += 1) {
          const base = index * abi.COHERENT_SOLID_MEMBER_WRENCH_WORDS;
          words[base + 0] = 200 + index;
          words[base + 1] = bodyId;
          words[base + 2] = componentGeneration;
          words[base + 3] = sourceGenerationId;
          words[base + 4] = f32Bits(driven ? 1 : 0);
          words[base + 5] = f32Bits(0);
          words[base + 6] = f32Bits(0);
          words[base + 7] = abi.COHERENT_SOLID_ROW_STATUS_ACTIVE;
          words[base + 8] = f32Bits(0);
          words[base + 9] = f32Bits(driven && index === 0 ? 0.5 : 0);
          words[base + 10] = f32Bits(0);
          words[base + 11] = 88;
        }
        return words;
      };

      const runCase = async ({ name, centerOfMass, membershipOrder, driven, acceleration }) => {
        device.pushErrorScope('validation');
        device.pushErrorScope('out-of-memory');
        device.pushErrorScope('internal');
        const frameBuffer = createBuffer(`${name}-frames`, makeFrame(centerOfMass));
        const memberBuffer = createBuffer(`${name}-members`, makeMembers());
        const offsetBuffer = createBuffer(`${name}-offsets`, new Uint32Array([0, 4]));
        const indexBuffer = createBuffer(`${name}-indices`, new Uint32Array(membershipOrder));
        const wrenchBuffer = createBuffer(`${name}-wrenches`, makeWrenches(driven));
        const plan = runtimeModule.createCoherentSolidFrameGpuPlan({
          bodyCapacity: 1,
          memberCapacity: 4,
          membershipIndexCapacity: 4,
          arenaByteBudget: 1 << 20,
          maxBufferSize: device.limits.maxBufferSize,
          maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
          maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension
        });
        const runtime = runtimeModule.createCoherentSolidFrameGpu(device, {
          plan,
          label: `solid-frame-probe-${name}`
        });
        const timestampProfiler = timestampModule.createWebGpuTimestampProfiler(device, {
          requested: gpuTimestampProfilingRequested,
          label: `ulg-coherent-solid-frame-${name}`,
          maxSpans: 16
        });
        const encoder = device.createCommandEncoder({ label: `${name}-encoder` });
        const shared = { generationId: sourceGenerationId, leaseId, leaseEpoch, device };
        const execution = runtime.encode(encoder, {
          frameSource: {
            schema: abi.ULG_COHERENT_SOLID_FRAME_SCHEMA,
            ...shared,
            buffer: frameBuffer,
            bodyCount: 1,
            strideWords: abi.COHERENT_SOLID_FRAME_WORDS,
            authorityStatus: abi.COHERENT_SOLID_STATE_MANAGER_ADMITTED
          },
          memberSource: {
            schema: abi.ULG_COHERENT_SOLID_MEMBER_SCHEMA,
            ...shared,
            buffer: memberBuffer,
            memberCount: 4,
            strideWords: abi.COHERENT_SOLID_MEMBER_WORDS,
            authorityStatus: abi.COHERENT_SOLID_STATE_MANAGER_ADMITTED
          },
          membershipSource: {
            schema: abi.ULG_COHERENT_SOLID_MEMBER_MEMBERSHIP_SCHEMA,
            ...shared,
            offsetBuffer,
            indexBuffer,
            bodyCount: 1,
            indexCount: 4,
            exactPartition: true,
            authorityStatus: abi.COHERENT_SOLID_DERIVED_ADMITTED
          },
          memberWrenchSource: {
            schema: abi.ULG_COHERENT_SOLID_MEMBER_WRENCH_INPUT_SCHEMA,
            ...shared,
            buffer: wrenchBuffer,
            memberCount: 4,
            strideWords: abi.COHERENT_SOLID_MEMBER_WRENCH_WORDS,
            authorityStatus: abi.COHERENT_SOLID_DERIVED_ADMITTED
          },
          targetGenerationId,
          dtS,
          externalAcceleration: acceleration,
          tolerances: {
            quaternionNorm: 5e-5,
            massRelative: 5e-5,
            localCenterOfMassM: 5e-5,
            inertiaSymmetryKgM2: 5e-5,
            inertiaInverse: 1e-4,
            memberInertiaRelative: 1e-4,
            transformPositionM: 5e-5,
            transformVelocityMPerS: 5e-5,
            momentumUpdate: 5e-5
          },
          timestampProfiler,
          timestampMetadata: { probe: 'coherent-solid-frame', caseName: name }
        });
        const evidenceRead = device.createBuffer({
          label: `${name}-evidence-read`,
          size: plan.invariantEvidenceByteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const frameRead = device.createBuffer({
          label: `${name}-frame-read`,
          size: plan.candidateFrameByteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const invariantRead = device.createBuffer({
          label: `${name}-invariant-read`,
          size: plan.bodyInvariantByteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyBufferToBuffer(
          execution.invariantEvidence.buffer,
          0,
          evidenceRead,
          0,
          evidenceRead.size
        );
        encoder.copyBufferToBuffer(
          execution.frameMutationCandidate.buffer,
          0,
          frameRead,
          0,
          frameRead.size
        );
        encoder.copyBufferToBuffer(
          execution.bodyInvariants.buffer,
          0,
          invariantRead,
          0,
          invariantRead.size
        );
        const timestampResolveEncoded = timestampProfiler.encodeResolve(encoder);
        const submittedAt = performance.now();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
        const queueFenceMs = performance.now() - submittedAt;
        const gpuTimestampProfile = await timestampProfiler.read();
        const timestampRequirements = Object.entries(
          runtimeModule.COHERENT_SOLID_FRAME_GPU_TIMESTAMP_STAGE
        ).map(([id, label]) => ({ id, label }));
        const validTimestampSpans = (gpuTimestampProfile.spans || []).filter(
          (span) => span.valid === true
        );
        const timestampCoverage = timestampRequirements.map((requirement) => ({
          ...requirement,
          matched: validTimestampSpans.some((span) => span.label === requirement.label)
        }));
        const missingTimestampStages = timestampCoverage
          .filter(({ matched }) => !matched)
          .map(({ id }) => id);
        const timestampUnsupported = [
          'unsupported',
          'unsupported-api',
          'allocation-failed'
        ].includes(gpuTimestampProfile.status);
        const timestampComplete = gpuTimestampProfile.status === 'timestamp-profile-complete'
          && gpuTimestampProfile.skippedSpanCount === 0
          && gpuTimestampProfile.invalidSpanCount === 0
          && missingTimestampStages.length === 0;
        const gpuTimestampEvidence = {
          schema: 'peercompute.ulg.native-gpu-timestamp-evidence.v0',
          requested: gpuTimestampProfilingRequested,
          adapterSupported: timestampQuerySupported,
          capability: timestampProfiler.capability,
          status: !gpuTimestampProfilingRequested
            ? 'not-requested'
            : (timestampUnsupported
                ? 'inconclusive-unsupported'
                : (timestampComplete ? 'pass' : 'fail')),
          sameSubmissionResolve: timestampResolveEncoded === timestampProfiler.active,
          requiredStages: timestampCoverage,
          missingStageIds: missingTimestampStages,
          skippedSpanCount: gpuTimestampProfile.skippedSpanCount,
          invalidSpanCount: gpuTimestampProfile.invalidSpanCount,
          stageTotals: gpuTimestampProfile.stageTotals,
          profile: gpuTimestampProfile
        };
        const internalError = await device.popErrorScope();
        const outOfMemoryError = await device.popErrorScope();
        const validationError = await device.popErrorScope();
        await evidenceRead.mapAsync(GPUMapMode.READ);
        const evidence = new Uint32Array(evidenceRead.getMappedRange()).slice();
        evidenceRead.unmap();
        await frameRead.mapAsync(GPUMapMode.READ);
        const frame = new Uint32Array(frameRead.getMappedRange()).slice();
        frameRead.unmap();
        await invariantRead.mapAsync(GPUMapMode.READ);
        const invariant = new Uint32Array(invariantRead.getMappedRange()).slice();
        invariantRead.unmap();
        const position = [13, 14, 15].map((word) => bitsF32(frame[word]));
        const quaternion = [16, 17, 18, 19].map((word) => bitsF32(frame[word]));
        const linearMomentum = [20, 21, 22].map((word) => bitsF32(frame[word]));
        const angularMomentum = [24, 25, 26].map((word) => bitsF32(frame[word]));
        const residuals = Array.from(evidence.slice(12, 22), bitsF32);
        const physicsPass = plan.admitted
          && evidence[0] === targetGenerationId
          && evidence[1] === leaseId
          && evidence[2] === leaseEpoch
          && evidence[3] === 1
          && evidence[4] === 4
          && evidence[5] === 1
          && evidence[6] === 4
          && evidence[7] === 1
          && evidence.slice(8, 12).every((value) => value === 0)
          && evidence[22] === 1
          && evidence[23] === 1
          && evidence[24] === 0
          && evidence[31] === 1
          && frame[9] === targetGenerationId
          && frame[10] === leaseId
          && frame[11] === leaseEpoch
          && frame[79] === abi.COHERENT_SOLID_ROW_STATUS_ACTIVE
          && (invariant[6] & abi.COHERENT_SOLID_INVARIANT_STATUS_NUMERICALLY_ADMISSIBLE) !== 0
          && residuals.every((value) => Number.isFinite(value))
          && validationError == null
          && outOfMemoryError == null
          && internalError == null;
        const pass = physicsPass && gpuTimestampEvidence.status !== 'fail';
        execution.releaseTransientBuffers();
        runtime.destroy();
        for (const buffer of [
          frameBuffer,
          memberBuffer,
          offsetBuffer,
          indexBuffer,
          wrenchBuffer,
          evidenceRead,
          frameRead,
          invariantRead
        ]) buffer.destroy();
        return {
          name,
          status: pass ? 'pass' : 'fail',
          queueFenceMs,
          evidence: Array.from(evidence),
          residuals,
          position,
          displacement: position.map((value, index) => value - centerOfMass[index]),
          quaternion,
          quaternionNorm: Math.hypot(...quaternion),
          linearMomentum,
          angularMomentum,
          kineticEnergyJ: bitsF32(invariant[19]),
          gpuTimestampEvidence,
          gpuTimestampStageTotals: gpuTimestampEvidence.stageTotals,
          validationError: validationError?.message || null,
          outOfMemoryError: outOfMemoryError?.message || null,
          internalError: internalError?.message || null
        };
      };

      const baseline = await runCase({
        name: 'driven-baseline',
        centerOfMass: [0.25, 0.5, -0.75],
        membershipOrder: [0, 1, 2, 3],
        driven: true,
        acceleration: [0, -9.81, 0]
      });
      const translated = await runCase({
        name: 'translated-100-cells',
        centerOfMass: [100.25, -50.5, 20.75],
        membershipOrder: [0, 1, 2, 3],
        driven: true,
        acceleration: [0, -9.81, 0]
      });
      const permuted = await runCase({
        name: 'permuted-membership',
        centerOfMass: [0.25, 0.5, -0.75],
        membershipOrder: [2, 0, 3, 1],
        driven: true,
        acceleration: [0, -9.81, 0]
      });
      const torqueFree = await runCase({
        name: 'torque-free',
        centerOfMass: [0.25, 0.5, -0.75],
        membershipOrder: [3, 2, 1, 0],
        driven: false,
        acceleration: [0, 0, 0]
      });
      const maxAbsDifference = (left, right) => Math.max(
        ...left.map((value, index) => Math.abs(value - right[index]))
      );
      const metamorphic = {
        translationDisplacementResidual: maxAbsDifference(
          baseline.displacement,
          translated.displacement
        ),
        permutationPositionResidual: maxAbsDifference(baseline.position, permuted.position),
        permutationQuaternionResidual: maxAbsDifference(baseline.quaternion, permuted.quaternion),
        permutationLinearMomentumResidual: maxAbsDifference(
          baseline.linearMomentum,
          permuted.linearMomentum
        ),
        permutationAngularMomentumResidual: maxAbsDifference(
          baseline.angularMomentum,
          permuted.angularMomentum
        )
      };
      const metamorphicPass = metamorphic.translationDisplacementResidual <= 1e-5
        && metamorphic.permutationPositionResidual <= 1e-6
        && metamorphic.permutationQuaternionResidual <= 1e-6
        && metamorphic.permutationLinearMomentumResidual <= 1e-6
        && metamorphic.permutationAngularMomentumResidual <= 1e-6;
      const cases = [baseline, translated, permuted, torqueFree];
      const timestampUnsupported = cases.every(
        (entry) => entry.gpuTimestampEvidence.status === 'inconclusive-unsupported'
      );
      const timestampComplete = cases.every(
        (entry) => entry.gpuTimestampEvidence.status === 'pass'
      );
      const gpuTimestampEvidence = {
        schema: 'peercompute.ulg.native-gpu-timestamp-evidence.v0',
        requested: gpuTimestampProfilingRequested,
        adapterSupported: timestampQuerySupported,
        status: !gpuTimestampProfilingRequested
          ? 'not-requested'
          : (timestampUnsupported
              ? 'inconclusive-unsupported'
              : (timestampComplete ? 'pass' : 'fail')),
        sameSubmissionResolve: cases.every(
          (entry) => entry.gpuTimestampEvidence.sameSubmissionResolve === true
        ),
        missingStageIdsByCase: Object.fromEntries(cases.map((entry) => [
          entry.name,
          entry.gpuTimestampEvidence.missingStageIds
        ])),
        skippedSpanCount: cases.reduce(
          (sum, entry) => sum + Number(entry.gpuTimestampEvidence.skippedSpanCount || 0),
          0
        ),
        invalidSpanCount: cases.reduce(
          (sum, entry) => sum + Number(entry.gpuTimestampEvidence.invalidSpanCount || 0),
          0
        ),
        stageTotals: Object.fromEntries(cases.map((entry) => [
          entry.name,
          entry.gpuTimestampStageTotals
        ]))
      };
      const physicsPass = cases.every(({ status }) => status === 'pass')
        && metamorphicPass
        && uncapturedErrors.length === 0;
      const status = !physicsPass || gpuTimestampEvidence.status === 'fail'
        ? 'fail'
        : (gpuTimestampEvidence.status === 'inconclusive-unsupported'
            ? 'inconclusive-unsupported'
            : 'pass');
      device.destroy();
      return {
        status,
        validationMode: 'manufactured-gpu-invariants-and-metamorphic-executions-no-cpu-solver-oracle',
        cases,
        metamorphic: { ...metamorphic, status: metamorphicPass ? 'pass' : 'fail' },
        gpuTimestampProfilingRequested,
        gpuTimestampEvidence,
        gpuTimestampStageTotals: gpuTimestampEvidence.stageTotals,
        uncapturedErrors
      };
    }, { gpuTimestampProfilingRequested });
    const artifact = {
      schema: 'peercompute.ulg.coherent-solid-frame-probe.v0',
      startedAt,
      completedAt: new Date().toISOString(),
      baseUrl,
      gpuTimestampProfilingRequested,
      ...result
    };
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(artifact)}\n`);
    if (artifact.status === 'fail') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
