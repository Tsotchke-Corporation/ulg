import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SPH_PHASE_COMPONENT_ACTIVATION_EPSILON,
  SPH_PHASE_FRACTION_VALIDATION_EPSILON,
  ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA,
  ULG_SPH_PHASE_CARRIER_TRANSFER_SCHEMA,
  createSphPhaseCarrierTransferWebGpuEncoderStage,
  sphPhaseCarrierTransferWgsl,
  validateSphPhaseCarrierPlan
} from '../src/runtime/sph/sphPhaseCarrierTransferGpu.js';
import { ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA } from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';

const RUN_NATIVE = process.env.ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER === '1';
const NATIVE_BASE_URL = process.env.ULG_PHASE_CARRIER_TRANSFER_BASE_URL
  || 'https://127.0.0.1:5174/';

function validPlan(primaryCapacity = 3) {
  return {
    schema: ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA,
    status: 'phase-lane-capacity-ready',
    lineageCapacity: primaryCapacity,
    primaryCapacity,
    phaseLaneCount: 4,
    phaseLaneStride: primaryCapacity,
    companionStart: primaryCapacity,
    companionCapacity: primaryCapacity * 3,
    particleCapacity: primaryCapacity * 4,
    stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
  };
}

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  const device = {
    buffers,
    pipelines,
    bindGroups,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      return descriptor;
    },
    createBindGroupLayout(descriptor) {
      return descriptor;
    },
    createPipelineLayout(descriptor) {
      return descriptor;
    },
    createComputePipeline(descriptor) {
      const pipeline = { ...descriptor };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    }
  };
  return device;
}

function createFakeEncoder() {
  const passes = [];
  return {
    passes,
    beginComputePass(descriptor) {
      const pass = { descriptor, pipeline: null, bindGroup: null, dispatches: [], ended: false };
      passes.push(pass);
      return {
        setPipeline(pipeline) { pass.pipeline = pipeline; },
        setBindGroup(index, bindGroup) { pass.bindGroup = { index, bindGroup }; },
        dispatchWorkgroups(x, y = 1, z = 1) { pass.dispatches.push([x, y, z]); },
        end() { pass.ended = true; }
      };
    }
  };
}

function fakeStageFixture(device, primaryCapacity = 3) {
  const plan = validPlan(primaryCapacity);
  const particleCount = primaryCapacity * 4;
  const sourceBuffer = (label, size) => tagWebGpuBufferDevice(device.createBuffer({
    label,
    size,
    usage: 128
  }), device);
  return {
    device,
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount,
      phaseCarrierPlan: plan
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount
    },
    thermalMaterialTable: {
      segments: new Float32Array([
        1, 2, 1, 2,
        120_000, 453_000, 273.15, 273.15,
        917, 1000, 1, 0
      ]),
      // materialId, segmentOffset, segmentCount, status, emissivityGray,
      // then the pressure carrier lanes. This fixture's only plateau is
      // solid->liquid, so the identity law is the correct value here.
      records: new Float32Array([1, 0, 1, 1, 0.9, 0, 0, 0])
    },
    mechanicsMaterialTable: {
      schema: ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
      records: new Float32Array([
        1, 1, 917, 2e6, 7e5, 1e6, 50, 1, 1, 1, 0, 0,
        1, 2, 1000, 2e6, 0, 0, 45, 1, 0, 1, 0.001, 0.07
      ])
    },
    phaseCarrierPlan: plan,
    sourceStateBuffer: sourceBuffer('phase-transfer-source-state', particleCount * 8 * 4),
    sourceThermoBuffer: sourceBuffer('phase-transfer-source-thermo', particleCount * 12 * 4),
    sourceMechanicsBuffer: sourceBuffer('phase-transfer-source-mechanics', particleCount * 32 * 4),
    readbackMode: 'no-full-readback'
  };
}

function nearlyEqual(actual, expected, relativeTolerance = 3e-5) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= relativeTolerance * scale,
    `expected ${actual} to be within ${relativeTolerance} relative tolerance of ${expected}`
  );
}

