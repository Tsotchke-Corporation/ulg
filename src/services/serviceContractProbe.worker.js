import { ComputeServiceRegistry } from '../runtime/ComputeServiceRegistry.js';
import { probeManifestServiceAssets } from '../runtime/ServiceAssetProbe.js';

self.addEventListener('message', (event) => {
  void consumeContractFixtures(event.data);
});

async function consumeContractFixtures({ manifest, taskCapsule }) {
  try {
    const registry = new ComputeServiceRegistry();
    const service = await registry.register(manifest);
    const resolvedServices = registry.resolve(taskCapsule.taskKind);
    const assetProbe = await probeManifestServiceAssets(manifest, {
      fetchImpl: self.fetch?.bind(self),
      locationHref: self.location?.href
    });

    self.postMessage({
      type: 'fixture-consumed',
      serviceId: service.serviceId,
      taskKind: taskCapsule.taskKind,
      resolvedCount: resolvedServices.length,
      assetProbe
    });
  } catch (error) {
    self.postMessage({
      type: 'fixture-error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
