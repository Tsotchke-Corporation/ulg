import { hashPayload } from '../../../ulg-gpu-abi/src/index.js';
import { ULG_SERVICE_IDS } from '../../../ulg-gpu-abi/src/serviceContract.js';
import { BOHR_TO_M } from './uniformElectronGas.js';
import { atomicMassKg } from './periodicTable.js';
import { solveAtom } from './radialKohnSham.js';
import {
  atomizationEnergyMp2Ha,
  climbingImageNEB,
  populationAnalysis,
  rhf,
  rhfAnalyticGradient
} from './molecularHartreeFock.js';
import { deriveMolecularBulkClosure } from '../material/elementClosures.js';
import { eshkolHelmholtzProgram } from '../material/eshkolTriadClosures.js';
import { fitResponseFunction } from '../material/localClosureFitCache.js';
import { packResponseFunctionsForGpu } from '../material/responseFunctionGpu.js';
import {
  computeBufferBinding,
  createCachedExplicitBindGroup,
  createCachedExplicitComputePipeline
} from '../webgpuComputeLayout.js';

export const ULG_ELECTRONIC_STRUCTURE_REPLAY_SCHEMA =
  'peercompute.ulg.electronic-structure-replay.v0';
export const ULG_ATOMIC_RADIAL_DENSITY_SAMPLE_SCHEMA =
  'peercompute.ulg.atomic-radial-density-sample.v0';
export const ULG_ORBITAL_CLOUD_GRID_SCHEMA =
  'peercompute.ulg.orbital-cloud-grid.v0';
export const ULG_MOLECULAR_CHARGE_DENSITY_GRID_SCHEMA =
  'peercompute.ulg.molecular-charge-density-grid.v0';
export const ULG_BOND_DISCOVERY_TRACE_SCHEMA =
  'peercompute.ulg.bond-discovery-trace.v0';
export const ULG_MATERIAL_RESPONSE_FIT_REPLAY_SCHEMA =
  'peercompute.ulg.material-response-fit-replay.v0';
export const ULG_MATERIAL_DERIVATION_VISUALIZATION_BUNDLE_SCHEMA =
  'peercompute.ulg.material-derivation-visualization-bundle.v0';

export const QUANTUM_DERIVATION_GENERATOR_VERSION = 'ulg-quantum-derivation-artifacts.v1';
export const QUANTUM_DERIVATION_GENERATOR_FINGERPRINT = hashPayload({
  generator: QUANTUM_DERIVATION_GENERATOR_VERSION,
  atomicSolver: 'radialKohnSham.pbe+kh+so',
  molecularSolver: 'molecularHartreeFock.6-31g(d)+ump2+grad+neb',
  bulkClosure: 'elementClosures.qha-molecular',
  triadClosures: 'eshkolTriadClosures.a4-chebyshev'
});

export const QUANTUM_DERIVATION_STATUS = Object.freeze({
  firstPrinciplesDerived: 'first-principles-derived',
  workerCpuDerived: 'worker-cpu-derived',
  webgpuDerived: 'webgpu-derived',
  precomputedJsonBank: 'precomputed-json-bank',
  warmInput: 'warm-input',
  sampled: 'sampled',
  fitHit: 'fit-hit',
  cacheStale: 'cache-stale',
  outOfDomain: 'out-of-domain',
  blockedMissingClosure: 'blocked-missing-closure',
  referenceFallbackVisible: 'reference-fallback-visible'
});

const USAGE_STORAGE = 0x0080;
const USAGE_UNIFORM = 0x0040;
const USAGE_COPY_DST = 0x0008;
const USAGE_COPY_SRC = 0x0004;
const USAGE_MAP_READ = 0x0001;

function clampInt(value, lo, hi) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function interpolateLogRadialDensity(rGrid, rhoGrid, rQuery) {
  const n = rGrid.length;
  if (n === 0 || !(rQuery >= 0)) return 0;
  if (rQuery <= rGrid[0]) return rhoGrid[0];
  if (rQuery >= rGrid[n - 1]) return 0;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rGrid[mid] <= rQuery) lo = mid;
    else hi = mid;
  }
  const r0 = rGrid[lo];
  const r1 = rGrid[hi];
  const t = r1 > r0 ? (rQuery - r0) / (r1 - r0) : 0;
  return rhoGrid[lo] * (1 - t) + rhoGrid[hi] * t;
}

function computeContainmentRadiiBohr(rGrid, rhoGrid, dx, totalElectrons) {
  const target90 = 0.90 * totalElectrons;
  const target95 = 0.95 * totalElectrons;
  const target99 = 0.99 * totalElectrons;
  let acc = 0;
  let r90 = rGrid[rGrid.length - 1] ?? 0;
  let r95 = r90;
  let r99 = r90;
  let got90 = false;
  let got95 = false;
  let got99 = false;
  for (let i = 0; i < rGrid.length; i += 1) {
    const r = rGrid[i];
    const dV = 4 * Math.PI * r * r * r * dx;
    acc += rhoGrid[i] * dV;
    if (!got90 && acc >= target90) { r90 = r; got90 = true; }
    if (!got95 && acc >= target95) { r95 = r; got95 = true; }
    if (!got99 && acc >= target99) { r99 = r; got99 = true; break; }
  }
  return Object.freeze({
    r90Bohr: r90,
    r95Bohr: r95,
    r99Bohr: r99,
    r90M: r90 * BOHR_TO_M,
    r95M: r95 * BOHR_TO_M,
    r99M: r99 * BOHR_TO_M
  });
}

/**
 * Evaluate a single normalized contracted Cartesian Gaussian basis function
 * φ(x, y, z) at point `(x, y, z)` in Bohr.
 */
export function evaluateContractedGaussianAt(fn, x, y, z) {
  const dx = x - fn.center[0];
  const dy = y - fn.center[1];
  const dz = z - fn.center[2];
  const r2 = dx * dx + dy * dy + dz * dz;
  const [lx, ly, lz] = fn.lmn;
  const poly = (lx === 0 ? 1 : (lx === 1 ? dx : dx ** lx))
    * (ly === 0 ? 1 : (ly === 1 ? dy : dy ** ly))
    * (lz === 0 ? 1 : (lz === 1 ? dz : dz ** lz));
  if (poly === 0) return 0;
  let radial = 0;
  for (let p = 0; p < fn.exps.length; p += 1) {
    radial += fn.coeffs[p] * Math.exp(-fn.exps[p] * r2);
  }
  return poly * radial;
}

/**
 * Build a provenance-backed atomic radial density + optional 3D spherical
 * volumetric reconstruction artifact from `solveAtom()` (PBE/LDA + optional
 * Koelling–Harmon scalar-relativistic + spin-orbit `j = l ± 1/2` splitting).
 * Dense volumetric grids are returned strictly in `densePayloads` (never
 * inlined into hot UI JSON state).
 */
