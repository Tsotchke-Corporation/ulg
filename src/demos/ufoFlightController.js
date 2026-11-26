// Global 6-DOF Quaternion UFO Free-Flight Controller + Scale-Adaptive Regimes + Xbox Gamepad
// (`src/demos/ufoFlightController.js`).
//
// Features:
//   - Exact unit-quaternion orientation `q = [qx, qy, qz, qw]`: full 360-degree pitch (X),
//     yaw (Y), and roll (Z) in ANY direction with ZERO gimbal lock!
//   - Scale-adaptive interstellar / planetary / intergalactic / subatomic motion regimes
//     with live physical velocity telemetry (`m/s`, `km/s`, `AU/hr`, `c`, `ly/s`, `Mpc/s`, `nm/s`).
//   - Wide chase camera zoom-out (`chaseDistMul in [0.55 .. 45.0]`) so the saucer can be
//     inspected close-up or zoomed waaaay out against the cosmos!
//   - Native HTML5 Standard Xbox Gamepad mapping (sticks, bumpers roll, triggers warp/brake,
//     A/B vertical, X fire, Y tractor, D-Pad chase zoom + 40-OOM scale, View/Menu toggles).

export const UFO_FLIGHT_CONTROLLER_SCHEMA = 'ulg.universes.ufo-flight-controller.v1';

export const UFO_CHASE_ZOOM_MIN = 0.55;
export const UFO_CHASE_ZOOM_MAX = 45.0;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function quatNormalize(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function quatMul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

export function quatFromAxisAngle(axis, rad) {
  const half = rad * 0.5;
  const s = Math.sin(half);
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  return [
    (axis[0] / len) * s,
    (axis[1] / len) * s,
    (axis[2] / len) * s,
    Math.cos(half)
  ];
}

/**
 * Rotate vector `v` by unit quaternion `q = [x, y, z, w]`.
 */
export function quatRotateVec3(q, v) {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx)
  ];
}

/**
 * Extract exact right-handed orthonormal local basis `{ right, up, fwd }` from unit quaternion `q`.
 * Convention matching `appendIconicUfoGeometry`:
 *   identity `q = [0, 0, 0, 1]` -> `right = [+1, 0, 0]`, `up = [0, +1, 0]`, `fwd = [0, 0, -1]` (looking -Z into screen).
 */
export function quatToBasis(q) {
  const qn = quatNormalize(q);
  return {
    right: quatRotateVec3(qn, [1, 0, 0]),
    up: quatRotateVec3(qn, [0, 1, 0]),
    fwd: quatRotateVec3(qn, [0, 0, -1])
  };
}

/**
 * Extract readable Euler angles in degrees `{ pitchDeg, yawDeg, rollDeg }` from unit quaternion `q`.
 */
export function quatToEulerDeg(q) {
  const { right, up, fwd } = quatToBasis(q);
  const rad2deg = 180 / Math.PI;
  const pitchDeg = Math.asin(clamp(fwd[1], -1, 1)) * rad2deg;
  const yawDeg = Math.atan2(fwd[0], -fwd[2]) * rad2deg;
  const rollDeg = Math.atan2(right[1], up[1]) * rad2deg;
  return {
    pitchDeg: Number(pitchDeg.toFixed(1)),
    yawDeg: Number(yawDeg.toFixed(1)),
    rollDeg: Number(rollDeg.toFixed(1))
  };
}

/**
 * Build a unit quaternion looking from `eye` toward `target` with given world `upHint`.
 */
