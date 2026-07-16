import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE,
  SPH_LOCAL_BACKGROUND_IMAGE_MAX_BYTES,
  SPH_LOCAL_BACKGROUND_IMAGE_MIME_TYPES,
  SPH_PHASE_URL_PARAM_KEYS,
  validateSphLocalBackgroundImageFile
} from '../src/visualization/sphPhaseDemoMount.js';

test('local SPH background images accept bounded browser-decodable raster files', () => {
  assert.equal(SPH_LOCAL_BACKGROUND_IMAGE_CONTROL_VALUE, '__local-background-image__');
  assert.deepEqual(SPH_LOCAL_BACKGROUND_IMAGE_MIME_TYPES, [
    'image/avif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  assert.ok(SPH_PHASE_URL_PARAM_KEYS.includes('bgimg'));

  const accepted = validateSphLocalBackgroundImageFile({
    name: 'workbench.webp',
    type: 'image/webp',
    size: 4096
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.status, 'local-background-image-file-accepted');
  assert.equal(accepted.name, 'workbench.webp');
  assert.equal(accepted.sizeBytes, 4096);
});

test('local SPH background validation rejects empty, oversized, and active-content files', () => {
  assert.equal(validateSphLocalBackgroundImageFile(null).status, 'local-background-image-missing-file');
  assert.equal(validateSphLocalBackgroundImageFile({
    name: 'empty.png',
    type: 'image/png',
    size: 0
  }).status, 'local-background-image-empty-file');
  assert.equal(validateSphLocalBackgroundImageFile({
    name: 'too-large.jpg',
    type: 'image/jpeg',
    size: SPH_LOCAL_BACKGROUND_IMAGE_MAX_BYTES + 1
  }).status, 'local-background-image-too-large');
  assert.equal(validateSphLocalBackgroundImageFile({
    name: 'active.svg',
    type: 'image/svg+xml',
    size: 1024
  }).status, 'local-background-image-unsupported-type');
  assert.equal(validateSphLocalBackgroundImageFile({
    name: 'not-an-image.html',
    type: 'text/html',
    size: 1024
  }).accepted, false);
});

test('native background image failures are fenced to the current pending URL', async () => {
  const source = await readFile(
    new URL('../src/visualization/sphPhaseScene.js', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /previousUrl !== url[\s\S]{0,500}envMapPendingUrl = null;[\s\S]{0,250}envMapFailedUrl = null;[\s\S]{0,250}backgroundImageFailedUrl = null;/
  );
  assert.match(
    source,
    /image\.onerror = \(\) => \{[\s\S]{0,350}bridge\.envMapPendingUrl !== url[\s\S]{0,180}sceneBackgroundImageUrl !== url[\s\S]{0,180}bridge\.envMapPendingUrl = null;/
  );
});
