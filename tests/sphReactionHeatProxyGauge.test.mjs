// G2 gauge-consistent heat proxy (sphReactionHeatProxyGauge.js), on the actual
// Iron Ice room-air chemistry: mixed caloric gauges (room-air O2/N2 at u = cv T,
// legacy Fe/FeO/Fe3N2 segments) get per-product offsets that make the proxy
// heat apply at T_ref with each gauge's zero cancelled; single-gauge tables are
// untouched.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphPhaseDemo } from '../src/runtime/sphPhaseDemo.js';
import { createSphRoomAirInitialization } from '../src/runtime/sphEnvironmentInitialization.js';
import { buildSphThermalMaterialTable, resolveThermalResponseGraphArtifacts } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { buildSphReactionTable } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { phaseCurves, sampleCurve } from '../src/runtime/sph/sphReactionEnergyAuthority.js';
import { hasCondensableCaloricRows } from '../src/runtime/sph/sphCondensableCaloricTable.js';
import { sphReactionHeatProxyGaugeAdmits, SPH_REACTION_HEAT_PROXY_REFERENCE_TEMPERATURE_K as T_REF }
  from '../src/runtime/sph/sphReactionHeatProxyGauge.js';

const { demo } = createSphPhaseDemo({ environment: createSphRoomAirInitialization(),
  environmentCellsPerAxis: 1, allowReducedProductProperties: true });
const thermalMaterialTable = buildSphThermalMaterialTable(demo.materialProperties);
const table = buildSphReactionTable(demo.reactions, { materialProperties: demo.materialProperties,
  thermalMaterialTable, contactRadiusM: 0.01 });

test('room-air Iron Ice mixes gauges and gets a gauge-consistent heat proxy', () => {
  assert.equal(hasCondensableCaloricRows(thermalMaterialTable), true);
  assert.ok(table.heatProxyGauge, 'gauge attached');
  assert.equal(table.heatProxyGauge.referenceTemperatureK, T_REF);
  assert.equal(sphReactionHeatProxyGaugeAdmits(table, thermalMaterialTable), true);
  assert.equal(table.energyAuthority, undefined, 'the heat-proxy law is kept');
  const equations = table.metadata.map((m) => `${m.a}+${m.b}`);
  assert.ok(equations.includes('fe+o2'));
});

test('at T_ref the products receive exactly the proxy heat as sensible energy, in every gauge', () => {
  const artifacts = resolveThermalResponseGraphArtifacts({ thermalMaterialTable, requireExactContent: true });
  for (const entry of table.heatProxyGauge.reactions) {
    const r = entry.reactionIndex;
    const h = table.records[r * 12 + 4];
    // Reactants at T_ref carry u_r = uRef_r; the legacy proxy averages them.
    const reactantTerms = table.reactantTermMetadata.filter((t) => t.reactionIndex === r);
    let mass = 0, energy = 0;
    reactantTerms.forEach((t, k) => {
      const row = table.reactantTermRecords.subarray(t.reactantTermIndex * 12, t.reactantTermIndex * 12 + 12);
      mass += row[2] * row[3];
      energy += row[2] * row[3] * entry.reactants[k].uRef;
    });
    const legacyU = (energy - h * mass) / mass;
    for (const product of entry.products) {
      const index = table.productTermMetadata.find((t) => t.reactionIndex === r && t.material === product.material).productTermIndex;
      const gauge = table.productTermRecords[index * 16 + 15];
      const productU = legacyU + gauge;
      // Sensible energy above T_ref in the product's own gauge equals -h.
      const sensible = productU - product.uRef;
      assert.ok(Math.abs(sensible - (-h)) <= 1e-6 * Math.abs(h) + 1, `${product.material}: ${sensible} vs ${-h}`);
      // The uRef really is the runtime graph at T_ref.
      const curve = phaseCurves(artifacts, product.materialId).find((c) => c.phaseId === product.phaseId);
      assert.equal(Math.fround(sampleCurve(curve, T_REF, true)), Math.fround(product.uRef));
      // The GPU reads the same word from the combined records.
      const base = table.records.length + table.productPhaseRecords.length + table.reactionHeaders.length
        + table.reactantTermRecords.length;
      assert.equal(table.combinedRecords[base + index * 16 + 15], gauge);
    }
  }
});

test('single-gauge tables are unchanged and copies are not admitted', () => {
  const { demo: plain } = createSphPhaseDemo({ allowReducedProductProperties: true });
  const plainThermal = buildSphThermalMaterialTable(plain.materialProperties);
  const plainTable = buildSphReactionTable(plain.reactions, { materialProperties: plain.materialProperties,
    thermalMaterialTable: plainThermal, contactRadiusM: 0.01 });
  if (!hasCondensableCaloricRows(plainThermal)) {
    assert.equal(plainTable.heatProxyGauge, undefined);
    for (let i = 15; i < plainTable.productTermRecords.length; i += 16) assert.equal(plainTable.productTermRecords[i], 0);
  }
  const copy = { ...table, combinedRecords: Float32Array.from(table.combinedRecords) };
  copy.combinedRecords[0] += 1;
  assert.equal(sphReactionHeatProxyGaugeAdmits(copy, thermalMaterialTable), false);
});

test('a structured-clone copy is re-derived and admitted; tampered offsets are refused', async () => {
  const { importSphReactionHeatProxyGauge } = await import('../src/runtime/sph/sphReactionHeatProxyGauge.js');
  const clone = structuredClone(table);
  assert.equal(sphReactionHeatProxyGaugeAdmits(clone, thermalMaterialTable), false, 'a copy is not issued');
  const imported = importSphReactionHeatProxyGauge(clone, thermalMaterialTable);
  assert.equal(sphReactionHeatProxyGaugeAdmits(imported, thermalMaterialTable), true);
  assert.deepEqual(Array.from(imported.combinedRecords), Array.from(table.combinedRecords));
  const tampered = structuredClone(table);
  const base = tampered.records.length + tampered.productPhaseRecords.length + tampered.reactionHeaders.length
    + tampered.reactantTermRecords.length;
  tampered.combinedRecords[base + 15] += 1000;
  assert.throws(() => importSphReactionHeatProxyGauge(tampered, thermalMaterialTable), /do not match/);
});
