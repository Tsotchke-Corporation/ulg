import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SCIENCE_SNAPSHOT_MANIFEST_SCHEMA,
  SCIENCE_SNAPSHOT_PARSERS,
  auditElementBank,
  loadScienceSnapshot,
  loadScienceSnapshotCache,
  parseNistValueWithUncertainty,
  sha256Hex
} from '../src/tools/scienceReleaseAudit.js';

// G7: integrity, provenance, unit and missing-data faults are detected; the
// report is advisory; nothing touches the network.
const PUBCHEM_RAW = JSON.stringify({ Table: {
  Columns: { Column: ['AtomicNumber', 'Symbol', 'Name', 'AtomicWeight', 'StandardState', 'MeltingPoint', 'BoilingPoint', 'Density'] },
  Row: [
    { Cell: ['26', 'Fe', 'Iron', '55.84', 'Solid', '1811', '3134', '7.874'] },
    { Cell: ['8', 'O', 'Oxygen', '15.999', 'Gas', '54.36', '90.2', '0.001429'] },
    { Cell: ['80', 'Hg', 'Mercury', '200.59', 'Liquid', '234.32', '629.88', '13.5336'] }
  ] } });
const NIST_RAW = ['Atomic Number = 26\nAtomic Symbol = Fe\nMass Number = 56\nStandard Atomic Weight = 55.845(2)\n',
  'Atomic Number = 8\nAtomic Symbol = O\nMass Number = 16\nStandard Atomic Weight = [15.99903,15.99977]\n',
  'Atomic Number = 84\nAtomic Symbol = Po\nMass Number = 209\nStandard Atomic Weight = \n'].join('\n');
const BANK = { schema: 'test-bank', generatorFingerprint: 'test', records: [
  { symbol: 'Fe', atomicMassU: 55.845, referenceState: { temperatureK: 293.15 },
    phases: [{ name: 'solid', temperatureRangeK: [0, 1811], densityKgPerM3: 7874 }],
    transitions: [{ name: 'melting', temperatureK: 1811 }, { name: 'boiling', temperatureK: 3134 }] },
  { symbol: 'O', atomicMassU: 15.999, referenceState: { temperatureK: 293.15 },
    phases: [{ name: 'gas', temperatureRangeK: [90.2, 2000], densityKgPerM3: 1.331 }],
    transitions: [{ name: 'boiling', temperatureK: 90.188 }] },
  { symbol: 'Hg', atomicMassU: 200.59, referenceState: { temperatureK: 293.15 },
    phases: [{ name: 'liquid', temperatureRangeK: [234.32, 629.88], densityKgPerM3: 13534 }],
    transitions: [{ name: 'melting', temperatureK: 2376.6 }, { name: 'boiling', temperatureK: 629.88 }] }
] };

async function writeSnapshot(root, dataset, parserName, raw) {
  const dir = join(root, dataset, 'v1');
  await mkdir(dir, { recursive: true });
  const records = SCIENCE_SNAPSHOT_PARSERS[parserName].parse(raw);
  const recordsBytes = Buffer.from(JSON.stringify(records));
  await writeFile(join(dir, 'raw.txt'), raw);
  await writeFile(join(dir, 'records.json'), recordsBytes);
  const manifest = { schema: SCIENCE_SNAPSHOT_MANIFEST_SCHEMA, dataset, version: 'v1', sourceUrl: 'https://example.invalid/',
    retrievedAt: '2026-11-14T00:00:00Z', license: 'test', parser: parserName, rawFile: 'raw.txt',
    rawSha256: sha256Hex(Buffer.from(raw)), recordsSha256: sha256Hex(recordsBytes),
    units: SCIENCE_SNAPSHOT_PARSERS[parserName].units, recordCount: records.length };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  return { dir, manifest };
}

