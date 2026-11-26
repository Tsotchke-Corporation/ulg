import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UFO_CHASE_ZOOM_MAX,
  UFO_CHASE_ZOOM_MIN,
  createUfoFlightController,
  formatRegimeVelocity,
  quatToBasis,
  readXboxGamepadInput,
  resolveUfoMotionRegime
} from '../src/demos/ufoFlightController.js';
import {
  appendStarVisuals,
  computeHostStarIllumination,
  resolveStellarRegimeForStarSpec,
  starTemperatureToLightRgb
} from '../src/runtime/astrophysics/starlightAndExoticOptics.js';
import { analyzeOrbitalBodySpectroscopy } from '../src/runtime/astrophysics/orbitalRemoteSensing.js';
import {
  deriveStarSystemFromGalacticLocation,
  synthesizeNebularPlanetarySystem
} from '../src/runtime/astrophysics/causalNebularSystemGenerator.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import { appendIconicUfoGeometry } from '../src/runtime/astrophysics/ufoWeaponsAndPhysicsGpu.js';
import { stellarMlsMpmFusionWgsl } from '../src/runtime/astrophysics/stellarMlsMpmFusionGpu.js';

test('Phase E1: Exotic star synthesis (Pulsar/BH/WD), fallback-disk pulsar planets, and identity preservation', () => {
  const pulsarSys = deriveStarSystemFromGalacticLocation({
    starPosGal: [5.2, 0.1, 1.4],
    popTag: 0.65,
    starIndex: 991,
    seed: 20261125,
    forceExoticStage: 'neutron-star'
  });
  assert.equal(pulsarSys.stars[0].stage, 'neutron-star');
  assert.equal(pulsarSys.stars[0].spectralCode, 'PSR');

  const synthPulsar = synthesizeNebularPlanetarySystem(pulsarSys, { seedOverride: 20261125 });
  assert.ok(synthPulsar.planetCount >= 2, `Expected fallback-disk pulsar planets (PSR B1257+12), got ${synthPulsar.planetCount}`);
  assert.equal(synthPulsar.catalog[0].stage, 'neutron-star');

  // Identity preservation mapping across exotic & massive stars (never accidentally legacy massive-supernova!)
  assert.equal(resolveStellarRegimeForStarSpec(synthPulsar.catalog[0]).stellarMode, 'pulsar');
  assert.equal(resolveStellarRegimeForStarSpec({ stage: 'magnetar' }).stellarMode, 'magnetar');
  assert.equal(resolveStellarRegimeForStarSpec({ stage: 'stellar-black-hole' }).stellarMode, 'black-hole');
  assert.equal(resolveStellarRegimeForStarSpec({ stage: 'white-dwarf' }).stellarMode, 'white-dwarf-tov');
  const massiveStar = resolveStellarRegimeForStarSpec({ stage: 'main-sequence', massSolar: 18, tempK: 26000 });
  assert.equal(massiveStar.stellarMode, 'fusion');
  assert.equal(massiveStar.stellarPreset, 'blue-supergiant');

  // Exotic visuals emitted cleanly for planetary orbit & surface sky
  const spheres = []; const disks = []; const lines = [];
  const pVis = appendStarVisuals({
    spec: synthPulsar.catalog[0],
    pos: [120, 10, -40],
    radius: 2.2,
    timeSec: 1.5,
    spheres,
    disks,
    lineChunks: lines
  });
  assert.equal(pVis.exoticRendered, 'pulsar');
  assert.equal(spheres.length, 1);
  assert.equal(disks.length, 1);
  assert.ok(lines.length > 200, 'Pulsar in planetary orbit must emit lighthouse beams and dipole field lines');

  const bhSph = []; const bhDisk = []; const bhLines = [];
  const bhVis = appendStarVisuals({
    spec: { stage: 'stellar-black-hole', kind: 5 },
    pos: [-80, 12, 40],
    radius: 2.0,
    timeSec: 0.8,
    spheres: bhSph,
    disks: bhDisk,
    lineChunks: bhLines
  });
  assert.equal(bhVis.exoticRendered, 'black-hole');
  assert.equal(bhSph[0].kind, 5);
  assert.deepEqual(bhSph[0].color0, [0, 0, 0]);
  assert.equal(bhDisk.length, 1);
  assert.ok(bhLines.length >= 168, 'Black hole in orbit must emit relativistic BZ jet beams');

  // Zero-COM stabilization embedded in 3D MLS-MPM stellar fusion WGSL
  assert.ok(stellarMlsMpmFusionWgsl.includes('COM_OFFSET'), 'stellarMlsMpmFusionWgsl must include GPU COM stabilization');
  assert.ok(stellarMlsMpmFusionWgsl.includes('com_vel'), 'stellarMlsMpmFusionWgsl must zero net COM momentum drift');
});

