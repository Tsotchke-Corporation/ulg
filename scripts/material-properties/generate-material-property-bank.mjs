import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hashPayload } from '../../ulg-gpu-abi/src/index.js';
import { ELEMENT_UI_METADATA } from '../../src/visualization/sphMaterialOptions.js';
import {
  ATOMIC_MASS_U,
  zForSymbol
} from '../../src/runtime/electronicStructure/periodicTable.js';
import {
  condensedElementSymbols,
  elementMaterialClosure
} from '../../src/runtime/material/elementClosures.js';
import {
  MATERIAL_PROPERTY_BANK_RECORD_SCHEMA,
  MATERIAL_PROPERTY_BANK_SCHEMA,
  MATERIAL_PROPERTY_BANK_SCHEMA_VERSION,
  normalizeMaterialPropertyBank
} from '../../src/runtime/material/materialPropertyBank.js';

const repoDir = path.resolve(process.env.ULG_REPO_DIR || process.cwd());
const bankPath = path.join(repoDir, 'data', 'material-properties', 'elements.json');
const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const regenerate = args.has('--regenerate');
const progress = args.has('--progress');
const gridArg = process.argv.find((arg) => arg.startsWith('--grid='));
const gridPointsN = Number.parseInt(gridArg?.split('=')[1] ?? '120', 10);
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const generationLimit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : Infinity;
const symbolsArg = process.argv.find((arg) => arg.startsWith('--symbols='));
const requestedSymbols = symbolsArg
  ? new Set(symbolsArg.split('=').slice(1).join('=').split(',').map((symbol) => symbol.trim()).filter(Boolean))
  : null;
const generatedAtArg = process.argv.find((arg) => arg.startsWith('--generated-at='));
const generatedAt = generatedAtArg?.split('=').slice(1).join('=') || '2026-06-19T00:00:00-08:00';

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function cleanNumber(value, fallback = null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Number(number.toPrecision(12));
}

function cleanRange(value, fallback = [0, 1_000_000]) {
  const source = Array.isArray(value) && value.length >= 2 ? value : fallback;
  return [
    cleanNumber(source[0], fallback[0]),
    cleanNumber(source[1], fallback[1])
  ];
}

function clamp01(value, fallback = 0) {
  return Math.min(1, Math.max(0, cleanNumber(value, fallback)));
}

function categoryMetadata(symbol) {
  return ELEMENT_UI_METADATA.find((entry) => entry.symbol === symbol) || {
    symbol,
    name: symbol,
    category: 'element'
  };
}

function mechanicsClass(category) {
  switch (category) {
    case 'alkali': return 'alkali-metal';
    case 'alkaline': return 'alkaline-earth-metal';
    case 'transition': return 'transition-metal';
    case 'post-transition': return 'post-transition-metal';
    case 'lanthanide': return 'lanthanide-metal';
    case 'actinide': return 'actinide-metal';
    case 'metalloid': return 'metalloid-condensed-element';
    case 'halogen': return 'condensed-halogen-element';
    case 'nonmetal': return 'condensed-nonmetal-element';
    default: return `${category || 'element'}-condensed-element`;
  }
}

function packingHint(category) {
  switch (category) {
    case 'alkali': return 'bcc-metal-solid';
    case 'alkaline': return 'close-packed-alkaline-earth-solid-estimate';
    case 'transition': return 'close-packed-transition-metal-estimate';
    case 'post-transition': return 'post-transition-metal-solid-estimate';
    case 'lanthanide': return 'lanthanide-metal-solid-estimate';
    case 'actinide': return 'actinide-metal-solid-estimate';
    case 'metalloid': return 'covalent-network-solid-estimate';
    case 'halogen': return 'condensed-halogen-solid-estimate';
    case 'nonmetal': return 'condensed-nonmetal-solid-estimate';
    default: return 'condensed-element-solid-estimate';
  }
}

function pbrMetalness(category) {
  if (['alkali', 'alkaline', 'transition', 'post-transition', 'lanthanide', 'actinide'].includes(category)) {
    return 1;
  }
  if (category === 'metalloid') return 0.35;
  return 0;
}

function pbrRoughness(category) {
  if (['alkali', 'alkaline'].includes(category)) return 0.42;
  if (['transition', 'post-transition', 'lanthanide', 'actinide'].includes(category)) return 0.32;
  if (category === 'metalloid') return 0.55;
  return 0.7;
}

function phaseRecord(phase) {
  return {
    name: phase.name,
    temperatureRangeK: cleanRange(phase.temperatureRange),
    densityKgPerM3: cleanNumber(phase.densityKgPerM3, 0),
    heatCapacityJPerKgK: cleanNumber(phase.cpJPerKgK, 0),
    thermalConductivityWPerMK: cleanNumber(phase.thermalConductivityWPerMK, 0),
    bulkModulusPa: cleanNumber(phase.bulkModulusPa, null),
    shearModulusPa: cleanNumber(phase.shearModulusPa, null),
    dynamicViscosityPaS: cleanNumber(phase.dynamicViscosityPaS, null),
    surfaceTensionNPerM: cleanNumber(phase.surfaceTensionNPerM, null)
  };
}

