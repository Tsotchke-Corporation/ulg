import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
  ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import { createSphPhaseScenario } from '../src/runtime/thermoPreflight.js';
import { createSphPhaseDemo } from '../src/runtime/sphPhaseDemo.js';
import { createSphPhaseCarrier } from '../src/runtime/sph/sphPhaseCarrier.js';
import {
  destroyMlsMpmResidentStepsBuffers,
  runMlsMpmResidentStepsWithOptionalWebGpu
} from '../src/runtime/sph/sphMlsMpmGpuStep.js';
import {
  MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS,
  SPH_GPU_PARTICLE_STATE_FLOATS,
  SPH_GPU_PARTICLE_THERMO_FLOATS
} from '../src/runtime/sph/sphGpuBuffers.js';

function nearlyEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

function packedSingleParticle({
  position = [2.5, 2.5, 2.5],
  velocity = [0, 0, 0],
  massKg = 8,
  restDensityKgPerM3 = 8,
  smoothingLengthM = 1,
  mechanicsDtS = 0.01
} = {}) {
  const state = new Float32Array(SPH_GPU_PARTICLE_STATE_FLOATS);
  state.set([
    position[0], position[1], position[2], massKg,
    velocity[0], velocity[1], velocity[2], 0
  ]);
  const thermo = new Float32Array(SPH_GPU_PARTICLE_THERMO_FLOATS);
  thermo[3] = restDensityKgPerM3;
  const mechanics = new Float32Array(MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length);
  mechanics.set([1, 0, 0, 0, 1, 0, 0, 0, 1], 0);
  mechanics[18] = 1;
  mechanics[19] = massKg / restDensityKgPerM3;
  mechanics[20] = 0;
  mechanics[21] = 1;
  mechanics[25] = 0;
  mechanics[26] = 0;
  return {
    sphParticleState: {
      schema: ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      smoothingLengthM,
      step: 0,
      time: 0,
      state,
      thermo
    },
    mlsMpmParticleState: {
      schema: ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
      particleCount: 1,
      step: 0,
      time: 0,
      mechanicsDtS,
      gridCflFactor: 100,
      gravityMPerS2: [0, 0, 0],
      mechanics
    }
  };
}

function centerOfMassY(particles, role) {
  let mass = 0;
  let weightedY = 0;
  for (const particle of particles) {
    if (role && particle.role !== role) continue;
    mass += particle.massKg;
    weightedY += particle.massKg * particle.x[1];
  }
  return weightedY / mass;
}

function centerOfMass(particles, role) {
  let mass = 0;
  const weighted = [0, 0, 0];
  for (const particle of particles) {
    if (role && particle.role !== role) continue;
    mass += particle.massKg;
    weighted[0] += particle.massKg * particle.x[0];
    weighted[1] += particle.massKg * particle.x[1];
    weighted[2] += particle.massKg * particle.x[2];
  }
  return weighted.map((value) => value / mass);
}

function particlesForRole(particles, role) {
  return particles.filter((particle) => particle.role === role);
}

function supportRadiusM(particle) {
  const massKg = Number(particle.massKg);
  const restDensityKgPerM3 = Number(particle.restDensityKgPerM3);
  if (!(massKg > 0) || !(restDensityKgPerM3 > 0)) return 0;
  return 0.5 * Math.cbrt(massKg / restDensityKgPerM3);
}

function supportBoundsY(particles) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const particle of particles) {
    const y = Number(particle.x?.[1]);
    if (!Number.isFinite(y)) continue;
    const radius = supportRadiusM(particle);
    min = Math.min(min, y - radius);
    max = Math.max(max, y + radius);
  }
  return { min, max };
}

function supportBounds3D(particles) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const particle of particles) {
    const radius = supportRadiusM(particle);
    for (let axis = 0; axis < 3; axis += 1) {
      const value = Number(particle.x?.[axis]);
      if (!Number.isFinite(value)) continue;
      min[axis] = Math.min(min[axis], value - radius);
      max[axis] = Math.max(max[axis], value + radius);
    }
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}

