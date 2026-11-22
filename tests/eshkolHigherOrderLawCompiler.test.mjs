import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LAW_FALLBACK_POLICY,
  ULG_ESHKOL_APPROXIMATED_LAW_SCHEMA,
  ULG_ESHKOL_COMPILED_WGSL_LAW_SCHEMA,
  ULG_ESHKOL_LAW_OBJECT_SCHEMA,
  approximateLaw,
  coarseGrainLaw,
  compileLawToWgsl,
  composeLaws,
  defineLawObject,
  differentiateLaw,
  specializeLaw
} from '../src/runtime/material/eshkolHigherOrderLawCompiler.js';
import {
  CLOSURE_VALIDATION_STATUS,
  canonicalClosureDomainHash,
  canonicalizeClosureRegimeKey,
  closureEnvelopeAdmits,
  closureInvalidationKey,
  createClosureRegimeStore
} from '../src/runtime/closureRegimeStore.js';
import {
  SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD,
  computeMaterialTableFourierEnvelope,
  encodeSphImplicitThermalSolve,
  evaluateFourierThermalEnvelope
} from '../src/runtime/sph/sphImplicitThermalGpu.js';

test('higher-order law algebra: define, specialize, compose (with unit checks), and differentiate', () => {
  const idealPressure = defineLawObject({
    id: 'ideal-gas-pressure',
    inputs: [
      { name: 'temperature', unit: 'K' },
      { name: 'density', unit: 'kg/m^3' }
    ],
    output: { name: 'pressure', unit: 'Pa' },
    parameters: { Rspec: 287.05 },
    stateContract: { reads: ['temperature', 'density'], writes: ['pressure'] },
    conservationInvariants: ['positivity'],
    envelope: {
      temperatureRangeK: [200, 1200],
      densityRangeKgM3: [0.2, 5.0],
      ranges: { temperature: [200, 1200], density: [0.2, 5.0] }
    },
    evaluate: ({ temperature, density }, { Rspec }) => density * Rspec * temperature
  });
  assert.equal(idealPressure.schema, ULG_ESHKOL_LAW_OBJECT_SCHEMA);

  const isochoric = specializeLaw(idealPressure, { fixedInputs: { density: 1.2 } });
  assert.equal(isochoric.inputs.length, 1);
  assert.ok(Math.abs(isochoric.evaluate({ temperature: 300 }) - 1.2 * 287.05 * 300) < 1e-9);
  assert.ok(isochoric.dependencies.includes(idealPressure.sourceHash));

  const soundSpeedFromPressure = defineLawObject({
    id: 'sound-speed-from-pressure',
    inputs: [
      { name: 'pressure', unit: 'Pa' },
      { name: 'density', unit: 'kg/m^3' }
    ],
    output: { name: 'soundSpeed', unit: 'm/s' },
    parameters: { gamma: 1.4 },
    envelope: { temperatureRangeK: [200, 1200], ranges: { pressure: [1e4, 1e6], density: [0.2, 5.0] } },
    evaluate: ({ pressure, density }, { gamma }) => Math.sqrt((gamma * pressure) / density)
  });

  const composed = composeLaws(soundSpeedFromPressure, { pressure: idealPressure });
  const cVal = composed.evaluate({ temperature: 300, density: 1.2 });
  assert.ok(Math.abs(cVal - Math.sqrt(1.4 * 287.05 * 300)) < 1e-9);

  // Unit mismatch must fail closed.
  const wrongUnitLaw = defineLawObject({
    id: 'bad-unit',
    inputs: [{ name: 'temperature', unit: 'K' }],
    output: { name: 'energy', unit: 'J/kg' },
    evaluate: ({ temperature }) => 1000 * temperature
  });
  assert.throws(() => composeLaws(soundSpeedFromPressure, { pressure: wrongUnitLaw }), /Unit mismatch/);

  // Differentiate order 1 and order 2 vs exact analytic derivatives.
  const radiationFlux = defineLawObject({
    id: 'stefan-boltzmann',
    inputs: [{ name: 'temperature', unit: 'K' }],
    output: { name: 'flux', unit: 'W/m^2' },
    parameters: { sigma: 5.670374419e-8 },
    envelope: { temperatureRangeK: [200, 2000], ranges: { temperature: [200, 2000] } },
    evaluate: ({ temperature }, { sigma }) => sigma * temperature ** 4
  });
  const d1 = differentiateLaw(radiationFlux, { axis: 'temperature', order: 1 });
  const d2 = differentiateLaw(radiationFlux, { axis: 'temperature', order: 2 });
  const T = 1000;
  const exactD1 = 4 * 5.670374419e-8 * T ** 3;
  const exactD2 = 12 * 5.670374419e-8 * T ** 2;
  assert.ok(Math.abs(d1.evaluate({ temperature: T }) - exactD1) / exactD1 < 1e-9);
  assert.ok(Math.abs(d2.evaluate({ temperature: T }) - exactD2) / exactD2 < 1e-5);
  assert.match(d1.eshkolBody, /derivative/);
});