export function quatFromLookDirection(fwdIn, upHint = [0, 1, 0]) {
  const fl = Math.hypot(fwdIn[0], fwdIn[1], fwdIn[2]) || 1;
  const fwd = [fwdIn[0] / fl, fwdIn[1] / fl, fwdIn[2] / fl];
  // Z_local = -fwd
  const z = [-fwd[0], -fwd[1], -fwd[2]];
  let rx = upHint[1] * z[2] - upHint[2] * z[1];
  let ry = upHint[2] * z[0] - upHint[0] * z[2];
  let rz = upHint[0] * z[1] - upHint[1] * z[0];
  let rl = Math.hypot(rx, ry, rz);
  if (rl < 1e-5) {
    rx = 1; ry = 0; rz = 0; rl = 1;
  }
  const x = [rx / rl, ry / rl, rz / rl];
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0]
  ];
  // Rotation matrix columns [x, y, z] -> unit quaternion
  const m00 = x[0], m01 = y[0], m02 = z[0];
  const m10 = x[1], m11 = y[1], m12 = z[1];
  const m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  let qx, qy, qz, qw;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1.0) * 2;
    qw = 0.25 * s;
    qx = (m21 - m12) / s;
    qy = (m02 - m20) / s;
    qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }
  return quatNormalize([qx, qy, qz, qw]);
}

/**
 * Determine the physical propulsion & telemetry regime across ULG's 40 orders of magnitude!
 *   - Intergalactic (`>= 10^22 m`): Mpc/s
 *   - Interstellar / Galactic (`10^16..10^22 m`): ly/s
 *   - Interplanetary (`10^9..10^16 m`): AU/hr & c
 *   - Planetary Orbital (`10^5..10^9 m`): km/s
 *   - Surface (`surfaceActive`): m/s & Mach
 *   - Quantum / Atomic (`< 10^-5 m`): nm/s -> fm/s
 */
export function resolveUfoMotionRegime(log10SpanM, { surfaceActive = false } = {}) {
  const span = Number.isFinite(Number(log10SpanM)) ? Number(log10SpanM) : 12.2;
  if (surfaceActive) {
    return Object.freeze({
      id: 'surface-flight',
      label: 'Surface Anti-Grav',
      shortLabel: 'SURFACE',
      worldUnitsPerSec: 42.0,
      warpMultiplier: 2.2,
      unitLabel: 'm/s',
      metersPerWorldUnit: 1.0,
      scaleCruiseRate: 0.0
    });
  }
  if (span >= 22.0) {
    const metersPerUnit = Math.pow(10, span) / 14.0;
    return Object.freeze({
      id: 'intergalactic',
      label: 'Intergalactic Warp',
      shortLabel: 'INTERGALACTIC',
      worldUnitsPerSec: 12.0,
      warpMultiplier: 4.5,
      unitLabel: 'Mpc/s',
      metersPerWorldUnit: metersPerUnit,
      scaleCruiseRate: 0.65
    });
  }
  if (span >= 16.0) {
    const metersPerUnit = Math.pow(10, span) / 14.0;
    return Object.freeze({
      id: 'interstellar',
      label: 'Interstellar Cruise',
      shortLabel: 'INTERSTELLAR',
      worldUnitsPerSec: 11.5,
      warpMultiplier: 4.2,
      unitLabel: 'ly/s',
      metersPerWorldUnit: metersPerUnit,
      scaleCruiseRate: 0.58
    });
  }
  if (span >= 8.8) {
    const metersPerUnit = Math.pow(10, span) / 14.0;
    return Object.freeze({
      id: 'interplanetary',
      label: 'Interplanetary Drive',
      shortLabel: 'INTERPLANETARY',
      worldUnitsPerSec: 11.0,
      warpMultiplier: 3.8,
      unitLabel: 'AU/hr',
      metersPerWorldUnit: metersPerUnit,
      scaleCruiseRate: 0.52
    });
  }
  if (span >= -5.6) {
    const metersPerUnit = Math.pow(10, span) / 14.0;
    return Object.freeze({
      id: 'planetary',
      label: 'Planetary Orbital',
      shortLabel: 'PLANETARY',
      worldUnitsPerSec: 10.0,
      warpMultiplier: 3.2,
      unitLabel: 'km/s',
      metersPerWorldUnit: metersPerUnit,
      scaleCruiseRate: 0.45
    });
  }
  const metersPerUnit = Math.pow(10, span) / 14.0;
  return Object.freeze({
    id: 'quantum',
    label: 'Subatomic Probe',
    shortLabel: 'QUANTUM',
    worldUnitsPerSec: 9.0,
    warpMultiplier: 2.5,
    unitLabel: span < -12.0 ? 'fm/s' : 'pm/s',
    metersPerWorldUnit: metersPerUnit,
    scaleCruiseRate: 0.35
  });
}

