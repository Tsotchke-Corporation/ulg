export const ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-particle-initialization-rows.v0';
export const ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-particle-initialization-row.v0';
export const ULG_ALGORITHM_MLS_MPM_MECHANICS_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-mls-mpm-mechanics-rows.v0';
export const ULG_ALGORITHM_MLS_MPM_MECHANICS_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-mls-mpm-mechanics-row.v0';
export const ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-contact-rows.v0';
export const ULG_ALGORITHM_CONTACT_MATERIAL_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-contact-row.v0';
export const ULG_ALGORITHM_SURFACE_EXTRACTION_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-surface-extraction-rows.v0';
export const ULG_ALGORITHM_SURFACE_EXTRACTION_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-surface-extraction-row.v0';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
}

function particleRadiusFromCrystalPackingFraction(spacingM, packingFraction) {
  const spacing = finiteNumber(spacingM, 0);
  const packing = finiteNumber(packingFraction, 0);
  if (!(spacing > 0) || !(packing > 0)) return 0;
  return spacing * Math.cbrt((3 * packing) / (4 * Math.PI));
}

function roleWarmInput(warmInputs, role) {
  return warmInputs?.roles?.[role] || null;
}

function roleCrystalWarmInput(crystalWarmInputs, role) {
  return crystalWarmInputs?.roles?.[role] || null;
}

export function buildAlgorithmMaterialParticleInitializationRows({
  initialParticleSpacing = null,
  dropMaterial = null,
  baseMaterial = null,
  dropTemperatureK = null,
  baseTemperatureK = null
} = {}) {
  const spacing = initialParticleSpacing || {};
  const materialWarmInputs = spacing.materialPropertyBankWarmInputs || null;
  const crystalWarmInputs = spacing.materialPropertyCrystalStructureWarmInputs || null;
  const roleInputs = [
    { role: 'drop', requestedMaterial: dropMaterial, temperatureK: dropTemperatureK },
    { role: 'base', requestedMaterial: baseMaterial, temperatureK: baseTemperatureK }
  ];
  const rows = [];
  for (const input of roleInputs) {
    const rolePlan = spacing[input.role];
    if (!rolePlan) continue;
    const warmInput = roleWarmInput(materialWarmInputs, input.role);
    const crystalWarmInput = roleCrystalWarmInput(crystalWarmInputs, input.role);
    const crystalUnitCell = crystalWarmInput?.unitCell || {};
    const crystalPackingFraction = finiteNumber(crystalUnitCell.packingFraction, 0);
    const crystalPackingParticleRadiusM = particleRadiusFromCrystalPackingFraction(
      rolePlan.spacingM,
      crystalPackingFraction
    );
    rows.push({
      schema: ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROW_SCHEMA,
      status: 'algorithm-derived-particle-initialization-row-ready',
      role: input.role,
      requestedMaterial: input.requestedMaterial,
      material: warmInput?.material ?? input.requestedMaterial ?? null,
      materialId: finiteNumber(warmInput?.atomicNumber, 0),
      temperatureK: finiteNumber(warmInput?.temperatureK, input.temperatureK),
      pressurePa: finiteNumber(warmInput?.pressurePa ?? rolePlan.pressurePa, 0),
      densityKgPerM3: finiteNumber(rolePlan.densityKgPerM3, 0),
      particlesPerEdge: finiteNumber(rolePlan.particlesPerEdge, 0),
      spacingM: finiteNumber(rolePlan.spacingM, 0),
      restVolumeM3: finiteNumber(rolePlan.restVolumeM3, 0),
      mechanicsRestVolumeM3: finiteNumber(rolePlan.mechanicsRestVolumeM3, rolePlan.continuumCellVolumeM3),
      volumeEquivalentParticleRadiusM: finiteNumber(rolePlan.volumeEquivalentParticleRadiusM, 0),
      pressureAdjustedParticleRadiusM: finiteNumber(rolePlan.pressureAdjustedParticleRadiusM, 0),
      targetSmoothingLengthM: finiteNumber(rolePlan.targetSmoothingLengthM, 0),
      globalSmoothingLengthM: finiteNumber(rolePlan.globalSmoothingLengthM, 0),
      targetNeighborCount: finiteNumber(rolePlan.targetNeighborCount ?? spacing.targetNeighborCount, 0),
      estimatedNeighborCount: finiteNumber(rolePlan.estimatedNeighborCount, 0),
      crystalStructureKey: crystalWarmInput?.structureKey ?? null,
      crystalStructureStatus: crystalWarmInput?.status ?? null,
      crystalPackingFraction,
      crystalCoordinationNumber: finiteNumber(crystalUnitCell.coordinationNumber, 0),
      crystalAtomsPerConventionalCell: finiteNumber(crystalUnitCell.atomsPerConventionalCell, 0),
      crystalPackingParticleRadiusM,
      particleRadiusPolicy: crystalWarmInput
        ? 'global-particle-volume-authoritative-crystal-packing-diagnostic'
        : 'global-particle-volume-authoritative',
      appliedParticleRadiusM: finiteNumber(rolePlan.volumeEquivalentParticleRadiusM, 0),
      strictSourceOfTruth: false,
      provenance: {
        source: 'algorithm-derived-material-row',
        materialBankGeneratorFingerprint: materialWarmInputs?.generatorFingerprint ?? null,
        crystalBankGeneratorFingerprint: crystalWarmInputs?.generatorFingerprint ?? null,
        materialWarmInputStatus: warmInput?.status ?? null,
        crystalWarmInputStatus: crystalWarmInput?.status ?? null
      }
    });
  }
  return {
    schema: ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-particle-initialization-rows-ready'
      : 'algorithm-derived-particle-initialization-rows-empty',
    sourceSchema: spacing.schema ?? null,
    rowCount: rows.length,
    rows,
    strictSourceOfTruth: false,
    derivationAuthority: 'fundamental-closures-with-versioned-warm-inputs',
    cacheKeyParts: {
      sourceSchema: spacing.schema ?? null,
      targetNeighborCount: finiteNumber(spacing.targetNeighborCount, 0),
      materialBankGeneratorFingerprint: materialWarmInputs?.generatorFingerprint ?? null,
      crystalBankGeneratorFingerprint: crystalWarmInputs?.generatorFingerprint ?? null,
      roles: rows.map((row) => ({
        role: row.role,
        material: row.material,
        temperatureK: row.temperatureK,
        pressurePa: row.pressurePa,
        crystalStructureKey: row.crystalStructureKey
      }))
    }
  };
}

