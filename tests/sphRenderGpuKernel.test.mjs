import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS,
  SPH_DISPERSED_MEDIUM_OPTICS_STATUS,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { GPU_PHASE_IDS, stableOpticalMaterialId } from '../src/runtime/material/opticalGpuBuffers.js';
import {
  destroySphGpuParticleBuffers,
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS,
  uploadSphGpuParticleBuffers
} from '../src/runtime/sph/sphGpuBuffers.js';
import { tagWebGpuBufferDevice } from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  buildSphDispersedMediumGpuBuffers
} from '../src/runtime/sph/sphDispersedMediumGpuBuffers.js';
import {
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES,
  productEventLiveCountCopyDescriptor,
  registerResidentProductEventCountAuthority,
  resolveResidentProductEventCountAuthority,
  retireResidentProductEventCountAuthority,
  revokeResidentProductEventCountAuthority,
  validateProductEventLiveCountCopyDescriptor
} from '../src/runtime/sph/sphResidentProductHistoryGpu.js';
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
  SPH_INTERFACE_SOURCE_KEY_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS,
  SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT,
  SPH_MATERIAL_INTERFACE_ELEMENT_FLOATS,
  SPH_RENDER_ROW_MAX_GAS_RADIUS_SMOOTHING_RATIO,
  SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO,
  SPH_RENDER_ROW_MAX_SUPPORT_RADIUS_SMOOTHING_RATIO,
  SPH_RENDER_ROW_MAX_VOLUME_RATIO_J,
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
  ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA,
  buildSphMaterialInterfaceCandidateFieldWebGpu,
  buildSphMaterialInterfaceCompactCandidateFieldWebGpu,
  buildSphRenderMarchingCubeCellsWebGpu,
  buildSphRenderSurfaceDrawMetadataWebGpu,
  buildSphRenderFieldCpu,
  buildSphRenderFieldWebGpu,
  buildSphRenderFieldSurfaceTable,
  createSphRenderSurfaceTableLineageSnapshot,
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
  emissiveByMaterialFromSphRenderRows,
  emissiveTemperatureByMaterialFromSphRenderRows,
  extractSphRenderRowsCpu,
  extractSphRenderRowsWebGpu,
  extractSphRenderRowsWithOptionalWebGpu,
  splitSphRenderFieldBySurface,
  summarizeSphResidentParticleUploadWebGpu,
  summarizeSphRenderFieldSurfacesCpu,
  summarizeSphRenderFieldSurfacesWebGpu,
  summarizeSphRenderFieldSurfacesWithOptionalWebGpu,
  validateSphRenderSurfaceTableLineageSnapshot,
  sphRenderFieldWgsl,
  sphRenderRowsWgsl
} from '../src/runtime/sph/sphRenderGpuKernel.js';

const GPU_BUFFER_USAGE_VERTEX = 32;

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

function compactActiveCandidateRows(candidateRows) {
  const rows = [];
  for (let offset = 0; offset < candidateRows.length; offset += SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS) {
    if ((candidateRows[offset + 15] || 0) <= 0) continue;
    rows.push(...candidateRows.slice(offset, offset + SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS));
  }
  return Float32Array.from(rows);
}

