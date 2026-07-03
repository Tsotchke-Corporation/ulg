import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT
} from '../ulg-gpu-abi/src/index.js';
import {
  schroederCrossLevelGridConservationSummaryWgsl,
  schroederCrossLevelGridProlongationWgsl,
  schroederCrossLevelGridRestrictionWgsl
} from '../ulg-gpu-abi/src/wgsl.js';
import {
  MLS_MPM_GPU_GRID_NODE_FLOATS,
  SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
  ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA,
  createSchroederCrossLevelGridCouplingParamsArray,
  createSchroederCrossLevelGridCouplingPlan,
  decodeSchroederCrossLevelGridConservationSummaryRow,
  prolongGridRowsCpuOracle,
  restrictGridRowsCpuOracle,
  summarizeGridConservationCpuOracle
} from '../src/runtime/sph/schroederCrossLevelCouplingGpu.js';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomFineGridRows(plan, seed = 42, { emptyFraction = 0.3 } = {}) {
  const random = seededRandom(seed);
  const rows = new Float64Array(plan.fineNodeCount * plan.gridStrideFloats);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const empty = random() < emptyFraction;
    const mass = empty ? 0 : 0.05 + random() * 2;
    rows[offset] = mass;
    rows[offset + 1] = mass * (random() * 4 - 2);
    rows[offset + 2] = mass * (random() * 4 - 2);
    rows[offset + 3] = mass * (random() * 4 - 2);
    rows[offset + 7] = mass > 0 ? 1 : 0;
  }
  return rows;
}

test('Schroeder cross-level grid coupling schemas and row layout are stable', () => {
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_GRID_RESTRICTION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-grid-restriction.v0'
  );
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_GRID_PROLONGATION_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-grid-prolongation.v0'
  );
  assert.equal(
    ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA,
    'peercompute.ulg.schroeder-cross-level-grid-conservation-summary.v0'
  );
  assert.equal(SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_FLOATS, 16);
  assert.equal(
    SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT[0],
    'fineMassKg:f32'
  );
  assert.equal(
    SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_ROW_LAYOUT[8],
    'massResidualKg:f32'
  );
});

test('Schroeder cross-level grid coupling plan halves dims with ceil and doubles spacing', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [5, 8, 3],
    fineGridSpacingM: 0.25,
    gridOriginM: [1, -2, 0.5]
  });
  assert.deepEqual(plan.fineGridDims, [5, 8, 3]);
  assert.deepEqual(plan.coarseGridDims, [3, 4, 2]);
  assert.equal(plan.fineNodeCount, 120);
  assert.equal(plan.coarseNodeCount, 24);
  assert.equal(plan.coarseGridSpacingM, 0.5);
  assert.equal(plan.gridStrideFloats, MLS_MPM_GPU_GRID_NODE_FLOATS);
  assert.equal(plan.fineGridByteLength, 120 * 8 * 4);
  assert.equal(plan.coarseGridByteLength, 24 * 8 * 4);
  assert.deepEqual(plan.conservedQuantities, ['mass', 'momentum']);
  assert.equal(plan.gpuFirst, true);
  assert.equal(plan.fullParticleReadbackRequired, false);
});

test('Schroeder cross-level grid coupling params array encodes dims, stride, and spacing', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 4, 2],
    fineGridSpacingM: 0.1,
    gridOriginM: [0.5, 0, -1],
    flags: 3
  });
  const params = createSchroederCrossLevelGridCouplingParamsArray(plan);
  // 80 bytes: the tail adds the subcycling delta scale.
  assert.equal(params.byteLength, 80);
  const view = new DataView(params);
  assert.equal(view.getUint32(0, true), 6);
  assert.equal(view.getUint32(4, true), 4);
  assert.equal(view.getUint32(8, true), 2);
  assert.equal(view.getUint32(12, true), 3);
  assert.equal(view.getUint32(16, true), 2);
  assert.equal(view.getUint32(20, true), 1);
  assert.equal(view.getUint32(24, true), 8);
  assert.equal(view.getUint32(28, true), 3);
  assert.ok(Math.abs(view.getFloat32(32, true) - 0.1) < 1e-7);
  assert.ok(Math.abs(view.getFloat32(36, true) - 0.5) < 1e-7);
  assert.equal(view.getFloat32(44, true), -1);
  assert.equal(view.getInt32(48, true), 0);
});

test('coupling plan encodes MLS-MPM z-fastest index order, shift, and accumulate flags', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [9, 9, 9],
    fineGridSpacingM: 0.25,
    indexOrder: 'z-fastest',
    gridShift: 1,
    accumulate: true
  });
  assert.equal(plan.indexOrder, 'z-fastest');
  assert.equal(plan.gridShift, 1);
  assert.equal(plan.accumulate, true);
  // accumulate=1 | z-fastest=2
  assert.equal(plan.flags, 3);
  // ceil((9 - 1) / 2) + 1 = 5 per axis.
  assert.deepEqual(plan.coarseGridDims, [5, 5, 5]);
  const view = new DataView(createSchroederCrossLevelGridCouplingParamsArray(plan));
  assert.equal(view.getUint32(28, true), 3);
  assert.equal(view.getInt32(48, true), 1);
});

