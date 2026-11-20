// G2 gauge-consistent heat proxy (user decision 2026-11-16; plan/todo/interface-resolution.md
// "Iron Ice condensate plume"). The heat-proxy law stays: products receive the
// consumed internal (+ thermalized kinetic) energy plus the proxy heat
// -h * m. But a table whose materials use different caloric gauges (room-air
// gases at u = cv T, water at its NIST reference, legacy segments on their own
// ladder) cannot average raw u across them. So every species' energy is taken
// relative to its own value at one reference temperature, and the proxy heat
// applies there:
//
//   sum_p m_p (u_p - u_p,ref) = sum_r m_r (u_r - u_r,ref) - h m (+ kinetic terms)
//
// With equal sensible energy per kg across products (as the legacy proxy
// already assumes), each product's runtime u is the legacy value plus a
// constant per product term:
//
//   delta_p = u_p,ref - sum_r w_r u_r,ref,   w_r = nu_r M_r / sum nu M,
//
// carried in the product term record's free word 15 (pad0) and added by the
// GPU where the product energy is written. Each u_ref is the runtime graph's
// own value at T_ref (the energy authority's exact thermal-graph samples), so
// each gauge's zero cancels. Single-gauge (all-legacy) tables are unchanged:
// their gauges already agree, and their existing evidence stays bit-identical.
import {
  hasCondensableCaloricRows,
  isPhaseCaloricSegmentType,
  SPH_THERMAL_GAS_ONLY_CALORIC_SEGMENT_TYPE
} from './sphCondensableCaloricTable.js';
import { resolveThermalResponseGraphArtifacts } from './sphThermalGpuKernel.js';
import { phaseCurves, sampleCurve } from './sphReactionEnergyAuthority.js';

export const SPH_REACTION_HEAT_PROXY_GAUGE_SCHEMA = 'peercompute.ulg.reaction-heat-proxy-gauge.v1';
export const SPH_REACTION_HEAT_PROXY_REFERENCE_TEMPERATURE_K = 298.15;
const PRODUCT_TERM_FLOATS = 16;
const REACTANT_TERM_FLOATS = 12;
const GAUGE_WORD = 15;
const ISSUED = new WeakMap();

const fail = (message) => { throw new TypeError(`Gauge-consistent heat proxy: ${message}`); };

// Single-phase ideal-gas phase-caloric products (e.g. H2 in room-air
// sodium-water) have one unambiguous gas branch u = Cv*T and explicit phase 3;
// multi-phase condensable phase-caloric products still require explicit
// phase-resolved physical reaction energy.
function materialHasMultiPhaseCaloricRows(thermalMaterialTable, materialId) {
  const rows = thermalMaterialTable?.segments;
  for (let offset = 0; offset + 1 < (rows?.length ?? 0); offset += 12) {
    if (
      rows[offset] === materialId
      && isPhaseCaloricSegmentType(rows[offset + 1])
      && rows[offset + 1] !== SPH_THERMAL_GAS_ONLY_CALORIC_SEGMENT_TYPE
    ) return true;
  }
  return false;
}

// The runtime U of a material at T_ref: on the requested phase's graph, or
// (reactants) the lowest-U pure phase whose graph contains T_ref, which is the
// stable condensed or gas branch at that temperature.
function referenceEnergy(artifacts, materialId, temperatureK, phaseId = 0) {
  let best = null;
  for (const curve of phaseCurves(artifacts, materialId)) {
    if (phaseId && curve.phaseId !== phaseId) continue;
    const u = sampleCurve(curve, temperatureK, true);
    if (u === null) continue;
    if (!best || u < best.u) best = { u, phaseId: curve.phaseId };
  }
  if (!best) fail(`material ${materialId} has no pure phase graph containing ${temperatureK} K`);
  return best;
}

function thermalSnapshot(table) {
  return { materialCount: table.materialCount, segmentCount: table.segmentCount,
    records: table.records.slice(), segments: table.segments.slice(), metadata: JSON.stringify(table.metadata) };
}

