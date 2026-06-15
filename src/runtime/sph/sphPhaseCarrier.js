// Conservative SPH phase carrier (demo plan P4).
//
// A kick-drift-kick (leapfrog) integrator over the symmetric SPH operators. Each particle's
// phase is read from its specific internal energy through the P3 lever-rule solver, so phase
// state emerges from the thermodynamics rather than being scripted. CPU reference, evidence-only:
// the produced simulation artifact carries sphValidation/phaseChangeValidation = false.

import { stablePhaseFromSpecificEnergy } from '../material/phaseEquilibrium.js';
import { cloneSphState } from './sphState.js';
import {
  computeAccelerationsAndEnergyRates,
  computeDensities,
  cubicSplineKernelGradientMagnitude
} from './sphOperators.js';
import { sphConservationReport, sphTotals } from './sphConservation.js';

/**
 * Summarize phase state: particle counts and mass per (material, phase), using each material's
 * closure properties to map specific internal energy to a phase.
 */
export function summarizePhases(state, materialProperties = {}) {
  const byMaterialPhase = {};
  for (const p of state.particles) {
    const properties = materialProperties[p.material];
    let phase = 'unknown';
    if (properties) {
      phase = stablePhaseFromSpecificEnergy(properties, p.specificInternalEnergyJPerKg) || 'unknown';
    }
    byMaterialPhase[p.material] = byMaterialPhase[p.material] || {};
    const bucket = byMaterialPhase[p.material][phase] || { count: 0, massKg: 0 };
    bucket.count += 1;
    bucket.massKg += p.massKg;
    byMaterialPhase[p.material][phase] = bucket;
  }
  return byMaterialPhase;
}

