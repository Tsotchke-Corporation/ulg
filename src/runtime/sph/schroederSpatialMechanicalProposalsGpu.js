import {
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1,
  SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1,
  ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNear.js';
import {
  createSchroederSpatialExactNearTraversalV1Wgsl
} from '../../../ulg-gpu-abi/src/schroederSpatialExactNearTraversalWgsl.js';
import {
  validateSchroederSpatialAggregateViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialAggregateView.js';
import {
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION,
  ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
  validateSchroederSpatialActiveRankViewDescriptor
} from '../../../ulg-gpu-abi/src/schroederSpatialActiveRankView.js';
import {
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_MAGIC,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE,
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION,
  ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
  createSchroederSpatialMechanicalPairGraphCapacityPlan
} from '../../../ulg-gpu-abi/src/schroederSpatialMechanicalPairGraph.js';
import {
  computeBufferBinding,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';
import { createWebGpuU32ExclusiveScan } from '../webgpuRadixScanUnique.js';
import {
  tagWebGpuBufferDevice,
  webGpuBufferMatchesDevice,
  webGpuDeviceId
} from './sphGpuDeviceIdentity.js';
import {
  SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_STATUS,
  bindSchroederSpatialExactNearResidentConsumerEvidence,
  resolveSchroederSpatialExactNearConsumerGeneration
} from './schroederSpatialEpochGpu.js';
import { validateSphPhaseCarrierPlan } from './sphPhaseCarrierTransferGpu.js';

export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal.v3';
export const ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA =
  'peercompute.ulg.schroeder-spatial-mechanical-proposal-buffer.v3';
export const ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA =
  'peercompute.ulg.schroeder-spatial-consumer-gpu-evidence.v3';
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS =
  'schroeder-spatial-mechanical-contact-graph-prepared';
export const SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY =
  'post-g2p-state-with-swept-pre-integration-ss-directory';
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE =
  'proposal-deferred-to-post-mechanics';

export const SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS = Object.freeze([
  Object.freeze({
    consumerId: 'pressure-contact-interface',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1
  }),
  Object.freeze({
    consumerId: 'separation',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1
  }),
  Object.freeze({
    consumerId: 'local-material-interface',
    supportProfileId: SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1
  })
]);

export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC = 0x4d50_4831;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION = 3;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS = 16;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS = 8;
export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS = 8;
export const SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORDS;
export const SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS = 4;
export const SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT = 1;
export const SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_DEFAULT =
  8 * 1024 * 1024;
export const SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE = 16;

export const SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT = Object.freeze([
  'magic:u32',
  'version:u32',
  'generationId:u32',
  'supportEpoch:u32',
  'particleCount:u32',
  'rowWords:u32',
  'pressureContactSupportProfileId:u32',
  'separationSupportProfileId:u32',
  'localMaterialInterfaceSupportProfileId:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'traversalCount:u32',
  'consumerCount:u32'
]);

export const SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT = Object.freeze([
  'magic:u32',
  'abiVersion:u32',
  'statusFlags:atomic<u32>',
  'generationId:u32',
  'storageGeneration:u32',
  'physicsTick:u32',
  'physicsSubstep:u32',
  'positionEpoch:u32',
  'topologyEpoch:u32',
  'supportEpoch:u32',
  'selectedLevel:i32',
  'particleCount:u32',
  'particleCapacity:u32',
  'directedPairCapacity:u32',
  'appendAttemptCount:atomic<u32>',
  'stagedDirectedPairCount:atomic<u32>',
  'requiredDirectedPairCount:atomic<u32>',
  'publishedDirectedPairCount:atomic<u32>',
  'overflowCount:atomic<u32>',
  'invalidSourceCount:atomic<u32>',
  'invalidPeerCount:atomic<u32>',
  'duplicatePeerCount:atomic<u32>',
  'asymmetricPeerCount:atomic<u32>',
  'countPassCount:atomic<u32>',
  'scanPassCount:atomic<u32>',
  'scatterPassCount:atomic<u32>',
  'verifyPassCount:atomic<u32>',
  'publishPassCount:atomic<u32>',
  'measurePassCount:atomic<u32>',
  'solvePassCount:atomic<u32>',
  'maxPositionResidualOrderedF32:atomic<u32>',
  'maxVelocityResidualOrderedF32:atomic<u32>',
  'energyMeasurePassCount:atomic<u32>',
  'pairKineticDeltaJ:f32-bits',
  'pairHeatJ:f32-bits',
  'wallHeatJ:f32-bits',
  'energyResidualJ:f32-bits',
  'energyToleranceJ:f32-bits',
  'energyGainCount:atomic<u32>',
  'negativeInternalEnergyCount:atomic<u32>',
  'candidateVisitCount:atomic<u32>',
  'aggregateSummaryPhaseMismatchCount:atomic<u32>',
  'aggregateSummaryPreflightCount:atomic<u32>',
  'aggregateHierarchyNodeVisitCount:atomic<u32>',
  'aggregateHierarchyPrunedNodeCount:atomic<u32>',
  'aggregateHierarchySourceCount:atomic<u32>',
  'aggregateSummaryLineageMaterialMismatchCount:atomic<u32>',
  // This is deliberately narrower than candidateVisitCount: aggregate active
  // prefixes account dormant members without loading their endpoint metadata.
  'projectedPeerVisitCount:atomic<u32>'
]);

export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_STAGE;

export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_FAILURE;

const GPU_BUFFER_USAGE = {
  COPY_SRC: globalThis.GPUBufferUsage?.COPY_SRC ?? 4,
  COPY_DST: globalThis.GPUBufferUsage?.COPY_DST ?? 8,
  STORAGE: globalThis.GPUBufferUsage?.STORAGE ?? 128,
  UNIFORM: globalThis.GPUBufferUsage?.UNIFORM ?? 64,
  INDIRECT: globalThis.GPUBufferUsage?.INDIRECT ?? 256
};

const EXPECTATION_BYTES = 112;
const MECHANICAL_PARAMS_BYTES = 128;
const MECHANICAL_SUPPORT_HEADER_WORDS = 6;
const MECHANICAL_SUPPORT_ROW_WORDS = 8;
const MECHANICAL_SUPPORT_TRAILER_WORDS = 1;
const MECHANICAL_SUPPORT_MAX_DIAMETER_WORD = 0;
const MECHANICAL_SUPPORT_MAX_DISPLACEMENT_WORD = 1;
const MECHANICAL_SUPPORT_MAX_WALL_PROJECTION_WORD = 2;
const MECHANICAL_SUPPORT_AGGREGATE_PREFLIGHT_WORD = 3;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD = 4;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD = 5;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET = 0xffff_ffff;
const MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTED = 1;
const WORKGROUP_SIZE = 64;
const MECHANICAL_APPLY_ALL_LEVELS = -0x8000_0000;
export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_MAGIC;
export const SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION =
  SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_VERSION;
const MECHANICAL_PROPOSAL_HEADER_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const MECHANICAL_PROPOSAL_ROW_BYTES =
  SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const mechanicalProposalPools = new WeakMap();
const liveMechanicalProposalArtifacts = new WeakSet();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteVector3(value, fallback = [0, 0, 0]) {
  return [0, 1, 2].map((axis) => finiteNumber(value?.[axis], fallback[axis]));
}

function vectorScale(vector, scale) {
  return vector.map((value) => value * scale);
}

function vectorSubtract(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function vectorAdd(left, right) {
  return left.map((value, axis) => value + right[axis]);
}

function vectorLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function dot3(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function schroederSpatialMechanicalCoincidenceNormal(selfIndex, otherIndex) {
  const self = Math.max(0, Math.trunc(finiteNumber(selfIndex, 0))) >>> 0;
  const peer = Math.max(0, Math.trunc(finiteNumber(otherIndex, 0))) >>> 0;
  const lowIndex = Math.min(self, peer) >>> 0;
  let hash = (
    Math.imul(lowIndex, 2_654_435_761) + 0x9e37_79b9
  ) >>> 0;
  hash = Math.imul((hash ^ (hash >>> 16)) >>> 0, 2_246_822_519) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0;
  const raw = [
    (hash & 1023) / 511.5 - 1,
    ((hash >>> 10) & 1023) / 511.5 - 1,
    ((hash >>> 20) & 1023) / 511.5 - 1
  ];
  const rawLength = vectorLength(raw);
  const normal = rawLength > 1e-4
    ? vectorScale(raw, 1 / Math.max(rawLength, 1e-6))
    : [0, 1, 0];
  return vectorScale(normal, self > peer ? 1 : -1);
}

/**
 * Small manufactured-pair policy oracle. This is deliberately not a
 * production neighbor fallback; it mirrors the per-pair WGSL eligibility
 * policy so focused tests can prove domain/material routing explicitly.
 */
export function classifySchroederSpatialMechanicalPair({
  phaseClass,
  otherPhaseClass,
  materialId,
  otherMaterialId,
  domainId = 0,
  otherDomainId = 0,
  identityEnabled = true
} = {}) {
  const selfClass = Math.trunc(finiteNumber(phaseClass, 0));
  const peerClass = Math.trunc(finiteNumber(otherPhaseClass, 0));
  if (selfClass === 0 || peerClass === 0) {
    return Object.freeze({ handled: false, reason: 'gas-or-eos-disabled' });
  }
  const sameMaterial = Math.abs(
    finiteNumber(materialId, 0) - finiteNumber(otherMaterialId, 0)
  ) < 0.5;
  const selfDomain = Math.max(0, Math.trunc(finiteNumber(domainId, 0)));
  const peerDomain = Math.max(0, Math.trunc(finiteNumber(otherDomainId, 0)));
  const sameBodySolid = selfClass === 2
    && peerClass === 2
    && sameMaterial
    && (
      identityEnabled !== true
      || selfDomain === 0
      || peerDomain === 0
      || selfDomain === peerDomain
    );
  if (sameBodySolid) {
    return Object.freeze({ handled: false, reason: 'same-body-solid' });
  }
  return Object.freeze({
    handled: true,
    reason: sameMaterial ? 'cross-domain-or-condensed-phase' : 'cross-material-interface'
  });
}

/**
 * Return whether a handled condensed pair is a true unilateral interface
 * constraint. Cross-material interfaces and distinct solid bodies require a
 * positional non-penetration barrier even when optional liquid-particle
 * separation is disabled. Their reciprocal velocity constraint belongs to
 * the material/domain mechanics-field solve; applying another impulse from
 * this stale pre-integration particle view would double the response.
 * Same-material liquid/liquid carriers keep the softer excluded-volume policy
 * so ordinary flow is not turned into artificial surface tension. A
 * solid/liquid pair that reached this classifier is from different conserved
 * phase lineages (same-lineage companions are rejected while the graph is
 * built), so it is a real material interface and needs the same unilateral
 * non-penetration constraint as an unlike-material condensed pair.
 */
export function schroederSpatialMechanicalPairRequiresUnilateralContact({
  phaseClass,
  otherPhaseClass,
  materialId,
  otherMaterialId,
  domainId = 0,
  otherDomainId = 0,
  identityEnabled = true
} = {}) {
  const selfClass = Math.trunc(finiteNumber(phaseClass, 0));
  const peerClass = Math.trunc(finiteNumber(otherPhaseClass, 0));
  if (selfClass === 0 || peerClass === 0) return false;
  const sameMaterial = Math.abs(
    finiteNumber(materialId, 0) - finiteNumber(otherMaterialId, 0)
  ) < 0.5;
  if (!sameMaterial) return true;
  const solidLiquidInterface = (selfClass === 2 && peerClass === 1)
    || (selfClass === 1 && peerClass === 2);
  if (solidLiquidInterface) return true;
  if (selfClass !== 2 || peerClass !== 2 || identityEnabled !== true) {
    return false;
  }
  const selfDomain = Math.max(0, Math.trunc(finiteNumber(domainId, 0)));
  const peerDomain = Math.max(0, Math.trunc(finiteNumber(otherDomainId, 0)));
  return selfDomain > 0 && peerDomain > 0 && selfDomain !== peerDomain;
}

/** Return whether two phase-lane indices represent one conserved carrier. */
export function schroederSpatialMechanicalPairSharesPhaseLineage({
  selfIndex,
  otherIndex,
  lineageCapacity = 0,
  phaseLaneCount = 0
} = {}) {
  const self = Math.trunc(finiteNumber(selfIndex, -1));
  const peer = Math.trunc(finiteNumber(otherIndex, -1));
  const capacity = Math.trunc(finiteNumber(lineageCapacity, 0));
  const laneCount = Math.trunc(finiteNumber(phaseLaneCount, 0));
  return self >= 0
    && peer >= 0
    && self !== peer
    && capacity > 0
    && laneCount > 1
    && self < capacity * laneCount
    && peer < capacity * laneCount
    && self % capacity === peer % capacity;
}

/** Small manufactured-pair oracle for the symmetric WGSL pair contribution. */
export function evaluateSchroederSpatialMechanicalPairProposal({
  position = [0, 0, 0],
  otherPosition = [0, 0, 0],
  epochPosition = position,
  otherEpochPosition = otherPosition,
  velocity = [0, 0, 0],
  otherVelocity = [0, 0, 0],
  massKg = 1,
  otherMassKg = 1,
  restVolumeM3 = 1,
  otherRestVolumeM3 = 1,
  relaxation = 0.35,
  normalVelocityDamping = 0.25,
  selfIndex = 0,
  otherIndex = 1,
  phaseLineageCapacity = 0,
  phaseLaneCount = 0,
  ...pairPolicy
} = {}) {
  const selfMass = Math.max(finiteNumber(massKg, 0), 0);
  const peerMass = Math.max(finiteNumber(otherMassKg, 0), 0);
  const selfVolume = Math.max(finiteNumber(restVolumeM3, 0), 0);
  const peerVolume = Math.max(finiteNumber(otherRestVolumeM3, 0), 0);
  const bothMechanicallyActive = selfMass > 0
    && peerMass > 0
    && selfVolume > 0
    && peerVolume > 0;
  const sharedPhaseLineage = schroederSpatialMechanicalPairSharesPhaseLineage({
    selfIndex,
    otherIndex,
    lineageCapacity: phaseLineageCapacity,
    phaseLaneCount
  });
  const sharedLineageMaterialMismatch = sharedPhaseLineage
    && bothMechanicallyActive
    && Math.abs(
    finiteNumber(pairPolicy.materialId, 0)
      - finiteNumber(pairPolicy.otherMaterialId, 0)
  ) >= 0.5;
  const policy = sharedPhaseLineage
    ? Object.freeze({
        handled: false,
        reason: sharedLineageMaterialMismatch
          ? 'invalid-phase-lineage-material-mismatch'
          : 'same-phase-carrier-lineage',
        invalid: sharedLineageMaterialMismatch
      })
    : classifySchroederSpatialMechanicalPair(pairPolicy);
  const unilateralContact = policy.handled
    && schroederSpatialMechanicalPairRequiresUnilateralContact(pairPolicy);
  const zero = Object.freeze([0, 0, 0]);
  if (!policy.handled || !(selfMass > 0) || !(peerMass > 0)
      || !(selfVolume > 0) || !(peerVolume > 0)) {
    return Object.freeze({
      ...policy,
      unilateralContact,
      overlapM: 0,
      positionDeltaM: zero,
      otherPositionDeltaM: zero,
      velocityDeltaMPerS: zero,
      otherVelocityDeltaMPerS: zero
    });
  }
  const selfPosition = finiteVector3(position);
  const peerPosition = finiteVector3(otherPosition);
  const delta = vectorSubtract(selfPosition, peerPosition);
  const distanceM = vectorLength(delta);
  const selfDiameterM = Math.cbrt(Math.max(selfVolume, 1e-18));
  const peerDiameterM = Math.cbrt(Math.max(peerVolume, 1e-18));
  const restDistanceM = 0.5 * (selfDiameterM + peerDiameterM);
  const selfEpochPosition = finiteVector3(epochPosition);
  const peerEpochPosition = finiteVector3(otherEpochPosition);
  const epochDelta = vectorSubtract(selfEpochPosition, peerEpochPosition);
  const sweepDelta = vectorSubtract(delta, epochDelta);
  const sweepLengthSq = dot3(sweepDelta, sweepDelta);
  const closestT = sweepLengthSq > 1e-18
    ? Math.min(1, Math.max(0, -dot3(epochDelta, sweepDelta) / sweepLengthSq))
    : 0;
  const closestDelta = vectorAdd(
    epochDelta,
    vectorScale(sweepDelta, closestT)
  );
  const sweptDistanceM = vectorLength(closestDelta);
  const sweptContact = unilateralContact && sweptDistanceM < restDistanceM;
  const epochDistanceM = vectorLength(epochDelta);
  const sweepB = dot3(epochDelta, sweepDelta);
  const sweepC = dot3(epochDelta, epochDelta)
    - restDistanceM * restDistanceM;
  const sweepDiscriminant = sweepB * sweepB - sweepLengthSq * sweepC;
  let sweptImpactT = null;
  let sweptImpactNormal = null;
  if (
    sweptContact
    && sweepLengthSq > 1e-18
    && sweepC >= -1e-12 * Math.max(restDistanceM * restDistanceM, 1)
    && sweepDiscriminant >= 0
  ) {
    const entryDenominator = -sweepB + Math.sqrt(sweepDiscriminant);
    const candidateT = entryDenominator > 1e-18
      ? sweepC / entryDenominator
      : Number.NaN;
    if (Number.isFinite(candidateT) && candidateT >= -1e-12 && candidateT <= 1 + 1e-12) {
      sweptImpactT = Math.min(1, Math.max(0, candidateT));
      const impactDelta = vectorAdd(
        epochDelta,
        vectorScale(sweepDelta, sweptImpactT)
      );
      const impactDistanceM = vectorLength(impactDelta);
      if (impactDistanceM > 1e-9) {
        sweptImpactNormal = vectorScale(impactDelta, 1 / impactDistanceM);
      } else {
        sweptImpactT = null;
      }
    }
  }
  let overlapM = Math.max(0, restDistanceM - distanceM);
  if (!(overlapM > 0) && !sweptContact) {
    return Object.freeze({
      ...policy,
      unilateralContact,
      handled: false,
      reason: 'outside-pair-support',
      restDistanceM,
      distanceM,
      sweptDistanceM,
      sweptContact: false,
      cohortInverted: false,
      overlapM: 0,
      positionDeltaM: zero,
      otherPositionDeltaM: zero,
      velocityDeltaMPerS: zero,
      otherVelocityDeltaMPerS: zero
    });
  }
  const cohortInverted = sweptContact && dot3(epochDelta, delta) <= 0;
  let normal;
  if (sweptImpactNormal) {
    // Project against the first time-of-impact sphere normal. Using the epoch
    // axis after a non-collinear cohort crossing creates a noncentral impulse
    // and changes orbital angular momentum. The impact normal preserves the
    // tangential remainder of the swept trajectory while restoring support.
    normal = sweptImpactNormal;
    overlapM = Math.max(0, restDistanceM - dot3(delta, normal));
  } else if (cohortInverted && epochDistanceM > 1e-9) {
    normal = vectorScale(epochDelta, 1 / epochDistanceM);
    overlapM = Math.max(0, restDistanceM - dot3(delta, normal));
  } else if (distanceM > 1e-9) {
    normal = vectorScale(delta, 1 / distanceM);
  } else if (sweptDistanceM > 1e-9) {
    normal = vectorScale(closestDelta, 1 / sweptDistanceM);
  } else {
    normal = schroederSpatialMechanicalCoincidenceNormal(selfIndex, otherIndex);
  }
  const inverseMass = 1 / Math.max(selfMass, 1e-30);
  const otherInverseMass = 1 / Math.max(peerMass, 1e-30);
  const inverseMassSum = inverseMass + otherInverseMass;
  const share = inverseMass / inverseMassSum;
  const otherShare = otherInverseMass / inverseMassSum;
  // Contact is a relative constraint. Split its complete residual by inverse
  // mass so independently evaluated endpoint rows preserve center of mass.
  // Depending on absolute lab-frame displacement would change the response
  // under a common translation and could canonize the wrong swept cohort.
  const positionShare = share;
  const otherPositionShare = otherShare;
  // A unilateral interface is a constraint, not optional liquid separation:
  // project the complete pair overlap. Its reciprocal velocity response is
  // owned by the mechanics-field solve, so this pre-integration particle
  // proposal is evaluated on the actual post-G2P state, so it removes only
  // residual closing motion left by the field solve. Softer
  // same-material liquid separation continues to honor the user controls.
  const alpha = unilateralContact
    ? 1
    : Math.max(0, finiteNumber(relaxation, 0));
  const beta = unilateralContact
    ? 1
    : Math.min(1, Math.max(0, finiteNumber(normalVelocityDamping, 0)));
  const positionDeltaM = vectorScale(normal, alpha * positionShare * overlapM);
  const otherPositionDeltaM = vectorScale(normal, -alpha * otherPositionShare * overlapM);
  const approachMPerS = dot3(
    vectorSubtract(finiteVector3(velocity), finiteVector3(otherVelocity)),
    normal
  );
  // The relative normal velocity is Galilean invariant. Inverse-mass endpoint
  // weights make its dissipative projection conserve linear momentum.
  const velocityShare = share;
  const otherVelocityShare = otherShare;
  const dampingSpeedMPerS = approachMPerS < 0 ? -beta * approachMPerS : 0;
  const velocityDeltaMPerS = vectorScale(
    normal,
    dampingSpeedMPerS * velocityShare
  );
  const otherVelocityDeltaMPerS = vectorScale(
    normal,
    -dampingSpeedMPerS * otherVelocityShare
  );
  return Object.freeze({
    ...policy,
    unilateralContact,
    handled: true,
    reason: 'overlapping-condensed-pair',
    restDistanceM,
    distanceM,
    sweptDistanceM,
    sweptContact,
    sweptImpactT,
    cohortInverted,
    overlapM,
    normal: Object.freeze(normal),
    positionDeltaM: Object.freeze(positionDeltaM),
    otherPositionDeltaM: Object.freeze(otherPositionDeltaM),
    velocityDeltaMPerS: Object.freeze(velocityDeltaMPerS),
    otherVelocityDeltaMPerS: Object.freeze(otherVelocityDeltaMPerS)
  });
}

function exactU32(value, label, { positive = false } = {}) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < (positive ? 1 : 0)
    || value > 0xffff_ffff
  ) {
    throw new RangeError(`${label} must be an exact ${positive ? 'positive ' : ''}u32`);
  }
  return value;
}

function exactI32(value, label) {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < -0x8000_0000
    || value > 0x7fff_ffff
  ) {
    throw new RangeError(`${label} must be an exact i32`);
  }
  return value;
}

function requireBuffer(device, buffer, label) {
  if (!buffer || !webGpuBufferMatchesDevice(buffer, device)) {
    throw new TypeError(`${label} must be a live buffer on the canonical generation device`);
  }
  return buffer;
}

function resolveMechanicalSpatialAuthority({
  device,
  generation,
  sphParticleUpload,
  mlsMpmParticleUpload,
  particleCount
}) {
  if (!device?.createBuffer || !device.queue?.writeBuffer) {
    throw new TypeError('canonical mechanical proposals require a WebGPU-like device');
  }
  const execution = generation?.execution || null;
  const source = generation?.source || null;
  const runtime = generation?.runtime || null;
  if (
    generation?.selected !== true
    || generation?.ready !== true
    || generation?.releaseScheduled === true
    || generation?.directoryBuildCount !== 1
    || generation?.privateLookupBuildCount !== 0
    || execution?.submitPerformed !== true
    || execution?.released === true
    || execution?.generationId == null
    || source?.ready !== true
    || source?.sourceCount !== particleCount
    || source?.exactNearQueryProfile?.ready !== true
    || execution?.exactNearQueryProfile?.ready !== true
    || execution?.queryGeometryEvidence !== execution.exactNearQueryProfile
    || runtime !== execution?.ownerRuntime
    || execution?.deviceId !== webGpuDeviceId(device)
  ) {
    throw new TypeError(
      'canonical mechanical proposals require one live submitted exact-near generation'
    );
  }
  if (
    typeof runtime?.ownsExecution === 'function'
    && runtime.ownsExecution(execution) !== true
  ) {
    throw new TypeError('canonical mechanical proposal generation is not owned by its runtime');
  }
  if (
    typeof runtime?.isExecutionSubmitted === 'function'
    && runtime.isExecutionSubmitted(execution) !== true
  ) {
    throw new TypeError('canonical mechanical proposal generation has no submitted-work proof');
  }
  const stateBuffer = requireBuffer(
    device,
    sphParticleUpload?.stateBuffer,
    'sphParticleUpload.stateBuffer'
  );
  const thermoBuffer = requireBuffer(
    device,
    sphParticleUpload?.thermoBuffer,
    'sphParticleUpload.thermoBuffer'
  );
  const mechanicsBuffer = requireBuffer(
    device,
    mlsMpmParticleUpload?.mechanicsBuffer,
    'mlsMpmParticleUpload.mechanicsBuffer'
  );
  const directoryBuffer = requireBuffer(
    device,
    execution.directoryBuffer,
    'generation.execution.directoryBuffer'
  );
  const identityBuffer = sphParticleUpload?.identityBuffer
    ? requireBuffer(device, sphParticleUpload.identityBuffer, 'sphParticleUpload.identityBuffer')
    : null;
  return {
    generation,
    execution,
    source,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    identityBuffer,
    directoryBuffer
  };
}

export function createSchroederSpatialExactNearExpectationArray({
  generation,
  supportProfileId,
  derivationEnabled = true
} = {}) {
  const execution = generation?.execution || null;
  const source = generation?.source || null;
  const profile = execution?.exactNearQueryProfile || source?.exactNearQueryProfile || null;
  const layout = execution?.layout || null;
  if (!execution || !source || !profile || !layout) {
    throw new TypeError('exact-near expectation requires a complete generation execution');
  }
  const buffer = new ArrayBuffer(EXPECTATION_BYTES);
  const view = new DataView(buffer);
  const u32 = (offset, value, label, options) => {
    view.setUint32(offset, exactU32(value, label, options), true);
  };
  u32(0, source.sourceCount, 'source.sourceCount', { positive: true });
  u32(4, derivationEnabled ? 1 : 0, 'derivationEnabled');
  u32(8, supportProfileId, 'supportProfileId', { positive: true });
  u32(12, profile.chartId, 'profile.chartId');
  u32(16, profile.levelCount, 'profile.levelCount', { positive: true });
  u32(20, execution.generationId, 'execution.generationId', { positive: true });
  u32(24, execution.deviceOrdinal, 'execution.deviceOrdinal');
  u32(28, execution.laneOrdinal, 'execution.laneOrdinal');
  u32(32, execution.leaseToken, 'execution.leaseToken', { positive: true });
  u32(36, execution.sourceFamilyId, 'execution.sourceFamilyId', { positive: true });
  u32(40, execution.storageGeneration, 'execution.storageGeneration', { positive: true });
  u32(44, execution.physicsTick, 'execution.physicsTick');
  u32(48, execution.physicsSubstep, 'execution.physicsSubstep');
  u32(52, execution.positionEpoch, 'execution.positionEpoch');
  u32(56, execution.topologyEpoch, 'execution.topologyEpoch');
  u32(60, execution.chartEpoch, 'execution.chartEpoch');
  u32(64, execution.levelEpoch, 'execution.levelEpoch');
  u32(68, execution.supportEpoch, 'execution.supportEpoch');
  view.setInt32(72, exactI32(profile.minLevel, 'profile.minLevel'), true);
  view.setFloat32(76, finiteNumber(profile.baseGridSpacingM, 0), true);
  u32(80, layout.cellKeysOffsetWords, 'layout.cellKeysOffsetWords');
  u32(84, layout.cellOffsetsOffsetWords, 'layout.cellOffsetsOffsetWords');
  u32(88, layout.cellMembersOffsetWords, 'layout.cellMembersOffsetWords');
  u32(92, layout.particleToCellOffsetWords, 'layout.particleToCellOffsetWords');
  u32(96, layout.wordLength, 'layout.wordLength', { positive: true });
  u32(100, execution.sourceCapacity, 'execution.sourceCapacity', { positive: true });
  u32(104, execution.cellCapacity, 'execution.cellCapacity', { positive: true });
  return buffer;
}

function createMechanicalParamsArray({
  particleCount,
  directedPairCapacity,
  relaxation,
  normalVelocityDamping,
  gridSpacingM,
  boxDimsM,
  identityEnabled,
  selectedLevel,
  phaseLineageCapacity,
  phaseLaneCount,
  retainCompleteAuthenticatedCellCliques,
  aggregateHierarchyEnabled,
  activeRankViewEnabled,
  aggregateSourceRowLayoutId,
  aggregateCapacityWords,
  execution
}) {
  const dims = Array.isArray(boxDimsM) ? boxDimsM : [5, 5, 5];
  const buffer = new ArrayBuffer(MECHANICAL_PARAMS_BYTES);
  const view = new DataView(buffer);
  view.setUint32(0, exactU32(particleCount, 'particleCount', { positive: true }), true);
  view.setFloat32(4, Math.max(0, finiteNumber(relaxation, 0)), true);
  view.setFloat32(8, Math.min(1, Math.max(0, finiteNumber(normalVelocityDamping, 0))), true);
  view.setFloat32(12, Math.max(0, finiteNumber(gridSpacingM, 0)), true);
  view.setFloat32(16, finiteNumber(dims[0], 5), true);
  view.setFloat32(20, finiteNumber(dims[1], 5), true);
  view.setFloat32(24, finiteNumber(dims[2], 5), true);
  view.setUint32(28, identityEnabled ? 1 : 0, true);
  view.setUint32(32, SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1, true);
  view.setUint32(36, SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1, true);
  view.setUint32(40, SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1, true);
  view.setInt32(44, selectedLevel == null
    ? MECHANICAL_APPLY_ALL_LEVELS
    : exactI32(selectedLevel, 'selectedLevel'), true);
  view.setUint32(48, exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  }), true);
  view.setUint32(52, exactU32(execution?.supportEpoch, 'execution.supportEpoch'), true);
  view.setUint32(56, exactU32(execution?.positionEpoch, 'execution.positionEpoch'), true);
  view.setUint32(60, exactU32(execution?.topologyEpoch, 'execution.topologyEpoch'), true);
  view.setUint32(64, exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  ), true);
  view.setUint32(68, exactU32(execution?.physicsTick, 'execution.physicsTick'), true);
  view.setUint32(72, exactU32(execution?.physicsSubstep, 'execution.physicsSubstep'), true);
  view.setUint32(76, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC, true);
  view.setUint32(80, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION, true);
  view.setUint32(84, SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT, true);
  view.setUint32(88, SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.length, true);
  view.setUint32(92, SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS, true);
  view.setUint32(96, exactU32(
    Math.max(0, Math.trunc(finiteNumber(phaseLineageCapacity, 0))),
    'phaseLineageCapacity'
  ), true);
  view.setUint32(100, exactU32(
    Math.max(0, Math.trunc(finiteNumber(phaseLaneCount, 0))),
    'phaseLaneCount'
  ), true);
  view.setUint32(104, exactU32(
    directedPairCapacity,
    'directedPairCapacity',
    { positive: true }
  ), true);
  view.setUint32(
    108,
    SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    true
  );
  view.setUint32(112, retainCompleteAuthenticatedCellCliques ? 1 : 0, true);
  view.setUint32(
    116,
    aggregateHierarchyEnabled ? 1 : (activeRankViewEnabled ? 2 : 0),
    true
  );
  view.setUint32(120, exactU32(
    Math.max(0, Math.trunc(finiteNumber(aggregateSourceRowLayoutId, 0))),
    'aggregateSourceRowLayoutId'
  ), true);
  view.setUint32(124, exactU32(
    Math.max(0, Math.trunc(finiteNumber(aggregateCapacityWords, 0))),
    'aggregateCapacityWords'
  ), true);
  return buffer;
}

function createMechanicalProposalHeader(execution, particleCount) {
  const words = new Uint32Array(SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS);
  words[0] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MAGIC;
  words[1] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_VERSION;
  words[2] = exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  });
  words[3] = exactU32(execution?.supportEpoch, 'execution.supportEpoch');
  words[4] = exactU32(particleCount, 'particleCount', { positive: true });
  words[5] = SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS;
  words[6] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_PRESSURE_CONTACT_V1;
  words[7] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_SEPARATION_V1;
  words[8] = SCHROEDER_SPATIAL_SUPPORT_PROFILE_MATERIAL_INTERFACE_LOCAL_V1;
  words[9] = exactU32(execution?.positionEpoch, 'execution.positionEpoch');
  words[10] = exactU32(execution?.topologyEpoch, 'execution.topologyEpoch');
  words[11] = exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  );
  words[12] = exactU32(execution?.physicsTick, 'execution.physicsTick');
  words[13] = exactU32(execution?.physicsSubstep, 'execution.physicsSubstep');
  words[14] = SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT;
  words[15] = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.length;
  return words;
}

