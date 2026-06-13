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
  SPH_GPU_RENDER_FIELD_CELL_FLOATS,
  SPH_GPU_RENDER_MARCHING_CUBE_CELL_FLOATS,
  SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS,
  SPH_GPU_RENDER_SURFACE_DRAW_FLOATS,
  SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS,
  SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
  SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
  SPH_GPU_RENDER_ROW_FLOATS,
  SPH_GPU_RENDER_SURFACE_ROW_FLOATS,
  ULG_SPH_GPU_RENDER_FIELD_EXECUTION_SCHEMA,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
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
  buildSphRenderFieldSurfaceTable,
  buildSphRenderFieldWithOptionalWebGpu,
  buildSphRenderMaterialMap,
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
  splitSphRenderFieldBySurface
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

function fakeSurfaceDrawDevice({ drawRows, compactedVertexRows, drawIndirectRows = new Uint32Array() }) {
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
          const source = label.includes('compacted-vertex-readback')
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
  assert.equal(result.renderRowsBuffer.label, 'ulg-sph-render-rows');
  assert.equal(submittedWorkDoneCount, 1);
  assert.equal(dispatches.length, 1);
  assert.equal(copies.length, 0);
  assert.equal(createdBuffers.some((buffer) => buffer.label === 'ulg-sph-render-readback'), false);
  result.destroyRenderRowsBuffer();
  assert.equal(result.renderRowsBuffer.destroyed, true);
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
  assert.match(shaderModules[0].code, /sphRenderSurfaceDraw|SurfaceDrawParams|surface_draw_indirect_rows/);
  assert.equal(bindGroups.length, 1);
  assert.equal(bindGroups[0].entries.length, 6);
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-surface-draw-compacted-vertices');
  assert.equal(bindGroups[0].entries[3].resource.buffer.label, 'ulg-sph-surface-draw-metadata');
  assert.equal(bindGroups[0].entries[5].resource.buffer.label, 'ulg-sph-surface-draw-indirect');
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [vertices.surfaceCount]);
  assert.ok(copies.some((copy) => copy.size === cpuDraw.drawRows.byteLength));
  assert.ok(copies.some((copy) => copy.size === cpuDraw.drawIndirectRows.byteLength));
  assert.ok(copies.some((copy) => copy.size === vertices.vertexRows.byteLength));
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