function fakeSurfaceDrawDevice({
  drawRows = new Float32Array(),
  compactedVertexRows = new Float32Array(),
  drawIndirectRows = new Uint32Array(),
  candidateMetadataRows = null,
  sourceKeyRows = new Float32Array(),
  summaryRows = null,
  stateRows = null,
  thermoRows = null,
  limits = null
}) {
  const shaderModules = [];
  const bindGroups = [];
  const dispatches = [];
  const copies = [];
  const createdBuffers = [];
  const queueWrites = [];
  const commandEncoderCreations = [];
  const device = {
    limits: limits ?? undefined,
    queue: {
      writeBuffer(buffer, offset, data) {
        queueWrites.push({
          buffer,
          offset,
          byteLength: data?.byteLength ?? 0,
          snapshot: data instanceof ArrayBuffer
            ? data.slice(0)
            : data?.buffer?.slice(
              data.byteOffset ?? 0,
              (data.byteOffset ?? 0) + (data.byteLength ?? 0)
            ) ?? null
        });
      },
      submit(commands) {
        this.submitted = commands;
      },
      async onSubmittedWorkDone() {}
    },
    createBuffer({ label, size, usage, mappedAtCreation = false }) {
      const creationMappedRange = mappedAtCreation
        ? new ArrayBuffer(size)
        : null;
      const buffer = {
        label,
        size,
        usage,
        mappedAtCreation,
        destroyed: false,
        async mapAsync() {},
        getMappedRange() {
          if (creationMappedRange && !this.unmapped) {
            return creationMappedRange;
          }
          const source = label.includes('render-field-surface-summary-readback')
            ? (summaryRows || drawRows)
            : label.includes('compact-candidate-metadata-readback')
            ? (candidateMetadataRows || new Uint32Array([0, 0, 0, 0]))
            : label.includes('source-key-readback')
            ? sourceKeyRows
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
      commandEncoderCreations.push(true);
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
  return {
    device,
    shaderModules,
    bindGroups,
    dispatches,
    copies,
    createdBuffers,
    queueWrites,
    commandEncoderCreations
  };
}

function packedRenderParticlesWithCount(particleCount) {
  const template = packedRenderParticles();
  const state = new Float32Array(particleCount * SPH_GPU_PARTICLE_STATE_FLOATS);
  const thermo = new Float32Array(particleCount * SPH_GPU_PARTICLE_THERMO_FLOATS);
  for (let index = 0; index < particleCount; index += 1) {
    const templateIndex = index % template.particleCount;
    state.set(
      template.state.subarray(
        templateIndex * SPH_GPU_PARTICLE_STATE_FLOATS,
        (templateIndex + 1) * SPH_GPU_PARTICLE_STATE_FLOATS
      ),
      index * SPH_GPU_PARTICLE_STATE_FLOATS
    );
    thermo.set(
      template.thermo.subarray(
        templateIndex * SPH_GPU_PARTICLE_THERMO_FLOATS,
        (templateIndex + 1) * SPH_GPU_PARTICLE_THERMO_FLOATS
      ),
      index * SPH_GPU_PARTICLE_THERMO_FLOATS
    );
  }
  return {
    ...template,
    particleCount,
    state,
    thermo
  };
}

function borrowedGpuBuffer(label, size) {
  return {
    label,
    size,
    destroyed: false,
    destroy() {
      this.destroyed = true;
    }
  };
}

test('SPH render rows CPU extraction compacts position, thermo, and phase state', () => {
  const packed = packedRenderParticles();
  const result = extractSphRenderRowsCpu({ sphParticleState: packed });

  assert.equal(result.schema, ULG_SPH_GPU_RENDER_ROWS_SCHEMA);
  assert.equal(result.backend, 'cpu-reference');
  assert.equal(result.particleCount, 3);
  // 16 -> 20: phaseFractionSolid + alignment pads for tri-phase weighting.
  assert.equal(result.rowStrideFloats, 20);
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

test('SPH render rows prefer explicit visual particle radius before mechanics rest volume', () => {
  const packed = packedRenderParticles();
  packed.thermo[11] = 0.04;
  const mechanics = new Float32Array(3 * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  mechanics[18] = 1;
  mechanics[19] = 0.001;
  mechanics[28] = 125000;
  const result = extractSphRenderRowsCpu({
    sphParticleState: packed,
    mlsMpmParticleState: {
      particleCount: 3,
      mechanics
    }
  });
  const expectedVolume = (4 * Math.PI * 0.04 ** 3) / 3;

  assert.ok(Math.abs(result.renderRows[12] - expectedVolume) < 1e-10);
  assert.ok(Math.abs(result.renderRows[13] - 0.04) < 1e-7);
  assert.equal(result.renderRows[14], 1);
  assert.equal(result.renderRows[15], 125000);
});

test('SPH render rows cap runaway MLS-MPM particle scale growth with diagnostics', () => {
  const packed = packedRenderParticles();
  packed.smoothingLengthM = 1;
  packed.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3] = 1e-6;
  const mechanics = new Float32Array(3 * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS);
  mechanics[18] = 1e9;
  mechanics[19] = 0.001;
  mechanics[28] = 125000;
  const result = extractSphRenderRowsCpu({
    sphParticleState: packed,
    mlsMpmParticleState: {
      particleCount: 3,
      mechanics
    }
  });
  const restVolumeM3 = mechanics[19];
  const expectedVolume = restVolumeM3 * SPH_RENDER_ROW_MAX_VOLUME_RATIO_J;
  const expectedRestRadius = Math.cbrt((3 * restVolumeM3) / (4 * Math.PI));
  const expectedRadius = expectedRestRadius * SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO;

  assert.ok(Math.abs(result.renderRows[12] - expectedVolume) < 1e-8);
  assert.ok(Math.abs(result.renderRows[13] - expectedRadius) < 1e-7);
  assert.equal(result.renderRows[14], SPH_RENDER_ROW_MAX_VOLUME_RATIO_J);
  assert.equal(result.renderRows[15], 125000);
  assert.equal(result.particleScaleStability.schema, 'peercompute.ulg.sph-render-row-particle-scale-stability.v0');
  assert.equal(result.particleScaleStability.status, 'particle-scale-cap-applied');
  assert.equal(result.particleScaleStability.capAppliedCount, 1);
  assert.equal(result.particleScaleStability.maxRadiusGrowthRatioAllowed, SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO);
  assert.equal(result.particleScaleStability.maxVolumeRatioJAllowed, SPH_RENDER_ROW_MAX_VOLUME_RATIO_J);
  assert.ok(result.particleScaleStability.maxRawRadiusGrowthRatio > SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO);
  assert.equal(result.particleScaleStability.maxEffectiveRadiusGrowthRatio, SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO);
  assert.ok(result.particleScaleStability.maxRawVolumeRatioJ > SPH_RENDER_ROW_MAX_VOLUME_RATIO_J);
  assert.equal(result.particleScaleStability.maxEffectiveVolumeRatioJ, SPH_RENDER_ROW_MAX_VOLUME_RATIO_J);
  assert.deepEqual(result.particleScaleStability.sampleCappedRows.map((row) => ({
    index: row.index,
    materialId: row.materialId,
    phaseId: row.phaseId,
    reason: row.reason
  })), [{
    index: 0,
    materialId: stableOpticalMaterialId('Au'),
    phaseId: GPU_PHASE_IDS.solid,
    reason: 'max-radius-growth-ratio'
  }]);
});

test('SPH render rows cap aggregate product support radius without requiring J growth', () => {
  const packed = packedRenderParticles();
  packed.state[3] = 1e6;
  packed.state[SPH_GPU_PARTICLE_STATE_FLOATS + 3] = 1e-6;
  packed.state[SPH_GPU_PARTICLE_STATE_FLOATS * 2 + 3] = 1e-6;
  const result = extractSphRenderRowsCpu({ sphParticleState: packed });
  const expectedRadius = packed.smoothingLengthM * SPH_RENDER_ROW_MAX_SUPPORT_RADIUS_SMOOTHING_RATIO;
  const expectedVolume = (4 * Math.PI * expectedRadius ** 3) / 3;

  assert.ok(result.renderRows[13] <= expectedRadius + 1e-7);
  assert.ok(Math.abs(result.renderRows[12] - expectedVolume) < 1e-7);
  assert.equal(result.particleScaleStability.status, 'particle-scale-cap-applied');
  assert.equal(result.particleScaleStability.capAppliedCount, 1);
  assert.equal(result.particleScaleStability.maxSupportRadiusM, expectedRadius);
  assert.equal(result.particleScaleStability.sampleCappedRows[0].reason, 'max-support-radius');
  assert.ok(result.particleScaleStability.maxRawParticleRadiusM > expectedRadius);
  assert.ok(result.particleScaleStability.maxParticleRadiusM <= expectedRadius + 1e-7);
});

test('SPH render rows proxy gas-phase particle radius at kernel scale', () => {
  const packed = packedRenderParticles();
  packed.smoothingLengthM = 1.1;
  const result = extractSphRenderRowsCpu({ sphParticleState: packed });
  const gasRowOffset = SPH_GPU_RENDER_ROW_FLOATS;
  const expectedRadius = packed.smoothingLengthM * SPH_RENDER_ROW_MAX_GAS_RADIUS_SMOOTHING_RATIO;
  const expectedVolume = (4 * Math.PI * expectedRadius ** 3) / 3;

  assert.ok(result.renderRows[gasRowOffset + 13] <= expectedRadius + 1e-7);
  assert.ok(Math.abs(result.renderRows[gasRowOffset + 12] - expectedVolume) < 1e-7);
  assert.equal(result.renderRows[gasRowOffset + 14] > 0, true);
  assert.equal(result.particleScaleStability.status, 'particle-scale-cap-applied');
  assert.equal(result.particleScaleStability.capAppliedCount, 1);
  assert.equal(result.particleScaleStability.maxGasParticleRadiusM, expectedRadius);
  assert.equal(
    result.particleScaleStability.sampleCappedRows[0].reason,
    'gas-phase-visual-radius-proxy'
  );
  assert.equal(result.particleScaleStability.sampleCappedRows[0].phaseId, GPU_PHASE_IDS.gas);
  assert.ok(result.particleScaleStability.maxRawParticleRadiusM > expectedRadius);
  assert.ok(result.particleScaleStability.maxParticleRadiusM <= expectedRadius + 1e-7);
});

test('SPH render row WGSL applies the same particle scale cap as the CPU contract', () => {
  assert.match(sphRenderRowsWgsl, /RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO:\s*f32\s*=\s*4\.0/);
  assert.match(sphRenderRowsWgsl, /RENDER_ROW_MAX_VOLUME_RATIO_J:\s*f32\s*=\s*64\.0/);
  assert.match(sphRenderRowsWgsl, /material_bank_particle_size_row_count:\s*u32/);
  assert.match(sphRenderRowsWgsl, /@group\(0\)\s+@binding\(5\)\s+var<storage,\s*read>\s+material_bank_particle_size_rows/);
  assert.match(sphRenderRowsWgsl, /@group\(0\)\s+@binding\(6\)\s+var<storage,\s*read>\s+particle_identity:\s*array<u32>/);
  assert.match(sphRenderRowsWgsl, /explicit_render_domain_id\s*=\s*particle_identity\[particle_index\]/);
  assert.match(sphRenderRowsWgsl, /render_domain_id\s*=\s*f32\(explicit_render_domain_id\)/);
  assert.match(sphRenderRowsWgsl, /fn material_bank_rest_volume_for_role\(role_id:\s*f32\)\s*->\s*f32/);
  assert.match(sphRenderRowsWgsl, /let row_status\s*=\s*u32\(row3\.x\s*\+\s*0\.5\)/);
  assert.match(sphRenderRowsWgsl, /let bank_rest_volume_m3\s*=\s*material_bank_rest_volume_for_role\(render_domain_id\)/);
  assert.match(sphRenderRowsWgsl, /raw_particle_radius_m\s*>\s*rest_particle_radius_m\s*\*\s*RENDER_ROW_MAX_PARTICLE_RADIUS_GROWTH_RATIO/);
  assert.match(sphRenderRowsWgsl, /effective_volume_ratio_j\s*=\s*RENDER_ROW_MAX_VOLUME_RATIO_J/);
  assert.match(sphRenderRowsWgsl, /max_support_radius_m:\s*f32/);
  assert.match(sphRenderRowsWgsl, /particle_radius_m\s*>\s*params\.max_support_radius_m/);
  assert.match(sphRenderRowsWgsl, /current_volume_m3\s*=\s*volume_from_radius_m\(params\.max_support_radius_m\)/);
  assert.match(sphRenderRowsWgsl, /max_gas_radius_m:\s*f32/);
  assert.match(sphRenderRowsWgsl, /u32\(thermo0\.y\s*\+\s*0\.5\)\s*==\s*3u/);
  assert.match(sphRenderRowsWgsl, /particle_radius_m\s*>\s*params\.max_gas_radius_m/);
  assert.match(sphRenderRowsWgsl, /current_volume_m3\s*=\s*volume_from_radius_m\(params\.max_gas_radius_m\)/);
});

test('SPH render row WebGPU extraction binds material-bank particle-size rows for shader consumption', async () => {
  const packed = packedRenderParticles();
  const particleSizeRows = Float32Array.from([
    1, 79, 293.15, 101325,
    1, 0.1, 0.05, 0.0005235988,
    19300, 64, 0.1, 0,
    1, 0, 0, 0
  ]);
  packed.materialPropertyBankParticleSizeTable = {
    rowCount: 1,
    rows: particleSizeRows
  };
  const materialBankParticleSizeBuffer = {
    label: 'test-material-bank-particle-size-buffer',
    size: particleSizeRows.byteLength
  };
  const { device, dispatches } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array()
  });

  const result = await extractSphRenderRowsWebGpu({
    device,
    sphParticleState: packed,
    sphParticleUpload: {
      stateBuffer: { label: 'borrowed-state-buffer', size: packed.state.byteLength },
      thermoBuffer: { label: 'borrowed-thermo-buffer', size: packed.thermo.byteLength },
      materialPropertyBankParticleSizeBuffer: materialBankParticleSizeBuffer,
      materialPropertyBankParticleSizeRowCount: 1
    },
    readbackMode: 'no-full-readback',
    retainRenderRowsBuffer: true,
    renderDomainBaseCount: 1
  });

  assert.equal(
    result.materialPropertyBankParticleSizeConsumer.schema,
    'peercompute.ulg.sph-render-row-material-bank-particle-size-consumer.v0'
  );
  assert.equal(
    result.materialPropertyBankParticleSizeConsumer.status,
    'shader-bound-material-bank-particle-size-rows'
  );
  assert.equal(result.materialPropertyBankParticleSizeConsumer.rowCount, 1);
  assert.equal(result.materialPropertyBankParticleSizeConsumer.shaderBinding, 5);
  assert.equal(result.materialPropertyBankParticleSizeConsumer.bufferSource, 'sph-particle-upload');
  assert.equal(result.materialPropertyBankParticleSizeConsumer.mechanicsOverridePreserved, true);

  const renderRowsBindGroup = dispatches[0].bindGroup;
  const entry = renderRowsBindGroup.entries.find((candidate) => candidate.binding === 5);
  assert.equal(entry.resource.buffer, materialBankParticleSizeBuffer);
  result.destroyRenderRowsBuffer();
});

test('SPH render row WebGPU extraction binds the uploaded stable particle identity buffer', async () => {
  const packed = packedRenderParticles();
  packed.identity = Uint32Array.from([7, 7, 19]);
  const particleIdentityBuffer = {
    label: 'test-particle-identity-buffer',
    size: packed.identity.byteLength
  };
  const { device, dispatches } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array()
  });

  const result = await extractSphRenderRowsWebGpu({
    device,
    sphParticleState: packed,
    sphParticleUpload: {
      stateBuffer: { label: 'borrowed-state-buffer', size: packed.state.byteLength },
      thermoBuffer: { label: 'borrowed-thermo-buffer', size: packed.thermo.byteLength },
      identityBuffer: particleIdentityBuffer,
      identityRequired: true,
      identitySchema: ULG_SPH_GPU_PARTICLE_IDENTITY_BUFFER_SCHEMA,
      identityStrideBytes: Uint32Array.BYTES_PER_ELEMENT,
      identityBufferByteLength: packed.identity.byteLength
    },
    mlsMpmParticleUpload: {
      mechanicsBuffer: {
        label: 'borrowed-mechanics-buffer',
        size: packed.particleCount
          * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
          * Float32Array.BYTES_PER_ELEMENT
      }
    },
    readbackMode: 'no-full-readback',
    retainRenderRowsBuffer: true,
    renderDomainBaseCount: 1,
    renderDomainDropCount: 2
  });

  const renderRowsBindGroup = dispatches[0].bindGroup;
  const entry = renderRowsBindGroup.entries.find((candidate) => candidate.binding === 6);
  assert.equal(entry.resource.buffer, particleIdentityBuffer);
  assert.equal(result.renderRowsIncludeParticleIdentity, true);
  assert.equal(result.particleIdentityBufferSource, 'sph-particle-upload');
  assert.equal(result.particleIdentityStrideUints, 1);
  result.destroyRenderRowsBuffer();
});

test('SPH render row optional WebGPU fails closed instead of rendering stale arbitrary-domain CPU rows', async () => {
  const packed = packedRenderParticles();
  packed.identity = Uint32Array.from([7, 7, 19]);
  packed.identityRequired = true;
  packed.cpuIdentityStale = true;
  const execution = await extractSphRenderRowsWithOptionalWebGpu({
    sphParticleState: packed,
    preferWebGpu: true,
    device: {},
    webGpuRunner() {
      throw new Error('resident identity buffer unavailable');
    }
  });

  assert.equal(execution.backend, 'blocked');
  assert.equal(execution.status, 'render-rows-authoritative-resident-buffers-required');
  assert.equal(execution.cpuReference, null);
  assert.equal(execution.result, null);
  assert.equal(execution.renderRowsFailClosed, true);
  assert.equal(
    execution.webgpuStatus.status,
    'blocked-webgpu-error-authoritative-resident-render-required'
  );
});

test('SPH render row optional WebGPU never drops an advertised resident dispersed sidecar into CPU rows', async () => {
  const packed = packedRenderParticles();
  const residentArgs = {
    sphParticleState: packed,
    sphParticleUpload: {
      dispersedMediumOptics: { status: 'resident-sidecar-advertised' }
    }
  };
  const notRequested = await extractSphRenderRowsWithOptionalWebGpu({
    ...residentArgs,
    preferWebGpu: false
  });
  const unavailable = await extractSphRenderRowsWithOptionalWebGpu({
    ...residentArgs,
    preferWebGpu: true,
    deviceResult: {
      status: 'webgpu-unavailable',
      reason: 'test device unavailable'
    }
  });
  const runnerError = await extractSphRenderRowsWithOptionalWebGpu({
    ...residentArgs,
    preferWebGpu: true,
    device: {},
    webGpuRunner() {
      throw new Error('test authoritative extraction failure');
    }
  });

  for (const execution of [notRequested, unavailable, runnerError]) {
    assert.equal(execution.backend, 'blocked');
    assert.equal(
      execution.status,
      'render-rows-authoritative-resident-buffers-required'
    );
    assert.equal(execution.cpuReference, null);
    assert.equal(execution.result, null);
    assert.equal(execution.renderRowsFailClosed, true);
  }
  assert.equal(
    unavailable.webgpuStatus.status,
    'blocked-webgpu-unavailable-authoritative-resident-render-required'
  );
  assert.equal(
    runnerError.webgpuStatus.status,
    'blocked-webgpu-error-authoritative-resident-render-required'
  );
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

test('SPH render rows prefer stable arbitrary particle identity over legacy contiguous ranges', () => {
  const packed = packedRenderParticles();
  packed.identity = Uint32Array.from([7, 19, 0]);
  const result = extractSphRenderRowsCpu({
    sphParticleState: packed,
    renderDomainBaseCount: 1,
    renderDomainDropCount: 1
  });
  const decoded = decodeSphRenderRows(result.renderRows, {
    materialProperties,
    reactionTable
  });

  assert.deepEqual(decoded.rows.map((row) => row.renderDomainId), [7, 19, 0]);
  assert.deepEqual(decoded.rows.map((row) => row.renderDomainKey), [null, null, null]);
  assert.deepEqual(decoded.materials.map((descriptor) => descriptor.renderDomainId ?? 0), [7, 19, 0]);
});

test('SPH render-row incandescence keeps same-material bodies scoped by render domain', () => {
  const rows = [
    {
      material: 'fe',
      renderKey: 'fe',
      phase: 'solid',
      renderDomainId: 11,
      temperatureK: 300
    },
    {
      material: 'fe',
      renderKey: 'fe',
      phase: 'solid',
      renderDomainId: 12,
      temperatureK: 1700
    }
  ];
  const emissive = emissiveByMaterialFromSphRenderRows(rows);
  const emissiveTemperature = emissiveTemperatureByMaterialFromSphRenderRows(rows);
  const coldKey = 'render-domain:11|material:fe|phase:solid';
  const hotKey = 'render-domain:12|material:fe|phase:solid';

  assert.ok(emissive.fe, 'legacy material aggregate remains available');
  assert.ok(emissive[hotKey], 'hot body has exact-domain emissive authority');
  assert.equal(emissive[coldKey], undefined, 'cold body has no exact-domain glow');
  assert.ok(Math.abs(emissiveTemperature[hotKey] - 1700) < 1e-9);
  assert.equal(emissiveTemperature[coldKey], undefined);
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
  assert.equal(result.particleScaleStability.status, 'gpu-row-cap-policy-applied-in-shader');
  assert.equal(result.particleScaleStability.capAppliedCountKnown, false);
  assert.equal(result.particleScaleStability.maxRadiusGrowthRatioAllowed, SPH_RENDER_ROW_MAX_RADIUS_GROWTH_RATIO);
  assert.equal(result.particleScaleStability.maxVolumeRatioJAllowed, SPH_RENDER_ROW_MAX_VOLUME_RATIO_J);
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

test('SPH render row setup rolls back every owned buffer on allocation and encoder failures', async () => {
  const packed = packedRenderParticles();
  for (const failure of ['mid-allocation', 'create-bind-group']) {
    const rig = fakeSurfaceDrawDevice({ drawRows: new Float32Array() });
    const createBuffer = rig.device.createBuffer.bind(rig.device);
    const createBindGroup = rig.device.createBindGroup.bind(rig.device);
    if (failure === 'mid-allocation') {
      rig.device.createBuffer = (descriptor) => {
        if (descriptor.label === 'ulg-sph-render-source-mechanics-empty') {
          throw new Error('injected render-row mid-allocation failure');
        }
        return createBuffer(descriptor);
      };
    } else {
      rig.device.createBindGroup = () => {
        throw new Error('injected render-row bind-group failure');
      };
    }

    await assert.rejects(
      () => extractSphRenderRowsWebGpu({
        device: rig.device,
        sphParticleState: packed,
        readbackMode: 'no-full-readback',
        retainRenderRowsBuffer: true
      }),
      /injected render-row/
    );
    assert.ok(rig.createdBuffers.length > 0);
    assert.equal(
      rig.createdBuffers.every((buffer) => buffer.destroyed),
      true,
      `${failure} must retire every unpublished render-row allocation`
    );
  }
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
      stateBuffer: { label: 'retained-state', size: packed.state.byteLength },
      thermoBuffer: { label: 'retained-thermo', size: packed.thermo.byteLength },
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
      colorLinear: [0.6, 0.8, 1],
      opticalResponseAuthorityFlag: 1,
      opticalResponseAuthority: 'closure-derived-gas-optical-response',
      opticalResponseReady: true,
      opticalVisibilityFlag: 1,
      opticalVisibilityReason: 'derived-droplet-scattering-visible',
      opticalOpacity: 0.61,
      opticalEffectiveOpacity: 0.61,
      opticalDepth: 0.94,
      opticalScatteringCoefficientPerM: 2.5,
      opticalTransmission: 0.39,
      opticalRoughness: 1,
      opticalBlockedFlag: 0,
      opticalProvenanceSource: 'conserved-droplet-scattering'
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
  assert.equal(table.metadata[1].opticalResponseAuthorityFlag, 1);
  assert.equal(table.metadata[1].opticalResponseAuthority, 'closure-derived-gas-optical-response');
  assert.equal(table.metadata[1].opticalResponseReady, true);
  assert.equal(table.metadata[1].opticalVisibilityReason, 'derived-droplet-scattering-visible');
  assert.equal(table.metadata[1].opticalEffectiveOpacity, 0.61);
  assert.equal(table.metadata[1].opticalDepth, 0.94);
  assert.equal(table.metadata[1].opticalScatteringCoefficientPerM, 2.5);
  assert.equal(table.metadata[1].opticalProvenanceSource, 'conserved-droplet-scattering');
});

test('SPH render field routes conserved dispersed optics by exact collective optical state', () => {
  const resolution = 4;
  const isolation = 10;
  const targetOpticalStateId = 31001;
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  renderRows.set([
    0.25, 0.25, 0.25, 1,
    stableOpticalMaterialId('h2'), GPU_PHASE_IDS.gas, 450, 1,
    0.09, 1, 1, 0,
    1, 0.1, 1, 0,
    0, 0, 0, 0
  ]);
  const dispersedMediumOpticsRows = new Float32Array(
    SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
  );
  dispersedMediumOpticsRows.set([
    stableOpticalMaterialId('naoh'),
    GPU_PHASE_IDS.liquid,
    targetOpticalStateId,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
    0.01,
    0.125,
    0.0625,
    0.0625
  ]);
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'collective-smoke-surface',
      material: 'h2',
      phase: 'gas',
      opticalStateId: targetOpticalStateId,
      resolution,
      isolation,
      subtract: 2,
      radiusNorm: 0.25,
      colorLinear: [0.8, 0.82, 0.78]
    },
    {
      // Same carrier material/phase but another collective route: it must
      // remain empty rather than duplicate the H2 carrier metaball.
      surfaceKey: 'unmatched-collective-route',
      material: 'h2',
      phase: 'gas',
      opticalStateId: 31002,
      resolution,
      isolation,
      subtract: 2,
      radiusNorm: 0.25,
      colorLinear: [1, 0.7, 0.1]
    }
  ]);
  const field = buildSphRenderFieldCpu({
    renderRows,
    dispersedMediumOpticsRows,
    surfaceTable,
    fieldPadding: 0,
    refEdgeM: 1
  });
  const targetSurface = surfaceTable.metadata[0];
  const targetCell = (1 * resolution * resolution) + (1 * resolution) + 1;
  const targetOffset = (
    targetSurface.fieldOffset + targetCell
  ) * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
  const unrelatedSurface = surfaceTable.metadata[1];
  let unrelatedMaxDensity = 0;
  for (let cell = 0; cell < unrelatedSurface.fieldCellCount; cell += 1) {
    unrelatedMaxDensity = Math.max(
      unrelatedMaxDensity,
      field.fieldRows[
        (unrelatedSurface.fieldOffset + cell) * SPH_GPU_RENDER_FIELD_CELL_FLOATS
      ]
    );
  }

  // One 0.25 m cell has 0.0625 m^2 face area. The conserved cross sections
  // therefore deposit tau_s=2 and tau_a=1; marching-cubes density is
  // isolation*tau, so the physical extraction threshold is tau=1.
  assert.ok(Math.abs(field.fieldRows[targetOffset] - 30) < 1e-6);
  assert.ok(Math.abs(field.fieldRows[targetOffset + 4] - 450) < 1e-6);
  assert.ok(Math.abs(field.fieldRows[targetOffset + 5] - 2) < 1e-6);
  assert.ok(Math.abs(field.fieldRows[targetOffset + 6] - 1) < 1e-6);
  assert.ok(Math.abs(field.fieldRows[targetOffset + 7] - 1) < 1e-6);
  assert.equal(unrelatedMaxDensity, 0);
  assert.equal(field.dispersedMediumOpticsBound, true);
  assert.equal(field.dispersedMediumOpticsRowCount, 1);
});

test('SPH render field fails closed when a dispersed target id is ambiguous', () => {
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  const dispersedMediumOpticsRows = new Float32Array(
    SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
  );
  dispersedMediumOpticsRows.set([
    1, 2, 41001, SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
    1, 1, 0, 0
  ]);
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'ambiguous-a',
      material: 'h2',
      phase: 'gas',
      opticalStateId: 41001,
      resolution: 4
    },
    {
      surfaceKey: 'ambiguous-b',
      material: 'h2o',
      phase: 'gas',
      opticalStateId: 41001,
      resolution: 4
    }
  ]);

  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows,
      dispersedMediumOpticsRows,
      surfaceTable
    }),
    /routes to more than one render surface/
  );
});

test('SPH render field requires every ready dispersed route and admits canonical blocked-only rows', () => {
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  const readyRows = new Float32Array(SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS);
  readyRows.set([
    1, 2, 41001, SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
    1, 1, 0, 0
  ]);
  const unrelatedTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'unrelated',
    material: 'h2',
    phase: 'gas',
    opticalStateId: 41002,
    resolution: 4
  }]);
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows,
      dispersedMediumOpticsRows: readyRows,
      surfaceTable: unrelatedTable
    }),
    /opticalStateId 41001 has no render surface route/
  );

  const blockedRows = new Float32Array(SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS);
  blockedRows[3] = SPH_DISPERSED_MEDIUM_OPTICS_STATUS.blocked;
  const unboundTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'legacy-unbound',
    material: 'h2',
    phase: 'gas',
    opticalStateId: 0,
    resolution: 4
  }]);
  const blockedField = buildSphRenderFieldCpu({
    renderRows,
    dispersedMediumOpticsRows: blockedRows,
    surfaceTable: unboundTable
  });
  assert.equal(blockedField.dispersedMediumOpticsBound, true);
  assert.equal(blockedField.fieldRows.every((value) => value === 0), true);

  const carrierRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  carrierRows.set([
    0.25, 0.25, 0.25, 1,
    stableOpticalMaterialId('h2'), GPU_PHASE_IDS.gas, 293.15, 1,
    0.09, 1, 1, 0,
    1, 0.1, 1, 0,
    0, 0, 0, 0
  ]);
  const blockedRouteTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'blocked-collective-route',
    material: 'h2',
    phase: 'gas',
    opticalStateId: 41002,
    resolution: 4,
    isolation: 1
  }]);
  const blockedRouteField = buildSphRenderFieldCpu({
    renderRows: carrierRows,
    dispersedMediumOpticsRows: blockedRows,
    surfaceTable: blockedRouteTable,
    fieldPadding: 0,
    refEdgeM: 1
  });
  assert.equal(
    blockedRouteField.fieldRows.every((value) => value === 0),
    true
  );

  blockedRows[0] = 1;
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows,
      dispersedMediumOpticsRows: blockedRows,
      surfaceTable: unboundTable
    }),
    /blocked row 0 must have zero data lanes/
  );
});