test('NIST concise and interval uncertainties parse', () => {
  assert.deepEqual(parseNistValueWithUncertainty('55.845(2)'), { value: 55.845, uncertainty: 0.002, kind: 'concise' });
  const o = parseNistValueWithUncertainty('[15.99903,15.99977]');
  assert.equal(o.kind, 'interval');
  assert.ok(Math.abs(o.value - 15.9994) < 1e-9 && Math.abs(o.uncertainty - 0.00037) < 1e-9);
  assert.equal(parseNistValueWithUncertainty('[209]').kind, 'mass-number');
  assert.equal(parseNistValueWithUncertainty(''), null);
});

test('clean snapshots audit offline and advisory; deviations and missing data are reported', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ulg-science-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeSnapshot(root, 'pubchem', 'pubchem-periodic-table-json', PUBCHEM_RAW);
  await writeSnapshot(root, 'nist', 'nist-atomic-weights-ascii2', NIST_RAW);
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('network used'); };
  try {
    const { snapshots } = await loadScienceSnapshotCache(root);
    const report = auditElementBank({ bank: BANK, snapshots });
    assert.equal(report.integrity.ok, true, JSON.stringify(report.integrity.faults));
    assert.deepEqual([report.advisory, report.runtimeAuthority, report.blocksWorkflow], [true, false, false]);
    const find = (element, property) => report.comparisons.find((c) => c.element === element && c.property === property);
    assert.equal(find('Fe', 'atomicMass').status, 'agrees');
    assert.equal(find('Fe', 'atomicMass').uncertainty, 0.002);
    assert.equal(find('Hg', 'meltingPoint').status, 'deviates', 'a 10x melting point is reported, not thrown');
    assert.equal(find('O', 'meltingPoint').status, 'missing-data');
    assert.equal(find('O', 'meltingPoint').missing, 'ulg');
    assert.equal(find('O', 'density').status, 'agrees', 'gas density compared at the reference state');
    assert.match(find('O', 'density').referenceStateAdjustment, /273.15/);
    assert.equal(find('Hg', 'atomicMass').status, 'missing-data', 'NIST snapshot has no Hg row');
    assert.equal(report.largestDeviations[0].element, 'Hg');
  } finally { globalThis.fetch = realFetch; }
});

test('cache, provenance and unit faults are detected', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ulg-science-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // Raw bytes changed after ingestion.
  const tampered = await writeSnapshot(root, 'raw-tamper', 'pubchem-periodic-table-json', PUBCHEM_RAW);
  await writeFile(join(tampered.dir, 'raw.txt'), PUBCHEM_RAW.replace('1811', '1911'));
  const rawFault = await loadScienceSnapshot(tampered.dir);
  assert.ok(rawFault.faults.some((f) => f.kind === 'cache' && /rawSha256/.test(f.detail)));
  assert.ok(rawFault.faults.some((f) => /declared parser output/.test(f.detail)));
  // Records edited with a self-consistent hash still differ from the parser output.
  const forged = await writeSnapshot(root, 'records-forge', 'pubchem-periodic-table-json', PUBCHEM_RAW);
  const records = JSON.parse(await readFile(join(forged.dir, 'records.json'), 'utf8'));
  records[0].meltingPointK = 9999;
  const forgedBytes = Buffer.from(JSON.stringify(records));
  await writeFile(join(forged.dir, 'records.json'), forgedBytes);
  await writeFile(join(forged.dir, 'manifest.json'), JSON.stringify({ ...forged.manifest, recordsSha256: sha256Hex(forgedBytes) }));
  const forgeFault = await loadScienceSnapshot(forged.dir);
  assert.deepEqual(forgeFault.faults.map((f) => f.detail), ['records.json is not the declared parser output of the raw bytes']);
  // Missing provenance and wrong units.
  const bad = await writeSnapshot(root, 'bad-manifest', 'pubchem-periodic-table-json', PUBCHEM_RAW);
  await writeFile(join(bad.dir, 'manifest.json'), JSON.stringify({ ...bad.manifest, license: '', sourceUrl: undefined,
    units: { ...bad.manifest.units, meltingPointK: 'degC' } }));
  const badFault = await loadScienceSnapshot(bad.dir);
  assert.ok(badFault.faults.some((f) => f.kind === 'provenance' && /license/.test(f.detail)));
  assert.ok(badFault.faults.some((f) => f.kind === 'provenance' && /sourceUrl/.test(f.detail)));
  assert.ok(badFault.faults.some((f) => f.kind === 'units' && /meltingPointK declared degC/.test(f.detail)));
  // Missing manifest entirely.
  await rm(join(bad.dir, 'manifest.json'));
  assert.equal((await loadScienceSnapshot(bad.dir)).faults[0].kind, 'cache');
  // Faulted snapshots are still reported, with the audit flagging integrity.
  const { snapshots } = await loadScienceSnapshotCache(root);
  const report = auditElementBank({ bank: BANK, snapshots });
  assert.equal(report.integrity.ok, false);
  // raw-tamper (2), records-forge (1), bad-manifest now without a manifest (1).
  assert.equal(report.integrity.faults.filter((f) => f.kind !== 'missing-data').length, 4);
  assert.deepEqual([...new Set(report.integrity.faults.filter((f) => f.kind !== 'missing-data').map((f) => f.snapshot))].sort(),
    ['bad-manifest@v1', 'raw-tamper@v1', 'records-forge@v1']);
  assert.equal(report.counts['missing-data'], BANK.records.length * 4,
    'faulted snapshots cannot supply scientific comparisons');
});

