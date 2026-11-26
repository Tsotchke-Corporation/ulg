import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLANETARY_ATMO_3D_CFD_LAW_ADAPTER,
  deriveAtmosphericColumnProfile,
  evaluateAtmosphericChemistryAtAltitude,
  evaluatePlanetaryAtmo3dCfdActivation
} from '../src/runtime/astrophysics/planetaryAtmosphere3dCfdGpu.js';
import { REAL_SOLAR_SYSTEM_CATALOG } from '../src/runtime/astrophysics/solarSystemNBodyGpu.js';
import {
  UNIVERSAL_LAW_GRAPH_NODES,
  resolveActiveUniversalLaws,
  validateUniversalLawGraphContracts
} from '../src/runtime/universalLawGraph.js';
import { createTargetOrbitControls } from '../src/runtime/shared/targetOrbitControls.js';

const byId = (id) => REAL_SOLAR_SYSTEM_CATALOG.find((b) => b.id === id);

test('Universal Law Graph Node #25 (planetary-atmosphere-3d-cfd) passes SS Law Adapter Contract with 0 debt', () => {
  const check = validateUniversalLawGraphContracts();
  assert.equal(check.valid, true, `Contract errors: ${check.errors.join(', ')} debt: ${check.debt.join(', ')}`);
  assert.equal(UNIVERSAL_LAW_GRAPH_NODES.length, 32);
  assert.equal(PLANETARY_ATMO_3D_CFD_LAW_ADAPTER.id, 'planetary-atmosphere-3d-cfd');

  const actJup = evaluatePlanetaryAtmo3dCfdActivation({ surfaceViewActive: true, surfacePressurePa: 1e6, hasSolidCrust: false });
  assert.equal(actJup.active, true);
  assert.equal(actJup.deepFluidEnvelope, true);

  const actVac = evaluatePlanetaryAtmo3dCfdActivation({ surfaceViewActive: true, surfacePressurePa: 0, hasSolidCrust: true });
  assert.equal(actVac.active, false, 'Vacuum body must keep 3D atmospheric CFD strictly dormant');

  const resolved = resolveActiveUniversalLaws({ surfaceViewActive: true, surfacePressurePa: 101325, hasSolidCrust: true, bodyRadiusM: 6.37e6 });
  assert.ok(resolved.active.some((l) => l.id === 'planetary-atmosphere-3d-cfd'));
});

test('General 3D Hydrostatic + Adiabatic + Clausius-Clapeyron Stratigraphy across Gas Giant, Ice Giant, Earth-like, Venus-like & Vacuum', () => {
  // 1. Gas Giant (Jupiter-like): H2/He bulk, multi-deck clouds, hydrostatic P & adiabatic T increase sharply downward!
  const jupProf = deriveAtmosphericColumnProfile(byId('jupiter'));
  assert.equal(jupProf.isDeepFluid, true);
  assert.ok(jupProf.jetSpeedScaleMS > 30, 'Fast-rotating gas giant must derive vigorous zonal jets');
  const jTop = evaluateAtmosphericChemistryAtAltitude(jupProf, 35);
  const jMid = evaluateAtmosphericChemistryAtAltitude(jupProf, 0);
  const jDeep = evaluateAtmosphericChemistryAtAltitude(jupProf, -65);
  assert.ok(jDeep.pressureBar > jMid.pressureBar && jMid.pressureBar > jTop.pressureBar, 'Hydrostatic pressure must increase downward');
  assert.ok(jDeep.tempK > jMid.tempK && jMid.tempK > jTop.tempK, 'Adiabatic lapse must warm downward');
  assert.equal(jMid.species[0].id, 'H2');
  assert.equal(jMid.species[1].id, 'He');

  // 2. Cold Ice Giant (Neptune-like): enriched CH4 methane ice clouds!
  const nepProf = deriveAtmosphericColumnProfile(byId('neptune'));
  const nepMid = evaluateAtmosphericChemistryAtAltitude(nepProf, 15);
  assert.ok(nepMid.species.some((s) => s.id === 'CH4'), 'Ice giant must contain CH4');

  // 3. Earth-like temperate rocky world: N2/O2/H2O troposphere + stratospheric O3 layer!
  const earthProf = deriveAtmosphericColumnProfile(byId('earth'));
  assert.equal(earthProf.hasSolidCrust, true);
  const eLow = evaluateAtmosphericChemistryAtAltitude(earthProf, 2.5);
  const eStrat = evaluateAtmosphericChemistryAtAltitude(earthProf, 20.0);
  assert.equal(eLow.species[0].id, 'N2');
  assert.equal(eLow.species[1].id, 'O2');
  assert.ok(eStrat.pressureBar < eLow.pressureBar * 0.2);
  assert.ok(eStrat.species.some((s) => s.id === 'O3'), 'O2-bearing stratosphere must produce trace O3 layer');

  // 4. Super-greenhouse rocky world (Venus-like): CO2 + H2SO4 sulfuric acid cloud deck!
  const venProf = deriveAtmosphericColumnProfile(byId('venus'));
  const vDeck = evaluateAtmosphericChemistryAtAltitude(venProf, 54);
  assert.equal(vDeck.species[0].id, 'CO2');
  assert.ok(vDeck.species.some((s) => s.id === 'H2SO4'));

  // 5. Airless Moon: strictly 0 Pa, 0 clouds, 0 species!
  const moonProf = deriveAtmosphericColumnProfile(byId('moon'));
  const mChem = evaluateAtmosphericChemistryAtAltitude(moonProf, 2.0);
  assert.equal(mChem.pressurePa, 0);
  assert.equal(mChem.species.length, 0);
});

