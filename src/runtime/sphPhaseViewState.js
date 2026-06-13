import {
  particleColors,
  particleRenderDescriptors,
  gasPressureSummary,
  phaseMassSummary,
  surfaceEmissive
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
    materialProperties: demo.materialProperties
  });
  const mlsMpmGpuParticleState = buildMlsMpmGpuParticleBuffers(demo.state, {
    materialProperties: demo.materialProperties
  });
  const n = demo.state.particles.length;
  const positionsM = new Float32Array(n * 3);
  const colorsRgb = new Float32Array(n * 3);
  const materials = new Array(n);
  demo.state.particles.forEach((p, i) => {
    positionsM[i * 3] = p.x[0];
    positionsM[i * 3 + 1] = p.x[1];
    positionsM[i * 3 + 2] = p.x[2];
    colorsRgb[i * 3] = colors[i].rgb[0];
    colorsRgb[i * 3 + 1] = colors[i].rgb[1];
    colorsRgb[i * 3 + 2] = colors[i].rgb[2];
    materials[i] = renderDescriptors[i];
  });
  return {
    schema: ULG_SPH_PHASE_VIEW_STATE_SCHEMA,
    status: 'sph-phase-view-state-built',
    step: demo.state.step ?? 0,
    time: demo.state.time ?? 0,
    positionsM,
    colorsRgb,
    materials,
    emissiveByMaterial: surfaceEmissive(demo),
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
    box: {
      edgeM: demo.box.edgeM,
      dimensionsM: [...demo.box.dimensionsM]
    },
    gpuMechanics: { ...demo.gpuMechanics },
    reactionNote: demo.reactionNote || null,
    dropMaterial: demo.dropMaterial,
    baseMaterial: demo.baseMaterial,
    scientificValidation: false,
    sphValidation: false,
    phaseChangeValidation: false,
    fullPhysicsValidation: false
  };
}
