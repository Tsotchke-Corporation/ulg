import assert from 'node:assert/strict';
import { test } from 'node:test';

test('native SS-bound condensate debit, real phase transfer and combined inventory', {
  skip: process.env.ULG_RUN_NATIVE_CONDENSATE_EXTRACTION === '1' ? false : 'set ULG_RUN_NATIVE_CONDENSATE_EXTRACTION=1 for desktop WebGPU',
  timeout: 180_000
}, async (t) => {
  const { chromium } = await import('@playwright/test');
  const base = process.env.ULG_AEROSOL_BASE_URL || 'https://fastbox.tail5c077c.ts.net:5173/';
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
    args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  let result;
  try {
    const page = await browser.newPage();
    await page.route(new URL(base).href, (route) => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><title>ULG conserved condensate transfer native verification</title>' }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    result = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('Native WebGPU adapter missing');
      const device = await adapter.requestDevice(), errors = [];
      device.addEventListener('uncapturederror', (event) => errors.push(event.error.message));
      device.pushErrorScope('validation'); device.pushErrorScope('internal'); device.pushErrorScope('out-of-memory');
      // Resolve Vite's exact transformed imports, preserving private WeakMap
      // identity even when the dev server has previously applied HMR updates.
      const dependency = async (url, file) => {
        const code = await (await fetch(url)).text();
        const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
        const path = imports.find((path) => path.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error(`Missing exact dependency ${file} in ${url}`);
        return path;
      };
      const summaryUrl = '/src/runtime/sph/sphMlsMpmGpuSummary.js';
      const ownerUrl = await dependency(summaryUrl, 'sphAerosolParcelGpu.js');
      const transactionUrl = await dependency(ownerUrl, 'schroederSpatialEpochTransaction.js');
      const owner = await import(ownerUrl), phase = await import(await dependency(ownerUrl, 'sphPhaseCarrierTransferGpu.js'));
      const identity = await import(await dependency(ownerUrl, 'sphGpuDeviceIdentity.js'));
      const transactions = await import(transactionUrl);
      const spatial = await import(await dependency(transactionUrl, 'schroederSpatialEpochGpu.js'));
      const { runMlsMpmResidentSummaryWebGpu: summarize } = await import(summaryUrl);
      const abi = await import('/ulg-gpu-abi/src/index.js');
      const resources = [], families = [], pairs = [], phaseOutputs = [];
      const upload = (label, values) => {
        const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({ label,
          size: Math.max(16, values.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }), device);
        device.queue.writeBuffer(buffer, 0, values); resources.push(buffer); return buffer;
      };
      const read = async (buffer, bytes) => {
        const target = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        try { const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, target, 0, bytes);
          device.queue.submit([encoder.finish()]); await target.mapAsync(GPUMapMode.READ);
          const copy = new Uint32Array(target.getMappedRange()).slice(); target.unmap(); return [...copy];
        } finally { target.destroy(); }
      };
      const count = 8, lineageCapacity = 2, donor = 4;
      const epoch = { storageGeneration: 3, physicsTick: 11, physicsSubstep: 2, positionEpoch: 13,
        topologyEpoch: 5, chartEpoch: 1, levelEpoch: 4, supportEpoch: 6 };
      const phaseCarrierPlan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
        lineageCapacity, primaryCapacity: lineageCapacity, phaseLaneCount: 4, phaseLaneStride: lineageCapacity,
        companionStart: lineageCapacity, companionCapacity: 6, particleCapacity: count };
      const initial = () => {
        const state = new Float32Array(count * 8), thermo = new Float32Array(count * 12), mechanics = new Float32Array(count * 32);
        const body = (index, mass, position, velocity, phaseId, energy, density, eos) => {
          state.set([...position, mass, ...velocity, energy], index * 8);
          thermo.set([9, phaseId, 400, density, 0, phaseId === 2 ? 1 : 0, phaseId === 3 ? 1 : 0, 0, 0.2, mass * 10, 1, 0.1], index * 12);
          mechanics[index * 32] = 1; mechanics[index * 32 + 4] = 1; mechanics[index * 32 + 8] = 1;
          mechanics.set([1, mass / density, 0, 1, 1, 0, 0, 1, eos, 1, 100, 0, 0, mass], index * 32 + 18);
        };
        body(2, 2, [0.5, 0.5, 0.5], [0, 0, 0], 2, 10, 1000, 1);
        body(4, 4, [2, 2, 2], [2, -1, 0], 3, 30, 1, 2);
        body(5, 4, [3, 2, 2], [-1, 0, 0], 3, 30, 1, 2);
        return { state, thermo, mechanics };
      };
      const prior = initial();
      const priorState = upload('condensate-prior-state', prior.state), priorThermo = upload('condensate-prior-thermo', prior.thermo);
      const priorMechanics = upload('condensate-prior-mechanics', prior.mechanics);
      const identityBuffer = upload('condensate-prior-identities', Uint32Array.from({ length: count }, (_, index) => index + 1));
      const assignment = new Float32Array(count * 16);
      for (let i = 0; i < count; i++) {
        const mass = prior.state[i * 8 + 3], density = prior.thermo[i * 12 + 3] || 1, volume = mass / density;
        assignment.set([0, 1, 1, volume, volume, volume, mass, density, prior.thermo[i * 12 + 1], 9,
          mass > 0 ? 1 : 0, 0, ...prior.state.slice(i * 8, i * 8 + 3), 0], i * 16);
      }
      const sphParticleUpload = { schema: 'peercompute.ulg.sph-gpu-particle-buffer-set.v0', status: 'webgpu-uploaded',
        particleCount: count, stateBuffer: priorState, thermoBuffer: priorThermo, identityBuffer,
        stateBufferByteLength: priorState.size, thermoBufferByteLength: priorThermo.size,
        identityBufferByteLength: identityBuffer.size, stateStrideBytes: 32, thermoStrideBytes: 48, identityStrideBytes: 4,
        identityRevision: 'manufactured-condensate-lineages-v0', phaseCarrierPlan, ...epoch };
      const mlsMpmParticleUpload = { schema: 'peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0', status: 'webgpu-uploaded',
        particleCount: count, mechanicsBuffer: priorMechanics, mechanicsBufferByteLength: priorMechanics.size, mechanicsStrideBytes: 128, ...epoch };
      const grid = { selectedLevel: 0, gridDims: [9, 9, 9], gridNodeCount: 729, gridShift: 2, gridSpacingM: 1 };
      const assignmentBuffer = upload('condensate-prior-assignment', assignment);
      const levelAssignment = { schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
        status: 'schroeder-level-assignment-submitted', bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
        particleCount: count, assignmentStrideFloats: 16, assignmentBuffer, assignmentBufferByteLength: assignmentBuffer.size,
        sourceStateBuffer: priorState, sourceStateBufferBorrowed: true, sourceStateBufferByteLength: priorState.size,
        sourceThermoBuffer: priorThermo, sourceThermoBufferBorrowed: true, sourceThermoBufferByteLength: priorThermo.size,
        sourceIdentityBuffer: identityBuffer, sourceIdentityBufferBorrowed: true, sourceIdentityBufferByteLength: identityBuffer.size,
        sourceMechanicsBuffer: priorMechanics, sourceMechanicsBufferBorrowed: true, sourceMechanicsBufferByteLength: priorMechanics.size,
        ...epoch, minLevel: 0, maxLevel: 0, chartId: 0, baseGridSpacingM: 1 };
      let generation = null;
      const gridBuffer = upload('condensate-budget-grid', new Float32Array(8));
      const cases = [
        { name: 'unclamped cooling preserves prior-c witness and publishes current-c', gasLaw: true, pressure: 50 },
        { name: 'already refreshed mixed donor publishes current-c', gasLaw: true, pressure: 50, refreshed: true },
        { name: 'liquid-dominant donor keeps gas law until extraction', gasLaw: true, pressure: 50, liquidFraction: .75 },
        { name: 'unrelated temperature sound speed rejects atomically', gasLaw: true, pressure: 50, bad: 'sound', reject: true },
        { name: 'baseline' }, { name: 'signed internal energy', offset: -100 },
        { name: 'double physical population', multiplicity: 2n ** 41n + 14n },
        { name: 'sparse spare capacity', capacity: 23 }, { name: 'nonunit preserved deformation', J: 8 },
        { name: 'lower pressure plateau', pressure: 50 }, { name: 'higher pressure plateau', pressure: 200 },
        { name: 'liquid-dominant mixed donor', liquidFraction: 0.75 },
        { name: 'two donors in one atomic batch', two: true },
        { name: 'missing pressure authority', reject: true, pressureAuthority: false },
        { name: 'nonpositive pressure', reject: true, bad: 'pressure' },
        { name: 'energy inconsistent with phase fractions', reject: true, bad: 'energy' },
        { name: 'negative fraction', reject: true, bad: 'fraction' },
        { name: 'nonfinite position', reject: true, bad: 'position' },
        { name: 'no resolved residual mass', reject: true, bad: 'residual' },
        { name: 'nonzero affine energy unowned', reject: true, bad: 'affine' },
        { name: 'nonzero surface energy unowned', reject: true, bad: 'surface' },
        { name: 'solid donor rejected', reject: true, bad: 'solid' },
        { name: 'inconsistent reference volume', reject: true, bad: 'volume' },
        { name: 'missing plateau law', reject: true, bad: 'law' },
        { name: 'ambiguous plateau', reject: true, bad: 'plateau' },
        { name: 'prior gas was not pure', reject: true, bad: 'prior-mixed' },
        { name: 'prior source material differs', reject: true, bad: 'prior-material' },
        { name: 'one bad donor rejects entire batch', reject: true, two: true, bad: 'second-energy' }
      ];
      const results = [];
      try {
        for (const spec of cases) {
          // Each manufactured experiment has a fresh actual SS source owner.
          // An adopted source cannot be reused to debit the same mass again.
          let caseUpload = sphParticleUpload, caseAssignment = levelAssignment;
          let caseMlsUpload = mlsMpmParticleUpload;
          if (spec.gasLaw) {
            const m = prior.mechanics.slice();
            for (const i of [4, 5]) m[i * 32 + 25] = 200; // sqrt(100 * prior T=400)
            const buffer = upload('condensate-case-prior-gas-mechanics', m);
            caseMlsUpload = { ...mlsMpmParticleUpload, mechanicsBuffer: buffer };
            caseAssignment = { ...levelAssignment, sourceMechanicsBuffer: buffer };
          }
          if (spec.bad?.startsWith('prior-')) {
            const t = prior.thermo.slice(), assignments = assignment.slice();
            if (spec.bad === 'prior-mixed') t.set([0, 0.25, 0.75, 0], donor * 12 + 4);
            if (spec.bad === 'prior-material') { t[donor * 12] = 10; assignments[donor * 16 + 9] = 10; }
            const priorBuffer = upload('condensate-case-prior-thermo', t);
            caseUpload = { ...sphParticleUpload, thermoBuffer: priorBuffer, thermoBufferByteLength: priorBuffer.size };
            const caseAssignmentBuffer = upload('condensate-case-prior-assignment', assignments);
            caseAssignment = { ...levelAssignment, sourceThermoBuffer: priorBuffer,
              sourceThermoBufferByteLength: priorBuffer.size, assignmentBuffer: caseAssignmentBuffer };
          }
          generation = spatial.runSchroederSpatialEpochGenerationWebGpu({ device, levelAssignment: caseAssignment, particleCount: count,
            particleIdentityBuffer: identityBuffer, particleIdentityStrideWords: 1, selectedLevel: 0,
            mechanicsGrid: grid, exactNearCellTreeEnabled: false });
          if (!generation.ready) throw new Error(`Actual SS generation failed: ${generation.reason || generation.status}`);
          const transaction = transactions.createSchroederSpatialEpochTransaction({ device, generation, sphParticleUpload: caseUpload, mlsMpmParticleUpload: caseMlsUpload });
          const sourceLineage = { transaction, generation, sphParticleUpload: caseUpload, mlsMpmParticleUpload: caseMlsUpload };
          const data = initial(), shift = spec.offset || 0, pressure = spec.pressure || 100;
          const liquidFraction = spec.liquidFraction || 0.25;
          const temperature = 1 / (1 / 400 - 0.001 * Math.log(pressure / 100));
          const liquidU = -10 + shift + 0.2 * (temperature - 300), gasU = liquidU + 20;
          for (const index of [4, 5]) {
            data.state[index * 8 + 7] = liquidFraction * liquidU + (1 - liquidFraction) * gasU;
            data.thermo.set([9, liquidFraction > 0.5 ? 2 : 3, temperature, 1, 0, liquidFraction, 1 - liquidFraction, 0], index * 12);
            data.mechanics[index * 32 + 28] = pressure;
            if (spec.gasLaw) data.mechanics[index * 32 + 25] = spec.refreshed ? Math.sqrt(100 * temperature) : 200;
            if (spec.J) { const scale = Math.cbrt(spec.J); data.mechanics[index * 32] = scale;
              data.mechanics[index * 32 + 4] = scale; data.mechanics[index * 32 + 8] = scale; data.mechanics[index * 32 + 18] = spec.J; }
          }
          data.state[2 * 8 + 7] += shift;
          const thermalMaterialTable = { records: new Float32Array([9, 0, 2, 1, 0, 1, 100, 0.001]),
            segments: new Float32Array([9, 1, 2, 2, -10 + shift, 10 + shift, 300, 400, 1000, 1000, 1, 0,
              9, 2, 2, 3, 10 + shift, 30 + shift, 400, 400, 1000, 1, 1, 0]) };
          const mechanicsMaterialTable = { schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
            phaseRecordCount: 2,
            records: new Float32Array([9, 2, 1000, 1, 0, 0, 1, 1, 0, 1, 0, 0, 9, 3, 1, 1, 0, 0, 1, 2, 0, 1, 0, 0]) };
          if (spec.gasLaw) {
            mechanicsMaterialTable.gasConstitutiveSchema = 'ulg.gas-constitutive.constant-cp.v1';
            mechanicsMaterialTable.gasConstitutiveOffsetVec4 = 6;
            mechanicsMaterialTable.records[18] = 300; // representative c at T=900; never the current-c oracle
            mechanicsMaterialTable.records = new Float32Array([...mechanicsMaterialTable.records, 0, 0, 0, 0, 100, 1, 0, 0]);
          }
          const sb = donor * 8, tb = donor * 12, mb = donor * 32;
          if (spec.bad === 'sound') data.mechanics[mb + 25] = 150;
          if (spec.bad === 'pressure') data.mechanics[mb + 28] = 0;
          if (spec.bad === 'energy') data.state[sb + 7] += 100;
          if (spec.bad === 'second-energy') data.state[5 * 8 + 7] += 100;
          if (spec.bad === 'fraction') data.thermo[tb + 5] = -0.25;
          if (spec.bad === 'position') data.state[sb] = NaN;
          if (spec.bad === 'residual') { data.thermo[tb + 5] = 1; data.thermo[tb + 6] = 0; }
          if (spec.bad === 'affine') data.mechanics[mb + 9] = 0.1;
          if (spec.bad === 'surface') data.mechanics[mb + 30] = 0.07;
          if (spec.bad === 'solid') data.mechanics[mb + 20] = 1;
          if (spec.bad === 'volume') data.mechanics[mb + 19] *= 2;
          if (spec.bad === 'law') thermalMaterialTable.records[5] = 0;
          if (spec.bad === 'plateau') { thermalMaterialTable.segments = new Float32Array([...thermalMaterialTable.segments, ...thermalMaterialTable.segments.slice(12)]); thermalMaterialTable.records[2] = 3; }
          const stateBuffer = upload('condensate-case-state', data.state), thermoBuffer = upload('condensate-case-thermo', data.thermo);
          const mechanicsBuffer = upload('condensate-case-mechanics', data.mechanics);
          const sourceFamily = owner.createSphAerosolParcelFamilyWebGpu({ device, capacity: 2,
            provenance: { kind: 'initial-conditions', reference: 'explicit empty initial reservoir' } }); families.push(sourceFamily);
          const declarations = [{ lineageIndex: 0, parcelId: 100n, nucleusPopulationId: 200n, physicalMultiplicity: spec.multiplicity || 2n ** 40n + 7n }];
          if (spec.two) declarations.push({ lineageIndex: 1, parcelId: 101n, nucleusPopulationId: 201n, physicalMultiplicity: 1000n });
          const input = { device, sourceFamily, expectedGeneration: 0, sourceLineage,
            sourceStateBuffer: stateBuffer, sourceThermoBuffer: thermoBuffer, sourceMechanicsBuffer: mechanicsBuffer,
            thermalMaterialTable, mechanicsMaterialTable, declarations, targetCapacity: spec.capacity,
            provenance: { kind: 'already-activated-condensate-population', reference: 'manufactured physical nuclei; not a kinetic law' },
            absolutePressureAuthority: spec.pressureAuthority !== false };
          const row = { name: spec.name, expectedReject: spec.reject === true, expectedLiquidU: liquidU, expectedGasU: gasU,
            expectedSoundSpeed: spec.gasLaw ? Math.sqrt(100 * temperature) : null,
            expectedAerosolMass: 4 * liquidFraction * (spec.two ? 2 : 1), expectedResidualMass: 4 * (1 - liquidFraction) };
          try {
            const candidate = await owner.runSphAerosolCondensateExtractionWebGpu(input);
            const pair = owner.adoptSphAerosolCondensateExtraction(candidate); pairs.push(pair);
            const packed = { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count, phaseCarrierPlan, state: data.state, thermo: data.thermo };
            const packedM = { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count, mechanics: data.mechanics };
            const transferred = await phase.runSphPhaseCarrierTransferWebGpu({ device, sphParticleState: packed, mlsMpmParticleState: packedM,
              thermalMaterialTable, mechanicsMaterialTable, phaseCarrierPlan, sourceStateBuffer: pair.stateBuffer,
              sourceThermoBuffer: pair.thermoBuffer, sourceMechanicsBuffer: pair.mechanicsBuffer,
              absolutePressureAuthority: true, retainOutputParticleBuffers: true, readbackMode: 'full-parity-readback' });
            phaseOutputs.push(transferred);
            const budget = await summarize({ device, sphParticleState: packed, mlsMpmParticleState: packedM,
              sphParticleUpload: { ...sphParticleUpload, stateBuffer, thermoBuffer },
              mlsMpmParticleUpload: { ...mlsMpmParticleUpload, mechanicsBuffer },
              gridUpdate: { gridNodeCount: 1, gpuResult: { updatedGridBuffer: gridBuffer } },
              g2pReconstruction: { stateBuffer: pair.stateBuffer, mechanicsBuffer: pair.mechanicsBuffer },
              phaseCarrierTransferStep: transferred, sourceAerosolFamily: sourceFamily, terminalAerosolFamily: pair.aerosolFamily,
              compactSummaryReadbackClassification: 'final-diagnostic' });
            row.budget = budget.combinedInventory; row.transferredState = [...transferred.state];
            row.residualMechanics = await read(pair.mechanicsBuffer, data.mechanics.byteLength);
            row.transferredMechanics = Array.from(transferred.mechanics);
            row.sourceMechanics = [...new Uint32Array(data.mechanics.buffer)];
            row.readbackBytes = candidate.readbackBytes; row.success = true;
          } catch (error) { row.success = false; row.reason = error.message; }
          const actualInputs = await Promise.all([[stateBuffer, data.state], [thermoBuffer, data.thermo], [mechanicsBuffer, data.mechanics]]
            .map(async ([buffer, values]) => ({ actual: await read(buffer, values.byteLength), expected: [...new Uint32Array(values.buffer)] })));
          row.sourceUnchanged = actualInputs.every(({ actual, expected }) => actual.every((value, index) => value === expected[index]));
          results.push(row);
          spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
          await generation.releasePromise;
          generation = null;
        }
        const scopes = [await device.popErrorScope(), await device.popErrorScope(), await device.popErrorScope()].filter(Boolean).map((error) => error.message);
        return { results, errors, scopes, actualSsGeneration: results.length === cases.length,
          adapter: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture, description: adapter.info?.description } };
      } finally {
        for (const output of phaseOutputs) output.destroyOutputParticleBuffers?.();
        for (const pair of pairs) owner.releaseSphAerosolCondensatePair(pair);
        for (const family of families) owner.releaseSphAerosolParcelFamily(family);
        if (generation) spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device);
        await device.queue.onSubmittedWorkDone(); resources.forEach((buffer) => buffer.destroy()); device.destroy();
      }
    });
  } finally { await browser.close(); }
  assert.deepEqual(result.errors, []); assert.deepEqual(result.scopes, []); assert.equal(result.actualSsGeneration, true);
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 2e-5 * Math.max(1, Math.abs(expected)), `${label}: ${actual} vs ${expected}`);
  for (const row of result.results) await t.test(row.name, () => {
    assert.equal(row.sourceUnchanged, true, 'original GPU S/T/M are byte unchanged');
    assert.equal(row.success, !row.expectedReject, row.reason);
    if (!row.success) return;
    const { source, terminal } = row.budget;
    near(terminal.massKg, source.massKg, 'mass');
    for (const phase of ['solid', 'liquid', 'gas', 'plasma']) near(terminal.phaseMassKg[phase], source.phaseMassKg[phase], `${phase} mass`);
    for (let axis = 0; axis < 3; axis++) {
      near(terminal.momentumKgMPerS[axis], source.momentumKgMPerS[axis], 'momentum');
      near(terminal.firstMomentKgM[axis], source.firstMomentKgM[axis], 'independent positions/first moment');
    }
    near(terminal.internalPlusTranslationalKineticEnergyJ, source.internalPlusTranslationalKineticEnergyJ, 'U+translational KE');
    near(terminal.aerosolMassKg, row.expectedAerosolMass, 'actual aerosol debit');
    near(row.transferredState[2 * 8], 0.5, 'bulk liquid stays at original position');
    near(row.transferredState[4 * 8 + 3], row.expectedResidualMass, 'residual donor mass');
    near(row.transferredState[4 * 8 + 7], row.expectedGasU, 'physical gas endpoint after actual transfer');
    for (let lane = 0; lane <= 18; lane++) assert.equal(row.residualMechanics[4 * 32 + lane], row.sourceMechanics[4 * 32 + lane], 'F/C/J preserved bitwise');
    if (row.expectedSoundSpeed != null) {
      const residual = new Float32Array(Uint32Array.from(row.residualMechanics).buffer);
      near(residual[4 * 32 + 25], row.expectedSoundSpeed, 'residual current-T gas c');
      near(row.transferredMechanics[4 * 32 + 25], row.expectedSoundSpeed, 'phase transfer current-T gas c');
    }
    assert.equal(row.readbackBytes, 64);
  });
  const valid = (name) => result.results.find((row) => row.name === name).budget.terminal;
  const baseline = valid('baseline'), doubled = valid('double physical population'), sparse = valid('sparse spare capacity');
  assert.equal(baseline.physicalMultiplicity, String(2n ** 40n + 7n));
  near(doubled.aerosolMassKg, baseline.aerosolMassKg, 'N is not mass');
  near(doubled.aerosolCondensedVolumeM3, baseline.aerosolCondensedVolumeM3, 'N is not volume');
  near(doubled.maxDropletRadiusM / baseline.maxDropletRadiusM, 2 ** (-1 / 3), 'physical radius scaling');
  near(sparse.internalEnergyJ, baseline.internalEnergyJ, 'capacity invariance');
  console.log(JSON.stringify({ evidence: 'actual-SS-source-conservative-condensate-debit-through-real-phase-transfer',
    scope: 'isolated-U-plus-translational-KE-paired-transfer-not-main-tick-volume-optics-or-plume', ...result }));
});
