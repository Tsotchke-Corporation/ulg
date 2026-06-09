// SPH phase demo artifact/closure contracts (demo plan P1).
//
// These are the *contracts* — schema constants, builders, and overclaim guards — that the
// material-closure pipeline (P2) and thermodynamic core (P3) produce and consume. Closures
// carry the eshkol.ulg.*-closure.v0 family names (Eshkol compiles them from MoonLab
// microphysics); runtime artifacts use peercompute.ulg.*. Nothing here asserts validated
// physics: every builder defaults its validation flags false and the overclaim guard refuses
// to set any of them true without evidence refs.

export const SPH_PHASE_CLOSURE_SCHEMAS = Object.freeze({
  material: 'eshkol.ulg.material-closure.v0',
  eos: 'eshkol.ulg.eos-closure.v0',
  'phase-equilibrium': 'eshkol.ulg.phase-equilibrium-closure.v0',
  transport: 'eshkol.ulg.transport-closure.v0',
  mechanical: 'eshkol.ulg.mechanical-closure.v0',
  optical: 'eshkol.ulg.optical-closure.v0',
  radiation: 'eshkol.ulg.radiation-closure.v0',
  'wall-boundary': 'eshkol.ulg.wall-boundary-closure.v0'
});

export const MOONLAB_MICROPHYSICS_REFERENCE_SCHEMA = 'moonlab.ulg.microphysics-reference.v0';
export const ULG_WALL_TEMPERATURE_BOUNDARY_SCHEMA = 'peercompute.ulg.wall-temperature-boundary.v0';
export const ULG_PARTICLE_RESOLUTION_CONFIG_SCHEMA = 'peercompute.ulg.particle-resolution-config.v0';
export const ULG_PARTICLE_CONVERGENCE_REPORT_SCHEMA = 'peercompute.ulg.particle-convergence-report.v0';
export const ULG_PHASE_EQUILIBRIUM_SCHEMA = 'peercompute.ulg.phase-equilibrium.v0';
export const ULG_CONSERVATION_REPORT_SCHEMA = 'peercompute.ulg.conservation-report.v0';
export const ULG_SPH_PHASE_SCENARIO_SCHEMA = 'peercompute.ulg.sph-phase-scenario.v0';
export const ULG_SPH_PHASE_SIMULATION_ARTIFACT_SCHEMA = 'peercompute.ulg.sph-phase-simulation-artifact.v0';

export const SPH_PHASE_VALIDATION_FLAGS = Object.freeze([
  'materialValidation',
  'eosValidation',
  'mechanicalValidation',
  'opticalValidation',
  'phaseChangeValidation',
  'sphValidation',
  'scientificValidation',
  'fullPhysicsValidation'
]);

const WALL_FACE_IDS = Object.freeze(['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax']);

function falseValidationFlags() {
  const flags = {};
  for (const flag of SPH_PHASE_VALIDATION_FLAGS) flags[flag] = false;
  return flags;
}

/**
 * Reject any attempt to assert a validation flag without supporting evidence refs. This is the
 * single overclaim guard P1 requires: a closure/artifact may only claim material/EOS/mechanical/
 * optical/phase/SPH/scientific/full-physics validation if it cites the evidence that backs it.
 */
export function assertNoOverclaim(validation = {}, { evidenceRefs = [] } = {}) {
  const hasEvidence = Array.isArray(evidenceRefs) && evidenceRefs.length > 0;
  const resolved = falseValidationFlags();
  for (const flag of SPH_PHASE_VALIDATION_FLAGS) {
    const claimed = validation[flag] === true;
    if (claimed && !hasEvidence) {
      throw new Error(`Overclaim rejected: ${flag} cannot be true without validation.evidenceRefs`);
    }
    resolved[flag] = claimed && hasEvidence;
  }
  return resolved;
}

function requireValidityDomain(validityDomain, family) {
  if (!validityDomain || typeof validityDomain !== 'object') {
    throw new Error(`${family} closure requires a validityDomain`);
  }
  const t = validityDomain.temperatureK;
  if (!Array.isArray(t) || t.length !== 2 || !(Number(t[0]) < Number(t[1]))) {
    throw new Error(`${family} closure validityDomain.temperatureK must be an ascending [min, max] range`);
  }
}

/**
 * A produced microphysics reference: the molecular-ground-state evidence a material closure is
 * derived from (MoonLab molecular Hamiltonian, exactly diagonalized). It carries the producer,
 * the data, derived physical quantities, and a comparison to a published reference where one
 * exists. `quantitative` records whether the result is quantitatively trustworthy (true for the
 * near-FCI H2 case, false for the minimal-basis H2O model). Validation flags stay false: a
 * produced reference is evidence, and only flips a closure's validation if it meets the bar.
 */
