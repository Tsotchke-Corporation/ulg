import { validateSphExactMassFormat, encodeSphExactMassUnits, SPH_EXACT_MASS_ERROR }
  from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { assertSphReactionEnergyAuthority, sphReactionEnergyEntry } from './sphReactionEnergyAuthority.js';
import { SPH_EXACT_REACTION_ALLOCATION_ERROR } from './sphExactReactionAllocationWgsl.js';

export const SPH_EXACT_REACTION_ALLOCATION_SCHEMA = 'peercompute.ulg.exact-reaction-allocation.v1';
export const SPH_EXACT_REACTION_WEIGHT_MAGIC = 0x45525731;
const COMPILATIONS = new WeakMap();
const ARRAY_KEYS = ['records', 'reactionHeaders', 'reactantTermRecords', 'productTermRecords',
  'gasProductRecords', 'atomTermRecords', 'productPhaseRecords', 'combinedRecords', 'gasConstitutiveRecords'];
const TABLE_KEYS = [...ARRAY_KEYS, 'energyAuthority', 'reactionCount', 'reactionHeaderCount',
  'reactantTermCount', 'productTermCount', 'gasProductCount', 'atomTermCount', 'productPhaseCount',
  'combinedRecordCount', 'gasConstitutiveSchema', 'gasConstitutiveOffsetVec4', 'metadata',
  'reactantTermMetadata', 'productTermMetadata', 'gasProductMetadata', 'atomTermMetadata',
  'productPhaseMetadata', 'energyMetadata'];
const typedLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Float32Array.prototype), 'length').get;
const fail = message => { throw new TypeError(`Exact reaction allocation: ${message}`); };
const maxUnits = format => (1n << BigInt(format.wordCount * 32)) - 1n;
const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };

function dataSnapshot(object, keys) {
  return keys.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(`original data property required: ${key}`);
    return [key, descriptor.value];
  });
}

function snapshotMatches(object, snapshot) {
  return snapshot.every(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && Object.hasOwn(descriptor, 'value') && descriptor.value === value;
  });
}

function arrayContents(object, keys) {
  return keys.map(key => {
    const array = object[key], length = Reflect.apply(typedLength, array, []);
    const values = array instanceof Uint32Array ? new Uint32Array(length) : new Float32Array(length);
    for (let i = 0; i < length; i++) values[i] = array[i];
    return [key, values];
  });
}

function contentsMatch(object, contents) {
  return contents.every(([key, values]) => {
    const array = object[key];
    if (Reflect.apply(typedLength, array, []) !== values.length) return false;
    for (let i = 0; i < values.length; i++) if (!Object.is(array[i], values[i])) return false;
    return true;
  });
}

// Decode the admitted binary64 number, then multiply integer significands.
// Multiplying the two JS Numbers first would already discard product bits.
function positiveDyadic(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) fail('positive finite term weight required');
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false), encoded = Number((bits >> 52n) & 2047n);
  let coefficient = (bits & ((1n << 52n) - 1n)) | (encoded ? 1n << 52n : 0n);
  let exponent = encoded ? encoded - 1075 : -1074;
  while ((coefficient & 1n) === 0n) { coefficient >>= 1n; exponent++; }
  return { coefficient, exponent };
}

function compileWeights(terms, format) {
  const values = terms.map(term => {
    const a = positiveDyadic(term.coefficient), b = positiveDyadic(term.molarMass);
    return { coefficient: a.coefficient * b.coefficient, exponent: a.exponent + b.exponent };
  });
  const exponent = Math.min(...values.map(value => value.exponent));
  const integers = values.map(value => value.coefficient << BigInt(value.exponent - exponent));
  const divisor = integers.reduce(gcd);
  const weights = integers.map(value => value / divisor), maximum = maxUnits(format);
  let sum = 0n;
  for (const weight of weights) {
    if (weight > maximum) throw new RangeError('Exact reaction dimensionless weight exceeds the selected word width');
    sum += weight;
    if (sum > maximum) throw new RangeError('Exact reaction cumulative weight exceeds the selected word width');
  }
  return { weights, sum, scale: Object.freeze({ coefficient: divisor, exponent }) };
}