test('Phase E2: Realistic host-star spectrum & inverse-square distance illumination', () => {
  const mDwarfRgb = starTemperatureToLightRgb(3000);
  const gSolarRgb = starTemperatureToLightRgb(5778);
  const obBlueRgb = starTemperatureToLightRgb(26000);
  assert.ok(mDwarfRgb[0] > mDwarfRgb[2] * 2.5, 'M-dwarf starlight must be strongly red-shifted');
  assert.ok(obBlueRgb[2] > obBlueRgb[0] * 1.25, 'O/B starlight must be blue-shifted');
  assert.ok(gSolarRgb[0] >= 0.95 && gSolarRgb[1] >= 0.90 && gSolarRgb[2] >= 0.85, 'G2V sunlight must be warm white');

  const sun = REAL_SOLAR_SYSTEM_CATALOG[0];
  const lMerc = computeHostStarIllumination({ starSpec: sun, distanceAu: 0.387 });
  const lEarth = computeHostStarIllumination({ starSpec: sun, distanceAu: 1.0 });
  const lMars = computeHostStarIllumination({ starSpec: sun, distanceAu: 1.524 });
  const lJup = computeHostStarIllumination({ starSpec: sun, distanceAu: 5.203 });
  const lPluto = computeHostStarIllumination({ starSpec: sun, distanceAu: 39.48 });
  const lRogue = computeHostStarIllumination({ starSpec: sun, isRogue: true });

  assert.ok(lMerc.fluxGain > lEarth.fluxGain, 'Mercury must be brighter than Earth');
  assert.ok(Math.abs(lEarth.fluxGain - 1.0) < 0.01, 'Earth at 1 AU around 1 L_sun must normalize to 1.0x');
  assert.ok(lEarth.fluxGain > lMars.fluxGain && lMars.fluxGain > lJup.fluxGain && lJup.fluxGain > lPluto.fluxGain);
  assert.ok(lPluto.fluxGain >= 0.25 && lPluto.fluxGain < 0.38, `Pluto twilight gain expected ~0.29x, got ${lPluto.fluxGain}`);
  assert.ok(lRogue.fluxGain < lPluto.fluxGain, 'Rogue planet must be dimmer than Pluto');
  assert.ok(Math.abs(lEarth.irradianceWm2 - 1361) < 1.0);

  // Pulsar illumination pulses over time with cyan-violet spectrum
  const pStar = { stage: 'neutron-star', tempK: 850000, luminositySolar: 0.18 };
  const pPeak = computeHostStarIllumination({ starSpec: pStar, distanceAu: 0.5, timeSec: 0.0 });
  const pTrough = computeHostStarIllumination({ starSpec: pStar, distanceAu: 0.5, timeSec: Math.PI / 3.8 });
  assert.ok(pPeak.rgb[2] > pPeak.rgb[0], 'Pulsar illumination must be blue/cyan-violet');
  assert.ok(pPeak.fluxGain > pTrough.fluxGain * 1.25, 'Pulsar illumination must modulate as lighthouse beam sweeps');
});

