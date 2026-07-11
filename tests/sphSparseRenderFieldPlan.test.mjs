import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_PLAN_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA,
  ULG_SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SPH_SPARSE_RENDER_FIELD_ACTIVE_DIRECT,
  SPH_SPARSE_RENDER_FIELD_ACTIVE_HALO,
  SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_X,
  SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Y,
  SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Z,
  SPH_SPARSE_RENDER_FIELD_ADMISSION_FAIL_CLOSED,
  SPH_SPARSE_RENDER_FIELD_ADMISSION_RETAIN_PREVIOUS,
  SPH_SPARSE_RENDER_FIELD_DEFAULT_BRICK_SIZE,
  SPH_SPARSE_RENDER_FIELD_FAIL_CLOSED_ACTION_SUPPRESS_RETAIN_PREVIOUS,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_BRICKS,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_VOXELS,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_ATLAS_CELLS,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_DIRECTORY,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_ROUTES,
  SPH_SPARSE_RENDER_FIELD_OVERFLOW_TOTAL_BYTES,
  createSphSparseRenderFieldCapacityDescriptor,
  createSphSparseRenderFieldHomeBrickKey,
  createSphSparseRenderFieldPlan,
  createSphSparseRenderFieldSurfacePlan,
  expandSphSparseRenderFieldActiveBrickHalo
} from '../src/runtime/sph/sphSparseRenderFieldPlan.js';

const structuralLayouts = [
  SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_ENTRY_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_ROW_LAYOUT,
  SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_ROW_LAYOUT
];

test('sparse render-field ABI exports versioned schemas and u32-only structural rows', () => {
  const schemas = [
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_SCHEMA,
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_PLAN_SCHEMA,
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_TABLE_SCHEMA,
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_SCHEMA,
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_SCHEMA,
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_SCHEMA,
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_SCHEMA,
    ULG_SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_SCHEMA
  ];

  assert.ok(schemas.every((schema) => schema.startsWith('peercompute.ulg.')));
  assert.ok(schemas.every((schema) => schema.endsWith('.v0')));
  for (const layout of structuralLayouts) {
    assert.ok(Object.isFrozen(layout));
    assert.ok(layout.length > 0);
    assert.ok(layout.every((field) => field.endsWith(':u32')));
  }
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_ROW_LAYOUT.length, 12);
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT.length, 16);
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_ROW_LAYOUT.length, 20);
  assert.equal(SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_ROW_LAYOUT.length, 8);
});

