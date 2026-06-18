export const MATERIAL_PROPERTY_BANK_SCHEMA = 'peercompute.ulg.material-property-bank.elements.v0';
export const MATERIAL_PROPERTY_BANK_RECORD_SCHEMA = 'peercompute.ulg.material-property-bank.element.v0';
export const MATERIAL_PROPERTY_BANK_WARM_INPUT_SCHEMA = 'peercompute.ulg.material-property-bank.warm-input.v0';

const ACCEPTED_PROVENANCE_STATUSES = new Set([
  'precomputed-json-bank',
  'reference-fallback',
  'reduced-estimate',
  'exact-constant'
]);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

export function assertMaterialPropertyBankRecord(record) {
  if (record?.schema !== MATERIAL_PROPERTY_BANK_RECORD_SCHEMA) {
    throw new TypeError('material property bank record has an unknown schema');
  }
  if (!Number.isInteger(record.atomicNumber) || record.atomicNumber < 1 || record.atomicNumber > 118) {
    throw new RangeError(`material property bank record has invalid atomic number: ${record.atomicNumber}`);
  }
  if (!Array.isArray(record.phases) || record.phases.length === 0) {
    throw new Error(`${record.symbol || 'element'} material property bank record has no phases`);
  }
  if (!Array.isArray(record.provenance) || record.provenance.length === 0) {
    throw new Error(`${record.symbol || 'element'} material property bank record has no provenance`);
  }
  for (const entry of record.provenance) {
    if (!ACCEPTED_PROVENANCE_STATUSES.has(entry.status)) {
      throw new Error(`${record.symbol} material property bank provenance has unknown status: ${entry.status}`);
    }
    for (const key of ['family', 'source', 'method', 'units', 'referenceState']) {
      if (typeof entry[key] !== 'string' || entry[key].length === 0) {
        throw new Error(`${record.symbol} material property bank provenance missing ${key}`);
      }
    }
  }
  return true;
}

export function normalizeMaterialPropertyBank(bank) {
  if (bank?.schema !== MATERIAL_PROPERTY_BANK_SCHEMA) {
    throw new TypeError('material property bank has an unknown schema');
  }
  if (!Number.isInteger(bank.schemaVersion) || bank.schemaVersion < 1) {
    throw new RangeError('material property bank schemaVersion must be a positive integer');
  }
  const records = (bank.records || []).map((record) => {
    assertMaterialPropertyBankRecord(record);
    return cloneRecord(record);
  });
  const bySymbol = new Map();
  const byAtomicNumber = new Map();
  for (const record of records) {
    if (bySymbol.has(record.symbol)) throw new Error(`duplicate material property bank symbol: ${record.symbol}`);
    if (byAtomicNumber.has(record.atomicNumber)) {
      throw new Error(`duplicate material property bank atomic number: ${record.atomicNumber}`);
    }
    bySymbol.set(record.symbol, record);
    byAtomicNumber.set(record.atomicNumber, record);
  }
  return {
    schema: bank.schema,
    schemaVersion: bank.schemaVersion,
    bankFamily: bank.bankFamily,
    generatorFingerprint: bank.generatorFingerprint,
    generatedAt: bank.generatedAt || null,
    recordCount: records.length,
    records,
    bySymbol,
    byAtomicNumber,
    strictSourceOfTruth: false,
    provenanceMode: 'precomputed-json-bank-warm-input'
  };
}

export function materialPropertyBankRecordBySymbol(bank, symbol) {
  const normalized = bank?.bySymbol instanceof Map ? bank : normalizeMaterialPropertyBank(bank);
  return normalized.bySymbol.get(symbol) || null;
}

export function materialPropertyBankWarmInput(record, {
  temperatureK = record?.referenceState?.temperatureK,
  pressurePa = record?.referenceState?.pressurePa
} = {}) {
  assertMaterialPropertyBankRecord(record);
  return {
    schema: MATERIAL_PROPERTY_BANK_WARM_INPUT_SCHEMA,
    status: 'material-property-bank-warm-input-ready',
    strictSourceOfTruth: false,
    material: record.symbol,
    atomicNumber: record.atomicNumber,
    schemaVersion: 1,
    bankRecordSchema: record.schema,
    temperatureK: finiteNumber(temperatureK, record.referenceState.temperatureK),
    pressurePa: finiteNumber(pressurePa, record.referenceState.pressurePa),
    phaseCount: record.phases.length,
    targetNeighborCount: record.mechanics.targetNeighborCount,
    spacingPolicy: record.mechanics.spacingPolicy || null,
    pbr: cloneRecord(record.opticalPbr),
    provenance: {
      source: 'precomputed-json-bank',
      generatorFingerprint: null,
      entries: cloneRecord(record.provenance)
    }
  };
}
