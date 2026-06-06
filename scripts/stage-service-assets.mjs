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
const eshkolClosureBundleName = 'magnetar-closure';
const eshkolTargetDir = path.join(repoRoot, 'public', 'service-assets', 'eshkol', 'closures', eshkolClosureBundleName);

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

function stageMoonLabReferenceSuite() {
  const input = path.join(moonlabCoreRoot, 'references', 'magnetar-calibrated-reference-contracts.json');
  const target = path.join(moonlabTargetDir, 'magnetar-reference-contracts.json');
  ensureFile(input, 'MoonLab magnetar reference contracts');

  const command = [
    'pnpm',
    'ulg:artifact',
    '--',
    '--normalize-references',
    input,
    '--strict',
    '--out',
    target
  ];

  if (!dryRun) {
    mkdirSync(path.dirname(target), { recursive: true });
    const result = spawnSync(command[0], command.slice(1), {
      cwd: moonlabCoreRoot,
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      throw new Error([
        `MoonLab reference suite normalization failed with status ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim()
      ].filter(Boolean).join('\n'));
    }

    const suite = JSON.parse(readFileSync(target, 'utf8'));
    const references = Array.isArray(suite.references) ? suite.references : [];
    if (suite.schema !== 'moonlab.magnetar.normalized-reference-suite.v0') {
      throw new Error('MoonLab staged reference asset is missing normalized reference-suite schema');
    }
    if (suite.status !== 'reference-contract-suite-ready' || suite.ready !== true) {
      throw new Error(`MoonLab staged reference suite is not ready: ${suite.status || 'unknown'}`);
    }
    if (references.length !== 4 || references.some((reference) => reference.ready !== true)) {
      throw new Error(`expected 4 ready MoonLab references, found ${references.filter((reference) => reference.ready === true).length}/${references.length}`);
    }
  }

  return {
    label: 'MoonLab normalized magnetar reference suite',
    source: input,
    target,
    command,
    byteLength: dryRun ? null : statSync(target).size,
    action: dryRun ? 'would-normalize' : 'normalized'
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
    )
  ];
  staged.push(stageMoonLabReferenceSuite());
  return staged;
}

function stageEshkolAssets() {
  const helper = path.join(eshkolRoot, 'scripts', 'export_ulg_closure_bundle.py');
  const input = path.join(eshkolRoot, 'examples', 'magnetar_closure.esk');
  const metadata = path.join(eshkolRoot, 'examples', 'magnetar_closure.ulg-metadata.json');
  const eshkolRun = valueFor('--eshkol-run') || process.env.ESHKOL_RUN || path.join(eshkolRoot, 'build', 'eshkol-run');
  ensureFile(helper, 'Eshkol closure bundle helper');
  ensureFile(input, 'Eshkol magnetar closure source');
  ensureFile(metadata, 'Eshkol magnetar closure metadata');
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
    eshkolClosureBundleName,
    '--metadata-json',
    metadata,
    '--require-export',
    'main'
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

    const artifactPath = path.join(eshkolTargetDir, `${eshkolClosureBundleName}.ulg.json`);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    if (artifact.closureKind !== 'magnetar-closure-descriptor-fixture') {
      throw new Error(`Eshkol staged artifact has unexpected closure kind: ${artifact.closureKind || 'unknown'}`);
    }
    if (artifact.validation?.closureDescriptor?.schema !== 'eshkol.ulg.magnetar-closure-descriptor.v0') {
      throw new Error('Eshkol staged artifact is missing magnetar closure descriptor metadata');
    }
    if (artifact.validation?.closureDescriptor?.scientificValidation !== false) {
      throw new Error('Eshkol staged magnetar descriptor must not claim scientific validation');
    }
    if (artifact.execution?.module?.url !== `${eshkolClosureBundleName}.wasm`) {
      throw new Error(`Eshkol staged artifact has unexpected module URL: ${artifact.execution?.module?.url || 'unknown'}`);
    }
    if (artifact.execution?.serviceWorkerSafe !== true || artifact.validity?.requiresDynamicCode !== false) {
      throw new Error('Eshkol staged magnetar closure must remain service-worker-safe and dynamic-code-free');
    }
  }

  return {
    label: 'Eshkol magnetar closure descriptor bundle',
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
