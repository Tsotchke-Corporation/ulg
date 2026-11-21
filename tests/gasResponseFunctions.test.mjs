import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GAS_RESPONSE_CLOSURE_NAMES,
  GAS_RESPONSE_FUNCTIONS_SCHEMA,
  buildMaterialGasResponseFunctions,
  evaluateMaterialGasResponseCpu,
  gasResponseFunctionGpuWgsl
} from '../src/runtime/material/gasResponseFunctions.js';
import {
  SPH_THERMAL_REGIONAL_CLOSURE_SCHEMA,
  SPH_THERMAL_REGIONAL_G4_REGION_COUNT,
  destroySphThermalRegionalClosureResources,
  encodeSphThermalRegionalClosureScheduleTick,
  getSphThermalRegionalClosureLane
} from '../src/runtime/sph/sphThermalRegionalClosureGpu.js';
import {
  buildMlsMpmMechanicsMaterialTable
} from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  uploadMlsMpmMechanicsMaterialPhaseRecords,
  destroyMlsMpmMechanicsMaterialPhaseUpload
} from '../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import {
  encodeSphImplicitPressureRegionalClosureScheduleTick,
  getSphImplicitPressureRegionalClosureLane
} from '../src/runtime/sph/sphImplicitPressureGpu.js';

const AVOGADRO_R = 8.314462618;

const SAMPLE_MATERIALS = {
  n2: {
    molarMassKgPerMol: 0.0280134,
    atomsPerFormula: 2,
    phases: [
      { name: 'gas', densityKgPerM3: 1.165, cpJPerKgK: 1040, bulkModulusPa: 1.4e5, temperatureK: 293.15 }
    ]
  },
  h2o: {
    molarMassKgPerMol: 0.01801528,
    atomsPerFormula: 3,
    phases: [
      { name: 'liquid', densityKgPerM3: 998.2, bulkModulusPa: 2.2e9, cpJPerKgK: 4184, temperatureK: 293.15 },
      { name: 'gas', densityKgPerM3: 0.59, cpJPerKgK: 2010, bulkModulusPa: 1.33e5, temperatureK: 373.15 }
    ]
  },
  fe: {
    molarMassKgPerMol: 0.055845,
    atomsPerFormula: 1,
    phases: [
      { name: 'solid', densityKgPerM3: 7874, bulkModulusPa: 1.7e11, shearModulusPa: 8.2e10, cpJPerKgK: 449, temperatureK: 293.15 }
    ]
  }
};