test('malformed manifest values report faults without throwing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ulg-science-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = await writeSnapshot(root, 'nist', 'nist-atomic-weights-ascii2', NIST_RAW);
  for (const value of [null, [], true, 'manifest', 12]) {
    await writeFile(join(fixture.dir, 'manifest.json'), JSON.stringify(value));
    const result = await loadScienceSnapshot(fixture.dir);
    assert.equal(result.manifest, null);
    assert.match(result.faults[0].detail, /must be an object/);
  }
  for (const patch of [{ parser: 'toString' }, { rawFile: '../raw.txt' }, { units: null },
    { retrievedAt: 'yesterday' }, { sourceUrl: 'invalid' }, { license: {} }, { recordCount: 0 }]) {
    await writeFile(join(fixture.dir, 'manifest.json'), JSON.stringify({ ...fixture.manifest, ...patch }));
    const result = await loadScienceSnapshot(fixture.dir);
    assert.ok(result.faults.length > 0, JSON.stringify(patch));
  }
});

test('empty or partial caches expose absent references and never report a clean audit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ulg-science-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const empty = await loadScienceSnapshotCache(root);
  assert.ok(empty.faults.some((f) => /no snapshot/.test(f.detail)));
  let report = auditElementBank({ bank: BANK, snapshots: empty.snapshots });
  assert.equal(report.integrity.ok, false);
  assert.equal(report.counts['missing-data'], BANK.records.length * 4);
  assert.equal(report.integrity.faults.length, 2);
  await writeSnapshot(root, 'nist', 'nist-atomic-weights-ascii2', NIST_RAW);
  report = auditElementBank({ bank: BANK, snapshots: (await loadScienceSnapshotCache(root)).snapshots });
  assert.equal(report.integrity.ok, false);
  assert.equal(report.comparisons.find((c) => c.element === 'Fe' && c.property === 'atomicMass').status, 'agrees');
  assert.equal(report.comparisons.find((c) => c.element === 'Fe' && c.property === 'meltingPoint').status, 'missing-data');
  assert.deepEqual(report.integrity.faults.map((f) => f.snapshot), ['pubchem-periodic-table']);
});

test('snapshot provenance binds the cache identity and faults cannot silently override valid data', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ulg-science-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const good = await writeSnapshot(root, 'pubchem', 'pubchem-periodic-table-json', PUBCHEM_RAW);
  await writeSnapshot(root, 'nist', 'nist-atomic-weights-ascii2', NIST_RAW);
  const bad = await writeSnapshot(root, 'z-pubchem', 'pubchem-periodic-table-json', PUBCHEM_RAW.replace('1811', '9999'));
  await writeFile(join(bad.dir, 'manifest.json'), JSON.stringify({ ...bad.manifest, dataset: 'pubchem' }));
  const { snapshots } = await loadScienceSnapshotCache(root);
  const report = auditElementBank({ bank: BANK, snapshots });
  assert.equal(report.integrity.ok, false);
  assert.ok(report.integrity.faults.some((f) => /cache directory/.test(f.detail)));
  const melting = report.comparisons.find((c) => c.element === 'Fe' && c.property === 'meltingPoint');
  assert.equal(melting.reference, 1811);
  assert.equal(melting.source, `${good.manifest.dataset}@v1`);
});

