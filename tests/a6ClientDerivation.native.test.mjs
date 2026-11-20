import assert from 'node:assert/strict';
import test from 'node:test';

// A6 in the CLIENT: PeerCompute-owned warm derivation with MoonLab and Eshkol
// running under WASM in browser Web Workers. Four same-origin pages in one
// browser are PeerCompute peers (requester A; responders B, C, D) over a
// BroadcastChannel transport. Nothing derives in Node: Node only drives the
// browser. The pages load a static asset URL, so the app (and its GPU work)
// never starts.
//   C1 remote client execution: the result comes from a responder page's
//      worker, with PeerCompute placement provenance;
//   C2 failure and recovery: the primary page is closed; placement promotes a
//      replica and the quorum of the two survivors admits the result;
//   C3 warm residency: each responder page spawns its MoonLab and Eshkol
//      workers once and serves later tasks warm (spawns 1, calls 2; Eshkol VM
//      loaded once);
//   C4 Eshkol closure samples match the JS reference;
//   C5 cache and adoption: results are adopted only at a schedule boundary;
//      a repeat is a cache hit without a remote call; a source change
//      invalidates;
//   C6 WebGPU in both services: MoonLab's WASM build runs a 12-qubit GHZ
//      circuit through its WebGPU kernels (gpu_is_native_accelerated); Eshkol's
//      WebGPU build (eshkol upstream/master site/static) is attached to its
//      WebGPU backend (JSPI) at the sf64 exact tier and computes sum(A B) for
//      16x16 matrices with GPU dispatches, exactly.
// ULG_RUN_NATIVE_A6=1 with the HTTPS dev server on 5173.
const RUN = process.env.ULG_RUN_NATIVE_A6 === '1';
const BASE = process.env.ULG_A6_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_A6_CHROME || '/usr/bin/google-chrome';