function transitionRecord(transition) {
  const solidLiquid = transition.from === 'solid' && transition.to === 'liquid';
  return {
    name: solidLiquid ? 'melting' : `${transition.from || 'phase'}-to-${transition.to || 'phase'}`,
    temperatureK: cleanNumber(transition.temperatureK, 0),
    latentHeatJPerKg: cleanNumber(transition.latentHeatJPerKg, null)
  };
}

function recordForSymbol(symbol) {
  const metadata = categoryMetadata(symbol);
  const Z = zForSymbol(symbol);
  const closure = elementMaterialClosure(Z, {
    allowReducedEstimates: true,
    gridPointsN
  });
  if (!closure) return null;
  const properties = closure.properties;
  const color = properties.intrinsicColorSrgb || [0.8, 0.8, 0.8];
  const category = metadata.category;
  return {
    schema: MATERIAL_PROPERTY_BANK_RECORD_SCHEMA,
    symbol,
    name: metadata.name,
    atomicNumber: Z,
    atomicMassU: cleanNumber(ATOMIC_MASS_U[Z - 1], 0),
    referenceState: { temperatureK: 293.15, pressurePa: 101325 },
    phases: properties.phases.map(phaseRecord),
    transitions: (properties.transitions || []).map(transitionRecord),
    mechanics: {
      mlsMpmMaterialClass: mechanicsClass(category),
      targetNeighborCount: 64,
      initialPackingHint: packingHint(category),
      spacingPolicy: 'derive-from-rest-density-and-phase'
    },
    opticalPbr: {
      baseColorSrgb: [
        clamp01(color[0], 0.8),
        clamp01(color[1], 0.8),
        clamp01(color[2], 0.8)
      ],
      metalness: pbrMetalness(category),
      roughness: pbrRoughness(category),
      ior: pbrMetalness(category) > 0.5 ? null : 1.5,
      emissiveHint: 'blackbody-coupled'
    },
    provenance: [
      {
        family: 'identity',
        source: 'periodic-table-standard-atomic-weight',
        method: 'checked-in-precomputed-seed',
        status: 'exact-constant',
        units: 'u',
        referenceState: 'neutral atom'
      },
      {
        family: 'phase-mechanics-optical',
        source: 'elementMaterialClosure',
        method: `atomic lower-level closure reduced estimate, gridPointsN=${gridPointsN}`,
        status: 'reduced-estimate',
        units: 'SI',
        referenceState: '293.15 K, 101325 Pa',
        quality: 'bootstrap-only',
        inputHash: hashPayload({
          generator: 'generate-material-property-bank',
          symbol,
          atomicNumber: Z,
          gridPointsN,
          closureDerivation: properties.derivation
        })
      }
    ]
  };
}

const existingBank = normalizeMaterialPropertyBank(await readJson(bankPath));
const existingBySymbol = new Map(existingBank.records.map((record) => [record.symbol, record]));
const allTargetSymbols = condensedElementSymbols().map((entry) => entry.symbol);
const targetSymbols = requestedSymbols
  ? allTargetSymbols.filter((symbol) => requestedSymbols.has(symbol))
  : allTargetSymbols;
const generated = [];
const preserved = [];
const records = [];
for (const symbol of targetSymbols) {
  if (!regenerate && existingBySymbol.has(symbol)) {
    const record = existingBySymbol.get(symbol);
    preserved.push(symbol);
    records.push(record);
    continue;
  }
  if (generated.length >= generationLimit) continue;
  if (progress) {
    process.stderr.write(`[material-bank] deriving ${symbol} (${generated.length + 1}/${Number.isFinite(generationLimit) ? generationLimit : 'all'})\n`);
  }
  const record = recordForSymbol(symbol);
  if (!record) continue;
  generated.push(symbol);
  records.push(record);
}
records.sort((left, right) => left.atomicNumber - right.atomicNumber);
const covered = new Set(records.map((record) => record.symbol));
const remainingMissing = allTargetSymbols.filter((symbol) => !covered.has(symbol));

const bank = {
  schema: MATERIAL_PROPERTY_BANK_SCHEMA,
  schemaVersion: MATERIAL_PROPERTY_BANK_SCHEMA_VERSION,
  bankFamily: 'elements',
  generatorFingerprint: hashPayload({
    generator: 'scripts/material-properties/generate-material-property-bank.mjs',
    mode: regenerate ? 'regenerate-all-selectable' : 'preserve-existing-fill-selectable',
    gridPointsN,
    targetSymbols
  }),
  generatedAt,
  records
};
normalizeMaterialPropertyBank(bank);

const output = `${JSON.stringify(bank, null, 2)}\n`;
if (write) {
  await writeFile(bankPath, output);
}
process.stdout.write(`${JSON.stringify({
  schema: 'peercompute.ulg.material-property-bank-generation.v0',
  status: write ? 'written' : 'planned',
  bankPath,
  gridPointsN,
  regenerate,
  targetCount: targetSymbols.length,
  fullSelectableTargetCount: allTargetSymbols.length,
  recordCount: records.length,
  preservedCount: preserved.length,
  generatedCount: generated.length,
  remainingMissingCount: remainingMissing.length,
  remainingMissing,
  generated
}, null, 2)}\n`);
