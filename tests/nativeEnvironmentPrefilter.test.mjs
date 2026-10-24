import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildGgxPrefilteredLatlongMips
} from '../src/visualization/nativeEnvironmentPrefilter.js';

test('worker environment prefilter remains an exact copy of the unchanged page algorithm', async () => {
  const scene = await readFile(new URL('../src/visualization/sphPhaseScene.js', import.meta.url), 'utf8');
  const marker = 'export function buildGgxPrefilteredLatlongMips(';
  const start = scene.indexOf(marker);
  assert.ok(start >= 0, 'page prefilter must remain available for the duplication guard');
  const end = scene.indexOf('\n}\n', start);
  assert.ok(end > start, 'page prefilter must have its top-level closing brace');
  const pageFunction = scene.slice(start + 'export '.length, end + 2);
  assert.equal(buildGgxPrefilteredLatlongMips.toString(), pageFunction,
    'the worker leaf must not drift from the page until a separately scoped duplicate cleanup');
});

// These fixtures mirror sphPhaseRenderer.test.mjs. They run without importing
// the scene or bringing its page/browser dependencies into the worker leaf.
test('GGX leaf preserves a constant environment at every roughness', () => {
  const width = 64;
  const height = 32;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(128);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const original = new Uint8ClampedArray(pixels);
  const levels = buildGgxPrefilteredLatlongMips({
    pixels, width, height, mipLevelCount: 7, sampleCount: 32
  });
  assert.equal(levels.length, 7);
  assert.deepEqual(pixels, original, 'prefiltering must not mutate the source pixels');
  for (const level of levels) {
    for (let i = 0; i < level.pixels.length; i += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        assert.ok(Math.abs(level.pixels[i + channel] - 128) <= 2,
          `constant channel drifted at mip width ${level.width}`);
      }
      assert.equal(level.pixels[i + 3], 255);
    }
  }
});

test('GGX leaf preserves the base image and spreads the existing point-light fixture', () => {
  const width = 64;
  const height = 32;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
  pixels[center] = 255;
  pixels[center + 1] = 255;
  pixels[center + 2] = 255;
  const levels = buildGgxPrefilteredLatlongMips({
    pixels, width, height, mipLevelCount: 7, sampleCount: 64
  });
  assert.deepEqual(levels[0].pixels, pixels);
  assert.notEqual(levels[0].pixels, pixels, 'base output must own its pixel storage');
  const peaks = levels.map((level) => {
    let peak = 0;
    for (let i = 0; i < level.pixels.length; i += 4) peak = Math.max(peak, level.pixels[i]);
    return peak;
  });
  for (let level = 2; level <= 4; level += 1) {
    assert.ok(peaks[level] <= peaks[level - 1] + 1,
      `peak must not grow with roughness at mip ${level}`);
  }
  assert.ok(peaks[4] < peaks[1] * 0.7, 'a broad lobe must dilute the point source');
});

test('GGX leaf retains the production 256x128 nine-mip and default 64-sample behavior', () => {
  const width = 256;
  const height = 128;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = x;
      pixels[offset + 1] = y * 2;
      pixels[offset + 2] = (x * 13 + y * 7) % 256;
      pixels[offset + 3] = 255;
    }
  }
  const options = { pixels, width, height, mipLevelCount: 9 };
  const levels = buildGgxPrefilteredLatlongMips(options);
  const explicitSampleCount = buildGgxPrefilteredLatlongMips({ ...options, sampleCount: 64 });
  assert.deepEqual(levels, explicitSampleCount);
  assert.deepEqual(levels.map(({ width, height }) => [width, height]), [
    [256, 128], [128, 64], [64, 32], [32, 16], [16, 8],
    [8, 4], [4, 2], [2, 1], [1, 1]
  ]);
  assert.deepEqual(levels[0].pixels, pixels);
  for (const level of levels) {
    assert.ok(level.pixels instanceof Uint8ClampedArray);
    assert.equal(level.pixels.length, level.width * level.height * 4);
  }
});