export function createMicrophysicsReferenceArtifact({
  artifactId,
  species,
  producer = {},
  data = {},
  derived = {},
  comparison = null,
  quantitative = false,
  provenance = {}
}) {
  if (!artifactId || !species) {
    throw new Error('artifactId and species are required for microphysics reference artifacts');
  }
  return {
    schema: MOONLAB_MICROPHYSICS_REFERENCE_SCHEMA,
    artifactId,
    sourceService: 'moonlab',
    species,
    producer,
    data,
    derived,
    comparison,
    quantitative: quantitative === true,
    status: quantitative === true ? 'produced-quantitative' : 'produced-model-not-quantitative',
    ...falseValidationFlags(),
    provenance: {
      sourceService: 'moonlab',
      ...provenance,
      notes: [
        ...(provenance.notes || []),
        'Produced microphysics evidence: exact ground state of a MoonLab molecular Hamiltonian.',
        'Evidence only; does not by itself flip closure material/EOS/scientific validation.'
      ]
    }
  };
}

/**
 * Build a material/EOS/phase/transport/mechanical/optical/radiation/wall-boundary closure
 * artifact. `closureFamily` selects the eshkol.ulg.*-closure.v0 schema. The artifact carries the
 * fields the plan requires of every closure: content-addressed input refs, producer metadata,
 * validity domain (T/P/density/composition), units, properties, derivative support, descriptors,
 * uncertainty/tolerance, and overclaim-guarded validation flags.
 */
export function createMaterialClosureArtifact({
  closureFamily,
  closureId,
  material,
  inputRefs = [],
  producer = {},
  validityDomain = {},
  units = {},
  properties = {},
  derivatives = false,
  descriptors = {},
  uncertainty = {},
  tolerance = {},
  validation = {},
  provenance = {}
}) {
  const schema = SPH_PHASE_CLOSURE_SCHEMAS[closureFamily];
  if (!schema) {
    throw new Error(`Unknown closure family: ${closureFamily}`);
  }
  if (!closureId) {
    throw new Error('closureId is required for material closures');
  }
  requireValidityDomain(validityDomain, closureFamily);
  const resolvedFlags = assertNoOverclaim(validation, { evidenceRefs: validation.evidenceRefs });
  return {
    schema,
    closureFamily,
    closureId,
    closureKind: `sph-phase-${closureFamily}`,
    material: material || null,
    inputRefs,
    producer: {
      service: producer.service || 'eshkol',
      commit: producer.commit || null,
      toolchain: producer.toolchain || null,
      ...producer
    },
    validityDomain,
    units,
    properties,
    derivatives,
    descriptors,
    uncertainty,
    tolerance,
    validation: {
      status: validation.status || 'reference-fixture-unvalidated',
      evidenceRefs: Array.isArray(validation.evidenceRefs) ? validation.evidenceRefs : [],
      ...resolvedFlags
    },
    closureBacked: true,
    provenance: {
      sourceService: 'eshkol',
      ...provenance,
      notes: [
        ...(provenance.notes || []),
        `Closure family ${closureFamily}; values from tagged reference fixtures unless evidenceRefs are present.`,
        'No validated material/EOS/mechanical/optical/phase/SPH/scientific physics is claimed without evidence.'
      ]
    }
  };
}

/**
 * Six-face fixed-temperature wall boundary config. Rejects a config missing any of the six side
 * temperatures (a core P1 guard).
 */
export function createWallTemperatureBoundary({ model = 'infinite-fixed-temperature-reservoir', faces = {} } = {}) {
  const resolved = {};
  for (const faceId of WALL_FACE_IDS) {
    const temperatureK = Number(faces[faceId]);
    if (!Number.isFinite(temperatureK)) {
      throw new Error(`Wall boundary is missing a finite temperature for face ${faceId}`);
    }
    resolved[faceId] = temperatureK;
  }
  return {
    schema: ULG_WALL_TEMPERATURE_BOUNDARY_SCHEMA,
    model,
    faceIds: [...WALL_FACE_IDS],
    faces: resolved,
    ...falseValidationFlags()
  };
}

/**
 * Particle-resolution config. Carries the conserved total mass per material so a resolution
 * change can be checked to not alter the material mass (P1 guard, enforced by
 * assertResolutionMassInvariant).
 */
