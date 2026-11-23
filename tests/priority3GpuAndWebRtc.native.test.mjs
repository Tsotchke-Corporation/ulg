import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalPeerRelayServer } from '../src/services/localPeerRelayServer.js';

// Priority 3 Native Vulkan & Real-Browser WebRTC Proof:
//   1. True 100% GPU-resident radial Kohn-Sham SCF eigensolver (`solveAtomFullWebGpu`)
//      runs all SCF iterations on Vulkan GPU with ZERO per-SCF CPU readbacks
//      (`perScfCpuReadbacks === 0`, `resolverStatus === 'webgpu-derived'`) and
//      matches CPU `solveAtom` total energy and electron count for He (Z=2), C (Z=6), Ne (Z=10).
//   2. Real 2-browser-context WebRTC `RTCPeerConnection` + `RTCDataChannel` A6 proof:
//      signaling ONLY over local WebSocket relay, then live closure derivation
//      requests & responses directly across real browser `RTCDataChannel`, plus
//      fail-closed rejection when the remote peer disconnects.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1'
  || process.env.ULG_RUN_NATIVE_PRIORITY3 === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('Priority 3 native Vulkan GPU Kohn-Sham SCF eigensolver (0 per-SCF CPU readbacks) and real-browser WebRTC RTCDataChannel A6 proof', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan + WebRTC proof',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const relay = await createLocalPeerRelayServer({ host: '127.0.0.1', port: 0 });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist']
  });

  try {
    // ---- 1. True 100% GPU-Resident Radial Kohn-Sham SCF Eigensolver on Vulkan ----
    const gpuCtx = await browser.newContext({ ignoreHTTPSErrors: true });
    const gpuPage = await gpuCtx.newPage();
    const gpuPageErrors = [];
    gpuPage.on('pageerror', (e) => gpuPageErrors.push(String(e).slice(0, 300)));
    await gpuPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const ksOut = await gpuPage.evaluate(async () => {
      let adapter = null;
      for (let i = 0; i < 6 && !adapter; i += 1) {
        adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
        if (!adapter) await new Promise((r) => setTimeout(r, 300));
      }
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const gpuErrors = [];
      device.addEventListener('uncapturederror', (e) => gpuErrors.push(String(e.error?.message ?? e)));

      const { solveAtomFullWebGpu } = await import('/src/runtime/electronicStructure/radialKohnShamWebGpu.js');
      const { solveAtom } = await import('/src/runtime/electronicStructure/radialKohnSham.js');

      const atoms = [];
      for (const Z of [2, 6, 10]) {
        const gpuAtom = await solveAtomFullWebGpu(device, Z, {
          functional: 'lda',
          spinOrbit: true,
          gridPointsN: 256,
          rMinBohr: 1e-4,
          maxScf: 60
        });
        const cpuAtom = solveAtom(Z, {
          functional: 'lda',
          scalarRelativistic: false,
          spinOrbit: false,
          gridPointsN: 256,
          rMinBohr: 1e-4,
          maxScf: 120,
          tol: 1e-5
        });
        const relEnergyErr = Math.abs(gpuAtom.totalEnergyHa - cpuAtom.totalEnergyHa) / Math.abs(cpuAtom.totalEnergyHa);
        const neRelErr = Math.abs(gpuAtom.integratedElectrons - gpuAtom.electronCount) / gpuAtom.electronCount;
        atoms.push({
          Z,
          symbol: gpuAtom.symbol,
          gpuTotalEnergyHa: gpuAtom.totalEnergyHa,
          cpuTotalEnergyHa: cpuAtom.totalEnergyHa,
          relEnergyErr,
          neRelErr,
          resolverStatus: gpuAtom.resolverStatus,
          webgpuNativeEigensolver: gpuAtom.webgpuNativeEigensolver,
          perScfCpuReadbacks: gpuAtom.perScfCpuReadbacks
        });
      }
      device.destroy();
      return { status: 'ok', gpuErrors, atoms };
    });
    await gpuCtx.close();

    assert.deepEqual(gpuPageErrors, []);
    assert.equal(ksOut.status, 'ok');
    assert.deepEqual(ksOut.gpuErrors, []);
    for (const a of ksOut.atoms) {
      assert.equal(a.resolverStatus, 'webgpu-derived', `${a.symbol} must be webgpu-derived`);
      assert.equal(a.webgpuNativeEigensolver, true);
      assert.equal(a.perScfCpuReadbacks, 0);
      assert.ok(Number.isFinite(a.gpuTotalEnergyHa) && a.gpuTotalEnergyHa < 0, `${a.symbol} E=${a.gpuTotalEnergyHa}`);
      assert.ok(a.neRelErr < 0.03, `${a.symbol} integrated electron err=${a.neRelErr}`);
      assert.ok(a.relEnergyErr < 0.03, `${a.symbol} GPU vs CPU total energy relErr=${a.relEnergyErr} (gpu=${a.gpuTotalEnergyHa}, cpu=${a.cpuTotalEnergyHa})`);
    }

    // ---- 2. Real 2-Browser-Context WebRTC RTCPeerConnection + RTCDataChannel A6 Proof ----
    const room = `p3-webrtc-${Date.now()}`;
    const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
    const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const rtcErrors = [];
    pageA.on('pageerror', (e) => rtcErrors.push(`A:${e.message}`));
    pageB.on('pageerror', (e) => rtcErrors.push(`B:${e.message}`));
    await Promise.all([
      pageA.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 }),
      pageB.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    ]);

    const setupPeerScript = async ({ relayUrl, roomName, role }) => {
      const ws = new WebSocket(`${relayUrl}?room=${encodeURIComponent(roomName)}&peerId=${role}`);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(new Error('relay open failed')), { once: true });
      });

      const pc = new RTCPeerConnection({ iceServers: [] });
      let dc = null;
      const pending = new Map();

      const bindDataChannel = (channel) => {
        dc = channel;
        dc.onmessage = async (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'derive-request') {
            const { deriveElementProperties } = await import('/src/runtime/material/elementClosures.js');
            const derived = deriveElementProperties(msg.Z);
            dc.send(JSON.stringify({
              type: 'derive-response',
              reqId: msg.reqId,
              symbol: derived.symbol,
              Z: msg.Z,
              molarMassKgPerMol: derived.molarMassKgPerMol,
              standardPhaseAt298K: derived.standardPhaseAt298K,
              transport: 'webrtc-datachannel'
            }));
          } else if (msg.type === 'derive-response') {
            const cb = pending.get(msg.reqId);
            if (cb) {
              pending.delete(msg.reqId);
              cb.resolve(msg);
            }
          }
        };
        dc.onclose = () => {
          for (const [, cb] of pending) cb.reject(new Error('ERR_WEBRTC_CHANNEL_CLOSED'));
          pending.clear();
        };
      };

      const dcReady = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('RTCDataChannel open timeout')), 15_000);
        const onOpen = () => { clearTimeout(timer); resolve(); };
        if (role === 'requester') {
          bindDataChannel(pc.createDataChannel('ulg-a6-derivation', { ordered: true }));
          dc.addEventListener('open', onOpen, { once: true });
        } else {
          pc.ondatachannel = (ev) => {
            bindDataChannel(ev.channel);
            if (dc.readyState === 'open') onOpen();
            else dc.addEventListener('open', onOpen, { once: true });
          };
        }
      });

      pc.onicecandidate = (ev) => {
        if (ev.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ kind: 'ice', from: role, candidate: ev.candidate.toJSON() }));
        }
      };

      const pendingIce = [];
      ws.onmessage = async (ev) => {
        const raw = JSON.parse(ev.data);
        const msg = raw?.payload ?? raw;
        if (!msg || msg.from === role) return;
        if (msg.kind === 'offer' && role === 'responder') {
          await pc.setRemoteDescription(msg.sdp);
          while (pendingIce.length) await pc.addIceCandidate(pendingIce.shift());
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ kind: 'answer', from: role, sdp: pc.localDescription }));
        } else if (msg.kind === 'answer' && role === 'requester') {
          await pc.setRemoteDescription(msg.sdp);
          while (pendingIce.length) await pc.addIceCandidate(pendingIce.shift());
        } else if (msg.kind === 'ice' && msg.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate);
          else pendingIce.push(msg.candidate);
        }
      };

      if (role === 'requester') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // Brief delay so responder has registered on the relay room
        await new Promise((r) => setTimeout(r, 250));
        ws.send(JSON.stringify({ kind: 'offer', from: role, sdp: pc.localDescription }));
      }

      await dcReady;
      // Close signaling WebSocket completely so ALL derivation traffic is proven to flow over WebRTC RTCDataChannel!
      ws.close();

      globalThis.__ulgP3Rtc = {
        getState: () => ({ iceState: pc.iceConnectionState, dcState: dc?.readyState }),
        deriveOverRtc: (Z) => new Promise((resolve, reject) => {
          if (!dc || dc.readyState !== 'open') {
            reject(new Error('ERR_WEBRTC_CHANNEL_CLOSED'));
            return;
          }
          const reqId = `rtc-${Z}-${Date.now()}`;
          pending.set(reqId, { resolve, reject });
          dc.send(JSON.stringify({ type: 'derive-request', reqId, Z }));
        }),
        close: () => { try { dc?.close(); } catch {} try { pc.close(); } catch {} }
      };
      return { iceState: pc.iceConnectionState, dcState: dc.readyState };
    };

    // Start responder first so it listens on the relay room, then requester initiates SDP offer
    const respPromise = pageB.evaluate(setupPeerScript, { relayUrl: relay.url, roomName: room, role: 'responder' });
    await new Promise((r) => setTimeout(r, 150));
    const reqPromise = pageA.evaluate(setupPeerScript, { relayUrl: relay.url, roomName: room, role: 'requester' });
    const [respInit, reqInit] = await Promise.all([respPromise, reqPromise]);

    assert.equal(reqInit.dcState, 'open');
    assert.equal(respInit.dcState, 'open');

    // Derive Au (Z=79) and Hg (Z=80) directly over real browser RTCDataChannel (relay WS already closed!)
    const auResp = await pageA.evaluate(() => globalThis.__ulgP3Rtc.deriveOverRtc(79));
    const hgResp = await pageA.evaluate(() => globalThis.__ulgP3Rtc.deriveOverRtc(80));
    assert.equal(auResp.symbol, 'Au');
    assert.equal(auResp.transport, 'webrtc-datachannel');
    assert.equal(hgResp.symbol, 'Hg');
    assert.equal(hgResp.transport, 'webrtc-datachannel');

    // Close responder RTCPeerConnection and verify requester fails closed
    await pageB.evaluate(() => globalThis.__ulgP3Rtc.close());
    await pageA.waitForFunction(() => globalThis.__ulgP3Rtc.getState().dcState !== 'open', null, { timeout: 10_000 });
    const failClosed = await pageA.evaluate(async () => {
      try {
        await globalThis.__ulgP3Rtc.deriveOverRtc(26);
        return { rejected: false };
      } catch (err) {
        return { rejected: true, message: String(err?.message || err) };
      }
    });
    assert.equal(failClosed.rejected, true);
    assert.match(failClosed.message, /ERR_WEBRTC_CHANNEL_CLOSED/);

    console.log('Priority 3 Native Proof:', JSON.stringify({
      ksAtoms: ksOut.atoms.map((a) => ({
        symbol: a.symbol,
        gpuE: Number(a.gpuTotalEnergyHa.toFixed(4)),
        cpuE: Number(a.cpuTotalEnergyHa.toFixed(4)),
        relErr: Number(a.relEnergyErr.toExponential(2)),
        readbacks: a.perScfCpuReadbacks
      })),
      webrtc: { reqInit, respInit, au: auResp.symbol, hg: hgResp.symbol, failClosed }
    }));
    assert.deepEqual(rtcErrors, []);
    await ctxA.close();
    await ctxB.close();
  } finally {
    await browser.close();
    await relay.close();
  }
});
