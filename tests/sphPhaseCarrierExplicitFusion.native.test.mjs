// Native gate for bulk equilibrium fusion of explicit-branch (phase-caloric)
// materials in the f32 phase-carrier transfer. Such materials have no plateau
// rows: their thermal record carries law 2 (explicit fusion) with T_f, and the
// transfer derives u_s(T_f) and u_l(T_f) from the packed solid and liquid
// branch lines. Manufactured states with answers known from construction:
//   - melt:   a solid 1/4 of the latent gap above u_s(T_f) sends exactly
//             m/4 to its liquid lane at u_l(T_f), the rest stays at u_s(T_f);
//   - freeze: a liquid 1/2 of the gap below u_l(T_f) freezes exactly m/2 at
//             u_s(T_f), the rest stays at u_l(T_f);
//   - below nucleation (1e-4 of the gap, under the 1e-3 threshold): unchanged;
//   - the same superheated solid with law 0 (no fusion authority): unchanged.
// Mass, momentum and energy are conserved in every case.
//
// Run: ULG_RUN_NATIVE_EXPLICIT_FUSION=1 node --test
//   tests/sphPhaseCarrierExplicitFusion.native.test.mjs
// (HTTPS dev server on 5173; override with ULG_EXPLICIT_FUSION_BASE_URL.)
import assert from 'node:assert/strict';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_EXPLICIT_FUSION === '1';
const NATIVE_BASE_URL = process.env.ULG_EXPLICIT_FUSION_BASE_URL || 'https://127.0.0.1:5173/';

const MASS_KG = 1e-4;
const T_F = 273.15;
// Synthetic explicit branches (u linear in T), chosen so u_s(T_f) = -333 000
// and u_l(T_f) = 0: the latent gap is 333 000 J/kg.
const U_SF = -333_000;
const U_LF = 0;
const SOLID = { cv: 2000, tLo: 200, tHi: 600 };
const LIQUID = { cv: 4000, tLo: 233.15, tHi: 1100 };
const GAS = { u0: 2_300_000, cv: 1500, tLo: 233.15, tHi: 1100 };
// Boiling: a vaporization record whose curve passes p_ref = 1 atm at
// T_ref = 373.15 K with dcp = v_l = 0, so T_sat(101 325 Pa) = 373.15 K exactly;
// u_l(T_sat) = 400 000 and u_g(T_sat) = 2 450 000 on the branches above.
const T_SAT = 373.15;
const U_L_SAT = LIQUID.cv * (T_SAT - T_F);
const U_G_SAT = GAS.u0 + GAS.cv * (T_SAT - T_F);
// The last slot is the reference-ladder pressure used without pressure authority.
const VAPORIZATION = [1, T_SAT, 101325, 2.26e6, 0, 461.5, 0, 101325];
const CASES = Object.freeze({
  melt: { phase: 1, energy: U_SF + 0.25 * (U_LF - U_SF), law: 2 },
  freeze: { phase: 2, energy: U_LF - 0.5 * (U_LF - U_SF), law: 2 },
  belowNucleation: { phase: 1, energy: U_SF + 1e-4 * (U_LF - U_SF), law: 2 },
  noAuthority: { phase: 1, energy: U_SF + 0.25 * (U_LF - U_SF), law: 0 },
  boil: { phase: 2, energy: U_L_SAT + 0.1 * (U_G_SAT - U_L_SAT), law: 2, pressure: true },
  boilReferenceLadder: { phase: 2, energy: U_L_SAT + 0.1 * (U_G_SAT - U_L_SAT), law: 2, pressure: false },
  belowBoiling: { phase: 2, energy: LIQUID.cv * (360 - T_F), law: 2, pressure: true }
});

