import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { ArtifactCache } from '../src/runtime/ArtifactCache.js';
import { ClosureRegistry } from '../src/runtime/ClosureRegistry.js';
import { MaterialRegistry } from '../src/runtime/material/MaterialRegistry.js';
import { condensedElementSymbols } from '../src/runtime/material/elementClosures.js';
import { createFirstPrinciplesMaterialClosures } from '../src/runtime/material/materialClosures.js';
import {
  MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA,
  MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_PACKING_TABLE_SCHEMA,
  MATERIAL_PROPERTY_BANK_SCHEMA,
  MATERIAL_PROPERTY_BANK_SCHEMA_VERSION,
  buildMaterialPropertyBankGpuWarmInputTable,
  buildMaterialPropertyBankParticleSizePackingTable,
  materialPropertyBankRecordBySymbol,
  materialPropertyBankWarmInput,
  normalizeMaterialPropertyBank
} from '../src/runtime/material/materialPropertyBank.js';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

const execFileAsync = promisify(execFile);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const ACTIVE_ELEMENT_BANK_SYMBOLS = Object.freeze(['H', 'O', 'Li', 'Na', 'K', 'Rb', 'Cs', 'Fe', 'Pd']);
const GENERATED_SELECTABLE_PREFIX_LAST_SYMBOL = 'Ts';

function selectablePrefixThrough(symbol) {
  const symbols = condensedElementSymbols().map((entry) => entry.symbol);
  const index = symbols.indexOf(symbol);
  assert.notEqual(index, -1, `${symbol} must be a selectable condensed element`);
  return symbols.slice(0, index + 1);
}

test('element material property bank validates against schema and normalizes lookup keys', async () => {
  const bank = await readJson('../data/material-properties/elements.json');
  const bankSchema = await readJson('../data/material-properties/schemas/material-property-bank.schema.json');
  const elementSchema = await readJson('../data/material-properties/schemas/element.schema.json');
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(elementSchema, elementSchema.$id);
  const validate = ajv.compile(bankSchema);

  assert.equal(validate(bank), true, ajv.errorsText(validate.errors));
  const normalized = normalizeMaterialPropertyBank(bank);
  assert.equal(normalized.schema, MATERIAL_PROPERTY_BANK_SCHEMA);
  assert.equal(normalized.schemaVersion, MATERIAL_PROPERTY_BANK_SCHEMA_VERSION);
  assert.ok(normalized.recordCount >= 5);
  assert.equal(materialPropertyBankRecordBySymbol(normalized, 'Fe')?.atomicNumber, 26);
  assert.equal(materialPropertyBankRecordBySymbol(normalized, 'fe')?.atomicNumber, 26);
  assert.equal(materialPropertyBankRecordBySymbol(normalized, 'FE')?.atomicNumber, 26);
  assert.equal(materialPropertyBankRecordBySymbol(normalized, 'Na')?.mechanics.spacingPolicy, 'derive-from-rest-density-and-phase');
});

test('element material property bank covers active alkali and PBR probe elements', async () => {
  const bank = normalizeMaterialPropertyBank(await readJson('../data/material-properties/elements.json'));
  for (const symbol of ACTIVE_ELEMENT_BANK_SYMBOLS) {
    const record = materialPropertyBankRecordBySymbol(bank, symbol);
    assert.ok(record, `${symbol} must have a material bank row`);
    assert.ok(record.phases.length > 0, `${symbol} must have at least one phase row`);
    assert.ok(record.opticalPbr, `${symbol} must have a PBR seed`);
  }

  const potassium = materialPropertyBankRecordBySymbol(bank, 'K');
  assert.equal(potassium.mechanics.mlsMpmMaterialClass, 'alkali-metal');
  assert.equal(potassium.mechanics.spacingPolicy, 'derive-from-rest-density-and-phase');
  assert.ok(potassium.provenance.some((entry) => entry.status === 'reduced-estimate'));

  const palladium = materialPropertyBankRecordBySymbol(bank, 'pd');
  assert.equal(palladium.symbol, 'Pd');
  assert.equal(palladium.mechanics.mlsMpmMaterialClass, 'transition-metal');
  assert.equal(palladium.opticalPbr.metalness, 1);
});

