import { stableOpticalMaterialId } from '../material/opticalGpuBuffers.js';
import { assertSphReactionGasLayout } from '../../../ulg-gpu-abi/src/sphGasConstitutive.js';
import { resolveThermalResponseGraphArtifacts } from './sphThermalGpuKernel.js';
import { isPhaseCaloricSegmentType } from './sphCondensableCaloricTable.js';

export const SPH_REACTION_ENERGY_REFERENCE_SCHEMA = 'peercompute.ulg.reaction-energy-reference.v1';
export const SPH_REACTION_ENERGY_AUTHORITY_SCHEMA = 'peercompute.ulg.reaction-energy-authority.v1';
const AUTHORITIES = new WeakMap();
const R = 8.314462618;
const ROUNDING_BUDGET = 1e-4;
const ARRAY_KEYS = ['records', 'reactionHeaders', 'reactantTermRecords', 'productTermRecords',
  'gasProductRecords', 'atomTermRecords', 'spectatorTermRecords', 'productPhaseRecords', 'combinedRecords',
  'gasConstitutiveRecords'];
const COUNT_KEYS = ['reactionCount', 'reactionHeaderCount', 'reactantTermCount', 'productTermCount',
  'gasProductCount', 'atomTermCount', 'productPhaseCount', 'combinedRecordCount',
  'gasConstitutiveSchema', 'gasConstitutiveOffsetVec4'];
const METADATA_KEYS = ['metadata', 'reactantTermMetadata', 'productTermMetadata',
  'gasProductMetadata', 'atomTermMetadata', 'productPhaseMetadata', 'energyMetadata'];
const metadataSnapshot = (table) => JSON.stringify(METADATA_KEYS.map((key) => table[key]));
const fail = (message) => { throw new TypeError(`Reaction energy authority: ${message}`); };
const number = (x, name, positive = false) => {
  if (typeof x !== 'number' || !Number.isFinite(x) || !Number.isFinite(Math.fround(x))
    || (positive && !(Math.fround(x) > 0))) fail(`${name} must be a finite representable number`);
  return x;
};
const same = (a, b) => a instanceof Float32Array && b instanceof Float32Array
  && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

// Reuse the exact piecewise-linear thermal graph samples in both directions.
// There is no second fitted caloric law, extrapolation or phase-from-U choice.
export function phaseCurves(artifacts, materialId) {
  const { thermalPhaseResponseTable: responses, thermalClosureGraphSet: graphs } = artifacts;
  const curves = [];
  for (let i = 0; i < responses.responseCount; i += 1) {
    const row = responses.responses.subarray(i * 16, i * 16 + 16);
    // Pure legacy, condensable and ideal-gas branches all use the same exact
    // monotone graph ABI. Latent plateaus remain excluded.
    if (row[0] !== materialId || (row[1] !== 1 && !isPhaseCaloricSegmentType(row[1])) || row[6] !== row[7]) continue;
    const graph = graphs.graphs[row[2]];
    const node = graph?.nodeRows;
    if (row[3] !== 1 || !graph || graph.nodeCount !== 1 || node[0] !== 1 || node[10] !== 1
      || node[1] !== 0 || node[2] !== 1 || node[6] !== row[4] || node[7] !== row[5]) {
      fail('phase requires an exact monotone thermal table graph');
    }
    const samples = Array.from(graph.sampleRows.slice(node[4] * 4, (node[4] + node[5]) * 4));
    if (samples.length < 8 || samples.length !== node[5] * 4 || !samples.every(Number.isFinite)) {
      fail('invalid phase graph samples');
    }
    for (let s = 4; s < samples.length; s += 4) {
      if (!(samples[s] > samples[s - 4]) || !(samples[s + 1] > samples[s - 3])) {
        fail('pure phase graph must increase in both U and T');
      }
    }
    if (samples[0] !== row[4] || samples.at(-4) !== row[5] || !(row[8] > 0)
      || row[8] !== row[9] || ![1, 2, 3, 4].includes(row[6])) fail('invalid pure phase endpoints');
    curves.push({ phaseId: row[6], density: row[8], samples,
      tMin: samples[1], tMax: samples.at(-3), uMin: samples[0], uMax: samples.at(-4) });
  }
  if (!curves.length) fail(`no pure caloric phase for material ${materialId}`);
  return curves;
}

