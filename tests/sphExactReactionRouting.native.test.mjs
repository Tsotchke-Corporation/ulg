import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SPH_REACTION_PRODUCT_PLACEMENT_TRANSACTION_STATUS as transactionStatus }
  from '../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';

const enabled = process.env.ULG_RUN_NATIVE_EXACT_REACTION_ROUTING === '1';
const baseUrl = process.env.ULG_EXACT_REACTION_ROUTING_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
const evidencePath = process.env.ULG_EXACT_REACTION_ROUTING_EVIDENCE;
const manifestPath = process.env.ULG_EXACT_REACTION_ROUTING_MANIFEST;
// A selected source case still traverses the real canonical producer, reaction,
// quantity materialization and placement. It does not claim the full corpus.
const selectedCaseNames = process.env.ULG_EXACT_REACTION_ROUTING_CASES?.split(',');
const runArithmeticCorpus = selectedCaseNames === undefined;
const runPlacementChain = process.env.ULG_EXACT_REACTION_ROUTING_PLACEMENT === '1';
const advanceFullStep = process.env.ULG_EXACT_REACTION_ROUTING_ADVANCE_FULL_STEP === '1';
const historyContinuation = process.env.ULG_EXACT_REACTION_ROUTING_CONTINUE_HISTORY ?? null;
const completeOuterReaction = process.env.ULG_EXACT_REACTION_ROUTING_COMPLETE_OUTER_REACTION === '1';
const inspectHistoryGas = process.env.ULG_EXACT_REACTION_ROUTING_HISTORY_GAS === '1';
const inspectHistoryP2g = process.env.ULG_EXACT_REACTION_ROUTING_HISTORY_P2G === '1';
const rejectHistoryG2p = process.env.ULG_EXACT_REACTION_ROUTING_HISTORY_G2P_REJECT === '1';
const inspectHistoryG2p = process.env.ULG_EXACT_REACTION_ROUTING_HISTORY_G2P === '1';
const inspectG2pDeformation = process.env.ULG_EXACT_REACTION_ROUTING_G2P_DEFORMATION === '1';
const traceHistoryP2g = process.env.ULG_EXACT_REACTION_ROUTING_TRACE_HISTORY_P2G === '1';
const advanceThermal = process.env.ULG_EXACT_REACTION_ROUTING_ADVANCE_THERMAL === '1';
const advanceReaction = process.env.ULG_EXACT_REACTION_ROUTING_ADVANCE_REACTION === '1';
const traceReaction = process.env.ULG_EXACT_REACTION_ROUTING_TRACE_REACTION === '1';
const advanceMechanics = process.env.ULG_EXACT_REACTION_ROUTING_ADVANCE_MECHANICS === '1';
const capturedClosure = process.env.ULG_EXACT_REACTION_ROUTING_CAPTURED_CLOSURE === '1';
const capturedProductionStep = process.env.ULG_EXACT_REACTION_ROUTING_CAPTURED_STEP === '1';
const traceMechanicsRefresh = process.env.ULG_EXACT_REACTION_ROUTING_TRACE_REFRESH === '1';
const tracePlacementPasses = process.env.ULG_EXACT_REACTION_ROUTING_TRACE_PASSES === '1';
const cloneChemistryBindings = process.env.ULG_EXACT_REACTION_ROUTING_REBIND_CHEMISTRY === 'buffers';
const rebuildChemistryPipeline = cloneChemistryBindings || process.env.ULG_EXACT_REACTION_ROUTING_REBIND_CHEMISTRY === 'pipeline';
const rebindChemistry = rebuildChemistryPipeline || process.env.ULG_EXACT_REACTION_ROUTING_REBIND_CHEMISTRY === '1';
const mapChemistryCompletion = process.env.ULG_EXACT_REACTION_ROUTING_CHEMISTRY_COMPLETION === 'map';
const chemistryDispatchCount = process.env.ULG_EXACT_REACTION_ROUTING_CHEMISTRY_DISPATCH_COUNT === undefined
  ? null : Number(process.env.ULG_EXACT_REACTION_ROUTING_CHEMISTRY_DISPATCH_COUNT);
const watchdogMs = Number(process.env.ULG_EXACT_REACTION_ROUTING_TIMEOUT_MS ?? 1740000);

