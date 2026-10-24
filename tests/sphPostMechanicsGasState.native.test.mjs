import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';

// The root owner supplies a complete, fixed source manifest before launching
// this opt-in desktop job. These paths are the indispensable integration edges,
// not permission to exclude the rest of the source tree from that manifest.
const REQUIRED = [
  'tests/sphPostMechanicsGasState.native.test.mjs',
  'tests/fixtures/sphPostMechanicsGasStateNative.js',
  'src/runtime/sph/sphPostMechanicsGasStateGpu.js',
  'src/runtime/sph/sphMlsMpmPostMechanicsClosure.js',
  'src/runtime/sph/sphMlsMpmGpuStep.js',
  'src/runtime/sph/schroederHierarchyGpu.js',
  'src/runtime/sph/schroederSpatialEpochGpu.js',
  'src/runtime/sph/schroederSpatialEpochTransaction.js',
  'src/runtime/sph/sphSpatialGasLedgerEosGpu.js',
  'src/runtime/sph/sphSpatialGasCaloricAdmission.js',
  'src/runtime/sph/sphSpatialGasMixtureMoments.js',
  'src/runtime/sph/sphAerosolSpatialBinding.js',
  'src/runtime/sph/sphAerosolParcelGpu.js',
  'src/runtime/sph/sphVaporAerosolExchangeGpu.js',
  'src/runtime/sph/sphVaporAerosolExchangeWgsl.js',
  'ulg-gpu-abi/src/sphVaporAerosolExchange.js',
  'src/runtime/sph/sphResidentProductHistoryGpu.js',
  'src/runtime/sph/sphGpuBuffers.js',
  'src/runtime/sph/sphThermalGpuKernel.js',
  'src/runtime/sph/sphReactionGpuKernel.js',
  'src/runtime/sph/sphReactionEnergyAuthority.js',
  'src/runtime/sph/sphPhaseCarrierTransferGpu.js',
  'src/runtime/sph/sphMechanicsRefreshGpuKernel.js',
  'src/runtime/sph/sphMechanicsMaterialTable.js',
  'src/runtime/sph/sphCondensableParticleInitialization.js',
  'src/runtime/sph/sphCondensableCaloricTable.js',
  'src/runtime/material/condensableThermodynamics.js',
  'ulg-gpu-abi/src/wgsl.js',
  'ulg-gpu-abi/src/sphReactionEnergyWgsl.js'
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function verifySourceFreeze(path, prior = null) {
  const contents = await readFile(path, 'utf8');
  if (prior !== null) assert.equal(contents, prior, 'the fixed source manifest changed');
  const rows = contents.trim().split('\n').map((line) => {
    const match = /^([0-9a-f]{64}) [ *](.+)$/.exec(line);
    assert.ok(match, 'expected a sha256sum manifest row: ' + line);
    return { hash: match[1], path: resolve(match[2]) };
  });
  for (const path of REQUIRED) {
    assert.ok(rows.some((row) => row.path === resolve(path)), 'missing frozen dependency: ' + path);
  }
  for (const row of rows) assert.equal(sha256(await readFile(row.path)), row.hash, row.path);
  return { contents, rows, hash: sha256(contents) };
}

function close(actual, expected, label, relative = 3e-5, absolute = 2e-8) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), label + ': finite values required');
  assert.ok(Math.abs(actual - expected) <= Math.max(absolute, Math.abs(expected) * relative),
    `${label}: actual ${actual}, independently expected ${expected}`);
}

// Independent inventory arithmetic on actual final source readbacks. This is
// deliberately not runSphReactionStepCpu, a fabricated compact table, or a
// separate production oracle. It checks exactly the physical source fields
// that the GPU classifier and EOS must consume.
function expectedGasMembers(run) {
  const result = [];
  for (let i = 0; i < run.particleCount; i++) {
    const s = i * 8, t = i * 12;
    const mass = run.final.state[s + 3];
    if (!(mass > 0) || run.final.thermo[t + 1] !== 3) continue;
    const materialId = run.final.thermo[t];
    const material = run.materials.find((entry) => entry.id === materialId);
    assert.ok(material, 'the test must independently know every actual gas material');
    result.push({ sourceKind: 'particle', sourceRowIndex: i, materialId, massKg: mass,
      moles: mass / material.molarMassKgPerMol, u: run.final.state[s + 7],
      temperatureK: run.final.thermo[t + 2], positionM: run.final.state.slice(s, s + 3),
      material });
  }
  for (let i = 0; i < run.history.liveRowCount; i++) {
    const row = run.history.rows.slice(i * 32, (i + 1) * 32);
    if (!(row[13] > 0) || row[10] !== 1) continue;
    assert.equal(row[11], 3, 'gas-routed residual must actually be gas');
    const material = run.materials.find((entry) => entry.id === row[4]);
    assert.ok(material, 'known residual caloric material');
    result.push({ sourceKind: 'product-event', sourceRowIndex: i, materialId: row[4],
      massKg: row[13], moles: row[9] * row[13] / row[3], u: row[19],
      temperatureK: row[16], positionM: row.slice(0, 3), material });
  }
  return result;
}