test('SPH render field canonicalizes structural and optical route ids as exact f32 integers', () => {
  for (const identifier of [
    'materialId',
    'phaseId',
    'renderDomainId',
    'opticalStateId'
  ]) {
    for (const value of [41.1, -1, 16_777_216]) {
      assert.throws(
        () => buildSphRenderFieldSurfaceTable([{
          surfaceKey: 'noncanonical-route',
          material: 'h2',
          phase: 'gas',
          [identifier]: value,
          resolution: 4
        }]),
        new RegExp(
          `${identifier} must be a non-negative integer exactly representable as f32`
        )
      );
    }
  }
});

test('SPH render field rejects non-f32 structural geometry and invalid physical domains', () => {
  assert.throws(
    () => buildSphRenderFieldSurfaceTable([{
      surfaceKey: 'rounded-field-cell-count',
      material: 'h2',
      phase: 'gas',
      resolution: 257
    }]),
    /fieldCellCount must be an integer exactly representable as both u32 and f32/
  );

  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'physical-domain',
    material: 'h2',
    phase: 'gas',
    resolution: 4
  }]);
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  for (const fieldPadding of [Number.NaN, -0.01, 0.5, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => buildSphRenderFieldCpu({ renderRows, surfaceTable, fieldPadding }),
      /fieldPadding must/
    );
  }
  for (const refEdgeM of [0, -1, 1e-13, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => buildSphRenderFieldCpu({ renderRows, surfaceTable, refEdgeM }),
      /refEdgeM must/
    );
  }
});

test('SPH render field rejects mutated surface routing before dispatch and after lineage capture', () => {
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'collective-route-a',
    material: 'h2',
    phase: 'gas',
    opticalStateId: 42001,
    resolution: 4,
    isolation: 1
  }]);
  const snapshot = createSphRenderSurfaceTableLineageSnapshot(surfaceTable);
  surfaceTable.metadata[0].opticalStateId = 42002;
  assert.equal(
    validateSphRenderSurfaceTableLineageSnapshot(surfaceTable, snapshot),
    false
  );

  const presentationMutation = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'closure-presentation',
    material: 'h2o',
    phase: 'gas',
    opticalStateId: 42004,
    opticalResponseAuthorityFlag: 1,
    opticalEffectiveOpacity: 0.5,
    opticalRoughness: 0.25,
    opticalProvenanceSource: 'closure-a',
    resolution: 4,
    isolation: 1
  }]);
  const presentationSnapshot = createSphRenderSurfaceTableLineageSnapshot(
    presentationMutation
  );
  presentationMutation.metadata[0].opticalEffectiveOpacity = 0.75;
  assert.equal(
    validateSphRenderSurfaceTableLineageSnapshot(
      presentationMutation,
      presentationSnapshot
    ),
    false
  );

  const encodedMutation = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'collective-route-a',
    material: 'h2',
    phase: 'gas',
    opticalStateId: 42001,
    resolution: 4,
    isolation: 1
  }]);
  const encodedSnapshot = createSphRenderSurfaceTableLineageSnapshot(
    encodedMutation
  );
  encodedMutation.records[13] = 42002;
  assert.equal(
    validateSphRenderSurfaceTableLineageSnapshot(
      encodedMutation,
      encodedSnapshot
    ),
    false
  );
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows: new Float32Array(SPH_GPU_RENDER_ROW_FLOATS),
      surfaceTable: encodedMutation
    }),
    /metadata does not match its encoded routing\/geometry lanes/
  );

  const indexMutation = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'spoofed-route-index',
    material: 'h2',
    phase: 'gas',
    opticalStateId: 42003,
    resolution: 4,
    isolation: 1
  }]);
  indexMutation.metadata[0].index = 1;
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows: new Float32Array(SPH_GPU_RENDER_ROW_FLOATS),
      surfaceTable: indexMutation
    }),
    /does not match array index 0/
  );
});

test('SPH dispersed routes require positive isolation and conserve CIC cross-section at the upper boundary', () => {
  const opticalStateId = 43001;
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  renderRows.set([
    1, 1, 1, 1,
    stableOpticalMaterialId('h2'), GPU_PHASE_IDS.gas, 373.15, 1,
    0.09, 1, 1, 0,
    1, 0.1, 1, 0,
    0, 0, 0, 0
  ]);
  const dispersedMediumOpticsRows = Float32Array.from([
    stableOpticalMaterialId('h2o'),
    GPU_PHASE_IDS.liquid,
    opticalStateId,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
    0.01,
    0.125,
    0.0625,
    0.0625
  ]);
  const invalidIsolationTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'invalid-isolation',
    material: 'h2',
    phase: 'gas',
    opticalStateId,
    resolution: 4,
    isolation: 0
  }]);
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows,
      dispersedMediumOpticsRows,
      surfaceTable: invalidIsolationTable,
      fieldPadding: 0,
      refEdgeM: 1
    }),
    /requires a positive finite f32 isolation threshold/
  );
  const denormalIsolationTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'denormal-isolation',
    material: 'h2',
    phase: 'gas',
    opticalStateId,
    resolution: 4,
    isolation: Math.fround(2 ** -149)
  }]);
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows,
      dispersedMediumOpticsRows,
      surfaceTable: denormalIsolationTable,
      fieldPadding: 0,
      refEdgeM: 1
    }),
    /outside the denormal range/
  );

  const resolution = 4;
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'boundary-conservation',
    material: 'h2',
    phase: 'gas',
    opticalStateId,
    resolution,
    isolation: 1
  }]);
  const field = buildSphRenderFieldCpu({
    renderRows,
    dispersedMediumOpticsRows,
    surfaceTable,
    fieldPadding: 0,
    refEdgeM: 1
  });
  let scatteringOpticalDepthSum = 0;
  let absorptionOpticalDepthSum = 0;
  for (let cell = 0; cell < resolution ** 3; cell += 1) {
    const offset = cell * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
    scatteringOpticalDepthSum += field.fieldRows[offset + 5];
    absorptionOpticalDepthSum += field.fieldRows[offset + 6];
  }
  const cellFaceAreaM2 = (1 / resolution) ** 2;
  assert.ok(Math.abs(scatteringOpticalDepthSum * cellFaceAreaM2 - 0.125) < 1e-6);
  assert.ok(Math.abs(absorptionOpticalDepthSum * cellFaceAreaM2 - 0.0625) < 1e-6);
});

test('SPH dispersed optical accumulation saturates to finite f32 values', () => {
  const opticalStateId = 44001;
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  renderRows.set([
    2.5e-13, 2.5e-13, 2.5e-13, 1,
    stableOpticalMaterialId('h2'), GPU_PHASE_IDS.gas, 450, 1,
    0.09, 1, 1, 0,
    1, 0.1, 1, 0,
    0, 0, 0, 0
  ]);
  const f32Max = 3.4028234663852886e38;
  const dispersedMediumOpticsRows = Float32Array.from([
    stableOpticalMaterialId('h2o'),
    GPU_PHASE_IDS.liquid,
    opticalStateId,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
    1,
    f32Max,
    f32Max,
    f32Max
  ]);
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'finite-overflow-route',
    material: 'h2',
    phase: 'gas',
    opticalStateId,
    resolution: 4,
    isolation: f32Max
  }]);
  const field = buildSphRenderFieldCpu({
    renderRows,
    dispersedMediumOpticsRows,
    surfaceTable,
    fieldPadding: 0,
    refEdgeM: 1e-12
  });
  assert.equal(field.fieldRows.every(Number.isFinite), true);
  assert.ok(field.fieldRows.some((value) => value === f32Max));

  const minimumSubnormalRows = new Float32Array(dispersedMediumOpticsRows);
  minimumSubnormalRows[5] = Math.fround(2 ** -149);
  minimumSubnormalRows[6] = 0;
  minimumSubnormalRows[7] = 0;
  const minimumSubnormalField = buildSphRenderFieldCpu({
    renderRows,
    dispersedMediumOpticsRows: minimumSubnormalRows,
    surfaceTable,
    fieldPadding: 0,
    refEdgeM: 1e-12
  });
  const centeredCellOffset = (1 + 4 + 16)
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
  assert.equal(
    minimumSubnormalField.fieldRows[centeredCellOffset + 5],
    2.2420775739689564e-20
  );

  const allowedMarginRefEdgeM = 2.1267647932558654e37;
  const allowedMarginRows = new Float32Array(renderRows);
  allowedMarginRows[0] = Math.fround(
    allowedMarginRefEdgeM * Math.fround(0.24975)
  );
  allowedMarginRows[1] = Math.fround(allowedMarginRefEdgeM * 0.25);
  allowedMarginRows[2] = Math.fround(allowedMarginRefEdgeM * 0.25);
  const allowedMarginTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'finite-denormal-intermediate-route',
    material: 'h2',
    phase: 'gas',
    opticalStateId,
    resolution: 4,
    isolation: 1
  }]);
  const allowedMarginField = buildSphRenderFieldCpu({
    renderRows: allowedMarginRows,
    dispersedMediumOpticsRows,
    surfaceTable: allowedMarginTable,
    fieldPadding: 0,
    refEdgeM: allowedMarginRefEdgeM
  });
  const fringeCellOffset = (0 + 4 + 16)
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS;
  assert.ok(
    allowedMarginField.fieldRows[fringeCellOffset + 5]
      >= Math.fround(2 ** -126),
    'a normal final optical depth must survive a subnormal naive intermediate'
  );

  const weightedRows = new Float32Array(2 * SPH_GPU_RENDER_ROW_FLOATS);
  for (let index = 0; index < 2; index += 1) {
    weightedRows.set([
      1, 1, 1, 1,
      stableOpticalMaterialId('h2'), GPU_PHASE_IDS.gas,
      index === 0 ? 100 : 1000,
      1,
      0.09, 1, 1, 0,
      1, 0.1, 1, 0,
      0, 0, 0, 0
    ], index * SPH_GPU_RENDER_ROW_FLOATS);
  }
  const unequalOpticsRows = Float32Array.from([
    stableOpticalMaterialId('h2o'), GPU_PHASE_IDS.liquid, opticalStateId,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready, 1, 1e30, 0, 0,
    stableOpticalMaterialId('h2o'), GPU_PHASE_IDS.liquid, opticalStateId,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready, 1, 1e38, 0, 0
  ]);
  const unequalTemperatureField = buildSphRenderFieldCpu({
    renderRows: weightedRows,
    dispersedMediumOpticsRows: unequalOpticsRows,
    surfaceTable: allowedMarginTable,
    fieldPadding: 0,
    refEdgeM: 4
  });
  assert.ok(
    Math.abs(
      unequalTemperatureField.fieldRows[centeredCellOffset + 4] - 1000
    ) <= 0.0001,
    'extinction-weighted temperature must retain unequal high-range weights'
  );

  weightedRows[6] = 0;
  weightedRows[SPH_GPU_RENDER_ROW_FLOATS + 6] = 900;
  const splitExtinctionOpticsRows = Float32Array.from([
    stableOpticalMaterialId('h2o'), GPU_PHASE_IDS.liquid, opticalStateId,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready, 1, f32Max, f32Max, 0,
    stableOpticalMaterialId('h2o'), GPU_PHASE_IDS.liquid, opticalStateId,
    SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready, 1, f32Max, 0, 0
  ]);
  const splitExtinctionTemperatureField = buildSphRenderFieldCpu({
    renderRows: weightedRows,
    dispersedMediumOpticsRows: splitExtinctionOpticsRows,
    surfaceTable: allowedMarginTable,
    fieldPadding: 0,
    refEdgeM: 4
  });
  assert.ok(
    Math.abs(
      splitExtinctionTemperatureField.fieldRows[centeredCellOffset + 4] - 300
    ) <= 0.0001,
    'scattering and absorption must remain independent extensive temperature weights before accumulation'
  );

  weightedRows[6] = 0;
  weightedRows[SPH_GPU_RENDER_ROW_FLOATS + 6] = f32Max;
  const exponentGapOpticsRows = new Float32Array(unequalOpticsRows);
  exponentGapOpticsRows[5] = f32Max;
  exponentGapOpticsRows[SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS + 5] =
    Math.fround(2 ** -126);
  const exponentGapTemperatureField = buildSphRenderFieldCpu({
    renderRows: weightedRows,
    dispersedMediumOpticsRows: exponentGapOpticsRows,
    surfaceTable: allowedMarginTable,
    fieldPadding: 0,
    refEdgeM: 4
  });
  assert.equal(
    exponentGapTemperatureField.fieldRows[centeredCellOffset + 4],
    Math.fround(2 ** -126),
    'a tiny weight with a maximum temperature must retain a normal numerator'
  );

  const signedMomentRows = new Float32Array(
    3 * SPH_GPU_RENDER_ROW_FLOATS
  );
  for (let index = 0; index < 3; index += 1) {
    signedMomentRows.set([
      1, 1, 1, 1,
      stableOpticalMaterialId('h2'), GPU_PHASE_IDS.gas, 300, 1,
      0.09, 1, 1, 0,
      1, 0.1, 1, 0,
      0, 0, 0, 0
    ], index * SPH_GPU_RENDER_ROW_FLOATS);
  }
  for (const signedMoments of [
    [f32Max, f32Max, -f32Max],
    [f32Max, -f32Max, f32Max],
    [-f32Max, f32Max, f32Max]
  ]) {
    const signedMomentOpticsRows = new Float32Array(
      3 * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS
    );
    for (let index = 0; index < 3; index += 1) {
      signedMomentOpticsRows.set([
        stableOpticalMaterialId('h2o'), GPU_PHASE_IDS.liquid, opticalStateId,
        SPH_DISPERSED_MEDIUM_OPTICS_STATUS.ready,
        1, f32Max, 0, signedMoments[index]
      ], index * SPH_DISPERSED_MEDIUM_OPTICS_ROW_FLOATS);
    }
    const signedMomentField = buildSphRenderFieldCpu({
      renderRows: signedMomentRows,
      dispersedMediumOpticsRows: signedMomentOpticsRows,
      surfaceTable: allowedMarginTable,
      fieldPadding: 0,
      refEdgeM: 4
    });
    assert.equal(
      signedMomentField.fieldRows[centeredCellOffset + 7],
      f32Max,
      'signed asymmetry aggregation must cancel before its final scattering clamp, independent of row order'
    );
  }

  const largeDomainRows = new Float32Array(renderRows);
  largeDomainRows[0] = Math.fround(f32Max * 0.25);
  largeDomainRows[1] = Math.fround(f32Max * 0.25);
  largeDomainRows[2] = Math.fround(f32Max * 0.25);
  const largeDomainTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'finite-large-domain-route',
    material: 'h2',
    phase: 'gas',
    opticalStateId,
    resolution: 4,
    isolation: 1
  }]);
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows: largeDomainRows,
      dispersedMediumOpticsRows,
      surfaceTable: largeDomainTable,
      fieldPadding: 0,
      refEdgeM: f32Max
    }),
    /cell scale enters the implementation-defined f32 denormal range/
  );
  assert.match(sphRenderFieldWgsl, /fn render_field_cic_axis_weight/);
  assert.match(sphRenderFieldWgsl, /fn render_field_saturating_nonnegative_product/);
  assert.match(sphRenderFieldWgsl, /fn render_field_accumulate_weighted_temperature/);
  assert.match(sphRenderFieldWgsl, /fn render_field_balanced_optical_product/);
  assert.match(sphRenderFieldWgsl, /render_field_accumulate_signed_scale/);
  assert.match(sphRenderFieldWgsl, /render_field_signed_scale_sum/);
});

test('SPH render fields reject particle counts beyond their exact row source', async () => {
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'exact-row-count',
    material: 'h2',
    phase: 'gas',
    resolution: 4
  }]);
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows,
      surfaceTable,
      particleCount: 2
    }),
    /particleCount must exactly match/
  );
  const productEventRows = new Float32Array(
    SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
  );
  assert.throws(
    () => buildSphRenderFieldCpu({
      renderRows,
      productEventRows,
      productEventCount: 2,
      surfaceTable
    }),
    /productEventCount must exactly match/
  );

  const { device } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array()
  });
  const undersizedRenderRowsBuffer = device.createBuffer({
    label: 'undersized-render-rows',
    size: SPH_GPU_RENDER_ROW_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: new Float32Array(),
      renderRowsBuffer: undersizedRenderRowsBuffer,
      surfaceTable,
      particleCount: 2,
      readbackMode: 'no-full-readback'
    }),
    /render field source rows capacity .* smaller than required binding range/
  );
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows,
      productEventRows,
      productEventCount: 2,
      surfaceTable,
      particleCount: 1,
      readbackMode: 'no-full-readback'
    }),
    /productEventCount must exactly match/
  );
});

