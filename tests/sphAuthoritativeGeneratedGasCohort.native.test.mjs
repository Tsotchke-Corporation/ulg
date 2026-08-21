import assert from 'node:assert/strict';
import { test } from 'node:test';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_GENERATED_GAS_COHORT === '1';
const NATIVE_BASE_URL =
  process.env.ULG_GENERATED_GAS_COHORT_NATIVE_BASE_URL
  || 'https://127.0.0.1:5174/';

test('native frozen generated-gas cohort preserves its exact birth lineages', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_GENERATED_GAS_COHORT=1 for native WebGPU',
  timeout: 180_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath:
      process.env.ULG_GENERATED_GAS_COHORT_CHROME
      || '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(NATIVE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) return { status: 'unsupported' };
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const {
        createAuthoritativeGeneratedGasCohortTracker
      } = await import(
        `/src/runtime/sph/sphFrozenGeneratedGasCohortGpu.js`
          + `?nativeFrozenGas=${Date.now()}`
      );
      const lineageCapacity = 4;
      const phaseLaneCount = 4;
      const particleCount = lineageCapacity * phaseLaneCount;
      const rowFloats = 8;
      const rowStrideBytes =
        rowFloats * Float32Array.BYTES_PER_ELEMENT;
      const materialId = 3061144;
      const phaseCarrierPlan = {
        schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
        status: 'phase-lane-capacity-ready',
        lineageCapacity,
        primaryCapacity: lineageCapacity,
        phaseLaneCount,
        phaseLaneStride: lineageCapacity,
        companionStart: lineageCapacity,
        companionCapacity: lineageCapacity * (phaseLaneCount - 1),
        particleCapacity: particleCount,
        stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
      };
      const stateRows = new Float32Array(particleCount * rowFloats);
      const thermoRows = new Float32Array(particleCount * rowFloats);
      const stateBuffer = device.createBuffer({
        label: 'generated-gas-native-state',
        size: stateRows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const thermoBuffer = device.createBuffer({
        label: 'generated-gas-native-thermo',
        size: thermoRows.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      const tracker = createAuthoritativeGeneratedGasCohortTracker({
        targetMaterial: 'h2o'
      });
      const capture = ({
        sourceStep,
        sourceTimeS,
        topologyEpoch,
        materialPhases,
        sharedSlotIdentityVerified
      }) => tracker.capture({
        device,
        stateBuffer,
        thermoBuffer,
        particleCount,
        stateStrideBytes: rowStrideBytes,
        thermoStrideBytes: rowStrideBytes,
        sphPhaseCarrierPlan: phaseCarrierPlan,
        mechanicsPhaseCarrierPlan: phaseCarrierPlan,
        sharedSlotIdentityVerified,
        sourceStep,
        sourceTimeS,
        topologyEpoch,
        identityRevision: 'native-fixture-v1',
        checkpointIndex: sourceStep,
        materialPhaseReduction: {
          totals: { massKg: 0.25 },
          materialPhases
        },
        materialKeyById: { [materialId]: 'h2o' }
      });
      const setGasRow = (lineage, {
        yM,
        massKg,
        vyMPerS
      }) => {
        const index = 2 * lineageCapacity + lineage;
        const offset = index * rowFloats;
        stateRows[offset + 1] = yM;
        stateRows[offset + 3] = massKg;
        stateRows[offset + 5] = vyMPerS;
        thermoRows[offset] = materialId;
        thermoRows[offset + 6] = 1;
      };

      let initial;
      let armed;
      let formed;
      let persisted;
      let validationError = null;
      try {
        device.queue.writeBuffer(stateBuffer, 0, stateRows);
        device.queue.writeBuffer(thermoBuffer, 0, thermoRows);
        initial = await capture({
          sourceStep: 0,
          sourceTimeS: 0,
          topologyEpoch: 0,
          materialPhases: [],
          sharedSlotIdentityVerified: false
        });
        armed = await capture({
          sourceStep: 512,
          sourceTimeS: 0.256,
          topologyEpoch: 512,
          materialPhases: [],
          sharedSlotIdentityVerified: true
        });

        setGasRow(0, { yM: 1.5, massKg: 0.1, vyMPerS: 0.2 });
        setGasRow(1, { yM: 2.5, massKg: 0.15, vyMPerS: 0.4 });
        device.queue.writeBuffer(stateBuffer, 0, stateRows);
        device.queue.writeBuffer(thermoBuffer, 0, thermoRows);
        formed = await capture({
          sourceStep: 1024,
          sourceTimeS: 0.512,
          topologyEpoch: 1024,
          materialPhases: [{
            material: 'h2o',
            materialId,
            phaseId: 3,
            massKg: 0.25
          }],
          sharedSlotIdentityVerified: true
        });

        setGasRow(0, { yM: 1.5, massKg: 0, vyMPerS: 0.2 });
        setGasRow(1, { yM: 3, massKg: 0.15, vyMPerS: 0.5 });
        setGasRow(2, { yM: 4, massKg: 0.2, vyMPerS: 0.75 });
        device.queue.writeBuffer(stateBuffer, 0, stateRows);
        device.queue.writeBuffer(thermoBuffer, 0, thermoRows);
        persisted = await capture({
          sourceStep: 1536,
          sourceTimeS: 0.768,
          topologyEpoch: 1536,
          materialPhases: [{
            material: 'h2o',
            materialId,
            phaseId: 3,
            massKg: 0.35
          }],
          sharedSlotIdentityVerified: true
        });
        await device.queue.onSubmittedWorkDone();
        validationError = (await device.popErrorScope())?.message || null;
      } finally {
        tracker.destroy();
        stateBuffer.destroy();
        thermoBuffer.destroy();
        device.destroy();
      }
      return {
        status: 'ok',
        initial,
        armed,
        formed,
        persisted,
        validationError,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'ok', JSON.stringify(native));
  assert.equal(native.validationError, null, JSON.stringify(native));
  assert.deepEqual(native.uncapturedErrors, [], JSON.stringify(native));
  assert.equal(native.initial.status, 'awaiting-shared-slot-lineage');
  assert.equal(native.initial.cohorts.length, 0);
  assert.equal(native.armed.status, 'awaiting-formation');
  assert.equal(native.armed.cohortCount, 0);
  assert.equal(native.armed.topologyEpoch, 512);
  assert.equal(native.armed.observedTopologyEpoch, 512);

  const formed = native.formed.cohorts[0];
  assert.equal(native.formed.status, 'captured', JSON.stringify(native));
  assert.equal(native.formed.topologyEpoch, 512);
  assert.equal(native.formed.observedTopologyEpoch, 1024);
  assert.equal(formed.frozenLineageCount, 2);
  assert.equal(formed.processedFrozenLineageCount, 2);
  assert.equal(formed.activeGasCarrierCount, 2);
  assert.equal(formed.inactiveFrozenLineageCount, 0);
  assert.equal(formed.invalidActiveCarrierCount, 0);
  assert.equal(formed.phasePurityProblemCount, 0);
  assert.ok(Math.abs(formed.massKg - 0.25) < 1e-6);
  assert.ok(Math.abs(formed.yCenterMassWeightedM - 2.1) < 1e-6);
  assert.ok(Math.abs(formed.meanVyMPerS - 0.32) < 1e-6);
  assert.equal(formed.yMinM, 1.5);
  assert.equal(formed.yMaxM, 2.5);
  assert.ok(Math.abs(formed.minVyMPerS - 0.2) < 1e-6);
  assert.ok(Math.abs(formed.maxVyMPerS - 0.4) < 1e-6);
  assert.equal(formed.frozenLineageMaskHash, 'fnv1a32:9bc23426');
  assert.equal(formed.frozenLineageMaskByteLength, 4);
  assert.equal(formed.readback.mappedSummaryByteLength, 48);
  assert.equal(formed.readback.mappedMaskByteLength, 4);

  const persisted = native.persisted.cohorts[0];
  assert.equal(native.persisted.status, 'captured', JSON.stringify(native));
  assert.equal(native.persisted.topologyEpoch, 512);
  assert.equal(native.persisted.observedTopologyEpoch, 1536);
  assert.equal(persisted.frozenLineageCount, 2);
  assert.equal(persisted.processedFrozenLineageCount, 2);
  assert.equal(persisted.activeGasCarrierCount, 1);
  assert.equal(persisted.inactiveFrozenLineageCount, 1);
  assert.ok(Math.abs(persisted.massKg - 0.15) < 1e-6);
  assert.ok(Math.abs(persisted.yCenterMassWeightedM - 3) < 1e-6);
  assert.ok(Math.abs(persisted.meanVyMPerS - 0.5) < 1e-6);
  assert.equal(persisted.frozenLineageMaskHash, formed.frozenLineageMaskHash);
  assert.equal(persisted.readback.mappedMaskByteLength, 0);
});