function assertCompleteHistory(run) {
  const history = run.history;
  assert.equal(history.mergePayloadPolicy, 'stable-old-then-new-positive-residual-full32-word-copy');
  const liveSourceRows = (words, label) => {
    assert.equal(words.length % 32, 0, label + ': complete source rows');
    const floats = new Float32Array(new Uint32Array(words).buffer), live = [];
    for (let offset = 0; offset < words.length; offset += 32) {
      if (!(floats[offset + 13] > 0)) continue;
      // Every manufactured physical residual must be eligible, independently
      // of the merge kernel's result. Do not turn an invalid emitted row into
      // an expected silent omission by copying its production predicate.
      assert.equal(floats[offset + 18], 1, label + ': actual phase record ready');
      assert.equal(floats[offset + 30], 1, label + ': actual constitutive row ready');
      assert.ok(floats[offset + 11] > 0 && floats[offset + 17] > 0, label + ': phase and density');
      live.push(words.slice(offset, offset + 32));
    }
    return live;
  };
  const original = liveSourceRows(history.originalWords, 'original history');
  const emitted = liveSourceRows(history.emittedWords, 'actual reaction history');
  assert.equal(original.length, 1, 'documented initial positive residual');
  assert.ok(emitted.length >= 2, 'two real newly emitted product terms');
  assert.equal(history.liveRowCount, original.length + emitted.length, 'complete merged live count');
  assert.deepEqual(history.mergedWords, [...original, ...emitted].flat(),
    'full32-word payload and order: exact original plus actual new history, no omission, duplication or rebasing');
}

