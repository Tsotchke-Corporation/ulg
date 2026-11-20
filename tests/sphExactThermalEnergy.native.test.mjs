import assert from 'node:assert/strict';
import test from 'node:test';

// Opt-in: compiles the Phase 1 energy-ledger shaders on the real device.
// ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1, with the HTTPS dev server running.
const RUN_NATIVE = process.env.ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY === '1';
const BASE_URL = process.env.ULG_THERMAL_BASE_URL || 'https://127.0.0.1:5173/';
const CHROME = process.env.ULG_THERMAL_CHROME || '/usr/bin/google-chrome';

test('native Vulkan compiles the ledger-mode thermal, phase and reaction shaders', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1 for native Vulkan WebGPU',
  timeout: 300_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const result = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return { status: 'unsupported' };
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const proposals = await import('/src/runtime/sph/schroederSpatialThermalProposalsGpu.js');
      const thermal = await import('/src/runtime/sph/sphThermalGpuKernel.js');
      const energy = await import('/src/runtime/sph/sphExactThermalEnergyWgsl.js');
      const phaseLedger = await import('/src/runtime/sph/sphExactPhaseLedgerReconcileGpu.js');
      const reactionLedger = await import('/src/runtime/sph/sphExactReactionLedgerReconcileGpu.js');
      // Pipeline creation also validates the binding limits of each entry.
      const compile = async (label, code, entryPoint) => {
        device.pushErrorScope('validation');
        const module = device.createShaderModule({ label, code });
        const info = await module.getCompilationInfo();
        let pipelineError = null;
        try {
          await device.createComputePipelineAsync({ label, layout: 'auto', compute: { module, entryPoint } });
        } catch (error) { pipelineError = String(error?.message ?? error).slice(0, 300); }
        const scope = await device.popErrorScope();
        return { label, errors: info.messages.filter(m => m.type === 'error')
          .map(m => `${m.lineNum}:${m.linePos} ${m.message}`).slice(0, 5),
          pipelineError, scope: scope?.message ?? null };
      };
      const out = [];
      for (const [label, code, entryPoint] of [
        ['proposal-v1-ledger', proposals.createSchroederSpatialThermalProposalLedgerWgsl(
          proposals.schroederSpatialThermalProposalWgsl), 'propose'],
        ['proposal-v2-ledger', proposals.createSchroederSpatialThermalProposalLedgerWgsl(
          proposals.schroederSpatialThermalProposalV2Wgsl), 'propose'],
        ['proposal-v2-ledger-budget', proposals.createSchroederSpatialThermalProposalLedgerWgsl(
          proposals.schroederSpatialThermalProposalV2Wgsl), 'budget'],
        ['thermal-default', thermal.sphThermalStepWgsl, 'main'],
        ['thermal-energy', energy.appendSphExactThermalEnergyWgsl(thermal.sphThermalStepWgsl), 'main'],
        ['phase-ledger-reconcile', phaseLedger.sphExactPhaseLedgerReconcileWgsl, 'reconcile_phase_ledger'],
        ['phase-ledger-control', phaseLedger.sphExactPhaseLedgerReconcileWgsl, 'carry_ledger_control'],
        ...['carry_ledger_control', 'reconcile_reaction_pairs', 'reconcile_reaction_events', 'reconcile_reaction_receivers']
          .map(entry => [`reaction-ledger-${entry}`, reactionLedger.sphExactReactionLedgerReconcileWgsl, entry]),
        ['reaction-ledger-projection', reactionLedger.sphExactReactionLedgerProjectionWgsl, 'project_reaction_ledger'],
        ['reaction-ledger-prepare', reactionLedger.sphExactReactionLedgerPrepareWgsl, 'prepare_reaction_ledger']
      ]) out.push(await compile(label, code, entryPoint));
      device.destroy();
      return { status: 'ran', out };
    });
    assert.notEqual(result.status, 'unsupported', 'WebGPU adapter unavailable');
    for (const shader of result.out) {
      assert.deepEqual(shader.errors, [], `${shader.label} compile errors`);
      assert.equal(shader.pipelineError, null, `${shader.label} pipeline error`);
      assert.equal(shader.scope, null, `${shader.label} validation error`);
    }
  } finally { await browser.close(); }
});

