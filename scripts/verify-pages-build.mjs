#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const REQUIRED_SERVICE_ASSETS = Object.freeze([
  'service-assets/moonlab/moonlab.js',
  'service-assets/moonlab/moonlab.wasm',
  'service-assets/eshkol/closures/magnetar-closure/magnetar-closure.wasm',
  'workers/moonlab-core-probe.worker.js'
]);

async function filesUnder(root) {
  const files = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await visit(root);
  return files.sort();
}

function withoutQueryOrHash(value) {
  return String(value || '').split(/[?#]/, 1)[0];
}

function isExternalReference(value) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value);
}

function resolveLocalReference({ outDir, sourceFile, reference, kind, errors }) {
  const clean = withoutQueryOrHash(reference);
  if (!clean || isExternalReference(clean)) return;
  if (clean.startsWith('/')) {
    errors.push(`${kind} in ${path.relative(outDir, sourceFile)} is root-absolute: ${reference}`);
    return;
  }
  const resolved = path.resolve(path.dirname(sourceFile), clean);
  const relative = path.relative(outDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    errors.push(`${kind} escapes the Pages output in ${path.relative(outDir, sourceFile)}: ${reference}`);
    return;
  }
  if (!existsSync(resolved)) {
    errors.push(`${kind} is missing from ${path.relative(outDir, sourceFile)}: ${reference}`);
  }
}

function htmlReferences(source) {
  return [...source.matchAll(/\b(?:src|href)\s*=\s*(['"])([^'"]+)\1/gi)]
    .map((match) => match[2]);
}

function javascriptModuleReferences(source) {
  const references = [];
  const patterns = [
    ['static module reference', /(?:^|[;\n])\s*(?:import|export)\b(?:[^;]*?\bfrom\s*)?(['"])([^'"]+)\1/g],
    ['dynamic module reference', /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g],
    ['import.meta URL reference', /\bnew\s+URL\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*import\.meta\.url\s*\)/g]
  ];
  for (const [kind, pattern] of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (!match[2].includes('${')) references.push({ kind, value: match[2] });
    }
  }
  return references;
}

export async function verifyPagesBuild({
  outDir = path.join(REPO_ROOT, 'docs'),
  requireServiceAssets = true
} = {}) {
  const resolvedOutDir = path.resolve(outDir);
  const errors = [];
  const requiredFiles = [
    'index.html',
    '.nojekyll',
    'assets/sphMlsMpmGpuStep.js',
    'assets/ulgMechanicsResidentStage.worker.js',
    ...(requireServiceAssets ? REQUIRED_SERVICE_ASSETS : [])
  ];
  for (const relative of requiredFiles) {
    const absolute = path.join(resolvedOutDir, relative);
    if (!existsSync(absolute) || !(await stat(absolute)).isFile()) {
      errors.push(`required Pages artifact is missing: ${relative}`);
    }
  }

  if (!existsSync(resolvedOutDir)) {
    throw new Error(`Pages output directory does not exist: ${resolvedOutDir}`);
  }
  const files = await filesUnder(resolvedOutDir);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const javascriptFiles = files.filter((file) => file.endsWith('.js'));
  const assetBasenames = files.map((file) => path.basename(file));
  const offscreenWorkers = assetBasenames.filter((name) => /^ulgOffscreenRender\.worker-[\w-]+\.js$/.test(name));
  const mechanicsWorkers = assetBasenames.filter((name) => /^ulgMechanicsResidentStage\.worker-[\w-]+\.js$/.test(name));
  if (offscreenWorkers.length !== 1) {
    errors.push(`expected one hashed offscreen worker, found ${offscreenWorkers.length}`);
  }
  if (mechanicsWorkers.length !== 1) {
    errors.push(`expected one hashed mechanics worker, found ${mechanicsWorkers.length}`);
  }

  for (const file of htmlFiles) {
    const source = await readFile(file, 'utf8');
    for (const reference of htmlReferences(source)) {
      resolveLocalReference({
        outDir: resolvedOutDir,
        sourceFile: file,
        reference,
        kind: 'HTML asset reference',
        errors
      });
    }
  }
  for (const file of javascriptFiles) {
    const source = await readFile(file, 'utf8');
    for (const reference of javascriptModuleReferences(source)) {
      resolveLocalReference({
        outDir: resolvedOutDir,
        sourceFile: file,
        reference: reference.value,
        kind: reference.kind,
        errors
      });
    }
  }

  const pageEntries = files.filter((file) => /\/assets\/pages-[\w-]+\.js$/.test(file));
  if (pageEntries.length !== 1) {
    errors.push(`expected one hashed Pages entry, found ${pageEntries.length}`);
  } else {
    const pageSource = await readFile(pageEntries[0], 'utf8');
    if (!pageSource.includes('sphMlsMpmGpuStep.js')) {
      errors.push('Pages entry does not reference the resident compute-task facade');
    }
    if (mechanicsWorkers.length === 1 && !pageSource.includes(mechanicsWorkers[0])) {
      errors.push('Pages entry does not reference the hashed mechanics worker');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Pages build verification failed:\n- ${errors.join('\n- ')}`);
  }
  return {
    schema: 'peercompute.ulg.pages-build-verification.v0',
    status: 'pass',
    outDir: resolvedOutDir,
    fileCount: files.length,
    htmlFileCount: htmlFiles.length,
    javascriptFileCount: javascriptFiles.length,
    offscreenWorker: offscreenWorkers[0],
    mechanicsWorker: mechanicsWorkers[0],
    residentComputeTask: 'assets/sphMlsMpmGpuStep.js',
    serviceAssetsPreserved: requireServiceAssets
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  verifyPagesBuild()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
