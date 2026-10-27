import {
  finalizeSchroederSpatialReactionPlacementPositionEpochFloor,
  releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue,
  transferSchroederSpatialReactionPlacementDestinationOwnership,
  releaseSchroederSpatialReactionPlacementTransferredDestinationOwnershipAfterQueue,
  createSchroederSpatialReactionPlacementMassInventory,
  createSchroederSpatialReactionPlacementProductHistory
} from '../../src/runtime/sph/schroederSpatialReactionPlacementEpochGpu.js';
import { acquireSphExactMassRead, releaseSphExactMassRead, releaseSphExactMassInventory }
  from '../../src/runtime/sph/sphExactMassInventoryGpu.js';
import { mergeResidentProductMassBuffersWebGpu, resolveResidentProductMassMergeSourceCapture }
  from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { resolveResidentProductEventCountAuthority }
  from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';

// Exercise the original production owners. Readback checks only inspect the
// GPU results; they never seed a numeric family or a history/count authority.
export async function inspectExactPlacementHandoff({ device, family, placementArtifact, read, selected }) {
  await finalizeSchroederSpatialReactionPlacementPositionEpochFloor(family, { placementArtifact });
  releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(family, { placementArtifact });
  const transferred = transferSchroederSpatialReactionPlacementDestinationOwnership(family);
  const numericPending = createSchroederSpatialReactionPlacementMassInventory(family, { device });
  const historyPending = createSchroederSpatialReactionPlacementProductHistory(family, { device });
  // Both producers must pin the transferred tuple before their first await.
  const destinationRetirement = releaseSchroederSpatialReactionPlacementTransferredDestinationOwnershipAfterQueue(family);
  let numeric, history, numericRead, capture, historyRetirement;
  try {
    [numeric, history] = await Promise.all([numericPending, historyPending]);
    const originalRetired = await destinationRetirement;
    numericRead = acquireSphExactMassRead({ family: numeric, device });
    const mass = await read(numericRead.buffer);
    const layout = history.exactProductHistoryLayout;
    const controlFor = async handle => {
      const authority = resolveResidentProductEventCountAuthority(handle, device);
      const words = await read(authority.controlBuffer);
      return words.slice(authority.controlOffsetBytes / 4, authority.controlOffsetBytes / 4 + 16);
    };
    const packed = await read(history.productEventBuffer), control = await controlFor(history);
    const expected = new Uint32Array(packed.length), count = selected.residualCount[0];
    for (let row = 0; row < count; row++) {
      const at = row * layout.rowWords, q = (family.particleCount + row) * layout.quantityWords;
      expected.set(selected.residualEvents.slice(row * 32, (row + 1) * 32), at);
      expected.set(selected.residualCompanions.slice(row * layout.companionWords, (row + 1) * layout.companionWords),
        at + layout.companionOffsetWords);
      expected.set(selected.quantities.slice(q, q + layout.quantityWords), at + layout.quantityOffsetWords);
    }
    const token = {};
    const mergedPending = mergeResidentProductMassBuffersWebGpu({ device,
      emittedResidentProductMass: history, postMechanicsSourceCapture: token });
    historyRetirement = history.destroyResidentProductMassBuffers();
    const merged = await mergedPending;
    capture = resolveResidentProductMassMergeSourceCapture(merged, token);
    const sourceRetired = await historyRetirement;
    const mergedRows = await read(merged.productEventBuffer), mergedControl = await controlFor(merged);
    const equal = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);
    const ready = words => words[0] === 0x50484731 && words[1] === 1 && words[2] === 1
      && words[3] === count && words[5] === layout.rowWords / 4 && words[11] === 0;
    return { residualRowCount: count, rowWords: layout.rowWords,
      sourceControl: Array.from(control), mergedControl: Array.from(mergedControl),
      checks: { transferred, originalRetired, sourceRetired,
        independentMass: numericRead.buffer !== family.placedDestinationMassBuffer,
        independentHistory: history.productEventBuffer !== family.placedDestinationResidualEventBuffer,
        independentMerge: merged.productEventBuffer !== history.productEventBuffer,
        massPreserved: equal(mass, selected.massInventory),
        completeRowsPreserved: equal(packed, expected), sourceCountReady: ready(control),
        mergedCountReady: ready(mergedControl),
        mergedRowsPreserved: equal(mergedRows.slice(0, count * layout.rowWords), expected.slice(0, count * layout.rowWords)),
        mergedTailClear: mergedRows.slice(count * layout.rowWords).every(word => word === 0)
      } };
  } finally {
    capture?.release(); capture?.retireOwnedOutput();
    if (history) await (historyRetirement ?? history.destroyResidentProductMassBuffers());
    if (numericRead) await releaseSphExactMassRead(numericRead);
    if (numeric) releaseSphExactMassInventory(numeric);
  }
}
