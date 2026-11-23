import {
  canonicalFormula as canonicalFormulaFromCounts,
  formulaMolarMassKgPerMol,
  parseChemicalFormula
} from '../material/materialDerivation.js';
import { ATOMIC_MASS_U, ELEMENT_SYMBOLS, symbolForZ } from '../electronicStructure/periodicTable.js';
import { deriveNuclearClosure } from '../nuclear/nuclearStructureGpu.js';

const SYMBOL_BY_LOWER = new Map(ELEMENT_SYMBOLS.map((symbol) => [symbol.toLowerCase(), symbol]));
const Z_BY_SYMBOL = new Map(ELEMENT_SYMBOLS.map((symbol, idx) => [symbol, idx + 1]));

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

/**
 * Parse arbitrary isotopologue / nuclide formulas cleanly with zero per-isotope
 * hacks:
 *   - Standard shorthands: `D` (2H, Z=1 A=2), `T` (3H, Z=1 A=3) -> `D2O`, `HDO`, `T2O`, `LiD`
 *   - Bracketed IUPAC: `[2H]2O`, `[235U]F6`, `[14C]O2`, `[60Co]`, `[3He]`
 *   - Hyphenated nuclides: `Co-60`, `U-235`, `H-3`, `Fe-56`
 *   - Leading-mass compounds/nuclides: `235UF6`, `238UF6`, `14CO2`, `60Co`, `137Cs`, `3He`
 *   - Natural formulas: `H2O`, `NaCl`, `CsF`, `FeO` (A = null -> natural abundance)
 */