export function buildAtomicRadialDensityArtifact(atomicNumberZ, {
  functional = 'pbe',
  scalarRelativistic = false,
  spinOrbit = false,
  gridPointsN = 800,
  sampleCount = 128,
  includeCloudGrid = true,
  cloudGridDim = 16,
  maxGridDim = 48,
  generatorFingerprint = QUANTUM_DERIVATION_GENERATOR_FINGERPRINT
} = {}) {
  const Z = Math.round(Number(atomicNumberZ));
  if (!Number.isInteger(Z) || Z < 1 || Z > 118) {
    throw new RangeError(`atomicNumberZ must be an integer in [1, 118], got ${atomicNumberZ}`);
  }
  const atom = solveAtom(Z, {
    functional,
    scalarRelativistic,
    spinOrbit,
    gridPointsN,
    returnRadialDensity: true,
    returnOrbitalWavefunctions: true
  });
  const { r: rGrid, rho: rhoGrid, dx, orbitalWavefunctions: rawOrbWfs = [] } = atom.radialGrid;
  const containment = computeContainmentRadiiBohr(rGrid, rhoGrid, dx, atom.integratedElectrons);

  // Uniformly sample ρ(r) and 4π r² ρ(r) out to r99 * 1.25 for 3D volume & line-plot replay.
  const rMaxSampleBohr = Math.max(2.0, containment.r99Bohr * 1.25);
  const nSamples = clampInt(sampleCount, 16, 1024);
  const radialSamples = [];
  let maxRadialProb = 0;
  let peakRadiusBohr = 0;
  for (let i = 0; i < nSamples; i += 1) {
    const r = (i / (nSamples - 1)) * rMaxSampleBohr;
    const rho = interpolateLogRadialDensity(rGrid, rhoGrid, r);
    const radialProb = 4 * Math.PI * r * r * rho;
    if (radialProb > maxRadialProb) {
      maxRadialProb = radialProb;
      peakRadiusBohr = r;
    }
    radialSamples.push({ rBohr: r, rhoPerBohr3: rho, radialProbabilityPerBohr: radialProb });
  }

  // Resample highest-occupied Kohn-Sham radial wavefunctions R_{nl}(r) = u_{nl}(r) / r
  // for each angular momentum l so volumetric orbital raymarching preserves genuine radial nodes!
  const orbitalWavefunctions = {};
  if (Array.isArray(rawOrbWfs) && rawOrbWfs.length > 0) {
    const highestByL = new Map();
    for (const wf of rawOrbWfs) {
      const prev = highestByL.get(wf.l);
      if (!prev || wf.n > prev.n) highestByL.set(wf.l, wf);
    }
    for (const [l, wf] of highestByL.entries()) {
      const uArr = wf.u;
      const samples = new Array(nSamples);
      for (let i = 0; i < nSamples; i += 1) {
        const rVal = Math.max(rGrid[0], (i / (nSamples - 1)) * rMaxSampleBohr);
        let lo = 0;
        let hi = rGrid.length - 1;
        while (lo + 1 < hi) {
          const mid = (lo + hi) >> 1;
          if (rGrid[mid] <= rVal) lo = mid;
          else hi = mid;
        }
        const span = Math.max(1e-12, rGrid[hi] - rGrid[lo]);
        const t = Math.max(0, Math.min(1, (rVal - rGrid[lo]) / span));
        const uInterp = uArr[lo] + t * (uArr[hi] - uArr[lo]);
        samples[i] = uInterp / Math.max(1e-4, rVal);
      }
      orbitalWavefunctions[String(l)] = {
        n: wf.n,
        l: wf.l,
        occupancy: wf.occupancy,
        energyHa: wf.energyHa,
        rValuesBohr: radialSamples.map((s) => s.rBohr),
        radialAmplitude: samples
      };
    }
  }

  const solverFamily = scalarRelativistic
    ? (spinOrbit ? `kohn-sham-${atom.functional}+koelling-harmon+spin-orbit` : `kohn-sham-${atom.functional}+koelling-harmon`)
    : (spinOrbit ? `kohn-sham-${atom.functional}+spin-orbit` : `kohn-sham-${atom.functional}`);

  const densePayloads = {};
  let orbitalCloudGrid = null;
  if (includeCloudGrid) {
    const requestedDim = clampInt(cloudGridDim, 4, 128);
    const effectiveDim = Math.min(requestedDim, clampInt(maxGridDim, 4, 128));
    const downsampled = effectiveDim < requestedDim;
    const halfExtentBohr = rMaxSampleBohr;
    const stepBohr = (2 * halfExtentBohr) / Math.max(1, effectiveDim - 1);
    const voxels = new Float32Array(effectiveDim * effectiveDim * effectiveDim);
    let maxVal = 0;
    let sumVal = 0;
    let idx = 0;
    for (let iz = 0; iz < effectiveDim; iz += 1) {
      const z = -halfExtentBohr + iz * stepBohr;
      for (let iy = 0; iy < effectiveDim; iy += 1) {
        const y = -halfExtentBohr + iy * stepBohr;
        for (let ix = 0; ix < effectiveDim; ix += 1) {
          const x = -halfExtentBohr + ix * stepBohr;
          const dist = Math.hypot(x, y, z);
          const rho = interpolateLogRadialDensity(rGrid, rhoGrid, dist);
          voxels[idx++] = rho;
          if (rho > maxVal) maxVal = rho;
          sumVal += rho;
        }
      }
    }
    const payloadKey = `atomic-cloud:${atom.symbol}:${effectiveDim}`;
    densePayloads[payloadKey] = voxels;
    orbitalCloudGrid = {
      schema: ULG_ORBITAL_CLOUD_GRID_SCHEMA,
      schemaVersion: 1,
      reconstructionKind: 'radial-atomic-density-reconstruction',
      anisotropicOrbitalClaim: false,
      payloadHandle: {
        key: payloadKey,
        dtype: 'f32',
        byteLength: voxels.byteLength,
        dimensions: [effectiveDim, effectiveDim, effectiveDim],
        downsampled,
        downsampleReason: downsampled ? `capped-to-maxGridDim-${maxGridDim}` : null
      },
      coordinateFrame: 'atomic-nucleus-centered-cartesian',
      units: { length: 'Bohr', density: 'e/Bohr^3', meterScaleFactor: BOHR_TO_M },
      boundsBohr: { min: [-halfExtentBohr, -halfExtentBohr, -halfExtentBohr], max: [halfExtentBohr, halfExtentBohr, halfExtentBohr] },
      voxelSpacingBohr: stepBohr,
      summary: {
        minDensityPerBohr3: 0,
        maxDensityPerBohr3: maxVal,
        voxelIntegralElectrons: sumVal * (stepBohr ** 3),
        recommendedIsovaluesPerBohr3: [maxVal * 0.02, maxVal * 0.1, maxVal * 0.35]
      }
    };
  }

  const inputHash = hashPayload({ atomicNumberZ: Z, functional: atom.functional, scalarRelativistic, spinOrbit, gridPointsN });
  const methodHash = hashPayload({ solverFamily, generatorFingerprint });
  const invalidationKey = hashPayload({ inputHash, methodHash, generatorFingerprint, schema: ULG_ATOMIC_RADIAL_DENSITY_SAMPLE_SCHEMA });

  const artifact = {
    schema: ULG_ATOMIC_RADIAL_DENSITY_SAMPLE_SCHEMA,
    schemaVersion: 1,
    materialKey: atom.symbol,
    formula: atom.symbol,
    atomicNumberZ: Z,
    symbol: atom.symbol,
    solverFamily,
    statusBadge: QUANTUM_DERIVATION_STATUS.firstPrinciplesDerived,
    coordinateFrame: 'spherical-radial-atomic',
    units: { length: 'Bohr', energy: 'Ha', density: 'e/Bohr^3', meterScaleFactor: BOHR_TO_M },
    sourceClosureRefs: [{ module: 'src/runtime/electronicStructure/radialKohnSham.js', symbol: 'solveAtom' }],
    inputHash,
    methodHash,
    generatorFingerprint,
    invalidationKey,
    summary: {
      totalEnergyHa: atom.totalEnergyHa,
      functional: atom.functional,
      electronCount: atom.electronCount,
      integratedElectrons: atom.integratedElectrons,
      integrationResidual: Math.abs(atom.integratedElectrons - atom.electronCount),
      peakRadiusBohr,
      maxRadialProbabilityPerBohr: maxRadialProb,
      containmentRadii: containment,
      orbitalCount: atom.orbitals.length
    },
    orbitals: atom.orbitals.map((o) => ({
      n: o.n,
      l: o.l,
      occupancy: o.occupancy,
      energyHa: o.energyHa,
      ...(o.spinOrbitXiHa != null ? {
        spinOrbitXiHa: o.spinOrbitXiHa,
        spinOrbitSplittingHa: o.spinOrbitSplittingHa,
        energyJMinusHa: o.energyJMinusHa,
        energyJPlusHa: o.energyJPlusHa
      } : {})
    })),
    radialProfile: {
      rMaxBohr: rMaxSampleBohr,
      sampleCount: nSamples,
      samples: radialSamples,
      orbitalWavefunctions
    },
    orbitalCloudGrid,
    validity: {
      status: 'first-principles-atomic-radial-valid',
      domain: { rBohr: [0, rMaxSampleBohr] }
    },
    validation: {
      status: 'warn',
      scientificValidation: false,
      strictModeCompatible: true,
      fallbackPolicy: 'fail-closed-no-extrapolation',
      staleReason: null
    }
  };

  return { artifact, densePayloads };
}

