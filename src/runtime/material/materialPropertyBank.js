export const MATERIAL_PROPERTY_BANK_SCHEMA = 'peercompute.ulg.material-property-bank.elements.v0';
export const MATERIAL_PROPERTY_BANK_SCHEMA_VERSION = 1;
export const MATERIAL_PROPERTY_BANK_RECORD_SCHEMA = 'peercompute.ulg.material-property-bank.element.v0';
export const MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_BANK_SCHEMA =
  'peercompute.ulg.material-property-bank.element-crystal-structures.v0';
export const MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_BANK_SCHEMA_VERSION = 1;
export const MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_RECORD_SCHEMA =
  'peercompute.ulg.material-property-bank.element-crystal-structure.v0';
export const MATERIAL_PROPERTY_BANK_WARM_INPUT_SCHEMA = 'peercompute.ulg.material-property-bank.warm-input.v0';
export const MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA =
  'peercompute.ulg.material-property-bank.gpu-warm-input-table.v0';
export const MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_PACKING_TABLE_SCHEMA =
  'peercompute.ulg.material-property-bank.particle-size-packing-table.v0';
export const MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT = Object.freeze([
  'materialId:f32',
  'atomicNumber:f32',
  'temperatureK:f32',
  'pressurePa:f32',
  'targetNeighborCount:f32',
  'phaseCount:f32',
  'baseColorSrgbR:f32',
  'baseColorSrgbG:f32',
  'baseColorSrgbB:f32',
  'metalness:f32',
  'roughness:f32',
  'ior:f32',
  'strictSourceOfTruth:f32',
  'status:f32',
  'pad0:f32',
  'pad1:f32'
]);
export const MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT = Object.freeze([
  'roleId:f32',
  'materialId:f32',
  'temperatureK:f32',
  'pressurePa:f32',
  'particlesPerEdge:f32',
  'spacingM:f32',
  'volumeEquivalentParticleRadiusM:f32',
  'restVolumeM3:f32',
  'densityKgPerM3:f32',
  'targetNeighborCount:f32',
  'smoothingLengthM:f32',
  'strictSourceOfTruth:f32',
  'status:f32',
  'crystalPackingFraction:f32',
  'crystalCoordinationNumber:f32',
  'crystalAtomsPerConventionalCell:f32'
]);

export const MATERIAL_PROPERTY_BANK_GPU_ROW_STATUS = Object.freeze({
  ready: 1,
  missingRoleWarmInput: 255
});

const MATERIAL_PROPERTY_BANK_ROLE_IDS = Object.freeze({
  drop: 1,
  base: 2
});

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

