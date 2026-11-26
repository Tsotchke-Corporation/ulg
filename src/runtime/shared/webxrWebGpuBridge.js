// Native WebXR + WebGPU (`XRGPUBinding`) Bridge with Stereo Fallback (`src/runtime/shared/webxrWebGpuBridge.js`)
//
// Supports:
//   1. True native WebXR WebGPU (`navigator.xr` + `XRGPUBinding.createProjectionLayer`)
//      when exposed by Chrome/Edge/Meta Quest Browser with WebGPU WebXR bindings enabled.
//   2. Built-in Side-by-Side Stereo VR Preview fallback (exact interpupillary offset IPD = 64 mm)
//      so users on desktop/mobile/headsets without experimental `XRGPUBinding` flags can still
//      enter stereo cockpit view with zero crashes and clear diagnostic telemetry.

export async function probeWebXrWebGpuSupport() {
  const hasXr = typeof navigator !== 'undefined' && Boolean(navigator.xr);
  const hasGpuBinding = typeof globalThis.XRGPUBinding === 'function';
  let immersiveVr = false;
  if (hasXr && typeof navigator.xr.isSessionSupported === 'function') {
    try {
      immersiveVr = await navigator.xr.isSessionSupported('immersive-vr');
    } catch {
      immersiveVr = false;
    }
  }
  return {
    hasNavigatorXr: hasXr,
    hasXrGpuBinding: hasGpuBinding,
    immersiveVrSupported: immersiveVr,
    nativeWebGpuXrReady: Boolean(hasXr && hasGpuBinding && immersiveVr)
  };
}

export function createWebXrWebGpuBridge(device, { onStateChange = null } = {}) {
  let xrSession = null;
  let xrRefSpace = null;
  let xrBinding = null;
  let xrLayer = null;
  let stereoPreviewActive = false;
  let statusText = 'Desktop 3D';
  let capabilities = {
    hasNavigatorXr: typeof navigator !== 'undefined' && Boolean(navigator.xr),
    hasXrGpuBinding: typeof globalThis.XRGPUBinding === 'function',
    immersiveVrSupported: false,
    nativeWebGpuXrReady: false
  };

  const emitState = () => {
    if (typeof onStateChange === 'function') {
      onStateChange(getState());
    }
  };

  void probeWebXrWebGpuSupport().then((caps) => {
    capabilities = caps;
    emitState();
  });

  function getState() {
    return {
      ...capabilities,
      active: Boolean(xrSession) || stereoPreviewActive,
      mode: xrSession ? 'webxr-native' : (stereoPreviewActive ? 'stereo-sbs' : 'flat'),
      statusText
    };
  }

  async function enterXr(onXrFrame) {
    const caps = await probeWebXrWebGpuSupport();
    capabilities = caps;

    if (caps.nativeWebGpuXrReady && typeof onXrFrame === 'function') {
      try {
        xrSession = await navigator.xr.requestSession('immersive-vr', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['webgpu', 'hand-tracking']
        });
        xrBinding = new globalThis.XRGPUBinding(xrSession, device);
        xrLayer = xrBinding.createProjectionLayer({
          colorFormat: navigator.gpu.getPreferredCanvasFormat(),
          depthStencilFormat: 'depth24plus'
        });
        await xrSession.updateRenderState({ layers: [xrLayer] });
        xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
        statusText = 'WebXR WebGPU Live';
        stereoPreviewActive = false;
        xrSession.addEventListener('end', () => {
          xrSession = null;
          xrRefSpace = null;
          xrBinding = null;
          xrLayer = null;
          statusText = 'Desktop 3D';
          emitState();
        });
        const tickXr = (time, frame) => {
          if (!xrSession) return;
          const pose = frame.getViewerPose(xrRefSpace);
          if (pose && xrBinding && xrLayer) {
            const eyeViews = [];
            for (const view of pose.views) {
              const subImg = xrBinding.getViewSubImage(xrLayer, view);
              eyeViews.push({
                eye: view.eye,
                projectionMatrix: view.projectionMatrix,
                transform: view.transform,
                colorView: subImg.colorTexture.createView({
                  baseArrayLayer: subImg.imageIndex || 0,
                  arrayLayerCount: 1
                }),
                depthView: subImg.depthStencilTexture
                  ? subImg.depthStencilTexture.createView({
                    baseArrayLayer: subImg.imageIndex || 0,
                    arrayLayerCount: 1
                  })
                  : null,
                viewport: subImg.viewport
              });
            }
            onXrFrame(time, eyeViews, pose);
          }
          xrSession.requestAnimationFrame(tickXr);
        };
        xrSession.requestAnimationFrame(tickXr);
        emitState();
        return getState();
      } catch (err) {
        xrSession = null;
        xrBinding = null;
        xrLayer = null;
        statusText = `Stereo VR (${String(err?.message || 'XRGPUBinding fallback').slice(0, 36)})`;
        stereoPreviewActive = true;
        emitState();
        return getState();
      }
    }

    // Toggle clean Side-by-Side Stereo VR Cockpit Preview when native XRGPUBinding isn't active
    stereoPreviewActive = !stereoPreviewActive;
    statusText = stereoPreviewActive
      ? (caps.hasNavigatorXr && !caps.hasXrGpuBinding
        ? 'Stereo SBS VR (enable #webxr-incubations for native XRGPUBinding)'
        : 'Stereo SBS VR Preview')
      : 'Desktop 3D';
    emitState();
    return getState();
  }

  async function exitXr() {
    stereoPreviewActive = false;
    if (xrSession) {
      try { await xrSession.end(); } catch {}
      xrSession = null;
      xrRefSpace = null;
      xrBinding = null;
      xrLayer = null;
    }
    statusText = 'Desktop 3D';
    emitState();
    return getState();
  }

  async function toggleXr(onXrFrame) {
    if (xrSession || stereoPreviewActive) return exitXr();
    return enterXr(onXrFrame);
  }

  return Object.freeze({
    getState,
    enterXr,
    exitXr,
    toggleXr,
    get isStereoPreview() { return stereoPreviewActive; },
    get isNativeXr() { return Boolean(xrSession); }
  });
}