function createMechanicalPairGraphEvidenceHeader({
  execution,
  selectedLevel,
  particleCount,
  particleCapacity,
  directedPairCapacity
}) {
  const buffer = new ArrayBuffer(
    SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS * Uint32Array.BYTES_PER_ELEMENT
  );
  const view = new DataView(buffer);
  view.setUint32(0, SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC, true);
  view.setUint32(4, SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, exactU32(execution?.generationId, 'execution.generationId', {
    positive: true
  }), true);
  view.setUint32(16, exactU32(
    execution?.storageGeneration,
    'execution.storageGeneration',
    { positive: true }
  ), true);
  view.setUint32(20, exactU32(execution?.physicsTick, 'execution.physicsTick'), true);
  view.setUint32(
    24,
    exactU32(execution?.physicsSubstep, 'execution.physicsSubstep'),
    true
  );
  view.setUint32(28, exactU32(execution?.positionEpoch, 'execution.positionEpoch'), true);
  view.setUint32(32, exactU32(execution?.topologyEpoch, 'execution.topologyEpoch'), true);
  view.setUint32(36, exactU32(execution?.supportEpoch, 'execution.supportEpoch'), true);
  view.setInt32(40, exactI32(selectedLevel, 'selectedLevel'), true);
  view.setUint32(44, exactU32(particleCount, 'particleCount', { positive: true }), true);
  view.setUint32(
    48,
    exactU32(particleCapacity, 'particleCapacity', { positive: true }),
    true
  );
  view.setUint32(
    52,
    exactU32(directedPairCapacity, 'directedPairCapacity', { positive: true }),
    true
  );
  return buffer;
}

const exactNearTraversalWgsl = createSchroederSpatialExactNearTraversalV1Wgsl({
  directoryBindingName: 'spatial_directory'
});

const mechanicalContactGraphParamsWgsl = /* wgsl */ `
struct MechanicalProposalParams {
  particle_count: u32,
  relaxation: f32,
  normal_velocity_damping: f32,
  grid_spacing_m: f32,
  box_dims_m: vec3<f32>,
  identity_enabled: u32,
  contact_support_profile_id: u32,
  separation_support_profile_id: u32,
  interface_support_profile_id: u32,
  apply_selected_level: i32,
  generation_id: u32,
  support_epoch: u32,
  position_epoch: u32,
  topology_epoch: u32,
  storage_generation: u32,
  physics_tick: u32,
  physics_substep: u32,
  proposal_magic: u32,
  proposal_version: u32,
  traversal_count: u32,
  consumer_count: u32,
  proposal_row_words: u32,
  phase_lineage_capacity: u32,
  phase_lane_count: u32,
  directed_pair_capacity: u32,
  solver_iteration_count: u32,
  retain_complete_authenticated_cell_cliques: u32,
  aggregate_hierarchy_enabled: u32,
  aggregate_source_row_layout_id: u32,
  aggregate_capacity_words: u32,
};
`;

export const schroederSpatialMechanicalProposalWgsl = /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> current_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_identity: array<u32>;
@group(0) @binding(4) var<storage, read> spatial_directory: array<u32>;
@group(0) @binding(5) var<storage, read> spatial_source_rows: array<f32>;
@group(0) @binding(6) var<storage, read_write> source_counts: array<u32>;
@group(0) @binding(7) var<storage, read_write> append_records: array<u32>;
@group(0) @binding(8) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(9) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(10) var<storage, read_write> global_support_bits: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> spatial_expectation: SchroederSpatialExactNearExpectationV1;
@group(0) @binding(12) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(13) var<storage, read> spatial_aggregate_view: array<u32>;

${exactNearTraversalWgsl}

const MECHANICAL_AGGREGATE_MAGIC: u32 = 0x53414731u;
const MECHANICAL_AGGREGATE_VERSION: u32 = 2u;
const MECHANICAL_AGGREGATE_HEADER_WORDS: u32 = 112u;
const MECHANICAL_AGGREGATE_RECORD_WORDS: u32 = 44u;
const MECHANICAL_AGGREGATE_TREE_ARITY: u32 = 2u;
const MECHANICAL_AGGREGATE_PREFIX_BITS: u32 = 160u;
const MECHANICAL_AGGREGATE_TOPOLOGY_MODE: u32 = 2u;
const MECHANICAL_AGGREGATE_STATUS_READY: u32 = 1u;
const MECHANICAL_AGGREGATE_STATUS_ADMITTED: u32 = 2u;
const MECHANICAL_AGGREGATE_STATUS_TRAVERSAL_READY: u32 = 256u;
const MECHANICAL_AGGREGATE_STATUS_EXACT: u32 = 259u;
const MECHANICAL_AGGREGATE_RECORD_VALID: u32 = 1u;
const MECHANICAL_AGGREGATE_RECORD_LEAF: u32 = 2u;
const MECHANICAL_AGGREGATE_RECORD_INTERNAL: u32 = 4u;
const MECHANICAL_AGGREGATE_RECORD_ROOT: u32 = 8u;
const MECHANICAL_AGGREGATE_RECORD_AUTHENTICATED: u32 = 64u;
const MECHANICAL_AGGREGATE_RECORD_DOMAIN_SUMMARY_EXACT: u32 = 128u;
const MECHANICAL_AGGREGATE_HIERARCHY_COMPILED: bool = true;
const MECHANICAL_AGGREGATE_INVALID_U32: u32 = 0xffffffffu;
const MECHANICAL_AGGREGATE_PREFLIGHT_FAILED: u32 = 0x80000000u;
const MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER: u32 = 8u;
const MECHANICAL_ACTIVE_MEMBER_MAGIC: u32 = 0x53414d31u;
const MECHANICAL_ACTIVE_MEMBER_VERSION: u32 = 1u;
const MECHANICAL_ACTIVE_MEMBER_STATUS_EXACT: u32 = 3u;
const MECHANICAL_ACTIVE_MEMBER_CONSTRUCTION_CELL_PREFIX: u32 = 1u;
const MECHANICAL_PROJECTION_MODE_NONE: u32 = 0u;
const MECHANICAL_PROJECTION_MODE_AGGREGATE: u32 = 1u;
const MECHANICAL_PROJECTION_MODE_ACTIVE_RANK: u32 = 2u;
const MECHANICAL_ACTIVE_RANK_VIEW_COMPILED: bool = false;
const MECHANICAL_ACTIVE_RANK_VIEW_MAGIC: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAGIC >>> 0}u;
const MECHANICAL_ACTIVE_RANK_VIEW_VERSION: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_VERSION}u;
const MECHANICAL_ACTIVE_RANK_VIEW_STATUS_EXACT: u32 = ${
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_READY
  | SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_STATUS_ADMITTED
}u;
const MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS}u;
const MECHANICAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT}u;
const MECHANICAL_ACTIVE_RANK_VIEW_RANKS_PER_LANE: u32 = ${SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_RANKS_PER_LANE}u;
const MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_BASIS: u32 = 2166136261u;
const MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_PRIME: u32 = 16777619u;

struct MechanicalActiveRankLookup {
  source_rank: u32,
  source_index: u32,
  admitted: u32,
};

struct MechanicalActiveRankRange {
  begin: u32,
  end: u32,
  admitted: u32,
};

fn mechanical_active_rank_fold(value: u32, word: u32) -> u32 {
  return (value ^ word) * MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_PRIME;
}

fn mechanical_active_rank_replay_guard_token() -> u32 {
  var value = mechanical_active_rank_fold(
    MECHANICAL_ACTIVE_RANK_VIEW_FINGERPRINT_BASIS,
    spatial_directory[3u]
  );
  value = mechanical_active_rank_fold(value, spatial_directory[7u]);
  value = mechanical_active_rank_fold(value, spatial_directory[8u]);
  value = mechanical_active_rank_fold(value, spatial_directory[9u]);
  value = mechanical_active_rank_fold(value, spatial_directory[10u]);
  value = mechanical_active_rank_fold(value, spatial_directory[11u]);
  value = mechanical_active_rank_fold(value, spatial_directory[12u]);
  value = mechanical_active_rank_fold(value, spatial_directory[13u]);
  value = mechanical_active_rank_fold(value, spatial_directory[14u]);
  value = mechanical_active_rank_fold(value, spatial_directory[15u]);
  return mechanical_active_rank_fold(value, spatial_directory[35u]);
}

fn mechanical_active_rank_header_fingerprint(
  replay_token: u32,
  active_count: u32,
  dormant_count: u32,
  prefix_offset: u32,
  prefix_capacity: u32,
  active_ranks_offset: u32,
  active_rank_capacity: u32,
  active_source_indices_offset: u32,
  active_source_index_capacity: u32
) -> u32 {
  var value = mechanical_active_rank_fold(replay_token, prefix_offset);
  value = mechanical_active_rank_fold(value, prefix_capacity);
  value = mechanical_active_rank_fold(value, active_ranks_offset);
  value = mechanical_active_rank_fold(value, active_rank_capacity);
  value = mechanical_active_rank_fold(value, active_source_indices_offset);
  value = mechanical_active_rank_fold(value, active_source_index_capacity);
  value = mechanical_active_rank_fold(value, active_count);
  value = mechanical_active_rank_fold(value, dormant_count);
  return mechanical_active_rank_fold(value, 1u);
}

fn mechanical_active_rank_view_admitted() -> bool {
  if (
    !MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    || mechanical_params.aggregate_hierarchy_enabled
      != MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
    || !ss_exact_near_directory_admitted(spatial_expectation)
    || arrayLength(&spatial_aggregate_view)
      < MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS
  ) { return false; }
  let source_count = spatial_expectation.source_count;
  let source_capacity = spatial_directory[17u];
  let prefix_offset = MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS;
  let prefix_capacity = source_capacity + 1u;
  let active_ranks_offset = prefix_offset + prefix_capacity;
  let active_source_indices_offset = active_ranks_offset + source_capacity;
  let physical_capacity = active_source_indices_offset + source_capacity;
  let active_count = spatial_aggregate_view[26u];
  let dormant_count = spatial_aggregate_view[27u];
  let replay_token = mechanical_active_rank_replay_guard_token();
  let dispatch_x = max(1u, (active_count + 63u) / 64u);
  return source_capacity <= MECHANICAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
    && physical_capacity <= arrayLength(&spatial_aggregate_view)
    && spatial_aggregate_view[0u] == MECHANICAL_ACTIVE_RANK_VIEW_MAGIC
    && spatial_aggregate_view[1u] == MECHANICAL_ACTIVE_RANK_VIEW_VERSION
    && spatial_aggregate_view[2u] == MECHANICAL_ACTIVE_RANK_VIEW_STATUS_EXACT
    && spatial_aggregate_view[3u] == spatial_directory[3u]
    && spatial_aggregate_view[4u] == spatial_directory[4u]
    && spatial_aggregate_view[5u] == spatial_directory[5u]
    && spatial_aggregate_view[6u] == spatial_directory[6u]
    && spatial_aggregate_view[7u] == spatial_directory[7u]
    && spatial_aggregate_view[8u] == spatial_directory[8u]
    && spatial_aggregate_view[9u] == spatial_directory[9u]
    && spatial_aggregate_view[10u] == spatial_directory[10u]
    && spatial_aggregate_view[11u] == spatial_directory[11u]
    && spatial_aggregate_view[12u] == spatial_directory[12u]
    && spatial_aggregate_view[13u] == spatial_directory[13u]
    && spatial_aggregate_view[14u] == spatial_directory[14u]
    && spatial_aggregate_view[15u] == spatial_directory[15u]
    && spatial_aggregate_view[16u] == source_count
    && spatial_aggregate_view[17u] == source_capacity
    && spatial_aggregate_view[18u] == spatial_directory[18u]
    && spatial_aggregate_view[19u] == spatial_directory[19u]
    && spatial_aggregate_view[20u] == MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS
    && spatial_aggregate_view[21u] == prefix_offset
    && spatial_aggregate_view[22u] == prefix_capacity
    && spatial_aggregate_view[23u] == active_ranks_offset
    && spatial_aggregate_view[24u] == source_capacity
    && spatial_aggregate_view[25u] == physical_capacity
    && active_count <= source_count
    && dormant_count == source_count - active_count
    && spatial_aggregate_view[28u] == 0u
    && spatial_aggregate_view[29u] == 1u
    && spatial_aggregate_view[30u] == spatial_directory[46u]
    && spatial_aggregate_view[31u] == spatial_directory[31u]
    && spatial_aggregate_view[32u] == spatial_directory[35u]
    && spatial_aggregate_view[33u] == spatial_directory[35u]
    && spatial_aggregate_view[34u] == spatial_directory[33u]
    && spatial_aggregate_view[35u] == 64u
    && spatial_aggregate_view[36u] == 44u
    && spatial_aggregate_view[37u] == 3u
    && spatial_aggregate_view[38u] == spatial_directory[22u]
    && spatial_aggregate_view[39u] == spatial_directory[47u]
    && spatial_aggregate_view[40u] == replay_token
    && spatial_aggregate_view[41u] == mechanical_active_rank_header_fingerprint(
      replay_token,
      active_count,
      dormant_count,
      prefix_offset,
      prefix_capacity,
      active_ranks_offset,
      source_capacity,
      active_source_indices_offset,
      source_capacity
    )
    && spatial_aggregate_view[42u]
      == MECHANICAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
    && spatial_aggregate_view[43u]
      == MECHANICAL_ACTIVE_RANK_VIEW_RANKS_PER_LANE
    && spatial_aggregate_view[44u] == dispatch_x
    && spatial_aggregate_view[45u] == 1u
    && spatial_aggregate_view[46u] == 1u
    && spatial_aggregate_view[47u]
      == MECHANICAL_ACTIVE_RANK_VIEW_HEADER_WORDS
    && spatial_aggregate_view[48u] == physical_capacity
    && spatial_aggregate_view[49u] == active_source_indices_offset
    && spatial_aggregate_view[50u] == source_capacity
    && spatial_aggregate_view[prefix_offset] == 0u
    && spatial_aggregate_view[prefix_offset + source_count] == active_count;
}

fn mechanical_active_rank_source_at_rank(
  source_rank: u32
) -> MechanicalActiveRankLookup {
  let rejected = MechanicalActiveRankLookup(0u, 0u, 0u);
  if (source_rank >= spatial_expectation.source_count) { return rejected; }
  let member_word = spatial_directory[31u] + source_rank;
  if (member_word >= arrayLength(&spatial_directory)) { return rejected; }
  let source_index = spatial_directory[member_word];
  if (source_index >= mechanical_params.particle_count) { return rejected; }
  return MechanicalActiveRankLookup(source_rank, source_index, 1u);
}

fn mechanical_active_rank_membership_matches(
  source_rank: u32,
  source_index: u32,
  mechanically_active: bool
) -> bool {
  let prefix_offset = spatial_aggregate_view[21u];
  let active_ranks_offset = spatial_aggregate_view[23u];
  let active_source_indices_offset = spatial_aggregate_view[49u];
  if (
    source_rank >= spatial_expectation.source_count
    || prefix_offset + source_rank + 1u >= arrayLength(&spatial_aggregate_view)
  ) { return false; }
  let prefix = spatial_aggregate_view[prefix_offset + source_rank];
  let next_prefix = spatial_aggregate_view[prefix_offset + source_rank + 1u];
  let expected_delta = select(0u, 1u, mechanically_active);
  if (
    prefix > next_prefix
    || next_prefix - prefix != expected_delta
    || next_prefix > spatial_aggregate_view[26u]
  ) { return false; }
  if (!mechanically_active) { return true; }
  return active_ranks_offset + prefix < arrayLength(&spatial_aggregate_view)
    && active_source_indices_offset + prefix
      < arrayLength(&spatial_aggregate_view)
    && spatial_aggregate_view[active_ranks_offset + prefix] == source_rank
    && spatial_aggregate_view[active_source_indices_offset + prefix]
      == source_index;
}

fn mechanical_active_rank_source_at_ordinal(
  active_ordinal: u32
) -> MechanicalActiveRankLookup {
  let rejected = MechanicalActiveRankLookup(0u, 0u, 0u);
  let active_count = spatial_aggregate_view[26u];
  let active_ranks_offset = spatial_aggregate_view[23u];
  let active_source_indices_offset = spatial_aggregate_view[49u];
  if (
    active_ordinal >= active_count
    || active_ranks_offset + active_ordinal
      >= arrayLength(&spatial_aggregate_view)
    || active_source_indices_offset + active_ordinal
      >= arrayLength(&spatial_aggregate_view)
  ) { return rejected; }
  let source_rank = spatial_aggregate_view[active_ranks_offset + active_ordinal];
  let source_index = spatial_aggregate_view[
    active_source_indices_offset + active_ordinal
  ];
  if (
    source_rank >= spatial_expectation.source_count
    || source_index >= mechanical_params.particle_count
  ) { return rejected; }
  return MechanicalActiveRankLookup(source_rank, source_index, 1u);
}

fn mechanical_active_rank_cell_range(
  member_begin: u32,
  member_end: u32
) -> MechanicalActiveRankRange {
  let rejected = MechanicalActiveRankRange(0u, 0u, 0u);
  let prefix_offset = spatial_aggregate_view[21u];
  if (
    member_begin > member_end
    || member_end > spatial_expectation.source_count
    || prefix_offset + member_end >= arrayLength(&spatial_aggregate_view)
  ) { return rejected; }
  let begin = spatial_aggregate_view[prefix_offset + member_begin];
  let end = spatial_aggregate_view[prefix_offset + member_end];
  if (begin > end || end > spatial_aggregate_view[26u]) { return rejected; }
  return MechanicalActiveRankRange(begin, end, 1u);
}

// ULG_MECHANICAL_AGGREGATE_HELPERS_BEGIN
fn mechanical_aggregate_mix_u32(input_value: u32) -> u32 {
  var value = input_value;
  value = (value ^ (value >> 16u)) * 0x7feb352du;
  value = (value ^ (value >> 15u)) * 0x846ca68bu;
  return value ^ (value >> 16u);
}

fn mechanical_aggregate_fold_fingerprint(seed: u32, value: u32) -> u32 {
  return mechanical_aggregate_mix_u32(
    seed ^ mechanical_aggregate_mix_u32(value)
  );
}

fn mechanical_aggregate_record_base(record_index: u32) -> u32 {
  return MECHANICAL_AGGREGATE_HEADER_WORDS
    + record_index * MECHANICAL_AGGREGATE_RECORD_WORDS;
}

fn mechanical_aggregate_replay_guard_token(cell_count: u32) -> u32 {
  var token = mechanical_aggregate_fold_fingerprint(
    MECHANICAL_AGGREGATE_MAGIC,
    spatial_expectation.source_count
  );
  token = mechanical_aggregate_fold_fingerprint(token, cell_count);
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_generation_id
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_storage_generation
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_position_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_topology_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_chart_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_level_epoch
  );
  token = mechanical_aggregate_fold_fingerprint(
    token,
    spatial_expectation.expected_support_epoch
  );
  return mechanical_aggregate_fold_fingerprint(token, spatial_directory[35u]);
}

fn mechanical_aggregate_header_fingerprint(
  replay_token: u32,
  total_record_count: u32,
  root_record_index: u32
) -> u32 {
  var value = mechanical_aggregate_fold_fingerprint(
    replay_token,
    total_record_count
  );
  value = mechanical_aggregate_fold_fingerprint(value, root_record_index);
  return mechanical_aggregate_fold_fingerprint(
    value,
    MECHANICAL_AGGREGATE_PREFIX_BITS
  );
}

fn mechanical_active_member_fingerprint(active_member_count: u32) -> u32 {
  var value = mechanical_aggregate_fold_fingerprint(
    spatial_aggregate_view[101u],
    MECHANICAL_ACTIVE_MEMBER_MAGIC
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[94u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[95u]
  );
  value = mechanical_aggregate_fold_fingerprint(value, spatial_expectation.source_count);
  value = mechanical_aggregate_fold_fingerprint(value, spatial_directory[18u]);
  value = mechanical_aggregate_fold_fingerprint(value, active_member_count);
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_expectation.expected_generation_id
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_expectation.expected_storage_generation
  );
  return mechanical_aggregate_fold_fingerprint(value, spatial_directory[35u]);
}

fn mechanical_aggregate_topology_fingerprint(record_index: u32) -> u32 {
  let base = mechanical_aggregate_record_base(record_index);
  var value = mechanical_aggregate_fold_fingerprint(
    spatial_aggregate_view[62u],
    record_index
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 27u] & (
      MECHANICAL_AGGREGATE_RECORD_LEAF
        | MECHANICAL_AGGREGATE_RECORD_INTERNAL
        | MECHANICAL_AGGREGATE_RECORD_ROOT
    )
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 28u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 29u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 30u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 31u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 32u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 36u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 37u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 38u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 39u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 40u]
  );
  value = mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 33u]
  );
  return mechanical_aggregate_fold_fingerprint(
    value,
    spatial_aggregate_view[base + 34u]
  );
}

fn mechanical_aggregate_view_admitted() -> bool {
  if (!MECHANICAL_AGGREGATE_HIERARCHY_COMPILED) {
    return mechanical_params.aggregate_hierarchy_enabled == 0u;
  }
  if (mechanical_params.aggregate_hierarchy_enabled == 0u) { return true; }
  let bound_words = arrayLength(&spatial_aggregate_view);
  if (
    bound_words < MECHANICAL_AGGREGATE_HEADER_WORDS
    || mechanical_params.aggregate_capacity_words
      > bound_words
    || mechanical_params.aggregate_capacity_words
      < MECHANICAL_AGGREGATE_HEADER_WORDS
  ) { return false; }
  let cell_count = spatial_directory[18u];
  if (cell_count == 0u || cell_count > 0x03ffffffu) { return false; }
  let leaf_count = spatial_aggregate_view[23u];
  let internal_count = spatial_aggregate_view[55u];
  let total_record_count = spatial_aggregate_view[54u];
  let root_record_index = spatial_aggregate_view[53u];
  let expected_total_record_count = cell_count * 2u - 1u;
  let expected_internal_count = cell_count - 1u;
  let required_words = MECHANICAL_AGGREGATE_HEADER_WORDS
    + expected_total_record_count * MECHANICAL_AGGREGATE_RECORD_WORDS;
  let root_record_base = mechanical_aggregate_record_base(root_record_index);
  let replay_token = mechanical_aggregate_replay_guard_token(cell_count);
  return spatial_aggregate_view[0u] == MECHANICAL_AGGREGATE_MAGIC
    && spatial_aggregate_view[1u] == MECHANICAL_AGGREGATE_VERSION
    && spatial_aggregate_view[2u] == MECHANICAL_AGGREGATE_STATUS_EXACT
    && spatial_aggregate_view[3u]
      == spatial_expectation.expected_generation_id
    && spatial_aggregate_view[4u]
      == spatial_expectation.expected_device_ordinal
    && spatial_aggregate_view[5u]
      == spatial_expectation.expected_lane_ordinal
    && spatial_aggregate_view[6u]
      == spatial_expectation.expected_lease_token
    && spatial_aggregate_view[7u]
      == spatial_expectation.expected_source_family_id
    && spatial_aggregate_view[8u]
      == spatial_expectation.expected_storage_generation
    && spatial_aggregate_view[9u]
      == spatial_expectation.expected_physics_tick
    && spatial_aggregate_view[10u]
      == spatial_expectation.expected_physics_substep
    && spatial_aggregate_view[11u]
      == spatial_expectation.expected_position_epoch
    && spatial_aggregate_view[12u]
      == spatial_expectation.expected_topology_epoch
    && spatial_aggregate_view[13u]
      == spatial_expectation.expected_chart_epoch
    && spatial_aggregate_view[14u]
      == spatial_expectation.expected_level_epoch
    && spatial_aggregate_view[15u]
      == spatial_expectation.expected_support_epoch
    && spatial_aggregate_view[16u] == spatial_expectation.source_count
    && spatial_aggregate_view[17u]
      == spatial_expectation.expected_source_capacity
    && spatial_aggregate_view[18u] == cell_count
    && spatial_aggregate_view[19u]
      == spatial_expectation.expected_cell_capacity
    && spatial_aggregate_view[20u] == MECHANICAL_AGGREGATE_RECORD_WORDS
    && spatial_aggregate_view[21u] == MECHANICAL_AGGREGATE_HEADER_WORDS
    && spatial_aggregate_view[23u] == cell_count
    && spatial_aggregate_view[24u] == MECHANICAL_AGGREGATE_TREE_ARITY
    && spatial_aggregate_view[27u] == expected_internal_count
    && spatial_aggregate_view[29u] == expected_total_record_count
    && spatial_aggregate_view[30u] == required_words
    && spatial_aggregate_view[30u] <= mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[31u] == mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[32u] == 0u
    && spatial_aggregate_view[33u] == 0u
    && spatial_aggregate_view[34u] == 0u
    && spatial_aggregate_view[35u] == 0u
    && spatial_aggregate_view[36u] == spatial_expectation.source_count
    && spatial_aggregate_view[37u] == spatial_expectation.source_count
    && spatial_aggregate_view[38u] == cell_count
    && spatial_aggregate_view[39u] == expected_internal_count
    && spatial_aggregate_view[40u] == spatial_directory[35u]
    && spatial_aggregate_view[41u]
      == spatial_expectation.expected_generation_id
    && spatial_aggregate_view[42u] == spatial_directory[35u]
    && spatial_aggregate_view[43u]
      == mechanical_params.aggregate_source_row_layout_id
    && spatial_aggregate_view[44u] == 8u
    && spatial_aggregate_view[45u] == 12u
    && spatial_aggregate_view[46u] == 1u
    && spatial_aggregate_view[51u] == MECHANICAL_AGGREGATE_TOPOLOGY_MODE
    && spatial_aggregate_view[52u] == MECHANICAL_AGGREGATE_PREFIX_BITS
    && leaf_count == cell_count
    && internal_count == expected_internal_count
    && total_record_count == expected_total_record_count
    && root_record_index < total_record_count
    && root_record_base + 43u < mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[root_record_base + 43u]
      == spatial_expectation.source_count
    && spatial_aggregate_view[root_record_base + 19u]
      <= spatial_expectation.source_count
    && internal_count + leaf_count == total_record_count
    && spatial_aggregate_view[56u] != 0u
    && spatial_aggregate_view[57u] == MECHANICAL_AGGREGATE_STATUS_EXACT
    && spatial_aggregate_view[58u] == cell_count
    && spatial_aggregate_view[59u] == 0u
    && spatial_aggregate_view[60u] == 9u
    && spatial_aggregate_view[62u] != 0u
    && spatial_aggregate_view[62u] == replay_token
    && spatial_aggregate_view[63u] == mechanical_aggregate_header_fingerprint(
      replay_token,
      total_record_count,
      root_record_index
    )
    && spatial_aggregate_view[72u] == cell_count
    && spatial_aggregate_view[73u] == total_record_count
    && spatial_aggregate_view[74u] == expected_internal_count
    && spatial_aggregate_view[75u] == expected_internal_count * 2u
    && spatial_aggregate_view[76u] == total_record_count
    && spatial_aggregate_view[77u] == total_record_count
    && spatial_aggregate_view[78u] == 1u
    && spatial_aggregate_view[79u] == 0u
    && spatial_aggregate_view[80u] == root_record_index
    && spatial_aggregate_view[81u] == MECHANICAL_AGGREGATE_INVALID_U32
    && spatial_aggregate_view[82u] == 1u
    && spatial_aggregate_view[83u] == 1u
    && spatial_aggregate_view[84u] == MECHANICAL_AGGREGATE_TREE_ARITY
    && spatial_aggregate_view[85u] == total_record_count
    && spatial_aggregate_view[86u] == spatial_directory[46u]
    && spatial_aggregate_view[87u]
      == spatial_expectation.expected_cell_keys_offset_words
    && spatial_aggregate_view[88u]
      == spatial_expectation.expected_cell_offsets_offset_words
    && spatial_aggregate_view[89u]
      == spatial_expectation.expected_cell_members_offset_words
    && spatial_aggregate_view[90u]
      == spatial_expectation.expected_particle_to_cell_offset_words
    && spatial_aggregate_view[91u] == MECHANICAL_ACTIVE_MEMBER_MAGIC
    && spatial_aggregate_view[92u] == MECHANICAL_ACTIVE_MEMBER_VERSION
    && spatial_aggregate_view[93u] == MECHANICAL_ACTIVE_MEMBER_STATUS_EXACT
    && spatial_aggregate_view[94u]
      == mechanical_params.aggregate_capacity_words
    && spatial_aggregate_view[95u]
      == spatial_expectation.expected_source_capacity
    && spatial_aggregate_view[96u]
      == spatial_aggregate_view[root_record_base + 19u]
    && spatial_aggregate_view[97u] == spatial_expectation.source_count
    && spatial_aggregate_view[98u] == cell_count
    && spatial_aggregate_view[99u]
      == spatial_expectation.expected_generation_id
    && spatial_aggregate_view[100u] == spatial_directory[35u]
    && spatial_aggregate_view[101u] == replay_token
    && spatial_aggregate_view[102u] == spatial_directory[46u]
    && spatial_aggregate_view[103u]
      == spatial_expectation.expected_cell_members_offset_words
    && spatial_aggregate_view[104u] == cell_count
    && spatial_aggregate_view[105u] == 0u
    && spatial_aggregate_view[106u]
      == MECHANICAL_ACTIVE_MEMBER_CONSTRUCTION_CELL_PREFIX
    && spatial_aggregate_view[107u]
      == mechanical_params.aggregate_capacity_words
        + spatial_expectation.expected_source_capacity
    && spatial_aggregate_view[107u] <= bound_words
    && spatial_aggregate_view[108u]
      == mechanical_params.aggregate_source_row_layout_id
    && spatial_aggregate_view[109u]
      == spatial_expectation.expected_storage_generation
    && spatial_aggregate_view[110u]
      == mechanical_active_member_fingerprint(spatial_aggregate_view[96u]);
}

fn mechanical_aggregate_squared_distance_to_aabb(
  point: vec3<f32>,
  minimum: vec3<f32>,
  maximum: vec3<f32>
) -> f32 {
  let delta = max(max(minimum - point, point - maximum), vec3<f32>(0.0));
  return dot(delta, delta);
}

fn mechanical_aggregate_empty_payload_exact(base: u32) -> bool {
  for (var word = 0u; word <= 24u; word = word + 1u) {
    if (spatial_aggregate_view[base + word] != 0u) { return false; }
  }
  return spatial_aggregate_view[base + 25u]
      == MECHANICAL_AGGREGATE_INVALID_U32
    && spatial_aggregate_view[base + 26u]
      == MECHANICAL_AGGREGATE_INVALID_U32
    && spatial_aggregate_view[base + 42u]
      == MECHANICAL_AGGREGATE_INVALID_U32;
}

