import assert from 'node:assert/strict';
import test from 'node:test';
import { createSphPhaseDemo } from '../src/runtime/sphPhaseDemo.js';
import { createSphRoomAirInitialization } from '../src/runtime/sphEnvironmentInitialization.js';
import { buildSphThermalMaterialTable } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { assertSphReactionEnergyAuthority } from '../src/runtime/sph/sphReactionEnergyAuthority.js';
import { buildSphReferenceReactionTable, importSphReferenceReactionTableColdInput }
  from '../src/runtime/sph/sphReferenceReactionTable.js';
import { standardFormationEnthalpyReference } from '../src/runtime/chemistry/standardFormationEnthalpy.js';
import { createSchroederTargetScheduleTableFingerprints }
  from '../src/runtime/sph/schroederTargetScheduleAuthority.js';

const { demo } = createSphPhaseDemo({ environment: createSphRoomAirInitialization(),
  environmentCellsPerAxis: 1, environmentAirParcels: 'species', allowReducedProductProperties: true });
const thermalMaterialTable = buildSphThermalMaterialTable(demo.materialProperties);
const options = { materialProperties: demo.materialProperties, thermalMaterialTable, contactRadiusM: 0.01 };
const table = buildSphReferenceReactionTable(demo.reactions, options);

test('actual Iron Ice oxygen chemistry has a phase-specific reference; unresolved candidates remain visible', () => {
  assert.equal(table.reactionCount, 1);
  assert.equal(table.metadata[0].a, 'fe');
  assert.equal(table.metadata[0].b, 'o2');
  assert.equal(table.productTermMetadata[0].material, 'feo');
  assert.equal(assertSphReactionEnergyAuthority(table, thermalMaterialTable), true);
  assert.equal(table.energyAdmission.candidateCount, demo.reactions.length);
  assert.ok(table.energyAdmission.rows.some(row => row.equation === '3 Fe + N2 -> Fe3N2'
    && row.status === 'unresolved-energy-reference'));
  assert.equal(table.energyAuthority.scientificValidation, false);
  assert.equal(table.energyMetadata[0].source.kind, 'reference-thermochemistry');
  // Slice 2.1: bank-anchored FeO carries solid/liquid/gas phases and compiles
  // against its standard-state 298.15 K solid NIST-JANAF reference (Fe-018.html).
  assert.match(table.energyMetadata[0].source.provenance, /Fe-018\.html/);
  const r = table.coldReferenceRecipe.reactions.find(row => row.product === 'feo');
  assert.ok(r.specificEnthalpyJPerKg < 0); // original discovery record is retained
  assert.equal(table.records[4], 0); // no second, legacy heat release
  // Independent JANAF values, with distinct solid/liquid energy references.
  assert.equal(standardFormationEnthalpyReference('FeO', 'solid').standardFormationEnthalpyJPerMol, -272044);
  assert.equal(standardFormationEnthalpyReference('FeO', 'liquid').standardFormationEnthalpyJPerMol, -249532);
  assert.equal(standardFormationEnthalpyReference('FeO', 'gas'), null);
});

test('worker compiles its own original law authority and rejects inconsistent serialized tables', () => {
  const copy = structuredClone(table), thermal = structuredClone(thermalMaterialTable);
  assert.throws(() => assertSphReactionEnergyAuthority(copy, thermal), /unissued or copied/);
  const local = importSphReferenceReactionTableColdInput(copy, thermal);
  assert.notEqual(local, table);
  assert.equal(assertSphReactionEnergyAuthority(local, thermal), true);
  assert.equal(importSphReferenceReactionTableColdInput(structuredClone(table), thermal, local), local);
  const watch = value => createSchroederTargetScheduleTableFingerprints({
    residentStepOptions: { reactionTable: value, thermalMaterialTable: thermal }, executingReactionActive: true
  });
  assert.deepEqual(watch(local), watch(table));
  assert.deepEqual(watch(copy), watch(table));
  const tokenOnly = structuredClone(table);
  delete tokenOnly.coldReferenceRecipe;
  assert.throws(() => watch(tokenOnly), /unissued or copied/);
  const changed = structuredClone(table);
  changed.combinedRecords[changed.combinedRecords.length - 3] += 1;
  assert.throws(() => importSphReferenceReactionTableColdInput(changed, thermal), /does not match/);
  const recipeChanged = structuredClone(table);
  recipeChanged.coldReferenceRecipe.options.contactRadiusM *= 2;
  assert.throws(() => importSphReferenceReactionTableColdInput(recipeChanged, thermal), /does not match/);
});

test('an unsupported discovery catalog cannot claim no chemistry or acquire invented reference authority', () => {
  const nitride = demo.reactions.filter(row => row.product === 'fe3n2');
  assert.equal(nitride.length, 1);
  assert.throws(() => buildSphReferenceReactionTable(nitride, options), /No reaction candidate/);
  const promised = { ...demo.reactions[0], energyReference: { schema: 'invented' } };
  assert.throws(() => buildSphReferenceReactionTable([promised], options), /unknown reference schema/);
});