test('A6 client: warm MoonLab/Eshkol WASM workers across browser peers survive a closed primary', {
  skip: RUN ? false : 'set ULG_RUN_NATIVE_A6=1 (needs the HTTPS dev server)',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  // WebGPU on (Eshkol's VM dispatches tensor work to WGSL through JSPI).
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const staticUrl = new URL('service-assets/README.md', BASE).href;
    const channelName = `ulg-a6-${Date.now()}`;
    const pages = {};
    for (const peer of ['A', 'B', 'C', 'D']) {
      pages[peer] = await context.newPage();
      await pages[peer].goto(staticUrl, { waitUntil: 'domcontentloaded' });
    }
    for (const peer of ['B', 'C', 'D']) {
      await pages[peer].evaluate(async ({ channelName, peer }) => {
        const m = await import('/src/services/clientDerivationPeers.js');
        globalThis.__a6 = m.startClientDerivationResponder({ channelName, peerId: `peer-${peer}`, nodeId: `client-${peer}` });
      }, { channelName, peer });
    }
    await pages.A.evaluate(async ({ channelName }) => {
      const m = await import('/src/services/clientDerivationPeers.js');
      const cacheModule = await import('/src/runtime/material/remoteDerivationArtifactCache.js');
      const requester = m.startClientDerivationRequester({ channelName, peerId: 'peer-A', primaryPeerId: 'peer-B',
        replicaPeerIds: ['peer-C', 'peer-D'] });
      let remoteCalls = 0;
      const derive = async (request) => {
        remoteCalls += 1;
        const value = await requester.submit(`ulg-a6-${request.kind}-${remoteCalls}`, request.data);
        return { value, provenance: requester.lastProvenance() };
      };
      globalThis.__a6 = { requester, cache: cacheModule.createRemoteDerivationArtifactCache({ derive,
        sourceIdentity: 'moonlab+eshkol client assets' }), remoteCalls: () => remoteCalls };
    }, { channelName });
    await pages.A.waitForTimeout(600); // presence
    // C2: close the primary page.
    await pages.B.close({ runBeforeUnload: true });
    await pages.A.waitForTimeout(1200);

    const out = await pages.A.evaluate(async () => {
      const { requester, cache, remoteCalls } = globalThis.__a6;
      const moonlab = { kind: 'moonlab-ghz-12', data: { service: 'moonlab', qubits: 12 } };
      const M = 0.028014, R = 8.314462618;
      const definition = `(define (rho T P) (/ (* P ${M}) (* ${R} T)))`;
      const points = [[300, 101325], [450, 150000], [900, 200000]];
      // threshold 1: every tensor op is eligible for the GPU seam in this check.
      const eshkol = { kind: 'eshkol-n2-density', data: { service: 'eshkol', threshold: 1, definition, call: 'rho', points } };
      const summary = (p) => ({ role: p.role, peerId: p.peerId, primaryFailure: p.primaryFailure?.code ?? null,
        quorum: p.validation?.reason ?? null, matching: p.validation?.matchingResultCount ?? null });
      const steps = [];
      // First derivations: pending until the boundary.
      steps.push({ moonlab1: await cache.request(moonlab) });
      const moonlabProvenance = summary(requester.lastProvenance());
      const moonlabResidency1 = requester.deltas.at(-1).payload.residency;
      steps.push({ visibleBeforeBoundary: cache.get(moonlab) != null });
      cache.scheduleBoundary();
      const moonlabArtifact = cache.get(moonlab);
      await cache.request(eshkol);
      const eshkolProvenance = summary(requester.lastProvenance());
      const eshkolResidency1 = requester.deltas.at(-1).payload.residency;
      cache.scheduleBoundary();
      const eshkolArtifact = cache.get(eshkol);
      // Second, distinct derivations reuse the warm workers.
      const moonlab2 = await requester.submit('ulg-a6-moonlab-second', { service: 'moonlab', qubits: 12 });
      const moonlabResidency2 = requester.deltas.at(-1).payload.residency;
      await requester.submit('ulg-a6-eshkol-second', { service: 'eshkol', definition, call: 'rho', points: [[600, 101325]] });
      const eshkolResidency2 = requester.deltas.at(-1).payload.residency;
      // C6: tensor work through Eshkol's WebGPU backend: sum(A B), n = 16.
      const n = 16;
      const a = Array.from({ length: n * n }, (_, i) => ((i * 37) % 23) - 11);
      const b = Array.from({ length: n * n }, (_, i) => ((i * 53) % 19) - 9);
      const tensor = await requester.submit('ulg-a6-eshkol-matmul', { service: 'eshkol', operation: 'matmul-sum',
        threshold: 1, n, a, b });
      const tensorResidency = requester.deltas.at(-1).payload.residency;
      let reference = 0;
      for (let k = 0; k < n; k++) {
        let colA = 0, rowB = 0;
        for (let i = 0; i < n; i++) colA += a[i * n + k];
        for (let j = 0; j < n; j++) rowB += b[k * n + j];
        reference += colA * rowB;
      }
      // C5: hit and invalidation.
      const callsBefore = remoteCalls();
      const hit = await cache.request(moonlab);
      const callsAfter = remoteCalls();
      const dropped = cache.sourceChanged('other client assets');
      return { moonlabProvenance, eshkolProvenance, moonlabResidency1, moonlabResidency2, eshkolResidency1,
        eshkolResidency2, moonlabArtifact: moonlabArtifact?.value ?? null, moonlab2,
        eshkolSamples: eshkolArtifact?.value?.samples ?? null, points, M, R, tensor, tensorResidency, reference,
        visibleBeforeBoundary: steps[1].visibleBeforeBoundary, hitSource: hit.source, callsBefore, callsAfter,
        dropped, afterInvalidation: cache.get(moonlab), log: cache.log.map((e) => `${e.event}@${e.scheduleOrdinal}`) };
    });
    console.log(JSON.stringify({ moonlabProvenance: out.moonlabProvenance, eshkolProvenance: out.eshkolProvenance,
      residency: [out.moonlabResidency1, out.moonlabResidency2, out.eshkolResidency1, out.eshkolResidency2],
      eshkolSamples: out.eshkolSamples, tensor: out.tensor, reference: out.reference,
      webgpu: out.tensorResidency?.worker, log: out.log }));
    // C1 and C2.
    for (const p of [out.moonlabProvenance, out.eshkolProvenance]) {
      assert.equal(p.role, 'promoted-replica');
      assert.equal(p.primaryFailure, 'ERR_CLIENT_PEER_ABSENT');
      assert.ok(['client-C', 'client-D'].includes(p.peerId));
      assert.equal(p.quorum, 'quorum-accepted');
      assert.equal(p.matching, 2);
    }
    assert.ok(['peer-C', 'peer-D'].includes(out.moonlabResidency1.pageId), 'C1: a responder page computed it');
    // GHZ-12 on MoonLab's WebGPU kernels: only |0...0> and |1...1>, each 1/2
    // (complex64 on the GPU: within 1e-6).
    const ghz = out.moonlabArtifact;
    assert.equal(ghz.dim, 4096);
    assert.deepEqual(ghz.nonzero.map(([index]) => index), [0, 4095]);
    for (const [, p] of ghz.nonzero) {
      assert.ok(Math.abs(p - 0.5) < 1e-6, `GHZ probability ${p}`);
      // The CPU fallback computes in f64 (0.5000000000000001); the WGSL
      // kernels compute in f32, so each probability is an f32 value.
      assert.equal(Math.fround(p), p, `C6: GHZ probability ${p} carries the f32 GPU signature`);
    }
    assert.equal(ghz.nativeDispatches, ghz.expectedDispatches, 'C6: every gate and the probabilities ran as WGSL dispatches');
    assert.deepEqual(out.moonlab2, ghz, 'deterministic MoonLab value');
    const moonlabWorker = out.moonlabResidency1.worker;
    assert.equal(moonlabWorker.runtime, 'moonlab-wasm-webgpu-worker');
    assert.equal(moonlabWorker.nativeAccelerated, 1, `C6: MoonLab WebGPU kernels executed: ${JSON.stringify(moonlabWorker)}`);
    assert.equal(moonlabWorker.webgpuInitError, null);
    assert.equal(moonlabWorker.webgpuDispatchError, null);
    assert.equal(out.moonlabResidency2.worker.loads, 1, 'C3: MoonLab module and GPU context created once');
    // C3.
    assert.equal(out.moonlabResidency1.spawns, 1);
    assert.equal(out.moonlabResidency2.spawns, 1);
    assert.equal(out.moonlabResidency2.calls, out.moonlabResidency1.calls + 1, 'C3: same warm MoonLab worker');
    assert.equal(out.eshkolResidency2.spawns, 1);
    assert.equal(out.eshkolResidency2.worker.loads, 1, 'C3: Eshkol VM instantiated once');
    assert.equal(out.eshkolResidency2.calls, out.eshkolResidency1.calls + 1);
    // C4.
    out.eshkolSamples.forEach((value, i) => {
      const [T, P] = out.points[i];
      assert.ok(Math.abs(value - P * out.M / (out.R * T)) <= 1e-12 * value, `C4: Eshkol sample ${i}`);
    });
    // C6: Eshkol's WebGPU build is attached and the tensor work ran on the GPU.
    const worker = out.tensorResidency.worker;
    assert.equal(worker.webgpuStatus?.ok, true, `C6: WebGPU attached: ${JSON.stringify(worker.webgpuStatus)}`);
    assert.equal(worker.backend?.active, true);
    assert.equal(worker.backend?.precision, 'exact', 'C6: sf64 exact tier');
    assert.ok(worker.gpuDispatches > 0, `C6: GPU dispatches ${worker.gpuDispatches}`);
    assert.equal(out.tensor.matmulSum, out.reference, 'C6: sum(A B) exact (integer-valued data)');
    // C5.
    assert.equal(out.visibleBeforeBoundary, false);
    assert.equal(out.hitSource, 'cache');
    assert.equal(out.callsAfter, out.callsBefore);
    assert.equal(out.dropped, 2);
    assert.equal(out.afterInvalidation, null);
  } finally { await browser.close(); }
});
