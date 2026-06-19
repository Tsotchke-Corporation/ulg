import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';
import {
  SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN,
  SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN,
  SPH_SURFACE_RADIUS_SCALE_DEFAULT,
  normalizeSurfaceRadiusForRenderField,
  surfaceRadiusScaleForRenderBatch
} from '../src/visualization/sphPhaseScene.js';
import {
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS,
  SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
  SPH_GPU_RENDER_SURFACE_DRAW_FLOATS,
  SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT,
  SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_RENDER_ROW_FLOATS,
  SPH_GPU_RENDER_SURFACE_ROW_FLOATS,
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
  buildSphRenderSurfaceDrawMetadataWebGpu,
  buildSphRenderFieldCpu,
  buildSphRenderFieldWebGpu,
  buildSphRenderFieldSurfaceTable,
  buildSphRenderFieldWithOptionalWebGpu,
  buildSphMaterialInterfaceSourceFieldWebGpu,
  buildSphPhysicsMaterialInterfaceFieldWebGpu,
  buildSphRenderMaterialMap,
  buildSphRenderSurfaceVerticesWebGpu,
  compactSphMaterialInterfaceCandidates,
  deriveSphRenderMarchingCubeCellsCpu,
  deriveSphRenderMarchingCubeCellsWithOptionalWebGpu,
  deriveSphRenderSurfaceDrawMetadataCpu,
  deriveSphRenderSurfaceDrawMetadataWithOptionalWebGpu,
  deriveSphRenderSurfaceVerticesCpu,
  deriveSphRenderSurfaceVerticesWithOptionalWebGpu,
  deriveSphMaterialInterfaceCandidateField,
  deriveSphMaterialInterfaceCandidateFieldWithOptionalWebGpu,
  deriveSphMaterialInterfaceField,
  decodeSphRenderRows,
  extractSphRenderRowsCpu,
  extractSphRenderRowsWebGpu,
  extractSphRenderRowsWithOptionalWebGpu,
  splitSphRenderFieldBySurface,
  summarizeSphResidentParticleUploadWebGpu,
  summarizeSphRenderFieldSurfacesCpu,
  summarizeSphRenderFieldSurfacesWebGpu,
  summarizeSphRenderFieldSurfacesWithOptionalWebGpu
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
  },
  h2: {
    molarMassKgPerMol: 0.002016,
    phases: [{ name: 'gas', densityKgPerM3: 0.09 }]
  }
};

const reactionTable = {
  metadata: [{
    a: 'Na',
    aMaterialId: stableOpticalMaterialId('Na'),
    b: 'h2o',
    bMaterialId: stableOpticalMaterialId('h2o'),
    product: 'naoh',
    productMaterialId: stableOpticalMaterialId('naoh'),
    productTerms: [
      { material: 'naoh', materialId: stableOpticalMaterialId('naoh') },
      { material: 'h2', materialId: stableOpticalMaterialId('h2'), routing: 'gas' }
    ]
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

function twoSurfaceRenderField() {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1]
    },
    {
      surfaceKey: 'steam|h2o|gas',
      material: 'h2o',
      phase: 'gas',
      renderKey: 'steam',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.4, 0.8, 1]
    }
  ]);
  return buildSphRenderFieldCpu({
    renderRows: extracted.renderRows,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 10
  });
}

function centeredSingleSurfaceRenderField() {
  const state = new Float32Array(SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([5, 5, 5, 4, 0, 0, 0, 10], 0);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_FLOATS);
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
  const packed = {
    schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
    status: 'test-centered-single-particle',
    particleCount: 1,
    step: 0,
    time: 0,
    smoothingLengthM: 0.1,
    stateStrideFloats: SPH_GPU_PARTICLE_STATE_FLOATS,
    thermoStrideFloats: SPH_GPU_PARTICLE_THERMO_FLOATS,
    state,
    thermo
  };
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 12,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1]
    }
  ]);
  return buildSphRenderFieldCpu({
    renderRows: extracted.renderRows,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 10
  });
}

function fakeSurfaceDrawDevice({
  drawRows = new Float32Array(),
  compactedVertexRows = new Float32Array(),
  drawIndirectRows = new Uint32Array(),
  summaryRows = null,
  stateRows = null,
  thermoRows = null
}) {
  const shaderModules = [];
  const bindGroups = [];
  const dispatches = [];
  const copies = [];
  const createdBuffers = [];
  const queueWrites = [];
  const device = {
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({ buffer, offset, byteLength: data?.byteLength ?? 0 });
      },
      submit(commands) {
        this.submitted = commands;
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer({ label, size, usage }) {
      const buffer = {
        label,
        size,
        usage,
        destroyed: false,
        async mapAsync() {},
        getMappedRange() {
          const source = label.includes('render-field-surface-summary-readback')
            ? (summaryRows || drawRows)
            : label.includes('resident-debug-state-readback')
            ? (stateRows || drawRows)
            : label.includes('resident-debug-thermo-readback')
            ? (thermoRows || drawRows)
            : label.includes('compacted-vertex-readback')
            ? compactedVertexRows
            : label.includes('indirect-readback')
            ? drawIndirectRows
            : drawRows;
          return source.buffer.slice(source.byteOffset, source.byteOffset + Math.min(source.byteLength, size));
        },
        unmap() {
          this.unmapped = true;
        },
        destroy() {
          this.destroyed = true;
        }
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createShaderModule({ label, code }) {
      const module = { label, code };
      shaderModules.push(module);
      return module;
    },
    createComputePipeline({ label, layout, compute }) {
      return {
        label,
        layout,
        compute,
        getBindGroupLayout(index) {
          return { index, entryPoint: compute.entryPoint };
        }
      };
    },
    createBindGroup({ layout, entries }) {
      const bindGroup = { layout, entries };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline(pipeline) {
              this.pipeline = pipeline;
            },
            setBindGroup(index, bindGroup) {
              this.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(count) {
              dispatches.push({ count, pipeline: this.pipeline, bindGroup: this.bindGroup?.bindGroup });
            },
            end() {
              this.ended = true;
            }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        finish() {
          return { dispatches: [...dispatches], copies: [...copies] };
        }
      };
    }
  };
  return { device, shaderModules, bindGroups, dispatches, copies, createdBuffers, queueWrites };
}

test('SPH render rows CPU extraction compacts position, thermo, and phase state', () => {
  const packed = packedRenderParticles();
  const result = extractSphRenderRowsCpu({ sphParticleState: packed });

  assert.equal(result.schema, ULG_SPH_GPU_RENDER_ROWS_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.particleCount, 3);
  assert.equal(result.rowStrideFloats, 16);
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
  assert.ok(result.renderRows[12] > 0);
  assert.ok(result.renderRows[13] > 0);
  assert.equal(result.renderRows[14], 1);
  assert.equal(result.renderRows[15], 0);
});

test('SPH render rows carry MLS-MPM current volume, radius, J, and pressure when mechanics are available', () => {
  const packed = packedRenderParticles();
  const mechanics = new Float32Array(3 * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  mechanics[18] = 8;
  mechanics[19] = 0.001;
  mechanics[28] = 125000;
  const result = extractSphRenderRowsCpu({
    sphParticleState: packed,
    mlsMpmParticleState: {
      particleCount: 3,
      mechanics
    }
  });
  const expectedVolume = 0.008;
  const expectedRadius = Math.cbrt((3 * expectedVolume) / (4 * Math.PI));

  assert.ok(Math.abs(result.renderRows[12] - expectedVolume) < 1e-9);
  assert.ok(Math.abs(result.renderRows[13] - expectedRadius) < 1e-7);
  assert.equal(result.renderRows[14], 8);
  assert.equal(result.renderRows[15], 125000);
});

test('SPH render rows encode base/drop render domains without changing material identity', () => {
  const packed = packedRenderParticles();
  const result = extractSphRenderRowsCpu({
    sphParticleState: packed,
    renderDomainBaseCount: 1,
    renderDomainDropCount: 2
  });
  const decoded = decodeSphRenderRows(result.renderRows, {
    materialProperties,
    reactionTable
  });

  assert.equal(result.renderRows[11], 1);
  assert.equal(result.renderRows[SPH_GPU_RENDER_ROW_FLOATS + 11], 2);
  assert.equal(result.renderRows[SPH_GPU_RENDER_ROW_FLOATS * 2 + 11], 2);
  assert.equal(decoded.rows[0].renderDomainKey, 'base');
  assert.equal(decoded.rows[1].renderDomainKey, 'drop');
  assert.deepEqual(decoded.materials[0], {
    material: 'Au',
    phase: 'solid',
    renderKey: 'Au',
    renderDomainId: 1,
    renderDomainKey: 'base'
  });
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

test('SPH render field CPU splats same-material rows only into matching render domains', () => {
  const h2oMaterialId = stableOpticalMaterialId('h2o');
  const renderRows = new Float32Array(2 * SPH_GPU_RENDER_ROW_FLOATS);
  renderRows.set([
    1,
    1,
    1,
    1,
    h2oMaterialId,
    GPU_PHASE_IDS.liquid,
    300,
    1,
    997,
    0,
    1,
    1
  ], 0);
  renderRows.set([
    4,
    4,
    4,
    1,
    h2oMaterialId,
    GPU_PHASE_IDS.liquid,
    300,
    1,
    997,
    0,
    1,
    2
  ], SPH_GPU_RENDER_ROW_FLOATS);
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'h2o|h2o|liquid|domain:base',
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      renderDomainId: 1,
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.2, 0.35, 1]
    },
    {
      surfaceKey: 'h2o|h2o|liquid|domain:drop',
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      renderDomainId: 2,
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.2, 0.35, 1]
    },
    {
      surfaceKey: 'h2o|h2o|liquid|domain:empty',
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      renderDomainId: 3,
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.2, 0.35, 1]
    }
  ]);
  const field = buildSphRenderFieldCpu({
    renderRows,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 5
  });
  const surfaces = splitSphRenderFieldBySurface(field);

  assert.equal(table.metadata[0].renderDomainId, 1);
  assert.ok(Math.max(...surfaces[0].field) > 20);
  assert.ok(Math.max(...surfaces[1].field) > 20);
  assert.equal(Math.max(...surfaces[2].field), 0);
});

