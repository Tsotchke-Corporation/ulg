import { CONDENSABLE_THERMODYNAMICS_SCHEMA, createCondensableThermodynamics }
  from '../../src/runtime/material/condensableThermodynamics.js';
import { buildSphThermalMaterialTable } from '../../src/runtime/sph/sphThermalGpuKernel.js';
import { buildSphReactionTable } from '../../src/runtime/sph/sphReactionGpuKernel.js';
import { encodeSphExactMassUnits } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { createSphExactReactionAllocationWgsl } from '../../src/runtime/sph/sphExactReactionAllocationWgsl.js';
import { compileSphExactReactionAllocation, encodeSphExactReactionAllocationWeights,
  selectSphExactReactionAllocation } from '../../src/runtime/sph/sphExactReactionAllocation.js';

// Manufactured data for arithmetic/authority checks; no scientific acceptance.
export function createExactReactionAllocationFixture({ reactionCount = 1, identity = false,
  coefficients = [3, 2], molarMasses = {}, repeatedProducts = true } = {}) {
  const definitions = { h2: ['H2', 0.002], o2: ['O2', 0.032], h2o: ['H2O', 0.018], h2o2: ['H2O2', 0.034] };
  const materialProperties = {}, models = {};
  for (const [material, [formula, defaultMolarMass]] of Object.entries(definitions)) {
    const molarMass = molarMasses[material] ?? defaultMolarMass;
    const parameters = { schema: CONDENSABLE_THERMODYNAMICS_SCHEMA,
      energyBasis: 'specific-enthalpy-at-reference-pressure', referenceTemperatureK: 300,
      referencePressurePa: 3000, liquidReferenceEnthalpyJPerKg: -50000 + 3,
      vaporizationReferenceEnthalpyJPerKg: 2e6, liquidCpJPerKgK: 4000,
      vaporCpJPerKgK: 3000 + 8.314462618 / molarMass, liquidDensityKgPerM3: 1000,
      molarMassKgPerMol: molarMass, minTemperatureK: 200, maxTemperatureK: 500,
      maxPressurePa: 2e6, provenance: 'manufactured exact reaction integer fixture' };
    models[material] = createCondensableThermodynamics(parameters);
    materialProperties[material] = { formula, molarMassKgPerMol: molarMass,
      phases: [{ name: 'liquid', temperatureRange: [0, 400], cpJPerKgK: 4000,
        densityKgPerM3: 1000, bulkModulusPa: 1e8, shearModulusPa: 0 },
      { name: 'gas', temperatureRange: [400, 1000], cpJPerKgK: parameters.vaporCpJPerKgK,
        densityKgPerM3: 3000 * molarMass / (8.314462618 * 300), bulkModulusPa: null, shearModulusPa: 0 }],
      transitions: [{ from: 'liquid', to: 'gas', temperatureK: 400, latentHeatJPerKg: 2e6 }] };
  }
  const reactants = [{ material: 'h2', coefficient: coefficients[0], phaseId: 2 },
    { material: 'o2', coefficient: coefficients[1], phaseId: 2 }];
  const products = identity ? reactants : [{ material: 'h2o', coefficient: 2, phaseId: 2 },
    ...(repeatedProducts ? [{ material: 'h2o2', coefficient: 0.5, phaseId: 3 },
      { material: 'h2o2', coefficient: 0.5, phaseId: 3 }] : [{ material: 'h2o2', coefficient: 1, phaseId: 3 }])];
  const term = item => ({ material: item.material, coefficient: item.coefficient,
    formula: definitions[item.material][0], phase: item.phaseId === 3 ? 'gas' : 'liquid' });
  const reaction = { a: 'h2', b: 'o2', product: products[0].material,
    activationTemperatureK: 0, contactRadiusM: 0.1,
    phaseRequirements: { h2: ['liquid'], o2: ['liquid'] },
    stoichiometry: { reactants: reactants.map(term), products: products.map(term),
      atomBalance: { balanced: true }, chargeBalance: { balanced: true } },
    energyReference: { schema: 'peercompute.ulg.reaction-energy-reference.v1',
      referenceTemperatureK: 300, referencePressurePa: 3000, reactionInternalEnergyChangeJPerMolExtent: 0,
      reactantPhases: reactants, productPhases: products,
      source: { kind: 'manufactured-analytic', provenance: 'exact shared debit arithmetic fixture',
        fingerprint: 'exact-reaction-allocation-fixture-v1', provisional: false, phaseApplicable: true } } };
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties, { condensableThermodynamicsByMaterial: models });
  const reactionTable = buildSphReactionTable(Array.from({ length: reactionCount }, () => structuredClone(reaction)),
    { materialProperties, thermalMaterialTable });
  return { reactionTable, thermalMaterialTable };
}