function orderedInitialBodies(initialBodies, initialParticleSpacing = null) {
  const source = Array.isArray(initialBodies)
    ? initialBodies
    : (Array.isArray(initialBodies?.bodies)
        ? initialBodies.bodies
        : (Array.isArray(initialParticleSpacing?.bodies)
            ? initialParticleSpacing.bodies
            : []));
  const ids = new Set();
  const domainIds = new Set();
  return source.map((body, bodyOrder) => {
    const bodyId = String(body?.id ?? body?.bodyId ?? '').trim();
    if (!bodyId) {
      throw new TypeError(`initial body at index ${bodyOrder} has no stable id`);
    }
    if (ids.has(bodyId)) {
      throw new Error(`initial body id '${bodyId}' is duplicated`);
    }
    ids.add(bodyId);
    const domainId = Math.round(finiteNumber(body?.domainId, 0));
    if (!(domainId > 0)) {
      throw new RangeError(`initial body '${bodyId}' has no positive domain id`);
    }
    if (domainIds.has(domainId)) {
      throw new Error(`initial body domain id '${domainId}' is duplicated`);
    }
    domainIds.add(domainId);
    return {
      ...body,
      id: bodyId,
      domainId,
      bodyOrder
    };
  });
}

function bodyPlanEntries(bodyPlans, initialParticleSpacing) {
  if (bodyPlans instanceof Map) return bodyPlans;
  const source = bodyPlans
    ?? initialParticleSpacing?.byBodyId
    ?? initialParticleSpacing?.bodies
    ?? null;
  if (source instanceof Map) return source;
  if (Array.isArray(source)) {
    return new Map(source.map((plan) => [String(plan?.bodyId ?? plan?.id ?? '').trim(), plan]));
  }
  if (source && typeof source === 'object') return new Map(Object.entries(source));
  return new Map();
}

function bodyScopedInput(collection, body) {
  const byBodyId = collection?.byBodyId;
  if (byBodyId instanceof Map && byBodyId.has(body.id)) return byBodyId.get(body.id);
  if (byBodyId && typeof byBodyId === 'object' && byBodyId[body.id]) return byBodyId[body.id];
  if (Array.isArray(collection?.bodies)) {
    const entry = collection.bodies.find((candidate) => (
      String(candidate?.bodyId ?? candidate?.id ?? '').trim() === body.id
    ));
    if (entry) return entry.warmInput ?? entry;
  }
  const roles = collection?.roles;
  if (roles && typeof roles === 'object') {
    return roles[body.id]
      ?? roles[`body:${body.id}`]
      ?? (body.legacyRole ? roles[body.legacyRole] : null)
      ?? null;
  }
  return null;
}

function bodyMaterialWarmInput(materialWarmInputs, body, plan) {
  return plan?.materialPropertyBankWarmInput
    ?? bodyScopedInput(materialWarmInputs, body)
    ?? null;
}

function bodyCrystalWarmInput(crystalWarmInputs, body, plan) {
  return plan?.materialPropertyCrystalStructureWarmInput
    ?? bodyScopedInput(crystalWarmInputs, body)
    ?? null;
}

function bodyRole(body) {
  return body.legacyRole || body.id;
}

/**
 * Build initialization-policy rows for an ordered collection of initial
 * bodies. This is deliberately separate from the legacy drop/base builder:
 * stable body identity, not material identity or array position, is the
 * grouping authority for later mechanics and contact rows.
 */