test('SPH render field CPU domain zero splats all same-material render domains', () => {
  const h2oMaterialId = stableOpticalMaterialId('h2o');
  const renderRows = new Float32Array(2 * SPH_GPU_RENDER_ROW_FLOATS);
  renderRows.set([
    2.5,
    2.5,
    2.5,
    1,
    h2oMaterialId,
    GPU_PHASE_IDS.liquid,
    300,
    1,
    997,
    0,
    1,
    1
  ], 0);
  renderRows.set([
    2.5,
    2.5,
    2.5,
    1,
    h2oMaterialId,
    GPU_PHASE_IDS.liquid,
    300,
    1,
    997,
    0,
    1,
    2
  ], SPH_GPU_RENDER_ROW_FLOATS);
  const splitTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'h2o|h2o|liquid|domain:base',
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      renderDomainId: 1,
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.2, 0.35, 1]
    },
    {
      surfaceKey: 'h2o|h2o|liquid|domain:drop',
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      renderDomainId: 2,
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.2, 0.35, 1]
    }
  ]);
  const unionTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'h2o|h2o|liquid',
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      renderDomainId: 0,
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.2, 0.35, 1]
    }
  ]);
  const splitField = buildSphRenderFieldCpu({
    renderRows,
    surfaceTable: splitTable,
    fieldPadding: 0.22,
    refEdgeM: 5
  });
  const unionField = buildSphRenderFieldCpu({
    renderRows,
    surfaceTable: unionTable,
    fieldPadding: 0.22,
    refEdgeM: 5
  });
  const splitSurfaces = splitSphRenderFieldBySurface(splitField);
  const [unionSurface] = splitSphRenderFieldBySurface(unionField);
  const splitMax = Math.max(...splitSurfaces[0].field) + Math.max(...splitSurfaces[1].field);
  const unionMax = Math.max(...unionSurface.field);

  assert.equal(unionTable.metadata[0].renderDomainId, 0);
  assert.ok(unionMax > Math.max(...splitSurfaces[0].field));
  assert.ok(Math.abs(unionMax - splitMax) < 1e-6);
});

test('SPH render field default surface scale keeps sparse same-material drops visible', () => {
  const h2oMaterialId = stableOpticalMaterialId('h2o');
  const renderRows = new Float32Array(27 * SPH_GPU_RENDER_ROW_FLOATS);
  let rowIndex = 0;
  for (const x of [2.3333333, 2.5, 2.6666667]) {
    for (const y of [2.5833333, 2.75, 2.9166667]) {
      for (const z of [2.3333333, 2.5, 2.6666667]) {
        renderRows.set([
          x,
          y,
          z,
          1,
          h2oMaterialId,
          GPU_PHASE_IDS.liquid,
          300,
          1,
          997,
          0,
          1,
          2
        ], rowIndex * SPH_GPU_RENDER_ROW_FLOATS);
        rowIndex += 1;
      }
    }
  }
  const sparseScale = surfaceRadiusScaleForRenderBatch({ count: 27 }, SPH_SURFACE_RADIUS_SCALE_DEFAULT);
  assert.equal(sparseScale, SPH_SPARSE_SURFACE_RADIUS_SCALE_MIN);
  const surfaceRadiusM = 0.183333420753479 * sparseScale;
  const radiusNorm = normalizeSurfaceRadiusForRenderField(surfaceRadiusM, 5);
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'h2o|h2o|liquid|domain:drop',
      material: 'h2o',
      phase: 'liquid',
      renderKey: 'h2o',
      renderDomainId: 2,
      resolution: SPH_SPARSE_RENDER_FIELD_RESOLUTION_MIN,
      isolation: 80,
      subtract: 24,
      radiusNorm,
      strength: (80 + 24) * radiusNorm * radiusNorm,
      colorLinear: [0.2, 0.35, 1]
    }
  ]);
  const field = buildSphRenderFieldCpu({
    renderRows,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 5
  });
  const [surface] = splitSphRenderFieldBySurface(field);

  assert.ok(surface.field.reduce((max, value) => Math.max(max, value), 0) > 80);
});

test('SPH render row decoding applies resident pressure optical state to H2O vapor', () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const decoded = decodeSphRenderRows(extracted.renderRows, {
    materialProperties,
    reactionTable,
    gasPressureSummary: {
      schema: 'peercompute.ulg.sph-sealed-gas-pressure-summary.v0',
      status: 'gpu-resident-reaction-pressure-summary',
      source: 'gpu-resident-reaction-summary',
      totalPressurePa: 150000,
      bySpecies: {
        h2o: {
          material: 'h2o',
          massKg: 0.01,
          moles: 0.5,
          temperatureK: 420,
          partialPressurePa: 48000
        }
      }
    }
  });

  assert.equal(decoded.materials[1].material, 'h2o');
  assert.equal(decoded.materials[1].phase, 'gas');
  assert.equal(decoded.materials[1].renderKey, 'steam');
  assert.equal(decoded.materials[1].opticalState.h2oPartialPressurePa, 48000);
  assert.equal(decoded.materials[1].opticalState.pressurePa, 150000);
  assert.equal(decoded.materials[1].opticalState.source, 'gpu-resident-reaction-summary');
  assert.equal(decoded.rows[1].opticalState.temperatureK, 420);
});

test('SPH render material map includes derived reaction products', () => {
  const map = buildSphRenderMaterialMap({ Au: materialProperties.Au }, reactionTable);

  assert.equal(map.get(stableOpticalMaterialId('Au')), 'Au');
  assert.equal(map.get(stableOpticalMaterialId('Na')), 'Na');
  assert.equal(map.get(stableOpticalMaterialId('h2o')), 'h2o');
  assert.equal(map.get(stableOpticalMaterialId('naoh')), 'naoh');
  assert.equal(map.get(stableOpticalMaterialId('h2')), 'h2');
});

test('SPH render material map canonicalizes formula keys for GPU material ids', () => {
  const map = buildSphRenderMaterialMap({ H2O: materialProperties.h2o });

  assert.equal(map.get(stableOpticalMaterialId('h2o')), 'h2o');
  assert.equal(map.get(stableOpticalMaterialId('H2O')), 'h2o');
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

test('SPH render row WebGPU extraction can retain resident rows without full readback', async () => {
  const packed = packedRenderParticles();
  const { device, dispatches, copies, createdBuffers } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(),
    compactedVertexRows: new Float32Array()
  });
  let submittedWorkDoneCount = 0;
  device.queue.onSubmittedWorkDone = async () => {
    submittedWorkDoneCount += 1;
  };

  const result = await extractSphRenderRowsWebGpu({
    device,
    sphParticleState: packed,
    readbackMode: 'no-full-readback',
    retainRenderRowsBuffer: true
  });

  const expectedBytes = packed.particleCount * SPH_GPU_RENDER_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT;
  assert.equal(result.schema, ULG_SPH_GPU_RENDER_ROWS_SCHEMA);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, 'render-rows-extracted');
  assert.equal(result.readbackMode, 'no-full-readback');
  assert.equal(result.renderRows.length, 0);
  assert.equal(result.renderRowsReadback, false);
  assert.equal(result.compactRenderReadback, false);
  assert.equal(result.fullReadbackPerformed, false);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.renderRowByteLength, expectedBytes);
  assert.equal(result.renderRowsReadbackByteLength, 0);
  assert.equal(result.renderRowsBufferRetained, true);
  assert.equal(result.renderRowsBufferByteLength, expectedBytes);
  assert.equal(result.renderRowsBuffer.label, 'ulg-sph-render-rows-retained-handoff');
  assert.equal(result.renderRowsGpuHandoffCopy, true);
  assert.equal(result.renderRowsHandoffMode, 'gpu-copy-barrier');
  assert.equal(result.queueCompletionStatus, 'queue-submitted-gpu-handoff-no-cpu-fence');
  assert.equal(result.queueCompletionMethod, 'queue.submit(in-order-gpu-copy-handoff)');
  assert.equal(result.renderRowsDeferredCleanup, true);
  assert.equal(submittedWorkDoneCount, 0);
  assert.equal(dispatches.length, 1);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].source.label, 'ulg-sph-render-rows');
  assert.equal(copies[0].destination.label, 'ulg-sph-render-rows-retained-handoff');
  assert.equal(copies[0].size, expectedBytes);
  assert.equal(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-render-readback'), false);
  result.destroyRenderRowsBuffer();
  assert.equal(result.renderRowsBuffer.destroyed, true);
});

test('SPH resident particle upload debug summarizes retained GPU buffers and render rows', async () => {
  const packed = packedRenderParticles();
  const expectedRenderRows = extractSphRenderRowsCpu({ sphParticleState: packed }).renderRows;
  const { device, dispatches, copies } = fakeSurfaceDrawDevice({
    drawRows: expectedRenderRows,
    stateRows: packed.state,
    thermoRows: packed.thermo
  });
  const summary = await summarizeSphResidentParticleUploadWebGpu({
    device,
    sphParticleState: packed,
    sphParticleUpload: {
      status: 'webgpu-uploaded',
      stateBuffer: { label: 'retained-state' },
      thermoBuffer: { label: 'retained-thermo' },
      step: 7,
      time: 0.35
    },
    includeRenderRows: true
  });

  assert.equal(summary.status, 'resident-particle-upload-debug-ready');
  assert.equal(summary.sourceStep, 7);
  assert.equal(summary.sourceTime, 0.35);
  assert.equal(summary.particleRows.particleCount, 3);
  assert.equal(summary.particleRows.positiveMassCount, 3);
  assert.equal(summary.particleRows.zeroPositionCount, 0);
  assert.deepEqual(summary.particleRows.boundsM.min, [1, 2, 3]);
  assert.deepEqual(summary.particleRows.boundsM.max, [3, 4, 5]);
  assert.ok(Math.abs(summary.particleRows.minTemperatureK - 293.15) < 1e-4);
  assert.equal(summary.particleRows.maxTemperatureK, 1200);
  assert.equal(summary.renderRows.particleCount, 3);
  assert.equal(summary.renderRows.positiveMassCount, 3);
  assert.deepEqual(summary.renderRows.boundsM.min, [1, 2, 3]);
  assert.deepEqual(summary.renderRows.boundsM.max, [3, 4, 5]);
  assert.equal(dispatches.length, 1);
  assert.equal(copies.length, 3);
});