// Phase 1 gate: on the integer-only spatial route the carrier energy ledger
// closes bit-exactly. Eight Fe carriers in one solid body exchange heat by
// conduction (no contact heat between same-body rows) inside the 350 K xMin
// wall layer, so every step has both pair packets and recorded sources. The
// reference Fe closure has no conductivity, so the run declares one.
test('native Vulkan integer energy ledger closes sum(U - S) bit-exactly through conduction and wall heat', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const { createSphExactMassFormat } = await import('../ulg-gpu-abi/src/sphExactMassInventory.js');
  const { decodeSphExactSignedUnits, projectSphExactSignedF32Bits } =
    await import('../ulg-gpu-abi/src/sphExactSignedLedger.js');
  const format = createSphExactMassFormat();
  const W = format.wordCount;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let runs;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    runs = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const abi = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');
      const fixture = await import('/tests/fixtures/sphExactMassContinuationNative.js');
      const format = abi.createSphExactMassFormat();
      const particles = [];
      for (let i = 0; i < 8; i++) {
        const [x, y, z] = [i & 1, (i >> 1) & 1, (i >> 2) & 1];
        particles.push({ id: `ledger-${i}`, massKg: 0.001, x: [0.3 + 0.005 * x, 1 + 0.005 * y, 1 + 0.005 * z],
          temperatureK: (x + y + z) % 2 ? 600 : 300 });
      }
      const pick = run => ({ initialEnergy: run.initialEnergy, masses: run.masses,
        cycles: run.runs.map(cycle => ({ energy: cycle.energy, state: cycle.state })) });
      // G4: the same cluster plus a far Fe cluster whose temperatures span
      // 0.35 K, run ungated and at epsilon 0.5 K. It sits 0.8 m from every
      // wall: unspecified faces are 0 K reservoirs within the 0.5 m layer,
      // and wall heat is not gated.
      const far = Array.from({ length: 8 }, (_, i) => {
        const [x, y, z] = [i & 1, (i >> 1) & 1, (i >> 2) & 1];
        return { id: `ledger-far-${i}`, massKg: 0.001, x: [1.2 + 0.005 * x, 1 + 0.005 * y, 1 + 0.005 * z],
          temperatureK: 300 + 0.05 * i };
      });
      const dormancyRun = epsilonK => fixture.runExactMassContinuationNative(device, format, true, false, false, null, {
        // h 0.02 m: the 0.04 m conduction support keeps the clusters apart.
        particles: [...particles, ...far], cycles: 6, thermalConductivityWPerMK: { solid: 80, liquid: 40 },
        smoothingLengthM: 0.02,
        thermalStepOptions: epsilonK == null ? {} : { thermalDormancy: { epsilonK } } });
      try {
        return {
          cluster: pick(await fixture.runExactMassContinuationNative(device, format, true, false, false, null, {
            particles, cycles: 6, thermalConductivityWPerMK: { solid: 80, liquid: 40 } })),
          single: pick(await fixture.runExactMassContinuationNative(device, format, true)),
          farUngated: pick(await dormancyRun(null)),
          farGated: pick(await dormancyRun(0.5))
        };
      } finally { device.destroy(); }
    });
  } finally { await browser.close(); }

  const record = (words, rows) => {
    const row = (base, i) => decodeSphExactSignedUnits(Uint32Array.from(words.slice(base + i * W, base + (i + 1) * W)), format);
    return { U: Array.from({ length: rows }, (_, i) => row(0, i)), S: Array.from({ length: rows }, (_, i) => row(rows * W, i)),
      control: words.slice(2 * rows * W) };
  };
  const sum = values => values.reduce((a, b) => a + b, 0n);
  for (const [name, run] of Object.entries(runs)) {
    const rows = run.masses.length;
    assert.ok(run.initialEnergy, `${name}: the cold record exists`);
    const cold = record(run.initialEnergy, rows);
    const budget = sum(cold.U) - sum(cold.S);
    let pairExchange = false;
    for (const [index, cycle] of run.cycles.entries()) {
      assert.ok(cycle.energy, `${name} cycle ${index + 1}: the ledger continued`);
      const now = record(cycle.energy, rows);
      // Control: no errors, no status bits, every ledger particle-step had
      // its pair exchange; word 3 counts the ledger particle-steps so far.
      // Status bit 2 (mechanics heat) may be set: the f32 view is kept within
      // rounding of the exact projection and the next step books that ulp.
      assert.equal(now.control[0], 0, `${name} cycle ${index + 1}: no ledger errors`);
      assert.equal(now.control[1] & ~2, 0, `${name} cycle ${index + 1}: only the mechanics-heat status`);
      assert.equal(now.control[2], 0, `${name} cycle ${index + 1}: every step had its pair exchange`);
      assert.equal(now.control[3], rows * (index + 1), `${name} cycle ${index + 1}: ledger particle-steps`);
      assert.equal(sum(now.U) - sum(now.S), budget, `${name} cycle ${index + 1}: sum(U - S) is exact`);
      pairExchange ||= now.U.some((u, i) => u - now.S[i] !== cold.U[i]);
      // Every pair packet is applied to both rows with opposite sign.
      assert.equal(sum(now.U.map((u, i) => u - now.S[i] - cold.U[i])), 0n, `${name} cycle ${index + 1}: pair packets cancel`);
      for (let i = 0; i < rows; i++) {
        const projected = new Float32Array(new Uint32Array([projectSphExactSignedF32Bits(
          Uint32Array.from(cycle.energy.slice(i * W, (i + 1) * W)), format).bits]).buffer)[0];
        const mass = cycle.state[i * 8 + 3], u = cycle.state[i * 8 + 7];
        // u is the ledger's view; WGSL f32 division is within 2.5 ulp.
        assert.ok(Math.abs(u - projected / mass) <= 4 * Math.abs(u) * 2 ** -23,
          `${name} cycle ${index + 1} row ${i}: u ${u} projects ${projected / mass}`);
      }
    }
    const last = record(run.cycles.at(-1).energy, rows);
    assert.notEqual(sum(last.S), 0n, `${name}: wall heat was recorded as a source`);
    if (name === 'cluster') assert.ok(pairExchange, 'cluster: conduction moved energy between rows');
  }
  // G4 on the ledger route: the far cluster (rows 8..15, span 0.35 K) moves
  // energy among itself when ungated and is exactly frozen when gated at
  // epsilon 0.5 K; the near cluster still exchanges; sum(U - S) stays exact
  // in both (asserted above).
  const farRows = run => {
    const rows = run.masses.length;
    return run.cycles.map(cycle => record(cycle.energy, rows).U.slice(8, 16));
  };
  const coldFar = run => record(run.initialEnergy, run.masses.length).U.slice(8, 16);
  const gatedFar = farRows(runs.farGated), ungatedFar = farRows(runs.farUngated);
  const farDelta = (rows, run) => rows.map(cycle => cycle.map((u, i) => String(u - coldFar(run)[i])));
  const farS = run => run.cycles.map(cycle => record(cycle.energy, run.masses.length).S.slice(8, 16).map(String));
  assert.ok(gatedFar.every(cycle => cycle.every((u, i) => u === coldFar(runs.farGated)[i])),
    `gated: the dormant far cluster moved no energy: ${JSON.stringify({ gated: farDelta(gatedFar, runs.farGated).slice(0, 2),
      ungated: farDelta(ungatedFar, runs.farUngated).slice(0, 2), gatedS: farS(runs.farGated).slice(0, 2),
      temps: runs.farGated.cycles[0].thermo?.slice?.(0, 0) })}`);
  assert.ok(ungatedFar.some(cycle => cycle.some((u, i) => u !== coldFar(runs.farUngated)[i])),
    'ungated: the far cluster exchanged energy');
  const nearMoved = run => run.cycles.some(cycle => record(cycle.energy, run.masses.length).U.slice(0, 8)
    .some((u, i) => u !== record(run.initialEnergy, run.masses.length).U[i]));
  assert.ok(nearMoved(runs.farGated), 'gated: the active near cluster still exchanged');
});

