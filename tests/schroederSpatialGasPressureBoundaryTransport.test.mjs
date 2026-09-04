import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_ABI,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_BINDINGS,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS,
  SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION,
  ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
  computeSchroederSpatialGasPressureBoundaryFineToCoarseParentAdjointCpuOracle,
  computeSchroederSpatialGasPressureBoundaryTransportCpuOracle,
  createSchroederSpatialGasPressureBoundaryTransportLayout,
  createSchroederSpatialGasPressureBoundaryTransportParams,
  createSchroederSpatialGasPressureBoundaryTransportScratch,
  createSchroederSpatialGasPressureBoundaryTransportScratchHeader
} from '../ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransport.js';
import {
  schroederSpatialGasPressureBoundaryTransportWgsl
} from '../ulg-gpu-abi/src/schroederSpatialGasPressureBoundaryTransportWgsl.js';
import * as publicAbi from '../ulg-gpu-abi/src/index.js';

function params(overrides = {}) {
  return createSchroederSpatialGasPressureBoundaryTransportParams({
    fieldCapacity: 129,
    maxComputeWorkgroupsPerDimension: 2,
    generationId: 17,
    fieldCompletionOrdinal: 23,
    fieldMutationOrdinal: 29,
    storageGeneration: 31,
    physicsTick: 37,
    physicsSubstep: 41,
    positionEpoch: 43,
    topologyEpoch: 47,
    chartEpoch: 53,
    levelEpoch: 59,
    supportEpoch: 61,
    selectedLevel: -1,
    gridNodeCount: 8,
    gridDimensions: [2, 2, 2],
    gridCellOrigin: [-2, 3, 5],
    chartId: 67,
    dt: 0.125,
    ambientPressurePa: 101325,
    pressureScale: 0.75,
    gridSpacingM: 0.01,
    gasAuthorityExecutionGeneration: 71,
    gasAuthorityStorageGeneration: 73,
    gasPressureCellCapacity: 16,
    gasPressureCellStrideFloats: 12,
    gasDirectoryGeneration: 79,
    gasDirectoryWordLength: 183,
    gasDirectoryCellCapacity: 16,
    gasDirectoryCellKeysOffsetWords: 48,
    gasDirectoryCellOffsetsOffsetWords: 128,
    gasDirectoryCellMembersOffsetWords: 145,
    gasDirectoryParticleToCellOffsetWords: 161,
    ...overrides
  });
}

test('v4 gas boundary ABI reserves the exact owner and parent bindings', () => {
  assert.equal(
    ULG_SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCHEMA,
    'peercompute.ulg.schroeder-spatial-gas-pressure-boundary-transport.v2'
  );
  assert.equal(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_PARAMS_BYTES,
    256
  );
  assert.deepEqual(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_BINDINGS,
    {
      mechanicsField: 0,
      phaseVolumeReceiptControl: 1,
      phaseVolumeMomentRows: 2,
      gasPressureRowsPrivate: 3,
      gasDirectoryPrivate: 4,
      scratch: 5,
      gasAuthorityControlPrivate: 6,
      params: 7,
      parentFieldView: 8,
      storageBindingCount: 8
    }
  );
  const layout = createSchroederSpatialGasPressureBoundaryTransportLayout({
    fieldCapacity: 129,
    maxComputeWorkgroupsPerDimension: 2
  });
  assert.equal(
    layout.scratchWords,
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_HEADER_WORDS
      + 129
        * SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS
  );
  assert.deepEqual(layout.dispatchWorkgroups, [2, 2, 1]);
  assert.equal(layout.dispatchInvocationCapacity, 256);
  assert.match(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_ABI.dispatchAuthority,
    /field-capacity/
  );
  assert.match(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_ABI.residency,
    /no-all-cell-scan/
  );
  assert.deepEqual(
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_ABI.crossLevelMapping,
    {
      sameLevel:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_SAME_LEVEL,
      fineToCoarseParentAdjoint:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT
    }
  );
});

