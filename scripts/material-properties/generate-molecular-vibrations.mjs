// Offline generator: harmonic vibrational frequencies for the demo's molecular
// gas species, derived from our own electronic-structure stack (optimize the
// geometry on the HF/STO-3G surface, then diagonalize the mass-weighted
// numerical Hessian). The banked frequencies feed temperature-dependent gas
// heat capacities Cp(T) through the Einstein vibrational terms in
// molecularThermochemistry.idealGasHeatCapacity — derived, not tabulated.
//
// Scope is deliberately polyatomic-only (3+ atoms): RHF/STO-3G locates
// reliable single-reference minima for CO2/H2O, and their low-frequency bends
// are thermally active at demo temperatures. Multiply-bonded diatomics (N2,
// O2) are excluded by the documented single-determinant limitation (the RHF
// minimum is mislocated for multiple bonds — see plan/todo/frontier-todo.md);
// their single stretch (>1500 cm^-1) is frozen at ambient anyway, so
// equipartition is the exact physics for them and stays the runtime fallback.
//
// Cost note: the numerical Hessian is O((3N)^2) SCF evaluations in JS — this
// runs offline once and the result is committed to the bank, never at cold
// start (each polyatomic costs minutes).
//
// Usage: node scripts/material-properties/generate-molecular-vibrations.mjs [--write] [--species=h2o,co2]

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hashPayload } from '../../ulg-gpu-abi/src/index.js';
import {
  optimizeGeometry,
  rhf,
  vibrationalFrequencies
} from '../../src/runtime/electronicStructure/molecularHartreeFock.js';
import {
  idealGasHeatCapacity,
  isLinearMolecule
} from '../../src/runtime/electronicStructure/molecularThermochemistry.js';
import {
  canonicalFormula,
  formulaMolarMassKgPerMol,
  formulaUnitGeometry,
  parseChemicalFormula
} from '../../src/runtime/material/materialDerivation.js';

export const MOLECULAR_VIBRATIONS_BANK_SCHEMA = 'peercompute.ulg.molecular-vibrations-bank.v1';
export const MOLECULAR_VIBRATIONS_RECORD_SCHEMA = 'peercompute.ulg.molecular-vibrations-record.v1';
const METHOD = 'rhf-sto3g-optimized-geometry-numerical-hessian-harmonic-frequencies';

const repoDir = path.resolve(process.env.ULG_REPO_DIR || process.cwd());
const bankPath = path.join(repoDir, 'data', 'material-properties', 'molecular-vibrations.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const speciesArg = args.find((arg) => arg.startsWith('--species='));

// Polyatomic gas species the demo's gas closures consume.
const DEFAULT_SPECIES = ['H2O', 'CO2'];
const IMAGINARY_MODE_FLOOR_CM1 = 50;
// Physical harmonic vibrations top out near the H2 stretch (~4400 cm^-1;
// HF/STO-3G overestimates ~20-30%). Anything past this ceiling means the
// optimizer walked into an SCF-failure or collapsed geometry.
const UNPHYSICAL_MODE_CEILING_CM1 = 8000;

// Reject unconverged SCF energies outright: at pathological geometries the
// SCF loop can exit at maxIter with a garbage-low energy, and a line search
// that trusts it walks the molecule into collapse (seen: CO2 "modes" at
// 74k-129k cm^-1 from a squeezed clump that never converged).
const convergedEnergyHa = (a) => {
  const r = rhf(a);
  return r.scfConverged ? r.totalEnergyHa : Number.POSITIVE_INFINITY;
};

// Internal-coordinate optimization for centrosymmetric-ish triatomics
// (X-Y-X): parameterize by bond length r and bend angle theta and do
// coordinate descent with golden-section line searches on the CONVERGED
// RHF energy. Cartesian steepest descent deterministically collapses or
// dissociates CO2 from generic seeds (see plan/log.md 2026-07-08); two
// physical coordinates cannot wander off the bonding valley.
function goldenMinimize(f, lo, hi, tolerance = 1e-4, maxIter = 40) {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo;
  let b = hi;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < maxIter && (b - a) > tolerance; i += 1) {
    if (fc < fd) {
      b = d; d = c; fd = fc;
      c = b - phi * (b - a);
      fc = f(c);
    } else {
      a = c; c = d; fc = fd;
      d = a + phi * (b - a);
      fd = f(d);
    }
  }
  return fc < fd ? c : d;
}