/** Attach the per-product-term gauge offsets (a no-op on single-gauge tables). */
export function attachSphReactionHeatProxyGauge(table, thermalMaterialTable, {
  referenceTemperatureK = SPH_REACTION_HEAT_PROXY_REFERENCE_TEMPERATURE_K
} = {}) {
  if (!table?.reactionCount || table.energyAuthority || !thermalMaterialTable
    || !hasCondensableCaloricRows(thermalMaterialTable)) return table;
  const artifacts = resolveThermalResponseGraphArtifacts({ thermalMaterialTable, requireExactContent: true });
  const productBase = table.records.length + table.productPhaseRecords.length + table.reactionHeaders.length
    + table.reactantTermRecords.length;
  const combined = Float32Array.from(table.combinedRecords);
  const productTerms = Float32Array.from(table.productTermRecords);
  const entries = [];
  for (let reaction = 0; reaction < table.reactionCount; reaction += 1) {
    const reactants = table.reactantTermMetadata.filter((term) => term.reactionIndex === reaction);
    const products = table.productTermMetadata.filter((term) => term.reactionIndex === reaction);
    if (!reactants.length || !products.length) continue;
    let massSum = 0, gaugeSum = 0;
    const reactantRefs = reactants.map((term) => {
      const row = table.reactantTermRecords.subarray(term.reactantTermIndex * REACTANT_TERM_FLOATS,
        (term.reactantTermIndex + 1) * REACTANT_TERM_FLOATS);
      const [, materialId, coefficient, molarMass] = row;
      if (!(coefficient > 0) || !(molarMass > 0)) fail(`reaction ${reaction} has an unpacked reactant term`);
      const ref = referenceEnergy(artifacts, materialId, referenceTemperatureK);
      massSum += coefficient * molarMass;
      gaugeSum += coefficient * molarMass * ref.u;
      return { material: term.material, materialId, phaseId: ref.phaseId, uRef: ref.u };
    });
    // Spectator residues of a reaction lifted onto an ideal-gas mixture (slice
    // 3 stage 2): the GPU writes them u = ratio * u(consumed mixture row), so
    // their mass and reference energy leave the average the real products
    // share, and their own gauge offset is 0 (the ratio already maps the
    // mixture's runtime u onto the residue's, both u = Cv T).
    let spectatorMass = 0, spectatorGauge = 0;
    for (const term of products) {
      if (!term.spectator) continue;
      const index = term.productTermIndex;
      const row = table.productTermRecords.subarray(index * PRODUCT_TERM_FLOATS, (index + 1) * PRODUCT_TERM_FLOATS);
      const mixtureRef = reactantRefs.find((ref) => ref.material === term.spectator.mixture);
      if (!mixtureRef) fail(`spectator ${term.material} has no consumed mixture reactant ${term.spectator.mixture}`);
      spectatorMass += row[2] * row[3];
      spectatorGauge += row[2] * row[3] * term.spectator.energyRatio * mixtureRef.uRef;
    }
    if (!(massSum - spectatorMass > 0)) fail(`reaction ${reaction} has no real product mass beside its spectators`);
    const reactantGauge = (gaugeSum - spectatorGauge) / (massSum - spectatorMass);
    const productRefs = products.map((term) => {
      const index = term.productTermIndex;
      const row = table.productTermRecords.subarray(index * PRODUCT_TERM_FLOATS, (index + 1) * PRODUCT_TERM_FLOATS);
      const materialId = row[1];
      if (term.spectator) {
        productTerms[index * PRODUCT_TERM_FLOATS + GAUGE_WORD] = 0;
        combined[productBase + index * PRODUCT_TERM_FLOATS + GAUGE_WORD] = 0;
        return { material: term.material, materialId, spectator: true,
          energyRatio: term.spectator.energyRatio, gaugeOffsetJPerKg: 0 };
      }
      // A multi-phase condensable phase-caloric product needs an explicit
      // phase-resolved write, which the heat-proxy writer (ladder selection)
      // does not provide. Single-phase ideal-gas products (type 5) are unambiguous.
      if (materialHasMultiPhaseCaloricRows(thermalMaterialTable, materialId)) {
        fail(`product ${term.material} uses a phase-caloric gauge; its write needs physical reaction energy`);
      }
      const ref = referenceEnergy(artifacts, materialId, referenceTemperatureK, row[6] > 0 ? row[6] : 0);
      const delta = Math.fround(ref.u - reactantGauge);
      if (!Number.isFinite(delta)) fail(`non-finite gauge offset for ${term.material}`);
      productTerms[index * PRODUCT_TERM_FLOATS + GAUGE_WORD] = delta;
      combined[productBase + index * PRODUCT_TERM_FLOATS + GAUGE_WORD] = delta;
      return { material: term.material, materialId, phaseId: ref.phaseId, uRef: ref.u, gaugeOffsetJPerKg: delta };
    });
    entries.push({ reactionIndex: reaction, reactantGaugeJPerKg: reactantGauge, reactants: reactantRefs, products: productRefs });
  }
  const gauged = { ...table, productTermRecords: productTerms, combinedRecords: combined,
    heatProxyGauge: Object.freeze({ schema: SPH_REACTION_HEAT_PROXY_GAUGE_SCHEMA,
      mode: 'heat-proxy-at-reference-temperature-runtime-gauge-corrected',
      referenceTemperatureK, reactions: entries, scientificValidation: false }) };
  ISSUED.set(gauged, { thermal: thermalSnapshot(thermalMaterialTable), combined: combined.slice() });
  return gauged;
}

