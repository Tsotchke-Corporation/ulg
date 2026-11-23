// Canonical Material-Bundle & Convex Polytope-Atlas ABI (Gate 0C).
// Shared binary + JSON contract across Gate 1 (Z=1..118 elements), Gate 2
// (reactions -> recursive compound feedback -> Polytope Atlas), Gate 3
// (continuum Tier-1 lookup), and Gate 5 (planetary/stellar/galactic closures).

export const ULG_MATERIAL_PROPERTY_BUNDLE_SCHEMA = 'ulg.material-property-bundle.v1';
export const ULG_POLYTOPE_ATLAS_SCHEMA = 'ulg.polytope-atlas.v1';
export const ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA = 'ulg.polytope-atlas-gpu-buffer.v1';

export const ULG_ACCURACY_TIERS = Object.freeze({
  TIER_1_QUANTITATIVE: 'tier-1-quantitative',
  TIER_2_REPRESENTATIVE_EFFECTIVE: 'tier-2-representative-effective',
  TIER_3_THEORETICAL_ENVELOPE: 'tier-3-theoretical-envelope'
});

const VALID_ACCURACY_TIERS = new Set(Object.values(ULG_ACCURACY_TIERS));
const REQUIRED_BUNDLE_DOMAINS = Object.freeze([
  'nuclear',
  'atomic',
  'electromagnetic',
  'mechanical',
  'thermodynamic'
]);

function stableFnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `ulg:${h.toString(16).padStart(8, '0')}`;
}

/**
 * Construct and validate a canonical 5-domain `ulg.material-property-bundle.v1`.
 * Every domain carries explicit SI units, accuracyTier, uncertainty, and
 * provenance status — never unlabeled constants or fake scientificValidation.
 */
export function createMaterialPropertyBundle({
  materialKey,
  symbol = null,
  formula = null,
  atomicNumber = null,
  family = 'element',
  accuracyTier = ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE,
  generatorFingerprint = 'ulg-foundation-v1',
  nuclear,
  atomic,
  electromagnetic,
  mechanical,
  thermodynamic,
  provenance = {},
  g7Advisory = null
} = {}) {
  const key = String(materialKey || symbol || formula || '').trim();
  if (!key) {
    throw new TypeError('createMaterialPropertyBundle requires materialKey, symbol, or formula');
  }
  if (!VALID_ACCURACY_TIERS.has(accuracyTier)) {
    throw new RangeError(`Invalid accuracyTier: ${accuracyTier}`);
  }
  const domains = { nuclear, atomic, electromagnetic, mechanical, thermodynamic };
  for (const name of REQUIRED_BUNDLE_DOMAINS) {
    if (!domains[name] || typeof domains[name] !== 'object') {
      throw new TypeError(`ulg.material-property-bundle.v1 missing required domain "${name}" for ${key}`);
    }
  }
  const closureHash = stableFnv1a(
    JSON.stringify({ key, family, atomicNumber, generatorFingerprint, domains })
  );
  return Object.freeze({
    schema: ULG_MATERIAL_PROPERTY_BUNDLE_SCHEMA,
    schemaVersion: 1,
    materialKey: key,
    symbol: symbol ? String(symbol) : null,
    formula: formula ? String(formula) : null,
    atomicNumber: Number.isInteger(atomicNumber) ? atomicNumber : null,
    family,
    accuracyTier,
    generatorFingerprint: String(generatorFingerprint),
    closureHash,
    nuclear: Object.freeze({ ...nuclear }),
    atomic: Object.freeze({ ...atomic }),
    electromagnetic: Object.freeze({ ...electromagnetic }),
    mechanical: Object.freeze({ ...mechanical }),
    thermodynamic: Object.freeze({ ...thermodynamic }),
    provenance: Object.freeze({
      scientificValidation: false,
      extrapolationPolicy: 'fail-closed',
      ...provenance
    }),
    g7Advisory: g7Advisory ? Object.freeze({ ...g7Advisory }) : null
  });
}

