#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonOutput = args.includes('--json');
const moonlabOnly = args.includes('--moonlab-only');
const eshkolOnly = args.includes('--eshkol-only');
const projectsRoot = valueFor('--projects-root')
  || process.env.ULG_PROJECTS_ROOT
  || path.resolve(repoRoot, '..');
const createdAt = valueFor('--created-at') || process.env.ULG_STAGE_CREATED_AT || null;

const moonlabCoreRoot = path.join(projectsRoot, 'moonlab', 'bindings', 'javascript', 'packages', 'core');
const eshkolRoot = path.join(projectsRoot, 'eshkol');
const moonlabTargetDir = path.join(repoRoot, 'public', 'service-assets', 'moonlab');
const eshkolTargetDir = path.join(repoRoot, 'public', 'service-assets', 'eshkol', 'closures', 'hello');

const ESHKOL_HELLO_VALIDATION = {
  status: 'pass',
  validationMode: 'eshkol-static-closure-smoke',
  outputSemantics: {
    schema: 'eshkol.ulg.closure-output-semantics.v0',
    semanticScope: 'smoke-fixture',
    scientificScope: 'none',
    scientificValidation: false,
    entryExport: 'main',
    entryArgs: [0, 0],
    expectedEntryResult: 0,
    stdout: {
      encoding: 'utf-8',
      expectedText: '1048560\n1048544\n',
      sha256: 'sha256:675d2e8686b6a85ffaa5751fba535c108d23ba941f1890d0a102619ec2cdf20d',
      byteLength: 16
    },
    notes: [
      'Validates deterministic Eshkol hello runtime output only.',
      'Does not validate magnetar closure physics.'
    ]
  }
};

function valueFor(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function ensureFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function copyAsset(source, target, label) {
  ensureFile(source, label);
  if (!dryRun) {
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  return {
    label,
    source,
    target,
    byteLength: statSync(source).size,
    action: dryRun ? 'would-copy' : 'copied'
  };
}

function stageMoonLabAssets() {
  const staged = [
    copyAsset(
      path.join(moonlabCoreRoot, 'dist', 'moonlab.js'),
      path.join(moonlabTargetDir, 'moonlab.js'),
      'MoonLab browser loader'
    ),
    copyAsset(
      path.join(moonlabCoreRoot, 'dist', 'moonlab.wasm'),
      path.join(moonlabTargetDir, 'moonlab.wasm'),
      'MoonLab WASM module'
    ),
    copyAsset(
      path.join(moonlabCoreRoot, 'references', 'magnetar-calibrated-reference-contracts.json'),
      path.join(moonlabTargetDir, 'magnetar-reference-contracts.json'),
      'MoonLab magnetar reference contracts'
    )
  ];

  if (!dryRun) {
    const contractPath = path.join(moonlabTargetDir, 'magnetar-reference-contracts.json');
    const suite = JSON.parse(readFileSync(contractPath, 'utf8'));
    const references = Array.isArray(suite.references) ? suite.references : [];
    if (references.length !== 3) {
      throw new Error(`expected 3 supplied MoonLab references, found ${references.length}`);
    }
  }
  return staged;
}

function stageEshkolAssets() {
  const helper = path.join(eshkolRoot, 'scripts', 'export_ulg_closure_bundle.py');
  const input = path.join(eshkolRoot, 'examples', 'hello.esk');
  const eshkolRun = valueFor('--eshkol-run') || process.env.ESHKOL_RUN || path.join(eshkolRoot, 'build', 'eshkol-run');
  ensureFile(helper, 'Eshkol closure bundle helper');
  ensureFile(input, 'Eshkol hello source');
  ensureFile(eshkolRun, 'eshkol-run binary');

  const command = [
    'python3',
    helper,
    input,
    '--eshkol-run',
    eshkolRun,
    '--output-dir',
    eshkolTargetDir,
    '--name',
    'hello',
    '--validation-json',
    JSON.stringify(ESHKOL_HELLO_VALIDATION)
  ];
  if (createdAt != null) {
    command.push('--created-at', createdAt);
  }

  if (!dryRun) {
    mkdirSync(eshkolTargetDir, { recursive: true });
    const result = spawnSync(command[0], command.slice(1), {
      cwd: eshkolRoot,
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      throw new Error([
        `Eshkol bundle export failed with status ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim()
      ].filter(Boolean).join('\n'));
    }

    const artifactPath = path.join(eshkolTargetDir, 'hello.ulg.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    if (artifact.validation?.outputSemantics?.schema !== 'eshkol.ulg.closure-output-semantics.v0') {
      throw new Error('Eshkol staged artifact is missing output-semantics metadata');
    }
  }

  return {
    label: 'Eshkol hello closure bundle',
    source: input,
    target: eshkolTargetDir,
    command,
    action: dryRun ? 'would-export' : 'exported'
  };
}

function main() {
  if (moonlabOnly && eshkolOnly) {
    throw new Error('choose at most one of --moonlab-only or --eshkol-only');
  }
  const staged = [];
  if (!eshkolOnly) staged.push(...stageMoonLabAssets());
  if (!moonlabOnly) staged.push(stageEshkolAssets());

  const summary = {
    schema: 'ulg.service-assets.staging.v0',
    repoRoot,
    projectsRoot,
    createdAt,
    dryRun,
    staged
  };
  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  for (const item of staged) {
    console.log(`${item.action}: ${item.label}`);
    console.log(`  source: ${item.source}`);
    console.log(`  target: ${item.target}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