test('SPH render-field WebGPU preflights device workgroup and storage limits before allocation', async () => {
  const renderRows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'device-limit-preflight',
    material: 'h2',
    phase: 'gas',
    resolution: 162
  }]);
  const workgroupRig = fakeSurfaceDrawDevice({
    limits: {
      maxBufferSize: 1024 * 1024 * 1024,
      maxStorageBufferBindingSize: 1024 * 1024 * 1024,
      maxComputeWorkgroupsPerDimension: 65_535
    }
  });
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device: workgroupRig.device,
      renderRows,
      surfaceTable,
      particleCount: 1,
      readbackMode: 'no-full-readback'
    }),
    /exceeds WebGPU device maxComputeWorkgroupsPerDimension/
  );
  assert.equal(workgroupRig.createdBuffers.length, 0);

  const storageRig = fakeSurfaceDrawDevice({
    limits: {
      maxBufferSize: 1024 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxComputeWorkgroupsPerDimension: 1_000_000
    }
  });
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device: storageRig.device,
      renderRows,
      surfaceTable,
      particleCount: 1,
      readbackMode: 'no-full-readback'
    }),
    /render field cells.*exceeds WebGPU device maxStorageBufferBindingSize/
  );
  assert.equal(storageRig.createdBuffers.length, 0);
});