export function createParticleResolutionConfig({ counts = {}, totalMassKg = {}, representedEntities = {} } = {}) {
  return {
    schema: ULG_PARTICLE_RESOLUTION_CONFIG_SCHEMA,
    counts: { ...counts },
    totalMassKg: { ...totalMassKg },
    representedEntities: { ...representedEntities },
    ...falseValidationFlags()
  };
}

/**
 * Reject a resolution change that alters any material's total mass: resolution sets accuracy,
 * never the underlying material law / mass.
 */
export function assertResolutionMassInvariant(previous, next, { toleranceKg = 1e-6 } = {}) {
  const materials = new Set([
    ...Object.keys(previous?.totalMassKg || {}),
    ...Object.keys(next?.totalMassKg || {})
  ]);
  for (const material of materials) {
    const a = Number(previous?.totalMassKg?.[material]);
    const b = Number(next?.totalMassKg?.[material]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > toleranceKg) {
      throw new Error(`Resolution change altered ${material} total mass (${a} -> ${b}); resolution must not change material mass`);
    }
  }
  return true;
}

/**
 * Phase-equilibrium result artifact (stable phase + phase fractions at a thermodynamic state).
 */
export function createPhaseEquilibriumArtifact({
  material,
  temperatureK,
  pressurePa = null,
  stablePhase,
  phaseFractions = {},
  specificInternalEnergyJPerKg = null,
  closureRef = null,
  provenance = {}
}) {
  if (!material || !stablePhase) {
    throw new Error('material and stablePhase are required for a phase-equilibrium artifact');
  }
  return {
    schema: ULG_PHASE_EQUILIBRIUM_SCHEMA,
    material,
    temperatureK,
    pressurePa,
    stablePhase,
    phaseFractions,
    specificInternalEnergyJPerKg,
    closureRef,
    closureBacked: closureRef != null,
    ...falseValidationFlags(),
    provenance: {
      sourceService: 'ulg-runtime',
      ...provenance
    }
  };
}

/**
 * SPH phase simulation artifact (evidence-only). Wraps a conservative SPH carrier run with its
 * conservation report and phase summary. Always non-overclaiming: a conservative reference run
 * is not validated material/phase physics.
 */
export function createSphPhaseSimulationArtifact({
  artifactId,
  scenarioId = null,
  backend = 'cpu-reference',
  integrator = 'leapfrog-kdk',
  dt,
  steps,
  particleCount = null,
  initialTotals = null,
  finalTotals = null,
  conservationReport = null,
  phaseSummary = null,
  closureRefs = [],
  provenance = {}
}) {
  if (!artifactId) {
    throw new Error('artifactId is required for SPH phase simulation artifacts');
  }
  return {
    schema: ULG_SPH_PHASE_SIMULATION_ARTIFACT_SCHEMA,
    artifactId,
    sourceService: 'ulg-runtime',
    scenarioId,
    representation: 'sph-phase-carrier',
    execution: { backend, integrator, dt, steps },
    particleCount,
    initialTotals,
    finalTotals,
    conservationReport,
    phaseSummary,
    closureRefs,
    ...falseValidationFlags(),
    validation: {
      status: conservationReport?.status === 'fail' ? 'fail' : 'conservative-reference-ok',
      blockers: [
        'sph-phase-carrier-reference-not-validated-physics',
        'material-closures-not-microphysics-validated'
      ]
    },
    provenance: {
      sourceService: 'ulg-runtime',
      ...provenance,
      notes: [
        ...(provenance.notes || []),
        'Conservative CPU-reference SPH carrier run; phases emerge from specific internal energy.',
        'No material/EOS/SPH/phase/scientific validation is claimed.'
      ]
    }
  };
}

/**
 * Conservation report (energy/mass/momentum residuals) for a simulation step or budget.
 */
export function createConservationReport({
  energyResidualJ = null,
  massResidualKg = null,
  momentumResidualKgMPerS = null,
  toleranceProfile = {},
  closureRefs = [],
  provenance = {}
} = {}) {
  const within = (value, tol) => value == null || tol == null ? null : Math.abs(value) <= tol;
  const status = [
    within(energyResidualJ, toleranceProfile.energyJ),
    within(massResidualKg, toleranceProfile.massKg),
    within(momentumResidualKgMPerS, toleranceProfile.momentumKgMPerS)
  ].some((ok) => ok === false) ? 'fail' : 'pass';
  return {
    schema: ULG_CONSERVATION_REPORT_SCHEMA,
    status,
    energyResidualJ,
    massResidualKg,
    momentumResidualKgMPerS,
    toleranceProfile,
    closureRefs,
    ...falseValidationFlags(),
    provenance: { sourceService: 'ulg-runtime', ...provenance }
  };
}
