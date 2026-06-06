import { createId } from './ids.js';

export class ChildWorkerLeaseManager {
  constructor() {
    this.leases = new Map();
  }

  async request(parentWorkerId, spec) {
    const existingCount = [...this.leases.values()]
      .filter((lease) => lease.parentWorkerId === parentWorkerId && lease.status === 'active')
      .reduce((total, lease) => total + lease.count, 0);
    const requestedCount = spec.count ?? 1;
    const workerType = spec.workerType ?? 'module';

    if (!spec.allowed) {
      throw new Error(`Child workers are not allowed for ${parentWorkerId}`);
    }
    if (!spec.allowedModules?.includes(spec.module)) {
      throw new Error(`Module is not lease-approved: ${spec.module}`);
    }
    if (!['classic', 'module'].includes(workerType)) {
      throw new Error(`Unsupported child worker type: ${workerType}`);
    }
    if (existingCount + requestedCount > spec.maxChildren) {
      throw new Error(`Child worker quota exceeded for ${parentWorkerId}`);
    }

    const lease = {
      leaseId: createId('lease'),
      parentWorkerId,
      rootTaskId: spec.rootTaskId,
      module: spec.module,
      workerType,
      count: requestedCount,
      createdAt: Date.now(),
      expiresAt: spec.expiresAt ?? Date.now() + 30_000,
      resources: spec.resources ?? {},
      status: 'active'
    };
    this.leases.set(lease.leaseId, lease);
    return lease;
  }

  async release(leaseId) {
    const lease = this.leases.get(leaseId);
    if (lease) {
      lease.status = 'released';
      lease.releasedAt = Date.now();
    }
  }

  async revokeByRootTask(rootTaskId) {
    for (const lease of this.leases.values()) {
      if (lease.rootTaskId === rootTaskId && lease.status === 'active') {
        lease.status = 'revoked';
        lease.revokedAt = Date.now();
      }
    }
  }

  list() {
    return [...this.leases.values()].map((lease) => ({ ...lease }));
  }
}