export function sampleCurve(curve, value, inverse) {
  const input = inverse ? 1 : 0, output = inverse ? 0 : 1;
  const s = curve.samples;
  if (!Number.isFinite(value) || value < s[input] || value > s[s.length - 4 + input]) return null;
  for (let i = 4; i < s.length; i += 4) {
    if (value <= s[i + input]) {
      const alpha = (value - s[i - 4 + input]) / (s[i + input] - s[i - 4 + input]);
      return s[i - 4 + output] + alpha * (s[i + output] - s[i - 4 + output]);
    }
  }
  return null;
}

function phaseValue(term, phaseId, value, inverse) {
  let selected = null;
  for (const curve of term.curves) {
    if (curve.phaseId !== phaseId) continue;
    const result = sampleCurve(curve, value, inverse);
    if (result === null) continue;
    // A latent discontinuity at a shared temperature is not an unambiguous
    // pure-phase birth/reference. The phase-exchange solver owns mixtures.
    if (selected && (selected.value !== result || selected.curve.density !== curve.density)) return null;
    selected = { value: result, curve };
  }
  return selected;
}

function termList(table, reactionIndex, kind, artifacts, refs) {
  const metadata = table[kind === 'reactant' ? 'reactantTermMetadata' : 'productTermMetadata']
    .filter((term) => term.reactionIndex === reactionIndex);
  if (!Array.isArray(refs) || refs.length !== metadata.length || !metadata.length) {
    fail(`${kind} reference phases must cover every exact term in order`);
  }
  return metadata.map((term, i) => {
    const ref = refs[i];
    number(ref?.coefficient, 'reference coefficient', true);
    if (ref?.material !== term.material || Math.fround(ref.coefficient) !== Math.fround(term.coefficient)
      || ![1, 2, 3].includes(ref.phaseId)) fail(`${kind} reference term mismatch`);
    const termIndex = term[`${kind}TermIndex`];
    const stride = kind === 'reactant' ? 12 : 16;
    const rows = table[kind === 'reactant' ? 'reactantTermRecords' : 'productTermRecords'];
    const row = rows.subarray(termIndex * stride, (termIndex + 1) * stride);
    if (row[0] !== reactionIndex || row[1] !== stableOpticalMaterialId(ref.material)
      || !(row[2] > 0) || !(row[3] > 0)) fail('invalid packed term');
    const curves = phaseCurves(artifacts, row[1]);
    const targetPhase = kind === 'product' ? row[6] : 0;
    if (kind === 'product' && (![1, 2, 3].includes(targetPhase) || !curves.some((c) => c.phaseId === targetPhase)
      || row[5] !== (targetPhase === 3 ? 1 : 0))) fail('invalid target product phase/routing');
    return { material: term.material, materialId: row[1], coefficient: row[2], molarMass: row[3],
      termIndex, referencePhase: ref.phaseId, targetPhase, curves };
  });
}