/**
 * Sample molecular electron charge density `ρ(r) = Σ_{μν} P_{μν} φ_μ(r) φ_ν(r)`
 * (and optional HOMO/LUMO amplitudes) on a 3D Cartesian grid in Bohr on CPU.
 */
export function sampleMolecularChargeDensityCpu({
  basis,
  densityMatrix,
  moCoefficients = null,
  homoIndex = -1,
  lumoIndex = -1,
  boundsMinBohr,
  boundsMaxBohr,
  dimensions
}) {
  const [nx, ny, nz] = dimensions;
  const nBasis = basis.length;
  const totalVoxels = nx * ny * nz;
  const density = new Float32Array(totalVoxels);
  const homo = moCoefficients && homoIndex >= 0 ? new Float32Array(totalVoxels) : null;
  const lumo = moCoefficients && lumoIndex >= 0 && lumoIndex < nBasis ? new Float32Array(totalVoxels) : null;

  const dx = nx > 1 ? (boundsMaxBohr[0] - boundsMinBohr[0]) / (nx - 1) : 1;
  const dy = ny > 1 ? (boundsMaxBohr[1] - boundsMinBohr[1]) / (ny - 1) : 1;
  const dz = nz > 1 ? (boundsMaxBohr[2] - boundsMinBohr[2]) / (nz - 1) : 1;
  const phi = new Float64Array(nBasis);

  let maxRho = 0;
  let sumRho = 0;
  let voxel = 0;
  for (let iz = 0; iz < nz; iz += 1) {
    const z = boundsMinBohr[2] + iz * dz;
    for (let iy = 0; iy < ny; iy += 1) {
      const y = boundsMinBohr[1] + iy * dy;
      for (let ix = 0; ix < nx; ix += 1) {
        const x = boundsMinBohr[0] + ix * dx;
        for (let u = 0; u < nBasis; u += 1) {
          phi[u] = evaluateContractedGaussianAt(basis[u], x, y, z);
        }
        let rho = 0;
        for (let u = 0; u < nBasis; u += 1) {
          const pu = phi[u];
          if (pu === 0) continue;
          const row = densityMatrix[u];
          let acc = 0;
          for (let v = 0; v < nBasis; v += 1) acc += row[v] * phi[v];
          rho += pu * acc;
        }
        const clamped = rho > 0 ? rho : 0;
        density[voxel] = clamped;
        if (clamped > maxRho) maxRho = clamped;
        sumRho += clamped;

        if (homo) {
          let hVal = 0;
          for (let u = 0; u < nBasis; u += 1) hVal += moCoefficients[u][homoIndex] * phi[u];
          homo[voxel] = hVal;
        }
        if (lumo) {
          let lVal = 0;
          for (let u = 0; u < nBasis; u += 1) lVal += moCoefficients[u][lumoIndex] * phi[u];
          lumo[voxel] = lVal;
        }
        voxel += 1;
      }
    }
  }
  const dV = dx * dy * dz;
  return {
    density,
    homo,
    lumo,
    maxRho,
    voxelIntegralElectrons: sumRho * dV,
    voxelSpacingBohr: [dx, dy, dz]
  };
}

/**
 * WebGPU compute shader for 3D molecular electron charge density sampling:
 *   ρ(r) = Σ_{μ,ν} P_{μν} φ_μ(r) φ_ν(r)
 * Evaluates contracted Cartesian Gaussian basis functions on GPU directly into
 * a resident `storage` buffer with a compact atomic summary receipt.
 */
export const quantumMolecularDensityWgsl = /* wgsl */ `
struct GridParams {
  nx: u32,
  ny: u32,
  nz: u32,
  n_basis: u32,
  min_xyz: vec3<f32>,
  pad0: f32,
  step_xyz: vec3<f32>,
  pad1: f32,
};

struct BasisMeta {
  center_xyz: vec3<f32>,
  prim_offset: u32,
  lx: u32,
  ly: u32,
  lz: u32,
  prim_count: u32,
};

struct PrimitiveRec {
  alpha: f32,
  coeff: f32,
};

@group(0) @binding(0) var<uniform> params: GridParams;
@group(0) @binding(1) var<storage, read> basis_meta: array<BasisMeta>;
@group(0) @binding(2) var<storage, read> primitives: array<PrimitiveRec>;
@group(0) @binding(3) var<storage, read> density_matrix: array<f32>;
@group(0) @binding(4) var<storage, read_write> density_grid: array<f32>;
@group(0) @binding(5) var<storage, read_write> receipt: array<atomic<u32>>;

const MAX_BASIS: u32 = 64u;

fn int_pow(base: f32, exp_u: u32) -> f32 {
  var r = 1.0;
  for (var k = 0u; k < exp_u; k = k + 1u) {
    r = r * base;
  }
  return r;
}

@compute @workgroup_size(64)
fn sample_molecular_density(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = params.nx * params.ny * params.nz;
  let idx = gid.x;
  if (idx >= total) { return; }
  let ix = idx % params.nx;
  let iy = (idx / params.nx) % params.ny;
  let iz = idx / (params.nx * params.ny);

  let pos = params.min_xyz + vec3<f32>(f32(ix), f32(iy), f32(iz)) * params.step_xyz;
  let nb = min(params.n_basis, MAX_BASIS);
  var phi: array<f32, 64>;
  for (var u = 0u; u < nb; u = u + 1u) {
    let bm = basis_meta[u];
    let d = pos - bm.center_xyz;
    let r2 = dot(d, d);
    let poly = int_pow(d.x, bm.lx) * int_pow(d.y, bm.ly) * int_pow(d.z, bm.lz);
    var rad = 0.0;
    for (var p = 0u; p < bm.prim_count; p = p + 1u) {
      let pr = primitives[bm.prim_offset + p];
      rad = rad + pr.coeff * exp(-pr.alpha * r2);
    }
    phi[u] = poly * rad;
  }

  var rho = 0.0;
  for (var u = 0u; u < nb; u = u + 1u) {
    let pu = phi[u];
    if (pu == 0.0) { continue; }
    let row_off = u * params.n_basis;
    var acc = 0.0;
    for (var v = 0u; v < nb; v = v + 1u) {
      acc = acc + density_matrix[row_off + v] * phi[v];
    }
    rho = rho + pu * acc;
  }
  let out_rho = max(0.0, rho);
  density_grid[idx] = out_rho;
  atomicAdd(&receipt[0], 1u);
  // Fixed-point positive-float monotonic bitcast max for compact summary.
  atomicMax(&receipt[1], bitcast<u32>(out_rho));
}
`;