test('SPH render row optional WebGPU reports resident no-readback rows', async () => {
  const packed = packedRenderParticles();
  const retainedRenderRowsBuffer = { label: 'test-resident-render-rows-buffer' };
  const execution = await extractSphRenderRowsWithOptionalWebGpu({
    sphParticleState: packed,
    readbackMode: 'no-full-readback',
    retainRenderRowsBuffer: true,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainRenderRowsBuffer, true);
      return {
        schema: ULG_SPH_GPU_RENDER_ROWS_SCHEMA,
        backend: 'webgpu',
        status: 'render-rows-extracted',
        particleCount: packed.particleCount,
        rowLayout: [],
        rowStrideFloats: SPH_GPU_RENDER_ROW_FLOATS,
        renderRows: new Float32Array(),
        renderRowByteLength: packed.particleCount * SPH_GPU_RENDER_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT,
        renderRowsReadbackByteLength: 0,
        renderRowsBuffer: retainedRenderRowsBuffer,
        renderRowsBufferRetained: true,
        renderRowsBufferByteLength: packed.particleCount * SPH_GPU_RENDER_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT,
        readbackMode: 'no-full-readback',
        renderRowsReadback: false,
        compactRenderReadback: false,
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_ROWS_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.compactRenderReadback, false);
  assert.equal(execution.readbackMode, 'no-full-readback');
  assert.equal(execution.result.renderRows.length, 0);
  assert.equal(execution.result.renderRowsBuffer, retainedRenderRowsBuffer);
  assert.equal(execution.result.normalHotLoopReadbackFree, true);
});

test('SPH render field surface table packs generic material-phase surfaces', () => {
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 80,
      subtract: 24,
      radiusNorm: 0.14,
      colorLinear: [1, 0.8, 0.2]
    },
    {
      surfaceKey: 'steam|h2o|gas',
      material: 'h2o',
      phase: 'gas',
      renderKey: 'steam',
      resolution: 8,
      isolation: 24,
      subtract: 10,
      radiusNorm: 0.12,
      colorLinear: [0.6, 0.8, 1]
    }
  ]);

  assert.equal(table.schema, ULG_SPH_GPU_RENDER_FIELD_SCHEMA);
  assert.equal(table.surfaceCount, 2);
  assert.equal(table.rowStrideFloats, SPH_GPU_RENDER_SURFACE_ROW_FLOATS);
  assert.equal(table.totalFieldCells, 8 ** 3 * 2);
  assert.equal(table.metadata[0].materialId, stableOpticalMaterialId('Au'));
  assert.equal(table.metadata[0].phaseId, GPU_PHASE_IDS.solid);
  assert.equal(table.metadata[1].materialId, stableOpticalMaterialId('h2o'));
  assert.equal(table.metadata[1].phaseId, GPU_PHASE_IDS.gas);
});

test('SPH render field CPU splats only matching material-phase rows', () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1]
    },
    {
      surfaceKey: 'steam|h2o|gas',
      material: 'h2o',
      phase: 'gas',
      renderKey: 'steam',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.4, 0.8, 1]
    }
  ]);
  const field = buildSphRenderFieldCpu({
    renderRows: extracted.renderRows,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 10
  });
  const surfaces = splitSphRenderFieldBySurface(field);

  assert.equal(field.schema, ULG_SPH_GPU_RENDER_FIELD_SCHEMA);
  assert.equal(field.backend, 'cpu-reference');
  assert.equal(field.rowStrideFloats, SPH_GPU_RENDER_FIELD_CELL_FLOATS);
  assert.equal(field.fieldRows.length, table.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS);
  assert.equal(surfaces.length, 2);
  assert.ok(Math.max(...surfaces[0].field) > 20);
  assert.ok(Math.max(...surfaces[1].field) > 20);
  assert.ok(surfaces[0].palette.some((value) => value > 0));
  assert.ok(surfaces[1].palette.some((value) => value > 0));
});

test('SPH material interface candidate field keeps fixed cell-axis rows for GPU residency', () => {
  const field = twoSurfaceRenderField();
  const candidateField = deriveSphMaterialInterfaceCandidateField(field);
  const compacted = compactSphMaterialInterfaceCandidates(candidateField);

  assert.equal(candidateField.schema, 'peercompute.ulg.sph-material-interface-candidate-field.v0');
  assert.equal(candidateField.backend, 'cpu-reference');
  assert.equal(candidateField.status, 'material-interface-candidate-field-ready');
  assert.equal(candidateField.candidateShape, 'fixed-render-field-cell-axis-triplets');
  assert.equal(candidateField.rowStrideFloats, SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS);
  assert.equal(candidateField.candidateCount, field.totalFieldCells * 3);
  assert.equal(candidateField.candidateRows.length, candidateField.candidateCount * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS);
  assert.ok(candidateField.activeCandidateCount > 0);
  assert.equal(candidateField.surfaces.length, 2);
  assert.equal(candidateField.surfaces[0].candidateOffset, field.surfaceTable.metadata[0].fieldOffset * 3);
  assert.equal(candidateField.surfaces[0].candidateCount, field.surfaceTable.metadata[0].fieldCellCount * 3);
  assert.equal(compacted.candidateFieldSchema, candidateField.schema);
  assert.equal(compacted.candidateCount, candidateField.candidateCount);
  assert.equal(compacted.activeCandidateCount, candidateField.activeCandidateCount);
  assert.equal(compacted.candidateStrideFloats, SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS);
  assert.equal(compacted.elementCount, candidateField.activeCandidateCount);
  assert.ok(compacted.totalSurfaceAreaM2 > 0);
});

test('SPH material interface candidate field optional WebGPU accepts parity-passing runner', async () => {
  const field = twoSurfaceRenderField();
  const execution = await deriveSphMaterialInterfaceCandidateFieldWithOptionalWebGpu({
    renderField: field,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.candidateCount, field.totalFieldCells * 3);
      assert.equal(args.rowStrideFloats, SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS);
      return {
        ...deriveSphMaterialInterfaceCandidateField(args.renderField, {
          isolationScale: args.isolationScale
        }),
        backend: 'webgpu'
      };
    }
  });

  assert.equal(execution.schema, 'peercompute.ulg.sph-material-interface-candidate-field-execution.v0');
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuStatus.parityMaxAbsDiff, 0);
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.candidateReadback, true);
});