fn mechanical_aggregate_record_preflight(record_index: u32) -> bool {
  let bound_words = arrayLength(&spatial_aggregate_view);
  let capacity_words = mechanical_params.aggregate_capacity_words;
  if (
    capacity_words < MECHANICAL_AGGREGATE_HEADER_WORDS
    || capacity_words > bound_words
    || record_index > (
      capacity_words - MECHANICAL_AGGREGATE_HEADER_WORDS
    ) / MECHANICAL_AGGREGATE_RECORD_WORDS
  ) { return false; }
  let total_record_count = spatial_aggregate_view[54u];
  let leaf_count = spatial_aggregate_view[23u];
  let root_record_index = spatial_aggregate_view[53u];
  let record_capacity = (
    capacity_words - MECHANICAL_AGGREGATE_HEADER_WORDS
  ) / MECHANICAL_AGGREGATE_RECORD_WORDS;
  if (record_index >= total_record_count) { return false; }
  let base = mechanical_aggregate_record_base(record_index);
  if (
    base > capacity_words
    || MECHANICAL_AGGREGATE_RECORD_WORDS > capacity_words - base
  ) { return false; }
  let status = spatial_aggregate_view[base + 27u];
  let is_leaf = (status & MECHANICAL_AGGREGATE_RECORD_LEAF) != 0u;
  let is_internal = (status & MECHANICAL_AGGREGATE_RECORD_INTERNAL) != 0u;
  let is_root = (status & MECHANICAL_AGGREGATE_RECORD_ROOT) != 0u;
  let rank_begin = spatial_aggregate_view[base + 38u];
  let rank_end = spatial_aggregate_view[base + 39u];
  let escape_record_index = spatial_aggregate_view[base + 37u];
  let active_member_count = spatial_aggregate_view[base + 19u];
  let source_member_count = spatial_aggregate_view[base + 43u];
  let minimum = vec3<f32>(
    bitcast<f32>(spatial_aggregate_view[base + 12u]),
    bitcast<f32>(spatial_aggregate_view[base + 13u]),
    bitcast<f32>(spatial_aggregate_view[base + 14u])
  );
  let maximum = vec3<f32>(
    bitcast<f32>(spatial_aggregate_view[base + 15u]),
    bitcast<f32>(spatial_aggregate_view[base + 16u]),
    bitcast<f32>(spatial_aggregate_view[base + 17u])
  );
  var valid = (
    status & (
      MECHANICAL_AGGREGATE_RECORD_VALID
        | MECHANICAL_AGGREGATE_RECORD_AUTHENTICATED
    )
  ) == (
    MECHANICAL_AGGREGATE_RECORD_VALID
      | MECHANICAL_AGGREGATE_RECORD_AUTHENTICATED
  )
    && is_leaf != is_internal
    && is_leaf == (record_index < leaf_count)
    && is_root == (record_index == root_record_index)
    && rank_begin < rank_end
    && rank_end <= leaf_count
    && source_member_count > 0u
    && source_member_count <= mechanical_params.particle_count
    && active_member_count <= source_member_count
    && (
      escape_record_index == MECHANICAL_AGGREGATE_INVALID_U32
      || escape_record_index < total_record_count
    )
    && all(vec3<bool>(
      ss_exact_near_finite(minimum.x),
      ss_exact_near_finite(minimum.y),
      ss_exact_near_finite(minimum.z)
    ))
    && all(vec3<bool>(
      ss_exact_near_finite(maximum.x),
      ss_exact_near_finite(maximum.y),
      ss_exact_near_finite(maximum.z)
    ))
    && all(minimum <= maximum)
    && spatial_aggregate_view[base + 41u]
      == mechanical_aggregate_topology_fingerprint(record_index);
  if (!valid) { return false; }
  if (is_root) {
    valid = spatial_aggregate_view[base + 36u]
        == MECHANICAL_AGGREGATE_INVALID_U32
      && escape_record_index == MECHANICAL_AGGREGATE_INVALID_U32
      && rank_begin == 0u
      && rank_end == leaf_count
      && source_member_count == mechanical_params.particle_count;
    if (!valid) { return false; }
  }
  if (is_internal) {
    let left_child = spatial_aggregate_view[base + 33u];
    let right_child = spatial_aggregate_view[base + 34u];
    if (
      left_child >= total_record_count
      || right_child >= total_record_count
      || left_child >= record_capacity
      || right_child >= record_capacity
      || left_child == right_child
    ) { return false; }
    let left_base = mechanical_aggregate_record_base(left_child);
    let right_base = mechanical_aggregate_record_base(right_child);
    let left_source_count = spatial_aggregate_view[left_base + 43u];
    let right_source_count = spatial_aggregate_view[right_base + 43u];
    let left_active_count = spatial_aggregate_view[left_base + 19u];
    let right_active_count = spatial_aggregate_view[right_base + 19u];
    valid = left_source_count <= source_member_count
      && right_source_count == source_member_count - left_source_count
      && left_active_count <= active_member_count
      && right_active_count == active_member_count - left_active_count;
    if (!valid) { return false; }
  }
  if (!is_leaf) {
    return active_member_count != 0u
      || mechanical_aggregate_empty_payload_exact(base);
  }
  if (
    active_member_count == 0u
    && !mechanical_aggregate_empty_payload_exact(base)
  ) { return false; }
  let cell_index = spatial_aggregate_view[base + 35u];
  if (cell_index != record_index || cell_index >= leaf_count) { return false; }
  let member_range = ss_exact_near_cell_member_range(
    spatial_expectation,
    cell_index
  );
  if (
    member_range.admitted == 0u
    || rank_end != rank_begin + 1u
    || spatial_aggregate_view[base + 33u] != member_range.begin
    || spatial_aggregate_view[base + 34u] != member_range.end
    || source_member_count != member_range.end - member_range.begin
  ) { return false; }
  let cell_level_order = ss_exact_near_cell_key_word(
    spatial_expectation,
    cell_index,
    1u
  );
  let cell_level = bitcast<i32>(cell_level_order ^ 0x80000000u);
  let cell_spacing_m = spatial_expectation.base_grid_spacing_m
    * exp2(f32(cell_level));
  let cell_coordinates = vec3<f32>(
    f32(bitcast<i32>(ss_exact_near_cell_key_word(
      spatial_expectation,
      cell_index,
      2u
    ) ^ 0x80000000u)),
    f32(bitcast<i32>(ss_exact_near_cell_key_word(
      spatial_expectation,
      cell_index,
      3u
    ) ^ 0x80000000u)),
    f32(bitcast<i32>(ss_exact_near_cell_key_word(
      spatial_expectation,
      cell_index,
      4u
    ) ^ 0x80000000u))
  );
  let cell_minimum = cell_coordinates * cell_spacing_m;
  let cell_maximum = (cell_coordinates + vec3<f32>(1.0)) * cell_spacing_m;
  if (
    !ss_exact_near_finite(cell_spacing_m)
    || cell_spacing_m <= 0.0
    || !all(vec3<bool>(
      ss_exact_near_finite(cell_minimum.x),
      ss_exact_near_finite(cell_minimum.y),
      ss_exact_near_finite(cell_minimum.z)
    ))
    || !all(vec3<bool>(
      ss_exact_near_finite(cell_maximum.x),
      ss_exact_near_finite(cell_maximum.y),
      ss_exact_near_finite(cell_maximum.z)
    ))
  ) { return false; }
  let projection_base = spatial_aggregate_view[94u];
  let projection_bound = spatial_aggregate_view[107u];
  if (
    projection_base > projection_bound
    || member_range.begin > projection_bound - projection_base
  ) { return false; }
  let projection_begin = projection_base + member_range.begin;
  if (active_member_count > projection_bound - projection_begin) {
    return false;
  }
  var active_ordinal = 0u;
  for (
    var member_ordinal = 0u;
    member_ordinal < source_member_count;
    member_ordinal = member_ordinal + 1u
  ) {
    let member = ss_exact_near_source_at_member(
      spatial_expectation,
      member_range.begin + member_ordinal
    );
    if (
      member.admitted == 0u
      || member.source_index >= mechanical_params.particle_count
    ) { return false; }
    let member_mass = current_state[member.source_index * 2u].w;
    let member_volume = source_mechanics[member.source_index * 8u + 4u].w;
    let member_finite = ss_exact_near_finite(member_mass)
      && ss_exact_near_finite(member_volume);
    let member_active = member_finite && member_mass > 0.0 && member_volume > 0.0;
    let member_dormant = member_finite
      && bitcast<u32>(member_mass) == 0u
      && bitcast<u32>(member_volume) == 0u;
    if (!member_active && !member_dormant) { return false; }
    if (member_dormant) { continue; }
    if (active_ordinal >= active_member_count) { return false; }
    let projected_source = spatial_aggregate_view[projection_begin + active_ordinal];
    if (projected_source != member.source_index) { return false; }
    let projected_cell = ss_exact_near_cell_for_source(
      spatial_expectation,
      projected_source
    );
    if (
      projected_cell.admitted == 0u
      || projected_cell.source_index != cell_index
    ) { return false; }
    atomicOr(
      &global_support_bits[
        mechanical_graph_support_row_base(projected_source) + 3u
      ],
      MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER
    );
    active_ordinal = active_ordinal + 1u;
  }
  return active_ordinal == active_member_count;
}
// ULG_MECHANICAL_AGGREGATE_HELPERS_END

fn mechanical_graph_squared_distance_to_aabb(
  point: vec3<f32>,
  minimum: vec3<f32>,
  maximum: vec3<f32>
) -> f32 {
  let delta = max(max(minimum - point, point - maximum), vec3<f32>(0.0));
  return dot(delta, delta);
}

fn mechanical_graph_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

fn mechanical_graph_source_row_base(index: u32) -> u32 {
  return index * 16u;
}

fn mechanical_graph_epoch_position(index: u32) -> vec3<f32> {
  let base = mechanical_graph_source_row_base(index);
  return vec3<f32>(
    spatial_source_rows[base + 12u],
    spatial_source_rows[base + 13u],
    spatial_source_rows[base + 14u]
  );
}

fn mechanical_graph_support_row_base(index: u32) -> u32 {
  return ${MECHANICAL_SUPPORT_HEADER_WORDS}u
    + index * ${MECHANICAL_SUPPORT_ROW_WORDS}u;
}

struct MechanicalGraphEndpointMetadata {
  index: u32,
  support_base: u32,
  descriptor: u32,
  material_bits: u32,
  domain_id: u32,
};

struct MechanicalGraphSelfCache {
  endpoint: MechanicalGraphEndpointMetadata,
  current_position_m: vec3<f32>,
  epoch_position_m: vec3<f32>,
  diameter_m: f32,
  displacement_m: f32,
  wall_projection_m: f32,
};

struct MechanicalGraphPairPolicy {
  eligible: u32,
  unilateral: u32,
};

fn mechanical_graph_aggregate_preflight_seal_word() -> u32 {
  return ${MECHANICAL_SUPPORT_HEADER_WORDS}u
    + mechanical_params.particle_count * ${MECHANICAL_SUPPORT_ROW_WORDS}u;
}

fn mechanical_graph_cached_epoch_position(index: u32) -> vec3<f32> {
  let base = mechanical_graph_support_row_base(index);
  return vec3<f32>(
    bitcast<f32>(atomicLoad(&global_support_bits[base + 4u])),
    bitcast<f32>(atomicLoad(&global_support_bits[base + 5u])),
    bitcast<f32>(atomicLoad(&global_support_bits[base + 6u]))
  );
}

fn mechanical_graph_source_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn mechanical_graph_support_descriptor(index: u32) -> u32 {
  return atomicLoad(
    &global_support_bits[mechanical_graph_support_row_base(index) + 3u]
  );
}

fn mechanical_graph_material_bits(index: u32) -> u32 {
  return atomicLoad(
    &global_support_bits[mechanical_graph_support_row_base(index) + 7u]
  );
}

fn mechanical_graph_load_endpoint_metadata(
  index: u32
) -> MechanicalGraphEndpointMetadata {
  let support_base = mechanical_graph_support_row_base(index);
  let descriptor = atomicLoad(&global_support_bits[support_base + 3u]);
  var material_bits = 0u;
  var domain_id = 0u;
  if ((descriptor & 1u) != 0u) {
    material_bits = atomicLoad(&global_support_bits[support_base + 7u]);
  }
  return MechanicalGraphEndpointMetadata(
    index,
    support_base,
    descriptor,
    material_bits,
    domain_id
  );
}

fn mechanical_graph_load_self_endpoint_metadata(
  index: u32
) -> MechanicalGraphEndpointMetadata {
  let endpoint = mechanical_graph_load_endpoint_metadata(index);
  var domain_id = 0u;
  if (
    (endpoint.descriptor & 1u) != 0u
    && mechanical_params.identity_enabled != 0u
  ) {
    domain_id = source_identity[index];
  }
  return MechanicalGraphEndpointMetadata(
    endpoint.index,
    endpoint.support_base,
    endpoint.descriptor,
    endpoint.material_bits,
    domain_id
  );
}

fn mechanical_graph_thermo_phase_class(index: u32) -> u32 {
  let phase_id = source_thermo[index * 3u].y;
  if (!ss_exact_near_finite(phase_id) || phase_id != trunc(phase_id)) {
    return 0xffffffffu;
  }
  if (phase_id == 1.0) { return 2u; }
  if (phase_id == 2.0) { return 1u; }
  if (phase_id == 3.0 || phase_id == 4.0) { return 0u; }
  return 0xffffffffu;
}

fn mechanical_graph_same_phase_lineage(self_index: u32, other_index: u32) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn mechanical_graph_pair_policy(
  self_endpoint: MechanicalGraphEndpointMetadata,
  other_endpoint: MechanicalGraphEndpointMetadata
) -> MechanicalGraphPairPolicy {
  let rejected = MechanicalGraphPairPolicy(0u, 0u);
  let self_index = self_endpoint.index;
  let other_index = other_endpoint.index;
  if (
    other_index == self_index
    || other_index >= mechanical_params.particle_count
    || (other_endpoint.descriptor & 1u) == 0u
  ) { return rejected; }
  if (mechanical_graph_same_phase_lineage(self_index, other_index)) {
    if (self_endpoint.material_bits != other_endpoint.material_bits) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
      );
      atomicAdd(&traversal_evidence[19u], 1u);
    }
    return rejected;
  }
  let self_class = (self_endpoint.descriptor >> 1u) & 3u;
  let other_class = (other_endpoint.descriptor >> 1u) & 3u;
  if (self_class == 0u || other_class == 0u) { return rejected; }
  let same_material = self_endpoint.material_bits
    == other_endpoint.material_bits;
  let both_solid = self_class == 2u && other_class == 2u;
  let self_domain = self_endpoint.domain_id;
  var other_domain = 0u;
  var solid_domains_differ = false;
  if (
    same_material
    && both_solid
    && mechanical_params.identity_enabled != 0u
  ) {
    // Liquid/liquid and solid/liquid pairs never need peer identity.  Keep the
    // read on the only branch whose ownership law depends on body domains.
    other_domain = source_identity[other_index];
    solid_domains_differ = self_domain != 0u
      && other_domain != 0u
      && self_domain != other_domain;
  }
  let same_body_solid = same_material
    && both_solid
    && (
      mechanical_params.identity_enabled == 0u
      || self_domain == 0u
      || other_domain == 0u
      || self_domain == other_domain
    );
  if (same_body_solid) { return rejected; }
  let solid_liquid_interface = (self_class == 2u && other_class == 1u)
    || (self_class == 1u && other_class == 2u);
  let unilateral = !same_material
    || solid_liquid_interface
    || solid_domains_differ;
  return MechanicalGraphPairPolicy(1u, select(0u, 1u, unilateral));
}

fn mechanical_graph_wall_projection_bound(index: u32) -> f32 {
  let position = current_state[index * 2u].xyz;
  let volume = max(source_mechanics[index * 8u + 4u].w, 0.0);
  var clearance = 0.5 * mechanical_graph_cbrt(volume);
  if (mechanical_params.grid_spacing_m > 0.0) {
    clearance = min(clearance, 0.5 * mechanical_params.grid_spacing_m);
  }
  let min_dimension = min(
    mechanical_params.box_dims_m.x,
    min(mechanical_params.box_dims_m.y, mechanical_params.box_dims_m.z)
  );
  if (min_dimension > 0.0) {
    clearance = min(clearance, 0.49 * min_dimension);
  }
  let lower = vec3<f32>(clearance);
  let upper = max(lower, mechanical_params.box_dims_m - lower);
  return length(clamp(position, lower, upper) - position);
}

fn mechanical_graph_pair_within_symmetric_envelope(
  self_cache: MechanicalGraphSelfCache,
  other_endpoint: MechanicalGraphEndpointMetadata,
  unilateral: bool,
  shares_authenticated_cell: bool
) -> bool {
  let self_index = self_cache.endpoint.index;
  let other_index = other_endpoint.index;
  let other_support_base = other_endpoint.support_base;
  if (
    (self_cache.endpoint.descriptor & 1u) == 0u
    || (other_endpoint.descriptor & 1u) == 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return false;
  }
  let self_diameter = self_cache.diameter_m;
  let other_diameter = bitcast<f32>(
    atomicLoad(&global_support_bits[other_support_base])
  );
  let current_delta_m = self_cache.current_position_m
    - current_state[other_index * 2u].xyz;
  let current_distance_squared_m2 = dot(current_delta_m, current_delta_m);
  let rest_distance_m = 0.5 * (self_diameter + other_diameter);
  // Same-material liquid pairs own only the optional round-zero soft law.
  // Their admission depends solely on current overlap, so reject or admit
  // them before loading epoch positions, swept displacement, and wall
  // projection. The explicit clique diagnostic remains on the fully
  // certified path below because it deliberately widens normal closure.
  if (
    !unilateral
    && !(
      mechanical_params.retain_complete_authenticated_cell_cliques != 0u
      && shares_authenticated_cell
    )
  ) {
    if (
      !ss_exact_near_finite(self_diameter)
      || !ss_exact_near_finite(other_diameter)
      || !ss_exact_near_finite(current_distance_squared_m2)
      || !ss_exact_near_finite(rest_distance_m)
      || rest_distance_m <= 0.0
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return false;
    }
    // Most directory candidates are outside the liquid overlap shell. Reject
    // only a conservatively distant squared shell here; candidates near the
    // boundary still take the original sqrt comparison, preserving its exact
    // admission result while avoiding sqrt for definite misses.
    let rest_distance_squared_m2 = rest_distance_m * rest_distance_m;
    if (
      ss_exact_near_finite(rest_distance_squared_m2)
      && current_distance_squared_m2
        > rest_distance_squared_m2 * 1.000003814697265625
    ) { return false; }
    let current_distance_m = sqrt(max(current_distance_squared_m2, 0.0));
    return current_distance_m < rest_distance_m;
  }
  let self_displacement_m = self_cache.displacement_m;
  let other_displacement_m = bitcast<f32>(
    atomicLoad(&global_support_bits[other_support_base + 1u])
  );
  let self_wall_projection_m = self_cache.wall_projection_m;
  let other_wall_projection_m = bitcast<f32>(
    atomicLoad(&global_support_bits[other_support_base + 2u])
  );
  let self_epoch_position = self_cache.epoch_position_m;
  let other_epoch_position = mechanical_graph_cached_epoch_position(other_index);
  let epoch_distance_m = length(self_epoch_position - other_epoch_position);
  let current_distance_m = sqrt(max(current_distance_squared_m2, 0.0));
  // The retained solver debits a complete-solve endpoint trust of one own
  // diameter plus that endpoint's authenticated post-G2P displacement. The
  // extra displacement term permits exact swept-cohort rollback after a deep
  // crossing without restoring the old per-round nine-diameter shell.
  // Orthogonal box projection is non-expansive, so only the initial distance
  // to the box must be added. This is a certificate, not a heuristic radius.
  let pair_radius_m = rest_distance_m
    + 2.0 * (self_displacement_m + other_displacement_m)
    + self_diameter
    + other_diameter
    + self_wall_projection_m
    + other_wall_projection_m;
  if (
    !ss_exact_near_finite(self_displacement_m)
    || !ss_exact_near_finite(other_displacement_m)
    || !ss_exact_near_finite(self_wall_projection_m)
    || !ss_exact_near_finite(other_wall_projection_m)
    || !ss_exact_near_finite(epoch_distance_m)
    || !ss_exact_near_finite(current_distance_m)
    || !ss_exact_near_finite(pair_radius_m)
    || pair_radius_m <= 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return false;
  }
  // The explicit diagnostic mode retains a complete authenticated-cell clique
  // to stress deterministic dense graph capacity without widening production
  // closure. Normal simulation uses only the certified geometric envelope.
  if (
    mechanical_params.retain_complete_authenticated_cell_cliques != 0u
    && shares_authenticated_cell
  ) { return true; }
  // Starting from the current state, each endpoint can move by at most its
  // cumulative trust (own diameter plus authenticated displacement). Initial
  // wall projection is the only extra non-expansive box displacement. This
  // current-distance predicate is equivalent to the epoch-space certificate
  // without retaining the excess shell caused by opposing displacements.
  let current_pair_radius_m = rest_distance_m
    + self_diameter
    + other_diameter
    + self_displacement_m
    + other_displacement_m
    + self_wall_projection_m
    + other_wall_projection_m;
  return epoch_distance_m <= pair_radius_m
    && current_distance_m <= current_pair_radius_m;
}

fn mechanical_graph_allocate_append_slot() -> u32 {
  // Atomic add gives every admitted pair one contention-independent ticket.
  // Once the retained arena is full, clamp the diagnostic counter to the
  // first rejected ticket. The exact scanned source counts remain the
  // required-total authority and the sticky capacity bit seals publication.
  let capacity = mechanical_params.directed_pair_capacity;
  let append_slot = atomicAdd(&graph_control[11u], 1u);
  if (append_slot < capacity) { return append_slot; }
  atomicMin(&graph_control[11u], capacity + 1u);
  atomicOr(
    &graph_control[14u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.GRAPH_CAPACITY}u
  );
  return 0xffffffffu;
}

fn mechanical_graph_evidence_saturating_add(word: u32, value: u32) -> bool {
  if (value == 0u) { return true; }
  // A valid retained hierarchy has at most (2N - 1) records and each source
  // visits each record/member at most once.  For N <= 46,340 every aggregate
  // evidence total is therefore bounded by N * 2N <= UINT32_MAX.  The direct
  // atomic add is exact in that range and avoids serializing every active
  // source through a globally contended compare/exchange loop.  Retain the
  // saturating path for larger source families, where the proof no longer fits
  // in u32.  An unexpected wrap in the proven range is still made terminal so
  // corrupted input cannot publish a graph.
  if (mechanical_params.particle_count <= 46340u) {
    let prior = atomicAdd(&traversal_evidence[word], value);
    if (prior <= 0xffffffffu - value) { return true; }
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
    );
    return false;
  }
  var attempt = 0u;
  loop {
    let prior = atomicLoad(&traversal_evidence[word]);
    if (prior > 0xffffffffu - value) {
      atomicStore(&traversal_evidence[word], 0xffffffffu);
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      return false;
    }
    let claimed = atomicCompareExchangeWeak(
      &traversal_evidence[word],
      prior,
      prior + value
    );
    if (claimed.exchanged) { return true; }
    attempt = attempt + 1u;
    if (attempt >= 256u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      return false;
    }
  }
}

@compute @workgroup_size(64)
fn reduce_support(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let source_rank = global_id.x;
  if (source_rank >= mechanical_params.particle_count) { return; }
  var particle_index = source_rank;
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let rank_lookup = mechanical_active_rank_source_at_rank(source_rank);
    if (rank_lookup.admitted == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
      );
      return;
    }
    particle_index = rank_lookup.source_index;
  }
  // ULG_MECHANICAL_AGGREGATE_PREFLIGHT_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    let total_record_count = spatial_aggregate_view[54u];
    let seal_word = mechanical_graph_aggregate_preflight_seal_word();
    var record_index = particle_index;
    for (var record_batch = 0u; record_batch < 2u; record_batch = record_batch + 1u) {
      if (record_index < total_record_count) {
        if (mechanical_aggregate_record_preflight(record_index)) {
          atomicAdd(&global_support_bits[seal_word], 1u);
        } else {
          atomicOr(
            &global_support_bits[seal_word],
            MECHANICAL_AGGREGATE_PREFLIGHT_FAILED
          );
          atomicOr(
            &graph_control[14u],
            ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
          );
        }
      }
      if (
        record_index
          > 0xffffffffu - mechanical_params.particle_count
      ) { break; }
      record_index = record_index + mechanical_params.particle_count;
    }
  }
  // ULG_MECHANICAL_AGGREGATE_PREFLIGHT_END
  atomicAdd(
    &traversal_evidence[
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateSummaryPreflightCount}u
    ],
    1u
  );
  let raw_volume = source_mechanics[particle_index * 8u + 4u].w;
  let mass = current_state[particle_index * 2u].w;
  let mechanics_finite = ss_exact_near_finite(raw_volume)
    && ss_exact_near_finite(mass);
  let mechanically_active = mechanics_finite
    && raw_volume > 0.0
    && mass > 0.0;
  let mechanically_dormant = mechanics_finite
    && bitcast<u32>(raw_volume) == 0u
    && bitcast<u32>(mass) == 0u;
  if (!mechanically_active && !mechanically_dormant) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        !mechanics_finite
      )
    );
  }
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
    && !mechanical_active_rank_membership_matches(
      source_rank,
      particle_index,
      mechanically_active
    )
  ) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
    );
  }
  let material_id = source_thermo[particle_index * 3u].x;
  let material_valid = !mechanically_active || (
    ss_exact_near_finite(material_id)
      && material_id == trunc(material_id)
      && material_id >= 0.0
      && material_id <= 16777215.0
  );
  if (!material_valid) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
    );
  }
  let phase_summary_matches = !mechanically_active
    || mechanical_graph_thermo_phase_class(particle_index)
      == mechanical_graph_source_phase_class(particle_index);
  if (!phase_summary_matches) {
    // The high bit seals summary admission while the low bits count completed
    // preflight invocations. Materialization runs in a later dispatch, so it
    // can require both complete coverage and no mismatch without a grid-wide
    // barrier inside this pass.
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicAdd(
      &traversal_evidence[
        ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateSummaryPhaseMismatchCount}u
      ],
      1u
    );
  }
  // A source-local liquid overlap is the only production pair law that needs
  // no swept, wall, material-interface, or body-domain envelope.  Certify
  // that special *population shape* here, in the support pass that already
  // authenticates every active endpoint.  This is deliberately a generic
  // phase/material proof rather than a material-name shortcut: any active
  // gas, solid, mismatched phase summary, invalid material, or second
  // material makes the later traversal retain its broad mixed-law envelope.
  if (mechanically_active) {
    let source_phase_class = mechanical_graph_source_phase_class(particle_index);
    if (
      !material_valid
      || !phase_summary_matches
      || source_phase_class != 1u
    ) {
      atomicOr(
        &global_support_bits[
          ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u
        ],
        ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTED}u
      );
    } else {
      let material_bits = bitcast<u32>(material_id);
      var certified_material = atomicLoad(
        &global_support_bits[
          ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u
        ]
      );
      loop {
        if (certified_material == material_bits) { break; }
        if (
          certified_material
            != ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u
        ) {
          atomicOr(
            &global_support_bits[
              ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u
            ],
            ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTED}u
          );
          break;
        }
        // Weak compare-exchange may fail spuriously.  Retrying while the
        // header remains unset prevents a same-material race from needlessly
        // disabling this optional optimization; observing a different value
        // is a real mixed-material certificate failure.
        let claim = atomicCompareExchangeWeak(
          &global_support_bits[
            ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u
          ],
          ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u,
          material_bits
        );
        if (claim.exchanged) { break; }
        certified_material = claim.old_value;
      }
    }
  }
  var lineage_material_matches = true;
  let lineage_capacity = mechanical_params.phase_lineage_capacity;
  let phase_lane_count = mechanical_params.phase_lane_count;
  if (
    mechanically_active
    && lineage_capacity > 0u
    && phase_lane_count > 1u
  ) {
    let lineage_index = particle_index % lineage_capacity;
    lineage_material_matches = material_valid;
    for (
      var phase_lane = 0u;
      phase_lane < phase_lane_count && lineage_material_matches;
      phase_lane = phase_lane + 1u
    ) {
      let peer_index = phase_lane * lineage_capacity + lineage_index;
      if (peer_index >= mechanical_params.particle_count) {
        lineage_material_matches = false;
        continue;
      }
      let peer_mass = current_state[peer_index * 2u].w;
      let peer_volume = source_mechanics[peer_index * 8u + 4u].w;
      let peer_finite = ss_exact_near_finite(peer_mass)
        && ss_exact_near_finite(peer_volume);
      let peer_active = peer_finite && peer_mass > 0.0 && peer_volume > 0.0;
      let peer_dormant = peer_finite
        && bitcast<u32>(peer_mass) == 0u
        && bitcast<u32>(peer_volume) == 0u;
      if (!peer_active && !peer_dormant) {
        lineage_material_matches = false;
        continue;
      }
      if (peer_active) {
        let peer_material = source_thermo[peer_index * 3u].x;
        if (
          !ss_exact_near_finite(peer_material)
          || peer_material != trunc(peer_material)
          || abs(peer_material - material_id) >= 0.5
        ) {
          lineage_material_matches = false;
        }
      }
    }
  }
  if (!lineage_material_matches) {
    atomicOr(&global_support_bits[3u], 0x80000000u);
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
    );
    atomicAdd(
      &traversal_evidence[
        ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateSummaryLineageMaterialMismatchCount}u
      ],
      1u
    );
  }
  atomicAdd(&global_support_bits[3u], 1u);
  let volume = max(raw_volume, 0.0);
  if (mechanically_active) {
    let support_base = mechanical_graph_support_row_base(particle_index);
    let diameter_m = mechanical_graph_cbrt(volume);
    let epoch_position = mechanical_graph_epoch_position(particle_index);
    let displacement_m = length(
      current_state[particle_index * 2u].xyz - epoch_position
    );
    let wall_projection_m = mechanical_graph_wall_projection_bound(particle_index);
    let support_payload_finite = ss_exact_near_finite(diameter_m)
      && ss_exact_near_finite(displacement_m)
      && ss_exact_near_finite(wall_projection_m)
      && all(vec3<bool>(
        ss_exact_near_finite(epoch_position.x),
        ss_exact_near_finite(epoch_position.y),
        ss_exact_near_finite(epoch_position.z)
      ));
    if (!support_payload_finite) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    } else if (material_valid) {
      atomicStore(&global_support_bits[support_base], bitcast<u32>(diameter_m));
      atomicStore(
        &global_support_bits[support_base + 1u],
        bitcast<u32>(max(displacement_m, 0.0))
      );
      atomicStore(
        &global_support_bits[support_base + 2u],
        bitcast<u32>(max(wall_projection_m, 0.0))
      );
      atomicStore(
        &global_support_bits[support_base + 4u],
        bitcast<u32>(epoch_position.x)
      );
      atomicStore(
        &global_support_bits[support_base + 5u],
        bitcast<u32>(epoch_position.y)
      );
      atomicStore(
        &global_support_bits[support_base + 6u],
        bitcast<u32>(epoch_position.z)
      );
      atomicStore(
        &global_support_bits[support_base + 7u],
        bitcast<u32>(material_id)
      );
      atomicOr(
        &global_support_bits[support_base + 3u],
        1u | (mechanical_graph_source_phase_class(particle_index) << 1u)
      );
      if (
        MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
        && mechanical_params.aggregate_hierarchy_enabled
          == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
      ) {
        atomicOr(
          &global_support_bits[support_base + 3u],
          MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER
        );
      }
    }
    atomicMax(
      &global_support_bits[0u],
      bitcast<u32>(diameter_m)
    );
    if (ss_exact_near_finite(displacement_m)) {
      atomicMax(
        &global_support_bits[1u],
        bitcast<u32>(max(displacement_m, 0.0))
      );
    } else {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    }
    if (ss_exact_near_finite(wall_projection_m)) {
      atomicMax(
        &global_support_bits[2u],
        bitcast<u32>(max(wall_projection_m, 0.0))
      );
    } else {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
    }
  }
  if (source_rank == 0u) {
    if (
      spatial_expectation.support_profile_id
        != mechanical_params.contact_support_profile_id
      || !ss_exact_near_directory_admitted(spatial_expectation)
      || !mechanical_aggregate_view_admitted()
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
      );
      atomicAdd(&traversal_evidence[19u], 1u);
    }
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}u
    );
  }
}