test('SPH render GPU consumers reject every oversized dispatch before allocation or encoding', async () => {
  const renderField = twoSurfaceRenderField();
  const surfaceVertices = deriveSphRenderSurfaceVerticesCpu(renderField);
  const manyParticles = packedRenderParticlesWithCount(65);
  const generousBufferLimit = 2 ** 40;
  const cases = [
    {
      label: 'dense material-interface candidates',
      invoke: (device) => buildSphMaterialInterfaceCandidateFieldWebGpu({
        device,
        renderField
      })
    },
    {
      label: 'compact material-interface candidates',
      invoke: (device) => buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
        device,
        renderField,
        compactCandidateCapacity: 1
      })
    },
    {
      label: 'surface summary',
      invoke: (device) => summarizeSphRenderFieldSurfacesWebGpu({
        device,
        renderField
      })
    },
    {
      label: 'marching-cube cells',
      invoke: (device) => buildSphRenderMarchingCubeCellsWebGpu({
        device,
        renderField,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'surface vertices',
      invoke: (device) => buildSphRenderSurfaceVerticesWebGpu({
        device,
        renderField,
        readbackMode: 'no-full-readback',
        maxVertexRows: 3
      })
    },
    {
      label: 'surface draw metadata',
      invoke: (device) => buildSphRenderSurfaceDrawMetadataWebGpu({
        device,
        surfaceVertices,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'render-row extraction',
      invoke: (device) => extractSphRenderRowsWebGpu({
        device,
        sphParticleState: manyParticles,
        readbackMode: 'no-full-readback'
      })
    }
  ];

  for (const scenario of cases) {
    const rig = fakeSurfaceDrawDevice({
      limits: {
        maxBufferSize: generousBufferLimit,
        maxStorageBufferBindingSize: generousBufferLimit,
        maxComputeWorkgroupsPerDimension: 1
      }
    });
    await assert.rejects(
      () => scenario.invoke(rig.device),
      /exceeds WebGPU device maxComputeWorkgroupsPerDimension/,
      scenario.label
    );
    assert.equal(
      rig.createdBuffers.length,
      0,
      `${scenario.label} must reject before allocating a GPU buffer`
    );
    assert.equal(
      rig.commandEncoderCreations.length,
      0,
      `${scenario.label} must reject before creating a command encoder`
    );
    assert.equal(rig.dispatches.length, 0, scenario.label);
  }
});

test('SPH render GPU consumers reject every undersized borrowed storage input before allocation', async () => {
  const renderField = twoSurfaceRenderField();
  const fieldRowsByteLength = renderField.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const surfaceRowsByteLength = renderField.surfaceTable.surfaceCount
    * SPH_GPU_RENDER_SURFACE_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const sourceIndexFieldByteLength = Math.max(1, renderField.totalFieldCells)
    * Uint32Array.BYTES_PER_ELEMENT;
  const surfaceVertices = deriveSphRenderSurfaceVerticesCpu(renderField);
  const vertexRowCount = surfaceVertices.vertexRows.length
    / SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS;
  const vertexRowsByteLength = surfaceVertices.vertexRows.byteLength;
  const packed = packedRenderParticles();
  packed.materialPropertyBankParticleSizeTable = {
    rowCount: 1,
    rows: new Float32Array(16)
  };
  const renderRowBorrowedCases = [
    {
      label: 'render rows source state',
      requiredByteLength: packed.particleCount
        * SPH_GPU_PARTICLE_STATE_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      invoke: (device, buffer) => extractSphRenderRowsWebGpu({
        device,
        sphParticleState: packed,
        sourceStateBuffer: buffer,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'render rows source thermo',
      requiredByteLength: packed.particleCount
        * SPH_GPU_PARTICLE_THERMO_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      invoke: (device, buffer) => extractSphRenderRowsWebGpu({
        device,
        sphParticleState: packed,
        sourceThermoBuffer: buffer,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'render rows source identity',
      requiredByteLength: packed.particleCount * Uint32Array.BYTES_PER_ELEMENT,
      invoke: (device, buffer) => extractSphRenderRowsWebGpu({
        device,
        sphParticleState: packed,
        sourceIdentityBuffer: buffer,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'render rows source mechanics',
      requiredByteLength: packed.particleCount
        * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      invoke: (device, buffer) => extractSphRenderRowsWebGpu({
        device,
        sphParticleState: packed,
        sourceMechanicsBuffer: buffer,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'render rows material-bank particle-size table',
      requiredByteLength: 16 * Float32Array.BYTES_PER_ELEMENT,
      invoke: (device, buffer) => extractSphRenderRowsWebGpu({
        device,
        sphParticleState: packed,
        sphParticleUpload: {
          materialPropertyBankParticleSizeBuffer: buffer,
          materialPropertyBankParticleSizeRowCount: 1
        },
        readbackMode: 'no-full-readback'
      })
    }
  ];
  const cases = [
    {
      label: 'dense candidate source field',
      requiredByteLength: fieldRowsByteLength,
      invoke: (device, buffer) => buildSphMaterialInterfaceCandidateFieldWebGpu({
        device,
        renderField,
        fieldRowsBuffer: buffer
      })
    },
    {
      label: 'dense candidate surfaces',
      requiredByteLength: surfaceRowsByteLength,
      invoke: (device, buffer) => buildSphMaterialInterfaceCandidateFieldWebGpu({
        device,
        renderField,
        surfaceBuffer: buffer
      })
    },
    {
      label: 'compact candidate source field',
      requiredByteLength: fieldRowsByteLength,
      invoke: (device, buffer) => buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
        device,
        renderField,
        fieldRowsBuffer: buffer,
        compactCandidateCapacity: 1
      })
    },
    {
      label: 'compact candidate surfaces',
      requiredByteLength: surfaceRowsByteLength,
      invoke: (device, buffer) => buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
        device,
        renderField,
        surfaceBuffer: buffer,
        compactCandidateCapacity: 1
      })
    },
    {
      label: 'compact candidate source-index field',
      requiredByteLength: sourceIndexFieldByteLength,
      invoke: (device, buffer) => buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
        device,
        renderField,
        sourceIndexFieldBuffer: buffer,
        compactCandidateCapacity: 1
      })
    },
    {
      label: 'surface summary source field',
      requiredByteLength: fieldRowsByteLength,
      invoke: (device, buffer) => summarizeSphRenderFieldSurfacesWebGpu({
        device,
        renderField,
        fieldRowsBuffer: buffer
      })
    },
    {
      label: 'surface summary surfaces',
      requiredByteLength: surfaceRowsByteLength,
      invoke: (device, buffer) => summarizeSphRenderFieldSurfacesWebGpu({
        device,
        renderField,
        surfaceBuffer: buffer
      })
    },
    {
      label: 'marching-cube source field',
      requiredByteLength: fieldRowsByteLength,
      invoke: (device, buffer) => buildSphRenderMarchingCubeCellsWebGpu({
        device,
        renderField,
        fieldRowsBuffer: buffer,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'marching-cube surfaces',
      requiredByteLength: surfaceRowsByteLength,
      invoke: (device, buffer) => buildSphRenderMarchingCubeCellsWebGpu({
        device,
        renderField,
        surfaceBuffer: buffer,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'surface vertices source field',
      requiredByteLength: fieldRowsByteLength,
      invoke: (device, buffer) => buildSphRenderSurfaceVerticesWebGpu({
        device,
        renderField,
        fieldRowsBuffer: buffer,
        readbackMode: 'no-full-readback',
        maxVertexRows: 3
      })
    },
    {
      label: 'surface vertices surfaces',
      requiredByteLength: surfaceRowsByteLength,
      invoke: (device, buffer) => buildSphRenderSurfaceVerticesWebGpu({
        device,
        renderField,
        surfaceBuffer: buffer,
        readbackMode: 'no-full-readback',
        maxVertexRows: 3
      })
    },
    {
      label: 'surface draw source vertices',
      requiredByteLength: vertexRowsByteLength,
      invoke: (device, buffer) => buildSphRenderSurfaceDrawMetadataWebGpu({
        device,
        surfaceVertices: {
          ...surfaceVertices,
          vertexRows: new Float32Array(),
          vertexRowsBuffer: buffer,
          vertexRowsBufferRowCount: vertexRowCount,
          vertexRowsBufferByteLength: vertexRowsByteLength
        },
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'surface draw surfaces',
      requiredByteLength: surfaceRowsByteLength,
      invoke: (device, buffer) => buildSphRenderSurfaceDrawMetadataWebGpu({
        device,
        surfaceVertices,
        surfaceBuffer: buffer,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'surface draw source vertex counter',
      requiredByteLength: 16,
      invoke: (device, buffer) => buildSphRenderSurfaceDrawMetadataWebGpu({
        device,
        surfaceVertices: {
          ...surfaceVertices,
          vertexCounterBuffer: buffer,
          vertexCounterBufferByteLength: 16,
          surfaceVertexEmissionMode: 'atomic-compact'
        },
        readbackMode: 'no-full-readback'
      })
    },
    ...renderRowBorrowedCases
  ];

  for (const scenario of cases) {
    const rig = fakeSurfaceDrawDevice({
      limits: {
        maxBufferSize: 2 ** 40,
        maxStorageBufferBindingSize: 2 ** 40,
        maxComputeWorkgroupsPerDimension: 65_535
      }
    });
    const undersizedBuffer = borrowedGpuBuffer(
      `undersized-${scenario.label}`,
      scenario.requiredByteLength - Uint32Array.BYTES_PER_ELEMENT
    );
    await assert.rejects(
      () => scenario.invoke(rig.device, undersizedBuffer),
      /capacity .* is smaller than required binding range/,
      scenario.label
    );
    assert.equal(
      rig.createdBuffers.length,
      0,
      `${scenario.label} must reject before allocating owned buffers`
    );
    assert.equal(
      rig.commandEncoderCreations.length,
      0,
      `${scenario.label} must reject before command encoding`
    );

    const bindingLimitRig = fakeSurfaceDrawDevice({
      limits: {
        maxBufferSize: 2 ** 40,
        maxStorageBufferBindingSize:
          scenario.requiredByteLength - Uint32Array.BYTES_PER_ELEMENT,
        maxComputeWorkgroupsPerDimension: 65_535
      }
    });
    const oversizedBuffer = borrowedGpuBuffer(
      `oversized-${scenario.label}`,
      scenario.requiredByteLength + 4096
    );
    await assert.rejects(
      () => scenario.invoke(bindingLimitRig.device, oversizedBuffer),
      /exceeds WebGPU device maxStorageBufferBindingSize/,
      `${scenario.label} storage binding limit`
    );
    assert.equal(
      bindingLimitRig.createdBuffers.length,
      0,
      `${scenario.label} binding limit must reject before allocation`
    );
    assert.equal(
      bindingLimitRig.commandEncoderCreations.length,
      0,
      `${scenario.label} binding limit must reject before command encoding`
    );
  }
});

test('SPH dense render field rejects undersized borrowed rows, events, and pooled target before allocation', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'borrowed-render-field-preflight',
    material: 'Au',
    phase: 'solid',
    resolution: 4
  }]);
  const renderRowsByteLength = packed.particleCount
    * SPH_GPU_RENDER_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const productEventRowsByteLength = SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const fieldRowsByteLength = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const cases = [
    {
      label: 'render rows',
      requiredByteLength: renderRowsByteLength,
      expected: /render field source rows capacity .* smaller than required binding range/,
      invoke: (device, byteLength = renderRowsByteLength - Uint32Array.BYTES_PER_ELEMENT) => buildSphRenderFieldWebGpu({
        device,
        renderRowsBuffer: borrowedGpuBuffer(
          'undersized-render-field-source-rows',
          byteLength
        ),
        surfaceTable,
        particleCount: packed.particleCount,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'product events',
      requiredByteLength: productEventRowsByteLength,
      expected: /render field product events capacity .* smaller than required binding range/,
      invoke: (device, byteLength = productEventRowsByteLength - Uint32Array.BYTES_PER_ELEMENT) => buildSphRenderFieldWebGpu({
        device,
        renderRows: extracted.renderRows,
        productEventBuffer: borrowedGpuBuffer(
          'undersized-render-field-product-events',
          byteLength
        ),
        surfaceTable,
        particleCount: packed.particleCount,
        productEventCount: 1,
        readbackMode: 'no-full-readback'
      })
    },
    {
      label: 'pooled target cells',
      requiredByteLength: fieldRowsByteLength,
      expected: /targetFieldRowsBuffer is too small/,
      invoke: (device, byteLength = fieldRowsByteLength - Uint32Array.BYTES_PER_ELEMENT) => buildSphRenderFieldWebGpu({
        device,
        renderRows: extracted.renderRows,
        surfaceTable,
        particleCount: packed.particleCount,
        targetFieldRowsBuffer: borrowedGpuBuffer(
          'undersized-render-field-target-cells',
          byteLength
        ),
        readbackMode: 'no-full-readback'
      })
    }
  ];

  for (const scenario of cases) {
    const rig = fakeSurfaceDrawDevice({
      limits: {
        maxBufferSize: 2 ** 40,
        maxStorageBufferBindingSize: 2 ** 40,
        maxComputeWorkgroupsPerDimension: 65_535
      }
    });
    await assert.rejects(
      () => scenario.invoke(rig.device),
      scenario.expected,
      scenario.label
    );
    assert.equal(rig.createdBuffers.length, 0, scenario.label);
    assert.equal(rig.commandEncoderCreations.length, 0, scenario.label);

    const bindingLimitRig = fakeSurfaceDrawDevice({
      limits: {
        maxBufferSize: 2 ** 40,
        maxStorageBufferBindingSize:
          scenario.requiredByteLength - Uint32Array.BYTES_PER_ELEMENT,
        maxComputeWorkgroupsPerDimension: 65_535
      }
    });
    await assert.rejects(
      () => scenario.invoke(
        bindingLimitRig.device,
        scenario.requiredByteLength + 4096
      ),
      /exceeds WebGPU device maxStorageBufferBindingSize/,
      `${scenario.label} storage binding limit`
    );
    assert.equal(bindingLimitRig.createdBuffers.length, 0, scenario.label);
    assert.equal(
      bindingLimitRig.commandEncoderCreations.length,
      0,
      scenario.label
    );
  }
});

test('SPH dense render field binds only required prefixes from oversized borrowed rows, events, and pooled target', async () => {
  const packed = packedRenderParticles();
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'oversized-render-field-prefixes',
    material: 'Au',
    phase: 'solid',
    resolution: 4
  }]);
  const renderRowsByteLength = packed.particleCount
    * SPH_GPU_RENDER_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const productEventRowsByteLength = SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const fieldRowsByteLength = surfaceTable.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const renderRowsBuffer = borrowedGpuBuffer(
    'oversized-render-field-source-rows',
    renderRowsByteLength + 4096
  );
  const productEventBuffer = borrowedGpuBuffer(
    'oversized-render-field-product-events',
    productEventRowsByteLength + 4096
  );
  const targetFieldRowsBuffer = borrowedGpuBuffer(
    'oversized-render-field-target-cells',
    fieldRowsByteLength + 4096
  );
  const rig = fakeSurfaceDrawDevice({ drawRows: new Float32Array() });

  const result = await buildSphRenderFieldWebGpu({
    device: rig.device,
    renderRowsBuffer,
    productEventBuffer,
    surfaceTable,
    particleCount: packed.particleCount,
    productEventCount: 1,
    targetFieldRowsBuffer,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    waitForQueueCompletion: false,
    deferCleanup: false
  });

  const bindGroup = rig.bindGroups.at(-1);
  const renderRowsEntry = bindGroup.entries.find((entry) => entry.binding === 0);
  const targetEntry = bindGroup.entries.find((entry) => entry.binding === 2);
  const productEventsEntry = bindGroup.entries.find((entry) => entry.binding === 4);
  assert.deepEqual(renderRowsEntry.resource, {
    buffer: renderRowsBuffer,
    size: renderRowsByteLength
  });
  assert.deepEqual(productEventsEntry.resource, {
    buffer: productEventBuffer,
    size: productEventRowsByteLength
  });
  assert.deepEqual(targetEntry.resource, {
    buffer: targetFieldRowsBuffer,
    size: fieldRowsByteLength
  });
  assert.equal(result.fieldRowsBuffer, targetFieldRowsBuffer);
  assert.equal(result.fieldRowsBufferBorrowed, true);
  result.releaseRenderFieldBufferLeases();
  result.destroyRenderFieldBuffers({ releaseLeases: true });
  assert.equal(targetFieldRowsBuffer.destroyed, false);
});

test('SPH surface draw reconciles the borrowed row upper bound and counter ABI before binding exact prefixes', async () => {
  const renderField = twoSurfaceRenderField();
  const derivedVertices = deriveSphRenderSurfaceVerticesCpu(renderField);
  const sourceVertexRowCount = 3;
  const sourceVertexRowsByteLength = sourceVertexRowCount
    * SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const surfaceRowsByteLength = derivedVertices.surfaceCount
    * SPH_GPU_RENDER_SURFACE_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const vertexRowsBuffer = borrowedGpuBuffer(
    'oversized-surface-draw-source-vertices',
    sourceVertexRowsByteLength + 4096
  );
  const vertexCounterBuffer = borrowedGpuBuffer(
    'oversized-surface-draw-source-counter',
    512
  );
  const surfaceBuffer = borrowedGpuBuffer(
    'oversized-surface-draw-surfaces',
    surfaceRowsByteLength + 4096
  );
  const surfaceVertices = {
    ...derivedVertices,
    vertexRows: new Float32Array(),
    vertexRowsBuffer,
    vertexRowsBufferRowCount: sourceVertexRowCount,
    vertexRowsBufferByteLength: sourceVertexRowsByteLength,
    maxVertexRows: sourceVertexRowCount,
    vertexCounterBuffer,
    vertexCounterBufferByteLength: 16,
    surfaceVertexEmissionMode: 'atomic-compact'
  };
  const mismatchRig = fakeSurfaceDrawDevice({});
  await assert.rejects(
    () => buildSphRenderSurfaceDrawMetadataWebGpu({
      device: mismatchRig.device,
      surfaceVertices: {
        ...surfaceVertices,
        vertexRowsBufferByteLength: sourceVertexRowsByteLength
          + SPH_GPU_RENDER_SURFACE_VERTEX_FLOATS
            * Float32Array.BYTES_PER_ELEMENT
      },
      surfaceBuffer,
      readbackMode: 'no-full-readback'
    }),
    /row-count and byte-length metadata describe different borrowed ranges/
  );
  assert.equal(mismatchRig.createdBuffers.length, 0);
  assert.equal(mismatchRig.commandEncoderCreations.length, 0);

  const counterMismatchRig = fakeSurfaceDrawDevice({});
  await assert.rejects(
    () => buildSphRenderSurfaceDrawMetadataWebGpu({
      device: counterMismatchRig.device,
      surfaceVertices: {
        ...surfaceVertices,
        vertexCounterBufferByteLength: 12
      },
      surfaceBuffer,
      readbackMode: 'no-full-readback'
    }),
    /counter byte length does not match its exact storage ABI/
  );
  assert.equal(counterMismatchRig.createdBuffers.length, 0);
  assert.equal(counterMismatchRig.commandEncoderCreations.length, 0);

  const rig = fakeSurfaceDrawDevice({});
  const result = await buildSphRenderSurfaceDrawMetadataWebGpu({
    device: rig.device,
    surfaceVertices,
    surfaceBuffer,
    readbackMode: 'no-full-readback',
    retainDrawRowsBuffer: true,
    retainDrawIndirectRowsBuffer: true,
    retainCompactedVertexRowsBuffer: true,
    waitForQueueCompletion: false
  });
  const bindGroup = rig.bindGroups.at(-1);
  assert.deepEqual(
    bindGroup.entries.find((entry) => entry.binding === 0).resource,
    { buffer: surfaceBuffer, size: surfaceRowsByteLength }
  );
  assert.deepEqual(
    bindGroup.entries.find((entry) => entry.binding === 1).resource,
    { buffer: vertexRowsBuffer, size: sourceVertexRowsByteLength }
  );
  assert.deepEqual(
    bindGroup.entries.find((entry) => entry.binding === 6).resource,
    { buffer: vertexCounterBuffer, size: 16 }
  );
  assert.equal(result.sourceVertexRowCount, sourceVertexRowCount);
  assert.equal(result.sourceVertexCounterMode, 'resident-vertex-counter');
  assert.equal(result.surfaceDrawGpuOnlyUpperBoundVertexCount, 3);
  result.releaseSurfaceDrawBufferLeases();
  result.destroySurfaceDrawBuffers({ releaseLeases: true });
  assert.equal(vertexRowsBuffer.destroyed, false);
  assert.equal(vertexCounterBuffer.destroyed, false);
  assert.equal(surfaceBuffer.destroyed, false);
});

test('SPH render GPU consumers bind exact prefixes from oversized borrowed storage buffers', async () => {
  const renderField = twoSurfaceRenderField();
  const fieldRowsByteLength = renderField.totalFieldCells
    * SPH_GPU_RENDER_FIELD_CELL_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const surfaceRowsByteLength = renderField.surfaceTable.surfaceCount
    * SPH_GPU_RENDER_SURFACE_ROW_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const sourceIndexFieldByteLength = renderField.totalFieldCells
    * Uint32Array.BYTES_PER_ELEMENT;
  const oversizedFieldRowsBuffer = borrowedGpuBuffer(
    'oversized-shared-render-field-rows',
    fieldRowsByteLength + 4096
  );
  const oversizedSurfaceBuffer = borrowedGpuBuffer(
    'oversized-shared-render-surfaces',
    surfaceRowsByteLength + 4096
  );

  const denseCandidateRig = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(
      renderField.totalFieldCells
        * 3
        * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS
    )
  });
  await buildSphMaterialInterfaceCandidateFieldWebGpu({
    device: denseCandidateRig.device,
    renderField,
    fieldRowsBuffer: oversizedFieldRowsBuffer,
    surfaceBuffer: oversizedSurfaceBuffer
  });
  assert.deepEqual(
    denseCandidateRig.bindGroups[0].entries[0].resource,
    { buffer: oversizedSurfaceBuffer, size: surfaceRowsByteLength }
  );
  assert.deepEqual(
    denseCandidateRig.bindGroups[0].entries[1].resource,
    { buffer: oversizedFieldRowsBuffer, size: fieldRowsByteLength }
  );

  const oversizedSourceIndexFieldBuffer = borrowedGpuBuffer(
    'oversized-compact-source-index-field',
    sourceIndexFieldByteLength + 4096
  );
  const compactCandidateRig = fakeSurfaceDrawDevice({
    candidateMetadataRows: new Uint32Array([
      0,
      0,
      1,
      renderField.totalFieldCells * 3
    ])
  });
  await buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
    device: compactCandidateRig.device,
    renderField,
    fieldRowsBuffer: oversizedFieldRowsBuffer,
    surfaceBuffer: oversizedSurfaceBuffer,
    sourceIndexFieldBuffer: oversizedSourceIndexFieldBuffer,
    compactCandidateCapacity: 1
  });
  const compactBindGroup = compactCandidateRig.bindGroups[0];
  assert.deepEqual(compactBindGroup.entries[0].resource, {
    buffer: oversizedSurfaceBuffer,
    size: surfaceRowsByteLength
  });
  assert.deepEqual(compactBindGroup.entries[1].resource, {
    buffer: oversizedFieldRowsBuffer,
    size: fieldRowsByteLength
  });
  assert.deepEqual(compactBindGroup.entries[5].resource, {
    buffer: oversizedSourceIndexFieldBuffer,
    size: sourceIndexFieldByteLength
  });

  const cpuSummary = summarizeSphRenderFieldSurfacesCpu(renderField);
  const summaryRig = fakeSurfaceDrawDevice({
    summaryRows: cpuSummary.summaryRows
  });
  await summarizeSphRenderFieldSurfacesWebGpu({
    device: summaryRig.device,
    renderField,
    fieldRowsBuffer: oversizedFieldRowsBuffer,
    surfaceBuffer: oversizedSurfaceBuffer
  });
  assert.deepEqual(summaryRig.bindGroups[0].entries[0].resource, {
    buffer: oversizedSurfaceBuffer,
    size: surfaceRowsByteLength
  });
  assert.deepEqual(summaryRig.bindGroups[0].entries[1].resource, {
    buffer: oversizedFieldRowsBuffer,
    size: fieldRowsByteLength
  });

  const marchingRig = fakeSurfaceDrawDevice({});
  const marching = await buildSphRenderMarchingCubeCellsWebGpu({
    device: marchingRig.device,
    renderField,
    fieldRowsBuffer: oversizedFieldRowsBuffer,
    surfaceBuffer: oversizedSurfaceBuffer,
    readbackMode: 'no-full-readback',
    retainCellRowsBuffer: true
  });
  assert.deepEqual(marchingRig.bindGroups[0].entries[0].resource, {
    buffer: oversizedSurfaceBuffer,
    size: surfaceRowsByteLength
  });
  assert.deepEqual(marchingRig.bindGroups[0].entries[1].resource, {
    buffer: oversizedFieldRowsBuffer,
    size: fieldRowsByteLength
  });
  marching.destroyMarchingCubeCellBuffers();

  const vertexRig = fakeSurfaceDrawDevice({});
  const vertices = await buildSphRenderSurfaceVerticesWebGpu({
    device: vertexRig.device,
    renderField,
    fieldRowsBuffer: oversizedFieldRowsBuffer,
    surfaceBuffer: oversizedSurfaceBuffer,
    readbackMode: 'no-full-readback',
    retainVertexRowsBuffer: true,
    maxVertexRows: 3
  });
  assert.deepEqual(vertexRig.bindGroups[0].entries[0].resource, {
    buffer: oversizedSurfaceBuffer,
    size: surfaceRowsByteLength
  });
  assert.deepEqual(vertexRig.bindGroups[0].entries[1].resource, {
    buffer: oversizedFieldRowsBuffer,
    size: fieldRowsByteLength
  });
  vertices.releaseSurfaceVertexBufferLeases();
  vertices.destroySurfaceVertexBuffers({ releaseLeases: true });

  const packed = packedRenderParticles();
  packed.materialPropertyBankParticleSizeTable = {
    rowCount: 1,
    rows: new Float32Array(16)
  };
  const stateRowsByteLength = packed.state.byteLength;
  const thermoRowsByteLength = packed.thermo.byteLength;
  const identityRowsByteLength = packed.particleCount
    * Uint32Array.BYTES_PER_ELEMENT;
  const mechanicsRowsByteLength = packed.particleCount
    * MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS
    * Float32Array.BYTES_PER_ELEMENT;
  const materialBankRowsByteLength = 16 * Float32Array.BYTES_PER_ELEMENT;
  const sourceStateBuffer = borrowedGpuBuffer(
    'oversized-render-row-state',
    stateRowsByteLength + 4096
  );
  const sourceThermoBuffer = borrowedGpuBuffer(
    'oversized-render-row-thermo',
    thermoRowsByteLength + 4096
  );
  const sourceIdentityBuffer = borrowedGpuBuffer(
    'oversized-render-row-identity',
    identityRowsByteLength + 4096
  );
  const sourceMechanicsBuffer = borrowedGpuBuffer(
    'oversized-render-row-mechanics',
    mechanicsRowsByteLength + 4096
  );
  const materialPropertyBankParticleSizeBuffer = borrowedGpuBuffer(
    'oversized-render-row-material-bank',
    materialBankRowsByteLength + 4096
  );
  const renderRowsRig = fakeSurfaceDrawDevice({});
  const renderRows = await extractSphRenderRowsWebGpu({
    device: renderRowsRig.device,
    sphParticleState: packed,
    sphParticleUpload: {
      materialPropertyBankParticleSizeBuffer,
      materialPropertyBankParticleSizeRowCount: 1
    },
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceIdentityBuffer,
    sourceMechanicsBuffer,
    readbackMode: 'no-full-readback',
    retainRenderRowsBuffer: true
  });
  const renderRowsBindGroup = renderRowsRig.bindGroups[0];
  for (const [binding, buffer, size] of [
    [0, sourceStateBuffer, stateRowsByteLength],
    [1, sourceThermoBuffer, thermoRowsByteLength],
    [4, sourceMechanicsBuffer, mechanicsRowsByteLength],
    [5, materialPropertyBankParticleSizeBuffer, materialBankRowsByteLength],
    [6, sourceIdentityBuffer, identityRowsByteLength]
  ]) {
    assert.deepEqual(
      renderRowsBindGroup.entries.find((entry) => entry.binding === binding).resource,
      { buffer, size }
    );
  }
  renderRows.destroyRenderRowsBuffer();

  for (const buffer of [
    oversizedFieldRowsBuffer,
    oversizedSurfaceBuffer,
    oversizedSourceIndexFieldBuffer,
    sourceStateBuffer,
    sourceThermoBuffer,
    sourceIdentityBuffer,
    sourceMechanicsBuffer,
    materialPropertyBankParticleSizeBuffer
  ]) {
    assert.equal(buffer.destroyed, false, `${buffer.label} remains caller-owned`);
  }
});

test('SPH render field surface table opts into retained physical particle radii without stealing draw policy lanes', () => {
  const table = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'h2o|h2o|liquid',
    material: 'h2o',
    phase: 'liquid',
    resolution: 16,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.2,
    particleRadiusScale: 0.75,
    particleRadiusPolicyStatus: 'h2o-liquid-continuity-floor-applied',
    particleRadiusPolicyMode: 'retained-particle-radius-with-h2o-liquid-continuity-floor',
    particleRadiusContinuityFloorEligible: true,
    particleRadiusContinuityFloorApplied: true,
    particleRadiusScaleRequested: 0.5,
    particleRadiusContinuityFloorScale: 0.75,
    particleRadiusContinuityRepresentativeRadiusM: 0.1,
    particleRadiusContinuitySmoothingLengthM: 0.2,
    transparencyClassId: 2,
    depthWriteFlag: 0
  }]);

  assert.equal(table.records[8], -0.75);
  assert.equal(table.records[14], 2);
  assert.equal(table.records[15], 0);
  assert.equal(table.metadata[0].radiusNorm, 0.2);
  assert.equal(table.metadata[0].particleRadiusScale, 0.75);
  assert.equal(table.metadata[0].particleRadiusPolicyStatus, 'h2o-liquid-continuity-floor-applied');
  assert.equal(
    table.metadata[0].particleRadiusPolicyMode,
    'retained-particle-radius-with-h2o-liquid-continuity-floor'
  );
  assert.equal(table.metadata[0].particleRadiusContinuityFloorEligible, true);
  assert.equal(table.metadata[0].particleRadiusContinuityFloorApplied, true);
  assert.equal(table.metadata[0].particleRadiusScaleRequested, 0.5);
  assert.equal(table.metadata[0].particleRadiusContinuityFloorScale, 0.75);
  assert.equal(table.metadata[0].particleRadiusContinuityRepresentativeRadiusM, 0.1);
  assert.equal(table.metadata[0].particleRadiusContinuitySmoothingLengthM, 0.2);
  assert.equal(table.metadata[0].particleRadiusFloorNorm, Math.sqrt(0.75 / (16 * 16) + 0.000001));
});