/**
 * Format speed in authentic physical units for the current cosmic motion regime.
 */
export function formatRegimeVelocity(worldSpeed, regime) {
  const mps = Math.max(0, Number(worldSpeed) || 0) * (regime?.metersPerWorldUnit || 1.0);
  if (!regime || regime.id === 'surface-flight') {
    if (mps >= 1000) return `${(mps / 1000).toFixed(2)} km/s`;
    return `${mps.toFixed(1)} m/s`;
  }
  if (regime.id === 'intergalactic') {
    const mpcPerS = mps / 3.085677581e22;
    return `${mpcPerS >= 10 ? mpcPerS.toFixed(1) : mpcPerS.toFixed(2)} Mpc/s`;
  }
  if (regime.id === 'interstellar') {
    const lyPerS = mps / 9.46073047e15;
    if (lyPerS >= 1000) return `${(lyPerS / 1000).toFixed(2)} kly/s`;
    return `${lyPerS >= 10 ? lyPerS.toFixed(1) : lyPerS.toFixed(2)} ly/s`;
  }
  if (regime.id === 'interplanetary') {
    const cFrac = mps / 2.99792458e8;
    if (cFrac >= 0.1) return `${cFrac >= 10 ? cFrac.toFixed(1) : cFrac.toFixed(2)} c`;
    const auPerHr = (mps * 3600) / 1.495978707e11;
    return `${auPerHr.toFixed(2)} AU/hr`;
  }
  if (regime.id === 'planetary') {
    const kmPerS = mps / 1000;
    if (kmPerS >= 1e4) return `${(kmPerS / 2.99792458e5).toFixed(2)} c`;
    return `${kmPerS >= 100 ? kmPerS.toFixed(0) : kmPerS.toFixed(1)} km/s`;
  }
  if (regime.unitLabel === 'fm/s') return `${(mps * 1e15).toFixed(1)} fm/s`;
  return `${(mps * 1e12).toFixed(1)} pm/s`;
}

/**
 * Pure Standard HTML5 Xbox Gamepad reader (100% host-testable with mock gamepad objects!).
 * Standard Gamepad Mapping (`mapping === 'standard'` or any 4-axis/12-button controller):
 *   - Left Stick (`axes[0], axes[1]`): Strafe X, Forward/Back Thrust Y
 *   - Right Stick (`axes[2], axes[3]`): Yaw Y, Pitch X
 *   - LB (`buttons[4]`) / RB (`buttons[5]`): Roll Z Left / Right (full 360 deg!)
 *   - LT (`buttons[6]`) / RT (`buttons[7]`): Brake / Analog Warp Boost
 *   - A (`buttons[0]`) / B (`buttons[1]`): Ascend (+Up) / Descend (-Up)
 *   - X (`buttons[2]`): Fire Rim Weapon | Y (`buttons[3]`): Tractor Beam
 *   - D-Pad Up (`12`) / Down (`13`): Chase Camera Zoom In / Waaaay Out!
 *   - D-Pad Left (`14`) / Right (`15`): 40-OOM Scale Zoom Out / In
 *   - View (`8`): Toggle Global UFO <-> Orbit | Menu (`9`): Toggle Cockpit View
 *   - L3 (`10`): Level Horizon | R3 (`11`): Launch Guided Missile
 */