test('coarseGrainLaw detects Jensen gap E[f(X)] != f(E[X]) and enforces distribution-aware homogeneity predicates', () => {
  const radLaw = defineLawObject({
    id: 'rad-t4',
    inputs: [{ name: 'temperature', unit: 'K' }],
    output: { name: 'flux', unit: 'W/m^2' },
    envelope: { temperatureRangeK: [200, 2000], ranges: { temperature: [200, 2000] } },
    evaluate: ({ temperature }) => 5.670374419e-8 * temperature ** 4
  });
  const coarse = coarseGrainLaw(radLaw, { axis: 'temperature', stdDev: 100, varianceTolerance: 0.05 });
  const probe = coarse.evaluateWithJensenGap({ temperature: 500 });
  // For f(T) = sigma * T^4 with T ~ N(500, 100^2): E[T^4] = mu^4 + 6*mu^2*sigma^2 + 3*sigma^4 > mu^4!
  const expectedE = 5.670374419e-8 * (500 ** 4 + 6 * 500 ** 2 * 100 ** 2 + 3 * 100 ** 4);
  assert.ok(Math.abs(probe.meanValue - expectedE) / expectedE < 1e-10);
  assert.ok(probe.relativeJensenGap > 0.15, 'nonlinear T^4 must exhibit significant Jensen gap');

  // Distribution-aware closureRegimeStore homogeneity admission fails closed on missing stats OR excessive variance.
  const missingRes = closureEnvelopeAdmits(coarse.envelope, { temperatureK: 500 });
  assert.equal(missingRes.admitted, false);
  assert.match(missingRes.reason, /homogeneity-missing/);

  const breachRes = closureEnvelopeAdmits(coarse.envelope, {
    temperatureK: 500,
    temperatureVarianceK2: 50000,
    jensenResidual: probe.relativeJensenGap
  });
  assert.equal(breachRes.admitted, false);
  assert.match(breachRes.reason, /homogeneity-exceeded/);

  const admittedRes = closureEnvelopeAdmits(coarse.envelope, {
    temperatureK: 500,
    temperatureVarianceK2: 100,
    jensenResidual: 0.002
  });
  assert.equal(admittedRes.admitted, true);
});

