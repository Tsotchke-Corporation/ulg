import { isCondensableThermodynamics } from '../material/condensableThermodynamics.js';

// An explicit new segment kind, not an equilibrium plateau or a pressure-law
// overload. Material/response row widths and graph bindings stay unchanged.
export const SPH_THERMAL_PHASE_CALORIC_SEGMENT_TYPE = 3;

export function hasCondensableCaloricRows(table) {
  const rows = table?.segments ?? table?.responses;
  const stride = table?.segments ? 12 : 16;
  for (let offset = 1; offset < (rows?.length ?? 0); offset += stride) {
    if (rows[offset] === SPH_THERMAL_PHASE_CALORIC_SEGMENT_TYPE) return true;
  }
  return false;
}

export function condensableCaloricSegments(model) {
  if (!isCondensableThermodynamics(model)) {
    throw new TypeError('Explicit created condensable thermodynamic model required');
  }
  return ['liquid', 'gas'].map((phase) => {
    const prefix = phase === 'gas' ? 'vapor' : 'liquid';
    const eStart = Math.fround(model[`${prefix}EnergyMinJPerKg`]);
    const eEnd = Math.fround(model[`${prefix}EnergyMaxJPerKg`]);
    const tLo = Math.fround(model.minTemperatureK);
    const tHi = Math.fround(model.maxTemperatureK);
    const restDensityKgPerM3 = Math.fround(phase === 'liquid'
      ? model.liquidDensityKgPerM3
      : model.referencePressurePa
        / (model.specificGasConstantJPerKgK * model.referenceTemperatureK));
    // Packed endpoints define the actual GPU inverse. Reject collapsed f32
    // intervals and energy zeros that cannot represent the declared Cv to
    // this fixed numerical budget. Never shift the caller's energy origin.
    const packedCv = (eEnd - eStart) / (tHi - tLo);
    const energySpanF32 = Math.fround(eEnd - eStart);
    const temperatureSlopeF32 = Math.fround(Math.fround(tHi - tLo) / energySpanF32);
    const cv = model[`${prefix}CvJPerKgK`];
    const temperatureErrorBudgetK = Math.max(1e-4, model.maxTemperatureK * 1e-6);
    const endpointTemperatureErrorK = Math.max(
      Math.abs(eStart - model[`${prefix}EnergyMinJPerKg`]) / cv
        + Math.abs(tLo - model.minTemperatureK),
      Math.abs(eEnd - model[`${prefix}EnergyMaxJPerKg`]) / cv
        + Math.abs(tHi - model.maxTemperatureK)
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
      type: 'phase', phase, phaseCaloric: true, eStart, eEnd, tLo, tHi,
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
    if (table.records[base + 3] !== 1 || count !== 2
      || !Number.isInteger(start) || start < 0 || (start + count) * stride > rows.length
      || !Number.isInteger(materialId) || materialId < 1 || materialId > 16777215
      || !Number.isFinite(energy) || (phaseId !== 2 && phaseId !== 3)
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
      if (rows[row] !== materialId || rows[row + 1] !== SPH_THERMAL_PHASE_CALORIC_SEGMENT_TYPE
        || rows[row + (stride === 12 ? 10 : 3)] !== 1
        || (from !== 2 && from !== 3) || from !== to || (phases & (1 << from))
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
    return selected;
  }
  return null;
}

export function assertNoCondensableCaloricReactionTable(table) {
  if (hasCondensableCaloricRows(table)) {
    throw new TypeError('Phase-specific caloric reaction energy is not yet admitted');
  }
}
