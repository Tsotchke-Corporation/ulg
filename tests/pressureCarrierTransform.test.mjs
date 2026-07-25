import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU,
  PRESSURE_CARRIER_LAW_REFERENCE_ONLY,
  carrierFromPhysicalEnergy,
  isReferencePressure,
  physicalEnergyFromCarrier,
  resolvePressurePlateau
} from '../src/runtime/material/pressureCarrierTransform.js';

// Water-like plateau at one atmosphere.
const BASE = {
  anchorEnergyJPerKg: 0,
  anchorTemperatureK: 273.15,
  plateauStartJPerKg: 4184 * (373.15 - 273.15),
  plateauEndJPerKg: 4184 * (373.15 - 273.15) + 2.257e6,
  referenceTemperatureK: 373.15,
  referencePressurePa: 101325,
  latentHeatJPerKg: 2.257e6,
  molarMassKgPerMol: 0.018015
};

test('reference pressure is an exact identity decided on f32 bits', () => {
  assert.equal(isReferencePressure(101325, 101325), true);
  // A difference far below f32 resolution at this magnitude is the same float.
  assert.equal(isReferencePressure(101325.000000001, 101325), true);
  assert.equal(isReferencePressure(101326, 101325), false);

  const plateau = resolvePressurePlateau({
    ...BASE,
    absolutePressurePa: 101325
  });
  assert.equal(plateau.identity, true);
  assert.equal(plateau.lawId, PRESSURE_CARRIER_LAW_REFERENCE_ONLY);
  // Identity must be bitwise, not merely close: the old path runs unchanged.
  for (const energy of [-1e5, 0, 1234.5, BASE.plateauStartJPerKg, 5e6]) {
    assert.equal(carrierFromPhysicalEnergy(plateau, energy), energy);
    assert.equal(physicalEnergyFromCarrier(plateau, energy), energy);
  }
});

test('lower pressure lowers the boil and moves the plateau down', () => {
  const plateau = resolvePressurePlateau({
    ...BASE,
    absolutePressurePa: 50000
  });
  assert.equal(plateau.identity, false);
  assert.equal(plateau.lawId, PRESSURE_CARRIER_LAW_CLAUSIUS_PLATEAU);
  assert.ok(
    plateau.shiftedTemperatureK < BASE.referenceTemperatureK,
    `half an atmosphere must boil below 373.15 K, got ${plateau.shiftedTemperatureK}`
  );
  assert.ok(plateau.shiftedPlateauStartJPerKg < BASE.plateauStartJPerKg);
  // The latent span itself is a material property and does not move.
  const referenceSpan = BASE.plateauEndJPerKg - BASE.plateauStartJPerKg;
  const shiftedSpan =
    plateau.shiftedPlateauEndJPerKg - plateau.shiftedPlateauStartJPerKg;
  assert.ok(Math.abs(shiftedSpan - referenceSpan) <= 1e-6 * referenceSpan);
});

test('higher pressure raises the boil and moves the plateau up', () => {
  const plateau = resolvePressurePlateau({
    ...BASE,
    absolutePressurePa: 2 * 101325
  });
  assert.ok(plateau.shiftedTemperatureK > BASE.referenceTemperatureK);
  assert.ok(plateau.shiftedPlateauStartJPerKg > BASE.plateauStartJPerKg);
});

test('carrier map is continuous, monotone, and exactly invertible', () => {
  for (const pressurePa of [20000, 50000, 101325, 2e5, 5e5]) {
    const plateau = resolvePressurePlateau({
      ...BASE,
      absolutePressurePa: pressurePa
    });
    assert.ok(plateau, `plateau must resolve at ${pressurePa} Pa`);

    const E0s = plateau.shiftedPlateauStartJPerKg;
    const E1s = plateau.shiftedPlateauEndJPerKg;
    const samples = [
      -5e4, 0, 1e4, E0s * 0.5, E0s - 1, E0s, (E0s + E1s) / 2,
      E1s, E1s + 1, E1s + 1e6
    ].filter((value) => Number.isFinite(value));

    let previousCarrier = -Infinity;
    for (const energy of samples) {
      const carrier = carrierFromPhysicalEnergy(plateau, energy);
      assert.ok(Number.isFinite(carrier));
      assert.ok(
        carrier >= previousCarrier,
        `carrier must be monotone at ${pressurePa} Pa (${energy})`
      );
      previousCarrier = carrier;

      // Round trip must return the physical energy to a relative epsilon.
      const roundTrip = physicalEnergyFromCarrier(plateau, carrier);
      const scale = Math.max(1, Math.abs(energy));
      assert.ok(
        Math.abs(roundTrip - energy) <= 1e-9 * scale,
        `round trip failed at ${pressurePa} Pa: ${energy} -> ${carrier} -> ${roundTrip}`
      );
    }

    // Breakpoints line up: the shifted plateau maps onto the reference plateau.
    assert.ok(
      Math.abs(carrierFromPhysicalEnergy(plateau, E0s) - plateau.plateauStartJPerKg)
        <= 1e-6 * Math.max(1, plateau.plateauStartJPerKg)
    );
    assert.ok(
      Math.abs(carrierFromPhysicalEnergy(plateau, E1s) - plateau.plateauEndJPerKg)
        <= 1e-6 * Math.max(1, plateau.plateauEndJPerKg)
    );
  }
});

