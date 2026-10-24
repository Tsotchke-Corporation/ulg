// Cache module resolution, not GPU resources or physics authority. Keep the
// import lazy because the mechanics bundle also imports its stage consumers.
export function createSphMlsMpmKernelBundleLoader(importBundle) {
  if (typeof importBundle !== 'function') {
    throw new TypeError('mechanics kernel bundle loader requires an importer');
  }
  let bundlePromise = null;
  return function loadKernelBundle() {
    if (!bundlePromise) {
      const attempt = Promise.resolve().then(importBundle).catch(error => {
        if (bundlePromise === attempt) bundlePromise = null;
        throw error;
      });
      bundlePromise = attempt;
    }
    return bundlePromise;
  };
}

export const loadSphMlsMpmKernelBundle = createSphMlsMpmKernelBundleLoader(
  () => import('./sphMlsMpmGpuStep.js')
);