test('Phase E3: First-principles orbital remote-sensing biosignatures & mineral hints (zero planet-name hacks)', () => {
  const sun = REAL_SOLAR_SYSTEM_CATALOG[0];
  // Strip names to verify ZERO hardcoded planet-name shortcuts!
  const stripName = (spec) => ({ ...spec, id: 'anon-world', name: 'Anonymous Exoplanet' });
  const earthSpec = stripName(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'earth'));
  const marsSpec = stripName(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'mars'));
  const moonSpec = stripName(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'moon'));
  const titanSpec = stripName(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'titan'));
  const europaSpec = stripName(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'europa'));
  const venusSpec = stripName(REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === 'venus'));

  const rEarth = analyzeOrbitalBodySpectroscopy(earthSpec, sun);
  const rMars = analyzeOrbitalBodySpectroscopy(marsSpec, sun);
  const rMoon = analyzeOrbitalBodySpectroscopy(moonSpec, sun);
  const rTitan = analyzeOrbitalBodySpectroscopy(titanSpec, sun);
  const rEuropa = analyzeOrbitalBodySpectroscopy(europaSpec, sun);
  const rVenus = analyzeOrbitalBodySpectroscopy(venusSpec, sun);

  assert.equal(rEarth.biosignatureLevel, 'strong', 'Temperate liquid-H2O ocean world must show strong O2/CH4 + red-edge biosignature');
  assert.ok(rEarth.mineralHints.some((m) => m.formula.includes('SiO₂')), 'Earth-like crust must predict silicate minerals');
  assert.equal(rMoon.biosignatureLevel, 'sterile', 'Airless rocky vacuum world must read sterile');
  assert.ok(rMars.mineralHints.some((m) => m.formula.includes('Fe₂O₃')), 'Oxidized dusty world must predict Fe2O3 hematite');
  assert.equal(rTitan.biosignatureLevel, 'tentative', 'Dense N2/CH4 cryogenic world must show tentative cryobio signature');
  assert.equal(rEuropa.biosignatureLevel, 'subsurface', 'Volatile icy airless moon must show subsurface cryo-plume signature');
  assert.ok(['tentative', 'prebiotic', 'sterile'].includes(rVenus.biosignatureLevel));
  assert.ok(rEarth.spectralFeaturesNm.some((f) => f.isBio), 'Strong biosignature world must expose bio spectral markers');
});

