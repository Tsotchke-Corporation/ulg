// G7: the offline, advisory scientific release audit. Reads only the local
// snapshot cache and the material property bank; never the network. Writes a
// JSON and a Markdown report; always exits 0 (advisory, not a gate).
//   node scripts/science-release-audit.mjs [outDir]
// Cache: ULG_SCIENCE_SNAPSHOT_DIR (default ~/.cache/ulg/science-snapshots).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { auditElementBank, loadScienceSnapshotCache, renderScienceAuditMarkdown } from '../src/tools/scienceReleaseAudit.js';

// Offline by construction: any network use in this process is a defect.
globalThis.fetch = () => { throw new Error('the release audit is offline'); };
const cacheDir = process.env.ULG_SCIENCE_SNAPSHOT_DIR || join(homedir(), '.cache/ulg/science-snapshots');
const outDir = process.argv[2] || join(homedir(), '.cache/ulg/science-audit-reports', new Date().toISOString().replace(/[:.]/g, '-'));
const bank = JSON.parse(await readFile(new URL('../data/material-properties/elements.json', import.meta.url), 'utf8'));
const { snapshots, faults } = await loadScienceSnapshotCache(cacheDir);
const report = auditElementBank({ bank, snapshots });
report.integrity.faults.push(...faults);
report.integrity.ok = report.integrity.faults.length === 0;
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(outDir, 'report.md'), renderScienceAuditMarkdown(report));
console.log(JSON.stringify({ outDir, integrityOk: report.integrity.ok, faults: report.integrity.faults.length, counts: report.counts }));
