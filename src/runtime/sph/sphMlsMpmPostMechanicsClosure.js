import { runSphThermalStepWebGpu } from './sphThermalGpuKernel.js';
import { runSphReactionStepWebGpu } from './sphReactionGpuKernel.js';
import { runMlsMpmMechanicsRefreshWithOptionalWebGpu } from './sphMechanicsRefreshGpuKernel.js';
import {
  retainedPhaseCarrierTransferOutputBuffers,
  runSphPhaseCarrierTransferWebGpu
} from './sphPhaseCarrierTransferGpu.js';
import { createResidentProductMassHandle } from './sphReactionGpuSummary.js';
import { deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import {
  validateSchroederSpatialEpochTransactionSourceFamily
} from './schroederSpatialEpochTransaction.js';
import {
  releasePostSeparationThermalBinAuthorityAfterQueue
} from './sphPostSeparationThermalBinAuthority.js';

export const ULG_MLS_MPM_POST_MECHANICS_CLOSURE_SCHEMA =
  'peercompute.ulg.mls-mpm-post-mechanics-closure.v1';

export const MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER = Object.freeze([
  'schroeder-far-force-delta-fusion',
  'thermal-phase',
  'reaction-discovery',
  'reaction-product',
  'phase-carrier-transfer-v2',
  'mechanics-constitutive-refresh'
]);

const NO_FULL_READBACK_MODE = 'no-full-readback';
const POST_MECHANICS_COMPONENTS = Object.freeze([
  'state',
  'thermo',
  'mechanics'
]);
const POST_MECHANICS_CLOSURE_AUTHORITIES = new WeakMap();

function retainedStageSource(stage) {
  return stage?.result || stage || null;
}

function componentOwnershipValue(source, component, buffer) {
  if (!buffer) return false;
  const property = `owns${component[0].toUpperCase()}${component.slice(1)}Buffer`;
  if (typeof source?.[property] === 'boolean') return source[property];
  const declared = source?.componentOwnership?.[component]
    ?? source?.bufferOwnership?.[component];
  if (typeof declared === 'boolean') return declared;
  if (declared === 'borrowed' || declared === 'external') return false;
  if (declared === 'owned' || declared === 'producer') return true;
  // Retained stage outputs are producer-owned unless the runner explicitly
  // marks an aliased/borrowed component. Input upload families never pass
  // through this helper when closure ownership is computed.
  return true;
}

function componentOwnershipFields(source, components) {
  return Object.fromEntries(components.map((component) => {
    const buffer = source?.[`${component}Buffer`] || null;
    return [
      `owns${component[0].toUpperCase()}${component.slice(1)}Buffer`,
      componentOwnershipValue(source, component, buffer)
    ];
  }));
}

export function phaseCarrierPlanReady(plan) {
  return plan?.status === 'phase-lane-capacity-ready'
    || plan?.status === 'phase-companion-capacity-ready';
}

export function retainedG2pOutputBuffers(g2pReconstruction) {
  const source = g2pReconstruction?.gpuResult || g2pReconstruction;
  return {
    stateBuffer: source?.stateBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    postSeparationThermalBinAuthority:
      source?.postSeparationThermalBinAuthority || null,
    ...componentOwnershipFields(source, ['state', 'mechanics'])
  };
}

export function retainedSchroederFarForceDeltaFusionOutputBuffers(
  schroederFarForceDeltaFusion
) {
  const source = schroederFarForceDeltaFusion?.result
    || schroederFarForceDeltaFusion;
  return {
    stateBuffer: source?.stateBuffer || source?.outputStateBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    ...componentOwnershipFields(source, ['state'])
  };
}

export function retainedThermalOutputBuffers(thermalStep) {
  const source = thermalStep?.result || thermalStep;
  return {
    stateBuffer: source?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    ...componentOwnershipFields(source, ['state', 'thermo'])
  };
}

export function residentProductMassFromReactionStep(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  return source?.residentProductMass
    || createResidentProductMassHandle(source?.reactionSummary || null);
}

export function retainedReactionOutputBuffers(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  const residentProductMass = residentProductMassFromReactionStep(reactionStep);
  return {
    stateBuffer: source?.stateBuffer || null,
    thermoBuffer: source?.thermoBuffer || null,
    mechanicsBuffer: source?.mechanicsBuffer || null,
    stateBufferByteLength: source?.stateBufferByteLength || 0,
    thermoBufferByteLength: source?.thermoBufferByteLength || 0,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    residentProductMass,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    ...componentOwnershipFields(source, ['state', 'thermo', 'mechanics'])
  };
}

export function retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep) {
  const source = mechanicsRefreshStep?.result || mechanicsRefreshStep;
  return {
    mechanicsBuffer: source?.mechanicsBuffer || null,
    mechanicsBufferByteLength: source?.mechanicsBufferByteLength || 0,
    destroyOutputParticleBuffers: source?.destroyOutputParticleBuffers || null,
    destroyOutputParticleBufferComponents:
      source?.destroyOutputParticleBufferComponents || null,
    ...componentOwnershipFields(source, ['mechanics'])
  };
}

function nonzeroSummaryValue(value, tolerance = 1e-12) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric) > tolerance;
}

export function reactionOutputComponentMutations(reactionStep) {
  const reactionResult = reactionStep?.result || reactionStep;
  if (!reactionResult) {
    return Object.freeze({
      state: false,
      thermo: false,
      mechanics: false,
      any: false,
      complete: false,
      summarySuppressed: false
    });
  }
  const available = {
    state: Boolean(reactionResult.stateBuffer),
    thermo: Boolean(reactionResult.thermoBuffer),
    mechanics: Boolean(reactionResult.mechanicsBuffer)
  };
  if (!Object.values(available).some(Boolean)) {
    return Object.freeze({
      ...available,
      any: false,
      complete: false,
      summarySuppressed: false
    });
  }
  const summary = reactionResult.reactionSummary || null;
  const summaryMutates = !summary?.reactionSummaryAvailable || [
    summary.changedMaterialCount,
    summary.changedMassCount,
    summary.visibleProductMassKg,
    summary.visibleGasProductMassKg,
    summary.outputGasPhaseMassKg,
    summary.canonicalReactionEventCount,
    summary.consumedReactantMassKg,
    summary.expectedProductMassKg,
    summary.rawProductMassKg,
    summary.ledgerVisibleProductMassKg,
    summary.ledgerUnplacedProductMassKg,
    summary.ledgerGasProductMassKg,
    summary.ledgerVisibleGasProductMassKg,
    summary.ledgerUnplacedGasProductMassKg,
    summary.sealedBoxGasProductMoles,
    summary.reactionHeatJ,
    summary.ledgerReadyEventCount,
    summary.ledgerProblemEventCount,
    summary.productEventActiveEventCount
  ].some((value) => nonzeroSummaryValue(value));
  const mutations = {
    state: summaryMutates && available.state,
    thermo: summaryMutates && available.thermo,
    mechanics: summaryMutates && available.mechanics
  };
  return Object.freeze({
    ...mutations,
    any: Object.values(mutations).some(Boolean),
    complete: Object.values(mutations).every(Boolean),
    summarySuppressed: !summaryMutates
  });
}

export function reactionOutputMutatesParticles(reactionStep) {
  return reactionOutputComponentMutations(reactionStep).any;
}

export function destroyReactionOutputAfterFailedMechanicsRefresh(reactionStep) {
  const source = reactionStep?.result || reactionStep;
  if (!source) return false;
  if (typeof source.destroyOutputParticleBuffers === 'function') {
    source.destroyOutputParticleBuffers();
    return true;
  }
  const buffers = new Set([
    source.stateBuffer,
    source.thermoBuffer,
    source.mechanicsBuffer
  ].filter(Boolean));
  for (const buffer of buffers) buffer.destroy?.();
  const residentProductMass = source.residentProductMass || null;
  residentProductMass?.destroyResidentProductMassBuffers?.();
  return buffers.size > 0 || Boolean(residentProductMass);
}

function sameResidentProductMass(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  return Boolean(
    left.productEventBuffer
    && left.productEventBuffer === right.productEventBuffer
  );
}