test('surface planning preserves exact non-multiple resolution and directory math', () => {
  const cubic = createSphSparseRenderFieldSurfacePlan({
    surfaceIndex: 4,
    resolution: 17,
    generationId: 41
  });
  assert.equal(cubic.brickSize, SPH_SPARSE_RENDER_FIELD_DEFAULT_BRICK_SIZE);
  assert.equal(cubic.brickVolume, 8 ** 3);
  assert.deepEqual(cubic.brickCounts, [3, 3, 3]);
  assert.equal(cubic.directoryCount, 27);
  assert.equal(cubic.directoryByteLength, 27 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(cubic.logicalSampleCount, 17 ** 3);
  assert.equal(cubic.paddedSampleCount, 27 * 8 ** 3);
  assert.equal(cubic.paddingSampleCount, 27 * 8 ** 3 - 17 ** 3);
  assert.equal(cubic.dualVoxelCount, 16 ** 3);
  assert.deepEqual(cubic.tailBrickSampleExtent, [1, 1, 1]);

  const rectangular = createSphSparseRenderFieldSurfacePlan({
    surfaceIndex: 9,
    dimensions: [17, 10, 8],
    directoryOffset: cubic.directoryEnd,
    generationId: 41
  });
  assert.deepEqual(rectangular.brickCounts, [3, 2, 1]);
  assert.equal(rectangular.directoryOffset, 27);
  assert.equal(rectangular.directoryCount, 6);
  assert.equal(rectangular.directoryEnd, 33);
  assert.equal(rectangular.logicalSampleCount, 17 * 10 * 8);
  assert.equal(rectangular.paddedSampleCount, 6 * 8 ** 3);
  assert.equal(rectangular.dualVoxelCount, 16 * 9 * 7);
  assert.deepEqual(rectangular.tailBrickSampleExtent, [1, 2, 8]);

  const configurable = createSphSparseRenderFieldSurfacePlan({
    dimensions: [10, 9, 8],
    brickSize: 4
  });
  assert.equal(configurable.brickVolume, 4 ** 3);
  assert.deepEqual(configurable.brickCounts, [3, 3, 2]);
  assert.deepEqual(configurable.tailBrickSampleExtent, [2, 1, 4]);
});

test('multi-surface plans use one dense brick directory with exact offsets', () => {
  const plan = createSphSparseRenderFieldPlan({
    generationId: 41,
    surfaces: [
      { surfaceIndex: 4, resolution: 17 },
      { surfaceIndex: 9, dimensions: [17, 10, 8] }
    ]
  });

  assert.equal(plan.schema, ULG_SPH_GPU_SPARSE_RENDER_FIELD_PLAN_SCHEMA);
  assert.equal(plan.directory.schema, ULG_SPH_GPU_SPARSE_RENDER_FIELD_DIRECTORY_SCHEMA);
  assert.equal(plan.directory.granularity, 'dense-at-brick-granularity-sparse-at-sample-granularity');
  assert.equal(plan.directory.entryCount, 33);
  assert.equal(plan.directory.byteLength, 33 * Uint32Array.BYTES_PER_ELEMENT);
  assert.equal(plan.surfaceTable.rows.length, 2 * SPH_GPU_SPARSE_RENDER_FIELD_SURFACE_ROW_LAYOUT.length);
  assert.equal(plan.surfaceTable.surfaces[1].directoryOffset, 27);
  assert.equal(plan.surfaceTable.rows[13], 41);
  assert.equal(plan.surfaceTable.rows[16 + 8], 27);
  assert.equal(plan.surfaceTable.rows[16 + 13], 41);
});

test('route keys map normalized and exact sample coordinates to home bricks', () => {
  const surfacePlan = createSphSparseRenderFieldSurfacePlan({
    surfaceIndex: 9,
    dimensions: [17, 10, 8],
    directoryOffset: 27,
    generationId: 41
  });
  const normalized = createSphSparseRenderFieldHomeBrickKey({
    surfacePlan,
    routeIndex: 2,
    sourceIndex: 77,
    normalizedPosition: [0.999, 1, -0.25],
    supportRadiusCells: 3
  });
  assert.equal(normalized.schema, ULG_SPH_GPU_SPARSE_RENDER_FIELD_ROUTE_SCHEMA);
  assert.deepEqual(normalized.sampleCoordinates, [16, 9, 0]);
  assert.deepEqual(normalized.homeBrick, [2, 1, 0]);
  assert.equal(normalized.homeBrickLinearIndex, 5);
  assert.equal(normalized.homeDirectoryIndex, 32);
  assert.deepEqual([...normalized.sortKeyWords], [32, 77, 0, 41]);
  assert.deepEqual([...normalized.row], [2, 77, 0, 9, 2, 1, 0, 5, 32, 3, 41, 1]);

  const exact = createSphSparseRenderFieldHomeBrickKey({
    surfacePlan,
    routeIndex: 3,
    sourceIndex: 78,
    sampleCoordinates: [8, 0, 7]
  });
  assert.deepEqual(exact.homeBrick, [1, 0, 0]);
  assert.equal(exact.homeDirectoryIndex, 28);

  assert.throws(() => createSphSparseRenderFieldHomeBrickKey({
    surfacePlan,
    sourceIndex: 0,
    sampleCoordinates: [17, 0, 0]
  }), /outside resolution/);
});

test('active sample bricks expand to the marching-cubes predecessor halo', () => {
  const surfacePlan = createSphSparseRenderFieldSurfacePlan({
    surfaceIndex: 3,
    resolution: 17,
    generationId: 77
  });
  const halo = expandSphSparseRenderFieldActiveBrickHalo({
    surfacePlans: [surfacePlan],
    directActiveBricks: [{ surfaceIndex: 3, brick: [1, 1, 1] }]
  });

  assert.equal(halo.schema, ULG_SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_SCHEMA);
  assert.equal(halo.directActiveBrickCount, 1);
  assert.equal(halo.activeBrickCount, 8);
  assert.equal(halo.haloOnlyBrickCount, 7);
  assert.equal(halo.atlasCellCount, 8 * 8 ** 3);
  assert.equal(halo.activeVoxelCandidateCount, 8 * 8 ** 3);
  assert.deepEqual(
    halo.bricks.map((entry) => entry.directoryIndex),
    [0, 1, 3, 4, 9, 10, 12, 13]
  );
  const allAxes = halo.bricks.find((entry) => entry.brick.join(',') === '0,0,0');
  assert.equal(
    allAxes.activationFlags,
    SPH_SPARSE_RENDER_FIELD_ACTIVE_HALO
      | SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_X
      | SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Y
      | SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_Z
  );
  const direct = halo.bricks.find((entry) => entry.brick.join(',') === '1,1,1');
  assert.equal(direct.activationFlags, SPH_SPARSE_RENDER_FIELD_ACTIVE_DIRECT);
  assert.ok(halo.bricks.every((entry) => entry.generationId === 77));
  assert.equal(halo.rows.length, 8 * SPH_GPU_SPARSE_RENDER_FIELD_ACTIVE_BRICK_ROW_LAYOUT.length);

  const boundary = expandSphSparseRenderFieldActiveBrickHalo({
    surfacePlans: [surfacePlan],
    directActiveBricks: [{ surfaceIndex: 3, brick: [0, 0, 0] }]
  });
  assert.equal(boundary.activeBrickCount, 1);
  assert.equal(boundary.haloOnlyBrickCount, 0);

  const partialTail = expandSphSparseRenderFieldActiveBrickHalo({
    surfacePlans: [surfacePlan],
    directActiveBricks: [{ surfaceIndex: 3, brick: [2, 2, 2] }],
    predecessorHaloBricks: 0
  });
  assert.deepEqual(partialTail.bricks[0].sampleExtent, [1, 1, 1]);
  assert.deepEqual(partialTail.bricks[0].voxelExtent, [0, 0, 0]);
  assert.equal(partialTail.bricks[0].voxelCandidateCount, 0);
});

test('overlapping direct and halo activations are deduplicated with provenance flags', () => {
  const surfacePlan = createSphSparseRenderFieldSurfacePlan({
    surfaceIndex: 3,
    resolution: 17
  });
  const halo = expandSphSparseRenderFieldActiveBrickHalo({
    surfacePlans: [surfacePlan],
    directActiveBricks: [
      { surfaceIndex: 3, brick: [1, 1, 1] },
      { surfaceIndex: 3, brick: [0, 1, 1] },
      { surfaceIndex: 3, brick: [0, 1, 1] }
    ]
  });
  assert.equal(halo.directActiveBrickCount, 2);
  assert.equal(halo.activeBrickCount, 8);
  assert.equal(halo.haloOnlyBrickCount, 6);
  const overlap = halo.bricks.find((entry) => entry.brick.join(',') === '0,1,1');
  assert.equal(
    overlap.activationFlags,
    SPH_SPARSE_RENDER_FIELD_ACTIVE_DIRECT
      | SPH_SPARSE_RENDER_FIELD_ACTIVE_HALO
      | SPH_SPARSE_RENDER_FIELD_ACTIVE_PREDECESSOR_X
  );
});

test('capacity and admission descriptors publish generations or fail closed', () => {
  const admitted = createSphSparseRenderFieldPlan({
    generationId: 99,
    surfaces: [{ surfaceIndex: 3, resolution: 17 }],
    directActiveBricks: [{ surfaceIndex: 3, brick: [1, 1, 1] }],
    requiredRouteCount: 12
  });
  assert.equal(admitted.capacity.schema, ULG_SPH_GPU_SPARSE_RENDER_FIELD_CAPACITY_SCHEMA);
  assert.equal(admitted.admission.schema, ULG_SPH_GPU_SPARSE_RENDER_FIELD_ADMISSION_SCHEMA);
  assert.equal(admitted.capacity.required.directoryEntryCount, 27);
  assert.equal(admitted.capacity.required.routeCount, 12);
  assert.equal(admitted.capacity.required.activeBrickCount, 8);
  assert.equal(admitted.capacity.required.atlasCellCount, 4096);
  assert.equal(admitted.capacity.required.activeVoxelCount, 4096);
  assert.equal(admitted.capacity.requiredByteLength, 148828);
  assert.equal(admitted.capacity.admitted, true);
  assert.equal(admitted.generationPublicationAllowed, true);
  assert.equal(admitted.surfaceTable.rows[13], 99);
  assert.equal(admitted.capacity.row[0], 99);
  assert.equal(admitted.admission.row[0], 99);
  assert.ok(admitted.activeBricks.bricks.every((entry) => entry.generationId === 99));

  const blocked = createSphSparseRenderFieldPlan({
    generationId: 100,
    surfaces: [{ surfaceIndex: 3, resolution: 17 }],
    directActiveBricks: [{ surfaceIndex: 3, brick: [1, 1, 1] }],
    requiredRouteCount: 12,
    capacity: {
      directoryEntryCount: 0,
      routeCount: 0,
      activeBrickCount: 0,
      atlasCellCount: 0,
      activeVoxelCount: 0
    },
    maxTotalByteLength: 0
  });
  const everyOverflow = SPH_SPARSE_RENDER_FIELD_OVERFLOW_DIRECTORY
    | SPH_SPARSE_RENDER_FIELD_OVERFLOW_ROUTES
    | SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_BRICKS
    | SPH_SPARSE_RENDER_FIELD_OVERFLOW_ATLAS_CELLS
    | SPH_SPARSE_RENDER_FIELD_OVERFLOW_ACTIVE_VOXELS
    | SPH_SPARSE_RENDER_FIELD_OVERFLOW_TOTAL_BYTES;
  assert.equal(blocked.capacity.overflowFlags, everyOverflow);
  assert.equal(blocked.capacity.admitted, false);
  assert.equal(blocked.generationPublicationAllowed, false);
  assert.equal(blocked.failClosed, true);
  assert.equal(blocked.admission.retainPreviousAcceptedGeneration, true);
  assert.equal(
    blocked.admission.failClosedActionId,
    SPH_SPARSE_RENDER_FIELD_FAIL_CLOSED_ACTION_SUPPRESS_RETAIN_PREVIOUS
  );
  assert.ok(blocked.admission.admissionFlags & SPH_SPARSE_RENDER_FIELD_ADMISSION_FAIL_CLOSED);
  assert.ok(blocked.admission.admissionFlags & SPH_SPARSE_RENDER_FIELD_ADMISSION_RETAIN_PREVIOUS);
  assert.equal(blocked.admission.row[3], 0);
  assert.equal(blocked.admission.row[4], 1);
  assert.equal(blocked.admission.row[5], 1);
});

test('capacity byte budgets cover provisioned allocation and retain u64 evidence', () => {
  const exact = createSphSparseRenderFieldCapacityDescriptor({
    required: { routeCount: 1 },
    capacity: { routeCount: 1 }
  });
  const oversizedProvision = createSphSparseRenderFieldCapacityDescriptor({
    required: { routeCount: 1 },
    capacity: { routeCount: 2 },
    maxTotalByteLength: exact.requiredByteLength
  });
  assert.ok(oversizedProvision.requiredByteLength <= exact.requiredByteLength);
  assert.ok(oversizedProvision.capacityByteLength > exact.requiredByteLength);
  assert.ok(oversizedProvision.overflowFlags & SPH_SPARSE_RENDER_FIELD_OVERFLOW_TOTAL_BYTES);
  assert.equal(oversizedProvision.admitted, false);

  const large = createSphSparseRenderFieldCapacityDescriptor({
    required: { atlasCellCount: 0xffffffff },
    capacity: { atlasCellCount: 0xffffffff },
    atlasCellStrideBytes: 32
  });
  const low = large.row[12];
  const high = large.row[13];
  assert.ok(high > 0);
  assert.equal(low + high * 0x100000000, large.requiredByteLength);
});

test('planning rejects invalid topology and remains material- and scene-agnostic', () => {
  assert.throws(() => createSphSparseRenderFieldPlan({
    surfaces: [
      { surfaceIndex: 1, resolution: 8 },
      { surfaceIndex: 1, resolution: 8 }
    ]
  }), /duplicate sparse render-field surface index/);
  assert.throws(() => createSphSparseRenderFieldSurfacePlan({ dimensions: [8, 0, 8] }), /dimensions\[1\]/);
  assert.throws(() => createSphSparseRenderFieldPlan({
    surfaces: [{ surfaceIndex: 1, resolution: 8 }],
    directActiveBricks: [{ surfaceIndex: 1, brick: [1, 0, 0] }]
  }), /outside surface/);

  const structural = createSphSparseRenderFieldPlan({
    generationId: 5,
    surfaces: [{ surfaceIndex: 1, resolution: 9 }],
    directActiveBricks: [{ surfaceIndex: 1, brick: [1, 1, 1] }]
  });
  const decorated = createSphSparseRenderFieldPlan({
    generationId: 5,
    surfaces: [{
      surfaceIndex: 1,
      resolution: 9,
      material: 'water',
      materialPair: ['water', 'sodium'],
      scene: 'named-demo'
    }],
    directActiveBricks: [{
      surfaceIndex: 1,
      brick: [1, 1, 1],
      material: 'water',
      scene: 'named-demo'
    }]
  });
  assert.deepEqual(decorated.surfaceTable.rows, structural.surfaceTable.rows);
  assert.deepEqual(decorated.activeBricks.rows, structural.activeBricks.rows);
  assert.equal(decorated.sceneSpecificBranching, false);
  assert.equal(decorated.materialSpecificBranching, false);
  assert.equal(decorated.producerAuthority, 'compute-manager-owned-gpuhub-resident-lane');
  assert.equal(decorated.stateMutationRequired, false);
  assert.equal(decorated.cpuReferenceRequired, false);
  assert.equal(decorated.fullParticleReadbackRequired, false);
});
