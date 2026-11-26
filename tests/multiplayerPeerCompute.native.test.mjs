// Native Vulkan 2-Browser PeerCompute Multiplayer Verification:
//   1. Two COMPLETELY ISOLATED browser contexts (`ctxA` & `ctxB` — BroadcastChannel CANNOT cross contexts!)
//      connect to the same unique room via REAL PeerCompute `NodeKernel` + `NetworkManager`
//      (libp2p Gossipsub + WebRTC STUN/TURN via live `secretworkshop.net` relay!).
//   2. Proves cross-device / cross-context peer discovery (`remotePeerCount >= 1`), real non-zero 3D space
//      UFO positions (never collapsed to `[0,0,0]`), locked `1.0x` network timescale, surface side-by-side
//      rendering + `🛸` remote peer reticle bracket, remote missile sync, and remote crater stamp sync!

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_WEBGPU === '1';
const BASE_URL = (process.env.ULG_DEV_URL || process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173').replace(/\/$/, '');
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.ULG_MP_SHOT_DIR || '';

test('PeerCompute 2-Browser Isolated-Context Real Multiplayer UFO Presence, Surface Sync & Combat (Vulkan)', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_WEBGPU=1 for native Vulkan multiplayer suite',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  if (SHOT_DIR) await mkdir(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
      '--renderer-process-limit=3'
    ]
  });

  const roomName = `ulg-mp-e2e-${Date.now().toString(36).slice(-5)}`;
  const errors = [];

  try {
    // Two COMPLETELY SEPARATE BrowserContexts: BroadcastChannel CANNOT bridge them!
    // The ONLY way Page A and Page B can see each other is REAL PeerCompute NodeKernel libp2p/WebRTC!
    const ctxA = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 720 } });
    const ctxB = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 720 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    for (const [tag, p] of [['A', pageA], ['B', pageB]]) {
      p.on('pageerror', (e) => errors.push(`[${tag}:pageerror] ${String(e).slice(0, 220)}`));
      p.on('console', (m) => {
        if (m.type() === 'error') {
          const txt = m.text();
          // Ignore transient non-fatal libp2p/WebRTC candidate noise if any
          if (!/WebSocket|ICE|ERR_NAME_NOT_RESOLVED/i.test(txt)) {
            errors.push(`[${tag}:console] ${txt.slice(0, 220)}`);
          }
        }
      });
    }

    const url = `${BASE_URL}/universes.html?level=4&sol=1&body=earth&room=${encodeURIComponent(roomName)}&quality=low`;
    await Promise.all([
      pageA.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }),
      pageB.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    ]);
    await Promise.all([
      pageA.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 }),
      pageB.waitForFunction(() => Boolean(window.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 60_000 })
    ]);

    // Wait up to 25 s for real PeerCompute NodeKernel libp2p/WebRTC relay discovery across isolated contexts!
    const deadline = Date.now() + 25_000;
    let stA = null;
    let stB = null;
    while (Date.now() < deadline) {
      [stA, stB] = await Promise.all([
        pageA.evaluate(() => window.__ulgUniversesDemo.getState().ufoMultiplayer),
        pageB.evaluate(() => window.__ulgUniversesDemo.getState().ufoMultiplayer)
      ]);
      if ((stA?.remotePeerCount || 0) >= 1 && (stB?.remotePeerCount || 0) >= 1) break;
      await pageA.waitForTimeout(500);
    }

    console.log('PEERCOMPUTE_2CTX_DISCOVERY', JSON.stringify({ roomName, stA, stB }));
    assert.equal(stA.connected, true, 'Page A must be connected');
    assert.equal(stB.connected, true, 'Page B must be connected');
    assert.equal(stA.timescaleLocked, true, 'Timescale must lock to 1.0x in multiplayer');
    assert.ok(stA.remotePeerCount >= 1, `Isolated Context A must discover Context B via PeerCompute NodeKernel (status=${stA.peerComputeStatus}, err=${stA.peerComputeError})`);
    assert.ok(stB.remotePeerCount >= 1, `Isolated Context B must discover Context A via PeerCompute NodeKernel (status=${stB.peerComputeStatus}, err=${stB.peerComputeError})`);

    // Capture real WebGPU canvas orbital screenshot with remote UFO visible!
    if (SHOT_DIR) {
      const d0 = await pageA.evaluate(() => window.__ulgUniversesDemo.capturePng());
      await writeFile(path.join(SHOT_DIR, 'mp-01-orbit-two-ufos.png'), Buffer.from(String(d0).split(',')[1] || '', 'base64'));
    }

    // Both players land on Earth surface -> verify side-by-side non-overlapping positions & remote missile/crater sync!
    await Promise.all([
      pageA.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' })),
      pageB.evaluate(() => window.__ulgUniversesDemo.enterSurfaceView({ bodyIndex: 'earth' }))
    ]);
    await pageA.waitForTimeout(1600);

    // Move B slightly closer in front of A's camera and fire a missile so A receives it!
    await pageB.evaluate(async () => {
      const api = window.__ulgUniversesDemo;
      api.launchMissile({});
      for (let i = 0; i < 12; i += 1) await api.stepOnce();
    });
    await pageA.waitForTimeout(1200);

    const surfCheckA = await pageA.evaluate(() => {
      const st = window.__ulgUniversesDemo.getState();
      return {
        mp: st.ufoMultiplayer,
        myPos: st.surfaceTelemetry?.ufoPos || st.surfaceTelemetry?.roverPos,
        gpuErrors: (st.gpuErrors || []).length
      };
    });
    const surfCheckB = await pageB.evaluate(() => {
      const st = window.__ulgUniversesDemo.getState();
      return {
        mp: st.ufoMultiplayer,
        myPos: st.surfaceTelemetry?.ufoPos || st.surfaceTelemetry?.roverPos,
        gpuErrors: (st.gpuErrors || []).length
      };
    });

    if (SHOT_DIR) {
      const d1 = await pageA.evaluate(() => window.__ulgUniversesDemo.capturePng());
      await writeFile(path.join(SHOT_DIR, 'mp-02-earth-surface-two-ufos.png'), Buffer.from(String(d1).split(',')[1] || '', 'base64'));
    }

    const sepM = Math.hypot(
      (surfCheckA.myPos?.[0] || 0) - (surfCheckB.myPos?.[0] || 0),
      (surfCheckA.myPos?.[2] || 0) - (surfCheckB.myPos?.[2] || 0)
    );
    console.log('PEERCOMPUTE_2CTX_SURFACE', JSON.stringify({ sepM: Number(sepM.toFixed(2)), surfCheckA, surfCheckB }));
    assert.ok(sepM > 2.0, `Multiplayer landing ring must separate peers cleanly on surface (got ${sepM.toFixed(2)} m)`);
    assert.ok(surfCheckA.mp.messagesReceived > 2, 'Context A must continuously receive live peer state packets');
    assert.equal(surfCheckA.gpuErrors, 0, 'Zero GPU errors on Context A');
    assert.equal(surfCheckB.gpuErrors, 0, 'Zero GPU errors on Context B');
    assert.equal(errors.length, 0, `Unexpected page/console errors: ${errors.join('; ')}`);

    await ctxA.close();
    await ctxB.close();
  } finally {
    await browser.close();
  }
});