export function buildAlgorithmInitialBodyParticleInitializationRows({
  initialBodies = null,
  bodyPlans = null,
  initialParticleSpacing = null
} = {}) {
  const spacing = initialParticleSpacing || {};
  const bodies = orderedInitialBodies(initialBodies, spacing);
  const plans = bodyPlanEntries(bodyPlans, spacing);
  const materialWarmInputs = spacing.materialPropertyBankWarmInputs || null;
  const crystalWarmInputs = spacing.materialPropertyCrystalStructureWarmInputs || null;
  const rows = bodies.map((body) => {
    const plan = plans.get(body.id);
    if (!plan) {
      throw new Error(`initial body '${body.id}' has no particle plan`);
    }
    const planBodyId = String(plan.bodyId ?? plan.id ?? body.id).trim();
    if (planBodyId !== body.id) {
      throw new Error(`particle plan '${planBodyId}' does not match initial body '${body.id}'`);
    }
    const warmInput = bodyMaterialWarmInput(materialWarmInputs, body, plan);
    const crystalWarmInput = bodyCrystalWarmInput(crystalWarmInputs, body, plan);
    const crystalUnitCell = crystalWarmInput?.unitCell || {};
    const crystalPackingFraction = finiteNumber(crystalUnitCell.packingFraction, 0);
    const spacingM = finiteNumber(
      plan.representativeCellPitchM ?? plan.spacingM,
      0
    );
    const particlesPerAxis = Array.isArray(plan.particlesPerEdge)
      ? plan.particlesPerEdge.map((value) => Math.max(0, Math.round(finiteNumber(value, 0))))
      : [];
    const spacingByAxisM = Array.isArray(plan.spacingByAxisM)
      ? plan.spacingByAxisM.map((value) => finiteNumber(value, 0))
      : [];
    const appliedParticleRadiusM = finiteNumber(
      plan.volumeEquivalentParticleRadiusM ?? plan.visualParticleRadiusM,
      0
    );
    const targetSmoothingLengthM = finiteNumber(
      plan.targetSmoothingLengthM ?? spacing.smoothingLengthM,
      0
    );
    return {
      schema: ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROW_SCHEMA,
      status: 'algorithm-derived-particle-initialization-row-ready',
      role: bodyRole(body),
      bodyId: body.id,
      domainId: body.domainId,
      bodyOrder: body.bodyOrder,
      requestedMaterial: body.material ?? plan.material ?? null,
      material: warmInput?.material ?? plan.material ?? body.material ?? null,
      materialId: finiteNumber(warmInput?.atomicNumber, 0),
      phase: plan.phase ?? null,
      temperatureK: finiteNumber(warmInput?.temperatureK, plan.temperatureK ?? body.temperatureK),
      pressurePa: finiteNumber(warmInput?.pressurePa, plan.pressurePa),
      densityKgPerM3: finiteNumber(plan.densityKgPerM3, 0),
      particlesPerEdge: particlesPerAxis,
      particlesPerAxis,
      particleCount: finiteNumber(
        plan.particleCount,
        particlesPerAxis.length === 3
          ? particlesPerAxis[0] * particlesPerAxis[1] * particlesPerAxis[2]
          : 0
      ),
      spacingM,
      spacingByAxisM,
      restVolumeM3: finiteNumber(plan.restVolumeM3 ?? plan.visualRestVolumeM3, 0),
      mechanicsRestVolumeM3: finiteNumber(plan.mechanicsRestVolumeM3, plan.continuumCellVolumeM3),
      volumeEquivalentParticleRadiusM: appliedParticleRadiusM,
      pressureAdjustedParticleRadiusM: finiteNumber(
        plan.pressureAdjustedParticleRadiusM,
        appliedParticleRadiusM
      ),
      targetSmoothingLengthM,
      globalSmoothingLengthM: finiteNumber(spacing.smoothingLengthM, targetSmoothingLengthM),
      targetNeighborCount: finiteNumber(
        plan.targetNeighborCount ?? spacing.targetNeighborCount ?? warmInput?.targetNeighborCount,
        0
      ),
      estimatedNeighborCount: finiteNumber(plan.estimatedNeighborCount, 0),
      crystalStructureKey: crystalWarmInput?.structureKey ?? null,
      crystalStructureStatus: crystalWarmInput?.status ?? null,
      crystalPackingFraction,
      crystalCoordinationNumber: finiteNumber(crystalUnitCell.coordinationNumber, 0),
      crystalAtomsPerConventionalCell: finiteNumber(crystalUnitCell.atomsPerConventionalCell, 0),
      crystalPackingParticleRadiusM: particleRadiusFromCrystalPackingFraction(
        spacingM,
        crystalPackingFraction
      ),
      particleRadiusPolicy: crystalWarmInput
        ? 'global-particle-volume-authoritative-crystal-packing-diagnostic'
        : 'global-particle-volume-authoritative',
      appliedParticleRadiusM,
      strictSourceOfTruth: false,
      provenance: {
        source: 'algorithm-derived-initial-body-material-row',
        materialBankGeneratorFingerprint: materialWarmInputs?.generatorFingerprint ?? null,
        crystalBankGeneratorFingerprint: crystalWarmInputs?.generatorFingerprint ?? null,
        materialWarmInputStatus: warmInput?.status ?? null,
        crystalWarmInputStatus: crystalWarmInput?.status ?? null
      }
    };
  });
  return {
    schema: ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-particle-initialization-rows-ready'
      : 'algorithm-derived-particle-initialization-rows-empty',
    sourceSchema: spacing.schema ?? null,
    rowCount: rows.length,
    rows,
    identityMode: 'initial-bodies',
    strictSourceOfTruth: false,
    derivationAuthority: 'fundamental-closures-with-versioned-warm-inputs',
    cacheKeyParts: {
      sourceSchema: spacing.schema ?? null,
      targetNeighborCount: finiteNumber(spacing.targetNeighborCount, 0),
      materialBankGeneratorFingerprint: materialWarmInputs?.generatorFingerprint ?? null,
      crystalBankGeneratorFingerprint: crystalWarmInputs?.generatorFingerprint ?? null,
      bodies: rows.map((row) => ({
        bodyId: row.bodyId,
        domainId: row.domainId,
        bodyOrder: row.bodyOrder,
        role: row.role,
        material: row.material,
        temperatureK: row.temperatureK,
        pressurePa: row.pressurePa,
        particlesPerAxis: [...row.particlesPerAxis],
        spacingByAxisM: [...row.spacingByAxisM],
        crystalStructureKey: row.crystalStructureKey
      }))
    }
  };
}