export function createSphPhaseCarrier(options = {}) {
  const {
    dimension = 3,
    gamma = 1.4,
    gravity = null,
    alpha = 0,
    beta = 0,
    dt = 1e-4,
    eos = null,
    boxDimsM = null,
    densityProjectionIterations = 0,
    densityProjectionRelaxation = 0.5,
    densityProjectionEpsilon = 1e-5,
    solidPredicate = null,
    fluidPredicate = null,
    solidGroupKey = null,
    solidContactToleranceM = 1e-6,
    fluidHydrostaticPressure = false,
    fluidHydrostaticPressureScale = 1,
    fluidHydrostaticPressureDensityFloorRatio = 0.85,
    fluidHydrostaticPressureDensityFullRatio = 1,
    liquidVelocityDiffusionAlpha = 0,
    liquidVelocityDiffusionRadiusM = null,
    liquidWallDampingAlpha = 0,
    liquidWallDampingDistanceM = null,
    liquidFreeSurfaceRelaxationAlpha = 0,
    liquidFreeSurfaceTargetDepthM = null,
    liquidFreeSurfaceContactDepthM = null
  } = options;
  const projectionIterations = Math.max(0, Math.round(Number(densityProjectionIterations) || 0));
  const projectionRelaxation = Number.isFinite(densityProjectionRelaxation)
    ? Math.min(Math.max(densityProjectionRelaxation, 0), 1)
    : 0.5;
  const solidContactTolerance = Number.isFinite(solidContactToleranceM) && solidContactToleranceM >= 0
    ? solidContactToleranceM
    : 1e-6;
  const velocityDiffusionAlpha = Math.min(Math.max(Number(liquidVelocityDiffusionAlpha) || 0, 0), 1);
  const velocityDiffusionRadius = Number.isFinite(liquidVelocityDiffusionRadiusM) && liquidVelocityDiffusionRadiusM > 0
    ? liquidVelocityDiffusionRadiusM
    : null;
  const wallDampingAlpha = Math.min(Math.max(Number(liquidWallDampingAlpha) || 0, 0), 1);
  const wallDampingDistance = Number.isFinite(liquidWallDampingDistanceM) && liquidWallDampingDistanceM > 0
    ? liquidWallDampingDistanceM
    : null;
  const freeSurfaceRelaxationAlpha = Math.min(Math.max(Number(liquidFreeSurfaceRelaxationAlpha) || 0, 0), 1);
  const freeSurfaceTargetDepth = Number.isFinite(liquidFreeSurfaceTargetDepthM) && liquidFreeSurfaceTargetDepthM > 0
    ? liquidFreeSurfaceTargetDepthM
    : null;
  const freeSurfaceContactDepth = Number.isFinite(liquidFreeSurfaceContactDepthM) && liquidFreeSurfaceContactDepthM > 0
    ? liquidFreeSurfaceContactDepthM
    : null;
  const hydrostaticPressureEnabled = fluidHydrostaticPressure === true;
  const hydrostaticPressureScale = Math.max(Number(fluidHydrostaticPressureScale) || 0, 0);
  const hydrostaticDensityFloorRatio = Math.max(Number(fluidHydrostaticPressureDensityFloorRatio) || 0, 0);
  const hydrostaticDensityFullRatio = Math.max(
    Number(fluidHydrostaticPressureDensityFullRatio) || hydrostaticDensityFloorRatio,
    hydrostaticDensityFloorRatio + 1e-9
  );
  const gravityAcceleration = Array.from({ length: dimension }, (_, index) => {
    const value = Array.isArray(gravity) ? Number(gravity[index]) : 0;
    return Number.isFinite(value) ? value : 0;
  });
  const isSolidParticle = (particle) => {
    if (typeof solidPredicate !== 'function') return false;
    try {
      return solidPredicate(particle) === true;
    } catch {
      return false;
    }
  };
  const isFluidParticle = (particle) => {
    if (isSolidParticle(particle)) return false;
    if (typeof fluidPredicate !== 'function') return true;
    try {
      return fluidPredicate(particle) === true;
    } catch {
      return false;
    }
  };
  const fieldOptions = {
    dimension,
    gamma,
    gravity,
    alpha,
    beta,
    eos,
    contributesToDensity: isFluidParticle,
    participatesInPressure: isFluidParticle
  };
  const groupKeyForSolidParticle = (particle) => {
    if (typeof solidGroupKey === 'function') {
      try {
        const key = solidGroupKey(particle);
        if (key != null && String(key).trim()) return String(key).trim();
      } catch {
        // Fall through to the stable default below.
      }
    }
    return `${particle?.material || 'solid'}:${particle?.role || 'solid'}`;
  };

  const restDensityOf = (particle) => {
    const restDensity = Number(particle.restDensityKgPerM3);
    if (Number.isFinite(restDensity) && restDensity > 0) return restDensity;
    return 1000;
  };

  const wallClearanceM = (particle) => {
    const restDensity = restDensityOf(particle);
    const mass = Number(particle.massKg);
    if (!(mass > 0) || !(restDensity > 0)) return 0;
    return 0.5 * Math.cbrt(mass / restDensity);
  };

  const applyWallBoundary = (particle) => {
    if (!Array.isArray(boxDimsM)) return;
    const clearance = wallClearanceM(particle);
    for (let axis = 0; axis < dimension; axis += 1) {
      const upperBound = Number(boxDimsM[axis]);
      if (!(upperBound > 0)) continue;
      const lower = clearance;
      const upper = Math.max(lower, upperBound - clearance);
      const contactEpsilon = Math.max(1e-12, clearance * 1e-6);
      if (particle.x[axis] < lower) {
        particle.x[axis] = lower;
        if (particle.v[axis] < 0) particle.v[axis] = 0;
      } else if (particle.x[axis] <= lower + contactEpsilon) {
        if (particle.v[axis] < 0) particle.v[axis] = 0;
      } else if (particle.x[axis] > upper) {
        particle.x[axis] = upper;
        if (particle.v[axis] > 0) particle.v[axis] = 0;
      } else if (particle.x[axis] >= upper - contactEpsilon) {
        if (particle.v[axis] > 0) particle.v[axis] = 0;
      }
    }
  };

  const applyFluidWallDamping = (particles) => {
    if (!(wallDampingAlpha > 0) || dimension < 2) return;
    for (const particle of particles) {
      if (!isFluidParticle(particle)) continue;
      const clearance = wallClearanceM(particle);
      const dampingDistance = Math.max(wallDampingDistance ?? (3 * clearance), 1e-9);
      const floorDistance = Math.max(0, particle.x[1] - clearance);
      if (floorDistance >= dampingDistance) continue;
      const q = 1 - (floorDistance / dampingDistance);
      const keep = Math.min(Math.max(1 - wallDampingAlpha * q * q, 0), 1);
      for (let axis = 0; axis < dimension; axis += 1) particle.v[axis] *= keep;
    }
  };

  const applyFluidVelocityDiffusion = (particles, smoothingLengthM) => {
    if (!(velocityDiffusionAlpha > 0) || particles.length < 2) return;
    const radius = Math.max(velocityDiffusionRadius ?? (2 * smoothingLengthM), 1e-9);
    const radius2 = radius * radius;
    const dv = particles.map(() => new Array(dimension).fill(0));
    for (let i = 0; i < particles.length - 1; i += 1) {
      const a = particles[i];
      if (!isFluidParticle(a)) continue;
      const ma = Number(a.massKg);
      if (!(ma > 0)) continue;
      for (let j = i + 1; j < particles.length; j += 1) {
        const b = particles[j];
        if (!isFluidParticle(b) || a.material !== b.material) continue;
        const mb = Number(b.massKg);
        if (!(mb > 0)) continue;
        let r2 = 0;
        for (let axis = 0; axis < dimension; axis += 1) {
          const delta = b.x[axis] - a.x[axis];
          r2 += delta * delta;
        }
        if (!(r2 > 0) || r2 > radius2) continue;
        const q = 1 - (Math.sqrt(r2) / radius);
        const mix = velocityDiffusionAlpha * q * q;
        const invMass = 1 / (ma + mb);
        const wa = mb * invMass;
        const wb = ma * invMass;
        for (let axis = 0; axis < dimension; axis += 1) {
          const rel = b.v[axis] - a.v[axis];
          dv[i][axis] += mix * wa * rel;
          dv[j][axis] -= mix * wb * rel;
        }
      }
    }
    for (let i = 0; i < particles.length; i += 1) {
      for (let axis = 0; axis < dimension; axis += 1) particles[i].v[axis] += dv[i][axis];
    }
  };

  const applyFluidPostVelocityConstraints = (particles, smoothingLengthM) => {
    applyFluidWallDamping(particles);
    applyFluidVelocityDiffusion(particles, smoothingLengthM);
    for (const particle of particles) {
      if (isFluidParticle(particle)) applyWallBoundary(particle);
    }
  };

  const refreshFluidHydrostaticPressure = (particles, smoothingLengthM) => {
    for (const particle of particles) particle.sphHydrostaticPressurePa = 0;
    if (!hydrostaticPressureEnabled || !(hydrostaticPressureScale > 0) || dimension < 2) return;
    const gravityMagnitude = Math.max(0, -Number(gravityAcceleration[1]) || 0);
    if (!(gravityMagnitude > 0)) return;
    const densities = computeDensities(particles, smoothingLengthM, dimension, {
      contributesToDensity: isFluidParticle
    });
    const groups = new Map();
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!isFluidParticle(particle)) continue;
      const key = particle.material || 'fluid';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ particle, index });
    }
    for (const group of groups.values()) {
      let upperSurfaceY = Number.NEGATIVE_INFINITY;
      for (const { particle } of group) {
        upperSurfaceY = Math.max(upperSurfaceY, particle.x[1] + wallClearanceM(particle));
      }
      if (!Number.isFinite(upperSurfaceY)) continue;
      for (const { particle, index } of group) {
        const densityRatio = densities[index] / Math.max(restDensityOf(particle), 1e-30);
        const densityWeight = Math.min(
          Math.max(
            (densityRatio - hydrostaticDensityFloorRatio)
              / (hydrostaticDensityFullRatio - hydrostaticDensityFloorRatio),
            0
          ),
          1
        );
        if (!(densityWeight > 0)) continue;
        const depthM = Math.max(0, upperSurfaceY - particle.x[1]);
        particle.sphHydrostaticPressurePa = hydrostaticPressureScale
          * densityWeight
          * restDensityOf(particle)
          * gravityMagnitude
          * depthM;
      }
    }
  };

  const applyFluidFreeSurfaceRelaxation = (particles) => {
    if (!(freeSurfaceRelaxationAlpha > 0) || !Array.isArray(boxDimsM) || dimension < 3) return;
    const groups = new Map();
    for (const particle of particles) {
      if (!isFluidParticle(particle)) continue;
      const key = particle.material || 'fluid';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(particle);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
      const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
      const center = [0, 0, 0];
      let totalMass = 0;
      let totalRestVolume = 0;
      for (const particle of group) {
        const mass = Number(particle.massKg) > 0 ? Number(particle.massKg) : 1;
        const restDensity = restDensityOf(particle);
        const restVolume = mass / Math.max(restDensity, 1e-30);
        const clearance = wallClearanceM(particle);
        totalMass += mass;
        totalRestVolume += restVolume;
        for (let axis = 0; axis < dimension; axis += 1) {
          min[axis] = Math.min(min[axis], particle.x[axis] - clearance);
          max[axis] = Math.max(max[axis], particle.x[axis] + clearance);
          center[axis] += mass * particle.x[axis];
        }
      }
      if (!(totalMass > 0) || !(totalRestVolume > 0)) continue;
      for (let axis = 0; axis < dimension; axis += 1) center[axis] /= totalMass;
      const avgCellM = Math.cbrt(totalRestVolume / group.length);
      const currentX = Math.max(max[0] - min[0], avgCellM);
      const currentZ = Math.max(max[2] - min[2], avgCellM);
      const currentArea = currentX * currentZ;
      const boxArea = Math.max(1e-9, Number(boxDimsM[0]) * Number(boxDimsM[2]));
      const targetDepth = freeSurfaceTargetDepth ?? Math.max(
        1.5 * avgCellM,
        totalRestVolume / (0.75 * boxArea)
      );
      const targetArea = Math.min(
        0.75 * boxArea,
        Math.max(currentArea, totalRestVolume / Math.max(targetDepth, 1e-9))
      );
      if (!(targetArea > currentArea)) continue;
      const aspect = Math.max(1e-9, Number(boxDimsM[0]) / Math.max(Number(boxDimsM[2]), 1e-9));
      const targetX = Math.min(Number(boxDimsM[0]), Math.sqrt(targetArea * aspect));
      const targetZ = Math.min(Number(boxDimsM[2]), targetArea / Math.max(targetX, 1e-9));
      const growX = Math.min(Math.max(targetX / currentX, 1), 1.08);
      const growZ = Math.min(Math.max(targetZ / currentZ, 1), 1.08);
      if (growX <= 1 + 1e-6 && growZ <= 1 + 1e-6) continue;
      const contactDepth = freeSurfaceContactDepth ?? Math.max(2.5 * targetDepth, 3 * avgCellM);
      const surfaceY = max[1];
      for (const particle of group) {
        const depthWeight = Math.min(Math.max((surfaceY - particle.x[1]) / Math.max(contactDepth, 1e-9), 0), 1);
        const relax = freeSurfaceRelaxationAlpha * depthWeight;
        if (!(relax > 0)) continue;
        const clearance = wallClearanceM(particle);
        const nextX = center[0] + (particle.x[0] - center[0]) * (1 + relax * (growX - 1));
        const nextZ = center[2] + (particle.x[2] - center[2]) * (1 + relax * (growZ - 1));
        particle.x[0] = Math.min(Math.max(nextX, clearance), Math.max(clearance, Number(boxDimsM[0]) - clearance));
        particle.x[2] = Math.min(Math.max(nextZ, clearance), Math.max(clearance, Number(boxDimsM[2]) - clearance));
      }
    }
  };

  const collectSolidGroups = (particles) => {
    const groups = new Map();
    for (const particle of particles) {
      if (!isSolidParticle(particle)) continue;
      const key = groupKeyForSolidParticle(particle);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(particle);
    }
    return [...groups.values()];
  };

  const solidGroupBounds = (group) => {
    const min = new Array(dimension).fill(Number.POSITIVE_INFINITY);
    const max = new Array(dimension).fill(Number.NEGATIVE_INFINITY);
    const center = new Array(dimension).fill(0);
    let totalMass = 0;
    for (const particle of group) {
      const mass = Number(particle.massKg) > 0 ? Number(particle.massKg) : 1;
      totalMass += mass;
      for (let axis = 0; axis < dimension; axis += 1) {
        const clearance = wallClearanceM(particle);
        min[axis] = Math.min(min[axis], particle.x[axis] - clearance);
        max[axis] = Math.max(max[axis], particle.x[axis] + clearance);
        center[axis] += mass * particle.x[axis];
      }
    }
    if (totalMass > 0) {
      for (let axis = 0; axis < dimension; axis += 1) center[axis] /= totalMass;
    }
    return { group, min, max, center };
  };

  const applySolidGroupWallBoundary = (particles) => {
    if (!Array.isArray(boxDimsM)) return;
    const groups = collectSolidGroups(particles);
    for (const group of groups.values()) {
      for (let axis = 0; axis < dimension; axis += 1) {
        const upperBound = Number(boxDimsM[axis]);
        if (!(upperBound > 0)) continue;
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (const particle of group) {
          const clearance = wallClearanceM(particle);
          min = Math.min(min, particle.x[axis] - clearance);
          max = Math.max(max, particle.x[axis] + clearance);
        }
        let shift = 0;
        let blockNegativeVelocity = false;
        let blockPositiveVelocity = false;
        if (min < 0) {
          shift = -min;
          blockNegativeVelocity = true;
        } else if (max > upperBound) {
          shift = upperBound - max;
          blockPositiveVelocity = true;
        }
        if (shift !== 0) {
          for (const particle of group) particle.x[axis] += shift;
        }
        if (blockNegativeVelocity) {
          for (const particle of group) if (particle.v[axis] < 0) particle.v[axis] = 0;
        }
        if (blockPositiveVelocity) {
          for (const particle of group) if (particle.v[axis] > 0) particle.v[axis] = 0;
        }
      }
    }
  };

  const applySolidGroupContactBoundary = (particles) => {
    const groups = collectSolidGroups(particles).map(solidGroupBounds);
    if (groups.length < 2 || dimension < 2) return;
    const verticalAxis = 1;
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        let horizontalOverlap = true;
        for (let axis = 0; axis < dimension; axis += 1) {
          if (axis === verticalAxis) continue;
          const overlap = Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
          if (overlap <= 0) {
            horizontalOverlap = false;
            break;
          }
        }
        if (!horizontalOverlap) continue;
        const upper = a.center[verticalAxis] >= b.center[verticalAxis] ? a : b;
        const lower = upper === a ? b : a;
        const supportGap = upper.min[verticalAxis] - lower.max[verticalAxis];
        if (supportGap > solidContactTolerance) continue;
        const penetration = Math.max(0, -supportGap);
        if (penetration > 0) {
          const shift = penetration + solidContactTolerance;
          for (const particle of upper.group) particle.x[verticalAxis] += shift;
          upper.min[verticalAxis] += shift;
          upper.max[verticalAxis] += shift;
          upper.center[verticalAxis] += shift;
        }
        for (const particle of upper.group) {
          if (particle.v[verticalAxis] < 0) particle.v[verticalAxis] = 0;
        }
      }
    }
  };

  const projectDensityConstraints = (particles, smoothingLengthM) => {
    if (projectionIterations <= 0 || particles.length <= 1) return;
    const kernelH = Number.isFinite(smoothingLengthM) && smoothingLengthM > 0 ? smoothingLengthM : 0;
    if (!(kernelH > 0)) return;
    const twoH2 = (2 * kernelH) ** 2;
    for (let iteration = 0; iteration < projectionIterations; iteration += 1) {
      const fluidMask = particles.map(isFluidParticle);
      const densities = computeDensities(particles, kernelH, dimension, { contributesToDensity: isFluidParticle });
      const lambdas = new Array(particles.length).fill(0);
      for (let i = 0; i < particles.length; i += 1) {
        if (!fluidMask[i]) continue;
        const rho0 = restDensityOf(particles[i]);
        const constraint = Math.max(0, densities[i] / Math.max(rho0, 1e-30) - 1);
        if (constraint <= 0) continue;
        const gradI = new Array(dimension).fill(0);
        let sumGrad2 = 0;
        const xi = particles[i].x;
        for (let j = 0; j < particles.length; j += 1) {
          if (i === j) continue;
          if (!fluidMask[j]) continue;
          const xj = particles[j].x;
          let r2 = 0;
          for (let axis = 0; axis < dimension; axis += 1) {
            const delta = xi[axis] - xj[axis];
            r2 += delta * delta;
          }
          if (r2 <= 0 || r2 >= twoH2) continue;
          const r = Math.sqrt(r2);
          const dWdr = cubicSplineKernelGradientMagnitude(r, kernelH, dimension);
          let gradMag2 = 0;
          for (let axis = 0; axis < dimension; axis += 1) {
            const grad = (particles[j].massKg / rho0) * (dWdr * (xi[axis] - xj[axis]) / r);
            gradI[axis] += grad;
            gradMag2 += grad * grad;
          }
          sumGrad2 += gradMag2;
        }
        for (let axis = 0; axis < dimension; axis += 1) sumGrad2 += gradI[axis] * gradI[axis];
        lambdas[i] = -constraint / (sumGrad2 + densityProjectionEpsilon);
      }
      const corrections = particles.map(() => new Array(dimension).fill(0));
      for (let i = 0; i < particles.length; i += 1) {
        if (!fluidMask[i]) continue;
        const xi = particles[i].x;
        const rho0 = restDensityOf(particles[i]);
        for (let j = 0; j < particles.length; j += 1) {
          if (i === j) continue;
          if (!fluidMask[j]) continue;
          const xj = particles[j].x;
          let r2 = 0;
          for (let axis = 0; axis < dimension; axis += 1) {
            const delta = xi[axis] - xj[axis];
            r2 += delta * delta;
          }
          if (r2 <= 0 || r2 >= twoH2) continue;
          const r = Math.sqrt(r2);
          const dWdr = cubicSplineKernelGradientMagnitude(r, kernelH, dimension);
          const lambda = lambdas[i] + lambdas[j];
          for (let axis = 0; axis < dimension; axis += 1) {
            corrections[i][axis] += (lambda / rho0) * (dWdr * (xi[axis] - xj[axis]) / r);
          }
        }
      }
      for (let i = 0; i < particles.length; i += 1) {
        if (!fluidMask[i]) continue;
        const particle = particles[i];
        for (let axis = 0; axis < dimension; axis += 1) {
          particle.x[axis] += projectionRelaxation * corrections[i][axis];
        }
        applyWallBoundary(particle);
      }
    }
  };

  function step(state) {
    const next = cloneSphState(state);
    refreshFluidHydrostaticPressure(next.particles, next.smoothingLengthM);
    const first = computeAccelerationsAndEnergyRates(next.particles, { ...fieldOptions, h: next.smoothingLengthM });
    // Half kick (velocity + internal energy).
    for (let i = 0; i < next.particles.length; i += 1) {
      const p = next.particles[i];
      const solid = isSolidParticle(p);
      const acceleration = solid ? gravityAcceleration : first.accelerations[i];
      for (let d = 0; d < dimension; d += 1) p.v[d] += 0.5 * dt * acceleration[d];
      if (!solid) p.specificInternalEnergyJPerKg += 0.5 * dt * first.energyRates[i];
    }
    // Drift positions.
    const preDriftPositions = next.particles.map((p) => [...p.x]);
    for (const p of next.particles) {
      for (let d = 0; d < dimension; d += 1) p.x[d] += dt * p.v[d];
      if (!isSolidParticle(p)) applyWallBoundary(p);
    }
    applySolidGroupWallBoundary(next.particles);
    applySolidGroupContactBoundary(next.particles);
    projectDensityConstraints(next.particles, next.smoothingLengthM);
    applyFluidFreeSurfaceRelaxation(next.particles);
    if (projectionIterations > 0) {
      for (let i = 0; i < next.particles.length; i += 1) {
        const p = next.particles[i];
        if (isSolidParticle(p)) continue;
        for (let d = 0; d < dimension; d += 1) p.v[d] = (p.x[d] - preDriftPositions[i][d]) / dt;
      }
    }
    // Second half kick at the drifted state.
    refreshFluidHydrostaticPressure(next.particles, next.smoothingLengthM);
    const second = computeAccelerationsAndEnergyRates(next.particles, { ...fieldOptions, h: next.smoothingLengthM });
    for (let i = 0; i < next.particles.length; i += 1) {
      const p = next.particles[i];
      const solid = isSolidParticle(p);
      const acceleration = solid ? gravityAcceleration : second.accelerations[i];
      for (let d = 0; d < dimension; d += 1) p.v[d] += 0.5 * dt * acceleration[d];
      if (!solid) p.specificInternalEnergyJPerKg += 0.5 * dt * second.energyRates[i];
      if (!solid) applyWallBoundary(p);
    }
    applySolidGroupWallBoundary(next.particles);
    applySolidGroupContactBoundary(next.particles);
    applyFluidPostVelocityConstraints(next.particles, next.smoothingLengthM);
    next.step = (state.step ?? 0) + 1;
    next.time = (state.time ?? 0) + dt;
    return {
      state: next,
      fields: second,
      densityProjectionIterations: projectionIterations
    };
  }

  function run(initialState, steps = 1) {
    const stepCount = Number(steps);
    if (!Number.isInteger(stepCount) || stepCount < 1) {
      throw new Error('SPH carrier steps must be a positive integer');
    }
    let state = cloneSphState(initialState);
    const totalsSeries = [sphTotals(state)];
    for (let i = 0; i < stepCount; i += 1) {
      state = step(state).state;
      totalsSeries.push(sphTotals(state));
    }
    return {
      backend: 'cpu-reference',
      integrator: 'leapfrog-kdk',
      dt,
      steps: stepCount,
      finalState: state,
      totalsSeries
    };
  }

  return {
    backend: 'cpu-reference',
    integrator: projectionIterations > 0 ? 'leapfrog-kdk-pbf-reference' : 'leapfrog-kdk',
    dt,
    densityProjectionIterations: projectionIterations,
    step,
    run
  };
}

/**
 * Run the carrier and assemble an evidence-only SPH phase simulation result (totals series,
 * conservation report, phase summary). The ABI artifact wrapper lives in sphPhaseContracts.
 */
export function runSphPhaseCarrier(initialState, { materialProperties = {}, toleranceProfile = {}, steps = 1, ...carrierOptions } = {}) {
  const carrier = createSphPhaseCarrier(carrierOptions);
  const run = carrier.run(initialState, steps);
  return {
    ...run,
    conservationReport: sphConservationReport(initialState, run.finalState, toleranceProfile),
    phaseSummary: summarizePhases(run.finalState, materialProperties),
    initialTotals: run.totalsSeries[0],
    finalTotals: run.totalsSeries[run.totalsSeries.length - 1]
  };
}