test('SPH material interface candidate field optional WebGPU rejects parity drift', async () => {
  const field = twoSurfaceRenderField();
  const execution = await deriveSphMaterialInterfaceCandidateFieldWithOptionalWebGpu({
    renderField: field,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      const result = deriveSphMaterialInterfaceCandidateField(args.renderField, {
        isolationScale: args.isolationScale
      });
      result.backend = 'webgpu';
      result.candidateRows = new Float32Array(result.candidateRows);
      result.candidateRows[15] = result.candidateRows[15] > 0 ? 0 : 1;
      return result;
    }
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.status, 'webgpu-parity-failed-cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'fallback-cpu');
  assert.equal(execution.result.backend, 'cpu-reference');
  assert.equal(execution.candidateReadback, false);
});

test('SPH material interface candidate field falls back before oversized WebGPU buffer creation', async () => {
  const field = twoSurfaceRenderField();
  const execution = await deriveSphMaterialInterfaceCandidateFieldWithOptionalWebGpu({
    renderField: field,
    preferWebGpu: true,
    device: {
      limits: { maxBufferSize: 16 },
      queue: {
        writeBuffer() {
          throw new Error('writeBuffer should not run after maxBufferSize preflight');
        }
      },
      createBuffer() {
        throw new Error('createBuffer should not run after maxBufferSize preflight');
      }
    }
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.status, 'webgpu-error-cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'fallback-cpu');
  assert.match(execution.webgpuStatus.reason, /exceeds WebGPU device maxBufferSize/);
  assert.equal(execution.candidateReadback, false);
});

test('SPH material interface candidate field falls back before oversized storage binding', async () => {
  const field = twoSurfaceRenderField();
  const execution = await deriveSphMaterialInterfaceCandidateFieldWithOptionalWebGpu({
    renderField: field,
    preferWebGpu: true,
    device: {
      limits: {
        maxBufferSize: 1024 * 1024 * 1024,
        maxStorageBufferBindingSize: 16
      },
      queue: {
        writeBuffer() {
          throw new Error('writeBuffer should not run after storage binding preflight');
        }
      },
      createBuffer() {
        throw new Error('createBuffer should not run after storage binding preflight');
      }
    }
  });

  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.status, 'webgpu-error-cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'fallback-cpu');
  assert.match(execution.webgpuStatus.reason, /exceeds WebGPU device maxStorageBufferBindingSize/);
  assert.equal(execution.candidateReadback, false);
});

test('SPH material interface field derives surface normals and areas from render-field crossings', () => {
  const field = twoSurfaceRenderField();
  const interfaceField = deriveSphMaterialInterfaceField(field);

  assert.equal(interfaceField.schema, 'peercompute.ulg.sph-material-interface-field.v0');
  assert.equal(interfaceField.status, 'material-interface-field-ready');
  assert.equal(interfaceField.sourceSchema, ULG_SPH_GPU_RENDER_FIELD_SCHEMA);
  assert.equal(interfaceField.candidateFieldSchema, 'peercompute.ulg.sph-material-interface-candidate-field.v0');
  assert.equal(interfaceField.surfaceCount, 2);
  assert.equal(interfaceField.readySurfaceCount, 2);
  assert.ok(interfaceField.totalSurfaceAreaM2 > 0);
  assert.equal(interfaceField.candidateCount, field.totalFieldCells * 3);
  assert.equal(interfaceField.activeCandidateCount, interfaceField.elementCount);
  assert.ok(interfaceField.elementCount > 0);
  assert.equal(interfaceField.elementStrideFloats, SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS);
  assert.equal(interfaceField.elementRows.length, interfaceField.elementCount * SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS);
  assert.equal(interfaceField.elements.length, interfaceField.elementCount);
  assert.equal(interfaceField.forceCouplingStatus, 'blocked-pressure-force-solver-not-implemented');
  assert.equal(interfaceField.forceCouplingValidation, false);
  const areaFromElements = interfaceField.elements.reduce((sum, element) => sum + element.areaM2, 0);
  assert.ok(Math.abs(areaFromElements - interfaceField.totalSurfaceAreaM2) < 1e-9);
  const firstElement = interfaceField.elements[0];
  assert.equal(firstElement.status, 'interface-element-ready');
  assert.ok(firstElement.areaM2 > 0);
  assert.equal(firstElement.normal.length, 3);
  assert.equal(firstElement.normalAreaVectorM2.length, 3);
  assert.ok(firstElement.centroidM.every((value) => Number.isFinite(value)));
  for (const surface of interfaceField.surfaces) {
    assert.equal(surface.status, 'material-interface-derived');
    assert.ok(surface.surfaceAreaM2 > 0);
    assert.ok(surface.crossingFaceCount > 0);
    assert.ok(surface.elementCount > 0);
    assert.equal(surface.meanOutwardNormal.length, 3);
    assert.ok(surface.meanOutwardNormal.every((value) => Number.isFinite(value)));
    assert.ok(surface.areaCentroidM.every((value) => Number.isFinite(value)));
  }
});

test('SPH physics material interface WebGPU wrapper consumes retained field buffers', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const field = twoSurfaceRenderField();
  const candidateField = deriveSphMaterialInterfaceCandidateField(field);
  const { device, bindGroups, dispatches, copies } = fakeSurfaceDrawDevice({
    drawRows: candidateField.candidateRows,
    compactedVertexRows: new Float32Array()
  });
  const sourceField = await buildSphMaterialInterfaceSourceFieldWebGpu({
    device,
    renderRows: extracted.renderRows,
    surfaceTable: field.surfaceTable,
    particleCount: packed.particleCount,
    readbackMode: 'no-full-readback',
    source: 'resident-physics-loop-material-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  const interfaceField = await buildSphPhysicsMaterialInterfaceFieldWebGpu({
    device,
    renderField: sourceField,
    source: 'resident-physics-loop-material-interface-refresh',
    sourceCadence: 'resident-step-completed'
  });

  assert.equal(sourceField.schema, 'peercompute.ulg.sph-material-interface-source-field.v0');
  assert.equal(sourceField.status, 'material-interface-source-field-ready');
  assert.equal(sourceField.sourceRenderFieldSchema, ULG_SPH_GPU_RENDER_FIELD_SCHEMA);
  assert.equal(sourceField.fieldRowsBufferRetained, true);
  assert.equal(sourceField.surfaceBufferRetained, true);
  assert.equal(sourceField.queueCompletionStatus, 'queue-work-completed');
  assert.equal(sourceField.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(interfaceField.schema, 'peercompute.ulg.sph-material-interface-field.v0');
  assert.equal(interfaceField.status, 'material-interface-field-ready');
  assert.equal(interfaceField.backend, 'webgpu-candidate-readback');
  assert.equal(interfaceField.authority, 'resident-physics-material-interface-extractor');
  assert.equal(interfaceField.source, 'resident-physics-loop-material-interface-refresh');
  assert.equal(interfaceField.sourceCadence, 'resident-step-completed');
  assert.equal(interfaceField.sourceFieldSchema, 'peercompute.ulg.sph-material-interface-source-field.v0');
  assert.equal(interfaceField.sourceFieldStatus, 'material-interface-source-field-ready');
  assert.equal(interfaceField.sourceRenderFieldBackend, 'webgpu');
  assert.equal(interfaceField.sourceRenderFieldReadback, false);
  assert.equal(interfaceField.sourceFieldRowsBufferBound, true);
  assert.equal(interfaceField.sourceSurfaceBufferBound, true);
  assert.equal(interfaceField.candidateBackend, 'webgpu');
  assert.equal(interfaceField.candidateReadback, true);
  assert.equal(interfaceField.queueCompletionStatus, 'readback-map-completed');
  assert.equal(interfaceField.queueCompletionMethod, 'mapAsync(readback-buffer)');
  assert.equal(interfaceField.pressureInterfaceProducer, true);
  assert.equal(interfaceField.physicsStage, 'material-interface-extraction');
  assert.equal(interfaceField.readySurfaceCount, 2);
  assert.equal(interfaceField.elementCount, candidateField.activeCandidateCount);
  assert.ok(interfaceField.totalSurfaceAreaM2 > 0);
  assert.equal(bindGroups.length, 2);
  assert.equal(bindGroups[1].entries[0].resource.buffer, sourceField.surfaceBuffer);
  assert.equal(bindGroups[1].entries[1].resource.buffer, sourceField.fieldRowsBuffer);
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [
    Math.ceil(Math.max(1, field.surfaceTable.maxFieldCellCount) / 64),
    Math.ceil((field.maxFieldCellCount * 3) / 64)
  ]);
  assert.equal(copies.length, 1);
  sourceField.destroyMaterialInterfaceSourceFieldBuffers();
  assert.equal(sourceField.residentBufferLeaseSummary.skippedDestroyCount, 2);
  sourceField.releaseMaterialInterfaceSourceFieldLeases();
  sourceField.destroyMaterialInterfaceSourceFieldBuffers();
  assert.equal(sourceField.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
});

test('SPH physics material interface skips oversized visual-cadence candidate readback before allocation', async () => {
  const totalFieldCells = Math.ceil(
    (SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT + 1)
      / (3 * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT)
  );
  const renderField = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu',
    status: 'render-field-resident',
    surfaceCount: 1,
    totalFieldCells,
    renderFieldReadback: true
  };
  const interfaceField = await buildSphPhysicsMaterialInterfaceFieldWebGpu({
    device: {
      limits: {
        maxBufferSize: 1024 * 1024 * 1024,
        maxStorageBufferBindingSize: 1024 * 1024 * 1024
      },
      queue: {
        writeBuffer() {
          throw new Error('writeBuffer should not run after candidate readback budget gate');
        }
      },
      createBuffer() {
        throw new Error('createBuffer should not run after candidate readback budget gate');
      }
    },
    renderField,
    source: 'resident-render-refresh-physics-material-interface-extractor',
    sourceCadence: 'visual-render-refresh'
  });

  assert.equal(interfaceField.schema, 'peercompute.ulg.sph-material-interface-field.v0');
  assert.equal(interfaceField.status, 'material-interface-field-candidate-readback-skipped');
  assert.equal(interfaceField.backend, 'webgpu-candidate-readback-skipped');
  assert.equal(interfaceField.source, 'resident-render-refresh-physics-material-interface-extractor');
  assert.equal(interfaceField.sourceCadence, 'visual-render-refresh');
  assert.equal(interfaceField.candidateReadback, false);
  assert.equal(interfaceField.candidateReadbackBlockerStatus, 'candidate-readback-budget-exceeded');
  assert.ok(interfaceField.candidateRowsByteLength > SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT);
  assert.equal(interfaceField.queueCompletionStatus, 'not-submitted-candidate-readback-skipped');
  assert.equal(interfaceField.pressureInterfaceProducer, false);
  assert.equal(interfaceField.elementCount, 0);
});

test('SPH render field CPU splats only unplaced product-event mass', () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'h2|h2|gas',
      material: 'h2',
      phase: 'gas',
      renderKey: 'h2',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [0.6, 0.8, 1]
    }
  ]);
  const productEventRows = new Float32Array(SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS);
  productEventRows.set([
    2, 2, 2, 0.05,
    stableOpticalMaterialId('h2'), 1, 0, 0,
    1, 25, 1, GPU_PHASE_IDS.gas,
    0, 0.05, 1, 0.002016,
    360, 0.09, 1, 0
  ]);
  const field = buildSphRenderFieldCpu({
    renderRows: extracted.renderRows,
    productEventRows,
    productEventCount: 1,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 10
  });
  const surfaces = splitSphRenderFieldBySurface(field);

  assert.equal(field.productEventCount, 1);
  assert.ok(Math.max(...surfaces[0].field) > 20);

  productEventRows[13] = 0;
  const visibleOnlyField = buildSphRenderFieldCpu({
    renderRows: extracted.renderRows,
    productEventRows,
    productEventCount: 1,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 10
  });
  const visibleOnlySurfaces = splitSphRenderFieldBySurface(visibleOnlyField);

  assert.equal(Math.max(...visibleOnlySurfaces[0].field), 0);
});

test('SPH render field optional WebGPU accepts an injected field runner', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const retainedRenderRowsBuffer = { label: 'test-retained-render-rows-buffer' };
  const retainedProductEventBuffer = { label: 'test-product-event-buffer' };
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1]
    }
  ]);
  const execution = await buildSphRenderFieldWithOptionalWebGpu({
    renderRows: extracted.renderRows,
    renderRowsBuffer: retainedRenderRowsBuffer,
    productEventBuffer: retainedProductEventBuffer,
    productEventCount: 2,
    surfaceTable,
    particleCount: packed.particleCount,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.renderRowsBuffer, retainedRenderRowsBuffer);
      assert.equal(args.productEventBuffer, retainedProductEventBuffer);
      assert.equal(args.productEventCount, 2);
      assert.equal(args.particleCount, packed.particleCount);
      return {
        ...buildSphRenderFieldCpu(args),
        backend: 'webgpu',
        productEventBufferBound: Boolean(args.productEventBuffer),
        productEventBufferByteLength: args.productEventCount * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS * Float32Array.BYTES_PER_ELEMENT,
        renderFieldInputSource: args.renderRowsBuffer ? 'resident-render-rows-and-product-events-buffer' : 'uploaded-render-rows',
        renderFieldReadback: true
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.result.renderFieldInputSource, 'resident-render-rows-and-product-events-buffer');
  assert.equal(execution.result.productEventBufferBound, true);
  assert.equal(execution.result.fieldRows.length, surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS);
  assert.equal(execution.renderFieldReadback, true);
});

test('SPH render field optional WebGPU can retain resident field buffers without full readback', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const retainedRenderRowsBuffer = { label: 'test-retained-render-rows-buffer' };
  const retainedProductEventBuffer = { label: 'test-product-event-buffer' };
  const retainedFieldRowsBuffer = { label: 'test-field-buffer', destroyCount: 0 };
  retainedFieldRowsBuffer.destroy = () => {
    retainedFieldRowsBuffer.destroyCount += 1;
  };
  const retainedSurfaceBuffer = { label: 'test-surface-buffer', destroyCount: 0 };
  retainedSurfaceBuffer.destroy = () => {
    retainedSurfaceBuffer.destroyCount += 1;
  };
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1]
    }
  ]);
  const expectedFieldBytes = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const execution = await buildSphRenderFieldWithOptionalWebGpu({
    renderRows: extracted.renderRows,
    renderRowsBuffer: retainedRenderRowsBuffer,
    productEventBuffer: retainedProductEventBuffer,
    productEventCount: 2,
    surfaceTable,
    particleCount: packed.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.retainFieldRowsBuffer, true);
      assert.equal(args.retainSurfaceBuffer, true);
      assert.equal(args.renderRowsBuffer, retainedRenderRowsBuffer);
      assert.equal(args.productEventBuffer, retainedProductEventBuffer);
      return {
        ...buildSphRenderFieldCpu(args),
        backend: 'webgpu',
        fieldRows: new Float32Array(),
        fieldRowByteLength: expectedFieldBytes,
        renderFieldReadback: false,
        readbackMode: 'no-full-readback',
        fullReadbackPerformed: false,
        normalHotLoopReadbackFree: true,
        fieldRowsBufferRetained: true,
        fieldRowsBuffer: retainedFieldRowsBuffer,
        fieldRowsBufferByteLength: expectedFieldBytes,
        surfaceBufferRetained: true,
        surfaceBuffer: retainedSurfaceBuffer,
        surfaceBufferByteLength: surfaceTable.records.byteLength,
        destroyRenderFieldBuffers() {
          retainedFieldRowsBuffer.destroy();
          retainedSurfaceBuffer.destroy();
        }
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.renderFieldReadback, false);
  assert.equal(execution.readbackMode, 'no-full-readback');
  assert.equal(execution.result.fieldRows.length, 0);
  assert.equal(execution.result.normalHotLoopReadbackFree, true);
  assert.equal(execution.result.fieldRowsBufferRetained, true);
  assert.equal(execution.result.surfaceBufferRetained, true);
  assert.equal(execution.result.fieldRowsBufferByteLength, expectedFieldBytes);
  assert.equal(execution.result.surfaceBufferByteLength, surfaceTable.records.byteLength);
  execution.result.destroyRenderFieldBuffers();
  assert.equal(retainedFieldRowsBuffer.destroyCount, 1);
  assert.equal(retainedSurfaceBuffer.destroyCount, 1);
});