test('restriction oracle conserves mass and momentum under z-fastest indexing with shift', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [9, 7, 6],
    fineGridSpacingM: 0.25,
    indexOrder: 'z-fastest',
    gridShift: 1
  });
  const fineRows = randomFineGridRows(plan, 5150);
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);
  const fine = summarizeGridConservationCpuOracle(plan, fineRows);
  const coarse = summarizeGridConservationCpuOracle(plan, coarseRows);
  assert.ok(Math.abs(fine.massKg - coarse.massKg) < 1e-12 * Math.max(1, fine.massKg));
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(fine.momentumKgMPerS[axis] - coarse.momentumKgMPerS[axis])
        < 1e-12 * Math.max(1, Math.abs(fine.momentumKgMPerS[axis]))
    );
  }
  // Constant-field recovery must also hold with shifted parent mapping.
  const velocity = [0.5, -1.25, 0.75];
  const constantRows = new Float64Array(plan.fineNodeCount * plan.gridStrideFloats);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = index % 3 === 0 ? 0 : 0.25;
    constantRows[offset] = mass;
    constantRows[offset + 1] = mass * velocity[0];
    constantRows[offset + 2] = mass * velocity[1];
    constantRows[offset + 3] = mass * velocity[2];
  }
  const constantCoarse = restrictGridRowsCpuOracle(plan, constantRows);
  const prolonged = prolongGridRowsCpuOracle(plan, constantCoarse, constantRows);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = prolonged[offset];
    if (!(mass > 0)) continue;
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(prolonged[offset + 1 + axis] / mass - velocity[axis]) < 1e-12);
    }
  }
});

test('accumulate-mode restriction adds fine totals into existing coarse totals', () => {
  const basePlan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 6, 6],
    fineGridSpacingM: 0.5
  });
  const fineRows = randomFineGridRows(basePlan, 31337);
  const seededCoarse = restrictGridRowsCpuOracle(basePlan, fineRows);
  const accumulatePlan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 6, 6],
    fineGridSpacingM: 0.5,
    accumulate: true
  });
  const doubled = restrictGridRowsCpuOracle(accumulatePlan, fineRows, seededCoarse);
  const single = summarizeGridConservationCpuOracle(basePlan, seededCoarse);
  const combined = summarizeGridConservationCpuOracle(accumulatePlan, doubled);
  assert.ok(Math.abs(combined.massKg - 2 * single.massKg) < 1e-12 * Math.max(1, single.massKg));
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(combined.momentumKgMPerS[axis] - 2 * single.momentumKgMPerS[axis])
        < 1e-12 * Math.max(1, Math.abs(single.momentumKgMPerS[axis]))
    );
  }
});

test('restriction oracle conserves total mass and momentum exactly', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [7, 6, 5],
    fineGridSpacingM: 0.2
  });
  const fineRows = randomFineGridRows(plan, 1234);
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);
  const fine = summarizeGridConservationCpuOracle(plan, fineRows);
  const coarse = summarizeGridConservationCpuOracle(plan, coarseRows);
  // float64 agglomeration: residuals at machine-precision scale only.
  assert.ok(Math.abs(fine.massKg - coarse.massKg) < 1e-12 * Math.max(1, fine.massKg));
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(fine.momentumKgMPerS[axis] - coarse.momentumKgMPerS[axis])
        < 1e-12 * Math.max(1, Math.abs(fine.momentumKgMPerS[axis]))
    );
  }
  assert.ok(fine.massKg > 0);
  assert.ok(coarse.activeNodeCount > 0);
  assert.ok(coarse.activeNodeCount <= fine.activeNodeCount);
});