function triatomicGeometry(centerZ, outerZ, rBohr, thetaRad) {
  const half = thetaRad / 2;
  return [
    { Z: centerZ, position: [0, 0, 0] },
    { Z: outerZ, position: [rBohr * Math.sin(half), 0, rBohr * Math.cos(half)] },
    { Z: outerZ, position: [-rBohr * Math.sin(half), 0, rBohr * Math.cos(half)] }
  ];
}

function optimizeSymmetricTriatomicInternal(centerZ, outerZ) {
  const energyAt = (r, theta) => {
    const result = rhf(triatomicGeometry(centerZ, outerZ, r, theta));
    return result.scfConverged ? result.totalEnergyHa : Number.POSITIVE_INFINITY;
  };
  let r = 2.4;
  let theta = Math.PI * 0.9;
  for (let sweep = 0; sweep < 4; sweep += 1) {
    r = goldenMinimize((x) => energyAt(x, theta), Math.max(1.2, r - 0.8), r + 0.8, 5e-4);
    theta = goldenMinimize((x) => energyAt(r, x), Math.max(1.2, theta - 0.6), Math.min(Math.PI, theta + 0.6), 5e-4);
  }
  return { atoms: triatomicGeometry(centerZ, outerZ, r, theta), rBohr: r, thetaRad: theta, energyHa: energyAt(r, theta) };
}

function deriveSpeciesRecord(formula) {
  const startedAtMs = Date.now();
  const counts = parseChemicalFormula(formula);
  const key = canonicalFormula(counts);
  const atomTotal = Object.values(counts).reduce((s, n) => s + n, 0);
  if (atomTotal < 3) {
    return {
      schema: MOLECULAR_VIBRATIONS_RECORD_SCHEMA,
      key,
      formula,
      status: 'rejected-diatomic-single-reference-multiple-bond-risk',
      vibrationsCm1: null,
      note: 'diatomics keep equipartition: single stretch is frozen at demo temperatures; '
        + 'RHF minima for multiple bonds are mislocated (single-determinant limitation)'
    };
  }
  // Symmetric triatomics (one center atom, two identical outers) optimize
  // in internal coordinates; everything else keeps the Cartesian path.
  const zEntries = Object.entries(counts).map(([z, n]) => [Number(z), n]);
  const symmetricTriatomic = atomTotal === 3
    && zEntries.length === 2
    && zEntries.some(([, n]) => n === 2)
    && zEntries.some(([, n]) => n === 1);
  let atoms;
  let internalCoordinateSummary = null;
  if (symmetricTriatomic) {
    const centerZ = zEntries.find(([, n]) => n === 1)[0];
    const outerZ = zEntries.find(([, n]) => n === 2)[0];
    const internal = optimizeSymmetricTriatomicInternal(centerZ, outerZ);
    atoms = internal.atoms;
    internalCoordinateSummary = {
      method: 'internal-coordinate-golden-section-descent',
      bondLengthBohr: Number(internal.rBohr.toPrecision(6)),
      bendAngleDeg: Number((internal.thetaRad * 180 / Math.PI).toPrecision(6)),
      energyHa: Number(internal.energyHa.toPrecision(10))
    };
  } else {
    const guess = formulaUnitGeometry(counts);
    atoms = optimizeGeometry(guess, { method: convergedEnergyHa, maxStepBohr: 0.3 }).atoms;
  }
  // Linear molecules have 3N-5 vibrations: only 5 zero modes (two rotations)
  // must be dropped, or a degenerate bend is discarded with them (CO2's
  // second 566 cm^-1 bend was eaten by the default nonlinear drop of 6).
  const linear = isLinearMolecule(atoms);
  const { vibrationsCm1 } = vibrationalFrequencies(atoms, {
    method: (a) => rhf(a).totalEnergyHa,
    dropModes: atomTotal === 2 ? 5 : (linear ? 5 : 6)
  });
  const expectedModeCount = 3 * atomTotal - (linear ? 5 : 6);
  const imaginary = vibrationsCm1.filter((nu) => nu < IMAGINARY_MODE_FLOOR_CM1);
  // A bound minimum keeps every atom within bonding range of a neighbor
  // (4 Bohr ~ 2.1 A); a dissociated fragment set can otherwise pass the
  // mode-count check (seen: CO2 splitting to O2 + distant C).
  const BONDING_RANGE_BOHR = 4;
  const fragmented = atoms.some((a, i) => !atoms.some((b, j) => {
    if (j === i) return false;
    const dx = a.position[0] - b.position[0];
    const dy = a.position[1] - b.position[1];
    const dz = a.position[2] - b.position[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) < BONDING_RANGE_BOHR;
  }));
  const unphysical = vibrationsCm1.filter((nu) => nu > UNPHYSICAL_MODE_CEILING_CM1);
  const status = fragmented
    ? 'rejected-fragmented-not-a-bound-minimum'
    : (unphysical.length > 0
        ? 'rejected-unphysical-mode-frequencies'
        : (imaginary.length > 0
            ? 'rejected-imaginary-or-soft-modes-not-a-minimum'
            : (vibrationsCm1.length !== expectedModeCount
                ? 'rejected-unexpected-mode-count'
                : 'harmonic-minimum-closed')));
  const cp298 = status === 'harmonic-minimum-closed'
    ? idealGasHeatCapacity(atoms, vibrationsCm1, 298.15)
    : null;
  return {
    schema: MOLECULAR_VIBRATIONS_RECORD_SCHEMA,
    key,
    formula,
    status,
    method: METHOD,
    linear,
    optimizedAtoms: atoms.map((a) => ({ Z: a.Z, positionBohr: a.position.map((x) => Number(x.toPrecision(8))) })),
    vibrationsCm1: vibrationsCm1.map((nu) => Number(nu.toPrecision(6))),
    expectedModeCount,
    internalCoordinateSummary,
    molarMassKgPerMol: Number(formulaMolarMassKgPerMol(counts).toPrecision(10)),
    cpJPerMolKAt298K: cp298 ? Number(cp298.cpJPerMolK.toPrecision(6)) : null,
    derivationMs: Date.now() - startedAtMs
  };
}

