// Native gate for the interface skin conversion in the f32 phase-carrier
// transfer (plan/todo/interface-resolution.md). One lineage, a liquid carrier
// whose SS thermal proposal row says E joules of the step's heat were latent
// work on its skin at T*. The transfer must move m = E / (u_target - u_pre)
// into the vapor lane at u_target and T*, keep the remainder at u_pre (the
// step's whole heat was that E), and conserve mass, momentum and energy. A
// row stamped with another epoch, or no front source at all, must leave the
// lineage exactly as the established transfer does.
//
// Run: ULG_RUN_NATIVE_INTERFACE_FRONT=1 node --test
//   tests/sphPhaseCarrierInterfaceFront.native.test.mjs
// (HTTPS dev server on 5173; override with ULG_INTERFACE_FRONT_BASE_URL.)
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_INTERFACE_FRONT === '1';
const NATIVE_BASE_URL =
  process.env.ULG_INTERFACE_FRONT_BASE_URL || 'https://127.0.0.1:5173/';

const MASS_KG = 1e-4;
const U_PRE = 1e5;
const SKIN_J = 50;
const U_TARGET = 2.6e6;
const T_STAR = 373.15;
const EPOCH = 41;
const FACE_OFFSET_M = 0.002;

test('interface skin conversion moves exactly the skin mass into the vapor lane', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_INTERFACE_FRONT=1 to run on native WebGPU'
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
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
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    native = await page.evaluate(async (constants) => {
      const { MASS_KG, U_PRE, SKIN_J, U_TARGET, T_STAR, EPOCH, FACE_OFFSET_M } = constants;
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      // The resident lane requests twelve storage buffers per stage
      // (src/runtime/webgpuDeviceLimits.js); the transfer binds nine.
      const device = await adapter.requestDevice({
        requiredLimits: { maxStorageBuffersPerShaderStage: 12 }
      });
      device.pushErrorScope('validation');
      const transfer = await import('/src/runtime/sph/sphPhaseCarrierTransferGpu.js');
      const identity = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const mechanicsTable = await import('/src/runtime/sph/sphMechanicsMaterialTable.js');

      const lineages = 1;
      const particleCount = lineages * 4;
      const plan = {
        schema: transfer.ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA,
        status: 'phase-lane-capacity-ready',
        lineageCapacity: lineages,
        primaryCapacity: lineages,
        phaseLaneCount: 4,
        phaseLaneStride: lineages,
        companionStart: lineages,
        companionCapacity: lineages * 3,
        particleCapacity: particleCount,
        stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
        phaseCompanionLanesRequired: true
      };
      // Liquid lane (phase 2) holds the carrier; its energy already contains
      // the step's whole heat, which was the skin share E.
      const liquidIndex = 1;
      const uAfterApply = U_PRE + SKIN_J / MASS_KG;
      const state = new Float32Array(particleCount * 8);
      const thermo = new Float32Array(particleCount * 12);
      const mechanics = new Float32Array(particleCount * 32);
      for (let index = 0; index < particleCount; index += 1) {
        const live = index === liquidIndex;
        state.set([1, 1, 1, live ? MASS_KG : 0, live ? 0.1 : 0, 0, 0, live ? uAfterApply : 0], index * 8);
        const phase = index + 1;
        thermo.set([
          1, phase, live ? 300 : 0, phase === 3 ? 0.6 : 1000,
          phase === 1 ? 1 : 0, phase === 2 ? 1 : 0, phase === 3 ? 1 : 0, phase === 4 ? 1 : 0,
          0.005, live ? 1 : 0, live ? 1 : 254, live ? 0.0023 : 0
        ], index * 12);
        // F = I, row 4 = (.., .., J, V0), rows 5/6 constitutive tags, row 7 mass.
        mechanics.set([1, 0, 0, 0], index * 32);
        mechanics.set([0, 1, 0, 0], index * 32 + 4);
        mechanics.set([0, 0, 1, 0], index * 32 + 8);
        mechanics.set([0, 0, 1, live ? 1e-7 : 1e-7], index * 32 + 16);
        mechanics.set([0, 1, 0, 0], index * 32 + 20);
        mechanics.set([0, 0, 0, 1], index * 32 + 24);
        mechanics.set([101325, 0, 0, live ? MASS_KG : 0], index * 32 + 28);
      }
      const upload = (values, label) => {
        const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({
          label,
          size: values.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        }), device);
        device.queue.writeBuffer(buffer, 0, values);
        return buffer;
      };
      const ROW_WORDS = 24;
      const front = new Uint32Array(particleCount * ROW_WORDS);
      const frontFloats = new Float32Array(front.buffer);
      const row = liquidIndex * ROW_WORDS;
      frontFloats[row + 15] = SKIN_J;
      frontFloats[row + 16] = U_PRE;
      frontFloats[row + 17] = U_TARGET;
      frontFloats[row + 18] = T_STAR;
      front[row + 19] = (EPOCH << 3) | 3;
      frontFloats[row + 20] = FACE_OFFSET_M;
      const frontBuffer = upload(front, 'interface-front-rows');

      const fixture = () => ({
        device,
        sphParticleState: {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount,
          phaseCarrierPlan: plan
        },
        mlsMpmParticleState: {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount
        },
        thermalMaterialTable: {
          // One liquid->gas plateau; the conversion never reads it, the
          // equilibrium path would.
          segments: new Float32Array([
            1, 2, 2, 3,
            419_000, 2_676_000, 373.15, 373.15,
            1000, 0.6, 1, 0
          ]),
          records: new Float32Array([1, 0, 1, 1, 0.9, 0, 0, 0])
        },
        mechanicsMaterialTable: {
          schema: mechanicsTable.ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
          phaseRecordCount: 2,
          records: new Float32Array([
            1, 2, 1000, 2e6, 0, 0, 45, 1, 0, 1, 0.001, 0.07,
            1, 3, 0.6, 1e5, 0, 0, 450, 1, 0, 1, 0, 0
          ])
        },
        phaseCarrierPlan: plan,
        sourceStateBuffer: upload(state, 'src-state'),
        sourceThermoBuffer: upload(thermo, 'src-thermo'),
        sourceMechanicsBuffer: upload(mechanics, 'src-mechanics'),
        readbackMode: 'full-parity-readback'
      });
      const run = async (interfacePhaseFront) => {
        const result = await transfer.runSphPhaseCarrierTransferWebGpu({
          ...fixture(),
          interfacePhaseFront
        });
        return {
          status: result.status,
          conversions: result.interfaceFrontConversionCount,
          consumed: result.interfacePhaseFrontConsumed,
          state: Array.from(result.state),
          thermo: Array.from(result.thermo)
        };
      };
      const descriptor = (epoch) => ({ buffer: frontBuffer, epoch, headerWords: 0, rowWords: ROW_WORDS });
      const converted = await run(descriptor(EPOCH));
      const staleEpoch = await run(descriptor(EPOCH + 1));
      const absent = await run(null);
      return {
        status: 'ok',
        converted,
        staleEpoch,
        absent,
        validationError: (await device.popErrorScope())?.message || null
      };
    }, { MASS_KG, U_PRE, SKIN_J, U_TARGET, T_STAR, EPOCH, FACE_OFFSET_M });
  } finally {
    await browser.close();
  }
  assert.equal(native.status, 'ok', JSON.stringify(native).slice(0, 3000));
  assert.equal(native.validationError, null);

  const lanes = (run) => [0, 1, 2, 3].map((index) => ({
    position: run.state.slice(index * 8, index * 8 + 3),
    mass: run.state[index * 8 + 3],
    velocity: run.state.slice(index * 8 + 4, index * 8 + 7),
    energy: run.state[index * 8 + 7],
    phase: run.thermo[index * 12 + 1],
    temperature: run.thermo[index * 12 + 2]
  }));
  const totals = (run) => lanes(run).reduce((sum, lane) => ({
    mass: sum.mass + lane.mass,
    momentum: sum.momentum + lane.mass * lane.velocity[0],
    firstMomentX: sum.firstMomentX + lane.mass * lane.position[0],
    energy: sum.energy + lane.mass * (lane.energy + 0.5 * lane.velocity[0] ** 2)
  }), { mass: 0, momentum: 0, firstMomentX: 0, energy: 0 });
  const close = (actual, expected, relative, label) => assert.ok(
    Math.abs(actual - expected) <= relative * Math.max(Math.abs(expected), 1e-30),
    `${label}: ${actual} vs ${expected}`
  );

  const { converted, staleEpoch, absent } = native;
  assert.equal(converted.status, 'phase-carrier-transfer-complete');
  assert.equal(converted.consumed, true);
  assert.equal(converted.conversions, 1);
  const out = lanes(converted);
  const skinMass = SKIN_J / (U_TARGET - U_PRE);
  close(out[2].mass, skinMass, 1e-5, 'vapor mass');
  close(out[2].energy, U_TARGET, 1e-6, 'vapor specific energy');
  close(out[2].temperature, T_STAR, 1e-6, 'vapor temperature');
  assert.equal(out[2].phase, 3);
  close(out[1].mass, MASS_KG - skinMass, 1e-5, 'liquid remainder mass');
  close(out[1].energy, U_PRE, 2e-4, 'liquid remainder keeps the pre-step energy');
  // The skin is born at its contact face; the remainder recoils so the
  // lineage's first moment is unchanged.
  close(out[2].position[0], 1 + FACE_OFFSET_M, 1e-6, 'vapor born at the face');
  close(
    out[1].position[0],
    1 - FACE_OFFSET_M * skinMass / (MASS_KG - skinMass),
    1e-6,
    'remainder recoil'
  );
  const before = totals(absent);
  const after = totals(converted);
  close(after.mass, MASS_KG, 1e-6, 'mass');
  close(after.momentum, before.momentum, 1e-5, 'momentum');
  close(after.firstMomentX, before.firstMomentX, 1e-6, 'first moment');
  close(after.energy, before.energy, 1e-5, 'energy');

  // A row stamped for another proposal is not this step's partition.
  assert.equal(staleEpoch.consumed, true);
  assert.equal(staleEpoch.conversions, 0);
  assert.deepEqual(staleEpoch.state, absent.state);
  assert.deepEqual(staleEpoch.thermo, absent.thermo);
  assert.equal(absent.consumed, false);
  assert.equal(absent.conversions, 0);
  close(lanes(absent)[1].mass, MASS_KG, 1e-7, 'absent front keeps the carrier');
});