test('element material property bank includes the generated selectable prefix', async () => {
  const bank = normalizeMaterialPropertyBank(await readJson('../data/material-properties/elements.json'));
  for (const symbol of selectablePrefixThrough(GENERATED_SELECTABLE_PREFIX_LAST_SYMBOL)) {
    const record = materialPropertyBankRecordBySymbol(bank, symbol);
    assert.ok(record, `${symbol} must have a generated material bank row`);
    assert.ok(record.provenance.length > 0, `${symbol} must keep provenance`);
    assert.ok(record.provenance.some((entry) => entry.status === 'reduced-estimate' || entry.status === 'reference-fallback'));
    assert.equal(typeof record.mechanics.spacingPolicy, 'string');
    assert.ok(record.opticalPbr, `${symbol} must have a PBR seed`);
  }

  for (const symbol of selectablePrefixThrough(GENERATED_SELECTABLE_PREFIX_LAST_SYMBOL).filter(
    (entry) => !ACTIVE_ELEMENT_BANK_SYMBOLS.includes(entry)
  )) {
    const record = materialPropertyBankRecordBySymbol(bank, symbol);
    assert.equal(record.mechanics.spacingPolicy, 'derive-from-rest-density-and-phase');
    assert.ok(record.provenance.some((entry) => entry.method.includes('gridPointsN=80')));
  }
});

test('material property bank generator can plan and cache a bounded dry-run tranche', async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'ulg-material-bank-cache-'));
  const args = [
    'scripts/material-properties/generate-material-property-bank.mjs',
    '--symbols=Be',
    '--regenerate',
    '--grid=32',
    '--limit=1',
    `--cache-dir=${cacheDir}`
  ];
  const { stdout } = await execFileAsync(process.execPath, args, {
    cwd: new URL('..', import.meta.url),
    maxBuffer: 1024 * 1024
  });
  const result = JSON.parse(stdout);

  assert.equal(result.schema, 'peercompute.ulg.material-property-bank-generation.v0');
  assert.equal(result.status, 'planned');
  assert.equal(result.gridPointsN, 32);
  assert.equal(result.recordCount, 1);
  assert.deepEqual(result.generated, ['Be']);
  assert.equal(result.cache.enabled, true);
  assert.equal(result.cache.hitCount, 0);
  assert.equal(result.cache.writeCount, 1);
  assert.ok(result.remainingMissingCount > 0);

  const cached = JSON.parse((await execFileAsync(process.execPath, args, {
    cwd: new URL('..', import.meta.url),
    maxBuffer: 1024 * 1024
  })).stdout);
  assert.equal(cached.cache.hitCount, 1);
  assert.equal(cached.cache.writeCount, 0);
  assert.deepEqual(cached.generated, ['Be']);
});

test('material property bank rejects stale schema and invalid provenance rows', async () => {
  const bank = await readJson('../data/material-properties/elements.json');

  const stale = clone(bank);
  stale.schemaVersion = 0;
  assert.throws(
    () => normalizeMaterialPropertyBank(stale),
    /unsupported material property bank schemaVersion: 0/
  );

  const future = clone(bank);
  future.schemaVersion = MATERIAL_PROPERTY_BANK_SCHEMA_VERSION + 1;
  assert.throws(
    () => normalizeMaterialPropertyBank(future),
    /unsupported material property bank schemaVersion: 2/
  );

  const unknownProvenance = clone(bank);
  unknownProvenance.records[0].provenance[0].status = 'unreviewed-table';
  assert.throws(
    () => normalizeMaterialPropertyBank(unknownProvenance),
    /material property bank provenance has unknown status: unreviewed-table/
  );

  const missingUnits = clone(bank);
  delete missingUnits.records[0].provenance[0].units;
  assert.throws(
    () => normalizeMaterialPropertyBank(missingUnits),
    /material property bank provenance missing units/
  );
});

test('material property bank warm input is explicitly non-authoritative', async () => {
  const bank = normalizeMaterialPropertyBank(await readJson('../data/material-properties/elements.json'));
  const fe = materialPropertyBankRecordBySymbol(bank, 'Fe');
  const warm = materialPropertyBankWarmInput(fe, { temperatureK: 1800, pressurePa: 101325 });

  assert.equal(warm.schema, 'peercompute.ulg.material-property-bank.warm-input.v0');
  assert.equal(warm.status, 'material-property-bank-warm-input-ready');
  assert.equal(warm.strictSourceOfTruth, false);
  assert.equal(warm.material, 'Fe');
  assert.equal(warm.targetNeighborCount, 64);
  assert.equal(warm.spacingPolicy, 'derive-from-rest-density-and-phase');
  assert.ok(warm.provenance.entries.some((entry) => entry.status === 'reference-fallback'));
});

