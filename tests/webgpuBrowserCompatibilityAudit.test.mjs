// Cross-Browser WebGPU & macOS Chrome/Safari Compatibility Audit (`tests/webgpuBrowserCompatibilityAudit.test.mjs`)
//
// Guards zero-overhead cross-browser compatibility across Linux/Windows Vulkan/D3D12,
// macOS Chrome (Metal/Dawn), and macOS Safari (WebKit WebGPU/Metal):
//   1. Zero inverted numeric `smoothstep(hi, lo, x)` calls in flagship WGSL shaders
//      (WGSL spec makes edge0 >= edge1 undefined; Safari/Metal exhibits NaN/artifacts).
//   2. Zero negative-base `pow(1.0 - x, ...)` unclamped Fresnel or negative `pow(a - b, 2.0)`
//      calls in audited WGSL shaders (Apple Metal `air.pow.f32` returns NaN on negative base).
//   3. All 4 flagship WebGPU demo entrypoints use `requestCompatibleWebGpuDevice`
//      (graceful `powerPreference` fallback for Apple Silicon / Safari WebKit).
//   4. `vite.config.mjs` ignores large build/cache/doc directories (`docs/`, `dist/`, `.icc/`)
//      to prevent chokidar file-watcher memory & thread creep.
//   5. Unit invariants for `normalizeWheelDeltaY` (macOS pinch + Firefox line/page modes)
//      and `resolvePrimaryLevelFromSpan` with binary/trinary companion stars (`focusedBodyIsStar: true`).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeWheelDeltaY } from '../src/runtime/shared/webgpuCompat.js';
import { resolvePrimaryLevelFromSpan } from '../src/demos/ulgUniversesDemo.js';

const ROOT = process.cwd();

const AUDITED_WGSL_FILES = [
  'src/demos/ulgUniversesRenderer.js',
  'src/demos/elementsLabWebGpuRenderer.js',
  'src/demos/chemBioWebGpuRenderer.js',
  'src/runtime/astrophysics/compactMagnetosphereGpu.js',
  'src/runtime/astrophysics/radiativePhotoionizationWindGpu.js',
  'src/runtime/astrophysics/planetaryAtmosphereElectricGpu.js',
  'src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js',
  'src/runtime/astrophysics/galacticIsmCoolingGpu.js',
  'src/runtime/electronicStructure/atomTdks3dWebGpu.js',
  'src/runtime/organic/reactiveBondOrderMdGpu.js',
  'src/runtime/sph/sphNuclearCherenkovGpu.js',
  'src/runtime/material/opticalResolverWebGpu.js'
];

const FLAGSHIP_DEMO_CONTROLLERS = [
  'src/demos/ulgUniversesDemo.js',
  'src/demos/organicLabDemo.js',
  'src/demos/lifeLabDemo.js',
  'src/demos/elementsLabDemo.js'
];

test('WGSL Apple Metal / Safari spec audit: zero inverted numeric smoothstep(hi, lo, x) and zero unclamped Fresnel pow(1.0 - ...)', () => {
  const invertedSmoothsteps = [];
  const unclampedFresnelPows = [];
  const signedSquarePows = [];

  const numSmoothRe = /\bsmoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,/g;
  const unclampedFresnelRe = /\bpow\(\s*1\.0\s*-\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*,/g;
  const signedSubPow2Re = /\bpow\(\s*\([^()]*-[^()]*\)\s*,\s*2\.0\s*\)/g;

  for (const rel of AUDITED_WGSL_FILES) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    let m;
    while ((m = numSmoothRe.exec(src)) !== null) {
      const e0 = Number(m[1]);
      const e1 = Number(m[2]);
      if (e0 >= e1) {
        const line = src.slice(0, m.index).split('\n').length;
        invertedSmoothsteps.push(`${rel}:${line} -> ${m[0]}`);
      }
    }
    while ((m = unclampedFresnelRe.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      unclampedFresnelPows.push(`${rel}:${line} -> ${m[0]}`);
    }
    while ((m = signedSubPow2Re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      signedSquarePows.push(`${rel}:${line} -> ${m[0]}`);
    }
  }

  assert.deepEqual(invertedSmoothsteps, [], `Found WGSL inverted smoothstep(hi, lo, x): ${invertedSmoothsteps.join('; ')}`);
  assert.deepEqual(unclampedFresnelPows, [], `Found unclamped Fresnel pow(1.0 - x, ...): ${unclampedFresnelPows.join('; ')}`);
  assert.deepEqual(signedSquarePows, [], `Found Metal-unsafe signed pow((a - b), 2.0): ${signedSquarePows.join('; ')}`);
});

test('All 4 flagship WebGPU demos wire requestCompatibleWebGpuDevice and canvas/wheel compatibility', () => {
  for (const rel of FLAGSHIP_DEMO_CONTROLLERS) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(
      src.includes('requestCompatibleWebGpuDevice'),
      `${rel} must bootstrap WebGPU through requestCompatibleWebGpuDevice for macOS Chrome/Safari compatibility`
    );
  }
  const orbitSrc = fs.readFileSync(path.join(ROOT, 'src/runtime/shared/targetOrbitControls.js'), 'utf8');
  assert.ok(orbitSrc.includes('normalizeWheelDeltaY'), 'TargetOrbitControls must normalize wheel & trackpad pinch deltas');
  assert.ok(orbitSrc.includes('gesturechange'), 'TargetOrbitControls must handle macOS Safari gesturechange pinch zoom');

  const viteCfg = fs.readFileSync(path.join(ROOT, 'vite.config.mjs'), 'utf8');
  for (const pat of ['**/docs/**', '**/dist/**', '**/.icc/**']) {
    assert.ok(viteCfg.includes(pat), `vite.config.mjs must ignore ${pat} to prevent chokidar memory creep`);
  }
});

test('normalizeWheelDeltaY normalizes pixel, line, page, and macOS trackpad ctrlKey pinch events', () => {
  assert.equal(normalizeWheelDeltaY({ deltaY: 120, deltaMode: 0, ctrlKey: false }), 120);
  assert.equal(normalizeWheelDeltaY({ deltaY: 3, deltaMode: 1, ctrlKey: false }), 48);
  assert.equal(normalizeWheelDeltaY({ deltaY: 1, deltaMode: 2, ctrlKey: false }), 240);
  assert.ok(Math.abs(normalizeWheelDeltaY({ deltaY: -10, deltaMode: 0, ctrlKey: true }) - (-32)) < 1e-6);
});

test('resolvePrimaryLevelFromSpan zooms binary/trinary companion stars cleanly into L3 Stellar Core', () => {
  // Primary star (index 0) -> L3
  assert.equal(resolvePrimaryLevelFromSpan(9.1, { focusedSolarBodyIndex: 0, focusedBodyIsStar: true }), 3);
  // Companion star B (index 1) or C (index 2) -> ALSO L3!
  assert.equal(resolvePrimaryLevelFromSpan(9.1, { focusedSolarBodyIndex: 1, focusedBodyIsStar: true }), 3);
  assert.equal(resolvePrimaryLevelFromSpan(8.2, { focusedSolarBodyIndex: 2, focusedBodyIsStar: true }), 3);
  // Non-star planet (index 1 in single-star system) -> stays L2 above 8.75, L4 below 8.75
  assert.equal(resolvePrimaryLevelFromSpan(9.1, { focusedSolarBodyIndex: 1, focusedBodyIsStar: false }), 2);
  assert.equal(resolvePrimaryLevelFromSpan(7.4, { focusedSolarBodyIndex: 1, focusedBodyIsStar: false }), 4);
});
