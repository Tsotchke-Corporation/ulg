import { evaluateCondensableThermodynamics } from '../../src/runtime/material/condensableThermodynamics.js';

// Independent double-precision equations on observed ORIGINAL source states.
// Observations are used only after the production dispatch, never as inputs.
export function inspectExactVaporRates({ edges, models, material, rateModels, before, layout,
  parcels, cellPressure, rateWords, dtSeconds, observedInterval, gasStates = null, gasStride = layout.rowWords }) {
  const actual = new Float32Array(rateWords.buffer), gas = gasStates ?? new Float32Array(before.buffer);
  const failures = [], values = [];
  if (dtSeconds !== observedInterval || dtSeconds === Math.fround(dtSeconds)) failures.push('original binary64 interval');
  for (const [index, edge] of edges.entries()) {
    const a = edge.parcelIndex * 24, g = edge.gasIndex * gasStride;
    const liquidName = material.materials.find((name, row) => material.records[row * 16] === new Uint32Array(parcels.buffer)[a + 12]);
    const thermo = models[liquidName], law = rateModels[liquidName], gasName = material.materials[edge.materialRow];
    const tl = parcels[a + 8], tv = gas[16], tg = gas[g + 16], volume = cellPressure.gases[`g:1:${edge.gasIndex}`].freeVolume;
    const population = BigInt(new Uint32Array(parcels.buffer)[a + 14]) + (BigInt(new Uint32Array(parcels.buffer)[a + 15]) << 32n);
    const area = 4 * Math.PI * Number(population) * parcels[a + 10] ** 2;
    let pressure = 0, pv = 0, speciesMass = 0;
    for (let row = 0; row < 3; row++) {
      const c = row * gasStride, name = row === 0 ? 'h2o' : 'h2o2';
      const mm = material.records[material.materials.indexOf(name) * 16 + 1];
      const p = gas[c + 13] / mm * Math.fround(8.31446261815324) * gas[c + 16] / volume;
      pressure += p; if (name === liquidName) pv += p;
      if (name === gasName) speciesMass += gas[c + 13];
    }
    const lrow = material.materials.indexOf(liquidName) * 16;
    const sigma = material.records[lrow + 9] + material.records[lrow + 10] * tl;
    const liquidPressure = pressure * cellPressure.weights[index] + 2 * sigma / parcels[a + 10];
    const equilibrium = evaluateCondensableThermodynamics(thermo, { temperatureK: tl, totalPressurePa: liquidPressure });
    const x = (tv - tl) / tl;
    let thermal = 0;
    for (let k = 3; k <= 9; k++) thermal += (k % 2 ? 1 : -1) * (0.5 - 1 / k) * x ** k;
    const affinity = thermo.specificGasConstantJPerKgK * Math.log(pv / equilibrium.equilibriumPressurePa)
      + thermo.vaporCpJPerKgK * thermal;
    const share = gas[g + 13] / speciesMass;
    const dm = gasName === liquidName ? area * law.massMobilityPerAreaKg2KPerJsM2 * affinity * share : 0;
    const mean = (tl + tv) / 2;
    const h = thermo.vaporReferenceInternalEnergyJPerKg + thermo.vaporCvJPerKgK * (mean - thermo.referenceTemperatureK)
      + thermo.specificGasConstantJPerKgK * mean;
    const correction = dm * (h - (dm < 0 ? parcels[a + 7] : gas[g + 19]));
    const heat = area * law.heatTransferCoefficientsWPerM2K[gasName] * (tg - tl) * share;
    const expected = [dm, correction, heat, 0], got = [...actual.slice(index * 8 + 4, index * 8 + 8)];
    // f32 transcendental/geometry evaluation budget; exact packet/inventory
    // checks separately require equality and do not use this rate tolerance.
    expected.forEach((value, lane) => {
      if (!Number.isFinite(got[lane]) || Math.abs(got[lane] - value) > Math.abs(value) * 0.002 + 1e-20) {
        failures.push(`edge${index}:rate${lane}:${got[lane]} != ${value}`);
      }
    });
    values.push({ affinity, expected, actual: got });
  }
  return { pass: failures.length === 0, failures, values, dtSeconds };
}