function postMechanicsOwnedOutputFamilies({
  schroederFarForceDeltaFusion,
  thermalStep,
  reactionStep,
  mechanicsRefreshStep,
  phaseCarrierTransferStep,
  preservedBuffers = new Set()
}) {
  const far = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanics = retainedMechanicsRefreshOutputBuffers(
    mechanicsRefreshStep
  );
  const phase = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const candidates = [
    {
      stage: 'schroeder-far-force-delta-fusion',
      output: far,
      components: [
        ['state', far.stateBuffer, far.ownsStateBuffer]
      ]
    },
    {
      stage: 'thermal-phase',
      output: thermal,
      components: [
        ['state', thermal.stateBuffer, thermal.ownsStateBuffer],
        ['thermo', thermal.thermoBuffer, thermal.ownsThermoBuffer]
      ]
    },
    {
      stage: 'reaction-product',
      output: reaction,
      residentProductMass: reaction.residentProductMass,
      components: [
        ['state', reaction.stateBuffer, reaction.ownsStateBuffer],
        ['thermo', reaction.thermoBuffer, reaction.ownsThermoBuffer],
        ['mechanics', reaction.mechanicsBuffer,
          reaction.ownsMechanicsBuffer]
      ]
    },
    {
      stage: 'mechanics-constitutive-refresh',
      output: mechanics,
      components: [
        ['mechanics', mechanics.mechanicsBuffer,
          mechanics.ownsMechanicsBuffer]
      ]
    },
    {
      stage: 'phase-carrier-transfer-v2',
      output: {
        ...phase,
        destroyOutputParticleBuffers:
          phaseSource?.destroyOutputParticleBuffers || null
      },
      components: [
        ['state', phase.stateBuffer,
          componentOwnershipValue(phaseSource, 'state', phase.stateBuffer)],
        ['thermo', phase.thermoBuffer,
          componentOwnershipValue(phaseSource, 'thermo', phase.thermoBuffer)],
        ['mechanics', phase.mechanicsBuffer,
          componentOwnershipValue(
            phaseSource,
            'mechanics',
            phase.mechanicsBuffer
          )]
      ]
    }
  ];
  return candidates.flatMap((candidate) => {
    const destroyOutputParticleBuffers =
      candidate.output?.destroyOutputParticleBuffers;
    const destroyOutputParticleBufferComponents =
      candidate.output?.destroyOutputParticleBufferComponents;
    if (
      typeof destroyOutputParticleBuffers !== 'function'
      && typeof destroyOutputParticleBufferComponents !== 'function'
    ) return [];
    const ownedComponents = candidate.components.filter(
      ([, buffer, owned]) => buffer && owned === true
    );
    const managedComponents = ownedComponents.filter(
      ([, buffer]) => !preservedBuffers.has(buffer)
    );
    const managedBuffers = [...new Set(managedComponents.map(([, buffer]) => buffer))];
    if (managedBuffers.length === 0) return [];
    const externallyPreservedComponents = ownedComponents.filter(
      ([, buffer]) => preservedBuffers.has(buffer)
    );
    return [Object.freeze({
      stage: candidate.stage,
      output: candidate.output,
      destroyOutputParticleBuffers,
      destroyOutputParticleBufferComponents,
      residentProductMass: candidate.residentProductMass || null,
      managedComponents: Object.freeze(managedComponents.map(
        ([component, buffer]) => Object.freeze({ component, buffer })
      )),
      managedBuffers: Object.freeze(managedBuffers),
      externallyPreservedComponents: Object.freeze(
        externallyPreservedComponents.map(
          ([component, buffer]) => Object.freeze({ component, buffer })
        )
      ),
      externallyPreservedBuffers: Object.freeze([...new Set(
        externallyPreservedComponents.map(([, buffer]) => buffer)
      )])
    })];
  });
}

