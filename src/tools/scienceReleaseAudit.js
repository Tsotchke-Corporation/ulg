// G7 (seven-goal-campaign.md): the operator-side, offline, advisory
// scientific release audit.
//
// Immutable versioned snapshots of real scientific databases live in a local
// cache: <dir>/<dataset>/<version>/{raw.*, records.json, manifest.json}. The
// manifest binds the source URL, retrieval time, license, parser, explicit
// units and SHA-256 hashes of the raw bytes and normalized records. The audit
// never touches the network: it verifies the cache, then compares the ULG
// material property bank against the snapshot records and reports deviations
// with their uncertainty. The report is advisory: scientific disagreement is
// data, never a failure, and nothing here is runtime authority or a
// workflow blocker. Integrity faults (hash, provenance, units, missing data)
// are reported as faults so an operator can trust or distrust the comparison.
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const SCIENCE_SNAPSHOT_MANIFEST_SCHEMA = 'peercompute.ulg.science-snapshot-manifest.v1';
export const SCIENCE_RELEASE_AUDIT_REPORT_SCHEMA = 'peercompute.ulg.science-release-audit-report.v1';
const REQUIRED_MANIFEST_FIELDS = ['schema', 'dataset', 'version', 'sourceUrl', 'retrievedAt', 'license',
  'parser', 'rawFile', 'rawSha256', 'recordsSha256', 'units', 'recordCount'];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isScienceSnapshotPathSegment = (value) => typeof value === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

// ---------------------------------------------------------------- parsers

const numberOrNull = (text) => {
  const value = Number(String(text ?? '').trim());
  return String(text ?? '').trim() !== '' && Number.isFinite(value) ? value : null;
};

/** PubChem PUG REST periodic table (JSON). Units: u, K, K, g/cm^3 -> kg/m^3. */
export function parsePubchemPeriodicTable(rawText) {
  const table = JSON.parse(rawText)?.Table;
  const columns = table?.Columns?.Column;
  if (!Array.isArray(columns) || !Array.isArray(table?.Row)) throw new TypeError('not a PubChem periodic table');
  return table.Row.map(({ Cell }) => {
    const row = Object.fromEntries(columns.map((name, i) => [name, Cell[i]]));
    const density = numberOrNull(row.Density);
    return {
      symbol: row.Symbol,
      atomicNumber: numberOrNull(row.AtomicNumber),
      atomicWeightU: numberOrNull(row.AtomicWeight),
      meltingPointK: numberOrNull(row.MeltingPoint),
      boilingPointK: numberOrNull(row.BoilingPoint),
      densityKgPerM3: density == null ? null : density * 1000,
      standardState: row.StandardState || null
    };
  });
}

// "55.845(2)" -> { value, uncertainty }; "[1.00784,1.00811]" -> midpoint/half-width; "[209]" -> value only.
export function parseNistValueWithUncertainty(text) {
  const t = String(text ?? '').replace(/&nbsp;/g, '').trim();
  let m = /^\[([\d.]+),\s*([\d.]+)\]$/.exec(t);
  if (m) { const a = Number(m[1]), b = Number(m[2]); return { value: (a + b) / 2, uncertainty: (b - a) / 2, kind: 'interval' }; }
  m = /^\[?([\d.]+)\]?$/.exec(t);
  if (m) return { value: Number(m[1]), uncertainty: null, kind: t.startsWith('[') ? 'mass-number' : 'value' };
  m = /^([\d]+)\.?([\d]*)\((\d+)\)$/.exec(t);
  if (m) {
    const decimals = m[2].length;
    return { value: Number(`${m[1]}.${m[2] || '0'}`), uncertainty: Number(m[3]) * 10 ** -decimals, kind: 'concise' };
  }
  return null;
}

/** NIST "Atomic Weights and Isotopic Compositions" ascii2 output. Unit: u. */
export function parseNistAtomicWeights(rawText) {
  const bySymbol = new Map();
  for (const block of String(rawText).split(/\n\s*\n/)) {
    const symbol = /Atomic Symbol = (\w+)/.exec(block)?.[1];
    const z = Number(/Atomic Number = (\d+)/.exec(block)?.[1]);
    const weight = /Standard Atomic Weight = ([^\n]*)/.exec(block)?.[1];
    if (!symbol || !Number.isFinite(z) || bySymbol.has(symbol) || weight == null) continue;
    // Isotope symbols (D, T) share Z with H; keep the element row only.
    if (symbol === 'D' || symbol === 'T') continue;
    const parsed = parseNistValueWithUncertainty(weight);
    bySymbol.set(symbol, { symbol, atomicNumber: z,
      standardAtomicWeightU: parsed?.value ?? null, standardAtomicWeightUncertaintyU: parsed?.uncertainty ?? null,
      standardAtomicWeightKind: parsed?.kind ?? 'missing' });
  }
  return [...bySymbol.values()];
}

