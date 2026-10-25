import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const enabled = process.env.ULG_RUN_NATIVE_EXACT_REACTION_ROUTING === '1';
const baseUrl = process.env.ULG_EXACT_REACTION_ROUTING_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
const evidencePath = process.env.ULG_EXACT_REACTION_ROUTING_EVIDENCE;
const manifestPath = process.env.ULG_EXACT_REACTION_ROUTING_MANIFEST;

test('actual reaction runner retains genuine packets and routes exact endpoints and residuals on native WebGPU', {
  skip: !enabled && 'set ULG_RUN_NATIVE_EXACT_REACTION_ROUTING=1 for owned desktop WebGPU', timeout: 300000
}, async () => {
  assert.ok(evidencePath && manifestPath, 'native routing requires evidence and a frozen full source manifest');
  const manifest = (await readFile(manifestPath, 'utf8')).trim().split('\n').map(line => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line); assert.ok(match); return { sha256: match[1], path: match[2] };
  });
  const verify = async () => {
    for (const source of manifest) assert.equal(createHash('sha256').update(await readFile(source.path)).digest('hex'), source.sha256, source.path);
  };
  await verify();
  const evidence = { schema: 'ulg.native-exact-reaction-routing.v1', started: new Date().toISOString(),
    sources: manifest, headed: true, physicalPublicationAdmitted: false, fullG2Acceptance: false, errors: [], console: [] };
  let browser, watchdog, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    watchdog = setTimeout(() => { failure ??= new Error('Owned exact routing browser timeout'); void browser.close(); }, 240000);
    const page = await browser.newPage();
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
          await import('/src/runtime/sph/sphExactReactionRoutingGpu.js');
        });
        break;
      } catch (error) {
        if (attempt > 0 || !/Execution context was destroyed|Failed to fetch/.test(String(error))) throw error;
        await navigate();
      }
    }
    evidence.result = await page.evaluate(async () => {
      const fixture = await import('/tests/fixtures/sphExactReactionSourceNative.js');
      const selectionModule = fixture, reaction = fixture, routing = fixture;
      const inspection = await import('/tests/fixtures/sphExactReactionRoutingInspection.js');
      const allocation = fixture, kinetics = fixture, massAbi = fixture;
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'no-adapter' };
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(adapter.limits.maxStorageBuffersPerShaderStage, 16)
      } });
      const result = { status: 'running', adapter: { vendor: adapter.info.vendor, architecture: adapter.info.architecture }, cases: [], errors: [] };
      device.addEventListener('uncapturederror', event => result.errors.push(event.error.message));
      device.pushErrorScope('validation');
      const read = async buffer => {
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
        { name: 'moving-packet', velocities, internalPressureScale: 0 },
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
        { name: 'nonrelaxed-rejection', velocities, expectedError: 4194304 },
        { name: 'caloric-domain-rejection', fixtureOptions: { reactionInternalEnergyChangeJPerMolExtent: 1e9 }, expectedError: 8388608 }
      ];
      try {
        for (const options of cases) {
          const observed = await fixture.runExactReactionSourceNative(device, { ...options, inspect: async args => {
            let selected, candidate, sourceClosing;
            try {
              selected = await selectionModule.runSphExactReactionSourceSelectionWebGpu(args);
              const issued = selectionModule.resolveSphExactReactionSourceSelection(selected, { device });
              const before = await read(issued.source.sourceRead.read.buffer);
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
              return { name: options.name, options, wordCount: selected.format.wordCount,
                rows, sourceUnchanged: before.every((word, i) => word === after[i]),
                parentClosedDuringCompile: true, physicalPublicationAdmitted: candidate.physicalPublicationAdmitted,
                pass: rows.length === 1 && rows.every(row => row.matches) };
            } catch (error) { await error.exactReactionRoutingCleanupCompletion; await error.exactReactionSourceCleanupCompletion; throw error; }
            finally { if (candidate) await candidate.release(); if (selected) await (sourceClosing ?? selected.release()); }
          } });
          result.cases.push(observed);
          console.log('exact-routing-progress', JSON.stringify({ name: options.name, pass: observed.pass, rows: observed.rows }));
        }
        await device.queue.onSubmittedWorkDone();
        const validation = await device.popErrorScope(); if (validation) result.errors.push(validation.message);
        result.status = 'completed';
      } catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); }
      finally { device.destroy(); }
      return result;
    });
    assert.equal(evidence.result.status, 'completed', evidence.result.failure);
    assert.deepEqual(evidence.result.errors, []); assert.equal(evidence.result.cases.length, 14);
    for (const result of evidence.result.cases) {
      assert.equal(result.pass, true, JSON.stringify(result)); assert.equal(result.sourceUnchanged, true);
      assert.equal(result.physicalPublicationAdmitted, false); assert.equal(result.parentClosedDuringCompile, true);
      const row = result.rows[0];
      if (result.name === 'hidden-survivors') assert.ok(row.hiddenSurvivors > 0, 'exact debit remains hidden in a surviving f32 projection');
      if (result.name.startsWith('free-one')) assert.ok(row.header[6] === 1 || row.header[6] === 2, 'one exact-zero vacancy');
      if (result.name.startsWith('free-both') || result.name.startsWith('single-product')) {
        assert.equal(row.header[6], 3, 'two exact-zero vacancies'); assert.equal(row.header[7], 3, 'both slots receive products');
      }
      if (result.options.fixtureOptions?.mobileReactants === false) assert.equal(row.sourceHeader[8], 0, 'original no-mobility law selects the availability bound');
    }
    assert.deepEqual(evidence.errors, []);
  } catch (error) { failure ??= error; evidence.failure = String(error.stack ?? error); }
  finally {
    clearTimeout(watchdog); if (browser) await browser.close(); evidence.browserClosed = true;
    try { await verify(); evidence.sourceUnchanged = true; } catch (error) { failure ??= error; evidence.sourceUnchanged = false; }
    evidence.finished = new Date().toISOString(); evidence.pass = !failure;
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
  }
  if (failure) throw failure;
});
