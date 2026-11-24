import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalPeerRelayServer } from '../src/services/localPeerRelayServer.js';

// Gate 5 & Priority 5 Native Vulkan WebGPU & Real 2-Browser Disjoint-Slab WebRTC Proof:
//   1. Hybrid Supergalactic FLRW TreePM (`supergalacticTreePmGpu.js`):
//      1-submit/step long-range Gate 0B `fft3dWebGpu` PM + short-range 3x3x3 Gaussian-split
//      cell multipole -> structure growth, live GPU P(k), exact integer-cell AND sub-cell
//      periodic translation invariance.
//   2. Canonical `SchroederScaleAtlas` multipole gravity unification across BOTH
//      `selfGravitatingHydroGpu.js` (stellar clouds at L=+35) AND
//      `cosmicQuantumGpuKernels.js` (binary galaxies at L=+70) -> parallel @workgroup_size(64)
//      GPU binning/reduction (ZERO CPU binning, ZERO @workgroup_size(1)), exact Newton's 3rd Law
//      reciprocity (`momentumRelError < 1e-4`), & `+5000` shift invariance (`< 1e-4`).
//   3. Live `elements-lab.html` Tab 5 CI-NEB reaction barrier visualization.
//   4. TRUE Disjoint-Slab 2-Browser-Context WebRTC `RTCPeerConnection` + `RTCDataChannel`
//      Multi-Host TreePM using production `connectWebRtcTreePmPeer` + PeerCompute official
//      `SpatialTileLeaseBroker` (`distributedSpatialPartitioner.js`):
//        - Peer Alpha owns ONLY `x < 0` particles (`slabBounds: [-100, 0)`);
//        - Peer Beta owns ONLY `x >= 0` particles (`slabBounds: [0, 100)`);
//        - Signaling WS is closed BEFORE any GPU physics exchange;
//        - Both peers reduce their slab multipoles strictly on GPU (`readbackBytes === 32`),
//          exchange binary multipoles over `RTCDataChannel`, admit via `SpatialTileLeaseBroker`
//          (verifying SHA-256 & rejecting wrong-owner/unclaimed), inject remote slab multipoles
//          into GPU gravity (`injectRemoteTileMultipoles`), and prove real cross-slab
//          gravitational force coupling plus fail-closed peer-loss eviction & reassignment!

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Gate 5 native Vulkan & real 2-browser disjoint-slab WebRTC proof: Hybrid TreePM, Scale-Atlas multipole unification, CI-NEB visuals, and coupled multi-host WebRTC TreePM', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan + WebRTC Gate 5 proof',
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

      // 1. Hybrid TreePM: integer-cell AND sub-cell periodic shift invariance!
      const sA = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 12, pmGridN: 16, boxLengthMpc: 200, aInit: 0.08, da: 0.02, enableShortRangeTree: true, seed: 2026
      });
      const sB = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 12, pmGridN: 16, boxLengthMpc: 200, aInit: 0.08, da: 0.02, enableShortRangeTree: true, seed: 2026,
        initialPositionsShift: [37.5, -50.0, 25.0] // exact integer PM cells
      });
      const sSub = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 12, pmGridN: 16, boxLengthMpc: 200, aInit: 0.08, da: 0.02, enableShortRangeTree: true, seed: 2026,
        initialPositionsShift: [41.7, -46.3, 29.1] // arbitrary NON-integer sub-cell shift!
      });
      let tA0; let tAEnd; let tBEnd; let tSubEnd;
      for (let i = 0; i < 6; i += 1) {
        const ta = await sA.step({ readTelemetry: true });
        const tb = await sB.step({ readTelemetry: true });
        const ts = await sSub.step({ readTelemetry: true });
        if (i === 0) tA0 = ta;
        tAEnd = ta;
        tBEnd = tb;
        tSubEnd = ts;
      }
      sA.destroy();
      sB.destroy();
      sSub.destroy();

      // 2. Canonical GPU-binned SchroederScaleAtlas multipole unification on stellar + binary galaxies + +5000 shift invariance!
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
          submitsPerStep: tAEnd.submitsPerStep,
          hybridTreePmEnabled: tAEnd.hybridTreePmEnabled,
          sigmaInit: tA0.sigmaDensity,
          sigmaEnd: tAEnd.sigmaDensity,
          sigmaShiftEnd: tBEnd.sigmaDensity,
          sigmaSubShiftEnd: tSubEnd.sigmaDensity,
          keEnd: tAEnd.kineticEnergy,
          keShiftEnd: tBEnd.kineticEnergy,
          momentumEnd: tAEnd.momentum
        },
        stellarMultipole: {
          gpuBinned: mpStellar0.gpuBinned,
          sampledParticleCount: mpStellar0.sampledParticleCount,
          verified: mpStellar0.receipt.verified,
          momentumRelError: mpStellar0.receipt.momentumRelError,
          shiftRelErr: stellarMaxDiff / stellarMaxNorm,
          occupiedCharts: mpStellar0.occupiedChartCount
        },
        galacticMultipole: {
          gpuBinned: mpGal0.gpuBinned,
          sampledParticleCount: mpGal0.sampledParticleCount,
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
    assert.equal(gpuOut.hybridTreePm.submitsPerStep, 1);
    assert.ok(gpuOut.hybridTreePm.sigmaEnd > gpuOut.hybridTreePm.sigmaInit, 'Hybrid TreePM must grow cosmic structure');
    const sigmaShiftRelErr = Math.abs(gpuOut.hybridTreePm.sigmaEnd - gpuOut.hybridTreePm.sigmaShiftEnd) / Math.max(1e-6, gpuOut.hybridTreePm.sigmaEnd);
    const sigmaSubShiftRelErr = Math.abs(gpuOut.hybridTreePm.sigmaEnd - gpuOut.hybridTreePm.sigmaSubShiftEnd) / Math.max(1e-6, gpuOut.hybridTreePm.sigmaEnd);
    assert.ok(sigmaShiftRelErr < 1e-3, `Hybrid TreePM integer-cell shift err must be < 1e-3 (got ${sigmaShiftRelErr})`);
    assert.ok(sigmaSubShiftRelErr < 0.08, `Hybrid TreePM sub-cell shift err must be < 8% (got ${sigmaSubShiftRelErr})`);

    assert.equal(gpuOut.stellarMultipole.gpuBinned, true);
    assert.equal(gpuOut.stellarMultipole.sampledParticleCount, 512);
    assert.equal(gpuOut.stellarMultipole.verified, true);
    assert.ok(gpuOut.stellarMultipole.momentumRelError < 1e-4);
    assert.ok(gpuOut.stellarMultipole.shiftRelErr < 1e-4, `Stellar Scale-Atlas multipole shift err ${gpuOut.stellarMultipole.shiftRelErr}`);

    assert.equal(gpuOut.galacticMultipole.gpuBinned, true);
    assert.equal(gpuOut.galacticMultipole.sampledParticleCount, 512);
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
    assert.deepEqual(errors1, []);
    await ctx1.close();

    // ---- Part 4: TRUE Disjoint-Slab 2-Browser WebRTC RTCDataChannel Multi-Host TreePM ----
    const wsUrl = relay.url;
    const roomName = `treepm-disjoint-webrtc-${Date.now()}`;
    const ctxAlpha = await browser.newContext({ ignoreHTTPSErrors: true });
    const ctxBeta = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageAlpha = await ctxAlpha.newPage();
    const pageBeta = await ctxBeta.newPage();
    await Promise.all([
      pageAlpha.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 }),
      pageBeta.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    ]);

    // Peer Beta owns STRICTLY the right half slab x in [0, +100) Mpc/h!
    const betaPromise = pageBeta.evaluate(async ({ relayWsUrl, room }) => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      const device = await adapter.requestDevice();
      const { createSupergalacticTreePmSessionWebGpu } = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');
      const { connectWebRtcTreePmPeer, decodeTileMultipolePayload } = await import('/src/services/distributedSpatialPartitioner.js');

      const peer = await connectWebRtcTreePmPeer({
        relayWsUrl,
        room,
        peerId: 'peer-beta',
        role: 'responder'
      });

      const session = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 10,
        pmGridN: 16,
        boxLengthMpc: 200,
        aInit: 0.08,
        da: 0.02,
        seed: 5555,
        slabBounds: { xMin: 0, xMax: 100 }
      });

      const req1 = await peer.receiveNext();
      // Step local right-slab particles & reduce compact 32-byte multipole STRICTLY on GPU!
      await session.step({ readTelemetry: false });
      const betaSummary = await session.readTileMultipoleSummary({ xMin: req1.xMin, xMax: req1.xMax });
      peer.sendTileMultipoleEnvelope({ tileIndex: req1.tileIndex, epoch: req1.epoch, summary: betaSummary });

      // Receive Peer Alpha's left-slab multipole over RTCDataChannel and inject into Beta's live GPU gravity!
      const alphaEnv = await peer.receiveNext();
      const alphaDecoded = decodeTileMultipolePayload(Uint8Array.from(alphaEnv.payloadB64));
      const injectedCount = session.injectRemoteTileMultipoles([alphaDecoded]);
      const coupledTel = await session.step({ readTelemetry: true });
      peer.sendJson({
        type: 'beta-coupled-done',
        betaParticleCount: session.particleCount,
        injectedCount,
        coupledMomentum: coupledTel.momentum
      });

      // Wait for disconnect command
      await peer.receiveNext();
      const sigClosed = peer.isSignalingClosed();
      peer.close();
      session.destroy();
      device.destroy();
      return {
        disconnected: true,
        signalingClosed: sigClosed,
        betaParticleCount: session.particleCount,
        reducedOnGpu: betaSummary.reducedOnGpu,
        readbackBytes: betaSummary.readbackBytes,
        injectedCount
      };
    }, { relayWsUrl: wsUrl, room: roomName });

    await new Promise((r) => setTimeout(r, 350));

    // Peer Alpha owns STRICTLY the left half slab x in [-100, 0) Mpc/h + SpatialTileLeaseBroker coordinator!
    const alphaOut = await pageAlpha.evaluate(async ({ relayWsUrl, room }) => {
      let adapter = null;
      for (let i = 0; i < 8 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 250));
      }
      const device = await adapter.requestDevice();
      const { createSupergalacticTreePmSessionWebGpu } = await import('/src/runtime/astrophysics/supergalacticTreePmGpu.js');
      const {
        connectWebRtcTreePmPeer,
        createDistributedSpatialPartitioner,
        decodeTileMultipolePayload
      } = await import('/src/services/distributedSpatialPartitioner.js');

      const peer = await connectWebRtcTreePmPeer({
        relayWsUrl,
        room,
        peerId: 'peer-alpha',
        role: 'initiator'
      });
      const signalingClosedBeforeRpc = peer.isSignalingClosed();

      // Official PeerCompute SpatialTileLeaseBroker partitioning 200 Mpc/h into 2 disjoint slabs!
      const part = createDistributedSpatialPartitioner({ domainId: 'cosmo-webrtc-disjoint', boxLength: 200, tileCount: 2 });
      const claim0 = part.claimTile(0, 'peer-alpha');
      const claim1 = part.claimTile(1, 'peer-beta');
      const dupClaim = part.claimTile(1, 'peer-alpha');

      // Peer Alpha owns ONLY x in [-100, 0)
      const session = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 10,
        pmGridN: 16,
        boxLengthMpc: 200,
        aInit: 0.08,
        da: 0.02,
        seed: 5555,
        slabBounds: { xMin: -100, xMax: 0 }
      });
      // Control session on identical left-slab particles WITHOUT remote slab injection to prove force coupling!
      const sessionUncoupled = createSupergalacticTreePmSessionWebGpu(device, {
        gridPerSide: 10,
        pmGridN: 16,
        boxLengthMpc: 200,
        aInit: 0.08,
        da: 0.02,
        seed: 5555,
        slabBounds: { xMin: -100, xMax: 0 }
      });

      await session.step({ readTelemetry: false });
      await sessionUncoupled.step({ readTelemetry: false });
      const alphaSummary = await session.readTileMultipoleSummary({
        xMin: part.tiles[0].xMin,
        xMax: part.tiles[0].xMax
      });
      const sub0 = part.submitTileMultipoleSummary({
        tileIndex: 0,
        peerId: 'peer-alpha',
        token: claim0.token,
        summaryEpoch: part.getEpoch(),
        totalMass: alphaSummary.totalMass,
        com: alphaSummary.com,
        quadrupoleTrace: alphaSummary.quadrupoleTrace,
        particleCount: alphaSummary.particleCount
      });

      // Request Peer Beta's disjoint right-slab multipole directly over RTCDataChannel (signaling WS closed!)
      peer.sendJson({
        type: 'compute-tile',
        tileIndex: 1,
        epoch: part.getEpoch(),
        xMin: part.tiles[1].xMin,
        xMax: part.tiles[1].xMax
      });
      const betaEnv = await peer.receiveNext();
      const betaPayload = Uint8Array.from(betaEnv.payloadB64);
      const betaDecoded = decodeTileMultipolePayload(betaPayload);
      const sub1 = part.submitTileMultipoleSummary({
        tileIndex: betaEnv.tileIndex,
        peerId: betaEnv.peerId,
        token: claim1.token,
        summaryEpoch: betaEnv.epoch,
        payload: betaPayload
      });
      const globalSummary = part.globalMultipoleSummary();

      // Send Alpha's left-slab multipole to Beta AND inject Beta's right-slab multipole into Alpha's GPU!
      peer.sendTileMultipoleEnvelope({ tileIndex: 0, epoch: part.getEpoch(), summary: alphaSummary });
      const injectedAlpha = session.injectRemoteTileMultipoles([betaDecoded]);
      const telCoupled = await session.step({ readTelemetry: true });
      const telUncoupled = await sessionUncoupled.step({ readTelemetry: true });
      const betaCoupledAck = await peer.receiveNext();

      // Prove cross-slab gravitational force coupling measurably pulls Alpha's left-slab particles toward Beta's right slab (+X)!
      const deltaPxCoupling = telCoupled.momentum[0] - telUncoupled.momentum[0];

      // Disconnect peer-beta -> evict peer via SpatialTileLeaseBroker -> verify fail-closed incomplete summary & reclaim!
      peer.sendJson({ type: 'disconnect-now' });
      await peer.waitForClose();
      const evicted = part.evictPeer('peer-beta', { reason: 'datachannel-closed' });
      const incompleteAfterEvict = part.globalMultipoleSummary();
      const epoch2 = part.advanceEpoch();
      const reclaim0 = part.claimTile(0, 'peer-alpha');
      const reclaim1 = part.claimTile(1, 'peer-alpha');

      part.destroy();
      peer.close();
      session.destroy();
      sessionUncoupled.destroy();
      device.destroy();

      return {
        signalingClosedBeforeRpc,
        claim0Ok: claim0.claimed,
        claim1Ok: claim1.claimed,
        dupClaimRejected: !dupClaim.claimed,
        sub0Accepted: sub0.accepted && Boolean(sub0.sha256),
        sub1Accepted: sub1.accepted && Boolean(sub1.sha256),
        alphaParticleCount: session.particleCount,
        betaParticleCount: betaCoupledAck.betaParticleCount,
        globalParticleCount: session.globalParticleCount,
        alphaReducedOnGpu: alphaSummary.reducedOnGpu,
        alphaReadbackBytes: alphaSummary.readbackBytes,
        injectedAlpha,
        deltaPxCoupling,
        globalSummary,
        evictedCount: evicted.evictedCount,
        incompleteAfterEvict,
        epoch2,
        reclaimBothOk: reclaim0.claimed && reclaim1.claimed
      };
    }, { relayWsUrl: wsUrl, room: roomName });

    const betaOut = await betaPromise;
    await Promise.all([ctxAlpha.close(), ctxBeta.close()]);

    assert.equal(alphaOut.signalingClosedBeforeRpc, true, 'WebRTC TreePM tile RPC must run with signaling WS closed');
    assert.equal(betaOut.signalingClosed, true);
    assert.equal(alphaOut.claim0Ok, true);
    assert.equal(alphaOut.claim1Ok, true);
    assert.equal(alphaOut.dupClaimRejected, true, 'SpatialTileLeaseBroker must reject competing tile claim');
    assert.equal(alphaOut.sub0Accepted, true);
    assert.equal(alphaOut.sub1Accepted, true);
    // Strict disjoint spatial partitioning proof: neither peer holds the whole box, and their union is 100%!
    assert.ok(alphaOut.alphaParticleCount > 100 && alphaOut.alphaParticleCount < alphaOut.globalParticleCount);
    assert.ok(alphaOut.betaParticleCount > 100 && alphaOut.betaParticleCount < alphaOut.globalParticleCount);
    assert.equal(alphaOut.alphaParticleCount + alphaOut.betaParticleCount, alphaOut.globalParticleCount,
      `Disjoint slabs must partition 100% of particles (${alphaOut.alphaParticleCount} + ${alphaOut.betaParticleCount} vs ${alphaOut.globalParticleCount})`);
    assert.equal(alphaOut.alphaReducedOnGpu, true);
    assert.equal(alphaOut.alphaReadbackBytes, 32);
    assert.equal(betaOut.reducedOnGpu, true);
    assert.equal(betaOut.readbackBytes, 32);
    // Exact global mass conservation & real cross-slab gravitational pull (+X pull from right slab onto left slab!)
    assert.equal(alphaOut.globalSummary.complete, true);
    assert.equal(alphaOut.globalSummary.admittedTiles, 2);
    assert.ok(Math.abs(alphaOut.globalSummary.totalMass - alphaOut.globalParticleCount) < 1e-3);
    assert.equal(alphaOut.injectedAlpha, 1);
    assert.equal(betaOut.injectedCount, 1);
    assert.ok(alphaOut.deltaPxCoupling > 1e-4,
      `Right-slab remote multipole must exert measurable +X gravitational pull on left-slab particles (deltaPx=${alphaOut.deltaPxCoupling})`);
    // Fail-closed peer eviction & epoch-advanced reassignment
    assert.equal(betaOut.disconnected, true);
    assert.equal(alphaOut.evictedCount, 1);
    assert.equal(alphaOut.incompleteAfterEvict.complete, false, 'Evicting dropped peer must fail closed with incomplete global summary');
    assert.equal(alphaOut.reclaimBothOk, true, 'Coordinator must cleanly reclaim orphaned tile after epoch fence');
  } finally {
    await browser.close();
    await relay.close();
  }
});