test('closureRegimeStore binds canonical domainHash into invalidation keys so incompatible envelopes never collide', () => {
  const envA = { temperatureRangeK: [270, 380], pressureRangePa: [5e4, 2e5] };
  const envB = { temperatureRangeK: [275, 375], pressureRangePa: [5e4, 2e5] };
  const hashA = canonicalClosureDomainHash(envA);
  const hashB = canonicalClosureDomainHash(envB);
  assert.notEqual(hashA, hashB);

  const keyA = closureInvalidationKey({
    inputHash: 'in1', methodHash: 'm1', envelope: envA,
    schemaVersion: 'v1', abiVersion: 'abi1', validationStatus: CLOSURE_VALIDATION_STATUS.WARN
  });
  const keyB = closureInvalidationKey({
    inputHash: 'in1', methodHash: 'm1', envelope: envB,
    schemaVersion: 'v1', abiVersion: 'abi1', validationStatus: CLOSURE_VALIDATION_STATUS.WARN
  });
  assert.notEqual(keyA, keyB);

  const store = createClosureRegimeStore();
  const rk = canonicalizeClosureRegimeKey({ lawId: 'test', composition: { h2o: 1 }, temperatureRangeK: [270, 380] });
  const rec = store.registerClosure({
    regimeKey: rk,
    envelope: { ...envA, homogeneityTest: { maxTemperatureGradientKPerM: 500, requiredPhase: 'liquid' } },
    artifact: { tag: 'a' },
    provenance: { kind: 'derived-eshkol-higher-order-law' },
    invalidation: { inputHash: 'in1', methodHash: 'm1', schemaVersion: 'v1', abiVersion: 'abi1', validationStatus: CLOSURE_VALIDATION_STATUS.WARN }
  });
  assert.equal(rec.domainHash, canonicalClosureDomainHash(rec.envelope));
  assert.equal(store.lookupClosure({ regimeKey: rk, state: { temperatureK: 300, pressurePa: 1e5, phase: 'gas', temperatureGradientKPerM: 100 } }).hit, false);
  assert.equal(store.lookupClosure({ regimeKey: rk, state: { temperatureK: 300, pressurePa: 1e5, phase: 'liquid', temperatureGradientKPerM: 100 } }).hit, true);
});

test('approximateLaw supports both Chebyshev+WGSL compilation and SS-owned memory-state (z_next = g(z, x, dt))', () => {
  const store = createClosureRegimeStore();
  const viscosityLaw = defineLawObject({
    id: 'sutherland-viscosity',
    inputs: [{ name: 'temperature', unit: 'K' }],
    output: { name: 'viscosity', unit: 'Pa*s' },
    envelope: {
      temperatureRangeK: [220, 1200],
      ranges: { temperature: [220, 1200] },
      homogeneityTest: { maxTemperatureVarianceK2: 400, maxTemperatureGradientKPerM: 1000 }
    },
    evaluate: ({ temperature }) => 1.85e-5 * Math.pow(temperature / 300, 1.5) * (420 / (temperature + 120))
  });
  const approx = approximateLaw(viscosityLaw, {
    representation: 'chebyshev',
    degrees: [14],
    relativeTolerance: 1e-5,
    composition: { air: 1 },
    regimeStore: store
  });
  assert.equal(approx.schema, ULG_ESHKOL_APPROXIMATED_LAW_SCHEMA);
  assert.ok(approx.regimeRecord);
  const compiled = compileLawToWgsl(approx, { fnPrefix: 'suth_mu', generation: 3 });
  assert.equal(compiled.schema, ULG_ESHKOL_COMPILED_WGSL_LAW_SCHEMA);
  assert.match(compiled.wgsl, /fn suth_mu_eval_watched/);
  assert.match(compiled.wgsl, /rf_eval_differential/);
  assert.equal(compiled.hasHomogeneityGate, true);

  // Explicit memory-bearing law: viscoelastic / plastic internal state z owned by SS.
  const relaxLaw = defineLawObject({
    id: 'maxwell-stress',
    inputs: [{ name: 'strainRate', unit: '1/s' }],
    output: { name: 'stress', unit: 'Pa' },
    stateContract: { reads: ['strainRate', 'z'], writes: ['stress', 'z'], memoryState: { name: 'viscous_stress', dimension: 1, unit: 'Pa' } },
    envelope: { temperatureRangeK: [200, 1000] },
    fallbackPolicy: LAW_FALLBACK_POLICY.ASYNC,
    evaluate: ({ strainRate }) => 1e3 * strainRate
  });
  const memApprox = approximateLaw(relaxLaw, {
    representation: 'memory-state',
    memoryStateDim: 1,
    memoryStateUpdate: (z, { strainRate }, dt) => {
      const tau = 0.01;
      const alpha = Math.exp(-dt / tau);
      return [alpha * z[0] + (1 - alpha) * 1e3 * strainRate];
    },
    memoryStateResponse: (z) => z[0]
  });
  assert.equal(memApprox.memoryContract.ownedBy, 'ss-physical-state');
  assert.equal(memApprox.memoryContract.hiddenRecurrentStateForbidden, true);
  const step1 = memApprox.stepState([0], { temperatureK: 300, strainRate: 2.0 }, 0.01);
  assert.equal(step1.admitted, true);
  assert.ok(step1.response > 1000 && step1.response < 2000);
});