function validateBalance(table, reactionIndex, reactants, products, {
  allowFractionalMixtureAtoms = false
} = {}) {
  if (reactants.length !== 2 || new Set(reactants.map((x) => x.materialId)).size !== 2) {
    fail('physical mode requires two distinct reactant carriers');
  }
  const atoms = new Map();
  const atomScale = new Map();
  let charge = 0;
  for (const [kind, terms, sign] of [[1, reactants, -1], [2, products, 1]]) {
    for (const term of terms) {
      let count = 0;
      for (let i = 0; i < table.atomTermCount; i += 1) {
        const row = table.atomTermRecords.subarray(i * 8, i * 8 + 8);
        if (row[0] !== reactionIndex || row[1] !== kind || row[2] !== term.termIndex) continue;
        const validAtomCount = allowFractionalMixtureAtoms
          ? (Number.isFinite(row[4]) && row[4] > 0)
          : (row[4] > 0 && Number.isInteger(row[4]));
        if (row[7] !== 1 || row[5] !== term.coefficient || !Number.isInteger(row[3])
          || row[3] < 1 || row[3] > 118 || !validAtomCount
          || !Number.isFinite(row[6])) fail('invalid atom/charge term');
        const contribution = row[4] * term.coefficient;
        atoms.set(row[3], (atoms.get(row[3]) || 0) + sign * contribution);
        atomScale.set(row[3], Math.max(atomScale.get(row[3]) || 0, Math.abs(contribution)));
        charge += sign * row[6] * term.coefficient;
        count += 1;
      }
      if (!count) fail('missing atom inventory for a reaction term');
    }
  }
  const atomImbalanced = [...atoms.entries()].some(([z, delta]) => (
    allowFractionalMixtureAtoms
      ? Math.abs(delta) > ROUNDING_BUDGET * Math.max(1, atomScale.get(z) || 1)
      : delta !== 0
  ));
  if (atomImbalanced || Math.abs(charge) > (allowFractionalMixtureAtoms ? ROUNDING_BUDGET : 0)) {
    fail('atom or charge imbalance');
  }
  const mass = (terms) => terms.reduce((sum, t) => sum + t.coefficient * t.molarMass, 0);
  const reactantMass = mass(reactants), productMass = mass(products);
  if (!(reactantMass > 0) || Math.abs(productMass - reactantMass) > ROUNDING_BUDGET * reactantMass) {
    fail('stoichiometric mass imbalance exceeds f32 budget');
  }
  return { reactantMass, productMass };
}

function thermalSnapshot(table) {
  return { materialCount: table.materialCount, segmentCount: table.segmentCount,
    records: table.records.slice(), segments: table.segments.slice(),
    // Source-segment metadata affects the Debye samples in legacy graphs.
    metadata: JSON.stringify(table.metadata) };
}