test('SPH render field WebGPU no-full handoff can avoid a CPU queue fence', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1]
    }
  ]);
  const { device, createdBuffers } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(),
    compactedVertexRows: new Float32Array()
  });
  let submittedWorkDoneCount = 0;
  let resolveSubmittedWork;
  device.queue.onSubmittedWorkDone = () => {
    submittedWorkDoneCount += 1;
    return new Promise((resolve) => {
      resolveSubmittedWork = resolve;
    });
  };

  const result = await buildSphRenderFieldWebGpu({
    device,
    renderRows: extracted.renderRows,
    surfaceTable,
    particleCount: packed.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    waitForQueueCompletion: false,
    deferCleanup: true,
    useQueueFenceForCleanup: false
  });

  assert.equal(result.queueCompletionStatus, 'queue-submitted-gpu-handoff-no-cpu-fence');
  assert.equal(result.queueCompletionMethod, 'queue.submit(in-order-gpu-render-field-handoff)');
  assert.equal(result.renderFieldDeferredCleanup, true);
  assert.equal(result.renderFieldReadback, false);
  assert.equal(result.normalHotLoopReadbackFree, true);
  assert.equal(result.fieldRowsBufferRetained, true);
  assert.equal(result.surfaceBufferRetained, true);
  assert.equal(submittedWorkDoneCount, 0);

  const sourceRowsBuffer = createdBuffers.find((buffer) => buffer.label === 'ulg-sph-render-field-source-rows');
  const sourceProductEventBuffer = createdBuffers.find((buffer) => buffer.label === 'ulg-sph-render-field-product-events');
  const paramsBuffer = createdBuffers.find((buffer) => buffer.label === 'ulg-sph-render-field-params');
  assert.equal(sourceRowsBuffer.destroyed, false);
  assert.equal(sourceProductEventBuffer.destroyed, false);
  assert.equal(paramsBuffer.destroyed, false);
  assert.equal(result.fieldRowsBuffer.destroyed, false);
  assert.equal(result.surfaceBuffer.destroyed, false);

  assert.equal(resolveSubmittedWork, undefined);
  result.destroyRenderFieldBuffers();

  assert.equal(sourceRowsBuffer.destroyed, true);
  assert.equal(sourceProductEventBuffer.destroyed, true);
  assert.equal(paramsBuffer.destroyed, true);
  assert.equal(result.fieldRowsBuffer.destroyed, false);
  assert.equal(result.surfaceBuffer.destroyed, false);
});

test('SPH render field retained buffers use lease guarded cleanup', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'Au|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'Au',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1]
    }
  ]);
  const { device } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(),
    compactedVertexRows: new Float32Array()
  });

  const result = await buildSphRenderFieldWebGpu({
    device,
    renderRows: extracted.renderRows,
    surfaceTable,
    particleCount: packed.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true
  });

  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(result.residentBufferLeaseResourceCount, 2);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 4);
  assert.equal(result.queueCompletionStatus, 'queue-work-completed');
  assert.equal(result.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  result.destroyRenderFieldBuffers();
  assert.equal(result.residentBufferLeaseSummary.skippedDestroyCount, 2);
  assert.equal(result.fieldRowsBuffer.destroyed, false);
  assert.equal(result.surfaceBuffer.destroyed, false);
  const released = result.releaseRenderFieldBufferLeases();
  assert.equal(released.activeLeaseCount, 0);
  result.destroyRenderFieldBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(result.fieldRowsBuffer.destroyed, true);
  assert.equal(result.surfaceBuffer.destroyed, true);
  result.destroyRenderFieldBuffers();
  assert.equal(result.fieldRowsBuffer.destroyed, true);
  assert.equal(result.surfaceBuffer.destroyed, true);
});

test('SPH render field surface summary CPU reports active resident surfaces', () => {
  const field = twoSurfaceRenderField();
  const summary = summarizeSphRenderFieldSurfacesCpu(field);

  assert.equal(summary.schema, ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA);
  assert.equal(summary.backend, 'cpu-reference');
  assert.equal(summary.rowStrideFloats, SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS);
  assert.equal(summary.summaryRows.length, field.surfaceCount * SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_FLOATS);
  assert.ok(summary.activeSurfaceCount > 0);
  assert.ok(summary.activeCellCount > 0);
  assert.ok(summary.maxDensity > 0);
  const activeSurface = summary.surfaces.find((surface) => surface.activeCellCount > 0);
  assert.ok(activeSurface);
  assert.ok(activeSurface.boundsRadiusM > 0);
  assert.ok(activeSurface.boundsCenterM.every((value) => Number.isFinite(value)));
});

test('SPH render field surface summary WebGPU reads compact summary from retained field buffers', async () => {
  const field = twoSurfaceRenderField();
  const cpuSummary = summarizeSphRenderFieldSurfacesCpu(field);
  const retainedFieldRowsBuffer = { label: 'retained-render-field-rows' };
  const retainedSurfaceBuffer = { label: 'retained-render-surface-table' };
  const { device, shaderModules, bindGroups, dispatches, copies } = fakeSurfaceDrawDevice({
    summaryRows: cpuSummary.summaryRows
  });

  const summary = await summarizeSphRenderFieldSurfacesWebGpu({
    device,
    renderField: field,
    fieldRowsBuffer: retainedFieldRowsBuffer,
    surfaceBuffer: retainedSurfaceBuffer,
    retainSummaryRowsBuffer: true
  });

  assert.equal(summary.schema, ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_SCHEMA);
  assert.equal(summary.backend, 'webgpu');
  assert.equal(summary.status, cpuSummary.status);
  assert.equal(summary.fieldRowsBufferBound, true);
  assert.equal(summary.surfaceBufferBound, true);
  assert.equal(summary.renderFieldSurfaceSummaryReadback, true);
  assert.equal(summary.summaryRowsBufferRetained, true);
  assert.equal(summary.summaryRowsByteLength, cpuSummary.summaryRows.byteLength);
  assert.deepEqual(Array.from(summary.summaryRows), Array.from(cpuSummary.summaryRows));
  assert.equal(summary.activeSurfaceCount, cpuSummary.activeSurfaceCount);
  assert.equal(summary.activeCellCount, cpuSummary.activeCellCount);
  assert.equal(summary.queueCompletionStatus, 'compact-summary-readback-map-completed');
  assert.equal(summary.queueCompletionMethod, 'mapAsync(compact-summary-readback-buffer)');
  assert.match(shaderModules[0].code, /sphRenderFieldSurfaceSummary|SurfaceSummaryParams|surface_summary_rows/);
  assert.equal(bindGroups[0].entries[0].resource.buffer, retainedSurfaceBuffer);
  assert.equal(bindGroups[0].entries[1].resource.buffer, retainedFieldRowsBuffer);
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [field.surfaceCount]);
  assert.ok(copies.some((copy) => copy.size === cpuSummary.summaryRows.byteLength));
});

