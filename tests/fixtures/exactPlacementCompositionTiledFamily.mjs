import { withActualExactFamily as withFamily } from './exactPlacementCompositionFamily.mjs';

// Fixed recorder-device limits apply before the first source allocation. This
// changes no packet/evidence dimensions and never supplies a caller tile K.
export function withActualExactFamily(callback, sourceOptions = {}) {
  return withFamily(callback, sourceOptions, {
    storageBindingLimit: 100000,
    strictStorageAllocations: true,
    freezeLimits: true
  });
}