export function exactReactionAllocationCases(format, compiled) {
  const maximum = (1n << BigInt(32 * format.wordCount)) - 1n;
  const cases = [
    { name: 'zero-cap', availableA: 100n, availableB: 100n, kineticCap: 0n },
    { name: 'zero-required-a', availableA: 0n, availableB: 100n, kineticCap: 100n },
    { name: 'one-quantum-no-event', availableA: 100n, availableB: 100n, kineticCap: 1n },
    { name: 'partial-hidden-remainders', availableA: 101n, availableB: 1003n, kineticCap: 101n },
    { name: 'availability-a', availableA: 3n, availableB: 1000n, kineticCap: 1003n },
    { name: 'availability-b', availableA: 1000n, availableB: 3n, kineticCap: 1003n },
    { name: 'full-width-cap', availableA: maximum / 3n, availableB: maximum - maximum / 3n, kineticCap: maximum },
    { name: 'aggregate-overflow', availableA: maximum, availableB: 1n, kineticCap: 1n }
  ];
  const wa = compiled.reactants[0].weight, wb = compiled.reactants[1].weight;
  if (wa + wb <= maximum) cases.push({ name: 'exact-depletion', availableA: wa, availableB: wb, kineticCap: wa + wb });
  let seed = 0x91f3ad7;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return BigInt(seed >>> 0); };
  const integer = () => { let value = 0n; for (let i = 0; i < format.wordCount; i++) value = (value << 32n) | random(); return value; };
  for (let i = 0; i < 12; i++) {
    const availableA = integer() / 2n, availableB = integer() / 2n;
    cases.push({ name: `random-${i}`, availableA, availableB, kineticCap: integer() });
  }
  return cases;
}

/** Real-device runner, invoked only by the parent's owned native harness.
 * Returns raw words plus BigInt-reference strings for independent assertions.
 * This proves numeric selection, never physical reaction acceptance. */
