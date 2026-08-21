import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const sceneSourcePath = new URL(
  '../src/visualization/sphPhaseScene.js',
  import.meta.url
);

test('scene replacement preserves only canonical resident product-history continuation handles', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  const helperStart = source.indexOf(
    'function residentProductMassHandlesFromExecution'
  );
  const helperEnd = source.indexOf(
    'function destroyCapturedMlsMpmResidentExecutionArtifacts',
    helperStart
  );
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helper = source.slice(helperStart, helperEnd);

  assert.match(helper, /execution\?\.nextResidentProductMass/);
  assert.match(helper, /execution\?\.nextParticleUploads\?\.residentProductMass/);
  assert.match(helper, /finalStep\?\.residentProductMass/);
  assert.doesNotMatch(helper, /emittedResidentProductMass/);
  assert.doesNotMatch(helper, /inputResidentProductMass/);
  assert.doesNotMatch(helper, /retainedSteps/);
});

test('scene captured and deferred cleanup forwards exact product-history handles', async () => {
  const source = await readFile(sceneSourcePath, 'utf8');
  assert.match(
    source,
    /preserveResidentProductMassHandles:\s*Object\.freeze\(\[\]\)/
  );
  assert.match(
    source,
    /cleanupState\.preserveResidentProductMassHandles/
  );
  const continuationHandleCalls = source.match(
    /preserveResidentProductMassHandles:\s*\n\s*residentProductMassHandlesFromExecution\(/g
  ) || [];
  assert.equal(continuationHandleCalls.length, 4);
});