/** Cold metadata compiler, not a registrar for physical sources or outputs.
 * Reactant and product weights each have their own exact dimensionless scale.
 * Their width is explicitly the inventory word count; overflow rejects rather
 * than truncating metadata. Caller may choose a wider run format beforehand.
 */
export function compileSphExactReactionAllocation({ reactionTable, thermalMaterialTable = null,
  reactionIndex, format } = {}) {
  validateSphExactMassFormat(format);
  if (!reactionTable || !Number.isInteger(reactionIndex) || reactionIndex < 0 || reactionIndex > 0xffffffff) {
    fail('original reaction table and integer reaction index required');
  }
  const tableSnapshot = dataSnapshot(reactionTable, TABLE_KEYS);
  if (!assertSphReactionEnergyAuthority(reactionTable, thermalMaterialTable)) fail('authenticated energy authority required');
  const entry = sphReactionEnergyEntry(reactionTable, reactionIndex);
  if (!entry || entry.reactants.length !== 2 || !entry.products.length) fail('two reactants and nonempty products required');
  const reactantWeights = compileWeights(entry.reactants, format), productWeights = compileWeights(entry.products, format);
  const metadata = term => {
    for (const key of ['termIndex', 'materialId', 'targetPhase']) {
      if (!Number.isInteger(term[key]) || term[key] < 0 || term[key] > 0xffffffff) fail(`invalid term ${key}`);
    }
    return { termIndex: term.termIndex, materialId: term.materialId, targetPhase: term.targetPhase,
      coefficient: term.coefficient, molarMass: term.molarMass };
  };
  let prefix = 0n;
  const products = entry.products.map((term, index) => {
    const lower = prefix; prefix += productWeights.weights[index];
    return Object.freeze({ ...metadata(term), weight: productWeights.weights[index], lower, upper: prefix });
  });
  const token = Object.freeze({ schema: SPH_EXACT_REACTION_ALLOCATION_SCHEMA, reactionIndex, format,
    reactants: Object.freeze(entry.reactants.map((term, index) => Object.freeze({ ...metadata(term), weight: reactantWeights.weights[index] }))),
    products: Object.freeze(products), reactantWeightSum: reactantWeights.sum, productWeightSum: productWeights.sum,
    reactantWeightScale: reactantWeights.scale, productWeightScale: productWeights.scale,
    weightWordCount: format.wordCount, physicalPublicationAdmitted: false });
  // Keep independent contents in addition to original array identities. An
  // overwritten typed-array method cannot make a changed table pass this seal.
  const contents = arrayContents(reactionTable, ARRAY_KEYS);
  const molarKeys = thermalMaterialTable && Object.hasOwn(thermalMaterialTable, 'molarMassIdentities') ? ['molarMassIdentities'] : [];
  if (molarKeys.length && !(thermalMaterialTable.molarMassIdentities instanceof Uint32Array)) fail('packed molecular identities required');
  const thermalSnapshot = thermalMaterialTable ? dataSnapshot(thermalMaterialTable,
    ['records', 'segments', 'metadata', 'materialCount', 'segmentCount', ...molarKeys]) : null;
  const thermalContents = thermalMaterialTable ? arrayContents(thermalMaterialTable, ['records', 'segments', ...molarKeys]) : null;
  COMPILATIONS.set(token, { reactionTable, thermalMaterialTable, tableSnapshot, thermalSnapshot, contents, thermalContents, entry });
  resolveSphExactReactionAllocation(token);
  return token;
}

/** Resolve only an original issued compiler token against its original table.
 * Returned immutable numeric metadata never authenticates GPU output owners.
 */
export function resolveSphExactReactionAllocation(token, expected = {}) {
  const record = COMPILATIONS.get(token);
  if (!record) fail('original compiler token required');
  for (const [key, value] of [['reactionTable', record.reactionTable], ['thermalMaterialTable', record.thermalMaterialTable],
    ['format', token.format], ['reactionIndex', token.reactionIndex]]) {
    if (Object.hasOwn(expected, key) && expected[key] !== value) fail(`changed original ${key}`);
  }
  const matches = () => snapshotMatches(record.reactionTable, record.tableSnapshot)
    && (!record.thermalSnapshot || snapshotMatches(record.thermalMaterialTable, record.thermalSnapshot))
    && contentsMatch(record.reactionTable, record.contents)
    && (!record.thermalContents || contentsMatch(record.thermalMaterialTable, record.thermalContents));
  if (!matches()) fail('original table snapshot changed');
  if (!assertSphReactionEnergyAuthority(record.reactionTable, record.thermalMaterialTable)
    || sphReactionEnergyEntry(record.reactionTable, token.reactionIndex) !== record.entry || !matches()) {
    fail('stale reaction authority');
  }
  return token;
}

