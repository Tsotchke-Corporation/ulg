import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalPeerRelayServer } from '../src/services/localPeerRelayServer.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_DISTRIBUTED === '1'
  || process.env.ULG_RUN_NATIVE_WEBGPU === '1';

test('Phase 11 Live 3-Browser-Context Distributed Proof: 2-of-2 quorum derivation over TCP WebSocket relay, observer witnessing, disconnect fail-closed, and replica recovery', {
  skip: !RUN_NATIVE && 'set ULG_RUN_NATIVE_DISTRIBUTED=1 or ULG_RUN_NATIVE_WEBGPU=1',
  timeout: 120000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const relay = await createLocalPeerRelayServer({ host: '127.0.0.1', port: 0 });
  const room = `phase11-3browser-${Date.now()}`;

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--ignore-certificate-errors',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  const openContexts = [];
  const errors = [];

  async function openCosmicQuantumContext(role) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 960, height: 640 } });
    openContexts.push(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`[${role}] pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${role}] console.error: ${m.text()}`);
    });
    const url = `https://127.0.0.1:5173/universes.html?level=6&Z=80&quality=low&peerRelay=${encodeURIComponent(relay.url)}&peerRoom=${encodeURIComponent(room)}&peerRole=${role}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(globalThis.__ulgUniversesDemo?.getState?.()?.ready), null, { timeout: 45000 });
    return { ctx, page };
  }

  try {
    // 1. Open 3 isolated browser contexts running ULG Universes + 1 passive Observer context
    const req = await openCosmicQuantumContext('requester');
    const resp1 = await openCosmicQuantumContext('responder');
    const resp2 = await openCosmicQuantumContext('responder');
    const obs = await openCosmicQuantumContext('observer');

    // Wait for Requester to discover both remote Responders across browser contexts via real TCP WebSocket relay
    await req.page.waitForFunction(() => {
      const pm = globalThis.__ulgUniversesDemo?.getState?.()?.peerMeshState;
      return Boolean(pm?.connected && pm?.quorumReady && pm?.remotePeers >= 2);
    }, null, { timeout: 15000 });

    const preState = await req.page.evaluate(() => globalThis.__ulgUniversesDemo.getState().peerMeshState);
    assert.equal(preState.connected, true);
    assert.equal(preState.quorumReady, true);
    assert.ok(preState.remotePeers >= 2, `expected >= 2 remote peers, got ${preState.remotePeers}`);

    // 2. Execute live 2-of-2 quorum quantum material derivation (Hg, Z=80) across the separate browser contexts!
    const hgResult = await req.page.evaluate(() => globalThis.__ulgUniversesDemo.dispatchPeerDerivation(80));
    assert.equal(hgResult.value.symbol, 'Hg');
    assert.equal(hgResult.value.standardPhaseAt298K, 'liquid');
    assert.equal(hgResult.value.closureBacked, true);
    assert.equal(hgResult.value.scientificValidation, false);
    assert.ok(hgResult.provenance, '2-of-2 quorum result must carry PeerCompute placement provenance');

    // Verify Observer browser context witnessed real live WebSocket room traffic
    const obsState = await obs.page.evaluate(() => globalThis.__ulgUniversesDemo.getState().peerMeshState);
    assert.ok(obsState.witnessedMessages > 0, `observer must witness relay messages, got ${obsState.witnessedMessages}`);

    // 3. Failure mode: kill Responder 1 browser context -> Requester loses 2-of-2 quorum and fails closed!
    await resp1.ctx.close();
    await req.page.waitForFunction(() => {
      const pm = globalThis.__ulgUniversesDemo?.getState?.()?.peerMeshState;
      return Boolean(pm && pm.remotePeers < 2 && pm.quorumReady === false);
    }, null, { timeout: 10000 });

    const failClosedResult = await req.page.evaluate(async () => {
      try {
        await globalThis.__ulgUniversesDemo.dispatchPeerDerivation(79);
        return { rejected: false };
      } catch (err) {
        return { rejected: true, code: err?.code || null, message: String(err?.message || err) };
      }
    });
    assert.equal(failClosedResult.rejected, true, 'must fail closed without silent local fallback when < 2 responders');
    assert.equal(failClosedResult.code, 'ERR_CLIENT_PEER_QUORUM_UNAVAILABLE');

    // 4. Recovery: fresh Responder 3 joins -> Requester re-establishes 2-of-2 quorum and derives Au (Z=79)!
    const resp3 = await openCosmicQuantumContext('responder');
    await req.page.waitForFunction(() => {
      const pm = globalThis.__ulgUniversesDemo?.getState?.()?.peerMeshState;
      return Boolean(pm?.connected && pm?.quorumReady && pm?.remotePeers >= 2);
    }, null, { timeout: 15000 });

    const auResult = await req.page.evaluate(() => globalThis.__ulgUniversesDemo.dispatchPeerDerivation(79));
    assert.equal(auResult.value.symbol, 'Au');
    assert.equal(auResult.value.standardPhaseAt298K, 'solid');
    assert.equal(auResult.value.scientificValidation, false);
    assert.ok(auResult.provenance);

    console.log('Phase 11 3-Browser Distributed Proof:', JSON.stringify({
      relayUrl: relay.url,
      room,
      hg: hgResult.value,
      au: auResult.value,
      observerWitnessedMessages: obsState.witnessedMessages,
      failClosedCode: failClosedResult.code,
      errors
    }));
    assert.deepEqual(errors, []);
    await resp3.ctx.close();
    await resp2.ctx.close();
    await obs.ctx.close();
    await req.ctx.close();
  } finally {
    for (const ctx of openContexts) {
      try { await ctx.close(); } catch { /* already closed */ }
    }
    await browser.close();
    await relay.close();
  }
});