fn mechanical_graph_materialize_cell(
  self_cache: MechanicalGraphSelfCache,
  cell_index: u32,
  self_cell_index: u32,
  active_member_count: u32,
  use_active_projection: bool,
  local_rank: ptr<function, u32>,
  candidate_count: ptr<function, u32>,
  projected_peer_visit_count: ptr<function, u32>,
  staged_count: ptr<function, u32>,
  overflow_count: ptr<function, u32>,
  malformed: ptr<function, bool>
) {
  let self_index = self_cache.endpoint.index;
  let member_range = ss_exact_near_cell_member_range(
    spatial_expectation,
    cell_index
  );
  if (member_range.admitted == 0u) {
    *malformed = true;
    return;
  }
  let source_member_count = member_range.end - member_range.begin;
  var resolved_active_member_count = active_member_count;
  var active_ordinal_begin = 0u;
  var resolved_use_active_projection = use_active_projection;
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let active_range = mechanical_active_rank_cell_range(
      member_range.begin,
      member_range.end
    );
    if (active_range.admitted == 0u) {
      *malformed = true;
      return;
    }
    active_ordinal_begin = active_range.begin;
    resolved_active_member_count = active_range.end - active_range.begin;
    resolved_use_active_projection = true;
  }
  if (
    resolved_use_active_projection
    && resolved_active_member_count > source_member_count
  ) {
    *malformed = true;
    return;
  }
  let skipped_dormant_count = select(
    0u,
    source_member_count - resolved_active_member_count,
    resolved_use_active_projection
  );
  if (*candidate_count > 0xffffffffu - skipped_dormant_count) {
    *malformed = true;
    return;
  }
  *candidate_count = *candidate_count + skipped_dormant_count;
  let visited_member_count = select(
    source_member_count,
    resolved_active_member_count,
    resolved_use_active_projection
  );
  for (
    var member_ordinal = 0u;
    member_ordinal < visited_member_count;
    member_ordinal = member_ordinal + 1u
  ) {
    var other_index = MECHANICAL_AGGREGATE_INVALID_U32;
    if (
      MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
      && mechanical_params.aggregate_hierarchy_enabled
        == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
    ) {
      let active_lookup = mechanical_active_rank_source_at_ordinal(
        active_ordinal_begin + member_ordinal
      );
      if (
        active_lookup.admitted == 0u
        || active_lookup.source_rank < member_range.begin
        || active_lookup.source_rank >= member_range.end
      ) {
        *malformed = true;
        return;
      }
      other_index = active_lookup.source_index;
    } else if (use_active_projection) {
      let projection_word = spatial_aggregate_view[94u]
        + member_range.begin + member_ordinal;
      if (projection_word >= spatial_aggregate_view[107u]) {
        *malformed = true;
        return;
      }
      other_index = spatial_aggregate_view[projection_word];
    } else {
      let lookup = ss_exact_near_source_at_member(
        spatial_expectation,
        member_range.begin + member_ordinal
      );
      if (lookup.admitted == 0u) {
        *malformed = true;
        return;
      }
      other_index = lookup.source_index;
    }
    if (
      other_index >= mechanical_params.particle_count
      || *candidate_count == 0xffffffffu
    ) {
      *malformed = true;
      return;
    }
    *candidate_count = *candidate_count + 1u;
    // Candidate accounting includes dormant aggregate members without a load.
    // Count only the peer rows that actually reach metadata/pair evaluation so
    // a performance audit can distinguish projection savings from the raw
    // broad-phase envelope without changing any graph semantics.
    if (*projected_peer_visit_count == 0xffffffffu) {
      *malformed = true;
      return;
    }
    *projected_peer_visit_count = *projected_peer_visit_count + 1u;
    let other_endpoint = mechanical_graph_load_endpoint_metadata(other_index);
    let pair_policy = mechanical_graph_pair_policy(
      self_cache.endpoint,
      other_endpoint
    );
    if (pair_policy.eligible == 0u) {
      continue;
    }
    if (!mechanical_graph_pair_within_symmetric_envelope(
      self_cache,
      other_endpoint,
      pair_policy.unilateral != 0u,
      cell_index == self_cell_index
    )) {
      continue;
    }
    if (*local_rank == 0xffffffffu) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      *malformed = true;
      return;
    }
    let pair_rank = *local_rank;
    *local_rank = *local_rank + 1u;
    let append_slot = mechanical_graph_allocate_append_slot();
    if (append_slot < mechanical_params.directed_pair_capacity) {
      let append_base = append_slot * 3u;
      append_records[append_base] = self_index;
      append_records[append_base + 1u] = other_index;
      append_records[append_base + 2u] = pair_rank;
      *staged_count = *staged_count + 1u;
    } else {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.GRAPH_CAPACITY}u
      );
      *overflow_count = *overflow_count + 1u;
    }
  }
}

@compute @workgroup_size(64)
fn materialize_contact_graph(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let dispatch_ordinal = global_id.x;
  let active_rank_dispatch = MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK;
  if (active_rank_dispatch) {
    // The retained view dispatches ceil(activeCount / 64) workgroups.  Lanes
    // beyond that dense list are intentionally inert; treating them as a
    // rejected ordinal makes every non-multiple-of-64 active set fail closed.
    // An admitted empty view still dispatches one group so lane zero can seal
    // the traversal stage as a valid no-op graph.
    let active_count = spatial_aggregate_view[26u];
    if (dispatch_ordinal >= active_count) {
      if (dispatch_ordinal == 0u) {
        atomicAdd(&traversal_evidence[23u], 1u);
        atomicOr(
          &graph_control[15u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}u
        );
      }
      return;
    }
  } else if (dispatch_ordinal >= mechanical_params.particle_count) {
    return;
  }
  // ULG_MECHANICAL_AGGREGATE_SEAL_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    let cell_count = spatial_directory[18u];
    let preflight_seal = atomicLoad(
      &global_support_bits[mechanical_graph_aggregate_preflight_seal_word()]
    );
    if (
      cell_count == 0u
      || cell_count > 0x03ffffffu
      || preflight_seal != cell_count * 2u - 1u
    ) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
      );
      return;
    }
  }
  // ULG_MECHANICAL_AGGREGATE_SEAL_END
  // Directory membership is a permutation of the complete source family.
  // Dispatching adjacent lanes in canonical spatial order keeps their tree
  // walks and member reads coherent without changing source-local CSR rank or
  // graph semantics.
  var source_rank = dispatch_ordinal;
  var self_index = MECHANICAL_AGGREGATE_INVALID_U32;
  var source_admitted = false;
  if (
    MECHANICAL_ACTIVE_RANK_VIEW_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled
      == MECHANICAL_PROJECTION_MODE_ACTIVE_RANK
  ) {
    let active_lookup = mechanical_active_rank_source_at_ordinal(
      dispatch_ordinal
    );
    source_rank = active_lookup.source_rank;
    self_index = active_lookup.source_index;
    source_admitted = active_lookup.admitted != 0u;
  } else {
    let source_lookup = ss_exact_near_source_at_member(
      spatial_expectation,
      source_rank
    );
    self_index = source_lookup.source_index;
    source_admitted = source_lookup.admitted != 0u;
  }
  if (!source_admitted || self_index >= mechanical_params.particle_count) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
    );
    return;
  }
  if (dispatch_ordinal == 0u) {
    atomicAdd(&traversal_evidence[23u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}u
    );
  }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}u
    ) == 0u
  ) {
    source_counts[self_index] = 0u;
    return;
  }
  let self_pos_mass = current_state[self_index * 2u];
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  if (self_pos_mass.w <= 0.0 || self_volume <= 0.0) {
    source_counts[self_index] = 0u;
    return;
  }
  let self_endpoint = mechanical_graph_load_self_endpoint_metadata(self_index);
  let self_support_descriptor = self_endpoint.descriptor;
  if (
    mechanical_params.aggregate_hierarchy_enabled != 0u
    && (
      self_support_descriptor & (
        1u | MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER
      )
    ) != (1u | MECHANICAL_SUPPORT_ACTIVE_PROJECTION_MEMBER)
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
    );
    source_counts[self_index] = 0u;
    return;
  }
  let self_phase_class = (self_support_descriptor >> 1u) & 3u;
  if (self_phase_class == 0u) {
    source_counts[self_index] = 0u;
    return;
  }
  let self_source_cell = ss_exact_near_cell_for_source(
    spatial_expectation,
    self_index
  );
  if (self_source_cell.admitted == 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DIRECTORY_REJECT}u
    );
    source_counts[self_index] = 0u;
    return;
  }
  if (
    mechanical_params.apply_selected_level != -2147483648
    && ss_exact_near_cell_key_word(
      spatial_expectation,
      self_source_cell.source_index,
      1u
    ) != ss_exact_near_signed_order_key(
      mechanical_params.apply_selected_level
    )
  ) {
    source_counts[self_index] = 0u;
    return;
  }
  let global_max_diameter = bitcast<f32>(
    atomicLoad(&global_support_bits[0u])
  );
  let global_max_displacement_m = bitcast<f32>(
    atomicLoad(&global_support_bits[1u])
  );
  let global_max_wall_projection_m = bitcast<f32>(
    atomicLoad(&global_support_bits[2u])
  );
  let self_epoch_position = mechanical_graph_cached_epoch_position(self_index);
  let self_diameter_m = bitcast<f32>(
    atomicLoad(&global_support_bits[self_endpoint.support_base])
  );
  let self_displacement_m = bitcast<f32>(
    atomicLoad(&global_support_bits[self_endpoint.support_base + 1u])
  );
  let self_wall_projection_m = bitcast<f32>(
    atomicLoad(&global_support_bits[self_endpoint.support_base + 2u])
  );
  let self_cache = MechanicalGraphSelfCache(
    self_endpoint,
    self_pos_mass.xyz,
    self_epoch_position,
    self_diameter_m,
    self_displacement_m,
    self_wall_projection_m
  );
  let support_reduction_summary = atomicLoad(&global_support_bits[
    ${MECHANICAL_SUPPORT_AGGREGATE_PREFLIGHT_WORD}u
  ]);
  let support_reduction_complete =
    (support_reduction_summary & 0x80000000u) == 0u
    && (support_reduction_summary & 0x7fffffffu)
      == mechanical_params.particle_count;
  let homogeneous_liquid_material_bits = atomicLoad(&global_support_bits[
    ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u
  ]);
  let homogeneous_liquid_certificate =
    mechanical_params.retain_complete_authenticated_cell_cliques == 0u
    && self_phase_class == 1u
    && support_reduction_complete
    && homogeneous_liquid_material_bits
      != ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u
    && homogeneous_liquid_material_bits == self_endpoint.material_bits
    && atomicLoad(&global_support_bits[
      ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u
    ]) == 0u;
  // Mixed-phase/material populations retain the generation-wide conservative
  // cube.  It covers unilateral swept rollback, wall projection, and body
  // interfaces, then the pair predicate removes its excess shell.
  let mixed_law_query_radius_m = 3.0 * max(global_max_diameter, 0.0)
    + 4.0 * max(global_max_displacement_m, 0.0)
    + 2.0 * max(global_max_wall_projection_m, 0.0);
  // Once every active source is certified as one liquid material, eligible
  // pairs use only the exact current-overlap predicate.  An epoch-directory
  // source at B can therefore overlap source A only inside A's own swept
  // displacement plus B's generation maximum swept displacement and the two
  // half-diameters.  The expression is reciprocal, so it preserves both
  // directed edges without paying the broad mixed-law traversal radius.
  let homogeneous_liquid_query_radius_m = 0.5 * (
    max(self_diameter_m, 0.0) + max(global_max_diameter, 0.0)
  )
    + max(self_displacement_m, 0.0)
    + max(global_max_displacement_m, 0.0);
  let query_radius_m = select(
    mixed_law_query_radius_m,
    homogeneous_liquid_query_radius_m,
    homogeneous_liquid_certificate
  );
  if (
    !ss_exact_near_finite(query_radius_m)
    || !ss_exact_near_finite(global_max_wall_projection_m)
    || query_radius_m <= 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    source_counts[self_index] = 0u;
    return;
  }

  var local_rank = 0u;
  var candidate_count = 0u;
  var projected_peer_visit_count = 0u;
  var staged_count = 0u;
  var overflow_count = 0u;
  var aggregate_node_visit_count = 0u;
  var aggregate_pruned_node_count = 0u;
  var malformed = false;
  // ULG_MECHANICAL_AGGREGATE_BRANCH_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    let total_record_count = spatial_aggregate_view[54u];
    let leaf_count = spatial_aggregate_view[23u];
    let root_record_index = spatial_aggregate_view[53u];
    let hierarchy_padding_m = max(
      query_radius_m * 0.000001,
      spatial_expectation.base_grid_spacing_m * 0.000001
    );
    let hierarchy_radius_m = query_radius_m + hierarchy_padding_m;
    let hierarchy_radius_squared = hierarchy_radius_m * hierarchy_radius_m;
    // For a same-material liquid pair, the exact overlap predicate is bounded
    // by half the two diameters plus the swept displacement of each endpoint.
    // Combining this source's certified support with the generation maxima is
    // reciprocal and strictly tighter than charging both endpoints the maxima.
    let liquid_radius_m = 0.5 * (
      max(self_diameter_m, 0.0) + max(global_max_diameter, 0.0)
    )
      + max(self_displacement_m, 0.0)
      + max(global_max_displacement_m, 0.0)
      + hierarchy_padding_m;
    let liquid_radius_squared = liquid_radius_m * liquid_radius_m;
    let summary_preflight = atomicLoad(&global_support_bits[3u]);
    let summary_pruning_admitted =
      (summary_preflight & 0x80000000u) == 0u
      && (summary_preflight & 0x7fffffffu)
        == mechanical_params.particle_count;
    let self_material_id = u32(round(bitcast<f32>(self_endpoint.material_bits)));
    let self_domain_id = self_endpoint.domain_id;
    var record_index = root_record_index;
    var visited_record_count = 0u;
    if (
      !ss_exact_near_finite(hierarchy_radius_squared)
      || hierarchy_radius_squared <= 0.0
      || !ss_exact_near_finite(liquid_radius_squared)
      || liquid_radius_squared <= 0.0
    ) {
      malformed = true;
    }
    loop {
      if (malformed || record_index == MECHANICAL_AGGREGATE_INVALID_U32) {
        break;
      }
      if (
        visited_record_count >= total_record_count
        || record_index >= total_record_count
      ) {
        malformed = true;
        break;
      }
      visited_record_count = visited_record_count + 1u;
      aggregate_node_visit_count = aggregate_node_visit_count + 1u;
      let record_base = mechanical_aggregate_record_base(record_index);
      let record_status = spatial_aggregate_view[record_base + 27u];
      let is_leaf = (
        record_status & MECHANICAL_AGGREGATE_RECORD_LEAF
      ) != 0u;
      let escape_record_index = spatial_aggregate_view[record_base + 37u];
      let record_particle_count = spatial_aggregate_view[record_base + 19u];
      if (record_particle_count == 0u) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      let record_phase_mask = spatial_aggregate_view[record_base + 24u];
      let homogeneous_material_id = spatial_aggregate_view[record_base + 25u];
      let homogeneous_phase_id = spatial_aggregate_view[record_base + 26u];
      let homogeneous_domain_id = spatial_aggregate_view[record_base + 42u];
      let domain_summary_exact = (
        record_status & MECHANICAL_AGGREGATE_RECORD_DOMAIN_SUMMARY_EXACT
      ) != 0u;
      if (
        summary_pruning_admitted
        && domain_summary_exact
        && (record_phase_mask & 0x00000006u) == 0u
      ) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      let same_body_solid_subtree = summary_pruning_admitted
        && domain_summary_exact
        && self_phase_class == 2u
        && homogeneous_material_id == self_material_id
        && homogeneous_phase_id == 1u
        && (
          mechanical_params.identity_enabled == 0u
          || self_domain_id == 0u
          || homogeneous_domain_id == 0u
          || (
            homogeneous_domain_id != MECHANICAL_AGGREGATE_INVALID_U32
            && homogeneous_domain_id == self_domain_id
          )
        );
      if (same_body_solid_subtree) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      let same_material_liquid_subtree = summary_pruning_admitted
        && domain_summary_exact
        && self_phase_class == 1u
        && homogeneous_material_id == self_material_id
        && homogeneous_phase_id == 2u;
      // Empty, irrelevant-phase, and same-body solid records need no geometry.
      // Delay the six AABB loads until metadata pruning has failed.
      let minimum = vec3<f32>(
        bitcast<f32>(spatial_aggregate_view[record_base + 12u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 13u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 14u])
      );
      let maximum = vec3<f32>(
        bitcast<f32>(spatial_aggregate_view[record_base + 15u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 16u]),
        bitcast<f32>(spatial_aggregate_view[record_base + 17u])
      );
      let record_radius_squared = select(
        hierarchy_radius_squared,
        liquid_radius_squared,
        same_material_liquid_subtree
      );
      let aggregate_intersects = mechanical_aggregate_squared_distance_to_aabb(
        self_epoch_position,
        minimum,
        maximum
      ) <= record_radius_squared;
      if (!aggregate_intersects) {
        aggregate_pruned_node_count = aggregate_pruned_node_count + 1u;
        record_index = escape_record_index;
        continue;
      }
      if (is_leaf) {
        let cell_index = spatial_aggregate_view[record_base + 35u];
        if (cell_index != record_index || cell_index >= leaf_count) {
          malformed = true;
          break;
        }
        let cell_level_order = ss_exact_near_cell_key_word(
          spatial_expectation,
          cell_index,
          1u
        );
        let cell_level = bitcast<i32>(cell_level_order ^ 0x80000000u);
        let cell_spacing_m = spatial_expectation.base_grid_spacing_m
          * exp2(f32(cell_level));
        let cell_coordinates = vec3<f32>(
          f32(bitcast<i32>(ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            2u
          ) ^ 0x80000000u)),
          f32(bitcast<i32>(ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            3u
          ) ^ 0x80000000u)),
          f32(bitcast<i32>(ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            4u
          ) ^ 0x80000000u))
        );
        let cell_minimum = cell_coordinates * cell_spacing_m;
        let cell_maximum = (cell_coordinates + vec3<f32>(1.0))
          * cell_spacing_m;
        let selected_level = mechanical_params.apply_selected_level
          == -2147483648
          || cell_level == mechanical_params.apply_selected_level;
        let cell_intersects = mechanical_aggregate_squared_distance_to_aabb(
          self_epoch_position,
          cell_minimum,
          cell_maximum
        ) <= record_radius_squared;
        if (selected_level && cell_intersects) {
          mechanical_graph_materialize_cell(
            self_cache,
            cell_index,
            self_source_cell.source_index,
            record_particle_count,
            true,
            &local_rank,
            &candidate_count,
            &projected_peer_visit_count,
            &staged_count,
            &overflow_count,
            &malformed
          );
        }
        record_index = escape_record_index;
        continue;
      }
      let left_child = spatial_aggregate_view[record_base + 33u];
      record_index = left_child;
    }
  } else {
  // ULG_MECHANICAL_FLAT_BODY_BEGIN
  let directory_padding_m = max(
    query_radius_m * 0.000001,
    spatial_expectation.base_grid_spacing_m * 0.000001
  );
  let directory_radius_m = query_radius_m + directory_padding_m;
  let directory_radius_squared = directory_radius_m * directory_radius_m;
  for (
    var level_ordinal = 0u;
    level_ordinal < spatial_expectation.level_count;
    level_ordinal = level_ordinal + 1u
  ) {
    if (!ss_exact_near_level_occupied(spatial_expectation, level_ordinal)) {
      continue;
    }
    let level = spatial_expectation.min_level + i32(level_ordinal);
    if (
      mechanical_params.apply_selected_level != -2147483648
      && level != mechanical_params.apply_selected_level
    ) {
      continue;
    }
    let spacing_m = spatial_expectation.base_grid_spacing_m * exp2(f32(level));
    if (!ss_exact_near_finite(spacing_m) || spacing_m <= 0.0) {
      malformed = true;
      break;
    }
    let center_cell = vec3<i32>(floor(self_epoch_position / spacing_m));
    let radius_cells = max(
      0,
      i32(min(ceil(query_radius_m / spacing_m), 2147483520.0))
    );
    let minimum_cell = vec3<i32>(
      ss_exact_near_saturating_sub_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_sub_radius(center_cell.z, radius_cells)
    );
    let maximum_cell = vec3<i32>(
      ss_exact_near_saturating_add_radius(center_cell.x, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.y, radius_cells),
      ss_exact_near_saturating_add_radius(center_cell.z, radius_cells)
    );
    let level_order = ss_exact_near_signed_order_key(level);
    let minimum_order = vec3<u32>(
      ss_exact_near_signed_order_key(minimum_cell.x),
      ss_exact_near_signed_order_key(minimum_cell.y),
      ss_exact_near_signed_order_key(minimum_cell.z)
    );
    let maximum_order = vec3<u32>(
      ss_exact_near_signed_order_key(maximum_cell.x),
      ss_exact_near_signed_order_key(maximum_cell.y),
      ss_exact_near_signed_order_key(maximum_cell.z)
    );
    let level_begin = ss_exact_near_lower_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0u)
    );
    let level_end = ss_exact_near_upper_bound_cell_key(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(0xffffffffu)
    );
    var x_cursor = ss_exact_near_lower_bound_cell_key_range(
      spatial_expectation,
      spatial_expectation.chart_id,
      level_order,
      vec3<u32>(minimum_order.x, 0u, 0u),
      level_begin,
      level_end
    );
    for (
      var x_iteration = 0u;
      x_iteration < spatial_expectation.source_count && x_cursor < level_end;
      x_iteration = x_iteration + 1u
    ) {
      let x_order = ss_exact_near_cell_key_word(
        spatial_expectation,
        x_cursor,
        2u
      );
      if (x_order > maximum_order.x) {
        x_cursor = level_end;
        continue;
      }
      let x_end = ss_exact_near_upper_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, 0xffffffffu, 0xffffffffu),
        x_cursor,
        level_end
      );
      if (x_end <= x_cursor) { malformed = true; break; }
      var y_cursor = ss_exact_near_lower_bound_cell_key_range(
        spatial_expectation,
        spatial_expectation.chart_id,
        level_order,
        vec3<u32>(x_order, minimum_order.y, 0u),
        x_cursor,
        x_end
      );
      for (
        var y_iteration = 0u;
        y_iteration < spatial_expectation.source_count && y_cursor < x_end;
        y_iteration = y_iteration + 1u
      ) {
        let y_order = ss_exact_near_cell_key_word(
          spatial_expectation,
          y_cursor,
          3u
        );
        if (y_order > maximum_order.y) {
          y_cursor = x_end;
          continue;
        }
        let y_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, 0xffffffffu),
          y_cursor,
          x_end
        );
        if (y_end <= y_cursor) { malformed = true; break; }
        let z_begin = ss_exact_near_lower_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, minimum_order.z),
          y_cursor,
          y_end
        );
        let z_end = ss_exact_near_upper_bound_cell_key_range(
          spatial_expectation,
          spatial_expectation.chart_id,
          level_order,
          vec3<u32>(x_order, y_order, maximum_order.z),
          z_begin,
          y_end
        );
        for (
          var cell_index = z_begin;
          cell_index < z_end;
          cell_index = cell_index + 1u
        ) {
          let z_order = ss_exact_near_cell_key_word(
            spatial_expectation,
            cell_index,
            4u
          );
          let cell_coordinates = vec3<f32>(
            f32(bitcast<i32>(x_order ^ 0x80000000u)),
            f32(bitcast<i32>(y_order ^ 0x80000000u)),
            f32(bitcast<i32>(z_order ^ 0x80000000u))
          );
          let cell_minimum = cell_coordinates * spacing_m;
          let cell_maximum = (cell_coordinates + vec3<f32>(1.0))
            * spacing_m;
          let cell_intersects =
            mechanical_graph_squared_distance_to_aabb(
              self_epoch_position,
              cell_minimum,
              cell_maximum
            ) <= directory_radius_squared;
          if (cell_intersects) {
            mechanical_graph_materialize_cell(
              self_cache,
              cell_index,
              self_source_cell.source_index,
              0u,
              false,
              &local_rank,
              &candidate_count,
              &projected_peer_visit_count,
              &staged_count,
              &overflow_count,
              &malformed
            );
          }
          if (malformed) { break; }
        }
        if (malformed) { break; }
        y_cursor = y_end;
      }
      if (malformed || y_cursor < x_end) {
        malformed = true;
        break;
      }
      x_cursor = x_end;
    }
    if (malformed || x_cursor < level_end) {
      malformed = true;
      break;
    }
  }
  // ULG_MECHANICAL_FLAT_BODY_END
  }
  // ULG_MECHANICAL_AGGREGATE_BRANCH_END
  source_counts[self_index] = local_rank;
  mechanical_graph_evidence_saturating_add(15u, staged_count);
  mechanical_graph_evidence_saturating_add(18u, overflow_count);
  if (!mechanical_graph_evidence_saturating_add(14u, local_rank)) {
    malformed = true;
  }
  if (!mechanical_graph_evidence_saturating_add(
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.candidateVisitCount}u,
    candidate_count
  )) {
    malformed = true;
  }
  if (!mechanical_graph_evidence_saturating_add(
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.projectedPeerVisitCount}u,
    projected_peer_visit_count
  )) {
    malformed = true;
  }
  // ULG_MECHANICAL_AGGREGATE_EVIDENCE_BEGIN
  if (
    MECHANICAL_AGGREGATE_HIERARCHY_COMPILED
    && mechanical_params.aggregate_hierarchy_enabled != 0u
  ) {
    mechanical_graph_evidence_saturating_add(
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateHierarchyNodeVisitCount}u,
      aggregate_node_visit_count
    );
    mechanical_graph_evidence_saturating_add(
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateHierarchyPrunedNodeCount}u,
      aggregate_pruned_node_count
    );
    mechanical_graph_evidence_saturating_add(
      ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.aggregateHierarchySourceCount}u,
      1u
    );
  }
  // ULG_MECHANICAL_AGGREGATE_EVIDENCE_END
  if (candidate_count == 0xffffffffu) {
    malformed = true;
  }
  if (malformed) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MALFORMED_TRAVERSAL}u
    );
  }
}

`;

function createSchroederSpatialMechanicalProposalFlatWgsl(
  source,
  { activeRankView = false } = {}
) {
  const section = (text, beginMarker, endMarker) => {
    const begin = text.indexOf(beginMarker);
    const end = text.indexOf(endMarker, begin + beginMarker.length);
    if (begin < 0 || end < 0) {
      throw new Error(`mechanical WGSL specialization marker missing: ${beginMarker}`);
    }
    return { begin, end };
  };
  const helperBeginMarker = '// ULG_MECHANICAL_AGGREGATE_HELPERS_BEGIN';
  const helperEndMarker = '// ULG_MECHANICAL_AGGREGATE_HELPERS_END';
  const helper = section(source, helperBeginMarker, helperEndMarker);
  const projectionAdmission = activeRankView
    ? 'return mechanical_active_rank_view_admitted();'
    : 'return mechanical_params.aggregate_hierarchy_enabled == 0u;';
  let flat = `${source.slice(0, helper.begin)}