test('actual reaction runner stages physical endpoints and stably compacts exact event companions on native WebGPU', {
  skip: !enabled && 'set ULG_RUN_NATIVE_EXACT_REACTION_ROUTING=1 for owned desktop WebGPU', timeout: 1800000
}, async () => {
  assert.ok(evidencePath && manifestPath, 'native routing requires evidence and a frozen full source manifest');
  assert.ok(Number.isSafeInteger(watchdogMs) && watchdogMs >= 5000 && watchdogMs <= 1740000);
  if (runPlacementChain) assert.equal(selectedCaseNames?.length, 1,
    'unpublished placement diagnostics require one case on their owned device');
  if (completeOuterReaction) assert.ok(runPlacementChain && !capturedClosure && !capturedProductionStep
    && !advanceMechanics && !tracePlacementPasses, 'outer reaction uses the actual completed step');
  if (historyContinuation) assert.ok(completeOuterReaction && !inspectHistoryP2g && ['physical', 'pressure', 'guarded-reaction', 'reaction', 'rollback'].includes(historyContinuation), 'history continuation requires complete original steps');
  if (inspectHistoryGas) assert.ok(completeOuterReaction && !inspectHistoryP2g && !historyContinuation, 'gas inspection requires its original completed reaction');
  if (inspectHistoryP2g) assert.ok(completeOuterReaction, 'history P2G requires a completed original outer reaction');
  if (rejectHistoryG2p) assert.ok(inspectHistoryG2p, 'rejection fault requires original history G2P');
  if (inspectHistoryG2p) assert.ok(inspectHistoryP2g, 'history G2P requires the original P2G chain');
  if (traceHistoryP2g) assert.ok(inspectHistoryP2g, 'history pass tracing requires the original history P2G diagnostic');
  if (tracePlacementPasses) assert.ok(runPlacementChain, 'pass tracing requires the isolated placement diagnostic');
  if (capturedProductionStep || capturedClosure) assert.ok(runPlacementChain && !tracePlacementPasses,
    'captured production steps require the original unmodified placement path');
  if (rebindChemistry) assert.ok(tracePlacementPasses, 'binding recreation is diagnostic tracing only');
  if (mapChemistryCompletion) assert.ok(tracePlacementPasses && !rebindChemistry, 'mapped completion uses original traced bindings');
  if (chemistryDispatchCount !== null) assert.ok(tracePlacementPasses && !rebindChemistry && !mapChemistryCompletion
    && Number.isSafeInteger(chemistryDispatchCount) && chemistryDispatchCount > 0, 'limited dispatch is diagnostic only');
  if (selectedCaseNames) {
    assert.ok(selectedCaseNames.every(name => name.length > 0));
    assert.equal(new Set(selectedCaseNames).size, selectedCaseNames.length);
  }
  const manifest = (await readFile(manifestPath, 'utf8')).trim().split('\n').map(line => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line); assert.ok(match); return { sha256: match[1], path: match[2] };
  });
  const verify = async () => {
    for (const source of manifest) assert.equal(createHash('sha256').update(await readFile(source.path)).digest('hex'), source.sha256, source.path);
  };
  await verify();
  const evidence = { schema: 'ulg.native-exact-reaction-outputs.v1', started: new Date().toISOString(),
    sources: manifest, headed: true, physicalPublicationAdmitted: false, fullG2Acceptance: false, completeOuterReaction, historyContinuation, inspectHistoryGas, inspectHistoryP2g, inspectHistoryG2p, rejectHistoryG2p, inspectG2pDeformation, traceHistoryP2g,
    selectedCaseNames: selectedCaseNames ?? null, fullCorpus: runArithmeticCorpus, runPlacementChain, capturedProductionStep, capturedClosure, advanceMechanics, advanceThermal, advanceReaction, traceReaction, advanceFullStep, traceMechanicsRefresh, tracePlacementPasses, rebindChemistry, rebuildChemistryPipeline, cloneChemistryBindings, mapChemistryCompletion, chemistryDispatchCount, watchdogMs, errors: [], console: [] };
  let browser, watchdog, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    watchdog = setTimeout(() => { failure ??= new Error('Owned exact output browser timeout'); void browser.close(); }, watchdogMs);
    const page = await browser.newPage();
    evidence.partialResults = [];
    await page.exposeFunction('recordExactPlacementProgress', async value => {
      evidence.partialResults.push(value);
      await writeFile(`${evidencePath}.progress.json`, JSON.stringify({
        schema: 'ulg.exact-placement-native-partial.v1', complete: false,
        started: evidence.started, manifestPath, results: evidence.partialResults
      }, null, 2) + '\n');
    });
    page.on('pageerror', error => evidence.errors.push(String(error)));
    page.on('console', message => {
      evidence.console.push({ type: message.type(), text: message.text() });
      if (message.text().startsWith('exact-routing-progress ')) console.log(message.text());
    });
    evidence.setupRetries = [];
    const navigate = async () => {
      for (let attempt = 0; ; attempt++) {
        try { await page.goto(new URL('package.json', baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 }); return; }
        catch (error) {
          if (attempt >= 2 || !/ERR_CERT_VERIFIER_CHANGED|interrupted by another navigation/.test(String(error))) throw error;
          evidence.setupRetries.push(String(error));
          // Vite can reload while a newly imported dependency is optimized.
          // Let that navigation settle before starting another one ourselves.
          await page.waitForLoadState('networkidle', { timeout: 60000 });
        }
      }
    };
    await navigate();
    for (let attempt = 0; ; attempt++) {
      try {
        await page.evaluate(async () => {
          await (await import('/tests/fixtures/sphExactMassContinuationNative.js')).preloadExactMassContinuationNative();
          await import('/tests/fixtures/sphExactReactionSourceNative.js');
          await import('/tests/fixtures/sphExactReactionRoutingInspection.js');
          await import('/tests/fixtures/sphExactReactionOutputInspection.js');
          await import('/tests/fixtures/sphExactPlacementQuantityInspection.js');
          await import('/tests/fixtures/sphExactRationalQuantityNative.js');
          await import('/tests/fixtures/sphExactRationalProjectionNative.js');
          await import('/tests/fixtures/sphExactReactionEventCompactionNative.js');
          await import('/src/runtime/sph/sphExactReactionRoutingGpu.js');
        });
        break;
      } catch (error) {
        if (attempt > 0 || !/Execution context was destroyed|Failed to fetch/.test(String(error))) throw error;
        await navigate();
      }
    }
    evidence.result = await page.evaluate(async ({ selectedCaseNames, runArithmeticCorpus, runPlacementChain, capturedProductionStep, capturedClosure, advanceMechanics, advanceThermal, advanceReaction, traceReaction, advanceFullStep, completeOuterReaction, historyContinuation, inspectHistoryGas, inspectHistoryP2g, inspectHistoryG2p, rejectHistoryG2p, inspectG2pDeformation, traceHistoryP2g, traceMechanicsRefresh, tracePlacementPasses, rebindChemistry, rebuildChemistryPipeline, cloneChemistryBindings, mapChemistryCompletion, chemistryDispatchCount }) => {
      const fixture = await import('/tests/fixtures/sphExactReactionSourceNative.js');
      const selectionModule = fixture, reaction = fixture, routing = fixture;
      const inspection = await import('/tests/fixtures/sphExactReactionRoutingInspection.js');
      const outputInspection = await import('/tests/fixtures/sphExactReactionOutputInspection.js');
      const quantityInspection = await import('/tests/fixtures/sphExactPlacementQuantityInspection.js');
      const rationalQuantity = await import('/tests/fixtures/sphExactRationalQuantityNative.js');
      const projection = await import('/tests/fixtures/sphExactRationalProjectionNative.js');
      const compaction = await import('/tests/fixtures/sphExactReactionEventCompactionNative.js');
      const allocation = fixture, kinetics = fixture, massAbi = fixture;
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'no-adapter' };
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(adapter.limits.maxStorageBuffersPerShaderStage, 16)
      } });
      const result = { status: 'running', adapter: { vendor: adapter.info.vendor, architecture: adapter.info.architecture },
        projections: [], compactions: [], rationalQuantities: [], cases: [], errors: [] };
      device.lost.then(info => {
        result.deviceLoss = { reason: info.reason, message: info.message };
        console.log('exact-routing-progress', JSON.stringify({ phase: 'device-lost', ...result.deviceLoss }));
      });
      const moduleSources = new WeakMap();
      if (tracePlacementPasses) {
        const createModule = device.createShaderModule.bind(device);
        device.createShaderModule = descriptor => {
          const module = createModule(descriptor); moduleSources.set(module, descriptor.code); return module;
        };
      }
      if (runPlacementChain) {
        const createSync = device.createComputePipeline.bind(device);
        device.createComputePipeline = descriptor => {
          const identity = { label: descriptor.label ?? '', entryPoint: descriptor.compute.entryPoint };
          console.log('exact-routing-progress', JSON.stringify({ phase: 'native-sync-pipeline-requested', ...identity }));
          const pipeline = createSync(descriptor);
          console.log('exact-routing-progress', JSON.stringify({ phase: 'native-sync-pipeline-returned', ...identity }));
          return pipeline;
        };
      }
      const createPipeline = device.createComputePipelineAsync.bind(device);
      let pipelineSequence = 0;
      device.createComputePipelineAsync = async descriptor => {
        const pipelineId = pipelineSequence++, started = performance.now();
        const identity = { pipelineId, label: descriptor.label ?? '', entryPoint: descriptor.compute.entryPoint };
        if (tracePlacementPasses) {
          const code = moduleSources.get(descriptor.compute.module);
          if (typeof code !== 'string') throw new Error('Diagnostic lost original shader source');
          identity.sourceSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))))
            .map(byte => byte.toString(16).padStart(2, '0')).join('');
        }
        console.log('exact-routing-progress', JSON.stringify({ phase: 'native-pipeline-requested', ...identity }));
        try {
          const pipeline = await createPipeline(descriptor);
          console.log('exact-routing-progress', JSON.stringify({ phase: 'native-pipeline-complete',
            ...identity, elapsedMs: performance.now() - started }));
          return pipeline;
        } catch (error) {
          const info = await descriptor.compute.module.getCompilationInfo().catch(() => ({ messages: [] }));
          const compilationErrors = info.messages.filter(message => message.type === 'error')
            .map(({ message, lineNum, linePos }) => ({ message, lineNum, linePos }));
          console.log('exact-routing-progress', JSON.stringify({ phase: 'native-pipeline-failed',
            ...identity, elapsedMs: performance.now() - started, failure: String(error), compilationErrors }));
          throw error;
        }
      };
      device.addEventListener('uncapturederror', event => result.errors.push(event.error.message));
      device.pushErrorScope('validation');
      const read = async buffer => {
        if (!(buffer.usage & 4)) throw new Error(`Native readback requires COPY_SRC: ${buffer.label}`);
        const staging = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
        try {
          const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, staging, 0, buffer.size);
          device.queue.submit([encoder.finish()]); await staging.mapAsync(1);
          const words = new Uint32Array(staging.getMappedRange()).slice(); staging.unmap(); return words;
        } finally { staging.destroy(); }
      };
      const integer = words => [...words].reverse().reduce((value, word) => (value << 32n) | BigInt(word), 0n);
      const velocities = [[.25, -.5, .125], [-.375, .25, -.125]];
      const balanced = [3 * Math.fround(.002), 2 * Math.fround(.032)];
      const cases = [
        { name: 'partial-two-survivors' },
        { name: 'hidden-survivors', dtSeconds: 1e-9 },
        { name: 'reversed-two-survivors', reverse: true },
        { name: 'moving-packet', velocities, internalPressureScale: 0, expectedPlacement: 'no-carrier-rollback' },
        { name: 'moving-packet-spares', velocities, internalPressureScale: 0, spareParticleCount: 3 },
        { name: 'moving-packet-two-reactions', velocities, internalPressureScale: 0, spareParticleCount: 6,
          expectedFollowingPlacement: 'placed' },
        { name: 'subthreshold-gas-history', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'subthreshold-gas-history-aerosol', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: true, fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'subthreshold-exact-condensation', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'condensation', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'subthreshold-exact-evaporation', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'evaporation', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'surface-exact-evaporation', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'surface-evaporation', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'rejected-exact-overdraw', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'overdraw', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-exchange', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', inspectCurrentGas: 'exchange', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-evaporation', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', inspectCurrentGas: 'surface-evaporation', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-commit', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: true, fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-shared', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'shared', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-graph', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-graph-reversed', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-reversed', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-graph-work', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-work', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-graph-rates', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        { name: 'post-mechanics-exact-graph-rates-midpoint', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-midpoint',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        { name: 'post-mechanics-exact-graph-rates-midpoint-substeps', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-midpoint-substeps',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        ...[4, 8].map(vaporRateSubsteps => ({
          name: `post-mechanics-exact-graph-rates-midpoint-substeps-${vaporRateSubsteps}`,
          velocities, internalPressureScale: 0, dtSeconds: 1e-9, vaporRateSubsteps,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-midpoint-substeps',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } })),
        ...[4, 8, 16, 32, 64].map(vaporRateSubsteps => ({
          name: `post-mechanics-exact-graph-rates-dyadic53-substeps-${vaporRateSubsteps}`,
          velocities, internalPressureScale: 0, dtSeconds: 1e-9, vaporRateSubsteps,
          vaporTransportPacketMode: 'rounded-dyadic-53', vaporConvergenceInspection: true,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-midpoint-substeps',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } })),
        { name: 'post-mechanics-exact-graph-rates-midpoint-substeps-8-trace',
          velocities, internalPressureScale: 0, dtSeconds: 1e-9, vaporRateSubsteps: 8, traceVaporArithmetic: true,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-midpoint-substeps',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        { name: 'post-mechanics-exact-graph-rates-midpoint-reversed', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-midpoint-reversed',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        { name: 'post-mechanics-exact-graph-rates-midpoint-domain', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-midpoint', rejectVaporExchange: 'midpoint-domain',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        { name: 'post-mechanics-exact-graph-rates-reversed', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates-reversed',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        { name: 'post-mechanics-exact-graph-rates-domain', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-rates', rejectVaporExchange: 'rate-domain',
          fixtureOptions: { waterProductPhaseId: 3, referencePressures: { h2o: 6.4e-5 } } },
        { name: 'post-mechanics-exact-graph-work-reversed', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-work-reversed', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-graph-work-reject-missing', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'graph-work', rejectVaporExchange: 'missing-gas-work', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-shared-reject-gross', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'shared', rejectVaporExchange: 'gross-overdraw', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-shared-reject-cell', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: 'shared', rejectVaporExchange: 'cross-cell', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-reject-overdraw', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: true, rejectVaporExchange: 'overdraw', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-reject-refresh', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: 'current', commitVaporExchange: true, rejectVaporExchange: 'refresh-failure', fixtureOptions: { waterProductPhaseId: 3 } },
        { name: 'post-mechanics-exact-read', velocities, internalPressureScale: 0, dtSeconds: 1e-9,
          exactAerosol: true, inspectCurrentGas: 'read', fixtureOptions: { waterProductPhaseId: 3 } },
        // Manufactured but model-admissible density gives a measurable residual
        // contribution to occupied volume through the original producer.
        { name: 'subthreshold-mixed-gas-history', velocities, internalPressureScale: 0, dtSeconds: 1e-8,
          fixtureOptions: { liquidDensities: { h2: 100000, o2: 100000, h2o: 2 } } },
        { name: 'subthreshold-history', velocities, internalPressureScale: 0, dtSeconds: 1e-9 },
        // Small retained mass with measurable momentum exercises the actual
        // fixed-point grid contribution without changing placement thresholds.
        { name: 'subthreshold-moving-history', velocities: [[200000, -125000, 87500], [200000, -125000, 87500]],
          internalPressureScale: 0, dtSeconds: 1e-8 },
        { name: 'identity-capture', velocities, internalPressureScale: 0, fixtureOptions: { identity: true } },
        { name: 'moving-packet-wide', velocities, internalPressureScale: 0, wordCount: 66, reverse: true },
        { name: 'free-one-endpoint', fixtureOptions: { mobileReactants: false } },
        { name: 'free-one-reversed', fixtureOptions: { mobileReactants: false }, reverse: true },
        { name: 'free-both-endpoints', fixtureOptions: { mobileReactants: false }, massesKg: balanced },
        { name: 'free-both-reversed-wide', fixtureOptions: { mobileReactants: false }, massesKg: balanced, reverse: true, wordCount: 66 },
        { name: 'single-product-split', fixtureOptions: { mobileReactants: false, singleProduct: true, coefficients: [2, 1] },
          massesKg: [2 * Math.fround(.002), Math.fround(.032)] },
        { name: 'single-product-split-reversed', fixtureOptions: { mobileReactants: false, singleProduct: true, coefficients: [2, 1] },
          massesKg: [2 * Math.fround(.002), Math.fround(.032)], reverse: true },
        { name: 'one-word-real-source', wordCount: 1, quantumExponent: -16, massesKg: [1 / 256, 1 / 128],
          fixtureOptions: { mobileReactants: false } },
        { name: 'product-volume-projection-underflow', expectedPhysicalError: 32, internalPressureScale: 0,
          fixtureOptions: { mobileReactants: false, singleProduct: true, coefficients: [2, 1],
            liquidDensities: { h2o: 1e38 } },
          massesKg: [2 * Math.fround(.002) * 1e-6, Math.fround(.032) * 1e-6] },
        { name: 'nonrelaxed-rejection', velocities, expectedError: 4194304 },
        { name: 'caloric-domain-rejection', fixtureOptions: { reactionInternalEnergyChangeJPerMolExtent: 1e9 }, expectedError: 8388608 }
      ];
      try {
        if (inspectHistoryP2g) {
          const { inspectExactHistoryAffineNative } = await import('/tests/fixtures/sphExactHistoryAffineNative.js');
          result.historyAffine = await inspectExactHistoryAffineNative(device, read);
          await globalThis.recordExactPlacementProgress({ phase: 'history-affine-numeric', result: result.historyAffine });
        }
        if (inspectG2pDeformation) {
          const { inspectExactG2pDeformationNative } = await import('/tests/fixtures/sphExactG2pQuantityNative.js');
          result.g2pDeformation = await inspectExactG2pDeformationNative(device, read);
          await globalThis.recordExactPlacementProgress({ phase: 'g2p-deformation', result: result.g2pDeformation });
        }
        const selectedCases = selectedCaseNames === undefined ? cases
          : selectedCaseNames.map(name => {
            const selected = cases.find(value => value.name === name);
            if (!selected) throw new Error(`Unknown exact reaction source case: ${name}`);
            return selected;
          });
        if (selectedCases.some(row => row.vaporTransportPacketMode === 'rounded-dyadic-53')) {
          result.transferPackets = [];
          for (const wordCount of [1, 2, 9, 66]) {
            const observed = await rationalQuantity.runExactRationalQuantityNative(device, { wordCount }, {
              cases: rationalQuantity.exactTransferPacketCases({ wordCount }),
              onProgress: value => console.log('exact-routing-progress', JSON.stringify({ phase: 'transfer-packet53', wordCount, ...value })) });
            result.transferPackets.push(observed);
            await globalThis.recordExactPlacementProgress({ phase: 'transfer-packet53', result: observed });
            if (!observed.pass) throw new Error(`Conservative transfer packet arithmetic failed at ${wordCount} words`);
          }
        }
        for (const wordCount of runArithmeticCorpus ? [1, 31, 63, 291] : []) {
          const observed = await rationalQuantity.runExactRationalQuantityNative(device, { wordCount }, {
            onProgress: value => console.log('exact-routing-progress', JSON.stringify({ phase: 'rational-quantity', wordCount, ...value })) });
          result.rationalQuantities.push(observed);
          await globalThis.recordExactPlacementProgress({ phase: 'rational-quantity', result: observed });
          console.log('exact-routing-progress', JSON.stringify({ phase: 'rational-quantity-complete', wordCount,
            caseCount: observed.caseCount, pass: observed.pass, failures: observed.cases.filter(row => !row.matches) }));
          if (!observed.pass) throw new Error(`Exact rational quantity arithmetic failed at ${wordCount} words`);
        }
        for (const wordCount of runArithmeticCorpus ? [1, 9, 66] : []) {
          const format = projection.createSphExactMassFormat({ wordCount, quantumExponent: wordCount === 66 ? -1074 : -149 });
          const observed = await projection.runExactRationalProjectionNative(device, format);
          result.projections.push(observed);
          console.log('exact-routing-progress', JSON.stringify({ phase: 'rational-projection', wordCount,
            caseCount: observed.caseCount, pass: observed.pass, failures: observed.cases.filter(row => !row.matches) }));
          if (!observed.pass) throw new Error(`Exact rational projection failed at ${wordCount} words`);
          const compacted = await compaction.runExactReactionEventCompactionNative(device, format);
          result.compactions.push(compacted);
          console.log('exact-routing-progress', JSON.stringify({ phase: 'event-compaction', wordCount,
            caseCount: compacted.caseCount, pass: compacted.pass,
            failures: compacted.cases.filter(row => !row.matches).map(row => ({ name: row.name, control: row.control })) }));
          if (!compacted.pass) throw new Error(`Exact event compaction failed at ${wordCount} words`);
        }
        for (const options of selectedCases) {
          console.log('exact-routing-progress', JSON.stringify({ phase: 'source-case-start', name: options.name }));
          if (completeOuterReaction) {
            const observed = await fixture.runExactReactionSourceNative(device, { ...options, completeOuterReaction: true,
              traceRejectedRetry: traceReaction,
              inspectReactionStage: args => fixture.inspectExactReactionStage({ ...args, read }),
              inspectCompletedStep: args => fixture.inspectCompletedExactReactionStep({ ...args, read, options: { ...options, historyContinuation, inspectHistoryGas, inspectHistoryP2g, inspectHistoryG2p, rejectHistoryG2p, traceHistoryP2g } }) });
            result.cases.push(observed);
            await globalThis.recordExactPlacementProgress({ phase: 'completed-outer-reaction', result: observed });
            const validation = await device.popErrorScope(); if (validation) result.errors.push(validation.message);
            continue;
          }
          if (capturedClosure) {
            const observed = await fixture.runExactReactionSourceNative(device, { ...options, stopAfterInspect: true,
              inspectPostMechanics: args => fixture.inspectExactReactionClosureNative({ args, read, options: { ...options, advanceMechanics, advanceThermal, advanceReaction, traceReaction, advanceFullStep } }) });
            result.cases.push(observed);
            await globalThis.recordExactPlacementProgress({ phase: 'captured-closure', result: observed });
            const validation = await device.popErrorScope(); if (validation) result.errors.push(validation.message);
            continue;
          }
          if (capturedProductionStep) {
            const observed = await fixture.runExactReactionSourceNative(device, { ...options, stopAfterInspect: true,
              inspect: args => fixture.inspectCapturedExactReactionNative({ args, read, options: { ...options, traceMechanicsRefresh } }) });
            result.cases.push(observed);
            await globalThis.recordExactPlacementProgress({ phase: 'captured-production-step', result: observed });
            const validation = await device.popErrorScope(); if (validation) result.errors.push(validation.message);
            continue;
          }
          const observed = await fixture.runExactReactionSourceNative(device, { ...options,
            stopAfterInspect: runPlacementChain, inspect: async args => {
            let selected, candidate, sourceClosing, placementFamily, candidateClosing;
            try {
              selected = await selectionModule.runSphExactReactionSourceSelectionWebGpu(args);
              const issued = selectionModule.resolveSphExactReactionSourceSelection(selected, { device });
              const before = await read(issued.source.sourceRead.read.buffer);
              const beforePhysical = await Promise.all([issued.source.stateBuffer, issued.source.thermoBuffer,
                issued.source.mechanicsBuffer].map(read));
              const pending = reaction.runSphReactionStepWebGpu({ ...args,
                sourceStateBuffer: args.thermalResult.stateBuffer, sourceThermoBuffer: args.thermalResult.thermoBuffer,
                sourceMechanicsBuffer: args.g2pResult.mechanicsBuffer,
                schroederSpatialEpochGeneration: args.generation,
                schroederSpatialReactionDiscoveryProposal: args.reactionDiscoveryProposal,
                exactReactionSourceSelection: selected, retainOutputParticleBuffers: true, readbackMode: 'no-full-readback' });
              // Every native case closes fresh parent admission during the
              // child's compile await. The child's independently held read owns it.
              sourceClosing = selected.release();
              candidate = await pending;
              const held = routing.resolveSphExactReactionRoutingCandidate(candidate, { device });
              const [sourceWords, routingWords, after] = await Promise.all([
                read(selected.outputBuffer), read(candidate.outputBuffer), read(held.source.source.inventory.buffer)
              ]);
              const physical = candidate.physicalOutput;
              const [sourcePackedWords, packedWords, eventWords, auxiliaryWords, compactEventWords,
                compactCompanionWords, compactCountWords, stateWords, thermoWords, mechanicsWords,
                originalStateWords, originalThermoWords, originalMechanicsWords] = await Promise.all([
                physical.sourcePackedBuffer, physical.packedBuffer, physical.eventBuffer, physical.auxiliaryBuffer,
                physical.compactEventBuffer, physical.compactCompanionBuffer, physical.compactCountBuffer,
                physical.stateBuffer, physical.thermoBuffer, physical.mechanicsBuffer,
                held.source.source.stateBuffer, held.source.source.thermoBuffer, held.source.source.mechanicsBuffer
              ].map(read));
              const output = outputInspection.inspectExactReactionOutputs({ sourceWords, routingWords, selected,
                routingLayout: candidate.layout, layout: physical.layout, sourcePackedWords, packedWords,
                originalInventoryWords: before, inventoryRowOffset: held.source.source.inventory.rowOffset,
                eventWords, auxiliaryWords, compactEventWords, compactCompanionWords, compactCountWords,
                stateWords, thermoWords, mechanicsWords,
                reactionTable: args.reactionTable,
                expectedPairErrors: options.expectedPhysicalError == null ? null : { 0: options.expectedPhysicalError } });
              const quantities = quantityInspection.inspectExactPlacementQuantities({ selected,
                layout: physical.quantities.layout, quantityWords: await read(physical.quantities.outputBuffer),
                sourceWords, sourcePackedWords, originalInventoryWords: before,
                inventoryRowOffset: held.source.source.inventory.rowOffset, auxiliaryWords,
                outputLayout: physical.layout, compactCompanionWords, compactCountWords, compiled: issued.compiled });
              const certificate = fixture.createSphReactionResolvePositionInvariantCertificate({ device,
                ancestorGeneration: args.generation, reactionInputStateBuffer: args.thermalResult.stateBuffer,
                reactionInputThermoBuffer: args.thermalResult.thermoBuffer,
                reactionInputMechanicsBuffer: args.g2pResult.mechanicsBuffer,
                transactionRollbackThermoBuffer: args.thermalResult.thermoBuffer,
                transactionRollbackMechanicsBuffer: args.g2pResult.mechanicsBuffer,
                frozenResolvedStateBuffer: physical.stateBuffer, frozenResolvedThermoBuffer: physical.thermoBuffer,
                frozenResolvedMechanicsBuffer: physical.mechanicsBuffer, particleCount: candidate.particleCount,
                reactionDiscoveryProposal: args.reactionDiscoveryProposal, reactionTable: args.reactionTable,
                exactReactionCandidate: candidate });
              const placementPending = fixture.runSchroederSpatialReactionPlacementEpochWebGpu({ device,
                ancestorPublicGeneration: args.generation, sphParticleState: args.sphParticleState,
                mlsMpmParticleState: args.mlsMpmParticleState, sphParticleUpload: args.sphParticleUpload,
                positionInvariantCertificate: certificate, frozenSourceStateBuffer: physical.stateBuffer,
                frozenSourceThermoBuffer: physical.thermoBuffer, frozenSourceMechanicsBuffer: physical.mechanicsBuffer });
              candidateClosing = candidate.release();
              placementFamily = await placementPending;
              const retainedPlacement = fixture.resolveSchroederSpatialReactionPlacementExactSource(placementFamily, { device });
              retainedPlacement.validate();
              const destination = await Promise.all([placementFamily.placedDestinationStateBuffer,
                placementFamily.placedDestinationThermoBuffer, placementFamily.placedDestinationMechanicsBuffer].map(read));
              const [originalQuantityWords, destinationQuantityWords, destinationResidualCount] = await Promise.all([
                physical.quantities.outputBuffer, placementFamily.placedDestinationQuantityBuffer,
                placementFamily.placedDestinationResidualCountBuffer
              ].map(read));
              const quantityOffset = physical.quantities.layout.currentRowOffset * physical.quantities.layout.recordWords;
              const expectedQuantityWords = originalQuantityWords.subarray(quantityOffset);
              const borrowedPlacement = { ownerClosedDuringPreparation: true,
                originalCandidate: retainedPlacement.view.result === candidate,
                retainedQuantityBuffer: retainedPlacement.view.result.physicalOutput.quantities.outputBuffer === physical.quantities.outputBuffer,
                frozenCopiesMatch: destination.every((words, i) => words.every((word, j) => word === [stateWords, thermoWords, mechanicsWords][i][j])),
                independentQuantityDestination: placementFamily.placedDestinationQuantityBuffer !== physical.quantities.outputBuffer,
                currentQuantityCopiesMatch: destinationQuantityWords.length === expectedQuantityWords.length
                  && destinationQuantityWords.every((word, index) => word === expectedQuantityWords[index]),
                residualCountCopiesMatch: destinationResidualCount.length === 2
                  && destinationResidualCount.every((word, index) => word === compactCountWords[index]),
                destinationQuantityLayoutMatches: placementFamily.placedDestinationQuantityLayout.currentRowOffset === 0
                  && placementFamily.placedDestinationQuantityLayout.eventRowOffset === candidate.particleCount
                  && placementFamily.placedDestinationQuantityLayout.rowCount
                    === candidate.particleCount + physical.quantities.layout.eventCapacity };
              let rawCopiesMatch = true;
              for (let row = 0; row < selected.particleCount; row++) {
                for (const [words, original, initial, stride, offset] of [[stateWords, originalStateWords, beforePhysical[0], 8, 0],
                  [thermoWords, originalThermoWords, beforePhysical[1], 12, 8], [mechanicsWords, originalMechanicsWords, beforePhysical[2], 32, 20]]) {
                  for (let i = 0; i < stride; i++) {
                    rawCopiesMatch &&= words[row * stride + i] === packedWords[row * 52 + offset + i]
                      && original[row * stride + i] === sourcePackedWords[row * 52 + offset + i]
                      && original[row * stride + i] === initial[row * stride + i];
                  }
                }
              }
              const orderWords = new Uint32Array(issued.compiled.length * (1 + candidate.layout.productCapacity)).fill(0xffffffff);
              issued.compiled.forEach((token, index) => {
                const order = token.products.map((term, ordinal) => ({ ordinal, gas: term.targetPhase === 3 }))
                  .sort((a, b) => Number(a.gas) - Number(b.gas) || a.ordinal - b.ordinal);
                orderWords[index * (1 + candidate.layout.productCapacity)] = order.length;
                orderWords.set(order.map(term => term.ordinal), index * (1 + candidate.layout.productCapacity) + 1);
              });
              const rows = [];
              for (let pair = 0; pair < selected.particleCount; pair++) {
                const base = pair * selected.recordWords;
                if (!sourceWords[base] && !sourceWords[base + 1]) continue;
                const token = issued.compiled[sourceWords[base + 4]], n = selected.format.wordCount;
                const original = held.source.source.inventory;
                const mass = row => integer(before.slice((original.rowOffset + row) * n, (original.rowOffset + row + 1) * n));
                const a = mass(sourceWords[base + 2]), b = mass(sourceWords[base + 3]);
                const cap = sourceWords[base + 8] ? kinetics.selectSphExactReactionKineticCap(token, sourceWords[base + 6], a + b) : a + b;
                const expected = allocation.selectSphExactReactionAllocation(token, { availableA: a, availableB: b, kineticCap: cap });
                const row = inspection.inspectExactReactionRouting({ sourceWords, routingWords, selected,
                  layout: candidate.layout, base, token, allocation: expected, orderWords, reactionTable: args.reactionTable,
                  expectedError: options.expectedError ?? null });
                const projected = mass => massAbi.projectSphExactMassF32Bits(
                  massAbi.encodeSphExactMassUnits(mass, selected.format), selected.format).bits;
                row.hiddenSurvivors = [[a, expected.remainderA], [b, expected.remainderB]]
                  .filter(([available, survivor]) => available > survivor && survivor > 0n
                    && projected(available) === projected(survivor)).length;
                rows.push(row);
              }
              let placementChain = null;
              if (runPlacementChain) {
                console.log('exact-routing-progress', JSON.stringify({ phase: 'full-placement-start', name: options.name }));
                if (tracePlacementPasses) console.log('exact-routing-progress', JSON.stringify({
                  phase: 'diagnostic-chemistry-source', format: selected.format,
                  sourceRecordWords: selected.recordWords, speciesOffsetWords: selected.speciesOffsetWords,
                  speciesLayout: selected.speciesLayout, pairCapacity: selected.particleCount,
                  sourceWords: Array.from(sourceWords) }));
                placementChain = await fixture.runExactPlacementChainNative({ device, family: placementFamily,
                  productTermCount: args.reactionTable.productTermCount, eventCapacity: physical.denseEventCount, read,
                  productionSummaryInputs: tracePlacementPasses ? null : {
                    sphParticleState: args.sphParticleState, reactionTable: args.reactionTable,
                    dtSeconds: args.dtSeconds, boxDimsM: args.sphParticleState.boxDimsM
                  },
                  tracePasses: tracePlacementPasses, rebindChemistry, rebuildChemistryPipeline, cloneChemistryBindings, mapChemistryCompletion, chemistryDispatchCount,
                  onProgress: progress => console.log('exact-routing-progress', JSON.stringify(progress)) });
                placementChain.conservation = quantityInspection.inspectExactPlacementConservation({
                  beforeWords: originalQuantityWords, beforeLayout: physical.quantities.layout,
                  afterWords: Uint32Array.from(placementChain.quantities), afterLayout: placementFamily.placedDestinationQuantityLayout,
                  residualCount: placementChain.residualCount, residualCompanions: placementChain.residualCompanions,
                  companionStrideWords: placementFamily.placedDestinationResidualLayout.companionStrideWords,
                  terminalStatus: placementChain.receipt.transactionalTerminalStatus });
                placementChain.physicalChanged = placementChain.state.some((word, i) => word !== stateWords[i])
                  || placementChain.thermo.some((word, i) => word !== thermoWords[i])
                  || placementChain.mechanics.some((word, i) => word !== mechanicsWords[i]);
                const equalWords = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);
                placementChain.physicalRestored = [placementChain.state, placementChain.thermo, placementChain.mechanics]
                  .every((words, i) => equalWords(words, [originalStateWords, originalThermoWords, originalMechanicsWords][i]));
                placementChain.quantitiesRestored = placementChain.quantities.every((word, i) =>
                  word === (i < quantityOffset ? originalQuantityWords[i] : 0));
                placementChain.residualHistoryCleared = [placementChain.residualCount, placementChain.residualEvents,
                  placementChain.residualCompanions].every(words => words.every(word => word === 0));
                const massLayout = placementFamily.placedDestinationQuantityLayout;
                placementChain.massInventoryMatchesQuantities = placementChain.massInventory.length
                    === massLayout.rowCount * massLayout.massWordCount
                  && placementChain.massInventory.every((word, i) => word === placementChain.quantities[
                    Math.floor(i / massLayout.massWordCount) * massLayout.recordWords + 16 + i % massLayout.massWordCount]);
                await globalThis.recordExactPlacementProgress({ phase: 'full-placement-result', result: placementChain });
              }
              return { name: options.name, options, wordCount: selected.format.wordCount, placementChain,
                rows, output, quantities, borrowedPlacement, rawCopiesMatch, sourceUnchanged: before.every((word, i) => word === after[i]),
                parentClosedDuringCompile: true, physicalPublicationAdmitted: candidate.physicalPublicationAdmitted,
                pass: rows.length === 1 && rows.every(row => row.matches) && output.matches && quantities.matches && rawCopiesMatch
                  && Object.values(borrowedPlacement).every(Boolean) };
            } catch (error) {
              console.log('exact-routing-progress', JSON.stringify({ phase: 'case-failed', name: options.name,
                failure: String(error.stack ?? error) }));
              // This one-case diagnostic owns its device. Retire raw-submitted
              // arena leases before awaiting source/candidate retirement.
              if (runPlacementChain) device.destroy();
              await error.exactReactionRoutingCleanupCompletion;
              await error.exactReactionSourceCleanupCompletion;
              throw error;
            }
            finally {
              if (runPlacementChain) {
                try {
                  const validation = await device.popErrorScope();
                  if (validation) result.errors.push(validation.message);
                } catch (error) { result.errors.push(String(error)); }
                finally { device.destroy(); }
              }
              if (placementFamily) await fixture.releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(placementFamily,
                { device, abandon: true });
              if (candidate) await (candidateClosing ?? candidate.release());
              if (selected) await (sourceClosing ?? selected.release());
            }
          } });
          result.cases.push(observed);
          await globalThis.recordExactPlacementProgress({ phase: 'source-placement', result: observed });
          console.log('exact-routing-progress', JSON.stringify({ name: options.name, pass: observed.pass,
            routeFailures: observed.rows.flatMap(row => row.failures), outputFailures: observed.output.failures,
            quantityFailures: observed.quantities.failures }));
        }
        if (!runPlacementChain) {
          await device.queue.onSubmittedWorkDone();
          const validation = await device.popErrorScope(); if (validation) result.errors.push(validation.message);
        }
        result.status = 'completed';
      } catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); }
      finally { device.destroy(); }
      return result;
    }, { selectedCaseNames, runArithmeticCorpus, runPlacementChain, capturedProductionStep, capturedClosure, advanceMechanics, advanceThermal, advanceReaction, traceReaction, advanceFullStep, completeOuterReaction, historyContinuation, inspectHistoryGas, inspectHistoryP2g, inspectHistoryG2p, rejectHistoryG2p, inspectG2pDeformation, traceHistoryP2g, traceMechanicsRefresh, tracePlacementPasses, rebindChemistry, rebuildChemistryPipeline, cloneChemistryBindings, mapChemistryCompletion, chemistryDispatchCount });
    assert.equal(evidence.result.status, 'completed', evidence.result.failure);
    if (inspectG2pDeformation) assert.equal(evidence.result.g2pDeformation?.pass, true, JSON.stringify(evidence.result.g2pDeformation));
    if (inspectHistoryP2g) assert.equal(evidence.result.historyAffine?.pass, true, JSON.stringify(evidence.result.historyAffine));
    assert.deepEqual(evidence.result.errors, []);
    assert.equal(evidence.result.cases.length, selectedCaseNames?.length ?? 18);
    if (selectedCaseNames) assert.deepEqual(evidence.result.cases.map(value => value.name), selectedCaseNames);
    assert.equal(evidence.result.rationalQuantities.length, runArithmeticCorpus ? 4 : 0);
    for (const result of evidence.result.rationalQuantities) {
      assert.equal(result.pass, true); assert.equal(result.sourceUnchanged, true); assert.ok(result.caseCount >= 70);
    }
    const packetWidths = evidence.result.cases.some(row => row.options.vaporTransportPacketMode === 'rounded-dyadic-53')
      ? [1, 2, 9, 66] : [];
    assert.deepEqual((evidence.result.transferPackets ?? []).map(row => row.wordCount), packetWidths);
    for (const result of evidence.result.transferPackets ?? []) {
      assert.equal(result.pass, true); assert.equal(result.sourceUnchanged, true);
      assert.equal(result.caseCount, result.wordCount === 1 ? 13 : 18);
      assert.ok(result.cases.every(row => row.matches));
    }
    assert.equal(evidence.result.projections.length, runArithmeticCorpus ? 3 : 0);
    for (const projection of evidence.result.projections) {
      assert.equal(projection.pass, true); assert.equal(projection.sourceUnchanged, true); assert.equal(projection.caseCount, 138);
    }
    assert.equal(evidence.result.compactions.length, runArithmeticCorpus ? 3 : 0);
    for (const compaction of evidence.result.compactions) {
      assert.equal(compaction.pass, true); assert.equal(compaction.caseCount, 24);
      assert.ok(compaction.cases.every(row => row.sourceUnchanged && row.matches));
    }
    for (const result of evidence.result.cases) {
      if (completeOuterReaction) {
        if (result.options.rejectVaporExchange) {
          assert.equal(result.rejectedExchange?.mode, result.options.rejectVaporExchange);
          assert.equal(result.rejectedExchange?.pass, true, JSON.stringify(result.rejectedExchange));
        }
        assert.equal(result.completeOuterReaction, true);
        assert.equal(result.enclosingMechanicsStepCompleted, true);
        assert.equal(result.pass, true, JSON.stringify(result));
        assert.ok(result.receipt.activeEventCount > 0);
        assert.equal(result.receipt.transactionalTerminalStatus,
          result.options.expectedPlacement === 'no-carrier-rollback' ? transactionStatus.SAFE_FROZEN_FALLBACK : transactionStatus.SAFE_PLACED);
        assert.equal(result.receipt.overflowFlags, 0);
        if (result.name === 'subthreshold-history') assert.equal(result.residualRowCount, 3);
        if (inspectHistoryGas) assert.equal(result.historyGas?.pass, true, JSON.stringify(result.historyGas));
        if (historyContinuation) {
          assert.equal(result.historyContinuation.completedFollowingSteps, 2);
          assert.equal(result.historyContinuation.pass, true, JSON.stringify(result.historyContinuation));
        }
        if (inspectHistoryP2g) {
          assert.equal(result.historyP2g.pass, true, JSON.stringify(result.historyP2g));
          assert.equal(result.historyP2g.projectionOnly, !inspectHistoryG2p);
          if (inspectHistoryG2p) assert.equal(result.historyP2g.g2p?.pass, true, JSON.stringify(result.historyP2g.g2p));
          if (result.name === 'subthreshold-history') assert.equal(result.historyP2g.numerical.rows.length, 3);
          if (result.name === 'subthreshold-moving-history') {
            assert.equal(result.historyP2g.numerical.rows.length, 3);
            assert.ok(result.historyP2g.grid.totals.slice(1).some(value => value !== 0),
              'moving residual history must measurably change original grid momentum');
          }
        }
        continue;
      }
      if (capturedProductionStep || capturedClosure) {
        assert.equal(capturedClosure ? result.capturedClosure : result.capturedProductionStep, true);
        assert.equal(result.enclosingMechanicsStepCompleted, false);
        assert.equal(result.pass, true, JSON.stringify(result));
        assert.equal(result.conservation.matches, true);
        if (advanceMechanics) {
          assert.equal(result.followingMechanics.matches, true, JSON.stringify(result.followingMechanics));
          assert.ok(result.followingMechanics.changedMomentumRows > 0);
          assert.ok(result.followingMechanics.changedEnergyRows > 0);
          if (advanceFullStep) {
            assert.equal(result.followingMechanics.followingPhysicalStepCompleted, true);
            assert.equal(result.followingMechanics.followingPhysicalStepCount, 2);
            assert.equal(result.followingMechanics.nextPhysicalStep.matches, true, JSON.stringify(result.followingMechanics.nextPhysicalStep));
            assert.equal(result.followingMechanics.nextPhysicalStep.ownerSurvivesStepRetirement, true);
            assert.equal(result.followingMechanics.ownerSurvivesStepRetirement, true);
            assert.equal(result.followingMechanics.published.matches, true, JSON.stringify(result.followingMechanics.published));
            assert.ok(result.followingMechanics.published.changedEnergyRows > 0);
          }
          if (advanceReaction) {
            assert.equal(result.followingMechanics.reaction.pass, true, JSON.stringify(result.followingMechanics.reaction));
            assert.ok(result.followingMechanics.reaction.sourceInspection.rows.length > 0);
            assert.ok(result.followingMechanics.reaction.sourceInspection.rows.some(row => row.roundedReseedWouldLoseEnergy));
            assert.equal(result.followingMechanics.reaction.receipt.transactionalTerminalStatus,
              result.options.expectedFollowingPlacement === 'placed' ? transactionStatus.SAFE_PLACED : transactionStatus.SAFE_FROZEN_FALLBACK);
          }
          if (advanceThermal && !advanceFullStep) {
            assert.equal(result.followingMechanics.thermal.matches, true, JSON.stringify(result.followingMechanics.thermal));
            assert.ok(result.followingMechanics.thermal.changedEnergyRows > 0);
          }
        }
        assert.equal(result.receipt.overflowFlags, 0);
        assert.equal(result.receipt.transactionalTerminalStatus,
          result.options.expectedPlacement === 'no-carrier-rollback' ? transactionStatus.SAFE_FROZEN_FALLBACK : transactionStatus.SAFE_PLACED);
        if (result.name === 'subthreshold-history') assert.equal(result.residualRowCount, 3);
        if (result.name === 'moving-packet-spares') assert.equal(result.receipt.sparePlacementEventCount, 3);
        if (result.name === 'moving-packet') assert.equal(result.receipt.noCarrierEventCount, 3);
        continue;
      }
      assert.equal(result.pass, true, JSON.stringify(result)); assert.equal(result.sourceUnchanged, true);
      assert.equal(result.output.matches, true); assert.equal(result.rawCopiesMatch, true);
      assert.equal(result.quantities.matches, true);
      assert.ok(Object.values(result.borrowedPlacement).every(Boolean));
      assert.equal(result.physicalPublicationAdmitted, false); assert.equal(result.parentClosedDuringCompile, true);
      if (runPlacementChain) {
        assert.equal(result.enclosingMechanicsStepCompleted, false);
        assert.equal(result.placementChain.placementSubmissionAuthenticated, true);
        assert.equal(result.placementChain.productionSummaryExecuted, true);
        for (const [key,value] of Object.entries(result.placementChain.handoff.checks)) {
          assert.equal(value, true, `placement handoff: ${key}`);
        }
        assert.equal(result.placementChain.physicalPublicationAdmitted, false);
        const rollback = result.options.expectedPlacement === 'no-carrier-rollback';
        assert.equal(result.placementChain.transactionCommitted, !rollback, JSON.stringify(result.placementChain.receipt));
        assert.equal(result.placementChain.receipt.transactionalTerminalStatus,
          rollback ? transactionStatus.SAFE_FROZEN_FALLBACK : transactionStatus.SAFE_PLACED);
        assert.equal(result.placementChain.receipt.overflowFlags, 0);
        assert.equal(result.placementChain.conservation.matches, true, JSON.stringify(result.placementChain.conservation));
        assert.equal(result.placementChain.massInventoryMatchesQuantities, true);
        if (rollback) {
          assert.equal(result.placementChain.receipt.noCarrierEventCount, 3);
          assert.equal(result.placementChain.receipt.spareAvailableCount, 0);
          assert.equal(result.placementChain.physicalRestored, true);
          assert.equal(result.placementChain.quantitiesRestored, true);
          assert.equal(result.placementChain.residualHistoryCleared, true);
        }
        if (result.name === 'moving-packet-spares') {
          assert.equal(result.placementChain.receipt.sparePlacementEventCount, 3);
          assert.equal(result.placementChain.receipt.noCarrierEventCount, 0);
          assert.equal(result.placementChain.physicalChanged, true);
          assert.deepEqual(result.placementChain.residualCount, [0, 0]);
        }
        if (result.name === 'subthreshold-history') {
          assert.ok(result.placementChain.receipt.subthresholdEventCount > 0);
          assert.equal(result.placementChain.receipt.noCarrierEventCount, 0);
          assert.ok(result.placementChain.handoff.residualRowCount > 0,
            'nonzero unplaced quantities must survive original-owner retirement and the real history merge');
        }
        if (result.name === 'identity-capture') {
          assert.ok(result.placementChain.receipt.captureMergeEventCount > 0, 'real classified capture required');
          assert.ok(result.placementChain.receipt.destinationMutationCount > 0, 'real receiver mutation required');
          assert.equal(result.placementChain.physicalChanged, true);
        }
      }
      const row = result.rows[0];
      if (result.name === 'hidden-survivors') assert.ok(row.hiddenSurvivors > 0, 'exact debit remains hidden in a surviving f32 projection');
      if (result.name.startsWith('free-one')) assert.ok(row.header[6] === 1 || row.header[6] === 2, 'one exact-zero vacancy');
      if (result.name.startsWith('free-both') || result.name.startsWith('single-product')) {
        assert.equal(row.header[6], 3, 'two exact-zero vacancies'); assert.equal(row.header[7], 3, 'both slots receive products');
      }
      if (result.options.fixtureOptions?.mobileReactants === false) assert.equal(row.sourceHeader[8], 0, 'original no-mobility law selects the availability bound');
    }
    assert.deepEqual(evidence.errors, []);
  } catch (error) {
    failure ??= error;
    evidence.failure = String(failure.stack ?? failure);
    evidence.observedFailure = String(error.stack ?? error);
  }
  finally {
    clearTimeout(watchdog); if (browser) await browser.close(); evidence.browserClosed = true;
    try { await verify(); evidence.sourceUnchanged = true; } catch (error) { failure ??= error; evidence.sourceUnchanged = false; }
    evidence.finished = new Date().toISOString(); evidence.pass = !failure;
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  }
  if (failure) throw failure;
});