test('v4 gas boundary scratch identity is sealed and reusable without row upload', () => {
  const options = {
    fieldCapacity: 3,
    generationId: 17,
    fieldCompletionOrdinal: 23,
    gasAuthorityExecutionGeneration: 71
  };
  const header =
    createSchroederSpatialGasPressureBoundaryTransportScratchHeader(options);
  assert.deepEqual([...header.slice(0, 11)], [
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC,
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION,
    0,
    3,
    17,
    23,
    71,
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS,
    0,
    0,
    0
  ]);
  assert.equal(
    header[11],
    (
      SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_MAGIC
      ^ SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_VERSION
      ^ 3
      ^ 17
      ^ 23
      ^ 71
      ^ SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_TRANSPORT_SCRATCH_ROW_WORDS
    ) >>> 0
  );
  const scratch =
    createSchroederSpatialGasPressureBoundaryTransportScratch(options);
  assert.equal(scratch.length, 12 + 3 * 12);
  assert.deepEqual([...scratch.slice(0, 12)], [...header]);
  assert.ok(scratch.slice(12).every((word) => word === 0));
});

test('v4 gas boundary params encode exact field, gas, directory, and dispatch identity', () => {
  const bytes = params();
  assert.equal(bytes.byteLength, 256);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 1);
  assert.equal(view.getUint32(4, true), 0);
  assert.equal(view.getUint32(8, true), 129);
  assert.equal(view.getUint32(12, true), 17);
  assert.equal(view.getInt32(14 * 4, true), -1);
  assert.deepEqual(
    [19, 20, 21].map((word) => view.getInt32(word * 4, true)),
    [-2, 3, 5]
  );
  assert.equal(view.getFloat32(23 * 4, true), 0.125);
  assert.equal(view.getFloat32(24 * 4, true), 101325);
  assert.equal(view.getFloat32(25 * 4, true), 0.75);
  assert.equal(view.getUint32(27 * 4, true), 71);
  assert.equal(view.getUint32(28 * 4, true), 73);
  assert.equal(view.getUint32(29 * 4, true), 16);
  assert.equal(view.getUint32(30 * 4, true), 12);
  assert.equal(view.getUint32(31 * 4, true), 79);
  assert.deepEqual(
    [38, 39, 40].map((word) => view.getUint32(word * 4, true)),
    [2, 2, 1]
  );
  assert.equal(view.getUint32(41 * 4, true), 0);
  assert.equal(view.getInt32(42 * 4, true), -1);
  assert.equal(view.getUint32(43 * 4, true), 8);
  assert.deepEqual(
    [44, 45, 46].map((word) => view.getUint32(word * 4, true)),
    [2, 2, 2]
  );
  assert.deepEqual(
    [47, 48, 49].map((word) => view.getInt32(word * 4, true)),
    [-2, 3, 5]
  );
  assert.equal(view.getFloat32(50 * 4, true), Math.fround(0.01));
  assert.ok(
    [51, 52, 53, 54].every(
      (word) => view.getUint32(word * 4, true) === 0
    )
  );
  assert.throws(
    () => params({ gasPressureCellStrideFloats: 8 }),
    /gasPressureCellStrideFloats/
  );
  assert.throws(
    () => params({ missingCellPolicy: 2 }),
    /missingCellPolicy/
  );
  assert.throws(
    () => params({ gridNodeCount: 7 }),
    /gridDimensions product/
  );
  assert.throws(
    () => params({ gasDirectoryWordLength: 182 }),
    /exact v1 layout/
  );
  assert.throws(
    () => params({ parentGenerationId: 17 }),
    /omit parent identity/
  );
});