export const SCIENCE_SNAPSHOT_PARSERS = Object.freeze({
  'pubchem-periodic-table-json': { parse: parsePubchemPeriodicTable,
    units: { atomicWeightU: 'u', meltingPointK: 'K', boilingPointK: 'K', densityKgPerM3: 'kg/m^3' } },
  'nist-atomic-weights-ascii2': { parse: parseNistAtomicWeights,
    units: { standardAtomicWeightU: 'u', standardAtomicWeightUncertaintyU: 'u' } }
});

// ---------------------------------------------------------------- snapshots

/** Load and verify one snapshot version directory. Faults are returned, never thrown. */
export async function loadScienceSnapshot(versionDir) {
  const faults = [];
  let manifest = null, records = null;
  try { manifest = JSON.parse(await readFile(join(versionDir, 'manifest.json'), 'utf8')); }
  catch (error) { return { manifest: null, records: null, faults: [{ kind: 'cache', detail: `manifest unreadable: ${error.message}` }] }; }
  if (!isRecord(manifest)) {
    return { manifest: null, records: null, faults: [{ kind: 'provenance', detail: 'manifest must be an object' }] };
  }
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] == null || manifest[field] === '') faults.push({ kind: 'provenance', detail: `manifest.${field} missing` });
  }
  const invalidTextFields = REQUIRED_MANIFEST_FIELDS.filter((field) => field !== 'units' && field !== 'recordCount'
    && typeof manifest[field] !== 'string');
  if (invalidTextFields.length) {
    for (const field of invalidTextFields) faults.push({ kind: 'provenance', detail: `manifest.${field} must be text` });
  }
  if (manifest.schema && manifest.schema !== SCIENCE_SNAPSHOT_MANIFEST_SCHEMA) {
    faults.push({ kind: 'provenance', detail: `unknown manifest schema ${JSON.stringify(manifest.schema)}` });
  }
  const parser = typeof manifest.parser === 'string' && Object.hasOwn(SCIENCE_SNAPSHOT_PARSERS, manifest.parser)
    ? SCIENCE_SNAPSHOT_PARSERS[manifest.parser] : null;
  if (!parser) faults.push({ kind: 'provenance', detail: `unknown parser ${JSON.stringify(manifest.parser)}` });
  for (const field of ['dataset', 'version', 'rawFile']) {
    if (!isScienceSnapshotPathSegment(manifest[field])) faults.push({ kind: 'provenance', detail: `manifest.${field} must be a single path segment` });
  }
  for (const field of ['rawSha256', 'recordsSha256']) {
    if (typeof manifest[field] !== 'string' || !/^[a-f0-9]{64}$/.test(manifest[field])) {
      faults.push({ kind: 'provenance', detail: `manifest.${field} must be a SHA-256 hex digest` });
    }
  }
  if (typeof manifest.license !== 'string' || !manifest.license.trim()) {
    faults.push({ kind: 'provenance', detail: 'manifest.license must be nonempty text' });
  }
  try {
    if (typeof manifest.sourceUrl !== 'string' || !['https:', 'http:'].includes(new URL(manifest.sourceUrl).protocol)) throw new Error();
  } catch { faults.push({ kind: 'provenance', detail: 'manifest.sourceUrl must be an HTTP(S) URL' }); }
  if (typeof manifest.retrievedAt !== 'string' || !Number.isFinite(Date.parse(manifest.retrievedAt))) {
    faults.push({ kind: 'provenance', detail: 'manifest.retrievedAt must be a timestamp' });
  }
  if (!Number.isSafeInteger(manifest.recordCount) || manifest.recordCount < 1) {
    faults.push({ kind: 'cache', detail: 'recordCount must be a positive integer' });
  }
  try {
    if (!isScienceSnapshotPathSegment(manifest.rawFile)) throw new Error('invalid raw file name');
    const raw = await readFile(join(versionDir, manifest.rawFile ?? 'raw'));
    if (sha256Hex(raw) !== manifest.rawSha256) faults.push({ kind: 'cache', detail: 'raw bytes do not match rawSha256' });
    const recordsBytes = await readFile(join(versionDir, 'records.json'));
    if (sha256Hex(recordsBytes) !== manifest.recordsSha256) faults.push({ kind: 'cache', detail: 'records.json does not match recordsSha256' });
    records = JSON.parse(recordsBytes.toString('utf8'));
    if (!Array.isArray(records) || records.length === 0 || records.some((record) => !isRecord(record))) {
      faults.push({ kind: 'cache', detail: 'records.json must contain a nonempty array of records' });
    }
    // The normalized records must be exactly what the declared parser makes of the raw bytes.
    if (parser && JSON.stringify(parser.parse(raw.toString('utf8'))) !== JSON.stringify(records)) {
      faults.push({ kind: 'cache', detail: 'records.json is not the declared parser output of the raw bytes' });
    }
  } catch (error) {
    faults.push({ kind: 'cache', detail: `snapshot files unreadable: ${error.message}` });
  }
  if (!isRecord(manifest.units)) faults.push({ kind: 'units', detail: 'manifest.units must be an object' });
  if (parser && isRecord(manifest.units)) {
    for (const [field, unit] of Object.entries(parser.units)) {
      if (manifest.units[field] !== unit) faults.push({ kind: 'units', detail: `${field} declared ${typeof manifest.units[field] === 'string' ? manifest.units[field] : JSON.stringify(manifest.units[field])}, parser emits ${unit}` });
    }
  }
  if (Array.isArray(records) && manifest.recordCount !== records.length) {
    faults.push({ kind: 'cache', detail: `recordCount ${JSON.stringify(manifest.recordCount)} != ${records.length}` });
  }
  return { manifest, records, faults };
}