function liquidFreeSurfaceShapeMetrics(particles, boxDimsM) {
  const bounds = supportBounds3D(particles);
  const horizontalExtentM = Math.max(bounds.size[0], bounds.size[2], 1e-9);
  return {
    bounds,
    tallnessRatio: bounds.size[1] / horizontalExtentM,
    footprintFillRatio: (bounds.size[0] * bounds.size[2])
      / Math.max(Number(boxDimsM?.[0]) * Number(boxDimsM?.[2]), 1e-9)
  };
}

function dropBaseSupportGapY(particles) {
  const drop = supportBoundsY(particlesForRole(particles, 'drop'));
  const base = supportBoundsY(particlesForRole(particles, 'base'));
  return drop.min - base.max;
}

function maxPairDistanceDriftForRole(initialParticles, finalParticles, role) {
  const initial = particlesForRole(initialParticles, role);
  const final = particlesForRole(finalParticles, role);
  assert.equal(final.length, initial.length, `particle count changed for role ${role}`);
  let maxDrift = 0;
  for (let i = 0; i < initial.length; i += 1) {
    for (let j = i + 1; j < initial.length; j += 1) {
      const initialDistance = Math.hypot(
        initial[i].x[0] - initial[j].x[0],
        initial[i].x[1] - initial[j].x[1],
        initial[i].x[2] - initial[j].x[2]
      );
      const finalDistance = Math.hypot(
        final[i].x[0] - final[j].x[0],
        final[i].x[1] - final[j].x[1],
        final[i].x[2] - final[j].x[2]
      );
      maxDrift = Math.max(maxDrift, Math.abs(finalDistance - initialDistance));
    }
  }
  return maxDrift;
}

function maxParticleSpeed(particles) {
  let max = 0;
  for (const particle of particles) {
    const speed = Math.hypot(...particle.v);
    assert.ok(Number.isFinite(speed), `non-finite particle speed: ${speed}`);
    max = Math.max(max, speed);
  }
  return max;
}

function maxParticleSpeedForRole(particles, role) {
  return maxParticleSpeed(role ? particlesForRole(particles, role) : particles);
}

function maxParticleDisplacement(initialParticles, finalParticles) {
  assert.equal(finalParticles.length, initialParticles.length, 'particle count changed');
  let maxDisplacement = 0;
  for (let i = 0; i < initialParticles.length; i += 1) {
    maxDisplacement = Math.max(
      maxDisplacement,
      Math.hypot(
        finalParticles[i].x[0] - initialParticles[i].x[0],
        finalParticles[i].x[1] - initialParticles[i].x[1],
        finalParticles[i].x[2] - initialParticles[i].x[2]
      )
    );
  }
  return maxDisplacement;
}

function assertFiniteParticleState(particles) {
  for (const particle of particles) {
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Number.isFinite(particle.x[axis]), `non-finite position axis ${axis}`);
      assert.ok(Number.isFinite(particle.v[axis]), `non-finite velocity axis ${axis}`);
    }
  }
}

function volumeRatioRange(particles) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const particle of particles) {
    if (particle.mpmJ == null) continue;
    min = Math.min(min, particle.mpmJ);
    max = Math.max(max, particle.mpmJ);
  }
  return {
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null
  };
}

