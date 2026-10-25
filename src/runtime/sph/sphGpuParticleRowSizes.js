import {
  SPH_GPU_PARTICLE_STATE_ROW_LAYOUT,
  SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT,
  SPH_GPU_PARTICLE_IDENTITY_ROW_LAYOUT,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT
} from '../../../ulg-gpu-abi/src/index.js';

// Keep ABI sizes independent of owner/transaction initialization. The private
// two-level producers and spatial transactions authenticate each other, while
// both need these constants during module evaluation.
export const SPH_GPU_PARTICLE_STATE_FLOATS = SPH_GPU_PARTICLE_STATE_ROW_LAYOUT.length;
export const SPH_GPU_PARTICLE_THERMO_FLOATS = SPH_GPU_PARTICLE_THERMO_ROW_LAYOUT.length;
export const SPH_GPU_PARTICLE_IDENTITY_UINTS = SPH_GPU_PARTICLE_IDENTITY_ROW_LAYOUT.length;
export const MLS_MPM_GPU_PARTICLE_MECHANICS_FLOATS = MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT.length;
