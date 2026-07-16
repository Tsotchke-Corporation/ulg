import {
  particleColors,
  particleRenderDescriptors,
  gasPressureSummary,
  phaseMassSummary,
  surfaceEmissive,
  surfaceEmissiveTemperature
} from './sphPhaseDemo.js';
import { sphTotals } from './sph/sphConservation.js';
import {
  buildMlsMpmGpuParticleBuffers,
  buildSphGpuParticleBuffers
} from './sph/sphGpuBuffers.js';

export const ULG_SPH_PHASE_VIEW_STATE_SCHEMA = 'peercompute.ulg.sph-phase-view-state.v0';

export function createSphPhaseViewState(driver) {
  if (!driver?.demo?.state?.particles) {
    throw new TypeError('createSphPhaseViewState requires an SPH phase demo driver');
  }
  const demo = driver.demo;
  const colors = particleColors(demo);
  const pressureSummary = gasPressureSummary(demo);
  const renderDescriptors = particleRenderDescriptors(demo, { gasPressure: pressureSummary });
  const sphGpuParticleState = buildSphGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties,
    initialParticleSpacing: demo.initialParticleSpacing
  });
  const mlsMpmGpuParticleState = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties,
    initialParticleSpacing: demo.initialParticleSpacing
  });
  const n = demo.state.particles.length;
  const positionsM = new Float32Array(n * 3);
  const colorsRgb = new Float32Array(n * 3);
  const particleRadiiM = new Float32Array(n);
  const materials = new Array(n);
  const baseCount = Math.max(0, Math.round(Number(demo.counts?.base) || 0));
  const dropCount = Math.max(0, Math.round(Number(demo.counts?.drop) || 0));
  demo.state.particles.forEach((p, i) => {
    const explicitRenderDomainId = Math.max(
      0,
      Math.round(Number(p.renderDomainId ?? p.initialBodyDomainId) || 0)
    );
    const renderDomainId = explicitRenderDomainId > 0
      ? explicitRenderDomainId
      : (baseCount > 0 && i < baseCount
          ? 1
          : (dropCount > 0 && i >= baseCount && i < baseCount + dropCount ? 2 : 0));
    const renderDomainKey = p.initialBodyId
      ?? (renderDomainId === 1 ? 'base' : (renderDomainId === 2 ? 'drop' : null));
    positionsM[i * 3] = p.x[0];
    positionsM[i * 3 + 1] = p.x[1];
    positionsM[i * 3 + 2] = p.x[2];
    colorsRgb[i * 3] = colors[i].rgb[0];
    colorsRgb[i * 3 + 1] = colors[i].rgb[1];
    colorsRgb[i * 3 + 2] = colors[i].rgb[2];
    const particleRadiusM = Number(
      p.currentParticleRadiusM
        ?? p.particleRadiusM
        ?? p.restParticleRadiusM
        ?? 0
    );
    particleRadiiM[i] = Number.isFinite(particleRadiusM) && particleRadiusM > 0
      ? particleRadiusM
      : 0;
    materials[i] = {
      ...renderDescriptors[i],
      particleMassKg: Number.isFinite(Number(p.massKg)) ? Number(p.massKg) : null,
      spareProductSlot: p.spareProductSlot === true,
      phaseCompanionSlot: p.phaseCompanionSlot === true,
      phaseCarrierLineageIndex: Number.isSafeInteger(p.phaseCarrierLineageIndex)
        ? p.phaseCarrierLineageIndex
        : null,
      phaseCarrierLane: Number.isSafeInteger(p.phaseCarrierLane)
        ? p.phaseCarrierLane
        : null,
      phaseCarrierTargetPhaseId: Number.isSafeInteger(p.phaseCarrierTargetPhaseId)
        ? p.phaseCarrierTargetPhaseId
        : null,
      particleRadiusM: particleRadiiM[i],
      currentParticleRadiusM: Number.isFinite(Number(p.currentParticleRadiusM))
        ? Number(p.currentParticleRadiusM)
        : null,
      restParticleRadiusM: Number.isFinite(Number(p.restParticleRadiusM))
        ? Number(p.restParticleRadiusM)
        : null,
      initialParticleSpacingM: Number.isFinite(Number(p.initialParticleSpacingM))
        ? Number(p.initialParticleSpacingM)
        : null,
      initialBodyId: p.initialBodyId ?? null,
      initialBodyDomainId: Math.max(0, Math.round(Number(p.initialBodyDomainId) || 0)),
      renderDomainId,
      renderDomainKey
    };
  });
  return {
    schema: ULG_SPH_PHASE_VIEW_STATE_SCHEMA,
    status: 'sph-phase-view-state-built',
    step: demo.state.step ?? 0,
    time: demo.state.time ?? 0,
    positionsM,
    colorsRgb,
    particleRadiiM,
    materials,
    emissiveByMaterial: surfaceEmissive(demo),
    emissiveTemperatureByMaterial: surfaceEmissiveTemperature(demo),
    materialProperties: demo.materialProperties,
    reactions: demo.reactions || [],
    reactionDiscovery: demo.reactionDiscovery || null,
    reactionContactRadiusM: demo.reactionContactRadiusM,
    sphGpuParticleState,
    mlsMpmGpuParticleState,
    totals: sphTotals(demo.state),
    phaseMassSummary: phaseMassSummary(demo),
    gasPressureSummary: pressureSummary,
    gasPressureFeedback: pressureSummary.pressureFeedback || null,
    counts: { ...demo.counts },
    initialParticleSpacing: demo.initialParticleSpacing
      ? {
          ...demo.initialParticleSpacing,
          ...(demo.initialParticleSpacing.drop
            ? { drop: { ...demo.initialParticleSpacing.drop } }
            : {}),
          ...(demo.initialParticleSpacing.base
            ? { base: { ...demo.initialParticleSpacing.base } }
            : {}),
          ...(Array.isArray(demo.initialParticleSpacing.bodies)
            ? { bodies: demo.initialParticleSpacing.bodies.map((body) => ({ ...body })) }
            : {}),
          ...(demo.initialParticleSpacing.byBodyId
            ? {
                byBodyId: Object.fromEntries(
                  Object.entries(demo.initialParticleSpacing.byBodyId)
                    .map(([bodyId, body]) => [bodyId, { ...body }])
                )
              }
            : {})
        }
      : null,
    initialParticleEdgeDiagnostics: demo.initialParticleEdgeDiagnostics
      ? {
          ...demo.initialParticleEdgeDiagnostics,
          ...(demo.initialParticleEdgeDiagnostics.drop
            ? { drop: { ...demo.initialParticleEdgeDiagnostics.drop } }
            : {}),
          ...(demo.initialParticleEdgeDiagnostics.base
            ? { base: { ...demo.initialParticleEdgeDiagnostics.base } }
            : {}),
          ...(Array.isArray(demo.initialParticleEdgeDiagnostics.bodies)
            ? { bodies: demo.initialParticleEdgeDiagnostics.bodies.map((body) => ({ ...body })) }
            : {}),
          rejectedPreservedCandidates: (demo.initialParticleEdgeDiagnostics.rejectedPreservedCandidates || [])
            .map((candidate) => ({ ...candidate }))
        }
      : null,
    scenario: {
      walls: {
        model: demo.scenario?.walls?.model ?? null,
        faces: { ...(demo.scenario?.walls?.faces || {}) }
      }
    },
    wallTemperaturesK: { ...(demo.scenario?.walls?.faces || {}) },
    box: {
      edgeM: demo.box.edgeM,
      dimensionsM: [...demo.box.dimensionsM]
    },
    physicalLawGroups: { ...(demo.physicalLawGroups || demo.state?.physicalLawGroups || {}) },
    pendingPhysicalLawGroups: (demo.pendingPhysicalLawGroups || demo.state?.pendingPhysicalLawGroups || [])
      .map((group) => ({ ...group })),
    gpuMechanics: { ...demo.gpuMechanics },
    initialHydrostaticState: demo.initialHydrostaticState ? { ...demo.initialHydrostaticState } : null,
    initialBodies: demo.initialBodies
      ? {
          schema: demo.initialBodies.schema,
          bodies: demo.initialBodies.bodies.map((body) => ({
            ...body,
            sizeM: [...body.sizeM],
            centerM: [...body.centerM],
            particlesPerEdge: [...body.particlesPerEdge],
            velocityMPerS: [...body.velocityMPerS]
          }))
        }
      : null,
    reactionNote: demo.reactionNote || null,
    dropMaterial: demo.dropMaterial,
    baseMaterial: demo.baseMaterial,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}