function initializationRowsByRole(particleInitializationRows) {
  const map = new Map();
  for (const row of particleInitializationRows?.rows || []) {
    if (row?.role) map.set(row.role, row);
  }
  return map;
}

function initializationRowsByBodyId(particleInitializationRows) {
  const map = new Map();
  for (const row of particleInitializationRows?.rows || []) {
    if (row?.bodyId != null) map.set(String(row.bodyId), row);
  }
  return map;
}

function createMechanicsAccumulator({ role, material, phase, initializationRow }) {
  return {
    role,
    material,
    phase,
    initializationRow,
    particleCount: 0,
    solidParticleCount: 0,
    restVolumeM3Sum: 0,
    effectiveBulkModulusPaSum: 0,
    shearModulusPaSum: 0,
    lameLambdaPaSum: 0,
    soundSpeedMPerSSum: 0,
    dynamicViscosityPaSSum: 0,
    surfaceTensionNPerMSum: 0,
    maxHydrostaticPressurePa: 0
  };
}

function createInitialBodyMechanicsAccumulator({
  role,
  bodyId,
  domainId,
  bodyOrder,
  material,
  phase,
  initializationRow
}) {
  return {
    ...createMechanicsAccumulator({ role, material, phase, initializationRow }),
    bodyId,
    domainId,
    bodyOrder
  };
}

function appendMechanicsSample(accumulator, {
  particle,
  meta,
  mechanics,
  offset
}) {
  accumulator.particleCount += 1;
  accumulator.solidParticleCount += finiteNumber(
    mechanics?.[offset + 20],
    meta.solid ? 1 : 0
  ) > 0.5 ? 1 : 0;
  accumulator.restVolumeM3Sum += finiteNumber(mechanics?.[offset + 19], 0);
  accumulator.effectiveBulkModulusPaSum += finiteNumber(
    mechanics?.[offset + 22],
    meta.effectiveBulkModulusPa
  );
  accumulator.shearModulusPaSum += finiteNumber(
    mechanics?.[offset + 23],
    meta.shearModulusPa
  );
  accumulator.lameLambdaPaSum += finiteNumber(
    mechanics?.[offset + 24],
    meta.lameLambdaPa
  );
  accumulator.soundSpeedMPerSSum += finiteNumber(
    mechanics?.[offset + 25],
    meta.soundSpeedMPerS
  );
  accumulator.dynamicViscosityPaSSum += finiteNumber(
    mechanics?.[offset + 29],
    meta.dynamicViscosityPaS
  );
  accumulator.surfaceTensionNPerMSum += finiteNumber(
    mechanics?.[offset + 30],
    meta.surfaceTensionNPerM
  );
  accumulator.maxHydrostaticPressurePa = Math.max(
    accumulator.maxHydrostaticPressurePa,
    finiteNumber(mechanics?.[offset + 28], meta.hydrostaticPressurePa)
  );
}

function mechanicsRowFromAccumulator(accumulator) {
  const count = Math.max(1, accumulator.particleCount);
  const init = accumulator.initializationRow;
  return {
    schema: ULG_ALGORITHM_MLS_MPM_MECHANICS_ROW_SCHEMA,
    status: 'algorithm-derived-mls-mpm-mechanics-row-ready',
    role: accumulator.role,
    bodyId: accumulator.bodyId,
    domainId: accumulator.domainId,
    bodyOrder: accumulator.bodyOrder,
    material: accumulator.material,
    phase: accumulator.phase,
    particleCount: accumulator.particleCount,
    solidParticleCount: accumulator.solidParticleCount,
    restVolumeM3Mean: accumulator.restVolumeM3Sum / count,
    effectiveBulkModulusPaMean: accumulator.effectiveBulkModulusPaSum / count,
    shearModulusPaMean: accumulator.shearModulusPaSum / count,
    lameLambdaPaMean: accumulator.lameLambdaPaSum / count,
    soundSpeedMPerSMean: accumulator.soundSpeedMPerSSum / count,
    dynamicViscosityPaSMean: accumulator.dynamicViscosityPaSSum / count,
    surfaceTensionNPerMMean: accumulator.surfaceTensionNPerMSum / count,
    maxHydrostaticPressurePa: accumulator.maxHydrostaticPressurePa,
    crystalStructureKey: init?.crystalStructureKey ?? null,
    crystalPackingFraction: finiteNumber(init?.crystalPackingFraction, 0),
    initializationSpacingM: finiteNumber(init?.spacingM, 0),
    initializationSpacingByAxisM: Array.isArray(init?.spacingByAxisM)
      ? [...init.spacingByAxisM]
      : [],
    initializationAppliedParticleRadiusM: finiteNumber(init?.appliedParticleRadiusM, 0),
    initializationTargetSmoothingLengthM: finiteNumber(init?.targetSmoothingLengthM, 0),
    particleInitializationRowStatus: init?.status ?? null,
    particleRadiusPolicy: init?.particleRadiusPolicy ?? null,
    strictSourceOfTruth: false,
    provenance: {
      source: 'algorithm-derived-initial-body-mls-mpm-mechanics-row',
      particleInitializationRowSchema: init?.schema ?? null
    }
  };
}

