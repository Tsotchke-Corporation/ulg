import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INCANDESCENCE_THRESHOLD_K,
  blackbodyColorSrgb,
  createRadiationClosure,
  incandescentColor,
  particleDisplayColor
} from '../src/runtime/material/radiationClosure.js';
import { SPH_PHASE_CLOSURE_SCHEMAS } from '../ulg-gpu-abi/src/index.js';

test('blackbody colour follows the Planck locus (first-principles, not tuned)', () => {
  // Molten iron at 1850 K glows orange-red: red saturated, some green, no blue.
  const iron = blackbodyColorSrgb(1850);
  assert.ok(iron.r > 0.9, `r ${iron.r}`);
  assert.ok(iron.r > iron.g && iron.g > iron.b);
  assert.ok(iron.b < 0.1, `b ${iron.b}`);
  // The blue channel rises monotonically toward white as temperature increases.
  const hot = blackbodyColorSrgb(3000);
  const white = blackbodyColorSrgb(5500);
  assert.ok(hot.b > iron.b && white.b > hot.b);
  assert.ok(white.g > 0.85 && white.b > 0.7, 'near-white at 5500 K');
});

test('incandescence is gated at the visibility threshold', () => {
  assert.equal(INCANDESCENCE_THRESHOLD_K, 800);
  assert.equal(incandescentColor(233.15).visible, false);
  assert.equal(incandescentColor(1850).visible, true);
  assert.equal(incandescentColor(1850).closureBacked, true);
});

test('particle colour: hot iron is closure-backed glow, cold ice is a flagged placeholder', () => {
  const ironGlow = particleDisplayColor({ material: 'fe', temperatureK: 1850, phase: 'liquid' });
  assert.equal(ironGlow.closureBackedGlow, true);
  assert.equal(ironGlow.intrinsicPlaceholder, false);
  assert.ok(ironGlow.r > ironGlow.b);

  const ice = particleDisplayColor({ material: 'h2o', temperatureK: 233.15, phase: 'solid' });
  assert.equal(ice.closureBackedGlow, false);
  assert.equal(ice.intrinsicPlaceholder, true);
});

test('radiation closure artifact is physically derived but not optically validated', () => {
  const closure = createRadiationClosure();
  assert.equal(closure.schema, SPH_PHASE_CLOSURE_SCHEMAS.radiation);
  assert.equal(closure.closureBacked, true);
  assert.equal(closure.validation.opticalValidation, false);
  assert.equal(closure.validation.scientificValidation, false);
});
