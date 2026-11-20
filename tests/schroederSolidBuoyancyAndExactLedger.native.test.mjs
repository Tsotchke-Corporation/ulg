import assert from 'node:assert/strict';
import test from 'node:test';

// Slice 2.2 GPU invariants (plan/CURRENT-PLAN.md):
//   B1 SOL-3 Buoyancy (float / neutral / sink) via GPU-binned solid-fluid
//      contact coupled with the rigid SE(3) integrator under gravity;
//   B2 G2 exact-ledger bit-exact sum(U - S) preservation and exact-mass
//      ownership transfer across solid-fluid thermal coupling and melt release.
// ULG_RUN_NATIVE_SOLID_RIGID=1; run memory-capped.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan SOL-3 buoyancy (float/neutral/sink) and G2 exact-ledger melt/thermal conservation', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_RIGID=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const out = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const errors = [];
      device.addEventListener('uncapturederror', (e) => {
        if (errors.length < 20) errors.push(String(e.error?.message ?? e).slice(0, 500));
      });
      const solid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const contact = await import('/src/runtime/sph/schroederSolidFluidContactGpu.js');
      const thermal = await import('/src/runtime/sph/schroederSolidThermalGpu.js');
      const coupling = await import('/src/runtime/sph/schroederSolidFluidThermalGpu.js');
      const release = await import('/src/runtime/sph/schroederSolidReleaseGpu.js');
      const exactEnergy = await import('/src/runtime/sph/sphExactThermalEnergyWgsl.js');
      const exactMass = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');

      const make = (data) => {
        const b = device.createBuffer({ size: Math.max(16, data.byteLength), usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data);
        return b;
      };
      const read = async (buffer, Type = Float32Array) => {
        const c = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        const e = device.createCommandEncoder();
        e.copyBufferToBuffer(buffer, 0, c, 0, buffer.size);
        device.queue.submit([e.finish()]);
        await c.mapAsync(1);
        const w = Array.from(new Type(c.getMappedRange().slice(0)));
        c.unmap();
        c.destroy();
        return w;
      };

      // ---- B1: Buoyancy (float / neutral / sink) via solid-fluid traction ----
      // A 3x3x3 rigid cube sits atop a supporting hydrostatic fluid layer of
      // density rho_f = 1000 kg/m^3. Each fluid particle beneath the cube
      // carries the hydrostatic upward impulse matching displaced fluid weight
      // (rho_f * V_cube * g * dt divided over the 9 supporting contacts); the
      // binned solid-fluid contact kernel transfers momentum two-way against
      // the rigid body's gravity -M_solid * g * dt.
      const runBuoyancy = async (solidDensityKgPerM3) => {
        const pitch = 0.02;
        const g = 9.80665;
        const dt = 0.002;
        const rhoFluid = 1000;
        const memberMass = Math.fround(solidDensityKgPerM3 * pitch ** 3);
        const members = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
          members.push({ x: [1 + pitch * (i + 0.5), 0.5 + pitch * (j + 0.5), 1 + pitch * (k + 0.5)], massKg: memberMass });
        }
        const seed = solid.seedSchroederSolidRigidBody({ bodyId: 0, members });
        const packed = solid.packSchroederSolidRigidBodies([seed]);
        const { proxies, proxyCount } = solid.packSchroederSolidContactProxies(seedsOrSingle(seed), { radiusM: 0.5 * pitch });
        const frameBuffer = make(packed.frames);
        const memberBuffer = make(packed.members);
        const proxyBuffer = make(proxies);
        const rigidStage = solid.createSchroederSolidRigidStage({
          device, bodyCount: 1, memberCount: packed.memberCount,
          frameBuffer, memberBuffer, proxyBuffer, proxyCount,
          gravity: [0, -g, 0], boxM: [5, 5, 5]
        });
        const contactStage = contact.createSchroederSolidFluidContactStage({
          device, memberCount: packed.memberCount, bodyCount: 1,
          memberBuffer, memberWorldBuffer: rigidStage.memberWorldBuffer,
          frameBuffer, memberRadiusM: 0.5 * pitch
        });

        // 9 fluid particles directly beneath the 3x3 bottom face, representing
        // the hydrostatic pressure traction of displaced rho_f = 1000 kg/m^3.
        const fluidMass = Math.fround(rhoFluid * 3 * pitch ** 3); // displaced column mass per bottom face cell
        const radius = 0.5 * pitch;
        const nParticles = 9;
        const state = new Float32Array(nParticles * 8);
        const thermo = new Float32Array(nParticles * 12);
        const stateBuffer = make(state);
        const thermoBuffer = make(thermo);
        const initialY = seed.centerOfMass[1];

        let maxMomentumErr = 0;
        for (let step = 0; step < 30; step++) {
          const e1 = device.createCommandEncoder();
          rigidStage.encode(e1, dt);
          device.queue.submit([e1.finish()]);

          const framePre = await read(frameBuffer);
          const bodyY = framePre[1];
          const bodyVy = framePre[9] / framePre[3];
          // Place the hydrostatic support layer in contact with the bottom face
          // moving upward relative to the post-gravity body so each of the 9
          // contacts transfers the displaced fluid weight (fluidMass * g * dt).
          const mBody = framePre[3];
          const mEff = 1 / (1 / fluidMass + 1 / mBody);
          const vTarget = bodyVy + (fluidMass * g * dt) / mEff;
          let idx = 0;
          for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
            const x = 1 + pitch * (i + 0.5);
            const y = bodyY - 1.5 * pitch - 0.5 * pitch + 0.0001; // exact contact, inside slop so Baumgarte=0
            const z = 1 + pitch * (k + 0.5);
            state.set([x, y, z, fluidMass, 0, vTarget, 0, 1e5], idx * 8);
            thermo.set([1, 2, 300, rhoFluid, 0, 1, 0, 0, 0.01, 1, 0, radius], idx * 12);
            idx++;
          }
          device.queue.writeBuffer(stateBuffer, 0, state);
          device.queue.writeBuffer(thermoBuffer, 0, thermo);

          const pBefore = framePre[9] + nParticles * fluidMass * vTarget;
          const e2 = device.createCommandEncoder();
          contactStage.encode(e2, dt, { fluidStateBuffer: stateBuffer, fluidThermoBuffer: thermoBuffer, particleCount: nParticles });
          device.queue.submit([e2.finish()]);
          const framePost = await read(frameBuffer);
          const statePost = await read(stateBuffer);
          let pFluidAfter = 0;
          for (let p = 0; p < nParticles; p++) pFluidAfter += fluidMass * statePost[p * 8 + 5];
          const pAfter = framePost[9] + pFluidAfter;
          maxMomentumErr = Math.max(maxMomentumErr, Math.abs(pAfter - pBefore));
        }
        const finalFrame = await read(frameBuffer);
        const ledger = await read(contactStage.ledgerBuffer, Uint32Array);
        contactStage.destroy();
        rigidStage.destroy();
        for (const b of [frameBuffer, memberBuffer, proxyBuffer, stateBuffer, thermoBuffer]) b.destroy();
        return {
          density: solidDensityKgPerM3,
          initialY,
          finalY: finalFrame[1],
          deltaY: finalFrame[1] - initialY,
          finalVy: finalFrame[9] / finalFrame[3],
          maxMomentumErr,
          ledgerError: ledger[1]
        };
      };
      function seedsOrSingle(s) { return [s]; }

      const buoyancy = {
        float: await runBuoyancy(500),
        neutral: await runBuoyancy(1000),
        sink: await runBuoyancy(7874)
      };

      // ---- B2: Exact-ledger thermal coupling & melt release conservation ----
      const solidBranch = { referenceTemperatureK: 270, referenceInternalEnergyJPerKg: -339700, cvJPerKgK: 2050 };
      solidBranch.energyMaxJPerKg = solidBranch.referenceInternalEnergyJPerKg + 2050 * (273.15 - 270);
      const liquidBranch = { referenceTemperatureK: 273.15, cvJPerKgK: 4186 };
      liquidBranch.energyMinJPerKg = solidBranch.energyMaxJPerKg + 1000; // compact latent band so release triggers in bounded steps
      liquidBranch.referenceInternalEnergyJPerKg = liquidBranch.energyMinJPerKg;
      const pitch = 0.01;
      const mMass = Math.fround(917 * pitch ** 3);
      const members = [];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
        members.push({ x: [1 + pitch * (i + 0.5), 0.1 + pitch * (j + 0.5), 1 + pitch * (k + 0.5)], massKg: mMass });
      }
      const seed = solid.seedSchroederSolidRigidBody({ bodyId: 0, members });
      const packed = solid.packSchroederSolidRigidBodies([seed]);
      const seeded = thermal.seedSchroederSolidMemberThermal({
        seeds: [seed], pitchByAxisM: [[pitch, pitch, pitch]], temperaturesK: [272.5], solidBranch
      });
      const world = new Float32Array(packed.memberCount * 8);
      const [qx, qy, qz, qw] = seed.quaternion;
      const rot = (v) => {
        const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])];
        return [v[0] + qw * t[0] + (qy * t[2] - qz * t[1]), v[1] + qw * t[1] + (qz * t[0] - qx * t[2]), v[2] + qw * t[2] + (qx * t[1] - qy * t[0])];
      };
      seed.members.forEach((member, n) => {
        const r = rot(member.rest);
        world.set([seed.centerOfMass[0] + r[0], seed.centerOfMass[1] + r[1], seed.centerOfMass[2] + r[2], mMass], n * 8);
      });

      // 4 hot molten-iron fluid particles below the 2x2 bottom ice face + 8 dormant melt-release slots.
      const hotCount = 4;
      const totalParticles = hotCount + packed.memberCount;
      const fluidMass = Math.fround(7000 * 0.005 ** 3 * 8);
      const hotU = 1.2e6;
      const fluidState = new Float32Array(totalParticles * 8);
      const fluidThermo = new Float32Array(totalParticles * 12);
      const fluidMechanics = new Float32Array(totalParticles * 32);
      for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) {
        const n = i * 2 + k;
        fluidState.set([1 + pitch * (i + 0.5), 0.1 - 0.004, 1 + pitch * (k + 0.5), fluidMass, 0, 0, 0, hotU], n * 8);
        fluidThermo.set([7, 2, 1800, 7000, 0, 1, 0, 0, 0.004, 1, 0, 0.005], n * 12);
      }
      for (let m = 0; m < packed.memberCount; m++) {
        const n = hotCount + m;
        fluidThermo.set([1, 2, 274, 998, 0, 1, 0, 0, 0.004, 1, 0, 0.005], n * 12);
      }
      const W = exactEnergy.SPH_EXACT_THERMAL_ENERGY_WORDS;
      const fmt = exactEnergy.SPH_EXACT_THERMAL_ENERGY_FORMAT;
      const exactEnergyInit = new Uint32Array(exactEnergy.sphExactThermalEnergyRecordWords(totalParticles));
      const exactMassInit = new Uint32Array(totalParticles * W);
      for (let n = 0; n < hotCount; n++) {
        const mWords = exactMass.encodeSphExactMass(fluidMass, fmt);
        exactMassInit.set(mWords, n * W);
        const uWords = exactMass.encodeSphExactMass(Math.fround(fluidMass * hotU), fmt);
        exactEnergyInit.set(uWords, n * W);
      }

      const memberBuffer = make(packed.members);
      const worldBuffer = make(world);
      const stateBuffer = make(fluidState);
      const thermoBuffer = make(fluidThermo);
      const mechanicsBuffer = make(fluidMechanics);
      const exactEnergyBuffer = make(exactEnergyInit);
      const exactMassBuffer = make(exactMassInit);
      const releaseRows = new Uint32Array(packed.memberCount);
      for (let m = 0; m < packed.memberCount; m++) releaseRows[m] = hotCount + m;

      const thermalStage = thermal.createSchroederSolidThermalStage({
        device, memberCount: packed.memberCount, bodyCount: 1,
        memberBuffer, memberWorldBuffer: worldBuffer, thermo: seeded.thermo, neighbors: seeded.neighbors,
        solidBranch, liquidBranch, meltTemperatureK: 273.15, solidConductivity: 2.2, liquidConductivity: 0.6,
        pitchM: [pitch, pitch, pitch], memberRadiusM: 0.5 * pitch, wallTemperaturesK: [0, 0, 0, 0, 0, 0], boxM: [5, 5, 5]
      });
      const couplingStage = coupling.createSchroederSolidFluidThermalStage({
        device, memberCount: packed.memberCount, memberBuffer, memberWorldBuffer: worldBuffer,
        fluidTable: coupling.packSchroederSolidFluidTable([{ materialId: 7, phaseId: 2, conductivityWPerMK: 40, heatCapacityJPerKgK: 820 }]),
        solidBranch, liquidBranch, meltTemperatureK: 273.15, solidConductivity: 2.2, liquidConductivity: 0.6,
        halfPitchM: 0.5 * pitch
      });
      const releaseStage = release.createSchroederSolidReleaseStage({
        device, memberCount: packed.memberCount, releaseRows,
        liquidMaterialId: 1, liquidDensityKgPerM3: 998, liquidEntitiesPerKg: 6.02214076e23 / 0.01801528,
        releaseEventBuffer: thermalStage.releaseEventBuffer, releaseCountBuffer: thermalStage.releaseCountBuffer
      });

      const exactEnergyBefore = await read(exactEnergyBuffer, Uint32Array);
      let totalLedgerQuanta = 0;
      for (let s = 0; s < 300; s++) {
        const e = device.createCommandEncoder();
        thermalStage.encode(e, 0.002, { releaseEnabled: true });
        couplingStage.encode(e, 0.002, {
          memberThermoBuffer: thermalStage.thermoBuffer,
          fluidStateBuffer: stateBuffer,
          fluidThermoBuffer: thermoBuffer,
          particleCount: totalParticles,
          exactEnergyBuffer,
          exactEnergyRowCount: totalParticles
        });
        releaseStage.encode(e, {
          stateBuffer, thermoBuffer, mechanicsBuffer,
          exactEnergyBuffer, exactEnergyRowCount: totalParticles,
          exactMassBuffer
        });
        device.queue.submit([e.finish()]);
        const led = await read(couplingStage.ledgerBuffer, Int32Array);
        totalLedgerQuanta += led[0];
        if (led[2] !== 0) return { status: 'ledger-overflow', led };
      }

      const exactEnergyAfter = await read(exactEnergyBuffer, Uint32Array);
      const exactMassAfter = await read(exactMassBuffer, Uint32Array);
      const stateAfter = await read(stateBuffer);
      const membersAfter = await read(memberBuffer);

      releaseStage.destroy();
      couplingStage.destroy();
      thermalStage.destroy();
      for (const b of [memberBuffer, worldBuffer, stateBuffer, thermoBuffer, mechanicsBuffer, exactEnergyBuffer, exactMassBuffer]) b.destroy();
      device.destroy();

      return {
        status: 'ran',
        errors,
        buoyancy,
        exactLedger: {
          W, totalParticles, hotCount, memberCount: packed.memberCount, mMass,
          totalLedgerQuanta, exactEnergyBefore, exactEnergyAfter, exactMassAfter, stateAfter, membersAfter
        }
      };
    });

    assert.notEqual(out.status, 'unsupported', 'WebGPU adapter unavailable');
    assert.equal(out.status, 'ran', `unexpected status: ${JSON.stringify(out)}`);
    assert.deepEqual(out.errors, [], `no GPU validation errors: ${JSON.stringify(out.errors)}`);

    // B1 assertions: float rises, neutral stays balanced, sink descends, momentum conserved.
    const { float: bFloat, neutral: bNeutral, sink: bSink } = out.buoyancy;
    assert.equal(bFloat.ledgerError, 0);
    assert.equal(bNeutral.ledgerError, 0);
    assert.equal(bSink.ledgerError, 0);
    assert.ok(bFloat.deltaY > 1e-3 && bFloat.finalVy > 0.2, `B1 float must rise: ${JSON.stringify(bFloat)}`);
    // Symplectic Euler kicks (-g*dt) and drifts (-g*dt^2) before contactStage cancels
    // gravity, so neutral has finalVy == 0 to f32 precision and exact O(steps*g*dt^2) offset.
    assert.ok(
      Math.abs(bNeutral.finalVy) < 1e-4 && Math.abs(bNeutral.deltaY) < 2e-3,
      `B1 neutral must stay balanced: ${JSON.stringify(bNeutral)}`
    );
    assert.ok(bSink.deltaY < -5e-3 && bSink.finalVy < -0.2, `B1 sink must descend: ${JSON.stringify(bSink)}`);
    assert.ok(bFloat.finalY > bNeutral.finalY && bNeutral.finalY > bSink.finalY, 'B1 strict ordering float > neutral > sink');
    assert.ok(bFloat.maxMomentumErr < 1e-5 && bNeutral.maxMomentumErr < 1e-5 && bSink.maxMomentumErr < 1e-5, 'B1 momentum conserved');

    // B2 assertions: bit-exact sum(U - S) across thermal coupling + melt release, and exact-mass transfer.
    const el = out.exactLedger;
    const W = el.W;
    const signedRow = (words, row) => {
      let v = 0n;
      for (let w = W - 1; w >= 0; w--) v = (v << 32n) | BigInt(words[row * W + w] >>> 0);
      if (v >= (1n << BigInt(32 * W - 1))) v -= (1n << BigInt(32 * W));
      return v;
    };
    const sumUMinusS = (words) => {
      let acc = 0n;
      for (let r = 0; r < el.totalParticles; r++) {
        acc += signedRow(words, r) - signedRow(words, el.totalParticles + r);
      }
      return acc;
    };
    const uMinusSBefore = sumUMinusS(el.exactEnergyBefore);
    const uMinusSAfter = sumUMinusS(el.exactEnergyAfter);
    assert.equal(uMinusSAfter, uMinusSBefore, `B2: bit-exact sum(U - S) preserved (${uMinusSBefore} vs ${uMinusSAfter})`);
    assert.ok(el.totalLedgerQuanta > 0, `B2: heat flowed into solid (${el.totalLedgerQuanta} quanta)`);

    let releasedCount = 0;
    for (let m = 0; m < el.memberCount; m++) {
      const aliveMass = el.membersAfter[m * 8 + 3];
      const slot = el.hotCount + m;
      const fluidMass = el.stateAfter[slot * 8 + 3];
      const exactRowMass = signedRow(el.exactMassAfter, slot);
      if (aliveMass === 0) {
        releasedCount += 1;
        assert.equal(fluidMass, el.mMass, `B2: released slot ${slot} has member mass`);
        assert.ok(exactRowMass > 0n, `B2: released slot ${slot} wrote nonzero exact_mass_rows`);
        const exactRowU = signedRow(el.exactEnergyAfter, slot);
        const exactRowS = signedRow(el.exactEnergyAfter, el.totalParticles + slot);
        assert.equal(exactRowU, exactRowS, `B2: released slot ${slot} booked U == S so U - S == 0`);
      }
    }
    assert.ok(releasedCount >= 4, `B2: bottom ice layer melted and released into exact ledger (${releasedCount} released)`);
    console.log(JSON.stringify({
      buoyancy: out.buoyancy,
      exactLedger: {
        releasedCount,
        totalLedgerQuanta: el.totalLedgerQuanta,
        uMinusSDrift: String(uMinusSAfter - uMinusSBefore)
      }
    }));
  } finally {
    await browser.close();
  }
});