test('resident MLS-MPM zero-force particle stays fixed without volume pulsation', async () => {
  const buffers = packedSingleParticle();
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    stepCount: 32,
    preferWebGpu: false,
    gridSpacingM: 1,
    boxDimsM: [5, 5, 5],
    dt: 0.01,
    gravityMPerS2: [0, 0, 0],
    cflFactor: 100,
    internalPressureScale: 0,
    compactSummaryMode: 'every-step'
  });

  try {
    assert.equal(execution.completedStepCount, 32);
    assert.equal(execution.finalStep.diagnostics.massDeltaKg, 0);
    const finalState = execution.nextSphParticleState.state;
    const finalMechanics = execution.nextMlsMpmParticleState.mechanics;
    nearlyEqual(finalState[0], 2.5, 1e-6);
    nearlyEqual(finalState[1], 2.5, 1e-6);
    nearlyEqual(finalState[2], 2.5, 1e-6);
    nearlyEqual(finalState[4], 0, 1e-7);
    nearlyEqual(finalState[5], 0, 1e-7);
    nearlyEqual(finalState[6], 0, 1e-7);
    nearlyEqual(finalMechanics[18], 1, 1e-6);
    for (const summary of execution.stepSummaries) {
      assert.equal(summary.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0);
      nearlyEqual(summary.diagnostics.massDeltaKg, 0, 1e-9);
      nearlyEqual(summary.diagnostics.maxSpeedMPerS, 0, 1e-7);
    }
  } finally {
    destroyMlsMpmResidentStepsBuffers(execution);
  }
});

test('resident MLS-MPM gravity-only particle follows semi-implicit Euler', async () => {
  const dt = 0.01;
  const stepCount = 24;
  const g = -9.80665;
  const initialY = 3.5;
  const buffers = packedSingleParticle({
    position: [2.5, initialY, 2.5],
    mechanicsDtS: dt
  });
  const execution = await runMlsMpmResidentStepsWithOptionalWebGpu({
    ...buffers,
    stepCount,
    preferWebGpu: false,
    gridSpacingM: 1,
    boxDimsM: [5, 5, 5],
    dt,
    gravityMPerS2: [0, g, 0],
    cflFactor: 100,
    internalPressureScale: 0,
    compactSummaryMode: 'every-step',
    retainIntermediateSteps: true
  });

  try {
    const finalState = execution.nextSphParticleState.state;
    const finalMechanics = execution.nextMlsMpmParticleState.mechanics;
    const expectedVelocityY = stepCount * g * dt;
    const expectedY = initialY + g * dt * dt * stepCount * (stepCount + 1) / 2;
    nearlyEqual(finalState[5], expectedVelocityY, 2e-5);
    nearlyEqual(finalState[1], expectedY, 2e-5);
    nearlyEqual(finalState[3], 8, 1e-6);
    nearlyEqual(finalMechanics[18], 1, 1e-6);
    let previousY = initialY;
    const retainedSteps = [...execution.retainedSteps, execution.finalStep]
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    for (const step of retainedSteps) {
      const y = step.state[1];
      assert.ok(y < previousY, `gravity-only COM should fall monotonically: ${y} !< ${previousY}`);
      previousY = y;
    }
    for (const summary of execution.stepSummaries) {
      assert.equal(summary.pressureInterfaceAppliedImpulseMagnitudeNSeconds, 0);
      nearlyEqual(summary.diagnostics.massDeltaKg, 0, 1e-9);
    }
  } finally {
    destroyMlsMpmResidentStepsBuffers(execution);
  }
});

test('H2O/H2O mechanics+gravity law isolation moves the drop without pressure impulses or J blink', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 2,
    baseParticleEdge: 2,
    mechanics: 'mlsmpm',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: false,
      pressure: false,
      thermal: false,
      reactions: false
    }
  });
  const initialMass = driver.totals().massKg;
  let previousDropY = centerOfMassY(driver.demo.state.particles, 'drop');

  for (let stepIndex = 0; stepIndex < 10; stepIndex += 1) {
    driver.step();
    const dropY = centerOfMassY(driver.demo.state.particles, 'drop');
    assert.ok(dropY <= previousDropY + 1e-9, `drop COM rose during gravity-only step ${stepIndex}`);
    previousDropY = dropY;
    const j = volumeRatioRange(driver.demo.state.particles);
    assert.ok(j.min >= 0.95, `volume ratio dipped below condensed bound: ${j.min}`);
    assert.ok(j.max <= 1.05, `volume ratio exceeded condensed bound: ${j.max}`);
    for (const particle of driver.demo.state.particles) {
      for (let axis = 0; axis < 3; axis += 1) {
        assert.ok(Number.isFinite(particle.x[axis]));
        assert.ok(Number.isFinite(particle.v[axis]));
      }
    }
  }

  const totals = driver.totals();
  nearlyEqual(totals.massKg, initialMass, Math.max(1e-9, initialMass * 1e-8));
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.mechanics, true);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.gravity, true);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.eos, false);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.pressure, false);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.thermal, false);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.reactions, false);
});

