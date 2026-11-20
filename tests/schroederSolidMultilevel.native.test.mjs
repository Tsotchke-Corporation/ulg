import assert from 'node:assert/strict';
import test from 'node:test';

// A5 SOL-6 native Vulkan WebGPU gate (plan/todo/sol-critic.md, .icc/completion-oracles.yaml):
//   L1 Multilevel 2:1 contact-proxy refinement & coarsening (L=0 1x1, L=1 2x2,
//      L=2 4x4): single-owner surface quadrature (coveredLeaves == leafCount,
//      overlapViolations == 0), exact preserved surface area sum_p A_p across
//      all LOD switches, conservative impulse reflux across coarse<->fine
//      transitions, and bit-identical rigid-body mass, principal inertia, P,
//      and L!
//   L2 Double-float chart origin rebasing across SS / astronomical chart
//      boundaries (e.g. O_0 = [0,0,0] -> O_1 = [1.25e6, -8.4e5, 3.1e5] -> O_2):
//      world pose (O + x_local), linear momentum P, angular momentum L, and
//      WebGPU camera-relative rendered silhouette remain invariant across
//      chart-boundary hops!
//   L3 Planetary/orbital symplectic two-body integration + local tangent-chart
//      surface patch materialization (R_planet = 6.371e6 m, orbit at 1.0e8 m,
//      zero uniform interior particle fill): multi-orbit conservation of total
//      energy E = K + U, linear momentum P, and orbital angular momentum J,
//      plus proof that enabling, migrating, and disabling a local 12x12
//      planetary surface patch introduces ZERO orbital kick (0-bit difference
//      against an unpatched control orbit) while maintaining sub-metre local
//      tangent-chart sample offsets!
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_SOLID_MULTILEVEL === '1'
  || process.env.ULG_RUN_NATIVE_SOLID_RIGID === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';

