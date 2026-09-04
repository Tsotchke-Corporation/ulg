import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_DISPERSED_MEDIUM_OPTICS_PRODUCER === '1';
const NATIVE_BASE_URL =
  process.env.ULG_DISPERSED_MEDIUM_OPTICS_PRODUCER_BASE_URL
  || 'http://127.0.0.1:5173/';
const NATIVE_CHROME =
  process.env.ULG_DISPERSED_MEDIUM_OPTICS_PRODUCER_CHROME
  || '/usr/bin/google-chrome';

function assertFloatRowsClose(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: row length`);
  for (let index = 0; index < expected.length; index += 1) {
    const tolerance = Math.max(1e-6, Math.abs(expected[index]) * 2e-5);
    assert.ok(
      Number.isFinite(actual[index])
        && Math.abs(actual[index] - expected[index]) <= tolerance,
      `${label}: lane ${index} expected ${expected[index]}, received ${actual[index]}`
    );
  }
}

test('native dispersed-medium optics producer executes generalized WebGPU stages with CPU parity', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_DISPERSED_MEDIUM_OPTICS_PRODUCER=1 for native Vulkan WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: NATIVE_CHROME,
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
    const page = await browser.newPage();
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'adapter-unavailable' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const producer = await import(
        `/src/runtime/sph/sphDispersedMediumOpticsProducerGpu.js?native=${Date.now()}`
      );
      const opticalClosure = await import(
        '/src/runtime/sph/sphDispersedMediumOpticalClosure.js'
      );
      const deviceIdentity = await import(
        '/src/runtime/sph/sphGpuDeviceIdentity.js'
      );
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const shaderSpecs = [
        {
          entryPoints: ['capture_reaction_births'],
          label: 'ulg-dispersed-medium-optics-reaction-capture-native-gate',
          code: producer.sphDispersedMediumOpticsReactionCaptureWgsl
        },
        {
          entryPoints: ['preflight', 'apply_production'],
          label: 'ulg-dispersed-medium-optics-producer-native-gate',
          code: producer.sphDispersedMediumOpticsProducerWgsl
        }
      ];
      const shaders = [];
      const compilationErrors = [];
      for (const spec of shaderSpecs) {
        const shader = device.createShaderModule({
          label: spec.label,
          code: spec.code
        });
        shaders.push({ spec, shader });
        const compilation = await shader.getCompilationInfo();
        compilationErrors.push(...compilation.messages
          .filter((message) => message.type === 'error')
          .map((message) => ({
            shader: spec.label,
            lineNum: message.lineNum,
            linePos: message.linePos,
            message: message.message
          })));
      }
      const pipelineResults = [];
      if (compilationErrors.length === 0) {
        for (const { spec, shader } of shaders) {
          for (const entryPoint of spec.entryPoints) {
            try {
              await device.createComputePipelineAsync({
                label: `ulg-dispersed-medium-optics-${entryPoint}`,
                layout: 'auto',
                compute: { module: shader, entryPoint }
              });
              pipelineResults.push({ entryPoint, status: 'ready' });
            } catch (error) {
              pipelineResults.push({
                entryPoint,
                status: 'pipeline-failed',
                error: error?.message || String(error)
              });
            }
          }
        }
      }

      const executeProducer = async () => {
        if (compilationErrors.length > 0) {
          return { status: 'compile-failed', compilationErrors, pipelineResults };
        }
        if (pipelineResults.some((result) => result.status !== 'ready')) {
          return { status: 'pipeline-failed', compilationErrors, pipelineResults };
        }

        const stateRowFloats = abi.SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
        const thermoRowFloats = abi.SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
        const opticsRowFloats = abi.SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS;
        const lineageCapacity = 2;
        const particleCount = lineageCapacity * 4;
        const phaseCarrierPlan = {
          schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
          status: 'phase-lane-capacity-ready',
          lineageCapacity,
          primaryCapacity: lineageCapacity,
          phaseLaneCount: 4,
          phaseLaneStride: lineageCapacity,
          companionStart: lineageCapacity,
          companionCapacity: lineageCapacity * 3,
          particleCapacity: particleCount,
          stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
          phaseCompanionLanesRequired: true
        };
        const liquidPhaseId = 2;
        const gasPhaseId = 3;
        const closureTable =
          opticalClosure.buildSphDispersedMediumOpticalClosureTable([{
            dispersedMaterialId: 11,
            vaporPhaseId: gasPhaseId,
            condensedPhaseId: liquidPhaseId,
            opticalStateId: 101,
            morphologyModelId:
              abi.SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL
                .monodisperseRadius,
            condensedDensityKgPerM3: 1_000,
            scatteringEfficiencyQsca: 2,
            absorptionEfficiencyQabs: 0.1,
            asymmetryFactorG: 0.85,
            effectiveRadiusM: 1e-6
          }]);
        const seed = producer.buildSphDispersedMediumOpticsProducerSeedRows({
          phaseCarrierPlan,
          lineageMaterialIds: new Float32Array([11, 33]),
          opticalClosureTable: closureTable
        });
        const preState = new Float32Array(particleCount * stateRowFloats);
        const preThermo = new Float32Array(particleCount * thermoRowFloats);
        const postState = new Float32Array(particleCount * stateRowFloats);
        const postThermo = new Float32Array(particleCount * thermoRowFloats);
        const lineageMaterials = [11, 33];
        const laneIndex = (phaseId, lineageIndex) => (
          (phaseId - 1) * lineageCapacity + lineageIndex
        );
        const setCarrier = ({
          state,
          thermo,
          index,
          materialId,
          phaseId,
          massKg,
          fractions
        }) => {
          state.set(
            [index, index * 0.25, -index, massKg, 0, 0, 0, 1],
            index * stateRowFloats
          );
          thermo.set([
            materialId,
            phaseId,
            300,
            phaseId === gasPhaseId ? 1 : 1_000,
            ...fractions,
            0.1,
            massKg > 0 ? 1 : 0,
            1,
            0.01
          ], index * thermoRowFloats);
        };
        for (let phaseId = 1; phaseId <= 4; phaseId += 1) {
          for (let lineageIndex = 0;
            lineageIndex < lineageCapacity;
            lineageIndex += 1) {
            const index = laneIndex(phaseId, lineageIndex);
            const carrier = {
              index,
              materialId: lineageMaterials[lineageIndex],
              phaseId,
              massKg: 0,
              fractions: [0, 0, 0, 0]
            };
            setCarrier({ state: preState, thermo: preThermo, ...carrier });
            setCarrier({ state: postState, thermo: postThermo, ...carrier });
          }
        }
        setCarrier({
          state: preState,
          thermo: preThermo,
          index: laneIndex(gasPhaseId, 0),
          materialId: 11,
          phaseId: gasPhaseId,
          massKg: 8,
          fractions: [0, 0.25, 0.75, 0]
        });
        setCarrier({
          state: postState,
          thermo: postThermo,
          index: laneIndex(liquidPhaseId, 0),
          materialId: 11,
          phaseId: liquidPhaseId,
          massKg: 2,
          fractions: [0, 1, 0, 0]
        });
        setCarrier({
          state: postState,
          thermo: postThermo,
          index: laneIndex(gasPhaseId, 0),
          materialId: 11,
          phaseId: gasPhaseId,
          massKg: 6,
          fractions: [0, 0, 1, 0]
        });

        const reference =
          producer.deriveSphDispersedMediumOpticsProducerReference({
            phaseCarrierPlan,
            preTransferState: preState,
            preTransferThermo: preThermo,
            postTransferState: postState,
            postTransferThermo: postThermo,
            seedOpticsRows: seed.rows,
            opticalClosureTable: closureTable
          });
        const ownedBuffers = [];
        const uploadRows = (label, rows) => {
          const buffer = deviceIdentity.tagWebGpuBufferDevice(
            device.createBuffer({
              label,
              size: rows.byteLength,
              usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }),
            device
          );
          ownedBuffers.push(buffer);
          device.queue.writeBuffer(buffer, 0, rows);
          return buffer;
        };
        const identityBuffer = uploadRows(
          'native-optics-identity',
          new Uint32Array(particleCount)
        );
        const preTransferStateBuffer = uploadRows(
          'native-optics-pre-state',
          preState
        );
        const preTransferThermoBuffer = uploadRows(
          'native-optics-pre-thermo',
          preThermo
        );
        const postTransferStateBuffer = uploadRows(
          'native-optics-post-state',
          postState
        );
        const postTransferThermoBuffer = uploadRows(
          'native-optics-post-thermo',
          postThermo
        );
        let stage = null;
        let outputReadback = null;
        let evidenceReadback = null;
        try {
          stage =
            producer.createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
              device,
              phaseCarrierPlan,
              particleLineage: {
                particleCount,
                topologyEpoch: 1,
                identityRevision: 'native-optics-numerical-gate-v0',
                identityBuffer
              },
              preTransferStateBuffer,
              preTransferThermoBuffer,
              postTransferStateBuffer,
              postTransferThermoBuffer,
              seedOpticsRows: seed.rows,
              opticalClosureTable: closureTable,
              label: 'ulg-native-dispersed-medium-optics-numerical-gate'
            });
          outputReadback = device.createBuffer({
            label: 'native-optics-output-readback',
            size: stage.outputBufferByteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          evidenceReadback = device.createBuffer({
            label: 'native-optics-evidence-readback',
            size: stage.evidenceBufferByteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
          });
          const encoder = device.createCommandEncoder({
            label: 'native-optics-numerical-gate'
          });
          stage.encode(encoder);
          encoder.copyBufferToBuffer(
            stage.outputBuffer,
            0,
            outputReadback,
            0,
            stage.outputBufferByteLength
          );
          encoder.copyBufferToBuffer(
            stage.evidenceBuffer,
            0,
            evidenceReadback,
            0,
            stage.evidenceBufferByteLength
          );
          device.queue.submit([encoder.finish()]);
          stage.markSubmittedWork({
            commandSubmissionCount: 1,
            owningCommandSubmissionOrdinal: 1,
            submittedStepCount: 1
          });
          await Promise.all([
            outputReadback.mapAsync(GPUMapMode.READ),
            evidenceReadback.mapAsync(GPUMapMode.READ)
          ]);
          const gpuRows = Array.from(new Float32Array(
            outputReadback.getMappedRange()
          ));
          const evidenceWords = Array.from(new Uint32Array(
            evidenceReadback.getMappedRange()
          ));
          outputReadback.unmap();
          evidenceReadback.unmap();
          return {
            status: 'ok',
            compilationErrors,
            pipelineResults,
            dispatch: {
              status: stage.result.status,
              backend: stage.result.backend,
              encodedDispatchCount: stage.result.encodedDispatchCount,
              productionDispatchWorkgroupCount:
                stage.result.productionDispatchWorkgroupCount,
              rowCount: stage.result.rowCount,
              readyRowCount: stage.result.readyRowCount,
              blockedRowCount: stage.result.blockedRowCount,
              readyRowIndex: laneIndex(liquidPhaseId, 0),
              blockedRowIndex: laneIndex(liquidPhaseId, 1),
              blockedStatus: abi.SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked,
              opticsRowFloats,
              gpuRows,
              referenceRows: Array.from(reference.rows),
              evidenceWords,
              conservation: {
                status: reference.status,
                gasToCondensedMassKg: reference.gasToCondensedMassKg,
                condensedToGasMassKg: reference.condensedToGasMassKg,
                totalDispersedMassKg: reference.totalDispersedMassKg,
                condensationRowCount: reference.condensationRowCount,
                evaporationRowCount: reference.evaporationRowCount,
                invalidInputRowCount: reference.invalidInputRowCount
              }
            }
          };
        } finally {
          try { stage?.cleanupSubmittedWork(); } catch {}
          try { stage?.cleanupRetainedOutput(); } catch {}
          try { outputReadback?.destroy(); } catch {}
          try { evidenceReadback?.destroy(); } catch {}
          for (const buffer of ownedBuffers) {
            try { buffer.destroy(); } catch {}
          }
        }
      };

      let result;
      try {
        result = await executeProducer();
      } catch (error) {
        result = {
          status: 'dispatch-failed',
          compilationErrors,
          pipelineResults,
          error: error?.stack || error?.message || String(error)
        };
      }
      const validationError = await device.popErrorScope();
      return {
        ...result,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native));
  assert.deepEqual(native.pipelineResults, [
    { entryPoint: 'capture_reaction_births', status: 'ready' },
    { entryPoint: 'preflight', status: 'ready' },
    { entryPoint: 'apply_production', status: 'ready' }
  ], JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));
  assert.equal(
    native.dispatch.status,
    'dispersed-medium-optics-producer-submitted',
    JSON.stringify(native)
  );
  assert.equal(native.dispatch.backend, 'webgpu');
  assert.equal(native.dispatch.encodedDispatchCount, 2);
  assert.equal(native.dispatch.productionDispatchWorkgroupCount, 1);
  assert.equal(native.dispatch.rowCount, 8);
  assert.equal(native.dispatch.readyRowCount, 1);
  assert.equal(native.dispatch.blockedRowCount, 7);
  assert.deepEqual(native.dispatch.conservation, {
    status: 'dispersed-medium-optics-producer-reference-ready',
    gasToCondensedMassKg: 2,
    condensedToGasMassKg: 0,
    totalDispersedMassKg: 2,
    condensationRowCount: 1,
    evaporationRowCount: 0,
    invalidInputRowCount: 0
  });
  assertFloatRowsClose(
    native.dispatch.gpuRows,
    native.dispatch.referenceRows,
    'native producer output versus CPU reference'
  );
  const readyOffset = native.dispatch.readyRowIndex
    * native.dispatch.opticsRowFloats;
  const blockedOffset = native.dispatch.blockedRowIndex
    * native.dispatch.opticsRowFloats;
  assert.deepEqual(
    native.dispatch.gpuRows.slice(readyOffset, readyOffset + 5),
    [11, 2, 101, 1, 2]
  );
  assert.ok(native.dispatch.gpuRows[readyOffset + 5] > 0);
  assert.ok(native.dispatch.gpuRows[readyOffset + 6] > 0);
  assert.ok(native.dispatch.gpuRows[readyOffset + 7] > 0);
  assert.deepEqual(
    native.dispatch.gpuRows.slice(blockedOffset, blockedOffset + 8),
    [0, 0, 0, native.dispatch.blockedStatus, 0, 0, 0, 0]
  );
  assert.equal(native.dispatch.evidenceWords[2], 0, 'GPU preflight/error mask');
  assert.deepEqual(native.dispatch.evidenceWords.slice(3, 9), [
    1,
    1,
    0,
    1,
    7,
    0
  ]);
});