test('A4 2-D gas response functions fit all 6 thermodynamic and transport closures strictly in-box', () => {
  const bundle = buildMaterialGasResponseFunctions(SAMPLE_MATERIALS);
  assert.equal(bundle.schema, GAS_RESPONSE_FUNCTIONS_SCHEMA);
  assert.deepEqual(bundle.status.closures, GAS_RESPONSE_CLOSURE_NAMES);
  assert.equal(bundle.status.materialCount, 2);
  assert.equal(bundle.status.functionCount, 12);
  assert.ok(bundle.status.maxRelativeResidualBound > 0 && bundle.status.maxRelativeResidualBound <= 1e-5);
  assert.ok(bundle.packedGpuTable?.data instanceof Float32Array);
  assert.equal(bundle.packedGpuTable.functionCount, 12);
  assert.equal(bundle.byMaterial.fe, undefined, 'solid-only material has no gas response record');

  // Verify interior accuracy and physical partial-derivative signs across (T, P).
  for (const [material, props] of [['n2', SAMPLE_MATERIALS.n2], ['h2o', SAMPLE_MATERIALS.h2o]]) {
    const entry = bundle.byMaterial[material];
    const M = props.molarMassKgPerMol;
    const Rspec = AVOGADRO_R / M;
    const cp = props.phases.find((p) => p.name === 'gas').cpJPerKgK;
    const gamma = cp / (cp - Rspec);
    const { refTemperatureK, sutherlandK, muRefPaS, kRefWPerMK } = entry.transport;
    for (const [T, P] of [[250, 50_000], [293.15, 101_325], [600, 250_000], [1150, 480_000]]) {
      const res = evaluateMaterialGasResponseCpu(bundle, material, T, P);
      assert.equal(res.ok, true, `${material} @ (${T}, ${P})`);
      const exactRho = (P * M) / (AVOGADRO_R * T);
      const exactC = Math.sqrt(gamma * Rspec * T);
      const suth = Math.pow(T / refTemperatureK, 1.5) * ((refTemperatureK + sutherlandK) / (T + sutherlandK));
      const exactMu = muRefPaS * suth;
      const exactK = kRefWPerMK * suth;
      const exactZ = exactRho * exactC;
      const exactVolCp = exactRho * cp;
      assert.ok(Math.abs(res.densityKgPerM3 - exactRho) / exactRho <= 1e-5, `${material} density`);
      assert.ok(Math.abs(res.soundSpeedMPerS - exactC) / exactC <= 1e-5, `${material} soundSpeed`);
      assert.ok(Math.abs(res.dynamicViscosityPaS - exactMu) / exactMu <= 1e-5, `${material} viscosity`);
      assert.ok(Math.abs(res.thermalConductivityWPerMK - exactK) / exactK <= 1e-5, `${material} conductivity`);
      assert.ok(Math.abs(res.acousticImpedancePaSPerM - exactZ) / exactZ <= 1e-5, `${material} acousticImpedance`);
      assert.ok(Math.abs(res.volumetricHeatCapacityJPerM3K - exactVolCp) / exactVolCp <= 1e-5, `${material} volHeatCap`);
      assert.ok(res.densityGradient[0] < 0, 'd(rho)/dT must be negative');
      assert.ok(res.densityGradient[1] > 0, 'd(rho)/dP must be positive');
      assert.ok(res.soundSpeedGradient[0] > 0, 'd(c_s)/dT must be positive');
      assert.ok(res.dynamicViscosityGradient[0] > 0, 'd(mu)/dT must be positive');
      assert.ok(res.thermalConductivityGradient[0] > 0, 'd(k)/dT must be positive');
      assert.ok(res.acousticImpedanceGradient[0] < 0, 'd(Z)/dT must be negative');
      assert.ok(res.acousticImpedanceGradient[1] > 0, 'd(Z)/dP must be positive');
      assert.ok(res.volumetricHeatCapacityGradient[0] < 0, 'd(rho*cp)/dT must be negative');
      assert.ok(res.volumetricHeatCapacityGradient[1] > 0, 'd(rho*cp)/dP must be positive');
    }
  }

  // Strict domain enforcement: out-of-box queries must refuse (never extrapolate).
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 150, 101_325).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 1500, 101_325).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 300, 5_000).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 300, 900_000).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'fe', 300, 101_325).ok, false);

  // WGSL helpers reference rf_eval.
  const wgsl = gasResponseFunctionGpuWgsl('gas_rf_table');
  assert.match(wgsl, /fn a4_gas_density_eval/);
  assert.match(wgsl, /fn a4_gas_sound_speed_eval/);
  assert.match(wgsl, /fn a4_gas_viscosity_eval/);
  assert.match(wgsl, /fn a4_gas_conductivity_eval/);
  assert.match(wgsl, /fn a4_gas_acoustic_impedance_eval/);
  assert.match(wgsl, /fn a4_gas_volumetric_heat_capacity_eval/);
  assert.match(wgsl, /rf_eval/);
});

