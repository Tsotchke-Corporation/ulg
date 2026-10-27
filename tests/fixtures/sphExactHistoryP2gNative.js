import { runMlsMpmGridUpdateWebGpu } from '../../src/runtime/sph/sphGridUpdateGpuKernel.js';
import { runMlsMpmG2pWebGpu, acquireMlsMpmG2pExactMassCapture } from '../../src/runtime/sph/sphG2pGpuKernel.js';
import { acquireResidentProductExactHistoryRead } from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { prepareSphExactHistoryP2g } from '../../src/runtime/sph/sphExactHistoryP2gGpu.js';
import { runMlsMpmP2gGridProjectionWebGpu } from '../../src/runtime/sph/sphGridGpuKernel.js';
import { runSchroederSameLevelMechanicsWebGpu } from '../../src/runtime/sph/schroederHierarchyGpu.js';
import * as spatial from '../../src/runtime/sph/schroederSpatialSuccessorSourceFamily.js';
import { inspectExactHistoryP2gProjection, inspectExactG2pQuantities } from './sphExactPlacementQuantityInspection.js';
import { createSphNativePassTrace } from './sphNativePassTrace.js';

// Independent quadratic interpolation and integer-grid rounding intervals.
// A rounded baseline grid value may represent several integer accumulator
// values; compare every output node against that exact interval after adding
// the independently calculated residual contribution.
function inspectGridContributions(base, actual, views, rows) {
  const f = Math.fround, scale = 65536, failures = [], quantizedTotals = [0, 0, 0, 0];
  let changedNodes = 0, contributingNodes = 0;
  const weights = x => {
    const a = f(1.5 - x), b = f(x - 1), c = f(x - .5);
    return [f(f(.5 * a) * a), f(.75 - f(b * b)), f(f(.5 * c) * c)];
  };
  const roundEven = x => {
    const low = Math.floor(x), remainder = x - low;
    return remainder === .5 ? low + Math.abs(low % 2) : Math.round(x);
  };
  const events = rows.map(({ row }) => {
    const at = row * 84, position = Array.from(views.slice(at, at + 3), x => f(x * 2));
    const origin = position.map(x => Math.floor(f(x - .5)));
    return { origin, weights: position.map((x, axis) => weights(f(x - origin[axis]))),
      quantities: [13, 20, 21, 22].map(field => views[at + field]) };
  });
  for (let at = 0; at < actual.length; at += 8) {
    const node = Array.from(base.slice(at + 4, at + 7), x => Math.round(x * 2));
    const delta = [0, 0, 0, 0];
    for (const event of events) {
      const offset = node.map((x, axis) => x - event.origin[axis]);
      if (offset.some(x => x < 0 || x > 2)) continue;
      const weight = f(f(event.weights[0][offset[0]] * event.weights[1][offset[1]]) * event.weights[2][offset[2]]);
      event.quantities.forEach((value, axis) => { delta[axis] += roundEven(f(f(weight * value) * scale)); });
    }
    if (delta.some(x => x !== 0)) contributingNodes++;
    if (delta.some((_, axis) => actual[at + axis] !== base[at + axis])) changedNodes++;
    for (let axis = 0; axis < 4; axis++) {
      quantizedTotals[axis] += delta[axis] / scale;
      const value = base[at + axis], scaled = value * scale;
      const step = scaled ? 2 ** Math.max(0, Math.floor(Math.log2(Math.abs(scaled))) - 23) : 1;
      let low = Math.ceil(scaled - step / 2), high = Math.floor(scaled + step / 2);
      while (low <= high && f(low / scale) !== value) low++;
      while (high >= low && f(high / scale) !== value) high--;
      const lower = f((low + delta[axis]) / scale), upper = f((high + delta[axis]) / scale);
      if (low > high || !Number.isFinite(actual[at + axis]) || actual[at + axis] < lower || actual[at + axis] > upper) {
        failures.push({ node: at / 8, axis, actual: actual[at + axis], lower, upper, contribution: delta[axis] });
      }
    }
  }
  return { matches: failures.length === 0, failureCount: failures.length, failures: failures.slice(0, 8),
    nodeCount: actual.length / 8, contributingNodes, changedNodes, quantizedTotals };
}

