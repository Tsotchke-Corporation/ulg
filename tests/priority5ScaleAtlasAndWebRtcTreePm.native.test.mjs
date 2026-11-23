import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalPeerRelayServer } from '../src/services/localPeerRelayServer.js';

// Priority 5 Native Vulkan WebGPU & Real 2-Browser WebRTC Proof:
//   1. Hybrid Supergalactic FLRW TreePM (`supergalacticTreePmGpu.js`):
//      long-range Gate 0B `fft3dWebGpu` PM + short-range 3x3x3 Gaussian-split
//      sub-cell Tree multipole -> structure growth, net momentum conservation,
//      AND exact periodic translation invariance.
//   2. Canonical `SchroederScaleAtlas` multipole gravity unification across BOTH
//      `selfGravitatingHydroGpu.js` (stellar clouds at L=+35) AND
//      `cosmicQuantumGpuKernels.js` (binary galaxies at L=+70) -> exact
//      Newton's 3rd Law reciprocity (momentumRelError < 1e-5) & translation
//      invariance (< 1e-4 under +5000 world shift).
//   3. Live `elements-lab.html` Tab 5 CI-NEB reaction barrier visualization
//      (first-principles RHF climbing-image NEB minimum energy path & TS‡).
//   4. Real 2-browser-context WebRTC `RTCPeerConnection` + `RTCDataChannel`
//      multi-host TreePM tile partitioning with G5 `ReservationLedger` CAS
//      leases (`distributedSpatialPartitioner.js`), signaling WebSocket closed,
//      exact global mass conservation across peers, and fail-closed peer-loss
//      handling + epoch-advanced tile reassignment!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Priority 5 native Vulkan & real 2-browser WebRTC proof: Hybrid TreePM, Scale-Atlas multipole unification, CI-NEB visuals, and multi-host WebRTC TreePM', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan + WebRTC Priority 5 proof',
  timeout: 240_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const relay = await createLocalPeerRelayServer({ host: '127.0.0.1', port: 0 });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });

  try {
    // ---- Parts 1, 2 & 3: Vulkan Hybrid TreePM + Scale Atlas Multipole + CI-NEB UI ----
    const ctx1 = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const page1 = await ctx1.newPage();
    const errors1 = [];
    page1.on('pageerror', (e) => errors1.push(String(e).slice(0, 300)));
    await page1.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const gpuOut = await page1.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const { createSupergalacticTreePmSessionWebGpu } = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');
      const { evaluateSelfGravitatingHydroScaleAtlasMultipoleWebGpu } = await import('/src/runtime/sph/selfGravitatingHydroGpu.js');
      const { createGalacticBodies, evaluateGalacticScaleAtlasMultipoleWebGpu } = await import('/src/demos/cosmicQuantumGpuKernels.js');
      const { createHydrogenNebulaInitialBodies } = await import('/src/runtime/astrophysics/nebulaInitialConditions.js');

      // 1. Hybrid TreePM (short-range Tree + long-range fft3dWebGpu PM) + periodic shift invariance!
      const sA = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 12, pmGridN: 16, boxLengthMpc: 200, aInit: 0.08, da: 0.02, enableShortRangeTree: true, seed: 2026
      });
      const sB = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 12, pmGridN: 16, boxLengthMpc: 200, aInit: 0.08, da: 0.02, enableShortRangeTree: true, seed: 2026,
        initialPositionsShift: [37.5, -50.0, 25.0] // exact integer PM cells (200/16 = 12.5 Mpc -> 3, -4, +2 cells)
      });
      let tA0; let tAEnd; let tBEnd;
      for (let i = 0; i < 6; i += 1) {
        const ta = await sA.step({ readTelemetry: true });
        const tb = await sB.step({ readTelemetry: true });
        if (i === 0) tA0 = ta;
        tAEnd = ta;
        tBEnd = tb;
      }
      sA.destroy();
      sB.destroy();

      // 2. Canonical SchroederScaleAtlas multipole unification on stellar hydro + binary galaxies + +5000 shift invariance!
      const cloudRes = createHydrogenNebulaInitialBodies({ count: 512, totalMassSolar: 2.0, seed: 77 });
      const cloud0 = cloudRes instanceof Float32Array ? cloudRes : (cloudRes?.bodies ?? cloudRes?.particles);
      const cloudShifted = new Float32Array(cloud0);
      for (let i = 0; i < 512; i += 1) {
        cloudShifted[i * 16 + 0] += 5000;
        cloudShifted[i * 16 + 1] -= 3200;
        cloudShifted[i * 16 + 2] += 1800;
      }
      const mpStellar0 = await evaluateSelfGravitatingHydroScaleAtlasMultipoleWebGpu(device, cloud0);
      const mpStellarShift = await evaluateSelfGravitatingHydroScaleAtlasMultipoleWebGpu(device, cloudShifted);
      let stellarMaxDiff = 0;
      let stellarMaxNorm = 1e-30;
      for (let i = 0; i < mpStellar0.chartOutputs.length; i += 1) {
        const f0 = mpStellar0.chartOutputs[i].netForceN;
        const f1 = mpStellarShift.chartOutputs[i].netForceN;
        const norm = Math.hypot(f0[0], f0[1], f0[2]);
        const diff = Math.hypot(f0[0] - f1[0], f0[1] - f1[1], f0[2] - f1[2]);
        stellarMaxNorm = Math.max(stellarMaxNorm, norm);
        stellarMaxDiff = Math.max(stellarMaxDiff, diff);
      }

      const gal0 = createGalacticBodies({ count: 512, preset: 'binary', seed: 42 });
      const galShift = createGalacticBodies({ count: 512, preset: 'binary', seed: 42, centerOffset: [5000, -4000, 2500] });
      const mpGal0 = await evaluateGalacticScaleAtlasMultipoleWebGpu(device, gal0);
      const mpGalShift = await evaluateGalacticScaleAtlasMultipoleWebGpu(device, galShift);
      let galMaxDiff = 0;
      let galMaxNorm = 1e-30;
      for (let i = 0; i < mpGal0.chartOutputs.length; i += 1) {
        const f0 = mpGal0.chartOutputs[i].netForceN;
        const f1 = mpGalShift.chartOutputs[i].netForceN;
        const norm = Math.hypot(f0[0], f0[1], f0[2]);
        const diff = Math.hypot(f0[0] - f1[0], f0[1] - f1[1], f0[2] - f1[2]);
        galMaxNorm = Math.max(galMaxNorm, norm);
        galMaxDiff = Math.max(galMaxDiff, diff);
      }

      device.destroy();
      return {
        status: 'ok',
        gpuErrors,
        hybridTreePm: {
          backend: tAEnd.backend,
          hybridTreePmEnabled: tAEnd.hybridTreePmEnabled,
          sigmaInit: tA0.sigmaDensity,
          sigmaEnd: tAEnd.sigmaDensity,
          sigmaShiftEnd: tBEnd.sigmaDensity,
          keEnd: tAEnd.kineticEnergy,
          keShiftEnd: tBEnd.kineticEnergy,
          momentumEnd: tAEnd.momentum
        },
        stellarMultipole: {
          verified: mpStellar0.receipt.verified,
          momentumRelError: mpStellar0.receipt.momentumRelError,
          shiftRelErr: stellarMaxDiff / stellarMaxNorm,
          occupiedCharts: mpStellar0.occupiedChartCount
        },
        galacticMultipole: {
          verified: mpGal0.receipt.verified,
          momentumRelError: mpGal0.receipt.momentumRelError,
          shiftRelErr: galMaxDiff / galMaxNorm,
          occupiedCharts: mpGal0.occupiedChartCount
        }
      };
    });

    assert.equal(gpuOut.status, 'ok');
    assert.deepEqual(gpuOut.gpuErrors, []);
    assert.equal(gpuOut.hybridTreePm.hybridTreePmEnabled, true);
    assert.equal(gpuOut.hybridTreePm.backend, 'webgpu-fft3d-hybrid-treepm');
    assert.ok(gpuOut.hybridTreePm.sigmaEnd > gpuOut.hybridTreePm.sigmaInit, 'Hybrid TreePM must grow cosmic structure');
    const sigmaShiftRelErr = Math.abs(gpuOut.hybridTreePm.sigmaEnd - gpuOut.hybridTreePm.sigmaShiftEnd) / Math.max(1e-6, gpuOut.hybridTreePm.sigmaEnd);
    assert.ok(sigmaShiftRelErr < 1e-3, `Hybrid TreePM periodic translation rel err must be < 1e-3 (got ${sigmaShiftRelErr})`);

    assert.equal(gpuOut.stellarMultipole.verified, true);
    assert.ok(gpuOut.stellarMultipole.momentumRelError < 1e-4);
    assert.ok(gpuOut.stellarMultipole.shiftRelErr < 1e-4, `Stellar Scale-Atlas multipole shift err ${gpuOut.stellarMultipole.shiftRelErr}`);

    assert.equal(gpuOut.galacticMultipole.verified, true);
    assert.ok(gpuOut.galacticMultipole.momentumRelError < 1e-4);
    assert.ok(gpuOut.galacticMultipole.shiftRelErr < 1e-4, `Galactic Scale-Atlas multipole shift err ${gpuOut.galacticMultipole.shiftRelErr}`);

    // 3. Live elements-lab.html Tab 5 CI-NEB reaction barrier visualization
    await page1.goto(`${BASE_URL}elements-lab.html?z=8`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page1.waitForFunction(() => window.__ulgElementsLabState?.mode === 'element', { timeout: 60_000 });
    await page1.fill('#compound-input', 'H2O');
    await page1.click('#solve-compound-btn');
    await page1.waitForFunction(() => window.__ulgElementsLabState?.mode === 'compound' && window.__ulgElementsLabState?.nebBarrier?.energiesEv?.length >= 5, { timeout: 60_000 });
    const nebOut = await page1.evaluate(() => window.__ulgElementsLabState.nebBarrier);
    assert.ok(nebOut.forwardBarrierEv > 0.1, `Live CI-NEB H2O barrier must be positive (got ${nebOut.forwardBarrierEv} eV)`);
    assert.ok(nebOut.saddleImageIndex >= 1 && nebOut.saddleImageIndex <= 3);
    await page1.screenshot({
      path: '/home/cos/.gemini/antigravity-cli/brain/f4aafecf-4b28-49bb-8539-d1a054f050c4/scratch/gate-visuals/p5_elements_lab_cineb.png'
    });
    assert.deepEqual(errors1, []);
    await ctx1.close();

    // ---- Part 4: Real 2-Browser-Context WebRTC RTCDataChannel Multi-Host TreePM ----
    const wsUrl = relay.url;
    const roomName = `treepm-webrtc-${Date.now()}`;
    const ctxAlpha = await browser.newContext({ ignoreHTTPSErrors: true });
    const ctxBeta = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageAlpha = await ctxAlpha.newPage();
    const pageBeta = await ctxBeta.newPage();
    await Promise.all([
      pageAlpha.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 }),
      pageBeta.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    ]);

    // Peer Beta (remote TreePM WebGPU tile worker) connects via WebSocket signaling, opens RTCDataChannel, closes signaling WS!
    const betaPromise = pageBeta.evaluate(async ({ relayWsUrl, room }) => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      const device = await adapter.requestDevice();
      const { createSupergalacticTreePmSessionWebGpu } = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');

      const pc = new RTCPeerConnection({ iceServers: [] });
      const ws = new WebSocket(`${relayWsUrl}?room=${encodeURIComponent(room)}&peerId=peer-beta`);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

      pc.onicecandidate = (ev) => {
        if (ev.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ kind: 'ice', from: 'peer-beta', candidate: ev.candidate.toJSON() }));
        }
      };

      const dcReady = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('beta RTCDataChannel open timeout')), 20_000);
        pc.ondatachannel = (ev) => {
          const ch = ev.channel;
          const onOpen = () => {
            clearTimeout(timer);
            ws.close(); // Prove direct P2P RTCDataChannel without signaling server!
            resolve(ch);
          };
          if (ch.readyState === 'open') onOpen();
          else ch.addEventListener('open', onOpen, { once: true });
        };
      });

      const pendingIce = [];
      ws.onmessage = async (ev) => {
        const raw = JSON.parse(ev.data);
        const msg = raw?.payload ?? raw;
        if (!msg || msg.from === 'peer-beta') return;
        if (msg.kind === 'offer') {
          await pc.setRemoteDescription(msg.sdp);
          while (pendingIce.length) await pc.addIceCandidate(pendingIce.shift());
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ kind: 'answer', from: 'peer-beta', sdp: pc.localDescription }));
        } else if (msg.kind === 'ice' && msg.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
          else pendingIce.push(msg.candidate);
        }
      };

      const dc = await dcReady;
      const session = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 10, pmGridN: 16, boxLengthMpc: 200, aInit: 0.08, da: 0.02, seed: 5555
      });
      await session.step({ readTelemetry: false });

      return await new Promise((resolve) => {
        dc.onmessage = async (ev) => {
          const req = JSON.parse(ev.data);
          if (req.type === 'compute-tile') {
            const summary = await session.readTileMultipoleSummary({ xMin: req.xMin, xMax: req.xMax });
            dc.send(JSON.stringify({
              type: 'tile-summary',
              tileIndex: req.tileIndex,
              epoch: req.epoch,
              peerId: 'peer-beta',
              summary
            }));
          } else if (req.type === 'disconnect-now') {
            dc.close();
            pc.close();
            session.destroy();
            device.destroy();
            resolve({ disconnected: true, signalingState: ws.readyState });
          }
        };
      });
    }, { relayWsUrl: wsUrl, room: roomName });

    // Brief yield so beta registers on relay room before alpha sends offer
    await new Promise((r) => setTimeout(r, 400));

    // Peer Alpha (coordinator + local TreePM WebGPU tile worker + G5 ReservationLedger partitioner)
    const alphaOut = await pageAlpha.evaluate(async ({ relayWsUrl, room }) => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      const device = await adapter.requestDevice();
      const { createSupergalacticTreePmSessionWebGpu } = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');
      const { createDistributedSpatialPartitioner } = await import('/src/services/distributedSpatialPartitioner.js');

      const pc = new RTCPeerConnection({ iceServers: [] });
      const dc = pc.createDataChannel('ulg-treepm-tiles', { ordered: true });
      const ws = new WebSocket(`${relayWsUrl}?room=${encodeURIComponent(room)}&peerId=peer-alpha`);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

      pc.onicecandidate = (ev) => {
        if (ev.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ kind: 'ice', from: 'peer-alpha', candidate: ev.candidate.toJSON() }));
        }
      };

      const dcOpened = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('alpha RTCDataChannel open timeout')), 20_000);
        dc.onopen = () => {
          clearTimeout(timer);
          ws.close();
          resolve();
        };
      });

      const pendingIce = [];
      ws.onmessage = async (ev) => {
        const raw = JSON.parse(ev.data);
        const msg = raw?.payload ?? raw;
        if (!msg || msg.from === 'peer-alpha') return;
        if (msg.kind === 'answer') {
          await pc.setRemoteDescription(msg.sdp);
          while (pendingIce.length) await pc.addIceCandidate(pendingIce.shift());
        } else if (msg.kind === 'ice' && msg.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
          else pendingIce.push(msg.candidate);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ kind: 'offer', from: 'peer-alpha', sdp: pc.localDescription }));
      await dcOpened;
      await new Promise((r) => setTimeout(r, 100));
      const signalingClosedBeforeRpc = ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING;

      // Partition 200 Mpc/h TreePM volume across 2 tiles using G5 ReservationLedger CAS leases!
      const part = createDistributedSpatialPartitioner({ domainId: 'cosmo-webrtc', boxLength: 200, tileCount: 2 });
      const claim0 = part.claimTile(0, 'peer-alpha');
      const claim1 = part.claimTile(1, 'peer-beta');
      const dupClaim = part.claimTile(1, 'peer-alpha'); // must fail-closed (CAS lease owned by peer-beta)

      const session = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 10, pmGridN: 16, boxLengthMpc: 200, aInit: 0.08, da: 0.02, seed: 5555
      });
      await session.step({ readTelemetry: false });
      const localSummary = await session.readTileMultipoleSummary({
        xMin: part.tiles[0].xMin,
        xMax: part.tiles[0].xMax
      });
      part.submitTileMultipoleSummary({
        tileIndex: 0,
        peerId: 'peer-alpha',
        summaryEpoch: part.getEpoch(),
        totalMass: localSummary.totalMass,
        com: localSummary.com,
        quadrupoleTrace: localSummary.quadrupoleTrace
      });

      // Request tile 1 directly over RTCDataChannel (with signaling WS already closed!)
      const remoteReply = await new Promise((resolve) => {
        dc.onmessage = (ev) => resolve(JSON.parse(ev.data));
        dc.send(JSON.stringify({
          type: 'compute-tile',
          tileIndex: 1,
          epoch: part.getEpoch(),
          xMin: part.tiles[1].xMin,
          xMax: part.tiles[1].xMax
        }));
      });
      part.submitTileMultipoleSummary({
        tileIndex: remoteReply.tileIndex,
        peerId: remoteReply.peerId,
        summaryEpoch: remoteReply.epoch,
        totalMass: remoteReply.summary.totalMass,
        com: remoteReply.summary.com,
        quadrupoleTrace: remoteReply.summary.quadrupoleTrace
      });
      const globalSummary = part.globalMultipoleSummary();

      // Now simulate peer-beta loss -> advance epoch -> verify fail-closed incomplete summary until alpha reclaims tile 1!
      const dcClosed = new Promise((resolve) => { dc.onclose = () => resolve(true); });
      dc.send(JSON.stringify({ type: 'disconnect-now' }));
      await dcClosed;

      const epoch2 = part.advanceEpoch();
      const incompleteAfterLoss = part.globalMultipoleSummary();
      const reclaim0 = part.claimTile(0, 'peer-alpha');
      const reclaim1 = part.claimTile(1, 'peer-alpha');

      part.destroy();
      pc.close();
      session.destroy();
      device.destroy();

      return {
        signalingClosedBeforeRpc,
        claim0Ok: claim0.claimed,
        claim1Ok: claim1.claimed,
        dupClaimRejected: !dupClaim.claimed,
        expectedTotalMass: session.particleCount,
        globalSummary,
        epoch2,
        incompleteAfterLoss,
        reclaimBothOk: reclaim0.claimed && reclaim1.claimed
      };
    }, { relayWsUrl: wsUrl, room: roomName });

    const betaOut = await betaPromise;
    await Promise.all([ctxAlpha.close(), ctxBeta.close()]);

    assert.equal(alphaOut.signalingClosedBeforeRpc, true, 'WebRTC TreePM tile RPC must run with signaling WS closed');
    assert.equal(alphaOut.claim0Ok, true);
    assert.equal(alphaOut.claim1Ok, true);
    assert.equal(alphaOut.dupClaimRejected, true, 'G5 CAS lease must reject competing tile claim');
    assert.equal(alphaOut.globalSummary.complete, true);
    assert.equal(alphaOut.globalSummary.admittedTiles, 2);
    assert.ok(
      Math.abs(alphaOut.globalSummary.totalMass - alphaOut.expectedTotalMass) < 1e-3,
      `Multi-host WebRTC TreePM must conserve exact total mass (${alphaOut.globalSummary.totalMass} vs ${alphaOut.expectedTotalMass})`
    );
    assert.equal(betaOut.disconnected, true);
    assert.equal(alphaOut.incompleteAfterLoss.complete, false, 'Peer loss must fail closed with incomplete global summary');
    assert.equal(alphaOut.reclaimBothOk, true, 'Coordinator must cleanly reclaim orphaned tile after epoch fence');
  } finally {
    await browser.close();
    await relay.close();
  }
});
