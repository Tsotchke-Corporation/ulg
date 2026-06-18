import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  normalizeMaterialPropertyBank
} from '../../src/runtime/material/materialPropertyBank.js';

const repoDir = path.resolve(process.env.ULG_REPO_DIR || process.cwd());
const bankPath = path.join(repoDir, 'data', 'material-properties', 'elements.json');
const schemaPath = path.join(repoDir, 'data', 'material-properties', 'schemas', 'material-property-bank.schema.json');
const elementSchemaPath = path.join(repoDir, 'data', 'material-properties', 'schemas', 'element.schema.json');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const elementSchema = await readJson(elementSchemaPath);
const bankSchema = await readJson(schemaPath);
ajv.addSchema(elementSchema, elementSchema.$id);
const validate = ajv.compile(bankSchema);
const bank = await readJson(bankPath);
if (!validate(bank)) {
  process.stderr.write(`${ajv.errorsText(validate.errors, { separator: '\n' })}\n`);
  process.exitCode = 1;
} else {
  const normalized = normalizeMaterialPropertyBank(bank);
  process.stdout.write(`${JSON.stringify({
    schema: 'peercompute.ulg.material-property-bank-validation.v0',
    status: 'pass',
    bankPath,
    recordCount: normalized.recordCount,
    symbols: normalized.records.map((record) => record.symbol)
  }, null, 2)}\n`);
}
