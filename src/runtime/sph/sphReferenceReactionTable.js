import { standardFormationEnthalpyReference, standardReactionEnthalpyReference }
  from '../chemistry/standardFormationEnthalpy.js';
import { buildSphReactionTable } from './sphReactionGpuKernel.js';
import { SPH_REACTION_ENERGY_REFERENCE_SCHEMA, assertSphReactionEnergyAuthority }
  from './sphReactionEnergyAuthority.js';
import { importSphReactionHeatProxyGauge } from './sphReactionHeatProxyGauge.js';

const RECIPE_SCHEMA = 'peercompute.ulg.reference-reaction-cold-recipe.v1';
const PHASES = [null, 'solid', 'liquid', 'gas'];

function materialPropertiesForKey(materialProperties = {}, key = '') {
  if (!materialProperties || !key) return null;
  if (Object.hasOwn(materialProperties, key)) return materialProperties[key];
  const lower = String(key).toLowerCase();
  if (Object.hasOwn(materialProperties, lower)) return materialProperties[lower];
  for (const [candidateKey, properties] of Object.entries(materialProperties)) {
    if (String(candidateKey).toLowerCase() === lower) return properties;
  }
  return null;
}

function referenceReaction(reaction, options) {
  if (reaction.energyReference !== undefined) return reaction;
  // Resolve formula aliases and product routing with the same compiler that
  // will own the executable table. Omit thermalMaterialTable during term
  // inspection so multi-phase condensable products are not pre-rejected by
  // the heat-proxy gauge before energyReference is attached and validated.
  const terms = buildSphReactionTable([reaction], { ...options, thermalMaterialTable: null });
  const side = (kind) => terms[`${kind}TermMetadata`].map(term => {
    const phases = materialPropertiesForKey(options.materialProperties, term.material)?.phases ?? [];
    const standard = standardFormationEnthalpyReference(term.formula);
    const phase = kind === 'product' ? PHASES[term.targetPhasePolicyId]
      : standard?.phase;
    if (!phase || !phases.some(p => p.name === phase)) {
      throw new TypeError(`no compatible reference phase for ${term.formula}`);
    }
    return { material: term.material, formula: term.formula, coefficient: term.coefficient, phase };
  });
  const reactants = side('reactant'), products = side('product');
  const reference = standardReactionEnthalpyReference({
    equation: reaction.stoichiometry?.equation, reactants, products
  });
  if (!reference) throw new TypeError('phase-specific formation enthalpy reference unavailable');
  const referenceTerms = [...reference.reactantRecords, ...reference.productRecords];
  const phaseRows = rows => rows.map(({ material, coefficient, phase }) => ({
    material, coefficient, phaseId: PHASES.indexOf(phase)
  }));
  return {
    ...reaction,
    specificEnthalpyJPerKg: 0,
    energyReference: {
      schema: SPH_REACTION_ENERGY_REFERENCE_SCHEMA,
      referenceTemperatureK: reference.temperatureK,
      referencePressurePa: reference.pressurePa,
      reactionEnthalpyChangeJPerMolExtent: reference.reactionEnthalpyJPerBalancedEquation,
      reactantPhases: phaseRows(reactants), productPhases: phaseRows(products),
      source: {
        kind: 'reference-thermochemistry', fingerprint: reference.fingerprint,
        provenance: referenceTerms.map(({ formula, reference: row }) =>
          `${formula}(${row.phase}): ${row.sourceUrl}${row.referenceBranch ? ` [${row.referenceBranch}]` : ''}`).join('; '),
        provisional: false,
        // The authority compiler below independently verifies this against
        // the original pure-phase graph at the reference temperature.
        phaseApplicable: true
      }
    }
  };
}

/** Cold catalog admission. A heuristic discovery candidate is not executable
 * thermochemistry. Preserve every rejected candidate and its reason; never
 * manufacture an energy reference from the old per-kg heat proxy.
 */
export function buildSphReferenceReactionTable(reactions, options) {
  const admitted = [], admission = [];
  for (const [sourceReactionIndex, reaction] of reactions.entries()) {
    let prepared;
    try {
      prepared = referenceReaction(reaction, options);
      const checked = buildSphReactionTable([prepared], options);
      if (!assertSphReactionEnergyAuthority(checked, options.thermalMaterialTable)) {
        throw new TypeError('reference did not compile to an energy contract');
      }
    } catch (error) {
      // An explicitly supplied contract is a promise, not an optional discovery
      // candidate. Malformed caller contracts must continue to reject.
      if (reaction.energyReference !== undefined) throw error;
      admission.push({ sourceReactionIndex, equation: reaction.stoichiometry?.equation ?? null,
        status: 'unresolved-energy-reference', reason: error.message });
      continue;
    }
    admission.push({ sourceReactionIndex, reactionIndex: admitted.length,
      equation: reaction.stoichiometry?.equation ?? null, status: 'reference-compiled' });
    admitted.push(prepared);
  }
  // An unresolved catalog cannot masquerade as conclusive no chemistry.
  if (reactions.length && !admitted.length) {
    throw new TypeError(`No reaction candidate has a compatible energy reference: ${admission.map(row => `${row.equation}: ${row.reason}`).join('; ')}`);
  }
  const table = buildSphReactionTable(admitted, options);
  table.energyAdmission = { candidateCount: reactions.length, admittedCount: admitted.length,
    unresolvedCount: reactions.length - admitted.length, rows: admission, scientificValidation: false };
  const { thermalMaterialTable, ...recipeOptions } = options;
  table.coldReferenceRecipe = structuredClone({ schema: RECIPE_SCHEMA, reactions, options: recipeOptions });
  return table;
}

function equalData(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    if (left.constructor !== right.constructor || left.byteLength !== right.byteLength) return false;
    const a = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
    const b = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
    return a.every((value, i) => value === b[i]);
  }
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && equalData(left[key], right[key]));
}

/** Compile original worker-local authority from cold law inputs. Serialized
 * tokens alone remain invalid, and all received table bytes must match the
 * result. No particle or continuing inventory ownership is issued here.
 */
export function importSphReferenceReactionTableColdInput(incoming, thermalMaterialTable, previous = null) {
  // A gauge-consistent heat-proxy table is re-derived and byte-checked the
  // same way (sphReactionHeatProxyGauge.js); plain tables pass through.
  if (!incoming?.coldReferenceRecipe) return importSphReactionHeatProxyGauge(incoming, thermalMaterialTable, previous);
  if (previous?.coldReferenceRecipe && equalData(incoming, previous)) {
    assertSphReactionEnergyAuthority(previous, thermalMaterialTable);
    return previous;
  }
  const recipe = incoming.coldReferenceRecipe;
  if (recipe.schema !== RECIPE_SCHEMA || !Array.isArray(recipe.reactions)) {
    throw new TypeError('Invalid cold reference reaction recipe');
  }
  const rebuilt = buildSphReferenceReactionTable(recipe.reactions, { ...recipe.options, thermalMaterialTable });
  if (!equalData(incoming, rebuilt)) throw new TypeError('Cold reference reaction table does not match its recipe');
  return rebuilt;
}
