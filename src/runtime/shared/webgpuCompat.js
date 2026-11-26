// Cross-Browser WebGPU Compatibility Helpers (`src/runtime/shared/webgpuCompat.js`)
//
// Ensures consistent, zero-overhead WebGPU bootstrap and input normalization across
// Linux/Windows Chrome (Vulkan/D3D12), macOS Chrome (Metal/Dawn), and macOS Safari
// (WebKit WebGPU/Metal) without sacrificing GPU performance or functionality:
//   - Retries `requestAdapter({ powerPreference: 'high-performance' })` and cleanly
//     falls back to `requestAdapter()` (no options) when Apple Silicon / Safari /
//     dual-GPU macOS rejects or returns null for a discrete power preference.
//   - Clamps optional limit requests to `adapter.limits` and retries default
//     `requestDevice()` if an unsupported limit/feature causes rejection.
//   - Configures WebGPU canvas swapchains safely across `opaque` / `premultiplied`
//     and `COPY_SRC` support differences between Dawn and Safari WebKit.
//   - Normalizes macOS trackpad pinch-to-zoom (`ctrlKey` wheel events) and Firefox/
//     macOS `deltaMode` line/page wheel steps identically across browsers.

export async function requestCompatibleWebGpuDevice({
  label = 'ulg-webgpu',
  retries = 6,
  retryDelayMs = 200,
  requiredFeatures = [],
  optionalLimits = null,
  xrCompatible = false
} = {}) {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    throw new Error(
      'WebGPU is unavailable in this browser. Use Chrome 121+, Edge 121+, or Safari 18+/26+ with WebGPU enabled over HTTPS.'
    );
  }

  let adapter = null;
  for (let attempt = 0; attempt < retries && !adapter; attempt += 1) {
    // Try xrCompatible + high-performance when requested for WebXR WebGPU (`XRGPUBinding`),
    // then high-performance, then plain `requestAdapter()` (Apple Silicon / Safari fallback).
    if (xrCompatible && typeof navigator.xr !== 'undefined') {
      try {
        adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance', xrCompatible: true });
      } catch {
        adapter = null;
      }
      if (!adapter) {
        try {
          adapter = await navigator.gpu.requestAdapter({ xrCompatible: true });
        } catch {
          adapter = null;
        }
      }
    }
    if (!adapter) {
      try {
        adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      } catch {
        adapter = null;
      }
    }
    if (!adapter) {
      try {
        adapter = await navigator.gpu.requestAdapter();
      } catch {
        adapter = null;
      }
    }
    if (!adapter && attempt + 1 < retries) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  if (!adapter) {
    throw new Error(`No compatible WebGPU GPUAdapter available (${label}).`);
  }

  const descriptor = { label };
  if (Array.isArray(requiredFeatures) && requiredFeatures.length > 0 && adapter.features) {
    const supported = requiredFeatures.filter((f) => adapter.features.has(f));
    if (supported.length > 0) descriptor.requiredFeatures = supported;
  }
  if (optionalLimits && typeof optionalLimits === 'object' && adapter.limits) {
    const clamped = {};
    for (const [key, desired] of Object.entries(optionalLimits)) {
      const avail = Number(adapter.limits[key]);
      const want = Number(desired);
      if (Number.isFinite(avail) && Number.isFinite(want) && want > 0) {
        clamped[key] = Math.min(avail, want);
      }
    }
    if (Object.keys(clamped).length > 0) descriptor.requiredLimits = clamped;
  }

  let device = null;
  try {
    device = await adapter.requestDevice(descriptor);
  } catch {
    device = await adapter.requestDevice();
  }
  return { adapter, device };
}

export function configureCompatibleWebGpuCanvas(ctx, device, { preferCopySrc = false } = {}) {
  if (!ctx) throw new Error('WebGPU canvas context unavailable');
  const format = typeof navigator !== 'undefined' && navigator.gpu?.getPreferredCanvasFormat
    ? navigator.gpu.getPreferredCanvasFormat()
    : 'bgra8unorm';
  const RENDER_ATTACHMENT = 0x10;
  const COPY_SRC = 0x01;
  const candidates = [];
  if (preferCopySrc) {
    candidates.push({ device, format, alphaMode: 'opaque', usage: RENDER_ATTACHMENT | COPY_SRC });
    candidates.push({ device, format, alphaMode: 'premultiplied', usage: RENDER_ATTACHMENT | COPY_SRC });
  }
  candidates.push({ device, format, alphaMode: 'opaque' });
  candidates.push({ device, format, alphaMode: 'premultiplied' });

  let lastErr = null;
  for (const cfg of candidates) {
    try {
      ctx.configure(cfg);
      return { format, alphaMode: cfg.alphaMode };
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return { format, alphaMode: 'opaque' };
}

/**
 * Normalize mouse-wheel & macOS trackpad pinch (`ctrlKey`) deltas into consistent
 * pixel-equivalent units across Chrome, Safari, and Firefox on Linux/macOS/Windows.
 */
export function normalizeWheelDeltaY(e) {
  let dy = Number(e?.deltaY) || 0;
  if (e?.deltaMode === 1) dy *= 16.0;       // DOM_DELTA_LINE
  else if (e?.deltaMode === 2) dy *= 240.0; // DOM_DELTA_PAGE
  // macOS Chrome & Safari emit fine-grained wheel events with `ctrlKey: true` on trackpad pinch!
  if (e?.ctrlKey) dy *= 3.2;
  return dy;
}