test('v2 params encode and reject malformed exact fine-to-coarse parent identity', () => {
  const bytes = params({
    fieldCapacity: 2,
    crossLevelMappingMode: 'fine-to-coarse-parent-adjoint',
    gridCellOrigin: [-1, -1, -1],
    gasSelectedLevel: 0,
    gasGridNodeCount: 1,
    gasGridDimensions: [1, 1, 1],
    gasGridCellOrigin: [-1, -1, -1],
    gasGridSpacingM: 0.02,
    parentGenerationId: 17,
    parentCompletionOrdinal: 83,
    parentFieldCapacity: 19,
    parentFieldWordCapacity: 196
  });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(
    view.getUint32(41 * 4, true),
    SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT
  );
  assert.equal(view.getInt32(42 * 4, true), 0);
  assert.equal(view.getUint32(43 * 4, true), 1);
  assert.deepEqual(
    [44, 45, 46].map((word) => view.getUint32(word * 4, true)),
    [1, 1, 1]
  );
  assert.deepEqual(
    [47, 48, 49].map((word) => view.getInt32(word * 4, true)),
    [-1, -1, -1]
  );
  assert.equal(view.getFloat32(50 * 4, true), Math.fround(0.02));
  assert.deepEqual(
    [51, 52, 53, 54].map((word) => view.getUint32(word * 4, true)),
    [17, 83, 19, 196]
  );
  assert.throws(
    () => params({
      crossLevelMappingMode: 'fine-to-coarse-parent-adjoint'
    }),
    /gasSelectedLevel is required/
  );
  assert.throws(
    () => params({
      fieldCapacity: 2,
      crossLevelMappingMode:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_CROSS_LEVEL_MAPPING_FINE_TO_COARSE_PARENT_ADJOINT,
      gridCellOrigin: [-1, -1, -1],
      gasSelectedLevel: 0,
      gasGridNodeCount: 1,
      gasGridDimensions: [1, 1, 1],
      gasGridCellOrigin: [-1, -1, -1],
      gasGridSpacingM: 0.03,
      parentGenerationId: 17,
      parentCompletionOrdinal: 83,
      parentFieldCapacity: 19,
      parentFieldWordCapacity: 196
    }),
    /exact 2:1 f32 ratio/
  );
  assert.throws(
    () => params({
      fieldCapacity: 2,
      crossLevelMappingMode: 'fine-to-coarse-parent-adjoint',
      gridCellOrigin: [-1, -1, -1],
      gasSelectedLevel: 0,
      gasGridNodeCount: 1,
      gasGridDimensions: [1, 1, 1],
      gasGridCellOrigin: [-1, -1, -1],
      gasGridSpacingM: 0.02,
      parentGenerationId: 17,
      parentCompletionOrdinal: 83,
      parentFieldCapacity: 19,
      parentFieldWordCapacity: 195
    }),
    /exact parent-field view layout/
  );
});

test('CPU oracle applies one node impulse and distributes it by exact V0J volume', () => {
  const result =
    computeSchroederSpatialGasPressureBoundaryTransportCpuOracle({
      gridDimensions: [1, 1, 1],
      fields: [
        {
          denseGridNodeId: 0,
          mechanicalFamilyId: 1,
          currentVolumeM3: 1,
          volumeGradientM2: [2, 0, 0],
          massKg: 2,
          velocityMPerS: [0, 0, 0]
        },
        {
          denseGridNodeId: 0,
          mechanicalFamilyId: 2,
          currentVolumeM3: 2,
          volumeGradientM2: [1, 0, 0],
          massKg: 4,
          velocityMPerS: [0, 0, 0]
        },
        {
          denseGridNodeId: 0,
          mechanicalFamilyId: 3,
          currentVolumeM3: 20,
          volumeGradientM2: [100, 0, 0],
          massKg: 5,
          velocityMPerS: [7, 0, 0]
        }
      ],
      gasCells: [{ cell: [0, 0, 0], absolutePressurePa: 200 }],
      dt: 0.1,
      ambientPressurePa: 100
    });
  assert.equal(result.admitted, true);
  assert.equal(result.appliedNodeCount, 1);
  assert.equal(result.missingCellCount, 0);
  assert.equal(result.rows[0].gaugePressurePa, 100);
  assert.deepEqual(result.rows[0].impulseNs, [10, 0, 0]);
  assert.deepEqual(result.rows[1].impulseNs, [20, 0, 0]);
  assert.deepEqual(result.rows[0].velocityMPerS, [5, 0, 0]);
  assert.deepEqual(result.rows[1].velocityMPerS, [5, 0, 0]);
  assert.deepEqual(result.rows[2].impulseNs, [0, 0, 0]);
  assert.deepEqual(result.rows[2].velocityMPerS, [7, 0, 0]);
  assert.ok(result.maximumDistributionResidualNs <= 2e-6);
});