fn mechanical_aggregate_view_admitted() -> bool {
  ${projectionAdmission}
}
fn mechanical_aggregate_record_preflight(record_index: u32) -> bool {
  return false;
}
${source.slice(helper.end + helperEndMarker.length)}`;
  const preflightBeginMarker = '// ULG_MECHANICAL_AGGREGATE_PREFLIGHT_BEGIN';
  const preflightEndMarker = '// ULG_MECHANICAL_AGGREGATE_PREFLIGHT_END';
  const preflight = section(flat, preflightBeginMarker, preflightEndMarker);
  flat = `${flat.slice(0, preflight.begin)}${flat.slice(
    preflight.end + preflightEndMarker.length
  )}`;
  const sealBeginMarker = '// ULG_MECHANICAL_AGGREGATE_SEAL_BEGIN';
  const sealEndMarker = '// ULG_MECHANICAL_AGGREGATE_SEAL_END';
  const seal = section(flat, sealBeginMarker, sealEndMarker);
  flat = `${flat.slice(0, seal.begin)}${flat.slice(
    seal.end + sealEndMarker.length
  )}`;
  const branchBeginMarker = '// ULG_MECHANICAL_AGGREGATE_BRANCH_BEGIN';
  const flatBodyBeginMarker = '// ULG_MECHANICAL_FLAT_BODY_BEGIN';
  const flatBodyEndMarker = '// ULG_MECHANICAL_FLAT_BODY_END';
  const branchEndMarker = '// ULG_MECHANICAL_AGGREGATE_BRANCH_END';
  const branch = section(flat, branchBeginMarker, branchEndMarker);
  const flatBody = section(flat, flatBodyBeginMarker, flatBodyEndMarker);
  if (flatBody.begin < branch.begin || flatBody.end > branch.end) {
    throw new Error('mechanical WGSL flat specialization markers are misordered');
  }
  flat = `${flat.slice(0, branch.begin)}${flat.slice(
    flatBody.begin + flatBodyBeginMarker.length,
    flatBody.end
  )}${flat.slice(branch.end + branchEndMarker.length)}`;
  const evidenceBeginMarker = '// ULG_MECHANICAL_AGGREGATE_EVIDENCE_BEGIN';
  const evidenceEndMarker = '// ULG_MECHANICAL_AGGREGATE_EVIDENCE_END';
  const evidence = section(flat, evidenceBeginMarker, evidenceEndMarker);
  flat = `${flat.slice(0, evidence.begin)}${flat.slice(
    evidence.end + evidenceEndMarker.length
  )}`;
  return flat
    .replace(
      'const MECHANICAL_AGGREGATE_HIERARCHY_COMPILED: bool = true;',
      'const MECHANICAL_AGGREGATE_HIERARCHY_COMPILED: bool = false;'
    )
    .replace(
      'const MECHANICAL_ACTIVE_RANK_VIEW_COMPILED: bool = false;',
      `const MECHANICAL_ACTIVE_RANK_VIEW_COMPILED: bool = ${
        activeRankView ? 'true' : 'false'
      };`
    )
    .replace('  var aggregate_node_visit_count = 0u;\n', '')
    .replace('  var aggregate_pruned_node_count = 0u;\n', '');
}

export const schroederSpatialMechanicalProposalFlatWgsl =
  createSchroederSpatialMechanicalProposalFlatWgsl(
    schroederSpatialMechanicalProposalWgsl
  );

export const schroederSpatialMechanicalProposalActiveRankWgsl =
  createSchroederSpatialMechanicalProposalFlatWgsl(
    schroederSpatialMechanicalProposalWgsl,
    { activeRankView: true }
  );

export const schroederSpatialMechanicalGraphControlWgsl = /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read_write> source_counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> source_offsets: array<u32>;
@group(0) @binding(2) var<storage, read_write> append_records: array<u32>;
@group(0) @binding(3) var<storage, read_write> csr_peers: array<u32>;
@group(0) @binding(4) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> proposal_rows: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read_write> particle_scales: array<vec4<f32>>;
@group(0) @binding(8) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(9) var<storage, read_write> global_support_bits: array<atomic<u32>>;

fn mechanical_graph_control_header_valid() -> bool {
  return arrayLength(&graph_control)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u
    && atomicLoad(&graph_control[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
    && atomicLoad(&graph_control[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
    && atomicLoad(&graph_control[2u]) == mechanical_params.generation_id
    && atomicLoad(&graph_control[3u]) == mechanical_params.storage_generation
    && atomicLoad(&graph_control[4u]) == mechanical_params.physics_tick
    && atomicLoad(&graph_control[5u]) == mechanical_params.physics_substep
    && atomicLoad(&graph_control[6u]) == mechanical_params.position_epoch
    && atomicLoad(&graph_control[7u]) == mechanical_params.topology_epoch
    && atomicLoad(&graph_control[8u]) == mechanical_params.support_epoch
    && bitcast<i32>(atomicLoad(&graph_control[9u]))
      == mechanical_params.apply_selected_level
    && atomicLoad(&graph_control[10u])
      == mechanical_params.directed_pair_capacity;
}

fn mechanical_graph_control_lineage_layout_valid() -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  let lane_count = mechanical_params.phase_lane_count;
  if (capacity == 0u || lane_count == 0u) {
    return capacity == 0u && lane_count == 0u;
  }
  return lane_count == 4u
    && capacity <= 0xffffffffu / lane_count
    && capacity * lane_count == mechanical_params.particle_count;
}

fn mechanical_graph_control_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn mechanical_graph_control_fail(bit: u32) {
  atomicOr(&graph_control[14u], bit);
}

fn mechanical_graph_store_conditional_dispatch(
  word_offset: u32,
  dispatch_x: u32
) {
  atomicStore(&graph_control[word_offset], dispatch_x);
  atomicStore(&graph_control[word_offset + 1u], 1u);
  atomicStore(&graph_control[word_offset + 2u], 1u);
}

@compute @workgroup_size(64)
fn initialize_contact_graph(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  source_counts[particle_index] = 0u;
  source_offsets[particle_index] = 0u;
  particle_scales[particle_index] = vec4<f32>(1.0);
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(0.0);
  if (particle_index != 0u) { return; }
  for (var word = 0u;
    word < ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u;
    word = word + 1u) {
    atomicStore(&graph_control[word], 0u);
  }
  atomicStore(
    &graph_control[0u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
  );
  atomicStore(
    &graph_control[1u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
  );
  atomicStore(&graph_control[2u], mechanical_params.generation_id);
  atomicStore(&graph_control[3u], mechanical_params.storage_generation);
  atomicStore(&graph_control[4u], mechanical_params.physics_tick);
  atomicStore(&graph_control[5u], mechanical_params.physics_substep);
  atomicStore(&graph_control[6u], mechanical_params.position_epoch);
  atomicStore(&graph_control[7u], mechanical_params.topology_epoch);
  atomicStore(&graph_control[8u], mechanical_params.support_epoch);
  atomicStore(
    &graph_control[9u],
    bitcast<u32>(mechanical_params.apply_selected_level)
  );
  atomicStore(
    &graph_control[10u],
    mechanical_params.directed_pair_capacity
  );
  atomicStore(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}u
  );
  // The following support-reduction dispatch authors this certificate.  It
  // starts unset so no source can mistake a fresh all-zero buffer for a
  // homogeneous liquid population before every active endpoint has checked
  // its phase and material identity.
  atomicStore(
    &global_support_bits[${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_MATERIAL_WORD}u],
    ${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_UNSET}u
  );
  atomicStore(
    &global_support_bits[${MECHANICAL_SUPPORT_HOMOGENEOUS_LIQUID_REJECTION_WORD}u],
    0u
  );
  atomicStore(&graph_control[29u], 0u);
  atomicStore(&graph_control[30u], 1u);
  atomicStore(&graph_control[31u], 1u);
  source_offsets[mechanical_params.particle_count] = 0u;
  source_offsets[arrayLength(&source_counts)] = 0u;
}

@compute @workgroup_size(1)
fn finalize_contact_graph_counts() {
  if (
    !mechanical_graph_control_header_valid()
    || !mechanical_graph_control_lineage_layout_valid()
    || (
      atomicLoad(&graph_control[15u])
        & (
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}
          | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}
          | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}
        )
    ) != (
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}
    )
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
  }
  let particle_count = mechanical_params.particle_count;
  let last_index = particle_count - 1u;
  let last_offset = source_offsets[last_index];
  let last_count = source_counts[last_index];
  var required_count = 0xffffffffu;
  if (last_offset <= 0xffffffffu - last_count) {
    required_count = last_offset + last_count;
  } else {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
    );
  }
  source_offsets[particle_count] = required_count;
  source_offsets[arrayLength(&source_counts)] = required_count;
  atomicStore(&graph_control[12u], required_count);
  atomicStore(&traversal_evidence[16u], required_count);
  let append_attempt_count = atomicLoad(&graph_control[11u]);
  atomicStore(&traversal_evidence[14u], append_attempt_count);
  if (required_count != append_attempt_count) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.SCAN_COUNT_MISMATCH}u
    );
  }
  if (
    required_count > mechanical_params.directed_pair_capacity
    || append_attempt_count > mechanical_params.directed_pair_capacity
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.GRAPH_CAPACITY}u
    );
  }
  atomicAdd(&traversal_evidence[24u], 1u);
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
  );
  if (atomicLoad(&graph_control[14u]) == 0u) {
    atomicStore(
      &graph_control[29u],
      (required_count + 63u) / 64u
    );
    if (required_count == 0u) {
      atomicOr(
        &graph_control[15u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
      );
    }
  } else {
    atomicStore(&graph_control[29u], 0u);
  }
  let path_admitted = atomicLoad(&graph_control[14u]) == 0u;
  let particle_workgroups = (
    mechanical_params.particle_count + 63u
  ) / 64u;
  let has_directed_pairs = required_count != 0u;
  // A zero CSR alone cannot bypass the normal solver: its wall projection is
  // still a real mechanical law. The support reduction provides an exact
  // current-state wall certificate, so only an admitted zero graph with no
  // possible wall projection takes the zero-edge completion path.
  let no_wall_projection = arrayLength(&global_support_bits) >= 3u
    && bitcast<f32>(atomicLoad(&global_support_bits[2u])) == 0.0;
  let zero_edge_path = path_admitted
    && !has_directed_pairs
    && no_wall_projection;
  atomicStore(
    &graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .fullSolverPath}u],
    select(0u, 1u, path_admitted && !zero_edge_path)
  );
  mechanical_graph_store_conditional_dispatch(
    ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchX}u,
    select(0u, particle_workgroups, zero_edge_path)
  );
}

@compute @workgroup_size(64)
fn scatter_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let append_index = global_id.x;
  let total = atomicLoad(&graph_control[12u]);
  if (
    append_index >= total
    || atomicLoad(&graph_control[14u]) != 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
    ) == 0u
  ) { return; }
  let append_base = append_index * 3u;
  let self_index = append_records[append_base];
  let other_index = append_records[append_base + 1u];
  let local_rank = append_records[append_base + 2u];
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || local_rank >= source_counts[self_index]
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[20u], 1u);
    return;
  }
  let source_offset = source_offsets[self_index];
  if (
    source_offset > total
    || local_rank > total - source_offset
    || source_offset + local_rank >= total
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[19u], 1u);
    return;
  }
  csr_peers[source_offset + local_rank] = other_index;
  atomicAdd(&graph_control[13u], 1u);
  if (append_index == 0u) {
    atomicAdd(&traversal_evidence[25u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    );
  }
}

fn mechanical_graph_control_peer_hash(peer_index: u32, slot_count: u32) -> u32 {
  return (peer_index * 2654435761u) % max(slot_count, 1u);
}

// The staging arena is dead after CSR scatter. Reuse its three words per
// directed edge as a source-local exact peer set. One invocation owns each
// source segment, so construction is race-free; the following dispatch is the
// storage barrier before reciprocal lookup. At one-third load, successful and
// missing probes remain bounded without the former degree-squared scans.
@compute @workgroup_size(64)
fn index_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  // The finalizer has authenticated a complete zero-edge graph and selected
  // the separate zero-edge completion dispatch.  Do not manufacture normal
  // graph-verification evidence here: that path is completed atomically by
  // the zero-edge kernel after the direct CSR stages have been bypassed.
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (
    self_index >= mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[13u]) != atomicLoad(&graph_control[12u])
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    ) == 0u
  ) { return; }
  let total = atomicLoad(&graph_control[12u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total || end - begin != source_counts[self_index]) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  let degree = end - begin;
  let table_begin = begin * 3u;
  let slot_count = degree * 3u;
  for (var slot = 0u; slot < slot_count; slot = slot + 1u) {
    append_records[table_begin + slot] = 0xffffffffu;
  }
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let peer_index = csr_peers[cursor];
    var slot = mechanical_graph_control_peer_hash(peer_index, slot_count);
    var inserted = false;
    for (var probe = 0u; probe < slot_count; probe = probe + 1u) {
      let table_index = table_begin + slot;
      let resident_peer = append_records[table_index];
      if (resident_peer == 0xffffffffu) {
        append_records[table_index] = peer_index;
        inserted = true;
        break;
      }
      if (resident_peer == peer_index) {
        mechanical_graph_control_fail(
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.DUPLICATE_ENDPOINT}u
        );
        atomicAdd(&traversal_evidence[21u], 1u);
        inserted = true;
        break;
      }
      slot = (slot + 1u) % slot_count;
    }
    if (!inserted) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.COUNTER_OVERFLOW}u
      );
      return;
    }
  }
}

fn mechanical_graph_control_row_contains(
  source_index: u32,
  peer_index: u32,
  total: u32
) -> bool {
  let begin = source_offsets[source_index];
  let end = source_offsets[source_index + 1u];
  if (begin > end || end > total) { return false; }
  let degree = end - begin;
  if (degree == 0u) { return false; }
  let table_begin = begin * 3u;
  let slot_count = degree * 3u;
  var slot = mechanical_graph_control_peer_hash(peer_index, slot_count);
  for (var probe = 0u; probe < slot_count; probe = probe + 1u) {
    let resident_peer = append_records[table_begin + slot];
    if (resident_peer == peer_index) { return true; }
    if (resident_peer == 0xffffffffu) { return false; }
    slot = (slot + 1u) % slot_count;
  }
  return false;
}

@compute @workgroup_size(64)
fn validate_contact_graph_csr(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (self_index >= mechanical_params.particle_count) { return; }
  if (atomicLoad(&graph_control[14u]) != 0u) { return; }
  if (
    atomicLoad(&graph_control[13u])
      != atomicLoad(&graph_control[12u])
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u
    ) == 0u
  ) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
    return;
  }
  let total = atomicLoad(&graph_control[12u]);
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  if (begin > end || end > total || end - begin != source_counts[self_index]) {
    mechanical_graph_control_fail(
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    atomicAdd(&traversal_evidence[19u], 1u);
    return;
  }
  var source_valid = true;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = csr_peers[cursor];
    if (
      other_index >= mechanical_params.particle_count
      || other_index == self_index
    ) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
      );
      atomicAdd(&traversal_evidence[20u], 1u);
      source_valid = false;
      continue;
    }
    if (mechanical_graph_control_same_phase_lineage(
      self_index,
      other_index
    )) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
      );
      atomicAdd(&traversal_evidence[20u], 1u);
      source_valid = false;
      continue;
    }
    if (!mechanical_graph_control_row_contains(
      other_index,
      self_index,
      total
    )) {
      mechanical_graph_control_fail(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.MISSING_RECIPROCAL}u
      );
      atomicAdd(&traversal_evidence[22u], 1u);
      source_valid = false;
    }
  }
  if (source_valid) {
    atomicAdd(&graph_control[16u], 1u);
  }
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[26u], 1u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
    );
  }
}
`;

export const schroederSpatialMechanicalGraphSolverWgsl = /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> input_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> output_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source_thermo: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> source_mechanics: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> source_identity: array<u32>;
@group(0) @binding(5) var<storage, read_write> csr_peers: array<u32>;
@group(0) @binding(6) var<storage, read> source_offsets: array<u32>;
@group(0) @binding(7) var<storage, read_write> particle_scales: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(9) var<storage, read> spatial_source_rows: array<f32>;
@group(0) @binding(10) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(11) var<uniform> mechanical_params: MechanicalProposalParams;
@group(0) @binding(12) var<storage, read_write> energy_ledger: array<vec4<f32>>;

struct MechanicalPairResidual {
  barrier_dx: vec3<f32>,
  barrier_dv: vec3<f32>,
  soft_dx: vec3<f32>,
  soft_dv: vec3<f32>,
  velocity_normal: vec3<f32>,
  position_residual: f32,
  velocity_residual: f32,
  unilateral: u32,
  active_pair: u32,
  valid: u32,
};

// particleCount is constructor-bounded below 2^31, so the peer high bit is a
// solver-private cache lane. Measure owns each directed CSR row and records
// whether the edge has a law in the unchanged iteration input. Solve and
// energy allocation can then skip the broad retained closure edges that were
// measured inactive without evaluating the swept pair law two more times.
// Final residual verification restores the public peer indices before the
// graph can be published or retained by another consumer.
const MECHANICAL_SOLVER_EDGE_INACTIVE_BIT: u32 = 0x80000000u;
const MECHANICAL_SOLVER_EDGE_PEER_MASK: u32 = 0x7fffffffu;

fn mechanical_solver_full_path_enabled() -> bool {
  return atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) != 0u;
}

fn mechanical_solver_peer_index(encoded_peer: u32) -> u32 {
  return encoded_peer & MECHANICAL_SOLVER_EDGE_PEER_MASK;
}

fn mechanical_solver_edge_inactive(encoded_peer: u32) -> bool {
  return (encoded_peer & MECHANICAL_SOLVER_EDGE_INACTIVE_BIT) != 0u;
}

fn mechanical_solver_encode_measured_peer(
  peer_index: u32,
  edge_is_active: bool
) -> u32 {
  return peer_index | select(
    MECHANICAL_SOLVER_EDGE_INACTIVE_BIT,
    0u,
    edge_is_active
  );
}

fn mechanical_solver_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn mechanical_solver_finite3(value: vec3<f32>) -> bool {
  return mechanical_solver_finite(value.x)
    && mechanical_solver_finite(value.y)
    && mechanical_solver_finite(value.z);
}

fn mechanical_solver_zero_pair(valid: u32) -> MechanicalPairResidual {
  return MechanicalPairResidual(
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    vec3<f32>(0.0),
    0.0,
    0.0,
    0u,
    0u,
    valid
  );
}

fn mechanical_solver_cbrt(volume_m3: f32) -> f32 {
  return pow(max(volume_m3, 1.0e-18), 1.0 / 3.0);
}

fn mechanical_solver_source_row_base(index: u32) -> u32 {
  return index * 16u;
}

fn mechanical_solver_epoch_position(index: u32) -> vec3<f32> {
  let base = mechanical_solver_source_row_base(index);
  return vec3<f32>(
    spatial_source_rows[base + 12u],
    spatial_source_rows[base + 13u],
    spatial_source_rows[base + 14u]
  );
}

fn mechanical_solver_selected(index: u32) -> bool {
  // The verified CSR graph already carries the constructor-bound level
  // selection. The solver must consume that graph, not reinterpret either of
  // the two admitted 16-float spatial-source row ABIs.
  return index < mechanical_params.particle_count;
}

fn mechanical_solver_phase_class(index: u32) -> u32 {
  let row5 = source_mechanics[index * 8u + 5u];
  let row6 = source_mechanics[index * 8u + 6u];
  if (row5.x > 0.5) { return 2u; }
  if (row6.z > 0.5 && row6.z < 1.5) { return 1u; }
  return 0u;
}

fn mechanical_solver_same_phase_lineage(
  self_index: u32,
  other_index: u32
) -> bool {
  let capacity = mechanical_params.phase_lineage_capacity;
  return capacity > 0u
    && mechanical_params.phase_lane_count > 1u
    && self_index < capacity * mechanical_params.phase_lane_count
    && other_index < capacity * mechanical_params.phase_lane_count
    && self_index % capacity == other_index % capacity;
}

fn mechanical_solver_same_body_solid_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  if (
    mechanical_solver_phase_class(self_index) != 2u
    || mechanical_solver_phase_class(other_index) != 2u
  ) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return false; }
  if (mechanical_params.identity_enabled == 0u) { return true; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain == 0u
    || other_domain == 0u
    || self_domain == other_domain;
}

fn mechanical_solver_unilateral_pair(
  self_index: u32,
  other_index: u32
) -> bool {
  let self_class = mechanical_solver_phase_class(self_index);
  let other_class = mechanical_solver_phase_class(other_index);
  if (self_class == 0u || other_class == 0u) { return false; }
  let self_material = source_thermo[self_index * 3u].x;
  let other_material = source_thermo[other_index * 3u].x;
  if (abs(self_material - other_material) >= 0.5) { return true; }
  let solid_liquid_interface = (self_class == 2u && other_class == 1u)
    || (self_class == 1u && other_class == 2u);
  if (solid_liquid_interface) { return true; }
  if (
    self_class != 2u
    || other_class != 2u
    || mechanical_params.identity_enabled == 0u
  ) { return false; }
  let self_domain = source_identity[self_index];
  let other_domain = source_identity[other_index];
  return self_domain != 0u
    && other_domain != 0u
    && self_domain != other_domain;
}

fn mechanical_solver_coincidence_normal(
  self_index: u32,
  other_index: u32
) -> vec3<f32> {
  let low_index = min(self_index, other_index);
  var h = low_index * 2654435761u + 0x9e3779b9u;
  h = (h ^ (h >> 16u)) * 2246822519u;
  h = h ^ (h >> 13u);
  let raw = vec3<f32>(
    f32(h & 1023u) / 511.5 - 1.0,
    f32((h >> 10u) & 1023u) / 511.5 - 1.0,
    f32((h >> 20u) & 1023u) / 511.5 - 1.0
  );
  let raw_length = length(raw);
  let normalized = select(
    vec3<f32>(0.0, 1.0, 0.0),
    raw / max(raw_length, 1.0e-6),
    raw_length > 1.0e-4
  );
  return normalized * select(-1.0, 1.0, self_index > other_index);
}

fn mechanical_solver_pair_response(
  self_index: u32,
  other_index: u32,
  self_mass: f32,
  other_mass: f32,
  overlap: f32,
  normal: vec3<f32>,
  unilateral: bool,
  include_soft: bool
) -> MechanicalPairResidual {
  let self_inverse_mass = 1.0 / max(self_mass, 1.0e-30);
  let other_inverse_mass = 1.0 / max(other_mass, 1.0e-30);
  let inverse_mass_share = self_inverse_mass
    / (self_inverse_mass + other_inverse_mass);
  let self_velocity = input_state[self_index * 2u + 1u].xyz;
  let other_velocity = input_state[other_index * 2u + 1u].xyz;
  let approach = dot(self_velocity - other_velocity, normal);
  var result = mechanical_solver_zero_pair(1u);
  result.active_pair = 1u;
  result.unilateral = select(0u, 1u, unilateral);
  result.position_residual = select(0.0, overlap, unilateral);
  result.velocity_residual = select(
    0.0,
    max(-approach, 0.0),
    unilateral
  );
  if (unilateral) {
    result.barrier_dx = inverse_mass_share * overlap * normal;
    if (approach < 0.0) {
      result.barrier_dv = -inverse_mass_share * approach * normal;
      result.velocity_normal = normal;
    }
  } else if (include_soft) {
    result.soft_dx = mechanical_params.relaxation
      * inverse_mass_share * overlap * normal;
    if (approach < 0.0) {
      result.soft_dv = -mechanical_params.normal_velocity_damping
        * inverse_mass_share * approach * normal;
      result.velocity_normal = normal;
    }
  }
  if (
    !mechanical_solver_finite3(result.barrier_dx)
    || !mechanical_solver_finite3(result.barrier_dv)
    || !mechanical_solver_finite3(result.soft_dx)
    || !mechanical_solver_finite3(result.soft_dv)
    || !mechanical_solver_finite3(result.velocity_normal)
    || !mechanical_solver_finite(result.position_residual)
    || !mechanical_solver_finite(result.velocity_residual)
  ) {
    result.valid = 0u;
  }
  return result;
}

fn mechanical_solver_pair(
  self_index: u32,
  other_index: u32,
  include_soft: bool
) -> MechanicalPairResidual {
  if (
    self_index >= mechanical_params.particle_count
    || other_index >= mechanical_params.particle_count
    || self_index == other_index
    || !mechanical_solver_selected(self_index)
    || !mechanical_solver_selected(other_index)
  ) { return mechanical_solver_zero_pair(0u); }
  if (mechanical_solver_same_phase_lineage(self_index, other_index)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.LEVEL_OR_SOURCE_IDENTITY}u
    );
    return mechanical_solver_zero_pair(1u);
  }
  let self_class = mechanical_solver_phase_class(self_index);
  let other_class = mechanical_solver_phase_class(other_index);
  if (
    self_class == 0u
    || other_class == 0u
    || mechanical_solver_same_body_solid_pair(self_index, other_index)
  ) { return mechanical_solver_zero_pair(0u); }
  let unilateral = mechanical_solver_unilateral_pair(self_index, other_index);
  // Non-unilateral pairs are optional same-material liquid relaxation. After
  // the first Jacobi round, and during strict residual verification, they have
  // no law to evaluate. Reject them before loading geometry or sweep history.
  if (!unilateral && !include_soft) {
    return mechanical_solver_zero_pair(1u);
  }
  let self_pos_mass = input_state[self_index * 2u];
  let other_pos_mass = input_state[other_index * 2u];
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  let other_volume = max(source_mechanics[other_index * 8u + 4u].w, 0.0);
  if (
    self_pos_mass.w <= 0.0
    || other_pos_mass.w <= 0.0
    || self_volume <= 0.0
    || other_volume <= 0.0
  ) { return mechanical_solver_zero_pair(1u); }
  let self_diameter = mechanical_solver_cbrt(self_volume);
  let other_diameter = mechanical_solver_cbrt(other_volume);
  let rest_distance = 0.5 * (self_diameter + other_diameter);
  let delta = self_pos_mass.xyz - other_pos_mass.xyz;
  var distance_m = length(delta);
  var overlap = max(rest_distance - distance_m, 0.0);
  // Soft liquid relaxation has no swept-impact semantics. Most retained broad
  // edges are currently separated, so reject them before any epoch reads. A
  // coincident pair alone consults the epoch direction as a stable fallback.
  if (!unilateral) {
    if (overlap <= 0.0) { return mechanical_solver_zero_pair(1u); }
    var soft_normal = vec3<f32>(0.0, 1.0, 0.0);
    if (distance_m > 1.0e-9) {
      soft_normal = delta / distance_m;
    } else {
      let soft_epoch_delta = mechanical_solver_epoch_position(self_index)
        - mechanical_solver_epoch_position(other_index);
      let soft_epoch_distance = length(soft_epoch_delta);
      soft_normal = select(
        mechanical_solver_coincidence_normal(self_index, other_index),
        soft_epoch_delta / max(soft_epoch_distance, 1.0e-30),
        soft_epoch_distance > 1.0e-9
      );
      distance_m = 0.0;
    }
    return mechanical_solver_pair_response(
      self_index,
      other_index,
      self_pos_mass.w,
      other_pos_mass.w,
      overlap,
      soft_normal,
      false,
      include_soft
    );
  }
  let epoch_delta = mechanical_solver_epoch_position(self_index)
    - mechanical_solver_epoch_position(other_index);
  let sweep_delta = delta - epoch_delta;
  let sweep_length_sq = dot(sweep_delta, sweep_delta);
  let closest_t = select(
    0.0,
    clamp(
      -dot(epoch_delta, sweep_delta) / max(sweep_length_sq, 1.0e-30),
      0.0,
      1.0
    ),
    sweep_length_sq > 1.0e-18
  );
  let closest_delta = epoch_delta + closest_t * sweep_delta;
  let swept_distance = length(closest_delta);
  let swept_contact = unilateral && swept_distance < rest_distance;
  if (overlap <= 0.0 && !swept_contact) {
    return mechanical_solver_zero_pair(1u);
  }
  var swept_impact_t = -1.0;
  var swept_impact_normal = vec3<f32>(0.0);
  if (swept_contact && sweep_length_sq > 1.0e-18) {
    let sweep_b = dot(epoch_delta, sweep_delta);
    let sweep_c = dot(epoch_delta, epoch_delta)
      - rest_distance * rest_distance;
    let sweep_discriminant = sweep_b * sweep_b - sweep_length_sq * sweep_c;
    if (
      sweep_c >= -1.0e-6 * max(rest_distance * rest_distance, 1.0)
      && sweep_discriminant >= 0.0
    ) {
      let entry_denominator = -sweep_b + sqrt(max(sweep_discriminant, 0.0));
      let candidate_t = select(
        -1.0,
        sweep_c / max(entry_denominator, 1.0e-30),
        entry_denominator > 1.0e-18
      );
      if (
        mechanical_solver_finite(candidate_t)
        && candidate_t >= -1.0e-6
        && candidate_t <= 1.000001
      ) {
        let impact_t = clamp(candidate_t, 0.0, 1.0);
        let impact_delta = epoch_delta + impact_t * sweep_delta;
        let impact_distance = length(impact_delta);
        if (impact_distance > 1.0e-9) {
          swept_impact_t = impact_t;
          swept_impact_normal = impact_delta / impact_distance;
        }
      }
    }
  }
  var normal = vec3<f32>(0.0, 1.0, 0.0);
  let cohort_inverted = swept_contact && dot(epoch_delta, delta) <= 0.0;
  if (swept_impact_t >= 0.0) {
    normal = swept_impact_normal;
    overlap = max(rest_distance - dot(delta, normal), 0.0);
  } else if (cohort_inverted && length(epoch_delta) > 1.0e-9) {
    normal = epoch_delta / length(epoch_delta);
    overlap = max(rest_distance - dot(delta, normal), 0.0);
  } else if (distance_m > 1.0e-9) {
    normal = delta / distance_m;
  } else if (swept_distance > 1.0e-9) {
    normal = closest_delta / swept_distance;
  } else {
    normal = mechanical_solver_coincidence_normal(self_index, other_index);
    distance_m = 0.0;
  }
  return mechanical_solver_pair_response(
    self_index,
    other_index,
    self_pos_mass.w,
    other_pos_mass.w,
    overlap,
    normal,
    true,
    include_soft
  );
}

fn mechanical_measure_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let previous_energy_ready = atomicLoad(
    &graph_control[31u + iteration]
  ) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & (1u << (12u + iteration))
    ) != 0u;
  let prior_ready = select(
    atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
      && (
        atomicLoad(&graph_control[15u])
          & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
      ) != 0u,
    previous_energy_ready,
    iteration > 0u
  );
  if (!prior_ready || atomicLoad(&graph_control[14u]) != 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!mechanical_solver_selected(self_index)) {
    particle_scales[self_index] = vec4<f32>(1.0);
    atomicAdd(&graph_control[19u + iteration], 1u);
    if (self_index == 0u) { atomicAdd(&traversal_evidence[28u], 1u); }
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var barrier_dx_triangle_sum_m = 0.0;
  var soft_dx_triangle_sum_m = 0.0;
  var position_dx_sum_m = vec3<f32>(0.0);
  var position_max_pair_dx_m = 0.0;
  var velocity_tensor_00 = 0.0;
  var velocity_tensor_01 = 0.0;
  var velocity_tensor_02 = 0.0;
  var velocity_tensor_11 = 0.0;
  var velocity_tensor_12 = 0.0;
  var velocity_tensor_22 = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = mechanical_solver_peer_index(csr_peers[cursor]);
    let pair = mechanical_solver_pair(
      self_index,
      other_index,
      include_soft
    );
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    csr_peers[cursor] = mechanical_solver_encode_measured_peer(
      other_index,
      pair.active_pair != 0u
    );
    if (pair.active_pair == 0u) { continue; }
    barrier_dx_triangle_sum_m = barrier_dx_triangle_sum_m
      + length(pair.barrier_dx);
    soft_dx_triangle_sum_m = soft_dx_triangle_sum_m
      + length(pair.soft_dx);
    let pair_position_dx_m = pair.barrier_dx + pair.soft_dx;
    position_dx_sum_m = position_dx_sum_m + pair_position_dx_m;
    position_max_pair_dx_m = max(
      position_max_pair_dx_m,
      length(pair_position_dx_m)
    );
    if (dot(pair.velocity_normal, pair.velocity_normal) > 0.5) {
      let self_mass = input_state[self_index * 2u].w;
      let other_mass = input_state[other_index * 2u].w;
      let self_inverse_mass = 1.0 / max(self_mass, 1.0e-30);
      let other_inverse_mass = 1.0 / max(other_mass, 1.0e-30);
      let inverse_mass_share = self_inverse_mass
        / (self_inverse_mass + other_inverse_mass);
      let direction = pair.velocity_normal;
      velocity_tensor_00 = velocity_tensor_00
        + inverse_mass_share * direction.x * direction.x;
      velocity_tensor_01 = velocity_tensor_01
        + inverse_mass_share * direction.x * direction.y;
      velocity_tensor_02 = velocity_tensor_02
        + inverse_mass_share * direction.x * direction.z;
      velocity_tensor_11 = velocity_tensor_11
        + inverse_mass_share * direction.y * direction.y;
      velocity_tensor_12 = velocity_tensor_12
        + inverse_mass_share * direction.y * direction.z;
      velocity_tensor_22 = velocity_tensor_22
        + inverse_mass_share * direction.z * direction.z;
    }
  }
  let self_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  let self_diameter_m = mechanical_solver_cbrt(self_volume);
  let initial_displacement_m = length(
    input_state[self_index * 2u].xyz
      - mechanical_solver_epoch_position(self_index)
  );
  let position_trust_capacity_m = select(
    self_diameter_m + initial_displacement_m,
    particle_scales[self_index].z,
    iteration > 0u
  );
  let remaining_position_trust_m = select(
    position_trust_capacity_m,
    particle_scales[self_index].w,
    iteration > 0u
  );
  let position_triangle_sum_m = barrier_dx_triangle_sum_m
    + soft_dx_triangle_sum_m;
  let position_sum_length_m = length(position_dx_sum_m);
  let position_degree_scale = select(
    1.0,
    min(
      1.0,
      position_max_pair_dx_m / max(position_sum_length_m, 1.0e-30)
    ),
    position_sum_length_m > 1.0e-12
  );
  // The solve takes min(endpoint scales) for every reciprocal edge. A scale
  // first caps the aggregate row to its strongest individual constraint, so a
  // degree-four bed cannot multiply its correction. Reciprocal endpoint minima
  // can disturb vector cancellation, so an independent triangle-sum cap proves
  // the realized row cannot exceed remaining complete-solve trust. Energy
  // allocation debits that realized motion before the next measure.
  let position_trust_scale = select(
    position_degree_scale,
    min(
      position_degree_scale,
      remaining_position_trust_m / max(position_triangle_sum_m, 1.0e-30)
    ),
    position_triangle_sum_m > 1.0e-12
  );
  // Each reciprocal pair uses min(endpoint scales). The symmetric tensor is
  // the row's inverse-mass-weighted sum of normal projectors. Its Gershgorin
  // bound preserves the non-expansive velocity proof for the complete row.
  // Do not additionally cap velocity by max-pair / length(row sum): that
  // legacy single-vector trust bound throttles valid multi-contact rows even
  // when the tensor proves their combined reciprocal impulse is stable.
  // Position retains its triangle-sum trust certificate independently.
  let velocity_operator_bound = max(
    velocity_tensor_00 + abs(velocity_tensor_01) + abs(velocity_tensor_02),
    max(
      velocity_tensor_11 + abs(velocity_tensor_01) + abs(velocity_tensor_12),
      velocity_tensor_22 + abs(velocity_tensor_02) + abs(velocity_tensor_12)
    )
  );
  let velocity_stability_scale = 1.0 / max(velocity_operator_bound, 1.0);
  let scale = vec4<f32>(
    position_trust_scale,
    velocity_stability_scale,
    position_trust_capacity_m,
    remaining_position_trust_m
  );
  if (
    !mechanical_solver_finite(initial_displacement_m)
    || !mechanical_solver_finite(position_trust_capacity_m)
    || !mechanical_solver_finite(remaining_position_trust_m)
    || !mechanical_solver_finite(position_sum_length_m)
    || !mechanical_solver_finite(position_max_pair_dx_m)
    || !mechanical_solver_finite(position_degree_scale)
    || position_trust_scale < 0.0
    || position_trust_scale > 1.0
    || velocity_stability_scale < 0.0
    || velocity_stability_scale > 1.0
    || position_trust_capacity_m < 0.0
    || remaining_position_trust_m < 0.0
    || remaining_position_trust_m > position_trust_capacity_m
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  particle_scales[self_index] = scale;
  atomicAdd(&graph_control[19u + iteration], 1u);
  if (self_index == 0u) { atomicAdd(&traversal_evidence[28u], 1u); }
}

fn mechanical_solver_pair_scale(
  self_index: u32,
  other_index: u32
) -> vec4<f32> {
  let self_scale = particle_scales[self_index];
  let other_scale = particle_scales[other_index];
  let position_scale = min(self_scale.x, other_scale.x);
  let velocity_scale = min(self_scale.y, other_scale.y);
  return vec4<f32>(
    position_scale,
    velocity_scale,
    position_scale,
    velocity_scale
  );
}

fn mechanical_energy_base(index: u32) -> u32 {
  return ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
    + index * 2u;
}

struct MechanicalEdgeLinearLoss {
  loss_j: f32,
  valid: u32,
};

