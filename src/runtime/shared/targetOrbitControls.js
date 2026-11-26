// Target-Anchored Spherical OrbitControls (`src/runtime/shared/targetOrbitControls.js`)
//
// Zero-dependency, Three.js-OrbitControls-compatible camera controller for ULG's
// direct-WebGPU flagship labs (Organic Chemistry, Emergent Biology, Material Physics).
//
// Features:
//   - Strictly anchored to a 3D `target = [tx, ty, tz]` pivot point.
//   - Smooth damped spherical orbit (`yaw`, `pitch`, `dist`) with inertia (`update(dt)`).
//   - Natural Three.js-matched drag direction (object turns under your cursor!).
//   - Right-drag / Middle-drag / Shift+Left-drag screen-space target panning (optional).
//   - Logarithmic wheel dolly-to-target & multi-touch 1-finger orbit / 2-finger pinch + pan.
//   - Clean click/tap discrimination (`onClick`) for GPU entity picking without drag misfires.
//   - Double-click or `reset()` smoothly returns to the anchored default target & framing.

import { normalizeWheelDeltaY } from './webgpuCompat.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createTargetOrbitControls(domElement, {
  yaw = 0.45,
  pitch = 0.28,
  dist = 10.0,
  target = [0, 0, 0],
  minDist = 1.5,
  maxDist = 48.0,
  minPitch = -1.42,
  maxPitch = 1.42,
  rotateSpeed = 0.0068,
  zoomSpeed = 0.11,
  panSpeed = 0.0016,
  dampingFactor = 0.18,
  enableDamping = true,
  enablePan = true,
  enableZoom = true,
  enableRotate = true,
  invertYaw = false,
  shouldIgnorePointer = null,
  onClick = null,
  onChange = null
} = {}) {
  let disposed = false;

  const state = {
    yaw,
    pitch: clamp(pitch, minPitch, maxPitch),
    dist: clamp(dist, minDist, maxDist),
    target: [target[0] || 0, target[1] || 0, target[2] || 0]
  };
  const desired = {
    yaw: state.yaw,
    pitch: state.pitch,
    dist: state.dist,
    target: [...state.target]
  };
  const home = {
    yaw: state.yaw,
    pitch: state.pitch,
    dist: state.dist,
    target: [...state.target]
  };

  const pointers = new Map();
  let mode = 'none'; // 'rotate' | 'pan' | 'pinch'
  let downInfo = null;
  let lastSingleX = 0;
  let lastSingleY = 0;
  let lastPinchDist = 0;
  let lastPinchMidX = 0;
  let lastPinchMidY = 0;
  let lastCleanTap = null;

  function emitChange() {
    onChange?.({
      yaw: state.yaw,
      pitch: state.pitch,
      dist: state.dist,
      target: [state.target[0], state.target[1], state.target[2]]
    });
  }

  function panByPixels(dx, dy) {
    if (!enablePan) return;
    // Compute orthonormal screen-space right & up vectors from current spherical orientation
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const sy = Math.sin(state.yaw);
    const cy = Math.cos(state.yaw);
    // Forward from eye toward target = (-cp*sy, -sp, -cp*cy)
    // Right = normalize(cross(forward, worldUp(0,1,0))) = (cy, 0, -sy)
    const rx = cy;
    const rz = -sy;
    // Camera up = cross(right, forward) = (-sp*sy, cp, -sp*cy)
    const ux = -sp * sy;
    const uy = cp;
    const uz = -sp * cy;
    const scale = state.dist * panSpeed;
    desired.target[0] += (-dx * rx + dy * ux) * scale;
    desired.target[1] += (dy * uy) * scale;
    desired.target[2] += (-dx * rz + dy * uz) * scale;
    if (!enableDamping) {
      state.target[0] = desired.target[0];
      state.target[1] = desired.target[1];
      state.target[2] = desired.target[2];
      emitChange();
    }
  }

  function rotateByPixels(dx, dy, pointerType = 'mouse') {
    if (!enableRotate) return;
    const sens = pointerType === 'touch' ? rotateSpeed * 1.25 : rotateSpeed;
    const yawSign = invertYaw ? 1 : -1;
    desired.yaw += yawSign * dx * sens;
    desired.pitch = clamp(desired.pitch + dy * sens, minPitch, maxPitch);
    if (!enableDamping) {
      state.yaw = desired.yaw;
      state.pitch = desired.pitch;
      emitChange();
    }
  }

  function dollyByFactor(factor) {
    if (!enableZoom) return;
    desired.dist = clamp(desired.dist * factor, minDist, maxDist);
    if (!enableDamping) {
      state.dist = desired.dist;
      emitChange();
    }
  }

  function getTwoPointerStats() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return null;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return {
      dist: Math.hypot(dx, dy),
      midX: 0.5 * (pts[0].x + pts[1].x),
      midY: 0.5 * (pts[0].y + pts[1].y)
    };
  }

  const onContextMenu = (e) => {
    if (enablePan && !(shouldIgnorePointer?.(e))) {
      e.preventDefault();
    }
  };

  const onPointerDown = (e) => {
    if (disposed || shouldIgnorePointer?.(e)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    try { domElement.setPointerCapture?.(e.pointerId); } catch {}

    if (pointers.size === 1) {
      const wantsPan = enablePan && (e.button === 2 || e.button === 1 || e.shiftKey);
      mode = wantsPan ? 'pan' : 'rotate';
      lastSingleX = e.clientX;
      lastSingleY = e.clientY;
      downInfo = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        button: e.button,
        shiftKey: e.shiftKey,
        pointerType: e.pointerType,
        moved: false,
        t: performance.now()
      };
    } else if (pointers.size >= 2) {
      mode = 'pinch';
      downInfo = null;
      const stats = getTwoPointerStats();
      if (stats) {
        lastPinchDist = stats.dist;
        lastPinchMidX = stats.midX;
        lastPinchMidY = stats.midY;
      }
    }
  };

  const onPointerMove = (e) => {
    if (disposed || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (downInfo && downInfo.id === e.pointerId) {
      if (Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y) > 6) {
        downInfo.moved = true;
      }
    }

    if (pointers.size >= 2) {
      const stats = getTwoPointerStats();
      if (stats && lastPinchDist > 4 && stats.dist > 4) {
        dollyByFactor(lastPinchDist / stats.dist);
        panByPixels(stats.midX - lastPinchMidX, stats.midY - lastPinchMidY);
      }
      if (stats) {
        lastPinchDist = stats.dist;
        lastPinchMidX = stats.midX;
        lastPinchMidY = stats.midY;
      }
      return;
    }

    const dx = e.clientX - lastSingleX;
    const dy = e.clientY - lastSingleY;
    lastSingleX = e.clientX;
    lastSingleY = e.clientY;
    if (mode === 'pan') {
      panByPixels(dx, dy);
    } else if (mode === 'rotate') {
      rotateByPixels(dx, dy, e.pointerType);
    }
  };

  const onPointerUpOrCancel = (e) => {
    const wasCleanClick = Boolean(
      downInfo
      && downInfo.id === e.pointerId
      && !downInfo.moved
      && downInfo.button === 0
      && !downInfo.shiftKey
      && pointers.size === 1
      && (performance.now() - downInfo.t) < 320
    );
    const clickType = downInfo?.pointerType || e.pointerType;
    pointers.delete(e.pointerId);
    try { domElement.releasePointerCapture?.(e.pointerId); } catch {}

    if (pointers.size === 1) {
      const rem = [...pointers.values()][0];
      lastSingleX = rem.x;
      lastSingleY = rem.y;
      mode = 'rotate';
      lastPinchDist = 0;
    } else {
      mode = 'none';
      lastPinchDist = 0;
      downInfo = null;
      if (wasCleanClick) {
        if (clickType === 'touch') {
          const now = performance.now();
          if (lastCleanTap && (now - lastCleanTap.t) < 300 && Math.hypot(e.clientX - lastCleanTap.x, e.clientY - lastCleanTap.y) < 32) {
            lastCleanTap = null;
            reset();
            return;
          }
          lastCleanTap = { x: e.clientX, y: e.clientY, t: now };
        }
        onClick?.(e.clientX, e.clientY, e);
      }
    }
  };

  const onWheel = (e) => {
    if (disposed || !enableZoom || shouldIgnorePointer?.(e)) return;
    e.preventDefault();
    const dy = normalizeWheelDeltaY(e);
    const norm = clamp(dy / 120, -2.5, 2.5);
    const factor = Math.pow(1 + zoomSpeed, norm);
    dollyByFactor(factor);
  };

  // Safari macOS native trackpad pinch gestures fire non-standard `gesturestart`/`gesturechange`
  let lastGestureScale = 1.0;
  const onGestureStart = (e) => {
    if (disposed || !enableZoom || shouldIgnorePointer?.(e)) return;
    e.preventDefault();
    lastGestureScale = Number(e.scale) || 1.0;
  };
  const onGestureChange = (e) => {
    if (disposed || !enableZoom || shouldIgnorePointer?.(e)) return;
    e.preventDefault();
    const nextScale = Number(e.scale) || 1.0;
    if (nextScale > 0.05 && lastGestureScale > 0.05) {
      dollyByFactor(lastGestureScale / nextScale);
    }
    lastGestureScale = nextScale;
  };

  const onDblClick = (e) => {
    if (disposed || shouldIgnorePointer?.(e)) return;
    reset();
  };

  domElement.addEventListener('contextmenu', onContextMenu);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUpOrCancel);
  domElement.addEventListener('pointercancel', onPointerUpOrCancel);
  domElement.addEventListener('wheel', onWheel, { passive: false });
  domElement.addEventListener('gesturestart', onGestureStart, { passive: false });
  domElement.addEventListener('gesturechange', onGestureChange, { passive: false });
  domElement.addEventListener('dblclick', onDblClick);

  function update(dtSec = 1 / 60) {
    if (disposed) return false;
    const alpha = enableDamping
      ? (1.0 - Math.pow(Math.max(0.01, 1.0 - dampingFactor), Math.max(0.25, dtSec * 60)))
      : 1.0;

    const dYaw = desired.yaw - state.yaw;
    const dPitch = desired.pitch - state.pitch;
    const dDist = desired.dist - state.dist;
    const dTx = desired.target[0] - state.target[0];
    const dTy = desired.target[1] - state.target[1];
    const dTz = desired.target[2] - state.target[2];

    const moved = Math.abs(dYaw) + Math.abs(dPitch) + Math.abs(dDist) + Math.abs(dTx) + Math.abs(dTy) + Math.abs(dTz) > 1e-5;
    if (!moved) return false;

    state.yaw += dYaw * alpha;
    state.pitch += dPitch * alpha;
    state.dist += dDist * alpha;
    state.target[0] += dTx * alpha;
    state.target[1] += dTy * alpha;
    state.target[2] += dTz * alpha;
    emitChange();
    return true;
  }

  function setPose(patch = {}, { immediate = true, updateHome = false } = {}) {
    if (Number.isFinite(patch.yaw)) desired.yaw = patch.yaw;
    if (Number.isFinite(patch.pitch)) desired.pitch = clamp(patch.pitch, minPitch, maxPitch);
    if (Number.isFinite(patch.dist)) desired.dist = clamp(patch.dist, minDist, maxDist);
    if (Array.isArray(patch.target) && patch.target.length === 3) {
      desired.target = [patch.target[0], patch.target[1], patch.target[2]];
    }
    if (updateHome) {
      home.yaw = desired.yaw;
      home.pitch = desired.pitch;
      home.dist = desired.dist;
      home.target = [...desired.target];
    }
    if (immediate) {
      state.yaw = desired.yaw;
      state.pitch = desired.pitch;
      state.dist = desired.dist;
      state.target = [...desired.target];
      emitChange();
    }
  }

  function focusTarget(nextTarget, nextDist = null, { immediate = false } = {}) {
    setPose(
      {
        target: nextTarget,
        ...(Number.isFinite(nextDist) ? { dist: nextDist } : {})
      },
      { immediate, updateHome: false }
    );
  }

  function reset({ immediate = !enableDamping } = {}) {
    setPose(home, { immediate, updateHome: false });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    domElement.removeEventListener('contextmenu', onContextMenu);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUpOrCancel);
    domElement.removeEventListener('pointercancel', onPointerUpOrCancel);
    domElement.removeEventListener('wheel', onWheel);
    domElement.removeEventListener('gesturestart', onGestureStart);
    domElement.removeEventListener('gesturechange', onGestureChange);
    domElement.removeEventListener('dblclick', onDblClick);
  }

  return Object.freeze({
    get state() {
      return {
        yaw: state.yaw,
        pitch: state.pitch,
        dist: state.dist,
        target: [state.target[0], state.target[1], state.target[2]]
      };
    },
    setPose,
    focusTarget,
    reset,
    update,
    dispose
  });
}