test('CPU oracle preserves signed gauge and makes missing-cell policy explicit', () => {
  const input = {
    gridDimensions: [1, 1, 1],
    fields: [{
      denseGridNodeId: 0,
      mechanicalFamilyId: 2,
      currentVolumeM3: 1,
      volumeGradientM2: [1, 0, 0],
      massKg: 2,
      velocityMPerS: [0, 0, 0]
    }],
    dt: 0.5,
    ambientPressurePa: 100
  };
  const signed =
    computeSchroederSpatialGasPressureBoundaryTransportCpuOracle({
      ...input,
      gasCells: [{ cell: [0, 0, 0], pressurePa: 60 }]
    });
  assert.equal(signed.rows[0].gaugePressurePa, -40);
  assert.deepEqual(signed.rows[0].impulseNs, [-20, 0, 0]);
  assert.deepEqual(signed.rows[0].velocityMPerS, [-10, 0, 0]);

  const noLoad =
    computeSchroederSpatialGasPressureBoundaryTransportCpuOracle({
      ...input,
      gasCells: [],
      missingCellPolicy:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_NO_LOAD
    });
  assert.equal(noLoad.admitted, true);
  assert.equal(noLoad.missingCellCount, 1);
  assert.deepEqual(noLoad.rows[0].velocityMPerS, [0, 0, 0]);

  const failClosed =
    computeSchroederSpatialGasPressureBoundaryTransportCpuOracle({
      ...input,
      gasCells: [],
      missingCellPolicy:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED
    });
  assert.equal(failClosed.admitted, false);
  assert.match(failClosed.status, /fail-closed-missing-cell/);
});

