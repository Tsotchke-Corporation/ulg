export const SEDENION_REACTION_SCOPE_SCHEMA = 'peercompute.ulg.sedenion-reaction-scope.v0';
export const SEDENION_REACTION_SCOPE_SOURCE_REF = 'sedenion-periodic-table-pdf:/home/cos/projects/peercompute/plan/refs/sedenion periodic table.pdf';
export const SEDENION_REACTION_SCOPE_FINGERPRINT = [
  SEDENION_REACTION_SCOPE_SCHEMA,
  'fano-triples:123-145-167-246-257-347-356',
  'cd-partners:e1/e9-e7/e15',
  'period-proxy:v1'
].join('|');

export const FANO_TRIPLES = Object.freeze([
  Object.freeze([1, 2, 3]),
  Object.freeze([1, 4, 5]),
  Object.freeze([1, 6, 7]),
  Object.freeze([2, 4, 6]),
  Object.freeze([2, 5, 7]),
  Object.freeze([3, 4, 7]),
  Object.freeze([3, 5, 6])
]);

export const SEDENION_PERIOD_META = Object.freeze([
  Object.freeze({ lowerIndex: 1, period: 1, zRange: [1, 2], nobleGas: 'He', partnerIndex: 9, layer: 'C' }),
  Object.freeze({ lowerIndex: 2, period: 2, zRange: [3, 10], nobleGas: 'Ne', partnerIndex: 10, layer: 'H' }),
  Object.freeze({ lowerIndex: 3, period: 3, zRange: [11, 18], nobleGas: 'Ar', partnerIndex: 11, layer: 'H' }),
  Object.freeze({ lowerIndex: 4, period: 4, zRange: [19, 36], nobleGas: 'Kr', partnerIndex: 12, layer: 'O' }),
  Object.freeze({ lowerIndex: 5, period: 5, zRange: [37, 54], nobleGas: 'Xe', partnerIndex: 13, layer: 'O' }),
  Object.freeze({ lowerIndex: 6, period: 6, zRange: [55, 86], nobleGas: 'Rn', partnerIndex: 14, layer: 'O' }),
  Object.freeze({ lowerIndex: 7, period: 7, zRange: [87, 118], nobleGas: 'Og', partnerIndex: 15, layer: 'O' })
]);

const PERIOD_BY_LOWER_INDEX = new Map(SEDENION_PERIOD_META.map((item) => [item.lowerIndex, item]));
const NOBLE_GAS_Z = new Set(SEDENION_PERIOD_META.map((item) => item.zRange[1]));

const VALIDATION_FLAGS = Object.freeze({
  scientificValidation: false,
  chemistryValidation: false,
  thermochemicalValidation: false,
  kineticsValidation: false,
  fullPhysicsValidation: false
});

function zeroElement(dimension = 16) {
  return new Array(dimension).fill(0);
}

function fromTerms(terms, dimension = 16) {
  const element = zeroElement(dimension);
  for (const term of terms) {
    element[term.index] += term.coefficient ?? 1;
  }
  return element;
}

function split(value) {
  const half = value.length / 2;
  return [value.slice(0, half), value.slice(half)];
}

function addElements(a, b) {
  return a.map((value, index) => value + b[index]);
}

function subtractElements(a, b) {
  return a.map((value, index) => value - b[index]);
}

function scaleElement(element, scalar) {
  return element.map((value) => value * scalar);
}

function conjugate(value) {
  if (value.length === 1) return value.slice();
  const [left, right] = split(value);
  return conjugate(left).concat(scaleElement(right, -1));
}

function multiplyElements(a, b) {
  if (a.length !== b.length) throw new Error(`sedenion length mismatch: ${a.length} !== ${b.length}`);
  if (a.length === 1) return [a[0] * b[0]];
  const [leftA, rightA] = split(a);
  const [leftB, rightB] = split(b);
  const left = subtractElements(
    multiplyElements(leftA, leftB),
    multiplyElements(conjugate(rightB), rightA)
  );
  const right = addElements(
    multiplyElements(rightB, leftA),
    multiplyElements(rightA, conjugate(leftB))
  );
  return left.concat(right);
}

function normSquared(element) {
  return element.reduce((sum, value) => sum + value * value, 0);
}

