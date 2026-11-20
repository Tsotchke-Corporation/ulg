# A6 PeerCompute-owned warm remote derivation: MoonLab and Eshkol in the client (WASM + WebGPU)

Date: 2026-11-14. Track A6. It builds on G5 (reservation), G6 (cache and
adoption) and PeerCompute's remote-compute stack: `NodeKernel` responders,
redundant network placement with replica promotion, and the quorum result
validator.

The first slice ran the derivations in Node responder processes. The user
rejected that ("eshkol and moonlab should be running in the client under
wasm"; "use the eshkol wasm build that supports webgpu"; "definitely use the
webGPU moonlab"), so the Node responders, Node task modules and their test
were removed. Nothing derives in Node now: Node only drives the browser in
the test.

## Delivered

**Peers.** `src/services/clientDerivationPeers.js` makes same-origin browser
pages into PeerCompute peers over a `BroadcastChannel`.
- `startClientDerivationResponder` runs a `NodeKernel` responder with its own
  `ComputeManager` and announces presence every 250 ms and on `pagehide`.
- `startClientDerivationRequester` uses a redundant placement executor with a
  2-of-2 quorum validator. A peer with no presence for 1 s, or one that said
  it is not alive, fails with `ERR_CLIENT_PEER_ABSENT`.

**Task.** `src/services/clientWarmDerivationTask.js` keeps one warm Web
Worker per service per page. The value it returns is deterministic, so the
quorum can compare it. Residency (page, spawns, calls, worker telemetry)
travels in the commit delta.

**MoonLab worker.** `public/workers/moonlab-warm-webgpu.worker.js` runs
MoonLab's WASM core with its WebGPU backend.
- Calls: `gpu_compute_init(GPU_BACKEND_WEBGPU)`, then `gpu_*_u32` gates under
  Asyncify, then `gpu_compute_probabilities_u32`.
- The module and the GPU context are created once per worker.
- It waits for an adapter first: in a fresh GPU process the first
  `requestAdapter()` can resolve null, and that dispatch would then run on the
  CPU.
- It reports `nativeDispatches` against the expected count.

**Eshkol worker.** `public/workers/eshkol-warm-vm.worker.js` runs Eshkol's
VM with its WebGPU compute backend.
- Setup: `EshkolWebGPU.create`, then `attachVm` (JSPI-suspending GPU
  imports), then `EshkolVM`, then `vmCall('repl_init')`.
- Evaluation is `vmCall('repl_eval', …)`.
- The VM's stdout is line-buffered, so every displayed value is followed by
  `(newline)`.
- Tensor work above the backend threshold runs in WGSL at the sf64 exact
  tier.

**Cache.** `src/runtime/material/remoteDerivationArtifactCache.js` handles
the requester side (unchanged).
- The request key binds the service source.
- Derivation is single-flight; results stay pending until a schedule
  boundary, and only then are adopted.
- Hits make no remote call.
- A source change invalidates entries derived from the old source.

**Assets.** Both builds are under `public/service-assets/`, with hashes in
`SOURCE.txt`:
- Eshkol: the `eshkol-vm.js`, `eshkol-vm.wasm` and `eshkol-webgpu.js` site
  build from `upstream/master` `eb224260b`.
- MoonLab: `moonlab.js` and `moonlab.wasm`, rebuilt with the WebGPU fix below.

## MoonLab's browser WebGPU path never ran: fixed upstream in PR #50

In MoonLab's WASM build, every native gate dispatch silently fell back to the
CPU, for two reasons:

1. `moonlab_webgpu_init_async` was `EM_ASYNC_JS`, which Emscripten emits as
   `__asyncjs__…`, so the dispatch bodies' call to it threw a
   `ReferenceError`.
2. The WGSL used `target`, a reserved word, as a field name. The shader
   module failed to compile.

Results stayed correct (f64 CPU path) but `gpu_is_native_accelerated` was 0.
The fix, plus diagnostics (`lastInitError`, `lastDispatchError`,
`nativeDispatches`) and a node-only source guard test, is
https://github.com/tsotchke/moonlab/pull/50 (branch
`fix/webgpu-native-dispatch` from `master`). The local checkout
(`fix/browser-parity-entry`) carries the same uncommitted source change.

## Evidence: `tests/a6ClientDerivation.native.test.mjs` (`ULG_RUN_NATIVE_A6=1`, passes)

**Setup.** Headless Chrome with Vulkan WebGPU, and four pages on a static
asset URL, so the app never starts. Requester A uses the cache; responders
are B, C and D. Primary B is closed before the first request.

- **C1/C2, remote execution and recovery.** Placement promotes replica
  `client-C` (`primaryFailure ERR_CLIENT_PEER_ABSENT`) and the quorum is
  accepted (2 matching results). Page C's worker computed the result.
- **C3, warm residency.** On page C:
  - MoonLab: one spawn, calls 1 then 2, module and GPU context loaded once;
    the first call took 838 ms (load plus pipelines), the second 40 ms.
  - Eshkol: the VM loaded once (217 ms); the second call took 1.2 ms.
- **C4, Eshkol samples.** N2 ideal-gas density matches the JS reference to
  1e-12 relative: 1.1379843694908534, 1.1231032514096753 and
  0.7487355009397834 kg/m³.
- **C5, cache.** The log reads `derived@0, adopted@1, derived@1, adopted@2,
  hit@2, source-changed@2`.
- **C6, WebGPU in both services.**
  - MoonLab GHZ-12: 13 of 13 WGSL dispatches. P(|0…0⟩) = P(|1…1⟩) =
    0.4999999701976776, an f32 value (the CPU path gives
    0.5000000000000001). No init or dispatch errors.
  - Eshkol `sum(A·B)` for 16×16 integer matrices: 249, exact, from 2 WebGPU
    dispatches (`webgpu:reduce_sf64`, precision `exact`, 0 fallbacks).

`scripts/a6-client-worker-smoke.mjs` runs both workers directly in one page,
without PeerCompute, to diagnose them.

## Limits and next

- **"Remote" here means separate pages in one browser** (BroadcastChannel).
  Cross-device placement needs PeerCompute's network transport (WebRTC or
  relay) to other machines. That is outward-facing, so it needs the user's
  go-ahead and named peers.
- **The Eshkol-side derivations are small.** Wiring them to ULG's actual
  closure misses (the G6 `localClosureFitCache` / A3 regional sampler) is the
  integration step.