/** Aggregate packed mechanics by stable initial-body identity and phase. */
export function buildAlgorithmInitialBodyMlsMpmMechanicsRows({
  particles = [],
  metadata = [],
  mechanics = null,
  mechanicsStrideFloats = 32,
  particleInitializationRows = null
} = {}) {
  const initRowsByBodyId = initializationRowsByBodyId(particleInitializationRows);
  const groups = new Map();
  const particleCount = Array.isArray(particles) ? particles.length : 0;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = particles[index] || {};
    const meta = metadata[index] || {};
    if (
      particle.spareProductSlot === true
      || meta.spareProductSlot === true
      || particle.phaseCompanionSlot === true
      || meta.phaseCompanionSlot === true
    ) continue;
    const rawBodyId = particle.initialBodyId ?? meta.initialBodyId ?? null;
    const bodyId = rawBodyId == null ? null : String(rawBodyId);
    const initializationRow = bodyId == null ? null : (initRowsByBodyId.get(bodyId) || null);
    const domainId = Math.max(0, Math.round(finiteNumber(
      particle.initialBodyDomainId
        ?? particle.renderDomainId
        ?? meta.initialBodyDomainId
        ?? meta.renderDomainId
        ?? initializationRow?.domainId,
      0
    )));
    if (initializationRow && domainId > 0 && domainId !== initializationRow.domainId) {
      throw new Error(
        `initial body '${bodyId}' maps to domain ${domainId}, expected ${initializationRow.domainId}`
      );
    }
    const role = initializationRow?.role
      ?? bodyId
      ?? particle.role
      ?? meta.role
      ?? 'unassigned';
    const material = meta.material || particle.material || 'unknown';
    const phase = meta.phase || particle.phase || 'unknown';
    const groupIdentity = bodyId == null ? `unassigned:${role}` : `body:${bodyId}`;
    const key = `${groupIdentity}|${material}|${phase}`;
    let accumulator = groups.get(key);
    if (!accumulator) {
      accumulator = createInitialBodyMechanicsAccumulator({
        role,
        bodyId,
        domainId: initializationRow?.domainId ?? domainId,
        bodyOrder: initializationRow?.bodyOrder ?? Number.MAX_SAFE_INTEGER,
        material,
        phase,
        initializationRow
      });
      groups.set(key, accumulator);
    } else if (bodyId != null && domainId > 0 && accumulator.domainId !== domainId) {
      throw new Error(`initial body '${bodyId}' maps to multiple domain ids`);
    }
    appendMechanicsSample(accumulator, {
      particle,
      meta,
      mechanics,
      offset: index * mechanicsStrideFloats
    });
  }
  const rows = [...groups.values()]
    .sort((a, b) => (
      a.bodyOrder - b.bodyOrder
      || String(a.bodyId ?? a.role).localeCompare(String(b.bodyId ?? b.role))
      || String(a.material).localeCompare(String(b.material))
      || String(a.phase).localeCompare(String(b.phase))
    ))
    .map(mechanicsRowFromAccumulator);
  return {
    schema: ULG_ALGORITHM_MLS_MPM_MECHANICS_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-mls-mpm-mechanics-rows-ready'
      : 'algorithm-derived-mls-mpm-mechanics-rows-empty',
    rowCount: rows.length,
    rows,
    particleCount,
    identityMode: 'initial-bodies',
    strictSourceOfTruth: false,
    derivationAuthority: 'packed-mls-mpm-mechanics-buffer-with-particle-initialization-rows'
  };
}