export async function sampleMolecularChargeDensityWebGpu(device, {
  basis,
  densityMatrix,
  boundsMinBohr,
  boundsMaxBohr,
  dimensions
}) {
  const [nx, ny, nz] = dimensions;
  const nBasis = basis.length;
  if (nBasis > 64) {
    throw new RangeError(`sampleMolecularChargeDensityWebGpu supports up to 64 basis functions, got ${nBasis}`);
  }
  const totalVoxels = nx * ny * nz;
  const stepX = nx > 1 ? (boundsMaxBohr[0] - boundsMinBohr[0]) / (nx - 1) : 1;
  const stepY = ny > 1 ? (boundsMaxBohr[1] - boundsMinBohr[1]) / (ny - 1) : 1;
  const stepZ = nz > 1 ? (boundsMaxBohr[2] - boundsMinBohr[2]) / (nz - 1) : 1;

  const paramsBufData = new ArrayBuffer(48);
  const paramsU32 = new Uint32Array(paramsBufData);
  const paramsF32 = new Float32Array(paramsBufData);
  paramsU32[0] = nx;
  paramsU32[1] = ny;
  paramsU32[2] = nz;
  paramsU32[3] = nBasis;
  paramsF32[4] = boundsMinBohr[0];
  paramsF32[5] = boundsMinBohr[1];
  paramsF32[6] = boundsMinBohr[2];
  paramsF32[7] = 0;
  paramsF32[8] = stepX;
  paramsF32[9] = stepY;
  paramsF32[10] = stepZ;
  paramsF32[11] = 0;

  const primList = [];
  const metaBufData = new ArrayBuffer(Math.max(1, nBasis) * 32);
  const metaView = new DataView(metaBufData);
  for (let u = 0; u < nBasis; u += 1) {
    const fn = basis[u];
    const primOffset = primList.length >> 1;
    for (let p = 0; p < fn.exps.length; p += 1) {
      primList.push(fn.exps[p], fn.coeffs[p]);
    }
    const base = u * 32;
    metaView.setFloat32(base + 0, fn.center[0], true);
    metaView.setFloat32(base + 4, fn.center[1], true);
    metaView.setFloat32(base + 8, fn.center[2], true);
    metaView.setUint32(base + 12, primOffset, true);
    metaView.setUint32(base + 16, fn.lmn[0], true);
    metaView.setUint32(base + 20, fn.lmn[1], true);
    metaView.setUint32(base + 24, fn.lmn[2], true);
    metaView.setUint32(base + 28, fn.exps.length, true);
  }
  const primF32 = Float32Array.from(primList.length ? primList : [1, 0]);
  const pFlat = new Float32Array(Math.max(1, nBasis * nBasis));
  for (let u = 0; u < nBasis; u += 1) {
    for (let v = 0; v < nBasis; v += 1) {
      pFlat[u * nBasis + v] = densityMatrix[u][v];
    }
  }

  const paramsBuffer = device.createBuffer({ label: 'quantum-density-params', size: 48, usage: USAGE_UNIFORM | USAGE_COPY_DST });
  const metaBuffer = device.createBuffer({ label: 'quantum-density-meta', size: metaBufData.byteLength, usage: USAGE_STORAGE | USAGE_COPY_DST });
  const primBuffer = device.createBuffer({ label: 'quantum-density-prims', size: primF32.byteLength, usage: USAGE_STORAGE | USAGE_COPY_DST });
  const pBuffer = device.createBuffer({ label: 'quantum-density-pmatrix', size: pFlat.byteLength, usage: USAGE_STORAGE | USAGE_COPY_DST });
  const gridBuffer = device.createBuffer({ label: 'quantum-density-grid', size: totalVoxels * 4, usage: USAGE_STORAGE | USAGE_COPY_SRC });
  const receiptBuffer = device.createBuffer({ label: 'quantum-density-receipt', size: 16, usage: USAGE_STORAGE | USAGE_COPY_SRC | USAGE_COPY_DST });
  const readGrid = device.createBuffer({ label: 'quantum-density-read-grid', size: totalVoxels * 4, usage: USAGE_COPY_DST | USAGE_MAP_READ });
  const readReceipt = device.createBuffer({ label: 'quantum-density-read-receipt', size: 16, usage: USAGE_COPY_DST | USAGE_MAP_READ });

  device.queue.writeBuffer(paramsBuffer, 0, paramsBufData);
  device.queue.writeBuffer(metaBuffer, 0, metaBufData);
  device.queue.writeBuffer(primBuffer, 0, primF32);
  device.queue.writeBuffer(pBuffer, 0, pFlat);
  device.queue.writeBuffer(receiptBuffer, 0, new Uint32Array(4));

  const bindings = [
    computeBufferBinding(0, 'uniform'),
    computeBufferBinding(1, 'read-only-storage'),
    computeBufferBinding(2, 'read-only-storage'),
    computeBufferBinding(3, 'read-only-storage'),
    computeBufferBinding(4, 'storage'),
    computeBufferBinding(5, 'storage')
  ];
  const pipeline = createCachedExplicitComputePipeline(device, {
    cacheKey: 'ulg-quantum-molecular-density.v1',
    label: 'ulg-quantum-molecular-density',
    code: quantumMolecularDensityWgsl,
    entryPoint: 'sample_molecular_density',
    bindings
  });
  const bindGroup = createCachedExplicitBindGroup(device, {
    layout: pipeline.bindGroupLayout,
    label: 'ulg-quantum-molecular-density-bg',
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: metaBuffer } },
      { binding: 2, resource: { buffer: primBuffer } },
      { binding: 3, resource: { buffer: pBuffer } },
      { binding: 4, resource: { buffer: gridBuffer } },
      { binding: 5, resource: { buffer: receiptBuffer } }
    ]
  });

  try {
    const encoder = device.createCommandEncoder({ label: 'ulg-quantum-density-enc' });
    const pass = encoder.beginComputePass({ label: 'ulg-quantum-density-pass' });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(totalVoxels / 64));
    pass.end();
    encoder.copyBufferToBuffer(gridBuffer, 0, readGrid, 0, totalVoxels * 4);
    encoder.copyBufferToBuffer(receiptBuffer, 0, readReceipt, 0, 16);
    device.queue.submit([encoder.finish()]);

    await Promise.all([readGrid.mapAsync(1), readReceipt.mapAsync(1)]);
    const density = new Float32Array(readGrid.getMappedRange().slice(0));
    const receiptWords = new Uint32Array(readReceipt.getMappedRange().slice(0));
    readGrid.unmap();
    readReceipt.unmap();

    const maxRhoView = new DataView(receiptWords.buffer);
    const maxRho = maxRhoView.getFloat32(4, true);
    let sum = 0;
    for (let i = 0; i < density.length; i += 1) sum += density[i];
    return {
      density,
      processedVoxels: receiptWords[0],
      maxRho,
      voxelIntegralElectrons: sum * stepX * stepY * stepZ,
      voxelSpacingBohr: [stepX, stepY, stepZ],
      statusBadge: QUANTUM_DERIVATION_STATUS.webgpuDerived
    };
  } finally {
    paramsBuffer.destroy();
    metaBuffer.destroy();
    primBuffer.destroy();
    pBuffer.destroy();
    gridBuffer.destroy();
    receiptBuffer.destroy();
    readGrid.destroy();
    readReceipt.destroy();
  }
}