/** Every version of every dataset in a cache directory. */
export async function loadScienceSnapshotCache(cacheDir) {
  const snapshots = [];
  const faults = [];
  let datasets = [];
  try { datasets = await readdir(cacheDir, { withFileTypes: true }); } catch { return { snapshots, faults: [{ kind: 'cache', detail: `cache ${cacheDir} unreadable` }] }; }
  for (const dataset of datasets.filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    let versions = [];
    try { versions = await readdir(join(cacheDir, dataset), { withFileTypes: true }); }
    catch { faults.push({ kind: 'cache', detail: `dataset ${dataset} unreadable` }); continue; }
    for (const version of versions.filter((v) => v.isDirectory()).map((v) => v.name).sort()) {
      const loaded = await loadScienceSnapshot(join(cacheDir, dataset, version));
      if (loaded.manifest && (loaded.manifest.dataset !== dataset || loaded.manifest.version !== version)) {
        loaded.faults.push({ kind: 'provenance', detail: 'manifest dataset/version does not match its cache directory' });
      }
      snapshots.push({ dataset, version, dir: join(cacheDir, dataset, version), ...loaded });
    }
  }
  if (!snapshots.length) faults.push({ kind: 'cache', detail: 'cache contains no snapshot versions' });
  return { snapshots, faults };
}

// ---------------------------------------------------------------- audit

const DEFAULT_TOLERANCES = Object.freeze({ atomicMass: 1e-3, meltingPoint: 0.02, boilingPoint: 0.02, density: 0.05 });

function compare({ element, property, unit, ulg, reference, uncertainty = null, source, tolerance }) {
  if (ulg == null || reference == null) {
    return { element, property, unit, source, status: 'missing-data', ulg, reference,
      missing: ulg == null ? 'ulg' : 'reference' };
  }
  const deviation = ulg - reference;
  const relative = deviation / Math.max(Math.abs(reference), 1e-300);
  const allowance = Math.max(uncertainty ?? 0, Math.abs(reference) * tolerance);
  return { element, property, unit, source, ulg, reference, uncertainty, deviation, relativeDeviation: relative,
    status: Math.abs(deviation) <= allowance ? 'agrees' : 'deviates', allowance };
}

function referenceStatePhase(record, temperatureK) {
  return (record.phases ?? []).find(({ temperatureRangeK: [lo, hi] = [] }) => temperatureK >= lo && temperatureK <= hi) ?? null;
}

/**
 * Compare the material property bank's element records with the snapshots.
 * Advisory: returns a report; never throws on scientific disagreement.
 */