function nearlyEqualVector(actual, expected, relativeTolerance = 3e-5) {
  assert.equal(actual.length, expected.length);
  for (let axis = 0; axis < expected.length; axis += 1) {
    nearlyEqual(actual[axis], expected[axis], relativeTolerance);
  }
}

test('fixed four-phase-lane plan validation rejects every malformed topology field', () => {
  const plan = validPlan(5);
  assert.deepEqual(validateSphPhaseCarrierPlan(plan, 20), {
    accepted: true,
    status: 'phase-carrier-plan-admitted',
    lineageCapacity: 5,
    primaryCapacity: 5,
    phaseLaneCount: 4,
    phaseLaneStride: 5,
    companionStart: 5,
    companionCapacity: 15,
    particleCapacity: 20
  });

  const invalidPlans = [
    null,
    { ...plan, schema: 'wrong-schema' },
    { ...plan, status: 'not-ready' },
    { ...plan, lineageCapacity: 0 },
    { ...plan, lineageCapacity: 4 },
    { ...plan, primaryCapacity: 0 },
    { ...plan, primaryCapacity: 5.5 },
    { ...plan, phaseLaneCount: 3 },
    { ...plan, phaseLaneStride: 4 },
    { ...plan, companionStart: 4 },
    { ...plan, companionStart: 5.5 },
    { ...plan, companionCapacity: 14 },
    { ...plan, companionCapacity: Number.MAX_SAFE_INTEGER + 1 },
    { ...plan, particleCapacity: 21 }
  ];
  for (const candidate of invalidPlans) {
    const result = validateSphPhaseCarrierPlan(candidate, 20);
    assert.equal(result.accepted, false);
    assert.equal(result.status, 'phase-carrier-plan-rejected');
    assert.equal(result.lineageCapacity, 0);
    assert.equal(result.primaryCapacity, 0);
    assert.equal(result.phaseLaneCount, 0);
    assert.equal(result.phaseLaneStride, 0);
    assert.equal(result.companionStart, 0);
    assert.equal(result.companionCapacity, 0);
    assert.equal(result.particleCapacity, 20);
  }

  assert.equal(validateSphPhaseCarrierPlan(plan, 12).accepted, false);
  assert.equal(validateSphPhaseCarrierPlan(plan, 9.6).accepted, false);
  assert.equal(validateSphPhaseCarrierPlan(plan, Number.NaN).accepted, false);
});