const run = promisify(execFile);
const ingestScript = fileURLToPath(new URL('../scripts/science-snapshot-ingest.mjs', import.meta.url));
const auditScript = fileURLToPath(new URL('../scripts/science-release-audit.mjs', import.meta.url));

test('real ingestion processes cannot overwrite one immutable snapshot version', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ulg-science-'));
  t.after(async () => {
    await chmod(join(root, 'cache', 'pubchem', 'v1'), 0o755).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await rm(root, { recursive: true, force: true });
  });
  const cache = join(root, 'cache');
  const raw = join(root, 'source.json');
  await writeFile(raw, PUBCHEM_RAW);
  const env = { ...process.env, ULG_SCIENCE_SNAPSHOT_DIR: cache };
  const args = [ingestScript, 'pubchem', 'v1', 'pubchem-periodic-table-json', raw,
    'https://example.invalid/pubchem', 'test', '2026-11-18T00:00:00Z'];
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => run(process.execPath, args, { env })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  for (const result of results.filter((r) => r.status === 'rejected')) assert.equal(result.reason.code, 3);
  const dir = join(cache, 'pubchem', 'v1');
  const original = await readFile(join(dir, 'raw.json'));
  assert.equal(original.toString(), PUBCHEM_RAW);
  for (const name of ['raw.json', 'records.json', 'manifest.json']) assert.equal((await stat(join(dir, name))).mode & 0o222, 0);
  assert.equal((await loadScienceSnapshot(dir)).faults.length, 0);
  await writeFile(raw, PUBCHEM_RAW.replace('1811', '9999'));
  await assert.rejects(run(process.execPath, args, { env }), (error) => error.code === 3);
  assert.deepEqual(await readFile(join(dir, 'raw.json')), original);
  await assert.rejects(run(process.execPath, [ingestScript, '../escape', ...args.slice(2)], { env }), (error) => error.code === 2);
});

test('the actual audit CLI stays offline and advisory for clean, corrupt and empty caches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ulg-science-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = join(root, 'cache');
  const pubchem = await writeSnapshot(cache, 'pubchem', 'pubchem-periodic-table-json', PUBCHEM_RAW);
  await writeSnapshot(cache, 'nist', 'nist-atomic-weights-ascii2', NIST_RAW);
  const guard = join(root, 'deny-network.mjs');
  await writeFile(guard, `import http from 'node:http'; import https from 'node:https';
    import net from 'node:net'; import tls from 'node:tls'; import dgram from 'node:dgram';
    const deny = () => { throw new Error('network forbidden by acceptance test'); };
    globalThis.fetch = http.request = http.get = https.request = https.get = deny;
    net.connect = net.createConnection = net.Socket.prototype.connect = tls.connect = dgram.createSocket = deny;`);
  for (const mode of ['clean', 'corrupt', 'empty']) {
    if (mode === 'corrupt') await writeFile(join(pubchem.dir, 'manifest.json'), 'null');
    if (mode === 'empty') { await rm(cache, { recursive: true }); await mkdir(cache); }
    const out = join(root, mode);
    const { stdout } = await run(process.execPath, ['--import', guard, auditScript, out],
      { env: { ...process.env, ULG_SCIENCE_SNAPSHOT_DIR: cache } });
    const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8'));
    assert.equal(JSON.parse(stdout).integrityOk, mode === 'clean');
    assert.deepEqual([report.advisory, report.runtimeAuthority, report.blocksWorkflow], [true, false, false]);
    assert.ok(report.counts['missing-data'] > 0);
    assert.match(await readFile(join(out, 'report.md'), 'utf8'), /advisory/i);
  }
});
