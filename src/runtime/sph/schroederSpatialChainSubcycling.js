// N-level Schroeder chain temporal subcycling plan, conservative nested reflux
// reference, and explicit hydrostatic room-air / buoyant plume verification
// (plan/todo/SS/schroeder-tree-and-algorithm-plan.md).

export const ULG_SCHROEDER_CHAIN_SUBCYCLING_SCHEMA =
  'peercompute.ulg.schroeder-chain-subcycling.v1';

const VALID_SUBSTEPS = new Set([1, 2, 4, 8]);

/**
 * Build a deterministic dyadic temporal subcycling schedule for an N-level
 * Schroeder mechanics chain:
 *   - Fine level L0 advances `fineSubstepsPerCoarseStep` (power of 2 in 1..8)
 *     substeps per coarse macro step `macroDtS` (`dt_0 = macroDtS / M`).
 *   - Each coarser level l advances at `substeps_l = max(1, M >> l)` with
 *     `dt_l = macroDtS / substeps_l`, preserving exact dyadic time ratios.
 *   - Default `fineSubstepsPerCoarseStep = 1` produces exact bit-identity with
 *     synchronous single-dt stepping.
 */
export function normalizeSchroederChainSubcyclePlan({
  mechanicsLevels,
  fineSubstepsPerCoarseStep = 1,
  macroDtS
} = {}) {
  if (!Array.isArray(mechanicsLevels) || mechanicsLevels.length < 2) {
    throw new RangeError('normalizeSchroederChainSubcyclePlan requires at least 2 mechanicsLevels');
  }
  const m = Math.max(1, Math.round(Number(fineSubstepsPerCoarseStep) || 1));
  if (!VALID_SUBSTEPS.has(m)) {
    throw new RangeError(`fineSubstepsPerCoarseStep must be a power of 2 in {1, 2, 4, 8}, got ${fineSubstepsPerCoarseStep}`);
  }
  const dt = Number(macroDtS);
  if (!Number.isFinite(dt) || !(dt > 0)) {
    throw new RangeError(`macroDtS must be finite and positive, got ${macroDtS}`);
  }
  const levelCount = mechanicsLevels.length;
  const fineDtS = Math.fround(dt / m);
  const perLevel = mechanicsLevels.map((spec, idx) => {
    const substeps = Math.max(1, m >> idx);
    const stride = m / substeps; // coarse refresh every `stride` fine substeps
    return Object.freeze({
      selectedLevel: spec.selectedLevel ?? idx,
      substepsPerMacroStep: substeps,
      fineSubstepStride: stride,
      dtS: Math.fround(dt / substeps),
      refluxSyncOrdinals: Object.freeze(
        Array.from({ length: substeps }, (_, k) => (k + 1) * stride - 1)
      )
    });
  });
  return Object.freeze({
    schema: ULG_SCHROEDER_CHAIN_SUBCYCLING_SCHEMA,
    enabled: m > 1,
    levelCount,
    fineSubstepsPerCoarseStep: m,
    macroDtS: dt,
    fineDtS,
    perLevel: Object.freeze(perLevel)
  });
}

/**
 * Exact conservative nested temporal subcycling + reflux reference verifier.
 * Fine level L0 takes `fineSubstepsPerCoarseStep` substeps of `dt_fine = dt / M`,
 * accumulating exact interface impulse `J_edge = sum_s F_edge(s) * dt_fine` on
 * every fine-to-coarse coupling edge. At the end of the macro step, the coarse
 * level applies `-J_edge` (exact Newton 3rd-law reflux), conserving total system
 * momentum and mass identically across any dyadic subcycling factor M = 1,2,4,8.
 */
