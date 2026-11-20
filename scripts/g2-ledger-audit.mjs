// G2 integer-ledger audit of a live run recorded by step0-baseline-probe.mjs
// with S0_LEDGER_AUDIT=1. Decodes the cold and final mass and energy records
// and checks, with no tolerance:
//   - the energy record's error flags are clear;
//   - total exact mass is unchanged;
//   - sum(U - S) equals the cold sum(U) (S is cumulative recorded sources).
// It also reports steam (gas-lane) mass, from the phase-lane layout.
//
//   node scripts/g2-ledger-audit.mjs <probe-evidence.json>
import { readFile } from 'node:fs/promises';
import { createSphExactMassFormat, encodeSphExactMass, projectSphExactMassF32Bits } from '../ulg-gpu-abi/src/sphExactMassInventory.js';
import { decodeSphExactSignedUnits } from '../ulg-gpu-abi/src/sphExactSignedLedger.js';
import { SPH_EXACT_THERMAL_ENERGY_ERROR, SPH_EXACT_THERMAL_ENERGY_STATUS_NO_PAIR_EXCHANGE,
  SPH_EXACT_THERMAL_ENERGY_STATUS_MECHANICS_HEAT } from '../src/runtime/sph/sphExactThermalEnergyWgsl.js';
import { SPH_EXACT_PHASE_LEDGER_ERROR } from '../src/runtime/sph/sphExactPhaseLedgerReconcileGpu.js';
import { SPH_EXACT_REACTION_LEDGER_ERROR, SPH_EXACT_REACTION_LEDGER_STATUS_REACTION }
  from '../src/runtime/sph/sphExactReactionLedgerReconcileGpu.js';

const format = createSphExactMassFormat();
const W = format.wordCount;
const evidence = JSON.parse(await readFile(process.argv[2], 'utf8'));
const audit = evidence.ledgerAudit?.find(entry => entry.value.latest['ulg-exact-energy-phase-ledger']
  || entry.value.latest['ulg-exact-energy-thermal'])?.value;
if (!audit) throw new Error('No ledger audit in this evidence file');
const coldMass = audit.cold['ulg-exact-mass-initial'];
const coldEnergy = audit.cold['ulg-exact-energy-initial'];
const rows = coldMass.length / W;
// Older evidence stored one buffer per label; newer stores the last few.
const candidates = label => { const v = audit.latest[label]; return !v ? [] : Array.isArray(v[0]) || v[0]?.error ? v : [v]; };
// The most advanced written energy record: its cumulative ledger particle-step counter is largest.
const energyRecords = ['ulg-exact-energy-phase-ledger', 'ulg-exact-energy-reaction-ledger', 'ulg-exact-energy-thermal']
  .flatMap(label => candidates(label).filter(Array.isArray).map(words => ({ label, words })));
const finalEnergyRecord = energyRecords.reduce((best, r) => (!best || r.words[2 * rows * W + 3] > best.words[2 * rows * W + 3]) ? r : best, null);
const finalEnergy = finalEnergyRecord?.words;
const massRecords = candidates('ulg-exact-mass-ledger-phase-successor').filter(Array.isArray).filter(w => w.some(x => x !== 0));
const finalMass = massRecords.at(-1) ?? null;
const unsigned = (words, row) => words.slice(row * W, (row + 1) * W).reduceRight((v, w) => (v << 32n) | BigInt(w >>> 0), 0n);
const signed = (words, base, row) => decodeSphExactSignedUnits(Uint32Array.from(words.slice(base + row * W, base + (row + 1) * W)), format);
const sum = values => values.reduce((a, b) => a + b, 0n);
const indices = Array.from({ length: rows }, (_, row) => row);
const control = finalEnergy.slice(2 * rows * W);
const errorBits = { ...SPH_EXACT_THERMAL_ENERGY_ERROR,
  ...Object.fromEntries(Object.entries(SPH_EXACT_PHASE_LEDGER_ERROR).map(([k, v]) => [`PHASE_${k}`, v])),
  ...Object.fromEntries(Object.entries(SPH_EXACT_REACTION_LEDGER_ERROR).map(([k, v]) => [`REACTION_${k}`, v])) };
