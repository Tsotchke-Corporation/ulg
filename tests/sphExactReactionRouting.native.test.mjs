import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const enabled = process.env.ULG_RUN_NATIVE_EXACT_REACTION_ROUTING === '1';
const baseUrl = process.env.ULG_EXACT_REACTION_ROUTING_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
const evidencePath = process.env.ULG_EXACT_REACTION_ROUTING_EVIDENCE;
const manifestPath = process.env.ULG_EXACT_REACTION_ROUTING_MANIFEST;

test('actual reaction runner stages physical endpoints and stably compacts exact event companions on native WebGPU', {
  skip: !enabled && 'set ULG_RUN_NATIVE_EXACT_REACTION_ROUTING=1 for owned desktop WebGPU', timeout: 600000
}, async () => {
  assert.ok(evidencePath && manifestPath, 'native routing requires evidence and a frozen full source manifest');
  const manifest = (await readFile(manifestPath, 'utf8')).trim().split('\n').map(line => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line); assert.ok(match); return { sha256: match[1], path: match[2] };
  });
  const verify = async () => {
    for (const source of manifest) assert.equal(createHash('sha256').update(await readFile(source.path)).digest('hex'), source.sha256, source.path);
  };
  await verify();
  const evidence = { schema: 'ulg.native-exact-reaction-outputs.v1', started: new Date().toISOString(),
    sources: manifest, headed: true, physicalPublicationAdmitted: false, fullG2Acceptance: false, errors: [], console: [] };
  let browser, watchdog, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    watchdog = setTimeout(() => { failure ??= new Error('Owned exact output browser timeout'); void browser.close(); }, 540000);
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
          await import('/tests/fixtures/sphExactReactionOutputInspection.js');
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
    evidence.result = await page.evaluate(async () => {
      const fixture = await import('/tests/fixtures/sphExactReactionSourceNative.js');
      const selectionModule = fixture, reaction = fixture, routing = fixture;
      const inspection = await import('/tests/fixtures/sphExactReactionRoutingInspection.js');
      const outputInspection = await import('/tests/fixtures/sphExactReactionOutputInspection.js');
      const projection = await import('/tests/fixtures/sphExactRationalProjectionNative.js');
      const compaction = await import('/tests/fixtures/sphExactReactionEventCompactionNative.js');
      const allocation = fixture, kinetics = fixture, massAbi = fixture;
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return { status: 'no-adapter' };
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: Math.min(adapter.limits.maxStorageBuffersPerShaderStage, 16)
      } });
      const result = { status: 'running', adapter: { vendor: adapter.info.vendor, architecture: adapter.info.architecture },
        projections: [], compactions: [], cases: [], errors: [] };
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
        { name: 'product-volume-projection-underflow', expectedPhysicalError: 32, internalPressureScale: 0,
          fixtureOptions: { mobileReactants: false, singleProduct: true, coefficients: [2, 1],
            liquidDensities: { h2o: 1e38 } },
          massesKg: [2 * Math.fround(.002) * 1e-6, Math.fround(.032) * 1e-6] },
        { name: 'nonrelaxed-rejection', velocities, expectedError: 4194304 },
        { name: 'caloric-domain-rejection', fixtureOptions: { reactionInternalEnergyChangeJPerMolExtent: 1e9 }, expectedError: 8388608 }
      ];
      try {
        for (const wordCount of [1, 9, 66]) {
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
        for (const options of cases) {
          const observed = await fixture.runExactReactionSourceNative(device, { ...options, inspect: async args => {
            let selected, candidate, sourceClosing;
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
              return { name: options.name, options, wordCount: selected.format.wordCount,
                rows, output, rawCopiesMatch, sourceUnchanged: before.every((word, i) => word === after[i]),
                parentClosedDuringCompile: true, physicalPublicationAdmitted: candidate.physicalPublicationAdmitted,
                pass: rows.length === 1 && rows.every(row => row.matches) && output.matches && rawCopiesMatch };
            } catch (error) { await error.exactReactionRoutingCleanupCompletion; await error.exactReactionSourceCleanupCompletion; throw error; }
            finally { if (candidate) await candidate.release(); if (selected) await (sourceClosing ?? selected.release()); }
          } });
          result.cases.push(observed);
          console.log('exact-routing-progress', JSON.stringify({ name: options.name, pass: observed.pass,
            routeFailures: observed.rows.flatMap(row => row.failures), outputFailures: observed.output.failures }));
        }
        await device.queue.onSubmittedWorkDone();
        const validation = await device.popErrorScope(); if (validation) result.errors.push(validation.message);
        result.status = 'completed';
      } catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); }
      finally { device.destroy(); }
      return result;
    });
    assert.equal(evidence.result.status, 'completed', evidence.result.failure);
    assert.deepEqual(evidence.result.errors, []); assert.equal(evidence.result.cases.length, 15);
    assert.equal(evidence.result.projections.length, 3);
    for (const projection of evidence.result.projections) {
      assert.equal(projection.pass, true); assert.equal(projection.sourceUnchanged, true); assert.equal(projection.caseCount, 138);
    }
    assert.equal(evidence.result.compactions.length, 3);
    for (const compaction of evidence.result.compactions) {
      assert.equal(compaction.pass, true); assert.equal(compaction.caseCount, 24);
      assert.ok(compaction.cases.every(row => row.sourceUnchanged && row.matches));
    }
    for (const result of evidence.result.cases) {
      assert.equal(result.pass, true, JSON.stringify(result)); assert.equal(result.sourceUnchanged, true);
      assert.equal(result.output.matches, true); assert.equal(result.rawCopiesMatch, true);
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
