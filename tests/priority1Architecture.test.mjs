import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANONICAL_ULG_LAW_ADAPTERS,
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES,
  ULG_LAW_ADAPTER_CONTRACT_SCHEMA,
  assertValidLawAdapterSchedule,
  validateLawAdapterDescriptor,
  validateLawAdapterSchedule
} from '../src/runtime/sph/lawAdapterContract.js';
import { validateFusedResidentLawPlan } from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  chebyshevSampleNodes,
  fitResponseFunctionWebGpu,
  responseFunctionFitGpuWgsl
} from '../src/runtime/material/responseFunctionFitGpu.js';
import {
  encodeSphThermalRegionalRadiationConsumer
} from '../src/runtime/sph/sphThermalRegionalClosureGpu.js';

test('P1: Law Adapter Contract validates canonical ULG law adapters with zero errors and zero private-grid debt', () => {
  const requiredStageOrder = CANONICAL_ULG_LAW_ADAPTERS.map((adapter) => adapter.id);
  const result = assertValidLawAdapterSchedule(
    {
      stages: CANONICAL_ULG_LAW_ADAPTERS,
      requiredStageOrder
    },
    { requireExtendedMetadata: true }
  );
  assert.equal(result.schema, ULG_LAW_ADAPTER_CONTRACT_SCHEMA);
  assert.equal(result.valid, true);
  assert.equal(result.stageCount, CANONICAL_ULG_LAW_ADAPTERS.length);
  assert.deepEqual(result.debt, []);
});

test('P1: Law Adapter Contract rejects illegal double writers, simultaneous write+accumulate, and surfaces legacy-private-grid debt', () => {
  const badDesc = validateLawAdapterDescriptor({
    id: 'bad-law',
    adapterMode: 'invalid-mode',
    spatialAuthority: LAW_SPATIAL_AUTHORITIES.LEGACY_PRIVATE_GRID,
    fallbackPolicy: LAW_FALLBACK_POLICIES.STRICT,
    reads: [],
    writes: ['sph-particle-state'],
    accumulates: ['sph-particle-state'],
    conservedQuantities: ['mass'],
    validityDomain: {},
    pairedVolumeState: 'not-applicable'
  }, { requireExtendedMetadata: true });
  assert.equal(badDesc.valid, false);
  assert.ok(badDesc.errors.some((e) => e.startsWith('stage-writes-and-accumulates-same-resource')));
  assert.ok(badDesc.errors.some((e) => e.startsWith('invalid-adapter-mode')));
  assert.deepEqual(badDesc.debt, ['legacy-private-grid:bad-law']);

  const doubleWrite = validateLawAdapterSchedule({
    requiredStageOrder: ['a', 'b'],
    stages: [
      {
        id: 'a',
        lawNodeId: 'law:a',
        orderConstraint: 'first',
        adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
        spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
        fallbackPolicy: LAW_FALLBACK_POLICIES.STRICT,
        reads: [],
        writes: ['custom-buffer'],
        accumulates: []
      },
      {
        id: 'b',
        lawNodeId: 'law:b',
        orderConstraint: 'second',
        adapterMode: LAW_ADAPTER_MODES.CELL_LOCAL,
        spatialAuthority: LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH,
        fallbackPolicy: LAW_FALLBACK_POLICIES.STRICT,
        reads: ['custom-buffer'],
        writes: ['custom-buffer'],
        accumulates: []
      }
    ]
  });
  assert.equal(doubleWrite.valid, false);
  assert.ok(doubleWrite.errors.some((e) => e.startsWith('illegal-double-writer:custom-buffer')));
});

test('P1: validateFusedResidentLawPlan delegates to enforced Law Adapter Contract cleanly', () => {
  const res = validateFusedResidentLawPlan({
    requiredStageOrder: ['s1', 's2'],
    stages: [
      {
        id: 's1',
        lawNodeId: 'n1',
        orderConstraint: 'first',
        reads: ['sph-particle-state'],
        writes: ['sph-particle-state'],
        accumulates: []
      },
      {
        id: 's2',
        lawNodeId: 'n2',
        orderConstraint: 'after:s1',
        reads: ['sph-particle-state'],
        writes: ['sph-particle-state'],
        accumulates: []
      }
    ]
  });
  assert.equal(res.valid, true);
  assert.equal(res.schema, ULG_LAW_ADAPTER_CONTRACT_SCHEMA);
});

test('P1: Coupling #8 skips render-cadence JS pressure-interface solver under worker-owned resident rendering', () => {
  const src = readFileSync(new URL('../src/visualization/sphPhaseScene.js', import.meta.url), 'utf8');
  assert.match(
    src,
    /configuredWorkerOffscreenPresentation\s*\|\|\s*useWorkerOwnedResidentRenderProducer[\s\S]{0,120}diagnosticGasProducerRefresh\s*!==\s*true/
  );
});

test('P1: G6 radiationEpsilonFluxWPerM2 is preserved in normalizeThermalDormancyConfig and uncertainty propagates to reaction/phase dormancy', () => {
  const thermalSrc = readFileSync(new URL('../src/runtime/sph/schroederSpatialThermalProposalsGpu.js', import.meta.url), 'utf8');
  assert.match(thermalSrc, /function normalizeThermalDormancyConfig[\s\S]{0,1200}radiationEpsilonFluxWPerM2/);
  assert.match(thermalSrc, /uncertaintyBuffer:\s*derivedBuffer/);
  const closureSrc = readFileSync(new URL('../src/runtime/sph/sphMlsMpmPostMechanicsClosure.js', import.meta.url), 'utf8');
  assert.match(closureSrc, /reactionDormancy:[\s\S]{0,300}uncertaintyBuffer:/);
  assert.match(closureSrc, /phaseDormancy:[\s\S]{0,500}uncertaintyBuffer/);
});

test('P1: A4 GPU Chebyshev fitter validates inputs fail-closed without GPUDevice and generates Gauss-Chebyshev nodes', async () => {
  const nodes = chebyshevSampleNodes(200, 800, 5);
  assert.equal(nodes.length, 5);
  assert.ok(nodes[0] > nodes[4]);
  assert.ok(nodes.every((v) => v > 200 && v < 800));
  assert.match(responseFunctionFitGpuWgsl, /fn project_chebyshev_coeffs/);
  assert.match(responseFunctionFitGpuWgsl, /fn verify_heldout/);
  await assert.rejects(
    () => fitResponseFunctionWebGpu(null, { box: [[0, 1]], degrees: [3], nodeSamples: [1, 1, 1, 1] }),
    /live WebGPU GPUDevice/
  );
});

test('P1: A3 thermal regional closure has live GPU radiation consumer and worker compiles live Eshkol law', () => {
  assert.equal(typeof encodeSphThermalRegionalRadiationConsumer, 'function');
  const a3Src = readFileSync(new URL('../src/runtime/sph/sphThermalRegionalClosureGpu.js', import.meta.url), 'utf8');
  assert.match(a3Src, /fn consume_thermal_regional_radiation/);
  assert.match(a3Src, /getSphThermalRegionalClosureLane\(device\)/);
  const workerSrc = readFileSync(new URL('../src/services/ulgMechanicsResidentStage.worker.js', import.meta.url), 'utf8');
  assert.match(workerSrc, /defineLawObject\(/);
  assert.match(workerSrc, /approximateLaw\(/);
  assert.match(workerSrc, /compileLawToWgsl\(/);
});
