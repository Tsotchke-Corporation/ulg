import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const probeSource = readFileSync(
  new URL('../scripts/resident-neighborhood-consumer-chain-probe.mjs', import.meta.url),
  'utf8'
);

test('resident-neighborhood chain probe uses retained candidates instead of CPU interface elements', () => {
  assert.match(probeSource, /buildSphMaterialInterfaceSourceFieldWebGpu\s*\(/);
  assert.match(probeSource, /buildSphPhysicsMaterialInterfaceFieldWebGpu\s*\(/);
  assert.match(probeSource, /candidateReadbackMode:\s*'gpu-resident-summary'/);
  assert.match(probeSource, /commandEncoder:\s*encoder/);
  assert.match(probeSource, /residentAuthority/);
  assert.match(probeSource, /materialInterfaceField,/);
  assert.doesNotMatch(probeSource, /\belements\s*:/);
  assert.doesNotMatch(probeSource, /diagnosticCpuMaterialInterfaceInput/);
  assert.match(probeSource, /candidateBufferUploaded\s*===\s*false/);
  assert.match(probeSource, /cpuPackedInterfaceElementsUploaded\s*===\s*false/);
  assert.match(probeSource, /candidateReadbackBufferCreated\s*===\s*false/);
});

test('resident-neighborhood chain probe fences before cleanup and labels the dense grid leg diagnostic', () => {
  const fenceIndex = probeSource.indexOf('await device.queue.onSubmittedWorkDone()');
  const cleanupIndex = probeSource.indexOf('gridStage.cleanupSubmittedWork?.()');
  assert.ok(fenceIndex >= 0, 'probe must await the shared queue fence');
  assert.ok(cleanupIndex > fenceIndex, 'probe cleanup must begin after the queue fence');
  assert.match(
    probeSource,
    /legacy-dense-grid-update-diagnostic-awaiting-sparse-pressure-scatter/
  );
  assert.match(
    probeSource,
    /candidateCleanup\?\.status\s*===\s*'material-interface-candidate-field-buffers-destroyed'/
  );
  assert.match(probeSource, /validationErrors\.length\s*===\s*0/);
});
