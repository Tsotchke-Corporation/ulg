import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileDeclarativeLawIrToWgsl,
  createPerParticleTaitEosCavitationLawIr
} from '../src/runtime/material/eshkolHigherOrderLawCompiler.js';
import {
  ULG_COMPILED_LAW_IR_LIVE_RUNTIME_SCHEMA,
  encodeCompiledLawIrMechanicsIntoPass,
  getCompiledLawIrLiveStatus
} from '../src/runtime/sph/compiledLawIrLiveRuntime.js';
import {
  SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD,
  SPH_IMPLICIT_THERMAL_SCHEMA,
  clearSphImplicitThermalDeviceExecution,
  computeMaterialTableFourierEnvelope,
  encodeSphImplicitThermalFromSphStep,
  getSphImplicitThermalDeviceExecution,
  recordSphImplicitThermalDeviceExecution,
  solveSphImplicitThermalCpuReference
} from '../src/runtime/sph/sphImplicitThermalGpu.js';
import {
  buildLaunchParamsFromStagedConfig,
  buildStagedConfigFromPreset
} from '../src/visualization/ulgSimStudioModel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Track 1A: per-particle Law-IR Tait EOS + zero-gauge cavitation compiles and coalesces into open passes', async () => {
  const ir = createPerParticleTaitEosCavitationLawIr();
  const compiled = compileDeclarativeLawIrToWgsl(ir, {
    workgroupSize: 64,
    includeEnvelopeWatch: true,
    requireExtendedDescriptor: true
  });
  assert.equal(compiled.lawId, 'per-particle-tait-eos-cavitation-ad');
  assert.equal(compiled.bindGroupLayoutEntries.length, 3);
  assert.match(compiled.wgsl, /@compute @workgroup_size\(64,\s*1,\s*1\)/);
  assert.match(compiled.wgsl, /atomicAdd\(&law_receipt\[0u\], 1u\)/);
  assert.match(compiled.wgsl, /max\(0\.0, p_raw\)/);
  // Zero Apple Metal/Safari incompatible WGSL patterns
  assert.doesNotMatch(compiled.wgsl, /\bmeta\b/);

  const refreshSrc = await fs.readFile(path.join(ROOT, 'src/runtime/sph/sphMechanicsRefreshGpuKernel.js'), 'utf8');
  const stepSrc = await fs.readFile(path.join(ROOT, 'src/runtime/sph/sphMlsMpmGpuStep.js'), 'utf8');
  assert.match(refreshSrc, /encodeCompiledLawIrMechanicsIntoPass/);
  assert.match(stepSrc, /encodeCompiledLawIrMechanicsIntoPass/);

  // Mock device dispatch smoke: coalesces directly into open pass with +0 submits & +0 new passes
  let dispatches = 0;
  let bufferCreates = 0;
  const mockDevice = {
    createShaderModule: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createComputePipeline: () => ({}),
    createBindGroup: () => ({}),
    createBuffer: () => {
      bufferCreates += 1;
      return { destroy() {} };
    },
    queue: { writeBuffer() {} }
  };
  const mockPass = {
    setPipeline() {},
    setBindGroup() {},
    dispatchWorkgroups() { dispatches += 1; }
  };
  const mechBuf = { label: 'mech' };
  assert.equal(encodeCompiledLawIrMechanicsIntoPass(mockDevice, mockPass, {
    mechanicsBuffer: mechBuf,
    particleCount: 256,
    generation: 3
  }), true);
  const createsAfterFirst = bufferCreates;
  assert.equal(encodeCompiledLawIrMechanicsIntoPass(mockDevice, mockPass, {
    mechanicsBuffer: mechBuf,
    particleCount: 256,
    generation: 3
  }), true);
  assert.equal(bufferCreates, createsAfterFirst, 'steady-state Law-IR dispatch must create 0 buffers');
  assert.equal(dispatches, 2);

  const status = getCompiledLawIrLiveStatus(mockDevice);
  assert.equal(status.schema, ULG_COMPILED_LAW_IR_LIVE_RUNTIME_SCHEMA);
  assert.equal(status.dispatchedOnGpu, true);
  assert.equal(status.liveDispatchCount, 2);
});