const species = speciesArg
  ? speciesArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_SPECIES;

const records = [];
for (const formula of species) {
  process.stdout.write(`deriving ${formula}...\n`);
  const record = deriveSpeciesRecord(formula);
  process.stdout.write(`  ${record.status}`
    + (record.vibrationsCm1 ? ` modes=[${record.vibrationsCm1.map((v) => Math.round(v)).join(', ')}] cm^-1` : '')
    + (record.cpJPerMolKAt298K ? ` Cp(298K)=${record.cpJPerMolKAt298K} J/mol/K` : '')
    + (record.derivationMs ? ` (${(record.derivationMs / 1000).toFixed(1)}s)` : '')
    + '\n');
  records.push(record);
}

// Subset runs (--species=...) merge into the existing bank instead of
// clobbering records for species not derived this run.
let mergedRecords = records;
try {
  const existing = JSON.parse(await readFile(bankPath, 'utf8'));
  const derivedKeys = new Set(records.map((r) => r.key));
  mergedRecords = [
    ...(existing.records || []).filter((r) => !derivedKeys.has(r.key)),
    ...records
  ];
} catch {
  // No existing bank; write the fresh records.
}

const bank = {
  schema: MOLECULAR_VIBRATIONS_BANK_SCHEMA,
  method: METHOD,
  generatorFingerprint: hashPayload({
    schema: MOLECULAR_VIBRATIONS_BANK_SCHEMA,
    method: METHOD,
    species: mergedRecords.map((r) => r.formula)
  }),
  records: mergedRecords
};

if (write) {
  await writeFile(bankPath, `${JSON.stringify(bank, null, 2)}\n`);
  process.stdout.write(`wrote ${bankPath}\n`);
} else {
  process.stdout.write(`${JSON.stringify(bank, null, 2)}\n`);
  process.stdout.write('(dry run; pass --write to update the bank)\n');
}
