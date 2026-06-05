export class ComputeServiceRegistry {
  constructor() {
    this.manifests = new Map();
  }

  async register(manifest) {
    if (!manifest?.serviceId) {
      throw new Error('Service manifests require serviceId');
    }
    if (!manifest.entry?.workerModule) {
      throw new Error(`Service ${manifest.serviceId} requires entry.workerModule`);
    }
    this.manifests.set(manifest.serviceId, structuredCloneSerializable(manifest));
    return this.get(manifest.serviceId);
  }

  get(serviceId) {
    const manifest = this.manifests.get(serviceId);
    if (!manifest) {
      return undefined;
    }
    return {
      serviceId,
      manifest,
      capabilities: [...manifest.capabilities],
      taskKinds: [...(manifest.taskKinds ?? manifest.capabilities)]
    };
  }

  resolve(taskKind) {
    return [...this.manifests.values()]
      .filter((manifest) => {
        const taskKinds = manifest.taskKinds ?? manifest.capabilities;
        return taskKinds.includes(taskKind) || manifest.capabilities.includes(taskKind);
      })
      .map((manifest) => this.get(manifest.serviceId));
  }

  listCapabilities() {
    return {
      services: [...this.manifests.values()].map((manifest) => ({
        serviceId: manifest.serviceId,
        runtime: manifest.runtime,
        capabilities: [...manifest.capabilities],
        taskKinds: [...(manifest.taskKinds ?? manifest.capabilities)],
        abi: manifest.abi
      })),
      capabilities: [...new Set([...this.manifests.values()].flatMap((manifest) => manifest.capabilities))].sort()
    };
  }
}

function structuredCloneSerializable(value) {
  return JSON.parse(JSON.stringify(value));
}