export function auditElementBank({ bank, snapshots, tolerances = DEFAULT_TOLERANCES, generatedAt = new Date().toISOString() }) {
  const usable = snapshots.filter((s) => s.faults.length === 0 && Array.isArray(s.records) && s.records.length > 0);
  const byDataset = (name) => usable.filter((s) => s.manifest?.parser === name).at(-1) ?? null;
  const pubchem = byDataset('pubchem-periodic-table-json');
  const nist = byDataset('nist-atomic-weights-ascii2');
  const pubchemBySymbol = new Map((pubchem?.records ?? []).map((r) => [r.symbol, r]));
  const nistBySymbol = new Map((nist?.records ?? []).map((r) => [r.symbol, r]));
  const comparisons = [];
  for (const record of bank.records ?? []) {
    const symbol = record.symbol;
    const p = pubchemBySymbol.get(symbol) ?? null;
    const n = nistBySymbol.get(symbol) ?? null;
    {
      comparisons.push(compare({ element: symbol, property: 'atomicMass', unit: 'u', ulg: record.atomicMassU ?? null,
        reference: n?.standardAtomicWeightU ?? null, uncertainty: n?.standardAtomicWeightUncertaintyU ?? null,
        source: nist ? `${nist.dataset}@${nist.version}` : 'nist-atomic-weights@missing', tolerance: tolerances.atomicMass }));
    }
    {
      const melting = (record.transitions ?? []).find((t) => t.name === 'melting')?.temperatureK ?? null;
      const boiling = (record.transitions ?? []).find((t) => t.name === 'boiling')?.temperatureK ?? null;
      const phase = referenceStatePhase(record, record.referenceState?.temperatureK ?? 293.15);
      const source = pubchem ? `${pubchem.dataset}@${pubchem.version}` : 'pubchem-periodic-table@missing';
      comparisons.push(compare({ element: symbol, property: 'meltingPoint', unit: 'K', ulg: melting,
        reference: p?.meltingPointK ?? null, source, tolerance: tolerances.meltingPoint }));
      comparisons.push(compare({ element: symbol, property: 'boilingPoint', unit: 'K', ulg: boiling,
        reference: p?.boilingPointK ?? null, source, tolerance: tolerances.boilingPoint }));
      // PubChem quotes gas densities at 273.15 K and 1 atm; the bank's
      // reference state is 293.15 K. Rescale an ideal gas to the reference's
      // state rather than report the 7% reference-state difference.
      const gas = p?.standardState === 'Gas' && phase?.name === 'gas';
      const bankTemperatureK = record.referenceState?.temperatureK ?? 293.15;
      const density = compare({ element: symbol, property: 'density', unit: 'kg/m^3',
        ulg: phase?.densityKgPerM3 == null ? null : phase.densityKgPerM3 * (gas ? bankTemperatureK / 273.15 : 1),
        reference: p?.densityKgPerM3 ?? null, source, tolerance: tolerances.density });
      if (gas) density.referenceStateAdjustment = `ideal-gas ${bankTemperatureK} K -> 273.15 K`;
      comparisons.push(density);
    }
  }
  const counts = comparisons.reduce((acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, {});
  const faults = snapshots.flatMap((s) => s.faults.map((f) => ({ ...f, snapshot: `${s.dataset}@${s.version}` })));
  for (const [name, snapshot] of [['nist-atomic-weights', nist], ['pubchem-periodic-table', pubchem]]) {
    if (!snapshot) faults.push({ kind: 'missing-data', snapshot: name, detail: 'no verified reference snapshot available' });
  }
  return {
    schema: SCIENCE_RELEASE_AUDIT_REPORT_SCHEMA,
    advisory: true,
    runtimeAuthority: false,
    blocksWorkflow: false,
    generatedAt,
    bank: { schema: bank.schema, generatorFingerprint: bank.generatorFingerprint ?? null, recordCount: bank.records?.length ?? 0 },
    snapshots: snapshots.map((s) => ({ dataset: s.dataset, version: s.version, sourceUrl: s.manifest?.sourceUrl ?? null,
      retrievedAt: s.manifest?.retrievedAt ?? null, rawSha256: s.manifest?.rawSha256 ?? null, faultCount: s.faults.length })),
    integrity: { ok: faults.length === 0, faults },
    tolerances,
    counts,
    comparisons,
    largestDeviations: comparisons.filter((c) => c.status === 'deviates')
      .sort((a, b) => Math.abs(b.relativeDeviation) - Math.abs(a.relativeDeviation)).slice(0, 25)
  };
}

export function renderScienceAuditMarkdown(report) {
  const lines = [
    '# ULG scientific release audit (advisory)', '',
    `Generated ${report.generatedAt}. Advisory only: disagreement is information, not a failure; nothing here gates runtime or workflows.`, '',
    `Bank: \`${report.bank.schema}\` (${report.bank.recordCount} records, generator ${report.bank.generatorFingerprint}).`, '',
    '## Snapshots', '',
    '| Dataset | Version | Retrieved | SHA-256 (raw) | Faults |', '| --- | --- | --- | --- | --- |',
    ...report.snapshots.map((s) => `| ${s.dataset} | ${s.version} | ${s.retrievedAt} | \`${String(s.rawSha256).slice(0, 16)}…\` | ${s.faultCount} |`), '',
    `## Integrity: ${report.integrity.ok ? 'no faults' : `${report.integrity.faults.length} fault(s)`}`, '',
    ...report.integrity.faults.map((f) => `- ${f.snapshot}: ${f.kind}: ${f.detail}`), '',
    '## Results', '',
    ...Object.entries(report.counts).map(([status, count]) => `- ${status}: ${count}`), '',
    '## Largest deviations', '',
    '| Element | Property | ULG | Reference | Relative | Uncertainty | Source |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...report.largestDeviations.map((c) => `| ${c.element} | ${c.property} (${c.unit}) | ${c.ulg} | ${c.reference} | ${(100 * c.relativeDeviation).toFixed(2)}% | ${c.uncertainty ?? '—'} | ${c.source} |`)
  ];
  return `${lines.join('\n')}\n`;
}
