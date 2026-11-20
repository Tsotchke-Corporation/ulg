import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSphEnvironmentParticles, createSphEnvironmentAirMixtureClosure } from '../src/runtime/sphEnvironmentParticles.js';
import { createSphRoomAirInitialization, SPH_ENVIRONMENT_DRY_AIR } from '../src/runtime/sphEnvironmentInitialization.js';
import { withRoomAirCaloricReference } from '../src/runtime/material/roomAirCaloricReference.js';
import { createReferenceAnchoredMaterialClosure } from '../src/runtime/material/materialDerivation.js';
import { requireFirstPrinciplesMaterialProperties } from '../src/runtime/material/propertyProvenance.js';
import { CONDENSABLE_UNIVERSAL_GAS_CONSTANT_J_PER_MOL_K as R } from '../src/runtime/material/condensableThermodynamics.js';
import { createSphExactMassFormat, decodeSphExactMass } from '../ulg-gpu-abi/src/sphExactMassInventory.js';

// First-class air, slice 3 (plan/todo/first-class-air.md): one mixture parcel
// per air cell, its material an exact ideal-gas mixture of the species closures.
function closures() {
  const out = {};
  for (const material of ['n2', 'o2', 'ar', 'co2', 'h2o']) {
    out[material] = withRoomAirCaloricReference(createReferenceAnchoredMaterialClosure(material, {
      elementOptions: { allowReducedEstimates: false }
    }), material);
  }
  out.air = createSphEnvironmentAirMixtureClosure(out);
  return out;
}

test('the air mixture closure is the exact ideal-gas mixture of its species', () => {
  const resolved = closures();
  const air = resolved.air.properties;
  const species = SPH_ENVIRONMENT_DRY_AIR.species;
  const molarMass = species.reduce((sum, s) => sum + s.moleFraction * resolved[s.material].properties.molarMassKgPerMol, 0);
  const cv = species.reduce((sum, s) => sum + s.moleFraction * resolved[s.material].properties.molarMassKgPerMol / molarMass
    * resolved[s.material].properties.phaseCaloricModel.cvJPerKgK, 0);
  assert.equal(air.molarMassKgPerMol, molarMass);
  assert.ok(Math.abs(air.phaseCaloricModel.cvJPerKgK - cv) <= 1e-12 * cv);
  assert.ok(Math.abs(air.phases[0].cpJPerKgK - (cv + R / molarMass)) <= 1e-12 * cv);
  // Dry air near 293 K and 1 atm: M 28.966 g/mol, gamma 1.400, rho 1.204 kg/m^3.
  assert.ok(Math.abs(molarMass - 0.028966) < 2e-6);
  assert.ok(Math.abs(air.phases[0].cpJPerKgK / cv - 1.4) < 1e-3);
  assert.ok(Math.abs(air.phases[0].densityKgPerM3 - 1.2041) < 1e-3);
  // Mixing-rule transport lies between the components' values.
  const k = species.map((s) => resolved[s.material].properties.phases[0].thermalConductivityWPerMK);
  assert.ok(air.phases[0].thermalConductivityWPerMK > Math.min(...k) && air.phases[0].thermalConductivityWPerMK < Math.max(...k));
  assert.equal(air.formula, null);
  assert.equal(air.idealGasMixture.components.length, 4);
  assert.equal(requireFirstPrinciplesMaterialProperties(air, {
    material: 'air', allowedFallbackSources: ['material-property-reference-bank']
  }), true);
});

test('mixture parcels carry every dry species exactly, one row per cell', () => {
  const resolved = closures();
  const materialProperties = Object.fromEntries(Object.entries(resolved).map(([key, c]) => [key, c.properties]));
  const args = { environment: createSphRoomAirInitialization(), materialProperties, boxDimensionsM: [0.14, 0.14, 0.14],
    occupiedBoxes: [{ min: [0.05, 0, 0.05], max: [0.09, 0.03, 0.09] }], cellsPerAxis: 2 };
  const format = createSphExactMassFormat();
  const units = (words) => decodeSphExactMass(Uint32Array.from(words), format).coefficient;
  const species = buildSphEnvironmentParticles({ ...args, airParcels: 'species' });
  const mixture = buildSphEnvironmentParticles({ ...args, airParcels: 'mixture' });
  const speciesTotals = {};
  for (const p of species.particles) speciesTotals[p.material] = (speciesTotals[p.material] ?? 0n) + units(p.coldExactMassWords);
  const airRows = mixture.particles.filter((p) => p.material === 'air');
  const vaporRows = mixture.particles.filter((p) => p.material === 'h2o');
  assert.equal(airRows.length, species.cells.length);
  assert.equal(vaporRows.length, species.cells.length);
  assert.equal(mixture.particles.length, 2 * species.cells.length);
  const composition = {};
  let airTotal = 0n;
  for (const row of airRows) {
    airTotal += units(row.coldExactMassWords);
    let rowSum = 0n;
    for (const c of row.gasComposition.components) {
      composition[c.material] = (composition[c.material] ?? 0n) + units(c.exactMassWords);
      rowSum += units(c.exactMassWords);
    }
    assert.equal(rowSum, units(row.coldExactMassWords), 'each parcel is the exact sum of its species');
    assert.ok(Math.abs(row.specificInternalEnergyJPerKg
      - resolved.air.properties.phaseCaloricModel.cvJPerKgK * row.temperatureK) < 1e-9 * row.specificInternalEnergyJPerKg);
  }
  for (const s of SPH_ENVIRONMENT_DRY_AIR.species) assert.equal(composition[s.material], speciesTotals[s.material]);
  assert.equal(airTotal, SPH_ENVIRONMENT_DRY_AIR.species.reduce((sum, s) => sum + speciesTotals[s.material], 0n));
  let vaporTotal = 0n;
  for (const row of vaporRows) vaporTotal += units(row.coldExactMassWords);
  assert.equal(vaporTotal, speciesTotals.h2o, 'water vapor stays as its own exact rows');
  assert.throws(() => buildSphEnvironmentParticles({ ...args, airParcels: 'lumped' }), /airParcels/);
});
