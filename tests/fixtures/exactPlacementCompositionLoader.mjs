import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Test-only load boundary. Preserve the canonical file URL and module registry;
// no resolve hook, alternate source owner, authority registration or admission.
const ownerUrl = pathToFileURL(realpathSync(new URL(
  '../../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js', import.meta.url
))).href;
const testExports = `
export {prepareExactPlacementEventDispositions as __events,
 commitExactPlacementEventDispositions as __commitEvents,
 finalizeExactPlacementResidualHistory as __history,
 encodeExactPlacementCapturePreparation as __capture,
 encodeExactPlacementCaloricPhysicalPreparation as __physical,
 encodeExactPlacementPhysicalEvidenceConsumption as __physicalConsume,
 encodeExactPlacementChemistryPreparation as __chemistry,
 encodeExactPlacementChemistryConsumption as __chemistryConsume,
 prepareExactPlacementTerminalEncoding as __terminalPrepare,
 encodeExactPlacementTerminal as __terminal,
 exactChemistryConfigurationForAuthority as __chemistryConfig};
export function __validateTerminal(authority,evidence,options){
 return validateExactPlacementTerminalEncoding(requireLivePlacementAuthority(authority),evidence,options);
}
export function __terminalStorageProgress(authority){
 const r=requireLivePlacementAuthority(authority).exactTerminalRecord;
 return r?{attempted:r.attempted,completed:r.completed,dispatches:r.completedSteps.length,copies:r.completedResidualCopies.length}:null;
}
export function __eventProgress(authority){
 const r=requireLivePlacementAuthority(authority).exactEventRecord;
 return r?{prepared:r.prepared,committed:r.committed,historyFinalized:r.historyFinalized}:null;
}
`;
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (url !== ownerUrl) return result;
  if (result.format !== 'module' || result.source == null) {
    throw new Error('Exact placement test requires the original ESM owner source');
  }
  const source = typeof result.source === 'string'
    ? result.source : new TextDecoder().decode(result.source);
  return { ...result, source: source + testExports };
}