test('H2O/H2O EOS-on MLS-MPM contact stays incompressible and closes under gravity', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'mlsmpm',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: false
    }
  });
  const initialMass = driver.totals().massKg;
  const initialDropY = centerOfMassY(driver.demo.state.particles, 'drop');
  const initialGap = dropBaseSupportGapY(driver.demo.state.particles);

  for (let stepIndex = 0; stepIndex < 16; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  const finalDropY = centerOfMassY(particles, 'drop');
  const finalGap = dropBaseSupportGapY(particles);
  const j = volumeRatioRange(particles);
  assertFiniteParticleState(particles);
  nearlyEqual(driver.totals().massKg, initialMass, Math.max(1e-9, initialMass * 1e-8));
  assert.ok(finalDropY < initialDropY - 0.05, `drop did not descend enough: ${initialDropY} -> ${finalDropY}`);
  assert.ok(finalGap < initialGap - 0.005, `same-material support gap did not close: ${initialGap} -> ${finalGap}`);
  assert.ok(j.min >= 0.95, `EOS-on liquid volume compressed too far: ${j.min}`);
  assert.ok(j.max <= 1.05, `EOS-on liquid volume expanded too far: ${j.max}`);
  assert.ok(maxParticleSpeed(particles) < 5, 'EOS-on liquid developed an implausible short-horizon speed spike');
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.eos, true);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.pressure, true);
  assert.equal(driver.demo.lastStepTiming.reactionEvents, 0);
});

test('plain SPH/PBF reference lane remains bounded for same-material liquid contact', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: false
    }
  });
  const initialMass = driver.totals().massKg;
  const initialDropY = centerOfMassY(driver.demo.state.particles, 'drop');
  const initialGap = dropBaseSupportGapY(driver.demo.state.particles);

  for (let stepIndex = 0; stepIndex < 8; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  const finalDropY = centerOfMassY(particles, 'drop');
  const finalGap = dropBaseSupportGapY(particles);
  assertFiniteParticleState(particles);
  nearlyEqual(driver.totals().massKg, initialMass, Math.max(1e-9, initialMass * 1e-8));
  assert.equal(driver.demo.gpuMechanics.integrator, 'sph');
  assert.ok(driver.demo.gpuMechanics.sphDensityProjectionIterations > 0);
  assert.ok(finalDropY < initialDropY, `plain SPH/PBF drop did not descend: ${initialDropY} -> ${finalDropY}`);
  assert.ok(finalGap < initialGap, `plain SPH/PBF support gap did not close: ${initialGap} -> ${finalGap}`);
  assert.ok(maxParticleSpeed(particles) < 5, 'plain SPH/PBF reference developed an implausible short-horizon speed spike');
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.eos, true);
  assert.equal(driver.demo.lastStepTiming.reactionEvents, 0);
});