export function readXboxGamepadInput(gp, deadzone = 0.14) {
  if (!gp || gp.connected === false) {
    return {
      connected: false,
      id: '',
      strafe: 0,
      thrust: 0,
      yawRate: 0,
      pitchRate: 0,
      rollRate: 0,
      ascend: 0,
      warpBoost: 0,
      brake: 0,
      chaseZoomDir: 0,
      scaleZoomDir: 0,
      fire: false,
      tractor: false,
      toggleMode: false,
      toggleCockpit: false,
      levelHorizon: false,
      launchMissile: false
    };
  }
  const dz = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) < deadzone) return 0;
    return Math.sign(n) * ((Math.abs(n) - deadzone) / (1 - deadzone));
  };
  const btnVal = (i) => {
    const b = gp.buttons?.[i];
    if (b == null) return 0;
    return typeof b === 'number' ? b : (Number(b.value) || (b.pressed ? 1 : 0));
  };
  const btnDown = (i) => btnVal(i) > 0.35;
  const ax = gp.axes || [];
  const lb = btnDown(4) ? 1 : 0;
  const rb = btnDown(5) ? 1 : 0;
  const upA = btnDown(0) ? 1 : 0;
  const dnB = btnDown(1) ? 1 : 0;
  const dpUp = btnDown(12) ? 1 : 0;
  const dpDn = btnDown(13) ? 1 : 0;
  const dpL = btnDown(14) ? 1 : 0;
  const dpR = btnDown(15) ? 1 : 0;

  return {
    connected: true,
    id: String(gp.id || 'Xbox Gamepad'),
    strafe: dz(ax[0]),
    thrust: -dz(ax[1]),        // Stick up (-1) = forward thrust (+1)
    yawRate: -dz(ax[2]),       // Right stick right (+1) = turn right (negative CCW yaw)
    pitchRate: -dz(ax[3]),     // Right stick up (-1) = pitch up (+1)
    rollRate: lb - rb,         // LB = roll left (+Z), RB = roll right (-Z)
    ascend: upA - dnB,
    warpBoost: clamp(btnVal(7), 0, 1),
    brake: clamp(btnVal(6), 0, 1),
    chaseZoomDir: dpDn - dpUp, // D-Pad Down = zoom chase cam WAY OUT (+1), Up = zoom in (-1)
    scaleZoomDir: dpL - dpR,   // D-Pad Left = zoom out (+log10), Right = zoom in (-log10)
    fire: btnDown(2),
    tractor: btnDown(3),
    toggleMode: btnDown(8),
    toggleCockpit: btnDown(9),
    levelHorizon: btnDown(10),
    launchMissile: btnDown(11)
  };
}

/**
 * Create the global stateful 6-DOF UFO Free-Flight Controller shared across ALL ULG Universes scales.
 */