test('SPH render field surface summary optional WebGPU accepts parity-passing compact summary', async () => {
  const field = twoSurfaceRenderField();
  const retainedFieldRowsBuffer = { label: 'retained-render-field-rows' };
  const retainedSurfaceBuffer = { label: 'retained-render-surface-table' };
  const execution = await summarizeSphRenderFieldSurfacesWithOptionalWebGpu({
    renderField: field,
    fieldRowsBuffer: retainedFieldRowsBuffer,
    surfaceBuffer: retainedSurfaceBuffer,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.fieldRowsBuffer, retainedFieldRowsBuffer);
      assert.equal(args.surfaceBuffer, retainedSurfaceBuffer);
      return {
        ...summarizeSphRenderFieldSurfacesCpu(args.renderField, {
          isolationScale: args.isolationScale
        }),
        backend: 'webgpu',
        fieldRowsBufferBound: Boolean(args.fieldRowsBuffer),
        surfaceBufferBound: Boolean(args.surfaceBuffer),
        renderFieldSurfaceSummaryReadback: true
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_FIELD_SURFACE_SUMMARY_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuStatus.parityMaxAbsDiff, 0);
  assert.equal(execution.result.fieldRowsBufferBound, true);
  assert.equal(execution.result.surfaceBufferBound, true);
  assert.equal(execution.renderFieldSurfaceSummaryReadback, true);
});

test('SPH render marching-cube cells classify fixed render-field voxels', () => {
  const field = twoSurfaceRenderField();
  const cells = deriveSphRenderMarchingCubeCellsCpu(field);

  assert.equal(cells.schema, ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA);
  assert.equal(cells.backend, 'cpu-reference');
  assert.equal(cells.cubeShape, 'fixed-surface-voxel-cubes');
  assert.equal(cells.rowStrideFloats, SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS);
  assert.equal(cells.totalCubeCells, field.totalFieldCells);
  assert.equal(cells.cellRows.length, cells.totalCubeCells * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS);
  assert.ok(cells.activeCellCount > 0);
  assert.ok(cells.reservedTriangleCount >= cells.activeCellCount);
  assert.equal(cells.reservedVertexCount, cells.reservedTriangleCount * 3);
  assert.equal(cells.surfaces.length, 2);
  assert.equal(cells.surfaces[0].cellOffset, field.surfaceTable.metadata[0].fieldOffset);
  assert.equal(cells.surfaces[0].voxelCount, 7 ** 3);

  let activeOffset = -1;
  for (let offset = 0; offset < cells.cellRows.length; offset += SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS) {
    if (cells.cellRows[offset + 15] > 0) {
      activeOffset = offset;
      break;
    }
  }
  assert.notEqual(activeOffset, -1);
  assert.ok(cells.cellRows[activeOffset + 8] > 0);
  assert.ok(cells.cellRows[activeOffset + 8] < 255);
  assert.ok(cells.cellRows[activeOffset + 9] > 0);
  assert.equal(cells.cellRows[activeOffset + 10], 12);
  assert.equal(cells.cellRows[activeOffset + 11], 36);
  assert.ok(cells.cellRows[activeOffset + 12] <= cells.cellRows[activeOffset + 14]);
  assert.ok(cells.cellRows[activeOffset + 13] >= cells.cellRows[activeOffset + 14]);
});

test('SPH render marching-cube cells optional WebGPU accepts parity-passing runner', async () => {
  const field = twoSurfaceRenderField();
  const retainedFieldRowsBuffer = { label: 'field-rows-buffer' };
  const retainedSurfaceBuffer = { label: 'surface-buffer' };
  const execution = await deriveSphRenderMarchingCubeCellsWithOptionalWebGpu({
    renderField: field,
    fieldRowsBuffer: retainedFieldRowsBuffer,
    surfaceBuffer: retainedSurfaceBuffer,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.fieldRowsBuffer, retainedFieldRowsBuffer);
      assert.equal(args.surfaceBuffer, retainedSurfaceBuffer);
      return {
        ...deriveSphRenderMarchingCubeCellsCpu(args.renderField, {
          isolationScale: args.isolationScale
        }),
        backend: 'webgpu',
        fieldRowsBufferBound: Boolean(args.fieldRowsBuffer),
        surfaceBufferBound: Boolean(args.surfaceBuffer)
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuStatus.parityMaxAbsDiff, 0);
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.result.fieldRowsBufferBound, true);
  assert.equal(execution.result.surfaceBufferBound, true);
  assert.equal(execution.marchingCubeCellReadback, true);
});

test('SPH render marching-cube cells optional WebGPU supports resident no-readback execution', async () => {
  const field = twoSurfaceRenderField();
  const retainedCellRowsBuffer = { label: 'marching-cube-cell-buffer' };
  const execution = await deriveSphRenderMarchingCubeCellsWithOptionalWebGpu({
    renderField: field,
    readbackMode: 'no-full-readback',
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      return {
        schema: ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_SCHEMA,
        backend: 'webgpu',
        status: 'marching-cube-cells-resident',
        sourceRenderFieldSchema: args.renderField.schema,
        sourceRenderFieldBackend: args.renderField.backend,
        cubeShape: 'fixed-surface-voxel-cubes',
        surfaceCount: args.renderField.surfaceCount,
        totalFieldCells: args.renderField.totalFieldCells,
        totalCubeCells: args.renderField.totalFieldCells,
        rowStrideFloats: SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS,
        cellRows: new Float32Array(),
        cellRowsByteLength: args.renderField.totalFieldCells
          * SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS
          * Float32Array.BYTES_PER_ELEMENT,
        cellRowsBuffer: retainedCellRowsBuffer,
        cellRowsBufferRetained: true,
        readbackMode: 'no-full-readback',
        marchingCubeCellReadback: false,
        surfaces: [],
        emissionStatus: 'pending-prefix-compact-and-triangle-emission'
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_MARCHING_CUBE_CELLS_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-resident-no-full-readback');
  assert.equal(execution.result.cellRows.length, 0);
  assert.equal(execution.result.cellRowsBufferRetained, true);
  assert.equal(execution.result.cellRowsBuffer, retainedCellRowsBuffer);
  assert.equal(execution.marchingCubeCellReadback, false);
});

test('SPH render surface vertices compact tetrahedralized cube triangles from render fields', () => {
  const field = twoSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);

  assert.equal(vertices.schema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_SCHEMA);
  assert.equal(vertices.backend, 'cpu-reference');
  assert.equal(vertices.surfaceExtractionMethod, 'tetrahedralized-render-field-cubes');
  assert.equal(vertices.compactionMode, 'cpu-compact');
  assert.equal(vertices.rowStrideFloats, SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS);
  assert.ok(vertices.activeCellCount > 0);
  assert.ok(vertices.triangleCount > 0);
  assert.equal(vertices.vertexCount, vertices.triangleCount * 3);
  assert.equal(vertices.vertexRows.length, vertices.vertexCount * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS);
  assert.equal(vertices.maxTrianglesPerCell, 12);
  assert.equal(vertices.maxVerticesPerCell, 36);
  assert.equal(vertices.surfaces.length, 2);
  assert.equal(vertices.surfaces[0].fieldOffset, field.surfaceTable.metadata[0].fieldOffset);
  assert.equal(vertices.surfaces[0].fieldCellCount, field.surfaceTable.metadata[0].fieldCellCount);
  assert.ok(vertices.surfaces.some((surface) => surface.triangleCount > 0));

  const first = vertices.vertexRows.slice(0, SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS);
  assert.equal(first[0], 0);
  assert.equal(first[1], stableOpticalMaterialId('Au'));
  assert.equal(first[2], GPU_PHASE_IDS.solid);
  assert.equal(first[3], 0);
  assert.equal(first[4], 0);
  assert.ok(Number.isFinite(first[5]));
  assert.ok(Number.isFinite(first[6]));
  assert.ok(Number.isFinite(first[7]));
  assert.ok(Number.isFinite(first[8]));
  assert.ok(Number.isFinite(first[9]));
  assert.ok(Number.isFinite(first[10]));
  assert.ok(Math.hypot(first[8], first[9], first[10]) <= 1.000001);
  assert.equal(first[13], 20);
  assert.ok(first[14] >= 0);
  assert.equal(first[15], 1);
});

test('SPH render surface vertices orient normals from dense material toward exterior', () => {
  const field = centeredSingleSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const center = [5, 5, 5];
  let sampled = 0;
  let outward = 0;
  let inward = 0;
  let radialDotSum = 0;

  for (let offset = 0; offset < vertices.vertexRows.length; offset += SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS) {
    const position = [
      vertices.vertexRows[offset + 5],
      vertices.vertexRows[offset + 6],
      vertices.vertexRows[offset + 7]
    ];
    const normal = [
      vertices.vertexRows[offset + 8],
      vertices.vertexRows[offset + 9],
      vertices.vertexRows[offset + 10]
    ];
    const radial = [
      position[0] - center[0],
      position[1] - center[1],
      position[2] - center[2]
    ];
    const radialLength = Math.hypot(radial[0], radial[1], radial[2]);
    if (!(radialLength > 1e-6)) continue;
    const radialDot = (
      normal[0] * radial[0]
      + normal[1] * radial[1]
      + normal[2] * radial[2]
    ) / radialLength;
    sampled += 1;
    radialDotSum += radialDot;
    if (radialDot > 1e-5) outward += 1;
    if (radialDot < -1e-5) inward += 1;
  }

  assert.ok(sampled > 0);
  assert.ok(outward > inward * 8, `expected outward normals to dominate; outward=${outward} inward=${inward}`);
  assert.ok(radialDotSum / sampled > 0.45);
});

test('SPH render surface vertices optional WebGPU accepts parity-passing runner', async () => {
  const field = twoSurfaceRenderField();
  const retainedFieldRowsBuffer = { label: 'field-rows-buffer' };
  const retainedSurfaceBuffer = { label: 'surface-buffer' };
  const execution = await deriveSphRenderSurfaceVerticesWithOptionalWebGpu({
    renderField: field,
    fieldRowsBuffer: retainedFieldRowsBuffer,
    surfaceBuffer: retainedSurfaceBuffer,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.fieldRowsBuffer, retainedFieldRowsBuffer);
      assert.equal(args.surfaceBuffer, retainedSurfaceBuffer);
      return {
        ...deriveSphRenderSurfaceVerticesCpu(args.renderField, {
          isolationScale: args.isolationScale
        }),
        backend: 'webgpu',
        compactionMode: 'webgpu-fixed-cell-slots-debug-compacted',
        fieldRowsBufferBound: Boolean(args.fieldRowsBuffer),
        surfaceBufferBound: Boolean(args.surfaceBuffer)
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_SURFACE_VERTICES_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuStatus.parityMaxAbsDiff, 0);
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.result.compactionMode, 'webgpu-fixed-cell-slots-debug-compacted');
  assert.equal(execution.result.fieldRowsBufferBound, true);
  assert.equal(execution.result.surfaceBufferBound, true);
  assert.equal(execution.surfaceVertexReadback, true);
});

test('SPH render surface vertices retained buffer uses lease guarded cleanup', async () => {
  const field = twoSurfaceRenderField();
  const { device, shaderModules, bindGroups, createdBuffers } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(),
    compactedVertexRows: new Float32Array()
  });

  const result = await buildSphRenderSurfaceVerticesWebGpu({
    device,
    renderField: field,
    readbackMode: 'no-full-readback',
    retainVertexRowsBuffer: true,
    maxVertexRows: 4098
  });

  assert.equal(result.status, 'surface-vertices-resident-atomic-compact');
  assert.equal(result.compactionMode, 'webgpu-atomic-compact');
  assert.equal(result.surfaceVertexEmissionMode, 'atomic-compact');
  assert.equal(result.surfaceVertexBudgetCapped, true);
  assert.equal(result.maxVertexRows, 4098);
  assert.ok(result.maxVertexRows < result.requiredVertexRows);
  assert.equal(result.fixedSlotVertexRowsByteLength, 4098 * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT);
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(result.residentBufferLeaseResourceCount, 2);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 2);
  assert.equal(result.queueCompletionStatus, 'queue-work-completed');
  assert.equal(result.queueCompletionMethod, 'queue.onSubmittedWorkDone');
  assert.equal(result.vertexCounterBufferRetained, true);
  assert.equal(result.counterBufferRetained, true);
  assert.equal(result.vertexCounterBufferByteLength, 16);
  assert.equal(result.vertexCounterBuffer.label, 'ulg-sph-surface-vertex-counter');
  assert.match(shaderModules[0].code, /surface_vertex_counter|atomicAdd/);
  assert.equal(bindGroups[0].entries.length, 5);
  assert.equal(bindGroups[0].entries[4].resource.buffer.label, 'ulg-sph-surface-vertex-counter');
  assert.ok(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-surface-vertex-counter'));
  result.destroySurfaceVertexBuffers();
  assert.equal(result.residentBufferLeaseSummary.skippedDestroyCount, 2);
  assert.equal(result.vertexRowsBuffer.destroyed, false);
  assert.equal(result.vertexCounterBuffer.destroyed, false);
  const released = result.releaseSurfaceVertexBufferLeases();
  assert.equal(released.activeLeaseCount, 0);
  result.destroySurfaceVertexBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(result.vertexRowsBuffer.destroyed, true);
  assert.equal(result.vertexCounterBuffer.destroyed, true);
  result.destroySurfaceVertexBuffers();
  assert.equal(result.vertexRowsBuffer.destroyed, true);
  assert.equal(result.vertexCounterBuffer.destroyed, true);
});

test('SPH render surface vertices can defer no-full queue fence for resident handoff', async () => {
  const field = twoSurfaceRenderField();
  const { device } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(),
    compactedVertexRows: new Float32Array()
  });
  let submittedWorkDoneCount = 0;
  let resolveSubmittedWorkDone;
  device.queue.onSubmittedWorkDone = () => {
    submittedWorkDoneCount += 1;
    return new Promise((resolve) => {
      resolveSubmittedWorkDone = resolve;
    });
  };

  const result = await buildSphRenderSurfaceVerticesWebGpu({
    device,
    renderField: field,
    readbackMode: 'no-full-readback',
    retainVertexRowsBuffer: true,
    waitForQueueCompletion: false
  });

  assert.equal(result.queueCompletionStatus, 'queue-submitted-cleanup-deferred');
  assert.equal(result.queueCompletionMethod, 'deferred queue.onSubmittedWorkDone cleanup');
  assert.equal(submittedWorkDoneCount, 1);
  assert.equal(result.vertexRowsBufferRetained, true);
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  resolveSubmittedWorkDone();
  await new Promise((resolve) => setTimeout(resolve, 0));
  result.releaseSurfaceVertexBufferLeases();
  result.destroySurfaceVertexBuffers();
  assert.equal(result.vertexRowsBuffer.destroyed, true);
});