// Genuine history owner -> numeric projection, then the actual P2G producer
// under a genuine next canonical generation. Stop before grid update/G2P:
// this does not claim residual transport or a completed following step.
export async function inspectExactHistoryP2gNative({ args, next, read, tracePasses = false, inspectG2p = false, rejectG2p = false }) {
  const { device } = args, history = next.residentProductMass, allocations = [];
  const source = acquireResidentProductExactHistoryRead(history, { device, identityBuffer: next.sphParticleUpload.identityBuffer });
  let projection, before, numerical, projected;
  try {
    projection = await prepareSphExactHistoryP2g({ device, source,
      allocate: descriptor => { const buffer = device.createBuffer(descriptor); allocations.push(buffer); return buffer; } });
    before = read ? await read(source.buffer) : null;
    if (read) console.log('exact-routing-progress', JSON.stringify({ phase: 'history-p2g-source',
      layout: source.layout, count: Array.from((await read(source.descriptor.controlBuffer)).slice(source.descriptor.controlOffsetBytes / 4,
        source.descriptor.controlOffsetBytes / 4 + 16)) }));
    if (tracePasses) {
      const trace = createSphNativePassTrace(); projection.encode(trace.encoder);
      await trace.submit(device, detail => console.log('exact-routing-progress',
        JSON.stringify({ phase: 'history-p2g-pass', ...detail })), () => {});
    } else {
      const encoder = device.createCommandEncoder(); projection.encode(encoder); device.queue.submit([encoder.finish()]);
    }
    if (read) {
      projected = await read(projection.outputBuffer);
      const count = (await read(source.descriptor.controlBuffer)).slice(source.descriptor.controlOffsetBytes / 4);
      numerical = inspectExactHistoryP2gProjection({ source: before, layout: source.layout, count,
        projected, validation: await read(projection.validationBuffer) });
    } else numerical = { matches: projection.outputBuffer !== source.buffer };
  } finally {
    await device.queue.onSubmittedWorkDone();
    for (const buffer of allocations) buffer.destroy();
    source.release();
  }
  const family = next.schroederSpatialSuccessorSourceFamily;
  const lease = spatial.acquireSchroederSpatialSuccessorSourceFamilyLease(family, { device });
  const stop = new Error('Actual exact-history P2G inspected before residual integration');
  let grid, g2p, generation, originalProposal, sourceUnchanged = true;
  try {
    await runSchroederSameLevelMechanicsWebGpu({ device,
      sphParticleState: { ...args.sphParticleState, cpuStateStale: true },
      mlsMpmParticleState: { ...args.mlsMpmParticleState, cpuStateStale: true },
      sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
      levelAssignment: next.schroederSpatialSuccessorLevelAssignment,
      levelAssignmentSourceFamily: family, levelAssignmentSourceFamilyLease: lease,
      selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: .5, boxDimsM: [2, 2, 2],
      dt: .000001, gravityMPerS2: [0, 0, 0], readbackMode: 'no-full-readback',
      enableTwoLevelMechanics: false, enableCrossLevelCoupling: false,
      enableLawQueue: false, enableLawNeighborCandidates: false,
      enableParticleStorageCountSummary: false, enableParticleStorageCompaction: false,
      residentStepOptions: { thermalMaterialTable: args.thermalMaterialTable,
        mechanicsMaterialTable: args.mechanicsMaterialTable, internalPressureScale: 0,
        fuseNoFullResidentMechanics: false, gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null },
      gpuTimestampRecorder: { active: true, async measureQueueStage(meta, work) {
        const result = await work();
        if (meta.stage === 'spatial-epoch-generation') generation = result;
        if (meta.stage === 'spatialMechanicalProposal') originalProposal = result;
        if (meta.stage !== 'p2gGridProjection') return result;
        const baseline = result.gpuResult;
        let coupled, update, reconstruction, capture;
        try {
          const baselineWords = read ? await read(baseline.gridBuffer) : null;
          coupled = await runMlsMpmP2gGridProjectionWebGpu({ device,
            sphParticleState: { ...args.sphParticleState, cpuStateStale: true },
            mlsMpmParticleState: { ...args.mlsMpmParticleState, cpuStateStale: true },
            sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
            schroederLevelAssignment: next.schroederSpatialSuccessorLevelAssignment,
            schroederSelectedLevel: 0, schroederSpatialEpochGeneration: generation, canonicalSpatialRequired: true,
            gridSpacingM: .5, boxDimsM: [2, 2, 2], dt: .000001, readbackMode: 'no-full-readback',
            residentProductMass: history,
            retainGridBuffer: true, internalPressureScale: 0 });
          grid = { originalProducer: true, gpuCount: coupled.residentProductMassInputProductEventCountHostKnown === false };
          if (read) {
            const actual = new Float32Array((await read(coupled.gridBuffer)).buffer);
            const base = new Float32Array(baselineWords.buffer), totals = [0, 0, 0, 0], expected = [0, 0, 0, 0];
            for (let at = 0; at < actual.length; at += 8) for (let axis = 0; axis < 4; axis++) totals[axis] += actual[at + axis] - base[at + axis];
            const views = new Float32Array(projected.buffer);
            for (const { row } of numerical.rows) [13, 20, 21, 22].forEach((field, axis) => { expected[axis] += views[row * 84 + field]; });
            // The existing P2G grid uses fixed-point atomic increments (2^-16).
            // Each residual has at most 27 rounded node contributions.
            const bound = numerical.rows.length * 27 / 65536 + 1e-7;
            grid.totals = totals; grid.expected = expected; grid.quantizationBound = bound;
            grid.nodewise = inspectGridContributions(base, actual, views, numerical.rows);
            grid.matches = grid.nodewise.matches && actual.every(Number.isFinite)
              && totals.every((value, axis) => Math.abs(value - expected[axis]) <= bound);
            const after = await read(history.productEventBuffer);
            sourceUnchanged = before.length === after.length && before.every((word, i) => word === after[i]);
          } else grid.matches = true;
          if (inspectG2p) {
            update = await runMlsMpmGridUpdateWebGpu({ device, p2gGridProjection: coupled,
              dt: .000001, gravityMPerS2: [0, 0, 0], boxDimsM: [2, 2, 2],
              retainUpdatedGridBuffer: true, readbackMode: 'no-full-readback' });
            if (!originalProposal) throw new Error('Original contact proposal was not observed');
            // Test-only upstream rejection fault. Preserve the real producer
            // and its host identity; never forge a successful GPU receipt.
            if (rejectG2p) device.queue.writeBuffer(generation.execution.evidenceBuffer, 14 * 4, new Uint32Array([1]));
            reconstruction = await runMlsMpmG2pWebGpu({ device, schroederSpatialMechanicalProposal: originalProposal,
              sphParticleState: { ...args.sphParticleState, cpuStateStale: true },
              mlsMpmParticleState: { ...args.mlsMpmParticleState, cpuStateStale: true },
              sphParticleUpload: next.sphParticleUpload, mlsMpmParticleUpload: next.mlsMpmParticleUpload,
              mechanicsMaterialTable: args.mechanicsMaterialTable,
              gridUpdate: update, schroederSelectedLevel: 0, schroederSpatialEpochGeneration: generation,
              canonicalSpatialRequired: true, dt: update.dt, boxDimsM: [2, 2, 2], internalPressureScale: 0,
              particleSeparationRelaxation: 0, particleSeparationVelocityDamping: 0,
              retainOutputParticleBuffers: true, readbackMode: 'no-full-readback' });
            capture = acquireMlsMpmG2pExactMassCapture(reconstruction,
              { device, sphParticleUpload: next.sphParticleUpload });
            if (!capture.history) throw new Error('Original G2P omitted its actual P2G history');
            const h = capture.history;
            let copiedCaptureRejected = false, pinnedRetirementRejected = false;
            try { acquireMlsMpmG2pExactMassCapture({ ...reconstruction }, { device, sphParticleUpload: next.sphParticleUpload }); }
            catch { copiedCaptureRejected = true; }
            try { reconstruction.destroyOutputParticleBuffers(); } catch { pinnedRetirementRejected = true; }
            if (!copiedCaptureRejected || !pinnedRetirementRejected || !capture.validate()) throw new Error('G2P output capture lifetime weakened');
            if (read) {
              const oldState = await read(h.stateBuffer), oldMechanics = await read(h.mechanicsBuffer);
              const state = await read(h.outStateBuffer), mechanics = await read(h.outMechanicsBuffer);
              const quantities = inspectExactG2pQuantities({ before: await read(h.quantities.original),
                after: await read(h.quantities.quantityBuffer), sourceState: oldState, sourceMechanics: oldMechanics,
                state, mechanics, increments: await read(h.quantities.projectionBuffer),
                layout: h.quantityLayout, format: h.layout.format, validation: await read(h.quantities.validationBuffer) });
              const selected = await read(h.buffer), validation = await read(h.validationBuffer);
              const liveRows = numerical.rows.length, layout = h.layout;
              let movedRows = 0;
              const expectedPosition = [], actualPosition = [];
              for (let row = 0; row < liveRows; row++) {
                const at = row * layout.rowWords;
                if ([0, 1, 2].some(axis => selected[at + axis] !== before[at + axis])) movedRows++;
                const old = new Float32Array(oldState.buffer), current = new Float32Array(state.buffer);
                for (let axis = 0; axis < 3; axis++) {
                  expectedPosition.push(Math.fround(old[row * 8 + axis] + Math.fround(capture.dt * current[row * 8 + 4 + axis])));
                  actualPosition.push(new Float32Array(selected.buffer)[at + axis]);
                }
              }
              const positions = actualPosition.every((value, i) => Math.abs(value - expectedPosition[i]) <= 1e-7);
              const tuple = numerical.rows.every(({ row }) => {
                const at = row * layout.rowWords;
                return selected.slice(at + layout.stateOffsetWords, at + layout.stateOffsetWords + 8)
                  .every((word, i) => word === state[row * 8 + i])
                  && selected.slice(at + layout.mechanicsOffsetWords, at + layout.mechanicsOffsetWords + 32)
                    .every((word, i) => word === mechanics[row * 32 + i])
                  && selected.slice(at + layout.companionOffsetWords, at + layout.quantityOffsetWords)
                    .every((word, i) => word === before[at + layout.companionOffsetWords + i]);
              });
              sourceUnchanged &&= (await read(history.productEventBuffer)).every((word, i) => word === before[i]);
              let restored = null;
              if (rejectG2p) {
                const same = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);
                restored = { history: same(selected, before),
                  state: same(await read(capture.stateBuffer), await read(next.sphParticleUpload.stateBuffer)),
                  mechanics: same(await read(capture.mechanicsBuffer), await read(next.mlsMpmParticleUpload.mechanicsBuffer)),
                  quantities: same(await read(capture.quantities.quantityBuffer), await read(capture.sourceRead.quantities.quantityBuffer)) };
              }
              g2p = { originalProducer: true, sharedDecisionAccepted: validation[0] === 0, validation: Array.from(validation),
                quantities, positions, tuple, movedRows, liveRows, sourceUnchanged, restored, copiedCaptureRejected, pinnedRetirementRejected,
                inactiveCleared: selected.slice(liveRows * layout.rowWords).every(word => word === 0),
                pass: quantities.matches && sourceUnchanged && (rejectG2p
                  ? (validation[0] & 128) !== 0 && Object.values(restored).every(Boolean)
                  : validation[0] === 0 && positions && tuple && movedRows === liveRows) };
            } else g2p = { originalProducer: true, pass: h.sourceHandle === history && capture.validate() };
          }
        } finally {
          await device.queue.onSubmittedWorkDone();
          capture?.release(); reconstruction?.destroyOutputParticleBuffers(); update?.destroyUpdatedGridBuffer();
          baseline?.destroyGridBuffer(); coupled?.destroyGridBuffer();
        }
        throw stop;
      } } });
    throw new Error('History P2G diagnostic unexpectedly advanced mechanics');
  } catch (error) { if (error !== stop) throw error; }
  finally { spatial.releaseSchroederSpatialSuccessorSourceFamilyLease(family, lease, { device }); }
  return { projectionOnly: !inspectG2p, rejectG2p, tracePasses, numerical, grid, g2p, sourceUnchanged,
    pass: numerical.matches && grid?.matches && grid.gpuCount && sourceUnchanged && (!inspectG2p || g2p?.pass) };
}