test('explicit-branch bulk fusion melts and freezes exactly the equilibrium mass', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_EXPLICIT_FUSION=1 to run on native WebGPU'
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    native = await page.evaluate(async (constants) => {
      const { MASS_KG, T_F, U_SF, U_LF, SOLID, LIQUID, GAS, CASES, VAPORIZATION } = constants;
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 12 } });
      device.pushErrorScope('validation');
      const transfer = await import('/src/runtime/sph/sphPhaseCarrierTransferGpu.js');
      const identity = await import('/src/runtime/sph/sphGpuDeviceIdentity.js');
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const mechanicsTable = await import('/src/runtime/sph/sphMechanicsMaterialTable.js');
      const lineages = 1;
      const particleCount = lineages * 4;
      const plan = {
        schema: transfer.ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA, status: 'phase-lane-capacity-ready',
        lineageCapacity: lineages, primaryCapacity: lineages, phaseLaneCount: 4, phaseLaneStride: lineages,
        companionStart: lineages, companionCapacity: lineages * 3, particleCapacity: particleCount,
        stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true
      };
      const upload = (values, label) => {
        const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({
          label, size: values.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        }), device);
        device.queue.writeBuffer(buffer, 0, values);
        return buffer;
      };
      const branchEnergy = (b, t, u0 = null) => (u0 ?? 0) + b.cv * (t - T_F);
      // Explicit solid+liquid+gas branches (segment type 4), one material.
      const segment = (phase, b, uAt) => [1, 4, phase, phase,
        uAt(b.tLo), uAt(b.tHi), b.tLo, b.tHi, phase === 3 ? 0.8 : 1000, phase === 3 ? 0.8 : 1000, 1, 0.5];
      const segments = new Float32Array([
        ...segment(1, SOLID, (t) => U_SF + SOLID.cv * (t - T_F)),
        ...segment(2, LIQUID, (t) => U_LF + LIQUID.cv * (t - T_F)),
        ...segment(3, GAS, (t) => branchEnergy(GAS, t, GAS.u0))
      ]);
      const run = async ({ phase, energy, law, pressure = false }) => {
        const sourceIndex = phase - 1;
        const state = new Float32Array(particleCount * 8);
        const thermo = new Float32Array(particleCount * 12);
        const mechanics = new Float32Array(particleCount * 32);
        for (let index = 0; index < particleCount; index += 1) {
          const live = index === sourceIndex;
          const lanePhase = index + 1;
          state.set([1, 1, 1, live ? MASS_KG : 0, live ? 0.1 : 0, 0, 0, live ? energy : 0], index * 8);
          thermo.set([
            1, lanePhase, live ? T_F : 0, lanePhase === 3 ? 0.8 : 1000,
            lanePhase === 1 ? 1 : 0, lanePhase === 2 ? 1 : 0, lanePhase === 3 ? 1 : 0, lanePhase === 4 ? 1 : 0,
            0.005, live ? 1 : 0, live ? 1 : 254, live ? 0.0023 : 0
          ], index * 12);
          mechanics.set([1, 0, 0, 0], index * 32);
          mechanics.set([0, 1, 0, 0], index * 32 + 4);
          mechanics.set([0, 0, 1, 0], index * 32 + 8);
          mechanics.set([0, 0, 1, 1e-7], index * 32 + 16);
          mechanics.set([lanePhase === 1 ? 1 : 0, 1, 0, 0], index * 32 + 20);
          mechanics.set([0, 0, 0, 1], index * 32 + 24);
          mechanics.set([101325, 0, 0, live ? MASS_KG : 0], index * 32 + 28);
        }
        const result = await transfer.runSphPhaseCarrierTransferWebGpu({
          device,
          sphParticleState: { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount, phaseCarrierPlan: plan },
          mlsMpmParticleState: { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount },
          thermalMaterialTable: {
            segments,
            // materialId, segment offset, count, status, emissivity, law, p_ref, T_f
            records: new Float32Array([1, 0, 3, 1, 0.9, law, 101325, law === 2 ? T_F : 0]),
            explicitVaporizationRecords: new Float32Array(VAPORIZATION)
          },
          absolutePressureAuthority: pressure,
          mechanicsMaterialTable: {
            schema: mechanicsTable.ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
            phaseRecordCount: 3,
            records: new Float32Array([
              1, 1, 1000, 2e6, 1e6, 0, 45, 1, 1, 1, 0, 0,
              1, 2, 1000, 2e6, 0, 0, 45, 1, 0, 1, 0.001, 0.07,
              1, 3, 0.8, 1e5, 0, 0, 450, 1, 0, 1, 0, 0
            ])
          },
          phaseCarrierPlan: plan,
          sourceStateBuffer: upload(state, 'src-state'),
          sourceThermoBuffer: upload(thermo, 'src-thermo'),
          sourceMechanicsBuffer: upload(mechanics, 'src-mechanics'),
          readbackMode: 'full-parity-readback'
        });
        return {
          status: result.status, fusions: result.explicitFusionConversionCount,
          boils: result.explicitBoilingConversionCount,
          skins: result.interfaceFrontConversionCount, evidenceError: result.evidence?.[2] ?? null,
          state: Array.from(result.state), thermo: Array.from(result.thermo)
        };
      };
      const out = {};
      for (const [name, spec] of Object.entries(CASES)) out[name] = await run(spec);
      return { status: 'ok', out, validationError: (await device.popErrorScope())?.message || null };
    }, { MASS_KG, T_F, U_SF, U_LF, SOLID, LIQUID, GAS, CASES, VAPORIZATION });
  } finally {
    await browser.close();
  }
  assert.equal(native.status, 'ok', JSON.stringify(native).slice(0, 3000));
  assert.equal(native.validationError, null);
  const lanes = (run) => [0, 1, 2, 3].map((index) => ({
    mass: run.state[index * 8 + 3], velocity: run.state[index * 8 + 4], energy: run.state[index * 8 + 7],
    phase: run.thermo[index * 12 + 1], temperature: run.thermo[index * 12 + 2]
  }));
  const totals = (run) => lanes(run).reduce((sum, lane) => ({
    mass: sum.mass + lane.mass,
    momentum: sum.momentum + lane.mass * lane.velocity,
    energy: sum.energy + lane.mass * (lane.energy + 0.5 * lane.velocity ** 2)
  }), { mass: 0, momentum: 0, energy: 0 });
  const close = (actual, expected, tolerance, label) => assert.ok(
    Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
  const conserved = (run, energy, label) => {
    const t = totals(run);
    close(t.mass, MASS_KG, MASS_KG * 1e-6, `${label} mass`);
    close(t.momentum, MASS_KG * 0.1, MASS_KG * 0.1 * 1e-5, `${label} momentum`);
    close(t.energy, MASS_KG * (energy + 0.005), Math.abs(MASS_KG * energy) * 1e-5 + 1e-9, `${label} energy`);
  };
  const { melt, freeze, belowNucleation, noAuthority, boil, belowBoiling, boilReferenceLadder } = native.out;
  for (const [name, run] of Object.entries(native.out)) {
    assert.equal(run.status, 'phase-carrier-transfer-complete', `${name}: ${run.status} ${run.evidenceError}`);
  }

  // Melt: exactly m/4 to the liquid lane at u_l(T_f); m*3/4 solid at u_s(T_f).
  assert.equal(melt.fusions, 1);
  const m = lanes(melt);
  close(m[1].mass, 0.25 * MASS_KG, MASS_KG * 1e-5, 'melt liquid mass');
  close(m[1].energy, U_LF, 1, 'melt liquid energy u_l(T_f)');
  close(m[1].temperature, T_F, 1e-3, 'melt liquid temperature');
  assert.equal(m[1].phase, 2);
  close(m[0].mass, 0.75 * MASS_KG, MASS_KG * 1e-5, 'melt solid remainder mass');
  close(m[0].energy, U_SF, 1, 'melt solid remainder energy u_s(T_f)');
  conserved(melt, CASES.melt.energy, 'melt');

  // Freeze: exactly m/2 to the solid lane at u_s(T_f); m/2 liquid at u_l(T_f).
  assert.equal(freeze.fusions, 1);
  const f = lanes(freeze);
  close(f[0].mass, 0.5 * MASS_KG, MASS_KG * 1e-5, 'freeze solid mass');
  close(f[0].energy, U_SF, 1, 'freeze solid energy u_s(T_f)');
  assert.equal(f[0].phase, 1);
  close(f[1].mass, 0.5 * MASS_KG, MASS_KG * 1e-5, 'freeze liquid remainder mass');
  close(f[1].energy, U_LF, 1, 'freeze liquid remainder energy u_l(T_f)');
  conserved(freeze, CASES.freeze.energy, 'freeze');

  // Under the nucleation threshold, and with no fusion authority: unchanged.
  for (const [name, run, energy] of [['below nucleation', belowNucleation, CASES.belowNucleation.energy],
    ['no authority', noAuthority, CASES.noAuthority.energy]]) {
    assert.equal(run.fusions, 0, `${name} conversions`);
    const l = lanes(run);
    close(l[0].mass, MASS_KG, MASS_KG * 1e-7, `${name} keeps the solid`);
    close(l[1].mass, 0, 1e-12, `${name} creates no liquid`);
    close(l[0].energy, energy, 1, `${name} energy`);
  }

  // Boil: exactly m/10 to the gas lane at u_g(T_sat), the rest liquid at u_l(T_sat).
  assert.equal(boil.boils, 1);
  assert.equal(boil.fusions, 0);
  const b = lanes(boil);
  close(b[2].mass, 0.1 * MASS_KG, MASS_KG * 1e-5, 'boil vapor mass');
  close(b[2].energy, U_G_SAT, 2, 'boil vapor energy u_g(T_sat)');
  close(b[2].temperature, T_SAT, 1e-2, 'boil vapor temperature T_sat');
  assert.equal(b[2].phase, 3);
  close(b[1].mass, 0.9 * MASS_KG, MASS_KG * 1e-5, 'boil liquid remainder mass');
  close(b[1].energy, U_L_SAT, 2, 'boil liquid remainder energy u_l(T_sat)');
  conserved(boil, CASES.boil.energy, 'boil');
  // Without pressure authority the reference-ladder pressure (here equal) gives the same split.
  assert.equal(boilReferenceLadder.boils, 1);
  assert.deepEqual(boilReferenceLadder.state, boil.state);
  // Below T_sat(P): evaporation is the vapor-exchange law's business, not bulk boiling.
  assert.equal(belowBoiling.boils, 0);
  close(lanes(belowBoiling)[2].mass, 0, 1e-12, 'below boiling makes no vapor');
});