test('encoder stage binds one immutable source set and orders global preflight before transfer', () => {
  const device = createFakeDevice();
  const fixture = fakeStageFixture(device, 65);
  const stage = createSphPhaseCarrierTransferWebGpuEncoderStage(fixture);
  const encoder = createFakeEncoder();
  stage.encode(encoder);

  assert.equal(stage.schema, 'peercompute.ulg.sph-phase-carrier-transfer-encoder-stage.v2');
  assert.equal(stage.status, 'phase-carrier-transfer-encoder-stage-ready');
  assert.equal(stage.result.schema, ULG_SPH_PHASE_CARRIER_TRANSFER_SCHEMA);
  assert.equal(stage.result.failClosedPolicy, 'global-layout-copy-through-lineage-local-invalid-copy-through');
  assert.equal(
    stage.result.conservationPolicy,
    'mass-current-volume-momentum-first-moment-total-energy-with-relative-kinetic-thermalization'
  );
  assert.equal(stage.result.normalHotLoopReadbackFree, true);
  assert.equal(stage.result.fullParticleReadbackPerformed, false);
  assert.equal(device.pipelines.length, 2);
  assert.equal(device.bindGroups.length, 2);
  assert.equal(device.bindGroups[0].entries.length, 9);
  assert.equal(device.bindGroups[1].entries.length, 9);
  assert.equal(encoder.passes.length, 2);
  assert.match(encoder.passes[0].descriptor.label, /preflight$/);
  assert.match(encoder.passes[1].descriptor.label, /transfer-apply$/);
  assert.deepEqual(encoder.passes.map((pass) => pass.dispatches), [[[2, 1, 1]], [[2, 1, 1]]]);
  assert.equal(encoder.passes.every((pass) => pass.ended), true);
  assert.match(sphPhaseCarrierTransferWgsl, /atomicLoad\(&evidence\[2u\]\) & ERROR_LAYOUT/);
  assert.match(sphPhaseCarrierTransferWgsl, /copy_lineage\(lineage_index\)/);
  assert.match(sphPhaseCarrierTransferWgsl, /phase_lane_index\(lineage_index, target_phase\)/);
  assert.match(sphPhaseCarrierTransferWgsl, /aggregate\.first_moment/);
  assert.match(sphPhaseCarrierTransferWgsl, /aggregate\.momentum/);
  assert.match(sphPhaseCarrierTransferWgsl, /aggregate\.current_volume/);
  assert.match(sphPhaseCarrierTransferWgsl, /aggregate\.internal_energy/);
  assert.match(sphPhaseCarrierTransferWgsl, /aggregate\.source_kinetic_energy/);
  assert.match(sphPhaseCarrierTransferWgsl, /mechanics_model_matches_target/);
  // A materialized phase component takes its own phase's rest state. This
  // previously derived J from the source's current volume against a target
  // rest volume, which for a liquid-to-gas split asserts a gas component at
  // liquid density -- roughly the full 1667x liquid/gas ratio as overpressure,
  // with F = diag(J^(1/3)) at J of about 1/1667. On iron-ice-quench that drove
  // the water to 78 m/s and collapsed J to 8.7e-4. Pin both halves so the
  // stiff form cannot come back.
  assert.match(
    sphPhaseCarrierTransferWgsl,
    /let rest_volume = aggregate\.mass \/ max\(record0\.z, params\.mass_epsilon\);\s*\n\s*let volume_ratio_j = 1\.0;/,
    'a materialized component must start undeformed at its phase rest volume'
  );
  assert.doesNotMatch(
    sphPhaseCarrierTransferWgsl,
    /let volume_ratio_j = aggregate\.current_volume \//,
    'materialization must not derive J from the source current volume'
  );
  assert.match(sphPhaseCarrierTransferWgsl, /const ERROR_VOLUME: u32 = 256u/);
  assert.match(sphPhaseCarrierTransferWgsl, /let template_index = aggregate\.template_index/);
  assert.equal(SPH_PHASE_FRACTION_VALIDATION_EPSILON, 1e-7);
  assert.equal(SPH_PHASE_COMPONENT_ACTIVATION_EPSILON, 0);
  assert.match(
    sphPhaseCarrierTransferWgsl,
    /fraction > params\.fraction_activation_epsilon/
  );
  assert.match(
    sphPhaseCarrierTransferWgsl,
    /fraction < -params\.fraction_validation_epsilon/
  );

  stage.cleanupSubmittedWork();
});

test('encoder stage rejects an invalid plan before allocating transfer resources', () => {
  const device = createFakeDevice();
  const fixture = fakeStageFixture(device, 2);
  fixture.phaseCarrierPlan = { ...fixture.phaseCarrierPlan, companionStart: 1 };
  const allocationCount = device.buffers.length;
  assert.throws(
    () => createSphPhaseCarrierTransferWebGpuEncoderStage(fixture),
    /rejected an invalid fixed phase-lane plan/
  );
  assert.equal(device.buffers.length, allocationCount);
});