export function validateMaterialPropertyBundle(bundle) {
  const errors = [];
  if (!bundle || typeof bundle !== 'object') {
    return Object.freeze({ ok: false, errors: Object.freeze(['bundle-not-object']) });
  }
  if (bundle.schema !== ULG_MATERIAL_PROPERTY_BUNDLE_SCHEMA) {
    errors.push(`invalid-schema:${bundle.schema}`);
  }
  if (!bundle.materialKey) errors.push('missing-materialKey');
  if (!VALID_ACCURACY_TIERS.has(bundle.accuracyTier)) {
    errors.push(`invalid-accuracyTier:${bundle.accuracyTier}`);
  }
  for (const name of REQUIRED_BUNDLE_DOMAINS) {
    if (!bundle[name] || typeof bundle[name] !== 'object') {
      errors.push(`missing-domain:${name}`);
    }
  }
  if (!bundle.closureHash) errors.push('missing-closureHash');
  if (bundle.provenance?.extrapolationPolicy !== 'fail-closed') {
    errors.push('extrapolation-policy-must-be-fail-closed');
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

// GPU Packed Polytope Atlas Layout (std430 Float32Array):
// Header (4 floats): [polytopeCount, maxFacetsPerPolytope, propStrideFloats, flags]
// Per polytope header (16 floats):
//   [0]=phaseCode (0=solid,1=liquid,2=gas,3=plasma),
//   [1]=facetCount (<=8),
//   [2]=tMinK, [3]=tMaxK,
//   [4]=logPMin, [5]=logPMax,
//   [6]=degT, [7]=degP,
//   [8]=facetOffsetFloats, [9]=coeffOffsetFloats,
//   [10]=maxRelErr, [11]=uncertaintyBound,
//   [12]=accuracyTierCode (1,2,3), [13]=materialIndex,
//   [14]=validFlag (1/0), [15]=invalidationHashU32AsF32
// Per facet (4 floats): [aT, aLogP, b, scale] representing aT*T + aLogP*log10(P) <= b
export const POLYTOPE_ATLAS_GPU_HEADER_FLOATS = 4;
export const POLYTOPE_ATLAS_GPU_RECORD_FLOATS = 16;
export const POLYTOPE_ATLAS_GPU_FACET_FLOATS = 4;

const PHASE_CODE = Object.freeze({
  solid: 0,
  liquid: 1,
  gas: 2,
  supercritical: 2,
  plasma: 3
});

const TIER_CODE = Object.freeze({
  [ULG_ACCURACY_TIERS.TIER_1_QUANTITATIVE]: 1,
  [ULG_ACCURACY_TIERS.TIER_2_REPRESENTATIVE_EFFECTIVE]: 2,
  [ULG_ACCURACY_TIERS.TIER_3_THEORETICAL_ENVELOPE]: 3
});

export function packPolytopeAtlasForGpu(polytopes, { materialIndex = 0 } = {}) {
  const list = Array.isArray(polytopes) ? polytopes : [];
  let totalFacets = 0;
  let totalCoeffs = 0;
  for (const p of list) {
    const facets = Array.isArray(p?.inequalities) ? p.inequalities : [];
    totalFacets += facets.length;
    const coeffs = p?.fit?.coefficients;
    totalCoeffs += coeffs ? coeffs.length : 0;
  }
  const recordsStart = POLYTOPE_ATLAS_GPU_HEADER_FLOATS;
  const facetsStart = recordsStart + list.length * POLYTOPE_ATLAS_GPU_RECORD_FLOATS;
  const coeffsStart = facetsStart + totalFacets * POLYTOPE_ATLAS_GPU_FACET_FLOATS;
  const totalFloats = Math.max(16, coeffsStart + totalCoeffs);
  const data = new Float32Array(totalFloats);
  data[0] = list.length;
  data[1] = 8;
  data[2] = POLYTOPE_ATLAS_GPU_RECORD_FLOATS;
  data[3] = 1; // fail-closed flag

  let facetCursor = facetsStart;
  let coeffCursor = coeffsStart;
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    const r = recordsStart + i * POLYTOPE_ATLAS_GPU_RECORD_FLOATS;
    const facets = Array.isArray(p?.inequalities) ? p.inequalities : [];
    const tAxis = p?.axes?.[0] ?? { min: 1, max: 6000 };
    const pAxis = p?.axes?.[1] ?? { min: 1, max: 1e9 };
    const logPMin = Math.log10(Math.max(1e-12, Number(pAxis.min)));
    const logPMax = Math.log10(Math.max(1e-12, Number(pAxis.max)));
    const fit = p?.fit ?? null;
    const coeffs = fit?.coefficients ?? null;
    const degT = fit?.degrees?.[0] ?? 0;
    const degP = fit?.degrees?.[1] ?? 0;

    data[r + 0] = PHASE_CODE[p?.phase] ?? 2;
    data[r + 1] = facets.length;
    data[r + 2] = Number(tAxis.min);
    data[r + 3] = Number(tAxis.max);
    data[r + 4] = logPMin;
    data[r + 5] = logPMax;
    data[r + 6] = degT;
    data[r + 7] = degP;
    data[r + 8] = facetCursor;
    data[r + 9] = coeffs ? coeffCursor : -1;
    data[r + 10] = Number(fit?.maxRelativeError ?? 0);
    data[r + 11] = Number(fit?.uncertaintyBound ?? 0);
    data[r + 12] = TIER_CODE[p?.accuracyTier] ?? 2;
    data[r + 13] = Number(materialIndex);
    data[r + 14] = fit ? (fit.valid ? 1 : 0) : 1;
    data[r + 15] = parseInt(String(p?.invalidationKey || '0').slice(0, 6), 16) || 0;

    for (const f of facets) {
      data[facetCursor + 0] = Number(f.a?.[0] ?? 0);
      data[facetCursor + 1] = Number(f.a?.[1] ?? 0);
      data[facetCursor + 2] = Number(f.b ?? 0);
      data[facetCursor + 3] = Math.max(1e-6, Number(f.scale ?? 1));
      facetCursor += POLYTOPE_ATLAS_GPU_FACET_FLOATS;
    }
    if (coeffs && coeffs.length > 0) {
      data.set(coeffs, coeffCursor);
      coeffCursor += coeffs.length;
    }
  }
  return Object.freeze({
    schema: ULG_POLYTOPE_ATLAS_GPU_BUFFER_SCHEMA,
    polytopeCount: list.length,
    totalFacets,
    totalCoeffs,
    data
  });
}

// Reusable WGSL Polytope-Atlas half-space membership + Clenshaw Chebyshev evaluator.
// Fail-closed: returns vec4(value, margin, phaseCode, hitFlag); hitFlag == 0.0
// signals outside-domain miss (never extrapolates silently!).
export const evaluatePolytopeAtlasWgsl = /* wgsl */ `
fn polytope_clenshaw_1d(atlas: ptr<storage, array<f32>, read>, u: f32, base: u32, count: u32) -> f32 {
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u = 2.0 * u;
  for (var step = 0u; step < count; step = step + 1u) {
    let k = count - 1u - step;
    if (k == 0u) {
      return (*atlas)[base] + u * b1 - b2;
    }
    let b0 = (*atlas)[base + k] + two_u * b1 - b2;
    b2 = b1;
    b1 = b0;
  }
  return 0.0;
}

fn eval_polytope_atlas_2d(
  atlas: ptr<storage, array<f32>, read>,
  temperature_k: f32,
  pressure_pa: f32
) -> vec4<f32> {
  let count = u32((*atlas)[0]);
  if (count == 0u || !(pressure_pa > 0.0) || !(temperature_k > 0.0)) {
    return vec4<f32>(0.0, -1.0, -1.0, 0.0);
  }
  let log_p = log2(pressure_pa) * 0.3010299956639812;
  var best_idx = 0xffffffffu;
  var best_margin = -1.0e30;
  for (var i = 0u; i < count; i = i + 1u) {
    let r = 4u + i * 16u;
    if ((*atlas)[r + 14u] < 0.5) { continue; }
    let facet_count = u32((*atlas)[r + 1u]);
    let facet_off = u32((*atlas)[r + 8u]);
    var inside = true;
    var min_margin = 1.0e30;
    for (var f = 0u; f < facet_count; f = f + 1u) {
      let fo = facet_off + f * 4u;
      let a_t = (*atlas)[fo + 0u];
      let a_lp = (*atlas)[fo + 1u];
      let b_val = (*atlas)[fo + 2u];
      let sc = max(1.0e-6, (*atlas)[fo + 3u]);
      let slack = b_val - (a_t * temperature_k + a_lp * log_p);
      if (slack < 0.0) {
        inside = false;
        break;
      }
      min_margin = min(min_margin, slack / sc);
    }
    if (inside && min_margin > best_margin) {
      best_margin = min_margin;
      best_idx = i;
    }
  }
  if (best_idx == 0xffffffffu) {
    return vec4<f32>(0.0, -1.0, -1.0, 0.0);
  }
  let r = 4u + best_idx * 16u;
  let phase_code = (*atlas)[r + 0u];
  let coeff_off_f = (*atlas)[r + 9u];
  if (coeff_off_f < 0.0) {
    return vec4<f32>(0.0, best_margin, phase_code, 1.0);
  }
  let t_min = (*atlas)[r + 2u];
  let t_max = (*atlas)[r + 3u];
  let lp_min = (*atlas)[r + 4u];
  let lp_max = (*atlas)[r + 5u];
  let c0 = u32((*atlas)[r + 6u]) + 1u;
  let c1 = u32((*atlas)[r + 7u]) + 1u;
  let coeff_off = u32(coeff_off_f);
  let u0 = clamp(2.0 * (temperature_k - t_min) / max(t_max - t_min, 1.0e-30) - 1.0, -1.0, 1.0);
  let u1 = clamp(2.0 * (log_p - lp_min) / max(lp_max - lp_min, 1.0e-30) - 1.0, -1.0, 1.0);
  var b1 = 0.0;
  var b2 = 0.0;
  let two_u0 = 2.0 * u0;
  var val = 0.0;
  for (var step = 0u; step < c0; step = step + 1u) {
    let k0 = c0 - 1u - step;
    let row_val = polytope_clenshaw_1d(atlas, u1, coeff_off + k0 * c1, c1);
    if (k0 == 0u) {
      val = row_val + u0 * b1 - b2;
    } else {
      let b0 = row_val + two_u0 * b1 - b2;
      b2 = b1;
      b1 = b0;
    }
  }
  return vec4<f32>(val, best_margin, phase_code, 1.0);
}
`;
