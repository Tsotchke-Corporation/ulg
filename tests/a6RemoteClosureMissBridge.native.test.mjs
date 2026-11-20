import assert from 'node:assert/strict';
import test from 'node:test';

// A6 (`ulg-a6-remote-derivation`) End-to-End Multi-Peer Closure Miss Bridge Gate:
// Connects ULG's live `createWarmClosureMissBridge` + `regionalClosureWorkerLane` +
// `sphImplicitPressureGpu` on Requester Page A directly to PeerCompute `NodeKernel`
// responder pages B, C, D (`startClientDerivationResponder`) over BroadcastChannel:
//   R1 Remote PeerCompute 2-of-2 quorum execution of real ULG Eshkol-AD Tait EOS
//      stiffness closure misses & MoonLab 12-qubit WebGPU GHZ probes, adopted
//      strictly at schedule boundaries without a second scheduler.
//   R2 Primary responder death (`pages.B.close()`) -> `ERR_CLIENT_PEER_ABSENT`
//      failover to `promoted-replica` (`client-C` + `client-D` 2-of-2 quorum)
//      reusing warm WASM+WebGPU workers (`spawns === 1`, `loads === 1`).
//   R3 Stale source invalidation (`sourceChanged`), total responder quorum loss
//      recording explicit `remoteDebt` with zero silent CPU hot-state fallback
//      and zero leaked G5 `ReservationLedger` slots, followed by responder
//      rejoin (`peer-E` + `peer-F`) clearing `remoteDebt` via `retryRemoteDebt`!
const RUN = process.env.ULG_RUN_NATIVE_A6 === '1';
const BASE = process.env.ULG_A6_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_A6_CHROME || '/usr/bin/google-chrome';