test('Phase E4: Global 6-DOF Quaternion UFO Controller (zero gimbal lock X/Y/Z), wide 45x chase zoom, motion regimes & Xbox Gamepad', () => {
  const ctrl = createUfoFlightController({ initialMode: 'orbit' });
  assert.equal(ctrl.mode, 'orbit');
  ctrl.setMode('ufo', { eye: [0, 3, 18], target: [0, 0, 0] });
  assert.equal(ctrl.mode, 'ufo');

  // Pitch straight up 90 degrees (+X), yaw 45 degrees (+Y), barrel roll 180 degrees (+Z) — verify exact orthonormal basis (zero gimbal lock!)
  ctrl.rotateLocal(Math.PI * 0.5, Math.PI * 0.25, Math.PI);
  const { right, up, fwd } = quatToBasis(ctrl.quat);
  const lenR = Math.hypot(...right);
  const lenU = Math.hypot(...up);
  const lenF = Math.hypot(...fwd);
  assert.ok(Math.abs(lenR - 1) < 1e-5 && Math.abs(lenU - 1) < 1e-5 && Math.abs(lenF - 1) < 1e-5, 'Basis vectors must remain unit length');
  const dotRU = right[0] * up[0] + right[1] * up[1] + right[2] * up[2];
  const dotRF = right[0] * fwd[0] + right[1] * fwd[1] + right[2] * fwd[2];
  const dotUF = up[0] * fwd[0] + up[1] * fwd[1] + up[2] * fwd[2];
  assert.ok(Math.abs(dotRU) < 1e-5 && Math.abs(dotRF) < 1e-5 && Math.abs(dotUF) < 1e-5, 'Quaternion basis must remain strictly orthogonal at 90 deg pitch + 180 deg roll');

  // Verify appendIconicUfoGeometry consumes quaternion basis without NaNs!
  const op = []; const fx = [];
  appendIconicUfoGeometry(op, fx, {
    pos: ctrl.pos,
    basisRight: right,
    basisUp: up,
    basisFwd: fwd,
    radius: 0.52
  });
  assert.ok(op.length > 500 && fx.length > 200);
  assert.ok(op.every((v) => Number.isFinite(v)), 'Rotated saucer vertices must all be finite');

  // Wide chase camera zoom-out up to 45x!
  ctrl.setChaseZoom(42.0);
  assert.equal(ctrl.chaseDistMul, 42.0);
  const poseWayOut = ctrl.getSpaceCameraPose({ cockpit: false });
  const distCam = Math.hypot(
    poseWayOut.eye[0] - ctrl.pos[0],
    poseWayOut.eye[1] - ctrl.pos[1],
    poseWayOut.eye[2] - ctrl.pos[2]
  );
  assert.ok(distCam > 200, `42x chase zoom-out must pull camera > 200 units away (got ${distCam.toFixed(1)})`);
  ctrl.setChaseZoom(999);
  assert.equal(ctrl.chaseDistMul, UFO_CHASE_ZOOM_MAX);
  ctrl.setChaseZoom(0.01);
  assert.equal(ctrl.chaseDistMul, UFO_CHASE_ZOOM_MIN);

  // Scale-adaptive Intergalactic / Interstellar / Interplanetary / Planetary / Surface / Quantum motion regimes!
  assert.equal(resolveUfoMotionRegime(25.0).id, 'intergalactic');
  assert.equal(resolveUfoMotionRegime(20.5).id, 'interstellar');
  assert.equal(resolveUfoMotionRegime(12.2).id, 'interplanetary');
  assert.equal(resolveUfoMotionRegime(7.5).id, 'planetary');
  assert.equal(resolveUfoMotionRegime(2.0, { surfaceActive: true }).id, 'surface-flight');
  assert.equal(resolveUfoMotionRegime(-10.0).id, 'quantum');
  assert.ok(formatRegimeVelocity(8.0, resolveUfoMotionRegime(25.0)).includes('Mpc/s'));
  assert.ok(formatRegimeVelocity(8.0, resolveUfoMotionRegime(20.5)).includes('ly/s'));

  // Standard HTML5 Xbox Gamepad input mapping + deadzone + live thrust/roll/chase-zoom!
  const mockXboxPad = {
    connected: true,
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
    axes: [0.05, -0.85, 0.60, -0.50], // 0.05 within deadzone -> 0; -0.85 -> strong forward thrust!
    buttons: Array.from({ length: 16 }, (_, i) => ({
      pressed: i === 4 || i === 13 || i === 2, // LB roll left, D-Pad Down zoom way out, X fire
      value: i === 7 ? 0.90 : (i === 4 || i === 13 || i === 2 ? 1.0 : 0.0)
    }))
  };
  const gp = readXboxGamepadInput(mockXboxPad, 0.14);
  assert.equal(gp.connected, true);
  assert.equal(gp.strafe, 0, 'Stick values inside 0.14 deadzone must zero cleanly');
  assert.ok(gp.thrust > 0.75, 'Left stick up (-0.85) must produce forward thrust');
  assert.equal(gp.rollRate, 1, 'LB must command +Z roll');
  assert.equal(gp.chaseZoomDir, 1, 'D-Pad Down must command chase camera zoom out');
  assert.equal(gp.fire, true);
  assert.ok(gp.warpBoost >= 0.89);

  ctrl.setChaseZoom(1.0);
  const pos0 = [...ctrl.pos];
  const stepRes = ctrl.stepSpace(0.25, { log10SpanM: 20.5, gamepadInput: gp });
  const moved = Math.hypot(stepRes.pos[0] - pos0[0], stepRes.pos[1] - pos0[1], stepRes.pos[2] - pos0[2]);
  assert.ok(moved > 0.5, `Xbox Gamepad thrust must move saucer in 3D space (moved=${moved.toFixed(3)})`);
  assert.ok(ctrl.chaseDistMul > 1.15, `Xbox D-Pad Down must zoom chase camera out (got ${ctrl.chaseDistMul})`);
});
