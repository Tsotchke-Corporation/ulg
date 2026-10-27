import { buildSphEnvironmentGasInputs, normalizeSphEnvironmentInitialization } from './sphEnvironmentInitialization.js';
import { resolveSphPhaseCaloricModels } from './sph/sphCondensableParticleInitialization.js';
import { phaseCaloricBranches } from './material/condensableThermodynamics.js';
import { dyadicFromNumber } from './material/exactDyadicInventory.js';
import { createSphExactMassFormat, encodeSphExactMass, encodeSphExactMassUnits,
  decodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

const COLD_GAS_MASS_FORMAT = createSphExactMassFormat();

const volume = box => box.max.map((v, i) => v - box.min[i]).reduce((a, b) => a * b, 1);

// Disjoint rectangular pieces of one cell outside a condensed body. These are
// physical gas control volumes, not render geometry or inferred ambient forces.
function subtractBox(box, solid) {
  const lo = box.min.map((v, i) => Math.max(v, solid.min[i]));
  const hi = box.max.map((v, i) => Math.min(v, solid.max[i]));
  if (lo.some((v, i) => v >= hi[i])) return [box];
  const remaining = { min: [...box.min], max: [...box.max] }, pieces = [];
  for (let axis = 0; axis < 3; axis++) {
    if (remaining.min[axis] < lo[axis]) {
      const part = { min: [...remaining.min], max: [...remaining.max] };
      part.max[axis] = lo[axis]; pieces.push(part); remaining.min[axis] = lo[axis];
    }
    if (remaining.max[axis] > hi[axis]) {
      const part = { min: [...remaining.min], max: [...remaining.max] };
      part.min[axis] = hi[axis]; pieces.push(part); remaining.max[axis] = hi[axis];
    }
  }
  return pieces;
}

// Cold allocation only. Largest remainders distribute the parent's exact
// inventory coefficient in the declared run quantum. Their
// exact sum is invariant to the number of gas carriers and equals the declared
// species mass. No continuing inventory is evaluated on the CPU.
function allocateSpeciesMass(total, weights) {
  const source = decodeSphExactMass(encodeSphExactMass(total, COLD_GAS_MASS_FORMAT), COLD_GAS_MASS_FORMAT);
  const units = source.coefficient, exponent = source.exponent;
  const exactWeights = weights.map(dyadicFromNumber);
  const base = Math.min(...exactWeights.map(w => w.exponent));
  const integers = exactWeights.map(w => w.coefficient << BigInt(w.exponent - base));
  const sum = integers.reduce((a, b) => a + b, 0n);
  const allocation = integers.map(w => units * w / sum);
  const order = integers.map((w, i) => ({ i, remainder: units * w % sum }))
    .sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  const remainder = units - allocation.reduce((a, b) => a + b, 0n);
  for (let i = 0; i < Number(remainder); i++) allocation[order[i].i]++;
  return allocation.map(n => {
    const mass = Number(n) * 2 ** exponent;
    if (!(mass > 0) || !Number.isFinite(mass)) throw new RangeError('Environment cell is below the admitted cold mass resolution');
    return { massKg: mass, words: Array.from(encodeSphExactMassUnits(n, COLD_GAS_MASS_FORMAT)) };
  });
}

export function buildSphEnvironmentParticles({ environment, materialProperties, boxDimensionsM,
  occupiedBoxes = [], cellsPerAxis = 2, firstDomainId = 1 } = {}) {
  const input = normalizeSphEnvironmentInitialization(environment);
  if (input.nuclei.numberConcentrationPerM3 > 0) {
    throw new RangeError('Dry nuclei allocation and activation are not yet admitted; positive nuclei input cannot be ignored');
  }
  if (!Array.isArray(boxDimensionsM) || boxDimensionsM.length !== 3
      || boxDimensionsM.some(v => !Number.isFinite(v) || v <= 0)
      || !Number.isSafeInteger(cellsPerAxis) || cellsPerAxis < 1 || cellsPerAxis > 32
      || !Number.isSafeInteger(firstDomainId) || firstDomainId < 1 || firstDomainId > 0xffffff - 5) {
    throw new TypeError('Environment requires positive box dimensions, 1..32 cells per axis and a domain identity');
  }
  const box = { min: [0, 0, 0], max: boxDimensionsM };
  for (const solid of occupiedBoxes) {
    if (!Array.isArray(solid.min) || !Array.isArray(solid.max) || solid.min.length !== 3 || solid.max.length !== 3
        || solid.min.some((v, i) => !Number.isFinite(v) || !Number.isFinite(solid.max[i])
          || v < 0 || solid.max[i] > boxDimensionsM[i] || v >= solid.max[i])) {
      throw new RangeError('Environment requires bounded nonempty condensed boxes');
    }
  }
  // Resolve total physical free volume independently of numerical grid size.
  let free = [box];
  for (const solid of occupiedBoxes) free = free.flatMap(part => subtractBox(part, solid));
  const freeVolumeM3 = free.reduce((sum, part) => sum + volume(part), 0);
  const inventory = buildSphEnvironmentGasInputs({ environment: input, materialProperties, freeVolumeM3 });
  if (input.mode === 'vacuum') return { particles: [], inventory, cells: [] };
  const models = resolveSphPhaseCaloricModels(materialProperties), cells = [];
  for (let x = 0; x < cellsPerAxis; x++) for (let y = 0; y < cellsPerAxis; y++) for (let z = 0; z < cellsPerAxis; z++) {
    const index = [x, y, z];
    let parts = [{ min: index.map((v, i) => boxDimensionsM[i] * v / cellsPerAxis),
      max: index.map((v, i) => boxDimensionsM[i] * (v + 1) / cellsPerAxis) }];
    for (const solid of occupiedBoxes) parts = parts.flatMap(part => subtractBox(part, solid));
    cells.push(...parts);
  }
  const weights = cells.map(volume), particles = [];
  inventory.gasSpecies.forEach((row, species) => {
    const branch = phaseCaloricBranches(models[row.material]).find(b => b.phase === 'gas');
    const masses = allocateSpeciesMass(row.massKg, weights);
    cells.forEach((cell, index) => {
      const { massKg, words } = masses[index], domain = firstDomainId + species;
      const referenceVolume = Math.fround(massKg) / Math.fround(branch.densityKgPerM3);
      const currentVolume = volume(cell), J = currentVolume / referenceVolume, stretch = Math.cbrt(J);
      const radius = 0.5 * Math.cbrt(referenceVolume);
      particles.push({ material: row.material, role: 'environment-gas',
        initialBodyId: null, initialBodyDomainId: domain, renderDomainId: domain,
        renderDomainKey: `environment:${row.material}`, initialBodyParticleIndex: index,
        x: cell.min.map((v, i) => (v + cell.max[i]) / 2), v: [...row.meanVelocityMPerS],
        massKg, coldExactMassWords: words, temperatureK: row.temperatureK, pressurePa: row.partialPressurePa,
        specificInternalEnergyJPerKg: row.specificInternalEnergyJPerKg,
        phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] },
        restDensityKgPerM3: branch.densityKgPerM3,
        phaseVolumeReferenceDensityKgPerM3: branch.densityKgPerM3,
        phaseVolumeReferenceMassKg: massKg, phaseVolumeReferenceVolumeM3: referenceVolume,
        phaseVolumeReferenceMassRatio: 1, phaseVolumeReferencePhase: 'gas',
        phaseVolumeReferenceDensitySource: 'explicit-environment-caloric-reference',
        initialCellVolumeM3: currentVolume, continuumCellVolumeM3: currentVolume,
        currentCellVolumeM3: currentVolume, initialParticleSpacingM: Math.cbrt(currentVolume),
        visualRestVolumeM3: referenceVolume, visualParticleRadiusM: radius,
        visualRestParticleRadiusM: radius, particleRadiusM: radius, restParticleRadiusM: radius,
        currentParticleRadiusM: radius, mpmVolume0: referenceVolume, mpmJ: J,
        mpmF: [stretch, 0, 0, 0, stretch, 0, 0, 0, stretch] });
    });
  });
  return { particles, inventory, cells };
}