test('fine parent-adjoint oracle gathers each field CSR before its own S9 force', () => {
  const input = {
    gasGridDimensions: [2, 1, 1],
    fields: [
      {
        denseGridNodeId: 0,
        mechanicalFamilyId: 1,
        materialId: 7,
        continuityDomainId: 11,
        currentVolumeM3: 1,
        volumeGradientM2: [2, 0, 0],
        massKg: 2,
        velocityMPerS: [0, 0, 0]
      },
      {
        denseGridNodeId: 0,
        mechanicalFamilyId: 2,
        materialId: 9,
        continuityDomainId: 0,
        currentVolumeM3: 2,
        volumeGradientM2: [1, 0, 0],
        massKg: 4,
        velocityMPerS: [0, 0, 0]
      }
    ],
    parentFieldKeys: [
      [0, 1, 7, 11],
      [0, 2, 9, 0],
      [1, 1, 7, 11],
      [1, 2, 9, 0]
    ],
    fineEdgeOffsets: [0, 2, 4],
    fineEdgeParentIndices: [0, 2, 1, 3],
    fineEdgeWeights: [0.25, 0.75, 0.5, 0.5],
    gasCells: [
      { cell: [0, 0, 0], absolutePressurePa: 100 },
      { cell: [1, 0, 0], absolutePressurePa: 300 }
    ],
    dt: 0.1,
    ambientPressurePa: 100
  };
  const result =
    computeSchroederSpatialGasPressureBoundaryFineToCoarseParentAdjointCpuOracle(
      input
    );
  assert.equal(result.admitted, true);
  assert.equal(result.appliedFieldCount, 2);
  assert.equal(result.missingCellCount, 0);
  assert.equal(result.rows[0].effectiveGaugePressurePa, 150);
  assert.equal(result.rows[1].effectiveGaugePressurePa, 100);
  assert.deepEqual(result.rows[0].impulseNs, [30, 0, 0]);
  assert.deepEqual(result.rows[1].impulseNs, [10, 0, 0]);
  assert.deepEqual(result.rows[0].velocityMPerS, [15, 0, 0]);
  assert.deepEqual(result.rows[1].velocityMPerS, [2.5, 0, 0]);

  const partialNoLoad =
    computeSchroederSpatialGasPressureBoundaryFineToCoarseParentAdjointCpuOracle({
      ...input,
      gasCells: [{ cell: [0, 0, 0], absolutePressurePa: 200 }]
    });
  assert.equal(partialNoLoad.admitted, true);
  assert.equal(partialNoLoad.missingCellCount, 2);
  assert.equal(partialNoLoad.rows[0].effectiveGaugePressurePa, 25);
  assert.equal(partialNoLoad.rows[1].effectiveGaugePressurePa, 50);
  assert.deepEqual(partialNoLoad.rows[0].impulseNs, [5, 0, 0]);
  assert.deepEqual(partialNoLoad.rows[1].impulseNs, [5, 0, 0]);

  const failClosed =
    computeSchroederSpatialGasPressureBoundaryFineToCoarseParentAdjointCpuOracle({
      ...input,
      gasCells: [{ cell: [0, 0, 0], absolutePressurePa: 200 }],
      missingCellPolicy:
        SCHROEDER_SPATIAL_GAS_PRESSURE_BOUNDARY_MISSING_CELL_FAIL_CLOSED
    });
  assert.equal(failClosed.admitted, false);
  assert.match(failClosed.status, /fine-adjoint-fail-closed-missing-cell/);

  assert.throws(
    () => computeSchroederSpatialGasPressureBoundaryFineToCoarseParentAdjointCpuOracle({
      ...input,
      fineEdgeWeights: [0.25, 0.5, 0.5, 0.5]
    }),
    /do not partition unity/
  );
});