test('native WebGPU phase transfer performs a phase-pure conservative sweep and fails closed', {
  skip: RUN_NATIVE ? false : 'set ULG_RUN_NATIVE_PHASE_CARRIER_TRANSFER=1 for native WebGPU readback',
  timeout: 120_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: process.env.ULG_PHASE_CARRIER_TRANSFER_CHROME || '/usr/bin/google-chrome',
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
      if (!navigator.gpu) {
        return { status: 'unsupported', reason: 'navigator.gpu unavailable' };
      }
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      const device = await adapter.requestDevice();
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      device.pushErrorScope('validation');

      const nonce = Date.now();
      const phaseModule = await import(
        `/src/runtime/sph/sphPhaseCarrierTransferGpu.js?nativePhaseTransferTest=${nonce}`
      );
      const identityModule = await import(
        `/src/runtime/sph/sphGpuDeviceIdentity.js?nativePhaseTransferTest=${nonce}`
      );
      const abi = await import(`/ulg-gpu-abi/src/index.js?nativePhaseTransferTest=${nonce}`);
      const mechanicsTableModule = await import(
        `/src/runtime/sph/sphMechanicsMaterialTable.js?nativePhaseTransferTest=${nonce}`
      );

      const ENDPOINT_SOLID_U = 120_000;
      const ENDPOINT_LIQUID_U = 453_000;
      const VAPOR_ENDPOINT_LIQUID_U = 1_000_000;
      const VAPOR_ENDPOINT_GAS_U = 3_000_000;
      const RESERVED_STATUS = 254;
      const STATE_FLOATS = 8;
      const THERMO_FLOATS = 12;
      const MECHANICS_FLOATS = 32;
      const fractions = [
        0.01,
        0.49,
        0.5,
        0.51,
        0.99,
        5.540780279034152e-8,
        0
      ];

      const planFor = (primaryCapacity) => ({
        schema: phaseModule.ULG_SPH_PHASE_CARRIER_PLAN_SCHEMA,
        status: 'phase-lane-capacity-ready',
        lineageCapacity: primaryCapacity,
        primaryCapacity,
        phaseLaneCount: 4,
        phaseLaneStride: primaryCapacity,
        companionStart: primaryCapacity,
        companionCapacity: primaryCapacity * 3,
        particleCapacity: primaryCapacity * 4,
        stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex'
      });
      const mechanicsTable = {
        schema: mechanicsTableModule.ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
        records: new Float32Array([
          1, 1, 917, 2e6, 7e5, 1e6, 50, 1, 1, 1, 0, 0,
          1, 2, 1000, 2e6, 0, 0, 45, 1, 0, 1, 0.001, 0.07,
          1, 3, 0.6, 2e5, 0, 0, 400, 2, 0, 1, 0.00001, 0,
          1, 4, 0.1, 2e5, 0, 0, 500, 2, 0, 1, 0.00001, 0
        ])
      };
      const thermalTable = {
        segments: new Float32Array([
          1, 2, 1, 2,
          ENDPOINT_SOLID_U, ENDPOINT_LIQUID_U, 273.15, 273.15,
          917, 1000, 1, 0,
          1, 2, 2, 3,
          VAPOR_ENDPOINT_LIQUID_U, VAPOR_ENDPOINT_GAS_U, 373.15, 373.15,
          1000, 0.6, 1, 0
        ]),
        // Identity carrier law: this fixture pins reference-pressure behavior,
        // so the plateau must not shift. The pressure-shifted path has its own
        // native test.
        records: new Float32Array([1, 0, 2, 1, 0.9, 0, 0, 0])
      };
      const upload = (label, values) => {
        const buffer = device.createBuffer({
          label,
          size: Math.max(4, values.byteLength),
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        if (values.byteLength > 0) device.queue.writeBuffer(buffer, 0, values);
        identityModule.tagWebGpuBufferDevice(buffer, device);
        return buffer;
      };
      const initializeMechanics = (mechanics, index, phaseId = 1, reserved = false) => {
        const base = index * MECHANICS_FLOATS;
        mechanics[base] = 1;
        mechanics[base + 5] = 1;
        mechanics[base + 10] = 1;
        mechanics[base + 18] = 1;
        mechanics[base + 19] = 0.01;
        mechanics[base + 20] = reserved ? 0 : (phaseId === 1 ? 1 : 0);
        mechanics[base + 21] = reserved ? RESERVED_STATUS : 1;
        mechanics[base + 26] = phaseId >= 3 ? 2 : 1;
        mechanics[base + 27] = reserved ? RESERVED_STATUS : 1;
        mechanics[base + 31] = 0;
      };
      const makePackedStates = (phaseFractions) => {
        const primaryCapacity = phaseFractions.length;
        const particleCount = primaryCapacity * 4;
        const state = new Float32Array(particleCount * STATE_FLOATS);
        const thermo = new Float32Array(particleCount * THERMO_FLOATS);
        const mechanics = new Float32Array(particleCount * MECHANICS_FLOATS);
        for (let phaseLane = 0; phaseLane < 4; phaseLane += 1) {
          for (let lineage = 0; lineage < primaryCapacity; lineage += 1) {
            const index = phaseLane * primaryCapacity + lineage;
            const phaseId = phaseLane + 1;
            const position = [1 + lineage, 2 - lineage * 0.25, 3 + lineage * 0.1];
            const velocity = [2 + lineage * 0.1, -1 + lineage * 0.2, 0.5 - lineage * 0.05];
            const stateBase = index * STATE_FLOATS;
            state.set([...position, 0, ...velocity, ENDPOINT_SOLID_U], stateBase);
            const thermoBase = index * THERMO_FLOATS;
            thermo.set([
              1, phaseId, 273.15, phaseId === 1 ? 917 : (phaseId === 2 ? 1000 : 0.6),
              0, 0, 0, 0,
              0.25, 0, RESERVED_STATUS, 0
            ], thermoBase);
            initializeMechanics(mechanics, index, phaseId, true);
          }
        }
        for (let primary = 0; primary < primaryCapacity; primary += 1) {
          const liquidFraction = phaseFractions[primary];
          const position = [1 + primary, 2 - primary * 0.25, 3 + primary * 0.1];
          const velocity = [2 + primary * 0.1, -1 + primary * 0.2, 0.5 - primary * 0.05];
          const specificU = (1 - liquidFraction) * ENDPOINT_SOLID_U
            + liquidFraction * ENDPOINT_LIQUID_U;
          let stateBase = primary * STATE_FLOATS;
          state.set([...position, 10, ...velocity, specificU], stateBase);
          let thermoBase = primary * THERMO_FLOATS;
          thermo.set([
            1, liquidFraction >= 0.5 ? 2 : 1, 273.15, 917,
            1 - liquidFraction, liquidFraction, 0, 0,
            0.25, 1, 1, 0.1
          ], thermoBase);
          initializeMechanics(mechanics, primary, liquidFraction >= 0.5 ? 2 : 1, false);
        }
        return { primaryCapacity, particleCount, state, thermo, mechanics };
      };
      const runPacked = async (packed, label) => {
        const plan = planFor(packed.primaryCapacity);
        const stateBuffer = upload(`${label}-state`, packed.state);
        const thermoBuffer = upload(`${label}-thermo`, packed.thermo);
        const mechanicsBuffer = upload(`${label}-mechanics`, packed.mechanics);
        try {
          return await phaseModule.runSphPhaseCarrierTransferWebGpu({
            device,
            sphParticleState: {
              schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
              particleCount: packed.particleCount,
              phaseCarrierPlan: plan
            },
            mlsMpmParticleState: {
              schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
              particleCount: packed.particleCount
            },
            thermalMaterialTable: thermalTable,
            mechanicsMaterialTable: mechanicsTable,
            phaseCarrierPlan: plan,
            sourceStateBuffer: stateBuffer,
            sourceThermoBuffer: thermoBuffer,
            sourceMechanicsBuffer: mechanicsBuffer,
            readbackMode: 'full-parity-readback'
          });
        } finally {
          stateBuffer.destroy();
          thermoBuffer.destroy();
          mechanicsBuffer.destroy();
        }
      };
      const vector = (values, base) => Array.from(values.slice(base, base + 3));
      const sumVector = (left, right) => left.map((value, axis) => value + right[axis]);
      const scaleVector = (value, scale) => value.map((component) => component * scale);
      const totalsFor = (state, mechanics, lineage, lineageCapacity) => {
        const totals = {
          mass: 0,
          currentVolume: 0,
          momentum: [0, 0, 0],
          firstMoment: [0, 0, 0],
          internalEnergy: 0,
          kineticEnergy: 0,
          totalEnergy: 0
        };
        for (let phaseLane = 0; phaseLane < 4; phaseLane += 1) {
          const index = phaseLane * lineageCapacity + lineage;
          const base = index * STATE_FLOATS;
          const mechanicsBase = index * MECHANICS_FLOATS;
          const mass = state[base + 3];
          const velocity = vector(state, base + 4);
          totals.mass += mass;
          if (mass > 0) {
            totals.currentVolume += mechanics[mechanicsBase + 18]
              * mechanics[mechanicsBase + 19];
          }
          totals.momentum = sumVector(totals.momentum, scaleVector(velocity, mass));
          totals.firstMoment = sumVector(
            totals.firstMoment,
            scaleVector(vector(state, base), mass)
          );
          totals.internalEnergy += mass * state[base + 7];
          totals.kineticEnergy += 0.5 * mass * velocity.reduce(
            (sum, component) => sum + component * component,
            0
          );
        }
        totals.totalEnergy = totals.internalEnergy + totals.kineticEnergy;
        return totals;
      };

      const packedSweep = makePackedStates(fractions);
      // A large but valid source current volume must be partitioned into both
      // target phases. Constitutive model replacement may change V0, but it
      // must express the same geometry through the corresponding target J.
      packedSweep.mechanics[18] = 1000;
      packedSweep.mechanics[20] = 0;
      packedSweep.mechanics[26] = 2;
      const sweepResult = await runPacked(packedSweep, 'native-phase-sweep');
      const sweep = fractions.slice(0, -1).map((fraction, primary) => {
        const liquidLane = packedSweep.primaryCapacity + primary;
        const primaryStateBase = primary * STATE_FLOATS;
        const companionStateBase = liquidLane * STATE_FLOATS;
        const primaryThermoBase = primary * THERMO_FLOATS;
        const companionThermoBase = liquidLane * THERMO_FLOATS;
        return {
          fraction,
          primaryMass: sweepResult.state[primaryStateBase + 3],
          companionMass: sweepResult.state[companionStateBase + 3],
          primaryPhaseId: sweepResult.thermo[primaryThermoBase + 1],
          companionPhaseId: sweepResult.thermo[companionThermoBase + 1],
          primaryFractions: Array.from(sweepResult.thermo.slice(
            primaryThermoBase + 4,
            primaryThermoBase + 8
          )),
          companionFractions: Array.from(sweepResult.thermo.slice(
            companionThermoBase + 4,
            companionThermoBase + 8
          )),
          mechanicsProjection: {
            primaryJ: sweepResult.mechanics[primary * MECHANICS_FLOATS + 18],
            primarySolid: sweepResult.mechanics[primary * MECHANICS_FLOATS + 20],
            primaryEos: sweepResult.mechanics[primary * MECHANICS_FLOATS + 26],
            companionJ: sweepResult.mechanics[liquidLane * MECHANICS_FLOATS + 18],
            companionSolid: sweepResult.mechanics[liquidLane * MECHANICS_FLOATS + 20],
            companionEos: sweepResult.mechanics[liquidLane * MECHANICS_FLOATS + 26]
          },
          before: totalsFor(
            packedSweep.state,
            packedSweep.mechanics,
            primary,
            packedSweep.primaryCapacity
          ),
          after: totalsFor(
            sweepResult.state,
            sweepResult.mechanics,
            primary,
            packedSweep.primaryCapacity
          )
        };
      });
      const reservedPrimary = fractions.length - 1;
      const reservedCompanion = packedSweep.primaryCapacity + reservedPrimary;
      const reservedThermoBase = reservedCompanion * THERMO_FLOATS;
      const reservedMechanicsBase = reservedCompanion * MECHANICS_FLOATS;
      const reserved = {
        mass: sweepResult.state[reservedCompanion * STATE_FLOATS + 3],
        thermoStatus: sweepResult.thermo[reservedThermoBase + 10],
        mechanicsStatus0: sweepResult.mechanics[reservedMechanicsBase + 21],
        mechanicsStatus1: sweepResult.mechanics[reservedMechanicsBase + 27]
      };

      const triplePacked = makePackedStates([0.5]);
      triplePacked.state[3] = 6;
      const gasIndex = 2;
      const gasStateBase = gasIndex * STATE_FLOATS;
      const gasThermoBase = gasIndex * THERMO_FLOATS;
      triplePacked.state.set([
        3, 2, 1, 4,
        -1, 1, 0,
        0.25 * VAPOR_ENDPOINT_LIQUID_U + 0.75 * VAPOR_ENDPOINT_GAS_U
      ], gasStateBase);
      triplePacked.thermo.set([
        1, 3, 373.15, 0.6,
        0, 0.25, 0.75, 0,
        0.25, 0.4, 1, 0.1
      ], gasThermoBase);
      initializeMechanics(triplePacked.mechanics, gasIndex, 3, false);
      triplePacked.mechanics[gasIndex * MECHANICS_FLOATS + 18] = 1000;
      const tripleBefore = totalsFor(triplePacked.state, triplePacked.mechanics, 0, 1);
      const tripleResult = await runPacked(triplePacked, 'native-phase-triple');
      const tripleAfter = totalsFor(
        tripleResult.state,
        tripleResult.mechanics,
        0,
        1
      );
      const triple = {
        status: tripleResult.status,
        errorBits: tripleResult.evidence?.[2] ?? 0,
        invalidLineages: tripleResult.invalidLineageCount,
        masses: [0, 1, 2, 3].map((index) => tripleResult.state[index * STATE_FLOATS + 3]),
        fractions: [0, 1, 2, 3].map((index) => Array.from(
          tripleResult.thermo.slice(
            index * THERMO_FLOATS + 4,
            index * THERMO_FLOATS + 8
          )
        )),
        phaseIds: [0, 1, 2, 3].map((index) => tripleResult.thermo[index * THERMO_FLOATS + 1]),
        mechanicsJ: [0, 1, 2].map((index) => tripleResult.mechanics[index * MECHANICS_FLOATS + 18]),
        currentVolumes: [0, 1, 2].map((index) => (
          tripleResult.mechanics[index * MECHANICS_FLOATS + 18]
            * tripleResult.mechanics[index * MECHANICS_FLOATS + 19]
        )),
        before: tripleBefore,
        after: tripleAfter
      };

      const invalidPacked = makePackedStates([0.5, 0.25]);
      invalidPacked.thermo.set([0.3, 0.3, 0.4, 0], 4);
      invalidPacked.state[7] = ENDPOINT_SOLID_U;
      const invalidResult = await runPacked(invalidPacked, 'native-phase-invalid');
      const lineageRowsEqual = (output, source, rowFloats, lineageCapacity, lineage) => {
        for (let phaseLane = 0; phaseLane < 4; phaseLane += 1) {
          const index = phaseLane * lineageCapacity + lineage;
          const start = index * rowFloats;
          for (let word = 0; word < rowFloats; word += 1) {
            if (!Object.is(output[start + word], source[start + word])) return false;
          }
        }
        return true;
      };
      const validLiquidIndex = invalidPacked.primaryCapacity + 1;
      const failClosed = {
        status: invalidResult.status,
        errorBits: invalidResult.evidence?.[2] ?? 0,
        invalidLineages: invalidResult.invalidLineageCount,
        firstInvalidLineage: invalidResult.firstInvalidLineage,
        copiedState: lineageRowsEqual(
          invalidResult.state,
          invalidPacked.state,
          STATE_FLOATS,
          invalidPacked.primaryCapacity,
          0
        ),
        copiedThermo: lineageRowsEqual(
          invalidResult.thermo,
          invalidPacked.thermo,
          THERMO_FLOATS,
          invalidPacked.primaryCapacity,
          0
        ),
        copiedMechanics: lineageRowsEqual(
          invalidResult.mechanics,
          invalidPacked.mechanics,
          MECHANICS_FLOATS,
          invalidPacked.primaryCapacity,
          0
        ),
        validLineageLiquidMass: invalidResult.state[validLiquidIndex * STATE_FLOATS + 3],
        validLineageLiquidFractions: Array.from(invalidResult.thermo.slice(
          validLiquidIndex * THERMO_FLOATS + 4,
          validLiquidIndex * THERMO_FLOATS + 8
        ))
      };

      await device.queue.onSubmittedWorkDone();
      const validationError = await device.popErrorScope();
      device.destroy();
      return {
        status: 'complete',
        sweepStatus: sweepResult.status,
        sweepErrorBits: sweepResult.evidence?.[2] ?? 0,
        sweep,
        reserved,
        triple,
        failClosed,
        validationError: validationError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  assert.equal(native.status, 'complete', native.reason || 'native WebGPU did not run');
  assert.equal(native.validationError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  assert.equal(native.sweepStatus, 'phase-carrier-transfer-complete');
  assert.equal(native.sweepErrorBits, 0);
  assert.equal(native.sweep.length, 6);
  for (const entry of native.sweep) {
    nearlyEqual(entry.primaryMass, 10 * (1 - entry.fraction));
    nearlyEqual(entry.companionMass, 10 * entry.fraction);
    assert.ok(entry.companionMass > 0);
    assert.equal(entry.primaryPhaseId, 1);
    assert.equal(entry.companionPhaseId, 2);
    nearlyEqualVector(entry.primaryFractions, [1, 0, 0, 0]);
    nearlyEqualVector(entry.companionFractions, [0, 1, 0, 0]);
    nearlyEqual(
      entry.mechanicsProjection.primaryJ,
      entry.before.currentVolume * 917 / entry.before.mass
    );
    nearlyEqual(entry.mechanicsProjection.primarySolid, 1);
    nearlyEqual(entry.mechanicsProjection.primaryEos, 1);
    nearlyEqual(
      entry.mechanicsProjection.companionJ,
      entry.before.currentVolume * 1000 / entry.before.mass
    );
    nearlyEqual(entry.mechanicsProjection.companionSolid, 0);
    nearlyEqual(entry.mechanicsProjection.companionEos, 1);
    nearlyEqual(entry.after.mass, entry.before.mass);
    nearlyEqual(entry.after.currentVolume, entry.before.currentVolume);
    nearlyEqualVector(entry.after.momentum, entry.before.momentum);
    nearlyEqualVector(entry.after.firstMoment, entry.before.firstMoment);
    nearlyEqual(entry.after.internalEnergy, entry.before.internalEnergy);
  }
  assert.equal(native.reserved.mass, 0);
  assert.equal(native.reserved.thermoStatus, 254);
  assert.equal(native.reserved.mechanicsStatus0, 254);
  assert.equal(native.reserved.mechanicsStatus1, 254);
  assert.equal(native.triple.status, 'phase-carrier-transfer-complete');
  assert.equal(native.triple.errorBits, 0);
  assert.equal(native.triple.invalidLineages, 0);
  nearlyEqualVector(native.triple.masses, [3, 4, 3, 0]);
  assert.deepEqual(native.triple.phaseIds, [1, 2, 3, 4]);
  nearlyEqualVector(native.triple.fractions[0], [1, 0, 0, 0]);
  nearlyEqualVector(native.triple.fractions[1], [0, 1, 0, 0]);
  nearlyEqualVector(native.triple.fractions[2], [0, 0, 1, 0]);
  nearlyEqualVector(native.triple.fractions[3], [0, 0, 0, 0]);
  nearlyEqualVector(native.triple.currentVolumes, [0.005, 2.505, 7.5]);
  nearlyEqual(native.triple.after.mass, native.triple.before.mass);
  nearlyEqual(native.triple.after.currentVolume, native.triple.before.currentVolume);
  nearlyEqualVector(native.triple.after.momentum, native.triple.before.momentum);
  nearlyEqualVector(native.triple.after.firstMoment, native.triple.before.firstMoment);
  nearlyEqual(native.triple.after.totalEnergy, native.triple.before.totalEnergy);
  assert.ok(native.triple.after.internalEnergy >= native.triple.before.internalEnergy);
  assert.equal(native.failClosed.status, 'phase-carrier-transfer-complete-with-rejected-lineages');
  assert.notEqual(native.failClosed.errorBits, 0);
  assert.equal(native.failClosed.invalidLineages, 1);
  assert.equal(native.failClosed.firstInvalidLineage, 0);
  assert.equal(native.failClosed.copiedState, true);
  assert.equal(native.failClosed.copiedThermo, true);
  assert.equal(native.failClosed.copiedMechanics, true);
  nearlyEqual(native.failClosed.validLineageLiquidMass, 2.5);
  nearlyEqualVector(native.failClosed.validLineageLiquidFractions, [0, 1, 0, 0]);
});
