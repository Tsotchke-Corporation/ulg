import assert from 'node:assert/strict';
import test from 'node:test';

// Real production SS generation -> sealed source transaction -> aerosol local
// occupancy -> retained EOS. Expected weights are manufactured analytically,
// not obtained from a CPU particle solver or copied from observed GPU output.
test('native aerosol occupied volume uses exact local B/A/W and its real EOS denominator', {
  skip: process.env.ULG_RUN_NATIVE_AEROSOL_FREE_VOLUME === '1'
    ? false : 'set ULG_RUN_NATIVE_AEROSOL_FREE_VOLUME=1 for the owned desktop GPU check',
  timeout: 180_000
}, async (t) => {
  const evidencePath = process.env.ULG_AEROSOL_FREE_VOLUME_EVIDENCE;
  if (evidencePath) {
    const { isAbsolute } = await import('node:path');
    if (!isAbsolute(evidencePath)) throw new TypeError('ULG_AEROSOL_FREE_VOLUME_EVIDENCE must be absolute');
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome',
    headless: false, args: ['--ozone-platform=wayland', '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const started = performance.now();
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    await page.goto(new URL('/package.json', process.env.ULG_AEROSOL_FREE_VOLUME_BASE_URL
      || 'https://fastbox.tail5c077c.ts.net:5173/').href);
    const evidence = await page.evaluate(async () => {
      // Follow the running EOS module's exact transformed dependency URLs.
      // A second hard-coded import without Vite's ?t= stamp creates different
      // private WeakMaps and cannot manufacture a valid producer capability.
      const dependency = async (url, file) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Cannot resolve ${url}: HTTP ${response.status}`);
        const code = await response.text();
        const paths = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
        const path = paths.find((entry) => entry.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error(`Missing exact dependency ${file} in ${url}`);
        return new URL(path, new URL(url, location.href)).href;
      };
      const eosUrl = new URL('/src/runtime/sph/sphSpatialGasLedgerEosGpu.js', location.href).href;
      const bindingUrl = await dependency(eosUrl, 'sphAerosolSpatialBinding.js');
      const freeVolumeUrl = await dependency(eosUrl, 'sphSpatialGasFreeVolumeGpu.js');
      const transactionUrl = await dependency(bindingUrl, 'schroederSpatialEpochTransaction.js');
      const aerosolUrl = await dependency(bindingUrl, 'sphAerosolParcelGpu.js');
      const spatialUrl = await dependency(transactionUrl, 'schroederSpatialEpochGpu.js');
      const identityUrl = await dependency(transactionUrl, 'sphGpuDeviceIdentity.js');
      for (const [parent, file, expected] of [
        [freeVolumeUrl, 'sphAerosolSpatialBinding.js', bindingUrl],
        [transactionUrl, 'sphAerosolSpatialBinding.js', bindingUrl],
        [aerosolUrl, 'schroederSpatialEpochTransaction.js', transactionUrl],
        [eosUrl, 'schroederSpatialEpochGpu.js', spatialUrl],
        [freeVolumeUrl, 'schroederSpatialEpochGpu.js', spatialUrl],
        [eosUrl, 'sphGpuDeviceIdentity.js', identityUrl],
        [aerosolUrl, 'sphGpuDeviceIdentity.js', identityUrl]
      ]) {
        const actual = await dependency(parent, file);
        if (actual !== expected) throw new Error(`Inconsistent native module identity: ${actual} !== ${expected}`);
      }
      const spatial = await import(spatialUrl), transaction = await import(transactionUrl);
      const aerosol = await import(aerosolUrl), eos = await import(eosUrl), identity = await import(identityUrl);
      const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('native WebGPU adapter unavailable');
      const device = await adapter.requestDevice({ requiredLimits: {
        maxStorageBuffersPerShaderStage: 8,
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
      } });
      const errors = [], groups = [], cases = [];
      device.addEventListener('uncapturederror', (event) => errors.push(event.error.message));
      const createBindGroup = device.createBindGroup.bind(device);
      device.createBindGroup = (descriptor) => { groups.push(descriptor); return createBindGroup(descriptor); };
      const makeBuffer = (label, values) => {
        const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({ label,
          size: Math.max(16, values.byteLength), usage: GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }), device);
        device.queue.writeBuffer(buffer, 0, values); return buffer;
      };
      const readWords = async (buffer, bytes = buffer.size) => {
        const copy = device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
        const encoder = device.createCommandEncoder(); encoder.copyBufferToBuffer(buffer, 0, copy, 0, bytes);
        device.queue.submit([encoder.finish()]); await copy.mapAsync(GPUMapMode.READ);
        const words = Array.from(new Uint32Array(copy.getMappedRange())); copy.unmap(); copy.destroy(); return words;
      };
      const parcel = (patch = {}) => ({ slot: 0, parcelId: 1n, nucleusPopulationId: 7n,
        physicalMultiplicity: (1n << 40n) + 8n, sourceLineageIndex: 0xffffffff, sourceTopologyEpoch: 0,
        materialId: 9, phaseId: 2, positionM: [0.25, 0.25, 0.25], massKg: 125,
        velocityMPerS: [0, 0, 0], specificInternalEnergyJPerKg: -10,
        temperatureK: 300, condensedDensityKgM3: 1000, ...patch });
      let serial = 0;
      const runCase = async ({ name, levels = 1, parcels = [parcel()], capacity = 130,
        sparse = false, carrierLiquid = false, noFamily = false, corrupt = null, corruptEos = null,
        unsealed = false, releaseOwnerAfterCapture = false, wrongLevelSpacing = false }) => {
        const n = ++serial, label = `native-aerosol-volume-${name}-${n}`;
        const epochs = { storageGeneration: n, physicsTick: n, physicsSubstep: 0,
          positionEpoch: n, topologyEpoch: n, chartEpoch: 1, levelEpoch: 1, supportEpoch: 1 };
        const specs = [];
        for (let x = 0; x < (sparse ? 1 : 2); x++) {
          for (let y = 0; y < (sparse ? 1 : 2); y++) {
            for (let z = 0; z < (sparse ? 1 : 2); z++) {
              specs.push({ position: [x + 0.25, y + 0.25, z + 0.25], phase: 3,
                volume: 0.01, mass: 0.01, density: 1 });
            }
          }
        }
        if (carrierLiquid) specs.push({ position: [0.25, 0.25, 0.25], phase: 2,
          volume: 0.0625, mass: 62.5, density: 1000 });
        const count = specs.length, state = new Float32Array(count * 8), thermo = new Float32Array(count * 12);
        const mechanics = new Float32Array(count * 32), assignment = new Float32Array(count * 16);
        const fineH = levels === 2 ? 0.5 : 1;
        specs.forEach((spec, index) => {
          const level = levels === 2 ? index % 2 : 0;
          const spacing = wrongLevelSpacing ? 1 : fineH * 2 ** level;
          assignment.set([level, spacing, 1, spec.volume, spec.volume, spec.volume,
            spec.mass, spec.density, spec.phase, 9, 1, 0, ...spec.position, 0], index * 16);
          state.set([...spec.position, spec.mass, 0, 0, 0, -10], index * 8);
          thermo.set([9, spec.phase, 300, spec.density, 0, Number(spec.phase === 2),
            Number(spec.phase === 3), 0, 1, 6.02214076e23, 1, 0.1], index * 12);
          mechanics[index * 32 + 18] = 1; mechanics[index * 32 + 19] = spec.volume;
          mechanics[index * 32 + 21] = 1; mechanics[index * 32 + 31] = spec.mass;
        });
        const sourceStateBuffer = makeBuffer(`${label}-state`, state);
        const sourceThermoBuffer = makeBuffer(`${label}-thermo`, thermo);
        const sourceMechanicsBuffer = makeBuffer(`${label}-mechanics`, mechanics);
        const identityBuffer = makeBuffer(`${label}-identity`, Uint32Array.from({ length: count }, (_, i) => i + 1));
        const assignmentBuffer = makeBuffer(`${label}-assignment`, assignment);
        const family = noFamily ? null : aerosol.createSphAerosolParcelFamilyWebGpu({
          device, capacity, parcels, provenance: { kind: 'initial-conditions', reference: label } });
        const familyRead = family ? aerosol.acquireSphAerosolParcelRead({ family, device, expectedGeneration: 0 }) : null;
        if (corrupt && familyRead) {
          const [word, value] = corrupt;
          device.queue.writeBuffer(familyRead.buffer, word * 4, new Uint32Array([value]));
        }
        const parcelBefore = familyRead ? await readWords(familyRead.buffer) : null;
        const sphParticleUpload = { schema: 'peercompute.ulg.sph-gpu-particle-buffer-set.v0',
          status: 'webgpu-uploaded', particleCount: count, stateBuffer: sourceStateBuffer,
          stateBufferByteLength: sourceStateBuffer.size, stateStrideBytes: 32,
          thermoBuffer: sourceThermoBuffer, thermoBufferByteLength: sourceThermoBuffer.size, thermoStrideBytes: 48,
          identityBuffer, identityBufferByteLength: identityBuffer.size, identityStrideBytes: 4,
          identityRevision: `${label}:manufactured-identities-v1`, ...epochs,
          ...(family ? { aerosolFamily: family } : {}) };
        const mlsMpmParticleUpload = { schema: 'peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0',
          status: 'webgpu-uploaded', particleCount: count, mechanicsBuffer: sourceMechanicsBuffer,
          mechanicsBufferByteLength: sourceMechanicsBuffer.size, mechanicsStrideBytes: 128, ...epochs };
        const levelAssignment = { schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready',
          particleCount: count, assignmentStrideFloats: 16, assignmentBuffer,
          assignmentBufferByteLength: assignmentBuffer.size, sourceStateBuffer,
          sourceStateBufferBorrowed: true, sourceStateBufferByteLength: sourceStateBuffer.size,
          sourceThermoBuffer, sourceThermoBufferBorrowed: true, sourceThermoBufferByteLength: sourceThermoBuffer.size,
          sourceIdentityBuffer: identityBuffer, sourceIdentityBufferBorrowed: true,
          sourceIdentityBufferByteLength: identityBuffer.size, sourceMechanicsBuffer,
          sourceMechanicsBufferBorrowed: true, sourceMechanicsBufferByteLength: sourceMechanicsBuffer.size,
          ...epochs, minLevel: 0, maxLevel: levels - 1, chartId: 0, baseGridSpacingM: fineH };
        const fineGrid = { gridDims: levels === 2 ? [13, 13, 13] : [9, 9, 9],
          gridNodeCount: levels === 2 ? 2197 : 729, gridShift: 2, gridSpacingM: fineH };
        const selectedGrid = { selectedLevel: levels - 1, gridDims: [9, 9, 9],
          gridNodeCount: 729, gridShift: 2, gridSpacingM: 1 };
        const generation = spatial.runSchroederSpatialEpochGenerationWebGpu({ device,
          levelAssignment, particleCount: count, particleIdentityBuffer: identityBuffer,
          particleIdentityStrideWords: 1, exactNearCellTreeEnabled: false,
          ...(levels === 1 ? { selectedLevel: 0, mechanicsGrid: selectedGrid }
            : { mechanicsLevels: [{ selectedLevel: 0, mechanicsGrid: fineGrid },
              { selectedLevel: 1, mechanicsGrid: selectedGrid }] }) });
        if (!generation.ready) throw new Error(`${name}: SS rejected ${generation.reason}`);
        const sourceTransaction = unsealed ? null : transaction.createSchroederSpatialEpochTransaction({
          device, generation, sphParticleUpload, mlsMpmParticleUpload, twoLevelAuthoritative: levels === 2 });
        if (releaseOwnerAfterCapture) {
          aerosol.releaseSphAerosolParcelFamily(family);
          await device.queue.onSubmittedWorkDone();
        }
        const releaseInputs = async () => {
          if (sourceTransaction) transaction.abortSchroederSpatialEpochTransaction(sourceTransaction,
            'completed independent native free-volume fixture');
          spatial.releaseSchroederSpatialEpochGenerationAfterQueue(generation, device); await generation.releasePromise;
          if (familyRead) aerosol.releaseSphAerosolParcelRead(familyRead);
          if (family) aerosol.releaseSphAerosolParcelFamily(family);
          await device.queue.onSubmittedWorkDone();
          for (const buffer of [sourceStateBuffer, sourceThermoBuffer, sourceMechanicsBuffer, identityBuffer, assignmentBuffer]) buffer.destroy();
        };
        const startGroup = groups.length;
        const writeBuffer = device.queue.writeBuffer.bind(device.queue);
        let freeVolumeParams = null;
        // Adversarial parameter corruption is test-only. The real private host
        // receipt is still used, so this proves the GPU extension seal too.
        device.queue.writeBuffer = (buffer, offset, data, ...rest) => {
          const bytes = data instanceof ArrayBuffer ? data
            : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          if (offset === 0 && bytes.byteLength === 288 && buffer.label.includes('-gas-free-volume-')) {
            freeVolumeParams = Array.from(new Uint32Array(bytes));
          }
          if (corruptEos && offset === 0 && bytes.byteLength === 256 && new Uint32Array(bytes)[41] === 1) {
            const altered = new Uint32Array(bytes.slice(0));
            if (corruptEos === 'omit') altered.fill(0, 41, 46);
            else altered[corruptEos]++;
            return writeBuffer(buffer, offset, altered);
          }
          return writeBuffer(buffer, offset, data, ...rest);
        };
        let execution;
        try {
          execution = await eos.runSphSpatialGasLedgerEosRetainedWebGpu({ device,
            sphParticleUpload, mlsMpmParticleUpload, schroederLevelAssignment: levelAssignment,
            epochIdentity: epochs, schroederSpatialEpochGeneration: generation,
            spatialGasGrid: selectedGrid, spatialGasCellSizeM: 1, level: levels - 1,
            boxMinM: [0, 0, 0], boxMaxM: [4, 4, 4], laneId: label });
        } finally { device.queue.writeBuffer = writeBuffer; }
        if (unsealed) {
          if (execution.ready || !/omitted|sealed/.test(execution.reason || '')) {
            throw new Error(`${name}: unsealed upload family was not rejected: ${JSON.stringify(execution)}`);
          }
          await releaseInputs();
          const out = { name, hostRejected: true, reason: execution.reason };
          cases.push(out); return out;
        }
        if (!execution.ready) throw new Error(`${name}: EOS host rejected ${execution.reason || execution.status}`);
        const eosGroup = groups.slice(startGroup).find((group) => group.label?.endsWith('-eos-aggregate-bind-group'));
        if (!eosGroup) throw new Error(`${name}: exact producer-owned EOS binding not found`);
        const bound = (binding) => eosGroup.entries.find((entry) => entry.binding === binding).resource.buffer;
        const header = await readWords(bound(6), 256);
        const eosHeader = await readWords(bound(4), eos.SPH_SPATIAL_GAS_AUTHORITY_CONTROL_BYTES);
        const volumeWords = await readWords(bound(5));
        const pressureWords = await readWords(bound(2));
        const pressureFloats = new Float32Array(new Uint32Array(pressureWords).buffer);
        const volumeFloats = new Float32Array(new Uint32Array(volumeWords).buffer);
        const cells = [];
        for (let i = 0; i < header[22]; i++) {
          const p = i * eos.SPH_SPATIAL_GAS_PRESSURE_CELL_ROW_FLOATS, v = i * 4;
          cells.push({ grid: Array.from(pressureFloats.slice(p, p + 3)), status: pressureFloats[p + 3],
            pressure: pressureFloats[p + 7], free: pressureFloats[p + 11],
            geometry: volumeFloats[v], condensed: volumeFloats[v + 1], volumeFree: volumeFloats[v + 2],
            volumeStatus: volumeWords[v + 3] });
        }
        const parcelAfter = familyRead ? await readWords(familyRead.buffer) : null;
        const stateAfter = await readWords(sourceStateBuffer, state.byteLength);
        const thermoAfter = await readWords(sourceThermoBuffer, thermo.byteLength);
        const mechanicsAfter = await readWords(sourceMechanicsBuffer, mechanics.byteLength);
        const momentEvidence = [];
        for (const view of generation.mechanicsLevelViews) {
          const moment = view.phaseVolumeMoment;
          const fields = view.mechanicsFieldView;
          const keys = ['generationId', 'deviceOrdinal', 'laneOrdinal', 'leaseToken', 'sourceFamilyId',
            'storageGeneration', 'physicsTick', 'physicsSubstep', 'positionEpoch', 'topologyEpoch',
            'chartEpoch', 'levelEpoch', 'supportEpoch', 'completionOrdinal', 'selectedLevel',
            'gridNodeCount', 'gridSpacingM', 'fieldCapacity'];
          momentEvidence.push({ metadata: Object.fromEntries(keys.map((key) => [key, moment[key]])),
            grid: view.mechanicsGrid,
            control: await readWords(moment.controlBuffer, 64 * 4),
            fieldPrefix: await readWords(fields.fieldViewBuffer, Math.min(80 * 4, fields.fieldViewBuffer.size)) });
        }
        const parentHeader = generation.parentFieldView
          ? await readWords(generation.parentFieldView.parentFieldViewBuffer, 80 * 4) : null;
        const unchanged = (before, after) => before.length === after.length && before.every((word, i) => word === after[i]);
        const out = { name, levels, cells, header, eosHeader, descriptor: execution.gasFreeVolumeAerosol,
          momentEvidence, parentHeader, freeVolumeParams,
          declaredLevelSpacings: specs.map((_, i) => [assignment[i * 16], assignment[i * 16 + 1]]),
          noHostReadback: execution.mapAsyncCount === 0 && execution.normalHotLoopReadbackFree === true,
          noSourceMutation: (!familyRead || unchanged(parcelBefore, parcelAfter))
            && unchanged(Array.from(new Uint32Array(state.buffer)), stateAfter)
            && unchanged(Array.from(new Uint32Array(thermo.buffer)), thermoAfter)
            && unchanged(Array.from(new Uint32Array(mechanics.buffer)), mechanicsAfter) };
        eos.releaseSphSpatialGasLedgerEosAfterQueue(execution); await execution.releasePromise;
        await releaseInputs();
        cases.push(out); return out;
      };
      try {
        await runCase({ name: 'absent', noFamily: true });
        await runCase({ name: 'one-level' });
        await runCase({ name: 'two-level', levels: 2 });
        await runCase({ name: 'two-level-absent', levels: 2, noFamily: true });
        await runCase({ name: 'wrong-level-spacing', levels: 2, wrongLevelSpacing: true });
        await runCase({ name: 'split', parcels: [parcel({ slot: 0, massKg: 62.5,
          physicalMultiplicity: (1n << 39n) + 4n }), parcel({ slot: 129, parcelId: 2n,
          massKg: 62.5, physicalMultiplicity: (1n << 39n) + 4n })] });
        await runCase({ name: 'material-and-population', parcels: [parcel({ materialId: 15, phaseId: 1,
          massKg: 62.5, condensedDensityKgM3: 500, physicalMultiplicity: (1n << 55n) + 27n })] });
        await runCase({ name: 'sparse', sparse: true });
        await runCase({ name: 'remote', parcels: [parcel(), parcel({ slot: 129, parcelId: 2n,
          positionM: [3.75, 3.75, 3.75] })] });
        await runCase({ name: 'carrier-and-aerosol', carrierLiquid: true });
        await runCase({ name: 'wall', parcels: [parcel({ positionM: [0, 0, 0] })] });
        await runCase({ name: 'two-level-wall', levels: 2, parcels: [parcel({ positionM: [0, 0, 0] })] });
        for (const [name, corrupt] of [['bad-mass', [3, 0xbf800000]], ['bad-density', [9, 0]],
          ['bad-phase', [13, 3]], ['bad-kind', [23, 3]], ['bad-initial-lineage', [18, 0]],
          ['bad-reserved', [11, 1]], ['bad-hole', [24 + 3, 1]], ['bad-position', [0, 0x7fc00000]]]) {
          await runCase({ name, corrupt });
        }
        await runCase({ name: 'eos-omitted-extension', corruptEos: 'omit' });
        await runCase({ name: 'eos-wrong-family', corruptEos: 42 });
        await runCase({ name: 'eos-wrong-generation', corruptEos: 43 });
        await runCase({ name: 'empty-sparse-reservoir', parcels: [] });
        await runCase({ name: 'owner-released-after-capture', releaseOwnerAfterCapture: true });
        await runCase({ name: 'unsealed-upload-family', unsealed: true });
        eos.destroySphSpatialGasLedgerEosGpu(device);
        await device.queue.onSubmittedWorkDone();
        return { cases, errors, adapter: { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture,
          fallback: adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter ?? false } };
      } finally { device.destroy(); }
    });
    if (evidencePath) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(evidencePath, JSON.stringify({
        schema: 'ulg-native-aerosol-free-volume-evidence.v1',
        capturedAt: new Date().toISOString(), elapsedMs: performance.now() - started, ...evidence
      }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    t.diagnostic(JSON.stringify({ adapter: evidence.adapter, cases: evidence.cases.length,
      evidencePath: evidencePath ?? null, elapsedMs: performance.now() - started }));
    assert.equal(evidence.adapter.fallback, false);
    assert.deepEqual(evidence.errors, []);
    const byName = Object.fromEntries(evidence.cases.map((entry) => [entry.name, entry]));
    const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected)
      <= 3e-5 * Math.max(1e-6, Math.abs(expected)), `${message}: ${actual} vs ${expected}`);
    const verify = (name, axis, total = 0.125, sparse = false) => {
      const result = byName[name];
      assert.equal(result.header[2], 3, name); assert.equal(result.header[3], 0, name);
      assert.equal(result.eosHeader[3], 0, name);
      assert.equal(result.cells.length, sparse ? 1 : 8, name);
      let occupied = 0;
      for (const cell of result.cells) {
        const expected = total * cell.grid.reduce((weight, coordinate) => weight * axis[coordinate], 1);
        near(cell.geometry, 1, `${name} geometric`); near(cell.condensed, expected, `${name} local occupied`);
        near(cell.volumeFree, 1 - expected, `${name} Vfree`);
        near(cell.free, 1 - expected, `${name} actual EOS denominator`);
        near(cell.pressure * cell.free, 8.31446261815324 * 300, `${name} p Vfree = n R T`);
        assert.equal(cell.volumeStatus, 3, name); assert.equal(cell.status, 1, name);
        occupied += cell.condensed;
      }
      near(occupied, sparse ? total * axis[0] ** 3 : total, `${name} covered inventory sum`);
    };
    // x=.25: B[-1,0,1]={1,22,9}/32. Ordered capacities at
    // [-1,0,1]={1/48,1/2,47/48}; node 1 gives W={23,24}/47.
    // Hence B W={161,27}/188, independently of the sparse resident keys.
    for (const name of ['one-level', 'split', 'material-and-population', 'remote',
      'owner-released-after-capture']) verify(name, [161 / 188, 27 / 188]);
    verify('sparse', [161 / 188, 27 / 188], 0.125, true);
    verify('carrier-and-aerosol', [161 / 188, 27 / 188], 0.1875);
    // Fine h=.5 at x=.25 gives B={.5,.5}; the canonical 2:1 A
    // gives coarse nodal weights {.75,.25}, then the same ordered W.
    verify('two-level', [41 / 47, 6 / 47]);
    verify('two-level-absent', [41 / 47, 6 / 47], 0);
    verify('wall', [44 / 47, 3 / 47]);
    verify('two-level-wall', [91 / 94, 3 / 94]);
    verify('absent', [161 / 188, 27 / 188], 0);
    verify('empty-sparse-reservoir', [161 / 188, 27 / 188], 0);
    for (const result of evidence.cases) {
      if (result.name === 'unsealed-upload-family') {
        assert.equal(result.hostRejected, true); assert.match(result.reason, /omitted|sealed/); continue;
      }
      assert.equal(result.noHostReadback, true, result.name);
      assert.equal(result.noSourceMutation, true, result.name);
      if (result.name === 'absent' || result.name === 'two-level-absent') {
        assert.equal(result.descriptor, null);
        assert.deepEqual(result.header.slice(35, 44), new Array(9).fill(0));
      } else {
        assert.equal(result.descriptor.version, 1); assert.equal(result.descriptor.capacity, 130);
        assert.equal(result.header[36], result.descriptor.familyId);
        assert.equal(result.header[37], result.descriptor.generation);
        assert.equal(result.header[39], 130, `${result.name} every sparse slot visited exactly once`);
      }
      if (result.name === 'wrong-level-spacing') {
        assert.ok(result.header[3] & 16, 'wrong input spacing rejects the actual moment authority');
        assert.equal(result.header[3] & 1024, 0, 'failure is upstream of aerosol occupancy');
        assert.ok(result.header[2] & 4); assert.equal(result.header[43], 0);
        assert.ok(result.eosHeader[3] !== 0);
        // ActiveSource rejects native spacing before either field traversal
        // starts. The downstream moments must reject that missing authority;
        // their per-candidate lineage counter must not pretend work ran.
        assert.equal(result.momentEvidence.length, 2);
        for (const moment of result.momentEvidence) {
          assert.equal(moment.fieldPrefix[2], 4, 'each field header fails closed');
          assert.equal(moment.fieldPrefix[34], 0, 'no admitted mechanics fields');
          assert.equal(moment.control[2], 4 | 16, 'each moment rejects the upstream field identity');
          assert.equal(moment.control[18], 0, 'no admitted moment fields');
          assert.equal(moment.control[32], 0, 'no candidate traversal began');
          assert.equal(moment.control[38], 0, 'no downstream per-candidate lineage check ran');
          assert.equal(moment.control[40], 0, 'no physical volume contributions were admitted');
        }
        assert.equal(result.momentEvidence[0].grid.gridSpacingM, 0.5);
        assert.ok(result.declaredLevelSpacings.every(([, spacing]) => spacing === 1));
      } else if (result.name.startsWith('bad-')) {
        assert.ok(result.header[3] & 1024, result.name); assert.ok(result.header[2] & 4, result.name);
        assert.equal(result.header[43], 0, result.name); assert.ok(result.eosHeader[3] !== 0, result.name);
      } else if (result.name.startsWith('eos-')) {
        assert.equal(result.header[3], 0, result.name); assert.ok(result.eosHeader[3] !== 0, result.name);
      } else if (result.name !== 'absent' && result.name !== 'two-level-absent') {
        assert.equal(result.header[43], result.header[4], result.name);
      }
    }
    t.diagnostic(JSON.stringify({ adapter: evidence.adapter, cases: evidence.cases.length,
      elapsedMs: performance.now() - started, numericScope: 'local occupied volume and actual EOS, not plume/kinetics validation' }));
  } finally { await browser.close(); }
});