function assertCurrentInventory(run) {
  const members = expectedGasMembers(run);
  const actual = run.oracle.compactRows;
  assert.equal(actual.length, members.length, run.name + ': complete gas membership');
  for (const member of members) {
    const matches = actual.filter((row) => row.sourceKind === member.sourceKind
      && row.sourceRowIndex === member.sourceRowIndex);
    assert.equal(matches.length, 1, 'each actual source address appears exactly once');
    const row = matches[0];
    assert.equal(row.materialId, member.materialId);
    assert.equal(row.sourcePhaseId, 3);
    assert.deepEqual(row.positionM, member.positionM, 'source geometry is not the old classifier geometry');
    close(row.massKg, member.massKg, 'member residual mass');
    close(row.moles, member.moles, 'member residual moles');
    assert.equal(row.sourceSpecificInternalEnergyJPerKg, member.u, 'exact actual U, no rebasing');
    assert.equal(row.sourceTemperatureK, member.temperatureK, 'exact actual independent species T');
  }
  const totals = members.reduce((sum, member) => ({
    mass: sum.mass + member.massKg,
    energy: sum.energy + member.massKg * member.u,
    moles: sum.moles + member.moles,
    nT: sum.nT + member.moles * member.temperatureK
  }), { mass: 0, energy: 0, moles: 0, nT: 0 });
  const moments = run.oracle.mixtureMoments;
  assert.ok(moments.length > 0 && moments.every((cell) => cell.ready));
  assert.equal(moments.reduce((sum, cell) => sum + cell.memberCount, 0), members.length);
  close(moments.reduce((sum, cell) => sum + cell.massKg, 0), totals.mass, 'whole source mass');
  close(moments.reduce((sum, cell) => sum + cell.internalEnergyJ, 0), totals.energy, 'whole source energy');
  close(moments.reduce((sum, cell) => sum + cell.moles, 0), totals.moles, 'whole source moles');
  close(moments.reduce((sum, cell) => sum + cell.moleTemperatureK, 0), totals.nT, 'whole source nT');
  assert.ok(run.oracle.caloricCells.length > 0 && run.oracle.caloricCells.every((cell) => cell.ready));
  assert.equal(run.oracle.exchangeIntervalAdmitted, false);
  // The fixture deliberately locates all carriers and history in one grid cell.
  assert.equal(run.oracle.pressureCells.length, 1, 'manufactured one-cell source');
  const cell = run.oracle.pressureCells[0];
  assert.deepEqual(cell.gridIndex, [0, 0, 0], 'declared physical gas cell, not shifted mechanics-node coordinates');
  let occupiedVolumeM3 = 0;
  if (run.aerosolBefore) {
    const parcel = new Float32Array(new Uint32Array(run.aerosolBefore).buffer);
    assert.deepEqual([...parcel.slice(0, 3)], [.25, .25, .25]);
    // Independent B/A/W projection for h=1 and box[0,4]^3. At x=.25,
    // B[-1,0,1]={1,22,9}/32; ordered capacities are {1/48,1/2,47/48}.
    // Cell0 receives all of nodes-1,0 and23/47 of node1, hence
    // (1+22+9*23/47)/32 =161/188 per axis. Sparse gas keys do NOT
    // renormalize the parcel into the single occupied gas cell.
    const axisWeight = (1 / 32) + (22 / 32) + (9 / 32) * (23 / 47);
    occupiedVolumeM3 = (parcel[3] / parcel[9]) * axisWeight ** 3;
    assert.ok(occupiedVolumeM3 > 1.2e-5, 'nontrivial local aerosol occupancy');
  }
  const expectedFreeVolumeM3 = 1 - occupiedVolumeM3;
  // A few f32 ulps for the final unit-volume subtraction. Omitted aerosol
  // occupancy differs by ~1.26e-5, over60 times this fixed absolute budget.
  close(cell.volumeM3, expectedFreeVolumeM3, 'independent projected physical free volume', 0, 2e-7);
  close(cell.pressurePa, 8.314462618 * totals.nT / expectedFreeVolumeM3,
    'actual source ideal-mixture EOS with independent denominator', 1e-6);
  const heatCapacity = members.reduce((sum, member) => sum + member.massKg * member.material.gasCv, 0);
  const equilibriumT = members.reduce((sum, member) => sum + member.massKg
    * member.material.gasCv * (300 + (member.u - member.material.gasUAt300) / member.material.gasCv), 0) / heatCapacity;
  close(run.oracle.caloricCells[0].heatCapacityJPerK, heatCapacity, 'source heat capacity');
  close(run.oracle.caloricCells[0].equilibriumTemperatureK, equilibriumT, 'energy-derived equilibrium T', 3e-6, 0.001);
  return totals;
}