/**
 * Build a provenance-backed molecular charge-density + bond-order discovery
 * artifact from `rhf` / `ump2` / `populationAnalysis` / `rhfAnalyticGradient`.
 */
export function buildMolecularChargeDensityArtifact(atoms, {
  formula = null,
  basis = 'sto-3g',
  charge = 0,
  multiplicity = 1,
  gridDim = 16,
  maxGridDim = 48,
  paddingBohr = 3.2,
  includeUmp2 = false,
  includeAnalyticGradient = false,
  includeOrbitals = true,
  nebProductAtoms = null,
  generatorFingerprint = QUANTUM_DERIVATION_GENERATOR_FINGERPRINT
} = {}) {
  if (!Array.isArray(atoms) || atoms.length === 0) {
    throw new TypeError('buildMolecularChargeDensityArtifact requires a non-empty atoms array');
  }
  const hf = rhf(atoms, { basis, charge });
  const pop = populationAnalysis(hf, atoms);
  const ump2Res = includeUmp2 ? atomizationEnergyMp2Ha(atoms, { basis }) : null;
  const gradRes = includeAnalyticGradient ? rhfAnalyticGradient(atoms, { basis, charge }) : null;
  const nebRes = nebProductAtoms
    ? climbingImageNEB(atoms, nebProductAtoms, { basis, nImages: 5, maxSteps: 8, stepSize: 0.2 })
    : null;

  const minB = [Infinity, Infinity, Infinity];
  const maxB = [-Infinity, -Infinity, -Infinity];
  for (const a of atoms) {
    for (let d = 0; d < 3; d += 1) {
      minB[d] = Math.min(minB[d], a.position[d] - paddingBohr);
      maxB[d] = Math.max(maxB[d], a.position[d] + paddingBohr);
    }
  }
  const requestedDim = clampInt(gridDim, 6, 96);
  const dim = Math.min(requestedDim, clampInt(maxGridDim, 6, 96));
  const downsampled = dim < requestedDim;
  const dimensions = [dim, dim, dim];

  const homoIndex = hf.nOcc - 1;
  const lumoIndex = hf.nOcc < hf.nBasis ? hf.nOcc : -1;
  const sampled = sampleMolecularChargeDensityCpu({
    basis: hf.basis,
    densityMatrix: hf.P,
    moCoefficients: includeOrbitals ? hf.C : null,
    homoIndex,
    lumoIndex,
    boundsMinBohr: minB,
    boundsMaxBohr: maxB,
    dimensions
  });

  const resolvedFormula = formula || atoms.map((a) => `Z${a.Z}`).join('-');
  const atomVectorHash = hashPayload(atoms.map((a) => ({ Z: a.Z, position: a.position })));
  const inputHash = hashPayload({ formula: resolvedFormula, atomVectorHash, basis, charge, multiplicity, dim });
  const methodHash = hashPayload({ method: includeUmp2 ? 'rhf+ump2' : 'rhf', basis, generatorFingerprint });
  const invalidationKey = hashPayload({ inputHash, methodHash, generatorFingerprint, schema: ULG_MOLECULAR_CHARGE_DENSITY_GRID_SCHEMA });

  const densePayloads = {};
  const densityHandleKey = `molecular-density:${resolvedFormula}:${basis}:${dim}`;
  densePayloads[densityHandleKey] = sampled.density;
  let homoHandleKey = null;
  let lumoHandleKey = null;
  if (sampled.homo) {
    homoHandleKey = `molecular-homo:${resolvedFormula}:${basis}:${dim}`;
    densePayloads[homoHandleKey] = sampled.homo;
  }
  if (sampled.lumo) {
    lumoHandleKey = `molecular-lumo:${resolvedFormula}:${basis}:${dim}`;
    densePayloads[lumoHandleKey] = sampled.lumo;
  }

  const bonds = [];
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const order = pop.bondOrders[i][j];
      const distBohr = Math.hypot(
        atoms[i].position[0] - atoms[j].position[0],
        atoms[i].position[1] - atoms[j].position[1],
        atoms[i].position[2] - atoms[j].position[2]
      );
      if (order > 0.05) {
        bonds.push({
          atomA: i,
          atomB: j,
          zA: atoms[i].Z,
          zB: atoms[j].Z,
          mayerBondOrder: order,
          distanceBohr: distBohr,
          distanceM: distBohr * BOHR_TO_M
        });
      }
    }
  }

  const homoEnergyHa = homoIndex >= 0 ? hf.orbitalEnergies[homoIndex] : null;
  const lumoEnergyHa = lumoIndex >= 0 ? hf.orbitalEnergies[lumoIndex] : null;

  const bondDiscoveryTrace = {
    schema: ULG_BOND_DISCOVERY_TRACE_SCHEMA,
    schemaVersion: 1,
    formula: resolvedFormula,
    atomVectorHash,
    mullikenCharges: pop.charges,
    bonds,
    analyticGradientHaPerBohr: gradRes ? gradRes.gradientHaPerBohr : null,
    maxGradientHaPerBohr: gradRes ? gradRes.maxGradHaPerBohr : null,
    nebBarrierTrace: nebRes
      ? {
        saddleImageIndex: nebRes.saddleImageIndex,
        forwardBarrierHa: nebRes.forwardBarrierHa,
        reverseBarrierHa: nebRes.reverseBarrierHa,
        reactionEnergyHa: nebRes.reactionEnergyHa,
        steps: nebRes.steps
      }
      : null
  };

  const artifact = {
    schema: ULG_MOLECULAR_CHARGE_DENSITY_GRID_SCHEMA,
    schemaVersion: 1,
    materialKey: resolvedFormula,
    formula: resolvedFormula,
    atomVectorHash,
    charge,
    multiplicity,
    basis,
    methodStatus: includeUmp2 ? 'RHF+UMP2' : 'RHF',
    statusBadge: QUANTUM_DERIVATION_STATUS.firstPrinciplesDerived,
    coordinateFrame: 'molecular-cartesian-bohr',
    units: { length: 'Bohr', energy: 'Ha', density: 'e/Bohr^3', meterScaleFactor: BOHR_TO_M },
    sourceClosureRefs: [{ module: 'src/runtime/electronicStructure/molecularHartreeFock.js', symbol: includeUmp2 ? 'rhf+ump2' : 'rhf' }],
    inputHash,
    methodHash,
    generatorFingerprint,
    invalidationKey,
    geometry: atoms.map((a, idx) => ({ index: idx, Z: a.Z, positionBohr: [...a.position] })),
    electronicSummary: {
      nBasis: hf.nBasis,
      nElectrons: hf.nElectrons,
      nOcc: hf.nOcc,
      rhfTotalEnergyHa: hf.totalEnergyHa,
      orbitalEnergiesHa: [...hf.orbitalEnergies],
      homoEnergyHa,
      lumoEnergyHa,
      homoLumoGapHa: homoEnergyHa != null && lumoEnergyHa != null ? lumoEnergyHa - homoEnergyHa : null,
      ump2AtomizationEnergyHa: ump2Res ? ump2Res.atomizationEnergyHa : null,
      ump2CorrelationHa: ump2Res ? ump2Res.ump2CorrelationHa : null
    },
    grid: {
      dimensions,
      boundsMinBohr: minB,
      boundsMaxBohr: maxB,
      voxelSpacingBohr: sampled.voxelSpacingBohr,
      downsampled,
      downsampleReason: downsampled ? `capped-to-maxGridDim-${maxGridDim}` : null,
      maxDensityPerBohr3: sampled.maxRho,
      voxelIntegralElectrons: sampled.voxelIntegralElectrons,
      isovaluePolicy: {
        strategy: 'density-fraction-shells',
        isovaluesPerBohr3: [0.002, 0.02, 0.08]
      },
      payloadHandles: {
        chargeDensity: { key: densityHandleKey, dtype: 'f32', byteLength: sampled.density.byteLength },
        homoOrbital: homoHandleKey ? { key: homoHandleKey, dtype: 'f32', byteLength: sampled.homo.byteLength } : null,
        lumoOrbital: lumoHandleKey ? { key: lumoHandleKey, dtype: 'f32', byteLength: sampled.lumo.byteLength } : null
      }
    },
    bondDiscoveryTrace,
    validity: {
      status: 'first-principles-molecular-density-valid',
      domain: { boundsMinBohr: minB, boundsMaxBohr: maxB }
    },
    validation: {
      status: 'warn',
      scientificValidation: false,
      strictModeCompatible: true,
      fallbackPolicy: 'fail-closed-no-extrapolation',
      staleReason: null
    }
  };

  return { artifact, densePayloads, hf };
}

