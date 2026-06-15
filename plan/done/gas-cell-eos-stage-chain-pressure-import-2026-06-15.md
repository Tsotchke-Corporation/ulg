# Gas-Cell EOS Stage-Chain Pressure Import Wiring

Date: 2026-06-15 AKDT

## Done

- Added `gasCellEosProducer` to the opt-in mechanics stage-chain contract so a
  ComputeManager chain can run
  `p2g -> gasCellEosProducer -> pressureInterface -> gridUpdate -> g2p`.
- Published the producer's retained gas-cell field through the resident
  authority host before pressureInterface consumes it.
- Passed the admitted gas-cell import/admission into pressureInterface for both
  local stage executors and resident worker context.
- Fixed the producer-pressure merge so missing pressure feedback stays `null`;
  pressureInterface now derives full feedback from the producer-enriched
  gas-pressure summary instead of using a partial synthetic feedback object.
- Exposed browser host submit/status surfaces for the gas-cell EOS producer
  stage and let `runMechanicsStageTaskChain()` pass the host as the authority
  publication boundary.
- Let the scene import helper publish from a producer result source when one is
  available.

## Validation

- PASS: syntax checks for modified runtime and test files.
- PASS: focused stage-chain coverage:
  `node --test tests/sphMlsMpmGpuStep.test.mjs --test-name-pattern "gas-cell EOS producer before pressureInterface"`
  reported `45/45`.
- PASS: focused scene producer-source coverage:
  `node --test tests/sphPhaseRenderer.test.mjs --test-name-pattern "producer result source"`
  reported `30/30`.
- PASS: broader SPH gas/pressure coverage reported `45/45`.
- PASS: scene gas-cell coverage reported `30/30`.
- PASS: PeerCompute integration reported `15/15`.
- PASS: `npm run test:physics-atomics` reported `7` passing checks and `1`
  expected opt-in long-horizon liquid skip.
- PASS: browser PeerCompute authority-host Playwright gate reported `1/1`.
- PASS: visual matrix
  `codex-gas-eos-stage-chain-live-wire-20260615` reported `3/3` with
  `failedCount=0`, `issues=[]`, and `visualSurfaceIssues=[]`.

## Still Open

- Mounted scene hot-loop opt-in is still next; this completed slice proves the
  formal stage-chain/helper path.
- The gas-cell EOS math is still CPU/oracle derivation plus WebGPU row upload;
  a true WGSL EOS shader remains open.
- MLS-MPM H2O fragmentation, CPU-SPH liquid/solid stacked blob shapes,
  ice/solid rigidity, volume pulsation/blinking, long-horizon settling, and
  renderer z-buffer/focus visual trust remain active P0/P1 blockers.