export function buildAlgorithmMlsMpmMechanicsRows({
  particles = [],
  metadata = [],
  mechanics = null,
  mechanicsStrideFloats = 32,
  particleInitializationRows = null
} = {}) {
  if (
    particleInitializationRows?.identityMode === 'initial-bodies'
    || (particleInitializationRows?.rows || []).some((row) => row?.bodyId != null)
  ) {
    return buildAlgorithmInitialBodyMlsMpmMechanicsRows({
      particles,
      metadata,
      mechanics,
      mechanicsStrideFloats,
      particleInitializationRows
    });
  }
  const initRowsByRole = initializationRowsByRole(particleInitializationRows);
  const groups = new Map();
  const particleCount = Array.isArray(particles) ? particles.length : 0;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = particles[index] || {};
    const meta = metadata[index] || {};
    // Spare product-placement rows are zero-mass reserves: they carry no
    // material-class statistics and must not mint a (role|material|phase)
    // class of their own.
    if (
      particle.spareProductSlot === true
      || meta.spareProductSlot === true
      || particle.phaseCompanionSlot === true
      || meta.phaseCompanionSlot === true
    ) continue;
    const role = particle.role || meta.role || (particle.material === 'h2o' ? 'base' : 'drop');
    const material = meta.material || particle.material || 'unknown';
    const phase = meta.phase || particle.phase || 'unknown';
    const key = `${role}|${material}|${phase}`;
    let accumulator = groups.get(key);
    if (!accumulator) {
      accumulator = createMechanicsAccumulator({
        role,
        material,
        phase,
        initializationRow: initRowsByRole.get(role) || null
      });
      groups.set(key, accumulator);
    }
    const offset = index * mechanicsStrideFloats;
    accumulator.particleCount += 1;
    accumulator.solidParticleCount += finiteNumber(mechanics?.[offset + 20], meta.solid ? 1 : 0) > 0.5 ? 1 : 0;
    accumulator.restVolumeM3Sum += finiteNumber(mechanics?.[offset + 19], 0);
    accumulator.effectiveBulkModulusPaSum += finiteNumber(mechanics?.[offset + 22], meta.effectiveBulkModulusPa);
    accumulator.shearModulusPaSum += finiteNumber(mechanics?.[offset + 23], meta.shearModulusPa);
    accumulator.lameLambdaPaSum += finiteNumber(mechanics?.[offset + 24], meta.lameLambdaPa);
    accumulator.soundSpeedMPerSSum += finiteNumber(mechanics?.[offset + 25], meta.soundSpeedMPerS);
    accumulator.dynamicViscosityPaSSum += finiteNumber(mechanics?.[offset + 29], meta.dynamicViscosityPaS);
    accumulator.surfaceTensionNPerMSum += finiteNumber(mechanics?.[offset + 30], meta.surfaceTensionNPerM);
    accumulator.maxHydrostaticPressurePa = Math.max(
      accumulator.maxHydrostaticPressurePa,
      finiteNumber(mechanics?.[offset + 28], meta.hydrostaticPressurePa)
    );
  }
  const rows = [...groups.values()]
    .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.material).localeCompare(String(b.material)))
    .map((accumulator) => {
      const count = Math.max(1, accumulator.particleCount);
      const init = accumulator.initializationRow;
      return {
        schema: ULG_ALGORITHM_MLS_MPM_MECHANICS_ROW_SCHEMA,
        status: 'algorithm-derived-mls-mpm-mechanics-row-ready',
        role: accumulator.role,
        material: accumulator.material,
        phase: accumulator.phase,
        particleCount: accumulator.particleCount,
        solidParticleCount: accumulator.solidParticleCount,
        restVolumeM3Mean: accumulator.restVolumeM3Sum / count,
        effectiveBulkModulusPaMean: accumulator.effectiveBulkModulusPaSum / count,
        shearModulusPaMean: accumulator.shearModulusPaSum / count,
        lameLambdaPaMean: accumulator.lameLambdaPaSum / count,
        soundSpeedMPerSMean: accumulator.soundSpeedMPerSSum / count,
        dynamicViscosityPaSMean: accumulator.dynamicViscosityPaSSum / count,
        surfaceTensionNPerMMean: accumulator.surfaceTensionNPerMSum / count,
        maxHydrostaticPressurePa: accumulator.maxHydrostaticPressurePa,
        crystalStructureKey: init?.crystalStructureKey ?? null,
        crystalPackingFraction: finiteNumber(init?.crystalPackingFraction, 0),
        initializationSpacingM: finiteNumber(init?.spacingM, 0),
        initializationAppliedParticleRadiusM: finiteNumber(init?.appliedParticleRadiusM, 0),
        initializationTargetSmoothingLengthM: finiteNumber(init?.targetSmoothingLengthM, 0),
        particleInitializationRowStatus: init?.status ?? null,
        particleRadiusPolicy: init?.particleRadiusPolicy ?? null,
        strictSourceOfTruth: false,
        provenance: {
          source: 'algorithm-derived-mls-mpm-mechanics-row',
          particleInitializationRowSchema: init?.schema ?? null
        }
      };
    });
  return {
    schema: ULG_ALGORITHM_MLS_MPM_MECHANICS_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-mls-mpm-mechanics-rows-ready'
      : 'algorithm-derived-mls-mpm-mechanics-rows-empty',
    rowCount: rows.length,
    rows,
    particleCount,
    strictSourceOfTruth: false,
    derivationAuthority: 'packed-mls-mpm-mechanics-buffer-with-particle-initialization-rows'
  };
}

function nonZeroMin(values) {
  const positive = values.map((value) => finiteNumber(value, 0)).filter((value) => value > 0);
  return positive.length > 0 ? Math.min(...positive) : 0;
}

function materialContactPairRows(rows) {
  const dropRows = rows.filter((row) => row.role === 'drop');
  const baseRows = rows.filter((row) => row.role === 'base');
  const pairs = [];
  for (const drop of dropRows) {
    for (const base of baseRows) {
      pairs.push([drop, base]);
    }
  }
  return pairs;
}