/**
 * Compose a complete provenance-linked Schrödinger material-derivation
 * visualization bundle chaining:
 *   element/formula -> atomic DFT (PBE+SO) -> molecular HF/UMP2 (charge density
 *   + Mulliken/Mayer bonds) -> QHA bulk closure -> Eshkol Triad A4 Chebyshev
 *   response-fit replay -> packed runtime row refs.
 */
export function buildMaterialDerivationVisualizationBundle({
  materialKey,
  formula = materialKey,
  atomicNumberZ = null,
  atoms = null,
  basis = 'sto-3g',
  functional = 'pbe',
  scalarRelativistic = false,
  spinOrbit = true,
  gridDim = 14,
  maxGridDim = 48,
  includeUmp2 = true,
  includeQhaClosure = true,
  includeTriadA4Replay = true,
  generatorFingerprint = QUANTUM_DERIVATION_GENERATOR_FINGERPRINT
} = {}) {
  const key = String(materialKey || formula || '').trim();
  if (!key) {
    throw new TypeError('buildMaterialDerivationVisualizationBundle requires materialKey or formula');
  }
  const densePayloads = {};
  const stages = [];

  let atomicArtifact = null;
  const resolvedZ = atomicNumberZ ?? (Array.isArray(atoms) && atoms.length > 0 ? Math.max(...atoms.map((a) => a.Z)) : null);
  if (resolvedZ != null) {
    const atomic = buildAtomicRadialDensityArtifact(resolvedZ, {
      functional,
      scalarRelativistic,
      spinOrbit,
      cloudGridDim: gridDim,
      maxGridDim,
      generatorFingerprint
    });
    atomicArtifact = atomic.artifact;
    Object.assign(densePayloads, atomic.densePayloads);
    stages.push({
      stage: 'atomic-electronic-structure',
      statusBadge: atomicArtifact.statusBadge,
      schema: atomicArtifact.schema,
      invalidationKey: atomicArtifact.invalidationKey
    });
  }

  let molecularArtifact = null;
  if (Array.isArray(atoms) && atoms.length > 0) {
    const mol = buildMolecularChargeDensityArtifact(atoms, {
      formula: formula || key,
      basis,
      gridDim,
      maxGridDim,
      includeUmp2,
      generatorFingerprint
    });
    molecularArtifact = mol.artifact;
    Object.assign(densePayloads, mol.densePayloads);
    stages.push({
      stage: 'molecular-charge-density-and-bonding',
      statusBadge: molecularArtifact.statusBadge,
      schema: molecularArtifact.schema,
      invalidationKey: molecularArtifact.invalidationKey
    });
  }

  let qhaBulkClosure = null;
  if (includeQhaClosure && Array.isArray(atoms) && atoms.length > 0) {
    qhaBulkClosure = deriveMolecularBulkClosure({
      formula: formula || key,
      atoms,
      basis
    });
    stages.push({
      stage: 'qha-bulk-material-closure',
      statusBadge: QUANTUM_DERIVATION_STATUS.firstPrinciplesDerived,
      schema: 'peercompute.ulg.molecular-bulk-closure.v1',
      invalidationKey: hashPayload({ key, basis, cohesive: qhaBulkClosure.cohesiveEnergyJPerMol })
    });
  }

  let responseFitReplay = null;
  if (includeTriadA4Replay) {
    const AVOGADRO = 6.02214076e23;
    const R_GAS = 8.314462618;
    const derivedMolarMassKgPerMol = qhaBulkClosure?.molarMassKgPerMol
      ?? (Array.isArray(atoms) && atoms.length > 0
        ? atoms.reduce((s, a) => s + atomicMassKg(a.Z) * AVOGADRO, 0)
        : (resolvedZ ? atomicMassKg(resolvedZ) * AVOGADRO : 0.028));
    const rSpecific = R_GAS / Math.max(1e-4, derivedMolarMassKgPerMol);
    const derivedDensityKgM3 = qhaBulkClosure?.estimatedDensityKgPerM3
      ?? (atomicArtifact?.summary?.containmentRadii?.r95Bohr
        ? (derivedMolarMassKgPerMol / AVOGADRO) / Math.max(1e-30, (4 / 3) * Math.PI * ((atomicArtifact.summary.containmentRadii.r95Bohr * 0.75 * BOHR_TO_M) ** 3))
        : 1200);
    const refV = 1 / Math.max(10, Math.min(30000, derivedDensityKgM3));
    const derivedBulkPa = qhaBulkClosure?.bulkModulusPa
      ?? Math.max(1e8, ((qhaBulkClosure?.cohesiveEnergyJPerMol ?? 25000) / Math.max(1e-6, derivedMolarMassKgPerMol)) * Math.max(10, derivedDensityKgM3) * 0.8);
    const tMelt = qhaBulkClosure?.meltingPointK ?? 300;
    const tBoil = qhaBulkClosure?.boilingPointK ?? 600;
    const cp = qhaBulkClosure?.cpLiquidJPerKgK ?? qhaBulkClosure?.cpSolidJPerKgK ?? Math.max(300, 3.5 * rSpecific);
    const tRange = [Math.max(120, tMelt * 0.7), Math.max(500, tBoil * 1.4)];
    const vRange = [refV * 0.90, refV * 1.15];
    const program = eshkolHelmholtzProgram({
      material: key,
      cvJPerKgK: Math.max(120, cp * 0.75),
      rSpecificJPerKgK: rSpecific,
      bulkModulusPa: Math.max(1e7, derivedBulkPa),
      refTemperatureK: Math.max(150, tMelt),
      refSpecificVolumeM3PerKg: refV
    });
    const fit = fitResponseFunction({
      box: [tRange, vRange],
      degrees: [16, 10],
      relativeTolerance: 1e-4,
      generator: {
        id: `a4:eshkol-helmholtz:${key}`,
        axes: [
          { name: 'temperature', unit: 'K' },
          { name: 'specificVolume', unit: 'm^3/kg' }
        ],
        outputUnit: 'J/kg',
        sourceFingerprint: program.sourceFingerprint,
        regimeOf: () => 'single-phase',
        evaluate: ([T, v]) => program.closedForm.a(T, v)
      }
    });
    const packed = packResponseFunctionsForGpu([fit]);
    responseFitReplay = {
      schema: ULG_MATERIAL_RESPONSE_FIT_REPLAY_SCHEMA,
      schemaVersion: 1,
      materialKey: key,
      fitFamily: 'chebyshev-tensor-2d',
      statusBadge: QUANTUM_DERIVATION_STATUS.fitHit,
      functionCount: 1,
      maxRelativeResidual: fit.maxRelativeResidual ?? fit.residualBound ?? 0,
      envelopeBounds: {
        temperatureK: tRange,
        specificVolumeM3PerKg: vRange
      },
      packedRuntimeRowRef: {
        schema: 'peercompute.ulg.response-function-gpu-table.v1',
        tableByteLength: packed?.buffer?.byteLength ?? packed?.data?.byteLength ?? 0,
        sourceFingerprint: program.sourceFingerprint
      },
      extrapolationPolicy: 'fail-closed-in-box-ok-flag'
    };
    stages.push({
      stage: 'triad-a4-response-fit-replay',
      statusBadge: responseFitReplay.statusBadge,
      schema: responseFitReplay.schema,
      invalidationKey: responseFitReplay.packedRuntimeRowRef.sourceFingerprint
    });
  }

  const inputHash = hashPayload({ key, formula, resolvedZ, basis, functional, gridDim });
  const invalidationKey = hashPayload({
    inputHash,
    generatorFingerprint,
    stageKeys: stages.map((s) => s.invalidationKey)
  });

  const bundle = {
    schema: ULG_MATERIAL_DERIVATION_VISUALIZATION_BUNDLE_SCHEMA,
    schemaVersion: 1,
    materialKey: key,
    formula: formula || key,
    units: {
      microLength: 'Bohr',
      macroLength: 'm',
      energy: 'Ha',
      macroEnergy: 'J/mol',
      temperature: 'K',
      meterScaleFactor: BOHR_TO_M
    },
    coordinateFrame: 'multiscale-micro-inspector-inset',
    sourceClosureRefs: [
      ...(atomicArtifact?.sourceClosureRefs || []),
      ...(molecularArtifact?.sourceClosureRefs || []),
      ...(qhaBulkClosure ? [{ module: 'src/runtime/material/elementClosures.js', symbol: 'deriveMolecularBulkClosure' }] : []),
      ...(responseFitReplay ? [{ module: 'src/runtime/material/eshkolTriadClosures.js', symbol: 'buildTriadClosureGpuTable' }] : [])
    ],
    inputHash,
    generatorFingerprint,
    invalidationKey,
    stages,
    atomicRadialDensity: atomicArtifact,
    molecularChargeDensity: molecularArtifact,
    qhaBulkClosure: qhaBulkClosure
      ? {
        cohesiveEnergyJPerMol: qhaBulkClosure.cohesiveEnergyJPerMol,
        meltingPointK: qhaBulkClosure.meltingPointK,
        boilingPointK: qhaBulkClosure.boilingPointK,
        latentHeatFusionJPerKg: qhaBulkClosure.latentHeatFusionJPerKg,
        latentHeatVaporizationJPerKg: qhaBulkClosure.latentHeatVaporizationJPerKg,
        cpSolidJPerKgK: qhaBulkClosure.cpSolidJPerKgK,
        cpGasJPerKgK: qhaBulkClosure.cpGasJPerKgK,
        scientificValidation: qhaBulkClosure.validation?.scientificValidation === true
      }
      : null,
    responseFitReplay,
    densePayloadIndex: Object.fromEntries(
      Object.entries(densePayloads).map(([handleKey, arr]) => [handleKey, {
        dtype: 'f32',
        length: arr.length,
        byteLength: arr.byteLength
      }])
    ),
    validation: {
      status: 'warn',
      scientificValidation: false,
      strictModeCompatible: true,
      staleReason: null,
      fallbackPolicy: 'fail-closed-no-extrapolation'
    }
  };

  return { bundle, densePayloads };
}