test('the plateau spans the full latent heat at every admitted pressure', () => {
  for (const pressurePa of [30000, 101325, 3e5]) {
    const plateau = resolvePressurePlateau({
      ...BASE,
      absolutePressurePa: pressurePa
    });
    const start = carrierFromPhysicalEnergy(
      plateau,
      plateau.shiftedPlateauStartJPerKg
    );
    const end = carrierFromPhysicalEnergy(
      plateau,
      plateau.shiftedPlateauEndJPerKg
    );
    assert.ok(
      Math.abs((end - start) - BASE.latentHeatJPerKg) <= 1e-6 * BASE.latentHeatJPerKg,
      `latent span must survive the transform at ${pressurePa} Pa`
    );
  }
});

test('malformed, nonpositive, and nonfinite pressure fail closed', () => {
  const bad = [
    { absolutePressurePa: 0 },
    { absolutePressurePa: -1 },
    { absolutePressurePa: Number.NaN },
    { absolutePressurePa: Number.POSITIVE_INFINITY },
    { absolutePressurePa: 5e4, referencePressurePa: 0 },
    { absolutePressurePa: 5e4, latentHeatJPerKg: 0 },
    { absolutePressurePa: 5e4, molarMassKgPerMol: -1 },
    { absolutePressurePa: 5e4, referenceTemperatureK: 0 },
    // Plateau below the anchor is not a monotone ladder.
    { absolutePressurePa: 5e4, plateauStartJPerKg: -1 },
    // Reference temperature at or below the anchor gives no heat capacity.
    { absolutePressurePa: 5e4, anchorTemperatureK: 373.15 }
  ];
  for (const override of bad) {
    assert.equal(
      resolvePressurePlateau({ ...BASE, ...override }),
      null,
      `must fail closed: ${JSON.stringify(override)}`
    );
  }
  // There is no implicit one-atmosphere fallback for a missing pressure.
  assert.equal(resolvePressurePlateau({ ...BASE }), null);
  assert.equal(resolvePressurePlateau(), null);
  // A null plateau must not silently transform anything.
  assert.equal(carrierFromPhysicalEnergy(null, 5), null);
  assert.equal(physicalEnergyFromCarrier(null, 5), null);
});

test('non-finite energies do not produce a carrier', () => {
  const plateau = resolvePressurePlateau({ ...BASE, absolutePressurePa: 5e4 });
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 'x']) {
    assert.equal(carrierFromPhysicalEnergy(plateau, value), null);
    assert.equal(physicalEnergyFromCarrier(plateau, value), null);
  }
});

test('the transfer shader will not read the pressure lane without declared authority', async () => {
  const { sphPhaseCarrierTransferWgsl } = await import(
    '../src/runtime/sph/sphPhaseCarrierTransferGpu.js'
  );
  // Mechanics lane 28 currently carries a depth-derived hydrostatic *gauge*
  // prestress, not an absolute pressure. Reading a gauge value as absolute
  // would place deep water at a few kPa absolute and boil it, so the shader
  // must refuse the whole plateau until the host declares otherwise. This
  // pins the guard rather than the comment.
  const guard = sphPhaseCarrierTransferWgsl.match(
    /fn carrier_plateau_for[\s\S]*?\n}/
  );
  assert.ok(guard, 'carrier_plateau_for must exist');
  assert.match(
    guard[0],
    /params\.absolute_pressure_authority == 0u\)\s*\{\s*return ulg_pressure_plateau_invalid\(\);/,
    'the authority check must fail the plateau closed before any lookup'
  );
  // And it must come before the material-record scan, not after it.
  assert.ok(
    guard[0].indexOf('absolute_pressure_authority')
      < guard[0].indexOf('material_record_count'),
    'the authority check must precede the carrier-law lookup'
  );
});
