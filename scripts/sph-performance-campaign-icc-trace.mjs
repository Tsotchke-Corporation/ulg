import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildAuthoritativeTwoLevelCampaignIccTrace,
  exactWorktreeFingerprint
} from './sph-performance-acceptance-campaign.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceRepoDir = path.resolve(scriptDir, '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function conversionFailureEvents(events, error) {
  const conversionError = error instanceof Error
    ? error.message
    : String(error);
  return events.map((event) => ({
    ...event,
    status: 'FAIL',
    value: 'FAIL',
    details: {
      ...event.details,
      authentic: false,
      conversionError
    },
    snippet:
      'The authoritative campaign artifact could not be parsed and authenticated.'
  }));
}

export async function convertCampaignReportToIccTrace({
  reportPath,
  outputPath = `${reportPath}.icc.jsonl`,
  repoDir = sourceRepoDir
}) {
  const resolvedReportPath = path.resolve(reportPath);
  const resolvedOutputPath = path.resolve(outputPath);
  if (resolvedReportPath === resolvedOutputPath) {
    throw new Error('ICC trace output must not overwrite the campaign report');
  }

  let bytes = null;
  let report = null;
  let currentWorktree = null;
  let conversionError = null;
  try {
    bytes = await readFile(resolvedReportPath);
    report = JSON.parse(bytes.toString('utf8'));
    currentWorktree = await exactWorktreeFingerprint(path.resolve(repoDir));
  } catch (error) {
    conversionError = error;
  }

  const baseEvents = buildAuthoritativeTwoLevelCampaignIccTrace(report, {
    reportPath: resolvedReportPath,
    artifactSha256: bytes == null ? null : sha256(bytes),
    expectedCandidateWorktree: currentWorktree,
    expectedCandidateRepoDir: path.resolve(repoDir)
  });
  const events = conversionError == null
    ? baseEvents
    : conversionFailureEvents(baseEvents, conversionError);
  const serialized = `${events
    .map((event) => JSON.stringify(event))
    .join('\n')}\n`;

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, serialized, 'utf8');

  return Object.freeze({
    reportPath: resolvedReportPath,
    outputPath: resolvedOutputPath,
    events: Object.freeze(events),
    allPassed: events.every((event) => event.status === 'PASS'),
    currentWorktree,
    conversionError: conversionError == null
      ? null
      : (
        conversionError instanceof Error
          ? conversionError.message
          : String(conversionError)
      )
  });
}

async function main() {
  const reportPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!reportPath || process.argv.length > 4) {
    throw new Error(
      'Usage: node scripts/sph-performance-campaign-icc-trace.mjs '
      + '<campaign-report.json> [trace-output.jsonl]'
    );
  }
  const result = await convertCampaignReportToIccTrace({
    reportPath,
    ...(outputPath == null ? {} : { outputPath })
  });
  process.stdout.write(`${JSON.stringify({
    reportPath: result.reportPath,
    outputPath: result.outputPath,
    allPassed: result.allPassed,
    currentSourceFingerprint:
      result.currentWorktree?.sourceFingerprint ?? null,
    conversionError: result.conversionError,
    statuses: result.events.map(({ name, status }) => ({ name, status }))
  }, null, 2)}\n`);
  if (!result.allPassed) process.exitCode = 1;
}

const executedAsScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (executedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 2;
  });
}