/**
 * Strict fail-closed validator for visualization bundles: rejects missing units,
 * missing source closure refs, stale generator fingerprints, or unvalidated
 * scientific overclaims.
 */
export function validateDerivationVisualizationBundle(bundle, {
  expectedGeneratorFingerprint = QUANTUM_DERIVATION_GENERATOR_FINGERPRINT,
  strict = true
} = {}) {
  const blockers = [];
  if (!bundle || bundle.schema !== ULG_MATERIAL_DERIVATION_VISUALIZATION_BUNDLE_SCHEMA) {
    blockers.push('invalid-bundle-schema');
  }
  if (!bundle?.units || !bundle.units.microLength || !bundle.units.energy) {
    blockers.push('missing-units');
  }
  if (!Array.isArray(bundle?.sourceClosureRefs) || bundle.sourceClosureRefs.length === 0) {
    blockers.push('missing-source-closure-refs');
  }
  if (!bundle?.generatorFingerprint) {
    blockers.push('missing-generator-fingerprint');
  } else if (expectedGeneratorFingerprint && bundle.generatorFingerprint !== expectedGeneratorFingerprint) {
    blockers.push('cache-stale:generator-fingerprint-mismatch');
  }
  if (bundle?.atomicRadialDensity?.orbitalCloudGrid && bundle.atomicRadialDensity.orbitalCloudGrid.reconstructionKind !== 'radial-atomic-density-reconstruction') {
    blockers.push('invalid-atomic-cloud-reconstruction-label');
  }
  if (strict && bundle?.validation?.scientificValidation === true) {
    blockers.push('unsupported-scientific-validation-claim');
  }
  const ok = blockers.length === 0;
  return Object.freeze({
    ok,
    status: ok ? 'valid' : (blockers.some((b) => b.startsWith('cache-stale')) ? QUANTUM_DERIVATION_STATUS.cacheStale : 'blocked'),
    blockers: Object.freeze(blockers)
  });
}

