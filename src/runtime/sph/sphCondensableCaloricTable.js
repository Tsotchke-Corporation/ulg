import { phaseCaloricBranches } from '../material/condensableThermodynamics.js';

// An explicit new segment kind, not an equilibrium plateau or a pressure-law
// overload. Material/response row widths and graph bindings stay unchanged.
export const SPH_THERMAL_PHASE_CALORIC_SEGMENT_TYPE = 3;
export const SPH_THERMAL_SOLID_LIQUID_GAS_CALORIC_SEGMENT_TYPE = 4;
export const SPH_THERMAL_GAS_ONLY_CALORIC_SEGMENT_TYPE = 5;
export const SPH_CALORIC_PHASE_IDS = Object.freeze({ solid: 1, liquid: 2, gas: 3 });
// Distinct tags preserve the complete required roster of each model. Merely
// reducing the count of an existing two-phase table must remain invalid.
const layouts = Object.freeze({
  3: Object.freeze({ count: 2, mask: 12 }),
  4: Object.freeze({ count: 3, mask: 14 }),
  5: Object.freeze({ count: 1, mask: 8 })
});
export function isPhaseCaloricSegmentType(kind) { return typeof kind === 'number' && Object.hasOwn(layouts, kind); }

export function hasCondensableCaloricRows(table) {
  const rows = table?.segments ?? table?.responses;
  const stride = table?.segments ? 12 : 16;
  for (let offset = 1; offset < (rows?.length ?? 0); offset += stride) {
    if (isPhaseCaloricSegmentType(rows[offset])) return true;
  }
  return false;
}

export function condensableCaloricSegments(model) {
  const branches = phaseCaloricBranches(model);
  const caloricSegmentType = branches.length === 3 ? SPH_THERMAL_SOLID_LIQUID_GAS_CALORIC_SEGMENT_TYPE
    : branches.length === 1 ? SPH_THERMAL_GAS_ONLY_CALORIC_SEGMENT_TYPE : SPH_THERMAL_PHASE_CALORIC_SEGMENT_TYPE;
  return branches.map((branch) => {
    const { phase } = branch;
    const eStart = Math.fround(branch.energyMinJPerKg);
    const eEnd = Math.fround(branch.energyMaxJPerKg);
    const tLo = Math.fround(branch.minTemperatureK);
    const tHi = Math.fround(branch.maxTemperatureK);
    const restDensityKgPerM3 = Math.fround(branch.densityKgPerM3);
    // Packed endpoints define the actual GPU inverse. Reject collapsed f32
    // intervals and energy zeros that cannot represent the declared Cv to
    // this fixed numerical budget. Never shift the caller's energy origin.
    const packedCv = (eEnd - eStart) / (tHi - tLo);
    const energySpanF32 = Math.fround(eEnd - eStart);
    const temperatureSlopeF32 = Math.fround(Math.fround(tHi - tLo) / energySpanF32);
    const cv = branch.cvJPerKgK;
    const temperatureErrorBudgetK = Math.max(1e-4, branch.maxTemperatureK * 1e-6);
    const endpointTemperatureErrorK = Math.max(
      Math.abs(eStart - branch.energyMinJPerKg) / cv
        + Math.abs(tLo - branch.minTemperatureK),
      Math.abs(eEnd - branch.energyMaxJPerKg) / cv
        + Math.abs(tHi - branch.maxTemperatureK)
    );
    if (![eStart, eEnd, tLo, tHi, restDensityKgPerM3, packedCv].every(Number.isFinite)
      || !(eStart < eEnd) || !(0 < tLo && tLo < tHi)
      || !(restDensityKgPerM3 > 0)
      || !Number.isFinite(energySpanF32) || !(energySpanF32 > 0)
      || !Number.isFinite(temperatureSlopeF32) || !(temperatureSlopeF32 > 0)
      || endpointTemperatureErrorK > temperatureErrorBudgetK
      || Math.abs(packedCv / cv - 1) > 1e-4) {
      throw new RangeError('Unrepresentable f32 phase caloric domain or heat capacity');
    }
    return {
      type: 'phase', phase, phaseCaloric: true, caloricSegmentType, eStart, eEnd, tLo, tHi,
      restDensityKgPerM3,
      caloricEnergyBasis: model.energyBasis,
      caloricProvenance: model.provenance
    };
  });
}