function assertExistingAerosolConsumer(run) {
  assert.equal(run.aerosolRetirementRequested, true);
  assert.equal(run.rawAerosolReopenRejected, true, 'the current pipeline must fork a held read, not reopen the raw family');
  assert.equal(run.aerosolSurvivedCurrentOwners, true);
  assert.equal(run.monitorAerosolReadReleased, true);
  assert.equal(run.aerosolDestroyCount, 1, 'original population retires only after its final held read');
  const exchange = run.exchange, candidate = exchange.candidate, result = exchange.result;
  assert.equal(candidate.ready, true, JSON.stringify(candidate));
  assert.equal(exchange.candidateReleased, true);
  assert.equal(exchange.sourceUnchanged, true);
  assert.equal(exchange.originalParcelOwnerStillHeld, true);
  assert.equal(candidate.kineticAuthorization, false);
  assert.equal(candidate.exchangeIntervalAdmitted, false);
  assert.equal(candidate.outerPublicationAdmitted, false);
  assert.equal(candidate.mechanicsContinuationAdmitted, false);
  assert.equal(candidate.pressureRequiresRefresh, true);
  const before = [...new Float32Array(new Uint32Array(run.aerosolBefore).buffer)];
  const after = [...new Float32Array(new Uint32Array(result.parcelWords).buffer)];
  const index = exchange.edge.gasIndex, s = index * 8;
  const oldGasMass = run.final.state[s + 3], newGasMass = result.stateValues[s + 3];
  const dm = oldGasMass - newGasMass;
  assert.equal(dm, 1 / 65536, 'nonzero exactly representable prescribed transfer');
  assert.equal(after[3] - before[3], dm, 'actual stored endpoint credit equals debit in f64');
  for (let i = 0; i < run.particleCount; i++) if (i !== index) {
    assert.deepEqual(result.stateValues.slice(i * 8, i * 8 + 8), run.final.state.slice(i * 8, i * 8 + 8));
    assert.deepEqual(result.thermoValues.slice(i * 12, i * 12 + 12), run.final.thermo.slice(i * 12, i * 12 + 12));
    assert.deepEqual(result.mechanicsValues.slice(i * 32, i * 32 + 32), run.final.mechanics.slice(i * 32, i * 32 + 32));
  }
  for (let lane = 12; lane < 24; lane++) assert.equal(result.parcelWords[lane], run.aerosolBefore[lane],
    'physical population, identity and provenance survive exactly');
  const material = run.materials.find((entry) => entry.key === 'h2');
  const N = Number(BigInt(run.aerosolBefore[14]) + (BigInt(run.aerosolBefore[15]) << 32n));
  const area = (mass) => 4 * Math.PI * N * (3 * mass / (4 * Math.PI * N * material.liquidDensityKgPerM3)) ** (2 / 3);
  const oldSurfaceU = .2 * area(before[3]), newSurfaceU = .2 * area(after[3]);
  close(result.surfaceValues[0], area(before[3]), 'actual original droplet area');
  close(result.surfaceValues[1], oldSurfaceU, 'original separate surface internal energy');
  close(result.surfaceValues[2], area(after[3]), 'actual candidate droplet area');
  close(result.surfaceValues[3], newSurfaceU, 'candidate separate surface internal energy');
  const ug = run.final.state[s + 7], ul = before[7];
  const vg = run.final.state.slice(s + 4, s + 7), vl = before.slice(4, 7);
  const relativeSpeed2 = vg.reduce((sum, value, axis) => sum + (value - vl[axis]) ** 2, 0);
  const mixingHeat = .5 * dm * before[3] / (before[3] + dm) * relativeSpeed2;
  const expectedLiquidU = (before[3] * ul + dm * ug + mixingHeat - newSurfaceU + oldSurfaceU) / after[3];
  close(result.stateValues[s + 7], ug, 'gas donor specific U', 3e-6);
  close(after[7], expectedLiquidU, 'liquid internal energy with actual donor and surface work', 3e-6);
  close(after[8], 300 + (expectedLiquidU - material.liquidUAt300) / material.liquidCv,
    'independent liquid caloric inverse', 3e-6, .001);
  for (let axis = 0; axis < 3; axis++) {
    close(newGasMass * result.stateValues[s + 4 + axis] + after[3] * after[4 + axis],
      oldGasMass * vg[axis] + before[3] * vl[axis], 'joint stored momentum', 3e-6, 1e-8);
  }
  const energy = (mass, u, v) => mass * (u + .5 * v.reduce((sum, value) => sum + value * value, 0));
  const oldEnergy = energy(oldGasMass, ug, vg) + energy(before[3], ul, vl) + oldSurfaceU;
  const newEnergy = energy(newGasMass, result.stateValues[s + 7], result.stateValues.slice(s + 4, s + 7))
    + energy(after[3], after[7], after.slice(4, 7)) + newSurfaceU;
  close(newEnergy, oldEnergy, 'current source → candidate bulk + KE + surface conservation', 3e-6, .003);
  assert.equal(result.mechanicsValues[index * 32 + 28], run.final.mechanics[index * 32 + 28],
    'historical pressure is not promoted to refreshed mechanics');
}