test('buildMlsMpmMechanicsMaterialTable attaches clone-safe A4 gas response table and GPU upload cleans up', () => {
  const table = buildMlsMpmMechanicsMaterialTable(SAMPLE_MATERIALS);
  assert.equal(table.a4GasResponseStatus.materialCount, 2);
  assert.equal(table.a4GasResponseStatus.functionCount, 12);
  assert.ok(table.a4GasResponseTable?.data instanceof Float32Array);

  // Must remain structuredClone-safe for worker postMessage.
  const cloned = structuredClone(table);
  assert.equal(cloned.a4GasResponseStatus.functionCount, 12);
  assert.deepEqual(Array.from(cloned.a4GasResponseTable.data), Array.from(table.a4GasResponseTable.data));

  // Verify GPU upload creates and destroys the A4 gas response table buffer.
  const created = [];
  const destroyed = [];
  const mockDevice = {
    createBuffer(desc) {
      const buf = {
        ...desc,
        destroy() { destroyed.push(desc.label); }
      };
      created.push(desc.label);
      return buf;
    },
    queue: { writeBuffer() {} }
  };
  const upload = uploadMlsMpmMechanicsMaterialPhaseRecords(mockDevice, table);
  assert.ok(upload.a4GasResponseTableBuffer);
  assert.ok(created.includes('ulg-mls-mpm-a4-gas-response-table'));
  destroyMlsMpmMechanicsMaterialPhaseUpload(upload);
  assert.ok(destroyed.includes('ulg-mls-mpm-a4-gas-response-table'));
});

test('sphImplicitPressureGpu and sphThermalRegionalClosureGpu export A3 regional closure live hooks', () => {
  assert.equal(typeof encodeSphImplicitPressureRegionalClosureScheduleTick, 'function');
  assert.equal(typeof getSphImplicitPressureRegionalClosureLane, 'function');
  assert.equal(getSphImplicitPressureRegionalClosureLane(null), null);
  assert.equal(SPH_THERMAL_REGIONAL_CLOSURE_SCHEMA, 'peercompute.ulg.a3-thermal-regional-closure.v1');
  assert.equal(SPH_THERMAL_REGIONAL_G4_REGION_COUNT, 8);
  assert.equal(getSphThermalRegionalClosureLane(null), null);

  // Verify single-pass schedule-boundary encoding and cleanup on a mock device.
  const passes = [];
  const dispatches = [];
  const destroyed = [];
  const mockDevice = {
    limits: { maxStorageBuffersPerShaderStage: 16 },
    createShaderModule: (d) => d,
    createBindGroupLayout: (d) => d,
    createPipelineLayout: (d) => d,
    createComputePipeline: (d) => d,
    createBindGroup: (d) => d,
    createBuffer(d) {
      return { ...d, destroyed: false, destroy() { this.destroyed = true; destroyed.push(d.label); } };
    },
    queue: { writeBuffer() {} }
  };
  const encoder = {
    beginComputePass(desc) {
      passes.push(desc.label);
      let ep = null;
      return {
        setPipeline(p) { ep = p.compute.entryPoint; },
        setBindGroup() {},
        dispatchWorkgroups(x) { dispatches.push({ ep, x }); },
        end() {}
      };
    }
  };
  const stateBuffer = mockDevice.createBuffer({ label: 'state', size: 1024, usage: 0x80 });
  const thermoBuffer = mockDevice.createBuffer({ label: 'thermo', size: 1536, usage: 0x80 });
  const tick = encodeSphThermalRegionalClosureScheduleTick(mockDevice, encoder, {
    stateBuffer,
    thermoBuffer,
    particleCount: 32,
    boxDimsM: [1, 1, 1],
    scheduleId: 'thermal-a3-test:1'
  });
  assert.equal(tick.adopted, true);
  assert.equal(tick.status.regionCount, 8);
  assert.equal(tick.status.evaluatedSchedules, 1);
  assert.equal(passes.length, 1, 'thermal A3 tick must fit in ONE single schedule-boundary compute pass');
  assert.ok(dispatches.some((d) => d.ep === 'thermal_pack_regional_members'));
  assert.ok(dispatches.some((d) => d.ep === 'lookup_members'));
  assert.ok(dispatches.some((d) => d.ep === 'adopt_pending'));
  assert.ok(getSphThermalRegionalClosureLane(mockDevice));
  assert.equal(destroySphThermalRegionalClosureResources(mockDevice), true);
  assert.equal(getSphThermalRegionalClosureLane(mockDevice), null);
  assert.ok(destroyed.length >= 6);
});