test('SPH render surface draw metadata buckets compact vertices by material surface', () => {
  const field = twoSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const draw = deriveSphRenderSurfaceDrawMetadataCpu(vertices);

  assert.equal(draw.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.equal(draw.backend, 'cpu-reference');
  assert.equal(draw.rowStrideFloats, SPH_GPU_RENDER_SURFACE_DRAW_FLOATS);
  assert.equal(draw.drawRows.length, draw.surfaceCount * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS);
  assert.equal(draw.drawIndirectSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA);
  assert.equal(draw.drawIndirectRowStrideUints, SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS);
  assert.equal(draw.drawIndirectRows.length, draw.surfaceCount * SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS);
  assert.ok(draw.activeSurfaceCount > 0);
  assert.equal(draw.vertexCount, vertices.vertexCount);
  assert.equal(draw.triangleCount, vertices.triangleCount);
  assert.equal(draw.compactionMode, 'cpu-prefix-from-compact-vertices');
  assert.equal(draw.surfaces.length, vertices.surfaces.length);

  const activeSurface = draw.surfaces.find((surface) => surface.vertexCount > 0);
  assert.ok(activeSurface);
  assert.equal(activeSurface.vertexCount % 3, 0);
  assert.equal(activeSurface.triangleCount, activeSurface.vertexCount / 3);
  assert.ok(activeSurface.boundsRadiusM > 0);
  assert.ok(activeSurface.boundsCenterM.every((value) => Number.isFinite(value)));
  const rowOffset = activeSurface.surfaceIndex * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS;
  assert.equal(draw.drawRows[rowOffset], activeSurface.surfaceIndex);
  assert.equal(draw.drawRows[rowOffset + 1], activeSurface.materialId);
  assert.equal(draw.drawRows[rowOffset + 2], activeSurface.phaseId);
  assert.equal(draw.drawRows[rowOffset + 5], activeSurface.vertexCount);
  assert.equal(draw.drawRows[rowOffset + 7], activeSurface.triangleCount);
  assert.equal(draw.drawRows[rowOffset + 11], 1);
  const indirectOffset = activeSurface.surfaceIndex * SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS;
  assert.equal(draw.drawIndirectRows[indirectOffset], activeSurface.vertexCount);
  assert.equal(draw.drawIndirectRows[indirectOffset + 1], 1);
  assert.equal(draw.drawIndirectRows[indirectOffset + 2], activeSurface.vertexOffset);
  assert.equal(draw.drawIndirectRows[indirectOffset + 3], activeSurface.surfaceIndex);
});

test('SPH render surface draw metadata preserves explicit transparent solid policy', () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const table = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'glasslike|Au|solid',
      material: 'Au',
      phase: 'solid',
      renderKey: 'glasslike',
      resolution: 8,
      isolation: 20,
      subtract: 5,
      radiusNorm: 0.2,
      colorLinear: [1, 0.7, 0.1],
      renderLayer: 'transmissive-surface',
      renderOrder: 200.125,
      transparencyClassId: 2,
      depthWriteFlag: 0
    }
  ]);
  const field = buildSphRenderFieldCpu({
    renderRows: extracted.renderRows,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 10
  });
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const draw = deriveSphRenderSurfaceDrawMetadataCpu(vertices);
  const surface = draw.surfaces[0];
  const rowOffset = surface.surfaceIndex * SPH_GPU_RENDER_SURFACE_DRAW_FLOATS;
  const surfaceRowOffset = surface.surfaceIndex * SPH_GPU_RENDER_SURFACE_ROW_FLOATS;

  assert.equal(table.metadata[0].renderLayer, 'transmissive-surface');
  assert.equal(table.metadata[0].renderOrder, 200.125);
  assert.equal(table.metadata[0].transparencyClassId, 2);
  assert.equal(table.metadata[0].depthWriteFlag, 0);
  assert.equal(table.records[surfaceRowOffset + 14], 2);
  assert.equal(table.records[surfaceRowOffset + 15], 0);
  assert.equal(surface.renderLayer, 'transmissive-surface');
  assert.equal(surface.renderOrder, 200.125);
  assert.equal(surface.transparencyClassId, 2);
  assert.equal(surface.depthWriteFlag, 0);
  assert.equal(draw.drawRows[rowOffset + 8], 200.125);
  assert.equal(draw.drawRows[rowOffset + 9], 2);
  assert.equal(draw.drawRows[rowOffset + 10], 0);
});

test('SPH render surface draw metadata optional WebGPU accepts parity-passing runner', async () => {
  const field = twoSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const execution = await deriveSphRenderSurfaceDrawMetadataWithOptionalWebGpu({
    surfaceVertices: vertices,
    preferWebGpu: true,
    device: {},
    webGpuRunner(args) {
      assert.equal(args.surfaceVertices, vertices);
      return {
        ...deriveSphRenderSurfaceDrawMetadataCpu(args.surfaceVertices),
        backend: 'webgpu',
        compactionMode: 'webgpu-prefix-from-fixed-slots'
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuStatus.parityMaxAbsDiff, 0);
  assert.equal(execution.result.backend, 'webgpu');
  assert.equal(execution.result.compactionMode, 'webgpu-prefix-from-fixed-slots');
  assert.equal(execution.surfaceDrawReadback, true);
});

test('SPH render surface draw WebGPU builder returns compact vertex draw source', async () => {
  const field = twoSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const cpuDraw = deriveSphRenderSurfaceDrawMetadataCpu(vertices);
  const { device, shaderModules, bindGroups, dispatches, copies } = fakeSurfaceDrawDevice({
    drawRows: cpuDraw.drawRows,
    compactedVertexRows: vertices.vertexRows,
    drawIndirectRows: cpuDraw.drawIndirectRows
  });

  const result = await buildSphRenderSurfaceDrawMetadataWebGpu({
    device,
    surfaceVertices: vertices,
    retainDrawRowsBuffer: true,
    retainDrawIndirectRowsBuffer: true,
    retainCompactedVertexRowsBuffer: true
  });

  assert.equal(result.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA);
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.status, cpuDraw.status);
  assert.equal(result.compactionMode, 'webgpu-surface-prefix-scan-compact');
  assert.equal(result.surfaceDrawReadback, true);
  assert.equal(result.drawRowsBufferRetained, true);
  assert.equal(result.drawIndirectRowsBufferRetained, true);
  assert.equal(result.compactedVertexRowsBufferRetained, true);
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-active');
  assert.equal(result.residentBufferLeaseResourceCount, 3);
  assert.equal(result.residentBufferLeaseActiveLeaseCount, 3);
  assert.equal(result.drawIndirectSchema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA);
  assert.equal(result.drawIndirectRowStrideUints, SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS);
  assert.equal(result.vertexCount, cpuDraw.vertexCount);
  assert.equal(result.triangleCount, cpuDraw.triangleCount);
  assert.deepEqual(Array.from(result.drawRows), Array.from(cpuDraw.drawRows));
  assert.deepEqual(Array.from(result.drawIndirectRows), Array.from(cpuDraw.drawIndirectRows));
  assert.deepEqual(Array.from(result.compactedVertexRows), Array.from(vertices.vertexRows));
  assert.ok(result.drawRowsBuffer);
  assert.ok(result.drawIndirectRowsBuffer);
  assert.ok(result.compactedVertexRowsBuffer);
  assert.equal(shaderModules.length, 1);
  assert.match(shaderModules[0].code, /sphRenderSurfaceDraw|SurfaceDrawParams|surface_draw_indirect_rows|source_vertex_counter/);
  assert.equal(bindGroups.length, 1);
  assert.equal(bindGroups[0].entries.length, 7);
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-surface-draw-compacted-vertices');
  assert.equal(bindGroups[0].entries[3].resource.buffer.label, 'ulg-sph-surface-draw-metadata');
  assert.equal(bindGroups[0].entries[5].resource.buffer.label, 'ulg-sph-surface-draw-indirect');
  assert.equal(bindGroups[0].entries[6].resource.buffer.label, 'ulg-sph-surface-draw-source-vertex-counter');
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [vertices.surfaceCount]);
  assert.ok(copies.some((copy) => copy.size === cpuDraw.drawRows.byteLength));
  assert.ok(copies.some((copy) => copy.size === cpuDraw.drawIndirectRows.byteLength));
  assert.ok(copies.some((copy) => copy.size === vertices.vertexRows.byteLength));
  assert.equal(result.queueCompletionStatus, 'readback-map-completed');
  assert.equal(result.queueCompletionMethod, 'mapAsync(readback-buffer)');
  const retainedBuffers = [
    result.drawRowsBuffer,
    result.drawIndirectRowsBuffer,
    result.compactedVertexRowsBuffer
  ];
  result.destroySurfaceDrawBuffers();
  assert.equal(result.residentBufferLeaseSummary.skippedDestroyCount, 3);
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === false), true);
  result.releaseSurfaceDrawBufferLeases();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-ready');
  result.destroySurfaceDrawBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === true), true);
  result.destroySurfaceDrawBuffers();
  assert.equal(retainedBuffers.every((buffer) => buffer.destroyed === true), true);
});