test('plain SPH/PBF reference stays static when gravity and EOS laws are disabled', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'fe',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.5,
    dropParticleEdge: 2,
    baseParticleEdge: 5,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: true,
      gravity: false,
      eos: false,
      pressure: false,
      thermal: false,
      reactions: false,
      viscosity: false,
      surfaceTension: false
    }
  });
  const initialParticles = driver.demo.state.particles.map((particle) => ({
    ...particle,
    x: [...particle.x],
    v: [...particle.v]
  }));

  for (let stepIndex = 0; stepIndex < 16; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  assertFiniteParticleState(particles);
  assert.equal(driver.demo.gpuMechanics.integrator, 'sph');
  assert.equal(driver.demo.gpuMechanics.sphDensityProjectionIterations, 0);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.gravity, false);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.eos, false);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.pressure, false);
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.viscosity, false);
  assert.ok(maxParticleSpeed(particles) < 1e-9, 'no-force plain SPH generated velocity');
  assert.ok(
    maxParticleDisplacement(initialParticles, particles) < 1e-9,
    'no-force plain SPH moved particles'
  );
});

test('plain SPH wall contact cancels gravity half-kick at finite-volume floor', () => {
  const massKg = 8;
  const restDensityKgPerM3 = 1000;
  const clearance = 0.5 * Math.cbrt(massKg / restDensityKgPerM3);
  const carrier = createSphPhaseCarrier({
    dimension: 3,
    gravity: [0, -9.80665, 0],
    dt: 0.01,
    boxDimsM: [5, 5, 5],
    alpha: 0,
    beta: 0,
    eos: () => ({ pressurePa: 0, soundSpeedMPerS: 0 })
  });
  const state = {
    schema: 'test.sph-state.v0',
    dimension: 3,
    smoothingLengthM: 1,
    step: 0,
    time: 0,
    particles: [{
      material: 'h2o',
      role: 'base',
      x: [2.5, clearance, 2.5],
      v: [0, 0, 0],
      massKg,
      restDensityKgPerM3,
      specificInternalEnergyJPerKg: 0
    }]
  };

  const next = carrier.step(state).state.particles[0];

  nearlyEqual(next.x[1], clearance, 1e-12);
  nearlyEqual(next.v[1], 0, 1e-12);
});

test('plain SPH/PBF solid-liquid contact does not treat solid mass as fluid pressure mass', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'fe',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 2,
    baseParticleEdge: 5,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: false,
      viscosity: true,
      surfaceTension: false
    }
  });
  const initialMass = driver.totals().massKg;

  for (let stepIndex = 0; stepIndex < 24; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  assertFiniteParticleState(particles);
  nearlyEqual(driver.totals().massKg, initialMass, Math.max(1e-9, initialMass * 1e-8));
  assert.equal(driver.demo.gpuMechanics.integrator, 'sph');
  assert.equal(driver.demo.lastStepTiming.physicalLawGroups.eos, true);
  assert.equal(driver.demo.lastStepTiming.reactionEvents, 0);
  assert.ok(
    maxParticleSpeedForRole(particles, 'base') < 5,
    'plain SPH liquid base exploded under solid contact'
  );
});

test('plain SPH/PBF reaction gas products do not enter the condensed-liquid pressure solve', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'Na',
    baseMaterial: 'h2o',
    dropTemperatureK: 293.15,
    baseTemperatureK: 293.15,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 2,
    baseParticleEdge: 4,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: true,
      viscosity: true,
      surfaceTension: false
    }
  });
  const initialMass = driver.totals().massKg;
  let reactionEvents = 0;

  for (let stepIndex = 0; stepIndex < 64; stepIndex += 1) {
    driver.step();
    reactionEvents += driver.demo.lastStepTiming.reactionEvents || 0;
  }

  const particles = driver.demo.state.particles;
  const materials = new Set(particles.map((particle) => particle.material));
  assertFiniteParticleState(particles);
  nearlyEqual(driver.totals().massKg, initialMass, Math.max(1e-9, initialMass * 1e-8));
  assert.equal(driver.demo.gpuMechanics.integrator, 'sph');
  assert.ok(reactionEvents > 0, 'Na/H2O fixture did not produce reaction products');
  assert.ok(materials.has('naoh'), 'Na/H2O fixture did not produce NaOH');
  assert.ok(materials.has('h2'), 'Na/H2O fixture did not produce H2 gas');
  assert.ok(
    maxParticleSpeed(particles) < 5,
    'plain SPH reaction products drove particles into the display speed clamp'
  );
});

