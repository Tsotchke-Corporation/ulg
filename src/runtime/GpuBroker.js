import { createId } from './ids.js';
import { webGpuDeviceDescriptorForResidentSph } from './webgpuDeviceLimits.js';

const PRIORITY_ORDER = ['render', 'interactive', 'simulation', 'background', 'validation'];

export class GpuBroker {
  constructor({ navigatorRef = globalThis.navigator } = {}) {
    this.navigatorRef = navigatorRef;
    this.capabilities = {
      supported: false,
      adapter: null,
      fallback: 'wasm-cpu',
      reason: 'not-probed',
      deviceStatus: 'unavailable'
    };
    this.leases = new Map();
    this.adapterHandle = null;
    this.device = null;
    this.deviceLost = null;
  }

  async probe() {
    if (!this.navigatorRef?.gpu) {
      this.adapterHandle = null;
      this.device = null;
      this.capabilities = {
        supported: false,
        adapter: null,
        fallback: 'wasm-cpu',
        reason: 'navigator.gpu unavailable',
        deviceStatus: 'unavailable'
      };
      return this.capabilities;
    }

    const adapter = await this.navigatorRef.gpu.requestAdapter();
    this.adapterHandle = adapter || null;
    this.device = null;
    this.capabilities = {
      supported: Boolean(adapter),
      adapter: adapter ? {
        features: adapter.features ? [...adapter.features] : [],
        limits: adapter.limits ? { ...adapter.limits } : {}
      } : null,
      fallback: adapter ? null : 'wasm-cpu',
      reason: adapter ? 'available' : 'requestAdapter returned null',
      deviceStatus: adapter ? 'adapter-ready' : 'unavailable'
    };
    return this.capabilities;
  }

  async getDevice({ required = false, profilingRequested = false } = {}) {
    if (this.device && this.capabilities.deviceStatus === 'ready') {
      const timestampQueryEnabled = Boolean(this.device.features?.has?.('timestamp-query'));
      this.capabilities = {
        ...this.capabilities,
        profilingRequested: Boolean(profilingRequested),
        timestampQueryEnabled,
        timestampQueryStatus: profilingRequested
          ? (timestampQueryEnabled ? 'enabled' : 'unavailable-on-existing-device')
          : (timestampQueryEnabled ? 'enabled-not-requested' : 'not-requested')
      };
      return this.device;
    }
    if (!this.capabilities.supported || !this.adapterHandle) {
      if (required) {
        throw new Error(`Required GPU device unavailable: ${this.capabilities.reason}`);
      }
      return null;
    }
    try {
      const deviceDescriptor = webGpuDeviceDescriptorForResidentSph(this.adapterHandle, {
        profilingRequested
      });
      const device = await this.adapterHandle.requestDevice(deviceDescriptor);
      this.device = device;
      this.capabilities = {
        ...this.capabilities,
        deviceStatus: 'ready',
        fallback: null,
        reason: 'device acquired',
        requiredLimits: deviceDescriptor?.requiredLimits || {},
        requiredFeatures: deviceDescriptor?.requiredFeatures || [],
        profilingRequested: Boolean(profilingRequested),
        timestampQueryEnabled: Boolean(device.features?.has?.('timestamp-query')),
        timestampQueryStatus: profilingRequested
          ? (device.features?.has?.('timestamp-query') ? 'enabled' : 'unsupported')
          : 'not-requested'
      };
      if (device?.lost?.then) {
        device.lost.then((info) => this.markDeviceLost(info)).catch((error) => this.markDeviceLost(error));
      }
      return device;
    } catch (error) {
      this.device = null;
      this.capabilities = {
        ...this.capabilities,
        supported: false,
        fallback: 'wasm-cpu',
        reason: error instanceof Error ? error.message : String(error),
        deviceStatus: 'device-request-failed'
      };
      if (required) {
        throw error;
      }
      return null;
    }
  }

  markDeviceLost(info = {}) {
    const reason = info?.reason || info?.message || String(info || 'device-lost');
    this.deviceLost = {
      reason,
      at: Date.now()
    };
    this.device = null;
    this.capabilities = {
      ...this.capabilities,
      supported: false,
      fallback: 'wasm-cpu',
      reason: `device lost: ${reason}`,
      deviceStatus: 'lost'
    };
    for (const lease of this.leases.values()) {
      if (lease.status === 'granted') {
        lease.status = 'device-lost';
        lease.deviceLostReason = reason;
        lease.retryableOnCpu = true;
      }
    }
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
      createdAt: Date.now(),
      deviceStatus: this.capabilities.deviceStatus
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
      reason: this.capabilities.reason,
      deviceStatus: this.capabilities.deviceStatus,
      deviceLost: this.deviceLost
    };
  }
}
