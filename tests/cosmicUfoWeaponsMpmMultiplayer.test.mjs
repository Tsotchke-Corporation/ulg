// Host Physics & Systems Verification for Cosmic UFO Perspective, Full-Spectrum EM Laser,
// Antimatter Annihilation, 360-Degree Rim Emission, Seedable URL Share-Links,
// PeerCompute Multiplayer Timescale Lock, & Kardashev / Von Neumann Probes
// (`tests/cosmicUfoWeaponsMpmMultiplayer.test.mjs`)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  UFO_DIAMETER_FT,
  UFO_RADIUS_M,
  computeUfoRimEmitPoint,
  evaluateAntimatterAnnihilation,
  evaluateEmWavelengthInfo,
  evaluateLaserMaterialInteraction
} from '../src/runtime/astrophysics/ufoWeaponsAndPhysicsGpu.js';
import {
  buildUniverseShareUrl,
  createKardashevProgressionState,
  createUfoMultiplayerMesh,
  parseUniverseShareParams
} from '../src/runtime/astrophysics/ufoMultiplayerMesh.js';

test('Full-spectrum EM wavelength resolver covers Gamma (10^-13 m) through Visible to Radio (10 m)', () => {
  const gamma = evaluateEmWavelengthInfo(-12.5);
  assert.equal(gamma.shortBand, 'γ-RAY');
  assert.ok(gamma.photonEv > 1e6, 'Gamma photon energy must exceed 1 MeV');

  const visGreen = evaluateEmWavelengthInfo(Math.log10(532e-9));
  assert.equal(visGreen.isVisible, true);
  assert.ok(visGreen.rgb[1] > 0.9 && visGreen.rgb[1] > visGreen.rgb[2], '532 nm must render bright green');

  const midIr = evaluateEmWavelengthInfo(-5.0);
  assert.equal(midIr.shortBand, 'IR');

  const mw = evaluateEmWavelengthInfo(-1.0);
  assert.equal(mw.shortBand, 'μW');

  const radio = evaluateEmWavelengthInfo(0.7);
  assert.equal(radio.shortBand, 'RF');
});

test('First-principles laser-compound interaction differentiates polar H2O microwave heating vs visible transparency vs SiO2 Mid-IR melting & Gamma Coulomb plasma', () => {
  const waterIce = { id: 'saline-ocean-water', formula: 'H₂O', primaryZ: 8 };
  const basalt = { id: 'exposed-basalt-ridge', formula: 'SiO₂', primaryZ: 14 };

  // Microwave (12 cm) strongly heats polar H2O, weakly heats dry SiO2
  const mwH2O = evaluateLaserMaterialInteraction({ log10WavelengthM: Math.log10(0.12), powerW: 5e8, sample: waterIce, currentTempK: 260, dt: 0.05 });
  const mwSiO2 = evaluateLaserMaterialInteraction({ log10WavelengthM: Math.log10(0.12), powerW: 5e8, sample: basalt, currentTempK: 260, dt: 0.05 });
  assert.ok(mwH2O.absorptance > 0.70, `Microwave must strongly absorb in polar H2O (got ${mwH2O.absorptance})`);
  assert.ok(mwH2O.absorptance > mwSiO2.absorptance * 2.5, 'Microwave must couple far stronger to polar H2O than dry SiO2');

  // Visible 532 nm transmits through clear H2O (low absorptance) while Mid-IR 9.6 um strongly absorbs in SiO2
  const visH2O = evaluateLaserMaterialInteraction({ log10WavelengthM: Math.log10(532e-9), powerW: 1e6, sample: waterIce, currentTempK: 260, dt: 0.05 });
  const irSiO2 = evaluateLaserMaterialInteraction({ log10WavelengthM: Math.log10(9.6e-6), powerW: 5e9, sample: basalt, currentTempK: 1400, dt: 0.05 });
  assert.ok(visH2O.absorptance < 0.16, `Visible 532 nm must transmit cleanly through H2O (got ${visH2O.absorptance})`);
  assert.ok(irSiO2.absorptance > 0.70 && irSiO2.nextTempK > 1470, 'Mid-IR 9.6 um must melt SiO2 silicate crust');

  // High-power X-Ray / Gamma induces Coulomb Plasma ablation
  const gammaHit = evaluateLaserMaterialInteraction({ log10WavelengthM: -11.5, powerW: 1e10, sample: basalt, currentTempK: 300, dt: 0.05 });
  assert.equal(gammaHit.phaseState, 'Coulomb Plasma');
  assert.ok(gammaHit.ablationRateMPerS > 0.5);
});