// Phase 2 gate: H2O lineages melt and boil on the integer ledger. Every step
// keeps total exact mass and sum(U - S) bit-exact through the f32 phase split
// and its reconcile, and each row's f32 mass and u are the integer rows' view.
test('native Vulkan phase ledger keeps mass and energy bit-exact through melting and boiling', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1 for native Vulkan WebGPU',
  timeout: 900_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const { createSphExactMassFormat, projectSphExactMassF32Bits } = await import('../ulg-gpu-abi/src/sphExactMassInventory.js');
  const { decodeSphExactSignedUnits, projectSphExactSignedF32Bits } = await import('../ulg-gpu-abi/src/sphExactSignedLedger.js');
  const format = createSphExactMassFormat();
  const W = format.wordCount;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let run;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    page.on('console', message => { if (message.type() === 'error') console.log('page:', message.text().slice(0, 300)); });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    run = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const fixture = await import('/tests/fixtures/sphExactPhaseLedgerNative.js');
      try { return await fixture.runExactPhaseLedgerNative(device, { cycles: 8 }); }
      catch (error) { return { error: String(error?.stack || error).slice(0, 1500) }; }
      finally { device.destroy(); }
    });
  } finally { await browser.close(); }
  assert.equal(run.error, undefined, run.error);
  const { rows, lineages } = run;
  const unsigned = (words, row) => Array.from(words.slice(row * W, (row + 1) * W))
    .reduceRight((value, word) => (value << 32n) | BigInt(word >>> 0), 0n);
  const signed = (words, base, row) => decodeSphExactSignedUnits(Uint32Array.from(words.slice(base + row * W, base + (row + 1) * W)), format);
  const f32 = bits => new Float32Array(new Uint32Array([bits]).buffer)[0];
  const sum = values => values.reduce((a, b) => a + b, 0n);
  const totals = snap => ({
    mass: sum(Array.from({ length: rows }, (_, row) => unsigned(snap.mass, row))),
    budget: sum(Array.from({ length: rows }, (_, row) => signed(snap.energy, 0, row) - signed(snap.energy, rows * W, row)))
  });
  const cold = totals(run.initial);
  let melted = false, boiled = false;
  for (const [index, cycle] of run.cycles.entries()) {
    const label = `cycle ${index + 1}`;
    assert.equal(cycle.phaseTransferRan, true, `${label}: the phase transfer ran`);
    assert.ok(cycle.energy, `${label}: the energy ledger continued through the phase transfer`);
    if (process.env.ULG_EXACT_PHASE_LEDGER_DEBUG) console.log(label, JSON.stringify(cycle.proposalDiagnostics));
    const control = cycle.energy.slice(2 * rows * W);
    // No errors and no skipped pair exchange. Status bit 2 (mechanics heat)
    // may be set: a lane whose projection is a rounding ulp from the
    // transfer's u keeps that in-domain u, and the next step books the
    // ulp as a recorded source.
    assert.equal(control[0], 0, `${label}: no ledger errors`);
    assert.equal(control[1] & ~2, 0, `${label}: only the mechanics-heat status`);
    assert.equal(control[2], 0, `${label}: every step had its pair exchange`);
    // Word 3 counts ledger particle-steps of carriers with mass.
    assert.ok(control[3] > (index === 0 ? 0 : run.cycles[index - 1].energy[2 * rows * W + 3])
      && control[3] <= rows * (index + 1), `${label}: ledger particle-steps grow`);
    const now = totals(cycle);
    assert.equal(now.mass, cold.mass, `${label}: total exact mass`);
    assert.equal(now.budget, cold.budget, `${label}: sum(U - S)`);
    for (let row = 0; row < rows; row++) {
      const massBits = projectSphExactMassF32Bits(Uint32Array.from(cycle.mass.slice(row * W, (row + 1) * W)), format).bits;
      assert.equal(cycle.state[row * 8 + 3] >>> 0, massBits, `${label} row ${row}: f32 mass is the exact row's view`);
      const mass = f32(massBits), u = f32(cycle.state[row * 8 + 7]);
      if (mass === 0) {
        // An empty lane holds no energy; it keeps the transfer's in-domain u.
        assert.equal(signed(cycle.energy, 0, row), 0n, `${label} row ${row}: empty lane energy`);
        continue;
      }
      const energy = f32(projectSphExactSignedF32Bits(Uint32Array.from(cycle.energy.slice(row * W, (row + 1) * W)), format).bits);
      const expected = energy / mass;
      assert.ok(Math.abs(u - expected) <= 4 * Math.abs(expected) * 2 ** -23, `${label} row ${row}: u ${u} vs ${expected}`);
    }
    for (let l = 0; l < lineages; l++) {
      melted ||= (l === 0 || l === 2) && unsigned(cycle.mass, lineages + l) > 0n;
      boiled ||= unsigned(cycle.mass, 2 * lineages + l) > 0n;
    }
  }
  assert.ok(melted, 'an ice lineage gained liquid mass');
  assert.ok(boiled, 'a water lineage gained gas mass');
});