test('WGSL is an eight-storage transactional exact parent-adjoint operator', () => {
  const source = schroederSpatialGasPressureBoundaryTransportWgsl;
  for (const [binding, name] of [
    [0, 'field_view'],
    [1, 'receipt_control'],
    [2, 'moment_rows'],
    [3, 'gas_pressure_rows'],
    [4, 'gas_directory'],
    [5, 'scratch'],
    [6, 'gas_authority_control'],
    [8, 'parent_field_view']
  ]) {
    assert.match(
      source,
      new RegExp(`@binding\\(${binding}\\).*${name}`)
    );
  }
  assert.match(source, /@binding\(7\) var<uniform> params/);
  for (const entry of [
    'prevalidate_field_boundary_transport',
    'prevalidate_source_boundary_transport',
    'initialize_boundary_transport',
    'stage_boundary_transport',
    'validate_boundary_transport',
    'commit_boundary_transport'
  ]) assert.match(source, new RegExp(`fn ${entry}\\(`));
  assert.match(source, /fn find_gas_cell\([\s\S]*while|fn find_gas_cell\([\s\S]*loop/);
  assert.match(
    source,
    /pressure_sample\.x - params\.ambient_pressure_pa/
  );
  assert.match(
    source,
    /total_impulse_ns \* share/
  );
  assert.match(
    source,
    /fn parent_field_view_admitted\(\)[\s\S]*PARENT_FIELD_READY_ADMITTED[\s\S]*fine_edge_offset_offset[\s\S]*parent_field_view\[78u\] != 0u/
  );
  assert.match(
    source,
    /fn stage_fine_parent_field\([\s\S]*declared_count > PARENT_FIELD_MAX_FINE_EDGES[\s\S]*abs\(weight_sum - 1\.0\) > PARENT_FIELD_WEIGHT_TOLERANCE/
  );
  assert.match(
    source,
    /effective_gauge_pa = effective_gauge_pa \+ weight \* parent_gauge_pa/
  );
  assert.match(
    source,
    /let impulse_ns = params\.pressure_scale[\s\S]*effective_gauge_pa \* field_gradient\(field_index\) \* params\.dt/
  );
  assert.doesNotMatch(
    source.match(/fn stage_fine_parent_field\([\s\S]*?\n\}/)?.[0] ?? '',
    /share/
  );
  assert.match(
    source,
    /phase == PHASE_SOLID \|\| phase == PHASE_LIQUID/
  );
  assert.match(
    source,
    /store-only pass with no late rejection path/
  );
  assert.match(
    source,
    /fn field_identity_b_admitted\(\)[\s\S]*field_load\(59u\) != FIELD_STATE_EMPTY/
  );
  assert.doesNotMatch(source, /FIELD_STATE_MASS_VELOCITY_GRADIENT/);
  assert.match(
    source,
    /fn local_pressure_claim_pending\(\)[\s\S]*claimed & FIELD_PRESSURE_CONSUMER_LOCAL[\s\S]*consumed & FIELD_PRESSURE_CONSUMER_LOCAL/
  );
  for (const admission of [
    'field_params_admitted',
    'field_shape_admitted',
    'field_identity_a_admitted',
    'field_identity_b_admitted',
    'field_receipt_admitted',
    'local_pressure_claim_pending'
  ]) {
    assert.match(
      source,
      new RegExp(
        `fn prevalidate_field_boundary_transport\\([\\s\\S]*${admission}\\(\\)`
      )
    );
  }
  assert.match(
    source,
    /fn prevalidate_field_boundary_transport\([\s\S]*SCRATCH_FIELD_ADMISSION_SEAL/
  );
  assert.match(
    source,
    /fn prevalidate_source_boundary_transport\([\s\S]*phase_volume_receipt_admitted\(\)[\s\S]*gas_authority_reject_reason\(\)[\s\S]*gas_directory_admitted\(\)[\s\S]*parent_field_view_admitted\(\)[\s\S]*SCRATCH_SOURCE_ADMISSION_SEAL/
  );
  assert.match(
    source,
    /fn reject_gas_authority_scratch\([\s\S]*0x300u \+ reason/
  );
  assert.match(
    source,
    /fn initialize_boundary_transport\([\s\S]*scratch_prevalidation_admitted\(\)/
  );
  assert.match(source, /atomicAdd\(&scratch\[8u\], 1u\)/);
  assert.match(source, /scratch_load\(8u\) != field_load\(34u\)/);
});

test('WGSL source has no host-count, readback, or all-gas-cell scan escape', () => {
  const source = schroederSpatialGasPressureBoundaryTransportWgsl;
  assert.doesNotMatch(source, /mapAsync|copyBufferToBuffer|onSubmittedWorkDone/i);
  assert.doesNotMatch(source, /\blet\s+external\b/);
  assert.doesNotMatch(source, /gas_pressure_cell_count/);
  assert.doesNotMatch(
    source,
    /for\s*\([^)]*cell_index[^)]*gas_authority_control\[10u\]/
  );
  assert.match(
    source,
    /let first = capacity_linear_invocation/
  );
  assert.match(
    source,
    /var high = gas_authority_control\[10u\][\s\S]*middle = low \+ \(high - low\) \/ 2u/
  );
  assert.match(
    source,
    /gas_directory\[27u\] == DIRECTORY_SORT_LEXICOGRAPHIC/
  );
  assert.match(
    source,
    /gas_authority_control\[31u\] != cell_count/
  );
});

test('public ABI index exports the boundary transport without rematerializing it', () => {
  assert.equal(
    publicAbi.computeSchroederSpatialGasPressureBoundaryTransportCpuOracle,
    computeSchroederSpatialGasPressureBoundaryTransportCpuOracle
  );
  assert.equal(
    publicAbi.schroederSpatialGasPressureBoundaryTransportWgsl,
    schroederSpatialGasPressureBoundaryTransportWgsl
  );
});