/** True when this exact table was issued gauge offsets for this thermal table. */
export function sphReactionHeatProxyGaugeAdmits(table, thermalMaterialTable = null) {
  const issued = ISSUED.get(table);
  if (!issued || !table.heatProxyGauge) return false;
  if (table.combinedRecords.length !== issued.combined.length
    || !table.combinedRecords.every((value, i) => Object.is(value, issued.combined[i]))) return false;
  if (thermalMaterialTable) {
    const t = issued.thermal;
    if (thermalMaterialTable.materialCount !== t.materialCount || thermalMaterialTable.segmentCount !== t.segmentCount
      || JSON.stringify(thermalMaterialTable.metadata) !== t.metadata
      || thermalMaterialTable.records.length !== t.records.length
      || !thermalMaterialTable.records.every((v, i) => Object.is(v, t.records[i]))
      || thermalMaterialTable.segments.length !== t.segments.length
      || !thermalMaterialTable.segments.every((v, i) => Object.is(v, t.segments[i]))) return false;
  }
  return true;
}

const sameFloats = (a, b) => a instanceof Float32Array && b instanceof Float32Array && a.length === b.length
  && a.every((value, i) => Object.is(value, b[i]));

/**
 * Worker-side admission of a received (structured-clone) gauge table: the
 * offsets are recomputed from this worker's own thermal table and every byte
 * must match. A copied gauge alone never grants admission.
 */
export function importSphReactionHeatProxyGauge(incoming, thermalMaterialTable, previous = null) {
  if (!incoming?.heatProxyGauge) return incoming;
  if (previous?.heatProxyGauge && ISSUED.has(previous) && sameFloats(previous.combinedRecords, incoming.combinedRecords)
    && sphReactionHeatProxyGaugeAdmits(previous, thermalMaterialTable)) return previous;
  if (ISSUED.has(incoming) && sphReactionHeatProxyGaugeAdmits(incoming, thermalMaterialTable)) return incoming;
  const productTermRecords = Float32Array.from(incoming.productTermRecords);
  const combinedRecords = Float32Array.from(incoming.combinedRecords);
  const productBase = incoming.records.length + incoming.productPhaseRecords.length + incoming.reactionHeaders.length
    + incoming.reactantTermRecords.length;
  for (let term = 0; term * PRODUCT_TERM_FLOATS < productTermRecords.length; term += 1) {
    productTermRecords[term * PRODUCT_TERM_FLOATS + GAUGE_WORD] = 0;
    combinedRecords[productBase + term * PRODUCT_TERM_FLOATS + GAUGE_WORD] = 0;
  }
  const { heatProxyGauge, ...rest } = incoming;
  const rebuilt = attachSphReactionHeatProxyGauge({ ...rest, productTermRecords, combinedRecords }, thermalMaterialTable,
    { referenceTemperatureK: heatProxyGauge.referenceTemperatureK });
  if (!rebuilt.heatProxyGauge || !sameFloats(rebuilt.combinedRecords, incoming.combinedRecords)
    || !sameFloats(rebuilt.productTermRecords, incoming.productTermRecords)) {
    fail('received offsets do not match this thermal table');
  }
  return rebuilt;
}