// Phase 2 slice 2c: two Fe bodies collide, so contact heat reaches u through
// mechanics between ledger steps. The thermal ledger books it as a recorded
// mechanics-heat source; sum(U - S) stays exact and no error flag is raised.
test('native Vulkan energy ledger books contact heat as a recorded mechanics source', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_EXACT_THERMAL_ENERGY=1 for native Vulkan WebGPU',
  timeout: 600_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const { createSphExactMassFormat } = await import('../ulg-gpu-abi/src/sphExactMassInventory.js');
  const { decodeSphExactSignedUnits } = await import('../ulg-gpu-abi/src/sphExactSignedLedger.js');
  const { SPH_EXACT_THERMAL_ENERGY_STATUS_MECHANICS_HEAT } = await import('../src/runtime/sph/sphExactThermalEnergyWgsl.js');
  const format = createSphExactMassFormat();
  const W = format.wordCount;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let run;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    run = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const limits = await import('/src/runtime/webgpuDeviceLimits.js');
      const device = await adapter.requestDevice(limits.webGpuDeviceDescriptorForResidentSph(adapter));
      const abi = await import('/ulg-gpu-abi/src/sphExactMassInventory.js');
      const fixture = await import('/tests/fixtures/sphExactMassContinuationNative.js');
      const particles = [
        { id: 'body-a', massKg: 0.001, initialBodyDomainId: 1, initialBodyId: 'body-a', x: [0.995, 1, 1], v: [2, 0, 0], temperatureK: 300 },
        { id: 'body-b', massKg: 0.001, initialBodyDomainId: 2, initialBodyId: 'body-b', x: [1.005, 1, 1], v: [-2, 0, 0], temperatureK: 300 }];
      try {
        const r = await fixture.runExactMassContinuationNative(device, abi.createSphExactMassFormat(), true, false, false, null,
          { particles, cycles: 6, thermalConductivityWPerMK: { solid: 80, liquid: 40 } });
        return { initialEnergy: r.initialEnergy, cycles: r.runs.map(cycle => ({ energy: cycle.energy, state: cycle.state })) };
      } catch (error) { return { error: String(error?.stack || error).slice(0, 1200) }; }
      finally { device.destroy(); }
    });
  } finally { await browser.close(); }
  assert.equal(run.error, undefined, run.error);
  const rows = 2;
  const row = (words, base, i) => decodeSphExactSignedUnits(Uint32Array.from(words.slice(base + i * W, base + (i + 1) * W)), format);
  const budget = words => [0, 1].reduce((sum, i) => sum + row(words, 0, i) - row(words, rows * W, i), 0n);
  const cold = budget(run.initialEnergy);
  let mechanicsHeat = false;
  for (const [index, cycle] of run.cycles.entries()) {
    assert.ok(cycle.energy, `cycle ${index + 1}: the ledger continued`);
    const control = cycle.energy.slice(2 * rows * W);
    assert.equal(control[0], 0, `cycle ${index + 1}: no ledger error`);
    mechanicsHeat ||= (control[1] & SPH_EXACT_THERMAL_ENERGY_STATUS_MECHANICS_HEAT) !== 0;
    assert.equal(budget(cycle.energy), cold, `cycle ${index + 1}: sum(U - S) is exact`);
  }
  assert.ok(mechanicsHeat, 'the collision heat was booked as a mechanics source');
});