test('SPH render field physical-radius mode follows each retained particle radius', () => {
  const materialId = stableOpticalMaterialId('h2o');
  const renderRowsForRadius = (particleRadiusM, positionM = 0.5, liquidWeight = 1) => {
    const rows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
    rows.set([
      positionM, positionM, positionM, 1,
      materialId, GPU_PHASE_IDS.liquid, 300, 1,
      1000, 1 - liquidWeight, 1, 0,
      (4 * Math.PI * particleRadiusM ** 3) / 3,
      particleRadiusM,
      1,
      0,
      0,
      0, 0, 0
    ]);
    return rows;
  };
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'h2o|h2o|liquid',
    material: 'h2o',
    phase: 'liquid',
    resolution: 32,
    isolation: 80,
    subtract: 24,
    // Deliberately unrelated legacy fallback: particle-radius mode must make
    // the retained row radius authoritative for particle contributions.
    radiusNorm: 0.3,
    particleRadiusScale: 1
  }]);
  const activeCellCount = (particleRadiusM, positionM = 0.5, liquidWeight = 1) => {
    const field = buildSphRenderFieldCpu({
      renderRows: renderRowsForRadius(particleRadiusM, positionM, liquidWeight),
      surfaceTable,
      fieldPadding: 0.22,
      refEdgeM: 1
    });
    let count = 0;
    for (let offset = 0; offset < field.fieldRows.length; offset += SPH_GPU_RENDER_FIELD_CELL_FLOATS) {
      if (field.fieldRows[offset] >= 80) count += 1;
    }
    return count;
  };

  const smallCount = activeCellCount(0.05);
  const largeCount = activeCellCount(0.2);
  // Put a sub-cell particle halfway between samples on all three axes. The
  // one-cell conservative voxel floor must keep it extractable; the previous
  // aligned-only test could not detect this aliasing hole.
  const halfCellNormalized = 0.5 + 0.5 / 32;
  const halfCellPositionM = (halfCellNormalized - 0.22) / (1 - 2 * 0.22);
  const offGridSmallCount = activeCellCount(0.04, halfCellPositionM);
  const halfWeightOffGridCount = activeCellCount(0.04, halfCellPositionM, 0.5);
  const tenthWeightOffGridCount = activeCellCount(0.04, halfCellPositionM, 0.1);
  assert.ok(smallCount > 0);
  assert.ok(offGridSmallCount > 0);
  assert.ok(halfWeightOffGridCount < offGridSmallCount);
  assert.ok(tenthWeightOffGridCount <= halfWeightOffGridCount);
  assert.ok(largeCount > smallCount * 8);
});

test('SPH render field partitions one carrier into monotone solid and liquid isovolumes', () => {
  const materialId = stableOpticalMaterialId('h2o');
  const resolution = 32;
  const isolation = 80;
  const subtract = 24;
  const fieldPadding = 0.22;
  const refEdgeM = 1;
  const particleRadiusM = 0.04;
  const normalizedPosition = 0.5 + 0.5 / resolution;
  const positionM = (normalizedPosition - fieldPadding) / (1 - 2 * fieldPadding);
  const surfaceTable = buildSphRenderFieldSurfaceTable([
    {
      surfaceKey: 'h2o|h2o|solid',
      material: 'h2o',
      phase: 'solid',
      resolution,
      isolation,
      subtract,
      radiusNorm: 0.3,
      particleRadiusScale: 1
    },
    {
      surfaceKey: 'h2o|h2o|liquid',
      material: 'h2o',
      phase: 'liquid',
      resolution,
      isolation,
      subtract,
      radiusNorm: 0.3,
      particleRadiusScale: 1
    }
  ]);
  const fractions = [0, 0.01, 0.1, 0.25, 0.49, 0.5, 0.51, 0.75, 0.9, 0.99, 1];
  const byFraction = fractions.map((liquidFraction) => {
    const solidFraction = 1 - liquidFraction;
    const rows = new Float32Array(SPH_GPU_RENDER_ROW_FLOATS);
    rows.set([
      positionM, positionM, positionM, 1,
      materialId,
      liquidFraction >= 0.5 ? GPU_PHASE_IDS.liquid : GPU_PHASE_IDS.solid,
      273.15,
      1,
      1000,
      0,
      1,
      0,
      (4 * Math.PI * particleRadiusM ** 3) / 3,
      particleRadiusM,
      1,
      0,
      solidFraction,
      0, 0, 0
    ]);
    const field = buildSphRenderFieldCpu({
      renderRows: rows,
      surfaceTable,
      fieldPadding,
      refEdgeM
    });
    const densityFor = (phaseId) => {
      const surface = surfaceTable.metadata.find((entry) => entry.phaseId === phaseId);
      const values = new Float32Array(surface.fieldCellCount);
      for (let index = 0; index < surface.fieldCellCount; index += 1) {
        values[index] = field.fieldRows[
          (surface.fieldOffset + index) * SPH_GPU_RENDER_FIELD_CELL_FLOATS
        ];
      }
      return values;
    };
    return {
      liquidFraction,
      solid: densityFor(GPU_PHASE_IDS.solid),
      liquid: densityFor(GPU_PHASE_IDS.liquid)
    };
  });

  for (let sample = 1; sample < byFraction.length; sample += 1) {
    const previous = byFraction[sample - 1];
    const current = byFraction[sample];
    for (let cell = 0; cell < current.solid.length; cell += 1) {
      assert.ok(current.solid[cell] <= previous.solid[cell] + 1e-5);
      assert.ok(current.liquid[cell] + 1e-5 >= previous.liquid[cell]);
    }
  }

  const selectedCell = (16 * resolution + 16) * resolution + 16;
  const radiusFloorNorm = Math.sqrt(0.75 / (resolution * resolution) + 0.000001);
  const radiusNorm = Math.max(
    particleRadiusM * (1 - 2 * fieldPadding) / refEdgeM,
    radiusFloorNorm
  );
  const fullStrength = (isolation + subtract) * radiusNorm * radiusNorm;
  const distance = 16 / resolution - normalizedPosition;
  const distanceSquared = 3 * distance * distance;
  for (const sample of byFraction) {
    const fraction = sample.liquidFraction;
    const q = Math.cbrt(fraction * fraction);
    const strength = fullStrength * q
      + (isolation + subtract) * 0.000001 * (1 - q);
    const expected = Math.max(
      0,
      strength / (0.000001 + distanceSquared) - subtract
    );
    assert.ok(Math.abs(sample.liquid[selectedCell] - expected) < 2e-4);
  }
  assert.ok(byFraction.at(-1).liquid[selectedCell] > 0);
  assert.ok(byFraction[5].liquid[selectedCell] < byFraction.at(-1).liquid[selectedCell]);
  assert.equal(byFraction[0].liquid[selectedCell], 0);
  assert.equal(byFraction.at(-1).solid[selectedCell], 0);
});

test('SPH render field sparse proxy is strength-independent and matches the WGSL lattice bound', () => {
  const resolution = 32;
  const expectedFloor = Math.sqrt(0.75 / (resolution * resolution) + 0.000001);
  const table = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'h2|h2|gas',
    material: 'h2',
    phase: 'gas',
    resolution,
    isolation: 80,
    subtract: 24,
    radiusNorm: 0.3,
    // Exercise the public explicit-strength path; it must not create a
    // CPU/GPU disagreement in the physical-radius alias proxy.
    strength: 0.012345,
    particleRadiusScale: 1
  }]);

  assert.equal(table.records[7], Math.fround(0.012345));
  assert.equal(table.metadata[0].particleRadiusFloorNorm, expectedFloor);
  assert.match(
    sphRenderFieldWgsl,
    /sqrt\(0\.75 \* inv_resolution \* inv_resolution \+ 0\.000001\)/
  );
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

test('SPH compact material interface candidate field emits retained source-key sidecar', async () => {
  const field = twoSurfaceRenderField();
  const denseCandidateField = deriveSphMaterialInterfaceCandidateField(field);
  const activeCandidateRows = compactActiveCandidateRows(denseCandidateField.candidateRows);
  const activeCandidateCount = activeCandidateRows.length / SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS;
  const sourceKeyRows = new Float32Array(activeCandidateCount * SPH_INTERFACE_SOURCE_KEY_FLOATS);
  for (let index = 0; index < activeCandidateCount; index += 1) {
    const offset = index * SPH_INTERFACE_SOURCE_KEY_FLOATS;
    sourceKeyRows.set([index, index % 3, 1, 0], offset);
  }
  const { device, bindGroups } = fakeSurfaceDrawDevice({
    drawRows: activeCandidateRows,
    candidateMetadataRows: new Uint32Array([
      activeCandidateCount,
      0,
      activeCandidateCount,
      denseCandidateField.candidateCount
    ]),
    sourceKeyRows
  });
  const sourceIndexFieldBuffer = device.createBuffer({
    label: 'test-source-index-field',
    size: Math.max(4, field.totalFieldCells * Uint32Array.BYTES_PER_ELEMENT),
    usage: 0
  });

  const compactField = await buildSphMaterialInterfaceCompactCandidateFieldWebGpu({
    device,
    renderField: field,
    sourceIndexFieldBuffer,
    compactCandidateCapacity: activeCandidateCount
  });
  const interfaceField = compactSphMaterialInterfaceCandidates(compactField);

  assert.equal(compactField.schema, 'peercompute.ulg.sph-material-interface-candidate-field.v0');
  assert.equal(compactField.backend, 'webgpu-compact');
  assert.equal(compactField.status, 'material-interface-candidate-field-ready');
  assert.equal(compactField.sourceIndexFieldBufferBound, true);
  assert.equal(compactField.interfaceSourceKeySchema, ULG_SPH_INTERFACE_SOURCE_KEY_SCHEMA);
  assert.equal(compactField.interfaceSourceKeyStatus, 'interface-source-key-retained');
  assert.equal(compactField.interfaceSourceKeyRowCount, activeCandidateCount);
  assert.equal(compactField.interfaceSourceKeyReadyCount, activeCandidateCount);
  assert.equal(compactField.interfaceSourceKeyStrideFloats, SPH_INTERFACE_SOURCE_KEY_FLOATS);
  assert.deepEqual(Array.from(compactField.interfaceSourceKeyRows), Array.from(sourceKeyRows));
  assert.equal(compactField.interfaceSourceKeyBufferRetained, true);
  assert.equal(compactField.interfaceSourceKeyBuffer.label, 'ulg-sph-interface-source-keys');
  assert.equal(compactField.interfaceSourceKeySurfaceIndexFallbackEnabled, false);
  assert.equal(bindGroups[0].entries.length, 7);
  assert.equal(bindGroups[0].entries[5].resource.buffer, sourceIndexFieldBuffer);
  assert.equal(bindGroups[0].entries[6].resource.buffer, compactField.interfaceSourceKeyBuffer);
  assert.equal(interfaceField.interfaceSourceKeyStatus, 'interface-source-key-retained');
  assert.equal(interfaceField.interfaceSourceKeyReadyCount, activeCandidateCount);
  assert.equal(interfaceField.elements[0].sourceParticleIndex, 0);
  assert.equal(interfaceField.elements[1].sourceParticleIndex, 1);
  assert.equal(interfaceField.interfaceSourceKeyBuffer, compactField.interfaceSourceKeyBuffer);

  const cleanup = interfaceField.destroyMaterialInterfaceFieldBuffers({ reason: 'test-cleanup' });
  assert.equal(cleanup.status, 'material-interface-candidate-field-buffers-destroyed');
  assert.equal(compactField.interfaceSourceKeyBuffer.destroyed, true);
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

test('SPH compact material-interface overflow destroys its sidecar before dense fallback', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const field = twoSurfaceRenderField();
  const denseCandidateField = deriveSphMaterialInterfaceCandidateField(field);
  const sourceKeyRows = new Float32Array([0, 0, 1, 0]);
  const { device, createdBuffers } = fakeSurfaceDrawDevice({
    drawRows: denseCandidateField.candidateRows,
    candidateMetadataRows: new Uint32Array([
      2,
      1,
      1,
      denseCandidateField.candidateCount
    ]),
    sourceKeyRows
  });
  const sourceField = await buildSphMaterialInterfaceSourceFieldWebGpu({
    device,
    renderRows: extracted.renderRows,
    surfaceTable: field.surfaceTable,
    particleCount: packed.particleCount,
    readbackMode: 'no-full-readback'
  });

  const interfaceField = await buildSphPhysicsMaterialInterfaceFieldWebGpu({
    device,
    renderField: sourceField,
    candidateReadbackMode: 'compact-active-readback',
    compactCandidateCapacity: 1
  });
  const compactSidecar = createdBuffers.find(
    (buffer) => buffer.label === 'ulg-sph-interface-source-keys'
  );

  assert.equal(interfaceField.candidateCompactFallbackStatus, 'fallback-dense-readback-after-compact-overflow');
  assert.ok(compactSidecar);
  assert.equal(compactSidecar.destroyed, true);
  sourceField.releaseMaterialInterfaceSourceFieldLeases();
  sourceField.destroyMaterialInterfaceSourceFieldBuffers();
});

test('SPH compact material-interface overflow forwards sidecar cleanup when dense fallback is blocked', async () => {
  const baseField = twoSurfaceRenderField();
  const totalFieldCells = Math.ceil(
    (SPH_MATERIAL_INTERFACE_CANDIDATE_READBACK_BYTE_BUDGET_DEFAULT + 1)
      / (3 * SPH_MATERIAL_INTERFACE_CANDIDATE_FLOATS * Float32Array.BYTES_PER_ELEMENT)
  );
  const renderField = {
    ...baseField,
    totalFieldCells,
    maxFieldCellCount: 1,
    backend: 'webgpu'
  };
  const { device, createdBuffers } = fakeSurfaceDrawDevice({
    candidateMetadataRows: new Uint32Array([2, 1, 1, totalFieldCells * 3]),
    sourceKeyRows: new Float32Array([0, 0, 1, 0])
  });
  const sourceField = {
    schema: 'peercompute.ulg.sph-material-interface-source-field.v0',
    status: 'material-interface-source-field-ready',
    backend: 'webgpu',
    sourceRenderField: renderField,
    fieldRowsBuffer: device.createBuffer({
      label: 'borrowed-source-field-rows',
      size: totalFieldCells
        * SPH_GPU_RENDER_FIELD_CELL_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      usage: 0
    }),
    surfaceBuffer: device.createBuffer({
      label: 'borrowed-source-surfaces',
      size: renderField.surfaceTable.surfaceCount
        * SPH_GPU_RENDER_SURFACE_ROW_FLOATS
        * Float32Array.BYTES_PER_ELEMENT,
      usage: 0
    }),
    sourceIndexFieldBuffer: device.createBuffer({
      label: 'borrowed-source-index-field',
      size: totalFieldCells * Uint32Array.BYTES_PER_ELEMENT,
      usage: 0
    })
  };

  const interfaceField = await buildSphPhysicsMaterialInterfaceFieldWebGpu({
    device,
    renderField: sourceField,
    candidateReadbackMode: 'compact-active-readback',
    compactCandidateCapacity: 1
  });
  const compactSidecar = createdBuffers.find(
    (buffer) => buffer.label === 'ulg-sph-interface-source-keys'
  );

  assert.equal(interfaceField.status, 'material-interface-field-candidate-readback-skipped');
  assert.equal(interfaceField.candidateCompactStatus, 'material-interface-compact-candidate-field-overflow');
  assert.equal(interfaceField.interfaceSourceKeyBuffer, compactSidecar);
  assert.equal(typeof interfaceField.destroyMaterialInterfaceFieldBuffers, 'function');
  assert.equal(compactSidecar.destroyed, false);
  const cleanup = interfaceField.destroyMaterialInterfaceFieldBuffers({ reason: 'test-overflow-cleanup' });
  assert.equal(cleanup.status, 'material-interface-candidate-field-buffers-destroyed');
  assert.equal(compactSidecar.destroyed, true);
});

test('SPH physics material interface can publish GPU-resident summary without candidate readback', async () => {
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
    sourceCadence: 'resident-step-completed',
    candidateReadbackMode: 'gpu-resident-summary'
  });

  assert.equal(interfaceField.schema, 'peercompute.ulg.sph-material-interface-field.v0');
  assert.equal(interfaceField.status, 'material-interface-field-gpu-resident-summary-pending');
  assert.equal(interfaceField.backend, 'webgpu-gpu-resident-summary');
  assert.equal(interfaceField.sourceFieldSchema, 'peercompute.ulg.sph-material-interface-source-field.v0');
  assert.equal(interfaceField.sourceFieldRowsBufferBound, true);
  assert.equal(interfaceField.sourceSurfaceBufferBound, true);
  assert.equal(interfaceField.candidateReadback, false);
  assert.equal(interfaceField.candidateReadbackMode, 'gpu-resident-summary');
  assert.equal(interfaceField.candidateMetadataReadback, false);
  assert.equal(interfaceField.activeCandidateCountPending, true);
  assert.equal(interfaceField.pressureInterfaceProducer, false);
  assert.equal(interfaceField.forceCouplingStatus, 'blocked-gpu-resident-pressure-interface-consumer-required');
  assert.equal(interfaceField.elementCount, 0);
  assert.equal(interfaceField.queueCompletionStatus, 'not-submitted-gpu-resident-summary');
  assert.equal(bindGroups.length, 1);
  assert.deepEqual(dispatches.map((dispatch) => dispatch.count), [
    Math.ceil(Math.max(1, field.surfaceTable.maxFieldCellCount) / 64)
  ]);
  assert.equal(copies.length, 0);
  sourceField.destroyMaterialInterfaceSourceFieldBuffers();
  sourceField.releaseMaterialInterfaceSourceFieldLeases();
  sourceField.destroyMaterialInterfaceSourceFieldBuffers();
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

  const physicalRadiusModeTable = buildSphRenderFieldSurfaceTable([{
    ...table.metadata[0],
    particleRadiusScale: 1
  }]);
  const physicalRadiusModeEventField = buildSphRenderFieldCpu({
    renderRows: extracted.renderRows,
    productEventRows,
    productEventCount: 1,
    surfaceTable: physicalRadiusModeTable,
    fieldPadding: 0.22,
    refEdgeM: 10
  });
  assert.deepEqual(
    physicalRadiusModeEventField.fieldRows,
    field.fieldRows,
    'event-only fields retain surface-wide product strength in particle-radius mode'
  );

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

test('SPH render field optional execution never substitutes legacy CPU geometry for resident dispersed optics', async () => {
  const notRequested = await buildSphRenderFieldWithOptionalWebGpu({
    preferWebGpu: false,
    dispersedMediumOptics: {}
  });
  assert.equal(notRequested.backend, 'blocked');
  assert.equal(
    notRequested.status,
    'render-field-resident-dispersed-medium-required'
  );
  assert.equal(notRequested.result, null);
  assert.equal(notRequested.cpuReference, null);
  assert.equal(notRequested.residentDispersedMediumFailClosed, true);

  const unavailable = await buildSphRenderFieldWithOptionalWebGpu({
    preferWebGpu: true,
    deviceResult: { status: 'webgpu-unavailable', reason: 'test unavailable' },
    dispersedMediumOpticsBuffer: {}
  });
  assert.equal(unavailable.backend, 'blocked');
  assert.equal(unavailable.result, null);
  assert.equal(
    unavailable.webgpuStatus.status,
    'blocked-resident-dispersed-medium-webgpu-unavailable'
  );
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
        ...buildSphRenderFieldCpu({
          ...args,
          productEventBuffer: null,
          productEventCount: 0
        }),
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
        ...buildSphRenderFieldCpu({
          ...args,
          productEventBuffer: null,
          productEventCount: 0
        }),
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

test('SPH render field setup rolls back every owned buffer on allocation and encoder failures', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'rollback-field',
    material: 'Au',
    phase: 'solid',
    resolution: 4
  }]);
  for (const failure of ['mid-allocation', 'create-bind-group']) {
    const rig = fakeSurfaceDrawDevice({ drawRows: new Float32Array() });
    const createBuffer = rig.device.createBuffer.bind(rig.device);
    if (failure === 'mid-allocation') {
      rig.device.createBuffer = (descriptor) => {
        if (descriptor.label === 'ulg-sph-render-field-surfaces') {
          throw new Error('injected render-field mid-allocation failure');
        }
        return createBuffer(descriptor);
      };
    } else {
      rig.device.createBindGroup = () => {
        throw new Error('injected render-field bind-group failure');
      };
    }

    await assert.rejects(
      () => buildSphRenderFieldWebGpu({
        device: rig.device,
        renderRows: extracted.renderRows,
        surfaceTable,
        particleCount: packed.particleCount,
        readbackMode: 'no-full-readback',
        waitForQueueCompletion: false
      }),
      /injected render-field/
    );
    assert.ok(rig.createdBuffers.length > 0);
    assert.equal(
      rig.createdBuffers.every((buffer) => buffer.destroyed),
      true,
      `${failure} must retire every unpublished render-field allocation`
    );
  }
});