test('restrict-then-prolong preserves a constant velocity field and conserves momentum', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [6, 6, 6],
    fineGridSpacingM: 0.5
  });
  const velocity = [1.5, -0.75, 2.25];
  const random = seededRandom(77);
  const fineRows = new Float64Array(plan.fineNodeCount * plan.gridStrideFloats);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = random() < 0.25 ? 0 : 0.1 + random();
    fineRows[offset] = mass;
    fineRows[offset + 1] = mass * velocity[0];
    fineRows[offset + 2] = mass * velocity[1];
    fineRows[offset + 3] = mass * velocity[2];
  }
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);

  // Coarse level sees the same constant velocity on every massive node.
  for (let index = 0; index < plan.coarseNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = coarseRows[offset];
    if (!(mass > 0)) continue;
    assert.ok(Math.abs(coarseRows[offset + 1] / mass - velocity[0]) < 1e-12);
    assert.ok(Math.abs(coarseRows[offset + 2] / mass - velocity[1]) < 1e-12);
    assert.ok(Math.abs(coarseRows[offset + 3] / mass - velocity[2]) < 1e-12);
  }

  // Zero the fine momentum, then prolong the coarse velocity back down: every
  // massive fine node must recover exactly the constant field.
  const zeroedFine = Float64Array.from(fineRows);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    zeroedFine[offset + 1] = 0;
    zeroedFine[offset + 2] = 0;
    zeroedFine[offset + 3] = 0;
  }
  const prolonged = prolongGridRowsCpuOracle(plan, coarseRows, zeroedFine);
  for (let index = 0; index < plan.fineNodeCount; index += 1) {
    const offset = index * plan.gridStrideFloats;
    const mass = prolonged[offset];
    if (!(mass > 0)) continue;
    assert.ok(Math.abs(prolonged[offset + 1] / mass - velocity[0]) < 1e-12);
    assert.ok(Math.abs(prolonged[offset + 2] / mass - velocity[1]) < 1e-12);
    assert.ok(Math.abs(prolonged[offset + 3] / mass - velocity[2]) < 1e-12);
  }

  // Prolongation of a restriction conserves total momentum.
  const fineTotals = summarizeGridConservationCpuOracle(plan, fineRows);
  const prolongedTotals = summarizeGridConservationCpuOracle(plan, prolonged);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(fineTotals.momentumKgMPerS[axis] - prolongedTotals.momentumKgMPerS[axis])
        < 1e-9 * Math.max(1, Math.abs(fineTotals.momentumKgMPerS[axis]))
    );
  }
  assert.ok(Math.abs(fineTotals.massKg - prolongedTotals.massKg) < 1e-12);
});

test('prolongation oracle conserves momentum for non-constant fields too', () => {
  const plan = createSchroederCrossLevelGridCouplingPlan({
    fineGridDims: [8, 4, 4],
    fineGridSpacingM: 0.5
  });
  const fineRows = randomFineGridRows(plan, 999, { emptyFraction: 0.2 });
  const coarseRows = restrictGridRowsCpuOracle(plan, fineRows);
  const prolonged = prolongGridRowsCpuOracle(plan, coarseRows, fineRows);
  const coarseTotals = summarizeGridConservationCpuOracle(plan, coarseRows);
  const prolongedTotals = summarizeGridConservationCpuOracle(plan, prolonged);
  // Per parent cell: sum(child mass * parent velocity) == parent momentum,
  // so global totals match after prolongation.
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(coarseTotals.momentumKgMPerS[axis] - prolongedTotals.momentumKgMPerS[axis])
        < 1e-9 * Math.max(1, Math.abs(coarseTotals.momentumKgMPerS[axis]))
    );
  }
});

test('conservation summary decoder maps the 16-float row', () => {
  const row = new Float32Array(16);
  row[0] = 10;
  row[4] = 10;
  row[8] = 0;
  row[9] = 0.5;
  row[12] = 42;
  row[13] = 7;
  row[14] = 1;
  const decoded = decodeSchroederCrossLevelGridConservationSummaryRow(row);
  assert.equal(decoded.schema, ULG_SCHROEDER_CROSS_LEVEL_GRID_CONSERVATION_SUMMARY_SCHEMA);
  assert.equal(decoded.fineMassKg, 10);
  assert.equal(decoded.coarseMassKg, 10);
  assert.equal(decoded.massResidualKg, 0);
  assert.equal(decoded.momentumResidualKgMPerS[0], 0.5);
  assert.equal(decoded.fineActiveNodeCount, 42);
  assert.equal(decoded.coarseActiveNodeCount, 7);
  assert.equal(decoded.status, 1);
  assert.equal(decodeSchroederCrossLevelGridConservationSummaryRow(new Float32Array(4)), null);
});

test('cross-level grid coupling WGSL kernels declare the shared params and entry points', () => {
  for (const source of [
    schroederCrossLevelGridRestrictionWgsl,
    schroederCrossLevelGridProlongationWgsl,
    schroederCrossLevelGridConservationSummaryWgsl
  ]) {
    assert.match(source, /struct SchroederCrossLevelGridCouplingParams/);
    assert.match(source, /@compute @workgroup_size\(64\)/);
    assert.match(source, /fn main\(/);
  }
  assert.match(schroederCrossLevelGridRestrictionWgsl, /var<storage, read> fine_grid/);
  assert.match(schroederCrossLevelGridRestrictionWgsl, /var<storage, read_write> coarse_grid/);
  assert.match(schroederCrossLevelGridProlongationWgsl, /var<storage, read> coarse_grid/);
  assert.match(schroederCrossLevelGridProlongationWgsl, /var<storage, read_write> fine_grid/);
  assert.match(schroederCrossLevelGridConservationSummaryWgsl, /var<storage, read_write> summary_row/);
});