/** Append cold compiled DATA, never a reaction/material-specific kernel. */
export function attachSphReactionEnergyAuthority(table, reactions, thermalMaterialTable) {
  if (!reactions.some((r) => r?.energyReference !== undefined)) return table;
  if (!thermalMaterialTable) fail('explicit energy mode requires its thermal material table');
  const artifacts = resolveThermalResponseGraphArtifacts({ thermalMaterialTable, requireExactContent: true });
  const rows = Array.from(table.combinedRecords);
  const entries = new Map(), metadata = [];
  const append = (...values) => {
    const offset = rows.length / 4;
    if (!Number.isInteger(offset) || offset >= 2 ** 24) fail('energy data offset not exactly f32 representable');
    values.forEach((v) => rows.push(Math.fround(number(v, 'packed energy value'))));
    return offset;
  };
  const packTerm = (term) => {
    const offset = append(term.materialId, term.coefficient, term.molarMass, term.uRef,
      0, term.curves.length, term.referencePhase, term.targetPhase,
      term.termIndex, 1, 0, 0);
    const curvesOffset = rows.length / 4;
    for (const c of term.curves) append(c.phaseId, 0, c.samples.length / 4, c.density, c.tMin, c.tMax, c.uMin, c.uMax);
    rows[offset * 4 + 4] = curvesOffset;
    term.curves.forEach((c, index) => {
      rows[(curvesOffset + index * 2) * 4 + 1] = rows.length / 4;
      append(...c.samples);
    });
    term.offset = offset;
    return offset;
  };
  for (let index = 0; index < reactions.length; index += 1) {
    const reaction = reactions[index], ref = reaction?.energyReference;
    if (ref === undefined) continue;
    if (ref?.schema !== SPH_REACTION_ENERGY_REFERENCE_SCHEMA) fail('unknown reference schema');
    const source = ref.source;
    if (!['reference-thermochemistry', 'manufactured-analytic'].includes(source?.kind)
      || typeof source?.provenance !== 'string' || !source.provenance.trim()
      || typeof source?.fingerprint !== 'string' || !source.fingerprint.trim()
      || source.provisional !== false || source.phaseApplicable !== true) {
      fail('explicit, phase-applicable thermochemical reference source required');
    }
    if (reaction.specificEnthalpyJPerKg !== undefined && reaction.specificEnthalpyJPerKg !== 0) {
      fail('legacy heat proxy cannot be combined with physical reference energy');
    }
    if (table.records[index * 12 + 8] !== 1) fail('physical reaction table is not ready');
    const tRef = Math.fround(number(ref.referenceTemperatureK, 'reference temperature', true));
    const pRef = Math.fround(number(ref.referencePressurePa, 'reference pressure', true));
    const hasH = ref.reactionEnthalpyChangeJPerMolExtent !== undefined;
    const hasU = ref.reactionInternalEnergyChangeJPerMolExtent !== undefined;
    if (hasH === hasU) fail('exactly one signed reference DeltaH or DeltaU per mole extent is required');
    const reactants = termList(table, index, 'reactant', artifacts, ref.reactantPhases);
    const products = termList(table, index, 'product', artifacts, ref.productPhases);
    const { reactantMass, productMass } = validateBalance(table, index, reactants, products, {
      allowFractionalMixtureAtoms: Boolean(reaction.stoichiometry?.liftedOntoMixture)
    });
    let deltaPv = 0, deltaRuntime = 0;
    for (const [terms, sign] of [[reactants, -1], [products, 1]]) {
      for (const term of terms) {
        const state = phaseValue(term, term.referencePhase, tRef, true);
        if (!state) fail('reference temperature outside an unambiguous pure-phase graph');
        term.uRef = Math.fround(number(state.value, 'runtime reference U'));
        const pv = term.referencePhase === 3 ? R * tRef : pRef * term.molarMass / state.curve.density;
        deltaPv += sign * term.coefficient * pv;
        deltaRuntime += sign * term.coefficient * term.molarMass * term.uRef;
      }
    }
    const deltaPhysical = hasU ? number(ref.reactionInternalEnergyChangeJPerMolExtent, 'reference DeltaU')
      : number(ref.reactionEnthalpyChangeJPerMolExtent, 'reference DeltaH') - deltaPv;
    const tMin = Math.max(...products.map((t) => Math.min(...t.curves.filter((c) => c.phaseId === t.targetPhase).map((c) => c.tMin))));
    const tMax = Math.min(...products.map((t) => Math.max(...t.curves.filter((c) => c.phaseId === t.targetPhase).map((c) => c.tMax))));
    if (!(tMax > tMin)) fail('empty common product temperature domain');
    const offset = append(index, deltaPhysical, tRef, pRef, 0, reactants.length, 0, products.length,
      tMin, tMax, deltaRuntime - deltaPhysical, 1, deltaRuntime, reactantMass, productMass, ROUNDING_BUDGET);
    // Lists hold term descriptor offsets; fixed-width vec4 entries avoid new bindings.
    const reactantList = rows.length / 4;
    reactants.forEach(() => append(0, 0, 0, 0));
    const productList = rows.length / 4;
    products.forEach(() => append(0, 0, 0, 0));
    reactants.forEach((t, i) => { rows[(reactantList + i) * 4] = packTerm(t); });
    products.forEach((t, i) => { rows[(productList + i) * 4] = packTerm(t); });
    rows[offset * 4 + 4] = reactantList;
    rows[offset * 4 + 6] = productList;
    table.records[index * 12 + 9] = rows[index * 12 + 9] = 1;
    table.records[index * 12 + 10] = rows[index * 12 + 10] = offset;
    table.records[index * 12 + 11] = rows[index * 12 + 11] = 1;
    const entry = freeze({ reactionIndex: index, offset, reactants, products, tMin, tMax,
      deltaPhysical: Math.fround(deltaPhysical), deltaRuntime: Math.fround(deltaRuntime),
      gaugeCorrection: Math.fround(deltaRuntime - deltaPhysical) });
    entries.set(index, entry);
    metadata.push({ reactionIndex: index, mode: 'closed-adiabatic-runtime-gauge-corrected',
      referenceTemperatureK: tRef, referencePressurePa: pRef, source: structuredClone(source),
      physicalDeltaUReferenceJPerMolExtent: entry.deltaPhysical,
      runtimeDeltaUReferenceJPerMolExtent: entry.deltaRuntime,
      runtimeGaugeCorrectionJPerMolExtent: entry.gaugeCorrection,
      referenceDeltaPvJPerMolExtent: deltaPv, scientificValidation: false });
  }
  table.combinedRecords = new Float32Array(rows);
  table.combinedRecordCount = rows.length / 4;
  table.energyMetadata = metadata;
  table.energyAuthority = Object.freeze({ schema: SPH_REACTION_ENERGY_AUTHORITY_SCHEMA,
    mode: 'closed-adiabatic-runtime-gauge-corrected', reactionCount: entries.size,
    scientificValidation: false });
  AUTHORITIES.set(table, { token: table.energyAuthority, entries, thermal: thermalSnapshot(thermalMaterialTable),
    arrays: Object.fromEntries(ARRAY_KEYS.map((key) => [key, table[key].slice()])),
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, table[key]])), metadata: metadataSnapshot(table) });
  return table;
}

