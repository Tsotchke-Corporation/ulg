// Constant-Cp ideal gas: c^2 = gamma * (R / M) * T. Limits are numerical
// controls, not material properties. Never rescale an already clamped c(Tref).
// https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/speed-of-sound-interactive/
export const SPH_GAS_CONSTITUTIVE_SCHEMA = 'ulg.gas-constitutive.constant-cp.v1';
export const SPH_GAS_CONSTITUTIVE_FLOATS = 4;
export const SPH_GAS_CONSTITUTIVE_LAYOUT = Object.freeze([
  'gammaRSpecificM2PerS2K', 'soundSpeedScale', 'cflMaxSoundSpeedMPerS', 'minGasSoundSpeedMPerS'
]);

export function compileSphGasConstitutive(properties, phase, {
  soundSpeedScale = 1, cflMaxSoundSpeedMPerS = 0, minGasSoundSpeedMPerS = 40
} = {}) {
  if (String(phase?.name).toLowerCase() !== 'gas') return [0, 0, 0, 0];
  const mass = Number(properties?.molarMassKgPerMol);
  if (!(mass > 0) || !Number.isFinite(mass)) {
    throw new RangeError('Gas constitutive data requires a positive finite molar mass');
  }
  const r = 8.314462618 / mass;
  const cp = Number(phase?.cpJPerKgK);
  // Preserve the pre-existing gamma fallback for legacy material closures.
  // Explicit condensable caloric models separately require positive Cv.
  const gamma = Number.isFinite(cp) && cp > r ? cp / (cp - r) : 1.33;
  const row = [gamma * r, soundSpeedScale, cflMaxSoundSpeedMPerS, minGasSoundSpeedMPerS].map(Math.fround);
  if (!sphGasConstitutiveRowValid(row)) throw new RangeError('Invalid packed gas constitutive parameters');
  return row;
}

export function sphGasConstitutiveRowValid(row) {
  return row?.length === 4 && Array.from(row).every(Number.isFinite)
    && row[0] > 0 && row[1] >= 0 && row[2] >= 0 && row[3] >= 0
    && (row[1] > 0 || row[2] > 0 || row[3] > 0);
}

// A negative result is an invalid live state, never a usable sound speed.
export function evaluateSphGasSoundSpeed(row, temperatureK) {
  if (!sphGasConstitutiveRowValid(row) || !(temperatureK > 0) || !Number.isFinite(temperatureK)) return -1;
  const c2 = Math.fround(row[0] * Math.fround(temperatureK));
  if (!(c2 > 0) || !Number.isFinite(c2)) return -1;
  const realC = Math.sqrt(c2);
  // Existing CFL semantics: a positive cap replaces global scaling. The gas
  // floor is applied last (and can exceed the cap); preserve that precedence.
  const c = Math.fround(Math.max(row[2] > 0 ? Math.min(realC, row[2]) : realC * row[1], row[3]));
  return Number.isFinite(c) && c > 0 ? c : -1;
}

// One vec4 per 12-float phase row. Non-gas rows have an exact zero sentinel.
export function assertSphGasConstitutiveRows(phases, rows, count) {
  if (!(phases instanceof Float32Array) || !(rows instanceof Float32Array)
      || !Number.isSafeInteger(count) || count < 0
      || phases.length < count * 12 || rows.length !== count * 4
      || (typeof SharedArrayBuffer !== 'undefined'
        && (phases.buffer instanceof SharedArrayBuffer || rows.buffer instanceof SharedArrayBuffer))) {
    throw new TypeError('Invalid gas constitutive phase/tail layout');
  }
  for (let i = 0; i < count; i++) {
    const row = rows.subarray(i * 4, i * 4 + 4);
    const gas = phases[i * 12 + 7] === 2;
    if (gas ? !sphGasConstitutiveRowValid(row) : row.some(value => value !== 0)) {
      throw new RangeError(`Invalid gas constitutive row ${i}`);
    }
  }
}

export function assertSphMechanicsGasLayout(table) {
  const count = table?.phaseRecordCount;
  const records = table?.records;
  if (!Number.isSafeInteger(count) || count < 0 || !(records instanceof Float32Array)) {
    throw new TypeError('Invalid mechanics phase layout');
  }
  if (table.gasConstitutiveSchema == null) {
    if (records.length !== count * 12 || table.gasConstitutiveOffsetVec4 != null) {
      throw new RangeError('Legacy mechanics table has an unrecognized tail');
    }
    return 0;
  }
  if (table.gasConstitutiveSchema !== SPH_GAS_CONSTITUTIVE_SCHEMA
      || records.length !== count * 16 || table.gasConstitutiveOffsetVec4 !== count * 3) {
    throw new RangeError('Invalid mechanics gas constitutive tail');
  }
  assertSphGasConstitutiveRows(records, records.subarray(count * 12), count);
  return table.gasConstitutiveOffsetVec4;
}

export function assertSphReactionGasLayout(table, { authenticatedCombinedLength = null } = {}) {
  const sections = ['records', 'productPhaseRecords', 'reactionHeaders', 'reactantTermRecords',
    'productTermRecords', 'gasProductRecords', 'atomTermRecords'];
  const prefixFloats = sections.reduce((sum, key) => sum + (table?.[key]?.length ?? 0), 0);
  if (table?.gasConstitutiveSchema == null) {
    if (table?.gasConstitutiveRecords != null || table?.gasConstitutiveOffsetVec4 != null) {
      throw new RangeError('Unrecognized reaction gas constitutive tail');
    }
    if (table?.combinedRecords != null && (!(table.combinedRecords instanceof Float32Array)
        || table.combinedRecords.length !== prefixFloats
        // Legacy callers may omit the redundant vec4 count. The exact byte
        // endpoint still rejects a stripped version tag or an unknown suffix.
        || (table.combinedRecordCount != null && table.combinedRecordCount !== prefixFloats / 4))) {
      throw new RangeError('Legacy reaction table has an unrecognized tail');
    }
    return 0;
  }
  const rows = table.gasConstitutiveRecords;
  for (const key of sections) {
    if (!(table[key] instanceof Float32Array)) throw new TypeError('Invalid reaction gas prefix');
  }
  // Only the private reaction-energy authority may supply a longer exact
  // endpoint, which it additionally checks byte-for-byte against its snapshot.
  const gasEnd = prefixFloats + table.productPhaseCount * 4;
  const expectedEnd = authenticatedCombinedLength ?? gasEnd;
  if (table.gasConstitutiveSchema !== SPH_GAS_CONSTITUTIVE_SCHEMA
      || table.gasConstitutiveOffsetVec4 !== prefixFloats / 4
      || !(table.combinedRecords instanceof Float32Array)
      || expectedEnd < gasEnd || table.combinedRecords.length !== expectedEnd
      || table.combinedRecordCount !== expectedEnd / 4
      || (typeof SharedArrayBuffer !== 'undefined' && table.combinedRecords.buffer instanceof SharedArrayBuffer)) {
    throw new RangeError('Invalid reaction gas constitutive tail');
  }
  assertSphGasConstitutiveRows(table.productPhaseRecords, rows, table.productPhaseCount);
  for (let i = 0; i < rows.length; i++) {
    if (!Object.is(rows[i], table.combinedRecords[prefixFloats + i])) {
      throw new RangeError('Reaction gas constitutive tail differs from combined upload');
    }
  }
  return table.gasConstitutiveOffsetVec4;
}
