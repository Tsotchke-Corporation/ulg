// Extracted from ulgMechanicsResidentStage.worker.js (Gate 6 Phase D mechanical decomposition).

import {
  enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors
} from '../runtime/sph/schroederSpatialMechanicalProposalsGpu.js';
import {
  enumerateSchroederSpatialReactionDiscoveryPrewarmPipelineDescriptors
} from '../runtime/sph/schroederSpatialReactionDiscoveryProposalGpu.js';
import {
  enumerateSphReactionStepPrewarmPipelineDescriptors
} from '../runtime/sph/sphReactionGpuKernel.js';
import {
  enumerateSphPhaseCarrierOneToFourPrewarmPipelineDescriptors
} from '../runtime/sph/sphPhaseCarrierMaterializationGpu.js';
import {
  prewarmCachedExplicitComputePipeline
} from '../runtime/webgpuComputeLayout.js';
import {
  enumerateWebGpuStableRadixPrewarmPipelineDescriptors
} from '../runtime/webgpuRadixScanUnique.js';
import {
  enumerateSphReactionProductPlacementSegmentedPrewarmPipelineDescriptors
} from '../runtime/sph/schroederSpatialReactionProductPlacementGpu.js';
import {
  enumerateSphReactionCanonicalSummaryPrewarmPipelineDescriptors
} from '../runtime/sph/sphReactionGpuSummary.js';


// solver budgets (j16.p1024 batch, j16.p512 interactive), the aggregate and
// flat projection variants, and directory ABI v1.
//
// Fail-open but completion-truthful: descriptors compile concurrently and the
// lane seed awaits their settled summaries. A failed compile never rejects
// lane admission, but "completed" now means the async work actually settled.
export function enumerateWorkerSchroederLanePrewarmPipelineDescriptors() {
  // These are fixed algorithm/ABI variants, never chemical-law or scenario
  // specializations. Exact duplicate descriptors are harmless: the shared
  // prewarm primitive coalesces them using the same full identity as the live
  // pipeline cache (cache key + label + entry point + bindings).
  return [
    ...enumerateSchroederSpatialMechanicalPrewarmPipelineDescriptors(),
    ...enumerateSchroederSpatialReactionDiscoveryPrewarmPipelineDescriptors(),
    ...enumerateSphReactionStepPrewarmPipelineDescriptors(),
    ...enumerateSphReactionCanonicalSummaryPrewarmPipelineDescriptors(),
    ...enumerateSphReactionProductPlacementSegmentedPrewarmPipelineDescriptors(),
    ...enumerateWebGpuStableRadixPrewarmPipelineDescriptors(),
    ...enumerateSphPhaseCarrierOneToFourPrewarmPipelineDescriptors()
  ];
}

export async function prewarmWorkerSchroederLaneComputePipelines(device, {
  enumeratePipelines = enumerateWorkerSchroederLanePrewarmPipelineDescriptors
} = {}) {
  let descriptors;
  try {
    descriptors = typeof enumeratePipelines === 'function'
      ? (enumeratePipelines() || [])
      : [];
  } catch (error) {
    return {
      schema: 'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0',
      status: 'worker-lane-pipeline-prewarm-skipped-enumeration-failed',
      reason: error instanceof Error ? error.message : String(error),
      requestedCount: 0,
      firedCount: 0
    };
  }
  if (!Array.isArray(descriptors) || descriptors.length === 0) {
    return {
      schema: 'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0',
      status: 'worker-lane-pipeline-prewarm-skipped-no-enumeration',
      reason: 'the pipeline enumeration produced no descriptors',
      requestedCount: 0,
      firedCount: 0
    };
  }
  const results = await Promise.all(descriptors.map(async (descriptor) => {
    try {
      return await prewarmCachedExplicitComputePipeline(device, descriptor);
    } catch (error) {
      return {
        cacheStatus: 'pipeline-prewarm-failed',
        cacheKey: descriptor?.cacheKey ?? null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));
  const failed = results.filter(
    (result) => result?.cacheStatus === 'pipeline-prewarm-failed'
  );
  return {
    schema: 'peercompute.ulg.worker-schroeder-lane-pipeline-prewarm.v0',
    status: 'worker-lane-pipeline-prewarm-completed',
    reason: null,
    requestedCount: descriptors.length,
    firedCount: descriptors.length,
    settledCount: results.length,
    prewarmedCount: results.filter(
      (result) => result?.cacheStatus === 'pipeline-prewarmed'
    ).length,
    cacheHitCount: results.filter(
      (result) => result?.cacheStatus === 'pipeline-cache-hit'
    ).length,
    failedCount: failed.length,
    failedCacheKeys: failed.map((result) => result?.cacheKey).filter(Boolean)
  };
}