function isZeroElement(element) {
  return element.every((value) => value === 0);
}

function formatElement(element) {
  const terms = element
    .map((coefficient, index) => ({ coefficient, index }))
    .filter((term) => term.coefficient !== 0);
  if (terms.length === 0) return '0';
  return terms.map(({ coefficient, index }, termIndex) => {
    const sign = coefficient < 0 ? '-' : '+';
    const magnitude = Math.abs(coefficient);
    const unit = index === 0 ? '1' : `e${index}`;
    const value = magnitude === 1 ? unit : `${magnitude}${unit}`;
    return termIndex === 0
      ? (coefficient < 0 ? `-${value}` : value)
      : ` ${sign} ${value}`;
  }).join('');
}

function atomicState({ lowerIndex, upperIndex, sign }) {
  const normalizedSign = sign >= 0 ? 1 : -1;
  const element = fromTerms([
    { index: lowerIndex, coefficient: 1 },
    { index: upperIndex, coefficient: normalizedSign }
  ]);
  return {
    id: `e${lowerIndex}${normalizedSign >= 0 ? '+' : '-'}e${upperIndex}`,
    lowerIndex,
    upperIndex,
    sign: normalizedSign,
    label: formatElement(element),
    norm: normSquared(element),
    element
  };
}

function reactiveStatesForLowerIndex(lowerIndex) {
  const states = [];
  for (let upperIndex = 9; upperIndex <= 15; upperIndex += 1) {
    if (upperIndex === lowerIndex + 8) continue;
    states.push(atomicState({ lowerIndex, upperIndex, sign: 1 }));
    states.push(atomicState({ lowerIndex, upperIndex, sign: -1 }));
  }
  return states;
}

function roleSignPreference(role) {
  if (role === 'cation' || role === 'metal') return 1;
  if (role === 'anion' || role === 'nonmetal') return -1;
  return null;
}

function sortStatesForRole(states, role) {
  const preferredSign = roleSignPreference(role);
  if (preferredSign == null) return states;
  return states.slice().sort((a, b) => (
    (a.sign === preferredSign ? 0 : 1) - (b.sign === preferredSign ? 0 : 1)
    || a.upperIndex - b.upperIndex
  ));
}

function fanoGroupFor(lowerA, lowerB) {
  const line = FANO_TRIPLES.find((triple) => triple.includes(lowerA) && triple.includes(lowerB))
    || FANO_TRIPLES.find((triple) => triple.includes(lowerA))
    || FANO_TRIPLES.find((triple) => triple.includes(lowerB))
    || null;
  return line ? {
    id: `fano-line-${line.join('-')}`,
    lowerIndices: line.slice()
  } : null;
}

function singleElementSpecies(species) {
  return species?.elementCount === 1 ? species.elements[0] : null;
}

export function sedenionPeriodForAtomicNumber(Z) {
  const atomicNumber = Number(Z);
  return SEDENION_PERIOD_META.find((item) => (
    atomicNumber >= item.zRange[0] && atomicNumber <= item.zRange[1]
  )) || null;
}

function baseScope(status, reactiveClass, extra = {}) {
  return {
    schema: SEDENION_REACTION_SCOPE_SCHEMA,
    sourceRef: SEDENION_REACTION_SCOPE_SOURCE_REF,
    fingerprint: SEDENION_REACTION_SCOPE_FINGERPRINT,
    status,
    reactiveClass,
    validation: VALIDATION_FLAGS,
    scientificValidation: false,
    ...extra
  };
}

function compactSpecies(species, element) {
  return {
    input: species?.input ?? null,
    formula: species?.formula ?? null,
    canonicalFormula: species?.canonicalFormula ?? null,
    elementSymbol: element?.symbol ?? null,
    atomicNumber: element?.Z ?? null,
    count: element?.count ?? null
  };
}

function stateSummary(state) {
  return state ? {
    id: state.id,
    label: state.label,
    lowerIndex: state.lowerIndex,
    upperIndex: state.upperIndex,
    sign: state.sign,
    norm: state.norm
  } : null;
}

