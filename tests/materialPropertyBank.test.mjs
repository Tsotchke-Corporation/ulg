import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  MATERIAL_PROPERTY_BANK_SCHEMA,
  materialPropertyBankRecordBySymbol,
  materialPropertyBankWarmInput,
  normalizeMaterialPropertyBank
} from '../src/runtime/material/materialPropertyBank.js';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
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
  assert.ok(normalized.recordCount >= 5);
  assert.equal(materialPropertyBankRecordBySymbol(normalized, 'Fe')?.atomicNumber, 26);
  assert.equal(materialPropertyBankRecordBySymbol(normalized, 'Na')?.mechanics.spacingPolicy, 'derive-from-rest-density-and-phase');
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