fn mechanical_edge_linear_loss_from_pair_dv(
  low_index: u32,
  high_index: u32,
  low_pair_dv: vec3<f32>,
  high_pair_dv: vec3<f32>
) -> MechanicalEdgeLinearLoss {
  let low_pos_mass = input_state[low_index * 2u];
  let high_pos_mass = input_state[high_index * 2u];
  if (!(low_pos_mass.w > 0.0) || !(high_pos_mass.w > 0.0)) {
    return MechanicalEdgeLinearLoss(0.0, 1u);
  }
  let low_momentum_delta = low_pos_mass.w * low_pair_dv;
  let high_momentum_delta = high_pos_mass.w * high_pair_dv;
  let momentum_conditioning = length(low_momentum_delta)
    + length(high_momentum_delta);
  let momentum_tolerance = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(momentum_conditioning, 1.0)
  );
  if (length(low_momentum_delta + high_momentum_delta)
      > momentum_tolerance) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  let canonical_pair_momentum_delta = 0.5 * (
    low_momentum_delta - high_momentum_delta
  );
  let relative_linear_work_j = dot(
    input_state[low_index * 2u + 1u].xyz
      - input_state[high_index * 2u + 1u].xyz,
    canonical_pair_momentum_delta
  );
  let work_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(abs(relative_linear_work_j), 1.0)
  );
  if (!mechanical_solver_finite(relative_linear_work_j)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  if (relative_linear_work_j > work_tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  return MechanicalEdgeLinearLoss(max(0.0, -relative_linear_work_j), 1u);
}

fn mechanical_solve_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let energy_base = mechanical_energy_base(self_index);
  energy_ledger[energy_base] = vec4<f32>(0.0);
  if (iteration == 0u) {
    energy_ledger[energy_base + 1u] = vec4<f32>(0.0, 0.0, 0.0, vel_u.w);
  }
  output_state[self_index * 2u] = pos_mass;
  output_state[self_index * 2u + 1u] = vel_u;
  if (
    atomicLoad(&graph_control[19u + iteration])
      != mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!mechanical_solver_selected(self_index) || pos_mass.w <= 0.0) {
    atomicAdd(&graph_control[23u + iteration], 1u);
    if (self_index == 0u) {
      atomicAdd(&traversal_evidence[29u], 1u);
      atomicOr(
        &graph_control[15u],
        (1u << (6u + iteration))
      );
    }
    return;
  }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  if (begin > end || end > total) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var dx = vec3<f32>(0.0);
  var dv = vec3<f32>(0.0);
  var half_linear_loss_budget_j = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let encoded_peer = csr_peers[cursor];
    if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
    let other_index = mechanical_solver_peer_index(encoded_peer);
    let pair = mechanical_solver_pair(self_index, other_index, include_soft);
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (pair.active_pair == 0u) { continue; }
    let pair_scale = mechanical_solver_pair_scale(self_index, other_index);
    let self_pair_dv = pair_scale.y * pair.barrier_dv
      + pair_scale.w * pair.soft_dv;
    // The reciprocal pair uses the same symmetric scale and opposite normal.
    // Derive its velocity delta from exact pair-momentum closure instead of
    // evaluating the full swept contact law a second time. This preserves the
    // unequal-mass response while removing one expensive pair-law evaluation
    // for every directed edge in every solver round.
    let other_mass = input_state[other_index * 2u].w;
    if (!(other_mass > 0.0)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let other_pair_dv = -(pos_mass.w / other_mass) * self_pair_dv;
    if (!mechanical_solver_finite3(other_pair_dv)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    let low_index = min(self_index, other_index);
    let high_index = max(self_index, other_index);
    let low_pair_dv = select(other_pair_dv, self_pair_dv, self_index == low_index);
    let high_pair_dv = select(self_pair_dv, other_pair_dv, self_index == low_index);
    let edge = mechanical_edge_linear_loss_from_pair_dv(
      low_index,
      high_index,
      low_pair_dv,
      high_pair_dv
    );
    if (edge.valid == 0u) { return; }
    half_linear_loss_budget_j = half_linear_loss_budget_j
      + 0.5 * edge.loss_j;
    dx = dx
      + pair_scale.x * pair.barrier_dx
      + pair_scale.z * pair.soft_dx;
    dv = dv + self_pair_dv;
  }
  var position = pos_mass.xyz + dx;
  let contact_velocity = vel_u.xyz + dv;
  var velocity = contact_velocity;
  let rest_volume = max(source_mechanics[self_index * 8u + 4u].w, 0.0);
  var wall_clearance = 0.0;
  if (rest_volume > 0.0) {
    wall_clearance = 0.5 * mechanical_solver_cbrt(rest_volume);
    if (mechanical_params.grid_spacing_m > 0.0) {
      wall_clearance = min(
        wall_clearance,
        0.5 * mechanical_params.grid_spacing_m
      );
    }
    let min_dimension = min(
      mechanical_params.box_dims_m.x,
      min(
        mechanical_params.box_dims_m.y,
        mechanical_params.box_dims_m.z
      )
    );
    if (min_dimension > 0.0) {
      wall_clearance = min(wall_clearance, 0.49 * min_dimension);
    }
  }
  let upper = max(
    vec3<f32>(wall_clearance),
    mechanical_params.box_dims_m - vec3<f32>(wall_clearance)
  );
  if (position.x < wall_clearance) {
    position.x = wall_clearance;
    if (velocity.x < 0.0) { velocity.x = 0.0; }
  }
  if (position.x > upper.x) {
    position.x = upper.x;
    if (velocity.x > 0.0) { velocity.x = 0.0; }
  }
  if (position.y < wall_clearance) {
    position.y = wall_clearance;
    if (velocity.y < 0.0) { velocity.y = 0.0; }
  }
  if (position.y > upper.y) {
    position.y = upper.y;
    if (velocity.y > 0.0) { velocity.y = 0.0; }
  }
  if (position.z < wall_clearance) {
    position.z = wall_clearance;
    if (velocity.z < 0.0) { velocity.z = 0.0; }
  }
  if (position.z > upper.z) {
    position.z = upper.z;
    if (velocity.z > 0.0) { velocity.z = 0.0; }
  }
  if (!mechanical_solver_finite3(position) || !mechanical_solver_finite3(velocity)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let wall_kinetic_delta_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) - dot(contact_velocity, contact_velocity)
  );
  let wall_conditioning_j = 0.5 * pos_mass.w * (
    dot(velocity, velocity) + dot(contact_velocity, contact_velocity)
  );
  let wall_tolerance_j = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(wall_conditioning_j, 1.0)
  );
  if (
    !mechanical_solver_finite(wall_kinetic_delta_j)
    || wall_kinetic_delta_j > wall_tolerance_j
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return;
  }
  let quadratic_energy_j = 0.5 * max(pos_mass.w, 0.0) * dot(dv, dv);
  let wall_heat_j = max(0.0, -wall_kinetic_delta_j);
  let budget_tolerance_j = max(
    1.0e-6,
    128.0 * 1.1920929e-7 * max(
      quadratic_energy_j + half_linear_loss_budget_j,
      1.0
    )
  );
  if (
    !mechanical_solver_finite(quadratic_energy_j)
    || !mechanical_solver_finite(half_linear_loss_budget_j)
    || !mechanical_solver_finite(wall_heat_j)
    || quadratic_energy_j
      > half_linear_loss_budget_j + budget_tolerance_j
    || wall_heat_j < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u,
        mechanical_solver_finite(quadratic_energy_j)
          && mechanical_solver_finite(half_linear_loss_budget_j)
          && quadratic_energy_j
            > half_linear_loss_budget_j + budget_tolerance_j
      )
    );
    if (quadratic_energy_j > half_linear_loss_budget_j + budget_tolerance_j) {
      atomicAdd(&traversal_evidence[38u], 1u);
    }
    return;
  }
  let quadratic_budget_fraction = select(
    0.0,
    clamp(
      quadratic_energy_j / max(half_linear_loss_budget_j, 1.0e-30),
      0.0,
      1.0
    ),
    half_linear_loss_budget_j > 0.0
  );
  energy_ledger[energy_base] = vec4<f32>(
    quadratic_budget_fraction,
    quadratic_energy_j,
    half_linear_loss_budget_j,
    wall_heat_j
  );
  output_state[self_index * 2u] = vec4<f32>(position, pos_mass.w);
  output_state[self_index * 2u + 1u] = vec4<f32>(velocity, vel_u.w);
  atomicAdd(&graph_control[23u + iteration], 1u);
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[29u], 1u);
    atomicOr(&graph_control[15u], (1u << (6u + iteration)));
  }
}

fn mechanical_energy_effective_pair_dv(
  self_index: u32,
  other_index: u32,
  include_soft: bool
) -> vec3<f32> {
  let pair = mechanical_solver_pair(self_index, other_index, include_soft);
  if (pair.valid == 0u) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return vec3<f32>(0.0);
  }
  let pair_scale = mechanical_solver_pair_scale(self_index, other_index);
  return pair_scale.y * pair.barrier_dv
    + pair_scale.w * pair.soft_dv;
}

fn mechanical_edge_linear_loss(
  low_index: u32,
  high_index: u32,
  include_soft: bool
) -> MechanicalEdgeLinearLoss {
  let low_pair_dv = mechanical_energy_effective_pair_dv(
    low_index,
    high_index,
    include_soft
  );
  if (atomicLoad(&graph_control[14u]) != 0u) {
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  let low_mass = input_state[low_index * 2u].w;
  let high_mass = input_state[high_index * 2u].w;
  if (!(low_mass > 0.0) || !(high_mass > 0.0)) {
    return MechanicalEdgeLinearLoss(0.0, 1u);
  }
  // The directed graph is reciprocal and the pair scale is symmetric. Derive
  // the reverse endpoint response from momentum conservation instead of
  // running the swept pair law again during energy allocation.
  let high_pair_dv = -(low_mass / high_mass) * low_pair_dv;
  if (!mechanical_solver_finite3(high_pair_dv)) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return MechanicalEdgeLinearLoss(0.0, 0u);
  }
  return mechanical_edge_linear_loss_from_pair_dv(
    low_index,
    high_index,
    low_pair_dv,
    high_pair_dv
  );
}

fn mechanical_allocate_energy_iteration(
  self_index: u32,
  iteration: u32,
  include_soft: bool
) {
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  if (
    atomicLoad(&graph_control[23u + iteration])
      != mechanical_params.particle_count
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  let energy_base = mechanical_energy_base(self_index);
  let pos_mass = input_state[self_index * 2u];
  let vel_u = input_state[self_index * 2u + 1u];
  let budget = energy_ledger[energy_base];
  var cumulative = energy_ledger[energy_base + 1u];
  var linear_loss_share_j = 0.0;
  var pair_heat_j = 0.0;
  var realized_position_dx_m = vec3<f32>(0.0);
  if (mechanical_solver_selected(self_index) && pos_mass.w > 0.0) {
    let begin = source_offsets[self_index];
    let end = source_offsets[self_index + 1u];
    let total = atomicLoad(&graph_control[12u]);
    if (begin > end || end > total) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
      );
      return;
    }
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      let encoded_peer = csr_peers[cursor];
      if (mechanical_solver_edge_inactive(encoded_peer)) { continue; }
      let peer_index = mechanical_solver_peer_index(encoded_peer);
      let self_pair = mechanical_solver_pair(
        self_index,
        peer_index,
        include_soft
      );
      if (self_pair.valid == 0u) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
        );
        return;
      }
      if (self_pair.active_pair == 0u) { continue; }
      let self_pair_scale = mechanical_solver_pair_scale(
        self_index,
        peer_index
      );
      realized_position_dx_m = realized_position_dx_m
        + self_pair_scale.x * self_pair.barrier_dx
        + self_pair_scale.z * self_pair.soft_dx;
      let low_index = min(self_index, peer_index);
      let high_index = max(self_index, peer_index);
      let low_pos_mass = input_state[low_index * 2u];
      let high_pos_mass = input_state[high_index * 2u];
      let edge = mechanical_edge_linear_loss(
        low_index,
        high_index,
        include_soft
      );
      if (edge.valid == 0u) { return; }
      let edge_heat_fraction = max(
        0.0,
        1.0 - 0.5 * (
          energy_ledger[mechanical_energy_base(low_index)].x
            + energy_ledger[mechanical_energy_base(high_index)].x
        )
      );
      let edge_heat_j = edge.loss_j * edge_heat_fraction;
      let pair_mass = low_pos_mass.w + high_pos_mass.w;
      let low_mass_fraction = select(
        0.5,
        low_pos_mass.w / pair_mass,
        pair_mass > 0.0
      );
      let self_mass_fraction = select(
        1.0 - low_mass_fraction,
        low_mass_fraction,
        self_index == low_index
      );
      linear_loss_share_j = linear_loss_share_j
        + edge.loss_j * self_mass_fraction;
      pair_heat_j = pair_heat_j + edge_heat_j * self_mass_fraction;
    }
  }
  let position_trust_capacity_m = particle_scales[self_index].z;
  let prior_position_trust_m = particle_scales[self_index].w;
  let spent_position_trust_m = length(realized_position_dx_m);
  let position_trust_tolerance = max(
    1.0e-6,
    64.0 * 1.1920929e-7 * max(position_trust_capacity_m, 1.0)
  );
  if (
    !mechanical_solver_finite(position_trust_capacity_m)
    || !mechanical_solver_finite(prior_position_trust_m)
    || !mechanical_solver_finite(spent_position_trust_m)
    || position_trust_capacity_m < 0.0
    || prior_position_trust_m < 0.0
    || prior_position_trust_m > position_trust_capacity_m
    || spent_position_trust_m
      > prior_position_trust_m + position_trust_tolerance
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let remaining_position_trust_m = max(
    0.0,
    prior_position_trust_m - spent_position_trust_m
  );
  let pair_delta_k_j = budget.y - linear_loss_share_j;
  let wall_heat_j = budget.w;
  let cumulative_heat_j = cumulative.y + cumulative.z
    + pair_heat_j + wall_heat_j;
  let next_u = select(
    vel_u.w,
    cumulative.w + cumulative_heat_j / pos_mass.w,
    pos_mass.w > 0.0
  );
  if (
    !mechanical_solver_finite(pair_delta_k_j)
    || !mechanical_solver_finite(pair_heat_j)
    || !mechanical_solver_finite(wall_heat_j)
    || !mechanical_solver_finite(next_u)
    || pair_heat_j < 0.0
    || wall_heat_j < 0.0
    || next_u < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      select(
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u,
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NEGATIVE_INTERNAL_ENERGY}u,
        mechanical_solver_finite(next_u) && next_u < 0.0
      )
    );
    if (mechanical_solver_finite(next_u) && next_u < 0.0) {
      atomicAdd(&traversal_evidence[39u], 1u);
    }
    return;
  }
  let committed_velocity = output_state[self_index * 2u + 1u];
  output_state[self_index * 2u + 1u] = vec4<f32>(
    committed_velocity.xyz,
    next_u
  );
  cumulative = vec4<f32>(
    cumulative.x + pair_delta_k_j,
    cumulative.y + pair_heat_j,
    cumulative.z + wall_heat_j,
    cumulative.w
  );
  energy_ledger[energy_base + 1u] = cumulative;
  // Lanes z/w are not read by reciprocal pair scaling. Carry the trust
  // certificate to the next measure, then restore the public four-scale row
  // after the final round.
  if (iteration + 1u < mechanical_params.solver_iteration_count) {
    particle_scales[self_index].z = position_trust_capacity_m;
    particle_scales[self_index].w = remaining_position_trust_m;
  } else {
    particle_scales[self_index].z = particle_scales[self_index].x;
    particle_scales[self_index].w = particle_scales[self_index].y;
  }
  atomicAdd(&graph_control[32u + iteration], 1u);
  if (self_index == 0u) {
    atomicAdd(&traversal_evidence[32u], 1u);
    atomicOr(&graph_control[15u], (1u << (13u + iteration)));
  }
}

var<workgroup> mechanical_energy_totals: array<vec4<f32>, 64>;
var<workgroup> mechanical_energy_error_bounds: array<vec4<f32>, 64>;

@compute @workgroup_size(64)
fn verify_contact_energy(
  @builtin(local_invocation_index) local_index: u32
) {
  // This entry point has workgroup barriers, so every lane must still take
  // the same barrier path when the authenticated zero-edge path is selected.
  // Keep its reduction inert instead of returning before those barriers.
  let full_solver_path = mechanical_solver_full_path_enabled();
  var energy_stages_ready = full_solver_path;
  for (var iteration = 0u;
    iteration < mechanical_params.solver_iteration_count;
    iteration = iteration + 1u) {
    energy_stages_ready = energy_stages_ready
      && atomicLoad(&graph_control[32u + iteration])
        == mechanical_params.particle_count
      && (
        atomicLoad(&graph_control[15u]) & (1u << (13u + iteration))
      ) != 0u;
  }
  let prior_failure = atomicLoad(&graph_control[14u]) != 0u;
  let energy_admitted = full_solver_path && energy_stages_ready && !prior_failure;
  var totals = vec4<f32>(0.0);
  var error_bounds = vec4<f32>(0.0);
  if (energy_admitted) {
    for (var index = local_index; index < mechanical_params.particle_count;
      index = index + 64u) {
    let ledger = energy_ledger[mechanical_energy_base(index) + 1u];
    let state = input_state[index * 2u];
    let final_u = input_state[index * 2u + 1u].w;
    if (!all(vec4<bool>(
      mechanical_solver_finite(ledger.x),
      mechanical_solver_finite(ledger.y),
      mechanical_solver_finite(ledger.z),
      mechanical_solver_finite(ledger.w)
    )) || !mechanical_solver_finite(final_u)) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      continue;
    }
    let row_internal_delta_j = state.w * (final_u - ledger.w);
    let row_intended_transfer_j = ledger.y + ledger.z;
    let row_storage_rounding_bound_j = max(
      1.0e-6,
      0.5 * 1.1920929e-7
        * max(state.w, 0.0)
        * max(max(abs(final_u), abs(ledger.w)), 1.0)
        + 16.0 * 1.1920929e-7
          * max(abs(row_intended_transfer_j), 1.0)
    );
    if (abs(row_internal_delta_j - row_intended_transfer_j)
        > row_storage_rounding_bound_j) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
      );
      continue;
    }
    totals = totals + vec4<f32>(
      ledger.x,
      ledger.y,
      ledger.z,
      row_internal_delta_j
    );
    let pair_conditioning_j = abs(ledger.x) + abs(ledger.y);
    let conditioning_j = abs(ledger.x)
      + abs(ledger.y)
      + ledger.z
      + abs(row_internal_delta_j);
      error_bounds = error_bounds + vec4<f32>(
        conditioning_j,
        pair_conditioning_j,
        row_storage_rounding_bound_j,
        0.0
      );
    }
  }
  mechanical_energy_totals[local_index] = totals;
  mechanical_energy_error_bounds[local_index] = error_bounds;
  workgroupBarrier();
  for (var offset = 32u; offset > 0u; offset = offset / 2u) {
    if (local_index < offset) {
      mechanical_energy_totals[local_index] =
        mechanical_energy_totals[local_index]
          + mechanical_energy_totals[local_index + offset];
      mechanical_energy_error_bounds[local_index] =
        mechanical_energy_error_bounds[local_index]
          + mechanical_energy_error_bounds[local_index + offset];
    }
    workgroupBarrier();
  }
  if (local_index != 0u) { return; }
  if (!full_solver_path) { return; }
  if (!energy_stages_ready) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (prior_failure || atomicLoad(&graph_control[14u]) != 0u) { return; }
  let pair_delta_k_j = mechanical_energy_totals[0u].x;
  let pair_heat_j = mechanical_energy_totals[0u].y;
  let wall_heat_j = mechanical_energy_totals[0u].z;
  let internal_energy_delta_j = mechanical_energy_totals[0u].w;
  let conditioning_j = mechanical_energy_error_bounds[0u].x;
  let pair_conditioning_j = mechanical_energy_error_bounds[0u].y;
  let internal_storage_rounding_bound_j =
    mechanical_energy_error_bounds[0u].z;
  let pair_residual_j = pair_delta_k_j + pair_heat_j;
  let internal_residual_j = internal_energy_delta_j
    - pair_heat_j
    - wall_heat_j;
  let residual_j = max(abs(pair_residual_j), abs(internal_residual_j));
  let tolerance_j = max(
    max(
      1.0e-4,
      256.0 * 1.1920929e-7 * max(conditioning_j, 1.0)
    ),
    internal_storage_rounding_bound_j
  );
  let pair_gain_tolerance_j = max(
    1.0e-5,
    128.0 * 1.1920929e-7 * max(pair_conditioning_j, 1.0)
  );
  atomicStore(&graph_control[36u], bitcast<u32>(pair_delta_k_j));
  atomicStore(&graph_control[37u], bitcast<u32>(pair_heat_j));
  atomicStore(&graph_control[38u], bitcast<u32>(wall_heat_j));
  atomicStore(&graph_control[39u], bitcast<u32>(residual_j));
  atomicStore(&traversal_evidence[33u], bitcast<u32>(pair_delta_k_j));
  atomicStore(&traversal_evidence[34u], bitcast<u32>(pair_heat_j));
  atomicStore(&traversal_evidence[35u], bitcast<u32>(wall_heat_j));
  atomicStore(&traversal_evidence[36u], bitcast<u32>(residual_j));
  atomicStore(&traversal_evidence[37u], bitcast<u32>(tolerance_j));
  if (pair_delta_k_j > pair_gain_tolerance_j
      || pair_heat_j < -pair_gain_tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_GAIN}u
    );
    atomicAdd(&traversal_evidence[38u], 1u);
    return;
  }
  if (!mechanical_solver_finite(residual_j)
      || !mechanical_solver_finite(tolerance_j)
      || residual_j > tolerance_j) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ENERGY_CLOSURE}u
    );
    return;
  }
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
  );
}

@compute @workgroup_size(64)
fn measure_iteration_0(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_measure_iteration(global_id.x, 0u, true);
}

@compute @workgroup_size(64)
fn solve_iteration_0(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_solve_iteration(global_id.x, 0u, true);
}

@compute @workgroup_size(64)
fn allocate_energy_iteration_0(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  mechanical_allocate_energy_iteration(global_id.x, 0u, true);
}

@compute @workgroup_size(64)
fn measure_iteration_1(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_measure_iteration(global_id.x, 1u, false);
}

@compute @workgroup_size(64)
fn solve_iteration_1(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_solve_iteration(global_id.x, 1u, false);
}

@compute @workgroup_size(64)
fn allocate_energy_iteration_1(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  mechanical_allocate_energy_iteration(global_id.x, 1u, false);
}

@compute @workgroup_size(64)
fn measure_iteration_2(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_measure_iteration(global_id.x, 2u, false);
}

@compute @workgroup_size(64)
fn solve_iteration_2(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_solve_iteration(global_id.x, 2u, false);
}

@compute @workgroup_size(64)
fn allocate_energy_iteration_2(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  mechanical_allocate_energy_iteration(global_id.x, 2u, false);
}

@compute @workgroup_size(64)
fn measure_iteration_3(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_measure_iteration(global_id.x, 3u, false);
}

@compute @workgroup_size(64)
fn solve_iteration_3(@builtin(global_invocation_id) global_id: vec3<u32>) {
  mechanical_solve_iteration(global_id.x, 3u, false);
}

@compute @workgroup_size(64)
fn allocate_energy_iteration_3(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  mechanical_allocate_energy_iteration(global_id.x, 3u, false);
}

@compute @workgroup_size(64)
fn verify_contact_residual(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let self_index = global_id.x;
  if (self_index >= mechanical_params.particle_count) { return; }
  if (!mechanical_solver_full_path_enabled()) { return; }
  let begin = source_offsets[self_index];
  let end = source_offsets[self_index + 1u];
  let total = atomicLoad(&graph_control[12u]);
  let graph_was_verified =
    atomicLoad(&graph_control[16u]) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
    ) != 0u;
  let row_bounds_valid = graph_was_verified
    && total <= mechanical_params.directed_pair_capacity
    && total <= arrayLength(&csr_peers)
    && begin <= end
    && end <= total;
  if (row_bounds_valid) {
    // Cleanup is unconditional once CSR bounds are known. Even a prior
    // solver failure must not leave solver-private high bits in the retained
    // public peer buffer.
    for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
      csr_peers[cursor] = mechanical_solver_peer_index(csr_peers[cursor]);
    }
  }
  if (
    atomicLoad(&graph_control[26u]) != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_3}u
    ) == 0u
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
    ) == 0u
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.ITERATION_INCOMPLETE}u
    );
    return;
  }
  if (!row_bounds_valid) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.CSR_BOUNDS_OR_RANK}u
    );
    return;
  }
  var max_position_residual = 0.0;
  var max_velocity_residual = 0.0;
  for (var cursor = begin; cursor < end; cursor = cursor + 1u) {
    let other_index = csr_peers[cursor];
    // Residual verification deliberately remeasures every retained edge after
    // the final correction. An edge inactive in the iteration-3 input can be
    // activated by that correction or by the wall projection.
    let pair = mechanical_solver_pair(self_index, other_index, false);
    if (pair.valid == 0u) {
      atomicOr(
        &graph_control[14u],
        ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
      );
      return;
    }
    if (pair.active_pair == 0u) { continue; }
    if (pair.unilateral == 1u) {
      let self_volume = max(
        source_mechanics[self_index * 8u + 4u].w,
        0.0
      );
      let other_volume = max(
        source_mechanics[other_index * 8u + 4u].w,
        0.0
      );
      let rest_distance = 0.5 * (
        mechanical_solver_cbrt(self_volume)
          + mechanical_solver_cbrt(other_volume)
      );
      let position_tolerance = max(1.0e-5, 0.02 * rest_distance);
      if (pair.position_residual > position_tolerance) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.POSITION_RESIDUAL}u
        );
      }
      if (pair.velocity_residual > 1.0e-3) {
        atomicOr(
          &graph_control[14u],
          ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.VELOCITY_RESIDUAL}u
        );
      }
      max_position_residual = max(
        max_position_residual,
        pair.position_residual
      );
      max_velocity_residual = max(
        max_velocity_residual,
        pair.velocity_residual
      );
    }
  }
  atomicMax(
    &graph_control[27u],
    bitcast<u32>(max_position_residual)
  );
  atomicMax(
    &graph_control[28u],
    bitcast<u32>(max_velocity_residual)
  );
  atomicMax(
    &traversal_evidence[30u],
    bitcast<u32>(max_position_residual)
  );
  atomicMax(
    &traversal_evidence[31u],
    bitcast<u32>(max_velocity_residual)
  );
  atomicAdd(&graph_control[17u], 1u);
  if (self_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    );
  }
}
`;

export const schroederSpatialMechanicalProposalApplyWgsl = /* wgsl */ `
${mechanicalContactGraphParamsWgsl}

@group(0) @binding(0) var<storage, read> original_state: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> final_state: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> proposal_rows: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> output_state: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> graph_control: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> traversal_evidence: array<atomic<u32>>;
@group(0) @binding(6) var<uniform> mechanical_params: MechanicalProposalParams;

fn mechanical_publish_finite(value: f32) -> bool {
  return value == value && abs(value) <= 3.402823466e+38;
}

fn mechanical_publish_finite3(value: vec3<f32>) -> bool {
  return mechanical_publish_finite(value.x)
    && mechanical_publish_finite(value.y)
    && mechanical_publish_finite(value.z);
}

fn mechanical_publish_header_word(word: u32) -> u32 {
  return bitcast<u32>(proposal_rows[word / 4u][word % 4u]);
}

fn mechanical_publish_header_valid() -> bool {
  return arrayLength(&proposal_rows)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
        + mechanical_params.particle_count * 2u
    && mechanical_publish_header_word(0u)
      == mechanical_params.proposal_magic
    && mechanical_publish_header_word(1u)
      == mechanical_params.proposal_version
    && mechanical_publish_header_word(2u)
      == mechanical_params.generation_id
    && mechanical_publish_header_word(3u)
      == mechanical_params.support_epoch
    && mechanical_publish_header_word(4u)
      == mechanical_params.particle_count
    && mechanical_publish_header_word(5u)
      == mechanical_params.proposal_row_words
    && mechanical_publish_header_word(6u)
      == mechanical_params.contact_support_profile_id
    && mechanical_publish_header_word(7u)
      == mechanical_params.separation_support_profile_id
    && mechanical_publish_header_word(8u)
      == mechanical_params.interface_support_profile_id
    && mechanical_publish_header_word(9u)
      == mechanical_params.position_epoch
    && mechanical_publish_header_word(10u)
      == mechanical_params.topology_epoch
    && mechanical_publish_header_word(11u)
      == mechanical_params.storage_generation
    && mechanical_publish_header_word(12u)
      == mechanical_params.physics_tick
    && mechanical_publish_header_word(13u)
      == mechanical_params.physics_substep
    && mechanical_publish_header_word(14u)
      == mechanical_params.traversal_count
    && mechanical_publish_header_word(15u)
      == mechanical_params.consumer_count;
}

fn mechanical_publish_graph_header_valid() -> bool {
  return arrayLength(&graph_control)
      >= ${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORDS}u
    && atomicLoad(&graph_control[0u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_MAGIC}u
    && atomicLoad(&graph_control[1u])
      == ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_CONTROL_VERSION}u
    && atomicLoad(&graph_control[2u]) == mechanical_params.generation_id
    && atomicLoad(&graph_control[3u]) == mechanical_params.storage_generation
    && atomicLoad(&graph_control[4u]) == mechanical_params.physics_tick
    && atomicLoad(&graph_control[5u]) == mechanical_params.physics_substep
    && atomicLoad(&graph_control[6u]) == mechanical_params.position_epoch
    && atomicLoad(&graph_control[7u]) == mechanical_params.topology_epoch
    && atomicLoad(&graph_control[8u]) == mechanical_params.support_epoch
    && bitcast<i32>(atomicLoad(&graph_control[9u]))
      == mechanical_params.apply_selected_level
    && atomicLoad(&graph_control[10u])
      == mechanical_params.directed_pair_capacity;
}

@compute @workgroup_size(64)
fn publish_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  if (atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
    .fullSolverPath}u]) == 0u) { return; }
  if (
    !mechanical_publish_header_valid()
    || !mechanical_publish_graph_header_valid()
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.HEADER_OR_EPOCH}u
    );
    return;
  }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[17u])
      != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) == 0u
  ) { return; }
  let original_position = original_state[particle_index * 2u];
  let original_velocity = original_state[particle_index * 2u + 1u];
  let final_position = final_state[particle_index * 2u];
  let final_velocity = final_state[particle_index * 2u + 1u];
  let dx = final_position.xyz - original_position.xyz;
  let dv = final_velocity.xyz - original_velocity.xyz;
  let du = final_velocity.w - original_velocity.w;
  let mechanical_heat_j = final_position.w * du;
  if (
    !mechanical_publish_finite3(dx)
    || !mechanical_publish_finite3(dv)
    || !mechanical_publish_finite(du)
    || !mechanical_publish_finite(mechanical_heat_j)
    || final_velocity.w < 0.0
    || du < 0.0
    || mechanical_heat_j < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(dx, mechanical_heat_j);
  proposal_rows[proposal_row + 1u] = vec4<f32>(dv, du);
  atomicAdd(&graph_control[18u], 1u);
}

// The retained graph remains authoritative even when it has no rows: this
// path is reached only after exact traversal, the source-count scan, and the
// finalized append/CSR counters all agree on zero directed pairs.  It avoids
// running four vacuous Jacobi rounds over every particle while publishing the
// same zero proposal rows and authenticated completion evidence.
@compute @workgroup_size(64)
fn complete_zero_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  let required_stages =
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.INITIALIZED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SUPPORT_REDUCED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.TRAVERSED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.SCANNED}u
    | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.CSR_SCATTERED}u;
  let zero_graph_admitted =
    mechanical_publish_header_valid()
    && mechanical_publish_graph_header_valid()
    && mechanical_params.solver_iteration_count == 4u
    && atomicLoad(&graph_control[11u]) == 0u
    && atomicLoad(&graph_control[12u]) == 0u
    && atomicLoad(&graph_control[13u]) == 0u
    && atomicLoad(&graph_control[14u]) == 0u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .fullSolverPath}u]) == 0u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchX}u])
      == (mechanical_params.particle_count + 63u) / 64u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchY}u]) == 1u
    && atomicLoad(&graph_control[${SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_CONTROL_WORD
      .zeroEdgeDispatchZ}u]) == 1u
    && (
      atomicLoad(&graph_control[15u]) & required_stages
    ) == required_stages;
  if (!zero_graph_admitted) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.STAGE_ORDER}u
    );
    return;
  }
  let original_position = original_state[particle_index * 2u];
  let original_velocity = original_state[particle_index * 2u + 1u];
  if (
    !mechanical_publish_finite3(original_position.xyz)
    || !mechanical_publish_finite(original_position.w)
    || !mechanical_publish_finite3(original_velocity.xyz)
    || !mechanical_publish_finite(original_velocity.w)
    || original_position.w < 0.0
    || original_velocity.w < 0.0
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.NONFINITE}u
    );
    return;
  }
  let proposal_row =
    ${SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS / 4}u
      + particle_index * 2u;
  proposal_rows[proposal_row] = vec4<f32>(0.0);
  proposal_rows[proposal_row + 1u] = vec4<f32>(0.0);
  // Scratch B is the normal four-round final state buffer.  Initializing it
  // from the immutable post-G2P state lets the ordinary seal/commit path
  // remain the sole public-state publication path.
  output_state[particle_index * 2u] = original_position;
  output_state[particle_index * 2u + 1u] = original_velocity;
  atomicAdd(&graph_control[16u], 1u);
  atomicAdd(&graph_control[17u], 1u);
  atomicAdd(&graph_control[18u], 1u);
  for (var iteration = 0u; iteration < 4u; iteration = iteration + 1u) {
    atomicAdd(&graph_control[19u + iteration], 1u);
    atomicAdd(&graph_control[23u + iteration], 1u);
    atomicAdd(&graph_control[32u + iteration], 1u);
  }
  if (particle_index == 0u) {
    atomicAdd(&traversal_evidence[26u], 1u);
    atomicAdd(&traversal_evidence[28u], 4u);
    atomicAdd(&traversal_evidence[29u], 4u);
    atomicAdd(&traversal_evidence[32u], 4u);
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.GRAPH_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_0}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_1}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_2}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ITERATION_3}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_0}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_1}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_2}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_ITERATION_3}u
      | ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.ENERGY_VERIFIED}u
    );
  }
}