test('TargetOrbitControls orbits around target, pans screen-space target, dollys, discriminates clicks & resets cleanly', () => {
  const listeners = new Map();
  const fakeDom = {
    addEventListener: (ev, fn) => listeners.set(ev, fn),
    removeEventListener: (ev) => listeners.delete(ev),
    setPointerCapture: () => {}
  };
  let clicks = 0;
  let changes = 0;
  const ctrl = createTargetOrbitControls(fakeDom, {
    yaw: 0.5,
    pitch: 0.25,
    dist: 10.0,
    target: [1, 2, 3],
    enableDamping: false,
    onClick: () => { clicks += 1; },
    onChange: () => { changes += 1; }
  });

  // 1. Clean click triggers onClick without moving camera
  listeners.get('pointerdown')({ pointerId: 1, button: 0, clientX: 100, clientY: 100, pointerType: 'mouse' });
  listeners.get('pointerup')({ pointerId: 1, button: 0, clientX: 101, clientY: 101, pointerType: 'mouse' });
  assert.equal(clicks, 1);

  // 2. Left-drag orbits around target without shifting target!
  listeners.get('pointerdown')({ pointerId: 2, button: 0, clientX: 100, clientY: 100, pointerType: 'mouse' });
  listeners.get('pointermove')({ pointerId: 2, button: 0, clientX: 150, clientY: 120, pointerType: 'mouse' });
  listeners.get('pointerup')({ pointerId: 2, button: 0, clientX: 150, clientY: 120, pointerType: 'mouse' });
  assert.equal(clicks, 1, 'Drag must NOT trigger onClick');
  assert.ok(ctrl.state.yaw < 0.5, 'Dragging right decreases yaw (Three.js OrbitControls convention)');
  assert.ok(ctrl.state.pitch > 0.25);
  assert.deepEqual(ctrl.state.target, [1, 2, 3], 'Orbit must remain strictly anchored to target');

  // 3. Right-drag pans target smoothly!
  listeners.get('pointerdown')({ pointerId: 3, button: 2, clientX: 200, clientY: 200, pointerType: 'mouse' });
  listeners.get('pointermove')({ pointerId: 3, button: 2, clientX: 260, clientY: 170, pointerType: 'mouse' });
  listeners.get('pointerup')({ pointerId: 3, button: 2, clientX: 260, clientY: 170, pointerType: 'mouse' });
  assert.notDeepEqual(ctrl.state.target, [1, 2, 3], 'Panning must shift target');

  // 4. Wheel zoom dollys distance logarithmically
  const dBefore = ctrl.state.dist;
  listeners.get('wheel')({ deltaY: -120, preventDefault: () => {} });
  assert.ok(ctrl.state.dist < dBefore);

  // 5. Double-click resets cleanly back to home target & pose
  listeners.get('dblclick')({});
  assert.deepEqual(ctrl.state.target, [1, 2, 3]);
  assert.equal(ctrl.state.dist, 10.0);
  assert.ok(changes > 0);
  ctrl.dispose();
});
