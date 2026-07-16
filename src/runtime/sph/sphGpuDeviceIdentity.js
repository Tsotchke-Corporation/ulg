const BUFFER_DEVICE = new WeakMap();
const HANDLE_DEVICE = new WeakMap();
const DEVICE_TOKEN = Symbol.for('peercompute.ulg.webgpu.device');
const DEVICE_ID_TOKEN = Symbol.for('peercompute.ulg.webgpu.deviceId');
const DEVICE_TOKEN_KEY = '__peercomputeUlgWebGpuDevice';
const DEVICE_ID_TOKEN_KEY = '__peercomputeUlgWebGpuDeviceId';

let nextDeviceId = 1;

function isObject(value) {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function assignHidden(target, key, value) {
  if (!isObject(target)) return;
  try {
    Object.defineProperty(target, key, {
      value,
      configurable: true
    });
  } catch {
    // Some host WebGPU objects may be non-extensible. The WeakMaps still carry
    // identity while the object remains live.
  }
}

export function webGpuDeviceId(device) {
  if (!isObject(device)) return null;
  if (device[DEVICE_ID_TOKEN]) return device[DEVICE_ID_TOKEN];
  if (device[DEVICE_ID_TOKEN_KEY]) return device[DEVICE_ID_TOKEN_KEY];
  const id = `ulg-webgpu-device:${nextDeviceId}`;
  nextDeviceId += 1;
  assignHidden(device, DEVICE_ID_TOKEN, id);
  assignHidden(device, DEVICE_ID_TOKEN_KEY, id);
  return id;
}

export function tagWebGpuBufferDevice(buffer, device) {
  if (!isObject(buffer) || !isObject(device)) return buffer;
  const existingDevice = BUFFER_DEVICE.get(buffer)
    || buffer[DEVICE_TOKEN]
    || buffer[DEVICE_TOKEN_KEY]
    || null;
  // Device ownership is provenance, not mutable metadata. Re-labeling an
  // existing GPUBuffer would hide an illegal cross-device bind.
  if (existingDevice && existingDevice !== device) return buffer;
  BUFFER_DEVICE.set(buffer, device);
  assignHidden(buffer, DEVICE_TOKEN, device);
  assignHidden(buffer, DEVICE_TOKEN_KEY, device);
  assignHidden(buffer, DEVICE_ID_TOKEN, webGpuDeviceId(device));
  assignHidden(buffer, DEVICE_ID_TOKEN_KEY, webGpuDeviceId(device));
  return buffer;
}

export function tagResidentProductMassDevice(handle, device) {
  if (!isObject(handle) || !isObject(device)) return handle;
  const existingDevice = HANDLE_DEVICE.get(handle)
    || handle[DEVICE_TOKEN]
    || handle[DEVICE_TOKEN_KEY]
    || handle.productEventDevice
    || webGpuBufferDevice(handle.productEventBuffer)
    || null;
  if (existingDevice && existingDevice !== device) return handle;
  HANDLE_DEVICE.set(handle, device);
  assignHidden(handle, DEVICE_TOKEN, device);
  assignHidden(handle, DEVICE_TOKEN_KEY, device);
  assignHidden(handle, DEVICE_ID_TOKEN, webGpuDeviceId(device));
  assignHidden(handle, DEVICE_ID_TOKEN_KEY, webGpuDeviceId(device));
  assignHidden(handle, 'productEventDevice', device);
  tagWebGpuBufferDevice(handle.productEventBuffer, device);
  return handle;
}

export function webGpuBufferDevice(buffer) {
  if (!isObject(buffer)) return null;
  return BUFFER_DEVICE.get(buffer) || buffer[DEVICE_TOKEN] || buffer[DEVICE_TOKEN_KEY] || null;
}

export function residentProductMassDevice(handle) {
  if (!isObject(handle)) return null;
  return HANDLE_DEVICE.get(handle)
    || handle[DEVICE_TOKEN]
    || handle[DEVICE_TOKEN_KEY]
    || handle.productEventDevice
    || webGpuBufferDevice(handle.productEventBuffer);
}

export function webGpuBufferMatchesDevice(buffer, device) {
  if (!isObject(buffer) || !isObject(device)) return true;
  const owner = webGpuBufferDevice(buffer);
  return !owner || owner === device;
}

export function residentProductMassMatchesDevice(handle, device) {
  if (!isObject(handle) || !isObject(device)) return true;
  const owner = residentProductMassDevice(handle);
  return !owner || owner === device;
}

export function webGpuDeviceMismatchInfo({ buffer = null, residentProductMass = null, device = null } = {}) {
  const owner = residentProductMassDevice(residentProductMass) || webGpuBufferDevice(buffer);
  if (!owner || !device || owner === device) {
    return {
      mismatch: false,
      sourceDeviceId: owner ? webGpuDeviceId(owner) : null,
      consumerDeviceId: device ? webGpuDeviceId(device) : null
    };
  }
  return {
    mismatch: true,
    sourceDeviceId: webGpuDeviceId(owner),
    consumerDeviceId: webGpuDeviceId(device)
  };
}

export function typedArrayContentFingerprint(value) {
  if (!ArrayBuffer.isView(value)) return 'not-a-typed-array';
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (const byte of bytes) {
    hashA = Math.imul(hashA ^ byte, 0x01000193) >>> 0;
    hashB = Math.imul(hashB ^ (byte + 0x9d), 0x85ebca6b) >>> 0;
  }
  const fingerprint = [
    value.constructor?.name || 'TypedArray',
    value.byteLength,
    hashA.toString(16).padStart(8, '0'),
    hashB.toString(16).padStart(8, '0')
  ].join(':');
  return fingerprint;
}