@compute @workgroup_size(1)
fn seal_contact_proposal() {
  let headers_valid = mechanical_publish_header_valid()
    && mechanical_publish_graph_header_valid();
  if (!headers_valid) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.HEADER_OR_EPOCH}u
    );
  }
  let residual_verified =
    atomicLoad(&graph_control[17u]) == mechanical_params.particle_count
    && (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.RESIDUAL_VERIFIED}u
    ) != 0u;
  let rows_complete = atomicLoad(&graph_control[18u])
    == mechanical_params.particle_count;
  if (
    !headers_valid
    || !residual_verified
    || !rows_complete
    || atomicLoad(&graph_control[14u]) != 0u
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.PUBLICATION_INCOMPLETE}u
    );
    // Evidence status is a bit field. A terminal rejection is both observable
    // (READY) and fail-closed; publishing only FAIL_CLOSED would leave readers
    // unable to distinguish an unfinished dispatch from a sealed rejection.
    atomicStore(&traversal_evidence[2u], 5u);
    return;
  }
  atomicStore(
    &traversal_evidence[14u],
    atomicLoad(&graph_control[11u])
  );
  atomicStore(
    &traversal_evidence[16u],
    atomicLoad(&graph_control[12u])
  );
  atomicStore(
    &traversal_evidence[17u],
    atomicLoad(&graph_control[13u])
  );
  atomicStore(
    &traversal_evidence[30u],
    atomicLoad(&graph_control[27u])
  );
  atomicStore(
    &traversal_evidence[31u],
    atomicLoad(&graph_control[28u])
  );
  atomicAdd(&traversal_evidence[27u], 1u);
  atomicOr(
    &graph_control[15u],
    ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
  );
  // Status is the externally observed publication word; write it only after
  // every proposal row and all retained evidence have been sealed.
  atomicStore(&traversal_evidence[2u], 3u);
}

@compute @workgroup_size(64)
fn commit_contact_proposal(
  @builtin(global_invocation_id) global_id: vec3<u32>
) {
  let particle_index = global_id.x;
  if (particle_index >= mechanical_params.particle_count) { return; }
  if (
    atomicLoad(&graph_control[14u]) != 0u
    || atomicLoad(&graph_control[18u])
      != mechanical_params.particle_count
    || (
      atomicLoad(&graph_control[15u])
        & ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.PROPOSAL_PUBLISHED}u
    ) == 0u
    || !mechanical_publish_header_valid()
    || !mechanical_publish_graph_header_valid()
  ) {
    atomicOr(
      &graph_control[14u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_FAILURE.PUBLICATION_INCOMPLETE}u
    );
    return;
  }
  output_state[particle_index * 2u] = final_state[particle_index * 2u];
  output_state[particle_index * 2u + 1u]
    = final_state[particle_index * 2u + 1u];
  if (particle_index == 0u) {
    atomicOr(
      &graph_control[15u],
      ${SCHROEDER_SPATIAL_MECHANICAL_GRAPH_STAGE.COMMITTED}u
    );
  }
}
`;

function createBuffer(device, label, size, usage) {
  return tagWebGpuBufferDevice(device.createBuffer({
    label,
    size: Math.max(4, size),
    usage
  }), device);
}

function destroyMechanicalProposalPoolSlot(slot) {
  if (!slot || slot.destroyed === true) return false;
  for (const buffer of [
    slot.proposalBuffer,
    slot.evidenceBuffer,
    slot.supportBuffer,
    slot.sourceCountBuffer,
    slot.sourceOffsetBuffer,
    slot.appendStagingBuffer,
    slot.directedPeerBuffer,
    slot.scratchStateABuffer,
    slot.scratchStateBBuffer,
    slot.scaleBuffer,
    slot.graphControlBuffer,
    slot.indirectDispatchBuffer,
    slot.conditionalDispatchBuffer,
    slot.expectationBuffer,
    slot.paramsBuffer,
    slot.identityDisabledBuffer
  ]) buffer?.destroy?.();
  slot.sourceCountScan?.destroy?.();
  slot.destroyed = true;
  slot.inUseGenerationId = null;
  slot.generation = null;
  return true;
}

function mechanicalProposalPoolSlot(
  device,
  particleCount,
  arenaIndex = 0,
  generation = null,
  pairGraphByteBudget = null
) {
  let devicePools = mechanicalProposalPools.get(device);
  if (!devicePools) {
    devicePools = new Map();
    mechanicalProposalPools.set(device, devicePools);
  }
  // Fixed per-particle graph storage must track the live cohort, not the next
  // power of two. The old rounding doubled all fixed buffers at 32,769 rows
  // and collapsed an 8 MiB graph from 278,503 directed rows to 32,743.
  const capacity = exactU32(particleCount, 'particleCount', { positive: true });
  const maximumDirectedPairCapacity = Math.max(
    1,
    Math.min(
      0xffff_ffff,
      Math.trunc(
        finiteNumber(
          device.limits?.maxComputeWorkgroupsPerDimension,
          65535
        )
      ) * WORKGROUP_SIZE
    )
  );
  const deviceLimits = {
    maxBufferSize: Number.isFinite(device.limits?.maxBufferSize)
      ? device.limits.maxBufferSize
      : Number.MAX_SAFE_INTEGER,
    maxStorageBufferBindingSize: Number.isFinite(
      device.limits?.maxStorageBufferBindingSize
    )
      ? device.limits.maxStorageBufferBindingSize
      : Number.MAX_SAFE_INTEGER
  };
  const deviceCapacityPlan = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: capacity,
    maximumDirectedPairCapacity,
    maxRetainedBytes: Number.MAX_SAFE_INTEGER,
    deviceLimits
  });
  const minimumDirectedPairCapacity = capacity
    * SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE;
  if (
    !Number.isSafeInteger(minimumDirectedPairCapacity)
    || minimumDirectedPairCapacity > 0xffff_ffff
    || minimumDirectedPairCapacity > maximumDirectedPairCapacity
    || minimumDirectedPairCapacity > deviceCapacityPlan.directedPairCapacity
  ) {
    throw new RangeError(
      `canonical mechanical pair graph cannot retain the required `
      + `${SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE} `
      + `directed rows per particle for ${capacity} particles on this device`
    );
  }
  const defaultPairGraphByteBudget = Math.max(
    SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_BYTES_DEFAULT,
    deviceCapacityPlan.fixedRetainedByteLength
      + minimumDirectedPairCapacity
        * deviceCapacityPlan.bytesPerDirectedPair
  );
  const resolvedPairGraphByteBudget = pairGraphByteBudget == null
    ? defaultPairGraphByteBudget
    : pairGraphByteBudget;
  const graphPlan = createSchroederSpatialMechanicalPairGraphCapacityPlan({
    particleCapacity: capacity,
    maximumDirectedPairCapacity,
    minimumDirectedPairCapacity,
    maxRetainedBytes: resolvedPairGraphByteBudget,
    deviceLimits
  });
  const graphLayout = graphPlan.layout;
  const exactArenaIndex = exactU32(
    Math.max(0, Math.trunc(finiteNumber(arenaIndex, 0))),
    'generation.execution.arenaIndex'
  );
  const key = String(exactArenaIndex);
  let slot = devicePools.get(key);
  if (slot?.inUseGenerationId != null) {
    throw new Error(
      `mechanical proposal arena ${exactArenaIndex} is still leased by generation ${slot.inUseGenerationId}`
    );
  }
  const cacheHit = Boolean(
    slot
    && slot.destroyed !== true
    && slot.capacity >= capacity
    && slot.directedPairCapacity >= graphLayout.directedPairCapacity
    && slot.graphLayout?.retainedByteLength <= resolvedPairGraphByteBudget
  );
  const priorAllocationCount = slot?.totalBufferCreationCount ?? 0;
  if (!cacheHit) {
    destroyMechanicalProposalPoolSlot(slot);
    const bufferLayout = graphLayout.bufferLayouts;
    const allocatedBuffers = [];
    const createTrackedBuffer = (...args) => {
      const buffer = createBuffer(...args);
      allocatedBuffers.push(buffer);
      return buffer;
    };
    let sourceCountScan = null;
    const graphUsage =
      GPU_BUFFER_USAGE.STORAGE
        | GPU_BUFFER_USAGE.COPY_SRC
        | GPU_BUFFER_USAGE.COPY_DST;
    try {
      sourceCountScan = createWebGpuU32ExclusiveScan(device, {
        maxElementCount: capacity,
        fixedElementCount: capacity,
        retainParamsBuffer: true,
        label: `ulg-schroeder-spatial-mechanical-contact-graph-count-scan-${key}`
      });
      const proposalBuffer = createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-proposals-${key}`,
        bufferLayout.proposals.byteLength,
        graphUsage
      );
      slot = {
      arenaIndex: exactArenaIndex,
      capacity,
      directedPairCapacity: graphLayout.directedPairCapacity,
      minimumDirectedPairCapacity,
      graphLayout,
      pairGraphByteBudget: resolvedPairGraphByteBudget,
      proposalBuffer,
      evidenceBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-evidence-${key}`,
        bufferLayout.evidence.byteLength,
        graphUsage
      ),
      supportBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-global-support-bound-${key}`,
        (
          MECHANICAL_SUPPORT_HEADER_WORDS
            + capacity * MECHANICAL_SUPPORT_ROW_WORDS
            + MECHANICAL_SUPPORT_TRAILER_WORDS
        ) * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      sourceCountBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-source-counts-${key}`,
        bufferLayout.sourceCounts.byteLength,
        graphUsage
      ),
      sourceOffsetBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-source-offsets-${key}`,
        bufferLayout.sourceOffsets.byteLength,
        graphUsage
      ),
      appendStagingBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-append-staging-${key}`,
        bufferLayout.appendStaging.byteLength,
        graphUsage
      ),
      directedPeerBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-directed-peers-${key}`,
        bufferLayout.directedPeers.byteLength,
        graphUsage
      ),
      scratchStateABuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-scratch-a-${key}`,
        bufferLayout.scratchStateA.byteLength,
        graphUsage
      ),
      scratchStateBBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-scratch-b-${key}`,
        bufferLayout.scratchStateB.byteLength,
        graphUsage
      ),
      scaleBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-scales-${key}`,
        bufferLayout.scales.byteLength,
        graphUsage
      ),
      energyLedgerBuffer: proposalBuffer,
      graphControlBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-control-${key}`,
        bufferLayout.control.byteLength,
        graphUsage
      ),
      indirectDispatchBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-indirect-${key}`,
        bufferLayout.indirectDispatch.byteLength,
        GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      conditionalDispatchBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-contact-graph-conditional-${key}`,
        bufferLayout.conditionalDispatch.byteLength,
        GPU_BUFFER_USAGE.INDIRECT
          | GPU_BUFFER_USAGE.COPY_SRC
          | GPU_BUFFER_USAGE.COPY_DST
      ),
      expectationBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-expectation-${key}`,
        EXPECTATION_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      paramsBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-params-${key}`,
        MECHANICAL_PARAMS_BYTES,
        GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST
      ),
      identityDisabledBuffer: createTrackedBuffer(
        device,
        `ulg-schroeder-spatial-mechanical-identity-disabled-${key}`,
        capacity * Uint32Array.BYTES_PER_ELEMENT,
        GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST
      ),
      sourceCountScan,
      destroyed: false,
      inUseGenerationId: null,
      generation: null,
      releaseScheduled: false,
      totalBufferCreationCount: priorAllocationCount
        + 16
        + sourceCountScan.allocationEntries().length,
      acquisitionCount: 0
      };
    } catch (error) {
      for (const buffer of allocatedBuffers) buffer?.destroy?.();
      sourceCountScan?.destroy?.();
      throw error;
    }
    devicePools.set(key, slot);
  }
  return { slot, cacheHit };
}

export function destroySchroederSpatialMechanicalProposalRuntime(device) {
  const devicePools = mechanicalProposalPools.get(device);
  if (!devicePools) return false;
  for (const slot of devicePools.values()) destroyMechanicalProposalPoolSlot(slot);
  devicePools.clear();
  mechanicalProposalPools.delete(device);
  return true;
}

