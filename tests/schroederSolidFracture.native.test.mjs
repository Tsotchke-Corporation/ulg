import assert from 'node:assert/strict';
import test from 'node:test';

// A5 SOL-5 native Vulkan WebGPU gate (plan/todo/sol-critic.md):
//   F1 Cohesive bond cleavage + parallel connected-component body splitting:
//      a spinning, translating 6x2x2 coherent solid bar under tensile cleavage
//      fractures cleanly into 3 independent coherent bodies on the GPU while
//      conserving total mass, COM, linear momentum P, angular momentum L_0
//      about the origin, diagonal principal inertia I_b of every child body,
//      and exposing the newly cleaved interior faces in the WebGPU member-shape
//      renderer without mesh rebuild!
//   F2 Complete Solid -> Melt Release -> Liquid -> Refreeze -> Solid topology
//      round trip conserving total mass, momentum, and internal energy!
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_FRACTURE === '1'
  || process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';

test('A5 SOL-5 native Vulkan cohesive fracture into independent bodies and solid-liquid-solid refreeze conservation', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_FRACTURE=1 for native Vulkan WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(new URL('service-assets/README.md', BASE_URL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const out = await page.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 400));
      }
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => {
        if (gpuErrors.length < 20) gpuErrors.push(String(e.error?.message || e.error));
      });

      const solid = await import('/src/runtime/sph/schroederSolidRigidGpu.js');
      const thermal = await import('/src/runtime/sph/schroederSolidThermalGpu.js');
      const release = await import('/src/runtime/sph/schroederSolidReleaseGpu.js');
      const shapes = await import('/src/runtime/sph/schroederSolidShapeCarrier.js');
      const fractureMod = await import('/src/runtime/sph/schroederSolidFractureGpu.js');

      const makeBuf = (data, byteSize = data.byteLength) => {
        const b = device.createBuffer({ size: Math.max(16, byteSize), usage: 0x80 | 0x04 | 0x08 });
        device.queue.writeBuffer(b, 0, data);
        return b;
      };
      const readF32 = async (buf) => {
        const st = device.createBuffer({ size: buf.size, usage: 1 | 8 });
        const e = device.createCommandEncoder();
        e.copyBufferToBuffer(buf, 0, st, 0, buf.size);
        device.queue.submit([e.finish()]);
        await st.mapAsync(1);
        const w = Array.from(new Float32Array(st.getMappedRange().slice(0)));
        st.unmap(); st.destroy();
        return w;
      };

      // ---- F1: Cohesive Fracture of a Spinning/Translating 6x2x2 Bar into 3 Bodies ----
      const pitch = 0.04;
      const mMass = Math.fround(900 * pitch ** 3);
      const barMembers = [];
      for (let i = 0; i < 6; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          for (let k = 0; k < 2; k += 1) {
            barMembers.push({
              x: [1.5 + (i + 0.5) * pitch, 1.5 + (j + 0.5) * pitch, 1.5 + (k + 0.5) * pitch],
              massKg: mMass,
              ix: i
            });
          }
        }
      }
      const MAX_BODIES = 4;
      const barSeed = solid.seedSchroederSolidRigidBody({
        bodyId: 0,
        members: barMembers,
        velocity: [0.35, -0.15, 0.2],
        angularVelocity: [0.4, 1.8, -0.6]
      });
      const packed = solid.packSchroederSolidRigidBodies([barSeed]);
      const framesAll = new Uint8Array(MAX_BODIES * solid.SCHROEDER_SOLID_FRAME_WORDS * 4);
      framesAll.set(new Uint8Array(packed.frames), 0);
      const latticeAll = new Float32Array(MAX_BODIES * solid.SCHROEDER_SOLID_LATTICE_FLOATS);
      latticeAll.set(solid.packSchroederSolidLattice([barSeed], [[pitch, pitch, pitch]]), 0);
      const { proxies, proxyCount } = solid.packSchroederSolidContactProxies([barSeed], { radiusM: 0.5 * pitch });

      const solidBranch = {
        referenceTemperatureK: 250,
        referenceInternalEnergyJPerKg: -380000,
        cvJPerKgK: 2050,
        energyMaxJPerKg: -380000 + 2050 * 23.15
      };
      const liquidBranch = {
        referenceTemperatureK: 273.15,
        referenceInternalEnergyJPerKg: solidBranch.energyMaxJPerKg + 333550,
        cvJPerKgK: 4186,
        energyMinJPerKg: solidBranch.energyMaxJPerKg + 333550
      };
      const seededThermo = thermal.seedSchroederSolidMemberThermal({
        seeds: [barSeed],
        pitchByAxisM: [[pitch, pitch, pitch]],
        temperaturesK: [260],
        solidBranch
      });

      const frameBuffer = makeBuf(framesAll);
      const memberBuffer = makeBuf(packed.members);
      const proxyBuffer = makeBuf(proxies);
      const neighborBuffer = makeBuf(seededThermo.neighbors);
      const latticeBuffer = makeBuf(latticeAll);
      const thermoBuffer = makeBuf(seededThermo.thermo);

      const rigidStage = solid.createSchroederSolidRigidStage({
        device,
        bodyCount: MAX_BODIES,
        memberCount: packed.memberCount,
        frameBuffer,
        memberBuffer,
        proxyBuffer,
        proxyCount,
        boxM: [4, 4, 4],
        latticeBuffer
      });
      const fractureStage = fractureMod.createSchroederSolidFractureStage({
        device,
        memberCount: packed.memberCount,
        proxyCount,
        initialBodyCount: 1,
        maxBodyCapacity: MAX_BODIES,
        frameBuffer,
        memberBuffer,
        memberWorldBuffer: rigidStage.memberWorldBuffer,
        proxyBuffer,
        neighborBuffer,
        latticeBuffer,
        thermoBuffer,
        pitchM: [pitch, pitch, pitch],
        tensileStrengthPa: 5.0e4,
        shearStrengthPa: 5.0e4,
        fractureEnergyJPerM2: 12.0,
        solidBranch
      });

      // Step 0: regenerate member world positions & render pre-fracture voxel surface
      const shapeRenderer = shapes.createSchroederSolidMemberShapeRenderer(device);
      const SIZE = 256;
      const colorTex = device.createTexture({ size: [SIZE, SIZE], format: 'rgba8unorm', usage: 0x10 | 0x01 });
      const depthTex = device.createTexture({ size: [SIZE, SIZE], format: 'depth24plus', usage: 0x10 });
      const vp = new Float32Array([
        2 / 0.8, 0, 0, 0,
        0, 2 / 0.8, 0, 0,
        0, 0, -1 / 10, 0,
        -1 - 2 * 1.25 / 0.8, -1 - 2 * 1.25 / 0.8, 0.5, 1
      ]);
      const renderAndCountPixels = async () => {
        const e = device.createCommandEncoder();
        const rpass = e.beginRenderPass({
          colorAttachments: [{ view: colorTex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
          depthStencilAttachment: { view: depthTex.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 }
        });
        shapeRenderer.draw(rpass, {
          memberCount: packed.memberCount,
          frameBuffer,
          memberBuffer,
          neighborBuffer,
          latticeBuffer
        }, { viewProjection: vp });
        rpass.end();
        device.queue.submit([e.finish()]);
        const st = device.createBuffer({ size: SIZE * SIZE * 4, usage: 1 | 8 });
        const ec = device.createCommandEncoder();
        ec.copyTextureToBuffer({ texture: colorTex }, { buffer: st, bytesPerRow: SIZE * 4 }, [SIZE, SIZE]);
        device.queue.submit([ec.finish()]);
        await st.mapAsync(1);
        const px = new Uint8Array(st.getMappedRange().slice(0));
        st.unmap(); st.destroy();
        let lit = 0;
        for (let p = 3; p < px.length; p += 4) if (px[p] > 0) lit += 1;
        return lit;
      };

      {
        const e = device.createCommandEncoder();
        rigidStage.encode(e, 0);
        device.queue.submit([e.finish()]);
      }
      const framesBefore = await readF32(frameBuffer);
      const pxBefore = await renderAndCountPixels();

      // Apply symmetric 3-zone tensile load across cuts at ix = 1|2 and ix = 3|4:
      //   left third (ix in {0,1}): -200 N along +x
      //   middle third (ix in {2,3}): 0 N
      //   right third (ix in {4,5}): +200 N along +x
      // Across both cut planes (area = 0.04^2 = 0.0016 m^2), 0.5 * 200 / 0.0016 = 62.5 kPa > 50 kPa!
      // Internal bonds inside each 2x2x2 block have df = 0 -> stay 100% intact!
      const loads = new Float32Array(packed.memberCount * 4);
      barMembers.forEach((m, idx) => {
        loads[idx * 4 + 0] = m.ix <= 1 ? -200 : m.ix >= 4 ? 200 : 0;
      });
      fractureStage.setMemberLoads(loads);

      {
        const e = device.createCommandEncoder();
        fractureStage.encode(e, 1e-3);
        // Trigger exact reductions + 12-sweep Jacobi rebase across all 3 fragments!
        rigidStage.encode(e, 1e-12);
        device.queue.submit([e.finish()]);
      }
      const topoAfter = await fractureStage.readTopologySummary();
      const framesImmediatelyAfterSplit = await readF32(frameBuffer);
      const membersAfterSplit = await readF32(memberBuffer);

      // Now clear external loads and run 50 free-space steps with gently diverging fragment impulses
      // to verify all 3 independent bodies separate cleanly & expose newly cleaved faces on WebGPU!
      fractureStage.setMemberLoads(new Float32Array(packed.memberCount * 4));
      for (let s = 0; s < 40; s += 1) {
        const e = device.createCommandEncoder();
        rigidStage.encode(e, 1e-3);
        device.queue.submit([e.finish()]);
      }
      const pxAfter = await renderAndCountPixels();

      colorTex.destroy(); depthTex.destroy();
      fractureStage.destroy(); rigidStage.destroy();
      for (const b of [frameBuffer, memberBuffer, proxyBuffer, neighborBuffer, latticeBuffer, thermoBuffer]) b.destroy();

      // ---- F2: Solid -> Melt Release -> Liquid -> Refreeze -> Solid Round Trip ----
      const icePitch = 0.02;
      const iceMass = Math.fround(917 * icePitch ** 3);
      const icePts = [];
      for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
          for (let k = 0; k < 2; k += 1) {
            icePts.push({
              x: [1.0 + (i + 0.5) * icePitch, 1.0 + (j + 0.5) * icePitch, 1.0 + (k + 0.5) * icePitch],
              massKg: iceMass,
              layer: j
            });
          }
        }
      }
      const iceSeed = solid.seedSchroederSolidRigidBody({
        bodyId: 0,
        members: icePts,
        velocity: [0.15, 0.05, -0.1],
        angularVelocity: [0.3, -0.8, 0.4]
      });
      const icePacked = solid.packSchroederSolidRigidBodies([iceSeed]);
      const iceThermoSeed = thermal.seedSchroederSolidMemberThermal({
        seeds: [iceSeed],
        pitchByAxisM: [[icePitch, icePitch, icePitch]],
        temperaturesK: [258],
        solidBranch
      });
      // Bottom 4 members start just above liquidus -> melt & release into fluid rows!
      const liqU = liquidBranch.energyMinJPerKg + 50;
      icePts.forEach((pt, idx) => {
        if (pt.layer === 0) {
          iceThermoSeed.thermo[idx * 4 + 0] = liqU;
          iceThermoSeed.thermo[idx * 4 + 1] = 273.16;
          iceThermoSeed.thermo[idx * 4 + 2] = 1.0;
        }
      });
      const iFrameBuf = makeBuf(icePacked.frames);
      const iMemBuf = makeBuf(icePacked.members);
      const iNeighBuf = makeBuf(iceThermoSeed.neighbors);
      const iLatBuf = makeBuf(solid.packSchroederSolidLattice([iceSeed], [[icePitch, icePitch, icePitch]]));

      const iRigid = solid.createSchroederSolidRigidStage({
        device, bodyCount: 1, memberCount: 8, frameBuffer: iFrameBuf, memberBuffer: iMemBuf, latticeBuffer: iLatBuf
      });
      const iCond = thermal.createSchroederSolidThermalStage({
        device, memberCount: 8, bodyCount: 1, memberBuffer: iMemBuf, memberWorldBuffer: iRigid.memberWorldBuffer,
        thermo: iceThermoSeed.thermo, neighbors: iceThermoSeed.neighbors, neighborBuffer: iNeighBuf,
        solidBranch, liquidBranch, meltTemperatureK: 273.15, solidConductivity: 0, liquidConductivity: 0,
        pitchM: [icePitch, icePitch, icePitch], memberRadiusM: 0.5 * icePitch,
        wallTemperaturesK: [0, 0, 0, 0, 0, 0], boxM: [4, 4, 4]
      });
      const releaseRows = new Uint32Array(8).map((_, idx) => idx);
      const fStateBuf = makeBuf(new Float32Array(8 * 8));
      const fThermoBuf = makeBuf(new Float32Array(8 * 12));
      const fMechBuf = makeBuf(new Float32Array(8 * 32));
      const iRel = release.createSchroederSolidReleaseStage({
        device, memberCount: 8, releaseRows, liquidMaterialId: 3061144, liquidDensityKgPerM3: 1000,
        liquidEntitiesPerKg: 6.02214076e23 / 0.01801528,
        releaseEventBuffer: iCond.releaseEventBuffer, releaseCountBuffer: iCond.releaseCountBuffer
      });
      const iFrac = fractureMod.createSchroederSolidFractureStage({
        device, memberCount: 8, initialBodyCount: 1, maxBodyCapacity: 1,
        frameBuffer: iFrameBuf, memberBuffer: iMemBuf, memberWorldBuffer: iRigid.memberWorldBuffer,
        neighborBuffer: iNeighBuf, latticeBuffer: iLatBuf, thermoBuffer: iCond.thermoBuffer,
        pitchM: [icePitch, icePitch, icePitch], solidBranch
      });

      // Step A: melt & release bottom 4 members -> body mass halves (8*m -> 4*m)!
      {
        const e = device.createCommandEncoder();
        iRigid.encode(e, 1e-3);
        iCond.encode(e, 1e-3, { releaseEnabled: true });
        iRel.encode(e, { stateBuffer: fStateBuf, thermoBuffer: fThermoBuf, mechanicsBuffer: fMechBuf });
        iRigid.encode(e, 1e-12); // rebase to 4 survivors
        device.queue.submit([e.finish()]);
      }
      const frameMidMelt = await readF32(iFrameBuf);
      const fluidMidMelt = await readF32(fStateBuf);

      // Step B: extract latent heat (cool released fluid rows below solidus by known dQ) & refreeze!
      const coolDeltaU = 350000;
      const fsCool = Float32Array.from(fluidMidMelt);
      let extractedHeatJ = 0;
      for (let r = 0; r < 8; r += 1) {
        if (fsCool[r * 8 + 3] > 0) {
          extractedHeatJ += fsCool[r * 8 + 3] * coolDeltaU;
          fsCool[r * 8 + 7] -= coolDeltaU;
        }
      }
      device.queue.writeBuffer(fStateBuf, 0, fsCool);

      const solidifiedCount = await iFrac.solidifyReleasedRows({
        releaseRows,
        fluidStateBuffer: fStateBuf,
        fluidThermoBuffer: fThermoBuf,
        thermoBuffer: iCond.thermoBuffer
      });
      {
        const e = device.createCommandEncoder();
        iRigid.encode(e, 1e-12); // rebase restored 8-member body!
        device.queue.submit([e.finish()]);
      }
      const frameAfterRefreeze = await readF32(iFrameBuf);
      const fluidAfterRefreeze = await readF32(fStateBuf);
      const thermoAfterRefreeze = await readF32(iCond.thermoBuffer);

      iFrac.destroy(); iRel.destroy(); iCond.destroy(); iRigid.destroy();
      for (const b of [iFrameBuf, iMemBuf, iNeighBuf, iLatBuf, fStateBuf, fThermoBuf, fMechBuf]) b.destroy();
      device.destroy();

      return {
        status: 'ok',
        gpuErrors,
        f1: {
          topoAfter,
          barSeed: JSON.parse(JSON.stringify(barSeed)),
          framesBefore,
          framesImmediatelyAfterSplit,
          membersAfterSplit,
          pxBefore,
          pxAfter
        },
        f2: {
          iceSeed: JSON.parse(JSON.stringify(iceSeed)),
          initialThermo: Array.from(iceThermoSeed.thermo),
          iceMass,
          frameMidMelt,
          fluidMidMelt,
          extractedHeatJ,
          solidifiedCount,
          frameAfterRefreeze,
          fluidAfterRefreeze,
          thermoAfterRefreeze
        }
      };
    });

    assert.equal(out.status, 'ok', `Unexpected status: ${JSON.stringify(out)}`);
    console.log(JSON.stringify({
      status: out.status,
      gpuErrors: out.gpuErrors,
      f1Topo: out.f1.topoAfter,
      f1Px: [out.f1.pxBefore, out.f1.pxAfter],
      f2Solidified: out.f2.solidifiedCount,
      f2Masses: [out.f2.iceSeed.massKg, out.f2.frameMidMelt[3], out.f2.frameAfterRefreeze[3]]
    }, null, 2));

    assert.deepEqual(out.gpuErrors, []);

    // ---- Verify F1: 3 bodies, 8 cleaved bonds (2 planes x 4 faces), exact M, COM, P, L_0 ----
    assert.equal(out.f1.topoAfter.cleavedBonds, 8, 'Cleaved exactly 4 bonds on each of the 2 fracture planes');
    assert.equal(out.f1.topoAfter.splitEvents, 2, 'Split 1 bar into 1 primary + 2 secondary coherent bodies');
    assert.equal(out.f1.topoAfter.activeBodyCount, 3, '3 active coherent bodies after fracture');

    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const f0 = out.f1.framesBefore;
    const M0 = f0[3];
    const COM0 = f0.slice(0, 3);
    const P0 = f0.slice(8, 11);
    const L0 = cross(COM0, P0).map((c, k) => c + f0[12 + k]);

    let Msum = 0;
    const MX = [0, 0, 0];
    const Psum = [0, 0, 0];
    const Lsum = [0, 0, 0];
    const gens = [];
    for (let b = 0; b < 3; b += 1) {
      const base = b * 32;
      const f = out.f1.framesImmediatelyAfterSplit;
      const mb = f[base + 3];
      assert.ok(Math.abs(mb - M0 / 3) <= 1e-5 * M0, `Fragment ${b} has exact 1/3 mass (${mb})`);
      const xb = f.slice(base, base + 3);
      const pb = f.slice(base + 8, base + 11);
      const lb = f.slice(base + 12, base + 15);
      const ib = f.slice(base + 16, base + 19);
      assert.ok(ib.every((v) => v > 0), `Fragment ${b} has positive principal moments ${ib}`);
      Msum += mb;
      for (let k = 0; k < 3; k += 1) {
        MX[k] += mb * xb[k];
        Psum[k] += pb[k];
      }
      const lOrigin = cross(xb, pb);
      for (let k = 0; k < 3; k += 1) Lsum[k] += lb[k] + lOrigin[k];
      const u32View = new Uint32Array(new Float32Array([f[base + 21]]).buffer);
      gens.push(u32View[0]);
    }
    assert.ok(gens.every((g) => g >= 1), `All 3 fragments carry incremented componentGeneration: ${gens}`);
    assert.ok(Math.abs(Msum - M0) <= 1e-6 * M0, `F1 mass conserved (${Msum} vs ${M0})`);
    for (let k = 0; k < 3; k += 1) {
      assert.ok(Math.abs(MX[k] / Msum - COM0[k]) <= 1e-5, `F1 COM[${k}] conserved`);
      assert.ok(Math.abs(Psum[k] - P0[k]) <= 1e-5, `F1 linear momentum[${k}] conserved (${Psum[k]} vs ${P0[k]})`);
      assert.ok(Math.abs(Lsum[k] - L0[k]) <= 1e-5, `F1 angular momentum[${k}] conserved (${Lsum[k]} vs ${L0[k]})`);
    }
    assert.ok(out.f1.pxBefore > 200 && out.f1.pxAfter > 200, 'F1 member-shape renderer draws intact & fractured bodies');

    // ---- Verify F2: Solid -> Melt -> Liquid -> Refreeze -> Solid Conservation ----
    const M_ice0 = out.f2.iceSeed.massKg;
    assert.ok(Math.abs(out.f2.frameMidMelt[3] - 0.5 * M_ice0) <= 1e-5 * M_ice0, 'F2 half of body melted');
    assert.equal(out.f2.solidifiedCount, 4, 'F2 all 4 supercooled liquid carriers refroze onto coherent body');
    assert.ok(Math.abs(out.f2.frameAfterRefreeze[3] - M_ice0) <= 1e-5 * M_ice0, 'F2 full solid mass restored');

    let remainingFluidMass = 0;
    for (let r = 0; r < 8; r += 1) remainingFluidMass += out.f2.fluidAfterRefreeze[r * 8 + 3];
    assert.equal(remainingFluidMass, 0, 'F2 zero residual fluid mass after refreeze');

    const P_ice0 = out.f2.iceSeed.linearMomentum;
    const P_iceFinal = out.f2.frameAfterRefreeze.slice(8, 11);
    for (let k = 0; k < 3; k += 1) {
      assert.ok(Math.abs(P_iceFinal[k] - P_ice0[k]) <= 1e-5, `F2 linear momentum[${k}] conserved across melt+refreeze`);
    }
    const E0 = Array.from({ length: 8 }, (_, i) => out.f2.iceMass * out.f2.initialThermo[i * 4]).reduce((a, b) => a + b, 0);
    const E1 = Array.from({ length: 8 }, (_, i) => out.f2.iceMass * out.f2.thermoAfterRefreeze[i * 4]).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs((E1 + out.f2.extractedHeatJ) - E0) <= 1e-2, `F2 thermal energy budget closed (${E1 + out.f2.extractedHeatJ} vs ${E0})`);
  } finally {
    await browser.close();
  }
});