test('SPH render field rejects surface-table mutation while a GPU submission is in flight', async () => {
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'in-flight-route',
    material: 'Au',
    phase: 'solid',
    opticalStateId: 45001,
    resolution: 4,
    isolation: 1
  }]);
  const { device, createdBuffers } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array()
  });
  let resolveFirstFence;
  let fenceCount = 0;
  device.queue.onSubmittedWorkDone = () => {
    fenceCount += 1;
    if (fenceCount === 1) {
      return new Promise((resolve) => {
        resolveFirstFence = resolve;
      });
    }
    return Promise.resolve();
  };

  const pending = buildSphRenderFieldWebGpu({
    device,
    renderRows: extracted.renderRows,
    surfaceTable,
    particleCount: packed.particleCount,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: true,
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true
  });
  assert.equal(typeof resolveFirstFence, 'function');
  surfaceTable.records[13] = 45002;
  resolveFirstFence();
  await assert.rejects(
    pending,
    /surface table mutated while its GPU field submission was in flight/
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    createdBuffers.find((buffer) => buffer.label === 'ulg-sph-render-field-surfaces')?.destroyed,
    true
  );
  assert.equal(
    createdBuffers.find((buffer) => buffer.label === 'ulg-sph-render-field-cells')?.destroyed,
    true
  );
});

test('SPH render field consumes the exact particle-lineage dispersed sidecar without taking ownership', async () => {
  const packed = packedRenderParticles();
  const {
    device,
    bindGroups,
    createdBuffers,
    queueWrites,
    commandEncoderCreations
  } =
    fakeSurfaceDrawDevice({
      drawRows: new Float32Array(
        packed.particleCount * SPH_GPU_RENDER_ROW_FLOATS
      )
    });
  const packedOptics = buildSphDispersedMediumGpuBuffers([
    {
      dispersedMediumOptics: {
        dispersedMaterialId: stableOpticalMaterialId('naoh'),
        dispersedPhaseId: GPU_PHASE_IDS.liquid,
        opticalStateId: 31001,
        dispersedMassKg: 0.125,
        scatteringCrossSectionM2: 0.25,
        absorptionCrossSectionM2: 0.125,
        scatteringAsymmetryCrossSectionM2: 0.125
      }
    },
    {},
    {}
  ]);
  packed.identity = Uint32Array.from([1, 2, 2]);
  packed.topologyEpoch = 0;
  packed.identityRevision = 'render-sidecar-lineage-v1';
  packed.dispersedMediumOptics = packedOptics;
  const sphParticleUpload = uploadSphGpuParticleBuffers(device, packed);
  const optics = sphParticleUpload.dispersedMediumOptics;
  for (const sourceOverride of [
    {
      sourceStateBuffer: device.createBuffer({
        label: 'foreign-lineage-state',
        size: packed.state.byteLength,
        usage: 0
      })
    },
    {
      sourceThermoBuffer: device.createBuffer({
        label: 'foreign-lineage-thermo',
        size: packed.thermo.byteLength,
        usage: 0
      })
    },
    {
      sourceIdentityBuffer: device.createBuffer({
        label: 'foreign-lineage-identity',
        size: packed.identity.byteLength,
        usage: 0
      })
    }
  ]) {
    await assert.rejects(
      () => extractSphRenderRowsWebGpu({
        device,
        sphParticleState: packed,
        sphParticleUpload,
        ...sourceOverride,
        readbackMode: 'no-full-readback',
        retainRenderRowsBuffer: true
      }),
      /(?:foreign.*sidecar|foreign particle-aligned source buffers)/
    );
  }
  const hostCaptured = await extractSphRenderRowsWebGpu({
    device,
    sphParticleState: packed,
    sphParticleUpload
  });
  hostCaptured.renderRows[0] = 123;
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: hostCaptured.renderRows,
      renderRowsSource: hostCaptured,
      dispersedMediumOptics: hostCaptured.dispersedMediumOptics,
      surfaceTable: buildSphRenderFieldSurfaceTable([{
        surfaceKey: 'collective-naoh-aerosol-host-readback',
        material: 'h2',
        phase: 'gas',
        renderKey: 'smoke',
        opticalStateId: 31001,
        resolution: 4,
        isolation: 1,
        subtract: 1,
        radiusNorm: 0.2,
        colorLinear: [0.7, 0.7, 0.7]
      }]),
      particleCount: hostCaptured.particleCount,
      waitForQueueCompletion: false
    }),
    /module-authenticated render-row lineage/
  );
  const captured = await extractSphRenderRowsWebGpu({
    device,
    sphParticleState: packed,
    sphParticleUpload,
    readbackMode: 'no-full-readback',
    retainRenderRowsBuffer: true
  });
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'collective-naoh-aerosol',
    material: 'h2',
    phase: 'gas',
    renderKey: 'smoke',
    opticalStateId: 31001,
    resolution: 4,
    isolation: 1,
    subtract: 1,
    radiusNorm: 0.2,
    colorLinear: [0.7, 0.7, 0.7]
  }]);

  const sidecarBufferByteLength = optics.buffer.size;
  const createdBufferCountBeforeSidecarPreflight = createdBuffers.length;
  const encoderCountBeforeSidecarPreflight = commandEncoderCreations.length;
  optics.buffer.size = sidecarBufferByteLength - Uint32Array.BYTES_PER_ELEMENT;
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: captured.renderRows,
      renderRowsBuffer: captured.renderRowsBuffer,
      renderRowsSource: captured,
      dispersedMediumOptics: captured.dispersedMediumOptics,
      surfaceTable,
      particleCount: captured.particleCount,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false
    }),
    /torn or foreign dispersed-medium optics authority/
  );
  assert.equal(createdBuffers.length, createdBufferCountBeforeSidecarPreflight);
  assert.equal(commandEncoderCreations.length, encoderCountBeforeSidecarPreflight);
  optics.buffer.size = sidecarBufferByteLength;

  device.limits = {
    maxBufferSize: 2 ** 40,
    maxStorageBufferBindingSize:
      sidecarBufferByteLength - Uint32Array.BYTES_PER_ELEMENT,
    maxComputeWorkgroupsPerDimension: 65_535
  };
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: captured.renderRows,
      renderRowsBuffer: captured.renderRowsBuffer,
      renderRowsSource: captured,
      dispersedMediumOptics: captured.dispersedMediumOptics,
      surfaceTable,
      particleCount: captured.particleCount,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false
    }),
    /exceeds WebGPU device maxStorageBufferBindingSize/
  );
  assert.equal(createdBuffers.length, createdBufferCountBeforeSidecarPreflight);
  assert.equal(commandEncoderCreations.length, encoderCountBeforeSidecarPreflight);
  device.limits = undefined;

  const omittedDirectChild = await buildSphRenderFieldWithOptionalWebGpu({
    device,
    preferWebGpu: true,
    renderRows: captured.renderRows,
    renderRowsBuffer: captured.renderRowsBuffer,
    renderRowsSource: captured,
    surfaceTable,
    particleCount: captured.particleCount,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false
  });
  assert.equal(omittedDirectChild.backend, 'blocked');
  assert.equal(
    omittedDirectChild.status,
    'render-field-resident-dispersed-medium-required'
  );
  assert.equal(omittedDirectChild.result, null);
  assert.equal(omittedDirectChild.cpuReference, null);
  assert.equal(
    omittedDirectChild.webgpuStatus.status,
    'blocked-resident-dispersed-medium-webgpu-error'
  );

  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: captured.renderRows,
      renderRowsBuffer: captured.renderRowsBuffer,
      renderRowsSource: captured,
      dispersedMediumOpticsBuffer: captured.dispersedMediumOptics.buffer,
      dispersedMediumOpticsAuthority: captured.dispersedMediumOptics.authority,
      surfaceTable,
      particleCount: captured.particleCount,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false
    }),
    /requires the exact branded child descriptor/
  );

  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: captured.renderRows,
      renderRowsBuffer: captured.renderRowsBuffer,
      renderRowsSource: captured,
      dispersedMediumOptics: {
        ...captured.dispersedMediumOptics,
        authority: { ...captured.dispersedMediumOptics.authority }
      },
      surfaceTable,
      particleCount: captured.particleCount,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false
    }),
    /torn or foreign dispersed-medium optics authority/
  );

  const field = await buildSphRenderFieldWebGpu({
    device,
    renderRows: captured.renderRows,
    renderRowsBuffer: captured.renderRowsBuffer,
    renderRowsSource: captured,
    dispersedMediumOptics: captured.dispersedMediumOptics,
    surfaceTable,
    particleCount: captured.particleCount,
    readbackMode: 'no-full-readback',
    retainFieldRowsBuffer: true,
    retainSurfaceBuffer: true,
    waitForQueueCompletion: false,
    deferCleanup: false,
    useQueueFenceForCleanup: false
  });

  const renderFieldBindGroup = bindGroups.find((bindGroup) => (
    bindGroup.entries.some((entry) => (
      entry.binding === 7 && entry.resource.buffer === optics.buffer
    ))
  ));
  assert.ok(renderFieldBindGroup);
  assert.equal(
    renderFieldBindGroup.entries.find((entry) => entry.binding === 7).resource.size,
    sidecarBufferByteLength
  );
  const paramsBuffer = createdBuffers.find((buffer) => (
    buffer.label === 'ulg-sph-render-field-params'
  ));
  const paramsWrite = queueWrites.find((write) => write.buffer === paramsBuffer);
  assert.equal(new Uint32Array(paramsWrite.snapshot)[7], 1);
  assert.equal(field.dispersedMediumOpticsBound, true);
  assert.equal(field.dispersedMediumOpticsRowCount, packed.particleCount);
  assert.equal(field.dispersedMediumOpticsAuthority, 'same-device-resident-authority');

  field.releaseRenderFieldBufferLeases();
  field.destroyRenderFieldBuffers({ releaseLeases: true });
  assert.equal(optics.buffer.destroyed, false);
  captured.destroyRenderRowsBuffer();
  assert.equal(optics.buffer.destroyed, false);
  assert.equal(destroySphGpuParticleBuffers(sphParticleUpload), true);
  assert.equal(optics.buffer.destroyed, true);
});