export function describeIsotopologueFormula(input) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new TypeError('isotopologue formula input must be a non-empty string');
  }
  const raw = input.trim();

  // Case 1: Hyphenated single nuclide e.g. "Co-60", "U-235", "H-3", "He-4"
  const hyphenMatch = /^([A-Za-z]{1,2})-(\d{1,3})$/.exec(raw);
  if (hyphenMatch) {
    const sym = SYMBOL_BY_LOWER.get(hyphenMatch[1].toLowerCase());
    const A = Math.trunc(Number(hyphenMatch[2]));
    const Z = sym ? Z_BY_SYMBOL.get(sym) : null;
    if (Z && A >= Z && A <= 320) {
      const nuc = deriveNuclearClosure(Z, A);
      const sites = [Object.freeze({ Z, symbol: sym, A, count: 1, atomicMassU: nuc.atomicMassU })];
      const atomCounts = { [String(Z)]: 1 };
      return Object.freeze({
        input: raw,
        formula: raw,
        canonicalFormula: sym,
        canonicalIsotopologue: `${sym}-${A}`,
        hasExplicitIsotopes: true,
        sites: Object.freeze(sites),
        elements: Object.freeze([{ Z, symbol: sym, count: 1, A }]),
        atomCounts,
        atomCount: 1,
        elementCount: 1,
        molarMassKgPerMol: nuc.atomicMassU * 1e-3
      });
    }
  }

  // Case 2: Tokenized isotopologue parser supporting (), [A]Sym, leading A+Sym, D, T, and standard Sym
  const stack = [new Map()]; // key = `${Z}:${A ?? 'nat'}` -> { Z, symbol, A, count }
  let i = 0;
  let hasExplicitIsotopes = false;

  const addSite = (Z, A, count) => {
    const map = stack[stack.length - 1];
    const key = `${Z}:${A ?? 'nat'}`;
    const prev = map.get(key);
    const sym = symbolForZ(Z);
    if (prev) prev.count += count;
    else map.set(key, { Z, symbol: sym, A: A ?? null, count });
  };

  const readNumber = () => {
    let j = i;
    while (j < raw.length && raw[j] >= '0' && raw[j] <= '9') j += 1;
    if (j === i) return null;
    const val = Number(raw.slice(i, j));
    i = j;
    return val;
  };

  const readSymbol = () => {
    if (i >= raw.length) return null;
    // D = Deuterium (Z=1, A=2), T = Tritium (Z=1, A=3) when not followed by lowercase forming e.g. Dy/Db/Ti/Te/Ta/Tl/Th/Tm/Tb/Tc/Ts
    const two = i + 1 < raw.length && /[a-z]/.test(raw[i + 1]) ? raw.slice(i, i + 2) : null;
    if (two && Z_BY_SYMBOL.has(two)) {
      i += 2;
      return { Z: Z_BY_SYMBOL.get(two), A: null };
    }
    const one = raw[i];
    if (one === 'D') {
      i += 1;
      hasExplicitIsotopes = true;
      return { Z: 1, A: 2 };
    }
    if (one === 'T') {
      i += 1;
      hasExplicitIsotopes = true;
      return { Z: 1, A: 3 };
    }
    if (Z_BY_SYMBOL.has(one)) {
      i += 1;
      return { Z: Z_BY_SYMBOL.get(one), A: null };
    }
    return null;
  };

  let parsedOk = true;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '(') {
      stack.push(new Map());
      i += 1;
      continue;
    }
    if (ch === ')') {
      if (stack.length <= 1) { parsedOk = false; break; }
      i += 1;
      const mult = readNumber() ?? 1;
      const group = stack.pop();
      for (const entry of group.values()) {
        addSite(entry.Z, entry.A, entry.count * mult);
      }
      continue;
    }
    if (ch === '[') {
      i += 1;
      const massA = readNumber();
      const symObj = readSymbol();
      if (!massA || !symObj || raw[i] !== ']') { parsedOk = false; break; }
      i += 1; // skip ']'
      if (massA < symObj.Z || massA > 320) { parsedOk = false; break; }
      hasExplicitIsotopes = true;
      const count = readNumber() ?? 1;
      addSite(symObj.Z, massA, count);
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      // Leading mass number immediately before an element symbol (e.g. 235UF6, 14CO2, 60Co, 3He)
      const massA = readNumber();
      const symObj = readSymbol();
      if (!massA || !symObj || massA < symObj.Z || massA > 320) { parsedOk = false; break; }
      hasExplicitIsotopes = true;
      const count = readNumber() ?? 1;
      addSite(symObj.Z, massA, count);
      continue;
    }
    if (ch >= 'A' && ch <= 'Z') {
      const symObj = readSymbol();
      if (!symObj) { parsedOk = false; break; }
      const count = readNumber() ?? 1;
      addSite(symObj.Z, symObj.A, count);
      continue;
    }
    parsedOk = false;
    break;
  }

  if (!parsedOk || stack.length !== 1 || stack[0].size === 0) {
    // Fallback cleanly to standard case-insensitive chemical formula parser (e.g. "h2o", "fe", "co2")
    const base = describeChemicalFormula(raw);
    const sites = base.elements.map((e) => Object.freeze({
      Z: e.Z,
      symbol: e.symbol,
      A: null,
      count: e.count,
      atomicMassU: ATOMIC_MASS_U[e.Z - 1]
    }));
    return Object.freeze({
      ...base,
      canonicalIsotopologue: base.canonicalFormula,
      hasExplicitIsotopes: false,
      sites: Object.freeze(sites)
    });
  }

  const sites = [];
  const atomCounts = {};
  let molarMassU = 0;
  let atomCount = 0;
  for (const entry of stack[0].values()) {
    const massU = entry.A != null
      ? deriveNuclearClosure(entry.Z, entry.A).atomicMassU
      : ATOMIC_MASS_U[entry.Z - 1];
    molarMassU += massU * entry.count;
    atomCount += entry.count;
    atomCounts[String(entry.Z)] = (atomCounts[String(entry.Z)] || 0) + entry.count;
    sites.push(Object.freeze({
      Z: entry.Z,
      symbol: entry.symbol,
      A: entry.A,
      count: entry.count,
      atomicMassU: massU
    }));
  }
  sites.sort((a, b) => (a.Z - b.Z) || ((a.A ?? 0) - (b.A ?? 0)));
  const elements = Object.entries(atomCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([Z, count]) => ({ Z: Number(Z), symbol: symbolForZ(Number(Z)), count }));

  const canonicalIsotopologue = hasExplicitIsotopes
    ? (sites.length === 1 && sites[0].count === 1 && sites[0].A != null
      ? `${sites[0].symbol}-${sites[0].A}`
      : sites.map((s) => {
          const tag = s.A != null ? (s.Z === 1 && s.A === 2 ? 'D' : (s.Z === 1 && s.A === 3 ? 'T' : `[${s.A}${s.symbol}]`)) : s.symbol;
          return `${tag}${s.count === 1 ? '' : s.count}`;
        }).join(''))
    : canonicalFormulaFromCounts(atomCounts);

  return Object.freeze({
    input: raw,
    formula: raw,
    canonicalFormula: canonicalFormulaFromCounts(atomCounts),
    canonicalIsotopologue,
    hasExplicitIsotopes,
    sites: Object.freeze(sites),
    elements: Object.freeze(elements),
    atomCounts,
    atomCount,
    elementCount: elements.length,
    molarMassKgPerMol: molarMassU * 1e-3
  });
}