test('Track 1B: live GPU IMEX thermal PCG bridge exports, Fourier envelope gating, and skew-symmetric conservation', async () => {
  assert.equal(typeof encodeSphImplicitThermalFromSphStep, 'function');

  // Verify stiff Fourier envelope detection (Fo >> 0.45 for copper at fine dx)
  const copperSegs = new Float32Array([
    0, 1, 0, 0, 0, 38500, 200, 300, 8960, 0, 0, 400
  ]);
  const foEnv = computeMaterialTableFourierEnvelope({
    segments: copperSegs,
    segmentStrideFloats: 12,
    segmentCount: 1,
    metadata: [{ materialId: 0, material: 'copper' }]
  }, {
    gridSpacingM: 0.001,
    dtS: 0.5,
    thresholdFo: SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD
  });
  assert.equal(foEnv.exceedsExplicitStability, true);
  assert.ok(foEnv.maxFourierNumber > 50, `expected Fo > 50, got ${foEnv.maxFourierNumber}`);

  // Verify CPU reference exact conservation & discrete maximum principle at Fo = 100
  const nodeState = new Float32Array([
    1.0, 1200.0, 0.0, 300.0,
    1.0, 300.0, 0.0, 300.0,
    1.0, 300.0, 0.0, 300.0,
    1.0, 300.0, 0.0, 300.0
  ]);
  const rowOffsets = new Uint32Array([0, 1, 3, 5, 6]);
  const edgeNeighbors = new Uint32Array([1, 0, 2, 1, 3, 2]);
  const edgeConductance = new Float32Array([200, 200, 200, 200, 200, 200]);
  const ref = solveSphImplicitThermalCpuReference({
    nodeState,
    rowOffsets,
    edgeNeighbors,
    edgeConductance,
    dt: 0.5,
    options: { theta: 1.0, iterations: 16 }
  });
  assert.ok(Math.abs(ref.totalPairEnergyJ) < 1e-9, `expected exact pairwise conservation, got ${ref.totalPairEnergyJ}`);
  for (let i = 0; i < 4; i += 1) {
    const tNew = ref.outEnergy[i * 4];
    assert.ok(tNew >= 300 - 1e-6 && tNew <= 1200 + 1e-6, `DMP violated at node ${i}: ${tNew}`);
  }

  // Verify device execution telemetry record/read/clear lifecycle
  const fakeDevice = { id: 'mock-imex-dev' };
  assert.equal(getSphImplicitThermalDeviceExecution(fakeDevice), null);
  recordSphImplicitThermalDeviceExecution(fakeDevice, {
    passCount: 1,
    nodeCount: 64,
    edgeCount: 300,
    iterations: 12,
    theta: 1.0,
    maxFourierNumber: 42
  });
  const rec = getSphImplicitThermalDeviceExecution(fakeDevice);
  assert.equal(rec.schema, SPH_IMPLICIT_THERMAL_SCHEMA);
  assert.equal(rec.dispatchedOnGpu, true);
  assert.equal(rec.liveDispatchCount, 1);
  assert.equal(rec.skewSymmetricFluxConserved, true);
  assert.equal(clearSphImplicitThermalDeviceExecution(fakeDevice), true);
  assert.equal(getSphImplicitThermalDeviceExecution(fakeDevice), null);

  const thermalSrc = await fs.readFile(path.join(ROOT, 'src/runtime/sph/sphThermalGpuKernel.js'), 'utf8');
  const workerSrc = await fs.readFile(path.join(ROOT, 'src/services/ulgMechanicsResidentStage.worker.js'), 'utf8');
  assert.match(thermalSrc, /encodeSphImplicitThermalFromSphStep/);
  assert.match(workerSrc, /getSphImplicitThermalDeviceExecution/);
  assert.match(workerSrc, /getCompiledLawIrLiveStatus/);
});

test('Track 1C: Studio air3 multi-level room air enables O(A) phase-slot refinement and chain hierarchy consumes it', async () => {
  const cfg = buildStagedConfigFromPreset('iron-ice-quench');
  cfg.environment.mode = 'air';
  cfg.environment.airHierarchyLevels = 3;
  const query = buildLaunchParamsFromStagedConfig(cfg);
  assert.equal(query.schroederLevelChain, '1');
  assert.equal(query.schroederMaxLevel, '2');
  assert.equal(query.schroederPhaseSlotRefinement, '1');
  assert.equal(query.environmentAirParcels, 'mixture');
  assert.equal(query.exactEnergyLedger, '1');

  const appSrc = await fs.readFile(path.join(ROOT, 'src/visualization/ulgSimStudioApp.js'), 'utf8');
  const hierSrc = await fs.readFile(path.join(ROOT, 'src/runtime/sph/schroederHierarchyGpu.js'), 'utf8');
  const chainSrc = await fs.readFile(path.join(ROOT, 'src/runtime/sph/schroederSpatialChainResidentGpu.js'), 'utf8');
  assert.match(appSrc, /airHierarchyLevels = 3/);
  assert.match(hierSrc, /chainCanPreparePhaseSlotRefinement/);
  assert.match(hierSrc, /phaseSlotRefinement: chainPhaseSlotRefinement/);
  assert.match(chainSrc, /phaseSlotRefinement: null/);
});