test('SPH render field GPU-authenticates the full resident product-history commit prefix without a readback', async () => {
  const {
    device,
    copies,
    createdBuffers,
    shaderModules,
    bindGroups,
    queueWrites,
    commandEncoderCreations
  } = fakeSurfaceDrawDevice({});
  const packed = packedRenderParticles();
  const extracted = extractSphRenderRowsCpu({ sphParticleState: packed });
  const surfaceTable = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'h2|h2|gas',
    material: 'h2',
    phase: 'gas',
    renderKey: 'h2',
    resolution: 8,
    isolation: 20,
    subtract: 5,
    radiusNorm: 0.2,
    colorLinear: [0.6, 0.8, 1]
  }]);
  const rowCapacity = 4;
  const productEventBuffer = tagWebGpuBufferDevice(device.createBuffer({
    label: 'test-resident-product-event-buffer',
    size: rowCapacity
      * SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS
      * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  }), device);
  const countControlBuffer = device.createBuffer({
    label: 'test-resident-product-count-control',
    size: 512,
    usage: 0
  });
  const productEventSource = { productEventBuffer };
  const authority = registerResidentProductEventCountAuthority(productEventSource, {
    device,
    controlBuffer: countControlBuffer,
    controlOffsetBytes: 256,
    rowCapacity,
    rowStrideFloats: SPH_GPU_REACTION_PRODUCT_EVENT_FLOATS,
    generation: 7,
    seal: 11
  });
  const preissuedDescriptor = productEventLiveCountCopyDescriptor(
    productEventSource,
    device
  );
  assert.ok(preissuedDescriptor);
  assert.equal(
    retireResidentProductEventCountAuthority(productEventSource),
    true
  );
  assert.equal(
    resolveResidentProductEventCountAuthority(productEventSource, device),
    null
  );
  assert.equal(
    productEventLiveCountCopyDescriptor(productEventSource, device),
    null
  );
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: productEventSource,
      device
    }),
    true
  );

  const createdBufferCountBeforeControlPreflight = createdBuffers.length;
  const encoderCountBeforeControlPreflight = commandEncoderCreations.length;
  const countControlBufferByteLength = countControlBuffer.size;
  countControlBuffer.size = authority.controlOffsetBytes
    + SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
    - Uint32Array.BYTES_PER_ELEMENT;
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: extracted.renderRows,
      productEventBuffer,
      productEventSource,
      productEventLiveCountDescriptor: preissuedDescriptor,
      surfaceTable,
      particleCount: packed.particleCount,
      productEventCount: rowCapacity,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false
    }),
    /render field product-history control capacity .* smaller than required binding range/
  );
  assert.equal(createdBuffers.length, createdBufferCountBeforeControlPreflight);
  assert.equal(commandEncoderCreations.length, encoderCountBeforeControlPreflight);
  countControlBuffer.size = countControlBufferByteLength;

  device.limits = {
    maxBufferSize: 2 ** 40,
    maxStorageBufferBindingSize:
      SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
        - Uint32Array.BYTES_PER_ELEMENT,
    maxComputeWorkgroupsPerDimension: 65_535
  };
  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: extracted.renderRows,
      productEventBuffer,
      productEventSource,
      productEventLiveCountDescriptor: preissuedDescriptor,
      surfaceTable,
      particleCount: packed.particleCount,
      productEventCount: rowCapacity,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false
    }),
    /exceeds WebGPU device maxStorageBufferBindingSize/
  );
  assert.equal(createdBuffers.length, createdBufferCountBeforeControlPreflight);
  assert.equal(commandEncoderCreations.length, encoderCountBeforeControlPreflight);
  device.limits = undefined;

  const result = await buildSphRenderFieldWebGpu({
    device,
    renderRows: extracted.renderRows,
    productEventBuffer,
    productEventSource,
    productEventLiveCountDescriptor: preissuedDescriptor,
    surfaceTable,
    particleCount: packed.particleCount,
    productEventCount: rowCapacity,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false,
    deferCleanup: false
  });

  assert.equal(copies.length, 0, 'the live count must never be copied out of its control record');
  const renderBindGroup = bindGroups.find((bindGroup) => (
    bindGroup.entries.some((entry) => (
      entry.binding === 5
      && entry.resource.buffer === countControlBuffer
    ))
  ));
  assert.ok(renderBindGroup, 'the exact resident history control slice must be shader-bound');
  const controlEntry = renderBindGroup.entries.find((entry) => entry.binding === 5);
  assert.equal(controlEntry.resource.offset, 256);
  assert.equal(
    controlEntry.resource.size,
    SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES
  );
  const gateEntry = renderBindGroup.entries.find((entry) => entry.binding === 6);
  const gateWrite = queueWrites.find((write) => write.buffer === gateEntry.resource.buffer);
  assert.deepEqual(Array.from(new Uint32Array(gateWrite.snapshot)), [
    1,
    authority.expectedMagic,
    authority.expectedVersion,
    authority.expectedReadyStatus,
    authority.expectedGeneration,
    authority.expectedSeal,
    authority.expectedRowCapacity,
    authority.expectedRowStrideVec4
  ]);
  const renderShader = shaderModules.find((module) => module.label === 'ulg-sph-render-field');
  assert.ok(renderShader);
  for (let word = 0; word < 8; word += 1) {
    assert.match(
      renderShader.code,
      new RegExp(`product_history_control\\[${word}u\\]`),
      `control prefix word ${word} must be authenticated or consumed in WGSL`
    );
  }
  assert.match(renderShader.code, /product_history_control\[3u\] <= product_history_control\[4u\]/);
  assert.match(renderShader.code, /product_history_control\[2u\] == product_history_gate\.expected_ready_status/);
  assert.match(renderShader.code, /render_field_cells\[out_index \* 2u\] = vec4<f32>\(0\.0\)/);
  assert.ok(
    renderShader.code.indexOf('if (!render_product_history_ready())')
      < renderShader.code.indexOf('for (var particle_index'),
    'the gate must run before either resident source is consumed'
  );
  assert.equal(result.productEventCountAuthority, 'gpu-authored-filtered-live-prefix');
  assert.equal(result.productEventControlAuthentication, 'full-eight-word-gpu-commit-gate');
  assert.equal(result.productEventControlHostObserved, false);
  assert.equal(result.productEventCountHostKnown, false);
  assert.equal(result.productEventRowCapacity, rowCapacity);
  assert.equal(result.productEventBufferBound, true);
  assert.ok(
    !createdBuffers.some((buffer) => /readback/.test(buffer.label)),
    'the direct GPU commit-gate path must not allocate a CPU readback buffer'
  );
  assert.equal(
    revokeResidentProductEventCountAuthority(productEventSource),
    true
  );
  assert.equal(
    validateProductEventLiveCountCopyDescriptor(preissuedDescriptor, {
      handle: productEventSource,
      device
    }),
    false
  );

  await assert.rejects(
    () => buildSphRenderFieldWebGpu({
      device,
      renderRows: extracted.renderRows,
      productEventBuffer,
      productEventSource: {
        ...productEventSource,
        productEventLiveCountAuthority:
          productEventSource.productEventLiveCountAuthority
      },
      surfaceTable,
      particleCount: packed.particleCount,
      productEventCount: rowCapacity,
      readbackMode: 'no-full-readback',
      waitForQueueCompletion: false,
      deferCleanup: false
    }),
    /torn product-event live-count authority/
  );
});

test('SPH render field WebGPU can write into a borrowed reusable field buffer', async () => {
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
  const { device, bindGroups, createdBuffers, queueWrites } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(),
    compactedVertexRows: new Float32Array()
  });
  const targetFieldRowsBuffer = device.createBuffer({
    label: 'test-pooled-render-field-cells',
    size: surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });

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
    useQueueFenceForCleanup: false,
    targetFieldRowsBuffer,
    targetFieldRowsBufferByteLength: targetFieldRowsBuffer.size
  });

  assert.equal(result.fieldRowsBuffer, targetFieldRowsBuffer);
  assert.equal(result.fieldRowsBufferBorrowed, true);
  assert.equal(result.fieldRowsBufferReused, true);
  assert.equal(result.fieldRowsBufferOwnedByResult, false);
  assert.equal(bindGroups.at(-1).entries[2].resource.buffer, targetFieldRowsBuffer);
  assert.equal(result.productEventControlAuthentication, 'not-required-zero-control');
  const disabledControl = createdBuffers.find((buffer) => (
    buffer.label === 'ulg-sph-render-field-product-history-control-disabled'
  ));
  assert.equal(disabledControl.size, SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_PREFIX_BYTES);
  const gateParams = createdBuffers.find((buffer) => (
    buffer.label === 'ulg-sph-render-field-product-history-gate-params'
  ));
  const gateWrite = queueWrites.find((write) => write.buffer === gateParams);
  assert.deepEqual(
    Array.from(new Uint32Array(gateWrite.snapshot)),
    Array(8).fill(0),
    'legacy host/nonresident execution must bind an all-zero disabled gate'
  );

  result.releaseRenderFieldBufferLeases();
  result.destroyRenderFieldBuffers({ releaseLeases: true });

  assert.equal(targetFieldRowsBuffer.destroyed, false);
  assert.equal(result.surfaceBuffer.destroyed, true);
});

test('SPH material-interface source field WebGPU can write into a borrowed reusable field buffer', async () => {
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
  const { device, bindGroups } = fakeSurfaceDrawDevice({
    drawRows: new Float32Array(),
    compactedVertexRows: new Float32Array()
  });
  const targetFieldRowsBuffer = device.createBuffer({
    label: 'test-pooled-material-interface-source-field-cells',
    size: surfaceTable.totalFieldCells * SPH_GPU_RENDER_FIELD_CELL_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    usage: 0
  });

  const sourceField = await buildSphMaterialInterfaceSourceFieldWebGpu({
    device,
    renderRows: extracted.renderRows,
    surfaceTable,
    particleCount: packed.particleCount,
    readbackMode: 'no-full-readback',
    waitForQueueCompletion: false,
    deferCleanup: true,
    useQueueFenceForCleanup: false,
    targetFieldRowsBuffer,
    targetFieldRowsBufferByteLength: targetFieldRowsBuffer.size
  });

  assert.equal(sourceField.status, 'material-interface-source-field-ready');
  assert.equal(sourceField.fieldRowsBuffer, targetFieldRowsBuffer);
  assert.equal(sourceField.fieldRowsBufferBorrowed, true);
  assert.equal(sourceField.fieldRowsBufferReused, true);
  assert.equal(sourceField.fieldRowsBufferOwnedByResult, false);
  assert.equal(sourceField.queueCompletionStatus, 'queue-submitted-gpu-handoff-no-cpu-fence');
  assert.equal(bindGroups.at(-1).entries[2].resource.buffer, targetFieldRowsBuffer);

  sourceField.releaseMaterialInterfaceSourceFieldLeases();
  sourceField.destroyMaterialInterfaceSourceFieldBuffers({ releaseLeases: true });

  assert.equal(targetFieldRowsBuffer.destroyed, false);
  assert.equal(sourceField.surfaceBuffer.destroyed, true);
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
  Object.assign(field.surfaceTable.metadata[0], {
    particleRadiusScale: 1.47,
    particleRadiusPolicyStatus: 'h2o-liquid-continuity-floor-applied',
    particleRadiusPolicyMode: 'retained-particle-radius-with-h2o-liquid-continuity-floor',
    particleRadiusContinuityFloorEligible: true,
    particleRadiusContinuityFloorApplied: true,
    particleRadiusScaleRequested: 1,
    particleRadiusContinuityFloorScale: 1.47,
    particleRadiusContinuityFloorScaleUnbounded: 1.49,
    particleRadiusContinuityRepresentativeRadiusM: 0.1,
    particleRadiusContinuitySmoothingLengthM: 0.248,
    particleRadiusContinuitySupportMultiplier: 2.0817,
    particleRadiusContinuitySupportTargetIsoradiusM: 0.1191,
    particleRadiusContinuitySamplingCellSizeM: 0.0558,
    particleRadiusContinuitySamplingMarginM: 0.0279,
    particleRadiusContinuityTargetIsoradiusM: 0.147
  });
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
  assert.equal(summary.surfaces[0].particleRadiusScale, 1.47);
  assert.equal(
    summary.surfaces[0].particleRadiusPolicyStatus,
    'h2o-liquid-continuity-floor-applied'
  );
  assert.equal(summary.surfaces[0].particleRadiusContinuityFloorEligible, true);
  assert.equal(summary.surfaces[0].particleRadiusContinuityFloorApplied, true);
  assert.equal(summary.surfaces[0].particleRadiusContinuityFloorScale, 1.47);
  assert.equal(summary.surfaces[0].particleRadiusContinuityFloorScaleUnbounded, 1.49);
  assert.equal(summary.surfaces[0].particleRadiusContinuityRepresentativeRadiusM, 0.1);
  assert.equal(summary.surfaces[0].particleRadiusContinuitySmoothingLengthM, 0.248);
  assert.equal(summary.surfaces[0].particleRadiusContinuitySupportMultiplier, 2.0817);
  assert.equal(summary.surfaces[0].particleRadiusContinuitySupportTargetIsoradiusM, 0.1191);
  assert.equal(summary.surfaces[0].particleRadiusContinuitySamplingCellSizeM, 0.0558);
  assert.equal(summary.surfaces[0].particleRadiusContinuitySamplingMarginM, 0.0279);
  assert.equal(summary.surfaces[0].particleRadiusContinuityTargetIsoradiusM, 0.147);
});

test('SPH render field surface summary WebGPU reads compact summary from retained field buffers', async () => {
  const field = twoSurfaceRenderField();
  const cpuSummary = summarizeSphRenderFieldSurfacesCpu(field);
  const retainedFieldRowsBuffer = {
    label: 'retained-render-field-rows',
    size: field.totalFieldCells
      * SPH_GPU_RENDER_FIELD_CELL_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  };
  const retainedSurfaceBuffer = {
    label: 'retained-render-surface-table',
    size: field.surfaceTable.surfaceCount
      * SPH_GPU_RENDER_SURFACE_ROW_FLOATS
      * Float32Array.BYTES_PER_ELEMENT
  };
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
  assert.equal(bindGroups[0].entries.length, 8);
  assert.equal(bindGroups[0].entries[2].resource.buffer.label, 'ulg-sph-surface-draw-compacted-vertices');
  assert.equal(bindGroups[0].entries[3].resource.buffer.label, 'ulg-sph-surface-draw-metadata');
  assert.equal(bindGroups[0].entries[5].resource.buffer.label, 'ulg-sph-surface-draw-indirect');
  assert.equal(bindGroups[0].entries[6].resource.buffer.label, 'ulg-sph-surface-draw-source-vertex-counter');
  assert.equal(bindGroups[0].entries[7].resource.buffer.label, 'ulg-sph-surface-draw-aggregate-indirect');
  assert.equal(
    (result.compactedVertexRowsBuffer.usage & GPU_BUFFER_USAGE_VERTEX),
    GPU_BUFFER_USAGE_VERTEX
  );
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
  assert.ok(result.drawAggregateIndirectRowsBufferRetained);
  assert.equal(result.drawAggregateIndirectRowsBufferByteLength, SPH_GPU_RENDER_SURFACE_DRAW_INDIRECT_UINTS * Uint32Array.BYTES_PER_ELEMENT);
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
  const vertexCounterBuffer = {
    label: 'retained-surface-vertex-counter',
    size: 16
  };
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
  assert.equal(result.surfaceDrawGpuOnlyAggregateIndirectReady, true);
  assert.equal(result.surfaceDrawGpuOnlyAggregateDrawRangeExact, true);
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
  assert.ok(result.drawAggregateIndirectRowsBufferRetained);
  assert.ok(result.drawAggregateIndirectRowsBuffer);
  assert.ok(result.compactedVertexRowsBufferRetained);
  assert.match(shaderModules[0].code, /sd_source_vertex_row_count|source_vertex_counter/);
  assert.equal(bindGroups[0].entries.length, 8);
  assert.equal(bindGroups[0].entries[6].resource.buffer, vertexCounterBuffer);
  assert.equal(bindGroups[0].entries[7].resource.buffer.label, 'ulg-sph-surface-draw-aggregate-indirect');
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

test('splash-shard dispersion correction thins bridge cells between diverging droplets only', () => {
  const table = buildSphRenderFieldSurfaceTable([{
    surfaceKey: 'Au|Au|solid',
    material: 'Au',
    phase: 'solid',
    renderKey: 'Au',
    resolution: 8,
    isolation: 20,
    subtract: 5,
    radiusNorm: 0.2,
    colorLinear: [1, 0.7, 0.1]
  }]);
  const materialId = stableOpticalMaterialId('Au');
  // Two particles 1 m apart straddling the field midpoint; velocity in the
  // row pads (lanes 17-19).
  const makeRows = (velocityA, velocityB) => {
    const rows = new Float32Array(2 * SPH_GPU_RENDER_ROW_FLOATS);
    const fill = (base, x, velocity) => {
      rows[base] = x; rows[base + 1] = 5; rows[base + 2] = 5;
      rows[base + 3] = 4; // massKg
      rows[base + 4] = materialId;
      rows[base + 5] = GPU_PHASE_IDS.solid;
      rows[base + 6] = 293.15;
      rows[base + 8] = 19300;
      rows[base + 10] = 1; // representedEntityCount
      rows[base + 16] = 1; // phaseFractionSolid
      rows[base + 17] = velocity[0];
      rows[base + 18] = velocity[1];
      rows[base + 19] = velocity[2];
    };
    fill(0, 4.5, velocityA);
    fill(SPH_GPU_RENDER_ROW_FLOATS, 5.5, velocityB);
    return rows;
  };
  const build = (rows, renderSmearDtS) => buildSphRenderFieldCpu({
    renderRows: rows,
    surfaceTable: table,
    fieldPadding: 0.22,
    refEdgeM: 10,
    renderSmearDtS
  });

  const divergingRows = makeRows([-10, 0, 0], [10, 0, 0]);
  const baseline = build(divergingRows, 0);
  const corrected = build(divergingRows, 0.05);
  // Bridge cell at the field midpoint (x=y=z=4 of 8): normalized 0.5.
  const bridgeIndex = (4 * 8 * 8 + 4 * 8 + 4) * baseline.rowStrideFloats;
  assert.ok(baseline.fieldRows[bridgeIndex] > 0, 'bridge cell must be occupied in the baseline');
  // Diverging droplets (sigma_v = 10 m/s, dt 0.05 s -> 0.5 m smear vs 1 m
  // separation) must lose most of their bridging density.
  assert.ok(
    corrected.fieldRows[bridgeIndex] < baseline.fieldRows[bridgeIndex] * 0.6,
    `bridge density should thin: ${corrected.fieldRows[bridgeIndex]} vs ${baseline.fieldRows[bridgeIndex]}`
  );

  // A coherently moving pair (same velocity vector, same speed) has zero
  // dispersion: the field must be bit-identical to the uncorrected build.
  const coherentRows = makeRows([10, 0, 0], [10, 0, 0]);
  const coherentBaseline = build(coherentRows, 0);
  const coherentCorrected = build(coherentRows, 0.05);
  assert.deepEqual(Array.from(coherentCorrected.fieldRows), Array.from(coherentBaseline.fieldRows));

  // A single particle (dispersion undefined -> zero) is also bit-exact.
  const soloRows = makeRows([-10, 0, 0], [10, 0, 0]).slice(0, SPH_GPU_RENDER_ROW_FLOATS);
  const soloBaseline = build(soloRows, 0);
  const soloCorrected = build(soloRows, 0.05);
  assert.deepEqual(Array.from(soloCorrected.fieldRows), Array.from(soloBaseline.fieldRows));
});
