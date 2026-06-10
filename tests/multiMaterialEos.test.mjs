import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReferenceMaterialClosures } from '../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../src/runtime/material/thermoState.js';
import { createPhaseAwareEos } from '../src/runtime/sph/multiMaterialEos.js';

const closures = createReferenceMaterialClosures();
const materialProperties = { fe: closures.fe.properties, h2o: closures.h2o.properties };
const eos = createPhaseAwareEos(materialProperties);

// Energies that place a particle squarely in a given phase.
const liquidWaterU = specificInternalEnergyJPerKg(materialProperties.h2o, 300); // 27 C liquid
const steamU = specificInternalEnergyJPerKg(materialProperties.h2o, 450); // > boiling -> gas
const moltenIronU = specificInternalEnergyJPerKg(materialProperties.fe, 1850); // liquid iron

test('condensed water at its rest density carries ~zero pressure (incompressible reference)', () => {
  const p = eos({ density: 1000, specificInternalEnergyJPerKg: liquidWaterU, particle: { material: 'h2o' } });
  assert.ok(Math.abs(p.pressurePa) < 1e3); // rho == rho0 -> p ~ 0
  assert.ok(p.soundSpeedMPerS > 0);
});

test('compressing condensed water raises pressure steeply (Tait)', () => {
  const p = eos({ density: 1050, specificInternalEnergyJPerKg: liquidWaterU, particle: { material: 'h2o' } });
  assert.ok(p.pressurePa > 1e6); // 5% compression -> strong restoring pressure
});

test('molten iron is pinned near its liquid rest density, not puffed up like a gas', () => {
  const atRest = eos({ density: 7000, specificInternalEnergyJPerKg: moltenIronU, particle: { material: 'fe' } });
  assert.ok(Math.abs(atRest.pressurePa) < 1e3); // huge internal energy does NOT create gas-like pressure
});

test('just-vaporized (liquid-packed) steam carries a large positive pressure that drives expansion', () => {
  const packed = eos({ density: 1000, specificInternalEnergyJPerKg: steamU, particle: { material: 'h2o' } });
  assert.ok(packed.pressurePa > 1e6); // rho >> rho0_gas (~0.8) -> expansion drive
  // Once expanded to near the gas rest density, the drive vanishes.
  const expanded = eos({ density: 0.804, specificInternalEnergyJPerKg: steamU, particle: { material: 'h2o' } });
  assert.ok(expanded.pressurePa < 1e3);
  assert.ok(packed.pressurePa > expanded.pressurePa);
});
