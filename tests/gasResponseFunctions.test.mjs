import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GAS_RESPONSE_FUNCTIONS_SCHEMA,
  buildMaterialGasResponseFunctions,
  evaluateMaterialGasResponseCpu,
  gasResponseFunctionGpuWgsl
} from '../src/runtime/material/gasResponseFunctions.js';
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

test('A4 2-D gas response functions fit density(T,P) and soundSpeed(T,P) strictly in-box', () => {
  const bundle = buildMaterialGasResponseFunctions(SAMPLE_MATERIALS);
  assert.equal(bundle.schema, GAS_RESPONSE_FUNCTIONS_SCHEMA);
  assert.equal(bundle.status.materialCount, 2);
  assert.equal(bundle.status.functionCount, 4);
  assert.ok(bundle.status.maxRelativeResidualBound > 0 && bundle.status.maxRelativeResidualBound <= 1e-5);
  assert.ok(bundle.packedGpuTable?.data instanceof Float32Array);
  assert.equal(bundle.packedGpuTable.functionCount, 4);
  assert.equal(bundle.byMaterial.fe, undefined, 'solid-only material has no gas response record');

  // Verify interior accuracy and physical partial-derivative signs across (T, P).
  for (const [material, props] of [['n2', SAMPLE_MATERIALS.n2], ['h2o', SAMPLE_MATERIALS.h2o]]) {
    const M = props.molarMassKgPerMol;
    const Rspec = AVOGADRO_R / M;
    const cp = props.phases.find((p) => p.name === 'gas').cpJPerKgK;
    const gamma = cp / (cp - Rspec);
    for (const [T, P] of [[250, 50_000], [293.15, 101_325], [600, 250_000], [1150, 480_000]]) {
      const res = evaluateMaterialGasResponseCpu(bundle, material, T, P);
      assert.equal(res.ok, true, `${material} @ (${T}, ${P})`);
      const exactRho = (P * M) / (AVOGADRO_R * T);
      const exactC = Math.sqrt(gamma * Rspec * T);
      const relRho = Math.abs(res.densityKgPerM3 - exactRho) / exactRho;
      const relC = Math.abs(res.soundSpeedMPerS - exactC) / exactC;
      assert.ok(relRho <= 1e-5, `${material} density relErr ${relRho}`);
      assert.ok(relC <= 1e-5, `${material} soundSpeed relErr ${relC}`);
      assert.ok(res.densityGradient[0] < 0, 'd(rho)/dT must be negative');
      assert.ok(res.densityGradient[1] > 0, 'd(rho)/dP must be positive');
      assert.ok(res.soundSpeedGradient[0] > 0, 'd(c_s)/dT must be positive');
    }
  }

  // Strict domain enforcement: out-of-box queries must refuse (never extrapolate).
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 150, 101_325).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 1500, 101_325).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 300, 5_000).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'n2', 300, 900_000).ok, false);
  assert.equal(evaluateMaterialGasResponseCpu(bundle, 'fe', 300, 101_325).ok, false);

  // WGSL helper references rf_eval.
  const wgsl = gasResponseFunctionGpuWgsl('gas_rf_table');
  assert.match(wgsl, /fn a4_gas_density_eval/);
  assert.match(wgsl, /fn a4_gas_sound_speed_eval/);
  assert.match(wgsl, /rf_eval/);
});

test('buildMlsMpmMechanicsMaterialTable attaches clone-safe A4 gas response table and GPU upload cleans up', () => {
  const table = buildMlsMpmMechanicsMaterialTable(SAMPLE_MATERIALS);
  assert.equal(table.a4GasResponseStatus.materialCount, 2);
  assert.equal(table.a4GasResponseStatus.functionCount, 4);
  assert.ok(table.a4GasResponseTable?.data instanceof Float32Array);

  // Must remain structuredClone-safe for worker postMessage.
  const cloned = structuredClone(table);
  assert.equal(cloned.a4GasResponseStatus.functionCount, 4);
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

test('sphImplicitPressureGpu exports A3 regional closure live hooks', () => {
  assert.equal(typeof encodeSphImplicitPressureRegionalClosureScheduleTick, 'function');
  assert.equal(typeof getSphImplicitPressureRegionalClosureLane, 'function');
  assert.equal(getSphImplicitPressureRegionalClosureLane(null), null);
});
