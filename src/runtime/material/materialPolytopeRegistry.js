// Material Polytope Registry & Convex Closure Validity-Domain Evaluator
// (Gate 0C / Gate 2 — plan/todo/material-polytope-registry-and-property-fit-plan.md).
//
// Discovers, bisects, caches, GPU-packs, and validates piecewise convex
// half-space state-domain polytopes (`A x <= b`) over `(temperatureK, log10(pressurePa))`
// phase regions — including slanted Clausius-Clapeyron coexistence boundaries —
// for arbitrary elements, compounds, mixtures, and crystalline structures.
// Strictly fail-closed: never silently extrapolates outside an accepted polytope.

import {
  ULG_ACCURACY_TIERS,
  ULG_POLYTOPE_ATLAS_SCHEMA,
  packPolytopeAtlasForGpu
} from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const MATERIAL_POLYTOPE_REGISTRY_SCHEMA =
  'peercompute.ulg.material-polytope-registry.v0';
export const ELEMENT_POLYTOPE_SCHEMA =
  'peercompute.ulg.material-polytope.element.v0';
export const COMPOUND_POLYTOPE_SCHEMA =
  'peercompute.ulg.material-polytope.compound.v0';
export const CRYSTAL_STRUCTURE_POLYTOPE_SCHEMA =
  'peercompute.ulg.material-polytope.crystal-structure.v0';

/**
 * Canonical registry key for an element, isotope `(Z / symbol, A)`, or
 * isotopologue formula (`H2O`, `D2O`, `235UF6`, `Fe-56`, etc.).
 * Preserves backward compatibility when `massNumberA` is null/omitted.
 */
export function canonicalMaterialIsotopeKey(materialKey, massNumberA = null) {
  const base = String(materialKey || '').trim().toLowerCase();
  if (!base) return '';
  if (massNumberA == null || !Number.isFinite(Number(massNumberA))) return base;
  const A = Math.max(1, Math.trunc(Number(massNumberA)));
  if (new RegExp(`-${A}$`).test(base)) return base;
  return `${base}-${A}`;
}

function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Construct a general convex half-space polytope `A x <= b` in
 * `x = [temperatureK, log10(pressurePa)]` with bounding box + optional slanted
 * phase-coexistence half-space inequalities (e.g., Clausius-Clapeyron facets).
 */
export function buildConvexPolytope({
  schema = ELEMENT_POLYTOPE_SCHEMA,
  polytopeId,
  materialKey,
  polytopeFamily = 'element',
  phase = 'solid',
  tMinK,
  tMaxK,
  pMinPa = 1,
  pMaxPa = 1e9,
  extraInequalities = [],
  accuracyTier = ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
  closureHash = 'derived-v1',
  provenance = {},
  crystalStructure = null
}) {
  const loT = Math.max(0.1, Number(tMinK));
  const hiT = Math.max(loT + 1e-3, Number(tMaxK));
  const loP = Math.max(1e-6, Number(pMinPa));
  const hiP = Math.max(loP * 1.01, Number(pMaxPa));
  const logLoP = Math.log10(loP);
  const logHiP = Math.log10(hiP);
  const tSpan = Math.max(1e-6, hiT - loT);
  const logPSpan = Math.max(1e-6, logHiP - logLoP);

  const baseInequalities = [
    Object.freeze({ axis: 'temperatureK', a: Object.freeze([-1, 0]), b: -loT, scale: tSpan, label: `T >= ${loT.toFixed(2)} K` }),
    Object.freeze({ axis: 'temperatureK', a: Object.freeze([1, 0]), b: hiT, scale: tSpan, label: `T <= ${hiT.toFixed(2)} K` }),
    Object.freeze({ axis: 'log10PressurePa', a: Object.freeze([0, -1]), b: -logLoP, scale: logPSpan, label: `P >= ${loP.toExponential(2)} Pa` }),
    Object.freeze({ axis: 'log10PressurePa', a: Object.freeze([0, 1]), b: logHiP, scale: logPSpan, label: `P <= ${hiP.toExponential(2)} Pa` })
  ];
  const extra = (Array.isArray(extraInequalities) ? extraInequalities : []).map((ineq) => Object.freeze({
    axis: ineq.axis || 'coexistence',
    a: Object.freeze([Number(ineq.a[0]), Number(ineq.a[1])]),
    b: Number(ineq.b),
    scale: Math.max(1e-6, Number(ineq.scale ?? Math.hypot(ineq.a[0] * tSpan, ineq.a[1] * logPSpan))),
    label: String(ineq.label || 'phase-boundary-facet')
  }));
  const inequalities = Object.freeze([...baseInequalities, ...extra]);

  const vertices = Object.freeze([
    Object.freeze([loT, loP]),
    Object.freeze([hiT, loP]),
    Object.freeze([hiT, hiP]),
    Object.freeze([loT, hiP])
  ]);
  const facetKey = extra.map((e) => `${e.a[0].toFixed(4)},${e.a[1].toFixed(4)},${e.b.toFixed(4)}`).join(';');
  return Object.freeze({
    schema,
    schemaVersion: 1,
    polytopeId,
    materialKey: String(materialKey),
    polytopeFamily,
    phase,
    accuracyTier,
    axes: Object.freeze([
      Object.freeze({ name: 'temperatureK', unit: 'K', min: loT, max: hiT }),
      Object.freeze({ name: 'pressurePa', unit: 'Pa', min: loP, max: hiP, scale: 'log10' })
    ]),
    vertices,
    inequalities,
    crystalStructure: crystalStructure ? Object.freeze({ ...crystalStructure }) : null,
    invalidationKey: fnv1aHex(`${materialKey}:${phase}:${closureHash}:${loT}:${hiT}:${loP}:${hiP}:${facetKey}`),
    closureHash: String(closureHash || 'unhashed'),
    provenance: Object.freeze({
      ...(provenance || {}),
      extrapolationPolicy: 'fail-closed'
    })
  });
}