export function assertSphReactionEnergyAuthority(table, thermalMaterialTable = null) {
  const authority = AUTHORITIES.get(table);
  const marked = table?.energyAuthority !== undefined || table?.energyMetadata !== undefined
    || table?.records?.some((x, i) => i % 12 === 9 && x !== 0);
  if (!authority) {
    if (marked) fail('unissued or copied energy authority');
    assertSphReactionGasLayout(table);
    return false;
  }
  try {
    assertSphReactionGasLayout(table, { authenticatedCombinedLength: authority.arrays.combinedRecords.length });
  } catch (error) { fail(error.message); }
  if (authority.token !== table.energyAuthority || metadataSnapshot(table) !== authority.metadata
    || COUNT_KEYS.some((key) => table[key] !== authority.counts[key])
    || ARRAY_KEYS.some((key) => !same(table[key], authority.arrays[key]))) {
    fail('stale or inconsistent reaction energy/term content');
  }
  if (thermalMaterialTable) {
    const expected = authority.thermal;
    if (thermalMaterialTable.materialCount !== expected.materialCount
      || thermalMaterialTable.segmentCount !== expected.segmentCount
      || !same(thermalMaterialTable.records, expected.records) || !same(thermalMaterialTable.segments, expected.segments)
      || JSON.stringify(thermalMaterialTable.metadata) !== expected.metadata) fail('stale thermal content');
  }
  return true;
}

export function sphReactionEnergyEntry(table, reactionIndex) {
  return AUTHORITIES.get(table)?.entries.get(reactionIndex) || null;
}

export function sphReactionEnergySourceState(table, reactionIndex, sph, mls, index) {
  const entry = sphReactionEnergyEntry(table, reactionIndex);
  if (!entry) return null;
  const s = index * 8, t = index * 12, m = index * 32;
  const term = entry.reactants.find((x) => x.materialId === sph.thermo[t]);
  const phase = sph.thermo[t + 1], u = sph.state[s + 7];
  if (!term || ![1, 2, 3].includes(phase) || sph.thermo[t + 10] !== 1
    || !sph.thermo.subarray(t, t + 12).every(Number.isFinite)
    || !sph.state.subarray(s, s + 8).every(Number.isFinite)
    || !(sph.state[s + 3] > 0)) return null;
  for (let i = 0; i < 4; i += 1) if (sph.thermo[t + 4 + i] !== (i + 1 === phase ? 1 : 0)) return null;
  const resolved = phaseValue(term, phase, u, false);
  if (!resolved || !(resolved.value > 0) || sph.thermo[t + 3] !== resolved.curve.density
    || Math.abs(sph.thermo[t + 2] - resolved.value) > ROUNDING_BUDGET * resolved.value) return null;
  // First honest domain excludes unaccounted elastic/affine kinetic energy.
  for (let i = 0; i < 18; i += 1) if (mls.mechanics[m + i] !== ([0, 4, 8].includes(i) ? 1 : 0)) return null;
  if (mls.mechanics[m + 18] !== 1 || !(mls.mechanics[m + 19] > 0)) return null;
  return { term, temperatureK: resolved.value, phaseId: phase, specificInternalEnergyJPerKg: u };
}