test('Antimatter beam satisfies exact E = 2 m c^2 annihilation energy & 511 keV gamma signature', () => {
  const am = evaluateAntimatterAnnihilation({ massRateKgS: 1e-6, dt: 1.0 });
  const expectedJ = 2.0 * 1e-6 * (2.99792458e8 ** 2);
  assert.ok(Math.abs(am.energyJ - expectedJ) / expectedJ < 1e-9);
  assert.equal(am.gammaPeakKev, 511.0);
  assert.ok(am.craterRadiusM >= 9.0 && am.craterDepthM >= 3.0);
});

test('60-foot UFO emits lasers & missiles dynamically from ANY 360-degree point along its equatorial disk rim', () => {
  assert.equal(UFO_DIAMETER_FT, 60.0);
  assert.ok(Math.abs(UFO_RADIUS_M * 2 - 18.3) < 0.05);
  const center = [10, 30, -5];
  const right = [1, 0, 0];
  const fwd = [0, 0, 1];
  for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const rad = (deg * Math.PI) / 180;
    const tgt = [center[0] + Math.cos(rad) * 120, center[1] - 25, center[2] + Math.sin(rad) * 120];
    const emit = computeUfoRimEmitPoint(center, right, fwd, UFO_RADIUS_M, tgt);
    const dCenter = Math.hypot(emit[0] - center[0], emit[1] - center[1], emit[2] - center[2]);
    assert.ok(Math.abs(dCenter - UFO_RADIUS_M) < 1e-5, `Rim emit point at ${deg} deg must lie on exact saucer rim R=${UFO_RADIUS_M}`);
    // Dot product with horizontal aim must be +1 (facing exact target azimuth!)
    const dot = ((emit[0] - center[0]) / UFO_RADIUS_M) * Math.cos(rad) + ((emit[2] - center[2]) / UFO_RADIUS_M) * Math.sin(rad);
    assert.ok(dot > 0.9999, `Rim emit point at ${deg} deg must align with target azimuth (dot=${dot})`);
  }
});

test('Seedable Universe URL Share-Link encodes & restores exact seed, epoch, scale, body, surface position, time & multiplayer room', () => {
  const url = buildUniverseShareUrl('https://tsotchke-corporation.github.io/ulg/universes.html', {
    seed: 77742,
    epoch: 'cosmic-noon',
    log10SpanM: 2.0,
    useSol: true,
    bodyId: 'mars',
    surfaceActive: true,
    pos: [42.5, 31.0, -18.2],
    yaw: 1.45,
    simTimeS: 128.4,
    roomId: 'squad-alpha',
    relayUrl: 'wss://relay.example.org'
  });
  const parsed = parseUniverseShareParams(new URL(url).search);
  assert.equal(parsed.seed, 77742);
  assert.equal(parsed.epoch, 'cosmic-noon');
  assert.equal(parsed.useSol, true);
  assert.equal(parsed.bodyId, 'mars');
  assert.equal(parsed.surfaceActive, true);
  assert.deepEqual(parsed.pos, [42.5, 31.0, -18.2]);
  assert.equal(parsed.yaw, 1.45);
  assert.equal(parsed.roomId, 'squad-alpha');
  assert.equal(parsed.relayUrl, 'wss://relay.example.org');
});

test('PeerCompute Multiplayer Mesh locks timescale to 1.0x when connected and Kardashev/Von Neumann probes grow power monotonically', () => {
  const mesh = createUfoMultiplayerMesh({ peerId: 'test-p1' });
  assert.equal(mesh.timescaleLocked, false);
  mesh.connect({ room: 'unit-test-room' });
  assert.equal(mesh.timescaleLocked, true);
  assert.equal(mesh.getStatus().timescaleLocked, true);
  mesh.disconnect();
  assert.equal(mesh.timescaleLocked, false);

  const kp = createKardashevProgressionState();
  const k0 = kp.state.kardashevIndex;
  const pr = kp.deployVonNeumannProbe({ bodyId: 'mars' });
  assert.ok(pr && kp.state.probes.length === 1);
  for (let i = 0; i < 400; i += 1) kp.step(0.1);
  assert.ok(kp.state.probes.length >= 2, `Von Neumann probe must self-replicate (got ${kp.state.probes.length})`);
  assert.ok(kp.state.kardashevIndex > k0, `Kardashev index must rise as Von Neumann probes harness power (${k0} -> ${kp.state.kardashevIndex})`);
});

test('Active-zone GPU MLS-MPM surface deformation kernel contains zero serial 1-thread compute workgroups', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/runtime/astrophysics/surfaceDeformationMpmGpu.js'), 'utf8');
  assert.ok(!src.includes('@workgroup_size(1)'), 'surfaceDeformationMpmGpu.js must never contain serial 1-thread workgroups');
  assert.ok(src.includes('@workgroup_size(8, 8)'));
  assert.ok(src.includes('@workgroup_size(64)'));
});
