import { stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K, phaseCaloricBranches }
  from '../material/condensableThermodynamics.js';
import { condensableCaloricSegments, isPhaseCaloricSegmentType, SPH_CALORIC_PHASE_IDS }
  from './sphCondensableCaloricTable.js';

const PHASES = ['solid', 'liquid', 'gas', 'plasma'];

export function condensableInitializationProperties(model) {
  return [model.molarMassKgPerMol, ...phaseCaloricBranches(model).map((branch) => branch.cpJPerKgK)].map(Math.fround);
}

const signature = (entries) => JSON.stringify(entries.sort((a, b) => a[0] - b[0]));
const caloricRow = (id, segment) => {
  const phase = SPH_CALORIC_PHASE_IDS[segment.phase];
  return [id, segment.caloricSegmentType, phase, phase, segment.eStart, segment.eEnd, segment.tLo, segment.tHi,
    segment.restDensityKgPerM3, segment.restDensityKgPerM3, 1];
};

// This is a cold-input consistency declaration, not a claim that arbitrary
// raw packed ABI rows are authenticated. Recompute the thermal side from its
// live rows (not cached metadata alone), so a table from another energy zero,
// branch/domain or material model cannot be silently paired with these seeds.
export function assertSphCondensableInitializationMatches(sph, mls = null, table = null) {
  const sphSignature = sph?.phaseCaloricInitializationSignature;
  const mlsSignature = mls?.phaseCaloricInitializationSignature;
  if (mls && (sphSignature != null || mlsSignature != null) && sphSignature !== mlsSignature) {
    throw new TypeError('SPH and MLS initialization caloric models differ');
  }
  if (sphSignature == null || table == null) return;
  if (!(table.records instanceof Float32Array) || !(table.segments instanceof Float32Array)
    || !Number.isInteger(table.materialCount) || table.materialCount < 0
    || table.materialCount * 8 > table.records.length) {
    throw new TypeError('Malformed explicit caloric initialization table');
  }
  const entries = [];
  for (let record = 0; record < table.materialCount; record += 1) {
    const base = record * 8;
    const id = table.records[base], start = table.records[base + 1], count = table.records[base + 2];
    if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 0
      || (start + count) * 12 > table.segments.length) {
      throw new TypeError('Malformed explicit caloric initialization row bounds');
    }
    const rows = [];
    for (let local = 0; local < count; local += 1) {
      const offset = (start + local) * 12;
      rows.push(Array.from(table.segments.slice(offset, offset + 11)));
    }
    if (!rows.some((row) => isPhaseCaloricSegmentType(row[1]))) continue;
    const metadata = table.metadata?.filter((entry) => entry.materialId === id);
    if (table.records[base + 3] !== 1 || metadata?.length !== 1) {
      throw new TypeError('Thermal table lacks unique explicit caloric initialization metadata');
    }
    entries.push([id, metadata[0].caloricInitializationProperties, rows.sort((a, b) => a[2] - b[2])]);
  }
  if (typeof sphSignature !== 'string' || sphSignature !== signature(entries)) {
    throw new TypeError('Thermal table differs from the particle initialization caloric model');
  }
}

function samePackedPositive(actual, expected, label) {
  if (typeof actual !== 'number' || !Number.isFinite(actual) || !(actual > 0)
    || Math.fround(actual) !== Math.fround(expected)) {
    throw new TypeError(`Explicit caloric initialization requires matching ${label}`);
  }
}

