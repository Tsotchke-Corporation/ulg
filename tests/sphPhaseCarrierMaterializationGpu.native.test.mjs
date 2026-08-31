import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_PHASE_CARRIER_MATERIALIZATION === '1';
const NATIVE_BASE_URL =
  process.env.ULG_PHASE_CARRIER_MATERIALIZATION_BASE_URL
  || 'https://127.0.0.1:5174/';

const STATE_FLOATS = 8;
const THERMO_FLOATS = 12;
const MECHANICS_FLOATS = 32;
const RESERVED_STATUS = 254;

function expectedTerminalFamily(source) {
  const sourceCount = source.identity.length;
  const terminalCount = sourceCount * 4;
  const state = new Float32Array(terminalCount * STATE_FLOATS);
  const thermo = new Float32Array(terminalCount * THERMO_FLOATS);
  const mechanics = new Float32Array(terminalCount * MECHANICS_FLOATS);
  const identity = new Uint32Array(terminalCount);
  for (let lane = 0; lane < 4; lane += 1) {
    for (let sourceIndex = 0; sourceIndex < sourceCount; sourceIndex += 1) {
      const terminalIndex = lane * sourceCount + sourceIndex;
      const sourceStateBase = sourceIndex * STATE_FLOATS;
      const terminalStateBase = terminalIndex * STATE_FLOATS;
      const sourceThermoBase = sourceIndex * THERMO_FLOATS;
      const terminalThermoBase = terminalIndex * THERMO_FLOATS;
      const sourceMechanicsBase = sourceIndex * MECHANICS_FLOATS;
      const terminalMechanicsBase = terminalIndex * MECHANICS_FLOATS;
      identity[terminalIndex] = source.identity[sourceIndex];
      if (lane === 0) {
        state.set(
          source.state.slice(sourceStateBase, sourceStateBase + STATE_FLOATS),
          terminalStateBase
        );
        thermo.set(
          source.thermo.slice(
            sourceThermoBase,
            sourceThermoBase + THERMO_FLOATS
          ),
          terminalThermoBase
        );
        mechanics.set(
          source.mechanics.slice(
            sourceMechanicsBase,
            sourceMechanicsBase + MECHANICS_FLOATS
          ),
          terminalMechanicsBase
        );
        continue;
      }
      state.set([
        source.state[sourceStateBase],
        source.state[sourceStateBase + 1],
        source.state[sourceStateBase + 2],
        0,
        0,
        0,
        0,
        source.state[sourceStateBase + 7]
      ], terminalStateBase);
      thermo.set(
        source.thermo.slice(sourceThermoBase, sourceThermoBase + 8),
        terminalThermoBase
      );
      thermo.set([
        source.thermo[sourceThermoBase + 8],
        0,
        RESERVED_STATUS,
        0
      ], terminalThermoBase + 8);
      mechanics.set(
        source.mechanics.slice(
          sourceMechanicsBase,
          sourceMechanicsBase + MECHANICS_FLOATS
        ),
        terminalMechanicsBase
      );
      mechanics[terminalMechanicsBase + 19] = 0;
      mechanics[terminalMechanicsBase + 21] = RESERVED_STATUS;
      mechanics[terminalMechanicsBase + 27] = RESERVED_STATUS;
      mechanics[terminalMechanicsBase + 31] = 0;
    }
  }
  return { state, thermo, mechanics, identity };
}

