// Material Polytope Registry & Closure Validity-Domain Evaluator
// (plan/todo/material-polytope-registry-and-property-fit-plan.md).
//
// Discovers, caches, and validates piecewise convex state-domain polytopes
// (A x <= b) over (temperatureK, pressurePa) phase regions for arbitrary
// elements, compounds, mixtures, and crystalline structures. Fitted response
// functions cached against a polytope are strictly gated by closure hash and
// domain membership — never silently extrapolated outside an accepted polytope.

export const MATERIAL_POLYTOPE_REGISTRY_SCHEMA =
  'peercompute.ulg.material-polytope-registry.v0';
export const ELEMENT_POLYTOPE_SCHEMA =
  'peercompute.ulg.material-polytope.element.v0';
export const COMPOUND_POLYTOPE_SCHEMA =
  'peercompute.ulg.material-polytope.compound.v0';
export const CRYSTAL_STRUCTURE_POLYTOPE_SCHEMA =
  'peercompute.ulg.material-polytope.crystal-structure.v0';

function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function buildBoxPolytope({
  schema,
  polytopeId,
  materialKey,
  polytopeFamily,
  phase,
  tMinK,
  tMaxK,
  pMinPa,
  pMaxPa,
  closureHash,
  provenance,
  crystalStructure = null
}) {
  const loT = Math.max(0.1, Number(tMinK));
  const hiT = Math.max(loT + 1e-3, Number(tMaxK));
  const loP = Math.max(1e-3, Number(pMinPa));
  const hiP = Math.max(loP * 1.01, Number(pMaxPa));
  const logLoP = Math.log10(loP);
  const logHiP = Math.log10(hiP);
  // Inequalities A * [T, log10(P)] <= b in normalized state coordinates
  const inequalities = Object.freeze([
    Object.freeze({ axis: 'temperatureK', a: [-1, 0], b: -loT, label: `T >= ${loT.toFixed(2)} K` }),
    Object.freeze({ axis: 'temperatureK', a: [1, 0], b: hiT, label: `T <= ${hiT.toFixed(2)} K` }),
    Object.freeze({ axis: 'log10PressurePa', a: [0, -1], b: -logLoP, label: `P >= ${loP.toExponential(2)} Pa` }),
    Object.freeze({ axis: 'log10PressurePa', a: [0, 1], b: logHiP, label: `P <= ${hiP.toExponential(2)} Pa` })
  ]);
  const vertices = Object.freeze([
    Object.freeze([loT, loP]),
    Object.freeze([hiT, loP]),
    Object.freeze([hiT, hiP]),
    Object.freeze([loT, hiP])
  ]);
  return Object.freeze({
    schema,
    schemaVersion: 0,
    polytopeId,
    materialKey: String(materialKey),
    polytopeFamily,
    phase,
    axes: Object.freeze([
      Object.freeze({ name: 'temperatureK', unit: 'K', min: loT, max: hiT }),
      Object.freeze({ name: 'pressurePa', unit: 'Pa', min: loP, max: hiP, scale: 'log10' })
    ]),
    vertices,
    inequalities,
    crystalStructure: crystalStructure ? Object.freeze({ ...crystalStructure }) : null,
    invalidationKey: fnv1aHex(`${materialKey}:${phase}:${closureHash}:${loT}:${hiT}:${loP}:${hiP}`),
    closureHash: String(closureHash || 'unhashed'),
    provenance: Object.freeze({
      ...(provenance || {}),
      extrapolationPolicy: 'fail-closed'
    })
  });
}

/**
 * Evaluate strict convex polytope membership `A x <= b` for `(temperatureK, pressurePa)`.
 * Returns `'accepted'`, `'boundary'` (within `boundaryBandFraction` of a facet),
 * or `'outside-domain'` (fail-closed; never silently extrapolates).
 */
export function evaluatePolytopeMembership(polytope, {
  temperatureK,
  pressurePa = 101325,
  boundaryBandFraction = 0.05
} = {}) {
  const T = Number(temperatureK);
  const P = Number(pressurePa);
  if (!polytope || !Number.isFinite(T) || !Number.isFinite(P) || !(P > 0)) {
    return Object.freeze({
      inside: false,
      status: 'outside-domain',
      minMarginNormalized: -Infinity,
      violatedInequalities: ['invalid-state-coordinates'],
      extrapolate: false
    });
  }
  const tAxis = polytope.axes[0];
  const pAxis = polytope.axes[1];
  const tSpan = Math.max(1e-6, tAxis.max - tAxis.min);
  const logPSpan = Math.max(1e-6, Math.log10(pAxis.max) - Math.log10(pAxis.min));
  const x = [T, Math.log10(P)];
  const scales = [tSpan, tSpan, logPSpan, logPSpan];
  const violated = [];
  let minMargin = Infinity;
  for (let i = 0; i < polytope.inequalities.length; i += 1) {
    const ineq = polytope.inequalities[i];
    const slack = ineq.b - (ineq.a[0] * x[0] + ineq.a[1] * x[1]);
    const normMargin = slack / scales[i];
    if (normMargin < minMargin) minMargin = normMargin;
    if (slack < 0) violated.push(ineq.label);
  }
  if (violated.length > 0) {
    return Object.freeze({
      inside: false,
      status: 'outside-domain',
      minMarginNormalized: minMargin,
      violatedInequalities: Object.freeze(violated),
      extrapolate: false
    });
  }
  const status = minMargin <= boundaryBandFraction ? 'boundary' : 'accepted';
  return Object.freeze({
    inside: true,
    status,
    minMarginNormalized: minMargin,
    violatedInequalities: Object.freeze([]),
    extrapolate: false
  });
}

