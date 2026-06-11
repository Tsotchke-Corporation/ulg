import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import {
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  SPH_GPU_RENDER_ROW_FLOATS,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
  buildSphRenderMaterialMap,
  decodeSphRenderRows,
  extractSphRenderRowsCpu,
  extractSphRenderRowsWithOptionalWebGpu
} from '../src/runtime/sph/sphRenderGpuKernel.js';

const materialProperties = {
  Au: {
    molarMassKgPerMol: 0.19696657,
    conductionElectronDensityPerM3: 5.9e28,
    opticalInterbandOscillators: [],
    phases: [{ name: 'solid', densityKgPerM3: 19300 }]
  },
  h2o: {
    molarMassKgPerMol: 0.01801528,
    phases: [
      { name: 'liquid', densityKgPerM3: 997 },
      { name: 'gas', densityKgPerM3: 0.6 }
    ]
  },
  naoh: {
    molarMassKgPerMol: 0.039997,
    phases: [{ name: 'liquid', densityKgPerM3: 2130 }]
  }
};

const reactionTable = {
  metadata: [{
    a: 'Na',
    aMaterialId: stableOpticalMaterialId('Na'),
    b: 'h2o',
    bMaterialId: stableOpticalMaterialId('h2o'),
    product: 'naoh',
    productMaterialId: stableOpticalMaterialId('naoh')
  }]
};

function packedRenderParticles() {
  const state = new Float32Array(3 * SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([1, 2, 3, 4, 0, 0, 0, 10], 0);
  state.set([2, 3, 4, 5, 0, 0, 0, 20], SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([3, 4, 5, 6, 0, 0, 0, 30], SPH_GPU_PARTICLE_STATE_FLOATS * 2);

  const thermo = new Float32Array(3 * SPH_GPU_PARTICLE_THERMO_FLOATS);
  thermo.set([
    stableOpticalMaterialId('Au'),
    GPU_PHASE_IDS.solid,
    293.15,
    19300,
    1,
    0,
    0,
    0,
    0.1,
    1e20,
    1,
    0
  ], 0);
  thermo.set([
    stableOpticalMaterialId('h2o'),
    GPU_PHASE_IDS.gas,
    1200,
    0.6,
    0,
    0,
    1,
    0,
    0.1,
    2e20,
    1,
    0
  ], SPH_GPU_PARTICLE_THERMO_FLOATS);
  thermo.set([
    stableOpticalMaterialId('naoh'),
    GPU_PHASE_IDS.liquid,
    350,
    2130,
    0,
    1,
    0,
    0,
    0.1,
    3e20,
    1,
    0
  ], SPH_GPU_PARTICLE_THERMO_FLOATS * 2);

  return {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'test-packed',
    particleCount: 3,
    step: 0,
    time: 0,
    smoothingLengthM: 0.1,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    state,
    thermo
  };
}

test('SPH render rows CPU extraction compacts position, thermo, and phase state', () => {
  const packed = packedRenderParticles();
  const result = extractSphRenderRowsCpu({ sphParticleState: packed });

  assert.equal(result.schema, ULG_SPH_GPU_RENDER_ROWS_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.particleCount, 3);
  assert.equal(result.rowStrideFloats, 12);
  assert.equal(result.renderRows.length, 3 * SPH_GPU_RENDER_ROW_FLOATS);
  assert.deepEqual(Array.from(result.renderRows.slice(0, 12)), [
    1,
    2,
    3,
    4,
    stableOpticalMaterialId('Au'),
    GPU_PHASE_IDS.solid,
    293.1499938964844,
    1,
    19300,
    0,
    100000002004087730000,
    0
  ]);
});

test('SPH render row decoding preserves material identity, phase render keys, and incandescence', () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const decoded = decodeSphRenderRows(extracted.renderRows, {
    materialProperties,
    reactionTable
  });

  assert.equal(decoded.schema, ULG_SPH_GPU_RENDER_ROWS_SCHEMA);
  assert.equal(decoded.status, 'render-rows-decoded');
  assert.equal(decoded.particleCount, 3);
  assert.deepEqual(decoded.materials, [
    { material: 'Au', phase: 'solid', renderKey: 'Au' },
    { material: 'h2o', phase: 'gas', renderKey: 'steam' },
    { material: 'naoh', phase: 'liquid', renderKey: 'naoh' }
  ]);
  assert.deepEqual(decoded.rows.map((row) => row.renderKey), ['Au', 'steam', 'naoh']);
  assert.ok(decoded.colorsRgb[3] > 0.9);
  assert.ok(decoded.colorsRgb[4] > 0.25);
  assert.ok(decoded.emissiveByMaterial.h2o);
  assert.ok(decoded.emissiveByMaterial.steam);
});

test('SPH render material map includes derived reaction products', () => {
  const map = buildSphRenderMaterialMap({ Au: materialProperties.Au }, reactionTable);

  assert.equal(map.get(stableOpticalMaterialId('Au')), 'Au');
  assert.equal(map.get(stableOpticalMaterialId('Na')), 'Na');
  assert.equal(map.get(stableOpticalMaterialId('h2o')), 'h2o');
  assert.equal(map.get(stableOpticalMaterialId('naoh')), 'naoh');
});

test('SPH render row optional WebGPU accepts an injected compact-row runner', async () => {
  const packed = packedRenderParticles();
  const execution = await extractSphRenderRowsWithOptionalWebGpu({
    sphParticleState: packed,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      return {
        ...extractSphRenderRowsCpu(args),
        backend: 'webgpu',
        compactRenderReadback: true
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.result.renderRows.length, packed.particleCount * SPH_GPU_RENDER_ROW_FLOATS);
  assert.equal(execution.compactRenderReadback, true);
});
