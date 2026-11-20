import { buildSphEnvironmentGasInputs, normalizeSphEnvironmentInitialization,
  SPH_ENVIRONMENT_DRY_AIR } from './sphEnvironmentInitialization.js';
import { resolveSphPhaseCaloricModels } from './sph/sphCondensableParticleInitialization.js';
import { phaseCaloricBranches } from './material/condensableThermodynamics.js';
import { createIdealGasMixtureClosure } from './material/idealGasMixtureClosure.js';
import { dyadicFromNumber } from './material/exactDyadicInventory.js';
import { createSphExactMassFormat, encodeSphExactMass, encodeSphExactMassUnits,
  decodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

const COLD_GAS_MASS_FORMAT = createSphExactMassFormat();
const DRY_AIR_SPECIES = new Set(SPH_ENVIRONMENT_DRY_AIR.species.map((row) => row.material));
const isDrySpecies = (material) => DRY_AIR_SPECIES.has(material);

const volume = box => box.max.map((v, i) => v - box.min[i]).reduce((a, b) => a * b, 1);

// A piece thinner than the f32 position spacing at the box scale cannot be
// located by the GPU (its faces round to the same coordinate). Such pieces are
// binary64 rounding slivers where a body face meets a cell face, not gas
// control volumes: kept, they become rows of a few molecules whose stencil
// contributions underflow f32. They are dropped; allocateSpeciesMass then
// gives the declared species mass exactly to the resolvable cells.
const F32_POSITION_RESOLUTION = 2 ** -23;
const resolvable = (box, resolutionM) => box.max.every((v, i) => v - box.min[i] > resolutionM);

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
    return { massKg: mass, units: n, exponent,
      words: Array.from(encodeSphExactMassUnits(n, COLD_GAS_MASS_FORMAT)) };
  });
}

// First-class air, slice 3: the dry species of one cell as one mixture parcel.
// Units share the run quantum, so the parcel's exact mass is the exact sum of
// its species allocations and the per-species totals are unchanged.
function mixtureParcelMass(speciesAllocations) {
  const exponent = speciesAllocations[0].exponent;
  if (speciesAllocations.some((row) => row.exponent !== exponent)) {
    throw new RangeError('Mixture parcel species must share the run mass quantum');
  }
  const units = speciesAllocations.reduce((sum, row) => sum + row.units, 0n);
  return { massKg: Number(units) * 2 ** exponent,
    words: Array.from(encodeSphExactMassUnits(units, COLD_GAS_MASS_FORMAT)) };
}

// First-class air, slice 2a (plan/todo/first-class-air.md): graded seeding.
// Air resolution follows proximity to other materials, as SS does for every
// carrier: an octree over each coarse cell splits any cell that lies within
// one of its own edges of a condensed body until the cell edge reaches
// `refineEdgeM` (the condensed carrier pitch). Open air stays coarse; cells
// touching ice or iron match the condensed spacing. Species totals stay exact:
// allocateSpeciesMass distributes each declared coefficient over the leaves.
const MAX_GRADED_ENVIRONMENT_LEAVES = 200_000;

function boxDistance(a, b) {
  let sum = 0;
  for (let axis = 0; axis < 3; axis++) {
    const gap = Math.max(0, a.min[axis] - b.max[axis], b.min[axis] - a.max[axis]);
    sum += gap * gap;
  }
  return Math.sqrt(sum);
}