// Cold packing only. U must ALREADY use the caller's declared model: this
// neither converts an old energy ladder nor chooses a phase from U. Retained
// GPU continuation consumes its phase directly and does not call this helper.
// Keep both particle and mechanics initialization on this single selector.
export function prepareSphCondensableParticleInitialization(materialProperties, models = {}) {
  if (!models || typeof models !== 'object' || Array.isArray(models)) {
    throw new TypeError('Expected explicit condensable models by material');
  }
  const byId = new Map();
  const signatureEntries = [];
  const entries = Object.entries(models);
  if (entries.length) {
    const ids = new Set();
    for (const material of Object.keys(materialProperties)) {
      const id = stableOpticalMaterialId(material);
      if (ids.has(id)) throw new TypeError('Ambiguous explicit caloric material IDs');
      ids.add(id);
    }
  }
  for (const [material, model] of entries) {
    const properties = Object.hasOwn(materialProperties, material) ? materialProperties[material] : null;
    if (!properties?.phases?.length) throw new TypeError(`Unknown explicit caloric material: ${material}`);
    // Reuse the thermal table's model and f32 representability preflight.
    const segments = condensableCaloricSegments(model);
    const branches = phaseCaloricBranches(model);
    samePackedPositive(properties.molarMassKgPerMol, model.molarMassKgPerMol, 'molar mass');
    for (const segment of segments) {
      const phases = properties.phases.filter((phase) => phase.name === segment.phase);
      if (phases.length !== 1) throw new TypeError('Exactly one property record per caloric phase required');
      const branch = branches.find((entry) => entry.phase === segment.phase);
      samePackedPositive(phases[0].cpJPerKgK,
        branch.cpJPerKgK, 'phase Cp');
      if (segment.phase === 'gas') {
        // Equal rounded Cp/M alone is insufficient near Cp=R_s: subtraction
        // can change Cv's sign or magnitude and trigger the legacy gamma
        // fallback. Match the actual mechanics input Cv to the declared
        // model within the same 1e-4 relative budget as caloric compilation.
        const propertyCv = phases[0].cpJPerKgK
          - CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K / properties.molarMassKgPerMol;
        if (!(propertyCv > 0) || !Number.isFinite(propertyCv)
          || Math.abs(propertyCv / model.vaporCvJPerKgK - 1) > 1e-4) {
          throw new TypeError('Explicit caloric initialization requires matching positive vapor Cv');
        }
      }
      // The mechanics table and thermal table must have the same reference
      // volume. Current gas density/pressure remain live mechanics/EOS state.
      samePackedPositive(phases[0].densityKgPerM3, segment.restDensityKgPerM3, 'phase reference density');
    }
    const id = stableOpticalMaterialId(material);
    byId.set(id, segments);
    signatureEntries.push([id, condensableInitializationProperties(model), segments.map((segment) => caloricRow(id, segment))]);
  }
  const initialize = (particle) => {
    const segments = byId.get(stableOpticalMaterialId(particle.material || 'unknown'));
    if (!segments) {
      if (Object.hasOwn(particle, 'phaseCaloric')) {
        throw new TypeError('Explicit phase-caloric particle requires its declared material model');
      }
      return null;
    }
    const { phaseId, phaseFractions } = particle.phaseCaloric || {};
    const segment = segments.find((entry) => SPH_CALORIC_PHASE_IDS[entry.phase] === phaseId);
    if (!segment || ![1, 2, 3].includes(phaseId) || phaseFractions?.length !== 4
      || !Array.from(phaseFractions).every((value, lane) => value === (lane === phaseId - 1 ? 1 : 0))) {
      throw new TypeError(segments.length === 2
        ? 'Explicit caloric particle requires an exact pure liquid/gas phase and fractions'
        : 'Explicit caloric particle requires an exact enrolled pure phase and fractions');
    }
    const sourceU = particle.specificInternalEnergyJPerKg;
    const u = Math.fround(sourceU);
    if (typeof sourceU !== 'number' || !Number.isFinite(sourceU) || !Number.isFinite(u)
      || u < segment.eStart || u > segment.eEnd) {
      throw new RangeError('Initial U outside its explicit packed phase caloric domain');
    }
    if (particle.restDensityKgPerM3 != null) {
      samePackedPositive(particle.restDensityKgPerM3, segment.restDensityKgPerM3, 'particle reference density');
    }
    if (typeof particle.massKg !== 'number' || !Number.isFinite(particle.massKg)
      || particle.massKg < 0 || !Number.isFinite(Math.fround(particle.massKg))
      || (particle.massKg > 0 && !(Math.fround(particle.massKg) > 0))) {
      throw new RangeError('Unrepresentable explicit caloric particle mass');
    }
    const referenceVolumeM3 = Math.fround(particle.massKg) / segment.restDensityKgPerM3;
    if (!Number.isFinite(Math.fround(referenceVolumeM3))
      || (particle.massKg > 0 && !(Math.fround(referenceVolumeM3) > 0))) {
      throw new RangeError('Unrepresentable explicit caloric reference volume');
    }
    if (particle.mpmVolume0 != null) {
      if (particle.massKg === 0 && particle.mpmVolume0 !== 0) {
        throw new RangeError('Empty explicit caloric slot must have zero reference volume');
      }
      if (particle.massKg > 0) samePackedPositive(particle.mpmVolume0,
        referenceVolumeM3, 'particle reference volume');
    }
    const alpha = (u - segment.eStart) / (segment.eEnd - segment.eStart);
    return {
      phaseCaloric: true,
      stablePhase: segment.phase,
      temperatureK: segment.tLo + alpha * (segment.tHi - segment.tLo),
      restDensityKgPerM3: segment.restDensityKgPerM3,
      referenceVolumeM3,
      phaseFractions: Object.fromEntries(PHASES.map((phase, lane) => [phase, phaseFractions[lane]])),
      clamped: null
    };
  };
  initialize.signature = entries.length ? signature(signatureEntries) : null;
  return initialize;
}
