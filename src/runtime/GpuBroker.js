import { createId } from './ids.js';

const PRIORITY_ORDER = ['render', 'interactive', 'simulation', 'background', 'validation'];

export class GpuBroker {
  constructor({ navigatorRef = globalThis.navigator } = {}) {
    this.navigatorRef = navigatorRef;
    this.capabilities = {
      supported: false,
      adapter: null,
      fallback: 'wasm-cpu',
      reason: 'not-probed'
    };
    this.leases = new Map();
  }

  async probe() {
    if (!this.navigatorRef?.gpu) {
      this.capabilities = {
        supported: false,
        adapter: null,
        fallback: 'wasm-cpu',
        reason: 'navigator.gpu unavailable'
      };
      return this.capabilities;
    }

    const adapter = await this.navigatorRef.gpu.requestAdapter();
    this.capabilities = {
      supported: Boolean(adapter),
      adapter: adapter ? {
        features: adapter.features ? [...adapter.features] : [],
        limits: adapter.limits ? { ...adapter.limits } : {}
      } : null,
      fallback: adapter ? null : 'wasm-cpu',
      reason: adapter ? 'available' : 'requestAdapter returned null'
    };
    return this.capabilities;
  }

  async requestLease(spec) {
    if (spec.gpu === 'required' && !this.capabilities.supported) {
      throw new Error(`Required GPU lease unavailable: ${this.capabilities.reason}`);
    }
    const lease = {
      leaseId: createId('gpu'),
      status: this.capabilities.supported ? 'granted' : 'fallback',
      priority: spec.priority,
      priorityRank: PRIORITY_ORDER.indexOf(spec.priority),
      gpuMemoryBytes: spec.gpuMemoryBytes ?? 0,
      rootTaskId: spec.rootTaskId,
      createdAt: Date.now()
    };
    this.leases.set(lease.leaseId, lease);
    return lease;
  }

  async releaseLease(leaseId) {
    const lease = this.leases.get(leaseId);
    if (lease) {
      lease.status = 'released';
      lease.releasedAt = Date.now();
    }
  }

  reportPressure() {
    const active = [...this.leases.values()].filter((lease) => lease.status === 'granted');
    return {
      supported: this.capabilities.supported,
      activeLeases: active.length,
      estimatedBytes: active.reduce((total, lease) => total + lease.gpuMemoryBytes, 0),
      fallback: this.capabilities.fallback,
      reason: this.capabilities.reason
    };
  }
}