function orderedInitialBodyMechanicsGroups(mechanicsRows) {
  const groups = new Map();
  for (const row of mechanicsRows) {
    if (row?.bodyId == null) continue;
    const bodyId = String(row.bodyId);
    let group = groups.get(bodyId);
    if (!group) {
      group = {
        bodyId,
        domainId: Math.max(0, Math.round(finiteNumber(row.domainId, 0))),
        bodyOrder: finiteNumber(row.bodyOrder, Number.MAX_SAFE_INTEGER),
        rows: []
      };
      groups.set(bodyId, group);
    } else if (
      finiteNumber(row.domainId, group.domainId) > 0
      && group.domainId !== Math.round(finiteNumber(row.domainId, 0))
    ) {
      throw new Error(`initial body '${bodyId}' has inconsistent mechanics-row domain ids`);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => (
    a.bodyOrder - b.bodyOrder || a.bodyId.localeCompare(b.bodyId)
  ));
}

/**
 * Build deterministic contact-policy rows for every unordered initial-body
 * pair. Phase-split mechanics rows are crossed only between distinct bodies;
 * distinct bodies made from the same material remain a valid contact pair.
 */
export function buildAlgorithmInitialBodyContactRows({
  mlsMpmMechanicsRows = null
} = {}) {
  const mechanicsRows = Array.isArray(mlsMpmMechanicsRows?.rows)
    ? mlsMpmMechanicsRows.rows
    : [];
  const bodyGroups = orderedInitialBodyMechanicsGroups(mechanicsRows);
  const rows = [];
  for (let leftIndex = 0; leftIndex < bodyGroups.length; leftIndex += 1) {
    const leftBody = bodyGroups[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < bodyGroups.length; rightIndex += 1) {
      const rightBody = bodyGroups[rightIndex];
      for (const left of leftBody.rows) {
        for (const right of rightBody.rows) {
          const leftNormal = finiteNumber(left.effectiveBulkModulusPaMean, 0)
            + (4 / 3) * finiteNumber(left.shearModulusPaMean, 0);
          const rightNormal = finiteNumber(right.effectiveBulkModulusPaMean, 0)
            + (4 / 3) * finiteNumber(right.shearModulusPaMean, 0);
          const supportRadiusM = Math.max(
            finiteNumber(left.initializationTargetSmoothingLengthM, 0),
            finiteNumber(right.initializationTargetSmoothingLengthM, 0),
            finiteNumber(left.initializationAppliedParticleRadiusM, 0)
              + finiteNumber(right.initializationAppliedParticleRadiusM, 0)
          );
          rows.push({
            schema: ULG_ALGORITHM_CONTACT_MATERIAL_ROW_SCHEMA,
            status: 'algorithm-derived-contact-row-ready',
            pairKey: `${leftBody.bodyId}:${left.material}:${left.phase}|${rightBody.bodyId}:${right.material}:${right.phase}`,
            roles: [left.role, right.role],
            bodyIds: [leftBody.bodyId, rightBody.bodyId],
            domainIds: [leftBody.domainId, rightBody.domainId],
            bodyOrders: [leftBody.bodyOrder, rightBody.bodyOrder],
            materials: [left.material, right.material],
            phases: [left.phase, right.phase],
            normalStiffnessPa: nonZeroMin([leftNormal, rightNormal]),
            dampingViscosityPaS: Math.max(
              finiteNumber(left.dynamicViscosityPaSMean, 0),
              finiteNumber(right.dynamicViscosityPaSMean, 0)
            ),
            supportRadiusM,
            softerMaterial: leftNormal > 0 && rightNormal > 0 && leftNormal <= rightNormal
              ? left.material
              : right.material,
            softerBodyId: leftNormal > 0 && rightNormal > 0 && leftNormal <= rightNormal
              ? leftBody.bodyId
              : rightBody.bodyId,
            crystalStructureKeys: [left.crystalStructureKey, right.crystalStructureKey],
            impulsePolicy: 'bounded-by-softer-constituent-and-initial-support-radius',
            strictSourceOfTruth: false,
            forceMutationAuthority: 'not-authoritative-contact-policy-row',
            provenance: {
              source: 'algorithm-derived-initial-body-contact-row',
              mechanicsRowsSchema: mlsMpmMechanicsRows?.schema ?? null
            }
          });
        }
      }
    }
  }
  return {
    schema: ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-contact-rows-ready'
      : 'algorithm-derived-contact-rows-empty',
    rowCount: rows.length,
    rows,
    bodyCount: bodyGroups.length,
    bodyPairCount: (bodyGroups.length * (bodyGroups.length - 1)) / 2,
    identityMode: 'initial-bodies',
    strictSourceOfTruth: false,
    derivationAuthority: 'mls-mpm-mechanics-rows-contact-policy-view'
  };
}

export function buildAlgorithmMaterialContactRows({
  mlsMpmMechanicsRows = null
} = {}) {
  const mechanicsRows = Array.isArray(mlsMpmMechanicsRows?.rows) ? mlsMpmMechanicsRows.rows : [];
  if (
    mlsMpmMechanicsRows?.identityMode === 'initial-bodies'
    || mechanicsRows.some((row) => row?.bodyId != null)
  ) {
    return buildAlgorithmInitialBodyContactRows({ mlsMpmMechanicsRows });
  }
  const rows = materialContactPairRows(mechanicsRows).map(([drop, base]) => {
    const dropNormal = finiteNumber(drop.effectiveBulkModulusPaMean, 0)
      + (4 / 3) * finiteNumber(drop.shearModulusPaMean, 0);
    const baseNormal = finiteNumber(base.effectiveBulkModulusPaMean, 0)
      + (4 / 3) * finiteNumber(base.shearModulusPaMean, 0);
    const supportRadiusM = Math.max(
      finiteNumber(drop.initializationTargetSmoothingLengthM, 0),
      finiteNumber(base.initializationTargetSmoothingLengthM, 0),
      finiteNumber(drop.initializationAppliedParticleRadiusM, 0) + finiteNumber(base.initializationAppliedParticleRadiusM, 0)
    );
    return {
      schema: ULG_ALGORITHM_CONTACT_MATERIAL_ROW_SCHEMA,
      status: 'algorithm-derived-contact-row-ready',
      pairKey: `${drop.role}:${drop.material}|${base.role}:${base.material}`,
      roles: [drop.role, base.role],
      materials: [drop.material, base.material],
      phases: [drop.phase, base.phase],
      normalStiffnessPa: nonZeroMin([dropNormal, baseNormal]),
      dampingViscosityPaS: Math.max(
        finiteNumber(drop.dynamicViscosityPaSMean, 0),
        finiteNumber(base.dynamicViscosityPaSMean, 0)
      ),
      supportRadiusM,
      softerMaterial: dropNormal > 0 && baseNormal > 0 && dropNormal <= baseNormal ? drop.material : base.material,
      crystalStructureKeys: [drop.crystalStructureKey, base.crystalStructureKey],
      impulsePolicy: 'bounded-by-softer-constituent-and-initial-support-radius',
      strictSourceOfTruth: false,
      forceMutationAuthority: 'not-authoritative-contact-policy-row',
      provenance: {
        source: 'algorithm-derived-contact-row',
        mechanicsRowsSchema: mlsMpmMechanicsRows?.schema ?? null
      }
    };
  });
  return {
    schema: ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-contact-rows-ready'
      : 'algorithm-derived-contact-rows-empty',
    rowCount: rows.length,
    rows,
    strictSourceOfTruth: false,
    derivationAuthority: 'mls-mpm-mechanics-rows-contact-policy-view'
  };
}

export function buildAlgorithmSurfaceExtractionRows({
  particleInitializationRows = null,
  mlsMpmMechanicsRows = null,
  contactRows = null
} = {}) {
  const mechanicsRows = Array.isArray(mlsMpmMechanicsRows?.rows) ? mlsMpmMechanicsRows.rows : [];
  const contactSupportByRole = new Map();
  const contactSupportByBodyId = new Map();
  for (const row of contactRows?.rows || []) {
    for (const role of row.roles || []) {
      contactSupportByRole.set(role, Math.max(
        finiteNumber(contactSupportByRole.get(role), 0),
        finiteNumber(row.supportRadiusM, 0)
      ));
    }
    for (const bodyId of row.bodyIds || []) {
      contactSupportByBodyId.set(bodyId, Math.max(
        finiteNumber(contactSupportByBodyId.get(bodyId), 0),
        finiteNumber(row.supportRadiusM, 0)
      ));
    }
  }
  const rows = (particleInitializationRows?.rows || []).map((init) => {
    const mechanics = init.bodyId != null
      ? (mechanicsRows.find((row) => row.bodyId === init.bodyId) || null)
      : (mechanicsRows.find((row) => row.role === init.role) || null);
    const contactSupportRadiusM = init.bodyId != null
      ? contactSupportByBodyId.get(init.bodyId)
      : contactSupportByRole.get(init.role);
    const smoothingRadiusM = Math.max(
      finiteNumber(init.targetSmoothingLengthM, 0),
      finiteNumber(mechanics?.initializationTargetSmoothingLengthM, 0),
      finiteNumber(contactSupportRadiusM, 0)
    );
    const voxelSizeM = smoothingRadiusM > 0 ? smoothingRadiusM / 2 : finiteNumber(init.spacingM, 0);
    return {
      schema: ULG_ALGORITHM_SURFACE_EXTRACTION_ROW_SCHEMA,
      status: 'algorithm-derived-surface-extraction-row-ready',
      role: init.role,
      ...(init.bodyId != null ? {
        bodyId: init.bodyId,
        domainId: init.domainId,
        bodyOrder: init.bodyOrder
      } : {}),
      material: init.material,
      materialId: finiteNumber(init.materialId, 0),
      phase: mechanics?.phase ?? null,
      isovalue: 0.5,
      isovaluePolicy: 'density-kernel-half-occupancy',
      smoothingRadiusM,
      voxelSizeM,
      normalScaleM: smoothingRadiusM,
      supportRadiusM: finiteNumber(contactSupportRadiusM, smoothingRadiusM),
      particleRadiusM: finiteNumber(init.appliedParticleRadiusM, 0),
      crystalStructureKey: init.crystalStructureKey ?? null,
      crystalPackingFraction: finiteNumber(init.crystalPackingFraction, 0),
      drawPolicy: 'material-phase-surface-row',
      strictSourceOfTruth: false,
      rendererAuthority: 'not-renderer-authoritative-surface-policy-row',
      provenance: {
        source: 'algorithm-derived-surface-extraction-row',
        particleInitializationRowSchema: init.schema ?? null,
        mechanicsRowsSchema: mlsMpmMechanicsRows?.schema ?? null,
        contactRowsSchema: contactRows?.schema ?? null
      }
    };
  });
  return {
    schema: ULG_ALGORITHM_SURFACE_EXTRACTION_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-surface-extraction-rows-ready'
      : 'algorithm-derived-surface-extraction-rows-empty',
    rowCount: rows.length,
    rows,
    strictSourceOfTruth: false,
    derivationAuthority: 'particle-initialization-mechanics-contact-surface-policy-view'
  };
}
