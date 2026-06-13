import {
  canonicalFormula as canonicalFormulaFromCounts,
  formulaMolarMassKgPerMol,
  parseChemicalFormula
} from '../material/materialDerivation.js';
import { ELEMENT_SYMBOLS, symbolForZ } from '../electronicStructure/periodicTable.js';

const SYMBOL_BY_LOWER = new Map(ELEMENT_SYMBOLS.map((symbol) => [symbol.toLowerCase(), symbol]));

// Lowercase material keys are common in the demo runtime. A few molecular formulas are ambiguous
// when lowercased (for example "co" could be cobalt or carbon monoxide), so keep explicit aliases
// for formula-like keys that should remain molecular.
const FORMULA_ALIASES = Object.freeze({
  h2: 'H2',
  o2: 'O2',
  n2: 'N2',
  f2: 'F2',
  cl2: 'Cl2',
  br2: 'Br2',
  i2: 'I2',
  h2o: 'H2O',
  co: 'CO',
  co2: 'CO2',
  no: 'NO',
  no2: 'NO2',
  nh3: 'NH3',
  ch4: 'CH4'
});

function cloneCounts(atomCounts) {
  return Object.fromEntries(
    Object.entries(atomCounts).map(([Z, count]) => [String(Number(Z)), Number(count)])
  );
}

function tryParseFormula(formula) {
  try {
    return parseChemicalFormula(formula);
  } catch {
    return null;
  }
}

function normalizeElementRun(run) {
  const lower = run.toLowerCase();
  const n = lower.length;
  const best = new Array(n + 1).fill(null);
  best[n] = { tokenCount: 0, symbols: [] };
  for (let i = n - 1; i >= 0; i -= 1) {
    for (const len of [1, 2]) {
      const piece = lower.slice(i, i + len);
      const symbol = SYMBOL_BY_LOWER.get(piece);
      const suffix = best[i + len];
      if (!symbol || !suffix) continue;
      const candidate = { tokenCount: suffix.tokenCount + 1, symbols: [symbol, ...suffix.symbols] };
      if (!best[i] || candidate.tokenCount < best[i].tokenCount) best[i] = candidate;
    }
  }
  if (!best[0]) throw new Error(`could not normalize formula run '${run}'`);
  return best[0].symbols.join('');
}

function normalizeFormulaCase(formula) {
  let out = '';
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (/[A-Za-z]/.test(ch)) {
      let j = i + 1;
      while (j < formula.length && /[A-Za-z]/.test(formula[j])) j += 1;
      out += normalizeElementRun(formula.slice(i, j));
      i = j;
      continue;
    }
    if (!/[0-9()]/.test(ch)) throw new Error(`unsupported formula character '${ch}'`);
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Parse a material key or chemical formula into atom counts.
 *
 * This is intentionally a thin compatibility layer around materialDerivation.parseChemicalFormula:
 * direct, properly-cased formulas win first, lower-case demo keys are normalized second, and known
 * ambiguous molecule aliases prevent CO/CO2 from becoming cobalt compounds.
 */
export function describeChemicalFormula(input) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new TypeError('chemical formula input must be a non-empty string');
  }
  const raw = input.trim();
  const direct = tryParseFormula(raw);
  if (direct) return formulaDescription(raw, raw, direct);

  const alias = FORMULA_ALIASES[raw.toLowerCase()];
  if (alias) {
    const parsed = tryParseFormula(alias);
    if (parsed) return formulaDescription(raw, alias, parsed);
  }

  const normalized = normalizeFormulaCase(raw);
  const parsed = tryParseFormula(normalized);
  if (!parsed) throw new Error(`could not parse chemical formula '${input}'`);
  return formulaDescription(raw, normalized, parsed);
}

function formulaDescription(input, formula, atomCounts) {
  const counts = cloneCounts(atomCounts);
  const entries = Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b));
  const atomCount = entries.reduce((sum, [, count]) => sum + count, 0);
  return {
    input,
    formula,
    atomCounts: counts,
    atomCount,
    elementCount: entries.length,
    elements: entries.map(([Z, count]) => ({ Z: Number(Z), symbol: symbolForZ(Number(Z)), count })),
    canonicalFormula: canonicalFormulaFromCounts(counts),
    molarMassKgPerMol: formulaMolarMassKgPerMol(counts)
  };
}

export function atomCountsEqual(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of keys) {
    if ((a?.[key] || 0) !== (b?.[key] || 0)) return false;
  }
  return true;
}

export function addAtomCounts(target, source, multiplier = 1) {
  for (const [Z, count] of Object.entries(source || {})) {
    target[Z] = (target[Z] || 0) + Number(count) * multiplier;
  }
  return target;
}

export function multiplyAtomCounts(atomCounts, multiplier) {
  const out = {};
  addAtomCounts(out, atomCounts, multiplier);
  return out;
}

export function tallyFormulaSide(terms) {
  const out = {};
  for (const term of terms) addAtomCounts(out, term.atomCounts, term.coefficient);
  return out;
}

export function formatFormulaFromCounts(atomCounts, orderedZ = null) {
  const order = orderedZ || Object.keys(atomCounts).map(Number).sort((a, b) => a - b);
  return order
    .filter((Z) => (atomCounts[String(Z)] || atomCounts[Z] || 0) > 0)
    .map((Z) => {
      const count = atomCounts[String(Z)] || atomCounts[Z];
      return `${symbolForZ(Number(Z))}${count === 1 ? '' : count}`;
    })
    .join('');
}

export { formulaMolarMassKgPerMol };