test('plain SPH/PBF reference keeps solid H2O from flowing like liquid water', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 250,
    baseTemperatureK: 250,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: true,
      gravity: false,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: false
    }
  });
  const initialParticles = driver.demo.state.particles.map((particle) => ({
    ...particle,
    x: [...particle.x],
    v: [...particle.v]
  }));
  const initialPhase = driver.phaseMassSummary();
  assert.equal(initialPhase.solidFractionByMaterial.h2o, 1);

  for (let stepIndex = 0; stepIndex < 8; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  const finalPhase = driver.phaseMassSummary();
  assertFiniteParticleState(particles);
  assert.equal(finalPhase.solidFractionByMaterial.h2o, 1);
  assert.ok(
    maxPairDistanceDriftForRole(initialParticles, particles, 'base') < 1e-4,
    'plain SPH/PBF solid H2O base changed internal distances like a liquid'
  );
  assert.ok(
    maxPairDistanceDriftForRole(initialParticles, particles, 'drop') < 1e-4,
    'plain SPH/PBF solid H2O drop changed internal distances like a liquid'
  );
  assert.ok(maxParticleSpeed(particles) < 1e-3, 'plain SPH/PBF solid H2O should stay static with gravity disabled');
});

test('plain SPH/PBF reference keeps solid H2O supported under gravity', () => {
  const driver = createSphPhaseDemo({
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 250,
    baseTemperatureK: 250,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: false
    }
  });
  const initialParticles = driver.demo.state.particles.map((particle) => ({
    ...particle,
    x: [...particle.x],
    v: [...particle.v]
  }));
  const initialGap = dropBaseSupportGapY(driver.demo.state.particles);
  assert.ok(Math.abs(initialGap) < 1e-6, `solid H2O support fixture should start in contact, got gap ${initialGap}`);

  for (let stepIndex = 0; stepIndex < 32; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  const finalGap = dropBaseSupportGapY(particles);
  const finalPhase = driver.phaseMassSummary();
  assertFiniteParticleState(particles);
  assert.equal(finalPhase.solidFractionByMaterial.h2o, 1);
  assert.ok(finalGap >= -2e-5, `solid H2O drop sank through base support: ${initialGap} -> ${finalGap}`);
  assert.ok(
    maxPairDistanceDriftForRole(initialParticles, particles, 'drop') < 1e-4,
    'solid H2O drop deformed internally while supported'
  );
  assert.ok(maxParticleSpeedForRole(particles, 'drop') < 0.05, 'solid H2O drop retained unsupported falling speed at contact');
});

test('plain SPH/PBF long-horizon liquid acceptance remains merged and damps bulk drop motion', {
  skip: process.env.ULG_RUN_LONG_LIQUID_ATOMIC === '1'
    ? false
    : 'Set ULG_RUN_LONG_LIQUID_ATOMIC=1 to run the opt-in liquid-settling acceptance gate.'
}, () => {
  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({
      boxDimensionsM: [5, 5, 5]
    }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1.01,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'sph',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: false,
      viscosity: true,
      surfaceTension: false
    }
  });
  const initialMass = driver.totals().massKg;
  const initialGap = dropBaseSupportGapY(driver.demo.state.particles);

  for (let stepIndex = 0; stepIndex < 144; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  const finalGap = dropBaseSupportGapY(particles);
  const finalDropSpeedMPerS = maxParticleSpeedForRole(particles, 'drop');
  const freeSurfaceShape = liquidFreeSurfaceShapeMetrics(particles, driver.demo.box.dimensionsM);
  assertFiniteParticleState(particles);
  nearlyEqual(driver.totals().massKg, initialMass, Math.max(1e-9, initialMass * 1e-8));
  assert.equal(driver.demo.gpuMechanics.integrator, 'sph');
  assert.equal(driver.demo.gpuMechanics.sphFluidHydrostaticPressure, false);
  assert.equal(driver.demo.gpuMechanics.sphLiquidFreeSurfaceRelaxationAlpha, 5e-5);
  assert.ok(driver.demo.state.time >= 1, `plain SPH liquid gate did not reach 1 s: ${driver.demo.state.time}s`);
  assert.ok(finalGap <= Math.min(0, initialGap), `plain SPH same-material liquid did not remain merged: ${initialGap} -> ${finalGap}`);
  assert.ok(finalDropSpeedMPerS < 0.25, `plain SPH liquid retained excessive bulk motion after ${driver.demo.state.time}s: ${finalDropSpeedMPerS} m/s`);
  assert.ok(
    freeSurfaceShape.tallnessRatio <= 0.75,
    `plain SPH liquid stayed too tall/blocky: ${freeSurfaceShape.tallnessRatio}`
  );
  assert.ok(
    freeSurfaceShape.footprintFillRatio >= 0.15,
    `plain SPH liquid footprint did not spread enough: ${freeSurfaceShape.footprintFillRatio}`
  );
});