export function executeNestedChainRefluxStepCpuReference({
  fineNodes,
  coarseNodes,
  couplingEdges,
  macroDtS,
  fineSubstepsPerCoarseStep = 2
} = {}) {
  const m = Math.max(1, Math.round(Number(fineSubstepsPerCoarseStep) || 1));
  if (!VALID_SUBSTEPS.has(m)) throw new RangeError('fineSubstepsPerCoarseStep must be in {1, 2, 4, 8}');
  const dtFine = macroDtS / m;
  const fine = fineNodes.map((n) => ({ ...n, p: [...n.p] }));
  const coarse = coarseNodes.map((n) => ({ ...n, p: [...n.p] }));
  const refluxAccumulator = couplingEdges.map(() => [0, 0, 0]);

  for (let sub = 0; sub < m; sub += 1) {
    for (let e = 0; e < couplingEdges.length; e += 1) {
      const { fineIdx, coarseIdx, dragRatePerS } = couplingEdges[e];
      const fn = fine[fineIdx];
      const cn = coarse[coarseIdx];
      const vFine = fn.p.map((pi) => pi / fn.mass);
      const vCoarse = cn.p.map((pi) => pi / cn.mass);
      // Reduced-mass stable implicit exchange impulse over dtFine.
      const mu = (fn.mass * cn.mass) / (fn.mass + cn.mass);
      const factor = 1 - Math.exp(-dragRatePerS * dtFine);
      for (let d = 0; d < 3; d += 1) {
        const jFine = mu * factor * (vCoarse[d] - vFine[d]);
        fn.p[d] += jFine;
        refluxAccumulator[e][d] -= jFine;
      }
    }
  }
  // Commit accumulated nested reflux conservatively to coarse level at sync boundary.
  for (let e = 0; e < couplingEdges.length; e += 1) {
    const { coarseIdx } = couplingEdges[e];
    for (let d = 0; d < 3; d += 1) {
      coarse[coarseIdx].p[d] += refluxAccumulator[e][d];
    }
  }
  const sumMomentum = (nodes) => nodes.reduce(
    (acc, n) => [acc[0] + n.p[0], acc[1] + n.p[1], acc[2] + n.p[2]],
    [0, 0, 0]
  );
  const pFine = sumMomentum(fine);
  const pCoarse = sumMomentum(coarse);
  return Object.freeze({
    fineNodes: fine,
    coarseNodes: coarse,
    refluxAccumulator,
    totalMomentum: Object.freeze([pFine[0] + pCoarse[0], pFine[1] + pCoarse[1], pFine[2] + pCoarse[2]]),
    fineSubstepsRun: m
  });
}

/**
 * Verify explicit hydrostatic room air (`ambientReferenceDensityKgPerM3 === 0`)
 * equilibrium `dP/dy = -rho * g` and emergent buoyant upward acceleration of a
 * hot vapor/steam plume `a_y = (-dP/dy)/rho_plume - g = g * (rho_air - rho_plume) / rho_plume`
 * with zero implicit ambient-buoyancy stand-in!
 */
export function verifyExplicitHydrostaticAirColumnAndPlume({
  ambientReferenceDensityKgPerM3 = 0,
  surfacePressurePa = 101325,
  airTemperatureK = 293.15,
  plumeTemperatureK = 420,
  airMolarMassKgPerMol = 0.0289647,
  plumeMolarMassKgPerMol = 0.01801528,
  gravityMPerS2 = 9.81,
  columnHeightM = 1.0,
  levels = 32
} = {}) {
  const R = 8.314462618;
  const rAir = R / airMolarMassKgPerMol;
  const rPlume = R / plumeMolarMassKgPerMol;
  const dy = columnHeightM / levels;
  const pressures = new Float64Array(levels);
  const densities = new Float64Array(levels);
  for (let k = 0; k < levels; k += 1) {
    const y = (k + 0.5) * dy;
    // Exact isothermal barometric hydrostatic balance P(y) = P0 * exp(-g * y / (R_air * T))
    const p = surfacePressurePa * Math.exp((-gravityMPerS2 * y) / (rAir * airTemperatureK));
    pressures[k] = p;
    densities[k] = p / (rAir * airTemperatureK);
  }
  let maxHydrostaticResidualRel = 0;
  for (let k = 1; k < levels - 1; k += 1) {
    const dpDy = (pressures[k + 1] - pressures[k - 1]) / (2 * dy);
    const netAccelY = -dpDy / densities[k] - gravityMPerS2;
    maxHydrostaticResidualRel = Math.max(maxHydrostaticResidualRel, Math.abs(netAccelY) / gravityMPerS2);
  }
  // Plume parcel at mid-column: explicit pressure gradient from room air pushes it UP!
  const mid = Math.floor(levels / 2);
  const dpDyMid = (pressures[mid + 1] - pressures[mid - 1]) / (2 * dy);
  const rhoAirMid = densities[mid];
  const rhoPlumeMid = pressures[mid] / (rPlume * plumeTemperatureK);
  const emergentPlumeAccelY = -dpDyMid / rhoPlumeMid - gravityMPerS2;
  const analyticBuoyancyAccelY = gravityMPerS2 * ((rhoAirMid - rhoPlumeMid) / rhoPlumeMid);
  return Object.freeze({
    explicitHydrostaticAirActive: Number(ambientReferenceDensityKgPerM3) === 0,
    ambientReferenceDensityKgPerM3: Number(ambientReferenceDensityKgPerM3),
    maxHydrostaticResidualRel,
    rhoAirMidKgPerM3: rhoAirMid,
    rhoPlumeMidKgPerM3: rhoPlumeMid,
    emergentPlumeAccelMPerS2: emergentPlumeAccelY,
    analyticBuoyancyAccelMPerS2: analyticBuoyancyAccelY,
    buoyancyRelativeError: Math.abs(emergentPlumeAccelY - analyticBuoyancyAccelY) / Math.max(1e-9, Math.abs(analyticBuoyancyAccelY)),
    plumeRisesNaturally: emergentPlumeAccelY > 0
  });
}