function destroyFailedPostMechanicsStageOutputs({
  postMechanicsParticleBuffers,
  sphParticleUpload,
  mlsMpmParticleUpload,
  schroederFarForceDeltaFusion,
  thermalStep,
  reactionStep,
  mechanicsRefreshStep,
  phaseCarrierTransferStep,
  inputResidentProductMass
}) {
  const cleanupReceipt = {
    schema: 'peercompute.ulg.mls-mpm-post-mechanics-failure-cleanup.v1',
    status: 'post-mechanics-failure-cleanup-running',
    releasedOwnerFamilyCount: 0,
    releasedComponentCount: 0,
    rawDestroyedBufferCount: 0,
    blockers: []
  };
  const pendingCompletions = [];
  const addBlocker = (blocker) => {
    if (!cleanupReceipt.blockers.includes(blocker)) {
      cleanupReceipt.blockers.push(blocker);
    }
  };
  const preserved = new Set([
    postMechanicsParticleBuffers?.stateBuffer,
    postMechanicsParticleBuffers?.mechanicsBuffer,
    sphParticleUpload?.stateBuffer,
    sphParticleUpload?.thermoBuffer,
    sphParticleUpload?.identityBuffer,
    mlsMpmParticleUpload?.mechanicsBuffer
  ].filter(Boolean));
  const far = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanics = retainedMechanicsRefreshOutputBuffers(
    mechanicsRefreshStep
  );
  const phase = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const ownerFamilies = postMechanicsOwnedOutputFamilies({
    schroederFarForceDeltaFusion,
    thermalStep,
    reactionStep,
    mechanicsRefreshStep,
    phaseCarrierTransferStep,
    preservedBuffers: preserved
  });
  const familyManagedBuffers = new Set(ownerFamilies.flatMap(
    (family) => family.managedBuffers
  ));
  for (const family of ownerFamilies) {
    if (family.externallyPreservedBuffers.length > 0) {
      // A whole-family destroyer may own both a borrowed input alias and a
      // newly produced sibling. Retire only the unpreserved siblings through
      // an explicit component owner; raw destruction would bypass a pooled or
      // arena owner. If no component surface exists, publish a durable blocker
      // on the thrown failure instead of silently reporting cleanup success.
      if (typeof family.destroyOutputParticleBufferComponents !== 'function') {
        addBlocker(
          `preserved-alias-owner-lacks-component-retirement:${family.stage}`
        );
        continue;
      }
      const selection = Object.fromEntries(
        family.managedComponents.map(({ component }) => [component, true])
      );
      try {
        const release = family.destroyOutputParticleBufferComponents.call(
          family.output,
          selection
        );
        if (release?.then) {
          pendingCompletions.push(Promise.resolve(release).then(
            (confirmed) => {
              if (confirmed !== true) {
                addBlocker(
                  `component-owner-release-unconfirmed:${family.stage}`
                );
                return false;
              }
              cleanupReceipt.releasedComponentCount +=
                family.managedBuffers.length;
              return true;
            },
            (error) => {
              addBlocker(
                `component-owner-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
              );
              return false;
            }
          ));
        } else if (release === false) {
          addBlocker(`component-owner-release-refused:${family.stage}`);
        } else {
          cleanupReceipt.releasedComponentCount += family.managedBuffers.length;
        }
      } catch (error) {
        addBlocker(
          `component-owner-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
        );
      }
      continue;
    }
    try {
      const preserveResidentProductMass = Boolean(
        family.residentProductMass
        && sameResidentProductMass(
          family.residentProductMass,
          inputResidentProductMass
        )
      );
      const release = family.destroyOutputParticleBuffers.call(
        family.output,
        { preserveResidentProductMass }
      );
      if (release?.then) {
        pendingCompletions.push(Promise.resolve(release).then(
          (confirmed) => {
            if (confirmed === false) {
              addBlocker(`owner-family-release-refused:${family.stage}`);
              return false;
            }
            cleanupReceipt.releasedOwnerFamilyCount += 1;
            return true;
          },
          (error) => {
            addBlocker(
              `owner-family-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
            );
            return false;
          }
        ));
      } else if (release === false) {
        addBlocker(`owner-family-release-refused:${family.stage}`);
      } else {
        cleanupReceipt.releasedOwnerFamilyCount += 1;
      }
    } catch (error) {
      // An owner-family failure must never fall through to raw member
      // destruction: bounded arenas and pooled outputs retain authority over
      // every member even when their release callback rejects cleanup.
      addBlocker(
        `owner-family-release-failed:${family.stage}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  const outputs = new Set([
    far.ownsStateBuffer && far.stateBuffer,
    thermal.ownsStateBuffer && thermal.stateBuffer,
    thermal.ownsThermoBuffer && thermal.thermoBuffer,
    reaction.ownsStateBuffer && reaction.stateBuffer,
    reaction.ownsThermoBuffer && reaction.thermoBuffer,
    reaction.ownsMechanicsBuffer && reaction.mechanicsBuffer,
    mechanics.ownsMechanicsBuffer && mechanics.mechanicsBuffer,
    componentOwnershipValue(phaseSource, 'state', phase.stateBuffer)
      && phase.stateBuffer,
    componentOwnershipValue(phaseSource, 'thermo', phase.thermoBuffer)
      && phase.thermoBuffer,
    componentOwnershipValue(phaseSource, 'mechanics', phase.mechanicsBuffer)
      && phase.mechanicsBuffer
  ].filter((buffer) => (
    buffer
    && !preserved.has(buffer)
    && !familyManagedBuffers.has(buffer)
  )));
  for (const buffer of outputs) {
    try {
      buffer.destroy?.();
      cleanupReceipt.rawDestroyedBufferCount += 1;
    } catch (error) {
      addBlocker(
        `raw-buffer-retirement-failed:${buffer?.label || 'unlabelled'}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  const emittedResidentProductMass = reaction.residentProductMass;
  if (
    emittedResidentProductMass
    && !ownerFamilies.some((family) => (
      family.residentProductMass
      && sameResidentProductMass(
        family.residentProductMass,
        emittedResidentProductMass
      )
    ))
    && !sameResidentProductMass(
      emittedResidentProductMass,
      inputResidentProductMass
    )
  ) {
    try {
      const productRelease =
        emittedResidentProductMass.destroyResidentProductMassBuffers?.();
      if (productRelease?.then) {
        pendingCompletions.push(Promise.resolve(productRelease).then(
          (confirmed) => {
            if (confirmed !== true) {
              addBlocker('resident-product-mass-release-unconfirmed');
              return false;
            }
            return true;
          },
          (error) => {
            addBlocker(
              `resident-product-mass-release-failed:${error instanceof Error ? error.message : String(error)}`
            );
            return false;
          }
        ));
      }
    } catch (error) {
      // A product-mass cleanup failure must not strand later output buffers.
      addBlocker(
        `resident-product-mass-release-failed:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  const finish = () => {
    cleanupReceipt.status = cleanupReceipt.blockers.length > 0
      ? 'post-mechanics-failure-cleanup-blocked'
      : 'post-mechanics-failure-cleanup-complete';
    return cleanupReceipt;
  };
  const completion = pendingCompletions.length > 0
    ? Promise.all(pendingCompletions).then(finish)
    : Promise.resolve(finish());
  Object.defineProperty(cleanupReceipt, 'completion', {
    value: completion,
    enumerable: false
  });
  return cleanupReceipt;
}

function retainedGenerationMetadata({
  sphParticleUpload,
  mlsMpmParticleUpload,
  schroederSpatialEpochGeneration
}) {
  const execution = schroederSpatialEpochGeneration?.execution || null;
  return Object.freeze({
    storageGeneration:
      sphParticleUpload?.storageGeneration
      ?? sphParticleUpload?.bufferFamilyGeneration
      ?? null,
    mechanicsStorageGeneration:
      mlsMpmParticleUpload?.storageGeneration
      ?? mlsMpmParticleUpload?.bufferFamilyGeneration
      ?? null,
    positionEpoch:
      sphParticleUpload?.positionEpoch ?? execution?.positionEpoch ?? null,
    topologyEpoch:
      sphParticleUpload?.topologyEpoch ?? execution?.topologyEpoch ?? null,
    chartEpoch: sphParticleUpload?.chartEpoch ?? execution?.chartEpoch ?? null,
    levelEpoch: sphParticleUpload?.levelEpoch ?? execution?.levelEpoch ?? null,
    supportEpoch:
      sphParticleUpload?.supportEpoch ?? execution?.supportEpoch ?? null,
    spatialGenerationId: execution?.generationId ?? null,
    spatialStorageGeneration: execution?.storageGeneration ?? null,
    spatialPhysicsTick: execution?.physicsTick ?? null,
    spatialPhysicsSubstep: execution?.physicsSubstep ?? null
  });
}

export function resolveMlsMpmPostMechanicsContinuation({
  postMechanicsParticleBuffers,
  sourceThermoBuffer = null,
  schroederFarForceDeltaFusion = null,
  thermalStep = null,
  reactionStep = null,
  mechanicsRefreshStep = null,
  phaseCarrierTransferStep = null,
  phaseCarrierPlan = null,
  inputResidentProductMass = null,
  sphParticleUpload = null,
  mlsMpmParticleUpload = null,
  schroederSpatialEpochGeneration = null
} = {}) {
  const g2pOutput = postMechanicsParticleBuffers || {};
  const farForceOutput =
    retainedSchroederFarForceDeltaFusionOutputBuffers(
      schroederFarForceDeltaFusion
    );
  const thermalOutput = retainedThermalOutputBuffers(thermalStep);
  const reactionOutput = retainedReactionOutputBuffers(reactionStep);
  const mechanicsRefreshOutput =
    retainedMechanicsRefreshOutputBuffers(mechanicsRefreshStep);
  const phaseCarrierOutput = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const reactionComponentMutations =
    reactionOutputComponentMutations(reactionStep);
  const select = (candidates) => candidates.find(({ buffer }) => buffer) || {
    stage: null,
    buffer: null,
    ownedByClosure: false
  };
  const selected = {
    state: select([
      {
        stage: 'phase-carrier-transfer-v2',
        buffer: phaseCarrierOutput.stateBuffer,
        ownedByClosure: componentOwnershipValue(
          phaseSource,
          'state',
          phaseCarrierOutput.stateBuffer
        )
      },
      {
        stage: 'reaction-product',
        buffer: reactionComponentMutations.state
          ? reactionOutput.stateBuffer
          : null,
        ownedByClosure: reactionOutput.ownsStateBuffer === true
      },
      {
        stage: 'thermal-phase',
        buffer: thermalOutput.stateBuffer,
        ownedByClosure: thermalOutput.ownsStateBuffer === true
      },
      {
        stage: 'schroeder-far-force-delta-fusion',
        buffer: farForceOutput.stateBuffer,
        ownedByClosure: farForceOutput.ownsStateBuffer === true
      },
      {
        stage: 'post-mechanics-input',
        buffer: g2pOutput.stateBuffer,
        ownedByClosure: false
      }
    ]),
    thermo: select([
      {
        stage: 'phase-carrier-transfer-v2',
        buffer: phaseCarrierOutput.thermoBuffer,
        ownedByClosure: componentOwnershipValue(
          phaseSource,
          'thermo',
          phaseCarrierOutput.thermoBuffer
        )
      },
      {
        stage: 'reaction-product',
        buffer: reactionComponentMutations.thermo
          ? reactionOutput.thermoBuffer
          : null,
        ownedByClosure: reactionOutput.ownsThermoBuffer === true
      },
      {
        stage: 'thermal-phase',
        buffer: thermalOutput.thermoBuffer,
        ownedByClosure: thermalOutput.ownsThermoBuffer === true
      },
      {
        stage: 'source-thermo-input',
        buffer: sourceThermoBuffer,
        ownedByClosure: false
      }
    ]),
    mechanics: select([
      {
        stage: 'mechanics-constitutive-refresh',
        buffer: mechanicsRefreshOutput.mechanicsBuffer,
        ownedByClosure: mechanicsRefreshOutput.ownsMechanicsBuffer === true
      },
      {
        stage: 'phase-carrier-transfer-v2',
        buffer: phaseCarrierOutput.mechanicsBuffer,
        ownedByClosure: componentOwnershipValue(
          phaseSource,
          'mechanics',
          phaseCarrierOutput.mechanicsBuffer
        )
      },
      {
        stage: 'reaction-product',
        buffer: reactionComponentMutations.mechanics
          ? reactionOutput.mechanicsBuffer
          : null,
        ownedByClosure: reactionOutput.ownsMechanicsBuffer === true
      },
      {
        stage: 'post-mechanics-input',
        buffer: g2pOutput.mechanicsBuffer,
        ownedByClosure: false
      }
    ])
  };
  const stateBuffer = selected.state.buffer;
  const thermoBuffer = selected.thermo.buffer;
  const mechanicsBuffer = selected.mechanics.buffer;
  const emittedResidentProductMass = reactionOutput.residentProductMass || null;
  const productMassMergeRequired = Boolean(
    inputResidentProductMass
    && emittedResidentProductMass
    && !sameResidentProductMass(
      inputResidentProductMass,
      emittedResidentProductMass
    )
  );
  const residentProductMass = productMassMergeRequired
    ? null
    : (emittedResidentProductMass || inputResidentProductMass || null);
  return Object.freeze({
    status: stateBuffer && thermoBuffer && mechanicsBuffer
      ? 'post-mechanics-continuation-ready'
      : 'post-mechanics-continuation-incomplete',
    ready: Boolean(stateBuffer && thermoBuffer && mechanicsBuffer),
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer,
    phaseCarrierPlan,
    phaseCarrierPlanStatus: phaseCarrierPlan?.status ?? null,
    phaseCarrierTransferApplied: Boolean(
      phaseCarrierOutput.stateBuffer
      && phaseCarrierOutput.thermoBuffer
      && phaseCarrierOutput.mechanicsBuffer
    ),
    reactionMutatesParticles: reactionComponentMutations.any,
    reactionComponentMutations,
    componentSources: Object.freeze(Object.fromEntries(
      POST_MECHANICS_COMPONENTS.map((component) => [
        component,
        selected[component].stage
      ])
    )),
    componentOwnership: Object.freeze(Object.fromEntries(
      POST_MECHANICS_COMPONENTS.map((component) => [
        component,
        selected[component].ownedByClosure
          ? 'closure-owned-transfer'
          : 'borrowed-input'
      ])
    )),
    componentLineage: Object.freeze(Object.fromEntries(
      POST_MECHANICS_COMPONENTS.map((component) => [
        component,
        Object.freeze({ ...selected[component] })
      ])
    )),
    inputResidentProductMass,
    emittedResidentProductMass,
    residentProductMass,
    productMassMergeRequired,
    productMassStatus: productMassMergeRequired
      ? 'resident-product-mass-merge-required'
      : (residentProductMass
          ? 'resident-product-mass-ready-without-merge'
          : 'resident-product-mass-not-present'),
    generation: retainedGenerationMetadata({
      sphParticleUpload,
      mlsMpmParticleUpload,
      schroederSpatialEpochGeneration
    })
  });
}

function postMechanicsClosureError(message, code, ErrorType = Error) {
  const error = new ErrorType(message);
  error.code = code;
  return error;
}

function assertExactPostMechanicsSourceFamily({
  schroederSpatialEpochTransaction,
  schroederSpatialEpochGeneration,
  sphParticleUpload,
  mlsMpmParticleUpload,
  expectedEpochIdentity
}) {
  if (schroederSpatialEpochTransaction != null && (
    !validateSchroederSpatialEpochTransactionSourceFamily(
      schroederSpatialEpochTransaction,
      {
        generation: schroederSpatialEpochGeneration,
        sphParticleUpload,
        mlsMpmParticleUpload
      }
    )
  )) {
    throw postMechanicsClosureError(
      'Post-mechanics sidecars do not bind the exact transaction-owned terminal state family',
      'ERR_MLS_MPM_POST_MECHANICS_EPOCH_MISMATCH'
    );
  }
  const generationIdentity = schroederSpatialEpochGeneration?.execution || null;
  const expected = expectedEpochIdentity || (
    schroederSpatialEpochTransaction?.epochIdentity ?? null
  );
  if (expected) {
    for (const field of [
      'storageGeneration',
      'physicsTick',
      'physicsSubstep',
      'positionEpoch',
      'topologyEpoch',
      'chartEpoch',
      'levelEpoch',
      'supportEpoch'
    ]) {
      const expectedValue = expected[field];
      if (
        !Number.isInteger(expectedValue)
        || generationIdentity?.[field] !== expectedValue
        || sphParticleUpload?.[field] !== expectedValue
        || (field === 'storageGeneration'
          && mlsMpmParticleUpload?.[field] !== expectedValue)
      ) {
        throw postMechanicsClosureError(
          `Post-mechanics terminal source ${field} does not match its public spatial epoch`,
          'ERR_MLS_MPM_POST_MECHANICS_EPOCH_MISMATCH'
        );
      }
    }
  }
  const generationSource = schroederSpatialEpochGeneration?.source || null;
  const aggregateView = schroederSpatialEpochGeneration?.aggregateView || null;
  if (schroederSpatialEpochGeneration && (
    (generationSource?.sourceStateBuffer
      && generationSource.sourceStateBuffer !== sphParticleUpload?.stateBuffer)
    || (aggregateView && (
      aggregateView.sourceStateBuffer !== sphParticleUpload?.stateBuffer
      || aggregateView.sourceThermoBuffer !== sphParticleUpload?.thermoBuffer
      || aggregateView.sourceIdentityBuffer
        !== (sphParticleUpload?.identityBuffer ?? null)
    ))
  )) {
    throw postMechanicsClosureError(
      'Post-mechanics terminal buffers do not match the selected public spatial generation',
      'ERR_MLS_MPM_POST_MECHANICS_EPOCH_MISMATCH'
    );
  }
  return true;
}

function ownedPostMechanicsStageEntries({
  schroederFarForceDeltaFusion,
  thermalStep,
  reactionStep,
  mechanicsRefreshStep,
  phaseCarrierTransferStep,
  preservedBuffers
}) {
  const far = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermal = retainedThermalOutputBuffers(thermalStep);
  const reaction = retainedReactionOutputBuffers(reactionStep);
  const mechanics = retainedMechanicsRefreshOutputBuffers(
    mechanicsRefreshStep
  );
  const phase = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const phaseSource = retainedStageSource(phaseCarrierTransferStep);
  const entries = [
    ['schroeder-far-force-delta-fusion', 'state', far.stateBuffer,
      far.ownsStateBuffer],
    ['thermal-phase', 'state', thermal.stateBuffer, thermal.ownsStateBuffer],
    ['thermal-phase', 'thermo', thermal.thermoBuffer,
      thermal.ownsThermoBuffer],
    ['reaction-product', 'state', reaction.stateBuffer,
      reaction.ownsStateBuffer],
    ['reaction-product', 'thermo', reaction.thermoBuffer,
      reaction.ownsThermoBuffer],
    ['reaction-product', 'mechanics', reaction.mechanicsBuffer,
      reaction.ownsMechanicsBuffer],
    ['mechanics-constitutive-refresh', 'mechanics',
      mechanics.mechanicsBuffer, mechanics.ownsMechanicsBuffer],
    ['phase-carrier-transfer-v2', 'state', phase.stateBuffer,
      componentOwnershipValue(phaseSource, 'state', phase.stateBuffer)],
    ['phase-carrier-transfer-v2', 'thermo', phase.thermoBuffer,
      componentOwnershipValue(phaseSource, 'thermo', phase.thermoBuffer)],
    ['phase-carrier-transfer-v2', 'mechanics', phase.mechanicsBuffer,
      componentOwnershipValue(
        phaseSource,
        'mechanics',
        phase.mechanicsBuffer
      )]
  ];
  return entries
    .filter(([, , buffer, owned]) => (
      buffer
      && owned === true
      && !preservedBuffers.has(buffer)
    ))
    .map(([stage, component, buffer]) => Object.freeze({
      stage,
      component,
      buffer
    }));
}

function registerPostMechanicsClosureAuthority(closure, {
  device,
  postMechanicsParticleBuffers,
  sphParticleUpload,
  mlsMpmParticleUpload
}) {
  const preservedBuffers = new Set([
    postMechanicsParticleBuffers?.stateBuffer,
    postMechanicsParticleBuffers?.mechanicsBuffer,
    sphParticleUpload?.stateBuffer,
    sphParticleUpload?.thermoBuffer,
    sphParticleUpload?.identityBuffer,
    mlsMpmParticleUpload?.mechanicsBuffer
  ].filter(Boolean));
  const entries = ownedPostMechanicsStageEntries({
    schroederFarForceDeltaFusion:
      closure.schroederFarForceDeltaFusion,
    thermalStep: closure.thermalStep,
    reactionStep: closure.reactionStep,
    mechanicsRefreshStep: closure.mechanicsRefreshStep,
    phaseCarrierTransferStep: closure.phaseCarrierTransferStep,
    preservedBuffers
  });
  const ownedBuffers = new Map();
  for (const entry of entries) {
    if (!ownedBuffers.has(entry.buffer)) ownedBuffers.set(entry.buffer, []);
    ownedBuffers.get(entry.buffer).push(entry);
  }
  const ownedFamilies = postMechanicsOwnedOutputFamilies({
    schroederFarForceDeltaFusion:
      closure.schroederFarForceDeltaFusion,
    thermalStep: closure.thermalStep,
    reactionStep: closure.reactionStep,
    mechanicsRefreshStep: closure.mechanicsRefreshStep,
    phaseCarrierTransferStep: closure.phaseCarrierTransferStep,
    preservedBuffers
  });
  const authority = {
    device,
    closure,
    ownedBuffers,
    ownedFamilies,
    destroyedBuffers: new Set(),
    releasedFamilies: new Set(),
    retiredFamilyBuffers: new Map(),
    claimReceipt: null,
    retirementMode: null,
    retirementPromise: null,
    retirementReceipt: null,
    retirementFailureReason: null
  };
  POST_MECHANICS_CLOSURE_AUTHORITIES.set(closure, authority);
  return authority;
}

function closureAuthorityFor(closure) {
  const authority = POST_MECHANICS_CLOSURE_AUTHORITIES.get(closure);
  if (!authority) {
    throw postMechanicsClosureError(
      'Unknown or structurally copied post-mechanics closure',
      'ERR_MLS_MPM_POST_MECHANICS_FOREIGN_CLOSURE'
    );
  }
  return authority;
}

function continuationBuffersFromClaimInput({
  nextParticleUploads,
  stateBuffer,
  thermoBuffer,
  mechanicsBuffer
}) {
  return {
    stateBuffer: nextParticleUploads?.sphParticleUpload?.stateBuffer
      ?? stateBuffer
      ?? null,
    thermoBuffer: nextParticleUploads?.sphParticleUpload?.thermoBuffer
      ?? thermoBuffer
      ?? null,
    mechanicsBuffer:
      nextParticleUploads?.mlsMpmParticleUpload?.mechanicsBuffer
      ?? mechanicsBuffer
      ?? null
  };
}

/**
 * Positively transfer the selected component family to one continuation.
 * Replaying the exact same claim is idempotent; a copied or different family
 * is rejected.
 */
export function claimMlsMpmPostMechanicsContinuation(
  closure,
  {
    nextParticleUploads = null,
    stateBuffer = null,
    thermoBuffer = null,
    mechanicsBuffer = null
  } = {}
) {
  const authority = closureAuthorityFor(closure);
  const continuation = closure.continuation;
  const claimed = continuationBuffersFromClaimInput({
    nextParticleUploads,
    stateBuffer,
    thermoBuffer,
    mechanicsBuffer
  });
  const exact = continuation?.ready === true
    && claimed.stateBuffer === continuation.stateBuffer
    && claimed.thermoBuffer === continuation.thermoBuffer
    && claimed.mechanicsBuffer === continuation.mechanicsBuffer;
  if (!exact) {
    throw postMechanicsClosureError(
      'Post-mechanics continuation claim does not match the selected component family',
      'ERR_MLS_MPM_POST_MECHANICS_CLAIM_MISMATCH'
    );
  }
  if (authority.claimReceipt) return authority.claimReceipt;
  const components = Object.freeze(Object.fromEntries(
    POST_MECHANICS_COMPONENTS.map((component) => {
      const buffer = claimed[`${component}Buffer`];
      const closureOwned = authority.ownedBuffers.has(buffer);
      return [component, Object.freeze({
        buffer,
        source: continuation.componentSources[component],
        closureOwned,
        ownership: closureOwned
          ? 'transferred-from-closure'
          : 'retained-by-existing-owner'
      })];
    })
  ));
  authority.claimReceipt = Object.freeze({
    schema: 'peercompute.ulg.mls-mpm-post-mechanics-continuation-claim.v1',
    status: 'post-mechanics-continuation-claimed',
    closure,
    continuation,
    nextParticleUploads,
    stateBuffer: claimed.stateBuffer,
    thermoBuffer: claimed.thermoBuffer,
    mechanicsBuffer: claimed.mechanicsBuffer,
    components,
    transferredOwnedComponentCount: POST_MECHANICS_COMPONENTS.filter(
      (component) => components[component].closureOwned
    ).length
  });
  return authority.claimReceipt;
}

export function validateMlsMpmPostMechanicsContinuationClaim(
  closure,
  claimReceipt,
  options = {}
) {
  try {
    const authority = closureAuthorityFor(closure);
    if (authority.claimReceipt !== claimReceipt) return false;
    const claimed = continuationBuffersFromClaimInput(options);
    return claimReceipt?.closure === closure
      && claimReceipt?.continuation === closure.continuation
      && claimReceipt?.stateBuffer === claimed.stateBuffer
      && claimReceipt?.thermoBuffer === claimed.thermoBuffer
      && claimReceipt?.mechanicsBuffer === claimed.mechanicsBuffer;
  } catch {
    return false;
  }
}

/**
 * Retire only closure-owned buffers that were not adopted by the positive
 * continuation claim. The exact same retirement call is replay-safe.
 */
export function retireMlsMpmPostMechanicsClosureOutputsAfter(
  closure,
  {
    after,
    abandon = false
  } = {}
) {
  const authority = closureAuthorityFor(closure);
  const requestedAbandon = abandon === true;
  if (
    authority.retirementMode
    && authority.retirementMode.abandon !== requestedAbandon
  ) {
    throw postMechanicsClosureError(
      'Post-mechanics output retirement cannot change abandon/preserve mode across retries',
      'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_MODE'
    );
  }
  if (authority.retirementReceipt) return Promise.resolve(
    authority.retirementReceipt
  );
  if (authority.retirementPromise) return authority.retirementPromise;
  if (!after || typeof after.then !== 'function') {
    throw postMechanicsClosureError(
      'Post-mechanics output retirement requires an exact owner fence',
      'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_FENCE',
      TypeError
    );
  }
  if (!authority.claimReceipt && !requestedAbandon) {
    throw postMechanicsClosureError(
      'Post-mechanics output retirement requires a positive continuation claim or explicit abandonment',
      'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_AUTHORITY'
    );
  }
  if (!authority.retirementMode) {
    authority.retirementMode = Object.freeze({
      abandon: requestedAbandon,
      preserved: Object.freeze(requestedAbandon
        ? []
        : [
            authority.claimReceipt.stateBuffer,
            authority.claimReceipt.thermoBuffer,
            authority.claimReceipt.mechanicsBuffer
          ].filter(Boolean))
    });
  }
  const retirementMode = authority.retirementMode;
  const preserved = new Set(retirementMode.preserved);
  authority.retirementFailureReason = null;
  const attempt = Promise.resolve(after).then(async (confirmed) => {
    if (confirmed !== true) {
      throw postMechanicsClosureError(
        'Post-mechanics output owner fence was not confirmed',
        'ERR_MLS_MPM_POST_MECHANICS_RETIREMENT_FENCE'
      );
    }
    const failures = [];
    const familyManagedBuffers = new Set();
    const familyPreservedBuffers = new Set();
    for (const family of authority.ownedFamilies) {
      for (const buffer of family.managedBuffers) {
        familyManagedBuffers.add(buffer);
      }
      if (authority.releasedFamilies.has(family)) continue;
      let retiredFamilyBuffers = authority.retiredFamilyBuffers.get(family);
      if (!retiredFamilyBuffers) {
        retiredFamilyBuffers = new Set();
        authority.retiredFamilyBuffers.set(family, retiredFamilyBuffers);
      }
      const pendingManagedComponents = family.managedComponents.filter(
        ({ buffer }) => !retiredFamilyBuffers.has(buffer)
      );
      const preservedManagedComponents = pendingManagedComponents.filter(
        ({ buffer }) => preserved.has(buffer)
      );
      const preservesResidentProductMass = Boolean(
        retirementMode.abandon !== true
        && family.residentProductMass
        && sameResidentProductMass(
          family.residentProductMass,
          closure.continuation?.residentProductMass
        )
      );
      if (preservesResidentProductMass) {
        for (const { buffer } of pendingManagedComponents) {
          familyPreservedBuffers.add(buffer);
        }
        continue;
      }
      const requiresComponentRetirement =
        family.externallyPreservedBuffers.length > 0
        || preservedManagedComponents.length > 0;
      if (requiresComponentRetirement) {
        for (const buffer of family.externallyPreservedBuffers) {
          familyPreservedBuffers.add(buffer);
        }
        for (const { buffer } of preservedManagedComponents) {
          familyPreservedBuffers.add(buffer);
        }
        const retirableComponents = pendingManagedComponents.filter(
          ({ buffer }) => !preserved.has(buffer)
        );
        if (retirableComponents.length === 0) continue;
        if (
          typeof family.destroyOutputParticleBufferComponents !== 'function'
        ) {
          failures.push(postMechanicsClosureError(
            `Post-mechanics ${family.stage} owner cannot retire unpreserved siblings beside a preserved alias`,
            'ERR_MLS_MPM_POST_MECHANICS_COMPONENT_RETIREMENT'
          ));
          continue;
        }
        try {
          const selection = Object.fromEntries(
            retirableComponents.map(({ component }) => [component, true])
          );
          const released = await Promise.resolve(
            family.destroyOutputParticleBufferComponents.call(
              family.output,
              selection
            )
          );
          if (released !== true) {
            throw postMechanicsClosureError(
              `Post-mechanics ${family.stage} owner refused component retirement`,
              'ERR_MLS_MPM_POST_MECHANICS_COMPONENT_RETIREMENT'
            );
          }
          for (const { buffer } of retirableComponents) {
            retiredFamilyBuffers.add(buffer);
            authority.destroyedBuffers.add(buffer);
          }
        } catch (error) {
          failures.push(error);
        }
        continue;
      }
      try {
        const released = await Promise.resolve(
          family.destroyOutputParticleBuffers.call(family.output)
        );
        if (released === false) {
          throw postMechanicsClosureError(
            `Post-mechanics ${family.stage} owner refused family retirement`,
            'ERR_MLS_MPM_POST_MECHANICS_FAMILY_RETIREMENT'
          );
        }
        for (const buffer of family.managedBuffers) {
          authority.destroyedBuffers.add(buffer);
          retiredFamilyBuffers.add(buffer);
        }
        authority.releasedFamilies.add(family);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const buffer of authority.ownedBuffers.keys()) {
      if (
        preserved.has(buffer)
        || familyManagedBuffers.has(buffer)
        || authority.destroyedBuffers.has(buffer)
      ) {
        continue;
      }
      try {
        buffer.destroy?.();
        authority.destroyedBuffers.add(buffer);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw failures.length === 1
        ? failures[0]
        : new AggregateError(
          failures,
          'Post-mechanics component retirement was incomplete'
        );
    }
    authority.retirementReceipt = Object.freeze({
      schema: 'peercompute.ulg.mls-mpm-post-mechanics-retirement.v1',
      status: retirementMode.abandon === true
        ? 'post-mechanics-closure-abandoned'
        : 'post-mechanics-superseded-components-retired',
      closure,
      claimReceipt: authority.claimReceipt,
      abandoned: retirementMode.abandon === true,
      destroyedBufferCount: authority.destroyedBuffers.size,
      preservedBufferCount: new Set([
        ...preserved,
        ...familyPreservedBuffers
      ]).size,
      ownerFamilyCount: authority.ownedFamilies.length,
      preservedOwnerFamilyBufferCount: familyPreservedBuffers.size
    });
    return authority.retirementReceipt;
  }).then(
    (receipt) => {
      authority.retirementPromise = null;
      return receipt;
    },
    (error) => {
      authority.retirementFailureReason = error instanceof Error
        ? error.message
        : String(error);
      authority.retirementPromise = null;
      throw error;
    }
  );
  authority.retirementPromise = attempt;
  return attempt;
}

/**
 * Run the shared retained-buffer closure after any mechanics implementation.
 * The caller owns canonical spatial proposal lifecycle and supplies stage
 * hooks so proposal release/accounting remains ordered between thermal and
 * reaction exactly as it is in the resident step.
 */
export async function runMlsMpmPostMechanicsClosureWebGpu({
  device,
  sphParticleState,
  mlsMpmParticleState,
  sphParticleUpload,
  mlsMpmParticleUpload,
  postMechanicsParticleBuffers,
  postMechanicsBackend = 'webgpu',
  schroederFarAggregateForceApplication = null,
  schroederFarForceDeltaFusionRunner = null,
  thermalMaterialTable = null,
  thermalStepRunner = runSphThermalStepWebGpu,
  thermalStepOptions = {},
  reactionTable = null,
  reactionStepRunner = runSphReactionStepWebGpu,
  reactionStepOptions = {},
  reactionParticleBinMetadataReadback = false,
  mechanicsMaterialTable = null,
  mechanicsRefreshRunner = runMlsMpmMechanicsRefreshWithOptionalWebGpu,
  mechanicsRefreshOptions = {},
  phaseCarrierTransferRunner = runSphPhaseCarrierTransferWebGpu,
  phaseCarrierTransferOptions = {},
  boxDimsM,
  dtSeconds,
  preferWebGpu = true,
  readbackMode,
  thermalResponseGraphUpload = null,
  schroederSpatialEpochGeneration = null,
  schroederSpatialEpochTransaction = null,
  expectedEpochIdentity = null,
  schroederSpatialThermalProposal = null,
  schroederSpatialReactionDiscoveryProposal = null,
  spatialReactionDiscoveryProposalRunner = null,
  schroederLawQueue = null,
  schroederLawNeighborCandidates = null,
  reactionLawInputsQuarantined = false,
  inputResidentProductMass = null,
  residentProductMassMergeRunner = null,
  gpuTimestampRecorder = null,
  timedStage = async (_stage, runStage) => runStage(),
  afterThermalStep = null,
  afterReactionDiscoveryProposal = null,
  beforeReactionStep = null,
  afterReactionStep = null
} = {}) {
  if (!postMechanicsParticleBuffers || typeof postMechanicsParticleBuffers !== 'object') {
    throw new TypeError(
      'Post-mechanics closure requires retained post-mechanics particle buffers'
    );
  }
  if (
    schroederSpatialEpochTransaction != null
    || expectedEpochIdentity != null
  ) {
    assertExactPostMechanicsSourceFamily({
      schroederSpatialEpochTransaction,
      schroederSpatialEpochGeneration,
      sphParticleUpload,
      mlsMpmParticleUpload,
      expectedEpochIdentity
    });
  }
  if (schroederSpatialReactionDiscoveryProposal != null) {
    throw new TypeError(
      'Post-mechanics closure rejects prebuilt reaction discovery; canonical discovery must be issued after the thermal stage'
    );
  }
  const stageEligible = postMechanicsBackend === 'webgpu'
    && sphParticleUpload?.status === 'webgpu-uploaded';
  const executedStageOrder = [];
  let schroederFarForceDeltaFusion = null;
  let thermalStep = null;
  let resolvedSchroederSpatialReactionDiscoveryProposal = null;
  let reactionStep = null;
  let mechanicsRefreshStep = null;
  let phaseCarrierTransferStep = null;
  const postSeparationThermalBinAuthority =
    postMechanicsParticleBuffers.postSeparationThermalBinAuthority ?? null;
  let postSeparationThermalBinReleaseScheduled = false;
  const releasePostSeparationThermalBins = () => {
    if (
      !postSeparationThermalBinAuthority
      || postSeparationThermalBinReleaseScheduled
    ) return false;
    postSeparationThermalBinReleaseScheduled =
      releasePostSeparationThermalBinAuthorityAfterQueue(
        postSeparationThermalBinAuthority,
        { device }
      ) === true;
    return postSeparationThermalBinReleaseScheduled;
  };
  try {
  if (
    schroederFarAggregateForceApplication
    && typeof schroederFarForceDeltaFusionRunner === 'function'
    && stageEligible
    && postMechanicsParticleBuffers.stateBuffer
  ) {
    schroederFarForceDeltaFusion = await timedStage(
      'schroederFarForceDeltaFusion',
      () => schroederFarForceDeltaFusionRunner({
        device,
        sphParticleState,
        sourceStateBuffer: postMechanicsParticleBuffers.stateBuffer,
        schroederFarAggregateForceApplication,
        retainOutputParticleBuffers: true,
        readbackMode
      })
    );
    executedStageOrder.push('schroeder-far-force-delta-fusion');
  }

  const farForceOutput = retainedSchroederFarForceDeltaFusionOutputBuffers(
    schroederFarForceDeltaFusion
  );
  const thermalSourceStateBuffer = farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  if (
    thermalMaterialTable
    && typeof thermalStepRunner === 'function'
    && stageEligible
    && thermalSourceStateBuffer
  ) {
    thermalStep = await timedStage('thermalStep', () => thermalStepRunner({
      ...thermalStepOptions,
      device,
      sphParticleState,
      thermalMaterialTable,
      sphParticleUpload,
      proposalStateBuffer: thermalSourceStateBuffer,
      proposalThermoBuffer: sphParticleUpload?.thermoBuffer,
      sourceStateBuffer: thermalSourceStateBuffer,
      sourceThermoBuffer: sphParticleUpload?.thermoBuffer,
      boxDimsM,
      dtS: dtSeconds,
      retainOutputParticleBuffers: true,
      readbackMode,
      neighborBins: farForceOutput.stateBuffer
        ? null
        : postSeparationThermalBinAuthority,
      thermalResponseGraphUpload:
        thermalResponseGraphUpload
        || thermalStepOptions.thermalResponseGraphUpload
        || null,
      schroederSpatialEpochGeneration:
        schroederSpatialThermalProposal
          ? schroederSpatialEpochGeneration
          : null,
      schroederSpatialThermalProposal,
      gpuTimestampRecorder:
        thermalStepOptions.gpuTimestampRecorder || gpuTimestampRecorder
    }));
    executedStageOrder.push('thermal-phase');
  }
  releasePostSeparationThermalBins();
  if (typeof afterThermalStep === 'function') {
    await afterThermalStep({
      thermalStep,
      thermalSourceStateBuffer,
      thermalSourceThermoBuffer: sphParticleUpload?.thermoBuffer ?? null
    });
  }

  const thermalOutput = retainedThermalOutputBuffers(thermalStep);
  const reactionSourceStateBuffer = thermalOutput.stateBuffer
    || farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  const reactionSourceThermoBuffer = thermalOutput.thermoBuffer
    || sphParticleUpload?.thermoBuffer;
  const reactionStageEligible = Boolean(
    reactionTable?.reactionCount > 0
    && thermalMaterialTable
    && stageEligible
    && reactionSourceStateBuffer
    && reactionSourceThermoBuffer
  );
  if (
    reactionStageEligible
    && schroederSpatialEpochGeneration
    && !resolvedSchroederSpatialReactionDiscoveryProposal
    && typeof spatialReactionDiscoveryProposalRunner === 'function'
  ) {
    resolvedSchroederSpatialReactionDiscoveryProposal = await timedStage(
      'spatialReactionDiscoveryProposal',
      () => spatialReactionDiscoveryProposalRunner({
        device,
        generation: schroederSpatialEpochGeneration,
        sphParticleState,
        sphParticleUpload,
        reactionTable,
        sourceStateBuffer: reactionSourceStateBuffer,
        sourceThermoBuffer: reactionSourceThermoBuffer,
        gpuTimestampRecorder
      })
    );
    if (resolvedSchroederSpatialReactionDiscoveryProposal?.ready !== true) {
      throw new Error(
        'Canonical post-thermal reaction discovery did not publish a complete authenticated stage'
      );
    }
    executedStageOrder.push('reaction-discovery');
  }
  if (typeof afterReactionDiscoveryProposal === 'function') {
    await afterReactionDiscoveryProposal({
      spatialReactionDiscoveryProposal:
        resolvedSchroederSpatialReactionDiscoveryProposal,
      thermalStep,
      sourceStateBuffer: reactionSourceStateBuffer,
      sourceThermoBuffer: reactionSourceThermoBuffer
    });
  }

  const reactionStageInputs = typeof beforeReactionStep === 'function'
    ? (await beforeReactionStep({
        thermalStep,
        spatialReactionDiscoveryProposal:
          resolvedSchroederSpatialReactionDiscoveryProposal
      })) || {}
    : {};
  const effectiveSchroederLawQueue = Object.hasOwn(
    reactionStageInputs,
    'schroederLawQueue'
  )
    ? reactionStageInputs.schroederLawQueue
    : schroederLawQueue;
  const effectiveSchroederLawNeighborCandidates = Object.hasOwn(
    reactionStageInputs,
    'schroederLawNeighborCandidates'
  )
    ? reactionStageInputs.schroederLawNeighborCandidates
    : schroederLawNeighborCandidates;
  const effectiveReactionLawInputsQuarantined = Object.hasOwn(
    reactionStageInputs,
    'reactionLawInputsQuarantined'
  )
    ? reactionStageInputs.reactionLawInputsQuarantined === true
    : reactionLawInputsQuarantined;

  if (
    reactionStageEligible
    && typeof reactionStepRunner === 'function'
    && postMechanicsParticleBuffers.mechanicsBuffer
  ) {
    const noFullReactionSummaryDefaults = readbackMode === NO_FULL_READBACK_MODE
      ? {
          readCompactReactionSummary: false,
          // Gas/product state remains resident. Host species summaries are
          // diagnostics and must be requested explicitly (for example only on
          // the final step of a resident sequence), never inferred per tick.
          readReactionGasSpeciesSummary: false,
          readReactionProductInventory: false,
          readReactionAtomResidual: false
        }
      : {};
    reactionStep = await timedStage('reactionStep', () => reactionStepRunner({
      device,
      sphParticleState,
      mlsMpmParticleState,
      reactionTable,
      thermalMaterialTable,
      sphParticleUpload,
      mlsMpmParticleUpload,
      sourceStateBuffer: reactionSourceStateBuffer,
      sourceThermoBuffer: reactionSourceThermoBuffer,
      sourceMechanicsBuffer: postMechanicsParticleBuffers.mechanicsBuffer,
      boxDimsM,
      retainOutputParticleBuffers: true,
      readbackMode,
      dtSeconds,
      schroederLawQueue: effectiveSchroederLawQueue,
      schroederLawNeighborCandidates:
        effectiveSchroederLawNeighborCandidates,
      ...noFullReactionSummaryDefaults,
      ...reactionStepOptions,
      gpuTimestampRecorder:
        reactionStepOptions.gpuTimestampRecorder || gpuTimestampRecorder,
      thermalResponseGraphUpload:
        thermalResponseGraphUpload
        || reactionStepOptions.thermalResponseGraphUpload
        || null,
      schroederSpatialEpochGeneration:
        resolvedSchroederSpatialReactionDiscoveryProposal
          ? schroederSpatialEpochGeneration
          : null,
      schroederSpatialReactionDiscoveryProposal:
        resolvedSchroederSpatialReactionDiscoveryProposal,
      ...(effectiveReactionLawInputsQuarantined ? {
        schroederLawQueue: null,
        schroederLawNeighborCandidates: null
      } : {}),
      reactionParticleBinMetadataReadback:
        reactionParticleBinMetadataReadback === true
        || reactionStepOptions.reactionParticleBinMetadataReadback === true
    }));
    executedStageOrder.push('reaction-product');
  }
  if (typeof afterReactionStep === 'function') {
    await afterReactionStep({
      reactionStep,
      spatialReactionDiscoveryProposal:
        resolvedSchroederSpatialReactionDiscoveryProposal
    });
  }

  const reactionComponentMutations =
    reactionOutputComponentMutations(reactionStep);
  const reactionMutatesParticles = reactionComponentMutations.any;
  const reactionOutput = retainedReactionOutputBuffers(reactionStep);
  const phaseCarrierPlan = sphParticleUpload?.phaseCarrierPlan
    || sphParticleState?.phaseCarrierPlan
    || null;
  const phaseCarrierSourceStateBuffer = (
    reactionComponentMutations.state ? reactionOutput.stateBuffer : null
  ) || thermalOutput.stateBuffer
    || farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  const phaseCarrierSourceThermoBuffer = (
    reactionComponentMutations.thermo ? reactionOutput.thermoBuffer : null
  ) || thermalOutput.thermoBuffer
    || sphParticleUpload?.thermoBuffer;
  const phaseCarrierSourceMechanicsBuffer = (
    reactionComponentMutations.mechanics ? reactionOutput.mechanicsBuffer : null
  ) || postMechanicsParticleBuffers.mechanicsBuffer;
  if (
    phaseCarrierPlanReady(phaseCarrierPlan)
    && thermalStep
    && thermalMaterialTable
    && mechanicsMaterialTable
    && typeof phaseCarrierTransferRunner === 'function'
    && stageEligible
    && phaseCarrierSourceStateBuffer
    && phaseCarrierSourceThermoBuffer
    && phaseCarrierSourceMechanicsBuffer
  ) {
    phaseCarrierTransferStep = await timedStage(
      'phaseCarrierTransfer',
      () => phaseCarrierTransferRunner({
        device,
        sphParticleState,
        mlsMpmParticleState,
        thermalMaterialTable,
        mechanicsMaterialTable,
        phaseCarrierPlan,
        sourceStateBuffer: phaseCarrierSourceStateBuffer,
        sourceThermoBuffer: phaseCarrierSourceThermoBuffer,
        sourceMechanicsBuffer: phaseCarrierSourceMechanicsBuffer,
        retainOutputParticleBuffers: true,
        readbackMode,
        ...phaseCarrierTransferOptions
      })
    );
    executedStageOrder.push('phase-carrier-transfer-v2');
  }

  const phaseCarrierOutput = retainedPhaseCarrierTransferOutputBuffers(
    phaseCarrierTransferStep
  );
  const mechanicsRefreshSourceStateBuffer = phaseCarrierOutput.stateBuffer || (
    reactionComponentMutations.state ? reactionOutput.stateBuffer : null
  ) || thermalOutput.stateBuffer
    || farForceOutput.stateBuffer
    || postMechanicsParticleBuffers.stateBuffer;
  const mechanicsRefreshSourceThermoBuffer = phaseCarrierOutput.thermoBuffer || (
    reactionComponentMutations.thermo ? reactionOutput.thermoBuffer : null
  ) || thermalOutput.thermoBuffer
    || sphParticleUpload?.thermoBuffer;
  const mechanicsRefreshSourceMechanicsBuffer =
    phaseCarrierOutput.mechanicsBuffer
    || (reactionComponentMutations.mechanics
      ? reactionOutput.mechanicsBuffer
      : null)
    || postMechanicsParticleBuffers.mechanicsBuffer;
  if (
    (thermalStep || reactionMutatesParticles)
    && mechanicsMaterialTable
    && typeof mechanicsRefreshRunner === 'function'
    && stageEligible
    && mechanicsRefreshSourceStateBuffer
    && mechanicsRefreshSourceThermoBuffer
    && mechanicsRefreshSourceMechanicsBuffer
  ) {
    mechanicsRefreshStep = await timedStage(
      'mechanicsRefresh',
      () => mechanicsRefreshRunner({
        device,
        sphParticleState,
        mlsMpmParticleState,
        mechanicsMaterialTable,
        sphParticleUpload,
        mlsMpmParticleUpload,
        sourceStateBuffer: mechanicsRefreshSourceStateBuffer,
        sourceThermoBuffer: mechanicsRefreshSourceThermoBuffer,
        sourceMechanicsBuffer: mechanicsRefreshSourceMechanicsBuffer,
        preferWebGpu,
        retainOutputParticleBuffers: true,
        readbackMode,
        ...mechanicsRefreshOptions
      })
    );
    executedStageOrder.push('mechanics-constitutive-refresh');
  }

  let continuation = resolveMlsMpmPostMechanicsContinuation({
    postMechanicsParticleBuffers,
    sourceThermoBuffer: sphParticleUpload?.thermoBuffer || null,
    schroederFarForceDeltaFusion,
    thermalStep,
    schroederSpatialReactionDiscoveryProposal:
      resolvedSchroederSpatialReactionDiscoveryProposal,
    reactionStep,
    mechanicsRefreshStep,
    phaseCarrierTransferStep,
    phaseCarrierPlan,
    inputResidentProductMass,
    sphParticleUpload,
    mlsMpmParticleUpload,
    schroederSpatialEpochGeneration
  });
  if (
    continuation.productMassMergeRequired
    && typeof residentProductMassMergeRunner === 'function'
  ) {
    const mergedResidentProductMass = await residentProductMassMergeRunner({
      device,
      inputResidentProductMass: continuation.inputResidentProductMass,
      emittedResidentProductMass: continuation.emittedResidentProductMass
    });
    continuation = Object.freeze({
      ...continuation,
      residentProductMass: mergedResidentProductMass,
      productMassMergeRequired: !mergedResidentProductMass,
      productMassStatus: mergedResidentProductMass
        ? 'resident-product-mass-merged-gpu-resident'
        : 'resident-product-mass-merge-failed'
    });
  }
  const closure = {
    schema: ULG_MLS_MPM_POST_MECHANICS_CLOSURE_SCHEMA,
    status: continuation.ready && !continuation.productMassMergeRequired
      ? 'post-mechanics-closure-complete'
      : 'post-mechanics-closure-incomplete',
    backend: postMechanicsBackend,
    authoritativeStageOrder: MLS_MPM_POST_MECHANICS_CLOSURE_STAGE_ORDER,
    executedStageOrder: Object.freeze([...executedStageOrder]),
    schroederFarForceDeltaFusion,
    thermalStep,
    reactionStep,
    mechanicsRefreshStep,
    phaseCarrierTransferStep,
    phaseCarrierPlan,
    continuation,
    residentProductMass: continuation.residentProductMass,
    generation: continuation.generation,
    readbackMode,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
  registerPostMechanicsClosureAuthority(closure, {
    device,
    postMechanicsParticleBuffers,
    sphParticleUpload,
    mlsMpmParticleUpload
  });
  return closure;
  } catch (error) {
    releasePostSeparationThermalBins();
    resolvedSchroederSpatialReactionDiscoveryProposal?.destroy?.();
    let resolveFailureCleanup = null;
    const failureCleanupReceipt = {
      schema: 'peercompute.ulg.mls-mpm-post-mechanics-failure-cleanup.v1',
      status: 'post-mechanics-failure-cleanup-pending-owner-fence',
      releasedOwnerFamilyCount: 0,
      releasedComponentCount: 0,
      rawDestroyedBufferCount: 0,
      blockers: []
    };
    const failureCleanupCompletion = new Promise((resolve) => {
      resolveFailureCleanup = resolve;
    });
    Object.defineProperty(failureCleanupReceipt, 'completion', {
      value: failureCleanupCompletion,
      enumerable: false
    });
    if (error && (typeof error === 'object' || typeof error === 'function')) {
      Object.defineProperty(error, 'postMechanicsCleanupReceipt', {
        value: failureCleanupReceipt,
        enumerable: false,
        configurable: true
      });
      Object.defineProperty(error, 'postMechanicsCleanupCompletion', {
        value: failureCleanupCompletion,
        enumerable: false,
        configurable: true
      });
    }
    deferSubmittedWorkCleanup(device, () => {
      const cleanup = destroyFailedPostMechanicsStageOutputs({
        postMechanicsParticleBuffers,
        sphParticleUpload,
        mlsMpmParticleUpload,
        schroederFarForceDeltaFusion,
        thermalStep,
        reactionStep,
        mechanicsRefreshStep,
        phaseCarrierTransferStep,
        inputResidentProductMass
      });
      Object.assign(failureCleanupReceipt, {
        ...cleanup,
        blockers: [...(cleanup.blockers || [])]
      });
      Promise.resolve(cleanup.completion).then((settled) => {
        Object.assign(failureCleanupReceipt, {
          ...settled,
          blockers: [...(settled.blockers || [])]
        });
        resolveFailureCleanup(failureCleanupReceipt);
      });
    });
    throw error;
  }
}