test('H2O/H2O long-horizon liquid acceptance remains merged and damps bulk drop motion', {
  skip: process.env.ULG_RUN_LONG_LIQUID_ATOMIC === '1'
    ? false
    : 'Set ULG_RUN_LONG_LIQUID_ATOMIC=1 to run the opt-in liquid-settling acceptance gate.'
}, () => {
  const driver = createSphPhaseDemo({
    scenario: createSphPhaseScenario({
      boxDimensionsM: [5, 5, 5],
      wallTemperatureK: 283.15
    }),
    dropMaterial: 'h2o',
    baseMaterial: 'h2o',
    dropTemperatureK: 300,
    baseTemperatureK: 300,
    iceBaseHeightM: 0,
    ironBaseHeightM: 1,
    dropParticleEdge: 3,
    baseParticleEdge: 5,
    mechanics: 'mlsmpm',
    physicalLawGroups: {
      mechanics: true,
      gravity: true,
      eos: true,
      pressure: true,
      thermal: false,
      reactions: false
    }
  });
  const initialMass = driver.totals().massKg;
  const initialCenter = centerOfMass(driver.demo.state.particles);
  const initialGap = dropBaseSupportGapY(driver.demo.state.particles);

  for (let stepIndex = 0; stepIndex < 128; stepIndex += 1) driver.step();

  const particles = driver.demo.state.particles;
  const finalCenter = centerOfMass(particles);
  const finalGap = dropBaseSupportGapY(particles);
  const j = volumeRatioRange(particles);
  const finalDropSpeedMPerS = maxParticleSpeedForRole(particles, 'drop');
  assertFiniteParticleState(particles);
  nearlyEqual(driver.totals().massKg, initialMass, Math.max(1e-9, initialMass * 1e-8));
  assert.ok(driver.demo.state.time >= 1, `long-horizon liquid gate did not reach 1 s: ${driver.demo.state.time}s`);
  assert.ok(Math.abs(finalCenter[0] - initialCenter[0]) < 0.05, `symmetric liquid COM drifted in X: ${initialCenter[0]} -> ${finalCenter[0]}`);
  assert.ok(Math.abs(finalCenter[2] - initialCenter[2]) < 0.05, `symmetric liquid COM drifted in Z: ${initialCenter[2]} -> ${finalCenter[2]}`);
  assert.ok(finalGap <= Math.min(0, initialGap), `same-material liquid did not remain merged: ${initialGap} -> ${finalGap}`);
  assert.ok(j.min >= 0.95, `long-horizon liquid volume compressed too far: ${j.min}`);
  assert.ok(j.max <= 1.05, `long-horizon liquid volume expanded too far: ${j.max}`);
  assert.ok(finalDropSpeedMPerS < 0.25, `liquid drop retained excessive bulk motion after ${driver.demo.state.time}s: ${finalDropSpeedMPerS} m/s`);
});