test('1-pass coalesced implicit thermal PCG uses exactly 1 WebGPU compute pass and Fourier envelope triggers at Fo > 0.45', () => {
  const waterFo = evaluateFourierThermalEnvelope({
    thermalConductivityWPerMK: 0.6, densityKgPerM3: 1000, specificHeatJPerKgK: 4184,
    gridSpacingM: 0.01, dtS: 1e-4
  });
  assert.equal(waterFo.exceedsExplicitStability, false);

  const copperFineFo = evaluateFourierThermalEnvelope({
    thermalConductivityWPerMK: 400, densityKgPerM3: 8960, specificHeatJPerKgK: 385,
    gridSpacingM: 0.001, dtS: 0.01
  });
  assert.ok(copperFineFo.fourierNumber > SPH_IMPLICIT_THERMAL_FOURIER_THRESHOLD);
  assert.equal(copperFineFo.exceedsExplicitStability, true);
  assert.equal(copperFineFo.recommendedImplicit, true);

  const tableEnv = computeMaterialTableFourierEnvelope({
    materials: [
      { materialKey: 'h2o', thermalConductivityWPerMK: 0.6, densityKgPerM3: 1000, specificHeatJPerKgK: 4184 },
      { materialKey: 'fe', thermalConductivityWPerMK: 80, densityKgPerM3: 7874, specificHeatJPerKgK: 450 }
    ]
  }, { gridSpacingM: 0.001, dtS: 0.05 });
  assert.equal(tableEnv.worstMaterialId, 'fe');
  assert.equal(tableEnv.exceedsExplicitStability, true);
  assert.equal(tableEnv.passCount, 1);

  // Mock WebGPU encoder to count exact beginComputePass invocations in encodeSphImplicitThermalSolve!
  let passCount = 0;
  let dispatchCount = 0;
  const mockBuf = () => ({ destroy() {} });
  const mockDevice = {
    createShaderModule: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createComputePipeline: () => ({}),
    createBuffer: mockBuf,
    createBindGroup: () => ({}),
    queue: { writeBuffer() {} }
  };
  const mockEncoder = {
    beginComputePass() {
      passCount += 1;
      return {
        setPipeline() {},
        setBindGroup() {},
        dispatchWorkgroups() { dispatchCount += 1; },
        end() {}
      };
    }
  };
  const encoded = encodeSphImplicitThermalSolve(mockDevice, mockEncoder, {
    nodeCount: 256,
    edgeCount: 1024,
    dt: 0.01,
    options: { iterations: 12 },
    nodeStateBuffer: mockBuf(),
    rowOffsetsBuffer: mockBuf(),
    edgeNeighborsBuffer: mockBuf(),
    edgeConductanceBuffer: mockBuf()
  });
  assert.equal(passCount, 1, 'PCG solve must coalesce into exactly 1 compute pass (Section 3 budget)');
  assert.equal(encoded.passCount, 1);
  assert.equal(dispatchCount, 3 + 12 * 6);
  encoded.destroy();
});
