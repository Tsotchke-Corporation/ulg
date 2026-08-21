import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_TRANSPORT === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_VOLUME_TRANSPORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

test('native S9 surface-stress dispatch updates sealed scratch reciprocally and rolls back malformed authority', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_VOLUME_SURFACE_STRESS_TRANSPORT=1 for native WebGPU',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_VOLUME_TRANSPORT_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const [
        fieldAbi,
        momentAbi,
        transportAbi,
        shaderModule,
        materialDerivationModule,
        materialTableModule
      ] =
        await Promise.all([
          import(
            `/ulg-gpu-abi/src/schroederSpatialMechanicsFieldView.js?surfaceTransport=${nonce}`
          ),
          import(
            `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeMoment.js?surfaceTransport=${nonce}`
          ),
          import(
            `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeTransport.js?surfaceTransport=${nonce}`
          ),
          import(
            `/ulg-gpu-abi/src/schroederSpatialPhaseVolumeSurfaceStressTransportWgsl.js?surfaceTransport=${nonce}`
          ),
          import(
            `/src/runtime/material/materialDerivation.js?surfaceTransport=${nonce}`
          ),
          import(
            `/src/runtime/sph/sphMechanicsMaterialTable.js?surfaceTransport=${nonce}`
          )
        ]);
      const shader = device.createShaderModule({
        label: 'native-s9-surface-stress-transport',
        code:
          shaderModule.schroederSpatialPhaseVolumeSurfaceStressTransportWgsl
      });
      const compilation = await shader.getCompilationInfo();
      const compilationErrors = compilation.messages
        .filter((message) => message.type === 'error')
        .map((message) => `${message.lineNum}: ${message.message}`);
      if (compilationErrors.length > 0) {
        return { status: 'shader-error', compilationErrors };
      }
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' }
          },
          ...[4, 5].map((binding) => ({
            binding,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'read-only-storage' }
          })),
          {
            binding: 6,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' }
          },
          {
            binding: 7,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' }
          }
        ]
      });
      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      });
      const pipelines = {};
      for (const entryPoint of [
        'initialize_surface_stress',
        'stage_surface_stress_x_even',
        'stage_surface_stress_x_odd',
        'stage_surface_stress_y_even',
        'stage_surface_stress_y_odd',
        'stage_surface_stress_z_even',
        'stage_surface_stress_z_odd',
        'stage_surface_stress_xy_positive_even',
        'stage_surface_stress_xy_positive_odd',
        'stage_surface_stress_xy_negative_even',
        'stage_surface_stress_xy_negative_odd',
        'stage_surface_stress_xz_positive_even',
        'stage_surface_stress_xz_positive_odd',
        'stage_surface_stress_xz_negative_even',
        'stage_surface_stress_xz_negative_odd',
        'stage_surface_stress_yz_positive_even',
        'stage_surface_stress_yz_positive_odd',
        'stage_surface_stress_yz_negative_even',
        'stage_surface_stress_yz_negative_odd',
        'validate_surface_stress',
        'commit_surface_stress'
      ]) {
        try {
          pipelines[entryPoint] = await device.createComputePipelineAsync({
            label: `native-s9-surface-stress-${entryPoint}`,
            layout: pipelineLayout,
            compute: {
              module: shader,
              entryPoint
            }
          });
        } catch (error) {
          const lost = await Promise.race([
            device.lost,
            new Promise((resolve) => setTimeout(() => resolve(null), 1_000))
          ]);
          return {
            status: 'pipeline-error',
            entryPoint,
            error: error?.message || String(error),
            deviceLost: lost
              ? { reason: lost.reason, message: lost.message }
              : null
          };
        }
      }
      const f32Bits = (value) => {
        const bytes = new ArrayBuffer(4);
        const view = new DataView(bytes);
        view.setFloat32(0, value, true);
        return view.getUint32(0, true);
      };
      const bitsF32 = (value) => {
        const bytes = new ArrayBuffer(4);
        const view = new DataView(bytes);
        view.setUint32(0, value >>> 0, true);
        return view.getFloat32(0, true);
      };
      const identity = {
        generationId: 17,
        storageGeneration: 11,
        physicsTick: 13,
        physicsSubstep: 1,
        positionEpoch: 19,
        topologyEpoch: 23,
        chartEpoch: 29,
        levelEpoch: 31,
        supportEpoch: 37
      };
      const fieldCapacity = 2;
      const fieldCount = 2;
      const fieldCompletionOrdinal = 41;
      const mutationOutputOrdinal = 2;
      const fieldLayout =
        fieldAbi.createSchroederSpatialMechanicsFieldViewLayout({
          sourceCapacity: 1,
          fieldCapacity
        });

      const makeFieldWords = ({ phaseId = 2, nodes = [2, 3] } = {}) => {
        const words = new Uint32Array(fieldLayout.wordLength);
        words[0] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
        words[1] = fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
        words[2] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_READY
          | fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_STATUS_ADMITTED;
        words[3] = identity.generationId;
        words[8] = identity.storageGeneration;
        words[9] = identity.physicsTick;
        words[10] = identity.physicsSubstep;
        words[11] = identity.positionEpoch;
        words[12] = identity.topologyEpoch;
        words[13] = identity.chartEpoch;
        words[14] = identity.levelEpoch;
        words[15] = identity.supportEpoch;
        words[17] = 0;
        words[18] = 8;
        words[23] = f32Bits(0.01);
        words[26] = fieldLayout.keyOffsetWords;
        words[27] = fieldLayout.keyWords;
        words[28] = fieldLayout.accumulatorOffsetWords;
        words[29] = fieldLayout.accumulatorWords;
        words[30] = fieldLayout.stateOffsetWords;
        words[31] = fieldLayout.stateWords;
        words[32] = fieldCapacity;
        words[33] = fieldCount;
        words[34] = fieldCount;
        words[38] = fieldCompletionOrdinal;
        words[57] = 1;
        words[59] =
          fieldAbi.SCHROEDER_SPATIAL_MECHANICS_FIELD_STATE_ENCODING_EMPTY;
        words[60] = 1;
        words[61] = 1;
        words[62] = 1;
        words[63] = mutationOutputOrdinal;
        words.set([nodes[0], phaseId, 26, 0], fieldLayout.keyOffsetWords);
        words.set(
          [nodes[1], phaseId, 26, 0],
          fieldLayout.keyOffsetWords + fieldLayout.keyWords
        );
        words.set([
          f32Bits(0.0078), 0, 0, 0, 0, 0, 0, 1
        ], fieldLayout.stateOffsetWords);
        words.set([
          f32Bits(0.011), 0, 0, 0, 0, 0, 0, 1
        ], fieldLayout.stateOffsetWords + fieldLayout.stateWords);
        return words;
      };
      const makeMoments = ({ phaseId = 2, nodes = [2, 3] } = {}) => {
        const ready =
          momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_READY
          | momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_STATUS_ADMITTED;
        const words = new Uint32Array(
          fieldCapacity
            * momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS
        );
        words.set([
          nodes[0], phaseId, 26, 0,
          f32Bits(1e-6),
          f32Bits(1e-4), 0, 0,
          1, ready, 0, 0
        ]);
        words.set([
          nodes[1], phaseId, 26, 0,
          f32Bits(1e-6),
          f32Bits(7.0710678e-5),
          f32Bits(7.0710678e-5),
          0,
          1, ready, 0, 0
        ], momentAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_MOMENT_ROW_WORDS);
        return words;
      };
      const makeScratch = () => {
        const words = new Uint32Array(
          transportAbi.schroederSpatialPhaseVolumeTransportScratchWordLength(
            fieldCapacity
          )
        );
        words.set(
          transportAbi.createSchroederSpatialPhaseVolumeTransportScratchHeader({
            fieldCapacity,
            generationId: identity.generationId,
            fieldCompletionOrdinal
          })
        );
        for (let field = 0; field < fieldCount; field += 1) {
          const row =
            transportAbi
              .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS
            + field
              * transportAbi
                .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS;
          words[row + 10] =
            transportAbi
              .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY;
          let seal =
            transportAbi
              .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_READY
            ^ field;
          for (let word = 0; word <= 10; word += 1) {
            seal ^= words[row + word];
          }
          words[row + 11] = seal >>> 0;
        }
        return words;
      };
      const makeParams = ({
        corruptShape = false,
        ambientDensity = 0,
        gravityY = 0
      } = {}) => {
        const bytes = new ArrayBuffer(
          transportAbi.SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_PARAMS_BYTES
        );
        const view = new DataView(bytes);
        const u32 = (word, value) => view.setUint32(word * 4, value, true);
        const i32 = (word, value) => view.setInt32(word * 4, value, true);
        const f32 = (word, value) => view.setFloat32(word * 4, value, true);
        u32(0, corruptShape ? 9 : 8);
        u32(1, 2);
        u32(2, 2);
        u32(3, 2);
        u32(7, mutationOutputOrdinal);
        f32(8, 0.01);
        f32(9, 1e-4);
        f32(11, gravityY);
        f32(16, 0.4);
        u32(20, 1);
        u32(21, 1);
        i32(22, 0);
        u32(23, fieldCapacity);
        u32(25, identity.generationId);
        u32(26, fieldCompletionOrdinal);
        i32(29, 0);
        i32(30, 1);
        u32(31, 0);
        f32(33, ambientDensity);
        f32(36, 0.5);
        u32(40, identity.storageGeneration);
        u32(41, identity.physicsTick);
        u32(42, identity.physicsSubstep);
        u32(43, identity.positionEpoch);
        u32(44, identity.topologyEpoch);
        u32(45, identity.chartEpoch);
        u32(46, identity.levelEpoch);
        u32(47, identity.supportEpoch);
        u32(48, 1);
        return bytes;
      };
      const makeMaterial = (sigma, phaseId = 2) => new Float32Array([
        26, phaseId, 7800, 0,
        0, 0, 3, 0,
        0, 1, 0, sigma
      ]);
      const productionFeProperties =
        materialDerivationModule
          .createReferenceAnchoredMaterialClosure('fe').properties;
      const productionMaterialTable =
        materialTableModule.buildMlsMpmMechanicsMaterialTable(
          { fe: productionFeProperties },
          { surfaceTensionEnabled: true }
        );
      const productionSigma =
        materialTableModule.findMechanicsMaterialPhaseRecord(
          productionMaterialTable,
          26,
          2
        ).surfaceTensionNPerM;
      const usage =
        GPUBufferUsage.STORAGE
        | GPUBufferUsage.COPY_DST
        | GPUBufferUsage.COPY_SRC;
      const upload = (data, bufferUsage = usage) => {
        const buffer = device.createBuffer({
          size: Math.max(4, (data.byteLength + 3) & ~3),
          usage: bufferUsage
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
      };

      const runCase = async ({
        sigma,
        corruptShape = false,
        phaseId = 2,
        nodes = [2, 3],
        ambientDensity = 0,
        gravityY = 0,
        entryPoint = 'stage_surface_stress_z_even'
      }) => {
        const scratchInput = makeScratch();
        const field = upload(makeFieldWords({ phaseId, nodes }));
        const moments = upload(makeMoments({ phaseId, nodes }));
        const material = upload(makeMaterial(sigma, phaseId));
        const params = upload(
          makeParams({ corruptShape, ambientDensity, gravityY }),
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const scratch = upload(scratchInput);
        const readback = device.createBuffer({
          size: scratchInput.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: field } },
            { binding: 4, resource: { buffer: moments } },
            { binding: 5, resource: { buffer: material } },
            { binding: 6, resource: { buffer: params } },
            { binding: 7, resource: { buffer: scratch } }
          ]
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipelines[entryPoint]);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
        encoder.copyBufferToBuffer(
          scratch,
          0,
          readback,
          0,
          scratchInput.byteLength
        );
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const output = new Uint32Array(
          readback.getMappedRange().slice(0)
        );
        readback.unmap();
        const rows = [0, 1].map((fieldIndex) => {
          const row =
            transportAbi
              .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_HEADER_WORDS
            + fieldIndex
              * transportAbi
                .SCHROEDER_SPATIAL_PHASE_VOLUME_TRANSPORT_SCRATCH_ROW_WORDS;
          return {
            velocity: [
              bitsF32(output[row]),
              bitsF32(output[row + 1]),
              bitsF32(output[row + 2])
            ],
            compensationJ: bitsF32(output[row + 5]),
            ambientImpulseNs: [
              bitsF32(output[row + 6]),
              bitsF32(output[row + 7]),
              bitsF32(output[row + 8])
            ],
            ambientWorkJ: bitsF32(output[row + 9]),
            status: output[row + 10],
            seal: output[row + 11]
          };
        });
        const result = {
          failure: output[2],
          rows,
          scratchUnchanged:
            output.every((value, index) => value === scratchInput[index])
        };
        for (const buffer of [
          field,
          moments,
          material,
          params,
          scratch,
          readback
        ]) {
          buffer.destroy();
        }
        return result;
      };

      const active = await runCase({ sigma: productionSigma });
      const diagonal = await runCase({
        sigma: productionSigma,
        nodes: [0, 6],
        entryPoint: 'stage_surface_stress_xy_positive_even'
      });
      const zero = await runCase({ sigma: 0 });
      const ambientGas = await runCase({
        sigma: 0,
        phaseId: 3,
        ambientDensity: 1.2041,
        gravityY: -9.80665,
        entryPoint: 'initialize_surface_stress'
      });
      const malformed = await runCase({ sigma: 1.9, corruptShape: true });
      const validationError = await device.popErrorScope();
      device.destroy();
      return {
        status: 'executed',
        productionMaterialEvidence: {
          sigma: productionSigma,
          positiveSurfaceTensionPhaseRecordCount:
            productionMaterialTable.positiveSurfaceTensionPhaseRecordCount,
          coefficientStatus:
            productionMaterialTable.surfaceTensionCoefficientStatus
        },
        active,
        diagonal,
        zero,
        ambientGas,
        malformed,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'executed', JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));
  assert.equal(
    native.productionMaterialEvidence.sigma,
    Math.fround(1.9),
    JSON.stringify(native)
  );
  assert.equal(
    native.productionMaterialEvidence.positiveSurfaceTensionPhaseRecordCount,
    1,
    JSON.stringify(native)
  );
  assert.equal(
    native.productionMaterialEvidence.coefficientStatus,
    'positive-surface-tension-coefficient-ready',
    JSON.stringify(native)
  );

  assert.equal(native.active.failure, 0, JSON.stringify(native));
  const [left, right] = native.active.rows;
  assert.ok(Math.hypot(...left.velocity) > 0);
  assert.ok(Math.hypot(...right.velocity) > 0);
  const momentum = [
    0.0078 * left.velocity[0] + 0.011 * right.velocity[0],
    0.0078 * left.velocity[1] + 0.011 * right.velocity[1],
    0.0078 * left.velocity[2] + 0.011 * right.velocity[2]
  ];
  assert.ok(Math.hypot(...momentum) <= 2e-10, JSON.stringify(momentum));
  const kineticAfter =
    0.5 * 0.0078 * left.velocity.reduce(
      (sum, value) => sum + value * value,
      0
    )
    + 0.5 * 0.011 * right.velocity.reduce(
      (sum, value) => sum + value * value,
      0
    );
  const closure =
    kineticAfter + left.compensationJ + right.compensationJ;
  assert.ok(Math.abs(closure) <= 2e-10, JSON.stringify({
    kineticAfter,
    left,
    right,
    closure
  }));
  assert.notEqual(left.seal, 0);
  assert.notEqual(right.seal, 0);

  assert.equal(native.diagonal.failure, 0, JSON.stringify(native.diagonal));
  const [diagonalLeft, diagonalRight] = native.diagonal.rows;
  const diagonalImpulse = diagonalLeft.velocity.map(
    (value) => 0.0078 * value
  );
  const diagonalMomentum = diagonalImpulse.map(
    (value, index) => value + 0.011 * diagonalRight.velocity[index]
  );
  assert.ok(
    Math.hypot(...diagonalMomentum) <= 2e-10,
    JSON.stringify({ diagonalImpulse, diagonalMomentum })
  );
  const diagonalPairTorque = [
    diagonalImpulse[2],
    -diagonalImpulse[2],
    diagonalImpulse[1] - diagonalImpulse[0]
  ];
  assert.ok(
    Math.hypot(...diagonalPairTorque) <= 2e-10,
    JSON.stringify({ diagonalImpulse, diagonalPairTorque })
  );

  assert.equal(native.zero.failure, 0);
  assert.equal(native.zero.scratchUnchanged, true);
  assert.equal(native.ambientGas.failure, 0, JSON.stringify(native));
  assert.equal(native.ambientGas.scratchUnchanged, false, JSON.stringify(native));
  for (const row of native.ambientGas.rows) {
    assert.ok(row.velocity[1] > 0, JSON.stringify(native.ambientGas));
    assert.equal(row.ambientImpulseNs[0], 0);
    assert.ok(row.ambientImpulseNs[1] > 0, JSON.stringify(native.ambientGas));
    assert.equal(row.ambientImpulseNs[2], 0);
    assert.ok(row.ambientWorkJ > 0, JSON.stringify(native.ambientGas));
  }
  assert.equal(native.malformed.failure, 1);
  assert.equal(native.malformed.rows[0].velocity[0], 0);
  assert.equal(native.malformed.rows[1].velocity[0], 0);
});