export function sphReactionInterfaceFluxExtentCpu(sources, dtSeconds) {
  if (!(dtSeconds > 0)) return 3e38;
  const rate = Math.max(...sources.map((s) => s.term.interfaceFluxKgPerM2S
    * Math.sqrt(Math.max(s.temperatureK, 1) / 293.15) / Math.max(s.term.coefficient * s.term.molarMassKgPerMol, 1e-20)));
  if (!(rate > 0)) return 3e38;
  const radius = Math.min(...sources.map((s) => Math.pow(
    Math.max(3 * s.massKg / (12.5663706 * Math.max(s.restDensityKgPerM3, 1e-6)), 1e-30), 1 / 3)));
  return rate * 3.14159265 * radius * radius * dtSeconds;
}

export function solveSphReactionProductEnergyCpu(table, reactionIndex, sources, products, extentMol) {
  const entry = sphReactionEnergyEntry(table, reactionIndex);
  if (!entry) return null;
  const mass = sources.reduce((sum, s) => sum + s.consumedMassKg, 0);
  const velocity = [0, 1, 2].map((a) => sources.reduce((sum, s) => sum + s.consumedMassKg * s.velocity[a], 0) / mass);
  let target = -extentMol * entry.deltaPhysical;
  for (const source of sources) {
    const term = entry.reactants.find((t) => t.materialId === source.materialId);
    if (!term) return null;
    const relativeSquared = source.velocity.reduce((sum, v, a) => sum + (v - velocity[a]) ** 2, 0);
    target += source.consumedMassKg * (source.specificInternalEnergyJPerKg - term.uRef + 0.5 * relativeSquared);
  }
  const evaluate = (temperatureK) => {
    let total = 0;
    const states = [];
    for (const product of products) {
      const term = entry.products.find((t) => t.termIndex === product.term.productTermIndex);
      if (!term) return null;
      const resolved = phaseValue(term, term.targetPhase, temperatureK, true);
      if (!resolved) return null;
      const u = resolved.value;
      total += product.massKg * (u - term.uRef);
      states.push({ phaseId: term.targetPhase, temperatureK, specificInternalEnergyJPerKg: u,
        restDensityKgPerM3: resolved.curve.density,
        phaseFractions: { solid: term.targetPhase === 1 ? 1 : 0, liquid: term.targetPhase === 2 ? 1 : 0,
          gas: term.targetPhase === 3 ? 1 : 0, plasma: term.targetPhase === 4 ? 1 : 0 }, status: 1 });
    }
    return { total, states };
  };
  let lo = entry.tMin, hi = entry.tMax;
  const lower = evaluate(lo), upper = evaluate(hi);
  if (!Number.isFinite(target) || !lower || !upper || target < lower.total || target > upper.total) return null;
  for (let i = 0; i < 40; i += 1) {
    const mid = lo + (hi - lo) * 0.5, value = evaluate(mid);
    if (!value) return null;
    if (value.total < target) lo = mid; else hi = mid;
  }
  const temperatureK = lo + (hi - lo) * 0.5, result = evaluate(temperatureK);
  if (!result || !result.states.every((s) => Number.isFinite(Math.fround(s.specificInternalEnergyJPerKg)))) return null;
  const gaugeCorrectionJ = products.reduce((sum, p, i) => sum + p.massKg * entry.products[i].uRef, 0)
    - sources.reduce((sum, s) => sum + s.consumedMassKg * entry.reactants.find((t) => t.materialId === s.materialId).uRef, 0);
  return { temperatureK, states: result.states, velocity,
    physicalReferenceEnergyChangeJ: extentMol * entry.deltaPhysical,
    runtimeGaugeCorrectionJ: gaugeCorrectionJ,
    runtimeEnergyChangeJ: gaugeCorrectionJ - extentMol * entry.deltaPhysical,
    externalHeatJ: 0, productSensibleEnergyJ: result.total, targetSensibleEnergyJ: target };
}