function findZeroDivisorPair(leftMeta, rightMeta, leftRole, rightRole) {
  const leftStates = sortStatesForRole(reactiveStatesForLowerIndex(leftMeta.lowerIndex), leftRole);
  const rightStates = sortStatesForRole(reactiveStatesForLowerIndex(rightMeta.lowerIndex), rightRole);
  for (const leftState of leftStates) {
    for (const rightState of rightStates) {
      const product = multiplyElements(leftState.element, rightState.element);
      const productNorm = normSquared(product);
      const delta = productNorm - leftState.norm * rightState.norm;
      if (isZeroElement(product) || delta === -4) {
        return {
          leftState,
          rightState,
          productLabel: formatElement(product),
          productNorm,
          delta,
          zeroDivisor: isZeroElement(product)
        };
      }
    }
  }
  return null;
}

export function resolveSedenionReactionScope(leftSpecies, rightSpecies, {
  familyId = null,
  leftRole = null,
  rightRole = null,
  preferredBondType = null
} = {}) {
  const leftElement = singleElementSpecies(leftSpecies);
  const rightElement = singleElementSpecies(rightSpecies);
  const input = {
    familyId,
    left: compactSpecies(leftSpecies, leftElement),
    right: compactSpecies(rightSpecies, rightElement),
    leftRole,
    rightRole,
    preferredBondType
  };

  if (!leftElement || !rightElement) {
    return baseScope('symbolic-prefilter-not-applicable', 'unknown', {
      role: 'compound-or-multi-element',
      reactiveClassReason: 'sedenion grammar currently scopes elemental reactant channels only',
      bondTypePrior: preferredBondType || 'unknown',
      normDefectPrior: null,
      fanoGroup: null,
      symbolicConfidence: 0,
      blockers: ['compound-or-multi-element-species'],
      input
    });
  }

  const leftMeta = sedenionPeriodForAtomicNumber(leftElement.Z);
  const rightMeta = sedenionPeriodForAtomicNumber(rightElement.Z);
  if (!leftMeta || !rightMeta) {
    return baseScope('symbolic-prefilter-unmapped-period', 'unknown', {
      role: 'unmapped-period',
      bondTypePrior: preferredBondType || 'unknown',
      normDefectPrior: null,
      fanoGroup: null,
      symbolicConfidence: 0,
      blockers: ['element-period-not-mapped-to-sedenion-lower-index'],
      input
    });
  }

  const periodScope = {
    leftPeriod: { ...leftMeta },
    rightPeriod: { ...rightMeta },
    fanoGroup: fanoGroupFor(leftMeta.lowerIndex, rightMeta.lowerIndex),
    input
  };

  const nobleGasEndpoint = NOBLE_GAS_Z.has(leftElement.Z) || NOBLE_GAS_Z.has(rightElement.Z);
  if (nobleGasEndpoint) {
    return baseScope('inert-cd-partner-channel', 'inert', {
      ...periodScope,
      role: 'cd-partner-inert-endpoint',
      bondTypePrior: 'inert',
      normDefectPrior: null,
      zeroDivisorPrior: false,
      symbolicConfidence: 0.9,
      blockers: ['noble-gas-cd-partner-channel']
    });
  }

  const zeroPath = findZeroDivisorPair(leftMeta, rightMeta, leftRole, rightRole);
  if (zeroPath) {
    return baseScope('sedenion-zero-divisor-prior', 'reactive', {
      ...periodScope,
      role: `${leftRole || 'unspecified'}-${rightRole || 'unspecified'}`,
      bondTypePrior: zeroPath.delta === -4 || zeroPath.zeroDivisor ? 'ionic' : (preferredBondType || 'unknown'),
      normDefectPrior: zeroPath.delta,
      zeroDivisorPrior: zeroPath.zeroDivisor,
      leftState: stateSummary(zeroPath.leftState),
      rightState: stateSummary(zeroPath.rightState),
      productLabel: zeroPath.productLabel,
      productNorm: zeroPath.productNorm,
      symbolicConfidence: 0.7,
      blockers: []
    });
  }

  return baseScope('sedenion-period-proxy-no-zero-divisor-path', 'unknown', {
    ...periodScope,
    role: `${leftRole || 'unspecified'}-${rightRole || 'unspecified'}`,
    bondTypePrior: preferredBondType || 'unknown',
    normDefectPrior: null,
    zeroDivisorPrior: false,
    symbolicConfidence: 0.35,
    blockers: ['element-to-sedenion-state-bijection-not-derived']
  });
}