test('SPH render surface draw no-full mode can read compact summary without vertex readback', async () => {
  const field = twoSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const cpuDraw = deriveSphRenderSurfaceDrawMetadataCpu(vertices);
  const { device, copies } = fakeSurfaceDrawDevice({
    drawRows: cpuDraw.drawRows,
    compactedVertexRows: vertices.vertexRows,
    drawIndirectRows: cpuDraw.drawIndirectRows
  });

  const result = await buildSphRenderSurfaceDrawMetadataWebGpu({
    device,
    surfaceVertices: vertices,
    readbackMode: 'no-full-readback',
    compactSummaryReadback: true,
    retainDrawRowsBuffer: true,
    retainDrawIndirectRowsBuffer: true,
    retainCompactedVertexRowsBuffer: true
  });

  assert.equal(result.status, 'surface-draw-resident');
  assert.equal(result.readbackMode, 'no-full-readback');
  assert.equal(result.surfaceDrawReadback, false);
  assert.equal(result.fullSurfaceDrawReadback, false);
  assert.equal(result.surfaceDrawSummaryReadback, true);
  assert.equal(result.surfaceDrawSummaryReadbackByteLength, cpuDraw.drawRows.byteLength);
  assert.equal(result.activeSurfaceCount, cpuDraw.activeSurfaceCount);
  assert.equal(result.vertexCount, cpuDraw.vertexCount);
  assert.equal(result.triangleCount, cpuDraw.triangleCount);
  assert.deepEqual(Array.from(result.drawRows), Array.from(cpuDraw.drawRows));
  assert.equal(result.compactedVertexRows.length, 0);
  assert.equal(result.drawIndirectRows.length, 0);
  assert.ok(result.drawRowsBufferRetained);
  assert.ok(result.drawIndirectRowsBufferRetained);
  assert.ok(result.compactedVertexRowsBufferRetained);
  assert.ok(copies.some((copy) => copy.size === cpuDraw.drawRows.byteLength));
  assert.equal(copies.some((copy) => copy.size === vertices.vertexRows.byteLength), false);
  const activeSurface = result.surfaces.find((surface) => surface.vertexCount > 0);
  assert.ok(activeSurface);
  assert.ok(activeSurface.boundsRadiusM > 0);
});

test('SPH render surface draw no-full mode exposes GPU-only draw range without summary readback', async () => {
  const field = twoSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const vertexCounterBuffer = { label: 'retained-surface-vertex-counter' };
  const counterBackedVertices = {
    ...vertices,
    vertexCounterBuffer,
    vertexCounterBufferRetained: true,
    vertexCounterBufferByteLength: 16,
    surfaceVertexEmissionMode: 'atomic-compact'
  };
  const cpuDraw = deriveSphRenderSurfaceDrawMetadataCpu(vertices);
  const { device, copies, shaderModules, bindGroups } = fakeSurfaceDrawDevice({
    drawRows: cpuDraw.drawRows,
    compactedVertexRows: vertices.vertexRows,
    drawIndirectRows: cpuDraw.drawIndirectRows
  });

  const result = await buildSphRenderSurfaceDrawMetadataWebGpu({
    device,
    surfaceVertices: counterBackedVertices,
    readbackMode: 'no-full-readback',
    compactSummaryReadback: false,
    retainDrawRowsBuffer: true,
    retainDrawIndirectRowsBuffer: true,
    retainCompactedVertexRowsBuffer: true,
    waitForQueueCompletion: false
  });

  const expectedVertexUpperBound = Math.floor(vertices.vertexRows.length / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS);
  const expectedAlignedVertexUpperBound = expectedVertexUpperBound - (expectedVertexUpperBound % 3);
  assert.equal(result.status, 'surface-draw-resident');
  assert.equal(result.readbackMode, 'no-full-readback');
  assert.equal(result.surfaceDrawReadback, false);
  assert.equal(result.fullSurfaceDrawReadback, false);
  assert.equal(result.surfaceDrawSummaryReadback, false);
  assert.equal(result.surfaceDrawSummaryReadbackByteLength, 0);
  assert.equal(result.sourceVertexCounterMode, 'resident-vertex-counter');
  assert.equal(result.sourceVertexCounterBufferBound, true);
  assert.equal(result.sourceVertexCounterBufferByteLength, 16);
  assert.equal(result.surfaceDrawGpuOnlyHandoff, true);
  assert.equal(result.surfaceDrawGpuOnlyHandoffStatus, 'surface-draw-gpu-resident-draw-range-available');
  assert.equal(result.surfaceDrawGpuOnlyDrawRangeConservative, true);
  assert.equal(result.surfaceDrawGpuOnlyUpperBoundVertexCount, expectedAlignedVertexUpperBound);
  assert.equal(result.surfaceDrawGpuOnlyUpperBoundTriangleCount, Math.floor(expectedAlignedVertexUpperBound / 3));
  assert.equal(result.activeSurfaceCount, null);
  assert.equal(result.vertexCount, null);
  assert.equal(result.triangleCount, null);
  assert.deepEqual(Array.from(result.drawRows), []);
  assert.deepEqual(Array.from(result.compactedVertexRows), []);
  assert.deepEqual(Array.from(result.drawIndirectRows), []);
  assert.ok(result.drawRowsBufferRetained);
  assert.ok(result.drawIndirectRowsBufferRetained);
  assert.ok(result.compactedVertexRowsBufferRetained);
  assert.match(shaderModules[0].code, /sd_source_vertex_row_count|source_vertex_counter/);
  assert.equal(bindGroups[0].entries.length, 7);
  assert.equal(bindGroups[0].entries[6].resource.buffer, vertexCounterBuffer);
  assert.equal(copies.length, 0);
});

test('SPH render surface draw compact summary can fence deferred resident metadata', async () => {
  const field = twoSurfaceRenderField();
  const vertices = deriveSphRenderSurfaceVerticesCpu(field);
  const cpuDraw = deriveSphRenderSurfaceDrawMetadataCpu(vertices);
  const { device } = fakeSurfaceDrawDevice({
    drawRows: cpuDraw.drawRows,
    compactedVertexRows: vertices.vertexRows,
    drawIndirectRows: cpuDraw.drawIndirectRows
  });
  let submittedWorkDoneCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    submittedWorkDoneCount += 1;
    return new Promise(() => {});
  };

  const result = await buildSphRenderSurfaceDrawMetadataWebGpu({
    device,
    surfaceVertices: vertices,
    readbackMode: 'no-full-readback',
    compactSummaryReadback: true,
    retainDrawRowsBuffer: true,
    retainDrawIndirectRowsBuffer: true,
    retainCompactedVertexRowsBuffer: true,
    waitForQueueCompletion: false
  });

  assert.equal(submittedWorkDoneCount, 0);
  assert.equal(result.queueCompletionStatus, 'compact-summary-readback-map-completed');
  assert.equal(result.queueCompletionMethod, 'mapAsync(compact-summary-readback-buffer)');
  assert.equal(result.surfaceDrawSummaryReadback, true);
  assert.equal(result.activeSurfaceCount, cpuDraw.activeSurfaceCount);
  assert.equal(result.vertexCount, cpuDraw.vertexCount);
  assert.equal(result.triangleCount, cpuDraw.triangleCount);
  result.releaseSurfaceDrawBufferLeases();
  result.destroySurfaceDrawBuffers();
  assert.equal(result.residentBufferLeaseLedgerStatus, 'resident-buffer-lease-ledger-cleaned');
});

test('SPH render surface draw metadata optional WebGPU accepts resident no-full-readback buffers', async () => {
  const field = twoSurfaceRenderField();
  const vertices = {
    ...deriveSphRenderSurfaceVerticesCpu(field),
    backend: 'webgpu',
    vertexRows: new Float32Array(),
    vertexRowsBuffer: { label: 'fixed-slot-surface-vertices' },
    vertexRowsBufferRetained: true,
    vertexRowsBufferRowCount: 4096,
    maxVertexRows: 4096,
    compactionMode: 'webgpu-fixed-cell-slots'
  };
  const retainedDrawRowsBuffer = { label: 'surface-draw-buffer' };
  const retainedDrawIndirectRowsBuffer = { label: 'surface-draw-indirect-buffer' };
  const retainedCompactedVertexRowsBuffer = { label: 'compacted-surface-vertices' };
  const execution = await deriveSphRenderSurfaceDrawMetadataWithOptionalWebGpu({
    surfaceVertices: vertices,
    preferWebGpu: true,
    readbackMode: 'no-full-readback',
    device: {},
    webGpuRunner(args) {
      assert.equal(args.readbackMode, 'no-full-readback');
      assert.equal(args.surfaceVertices.vertexRowsBuffer, vertices.vertexRowsBuffer);
      return {
        schema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_SCHEMA,
        backend: 'webgpu',
        status: 'surface-draw-resident',
        sourceSurfaceVertexSchema: args.surfaceVertices.schema,
        sourceSurfaceVertexBackend: args.surfaceVertices.backend,
        surfaceCount: args.surfaceVertices.surfaceCount,
        activeSurfaceCount: null,
        vertexCount: null,
        triangleCount: null,
        rowStrideFloats: SPH_GPU_RENDER_SURFACE_DRAW_FLOATS,
        drawRows: new Float32Array(),
        drawRowsBuffer: retainedDrawRowsBuffer,
        drawRowsBufferRetained: true,
        drawIndirectSchema: ULG_SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_SCHEMA,
        drawIndirectRowStrideUints: SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
        drawIndirectRows: new Uint32Array(),
        drawIndirectRowsBuffer: retainedDrawIndirectRowsBuffer,
        drawIndirectRowsBufferRetained: true,
        compactedVertexRows: new Float32Array(),
        compactedVertexRowsBuffer: retainedCompactedVertexRowsBuffer,
        compactedVertexRowsBufferRetained: true,
        sourceVertexRowCount: args.surfaceVertices.vertexRowsBufferRowCount,
        sourceVertexRowsBufferBound: true,
        readbackMode: 'no-full-readback',
        surfaceDrawReadback: false,
        compactionMode: 'webgpu-surface-prefix-scan-compact',
        surfaces: args.surfaceVertices.surfaces
      };
    }
  });

  assert.equal(execution.schema, ULG_SPH_GPU_RENDER_SURFACE_DRAW_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-resident-no-full-readback');
  assert.equal(execution.result.drawRowsBuffer, retainedDrawRowsBuffer);
  assert.equal(execution.result.drawIndirectRowsBuffer, retainedDrawIndirectRowsBuffer);
  assert.equal(execution.result.compactedVertexRowsBuffer, retainedCompactedVertexRowsBuffer);
  assert.equal(execution.result.compactionMode, 'webgpu-surface-prefix-scan-compact');
  assert.equal(execution.surfaceDrawReadback, false);
});
