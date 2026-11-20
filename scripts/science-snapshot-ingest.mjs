// G7: ingest one raw scientific database download as an immutable versioned
// snapshot (operator step; the only step that ever needs the network is the
// download itself, done separately). Refuses to overwrite an existing version.
//   node scripts/science-snapshot-ingest.mjs <dataset> <version> <parser> <rawFile> <sourceUrl> <license> [retrievedAt]
// Cache: ULG_SCIENCE_SNAPSHOT_DIR (default ~/.cache/ulg/science-snapshots).
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { SCIENCE_SNAPSHOT_MANIFEST_SCHEMA, SCIENCE_SNAPSHOT_PARSERS, isScienceSnapshotPathSegment, sha256Hex } from '../src/tools/scienceReleaseAudit.js';

const [dataset, version, parserName, rawFile, sourceUrl, license, retrievedAt] = process.argv.slice(2);
if (!dataset || !version || !parserName || !rawFile || !sourceUrl || !license) {
  console.error('usage: <dataset> <version> <parser> <rawFile> <sourceUrl> <license> [retrievedAt]');
  process.exit(2);
}
if (![dataset, version].every(isScienceSnapshotPathSegment)) {
  console.error('dataset and version must be single path segments'); process.exit(2);
}
const parser = Object.hasOwn(SCIENCE_SNAPSHOT_PARSERS, parserName) ? SCIENCE_SNAPSHOT_PARSERS[parserName] : null;
if (!parser) { console.error(`unknown parser ${parserName}`); process.exit(2); }
const cacheDir = process.env.ULG_SCIENCE_SNAPSHOT_DIR || join(homedir(), '.cache/ulg/science-snapshots');
const dir = join(cacheDir, dataset, version);
if (await stat(dir).then(() => true, () => false)) { console.error(`${dir} exists; snapshots are immutable`); process.exit(3); }
const raw = await readFile(rawFile);
const records = parser.parse(raw.toString('utf8'));
if (!records.length) { console.error('snapshot contains no records'); process.exit(2); }
const recordsBytes = Buffer.from(JSON.stringify(records));
const rawName = `raw${extname(rawFile) || ''}`;
const manifest = {
  schema: SCIENCE_SNAPSHOT_MANIFEST_SCHEMA, dataset, version, sourceUrl, license,
  retrievedAt: retrievedAt || (await stat(rawFile)).mtime.toISOString(),
  parser: parserName, rawFile: rawName, originalFileName: basename(rawFile),
  rawSha256: sha256Hex(raw), recordsSha256: sha256Hex(recordsBytes),
  units: parser.units, recordCount: records.length
};
if (!Number.isFinite(Date.parse(manifest.retrievedAt)) || !license.trim()) {
  console.error('invalid retrieval timestamp or license'); process.exit(2);
}
try { if (!['https:', 'http:'].includes(new URL(sourceUrl).protocol)) throw new Error(); }
catch { console.error('source URL must use HTTP(S)'); process.exit(2); }
await mkdir(join(cacheDir, dataset), { recursive: true });
// The non-recursive mkdir is the atomic version claim. A prior stat alone
// cannot prevent two ingestion processes from overwriting the same version.
try { await mkdir(dir); }
catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.error(`${dir} exists; snapshots are immutable`); process.exit(3);
}
await writeFile(join(dir, rawName), raw, { flag: 'wx' });
await writeFile(join(dir, 'records.json'), recordsBytes, { flag: 'wx' });
await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
for (const name of [rawName, 'records.json', 'manifest.json']) await chmod(join(dir, name), 0o444);
await chmod(dir, 0o555);
console.log(JSON.stringify({ dir, recordCount: records.length, rawSha256: manifest.rawSha256 }));
