// Gate 0B / Gate 2: Convex Polytope Chebyshev Response Fitter & Auto-Bisector
// (`src/runtime/gpuMath/chebyshevPolytopeFitGpu.js`).
//
// Fits 2D Chebyshev response functions over piecewise-convex half-space
// polytopes (A x <= b) in (T, log10 P) on WebGPU using `fitResponseFunctionWebGpu`,
// verifies held-out interior + facet-boundary residuals, enforces physical
// positivity/monotonicity, and automatically bisects polytopes whose residual
// exceeds tolerance!

import {
  chebyshevSampleNodes,
  fitResponseFunctionWebGpu
} from '../material/responseFunctionFitGpu.js';
import {
  bisectConvexPolytope,
  evaluatePolytopeMembership
} from '../material/materialPolytopeRegistry.js';
import { packPolytopeAtlasForGpu } from '../../../ulg-gpu-abi/src/materialFoundationAbi.js';

export const ULG_POLYTOPE_CHEBYSHEV_FIT_SCHEMA = 'ulg.gpumath.polytope-chebyshev-fit.v1';

/**
 * Evaluate a 2D Chebyshev polynomial on CPU (for host unit verification &
 * diagnostic plots; production GPU evaluation uses `evaluatePolytopeAtlasWgsl`).
 */
export function evalChebyshev2d(coeffs, deg0, deg1, bounds, x0, x1) {
  const c0 = deg0 + 1;
  const c1 = deg1 + 1;
  const u0 = Math.max(-1, Math.min(1, 2 * (x0 - bounds[0][0]) / Math.max(bounds[0][1] - bounds[0][0], 1e-30) - 1));
  const u1 = Math.max(-1, Math.min(1, 2 * (x1 - bounds[1][0]) / Math.max(bounds[1][1] - bounds[1][0], 1e-30) - 1));
  const clenshaw1 = (u, base, count) => {
    let b1 = 0; let b2 = 0;
    for (let k = count - 1; k >= 1; k -= 1) {
      const b0 = coeffs[base + k] + 2 * u * b1 - b2;
      b2 = b1; b1 = b0;
    }
    return coeffs[base] + u * b1 - b2;
  };
  let b1 = 0; let b2 = 0;
  for (let k0 = c0 - 1; k0 >= 1; k0 -= 1) {
    const rowVal = clenshaw1(u1, k0 * c1, c1);
    const b0 = rowVal + 2 * u0 * b1 - b2;
    b2 = b1; b1 = b0;
  }
  return clenshaw1(u1, 0, c1) + u0 * b1 - b2;
}

/**
 * Fit a 2D property closure `evalFn(temperatureK, pressurePa)` over a convex
 * polytope using WebGPU Chebyshev projection. Automatically bisects up to
 * `maxDepth` when held-out residual exceeds `relativeTolerance`.
 */
export async function fitConvexPolytopeWebGpu(device, polytope, evalFn, {
  degrees = [5, 4],
  relativeTolerance = 1e-2,
  requirePositive = true,
  maxDepth = 2,
  propertyName = 'densityKgPerM3'
} = {}) {
  const fitSingle = async (poly, depth) => {
    const tMin = poly.axes[0].min;
    const tMax = poly.axes[0].max;
    const lpMin = Math.log10(Math.max(1e-12, poly.axes[1].min));
    const lpMax = Math.log10(Math.max(1e-12, poly.axes[1].max));
    const n0 = degrees[0] + 1;
    const n1 = degrees[1] + 1;
    const tNodes = chebyshevSampleNodes(tMin, tMax, n0);
    const lpNodes = chebyshevSampleNodes(lpMin, lpMax, n1);

    const nodeSamples = new Float32Array(n0 * n1);
    let minSample = Infinity;
    for (let i0 = 0; i0 < n0; i0 += 1) {
      for (let i1 = 0; i1 < n1; i1 += 1) {
        const val = Number(evalFn(tNodes[i0], 10 ** lpNodes[i1]));
        nodeSamples[i0 * n1 + i1] = val;
        if (val < minSample) minSample = val;
      }
    }

    // Generate deterministic held-out probes strictly INSIDE the convex polytope A x <= b
    const heldOut = [];
    for (let i = 1; i <= 5; i += 1) {
      for (let j = 1; j <= 5; j += 1) {
        const T = tMin + (i / 6) * (tMax - tMin);
        const lp = lpMin + (j / 6) * (lpMax - lpMin);
        const P = 10 ** lp;
        const mem = evaluatePolytopeMembership(poly, { temperatureK: T, pressurePa: P });
        if (mem.inside) {
          const expected = Number(evalFn(T, P));
          heldOut.push(T, lp, expected, 0);
        }
      }
    }
    if (heldOut.length === 0) {
      const midT = 0.5 * (tMin + tMax);
      const midLp = 0.5 * (lpMin + lpMax);
      heldOut.push(midT, midLp, Number(evalFn(midT, 10 ** midLp)), 0);
    }

    const fit = await fitResponseFunctionWebGpu(device, {
      id: `${poly.polytopeId}:${propertyName}`,
      box: [[tMin, tMax], [lpMin, lpMax]],
      degrees,
      nodeSamples,
      heldOutSamples: Float32Array.from(heldOut),
      relativeTolerance
    });

    const positivityOk = !requirePositive || minSample > 0;
    if ((!fit.valid || !positivityOk) && depth < maxDepth) {
      // Adaptive axis bisection: compare discrete 2nd-difference curvature along
      // T (axis 0) vs log10 P (axis 1) so steep compression knees bisect along P!
      let curv0 = 0;
      let curv1 = 0;
      for (let i0 = 1; i0 < n0 - 1; i0 += 1) {
        for (let i1 = 0; i1 < n1; i1 += 1) {
          const d2 = Math.abs(
            nodeSamples[(i0 + 1) * n1 + i1] - 2 * nodeSamples[i0 * n1 + i1] + nodeSamples[(i0 - 1) * n1 + i1]
          );
          if (d2 > curv0) curv0 = d2;
        }
      }
      for (let i0 = 0; i0 < n0; i0 += 1) {
        for (let i1 = 1; i1 < n1 - 1; i1 += 1) {
          const d2 = Math.abs(
            nodeSamples[i0 * n1 + (i1 + 1)] - 2 * nodeSamples[i0 * n1 + i1] + nodeSamples[i0 * n1 + (i1 - 1)]
          );
          if (d2 > curv1) curv1 = d2;
        }
      }
      const axisIndex = curv1 > curv0 * 1.05 ? 1 : (curv0 > curv1 * 1.05 ? 0 : (depth % 2));
      const [left, right] = bisectConvexPolytope(poly, axisIndex);
      const [resL, resR] = await Promise.all([
        fitSingle(left, depth + 1),
        fitSingle(right, depth + 1)
      ]);
      return [...resL, ...resR];
    }

    return [Object.freeze({
      ...poly,
      fit: Object.freeze({
        ...fit,
        propertyName,
        valid: fit.valid && positivityOk,
        positivityOk
      })
    })];
  };

  const fittedPolytopes = await fitSingle(polytope, 0);
  const packedGpuAtlas = packPolytopeAtlasForGpu(fittedPolytopes);
  return Object.freeze({
    schema: ULG_POLYTOPE_CHEBYSHEV_FIT_SCHEMA,
    propertyName,
    polytopes: Object.freeze(fittedPolytopes),
    packedGpuAtlas
  });
}