function gradedCells(root, occupiedBoxes, refineEdgeM) {
  const leaves = [];
  const stack = [root];
  while (stack.length) {
    const cell = stack.pop();
    const edge = Math.max(...cell.max.map((v, i) => v - cell.min[i]));
    const near = occupiedBoxes.some(solid => boxDistance(cell, solid) <= edge);
    if (near && edge > refineEdgeM * (1 + 1e-9)) {
      const mid = cell.min.map((v, i) => (v + cell.max[i]) / 2);
      for (let octant = 0; octant < 8; octant++) {
        const min = [0, 1, 2].map(i => ((octant >> i) & 1) ? mid[i] : cell.min[i]);
        const max = [0, 1, 2].map(i => ((octant >> i) & 1) ? cell.max[i] : mid[i]);
        stack.push({ min, max });
      }
      continue;
    }
    leaves.push(cell);
    if (leaves.length > MAX_GRADED_ENVIRONMENT_LEAVES) {
      throw new RangeError('Graded environment exceeds the admitted leaf budget; raise refineEdgeM');
    }
  }
  // Deterministic order independent of the stack walk.
  return leaves.sort((a, b) => (a.min[0] - b.min[0]) || (a.min[1] - b.min[1]) || (a.min[2] - b.min[2]));
}

export const SPH_ENVIRONMENT_AIR_PARCEL_MODES = Object.freeze(['species', 'mixture']);
export const SPH_ENVIRONMENT_AIR_MIXTURE_MATERIAL = 'air';

// The mixture parcel material: an exact ideal-gas mixture of the dry-air
// species closures (CIPM-2007 normalized major species). It replaces the
// legacy derived 'air' closure in mixture mode so the parcel material agrees
// with the species models it is built from.
export function createSphEnvironmentAirMixtureClosure(closuresByMaterial) {
  return createIdealGasMixtureClosure({
    material: SPH_ENVIRONMENT_AIR_MIXTURE_MATERIAL,
    compositionId: SPH_ENVIRONMENT_DRY_AIR.id,
    components: SPH_ENVIRONMENT_DRY_AIR.species.map(({ material, moleFraction }) => {
      const closure = closuresByMaterial[material];
      if (!closure) throw new TypeError(`Mixture air requires the ${material} closure`);
      return { material, moleFraction, closure };
    })
  });
}