test('material property bank packs accepted warm inputs into GPU-ready rows', async () => {
  const bank = normalizeMaterialPropertyBank(await readJson('../data/material-properties/elements.json'));
  const fe = materialPropertyBankRecordBySymbol(bank, 'Fe');
  const warm = {
    ...materialPropertyBankWarmInput(fe, {
      temperatureK: 1800,
      pressurePa: 101325,
      bankFamily: bank.bankFamily,
      bankSchemaVersion: bank.schemaVersion,
      generatorFingerprint: bank.generatorFingerprint
    }),
    role: 'drop',
    requestedMaterial: 'fe'
  };
  const warmInputs = {
    schema: 'peercompute.ulg.sph-initial-particle-spacing-material-bank-warm-inputs.v0',
    roles: { drop: warm, base: null }
  };
  const table = buildMaterialPropertyBankGpuWarmInputTable(warmInputs);

  assert.equal(table.schema, MATERIAL_PROPERTY_BANK_GPU_WARM_INPUT_TABLE_SCHEMA);
  assert.equal(table.status, 'material-bank-gpu-warm-input-table-ready');
  assert.equal(table.rowCount, 1);
  assert.equal(table.strictSourceOfTruth, false);
  assert.equal(table.rows[0], 26);
  assert.equal(table.rows[1], 26);
  assert.equal(table.rows[12], 0);
  assert.equal(table.rows[13], 1);
  assert.equal(table.metadata[0].role, 'drop');
  assert.equal(table.metadata[0].requestedMaterial, 'fe');

  const particleSize = buildMaterialPropertyBankParticleSizePackingTable({
    smoothingLengthM: 0.2,
    materialPropertyBankWarmInputs: warmInputs,
    drop: {
      particlesPerEdge: 3,
      spacingM: 0.1,
      volumeEquivalentParticleRadiusM: 0.05,
      restVolumeM3: 0.001,
      densityKgPerM3: 7000
    }
  });
  assert.equal(particleSize.schema, MATERIAL_PROPERTY_BANK_PARTICLE_SIZE_PACKING_TABLE_SCHEMA);
  assert.equal(particleSize.status, 'material-bank-particle-size-packing-ready');
  assert.equal(particleSize.rowCount, 1);
  assert.equal(particleSize.rows[0], 1);
  assert.equal(particleSize.rows[1], 26);
  assert.equal(particleSize.rows[11], 0);
  assert.equal(particleSize.rows[12], 1);
  assert.equal(particleSize.metadata[0].spacingM, 0.1);
});

test('MaterialRegistry exposes bank warm inputs without overriding strict closure samples', async () => {
  const bank = await readJson('../data/material-properties/elements.json');
  const registry = new MaterialRegistry({
    closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() }),
    materialPropertyBank: bank
  });
  await registry.registerAll(createFirstPrinciplesMaterialClosures());

  const direct = registry.getMaterialPropertyBankWarmInput({ material: 'fe', temperatureK: 1500, pressurePa: 101325 });
  assert.equal(direct.material, 'Fe');
  assert.equal(direct.requestedMaterial, 'fe');
  assert.equal(direct.strictSourceOfTruth, false);
  assert.equal(direct.bankFamily, 'elements');
  assert.equal(direct.bankSchemaVersion, 1);
  assert.equal(direct.provenance.generatorFingerprint, bank.generatorFingerprint);

  const sampled = await registry.sampleProperty({
    material: 'fe',
    property: 'density',
    temperatureK: 1500,
    pressurePa: 101325
  });
  assert.equal(sampled.status, 'sampled');
  assert.equal(sampled.materialPropertyBankWarmInput.material, 'Fe');
  assert.equal(sampled.materialPropertyBankWarmInput.strictSourceOfTruth, false);
  assert.equal(sampled.provenance.derivationSummary.fullyLowerLevelDerived, true);
  assert.notEqual(sampled.value, null);
});

test('MaterialRegistry omits material bank metadata when no bank is configured', async () => {
  const registry = new MaterialRegistry({
    closureRegistry: new ClosureRegistry({ artifactCache: new ArtifactCache() })
  });
  await registry.registerAll(createFirstPrinciplesMaterialClosures());

  assert.equal(registry.getMaterialPropertyBankWarmInput({ material: 'fe', temperatureK: 300 }), null);
  const sampled = await registry.sampleProperty({
    material: 'fe',
    property: 'density',
    temperatureK: 300,
    pressurePa: 101325
  });
  assert.equal(Object.hasOwn(sampled, 'materialPropertyBankWarmInput'), false);
});