/** Defensive copy: header[8], WA[N], WB[N], productSum[N], followed by each
 * [globalTermId, materialId, targetPhase, 0, lower[N], upper[N]]. */
export function encodeSphExactReactionAllocationWeights(token) {
  resolveSphExactReactionAllocation(token);
  const n = token.format.wordCount, stride = 4 + 2 * n;
  const result = new Uint32Array(8 + 3 * n + token.products.length * stride);
  result.set([SPH_EXACT_REACTION_WEIGHT_MAGIC, 1, n, token.reactionIndex, token.products.length,
    token.reactants[0].termIndex, token.reactants[1].termIndex, 0]);
  const write = (value, offset) => result.set(encodeSphExactMassUnits(value, token.format), offset);
  write(token.reactants[0].weight, 8); write(token.reactants[1].weight, 8 + n); write(token.productWeightSum, 8 + 2 * n);
  token.products.forEach((term, index) => {
    const base = 8 + 3 * n + index * stride;
    result.set([term.termIndex, term.materialId, term.targetPhase, 0], base);
    write(term.lower, base + 4); write(term.upper, base + 4 + n);
  });
  return result;
}

/** Independent BigInt reference for the numerical contract. Inputs are exact
 * integer units, never packed f32 masses. Rejected/inactive events debit zero. */
export function selectSphExactReactionAllocation(token, { availableA, availableB, kineticCap } = {}) {
  resolveSphExactReactionAllocation(token);
  const maximum = maxUnits(token.format);
  for (const value of [availableA, availableB, kineticCap]) {
    if (typeof value !== 'bigint' || value < 0n || value > maximum) throw new RangeError('Exact reaction source/cap outside inventory width');
  }
  const inactive = error => Object.freeze({ active: false, error, total: 0n, debitA: 0n, debitB: 0n,
    remainderA: availableA, remainderB: availableB,
    products: Object.freeze(token.products.map(term => Object.freeze({ termIndex: term.termIndex,
      materialId: term.materialId, targetPhase: term.targetPhase, mass: 0n, fromA: 0n, fromB: 0n }))), physicalPublicationAdmitted: false });
  const available = availableA + availableB;
  if (available > maximum) return inactive(SPH_EXACT_MASS_ERROR.OVERFLOW);
  const weightA = token.reactants[0].weight, denominator = token.reactantWeightSum;
  if (weightA <= 0n || token.reactants[1].weight <= 0n) return inactive(SPH_EXACT_REACTION_ALLOCATION_ERROR.INVALID_WEIGHT);
  // Direct inversion is independent of the GPU's binary search. floor(C*w/d)
  // <= A implies C <= ceil((A+1)*d/w)-1; C-floor(C*w/d)=ceil(C*(d-w)/d)
  // <= B implies C <= floor(B*d/(d-w)).
  const boundA = ((availableA + 1n) * denominator - 1n) / weightA;
  const boundB = availableB * denominator / (denominator - weightA);
  const total = [available, kineticCap, boundA, boundB].reduce((a, b) => a < b ? a : b);
  const debitA = total * weightA / denominator, debitB = total - debitA;
  if (debitA === 0n || debitB === 0n) return inactive(0);
  const min = (a, b) => a < b ? a : b;
  const products = token.products.map(term => {
    const start = total * term.lower / token.productWeightSum, end = total * term.upper / token.productWeightSum;
    const fromA = min(end, debitA) - min(start, debitA), mass = end - start;
    return Object.freeze({ termIndex: term.termIndex, materialId: term.materialId, targetPhase: term.targetPhase,
      mass, fromA, fromB: mass - fromA });
  });
  return Object.freeze({ active: true, error: 0, total, debitA, debitB,
    remainderA: availableA - debitA, remainderB: availableB - debitB,
    products: Object.freeze(products), physicalPublicationAdmitted: false });
}
