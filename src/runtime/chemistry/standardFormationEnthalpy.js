// Small, phase-explicit standard-formation-enthalpy bank used to replace a
// provisional ranking heuristic when every term in a balanced reaction has a
// compatible reference state.  The evaluator is generic: missing species fail
// closed and leave discovery on its derived/provisional paths.

export const STANDARD_FORMATION_ENTHALPY_REFERENCE_SCHEMA =
  'peercompute.ulg.standard-formation-enthalpy-reference.v0';
export const STANDARD_REACTION_ENTHALPY_REFERENCE_SCHEMA =
  'peercompute.ulg.standard-reaction-enthalpy-reference.v0';
export const STANDARD_FORMATION_ENTHALPY_FINGERPRINT =
  'nist-srd69-janaf-298.15k-na-h2o-naoh-h2-v0';

const NIST_WEBBOOK = 'NIST Chemistry WebBook, SRD 69';
const CHASE_1998 = 'Chase, 1998; NIST-JANAF Thermochemical Tables, Fourth Edition';

// Values are J/mol at 298.15 K and 1 bar.  Zeroes are elemental reference
// states, not fitted simulation constants.  NaOH(s) and H2O(l) are the
// phase-explicit NIST/JANAF rows used for the ambient sodium-water closure.
const STANDARD_FORMATION_ENTHALPY_BY_FORMULA = Object.freeze({
  Na: Object.freeze({
    formula: 'Na',
    phase: 'solid',
    standardFormationEnthalpyJPerMol: 0,
    source: NIST_WEBBOOK,
    sourceRecord: CHASE_1998,
    sourceUrl: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7440235&Mask=2&Units=SI'
  }),
  H2O: Object.freeze({
    formula: 'H2O',
    phase: 'liquid',
    standardFormationEnthalpyJPerMol: -285_830,
    uncertaintyJPerMol: 40,
    source: NIST_WEBBOOK,
    sourceRecord: 'Cox, Wagman, et al., 1984; CODATA Review value',
    sourceUrl: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=2&Units=SI'
  }),
  NaOH: Object.freeze({
    formula: 'NaOH',
    phase: 'solid',
    standardFormationEnthalpyJPerMol: -425_930,
    source: NIST_WEBBOOK,
    sourceRecord: CHASE_1998,
    sourceUrl: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C1310732&Mask=2&Units=SI'
  }),
  H2: Object.freeze({
    formula: 'H2',
    phase: 'gas',
    standardFormationEnthalpyJPerMol: 0,
    source: 'elemental standard-state convention at 298.15 K and 1 bar',
    sourceRecord: 'standard state of elemental hydrogen',
    sourceUrl: 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C1333740&Mask=1&Units=SI'
  })
});

function normalizedFormula(formula) {
  return String(formula || '').replace(/\s+/g, '');
}

export function standardFormationEnthalpyReference(formula) {
  const record = STANDARD_FORMATION_ENTHALPY_BY_FORMULA[normalizedFormula(formula)] || null;
  return record
    ? {
        schema: STANDARD_FORMATION_ENTHALPY_REFERENCE_SCHEMA,
        temperatureK: 298.15,
        pressurePa: 100_000,
        fingerprint: STANDARD_FORMATION_ENTHALPY_FINGERPRINT,
        ...record
      }
    : null;
}

function referencedSide(terms = []) {
  const records = [];
  for (const term of terms) {
    const coefficient = Number(term?.coefficient);
    const reference = standardFormationEnthalpyReference(term?.formula);
    if (!(coefficient > 0) || !reference) return null;
    records.push({
      coefficient,
      formula: normalizedFormula(term.formula),
      reference,
      contributionJPerBalancedEquation:
        coefficient * reference.standardFormationEnthalpyJPerMol
    });
  }
  return records;
}

export function standardReactionEnthalpyReference({
  equation = null,
  reactants = [],
  products = []
} = {}) {
  const reactantRecords = referencedSide(reactants);
  const productRecords = referencedSide(products);
  if (!reactantRecords || !productRecords || !reactantRecords.length || !productRecords.length) {
    return null;
  }
  const reactantFormationEnthalpyJPerEquation = reactantRecords
    .reduce((sum, row) => sum + row.contributionJPerBalancedEquation, 0);
  const productFormationEnthalpyJPerEquation = productRecords
    .reduce((sum, row) => sum + row.contributionJPerBalancedEquation, 0);
  return {
    schema: STANDARD_REACTION_ENTHALPY_REFERENCE_SCHEMA,
    status: 'standard-reaction-enthalpy-reference-ready',
    model: 'nist-janaf-standard-formation-enthalpy-298.15k-v0',
    fingerprint: STANDARD_FORMATION_ENTHALPY_FINGERPRINT,
    equation,
    temperatureK: 298.15,
    pressurePa: 100_000,
    reactantRecords,
    productRecords,
    reactantFormationEnthalpyJPerEquation,
    productFormationEnthalpyJPerEquation,
    reactionEnthalpyJPerBalancedEquation:
      productFormationEnthalpyJPerEquation - reactantFormationEnthalpyJPerEquation,
    thermochemicalReferenceValidation: true,
    simulationPhaseApplicabilityValidation: false,
    scientificValidation: false,
    fullPhysicsValidation: false
  };
}