export function buildSphEnvironmentParticles({ environment, materialProperties, boxDimensionsM,
  occupiedBoxes = [], cellsPerAxis = 2, firstDomainId = 1, ledgerParcels = false,
  refineEdgeM = null, airParcels = 'species' } = {}) {
  if (!SPH_ENVIRONMENT_AIR_PARCEL_MODES.includes(airParcels)) {
    throw new RangeError(`Environment airParcels must be one of ${SPH_ENVIRONMENT_AIR_PARCEL_MODES.join(', ')}`);
  }
  const input = normalizeSphEnvironmentInitialization(environment);
  // Dry nuclei are admitted only on the G2 integer-ledger route, whose
  // vapor-parcel exchange debits actual vapor and energy for every quantum of
  // water they take up (plan/todo/g2-integer-ledger-proposal.md, Phase 4).
  if (input.nuclei.numberConcentrationPerM3 > 0 && !ledgerParcels) {
    throw new RangeError('Dry nuclei allocation and activation are not yet admitted; positive nuclei input cannot be ignored');
  }
  if (input.nuclei.numberConcentrationPerM3 > 0 && !(input.nuclei.seed.activationModel.hygroscopicity >= 0)) {
    throw new RangeError('Ledger nuclei require a declared kappa-Koehler hygroscopicity');
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
  const resolutionM = Math.max(...boxDimensionsM) * F32_POSITION_RESOLUTION;
  // Resolve total physical free volume independently of numerical grid size.
  let free = [box];
  for (const solid of occupiedBoxes) free = free.flatMap(part => subtractBox(part, solid));
  free = free.filter(part => resolvable(part, resolutionM));
  const freeVolumeM3 = free.reduce((sum, part) => sum + volume(part), 0);
  const inventory = buildSphEnvironmentGasInputs({ environment: input, materialProperties, freeVolumeM3 });
  if (input.mode === 'vacuum') return { particles: [], inventory, cells: [] };
  const refine = refineEdgeM == null ? null : Number(refineEdgeM);
  if (refine !== null && !(Number.isFinite(refine) && refine > 0)) {
    throw new RangeError('Environment refineEdgeM must be a positive finite length');
  }
  const models = resolveSphPhaseCaloricModels(materialProperties), cells = [];
  for (let x = 0; x < cellsPerAxis; x++) for (let y = 0; y < cellsPerAxis; y++) for (let z = 0; z < cellsPerAxis; z++) {
    const index = [x, y, z];
    const root = { min: index.map((v, i) => boxDimensionsM[i] * v / cellsPerAxis),
      max: index.map((v, i) => boxDimensionsM[i] * (v + 1) / cellsPerAxis) };
    for (const leaf of refine === null ? [root] : gradedCells(root, occupiedBoxes, refine)) {
      let parts = [leaf];
      for (const solid of occupiedBoxes) parts = parts.flatMap(part => subtractBox(part, solid));
      cells.push(...parts.filter(part => resolvable(part, resolutionM)));
    }
  }
  const weights = cells.map(volume), particles = [];
  // One gas row per carrier and cell. A row's current volume is the volume its
  // gas occupies at the cell's total pressure, m R_s T / p (Amagat): the
  // mechanics EOS is referenced to the ambient pressure, so a row seeded at
  // that volume starts at zero gauge, and a cell's rows sum to the cell. (A
  // Dalton row filling the whole cell sat far below its ambient density: the
  // EOS mis-read its pressure and buoyancy credited it with the whole cell.)
  // `composition` carries the species of a mixture parcel exactly (slice 3).
  const pushGasRow = ({ material, partialPressurePa, temperatureK, meanVelocityMPerS,
    specificInternalEnergyJPerKg, massKg, words, domain, index, cell, composition = null }) => {
    const model = models[material];
    const branch = phaseCaloricBranches(model).find(b => b.phase === 'gas');
    const referenceVolume = Math.fround(massKg) / Math.fround(branch.densityKgPerM3);
    const currentVolume = massKg * model.specificGasConstantJPerKgK * temperatureK / input.totalPressurePa;
    const J = currentVolume / referenceVolume, stretch = Math.cbrt(J);
    const radius = 0.5 * Math.cbrt(referenceVolume);
    particles.push({ material, role: 'environment-gas',
      initialBodyId: null, initialBodyDomainId: domain, renderDomainId: domain,
      renderDomainKey: `environment:${material}`, initialBodyParticleIndex: index,
      x: cell.min.map((v, i) => (v + cell.max[i]) / 2), v: [...meanVelocityMPerS],
      massKg, coldExactMassWords: words, temperatureK, pressurePa: partialPressurePa,
      specificInternalEnergyJPerKg,
      phaseCaloric: { phaseId: 3, phaseFractions: [0, 0, 1, 0] },
      restDensityKgPerM3: branch.densityKgPerM3,
      phaseVolumeReferenceDensityKgPerM3: branch.densityKgPerM3,
      phaseVolumeReferenceMassKg: massKg, phaseVolumeReferenceVolumeM3: referenceVolume,
      phaseVolumeReferenceMassRatio: 1, phaseVolumeReferencePhase: 'gas',
      phaseVolumeReferenceDensitySource: 'explicit-environment-caloric-reference',
      initialCellVolumeM3: volume(cell), continuumCellVolumeM3: volume(cell),
      currentCellVolumeM3: currentVolume, initialParticleSpacingM: Math.cbrt(volume(cell)),
      visualRestVolumeM3: referenceVolume, visualParticleRadiusM: radius,
      visualRestParticleRadiusM: radius, particleRadiusM: radius, restParticleRadiusM: radius,
      currentParticleRadiusM: radius, mpmVolume0: referenceVolume, mpmJ: J,
      mpmF: [stretch, 0, 0, 0, stretch, 0, 0, 0, stretch],
      ...(composition ? { gasComposition: composition } : {}) });
  };
  const allocations = inventory.gasSpecies.map((row) => allocateSpeciesMass(row.massKg, weights));
  const mixtureMaterial = SPH_ENVIRONMENT_AIR_MIXTURE_MATERIAL;
  const condensable = (row) => !isDrySpecies(row.material);
  if (airParcels === 'mixture') {
    const mixtureModel = models[mixtureMaterial];
    if (!mixtureModel) {
      throw new TypeError('Mixture air parcels require the derived air mixture material');
    }
    const dry = inventory.gasSpecies.map((row, species) => ({ row, species }))
      .filter(({ row }) => !condensable(row));
    const temperatureK = dry[0].row.temperatureK;
    if (temperatureK < mixtureModel.minTemperatureK || temperatureK > mixtureModel.maxTemperatureK) {
      throw new RangeError('Mixture air initialization is outside its declared ideal-gas caloric domain');
    }
    // The same caloric evaluation the species rows use (u = u_ref + Cv (T - T_ref)).
    const specificInternalEnergyJPerKg = mixtureModel.vaporReferenceInternalEnergyJPerKg
      + mixtureModel.vaporCvJPerKgK * (temperatureK - mixtureModel.referenceTemperatureK);
    cells.forEach((cell, index) => {
      const parts = dry.map(({ row, species }) => ({ row, allocation: allocations[species][index] }));
      const { massKg, words } = mixtureParcelMass(parts.map((part) => part.allocation));
      pushGasRow({ material: mixtureMaterial,
        partialPressurePa: dry.reduce((sum, { row }) => sum + row.partialPressurePa, 0),
        temperatureK, meanVelocityMPerS: dry[0].row.meanVelocityMPerS, specificInternalEnergyJPerKg,
        massKg, words, domain: firstDomainId, index, cell,
        composition: Object.freeze({ schema: 'peercompute.ulg.environment-gas-composition.v1',
          compositionId: input.dryAirComposition,
          components: Object.freeze(parts.map(({ row, allocation }) => Object.freeze({
            material: row.material, massKg: allocation.massKg, exactMassWords: allocation.words }))) }) });
    });
  }
  inventory.gasSpecies.forEach((row, species) => {
    if (airParcels === 'mixture' && !condensable(row)) return;
    const masses = allocations[species];
    cells.forEach((cell, index) => {
      const { massKg, words } = masses[index];
      pushGasRow({ material: row.material, partialPressurePa: row.partialPressurePa,
        temperatureK: row.temperatureK, meanVelocityMPerS: row.meanVelocityMPerS,
        specificInternalEnergyJPerKg: row.specificInternalEnergyJPerKg,
        massKg, words, domain: firstDomainId + species + (airParcels === 'mixture' ? 1 : 0), index, cell });
    });
  });
  return { particles, inventory, cells, parcels: ledgerParcels ? buildLedgerNucleiParcels(input, cells) : [] };
}

// One dry parcel per gas cell and size bin. Multiplicity is the integer
// number of nuclei the cell's free volume holds; the parcel's dry-core mass
// is that many cores, in exact run-format words. Water starts at exact zero:
// hydration is the exchange's job.
function buildLedgerNucleiParcels(input, cells) {
  const nuclei = input.nuclei;
  if (!(nuclei.numberConcentrationPerM3 > 0)) return [];
  const seed = nuclei.seed, parcels = [];
  cells.forEach((cell, cellIndex) => {
    const center = cell.min.map((v, i) => (v + cell.max[i]) / 2);
    for (const bin of seed.sizeDistribution) {
      const multiplicity = Math.round(nuclei.numberConcentrationPerM3 * volume(cell) * bin.numberFraction);
      if (multiplicity < 1) continue;
      const coreMassKg = seed.densityKgPerM3 * 4 / 3 * Math.PI * bin.dryRadiusM ** 3;
      const dryMassKg = multiplicity * coreMassKg;
      parcels.push(Object.freeze({ cellIndex, x: center, multiplicity, dryRadiusM: bin.dryRadiusM,
        densityKgPerM3: seed.densityKgPerM3, hygroscopicity: seed.activationModel.hygroscopicity,
        material: seed.material, dryMassKg,
        dryMassWords: Array.from(encodeSphExactMass(Math.fround(dryMassKg), COLD_GAS_MASS_FORMAT)) }));
    }
  });
  return parcels;
}