export function createUfoFlightController({ initialMode = 'orbit' } = {}) {
  let mode = initialMode === 'ufo' ? 'ufo' : 'orbit'; // 'orbit' | 'ufo'
  let pos = [0, 1.8, 13.5];
  let vel = [0, 0, 0];
  let quat = [0, 0, 0, 1]; // Unit quaternion [qx, qy, qz, qw]
  let chaseDistMul = 1.0;  // 0.55 (close) .. 45.0 (zoomed waaaay out!)
  let warpBoost = 0;
  let gamepadConnected = false;
  let gamepadId = '';
  let lastRegime = resolveUfoMotionRegime(24.8);
  let lastSpeedWorld = 0;
  let lastSpeedFormatted = '0.0 Mpc/s';

  // Edge-detection memory for gamepad discrete buttons
  const prevBtn = {
    toggleMode: false,
    toggleCockpit: false,
    tractor: false,
    launchMissile: false,
    levelHorizon: false
  };

  // Keyboard 6-DOF input state (used whenever `mode === 'ufo'` in space!)
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    ascend: false,
    descend: false,
    rollLeft: false,
    rollRight: false,
    pitchUp: false,
    pitchDown: false,
    yawLeft: false,
    yawRight: false,
    boost: false,
    brake: false
  };

  function syncFromOrbitCamera(eye, target) {
    const fwd = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
    const f = [fwd[0] / fl, fwd[1] / fl, fwd[2] / fl];
    // Place ship cleanly ahead of orbit eye so toggling Orbit -> UFO feels instant & seamless!
    pos = [
      eye[0] + f[0] * 5.8,
      eye[1] + f[1] * 5.8 - 1.2,
      eye[2] + f[2] * 5.8
    ];
    vel = [0, 0, 0];
    quat = quatFromLookDirection(f, [0, 1, 0]);
  }

  function resetPosition(eye = [0, 4.5, 16.0], target = [0, 0, 0]) {
    syncFromOrbitCamera(eye, target);
    chaseDistMul = 1.0;
  }

  function setMode(nextMode, orbitSync = null) {
    const clean = nextMode === 'ufo' ? 'ufo' : 'orbit';
    if (clean === 'ufo' && mode !== 'ufo' && orbitSync?.eye && orbitSync?.target) {
      syncFromOrbitCamera(orbitSync.eye, orbitSync.target);
    }
    mode = clean;
    return mode;
  }

  function toggleMode(orbitSync = null) {
    return setMode(mode === 'ufo' ? 'orbit' : 'ufo', orbitSync);
  }

  function setKeys(partial = {}) {
    Object.assign(keys, partial);
  }

  function clearKeys() {
    for (const k of Object.keys(keys)) keys[k] = false;
  }

  /**
   * Apply direct local-frame 3D rotation increments (X = pitch, Y = yaw, Z = roll) in radians!
   * Strictly gimbal-lock free in ALL orientations.
   */
  function rotateLocal(dPitchX = 0, dYawY = 0, dRollZ = 0) {
    let q = quat;
    if (Math.abs(dYawY) > 1e-7) {
      q = quatMul(q, quatFromAxisAngle([0, 1, 0], dYawY));
    }
    if (Math.abs(dPitchX) > 1e-7) {
      q = quatMul(q, quatFromAxisAngle([1, 0, 0], dPitchX));
    }
    if (Math.abs(dRollZ) > 1e-7) {
      q = quatMul(q, quatFromAxisAngle([0, 0, 1], dRollZ));
    }
    quat = quatNormalize(q);
    return quat;
  }

  function levelHorizon() {
    const { fwd } = quatToBasis(quat);
    const flatFwd = Math.hypot(fwd[0], fwd[2]) > 0.05 ? [fwd[0], 0, fwd[2]] : [0, 0, -1];
    quat = quatFromLookDirection(flatFwd, [0, 1, 0]);
    return quat;
  }

  function adjustChaseZoom(factor) {
    const f = Number(factor);
    if (!Number.isFinite(f) || f <= 0) return chaseDistMul;
    chaseDistMul = clamp(chaseDistMul * f, UFO_CHASE_ZOOM_MIN, UFO_CHASE_ZOOM_MAX);
    return chaseDistMul;
  }

  function setChaseZoom(mul) {
    const m = Number(mul);
    if (!Number.isFinite(m)) return chaseDistMul;
    chaseDistMul = clamp(m, UFO_CHASE_ZOOM_MIN, UFO_CHASE_ZOOM_MAX);
    return chaseDistMul;
  }

  /**
   * Poll HTML5 Gamepads (or an injected mock array for host unit tests) and return
   * both continuous analog axes AND edge-triggered discrete actions.
   */
  function pollGamepads(injectedPads = null) {
    let pads = injectedPads;
    if (!pads && typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      try {
        pads = navigator.getGamepads();
      } catch {
        pads = [];
      }
    }
    let activeGp = null;
    if (pads) {
      for (let i = 0; i < pads.length; i += 1) {
        if (pads[i] && pads[i].connected !== false) {
          activeGp = pads[i];
          break;
        }
      }
    }
    const gp = readXboxGamepadInput(activeGp);
    gamepadConnected = gp.connected;
    gamepadId = gp.id;

    const actions = {
      toggleModePressed: gp.toggleMode && !prevBtn.toggleMode,
      toggleCockpitPressed: gp.toggleCockpit && !prevBtn.toggleCockpit,
      tractorPressed: gp.tractor && !prevBtn.tractor,
      launchMissilePressed: gp.launchMissile && !prevBtn.launchMissile,
      levelHorizonPressed: gp.levelHorizon && !prevBtn.levelHorizon
    };
    prevBtn.toggleMode = gp.toggleMode;
    prevBtn.toggleCockpit = gp.toggleCockpit;
    prevBtn.tractor = gp.tractor;
    prevBtn.launchMissile = gp.launchMissile;
    prevBtn.levelHorizon = gp.levelHorizon;

    return { gp, actions };
  }

  /**
   * Integrate 6-DOF UFO kinematics for `dtSec` in cosmic space (`mode === 'ufo'`).
   * Returns `{ pos, vel, quat, basis, chaseDistMul, regime, speedWorld, speedLabel, deltaLog10Scale }`.
   */
  function stepSpace(dtSec, { log10SpanM = 12.2, gamepadInput = null } = {}) {
    const dt = clamp(Number(dtSec) || 0.016, 0.001, 0.1);
    const regime = resolveUfoMotionRegime(log10SpanM, { surfaceActive: false });
    lastRegime = regime;
    const gp = gamepadInput || readXboxGamepadInput(null);

    const kFwd = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
    const kStrafe = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const kUp = (keys.ascend ? 1 : 0) - (keys.descend ? 1 : 0);
    const kRoll = (keys.rollLeft ? 1 : 0) - (keys.rollRight ? 1 : 0);
    const kPitch = (keys.pitchUp ? 1 : 0) - (keys.pitchDown ? 1 : 0);
    const kYaw = (keys.yawLeft ? 1 : 0) - (keys.yawRight ? 1 : 0);

    const fwdIn = clamp(kFwd + gp.thrust, -1, 1);
    const strafeIn = clamp(kStrafe + gp.strafe, -1, 1);
    const upIn = clamp(kUp + gp.ascend, -1, 1);
    const rollIn = clamp(kRoll + gp.rollRate, -1, 1);
    const pitchIn = clamp(kPitch + gp.pitchRate, -1, 1);
    const yawIn = clamp(kYaw + gp.yawRate, -1, 1);

    const boostAmt = Math.max(keys.boost ? 1.0 : 0.0, gp.warpBoost);
    const brakeAmt = Math.max(keys.brake ? 1.0 : 0.0, gp.brake);
    warpBoost = boostAmt;

    // Exact 6-DOF local rotation (pitch X, yaw Y, roll Z — full 360 deg, zero gimbal lock!)
    const angRate = 1.95;
    rotateLocal(pitchIn * angRate * dt, yawIn * angRate * dt, rollIn * 2.15 * dt);

    // Wide chase camera zoom from gamepad D-Pad Up/Down (snappy 0.55x -> 45x sweep!)
    if (Math.abs(gp.chaseZoomDir) > 0.1) {
      adjustChaseZoom(Math.pow(4.8, gp.chaseZoomDir * dt));
    }

    const basis = quatToBasis(quat);
    const maxSpeed = regime.worldUnitsPerSec * (1.0 + boostAmt * (regime.warpMultiplier - 1.0));
    const thrustAccel = maxSpeed * 4.2;

    vel[0] += (basis.fwd[0] * fwdIn + basis.right[0] * strafeIn + basis.up[0] * upIn) * thrustAccel * dt;
    vel[1] += (basis.fwd[1] * fwdIn + basis.right[1] * strafeIn + basis.up[1] * upIn) * thrustAccel * dt;
    vel[2] += (basis.fwd[2] * fwdIn + basis.right[2] * strafeIn + basis.up[2] * upIn) * thrustAccel * dt;

    // Smooth inertial damping (stronger when braking!)
    const damp = Math.exp(-(brakeAmt > 0.1 ? 8.5 : 3.2) * dt);
    vel[0] *= damp;
    vel[1] *= damp;
    vel[2] *= damp;

    const spd = Math.hypot(vel[0], vel[1], vel[2]);
    if (spd > maxSpeed) {
      const sc = maxSpeed / spd;
      vel[0] *= sc; vel[1] *= sc; vel[2] *= sc;
    }

    pos[0] += vel[0] * dt;
    pos[1] += vel[1] * dt;
    pos[2] += vel[2] * dt;

    // Soft radial tether only at extreme runaway distance (> 320 world units) so scene never clips out of frustum
    const rDist = Math.hypot(pos[0], pos[1], pos[2]);
    if (rDist > 320) {
      const pull = 320 / rDist;
      pos[0] *= pull; pos[1] *= pull; pos[2] *= pull;
    }

    lastSpeedWorld = Math.hypot(vel[0], vel[1], vel[2]);
    lastSpeedFormatted = formatRegimeVelocity(lastSpeedWorld, regime);

    // Optional D-Pad Left/Right 40-OOM scale zoom directly from Xbox controller
    const deltaLog10Scale = Math.abs(gp.scaleZoomDir) > 0.1 ? gp.scaleZoomDir * 1.8 * dt : 0;

    return {
      pos: [...pos],
      vel: [...vel],
      quat: [...quat],
      basis,
      chaseDistMul,
      regime,
      speedWorld: lastSpeedWorld,
      speedLabel: lastSpeedFormatted,
      deltaLog10Scale
    };
  }

  /**
   * Compute 3rd-person wide chase OR 1st-person inside-dome cockpit camera from the 6-DOF quaternion pose!
   * Note: `chaseDistMul` spans `0.55x .. 45.0x` so you can zoom waaaay out behind the rotating saucer!
   */
  function getSpaceCameraPose({ cockpit = false } = {}) {
    const basis = quatToBasis(quat);
    if (cockpit) {
      const eye = [
        pos[0] + basis.up[0] * 0.18 + basis.fwd[0] * 0.10,
        pos[1] + basis.up[1] * 0.18 + basis.fwd[1] * 0.10,
        pos[2] + basis.up[2] * 0.18 + basis.fwd[2] * 0.10
      ];
      const target = [
        eye[0] + basis.fwd[0] * 12.0,
        eye[1] + basis.fwd[1] * 12.0,
        eye[2] + basis.fwd[2] * 12.0
      ];
      return { eye, target, up: basis.up, basis };
    }
    const baseBack = 5.9 * chaseDistMul;
    const baseLift = 1.65 * Math.pow(chaseDistMul, 0.85);
    const eye = [
      pos[0] - basis.fwd[0] * baseBack + basis.up[0] * baseLift,
      pos[1] - basis.fwd[1] * baseBack + basis.up[1] * baseLift,
      pos[2] - basis.fwd[2] * baseBack + basis.up[2] * baseLift
    ];
    const target = [
      pos[0] + basis.fwd[0] * (8.0 + baseBack * 0.28),
      pos[1] + basis.fwd[1] * (8.0 + baseBack * 0.28),
      pos[2] + basis.fwd[2] * (8.0 + baseBack * 0.28)
    ];
    return { eye, target, up: basis.up, basis };
  }

  function getState(log10SpanM = 12.2, surfaceActive = false) {
    const regime = resolveUfoMotionRegime(log10SpanM, { surfaceActive });
    const basis = quatToBasis(quat);
    const eulerDeg = quatToEulerDeg(quat);
    return {
      schema: UFO_FLIGHT_CONTROLLER_SCHEMA,
      mode,
      pos: [...pos],
      vel: [...vel],
      quat: [...quat],
      basis,
      eulerDeg,
      chaseDistMul: Number(chaseDistMul.toFixed(2)),
      warpBoost: Number(warpBoost.toFixed(2)),
      regime,
      speedWorld: Number(lastSpeedWorld.toFixed(3)),
      speedLabel: lastSpeedFormatted,
      gamepadConnected,
      gamepadId
    };
  }

  return Object.freeze({
    get mode() { return mode; },
    get pos() { return pos; },
    get vel() { return vel; },
    get quat() { return quat; },
    get chaseDistMul() { return chaseDistMul; },
    get gamepadConnected() { return gamepadConnected; },
    get gamepadId() { return gamepadId; },
    get lastRegime() { return lastRegime; },
    setMode,
    toggleMode,
    syncFromOrbitCamera,
    resetPosition,
    setKeys,
    clearKeys,
    rotateLocal,
    levelHorizon,
    adjustChaseZoom,
    setChaseZoom,
    pollGamepads,
    stepSpace,
    getSpaceCameraPose,
    getState
  });
}