test('native WebGPU deterministically materializes one lane into an exact 4N carrier family', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_PHASE_CARRIER_MATERIALIZATION=1 for native WebGPU',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath:
      process.env.ULG_PHASE_CARRIER_MATERIALIZATION_CHROME
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
      if (!navigator.gpu) {
        return { status: 'unsupported', reason: 'navigator.gpu unavailable' };
      }
      const adapter = await navigator.gpu.requestAdapter({
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
      const materializer = await import(
        `/src/runtime/sph/sphPhaseCarrierMaterializationGpu.js?nativeOneToFour=${nonce}`
      );
      const identityAuthority = await import(
        '/src/runtime/sph/sphGpuDeviceIdentity.js'
      );
      const buffersAbi = await import('/src/runtime/sph/sphGpuBuffers.js');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const phaseTransfer = await import(
        `/src/runtime/sph/sphPhaseCarrierTransferGpu.js?nativeOneToFour=${nonce}`
      );
      const mechanicsMaterialTable = await import(
        `/src/runtime/sph/sphMechanicsMaterialTable.js?nativeOneToFour=${nonce}`
      );

      const sourceCount = 2;
      const state = new Float32Array([
        1.25, 2.5, 3.75, 4.5, 5.25, 6.5, 7.75, 286_500,
        9.25, 10.5, 11.75, 12.5, 13.25, 14.5, 15.75, 319_800
      ]);
      const thermo = new Float32Array([
        1, 1, 273.15, 917, 0.5, 0.5, 0, 0, 0.25, 1, 1, 0.1,
        1, 1, 273.15, 917, 0.4, 0.6, 0, 0, 0.3, 2, 1, 0.15
      ]);
      const mechanics = new Float32Array(sourceCount * 32);
      for (let index = 0; index < mechanics.length; index += 1) {
        mechanics[index] = index + 0.5;
      }
      for (let sourceIndex = 0; sourceIndex < sourceCount; sourceIndex += 1) {
        const base = sourceIndex * 32;
        mechanics[base] = 1;
        mechanics[base + 5] = 1;
        mechanics[base + 10] = 1;
        mechanics[base + 18] = 1;
        mechanics[base + 19] = state[sourceIndex * 8 + 3] / 917;
        mechanics[base + 20] = 1;
        mechanics[base + 21] = 1;
        mechanics[base + 26] = 1;
        mechanics[base + 27] = 1;
        mechanics[base + 31] = state[sourceIndex * 8 + 3];
      }
      const identity = new Uint32Array([17, 29]);
      const lineage = {
        storageGeneration: 7,
        physicsTick: 41,
        physicsSubstep: 0,
        positionEpoch: 12,
        topologyEpoch: 3,
        chartEpoch: 5,
        levelEpoch: 9,
        supportEpoch: 11
      };
      const phaseCarrierPlan = {
        schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
        status: 'phase-lane-capacity-ready',
        lineageCapacity: sourceCount,
        primaryCapacity: sourceCount,
        phaseLaneCount: 1,
        phaseLaneStride: sourceCount,
        companionStart: sourceCount,
        companionCapacity: 0,
        particleCapacity: sourceCount,
        stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
        phaseCompanionLanesRequired: false,
        reason: 'laws-quiescent-no-phase-mutation-path'
      };
      const upload = (label, values) => {
        const buffer = device.createBuffer({
          label,
          size: values.byteLength,
          usage:
            GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_DST
            | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(buffer, 0, values);
        identityAuthority.tagWebGpuBufferDevice(buffer, device);
        return buffer;
      };
      const stateBuffer = upload('one-to-four-source-state', state);
      const thermoBuffer = upload('one-to-four-source-thermo', thermo);
      const mechanicsBuffer = upload(
        'one-to-four-source-mechanics',
        mechanics
      );
      const identityBuffer = upload('one-to-four-source-identity', identity);
      const sphParticleState = {
        schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
        particleCount: sourceCount,
        phaseCarrierPlan,
        identityRevision: 'native-identity-seed',
        state,
        thermo,
        ...lineage
      };
      const mlsMpmParticleState = {
        schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
        particleCount: sourceCount,
        phaseCarrierPlan,
        mechanics,
        ...lineage
      };
      const sphParticleUpload = {
        schema: buffersAbi.ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
        status: 'webgpu-uploaded',
        destroyed: false,
        particleCount: sourceCount,
        phaseCarrierPlan,
        stateBuffer,
        thermoBuffer,
        identityBuffer,
        stateBufferByteLength: state.byteLength,
        thermoBufferByteLength: thermo.byteLength,
        identityBufferByteLength: identity.byteLength,
        identitySchema:
          buffersAbi.ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
        identityStrideBytes: 4,
        identityRevision: 'native-identity-seed',
        bufferFamilyGeneration: lineage.storageGeneration,
        ...lineage
      };
      const mlsMpmParticleUpload = {
        schema: buffersAbi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
        status: 'webgpu-uploaded',
        destroyed: false,
        particleCount: sourceCount,
        phaseCarrierPlan,
        mechanicsBuffer,
        mechanicsBufferByteLength: mechanics.byteLength,
        bufferFamilyGeneration: lineage.storageGeneration,
        ...lineage
      };
      const run = () =>
        materializer.runSphPhaseCarrierOneToFourMaterializationWebGpu({
          device,
          sphParticleState,
          mlsMpmParticleState,
          sphParticleUpload,
          mlsMpmParticleUpload,
          phaseCarrierPlan,
          submittedWorkCleanup: 'caller-terminal-fence'
        });
      const first = await run();
      const second = await run();
      const firstValidation =
        materializer.validateSphPhaseCarrierOneToFourExecution(first, {
          device,
          sourceParticleCount: sourceCount,
          sourceLineage: lineage
        });
      const secondValidation =
        materializer.validateSphPhaseCarrierOneToFourExecution(second, {
          device,
          sourceParticleCount: sourceCount,
          sourceLineage: lineage
        });
      const thermalMaterialTable = {
        segments: new Float32Array([
          1, 2, 1, 2,
          120_000, 453_000, 273.15, 273.15,
          917, 1000, 1, 0
        ]),
        records: new Float32Array([1, 0, 1, 1, 0.9, 0, 0, 0])
      };
      const mechanicsTable = {
        schema:
          mechanicsMaterialTable.ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
        records: new Float32Array([
          1, 1, 917, 2e6, 7e5, 1e6, 50, 1, 1, 1, 0, 0,
          1, 2, 1000, 2e6, 0, 0, 45, 1, 0, 1, 0.001, 0.07
        ])
      };
      const transferStage =
        phaseTransfer.createSphPhaseCarrierTransferWebGpuEncoderStage({
          device,
          sphParticleState: first.nextSphParticleState,
          mlsMpmParticleState: first.nextMlsMpmParticleState,
          thermalMaterialTable,
          mechanicsMaterialTable: mechanicsTable,
          phaseCarrierPlan: first.phaseCarrierPlan,
          sourceStateBuffer: first.stateBuffer,
          sourceThermoBuffer: first.thermoBuffer,
          sourceMechanicsBuffer: first.mechanicsBuffer,
          readbackMode: 'no-full-readback',
          retainOutputParticleBuffers: true
        });
      const transferEncoder = device.createCommandEncoder();
      transferStage.encode(transferEncoder);
      device.queue.submit([transferEncoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      first.cleanupSubmittedWork();
      second.cleanupSubmittedWork();
      transferStage.cleanupSubmittedWork();

      const read = async (buffer, byteLength, Type) => {
        const readback = device.createBuffer({
          label: 'one-to-four-native-external-readback',
          size: byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const bytes = readback.getMappedRange().slice(0);
        const values = new Type(bytes);
        const output = Array.from(values);
        const raw = Array.from(new Uint8Array(bytes));
        readback.unmap();
        readback.destroy();
        return { output, raw };
      };
      const readFamily = async (result) => ({
        state: await read(
          result.stateBuffer,
          result.stateBufferByteLength,
          Float32Array
        ),
        thermo: await read(
          result.thermoBuffer,
          result.thermoBufferByteLength,
          Float32Array
        ),
        mechanics: await read(
          result.mechanicsBuffer,
          result.mechanicsBufferByteLength,
          Float32Array
        ),
        identity: await read(
          result.identityBuffer,
          result.identityBufferByteLength,
          Uint32Array
        )
      });
      const firstFamily = await readFamily(first);
      const secondFamily = await readFamily(second);
      const transferFamily = {
        state: await read(
          transferStage.stateBuffer,
          transferStage.stateBufferByteLength,
          Float32Array
        ),
        thermo: await read(
          transferStage.thermoBuffer,
          transferStage.thermoBufferByteLength,
          Float32Array
        ),
        mechanics: await read(
          transferStage.mechanicsBuffer,
          transferStage.mechanicsBufferByteLength,
          Float32Array
        )
      };
      const sourceFamily = {
        state: await read(stateBuffer, state.byteLength, Float32Array),
        thermo: await read(thermoBuffer, thermo.byteLength, Float32Array),
        mechanics: await read(
          mechanicsBuffer,
          mechanics.byteLength,
          Float32Array
        ),
        identity: await read(
          identityBuffer,
          identity.byteLength,
          Uint32Array
        )
      };
      const validationError = await device.popErrorScope();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = {
        status: 'ok',
        firstValidation,
        secondValidation,
        firstFamily,
        secondFamily,
        transferFamily,
        sourceFamily,
        source: {
          state: Array.from(state),
          thermo: Array.from(thermo),
          mechanics: Array.from(mechanics),
          identity: Array.from(identity)
        },
        countSummary: first.countSummary,
        lineage: first.lineage,
        sourceIdentityRevision: first.sourceIdentityRevision,
        terminalIdentityRevision: first.identityRevision,
        identityCorrespondenceRevision: first.identityCorrespondenceRevision,
        materializationKernelRevision: first.materializationKernelRevision,
        commandSubmissionCount: first.commandSubmissionCount,
        fullParticleReadbackPerformed: first.fullParticleReadbackPerformed,
        mapAsyncCount: first.mapAsyncCount,
        readbackBytes: first.readbackBytes,
        routingAuthority: first.routingAuthority,
        dynamicLawRoutingAuthority: first.dynamicLawRoutingAuthority,
        transfer: {
          status: transferStage.result.status,
          particleCount: transferStage.result.particleCount,
          primaryCapacity: transferStage.result.primaryCapacity,
          phaseLaneCount: transferStage.result.phaseLaneCount,
          phaseLaneStride: transferStage.result.phaseLaneStride,
          fullParticleReadbackPerformed:
            transferStage.result.fullParticleReadbackPerformed,
          mapAsyncCount: transferStage.result.mapAsyncCount,
          readbackBytes: transferStage.result.readbackBytes
        },
        validationError: validationError?.message || null,
        uncapturedErrors
      };
      first.destroyOutputParticleBuffers();
      second.destroyOutputParticleBuffers();
      transferStage.cleanupRetainedOutput();
      stateBuffer.destroy();
      thermoBuffer.destroy();
      mechanicsBuffer.destroy();
      identityBuffer.destroy();
      return result;
    });
  } finally {
    await browser.close();
  }

  if (native.status === 'unsupported') {
    assert.fail(native.reason);
  }
  assert.equal(native.status, 'ok');
  assert.equal(native.firstValidation.valid, true, native.firstValidation.failures);
  assert.equal(native.secondValidation.valid, true, native.secondValidation.failures);
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);

  const source = {
    state: Float32Array.from(native.source.state),
    thermo: Float32Array.from(native.source.thermo),
    mechanics: Float32Array.from(native.source.mechanics),
    identity: Uint32Array.from(native.source.identity)
  };
  const expected = expectedTerminalFamily(source);
  assert.deepEqual(native.firstFamily.state.output, Array.from(expected.state));
  assert.deepEqual(native.firstFamily.thermo.output, Array.from(expected.thermo));
  assert.deepEqual(
    native.firstFamily.mechanics.output,
    Array.from(expected.mechanics)
  );
  assert.deepEqual(
    native.firstFamily.identity.output,
    Array.from(expected.identity)
  );
  for (const family of ['state', 'thermo', 'mechanics', 'identity']) {
    assert.deepEqual(
      native.firstFamily[family].raw,
      native.secondFamily[family].raw,
      `${family} output must be bitwise deterministic`
    );
    assert.deepEqual(
      native.sourceFamily[family].output,
      native.source[family],
      `${family} source must remain unchanged`
    );
  }
  assert.equal(native.countSummary.sourceParticleCount, 2);
  assert.equal(native.countSummary.terminalParticleCount, 8);
  assert.equal(native.countSummary.exactCountAuthority, true);
  assert.equal(native.lineage.target.storageGeneration, 8);
  assert.equal(native.lineage.target.topologyEpoch, 4);
  assert.match(native.terminalIdentityRevision, /^native-identity-seed:/);
  assert.match(native.identityCorrespondenceRevision, /lane-major-v0$/);
  assert.match(native.materializationKernelRevision, /reserved-companions-v0$/);
  assert.equal(native.commandSubmissionCount, 1);
  assert.equal(native.fullParticleReadbackPerformed, false);
  assert.equal(native.mapAsyncCount, 0);
  assert.equal(native.readbackBytes, 0);
  assert.equal(native.routingAuthority, false);
  assert.equal(native.dynamicLawRoutingAuthority, false);
  assert.equal(native.transfer.status, 'phase-carrier-transfer-submitted');
  assert.equal(native.transfer.particleCount, 8);
  assert.equal(native.transfer.primaryCapacity, 2);
  assert.equal(native.transfer.phaseLaneCount, 4);
  assert.equal(native.transfer.phaseLaneStride, 2);
  assert.equal(native.transfer.fullParticleReadbackPerformed, false);
  assert.equal(native.transfer.mapAsyncCount, 0);
  assert.equal(native.transfer.readbackBytes, 0);
  for (let sourceIndex = 0; sourceIndex < 2; sourceIndex += 1) {
    let terminalMass = 0;
    let activeLaneCount = 0;
    const laneMasses = [];
    for (let lane = 0; lane < 4; lane += 1) {
      const terminalIndex = lane * 2 + sourceIndex;
      const base = terminalIndex * STATE_FLOATS;
      const mass = native.transferFamily.state.output[base + 3];
      laneMasses.push(mass);
      terminalMass += mass;
      if (mass > 0) {
        activeLaneCount += 1;
        assert.deepEqual(
          native.transferFamily.state.output.slice(base, base + 3),
          native.source.state.slice(
            sourceIndex * STATE_FLOATS,
            sourceIndex * STATE_FLOATS + 3
          )
        );
      }
    }
    const sourceMass = native.source.state[sourceIndex * STATE_FLOATS + 3];
    assert.ok(Math.abs(terminalMass - sourceMass) <= 1e-5);
    assert.equal(activeLaneCount, 2, JSON.stringify(laneMasses));
  }
});