// null means legacy material; -1 means an explicit material was REJECTED.
// This distinction is mandatory: failed explicit selection must never fall
// back to the old global energy ladder. Layout is shared up through lane7.
export function selectCondensableCaloricRow(table, materialId, energy, phaseId, fractions) {
  const rows = table?.segments ?? table?.responses;
  const stride = table?.segments ? 12 : 16;
  let matchingRecords = 0;
  for (let record = 0; record < table.materialCount; record += 1) {
    if (table.records[record * 8] === materialId) matchingRecords += 1;
  }
  if (matchingRecords > 1) return -1;
  for (let record = 0; record < table.materialCount; record += 1) {
    const base = record * 8;
    if (table.records[base] !== materialId) continue;
    const start = table.records[base + 1];
    const count = table.records[base + 2];
    if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count <= 0
      || (start + count) * stride > rows.length) return -1;
    let explicit = false;
    for (let local = 0; local < count; local += 1) {
      const kind = rows[(start + local) * stride + 1];
      if (kind !== 1 && kind !== 2) {
        explicit = true;
      }
    }
    if (!explicit) return null;
    const kind = rows[start * stride + 1];
    const layout = layouts[kind];
    if (!layout || table.records[base + 3] !== 1 || count !== layout.count
      || !Number.isInteger(start) || start < 0 || (start + count) * stride > rows.length
      || !Number.isInteger(materialId) || materialId < 1 || materialId > 16777215
      || !Number.isFinite(energy) || ![1, 2, 3].includes(phaseId) || !(layout.mask & (1 << phaseId))
      || fractions?.length !== 4
      || !Array.from(fractions).every((value, lane) => value === (lane === phaseId - 1 ? 1 : 0))) {
      return -1;
    }
    let selected = -1;
    let phases = 0;
    for (let local = 0; local < count; local += 1) {
      const row = (start + local) * stride;
      const from = rows[row + (stride === 12 ? 2 : 6)];
      const to = rows[row + (stride === 12 ? 3 : 7)];
      if (rows[row] !== materialId || rows[row + 1] !== kind
        || rows[row + (stride === 12 ? 10 : 3)] !== 1
        || ![1, 2, 3].includes(from) || !(layout.mask & (1 << from)) || from !== to || (phases & (1 << from))
        || !Number.isFinite(rows[row + 4]) || !Number.isFinite(rows[row + 5])
        || !(rows[row + 4] < rows[row + 5])
        || !Number.isFinite(Math.fround(rows[row + 5] - rows[row + 4]))) return -1;
      if (stride === 12 && (
        !Number.isFinite(rows[row + 6]) || !Number.isFinite(rows[row + 7])
        || !(0 < rows[row + 6] && rows[row + 6] < rows[row + 7])
        || !Number.isFinite(rows[row + 8]) || !(rows[row + 8] > 0)
        || rows[row + 8] !== rows[row + 9]
      )) return -1;
      if (stride === 16 && (
        !Number.isInteger(rows[row + 2]) || rows[row + 2] < 0
        || !Number.isFinite(rows[row + 8]) || !(rows[row + 8] > 0)
        || rows[row + 8] !== rows[row + 9]
        || rows[row + 10] !== 1 || rows[row + 11] !== 1
        || rows[row + 12] !== 0 || rows[row + 13] !== 1
        || rows[row + 14] !== 0 || rows[row + 15] !== 0
      )) return -1;
      phases |= 1 << from;
      if (from === phaseId && energy >= rows[row + 4] && energy <= rows[row + 5]) {
        selected = start + local;
      }
    }
    return phases === layout.mask ? selected : -1;
  }
  return null;
}

export function assertNoCondensableCaloricReactionTable(table) {
  if (hasCondensableCaloricRows(table)) {
    throw new TypeError('Phase-specific caloric reaction energy is not yet admitted');
  }
}
