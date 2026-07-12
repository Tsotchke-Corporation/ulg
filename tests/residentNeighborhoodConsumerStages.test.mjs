import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mlsMpmParticleSeparationComputeWgsl,
  sphPressureInterfaceContactKinematicsWgsl,
  sphReactionStepWgsl,
  sphThermalStepWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import { createMlsMpmGridUpdateWebGpuEncoderStage } from
  '../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { createSphPressureInterfaceForceRowsWebGpuEncoderStage } from
  '../src/runtime/sph/sphPressureInterfaceGpuKernel.js';
import { createSphReactionStepWebGpuEncoderStage } from
  '../src/runtime/sph/sphReactionGpuKernel.js';
import { encodeResidentNeighborhoodPressureGridStagesWebGpu } from
  '../src/runtime/sph/sphMlsMpmGpuStep.js';

test('resident-neighborhood consumers share packed CSR header, offset, candidate, and mask guards', () => {
  const shaders = [
    sphThermalStepWgsl,
    mlsMpmParticleSeparationComputeWgsl,
    sphReactionStepWgsl,
    sphPressureInterfaceContactKinematicsWgsl
  ];
  for (const shader of shaders) {
    assert.match(shader, /resident_[a-z_]*neighborhood_valid/);
    for (const word of [8, 17, 19, 21, 22, 31, 33]) {
      assert.match(shader, new RegExp(`\\[${word}u?\\]|\\(${word}u\\)`));
    }
  }
});

test('reaction, pressure/interface, and grid expose caller-owned encoder stages', () => {
  assert.equal(typeof createSphReactionStepWebGpuEncoderStage, 'function');
  assert.equal(typeof createSphPressureInterfaceForceRowsWebGpuEncoderStage, 'function');
  assert.equal(typeof createMlsMpmGridUpdateWebGpuEncoderStage, 'function');
  assert.equal(typeof encodeResidentNeighborhoodPressureGridStagesWebGpu, 'function');
  assert.throws(
    () => createSphReactionStepWebGpuEncoderStage({}),
    /caller-owned commandEncoder/
  );
  assert.throws(
    () => createSphPressureInterfaceForceRowsWebGpuEncoderStage({}),
    /caller-owned commandEncoder/
  );
  assert.throws(
    () => createMlsMpmGridUpdateWebGpuEncoderStage({}),
    /caller-owned commandEncoder/
  );
});

test('legacy enumeration remains labeled compatibility or diagnostic fallback', () => {
  assert.match(sphThermalStepWgsl, /Mode 1 keeps[\s\S]*compatibility path/);
  assert.match(sphThermalStepWgsl, /mode 0 is the diagnostic exhaustive scan/);
  assert.match(sphReactionStepWgsl, /reaction_particle_bin_ready/);
  assert.match(sphPressureInterfaceContactKinematicsWgsl, /ck_particle_bin_ready/);
});