test('A6 end-to-end: warmClosureMissBridge leases multi-peer Eshkol/MoonLab WASM+WebGPU responders with failover, invalidation, and explicit debt recovery', {
  skip: RUN ? false : 'set ULG_RUN_NATIVE_A6=1 (needs HTTPS dev server)',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const staticUrl = new URL('service-assets/README.md', BASE).href;
    const channelName = `ulg-a6-bridge-${Date.now()}`;
    const pages = {};

    for (const peer of ['A', 'B', 'C', 'D']) {
      pages[peer] = await context.newPage();
      await pages[peer].goto(staticUrl, { waitUntil: 'domcontentloaded' });
    }
    for (const peer of ['B', 'C', 'D']) {
      await pages[peer].evaluate(async ({ channelName, peer }) => {
        const m = await import('/src/services/clientDerivationPeers.js');
        globalThis.__a6Responder = m.startClientDerivationResponder({
          channelName,
          peerId: `peer-${peer}`,
          nodeId: `client-${peer}`
        });
      }, { channelName, peer });
    }

    const setupStatus = await pages.A.evaluate(async ({ channelName }) => {
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

      const peersMod = await import('/src/services/clientDerivationPeers.js');
      const bridgeMod = await import('/src/runtime/material/warmClosureMissBridge.js');
      const laneMod = await import('/src/runtime/material/regionalClosureWorkerLane.js');
      const eosMod = await import('/src/runtime/material/eshkolEosStiffness.js');

      const requester = peersMod.startClientDerivationRequester({
        channelName,
        peerId: 'peer-A',
        primaryPeerId: 'peer-B',
        replicaPeerIds: ['peer-C', 'peer-D']
      });
      const lane = laneMod.createRegionalClosureWorkerLane(device, {
        name: 'ulg-a6-remote-bridge-lane',
        maxGenerations: 4,
        memberCapacity: 64
      });
      const commits = [];
      const bridge = bridgeMod.createWarmClosureMissBridge({
        device,
        lane,
        maxInFlight: 3,
        peerRequester: requester,
        sourceIdentity: 'eshkol+moonlab-assets.v1',
        onPeerExhaustion: 'debt',
        onStateCommit: (delta) => commits.push(delta)
      });

      globalThis.__a6Ctx = { device, gpuErrors, peersMod, laneMod, eosMod, requester, lane, commits, bridge };
      return { status: 'ready' };
    }, { channelName });

    assert.equal(setupStatus.status, 'ready', 'WebGPU adapter ready on Requester Page A');
    await pages.A.waitForTimeout(600); // Allow responder presence heartbeats

    // ---- R1: Primary + Replica 2-of-2 Quorum Remote Derivation & Boundary-Only Adoption ----
    const r1 = await pages.A.evaluate(async () => {
      const { bridge, eosMod, laneMod, lane, commits } = globalThis.__a6Ctx;
      const m1 = bridge.requestEosStiffnessClosureMiss({
        missKey: 'remote-h2o-tait',
        eosModel: eosMod.ESHKOL_EOS_MODEL.TAIT,
        restDensityKgPerM3: 998,
        soundSpeedMPerS: 1480,
        scheduleId: 'sched-1'
      });
      const eosEntry = await m1.promise;
      const q1 = bridge.requestQuantumClosureProbeMiss({
        missKey: 'remote-ghz-12',
        qubits: 12,
        scheduleId: 'sched-1'
      });
      const qEntry = await q1.promise;
      const ordinalBeforeBoundary = laneMod.regionalClosureLaneBindings(lane).ordinal;
      const pendingBeforeBoundary = bridge.getStatus().pendingAdoptionCount;
      const adopt = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-2' });
      const ordinalAfterBoundary = laneMod.regionalClosureLaneBindings(lane).ordinal;
      const hit = bridge.requestEosStiffnessClosureMiss({
        missKey: 'remote-h2o-tait',
        eosModel: eosMod.ESHKOL_EOS_MODEL.TAIT,
        restDensityKgPerM3: 998,
        soundSpeedMPerS: 1480
      });
      return {
        eosCrossCheck: eosEntry.derived.crossCheckMaxRelativeError,
        eosProvenance: eosEntry.provenance,
        eosPageId: eosEntry.commitDelta?.payload?.residency?.pageId,
        qProvenance: qEntry.provenance,
        qDim: qEntry.value?.dim,
        qNativeDispatches: qEntry.value?.nativeDispatches,
        qNativeAccel: qEntry.commitDelta?.payload?.residency?.worker?.nativeAccelerated,
        ordinalBeforeBoundary,
        pendingBeforeBoundary,
        adoptedCount: adopt.adoptedCount,
        ordinalAfterBoundary,
        hitStatus: hit.status,
        remoteCallsAfterHit: bridge.getStatus().stats.remoteCalls,
        commitCount: commits.length
      };
    });

    assert.ok(r1.eosCrossCheck < 1e-10, `R1 remote Eshkol Tait AD cross-check: ${r1.eosCrossCheck}`);
    assert.equal(r1.eosProvenance.mode, 'peer-quorum');
    assert.equal(r1.eosProvenance.quorum, 'quorum-accepted');
    assert.ok(r1.eosProvenance.matching >= 2, `R1 quorum matching count (${r1.eosProvenance.matching})`);
    assert.ok(['peer-B', 'peer-C', 'peer-D'].includes(r1.eosPageId), `R1 computed on remote page (${r1.eosPageId})`);
    assert.equal(r1.qDim, 4096);
    assert.equal(r1.qNativeAccel, 1, 'R1 remote MoonLab used WebGPU');
    assert.equal(r1.ordinalBeforeBoundary, 0, 'R1 not visible to lane before schedule boundary');
    assert.equal(r1.pendingBeforeBoundary, 2);
    assert.equal(r1.adoptedCount, 2);
    assert.equal(r1.ordinalAfterBoundary, 1, 'R1 promoted into regionalClosureWorkerLane at schedule boundary');
    assert.equal(r1.hitStatus, 'cache-hit');
    assert.equal(r1.remoteCallsAfterHit, 2, 'R1 cache hit makes zero remote calls');

    // ---- R2: Close Primary Page B -> Promoted-Replica Quorum + Warm Worker Residency ----
    await pages.B.close({ runBeforeUnload: true });
    await pages.A.waitForTimeout(1200);

    const r2 = await pages.A.evaluate(async () => {
      const { bridge, eosMod } = globalThis.__a6Ctx;
      const m2 = bridge.requestEosStiffnessClosureMiss({
        missKey: 'remote-fe-tait',
        eosModel: eosMod.ESHKOL_EOS_MODEL.TAIT,
        restDensityKgPerM3: 7000,
        soundSpeedMPerS: 3800,
        scheduleId: 'sched-3'
      });
      const entry = await m2.promise;
      const adopt = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-4' });
      const res = entry.commitDelta?.payload?.residency;
      return {
        failed: entry.failed ?? false,
        crossCheck: entry.derived?.crossCheckMaxRelativeError,
        provenance: entry.provenance,
        residency: {
          pageId: res?.pageId,
          spawns: res?.spawns,
          calls: res?.calls,
          loads: res?.worker?.loads
        },
        adoptedCount: adopt.adoptedCount,
        replicaPromotions: bridge.getStatus().stats.replicaPromotions
      };
    });

    assert.equal(r2.failed, false);
    assert.ok(r2.crossCheck < 1e-10);
    assert.equal(r2.provenance.role, 'promoted-replica');
    assert.equal(r2.provenance.primaryFailure, 'ERR_CLIENT_PEER_ABSENT');
    assert.equal(r2.provenance.quorum, 'quorum-accepted');
    assert.ok(['peer-C', 'peer-D'].includes(r2.residency.pageId));
    assert.equal(r2.residency.spawns, 1, 'R2 warm Eshkol worker reused on surviving replica');
    assert.equal(r2.residency.loads, 1, 'R2 Eshkol VM loaded once on surviving replica');
    assert.ok(r2.residency.calls >= 2, 'R2 warm call count incremented');
    assert.equal(r2.adoptedCount, 1);

    // ---- R3: Source Invalidation + Total Responder Loss -> Explicit Debt + Rejoin Recovery ----
    await pages.C.close({ runBeforeUnload: true });
    await pages.D.close({ runBeforeUnload: true });
    await pages.A.waitForTimeout(1200);

    const r3Loss = await pages.A.evaluate(async () => {
      const { bridge, eosMod } = globalThis.__a6Ctx;
      const dropped = bridge.sourceChanged('eshkol+moonlab-assets.v2');
      const mLost = bridge.requestEosStiffnessClosureMiss({
        missKey: 'remote-na-linear',
        eosModel: eosMod.ESHKOL_EOS_MODEL.LINEAR_GAS,
        restDensityKgPerM3: 927,
        soundSpeedMPerS: 2500,
        scheduleId: 'sched-5'
      });
      const outcome = await mLost.promise;
      const adoptDuringOutage = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-6' });
      const status = bridge.getStatus();
      return {
        dropped,
        failed: outcome.failed,
        adoptedDuringOutage: adoptDuringOutage.adoptedCount,
        remoteDebtCount: status.remoteDebtCount,
        debtRecord: status.remoteDebt[0] ?? null,
        ledgerActiveCount: status.ledgerActiveCount,
        ownerLosses: status.stats.ownerLosses
      };
    });

    assert.equal(r3Loss.dropped, 3, 'R3 sourceChanged invalidated all 3 cached v1 artifacts');
    assert.equal(r3Loss.failed, true);
    assert.equal(r3Loss.adoptedDuringOutage, 0, 'R3 zero silent CPU hot-state fallback during peer outage');
    assert.equal(r3Loss.remoteDebtCount, 1, 'R3 explicit remote debt recorded');
    assert.equal(r3Loss.debtRecord.ownerLoss, true);
    assert.equal(r3Loss.ledgerActiveCount, 0, 'R3 zero leaked G5 reservations');

    // Bring up fresh Responder Pages E and F on the channel & recover debt!
    for (const peer of ['E', 'F']) {
      pages[peer] = await context.newPage();
      await pages[peer].goto(staticUrl, { waitUntil: 'domcontentloaded' });
      await pages[peer].evaluate(async ({ channelName, peer }) => {
        const m = await import('/src/services/clientDerivationPeers.js');
        globalThis.__a6Responder = m.startClientDerivationResponder({
          channelName,
          peerId: `peer-${peer}`,
          nodeId: `client-${peer}`
        });
      }, { channelName, peer });
    }

    const r3Recovered = await pages.A.evaluate(async ({ channelName }) => {
      const { peersMod, bridge, requester, laneMod, lane, device, gpuErrors } = globalThis.__a6Ctx;
      requester.stop();
      const rejoinedRequester = peersMod.startClientDerivationRequester({
        channelName,
        peerId: 'peer-A2',
        primaryPeerId: 'peer-E',
        replicaPeerIds: ['peer-F']
      });
      bridge.setPeerRequester(rejoinedRequester);
      await new Promise((r) => setTimeout(r, 600));

      const retries = bridge.retryRemoteDebt({ scheduleId: 'sched-7' });
      const retryEntry = await retries[0].promise;
      const adopt = bridge.adoptPendingAtScheduleBoundary({ scheduleId: 'sched-8' });
      const finalStatus = bridge.getStatus();

      rejoinedRequester.stop();
      bridge.destroy({ terminateWorkers: true });
      laneMod.destroyRegionalClosureWorkerLane(lane);
      device.destroy();

      return {
        gpuErrors,
        retryFailed: retryEntry.failed ?? false,
        retryProvenance: retryEntry.provenance,
        adoptedCount: adopt.adoptedCount,
        remoteDebtCount: finalStatus.remoteDebtCount,
        debtCleared: finalStatus.stats.debtCleared,
        ledgerActiveCount: finalStatus.ledgerActiveCount
      };
    }, { channelName });

    console.log(JSON.stringify({ r1, r2, r3Loss, r3Recovered }, null, 2));
    assert.deepEqual(r3Recovered.gpuErrors, []);
    assert.equal(r3Recovered.retryFailed, false);
    assert.equal(r3Recovered.retryProvenance.quorum, 'quorum-accepted');
    assert.equal(r3Recovered.adoptedCount, 1);
    assert.equal(r3Recovered.remoteDebtCount, 0, 'R3 remote debt cleared once responders rejoined');
    assert.equal(r3Recovered.debtCleared, 1);
    assert.equal(r3Recovered.ledgerActiveCount, 0);
  } finally {
    await browser.close();
  }
});