/**
 * Bisect a convex polytope along its widest normalized axis (`T` or `log10 P`)
 * while preserving all existing slanted coexistence half-space facets.
 */
export function bisectConvexPolytope(polytope, axisIndex = null) {
  const tAxis = polytope.axes[0];
  const pAxis = polytope.axes[1];
  const logLoP = Math.log10(pAxis.min);
  const logHiP = Math.log10(pAxis.max);
  const splitT = axisIndex === 0 || (axisIndex == null && (tAxis.max - tAxis.min) / Math.max(1, tAxis.min) >= (logHiP - logLoP));
  const extra = polytope.inequalities.slice(4);
  if (splitT) {
    // Use geometric midpoint for wide log-spanning gas/plasma temperature domains (e.g. 20..6500 K)
    // where ln(rho) ~ -ln(T) curves sharply at low T; keep arithmetic midpoint for solid/liquid.
    const useGeomT = (polytope.phase === 'gas' || polytope.phase === 'plasma')
      && (tAxis.max / Math.max(1e-3, tAxis.min) > 10);
    const midT = useGeomT
      ? Math.sqrt(tAxis.min * tAxis.max)
      : 0.5 * (tAxis.min + tAxis.max);
    return [
      buildConvexPolytope({
        ...polytope,
        polytopeId: `${polytope.polytopeId}:tL`,
        tMinK: tAxis.min,
        tMaxK: midT,
        pMinPa: pAxis.min,
        pMaxPa: pAxis.max,
        extraInequalities: extra
      }),
      buildConvexPolytope({
        ...polytope,
        polytopeId: `${polytope.polytopeId}:tR`,
        tMinK: midT,
        tMaxK: tAxis.max,
        pMinPa: pAxis.min,
        pMaxPa: pAxis.max,
        extraInequalities: extra
      })
    ];
  }
  const midP = 10 ** (0.5 * (logLoP + logHiP));
  return [
    buildConvexPolytope({
      ...polytope,
      polytopeId: `${polytope.polytopeId}:pL`,
      tMinK: tAxis.min,
      tMaxK: tAxis.max,
      pMinPa: pAxis.min,
      pMaxPa: midP,
      extraInequalities: extra
    }),
    buildConvexPolytope({
      ...polytope,
      polytopeId: `${polytope.polytopeId}:pR`,
      tMinK: tAxis.min,
      tMaxK: tAxis.max,
      pMinPa: midP,
      pMaxPa: pAxis.max,
      extraInequalities: extra
    })
  ];
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
      violatedInequalities: Object.freeze(['invalid-state-coordinates']),
      extrapolate: false
    });
  }
  const tAxis = polytope.axes[0];
  const pAxis = polytope.axes[1];
  const tSpan = Math.max(1e-6, tAxis.max - tAxis.min);
  const logPSpan = Math.max(1e-6, Math.log10(pAxis.max) - Math.log10(pAxis.min));
  const x = [T, Math.log10(P)];
  const defaultScales = [tSpan, tSpan, logPSpan, logPSpan];
  const violated = [];
  let minMargin = Infinity;
  for (let i = 0; i < polytope.inequalities.length; i += 1) {
    const ineq = polytope.inequalities[i];
    const scale = Math.max(1e-6, Number(ineq.scale ?? defaultScales[i] ?? 1));
    const slack = ineq.b - (ineq.a[0] * x[0] + ineq.a[1] * x[1]);
    const normMargin = slack / scale;
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
 * Create a durable Material Polytope Registry managing piecewise-convex
 * state-domain polytopes (including slanted Clausius-Clapeyron coexistence
 * facets), closure-hash-invalidated fitted response descriptors, and GPU atlas
 * buffer packing.
 */
export function createMaterialPolytopeRegistry() {
  const polytopesByMaterial = new Map();
  const polytopesById = new Map();
  const fitsByPolytopeId = new Map();

  function registerMaterialPolytopes(materialKey, polytopeList, { massNumberA = null } = {}) {
    const key = canonicalMaterialIsotopeKey(materialKey, massNumberA);
    const frozen = Object.freeze([...polytopeList]);
    const prev = polytopesByMaterial.get(key) || [];
    for (const old of prev) {
      polytopesById.delete(old.polytopeId);
      fitsByPolytopeId.delete(old.polytopeId);
    }
    polytopesByMaterial.set(key, frozen);
    for (const p of frozen) {
      polytopesById.set(p.polytopeId, p);
      if (p.fit) {
        fitsByPolytopeId.set(p.polytopeId, Object.freeze({
          ...p.fit,
          polytopeId: p.polytopeId,
          invalidationKey: p.invalidationKey,
          closureHash: p.closureHash
        }));
      }
    }
    return frozen;
  }

  function discoverMaterialPolytopes({
    materialKey,
    massNumberA = null,
    family = 'element',
    meltingPointK = null,
    boilingPointK = null,
    ionizationTempK = null,
    meltingSlopeKPerLogP = 0, // Clausius-Clapeyron dT_m / d(log10 P)
    boilingSlopeKPerLogP = 0, // Clausius-Clapeyron dT_b / d(log10 P)
    maxTemperatureK = 6000,
    minPressurePa = 1,
    maxPressurePa = 1e9,
    accuracyTier = ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
    closureHash = 'derived-v1',
    crystalStructure = null,
    provenance = {}
  } = {}) {
    const rawKey = String(materialKey || '').trim();
    if (!rawKey) throw new TypeError('discoverMaterialPolytopes requires a non-empty materialKey');
    const key = massNumberA != null && Number.isFinite(Number(massNumberA))
      ? `${rawKey}-${Math.max(1, Math.trunc(Number(massNumberA)))}`
      : rawKey;
    const schema = crystalStructure
      ? CRYSTAL_STRUCTURE_POLYTOPE_SCHEMA
      : family === 'compound'
        ? COMPOUND_POLYTOPE_SCHEMA
        : ELEMENT_POLYTOPE_SCHEMA;
    const tMelt = Number(meltingPointK);
    const tBoil = Number(boilingPointK);
    const tIon = Number(ionizationTempK);
    const tMax = Math.max(Number(maxTemperatureK) || 6000, (tBoil || tMelt || 300) + 500);
    const logP0 = Math.log10(101325);
    const mSlope = Number(meltingSlopeKPerLogP) || 0;
    const bSlope = Number(boilingSlopeKPerLogP) || 0;
    const logPMin = Math.log10(Math.max(1e-6, Number(minPressurePa)));
    const logPMax = Math.log10(Math.max(Number(minPressurePa) * 1.01, Number(maxPressurePa)));
    const discovered = [];

    if (Number.isFinite(tMelt) && tMelt > 1) {
      // Slanted melting facet: T - mSlope * (logP - logP0) <= tMelt
      const meltFacet = mSlope !== 0
        ? [{
          axis: 'clausius-clapeyron-melting',
          a: [1, -mSlope],
          b: tMelt - mSlope * logP0,
          label: `T <= T_m(P)`
        }]
        : [];
      const tMeltMax = Math.max(tMelt, tMelt + mSlope * (logPMax - logP0), tMelt + mSlope * (logPMin - logP0));
      discovered.push(buildConvexPolytope({
        schema,
        polytopeId: `${key.toLowerCase()}:solid:${fnv1aHex(closureHash)}`,
        materialKey: key,
        polytopeFamily: family,
        phase: 'solid',
        tMinK: 1,
        tMaxK: tMeltMax,
        pMinPa: minPressurePa,
        pMaxPa: maxPressurePa,
        extraInequalities: meltFacet,
        accuracyTier,
        closureHash,
        provenance,
        crystalStructure
      }));
    }

    if (Number.isFinite(tMelt) && Number.isFinite(tBoil) && tBoil > tMelt + 1) {
      const facets = [];
      if (mSlope !== 0) {
        facets.push({
          axis: 'clausius-clapeyron-melting',
          a: [-1, mSlope],
          b: -(tMelt - mSlope * logP0),
          label: `T >= T_m(P)`
        });
      }
      if (bSlope !== 0) {
        facets.push({
          axis: 'clausius-clapeyron-boiling',
          a: [1, -bSlope],
          b: tBoil - bSlope * logP0,
          label: `T <= T_b(P)`
        });
      }
      const tLiqMin = Math.max(1, Math.min(tMelt, tMelt + mSlope * (logPMin - logP0), tMelt + mSlope * (logPMax - logP0)));
      const tLiqMax = Math.max(tBoil, tBoil + bSlope * (logPMax - logP0), tBoil + bSlope * (logPMin - logP0));
      discovered.push(buildConvexPolytope({
        schema,
        polytopeId: `${key.toLowerCase()}:liquid:${fnv1aHex(closureHash)}`,
        materialKey: key,
        polytopeFamily: family,
        phase: 'liquid',
        tMinK: tLiqMin,
        tMaxK: tLiqMax,
        pMinPa: minPressurePa,
        pMaxPa: maxPressurePa,
        extraInequalities: facets,
        accuracyTier,
        closureHash,
        provenance
      }));
    }

    const gasRefT = Number.isFinite(tBoil) && tBoil > 1
      ? tBoil
      : (Number.isFinite(tMelt) && tMelt > 1 ? tMelt : 1);
    const gasFacets = bSlope !== 0 && Number.isFinite(tBoil) && tBoil > 1
      ? [{
        axis: 'clausius-clapeyron-boiling',
        a: [-1, bSlope],
        b: -(tBoil - bSlope * logP0),
        label: `T >= T_b(P)`
      }]
      : [];
    const gasTop = Number.isFinite(tIon) && tIon > gasRefT + 50 ? tIon : tMax;
    const gasMinT = Math.max(1, Math.min(gasRefT, gasRefT + bSlope * (logPMin - logP0), gasRefT + bSlope * (logPMax - logP0)));
    discovered.push(buildConvexPolytope({
      schema,
      polytopeId: `${key.toLowerCase()}:gas:${fnv1aHex(closureHash)}`,
      materialKey: key,
      polytopeFamily: family,
      phase: 'gas',
      tMinK: gasMinT,
      tMaxK: gasTop,
      pMinPa: minPressurePa,
      pMaxPa: maxPressurePa,
      extraInequalities: gasFacets,
      accuracyTier,
      closureHash,
      provenance
    }));

    if (Number.isFinite(tIon) && tIon > gasRefT + 50) {
      discovered.push(buildConvexPolytope({
        schema,
        polytopeId: `${key.toLowerCase()}:plasma:${fnv1aHex(closureHash)}`,
        materialKey: key,
        polytopeFamily: family,
        phase: 'plasma',
        tMinK: tIon,
        tMaxK: Math.max(tMax, tIon * 10),
        pMinPa: minPressurePa,
        pMaxPa: maxPressurePa,
        accuracyTier,
        closureHash,
        provenance
      }));
    }

    return registerMaterialPolytopes(key, discovered);
  }

  function resolveState(materialKey, { temperatureK, pressurePa = 101325, closureHash = null, massNumberA = null } = {}) {
    const list = polytopesByMaterial.get(canonicalMaterialIsotopeKey(materialKey, massNumberA)) || [];
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

  function packMaterialAtlasGpu(materialKey, { materialIndex = 0, massNumberA = null } = {}) {
    const list = polytopesByMaterial.get(canonicalMaterialIsotopeKey(materialKey, massNumberA)) || [];
    const hydrated = list.map((p) => ({
      ...p,
      fit: fitsByPolytopeId.get(p.polytopeId) ?? p.fit ?? null
    }));
    return packPolytopeAtlasForGpu(hydrated, { materialIndex });
  }

  function exportPolytopeAtlas() {
    const materials = {};
    for (const [key, list] of polytopesByMaterial.entries()) {
      materials[key] = list.map((p) => ({
        ...p,
        fit: fitsByPolytopeId.get(p.polytopeId) ?? p.fit ?? null
      }));
    }
    return Object.freeze({
      schema: ULG_POLYTOPE_ATLAS_SCHEMA,
      schemaVersion: 1,
      materialCount: polytopesByMaterial.size,
      polytopeCount: polytopesById.size,
      fittedCount: fitsByPolytopeId.size,
      materials
    });
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
    registerMaterialPolytopes,
    resolveState,
    registerResponseFit,
    packMaterialAtlasGpu,
    exportPolytopeAtlas,
    getPolytopes: (materialKey, { massNumberA = null } = {}) =>
      polytopesByMaterial.get(canonicalMaterialIsotopeKey(materialKey, massNumberA)) || Object.freeze([]),
    snapshot
  });
}