export async function runExactReactionAllocationNative(device, format,
  { fixture = null, reactionIndex = 0, cases: suppliedCases = null } = {}) {
  fixture ??= createExactReactionAllocationFixture();
  const compiled = compileSphExactReactionAllocation({ ...fixture, reactionIndex, format });
  const cases = suppliedCases ?? exactReactionAllocationCases(format, compiled), n = format.wordCount;
  if (!Array.isArray(cases) || cases.length < 1) throw new TypeError('Native exact reaction exercise requires nonempty cases');
  // Validate all supplied exact integers before allocating real GPU resources.
  const expected = cases.map(row => selectSphExactReactionAllocation(compiled, row));
  const weights = encodeSphExactReactionAllocationWeights(compiled), products = compiled.products.length;
  const input = new Uint32Array(cases.length * 3 * n), stride = 6 * n + 2 + products * (3 * n + 1);
  cases.forEach((row, index) => [row.availableA, row.availableB, row.kineticCap].forEach((value, i) =>
    input.set(encodeSphExactMassUnits(value, format), (index * 3 + i) * n)));
  const code = createSphExactReactionAllocationWgsl(format) + `
@group(0) @binding(0) var<storage, read> er_inputs: array<u32>;
@group(0) @binding(1) var<storage, read> er_weights: array<u32>;
@group(0) @binding(2) var<storage, read_write> er_outputs: array<u32>;
fn er_load_input(offset: u32) -> ExactMass {
  var value: ExactMass; for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = er_inputs[offset + i]; } return value;
}
fn er_load_weight(offset: u32) -> ExactMass {
  var value: ExactMass; for (var i = 0u; i < EM_WORDS; i++) { value.words[i] = er_weights[offset + i]; } return value;
}
fn er_store_output(offset: u32, value: ExactMass) {
  for (var i = 0u; i < EM_WORDS; i++) { er_outputs[offset + i] = value.words[i]; }
}
@compute @workgroup_size(1)
fn exercise_reaction_allocation(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${cases.length}u) { return; }
  let base = id.x * ${3 * n}u; let out = id.x * ${stride}u;
  let selected = er_select_debits(er_load_input(base), er_load_input(base + EM_WORDS),
    er_load_input(base + 2u * EM_WORDS), er_load_weight(8u), er_load_weight(8u + EM_WORDS));
  er_store_output(out, selected.total); er_store_output(out + EM_WORDS, selected.debit_a);
  er_store_output(out + 2u * EM_WORDS, selected.debit_b); er_store_output(out + 3u * EM_WORDS, selected.remainder_a);
  er_store_output(out + 4u * EM_WORDS, selected.remainder_b);
  // Sixth record records the source sum only when its checked addition fits.
  let sum = em_add(er_load_input(base), er_load_input(base + EM_WORDS));
  er_store_output(out + 5u * EM_WORDS, sum.value);
  er_outputs[out + 6u * EM_WORDS] = selected.error; er_outputs[out + 6u * EM_WORDS + 1u] = selected.executed;
  for (var term = 0u; term < ${products}u; term++) {
    let weight = 8u + 3u * EM_WORDS + term * (4u + 2u * EM_WORDS);
    let product = er_product_share(selected, er_load_weight(weight + 4u), er_load_weight(weight + 4u + EM_WORDS), er_load_weight(8u + 2u * EM_WORDS));
    let output_offset = out + 6u * EM_WORDS + 2u + term * (3u * EM_WORDS + 1u);
    er_store_output(output_offset, product.mass); er_store_output(output_offset + EM_WORDS, product.from_a);
    er_store_output(output_offset + 2u * EM_WORDS, product.from_b); er_outputs[output_offset + 3u * EM_WORDS] = product.error;
  }
}`;
  const resources = [];
  const allocate = (size, usage) => { const buffer = device.createBuffer({ size, usage }); resources.push(buffer); return buffer; };
  let mapped = null;
  try {
    const module = device.createShaderModule({ code });
    const messages = (await module.getCompilationInfo()).messages.filter(message => message.type === 'error');
    if (messages.length) throw new Error(messages.map(message => `${message.lineNum}: ${message.message}`).join('\n'));
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'exercise_reaction_allocation' } });
    const source = allocate(input.byteLength, 128 | 4 | 8), metadata = allocate(weights.byteLength, 128 | 4 | 8);
    const output = allocate(cases.length * stride * 4, 128 | 4);
    const readback = allocate(source.size + metadata.size + output.size, 1 | 8);
    device.queue.writeBuffer(source, 0, input); device.queue.writeBuffer(metadata, 0, weights);
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
      [source, metadata, output].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(cases.length); pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, output.size);
    encoder.copyBufferToBuffer(source, 0, readback, output.size, source.size);
    encoder.copyBufferToBuffer(metadata, 0, readback, output.size + source.size, metadata.size);
    device.queue.submit([encoder.finish()]); await readback.mapAsync(1); mapped = readback;
    const words = new Uint32Array(readback.getMappedRange()).slice(); readback.unmap(); mapped = null;
    await device.queue.onSubmittedWorkDone();
    const stringify = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? String(item) : item));
    return { wordCount: n, stride, productCount: products, physicalPublicationAdmitted: false,
      sourceUnchanged: input.every((word, index) => word === words[output.size / 4 + index]),
      weightsUnchanged: weights.every((word, index) => word === words[(output.size + source.size) / 4 + index]),
      weights: Array.from(weights), products: stringify(compiled.products),
      cases: cases.map((row, index) => ({ ...stringify(row), expected: stringify(expected[index]),
        words: Array.from(words.subarray(index * stride, (index + 1) * stride)) })) };
  } finally {
    if (mapped) mapped.unmap();
    await device.queue.onSubmittedWorkDone();
    for (const resource of resources) resource.destroy();
  }
}