export function runSchroederSpatialMechanicalProposalWebGpu({
  device,
  generation,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  boxDimsM = [5, 5, 5],
  gridSpacingM = sphParticleState?.smoothingLengthM ?? 0,
  relaxation = mlsMpmParticleState?.particleSeparationRelaxation ?? 0.35,
  normalVelocityDamping =
    mlsMpmParticleState?.particleSeparationVelocityDamping ?? 0.25,
  selectedLevel = null,
  pairGraphByteBudget = null,
  retainCompleteAuthenticatedCellCliques = false,
  gpuTimestampRecorder = null
} = {}) {
  const particleCount = Math.max(0, Math.trunc(finiteNumber(
    sphParticleState?.particleCount ?? mlsMpmParticleState?.particleCount,
    0
  )));
  if (particleCount < 1 || particleCount !== mlsMpmParticleState?.particleCount) {
    throw new RangeError('canonical mechanical proposals require matching positive particle counts');
  }
  if (particleCount >= 0x8000_0000) {
    throw new RangeError(
      'canonical mechanical aggregate-summary preflight requires particleCount below 2^31'
    );
  }
  const immutableSelectedLevel = selectedLevel == null
    ? MECHANICAL_APPLY_ALL_LEVELS
    : exactI32(Number(selectedLevel), 'selectedLevel');
  const rawPhaseCarrierPlan = sphParticleUpload?.phaseCarrierPlan
    ?? mlsMpmParticleUpload?.phaseCarrierPlan
    ?? sphParticleState?.phaseCarrierPlan
    ?? mlsMpmParticleState?.phaseCarrierPlan
    ?? null;
  const phaseCarrierPlan = validateSphPhaseCarrierPlan(
    rawPhaseCarrierPlan,
    particleCount
  );
  if (rawPhaseCarrierPlan && phaseCarrierPlan.accepted !== true) {
    throw new TypeError(
      'canonical mechanical proposals require an exact phase-carrier lineage plan'
    );
  }
  const authority = resolveMechanicalSpatialAuthority({
    device,
    generation,
    sphParticleUpload,
    mlsMpmParticleUpload,
    particleCount
  });
  const aggregateView = generation?.aggregateView || null;
  const activeRankView = generation?.activeRankView
    ?? authority.execution?.activeRankView
    ?? null;
  let aggregateHierarchyEnabled = false;
  let activeRankViewEnabled = false;
  let aggregateViewBuffer = authority.directoryBuffer;
  let aggregateSourceRowLayoutId = 0;
  let aggregateCapacityWords = 0;
  let aggregateAdmissionStatus = 'schroeder-spatial-aggregate-view-absent';
  if (aggregateView) {
    const aggregateAdmission = validateSchroederSpatialAggregateViewDescriptor(
      aggregateView,
      {
        generationId: authority.execution.generationId,
        deviceOrdinal: authority.execution.deviceOrdinal,
        laneOrdinal: authority.execution.laneOrdinal,
        leaseToken: authority.execution.leaseToken,
        sourceFamilyId: authority.execution.sourceFamilyId,
        storageGeneration: authority.execution.storageGeneration,
        physicsTick: authority.execution.physicsTick,
        physicsSubstep: authority.execution.physicsSubstep,
        positionEpoch: authority.execution.positionEpoch,
        topologyEpoch: authority.execution.topologyEpoch,
        chartEpoch: authority.execution.chartEpoch,
        levelEpoch: authority.execution.levelEpoch,
        supportEpoch: authority.execution.supportEpoch,
        completionOrdinal: authority.execution.buildOrdinal,
        sourceCount: particleCount,
        sourceCapacity: authority.execution.sourceCapacity,
        cellCapacity: authority.execution.cellCapacity,
        sourceRowLayoutId: authority.source.sourceRowLayoutId
      }
    );
    aggregateAdmissionStatus = aggregateAdmission.status;
    const exactSourceAuthority = aggregateView.spatialExecution
        === authority.execution
      && aggregateView.spatialSource === authority.source
      && aggregateView.sourceStateBuffer === authority.stateBuffer
      && aggregateView.sourceThermoBuffer === authority.thermoBuffer
      && (
        !authority.identityBuffer
        || aggregateView.sourceIdentityBuffer === authority.identityBuffer
      );
    if (aggregateAdmission.admitted !== true || !exactSourceAuthority) {
      const error = new TypeError(
        aggregateAdmission.admitted !== true
          ? `canonical mechanical aggregate hierarchy was rejected: ${
              aggregateAdmission.status
            }`
          : 'canonical mechanical aggregate hierarchy does not share the exact source authority'
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_MECHANICAL_AGGREGATE_AUTHENTICATION';
      throw error;
    }
    aggregateViewBuffer = requireBuffer(
      device,
      aggregateView.aggregateViewBuffer,
      'generation.aggregateView.aggregateViewBuffer'
    );
    aggregateSourceRowLayoutId = exactU32(
      aggregateView.sourceRowLayoutId,
      'generation.aggregateView.sourceRowLayoutId',
      { positive: true }
    );
    aggregateCapacityWords = exactU32(
      aggregateView.layout?.wordLength,
      'generation.aggregateView.layout.wordLength',
      { positive: true }
    );
    aggregateHierarchyEnabled = true;
  }
  let activeRankViewAdmissionStatus = activeRankView
    ? 'schroeder-spatial-active-rank-view-not-selected'
    : 'schroeder-spatial-active-rank-view-absent';
  if (!aggregateHierarchyEnabled && activeRankView) {
    const activeRankAdmission = validateSchroederSpatialActiveRankViewDescriptor(
      activeRankView,
      {
        spatialExecution: authority.execution,
        sourceBuffer: authority.execution.sourceBuffer,
        directoryBuffer: authority.directoryBuffer,
        sourceCount: particleCount,
        sourceCapacity: authority.execution.sourceCapacity,
        sourceRowLayoutId: authority.source.sourceRowLayoutId,
        generationId: authority.execution.generationId,
        storageGeneration: authority.execution.storageGeneration,
        physicsTick: authority.execution.physicsTick,
        physicsSubstep: authority.execution.physicsSubstep,
        positionEpoch: authority.execution.positionEpoch,
        topologyEpoch: authority.execution.topologyEpoch,
        chartEpoch: authority.execution.chartEpoch,
        levelEpoch: authority.execution.levelEpoch,
        supportEpoch: authority.execution.supportEpoch,
        buildOrdinal: authority.execution.buildOrdinal
      }
    );
    activeRankViewAdmissionStatus = activeRankAdmission.status;
    if (activeRankAdmission.admitted !== true) {
      const error = new TypeError(
        `canonical mechanical active-rank view was rejected: ${
          activeRankAdmission.status
        }`
      );
      error.code = 'ERR_SCHROEDER_SPATIAL_MECHANICAL_ACTIVE_RANK_AUTHENTICATION';
      throw error;
    }
    aggregateViewBuffer = requireBuffer(
      device,
      activeRankView.activeRankViewBuffer,
      'generation.activeRankView.activeRankViewBuffer'
    );
    aggregateSourceRowLayoutId = exactU32(
      activeRankView.sourceRowLayoutId,
      'generation.activeRankView.sourceRowLayoutId',
      { positive: true }
    );
    aggregateCapacityWords = exactU32(
      activeRankView.layout?.wordLength,
      'generation.activeRankView.layout.wordLength',
      { positive: true }
    );
    activeRankViewEnabled = true;
  }
  if (
    immutableSelectedLevel !== MECHANICAL_APPLY_ALL_LEVELS
    && (
      immutableSelectedLevel < authority.execution.queryMinLevel
      || immutableSelectedLevel > authority.execution.queryMaxLevel
    )
  ) {
    throw new RangeError(
      `selectedLevel ${immutableSelectedLevel} is outside the authenticated spatial range ${
        authority.execution.queryMinLevel
      }..${authority.execution.queryMaxLevel}`
    );
  }
  const spatialSourceBuffer = requireBuffer(
    device,
    authority.source.sourceBuffer ?? authority.source.activeNodeBuffer,
    'generation.source.sourceBuffer'
  );
  const consumerAuthentications = SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
    ({ consumerId, supportProfileId }) => {
      const authentication = resolveSchroederSpatialExactNearConsumerGeneration(
        generation,
        {
          device,
          runtime: generation.runtime,
          consumerId,
          supportProfileId,
          expectedTraversalCount:
            SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
          sourceBuffer: spatialSourceBuffer
        }
      );
      if (authentication?.ready !== true || authentication.authenticated !== true) {
        const error = new Error(
          authentication?.reason
          || `Canonical spatial mechanical consumer ${consumerId} was not authenticated`
        );
        error.code = 'ERR_SCHROEDER_SPATIAL_MECHANICAL_AUTHENTICATION';
        throw error;
      }
      return authentication;
    }
  );
  const contactAuthentication = consumerAuthentications[0];
  const poolAcquisition = mechanicalProposalPoolSlot(
    device,
    particleCount,
    authority.execution.arenaIndex,
    generation,
    pairGraphByteBudget
  );
  const pool = poolAcquisition.slot;
  const identityBuffer = authority.identityBuffer || pool.identityDisabledBuffer;
  const proposalBuffer = pool.proposalBuffer;
  const evidenceBuffer = pool.evidenceBuffer;
  const supportBuffer = pool.supportBuffer;
  const expectationBuffer = pool.expectationBuffer;
  const paramsBuffer = pool.paramsBuffer;
  const uniformQueryLevel = authority.execution.queryMinLevel
      === authority.execution.queryMaxLevel
    ? exactI32(
        authority.execution.queryMinLevel,
        'execution uniform query level'
      )
    : null;
  const evidenceInitial = createMechanicalPairGraphEvidenceHeader({
    execution: authority.execution,
    selectedLevel: immutableSelectedLevel,
    particleCount,
    particleCapacity: pool.capacity,
    directedPairCapacity: pool.directedPairCapacity
  });
  device.queue.writeBuffer(
    expectationBuffer,
    0,
    contactAuthentication.expectationData
  );
  device.queue.writeBuffer(paramsBuffer, 0, createMechanicalParamsArray({
    particleCount,
    directedPairCapacity: pool.directedPairCapacity,
    relaxation,
    normalVelocityDamping,
    gridSpacingM,
    boxDimsM,
    identityEnabled: Boolean(authority.identityBuffer),
    selectedLevel: immutableSelectedLevel,
    phaseLineageCapacity: phaseCarrierPlan.lineageCapacity,
    phaseLaneCount: phaseCarrierPlan.phaseLaneCount,
    retainCompleteAuthenticatedCellCliques,
    aggregateHierarchyEnabled,
    activeRankViewEnabled,
    aggregateSourceRowLayoutId,
    aggregateCapacityWords,
    execution: authority.execution
  }));
  device.queue.writeBuffer(evidenceBuffer, 0, evidenceInitial);
  device.queue.writeBuffer(
    proposalBuffer,
    0,
    createMechanicalProposalHeader(authority.execution, particleCount)
  );

  const buildBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'read-only-storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'uniform'),
    computeBufferBinding(13, 'read-only-storage')
  ];
  const controlBindings = [
    computeBufferBinding(0, 'storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'uniform'),
    computeBufferBinding(9, 'storage')
  ];
  const solverBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'read-only-storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'read-only-storage'),
    computeBufferBinding(7, 'storage'),
    computeBufferBinding(8, 'storage'),
    computeBufferBinding(9, 'read-only-storage'),
    computeBufferBinding(10, 'storage'),
    computeBufferBinding(11, 'uniform'),
    computeBufferBinding(12, 'storage')
  ];
  const applyBindings = [
    computeBufferBinding(0, 'read-only-storage'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'storage'),
    computeBufferBinding(3, 'storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage'),
    computeBufferBinding(6, 'uniform')
  ];
  const createPipeline = ({ cacheKey, label, code, entryPoint, bindings }) => (
    createCachedExplicitComputePipeline(device, {
      cacheKey,
      label,
      code,
      entryPoint,
      bindings
    })
  );
  const initializePipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-initialize.v8',
    label: 'ulg-schroeder-spatial-mechanical-contact-graph-initialize',
    code: schroederSpatialMechanicalGraphControlWgsl,
    entryPoint: 'initialize_contact_graph',
    bindings: controlBindings
  });
  const mechanicalProjectionVariant = aggregateHierarchyEnabled
    ? 'aggregate'
    : (activeRankViewEnabled ? 'active-rank' : 'flat');
  const mechanicalBuildWgsl = aggregateHierarchyEnabled
    ? schroederSpatialMechanicalProposalWgsl
    : (activeRankViewEnabled
      ? schroederSpatialMechanicalProposalActiveRankWgsl
      : schroederSpatialMechanicalProposalFlatWgsl);
  const reductionPipeline = createPipeline({
    cacheKey:
      `ulg-schroeder-spatial-mechanical-contact-graph-support-reduction.${
        mechanicalProjectionVariant
      }.v7`,
    label: 'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction',
    code: mechanicalBuildWgsl,
    entryPoint: 'reduce_support',
    bindings: buildBindings
  });
  const materializePipeline = createPipeline({
    cacheKey: `ulg-schroeder-spatial-mechanical-contact-graph-traversal.${
      mechanicalProjectionVariant
      }.v11`,
    label: 'ulg-schroeder-spatial-mechanical-contact-graph-traversal',
    code: mechanicalBuildWgsl,
    entryPoint: 'materialize_contact_graph',
    bindings: buildBindings
  });
  const finalizeCountsPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts.v8',
    label: 'ulg-schroeder-spatial-mechanical-contact-graph-finalize-counts',
    code: schroederSpatialMechanicalGraphControlWgsl,
    entryPoint: 'finalize_contact_graph_counts',
    bindings: controlBindings
  });
  const scatterPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-scatter-csr.v8',
    label: 'ulg-schroeder-spatial-mechanical-contact-graph-scatter-csr',
    code: schroederSpatialMechanicalGraphControlWgsl,
    entryPoint: 'scatter_contact_graph_csr',
    bindings: controlBindings
  });
  const validatePipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-validate-csr.v9',
    label: 'ulg-schroeder-spatial-mechanical-contact-graph-validate-csr',
    code: schroederSpatialMechanicalGraphControlWgsl,
    entryPoint: 'validate_contact_graph_csr',
    bindings: controlBindings
  });
  const indexPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-contact-graph-index-csr.v4',
    label: 'ulg-schroeder-spatial-mechanical-contact-graph-index-csr',
    code: schroederSpatialMechanicalGraphControlWgsl,
    entryPoint: 'index_contact_graph_csr',
    bindings: controlBindings
  });
  const solverPipelines = Array.from(
    { length: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS },
    (_, iteration) => Object.freeze({
      measure: createPipeline({
        cacheKey:
          `ulg-schroeder-spatial-mechanical-contact-graph-measure-${iteration}.v12`,
        label:
          `ulg-schroeder-spatial-mechanical-contact-graph-measure-${iteration}`,
        code: schroederSpatialMechanicalGraphSolverWgsl,
        entryPoint: `measure_iteration_${iteration}`,
        bindings: solverBindings
      }),
      solve: createPipeline({
        cacheKey:
          `ulg-schroeder-spatial-mechanical-contact-graph-solve-${iteration}.v12`,
        label:
          `ulg-schroeder-spatial-mechanical-contact-graph-solve-${iteration}`,
        code: schroederSpatialMechanicalGraphSolverWgsl,
        entryPoint: `solve_iteration_${iteration}`,
        bindings: solverBindings
      }),
      allocateEnergy: createPipeline({
        cacheKey:
          `ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-${iteration}.v9`,
        label:
          `ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-${iteration}`,
        code: schroederSpatialMechanicalGraphSolverWgsl,
        entryPoint: `allocate_energy_iteration_${iteration}`,
        bindings: solverBindings
      })
    })
  );
  const verifyPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-contact-residual-verify.v12',
    label: 'ulg-schroeder-spatial-mechanical-contact-residual-verify',
    code: schroederSpatialMechanicalGraphSolverWgsl,
    entryPoint: 'verify_contact_residual',
    bindings: solverBindings
  });
  const verifyEnergyPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-contact-energy-verify.v10',
    label: 'ulg-schroeder-spatial-mechanical-contact-energy-verify',
    code: schroederSpatialMechanicalGraphSolverWgsl,
    entryPoint: 'verify_contact_energy',
    bindings: solverBindings
  });
  const publishPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-proposal-publish.v5',
    label: 'ulg-schroeder-spatial-mechanical-proposal-publish',
    code: schroederSpatialMechanicalProposalApplyWgsl,
    entryPoint: 'publish_contact_proposal',
    bindings: applyBindings
  });
  const zeroContactCompletePipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete.v2',
    label: 'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete',
    code: schroederSpatialMechanicalProposalApplyWgsl,
    entryPoint: 'complete_zero_contact_proposal',
    bindings: applyBindings
  });
  const sealPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-proposal-seal.v5',
    label: 'ulg-schroeder-spatial-mechanical-proposal-seal',
    code: schroederSpatialMechanicalProposalApplyWgsl,
    entryPoint: 'seal_contact_proposal',
    bindings: applyBindings
  });
  const commitPipeline = createPipeline({
    cacheKey: 'ulg-schroeder-spatial-mechanical-proposal-commit.v5',
    label: 'ulg-schroeder-spatial-mechanical-proposal-commit',
    code: schroederSpatialMechanicalProposalApplyWgsl,
    entryPoint: 'commit_contact_proposal',
    bindings: applyBindings
  });
  const workgroups = Math.max(1, Math.ceil(particleCount / WORKGROUP_SIZE));
  const buildEntries = (
    stateBuffer,
    mechanicsBuffer,
    { includeAggregate = false } = {}
  ) => [
    { binding: 0, resource: { buffer: stateBuffer } },
    { binding: 1, resource: { buffer: authority.thermoBuffer } },
    { binding: 2, resource: { buffer: mechanicsBuffer } },
    { binding: 3, resource: { buffer: identityBuffer } },
    { binding: 4, resource: { buffer: authority.directoryBuffer } },
    { binding: 5, resource: { buffer: spatialSourceBuffer } },
    { binding: 6, resource: { buffer: pool.sourceCountBuffer } },
    { binding: 7, resource: { buffer: pool.appendStagingBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: evidenceBuffer } },
    { binding: 10, resource: { buffer: supportBuffer } },
    { binding: 11, resource: { buffer: expectationBuffer } },
    { binding: 12, resource: { buffer: paramsBuffer } },
    { binding: 13, resource: { buffer: aggregateViewBuffer } }
  ];
  const controlEntries = [
    { binding: 0, resource: { buffer: pool.sourceCountBuffer } },
    { binding: 1, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 2, resource: { buffer: pool.appendStagingBuffer } },
    { binding: 3, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 4, resource: { buffer: pool.graphControlBuffer } },
    { binding: 5, resource: { buffer: evidenceBuffer } },
    { binding: 6, resource: { buffer: proposalBuffer } },
    { binding: 7, resource: { buffer: pool.scaleBuffer } },
    { binding: 8, resource: { buffer: paramsBuffer } },
    { binding: 9, resource: { buffer: supportBuffer } }
  ];
  const solverEntries = (inputStateBuffer, outputStateBuffer, mechanicsBuffer) => [
    { binding: 0, resource: { buffer: inputStateBuffer } },
    { binding: 1, resource: { buffer: outputStateBuffer } },
    { binding: 2, resource: { buffer: authority.thermoBuffer } },
    { binding: 3, resource: { buffer: mechanicsBuffer } },
    { binding: 4, resource: { buffer: identityBuffer } },
    { binding: 5, resource: { buffer: pool.directedPeerBuffer } },
    { binding: 6, resource: { buffer: pool.sourceOffsetBuffer } },
    { binding: 7, resource: { buffer: pool.scaleBuffer } },
    { binding: 8, resource: { buffer: pool.graphControlBuffer } },
    { binding: 9, resource: { buffer: spatialSourceBuffer } },
    { binding: 10, resource: { buffer: evidenceBuffer } },
    { binding: 11, resource: { buffer: paramsBuffer } },
    { binding: 12, resource: { buffer: pool.energyLedgerBuffer } }
  ];
  const applyEntries = (originalStateBuffer, finalStateBuffer, outputStateBuffer) => [
    { binding: 0, resource: { buffer: originalStateBuffer } },
    { binding: 1, resource: { buffer: finalStateBuffer } },
    { binding: 2, resource: { buffer: proposalBuffer } },
    { binding: 3, resource: { buffer: outputStateBuffer } },
    { binding: 4, resource: { buffer: pool.graphControlBuffer } },
    { binding: 5, resource: { buffer: evidenceBuffer } },
    { binding: 6, resource: { buffer: paramsBuffer } }
  ];
  const bindGroup = (pipelineInfo, entries, label) => device.createBindGroup({
    label,
    layout: pipelineInfo.bindGroupLayout,
    entries
  });
  const contactTimestampActive = Boolean(
    gpuTimestampRecorder?.active === true
      && typeof gpuTimestampRecorder.beginEncoderSpan === 'function'
      && typeof gpuTimestampRecorder.endEncoderSpan === 'function'
  );
  const beginContactTimestamp = (encoder, stage) => (
    contactTimestampActive
      ? gpuTimestampRecorder.beginEncoderSpan(encoder, {
          producerId: `schroeder-spatial-mechanical-contact-graph:${stage}`,
          stage,
          spanClass: 'same-production-command-encoder',
          generationId: authority.execution.generationId
        })
      : null
  );
  const endContactTimestamp = (encoder, token) => {
    if (token) gpuTimestampRecorder.endEncoderSpan(encoder, token);
  };

  const candidateBytesCapacity = pool.directedPairCapacity
    * pool.graphLayout.bytesPerDirectedPair;
  const consumerReceipts = Object.freeze(Object.fromEntries(
    consumerAuthentications.map((authentication) => {
      const receipt = bindSchroederSpatialExactNearResidentConsumerEvidence(
        authentication,
        Object.freeze({
          schema: ULG_SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_SCHEMA,
          status: SCHROEDER_SPATIAL_EXACT_NEAR_RESIDENT_BINDING_STATUS,
          evidenceBuffer,
          controlBuffer: pool.graphControlBuffer,
          evidenceWordCount: SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
          candidateVisitCountWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
              .candidateVisitCount,
          requiredDirectedPairCountWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
              .requiredDirectedPairCount,
          publishedDirectedPairCountWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD
              .publishedDirectedPairCount,
          statusFlagsWord:
            SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_EVIDENCE_WORD.statusFlags,
          pairStorageCapacityBytes: candidateBytesCapacity,
          configuredRetainedByteBudget: pool.pairGraphByteBudget,
          pairGraphSchema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
          resultCountersObserved: false,
          failClosedOnOverflow: true,
          partialPublicationAllowed: false,
          fullReadbackPerformed: false
        })
      );
      return [authentication.consumerId, receipt];
    })
  ));

  let lifecycleStatus = 'prepared';
  let encodeAttempted = false;
  let preparedScan = null;
  let encodedDispatchCount = 0;
  let encodedComputePassCount = 0;
  let released = false;
  let releaseScheduled = false;
  let releasePromise = null;
  const releaseLease = () => {
    if (released) return false;
    released = true;
    lifecycleStatus = 'released';
    if (pool.inUseGenerationId === authority.execution.generationId) {
      pool.inUseGenerationId = null;
      pool.generation = null;
      pool.releaseScheduled = false;
    }
    return true;
  };
  const releaseAfterSubmittedWork = () => {
    if (releaseScheduled || released) return false;
    releaseScheduled = true;
    lifecycleStatus = 'submission-observed';
    pool.releaseScheduled = true;
    const fence = typeof device?.queue?.onSubmittedWorkDone === 'function'
      ? Promise.resolve(device.queue.onSubmittedWorkDone())
      : Promise.resolve();
    const scanRelease = preparedScan
      ? pool.sourceCountScan.releasePreparedAfter(preparedScan, fence)
      : fence;
    releasePromise = Promise.all([fence, scanRelease]).then(
      () => {
        preparedScan = null;
        return releaseLease();
      },
      (error) => {
        releaseScheduled = false;
        lifecycleStatus = encodeAttempted ? 'encoded' : 'prepared';
        pool.releaseScheduled = false;
        releasePromise = null;
        throw error;
      }
    );
    return true;
  };
  const contactGraph = Object.freeze({
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA,
    status: 'schroeder-spatial-mechanical-pair-graph-prepared',
    construction:
      'single-exact-near-traversal-source-count-scan-local-rank-csr',
    retainCompleteAuthenticatedCellCliques:
      Boolean(retainCompleteAuthenticatedCellCliques),
    selectedLevel: immutableSelectedLevel,
    particleCapacity: pool.capacity,
    directedPairCapacity: pool.directedPairCapacity,
    minimumDirectedPairsPerParticle:
      SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
    minimumDirectedPairCapacity: pool.minimumDirectedPairCapacity,
    candidateCapacityBytes: candidateBytesCapacity,
    configuredRetainedByteBudget: pool.pairGraphByteBudget,
    retainedByteLength: pool.graphLayout.retainedByteLength,
    appendRecordStrideWords: 3,
    directedRowWords: 1,
    sourceCountBuffer: pool.sourceCountBuffer,
    sourceOffsetBuffer: pool.sourceOffsetBuffer,
    appendStagingBuffer: pool.appendStagingBuffer,
    directedPeerBuffer: pool.directedPeerBuffer,
    controlBuffer: pool.graphControlBuffer,
    indirectDispatchBuffer: pool.indirectDispatchBuffer,
    indirectDispatchOffsetBytes: 0,
    conditionalDispatchBuffer: pool.conditionalDispatchBuffer,
    conditionalDispatchOffsetBytes:
      pool.graphLayout.conditionalDispatchOffsetBytes,
    controlDispatchSourceOffsetBytes:
      pool.graphLayout.controlDispatchEvidenceOffsetBytes,
    scratchStateABuffer: pool.scratchStateABuffer,
    scratchStateBBuffer: pool.scratchStateBBuffer,
    scaleBuffer: pool.scaleBuffer,
    energyLedgerBuffer: pool.energyLedgerBuffer,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerByteOffset: MECHANICAL_PROPOSAL_HEADER_BYTES,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    layout: pool.graphLayout
  });
  const artifact = {
    schema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA,
    status: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS,
    ready: true,
    proposalMode: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE,
    backend: 'webgpu',
    particleCount,
    generation,
    generationId: authority.execution.generationId,
    arenaIndex: authority.execution.arenaIndex ?? 0,
    proposalCapacity: pool.capacity,
    proposalPoolCacheHit: poolAcquisition.cacheHit,
    proposalPoolAllocationCount: pool.totalBufferCreationCount,
    proposalPoolAcquisitionCount: pool.acquisitionCount + 1,
    supportEpoch: authority.execution.supportEpoch,
    selectedLevel: immutableSelectedLevel,
    encodePolicy: 'single-use-immutable-selected-level',
    sourcePositionAuthority:
      SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY,
    supportProfiles: SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS,
    multiConsumerTraversal: true,
    traversalCount: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
    solverIterationCount: SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS,
    solverPolicy:
      'retained-csr-four-round-reciprocal-mass-tensor-bounded-velocity-jacobi-aggregate-position-trust-fused-energy-measure-nonnegative-edge-heat-final-residual-seal-then-commit',
    aggregateHierarchyEnabled,
    aggregateAdmissionStatus,
    activeRankViewEnabled,
    activeRankViewAdmissionStatus,
    spatialProjectionMode: mechanicalProjectionVariant,
    aggregateSummaryCapability:
      aggregateHierarchyEnabled
        ? 'homogeneous-domain-summary-exact-record-status-v1'
        : (activeRankViewEnabled
          ? 'base-epoch-active-rank-prefix-source-index-v1'
          : 'not-bound-flat-canonical-directory-fallback'),
    contactGraph,
    graphControlBuffer: pool.graphControlBuffer,
    indirectDispatchBuffer: pool.indirectDispatchBuffer,
    conditionalDispatchBuffer: pool.conditionalDispatchBuffer,
    sourceCountBuffer: pool.sourceCountBuffer,
    sourceOffsetBuffer: pool.sourceOffsetBuffer,
    appendStagingBuffer: pool.appendStagingBuffer,
    directedPeerBuffer: pool.directedPeerBuffer,
    scratchStateABuffer: pool.scratchStateABuffer,
    scratchStateBBuffer: pool.scratchStateBBuffer,
    scaleBuffer: pool.scaleBuffer,
    scaleStrideFloats: 4,
    energyLedgerBuffer: pool.energyLedgerBuffer,
    energyLedgerAliasedToProposalRows: true,
    energyLedgerByteOffset: MECHANICAL_PROPOSAL_HEADER_BYTES,
    energyLedgerAliasLifetime: 'solver-scratch-until-proposal-publication',
    energyLedgerRowStrideFloats: 8,
    consumerAuthentications: Object.freeze([...consumerAuthentications]),
    consumerReceipts,
    consumerReceipt(consumerId) {
      return consumerReceipts[consumerId] ?? null;
    },
    proposalBuffer,
    proposalBufferSchema: ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_BUFFER_SCHEMA,
    proposalHeaderWords: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_WORDS,
    proposalHeaderLayout: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_HEADER_LAYOUT,
    proposalRowByteOffset: MECHANICAL_PROPOSAL_HEADER_BYTES,
    proposalRowWords: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_WORDS,
    proposalRowStrideFloats: SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_ROW_FLOATS,
    proposalBufferByteLength:
      MECHANICAL_PROPOSAL_HEADER_BYTES
        + particleCount * MECHANICAL_PROPOSAL_ROW_BYTES,
    evidence: Object.freeze({
      schema: ULG_SCHROEDER_SPATIAL_CONSUMER_GPU_EVIDENCE_SCHEMA,
      status: 'gpu-retained-contact-graph-deferred-encode-ready',
      buffer: evidenceBuffer,
      traversalBuffers: Object.freeze([evidenceBuffer]),
      scaleMeasurementBuffer: pool.scaleBuffer,
      graphControlBuffer: pool.graphControlBuffer,
      traversalCount: SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT,
      wordCount: SCHROEDER_SPATIAL_CONSUMER_EVIDENCE_WORDS,
      layout: SCHROEDER_SPATIAL_MECHANICAL_EVIDENCE_LAYOUT,
      generationId: authority.execution.generationId,
      supportEpoch: authority.execution.supportEpoch,
      selectedLevel: immutableSelectedLevel,
      supportProfileIds: SCHROEDER_SPATIAL_MECHANICAL_CONSUMERS.map(
        ({ supportProfileId }) => supportProfileId
      ),
      privateBuildCount: 0,
      exhaustiveTraversalCount: 0,
      fixedCandidateBuildCount: 0,
      fullParticleReadbackPerformed: false
    }),
    directoryBuildCount: 0,
    sharedGenerationDirectoryBuildCount: 1,
    privateBuildCount: 0,
    exhaustiveTraversalCount: 0,
    fixedCandidateBuildCount: 0,
    candidateBudget: null,
    candidateByteBudget: candidateBytesCapacity,
    configuredRetainedByteBudget: pool.pairGraphByteBudget,
    retainedGraphByteLength: pool.graphLayout.retainedByteLength,
    minimumDirectedPairsPerParticle:
      SCHROEDER_SPATIAL_MECHANICAL_MIN_DIRECTED_PAIRS_PER_PARTICLE,
    minimumDirectedPairCapacity: pool.minimumDirectedPairCapacity,
    directedPairCapacity: pool.directedPairCapacity,
    fullParticleReadbackPerformed: false,
    readbackMode: 'no-full-readback',
    uniformQueryLevel,
    applyLevelFilterPolicy: immutableSelectedLevel === MECHANICAL_APPLY_ALL_LEVELS
      ? 'constructor-bound-all-authenticated-levels'
      : 'constructor-bound-selected-level',
    bufferOwnership: 'device-arena-runtime-cache',
    ownsProposalBuffer: false,
    ownsEvidenceBuffer: false,
    encodeApply(encoder, {
      stateBuffer,
      mechanicsBuffer = authority.mechanicsBuffer,
      selectedLevel: requestedSelectedLevel = null
    } = {}) {
      if (released || releaseScheduled) {
        throw new Error('mechanical proposal cannot apply after arena release begins');
      }
      if (encodeAttempted) {
        throw new Error('mechanical contact graph encodeApply is single-use');
      }
      if (
        !encoder?.clearBuffer
        || !encoder?.copyBufferToBuffer
        || !encoder?.beginComputePass
      ) {
        throw new TypeError(
          'mechanical contact graph encodeApply requires a GPUCommandEncoder-like object'
        );
      }
      const canonicalStateBuffer = requireBuffer(
        device,
        stateBuffer,
        'mechanical proposal apply stateBuffer'
      );
      const canonicalMechanicsBuffer = requireBuffer(
        device,
        mechanicsBuffer,
        'mechanical proposal apply mechanicsBuffer'
      );
      const requestedLevel = requestedSelectedLevel == null
        ? MECHANICAL_APPLY_ALL_LEVELS
        : exactI32(Number(requestedSelectedLevel), 'mechanical proposal selectedLevel');
      if (requestedLevel !== immutableSelectedLevel) {
        throw new Error(
          'mechanical proposal selectedLevel must match its immutable constructor binding'
        );
      }
      const stateByteLength = particleCount * 8 * Float32Array.BYTES_PER_ELEMENT;
      if (
        Number.isFinite(canonicalStateBuffer.size)
        && canonicalStateBuffer.size < stateByteLength
      ) {
        throw new RangeError(
          'mechanical proposal apply stateBuffer is smaller than the authenticated particle state'
        );
      }
      encodeAttempted = true;
      lifecycleStatus = 'encoding';
      try {
        encoder.clearBuffer(supportBuffer);
        encoder.clearBuffer(pool.sourceCountBuffer);
        const buildTimestamp = beginContactTimestamp(encoder, 'build');
        const firstControlBindGroup = bindGroup(
          initializePipeline,
          controlEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-initialize-bind-group'
        );
        const currentBuildEntries = buildEntries(
          canonicalStateBuffer,
          canonicalMechanicsBuffer,
          { includeAggregate: aggregateHierarchyEnabled }
        );
        const currentMaterializeEntries = buildEntries(
          canonicalStateBuffer,
          canonicalMechanicsBuffer,
          { includeAggregate: aggregateHierarchyEnabled }
        );
        const supportBindGroup = bindGroup(
          reductionPipeline,
          currentBuildEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-support-bind-group'
        );
        const materializeBindGroup = bindGroup(
          materializePipeline,
          currentMaterializeEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-traversal-bind-group'
        );
        const zeroEdgeDispatch = (pass) => {
          if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
            throw new TypeError(
              'mechanical contact graph requires compute-pass indirect dispatch'
            );
          }
          pass.dispatchWorkgroupsIndirect(
            pool.conditionalDispatchBuffer,
            contactGraph.conditionalDispatchOffsetBytes
          );
        };
        if (contactTimestampActive) {
          const buildStages = [
            {
              stage: 'initialize',
              label: 'ulg-schroeder-spatial-mechanical-contact-graph-initialize',
              pipeline: initializePipeline.pipeline,
              bindGroup: firstControlBindGroup
            },
            {
              stage: 'support-reduction',
              label:
                'ulg-schroeder-spatial-mechanical-contact-graph-support-reduction',
              pipeline: reductionPipeline.pipeline,
              bindGroup: supportBindGroup
            },
            {
              stage: 'materialize',
              label: 'ulg-schroeder-spatial-mechanical-contact-graph-materialize',
              pipeline: materializePipeline.pipeline,
              bindGroup: materializeBindGroup
            }
          ];
          for (const buildStage of buildStages) {
            const stageTimestamp = beginContactTimestamp(
              encoder,
              buildStage.stage
            );
            const pass = encoder.beginComputePass({ label: buildStage.label });
            pass.setPipeline(buildStage.pipeline);
            pass.setBindGroup(0, buildStage.bindGroup);
            if (buildStage.stage === 'materialize' && activeRankViewEnabled) {
              if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
                throw new TypeError(
                  'mechanical active-rank traversal requires indirect dispatch'
                );
              }
              pass.dispatchWorkgroupsIndirect(
                activeRankView.activeRankViewBuffer,
                activeRankView.dispatchOffsetBytes
              );
            } else {
              pass.dispatchWorkgroups(workgroups);
            }
            pass.end();
            endContactTimestamp(encoder, stageTimestamp);
          }
        } else {
          const firstPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-build'
          });
          firstPass.setPipeline(initializePipeline.pipeline);
          firstPass.setBindGroup(0, firstControlBindGroup);
          firstPass.dispatchWorkgroups(workgroups);
          firstPass.setPipeline(reductionPipeline.pipeline);
          firstPass.setBindGroup(0, supportBindGroup);
          firstPass.dispatchWorkgroups(workgroups);
          firstPass.setPipeline(materializePipeline.pipeline);
          firstPass.setBindGroup(0, materializeBindGroup);
          if (activeRankViewEnabled) {
            if (typeof firstPass.dispatchWorkgroupsIndirect !== 'function') {
              throw new TypeError(
                'mechanical active-rank traversal requires indirect dispatch'
              );
            }
            firstPass.dispatchWorkgroupsIndirect(
              activeRankView.activeRankViewBuffer,
              activeRankView.dispatchOffsetBytes
            );
          } else {
            firstPass.dispatchWorkgroups(workgroups);
          }
          firstPass.end();
        }
        endContactTimestamp(encoder, buildTimestamp);

        preparedScan = pool.sourceCountScan.prepare({
          inputBuffer: pool.sourceCountBuffer,
          outputBuffer: pool.sourceOffsetBuffer,
          elementCount: pool.capacity
        });
        const scanTimestamp = beginContactTimestamp(encoder, 'count-scan');
        pool.sourceCountScan.encodePrepared(encoder, preparedScan, {
          labelPrefix: 'ulg-schroeder-spatial-mechanical-contact-graph-counts'
        });
        endContactTimestamp(encoder, scanTimestamp);

        const finalizeTimestamp = beginContactTimestamp(encoder, 'finalize');
        const finalizePass = encoder.beginComputePass({
          label: 'ulg-schroeder-spatial-mechanical-contact-graph-finalize'
        });
        finalizePass.setPipeline(finalizeCountsPipeline.pipeline);
        finalizePass.setBindGroup(0, bindGroup(
          finalizeCountsPipeline,
          controlEntries,
          'ulg-schroeder-spatial-mechanical-contact-graph-finalize-bind-group'
        ));
        finalizePass.dispatchWorkgroups(1);
        finalizePass.end();
        endContactTimestamp(encoder, finalizeTimestamp);
        encoder.copyBufferToBuffer(
          pool.graphControlBuffer,
          pool.graphLayout.controlDispatchEvidenceOffsetBytes,
          pool.indirectDispatchBuffer,
          0,
          3 * Uint32Array.BYTES_PER_ELEMENT
        );
        encoder.copyBufferToBuffer(
          pool.graphControlBuffer,
          pool.graphLayout.conditionalDispatchSourceOffsetBytes,
          pool.conditionalDispatchBuffer,
          0,
          pool.graphLayout.bufferLayouts.conditionalDispatch.byteLength
        );

        const encodeScatterAndValidation = (pass) => {
          pass.setPipeline(scatterPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            scatterPipeline,
            controlEntries,
            'ulg-schroeder-spatial-mechanical-contact-graph-scatter-bind-group'
          ));
          if (typeof pass.dispatchWorkgroupsIndirect !== 'function') {
            throw new TypeError(
              'mechanical contact graph requires compute-pass indirect dispatch'
            );
          }
          pass.dispatchWorkgroupsIndirect(
            pool.indirectDispatchBuffer,
            0
          );
          pass.setPipeline(indexPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            indexPipeline,
            controlEntries,
            'ulg-schroeder-spatial-mechanical-contact-graph-index-bind-group'
          ));
          pass.dispatchWorkgroups(workgroups);
          pass.setPipeline(validatePipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            validatePipeline,
            controlEntries,
            'ulg-schroeder-spatial-mechanical-contact-graph-validate-bind-group'
          ));
          pass.dispatchWorkgroups(workgroups);
          const zeroContactEntries = applyEntries(
            canonicalStateBuffer,
            pool.scratchStateABuffer,
            pool.scratchStateBBuffer
          );
          pass.setPipeline(zeroContactCompletePipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            zeroContactCompletePipeline,
            zeroContactEntries,
            'ulg-schroeder-spatial-mechanical-proposal-zero-contact-complete-bind-group'
          ));
          zeroEdgeDispatch(pass);
        };
        const encodeSolverIteration = (
          pass,
          iteration,
          inputStateBuffer,
          outputStateBuffer
        ) => {
          const pipelines = solverPipelines[iteration];
          const entries = solverEntries(
            inputStateBuffer,
            outputStateBuffer,
            canonicalMechanicsBuffer
          );
          pass.setPipeline(pipelines.measure.pipeline);
          pass.setBindGroup(0, bindGroup(
            pipelines.measure,
            entries,
            `ulg-schroeder-spatial-mechanical-contact-graph-measure-${iteration}-bind-group`
          ));
          pass.dispatchWorkgroups(workgroups);
          pass.setPipeline(pipelines.solve.pipeline);
          pass.setBindGroup(0, bindGroup(
            pipelines.solve,
            entries,
            `ulg-schroeder-spatial-mechanical-contact-graph-solve-${iteration}-bind-group`
          ));
          pass.dispatchWorkgroups(workgroups);
          pass.setPipeline(pipelines.allocateEnergy.pipeline);
          pass.setBindGroup(0, bindGroup(
            pipelines.allocateEnergy,
            entries,
            `ulg-schroeder-spatial-mechanical-contact-graph-energy-allocate-${iteration}-bind-group`
          ));
          pass.dispatchWorkgroups(workgroups);
        };
        const encodeVerification = (
          pass,
          finalStateBuffer,
          outputStateBuffer
        ) => {
          const entries = solverEntries(
            finalStateBuffer,
            outputStateBuffer,
            canonicalMechanicsBuffer
          );
          pass.setPipeline(verifyEnergyPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            verifyEnergyPipeline,
            entries,
            'ulg-schroeder-spatial-mechanical-contact-energy-verify-bind-group'
          ));
          pass.dispatchWorkgroups(1);
          pass.setPipeline(verifyPipeline.pipeline);
          pass.setBindGroup(0, bindGroup(
            verifyPipeline,
            entries,
            'ulg-schroeder-spatial-mechanical-contact-residual-verify-bind-group'
          ));
          pass.dispatchWorkgroups(workgroups);
        };

        // Round zero can read the immutable canonical post-G2P state directly.
        // Keep canonical untouched until the sealed commit, then alternate the
        // remaining rounds solely between the two scratch buffers.
        let inputStateBuffer = canonicalStateBuffer;
        let outputStateBuffer = pool.scratchStateABuffer;
        const advanceSolverState = (iteration) => {
          const completedOutputBuffer = outputStateBuffer;
          outputStateBuffer = iteration === 0
            ? pool.scratchStateBBuffer
            : inputStateBuffer;
          inputStateBuffer = completedOutputBuffer;
        };
        if (contactTimestampActive) {
          const validationTimestamp = beginContactTimestamp(
            encoder,
            'scatter-validate'
          );
          const validationPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-scatter-validate'
          });
          encodeScatterAndValidation(validationPass);
          validationPass.end();
          endContactTimestamp(encoder, validationTimestamp);
          for (
            let iteration = 0;
            iteration < SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS;
            iteration += 1
          ) {
            const iterationTimestamp = beginContactTimestamp(
              encoder,
              `iteration-${iteration}`
            );
            const iterationPass = encoder.beginComputePass({
              label:
                `ulg-schroeder-spatial-mechanical-contact-graph-iteration-${iteration}`
            });
            encodeSolverIteration(
              iterationPass,
              iteration,
              inputStateBuffer,
              outputStateBuffer
            );
            iterationPass.end();
            endContactTimestamp(encoder, iterationTimestamp);
            advanceSolverState(iteration);
          }
          const verificationTimestamp = beginContactTimestamp(
            encoder,
            'energy-residual-verify'
          );
          const verificationPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-verify'
          });
          encodeVerification(
            verificationPass,
            inputStateBuffer,
            outputStateBuffer
          );
          verificationPass.end();
          endContactTimestamp(encoder, verificationTimestamp);
        } else {
          const secondPass = encoder.beginComputePass({
            label: 'ulg-schroeder-spatial-mechanical-contact-graph-solve'
          });
          encodeScatterAndValidation(secondPass);
          for (
            let iteration = 0;
            iteration < SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS;
            iteration += 1
          ) {
            encodeSolverIteration(
              secondPass,
              iteration,
              inputStateBuffer,
              outputStateBuffer
            );
            advanceSolverState(iteration);
          }
          encodeVerification(secondPass, inputStateBuffer, outputStateBuffer);
          secondPass.end();
        }
        // Four Jacobi rounds finish in scratch B. The zero-edge completion
        // writes that same buffer before the shared seal/commit stages, so
        // no host-side graph-count readback or divergent publication route is
        // needed.
        const finalStateBuffer = (
          SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS % 2 === 0
        ) ? pool.scratchStateBBuffer : pool.scratchStateABuffer;

        const publishTimestamp = beginContactTimestamp(encoder, 'publish');
        const publishPass = encoder.beginComputePass({
          label: 'ulg-schroeder-spatial-mechanical-contact-graph-publish'
        });
        const publishEntries = applyEntries(
          canonicalStateBuffer,
          finalStateBuffer,
          outputStateBuffer
        );
        publishPass.setPipeline(publishPipeline.pipeline);
        publishPass.setBindGroup(0, bindGroup(
          publishPipeline,
          publishEntries,
          'ulg-schroeder-spatial-mechanical-proposal-publish-bind-group'
        ));
        publishPass.dispatchWorkgroups(workgroups);
        publishPass.end();
        endContactTimestamp(encoder, publishTimestamp);

        const commitTimestamp = beginContactTimestamp(encoder, 'seal-commit');
        const commitPass = encoder.beginComputePass({
          label: 'ulg-schroeder-spatial-mechanical-contact-graph-commit'
        });
        const commitEntries = applyEntries(
          outputStateBuffer,
          finalStateBuffer,
          canonicalStateBuffer
        );
        commitPass.setPipeline(sealPipeline.pipeline);
        commitPass.setBindGroup(0, bindGroup(
          sealPipeline,
          commitEntries,
          'ulg-schroeder-spatial-mechanical-proposal-seal-bind-group'
        ));
        commitPass.dispatchWorkgroups(1);
        commitPass.setPipeline(commitPipeline.pipeline);
        commitPass.setBindGroup(0, bindGroup(
          commitPipeline,
          commitEntries,
          'ulg-schroeder-spatial-mechanical-proposal-commit-bind-group'
        ));
        commitPass.dispatchWorkgroups(workgroups);
        commitPass.end();
        endContactTimestamp(encoder, commitTimestamp);
        encodedDispatchCount = 25 + preparedScan.encodedDispatchCount;
        encodedComputePassCount = contactTimestampActive ? 13 : 6;
        lifecycleStatus = 'encoded';
        return true;
      } catch (error) {
        if (preparedScan) {
          pool.sourceCountScan.releasePrepared(preparedScan, {
            discardedEncoder: true
          });
          preparedScan = null;
        }
        lifecycleStatus = 'encode-failed';
        throw error;
      }
    },
    cleanupTemporaryBuffersAfterSubmittedWork() {
      return false;
    },
    releaseAfterSubmittedWork,
    destroy: releaseAfterSubmittedWork,
    get lifecycleStatus() { return lifecycleStatus; },
    get encodedDispatchCount() { return encodedDispatchCount; },
    get encodedComputePassCount() { return encodedComputePassCount; },
    get released() { return released; },
    get releaseScheduled() { return releaseScheduled; },
    get releasePromise() { return releasePromise; }
  };
  Object.freeze(artifact);
  pool.inUseGenerationId = authority.execution.generationId;
  pool.generation = generation;
  pool.releaseScheduled = false;
  pool.acquisitionCount += 1;
  liveMechanicalProposalArtifacts.add(artifact);
  return artifact;
}

export function schroederSpatialMechanicalProposalMatchesContract(
  proposal,
  { device = null, generation = null } = {}
) {
  const traversalBuffers = proposal?.evidence?.traversalBuffers;
  const contactGraph = proposal?.contactGraph;
  return Boolean(
    proposal
    && Object.isFrozen(proposal)
    && proposal.schema === ULG_SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_SCHEMA
    && proposal.status === SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_STATUS
    && proposal.ready === true
    && proposal.proposalMode === SCHROEDER_SPATIAL_MECHANICAL_PROPOSAL_MODE
    && proposal.sourcePositionAuthority
      === SCHROEDER_SPATIAL_MECHANICAL_SOURCE_POSITION_AUTHORITY
    && proposal.encodePolicy === 'single-use-immutable-selected-level'
    && (
      proposal.lifecycleStatus === 'prepared'
      || proposal.lifecycleStatus === 'encoded'
    )
    && proposal.released !== true
    && proposal.releaseScheduled !== true
    && proposal.generation === generation
    && proposal.generationId === generation?.execution?.generationId
    && proposal.supportEpoch === generation?.execution?.supportEpoch
    && proposal.traversalCount
      === SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT
    && proposal.solverIterationCount
      === SCHROEDER_SPATIAL_MECHANICAL_SOLVER_ITERATIONS
    && proposal.evidence?.traversalCount
      === SCHROEDER_SPATIAL_MECHANICAL_TRAVERSAL_COUNT
    && Array.isArray(traversalBuffers)
    && traversalBuffers.length === 1
    && traversalBuffers[0] === proposal.evidence?.buffer
    && traversalBuffers.every((buffer) => webGpuBufferMatchesDevice(buffer, device))
    && proposal.privateBuildCount === 0
    && proposal.fixedCandidateBuildCount === 0
    && proposal.exhaustiveTraversalCount === 0
    && proposal.fullParticleReadbackPerformed === false
    && webGpuBufferMatchesDevice(proposal.proposalBuffer, device)
    && webGpuBufferMatchesDevice(proposal.evidence?.buffer, device)
    && webGpuBufferMatchesDevice(proposal.scaleBuffer, device)
    && webGpuBufferMatchesDevice(proposal.energyLedgerBuffer, device)
    && proposal.energyLedgerBuffer === proposal.proposalBuffer
    && proposal.energyLedgerAliasedToProposalRows === true
    && proposal.energyLedgerByteOffset === MECHANICAL_PROPOSAL_HEADER_BYTES
    && proposal.energyLedgerAliasLifetime
      === 'solver-scratch-until-proposal-publication'
    && webGpuBufferMatchesDevice(
      proposal.evidence?.scaleMeasurementBuffer,
      device
    )
    && contactGraph?.schema
      === ULG_SCHROEDER_SPATIAL_MECHANICAL_PAIR_GRAPH_SCHEMA
    && contactGraph.status
      === 'schroeder-spatial-mechanical-pair-graph-prepared'
    && contactGraph.selectedLevel === proposal.selectedLevel
    && Number.isInteger(contactGraph.directedPairCapacity)
    && contactGraph.directedPairCapacity > 0
    && contactGraph.directedPairCapacity === proposal.directedPairCapacity
    && contactGraph.layout?.readbackRequired === false
    && webGpuBufferMatchesDevice(contactGraph.sourceCountBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.sourceOffsetBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.appendStagingBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.directedPeerBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.controlBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.indirectDispatchBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.conditionalDispatchBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.scratchStateABuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.scratchStateBBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.scaleBuffer, device)
    && webGpuBufferMatchesDevice(contactGraph.energyLedgerBuffer, device)
    && contactGraph.energyLedgerBuffer === proposal.proposalBuffer
    && contactGraph.energyLedgerAliasedToProposalRows === true
    && contactGraph.energyLedgerByteOffset === MECHANICAL_PROPOSAL_HEADER_BYTES
    && contactGraph.energyLedgerAliasLifetime
      === 'solver-scratch-until-proposal-publication'
    && contactGraph.controlBuffer === proposal.graphControlBuffer
    && contactGraph.indirectDispatchBuffer === proposal.indirectDispatchBuffer
    && contactGraph.conditionalDispatchBuffer
      === proposal.conditionalDispatchBuffer
    && contactGraph.sourceCountBuffer === proposal.sourceCountBuffer
    && contactGraph.sourceOffsetBuffer === proposal.sourceOffsetBuffer
    && contactGraph.appendStagingBuffer === proposal.appendStagingBuffer
    && contactGraph.directedPeerBuffer === proposal.directedPeerBuffer
    && contactGraph.scratchStateABuffer === proposal.scratchStateABuffer
    && contactGraph.scratchStateBBuffer === proposal.scratchStateBBuffer
    && contactGraph.scaleBuffer === proposal.scaleBuffer
    && contactGraph.energyLedgerBuffer === proposal.energyLedgerBuffer
    && typeof proposal.encodeApply === 'function'
  );
}

export function isLiveSchroederSpatialMechanicalProposal(
  proposal,
  { device = null, generation = null } = {}
) {
  return Boolean(
    liveMechanicalProposalArtifacts.has(proposal)
    && schroederSpatialMechanicalProposalMatchesContract(proposal, {
      device,
      generation
    })
  );
}
