import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  normalizeMaterialPropertyBank,
  normalizeMaterialPropertyCrystalStructureBank
} from '../../src/runtime/material/materialPropertyBank.js';

const repoDir = path.resolve(process.env.ULG_REPO_DIR || process.cwd());
const bankPath = path.join(repoDir, 'data', 'material-properties', 'elements.json');
const schemaPath = path.join(repoDir, 'data', 'material-properties', 'schemas', 'material-property-bank.schema.json');
const elementSchemaPath = path.join(repoDir, 'data', 'material-properties', 'schemas', 'element.schema.json');
const crystalBankPath = path.join(repoDir, 'data', 'material-properties', 'element-crystal-structures.json');
const crystalSchemaPath = path.join(
  repoDir,
  'data',
  'material-properties',
  'schemas',
  'element-crystal-structure.schema.json'
);
const crystalBankSchemaPath = path.join(
  repoDir,
  'data',
  'material-properties',
  'schemas',
  'element-crystal-structure-bank.schema.json'
);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const elementSchema = await readJson(elementSchemaPath);
const bankSchema = await readJson(schemaPath);
const crystalSchema = await readJson(crystalSchemaPath);
const crystalBankSchema = await readJson(crystalBankSchemaPath);
ajv.addSchema(elementSchema, elementSchema.$id);
ajv.addSchema(crystalSchema, crystalSchema.$id);
const validate = ajv.compile(bankSchema);
const validateCrystalBank = ajv.compile(crystalBankSchema);
const bank = await readJson(bankPath);
const crystalBank = await readJson(crystalBankPath);
const issues = [];

if (!validate(bank)) {
  issues.push({
    bankPath,
    reason: ajv.errorsText(validate.errors, { separator: '\n' })
  });
}
if (!validateCrystalBank(crystalBank)) {
  issues.push({
    bankPath: crystalBankPath,
    reason: ajv.errorsText(validateCrystalBank.errors, { separator: '\n' })
  });
}

if (issues.length > 0) {
  for (const issue of issues) {
    process.stderr.write(`${issue.bankPath}: ${issue.reason}\n`);
  }
  process.exitCode = 1;
} else {
  const normalized = normalizeMaterialPropertyBank(bank);
  const normalizedCrystalBank = normalizeMaterialPropertyCrystalStructureBank(crystalBank);
  process.stdout.write(`${JSON.stringify({
    schema: 'peercompute.ulg.material-property-bank-validation.v0',
    status: 'pass',
    bankPath,
    recordCount: normalized.recordCount,
    symbols: normalized.records.map((record) => record.symbol),
    crystalBankPath,
    crystalRecordCount: normalizedCrystalBank.recordCount,
    crystalSymbols: [...normalizedCrystalBank.bySymbol.keys()]
  }, null, 2)}\n`);
}