test('native current post-mechanics gas source uses genuine final stages, complete history and fresh SS', {
  skip: process.env.ULG_RUN_NATIVE_POST_MECHANICS_GAS_STATE !== '1', timeout: 240_000
}, async () => {
  const output = process.env.ULG_POST_MECHANICS_GAS_STATE_EVIDENCE;
  const manifestPath = process.env.ULG_POST_MECHANICS_GAS_STATE_SOURCE_MANIFEST;
  assert.ok(isAbsolute(output || '') && isAbsolute(manifestPath || ''), 'new absolute evidence and fixed manifest required');
  const manifest = await verifySourceFreeze(manifestPath);
  const baseUrl = process.env.ULG_POST_MECHANICS_GAS_STATE_BASE_URL
    || 'https://fastbox.tail5c077c.ts.net:5173/';
  assert.equal(new URL(baseUrl).protocol, 'https:');
  const evidence = { schema: 'peercompute.ulg.native-current-post-mechanics-gas-source.v1',
    started: new Date().toISOString(), baseUrl,
    sourceManifest: { path: manifestPath, sha256: manifest.hash, fileCount: manifest.rows.length },
    headed: true, desktop: 'Wayland', browser: '/usr/bin/google-chrome', ignoreHTTPSErrors: false,
    realGpuStages: true, manufacturedColdBoundary: true, manufacturedModelsAndReaction: true,
    preClosureMechanicsIntegrationTested: false, fullSourceReadbackOnlyInTest: true,
    kineticsAdmitted: false, outerPublicationAdmitted: false, presetEnrollment: false,
    atmosphericGrowthValidation: false, plumeValidation: false };
  let browser, watchdog, watchdogClose, failure;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: false,
      args: ['--ozone-platform=wayland', '--use-angle=vulkan', '--enable-features=Vulkan,UseSkiaRenderer',
        '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
    const owned = browser;
    watchdog = setTimeout(() => {
      failure ??= new Error('Owned current-gas browser exceeded 210 second watchdog');
      watchdogClose = owned.close().catch((error) => { evidence.watchdogCloseError = String(error); });
    }, 210_000);
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    await page.goto(new URL('/package.json', baseUrl).href);
    evidence.observed = await page.evaluate(async ({ sources }) => {
      const servedSources = [];
      for (const source of sources) {
        const raw = (await import('/' + source.path + '?raw')).default;
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        const observedHash = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
        if (observedHash !== source.hash) throw new Error('Served source drift: ' + source.path);
        servedSources.push({ ...source, observedHash });
      }
      const fixture = await import('/tests/fixtures/sphPostMechanicsGasStateNative.js');
      return { servedSources, ...await fixture.runSphPostMechanicsGasStateNative() };
    }, { sources: REQUIRED.map((path) => ({ path,
      hash: manifest.rows.find((row) => row.path === resolve(path)).hash })) });
  } catch (error) { failure ??= error; evidence.harnessError = String(error?.stack || error); }
  finally {
    clearTimeout(watchdog);
    if (watchdogClose) await watchdogClose;
    if (browser) {
      try { await browser.close(); evidence.ownedBrowserClosed = !browser.isConnected(); }
      catch (error) { failure ??= error; evidence.browserCloseError = String(error); }
    }
    try { await verifySourceFreeze(manifestPath, manifest.contents); evidence.sourceFreezeUnchanged = true; }
    catch (error) { failure ??= error; evidence.sourceFreezeError = String(error); }
    evidence.finished = new Date().toISOString();
    // Persist failed native evidence before asserting; never overwrite a prior run.
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (failure) throw failure;
  assert.equal(evidence.ownedBrowserClosed, true);
  assert.equal(evidence.sourceFreezeUnchanged, true);
  assert.equal(evidence.observed.fatalError, null);
  assert.deepEqual(evidence.observed.errors, []);
  assert.equal(evidence.observed.cases.length, 5);
  for (const run of evidence.observed.cases) {
    assert.equal(run.error, null, run.name);
    assert.equal(run.originalSourcesUnchanged, true, run.name);
    assert.equal(run.closureRetired, true, run.name + ': closure owner fence');
    assert.equal(run.originalGenerationReleased, true, run.name + ': original SS release');
    assert.equal(run.originalTransactionAborted, true, run.name + ': real nonpublishing terminal transition');
    assert.equal(run.originalTransactionSummary.state, 'aborted');
    assert.equal(run.originalTransactionSummary.commitPublished, false);
    assert.equal(run.originalTransactionSummary.counters.commitCount, 0);
    assert.equal(run.originalTransactionSummary.counters.releaseScheduleCount, 0);
    assert.equal(run.abortedBindingReadRejected, true, 'real abort releases the original binding capture');
    assert.ok(run.dtSeconds > 0);
    assert.equal(run.closure.fullParticleReadbackPerformed, false);
    assert.equal(run.closure.stageBackends.thermal, 'webgpu');
    assert.equal(run.closure.stageBackends.phase, 'webgpu');
    assert.equal(run.closure.stageBackends.refresh, 'webgpu');
    assert.deepEqual(run.closure.executedStageOrder, run.reactionEnabled
      ? ['thermal-phase', 'reaction-product', 'phase-carrier-transfer-v2', 'mechanics-constitutive-refresh']
      : ['thermal-phase', 'phase-carrier-transfer-v2', 'mechanics-constitutive-refresh']);
    if (run.name === 'released-source-read') {
      assert.equal(run.readReleased, true);
      assert.equal(run.readUsesFinalTuple, true);
      assert.equal(run.releasedReadRejected, true);
      assert.equal(run.copiedReadRejected, true);
      assert.equal(run.reacquireRejected, true);
      continue;
    }
    assert.equal(run.copiedClosureRejected, true);
    assert.equal(run.staleOriginalSourceRejected, true);
    assert.equal(run.sourceIdentity.finalStateDiffers, true);
    assert.equal(run.sourceIdentity.finalThermoDiffers, true);
    assert.equal(run.sourceIdentity.finalMechanicsDiffers, true);
    assert.equal(run.final.state[3], 0, 'real phase transfer clears the first primary address');
    assert.equal(run.final.state[11], 0, 'real phase transfer clears the second primary address');
    assert.ok(run.final.state[4 * 8 + 3] > 0 && run.final.state[5 * 8 + 3] > 0,
      'real phase transfer populates the fixed gas-lane addresses');
    if (run.reactionEnabled) assertCompleteHistory(run);
    if (run.name === 'unsupported-condensed-history') {
      assert.ok(run.history.rows.some((_, offset, rows) => offset % 32 === 10
        && rows[offset] !== 1 && rows[offset + 3] > 0), 'actual positive unplaced condensed history retained');
      assert.equal(run.usableEosRejected, true, 'unsupported volume inventory must not produce a usable EOS');
      assert.ok(run.rejectionControlWords?.length > 0, 'real GPU control rejection, not a manufactured error');
      assert.equal(run.rejectionControlWords[3] & 1, 1, 'GPU INVALID_CANDIDATE occupancy veto');
      continue;
    }
    assert.equal(run.current.ready, true);
    assert.equal(run.current.sourceStage, 'post-mechanics-closure');
    assert.equal(run.current.kineticsAdmitted, false);
    assert.equal(run.current.outerPublicationAdmitted, false);
    assert.equal(run.currentReleased, true);
    assert.equal(run.sourceIdentity.freshAssignment, true);
    assert.equal(run.sourceIdentity.freshGeneration, true);
    assert.equal(run.sourceIdentity.assignmentUsesFinalState, true);
    assert.equal(run.sourceIdentity.assignmentUsesFinalThermo, true);
    assert.equal(run.sourceIdentity.assignmentUsesFinalMechanics, true);
    assert.equal(run.sourceIdentity.assignmentNotOriginalState, true);
    assert.equal(run.sourceIdentity.completeHistoryMatches, true);
    assert.equal(run.oracle.controlErrorFlags, 0);
    assert.equal(run.oracle.particleProductSourcePaired, true);
    const totals = assertCurrentInventory(run);
    if (run.name === 'current-source-existing-aerosol-consumer') assertExistingAerosolConsumer(run);
    if (run.reactionEnabled) {
      assert.equal(run.closure.stageBackends.reaction, 'webgpu');
      assert.ok(run.history.emittedPositiveRows >= 2, 'new actual reaction history, not merely the old reservoir');
      assert.equal(run.history.distinctMergedBuffer, true);
      assert.equal(run.history.liveCountAuthorityPresent, true);
      assert.ok(run.history.liveRowCount >= 3);
      assert.equal(run.history.countWords[0], run.history.countDescriptor.magic);
      assert.equal(run.history.countWords[1], run.history.countDescriptor.version);
      assert.equal(run.history.countWords[2], run.history.countDescriptor.readyStatus);
      assert.equal(run.history.countWords[6], run.history.countDescriptor.generation);
      assert.equal(run.history.countWords[7], run.history.countDescriptor.seal);
      close(totals.mass, run.initialTotalCarrierMassKg + run.initialResidualGasMassKg,
        'complete old+new reaction source conserves mass', 3e-5);
    } else {
      assert.equal(run.history.liveRowCount, 0);
      assert.equal(run.history.liveCountAuthorityPresent, false);
    }
  }
});