/**
 * Create a pluggable ULG simulation-module registration for
 * `{ model: 'quantum-material-derivation', version: 1 }` so `ulg-runtime` can
 * serve provenance-backed quantum derivation visualization bundles through
 * `simulation.step` capsules + `residentBufferLease` on a shared `GPUDevice`.
 */
export function createQuantumDerivationSimulationModule() {
  let stepCounter = 0;
  return {
    method: { model: 'quantum-material-derivation', version: 1 },
    kernel: {
      sourceModule: 'src/runtime/electronicStructure/quantumDerivationArtifacts.js',
      entryPoint: 'sample_molecular_density',
      wgsl: quantumMolecularDensityWgsl,
      workgroupSize: 64
    },
    parameterSchema: {
      gridDim: { type: 'number', min: 4, max: 64, required: false },
      functional: { type: 'string', required: false },
      basis: { type: 'string', required: false }
    },
    stateLayout: {
      tensorId: 'quantum-density-volume',
      dtype: 'f32',
      layout: 'row-major',
      strideElements: 1,
      strideBytes: 4,
      fields: ['rho_e_per_bohr3']
    },
    scaleRangeM: [1e-11, 1e-8],
    async stepCapsule(capsule, { createSimulationArtifact, device, leaseSession }) {
      const input = capsule.input || {};
      const params = input.parameters || {};
      const hasExplicitMaterial = Boolean(
        input.materialKey
        || input.formula
        || Number.isInteger(Number(input.atomicNumberZ))
        || (Array.isArray(input.atoms) && input.atoms.length > 0)
      );
      if (!hasExplicitMaterial) {
        throw new RangeError(
          'quantum-material-derivation@1 requires explicit atomicNumberZ, atoms, or formula/materialKey (no silent H2O fallback).'
        );
      }
      const { bundle, densePayloads } = buildMaterialDerivationVisualizationBundle({
        materialKey: input.materialKey || input.formula || (input.atomicNumberZ ? `Z${input.atomicNumberZ}` : 'molecule'),
        formula: input.formula || input.materialKey || null,
        atomicNumberZ: input.atomicNumberZ ?? null,
        atoms: input.atoms ?? null,
        basis: params.basis || input.basis || 'sto-3g',
        functional: params.functional || input.functional || 'pbe',
        gridDim: params.gridDim ?? input.gridDim ?? 12,
        includeUmp2: input.includeUmp2 !== false,
        includeQhaClosure: input.includeQhaClosure !== false,
        includeTriadA4Replay: input.includeTriadA4Replay !== false
      });

      const validationCheck = validateDerivationVisualizationBundle(bundle, { strict: true });
      if (!validationCheck.ok) {
        throw new Error(`Quantum derivation bundle failed strict check: ${validationCheck.blockers.join(', ')}`);
      }

      stepCounter += 1;
      let primaryKey = Object.keys(densePayloads)[0] || 'quantum-density-volume';
      let primaryValues = densePayloads[primaryKey] || new Float32Array(0);
      let gpuBuffer = null;
      let executedWebGpuKernel = false;

      if (
        device
        && typeof device.createComputePipeline === 'function'
        && Array.isArray(input.atoms)
        && input.atoms.length > 0
        && bundle.molecularChargeDensity?.grid
      ) {
        const molGrid = bundle.molecularChargeDensity.grid;
        const hf = rhf(input.atoms, { basis: params.basis || input.basis || 'sto-3g' });
        const gpuRes = await sampleMolecularChargeDensityWebGpu(device, {
          basis: hf.basis,
          densityMatrix: hf.P,
          boundsMinBohr: molGrid.boundsMinBohr,
          boundsMaxBohr: molGrid.boundsMaxBohr,
          dimensions: molGrid.dimensions
        });
        primaryKey = molGrid.payloadHandles.chargeDensity.key;
        primaryValues = gpuRes.density;
        densePayloads[primaryKey] = primaryValues;
        executedWebGpuKernel = true;
      }

      if (device && typeof device.createBuffer === 'function' && primaryValues.byteLength > 0) {
        gpuBuffer = device.createBuffer({
          label: `ulg-quantum-density-${primaryKey}`,
          size: primaryValues.byteLength,
          usage: USAGE_STORAGE | USAGE_COPY_DST | USAGE_COPY_SRC
        });
        device.queue.writeBuffer(gpuBuffer, 0, primaryValues);
      }

      leaseSession.publishBuffer({
        resourceKey: 'quantum-density-volume',
        buffer: gpuBuffer,
        byteLength: primaryValues.byteLength,
        rowCount: primaryValues.length,
        stepIndex: stepCounter,
        portableSnapshotFn: () => Float32Array.from(primaryValues)
      });
      const leaseHandle = leaseSession.borrowBufferReadLease({
        resourceKey: 'quantum-density-volume',
        consumerStage: 'quantum-inspector-renderer',
        reason: 'density-volume-read-lease'
      });

      const honestBackend = executedWebGpuKernel
        ? 'webgpu-resident-volume'
        : gpuBuffer
          ? 'cpu-staged-gpu-buffer'
          : 'worker-cpu-derived';

      const artifact = createSimulationArtifact({
        artifactId: `${capsule.taskId}:quantum-derivation:${stepCounter}`,
        taskKind: capsule.taskKind,
        closureRef: {
          module: 'src/runtime/electronicStructure/quantumDerivationArtifacts.js',
          generatorFingerprint: bundle.generatorFingerprint
        },
        representation: 'quantum-derivation-bundle',
        outputs: {
          deltas: [{ operation: 'replace', tensorId: 'quantum-density-volume', fromStep: stepCounter - 1, toStep: stepCounter }],
          bundle
        },
        execution: {
          backend: honestBackend,
          stage: 'quantum.material.derivation',
          placement: 'local'
        },
        validity: {
          status: 'quantum-derivation-bundle-valid',
          invalidationKey: bundle.invalidationKey,
          payloadCount: Object.keys(densePayloads).length
        },
        validation: {
          status: 'pass',
          validationMode: 'strict-provenance-contract',
          scientificValidation: false,
          fullPhysicsValidation: false
        },
        provenance: {
          ...capsule.provenance,
          sourceService: ULG_SERVICE_IDS.ulgRuntime,
          methodHash: capsule.methodHash,
          inputHash: capsule.inputHash
        }
      });

      return { artifact, leaseHandle, densePayloads };
    },
    reset({ nextStep = 0 }) {
      stepCounter = nextStep;
    }
  };
}
