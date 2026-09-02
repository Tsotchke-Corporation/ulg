import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyPagesBuild } from '../scripts/verify-pages-build.mjs';
import pagesConfig from '../vite.pages.config.mjs';

async function fixture({ htmlReference = './assets/pages-good.js', offscreenSource = '' } = {}) {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ulg-pages-verifier-'));
  await mkdir(path.join(outDir, 'assets'), { recursive: true });
  await writeFile(path.join(outDir, '.nojekyll'), '');
  await writeFile(path.join(outDir, 'index.html'), `<script type="module" src="${htmlReference}"></script>`);
  await writeFile(
    path.join(outDir, 'assets', 'pages-good.js'),
    'const task = "sphMlsMpmGpuStep.js"; const worker = "ulgMechanicsResidentStage.worker-good.js";\n'
  );
  await writeFile(path.join(outDir, 'assets', 'sphMlsMpmGpuStep.js'), 'export { value } from "./task-shared.js";\n');
  await writeFile(path.join(outDir, 'assets', 'task-shared.js'), 'export const value = 1;\n');
  await writeFile(path.join(outDir, 'assets', 'ulgMechanicsResidentStage.worker.js'), 'export {};\n');
  await writeFile(path.join(outDir, 'assets', 'ulgMechanicsResidentStage.worker-good.js'), 'export {};\n');
  await writeFile(path.join(outDir, 'assets', 'ulgOffscreenRender.worker-good.js'), offscreenSource || 'export {};\n');
  return outDir;
}

test('Pages build verifier accepts a closed relative module graph', async () => {
  const outDir = await fixture();
  try {
    const result = await verifyPagesBuild({ outDir, requireServiceAssets: false });
    assert.equal(result.status, 'pass');
    assert.equal(result.residentComputeTask, 'assets/sphMlsMpmGpuStep.js');
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('Pages build verifier rejects a root-absolute HTML asset', async () => {
  const outDir = await fixture({ htmlReference: '/assets/pages-good.js' });
  try {
    await assert.rejects(
      verifyPagesBuild({ outDir, requireServiceAssets: false }),
      /root-absolute/
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('Pages build verifier rejects a missing nested worker import', async () => {
  const outDir = await fixture({
    offscreenSource: 'import("./missingResidentStageRunner.js");\n'
  });
  try {
    await assert.rejects(
      verifyPagesBuild({ outDir, requireServiceAssets: false }),
      /dynamic module reference is missing/
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('Pages config closes the copied offscreen worker static module graph', async () => {
  const workerSource = await readFile(
    new URL('../src/services/ulgOffscreenRender.worker.js', import.meta.url),
    'utf8'
  );
  const input = pagesConfig.build.rollupOptions.input;
  const entryFileNames = pagesConfig.build.rollupOptions.output.entryFileNames;
  assert.equal(
    pagesConfig.build.modulePreload,
    false,
    'shared page/worker chunks must not receive the DOM-only module-preload helper'
  );
  const expectedEntries = [
    {
      name: 'residentRenderCandidateMailbox',
      source: 'src/visualization/residentRenderCandidateMailbox.js',
      workerReference: '../visualization/residentRenderCandidateMailbox.js',
      output: 'visualization/residentRenderCandidateMailbox.js'
    },
    {
      name: 'webgpuDeviceLimits',
      source: 'src/runtime/webgpuDeviceLimits.js',
      workerReference: '../runtime/webgpuDeviceLimits.js',
      output: 'runtime/webgpuDeviceLimits.js'
    },
    {
      name: 'webgpuComputeLayout',
      source: 'src/runtime/webgpuComputeLayout.js',
      workerReference: '../runtime/webgpuComputeLayout.js',
      output: 'runtime/webgpuComputeLayout.js'
    }
  ];

  for (const entry of expectedEntries) {
    assert.ok(
      workerSource.includes(`from '${entry.workerReference}'`),
      `offscreen worker should import ${entry.workerReference}`
    );
    assert.ok(
      input[entry.name].endsWith(entry.source),
      `${entry.name} should build from ${entry.source}`
    );
    assert.equal(entryFileNames({ name: entry.name }), entry.output);
  }
});