/**
 * Create a durable Material Polytope Registry managing discovered state-domain
 * polytopes and closure-hash-invalidated fitted response descriptors.
 */
export function createMaterialPolytopeRegistry() {
  const polytopesByMaterial = new Map();
  const polytopesById = new Map();
  const fitsByPolytopeId = new Map();

  function discoverMaterialPolytopes({
    materialKey,
    family = 'element',
    meltingPointK = null,
    boilingPointK = null,
    maxTemperatureK = 6000,
    minPressurePa = 1,
    maxPressurePa = 1e9,
    closureHash = 'derived-v0',
    crystalStructure = null,
    provenance = {}
  } = {}) {
    const key = String(materialKey || '').trim();
    if (!key) throw new TypeError('discoverMaterialPolytopes requires a non-empty materialKey');
    const schema = crystalStructure
      ? CRYSTAL_STRUCTURE_POLYTOPE_SCHEMA
      : family === 'compound'
        ? COMPOUND_POLYTOPE_SCHEMA
        : ELEMENT_POLYTOPE_SCHEMA;
    const tMelt = Number(meltingPointK);
    const tBoil = Number(boilingPointK);
    const tMax = Math.max(Number(maxTemperatureK) || 6000, (tBoil || tMelt || 300) + 500);
    const discovered = [];

    if (Number.isFinite(tMelt) && tMelt > 1) {
      discovered.push(buildBoxPolytope({
        schema,
        polytopeId: `${key.toLowerCase()}:solid:${fnv1aHex(closureHash)}`,
        materialKey: key,
        polytopeFamily: family,
        phase: 'solid',
        tMinK: 1,
        tMaxK: tMelt,
        pMinPa: minPressurePa,
        pMaxPa: maxPressurePa,
        closureHash,
        provenance,
        crystalStructure
      }));
    }
    if (Number.isFinite(tMelt) && Number.isFinite(tBoil) && tBoil > tMelt + 1) {
      discovered.push(buildBoxPolytope({
        schema,
        polytopeId: `${key.toLowerCase()}:liquid:${fnv1aHex(closureHash)}`,
        materialKey: key,
        polytopeFamily: family,
        phase: 'liquid',
        tMinK: tMelt,
        tMaxK: tBoil,
        pMinPa: minPressurePa,
        pMaxPa: maxPressurePa,
        closureHash,
        provenance
      }));
    }
    const gasMinT = Number.isFinite(tBoil) && tBoil > 1
      ? tBoil
      : (Number.isFinite(tMelt) && tMelt > 1 ? tMelt : 1);
    discovered.push(buildBoxPolytope({
      schema,
      polytopeId: `${key.toLowerCase()}:gas:${fnv1aHex(closureHash)}`,
      materialKey: key,
      polytopeFamily: family,
      phase: 'gas',
      tMinK: gasMinT,
      tMaxK: tMax,
      pMinPa: minPressurePa,
      pMaxPa: maxPressurePa,
      closureHash,
      provenance
    }));

    const frozen = Object.freeze(discovered);
    const prev = polytopesByMaterial.get(key.toLowerCase()) || [];
    for (const old of prev) {
      polytopesById.delete(old.polytopeId);
      fitsByPolytopeId.delete(old.polytopeId);
    }
    polytopesByMaterial.set(key.toLowerCase(), frozen);
    for (const p of frozen) polytopesById.set(p.polytopeId, p);
    return frozen;
  }

  function resolveState(materialKey, { temperatureK, pressurePa = 101325, closureHash = null } = {}) {
    const list = polytopesByMaterial.get(String(materialKey || '').toLowerCase()) || [];
    let best = null;
    for (const polytope of list) {
      if (closureHash && polytope.closureHash !== closureHash) continue;
      const evalRes = evaluatePolytopeMembership(polytope, { temperatureK, pressurePa });
      if (evalRes.inside) {
        if (!best || evalRes.minMarginNormalized > best.membership.minMarginNormalized) {
          best = { polytope, membership: evalRes };
        }
      }
    }
    if (!best) {
      return Object.freeze({
        found: false,
        status: 'outside-domain',
        polytope: null,
        membership: null,
        fit: null
      });
    }
    const fit = fitsByPolytopeId.get(best.polytope.polytopeId) ?? null;
    const fitValid = Boolean(fit && fit.invalidationKey === best.polytope.invalidationKey);
    return Object.freeze({
      found: true,
      status: best.membership.status,
      polytope: best.polytope,
      membership: best.membership,
      fit: fitValid ? fit : null
    });
  }

  function registerResponseFit(polytopeId, fitDescriptor) {
    const polytope = polytopesById.get(polytopeId);
    if (!polytope) throw new RangeError(`Unknown polytopeId: ${polytopeId}`);
    const record = Object.freeze({
      ...fitDescriptor,
      polytopeId,
      invalidationKey: polytope.invalidationKey,
      closureHash: polytope.closureHash
    });
    fitsByPolytopeId.set(polytopeId, record);
    return record;
  }

  function snapshot() {
    return Object.freeze({
      schema: MATERIAL_POLYTOPE_REGISTRY_SCHEMA,
      materialCount: polytopesByMaterial.size,
      polytopeCount: polytopesById.size,
      fittedCount: fitsByPolytopeId.size
    });
  }

  return Object.freeze({
    schema: MATERIAL_POLYTOPE_REGISTRY_SCHEMA,
    discoverMaterialPolytopes,
    resolveState,
    registerResponseFit,
    getPolytopes: (materialKey) => polytopesByMaterial.get(String(materialKey || '').toLowerCase()) || Object.freeze([]),
    snapshot
  });
}
