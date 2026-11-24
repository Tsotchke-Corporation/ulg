// Gate 0B: Unified WebGPU Numerical Substrate Barrel (`src/runtime/gpuMath/index.js`).
// Shared across 40 orders of magnitude: Gate 1 Periodic Table (Nuclear/Atomic/Bulk DFT/MD),
// Gate 2 Molecular QM/Reactions/Polytope Atlas, Gate 3 Continuum, and Gate 5 Cosmological TreePM.

export {
  ULG_GPU_EIGENSOLVER_SCHEMA,
  batchedSymmetricEigensolverWgsl,
  solveSymmetricEigenBatchedWebGpu,
  solveGeneralizedSymmetricEigenBatchedWebGpu
} from './batchedSymmetricEigensolverGpu.js';

export {
  ULG_GPU_FFT3D_SCHEMA,
  fft3dWebGpuWgsl,
  createFft3dWorkspaceWebGpu,
  fft3dWebGpu,
  solvePoisson3dWebGpu
} from './fft3dWebGpu.js';

export {
  ULG_GPU_MD_SCHEMA,
  MD_POTENTIAL_MODELS,
  MD_TIME_UNIT_FS,
  KB_EV_PER_K,
  molecularDynamicsWebGpuWgsl,
  createMolecularDynamicsSessionWebGpu,
  buildFccCrystalMdState
} from './molecularDynamicsWebGpu.js';

export {
  ULG_POLYTOPE_CHEBYSHEV_FIT_SCHEMA,
  evalChebyshev2d,
  fitConvexPolytopeWebGpu
} from './chebyshevPolytopeFitGpu.js';