const errors = Object.entries(errorBits).filter(([, bit]) => control[0] & bit).map(([name]) => name);
const coldU = sum(indices.map(row => signed(coldEnergy, 0, row)));
const finalBudget = sum(indices.map(row => signed(finalEnergy, 0, row) - signed(finalEnergy, rows * W, row)));
const sources = sum(indices.map(row => signed(finalEnergy, rows * W, row)));
const lineages = rows / 4;
const kg = value => new Float32Array(new Uint32Array([projectSphExactMassF32Bits(
  Uint32Array.from(Array.from({ length: W }, (_, i) => Number((value >> BigInt(32 * i)) & 0xffffffffn))), format).bits]).buffer)[0];
const laneMass = lane => finalMass ? sum(indices.filter(row => Math.floor(row / lineages) === lane).map(row => unsigned(finalMass, row))) : null;
// Ledger parcels (G2 Phases 4-5): [dry | water | U] per parcel plus the
// sinks [wall mass | wall U | solute]; their mass and energy join the budget.
const parcelRowsCold = audit.cold.parcelRows ?? null;
const parcelRowsNow = candidates('ulg-ledger-parcel-rows').filter(Array.isArray).at(-1) ?? null;
const sinksNow = candidates('ulg-ledger-parcel-sinks').filter(Array.isArray).at(-1) ?? null;
const parcelTotals = words => {
  if (!words) return { mass: 0n, energy: 0n, water: 0n, count: 0 };
  const count = words.length / (3 * W); let mass = 0n, energy = 0n, water = 0n;
  for (let p = 0; p < count; p++) {
    const dry = unsigned(words, 3 * p), wet = unsigned(words, 3 * p + 1);
    mass += dry + wet; water += wet; energy += signed(words, 0, 3 * p + 2);
  }
  return { mass, energy, water, count };
};
const parcelsCold = parcelTotals(parcelRowsCold), parcelsNow = parcelTotals(parcelRowsNow);
const sinkMass = sinksNow ? unsigned(sinksNow, 0) + unsigned(sinksNow, 2) : 0n;
const sinkEnergy = sinksNow ? signed(sinksNow, 0, 1) : 0n;
// G3 coherent rigid solid members (8 words each, mass f32 at word 3; released members set mass = 0
// while transferring exact el_from_f32_bits(mass) into their reserved fluid exact_mass_rows slot).
const solidMembersCold = audit.cold.solidMembers ?? null;
const solidMembersNow = candidates('ulg-solid-members').filter(Array.isArray).at(-1) ?? null;
const solidTotals = words => {
  if (!words) return { mass: 0n, alive: 0, total: 0 };
  const f = new Float32Array(Uint32Array.from(words).buffer);
  const total = Math.floor(f.length / 8);
  let mass = 0n, alive = 0;
  for (let i = 0; i < total; i++) {
    const m = f[i * 8 + 3];
    if (m > 0) {
      alive += 1;
      const enc = encodeSphExactMass(m, format);
      mass += Array.from(enc).reduceRight((v, w) => (v << 32n) | BigInt(w >>> 0), 0n);
    }
  }
  return { mass, alive, total };
};
const solidsCold = solidTotals(solidMembersCold), solidsNow = solidTotals(solidMembersNow);
const report = {
  rows, lineages, energyRecord: finalEnergyRecord?.label ?? null,
  simTimeS: evidence.samples.at(-1)?.simTimeS ?? null,
  ledgerErrors: errors,
  status: { noPairExchange: Boolean(control[1] & SPH_EXACT_THERMAL_ENERGY_STATUS_NO_PAIR_EXCHANGE),
    mechanicsHeat: Boolean(control[1] & SPH_EXACT_THERMAL_ENERGY_STATUS_MECHANICS_HEAT),
    reaction: Boolean(control[1] & SPH_EXACT_REACTION_LEDGER_STATUS_REACTION),
    particleStepsWithoutPairExchange: control[2], ledgerParticleSteps: control[3] },
  massExact: finalMass ? sum(indices.map(row => unsigned(finalMass, row))) + parcelsNow.mass + sinkMass + solidsNow.mass
    === sum(indices.map(row => unsigned(coldMass, row))) + parcelsCold.mass + solidsCold.mass : null,
  energyBudgetExact: finalBudget + parcelsNow.energy + sinkEnergy === coldU + parcelsCold.energy,
  solids: solidMembersNow ? { alive: solidsNow.alive, total: solidsNow.total, released: solidsCold.alive - solidsNow.alive,
    aliveMassKg: Number(solidsNow.mass) * 2 ** -149 } : null,
  parcels: parcelRowsNow ? { count: parcelsNow.count, waterKg: Number(parcelsNow.water) * 2 ** -149,
    sinkMassKg: Number(sinkMass) * 2 ** -149 } : null,
  recordedSourcesJ: Number(sources) * 2 ** -149,
  laneMassKg: finalMass ? [0, 1, 2, 3].map(lane => kg(laneMass(lane))) : null,
  steamPresent: finalMass ? laneMass(2) > 0n : null
};
// Element budget (sodium-water): exact row masses times the elemental mass
// fraction of each row's material, cold vs final. The fractions use standard
// atomic masses, not the material table's molar masses, so the residual also
// carries that table's molar-mass inconsistency.
const finalThermoWords = candidates('ulg-sph-phase-carrier-transfer-thermo').filter(Array.isArray).at(-1);
if (audit.cold.thermo && finalThermoWords && finalMass) {
  const { stableOpticalMaterialId } = await import('../src/runtime/material/opticalGpuBuffers.js');
  const atomic = { H: 1.008, C: 12.011, N: 14.007, O: 15.999, Na: 22.98976928, Ar: 39.948, Fe: 55.845 };
  const species = {
    na: { Na: 1 }, h2o: { H: 2, O: 1 }, naoh: { Na: 1, O: 1, H: 1 }, na2o: { Na: 2, O: 1 }, h2: { H: 2 },
    fe: { Fe: 1 }, feo: { Fe: 1, O: 1 }, fe3o4: { Fe: 3, O: 4 }, fe2o3: { Fe: 2, O: 3 },
    n2: { N: 2 }, o2: { O: 2 }, ar: { Ar: 1 }, co2: { C: 1, O: 2 }
  };
  const byId = new Map(Object.entries(species).map(([name, formula]) => [Math.fround(stableOpticalMaterialId(name)), { name, formula,
    M: Object.entries(formula).reduce((a, [e, n]) => a + n * atomic[e], 0) }]));
  const finalThermo = new Float32Array(Uint32Array.from(finalThermoWords).buffer);
  const tally = (massWords, thermo) => {
    const elements = Object.fromEntries(Object.keys(atomic).map(k => [k, 0]));
    const bySpecies = {};
    let unknownKg = 0;
    for (const row of indices) {
      const m = Number(unsigned(massWords, row)) * 2 ** -149;
      if (!(m > 0)) continue;
      const sp = byId.get(thermo[row * 12]);
      if (!sp) { unknownKg += m; continue; }
      bySpecies[sp.name] = (bySpecies[sp.name] ?? 0) + m;
      for (const [e, n] of Object.entries(sp.formula)) elements[e] += m * n * atomic[e] / sp.M;
    }
    return { elements, bySpecies, unknownKg };
  };
  const cold = tally(coldMass, audit.cold.thermo), last = tally(finalMass, finalThermo);
  report.elementBudget = { cold, final: last,
    residualKg: Object.fromEntries(Object.keys(cold.elements).map(e => [e, last.elements[e] - cold.elements[e]])),
    note: 'standard atomic masses; final mass and thermo are the newest readable records and may be one step apart' };
}
// Lineage: every delivery traces to a committed pair of the same generation
// whose reaction is admitted in the table (rx < reaction count).
const lineageWords = candidates('ulg-exact-reaction-lineage').filter(Array.isArray).at(-1);
if (lineageWords) {
  const count = Math.min(lineageWords[0], 65536);
  const rowsL = Array.from({ length: count }, (_, i) => lineageWords.slice(8 + i * 8, 16 + i * 8));
  const pairs = rowsL.filter(r => r[1] === 1), deliveries = rowsL.filter(r => r[1] === 2);
  const pairKeys = new Set(pairs.map(r => `${r[0]}:${r[3]}:${r[4]}`));
  const untraced = deliveries.filter(r => !pairKeys.has(`${r[0]}:${r[5]}:${r[6]}`));
  const reactions = new Map(); for (const r of pairs) reactions.set(r[2], (reactions.get(r[2]) ?? 0) + 1);
  report.lineage = { logged: lineageWords[0], overflow: lineageWords[0] > 65536, committedPairs: pairs.length,
    deliveries: deliveries.length, merges: deliveries.filter(r => r[4] === 4).length,
    spareRows: deliveries.filter(r => r[4] === 3).length, untracedDeliveries: untraced.length,
    pairsByReaction: Object.fromEntries(reactions), generations: new Set(rowsL.map(r => r[0])).size };
}
console.log(JSON.stringify(report, null, 1));
process.exitCode = report.ledgerErrors.length || report.massExact === false || !report.energyBudgetExact
  || report.lineage?.untracedDeliveries ? 1 : 0;