function roleEntriesFromWarmInputs(warmInputs) {
  const roles = warmInputs?.roles || {};
  return Object.entries(roles)
    .filter(([, warmInput]) => warmInput?.schema === MATERIAL_PROPERTY_BANK_WARM_INPUT_SCHEMA)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function emptyWarmInputTable() {
  return {
    schema: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA,
    status: 'material-bank-gpu-warm-input-table-empty',
    rowLayout: [...MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT],
    rowStrideFloats: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length,
    rowStrideBytes: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    rows: new Float32Array(0),
    rowCount: 0,
    metadata: [],
    strictSourceOfTruth: false,
    scientificValidation: false,
    materialValidation: false,
    fullPhysicsValidation: false
  };
}

function emptyParticleSizePackingTable() {
  return {
    schema: MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_PACKING_TABLE_SCHEMA,
    status: 'material-bank-particle-size-packing-empty',
    rowLayout: [...MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT],
    rowStrideFloats: MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT.length,
    rowStrideBytes: MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    rows: new Float32Array(0),
    rowCount: 0,
    metadata: [],
    strictSourceOfTruth: false,
    scientificValidation: false,
    materialValidation: false,
    fullPhysicsValidation: false
  };
}

export function canonicalMaterialPropertyBankSymbol(symbol) {
  if (typeof symbol !== 'string') return null;
  const trimmed = symbol.trim();
  if (!/^[A-Za-z]{1,3}$/.test(trimmed)) return trimmed || null;
  return `${trimmed[0].toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
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

export function assertMaterialPropertyCrystalStructureRecord(record) {
  if (record?.schema !== MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_RECORD_SCHEMA) {
    throw new TypeError('material crystal structure record has an unknown schema');
  }
  if (canonicalMaterialPropertyBankSymbol(record.symbol) !== record.symbol) {
    throw new Error(`material crystal structure record has invalid symbol: ${record.symbol}`);
  }
  if (record.phase !== 'solid') {
    throw new Error(`${record.symbol} material crystal structure has unsupported phase: ${record.phase}`);
  }
  if (typeof record.structureKey !== 'string' || record.structureKey.length === 0) {
    throw new Error(`${record.symbol} material crystal structure has no structureKey`);
  }
  const lattice = record.latticeConstants || {};
  for (const key of ['aAngstrom', 'bAngstrom', 'cAngstrom', 'alphaDeg', 'betaDeg', 'gammaDeg']) {
    if (!Number.isFinite(Number(lattice[key])) || Number(lattice[key]) <= 0) {
      throw new Error(`${record.symbol} material crystal structure has invalid lattice constant ${key}`);
    }
  }
  const unitCell = record.unitCell || {};
  for (const key of ['atomsPerConventionalCell', 'densityKgPerM3']) {
    if (!Number.isFinite(Number(unitCell[key])) || Number(unitCell[key]) <= 0) {
      throw new Error(`${record.symbol} material crystal structure has invalid unit-cell ${key}`);
    }
  }
  if (!Number.isFinite(Number(unitCell.packingFraction)) || unitCell.packingFraction <= 0 || unitCell.packingFraction > 1) {
    throw new Error(`${record.symbol} material crystal structure has invalid packingFraction`);
  }
  const validity = record.validity || {};
  for (const key of ['temperatureRangeK', 'pressureRangePa']) {
    const range = validity[key];
    if (!Array.isArray(range) || range.length !== 2 || !range.every((value) => Number.isFinite(Number(value)))) {
      throw new Error(`${record.symbol} material crystal structure has invalid ${key}`);
    }
    if (Number(range[0]) > Number(range[1])) {
      throw new Error(`${record.symbol} material crystal structure has descending ${key}`);
    }
  }
  if (!Array.isArray(record.provenance) || record.provenance.length === 0) {
    throw new Error(`${record.symbol} material crystal structure has no provenance`);
  }
  for (const entry of record.provenance) {
    if (!ACCEPTED_PROVENANCE_STATUSES.has(entry.status)) {
      throw new Error(`${record.symbol} material crystal structure provenance has unknown status: ${entry.status}`);
    }
    for (const key of ['family', 'source', 'method', 'units', 'referenceState']) {
      if (typeof entry[key] !== 'string' || entry[key].length === 0) {
        throw new Error(`${record.symbol} material crystal structure provenance missing ${key}`);
      }
    }
  }
  return true;
}

export function normalizeMaterialPropertyBank(bank) {
  if (bank?.schema !== MATERIAL_PROPERTY_BANK_SCHEMA) {
    throw new TypeError('material property bank has an unknown schema');
  }
  if (!Number.isInteger(bank.schemaVersion)) {
    throw new RangeError('material property bank schemaVersion must be an integer');
  }
  if (bank.schemaVersion !== MATERIAL_PROPERTY_BANK_SCHEMA_VERSION) {
    throw new RangeError(`unsupported material property bank schemaVersion: ${bank.schemaVersion}`);
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

export function normalizeMaterialPropertyCrystalStructureBank(bank) {
  if (bank?.schema !== MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_BANK_SCHEMA) {
    throw new TypeError('material crystal structure bank has an unknown schema');
  }
  if (!Number.isInteger(bank.schemaVersion)) {
    throw new RangeError('material crystal structure bank schemaVersion must be an integer');
  }
  if (bank.schemaVersion !== MATERIAL_PROPERTY_CRYSTAL_STRUCTURE_BANK_SCHEMA_VERSION) {
    throw new RangeError(`unsupported material crystal structure bank schemaVersion: ${bank.schemaVersion}`);
  }
  const records = (bank.records || []).map((record) => {
    assertMaterialPropertyCrystalStructureRecord(record);
    return cloneRecord(record);
  });
  const bySymbol = new Map();
  const byStructureKey = new Map();
  for (const record of records) {
    if (byStructureKey.has(record.structureKey)) {
      throw new Error(`duplicate material crystal structure key: ${record.structureKey}`);
    }
    const symbol = canonicalMaterialPropertyBankSymbol(record.symbol);
    const symbolRecords = bySymbol.get(symbol) || [];
    symbolRecords.push(record);
    bySymbol.set(symbol, symbolRecords);
    byStructureKey.set(record.structureKey, record);
  }
  for (const symbolRecords of bySymbol.values()) {
    symbolRecords.sort((a, b) => String(a.structureKey).localeCompare(String(b.structureKey)));
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
    byStructureKey,
    strictSourceOfTruth: false,
    provenanceMode: 'precomputed-json-bank-crystal-warm-input'
  };
}

export function materialPropertyBankRecordBySymbol(bank, symbol) {
  const normalized = bank?.bySymbol instanceof Map ? bank : normalizeMaterialPropertyBank(bank);
  return normalized.bySymbol.get(symbol)
    || normalized.bySymbol.get(canonicalMaterialPropertyBankSymbol(symbol))
    || null;
}

export function materialPropertyCrystalStructuresForSymbol(bank, symbol, { phase = null } = {}) {
  const normalized = bank?.bySymbol instanceof Map && bank?.byStructureKey instanceof Map
    ? bank
    : normalizeMaterialPropertyCrystalStructureBank(bank);
  const records = normalized.bySymbol.get(canonicalMaterialPropertyBankSymbol(symbol)) || [];
  return phase ? records.filter((record) => record.phase === phase) : records;
}

export function materialPropertyCrystalStructureByKey(bank, structureKey) {
  const normalized = bank?.byStructureKey instanceof Map ? bank : normalizeMaterialPropertyCrystalStructureBank(bank);
  const key = typeof structureKey === 'string' ? structureKey.trim() : structureKey;
  return normalized.byStructureKey.get(key) || null;
}

export function materialPropertyBankWarmInput(record, {
  temperatureK = record?.referenceState?.temperatureK,
  pressurePa = record?.referenceState?.pressurePa,
  bankFamily = null,
  bankSchemaVersion = null,
  generatorFingerprint = null
} = {}) {
  assertMaterialPropertyBankRecord(record);
  return {
    schema: MATERIAL_PROPERTY_BANK_WARM_INPUT_SCHEMA,
    status: 'material-property-bank-warm-input-ready',
    strictSourceOfTruth: false,
    material: record.symbol,
    atomicNumber: record.atomicNumber,
    schemaVersion: 1,
    bankFamily,
    bankSchemaVersion,
    bankRecordSchema: record.schema,
    temperatureK: finiteNumber(temperatureK, record.referenceState.temperatureK),
    pressurePa: finiteNumber(pressurePa, record.referenceState.pressurePa),
    phaseCount: record.phases.length,
    targetNeighborCount: record.mechanics.targetNeighborCount,
    spacingPolicy: record.mechanics.spacingPolicy || null,
    pbr: cloneRecord(record.opticalPbr),
    provenance: {
      source: 'precomputed-json-bank',
      generatorFingerprint,
      entries: cloneRecord(record.provenance)
    }
  };
}

export function buildMaterialPropertyBankGpuWarmInputTable(warmInputs) {
  const entries = roleEntriesFromWarmInputs(warmInputs);
  if (entries.length === 0) return emptyWarmInputTable();
  const rows = [];
  const metadata = [];
  for (const [role, warmInput] of entries) {
    const pbr = warmInput.pbr || {};
    const color = Array.isArray(pbr.baseColorSrgb) ? pbr.baseColorSrgb : [0, 0, 0];
    rows.push(
      finiteNumber(warmInput.atomicNumber),
      finiteNumber(warmInput.atomicNumber),
      finiteNumber(warmInput.temperatureK),
      finiteNumber(warmInput.pressurePa),
      finiteNumber(warmInput.targetNeighborCount),
      finiteNumber(warmInput.phaseCount),
      finiteNumber(color[0]),
      finiteNumber(color[1]),
      finiteNumber(color[2]),
      finiteNumber(pbr.metalness),
      finiteNumber(pbr.roughness),
      finiteNumber(pbr.ior, 1),
      warmInput.strictSourceOfTruth === true ? 1 : 0,
      MATERIAL_PROPERTY_BANK_GPU_ROW_STATUS.ready,
      0,
      0
    );
    metadata.push({
      role,
      material: warmInput.material,
      requestedMaterial: warmInput.requestedMaterial ?? null,
      materialId: warmInput.atomicNumber,
      atomicNumber: warmInput.atomicNumber,
      temperatureK: warmInput.temperatureK,
      pressurePa: warmInput.pressurePa,
      targetNeighborCount: warmInput.targetNeighborCount,
      spacingPolicy: warmInput.spacingPolicy ?? null,
      bankFamily: warmInput.bankFamily ?? null,
      bankSchemaVersion: warmInput.bankSchemaVersion ?? null,
      generatorFingerprint: warmInput.provenance?.generatorFingerprint ?? null,
      strictSourceOfTruth: false,
      status: 'ready'
    });
  }
  return {
    schema: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA,
    status: 'material-bank-gpu-warm-input-table-ready',
    rowLayout: [...MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT],
    rowStrideFloats: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length,
    rowStrideBytes: MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    rows: Float32Array.from(rows),
    rowCount: rows.length / MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_ROW_LAYOUT.length,
    metadata,
    strictSourceOfTruth: false,
    scientificValidation: false,
    materialValidation: false,
    fullPhysicsValidation: false
  };
}

export function buildMaterialPropertyBankParticleSizePackingTable(initialParticleSpacing) {
  const warmInputs = initialParticleSpacing?.materialPropertyBankWarmInputs;
  const entries = roleEntriesFromWarmInputs(warmInputs);
  if (entries.length === 0) return emptyParticleSizePackingTable();
  const rows = [];
  const metadata = [];
  const crystalRoles = initialParticleSpacing?.materialPropertyCrystalStructureWarmInputs?.roles || {};
  for (const [role, warmInput] of entries) {
    const rolePlan = initialParticleSpacing?.[role] || {};
    const crystalWarmInput = crystalRoles[role] || null;
    const crystalUnitCell = crystalWarmInput?.unitCell || {};
    rows.push(
      MATERIAL_PROPERTY_BANK_ROLE_IDS[role] ?? 0,
      finiteNumber(warmInput.atomicNumber),
      finiteNumber(warmInput.temperatureK),
      finiteNumber(warmInput.pressurePa),
      finiteNumber(rolePlan.particlesPerEdge),
      finiteNumber(rolePlan.spacingM),
      finiteNumber(rolePlan.volumeEquivalentParticleRadiusM),
      finiteNumber(rolePlan.restVolumeM3),
      finiteNumber(rolePlan.densityKgPerM3),
      finiteNumber(warmInput.targetNeighborCount),
      finiteNumber(initialParticleSpacing?.smoothingLengthM),
      warmInput.strictSourceOfTruth === true ? 1 : 0,
      MATERIAL_PROPERTY_BANK_GPU_ROW_STATUS.ready,
      finiteNumber(crystalUnitCell.packingFraction),
      finiteNumber(crystalUnitCell.coordinationNumber),
      finiteNumber(crystalUnitCell.atomsPerConventionalCell)
    );
    metadata.push({
      role,
      roleId: MATERIAL_PROPERTY_BANK_ROLE_IDS[role] ?? 0,
      material: warmInput.material,
      requestedMaterial: warmInput.requestedMaterial ?? null,
      materialId: warmInput.atomicNumber,
      particlesPerEdge: finiteNumber(rolePlan.particlesPerEdge),
      spacingM: finiteNumber(rolePlan.spacingM),
      volumeEquivalentParticleRadiusM: finiteNumber(rolePlan.volumeEquivalentParticleRadiusM),
      restVolumeM3: finiteNumber(rolePlan.restVolumeM3),
      densityKgPerM3: finiteNumber(rolePlan.densityKgPerM3),
      targetNeighborCount: warmInput.targetNeighborCount,
      smoothingLengthM: finiteNumber(initialParticleSpacing?.smoothingLengthM),
      crystalStructureKey: crystalWarmInput?.structureKey ?? null,
      crystalStructureStatus: crystalWarmInput?.status ?? null,
      crystalPackingFraction: finiteNumber(crystalUnitCell.packingFraction),
      crystalCoordinationNumber: finiteNumber(crystalUnitCell.coordinationNumber),
      crystalAtomsPerConventionalCell: finiteNumber(crystalUnitCell.atomsPerConventionalCell),
      strictSourceOfTruth: false,
      status: 'ready'
    });
  }
  return {
    schema: MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_PACKING_TABLE_SCHEMA,
    status: 'material-bank-particle-size-packing-ready',
    rowLayout: [...MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT],
    rowStrideFloats: MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT.length,
    rowStrideBytes: MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT.length * Float32Array.BYTES_PER_ELEMENT,
    rows: Float32Array.from(rows),
    rowCount: rows.length / MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_ROW_LAYOUT.length,
    metadata,
    strictSourceOfTruth: false,
    scientificValidation: false,
    materialValidation: false,
    fullPhysicsValidation: false
  };
}