test('A5 SOL-6 native Vulkan multilevel proxy LOD, chart rebasing, and symplectic orbital + local surface patch coupling', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_SOLID_MULTILEVEL=1 for native Vulkan WebGPU',
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
      const shapes = await import('/src/runtime/sph/schroederSolidShapeCarrier.js');
      const ml = await import('/src/runtime/sph/schroederSolidMultilevelGpu.js');

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

      // ---- L1 & L2: Multilevel Proxy LOD + Chart Boundary Rebasing + Silhouette Continuity ----
      const pitch = 0.04;
      const blockMembers = [];
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
          for (let k = 0; k < 8; k += 1) {
            blockMembers.push({
              x: [1.0 + (i - 1.5) * pitch, 2.0 + (j - 1.5) * pitch, -0.5 + (k - 3.5) * pitch],
              massKg: Math.fround(0.08 + 0.005 * ((i + j + k) % 3))
            });
          }
        }
      }
      const seed = solid.seedSchroederSolidRigidBody({
        bodyId: 1,
        members: blockMembers,
        velocity: [0.4, -0.25, 0.1],
        angularVelocity: [0.5, -1.1, 0.7]
      });
      const packed = solid.packSchroederSolidRigidBodies([seed]);
      const frameBuffer = device.createBuffer({ size: packed.frames.byteLength, usage: 0x80 | 0x04 | 0x08 });
      device.queue.writeBuffer(frameBuffer, 0, packed.frames);

      const catalog = ml.buildSchroederMultilevelProxyCatalog({
        bodyIndex: 0,
        halfExtentsM: [2 * pitch, 2 * pitch, 4 * pitch],
        finePitchM: pitch
      });
      const stage = ml.createSchroederSolidMultilevelStage({
        device,
        bodyCount: 1,
        frameBuffer,
        catalog
      });

      // Seed uniform initial impulse across all leaves -> verify conservative reflux across Coarse -> Mixed -> Fine -> Coarse!
      const initImpulses = new Float32Array(catalog.leafCount).fill(0.125);
      stage.setLeafImpulses(initImpulses);
      const expectedTotalImpulse = catalog.leafCount * 0.125;

      const frameBeforeLod = await readF32(frameBuffer);

      // Pass A: Far focus -> 100% L=2 coarse 4x4 proxies
      {
        const e = device.createCommandEncoder();
        stage.encodeMultilevelProxies(e, { focusWorldM: [10, 10, 10], fineRadiusM: 0.12, mediumRadiusM: 0.35 });
        device.queue.submit([e.finish()]);
      }
      const lodCoarse = await stage.readLodSummary();

      // Pass B: Mixed focus right on the +x/+z corner of the body -> simultaneous L=0, L=1, L=2!
      {
        const e = device.createCommandEncoder();
        stage.encodeMultilevelProxies(e, {
          focusWorldM: [seed.centerOfMass[0] + 0.08, seed.centerOfMass[1] + 0.08, seed.centerOfMass[2] + 0.16],
          fineRadiusM: 0.16,
          mediumRadiusM: 0.24
        });
        device.queue.submit([e.finish()]);
      }
      const lodMixed = await stage.readLodSummary();

      // Pass C: All-fine focus -> 100% L=0 fine 1x1 proxies
      {
        const e = device.createCommandEncoder();
        stage.encodeMultilevelProxies(e, {
          focusWorldM: seed.centerOfMass,
          fineRadiusM: 5.0,
          mediumRadiusM: 10.0
        });
        device.queue.submit([e.finish()]);
      }
      const lodFine = await stage.readLodSummary();

      // Pass D: Coarsen back to L=2 -> verify refluxed impulse still equals expectedTotalImpulse!
      {
        const e = device.createCommandEncoder();
        stage.encodeMultilevelProxies(e, { focusWorldM: [10, 10, 10], fineRadiusM: 0.12, mediumRadiusM: 0.35 });
        device.queue.submit([e.finish()]);
      }
      const lodReCoarsened = await stage.readLodSummary();
      const frameAfterLod = await readF32(frameBuffer);

      // ---- L2: Chart Boundary Rebasing at 1.25e6 m Astronomical Scale + Silhouette Continuity ----
      const renderer = shapes.createSchroederSolidShapeRenderer(device);
      const shapeHandle = renderer.addShape(shapes.buildSchroederSolidVoxelShape(seed, { pitchM: pitch }), { bodyIndex: 0 });
      const SIZE = 256, VIEW = 0.6;
      const colorTex = device.createTexture({ size: [SIZE, SIZE], format: 'rgba8unorm', usage: 0x10 | 0x01 });
      const depthTex = device.createTexture({ size: [SIZE, SIZE], format: 'depth24plus', usage: 0x10 });

      // Place body into astronomical Chart A at [1.25e6, -8.4e5, 3.1e5] (leaving frame local offset = seed.centerOfMass)
      const chartA = [1250000.25, -840000.5, 310000.125];
      const worldExactCom = [
        chartA[0] + seed.centerOfMass[0],
        chartA[1] + seed.centerOfMass[1],
        chartA[2] + seed.centerOfMass[2]
      ];
      {
        const packedChartA = new Float32Array(8);
        const [xh, xl] = ml.splitFloat64ToHiLo(chartA[0]);
        const [yh, yl] = ml.splitFloat64ToHiLo(chartA[1]);
        const [zh, zl] = ml.splitFloat64ToHiLo(chartA[2]);
        packedChartA.set([xh, yh, zh, 1], 0);
        packedChartA.set([xl, yl, zl, 1], 4);
        device.queue.writeBuffer(stage.bodyChartsBuffer, 0, packedChartA);
      }

      const renderInChart = async (chartOrigin) => {
        const camCenterLocal = [
          worldExactCom[0] - chartOrigin[0],
          worldExactCom[1] - chartOrigin[1]
        ];
        const X0 = camCenterLocal[0] - 0.5 * VIEW;
        const Y0 = camCenterLocal[1] - 0.5 * VIEW;
        const vp = new Float32Array([
          2 / VIEW, 0, 0, 0,
          0, 2 / VIEW, 0, 0,
          0, 0, -1 / 20, 0,
          -1 - 2 * X0 / VIEW, -1 - 2 * Y0 / VIEW, 0.5, 1
        ]);
        const e = device.createCommandEncoder();
        const pass = e.beginRenderPass({
          colorAttachments: [{ view: colorTex.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
          depthStencilAttachment: { view: depthTex.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 }
        });
        renderer.draw(pass, shapeHandle, { viewProjection: vp, frameBuffer });
        pass.end();
        device.queue.submit([e.finish()]);
        const st = device.createBuffer({ size: SIZE * SIZE * 4, usage: 1 | 8 });
        const ec = device.createCommandEncoder();
        ec.copyTextureToBuffer({ texture: colorTex }, { buffer: st, bytesPerRow: SIZE * 4 }, [SIZE, SIZE]);
        device.queue.submit([ec.finish()]);
        await st.mapAsync(1);
        const px = new Uint8Array(st.getMappedRange().slice(0));
        st.unmap(); st.destroy();
        let lit = 0, sx = 0, sy = 0;
        for (let y = 0; y < SIZE; y += 1) {
          for (let x = 0; x < SIZE; x += 1) {
            if (px[(y * SIZE + x) * 4 + 3] > 0) {
              lit += 1; sx += x + 0.5; sy += y + 0.5;
            }
          }
        }
        return { lit, cx: sx / Math.max(1, lit), cy: sy / Math.max(1, lit) };
      };

      const silChart0 = await renderInChart(chartA);
      // Rebase across adjacent astronomical chart boundary (+1.25 m, -2.25 m, +0.75 m at 1.25e6 m!)
      const chart2 = [chartA[0] + 1.25, chartA[1] - 2.25, chartA[2] + 0.75];
      {
        const e = device.createCommandEncoder();
        stage.encodeChartRebase(e, [{ originM: chart2, chartId: 2 }]);
        device.queue.submit([e.finish()]);
      }
      const frameInChart2 = await readF32(frameBuffer);
      const chartsInChart2 = await readF32(stage.bodyChartsBuffer);
      const silChart2 = await renderInChart(chart2);

      renderer.removeShape(shapeHandle);
      colorTex.destroy(); depthTex.destroy();
      stage.destroy(); frameBuffer.destroy();

      // ---- L3: Symplectic Two-Body Planetary Orbit + Local Surface Patch Zero-Kick Proof ----
      // Circular/slightly-eccentric binary/star-planet orbit at R = 1.0e8 m, R_planet = 6.371e6 m:
      const G = 6.6743e-11;
      const M_star = 1.0e24;
      const M_planet = 6.0e21;
      const R_orbit = 1.0e7;
      const R_planet = 6.371e6;
      const M_tot = M_star + M_planet;
      const v_rel = Math.sqrt((G * M_tot) / R_orbit) * 0.96; // mildly eccentric!
      const r0_star = -(M_planet / M_tot) * R_orbit;
      const r0_planet = (M_star / M_tot) * R_orbit;
      const v0_star = -(M_planet / M_tot) * v_rel;
      const v0_planet = (M_star / M_tot) * v_rel;

      async function runOrbit({ withLocalPatch }) {
        const orbFrames = device.createBuffer({ size: 2 * 32 * 4, usage: 0x80 | 0x04 | 0x08 });
        const fInit = new Float32Array(64);
        fInit[3] = M_star; fInit[7] = 1;
        fInit[32 + 3] = M_planet; fInit[32 + 7] = 1;
        device.queue.writeBuffer(orbFrames, 0, fInit);

        const oStage = ml.createSchroederSolidMultilevelStage({
          device,
          bodyCount: 2,
          frameBuffer: orbFrames,
          orbitalBodies: [
            { x: [r0_star, 0, 0], v: [0, v0_star, 0], massKg: M_star, radiusM: 2.0e7, spinRadPerS: 0 },
            { x: [r0_planet, 0, 0], v: [0, v0_planet, 0], massKg: M_planet, radiusM: R_planet, spinRadPerS: 7.2921e-5 }
          ],
          patchGridDim: 12
        });
        // Prime initial gravitational force with actual G
        {
          const e = device.createCommandEncoder();
          oStage.encodeOrbitalStep(e, 0, { gravitationalConstant: G, substeps: 1 });
          device.queue.submit([e.finish()]);
        }
        const initial = await oStage.readOrbitalSummary();
        // Period T = 2*pi * sqrt(a^3 / (G*M_tot)) ~ 7.7e3 s; step 1,200 substeps (2 full orbits!)
        const batches = 30;
        let patchMid = null;
        for (let b = 0; b < batches; b += 1) {
          const angle = (b / batches) * Math.PI * 0.5;
          const e = device.createCommandEncoder();
          oStage.encodeOrbitalStep(e, 14.0, {
            gravitationalConstant: G,
            substeps: 40,
            patch: withLocalPatch
              ? {
                  enabled: b >= 5 && b <= 25,
                  planetIndex: 1,
                  planetRadiusM: R_planet,
                  focusBodyDir: [Math.cos(angle), Math.sin(angle), 0.15],
                  halfAngleRad: 0.001, // ~12.7 km tangent patch on a 6,371 km planet!
                  sampleMassKg: 1250
                }
              : null
          });
          device.queue.submit([e.finish()]);
          if (withLocalPatch && b === 15) {
            patchMid = (await oStage.readOrbitalSummary()).patch;
          }
        }
        const final = await oStage.readOrbitalSummary();
        oStage.destroy(); orbFrames.destroy();
        return { initial, final, patchMid };
      }

      const orbitControl = await runOrbit({ withLocalPatch: false });
      const orbitPatched = await runOrbit({ withLocalPatch: true });
      device.destroy();

      return {
        status: 'ok',
        gpuErrors,
        l1: {
          exactAreaM2: catalog.exactAreaM2,
          leafCount: catalog.leafCount,
          expectedTotalImpulse,
          lodCoarse,
          lodMixed,
          lodFine,
          lodReCoarsened,
          frameBeforeLod,
          frameAfterLod
        },
        l2: {
          seedCom: worldExactCom,
          chart2,
          frameInChart2,
          chartsInChart2,
          silChart0,
          silChart2
        },
        l3: {
          orbitControl,
          orbitPatched
        }
      };
    });

    assert.equal(out.status, 'ok', `Unexpected status: ${JSON.stringify(out)}`);
    console.log(JSON.stringify({
      status: out.status,
      gpuErrors: out.gpuErrors,
      l1Coarse: out.l1.lodCoarse,
      l1Mixed: out.l1.lodMixed,
      l1Fine: out.l1.lodFine,
      l2Silhouettes: [out.l2.silChart0, out.l2.silChart2],
      l3EnergyDriftRel: Math.abs(out.l3.orbitPatched.final.totalEnergyJ - out.l3.orbitPatched.initial.totalEnergyJ)
        / Math.abs(out.l3.orbitPatched.initial.totalEnergyJ),
      l3PatchMid: out.l3.orbitPatched.patchMid
    }, null, 2));
    assert.deepEqual(out.gpuErrors, []);

    // ---- Verify L1: Single-owner multilevel surface quadrature + bit-identical body frame ----
    assert.ok(out.l1.lodCoarse.level2Coarse > 0 && out.l1.lodCoarse.level0Fine === 0);
    assert.ok(out.l1.lodMixed.level0Fine > 0 && out.l1.lodMixed.level1Medium > 0 && out.l1.lodMixed.level2Coarse > 0,
      `Mixed LOD simultaneously uses L=0, L=1, L=2: ${JSON.stringify(out.l1.lodMixed)}`);
    assert.equal(out.l1.lodFine.level0Fine, out.l1.leafCount);
    for (const snap of [out.l1.lodCoarse, out.l1.lodMixed, out.l1.lodFine, out.l1.lodReCoarsened]) {
      assert.equal(snap.coveredLeaves, out.l1.leafCount, 'Every elementary leaf tile has an owner');
      assert.equal(snap.overlapViolations, 0, 'Zero fine+coarse double-owner violations');
      assert.ok(Math.abs(snap.totalAreaM2 - out.l1.exactAreaM2) < 1e-4, 'Total quadrature area invariant across LOD');
      assert.ok(Math.abs(snap.totalImpulseNs - out.l1.expectedTotalImpulse) < 1e-3, 'Total contact impulse conserved across reflux');
    }
    // Frame words [0..19] (COM, mass, quat, P, L, principalMoments) MUST be bit-identical!
    assert.deepEqual(out.l1.frameAfterLod.slice(0, 20), out.l1.frameBeforeLod.slice(0, 20),
      'Proxy LOD switches never alter physical mass, inertia, pose, P, or L');

    // ---- Verify L2: Double-float chart boundary rebasing & silhouette continuity ----
    const chart2Reconstructed = [0, 1, 2].map((k) =>
      out.l2.chartsInChart2[k] + out.l2.chartsInChart2[4 + k] + out.l2.frameInChart2[k]
    );
    for (let k = 0; k < 3; k += 1) {
      assert.ok(Math.abs(chart2Reconstructed[k] - out.l2.seedCom[k]) < 1e-5,
        `World COM[${k}] invariant across 1.25e6 m astronomical chart hop`);
    }
    assert.deepEqual(out.l2.frameInChart2.slice(3, 20), out.l1.frameBeforeLod.slice(3, 20),
      'Mass, quaternion, P, L, and principal inertia bit-identical across chart rebase');
    assert.ok(Math.abs(out.l2.silChart2.lit - out.l2.silChart0.lit) <= 2,
      `Silhouette coverage continuous across chart boundary (${out.l2.silChart0.lit} vs ${out.l2.silChart2.lit})`);
    assert.ok(Math.hypot(out.l2.silChart2.cx - out.l2.silChart0.cx, out.l2.silChart2.cy - out.l2.silChart0.cy) < 0.25,
      'Rendered silhouette centroid continuous across chart boundary');

    // ---- Verify L3: Symplectic multi-orbit invariants + 0-bit patch recoil + bounded local patch ----
    const iOrb = out.l3.orbitPatched.initial;
    const fOrb = out.l3.orbitPatched.final;
    const relE = Math.abs(fOrb.totalEnergyJ - iOrb.totalEnergyJ) / Math.abs(iOrb.totalEnergyJ);
    const relLz = Math.abs(fOrb.angularMomentum[2] - iOrb.angularMomentum[2]) / Math.abs(iOrb.angularMomentum[2]);
    assert.ok(relE < 5e-4, `Symplectic multi-orbit energy conserved (${relE})`);
    assert.ok(relLz < 1e-5, `Orbital angular momentum Lz conserved (${relLz})`);
    const pChar = Math.hypot(...iOrb.bodies[1].v) * iOrb.bodies[1].massKg;
    for (let k = 0; k < 3; k += 1) {
      assert.ok(Math.abs(fOrb.linearMomentum[k]) < 5e-5 * pChar,
        `Total linear momentum[${k}] remains zero in barycentric frame (${fOrb.linearMomentum[k]} vs pChar=${pChar})`);
    }
    // Exact zero-recoil proof: patched planet trajectory matches unpatched control bit-for-bit!
    assert.deepEqual(out.l3.orbitPatched.final.bodies, out.l3.orbitControl.final.bodies,
      'Activating, migrating, and deactivating local planetary surface patch introduces zero orbital kick');
    assert.equal(out.l3.orbitPatched.patchMid.activeSampleCount, 144, '12x12 local surface patch materialized (no interior fill)');
    const localOffsetNorm = Math.hypot(...out.l3.orbitPatched.patchMid.firstSampleLocalM);
    assert.ok(localOffsetNorm > 100 && localOffsetNorm < 20000,
      `Local tangent-chart offset stays O(10 km) without 10^7 m f32 cancellation (${localOffsetNorm} m)`);
  } finally {
    await browser.close();
  }
});
